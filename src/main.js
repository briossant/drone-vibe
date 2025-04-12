// src/main.js
import SimulatorEngine from './SimulatorEngine.js';
import AssetLoader from './AssetLoader.js';
import ConfigManager, { getCurrentConfig } from './ConfigManager.js';

// --- Application States ---
const APP_STATE = {
    MENU: 'MENU',
    LOADING: 'LOADING',
    SIMULATING: 'SIMULATING',
    PAUSED: 'PAUSED',
};
let currentAppState = APP_STATE.MENU;
let simulatorEngine = null;

// --- DOM Element Caching ---
const mainMenuElement = document.getElementById('main-menu');
const loadingIndicatorElement = document.getElementById('loading-indicator');
const flyButton = document.getElementById('fly-button');
const canvasElement = document.getElementById('webgl-canvas');
const osdElement = document.getElementById('osd');
const inSimMenuElement = document.getElementById('in-sim-menu');
const resumeButton = document.getElementById('resume-button');
const restartButton = document.getElementById('restart-button');
const mainMenuButton = document.getElementById('main-menu-button');
const applySaveButton = document.getElementById('apply-save-button');
const settingsPanelButton = document.getElementById('settings-panel-button');
const controlsPanelButton = document.getElementById('controls-panel-button');
const settingsPanel = document.getElementById('settings-panel');
const controlsPanel = document.getElementById('controls-panel');
const backButtons = document.querySelectorAll('.panel .back-button');

// --- Utility Functions ---
function showElement(element) {
    element?.classList.remove('hidden');
}

function hideElement(element) {
    element?.classList.add('hidden');
}

// --- State Management ---
function setAppState(newState) {
    if (currentAppState !== newState) {
        const config = getCurrentConfig(); // Use loaded config for debug check
        if (config.DEBUG_MODE) {
            console.log(`App state changed: ${currentAppState} -> ${newState}`);
        }
        currentAppState = newState;
        // Update UI based on state (e.g., cursor visibility)
        // document.body.style.cursor = (newState === APP_STATE.SIMULATING) ? 'none' : 'default';
    }
}

// --- In-Simulation Menu Logic ---
function showInSimMenu() {
    // Only allow pausing from SIMULATING state
    if (currentAppState !== APP_STATE.SIMULATING) return;

    setAppState(APP_STATE.PAUSED);
    simulatorEngine?.pause(); // Tell engine to pause simulation logic
    showElement(inSimMenuElement);
    hideElement(settingsPanel); // Ensure sub-panels are hidden initially
    hideElement(controlsPanel);
    hideElement(applySaveButton);
    document.exitPointerLock(); // Release mouse control is crucial
    if (getCurrentConfig().DEBUG_MODE) console.log("In-Sim Menu Shown, Pointer Lock Released");
}

function hideInSimMenu() {
    // Only allow resuming from PAUSED state
    if (currentAppState !== APP_STATE.PAUSED) return;

    hideElement(inSimMenuElement);
    simulatorEngine?.resume(); // Tell engine to resume simulation logic
    setAppState(APP_STATE.SIMULATING);

    // Attempt to regain pointer lock - best triggered by user click on canvas,
    // but we can try here after clicking "Resume". May fail if not user-initiated.
    canvasElement.requestPointerLock()
        .catch(err => console.warn("Pointer lock request failed after resume:", err.name, err.message));

    if (getCurrentConfig().DEBUG_MODE) console.log("In-Sim Menu Hidden, Resuming Simulation");
}

function showSettingsPanel(panelElement) {
    // Hide the main pause menu buttons when showing a panel
    const mainPauseButtons = inSimMenuElement.querySelector('.menu-content > button'); // Find direct button children
    if (mainPauseButtons) mainPauseButtons.parentNode.classList.add('hidden'); // Hide container holding buttons

    // Show the selected panel and the apply/save button
    showElement(panelElement);
    showElement(applySaveButton);
}

function hideSettingsPanels() {
    // Hide specific panels and apply/save
    hideElement(settingsPanel);
    hideElement(controlsPanel);
    hideElement(applySaveButton);

    // Show the main pause menu buttons again
    const mainPauseButtons = inSimMenuElement.querySelector('.menu-content > button');
    if (mainPauseButtons) mainPauseButtons.parentNode.classList.remove('hidden');
}


