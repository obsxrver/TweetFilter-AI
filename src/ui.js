// --- Constants ---
const VERSION = '1.2.3r4'; // Update version here

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
    let menuHTML = GM_getValue('menuHTML');
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
                case 'export-settings':
                    exportSettings();
                    break;
                case 'import-settings':
                    importSettings();
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

    console.log('UI events wired.');
}

// --- Event Handlers ---

/** Saves the API key from the input field. */
function saveApiKey() {
    const apiKeyInput = document.getElementById('openrouter-api-key');
    const apiKey = apiKeyInput.value.trim();
    if (apiKey) {
        GM_setValue('openrouter-api-key', apiKey);
        showStatus('API key saved successfully!');
        fetchAvailableModels(); // Refresh model list
    } else {
        showStatus('Please enter a valid API key');
    }
}

/** Clears tweet ratings and updates the relevant UI parts. */
function clearTweetRatingsAndRefreshUI() {
    if (confirm('Are you sure you want to clear all cached tweet ratings?')) {
        Object.keys(tweetIDRatingCache).forEach(key => delete tweetIDRatingCache[key]);
        GM_setValue('tweetRatings', '{}');
        showStatus('All cached ratings cleared!');
        console.log('Cleared all tweet ratings');

        updateCacheStatsUI();

        // Re-process visible tweets
        if (observedTargetNode) {
            observedTargetNode.querySelectorAll(TWEET_ARTICLE_SELECTOR).forEach(tweet => {
                tweet.dataset.sloppinessScore = ''; // Clear potential old score attribute
                delete tweet.dataset.cachedRating;
                delete tweet.dataset.blacklisted;
                processedTweets.delete(getTweetID(tweet));
                scheduleTweetProcessing(tweet);
            });
        }
    }
}

