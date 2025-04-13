// src/states/LoadingState.js
import { BaseState } from '../StateManager.js';
import MenuManager from '../MenuManager.js';
import AssetLoader from '../AssetLoader.js';
import ConfigManager from '../ConfigManager.js';
import SimulatorEngine from '../SimulatorEngine.js'; // Need the class definition
import EventBus, { EVENTS } from '../EventBus.js';
import StateManager from '../StateManager.js';
import SimulatingState from './SimulatingState.js';
import MenuState from './MenuState.js'; // For error fallback


class LoadingState extends BaseState {
    constructor() {
        super();
        this.simulatorEngine = null; // Hold engine instance locally during loading
    }

    async enter() {
        console.log("Entering Loading State");
        MenuManager.showLoading('Initializing...');
        const config = ConfigManager.getConfig(); // Get latest config

        try {
            // 1. Load Assets
            MenuManager.showLoading('Loading assets...');
            EventBus.emit(EVENTS.LOADING_ASSETS_STARTED);
            await AssetLoader.preloadAssets();
            EventBus.emit(EVENTS.LOADING_ASSETS_COMPLETE);
            if (config.DEBUG_MODE) console.log("Assets loaded.");

            // 2. Create and Initialize Engine
            MenuManager.showLoading('Initializing simulator...');
            EventBus.emit(EVENTS.SIM_INITIALIZATION_STARTED);
            // Pass context if engine needs it, otherwise context might be empty
            this.simulatorEngine = new SimulatorEngine(this.context);
            await this.simulatorEngine.initialize(); // Initialize modules within engine
            EventBus.emit(EVENTS.SIM_INITIALIZATION_COMPLETE, { engine: this.simulatorEngine }); // Pass engine instance
            if (config.DEBUG_MODE) console.log("Simulator engine initialized.");

            // 3. Apply Initial Configuration (Engine listens for this event or is passed config)
            ConfigManager.applySettingsToEngine(this.simulatorEngine); // <<< KEEP this for now, easiest way
            if (config.DEBUG_MODE) console.log("Initial configuration applied to engine.");


            // 4. Transition to Simulating State
            // Pass the created engine instance to the next state's context
            this.context.simulatorEngine = this.simulatorEngine;
            StateManager.changeState(new SimulatingState(this.manager, this.context));

        } catch (error) {
            console.error("FATAL ERROR during simulation loading:", error);
            MenuManager.showLoading(`Error: ${error.message}`); // Show error
            // Optionally, transition back to Menu state after a delay or user action
            alert(`Failed to start simulation: ${error.message}`); // Simple alert fallback
            StateManager.changeState(new MenuState(this.manager, this.context)); // Go back to menu
        }
    }

    exit() {
        console.log("Exiting Loading State");
        MenuManager.hideLoading();
        // Don't dispose engine here, pass it to the next state
    }
}
export default LoadingState;