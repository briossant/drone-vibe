// src/InputManager.js
import Config from './Config.js';

class InputManager {
    constructor(engine) {
        this.engine = engine;
        this.keys = {}; // Track pressed keys
        this.controls = { // Normalized control values
            roll: 0,     // -1 to 1 (A/D or Left/Right Arrow)
            pitch: 0,    // -1 to 1 (W/S or Up/Down Arrow)
            yaw: 0,      // -1 to 1 (Left/Right Arrow or custom)
            thrust: 0,   // 0 to 1 (Shift/Ctrl or custom)
            // Add others like arming, mode switch etc. later
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

        this.scanGamepads(); // Check for already connected gamepads

        if (Config.DEBUG_MODE) {
            console.log('InputManager: Event listeners added.');
        }
    }

    update() {
        this.pollGamepads(); // Update gamepad state each frame
        this.updateKeyboardControls(); // Update control values based on key states
        // Combine or prioritize gamepad/keyboard input here if needed
    }

    updateKeyboardControls() {
        // Example Mapping (Adjust keys and axes as needed)
        let targetRoll = 0;
        let targetPitch = 0;
        let targetYaw = 0;
        let targetThrust = this.controls.thrust; // Keep previous thrust if no key pressed

        // Roll (A/D)
        if (this.keys['a'] || this.keys['A'] || this.keys['ArrowLeft']) targetRoll = -1;
        if (this.keys['d'] || this.keys['D'] || this.keys['ArrowRight']) targetRoll = 1;

        // Pitch (W/S)
        if (this.keys['w'] || this.keys['W'] || this.keys['ArrowUp']) targetPitch = 1; // Usually forward/up tilt
        if (this.keys['s'] || this.keys['S'] || this.keys['ArrowDown']) targetPitch = -1; // Usually backward/down tilt

        // Yaw (Q/E - example, arrows might conflict with roll/pitch)
        // if (this.keys['q'] || this.keys['Q']) targetYaw = -1;
        // if (this.keys['e'] || this.keys['E']) targetYaw = 1;

        // Thrust (Shift/Space - example)
        if (this.keys['Shift']) targetThrust += 0.02; // Increase thrust
        if (this.keys['Control']) targetThrust -= 0.02; // Decrease thrust
        if (this.keys[' ']) targetThrust = 0; // Cut thrust (optional)

        // Clamp thrust
        targetThrust = Math.max(0, Math.min(1, targetThrust));

        // Apply sensitivity (optional, can be done in Drone FC)
        this.controls.roll = targetRoll * Config.KEYBOARD_SENSITIVITY.roll;
        this.controls.pitch = targetPitch * Config.KEYBOARD_SENSITIVITY.pitch;
        this.controls.yaw = targetYaw * Config.KEYBOARD_SENSITIVITY.yaw;
        this.controls.thrust = targetThrust; // Thrust usually not scaled by sensitivity here

        // Add deadzone application if needed later
    }

    handleKeyDown(event) {
        this.keys[event.key] = true;
        // Prevent browser default actions for keys used by the sim (e.g., spacebar scrolling)
        // if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        //     event.preventDefault();
        // }
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