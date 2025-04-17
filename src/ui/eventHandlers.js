// Event Handlers Module
const EventHandlers = {
    /**
     * Initializes all UI event listeners using event delegation.
     * @param {HTMLElement} uiContainer - The root container element for the UI.
     */
    initializeEventListeners(uiContainer) {
        if (!uiContainer) {
            console.error('UI Container not found for event listeners.');
            return;
        }

        console.log('Wiring UI events...');

        const settingsContainer = uiContainer.querySelector('#settings-container');
        const filterContainer = uiContainer.querySelector('#tweet-filter-container');
        const settingsToggleBtn = uiContainer.querySelector('#settings-toggle');
        const filterToggleBtn = uiContainer.querySelector('#filter-toggle');

        // --- Delegated Event Listener for Clicks ---
        uiContainer.addEventListener('click', (event) => {
            const target = event.target;
            const action = target.dataset.action;
            const setting = target.dataset.setting;
            const paramName = target.closest('.parameter-row')?.dataset.paramName;
            const tab = target.dataset.tab;
            const toggleTargetId = target.closest('[data-toggle]')?.dataset.toggle;

            // Button Actions
            if (action) {
                switch (action) {
                    case 'close-filter':
                        UIUtils.toggleElementVisibility(filterContainer, filterToggleBtn, 'Filter Slider', 'Filter Slider');
                        break;
                    case 'close-settings':
                        UIUtils.toggleElementVisibility(settingsContainer, settingsToggleBtn, '<span style="font-size: 14px;">✕</span> Close', '<span style="font-size: 14px;">⚙️</span> Settings');
                        break;
                    case 'save-api-key':
                        this.saveApiKey();
                        break;
                    case 'clear-cache':
                        this.clearTweetRatingsAndRefreshUI();
                        break;
                    case 'reset-settings':
                        SettingsManager.resetSettings(UIUtils.isMobileDevice());
                        break;
                    case 'save-instructions':
                        this.saveInstructions();
                        break;
                    case 'add-handle':
                        HandleManager.addHandleFromInput();
                        break;
                    case 'clear-instructions-history':
                        if (UIUtils.isMobileDevice() || confirm('Are you sure you want to clear all instruction history?')) {
                            instructionsHistory.clear();
                            InstructionsManager.refreshInstructionsHistory();
                            UIUtils.showStatus('Instructions history cleared');
                        }
                        break;
                }
            }

            // Handle List Removal (delegated)
            if (target.classList.contains('remove-handle')) {
                const handleItem = target.closest('.handle-item');
                const handleTextElement = handleItem?.querySelector('.handle-text');
                if (handleTextElement) {
                    const handle = handleTextElement.textContent.substring(1); // Remove '@'
                    HandleManager.removeHandleFromBlacklist(handle);
                }
            }

            // Tab Switching
            if (tab) {
                SettingsManager.switchTab(tab);
            }

            // Advanced Options Toggle
            if (toggleTargetId) {
                SettingsManager.toggleAdvancedOptions(toggleTargetId);
            } else {
                // Check if we clicked inside an advanced-toggle
                const toggleParent = target.closest('.advanced-toggle');
                if (toggleParent) {
                    const toggleId = toggleParent.dataset.toggle;
                    if (toggleId) {
                        SettingsManager.toggleAdvancedOptions(toggleId);
                    }
                }
            }
        });

        // --- Delegated Event Listener for Input/Change ---
        uiContainer.addEventListener('input', (event) => {
            const target = event.target;
            const setting = target.dataset.setting;
            const paramName = target.closest('.parameter-row')?.dataset.paramName;

            // Settings Inputs / Toggles
            if (setting) {
                SettingsManager.handleSettingChange(target, setting);
            }

            // Parameter Controls (Sliders/Number Inputs)
            if (paramName) {
                this.handleParameterChange(target, paramName);
            }

            // Filter Slider
            if (target.id === 'tweet-filter-slider') {
                this.handleFilterSliderChange(target);
            }
        });

        uiContainer.addEventListener('change', (event) => {
            const target = event.target;
            const setting = target.dataset.setting;

            // Settings Inputs / Toggles (for selects like sort order)
            if (setting === 'modelSortOrder') {
                SettingsManager.handleSettingChange(target, setting);
                fetchAvailableModels(); // Refresh models on sort change
            }

            // Settings Checkbox toggle (need change event for checkboxes)
            if (setting === 'enableImageDescriptions') {
                SettingsManager.handleSettingChange(target, setting);
            }
        });

        // --- Direct Event Listeners (Less common cases) ---

        // Settings Toggle Button
        if (settingsToggleBtn) {
            settingsToggleBtn.onclick = () => {
                UIUtils.toggleElementVisibility(settingsContainer, settingsToggleBtn, '<span style="font-size: 14px;">✕</span> Close', '<span style="font-size: 14px;">⚙️</span> Settings');
            };
        }

        // Filter Toggle Button
        if (filterToggleBtn) {
            filterToggleBtn.onclick = () => {
                // Ensure filter container is shown and button is hidden
                if (filterContainer) filterContainer.classList.remove('hidden');
                filterToggleBtn.style.display = 'none';
            };
        }

        // Close custom selects when clicking outside
        document.addEventListener('click', CustomSelect.closeAll);

        // Add handlers for new controls
        const showFreeModelsCheckbox = uiContainer.querySelector('#show-free-models');
        if (showFreeModelsCheckbox) {
            showFreeModelsCheckbox.addEventListener('change', function() {
                showFreeModels = this.checked;
                browserSet('showFreeModels', showFreeModels);
                ModelUI.refreshModelsUI();
            });
        }

        const sortDirectionBtn = uiContainer.querySelector('#sort-direction');
        if (sortDirectionBtn) {
            sortDirectionBtn.addEventListener('click', function() {
                const currentDirection = browserGet('sortDirection', 'default');
                const newDirection = currentDirection === 'default' ? 'reverse' : 'default';
                browserSet('sortDirection', newDirection);
                this.dataset.value = newDirection;
                ModelUI.refreshModelsUI();
            });
        }

        const modelSortSelect = uiContainer.querySelector('#model-sort-order');
        if (modelSortSelect) {
            modelSortSelect.addEventListener('change', function() {
                browserSet('modelSortOrder', this.value);
                // Set default direction for latency and age
                if (this.value === 'latency-low-to-high') {
                    browserSet('sortDirection', 'default'); // Show lowest latency first
                } else if (this.value === '') { // Age
                    browserSet('sortDirection', 'default'); // Show newest first
                }
                ModelUI.refreshModelsUI();
            });
        }

        const providerSortSelect = uiContainer.querySelector('#provider-sort');
        if (providerSortSelect) {
            providerSortSelect.addEventListener('change', function() {
                providerSort = this.value;
                browserSet('providerSort', providerSort);
            });
        }

        console.log('UI events wired.');
    },

    /**
     * Handles changes to parameter control sliders/number inputs.
     * @param {HTMLElement} target - The slider or number input element.
     * @param {string} paramName - The name of the parameter (from data-param-name).
     */
    handleParameterChange(target, paramName) {
        const row = target.closest('.parameter-row');
        if (!row) return;

        const slider = row.querySelector('.parameter-slider');
        const valueInput = row.querySelector('.parameter-value');
        const min = parseFloat(slider.min);
        const max = parseFloat(slider.max);
        let newValue = parseFloat(target.value);

        // Clamp value if it's from the number input
        if (target.type === 'number' && !isNaN(newValue)) {
            newValue = Math.max(min, Math.min(max, newValue));
        }

        // Update both slider and input
        if (slider && valueInput) {
            slider.value = newValue;
            valueInput.value = newValue;
        }

        // Update global variable
        if (window[paramName] !== undefined) {
            window[paramName] = newValue;
        }

        // Save to storage
        browserSet(paramName, newValue);
    },

    /**
     * Handles changes to the main filter slider.
     * @param {HTMLElement} slider - The filter slider element.
     */
    handleFilterSliderChange(slider) {
        const valueDisplay = document.getElementById('tweet-filter-value');
        currentFilterThreshold = parseInt(slider.value, 10);
        if (valueDisplay) {
            valueDisplay.textContent = currentFilterThreshold.toString();
        }
        
        // Update the gradient position based on the slider value
        const percentage = (currentFilterThreshold / 10) * 100;
        slider.style.setProperty('--slider-percent', `${percentage}%`);
        
        browserSet('filterThreshold', currentFilterThreshold);
        applyFilteringToAll();
    },

    /**
     * Saves the API key from the input field.
     */
    saveApiKey() {
        const apiKeyInput = document.getElementById('openrouter-api-key');
        const apiKey = apiKeyInput.value.trim();
        let previousAPIKey = browserGet('openrouter-api-key', '').length > 0;
        if (apiKey) {
            if (!previousAPIKey) {
                SettingsManager.resetSettings(true);
            }
            browserSet('openrouter-api-key', apiKey);
            UIUtils.showStatus('API key saved successfully!');
            fetchAvailableModels(); // Refresh model list
            location.reload();
        } else {
            UIUtils.showStatus('Please enter a valid API key');
        }
    },

    /**
     * Saves the custom instructions from the textarea.
     */
    async saveInstructions() {
        const instructionsTextarea = document.getElementById('user-instructions');
        const instructions = instructionsTextarea.value.trim();
        if (!instructions) {
            UIUtils.showStatus('Instructions cannot be empty');
            return;
        }

        USER_DEFINED_INSTRUCTIONS = instructions;
        browserSet('userDefinedInstructions', USER_DEFINED_INSTRUCTIONS);

        // Get 5-word summary for the instructions
        const summary = await getCustomInstructionsDescription(instructions);
        if (!summary.error) {
            // Add to history using the singleton
            await instructionsHistory.add(instructions, summary.content);
            
            // Refresh the history list
            InstructionsManager.refreshInstructionsHistory();
        }

        UIUtils.showStatus('Scoring instructions saved! New tweets will use these instructions.');
        if (UIUtils.isMobileDevice() || confirm('Do you want to clear the rating cache to apply these instructions to all tweets?')) {
            this.clearTweetRatingsAndRefreshUI();
        }
    },

    /**
     * Clears tweet ratings and updates the relevant UI parts.
     */
    clearTweetRatingsAndRefreshUI() {
        if (UIUtils.isMobileDevice() || confirm('Are you sure you want to clear all cached tweet ratings?')) {
            // Clear all ratings
            tweetCache.clear();
            
            // Clear thread relationships cache
            if (window.threadRelationships) {
                window.threadRelationships = {};
                browserSet('threadRelationships', '{}');
                console.log('Cleared thread relationships cache');
            }
            
            UIUtils.showStatus('All cached ratings and thread relationships cleared!');
            console.log('Cleared all tweet ratings and thread relationships');

            // Reset all tweet elements to unrated state and reprocess them
            if (observedTargetNode) {
                observedTargetNode.querySelectorAll('article[data-testid="tweet"]').forEach(tweet => {
                    tweet.removeAttribute('data-sloppiness-score');
                    tweet.removeAttribute('data-rating-status');
                    tweet.removeAttribute('data-rating-description');
                    tweet.removeAttribute('data-cached-rating');
                    const indicator = tweet.querySelector('.score-indicator');
                    if (indicator) {
                        indicator.remove();
                    }
                    // Remove from processed set and schedule reprocessing
                    processedTweets.delete(getTweetID(tweet));
                    scheduleTweetProcessing(tweet);
                });
            }

            // Reset thread mapping on any conversation containers
            document.querySelectorAll('div[aria-label="Timeline: Conversation"], div[aria-label^="Timeline: Conversation"]').forEach(conversation => {
                delete conversation.dataset.threadMapping;
                delete conversation.dataset.threadMappedAt;
                delete conversation.dataset.threadMappingInProgress;
                delete conversation.dataset.threadHist;
                delete conversation.dataset.threadMediaUrls;
            });

            // Update UI elements
            StatsManager.updateCacheStatsUI();
        }
    },

    
}; 