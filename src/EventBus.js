// src/EventBus.js
class EventBus {
    constructor() {
        this.events = {};
        if (EventBus._instance) {
            return EventBus._instance;
        }
        EventBus._instance = this;
        console.log("EventBus: Initialized (Singleton)");
    }

    on(eventName, listener) {
        if (!this.events[eventName]) {
            this.events[eventName] = [];
        }
        this.events[eventName].push(listener);
        // console.log(`EventBus: Listener added for ${eventName}`);
    }

    off(eventName, listenerToRemove) {
        if (!this.events[eventName]) {
            return;
        }
        this.events[eventName] = this.events[eventName].filter(
            listener => listener !== listenerToRemove
        );
        // console.log(`EventBus: Listener removed for ${eventName}`);
    }

    emit(eventName, data) {
        if (!this.events[eventName]) {
            // console.log(`EventBus: No listeners for ${eventName}`);
            return;
        }
        // console.log(`EventBus: Emitting ${eventName}`, data);
        this.events[eventName].forEach(listener => {
            try {
                listener(data);
            } catch (error) {
                console.error(`EventBus: Error in listener for ${eventName}:`, error);
            }
        });
    }
}

// Export a single instance
const instance = new EventBus();
export default instance;

// Define Event Names (export them for type safety/intellisense)
export const EVENTS = {
    // UI Interaction Events
    FLY_BUTTON_CLICKED: 'fly_button_clicked',
    RESUME_BUTTON_CLICKED: 'resume_button_clicked',
    RESTART_BUTTON_CLICKED: 'restart_button_clicked',
    RETURN_TO_MAIN_MENU_CLICKED: 'return_to_main_menu_clicked',
    SETTINGS_PANEL_REQUESTED: 'settings_panel_requested',
    CONTROLS_PANEL_REQUESTED: 'controls_panel_requested',
    BACK_BUTTON_CLICKED: 'back_button_clicked',
    APPLY_SETTINGS_CLICKED: 'apply_settings_clicked',
    CANVAS_CLICKED: 'canvas_clicked',

    // Application State Events
    APP_STATE_CHANGED: 'app_state_changed', // data: { newState, oldState }
    LOADING_ASSETS_STARTED: 'loading_assets_started',
    LOADING_ASSETS_PROGRESS: 'loading_assets_progress', // Optional
    LOADING_ASSETS_COMPLETE: 'loading_assets_complete',
    SIM_INITIALIZATION_STARTED: 'sim_initialization_started',
    SIM_INITIALIZATION_COMPLETE: 'sim_initialization_complete',
    SIM_START_REQUESTED: 'sim_start_requested', // Could trigger final checks before loop
    SIM_STOP_REQUESTED: 'sim_stop_requested',
    SIM_PAUSE_REQUESTED: 'sim_pause_requested',
    SIM_RESUME_REQUESTED: 'sim_resume_requested',
    ARM_DISARM_TOGGLE_REQUESTED: 'arm_disarm_toggle_requested', // NEW
    SIM_RESET_REQUESTED: 'sim_reset_requested', // For drone reset

    // Simulation Internal Events
    SIMULATION_STATE_UPDATE: 'simulation_state_update', // data: { droneState, controlsState } from engine loop
    DRONE_COLLISION: 'drone_collision', // data: { intensity }
    CONFIG_UPDATED: 'config_updated', // Emitted after loading or applying settings

    // Input Events
    POINTER_LOCK_CHANGE: 'pointer_lock_change', // data: { isLocked }
    POINTER_LOCK_ERROR: 'pointer_lock_error',
    KEY_DOWN: 'key_down', // data: { key, event } (potentially filtered for specific keys)
    GAMEPAD_BUTTON_PRESSED: 'gamepad_button_pressed', // data: { index } - For specific actions like arm/reset

    // Settings Events (Emitted *by* ConfigManager or MenuManager after Apply)
    SETTINGS_APPLIED: 'settings_applied',
};