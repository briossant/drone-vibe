// src/FlightController.js
import * as CANNON from 'cannon-es';
import { getCurrentConfig } from '../config/ConfigManager.js';
import { clamp } from '../utils/Utils.js'; // Assuming clamp is in Utils

// Simple PID Controller Implementation
class PIDController {
    constructor(kp, ki, kd, iLimit = 1.0, outputLimit = 1.0) {
        this.kp = kp; // Proportional gain
        this.ki = ki; // Integral gain
        this.kd = kd; // Derivative gain

        this.iLimit = iLimit;         // Limit for the integral term
        this.outputLimit = outputLimit; // Limit for the total output

        this.integral = 0;
        this.previousError = 0;
        this.previousTime = null;
    }

    update(target, current, deltaTime) {
        if (deltaTime <= 0) return 0; // Prevent division by zero or weirdness

        const error = target - current;

        // Integral term (with anti-windup)
        this.integral += error * deltaTime;
        this.integral = clamp(this.integral, -this.iLimit, this.iLimit);

        // Derivative term (using change in error)
        const derivative = (error - this.previousError) / deltaTime;

        // Calculate PID output
        const output = (this.kp * error) + (this.ki * this.integral) + (this.kd * derivative);

        // Store values for next iteration
        this.previousError = error;

        // Clamp output
        return clamp(output, -this.outputLimit, this.outputLimit);
    }

    reset() {
        this.integral = 0;
        this.previousError = 0;
        this.previousTime = null; // Ensure dt is calculated fresh on next update
    }

    setGains(kp, ki, kd) {
        this.kp = kp;
        this.ki = ki;
        this.kd = kd;
    }
}


// --- Flight Controller Class ---
const thrustForceVec = new CANNON.Vec3(); // Reusable vector for thrust
const worldTorque = new CANNON.Vec3();   // Reusable vector for world torque

class FlightController {
    constructor(droneBody) {
        this.body = droneBody;
        this.armed = false;
        this.flightMode = 'RATE'; // Start with RATE mode

        const config = getCurrentConfig();
        const pidConfig = config.FLIGHT_CONTROLLER_SETTINGS.PID;
        const rateLimits = config.FLIGHT_CONTROLLER_SETTINGS.RATE_LIMITS; // Degrees per second
        this.maxRatesRad = { // Convert to radians per second
            roll: rateLimits.roll * Math.PI / 180,
            pitch: rateLimits.pitch * Math.PI / 180,
            yaw: rateLimits.yaw * Math.PI / 180,
        };

        // Output limits should roughly correspond to max possible torque from multipliers
        const torqueLimits = config.DRONE_CONTROL_MULTIPLIERS; // Use these as a starting point

        // Initialize PID controllers
        this.pidRollRate = new PIDController(pidConfig.roll.kp, pidConfig.roll.ki, pidConfig.roll.kd, pidConfig.iLimit, torqueLimits.ROLL_TORQUE);
        this.pidPitchRate = new PIDController(pidConfig.pitch.kp, pidConfig.pitch.ki, pidConfig.pitch.kd, pidConfig.iLimit, torqueLimits.PITCH_TORQUE);
        this.pidYawRate = new PIDController(pidConfig.yaw.kp, pidConfig.yaw.ki, pidConfig.yaw.kd, pidConfig.iLimit, torqueLimits.YAW_TORQUE);

        if (config.DEBUG_MODE) {
            console.log("FlightController: Initialized with PID gains:", pidConfig);
            console.log("FlightController: Max Rates (rad/s):", this.maxRatesRad);
        }
    }

    setArmed(isArmed) {
        this.armed = isArmed;
        if (!isArmed) {
            // Reset PIDs when disarming to prevent integral windup carrying over
            this.pidRollRate.reset();
            this.pidPitchRate.reset();
            this.pidYawRate.reset();
        }
        if (getCurrentConfig().DEBUG_MODE) console.log(`FlightController: Armed state set to ${isArmed}`);
    }

