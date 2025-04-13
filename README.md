# Web FPV Drone Simulator

A web-based FPV (First-Person View) drone simulator built using Three.js and cannon-es, designed to run entirely in the browser. This project aims to create a realistic flight experience without requiring dedicated backend infrastructure for the core simulation.

## Core Philosophy

*   **Modularity:** Code is structured into logical modules/classes using ES6 `import`/`export` for better organization and maintainability, grouped into feature-based directories (e.g., `core`, `simulation`, `ui`, `managers`, `config`, `utils`).
*   **Separation of Concerns:** Key responsibilities like rendering (Three.js), physics simulation (cannon-es), input handling, UI management (Menus, OSD), state management, configuration, asset loading, and flight control are kept distinct.
*   **Event-Driven Communication:** Utilizes a central `EventBus` (Observer pattern) for loose coupling between modules. Modules communicate by emitting and listening to events rather than direct calls.
*   **State Management:** A dedicated `StateManager` controls the application's flow using the State pattern, encapsulating behavior specific to each state (Menu, Loading, Simulating, Paused).
*   **Configuration Driven:** Key simulation parameters (drone physics, control sensitivity, graphics settings, **FPV camera angle**, **world generation**) are managed via a configuration system (`ConfigManager`), allowing for easier tuning and user customization through `localStorage`.
*   **Performance:** Performance considerations are kept in mind, especially regarding physics calculations (Heightfield, potential InstancedMesh) and rendering optimizations.

## Key Features

*   Realistic(ish) FPV Flight Physics (Rate Mode PID Control)
*   Configurable Drone Parameters (Mass, Damping, Control Sensitivity, PID Gains)
*   **Procedural World Generation:** Creates unique environments on each load (or based on seed) including:
    *   Noise-based Terrain (`CANNON.Heightfield`)
    *   Procedurally placed props (Trees, Rocks - using placeholder geometry currently)
    *   Procedurally placed Racing Gates
*   Configurable FPV Camera (Field of View, **Upward Tilt Angle**)
*   On-Screen Display (OSD) for real-time telemetry.
*   Keyboard & Gamepad Support (Mode 2 Mapping, Configurable Deadzone/Inversion)
*   Pause Menu & In-Simulation Settings Configuration (Graphics, Fly, Physics, Controls) saved to `localStorage`.
*   Basic Visual Feedback (Shadows, Collision Camera Shake, Optional Post-Processing Effects).

## Architecture Design

The simulator is built around several key components communicating primarily via an `EventBus`, organized into the following structure:

*   `src/`
    *   `core/` (Core simulation loop, rendering, physics)
    *   `simulation/` (Drone logic, flight control, world generation)
    *   `ui/` (Menu, OSD, UI component creation)
    *   `managers/` (State, Config, Input management)
    *   `config/` (Default and runtime configuration)
    *   `utils/` (EventBus, AssetLoader, general utilities)
    *   `states/` (Application state classes)
    *   `main.js` (Entry point)

Key components and their responsibilities:

1.  **`src/main.js` (Application Entry Point & Orchestrator):**
    *   Initializes core managers (`ConfigManager`, `MenuManager`, `OSDManager`, `InputManager`, `StateManager`, `EventBus`).
    *   Sets up global browser event listeners (e.g., for pointer lock changes, Escape key) and delegates them to the `StateManager` or `EventBus`.
    *   Kicks off the initial application state via the `StateManager` (starting in `MenuState`).
    *   Contains the minimal application loop for updating the `StateManager`.

2.  **`src/utils/EventBus.js` (Event Hub - Observer Pattern):**
    *   A singleton module implementing the Observer pattern.
    *   Provides `on(eventName, listener)`, `off(eventName, listener)`, and `emit(eventName, data)` methods.
    *   Allows modules to subscribe to and broadcast events, decoupling direct dependencies.
    *   Defines constants for common event names (`EVENTS`).

3.  **`src/managers/StateManager.js` (State Machine - State Pattern):**
    *   A singleton manager responsible for the application's overall state (`MENU`, `LOADING`, `SIMULATING`, `PAUSED`).
    *   Uses dedicated state classes (e.g., `MenuState`, `LoadingState`, `SimulatingState`, `PausedState` located in `src/states/`) which encapsulate state-specific behavior and transitions.
    *   Handles transitions between states, calling `enter()` and `exit()` methods on state classes.
    *   Delegates handling of relevant global events (like 'Escape' key, pointer lock changes) to the *current* state object.

