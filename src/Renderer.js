// src/Renderer.js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'; // Import OrbitControls
import Config from './Config.js';

class Renderer {
    constructor(engine) {
        this.engine = engine;
        this.renderer = null;
        this.scene = null;
        this.activeCamera = null; // The camera currently used for rendering
        this.debugCamera = null;  // A separate camera for debugging
        this.controls = null;     // OrbitControls instance

        if (Config.DEBUG_MODE) {
            console.log('Renderer: Initialized');
        }
    }

    initialize(canvas) {
        if (!canvas) {
            console.error("Renderer: Canvas element not provided!");
            return;
        }

        // --- Scene ---
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB); // Sky blue background
        // Optional: Add fog for depth perception later
        // this.scene.fog = new THREE.Fog(0x87CEEB, 10, 100);

        // --- Renderer ---
        this.renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            antialias: true,
            logarithmicDepthBuffer: false, // Set to true only if z-fighting issues occur with large scenes
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        // Enable shadows (will be configured in Phase 6 by World/Lights)
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Softer shadows

        // --- Debug Camera ---
        this.debugCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.debugCamera.position.set(3, 3, 5); // Place camera back and up
        this.debugCamera.lookAt(0, 0, 0);       // Look at the scene origin

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


        if (Config.DEBUG_MODE) {
            console.log('Renderer: WebGL context, Debug Camera, and OrbitControls initialized.');
        }
    }

    setActiveCamera(camera) {
        if (camera instanceof THREE.Camera) {
            this.activeCamera = camera;
            this.onWindowResize(); // Update aspect ratio for the new camera
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

    render() {
        if (!this.renderer || !this.scene || !this.activeCamera) {
            return;
        }

        // IMPORTANT: Update controls if damping is enabled
        if (this.controls && this.controls.enabled) {
            this.controls.update();
        }

        this.renderer.render(this.scene, this.activeCamera);
    }

    onWindowResize() {
        if (!this.activeCamera || !this.renderer) return;

        const width = window.innerWidth;
        const height = window.innerHeight;

        this.activeCamera.aspect = width / height;
        this.activeCamera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // if (Config.DEBUG_MODE) {
        //     console.log('Renderer: Handled window resize.');
        // }
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

        if (Config.DEBUG_MODE) {
            console.log('Renderer: Disposed resources.');
        }
    }
}

export default Renderer;