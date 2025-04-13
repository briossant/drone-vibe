// src/ui/MenuManager.js
import EventBus, { EVENTS } from '../utils/EventBus.js';
import ConfigManager from '../config/ConfigManager.js';
import UIComponentFactory from './UIComponentFactory.js';
import StateManager from "../managers/StateManager.js";
import InputManager from "../managers/InputManager.js";

class MenuManager {
    constructor() {
        // --- NEW/MODIFIED: Cache NEW DOM Elements ---
        this.mainMenuElement = document.getElementById('main-menu');
        this.loadingIndicatorElement = document.getElementById('loading-indicator');
        this.flyButton = document.getElementById('fly-button');
        this.osdElement = document.getElementById('osd');
        this.canvasElement = document.getElementById('webgl-canvas');
        this.fadeOverlay = document.getElementById('fade-overlay');
        this.gamepadStatusElement = document.getElementById('gamepad-status'); // Cache status element
        this.gamepadVisualElement = document.getElementById('gamepad-visual'); // Cache visual elem

        this.gamepadStatusInterval = null; // Interval ID for polling status

        // In-Sim Menu Elements
        this.inSimMenuElement = document.getElementById('in-sim-menu');
        this.sidebar = this.inSimMenuElement?.querySelector('.menu-sidebar');
        this.contentArea = this.inSimMenuElement?.querySelector('.menu-content-area');

        // Sidebar Buttons (Action Buttons)
        this.resumeButton = document.getElementById('resume-button');
        this.restartButton = document.getElementById('restart-button');
        this.mainMenuButton = document.getElementById('main-menu-button');

        // Sidebar Buttons (View Triggers)
        this.sidebarButtons = this.sidebar?.querySelectorAll('.sidebar-button[data-view]'); // Select only buttons with data-view

        // Content Views
        this.contentViews = this.contentArea?.querySelectorAll('.content-view');
        this.settingsView = document.getElementById('pause-settings-view');
        this.controlsView = document.getElementById('pause-controls-view');

        // Sub-Navigation Buttons (within each view)
        this.subNavButtons = this.contentArea?.querySelectorAll('.sub-nav-button[data-panel]');

        // Content Panels (within each view)
        this.contentPanels = this.contentArea?.querySelectorAll('.panel-content');
        this.graphicsSettingsContent = document.getElementById('graphics-settings-content');
        this.flySettingsContent = document.getElementById('fly-settings-content');
        this.physicsSettingsContent = document.getElementById('physics-settings-content');
        // Note: fcSettingsContent is dynamically created, handled in _populateSettingsPanels
        this.gamepadSettingsContent = document.getElementById('gamepad-settings-content');
        this.keyboardSettingsDisplay = document.getElementById('keyboard-settings-display');
        this.fcSettingsContent = null; // Will be assigned in _populate

        this.activeView = null; // Track the currently active view element
        this.activePanels = {}; // Track active panel per view { viewId: panelId }

        this.audioListener = StateManager.context?.audioListener || null; // Get listener from context
        this.sounds = {}; // Cache THREE.Audio objects

        if (MenuManager._instance) {
            return MenuManager._instance;
        }
        MenuManager._instance = this;
        console.log("MenuManager: Initialized (Singleton)");
    }

    initialize() {
        console.log("MenuManager: Initializing UI components and listeners...");
        this._populateSettingsPanels();
        this._addEventListeners();

        // Set initial visibility
        this.showMainMenu();
        this.hideLoading();
        this.hideInSimMenu();
        this.hideElement(this.canvasElement);
        this.hideElement(this.osdElement);
        this.hideElement(this.fadeOverlay);
        this._setupAudio(); // Call audio setup
    }

    // --- NEW: Audio Setup ---
    _setupAudio() {
        if (!this.audioListener) {
            console.warn("MenuManager: AudioListener not found in context. Cannot setup sounds.");
            // Attempt to get it again (might be available later)
            this.audioListener = StateManager.context?.audioListener;
            if(!this.audioListener) return;
        }

        const soundKeys = ['ui_click', 'ui_hover', 'ui_toggle', 'ui_open', 'ui_close'];
        soundKeys.forEach(key => {
            const buffer = AssetLoader.getSoundBuffer(key);
            if (buffer) {
                const sound = new THREE.Audio(this.audioListener);
                sound.setBuffer(buffer);
                sound.setVolume(0.5); // Default volume
                this.sounds[key] = sound;
                if(ConfigManager.getConfig().DEBUG_MODE) console.log(`MenuManager: Created THREE.Audio for '${key}'`);
            } else {
                console.warn(`MenuManager: Audio buffer not found for key '${key}'`);
            }
        });
    }

