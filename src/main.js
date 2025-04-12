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
const resumeButton = document.getElementById('resume-button');
const restartButton = document.getElementById('restart-button');
const mainMenuButton = document.getElementById('main-menu-button');
const inSimMenuElement = document.getElementById('in-sim-menu');
const pauseMainOptions = document.getElementById('pause-main-options'); // Container for main pause buttons
const settingsPanelButton = document.getElementById('settings-panel-button');
const controlsPanelButton = document.getElementById('controls-panel-button');
const settingsPanel = document.getElementById('settings-panel');
const controlsPanel = document.getElementById('controls-panel');
const flySettingsContent = document.getElementById('fly-settings-content'); // NEW
const physicsSettingsContent = document.getElementById('physics-settings-content'); // NEW
const gamepadSettingsContent = document.getElementById('gamepad-settings-content'); // NEW
const keyboardSettingsDisplay = document.getElementById('keyboard-settings-display'); // NEW
const applySaveButton = document.getElementById('apply-save-button');
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

// --- In-Simulation Menu Logic (Update show/hide panel logic) ---
function showInSimMenu() {
    if (currentAppState !== APP_STATE.SIMULATING) return;

    setAppState(APP_STATE.PAUSED);
    simulatorEngine?.pause();
    showElement(inSimMenuElement);
    showElement(pauseMainOptions); // Ensure main options are visible initially
    hideElement(settingsPanel);
    hideElement(controlsPanel);
    hideElement(applySaveButton);
    document.exitPointerLock();
    if (getCurrentConfig().DEBUG_MODE) console.log("In-Sim Menu Shown, Pointer Lock Released");
}

function hideInSimMenu() {
    if (currentAppState !== APP_STATE.PAUSED) return;

    hideElement(inSimMenuElement);
    simulatorEngine?.resume();
    setAppState(APP_STATE.SIMULATING);
    canvasElement.requestPointerLock()
        .catch(err => console.warn("Pointer lock request failed after resume:", err.name, err.message));
    if (getCurrentConfig().DEBUG_MODE) console.log("In-Sim Menu Hidden, Resuming Simulation");
}

function showSettingsPanel(panelElement) {
    hideElement(pauseMainOptions); // Hide the main pause menu buttons
    showElement(panelElement);     // Show the selected panel
    showElement(applySaveButton);  // Show the apply/save button
    // Ensure the other panel is hidden if switching directly
    if (panelElement === settingsPanel) hideElement(controlsPanel);
    if (panelElement === controlsPanel) hideElement(settingsPanel);
}

function hideSettingsPanels() {
    hideElement(settingsPanel);
    hideElement(controlsPanel);
    hideElement(applySaveButton);
    showElement(pauseMainOptions); // Show the main pause menu buttons again
}


/** Creates a container div for a setting item */
function createSettingItem(labelText) {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'setting-item';

    const label = document.createElement('label');
    label.textContent = labelText;
    itemDiv.appendChild(label);

    const controlContainer = document.createElement('div');
    controlContainer.className = 'control-container';
    itemDiv.appendChild(controlContainer);

    return { itemDiv, controlContainer };
}

/** Creates a slider with label and value display */
function createSlider(labelText, min, max, step, configKeyPath) {
    const { itemDiv, controlContainer } = createSettingItem(labelText);
    const config = ConfigManager.getConfig();
    const keys = configKeyPath.split('.');
    const initialValue = keys.reduce((obj, key) => (obj && obj[key] !== 'undefined') ? obj[key] : 0, config);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = min;
    slider.max = max;
    slider.step = step;
    slider.value = initialValue;
    controlContainer.appendChild(slider);

    const valueDisplay = document.createElement('span');
    valueDisplay.className = 'value-display';
    valueDisplay.textContent = Number(initialValue).toFixed(step.toString().includes('.') ? step.toString().split('.')[1].length : 0); // Format based on step
    controlContainer.appendChild(valueDisplay);

    slider.addEventListener('input', () => {
        const numericValue = parseFloat(slider.value);
        valueDisplay.textContent = numericValue.toFixed(step.toString().includes('.') ? step.toString().split('.')[1].length : 0);
        ConfigManager.updateUserSetting(configKeyPath, numericValue);
    });

    return itemDiv;
}

