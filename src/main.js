// src/main.js
import SimulatorEngine from './SimulatorEngine.js';
// Remove direct Config import if not needed here anymore
// import Config from './Config.js';
import AssetLoader from './AssetLoader.js';
import ConfigManager, { getCurrentConfig } from './ConfigManager.js'; // Import manager

// --- Application States ---
const APP_STATE = {
    MENU: 'MENU',
    LOADING: 'LOADING',
    SIMULATING: 'SIMULATING',
    PAUSED: 'PAUSED', // Added PAUSED state
};
let currentAppState = APP_STATE.MENU;
let simulatorEngine = null;

// --- DOM Elements ---
const mainMenuElement = document.getElementById('main-menu');
const loadingIndicatorElement = document.getElementById('loading-indicator');
const flyButton = document.getElementById('fly-button');
// ... other buttons ...
const canvasElement = document.getElementById('webgl-canvas');
const osdElement = document.getElementById('osd');
// NEW: In-Sim Menu elements
const inSimMenuElement = document.getElementById('in-sim-menu');
const resumeButton = document.getElementById('resume-button');
const restartButton = document.getElementById('restart-button');
const mainMenuButton = document.getElementById('main-menu-button');
const applySaveButton = document.getElementById('apply-save-button');
// Panel Buttons and Panels
const settingsPanelButton = document.getElementById('settings-panel-button');
const controlsPanelButton = document.getElementById('controls-panel-button');
const settingsPanel = document.getElementById('settings-panel');
const controlsPanel = document.getElementById('controls-panel');
const backButtons = document.querySelectorAll('.panel .back-button'); // Get all back buttons in panels

// --- Helper Functions ---
// ... showElement / hideElement ...

// --- State Management ---
function setAppState(newState) {
    if (currentAppState !== newState) {
        // const config = getCurrentConfig(); // Get config using helper
        // if (config.DEBUG_MODE) { // Use loaded config for debug check
        //     console.log(`App state changed: ${currentAppState} -> ${newState}`);
        // }
        console.log(`App state changed: ${currentAppState} -> ${newState}`); // Log state changes unconditionally for now
        currentAppState = newState;
    }
}


// --- In-Sim Menu Logic ---
function showInSimMenu() {
    if (currentAppState !== APP_STATE.SIMULATING) return;
    setAppState(APP_STATE.PAUSED);
    simulatorEngine?.pause(); // Tell engine to pause
    showElement(inSimMenuElement);
    hideElement(settingsPanel); // Ensure panels are hidden initially
    hideElement(controlsPanel);
    hideElement(applySaveButton);
    document.exitPointerLock(); // Release mouse control
}

function hideInSimMenu() {
    if (currentAppState !== APP_STATE.PAUSED) return;
    hideElement(inSimMenuElement);
    simulatorEngine?.resume(); // Tell engine to resume logic (doesn't request lock anymore)
    setAppState(APP_STATE.SIMULATING);

    // Now, attempt to lock pointer since the user likely clicked "Resume" or the canvas
    canvasElement.requestPointerLock()
        .then(() => {
            // Optional: Confirmation log
            // console.log("Pointer lock requested successfully after resuming.");
        })
        .catch(err => {
            // Log the error, but don't force pause again immediately
            console.warn("Pointer lock request failed after resume:", err.name, err.message);
        });
}

function showPanel(panelElement) {
    hideElement(settingsPanelButton.parentNode); // Hide main menu buttons inside content div
    showElement(panelElement);
    showElement(applySaveButton);
}

function hidePanels() {
    hideElement(settingsPanel);
    hideElement(controlsPanel);
    hideElement(applySaveButton);
    showElement(settingsPanelButton.parentNode); // Show main menu buttons again
}


// --- Core Simulation Start Logic ---
async function startSimulation() {
    if (currentAppState !== APP_STATE.MENU) return;

    setAppState(APP_STATE.LOADING);
    hideElement(mainMenuElement);
    showElement(loadingIndicatorElement);
    if (osdElement) osdElement.innerHTML = '';
    hideElement(osdElement);

    const config = getCurrentConfig(); // Get config using helper
    if (config.DEBUG_MODE) {
        console.log("Loading assets...");
    }

    try {
        await AssetLoader.preloadAssets();
        if (config.DEBUG_MODE) console.log("Assets loaded.");
        loadingIndicatorElement.querySelector('p').textContent = 'Initializing simulator...';

        // Create and Initialize Engine
        console.log("DEBUG: About to initialize engine..."); // ADD THIS
        simulatorEngine = new SimulatorEngine();
        await simulatorEngine.initialize(); // Engine uses getCurrentConfig() internally now
        console.log("DEBUG: Engine initialization finished."); // ADD THIS

        if (config.DEBUG_MODE) console.log("Simulator engine initialized.");

        // Apply initial config loaded by ConfigManager
        ConfigManager.applySettingsToEngine(simulatorEngine);

        hideElement(loadingIndicatorElement);
        showElement(canvasElement);
        showElement(osdElement);

        simulatorEngine.start();
        setAppState(APP_STATE.SIMULATING);

        if (config.DEBUG_MODE) {
            window.simEngine = simulatorEngine;
            console.log("SimulatorEngine instance available as 'window.simEngine'");
        }
        // Request pointer lock after a short delay or on first click? Let's try on start
        canvasElement.requestPointerLock();


    } catch (error) {
        // ... (Error handling as before) ...
        setAppState(APP_STATE.MENU);
    }
}

