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
        angularDamping: 0.9,
    },
    // Maybe GRAVITY later

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
    GAMEPAD_AXIS_MAPPING: {
        yaw: 0,
        thrust: 1,
        roll: 2,
        pitch: 3,
    },
    GAMEPAD_INVERT_AXES: {
        roll: true,
        yaw: true,
        thrust: true,
    },
    GAMEPAD_BUTTON_MAPPING: {
        // Common indices: Xbox(A=0,B=1,X=2,Y=3,LB=4,RB=5,LT=6,RT=7,Back=8,Start=9,LStick=10,RStick=11)
        // Common indices: PS(X=0,O=1,Square=2,Tri=3,L1=4,R1=5,L2=6,R2=7,Share=8,Options=9,L3=10,R3=11)
        armDisarm: 5,
        reset: 4,
    },

    // Flight Controller Settings
    FLIGHT_CONTROLLER_SETTINGS: {
        // PID Gains (Start low, especially I and D. Tune extensively!)
        PID: {
            // Rate PID Gains
            roll:  { kp: 0.26, ki: 0.05, kd: 0.01 },
            pitch: { kp: 0.26, ki: 0.05, kd: 0.01 }, // Often same as roll initially
            yaw:   { kp: 0.3, ki: 0.07, kd: 0.0 },  // Yaw often needs different tuning, less D typically
            // Shared Integral Limit (adjust based on output scale and desired response)
            iLimit: 0.3,
        },
        // Max Rotation Rates (Degrees per second) - Pilot input scales up to these rates
        RATE_LIMITS: {
            roll: 720,  // Example: 2 full rotations per second
            pitch: 720,
            yaw: 360,
        },
        // FLIGHT_MODE: 'RATE', // Could add later if switchable modes needed
    },

    // Drone Control Multipliers (These are now less direct, acting more as limits/scaling for PID output or direct thrust)
    DRONE_CONTROL_MULTIPLIERS: {
        MAX_THRUST: 26.0, // Thrust remains direct for now
        // Torque values are now primarily used as OUTPUT LIMITS for the PID controllers
        PITCH_TORQUE: 0.05, // Rename/repurpose? Represents a scale/limit. Tune this!
        ROLL_TORQUE: 0.05,
        YAW_TORQUE: 0.03,
    },
};

export default defaultConfig;