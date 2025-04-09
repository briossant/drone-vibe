// src/InputManager.js
import Config from './Config.js';

class InputManager {
    constructor(engine) {
        this.engine = engine;
        this.keys = {}; // Track pressed keys
        this.controls = { // Normalized control values
            roll: 0,     // -1 to 1 (A/D or Left Arrow/Right Arrow)
            pitch: 0,    // -1 to 1 (W/S or Up Arrow/Down Arrow)
            yaw: 0,      // -1 to 1 (Q/E - example)
            thrust: 0,   // 0 to 1 (Shift/Control)
        };
        this.gamepads = {}; // Store connected gamepad states

        this._boundKeyDown = this.handleKeyDown.bind(this);
        this._boundKeyUp = this.handleKeyUp.bind(this);
        this._boundGamepadConnected = this.handleGamepadConnected.bind(this);
        this._boundGamepadDisconnected = this.handleGamepadDisconnected.bind(this);

        if (Config.DEBUG_MODE) {
            console.log('InputManager: Initialized');
        }
    }

    initialize() {
        window.addEventListener('keydown', this._boundKeyDown);
        window.addEventListener('keyup', this._boundKeyUp);
        window.addEventListener('gamepadconnected', this._boundGamepadConnected);
        window.addEventListener('gamepaddisconnected', this._boundGamepadDisconnected);

        this.scanGamepads();

        if (Config.DEBUG_MODE) {
            console.log('InputManager: Event listeners added.');
        }
    }

    update() {
        this.pollGamepads();
        this.updateKeyboardControls();
        // Future: Prioritize or combine gamepad/keyboard inputs
    }

    updateKeyboardControls() {
        let targetRoll = 0;
        let targetPitch = 0;
        let targetYaw = 0;
        // Start with previous thrust, modify based on keys
        let currentThrust = this.controls.thrust;

        // --- Mapping (Adjust keys as needed) ---
        // Roll (A/D or Arrows)
        if (this.keys['a'] || this.keys['A'] || this.keys['ArrowLeft']) targetRoll = -1;
        if (this.keys['d'] || this.keys['D'] || this.keys['ArrowRight']) targetRoll = 1;

        // Pitch (W/S or Arrows)
        // IMPORTANT: Typically 'W'/'ArrowUp' pitches the drone *forward*, which requires a positive pitch input
        // pitching the nose *down* (negative torque around drone's X-axis).
        // Let's keep pitch input positive for W/Up and negative for S/Down. The FC logic will apply the correct torque direction.
        if (this.keys['w'] || this.keys['W'] || this.keys['ArrowUp']) targetPitch = 1;
        if (this.keys['s'] || this.keys['S'] || this.keys['ArrowDown']) targetPitch = -1;

        // Yaw (Q/E - example)
        if (this.keys['q'] || this.keys['Q']) targetYaw = -1; // Rotate left
        if (this.keys['e'] || this.keys['E']) targetYaw = 1;  // Rotate right

        // Thrust (Shift/Control)
        const thrustIncrement = 0.03; // How fast thrust changes
        if (this.keys['Shift']) currentThrust += thrustIncrement;
        if (this.keys['Control']) currentThrust -= thrustIncrement;
        if (this.keys[' ']) currentThrust = 0; // Spacebar cuts thrust

        // Clamp thrust
        currentThrust = Math.max(0, Math.min(1, currentThrust));

        // --- Update Controls State ---
        // Apply sensitivity directly to the directional controls
        this.controls.roll = targetRoll * Config.KEYBOARD_SENSITIVITY.roll;
        this.controls.pitch = targetPitch * Config.KEYBOARD_SENSITIVITY.pitch;
        this.controls.yaw = targetYaw * Config.KEYBOARD_SENSITIVITY.yaw;
        // Thrust is usually not scaled by sensitivity here, it's a direct level 0-1
        this.controls.thrust = currentThrust;

        // Add deadzone logic here if needed in the future
    }

    handleKeyDown(event) {
        this.keys[event.key] = true;

        // --- Prevent browser default actions for simulation keys ---
        const simKeys = ['w', 's', 'a', 'd', 'q', 'e', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Shift', 'Control', ' ', 'Enter', 'r', 'c'];
        if (simKeys.includes(event.key) || simKeys.includes(event.key.toUpperCase())) {
            // Check both cases for letters
            event.preventDefault();
        }
    }

    handleKeyUp(event) {
        this.keys[event.key] = false;
    }

    scanGamepads() {
        const detectedGamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        for (const gp of detectedGamepads) {
            if (gp) {
                this.gamepads[gp.index] = gp;
                if (Config.DEBUG_MODE) console.log(`InputManager: Gamepad ${gp.index} detected on scan: ${gp.id}`);
            }
        }
    }

    pollGamepads() {
        const detectedGamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        for (const gp of detectedGamepads) {
            if (gp) {
                // Update stored state (important for detecting changes)
                this.gamepads[gp.index] = gp;
                // --- Add logic to map gamepad axes/buttons to this.controls here ---
                // Example (needs customization based on gamepad layout):
                // const deadzone = 0.1;
                // const rollAxis = gp.axes[0];
                // const pitchAxis = gp.axes[1]; // Often inverted
                // const yawAxis = gp.axes[2];
                // const thrustAxis = gp.axes[3]; // Often -1 to 1, map to 0-1

                // if (Math.abs(rollAxis) > deadzone) this.controls.roll = rollAxis; else this.controls.roll = 0;
                // if (Math.abs(pitchAxis) > deadzone) this.controls.pitch = -pitchAxis; else this.controls.pitch = 0; // Invert pitch?
                // etc...
            }
        }
    }

    handleGamepadConnected(event) {
        if (Config.DEBUG_MODE) {
            console.log(`InputManager: Gamepad connected at index ${event.gamepad.index}: ${event.gamepad.id}. ${event.gamepad.buttons.length} buttons, ${event.gamepad.axes.length} axes.`);
        }
        this.gamepads[event.gamepad.index] = event.gamepad;
    }

    handleGamepadDisconnected(event) {
        if (Config.DEBUG_MODE) {
            console.log(`InputManager: Gamepad disconnected from index ${event.gamepad.index}: ${event.gamepad.id}`);
        }
        delete this.gamepads[event.gamepad.index];
    }


    getControls() {
        return { ...this.controls }; // Return a copy
    }

    dispose() {
        window.removeEventListener('keydown', this._boundKeyDown);
        window.removeEventListener('keyup', this._boundKeyUp);
        window.removeEventListener('gamepadconnected', this._boundGamepadConnected);
        window.removeEventListener('gamepaddisconnected', this._boundGamepadDisconnected);
        if (Config.DEBUG_MODE) {
            console.log('InputManager: Event listeners removed.');
        }
    }
}

export default InputManager;