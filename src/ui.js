// --- Utility Functions ---

/**
 * Displays a temporary status message on the screen.
 * @param {string} message - The message to display.
 */
function showStatus(message) {
    const indicator = document.getElementById('status-indicator');
    if (!indicator) {
        console.error('#status-indicator element not found.');
        return;
    }
    indicator.textContent = message;
    indicator.classList.add('active');
    setTimeout(() => { indicator.classList.remove('active'); }, 3000);
}

/**
 * Toggles the visibility of an element and updates the corresponding toggle button text.
 * @param {HTMLElement} element - The element to toggle.
 * @param {HTMLElement} toggleButton - The button that controls the toggle.
 * @param {string} openText - Text for the button when the element is open.
 * @param {string} closedText - Text for the button when the element is closed.
 */
function toggleElementVisibility(element, toggleButton, openText, closedText) {
    if (!element || !toggleButton) return;

    const isHidden = element.classList.toggle('hidden');
    toggleButton.innerHTML = isHidden ? closedText : openText;

    // Special case for filter slider button (hide it when panel is shown)
    if (element.id === 'tweet-filter-container') {
        const filterToggle = document.getElementById('filter-toggle');
        if (filterToggle) {
            filterToggle.style.display = isHidden ? 'block' : 'none';
        }
    }
}

// --- Core UI Logic ---

/**
 * Injects the UI elements from the HTML resource into the page.
 */
function injectUI() {
    //combined userscript has a const named MENU. If it exists, use it.
    let menuHTML;
    if(MENU){
        menuHTML = MENU;
    }else{
        menuHTML = browserGet('menuHTML');
    }
    
    if (!menuHTML) {
        console.error('Failed to load Menu.html resource!');
        showStatus('Error: Could not load UI components.');
        return null;
    }

    // Create a container to inject HTML
    const containerId = 'tweetfilter-root-container'; // Use the ID from the updated HTML
    let uiContainer = document.getElementById(containerId);
    if (uiContainer) {
        console.warn('UI container already exists. Skipping injection.');
        return uiContainer; // Return existing container
    }

    uiContainer = document.createElement('div');
    uiContainer.id = containerId;
    uiContainer.innerHTML = menuHTML;

    // Inject styles
    const stylesheet = uiContainer.querySelector('style');
    if (stylesheet) {
        GM_addStyle(stylesheet.textContent);
        console.log('Injected styles from Menu.html');
        stylesheet.remove(); // Remove style tag after injecting
    } else {
        console.warn('No <style> tag found in Menu.html');
    }

    // Append the rest of the UI elements
    document.body.appendChild(uiContainer);
    console.log('TweetFilter UI Injected from HTML resource.');

    // Set version number
    const versionInfo = uiContainer.querySelector('#version-info');
    if (versionInfo) {
        versionInfo.textContent = `Twitter De-Sloppifier v${VERSION}`;
    }

    return uiContainer; // Return the newly created container
}

/**
 * Initializes all UI event listeners using event delegation.
 * @param {HTMLElement} uiContainer - The root container element for the UI.
 */