/** Saves the custom instructions from the textarea. */
function saveInstructions() {
    const instructionsTextarea = document.getElementById('user-instructions');
    USER_DEFINED_INSTRUCTIONS = instructionsTextarea.value;
    GM_setValue('userDefinedInstructions', USER_DEFINED_INSTRUCTIONS);
    showStatus('Scoring instructions saved! New tweets will use these instructions.');
    if (confirm('Do you want to clear the rating cache to apply these instructions to all tweets?')) {
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
    GM_setValue(settingName, value);

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
    GM_setValue(paramName, newValue);
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
    GM_setValue('filterThreshold', currentFilterThreshold);
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

// --- UI Update Functions ---

/** Updates the cache statistics display in the General tab. */
function updateCacheStatsUI() {
    const cachedCountEl = document.getElementById('cached-ratings-count');
    const whitelistedCountEl = document.getElementById('whitelisted-handles-count');

    if (cachedCountEl) {
        cachedCountEl.textContent = Object.keys(tweetIDRatingCache).length;
    }
    if (whitelistedCountEl) {
        whitelistedCountEl.textContent = blacklistedHandles.length;
    }
}

/**
 * Refreshes the entire settings UI to reflect current settings.
 */
function refreshSettingsUI() {
    // Update general settings inputs/toggles
    document.querySelectorAll('[data-setting]').forEach(input => {
        const settingName = input.dataset.setting;
        const value = GM_getValue(settingName, window[settingName]); // Get saved or default value
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
        const value = GM_getValue(paramName, window[paramName]);

        if (slider) slider.value = value;
        if (valueInput) valueInput.value = value;
    });

    // Update filter slider
    const filterSlider = document.getElementById('tweet-filter-slider');
    const filterValueDisplay = document.getElementById('tweet-filter-value');
    if (filterSlider && filterValueDisplay) {
        filterSlider.value = currentFilterThreshold.toString();
        filterValueDisplay.textContent = currentFilterThreshold.toString();
    }

    // Refresh dynamically populated lists/dropdowns
        refreshHandleList(document.getElementById('handle-list'));
    refreshModelsUI(); // Refreshes model dropdowns

    // Update cache stats
    updateCacheStatsUI();

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

    const models = availableModels || []; // Ensure availableModels is an array

    // Update main model selector
    if (modelSelectContainer) {
        modelSelectContainer.innerHTML = ''; // Clear current
    createCustomSelect(
        modelSelectContainer,
            'model-selector', // ID for the custom select element
            models.map(model => ({ value: model.slug || model.id, label: formatModelLabel(model) })),
            selectedModel, // Current selected value
            (newValue) => { // onChange callback
            selectedModel = newValue;
            GM_setValue('selectedModel', selectedModel);
            showStatus('Rating model updated');
        },
            'Search rating models...' // Placeholder
        );
    }

    // Update image model selector
    if (imageModelSelectContainer) {
        const visionModels = models.filter(model =>
            model.input_modalities?.includes('image') ||
            model.architecture?.input_modalities?.includes('image') ||
            model.architecture?.modality?.includes('image')
        );

        imageModelSelectContainer.innerHTML = ''; // Clear current
    createCustomSelect(
        imageModelSelectContainer,
            'image-model-selector', // ID for the custom select element
            visionModels.map(model => ({ value: model.slug || model.id, label: formatModelLabel(model) })),
            selectedImageModel, // Current selected value
            (newValue) => { // onChange callback
            selectedImageModel = newValue;
            GM_setValue('selectedImageModel', selectedImageModel);
            showStatus('Image model updated');
        },
            'Search vision models...' // Placeholder
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
            pricingInfo += ` - $${promptPrice.toFixed(7)}/in`;
            if (!isNaN(completionPrice) && completionPrice !== promptPrice) {
                pricingInfo += ` $${completionPrice.toFixed(7)}/out`;
            }
        } else if (!isNaN(completionPrice)) {
            // Handle case where only completion price is available (less common)
            pricingInfo += ` - $${completionPrice.toFixed(7)}/out`;
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
 * @param {string} status - 'pending', 'rated', 'error', 'cached', 'blacklisted'.
 * @param {string} [description] - Optional description for hover tooltip.
 */
function setScoreIndicator(tweetArticle, score, status, description = "") {
    let indicator = tweetArticle.querySelector('.score-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.className = 'score-indicator';
        tweetArticle.style.position = 'relative'; // Ensure parent is positioned
        tweetArticle.appendChild(indicator);
        
        // Add hover listeners only once when creating the indicator
        indicator.addEventListener('mouseenter', handleIndicatorMouseEnter);
        indicator.addEventListener('mouseleave', handleIndicatorMouseLeave);
    }

    // Update status class and text content
    indicator.classList.remove('pending-rating', 'rated-rating', 'error-rating', 'cached-rating', 'blacklisted-rating'); // Clear previous
    indicator.dataset.description = description || ''; // Store description

    switch (status) {
        case 'pending':
        indicator.classList.add('pending-rating');
        indicator.textContent = '⏳';
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

/** Global tooltip element */
let scoreTooltip = null;

/** Creates or gets the shared tooltip element. */
function getScoreTooltip() {
    if (!scoreTooltip) {
        scoreTooltip = document.createElement('div');
        scoreTooltip.className = 'score-description'; // Use the class from HTML/CSS
        scoreTooltip.style.display = 'none'; // Initially hidden
        scoreTooltip.style.position = 'fixed'; // Use fixed positioning
        scoreTooltip.style.zIndex = '99999999';
        document.body.appendChild(scoreTooltip);

        // Keep tooltip visible when hovering over it
        scoreTooltip.addEventListener('mouseenter', () => {
            scoreTooltip.style.display = 'block';
        });
        scoreTooltip.addEventListener('mouseleave', () => {
            scoreTooltip.style.display = 'none';
        });
    }
    return scoreTooltip;
}

/** Formats description text for the tooltip. */
function formatTooltipDescription(description) {
    if (!description) return '';
    // Basic formatting, can be expanded
        description = description.replace(/\{score:\s*(\d+)\}/g, '<span style="display:inline-block;background-color:#1d9bf0;color:white;padding:3px 10px;border-radius:9999px;margin:8px 0;font-weight:bold;">SCORE: $1</span>');
    description = description.replace(/\n\n/g, '</p><p style="margin-top: 10px;">'); // Smaller margin
        description = description.replace(/\n/g, '<br>');
    return `<p>${description}</p>`;
}

/** Handles mouse enter event for score indicators. */
function handleIndicatorMouseEnter(event) {
    const indicator = event.target;
    const description = indicator.dataset.description;
    if (!description) return;

    const tooltip = getScoreTooltip();
    tooltip.innerHTML = formatTooltipDescription(description);

    // Position the tooltip
        const rect = indicator.getBoundingClientRect();
    const tooltipWidth = tooltip.offsetWidth; // Get width after setting content
    const tooltipHeight = tooltip.offsetHeight;
    const margin = 10;

    let left = rect.right + margin;
    let top = rect.top + (rect.height / 2) - (tooltipHeight / 2);

    // Adjust if going off-screen
    if (left + tooltipWidth > window.innerWidth - margin) {
        left = rect.left - tooltipWidth - margin;
    }
    if (top < margin) {
        top = margin;
    }
    if (top + tooltipHeight > window.innerHeight - margin) {
        top = window.innerHeight - tooltipHeight - margin;
    }

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.style.display = 'block';
}

/** Handles mouse leave event for score indicators. */
function handleIndicatorMouseLeave() {
    const tooltip = getScoreTooltip();
    // Hide with a slight delay to allow moving cursor to the tooltip
        setTimeout(() => {
        if (tooltip && tooltip.style.display !== 'none' && !tooltip.matches(':hover')) {
           tooltip.style.display = 'none';
        }
        }, 100);
}

/** Cleans up the global score tooltip element. */
function cleanupDescriptionElements() {
    if (scoreTooltip) {
        scoreTooltip.remove();
        scoreTooltip = null;
    }
}

// --- Settings Import/Export (Simplified) ---

/**
 * Exports all settings and cache to a JSON file.
 */
function exportSettings() {
    try {
        const settingsToExport = {
            apiKey: GM_getValue('openrouter-api-key', ''),
            selectedModel: GM_getValue('selectedModel', 'google/gemini-flash-1.5-8b'),
            selectedImageModel: GM_getValue('selectedImageModel', 'google/gemini-flash-1.5-8b'),
            enableImageDescriptions: GM_getValue('enableImageDescriptions', false),
            modelTemperature: GM_getValue('modelTemperature', 0.5),
            modelTopP: GM_getValue('modelTopP', 0.9),
            imageModelTemperature: GM_getValue('imageModelTemperature', 0.5),
            imageModelTopP: GM_getValue('imageModelTopP', 0.9),
            maxTokens: GM_getValue('maxTokens', 0),
            filterThreshold: GM_getValue('filterThreshold', 1),
            userDefinedInstructions: GM_getValue('userDefinedInstructions', 'Rate the tweet on a scale from 1 to 10 based on its clarity, insight, creativity, and overall quality.'),
            modelSortOrder: GM_getValue('modelSortOrder', 'throughput-high-to-low')
        };

        const data = {
            version: VERSION,
            date: new Date().toISOString(),
            settings: settingsToExport,
            blacklistedHandles: blacklistedHandles || [],
            tweetRatings: tweetIDRatingCache || {}
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tweetfilter-ai-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showStatus('Settings exported successfully!');
    } catch (error) {
        console.error('Error exporting settings:', error);
        showStatus('Error exporting settings: ' + error.message);
    }
}

/**
 * Imports settings and cache from a JSON file.
 */
function importSettings() {
    try {
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
                    if (!data.settings) throw new Error('Invalid backup file format');

                    // Import settings
                    for (const key in data.settings) {
                        if (window[key] !== undefined) {
                            window[key] = data.settings[key];
                        }
                        GM_setValue(key, data.settings[key]);
                    }

                    // Import blacklisted handles
                    if (data.blacklistedHandles && Array.isArray(data.blacklistedHandles)) {
                        blacklistedHandles = data.blacklistedHandles;
                        GM_setValue('blacklistedHandles', blacklistedHandles.join('\n'));
                    }

                    // Import tweet ratings (merge with existing)
                    if (data.tweetRatings && typeof data.tweetRatings === 'object') {
                        Object.assign(tweetIDRatingCache, data.tweetRatings);
                        saveTweetRatings();
                    }

                    refreshSettingsUI();
                    fetchAvailableModels();
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
 * Resets all configurable settings to their default values.
 */
function resetSettings() {
    if (confirm('Are you sure you want to reset all settings to their default values? This will not clear your cached ratings or blacklisted handles.')) {
        // Define defaults (should match config.js ideally)
        const defaults = {
            selectedModel: 'google/gemini-flash-1.5-8b',
            selectedImageModel: 'google/gemini-flash-1.5-8b',
            enableImageDescriptions: false,
            modelTemperature: 0.5,
            modelTopP: 0.9,
            imageModelTemperature: 0.5,
            imageModelTopP: 0.9,
            maxTokens: 0,
            filterThreshold: 1,
            userDefinedInstructions: 'Rate the tweet on a scale from 1 to 10 based on its clarity, insight, creativity, and overall quality.',
            modelSortOrder: 'throughput-high-to-low'
        };

        // Apply defaults
        for (const key in defaults) {
            if (window[key] !== undefined) {
                window[key] = defaults[key];
            }
            GM_setValue(key, defaults[key]);
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
    GM_setValue('blacklistedHandles', blacklistedHandles.join('\n'));
    refreshHandleList(document.getElementById('handle-list'));
    updateCacheStatsUI();
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
        GM_setValue('blacklistedHandles', blacklistedHandles.join('\n'));
        refreshHandleList(document.getElementById('handle-list'));
        updateCacheStatsUI();
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
    if (!uiContainer) return; // Stop if injection failed

    initializeEventListeners(uiContainer);
    refreshSettingsUI(); // Set initial state from saved settings
    fetchAvailableModels(); // Fetch models async
}
