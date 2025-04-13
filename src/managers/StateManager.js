// src/managers/StateManager.js
import EventBus, { EVENTS } from '../utils/EventBus.js'; // Updated path

class StateManager {
    constructor() { // Removed initialStateClass and context from constructor for Singleton
        this.currentState = null;
        this.context = {}; // Initialize context object
        if (StateManager._instance) {
            console.warn("StateManager: Attempted to create second instance.");
            return StateManager._instance;
        }
        StateManager._instance = this;
        console.log("StateManager: Initialized (Singleton)");
    }

    // Method to set context after creation if needed by states
    setContext(context) {
        // Merge provided context with existing context
        this.context = { ...this.context, ...context };
    }

    changeState(newStateInstance) {
        const oldStateName = this.currentState ? this.currentState.constructor.name : 'None';

        // Exit current state
        if (this.currentState && typeof this.currentState.exit === 'function') {
            try {
                this.currentState.exit();
            } catch(e){ console.error(`Error exiting state ${oldStateName}:`, e)}
        } else if (this.currentState) {
            // console.log(`StateManager: State ${oldStateName} has no exit() method.`);
        }

        const newStateName = newStateInstance ? newStateInstance.constructor.name : 'None';
        if (!newStateInstance) {
            console.error("StateManager: Attempted to change to a null state!");
            this.currentState = null;
            return;
        }

        // Assign manager and context to the new state
        newStateInstance.manager = this; // Use the singleton instance
        newStateInstance.context = this.context; // Assign current context

        this.currentState = newStateInstance;
        console.log(`StateManager: Transitioning from ${oldStateName} to state: ${newStateName}`);

        // Enter new state
        if (typeof this.currentState.enter === 'function') {
            try {
                // Use Promise.resolve to handle both sync and async enter methods
                Promise.resolve(this.currentState.enter()).catch(e => {
                    console.error(`Error during async enter of state ${newStateName}:`, e);
                    // Potentially transition to an error state or back to menu
                });
            } catch(e) {
                console.error(`Error entering state ${newStateName}:`, e);
                // Potentially transition to an error state or back to menu
            }
        } else {
            console.warn(`StateManager: State ${newStateName} has no enter() method.`);
        }

        EventBus.emit(EVENTS.APP_STATE_CHANGED, { newState: newStateName, oldState: oldStateName });
    }

    // Methods to delegate input/events to the current state
    handleEscape() {
        if (this.currentState && typeof this.currentState.handleEscape === 'function') {
            this.currentState.handleEscape();
        } else {
            // console.log(`StateManager: Current state ${this.currentState?.constructor.name} does not handle Escape.`);
        }
    }

    handlePointerLockChange(isLocked) {
        if (this.currentState && typeof this.currentState.handlePointerLockChange === 'function') {
            this.currentState.handlePointerLockChange(isLocked);
        }
    }

    handleCanvasClick() {
        if (this.currentState && typeof this.currentState.handleCanvasClick === 'function') {
            this.currentState.handleCanvasClick();
        }
    }

    // Update method for states that need continuous updates (like SimulatingState)
    update(deltaTime) {
        if (this.currentState && typeof this.currentState.update === 'function') {
            this.currentState.update(deltaTime);
        }
    }
}

// Export singleton instance directly
const instance = new StateManager();
export default instance;

// Define Base State (Optional but good practice)
export class BaseState {
    constructor() {
        /** @type {StateManager | null} */
        this.manager = null; // Reference to the StateManager singleton
        /** @type {object} */
        this.context = {}; // Shared context (engine, uiManager etc.)
    }
    /** Called when entering the state. Can be async. */
    enter() {}
    /** Called when exiting the state. */
    exit() {}
    /** Called every frame if the state requires updates. */
    update(deltaTime) {}
    /** Handles the Escape key press. */
    handleEscape() {}
    /** Handles pointer lock changes. @param {boolean} isLocked */
    handlePointerLockChange(isLocked) {}
    /** Handles clicks on the main canvas. */
    handleCanvasClick() {}
}