4.  **`src/ui/MenuManager.js` (UI Manager - Menus & Overlays):**
    *   A singleton manager responsible for controlling the visibility and interaction of all primary UI elements *except* the OSD.
    *   Manages the Main Menu, Loading Indicator, In-Simulation Menu/Panels, and Fade Overlay.
    *   Listens for user interactions (button clicks) within its managed elements.
    *   Emits application-level events via the `EventBus` in response to user actions (e.g., `EVENTS.FLY_BUTTON_CLICKED`, `EVENTS.RESUME_BUTTON_CLICKED`).
    *   Uses `src/ui/UIComponentFactory.js` to dynamically create settings controls (sliders, checkboxes) within the panels.

5.  **`src/ui/OSDManager.js` (UI Manager - On-Screen Display):**
    *   A singleton manager focused *solely* on the On-Screen Display (OSD) telemetry overlay.
    *   Initializes the OSD HTML structure.
    *   Listens for `EVENTS.SIMULATION_STATE_UPDATE` emitted by the `SimulatorEngine`.
    *   Updates the OSD DOM elements with real-time telemetry data (attitude, altitude, speed, inputs, armed status) based on the received simulation state.

6.  **`src/config/ConfigManager.js` (Configuration):**
    *   Singleton manager for loading/saving settings.
    *   Loads user settings from `localStorage` on startup, merging them with `src/config/defaultConfig.js`.
    *   Provides the current, merged configuration (`getCurrentConfig()`) to all modules.
    *   Saves user settings back to `localStorage` (triggered by `EVENTS.APPLY_SETTINGS_CLICKED`).
    *   Applies configuration changes to relevant engine modules (`applySettingsToEngine`), typically triggered after loading or saving.
    *   May emit `EVENTS.CONFIG_UPDATED` after changes are applied.

7.  **`src/core/SimulatorEngine.js` (Core Loop & Simulation Coordinator):**
    *   Manages the main `requestAnimationFrame` loop for the simulation.
    *   Initializes and holds references to core simulation modules (`Renderer`, `PhysicsEngine`, `Drone`, `World`). Relies on `InputManager` singleton.
    *   Orchestrates updates between modules *only when not paused*.
    *   Listens for control events via `EventBus` (e.g., `EVENTS.SIM_PAUSE_REQUESTED`, `EVENTS.SIM_RESET_REQUESTED`, `EVENTS.ARM_DISARM_TOGGLE_REQUESTED`) and calls appropriate internal methods (`pause()`, `resume()`, `restartFlight()`, `toggleArmDisarm()`).
    *   Emits `EVENTS.SIMULATION_STATE_UPDATE` via `EventBus` each frame with current drone and input data.
    *   Handles timing (delta time calculation).
    *   Manages the cleanup of simulation resources (`dispose`).

8.  **`src/managers/InputManager.js` (Input Processing):**
    *   A singleton manager listening for raw keyboard and Gamepad API events.
    *   Runs its own polling loop (`setInterval`) to process inputs independently of the simulation frame rate.
    *   Maps raw inputs to logical drone control commands (target roll/pitch/yaw rates, thrust), considering sensitivity and deadzones from configuration.
    *   Provides the current command state via `getControls()`.
    *   Emits action events via `EventBus` for non-movement inputs (e.g., `EVENTS.SIM_RESET_REQUESTED`, `EVENTS.ARM_DISARM_TOGGLE_REQUESTED`).
    *   Ignores flight control inputs processing when the simulation state (managed elsewhere) indicates paused mode (or zeroes controls output).

9.  **`src/core/Renderer.js` (Three.js Wrapper):**
    *   Initializes and manages `THREE.WebGLRenderer`, `THREE.Scene`, lighting, cameras, and post-processing (`EffectComposer`).
    *   Handles scene rendering each frame.
    *   Listens for events like `EVENTS.DRONE_COLLISION` via `EventBus` to trigger effects (e.g., camera shake).
    *   Applies configuration changes (e.g., FPV FOV, post-processing enables) potentially by listening to `EVENTS.SETTINGS_APPLIED` or via `ConfigManager.applySettingsToEngine`.

10. **`src/core/PhysicsEngine.js` (cannon-es Wrapper):**
    *   Initializes and manages the `CANNON.World`.
    *   Steps the physics simulation when the engine is not paused.
    *   Provides methods to add/remove `CANNON.Body` objects.
    *   Manages synchronization between physics bodies and Three.js visuals (`syncVisuals`).
    *   Applies configuration changes (e.g., gravity, damping) potentially by listening to `EVENTS.SETTINGS_APPLIED` or via `ConfigManager.applySettingsToEngine`.

