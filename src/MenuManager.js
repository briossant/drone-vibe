// src/MenuManager.js
import EventBus, { EVENTS } from './EventBus.js';
import ConfigManager from './ConfigManager.js';
import UIComponentFactory from './UIComponentFactory.js'; // Import the factory

class MenuManager {
    constructor() {
        // Cache DOM Elements
        this.mainMenuElement = document.getElementById('main-menu');
        this.loadingIndicatorElement = document.getElementById('loading-indicator');
        this.flyButton = document.getElementById('fly-button');
        this.osdElement = document.getElementById('osd'); // Keep OSD ref if needed for hide/show
        this.canvasElement = document.getElementById('webgl-canvas'); // Keep ref for hide/show
        this.fadeOverlay = document.getElementById('fade-overlay');
        this.inSimMenuElement = document.getElementById('in-sim-menu');
        this.pauseMainOptions = document.getElementById('pause-main-options');
        this.settingsPanelButton = document.getElementById('settings-panel-button');
        this.controlsPanelButton = document.getElementById('controls-panel-button');
        this.settingsPanel = document.getElementById('settings-panel');
        this.controlsPanel = document.getElementById('controls-panel');
        this.graphicsSettingsContent = document.getElementById('graphics-settings-content');
        this.flySettingsContent = document.getElementById('fly-settings-content');
        this.physicsSettingsContent = document.getElementById('physics-settings-content');
        this.fcSettingsContent = document.createElement('div'); // Created dynamically below
        this.gamepadSettingsContent = document.getElementById('gamepad-settings-content');
        this.keyboardSettingsDisplay = document.getElementById('keyboard-settings-display');
        this.resumeButton = document.getElementById('resume-button');
        this.restartButton = document.getElementById('restart-button');
        this.mainMenuButton = document.getElementById('main-menu-button');
        this.applySaveButton = document.getElementById('apply-save-button');
        this.backButtons = document.querySelectorAll('.panel .back-button');

        if (MenuManager._instance) {
            return MenuManager._instance;
        }
        MenuManager._instance = this;
        console.log("MenuManager: Initialized (Singleton)");
    }

    initialize() {
        console.log("MenuManager: Initializing UI components and listeners...");
        this._populateSettingsPanels(); // Populate panels on init
        this._addEventListeners();      // Add listeners on init

        // Set initial visibility based on expected starting state (MENU)
        this.showMainMenu();
        this.hideLoading();
        this.hideInSimMenu();
        this.hideElement(this.canvasElement);
        this.hideElement(this.osdElement);
        this.hideElement(this.fadeOverlay);
    }

    // --- UI Visibility Control Methods ---

    showElement(element) { element?.classList.remove('hidden'); }
    hideElement(element) { element?.classList.add('hidden'); }

    showMainMenu() {
        this.showElement(this.mainMenuElement);
        this.hideElement(this.loadingIndicatorElement);
        this.hideElement(this.inSimMenuElement);
        this.hideElement(this.canvasElement);
        this.hideElement(this.osdElement);
    }

    showLoading(message = 'Loading...') {
        this.loadingIndicatorElement.querySelector('p').textContent = message;
        this.showElement(this.loadingIndicatorElement);
        this.hideElement(this.mainMenuElement);
        this.hideElement(this.inSimMenuElement);
        this.hideElement(this.canvasElement);
        this.hideElement(this.osdElement);
    }

    hideLoading() { this.hideElement(this.loadingIndicatorElement); }

    showSimulationView() {
        this.showElement(this.canvasElement);
        this.showElement(this.osdElement);
        this.hideElement(this.mainMenuElement);
        this.hideElement(this.loadingIndicatorElement);
        this.hideElement(this.inSimMenuElement);
    }

    showInSimMenu() {
        this.showElement(this.inSimMenuElement);
        this.showElement(this.pauseMainOptions); // Show main pause options first
        this.hideElement(this.settingsPanel);    // Hide specific panels
        this.hideElement(this.controlsPanel);
        this.hideElement(this.applySaveButton); // Hide save button initially
    }

    hideInSimMenu() {
        this.hideElement(this.inSimMenuElement);
    }

    showSettingsPanel(panelElement) {
        this.hideElement(this.pauseMainOptions);
        this.showElement(panelElement);
        this.showElement(this.applySaveButton);
        if (panelElement === this.settingsPanel) this.hideElement(this.controlsPanel);
        if (panelElement === this.controlsPanel) this.hideElement(this.settingsPanel);
    }

    hideSettingsPanels() {
        this.hideElement(this.settingsPanel);
        this.hideElement(this.controlsPanel);
        this.hideElement(this.applySaveButton);
        this.showElement(this.pauseMainOptions);
    }

