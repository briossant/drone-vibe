// src/Renderer.js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'; // Import OrbitControls
import Config from '../config/Config.js';
import ConfigManager, { getCurrentConfig } from '../config/ConfigManager.js'; // Use ConfigManager
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'; // << NEW
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';     // << NEW
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'; // << NEW
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';         // << NEW
import { VignetteShader } from 'three/addons/shaders/VignetteShader.js';
import EventBus, {EVENTS} from "../utils/EventBus.js";     // << NEW


class Renderer {
    constructor(engine) {
        this.engine = engine;
        this.renderer = null;
        this.scene = null;
        this.activeCamera = null; // The camera currently used for rendering
        this.debugCamera = null;  // A separate camera for debugging
        this.controls = null;     // OrbitControls instance

        this.composer = null;
        this.renderPass = null;
        this.bloomPass = null;
        this.vignettePass = null;

        this.shakeIntensity = 0;
        this.shakeDuration = 0;
        this.shakeDecayRate = 5.0; // How quickly the shake decays (higher = faster decay)
        this.shakeMaxOffset = 0.03; // Max position offset
        this.shakeMaxAngle = 0.015; // Max rotation offset (radians)
        this.originalCameraPos = new THREE.Vector3();
        this.originalCameraQuat = new THREE.Quaternion();

        if (Config.DEBUG_MODE) {
            console.log('Renderer: Initialized');
        }
    }

    triggerCameraShake(intensity = 0.5, duration = 0.3) {
        // Only trigger if the new shake is stronger or current shake is finished
        if (intensity > this.shakeIntensity || this.shakeDuration <= 0) {
            this.shakeIntensity = clamp(intensity, 0, 1);
            this.shakeDuration = duration;
            // Store original transform ONLY when starting a new shake sequence
            if (this.activeCamera && this.shakeDuration > 0) {
                // We ideally want to store the position/rotation RELATIVE to the parent (drone)
                // If the FPV camera is a direct child, its local transform is what we need to preserve.
                this.originalCameraPos.copy(this.activeCamera.position);
                this.originalCameraQuat.copy(this.activeCamera.quaternion);
            }
            if (getCurrentConfig().DEBUG_MODE) {
                console.log(`Renderer: Triggering camera shake - Intensity: ${this.shakeIntensity.toFixed(2)}, Duration: ${duration}`);
            }
        }
    }

    applyConfiguration(config) {
        if (!config) return;
        const C = config;
        // Apply Post-Processing Settings
        let ppChanged = false;
        if (this.bloomPass) {
            if (this.bloomPass.enabled !== C.GRAPHICS_SETTINGS.enableBloom) {
                this.bloomPass.enabled = C.GRAPHICS_SETTINGS.enableBloom;
                ppChanged = true;
            }
            // Optionally make strength/radius/threshold configurable too
            // this.bloomPass.strength = C.GRAPHICS_SETTINGS.bloomStrength;
            // this.bloomPass.radius = C.GRAPHICS_SETTINGS.bloomRadius;
            // this.bloomPass.threshold = C.GRAPHICS_SETTINGS.bloomThreshold;
        }
        if (this.vignettePass) {
            if (this.vignettePass.enabled !== C.GRAPHICS_SETTINGS.enableVignette) {
                this.vignettePass.enabled = C.GRAPHICS_SETTINGS.enableVignette;
                ppChanged = true;
            }
            // Optionally make offset/darkness configurable
            // this.vignettePass.uniforms['offset'].value = C.GRAPHICS_SETTINGS.vignetteOffset;
            // this.vignettePass.uniforms['darkness'].value = C.GRAPHICS_SETTINGS.vignetteDarkness;
        }
        if(C.DEBUG_MODE) console.log("PhysicsEngine: Configuration applied."); // Add log
    }

    initialize(canvas) {
        if (!canvas) {
            console.error("Renderer: Canvas element not provided!");
            return;
        }

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB); // Initial background, skybox will cover it