function initializeEventListeners(uiContainer) {
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
                    toggleElementVisibility(filterContainer, filterToggleBtn, 'Filter Slider', 'Filter Slider');
                    break;
                case 'close-settings':
                    toggleElementVisibility(settingsContainer, settingsToggleBtn, '<span style="font-size: 14px;">✕</span> Close', '<span style="font-size: 14px;">⚙️</span> Settings');
                    break;
                case 'save-api-key':
                    saveApiKey();
                    break;
                case 'clear-cache':
                    clearTweetRatingsAndRefreshUI();
                    break;
                case 'reset-settings':
                    resetSettings();
                    break;
                case 'save-instructions':
                    saveInstructions();
                    break;
                case 'add-handle':
                    addHandleFromInput();
                    break;
            }
        }

        // Handle List Removal (delegated)
        if (target.classList.contains('remove-handle')) {
            const handleItem = target.closest('.handle-item');
            const handleTextElement = handleItem?.querySelector('.handle-text');
            if (handleTextElement) {
                const handle = handleTextElement.textContent.substring(1); // Remove '@'
                removeHandleFromBlacklist(handle);
            }
        }

        // Tab Switching
        if (tab) {
            switchTab(tab);
        }

        // Advanced Options Toggle
        if (toggleTargetId) {
            toggleAdvancedOptions(toggleTargetId);
        }
    });

    // --- Delegated Event Listener for Input/Change ---
    uiContainer.addEventListener('input', (event) => {
        const target = event.target;
        const setting = target.dataset.setting;
        const paramName = target.closest('.parameter-row')?.dataset.paramName;

        // Settings Inputs / Toggles
        if (setting) {
            handleSettingChange(target, setting);
        }

        // Parameter Controls (Sliders/Number Inputs)
        if (paramName) {
            handleParameterChange(target, paramName);
        }

        // Filter Slider
        if (target.id === 'tweet-filter-slider') {
            handleFilterSliderChange(target);
        }
    });

    uiContainer.addEventListener('change', (event) => {
        const target = event.target;
        const setting = target.dataset.setting;

         // Settings Inputs / Toggles (for selects like sort order)
         if (setting === 'modelSortOrder') {
            handleSettingChange(target, setting);
            fetchAvailableModels(); // Refresh models on sort change
         }

          // Settings Checkbox toggle (need change event for checkboxes)
          if (setting === 'enableImageDescriptions') {
             handleSettingChange(target, setting);
          }
    });

    // --- Direct Event Listeners (Less common cases) ---

    // Settings Toggle Button
    if (settingsToggleBtn) {
        settingsToggleBtn.onclick = () => {
            toggleElementVisibility(settingsContainer, settingsToggleBtn, '<span style="font-size: 14px;">✕</span> Close', '<span style="font-size: 14px;">⚙️</span> Settings');
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
    document.addEventListener('click', closeAllSelectBoxes);

    // Add handlers for new controls
    const showFreeModelsCheckbox = uiContainer.querySelector('#show-free-models');
    if (showFreeModelsCheckbox) {
        showFreeModelsCheckbox.addEventListener('change', function() {
            showFreeModels = this.checked;
            browserSet('showFreeModels', showFreeModels);
            refreshModelsUI();
        });
    }

    const sortDirectionBtn = uiContainer.querySelector('#sort-direction');
    if (sortDirectionBtn) {
        sortDirectionBtn.addEventListener('click', function() {
            const currentDirection = browserGet('sortDirection', 'default');
            const newDirection = currentDirection === 'default' ? 'reverse' : 'default';
            browserSet('sortDirection', newDirection);
            this.dataset.value = newDirection;
            refreshModelsUI();
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
            refreshModelsUI();
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
}

// --- Event Handlers ---

/** Saves the API key from the input field. */
function saveApiKey() {
    const apiKeyInput = document.getElementById('openrouter-api-key');
    const apiKey = apiKeyInput.value.trim();
    let previousAPIKey = browserGet('openrouter-api-key', '').length>0?true:false;
    if (apiKey) {
        if (!previousAPIKey){
            resetSettings(true);
            //jank hack to get the UI defaults to load correctly
        }
        browserSet('openrouter-api-key', apiKey);
        showStatus('API key saved successfully!');
        fetchAvailableModels(); // Refresh model list
        //refresh the website
        location.reload();
    } else {
        showStatus('Please enter a valid API key');
    }
}

/** Clears tweet ratings and updates the relevant UI parts. */
function clearTweetRatingsAndRefreshUI() {
    if (isMobileDevice() || confirm('Are you sure you want to clear all cached tweet ratings?')) {
        // Clear all ratings
        tweetCache.clear();
        
        // Clear thread relationships cache
        if (window.threadRelationships) {
            window.threadRelationships = {};
            browserSet('threadRelationships', '{}');
            console.log('Cleared thread relationships cache');
        }
        
        showStatus('All cached ratings and thread relationships cleared!');
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
        updateCacheStatsUI();
    }
}

/** Saves the custom instructions from the textarea. */
function saveInstructions() {
    const instructionsTextarea = document.getElementById('user-instructions');
    USER_DEFINED_INSTRUCTIONS = instructionsTextarea.value;
    browserSet('userDefinedInstructions', USER_DEFINED_INSTRUCTIONS);
    showStatus('Scoring instructions saved! New tweets will use these instructions.');
    if (isMobileDevice() || confirm('Do you want to clear the rating cache to apply these instructions to all tweets?')) {
        clearTweetRatingsAndRefreshUI();
    }
}

/** Adds a handle from the input field to the blacklist. */
function addHandleFromInput() {
    const handleInput = document.getElementById('handle-input');
    const handle = handleInput.value.trim();
    if (handle) {
        addHandleToBlacklist(handle);
        handleInput.value = ''; // Clear input after adding
    }
}

/**
 * Handles changes to general setting inputs/toggles.
 * @param {HTMLElement} target - The input/toggle element that changed.
 * @param {string} settingName - The name of the setting (from data-setting).
 */
function handleSettingChange(target, settingName) {
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

    // Save to GM storage
    browserSet(settingName, value);

    // Special UI updates for specific settings
    if (settingName === 'enableImageDescriptions') {
        const imageModelContainer = document.getElementById('image-model-container');
        if (imageModelContainer) {
            imageModelContainer.style.display = value ? 'block' : 'none';
        }
        showStatus('Image descriptions ' + (value ? 'enabled' : 'disabled'));
    }
}

/**
 * Handles changes to parameter control sliders/number inputs.
 * @param {HTMLElement} target - The slider or number input element.
 * @param {string} paramName - The name of the parameter (from data-param-name).
 */
function handleParameterChange(target, paramName) {
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

    // Save to GM storage
    browserSet(paramName, newValue);
}

/**
 * Handles changes to the main filter slider.
 * @param {HTMLElement} slider - The filter slider element.
 */
function handleFilterSliderChange(slider) {
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
}

/**
 * Switches the active tab in the settings panel.
 * @param {string} tabName - The name of the tab to activate (from data-tab).
 */
function switchTab(tabName) {
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
}

/**
 * Toggles the visibility of advanced options sections.
 * @param {string} contentId - The ID of the content element to toggle.
 */
function toggleAdvancedOptions(contentId) {
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
}


/**
 * Refreshes the entire settings UI to reflect current settings.
 */
function refreshSettingsUI() {
    // Update general settings inputs/toggles
    document.querySelectorAll('[data-setting]').forEach(input => {
        const settingName = input.dataset.setting;
        const value = browserGet(settingName, window[settingName]); // Get saved or default value
        if (input.type === 'checkbox') {
            input.checked = value;
            // Trigger change handler for side effects (like hiding/showing image model section)
            handleSettingChange(input, settingName);
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
    refreshHandleList(document.getElementById('handle-list'));
    refreshModelsUI(); // Refreshes model dropdowns

    // Set initial state for advanced sections (collapsed by default unless CSS specifies otherwise)
    document.querySelectorAll('.advanced-content').forEach(content => {
        if (!content.classList.contains('expanded')) {
            content.style.maxHeight = '0';
        }
    });
    document.querySelectorAll('.advanced-toggle-icon.expanded').forEach(icon => {
        // Ensure icon matches state if CSS defaults to expanded
        if (!icon.closest('.advanced-toggle')?.nextElementSibling?.classList.contains('expanded')) {
            icon.classList.remove('expanded');
        }
    });
}

/**
 * Refreshes the handle list UI.
 * @param {HTMLElement} listElement - The list element to refresh.
 */
function refreshHandleList(listElement) {
    if (!listElement) return;

    listElement.innerHTML = ''; // Clear existing list

    if (blacklistedHandles.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.style.cssText = 'padding: 8px; opacity: 0.7; font-style: italic;';
        emptyMsg.textContent = 'No handles added yet';
        listElement.appendChild(emptyMsg);
        return;
    }

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
        // removeBtn listener is handled by delegation in initializeEventListeners
        item.appendChild(removeBtn);

        listElement.appendChild(item);
    });
}

/**
 * Updates the model selection dropdowns based on availableModels.
 */
function refreshModelsUI() {
    const modelSelectContainer = document.getElementById('model-select-container');
    const imageModelSelectContainer = document.getElementById('image-model-select-container');

    // Filter and sort models
    listedModels = [...availableModels];
    
    // Filter free models if needed
    if (!showFreeModels) {
        listedModels = listedModels.filter(model => !model.slug.endsWith(':free'));
    }

    // Sort models based on current sort order and direction
    const sortDirection = browserGet('sortDirection', 'default');
    const sortOrder = browserGet('modelSortOrder', 'throughput-high-to-low');
    
    // Update toggle button text based on sort order
    const toggleBtn = document.getElementById('sort-direction');
    if (toggleBtn) {
        switch(sortOrder) {
            case 'latency-low-to-high':
                toggleBtn.textContent = sortDirection === 'default' ? 'High-Low' : 'Low-High';
                if (sortDirection === 'reverse') listedModels.reverse();
                break;
            case '': // Age
                toggleBtn.textContent = sortDirection === 'default' ? 'New-Old' : 'Old-New';
                if (sortDirection === 'reverse') listedModels.reverse();
                break;
            case 'top-weekly':
                toggleBtn.textContent = sortDirection === 'default' ? 'Most Popular' : 'Least Popular';
                if (sortDirection === 'reverse') listedModels.reverse();
                break;
            default:
                toggleBtn.textContent = sortDirection === 'default' ? 'High-Low' : 'Low-High';
                if (sortDirection === 'reverse') listedModels.reverse();
        }
    }

    // Update main model selector
    if (modelSelectContainer) {
        modelSelectContainer.innerHTML = '';
        createCustomSelect(
            modelSelectContainer,
            'model-selector',
            listedModels.map(model => ({ value: model.slug || model.id, label: formatModelLabel(model) })),
            selectedModel,
            (newValue) => {
                selectedModel = newValue;
                browserSet('selectedModel', selectedModel);
                showStatus('Rating model updated');
            },
            'Search rating models...'
        );
    }

    // Update image model selector
    if (imageModelSelectContainer) {
        const visionModels = listedModels.filter(model =>
            model.input_modalities?.includes('image') ||
            model.architecture?.input_modalities?.includes('image') ||
            model.architecture?.modality?.includes('image')
        );

        imageModelSelectContainer.innerHTML = '';
        createCustomSelect(
            imageModelSelectContainer,
            'image-model-selector',
            visionModels.map(model => ({ value: model.slug || model.id, label: formatModelLabel(model) })),
            selectedImageModel,
            (newValue) => {
                selectedImageModel = newValue;
                browserSet('selectedImageModel', selectedImageModel);
                showStatus('Image model updated');
            },
            'Search vision models...'
        );
    }
}

/**
 * Formats a model object into a string for display in dropdowns.
 * @param {Object} model - The model object from the API.
 * @returns {string} A formatted label string.
 */
function formatModelLabel(model) {
    let label = model.slug || model.id || model.name || 'Unknown Model';
    let pricingInfo = '';

    // Extract pricing
    const pricing = model.endpoint?.pricing || model.pricing;
    if (pricing) {
        const promptPrice = parseFloat(pricing.prompt);
        const completionPrice = parseFloat(pricing.completion);

        if (!isNaN(promptPrice)) {
            pricingInfo += ` - $${(promptPrice*1e6).toFixed(4)}/mil. tok.-in`;
            if (!isNaN(completionPrice) && completionPrice !== promptPrice) {
                pricingInfo += ` $${(completionPrice*1e6).toFixed(4)}/mil. tok.-out`;
            }
        } else if (!isNaN(completionPrice)) {
            // Handle case where only completion price is available (less common)
            pricingInfo += ` - $${(completionPrice*1e6).toFixed(4)}/mil. tok.-out`;
        }
    }

    // Add vision icon
    const isVision = model.input_modalities?.includes('image') ||
                     model.architecture?.input_modalities?.includes('image') ||
                     model.architecture?.modality?.includes('image');
    if (isVision) {
        label = '🖼️ ' + label;
    }

    return label + pricingInfo;
}

// --- Custom Select Dropdown Logic (largely unchanged, but included for completeness) ---

/**
 * Creates a custom select dropdown with search functionality.
 * @param {HTMLElement} container - Container to append the custom select to.
 * @param {string} id - ID for the root custom-select div.
 * @param {Array<{value: string, label: string}>} options - Options for the dropdown.
 * @param {string} initialSelectedValue - Initially selected value.
 * @param {Function} onChange - Callback function when selection changes.
 * @param {string} searchPlaceholder - Placeholder text for the search input.
 */
function createCustomSelect(container, id, options, initialSelectedValue, onChange, searchPlaceholder) {
    let currentSelectedValue = initialSelectedValue;

    const customSelect = document.createElement('div');
    customSelect.className = 'custom-select';
    customSelect.id = id;

    const selectSelected = document.createElement('div');
    selectSelected.className = 'select-selected';

    const selectItems = document.createElement('div');
    selectItems.className = 'select-items';
    selectItems.style.display = 'none'; // Initially hidden

    const searchField = document.createElement('div');
    searchField.className = 'search-field';
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'search-input';
    searchInput.placeholder = searchPlaceholder || 'Search...';
    searchField.appendChild(searchInput);
    selectItems.appendChild(searchField);

    // Function to render options
    function renderOptions(filter = '') {
        // Clear previous options (excluding search field)
        while (selectItems.childNodes.length > 1) {
            selectItems.removeChild(selectItems.lastChild);
        }

        const filteredOptions = options.filter(opt =>
            opt.label.toLowerCase().includes(filter.toLowerCase())
        );

        if (filteredOptions.length === 0) {
            const noResults = document.createElement('div');
            noResults.textContent = 'No matches found';
            noResults.style.cssText = 'opacity: 0.7; font-style: italic; padding: 10px; text-align: center; cursor: default;';
            selectItems.appendChild(noResults);
        }

        filteredOptions.forEach(option => {
            const optionDiv = document.createElement('div');
            optionDiv.textContent = option.label;
            optionDiv.dataset.value = option.value;
            if (option.value === currentSelectedValue) {
                optionDiv.classList.add('same-as-selected');
            }

            optionDiv.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent closing immediately
                currentSelectedValue = option.value;
                selectSelected.textContent = option.label;
                selectItems.style.display = 'none';
                selectSelected.classList.remove('select-arrow-active');

                // Update classes for all items
                selectItems.querySelectorAll('div[data-value]').forEach(div => {
                    div.classList.toggle('same-as-selected', div.dataset.value === currentSelectedValue);
            });

                onChange(currentSelectedValue);
            });
            selectItems.appendChild(optionDiv);
        });
    }

    // Set initial display text
    const initialOption = options.find(opt => opt.value === currentSelectedValue);
    selectSelected.textContent = initialOption ? initialOption.label : 'Select an option';

    customSelect.appendChild(selectSelected);
    customSelect.appendChild(selectItems);
    container.appendChild(customSelect);

    // Initial rendering
    renderOptions();

    // Event listeners
    searchInput.addEventListener('input', () => renderOptions(searchInput.value));
    searchInput.addEventListener('click', e => e.stopPropagation()); // Prevent closing

    selectSelected.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAllSelectBoxes(customSelect); // Close others
        const isHidden = selectItems.style.display === 'none';
        selectItems.style.display = isHidden ? 'block' : 'none';
        selectSelected.classList.toggle('select-arrow-active', isHidden);
        if (isHidden) {
            searchInput.focus();
            searchInput.select(); // Select text for easy replacement
            renderOptions(); // Re-render in case options changed
        }
    });
}

/** Closes all custom select dropdowns except the one passed in. */
function closeAllSelectBoxes(exceptThisOne = null) {
    document.querySelectorAll('.custom-select').forEach(select => {
        if (select === exceptThisOne) return;
        const items = select.querySelector('.select-items');
        const selected = select.querySelector('.select-selected');
        if (items) items.style.display = 'none';
        if (selected) selected.classList.remove('select-arrow-active');
    });
}

// --- Rating Indicator Logic (Simplified, assuming CSS handles most styling) ---

/**
 * Updates or creates the rating indicator on a tweet article.
 * @param {Element} tweetArticle - The tweet article element.
 * @param {number|null} score - The numeric rating (null if pending/error).
 * @param {string} status - 'pending', 'rated', 'error', 'cached', 'blacklisted', 'streaming'.
 * @param {string} [description] - Optional description for hover tooltip.
 * @param {string} [reasoning] - Optional reasoning trace.
 */
function setScoreIndicator(tweetArticle, score, status, description = "", reasoning = "") {
    const tweetId = getTweetID(tweetArticle);
    let indicator = tweetArticle.querySelector('.score-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.className = 'score-indicator';
        tweetArticle.style.position = 'relative'; // Ensure parent is positioned
        tweetArticle.appendChild(indicator);
        
        // Create a unique tooltip for this indicator
        const tooltip = document.createElement('div');
        tooltip.className = 'score-description';
        tooltip.style.display = 'none';
        
        // Store the tweet ID in the tooltip's dataset for cleanup
        tooltip.dataset.tweetId = tweetId;
        
        // Create the fixed structure for the tooltip
        // Add tooltip controls row with pin and copy buttons
        const tooltipControls = document.createElement('div');
        tooltipControls.className = 'tooltip-controls';
        
        const pinButton = document.createElement('button');
        pinButton.className = 'tooltip-pin-button';
        pinButton.innerHTML = '📌';
        pinButton.title = 'Pin tooltip (prevents auto-closing)';
        pinButton.addEventListener('click', function(e) {
            e.stopPropagation();
            const isPinned = tooltip.classList.toggle('pinned');
            this.innerHTML = isPinned ? '📍' : '📌';
            this.title = isPinned ? 'Unpin tooltip' : 'Pin tooltip (prevents auto-closing)';
        });
        
        const copyButton = document.createElement('button');
        copyButton.className = 'tooltip-copy-button';
        copyButton.innerHTML = '📋';
        copyButton.title = 'Copy content to clipboard';
        copyButton.addEventListener('click', function(e) {
            e.stopPropagation();
            const description = tooltip.querySelector('.description-text');
            const reasoning = tooltip.querySelector('.reasoning-text');
            let textToCopy = description ? description.textContent : '';
            if (reasoning && reasoning.textContent) {
                textToCopy += '\n\nReasoning:\n' + reasoning.textContent;
            }
            navigator.clipboard.writeText(textToCopy).then(() => {
                const originalText = this.innerHTML;
                this.innerHTML = '✓';
                setTimeout(() => {
                    this.innerHTML = originalText;
                }, 1500);
            }).catch(err => {
                console.error('Failed to copy text: ', err);
            });
        });
        
        tooltipControls.appendChild(pinButton);
        tooltipControls.appendChild(copyButton);
        tooltip.appendChild(tooltipControls);
        
        // Create the reasoning dropdown structure upfront
        const reasoningDropdown = document.createElement('div');
        reasoningDropdown.className = 'reasoning-dropdown';
        
        // Create the toggle button without inline event
        const reasoningToggle = document.createElement('div');
        reasoningToggle.className = 'reasoning-toggle';
        
        const arrow = document.createElement('span');
        arrow.className = 'reasoning-arrow';
        arrow.textContent = '▶';
        
        reasoningToggle.appendChild(arrow);
        reasoningToggle.appendChild(document.createTextNode(' Show Reasoning Trace'));
        
        // Add event listener properly
        reasoningToggle.addEventListener('click', function(e) {
            e.stopPropagation(); // Prevent bubbling to tooltip click handler
            const dropdown = this.closest('.reasoning-dropdown');
            dropdown.classList.toggle('expanded');
            
            // Update arrow
            const arrowSpan = this.querySelector('.reasoning-arrow');
            arrowSpan.textContent = dropdown.classList.contains('expanded') ? '▼' : '▶';
            
            // Ensure content is visible when expanded
            const content = dropdown.querySelector('.reasoning-content');
            if (dropdown.classList.contains('expanded')) {
                content.style.maxHeight = '300px';
                content.style.padding = '10px';
            } else {
                content.style.maxHeight = '0';
                content.style.padding = '0';
            }
        });
        
        // Create reasoning content
        const reasoningContent = document.createElement('div');
        reasoningContent.className = 'reasoning-content';
        
        const reasoningText = document.createElement('p');
        reasoningText.className = 'reasoning-text';
        
        reasoningContent.appendChild(reasoningText);
        
        // Assemble the dropdown
        reasoningDropdown.appendChild(reasoningToggle);
        reasoningDropdown.appendChild(reasoningContent);
        
        tooltip.appendChild(reasoningDropdown);
        
        // Create a paragraph for the description
        const descriptionParagraph = document.createElement('p');
        descriptionParagraph.className = 'description-text';
        tooltip.appendChild(descriptionParagraph);
        
        // Add scroll-to-bottom button
        const scrollButton = document.createElement('div');
        scrollButton.className = 'scroll-to-bottom-button';
        scrollButton.innerHTML = '⬇ Scroll to bottom';
        scrollButton.style.display = 'none'; // Hidden by default
        scrollButton.addEventListener('click', (e) => {
            e.stopPropagation();
            tooltip.dataset.autoScroll = 'true';
            
            // Use double requestAnimationFrame to ensure we get the final scroll height
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    tooltip.scrollTo({
                        top: tooltip.scrollHeight,
                        behavior: 'instant'  // Use instant instead of smooth
                    });
                    
                    // Double-check scroll position after a small delay
                    setTimeout(() => {
                        if (tooltip.dataset.autoScroll === 'true') {
                            tooltip.scrollTop = tooltip.scrollHeight;
                        }
                    }, 50);
                });
            });
            
            scrollButton.style.display = 'none';
        });
        tooltip.appendChild(scrollButton);
        
        // Add some spacing at the bottom for better scrolling experience
        const bottomSpacer = document.createElement('div');
        bottomSpacer.className = 'tooltip-bottom-spacer';
        tooltip.appendChild(bottomSpacer);
        
        // Set initial auto-scroll state
        tooltip.dataset.autoScroll = status=='rated' || status=='cached'?'false':'true';
        
        // Add scroll event to detect when user manually scrolls
        tooltip.addEventListener('scroll', () => {
            // Check if we're near the bottom
            const isNearBottom = tooltip.scrollHeight - tooltip.scrollTop - tooltip.clientHeight < (isMobileDevice() ? 40 : 55);
            const isStreaming = tooltip.classList.contains('streaming-tooltip');
            const scrollButton = tooltip.querySelector('.scroll-to-bottom-button');
            
            if (!isNearBottom) {
                // User has scrolled up
                if (tooltip.dataset.autoScroll === 'true') {
                    tooltip.dataset.autoScroll = 'false';
                }
                
                // Show the scroll-to-bottom button if we're streaming
                if (isStreaming && scrollButton) {
                    scrollButton.style.display = 'block';
                }
            } else {
                // User has scrolled to bottom
                if (scrollButton) {
                    scrollButton.style.display = 'none';
                }
                // Only re-enable auto-scroll if user explicitly scrolled to bottom
                if (tooltip.dataset.userInitiatedScroll === 'true') {
                    tooltip.dataset.autoScroll = 'true';
                }
            }
            
            // Track that this was a user-initiated scroll
            tooltip.dataset.userInitiatedScroll = 'true';
            
            // Clear the flag after a short delay
            setTimeout(() => {
                tooltip.dataset.userInitiatedScroll = 'false';
            }, 100);
        });
        
        document.body.appendChild(tooltip); // Append to body instead of indicator
        
        // Store the tooltip reference
        indicator.scoreTooltip = tooltip;
        
        // Add mouse hover listeners
        indicator.addEventListener('mouseenter', handleIndicatorMouseEnter);
        indicator.addEventListener('mouseleave', handleIndicatorMouseLeave);
        
        // Add click/tap handler for toggling tooltip
        indicator.addEventListener('click', function(e) {
            e.stopPropagation(); // Prevent opening the tweet
            e.preventDefault();
            toggleTooltipVisibility(this);
        });
        
        // Also add hover listeners to the tooltip
        tooltip.addEventListener('mouseenter', () => {
            if (!tooltip.classList.contains('pinned')) {
                tooltip.style.display = 'block';
            }
        });
        tooltip.addEventListener('mouseleave', () => {
            if (!tooltip.classList.contains('pinned')) {
                tooltip.style.display = 'none';
            }
        });
        
        // Add click handler to close tooltip when clicking outside
        tooltip.addEventListener('click', (e) => {
            // Only if not clicking reasoning toggle, buttons, or scroll button
            if (!e.target.closest('.reasoning-toggle') && 
                !e.target.closest('.scroll-to-bottom-button') &&
                !e.target.closest('.tooltip-controls')) {
                if (!tooltip.classList.contains('pinned')) {
                    tooltip.style.display = 'none';
                }
            }
        });
        
        // Apply mobile positioning if needed
        if (isMobileDevice()) {
            indicator.classList.add('mobile-indicator');
        }
    }

    // Update status class and text content
    indicator.classList.remove('pending-rating', 'rated-rating', 'error-rating', 'cached-rating', 'blacklisted-rating', 'streaming-rating'); // Clear previous
    indicator.dataset.description = description || ''; // Store description
    indicator.dataset.reasoning = reasoning || ''; // Store reasoning
    indicator.dataset.tweetId = tweetId; // Store tweet ID in indicator
    
    // Update the tooltip content
    const tooltip = indicator.scoreTooltip;
    if (tooltip) {
        tooltip.dataset.tweetId = tweetId; // Ensure the tooltip also has the tweet ID
        updateTooltipContent(tooltip, description, reasoning);
    }

    switch (status) {
        case 'pending':
            indicator.classList.add('pending-rating');
            indicator.textContent = '⏳';
            break;
        case 'streaming':
            indicator.classList.add('streaming-rating');
            indicator.textContent = '🔄';
            break;
        case 'error':
            indicator.classList.add('error-rating');
            indicator.textContent = '⚠️';
            break;
        case 'cached':
            indicator.classList.add('cached-rating');
            indicator.textContent = score;
            break;
        case 'blacklisted':
            indicator.classList.add('blacklisted-rating');
            indicator.textContent = score; // Typically 10 for blacklisted
            break;
        case 'rated': // Default/normal rated
        default:
            indicator.classList.add('rated-rating'); // Add a general rated class
            indicator.textContent = score;
            break;
    }
}

