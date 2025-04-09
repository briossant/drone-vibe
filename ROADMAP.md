## Professional Roadmap: Web-Based FPV Drone Simulator (Static Phase)

**Project Goal:** Develop a foundational, static, web-based FPV drone simulator using Three.js and a JavaScript physics engine (cannon-es), adhering to vanilla JS principles (no frameworks) and designed for future integration into an existing Node.js application.

**Guiding Principles:**

*   **Modularity & Maintainability:** Implement a clear separation of concerns using ES6 Modules. Code should be well-commented and organized for future extension and debugging.
*   **Performance Optimization:** Design with performance in mind from the outset, particularly concerning physics calculations, rendering calls, and memory management.
*   **Realistic Simulation (Iterative):** Aim for a believable FPV flight feel, acknowledging that achieving high fidelity is an iterative tuning process.
*   **Configuration Driven:** Parameterize key simulation aspects (physics constants, control sensitivity, drone properties) for easier tuning and potential future user customization.
*   **Testability:** Structure code to allow for potential unit/integration testing, even without a formal testing framework initially.

---

### Phase 0: Project Initialization & Environment Setup (Est. 0.5 - 1 Day)

*   **Tasks:**
  *   Establish project directory structure (e.g., `/src`, `/lib`, `/assets`, `/public`).
  *   Initialize Git repository and establish branching strategy (e.g., `main`, `develop`).
  *   Create base HTML (`index.html`) with `<canvas>` and necessary containers (e.g., for OSD).
  *   Create basic CSS (`style.css`) for layout and styling.
  *   Setup local development environment (recommend using a simple local server like `npx serve` or `live-server` for proper module loading and asset requests).
  *   Include/Install core dependencies:
    *   Three.js (via CDN, download, or npm if using a build step later)
    *   cannon-es (via CDN, download, or npm)
  *   Create main application entry point (`src/main.js`).
  *   Define core module structure stubs (e.g., `SimulatorEngine.js`, `Renderer.js`, `PhysicsEngine.js`, `InputManager.js`, `UIManager.js`, `Drone.js`, `World.js`, `Config.js`, `Utils.js`).
  *   Implement basic `SimulatorEngine` with `requestAnimationFrame` loop structure and delta time calculation.
*   **Deliverables:**
  *   Functional project structure served locally.
  *   Empty canvas element visible in the browser.
  *   Basic requestAnimationFrame loop running (verifiable via console logs).
  *   Version control setup.
*   **Key Considerations:** Consistency in code style (consider ESLint/Prettier setup), choice of module loading strategy (native ES6 modules recommended).

---

### Phase 1: Core Rendering Pipeline & Basic Scene (Est. 1 - 2 Days)

*   **Tasks:**
  *   Implement `Renderer` module:
    *   Initialize `THREE.WebGLRenderer`, attach to canvas, handle resizing.
    *   Initialize `THREE.Scene`.
    *   Initialize basic lighting (`THREE.AmbientLight`, `THREE.DirectionalLight`).
    *   Initialize a default `THREE.PerspectiveCamera` and `OrbitControls` (from Three.js examples) for debugging/initial navigation.
    *   Integrate `Renderer.render()` call into the `SimulatorEngine` loop.
  *   Implement `World` module (initial):
    *   Create and add a static ground plane mesh (`THREE.PlaneGeometry`, `THREE.MeshStandardMaterial`) to the scene via the `Renderer`.
  *   Implement basic error handling for WebGL context loss.
*   **Deliverables:**
  *   A 3D scene displaying a lit ground plane.
  *   Ability to navigate the scene using OrbitControls.
  *   Renderer adapts correctly to window resize events.
*   **Testing:** Verify rendering quality, lighting, navigation controls, resize handling.

---

### Phase 2: Physics Engine Integration & Synchronization (Est. 2 - 3 Days)

*   **Tasks:**
  *   Implement `PhysicsEngine` module:
    *   Initialize `CANNON.World`, set gravity.
    *   Define physics materials (`CANNON.Material`) for ground and default objects.
    *   Define contact materials (`CANNON.ContactMaterial`) for interactions (friction, restitution).
    *   Integrate `physicsWorld.step()` call into the `SimulatorEngine` loop, using calculated delta time.
  *   Update `World` module:
    *   Add a corresponding static `CANNON.Body` (e.g., `CANNON.Plane`) for the ground plane to the `PhysicsEngine`.
  *   Create a simple dynamic test object (e.g., a Cube):
    *   Add `THREE.Mesh` to the `Renderer`.
    *   Add corresponding `CANNON.Body` (`CANNON.Box`) to the `PhysicsEngine`.
  *   Implement physics-to-visual synchronization logic:
    *   Maintain a mapping between visual objects (`THREE.Mesh`) and physics bodies (`CANNON.Body`).
    *   After `physicsWorld.step()`, iterate through mapped dynamic objects and update `mesh.position` and `mesh.quaternion` from `body.position` and `body.quaternion`.