    // --- Fade Transition ---
    async fadeTransition(actionBetweenFades) {
        if (!this.fadeOverlay) return;
        this.fadeOverlay.classList.remove('hidden');
        await new Promise(resolve => requestAnimationFrame(resolve));
        this.fadeOverlay.classList.add('visible');
        await new Promise(resolve => setTimeout(resolve, 300));

        if (actionBetweenFades) await actionBetweenFades();

        this.fadeOverlay.classList.remove('visible');
        await new Promise(resolve => setTimeout(resolve, 300));
        this.fadeOverlay.classList.add('hidden');
    }

    // --- Populate Settings Panels (Uses Factory) ---
    _populateSettingsPanels() {
        const config = ConfigManager.getConfig();

        // Clear previous controls
        this.graphicsSettingsContent.innerHTML = '<h4>Graphics Settings</h4>';
        this.flySettingsContent.innerHTML = '<h4>Fly Settings</h4>';
        this.physicsSettingsContent.innerHTML = '<h4>Physics Settings</h4>';

        // Handle FC Settings Content creation and insertion
        this.fcSettingsContent.id = 'fc-settings-content';
        this.settingsPanel.insertBefore(this.fcSettingsContent, this.physicsSettingsContent);
        this.fcSettingsContent.innerHTML = '<h4>Flight Controller Settings</h4>';

        this.gamepadSettingsContent.innerHTML = '<h4>Gamepad Settings</h4>';
        this.keyboardSettingsDisplay.innerHTML = '<h4>Keyboard Settings</h4>';

        // Use UIComponentFactory
        const { createSlider, createCheckbox, createNumberInput, createDisplayItem } = UIComponentFactory;

        // Graphics
        this.graphicsSettingsContent.appendChild(createCheckbox('Enable Bloom', 'GRAPHICS_SETTINGS.enableBloom'));
        this.graphicsSettingsContent.appendChild(createCheckbox('Enable Vignette', 'GRAPHICS_SETTINGS.enableVignette'));

        // Fly
        this.flySettingsContent.appendChild(createSlider('FPV FOV', 70, 140, 1, 'FPV_CAMERA_FOV'));

        // Flight Controller
        this.fcSettingsContent.appendChild(createSlider('Roll Rate P', 0, 2.0, 0.02, 'FLIGHT_CONTROLLER_SETTINGS.PID.roll.kp'));
        this.fcSettingsContent.appendChild(createSlider('Roll Rate I', 0, 1.0, 0.01, 'FLIGHT_CONTROLLER_SETTINGS.PID.roll.ki'));
        this.fcSettingsContent.appendChild(createSlider('Roll Rate D', 0, 0.2, 0.002, 'FLIGHT_CONTROLLER_SETTINGS.PID.roll.kd'));
        this.fcSettingsContent.appendChild(createSlider('Pitch Rate P', 0, 2.0, 0.02, 'FLIGHT_CONTROLLER_SETTINGS.PID.pitch.kp'));
        this.fcSettingsContent.appendChild(createSlider('Pitch Rate I', 0, 1.0, 0.01, 'FLIGHT_CONTROLLER_SETTINGS.PID.pitch.ki'));
        this.fcSettingsContent.appendChild(createSlider('Pitch Rate D', 0, 0.2, 0.002, 'FLIGHT_CONTROLLER_SETTINGS.PID.pitch.kd'));
        this.fcSettingsContent.appendChild(createSlider('Yaw Rate P', 0, 3.0, 0.05, 'FLIGHT_CONTROLLER_SETTINGS.PID.yaw.kp'));
        this.fcSettingsContent.appendChild(createSlider('Yaw Rate I', 0, 1.0, 0.01, 'FLIGHT_CONTROLLER_SETTINGS.PID.yaw.ki'));
        this.fcSettingsContent.appendChild(createSlider('Yaw Rate D', 0, 0.1, 0.002, 'FLIGHT_CONTROLLER_SETTINGS.PID.yaw.kd'));
        this.fcSettingsContent.appendChild(createSlider('PID I-Limit', 0, 1.0, 0.02, 'FLIGHT_CONTROLLER_SETTINGS.PID.iLimit'));

        // Physics
        this.physicsSettingsContent.appendChild(createSlider('Drone Mass (kg)', 0.1, 2.0, 0.05, 'DRONE_MASS'));
        this.physicsSettingsContent.appendChild(createSlider('Linear Damping', 0, 1, 0.05, 'DRONE_PHYSICS_SETTINGS.linearDamping'));
        this.physicsSettingsContent.appendChild(createSlider('Angular Damping', 0, 1, 0.01, 'DRONE_PHYSICS_SETTINGS.angularDamping'));

        // Gamepad Controls
        this.gamepadSettingsContent.appendChild(createSlider('Gamepad Deadzone', 0, 0.5, 0.01, 'GAMEPAD_DEADZONE'));
        this.gamepadSettingsContent.appendChild(createCheckbox('Invert Roll Axis', 'GAMEPAD_INVERT_AXES.roll'));
        this.gamepadSettingsContent.appendChild(createCheckbox('Invert Pitch Axis', 'GAMEPAD_INVERT_AXES.pitch'));
        this.gamepadSettingsContent.appendChild(createCheckbox('Invert Yaw Axis', 'GAMEPAD_INVERT_AXES.yaw'));
        this.gamepadSettingsContent.appendChild(createCheckbox('Invert Thrust Axis', 'GAMEPAD_INVERT_AXES.thrust'));
        this.gamepadSettingsContent.appendChild(createDisplayItem('Arm/Disarm Button', `Index ${config.GAMEPAD_BUTTON_MAPPING.armDisarm}`));
        this.gamepadSettingsContent.appendChild(createDisplayItem('Reset Button', `Index ${config.GAMEPAD_BUTTON_MAPPING.reset}`));

        // Keyboard Controls Display
        this.keyboardSettingsDisplay.appendChild(createSlider('Keyboard Roll Sens.', 0.1, 2.0, 0.05, 'KEYBOARD_SENSITIVITY.roll'));
        this.keyboardSettingsDisplay.appendChild(createSlider('Keyboard Pitch Sens.', 0.1, 2.0, 0.05, 'KEYBOARD_SENSITIVITY.pitch'));
        this.keyboardSettingsDisplay.appendChild(createSlider('Keyboard Yaw Sens.', 0.1, 2.0, 0.05, 'KEYBOARD_SENSITIVITY.yaw'));
        this.keyboardSettingsDisplay.appendChild(createDisplayItem('Pitch Keys', 'W/S/Up/Down'));
        this.keyboardSettingsDisplay.appendChild(createDisplayItem('Roll Keys', 'A/D/Left/Right'));
        this.keyboardSettingsDisplay.appendChild(createDisplayItem('Yaw Keys', 'Q/E'));
        this.keyboardSettingsDisplay.appendChild(createDisplayItem('Thrust Keys', 'Shift/Ctrl/Space'));
        this.keyboardSettingsDisplay.appendChild(createDisplayItem('Arm/Disarm Key', 'Enter'));
        this.keyboardSettingsDisplay.appendChild(createDisplayItem('Reset Key', 'R'));

        console.log("MenuManager: Settings panels populated.");
    }

