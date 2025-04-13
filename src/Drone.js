// src/Drone.js
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import AssetLoader from './AssetLoader.js';
import {getCurrentConfig} from "./ConfigManager.js"; // Import loader instance
import FlightController from './FlightController.js';
import EventBus, {EVENTS} from "./EventBus.js";     // << NEW

// Reuse Vec3 instances for torque calculations to reduce garbage collection
const euler = new THREE.Euler(); // Create once, reuse

class Drone {
    constructor(engine) {
        const config = getCurrentConfig(); // Get config early if needed
        this.engine = engine;
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
        const Config = getCurrentConfig(); // Get config early if needed

        const gltf = AssetLoader.getModel('drone'); // Get preloaded GLTF data
        if (!gltf) {
            console.error("Drone ERROR: Failed to get preloaded 'drone' GLTF model.");
            // Create a fallback placeholder if loading failed?
            const fallbackGeo = new THREE.BoxGeometry(this.dimensions.bodyWidth, this.dimensions.bodyHeight, this.dimensions.bodyDepth);
            const fallbackMat = new THREE.MeshStandardMaterial({ color: 0xff00ff }); // Bright pink error indicator
            const fallbackMesh = new THREE.Mesh(fallbackGeo, fallbackMat);
            fallbackMesh.castShadow = true; // Still cast shadow
            return fallbackMesh; // Return simple mesh instead of group
        }

        const modelScene = gltf.scene; // Get the main scene group from the GLTF

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

        // Optional: Scale the model if it's not the right size
        // const desiredRadius = Math.max(this.dimensions.bodyWidth, this.dimensions.bodyDepth) / 2 + this.dimensions.armLength;
        // const boundingBox = new THREE.Box3().setFromObject(modelScene);
        // const currentSize = boundingBox.getSize(new THREE.Vector3());
        // const maxDim = Math.max(currentSize.x, currentSize.y, currentSize.z);
        // const scale = (desiredRadius * 2) / maxDim; // Approximate scale based on radius
        // modelScene.scale.set(scale, scale, scale);
        // console.log("Drone Model Scaled by:", scale);


        if (Config.DEBUG_MODE) console.log("Drone: Loaded GLTF model scene configured for shadows.");

        // We return the scene object from the GLTF file
        return modelScene;
    }



    createPhysicsBody(initialPosition) {
        const Config = getCurrentConfig(); // Get current config for physics settings
        if (!this.engine.physicsEngine.getMaterial) {
            console.error("Drone: CANNON or Physics materials not available.");
            return null;
        }
        // Use dimensions from original Config for now unless made configurable
        const DRONE_DIMENSIONS = { bodyWidth: 0.15, bodyHeight: 0.08, bodyDepth: 0.15, armLength: 0.18, armWidth: 0.02, propDiameter: 0.1 }; // Hardcode default dims for now
        const d = DRONE_DIMENSIONS;
        const bodyHalfExtents = new CANNON.Vec3(d.bodyWidth / 2, d.bodyHeight / 2, d.bodyDepth / 2);
        const bodyShape = new CANNON.Box(bodyHalfExtents);

        const body = new CANNON.Body({
            mass: Config.DRONE_MASS, // <<< Use user-configurable mass
            position: new CANNON.Vec3(initialPosition.x, initialPosition.y, initialPosition.z),
            shape: bodyShape,
            material: this.engine.physicsEngine.getMaterial('default'),
            linearDamping: Config.DRONE_PHYSICS_SETTINGS.linearDamping, // <<< Use user-configurable damping
            angularDamping: Config.DRONE_PHYSICS_SETTINGS.angularDamping, // <<< Use user-configurable damping
        });

        body.updateMassProperties(); // Calculate inertia

        if (Config.DEBUG_MODE) {
            console.log(`Drone Physics: Mass=${body.mass.toFixed(3)}`);
            console.log(`Drone Physics: Inertia=`, body.inertia);
            console.log(`Drone Physics: LinearDamping=${body.linearDamping}, AngularDamping=${body.angularDamping}`); // Log damping
        }
        return body;
    }

