# Web FPV Drone Simulator

A web-based FPV (First-Person View) drone simulator built using Three.js and cannon-es, designed to run entirely in the browser. This project aims to create a realistic flight experience without requiring dedicated backend infrastructure for the core simulation.

## Core Philosophy

*   **Modularity:** Code is structured into logical modules/classes using ES6 `import`/`export` for better organization and maintainability.
*   **Separation of Concerns:** Rendering (Three.js), physics simulation (cannon-es), input handling, UI (OSD, Menus), configuration, asset loading, and drone flight control logic are kept distinct.
*   **Configuration Driven:** Key simulation parameters (drone physics, control sensitivity, graphics settings) are managed via a configuration system, allowing for easier tuning and user customization through `localStorage`.
*   **State Management:** A simple state machine (`main.js`) manages the overall application flow (Menu, Loading, Simulating, Paused).
*   **Performance:** Performance considerations are kept in mind, especially regarding physics calculations and rendering optimizations.

## Architecture Design

The simulator is built around several key components:

1.  **`main.js` (Application Orchestrator & State Manager):**
    *   Handles the overall application lifecycle and state (`MENU`, `LOADING`, `SIMULATING`, `PAUSED`).
    *   Manages transitions between states (e.g., showing/hiding main menu, loading indicator, simulator canvas, pause menu).
    *   Initializes the `SimulatorEngine` when transitioning to the simulation state.
    *   Handles global events like 'Esc' for pausing and pointer lock changes.
    *   Connects UI element events (buttons) to application actions (`startSimulation`, `showInSimMenu`, `hideInSimMenu`, `returnToMainMenu`).

2.  **`Simulator Engine` (`SimulatorEngine.js` - Core Loop):**
    *   Manages the main `requestAnimationFrame` loop.
    *   Orchestrates updates between modules (Physics, Input, Drone, Renderer, UI) *only when not paused*.
    *   Handles timing (delta time calculation).
    *   Manages the initialization, starting, stopping, pausing, and resuming of the core simulation logic.
    *   Provides methods for high-level actions like restarting the flight (`restartFlight`).
    *   Manages the cleanup of simulation resources (`dispose`).

3.  **`Config Manager` (`ConfigManager.js`, `defaultConfig.js`):**
    *   Loads user settings from `localStorage` on startup.
    *   Merges user settings with `defaultConfig.js`.
    *   Provides the current, merged configuration (`getCurrentConfig()`) to all modules.
    *   Saves user settings back to `localStorage`.
    *   Applies configuration changes to relevant engine modules (`applySettingsToEngine`).
    *   `Config.js` now holds only non-user-configurable core constants.

4.  **`Renderer` (`Renderer.js` - Three.js Wrapper):**
    *   Initializes and manages `THREE.WebGLRenderer`, `THREE.Scene`, lighting, and cameras (`THREE.PerspectiveCamera` for FPV, optional debug camera).
    *   Handles scene rendering each frame (even when paused, to show menus).
    *   Manages window resizing.
    *   Provides methods for adding/removing objects.
    *   Applies configuration changes (e.g., FPV FOV).

5.  **`Physics Engine` (`PhysicsEngine.js` - cannon-es Wrapper):**
    *   Initializes and manages the `CANNON.World` (gravity, collision settings, materials).
    *   Steps the physics simulation *only when not paused*.
    *   Provides methods to add/remove `CANNON.Body` objects.
    *   Manages synchronization between physics bodies and Three.js visuals (`syncVisuals`).
    *   Applies configuration changes (e.g., potentially gravity later).

6.  **`World` (`World.js` - Environment):**
    *   Defines and creates static elements (ground, obstacles, skybox, lighting).
    *   Adds visual (`THREE.Mesh`) and physical (`CANNON.Body`) representations to the respective engines during initialization.

7.  **`Drone` (`Drone.js`):**
    *   Represents the drone (Visual Model: loaded GLTF, Physics Body: `CANNON.Body`, FPV Camera: `THREE.PerspectiveCamera`).
    *   Contains Flight Controller (`FC`) logic within its `update` method: Translates processed user inputs into forces/torques applied to the physics body.
    *   Handles arming/disarming state.
    *   Provides state information (`getState()`) for the OSD.
    *   Handles resetting position/state (`reset`).
    *   Applies configuration changes (e.g., mass, damping, FPV camera FOV).

8.  **`Input Manager` (`InputManager.js`):**
    *   Listens for keyboard and Gamepad API events.
    *   Maps raw inputs to logical drone control commands (target roll/pitch/yaw rates, thrust), considering sensitivity and deadzones from configuration.
    *   Provides the current command state (`getControls()`) to the `Drone`.
    *   Ignores flight control inputs when the simulation is paused (`update(isPaused)`).
    *   Applies configuration changes (e.g., sensitivity, deadzone, mappings).

