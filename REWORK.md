Based on the full project context previously provided (including file structure, file contents for all modules like `main.js`, `StateManager.js`, `EventBus.js`, `SimulatorEngine.js`, `MenuManager.js`, `Drone.js`, `World.js`, `defaultConfig.js`, `README.md`, etc.), perform the following major updates and refactoring:

**Overall Goal:** Enhance the project's structure for better scalability and maintainability, and introduce significant feature updates related to camera control and map generation. Ensure all changes adhere to the established event-driven architecture using `EventBus` and the state management pattern via `StateManager`.

**Task 1: File Organization Rework**

1.  **Analyze & Propose:** Examine the current file structure within the `src/` directory.
2.  **Goal:** Improve organization by grouping files based on features or domains rather than a flat list. This aims for better discoverability and modularity as the project grows.
3.  **Suggested Structure (Adapt as appropriate based on analysis):**
    *   `src/core/` (e.g., `SimulatorEngine.js`, `PhysicsEngine.js`, `Renderer.js`)
    *   `src/simulation/` (e.g., `Drone.js`, `FlightController.js`, `World.js`, `ProceduralWorldGenerator.js` (new))
    *   `src/ui/` (e.g., `MenuManager.js`, `OSDManager.js`, `UIComponentFactory.js`)
    *   `src/states/` (Keep as is or move under `src/core/` or `src/app/`)
    *   `src/config/` (e.g., `Config.js`, `ConfigManager.js`, `defaultConfig.js`)
    *   `src/managers/` (Could potentially house `StateManager`, `ConfigManager`, `InputManager` if not placed elsewhere)
    *   `src/utils/` (e.g., `EventBus.js`, `Utils.js`, `AssetLoader.js`)
    *   `src/app.js` or `src/main.js` (Entry point)
4.  **Implement:**
    *   Create the new directories within `src/`.
    *   Move the existing `.js` files into the appropriate new directories based on your proposed structure.
    *   **Crucially:** Update **all** `import` statements across **all** modified and related files to reflect the new file paths.
    *   Verify the application still runs after reorganization.

**Task 2: FPV Camera Angle Control**

1.  **Goal:** Allow the user to adjust the default upward/downward tilt angle of the FPV camera via the in-simulation settings menu.
2.  **Implementation Steps:**
    *   **Configuration:** Add a new setting, `FPV_CAMERA_ANGLE_DEG`, to `src/config/defaultConfig.js` (e.g., default value `15` degrees).
    *   **UI:** In `src/ui/MenuManager.js`, modify `_populateSettingsPanels` to add a new control (likely a slider using `UIComponentFactory.createSlider`) within the "Fly Settings" panel (`#fly-settings-content`). This slider should control the `FPV_CAMERA_ANGLE_DEG` configuration value.
    *   **Application:** Modify `src/simulation/Drone.js`:
        *   In the `applyConfiguration` method, read the `FPV_CAMERA_ANGLE_DEG` value from the passed `config` object.
        *   Convert the angle from degrees to radians (`angleRad = THREE.MathUtils.degToRad(config.FPV_CAMERA_ANGLE_DEG)`).
        *   Set the initial *local* X-axis rotation of the `this.fpvCamera` object. **Important:** This rotation should be relative to the drone's visual model. Ensure it doesn't conflict with existing camera positioning logic. You might need to adjust the initial `this.fpvCamera.rotation.set(0, 0, 0)` in the `initialize` method to use this configured angle instead, or apply it additively/replace the x-rotation in `applyConfiguration`.
    *   **Persistence:** Ensure the `applySettingsToEngine` call triggered by `EVENTS.APPLY_SETTINGS_CLICKED` correctly propagates this change to the `Drone` instance.

**Task 3: Procedural Map Generation**

1.  **Goal:** Replace the static obstacles defined in `World.js` with a procedurally generated environment, including terrain, scattered props (trees, rocks), and racing gates.
2.  **Implementation Steps:**
    *   **Refactor `World.js`:** Modify or replace `src/simulation/World.js`. It might become a coordinator or be replaced entirely by a generator class.
    *   **Create `ProceduralWorldGenerator.js` (or similar):** Create a new module (e.g., `src/simulation/ProceduralWorldGenerator.js`).
    *   **Terrain Generation:**
        *   Implement logic within the generator to create a terrain mesh (e.g., using a `THREE.PlaneGeometry` with vertices displaced by a noise function like Perlin or Simplex noise).
        *   Generate a corresponding `CANNON.Heightfield` physics body for the terrain. Consider performance implications for large terrains (using `cannon-es-debugger` can help visualize). *Self-correction: For better physics performance with complex terrain, integration with `three-mesh-bvh` for the visual mesh and using multiple simpler CANNON shapes or a less detailed Heightfield might be necessary later, but start with a basic Heightfield.*
        *   Ensure the visual terrain mesh and physics Heightfield are added to the `Renderer` and `PhysicsEngine` respectively.
    *   **Prop Placement:**
        *   Implement logic to procedurally place props (trees, rocks) on the generated terrain. This requires:
            *   **Assets:** Placeholder geometry (e.g., `THREE.Cone` for trees, `THREE.Sphere` or `THREE.Icosahedron` for rocks) initially. *Acknowledge that proper GLTF models for these props will need to be loaded via `AssetLoader` later.*
            *   **Placement Logic:** Determine positions based on terrain height, slope, noise patterns, etc. Avoid placing props underwater or on excessively steep slopes.
            *   **Physics:** Create corresponding `CANNON.Body` objects (e.g., `CANNON.Cylinder` for tree trunks, `CANNON.Sphere` for rocks) for each prop instance and add them to the `PhysicsEngine`. Mark them as static.
            *   Add visual representations to the `Renderer`. Consider using `THREE.InstancedMesh` for performance if placing many identical props.
    *   **Gate Placement:**
        *   Implement logic to place racing gates procedurally. Reuse the `createObstacle_Gate` logic (perhaps moved to the generator or a `GateFactory`) but determine positions/rotations algorithmically (e.g., along a spline, based on noise, specific patterns).
        *   Ensure both visual (`THREE.Group`) and physics (`CANNON.Body` compound shape) representations are created and added correctly.
    *   **Configuration:** Add relevant parameters to `defaultConfig.js` for controlling generation (e.g., `WORLD_SEED`, `TERRAIN_SCALE`, `PROP_DENSITY`, `GATE_COUNT`). `ConfigManager` should load these, and the generator should use them.
    *   **Integration:** Ensure the `SimulatorEngine` correctly initializes and uses the new world generation logic during the `LoadingState`.

**Final Steps:**

1.  **Update Documentation:** Modify the `README.md` file extensively to reflect the new file structure, the procedural world generation approach, and the new camera angle setting.
2.  **Output:** Provide the complete content of all **new** and **modified** `.js` files.

Ensure all changes integrate seamlessly with the existing EventBus, StateManager, and ConfigManager patterns. Maintain logging for debug mode.