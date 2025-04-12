// src/InputManager.js
import { getCurrentConfig } from './ConfigManager.js';

class InputManager {
    constructor(engine) {
        this.engine = engine;
        this.keys = {};
        this.controls = { roll: 0, pitch: 0, yaw: 0, thrust: 0 };
        this.gamepads = {}; // Store connected gamepad states
        this.activeGamepadIndex = null; // Track the primary gamepad being used

        // Track button states for edge detection (press/release)
        this.gamepadButtonState = {}; // { buttonIndex: boolean (pressed) }
        this.prevGamepadButtonState = {};

        this._boundKeyDown = this.handleKeyDown.bind(this);
        this._boundKeyUp = this.handleKeyUp.bind(this);
        this._boundGamepadConnected = this.handleGamepadConnected.bind(this);
        this._boundGamepadDisconnected = this.handleGamepadDisconnected.bind(this);
        const Config = getCurrentConfig(); // Use helper

        if (Config.DEBUG_MODE) {
            console.log('InputManager: Initialized');
        }
    }

    initialize() {
        window.addEventListener('keydown', this._boundKeyDown);
        window.addEventListener('keyup', this._boundKeyUp);
        const Config = getCurrentConfig(); // Use helper

        if (Config.GAMEPAD_ENABLED) {
            window.addEventListener('gamepadconnected', this._boundGamepadConnected);
            window.addEventListener('gamepaddisconnected', this._boundGamepadDisconnected);
            this.scanGamepads(); // Initial scan
            if (Config.DEBUG_MODE) console.log('InputManager: Gamepad support enabled.');
        } else {
            if (Config.DEBUG_MODE) console.log('InputManager: Gamepad support disabled in Config.');
        }

        if (Config.DEBUG_MODE) {
            console.log('InputManager: Event listeners added.');
        }
    }

    update(isPaused = false) { // <<< Accept paused state
        // If paused, only process menu/system inputs (like Esc handled globally), skip flight controls
        if (isPaused) {
            // Reset flight controls when paused to avoid sudden movements on resume?
            this.controls = { roll: 0, pitch: 0, yaw: 0, thrust: 0 };
            // Still need to poll buttons for menu interactions if handled here,
            // but button processing for drone actions (arm/reset) is now handled
            // globally in main.js's keydown listener or needs re-evaluation.
            // For now, let's skip gamepad polling entirely if paused.
            return;
        }


        const config = getCurrentConfig();
        let gamepadInputDetected = false;
        if (config.GAMEPAD_ENABLED && this.activeGamepadIndex !== null) {
            gamepadInputDetected = this.pollActiveGamepad();
        }

        if (!gamepadInputDetected) {
            this.updateKeyboardControls();
        }

        // Gamepad Button processing for ARM/RESET via buttons is tricky now.
        // The global keydown handler in main.js handles keyboard arm/reset.
        // Gamepad button handling for these actions might need to be moved
        // or checked within the main loop when not paused.
        // Let's disable the button processing here for now to avoid conflicts.
        //this.processGamepadButtonActions(); // <<< Disable for now
    }

    updateKeyboardControls() {
        const Config = getCurrentConfig(); // Use helper

        // Reset controls if switching from gamepad
        this.controls.roll = 0;
        this.controls.pitch = 0;
        this.controls.yaw = 0;
        // Maintain thrust unless spacebar is pressed
        // let currentThrust = this.controls.thrust; // Keep thrust level? Or reset? Let's reset for now.
        let currentThrust = 0; // Start from zero when using keyboard only this frame


        // --- Key Mapping ---
        if (this.keys['a'] || this.keys['A'] || this.keys['ArrowLeft']) this.controls.roll = -1;
        if (this.keys['d'] || this.keys['D'] || this.keys['ArrowRight']) this.controls.roll = 1;

        if (this.keys['w'] || this.keys['W'] || this.keys['ArrowUp']) this.controls.pitch = 1;
        if (this.keys['s'] || this.keys['S'] || this.keys['ArrowDown']) this.controls.pitch = -1;

        if (this.keys['q'] || this.keys['Q']) this.controls.yaw = -1;
        if (this.keys['e'] || this.keys['E']) this.controls.yaw = 1;

        const thrustIncrement = 0.05; // Make thrust change a bit faster
        if (this.keys['Shift']) currentThrust = Math.min(1, this.controls.thrust + thrustIncrement); // Use previous thrust state for increment
        if (this.keys['Control']) currentThrust = Math.max(0, this.controls.thrust - thrustIncrement);
        if (this.keys[' ']) currentThrust = 0; // Spacebar cuts thrust immediately

        // Apply sensitivity
        this.controls.roll *= Config.KEYBOARD_SENSITIVITY.roll;
        this.controls.pitch *= Config.KEYBOARD_SENSITIVITY.pitch;
        this.controls.yaw *= Config.KEYBOARD_SENSITIVITY.yaw;
        this.controls.thrust = currentThrust; // Thrust is already calculated 0-1
    }