// --- Simulation Lifecycle Functions ---
async function startSimulation() {
    // Can only start from MENU state
    if (currentAppState !== APP_STATE.MENU) return;

    setAppState(APP_STATE.LOADING);
    hideElement(mainMenuElement);
    showElement(loadingIndicatorElement);
    hideElement(osdElement); // Hide OSD during loading
    loadingIndicatorElement.querySelector('p').textContent = 'Loading assets...';

    const config = getCurrentConfig(); // Get latest config for debug checks

    try {
        // 1. Load Assets
        await AssetLoader.preloadAssets();
        if (config.DEBUG_MODE) console.log("Assets loaded.");
        loadingIndicatorElement.querySelector('p').textContent = 'Initializing simulator...';

        // 2. Create and Initialize Engine
        simulatorEngine = new SimulatorEngine(); // Engine uses getCurrentConfig() internally
        await simulatorEngine.initialize();
        if (config.DEBUG_MODE) console.log("Simulator engine initialized.");

        // 3. Apply Initial Configuration (loaded by ConfigManager on startup)
        ConfigManager.applySettingsToEngine(simulatorEngine);
        if (config.DEBUG_MODE) console.log("Initial configuration applied to engine.");

        // 4. Transition UI
        hideElement(loadingIndicatorElement);
        showElement(canvasElement); // Show canvas
        showElement(osdElement);    // Show OSD

        // 5. Start Engine Loop
        simulatorEngine.start();
        setAppState(APP_STATE.SIMULATING);

        // Optional: Assign to window for debugging
        if (config.DEBUG_MODE) {
            window.simEngine = simulatorEngine;
            console.log("SimulatorEngine instance available as 'window.simEngine'");
        }

        // 6. Request Pointer Lock (initial attempt)
        canvasElement.requestPointerLock()
            .catch(err => console.warn("Initial pointer lock request failed:", err.name, err.message));


    } catch (error) {
        console.error("FATAL ERROR during simulation start:", error);
        loadingIndicatorElement.querySelector('p').textContent = `Error initializing! ${error.message}`;
        // Optionally show error on main menu instead
        setAppState(APP_STATE.MENU); // Go back to menu on failure
        showElement(mainMenuElement);
        hideElement(loadingIndicatorElement);
        hideElement(canvasElement);
        hideElement(osdElement);
        // Potentially display error message on main menu here
        alert(`Failed to start simulation: ${error.message}`); // Simple alert fallback
    }
}

function returnToMainMenu() {
    if (simulatorEngine) {
        simulatorEngine.stop();    // Stop the loop
        simulatorEngine.dispose(); // Clean up engine resources
        simulatorEngine = null;
        window.simEngine = null; // Clear debug reference
        if (getCurrentConfig().DEBUG_MODE) console.log("Simulator engine disposed.");
    }

    // Reset UI to main menu state
    hideElement(inSimMenuElement);
    hideElement(canvasElement);
    hideElement(osdElement);
    showElement(mainMenuElement);

    // Clear any temporary messages (like loading/error text)
    loadingIndicatorElement.querySelector('p').textContent = 'Loading...';

    setAppState(APP_STATE.MENU);
    document.exitPointerLock(); // Ensure pointer lock is definitely released
}