11. **`src/simulation/Drone.js` (Drone Entity):**
    *   Represents the drone (Visual Model, Physics Body, FPV Camera).
    *   Contains `src/simulation/FlightController.js` logic for translating controls into physics forces/torques (using PID controllers).
    *   Handles arming/disarming state internally (triggered by engine or flight controller).
    *   Provides state information (`getState()`) for the engine to emit.
    *   Handles resetting position/state (`reset`).
    *   Emits events like `EVENTS.DRONE_COLLISION` via `EventBus` (indirectly via physics callback).
    *   Applies configuration changes (e.g., mass, damping, FOV, **FPV camera angle**) via its `applyConfiguration` method.

12. **`src/simulation/World.js` (Environment Coordinator):**
    *   Coordinates the creation of the simulation environment.
    *   Initializes lighting and the skybox.
    *   Instantiates and calls `src/simulation/ProceduralWorldGenerator.js` to create the actual terrain and obstacles.
    *   (Future: Could potentially load different predefined maps or generators).

13. **`src/simulation/ProceduralWorldGenerator.js` (World Builder):**
    *   Generates the simulation environment procedurally based on configuration settings.
    *   Creates terrain using a noise function and `CANNON.Heightfield`.
    *   Places props (trees, rocks - currently placeholders) on the terrain.
    *   Places racing gates algorithmically.
    *   Adds the corresponding visual (`THREE.Mesh`/`Group`) and physics (`CANNON.Body`) representations to the `Renderer` and `PhysicsEngine`.

14. **`src/utils/AssetLoader.js` (Asset Loading):**
    *   Singleton utility using Three.js loaders (`GLTFLoader`, `CubeTextureLoader`, etc.) to load assets asynchronously.
    *   Provides `preloadAssets()` method for loading essential assets during the `LoadingState`.

15. **State Classes (`src/states/*.js`):**
    *   Located in `src/states/`.
    *   Classes like `MenuState`, `LoadingState`, `SimulatingState`, `PausedState`.
    *   Each class extends a `BaseState` and implements `enter()` and `exit()` methods, plus state-specific event handlers (e.g., `handleEscape()`).
    *   Contain the logic specific to what should happen when entering, exiting, or handling events within that particular application phase. Managed by `StateManager`.

## Application States

The application operates in one of the following states, managed by `StateManager.js` using dedicated state classes:

*   **`MenuState`:** The initial state. `MenuManager` displays the main menu. Waits for user interaction (e.g., `EVENTS.FLY_BUTTON_CLICKED`).
*   **`LoadingState`:** Entered after fly button click. `MenuManager` displays the loading indicator. `AssetLoader` loads essential assets. `SimulatorEngine` is created and initialized (which includes `ProceduralWorldGenerator` creating the world). Transitions to `SimulatingState` on completion or `MenuState` on error.
*   **`SimulatingState`:** The main simulation state. `SimulatorEngine` runs its loop, physics updates, rendering occurs. `OSDManager` displays telemetry. Pointer lock is active. Handles `handleEscape` to transition to `PausedState`. Handles pointer lock loss by transitioning to `PausedState`.
*   **`PausedState`:** Entered via Escape key or pointer lock loss from `SimulatingState`. `SimulatorEngine` loop logic is paused (physics/drone updates skip). `MenuManager` displays the in-sim pause menu. Handles events for resuming, restarting, returning to menu, or applying settings.

## Data Flow Example (Simulating State Update Loop)

1.  `SimulatorEngine`: Get delta time (`clampedDeltaTime`). Check if paused internally. If yes, skip steps 3-9.
2.  `InputManager`: (Polling independently) Has updated its internal `controls` based on raw keyboard/gamepad input.
3.  `SimulatorEngine`: Get current `controls` state from `InputManager.getControls()`.
4.  `Drone (FC)`: Read `controls`. Calculate target rates. Use PID controllers to determine required torques based on current angular velocity. Calculate thrust force.
5.  `Drone (FC)`: Apply forces/torques to the drone's `CANNON.Body`.
6.  `PhysicsEngine`: Step the simulation (`world.step(physicsTimestep)`).
7.  `PhysicsEngine`: Synchronize `THREE.Object3D` positions/orientations from `CANNON.Body` states (`syncVisuals`).
8.  `Drone`: Update internal state (propeller animation etc.). Prepare `droneState` object.
9.  `SimulatorEngine`: Store `droneState` and `controls` in `simulationState` object.
10. `SimulatorEngine`: Emit `EVENTS.SIMULATION_STATE_UPDATE` with `simulationState` data via `EventBus`.
11. `OSDManager`: (Listener) Receives `SIMULATION_STATE_UPDATE` event. Updates OSD DOM elements based on the event data.
12. `Renderer`: Render the `THREE.Scene` using the active camera (potentially applying post-processing).
13. `SimulatorEngine`: `requestAnimationFrame` for the next loop.