/**
 * Toggles the visibility of a tooltip associated with an indicator
 * @param {HTMLElement} indicator - The indicator element
 */
function toggleTooltipVisibility(indicator) {
    const tooltip = indicator.scoreTooltip;
    if (!tooltip) return;
    
    if (tooltip.style.display === 'block') {
        // Don't close if pinned
        if (!tooltip.classList.contains('pinned')) {
            tooltip.style.display = 'none';
        }
    } else {
        positionTooltip(indicator, tooltip);
        tooltip.style.display = 'block';
    }
}

/**
 * Positions the tooltip relative to the indicator
 * @param {HTMLElement} indicator - The indicator element
 * @param {HTMLElement} tooltip - The tooltip element
 */
function positionTooltip(indicator, tooltip) {
    if (!indicator || !tooltip) return;
    
    const rect = indicator.getBoundingClientRect();
    const margin = 10;
    const isMobile = isMobileDevice();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const safeArea = viewportHeight - margin; // Safe area to stay within
    
    // Reset any previous height constraints to measure true dimensions
    tooltip.style.maxHeight = '';
    tooltip.style.overflowY = '';
    
    // Force layout recalculation to get true dimensions
    tooltip.style.display = 'block';
    tooltip.style.visibility = 'hidden';
    
    const tooltipWidth = tooltip.offsetWidth;
    const tooltipHeight = tooltip.offsetHeight;
    
    let left, top;
    
    if (isMobile) {
        // Center tooltip horizontally on mobile
        left = Math.max(0, (viewportWidth - tooltipWidth) / 2);
        
        // Always apply a max-height on mobile to ensure scrollability
        const maxTooltipHeight = viewportHeight * 0.8; // 80% of viewport
        
        // If tooltip is taller than allowed, constrain it and enable scrolling
        if (tooltipHeight > maxTooltipHeight) {
            tooltip.style.maxHeight = `${maxTooltipHeight}px`;
            tooltip.style.overflowY = 'scroll';
        }
        
        // Position at the bottom part of the screen
        top = (viewportHeight - tooltip.offsetHeight) / 2;
        
        // Ensure it's always fully visible
        if (top < margin) {
            top = margin;
        }
        if (top + tooltip.offsetHeight > safeArea) {
            top = safeArea - tooltip.offsetHeight;
        }
    } else {
        // Desktop positioning - to the right of indicator
        left = rect.right + margin;
        top = rect.top + (rect.height / 2) - (tooltipHeight / 2);
        
        // Check horizontal overflow
        if (left + tooltipWidth > viewportWidth - margin) {
            // Try positioning to the left of indicator
            left = rect.left - tooltipWidth - margin;
            
            // If that doesn't work either, center horizontally
            if (left < margin) {
                left = Math.max(margin, (viewportWidth - tooltipWidth) / 2);
                // And position below or above the indicator
                if (rect.bottom + tooltipHeight + margin <= safeArea) {
                    top = rect.bottom + margin;
                } else if (rect.top - tooltipHeight - margin >= margin) {
                    top = rect.top - tooltipHeight - margin;
                } else {
                    // If doesn't fit above or below, center vertically
                    top = margin;
                    // Apply max height and scrolling
                    tooltip.style.maxHeight = `${safeArea - (margin * 2)}px`;
                    tooltip.style.overflowY = 'scroll';
                }
            }
        }
        
        // Final vertical adjustment and scrolling if needed
        if (top < margin) {
            top = margin;
        }
        if (top + tooltipHeight > safeArea) {
            // If tooltip is too tall for the viewport, enable scrolling
            if (tooltipHeight > safeArea - margin) {
                top = margin;
                tooltip.style.maxHeight = `${safeArea - (margin * 2)}px`;
                tooltip.style.overflowY = 'scroll';
            } else {
                // Otherwise just move it up
                top = safeArea - tooltipHeight;
            }
        }
    }
    
    // Apply the position
    tooltip.style.position = 'fixed';
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.style.zIndex = '99999999';
    tooltip.style.visibility = 'visible';
    
    // Force scrollbars on WebKit browsers if needed
    if (tooltip.style.overflowY === 'scroll') {
        tooltip.style.WebkitOverflowScrolling = 'touch';
    }
    
    // Store the current scroll position to check if user has manually scrolled
    tooltip.lastScrollTop = tooltip.scrollTop;
    
    // Update scroll position for streaming tooltips
    if (tooltip.classList.contains('streaming-tooltip')) {
        // Only auto-scroll on initial display
        const isInitialDisplay = tooltip.lastDisplayTime === undefined || 
                               (Date.now() - tooltip.lastDisplayTime) > 1000;
        
        if (isInitialDisplay) {
            tooltip.dataset.autoScroll = 'true';
            // Use double requestAnimationFrame to ensure content is rendered
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    tooltip.scrollTo({
                        top: tooltip.scrollHeight,
                        behavior: 'instant'
                    });
                });
            });
        }
    }
    
    // Track when we displayed the tooltip
    tooltip.lastDisplayTime = Date.now();
}

