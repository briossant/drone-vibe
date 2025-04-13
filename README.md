# Web FPV Drone Simulator

A web-based FPV (First-Person View) drone simulator built using Three.js and cannon-es, designed to run entirely in the browser. This project aims to create a realistic flight experience without requiring dedicated backend infrastructure for the core simulation.

## Core Philosophy

*   **Modularity:** Code is structured into logical modules/classes using ES6 `import`/`export` for better organization and maintainability, grouped into feature-based directories (e.g., `core`, `simulation`, `ui`, `managers`, `config`, `utils`).
*   **Separation of Concerns:** Key responsibilities like rendering (Three.js), physics simulation (cannon-es), input handling, UI management (Menus, OSD), state management, configuration, asset loading, and flight control are kept distinct.
*   **Event-Driven Communication:** Utilizes a central `EventBus` (Observer pattern) for loose coupling between modules. Modules communicate by emitting and listening to events rather than direct calls.
*   **State Management:** A dedicated `StateManager` controls the application's flow using the State pattern, encapsulating behavior specific to each state (Menu, Loading, Simulating, Paused).
*   **Configuration Driven:** Key simulation parameters (drone physics, control sensitivity, graphics settings, **FPV camera angle**, **world generation**) are managed via a configuration system (`ConfigManager`), allowing for easier tuning and user customization through `localStorage` **with auto-saving**.
*   **Performance:** Performance considerations are kept in mind, especially regarding physics calculations (Heightfield, potential InstancedMesh) and rendering optimizations.

## Key Features

*   Realistic(ish) FPV Flight Physics (Rate Mode PID Control)
*   Configurable Drone Parameters (Mass, Damping, Control Sensitivity, PID Gains)
*   **Procedural World Generation:** Creates unique environments on each load (or based on seed) including:
    *   Noise-based Terrain (`CANNON.Heightfield`)
    *   Procedurally placed props (Trees, Rocks - using placeholder geometry currently)
    *   Procedurally placed Racing Gates
*   Configurable FPV Camera (Field of View, **Upward Tilt Angle**)
*   On-Screen Display (OSD) for real-time telemetry **with blurred background**.
*   Keyboard & Gamepad Support (Mode 2 Mapping, Configurable Deadzone/Inversion)
*   **Modernized In-Simulation Pause Menu:**
    *   Blurred background (`backdrop-filter`) effect.
    *   Sidebar navigation for main actions (Resume, Restart, Settings, Controls, Main Menu).
    *   Tabbed content area for Settings and Controls categories.
    *   Custom-styled controls (sliders, toggle switches).
    *   **Auto-saving of settings** to `localStorage` upon change.
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
    *   Initializes core managers (`ConfigManager`, `MenuManager`, `OSDManager`, `InputManager`, `StateManager`, `EventBus`, `AudioListener`).
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
    *   Provides shared `context` object to states (e.g., `simulatorEngine`, `audioListener`).

4.  **`src/ui/MenuManager.js` (UI Manager - Menus & Overlays):**
    *   A singleton manager responsible for controlling the visibility and interaction of all primary UI elements *except* the OSD.
    *   Manages the Main Menu, Loading Indicator, **reworked In-Simulation Menu**, and Fade Overlay.
    *   **Handles the new In-Sim Menu structure:** Sidebar navigation clicks (activating views like Settings/Controls), sub-navigation tab clicks (activating specific content panels).
    *   Listens for user interactions (button clicks) within its managed elements (e.g., Resume, Restart, Main Menu).
    *   Emits application-level events via the `EventBus` in response to user actions (e.g., `EVENTS.FLY_BUTTON_CLICKED`, `EVENTS.RESUME_BUTTON_CLICKED`).
    *   Uses `src/ui/UIComponentFactory.js` to dynamically create settings controls (sliders, toggles) within the content panels.
    *   **(No longer manages Apply/Save logic).**
    *   Periodically updates Gamepad status display when Controls view is active.

