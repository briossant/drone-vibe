// src/SimulatorEngine.js
import { getCurrentConfig } from './ConfigManager.js'; // Use the helper
import Renderer from './Renderer.js';
import PhysicsEngine from './PhysicsEngine.js';
import InputManager from './InputManager.js';
import UIManager from './UIManager.js';
import Drone from './Drone.js';
import World from './World.js';
import { clamp } from './Utils.js';
import AssetLoader from './AssetLoader.js';
import * as CANNON from 'cannon-es';


class SimulatorEngine {
    constructor() {
        // Get initial config - modules might need it in their constructors too
        const config = getCurrentConfig();

        this.canvas = document.getElementById('webgl-canvas');
        if (!this.canvas) {
            throw new Error("Fatal Error: Canvas element #webgl-canvas not found.");
        }

        // --- Core Modules ---
        this.assetLoader = AssetLoader;
        this.renderer = new Renderer(this);
        this.physicsEngine = new PhysicsEngine(this);
        this.inputManager = new InputManager(this);
        this.uiManager = new UIManager(this);
        this.world = new World(this);
        this.drone = new Drone(this);

        // Simulation State
        this.isRunning = false; // True if loop is requested
        this.isPaused = false;  // True if simulation logic should be skipped
        this.lastTime = 0;
        this.simulationState = {};
        this.animationFrameId = null; // Store request ID for cancellation

        this._boundLoop = this.loop.bind(this);

        if (config.DEBUG_MODE) {
            console.log('SimulatorEngine: Initialized');
        }
    }

    async initialize() {
        console.log("DEBUG: SimulatorEngine.initialize() START"); // ADD THIS

        const config = getCurrentConfig();
        if (config.DEBUG_MODE) console.log('SimulatorEngine: Initializing modules...');

        // Initialize modules (they should use getCurrentConfig internally if needed)
        this.renderer.initialize(this.canvas);
        this.physicsEngine.initialize();
        this.inputManager.initialize();
        this.uiManager.initialize();
        console.log("DEBUG: About to initialize World..."); // ADD THIS
        await this.world.initialize();
        console.log("DEBUG: World initialized."); // ADD THIS
        console.log("DEBUG: About to initialize Drone..."); // ADD THIS
        await this.drone.initialize();
        console.log("DEBUG: Drone initialized."); // ADD THIS

        // Set initial camera
        if (this.drone.FPVCamera) {
            this.renderer.setActiveCamera(this.drone.FPVCamera);
            if (config.DEBUG_MODE) console.log("SimulatorEngine: Initial active camera set to FPV camera.");
        } else if (this.renderer.debugCamera) {
            this.renderer.setActiveCamera(this.renderer.debugCamera);
            console.warn("SimulatorEngine: FPV Camera not found! Using DEBUG camera.");
        } else {
            console.error("SimulatorEngine FATAL: No usable camera found!");
            throw new Error("No camera available."); // Stop initialization
        }

        this.setupDebugControls(); // Keep debug controls

        if (config.DEBUG_MODE) console.log('SimulatorEngine: Initialization complete.');
        // Note: Applying initial settings is now done in main.js *after* initialize() completes
        console.log("DEBUG: SimulatorEngine.initialize() END"); // ADD THIS
    }

    start() {
        const config = getCurrentConfig();
        if (this.isRunning) return;
        this.isRunning = true;
        this.isPaused = false; // Ensure not paused on start
        this.lastTime = performance.now();
        if (config.DEBUG_MODE) console.log('SimulatorEngine: Starting main loop...');
        // Start the loop
        this.animationFrameId = requestAnimationFrame(this._boundLoop);
    }

    stop() {
        // Stops the loop entirely (e.g., for returning to main menu)
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
        // Pauses simulation logic, but the RAF loop might continue for rendering menus
        const config = getCurrentConfig();
        if (!this.isRunning || this.isPaused) return;
        this.isPaused = true;
        if (config.DEBUG_MODE) console.log('SimulatorEngine: Paused simulation logic.');
        // We don't stop the RAF loop here, as the pause menu needs rendering
    }

    resume() {
        const config = getCurrentConfig();
        if (!this.isRunning || !this.isPaused) return;
        this.isPaused = false;
        this.lastTime = performance.now(); // Reset time to avoid large deltaTime jump
        if (config.DEBUG_MODE) console.log('SimulatorEngine: Resumed simulation logic.');
        // Re-request pointer lock (best done via user interaction, e.g. canvas click)
    }

    restartFlight() {
        const config = getCurrentConfig();
        if (this.drone) {
            if (config.DEBUG_MODE) console.log("SimulatorEngine: Restarting flight...");
            // Use the configured start position for reset
            const startPos = config.DRONE_START_POSITION;
            this.drone.reset(startPos ? new CANNON.Vec3(startPos.x, startPos.y, startPos.z) : undefined);
        }
    }