*   **Deliverables:**
  *   A dynamic cube object that falls under gravity and collides realistically with the ground plane.
  *   Clear separation between visual representation and physics simulation.
  *   Demonstrable synchronization working correctly.
*   **Testing:** Verify gravity effect, collision detection, object resting state, synchronization accuracy. Debug potential "jitter" or misalignment.

---

### Phase 3: Drone Entity Implementation (Physical & Visual) (Est. 2 - 3 Days)

*   **Tasks:**
  *   Implement `Drone` module:
    *   Define drone properties (mass, inertia tensor placeholder, physical dimensions) potentially in `Config.js`.
    *   Create the drone's visual representation (`THREE.Object3D`, initially a simple group of meshes like boxes/cylinders) and add it via the `Renderer`.
    *   Create the drone's physics body (`CANNON.Body`, likely a compound shape or simplified box/sphere initially) with correct mass and inertia properties. Add it to the `PhysicsEngine`.
    *   Establish the link for synchronization between the drone's visual and physical representations.
    *   Implement `Drone.update(deltaTime)` method stub.
  *   Implement `AssetLoader` utility (basic): Stub out functions for loading GLTF models and textures, even if not used immediately.
*   **Deliverables:**
  *   A drone object (visual + physical) exists within the simulation world.
  *   The drone falls realistically due to gravity and rests on the ground plane.
  *   Drone's visual position/orientation updates based on its physics body.
*   **Testing:** Verify drone spawns correctly, falls as expected, collides with the ground, synchronization works. Check console for physics-related warnings (e.g., inertia tensor issues).

---

### Phase 4: Input Handling & Basic Flight Control Logic (Est. 3 - 4 Days)

