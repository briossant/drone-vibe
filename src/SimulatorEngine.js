// src/SimulatorEngine.js
import Config from './Config.js';
import Renderer from './Renderer.js';
import PhysicsEngine from './PhysicsEngine.js';
import InputManager from './InputManager.js';
import UIManager from './UIManager.js';
import Drone from './Drone.js';
import World from './World.js';
import { clamp } from './Utils.js'; // Import utilities
import AssetLoader from './AssetLoader.js'; // Import the loader instance

class SimulatorEngine {
    constructor() {
        this.canvas = document.getElementById('webgl-canvas');
        if (!this.canvas) {
            throw new Error("Fatal Error: Canvas element #webgl-canvas not found.");
        }

        // --- Core Modules ---
        this.assetLoader = AssetLoader; // Store reference to the loader instance
        this.renderer = new Renderer(this);
        this.physicsEngine = new PhysicsEngine(this);
        this.inputManager = new InputManager(this);
        this.uiManager = new UIManager(this);
        this.world = new World(this);
        this.drone = new Drone(this);

        // Simulation State
        this.isRunning = false;
        this.lastTime = 0;
        this.simulationState = {};

        this._boundLoop = this.loop.bind(this);

        if (Config.DEBUG_MODE) {
            console.log('SimulatorEngine: Initialized');
        }
    }

    async initialize() {
        if (Config.DEBUG_MODE) console.log('SimulatorEngine: Initializing modules...');

        // Initialize components that DON'T depend on loaded assets first
        this.renderer.initialize(this.canvas);
        this.physicsEngine.initialize();
        this.inputManager.initialize();
        this.uiManager.initialize();

        // Initialize World
        await this.world.initialize();

        // Initialize Drone (which creates the FPV camera)
        await this.drone.initialize(); // Uses default start position from Config now

        // --- Set the INITIAL active camera ---
        // PRIORITIZE FPV CAMERA
        if (this.drone.FPVCamera) {
            this.renderer.setActiveCamera(this.drone.FPVCamera);
            console.log("SimulatorEngine: Initial active camera set to FPV camera.");
        }
        // Fallback to Debug Camera if FPV camera wasn't created for some reason
        else if (this.renderer.debugCamera) {
            this.renderer.setActiveCamera(this.renderer.debugCamera);
            console.warn("SimulatorEngine: FPV Camera not found! Using DEBUG camera as fallback.");
        }
        // Error if neither camera is available
        else {
            console.error("SimulatorEngine FATAL: No usable camera found (FPV or Debug)!");
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
        // --- Keyboard Controls ---
        window.addEventListener('keydown', (event) => {
            // Reset ('r' or 'R')
            if (event.key.toLowerCase() === 'r') {
                if (this.drone) {
                    console.log("Debug: Resetting Drone via Keyboard...");
                    // Use the configured start position for reset
                    this.drone.reset(Config.DRONE_START_POSITION);
                } else {
                    console.warn("Debug: Cannot reset, drone not initialized.");
                }
            }
            // Arm/Disarm ('Enter')
            if (event.key === 'Enter') {
                this.toggleArmDisarm(); // Use helper function
            }
            // Camera Switch ('c' or 'C')
            if (event.key.toLowerCase() === 'c') {
                this.switchCamera(); // Use helper function
            }
        });

        // --- Gamepad Button Controls (Polled in InputManager update) ---
        // We'll add logic in InputManager to check for button presses each frame

        console.log("Debug Controls Initialized: R=Reset, Enter=Arm/Disarm, C=Switch Camera. Check Gamepad buttons.");
    }

    // Helper function for Arm/Disarm logic
    toggleArmDisarm() {
        if (this.drone) {
            if (this.drone.armed) {
                console.log("Debug: Disarming Drone...");
                this.drone.disarm();
            } else {
                console.log("Debug: Arming Drone...");
                this.drone.arm();
            }
        } else {
            console.warn("Debug: Cannot arm/disarm, drone not initialized.");
        }
    }

    // Helper function for Camera Switching logic
    switchCamera() {
        if (!this.renderer || !this.drone) {
            console.warn("Debug: Cannot switch camera, renderer or drone not ready.");
            return;
        }
        if (this.renderer.activeCamera === this.renderer.debugCamera) {
            if (this.drone.FPVCamera) {
                console.log("Switching to FPV Camera");
                this.renderer.setActiveCamera(this.drone.FPVCamera);
            } else {
                console.warn("Cannot switch: FPV Camera not found on drone.");
            }
        } else {
            if (this.renderer.debugCamera) {
                console.log("Switching to Debug Camera");
                this.renderer.setActiveCamera(this.renderer.debugCamera);
            } else {
                console.warn("Cannot switch: Debug camera not found on renderer.");
            }
        }
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