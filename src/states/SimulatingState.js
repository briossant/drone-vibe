// src/states/SimulatingState.js
import { BaseState } from '../managers/StateManager.js';
import MenuManager from '../ui/MenuManager.js';
import StateManager from '../managers/StateManager.js';
import PausedState from './PausedState.js';
import EventBus, { EVENTS } from '../utils/EventBus.js';
import ConfigManager from '../config/ConfigManager.js';


class SimulatingState extends BaseState {
    constructor() {
        super();
    }

    enter() {
        console.log("Entering Simulating State");
        this.engine = this.context.simulatorEngine; // Get engine from context
        if (!this.engine) {
            console.error("SimulatingState Error: SimulatorEngine not found in context!");
            // Handle error - maybe transition back to menu?
            return;
        }

        MenuManager.showSimulationView();
        this.engine.resume(); // Ensure engine simulation logic is running (might already be if starting)
        this.requestPointerLock();

        // Listen for pause requests (e.g., Escape key handled globally, emits event)
        // EventBus.on(EVENTS.SIM_PAUSE_REQUESTED, this.handlePauseRequest);
    }

    exit() {
        console.log("Exiting Simulating State");
        // Pausing logic might be handled by the engine itself when state changes
        // this.engine?.pause(); // Pause simulation logic when leaving this state
        // EventBus.off(EVENTS.SIM_PAUSE_REQUESTED, this.handlePauseRequest);
    }

    update(deltaTime) {
        // The engine's loop runs independently via requestAnimationFrame.
        // This update could be used for state-specific logic if needed,
        // but the core sim loop is managed by the engine itself.
    }

    handleEscape() {
        console.log("SimulatingState: Escape key pressed, changing to PausedState");
        StateManager.changeState(new PausedState(this.manager, this.context));
    }

    handlePointerLockChange(isLocked) {
        if (!isLocked) {
            console.log("SimulatingState: Pointer lock released, changing to PausedState");
            // Only pause if we are *currently* in the simulating state when lock is lost
            if (StateManager.currentState === this) {
                StateManager.changeState(new PausedState(this.manager, this.context));
            }
        }
    }

    handleCanvasClick() {
        this.requestPointerLock(); // Attempt to regain lock on click
    }

    // handlePauseRequest = () => { // Bound instance method
    //     StateManager.changeState(new PausedState(this.manager, this.context));
    // }

    requestPointerLock() {
        MenuManager.canvasElement?.requestPointerLock()
            .catch(err => {
                if(ConfigManager.getConfig().DEBUG_MODE) {
                    console.warn("SimulatingState: Pointer lock request failed:", err.name, err.message)
                }
            });
    }
}
export default SimulatingState;