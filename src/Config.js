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
    // Input settings (placeholders)
    KEYBOARD_SENSITIVITY: {
        pitch: 1.0, roll: 1.0, yaw: 1.0, thrust: 1.0,
    },
};
export default Config;