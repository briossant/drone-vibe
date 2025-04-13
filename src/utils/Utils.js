// src/Utils.js

/**
 * Clamps a value between a minimum and maximum value.
 * @param {number} value The value to clamp.
 * @param {number} min The minimum allowed value.
 * @param {number} max The maximum allowed value.
 * @returns {number} The clamped value.
 */
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

/**
 * Linearly interpolates between two values.
 * @param {number} a Start value.
 * @param {number} b End value.
 * @param {number} t Interpolation factor (0.0 to 1.0).
 * @returns {number} The interpolated value.
 */
function lerp(a, b, t) {
    return a + (b - a) * t;
}

// Add other utility functions as needed

export { clamp, lerp }; // Export named functions