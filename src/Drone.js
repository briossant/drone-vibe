// src/Drone.js
// Need THREE and CANNON eventually
import * as THREE from 'three';
// const CANNON = window.CANNON;
import Config from './Config.js';

class Drone {
    constructor(engine) {
        this.engine = engine; // Reference to SimulatorEngine
        this.visual = null; // THREE.Object3D
        this.physicsBody = null; // CANNON.Body
        this.fpvCamera = null; // THREE.PerspectiveCamera

        // State variables
        this.armed = false;
        this.flightMode = 'RATE'; // or 'ANGLE', 'HORIZON' later

        if (Config.DEBUG_MODE) {
            console.log('Drone: Initialized');
        }
    }

    initialize(initialPosition = { x: 0, y: 1, z: 0 }) {
        // Visual part remains the same...
        const geometry = new THREE.BoxGeometry(0.3, 0.1, 0.3);
        const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
        this.visual = new THREE.Mesh(geometry, material);
        this.visual.position.set(initialPosition.x, initialPosition.y, initialPosition.z);
        this.visual.castShadow = true; // Drone should cast shadows
        this.engine.renderer.addObject(this.visual);

        // Physics body - Assign the correct material
        if (CANNON && this.engine.physicsEngine.getMaterial) {
            const shape = new CANNON.Box(new CANNON.Vec3(0.15, 0.05, 0.15));
            this.physicsBody = new CANNON.Body({
                mass: Config.DRONE_MASS,
                position: new CANNON.Vec3(initialPosition.x, initialPosition.y, initialPosition.z),
                shape: shape,
                material: this.engine.physicsEngine.getMaterial('default'), // Assign default material
                linearDamping: 0.15, // Slightly increased damping maybe
                angularDamping: 0.6,
            });
            this.engine.physicsEngine.addBody(this.physicsBody, this.visual); // Link visual
        } else {
            console.error("Drone: CANNON or Physics materials not available.");
        }


        // FPV Camera part remains the same...
        this.fpvCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.fpvCamera.position.set(0, 0.05, 0.1);
        this.visual.add(this.fpvCamera);

        if (Config.DEBUG_MODE && this.physicsBody) {
            console.log(`Drone: Visual and Physics body created (ID: ${this.physicsBody.id}).`);
        } else if(Config.DEBUG_MODE){
            console.log('Drone: Visual created, Physics body FAILED.');
        }
    }

    update(deltaTime, controls) {
        if (!this.physicsBody) return;

        // Flight Control Logic (Phase 4/5 refinement)
        // This is where Roll/Pitch/Yaw/Thrust inputs are translated to forces/torques
        this.applyControls(deltaTime, controls);

        // Note: Synchronization (physics body -> visual mesh) is handled
        // by PhysicsEngine.syncVisuals() or the main loop calling it.
    }

    applyControls(deltaTime, controls) {
        if (!this.physicsBody || !this.armed) {
            // Ensure drone doesn't just float away if disarmed but physics applied
            this.physicsBody.angularVelocity.set(0,0,0);
            // Apply minimal force if needed when disarmed on ground?
            return;
        }

        // --- VERY Basic Control Application (Placeholder for Phase 4/5) ---
        const forceMagnitude = 10; // Adjust based on mass/gravity
        const torqueMagnitude = 1; // Adjust based on inertia/desired response

        // Thrust (Apply force upwards relative to drone orientation)
        // Calculate world-up direction if needed for simpler thrust, or apply local Y
        const thrustForce = new CANNON.Vec3(0, controls.thrust * forceMagnitude * Config.DRONE_MASS * 1.5, 0); // Scale thrust
        const worldThrustPoint = this.physicsBody.position; // Apply at center of mass for now
        this.physicsBody.applyLocalForce(thrustForce, CANNON.Vec3.ZERO); // Apply thrust along drone's local Y


        // Torques for Roll, Pitch, Yaw (Apply torque around local axes)
        const rollTorque = -controls.roll * torqueMagnitude; // Negative roll input = positive torque around local X ? Check convention
        const pitchTorque = -controls.pitch * torqueMagnitude; // Negative pitch input = positive torque around local Y ? Check convention
        const yawTorque = -controls.yaw * torqueMagnitude; // Negative yaw input = positive torque around local Z ? Check convention

        this.physicsBody.applyLocalTorque(new CANNON.Vec3(pitchTorque, yawTorque, rollTorque)); // Confirm axes mapping (X=Pitch, Y=Yaw, Z=Roll is common in aerospace, but might differ in sims/Cannon)
        // Cannon.js/Three.js standard: X=Red, Y=Green, Z=Blue
        // Drone convention often: X=Roll, Y=Pitch, Z=Yaw
        // ====> ADJUST THE applyLocalTorque Vec3 order based on testing <====
        // Likely needs to be: new CANNON.Vec3(rollTorque, pitchTorque, yawTorque) or permutation

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

        this.physicsBody.position.set(position.x, position.y, position.z);
        this.physicsBody.velocity.set(0, 0, 0);
        this.physicsBody.angularVelocity.set(0, 0, 0);
        this.physicsBody.quaternion.setFromEuler(0, 0, 0); // Reset orientation

        // Also reset visual immediately to avoid frame lag
        this.visual.position.copy(this.physicsBody.position);
        this.visual.quaternion.copy(this.physicsBody.quaternion);

        this.disarm(); // Disarm on reset

        if (Config.DEBUG_MODE) console.log("Drone Reset");
    }

}

export default Drone;