/** Creates a number input with label */
function createNumberInput(labelText, min, max, step, configKeyPath) {
    const { itemDiv, controlContainer } = createSettingItem(labelText);
    const config = ConfigManager.getConfig();
    const keys = configKeyPath.split('.');
    const initialValue = keys.reduce((obj, key) => (obj && obj[key] !== 'undefined') ? obj[key] : 0, config);

    const numberInput = document.createElement('input');
    numberInput.type = 'number';
    numberInput.min = min;
    numberInput.max = max;
    numberInput.step = step;
    numberInput.value = initialValue;
    controlContainer.appendChild(numberInput); // Add input to control container

    numberInput.addEventListener('change', () => { // Use change instead of input for number fields typically
        let numericValue = parseFloat(numberInput.value);
        // Clamp value within min/max
        numericValue = Math.max(min, Math.min(max, numericValue));
        numberInput.value = numericValue; // Update input field if clamped
        ConfigManager.updateUserSetting(configKeyPath, numericValue);
    });

    // Add a simple span wrapper for alignment if needed, or style input directly
    // const wrapper = document.createElement('span'); // Optional wrapper
    // wrapper.appendChild(numberInput);
    // controlContainer.appendChild(wrapper);

    return itemDiv;
}


/** Creates a checkbox with label */
function createCheckbox(labelText, configKeyPath) {
    const { itemDiv, controlContainer } = createSettingItem(labelText);
    const config = ConfigManager.getConfig();
    const keys = configKeyPath.split('.');
    const initialValue = keys.reduce((obj, key) => (obj && obj[key] !== 'undefined') ? obj[key] : false, config);

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = initialValue;
    // controlContainer.appendChild(checkbox); // Append directly to container
    controlContainer.style.justifyContent = 'flex-end'; // Push checkbox to the right
    controlContainer.appendChild(checkbox);


    checkbox.addEventListener('change', () => {
        ConfigManager.updateUserSetting(configKeyPath, checkbox.checked);
    });

    return itemDiv;
}

/** Creates a simple text display item */
function createDisplayItem(labelText, valueText) {
    const { itemDiv, controlContainer } = createSettingItem(labelText);
    const valueDisplay = document.createElement('span');
    valueDisplay.className = 'value-display'; // Reuse class for style
    valueDisplay.textContent = valueText;
    valueDisplay.style.fontWeight = 'normal'; // Optional: make it less bold than slider values
    controlContainer.appendChild(valueDisplay);
    return itemDiv;
}


