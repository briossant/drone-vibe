// src/main.js
import SimulatorEngine from './SimulatorEngine.js';
import Config from './Config.js';
import AssetLoader from './AssetLoader.js'; // Import the loader instance

// Make main function async
async function main() {
    const osd = document.getElementById('osd'); // Get OSD element for potential error messages

    if (Config.DEBUG_MODE) {
        console.log("App starting...");
        // Keep the initial HTML message ("Initializing...") or clear it
        // osd.innerHTML = '<p>Loading assets...</p>'; // REMOVE/COMMENT OUT
    }

    try {
        // --- Preload Assets ---
        await AssetLoader.preloadAssets();
        // osd.innerHTML = '<p>Initializing simulator...</p>'; // REMOVE/COMMENT OUT

        // --- Initialize Engine ---
        const engine = new SimulatorEngine();
        // UIManager.initialize() will be called inside engine.initialize()
        // and will set the OSD structure correctly.
        await engine.initialize();

        // osd.innerHTML = '<p>Starting simulation...</p>'; // REMOVE/COMMENT OUT

        // --- Start Engine ---
        // The first call to uiManager.update() in the loop will populate the OSD.
        engine.start();

        if (Config.DEBUG_MODE) {
            window.simEngine = engine;
            console.log("SimulatorEngine instance available as 'window.simEngine'");
        }

    } catch (error) {
        console.error("Failed to initialize or start simulator:", error);
        // Display error to user - KEEP THIS PART
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