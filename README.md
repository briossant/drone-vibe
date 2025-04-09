# Web FPV Drone Simulator

A web-based FPV (First-Person View) drone simulator built using Three.js and cannon-es, designed to run entirely in the browser. This project aims to create a realistic flight experience without requiring dedicated backend infrastructure for the core simulation.

## Core Philosophy

*   **Modularity:** Code is structured into logical modules/classes using ES6 `import`/`export` for better organization and maintainability, even without a framework.
*   **Separation of Concerns:** Rendering (Three.js), physics simulation (cannon-es), input handling, UI (DOM), and drone flight control logic are kept distinct.
*   **Data Flow:** A clear and predictable flow of information is maintained (e.g., Input -> Flight Controller -> Physics -> State Update -> Renderer/UI).
*   **Performance:** Performance considerations are kept in mind, especially regarding physics calculations and rendering optimizations.

## Architecture Design

The simulator is built around several key components:

1.  **`Simulator Engine` (Core Loop):**
    *   Manages the main `requestAnimationFrame` loop.
    *   Orchestrates updates between modules (Physics, Input, Drone, Renderer, UI).
    *   Handles timing (delta time calculation).
    *   Manages initialization and cleanup.

2.  **`Renderer` (Three.js Wrapper):**
    *   Initializes and manages the `THREE.Scene`, `THREE.WebGLRenderer`, cameras (`THREE.PerspectiveCamera` for FPV), and lighting.
    *   Handles scene rendering each frame and window resizing.
    *   Provides methods for adding/removing objects from the scene.

3.  **`Physics Engine` (cannon-es Wrapper):**
    *   Initializes and manages the `CANNON.World` (gravity, collision settings).
    *   Steps the physics simulation each frame (`world.step()`).
    *   Provides methods to add/remove `CANNON.Body` objects and constraints.
    *   Manages the synchronization between physics bodies and their visual Three.js counterparts.

4.  **`World / Environment`:**
    *   Defines and creates the static elements of the simulation (ground, obstacles, skybox).
    *   Adds both visual (`THREE.Mesh`) and physical (`CANNON.Body`) representations of these elements to the respective engines.

5.  **`Drone`:**
    *   Represents the drone as a composite object:
        *   **Visual Model:** A `THREE.Object3D` (initially simple shapes, later a loaded model).
        *   **Physics Body:** A `CANNON.Body` defining mass, inertia, and collision shape.
        *   **FPV Camera:** A `THREE.PerspectiveCamera` attached to the visual model.
        *   **Flight Controller (`FC`) Logic:** Translates user input commands into forces and torques applied to the physics body, simulating flight characteristics (stabilization, motor response).

6.  **`Input Manager`:**
    *   Listens for keyboard and/or Gamepad API events.
    *   Maps raw inputs to logical drone control commands (target roll/pitch/yaw rates, thrust).
    *   Provides the current command state to the `Drone`'s `FC`.

7.  **`UI Manager` (DOM Manipulation):**
    *   Manages HTML overlay elements for the On-Screen Display (OSD).
    *   Updates DOM elements to display telemetry data (attitude, altitude, speed, inputs) retrieved from the simulation state.

8.  **`Asset Loader`:**
    *   A utility module using Three.js loaders (`GLTFLoader`, `TextureLoader`) to load 3D models, textures, etc., asynchronously.

### Data Flow Example (Simplified Update Loop)

1.  `Simulator Engine`: Get delta time.
2.  `Input Manager`: Update control command state.
3.  `Drone (FC)`: Read commands, calculate forces/torques based on current physics state.
4.  `Drone`: Apply forces/torques to its `CANNON.Body` via `Physics Engine`.
5.  `Physics Engine`: Step the simulation (`world.step(deltaTime)`).
6.  `Physics Engine`: Synchronize `THREE.Object3D` positions/orientations from `CANNON.Body` states.
7.  `Drone`: Update FPV camera transform based on drone model's updated transform.
8.  `UI Manager`: Get current state and update OSD DOM elements.
9.  `Renderer`: Render the `THREE.Scene` using the FPV camera.
10. `Simulator Engine`: `requestAnimationFrame` for the next loop.

## Getting Started (Placeholder)

*(Instructions on how to clone, setup, and run the project will go here once the initial structure is in place)*