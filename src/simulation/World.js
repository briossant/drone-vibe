// src/World.js
import * as THREE from 'three';
// Access CANNON via window object
import * as CANNON from 'cannon-es'; // <<<--- ADD THIS IMPORT
import Config from '../config/Config.js';
import AssetLoader from '../utils/AssetLoader.js'; // Import loader instance

class World {
    constructor(engine) {
        this.engine = engine; // Reference to SimulatorEngine
        this.groundMesh = null;
        this.groundBody = null;
        // Remove test cube references if no longer needed, or keep for testing
        // this.testCubeMesh = null;
        // this.testCubeBody = null;
        this.obstacles = []; // Store { visual, body } pairs

        if (Config.DEBUG_MODE) {
            console.log('World: Initialized');
        }
    }

    // Make initialize async to await asset loading if needed (like skybox)
    async initialize() {
        // --- Ground ---
        this.createGround(); // Ground doesn't need async assets (yet)

        // --- Lighting (Configure Shadows) ---
        this.addLighting();

        // --- Skybox ---
        this.addSkybox(); // Uses preloaded assets

        // --- Obstacles ---
        this.createObstacle_Box({ x: 5, y: 0.5, z: 5 }, { width: 1, height: 1, depth: 1 });
        this.createObstacle_Box({ x: -3, y: 1, z: -6 }, { width: 4, height: 2, depth: 0.5 });

        // Gate 1: Straight ahead from start
        this.createObstacle_Gate({ x: 0, y: 0, z: -8 }, { width: 4, height: 2.5, depth: 0.2 }, 0);

        // Gate 2: Further out, angled slightly right
        this.createObstacle_Gate({ x: 10, y: 0, z: -18 }, { width: 4, height: 2.5, depth: 0.2 }, -Math.PI / 6); // Rotate -30 degrees

        // Gate 3: To the left, facing towards the center somewhat, slightly elevated
        this.createObstacle_Gate({ x: -12, y: 0.5, z: -15 }, { width: 5, height: 3, depth: 0.2 }, Math.PI / 4); // Rotate 45 degrees

        // Gate 4: Further back, facing forward again
        this.createObstacle_Gate({ x: 0, y: 0, z: -28 }, { width: 4, height: 2.5, depth: 0.2 }, 0);

        this.createObstacle_Box({ x: 15, y: 1.5, z: -10 }, { width: 0.5, height: 3, depth: 8 }); // Example Wall

        if (Config.DEBUG_MODE) {
            console.log('World: Initialization complete with gates.');
        }
    }

    createGround() {
        // Visual
        const groundGeometry = new THREE.PlaneGeometry(100, 100);
        // Optional: Use a texture loaded via AssetLoader
        // const groundTexture = AssetLoader.getTexture('ground'); // Assuming 'ground' texture was preloaded
        const groundMaterial = new THREE.MeshStandardMaterial({
            color: 0x777777, // Darker grey maybe
            side: THREE.DoubleSide,
            roughness: 0.9,
            metalness: 0.1,
            // map: groundTexture || null, // Apply texture if loaded
        });
        this.groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
        this.groundMesh.rotation.x = -Math.PI / 2;
        this.groundMesh.position.y = 0;
        this.groundMesh.receiveShadow = true; // <<<--- IMPORTANT: Ground receives shadows
        this.engine.renderer.addObject(this.groundMesh);

        // Physics (remains the same)
        if (this.engine.physicsEngine.getMaterial) {
            const groundShape = new CANNON.Plane();
            this.groundBody = new CANNON.Body({ mass: 0, material: this.engine.physicsEngine.getMaterial('ground') });
            this.groundBody.addShape(groundShape);
            this.groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
            this.engine.physicsEngine.addBody(this.groundBody);
        } else {
            console.log("error loading ground");
        }

        if (Config.DEBUG_MODE) {
            console.log('World: Ground plane created (Visual receives shadow, Physics).');
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
        if (this.engine.physicsEngine.getMaterial) {
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
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4); // Lower ambient slightly
        this.engine.renderer.addObject(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9); // Slightly stronger directional
        directionalLight.position.set(10, 15, 10); // Adjust position for desired shadow angle
        directionalLight.target.position.set(0, 0, 0); // Ensure light points towards origin or area of interest
        this.engine.renderer.addObject(directionalLight.target); // Need to add target to scene as well

        // --- Shadow Configuration for Light ---
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048; // Increase resolution for sharper shadows
        directionalLight.shadow.mapSize.height = 2048;
        // Define the area where shadows are cast
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 50; // Adjust based on scene size
        directionalLight.shadow.camera.left = -20; // Adjust frustum bounds
        directionalLight.shadow.camera.right = 20;
        directionalLight.shadow.camera.top = 20;
        directionalLight.shadow.camera.bottom = -20;
        directionalLight.shadow.bias = -0.001; // Adjust if shadow acne occurs

        this.engine.renderer.addObject(directionalLight);

        // Optional: Add a shadow camera helper for debugging
        // if (Config.DEBUG_MODE) {
        //     const shadowCamHelper = new THREE.CameraHelper(directionalLight.shadow.camera);
        //     this.engine.renderer.addObject(shadowCamHelper);
        // }

        if (Config.DEBUG_MODE) { console.log('World: Lighting added (Directional light casting shadows).'); }
    }

    addSkybox() {
        const skyboxTexture = AssetLoader.getCubeTexture('skybox'); // Get preloaded texture
        if (skyboxTexture && this.engine.renderer.scene) {
            this.engine.renderer.scene.background = skyboxTexture;
            if (Config.DEBUG_MODE) console.log("World: Skybox applied to scene background.");
        } else {
            console.warn("World: Skybox texture not found or scene not ready.");
            // Fallback to color if texture failed
            this.engine.renderer.scene.background = new THREE.Color(0x6080a0);
        }
    }

    // --- Obstacle Creation Example (Box) ---
    createObstacle_Box(position, dimensions) {
        const { width, height, depth } = dimensions;
        const halfExtents = new CANNON.Vec3(width / 2, height / 2, depth / 2);

        // Visual Mesh
        const geometry = new THREE.BoxGeometry(width, height, depth);
        const material = new THREE.MeshStandardMaterial({ color: Math.random() * 0xffffff, roughness: 0.6 });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(position.x, position.y, position.z);
        mesh.castShadow = true;    // <<< Obstacles cast shadows
        mesh.receiveShadow = true; // <<< Obstacles can receive shadows
        this.engine.renderer.addObject(mesh);

        // Physics Body
        if (this.engine.physicsEngine.getMaterial) {
            const shape = new CANNON.Box(halfExtents);
            const body = new CANNON.Body({
                mass: 0, // Static obstacle
                position: new CANNON.Vec3(position.x, position.y, position.z),
                shape: shape,
                material: this.engine.physicsEngine.getMaterial('default') // Use default for collision for now
            });
            this.engine.physicsEngine.addBody(body); // No visual link needed for static bodies
            this.obstacles.push({ visual: mesh, body: body }); // Store if needed later
            if (Config.DEBUG_MODE) console.log(`World: Created static obstacle box at (${position.x}, ${position.y}, ${position.z})`);
        } else {
            console.error("World: CANNON or Physics materials not available for obstacle box.");
        }
    }

    // In World.js
    createObstacle_Gate(position, size = { width: 3, height: 2, depth: 0.2 }) {
        const { width, height, depth } = size;
        const pillarHeight = height;
        const pillarWidth = depth; // Use depth as thickness
        const topBarWidth = width;
        const topBarHeight = depth;

        // --- Visuals (Group multiple meshes) ---
        const gateGroup = new THREE.Group();
        gateGroup.position.set(position.x, position.y, position.z); // Set group position

        const material = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.7 });

