// src/PhysicsEngine.js
import Config from './Config.js';
// Access CANNON via window object (as loaded in index.html)
import * as CANNON from 'cannon-es'; // <<<--- Import directly

class PhysicsEngine {
    constructor(engine) {
        this.engine = engine;
        this.world = null;
        // Map: physics body -> { visual: THREE.Object3D, options: {} }
        // Store visual object reference for synchronization
        this.bodyMap = new Map();

        // Define materials here for easy access
        this.materials = {
            ground: null,
            default: null, // For dynamic objects like the drone, test cube
        };

        if (Config.DEBUG_MODE) {
            console.log('PhysicsEngine: Initialized');
        }
    }

    initialize() {
        if (!CANNON) {
            console.error("PhysicsEngine: CANNON is not loaded!");
            return;
        }
        this.world = new CANNON.World({
            gravity: new CANNON.Vec3(0, Config.GRAVITY, 0),
            // broadphase: new CANNON.SAPBroadphase(world) // Optional: Can improve performance for many objects
            allowSleep: true, // Allow bodies to sleep when inactive (performance)
        });

        // Optional: Tweak solver settings for stability/performance
        this.world.solver.iterations = 10; // Default is 10
        // this.world.solver.tolerance = 0.01; // Default is 0.01

        // --- Define Materials ---
        this.materials.ground = new CANNON.Material("groundMaterial");
        this.materials.default = new CANNON.Material("defaultMaterial");

        // --- Define Contact Materials ---
        // Adjust friction and restitution (bounciness)
        const default_ground_contact = new CANNON.ContactMaterial(
            this.materials.ground,     // Material 1
            this.materials.default,    // Material 2
            {
                friction: 0.4,        // How much friction? (0 to 1+)
                restitution: 0.1,     // How bouncy? (0 = no bounce, 1 = perfect bounce)
                // contactEquationStiffness: 1e8, // Default
                // contactEquationRelaxation: 3, // Default
                // frictionEquationStiffness: 1e8, // Default
                // frictionEquationRelaxation: 3, // Default
            }
        );
        this.world.addContactMaterial(default_ground_contact);

        if (Config.DEBUG_MODE) {
            console.log('PhysicsEngine: CANNON world created and materials defined.');
        }
    }

    addBody(body, visualObject = null, options = {}) {
        if (!this.world || !(body instanceof CANNON.Body)) {
            console.warn("PhysicsEngine: Cannot add invalid body or world not initialized.");
            return;
        }
        // Assign default material if none provided on the body itself
        if (!body.material) {
            body.material = this.materials.default;
            if (Config.DEBUG_MODE && body.mass > 0) { // Don't log for static ground
                console.log(`PhysicsEngine: Body ID ${body.id} assigned default material.`);
            }
        }

        this.world.addBody(body);
        // Store mapping for synchronization
        this.bodyMap.set(body, { visual: visualObject, options: options });

        if (Config.DEBUG_MODE) {
            console.log(`PhysicsEngine: Added body ID ${body.id} (Mass: ${body.mass}, Type: ${body.type === CANNON.Body.STATIC ? 'Static' : 'Dynamic'})`);
        }
    }

    removeBody(body) {
        if (!this.world || !(body instanceof CANNON.Body)) {
            console.warn("PhysicsEngine: Cannot remove invalid body or world not initialized.");
            return;
        }
        this.world.removeBody(body);
        this.bodyMap.delete(body);
        if (Config.DEBUG_MODE) {
            console.log('PhysicsEngine: Removed body', body.id);
        }
    }

    update(deltaTime) {
        if (!this.world) return;

        // Fixed timestep update loop
        // Recommended for stability. Steps the simulation forward in fixed increments.
        // Handle cases where deltaTime is larger than the timestep (prevents large jumps)
        const maxSubSteps = 10; // Prevent spiral of death if rendering lags badly
        this.world.step(Config.PHYSICS_TIMESTEP, deltaTime, maxSubSteps);

        // Synchronization is now handled AFTER the step in the main loop
        // This ensures visuals reflect the state *after* the latest physics update.
        // this.syncVisuals(); // REMOVED FROM HERE
    }

    // Synchronization logic - Called from the main loop
    syncVisuals() {
        if (!this.world) return;

        this.bodyMap.forEach((entry, body) => {
            // Only update dynamic bodies that have a visual counterpart
            // and are not sleeping (optimization)
            if (entry.visual && body.type !== CANNON.Body.STATIC && body.sleepState !== CANNON.Body.SLEEPING) {
                entry.visual.position.copy(body.position);
                entry.visual.quaternion.copy(body.quaternion);
            }
        });
    }

    // Helper to get a material by name
    getMaterial(name = 'default') {
        return this.materials[name] || this.materials.default;
    }
}

export default PhysicsEngine;