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

---

## Phase 9: Main Menu Implementation (Est. 2 - 4 Days)

*   **Goal:** Create a distinct main menu screen that appears on application load, acting as the entry point to the simulator and settings.
*   **Tasks:**
    *   **UI Design & Structure:**
        *   Design the visual layout of the main menu (e.g., background, title, buttons).
        *   Create necessary HTML elements (outside the `<canvas>` and `#osd`) for the main menu overlay. Style them using CSS (`display: block/none` to show/hide).
    *   **State Management:**
        *   Modify `main.js` or `SimulatorEngine` to initially display the main menu instead of immediately starting the simulation initialization.
        *   Implement a simple state machine (e.g., `MENU`, `LOADING`, `SIMULATING`) to manage application flow.
    *   **Menu Options & Actions:**
        *   Add buttons like "Fly", "Settings", "Controls", (optional: "Help").
        *   "Fly" button: Hides the main menu, triggers the asset loading and simulator initialization process (async `engine.initialize()` then `engine.start()`), and transitions the state to `LOADING` then `SIMULATING`.
        *   "Settings" button: Placeholder for linking to in-sim settings later.
        *   "Controls" button: Could show a static overlay displaying default controls, or link to the in-sim controls configuration later.
    *   **Background:** Keep the WebGL canvas hidden or display a static background image/scene while the main menu is active. Avoid initializing the full 3D scene until "Fly" is clicked.
*   **Deliverables:**
    *   A functional main menu screen displayed on startup.
    *   Clicking "Fly" successfully initiates the loading and launching of the simulator.
    *   Basic structure for adding other menu options (Settings, Controls).
*   **Key Considerations:** Keep the main menu visually clean and responsive. The transition from menu to simulator loading needs clear visual feedback (e.g., a loading indicator replaces the menu).

---

## Phase 10: In-Sim Settings Menu & Configuration Management (Est. 3 - 4 Days)

*   **Goal:** Implement the foundational UI for the *in-simulation* settings menu (accessed while flying) and the logic to manage configuration changes.
*   **Tasks:**
    *   **In-Sim Menu UI:**
        *   Design a simple overlay for the in-sim settings menu (distinct from the main menu).
        *   Use HTML/CSS for the container and main sections (e.g., "Resume", "Settings", "Controls", "Restart Flight", "Main Menu").
        *   Implement logic (likely in `UIManager` or a dedicated `InGameMenuManager`) to toggle this menu's visibility (e.g., via 'Esc' key).
    *   **Simulation Pause:** Ensure the simulation (physics stepping, drone updates, input processing *for flight*) pauses when the in-sim menu is open and resumes correctly. Release pointer lock.
    *   **Configuration Handling:**
        *   Refactor `Config.js`: Identify user-configurable settings. Create `defaultConfig.js` and `userConfig` object.
        *   Implement loading settings: On *application start* (before the main menu potentially), load saved `userConfig` from `localStorage` or use defaults.
        *   Implement saving settings: Provide "Apply/Save" mechanism within the in-sim menu to store `userConfig` to `localStorage`.
        *   Implement applying settings: Create functions in relevant modules (`Drone`, `PhysicsEngine`, `InputManager`, `Renderer`) to update parameters based on the *current* `userConfig`.
*   **Deliverables:**
    *   A functional in-sim menu overlay accessible during flight.
    *   Simulation pauses correctly when the in-sim menu is active.
    *   Settings are loaded at application start and can be saved/applied from the in-sim menu.
    *   Core modules ready to accept updated configuration values.
    *   Options to "Resume", "Restart Flight" (calling `drone.reset()`), and "Return to Main Menu" (stopping simulation, showing main menu).
*   **Key Considerations:** Ensure clear distinction between main menu and in-sim menu. Pause/resume logic needs to be robust. `localStorage` is simple but check limitations if complex config is needed.

---

## Phase 11: Implementing Settings Panels (Fly, Physics, Controls) (Est. 4 - 6 Days)

*   **Goal:** Populate the *in-sim* menu sections with interactive UI elements to allow users to modify key simulator parameters.
*   **Tasks:**
    *   **UI Element Creation:** Develop helper functions (or use a minimal library) within `UIManager`/`InGameMenuManager` to create common UI elements (sliders, checkboxes, dropdowns, input fields, button mappings).
    *   **Populate "Fly Settings":** FPV FOV, Roll/Pitch/Yaw sensitivity, (Optional) RC Rates/Expo inputs.
    *   **Populate "Physics Settings":** Drone Mass, Linear/Angular Damping, Gravity, (Optional/Advanced) Force/Torque multipliers.
    *   **Populate "Controls Settings":** Keyboard remapping UI, Gamepad Mode selection (dropdown), Axis Inversion checkboxes, Deadzone slider, Button remapping UI (listening for presses).
    *   **Integration:** Connect UI element changes to update the `userConfig` object in memory. Ensure the "Apply/Save" mechanism triggers the application of these settings to the running simulation.
