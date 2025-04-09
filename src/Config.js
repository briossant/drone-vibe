// src/Config.js
const Config = {
    DEBUG_MODE: true,
    // Physics settings (placeholders)
    GRAVITY: -9.82,
    PHYSICS_TIMESTEP: 1 / 60, // Target physics update rate (60Hz)
    // Drone properties (placeholders)
    DRONE_MASS: 0.5, // kg
    // Input settings (placeholders)
    KEYBOARD_SENSITIVITY: {
        pitch: 1.0,
        roll: 1.0,
        yaw: 1.0,
        thrust: 1.0,
    },
};

export default Config;