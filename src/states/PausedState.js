// src/states/PausedState.js
import { BaseState } from '../managers/StateManager.js';
import MenuManager from '../ui/MenuManager.js';
import StateManager from '../managers/StateManager.js';
import SimulatingState from './SimulatingState.js';
import MenuState from './MenuState.js'; // For return to main menu
import EventBus, { EVENTS } from '../utils/EventBus.js';
import ConfigManager from '../config/ConfigManager.js';


class PausedState extends BaseState {
    constructor() {
        super();
    }

    enter() {
        console.log("Entering Paused State");
        this.engine = this.context.simulatorEngine;
        this.engine?.pause(); // Tell engine to pause simulation logic

        MenuManager.showInSimMenu();
        document.exitPointerLock();

        // Listen for resume/restart/menu events emitted by MenuManager
        EventBus.on(EVENTS.RESUME_BUTTON_CLICKED, this.handleResume);
        EventBus.on(EVENTS.RESTART_BUTTON_CLICKED, this.handleRestart);
        EventBus.on(EVENTS.RETURN_TO_MAIN_MENU_CLICKED, this.handleReturnToMenu);
        EventBus.on(EVENTS.APPLY_SETTINGS_CLICKED, this.handleApplySettings);
        EventBus.on(EVENTS.BACK_BUTTON_CLICKED, this.handleBack); // Assuming back button emits this
    }

    exit() {
        console.log("Exiting Paused State");
        MenuManager.hideInSimMenu();
        // Engine resume is handled by SimulatingState.enter()

        EventBus.off(EVENTS.RESUME_BUTTON_CLICKED, this.handleResume);
        EventBus.off(EVENTS.RESTART_BUTTON_CLICKED, this.handleRestart);
        EventBus.off(EVENTS.RETURN_TO_MAIN_MENU_CLICKED, this.handleReturnToMenu);
        EventBus.off(EVENTS.APPLY_SETTINGS_CLICKED, this.handleApplySettings);
        EventBus.off(EVENTS.BACK_BUTTON_CLICKED, this.handleBack);
    }

    handleEscape() {
        // If a panel is open, Back is handled by MenuManager directly for now
        // If only main pause options are shown, Escape should resume
        if (!MenuManager.settingsPanel.classList.contains('hidden') || !MenuManager.controlsPanel.classList.contains('hidden')) {
            MenuManager.hideSettingsPanels(); // Close panel first
        } else {
            console.log("PausedState: Escape key pressed, changing to SimulatingState");
            StateManager.changeState(new SimulatingState(this.manager, this.context));
        }
    }

    handleCanvasClick() {
        // Allow clicking canvas to resume (will request pointer lock)
        console.log("PausedState: Canvas clicked, changing to SimulatingState");
        StateManager.changeState(new SimulatingState(this.manager, this.context));
    }


    // Event Handlers (bound instance methods using =>)
    handleResume = () => {
        console.log("PausedState: Resume clicked, changing to SimulatingState");
        StateManager.changeState(new SimulatingState(this.manager, this.context));
    }

    handleRestart = async () => { // Make async for fade
        console.log("PausedState: Restart clicked");
        MenuManager.hideInSimMenu(); // Hide menu first

        await MenuManager.fadeTransition(async () => {
            this.engine?.restartFlight(); // Reset drone during fade
        });

        // Transition back to Simulating state *after* fade
        StateManager.changeState(new SimulatingState(this.manager, this.context));
    }

    handleReturnToMenu = async () => { // Make async for fade
        console.log("PausedState: Return to Main Menu clicked");
        MenuManager.hideInSimMenu(); // Hide menu first

        await MenuManager.fadeTransition(async () => {
            if (this.engine) {
                this.engine.stop(); // Stop engine loop
                this.engine.dispose(); // Clean up resources
                this.context.simulatorEngine = null; // Clear from context
                if(ConfigManager.getConfig().DEBUG_MODE) console.log("Simulator engine disposed.");
            }
            // Reset UI during black screen (MenuManager does this internally now)
            // MenuManager.hideElement(MenuManager.canvasElement);
            // MenuManager.hideElement(MenuManager.osdElement);
        });

        StateManager.changeState(new MenuState(this.manager, this.context)); // Change state *after* fade
    }

    handleApplySettings = () => {
        console.log("PausedState: Apply Settings requested");
        ConfigManager.saveConfig();
        ConfigManager.applySettingsToEngine(this.engine); // Apply to running engine
        EventBus.emit(EVENTS.SETTINGS_APPLIED); // Notify others if needed
        MenuManager.hideSettingsPanels(); // Go back to main pause options
    }

    handleBack = () => {
        // This might be handled entirely by MenuManager if it just hides panels
        // No state change needed here if MenuManager handles panel visibility.
        console.log("PausedState: Back button clicked (handled by MenuManager UI)");
    }
}
export default PausedState;