9.  **`UI Manager` (`UIManager.js` - OSD):**
    *   Manages the On-Screen Display (OSD) HTML overlay elements.
    *   Updates OSD elements with real-time telemetry data (attitude, altitude, speed, inputs, armed status) retrieved from the `simulationState`.
    *   *(Note: Main Menu and Pause Menu UI state/transitions are currently managed in `main.js`).*

10. **`Asset Loader` (`AssetLoader.js`):**
    *   Utility using Three.js loaders (`GLTFLoader`, `CubeTextureLoader`) to load assets asynchronously.
    *   Provides a `preloadAssets` method and accessors (`getModel`, `getCubeTexture`). Implemented as a singleton.

### Application States

The application operates in one of the following states, managed by `main.js`:

*   **`MENU`:** The initial state. Displays the main menu overlay. Waits for user interaction.
*   **`LOADING`:** Entered after clicking "Fly". Displays the loading indicator while assets are loaded and the simulator engine is initialized.
*   **`SIMULATING`:** The main simulation state. The 3D scene is rendered, physics runs, inputs are processed, and the OSD is active. Pointer lock is typically active.
*   **`PAUSED`:** Entered by pressing 'Esc' while simulating. The in-sim pause menu overlay is displayed. The core simulation loop (`physics`, `drone update`) is paused, but rendering continues. Pointer lock is released.

### Data Flow Example (Simulating State Update Loop)

1.  `Simulator Engine`: Get delta time (`clampedDeltaTime`). Check if `isPaused`. If yes, skip steps 2-7.
2.  `Input Manager`: Poll keyboard/gamepad. Calculate `controls` (roll, pitch, yaw, thrust) respecting config (sensitivity, deadzone).
3.  `Drone (FC)`: Read `controls`. Calculate forces/torques based on current physics state and control multipliers (from config).
4.  `Drone`: Apply forces/torques to its `CANNON.Body`.
5.  `Physics Engine`: Step the simulation (`world.step(clampedDeltaTime)`).
6.  `Physics Engine`: Synchronize `THREE.Object3D` positions/orientations from `CANNON.Body` states (`syncVisuals`).
7.  `Drone`: Update FPV camera transform (usually automatic via attachment to visual model). Prepare `droneState` object.
8.  `Simulator Engine`: Store `droneState` and `controls` in `simulationState`.
9.  `UI Manager`: Read `simulationState`. Update OSD DOM elements.
10. `Renderer`: Render the `THREE.Scene` using the active camera (usually FPV).
11. `Simulator Engine`: `requestAnimationFrame` for the next loop.

### Configuration

*   User-configurable settings (like sensitivity, drone mass, FOV) have defaults defined in `src/defaultConfig.js`.
*   User overrides are stored in the browser's `localStorage`.
*   `ConfigManager.js` loads saved settings, merges them with defaults, and provides the active configuration via `getCurrentConfig()`.
*   Settings can be modified via the (currently placeholder) panels in the in-sim pause menu ('Esc' key). Changes are saved to `localStorage` via the "Apply & Save" button.
*   Core engine parameters (like `PHYSICS_TIMESTEP`) remain in `src/Config.js`.

### Controls (Default)

*   **Keyboard:**
    *   `W/S` or `ArrowUp/ArrowDown`: Pitch
    *   `A/D` or `ArrowLeft/ArrowRight`: Roll
    *   `Q/E`: Yaw
    *   `Shift`: Increase Thrust
    *   `Ctrl`: Decrease Thrust
    *   `Space`: Cut Thrust (Set to 0)
    *   *(Arm/Disarm and Reset removed as debug keys, use menu)*
*   **Gamepad (Mode 2 - Typical):**
    *   Right Stick X/Y: Roll/Pitch
    *   Left Stick X/Y: Yaw/Thrust
    *   *(Button mapping for Arm/Reset defined in config, processed by InputManager/Engine)*
*   **System:**
    *   `Esc`: Toggle Pause Menu / Return from Settings Panels

## Getting Started

1.  Clone the repository.
2.  Ensure you have Node.js installed (for the development server).
3.  Open a terminal in the project root directory.
4.  Run a simple static file server that properly handles MIME types for `.js` modules. A common choice is `serve`:
    ```bash
    npx serve public
    ```
    (If you don't have `serve` installed, run `npm install -g serve` first, or use another static server like `python -m http.server` if Python is available, though `serve` is often better for development).
5.  Open your web browser and navigate to the URL provided by the server (e.g., `http://localhost:3000`).

*(Further instructions on build processes or specific dependencies will be added as needed).*