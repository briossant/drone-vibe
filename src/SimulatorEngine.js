// src/SimulatorEngine.js
import Config from './Config.js';
import Renderer from './Renderer.js';
import PhysicsEngine from './PhysicsEngine.js';
import InputManager from './InputManager.js';
import UIManager from './UIManager.js';
import Drone from './Drone.js';
import World from './World.js';
import { clamp } from './Utils.js'; // Import utilities

class SimulatorEngine {
    constructor() {
        this.canvas = document.getElementById('webgl-canvas');
        if (!this.canvas) {
            throw new Error("Fatal Error: Canvas element #webgl-canvas not found.");
        }

        // Core Modules
        this.renderer = new Renderer(this);
        this.physicsEngine = new PhysicsEngine(this);
        this.inputManager = new InputManager(this);
        this.uiManager = new UIManager(this);
        this.world = new World(this);
        this.drone = new Drone(this); // The player's drone

        // Simulation State
        this.isRunning = false;
        this.lastTime = 0;
        this.simulationState = {}; // Shared state object for UI etc.

        // Bind loop method to maintain 'this' context
        this._boundLoop = this.loop.bind(this);

        if (Config.DEBUG_MODE) {
            console.log('SimulatorEngine: Initialized');
        }
    }

    initialize() {
        if (Config.DEBUG_MODE) console.log('SimulatorEngine: Initializing modules...');

        // Initialize core components FIRST
        this.renderer.initialize(this.canvas); // Renderer creates debug cam and controls
        this.physicsEngine.initialize();
        this.inputManager.initialize();
        this.uiManager.initialize();

        // Initialize world content (adds ground mesh, lights to renderer)
        this.world.initialize();

        // Initialize the drone (creates visual, physics body, AND FPV cam)
        this.drone.initialize({ x: 0, y: 1, z: 0 });

        // --- Set the INITIAL active camera ---
        // For Phase 1, explicitly use the DEBUG camera defined in Renderer
        if (this.renderer.debugCamera) {
            this.renderer.setActiveCamera(this.renderer.debugCamera);
            console.log("SimulatorEngine: Initial active camera set to DEBUG camera.");
        } else {
            console.error("SimulatorEngine: Debug camera not found in Renderer!");
            // Fallback to FPV cam if debug cam failed? Or throw error?
            if (this.drone.FPVCamera) {
                this.renderer.setActiveCamera(this.drone.FPVCamera);
                console.warn("SimulatorEngine: Using FPV camera as fallback.");
            } else {
                console.error("SimulatorEngine: No usable camera found!");
            }
        }

        this.setupDebugControls();

        if (Config.DEBUG_MODE) console.log('SimulatorEngine: Initialization complete.');
    }


    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.lastTime = performance.now(); // Use performance.now() for high-resolution time
        if (Config.DEBUG_MODE) console.log('SimulatorEngine: Starting main loop...');
        requestAnimationFrame(this._boundLoop);
    }

    stop() {
        if (!this.isRunning) return;
        this.isRunning = false;
        if (Config.DEBUG_MODE) console.log('SimulatorEngine: Stopping main loop...');
    }

    loop(currentTime) {
        if (!this.isRunning) return;

        const deltaTime = (currentTime - this.lastTime) * 0.001;
        this.lastTime = currentTime;
        const clampedDeltaTime = clamp(deltaTime, 0, 0.05);

        // --- Update Cycle ---

        // 1. Handle Input
        this.inputManager.update();
        const controls = this.inputManager.getControls();

        // 2. Update Drone Logic (FC) - Applies forces/torques
        this.drone.update(clampedDeltaTime, controls);
        // Maybe update other dynamic objects here in future

        // 3. Step Physics Engine - Calculates new positions/rotations
        this.physicsEngine.update(clampedDeltaTime);

        // 4. Synchronize Visuals - Update THREE meshes from CANNON bodies
        this.physicsEngine.syncVisuals(); // <<<--- CALL SYNC HERE

        // 5. Update World (e.g., animations - not physics)
        this.world.update(clampedDeltaTime);

        // 6. Prepare State for UI
        this.simulationState.drone = this.drone.getState();
        this.simulationState.controls = controls;

        // 7. Update UI
        this.uiManager.update(this.simulationState);

        // 8. Render Scene
        this.renderer.render(); // Uses activeCamera

        requestAnimationFrame(this._boundLoop);
    }

    setupDebugControls() {
        // Existing controls... R for Reset, Enter for Arm/Disarm
        window.addEventListener('keydown', (event) => {
            if (event.key === 'r' || event.key === 'R') {
                console.log("Debug: Resetting Drone...");
                this.drone.reset({ x: 0, y: 1, z: 0 });
            }
            if (event.key === 'Enter') {
                if (this.drone.armed) {
                    console.log("Debug: Disarming Drone...");
                    this.drone.disarm();
                } else {
                    console.log("Debug: Arming Drone...");
                    this.drone.arm();
                }
            }

            // --- Add Camera Switch Key (Example: 'c') ---
            if (event.key === 'c' || event.key === 'C') {
                if (this.renderer.activeCamera === this.renderer.debugCamera) {
                    if (this.drone.FPVCamera) {
                        console.log("Switching to FPV Camera");
                        this.renderer.setActiveCamera(this.drone.FPVCamera);
                    } else {
                        console.warn("Cannot switch: FPV Camera not available.");
                    }
                } else {
                    console.log("Switching to Debug Camera");
                    this.renderer.setActiveCamera(this.renderer.debugCamera);
                }
            }
        });
    }

    // Add dispose method for cleanup if needed
    dispose() {
        this.stop();
        this.inputManager.dispose();
        // Add cleanup for renderer, physics, etc.
        if (Config.DEBUG_MODE) console.log('SimulatorEngine: Disposed.');
    }
}

export default SimulatorEngine;