    // --- NEW: Play Sound Method ---
    _playSound(key) {
        if (this.sounds[key]) {
            // Ensure audio context is running (requires user interaction first)
            if (this.audioListener && this.audioListener.context.state === 'suspended') {
                this.audioListener.context.resume();
            }
            // Stop previous instance if playing, then play new
            if (this.sounds[key].isPlaying) {
                this.sounds[key].stop();
            }
            this.sounds[key].play();
        } else {
            // console.warn(`MenuManager: Attempted to play sound '${key}' but it's not ready.`);
        }
    }

    // --- UI Visibility Control Methods (Mostly Unchanged) ---

    showElement(element) { element?.classList.remove('hidden'); }
    hideElement(element) { element?.classList.add('hidden'); }

    showMainMenu() {
        this.showElement(this.mainMenuElement);
        this.hideElement(this.loadingIndicatorElement);
        this.hideInSimMenu(); // Use specific hide method
        this.hideElement(this.canvasElement);
        this.hideElement(this.osdElement);
    }

    showLoading(message = 'Loading...') {
        this.loadingIndicatorElement.querySelector('p').textContent = message;
        this.showElement(this.loadingIndicatorElement);
        this.hideElement(this.mainMenuElement);
        this.hideInSimMenu();
        this.hideElement(this.canvasElement);
        this.hideElement(this.osdElement);
    }

    hideLoading() { this.hideElement(this.loadingIndicatorElement); }

    showSimulationView() {
        this.showElement(this.canvasElement);
        this.showElement(this.osdElement);
        this.hideElement(this.mainMenuElement);
        this.hideElement(this.loadingIndicatorElement);
        this.hideInSimMenu();
    }

    // --- NEW/MODIFIED: In-Sim Menu Visibility ---
    showInSimMenu() {
        this.showElement(this.inSimMenuElement);
        this._deactivateAllViews();
        this._deactivateAllSidebarButtons();
        this.activeView = null;
        this._playSound('ui_open'); // <<< Play open sound
    }

    hideInSimMenu() {
        // Check if it's currently visible before playing sound
        if (!this.inSimMenuElement?.classList.contains('hidden')) {
            this._playSound('ui_close'); // <<< Play close sound
        }
        this.hideElement(this.inSimMenuElement);
        this.activeView = null;
        this._stopGamepadStatusPolling();
    }

