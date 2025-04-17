// Settings Management Module
const SettingsManager = {
    /**
     * Handles changes to general setting inputs/toggles.
     * @param {HTMLElement} target - The input/toggle element that changed.
     * @param {string} settingName - The name of the setting (from data-setting).
     */
    handleSettingChange(target, settingName) {
        let value;
        if (target.type === 'checkbox') {
            value = target.checked;
        } else {
            value = target.value;
        }

        // Update global variable if it exists
        if (window[settingName] !== undefined) {
            window[settingName] = value;
        }

        // Save to storage
        browserSet(settingName, value);

        // Special UI updates for specific settings
        if (settingName === 'enableImageDescriptions') {
            const imageModelContainer = document.getElementById('image-model-container');
            if (imageModelContainer) {
                imageModelContainer.style.display = value ? 'block' : 'none';
            }
            UIUtils.showStatus('Image descriptions ' + (value ? 'enabled' : 'disabled'));
        }
    },

    /**
     * Switches the active tab in the settings panel.
     * @param {string} tabName - The name of the tab to activate (from data-tab).
     */
    switchTab(tabName) {
        const settingsContent = document.querySelector('#settings-container .settings-content');
        if (!settingsContent) return;

        const tabs = settingsContent.querySelectorAll('.tab-content');
        const buttons = settingsContent.querySelectorAll('.tab-navigation .tab-button');

        tabs.forEach(tab => tab.classList.remove('active'));
        buttons.forEach(btn => btn.classList.remove('active'));

        const tabToShow = settingsContent.querySelector(`#${tabName}-tab`);
        const buttonToActivate = settingsContent.querySelector(`.tab-navigation .tab-button[data-tab="${tabName}"]`);

        if (tabToShow) tabToShow.classList.add('active');
        if (buttonToActivate) buttonToActivate.classList.add('active');
    },

    /**
     * Toggles the visibility of advanced options sections.
     * @param {string} contentId - The ID of the content element to toggle.
     */
    toggleAdvancedOptions(contentId) {
        const content = document.getElementById(contentId);
        const toggle = document.querySelector(`[data-toggle="${contentId}"]`);
        if (!content || !toggle) return;

        const icon = toggle.querySelector('.advanced-toggle-icon');
        const isExpanded = content.classList.toggle('expanded');

        if (icon) {
            icon.classList.toggle('expanded', isExpanded);
        }

        // Adjust max-height for smooth animation
        if (isExpanded) {
            content.style.maxHeight = content.scrollHeight + 'px';
        } else {
            content.style.maxHeight = '0';
        }
    },

    /**
     * Resets all configurable settings to their default values.
     */
    resetSettings(noconfirm=false) {
        if (noconfirm || confirm('Are you sure you want to reset all settings to their default values? This will not clear your cached ratings, blacklisted handles, or instruction history.')) {
            // Define defaults (should match config.js ideally)
            const defaults = {
                selectedModel: 'openai/gpt-4.1-nano',
                selectedImageModel: 'openai/gpt-4.1-nano',
                enableImageDescriptions: false,
                enableStreaming: true,
                modelTemperature: 0.5,
                modelTopP: 0.9,
                imageModelTemperature: 0.5,
                imageModelTopP: 0.9,
                maxTokens: 0,
                filterThreshold: 5,
                userDefinedInstructions: 'Rate the tweet on a scale from 1 to 10 based on its clarity, insight, creativity, and overall quality.',
                modelSortOrder: 'throughput-high-to-low'
            };

            // Apply defaults
            for (const key in defaults) {
                if (window[key] !== undefined) {
                    window[key] = defaults[key];
                }
                browserSet(key, defaults[key]);
            }

            this.refreshSettingsUI();
            ModelUI.refreshModelsUI();
            UIUtils.showStatus('Settings reset to defaults');
        }
    },

    /**
     * Refreshes the entire settings UI to reflect current settings.
     */
    refreshSettingsUI() {
        // Update general settings inputs/toggles
        document.querySelectorAll('[data-setting]').forEach(input => {
            const settingName = input.dataset.setting;
            const value = browserGet(settingName, window[settingName]); // Get saved or default value
            if (input.type === 'checkbox') {
                input.checked = value;
                // Trigger change handler for side effects (like hiding/showing image model section)
                this.handleSettingChange(input, settingName);
            } else {
                input.value = value;
            }
        });

        // Update parameter controls (sliders/number inputs)
        document.querySelectorAll('.parameter-row[data-param-name]').forEach(row => {
            const paramName = row.dataset.paramName;
            const slider = row.querySelector('.parameter-slider');
            const valueInput = row.querySelector('.parameter-value');
            const value = browserGet(paramName, window[paramName]);

            if (slider) slider.value = value;
            if (valueInput) valueInput.value = value;
        });

        // Update filter slider
        const filterSlider = document.getElementById('tweet-filter-slider');
        const filterValueDisplay = document.getElementById('tweet-filter-value');
        if (filterSlider && filterValueDisplay) {
            filterSlider.value = currentFilterThreshold.toString();
            filterValueDisplay.textContent = currentFilterThreshold.toString();
            // Initialize the gradient position
            const percentage = (currentFilterThreshold / 10) * 100;
            filterSlider.style.setProperty('--slider-percent', `${percentage}%`);
        }

        // Refresh dynamically populated lists/dropdowns
        UIUtils.refreshHandleList(document.getElementById('handle-list'));
        ModelUI.refreshModelsUI();

        // Set initial state for advanced sections
        document.querySelectorAll('.advanced-content').forEach(content => {
            if (!content.classList.contains('expanded')) {
                content.style.maxHeight = '0';
            }
        });
        document.querySelectorAll('.advanced-toggle-icon.expanded').forEach(icon => {
            if (!icon.closest('.advanced-toggle')?.nextElementSibling?.classList.contains('expanded')) {
                icon.classList.remove('expanded');
            }
        });

        // Refresh instructions history
        InstructionsManager.refreshInstructionsHistory();
    }
}; 