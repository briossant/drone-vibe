// src/ConfigManager.js
import defaultConfig from './defaultConfig.js';
import Config from './Config.js';
import EventBus, { EVENTS } from '../utils/EventBus.js';
import StateManager from "../managers/StateManager.js"; // Import EventBus if emitting save events

const LOCAL_STORAGE_KEY = 'droneSimUserConfig';

class ConfigManager {
    constructor() {
        this.userConfig = {};
        this.mergedConfig = {};
        this.loadConfig();

        if (this.mergedConfig.DEBUG_MODE) {
            console.log("ConfigManager: Initialized.");
            console.log("ConfigManager: Loaded user config:", this.userConfig);
        }
    }

    loadConfig() {
        try {
            const savedConfig = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (savedConfig) {
                this.userConfig = JSON.parse(savedConfig);
            } else {
                this.userConfig = {};
            }
        } catch (error) {
            console.error("ConfigManager: Error loading user config from localStorage:", error);
            this.userConfig = {};
        }
        this._mergeConfigs();
    }

    saveConfig() {
        try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(this.userConfig));
            if (this.mergedConfig.DEBUG_MODE) {
                console.log("ConfigManager: User config auto-saved to localStorage.");
            }
            // Optionally emit an event after saving
            // EventBus.emit(EVENTS.CONFIG_SAVED);
        } catch (error) {
            console.error("ConfigManager: Error saving user config to localStorage:", error);
        }
    }

    _mergeConfigs() {
        this.mergedConfig = JSON.parse(JSON.stringify(defaultConfig));
        const merge = (target, source) => {
            for (const key in source) {
                if (Object.prototype.hasOwnProperty.call(source, key)) {
                    const sourceVal = source[key];
                    const targetVal = target[key];
                    if (sourceVal !== null && typeof sourceVal === 'object' && !Array.isArray(sourceVal) &&
                        targetVal !== null && typeof targetVal === 'object' && !Array.isArray(targetVal)) {
                        merge(targetVal, sourceVal);
                    } else if (sourceVal !== undefined) {
                        target[key] = sourceVal;
                    }
                }
            }
        };
        merge(this.mergedConfig, Config); // Merge core non-user config
        merge(this.mergedConfig, this.userConfig); // Merge user config over defaults+core
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

        // --- NEW/MODIFIED: Implement Auto-Saving ---
        this.saveConfig(); // Save immediately after updating the value
        // --- END Auto-Saving ---

        // Apply the setting immediately to the engine
        // Note: This might cause many sequential applies. Consider debouncing or a different strategy
        // if performance becomes an issue, but for now, direct apply is simplest for immediate effect.
        const engine = StateManager?.context?.simulatorEngine; // Get engine instance safely from StateManager context
        if (engine) {
            this.applySettingsToEngine(engine); // Apply all settings (which includes the one just changed)
            if (this.mergedConfig.DEBUG_MODE) {
                console.log(`ConfigManager: Auto-applied settings to engine after updating ${keyPath}.`);
            }
        } else if (this.mergedConfig.DEBUG_MODE) {
            console.log(`ConfigManager: Engine not found in context, skipping immediate apply for ${keyPath}.`);
        }

        if (this.mergedConfig.DEBUG_MODE) {
            // Log moved inside saveConfig
            // console.log(`ConfigManager: User setting updated & saved - ${keyPath}:`, value);
        }
    }

    applySettingsToEngine(engine) {
        if (!engine) return;
        const config = this.getConfig();
        if (config.DEBUG_MODE) console.log("ConfigManager: Applying settings to engine modules...");

        try {
            engine.renderer?.applyConfiguration(config);
            engine.physicsEngine?.applyConfiguration(config);
            engine.inputManager?.applyConfiguration(config);
            engine.drone?.applyConfiguration(config);
            // Removed uiManager?.applyConfiguration(config); - MenuManager doesn't need it currently
            if (config.DEBUG_MODE) console.log("ConfigManager: Finished applying settings to modules.");
            // Optionally emit event that settings were applied
            EventBus.emit(EVENTS.SETTINGS_APPLIED);
        } catch (error) {
            console.error("ERROR during applySettingsToEngine:", error);
        }
    }

    // --- NEW (Optional): Reset functionality ---
    /**
     * Resets user configuration for a specific category or all settings.
     * @param {string} categoryPath - Dot notation path to the category in defaultConfig (e.g., 'GRAPHICS_SETTINGS', 'FLIGHT_CONTROLLER_SETTINGS.PID.roll') or 'all'.
     */
    resetToDefaults(categoryPath = 'all') {
        if (categoryPath === 'all') {
            this.userConfig = {}; // Clear all user overrides
            if (this.mergedConfig.DEBUG_MODE) console.log("ConfigManager: Resetting all user settings to defaults.");
        } else {
            const keys = categoryPath.split('.');
            let userCurrent = this.userConfig;
            let defaultCurrent = defaultConfig;

            // Traverse userConfig to find the parent object to delete the key from
            for (let i = 0; i < keys.length - 1; i++) {
                if (!userCurrent || !userCurrent[keys[i]]) return; // Category doesn't exist in user config, nothing to reset
                userCurrent = userCurrent[keys[i]];
                defaultCurrent = defaultCurrent?.[keys[i]]; // Traverse default config too
            }

            const finalKey = keys[keys.length - 1];
            if (userCurrent && defaultCurrent && typeof userCurrent[finalKey] !== 'undefined') {
                delete userCurrent[finalKey]; // Delete the specific user override
                if (this.mergedConfig.DEBUG_MODE) console.log(`ConfigManager: Resetting user setting category "${categoryPath}" to default.`);

                // Clean up empty parent objects in userConfig if necessary
                // (Add logic here if needed, but often not critical)

            } else {
                if (this.mergedConfig.DEBUG_MODE) console.log(`ConfigManager: No user override found for "${categoryPath}", nothing to reset.`);
                return; // No change needed
            }
        }

        this._mergeConfigs(); // Re-merge to apply defaults
        this.saveConfig();   // Save the cleared/updated user config

        // Apply the reset settings immediately
        const engine = StateManager?.context?.simulatorEngine;
        if (engine) {
            this.applySettingsToEngine(engine);
            if (this.mergedConfig.DEBUG_MODE) console.log(`ConfigManager: Applied reset default settings for "${categoryPath}" to engine.`);
        }
    }

}

// Keep singleton export
const instance = new ConfigManager();
export default instance;

export function getCurrentConfig() {
    return instance.getConfig();
}