// --- Return to Main Menu ---
function returnToMainMenu() {
    if (simulatorEngine) {
        simulatorEngine.stop(); // Stop the loop
        simulatorEngine.dispose(); // Clean up resources (implement dispose in engine)
        simulatorEngine = null;
        window.simEngine = null; // Clear debug reference
    }
    hideElement(inSimMenuElement);
    hideElement(canvasElement);
    hideElement(osdElement);
    showElement(mainMenuElement);
    // Clear any error messages potentially added to main menu
    const errorP = mainMenuElement.querySelector('.menu-content p[style*="color: red"]');
    if (errorP) errorP.remove();

    setAppState(APP_STATE.MENU);
    document.exitPointerLock(); // Ensure pointer lock is released
}

// --- Helper Functions ---
function showElement(element) {
    element?.classList.remove('hidden');
}

function hideElement(element) {
    element?.classList.add('hidden');
}


// --- Initial Setup Function ---
function initializeApp() {
    const config = getCurrentConfig(); // Config loaded by ConfigManager instance
    if (config.DEBUG_MODE) {
        console.log("App starting... Initial state:", currentAppState);
    }

    // Ensure correct elements are visible/hidden initially
    if (currentAppState === APP_STATE.MENU) {
        showElement(mainMenuElement);
        hideElement(loadingIndicatorElement);
        hideElement(inSimMenuElement);
        hideElement(canvasElement);
        hideElement(osdElement);
    } // Add else if needed for other start states (e.g. deep linking)

    // --- Add Event Listeners ---
    // Main Menu
    flyButton?.addEventListener('click', startSimulation);
    // settingsButton / controlsButton listeners (remain placeholders)

    // In-Sim Menu
    resumeButton?.addEventListener('click', hideInSimMenu);
    restartButton?.addEventListener('click', () => {
        if (simulatorEngine && currentAppState === APP_STATE.PAUSED) {
            hideInSimMenu(); // Resume first
            simulatorEngine.restartFlight(); // Then restart
        }
    });
    mainMenuButton?.addEventListener('click', returnToMainMenu);

    // Panel Toggles
    settingsPanelButton?.addEventListener('click', () => showPanel(settingsPanel));
    controlsPanelButton?.addEventListener('click', () => showPanel(controlsPanel));
    backButtons.forEach(button => button.addEventListener('click', hidePanels));

    // Apply & Save
    applySaveButton?.addEventListener('click', () => {
        ConfigManager.saveConfig(); // Save the current userConfig from memory
        ConfigManager.applySettingsToEngine(simulatorEngine); // Re-apply the merged config
        // Maybe add visual feedback "Settings Saved!"
        hidePanels(); // Go back to main pause menu after saving
        console.log("Settings Applied & Saved.");
    });


    // Global listener for Esc key (for pausing)
    window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            if (currentAppState === APP_STATE.SIMULATING) {
                showInSimMenu();
            } else if (currentAppState === APP_STATE.PAUSED) {
                // If a panel is open, close it first, otherwise close the menu
                if (!settingsPanel.classList.contains('hidden') || !controlsPanel.classList.contains('hidden')) {
                    hidePanels();
                } else {
                    hideInSimMenu();
                }
            }
        }
    });

    document.addEventListener('pointerlockchange', () => {
        const config = getCurrentConfig();
        if (document.pointerLockElement === canvasElement) {
            // Pointer Lock was successfully engaged
            if (config.DEBUG_MODE) console.log('Pointer Lock engaged.');
            // If we were paused but lock is now engaged, ensure we are simulating
            // This handles resuming by clicking the canvas when paused
            if (currentAppState === APP_STATE.PAUSED) {
                hideInSimMenu(); // This calls resume() and sets state internally now
            }
        } else {
            // Pointer Lock was released or failed to engage
            if (config.DEBUG_MODE) console.log('Pointer Lock released.');
            // If the sim is supposed to be running BUT lock is released,
            // THEN force the pause menu. This prevents pausing if we *intended*
            // to release the lock by pressing Esc (which already sets state to PAUSED).
            if (currentAppState === APP_STATE.SIMULATING) {
                console.log("Pointer lock released while simulating, forcing pause."); // Add log
                showInSimMenu(); // Show menu, pause engine, set state to PAUSED
            }
        }
    }, false);

    document.addEventListener('pointerlockerror', () => {
        console.error('Pointer Lock Error!');
    }, false);

    // Re-request pointer lock on canvas click if lost and sim is running
    canvasElement.addEventListener('click', () => {
        if (currentAppState === APP_STATE.SIMULATING && document.pointerLockElement !== canvasElement) {
            canvasElement.requestPointerLock();
        }
    });

}

// --- Main Execution ---
// ConfigManager is instantiated immediately when imported.
// Wait for DOM load before setting up listeners etc.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}