5.  **`src/ui/OSDManager.js` (UI Manager - On-Screen Display):**
    *   A singleton manager focused *solely* on the On-Screen Display (OSD) telemetry overlay.
    *   Initializes the OSD HTML structure and applies styles (including background blur).
    *   Listens for `EVENTS.SIMULATION_STATE_UPDATE` emitted by the `SimulatorEngine`.
    *   Updates the OSD DOM elements with real-time telemetry data.

6.  **`src/config/ConfigManager.js` (Configuration):**
    *   Singleton manager for loading/saving settings.
    *   Loads user settings from `localStorage` on startup, merging them with `src/config/defaultConfig.js`.
    *   Provides the current, merged configuration (`getCurrentConfig()`) to all modules.
    *   **Handles Auto-Saving:** The `updateUserSetting` method, typically called by UI controls, now immediately updates the setting in memory, **saves the entire user configuration to `localStorage`**, and triggers `applySettingsToEngine` to apply the change live.
    *   Applies configuration changes to relevant engine modules (`applySettingsToEngine`).
    *   **(No longer listens for or handles `EVENTS.APPLY_SETTINGS_CLICKED`).**
    *   May emit `EVENTS.CONFIG_UPDATED` or `EVENTS.SETTINGS_APPLIED` after changes are applied.
    *   Provides `resetToDefaults` method for resetting categories.

7.  **`src/core/SimulatorEngine.js` (Core Loop & Simulation Coordinator):**
    *   Manages the main `requestAnimationFrame` loop for the simulation.
    *   Initializes and holds references to core simulation modules (`Renderer`, `PhysicsEngine`, `Drone`, `World`). Relies on `InputManager` singleton.
    *   Orchestrates updates between modules *only when not paused*.
    *   Listens for control events via `EventBus` (e.g., `EVENTS.SIM_PAUSE_REQUESTED`, `EVENTS.SIM_RESET_REQUESTED`, `EVENTS.ARM_DISARM_TOGGLE_REQUESTED`) and calls appropriate internal methods.
    *   Emits `EVENTS.SIMULATION_STATE_UPDATE` via `EventBus` each frame.
    *   Handles timing (delta time calculation).
    *   Manages the cleanup of simulation resources (`dispose`).

8.  **`src/managers/InputManager.js` (Input Processing):**
    *   A singleton manager listening for raw keyboard and Gamepad API events.
    *   Runs its own polling loop (`setInterval`) to process inputs independently.
    *   Maps raw inputs to logical drone control commands.
    *   Provides the current command state via `getControls()`.
    *   Emits action events via `EventBus` for non-movement inputs (Arm, Reset).
    *   Provides `getGamepadStatus()` method for UI display.

9.  **`src/core/Renderer.js` (Three.js Wrapper):**
    *   Initializes and manages `THREE.WebGLRenderer`, `THREE.Scene`, lighting, cameras, post-processing.
    *   Handles scene rendering each frame.
    *   Listens for events like `EVENTS.DRONE_COLLISION` to trigger camera shake.
    *   Applies configuration changes via its `applyConfiguration` method.

10. **`src/core/PhysicsEngine.js` (cannon-es Wrapper):**
    *   Initializes and manages the `CANNON.World`.
    *   Steps the physics simulation when the engine is not paused.
    *   Manages synchronization between physics bodies and Three.js visuals.
    *   Applies configuration changes.

11. **`src/simulation/Drone.js` (Drone Entity):**
    *   Represents the drone (Visual Model, Physics Body, FPV Camera).
    *   Contains `src/simulation/FlightController.js` logic.
    *   Handles arming/disarming state internally.
    *   Provides state information (`getState()`) for the engine/OSD.
    *   Handles resetting position/state (`reset`).
    *   Applies configuration changes (e.g., mass, damping, FOV, **FPV camera angle**).

12. **`src/simulation/World.js` (Environment Coordinator):**
    *   Coordinates the creation of the simulation environment.
    *   Initializes lighting and the skybox.
    *   Instantiates and calls `src/simulation/ProceduralWorldGenerator.js`.