    // src/Drone.js
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
                this.engine.physicsEngine.addBody(this.physicsBody, this.visual);
                this.flightController = new FlightController(this.physicsBody);
                this.physicsBody.addEventListener('collide', this.handleCollision.bind(this));
            } else {
                console.error("Drone ERROR: Failed to create physics body."); // Keep this
            }

            this.fpvCamera = new THREE.PerspectiveCamera(
                config.FPV_CAMERA_FOV,
                window.innerWidth / window.innerHeight,
                0.1, 1000
            );
            this.fpvCamera.position.set(0, 0.05, 0.1);
            this.fpvCamera.rotation.set(0, 0, 0);
            this.fpvCamera.name = "FPVCamera";
            this.visual.add(this.fpvCamera);

            this.findPropsInModel();

            if (config.DEBUG_MODE && this.physicsBody) {
                console.log(`Drone: Async Initialization complete at specified position. FPV FOV: ${config.FPV_CAMERA_FOV}`);
            } else if(config.DEBUG_MODE){
                console.log('Drone: Async Initialization FAILED or incomplete (No physics body?).');
            }

        } catch (error) {
            console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"); // Make error stand out
            console.error("ERROR inside Drone.initialize():", error);
            console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"); // Make error stand out
            throw error; // Re-throw the error so main.js still catches it
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
            // Trigger camera shake via the engine/renderer
            EventBus.emit(EVENTS.DRONE_COLLISION, { intensity: shakeIntensity });
        }
    }

    // Optional helper to find propeller meshes by name in the loaded model
    findPropsInModel() {
        const Config = getCurrentConfig(); // Get config early if needed

        this.propellers = [];
        if (this.visual) {
            // Example: Find objects named "Propeller_FL", "Propeller_FR", etc.
            const propNames = ['Propeller_FR', 'Propeller_FL', 'Propeller_BR', 'Propeller_BL']; // Adjust names!
            this.visual.traverse((child) => {
                if (child.isMesh && propNames.includes(child.name)) {
                    this.propellers.push(child);
                    if (Config.DEBUG_MODE) console.log(`Drone: Found propeller mesh: ${child.name}`);
                }
            });
        }
        if (this.propellers.length !== 4 && Config.DEBUG_MODE) {
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
            const spinSpeed = controls.thrust * 80 + (isArmed ? 15 : 0);
            this.propellers.forEach(prop => {
                prop.rotation.y += spinSpeed * deltaTime;
            });
        } else if (!isArmed && this.propellers.length > 0) {
            this.propellers.forEach(prop => {
                prop.rotation.y *= 0.90;
            });
        }
    }

    applyConfiguration(config) {
        if (!config) return;
        const C = config;

        let configChanged = false; // Track if anything changed for logging

        if (this.physicsBody) {
            if (this.physicsBody.mass !== C.DRONE_MASS) {
                this.physicsBody.mass = C.DRONE_MASS;
                configChanged = true;
            }
            if (this.physicsBody.linearDamping !== C.DRONE_PHYSICS_SETTINGS.linearDamping) {
                this.physicsBody.linearDamping = C.DRONE_PHYSICS_SETTINGS.linearDamping;
                configChanged = true;
            }
            if (this.physicsBody.angularDamping !== C.DRONE_PHYSICS_SETTINGS.angularDamping) {
                this.physicsBody.angularDamping = C.DRONE_PHYSICS_SETTINGS.angularDamping;
                configChanged = true;
            }
            if (configChanged) {
                this.physicsBody.updateMassProperties(); // Recalculate inertia if mass/shape potentially changes
                if(C.DEBUG_MODE) console.log("Drone: Applied physics config changes (Mass/Damping). Recalculated mass props.");
            }
        }

        let cameraChanged = false;
        if (this.fpvCamera) {
            if (this.fpvCamera.fov !== C.FPV_CAMERA_FOV) {
                this.fpvCamera.fov = C.FPV_CAMERA_FOV;
                this.fpvCamera.updateProjectionMatrix(); // IMPORTANT! Apply FOV change
                cameraChanged = true;
                if(C.DEBUG_MODE) console.log("Drone: Applied FPV Camera FOV change.");
            }
        }

        if (this.flightController) {
            this.flightController.applyConfiguration(config); // Pass the whole config
            if (C.DEBUG_MODE) console.log("Drone: Applied config to FlightController.");
        } else if (C.DEBUG_MODE) {
            console.warn("Drone.applyConfiguration: FlightController not initialized yet.");
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

        const speed = this.physicsBody.velocity.length();
        euler.setFromQuaternion(this.physicsBody.quaternion, 'YXZ');
        const pitchDeg_Corrected = euler.x * 180 / Math.PI;
        const yawDeg_Corrected = euler.y * 180 / Math.PI;
        const rollDeg_Corrected = euler.z * 180 / Math.PI;

        return {
            position: this.physicsBody.position.clone(),
            velocity: this.physicsBody.velocity.clone(),
            quaternion: this.physicsBody.quaternion.clone(),
            armed: this.flightController ? this.flightController.armed : false, // <<<< Get from FC
            speed: speed,
            altitude: this.physicsBody.position.y,
            euler: {
                roll: rollDeg_Corrected,
                pitch: pitchDeg_Corrected,
                yaw: yawDeg_Corrected,
            }
        };
    }

    reset(position = undefined) {
        if (!this.physicsBody || !this.visual) return;

        const Config = getCurrentConfig();
        const resetPos = position || Config.DRONE_START_POSITION;

        this.disarm();

        // Reset Physics State using the provided or config position
        this.physicsBody.position.set(resetPos.x, resetPos.y, resetPos.z);
        this.physicsBody.velocity.set(0, 0, 0);
        this.physicsBody.angularVelocity.set(0, 0, 0);
        this.physicsBody.quaternion.setFromEuler(0, 0, 0);
        this.physicsBody.force.set(0, 0, 0);
        this.physicsBody.torque.set(0, 0, 0);
        this.physicsBody.wakeUp(); // Ensure body is awake after reset

        // Reset Visual State Immediately
        // Use copy for Vec3 and Quaternion
        this.visual.position.copy(this.physicsBody.position);
        this.visual.quaternion.copy(this.physicsBody.quaternion);

        this.flightController?.reset(); // Call FC's reset method if it exists

        if (Config.DEBUG_MODE) console.log(`Drone Reset to position: (${resetPos.x}, ${resetPos.y}, ${resetPos.z})`);
    }
}

export default Drone;