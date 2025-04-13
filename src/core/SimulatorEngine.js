// src/core/SimulatorEngine.js
import { getCurrentConfig } from '../config/ConfigManager.js'; // Updated path
import Renderer from './Renderer.js';                           // Path ok
import PhysicsEngine from './PhysicsEngine.js';                 // Path ok
import InputManager from '../managers/InputManager.js';         // Updated path
import Drone from '../simulation/Drone.js';                     // Updated path
import World from '../simulation/World.js';                     // Updated path
import { clamp } from '../utils/Utils.js';                      // Updated path
import AssetLoader from '../utils/AssetLoader.js';              // Updated path
import * as CANNON from 'cannon-es';
import EventBus, {EVENTS} from "../utils/EventBus.js";          // Updated path
import CannonDebugger from 'cannon-es-debugger';


class SimulatorEngine {
    constructor(context) {
        const config = getCurrentConfig(); // Get config early

        this.canvas = document.getElementById('webgl-canvas');
        if (!this.canvas) {
            throw new Error("Fatal Error: Canvas element #webgl-canvas not found.");
        }

        // Core Modules
        this.context = context || {};

        this.renderer = new Renderer(this);
        this.physicsEngine = new PhysicsEngine(this);
        this.inputManager = InputManager; // Use singleton directly
        this.world = new World(this);
        this.drone = new Drone(this);

        // Simulation State
        this.isRunning = false;
        this.isPaused = false;
        this.lastTime = 0;
        this.simulationState = {}; // Store current state for UI etc.
        this.animationFrameId = null;

        this._boundLoop = this.loop.bind(this); // Bind loop once

        // Bind event handlers ONCE to ensure 'this' context and allow removal
        this.handlePauseRequest = this.pause.bind(this);
        this.handleResumeRequest = this.resume.bind(this);
        this.handleResetRequest = this.restartFlight.bind(this);
        this.handleArmToggleRequest = this.toggleArmDisarm.bind(this);


        if (config.DEBUG_MODE) {
            console.log('SimulatorEngine: Initialized');
        }
    }


    async initialize() {
        const config = getCurrentConfig();
        if (config.DEBUG_MODE) console.log('SimulatorEngine: Initializing modules...');


        // Module Initialization (Order matters)
        this.renderer.initialize(this.canvas);
        this.physicsEngine.initialize();
        await this.world.initialize(); // World now depends on generator
        await this.drone.initialize(); // Ensure drone is initialized after world/physics

        // Set initial camera (should be FPV cam if drone initialized correctly)
        if (this.drone.FPVCamera) {
            this.renderer.setActiveCamera(this.drone.FPVCamera);
            if (config.DEBUG_MODE) console.log("SimulatorEngine: Initial active camera set to FPV camera.");
        } else if (this.renderer.debugCamera) {
            this.renderer.setActiveCamera(this.renderer.debugCamera);
            console.warn("SimulatorEngine: FPV Camera not found after initialization! Using DEBUG camera.");
        } else {
            console.error("SimulatorEngine FATAL: No usable camera found post-initialization!");
            throw new Error("No camera available.");
        }

        // Subscribe to control events AFTER initialization is complete
        EventBus.on(EVENTS.SIM_PAUSE_REQUESTED, this.handlePauseRequest);
        EventBus.on(EVENTS.SIM_RESUME_REQUESTED, this.handleResumeRequest);
        EventBus.on(EVENTS.SIM_RESET_REQUESTED, this.handleResetRequest);
        EventBus.on(EVENTS.ARM_DISARM_TOGGLE_REQUESTED, this.handleArmToggleRequest);

        if (config.DEBUG_CANNON) { // <<< Check the flag from Config.js
            try {
                this.physicsDebugger = new CannonDebugger(this.renderer.scene, this.physicsEngine.world, {
                    color: 0x00ff00, // Green wireframes
                    scale: 1.0,      // Default scale
                    // autoUpdate: false // We will call update manually in the loop
                });
                if (config.DEBUG_MODE) console.log("Cannon-es-debugger initialized.");
            } catch (error) {
                console.error("Failed to initialize CannonDebugger:", error);
                this.physicsDebugger = null; // Ensure it's null if init fails
            }
        }
        if (config.DEBUG_MODE) console.log('SimulatorEngine: Initialization complete.');
        // Applying initial settings is now done in LoadingState *after* this completes
    }

    start() {
        const config = getCurrentConfig();
        if (this.isRunning) return;
        this.isRunning = true;
        this.isPaused = false; // Ensure not paused
        this.lastTime = performance.now();
        if (config.DEBUG_MODE) console.log('SimulatorEngine: Starting main loop...');
        this.animationFrameId = requestAnimationFrame(this._boundLoop);
    }

    stop() {
        const config = getCurrentConfig();
        if (!this.isRunning) return;
        this.isRunning = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        if (config.DEBUG_MODE) console.log('SimulatorEngine: Main loop stopped.');
    }

    pause() {
        const config = getCurrentConfig();
        // Pause simulation logic. Rendering continues in the loop if needed (for menus).
        if (!this.isRunning || this.isPaused) return;
        this.isPaused = true;
        if (config.DEBUG_MODE) console.log('SimulatorEngine: Paused simulation logic.');
    }

    resume() {
        const config = getCurrentConfig();
        if (!this.isRunning || !this.isPaused) return;
        this.isPaused = false;
        this.lastTime = performance.now(); // Reset time to avoid large deltaTime jump
        if (config.DEBUG_MODE) console.log('SimulatorEngine: Resumed simulation logic.');
        // Requesting pointer lock is handled by SimulatingState based on user interaction (click).
    }