13. **`src/simulation/ProceduralWorldGenerator.js` (World Builder):**
    *   Generates the simulation environment procedurally based on configuration settings (terrain, props, gates).
    *   Adds visual and physics representations to the `Renderer` and `PhysicsEngine`.

14. **`src/utils/AssetLoader.js` (Asset Loading):**
    *   Singleton utility using Three.js loaders (`GLTFLoader`, `CubeTextureLoader`, `AudioLoader`) to load assets asynchronously.
    *   Provides `preloadAssets()` method.

15. **State Classes (`src/states/*.js`):**
    *   Located in `src/states/`. Classes like `MenuState`, `LoadingState`, `SimulatingState`, `PausedState`.
    *   Each class extends `BaseState` and implements `enter()` and `exit()` methods, plus state-specific event handlers (e.g., `handleEscape()`).
    *   Managed by `StateManager`.

16. **`src/ui/UIComponentFactory.js` (UI Element Builder):**
    *   Utility module for creating standardized UI controls (sliders, toggles, display items, reset buttons) used in the settings panels.
    *   Connects control interactions to `ConfigManager.updateUserSetting`.

## Application States

The application operates in one of the following states, managed by `StateManager.js` using dedicated state classes:

*   **`MenuState`:** The initial state. `MenuManager` displays the main menu. Waits for user interaction (e.g., `EVENTS.FLY_BUTTON_CLICKED`).
*   **`LoadingState`:** Entered after fly button click. `MenuManager` displays the loading indicator. `AssetLoader` loads assets. `SimulatorEngine` is created, initialized, and started. `ConfigManager` applies initial settings. Transitions to `SimulatingState` on completion or `MenuState` on error.
*   **`SimulatingState`:** The main simulation state. `SimulatorEngine` runs its loop, physics updates, rendering occurs. `OSDManager` displays telemetry. Pointer lock is active. Handles `handleEscape` to transition to `PausedState`. Handles pointer lock loss by transitioning to `PausedState`.
*   **`PausedState`:** Entered via Escape key or pointer lock loss from `SimulatingState`. `SimulatorEngine` loop logic is paused. `MenuManager` displays the **new in-sim pause menu (sidebar layout)**. Handles events for resuming, restarting, returning to menu via sidebar buttons. **Handles Escape key:** If a settings/controls view is open (`MenuManager.isViewActive()`), it closes the view (`MenuManager.resetToDefaultView()`); otherwise, it resumes the game (transitions to `SimulatingState`). **(No longer handles Apply/Save events).**

## Data Flow Example (Simulating State Update Loop)

*(This remains largely the same)*
1.  `SimulatorEngine`: Get delta time. Check if paused. If yes, skip steps 3-9.
2.  `InputManager`: (Polling independently) Updates internal `controls`.
3.  `SimulatorEngine`: Get `controls` from `InputManager.getControls()`.
4.  `Drone (FC)`: Calculates forces/torques based on `controls` and PID logic.
5.  `Drone (FC)`: Applies forces/torques to `CANNON.Body`.
6.  `PhysicsEngine`: Steps the simulation.
7.  `PhysicsEngine`: Synchronizes `THREE.Object3D` from `CANNON.Body` states.
8.  `Drone`: Updates internal state. Prepares `droneState` object.
9.  `SimulatorEngine`: Stores `droneState` and `controls` in `simulationState`.
10. `SimulatorEngine`: Emits `EVENTS.SIMULATION_STATE_UPDATE`.
11. `OSDManager`: (Listener) Receives event, updates OSD DOM elements.
12. `Renderer`: Renders the `THREE.Scene`.
13. `SimulatorEngine`: `requestAnimationFrame` for the next loop.

## Data Flow Example (User Action - e.g., Pressing Reset Key 'R')

*(This remains the same)*
1.  `InputManager`: Detects 'R' key press.
2.  `InputManager`: Emits `EVENTS.SIM_RESET_REQUESTED`.
3.  `SimulatorEngine`: (Listener) Catches event.
4.  `SimulatorEngine`: Calls internal `restartFlight()`.
5.  `Drone`: `reset()` method is called, resetting physics, visual, and FC state.

