// src/ConfigManager.js
import defaultConfig from './defaultConfig.js';
import Config from './Config.js'; // Import original config for non-user-configurable parts

const LOCAL_STORAGE_KEY = 'droneSimUserConfig';

class ConfigManager {
    constructor() {
        this.userConfig = {};
        this.mergedConfig = {}; // Holds the final config (defaults overridden by user)
        this.loadConfig(); // Load immediately on instantiation

        if (Config.DEBUG_MODE) { // Use original Config for debug flag
            console.log("ConfigManager: Initialized.");
            console.log("ConfigManager: Loaded user config:", this.userConfig);
            // console.log("ConfigManager: Merged config:", this.mergedConfig); // Can be large
        }
    }

    loadConfig() {
        try {
            const savedConfig = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (savedConfig) {
                this.userConfig = JSON.parse(savedConfig);
                // Optional: Add validation/migration logic here if config structure changes
            } else {
                this.userConfig = {}; // No saved config, use defaults
            }
        } catch (error) {
            console.error("ConfigManager: Error loading user config from localStorage:", error);
            this.userConfig = {}; // Reset to defaults on error
        }
        this._mergeConfigs();
    }

    saveConfig() {
        try {
            // Only save the user overrides, not the full merged config
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(this.userConfig));
            if (Config.DEBUG_MODE) {
                console.log("ConfigManager: User config saved to localStorage.");
            }
        } catch (error) {
            console.error("ConfigManager: Error saving user config to localStorage:", error);
        }
    }

    // Deep merge user config onto defaults
    // NOTE: This is a simple deep merge, might need a more robust library for complex cases
    _mergeConfigs() {
        // Start with a deep copy of defaults
        this.mergedConfig = JSON.parse(JSON.stringify(defaultConfig));

        const merge = (target, source) => {
            for (const key in source) {
                if (Object.prototype.hasOwnProperty.call(source, key)) {
                    const sourceVal = source[key];
                    const targetVal = target[key];

                    if (sourceVal !== null && typeof sourceVal === 'object' && !Array.isArray(sourceVal) &&
                        targetVal !== null && typeof targetVal === 'object' && !Array.isArray(targetVal)) {
                        // Recurse for nested objects
                        merge(targetVal, sourceVal);
                    } else {
                        // Overwrite or add primitive values/arrays
                        target[key] = sourceVal;
                    }
                }
            }
        };

        merge(this.mergedConfig, this.userConfig);

        // Also merge in non-user-configurable values from the original Config.js
        // (like DEBUG_MODE, PHYSICS_TIMESTEP etc.) - be selective
        this.mergedConfig.DEBUG_MODE = Config.DEBUG_MODE;
        this.mergedConfig.PHYSICS_TIMESTEP = Config.PHYSICS_TIMESTEP;
        this.mergedConfig.GRAVITY = Config.GRAVITY; // Keep GRAVITY fixed for now unless explicitly made user-configurable
        this.mergedConfig.DRONE_START_POSITION = Config.DRONE_START_POSITION;
        // Add any other essential non-user-config values

        // Maybe log the final merged config if needed for debugging
        // if (Config.DEBUG_MODE) console.log("Final Merged Config:", this.mergedConfig);
    }

    // Get the currently active configuration
    getConfig() {
        return this.mergedConfig;
    }

    // Update a specific setting in the user config (in memory)
    // This should be called by the UI elements in Phase 11
    updateUserSetting(keyPath, value) {
        // keyPath could be a dot notation string like "GAMEPAD_SENSITIVITY.pitch"
        const keys = keyPath.split('.');
        let current = this.userConfig;
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (current[key] === undefined || typeof current[key] !== 'object') {
                current[key] = {}; // Create nested object if it doesn't exist
            }
            current = current[key];
        }
        current[keys[keys.length - 1]] = value;

        // Re-merge after updating user config in memory
        this._mergeConfigs();

        if (Config.DEBUG_MODE) {
            // console.log(`ConfigManager: User setting updated - ${keyPath}:`, value);
        }
    }

    applySettingsToEngine(engine) {
        if (!engine) return;
        const config = this.getConfig(); // Get config once
        if (config.DEBUG_MODE) console.log("ConfigManager: Applying settings to engine modules...");

        try { // Add try...catch
            console.log("DEBUG: Applying to Renderer..."); // ADD
            engine.renderer?.applyConfiguration(config);
            console.log("DEBUG: Applying to PhysicsEngine..."); // ADD
            engine.physicsEngine?.applyConfiguration(config);
            console.log("DEBUG: Applying to InputManager..."); // ADD
            engine.inputManager?.applyConfiguration(config);
            console.log("DEBUG: Applying to Drone..."); // ADD
            engine.drone?.applyConfiguration(config);
            console.log("DEBUG: Applying to UIManager..."); // ADD
            engine.uiManager?.applyConfiguration(config);
            console.log("DEBUG: Finished applying settings to modules."); // ADD
        } catch (error) {
            console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
            console.error("ERROR during applySettingsToEngine:", error);
            console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
            throw error; // Re-throw to be caught by main.js
        }
    }
}

// Export a single instance (Singleton pattern)
const instance = new ConfigManager();
export default instance;

// Helper function to easily access the current config from anywhere
export function getCurrentConfig() {
    return instance.getConfig();
}