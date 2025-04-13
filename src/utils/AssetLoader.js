// src/AssetLoader.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'; // Optional, but common for compressed GLTF
import Config from '../config/Config.js';

class AssetLoader {
    constructor() {
        this.textureLoader = new THREE.TextureLoader();
        this.cubeTextureLoader = new THREE.CubeTextureLoader();
        this.gltfLoader = new GLTFLoader();
        this.audioLoader = new THREE.AudioLoader();

        // Optional: Setup DRACOLoader if your models use Draco compression
        const dracoLoader = new DRACOLoader();
        // Point this to the directory containing the Draco decoder files (usually from three/examples/jsm/libs/draco/gltf/)
        // You might need to copy these files to your public/libs folder or similar.
        // Adjust the path based on your project structure and where you place the decoder files.
        dracoLoader.setDecoderPath('https://unpkg.com/three@0.161.0/examples/jsm/libs/draco/gltf/'); // Example using unpkg CDN
        this.gltfLoader.setDRACOLoader(dracoLoader);


        this.loadedAssets = {
            textures: {},
            cubeTextures: {},
            models: {},
            sounds: {}
        };

        if (Config.DEBUG_MODE) {
            console.log("AssetLoader: Initialized");
        }
    }

    // --- Loading Methods ---

    loadAudio(key, path) {
        return new Promise((resolve, reject) => {
            if (this.loadedAssets.sounds[key]) {
                resolve(this.loadedAssets.sounds[key]);
                return;
            }
            this.audioLoader.load(path,
                (buffer) => {
                    if (Config.DEBUG_MODE) console.log(`AssetLoader: Audio "${key}" loaded from ${path}`);
                    // Store the AudioBuffer
                    this.loadedAssets.sounds[key] = buffer;
                    resolve(buffer);
                },
                undefined, // onProgress
                (error) => {
                    console.error(`AssetLoader: Failed to load audio "${key}" from ${path}`, error);
                    reject(error);
                }
            );
        });
    }

    loadTexture(key, path) {
        return new Promise((resolve, reject) => {
            if (this.loadedAssets.textures[key]) {
                resolve(this.loadedAssets.textures[key]);
                return;
            }
            this.textureLoader.load(path,
                (texture) => {
                    if (Config.DEBUG_MODE) console.log(`AssetLoader: Texture "${key}" loaded from ${path}`);
                    this.loadedAssets.textures[key] = texture;
                    resolve(texture);
                },
                undefined, // onProgress callback (optional)
                (error) => {
                    console.error(`AssetLoader: Failed to load texture "${key}" from ${path}`, error);
                    reject(error);
                }
            );
        });
    }

    loadCubeTexture(key, pathsArray) {
        // pathsArray: [px, nx, py, ny, pz, nz] - Positive X, Negative X, etc.
        return new Promise((resolve, reject) => {
            if (this.loadedAssets.cubeTextures[key]) {
                resolve(this.loadedAssets.cubeTextures[key]);
                return;
            }
            this.cubeTextureLoader.load(pathsArray,
                (texture) => {
                    if (Config.DEBUG_MODE) console.log(`AssetLoader: CubeTexture "${key}" loaded.`);
                    this.loadedAssets.cubeTextures[key] = texture;
                    resolve(texture);
                },
                undefined, // onProgress
                (error) => {
                    console.error(`AssetLoader: Failed to load cube texture "${key}"`, error);
                    reject(error);
                }
            );
        });
    }

    loadGLTFModel(key, path) {
        return new Promise((resolve, reject) => {
            if (this.loadedAssets.models[key]) {
                resolve(this.loadedAssets.models[key]); // Return the cached GLTF structure
                return;
            }
            this.gltfLoader.load(path,
                (gltf) => {
                    if (Config.DEBUG_MODE) console.log(`AssetLoader: GLTF Model "${key}" loaded from ${path}`);
                    // gltf contains scene, animations, cameras etc.
                    this.loadedAssets.models[key] = gltf;
                    resolve(gltf);
                },
                undefined, // onProgress
                (error) => {
                    console.error(`AssetLoader: Failed to load GLTF model "${key}" from ${path}`, error);
                    reject(error);
                }
            );
        });
    }

    // --- Accessor Methods ---

    getSoundBuffer(key) { // <<< Add sound getter
        return this.loadedAssets.sounds[key] || null;
    }

    getTexture(key) {
        return this.loadedAssets.textures[key] || null;
    }

    getCubeTexture(key) {
        return this.loadedAssets.cubeTextures[key] || null;
    }

    getModel(key) {
        // Return the entire loaded GLTF structure (or just scene if preferred)
        return this.loadedAssets.models[key] || null;
    }

    // --- Preload Function ---
    // Call this early to load all essential assets before starting the simulation
    async preloadAssets() {
        console.log("AssetLoader: Starting asset preloading...");
        const loadPromises = [];

        // Define assets to preload here
        // IMPORTANT: Replace these paths with your actual asset paths!
        const assetsToLoad = {
            models: [
                // Assuming you have a drone model in assets/models/drone.glb
                { key: 'drone', path: 'assets/models/drone.glb' }
            ],
            cubeTextures: [
                // Assuming skybox images are in assets/textures/skybox/
                // Order: PosX, NegX, PosY, NegY, PosZ, NegZ
                { key: 'skybox', paths: [
                        'assets/textures/skybox/px.jpg', 'assets/textures/skybox/nx.jpg',
                        'assets/textures/skybox/py.jpg', 'assets/textures/skybox/ny.jpg',
                        'assets/textures/skybox/pz.jpg', 'assets/textures/skybox/nz.jpg',
                    ]}
            ],
            textures: [
                // Example: { key: 'ground', path: 'assets/textures/ground.jpg' }
            ],
            sounds: [ // <<< Define sounds to preload
                // Example paths - replace with actual files later
                //{ key: 'ui_click', path: 'assets/sounds/ui_click.ogg' },
                //{ key: 'ui_hover', path: 'assets/sounds/ui_hover.wav' },
                //{ key: 'ui_toggle', path: 'assets/sounds/ui_toggle.mp3' },
                //{ key: 'ui_open', path: 'assets/sounds/ui_open.ogg' },
                //{ key: 'ui_close', path: 'assets/sounds/ui_close.ogg' },
            ]
        };

        // Create promises for each asset type
        assetsToLoad.models.forEach(asset => loadPromises.push(this.loadGLTFModel(asset.key, asset.path)));
        assetsToLoad.cubeTextures.forEach(asset => loadPromises.push(this.loadCubeTexture(asset.key, asset.paths)));
        assetsToLoad.textures.forEach(asset => loadPromises.push(this.loadTexture(asset.key, asset.path)));
        assetsToLoad.sounds.forEach(asset => loadPromises.push(this.loadAudio(asset.key, asset.path))); // <<< Add sound loading

        try {
            await Promise.all(loadPromises);
            console.log("AssetLoader: All essential assets preloaded successfully.");
        } catch (error) {
            console.error("AssetLoader: Error during asset preloading.", error);
            // Handle critical loading errors (e.g., show an error message)
            throw new Error("Failed to preload essential assets.");
        }
    }
}

// Export a single instance (Singleton pattern)
const instance = new AssetLoader();
export default instance; // <<< Export the instance directly