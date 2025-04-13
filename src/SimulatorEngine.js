// src/SimulatorEngine.js
import { getCurrentConfig } from './ConfigManager.js';
import Renderer from './Renderer.js';
import PhysicsEngine from './PhysicsEngine.js';
import InputManager from './InputManager.js';
import Drone from './Drone.js';
import World from './World.js';
import { clamp } from './Utils.js';
import AssetLoader from './AssetLoader.js';
import * as CANNON from 'cannon-es';
import EventBus, {EVENTS} from "./EventBus.js"; // Keep CANNON import for Vec3


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
        this.inputManager = InputManager;
        this.world = new World(this);
        this.drone = new Drone(this);

        // Simulation State
        this.isRunning = false;
        this.isPaused = false;
        this.lastTime = 0;
        this.simulationState = {}; // Store current state for UI etc.
        this.animationFrameId = null;

        this._boundLoop = this.loop.bind(this); // Bind loop once

        EventBus.on(EVENTS.SIM_PAUSE_REQUESTED, this.handlePauseRequest); // Use bound method
        EventBus.on(EVENTS.SIM_RESUME_REQUESTED, this.handleResumeRequest); // Use bound method
        EventBus.on(EVENTS.SIM_RESET_REQUESTED, this.handleResetRequest); // Use bound method
        EventBus.on(EVENTS.ARM_DISARM_TOGGLE_REQUESTED, this.handleArmToggleRequest); // Listen for specific event

        if (config.DEBUG_MODE) {
            console.log('SimulatorEngine: Initialized');
        }
    }

    handlePauseRequest = () => this.pause();
    handleResumeRequest = () => this.resume();
    handleResetRequest = () => this.restartFlight();
    handleArmToggleRequest = () => this.toggleArmDisarm();

    async initialize() {
        const config = getCurrentConfig();
        if (config.DEBUG_MODE) console.log('SimulatorEngine: Initializing modules...');

        // Module Initialization (Order matters)
        this.renderer.initialize(this.canvas);
        this.physicsEngine.initialize();
        await this.world.initialize();
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

        // REMOVED setupDebugControls() - Let main.js handle Esc, menu handle Reset etc.

        if (config.DEBUG_MODE) console.log('SimulatorEngine: Initialization complete.');
        // Applying initial settings is now done in main.js *after* this completes
        EventBus.on(EVENTS.SIM_PAUSE_REQUESTED, () => this.pause());
        EventBus.on(EVENTS.SIM_RESUME_REQUESTED, () => this.resume()); // If explicit resume needed
        EventBus.on(EVENTS.SIM_RESET_REQUESTED, () => this.restartFlight());
        EventBus.on(EVENTS.ARM_DISARM_TOGGLE_REQUESTED, () => this.toggleArmDisarm()); // Assuming toggleArmDisarm method exists
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
        // Requesting pointer lock is handled by main.js based on user interaction (click).
    }

    restartFlight() {
        const config = getCurrentConfig();
        if (this.drone) {
            if (config.DEBUG_MODE) console.log("SimulatorEngine: Restarting flight...");
            // Use the configured start position (now fetched via ConfigManager)
            const startPos = config.DRONE_START_POSITION;
            const resetVec = startPos ? new CANNON.Vec3(startPos.x, startPos.y, startPos.z) : new CANNON.Vec3(0, 1, 0); // Default fallback
            this.drone.reset(resetVec); // Pass Vec3 directly
            // Ensure drone is awake after reset
            this.drone.physicsBody?.wakeUp();
        }
    }

    loop(currentTime) {
        if (!this.isRunning) return;

        this.animationFrameId = requestAnimationFrame(this._boundLoop);

        const deltaTime = (currentTime - this.lastTime) * 0.001;
        this.lastTime = currentTime;
        const clampedDeltaTime = clamp(deltaTime, 0, 0.1); // Clamp to prevent physics issues

        // --- Main Update Cycle (Runs only if NOT paused) ---
        if (!this.isPaused) {
            // 1. Handle Input (polls internally, considers pause state)
            this.inputManager.update(this.isPaused); // Inform InputManager about pause state
            const controls = this.inputManager.getControls();

            // 2. Update Drone Logic (Flight Controller)
            this.drone.update(clampedDeltaTime, controls); // Apply forces/torques

            // 3. Step Physics Engine
            this.physicsEngine.update(clampedDeltaTime); // Simulate physics step

            // 4. Synchronize Visuals with Physics state
            this.physicsEngine.syncVisuals(); // Update THREE objects from CANNON bodies

            // 5. Update World (e.g., animations, dynamic elements)
            this.world.update(clampedDeltaTime);

            // 6. Prepare State for UI/OSD
            // Store potentially needed info in one place for UI
            this.simulationState.drone = this.drone.getState();
            this.simulationState.controls = controls;
            EventBus.emit(EVENTS.SIMULATION_STATE_UPDATE, this.simulationState);
        }
        // --- End Main Update Cycle ---

        // 8. Render Scene (Always render, even when paused, for menu visibility)
        this.renderer.render(clampedDeltaTime);
    }

    // --- Simplified toggleArmDisarm ---
    // Primarily for potential future use or direct calls, not debug keys anymore
    toggleArmDisarm() {
        const config = getCurrentConfig();
        if (this.drone) {
            if (this.drone.armed) {
                this.drone.disarm();
            } else {
                this.drone.arm();
            }
        } else {
            if (config.DEBUG_MODE) console.warn("Cannot toggle arm state: Drone not initialized.");
        }

        if (!this.isPaused) {
            const controls = this.inputManager.getControls();
            const droneState = this.drone.getState();
            this.simulationState.drone = droneState;
            this.simulationState.controls = controls;
            EventBus.emit(EVENTS.SIMULATION_STATE_UPDATE, this.simulationState);
            if (getCurrentConfig().DEBUG_MODE) console.log("SimulatorEngine: Emitted immediate state update after arm toggle.");
        }
    }


    // --- Cleanup Method ---
    dispose() {
        const config = getCurrentConfig();
        if (config.DEBUG_MODE) console.log('SimulatorEngine: Disposing resources...');
        this.stop(); // Ensure animation loop is stopped

        // Dispose modules in reverse order of initialization (roughly)
        this.inputManager?.dispose();
        this.renderer?.dispose(); // Renderer dispose handles canvas listeners etc.

        // Clear physics world
        if (this.physicsEngine?.world) {
            // Remove bodies tracked by the engine
            this.physicsEngine.bodyMap?.forEach((entry, body) => {
                this.physicsEngine.world.removeBody(body);
            });
            this.physicsEngine.bodyMap?.clear();
            // Further cannon-es cleanup might be needed if using constraints etc.
        }

        // Clear Three.js scene
        if (this.renderer?.scene) {
            while(this.renderer.scene.children.length > 0){
                const object = this.renderer.scene.children[0];
                this.renderer.scene.remove(object);
                // If applicable, dispose geometry/material/textures of removed objects
                // This requires a more thorough traversal (see Three.js docs)
            }
        }

        EventBus.off(EVENTS.SIM_PAUSE_REQUESTED, this.handlePauseRequest);
        EventBus.off(EVENTS.SIM_RESUME_REQUESTED, this.handleResumeRequest);
        EventBus.off(EVENTS.SIM_RESET_REQUESTED, this.handleResetRequest);
        EventBus.off(EVENTS.ARM_DISARM_TOGGLE_REQUESTED, this.handleArmToggleRequest); t

        // Reset references
        this.drone = null;
        this.world = null;
        this.inputManager = null;
        this.physicsEngine = null;
        this.renderer = null;


        if (config.DEBUG_MODE) console.log('SimulatorEngine: Disposal complete.');
    }
}

export default SimulatorEngine;