/**
 * Detects if the user is on a mobile device
 * @returns {boolean} true if mobile device detected
 */
function isMobileDevice() {
    return (window.innerWidth <= 600 || 
            /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
}

/** 
 * This function is no longer needed as each indicator has its own tooltip 
 * It's kept for backward compatibility but is not used 
 */
function getScoreTooltip() {
    console.warn('getScoreTooltip is deprecated as each indicator now has its own tooltip');
    return null;
}

/** Formats description text for the tooltip. */
function formatTooltipDescription(description, reasoning = "") {
    description=description||"*waiting for content...*";
    
    // Add markdown-style formatting
    description = description.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>'); // Bold
    description = description.replace(/\*([^*]+)\*/g, '<em>$1</em>'); // Italic
    //h4
    description = description.replace(/^#### (.*)$/gm, '<h4>$1</h4>');
    //h3
    description = description.replace(/^### (.*)$/gm, '<h3>$1</h3>');
    //h2
    description = description.replace(/^## (.*)$/gm, '<h2>$1</h2>');
    //h1
    description = description.replace(/^# (.*)$/gm, '<h1>$1</h1>');
    
    // Basic formatting, can be expanded
    description = description.replace(/SCORE_(\d+)/g, '<span style="display:inline-block;background-color:#1d9bf0;color:white;padding:3px 10px;border-radius:9999px;margin:8px 0;font-weight:bold;">SCORE: $1</span>');
    description = description.replace(/\n\n/g, '<br><br>'); // Keep in single paragraph
    description = description.replace(/\n/g, '<br>');
    
    // Format reasoning trace with markdown support if provided
    let formattedReasoning = '';
    if (reasoning && reasoning.trim()) {
        formattedReasoning = reasoning
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>') // Bold
            .replace(/\*([^*]+)\*/g, '<em>$1</em>') // Italic
            .replace(/\n\n/g, '<br><br>') // Keep in single paragraph
            .replace(/\n/g, '<br>');
    }
    
    return {
        description: description,
        reasoning: formattedReasoning
    };
}

/**
 * Updates tooltip content during streaming
 * @param {HTMLElement} tooltip - The tooltip element to update
 * @param {string} description - Current description content
 * @param {string} reasoning - Current reasoning content
 */
function updateTooltipContent(tooltip, description, reasoning) {
    if (!tooltip) return;
    
    const formatted = formatTooltipDescription(description, reasoning);
    let contentChanged = false;
    
    // Update only the contents, not the structure
    const descriptionElement = tooltip.querySelector('.description-text');
    if (descriptionElement) {
        const oldContent = descriptionElement.innerHTML;
        descriptionElement.innerHTML = formatted.description;
        contentChanged = oldContent !== formatted.description;
    }
    
    const reasoningElement = tooltip.querySelector('.reasoning-text');
    if (reasoningElement && formatted.reasoning) {
        const oldReasoning = reasoningElement.innerHTML;
        reasoningElement.innerHTML = formatted.reasoning;
        contentChanged = contentChanged || oldReasoning !== formatted.reasoning;
        
        // Make reasoning dropdown visible only if there is content
        const dropdown = tooltip.querySelector('.reasoning-dropdown');
        if (dropdown) {
            dropdown.style.display = formatted.reasoning ? 'block' : 'none';
        }
    }
    
    // Handle auto-scrolling
    if (tooltip.style.display === 'block') {
        const isStreaming = tooltip.classList.contains('streaming-tooltip');
        const scrollButton = tooltip.querySelector('.scroll-to-bottom-button');
        
        // Calculate if we're near bottom before content update
        const wasNearBottom = tooltip.scrollHeight - tooltip.scrollTop - tooltip.clientHeight < (isMobileDevice() ? 40 : 55);
        
        // If content changed and we should auto-scroll
        if (contentChanged && (wasNearBottom || tooltip.dataset.autoScroll === 'true')) {
            // Use double requestAnimationFrame to ensure DOM has updated
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    // Recheck if we should still scroll (user might have scrolled during update)
                    if (tooltip.dataset.autoScroll === 'true') {
                        const targetScroll = tooltip.scrollHeight;
                        tooltip.scrollTo({
                            top: targetScroll,
                            behavior: 'instant' // Use instant to prevent interruption
                        });
                        
                        // Double-check scroll position after a small delay
                        setTimeout(() => {
                            if (tooltip.dataset.autoScroll === 'true') {
                                tooltip.scrollTop = tooltip.scrollHeight;
                            }
                        }, 50);
                    }
                });
            });
        }
        
        // Update scroll button visibility
        if (isStreaming && scrollButton) {
            const isNearBottom = tooltip.scrollHeight - tooltip.scrollTop - tooltip.clientHeight < (isMobileDevice() ? 40 : 55);
            scrollButton.style.display = isNearBottom ? 'none' : 'block';
        }
    }
}

/** Handles mouse enter event for score indicators. */
function handleIndicatorMouseEnter(event) {
    // Only use hover behavior on non-mobile
    if (isMobileDevice()) return;
    
    const indicator = event.currentTarget;
    const tooltip = indicator.scoreTooltip;
    if (!tooltip) return;
    
    // Get the tweet article
    const tweetArticle = indicator.closest('article[data-testid="tweet"]');
    const tweetId = tweetArticle ? getTweetID(tweetArticle) : null;
    
    // Position the tooltip
    positionTooltip(indicator, tooltip);
    tooltip.style.display = 'block';
    
    // Check if we have cached streaming content for this tweet
    if (tweetId && tweetCache.has(tweetId) && tweetCache.get(tweetId).description) {
        const reasoning = tweetCache.get(tweetId).reasoning || "";
        const formatted = formatTooltipDescription(tweetCache.get(tweetId).description, reasoning);
        
        // Update content using the proper elements
        const descriptionElement = tooltip.querySelector('.description-text');
        if (descriptionElement) {
            descriptionElement.innerHTML = formatted.description;
        }
        
        const reasoningElement = tooltip.querySelector('.reasoning-text');
        if (reasoningElement) {
            reasoningElement.innerHTML = formatted.reasoning;
            
            // Show/hide reasoning dropdown based on content
            const dropdown = tooltip.querySelector('.reasoning-dropdown');
            if (dropdown) {
                dropdown.style.display = formatted.reasoning ? 'block' : 'none';
            }
        }
        
        // Add streaming class if status is streaming
        if (tweetArticle?.dataset.ratingStatus === 'streaming' || tweetCache.get(tweetId).streaming === true) {
            tooltip.classList.add('streaming-tooltip');
            
            // Reset auto-scroll state for streaming tooltips when they're first shown
            tooltip.dataset.autoScroll = 'true';
            
            // Scroll to bottom immediately for streaming tooltips
            requestAnimationFrame(() => {
                tooltip.scrollTop = tooltip.scrollHeight;
                // Second scroll after a short delay to catch any new content
                setTimeout(() => {
                    tooltip.scrollTop = tooltip.scrollHeight;
                }, 150);
            });
            
            // Hide scroll button initially
            const scrollButton = tooltip.querySelector('.scroll-to-bottom-button');
            if (scrollButton) {
                scrollButton.style.display = 'none';
            }
        } else {
            tooltip.classList.remove('streaming-tooltip');
        }
    }
}

/** Handles mouse leave event for score indicators. */
function handleIndicatorMouseLeave(event) {
    // Only use hover behavior on non-mobile
    if (isMobileDevice()) return;
    
    const indicator = event.currentTarget;
    const tooltip = indicator.scoreTooltip;
    if (!tooltip) return;
    
    // Only hide if we're not moving to the tooltip itself and not pinned
    setTimeout(() => {
        if (tooltip && !tooltip.matches(':hover') && !tooltip.classList.contains('pinned')) {
            tooltip.style.display = 'none';
        }
    }, 100);
}

/** Cleans up the global score tooltip element. */
function cleanupDescriptionElements() {
    // Remove all tooltips that might be in the DOM
    document.querySelectorAll('.score-description').forEach(tooltip => {
        tooltip.remove();
    });
}

/**
 * Cleans up orphaned tooltips that no longer have a visible tweet or indicator.
 */
function cleanupOrphanedTooltips() {
    // Get all tooltips
    const tooltips = document.querySelectorAll('.score-description');
    
    tooltips.forEach(tooltip => {
        const tooltipTweetId = tooltip.dataset.tweetId;
        if (!tooltipTweetId) {
            // Remove tooltips without a tweet ID
            tooltip.remove();
            return;
        }

        // Find the corresponding indicator for this tooltip
        const indicator = document.querySelector(`.score-indicator[data-tweet-id="${tooltipTweetId}"]`) ||
                         document.querySelector(`article[data-testid="tweet"][data-tweet-id="${tooltipTweetId}"] .score-indicator`);
        
        // Only remove the tooltip if there's no indicator for it
        if (!indicator) {
            // Cancel any active streaming requests for this tweet
            if (window.activeStreamingRequests && window.activeStreamingRequests[tooltipTweetId]) {
                console.log(`Canceling streaming request for tweet ${tooltipTweetId} as its indicator was removed`);
                window.activeStreamingRequests[tooltipTweetId].abort();
                delete window.activeStreamingRequests[tooltipTweetId];
            }
            
            // Remove the tooltip
            tooltip.remove();
            console.log(`Removed orphaned tooltip for tweet ${tooltipTweetId} (no indicator found)`);
        }
    });
}

// Add a MutationObserver to watch for removed tweets
function initializeTooltipCleanup() {
    // Create a MutationObserver to watch for removed tweets
    const tweetObserver = new MutationObserver((mutations) => {
        let needsCleanup = false;
        
        mutations.forEach(mutation => {
            // Check for removed nodes that might be tweets or indicators
            mutation.removedNodes.forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    // Check if the removed node is a tweet or contains indicators
                    if (node.matches('.score-indicator') || 
                        node.querySelector('.score-indicator')) {
                        needsCleanup = true;
                    }
                }
            });
        });
        
        // Only run cleanup if we detected relevant DOM changes
        if (needsCleanup) {
            cleanupOrphanedTooltips();
        }
    });

    // Start observing the timeline with the configured parameters
    const observerConfig = {
        childList: true,
        subtree: true
    };

    // Find the main timeline container
    const timeline = document.querySelector('div[data-testid="primaryColumn"]');
    if (timeline) {
        tweetObserver.observe(timeline, observerConfig);
        console.log('Tweet removal observer initialized');
    }

    // Also keep the periodic cleanup as a backup, but with a longer interval
    setInterval(cleanupOrphanedTooltips, 10000);
}


