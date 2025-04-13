// src/OSDManager.js (Refactored from UIManager.js)
import EventBus, { EVENTS } from '../utils/EventBus.js';
import ConfigManager from '../config/ConfigManager.js'; // Keep if OSD needs config info

class OSDManager {
    constructor() {
        this.osdElement = null;
        this.telemetryElements = {
            altitude: null, speed: null, attitude: null, inputs: null, armedStatus: null,
        };
        // Hold last known state to avoid unnecessary updates if needed
        this.lastDroneState = null;
        this.lastControlsState = null;

        if (OSDManager._instance) {
            return OSDManager._instance;
        }
        OSDManager._instance = this;
        console.log("OSDManager: Initialized (Singleton)");
    }

    initialize() {
        this.osdElement = document.getElementById('osd');
        if (!this.osdElement) {
            console.error("OSDManager ERROR: OSD element #osd not found!");
            return;
        }

        // Initial structure
        this.osdElement.innerHTML = `
            <p>Armed: <strong id="osd-armed">--</strong></p>
            <p>Alt: <span id="osd-altitude">--</span> m</p>
            <p>Spd: <span id="osd-speed">--</span> m/s</p>
            <p>Att (R/P/Y): <span id="osd-attitude">-- / -- / --</span> °</p>
            <p>In (R/P/Y/T): <span id="osd-inputs">-- / -- / -- / --</span></p>
        `;

        // Cache elements
        this.telemetryElements.altitude = document.getElementById('osd-altitude');
        this.telemetryElements.speed = document.getElementById('osd-speed');
        this.telemetryElements.attitude = document.getElementById('osd-attitude');
        this.telemetryElements.inputs = document.getElementById('osd-inputs');
        this.telemetryElements.armedStatus = document.getElementById('osd-armed');

        // Subscribe to simulation state updates
        EventBus.on(EVENTS.SIMULATION_STATE_UPDATE, this.update.bind(this));
        // Listen for state changes to potentially clear OSD when not simulating
        EventBus.on(EVENTS.APP_STATE_CHANGED, this.handleAppStateChange.bind(this));


        console.log("OSDManager: Initialized and subscribed to state updates.");
        this.clearOSD(); // Clear initially
    }

    update(simulationState) {
        if (!this.osdElement || !this.telemetryElements.altitude || !simulationState) {
            // console.warn("OSDManager: Update skipped, elements not ready or no state.");
            return;
        }

        const { drone: droneState, controls: controlsState } = simulationState;

        // Update Drone Telemetry
        if (droneState) {
            // TODO: Add checks to only update if values changed significantly?
            this.telemetryElements.armedStatus.textContent = droneState.armed ? "ARMED" : "DISARMED";
            this.telemetryElements.armedStatus.style.color = droneState.armed ? "lightgreen" : "orange";
            this.telemetryElements.altitude.textContent = droneState.altitude.toFixed(1);
            this.telemetryElements.speed.textContent = droneState.speed.toFixed(1);
            if (droneState.euler) {
                const roll = droneState.euler.roll.toFixed(0);
                const pitch = droneState.euler.pitch.toFixed(0);
                const yaw = droneState.euler.yaw.toFixed(0);
                this.telemetryElements.attitude.textContent = `${roll} / ${pitch} / ${yaw}`;
            } else {
                this.telemetryElements.attitude.textContent = `-- / -- / --`;
            }
        } else {
            this.clearDroneTelemetry();
        }

        // Update Control Inputs
        if (controlsState) {
            const ctrl = controlsState;
            this.telemetryElements.inputs.textContent =
                `${ctrl.roll.toFixed(2)} / ${ctrl.pitch.toFixed(2)} / ${ctrl.yaw.toFixed(2)} / ${ctrl.thrust.toFixed(2)}`;
        } else {
            this.clearControlInputs();
        }
    }

    handleAppStateChange({ newState }) {
        // Hide or show OSD based on state
        const config = ConfigManager.getConfig();
        console.log(`OSDManager: Received APP_STATE_CHANGED to ${newState}`); // Debug log

        // Only clear data when not simulating
        if (newState !== 'SimulatingState') {
            if (config.DEBUG_MODE) console.log(`OSDManager: Clearing OSD data for state: ${newState}`);
            this.clearOSD();
        }
    }

    clearOSD() {
        this.clearDroneTelemetry();
        this.clearControlInputs();
    }

    clearDroneTelemetry() {
        if (!this.telemetryElements.altitude) return; // Check if initialized
        this.telemetryElements.armedStatus.textContent = "--";
        this.telemetryElements.armedStatus.style.color = "white";
        this.telemetryElements.altitude.textContent = '--';
        this.telemetryElements.speed.textContent = '--';
        this.telemetryElements.attitude.textContent = `-- / -- / --`;
    }

    clearControlInputs() {
        if (!this.telemetryElements.inputs) return; // Check if initialized
        this.telemetryElements.inputs.textContent = `-- / -- / -- / --`;
    }

    dispose() {
        EventBus.off(EVENTS.SIMULATION_STATE_UPDATE, this.update.bind(this));
        EventBus.off(EVENTS.APP_STATE_CHANGED, this.handleAppStateChange.bind(this));
        console.log("OSDManager: Disposed and unsubscribed from events.");
    }
}

const osdManagerInstance = new OSDManager();
export default osdManagerInstance;