    handleKeyDown(event) {
        this.keys[event.key] = true;
        const simKeys = ['w', 's', 'a', 'd', 'q', 'e', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Shift', 'Control', ' ', 'Enter', 'r', 'c'];
        if (simKeys.includes(event.key) || simKeys.includes(event.key.toUpperCase())) {
            event.preventDefault();
        }
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
        this.prevGamepadButtonState = { ...this.gamepadButtonState }; // Copy previous state
        this.gamepadButtonState = {}; // Reset current state
        let buttonsChanged = false;
        gp.buttons.forEach((button, index) => {
            this.gamepadButtonState[index] = button.pressed;
            if(this.gamepadButtonState[index] !== this.prevGamepadButtonState[index]) {
                buttonsChanged = true;
            }
        });

        // Determine if significant input occurred (axis movement or button change)
        const significantAxisInput = Math.abs(rollInput) > 0 || Math.abs(pitchInput) > 0 || Math.abs(yawInput) > 0 || Math.abs(thrustMapped) > 0.01; // Allow small thrust values
        return significantAxisInput || buttonsChanged;
    }

    // --- NEW: Apply Configuration ---
    applyConfiguration(config) {
        if (!config) return;
        const C = config;
        // Update sensitivities, deadzones etc. used in polling/updates
        // No direct objects need updating usually, the next `update()` call will use new values.
        if(C.DEBUG_MODE) console.log("InputManager: Configuration applied (used on next update).");
        // Re-check gamepad status if GAMEPAD_ENABLED changed
        if (C.GAMEPAD_ENABLED && !this._boundGamepadConnected) {
            // Add listeners if they were removed
            // TODO: Need better logic to handle enabling/disabling gamepad support dynamically
        } else if (!C.GAMEPAD_ENABLED && this._boundGamepadConnected) {
            // Remove listeners
            // TODO: Need better logic here too
        }
    }

    // Check for button presses and trigger actions via the engine
    processGamepadButtonActions() {
        const Config = getCurrentConfig(); // Use helper

        if (!Config.GAMEPAD_ENABLED || this.activeGamepadIndex === null) return;

        const mapping = Config.GAMEPAD_BUTTON_MAPPING;

        // Check for Arm/Disarm button press (rising edge)
        if (mapping.armDisarm !== undefined &&
            this.gamepadButtonState[mapping.armDisarm] &&
            !this.prevGamepadButtonState[mapping.armDisarm]) {
            console.log("Debug: Arm/Disarm triggered via Gamepad button", mapping.armDisarm);
            this.engine.toggleArmDisarm(); // Call engine helper
        }

        // Check for Reset button press (rising edge)
        if (mapping.reset !== undefined &&
            this.gamepadButtonState[mapping.reset] &&
            !this.prevGamepadButtonState[mapping.reset]) {
            console.log("Debug: Reset triggered via Gamepad button", mapping.reset);
            if (this.engine.drone) {
                this.engine.drone.reset(Config.DRONE_START_POSITION);
            }
        }

        // Add checks for other mapped buttons (e.g., camera switch) if needed
        // if (mapping.cameraSwitch !== undefined && ... ) { this.engine.switchCamera(); }
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

    getControls() {
        // Apply clamping just before returning, ensures values are always valid
        const finalControls = {
            roll: Math.max(-1, Math.min(1, this.controls.roll)),
            pitch: Math.max(-1, Math.min(1, this.controls.pitch)),
            yaw: Math.max(-1, Math.min(1, this.controls.yaw)),
            thrust: Math.max(0, Math.min(1, this.controls.thrust))
        };
        return finalControls; // Return a copy of potentially clamped values
    }

    dispose() {
        const Config = getCurrentConfig(); // Use helper

        window.removeEventListener('keydown', this._boundKeyDown);
        window.removeEventListener('keyup', this._boundKeyUp);
        if (Config.GAMEPAD_ENABLED) {
            window.removeEventListener('gamepadconnected', this._boundGamepadConnected);
            window.removeEventListener('gamepaddisconnected', this._boundGamepadDisconnected);
        }
        if (Config.DEBUG_MODE) {
            console.log('InputManager: Event listeners removed.');
        }
    }
}

export default InputManager;