/**
 * Resets all configurable settings to their default values.
 */
function resetSettings(noconfirm=false) {
    if (noconfirm || confirm('Are you sure you want to reset all settings to their default values? This will not clear your cached ratings or blacklisted handles.')) {
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

        refreshSettingsUI();
        fetchAvailableModels();
        showStatus('Settings reset to defaults');
    }
}

// --- Blacklist/Whitelist Logic ---

/**
 * Adds a handle to the blacklist, saves, and refreshes the UI.
 * @param {string} handle - The Twitter handle to add (with or without @).
 */
function addHandleToBlacklist(handle) {
    handle = handle.trim().replace(/^@/, ''); // Clean handle
    if (handle === '' || blacklistedHandles.includes(handle)) {
        showStatus(handle === '' ? 'Handle cannot be empty.' : `@${handle} is already on the list.`);
            return;
        }
    blacklistedHandles.push(handle);
    browserSet('blacklistedHandles', blacklistedHandles.join('\n'));
    refreshHandleList(document.getElementById('handle-list'));
    showStatus(`Added @${handle} to auto-rate list.`);
}

/**
 * Removes a handle from the blacklist, saves, and refreshes the UI.
 * @param {string} handle - The Twitter handle to remove (without @).
 */
function removeHandleFromBlacklist(handle) {
    const index = blacklistedHandles.indexOf(handle);
    if (index > -1) {
        blacklistedHandles.splice(index, 1);
        browserSet('blacklistedHandles', blacklistedHandles.join('\n'));
        refreshHandleList(document.getElementById('handle-list'));
        showStatus(`Removed @${handle} from auto-rate list.`);
                } else {
        console.warn(`Attempted to remove non-existent handle: ${handle}`);
    }
}

