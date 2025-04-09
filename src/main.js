// src/main.js
import SimulatorEngine from './SimulatorEngine.js';
import Config from './Config.js'; // Optional: Use config values directly if needed

function main() {
    if (Config.DEBUG_MODE) {
        console.log("App starting...");
    }

    try {
        const engine = new SimulatorEngine();
        engine.initialize();
        engine.start();

        // Optional: Expose engine to window for debugging
        if (Config.DEBUG_MODE) {
            window.simEngine = engine;
            console.log("SimulatorEngine instance available as 'window.simEngine'");
        }

    } catch (error) {
        console.error("Failed to initialize simulator:", error);
        // Display error to user?
        const osd = document.getElementById('osd');
        if (osd) {
            osd.innerHTML = `<p style="color: red;">Error initializing simulator. Check console.</p>`;
        }
    }
}

// Wait for the DOM to be fully loaded before starting
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
} else {
    main(); // DOMContentLoaded has already fired
}