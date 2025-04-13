// src/ConfigManager.js
import defaultConfig from './defaultConfig.js';
import Config from './Config.js';

const LOCAL_STORAGE_KEY = 'droneSimUserConfig';

class ConfigManager {
    constructor() {
        this.userConfig = {};
        this.mergedConfig = {}; // Holds the final config (defaults overridden by user)
        this.loadConfig(); // Load immediately on instantiation

        if (this.mergedConfig.DEBUG_MODE) {
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
            if (this.mergedConfig.DEBUG_MODE) {
                console.log("ConfigManager: User config saved to localStorage.");
            }
        } catch (error) {
            console.error("ConfigManager: Error saving user config to localStorage:", error);
        }
    }

    // Deep merge user config onto defaults
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
                        merge(targetVal, sourceVal);
                    } else if (sourceVal !== undefined) { // Only overwrite if source has a value
                        target[key] = sourceVal;
                    }
                }
            }
        };

        merge(this.mergedConfig, Config);
        merge(this.mergedConfig, this.userConfig);

        // Maybe log the final merged config if needed for debugging
        // if (this.mergedConfig.DEBUG_MODE) console.log("Final Merged Config:", this.mergedConfig);
    }

    getConfig() {
        return this.mergedConfig;
    }

    updateUserSetting(keyPath, value) {
        const keys = keyPath.split('.');
        let current = this.userConfig;
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (current[key] === undefined || typeof current[key] !== 'object' || current[key] === null) {
                current[key] = {};
            }
            current = current[key];
        }
        current[keys[keys.length - 1]] = value;

        this._mergeConfigs(); // Re-merge after updating user config in memory

        if (this.mergedConfig.DEBUG_MODE) {
            console.log(`ConfigManager: User setting updated in memory - ${keyPath}:`, value);
        }
    }

    applySettingsToEngine(engine) {
        if (!engine) return;
        const config = this.getConfig();
        if (config.DEBUG_MODE) console.log("ConfigManager: Applying settings to engine modules...");

        try {
            // Ensure modules are ready before applying
            engine.renderer?.applyConfiguration(config);
            engine.physicsEngine?.applyConfiguration(config);
            engine.inputManager?.applyConfiguration(config);
            engine.drone?.applyConfiguration(config);
            engine.uiManager?.applyConfiguration(config);
            // Add engine.world?.applyConfiguration(config); if needed
            if (config.DEBUG_MODE) console.log("ConfigManager: Finished applying settings to modules.");
        } catch (error) {
            console.error("ERROR during applySettingsToEngine:", error);
            // Potentially re-throw or handle more gracefully
        }
    }
}

const instance = new ConfigManager();
export default instance;

export function getCurrentConfig() {
    return instance.getConfig();
}