    loop(currentTime) {
        if (!this.isRunning) return; // Exit if stop() was called

        // Request next frame immediately
        this.animationFrameId = requestAnimationFrame(this._boundLoop);

        // Calculate deltaTime
        const deltaTime = (currentTime - this.lastTime) * 0.001;
        this.lastTime = currentTime;
        // Clamp deltaTime to prevent large jumps, especially after pausing/resuming
        const clampedDeltaTime = clamp(deltaTime, 0, 0.1); // Increase max clamp slightly?

        // --- Main Update Cycle (Runs only if NOT paused) ---
        if (!this.isPaused) {
            // 1. Handle Input (Flight controls)
            // InputManager should ideally check if paused and ignore flight inputs
            this.inputManager.update(this.isPaused); // Pass paused state
            const controls = this.inputManager.getControls();

            // 2. Update Drone Logic (FC)
            this.drone.update(clampedDeltaTime, controls);

            // 3. Step Physics Engine
            this.physicsEngine.update(clampedDeltaTime);

            // 4. Synchronize Visuals
            this.physicsEngine.syncVisuals();

            // 5. Update World
            this.world.update(clampedDeltaTime);

            // 6. Prepare State for UI
            this.simulationState.drone = this.drone.getState();
            this.simulationState.controls = controls;

            // 7. Update UI (OSD)
            this.uiManager.update(this.simulationState); // <<< CORRECTED LINE
        }
        // --- End Main Update Cycle ---


        // 8. Render Scene (Always render, even when paused, for menu visibility)
        // Renderer needs to handle potential active camera changes if menus overlay 3D space later
        this.renderer.render();
    }

    // Add basic applyConfiguration stubs to modules (or ensure they exist)
    // These will be filled in Phase 11

    setupDebugControls() {
        const config = getCurrentConfig();
        // ... (Keep R for reset, C for camera switch - Enter for Arm/Disarm might conflict with menu interactions)
        window.addEventListener('keydown', (event) => {
            if (this.isPaused) return; // Don't process debug keys if paused

            if (event.key.toLowerCase() === 'r') {
                this.restartFlight();
            }
            if (event.key.toLowerCase() === 'c') {
                if (this.renderer.activeCamera === this.drone.FPVCamera) {
                    this.renderer.setActiveCamera(this.renderer.debugCamera);
                } else {
                    this.renderer.setActiveCamera(this.drone.FPVCamera);
                }
            }
            // Maybe change arm/disarm key? Or handle via InputManager gamepad logic primarily
            if (event.key === 'Enter') { // Example: Keep Enter for now
                this.toggleArmDisarm();
            }
        });
        if (config.DEBUG_MODE) console.log("Debug Controls Initialized: R=Reset, C=Switch Camera, Enter=Arm/Disarm (when not paused).");
    }

    toggleArmDisarm() { // Keep helper
        // Get config for debug logging
        const config = getCurrentConfig();

        // Log entry point and current state
        if (config.DEBUG_MODE) {
            console.log("toggleArmDisarm called. Drone exists:", !!this.drone, "Current armed state:", this.drone?.armed);
        }

        // Check if the drone object exists
        if (this.drone) {
            // Check the current armed state
            if (this.drone.armed) {
                // If armed, disarm it
                if (config.DEBUG_MODE) console.log("Debug: Disarming Drone...");
                this.drone.disarm(); // Call the drone's disarm method
            } else {
                // If disarmed, arm it
                if (config.DEBUG_MODE) console.log("Debug: Arming Drone...");
                this.drone.arm(); // Call the drone's arm method
            }
        } else {
            // Log a warning if the drone object hasn't been initialized yet
            console.warn("Debug: Cannot arm/disarm, drone not initialized.");
        }
    }

    // --- NEW: Cleanup Method ---
    dispose() {
        const config = getCurrentConfig();
        this.stop(); // Ensure loop is stopped
        this.inputManager?.dispose();
        this.renderer?.dispose();
        // Add cleanup for physics, world, drone if necessary (remove bodies, geometries etc)
        if (this.physicsEngine && this.physicsEngine.world) {
            // Remove all bodies added through the map
            this.physicsEngine.bodyMap.forEach((entry, body) => {
                this.physicsEngine.world.removeBody(body);
            });
            this.physicsEngine.bodyMap.clear();
        }
        if (this.renderer && this.renderer.scene) {
            // Basic scene cleanup (more thorough might be needed)
            while(this.renderer.scene.children.length > 0){
                this.renderer.scene.remove(this.renderer.scene.children[0]);
            }
        }


        // Remove global listeners added by this class (debug controls)
        // Note: This requires storing the listener function reference if added anonymously

        if (config.DEBUG_MODE) console.log('SimulatorEngine: Disposed resources.');
    }
}

export default SimulatorEngine;