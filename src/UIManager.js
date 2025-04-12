// src/UIManager.js

import {getCurrentConfig} from "./ConfigManager.js";

class UIManager {
    constructor(engine) {
        this.engine = engine;
        this.osdElement = null;
        this.telemetryElements = {
            altitude: null, speed: null, attitude: null, inputs: null, armedStatus: null,
        };
        const Config = getCurrentConfig(); // Use helper
        this.inSimMenuElement = document.getElementById('in-sim-menu');

        if (Config.DEBUG_MODE) {
            console.log('UIManager: Constructor called');
        }
    }

    initialize() {
        const Config = getCurrentConfig(); // Use helper

        if (Config.DEBUG_MODE) console.log('UIManager: Initialize called'); // Log entry
        this.osdElement = document.getElementById('osd');

        if (!this.osdElement) {
            console.error("UIManager ERROR: OSD element #osd not found!");
            return; // Stop if element not found
        }
        if (Config.DEBUG_MODE) console.log('UIManager: Found #osd element:', this.osdElement);

        // Set the initial structure. This SHOULD overwrite "Loading..."
        this.osdElement.innerHTML = `
            <p>Armed: <strong id="osd-armed">--</strong></p>
            <p>Alt: <span id="osd-altitude">--</span> m</p>
            <p>Spd: <span id="osd-speed">--</span> m/s</p>
            <p>Att (R/P/Y): <span id="osd-attitude">-- / -- / --</span> °</p>
            <p>In (R/P/Y/T): <span id="osd-inputs">-- / -- / -- / --</span></p>
        `;
        if (Config.DEBUG_MODE) console.log('UIManager: OSD innerHTML set.');

        // Cache the elements AFTER setting innerHTML
        this.telemetryElements.altitude = document.getElementById('osd-altitude');
        this.telemetryElements.speed = document.getElementById('osd-speed');
        this.telemetryElements.attitude = document.getElementById('osd-attitude');
        this.telemetryElements.inputs = document.getElementById('osd-inputs');
        this.telemetryElements.armedStatus = document.getElementById('osd-armed');

        // Check if caching worked
        if (this.telemetryElements.altitude && this.telemetryElements.armedStatus) {
            if (Config.DEBUG_MODE) console.log('UIManager: Telemetry elements cached successfully.');
        } else {
            console.error('UIManager ERROR: Failed to cache one or more telemetry elements!');
        }
    }

    update(simulationState) {
        // Add a log to see if update is ever called
        // console.log('UIManager: Update called with state:', simulationState); // Can be noisy, enable if needed

        // Guard clauses for safety
        if (!this.osdElement || !this.telemetryElements.altitude || !this.telemetryElements.armedStatus) {
            // Check crucial elements to see if init failed or elements are missing
            // console.warn("UIManager: Update skipped, OSD elements not ready.");
            return;
        }
        if (!simulationState) {
            // console.warn("UIManager: Update skipped, no simulation state provided.");
            return;
        }


        // --- Update based on drone state ---
        if (simulationState.drone) {
            const drone = simulationState.drone;

            // Armed Status
            this.telemetryElements.armedStatus.textContent = drone.armed ? "ARMED" : "DISARMED";
            this.telemetryElements.armedStatus.style.color = drone.armed ? "lightgreen" : "orange";

            // Altitude
            this.telemetryElements.altitude.textContent = drone.altitude.toFixed(1);

            // Speed
            this.telemetryElements.speed.textContent = drone.speed.toFixed(1);

            // Attitude (Roll/Pitch/Yaw)
            if (drone.euler) {
                const roll = drone.euler.roll.toFixed(0);
                const pitch = drone.euler.pitch.toFixed(0);
                const yaw = drone.euler.yaw.toFixed(0);
                this.telemetryElements.attitude.textContent = `${roll} / ${pitch} / ${yaw}`;
            } else {
                this.telemetryElements.attitude.textContent = `-- / -- / --`;
            }

        } else {
            // Handle case where drone state is not available (display defaults/placeholders)
            this.telemetryElements.armedStatus.textContent = "NO DATA";
            this.telemetryElements.armedStatus.style.color = "white"; // Reset color
            this.telemetryElements.altitude.textContent = '--';
            this.telemetryElements.speed.textContent = '--';
            this.telemetryElements.attitude.textContent = `-- / -- / --`;
        }

        // --- Update based on control inputs ---
        if (simulationState.controls) {
            const ctrl = simulationState.controls;
            this.telemetryElements.inputs.textContent =
                `${ctrl.roll.toFixed(2)} / ${ctrl.pitch.toFixed(2)} / ${ctrl.yaw.toFixed(2)} / ${ctrl.thrust.toFixed(2)}`;
        } else {
            this.telemetryElements.inputs.textContent = `-- / -- / -- / --`;
        }
    }

    applyConfiguration(config) {
        if (!config) return;
        const C = config;
        // Update any UI elements that depend directly on config
        // e.g., If OSD needs to show FOV, update it here.
        // For now, just log.
        if(C.DEBUG_MODE) console.log("UIManager: Configuration applied.");
    }
}

export default UIManager;