    update(deltaTime, controls) {
        if (!this.body || deltaTime <= 0) return;

        const config = getCurrentConfig();

        // --- Disarmed State ---
        if (!this.armed) {
            // Apply zero torque if disarmed - physics damping will handle slowdown
            this.body.torque.set(0, 0, 0); // Ensure no residual torque is applied
            // Let gravity and damping handle the rest
            return;
        }

        // --- Thrust Application (Directly, Local Y-axis) ---
        // (Could be refined later with motor model/curve)
        const maxThrust = config.DRONE_CONTROL_MULTIPLIERS.MAX_THRUST;
        const currentThrustForce = controls.thrust * maxThrust;
        thrustForceVec.set(0, currentThrustForce, 0); // Local Y is up
        this.body.applyLocalForce(thrustForceVec, CANNON.Vec3.ZERO); // Apply at CG

        // --- Calculate Target Rates ---
        // Map pilot input (controls.roll/pitch/yaw from -1 to 1) to target angular rates (rad/s)
        const targetRollRate = controls.roll * this.maxRatesRad.roll;
        const targetPitchRate = controls.pitch * this.maxRatesRad.pitch; // Positive input = pitch forward = negative pitch rate (nose down)
        const targetYawRate = controls.yaw * this.maxRatesRad.yaw;     // Positive input = yaw right = negative yaw rate

        // --- Get Current Rates ---
        // Get angular velocity in the body's LOCAL frame
        const localAngularVelocity = this.body.angularVelocity; //.clone(); // Use directly if not modifying? Clone if unsure.
        // CANNON.Body.angularVelocity is in world frame. We need it in local frame for PID control relative to drone axes.
        const worldAngularVelocity = this.body.angularVelocity;
        const localAngularVelocityCorrected = this.body.vectorToLocalFrame(worldAngularVelocity);


        // --- PID Calculation (Rate Mode) ---
        // Note: We need to match PID axes to local angular velocity axes.
        // Assume CANNON localAngularVelocity axes match THREE's standard:
        // X: Pitch axis (positive = nose up)
        // Y: Yaw axis   (positive = yaw left)
        // Z: Roll axis  (positive = roll right)

        // Calculate torque needed to achieve target rates
        // Target vs Current. DeltaTime is crucial.
        const rollTorque = this.pidRollRate.update(targetRollRate, localAngularVelocityCorrected.z, deltaTime);
        const pitchTorque = this.pidPitchRate.update(targetPitchRate, localAngularVelocityCorrected.x, deltaTime);
        const yawTorque = this.pidYawRate.update(targetYawRate, localAngularVelocityCorrected.y, deltaTime);


        // --- Apply Torque (Convert Local Torque to World Frame) ---
        // Set the calculated torques in the drone's LOCAL coordinate system
        // IMPORTANT AXIS MAPPING CHECK:
        // pidRollRate controls rotation around Z axis.
        // pidPitchRate controls rotation around X axis.
        // pidYawRate controls rotation around Y axis.
        const localTorque = new CANNON.Vec3(pitchTorque, yawTorque, rollTorque); // Local (X, Y, Z) torque

        // Convert Local Torque vector to World Frame before applying
        this.body.vectorToWorldFrame(localTorque, worldTorque);
        this.body.applyTorque(worldTorque);

        // --- (Optional) Add Advanced Drag/Air Resistance ---
        // Replace or supplement basic damping here
        // Example: F_drag = - C * v^2 * normalize(v)
        // const C_drag = 0.1; // Drag coefficient (tune)
        // const velocity = this.body.velocity;
        // const speedSquared = velocity.lengthSquared();
        // if (speedSquared > 0.01) { // Avoid division by zero / jitter at rest
        //     const dragMagnitude = C_drag * speedSquared;
        //     const dragForce = velocity.clone().normalize().scale(-dragMagnitude);
        //     this.body.applyForce(dragForce, CANNON.Vec3.ZERO);
        // }


    }

    // Method to update PID gains if changed in settings
    applyConfiguration(config) {
        const pidConfig = config.FLIGHT_CONTROLLER_SETTINGS.PID;
        const rateLimits = config.FLIGHT_CONTROLLER_SETTINGS.RATE_LIMITS;
        const torqueLimits = config.DRONE_CONTROL_MULTIPLIERS; // Assuming these still represent a torque scale

        this.pidRollRate.setGains(pidConfig.roll.kp, pidConfig.roll.ki, pidConfig.roll.kd);
        this.pidPitchRate.setGains(pidConfig.pitch.kp, pidConfig.pitch.ki, pidConfig.pitch.kd);
        this.pidYawRate.setGains(pidConfig.yaw.kp, pidConfig.yaw.ki, pidConfig.yaw.kd);

        // Update limits if they are configurable too
        this.pidRollRate.iLimit = pidConfig.iLimit;
        this.pidPitchRate.iLimit = pidConfig.iLimit;
        this.pidYawRate.iLimit = pidConfig.iLimit;
        // Update output limits based on torque multipliers?
        this.pidRollRate.outputLimit = torqueLimits.ROLL_TORQUE;
        this.pidPitchRate.outputLimit = torqueLimits.PITCH_TORQUE;
        this.pidYawRate.outputLimit = torqueLimits.YAW_TORQUE;

        this.maxRatesRad = { // Update max rates
            roll: rateLimits.roll * Math.PI / 180,
            pitch: rateLimits.pitch * Math.PI / 180,
            yaw: rateLimits.yaw * Math.PI / 180,
        };

        if (config.DEBUG_MODE) {
            console.log("FlightController: Applied new configuration (PIDs, Rates).");
            // console.log("FlightController: New PID gains:", pidConfig);
            // console.log("FlightController: New Max Rates (rad/s):", this.maxRatesRad);
        }
    }

    reset() {
        this.pidRollRate.reset();
        this.pidPitchRate.reset();
        this.pidYawRate.reset();
        // Reset any other internal state if needed
    }
}

export default FlightController;