        // --- Renderer ---
        this.renderer = new THREE.WebGLRenderer({ /* ... options ... */
            canvas: canvas,
            antialias: true,
            logarithmicDepthBuffer: false,
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // --- Shadow Configuration ---
        this.renderer.shadowMap.enabled = true; // Ensure enabled
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Good balance

        // Optional: Adjust output encoding for better color (especially with PBR materials in GLTF)
        this.renderer.outputColorSpace = THREE.SRGBColorSpace; // Correct colorspace
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping; // Nice filmic look
        this.renderer.toneMappingExposure = 1.0; // Adjust exposure if needed


        // ... Debug Camera, OrbitControls setup ...
        this.debugCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.debugCamera.position.set(3, 3, 5);
        this.debugCamera.lookAt(0, 0, 0);

        // --- Orbit Controls ---
        this.controls = new OrbitControls(this.debugCamera, canvas); // Use debug camera
        this.controls.enableDamping = true; // Smooths out the controls
        this.controls.dampingFactor = 0.05;
        this.controls.screenSpacePanning = false; // Keep panning constrained
        this.controls.minDistance = 1;
        this.controls.maxDistance = 500;
        // this.controls.maxPolarAngle = Math.PI / 2; // Optional: Prevent camera going below ground

        // --- Initial Active Camera ---
        // Start with the debug camera being active
        this.setActiveCamera(this.debugCamera);

        // --- Axes Helper ---
        if (Config.DEBUG_MODE) {
            const axesHelper = new THREE.AxesHelper(5);
            this.scene.add(axesHelper);
        }

        // --- Event Listeners ---
        window.addEventListener('resize', this.onWindowResize.bind(this));
        canvas.addEventListener('webglcontextlost', this.onContextLost.bind(this), false);
        canvas.addEventListener('webglcontextrestored', this.onContextRestored.bind(this), false);

        // --- Post Processing Setup ---
        this.composer = new EffectComposer(this.renderer);

        // 1. Render Pass (Renders the scene)
        this.renderPass = new RenderPass(this.scene, this.activeCamera); // Use activeCamera initially
        this.composer.addPass(this.renderPass);

        // 2. Bloom Pass (Optional)
        this.bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            0.5, // strength (adjust)
            0.4, // radius (adjust)
            0.85 // threshold (adjust)
        );
        this.bloomPass.enabled = false; // Start disabled
        this.composer.addPass(this.bloomPass);

        // 3. Vignette Pass (Optional)
        this.vignettePass = new ShaderPass(VignetteShader);
        this.vignettePass.uniforms['offset'].value = 0.95; // Adjust darkness
        this.vignettePass.uniforms['darkness'].value = 0.8; // Adjust falloff
        this.vignettePass.enabled = false; // Start disabled
        this.composer.addPass(this.vignettePass);

        EventBus.on(EVENTS.DRONE_COLLISION, (data) => this.triggerCameraShake(data.intensity));

        if (Config.DEBUG_MODE) {
            console.log('Renderer: WebGL context, Debug Camera, and OrbitControls initialized.');
        }
    }

    setActiveCamera(camera) {
        if (camera instanceof THREE.Camera) {
            this.activeCamera = camera;
            this.onWindowResize(); // Update aspect ratio for the new camera
            if (this.renderPass) this.renderPass.camera = camera;
            if (this.composer) this.onWindowResize(); // Resize composer for new aspect ratio if needed

            if (Config.DEBUG_MODE) {
                console.log(`Renderer: Active camera set to ${camera.name || camera.type}`);
            }
            // If switching away from debug cam, maybe disable controls?
            if (this.controls) {
                this.controls.object = this.activeCamera; // Ensure controls point to the active camera
                this.controls.enabled = (this.activeCamera === this.debugCamera); // Only enable controls for debug cam
            }
        } else {
            console.error("Renderer: Invalid object passed to setActiveCamera.", camera);
        }
    }

    addObject(object) {
        if (object instanceof THREE.Object3D) {
            this.scene.add(object);
        } else {
            console.warn("Renderer: Attempted to add non-Object3D to scene:", object);
        }
    }

    removeObject(object) {
        if (object instanceof THREE.Object3D) {
            this.scene.remove(object);
        } else {
            console.warn("Renderer: Attempted to remove non-Object3D from scene:", object);
        }
    }