*   **Deliverables:**
    *   Functional UI elements within the in-sim menu for Fly, Physics, and Controls settings.
    *   User changes in the menu update the simulator's behavior after applying/saving.
    *   Settings persist across browser sessions (via `localStorage`).
*   **Key Considerations:** Avoid overwhelming the user; start with the most impactful settings. Provide clear labels. Real-time application vs. Apply button (Apply is often safer). Input validation for number fields. Remapping UI can be complex; start simply.

---

## Phase 12: Flight Model Enhancement & Feel (Est. 4 - 7 Days+)

*   **Goal:** Improve the realism and "feel" of the drone flight, moving beyond basic rate control and damping.
*   **Tasks:**
    *   **PID Controller Implementation (Rate Mode):** Implement PID controllers within the `Drone`'s `applyControls` or a dedicated `FlightController` class to stabilize *angular velocity* based on user input. Tune P, I, and D gains iteratively (make gains potentially configurable later - Advanced Physics).
    *   **Angle/Horizon Mode (Optional but Recommended):** Implement Angle mode (PID stabilizing *angle*) and/or Horizon mode (hybrid self-leveling). Requires integrating gravity vector awareness.
    *   **Air Resistance / Drag Model:** Implement more sophisticated drag forces beyond simple damping (e.g., proportional to velocity squared, potentially varying with orientation).
    *   **Thrust Curve / Motor Model:** Simulate a non-linear thrust curve (motors less efficient at extremes) and optionally motor response delay/ramp-up.
*   **Deliverables:**
    *   Significantly improved flight stability and responsiveness via PID control (Rate Mode).
    *   (Optional) Functional Angle/Horizon flight modes selectable via UI/Key.
    *   More realistic air resistance affecting drone movement.
    *   More realistic thrust/motor response simulation.
    *   Smoother, more believable flight characteristics overall.
*   **Key Considerations:** PID tuning is notoriously difficult and time-consuming; make it iterative. Aerodynamic simulation can become complex; start simple. Clearly separate flight modes in the code.

---

## Phase 13: UX, Visual & Feedback Polish (Est. 4 - 6 Days)

*   **Goal:** Enhance the user experience through better visual feedback, smoother transitions, and a more immersive interface.
*   **Tasks:**
    *   **Graphical OSD:** Replace/augment text OSD with graphical representations (HTML/CSS/SVG or canvas 2D). Implement graphical attitude indicator (artificial horizon), throttle/input gauges, flight mode display.
    *   **Loading Screen/Indicator:** Implement a user-friendly loading screen/progress indicator displayed between clicking "Fly" on the main menu and the simulator becoming interactive.
    *   **Collision Feedback:** Add subtle screen shake effect on collisions (camera movement) and optionally a brief visual glitch/static effect.
    *   **Post-Processing Effects (Optional):** Integrate Three.js post-processing (`EffectComposer`). Add subtle Bloom, Vignette, or Motion Blur. Make toggleable in a new "Graphics" section of the *in-sim* settings menu.
    *   **Smoother Reset/Transitions:** Implement a short fade-out/fade-in transition when resetting the drone or loading the level, instead of an instant jump.
*   **Deliverables:**
    *   A more visually appealing and informative graphical OSD.
    *   A proper loading screen experience.
    *   Visual feedback on collisions.
    *   (Optional) Toggleable post-processing effects enhancing visuals.
    *   Smoother drone reset and level loading sequences.
*   **Key Considerations:** Graphical OSD requires careful design and implementation. Post-processing impacts performance; profile carefully and make effects optional/configurable. Keep feedback noticeable but not overly distracting.

---

## Phase 14: Audio Integration (Est. 3 - 4 Days)

