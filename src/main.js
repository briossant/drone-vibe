// src/main.js
import SimulatorEngine from './SimulatorEngine.js';
import Config from './Config.js';
import AssetLoader from './AssetLoader.js'; // Import the loader instance

// Make main function async
async function main() {
    const osd = document.getElementById('osd'); // Get OSD element early

    if (Config.DEBUG_MODE) {
        console.log("App starting...");
        if (osd) osd.innerHTML = '<p>Loading assets...</p>'; // Initial loading message
    }

    try {
        // --- Preload Assets ---
        // AssetLoader is now a singleton instance
        await AssetLoader.preloadAssets();
        if (osd) osd.innerHTML = '<p>Initializing simulator...</p>'; // Update status

        // --- Initialize Engine (potentially async now) ---
        const engine = new SimulatorEngine();
        await engine.initialize(); // Make initialize async if needed (it will be)

        if (osd) osd.innerHTML = '<p>Starting simulation...</p>'; // Update status

        // --- Start Engine ---
        engine.start(); // Start the loop AFTER initialization is fully complete

        if (Config.DEBUG_MODE) {
            window.simEngine = engine;
            console.log("SimulatorEngine instance available as 'window.simEngine'");
        }

    } catch (error) {
        console.error("Failed to initialize or start simulator:", error);
        // Display error to user
        if (osd) {
            osd.innerHTML = `<p style="color: red;">Error: ${error.message}. Check console.</p>`;
        }
    }
}

// Wait for the DOM to be fully loaded before starting
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
} else {
    main(); // DOMContentLoaded has already fired
}