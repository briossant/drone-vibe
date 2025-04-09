// src/Drone.js
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import Config from './Config.js';

// Reuse Vec3 instances for torque calculations to reduce garbage collection
const localTorque = new CANNON.Vec3();
const worldTorque = new CANNON.Vec3();
const thrustForceVec = new CANNON.Vec3();
const euler = new THREE.Euler(); // Create once, reuse

class Drone {
    constructor(engine) {
        this.engine = engine;
        this.visual = null;         // THREE.Group
        this.physicsBody = null;    // CANNON.Body
        this.fpvCamera = null;      // THREE.PerspectiveCamera
        this.propellers = [];       // Array for propeller meshes later

        this.armed = false;
        this.flightMode = 'RATE'; // Placeholder

        this.dimensions = Config.DRONE_DIMENSIONS; // Use dimensions from Config

        if (Config.DEBUG_MODE) {
            console.log('Drone: Initialized');
        }
    }

    // --- Factory Methods ---
    createVisualModel() {
        // ... (existing visual model creation remains largely the same) ...
        // Ensure it uses this.dimensions from Config if you moved it there.
        const group = new THREE.Group();
        const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.6, metalness: 0.3 });
        const armMaterial = new THREE.MeshStandardMaterial({ color: 0x777777, roughness: 0.7 });
        const propMaterial = new THREE.MeshStandardMaterial({ color: 0x333333, opacity: 0.8, transparent: true });

        const d = this.dimensions;

        // Main Body
        const bodyGeometry = new THREE.BoxGeometry(d.bodyWidth, d.bodyHeight, d.bodyDepth);
        const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
        bodyMesh.castShadow = true;
        group.add(bodyMesh);

        // Arms & Props (ensure relative positioning is correct)
        const armGeometry = new THREE.BoxGeometry(d.armWidth, d.armWidth, d.armLength);
        const armPositions = [ /* ... existing positions ... */
            // Front-Right (assuming +Z is forward, +X is right)
            { angle: -Math.PI / 4 }, // -45 deg
            // Front-Left
            { angle: -3 * Math.PI / 4 }, // -135 deg
            // Back-Left
            { angle: 3 * Math.PI / 4 }, // 135 deg
            // Back-Right
            { angle: Math.PI / 4 }, // 45 deg
        ];

        armPositions.forEach(posData => {
            const armMesh = new THREE.Mesh(armGeometry, armMaterial);
            const angle = posData.angle;
            // Position arms radially from center
            const radius = d.bodyWidth / 2 ; // Start from edge of body approx
            const armEndX = radius * Math.cos(angle) + (d.armLength / 2) * Math.cos(angle);
            const armEndZ = radius * Math.sin(angle) + (d.armLength / 2) * Math.sin(angle);

            armMesh.position.set(armEndX / 2, 0, armEndZ/2); // Position center of arm
            armMesh.rotation.y = angle + Math.PI / 2; // Rotate arm to point outwards


            armMesh.castShadow = true;
            group.add(armMesh); // Add ARM to the main drone group

            // --- Propeller Creation and Placement ---
            const propGeometry = new THREE.CylinderGeometry(d.propDiameter / 2, d.propDiameter / 2, 0.01, 16);
            const propMesh = new THREE.Mesh(propGeometry, propMaterial);

            // Position prop at the end of the arm (relative to arm's origin which is now offset)
            propMesh.position.set(0, d.armWidth / 2 + 0.01, d.armLength / 2); // Place slightly above arm, at its end (local Z)

            propMesh.castShadow = true;
            armMesh.add(propMesh); // Add prop to arm
            this.propellers.push(propMesh);
        });


        // Front Indicator
        const frontIndicatorGeo = new THREE.ConeGeometry(0.02, 0.05, 8);
        const frontIndicatorMat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
        const frontIndicatorMesh = new THREE.Mesh(frontIndicatorGeo, frontIndicatorMat);
        frontIndicatorMesh.position.set(0, d.bodyHeight / 2, d.bodyDepth / 2 + 0.01); // Top-front
        frontIndicatorMesh.rotation.x = Math.PI / 2; // Point forward
        group.add(frontIndicatorMesh);

        return group;
    }

    createPhysicsBody(initialPosition) {
        if (!this.engine.physicsEngine.getMaterial) {
            console.error("Drone: CANNON or Physics materials not available for physics body.");
            return null;
        }

        const d = this.dimensions;
        const bodyHalfExtents = new CANNON.Vec3(d.bodyWidth / 2, d.bodyHeight / 2, d.bodyDepth / 2);
        const bodyShape = new CANNON.Box(bodyHalfExtents);

        const body = new CANNON.Body({
            mass: Config.DRONE_MASS,
            position: new CANNON.Vec3(initialPosition.x, initialPosition.y, initialPosition.z),
            shape: bodyShape,
            material: this.engine.physicsEngine.getMaterial('default'),

            // --- Apply Damping from Config ---
            linearDamping: Config.DRONE_PHYSICS_SETTINGS.linearDamping,
            angularDamping: Config.DRONE_PHYSICS_SETTINGS.angularDamping, // Key for Phase 5 stability
        });

        body.updateMassProperties(); // Calculate inertia

        if (Config.DEBUG_MODE) {
            console.log(`Drone Physics: Mass=${body.mass.toFixed(3)}`);
            console.log(`Drone Physics: Inertia=`, body.inertia);
            console.log(`Drone Physics: LinearDamping=${body.linearDamping}, AngularDamping=${body.angularDamping}`); // Log damping
        }
        return body;
    }


    // --- Main Methods ---
    initialize(initialPosition = { x: 0, y: 1, z: 0 }) {
        this.visual = this.createVisualModel();
        this.visual.position.set(initialPosition.x, initialPosition.y, initialPosition.z);
        this.engine.renderer.addObject(this.visual);

        console.log("Drone Initializing: Creating physics body...");
        this.physicsBody = this.createPhysicsBody(initialPosition);

        if (this.physicsBody) {
            console.log("Drone Initializing: Physics body created successfully, adding to engine.");
            this.engine.physicsEngine.addBody(this.physicsBody, this.visual); // Link physics to visual
        } else {
            console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
            console.error("Drone ERROR: Failed to create physics body.");
            console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
            // Maybe throw an error or handle this more gracefully
        }

        // --- Create and Attach FPV Camera ---
        this.fpvCamera = new THREE.PerspectiveCamera(
            75, // Field of View
            window.innerWidth / window.innerHeight, // Aspect Ratio
            0.1, // Near plane
            1000 // Far plane
        );
        // Position the camera slightly forward and up inside the drone body
        this.fpvCamera.position.set(
            0, // Centered horizontally
            this.dimensions.bodyHeight * 0.2, // Slightly above center vertically
            this.dimensions.bodyDepth * 0.3 // Forward from center (adjust Z position)
        );
        // Ensure the camera looks straight ahead relative to the drone
        this.fpvCamera.rotation.set(0, 0, 0);
        this.fpvCamera.name = "FPVCamera"; // Assign a name
        this.visual.add(this.fpvCamera); // Attach camera to the visual group

        if (Config.DEBUG_MODE && this.physicsBody) {
            console.log(`Drone: Initialization complete. Visual, Physics Body (ID: ${this.physicsBody.id}), and FPV Camera linked.`);
        } else if (Config.DEBUG_MODE) {
            console.log('Drone: Initialization potentially incomplete (Physics body error?).');
        }
    }

    update(deltaTime, controls) {
        if (!this.physicsBody) return;

        // Apply flight controls (forces/torques)
        this.applyControls(deltaTime, controls);

        // Propeller animation (visual only)
        if (this.armed && this.physicsBody.mass > 0) {
            const spinSpeed = controls.thrust * 50 + (this.armed ? 10 : 0); // Base spin when armed + thrust
            this.propellers.forEach(prop => {
                // Assuming props are oriented flat, spin around their local Y axis
                prop.rotation.y += spinSpeed * deltaTime;
            });
        } else if (!this.armed) {
            this.propellers.forEach(prop => {
                // Slow down props visually when disarmed
                prop.rotation.y *= 0.95;
            });
        }
    }

    applyControls(deltaTime, controls) {
        if (!this.physicsBody) {
            console.warn("applyControls skipped: physicsBody is missing.");
            return;
        }

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

    arm() {
        this.armed = true;
        if (Config.DEBUG_MODE) console.log("Drone Armed");
        // Optional: Reset angular velocity slightly on arm to prevent sudden spins if disarmed while rotating
        // this.physicsBody?.angularVelocity.scale(0.5, this.physicsBody.angularVelocity);
    }

    disarm() {
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

    reset(position = { x: 0, y: 1, z: 0 }) {
        if (!this.physicsBody || !this.visual) return;

        this.disarm(); // Disarm before resetting physics

        // Reset Physics State
        this.physicsBody.position.set(position.x, position.y, position.z);
        this.physicsBody.velocity.set(0, 0, 0);
        this.physicsBody.angularVelocity.set(0, 0, 0);
        this.physicsBody.quaternion.setFromEuler(0, 0, 0);
        this.physicsBody.force.set(0, 0, 0);
        this.physicsBody.torque.set(0, 0, 0);
        this.physicsBody.wakeUp();

        // Reset Visual State Immediately to match physics
        this.visual.position.copy(this.physicsBody.position);
        this.visual.quaternion.copy(this.physicsBody.quaternion);

        if (Config.DEBUG_MODE) console.log("Drone Reset");
    }
}

export default Drone;