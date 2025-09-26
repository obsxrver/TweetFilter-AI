/**
 * Toggles the visibility of an element and updates the corresponding toggle button text.
 * @param {HTMLElement} element - The element to toggle.
 * @param {HTMLElement} toggleButton - The button that controls the toggle.
 * @param {string} openText - Text for the button when the element is open.
 * @param {string} closedText - Text for the button when the element is closed.
 */
function toggleElementVisibility(element, toggleButton, openText, closedText) {
    if (!element || !toggleButton) return;

    const isCurrentlyHidden = element.classList.contains('hidden');

    toggleButton.innerHTML = isCurrentlyHidden ? openText : closedText;

    if (isCurrentlyHidden) {

        element.style.display = 'flex';

        element.offsetHeight;
        element.classList.remove('hidden');
    } else {

        element.classList.add('hidden');

        setTimeout(() => {
            if (element.classList.contains('hidden')) {
                element.style.display = 'none';
            }
        }, 500);
    }

    if (element.id === 'settings-container' && toggleButton.id === 'settings-toggle') {
        if (isMobileDevice()) {
            if (element.classList.contains('hidden')) {
                toggleButton.style.opacity = '0.3';
            } else {
                toggleButton.style.opacity = '';
            }
        } else {

            toggleButton.style.opacity = '';
        }
    }

    if (element.id === 'tweet-filter-container') {
        const filterToggle = document.getElementById('filter-toggle');
        if (filterToggle) {
            if (!isCurrentlyHidden) {
                setTimeout(() => {
                    filterToggle.style.display = 'block';
                }, 500);
            } else {
                filterToggle.style.display = 'none';
            }
        }
    }
}

/**
 * Injects the UI elements from the HTML resource into the page.
 */
