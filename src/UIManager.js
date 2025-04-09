// src/UIManager.js
import Config from './Config.js';

class UIManager {
    constructor(engine) {
        this.engine = engine;
        this.osdElement = null;

        // Cache specific DOM elements for performance
        this.telemetryElements = {
            altitude: null,
            speed: null,
            attitude: null,
            inputs: null,
            // Add more as needed
        };

        if (Config.DEBUG_MODE) {
            console.log('UIManager: Initialized');
        }
    }

    initialize() {
        this.osdElement = document.getElementById('osd');
        if (!this.osdElement) {
            console.error("UIManager: OSD element not found!");
            return;
        }
        // Create/find specific elements within the OSD container
        this.osdElement.innerHTML = `
            <p>Altitude: <span id="osd-altitude">--</span> m</p>
            <p>Speed: <span id="osd-speed">--</span> m/s</p>
            <p>Attitude (RPY): <span id="osd-attitude">--</span></p>
            <p>Inputs (R/P/Y/T): <span id="osd-inputs">--</span></p>
        `;
        this.telemetryElements.altitude = document.getElementById('osd-altitude');
        this.telemetryElements.speed = document.getElementById('osd-speed');
        this.telemetryElements.attitude = document.getElementById('osd-attitude');
        this.telemetryElements.inputs = document.getElementById('osd-inputs');

        if (Config.DEBUG_MODE) {
            console.log('UIManager: OSD elements initialized.');
        }
    }

    update(simulationState) {
        if (!this.osdElement || !simulationState) return;

        // Update telemetry based on data from the simulation engine/drone
        // Example data structure expected in simulationState (adjust as needed):
        // { drone: { position, velocity, quaternion }, controls: { roll, pitch, yaw, thrust } }

        if (simulationState.drone) {
            const drone = simulationState.drone;
            if (drone.position && this.telemetryElements.altitude) {
                this.telemetryElements.altitude.textContent = drone.position.y.toFixed(1);
            }
            if (drone.velocity && this.telemetryElements.speed) {
                const speed = drone.velocity.length().toFixed(1);
                this.telemetryElements.speed.textContent = speed;
            }
            if (drone.quaternion && this.telemetryElements.attitude) {
                // Convert quaternion to Euler for display (can be complex, basic example)
                // NOTE: THREE.Euler needed, import it or calculate manually
                // const euler = new THREE.Euler().setFromQuaternion(drone.quaternion, 'XYZ'); // Use correct order
                // const roll = (euler.x * 180 / Math.PI).toFixed(0);
                // const pitch = (euler.y * 180 / Math.PI).toFixed(0);
                // const yaw = (euler.z * 180 / Math.PI).toFixed(0);
                // this.telemetryElements.attitude.textContent = `${roll}/${pitch}/${yaw}`;
                this.telemetryElements.attitude.textContent = `Quat: W:${drone.quaternion.w.toFixed(2)}`; // Placeholder
            }
        }

        if (simulationState.controls && this.telemetryElements.inputs) {
            const ctrl = simulationState.controls;
            this.telemetryElements.inputs.textContent =
                `${ctrl.roll.toFixed(2)}/${ctrl.pitch.toFixed(2)}/${ctrl.yaw.toFixed(2)}/${ctrl.thrust.toFixed(2)}`;
        }
    }
}

export default UIManager;