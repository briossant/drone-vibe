// src/Drone.js
import * as THREE from 'three';
import * as CANNON from 'cannon-es'; // <<<--- Import directly
import Config from './Config.js';

const worldTorqueVector = new CANNON.Vec3();

class Drone {
    constructor(engine) {
        this.engine = engine;
        this.visual = null;         // THREE.Group
        this.physicsBody = null;    // CANNON.Body
        this.fpvCamera = null;      // THREE.PerspectiveCamera
        this.propellers = [];       // Array for propeller meshes later

        this.armed = false;
        this.flightMode = 'RATE';

        // Define drone dimensions (can be moved to Config.js later)
        this.dimensions = {
            bodyWidth: 0.15, bodyHeight: 0.08, bodyDepth: 0.15,
            armLength: 0.18, armWidth: 0.02,
            propDiameter: 0.1 // Just for visual reference now
        };

        if (Config.DEBUG_MODE) {
            console.log('Drone: Initialized');
        }
    }

    // --- Factory Methods ---

    createVisualModel() {
        const group = new THREE.Group();
        const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.6, metalness: 0.3 }); // Dark grey body
        const armMaterial = new THREE.MeshStandardMaterial({ color: 0x777777, roughness: 0.7 });
        const propMaterial = new THREE.MeshStandardMaterial({ color: 0x333333, opacity: 0.8, transparent: true }); // Simple prop look

        const d = this.dimensions; // Shorthand

        // Main Body (Box)
        const bodyGeometry = new THREE.BoxGeometry(d.bodyWidth, d.bodyHeight, d.bodyDepth);
        const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
        bodyMesh.castShadow = true;
        group.add(bodyMesh);

        // Arms (Boxes - positioned relative to body)
        const armGeometry = new THREE.BoxGeometry(d.armWidth, d.armWidth, d.armLength); // Note Z is length here
        const armPositions = [
            { x: d.bodyWidth / 2, y: 0, z: d.bodyDepth / 2 + d.armLength / 2, rotY: Math.PI / 4 },  // Front-Right
            { x: -d.bodyWidth / 2, y: 0, z: d.bodyDepth / 2 + d.armLength / 2, rotY: -Math.PI / 4 }, // Front-Left
            { x: d.bodyWidth / 2, y: 0, z: -d.bodyDepth / 2 - d.armLength / 2, rotY: -Math.PI / 4 + Math.PI },// Back-Right
            { x: -d.bodyWidth / 2, y: 0, z: -d.bodyDepth / 2 - d.armLength / 2, rotY: Math.PI / 4 + Math.PI },// Back-Left
        ];

        armPositions.forEach(pos => {
            const armMesh = new THREE.Mesh(armGeometry, armMaterial);
            // --- Positioning and rotating the ARM ---
            // Position arm relative to drone center based on angle
            const armOffsetX = (d.bodyWidth / 2 + d.armLength / 2) * Math.cos(pos.rotY);
            const armOffsetZ = (d.bodyDepth / 2 + d.armLength / 2) * Math.sin(pos.rotY); // Use sine for Z if rotY is angle from +X axis
            // Adjust if rotY is angle from +Z axis: armOffsetX = ... * Math.sin(pos.rotY); armOffsetZ = ... * Math.cos(pos.rotY);
            // Let's stick to the calculation from before for consistency, assuming rotY is angle in XY plane (viewed from above) relative to +X or +Z? Let's assume relative to +X axis for standard math angle.
            // Use the previous calculation which seemed okay visually for arms:
            armMesh.position.set(
                (d.bodyWidth / 2 + d.armLength / 2) * Math.cos(pos.rotY),
                pos.y, // Keep Y position from array (likely 0)
                (d.bodyDepth / 2 + d.armLength / 2) * Math.sin(pos.rotY) // Use sin for Z
            );
            armMesh.rotation.y = pos.rotY; // Rotate arm itself to point outwards


            armMesh.castShadow = true;
            group.add(armMesh); // Add ARM to the main drone group


            // --- Propeller Creation and Placement ---
            const propGeometry = new THREE.CylinderGeometry(d.propDiameter / 2, d.propDiameter / 2, 0.01, 16);
            const propMesh = new THREE.Mesh(propGeometry, propMaterial);

            // Position the propeller RELATIVE to the ARM's center
            // The arm's length is along its local Z axis. We want the prop at the end (+Z).
            propMesh.position.set(0, d.armWidth / 2 + 0.01, 0); // Place slightly above the arm (Y), AT the arm's origin (X=0, Z=0) - Correction needed
            // ^^ Incorrect: This places it at the arm's *center*. We want the end.
            // Let's place it at the end of the arm's local Z axis.
            propMesh.position.set(0, d.armWidth / 2 + 0.01, d.armLength / 2); // Position along arm's LOCAL Z


            // Rotation: Cylinder height is along Y. For a flat prop, no extra rotation needed.
            propMesh.rotation.x = 0; // Default Cylinder orientation is upright.

            propMesh.castShadow = true;

            // --- Add Propeller as CHILD of the Arm ---
            armMesh.add(propMesh); // <<< KEY CHANGE: Add prop to arm, not the main group directly

            this.propellers.push(propMesh);
        });


        // Add a simple "Front" indicator (e.g., a small red cone/box)
        const frontIndicatorGeo = new THREE.ConeGeometry(0.02, 0.05, 8);
        const frontIndicatorMat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
        const frontIndicatorMesh = new THREE.Mesh(frontIndicatorGeo, frontIndicatorMat);
        frontIndicatorMesh.position.set(0, d.bodyHeight / 2, d.bodyDepth / 2 + 0.01); // Place on top-front of body
        frontIndicatorMesh.rotation.x = Math.PI / 2;
        group.add(frontIndicatorMesh);


        return group;
    }

    createPhysicsBody(initialPosition) {
        if (!this.engine.physicsEngine.getMaterial) {
            console.error("Drone: CANNON or Physics materials not available for physics body.");
            return null;
        }

        const d = this.dimensions;
        // For physics, use a simplified shape, like just the main body box,
        // or a slightly larger box encompassing the core.
        // A compound shape of body + arms is more accurate but complex and slower.
        // Start with a box matching the central body.
        const bodyHalfExtents = new CANNON.Vec3(d.bodyWidth / 2, d.bodyHeight / 2, d.bodyDepth / 2);
        const bodyShape = new CANNON.Box(bodyHalfExtents);

        const body = new CANNON.Body({
            mass: Config.DRONE_MASS,
            position: new CANNON.Vec3(initialPosition.x, initialPosition.y, initialPosition.z),
            shape: bodyShape, // Use the simple box shape for physics calculation
            material: this.engine.physicsEngine.getMaterial('default'),
            linearDamping: 0.2,  // Slightly higher damping might feel better
            angularDamping: 0.7, // Crucial for rotational stability
        });

        // --- Calculate and Set Inertia ---
        // Let CANNON calculate the inertia tensor for the box shape
        // body.inertia is zero by default, need to update it.
        body.updateMassProperties(); // Calculates inertia based on mass and shape

        // Optional: Manually adjust inertia if needed (e.g., if visual doesn't match physics shape well)
        // body.inertia.set(ixx, iyy, izz); // Set diagonal components (principal moments of inertia)
        // body.invInertia.set(1/ixx, 1/iyy, 1/izz);
        // body.invInertiaWorld.set(1/ixx, 1/iyy, 1/izz); // And inverse world inertia

        if (Config.DEBUG_MODE) {
            console.log(`Drone Physics: Mass=${body.mass.toFixed(3)}`);
            console.log(`Drone Physics: Inertia=`, body.inertia); // Check calculated values
        }

        return body;
    }


    // --- Main Methods ---

    initialize(initialPosition = { x: 0, y: 1, z: 0 }) {
        // Create Visual Model
        this.visual = this.createVisualModel();
        this.visual.position.set(initialPosition.x, initialPosition.y, initialPosition.z);
        this.engine.renderer.addObject(this.visual); // Add visual group to scene

        // Create Physics Body
        console.log("Drone Initializing: Creating physics body..."); // Add log
        this.physicsBody = this.createPhysicsBody(initialPosition);

        if (this.physicsBody) {
            console.log("Drone Initializing: Physics body created successfully, adding to engine."); // Add log
            this.engine.physicsEngine.addBody(this.physicsBody, this.visual); // Link physics to visual group
        } else {
            // Make the error message more prominent
            console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
            console.error("Drone ERROR: Failed to create physics body. Simulation will likely fail.");
            console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
            // Consider throwing an error here to stop initialization?
            // throw new Error("Drone physics body creation failed.");
        }



        // Create FPV Camera and attach to the VISUAL group
        this.fpvCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        // Position relative to the center of the visual group
        this.fpvCamera.position.set(0, this.dimensions.bodyHeight * 0.2, this.dimensions.bodyDepth * 0.6); // Adjust FPV cam position
        this.fpvCamera.rotation.set(0, 0, 0); // Ensure camera starts level relative to drone body
        this.visual.add(this.fpvCamera); // Attach camera to the group

        if (Config.DEBUG_MODE && this.physicsBody) {
            console.log(`Drone: Initialization complete. Visual Model & Physics Body (ID: ${this.physicsBody.id}) linked.`);
        } else if(Config.DEBUG_MODE){
            console.log('Drone: Initialization FAILED for physics body.');
        }
    }

    update(deltaTime, controls) {
        if (!this.physicsBody) return;

        // Apply basic placeholder controls (will be refined in Phase 4/5)
        this.applyControls(deltaTime, controls);

        // Propeller Animation (Simple Spin) - just visual flair for now
        if (this.armed && this.physicsBody.mass > 0) {
            const spinSpeed = controls.thrust * 50 + 5; // Base spin + spin faster with thrust
            this.propellers.forEach(prop => {
                prop.rotation.y += spinSpeed * deltaTime; // Spin around their local Y axis (which is world Z if prop is flat)
                // Adjust axis if props are oriented differently
            });
        }
    }

    applyControls(deltaTime, controls) {
        // --- Guard Clause for physics body ---
        if (!this.physicsBody) {
            console.error("applyControls Error: Cannot apply controls because this.physicsBody is null or undefined!");
            return; // Exit early if physics body isn't valid
        }
        // Note: No need to check for the non-existent applyLocalTorque function anymore.

        if (!this.armed) {
            this.physicsBody.angularVelocity.scale(0.95, this.physicsBody.angularVelocity);
            return;
        }

        // --- Thrust Application (remains the same) ---
        const hoverThrustForce = Config.DRONE_MASS * Math.abs(Config.GRAVITY);
        const maxThrustForce = hoverThrustForce * 2.0;
        const thrustInput = controls.thrust;
        const currentThrustForce = thrustInput * maxThrustForce;
        const thrustForceVec = new CANNON.Vec3(0, currentThrustForce, 0); // Thrust along drone's local Y (up)
        this.physicsBody.applyLocalForce(thrustForceVec, CANNON.Vec3.ZERO); // applyLocalForce IS a real function


        // --- Torque Calculation (Local Space) ---
        const torqueMagnitude = 1.5; // Needs tuning
        const pitchTorque = -controls.pitch * torqueMagnitude; // Torque around local X for pitch
        const rollTorque = -controls.roll * torqueMagnitude;   // Torque around local Z for roll (if Z is forward)
        const yawTorque = -controls.yaw * torqueMagnitude;     // Torque around local Y for yaw

        // Define the desired torque vector in the DRONE'S LOCAL coordinate system
        // Mapping based on common drone/sim axes (confirm with visual axes helper/indicator):
        // Pitch Control -> Torque around Local X axis
        // Yaw Control   -> Torque around Local Y axis
        // Roll Control  -> Torque around Local Z axis
        const localTorque = new CANNON.Vec3(
            pitchTorque,
            yawTorque,
            rollTorque
        );

        // --- Convert Local Torque to World Torque ---
        // Use the vectorToWorldFrame method (which DOES exist)
        this.physicsBody.vectorToWorldFrame(localTorque, worldTorqueVector); // Converts localTorque -> worldTorqueVector using body's quaternion

        // --- Apply the World-Space Torque ---
        // Use the applyTorque method (which DOES exist)
        this.physicsBody.applyTorque(worldTorqueVector);


        // --- REMOVE THE INCORRECT CALL ---
        // this.physicsBody.applyLocalTorque(finalTorque); // DELETE THIS LINE

    }

    // Add methods for arming, setting flight modes, getting state etc.
    arm() {
        this.armed = true;
        if (Config.DEBUG_MODE) console.log("Drone Armed");
        // Reset physics state slightly? Prevent sudden jumps?
        // this.physicsBody.angularVelocity.set(0,0,0);
        // this.physicsBody.velocity.set(0,0,0); // Maybe not reset velocity?
    }

    disarm() {
        this.armed = false;
        if (Config.DEBUG_MODE) console.log("Drone Disarmed");
    }

    get FPVCamera() {
        return this.fpvCamera;
    }

    // Get relevant state for UI Manager
    getState() {
        if (!this.physicsBody) return null;
        return {
            position: this.physicsBody.position, // Note: This is a CANNON.Vec3, might need conversion or cloning
            velocity: this.physicsBody.velocity,
            quaternion: this.physicsBody.quaternion,
            armed: this.armed,
        };
    }

    reset(position = { x: 0, y: 1, z: 0 }) {
        if (!this.physicsBody || !this.visual) return;

        // Reset Physics State
        this.physicsBody.position.set(position.x, position.y, position.z);
        this.physicsBody.velocity.set(0, 0, 0);
        this.physicsBody.angularVelocity.set(0, 0, 0);
        this.physicsBody.quaternion.setFromEuler(0, 0, 0); // Reset orientation
        this.physicsBody.force.set(0,0,0); // Clear any residual forces
        this.physicsBody.torque.set(0,0,0); // Clear any residual torques
        // Optional: Wake up the body if it was sleeping
        this.physicsBody.wakeUp();


        // Reset Visual State Immediately
        this.visual.position.copy(this.physicsBody.position);
        this.visual.quaternion.copy(this.physicsBody.quaternion);

        this.disarm();

        if (Config.DEBUG_MODE) console.log("Drone Reset");
    }

}

export default Drone;