function injectUI() {

    let menuHTML;
    if (MENU) {
        menuHTML = MENU;
    } else {
        menuHTML = browserGet('menuHTML');
    }
    if (!menuHTML) {
        console.error('Failed to load Menu.html resource!');
        showStatus('Error: Could not load UI components.');
        return null;
    }

    const containerId = 'tweetfilter-root-container';
    let uiContainer = document.getElementById(containerId);
    if (uiContainer) {
        console.warn('UI container already exists. Skipping injection.');
        return uiContainer;
    }

    uiContainer = document.createElement('div');
    uiContainer.id = containerId;
    uiContainer.innerHTML = menuHTML;

    document.body.appendChild(uiContainer);
    console.log('TweetFilter UI Injected from HTML resource.');

    const versionInfo = uiContainer.querySelector('#version-info');
    if (versionInfo) {
        versionInfo.textContent = `Twitter De-Sloppifier v${VERSION}`;
    }

    return uiContainer;
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

    uiContainer.addEventListener('click', (event) => {
        const target = event.target;
        const actionElement = target.closest('[data-action]');
        const action = actionElement?.dataset.action;
        const setting = target.dataset.setting;
        const paramName = target.closest('.parameter-row')?.dataset.paramName;
        const tab = target.dataset.tab;
        const toggleTargetId = target.closest('[data-toggle]')?.dataset.toggle;

        if (action) {
            switch (action) {
                case 'close-filter':
                    toggleElementVisibility(filterContainer, filterToggleBtn, 'Filter Slider', 'Filter Slider');
                    break;
                case 'toggle-settings':
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
                    resetSettings(isMobileDevice());
                    break;
                case 'save-instructions':
                    saveInstructions();
                    break;
                case 'add-handle':
                    addHandleFromInput();
                    break;
                case 'clear-instructions-history':
                    clearInstructionsHistory();
                    break;
                case 'export-cache':
                    exportCacheToJson();
                    break;
            }
        }

        if (target.classList.contains('remove-handle')) {
            const handleItem = target.closest('.handle-item');
            const handleTextElement = handleItem?.querySelector('.handle-text');
            if (handleTextElement) {
                const handle = handleTextElement.textContent.substring(1);
                removeHandleFromBlacklist(handle);
            }
        }

        if (tab) {
            switchTab(tab);
        }

        if (toggleTargetId) {
            toggleAdvancedOptions(toggleTargetId);
        }
    });

    uiContainer.addEventListener('input', (event) => {
        const target = event.target;
        const setting = target.dataset.setting;
        const paramName = target.closest('.parameter-row')?.dataset.paramName;

        if (setting) {
            handleSettingChange(target, setting);
        }

        if (paramName) {
            handleParameterChange(target, paramName);
        }

        if (target.id === 'tweet-filter-slider') {
            handleFilterSliderChange(target);
        }
        if (target.id === 'tweet-filter-value') {
            handleFilterValueInput(target);
        }
    });

    uiContainer.addEventListener('change', (event) => {
        const target = event.target;
        const setting = target.dataset.setting;

        if (setting === 'modelSortOrder') {
            handleSettingChange(target, setting);
            fetchAvailableModels();
        }

        if (setting === 'enableImageDescriptions') {
            handleSettingChange(target, setting);
        }
    });

    if (filterToggleBtn) {
        filterToggleBtn.onclick = () => {
            if (filterContainer) {
                filterContainer.style.display = 'flex';

                filterContainer.offsetHeight;
                filterContainer.classList.remove('hidden');
            }
            filterToggleBtn.style.display = 'none';
        };
    }

    document.addEventListener('click', closeAllSelectBoxes);

    const showFreeModelsCheckbox = uiContainer.querySelector('#show-free-models');
    if (showFreeModelsCheckbox) {
        showFreeModelsCheckbox.addEventListener('change', function () {
            showFreeModels = this.checked;
            browserSet('showFreeModels', showFreeModels);
            refreshModelsUI();
        });
    }

    const sortDirectionBtn = uiContainer.querySelector('#sort-direction');
    if (sortDirectionBtn) {
        sortDirectionBtn.addEventListener('click', function () {
            const currentDirection = browserGet('sortDirection', 'default');
            const newDirection = currentDirection === 'default' ? 'reverse' : 'default';
            browserSet('sortDirection', newDirection);
            this.dataset.value = newDirection;
            refreshModelsUI();
        });
    }

    const modelSortSelect = uiContainer.querySelector('#model-sort-order');
    if (modelSortSelect) {
        modelSortSelect.addEventListener('change', function () {
            browserSet('modelSortOrder', this.value);

            if (this.value === 'latency-low-to-high') {
                browserSet('sortDirection', 'default');
            } else if (this.value === '') {
                browserSet('sortDirection', 'default');
            }
            refreshModelsUI();
        });
    }

    const providerSortSelect = uiContainer.querySelector('#provider-sort');
    if (providerSortSelect) {
        providerSortSelect.addEventListener('change', function () {
            providerSort = this.value;
            browserSet('providerSort', providerSort);
        });
    }

    console.log('UI events wired.');
}

/** Saves the API key from the input field. */
function saveApiKey() {
    const apiKeyInput = document.getElementById('openrouter-api-key');
    const apiKey = apiKeyInput.value.trim();
    let previousAPIKey = browserGet('openrouter-api-key', '').length > 0 ? true : false;
    if (apiKey) {
        if (!previousAPIKey) {
            resetSettings(true);

        }
        browserSet('openrouter-api-key', apiKey);
        showStatus('API key saved successfully!');
        fetchAvailableModels();

        location.reload();
    } else {
        showStatus('Please enter a valid API key');
    }
}

/**
 * Exports the current tweet cache to a JSON file.
 */
