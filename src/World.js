// src/World.js
import * as THREE from 'three';
// Access CANNON via window object
const CANNON = window.CANNON;
import Config from './Config.js';

class World {
    constructor(engine) {
        this.engine = engine; // Reference to SimulatorEngine
        this.groundMesh = null;
        this.groundBody = null;
        this.testCubeMesh = null; // Reference for test cube visual
        this.testCubeBody = null; // Reference for test cube physics
        this.obstacles = [];

        if (Config.DEBUG_MODE) {
            console.log('World: Initialized');
        }
    }

    initialize() {
        // --- Ground ---
        this.createGround();

        // --- Lighting ---
        this.addLighting(); // Already adds lights to renderer

        // --- Test Cube ---
        this.createTestCube({ x: 0, y: 5, z: 0 }); // Create cube at specific position

        // --- Skybox (Phase 6) ---
        // this.addSkybox();

        // --- Obstacles (Phase 6) ---
        // this.addObstacle(...);
    }

    createGround() {
        // Visual
        const groundGeometry = new THREE.PlaneGeometry(100, 100);
        const groundMaterial = new THREE.MeshStandardMaterial({
            color: 0x808080, side: THREE.DoubleSide, roughness: 0.9, metalness: 0.1,
        });
        this.groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
        this.groundMesh.rotation.x = -Math.PI / 2;
        this.groundMesh.position.y = 0;
        this.groundMesh.receiveShadow = true;
        this.engine.renderer.addObject(this.groundMesh);

        // Physics
        if (CANNON && this.engine.physicsEngine.getMaterial) {
            const groundShape = new CANNON.Plane();
            this.groundBody = new CANNON.Body({
                mass: 0, // Static
                material: this.engine.physicsEngine.getMaterial('ground') // Assign specific ground material
            });
            this.groundBody.addShape(groundShape);
            this.groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
            this.groundBody.position.set(0, 0, 0);
            this.engine.physicsEngine.addBody(this.groundBody); // Add to physics world (visual linking not needed for static)
        } else {
            console.error("World: CANNON or Physics materials not available for ground.");
        }

        if (Config.DEBUG_MODE) {
            console.log('World: Ground plane created (Visual & Physics with material).');
        }
    }

    createTestCube(position = { x: 0, y: 5, z: 0 }) {
        const size = 0.5; // Size of the cube
        const halfExtents = size * 0.5;

        // Visual
        const cubeGeometry = new THREE.BoxGeometry(size, size, size);
        const cubeMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00, roughness: 0.5 }); // Green cube
        this.testCubeMesh = new THREE.Mesh(cubeGeometry, cubeMaterial);
        this.testCubeMesh.position.set(position.x, position.y, position.z);
        this.testCubeMesh.castShadow = true; // Allow cube to cast shadows
        this.testCubeMesh.receiveShadow = true; // Allow cube to receive shadows (less common)
        this.engine.renderer.addObject(this.testCubeMesh);

        // Physics
        if (CANNON && this.engine.physicsEngine.getMaterial) {
            const cubeShape = new CANNON.Box(new CANNON.Vec3(halfExtents, halfExtents, halfExtents));
            this.testCubeBody = new CANNON.Body({
                mass: 0.2, // Give it some mass (kg)
                position: new CANNON.Vec3(position.x, position.y, position.z),
                shape: cubeShape,
                material: this.engine.physicsEngine.getMaterial('default') // Use the default dynamic material
            });
            // Optional: Add initial velocity or angular velocity for testing
            // this.testCubeBody.velocity.set(2, 0, 0);
            // this.testCubeBody.angularVelocity.set(0, 1, 0.5);

            // Add to physics engine AND provide the visual mesh for mapping/synchronization
            this.engine.physicsEngine.addBody(this.testCubeBody, this.testCubeMesh);
        } else {
            console.error("World: CANNON or Physics materials not available for test cube.");
        }

        if (Config.DEBUG_MODE) {
            console.log('World: Test cube created (Visual & Physics).');
        }
    }

    addLighting() {
        // ... (lighting code remains the same as Phase 0/1) ...
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.engine.renderer.addObject(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 10, 7.5);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 1024;
        directionalLight.shadow.mapSize.height = 1024;
        // ... (rest of shadow config)
        this.engine.renderer.addObject(directionalLight);
        if (Config.DEBUG_MODE) { console.log('World: Basic lighting added.'); }
    }

    update(deltaTime) {
        // Not much needed here yet
    }
}

export default World;