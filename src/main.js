// src/main.js
import SimulatorEngine from './SimulatorEngine.js';
import Config from './Config.js';
import AssetLoader from './AssetLoader.js';

// --- Application States ---
const APP_STATE = {
    MENU: 'MENU',
    LOADING: 'LOADING',
    SIMULATING: 'SIMULATING',
    PAUSED: 'PAUSED', // Might be useful later for in-sim menu
};

let currentAppState = APP_STATE.MENU;
let simulatorEngine = null; // Hold the engine instance

// --- DOM Elements ---
const mainMenuElement = document.getElementById('main-menu');
const loadingIndicatorElement = document.getElementById('loading-indicator');
const flyButton = document.getElementById('fly-button');
const settingsButton = document.getElementById('settings-button'); // Get refs if needed later
const controlsButton = document.getElementById('controls-button'); // Get refs if needed later
const canvasElement = document.getElementById('webgl-canvas');
const osdElement = document.getElementById('osd');

// --- Helper Functions ---
function showElement(element) {
    element?.classList.remove('hidden');
}

function hideElement(element) {
    element?.classList.add('hidden');
}

// --- Core Simulation Start Logic ---
async function startSimulation() {
    if (currentAppState !== APP_STATE.MENU) return; // Prevent starting multiple times

    currentAppState = APP_STATE.LOADING;
    hideElement(mainMenuElement);
    showElement(loadingIndicatorElement);
    // Clear any previous OSD messages potentially left from errors
    if (osdElement) osdElement.innerHTML = '';
    hideElement(osdElement); // Ensure OSD is hidden during loading

    if (Config.DEBUG_MODE) {
        console.log("App state changed to LOADING");
        console.log("Loading assets...");
    }

    try {
        // --- Preload Assets ---
        await AssetLoader.preloadAssets();
        if (Config.DEBUG_MODE) console.log("Assets loaded.");

        loadingIndicatorElement.querySelector('p').textContent = 'Initializing simulator...'; // Update loading text

        // --- Initialize Engine ---
        // Create instance ONLY when starting simulation
        simulatorEngine = new SimulatorEngine();
        await simulatorEngine.initialize(); // This initializes UI, Physics, Renderer, World, Drone etc.

        if (Config.DEBUG_MODE) console.log("Simulator engine initialized.");

        // --- Transition to Simulation ---
        hideElement(loadingIndicatorElement);
        showElement(canvasElement); // Show the canvas
        showElement(osdElement);    // Show the OSD (UIManager will populate it)

        simulatorEngine.start(); // Start the simulation loop
        currentAppState = APP_STATE.SIMULATING;

        if (Config.DEBUG_MODE) {
            console.log("App state changed to SIMULATING");
            window.simEngine = simulatorEngine; // Expose engine for debugging
            console.log("SimulatorEngine instance available as 'window.simEngine'");
        }

    } catch (error) {
        console.error("Failed to initialize or start simulator:", error);
        // Display error to user in the loading indicator area or a dedicated error element
        hideElement(loadingIndicatorElement); // Hide loading text
        showElement(mainMenuElement); // Show menu again potentially
        // Or display error more prominently:
        if(mainMenuElement) { // Add error message to main menu if possible
            const errorP = document.createElement('p');
            errorP.style.color = 'red';
            errorP.style.marginTop = '20px';
            errorP.textContent = `Error: ${error.message}. Check console.`;
            mainMenuElement.querySelector('.menu-content').appendChild(errorP);
        }
        currentAppState = APP_STATE.MENU; // Revert state
    }
}

// --- Initial Setup Function ---
function initializeMainMenu() {
    if (Config.DEBUG_MODE) {
        console.log("App starting... Initial state:", currentAppState);
    }

    // Ensure correct elements are visible/hidden initially
    showElement(mainMenuElement);
    hideElement(loadingIndicatorElement);
    hideElement(canvasElement);
    hideElement(osdElement);

    // --- Add Event Listeners ---
    flyButton?.addEventListener('click', startSimulation);

    settingsButton?.addEventListener('click', () => {
        console.log("Settings button clicked (Not implemented yet)");
        // Later, this might open the in-sim settings directly if the sim is running,
        // or maybe show a static settings view from the main menu.
    });

    controlsButton?.addEventListener('click', () => {
        console.log("Controls button clicked (Not implemented yet)");
        // Later, show controls info or link to in-sim configuration.
    });
}

// --- Main Execution ---
// Wait for the DOM to be fully loaded before setting up the menu
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeMainMenu);
} else {
    initializeMainMenu(); // DOMContentLoaded has already fired
}