// --- NEW: Populate Settings Panels ---
function populateSettingsPanels() {
    const config = ConfigManager.getConfig(); // Get current merged config

    // Clear previous controls if any (e.g., if called multiple times)
    flySettingsContent.innerHTML = '<h4>Fly Settings</h4>';
    physicsSettingsContent.innerHTML = '<h4>Physics Settings</h4>';
    const fcSettingsContent = document.createElement('div'); // Create a new div for FC settings
    fcSettingsContent.id = 'fc-settings-content';
    settingsPanel.insertBefore(fcSettingsContent, physicsSettingsContent); // Insert before physics
    fcSettingsContent.innerHTML = '<h4>Flight Controller Settings</h4>';
    gamepadSettingsContent.innerHTML = '<h4>Gamepad Settings</h4>';
    keyboardSettingsDisplay.innerHTML = '<h4>Keyboard Settings</h4>';


    // --- Fly Settings Panel ---
    flySettingsContent.appendChild(createSlider('FPV FOV', 70, 140, 1, 'FPV_CAMERA_FOV'));
    // Add sensitivity later if needed

    // --- Flight Controller Panel ---
    // Roll PID
    fcSettingsContent.appendChild(createSlider('Roll Rate P', 0, 2.0, 0.02, 'FLIGHT_CONTROLLER_SETTINGS.PID.roll.kp')); // Max 2.0, Step 0.02
    fcSettingsContent.appendChild(createSlider('Roll Rate I', 0, 1.0, 0.01, 'FLIGHT_CONTROLLER_SETTINGS.PID.roll.ki')); // Max 1.0, Step 0.01
    fcSettingsContent.appendChild(createSlider('Roll Rate D', 0, 0.2, 0.002, 'FLIGHT_CONTROLLER_SETTINGS.PID.roll.kd')); // Max 0.2, Step 0.002
    // Pitch PID
    fcSettingsContent.appendChild(createSlider('Pitch Rate P', 0, 2.0, 0.02, 'FLIGHT_CONTROLLER_SETTINGS.PID.pitch.kp'));// Max 2.0, Step 0.02
    fcSettingsContent.appendChild(createSlider('Pitch Rate I', 0, 1.0, 0.01, 'FLIGHT_CONTROLLER_SETTINGS.PID.pitch.ki'));// Max 1.0, Step 0.01
    fcSettingsContent.appendChild(createSlider('Pitch Rate D', 0, 0.2, 0.002, 'FLIGHT_CONTROLLER_SETTINGS.PID.pitch.kd'));// Max 0.2, Step 0.002
    // Yaw PID
    fcSettingsContent.appendChild(createSlider('Yaw Rate P', 0, 3.0, 0.05, 'FLIGHT_CONTROLLER_SETTINGS.PID.yaw.kp'));  // Max 3.0, Step 0.05 (Yaw P often higher)
    fcSettingsContent.appendChild(createSlider('Yaw Rate I', 0, 1.0, 0.01, 'FLIGHT_CONTROLLER_SETTINGS.PID.yaw.ki'));  // Max 1.0, Step 0.01
    fcSettingsContent.appendChild(createSlider('Yaw Rate D', 0, 0.1, 0.002, 'FLIGHT_CONTROLLER_SETTINGS.PID.yaw.kd'));  // Max 0.1, Step 0.002 (Yaw D often lower)
    // Shared I Limit
    fcSettingsContent.appendChild(createSlider('PID I-Limit', 0, 1.0, 0.02, 'FLIGHT_CONTROLLER_SETTINGS.PID.iLimit')); // Max 1.0, Step 0.02

    // --- Physics Settings Panel ---
    physicsSettingsContent.appendChild(createSlider('Drone Mass (kg)', 0.1, 2.0, 0.05, 'DRONE_MASS'));
    physicsSettingsContent.appendChild(createSlider('Linear Damping', 0, 1, 0.05, 'DRONE_PHYSICS_SETTINGS.linearDamping'));
    physicsSettingsContent.appendChild(createSlider('Angular Damping', 0, 1, 0.01, 'DRONE_PHYSICS_SETTINGS.angularDamping'));

    // --- Controls Panel (Gamepad) ---
    gamepadSettingsContent.appendChild(createSlider('Gamepad Deadzone', 0, 0.5, 0.01, 'GAMEPAD_DEADZONE'));
    gamepadSettingsContent.appendChild(createCheckbox('Invert Roll Axis', 'GAMEPAD_INVERT_AXES.roll'));
    gamepadSettingsContent.appendChild(createCheckbox('Invert Pitch Axis', 'GAMEPAD_INVERT_AXES.pitch'));
    gamepadSettingsContent.appendChild(createCheckbox('Invert Yaw Axis', 'GAMEPAD_INVERT_AXES.yaw'));
    gamepadSettingsContent.appendChild(createCheckbox('Invert Thrust Axis', 'GAMEPAD_INVERT_AXES.thrust'));
    // Display current button mapping (non-interactive for now)
    gamepadSettingsContent.appendChild(createDisplayItem('Arm/Disarm Button', `Index ${config.GAMEPAD_BUTTON_MAPPING.armDisarm}`));
    gamepadSettingsContent.appendChild(createDisplayItem('Reset Button', `Index ${config.GAMEPAD_BUTTON_MAPPING.reset}`));


    // --- Controls Panel (Keyboard Display) ---
    keyboardSettingsDisplay.appendChild(createSlider('Keyboard Roll Sens.', 0.1, 2.0, 0.05, 'KEYBOARD_SENSITIVITY.roll'));
    keyboardSettingsDisplay.appendChild(createSlider('Keyboard Pitch Sens.', 0.1, 2.0, 0.05, 'KEYBOARD_SENSITIVITY.pitch'));
    keyboardSettingsDisplay.appendChild(createSlider('Keyboard Yaw Sens.', 0.1, 2.0, 0.05, 'KEYBOARD_SENSITIVITY.yaw'));
    // Display basic key mapping (non-interactive)
    keyboardSettingsDisplay.appendChild(createDisplayItem('Pitch Keys', 'W / S / Up / Down'));
    keyboardSettingsDisplay.appendChild(createDisplayItem('Roll Keys', 'A / D / Left / Right'));
    keyboardSettingsDisplay.appendChild(createDisplayItem('Yaw Keys', 'Q / E'));
    keyboardSettingsDisplay.appendChild(createDisplayItem('Thrust Keys', 'Shift (Up), Ctrl (Down), Space (Cut)'));
    keyboardSettingsDisplay.appendChild(createDisplayItem('Arm/Disarm Key', 'Enter'));
    keyboardSettingsDisplay.appendChild(createDisplayItem('Reset Key', 'R'));


    if (config.DEBUG_MODE) console.log("Settings panels populated with controls.");
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

    populateSettingsPanels(); // << Call the new function


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