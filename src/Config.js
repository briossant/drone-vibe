// src/Config.js
const Config = {
    DEBUG_MODE: true,
    GRAVITY: -9.82,
    PHYSICS_TIMESTEP: 1 / 60,
    // Drone properties
    DRONE_MASS: 0.8, // kg - Adjusted maybe
    DRONE_DIMENSIONS: { // Example if moved here
        bodyWidth: 0.15, bodyHeight: 0.08, bodyDepth: 0.15,
        armLength: 0.18, armWidth: 0.02,
        propDiameter: 0.1
    },
    // Input settings
    KEYBOARD_SENSITIVITY: { // These scale the -1 to 1 input values
        pitch: 1.0,
        roll: 1.0,
        yaw: 1.0,
        // Thrust doesn't typically use sensitivity like this
    },
    // --- NEW: Drone Control Force/Torque Multipliers ---
    DRONE_CONTROL_MULTIPLIERS: {
        // Base thrust to approximately hover (adjust based on mass/gravity)
        // Hover thrust = mass * gravity => 0.8 * 9.82 = 7.856 N
        // Max thrust could be 2x or 3x hover thrust
        MAX_THRUST: 16.0, // Newtons (adjust this!)

        // Torque strength for pitch, roll, yaw (Newton-meters)
        // These need significant tuning! Start small.
        PITCH_TORQUE: 1.5,
        ROLL_TORQUE: 1.5,
        YAW_TORQUE: 1.0,
    },
    // Key mappings (optional - can be hardcoded in InputManager for now)
    // KEY_MAPPINGS: {
    //     THRUST_UP: 'Shift',
    //     THRUST_DOWN: 'Control',
    //     PITCH_FORWARD: 'w',
    //     PITCH_BACKWARD: 's',
    //     ROLL_LEFT: 'a',
    //     ROLL_RIGHT: 'd',
    //     YAW_LEFT: 'q', // Example
    //     YAW_RIGHT: 'e', // Example
    // }
};
export default Config;