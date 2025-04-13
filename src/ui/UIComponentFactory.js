// src/UIComponentFactory.js
import ConfigManager from '../config/ConfigManager.js';
import EventBus, { EVENTS } from '../utils/EventBus.js'; // Might need to emit events on change


/** --- NEW: Creates a Reset Button --- */
function createResetButton(buttonText, categoryPathToReset, associatedPanelId = null) {
    const button = document.createElement('button');
    button.textContent = buttonText;
    button.className = 'button-reset-category'; // Add class for styling
    button.dataset.category = categoryPathToReset; // Store category to reset

    button.addEventListener('click', () => {
        if (confirm(`Reset "${categoryPathToReset}" settings to default?`)) {
            ConfigManager.resetToDefaults(categoryPathToReset);
            // Refresh the UI for the specific panel containing this button
            // This is a bit tricky - ideally MenuManager handles refresh.
            // For now, maybe just alert user to reopen menu or manually refresh panel.
            alert(`"${categoryPathToReset}" reset to defaults. Changes applied.`);
            // TODO: Need a better way to refresh the UI panel values after reset.
            // Maybe emit an event?
            // EventBus.emit(EVENTS.SETTINGS_RESET_REQUESTED, { category: categoryPathToReset, panelId: associatedPanelId });
        }
    });

    // Wrap in a div for alignment if needed
    const wrapper = document.createElement('div');
    wrapper.style.textAlign = 'right'; // Align button right
    wrapper.style.marginTop = '20px';
    wrapper.appendChild(button);

    return wrapper; // Return the wrapper div
}

/** Creates a container div for a setting item */
function createSettingItem(labelText) {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'setting-item';

    const label = document.createElement('label');
    label.textContent = labelText;
    itemDiv.appendChild(label);

    const controlContainer = document.createElement('div');
    controlContainer.className = 'control-container';
    itemDiv.appendChild(controlContainer);

    return { itemDiv, controlContainer };
}

/** Creates a slider with label and value display */
function createSlider(labelText, min, max, step, configKeyPath) {
    const { itemDiv, controlContainer } = createSettingItem(labelText);
    const config = ConfigManager.getConfig(); // Get initial config
    const keys = configKeyPath.split('.');
    const initialValue = keys.reduce((obj, key) => (obj && obj[key] !== 'undefined') ? obj[key] : 0, config);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = min;
    slider.max = max;
    slider.step = step;
    slider.value = initialValue;
    controlContainer.appendChild(slider);

    const valueDisplay = document.createElement('span');
    valueDisplay.className = 'value-display';
    // Ensure step calculation for decimals is robust
    const decimals = step.toString().includes('.') ? step.toString().split('.')[1].length : 0;
    valueDisplay.textContent = Number(initialValue).toFixed(decimals);
    controlContainer.appendChild(valueDisplay);

    slider.addEventListener('input', () => {
        const numericValue = parseFloat(slider.value);
        valueDisplay.textContent = numericValue.toFixed(decimals);
        // Update config *in memory* - saving happens on "Apply & Save" click
        ConfigManager.updateUserSetting(configKeyPath, numericValue);
        // OPTIONAL: Emit an event if live updates are needed elsewhere
        // EventBus.emit(EVENTS.SETTING_CHANGED_INTERNALLY, { keyPath: configKeyPath, value: numericValue });
    });

    return itemDiv;
}

/** Creates a number input with label */
function createNumberInput(labelText, min, max, step, configKeyPath) {
    const { itemDiv, controlContainer } = createSettingItem(labelText);
    const config = ConfigManager.getConfig();
    const keys = configKeyPath.split('.');
    const initialValue = keys.reduce((obj, key) => (obj && obj[key] !== 'undefined') ? obj[key] : 0, config);

    const numberInput = document.createElement('input');
    numberInput.type = 'number';
    numberInput.min = min;
    numberInput.max = max;
    numberInput.step = step;
    numberInput.value = initialValue;
    controlContainer.appendChild(numberInput);

    numberInput.addEventListener('change', () => {
        let numericValue = parseFloat(numberInput.value);
        numericValue = Math.max(min, Math.min(max, numericValue)); // Clamp
        numberInput.value = numericValue; // Update field if clamped
        ConfigManager.updateUserSetting(configKeyPath, numericValue);
    });

    return itemDiv;
}

/** Creates a checkbox with label */
function createCheckbox(labelText, configKeyPath) {
    const { itemDiv, controlContainer } = createSettingItem(labelText);
    const config = ConfigManager.getConfig();
    const keys = configKeyPath.split('.');
    const initialValue = keys.reduce((obj, key) => (obj && obj[key] !== 'undefined') ? obj[key] : false, config);

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = initialValue;
    controlContainer.style.justifyContent = 'flex-end';
    controlContainer.appendChild(checkbox);

    checkbox.addEventListener('change', () => {
        ConfigManager.updateUserSetting(configKeyPath, checkbox.checked);
    });

    return itemDiv;
}

/** Creates a simple text display item */
function createDisplayItem(labelText, valueText) {
    const { itemDiv, controlContainer } = createSettingItem(labelText);
    const valueDisplay = document.createElement('span');
    valueDisplay.className = 'value-display';
    valueDisplay.textContent = valueText;
    valueDisplay.style.fontWeight = 'normal';
    controlContainer.appendChild(valueDisplay);
    return itemDiv;
}

// Export the factory functions
export default {
    createSlider,
    createCheckbox,
    createDisplayItem,
    createResetButton,
};