    restartFlight() {
        const config = getCurrentConfig();
        if (this.drone) {
            if (config.DEBUG_MODE) console.log("SimulatorEngine: Restarting flight...");
            // Use the configured start position
            const startPos = config.DRONE_START_POSITION;
            const resetVec = startPos ? new CANNON.Vec3(startPos.x, startPos.y, startPos.z) : new CANNON.Vec3(0, 1, 0); // Default fallback
            this.drone.reset(resetVec); // Pass Vec3 directly
        } else {
            if (config.DEBUG_MODE) console.warn("SimulatorEngine: Cannot restart flight, drone not initialized.");
        }
    }

    loop(currentTime) {
        if (!this.isRunning) return;
        const config = getCurrentConfig();


        this.animationFrameId = requestAnimationFrame(this._boundLoop);

        const deltaTime = (currentTime - this.lastTime) * 0.001;
        this.lastTime = currentTime;
        const physicsTimestep = getCurrentConfig().PHYSICS_TIMESTEP; // Get current timestep
        const clampedDeltaTime = clamp(deltaTime, 0, physicsTimestep * 5); // Clamp delta time slightly larger than physics step

        // --- Main Update Cycle (Runs only if NOT paused) ---
        if (!this.isPaused) {
            // 1. InputManager polls independently, just get latest state
            const controls = this.inputManager.getControls();

            // 2. Update Drone Logic (Flight Controller applies forces/torques)
            this.drone?.update(clampedDeltaTime, controls);

            // 3. Step Physics Engine
            this.physicsEngine?.update(clampedDeltaTime); // Use clampedDeltaTime for physics step

            // 4. Synchronize Visuals with Physics state (After physics step)
            this.physicsEngine?.syncVisuals();

            // 5. Update World (e.g., animations, dynamic elements)
            this.world?.update(clampedDeltaTime);

            // 6. Prepare State for UI/OSD
            this.simulationState.drone = this.drone?.getState();
            this.simulationState.controls = controls;
            EventBus.emit(EVENTS.SIMULATION_STATE_UPDATE, this.simulationState);
        }
        // --- End Main Update Cycle ---

        if (config.DEBUG_CANNON && this.physicsDebugger && !this.isPaused) { // <<< Check flag
            this.physicsDebugger.update();
        }

        // 7. Render Scene (Always render, even when paused, for menu visibility)
        this.renderer?.render(clampedDeltaTime); // Pass delta time for potential animations/effects in renderer
    }

    toggleArmDisarm() {
        const config = getCurrentConfig();
        if (this.drone && this.drone.flightController) { // Check FC exists
            if (this.drone.flightController.armed) {
                this.drone.disarm();
            } else {
                // Only arm if reasonably level? (Optional safety check)
                // const state = this.drone.getState();
                // if (state && Math.abs(state.euler.roll) < 15 && Math.abs(state.euler.pitch) < 15) {
                this.drone.arm();
                // } else if (config.DEBUG_MODE) {
                //    console.log("Arming prevented: Drone not level.");
                // }
            }

            // Emit state update immediately after toggle if not paused
            if (!this.isPaused) {
                this.simulationState.drone = this.drone.getState();
                this.simulationState.controls = this.inputManager.getControls();
                EventBus.emit(EVENTS.SIMULATION_STATE_UPDATE, this.simulationState);
            }

        } else {
            if (config.DEBUG_MODE) console.warn("Cannot toggle arm state: Drone or FlightController not initialized.");
        }
    }


    // --- Cleanup Method ---
    dispose() {
        const config = getCurrentConfig();
        if (config.DEBUG_MODE) console.log('SimulatorEngine: Disposing resources...');
        this.stop(); // Ensure animation loop is stopped

        // Unsubscribe from events
        EventBus.off(EVENTS.SIM_PAUSE_REQUESTED, this.handlePauseRequest);
        EventBus.off(EVENTS.SIM_RESUME_REQUESTED, this.handleResumeRequest);
        EventBus.off(EVENTS.SIM_RESET_REQUESTED, this.handleResetRequest);
        EventBus.off(EVENTS.ARM_DISARM_TOGGLE_REQUESTED, this.handleArmToggleRequest);


        // Dispose modules in reverse order of initialization (roughly)
        this.inputManager?.dispose(); // InputManager is singleton, careful with dispose logic if reused
        this.world?.dispose();
        this.renderer?.dispose(); // Renderer dispose handles canvas listeners etc.
        this.physicsEngine = null; // PhysicsEngine might not need explicit dispose beyond clearing bodies

        // Clear physics world bodies (more robust cleanup)
        if (this.physicsEngine?.world) {
            while (this.physicsEngine.world.bodies.length > 0) {
                this.physicsEngine.world.removeBody(this.physicsEngine.world.bodies[0]);
            }
            this.physicsEngine.bodyMap?.clear();
        }


        // Clear Three.js scene (more robust cleanup)
        if (this.renderer?.scene) {
            while(this.renderer.scene.children.length > 0){
                const object = this.renderer.scene.children[0];
                this.renderer.scene.remove(object);
                // Dispose geometry/material/textures if necessary
                if (object.geometry) object.geometry.dispose();
                if (object.material) {
                    if (Array.isArray(object.material)) {
                        object.material.forEach(material => material.dispose());
                    } else {
                        object.material.dispose();
                    }
                }
            }
        }

        // Reset references
        this.drone = null; // Allow garbage collection
        this.world = null;
        // this.inputManager = null; // Singleton, keep instance
        this.physicsEngine = null;
        this.renderer = null;


        if (config.DEBUG_MODE) console.log('SimulatorEngine: Disposal complete.');
    }
}

export default SimulatorEngine;