// --- Initialization ---

/**
 * Main initialization function for the UI module.
 */
function initialiseUI() {
    const uiContainer = injectUI();
    if (!uiContainer) return;

    initializeEventListeners(uiContainer);
    refreshSettingsUI();
    fetchAvailableModels();
    
    // Initialize the floating cache stats badge
    initializeFloatingCacheStats();
    
    setInterval(updateCacheStatsUI, 3000);
    // Initialize the tooltip cleanup system
    initializeTooltipCleanup();
    
    // Initialize tracking object for streaming requests if it doesn't exist
    if (!window.activeStreamingRequests) {
        window.activeStreamingRequests = {};
    }
}

/**
 * Creates or updates a floating badge showing the current cache statistics
 * This provides real-time feedback when tweets are rated and cached,
 * even when the settings panel is not open.
 */
function initializeFloatingCacheStats() {
    let statsBadge = document.getElementById('tweet-filter-stats-badge');
    
    if (!statsBadge) {
        statsBadge = document.createElement('div');
        statsBadge.id = 'tweet-filter-stats-badge';
        statsBadge.className = 'tweet-filter-stats-badge';
        statsBadge.style.cssText = `
            position: fixed;
            bottom: 50px;
            right: 20px;
            background-color: rgba(29, 155, 240, 0.9);
            color: white;
            padding: 5px 10px;
            border-radius: 15px;
            font-size: 12px;
            z-index: 9999;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            transition: opacity 0.3s;
            cursor: pointer;
            display: flex;
            align-items: center;
        `;
        
        // Add tooltip functionality
        statsBadge.title = 'Click to open settings';
        
        // Add click event to open settings
        statsBadge.addEventListener('click', () => {
            const settingsToggle = document.getElementById('settings-toggle');
            if (settingsToggle) {
                settingsToggle.click();
            }
        });
        
        document.body.appendChild(statsBadge);
        
        // Auto-hide after 5 seconds of inactivity
        let fadeTimeout;
        const resetFadeTimeout = () => {
            clearTimeout(fadeTimeout);
            statsBadge.style.opacity = '1';
            fadeTimeout = setTimeout(() => {
                statsBadge.style.opacity = '0.3';
            }, 5000);
        };
        
        statsBadge.addEventListener('mouseenter', () => {
            statsBadge.style.opacity = '1';
            clearTimeout(fadeTimeout);
        });
        
        statsBadge.addEventListener('mouseleave', resetFadeTimeout);
        
        resetFadeTimeout();
    }
    
    updateCacheStatsUI();
    // Make it visible and reset the timeout
    statsBadge.style.opacity = '1';
    clearTimeout(statsBadge.fadeTimeout);
    statsBadge.fadeTimeout = setTimeout(() => {
        statsBadge.style.opacity = '0.3';
    }, 5000);
}

