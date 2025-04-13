# MENU_REWORK_ROADMAP.md

This roadmap outlines the steps to implement the proposed creative and modern menu redesign for the FPV Drone Simulator, focusing on improved aesthetics, user experience, and thematic integration.

**Goal:** Replace the current main menu and in-game pause menu with a more visually appealing, interactive, and practical UI, incorporating elements like blurred backgrounds, sidebar navigation, stylized controls, auto-saving, and sound design.

---

## Phase 1: Planning & Design (Foundation)

*   [ ] **Solidify Creative Direction:**
    *   [ ] Choose the primary visual theme (e.g., HUD/Tech Interface, Blueprint/Schematic, Abstract/Fluid, Glitch Art).
    *   [ ] Define the core color palette (consider primaries, accents, hover/active states).
    *   [ ] Select primary and secondary fonts (ensure readability and thematic fit).
    *   [ ] Define the icon style (outline, filled, custom).
*   [ ] **Create Mockups/Wireframes:**
    *   [ ] Sketch basic layouts for the Main Menu.
    *   [ ] Sketch the Pause Menu layout (Sidebar + Content Area structure).
    *   [ ] Detail the Settings & Controls view layouts within the Pause Menu Content Area (including sub-navigation/tabs).
    *   [ ] Create higher-fidelity visual mockups based on the chosen theme (can be done in image editing software or directly experimented with in HTML/CSS later).
*   [ ] **Plan Sound Design:**
    *   [ ] List specific UI interactions needing sound feedback (hover, click, open/close, save confirmation, etc.).
    *   [ ] Define the *character* of the sounds (e.g., electronic, mechanical, subtle whooshes).

## Phase 2: Asset Creation & Sourcing

*   [ ] **Gather/Create Fonts:** Obtain chosen web font files (ensure proper licensing).
*   [ ] **Gather/Create Icons:** Source or design custom icons matching the theme for sidebar navigation (Resume, Restart, Settings, Controls, Main Menu).
*   [ ] **Gather/Create Backgrounds & Textures:**
    *   [ ] Source/create background images, videos, or procedural patterns for the main menu.
    *   [ ] Source/create subtle textures or effects for menu panels/sidebars (e.g., hex grid, circuitry, noise).
*   [ ] **Gather/Create Sound Files:** Source or create short, high-quality sound effects based on the sound design plan (ensure proper licensing).
*   [ ] **Organize Assets:** Place all new assets into appropriate folders within `public/assets/` (e.g., `public/assets/ui/fonts`, `public/assets/ui/icons`, `public/assets/ui/sounds`).

## Phase 3: HTML Structure Rework (`public/index.html`)

*   [ ] **Backup:** Make a backup of the current `public/index.html`.
*   [ ] **Main Menu (`#main-menu`):**
    *   [ ] Restructure the content to match the new design (e.g., add `.main-menu-background`, revise title placement, use `.main-nav` for buttons).
*   [ ] **In-Game Pause Menu (`#in-sim-menu`):**
    *   [ ] Completely replace the current content with the new Sidebar/Content Area structure.
    *   [ ] Implement the `.menu-backdrop` element (for blur effect).
    *   [ ] Implement the `.menu-sidebar` with navigation buttons (using chosen icons).
    *   [ ] Implement the `.menu-content-area`.
    *   [ ] Implement the different views (`#pause-default-view`, `#pause-settings-view`, `#pause-controls-view`) using `.content-view`.
    *   [ ] Implement the sub-navigation (`.sub-nav`) within Settings/Controls views.
    *   [ ] Add empty container divs (`.panel-content`) for settings categories (e.g., `#graphics-settings-content`, `#physics-settings-content`, `#fc-settings-content`, `#keyboard-settings-display`, `#gamepad-settings-content`).
    *   [ ] Add elements for Gamepad status/diagram (`#gamepad-status`, `#gamepad-visual`).
    *   [ ] Remove the old `#pause-main-options`, `#settings-panel`, `#controls-panel`, and `#apply-save-button`.

## Phase 4: CSS Styling (`public/style.css`)

*   [ ] **Backup:** Make a backup of the current `public/style.css`.
*   [ ] **Global Styles:**
    *   [ ] Integrate new fonts using `@font-face`.
    *   [ ] Define CSS variables for colors, potentially spacing/timing.
    *   [ ] Update base styles for `body`, overlays if needed.
*   [ ] **Main Menu Styling:**
    *   [ ] Style the main overlay (`.main-menu-style`).
    *   [ ] Implement the chosen background effect (image, video, dynamic CSS).
    *   [ ] Style the title (`.main-title`) with chosen font, animations.
    *   [ ] Style the navigation buttons (`.nav-button`) with theme, hover effects, animations.
*   [ ] **In-Game Pause Menu Styling:**
    *   [ ] Style the main overlay (`.in-sim-menu-style`) and backdrop (`.menu-backdrop` with `backdrop-filter`).
    *   [ ] Style the sidebar (`.menu-sidebar`): layout, background, button styles (including icons), hover/active states.
    *   [ ] Style the content area (`.menu-content-area`).
    *   [ ] Style the views (`.content-view`) and implement transitions/animations for switching between them (`active` class).
    *   [ ] Style the sub-navigation (`.sub-nav`) as tabs or a vertical list with clear active states.
    *   [ ] Style the setting panels (`.panel-content`) for consistent padding/margins.
*   [ ] **Control Styling:**
    *   [ ] **Redesign Sliders:** Style `input[type="range"]` track and thumb according to the theme. Style the `.value-display`.
    *   [ ] **Redesign Checkboxes:** Replace with custom toggle switches using CSS (potentially hiding the actual checkbox and styling a label/pseudo-elements).
    *   [ ] Style `.setting-item` for appropriate spacing and alignment within the new layout.
    *   [ ] Add clear hover/focus states to all interactive controls.
