// src/states/PausedState.js
import { BaseState } from '../managers/StateManager.js';
import MenuManager from '../ui/MenuManager.js';
import StateManager from '../managers/StateManager.js';
import SimulatingState from './SimulatingState.js';
import MenuState from './MenuState.js'; // For return to main menu
import EventBus, { EVENTS } from '../utils/EventBus.js';
import ConfigManager from '../config/ConfigManager.js'; // Still needed for debug check

class PausedState extends BaseState {
    constructor() {
        super();
        // Bind handlers once to ensure correct 'this' and allow removal
        this.handleResume = this.handleResume.bind(this);
        this.handleRestart = this.handleRestart.bind(this);
        this.handleReturnToMenu = this.handleReturnToMenu.bind(this);
    }

    enter() {
        console.log("Entering Paused State");
        this.engine = this.context.simulatorEngine;
        // Engine pausing is often better handled *when leaving* SimulatingState
        // or *entering* PausedState. Let's ensure it's paused here.
        this.engine?.pause();

        MenuManager.showInSimMenu(); // Simply show the main pause overlay
        document.exitPointerLock(); // Ensure pointer lock is released

        // Listen for main action events emitted by MenuManager
        EventBus.on(EVENTS.RESUME_BUTTON_CLICKED, this.handleResume);
        EventBus.on(EVENTS.RESTART_BUTTON_CLICKED, this.handleRestart);
        EventBus.on(EVENTS.RETURN_TO_MAIN_MENU_CLICKED, this.handleReturnToMenu);
    }

    exit() {
        console.log("Exiting Paused State");
        MenuManager.hideInSimMenu(); // Hide the whole pause menu overlay
        // Engine resume is handled by SimulatingState.enter()

        EventBus.off(EVENTS.RESUME_BUTTON_CLICKED, this.handleResume);
        EventBus.off(EVENTS.RESTART_BUTTON_CLICKED, this.handleRestart);
        EventBus.off(EVENTS.RETURN_TO_MAIN_MENU_CLICKED, this.handleReturnToMenu);
    }

    handleEscape() {
        // --- NEW Escape Logic ---
        if (MenuManager.isViewActive()) {
            // If Settings or Controls view is open, close it first
            console.log("PausedState: Escape pressed (View Active), resetting to default view.");
            MenuManager.resetToDefaultView();
        } else {
            // If no specific view is open, Escape resumes the game
            console.log("PausedState: Escape key pressed (No View Active), changing to SimulatingState");
            StateManager.changeState(new SimulatingState()); // Pass context implicitly
        }
        // --- END New Escape Logic ---
    }

    handleCanvasClick() {
        // Allow clicking canvas to resume only if no view is active
        if (!MenuManager.isViewActive()) {
            console.log("PausedState: Canvas clicked (No View Active), changing to SimulatingState");
            StateManager.changeState(new SimulatingState()); // Pass context implicitly
        } else {
            console.log("PausedState: Canvas clicked (View Active), ignoring.");
        }
    }

    // Event Handlers (Keep Resume, Restart, ReturnToMenu as they were)
    handleResume() {
        console.log("PausedState: Resume clicked, changing to SimulatingState");
        StateManager.changeState(new SimulatingState()); // Pass context implicitly
    }

    async handleRestart() {
        console.log("PausedState: Restart clicked");
        MenuManager.hideInSimMenu();

        await MenuManager.fadeTransition(async () => {
            this.engine?.restartFlight();
        });

        StateManager.changeState(new SimulatingState()); // Pass context implicitly
    }

    async handleReturnToMenu() {
        console.log("PausedState: Return to Main Menu clicked");
        MenuManager.hideInSimMenu();

        await MenuManager.fadeTransition(async () => {
            if (this.engine) {
                this.engine.stop();
                this.engine.dispose();
                if (this.context) this.context.simulatorEngine = null;
                if (ConfigManager.getConfig().DEBUG_MODE) console.log("Simulator engine disposed.");
            }
        });

        StateManager.changeState(new MenuState()); // Pass context implicitly
    }
}
export default PausedState;