// src/simulation/Drone.js
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import AssetLoader from '../utils/AssetLoader.js'; // Updated path
import {getCurrentConfig} from "../config/ConfigManager.js"; // Updated path
import FlightController from './FlightController.js'; // Updated path
import EventBus, {EVENTS} from "../utils/EventBus.js"; // Updated path

// Reuse Vec3 instances for torque calculations to reduce garbage collection
const euler = new THREE.Euler(); // Create once, reuse

class Drone {
    constructor(engine) {
        const config = getCurrentConfig(); // Get config early if needed
        this.engine = engine; // Reference to SimulatorEngine
        this.visual = null;
        this.physicsBody = null;
        this.fpvCamera = null;
        this.propellers = [];
        this.flightController = null; // <<<< ADD reference

        if (config.DEBUG_MODE) {
            console.log('Drone: Initialized');
        }
    }


    // Replace procedural model with GLTF loading
    async createVisualModel() {
        const config = getCurrentConfig(); // Get config early if needed

        const gltf = AssetLoader.getModel('drone'); // Get preloaded GLTF data
        if (!gltf) {
            console.error("Drone ERROR: Failed to get preloaded 'drone' GLTF model.");
            // Create a fallback placeholder if loading failed
            const fallbackGeo = new THREE.BoxGeometry(0.3, 0.1, 0.3); // Simplified dims
            const fallbackMat = new THREE.MeshStandardMaterial({ color: 0xff00ff }); // Bright pink error indicator
            const fallbackMesh = new THREE.Mesh(fallbackGeo, fallbackMat);
            fallbackMesh.castShadow = true; // Still cast shadow
            return fallbackMesh; // Return simple mesh instead of group
        }

        const modelScene = gltf.scene.clone(); // Use clone to avoid modifying the cached asset

        // --- Configure Shadows for Loaded Model ---
        modelScene.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true; // Optional, depends if parts of drone shadow other parts

                // Optional: Ensure materials are suitable for lighting/shadows
                child.material.metalness = Math.min(child.material.metalness || 0, 0.8); // Tone down excessive metalness if needed
                child.material.roughness = Math.max(child.material.roughness || 0, 0.2); // Ensure some roughness
            }
        });

        // Optional: Scale the model if it's not the right size (adjust if needed)
        // const desiredSize = 0.4; // Target overall size approx
        // const boundingBox = new THREE.Box3().setFromObject(modelScene);
        // const currentSize = boundingBox.getSize(new THREE.Vector3());
        // const maxDim = Math.max(currentSize.x, currentSize.y, currentSize.z);
        // const scale = desiredSize / maxDim;
        // modelScene.scale.set(scale, scale, scale);
        // if (config.DEBUG_MODE) console.log("Drone Model Scaled by:", scale);

        if (config.DEBUG_MODE) console.log("Drone: Loaded GLTF model scene configured for shadows.");

        // We return the scene object from the GLTF file
        return modelScene;
    }



    createPhysicsBody(initialPosition) {
        const config = getCurrentConfig(); // Get current config for physics settings
        if (!this.engine.physicsEngine.getMaterial) {
            console.error("Drone: CANNON or Physics materials not available.");
            return null;
        }
        // Use dimensions from config or sensible defaults
        const droneWidth = 0.3;
        const droneHeight = 0.08;
        const droneDepth = 0.3;
        const bodyHalfExtents = new CANNON.Vec3(droneWidth / 2, droneHeight / 2, droneDepth / 2);
        const bodyShape = new CANNON.Box(bodyHalfExtents);

        const body = new CANNON.Body({
            mass: config.DRONE_MASS, // <<< Use user-configurable mass
            position: new CANNON.Vec3(initialPosition.x, initialPosition.y, initialPosition.z),
            shape: bodyShape,
            material: this.engine.physicsEngine.getMaterial('default'),
            linearDamping: config.DRONE_PHYSICS_SETTINGS.linearDamping, // <<< Use user-configurable damping
            angularDamping: config.DRONE_PHYSICS_SETTINGS.angularDamping, // <<< Use user-configurable damping
        });

        // Optional: Provide a more realistic inertia tensor if needed, otherwise CANNON estimates it
        // body.inertia.set(ixx, 0, 0, 0, iyy, 0, 0, 0, izz); // requires calculation or estimation
        body.updateMassProperties(); // Calculate inertia based on shape if not manually set

        if (config.DEBUG_MODE) {
            console.log(`Drone Physics: Mass=${body.mass.toFixed(3)}`);
            console.log(`Drone Physics: Inertia=`, body.inertia); // CANNON calculates this
            console.log(`Drone Physics: LinearDamping=${body.linearDamping}, AngularDamping=${body.angularDamping}`); // Log damping
        }
        return body;
    }

    // src/simulation/Drone.js
    async initialize(initialPosition = undefined) {
        const config = getCurrentConfig();
        console.log("DEBUG: Drone.initialize() START"); // ADD
        const startPos = initialPosition || config.DRONE_START_POSITION;

        try {
            this.visual = await this.createVisualModel();
            this.visual.position.set(startPos.x, startPos.y, startPos.z);
            this.engine.renderer.addObject(this.visual);
            this.physicsBody = this.createPhysicsBody(startPos);

            if (this.physicsBody) {
                this.engine.physicsEngine.addBody(this.physicsBody, this.visual); // Link visual for sync
                this.flightController = new FlightController(this.physicsBody);
                this.physicsBody.addEventListener('collide', this.handleCollision.bind(this));
            } else {
                console.error("Drone ERROR: Failed to create physics body."); // Keep this
            }

            // --- FPV Camera Setup ---
            this.fpvCamera = new THREE.PerspectiveCamera(
                config.FPV_CAMERA_FOV,
                window.innerWidth / window.innerHeight,
                0.1, 1000
            );
            // Position relative to the drone visual center
            this.fpvCamera.position.set(0, 0.05, 0.1); // Slightly above and forward

            // *** Initial camera angle set via applyConfiguration ***
            // this.fpvCamera.rotation.set(0, 0, 0); // Base rotation set by applyConfiguration now

            this.fpvCamera.name = "FPVCamera";
            this.visual.add(this.fpvCamera); // Add camera as child of drone visual

            this.findPropsInModel();

            // Apply initial configuration (including camera angle) immediately after creation
            this.applyConfiguration(config); // <<< Call here to set initial angle

            if (config.DEBUG_MODE && this.physicsBody) {
                console.log(`Drone: Async Initialization complete. Initial FPV FOV: ${config.FPV_CAMERA_FOV}, Angle: ${config.FPV_CAMERA_ANGLE_DEG} deg`);
            } else if(config.DEBUG_MODE){
                console.log('Drone: Async Initialization FAILED or incomplete (No physics body?).');
            }

        } catch (error) {
            console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"); // Make error stand out
            console.error("ERROR inside Drone.initialize():", error);
            console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"); // Make error stand out
            throw error; // Re-throw the error so it's caught higher up
        }
    }

    handleCollision(event) {
        const config = getCurrentConfig();
        const contact = event.contact;

        // Calculate relative velocity at the contact point (approximation)
        const v1 = contact.bi.velocity; // Drone body velocity
        const v2 = contact.bj.velocity; // Other body velocity (often 0 for static)
        const relativeVelocity = v1.vsub(v2); // v1 - v2
        const impactSpeed = relativeVelocity.length();

        // Determine collision intensity (adjust threshold as needed)
        const intensityThreshold = 1.5; // Minimum impact speed to trigger shake
        const maxIntensitySpeed = 15.0; // Speed at which shake is maximum
        let shakeIntensity = 0;

        if (impactSpeed > intensityThreshold) {
            shakeIntensity = Math.min(1.0, (impactSpeed - intensityThreshold) / (maxIntensitySpeed - intensityThreshold));
            if (config.DEBUG_MODE) {
                // console.log(`Drone Collision Detected! Impact Speed: ${impactSpeed.toFixed(2)}, Shake Intensity: ${shakeIntensity.toFixed(2)}`);
            }
            // Trigger camera shake via the event bus
            EventBus.emit(EVENTS.DRONE_COLLISION, { intensity: shakeIntensity });
        }
    }

    // Optional helper to find propeller meshes by name in the loaded model
    findPropsInModel() {
        const config = getCurrentConfig(); // Get config early if needed

        this.propellers = [];
        if (this.visual) {
            // Example: Find objects named "Propeller_FL", "Propeller_FR", etc.
            // Adjust these names based on your actual GLTF model structure!
            const propNames = ['Propeller_FR', 'Propeller_FL', 'Propeller_BR', 'Propeller_BL']; // Adjust names!
            this.visual.traverse((child) => {
                if (child.isMesh && propNames.includes(child.name)) {
                    this.propellers.push(child);
                    if (config.DEBUG_MODE) console.log(`Drone: Found propeller mesh: ${child.name}`);
                }
            });
        }
        if (this.propellers.length !== 4 && config.DEBUG_MODE) {
            console.warn(`Drone: Expected 4 propellers, found ${this.propellers.length}. Check model names.`);
        }
    }

    update(deltaTime, controls) {
        if (!this.physicsBody || !this.flightController) return; // Check FC too

        // Delegate control logic to the FlightController
        this.flightController.update(deltaTime, controls);

        // Propeller Animation - Base it on FC's armed state and controls thrust
        const isArmed = this.flightController.armed; // Get armed state from FC
        if (isArmed && this.physicsBody.mass > 0 && this.propellers.length > 0) {
            // Spin speed based roughly on thrust input + idle speed
            const spinSpeed = controls.thrust * 80 + (isArmed ? 15 : 0); // Adjust multipliers
            this.propellers.forEach(prop => {
                prop.rotation.y += spinSpeed * deltaTime; // Rotate around local Y axis
            });
        } else if (!isArmed && this.propellers.length > 0) {
            // Optional: Slow down propellers visually when disarmed
            this.propellers.forEach(prop => {
                prop.rotation.y *= 0.95; // Apply damping to rotation
            });
        }
    }

    applyConfiguration(config) {
        if (!config) return;
        const C = config;
        let configChanged = false;

        // Apply Physics settings
        if (this.physicsBody) {
            let physicsChanged = false;
            if (this.physicsBody.mass !== C.DRONE_MASS) {
                this.physicsBody.mass = C.DRONE_MASS;
                physicsChanged = true;
            }
            if (this.physicsBody.linearDamping !== C.DRONE_PHYSICS_SETTINGS.linearDamping) {
                this.physicsBody.linearDamping = C.DRONE_PHYSICS_SETTINGS.linearDamping;
                physicsChanged = true;
            }
            if (this.physicsBody.angularDamping !== C.DRONE_PHYSICS_SETTINGS.angularDamping) {
                this.physicsBody.angularDamping = C.DRONE_PHYSICS_SETTINGS.angularDamping;
                physicsChanged = true;
            }
            if (physicsChanged) {
                this.physicsBody.updateMassProperties(); // Recalculate inertia if mass/shape potentially changes
                if(C.DEBUG_MODE) console.log("Drone: Applied physics config changes (Mass/Damping). Recalculated mass props.");
                configChanged = true;
            }
        }

        // Apply Camera settings
        if (this.fpvCamera) {
            let cameraChanged = false;
            if (this.fpvCamera.fov !== C.FPV_CAMERA_FOV) {
                this.fpvCamera.fov = C.FPV_CAMERA_FOV;
                this.fpvCamera.updateProjectionMatrix(); // IMPORTANT! Apply FOV change
                cameraChanged = true;
                if(C.DEBUG_MODE) console.log("Drone: Applied FPV Camera FOV change.");
            }

            // <<< NEW: Apply FPV Camera Angle >>>
            const targetAngleRad = THREE.MathUtils.degToRad(C.FPV_CAMERA_ANGLE_DEG);
            if (this.fpvCamera.rotation.x !== targetAngleRad) {
                // Set the LOCAL X-axis rotation of the camera relative to the drone body
                this.fpvCamera.rotation.set(targetAngleRad, 0, 0, 'YXZ'); // Use Euler order if needed
                cameraChanged = true;
                if(C.DEBUG_MODE) console.log(`Drone: Applied FPV Camera Angle: ${C.FPV_CAMERA_ANGLE_DEG} deg`);
            }
            // <<< END NEW >>>

            if (cameraChanged) configChanged = true;
        }

        // Apply Flight Controller settings
        if (this.flightController) {
            this.flightController.applyConfiguration(config); // Pass the whole config
            if (C.DEBUG_MODE) console.log("Drone: Applied config to FlightController.");
            configChanged = true; // Assume FC config might change
        } else if (C.DEBUG_MODE) {
            console.warn("Drone.applyConfiguration: FlightController not initialized yet.");
        }

        // Log if any configuration actually changed
        if (configChanged && C.DEBUG_MODE) {
            // console.log("Drone: Configuration successfully applied.");
        }
    }


    arm() {
        if (this.flightController) {
            this.flightController.setArmed(true);
        } else if (getCurrentConfig().DEBUG_MODE) {
            console.warn("Drone: Cannot arm, FlightController not initialized.");
        }
        // Don't log here, FC logs internally
    }

    disarm() {
        if (this.flightController) {
            this.flightController.setArmed(false);
        } else if (getCurrentConfig().DEBUG_MODE) {
            console.warn("Drone: Cannot disarm, FlightController not initialized.");
        }
        // Don't log here, FC logs internally
    }

    get FPVCamera() {
        return this.fpvCamera;
    }

    // Get relevant state for UI Manager
    getState() {
        if (!this.physicsBody) return null;

        const config = getCurrentConfig();
        const speed = this.physicsBody.velocity.length();

        // Calculate Euler angles from quaternion (ensure correct order 'YXZ' common for FPS/Vehicles)
        euler.setFromQuaternion(this.physicsBody.quaternion, 'YXZ'); // Store in reused euler object
        const pitchDeg = THREE.MathUtils.radToDeg(euler.x); // Pitch around X
        const yawDeg = THREE.MathUtils.radToDeg(euler.y);   // Yaw around Y
        const rollDeg = THREE.MathUtils.radToDeg(euler.z);  // Roll around Z

        return {
            position: this.physicsBody.position.clone(),
            velocity: this.physicsBody.velocity.clone(),
            quaternion: this.physicsBody.quaternion.clone(),
            armed: this.flightController ? this.flightController.armed : false, // <<<< Get from FC
            speed: speed,
            altitude: this.physicsBody.position.y,
            euler: { // Return degrees, common for display
                roll: rollDeg,
                pitch: pitchDeg,
                yaw: yawDeg,
            }
        };
    }

    reset(position = undefined) {
        if (!this.physicsBody || !this.visual) return;

        const config = getCurrentConfig();
        const resetPos = position || config.DRONE_START_POSITION;

        this.disarm(); // Ensure drone is disarmed on reset

        // Reset Physics State using the provided or config position
        this.physicsBody.position.set(resetPos.x, resetPos.y, resetPos.z);
        this.physicsBody.velocity.set(0, 0, 0);
        this.physicsBody.angularVelocity.set(0, 0, 0);
        this.physicsBody.quaternion.setFromEuler(0, 0, 0); // Reset orientation
        this.physicsBody.force.set(0, 0, 0);
        this.physicsBody.torque.set(0, 0, 0);
        this.physicsBody.sleepState = 0; // Explicitly wake up the body
        this.physicsBody.wakeUp(); // Ensure body is awake after reset

        // Reset Visual State Immediately to match physics
        this.visual.position.copy(this.physicsBody.position);
        this.visual.quaternion.copy(this.physicsBody.quaternion);

        // Reset Flight Controller internal state (like PID integrals)
        this.flightController?.reset(); // Call FC's reset method if it exists

        if (config.DEBUG_MODE) console.log(`Drone Reset to position: (${resetPos.x.toFixed(2)}, ${resetPos.y.toFixed(2)}, ${resetPos.z.toFixed(2)})`);
    }
}

export default Drone;