        // Left Pillar
        const leftPillarGeo = new THREE.BoxGeometry(pillarWidth, pillarHeight, depth);
        const leftPillarMesh = new THREE.Mesh(leftPillarGeo, material);
        leftPillarMesh.position.set(-width / 2 + pillarWidth / 2, pillarHeight / 2, 0); // Relative position
        leftPillarMesh.castShadow = true; leftPillarMesh.receiveShadow = true;
        gateGroup.add(leftPillarMesh);

        // Right Pillar
        const rightPillarGeo = new THREE.BoxGeometry(pillarWidth, pillarHeight, depth);
        const rightPillarMesh = new THREE.Mesh(rightPillarGeo, material);
        rightPillarMesh.position.set(width / 2 - pillarWidth / 2, pillarHeight / 2, 0); // Relative position
        rightPillarMesh.castShadow = true; rightPillarMesh.receiveShadow = true;
        gateGroup.add(rightPillarMesh);

        // Top Bar
        const topBarGeo = new THREE.BoxGeometry(topBarWidth, topBarHeight, depth);
        const topBarMesh = new THREE.Mesh(topBarGeo, material);
        topBarMesh.position.set(0, height - topBarHeight / 2, 0); // Relative position
        topBarMesh.castShadow = true; topBarMesh.receiveShadow = true;
        gateGroup.add(topBarMesh);

        this.engine.renderer.addObject(gateGroup); // Add the whole group

        // --- Physics (Compound Body) ---
        if (this.engine.physicsEngine.getMaterial) {
            const gateBody = new CANNON.Body({
                mass: 0, // Static
                position: new CANNON.Vec3(position.x, position.y, position.z), // Use absolute position here
                material: this.engine.physicsEngine.getMaterial('default')
            });

            // Left Pillar Shape
            const leftPillarShape = new CANNON.Box(new CANNON.Vec3(pillarWidth / 2, pillarHeight / 2, depth / 2));
            const leftPillarOffset = new CANNON.Vec3(-width / 2 + pillarWidth / 2, pillarHeight / 2, 0); // Relative offset
            gateBody.addShape(leftPillarShape, leftPillarOffset);

            // Right Pillar Shape
            const rightPillarShape = new CANNON.Box(new CANNON.Vec3(pillarWidth / 2, pillarHeight / 2, depth / 2));
            const rightPillarOffset = new CANNON.Vec3(width / 2 - pillarWidth / 2, pillarHeight / 2, 0); // Relative offset
            gateBody.addShape(rightPillarShape, rightPillarOffset);

            // Top Bar Shape
            const topBarShape = new CANNON.Box(new CANNON.Vec3(topBarWidth / 2, topBarHeight / 2, depth / 2));
            const topBarOffset = new CANNON.Vec3(0, height - topBarHeight / 2, 0); // Relative offset
            gateBody.addShape(topBarShape, topBarOffset);

            this.engine.physicsEngine.addBody(gateBody);
            this.obstacles.push({ visual: gateGroup, body: gateBody }); // Store group and body
            if (Config.DEBUG_MODE) console.log(`World: Created static gate at (${position.x}, ${position.y}, ${position.z})`);
        }
    }

    update(deltaTime) {
        // Not much needed here yet
    }
}

export default World;