## Configuration (Updated)

*   User-configurable settings have defaults defined in `src/config/defaultConfig.js`.
*   User overrides are stored in `localStorage` under the key `droneSimUserConfig`.
*   `src/config/ConfigManager.js` (Singleton) loads/merges/provides the active configuration (`getCurrentConfig()`).
*   **Auto-Saving:** Settings modified via the UI controls (sliders, toggles generated by `UIComponentFactory`) directly call `ConfigManager.updateUserSetting(keyPath, value)`.
*   `ConfigManager.updateUserSetting` **immediately**:
    1.  Updates the setting value in the in-memory `userConfig` object.
    2.  Re-merges the configuration (`_mergeConfigs`).
    3.  **Saves the updated `userConfig` object to `localStorage`.**
    4.  Calls `ConfigManager.applySettingsToEngine` to push the updated configuration to relevant modules (Drone, Renderer, Physics, FC, InputManager), making the change take effect live.
*   **The "Apply & Save" button and the `EVENTS.APPLY_SETTINGS_CLICKED` event have been removed.** Persistence happens automatically on change.
*   The `resetToDefaults(categoryPath)` method in `ConfigManager` can be triggered (e.g., by UI buttons) to clear specific user overrides, save, and apply the defaults.
*   Relevant modules (`Drone`, `Renderer`, `PhysicsEngine`, `FlightController`, `InputManager`) have `applyConfiguration(config)` methods called by `ConfigManager.applySettingsToEngine`.
*   Example user settings include:
    *   `FPV_CAMERA_FOV`, `FPV_CAMERA_ANGLE_DEG`
    *   `GRAPHICS_SETTINGS` (Bloom, Vignette)
    *   `DRONE_MASS`, `DRONE_PHYSICS_SETTINGS` (Damping)
    *   `KEYBOARD_SENSITIVITY`, `GAMEPAD_DEADZONE`, `GAMEPAD_INVERT_AXES`, `GAMEPAD_BUTTON_MAPPING`
    *   `FLIGHT_CONTROLLER_SETTINGS` (PID gains, Rate Limits)
    *   `WORLD_GENERATION` (parameters controlling procedural generation)
*   Core, non-user-configurable engine parameters remain in `src/config/Config.js`.

## Controls (Default - Gamepad Mode 2)

*(This remains the same)*
*   **Keyboard:**
    *   `W/S` or `ArrowUp/ArrowDown`: Pitch
    *   `A/D` or `ArrowLeft/ArrowRight`: Roll
    *   `Q/E`: Yaw
    *   `Shift`: Increase Thrust
    *   `Ctrl`: Decrease Thrust
    *   `Space`: Cut Thrust (Set to 0)
    *   `Enter`: Toggle Arm/Disarm
    *   `R`: Reset Flight
*   **Gamepad (Mode 2 - Typical):**
    *   Right Stick X/Y: Roll/Pitch
    *   Left Stick X/Y: Yaw/Thrust
    *   Button mapping for Arm/Reset defined in `defaultConfig.js` (`GAMEPAD_BUTTON_MAPPING`). Defaults: RB/R1=Arm, LB/L1=Reset.
*   **System:**
    *   `Esc`: Toggle Pause Menu / Close Settings/Controls View.

## Getting Started

1.  Clone the repository.
2.  Ensure you have Node.js installed (optional, but needed for dev servers like `serve`).
3.  Open a terminal in the project root directory.
4.  Run a simple static file server that properly handles MIME types for `.js` modules. A common choice is `serve`:
    ```bash
    npx serve public
    ```
    (If you don't have `serve` installed, run `npm install -g serve` first, or use another static server).
5.  Open your web browser and navigate to the URL provided by the server (e.g., `http://localhost:3000`).

*(TODO: Update screenshots in README to reflect the new menu system)*