function exportCacheToJson() {
    if (!tweetCache) {
        showStatus('Error: Tweet cache not found.', 'error');
        return;
    }

    try {
        const cacheData = tweetCache.cache;
        if (!cacheData || Object.keys(cacheData).length === 0) {
            showStatus('Cache is empty. Nothing to export.', 'warning');
            return;
        }

        const jsonString = JSON.stringify(cacheData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        link.setAttribute('download', `tweet-filter-cache-${timestamp}.json`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        showStatus(`Cache exported successfully (${Object.keys(cacheData).length} items).`);
    } catch (error) {
        console.error('Error exporting cache:', error);
        showStatus('Error exporting cache. Check console for details.', 'error');
    }
}

/** Clears tweet ratings and updates the relevant UI parts. */
function clearTweetRatingsAndRefreshUI() {
    if (isMobileDevice() || confirm('Are you sure you want to clear all cached tweet ratings?')) {

        tweetCache.clear(true);

        pendingRequests = 0;

        if (window.threadRelationships) {
            window.threadRelationships = {};
            browserSet('threadRelationships', '{}');
            console.log('Cleared thread relationships cache');
        }

        showStatus('All cached ratings and thread relationships cleared!');
        console.log('Cleared all tweet ratings and thread relationships');

        if (observedTargetNode) {
            observedTargetNode.querySelectorAll('article[data-testid="tweet"]').forEach(tweet => {
                tweet.removeAttribute('data-slop-score');
                tweet.removeAttribute('data-rating-status');
                tweet.removeAttribute('data-rating-description');
                tweet.removeAttribute('data-cached-rating');
                const indicator = tweet.querySelector('.score-indicator');
                if (indicator) {
                    indicator.remove();
                }

                const tweetId = getTweetID(tweet);
                if (tweetId) {
                    processedTweets.delete(tweetId);

                    const indicatorInstance = ScoreIndicatorRegistry.get(tweetId);
                    if (indicatorInstance) {
                        indicatorInstance.destroy();
                    }
                    scheduleTweetProcessing(tweet);
                }
            });
        }

        document.querySelectorAll('div[aria-label="Timeline: Conversation"], div[aria-label^="Timeline: Conversation"]').forEach(conversation => {
            delete conversation.dataset.threadMapping;
            delete conversation.dataset.threadMappedAt;
            delete conversation.dataset.threadMappingInProgress;
            delete conversation.dataset.threadHist;
            delete conversation.dataset.threadMediaUrls;
        });

    }
}

/** Adds a handle from the input field to the blacklist. */
function addHandleFromInput() {
    const handleInput = document.getElementById('handle-input');
    const handle = handleInput.value.trim();
    if (handle) {
        addHandleToBlacklist(handle);
        handleInput.value = '';
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

    if (window[settingName] !== undefined) {
        window[settingName] = value;
    }

    browserSet(settingName, value);

    if (settingName === 'enableImageDescriptions') {
        const imageModelContainer = document.getElementById('image-model-container');
        if (imageModelContainer) {
            imageModelContainer.style.display = value ? 'block' : 'none';
        }
        showStatus('Image descriptions ' + (value ? 'enabled' : 'disabled'));
    }
    if (settingName === 'enableWebSearch') {
        showStatus('Web search for rating model ' + (value ? 'enabled' : 'disabled'));
    }

    if (settingName === 'enableAutoRating') {
        showStatus('Auto-rating ' + (value ? 'enabled' : 'disabled'));
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

    if (target.type === 'number' && !isNaN(newValue)) {
        newValue = Math.max(min, Math.min(max, newValue));
    }

    if (slider && valueInput) {
        slider.value = newValue;
        valueInput.value = newValue;
    }

    if (window[paramName] !== undefined) {
        window[paramName] = newValue;
    }

    browserSet(paramName, newValue);
}

/**
 * Handles changes to the main filter slider.
 * @param {HTMLElement} slider - The filter slider element.
 */
function handleFilterSliderChange(slider) {
    const valueInput = document.getElementById('tweet-filter-value');
    currentFilterThreshold = parseInt(slider.value, 10);
    if (valueInput) {
        valueInput.value = currentFilterThreshold.toString();
    }

    const percentage = (currentFilterThreshold / 10) * 100;
    slider.style.setProperty('--slider-percent', `${percentage}%`);

    browserSet('filterThreshold', currentFilterThreshold);
    applyFilteringToAll();
}

/**
 * Handles changes to the numeric input for filter threshold.
 * @param {HTMLElement} input - The numeric input element.
 */
function handleFilterValueInput(input) {
    let value = parseInt(input.value, 10);

    value = Math.max(0, Math.min(10, value));
    input.value = value.toString();

    const slider = document.getElementById('tweet-filter-slider');
    if (slider) {
        slider.value = value.toString();

        const percentage = (value / 10) * 100;
        slider.style.setProperty('--slider-percent', `${percentage}%`);
    }

    currentFilterThreshold = value;
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

    document.querySelectorAll('[data-setting]').forEach(input => {
        const settingName = input.dataset.setting;
        const value = browserGet(settingName, window[settingName]);
        if (input.type === 'checkbox') {
            input.checked = value;

            handleSettingChange(input, settingName);
        } else {
            input.value = value;
        }
    });

    document.querySelectorAll('.parameter-row[data-param-name]').forEach(row => {
        const paramName = row.dataset.paramName;
        const slider = row.querySelector('.parameter-slider');
        const valueInput = row.querySelector('.parameter-value');
        const value = browserGet(paramName, window[paramName]);

        if (slider) slider.value = value;
        if (valueInput) valueInput.value = value;
    });

    const filterSlider = document.getElementById('tweet-filter-slider');
    const filterValueInput = document.getElementById('tweet-filter-value');
    const currentThreshold = browserGet('filterThreshold', '5');

    if (filterSlider && filterValueInput) {
        filterSlider.value = currentThreshold;
        filterValueInput.value = currentThreshold;

        const percentage = (parseInt(currentThreshold, 10) / 10) * 100;
        filterSlider.style.setProperty('--slider-percent', `${percentage}%`);
    }

    refreshHandleList(document.getElementById('handle-list'));
    refreshModelsUI();

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

    refreshInstructionsHistory();
}

/**
 * Refreshes the handle list UI.
 * @param {HTMLElement} listElement - The list element to refresh.
 */
function refreshHandleList(listElement) {
    if (!listElement) return;

    listElement.innerHTML = '';

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

    listedModels = [...availableModels];

    if (!showFreeModels) {
        listedModels = listedModels.filter(model => !model.slug.endsWith(':free'));
    }

    const sortDirection = browserGet('sortDirection', 'default');
    const sortOrder = browserGet('modelSortOrder', 'throughput-high-to-low');

    const toggleBtn = document.getElementById('sort-direction');
    if (toggleBtn) {
        switch (sortOrder) {
            case 'latency-low-to-high':
                toggleBtn.textContent = sortDirection === 'default' ? 'High-Low' : 'Low-High';
                if (sortDirection === 'reverse') listedModels.reverse();
                break;
            case '':
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

    if (modelSelectContainer) {
        modelSelectContainer.innerHTML = '';
        createCustomSelect(
            modelSelectContainer,
            'model-selector',
            listedModels.map(model => ({ value: model.endpoint?.model_variant_slug || model.id, label: formatModelLabel(model) })),
            selectedModel,
            (newValue) => {
                selectedModel = newValue;
                browserSet('selectedModel', selectedModel);
                showStatus('Rating model updated');
            },
            'Search rating models...'
        );
    }

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
            visionModels.map(model => ({ value: model.endpoint?.model_variant_slug || model.id, label: formatModelLabel(model) })),
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
    let label = model.endpoint?.model_variant_slug || model.id || model.name || 'Unknown Model';
    let pricingInfo = '';

    const pricing = model.endpoint?.pricing || model.pricing;
    if (pricing) {
        const promptPrice = parseFloat(pricing.prompt);
        const completionPrice = parseFloat(pricing.completion);

        if (!isNaN(promptPrice)) {
            pricingInfo += ` - $${(promptPrice * 1e6).toFixed(4)}/mil. tok.-in`;
            if (!isNaN(completionPrice) && completionPrice !== promptPrice) {
                pricingInfo += ` $${(completionPrice * 1e6).toFixed(4)}/mil. tok.-out`;
            }
        } else if (!isNaN(completionPrice)) {

            pricingInfo += ` - $${(completionPrice * 1e6).toFixed(4)}/mil. tok.-out`;
        }
    }

    const isVision = model.input_modalities?.includes('image') ||
        model.architecture?.input_modalities?.includes('image') ||
        model.architecture?.modality?.includes('image');
    if (isVision) {
        label = '🖼️ ' + label;
    }

    return label + pricingInfo;
}

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
    selectItems.style.display = 'none';

    const searchField = document.createElement('div');
    searchField.className = 'search-field';
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'search-input';
    searchInput.placeholder = searchPlaceholder || 'Search...';
    searchField.appendChild(searchInput);
    selectItems.appendChild(searchField);

    function renderOptions(filter = '') {

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
                e.stopPropagation();
                currentSelectedValue = option.value;
                selectSelected.textContent = option.label;
                selectItems.style.display = 'none';
                selectSelected.classList.remove('select-arrow-active');

                selectItems.querySelectorAll('div[data-value]').forEach(div => {
                    div.classList.toggle('same-as-selected', div.dataset.value === currentSelectedValue);
                });

                onChange(currentSelectedValue);
            });
            selectItems.appendChild(optionDiv);
        });
    }

    const initialOption = options.find(opt => opt.value === currentSelectedValue);
    selectSelected.textContent = initialOption ? initialOption.label : 'Select an option';

    customSelect.appendChild(selectSelected);
    customSelect.appendChild(selectItems);
    container.appendChild(customSelect);

    renderOptions();

    searchInput.addEventListener('input', () => renderOptions(searchInput.value));
    searchInput.addEventListener('click', e => e.stopPropagation());

    selectSelected.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAllSelectBoxes(customSelect);
        const isHidden = selectItems.style.display === 'none';
        selectItems.style.display = isHidden ? 'block' : 'none';
        selectSelected.classList.toggle('select-arrow-active', isHidden);
        if (isHidden) {
            searchInput.focus();
            searchInput.select();
            renderOptions(searchInput.value);
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

/**
 * Resets all configurable settings to their default values.
 */
function resetSettings(noconfirm = false) {
    if (noconfirm || confirm('Are you sure you want to reset all settings to their default values? This will not clear your cached ratings, blacklisted handles, or instruction history.')) {
        tweetCache.clear();

        const defaults = {
            selectedModel: 'openai/gpt-4.1-nano',
            selectedImageModel: 'openai/gpt-4.1-nano',
            enableImageDescriptions: false,
            enableStreaming: true,
            enableWebSearch: false,
            enableAutoRating: true,
            modelTemperature: 0.5,
            modelTopP: 0.9,
            imageModelTemperature: 0.5,
            imageModelTopP: 0.9,
            maxTokens: 0,
            filterThreshold: 5,
            userDefinedInstructions: 'Rate the tweet on a scale from 1 to 10 based on its clarity, insight, creativity, and overall quality.',
            modelSortOrder: 'throughput-high-to-low',
            sortDirection: 'default'
        };

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

/**
 * Adds a handle to the blacklist, saves, and refreshes the UI.
 * @param {string} handle - The Twitter handle to add (with or without @).
 */
function addHandleToBlacklist(handle) {
    handle = handle.trim().replace(/^@/, '');
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
    } else console.warn(`Attempted to remove non-existent handle: ${handle}`);

}

/**
 * Main initialization function for the UI module.
 */
function initialiseUI() {
    const uiContainer = injectUI();
    if (!uiContainer) return;

    initializeEventListeners(uiContainer);
    refreshSettingsUI();
    fetchAvailableModels();

    initializeFloatingCacheStats();

    setInterval(updateCacheStatsUI, 3000);

    if (!window.activeStreamingRequests) window.activeStreamingRequests = {};
}

/**
 * Initializes event listeners and functionality for the floating cache stats badge.
 * This provides real-time feedback when tweets are rated and cached,
 * even when the settings panel is not open.
 */
function initializeFloatingCacheStats() {
    const statsBadge = document.getElementById('tweet-filter-stats-badge');
    if (!statsBadge) return;

    statsBadge.title = 'Click to open settings';

    statsBadge.addEventListener('click', () => {
        const settingsToggle = document.getElementById('settings-toggle');
        if (settingsToggle) {
            settingsToggle.click();
        }
    });

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
    updateCacheStatsUI();
}

