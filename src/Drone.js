// src/Drone.js
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import AssetLoader from './AssetLoader.js';
import {getCurrentConfig} from "./ConfigManager.js"; // Import loader instance

// Reuse Vec3 instances for torque calculations to reduce garbage collection
const localTorque = new CANNON.Vec3();
const worldTorque = new CANNON.Vec3();
const thrustForceVec = new CANNON.Vec3();
const euler = new THREE.Euler(); // Create once, reuse

class Drone {
    constructor(engine) {
        const config = getCurrentConfig(); // Get config early if needed
        this.engine = engine;
        this.visual = null;
        this.physicsBody = null;
        this.fpvCamera = null;
        this.propellers = [];
        this.armed = false;
        this.flightMode = 'RATE'; // Default

        // Use dimensions from loaded config if they become configurable, else keep original Config
        // this.dimensions = config.DRONE_DIMENSIONS;

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

        try { // ADD try...catch block locally
            console.log("DEBUG: Drone - Creating visual model..."); // ADD
            this.visual = await this.createVisualModel();
            console.log("DEBUG: Drone - Visual model created:", this.visual); // ADD
            this.visual.position.set(startPos.x, startPos.y, startPos.z);
            console.log("DEBUG: Drone - Adding visual to renderer..."); // ADD
            this.engine.renderer.addObject(this.visual);
            console.log("DEBUG: Drone - Visual added."); // ADD

            console.log("DEBUG: Drone - Creating physics body at", startPos); // ADD
            this.physicsBody = this.createPhysicsBody(startPos);
            console.log("DEBUG: Drone - Physics body created:", this.physicsBody); // ADD

            if (this.physicsBody) {
                console.log("DEBUG: Drone - Adding physics body to engine..."); // ADD
                this.engine.physicsEngine.addBody(this.physicsBody, this.visual);
                console.log("DEBUG: Drone - Physics body added."); // ADD
            } else {
                console.error("Drone ERROR: Failed to create physics body."); // Keep this
            }

            console.log("DEBUG: Drone - Creating FPV camera..."); // ADD
            this.fpvCamera = new THREE.PerspectiveCamera(
                config.FPV_CAMERA_FOV,
                window.innerWidth / window.innerHeight,
                0.1, 1000
            );
            this.fpvCamera.position.set(0, 0.05, 0.1);
            this.fpvCamera.rotation.set(0, 0, 0);
            this.fpvCamera.name = "FPVCamera";
            console.log("DEBUG: Drone - Attaching FPV camera..."); // ADD
            this.visual.add(this.fpvCamera);
            console.log("DEBUG: Drone - FPV camera attached."); // ADD

            console.log("DEBUG: Drone - Finding props..."); // ADD
            this.findPropsInModel();
            console.log("DEBUG: Drone - Props found."); // ADD

            if (config.DEBUG_MODE && this.physicsBody) {
                console.log(`Drone: Async Initialization complete at specified position. FPV FOV: ${config.FPV_CAMERA_FOV}`);
            } else if(config.DEBUG_MODE){
                console.log('Drone: Async Initialization FAILED or incomplete (No physics body?).');
            }
            console.log("DEBUG: Drone.initialize() END (Successful)"); // ADD

        } catch (error) {
            console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"); // Make error stand out
            console.error("ERROR inside Drone.initialize():", error);
            console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"); // Make error stand out
            throw error; // Re-throw the error so main.js still catches it
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

    // --- Update method potentially animates found props ---
    update(deltaTime, controls) {
        if (!this.physicsBody) return;

        this.applyControls(deltaTime, controls);

        // Propeller Animation - Use found props if available
        if (this.armed && this.physicsBody.mass > 0 && this.propellers.length > 0) {
            const spinSpeed = controls.thrust * 80 + (this.armed ? 15 : 0); // Faster spin maybe
            this.propellers.forEach(prop => {
                prop.rotation.y += spinSpeed * deltaTime; // Assuming props spin around local Y
            });
        } else if (!this.armed && this.propellers.length > 0) {
            this.propellers.forEach(prop => {
                prop.rotation.y *= 0.90; // Slow down faster
            });
        }
    }

    applyControls(deltaTime, controls) {
        if (!this.physicsBody) {
            console.warn("applyControls skipped: physicsBody is missing.");
            return;
        }
        const Config = getCurrentConfig(); // Get latest config for multipliers

        // --- Disarmed State ---
        if (!this.armed) {
            // Optional: Apply stronger damping or simply let existing damping handle it
            // this.physicsBody.angularVelocity.scale(0.95, this.physicsBody.angularVelocity);
            return; // No control inputs applied when disarmed
        }

        // --- Thrust Application (Local Y-axis) ---
        const maxThrust = Config.DRONE_CONTROL_MULTIPLIERS.MAX_THRUST;
        const currentThrustForce = controls.thrust * maxThrust;
        // Apply force upwards along the drone's local Y axis
        thrustForceVec.set(0, currentThrustForce, 0);
        // Apply force at the center of mass (CANNON.Vec3.ZERO)
        this.physicsBody.applyLocalForce(thrustForceVec, CANNON.Vec3.ZERO);

        // --- Torque Calculation (Local Space) ---
        // Map controls (-1 to 1) to torque values
        // IMPORTANT AXIS MAPPING:
        // - Pitch Control (W/S keys -> controls.pitch): Affects rotation around the drone's LOCAL X-axis. Positive pitch input (W key) should make the nose go DOWN (negative X torque).
        // - Roll Control (A/D keys -> controls.roll): Affects rotation around the drone's LOCAL Z-axis. Positive roll input (D key) should make the right side go DOWN (negative Z torque).
        // - Yaw Control (Q/E keys -> controls.yaw): Affects rotation around the drone's LOCAL Y-axis. Positive yaw input (E key) should make the nose turn RIGHT (negative Y torque).
        const pitchTorque = -controls.pitch * Config.DRONE_CONTROL_MULTIPLIERS.PITCH_TORQUE;
        const rollTorque = -controls.roll * Config.DRONE_CONTROL_MULTIPLIERS.ROLL_TORQUE;
        const yawTorque = -controls.yaw * Config.DRONE_CONTROL_MULTIPLIERS.YAW_TORQUE;

        // Set the calculated torques in the drone's LOCAL coordinate system
        localTorque.set(pitchTorque, yawTorque, rollTorque); // (X, Y, Z torque)

        // --- Convert Local Torque to World Torque ---
        // Cannon-es requires torques to be applied in world space.
        this.physicsBody.vectorToWorldFrame(localTorque, worldTorque); // Converts localTorque -> worldTorque using body's current orientation

        // --- Apply the World-Space Torque ---
        this.physicsBody.applyTorque(worldTorque);
    }

    // --- NEW: Apply Configuration ---
    applyConfiguration(config) {
        if (!config) return;
        const C = config; // Alias for brevity

        if (this.physicsBody) {
            this.physicsBody.mass = C.DRONE_MASS;
            this.physicsBody.linearDamping = C.DRONE_PHYSICS_SETTINGS.linearDamping;
            this.physicsBody.angularDamping = C.DRONE_PHYSICS_SETTINGS.angularDamping;
            this.physicsBody.updateMassProperties(); // Recalculate inertia if mass changes
            if(C.DEBUG_MODE) console.log("Drone: Applied physics config changes.");
        }
        if (this.fpvCamera) {
            this.fpvCamera.fov = C.FPV_CAMERA_FOV;
            this.fpvCamera.updateProjectionMatrix(); // IMPORTANT! Apply FOV change
            if(C.DEBUG_MODE) console.log("Drone: Applied FPV Camera FOV change.");
        }
        // Apply other drone-specific settings here later (e.g., PID gains)
    }

    arm() {
        const Config = getCurrentConfig(); // Get config early if needed

        this.armed = true;
        if (Config.DEBUG_MODE) console.log("Drone Armed");
        // Optional: Reset angular velocity slightly on arm to prevent sudden spins if disarmed while rotating
        // this.physicsBody?.angularVelocity.scale(0.5, this.physicsBody.angularVelocity);
    }

    disarm() {
        const Config = getCurrentConfig(); // Get config early if needed

        this.armed = false;
        if (Config.DEBUG_MODE) console.log("Drone Disarmed");
    }

    get FPVCamera() {
        return this.fpvCamera;
    }

    // Get relevant state for UI Manager - ENHANCED for Phase 5
    getState() {
        if (!this.physicsBody) return null;

        // Calculate Speed
        const speed = this.physicsBody.velocity.length();

        // Calculate Attitude (Roll, Pitch, Yaw) from Quaternion
        // Use 'YXZ' order: Apply Yaw first globally, then Pitch locally, then Roll locally. Common for aircraft/drones.
        euler.setFromQuaternion(this.physicsBody.quaternion, 'YXZ');
        // Convert radians to degrees for display
        const rollDeg = euler.z * 180 / Math.PI; // Roll is around local Z in YXZ order convention
        const pitchDeg = euler.y * 180 / Math.PI;// Pitch is around local Y in YXZ order convention
        const yawDeg = euler.x * 180 / Math.PI;  // Yaw is around local X in YXZ order convention
        // NOTE: The axis mapping (euler.x/y/z to Roll/Pitch/Yaw) depends heavily on the chosen Euler order ('YXZ')
        // and how Three.js defines those rotations. Double-check this visually if the OSD seems wrong.
        // Let's redefine based on common understanding for 'YXZ' (often ZXY in THREE Euler based on axis):
        // Re-checking THREE docs for YXZ order: x is Pitch, y is Yaw, z is Roll.
        const pitchDeg_Corrected = euler.x * 180 / Math.PI;
        const yawDeg_Corrected = euler.y * 180 / Math.PI;
        const rollDeg_Corrected = euler.z * 180 / Math.PI;


        return {
            position: this.physicsBody.position.clone(), // Clone to prevent accidental modification
            velocity: this.physicsBody.velocity.clone(),
            quaternion: this.physicsBody.quaternion.clone(),
            armed: this.armed,
            // --- New Data for OSD ---
            speed: speed,
            altitude: this.physicsBody.position.y, // Directly use Y position
            euler: { // Euler angles in degrees
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

        if (Config.DEBUG_MODE) console.log(`Drone Reset to position: (${resetPos.x}, ${resetPos.y}, ${resetPos.z})`);
    }
}

export default Drone;