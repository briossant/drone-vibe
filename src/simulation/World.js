// src/simulation/World.js
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { getCurrentConfig } from '../config/ConfigManager.js'; // Updated path
import AssetLoader from '../utils/AssetLoader.js'; // Updated path
import ProceduralWorldGenerator from './ProceduralWorldGenerator.js'; // << NEW

class World {
    constructor(engine) {
        this.engine = engine; // Reference to SimulatorEngine
        this.generator = null; // Reference to the generator instance
        this.config = getCurrentConfig(); // Store config ref

        if (this.config.DEBUG_MODE) {
            console.log('World: Initialized');
        }
    }

    async initialize() {
        const config = this.config; // Use stored config
        if (config.DEBUG_MODE) console.log("World: Initializing...");

        // --- Lighting (Essential for visual appearance) ---
        this.addLighting();

        // --- Skybox (Uses preloaded assets) ---
        this.addSkybox();

        // --- Procedural Generation ---
        if (config.DEBUG_MODE) console.log("World: Starting procedural generation...");
        this.generator = new ProceduralWorldGenerator(
            this.engine.renderer, // Pass Renderer instance (has scene)
            this.engine.physicsEngine // Pass PhysicsEngine instance (has world)
        );
        await this.generator.generate(); // Generate terrain, props, gates

        // --- REMOVE Static Ground/Obstacle Creation ---
        // this.createGround(); // Replaced by generator
        // this.createObstacle_Box(...); // Replaced by generator
        // this.createObstacle_Gate(...); // Replaced by generator

        if (config.DEBUG_MODE) {
            console.log('World: Initialization complete (used Procedural Generator).');
        }
    }

    addLighting() {
        const config = this.config;
        // Ambient Light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // Adjust intensity
        this.engine.renderer.addObject(ambientLight);

        // Directional Light (for shadows)
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0); // Adjust intensity
        directionalLight.position.set(20, 30, 15); // Adjust angle
        directionalLight.target.position.set(0, 0, 0);
        this.engine.renderer.addObject(directionalLight.target);

        // Shadow Configuration
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        const shadowCamSize = this.generator?.terrainSize * 0.6 || 50; // Adjust shadow area based on terrain size
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 100;
        directionalLight.shadow.camera.left = -shadowCamSize;
        directionalLight.shadow.camera.right = shadowCamSize;
        directionalLight.shadow.camera.top = shadowCamSize;
        directionalLight.shadow.camera.bottom = -shadowCamSize;
        directionalLight.shadow.bias = -0.002; // Fine-tune bias

        this.engine.renderer.addObject(directionalLight);

        // Optional: Shadow Camera Helper
        if (config.DEBUG_MODE && config.WORLD_GENERATION.debugShadowCamera) {
            const shadowCamHelper = new THREE.CameraHelper(directionalLight.shadow.camera);
            this.engine.renderer.addObject(shadowCamHelper);
        }

        if (config.DEBUG_MODE) { console.log('World: Lighting added (Directional light casting shadows).'); }
    }

    addSkybox() {
        const config = this.config;
        const skyboxTexture = AssetLoader.getCubeTexture('skybox'); // Get preloaded texture
        if (skyboxTexture && this.engine.renderer.scene) {
            this.engine.renderer.scene.background = skyboxTexture;
            this.engine.renderer.scene.environment = skyboxTexture; // Also set environment map for PBR reflections
            if (config.DEBUG_MODE) console.log("World: Skybox applied to scene background and environment.");
        } else {
            console.warn("World: Skybox texture 'skybox' not found or scene not ready.");
            // Fallback to color if texture failed
            this.engine.renderer.scene.background = new THREE.Color(0x6080a0);
        }
    }

    update(deltaTime) {
        // Future: Update dynamic elements of the world if any (e.g., animated obstacles)
    }

    dispose() {
        // Call generator dispose if it exists and implements cleanup
        this.generator?.dispose();
        // Remove lights? THREE might handle this, but being explicit can help.
        // Note: Removing objects added by the generator needs careful tracking within the generator itself.
        if (this.config.DEBUG_MODE) {
            console.log("World: Disposed (placeholder, relies on Generator/Engine cleanup).")
        }
    }
}

export default World;