## Data Flow Example (User Action - e.g., Pressing Reset Key 'R')

1.  `InputManager`: Detects 'R' key press during its polling.
2.  `InputManager`: Emits `EVENTS.SIM_RESET_REQUESTED` via `EventBus`.
3.  `SimulatorEngine`: (Listener) Catches `EVENTS.SIM_RESET_REQUESTED` event.
4.  `SimulatorEngine`: Calls its internal `restartFlight()` method.
5.  `Drone`: `reset()` method is called within `restartFlight`, resetting physics, visual state, and flight controller state.

## Configuration

*   User-configurable settings have defaults defined in `src/config/defaultConfig.js`.
*   User overrides are stored in `localStorage` under the key `droneSimUserConfig`.
*   `src/config/ConfigManager.js` (Singleton) loads/merges/provides the active configuration (`getCurrentConfig()`).
*   Settings modified via `MenuManager`'s panels update the config in memory (`ConfigManager.updateUserSetting`).
*   Clicking "Apply & Save" in the pause menu triggers `EVENTS.APPLY_SETTINGS_CLICKED`.
*   `StateManager` (in `PausedState`) listens for this, calls `ConfigManager.saveConfig()` and `ConfigManager.applySettingsToEngine()`.
*   Relevant modules (`Drone`, `Renderer`, `PhysicsEngine`, `FlightController`, etc.) have `applyConfiguration(config)` methods called by `ConfigManager.applySettingsToEngine`.
*   New settings include:
    *   `FPV_CAMERA_ANGLE_DEG`: Controls the default upward tilt of the FPV camera (Fly Settings).
    *   `WORLD_GENERATION`: Parameters controlling procedural world generation (e.g., `terrainHeightScale`, `propDensity`, `gateCount`). Not currently user-editable via UI.
*   Core, non-user-configurable engine parameters remain in `src/config/Config.js`.

## Controls (Default - Gamepad Mode 2)

*   **Keyboard:**
    *   `W/S` or `ArrowUp/ArrowDown`: Pitch
    *   `A/D` or `ArrowLeft/ArrowRight`: Roll
    *   `Q/E`: Yaw
    *   `Shift`: Increase Thrust
    *   `Ctrl`: Decrease Thrust
    *   `Space`: Cut Thrust (Set to 0)
    *   `Enter`: Toggle Arm/Disarm (Handled by `InputManager` -> `EventBus` -> `SimulatorEngine`)
    *   `R`: Reset Flight (Handled by `InputManager` -> `EventBus` -> `SimulatorEngine`)
*   **Gamepad (Mode 2 - Typical):**
    *   Right Stick X/Y: Roll/Pitch (Check `GAMEPAD_INVERT_AXES` in config)
    *   Left Stick X/Y: Yaw/Thrust (Check `GAMEPAD_INVERT_AXES` in config)
    *   Button mapping for Arm/Reset defined in `defaultConfig.js` (`GAMEPAD_BUTTON_MAPPING`), processed by `InputManager` -> `EventBus` -> `SimulatorEngine`. Defaults: RB/R1=Arm, LB/L1=Reset.
*   **System:**
    *   `Esc`: Toggle Pause Menu / Close Settings Panel (Handled by `StateManager` via current state).

## Getting Started

1.  Clone the repository.
2.  Ensure you have Node.js installed (optional, but needed for dev servers like `serve`).
3.  Open a terminal in the project root directory.
4.  Run a simple static file server that properly handles MIME types for `.js` modules. A common choice is `serve`:
    ```bash
    npx serve public
    ```
    (If you don't have `serve` installed, run `npm install -g serve` first, or use another static server like `python -m http.server` if Python is available, though `serve` is often better for development).
5.  Open your web browser and navigate to the URL provided by the server (e.g., `http://localhost:3000`).
6.  **(Note on Procedural Generation):** The current implementation uses a simple placeholder noise function in `ProceduralWorldGenerator.js`. For more complex and varied terrain, integrating a proper noise library (like `simplex-noise`, installable via `npm install simplex-noise`) and replacing the placeholder is recommended.

*(Further instructions on build processes or specific dependencies will be added as needed).*\