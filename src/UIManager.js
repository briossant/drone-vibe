// src/UIManager.js
import Config from './Config.js';
// No THREE needed here if Euler calculation happens in Drone.js

class UIManager {
    constructor(engine) {
        this.engine = engine;
        this.osdElement = null;

        // Cache specific DOM elements for performance
        this.telemetryElements = {
            altitude: null,
            speed: null,
            attitude: null, // Display Roll/Pitch/Yaw
            inputs: null,
            armedStatus: null, // Added for armed state
        };

        if (Config.DEBUG_MODE) {
            console.log('UIManager: Initialized');
        }
    }

    initialize() {
        this.osdElement = document.getElementById('osd');
        if (!this.osdElement) {
            console.error("UIManager: OSD element #osd not found!");
            return;
        }
        // Create/find specific elements within the OSD container
        // Added Armed status and units
        this.osdElement.innerHTML = `
            <p>Armed: <strong id="osd-armed">DISARMED</strong></p>
            <p>Alt: <span id="osd-altitude">--</span> m</p>
            <p>Spd: <span id="osd-speed">--</span> m/s</p>
            <p>Att (R/P/Y): <span id="osd-attitude">-- / -- / --</span> °</p>
            <p>In (R/P/Y/T): <span id="osd-inputs">-- / -- / -- / --</span></p>
        `;
        // Cache the elements
        this.telemetryElements.altitude = document.getElementById('osd-altitude');
        this.telemetryElements.speed = document.getElementById('osd-speed');
        this.telemetryElements.attitude = document.getElementById('osd-attitude');
        this.telemetryElements.inputs = document.getElementById('osd-inputs');
        this.telemetryElements.armedStatus = document.getElementById('osd-armed');


        if (Config.DEBUG_MODE) {
            console.log('UIManager: OSD elements initialized and cached.');
        }
    }

    update(simulationState) {
        // Guard clauses for safety
        if (!this.osdElement || !simulationState || !this.telemetryElements.altitude) {
            // Check one specific element to see if init failed
            // console.warn("UIManager: Update skipped, OSD not ready or no state.");
            return;
        }

        // --- Update based on drone state ---
        if (simulationState.drone) {
            const drone = simulationState.drone;

            // Armed Status
            if (this.telemetryElements.armedStatus) {
                this.telemetryElements.armedStatus.textContent = drone.armed ? "ARMED" : "DISARMED";
                this.telemetryElements.armedStatus.style.color = drone.armed ? "lightgreen" : "orange";
            }

            // Altitude
            if (this.telemetryElements.altitude) {
                this.telemetryElements.altitude.textContent = drone.altitude.toFixed(1);
            }

            // Speed
            if (this.telemetryElements.speed) {
                this.telemetryElements.speed.textContent = drone.speed.toFixed(1);
            }

            // Attitude (Roll/Pitch/Yaw)
            if (drone.euler && this.telemetryElements.attitude) {
                const roll = drone.euler.roll.toFixed(0);
                const pitch = drone.euler.pitch.toFixed(0);
                const yaw = drone.euler.yaw.toFixed(0);
                this.telemetryElements.attitude.textContent = `${roll} / ${pitch} / ${yaw}`;
            } else if (this.telemetryElements.attitude) {
                this.telemetryElements.attitude.textContent = `-- / -- / --`; // Fallback
            }

        } else {
            // Handle case where drone state is not yet available (e.g., during loading)
            if (this.telemetryElements.armedStatus) this.telemetryElements.armedStatus.textContent = "NO DATA";
            if (this.telemetryElements.altitude) this.telemetryElements.altitude.textContent = '--';
            if (this.telemetryElements.speed) this.telemetryElements.speed.textContent = '--';
            if (this.telemetryElements.attitude) this.telemetryElements.attitude.textContent = `-- / -- / --`;
        }

        // --- Update based on control inputs ---
        if (simulationState.controls && this.telemetryElements.inputs) {
            const ctrl = simulationState.controls;
            // Format inputs to 2 decimal places
            this.telemetryElements.inputs.textContent =
                `${ctrl.roll.toFixed(2)} / ${ctrl.pitch.toFixed(2)} / ${ctrl.yaw.toFixed(2)} / ${ctrl.thrust.toFixed(2)}`;
        } else if (this.telemetryElements.inputs) {
            this.telemetryElements.inputs.textContent = `-- / -- / -- / --`; // Fallback
        }
    }
}

export default UIManager;