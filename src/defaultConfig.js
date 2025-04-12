// src/defaultConfig.js

// These are the default settings that users can override.
// Keep the original Config.js for non-configurable, core parameters.
const defaultConfig = {
    // Graphics/Renderer Settings
    FPV_CAMERA_FOV: 110,
    // Add Post-Processing toggles later, e.g., enableBloom: false

    // Physics Settings
    DRONE_MASS: 0.8, // kg
    DRONE_PHYSICS_SETTINGS: {
        linearDamping: 0.5,
        angularDamping: 0.95,
    },
    // Maybe GRAVITY later, but be careful

    // Input/Control Settings
    KEYBOARD_SENSITIVITY: {
        pitch: 1.0,
        roll: 1.0,
        yaw: 1.0,
    },
    GAMEPAD_ENABLED: true,
    GAMEPAD_DEADZONE: 0.15,
    GAMEPAD_SENSITIVITY: {
        pitch: 1.0,
        roll: 1.0,
        yaw: 1.0,
    },
    GAMEPAD_AXIS_MAPPING: { // Mode 2 Default
        yaw: 0,
        thrust: 1,
        roll: 2,
        pitch: 3,
    },
    GAMEPAD_INVERT_AXES: {
        pitch: true,
        thrust: true,
        // roll: false,
        // yaw: false,
    },
    // Button mappings might be harder to store simply, maybe handle separately

    // Flight Controller Settings
    DRONE_CONTROL_MULTIPLIERS: {
        MAX_THRUST: 26.0,
        PITCH_TORQUE: 0.04,
        ROLL_TORQUE: 0.04,
        YAW_TORQUE: 0.03,
    },
    // Add PID gains later if implemented
};

export default defaultConfig;