    // --- Event Listeners Setup ---
    _addEventListeners() {
        // Main Menu
        this.flyButton?.addEventListener('click', () => EventBus.emit(EVENTS.FLY_BUTTON_CLICKED));

        // In-Sim Menu Buttons -> Emit events
        this.resumeButton?.addEventListener('click', () => EventBus.emit(EVENTS.RESUME_BUTTON_CLICKED));
        this.restartButton?.addEventListener('click', () => EventBus.emit(EVENTS.RESTART_BUTTON_CLICKED));
        this.mainMenuButton?.addEventListener('click', () => EventBus.emit(EVENTS.RETURN_TO_MAIN_MENU_CLICKED));
        this.settingsPanelButton?.addEventListener('click', () => this.showSettingsPanel(this.settingsPanel)); // Still direct UI manipulation within MenuManager
        this.controlsPanelButton?.addEventListener('click', () => this.showSettingsPanel(this.controlsPanel)); // Still direct UI manipulation within MenuManager
        this.applySaveButton?.addEventListener('click', () => {
            EventBus.emit(EVENTS.APPLY_SETTINGS_CLICKED);
            this.hideSettingsPanels(); // Hide panels after emitting event
        });
        this.backButtons.forEach(button => button.addEventListener('click', () => this.hideSettingsPanels())); // Direct UI manip is okay here

        // Canvas Click for Pointer Lock Request
        this.canvasElement?.addEventListener('click', () => EventBus.emit(EVENTS.CANVAS_CLICKED));

        console.log("MenuManager: Event listeners added.");
    }

    // --- Cleanup ---
    dispose() {
        // TODO: Remove event listeners if necessary, although usually handled by page unload
        console.log("MenuManager: Disposed (placeholder).");
    }
}

const menuManagerInstance = new MenuManager();
export default menuManagerInstance;