    // --- Fade Transition (Unchanged) ---
    async fadeTransition(actionBetweenFades) {
        // ... (keep existing implementation)
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

    // --- Populate Settings Panels (Adjusted for new structure) ---
    _populateSettingsPanels() {
        const config = ConfigManager.getConfig();

        // --- NEW/MODIFIED: Clear specific containers ---
        // Clear using direct references if they exist
        this.graphicsSettingsContent?.replaceChildren(); // Use replaceChildren for modern browsers
        this.flySettingsContent?.replaceChildren();
        this.physicsSettingsContent?.replaceChildren();
        this.gamepadSettingsContent?.replaceChildren();
        this.keyboardSettingsDisplay?.replaceChildren();

        // Handle FC Settings Content creation and insertion if not already done
        if (!this.fcSettingsContent && this.physicsSettingsContent) {
            this.fcSettingsContent = document.createElement('div');
            this.fcSettingsContent.id = 'fc-settings-content';
            this.fcSettingsContent.className = 'panel-content'; // Assign class
            // Insert FC settings before Physics settings
            this.physicsSettingsContent.parentNode.insertBefore(this.fcSettingsContent, this.physicsSettingsContent);
        }
        this.fcSettingsContent?.replaceChildren(); // Clear it

        // Use UIComponentFactory
        const { createSlider, createCheckbox, createDisplayItem, createResetButton } = UIComponentFactory;

        // Append to the correct containers
        this.graphicsSettingsContent?.appendChild(this._createHeading('Graphics Settings'));
        this.graphicsSettingsContent?.appendChild(createCheckbox('Enable Bloom', 'GRAPHICS_SETTINGS.enableBloom'));
        this.graphicsSettingsContent?.appendChild(createCheckbox('Enable Vignette', 'GRAPHICS_SETTINGS.enableVignette'));
        this.graphicsSettingsContent?.appendChild(createSlider('FPV FOV', 70, 140, 1, 'FPV_CAMERA_FOV'));
        this.graphicsSettingsContent?.appendChild(createResetButton('Reset Graphics', 'GRAPHICS_SETTINGS')); // <<< ADD

        this.flySettingsContent?.appendChild(this._createHeading('Fly Settings'));
        this.flySettingsContent?.appendChild(createSlider('FPV Camera Angle (°)', -20, 60, 1, 'FPV_CAMERA_ANGLE_DEG'));
        this.flySettingsContent?.appendChild(createResetButton('Reset Fly Settings', 'FPV_CAMERA_ANGLE_DEG')); // Reset specific fly setting example
        this.flySettingsContent?.appendChild(createResetButton('Reset FOV', 'FPV_CAMERA_FOV')); // Reset specific fly setting example

        this.fcSettingsContent?.appendChild(this._createHeading('Flight Controller Settings'));
        this.fcSettingsContent?.appendChild(createSlider('Roll Rate P', 0, 2.0, 0.01, 'FLIGHT_CONTROLLER_SETTINGS.PID.roll.kp'));
        this.fcSettingsContent?.appendChild(createSlider('Roll Rate I', 0, 1.0, 0.01, 'FLIGHT_CONTROLLER_SETTINGS.PID.roll.ki'));
        this.fcSettingsContent?.appendChild(createSlider('Roll Rate D', 0, 0.2, 0.002, 'FLIGHT_CONTROLLER_SETTINGS.PID.roll.kd'));
        this.fcSettingsContent?.appendChild(createSlider('Pitch Rate P', 0, 2.0, 0.02, 'FLIGHT_CONTROLLER_SETTINGS.PID.pitch.kp'));
        this.fcSettingsContent?.appendChild(createSlider('Pitch Rate I', 0, 1.0, 0.01, 'FLIGHT_CONTROLLER_SETTINGS.PID.pitch.ki'));
        this.fcSettingsContent?.appendChild(createSlider('Pitch Rate D', 0, 0.2, 0.002, 'FLIGHT_CONTROLLER_SETTINGS.PID.pitch.kd'));
        this.fcSettingsContent?.appendChild(createSlider('Yaw Rate P', 0, 3.0, 0.05, 'FLIGHT_CONTROLLER_SETTINGS.PID.yaw.kp'));
        this.fcSettingsContent?.appendChild(createSlider('Yaw Rate I', 0, 1.0, 0.01, 'FLIGHT_CONTROLLER_SETTINGS.PID.yaw.ki'));
        this.fcSettingsContent?.appendChild(createSlider('Yaw Rate D', 0, 0.1, 0.002, 'FLIGHT_CONTROLLER_SETTINGS.PID.yaw.kd'));
        this.fcSettingsContent?.appendChild(createSlider('PID I-Limit', 0, 1.0, 0.02, 'FLIGHT_CONTROLLER_SETTINGS.PID.iLimit'));
        this.fcSettingsContent?.appendChild(createSlider('Max Roll/Pitch Rate (°/s)', 100, 1500, 10, 'FLIGHT_CONTROLLER_SETTINGS.RATE_LIMITS.roll'));
        this.fcSettingsContent?.appendChild(createSlider('Max Yaw Rate (°/s)', 100, 1000, 10, 'FLIGHT_CONTROLLER_SETTINGS.RATE_LIMITS.yaw'));
        this.fcSettingsContent?.appendChild(createResetButton('Reset Flight Controller', 'FLIGHT_CONTROLLER_SETTINGS')); // <<< ADD

        this.physicsSettingsContent?.appendChild(this._createHeading('Physics Settings'));
        this.physicsSettingsContent?.appendChild(createSlider('Drone Mass (kg)', 0.1, 2.0, 0.05, 'DRONE_MASS'));
        this.physicsSettingsContent?.appendChild(createSlider('Linear Damping', 0, 1, 0.02, 'DRONE_PHYSICS_SETTINGS.linearDamping'));
        this.physicsSettingsContent?.appendChild(createSlider('Angular Damping', 0, 1, 0.02, 'DRONE_PHYSICS_SETTINGS.angularDamping'));
        this.physicsSettingsContent?.appendChild(createResetButton('Reset Physics', 'DRONE_PHYSICS_SETTINGS')); // <<< ADD
        this.physicsSettingsContent?.appendChild(createResetButton('Reset Mass', 'DRONE_MASS')); // <<< ADD Specific

        this.gamepadSettingsContent?.appendChild(this._createHeading('Gamepad Settings'));
        // Add status/visual placeholders back if cleared
        const gamepadStatus = document.createElement('div');
        gamepadStatus.id = 'gamepad-status';
        gamepadStatus.textContent = 'Gamepad Status: Disconnected'; // Default
        this.gamepadSettingsContent?.appendChild(gamepadStatus);
        const gamepadVisual = document.createElement('div');
        gamepadVisual.id = 'gamepad-visual';
        this.gamepadSettingsContent?.appendChild(gamepadVisual);
        // Add controls
        this.gamepadSettingsContent?.appendChild(createSlider('Gamepad Deadzone', 0, 0.5, 0.01, 'GAMEPAD_DEADZONE'));
        this.gamepadSettingsContent?.appendChild(createCheckbox('Invert Roll Axis', 'GAMEPAD_INVERT_AXES.roll'));
        this.gamepadSettingsContent?.appendChild(createCheckbox('Invert Pitch Axis', 'GAMEPAD_INVERT_AXES.pitch'));
        this.gamepadSettingsContent?.appendChild(createCheckbox('Invert Yaw Axis', 'GAMEPAD_INVERT_AXES.yaw'));
        this.gamepadSettingsContent?.appendChild(createCheckbox('Invert Thrust Axis', 'GAMEPAD_INVERT_AXES.thrust'));
        this.gamepadSettingsContent?.appendChild(createDisplayItem('Arm/Disarm Button', `Index ${config.GAMEPAD_BUTTON_MAPPING.armDisarm}`));
        this.gamepadSettingsContent?.appendChild(createDisplayItem('Reset Button', `Index ${config.GAMEPAD_BUTTON_MAPPING.reset}`));
        this.gamepadSettingsContent?.appendChild(createResetButton('Reset Gamepad', 'GAMEPAD_SETTINGS'));

        this.keyboardSettingsDisplay?.appendChild(this._createHeading('Keyboard Settings'));
        this.keyboardSettingsDisplay?.appendChild(createSlider('Keyboard Roll Sens.', 0.1, 2.0, 0.05, 'KEYBOARD_SENSITIVITY.roll'));
        this.keyboardSettingsDisplay?.appendChild(createSlider('Keyboard Pitch Sens.', 0.1, 2.0, 0.05, 'KEYBOARD_SENSITIVITY.pitch'));
        this.keyboardSettingsDisplay?.appendChild(createSlider('Keyboard Yaw Sens.', 0.1, 2.0, 0.05, 'KEYBOARD_SENSITIVITY.yaw'));
        this.keyboardSettingsDisplay?.appendChild(createDisplayItem('Pitch Keys', 'W/S/Up/Down'));
        this.keyboardSettingsDisplay?.appendChild(createDisplayItem('Roll Keys', 'A/D/Left/Right'));
        this.keyboardSettingsDisplay?.appendChild(createDisplayItem('Yaw Keys', 'Q/E'));
        this.keyboardSettingsDisplay?.appendChild(createDisplayItem('Thrust Keys', 'Shift/Ctrl/Space'));
        this.keyboardSettingsDisplay?.appendChild(createDisplayItem('Arm/Disarm Key', 'Enter'));
        this.keyboardSettingsDisplay?.appendChild(createDisplayItem('Reset Key', 'R'));
        this.keyboardSettingsDisplay?.appendChild(createResetButton('Reset Keyboard Sens.', 'KEYBOARD_SENSITIVITY')); // <<< ADD

        this.gamepadStatusElement = document.getElementById('gamepad-status');
        this.gamepadVisualElement = document.getElementById('gamepad-visual');
        if (!this.gamepadStatusElement && this.gamepadSettingsContent) {
            this.gamepadStatusElement = document.createElement('div');
            this.gamepadStatusElement.id = 'gamepad-status';
            this.gamepadSettingsContent.prepend(this.gamepadStatusElement); // Add status first
        }
        if (!this.gamepadVisualElement && this.gamepadSettingsContent) {
            this.gamepadVisualElement = document.createElement('div');
            this.gamepadVisualElement.id = 'gamepad-visual';
            // Insert visual after status (or wherever appropriate)
            if(this.gamepadStatusElement) {
                this.gamepadStatusElement.after(this.gamepadVisualElement);
            } else {
                this.gamepadSettingsContent.prepend(this.gamepadVisualElement);
            }
        }
        this._updateGamepadStatusDisplay(); // Initial update

        console.log("MenuManager: Settings panels populated into new structure.");
    }
    // Helper to create H4 element
    _createHeading(text) {
        const heading = document.createElement('h4');
        heading.textContent = text;
        return heading;
    }

    // --- Event Listeners Setup (Updated for New Structure) ---
    _addEventListeners() {
        // Main Menu
        this.flyButton?.addEventListener('click', () => {
            this._playSound('ui_click'); // Play click sound
            EventBus.emit(EVENTS.FLY_BUTTON_CLICKED);
        });

        // In-Sim Menu - Action Buttons
        this.resumeButton?.addEventListener('click', () => {
            this._playSound('ui_click');
            EventBus.emit(EVENTS.RESUME_BUTTON_CLICKED);
        });
        this.restartButton?.addEventListener('click', () => {
            this._playSound('ui_click');
            EventBus.emit(EVENTS.RESTART_BUTTON_CLICKED);
        });
        this.mainMenuButton?.addEventListener('click', () => {
            this._playSound('ui_close'); // Use close sound?
            EventBus.emit(EVENTS.RETURN_TO_MAIN_MENU_CLICKED);
        });

        // In-Sim Menu - Sidebar View Buttons
        this.sidebarButtons?.forEach(button => {
            button.addEventListener('click', (e) => {
                this._playSound('ui_click');
                this._handleSidebarClick(e);
            });
            button.addEventListener('mouseenter', () => this._playSound('ui_hover')); // Hover sound
        });

        // In-Sim Menu - Sub-Navigation Buttons
        this.subNavButtons?.forEach(button => {
            button.addEventListener('click', (e) => {
                this._playSound('ui_click');
                this._handleSubNavClick(e);
            });
            button.addEventListener('mouseenter', () => this._playSound('ui_hover')); // Hover sound
        });

        // Canvas Click for Pointer Lock Request
        this.canvasElement?.addEventListener('click', () => {
            // No sound usually needed for this
            EventBus.emit(EVENTS.CANVAS_CLICKED);
        });

        // Add hover sounds to main menu buttons too
        this.mainMenuElement?.querySelectorAll('.nav-button').forEach(button => {
            button.addEventListener('mouseenter', () => {
                if (!button.disabled) this._playSound('ui_hover');
            });
        });

        console.log("MenuManager: New event listeners added (with sound triggers).");
    }

    // --- View and Panel Switching Logic ---
    _handleSidebarClick(event) {
        const button = event.currentTarget;
        const viewId = button.dataset.view;

        if (!viewId) return;

        this._deactivateAllSidebarButtons();
        this._deactivateAllViews();
        button.classList.add('active');
        const targetView = document.getElementById(viewId);

        if (targetView) {
            targetView.classList.add('active');
            this.activeView = targetView;

            const firstSubNavButton = targetView.querySelector('.sub-nav-button[data-panel]');
            if (firstSubNavButton) {
                this._activateSubNavButtonAndPanel(firstSubNavButton);
            }

            // --- NEW: Start/Stop Gamepad Status Polling ---
            if (viewId === 'pause-controls-view') {
                this._startGamepadStatusPolling();
            } else {
                this._stopGamepadStatusPolling();
            }
            // --- END NEW ---

        } else {
            console.warn(`MenuManager: Target view with ID "${viewId}" not found.`);
            this.activeView = null;
            this._stopGamepadStatusPolling(); // Stop polling if view not found
        }
    }

    // --- NEW: Gamepad Status Update Logic ---
    _startGamepadStatusPolling() {
        if (this.gamepadStatusInterval) return; // Already running
        this._updateGamepadStatusDisplay(); // Update immediately
        this.gamepadStatusInterval = setInterval(() => {
            this._updateGamepadStatusDisplay();
        }, 1000); // Update every second
        if(ConfigManager.getConfig().DEBUG_MODE) console.log("MenuManager: Started gamepad status polling.");
    }

    _stopGamepadStatusPolling() {
        if (this.gamepadStatusInterval) {
            clearInterval(this.gamepadStatusInterval);
            this.gamepadStatusInterval = null;
            if(ConfigManager.getConfig().DEBUG_MODE) console.log("MenuManager: Stopped gamepad status polling.");
        }
    }

    _updateGamepadStatusDisplay() {
        if (!this.gamepadStatusElement) return;
        const status = InputManager.getGamepadStatus();
        if (status.isConnected) {
            this.gamepadStatusElement.textContent = `Gamepad Status: Connected (${status.id} - Index ${status.index})`;
            this.gamepadStatusElement.style.color = 'var(--accent-secondary)'; // Teal color for connected
            // TODO: Update gamepad visual diagram based on status.axes/buttons later
            this.gamepadVisualElement.textContent = `(Axes: ${status.axesCount}, Buttons: ${status.buttonCount} - Diagram TBD)`;
        } else {
            this.gamepadStatusElement.textContent = `Gamepad Status: Disconnected`;
            this.gamepadStatusElement.style.color = 'var(--text-muted)'; // Muted color for disconnected
            this.gamepadVisualElement.textContent = `(Gamepad Diagram Placeholder)`;
        }
    }

    _handleSubNavClick(event) {
        const button = event.currentTarget;
        this._activateSubNavButtonAndPanel(button);
    }

    _activateSubNavButtonAndPanel(button) {
        const panelId = button.dataset.panel;
        if (!panelId || !this.activeView) return; // Need panelId and an active view

        // Deactivate other sub-nav buttons and panels within the *current active view*
        const currentSubNav = this.activeView.querySelector('.sub-nav');
        currentSubNav?.querySelectorAll('.sub-nav-button').forEach(btn => btn.classList.remove('active'));
        this.activeView.querySelectorAll('.panel-content').forEach(panel => panel.classList.remove('active'));

        // Activate clicked button and corresponding panel
        button.classList.add('active');
        const targetPanel = document.getElementById(panelId); // Find panel by ID globally
        if (targetPanel) {
            targetPanel.classList.add('active');
            // Store active panel for this view (optional, might not be needed)
            this.activePanels[this.activeView.id] = panelId;
        } else {
            console.warn(`MenuManager: Target panel with ID "${panelId}" not found.`);
        }
    }

    _deactivateAllSidebarButtons() {
        this.sidebarButtons?.forEach(btn => btn.classList.remove('active'));
    }

    _deactivateAllViews() {
        this.contentViews?.forEach(view => view.classList.remove('active'));
    }

    // --- NEW Method needed by PausedState ---
    /** Returns true if a specific view (Settings or Controls) is active */
    isViewActive() {
        return this.activeView !== null;
    }
    /** Resets the menu to the default pause state (no view selected) */
    resetToDefaultView() {
        this._deactivateAllViews();
        this._deactivateAllSidebarButtons();
        this.activeView = null;
        this._stopGamepadStatusPolling(); // <<< Stop polling on reset view
    }



    // --- Cleanup ---
    dispose() {
        // Ensure interval is cleared on dispose
        this._stopGamepadStatusPolling();
        // TODO: Remove event listeners added in _addEventListeners
        console.log("MenuManager: Disposed.");
    }
}

const menuManagerInstance = new MenuManager();
export default menuManagerInstance;