// --- Initialization and Event Listeners ---
function initializeApp() {
    const config = getCurrentConfig(); // Config is loaded by ConfigManager instance
    if (config.DEBUG_MODE) {
        console.log("App initializing... Initial state:", currentAppState);
    }

    // --- Setup Initial UI State ---
    if (currentAppState === APP_STATE.MENU) {
        showElement(mainMenuElement);
        hideElement(loadingIndicatorElement);
        hideElement(inSimMenuElement);
        hideElement(canvasElement);
        hideElement(osdElement);
    } else {
        // Handle potential other start states if needed later
        console.warn("App initializing in unexpected state:", currentAppState);
        returnToMainMenu(); // Force back to menu if state is weird
    }

    // --- Bind Event Listeners ---

    // Main Menu Actions
    flyButton?.addEventListener('click', startSimulation);
    // Placeholder listeners for disabled buttons (remove if not needed)
    // document.getElementById('settings-button')?.addEventListener('click', () => alert("Settings accessed via in-sim menu (Esc)"));
    // document.getElementById('controls-button')?.addEventListener('click', () => alert("Controls accessed via in-sim menu (Esc)"));

    // In-Simulation Menu Actions
    resumeButton?.addEventListener('click', hideInSimMenu);
    restartButton?.addEventListener('click', () => {
        // Can only restart when paused
        if (simulatorEngine && currentAppState === APP_STATE.PAUSED) {
            if (getCurrentConfig().DEBUG_MODE) console.log("Restart button clicked while paused.");
            simulatorEngine.restartFlight(); // Reset drone state/position
            hideInSimMenu(); // Resume simulation and hide menu
        } else {
            if (getCurrentConfig().DEBUG_MODE) console.warn("Restart button clicked, but not paused or engine not ready.");
        }
    });
    mainMenuButton?.addEventListener('click', returnToMainMenu);

    // Settings/Controls Panel Toggles
    settingsPanelButton?.addEventListener('click', () => showSettingsPanel(settingsPanel));
    controlsPanelButton?.addEventListener('click', () => showSettingsPanel(controlsPanel));
    backButtons.forEach(button => button.addEventListener('click', hideSettingsPanels));

    // Apply & Save Settings Action
    applySaveButton?.addEventListener('click', () => {
        ConfigManager.saveConfig(); // Save current userConfig state (updated by UI elements)
        ConfigManager.applySettingsToEngine(simulatorEngine); // Apply the saved & merged config
        hideSettingsPanels(); // Return to the main pause menu view
        if (config.DEBUG_MODE) console.log("Settings Applied & Saved.");
        // Add brief visual feedback? e.g., change button text temporarily
    });


    // --- Global Event Listeners ---

    // Pause Menu Toggle (Escape Key)
    window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            event.preventDefault(); // Prevent potential browser default actions for Esc
            if (currentAppState === APP_STATE.SIMULATING) {
                showInSimMenu();
            } else if (currentAppState === APP_STATE.PAUSED) {
                // If a sub-panel is open, 'Esc' closes the panel first
                if (!settingsPanel.classList.contains('hidden') || !controlsPanel.classList.contains('hidden')) {
                    hideSettingsPanels();
                } else {
                    // Otherwise, 'Esc' closes the main pause menu (resumes)
                    hideInSimMenu();
                }
            }
        }
    });

    // Pointer Lock Management
    document.addEventListener('pointerlockchange', () => {
        if (document.pointerLockElement === canvasElement) {
            // Lock successfully acquired or re-acquired
            if (config.DEBUG_MODE) console.log('Pointer Lock engaged.');
            // If lock is acquired while PAUSED (e.g., user clicked canvas), resume simulation
            if (currentAppState === APP_STATE.PAUSED) {
                hideInSimMenu(); // Resume simulation and hide menu
            }
        } else {
            // Lock released (e.g., user pressed Esc, or alt-tabbed)
            if (config.DEBUG_MODE) console.log('Pointer Lock released.');
            // IMPORTANT: If the lock is released WHILE SIMULATING, force pause.
            // This prevents losing control if Esc was pressed (which already handles pausing)
            // but catches cases like Alt+Tab or other system events releasing the lock.
            if (currentAppState === APP_STATE.SIMULATING) {
                if (config.DEBUG_MODE) console.log("Pointer lock released unexpectedly while simulating, forcing pause.");
                showInSimMenu(); // Show menu, engine pause, set state to PAUSED
            }
        }
    }, false);

    document.addEventListener('pointerlockerror', () => {
        console.error('Pointer Lock Error! Ensure the document has focus and is interacted with.');
    }, false);

    // Allow clicking canvas to regain pointer lock if lost and simulating
    canvasElement.addEventListener('click', () => {
        if (currentAppState === APP_STATE.SIMULATING && document.pointerLockElement !== canvasElement) {
            canvasElement.requestPointerLock()
                .catch(err => console.warn("Pointer lock request on click failed:", err.name, err.message));
        }
        // Also handles resuming if PAUSED state by clicking canvas (pointerlockchange handles the resume logic)
        else if (currentAppState === APP_STATE.PAUSED) {
            canvasElement.requestPointerLock()
                .catch(err => console.warn("Pointer lock request on click failed (while paused):", err.name, err.message));
        }
    });

    if (config.DEBUG_MODE) console.log("App initialized, event listeners attached.");
}

// --- Application Entry Point ---
// ConfigManager is instantiated immediately upon import, loading config.
// Wait for the DOM to be fully loaded before initializing the app and setting up listeners.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    // DOMContentLoaded has already fired
    initializeApp();
}