*   **Tasks:**
  *   Implement `InputManager` module:
    *   Add event listeners for keyboard (`keydown`, `keyup`).
    *   Map specific keys to FPV control axes (Roll, Pitch, Yaw, Thrust). Define mapping in `Config.js`.
    *   Store the current state of each control axis (e.g., -1 to 1 for rates, 0 to 1 for thrust).
    *   Provide getter methods for other modules to retrieve the current control state.
  *   Implement basic Flight Controller (FC) logic within the `Drone` module's `update` method:
    *   Read current control state from `InputManager`.
    *   Translate control inputs into *basic* forces and torques. (e.g., Thrust input applies vertical force, Roll input applies torque around the drone's local X-axis). Use `body.applyLocalForce()` and `body.applyLocalTorque()`.
    *   Define initial force/torque multipliers in `Config.js`.
  *   Implement the FPV Camera:
    *   Create a `THREE.PerspectiveCamera` within the `Drone` module.
    *   Attach the FPV camera as a child of the drone's visual `Object3D`, positioned and oriented correctly (slightly forward, potentially tilted up).
    *   Update the `Renderer` to use the drone's FPV camera for rendering instead of the debug OrbitControls camera.
*   **Deliverables:**
  *   Keyboard inputs directly influence the drone's movement (apply forces/torques).
  *   The view renders from the drone's FPV camera perspective.
  *   Basic, albeit likely unstable and unrealistic, flight control is possible.
*   **Testing:** Verify key mappings, check if forces/torques are applied in the correct directions relative to the drone, confirm camera perspective and attachment.

---

### Phase 5: Flight Model Refinement & OSD Implementation (Est. 4 - 6 Days+ - Iterative)

*   **Tasks:**
  *   **Flight Model Tuning (Core Loop):**
    *   Implement basic stabilization (Rate Mode): Apply angular damping (`body.angularDamping`) or implement explicit counter-torques proportional to angular velocity to simulate gyroscopic stability.
    *   Implement linear damping (`body.linearDamping`) or custom drag forces to simulate air resistance.
    *   Refine force/torque calculations: Implement a more realistic mapping from input rates/thrust to motor outputs/aerodynamic forces (this is complex, start simple and iterate).
    *   Tune `CANNON.Body` parameters: Adjust mass, inertia tensor (critical for rotational behavior), damping values, force multipliers iteratively based on flight feel. Use `Config.js` extensively.
    *   Consider PID controllers (optional, advanced): Implement PID loops for stabilizing angular rates if simple damping isn't sufficient for desired feel.
  *   Implement `UIManager` module:
    *   Select DOM elements designated for OSD display.
    *   Implement `UIManager.update(droneState)` method.
  *   Integrate OSD:
    *   In the main loop, pass relevant drone state (position, velocity, orientation, input state) from the `Drone` or `PhysicsEngine` to the `UIManager`.
    *   Update OSD DOM elements with formatted telemetry data (e.g., altitude, speed, attitude indicator (basic), input values).
*   **Deliverables:**
  *   A significantly more stable and controllable flight experience approaching an FPV "feel".
  *   Key flight parameters (mass, damping, control sensitivity) externalized to `Config.js`.
  *   A functional basic OSD displaying real-time flight telemetry.
*   **Testing:** Extensive flight testing. Does it *feel* right? Is it too twitchy? Too sluggish? Does it drift unrealistically? Is OSD data accurate? Iteratively adjust config values and FC logic.

---

### Phase 6: Environment Enhancement & Asset Integration (Est. 3 - 5 Days)

*   **Tasks:**
  *   Enhance `World` module:
    *   Add more complex static geometry (e.g., simple buildings, walls, gates) with both `THREE.Mesh` and corresponding `CANNON.Body` representations (use `CANNON.Box`, `CANNON.ConvexPolyhedron` or compound shapes). Ensure proper collision setup.
    *   Implement a Skybox using `THREE.CubeTextureLoader`.
  *   Refine `AssetLoader`: Implement actual loading logic for GLTF models using `THREE.GLTFLoader`.
  *   Update `Drone` module:
    *   Load a proper 3D drone model (GLTF format) using the `AssetLoader`.
    *   Replace the simple placeholder visual with the loaded model.
    *   Adjust the drone's `CANNON.Body` shape/size/inertia to better, though perhaps simplified, approximate the loaded model's form factor.
  *   Improve Lighting & Shadows:
    *   Configure directional light to cast shadows (`light.castShadow = true`).
    *   Enable shadow maps in the renderer (`renderer.shadowMap.enabled = true`).
    *   Configure ground and objects to receive shadows (`mesh.receiveShadow = true`) and the drone to cast shadows (`droneVisual.castShadow = true`). Optimize shadow map resolution/type for performance.
*   **Deliverables:**
  *   A more visually interesting environment with obstacles for interaction.
  *   A detailed 3D model representing the drone.
  *   Basic shadows improving scene depth and realism.
  *   Functional collision with new environment obstacles.
*   **Testing:** Verify asset loading, check model scaling/orientation, test collision with new obstacles, evaluate shadow quality and performance impact.

---

### Phase 7: Polish, UX, & Refinement (Est. 3 - 5 Days)

*   **Tasks:**
  *   Implement Reset Functionality: Add a mechanism (e.g., key press) to reset the drone's position, velocity, and orientation to a starting state.
  *   Implement Gamepad Support: Extend `InputManager` to detect and handle input from gamepads using the Gamepad API, mapping axes/buttons to FPV controls. Provide configuration options.
  *   Add Basic Audio Feedback (Optional): Integrate simple sound effects (e.g., motor hum, collision sounds) using the Web Audio API.
  *   Code Review & Refactoring: Review existing code for clarity, efficiency, and adherence to principles. Refactor complex sections.
  *   Performance Profiling: Use browser developer tools to profile CPU and GPU usage. Identify bottlenecks in physics, rendering, or JavaScript execution and optimize.
  *   Cross-Browser Testing (Basic): Test functionality in latest versions of major browsers (Chrome, Firefox, Safari, Edge).
*   **Deliverables:**
  *   Gamepad control option.
  *   Convenient reset function.
  *   Improved user experience through feedback (audio optional).
  *   Optimized performance based on profiling.
  *   Codebase reviewed and refined for quality.
*   **Testing:** Test reset logic thoroughly, verify gamepad mappings and responsiveness across different controllers if possible, check audio playback, measure performance improvements, confirm basic functionality in target browsers.

---

### Phase 8: Static Build & Integration Preparation (Est. 1 Day)

*   **Tasks:**
  *   Finalize static asset organization (`/public` directory).
  *   Ensure all paths and dependencies work correctly when served as static files.
  *   Create comprehensive `README.md` documentation detailing setup, architecture, configuration, and controls.
  *   Document the module interfaces and data flow clearly for future Node.js integration.
  *   Identify potential points of interaction for a future backend (e.g., loading/saving settings, user profiles, track data).
*   **Deliverables:**
  *   A clean, runnable static build of the simulator.
  *   Comprehensive project documentation.
  *   Clear plan/documentation outlining potential future integration points.
*   **Testing:** Deploy the static build to a simple static host (like GitHub Pages or Netlify) or serve locally and verify full functionality.