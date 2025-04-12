// src/Config.js
const Config = {
    DEBUG_MODE: true,
    GRAVITY: -9.82,
    PHYSICS_TIMESTEP: 1 / 60,

    // --- NEW: Drone Starting Position ---
    DRONE_START_POSITION: { x: 0, y: 1, z: 0 },

    FPV_CAMERA_FOV: 110, // Field of View in degrees (Common FPV values: 100-130)

    // Drone properties
    DRONE_MASS: 0.8, // kg
    // ... (rest of DRONE_DIMENSIONS)
    DRONE_DIMENSIONS: {
        bodyWidth: 0.15, bodyHeight: 0.08, bodyDepth: 0.15,
        armLength: 0.18, armWidth: 0.02,
        propDiameter: 0.1
    },

    // --- Drone Physics Settings ---
    DRONE_PHYSICS_SETTINGS: {
        linearDamping: 0.5,
        angularDamping: 0.95,
    },

    // --- Input Sensitivity ---
    KEYBOARD_SENSITIVITY: {
        pitch: 1.0,
        roll: 1.0,
        yaw: 1.0,
    },

    // --- NEW: Gamepad Settings ---
    GAMEPAD_ENABLED: true, // Easily enable/disable gamepad support
    GAMEPAD_DEADZONE: 0.15, // Axis value must be greater than this to register
    GAMEPAD_SENSITIVITY: {
        pitch: 1.0,
        roll: 1.0,
        yaw: 1.0,
        // Thrust sensitivity is handled by mapping, not direct multiplication
    },
    // Standard Gamepad Mapping (indices for common controllers like Xbox/PS)
    // Mode 2 (Typical FPV): Left Stick = Roll/Pitch, Right Stick = Yaw/Thrust
    GAMEPAD_AXIS_MAPPING: {
        yaw: 0,     // Left Stick X
        thrust: 1,  // Left Stick Y <<< Swapped
        roll: 2,    // Right Stick X <<< Swapped
        pitch: 3,   // Right Stick Y <<< Swapped
    },
    // Inversions likely still needed for Y axes (now Thrust and Pitch)
    GAMEPAD_INVERT_AXES: {
        pitch: true,  // Right Stick Y often needs inversion
        thrust: true, // Left Stick Y often needs inversion
        // roll: false, // Usually X axes are standard
        // yaw: false,
    },
    GAMEPAD_BUTTON_MAPPING: {
        armDisarm: 9, // Example: Start button
        reset: 8,     // Example: Select/Back button
    },

    // --- Drone Control Force/Torque Multipliers ---
    DRONE_CONTROL_MULTIPLIERS: {
        MAX_THRUST: 26.0,
        PITCH_TORQUE: 0.04,
        ROLL_TORQUE: 0.04,
        YAW_TORQUE: 0.03,
    },
};
export default Config;