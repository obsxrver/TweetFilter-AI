// ==UserScript==
// @name         TweetFilter AI - UI Module
// @namespace    http://tampermonkey.net/
// @version      Version 1.3r
// @description  User interface functions for TweetFilter AI
// @author       Obsxrver(3than)
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @grant        GM_getResourceText
// @resource     menuHTML https://raw.githubusercontent.com/obsxrver/TweetFilter-AI/dev/src/Menu.html
// @require      https://raw.githubusercontent.com/obsxrver/TweetFilter-AI/dev/src/Menu.html
// @require      https://raw.githubusercontent.com/obsxrver/TweetFilter-AI/dev/src/config.js
// @require      https://raw.githubusercontent.com/obsxrver/TweetFilter-AI/dev/src/api.js
// @require      https://raw.githubusercontent.com/obsxrver/TweetFilter-AI/dev/src/domScraper.js
// @require      https://raw.githubusercontent.com/obsxrver/TweetFilter-AI/dev/src/ratingEngine.js
// @license      MIT
// ==/UserScript==

/**
 * Displays a temporary status message on the screen.
 * @param {string} message - The message to display.
 */
function showStatus(message) {
    let indicator = document.getElementById('status-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'status-indicator';
        document.body.appendChild(indicator);
    }
    indicator.textContent = message;
    indicator.classList.add('active');
    setTimeout(() => { indicator.classList.remove('active'); }, 3000);
}

/**
 * Clears the tweet rating cache (both in memory and persistent storage).
 */
function clearTweetRatings() {
    if (confirm('Are you sure you want to clear all cached tweet ratings?')) {

        Object.keys(tweetIDRatingCache).forEach(key => delete tweetIDRatingCache[key]);
        GM_setValue('tweetRatings', '{}');
        showStatus('All cached ratings cleared!');
        console.log('Cleared all tweet ratings');
        // Re-process visible tweets
        if (observedTargetNode) {
            observedTargetNode.querySelectorAll(TWEET_ARTICLE_SELECTOR).forEach(tweet => {
                tweet.dataset.sloppinessScore = '';
                processedTweets.delete(getTweetID(tweet));
                scheduleTweetProcessing(tweet);
            });
        }
    }
}

/**
 * Adds the main settings UI with tabs for settings and custom instructions.
 */
function addSettingsUI() {
    if (document.getElementById('settings-container')) return;

    // Create toggle button
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'settings-toggle';
    toggleBtn.className = 'toggle-button';
    toggleBtn.innerHTML = '<span style="font-size: 14px;">⚙️</span> Settings';
    toggleBtn.onclick = () => {
        const container = document.getElementById('settings-container');
        if (container.classList.contains('hidden')) {
            container.classList.remove('hidden');
            toggleBtn.innerHTML = '<span style="font-size: 14px;">✕</span> Close';
        } else {
            container.classList.add('hidden');
            toggleBtn.innerHTML = '<span style="font-size: 14px;">⚙️</span> Settings';
        }
    };
    document.body.appendChild(toggleBtn);

    // Create the main container
    const container = document.createElement('div');
    container.id = 'settings-container';
    container.classList.add('hidden');

    // Create sticky header
    const header = document.createElement('div');
    header.className = 'settings-header';

    const title = document.createElement('div');
    title.className = 'settings-title';
    title.textContent = 'Twitter De-Sloppifier';
    header.appendChild(title);

    // Close button in header
    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-button';
    closeBtn.innerHTML = '×';
    closeBtn.onclick = () => {
        container.classList.add('hidden');
        toggleBtn.innerHTML = '<span style="font-size: 14px;">⚙️</span> Settings';
    };
    header.appendChild(closeBtn);

    container.appendChild(header);

    // Content area
    const content = document.createElement('div');
    content.className = 'settings-content';
    container.appendChild(content);

    // Tab Navigation
    const tabNav = document.createElement('div');
    tabNav.className = 'tab-navigation';

    // General Tab Button
    const generalTabBtn = document.createElement('button');
    generalTabBtn.className = 'tab-button active';
    generalTabBtn.textContent = 'General';
    generalTabBtn.onclick = () => {
        switchTab('general');
    };
    tabNav.appendChild(generalTabBtn);

    // Models Tab Button
    const modelsTabBtn = document.createElement('button');
    modelsTabBtn.className = 'tab-button';
    modelsTabBtn.textContent = 'Models';
    modelsTabBtn.onclick = () => {
        switchTab('models');
    };
    tabNav.appendChild(modelsTabBtn);

    // Custom Instructions Tab Button
    const instructionsTabBtn = document.createElement('button');
    instructionsTabBtn.className = 'tab-button';
    instructionsTabBtn.textContent = 'Instructions';
    instructionsTabBtn.onclick = () => {
        switchTab('instructions');
    };
    tabNav.appendChild(instructionsTabBtn);

    content.appendChild(tabNav);

    // General Tab Content
    const generalTab = document.createElement('div');
    generalTab.id = 'general-tab';
    generalTab.className = 'tab-content active';
    buildGeneralTabContent(generalTab);
    content.appendChild(generalTab);

    // Models Tab Content
    const modelsTab = document.createElement('div');
    modelsTab.id = 'models-tab';
    modelsTab.className = 'tab-content';
    buildModelsTabContent(modelsTab);
    content.appendChild(modelsTab);

    // Custom Instructions Tab Content
    const instructionsTab = document.createElement('div');
    instructionsTab.id = 'instructions-tab';
    instructionsTab.className = 'tab-content';
    buildInstructionsTabContent(instructionsTab);
    content.appendChild(instructionsTab);

    document.body.appendChild(container);

    // Helper function to switch between tabs
    function switchTab(tabName) {
        const tabs = content.querySelectorAll('.tab-content');
        const buttons = tabNav.querySelectorAll('.tab-button');

        // Hide all tabs
        tabs.forEach(tab => tab.classList.remove('active'));
        buttons.forEach(btn => btn.classList.remove('active'));

        // Show selected tab
        if (tabName === 'general') {
            generalTab.classList.add('active');
            generalTabBtn.classList.add('active');
        } else if (tabName === 'models') {
            modelsTab.classList.add('active');
            modelsTabBtn.classList.add('active');
        } else if (tabName === 'instructions') {
            instructionsTab.classList.add('active');
            instructionsTabBtn.classList.add('active');
        }
    }

    // Initialize models data
    fetchAvailableModels();
}

/**
 * Exports all settings and cache to a JSON file for backup
 */
