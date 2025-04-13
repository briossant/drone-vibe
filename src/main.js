// src/main.js (Simplified Orchestrator)
import StateManager from './StateManager.js';
import MenuManager from './MenuManager.js';
import OSDManager from './OSDManager.js';
import EventBus, { EVENTS } from './EventBus.js';
import ConfigManager from './ConfigManager.js';
import InputManager from './InputManager.js'; // Still need for global listeners
// Import initial state
import MenuState from './states/MenuState.js';

// --- Global Variables ---
let sharedContext = {}; // Context object to potentially pass engine instance etc.

// --- Initialization ---
function initializeApp() {
    console.log("App initializing...");

    // Initialize Managers that don't depend on state yet
    ConfigManager.loadConfig(); // Load config first
    MenuManager.initialize();   // Set up menus and listeners
    OSDManager.initialize();    // Set up OSD display
    InputManager.initialize();

    // Initialize State Manager with the starting state and context
    StateManager.setContext(sharedContext); // Pass context if needed by states
    StateManager.changeState(new MenuState()); // <<< Set initial state HERE

    // --- Global Event Listeners ---
    // Escape Key (Handled by StateManager)
    window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            StateManager.handleEscape();
        }
        // Forward other specific keys if needed, or let InputManager handle them
        // Propagate key events for InputManager (if it needs global events)
        // EventBus.emit(EVENTS.KEY_DOWN, { key: event.key, event: event });
    });

    // Pointer Lock (Handled by StateManager)
    document.addEventListener('pointerlockchange', () => {
        const isLocked = document.pointerLockElement === MenuManager.canvasElement;
        EventBus.emit(EVENTS.POINTER_LOCK_CHANGE, { isLocked }); // Emit general event
        StateManager.handlePointerLockChange(isLocked); // Also notify current state
    }, false);

    document.addEventListener('pointerlockerror', () => {
        console.error('Pointer Lock Error!');
        EventBus.emit(EVENTS.POINTER_LOCK_ERROR);
    }, false);

    // Listen for canvas clicks (Handled by StateManager)
    EventBus.on(EVENTS.CANVAS_CLICKED, () => {
        StateManager.handleCanvasClick();
    });


    // --- App Flow Event Listeners (Listen to events from UI/States) ---
    EventBus.on(EVENTS.FLY_BUTTON_CLICKED, async ()  => {
        // Request transition to Loading state
        StateManager.changeState(new (await import('./states/LoadingState.js')).default(StateManager, sharedContext));
    });

    // No longer need direct listeners for resume, restart etc. in main.js,
    // as these are now handled within the PausedState logic via events from MenuManager.

    console.log("App initialization complete. Waiting for user interaction.");

    // Start the main application update loop (only relevant if StateManager needs updates)
    let lastTime = performance.now();
    function appLoop(currentTime) {
        const deltaTime = (currentTime - lastTime) * 0.001;
        lastTime = currentTime;

        // Update the current state if it has an update method
        StateManager.update(deltaTime);

        requestAnimationFrame(appLoop);
    }
    requestAnimationFrame(appLoop); // Start the loop
}

// --- Application Entry Point ---
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}