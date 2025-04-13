// src/StateManager.js
import EventBus, { EVENTS } from './EventBus.js';

class StateManager {
    constructor(initialStateClass, context = {}) {
        this.currentState = null;
        this.context = context; // Allow passing shared resources (like engine, ui) if needed
        if (StateManager._instance) {
            return StateManager._instance;
        }
        StateManager._instance = this;
        console.log("StateManager: Initialized (Singleton)");
    }

    // Optional: Method to set context after creation if needed by states
    setContext(context) {
        this.context = context;
    }

    changeState(newStateInstance) {
        const oldStateName = this.currentState ? this.currentState.constructor.name : 'None';
        if (this.currentState && typeof this.currentState.exit === 'function') {
            try {
                this.currentState.exit();
            } catch(e){ console.error(`Error exiting state ${oldStateName}:`, e)}
        }

        const newStateName = newStateInstance.constructor.name;
        // Ensure the new state instance has access to the manager and context
        newStateInstance.manager = this; // Assign manager reference
        newStateInstance.context = this.context; // Assign context reference

        this.currentState = newStateInstance;
        console.log(`StateManager: Transitioning to state: ${newStateName}`);


        if (typeof this.currentState.enter === 'function') {
            try {
                this.currentState.enter();
            } catch(e) {console.error(`Error entering state ${newStateName}:`, e)}
        } else {
            console.warn(`StateManager: State ${newStateName} has no enter() method.`);
        }

        EventBus.emit(EVENTS.APP_STATE_CHANGED, { newState: newStateName, oldState: oldStateName });
    }

    // Methods to delegate input/events to the current state
    handleEscape() {
        if (this.currentState && typeof this.currentState.handleEscape === 'function') {
            this.currentState.handleEscape();
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

// Export a single instance creation function or the class directly
// Depending on whether context needs to be passed during creation
// export default StateManager;
const instance = new StateManager(null); // Initialize without state here
export default instance; // Export singleton instance

// Define Base State (Optional but good practice)
export class BaseState {
    constructor() {
        this.manager = null; // Reference to the StateManager
        this.context = null; // Shared context (engine, uiManager etc.)
    }
    enter() {}
    exit() {}
    update(deltaTime) {}
    handleEscape() {}
    handlePointerLockChange(isLocked) {}
    handleCanvasClick() {}
}