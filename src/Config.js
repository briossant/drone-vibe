// src/Config.js
const Config = {
    DEBUG_MODE: true,
    GRAVITY: -9.82,
    PHYSICS_TIMESTEP: 1 / 60,

    // Drone properties
    DRONE_MASS: 0.8, // kg
    DRONE_DIMENSIONS: {
        bodyWidth: 0.15, bodyHeight: 0.08, bodyDepth: 0.15,
        armLength: 0.18, armWidth: 0.02,
        propDiameter: 0.1
    },

    // --- NEW: Drone Physics Settings (Crucial for Tuning Phase 5+) ---
    DRONE_PHYSICS_SETTINGS: {
        // Linear damping simulates air resistance, affecting overall speed. Higher = more drag.
        linearDamping: 0.5, // Start value, needs tuning (try 0.1 - 0.8)

        // Angular damping simulates air resistance against rotation and provides basic "Rate Mode" stability.
        // Higher values make the drone stop rotating faster when inputs are released. CRITICAL for feel.
        angularDamping: 0.95, // Start value, needs significant tuning (try 0.5 - 0.98)
    },

    // Input sensitivity (how much stick input translates to control signal)
    KEYBOARD_SENSITIVITY: {
        pitch: 1.0,
        roll: 1.0,
        yaw: 1.0,
        // Thrust doesn't typically use sensitivity like this
    },

    // Drone Control Force/Torque Multipliers (Also needs tuning!)
    DRONE_CONTROL_MULTIPLIERS: {
        // Adjust MAX_THRUST so drone can hover around 50-60% input and climb well.
        MAX_THRUST: 26.0, // Newtons (Increased slightly, TUNE THIS!)

        // Adjust TORQUE values to get desired rotation speed (responsiveness).
        // If angularDamping is high, you might need higher torque.
        PITCH_TORQUE: 0.04, // Newton-meters (Increased slightly, TUNE THIS!)
        ROLL_TORQUE: 0.04,  // Newton-meters (Increased slightly, TUNE THIS!)
        YAW_TORQUE: 0.03,   // Newton-meters (Increased slightly, TUNE THIS!)
    },
};
export default Config;