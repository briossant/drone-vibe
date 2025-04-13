// src/states/MenuState.js
import { BaseState } from '../StateManager.js';
import MenuManager from '../MenuManager.js';
import EventBus, { EVENTS } from '../EventBus.js';
import StateManager from '../StateManager.js'; // Import singleton instance
import LoadingState from './LoadingState.js';

class MenuState extends BaseState {
    constructor() {
        super();
    }

    enter() {
        console.log("Entering Menu State");
        MenuManager.showMainMenu();
        document.exitPointerLock(); // Ensure pointer lock is released

        // Ensure listeners are ready (might be better in MenuManager.initialize)
        // EventBus.on(EVENTS.FLY_BUTTON_CLICKED, this.handleFlyClick); // Listen within state
    }

    exit() {
        console.log("Exiting Menu State");
        MenuManager.hideElement(MenuManager.mainMenuElement);
        // EventBus.off(EVENTS.FLY_BUTTON_CLICKED, this.handleFlyClick); // Unsubscribe
    }

    // If MenuManager emits event, main app orchestrator handles it.
    // If state handles directly:
    // handleFlyClick() {
    //     console.log("MenuState: Fly button clicked, changing to LoadingState");
    //     StateManager.changeState(new LoadingState(this.manager, this.context));
    // }
}
export default MenuState;