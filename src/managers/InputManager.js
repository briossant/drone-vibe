// src/InputManager.js
import { getCurrentConfig } from '../config/ConfigManager.js';
import EventBus, { EVENTS } from '../utils/EventBus.js';

class InputManager {
    constructor() { // REMOVED engine parameter
        // Singleton Check
        if (InputManager._instance) {
            console.warn("InputManager: Attempted to create second instance.");
            return InputManager._instance;
        }
        InputManager._instance = this;

        this.keys = {};
        this.controls = { roll: 0, pitch: 0, yaw: 0, thrust: 0.0 }; // Start thrust at 0
        this.gamepads = {};
        this.activeGamepadIndex = null;
        this.gamepadButtonState = {};
        this.prevGamepadButtonState = {};
        this.pollingIntervalId = null; // ID for the polling interval

        // Bind methods ONCE
        this._boundKeyDown = this.handleKeyDown.bind(this);
        this._boundKeyUp = this.handleKeyUp.bind(this);
        this._boundGamepadConnected = this.handleGamepadConnected.bind(this);
        this._boundGamepadDisconnected = this.handleGamepadDisconnected.bind(this);
        this._boundUpdate = this.update.bind(this); // Bind update for setInterval

        console.log('InputManager: Instance created (Singleton)');
    }

    // Instance method - called by main.js
    initialize() {
        // Prevent multiple initializations
        if (this.isInitialized) return;

        window.addEventListener('keydown', this._boundKeyDown);
        window.addEventListener('keyup', this._boundKeyUp);

        const config = getCurrentConfig();
        if (config.GAMEPAD_ENABLED) {
            window.addEventListener('gamepadconnected', this._boundGamepadConnected);
            window.addEventListener('gamepaddisconnected', this._boundGamepadDisconnected);
            this.scanGamepads(); // Scan initially
            if (config.DEBUG_MODE) console.log('InputManager: Gamepad support enabled.');
        } else {
            if (config.DEBUG_MODE) console.log('InputManager: Gamepad support disabled in Config.');
        }

        // Start polling loop AFTER listeners are added
        this.startPolling();

        this.isInitialized = true; // Mark as initialized
        console.log('InputManager: Initialized, listeners added, polling started.');
    }

    // Internal polling loop independent of main sim loop
    startPolling() {
        if (this.pollingIntervalId) return; // Prevent multiple loops
        // Poll slightly less frequently than render loop? e.g., 60 times/sec
        this.pollingIntervalId = setInterval(this._boundUpdate, 1000 / 60); // ~60Hz polling
        console.log("InputManager: Started input polling loop.");
    }

    stopPolling() {
        if(this.pollingIntervalId) {
            clearInterval(this.pollingIntervalId);
            this.pollingIntervalId = null;
            console.log("InputManager: Stopped input polling loop.");
        }
    }

    // Update method - called by setInterval
    update() {
        const config = getCurrentConfig();
        let gamepadInputDetected = false;

        // Poll gamepads
        if (config.GAMEPAD_ENABLED && this.activeGamepadIndex !== null) {
            gamepadInputDetected = this.pollActiveGamepad();
            if (gamepadInputDetected) {
                // Button actions processed immediately after polling confirms gamepad activity
                this.processGamepadButtonActions();
            }
        }

        // Update keyboard controls if no gamepad input detected this cycle
        if (!gamepadInputDetected) {
            this.updateKeyboardControls();
        }
        // InputManager now just maintains the latest 'controls' state.
        // SimulatorEngine will call getControls() when it needs them.
    }

    getGamepadStatus() {
        if (this.activeGamepadIndex !== null && this.gamepads[this.activeGamepadIndex]) {
            const gp = this.gamepads[this.activeGamepadIndex];
            return {
                isConnected: true,
                id: gp.id,
                index: gp.index,
                axesCount: gp.axes.length,
                buttonCount: gp.buttons.length,
            };
        } else {
            return {
                isConnected: false,
                id: 'No active gamepad',
                index: null,
                axesCount: 0,
                buttonCount: 0
            };
        }
    }