*   [ ] **Responsiveness:** Add basic media queries if needed to ensure the menu looks acceptable on slightly different aspect ratios.

## Phase 5: JavaScript Logic Updates

*   [ ] **`MenuManager.js`:**
    *   [ ] Update cached DOM element references (`this.sidebar`, `this.contentArea`, view elements, sub-nav buttons, etc.).
    *   [ ] **Implement View Switching:** Add functions to handle clicks on sidebar buttons (Settings, Controls) and sub-navigation tabs. These functions should toggle the `active` class on the corresponding `.content-view` and `.panel-content` elements and update sub-nav button states.
    *   [ ] **Update `_populateSettingsPanels`:** Ensure UI components are appended to the correct new container elements within the content area views.
    *   [ ] **Update Event Listeners:** Add listeners for new sidebar buttons and sub-nav buttons. Modify listeners for Resume, Restart, Main Menu if their IDs changed. Remove listeners related to Apply/Save.
    *   [ ] **Gamepad Status/Diagram:** Add logic to fetch gamepad status from `InputManager` (if implemented) and update `#gamepad-status` and potentially the `#gamepad-visual`.
    *   [ ] **Reset to Defaults:** Implement logic for potential "Reset to Defaults" buttons, likely by calling a new method on `ConfigManager`.
    *   [ ] **Remove Old Logic:** Remove all code related to showing/hiding `#pause-main-options`, `#settings-panel`, `#controls-panel`, and managing the `#apply-save-button`.
*   [ ] **`ConfigManager.js`:**
    *   [ ] **Implement Auto-Saving:** Modify `updateUserSetting` to call `this.saveConfig()` immediately after updating the `userConfig` object in memory.
    *   [ ] **(Optional) Implement Reset:** Add a `resetToDefaults(category = 'all')` method. This method should clear the relevant keys from `this.userConfig` (or the entire object if `category` is 'all'), then call `_mergeConfigs()` and `saveConfig()`.
*   [ ] **`PausedState.js`:**
    *   [ ] **Simplify `enter`/`exit`:** These should now primarily just show/hide the main `#in-sim-menu` overlay.
    *   [ ] **Update `handleEscape`:** If a settings/controls view is active in `MenuManager`, call a `MenuManager` function to return to the default pause view. Otherwise, trigger the state change to `SimulatingState`.
    *   [ ] **Remove `APPLY_SETTINGS_CLICKED`:** Remove the event listener and handler for this event.
*   [ ] **`UIComponentFactory.js`:**
    *   [ ] **(Optional) Add Save Feedback:** Modify `createSlider`, `createCheckbox` (toggle) etc. When the input's value changes and `ConfigManager.updateUserSetting` is called, trigger a brief visual cue on the `.setting-item` (e.g., add/remove a class like `setting-saved`).
*   [ ] **`InputManager.js`:**
    *   [ ] **(Optional/Advanced) UI Feedback Polling:** If implementing gamepad diagram highlighting, add logic to `pollActiveGamepad` to check specific button states (Arm, Reset) even when the game state is Paused, and potentially emit a specific event (e.g., `UI_GAMEPAD_FEEDBACK`) for `MenuManager` to listen to. *Implement carefully to avoid performance impact.*

## Phase 6: Sound Integration

*   [ ] **Asset Loading:** Add sound files to `AssetLoader.js`'s `preloadAssets` function or load them on demand when menus open.
*   [ ] **Audio Engine:** Choose and integrate an audio solution (Web Audio API directly, or a library like Howler.js). Initialize it appropriately (e.g., in `main.js`).
*   [ ] **Trigger Sounds:** In `MenuManager.js` (or relevant event handlers/component logic), add calls to play the appropriate loaded sound effects upon specific UI interactions (hover, click, switch, save, menu open/close). Handle potential user interaction requirements for starting audio contexts.

## Phase 7: Testing & Refinement

*   [ ] **Functional Testing:**
    *   [ ] Verify all buttons and navigation paths in both menus work correctly.
    *   [ ] Test all settings controls (sliders, toggles) - ensure they update the config and visuals correctly.
    *   [ ] Confirm auto-saving works reliably by changing settings, closing/reopening the menu, and reloading the simulator.
    *   [ ] Test Reset to Defaults functionality (if implemented).
    *   [ ] Test gamepad detection and diagram feedback (if implemented).
*   [ ] **Visual Testing:**
    *   [ ] Check appearance matches mockups across target browsers (Chrome, Firefox).
    *   [ ] Verify all animations and transitions are smooth and work as intended.
    *   [ ] Check for any visual glitches, z-index issues, or layout problems.
*   [ ] **Usability Testing:**
    *   [ ] Is the navigation clear?
    *   [ ] Is it easy to find and change settings?
    *   [ ] Is the auto-save behavior intuitive?
    *   [ ] (Self-test or ask a friend).
*   [ ] **Sound Testing:** Ensure sounds play correctly, are not too loud/annoying, and match the interactions.
*   [ ] **Performance Testing:** Check for any noticeable frame rate drops when menus are open or animating. Optimize CSS and JS animations if necessary.

## Phase 8: Documentation & Future Enhancements

*   [ ] **Update `README.md`:** Briefly describe the new menu system and its features. Update screenshots if necessary.
*   [ ] **Consider Future Steps:**
    *   Gamepad Button Remapping UI.
    *   More advanced animations or visual effects.
    *   UI Theme selection.
    *   Accessibility improvements (keyboard navigation, screen reader support).