    render(deltaTime) { // <<< Pass deltaTime to render
        if (!this.renderer || !this.scene || !this.activeCamera) {
            return;
        }

        // Apply Camera Shake if active
        if (this.shakeDuration > 0 && this.activeCamera) {
            const currentIntensity = this.shakeIntensity * (this.shakeDuration / 0.3); // Scale intensity based on remaining duration

            // Calculate random offsets based on intensity
            const posOffset = new THREE.Vector3(
                (Math.random() - 0.5) * 2 * this.shakeMaxOffset * currentIntensity,
                (Math.random() - 0.5) * 2 * this.shakeMaxOffset * currentIntensity,
                (Math.random() - 0.5) * 2 * this.shakeMaxOffset * currentIntensity
            );
            const rotOffset = new THREE.Euler(
                (Math.random() - 0.5) * 2 * this.shakeMaxAngle * currentIntensity,
                (Math.random() - 0.5) * 2 * this.shakeMaxAngle * currentIntensity,
                (Math.random() - 0.5) * 2 * this.shakeMaxAngle * currentIntensity,
                'XYZ' // Specify Euler order
            );
            const rotQuatOffset = new THREE.Quaternion().setFromEuler(rotOffset);

            // Apply offsets to the camera's LOCAL transform relative to its original state
            this.activeCamera.position.copy(this.originalCameraPos).add(posOffset);
            this.activeCamera.quaternion.copy(this.originalCameraQuat).multiply(rotQuatOffset);


            // Decay shake effect
            this.shakeDuration -= deltaTime;
            // Gradually reduce intensity as well (optional, decay mainly handles duration)
            // this.shakeIntensity -= this.shakeDecayRate * deltaTime * this.shakeIntensity;
            this.shakeIntensity = Math.max(0, this.shakeIntensity - this.shakeDecayRate * deltaTime);


            if (this.shakeDuration <= 0) {
                // Reset camera to original local transform when shake ends
                this.activeCamera.position.copy(this.originalCameraPos);
                this.activeCamera.quaternion.copy(this.originalCameraQuat);
                this.shakeIntensity = 0;
                this.shakeDuration = 0; // Ensure it's exactly 0
            }
        }

        // IMPORTANT: Update controls if damping is enabled
        if (this.controls && this.controls.enabled) {
            this.controls.update(); // Assumes controls might need deltaTime later? OrbitControls usually handles internally.
        }

        if (this.composer) {
            // Update controls if needed (before composer render)
            if (this.controls && this.controls.enabled) {
                this.controls.update();
            }
            // Render using the composer
            this.composer.render(deltaTime);
        } else {
            // Fallback or if composer not initialized
            if (this.controls && this.controls.enabled) {
                this.controls.update();
            }
            this.renderer.render(this.scene, this.activeCamera);
        }
    }

    onWindowResize() {
        if (!this.renderer) return;

        const width = window.innerWidth;
        const height = window.innerHeight;

        if (this.activeCamera) {
            this.activeCamera.aspect = width / height;
            this.activeCamera.updateProjectionMatrix();
        }
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // <<< Resize Composer and Passes >>>
        if (this.composer) {
            this.composer.setSize(width, height);
        }
        if (this.bloomPass) {
            // Bloom pass often needs explicit resize or uses renderer size
            this.bloomPass.setSize(width, height);
        }
    }

    onContextLost(event) {
        event.preventDefault(); // Prevent browser default behavior
        console.warn('Renderer: WebGL context lost!');
        // Optionally: Stop the simulation loop, show a message to the user
        this.engine?.stop(); // Access engine safely
        // You might need to release resources here if not handled automatically
    }

    onContextRestored(event) {
        console.log('Renderer: WebGL context restored!');
        // Reinitialize WebGL state (textures, shaders, etc.)
        // This can be complex. Often requires re-running parts of the initialization.
        // For now, a page reload might be the simplest recovery strategy.
        alert("WebGL context restored. Please reload the page if rendering issues persist.");
        // Or try to re-initialize parts of the renderer/engine if feasible:
        // this.initialize(this.renderer.domElement); // Re-run init on the same canvas
        // this.engine?.start();
    }

    dispose() {
        // Remove event listeners
        window.removeEventListener('resize', this.onWindowResize.bind(this));
        if (this.renderer && this.renderer.domElement) {
            this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLost.bind(this));
            this.renderer.domElement.removeEventListener('webglcontextrestored', this.onContextRestored.bind(this));
        }

        // Dispose Three.js objects (important for complex scenes)
        // This requires iterating through scene children, geometries, materials, textures
        // For now, basic cleanup:
        this.controls?.dispose();
        this.renderer?.dispose();


        this.composer = null; // Clear references
        this.renderPass = null;
        this.bloomPass = null;
        this.vignettePass = null;

        if (Config.DEBUG_MODE) {
            console.log('Renderer: Disposed resources.');
        }
    }
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

export default Renderer;