*   **Goal:** Add audio feedback to significantly increase immersion and provide crucial cues.
*   **Tasks:**
    *   **Audio Engine Setup:** Integrate the Web Audio API. Create a simple `AudioManager` class to handle loading, playing, and managing sounds.
    *   **Motor Sounds:** Implement looping motor hum sounds. Modulate pitch and volume based on average propeller speed / overall thrust. Consider subtle variations for acceleration/deceleration.
    *   **Collision Sounds:** Play different impact sounds based on collision intensity (relative velocity).
    *   **Wind Noise:** Implement looping wind sounds that increase in volume/intensity based on the drone's linear velocity.
    *   **UI Sounds:** Add subtle audio feedback for menu interactions (main menu and in-sim menu clicks, confirmations), Arm/Disarm actions.
    *   **Audio Settings:** Add options in the *in-sim* menu (new "Audio" section) to control master volume and toggle sound categories (motors, collisions, wind, UI).
*   **Deliverables:**
    *   Functional audio system using Web Audio API.
    *   Dynamic motor sounds responding to thrust.
    *   Collision and wind audio feedback based on physics state.
    *   UI sound effects for better interaction feedback.
    *   Volume/toggle controls in the settings menu.
*   **Key Considerations:** Finding good, royalty-free sound assets. Performance impact of audio (usually minor with Web Audio API). Balancing sound levels effectively is crucial for good UX.

---

## Phase 15: Content Expansion & Gameplay Elements (Est. 4 - 7 Days)

*   **Goal:** Add variety to the simulation environment and introduce simple gameplay mechanics.
*   **Tasks:**
    *   **Environment Variation:** Design and implement 1-2 alternative simple environments (e.g., indoor space, different obstacle layout). Create a mechanism on the **Main Menu** to select the environment before starting. Refactor `World.js` to support loading different scene definitions dynamically.
    *   **More Obstacle Types:** Add ramps, tunnels, or other challenging static geometry to environments.
    *   **Basic Race/Challenge Mode:** Implement simple waypoint/gate sequence system within environments. Add a timer (start/stop trigger gates). Display lap times/best times on the UI (potentially on OSD during race, summary screen after, or main menu).
    *   **Wind Simulation:** Implement a basic wind model (e.g., constant direction/strength or simple gusts). Apply wind force to the drone's physics body. Make wind configurable in the *in-sim* settings (e.g., off/low/medium/high).
    *   **Drone Presets:** Define 2-3 drone presets with different visual models (if available) and distinct physics parameters (mass, power, handling) loaded from configuration. Allow selection from the **Main Menu** before starting a flight.
*   **Deliverables:**
    *   Multiple selectable environments/layouts accessible from the main menu.
    *   A simple race timer/checkpoint system providing a basic gameplay loop.
    *   Basic, configurable wind simulation affecting flight dynamics.
    *   Selectable drone presets with differing characteristics available from the main menu.
*   **Key Considerations:** Main menu is the logical place for pre-flight selections (environment, drone). Keep initial gameplay loops simple. Environment loading needs careful management of assets and physics bodies. Wind needs careful balancing.

---

## Phase 16: Final Polish, Testing & Documentation (Est. 3 - 5 Days)

*   **Goal:** Perform final testing, optimize performance, clean up code, and update documentation.
*   **Tasks:**
    *   **Cross-Browser/Device Testing:** Test thoroughly on major browsers (Chrome, Firefox, Safari, Edge) and consider different input devices (various gamepads), ensuring menu navigation works correctly.
    *   **Performance Profiling & Optimization:** Use browser dev tools to identify and address bottlenecks (CPU: physics, complex JS; GPU: rendering, shadows, post-processing). Optimize draw calls, physics steps, menu interaction performance.
    *   **Bug Fixing:** Address any remaining bugs or inconsistencies found during testing, focusing on state transitions (main menu -> loading -> sim -> in-sim menu -> main menu).
    *   **Code Review & Refactoring:** Review codebase for clarity, consistency, maintainability. Refactor complex sections. Add comments and potentially JSDoc blocks where needed.
    *   **Update Documentation:** Update `README.md` and potentially create new documentation files covering:
        *   Application flow (including main menu).
        *   New features (in-sim menu, flight modes, audio, race mode, etc.).
        *   All configuration options (in-sim settings).
        *   Controls (including remapping instructions).
        *   How to use gameplay modes.
    *   **Final Build Check:** Ensure the static build runs correctly without errors from start to finish.
*   **Deliverables:**
    *   A stable, performant, and polished version of the simulator with a functional main menu.
    *   Addressed major bugs and inconsistencies, particularly around state management.
    *   Improved code quality and comments.
    *   Comprehensive, updated documentation reflecting all features.
*   **Key Considerations:** Allocate sufficient time for testing the complete user flow and fixing bugs related to state transitions. Performance optimization is an ongoing process. Clear documentation is crucial.