    // --- Event Emitters ---
    handleKeyDown(event) {
        this.keys[event.key] = true;
        const config = getCurrentConfig();

        // Emit events for specific non-movement keys
        if (event.key === 'Enter') {
            event.preventDefault();
            if (config.DEBUG_MODE) console.log("InputManager: Arm/Disarm key (Enter) pressed - Emitting event.");
            EventBus.emit(EVENTS.ARM_DISARM_TOGGLE_REQUESTED);
        }
        if (event.key === 'r' || event.key === 'R') {
            event.preventDefault();
            if (config.DEBUG_MODE) console.log("InputManager: Reset key (R) pressed - Emitting event.");
            EventBus.emit(EVENTS.SIM_RESET_REQUESTED);
        }

        // Prevent default for simulation flight keys ONLY when sim is active (pointer lock)
        const simKeys = ['w', 's', 'a', 'd', 'q', 'e', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Shift', 'Control', ' '];
        if (simKeys.includes(event.key) || simKeys.includes(event.key.toUpperCase())) {
            // Check if pointer lock is active OR if focus is on the canvas (heuristic for active sim)
            if (document.pointerLockElement === MenuManager.canvasElement || document.activeElement === MenuManager.canvasElement ) {
                event.preventDefault();
            }
        }
    }

    processGamepadButtonActions() {
        if (this.activeGamepadIndex === null) return;
        const config = getCurrentConfig();
        const gpIndex = this.activeGamepadIndex;
        const mapping = config.GAMEPAD_BUTTON_MAPPING;
        const currentState = this.gamepadButtonState[gpIndex];
        const prevState = this.prevGamepadButtonState[gpIndex];
        if (!currentState || !prevState) return;

        const armButtonIndex = mapping.armDisarm;
        if (armButtonIndex !== undefined && currentState[armButtonIndex] === true && prevState[armButtonIndex] === false) {
            if (config.DEBUG_MODE) console.log(`InputManager: Arm/Disarm triggered via Gamepad button ${armButtonIndex} - Emitting event`);
            EventBus.emit(EVENTS.ARM_DISARM_TOGGLE_REQUESTED);
        }

        const resetButtonIndex = mapping.reset;
        if (resetButtonIndex !== undefined && currentState[resetButtonIndex] === true && prevState[resetButtonIndex] === false) {
            if (config.DEBUG_MODE) console.log(`InputManager: Reset triggered via Gamepad button ${resetButtonIndex} - Emitting event`);
            EventBus.emit(EVENTS.SIM_RESET_REQUESTED);
        }
    }

    // Reads keyboard state and updates flight controls
    updateKeyboardControls() {
        const config = getCurrentConfig();

        // Reset controls for this frame if switching from gamepad? Or blend? Reset is simpler.
        this.controls.roll = 0;
        this.controls.pitch = 0;
        this.controls.yaw = 0;
        this.controls.thrust = this.controls.thrust; // Keep previous thrust unless changed

        // Apply directional inputs
        if (this.keys['a'] || this.keys['A'] || this.keys['ArrowLeft']) this.controls.roll = -1;
        if (this.keys['d'] || this.keys['D'] || this.keys['ArrowRight']) this.controls.roll = 1;
        if (this.keys['w'] || this.keys['W'] || this.keys['ArrowUp']) this.controls.pitch = 1;
        if (this.keys['s'] || this.keys['S'] || this.keys['ArrowDown']) this.controls.pitch = -1;
        if (this.keys['q'] || this.keys['Q']) this.controls.yaw = -1;
        if (this.keys['e'] || this.keys['E']) this.controls.yaw = 1;

        // Thrust control (Incremental)
        const thrustIncrement = 0.05; // Adjust speed as needed
        if (this.keys['Shift']) this.controls.thrust = Math.min(1, this.controls.thrust + thrustIncrement);
        if (this.keys['Control']) this.controls.thrust = Math.max(0, this.controls.thrust - thrustIncrement);
        if (this.keys[' ']) this.controls.thrust = 0; // Space cuts thrust

        // Apply sensitivity from config
        this.controls.roll *= config.KEYBOARD_SENSITIVITY.roll;
        this.controls.pitch *= config.KEYBOARD_SENSITIVITY.pitch;
        this.controls.yaw *= config.KEYBOARD_SENSITIVITY.yaw;

        // Clamp controls at the end
        this.controls.roll = Math.max(-1, Math.min(1, this.controls.roll));
        this.controls.pitch = Math.max(-1, Math.min(1, this.controls.pitch));
        this.controls.yaw = Math.max(-1, Math.min(1, this.controls.yaw));
        this.controls.thrust = Math.max(0, Math.min(1, this.controls.thrust));
    }

    handleKeyUp(event) {
        this.keys[event.key] = false;
    }

    scanGamepads() {
        const Config = getCurrentConfig(); // Use helper

        if (!navigator.getGamepads) return;
        const detectedGamepads = navigator.getGamepads();
        for (const gp of detectedGamepads) {
            if (gp) {
                if (!this.gamepads[gp.index]) { // Only log if new
                    this.handleGamepadConnected({ gamepad: gp }); // Treat it as a connection
                }
                this.gamepads[gp.index] = gp; // Update state
                // Automatically select the first connected gamepad if none is active
                if (this.activeGamepadIndex === null) {
                    this.activeGamepadIndex = gp.index;
                    if (Config.DEBUG_MODE) console.log(`InputManager: Auto-selected Gamepad ${gp.index} as active.`);
                }
            }
        }
    }

    // Polls the *active* gamepad and updates controls
    // Returns true if significant input was detected, false otherwise
    pollActiveGamepad() {
        if (this.activeGamepadIndex === null || !navigator.getGamepads) return false;
        const Config = getCurrentConfig(); // Use helper

        const gp = navigator.getGamepads()[this.activeGamepadIndex];
        if (!gp || !gp.connected) {
            // Handle case where the active gamepad disconnects unexpectedly
            this.handleGamepadDisconnected({ gamepad: { index: this.activeGamepadIndex, id: 'Disconnected' }});
            return false;
        }

        // Update stored state
        this.gamepads[this.activeGamepadIndex] = gp;

        // --- Read Axes ---
        const { GAMEPAD_AXIS_MAPPING, GAMEPAD_INVERT_AXES, GAMEPAD_DEADZONE, GAMEPAD_SENSITIVITY } = Config;
        let rollInput = gp.axes[GAMEPAD_AXIS_MAPPING.roll] || 0;
        let pitchInput = gp.axes[GAMEPAD_AXIS_MAPPING.pitch] || 0;
        let yawInput = gp.axes[GAMEPAD_AXIS_MAPPING.yaw] || 0;
        let thrustInputRaw = gp.axes[GAMEPAD_AXIS_MAPPING.thrust] || 0; // Raw -1 to 1

        // Apply Inversions
        if (GAMEPAD_INVERT_AXES.roll) rollInput *= -1;
        if (GAMEPAD_INVERT_AXES.pitch) pitchInput *= -1;
        if (GAMEPAD_INVERT_AXES.yaw) yawInput *= -1;
        if (GAMEPAD_INVERT_AXES.thrust) thrustInputRaw *= -1;

        // Apply Deadzones
        rollInput = Math.abs(rollInput) > GAMEPAD_DEADZONE ? rollInput : 0;
        pitchInput = Math.abs(pitchInput) > GAMEPAD_DEADZONE ? pitchInput : 0;
        yawInput = Math.abs(yawInput) > GAMEPAD_DEADZONE ? yawInput : 0;
        // Deadzone for thrust needs care if mapping (-1 to 1) to (0 to 1)
        // Let's apply deadzone *after* mapping thrust for simplicity now

        // Map Thrust from [-1, 1] to [0, 1]
        // Assumes stick rests at -1 (inverted) or bottom position
        let thrustMapped = (thrustInputRaw + 1) / 2;
        thrustMapped = Math.max(0, Math.min(1, thrustMapped)); // Clamp just in case
        // Apply deadzone to the mapped thrust (only ignore if very close to bottom)
        thrustMapped = thrustMapped <= (GAMEPAD_DEADZONE * 0.5) ? 0 : thrustMapped; // Adjusted deadzone check for 0-1 range


        // Apply Sensitivity
        this.controls.roll = rollInput * GAMEPAD_SENSITIVITY.roll;
        this.controls.pitch = pitchInput * GAMEPAD_SENSITIVITY.pitch;
        this.controls.yaw = yawInput * GAMEPAD_SENSITIVITY.yaw;
        this.controls.thrust = thrustMapped; // Use the mapped 0-1 value

        // --- Poll Buttons (Store state for edge detection) ---
        // *** Modify Logging/State Update Section ***
        const prevButtonStateForIndex = { ...(this.prevGamepadButtonState[this.activeGamepadIndex] || {}) }; // Get previous state safely
        this.prevGamepadButtonState[this.activeGamepadIndex] = { ...(this.gamepadButtonState[this.activeGamepadIndex] || {}) }; // Copy current to previous safely
        this.gamepadButtonState[this.activeGamepadIndex] = {}; // Reset current state for this index

        let buttonsChanged = false;
        gp.buttons.forEach((button, index) => {
            const isPressed = button.pressed;
            this.gamepadButtonState[this.activeGamepadIndex][index] = isPressed; // Store current pressed state

            const wasPressed = prevButtonStateForIndex[index] === true; // Check previous state more explicitly

            if (isPressed !== wasPressed) { // Check if state changed (press or release)
                buttonsChanged = true;
                // *** ADD LOGGING HERE ***
                if (Config.DEBUG_MODE) {
                    console.log(`InputManager.pollActiveGamepad: Button ${index} changed state. Pressed: ${isPressed}`);
                }
                // *** END LOGGING ***
            }
        });
        // *** End Modified Section ***

        // Determine if significant input occurred (axis movement or button change)
        const significantAxisInput = Math.abs(rollInput) > 0 || Math.abs(pitchInput) > 0 || Math.abs(yawInput) > 0 || Math.abs(thrustMapped) > 0.01; // Allow small thrust values
        return significantAxisInput || buttonsChanged;
    }

    handleGamepadConnected(event) {
        const Config = getCurrentConfig(); // Use helper

        const gp = event.gamepad;
        if (Config.DEBUG_MODE) {
            console.log(`InputManager: Gamepad connected at index ${gp.index}: ${gp.id}. ${gp.buttons.length} buttons, ${gp.axes.length} axes.`);
        }
        this.gamepads[gp.index] = gp;
        this.gamepadButtonState[gp.index] = {}; // Initialize button state storage
        this.prevGamepadButtonState[gp.index] = {};

        // Automatically select the first connected gamepad if none is active
        if (this.activeGamepadIndex === null) {
            this.activeGamepadIndex = gp.index;
            if (Config.DEBUG_MODE) console.log(`InputManager: Gamepad ${gp.index} set as active.`);
        }
    }

    handleGamepadDisconnected(event) {
        const Config = getCurrentConfig(); // Use helper

        const index = event.gamepad.index;
        if (Config.DEBUG_MODE) {
            console.log(`InputManager: Gamepad disconnected from index ${index}: ${event.gamepad.id}`);
        }
        delete this.gamepads[index];
        delete this.gamepadButtonState[index];
        delete this.prevGamepadButtonState[index];

        // If the disconnected gamepad was the active one, try to find another
        if (this.activeGamepadIndex === index) {
            this.activeGamepadIndex = null;
            // Find the next available gamepad index
            const nextAvailableIndex = Object.keys(this.gamepads)[0]; // Get the first key (index)
            if (nextAvailableIndex !== undefined) {
                this.activeGamepadIndex = parseInt(nextAvailableIndex, 10);
                if (Config.DEBUG_MODE) console.log(`InputManager: Switched active gamepad to index ${this.activeGamepadIndex}.`);
            } else {
                if (Config.DEBUG_MODE) console.log(`InputManager: No active gamepad.`);
                // Reset controls when no gamepad is active?
                this.controls = { roll: 0, pitch: 0, yaw: 0, thrust: 0 };
            }
        }
    }


    // Apply configuration changes
    applyConfiguration(config) {
        if (!config) return;
        if(config.DEBUG_MODE) console.log("InputManager: Configuration applied (will be used on next update).");
        // No direct updates needed, polling uses latest config from getCurrentConfig()
    }

    // Return current control state, clamped
    getControls() {
        // Clamp values just before returning
        return {
            roll: Math.max(-1, Math.min(1, this.controls.roll)),
            pitch: Math.max(-1, Math.min(1, this.controls.pitch)),
            yaw: Math.max(-1, Math.min(1, this.controls.yaw)),
            thrust: Math.max(0, Math.min(1, this.controls.thrust))
        };
    }

    // Cleanup resources
    dispose() {
        const config = getCurrentConfig();
        window.removeEventListener('keydown', this._boundKeyDown);
        window.removeEventListener('keyup', this._boundKeyUp);
        if (config.GAMEPAD_ENABLED) { // Only remove if added
            window.removeEventListener('gamepadconnected', this._boundGamepadConnected);
            window.removeEventListener('gamepaddisconnected', this._boundGamepadDisconnected);
        }
        this.keys = {};
        this.controls = { roll: 0, pitch: 0, yaw: 0, thrust: 0 };
        this.gamepads = {};
        this.activeGamepadIndex = null;
        this.gamepadButtonState = {};
        this.prevGamepadButtonState = {};

        if (config.DEBUG_MODE) {
            console.log('InputManager: Disposed, listeners removed.');
        }
    }
}

const instance = new InputManager();
export default instance;