function exportSettings() {
    try {
        const data = {
            version: '1.1',
            date: new Date().toISOString(),
            settings: {
                apiKey: GM_getValue('openrouter-api-key', ''),
                selectedModel: selectedModel,
                selectedImageModel: selectedImageModel,
                enableImageDescriptions: enableImageDescriptions,
                modelTemperature: modelTemperature,
                modelTopP: modelTopP,
                imageModelTemperature: imageModelTemperature,
                imageModelTopP: imageModelTopP,
                maxTokens: maxTokens,
                filterThreshold: currentFilterThreshold,
                userDefinedInstructions: USER_DEFINED_INSTRUCTIONS
            },
            blacklistedHandles: blacklistedHandles,
            tweetRatings: tweetIDRatingCache
        };

        // Create a download link
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `twitter-desloppifier-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();

        showStatus('Settings exported successfully!');
    } catch (error) {
        console.error('Error exporting settings:', error);
        showStatus('Error exporting settings: ' + error.message);
    }
}

/**
 * Imports settings and cache from a JSON file
 */
function importSettings() {
    try {
        // Create file input
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';

        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);

                    // Validate the file format
                    if (!data.version || !data.settings) {
                        throw new Error('Invalid settings file format');
                    }

                    // Import the settings
                    if (data.settings.apiKey) {
                        GM_setValue('openrouter-api-key', data.settings.apiKey);
                        document.getElementById('openrouter-api-key').value = data.settings.apiKey;
                    }

                    if (data.settings.selectedModel) {
                        selectedModel = data.settings.selectedModel;
                        GM_setValue('selectedModel', selectedModel);
                    }

                    if (data.settings.selectedImageModel) {
                        selectedImageModel = data.settings.selectedImageModel;
                        GM_setValue('selectedImageModel', selectedImageModel);
                    }

                    if (data.settings.enableImageDescriptions !== undefined) {
                        enableImageDescriptions = data.settings.enableImageDescriptions;
                        GM_setValue('enableImageDescriptions', enableImageDescriptions);
                    }

                    if (data.settings.modelTemperature !== undefined) {
                        modelTemperature = data.settings.modelTemperature;
                        GM_setValue('modelTemperature', modelTemperature);
                    }

                    if (data.settings.modelTopP !== undefined) {
                        modelTopP = data.settings.modelTopP;
                        GM_setValue('modelTopP', modelTopP);
                    }

                    if (data.settings.imageModelTemperature !== undefined) {
                        imageModelTemperature = data.settings.imageModelTemperature;
                        GM_setValue('imageModelTemperature', imageModelTemperature);
                    }

                    if (data.settings.imageModelTopP !== undefined) {
                        imageModelTopP = data.settings.imageModelTopP;
                        GM_setValue('imageModelTopP', imageModelTopP);
                    }

                    if (data.settings.maxTokens !== undefined) {
                        maxTokens = data.settings.maxTokens;
                        GM_setValue('maxTokens', maxTokens);
                    }

                    if (data.settings.filterThreshold !== undefined) {
                        currentFilterThreshold = data.settings.filterThreshold;
                        GM_setValue('filterThreshold', currentFilterThreshold);
                    }

                    if (data.settings.userDefinedInstructions !== undefined) {
                        USER_DEFINED_INSTRUCTIONS = data.settings.userDefinedInstructions;
                        GM_setValue('userDefinedInstructions', USER_DEFINED_INSTRUCTIONS);
                    }

                    // Import blacklisted handles
                    if (data.blacklistedHandles && Array.isArray(data.blacklistedHandles)) {
                        blacklistedHandles = data.blacklistedHandles;
                        GM_setValue('blacklistedHandles', blacklistedHandles.join('\n'));
                    }

                    // Import tweet ratings
                    if (data.tweetRatings && typeof data.tweetRatings === 'object') {
                        Object.assign(tweetIDRatingCache, data.tweetRatings);
                        saveTweetRatings();
                    }

                    // Refresh UI to reflect the imported settings
                    refreshSettingsUI();

                    showStatus('Settings imported successfully!');
                } catch (error) {
                    console.error('Error parsing settings file:', error);
                    showStatus('Error importing settings: ' + error.message);
                }
            };

            reader.readAsText(file);
        };

        input.click();
    } catch (error) {
        console.error('Error importing settings:', error);
        showStatus('Error importing settings: ' + error.message);
    }
}

/**
 * Refreshes the settings UI to reflect current settings
 */
function refreshSettingsUI() {
    // Update model selectors and dropdowns
    refreshModelsUI();

    // Update API key input
    const apiKeyInput = document.getElementById('openrouter-api-key');
    if (apiKeyInput) {
        apiKeyInput.value = GM_getValue('openrouter-api-key', '');
    }

    // Update filter slider
    const slider = document.getElementById('tweet-filter-slider');
    const valueDisplay = document.getElementById('tweet-filter-value');
    if (slider && valueDisplay) {
        slider.value = currentFilterThreshold.toString();
        valueDisplay.textContent = currentFilterThreshold.toString();
    }

    // Update image toggle
    const imageToggleInputs = document.querySelectorAll('input[type="checkbox"]');
    if (imageToggleInputs.length > 0) {
        imageToggleInputs.forEach(input => {
            if (input.parentElement.parentElement.querySelector('.toggle-label')?.textContent === 'Enable Image Descriptions') {
                input.checked = enableImageDescriptions;

                // Show/hide image model options
                const imageModelContainer = document.getElementById('image-model-container');
                if (imageModelContainer) {
                    imageModelContainer.style.display = enableImageDescriptions ? 'block' : 'none';
                }
            }
        });
    }

    // Refresh handle list
    const handleList = document.getElementById('handle-list');
    if (handleList) {
        refreshHandleList(handleList);
    }

    // Update instructions textarea
    const instructionsTextarea = document.getElementById('user-instructions');
    if (instructionsTextarea) {
        instructionsTextarea.value = USER_DEFINED_INSTRUCTIONS;
    }

    // Update cache statistics
    const cachedRatingsCount = document.getElementById('cached-ratings-count');
    const whitelistedHandlesCount = document.getElementById('whitelisted-handles-count');

    if (cachedRatingsCount) {
        cachedRatingsCount.textContent = Object.keys(tweetIDRatingCache).length;
    }

    if (whitelistedHandlesCount) {
        whitelistedHandlesCount.textContent = blacklistedHandles.length;
    }

}

/**
 * Creates a parameter control with a slider and value display.
 * @param {HTMLElement} parent - Parent element to attach the control to
 * @param {string} label - Label for the parameter
 * @param {string} paramName - Name of the parameter in global scope
 * @param {string} description - Description of the parameter
 * @param {number} value - Current value
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @param {number} step - Step size
 * @param {Function} [onChange] - Optional callback when value changes
 */
function createParameterControl(parent, label, paramName, description, value, min, max, step, onChange) {
    const row = document.createElement('div');
    row.className = 'parameter-row';

    const labelEl = document.createElement('div');
    labelEl.className = 'parameter-label';
    labelEl.textContent = label;
    labelEl.title = description;
    row.appendChild(labelEl);

    const control = document.createElement('div');
    control.className = 'parameter-control';

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'parameter-slider';
    slider.min = min;
    slider.max = max;
    slider.step = step;
    slider.value = value;

    const valueDisplay = document.createElement('input');
    valueDisplay.type = 'number';
    valueDisplay.className = 'parameter-value';
    valueDisplay.value = value;
    valueDisplay.min = min;
    valueDisplay.max = max;
    valueDisplay.step = step;
    valueDisplay.style.width = '60px';

    slider.addEventListener('input', () => {
        const newValue = parseFloat(slider.value);
        valueDisplay.value = newValue;
        window[paramName] = newValue; // Update the global variable
        GM_setValue(paramName, newValue); // Save to storage

        // Call onChange callback if provided
        if (typeof onChange === 'function') {
            onChange(newValue);
        }
    });

    valueDisplay.addEventListener('input', () => {
        const newValue = parseFloat(valueDisplay.value);
        if (!isNaN(newValue)) {
            slider.value = newValue;
            window[paramName] = newValue; // Update the global variable
            GM_setValue(paramName, newValue); // Save to storage

            // Call onChange callback if provided
            if (typeof onChange === 'function') {
                onChange(newValue);
            }
        }
    });

    control.appendChild(slider);
    control.appendChild(valueDisplay);
    row.appendChild(control);

    parent.appendChild(row);
}

/**
 * Builds the content for the Custom Instructions tab.
 * @param {HTMLElement} tabElement - The tab element to fill with content.
 */
function buildInstructionsTabContent(tabElement) {
    // Custom Rating Instructions Section
    const instructionsLabel = document.createElement('div');
    instructionsLabel.className = 'section-title';
    instructionsLabel.textContent = 'Custom Tweet Rating Instructions';
    tabElement.appendChild(instructionsLabel);

    const instructionsDesc = document.createElement('div');
    instructionsDesc.className = 'section-description';
    instructionsDesc.textContent = 'Add custom instructions for how the model should score tweets:';
    tabElement.appendChild(instructionsDesc);

    // Textarea for instructions
    const instructionsTextarea = document.createElement('textarea');
    instructionsTextarea.id = 'user-instructions';
    instructionsTextarea.placeholder = 'Examples:\n- Give high scores to tweets about technology\n- Penalize clickbait-style tweets\n- Rate educational content higher';
    instructionsTextarea.value = USER_DEFINED_INSTRUCTIONS;
    tabElement.appendChild(instructionsTextarea);

    // Save Instructions Button
    const saveInstructionsBtn = document.createElement('button');
    saveInstructionsBtn.className = 'settings-button';
    saveInstructionsBtn.textContent = 'Save Instructions';
    saveInstructionsBtn.addEventListener('click', () => {
        USER_DEFINED_INSTRUCTIONS = instructionsTextarea.value;
        GM_setValue('userDefinedInstructions', USER_DEFINED_INSTRUCTIONS);
        showStatus('Scoring instructions saved! New tweets will use these instructions.');

        // Clear cache if user wants to re-rate existing tweets with new instructions
        if (confirm('Do you want to clear the rating cache to apply these instructions to all tweets?')) {
            clearTweetRatings();
        }
    });
    tabElement.appendChild(saveInstructionsBtn);

    // Auto-Rate Section
    const autoRateLabel = document.createElement('div');
    autoRateLabel.className = 'section-title';
    autoRateLabel.style.marginTop = '20px';
    autoRateLabel.textContent = 'Auto-Rate Handles as 10/10';
    tabElement.appendChild(autoRateLabel);

    const autoRateDesc = document.createElement('div');
    autoRateDesc.className = 'section-description';
    autoRateDesc.textContent = 'Add Twitter handles to automatically rate as 10/10:';
    tabElement.appendChild(autoRateDesc);

    // Handle input row
    const handleInputRow = document.createElement('div');
    handleInputRow.style.display = 'flex';
    handleInputRow.style.alignItems = 'center';
    handleInputRow.style.gap = '5px';

    const handleInput = document.createElement('input');
    handleInput.id = 'handle-input';
    handleInput.type = 'text';
    handleInput.placeholder = 'Twitter handle (without @)';
    handleInputRow.appendChild(handleInput);

    const addHandleBtn = document.createElement('button');
    addHandleBtn.className = 'add-handle-btn';
    addHandleBtn.textContent = 'Add';
    addHandleBtn.addEventListener('click', () => {
        addHandleToBlacklist(handleInput.value);
        handleInput.value = '';
    });
    handleInputRow.appendChild(addHandleBtn);

    tabElement.appendChild(handleInputRow);

    // Handle list
    const handleList = document.createElement('div');
    handleList.className = 'handle-list';
    handleList.id = 'handle-list';

    // Populate the list with existing handles
    refreshHandleList(handleList);

    tabElement.appendChild(handleList);
}

/**
 * Adds a handle to the blacklist and refreshes the UI.
 * @param {string} handle - The Twitter handle to add.
 */
function addHandleToBlacklist(handle) {
    // Clean up handle
    handle = handle.trim();

    // Remove @ if present
    if (handle.startsWith('@')) {
        handle = handle.substring(1);
    }

    // Check if empty or already in list
    if (handle === '' || blacklistedHandles.includes(handle)) {
        return;
    }

    // Add to blacklist
    blacklistedHandles.push(handle);

    // Save to storage
    GM_setValue('blacklistedHandles', blacklistedHandles.join('\n'));

    // Refresh list
    refreshHandleList(document.getElementById('handle-list'));

    // Show confirmation
    showStatus(`Added @${handle} to auto-rate list`);
}

/**
 * Removes a handle from the blacklist and refreshes the UI.
 * @param {string} handle - The Twitter handle to remove.
 */
function removeHandleFromBlacklist(handle) {
    // Find and remove
    const index = blacklistedHandles.indexOf(handle);
    if (index > -1) {
        blacklistedHandles.splice(index, 1);

        // Save to storage
        GM_setValue('blacklistedHandles', blacklistedHandles.join('\n'));

        // Refresh list
        refreshHandleList(document.getElementById('handle-list'));

        // Show confirmation
        showStatus(`Removed @${handle} from auto-rate list`);
    }
}

/**
 * Refreshes the handle list UI.
 * @param {HTMLElement} listElement - The list element to refresh.
 */
function refreshHandleList(listElement) {
    if (!listElement) return;

    // Clear existing list
    listElement.innerHTML = '';

    // Add each handle to the list
    blacklistedHandles.forEach(handle => {
        const item = document.createElement('div');
        item.className = 'handle-item';

        const handleText = document.createElement('div');
        handleText.className = 'handle-text';
        handleText.textContent = '@' + handle;
        item.appendChild(handleText);

        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-handle';
        removeBtn.textContent = '×';
        removeBtn.title = 'Remove from list';
        removeBtn.addEventListener('click', () => {
            removeHandleFromBlacklist(handle);
        });
        item.appendChild(removeBtn);

        listElement.appendChild(item);
    });

    // Show a message if the list is empty
    if (blacklistedHandles.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.style.padding = '8px';
        emptyMsg.style.opacity = '0.7';
        emptyMsg.style.fontStyle = 'italic';
        emptyMsg.textContent = 'No handles added yet';
        listElement.appendChild(emptyMsg);
    }
}

/**
 * Builds the content for the General tab.
 * @param {HTMLElement} tabElement - The tab element to fill with content.
 */
function buildGeneralTabContent(tabElement) {
    // API Key section
    const apiKeyLabel = document.createElement('div');
    apiKeyLabel.className = 'section-title';
    apiKeyLabel.innerHTML = '<span style="font-size: 14px;">🔑</span> OpenRouter API Key';
    tabElement.appendChild(apiKeyLabel);

    const apiKeyInput = document.createElement('input');
    apiKeyInput.type = 'password';
    apiKeyInput.id = 'openrouter-api-key';
    apiKeyInput.placeholder = 'Enter your OpenRouter API key';
    apiKeyInput.value = GM_getValue('openrouter-api-key', '');
    tabElement.appendChild(apiKeyInput);

    // API key save button
    const saveApiKeyBtn = document.createElement('button');
    saveApiKeyBtn.className = 'settings-button';
    saveApiKeyBtn.textContent = 'Save API Key';
    saveApiKeyBtn.addEventListener('click', saveApiKey);
    tabElement.appendChild(saveApiKeyBtn);

    // Cache Statistics Section
    const cacheLabel = document.createElement('div');
    cacheLabel.className = 'section-title';
    cacheLabel.innerHTML = '<span style="font-size: 14px;">🗄️</span> Cache Statistics';
    cacheLabel.style.marginTop = '20px';
    tabElement.appendChild(cacheLabel);

    // Stats display
    const statsContainer = document.createElement('div');
    statsContainer.className = 'stats-container';

    // Ratings stats row
    const ratingsRow = document.createElement('div');
    ratingsRow.className = 'stats-row';

    const ratingsLabel = document.createElement('div');
    ratingsLabel.className = 'stats-label';
    ratingsLabel.textContent = 'Cached Tweet Ratings';
    ratingsRow.appendChild(ratingsLabel);

    const ratingsValue = document.createElement('div');
    ratingsValue.className = 'stats-value';
    ratingsValue.id = 'cached-ratings-count';
    ratingsValue.textContent = Object.keys(tweetIDRatingCache).length;
    ratingsRow.appendChild(ratingsValue);

    statsContainer.appendChild(ratingsRow);

    // Handles stats row
    const handlesRow = document.createElement('div');
    handlesRow.className = 'stats-row';

    const handlesLabel = document.createElement('div');
    handlesLabel.className = 'stats-label';
    handlesLabel.textContent = 'Whitelisted Handles';
    handlesRow.appendChild(handlesLabel);

    const handlesValue = document.createElement('div');
    handlesValue.className = 'stats-value';
    handlesValue.id = 'whitelisted-handles-count';
    handlesValue.textContent = blacklistedHandles.length;
    handlesRow.appendChild(handlesValue);

    statsContainer.appendChild(handlesRow);

    tabElement.appendChild(statsContainer);

    // Clear Cache Button
    const clearButton = document.createElement('button');
    clearButton.className = 'settings-button danger';
    clearButton.textContent = 'Clear Rating Cache';
    clearButton.addEventListener('click', () => {
        clearTweetRatings();
        updateCacheStats();
    });
    tabElement.appendChild(clearButton);

    // Backup & Restore Section
    const backupLabel = document.createElement('div');
    backupLabel.className = 'section-title';
    backupLabel.innerHTML = '<span style="font-size: 14px;">💾</span> Backup & Restore';
    backupLabel.style.marginTop = '20px';
    tabElement.appendChild(backupLabel);

    const backupDesc = document.createElement('div');
    backupDesc.className = 'section-description';
    backupDesc.textContent = 'Export your settings and cached ratings to a file for backup, or import previously saved settings.';
    tabElement.appendChild(backupDesc);

    // Buttons row
    const buttonRow = document.createElement('div');
    buttonRow.className = 'button-row';

    // Export button
    const exportButton = document.createElement('button');
    exportButton.className = 'settings-button secondary';
    exportButton.textContent = 'Export Settings';
    exportButton.addEventListener('click', exportSettings);
    buttonRow.appendChild(exportButton);

    // Import button
    const importButton = document.createElement('button');
    importButton.className = 'settings-button secondary';
    importButton.textContent = 'Import Settings';
    importButton.addEventListener('click', importSettings);
    buttonRow.appendChild(importButton);

    tabElement.appendChild(buttonRow);

    // Reset to defaults button
    const resetButton = document.createElement('button');
    resetButton.className = 'settings-button danger';
    resetButton.style.marginTop = '15px';
    resetButton.textContent = 'Reset to Defaults';
    resetButton.addEventListener('click', resetSettings);
    tabElement.appendChild(resetButton);

    // Version info
    const versionInfo = document.createElement('div');
    versionInfo.style.marginTop = '20px';
    versionInfo.style.fontSize = '11px';
    versionInfo.style.opacity = '0.6';
    versionInfo.style.textAlign = 'center';
    versionInfo.textContent = 'Twitter De-Sloppifier v1.2';
    tabElement.appendChild(versionInfo);

    // Helper function to update cache statistics
    function updateCacheStats() {
        document.getElementById('cached-ratings-count').textContent = Object.keys(tweetIDRatingCache).length;
        document.getElementById('whitelisted-handles-count').textContent = blacklistedHandles.length;
    }

    // Save API key function
    function saveApiKey() {
        const apiKey = apiKeyInput.value.trim();
        if (apiKey) {
            GM_setValue('openrouter-api-key', apiKey);
            showStatus('API key saved successfully!');

            // Refresh model list with new API key
            fetchAvailableModels();
        } else {
            showStatus('Please enter a valid API key');
        }
    }
}

/**
 * Resets all settings to defaults.
 */
function resetSettings() {
    if (confirm('Are you sure you want to reset all settings to their default values? This will not clear your cached ratings.')) {
        // Reset global variables to defaults
        selectedModel = 'google/gemini-flash-1.5-8b';
        selectedImageModel = 'google/gemini-flash-1.5-8b';
        enableImageDescriptions = false;
        modelTemperature = 0.5;
        modelTopP = 0.9;
        imageModelTemperature = 0.5;
        imageModelTopP = 0.9;
        maxTokens = 0;
        currentFilterThreshold = 1;
        USER_DEFINED_INSTRUCTIONS = 'Read the following tweet carefully and analyze its clarity, insightfulness, creativity, and overall impact.';

        // Save reset values to storage
        GM_setValue('selectedModel', selectedModel);
        GM_setValue('selectedImageModel', selectedImageModel);
        GM_setValue('enableImageDescriptions', enableImageDescriptions);
        GM_setValue('modelTemperature', modelTemperature);
        GM_setValue('modelTopP', modelTopP);
        GM_setValue('imageModelTemperature', imageModelTemperature);
        GM_setValue('imageModelTopP', imageModelTopP);
        GM_setValue('maxTokens', maxTokens);
        GM_setValue('filterThreshold', currentFilterThreshold);
        GM_setValue('userDefinedInstructions', USER_DEFINED_INSTRUCTIONS);

        // Refresh UI to reflect default values
        refreshSettingsUI();

        showStatus('Settings reset to defaults');
    }
}

/**
 * Builds the content for the Models tab.
 * @param {HTMLElement} tabElement - The tab element to fill with content.
 */
function buildModelsTabContent(tabElement) {
    // Tweet Rating Model Section
    const modelLabel = document.createElement('div');
    modelLabel.className = 'section-title';
    modelLabel.innerHTML = '<span style="font-size: 14px;">🧠</span> Tweet Rating Model';
    tabElement.appendChild(modelLabel);

    const modelDesc = document.createElement('div');
    modelDesc.className = 'section-description';
    modelDesc.textContent = 'Hint: If you want to rate tweets with images, you need to select an image model.';
    tabElement.appendChild(modelDesc);

    // Add sort order selector
    const sortContainer = document.createElement('div');
    sortContainer.className = 'sort-container';

    const sortLabel = document.createElement('label');
    sortLabel.textContent = 'Sort models by: ';
    sortContainer.appendChild(sortLabel);

    const sortSelect = document.createElement('select');
    sortSelect.id = 'model-sort-order';

    const sortOptions = [
        { value: 'price-low-to-high', label: 'Price (Low to High)' },
        { value: 'price-high-to-low', label: 'Price (High to Low)' },
        { value: 'throughput-high-to-low', label: 'Throughput (High to Low)' },
        { value: 'throughput-low-to-high', label: 'Throughput (Low to High)' },
        { value: 'latency-low-to-high', label: 'Latency (Low to High)' },
        { value: 'latency-high-to-low', label: 'Latency (High to Low)' }
    ];

    sortOptions.forEach(option => {
        const optElement = document.createElement('option');
        optElement.value = option.value;
        optElement.textContent = option.label;
        if (option.value === GM_getValue('modelSortOrder', 'throughput-high-to-low')) {
            optElement.selected = true;
        }
        sortSelect.appendChild(optElement);
    });

    sortSelect.addEventListener('change', function () {
        GM_setValue('modelSortOrder', this.value);
        fetchAvailableModels(); // Refresh models with new sort order
    });

    sortContainer.appendChild(sortSelect);
    tabElement.appendChild(sortContainer);

    // Create custom model dropdown with built-in search
    const modelSelectContainer = document.createElement('div');
    modelSelectContainer.className = 'select-container';
    modelSelectContainer.id = 'model-select-container';

    // Create the custom select component
    createCustomSelect(
        modelSelectContainer,
        'model-selector',
        availableModels.map(model => ({
            value: model.slug || model.id,
            label: formatModelLabel(model)
        })),
        selectedModel,
        (newValue) => {
            selectedModel = newValue;
            GM_setValue('selectedModel', selectedModel);

            showStatus('Rating model updated');
        },
        'Search rating models...'
    );

    tabElement.appendChild(modelSelectContainer);

    // Advanced options for tweet rating model
    const ratingAdvancedOptions = document.createElement('div');
    ratingAdvancedOptions.className = 'advanced-options';

    const ratingAdvancedToggle = document.createElement('div');
    ratingAdvancedToggle.className = 'advanced-toggle';

    const ratingAdvancedTitle = document.createElement('div');
    ratingAdvancedTitle.className = 'advanced-toggle-title';
    ratingAdvancedTitle.textContent = 'Advanced Options';
    ratingAdvancedToggle.appendChild(ratingAdvancedTitle);

    const ratingAdvancedIcon = document.createElement('div');
    ratingAdvancedIcon.className = 'advanced-toggle-icon';
    ratingAdvancedIcon.innerHTML = '▼';
    ratingAdvancedToggle.appendChild(ratingAdvancedIcon);

    ratingAdvancedOptions.appendChild(ratingAdvancedToggle);

    const ratingAdvancedContent = document.createElement('div');
    ratingAdvancedContent.className = 'advanced-content';

    // Temperature parameter
    createParameterControl(
        ratingAdvancedContent,
        'Temperature',
        'modelTemperature',
        'How random the model responses should be (0.0-1.0)',
        modelTemperature,
        0, 1, 0.1,
        (newValue) => {
            modelTemperature = newValue;
            GM_setValue('modelTemperature', modelTemperature);
        }
    );

    // Top-p parameter
    createParameterControl(
        ratingAdvancedContent,
        'Top-p',
        'modelTopP',
        'Nucleus sampling parameter (0.0-1.0)',
        modelTopP,
        0, 1, 0.1,
        (newValue) => {
            modelTopP = newValue;
            GM_setValue('modelTopP', modelTopP);
        }
    );

    // Max tokens parameter
    createParameterControl(
        ratingAdvancedContent,
        'Max Tokens',
        'maxTokens',
        'Maximum number of tokens for the response (0 means no limit)',
        maxTokens,
        0, 2000, 100,
        (newValue) => {
            maxTokens = newValue;
            GM_setValue('maxTokens', maxTokens);
        }
    );

    ratingAdvancedOptions.appendChild(ratingAdvancedContent);

    // Toggle the advanced options when clicked
    ratingAdvancedToggle.addEventListener('click', () => {
        ratingAdvancedContent.classList.toggle('expanded');
        ratingAdvancedIcon.classList.toggle('expanded');
    });

    tabElement.appendChild(ratingAdvancedOptions);

    // Image Model Section
    const imageModelLabel = document.createElement('div');
    imageModelLabel.className = 'section-title';
    imageModelLabel.innerHTML = '<span style="font-size: 14px;">🖼️</span> Image Processing Model';
    imageModelLabel.style.marginTop = '25px';
    tabElement.appendChild(imageModelLabel);

    // Add explanation about image model usage
    const imageExplanation = document.createElement('div');
    imageExplanation.className = 'section-description';
    imageExplanation.innerHTML = 'This model generates <strong>text descriptions</strong> of images, which are then sent to the rating model above. ' +
        'If you\'ve selected an image-capable model (🖼️) as your main rating model above, you can disable this to process images directly.';
    tabElement.appendChild(imageExplanation);

    // Add toggle for enabling/disabling image descriptions
    const imageToggleRow = document.createElement('div');
    imageToggleRow.className = 'toggle-row';

    const imageToggleLabel = document.createElement('div');
    imageToggleLabel.className = 'toggle-label';
    imageToggleLabel.textContent = 'Enable Image Descriptions';
    imageToggleRow.appendChild(imageToggleLabel);

    const imageToggleSwitch = document.createElement('label');
    imageToggleSwitch.className = 'toggle-switch';

    const imageToggleInput = document.createElement('input');
    imageToggleInput.type = 'checkbox';
    imageToggleInput.checked = enableImageDescriptions;
    imageToggleInput.addEventListener('change', function () {
        enableImageDescriptions = this.checked;
        GM_setValue('enableImageDescriptions', enableImageDescriptions);

        // Show/hide image model options based on toggle
        document.getElementById('image-model-container').style.display = this.checked ? 'block' : 'none';
        showStatus('Image descriptions ' + (this.checked ? 'enabled' : 'disabled'));
    });

    const imageToggleSlider = document.createElement('span');
    imageToggleSlider.className = 'toggle-slider';

    imageToggleSwitch.appendChild(imageToggleInput);
    imageToggleSwitch.appendChild(imageToggleSlider);
    imageToggleRow.appendChild(imageToggleSwitch);

    tabElement.appendChild(imageToggleRow);

    // Image model selection container
    const imageModelContainer = document.createElement('div');
    imageModelContainer.id = 'image-model-container';
    imageModelContainer.style.display = enableImageDescriptions ? 'block' : 'none';

    // Add info about which models can process images
    const imageModelDesc = document.createElement('div');
    imageModelDesc.className = 'section-description';
    imageModelDesc.textContent = 'Select a model with vision capabilities to describe images in tweets.';
    imageModelContainer.appendChild(imageModelDesc);

    // Create custom image model dropdown with built-in search
    const imageModelSelectContainer = document.createElement('div');
    imageModelSelectContainer.className = 'select-container';
    imageModelSelectContainer.id = 'image-model-select-container';

    // Filter for vision models only
    const visionModels = availableModels.filter(model => {
        return model.input_modalities?.includes('image') ||
            model.architecture?.input_modalities?.includes('image') ||
            model.architecture?.modality?.includes('image');
    });

    // Create the custom select component for image models
    createCustomSelect(
        imageModelSelectContainer,
        'image-model-selector',
        visionModels.map(model => ({
            value: model.slug || model.id,
            label: formatModelLabel(model)
        })),
        selectedImageModel,
        (newValue) => {
            selectedImageModel = newValue;
            GM_setValue('selectedImageModel', selectedImageModel);

            showStatus('Image model updated');
        },
        'Search vision models...'
    );

    imageModelContainer.appendChild(imageModelSelectContainer);

    // Advanced options for image model
    const imageAdvancedOptions = document.createElement('div');
    imageAdvancedOptions.className = 'advanced-options';

    const imageAdvancedToggle = document.createElement('div');
    imageAdvancedToggle.className = 'advanced-toggle';

    const imageAdvancedTitle = document.createElement('div');
    imageAdvancedTitle.className = 'advanced-toggle-title';
    imageAdvancedTitle.textContent = 'Advanced Options';
    imageAdvancedToggle.appendChild(imageAdvancedTitle);

    const imageAdvancedIcon = document.createElement('div');
    imageAdvancedIcon.className = 'advanced-toggle-icon';
    imageAdvancedIcon.innerHTML = '▼';
    imageAdvancedToggle.appendChild(imageAdvancedIcon);

    imageAdvancedOptions.appendChild(imageAdvancedToggle);

    const imageAdvancedContent = document.createElement('div');
    imageAdvancedContent.className = 'advanced-content';

    // Image model temperature parameter
    createParameterControl(
        imageAdvancedContent,
        'Temperature',
        'imageModelTemperature',
        'Randomness for image descriptions (0.0-1.0)',
        imageModelTemperature,
        0, 1, 0.1,
        (newValue) => {
            imageModelTemperature = newValue;
            GM_setValue('imageModelTemperature', imageModelTemperature);
        }
    );

    // Image model top-p parameter
    createParameterControl(
        imageAdvancedContent,
        'Top-p',
        'imageModelTopP',
        'Nucleus sampling for image model (0.0-1.0)',
        imageModelTopP,
        0, 1, 0.1,
        (newValue) => {
            imageModelTopP = newValue;
            GM_setValue('imageModelTopP', imageModelTopP);
        }
    );

    imageAdvancedOptions.appendChild(imageAdvancedContent);

    // Toggle the advanced options when clicked
    imageAdvancedToggle.addEventListener('click', () => {
        imageAdvancedContent.classList.toggle('expanded');
        imageAdvancedIcon.classList.toggle('expanded');
    });

    imageModelContainer.appendChild(imageAdvancedOptions);

    tabElement.appendChild(imageModelContainer);
}

/**
 * Creates a custom select dropdown with search functionality
 * @param {HTMLElement} container - Container to append the custom select to
 * @param {string} id - ID for the select element
 * @param {Array<{value: string, label: string}>} options - Options for the dropdown
 * @param {string} selectedValue - Initially selected value
 * @param {Function} onChange - Callback when selection changes
 * @param {string} searchPlaceholder - Placeholder for the search input
 */
function createCustomSelect(container, id, options, selectedValue, onChange, searchPlaceholder) {
    // Create the custom select div
    const customSelect = document.createElement('div');
    customSelect.className = 'custom-select';
    customSelect.id = id;

    // Create the selected item display
    const selectSelected = document.createElement('div');
    selectSelected.className = 'select-selected';

    // Find the selected option's label
    const selectedOption = options.find(opt => opt.value === selectedValue);
    selectSelected.textContent = selectedOption ? selectedOption.label : 'Select an option';

    customSelect.appendChild(selectSelected);

    // Create the options container
    const selectItems = document.createElement('div');
    selectItems.className = 'select-items';

    // Add search field at top
    const searchField = document.createElement('div');
    searchField.className = 'search-field';

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'search-input';
    searchInput.placeholder = searchPlaceholder || 'Search...';

    searchField.appendChild(searchInput);
    selectItems.appendChild(searchField);

    // Function to update the options based on search
    function updateOptions(searchText = '') {
        // Remove all existing options except search field
        while (selectItems.childNodes.length > 1) {
            selectItems.removeChild(selectItems.lastChild);
        }

        // Filter options based on search text
        const filteredOptions = options.filter(opt =>
            opt.label.toLowerCase().includes(searchText.toLowerCase())
        );

        // Add filtered options to the dropdown
        filteredOptions.forEach(option => {
            const optionDiv = document.createElement('div');
            optionDiv.textContent = option.label;
            optionDiv.dataset.value = option.value;

            if (option.value === selectedValue) {
                optionDiv.className = 'same-as-selected';
            }

            optionDiv.addEventListener('click', function (e) {
                // Prevent event from propagating to document click handler
                e.stopPropagation();

                // Update the selected value
                const newValue = this.dataset.value;
                selectedValue = newValue;

                // Update the selected display
                selectSelected.textContent = this.textContent;

                // Update the class for all options
                const optionDivs = selectItems.querySelectorAll('div:not(.search-field)');
                optionDivs.forEach(div => {
                    div.classList.remove('same-as-selected');
                });
                this.classList.add('same-as-selected');

                // Hide the dropdown
                selectItems.style.display = 'none';
                selectSelected.classList.remove('select-arrow-active');

                // Call the onChange callback
                onChange(newValue);
            });

            selectItems.appendChild(optionDiv);
        });

        // Show a message if no results
        if (filteredOptions.length === 0) {
            const noResults = document.createElement('div');
            noResults.textContent = 'No matches found';
            noResults.style.opacity = '0.7';
            noResults.style.fontStyle = 'italic';
            noResults.style.padding = '10px';
            noResults.style.textAlign = 'center';
            selectItems.appendChild(noResults);
        }
    }

    // Initialize options
    updateOptions();

    // Add search input event listener
    searchInput.addEventListener('input', function () {
        updateOptions(this.value);
    });

    // Stop search input click from closing dropdown
    searchInput.addEventListener('click', function (e) {
        e.stopPropagation();
    });

    // Toggle dropdown on click
    selectSelected.addEventListener('click', function (e) {
        e.stopPropagation();

        // Close all other select boxes
        closeAllSelect(this);

        // Toggle this dropdown
        const isCurrentlyOpen = selectItems.style.display === 'block';
        selectItems.style.display = isCurrentlyOpen ? 'none' : 'block';

        // Toggle the arrow class based on open/closed state
        if (isCurrentlyOpen) {
            this.classList.remove('select-arrow-active');
        } else {
            this.classList.add('select-arrow-active');
            // Focus search input when opened
            searchInput.focus();
        }
    });

    // Stop dropdown clicks from propagating to document
    selectItems.addEventListener('click', function (e) {
        e.stopPropagation();
    });

    // Function to close all select boxes except the current one
    function closeAllSelect(elmnt) {
        const allSelectItems = document.getElementsByClassName('select-items');
        const allSelectSelected = document.getElementsByClassName('select-selected');

        for (let i = 0; i < allSelectItems.length; i++) {
            // Skip the current dropdown
            if (allSelectItems[i].parentNode === elmnt.parentNode) {
                continue;
            }

            // Close other dropdowns
            allSelectItems[i].style.display = 'none';
        }

        // Remove active class from other selects
        for (let i = 0; i < allSelectSelected.length; i++) {
            if (allSelectSelected[i] !== elmnt) {
                allSelectSelected[i].classList.remove('select-arrow-active');
            }
        }
    }

    // Close all dropdowns when clicking elsewhere
    document.addEventListener('click', function () {
        const allSelectItems = document.getElementsByClassName('select-items');
        const allSelectSelected = document.getElementsByClassName('select-selected');

        // Close all dropdowns
        for (let i = 0; i < allSelectItems.length; i++) {
            allSelectItems[i].style.display = 'none';
        }

        // Remove active class from all selects
        for (let i = 0; i < allSelectSelected.length; i++) {
            allSelectSelected[i].classList.remove('select-arrow-active');
        }
    });

    customSelect.appendChild(selectItems);
    container.appendChild(customSelect);
}

/**
 * Formats a model object as a display label
 * @param {Object} model - Model object with properties
 * @returns {string} Formatted label
 */
function formatModelLabel(model) {
    let label = model.slug || model.id || model.name || '';

    // Add pricing information if available
    if (model.endpoint && model.endpoint.pricing) {
        // Show prompt price
        if (model.endpoint.pricing.prompt !== undefined) {
            const promptPrice = parseFloat(model.endpoint.pricing.prompt);
            if (!isNaN(promptPrice)) {
                label += ` - $${promptPrice.toFixed(7)}/in`;
            }
        }

        // Show completion price if different from prompt price
        if (model.endpoint.pricing.completion !== undefined &&
            model.endpoint.pricing.completion !== model.endpoint.pricing.prompt) {
            const completionPrice = parseFloat(model.endpoint.pricing.completion);
            if (!isNaN(completionPrice)) {
                label += ` $${completionPrice.toFixed(7)}/out`;
            }
        }
    } else if (model.pricing?.prompt) {
        // Fallback to old pricing format
        const promptPrice = parseFloat(model.pricing.prompt);
        if (!isNaN(promptPrice)) {
            label += ` - $${promptPrice.toFixed(7)}/token`;
        }
    }

    // Add vision icon if model supports images
    if (model.input_modalities?.includes('image') ||
        model.architecture?.input_modalities?.includes('image') ||
        model.architecture?.modality?.includes('image')) {
        label = '🖼️ ' + label;
    }

    return label;
}

/**
 * Updates any UI elements that depend on the model list
 */
function refreshModelsUI() {
    // Update model selectors if they exist in the DOM
    const modelSelectContainer = document.getElementById('model-select-container');
    if (modelSelectContainer) {
        // Clear current contents
        modelSelectContainer.innerHTML = '';

        // Recreate the custom select
        createCustomSelect(
            modelSelectContainer,
            'model-selector',
            availableModels.map(model => ({
                value: model.slug || model.permaslug,
                label: formatModelLabel(model)
            })),
            selectedModel,
            (newValue) => {
                selectedModel = newValue;
                GM_setValue('selectedModel', selectedModel);
                showStatus('Rating model updated');
            },
            'Search rating models...'
        );
    }

    // Update image model selector if it exists
    const imageModelSelectContainer = document.getElementById('image-model-select-container');
    if (imageModelSelectContainer) {
        // Filter for vision models only
        const visionModels = availableModels.filter(model => {
            return model.input_modalities?.includes('image') ||
                model.architecture?.input_modalities?.includes('image') ||
                model.architecture?.modality?.includes('image');
        });

        // Clear current contents
        imageModelSelectContainer.innerHTML = '';

        // Recreate the custom select for image models
        createCustomSelect(
            imageModelSelectContainer,
            'image-model-selector',
            visionModels.map(model => ({
                value: model.slug || model.permaslug,
                label: formatModelLabel(model)
            })),
            selectedImageModel,
            (newValue) => {
                selectedImageModel = newValue;
                GM_setValue('selectedImageModel', selectedImageModel);
                showStatus('Image model updated');
            },
            'Search vision models...'
        );
    }
}

/**
 * Updates or creates the rating indicator element within a tweet article.
 * Displays different content based on the rating status:
 * - "pending" : shows ⏳
 * - "error"   : shows ⚠️
 * - "rated"   : shows the numeric score
 * When you hover over the rating box, it shows a description of the rating.
 *
 * @param {Element} tweetArticle - The tweet element.
 * @param {number|null} score - The numeric rating (if available).
 * @param {string} description - The description of the rating (if available).
 * @param {string} status - The rating status ('pending', 'rated', or 'error').
 */
function setScoreIndicator(tweetArticle, score, status, description = "") {
    // 1. Create (or get) the score indicator inside tweetArticle
    let indicator = tweetArticle.querySelector('.score-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.className = 'score-indicator';
        tweetArticle.style.position = 'relative';
        tweetArticle.appendChild(indicator);
    }

    // Remove any previous status classes
    indicator.classList.remove('cached-rating', 'blacklisted-rating', 'pending-rating', 'error-rating');

    // Set the indicator text and add status classes
    if (status === 'pending') {
        indicator.classList.add('pending-rating');
        indicator.textContent = '⏳';
    } else if (status === 'error') {
        indicator.classList.add('error-rating');
        indicator.textContent = '⚠️';
    } else { // rated
        if (tweetArticle.dataset.blacklisted === 'true') {
            indicator.classList.add('blacklisted-rating');
        } else if (tweetArticle.dataset.cachedRating === 'true') {
            indicator.classList.add('cached-rating');
        }
        indicator.textContent = score;
    }

    // 2. Create (or get) a globally positioned description box
    // We'll use a unique ID per indicator (assign one if needed)
    if (!indicator.dataset.id) {
        indicator.dataset.id = Math.random().toString(36).substr(2, 9);
    }
    const descId = 'desc-' + indicator.dataset.id;
    let descBox = document.getElementById(descId);
    if (!descBox) {
        descBox = document.createElement('div');
        descBox.className = 'score-description';
        descBox.id = descId;
        document.body.appendChild(descBox);
    }

    // Format the description with better styling if it exists
    if (description) {
        // Add formatting to the SCORE line if present
        description = description.replace(/\{score:\s*(\d+)\}/g, '<span style="display:inline-block;background-color:#1d9bf0;color:white;padding:3px 10px;border-radius:9999px;margin:8px 0;font-weight:bold;">SCORE: $1</span>');

        // Add some spacing between paragraphs
        description = description.replace(/\n\n/g, '</p><p style="margin-top: 16px;">');
        description = description.replace(/\n/g, '<br>');

        // Wrap in paragraphs
        description = `<p>${description}</p>`;

        descBox.innerHTML = description;
    } else {
        descBox.textContent = '';
    }

    // If there's no description, hide the box and exit
    if (!description) {
        descBox.style.display = 'none';
        return;
    }

    // 3. Set up hover events on the indicator to show/hide the description box.
    // (Remove any previously attached listeners to avoid duplicates.)
    indicator.onmouseenter = () => {
        // Get the position of the indicator in viewport coordinates
        const rect = indicator.getBoundingClientRect();

        // Calculate available space to the right and below
        const availableWidth = window.innerWidth - rect.right - 20; // 20px margin
        const availableHeight = window.innerHeight - rect.top - 20;

        // Set the description box's position
        descBox.style.position = 'fixed'; // Use fixed instead of absolute for better positioning

        // Position horizontally - prefer right side if space allows
        if (availableWidth >= 300) {
            // Position to the right of the indicator
            descBox.style.left = (rect.right + 10) + 'px';
            descBox.style.right = 'auto';
        } else {
            // Position to the left of the indicator
            descBox.style.right = (window.innerWidth - rect.left + 10) + 'px';
            descBox.style.left = 'auto';
        }

        // Position vertically - aim to center, but adjust if needed
        const descHeight = Math.min(window.innerHeight * 0.6, 400); // Estimated max height
        let topPos = rect.top + (rect.height / 2) - (descHeight / 2);

        // Ensure box stays in viewport
        if (topPos < 10) topPos = 10;
        if (topPos + descHeight > window.innerHeight - 10) {
            topPos = window.innerHeight - descHeight - 10;
        }

        descBox.style.top = topPos + 'px';
        descBox.style.maxHeight = '60vh'; // Set max height for scrolling

        // Show the box
        descBox.style.display = 'block';
    };

    indicator.onmouseleave = (e) => {
        // Don't hide immediately - check if cursor moved to the description box
        const rect = descBox.getBoundingClientRect();
        const mouseX = e.clientX;
        const mouseY = e.clientY;

        // If mouse is moving toward the description box, don't hide
        if (mouseX >= rect.left - 20 && mouseX <= rect.right + 20 &&
            mouseY >= rect.top - 20 && mouseY <= rect.bottom + 20) {
            // Mouse is heading toward the description box, don't hide
            // Instead, set up mouse events on the description box
            descBox.onmouseenter = () => {
                descBox.style.display = 'block';
            };
            descBox.onmouseleave = () => {
                descBox.style.display = 'none';
            };
            return;
        }

        // Otherwise hide
        setTimeout(() => {
            descBox.style.display = 'none';
        }, 100);
    };
}

/**
 * Cleans up all score description elements from the DOM
 */
function cleanupDescriptionElements() {
    // Remove all score description elements
    const descElements = document.querySelectorAll('.score-description');
    descElements.forEach(el => el.remove());
    //console.log(`Cleaned up ${descElements.length} description elements`);
}

function initialiseUI() {
    // Load HTML from resource
    const menuHTML = GM_getResourceText('menuHTML');
    if (!menuHTML) {
        console.error('Failed to load Menu.html resource!');
        showStatus('Error: Could not load UI components.');
        return;
    }

    // Create a temporary container to parse the HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = menuHTML;

    // Find and extract the main UI elements
    const filterToggle = tempDiv.querySelector('#filter-toggle');
    const settingsToggle = tempDiv.querySelector('#settings-toggle');
    const tweetFilterContainer = tempDiv.querySelector('#tweet-filter-container');
    const settingsContainer = tempDiv.querySelector('#settings-container');
    const statusIndicator = tempDiv.querySelector('#status-indicator');
    const stylesheet = tempDiv.querySelector('style'); // Get the style tag

    // Append elements to the body
    if (stylesheet) {
         // Inject styles using GM_addStyle for better isolation and management
         GM_addStyle(stylesheet.textContent);
         console.log('Injected styles from Menu.html');
    } else {
        console.warn('No <style> tag found in Menu.html');
    }

    if (filterToggle) document.body.appendChild(filterToggle);
    if (settingsToggle) document.body.appendChild(settingsToggle);
    if (tweetFilterContainer) document.body.appendChild(tweetFilterContainer);
    if (settingsContainer) document.body.appendChild(settingsContainer);
    if (statusIndicator) document.body.appendChild(statusIndicator);

    // Clean up temp container
    tempDiv.remove();

    // Wire up event listeners to the injected elements
    wireUIEvents();

    // Set initial UI state from saved settings
    refreshSettingsUI(); // Call this *after* wiring basic events but potentially before fetch completes?
                         // refreshSettingsUI updates values, refreshModelsUI populates dropdowns (needs fetch result)

    console.log('TweetFilter UI Initialised from HTML resource.');
}

/**
 * Wire up event listeners to the UI elements loaded from HTML.
 */
function wireUIEvents() {
    console.log('Wiring UI events...');

    // --- Filter Slider ---
    const filterContainer = document.getElementById('tweet-filter-container');
    const filterToggle = document.getElementById('filter-toggle');
    const filterSlider = document.getElementById('tweet-filter-slider');
    const filterValueDisplay = document.getElementById('tweet-filter-value');
    const filterCloseBtn = filterContainer?.querySelector('.close-button');

    if (filterToggle) {
        filterToggle.onclick = () => {
            if (filterContainer) {
                filterContainer.classList.remove('hidden');
                filterToggle.style.display = 'none';
            }
        };
    }

    if (filterCloseBtn) {
        filterCloseBtn.onclick = () => {
            filterContainer.classList.add('hidden');
            if (filterToggle) {
                filterToggle.style.display = 'block';
            }
        };
    }

    if (filterSlider && filterValueDisplay) {
        filterSlider.addEventListener('input', (event) => {
            currentFilterThreshold = parseInt(event.target.value, 10);
            filterValueDisplay.textContent = currentFilterThreshold.toString();
            GM_setValue('filterThreshold', currentFilterThreshold);
            applyFilteringToAll();
        });
        // Set initial value
        filterSlider.value = currentFilterThreshold.toString();
        filterValueDisplay.textContent = currentFilterThreshold.toString();
    }

    // --- Settings Panel ---
    const settingsContainer = document.getElementById('settings-container');
    const settingsToggle = document.getElementById('settings-toggle');
    const settingsCloseBtn = settingsContainer?.querySelector('.settings-header .close-button');
    const tabNav = settingsContainer?.querySelector('.tab-navigation');
    const content = settingsContainer?.querySelector('.settings-content');

    if (settingsToggle) {
        settingsToggle.onclick = () => {
            if (settingsContainer.classList.contains('hidden')) {
                settingsContainer.classList.remove('hidden');
                settingsToggle.innerHTML = '<span style="font-size: 14px;">✕</span> Close';
            } else {
                settingsContainer.classList.add('hidden');
                settingsToggle.innerHTML = '<span style="font-size: 14px;">⚙️</span> Settings';
            }
        };
    }

    if (settingsCloseBtn) {
        settingsCloseBtn.onclick = () => {
            settingsContainer.classList.add('hidden');
            if (settingsToggle) {
                settingsToggle.innerHTML = '<span style="font-size: 14px;">⚙️</span> Settings';
            }
        };
    }

    // --- Tab Navigation ---
    const tabs = content?.querySelectorAll('.tab-content');
    const buttons = tabNav?.querySelectorAll('.tab-button');
    const generalTabBtn = tabNav?.querySelector('button:nth-child(1)');
    const modelsTabBtn = tabNav?.querySelector('button:nth-child(2)');
    const instructionsTabBtn = tabNav?.querySelector('button:nth-child(3)');

    function switchTab(tabName) {
        const generalTab = document.getElementById('general-tab');
        const modelsTab = document.getElementById('models-tab');
        const instructionsTab = document.getElementById('instructions-tab');

        tabs?.forEach(tab => tab.classList.remove('active'));
        buttons?.forEach(btn => btn.classList.remove('active'));

        if (tabName === 'general' && generalTab && generalTabBtn) {
            generalTab.classList.add('active');
            generalTabBtn.classList.add('active');
        } else if (tabName === 'models' && modelsTab && modelsTabBtn) {
            modelsTab.classList.add('active');
            modelsTabBtn.classList.add('active');
        } else if (tabName === 'instructions' && instructionsTab && instructionsTabBtn) {
            instructionsTab.classList.add('active');
            instructionsTabBtn.classList.add('active');
        }
    }

    generalTabBtn?.addEventListener('click', () => switchTab('general'));
    modelsTabBtn?.addEventListener('click', () => switchTab('models'));
    instructionsTabBtn?.addEventListener('click', () => switchTab('instructions'));

    // --- General Tab ---
    const apiKeyInput = document.getElementById('openrouter-api-key');
    const saveApiKeyBtn = document.querySelector('#general-tab .settings-button[data-id="save-apikey"]'); // More specific selector
    const clearCacheBtn = document.getElementById('clear-cache'); // Assuming you add this ID to the button in HTML
    const exportBtn = document.querySelector('#general-tab .button-row button:nth-child(1)');
    const importBtn = document.querySelector('#general-tab .button-row button:nth-child(2)');
    const resetBtn = document.querySelector('#general-tab .settings-button.danger:not(#clear-cache)'); // Assuming only one other danger button

    if (saveApiKeyBtn) {
         saveApiKeyBtn.addEventListener('click', () => {
             const apiKey = apiKeyInput.value.trim();
            if (apiKey) {
                GM_setValue('openrouter-api-key', apiKey);
                showStatus('API key saved successfully!');
                fetchAvailableModels(); // Refresh model list
            } else {
                showStatus('Please enter a valid API key');
            }
         });
     } else {
         console.warn("Save API Key button not found");
     }

    if (clearCacheBtn) {
        clearCacheBtn.addEventListener('click', () => {
            clearTweetRatings();
             // Update stats display manually if needed or rely on refreshSettingsUI
            const cachedCount = document.getElementById('cached-ratings-count');
            const whitelistedCount = document.getElementById('whitelisted-handles-count');
            if (cachedCount) cachedCount.textContent = Object.keys(tweetIDRatingCache).length;
            if (whitelistedCount) whitelistedCount.textContent = blacklistedHandles.length;
        });
    } else {
        console.warn("Clear Cache button not found (expected ID 'clear-cache')");
    }

    exportBtn?.addEventListener('click', exportSettings);
    importBtn?.addEventListener('click', importSettings);
    resetBtn?.addEventListener('click', resetSettings);

    // --- Models Tab ---
    const modelSortSelect = document.getElementById('model-sort-order');
    const modelSelectContainer = document.getElementById('model-select-container');
    const imageModelSelectContainer = document.getElementById('image-model-select-container');
    const imageToggleInput = document.querySelector('#models-tab .toggle-switch input[type="checkbox"]');
    const imageModelOptionsContainer = document.getElementById('image-model-container');

    if (modelSortSelect) {
        modelSortSelect.value = GM_getValue('modelSortOrder', 'throughput-high-to-low');
        modelSortSelect.addEventListener('change', function () {
            GM_setValue('modelSortOrder', this.value);
            fetchAvailableModels(); // Refresh models with new sort order
        });
    }

     // Wire parameter controls (sliders/inputs) - Find them by structure/order/unique parent
    function wireParameterControl(tabId, paramName, initialValue, min, max, step, onChange) {
        const paramRow = document.querySelector(`#${tabId}-tab .parameter-label[title*='${paramName}']`)?.closest('.parameter-row');
        if (!paramRow) {
             console.warn(`Parameter row for ${paramName} in ${tabId} not found`);
             return;
        }
        const slider = paramRow.querySelector('.parameter-slider');
        const valueInput = paramRow.querySelector('.parameter-value');

        if (!slider || !valueInput) {
            console.warn(`Slider or value input for ${paramName} in ${tabId} not found`);
            return;
        }

        // Set initial values and attributes
        slider.min = min;
        slider.max = max;
        slider.step = step;
        slider.value = initialValue;
        valueInput.min = min;
        valueInput.max = max;
        valueInput.step = step;
        valueInput.value = initialValue;

        slider.addEventListener('input', () => {
            const newValue = parseFloat(slider.value);
            valueInput.value = newValue;
            window[paramName] = newValue;
            GM_setValue(paramName, newValue);
            if (typeof onChange === 'function') onChange(newValue);
        });

        valueInput.addEventListener('input', () => {
            const newValue = parseFloat(valueInput.value);
            if (!isNaN(newValue)) {
                 const clampedValue = Math.max(min, Math.min(max, newValue)); // Clamp value
                 if (clampedValue !== newValue) {
                     valueInput.value = clampedValue; // Update input if clamped
                 }
                 slider.value = clampedValue;
                 window[paramName] = clampedValue;
                 GM_setValue(paramName, clampedValue);
                 if (typeof onChange === 'function') onChange(clampedValue);
             }
        });
     }

    // Wire rating model params
    wireParameterControl('models', 'modelTemperature', modelTemperature, 0, 1, 0.1);
    wireParameterControl('models', 'modelTopP', modelTopP, 0, 1, 0.1);
    wireParameterControl('models', 'maxTokens', maxTokens, 0, 2000, 100);

    // Wire image model params
    wireParameterControl('models', 'imageModelTemperature', imageModelTemperature, 0, 1, 0.1);
    wireParameterControl('models', 'imageModelTopP', imageModelTopP, 0, 1, 0.1);

    // Wire advanced option toggles
    const advancedToggles = document.querySelectorAll('.advanced-toggle');
    advancedToggles.forEach(toggle => {
        const content = toggle.nextElementSibling; // Assumes content is immediate sibling
        const icon = toggle.querySelector('.advanced-toggle-icon');
        if (content && icon) {
            // Check initial expanded state from HTML if needed, e.g. content.classList.contains('expanded')
            toggle.addEventListener('click', () => {
                content.classList.toggle('expanded');
                icon.classList.toggle('expanded');
                // Adjust max-height dynamically based on content or use CSS transition
                if (content.classList.contains('expanded')) {
                    content.style.maxHeight = content.scrollHeight + 'px';
                } else {
                    content.style.maxHeight = '0';
                }
            });
             // Set initial max-height if expanded
             if (content.classList.contains('expanded')) {
                 content.style.maxHeight = content.scrollHeight + 'px';
             }
         }
     });

    if (imageToggleInput) {
        imageToggleInput.checked = enableImageDescriptions;
        imageToggleInput.addEventListener('change', function () {
            enableImageDescriptions = this.checked;
            GM_setValue('enableImageDescriptions', enableImageDescriptions);
            if (imageModelOptionsContainer) {
                imageModelOptionsContainer.style.display = this.checked ? 'block' : 'none';
            }
            showStatus('Image descriptions ' + (this.checked ? 'enabled' : 'disabled'));
        });
        // Set initial display state
        if (imageModelOptionsContainer) {
            imageModelOptionsContainer.style.display = enableImageDescriptions ? 'block' : 'none';
        }
    }

    // Populate model dropdowns (needs availableModels to be fetched first)
    // We'll call refreshModelsUI later after fetch completes.

    // --- Instructions Tab ---
    const instructionsTextarea = document.getElementById('user-instructions');
    const saveInstructionsBtn = document.querySelector('#instructions-tab .settings-button');
    const handleInput = document.getElementById('handle-input');
    const addHandleBtn = document.querySelector('#instructions-tab .add-handle-btn');
    const handleList = document.getElementById('handle-list');

    if (instructionsTextarea) {
        instructionsTextarea.value = USER_DEFINED_INSTRUCTIONS;
    }

    if (saveInstructionsBtn) {
        saveInstructionsBtn.addEventListener('click', () => {
            USER_DEFINED_INSTRUCTIONS = instructionsTextarea.value;
            GM_setValue('userDefinedInstructions', USER_DEFINED_INSTRUCTIONS);
            showStatus('Scoring instructions saved! New tweets will use these instructions.');
            if (confirm('Do you want to clear the rating cache to apply these instructions to all tweets?')) {
                clearTweetRatings();
            }
        });
    }

    if (addHandleBtn && handleInput) {
        addHandleBtn.addEventListener('click', () => {
            addHandleToBlacklist(handleInput.value);
            handleInput.value = '';
        });
    }

    // Handle list item removal (Event Delegation)
    if (handleList) {
        handleList.addEventListener('click', (event) => {
            if (event.target.classList.contains('remove-handle')) {
                 // Find the parent handle item and get the handle text
                 const handleItem = event.target.closest('.handle-item');
                 const handleTextElement = handleItem?.querySelector('.handle-text');
                 if (handleTextElement) {
                     const handle = handleTextElement.textContent.substring(1); // Remove '@'
                     removeHandleFromBlacklist(handle);
                 }
            }
        });
        // Initial population
        refreshHandleList(handleList);
    }

    // --- Initial data fetch ---
    fetchAvailableModels(); // Fetch models which will trigger refreshModelsUI

    console.log('UI events wired.');
}
