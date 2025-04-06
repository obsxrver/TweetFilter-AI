// ==UserScript==
// @name         X/Twitter De-Sloppifier
// @namespace    http://tampermonkey.net/
// @version      Version 1.0
// @description  Advanced tweet rating and filtering with model search, enhanced rating indicator, API retry functionalities, and blacklist support.
// @author       Obsxrver
// @match        *://twitter.com/*
// @match        *://x.com/*
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @connect      openrouter.ai
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    console.log("X/Twitter Tweet De-Sloppification Activated (v5.1 - Enhanced)");

    // ----- Global Variables & Caches -----
    const processedTweets = new Set(); // Set of tweet IDs already processed in this session
    const tweetIDRatingCache = {}; // ID-based cache for persistent storage
    const PROCESSING_DELAY_MS = 1000; // Delay before processing a tweet (ms)
    const API_CALL_DELAY_MS = 2000; // Minimum delay between API calls (ms)
    let USER_DEFINED_INSTRUCTIONS = GM_getValue('userDefinedInstructions', '');
    let currentFilterThreshold = GM_getValue('filterThreshold', 1); // Filter threshold for tweet visibility
    let observedTargetNode = null;
    let lastAPICallTime = 0;
    let pendingRequests = 0;
    let availableModels = []; // List of models fetched from API
    let selectedModel = GM_getValue('selectedModel', 'deepseek/deepseek-r1-distill-llama-70b');
    let selectedImageModel = GM_getValue('selectedImageModel', 'openrouter/quasar-alpha');
    let blacklistedHandles = GM_getValue('blacklistedHandles', '').split('\n').filter(h => h.trim() !== '');
    
    // Model parameters
    let modelTemperature = GM_getValue('modelTemperature', 0.7);
    let modelTopP = GM_getValue('modelTopP', 0.9);
    let imageModelTemperature = GM_getValue('imageModelTemperature', 0.7);
    let imageModelTopP = GM_getValue('imageModelTopP', 0.9);

    // Load cached ratings from persistent storage (if any)
    let storedRatings = GM_getValue('tweetRatings', '{}');
    try {
        Object.assign(tweetIDRatingCache, JSON.parse(storedRatings));
        console.log(`Loaded ${Object.keys(tweetIDRatingCache).length} cached tweet ratings`);
    } catch (e) {
        console.error('Error loading stored ratings:', e);
    }

    // ----- DOM Selectors (for tweet elements) -----
    const TWEET_ARTICLE_SELECTOR = 'article[data-testid="tweet"]';
    const QUOTE_CONTAINER_SELECTOR = 'div[role="link"][tabindex="0"]';
    const USER_NAME_SELECTOR = 'div[data-testid="User-Name"] span > span';
    const USER_HANDLE_SELECTOR = 'div[data-testid="User-Name"] a[role="link"]';
    const TWEET_TEXT_SELECTOR = 'div[data-testid="tweetText"]';
    const MEDIA_IMG_SELECTOR = 'div[data-testid="tweetPhoto"] img[src*="pbs.twimg.com/media/"]';
    const MEDIA_VIDEO_SELECTOR = 'div[data-testid="videoPlayer"] video[poster*="pbs.twimg.com"]';
    const PERMALINK_SELECTOR = 'a[href*="/status/"] time';

    // ----- UI Styling -----
    GM_addStyle(`/* 
        Modern X-Inspired Styles - Compact Version
        ---------------------------------
    */
    
    /* Main tweet filter container */
    #tweet-filter-container {
        position: fixed;
        top: 70px;
        right: 15px;
        background-color: rgba(22, 24, 28, 0.95);
        color: #e7e9ea;
        padding: 10px 12px;
        border-radius: 12px;
        z-index: 9999;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 13px;
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        gap: 10px;
        border: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    /* Close button styles */
    .close-button {
        position: absolute;
        top: 5px;
        right: 5px;
        background: none;
        border: none;
        color: #e7e9ea;
        font-size: 16px;
        cursor: pointer;
        padding: 0;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0.8;
        transition: opacity 0.2s;
    }
    
    .close-button:hover {
        opacity: 1;
    }
    
    /* Hidden state */
    .hidden {
        display: none !important;
    }
    
    /* Show/hide button */
    .toggle-button {
        position: fixed;
        right: 15px;
        background-color: rgba(22, 24, 28, 0.95);
        color: #e7e9ea;
        padding: 8px 12px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 12px;
        z-index: 9999;
        border: 1px solid rgba(255, 255, 255, 0.1);
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.5);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    
    #filter-toggle {
        top: 70px;
    }
    
    #settings-toggle {
        top: 120px;
    }
    
    #tweet-filter-container label {
        margin: 0;
        font-weight: bold;
    }
    
    #tweet-filter-slider {
        cursor: pointer;
        width: 120px;
        vertical-align: middle;
        accent-color: #1d9bf0;
    }
    
    #tweet-filter-value {
        min-width: 20px;
        text-align: center;
        font-weight: bold;
        background-color: rgba(255, 255, 255, 0.1);
        padding: 2px 5px;
        border-radius: 4px;
    }
    
    /* Settings UI with Tabs */
    #settings-container {
        position: fixed;
        top: 120px;
        right: 15px;
        background-color: rgba(22, 24, 28, 0.95);
        color: #e7e9ea;
        padding: 12px 15px;
        border-radius: 12px;
        z-index: 9999;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 13px;
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.5);
        display: flex;
        flex-direction: column;
        gap: 6px;
        width: 320px;
        max-height: 70vh;
        overflow-y: auto;
        border: 1px solid rgba(255, 255, 255, 0.1);
        line-height: 1.3;
    }
    
    /* Scrollbar styling for settings container */
    #settings-container::-webkit-scrollbar {
        width: 6px;
    }
    
    #settings-container::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.05);
        border-radius: 3px;
    }
    
    #settings-container::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 3px;
    }
    
    #settings-container::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.3);
    }
    
    /* Tab Navigation */
    .tab-navigation {
        display: flex;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        margin-bottom: 10px;
        position: sticky;
        top: 0;
        background-color: rgba(22, 24, 28, 0.95);
        z-index: 10;
        padding-bottom: 5px;
    }
    
    .tab-button {
        padding: 6px 10px;
        background: none;
        border: none;
        color: #e7e9ea;
        font-weight: bold;
        cursor: pointer;
        border-bottom: 2px solid transparent;
        font-size: 13px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    
    .tab-button.active {
        color: #1d9bf0;
        border-bottom: 2px solid #1d9bf0;
    }
    
    /* Tab Content */
    .tab-content {
        display: none;
    }
    
    .tab-content.active {
        display: block;
    }
    
    /* Form elements - compact version */
    #openrouter-api-key,
    #model-selector,
    #model-search-box,
    #image-model-selector,
    #image-model-search-box,
    #handle-input,
    #user-instructions {
        width: 100%;
        padding: 6px;
        border-radius: 6px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        margin-top: 4px;
        margin-bottom: 6px;
        background-color: rgba(39, 44, 48, 0.95);
        color: #e7e9ea;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 12px;
    }
    
    #user-instructions {
        height: 100px;
        resize: vertical;
    }
    
    /* Parameter controls - compact version */
    .parameter-row {
        display: flex;
        align-items: center;
        margin-top: 6px;
        margin-bottom: 6px;
        gap: 8px;
    }
    
    .parameter-label {
        flex: 1;
        font-size: 12px;
        opacity: 0.9;
    }
    
    .parameter-control {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 5px;
    }
    
    .parameter-value {
        width: 25px;
        text-align: center;
        background-color: rgba(255, 255, 255, 0.1);
        padding: 2px 4px;
        border-radius: 3px;
        font-size: 11px;
    }
    
    .parameter-slider {
        flex: 1;
        -webkit-appearance: none;
        height: 3px;
        border-radius: 3px;
        background: rgba(255, 255, 255, 0.2);
        outline: none;
        cursor: pointer;
    }
    
    .parameter-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #1d9bf0;
        cursor: pointer;
    }
    
    /* Section styles - compact */
    .section-title {
        font-weight: bold;
        margin-top: 10px;
        margin-bottom: 3px;
        color: #e7e9ea;
    }
    
    .section-description {
        font-size: 11px;
        margin-top: 2px;
        margin-bottom: 4px;
        opacity: 0.8;
    }
    
    /* Handle list styling - compact */
    .handle-list {
        margin-top: 6px;
        max-height: 100px;
        overflow-y: auto;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 6px;
        padding: 3px;
    }
    
    .handle-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 3px 5px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }
    
    .handle-item:last-child {
        border-bottom: none;
    }
    
    .handle-text {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 12px;
    }
    
    .remove-handle {
        background: none;
        border: none;
        color: #ff5c5c;
        cursor: pointer;
        font-size: 14px;
        padding: 0 3px;
    }
    
    .add-handle-btn {
        background-color: #1d9bf0;
        color: white;
        border: none;
        border-radius: 6px;
        padding: 5px 8px;
        cursor: pointer;
        font-weight: bold;
        font-size: 11px;
        margin-left: 5px;
    }
    
    /* Button styling - compact */
    .settings-button {
        background-color: #1d9bf0;
        color: white;
        border: none;
        border-radius: 6px;
        padding: 7px 10px;
        cursor: pointer;
        font-weight: bold;
        transition: background-color 0.2s;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        margin-top: 6px;
        margin-bottom: 2px;
        width: 100%;
        font-size: 12px;
    }
    
    .settings-button:hover {
        background-color: #1a8cd8;
    }
    
    .settings-button.secondary {
        background-color: rgba(255, 255, 255, 0.1);
    }
    
    .settings-button.danger {
        background-color: #ff5c5c;
    }
    
    .settings-button.danger:hover {
        background-color: #e53935;
    }
    
    /* Rating indicator shown on tweets */
    .score-indicator {
        position: absolute;
        top: 5px;
        right: 5px;
        background-color: rgba(22, 24, 28, 0.9);
        color: #e7e9ea;
        padding: 4px 10px;
        border-radius: 8px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 14px;
        font-weight: bold;
        z-index: 100;
        cursor: pointer;
        border: 1px solid rgba(255, 255, 255, 0.1);
        min-width: 20px;
        text-align: center;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    }
    
    /* Scrollbar styling for all scrollable elements */
    .handle-list::-webkit-scrollbar {
        width: 5px;
    }
    
    .handle-list::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.05);
        border-radius: 3px;
    }
    
    .handle-list::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 3px;
    }
    
    .handle-list::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.3);
    }
    
    /* Refresh animation */
    .refreshing {
        animation: spin 1s infinite linear;
    }
    
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    
    /* Refresh models button */
    .refresh-models {
        background: none;
        border: none;
        color: #e7e9ea;
        font-size: 13px;
        cursor: pointer;
        margin-left: 3px;
        opacity: 0.8;
        transition: opacity 0.2s;
    }
    
    .refresh-models:hover {
        opacity: 1;
    }
    
    /* The description box for ratings */
    .score-description {
        display: none;
        background-color: rgba(22, 24, 28, 0.95);
        color: #e7e9ea;
        padding: 16px 20px;
        border-radius: 12px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 16px;
        line-height: 1.5;
        z-index: 99999999;
        position: absolute;
        width: clamp(300px, 30vw, 500px);
        max-height: 60vh;
        overflow-y: auto;
        border: 1px solid rgba(255, 255, 255, 0.1);
        word-wrap: break-word;
    }
    
    /* Rating status classes */
    .cached-rating {
        background-color: rgba(76, 175, 80, 0.9) !important;
        color: white !important;
    }
    
    .blacklisted-rating {
        background-color: rgba(255, 193, 7, 0.9) !important;
        color: black !important;
    }
    
    .pending-rating {
        background-color: rgba(255, 152, 0, 0.9) !important;
        color: white !important;
    }
    
    .error-rating {
        background-color: rgba(244, 67, 54, 0.9) !important;
        color: white !important;
    }
    
    /* Status indicator at bottom-right */
    #status-indicator {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background-color: rgba(22, 24, 28, 0.95);
        color: #e7e9ea;
        padding: 10px 15px;
        border-radius: 8px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 12px;
        z-index: 9999;
        display: none;
        border: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    #status-indicator.active {
        display: block;
    }
    
    /* Form elements for dropdowns */
    select {
        appearance: none;
        background-image: url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23e7e9ea%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E");
        background-repeat: no-repeat;
        background-position: right 0.7em top 50%;
        background-size: 0.65em auto;
        padding-right: 1.4em;
    }
    `);

    // ----- UI Helper Functions -----

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
     * Saves the tweet ratings (by tweet ID) to persistent storage.
     */
    function saveTweetRatings() {
        GM_setValue('tweetRatings', JSON.stringify(tweetIDRatingCache));
        console.log(`Saved ${Object.keys(tweetIDRatingCache).length} tweet ratings to storage`);
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
     * Updates the model selector dropdown based on the available models and an optional filter.
     * @param {string} [filter=''] - Optional text to filter the models.
     * @param {string} [selectorId='model-selector'] - The ID of the selector to update.
     * @param {string} [currentSelection] - The currently selected model.
     */
    function updateModelSelector(filter = '', selectorId = 'model-selector', currentSelection = null) {
        const selector = document.getElementById(selectorId);
        if (!selector) return;

        const modelToSelect = currentSelection ||
            (selectorId === 'model-selector' ? selectedModel : selectedImageModel);

        // Clear existing options
        selector.innerHTML = '';

        // Add available models that match the filter
        if (availableModels && availableModels.length > 0) {
            availableModels.forEach(model => {
                let displayText = model.id;
                if (model.pricing && model.pricing.prompt) {
                    const promptPrice = parseFloat(model.pricing.prompt);
                    if (!isNaN(promptPrice)) {
                        displayText += ` - $${promptPrice.toFixed(7)}/token`;
                    }
                }

                // Check if model supports images
                const supportsImages = model.architecture &&
                    ((model.architecture.input_modalities &&
                        model.architecture.input_modalities.includes('image')) ||
                        (model.architecture.modality &&
                            model.architecture.modality.includes('image')));

                // Add an icon for image-capable models in both selectors
                if (supportsImages) {
                    displayText = '🖼️ ' + displayText;
                }

                // For image model selector, only show vision models
                if (selectorId === 'image-model-selector') {
                    if (!supportsImages) {
                        return; // Skip models that don't support image input
                    }
                }

                if (filter && !displayText.toLowerCase().includes(filter.toLowerCase())) {
                    return; // Skip options that don't match the search query
                }

                const option = document.createElement('option');
                option.value = model.id;
                option.textContent = displayText;
                if (model.id === modelToSelect) {
                    option.selected = true;
                }
                selector.appendChild(option);
            });
        }

        // If no matching models, add the selected model to the list
        if (selector.options.length === 0 || !Array.from(selector.options).some(opt => opt.value === modelToSelect)) {
            const option = document.createElement('option');
            option.value = modelToSelect;
            option.textContent = modelToSelect;
            option.selected = true;
            selector.appendChild(option);
        }
    }

    /**
     * Updates the image model selector dropdown based on available vision-capable models.
     * @param {string} [filter=''] - Optional text to filter the models.
     */
    function updateImageModelSelector(filter = '') {
        updateModelSelector(filter, 'image-model-selector');
    }

    /**
     * Adds the filtering slider UI to the page.
     * This will be shown by default.
     */
    function addSliderUI() {
        if (document.getElementById('tweet-filter-container')) return;
        
        const container = document.createElement('div');
        container.id = 'tweet-filter-container';
        
        // Add close button
        const closeBtn = document.createElement('button');
        closeBtn.className = 'close-button';
        closeBtn.innerHTML = '×';
        closeBtn.onclick = () => {
            container.classList.add('hidden');
        };
        container.appendChild(closeBtn);
        
        const label = document.createElement('label');
        label.setAttribute('for', 'tweet-filter-slider');
        label.textContent = 'Min Score:';
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.id = 'tweet-filter-slider';
        slider.min = '1';
        slider.max = '10';
        slider.step = '1';
        slider.value = currentFilterThreshold.toString();
        const valueDisplay = document.createElement('span');
        valueDisplay.id = 'tweet-filter-value';
        valueDisplay.textContent = slider.value;
        slider.addEventListener('input', (event) => {
            currentFilterThreshold = parseInt(event.target.value, 10);
            valueDisplay.textContent = currentFilterThreshold.toString();
            GM_setValue('filterThreshold', currentFilterThreshold);
            applyFilteringToAll();
        });
        container.appendChild(label);
        container.appendChild(slider);
        container.appendChild(valueDisplay);
        document.body.appendChild(container);
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
        toggleBtn.textContent = 'Open Menu';
        toggleBtn.onclick = () => {
            const container = document.getElementById('settings-container');
            if (container.classList.contains('hidden')) {
                container.classList.remove('hidden');
                toggleBtn.textContent = 'Close Menu';
            } else {
                container.classList.add('hidden');
                toggleBtn.textContent = 'Open Menu';
            }
        };
        document.body.appendChild(toggleBtn);
        
        const container = document.createElement('div');
        container.id = 'settings-container';
        container.classList.add('hidden');
        
        // Add close button
        const closeBtn = document.createElement('button');
        closeBtn.className = 'close-button';
        closeBtn.innerHTML = '×';
        closeBtn.onclick = () => {
            container.classList.add('hidden');
            toggleBtn.textContent = 'Open Menu';
        };
        container.appendChild(closeBtn);
        
        // Title
        const title = document.createElement('div');
        title.textContent = 'X (frm. Twitter) De-Sloppifier';
        title.style.fontWeight = 'bold';
        title.style.fontSize = '16px';
        title.style.marginBottom = '10px';
        container.appendChild(title);
        
        // Tab Navigation
        const tabNav = document.createElement('div');
        tabNav.className = 'tab-navigation';
        
        // Settings Tab Button
        const settingsTabBtn = document.createElement('button');
        settingsTabBtn.className = 'tab-button active';
        settingsTabBtn.textContent = 'Settings';
        settingsTabBtn.onclick = () => {
            switchTab('settings');
        };
        tabNav.appendChild(settingsTabBtn);
        
        // Custom Instructions Tab Button
        const instructionsTabBtn = document.createElement('button');
        instructionsTabBtn.className = 'tab-button';
        instructionsTabBtn.textContent = 'Custom Instructions';
        instructionsTabBtn.onclick = () => {
            switchTab('instructions');
        };
        tabNav.appendChild(instructionsTabBtn);
        
        container.appendChild(tabNav);
        
        // Settings Tab Content
        const settingsTab = document.createElement('div');
        settingsTab.id = 'settings-tab';
        settingsTab.className = 'tab-content active';
        buildSettingsTabContent(settingsTab);
        container.appendChild(settingsTab);
        
        // Custom Instructions Tab Content
        const instructionsTab = document.createElement('div');
        instructionsTab.id = 'instructions-tab';
        instructionsTab.className = 'tab-content';
        buildInstructionsTabContent(instructionsTab);
        container.appendChild(instructionsTab);
        
        document.body.appendChild(container);
        
        // Helper function to switch between tabs
        function switchTab(tabName) {
            const tabs = container.querySelectorAll('.tab-content');
            const buttons = tabNav.querySelectorAll('.tab-button');
            
            // Hide all tabs
            tabs.forEach(tab => tab.classList.remove('active'));
            buttons.forEach(btn => btn.classList.remove('active'));
            
            // Show selected tab
            if (tabName === 'settings') {
                settingsTab.classList.add('active');
                settingsTabBtn.classList.add('active');
            } else if (tabName === 'instructions') {
                instructionsTab.classList.add('active');
                instructionsTabBtn.classList.add('active');
            }
        }
    }

    /**
     * Builds the content for the Settings tab.
     * @param {HTMLElement} tabElement - The tab element to fill with content.
     */
    function buildSettingsTabContent(tabElement) {
        // API Key section
        const apiKeyLabel = document.createElement('div');
        apiKeyLabel.className = 'section-title';
        apiKeyLabel.textContent = 'OpenRouter API Key';
        tabElement.appendChild(apiKeyLabel);
        
        const apiKeyInput = document.createElement('input');
        apiKeyInput.type = 'password';
        apiKeyInput.id = 'openrouter-api-key';
        apiKeyInput.placeholder = 'Enter your OpenRouter API key';
        apiKeyInput.value = GM_getValue('openrouter-api-key', '');
        tabElement.appendChild(apiKeyInput);
        
        // Scoring Model Section
        const modelLabel = document.createElement('div');
        modelLabel.className = 'section-title';
        modelLabel.textContent = 'Tweet Rating Model';
        
        // Refresh button to update model list
        const refreshButton = document.createElement('button');
        refreshButton.className = 'refresh-models';
        refreshButton.innerHTML = '🔄';
        refreshButton.title = 'Refresh model list';
        refreshButton.addEventListener('click', (e) => {
            e.preventDefault();
            fetchAvailableModels();
        });
        modelLabel.appendChild(refreshButton);
        tabElement.appendChild(modelLabel);
        
        // Search box for filtering models
        const modelSearchBox = document.createElement('input');
        modelSearchBox.id = 'model-search-box';
        modelSearchBox.type = 'text';
        modelSearchBox.placeholder = 'Search models...';
        modelSearchBox.addEventListener('input', function (e) {
            updateModelSelector(this.value);
        });
        tabElement.appendChild(modelSearchBox);
        
        // Dropdown for model selection
        const modelSelector = document.createElement('select');
        modelSelector.id = 'model-selector';
        tabElement.appendChild(modelSelector);
        
        // Temperature parameter
        createParameterControl(
            tabElement, 
            'Temperature', 
            'modelTemperature', 
            'How random the model responses should be (0.0-1.0)',
            modelTemperature,
            0, 1, 0.1
        );
        
        // Top-p parameter
        createParameterControl(
            tabElement, 
            'Top-p', 
            'modelTopP', 
            'Nucleus sampling parameter (0.0-1.0)',
            modelTopP,
            0, 1, 0.1
        );
        
        // Image Model Section
        const imageModelLabel = document.createElement('div');
        imageModelLabel.className = 'section-title';
        imageModelLabel.textContent = 'Image Processing Model';
        tabElement.appendChild(imageModelLabel);
        
        // Add info about which models can process images
        const imageModelNote = document.createElement('div');
        imageModelNote.className = 'section-description';
        imageModelNote.textContent = 'Only models with vision capabilities will work for image descriptions';
        tabElement.appendChild(imageModelNote);
        
        // Search box for filtering image models
        const imageModelSearchBox = document.createElement('input');
        imageModelSearchBox.id = 'image-model-search-box';
        imageModelSearchBox.type = 'text';
        imageModelSearchBox.placeholder = 'Search image models...';
        imageModelSearchBox.addEventListener('input', function (e) {
            updateImageModelSelector(this.value);
        });
        tabElement.appendChild(imageModelSearchBox);
        
        // Dropdown for image model selection
        const imageModelSelector = document.createElement('select');
        imageModelSelector.id = 'image-model-selector';
        tabElement.appendChild(imageModelSelector);
        
        // Image model temperature parameter
        createParameterControl(
            tabElement, 
            'Image Temperature', 
            'imageModelTemperature', 
            'Randomness for image descriptions (0.0-1.0)',
            imageModelTemperature,
            0, 1, 0.1
        );
        
        // Image model top-p parameter
        createParameterControl(
            tabElement, 
            'Image Top-p', 
            'imageModelTopP', 
            'Nucleus sampling for image model (0.0-1.0)',
            imageModelTopP,
            0, 1, 0.1
        );
        
        // Save Button
        const saveButton = document.createElement('button');
        saveButton.className = 'settings-button';
        saveButton.textContent = 'Save Settings';
        saveButton.addEventListener('click', saveSettings);
        tabElement.appendChild(saveButton);
        
        // Test Connection Button
        const testButton = document.createElement('button');
        testButton.className = 'settings-button';
        testButton.style.marginTop = '5px';
        testButton.textContent = 'Test Connection';
        testButton.addEventListener('click', testAPIConnection);
        tabElement.appendChild(testButton);
        
        // Clear Cache Button
        const clearButton = document.createElement('button');
        clearButton.className = 'settings-button danger';
        clearButton.style.marginTop = '5px';
        clearButton.textContent = 'Clear Rating Cache';
        clearButton.addEventListener('click', clearTweetRatings);
        tabElement.appendChild(clearButton);
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
     */
    function createParameterControl(parent, label, paramName, description, value, min, max, step) {
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
        
        const valueDisplay = document.createElement('div');
        valueDisplay.className = 'parameter-value';
        valueDisplay.textContent = value;
        
        slider.addEventListener('input', () => {
            const newValue = parseFloat(slider.value);
            valueDisplay.textContent = newValue.toFixed(1);
            window[paramName] = newValue; // Update the global variable
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
     * Saves all settings from the UI to persistent storage.
     */
    function saveSettings() {
        try {
            // API Key
            const apiKey = document.getElementById('openrouter-api-key').value;
            GM_setValue('openrouter-api-key', apiKey);
            
            // Models
            const ratingModel = document.getElementById('model-selector').value;
            const imageModel = document.getElementById('image-model-selector').value;
            
            if (ratingModel) {
                selectedModel = ratingModel;
                GM_setValue('selectedModel', selectedModel);
            }
            
            if (imageModel) {
                selectedImageModel = imageModel;
                GM_setValue('selectedImageModel', selectedImageModel);
            }
            
            // Model parameters
            GM_setValue('modelTemperature', modelTemperature);
            GM_setValue('modelTopP', modelTopP);
            GM_setValue('imageModelTemperature', imageModelTemperature);
            GM_setValue('imageModelTopP', imageModelTopP);
            
            // Show success message
            showStatus('Settings saved successfully!');
        } catch (error) {
            console.error('Error saving settings:', error);
            showStatus('Error saving settings: ' + error.message);
        }
    }

    // ----- DOM Utility Functions -----

    /**
     * Extracts and returns trimmed text content from the given element(s).
     * @param {Node|NodeList} elements - A DOM element or a NodeList.
     * @returns {string} The trimmed text content.
     */
    function getElementText(elements) {
        if (!elements) return '';
        const elementList = elements instanceof NodeList ? Array.from(elements) : [elements];
        for (const element of elementList) {
            const text = element?.textContent?.trim();
            if (text) return text;
        }
        return '';
    }

    /**
     * Extracts the tweet ID from a tweet article element.
     * @param {Element} tweetArticle - The tweet article element.
     * @returns {string} The tweet ID.
     */
    function getTweetID(tweetArticle) {
        const timeEl = tweetArticle.querySelector(PERMALINK_SELECTOR);
        let tweetId = timeEl?.parentElement?.href;
        if (tweetId && tweetId.includes('/status/')) {
            const match = tweetId.match(/\/status\/(\d+)/);
            if (match && match[1]) {
                return match[1];
            }
            return tweetId.substring(tweetId.indexOf('/status/') + 1);
        }
        return `tweet-${Math.random().toString(36).substring(2, 15)}-${Date.now()}`;
    }

    /**
     * Extracts the Twitter handle from a tweet article element.
     * @param {Element} tweetArticle - The tweet article element.
     * @returns {string} The Twitter handle (without the leading '@').
     */
    function getUserHandle(tweetArticle) {
        const handleElement = tweetArticle.querySelector(USER_HANDLE_SELECTOR);
        if (handleElement) {
            const href = handleElement.getAttribute('href');
            if (href && href.startsWith('/')) {
                return href.slice(1);
            }
        }
        return '';
    }

    /**
     * Checks if a given user handle is in the blacklist.
     * @param {string} handle - The Twitter handle.
     * @returns {boolean} True if blacklisted, false otherwise.
     */
    function isUserBlacklisted(handle) {
        if (!handle) return false;
        handle = handle.toLowerCase().trim();
        return blacklistedHandles.some(h => h.toLowerCase().trim() === handle);
    }

    /**
     * Extracts and returns an array of media URLs from the tweet element.
     * @param {Element} scopeElement - The tweet element.
     * @param {string} tweetIdForDebug - The tweet ID (for logging).
     * @returns {string[]} An array of media URLs.
     */
    function extractMediaLinks(scopeElement, tweetIdForDebug) {
        if (!scopeElement) return [];
        const mediaLinks = new Set();
        scopeElement.querySelectorAll(`${MEDIA_IMG_SELECTOR}, ${MEDIA_VIDEO_SELECTOR}`).forEach((mediaEl) => {
            const rawUrl = (mediaEl.tagName === 'IMG' ? mediaEl.src : mediaEl.poster);
            if (!rawUrl || !rawUrl.includes('pbs.twimg.com')) return;
            try {
                const url = new URL(rawUrl);
                const format = url.searchParams.get('format');
                let finalUrl = url.origin + url.pathname;
                if (format) {
                    finalUrl += `.${format}`;
                    mediaLinks.add(finalUrl);
                } else if (/\.(jpg|jpeg|png|gif|webp)$/i.test(url.pathname)) {
                    mediaLinks.add(finalUrl);
                } else if (mediaEl.tagName === 'VIDEO' && mediaEl.poster) {
                    finalUrl += `.jpg`;
                    mediaLinks.add(finalUrl);
                } else if (mediaEl.tagName === 'IMG') {
                    finalUrl += `.jpg`;
                    mediaLinks.add(finalUrl);
                } else {
                    mediaLinks.add(finalUrl);
                }
            } catch (e) {
                console.error(`[${tweetIdForDebug}] Error parsing media URL: ${rawUrl}`, e);
                if (rawUrl.includes('pbs.twimg.com')) {
                    mediaLinks.add(rawUrl.split('?')[0]);
                }
            }
        });
        return Array.from(mediaLinks);
    }

    // ----- Rating Indicator Functions -----
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
     * Applies filtering to a single tweet by hiding it if its score is below the threshold.
     * Also updates the rating indicator.
     * @param {Element} tweetArticle - The tweet element.
     */
    function filterSingleTweet(tweetArticle) {
        const score = parseInt(tweetArticle.dataset.sloppinessScore || '0', 10);
        // Update the indicator based on the tweet's rating status
        setScoreIndicator(tweetArticle, score, tweetArticle.dataset.ratingStatus || 'rated', tweetArticle.dataset.ratingDescription);
        // If the tweet is still pending a rating, keep it visible
        if (tweetArticle.dataset.ratingStatus === 'pending') {
            tweetArticle.style.display = '';
        } else if (isNaN(score) || score < currentFilterThreshold) {
            tweetArticle.style.display = 'none';
        } else {
            tweetArticle.style.display = '';
        }
    }

    /**
     * Applies a cached rating (if available) to a tweet article.
     * Also sets the rating status to 'rated' and updates the indicator.
     * @param {Element} tweetArticle - The tweet element.
     * @returns {boolean} True if a cached rating was applied.
     */
    function applyTweetCachedRating(tweetArticle) {
        const tweetId = getTweetID(tweetArticle);
        const userHandle = getUserHandle(tweetArticle);
        // Blacklisted users are automatically given a score of 10
        if (userHandle && isUserBlacklisted(userHandle)) {
            console.debug(`Blacklisted user detected: ${userHandle}, assigning score 10`);
            tweetArticle.dataset.sloppinessScore = '10';
            tweetArticle.dataset.blacklisted = 'true';
            tweetArticle.dataset.ratingStatus = 'rated';
            tweetArticle.dataset.ratingDescription = 'Whtielisted user';
            setScoreIndicator(tweetArticle, 10, 'rated');
            filterSingleTweet(tweetArticle);
            return true;
        }
        // Check ID-based cache
        if (tweetIDRatingCache[tweetId]) {
            const score = tweetIDRatingCache[tweetId].score;
            const desc = tweetIDRatingCache[tweetId].description;
            console.debug(`Applied cached rating for tweet ${tweetId}: ${score}`);
            tweetArticle.dataset.sloppinessScore = score.toString();
            tweetArticle.dataset.cachedRating = 'true';
            tweetArticle.dataset.ratingStatus = 'rated';
            tweetArticle.dataset.ratingDescription = desc;
            setScoreIndicator(tweetArticle, score, 'rated', desc);
            filterSingleTweet(tweetArticle);
            return true;
        }

        return false;
    }
    async function getImageDescription(urls, apiKey, tweetId, userHandle) {
        let msgs = [
            {
                role: "system",
                content: `You are a helpful assistant that can describe images.`
            },
            {
                role: "user",
                content: `The user is going to provide you with a list of 1-N images. 
                    Your job is to provide a description of each image. Follow this output format exactly.
                    [IMAGE 1]: Description of first image
                    ...
                    [IMAGE N]: Description of image N`
            }
        ];

        for(let i = 0; i < urls.length; i++){
            msgs.push({
                role: "user",
                content: [
                    { 
                        "type": "text", 
                        "text": `image ${i+1}:` 
                    }, 
                    { 
                        "type": "image_url", 
                        "image_url": { "url": urls[i] } 
                    }
                ]
            });
        }
        
        return new Promise((resolve) => {
            GM.xmlHttpRequest({
                method: "POST",
                url: 'https://openrouter.ai/api/v1/chat/completions',
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                data: JSON.stringify({
                    model: selectedImageModel,
                    messages: msgs,
                    temperature: imageModelTemperature,
                    top_p: imageModelTopP
                }),
                onload: function (response) {
                    if (response.status === 200) {
                        const data = JSON.parse(response.responseText);
                        resolve(data.choices[0].message.content);
                    } else {
                        resolve("Error fetching image description.");
                    }
                },
                onerror: function (error) {
                    resolve("Error fetching image description.");
                }
            });
        });
    }

    // ----- API Request with Retry Functionality -----

    /**
     * Rates a tweet using the OpenRouter API with automatic retry functionality.
     * The function retries up to 3 times in case of failures.
     * @param {string} tweetText - The text content of the tweet.
     * @param {string} tweetId - The unique tweet ID.
     * @param {string} apiKey - The API key for authentication.
     * @param {number} [attempt=1] - The current attempt number.
     * @param {number} [maxAttempts=3] - The maximum number of retry attempts.
     * @returns {Promise<{score: number, error: boolean}>} The rating score and error flag.
     */
    function rateTweetWithOpenRouter(tweetText, tweetId, apiKey, attempt = 1, maxAttempts = 3) {
        return new Promise((resolve, reject) => {
            /**
             * Attempts the API call. On failure (or certain HTTP errors), retries if under maxAttempts.
             * On success, parses the response and resolves with the score.
             * On final failure, resolves with a default score (5) and an error flag.
             * @param {number} currentAttempt - The current attempt number.
             */

            function attemptRating(currentAttempt) {
                // Rate limit: wait if needed between API calls
                const now = Date.now();
                const timeElapsed = now - lastAPICallTime;
                if (timeElapsed < API_CALL_DELAY_MS) {
                    setTimeout(() => { attemptRating(currentAttempt); }, API_CALL_DELAY_MS - timeElapsed);
                    return;
                }
                
                lastAPICallTime = Date.now();
                pendingRequests++;
                showStatus(`Rating tweet... (${pendingRequests} pending)`);
                
                GM_xmlhttpRequest({
                    method: "POST",
                    url: "https://openrouter.ai/api/v1/chat/completions",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${apiKey}`,
                        "HTTP-Referer": "https://twitter.com",
                        "X-Title": "Tweet Rating Tool"
                    },
                    data: JSON.stringify({
                        "model": selectedModel,
                        "messages": [
                            {
                                "role": "user",
                                "content":
                                    `
                                 You will be given a Tweet, structured like this:

                                 _______TWEET SCHEMA_______
                                 _______BEGIN TWEET_______
                               
                                
                                [TWEET TweetID]
                                [the text of the tweet being replied to]
                                [MEDIA_DESCRIPTION]: 
                                [IMAGE 1]: [description], [IMAGE 2]: [description], etc.
                                [REPLY] (if the author is replying to another tweet)
                                [TWEET TweetID]: (the tweet which you are to review)
                                @[the author of the tweet]
                                [the text of the tweet] 
                                [MEDIA_DESCRIPTION]: 
                                [IMAGE 1]: [description], [IMAGE 2]: [description], etc.
                                [QUOTED_TWEET]: (if the author is quoting another tweet)
                                [the text of the quoted tweet]
                                [QUOTED_TWEET_MEDIA_DESCRIPTION]:
                                [IMAGE 1]: [description], [IMAGE 2]: [description], etc.
                                _______END TWEET_______
                                _______END TWEET SCHEMA_______

                                You are an expert critic of tweets. You are to review and provide a rating for the tweet wtih tweet ID ${tweetId}. 
                                Read the following tweet carefully and analyze its clarity, insightfulness, creativity, and overall impact.
                                Provide a concise explanation of your reasoning and then, on a new line, output your final rating in the exact format:
                                {score: X}, where X is a number from 1 (lowest quality) to 10 (highest quality).
                                for example: {score: 1}, {score: 2}, {score: 3}, {score: 4}, {score: 5}, {score: 6}, {score: 7}, {score: 8}, {score: 9}, {score: 10}
                                If one of the above is not present, the program will not be able to parse the response and will return an error.
                                Ensure that you consider these additionaluser-defined instructions in your analysis and scoring:
                                [USER-DEFINED INSTRUCTIONS]:
                                ${USER_DEFINED_INSTRUCTIONS}
                                _______BEGIN TWEET_______
                                ${tweetText}
                                _______END TWEET_______`

                            }
                        ]
                    }),
                    "temperature": modelTemperature,
                    "top_p": modelTopP,
                    timeout: 30000, // 30 seconds timeout
                    onload: function (response) {
                        pendingRequests--;
                        if (response.status >= 200 && response.status < 300) {
                            try {
                                const data = JSON.parse(response.responseText);
                                const content = data.choices?.[0]?.message?.content;
                                if (!content) {
                                    resolve({ score: 5, content: "No content in OpenRouter response", error: true });
                                    return;
                                }
                                
                                // Extract score
                                const scoreMatch = content.match(/\{score: (\d+)\}/);
                                if (scoreMatch) {
                                    const score = parseInt(scoreMatch[1], 10);
                                    
                                    // Cache the score
                                    tweetIDRatingCache[tweetId] = { tweetContent: tweetText, score: score, description: content };
                                    saveTweetRatings();
                                    resolve({ score: score, content: content, error: false });
                                    return;
                                } else {
                                    resolve({ score: 5, content: "No rating score found in response", error: true });
                                    return;
                                }
                            } catch (error) {
                                resolve({ score: 5, content: "Error parsing response", error: true });
                                return;
                            }
                        } else {
                            resolve({ score: 5, content: `API error: ${response.status}`, error: true });
                        }
                    },
                    onerror: function (error) {
                        pendingRequests--;
                        if (currentAttempt < maxAttempts) {
                            setTimeout(() => { attemptRating(currentAttempt + 1); }, API_CALL_DELAY_MS);
                        } else {
                            resolve({ score: 5, content: "Error making request", error: true });
                        }
                    },
                    ontimeout: function () {
                        pendingRequests--;
                        if (currentAttempt < maxAttempts) {
                            setTimeout(() => { attemptRating(currentAttempt + 1); }, API_CALL_DELAY_MS);
                        } else {
                            resolve({ score: 5, content: "Request timed out", error: true });
                        }
                    }
                });
            }
            attemptRating(attempt);
        });
    }

    /**
     * Tests the API connection by attempting to rate a test tweet.
     */
    async function testAPIConnection() {
        const apiKey = GM_getValue('openrouter-api-key', '');
        if (!apiKey) {
            alert('Please enter and save your API key first.');
            return;
        }
        showStatus("Testing API connection...");
        try {
            const testText = "This is a test tweet to check if the API connection is working.";
            const result = await rateTweetWithOpenRouter(testText, "test-" + Date.now(), apiKey);
            showStatus(`API test successful! Score: ${result.score}`);
            alert(`API connection successful! Test rating: ${result.score} using model: ${selectedModel}`);
        } catch (error) {
            showStatus("API test failed!");
            alert(`API test failed: ${error.toString()}`);
        }
    }

    // ----- Tweet Processing Functions -----

    /**
     * Processes a single tweet after a delay.
     * It first sets a pending indicator, then either applies a cached rating,
     * or calls the API to rate the tweet (with retry logic).
     * Finally, it applies the filtering logic.
     * @param {Element} tweetArticle - The tweet element.
     * @param {string} tweetId - The tweet ID.
     */
    // Helper function to determine if a tweet is the original tweet in a conversation.
    // We check if the tweet article has a following sibling with data-testid="inline_reply_offscreen".
    function isOriginalTweet(tweetArticle) {
        let sibling = tweetArticle.nextElementSibling;
        while (sibling) {
            if (sibling.matches && sibling.matches('div[data-testid="inline_reply_offscreen"]')) {
                return true;
            }
            sibling = sibling.nextElementSibling;
        }
        return false;
    }

    async function delayedProcessTweet(tweetArticle, tweetId) {
        const apiKey = GM_getValue('openrouter-api-key', '');
        let score = 5; // Default score if rating fails
        let description = "";
        
        // Create a single data object to collect all information during processing
        const logData = {
          status: "Started processing",
          tweetId: tweetId
        };
        
        try {
          // Get user handle
          const userHandle = getUserHandle(tweetArticle);
          logData.handle = userHandle;
          
          // Check if tweet's author is blacklisted (fast path)
          if (userHandle && isUserBlacklisted(userHandle)) {
            logData.status = "Blacklisted user - auto-score 10/10";
            logData.score = 10;
            
            tweetArticle.dataset.sloppinessScore = '10';
            tweetArticle.dataset.blacklisted = 'true';
            tweetArticle.dataset.ratingStatus = 'rated';
            tweetArticle.dataset.ratingDescription = "Blacklisted user";
            setScoreIndicator(tweetArticle, 10, 'rated', "Blacklisted user");
            filterSingleTweet(tweetArticle);
            
            // Log final information
            logFinalRating(tweetId, userHandle, logData);
            return;
          }
      
          // Check if a cached rating exists
          if (applyTweetCachedRating(tweetArticle)) {
            logData.status = "Using cached rating";
            logData.score = parseInt(tweetArticle.dataset.sloppinessScore, 10);
            
            // Log final information
            logFinalRating(tweetId, userHandle, logData);
            return;
          }
      
          // --- Set pending status before calling API ---
          tweetArticle.dataset.ratingStatus = 'pending';
          setScoreIndicator(tweetArticle, null, 'pending');
          
          logData.status = "Processing tweet";
      
          // --- Extract Main Tweet Content ---
          const mainText = getElementText(tweetArticle.querySelector(TWEET_TEXT_SELECTOR));
          let mainMediaLinks = extractMediaLinks(tweetArticle, tweetId);
      
          // --- Extract Quoted Tweet Content (if any) ---
          let quotedText = "";
          let quotedMediaLinks = [];
          const quoteContainer = tweetArticle.querySelector(QUOTE_CONTAINER_SELECTOR);
          if (quoteContainer) {
            quotedText = getElementText(quoteContainer.querySelector(TWEET_TEXT_SELECTOR));
            quotedMediaLinks = extractMediaLinks(quoteContainer, tweetId);
          }
          
          // Remove any media links from the main tweet that also appear in the quoted tweet
          mainMediaLinks = mainMediaLinks.filter(link => !quotedMediaLinks.includes(link));
          
          // Collect media URLs
          if (mainMediaLinks.length > 0 || quotedMediaLinks.length > 0) {
            logData.mediaUrls = [...mainMediaLinks, ...quotedMediaLinks];
          }
          
          // --- Build the full context ---
          let fullContext = `[TWEET ${tweetId}]\n Author:@${userHandle}:\n` + mainText;
          let fullContextWithImageDescription = fullContext;
      
          if (mainMediaLinks.length > 0) {
            let mainMediaLinksDescription = await getImageDescription(mainMediaLinks, apiKey, tweetId, userHandle);
            fullContext += "\n[MEDIA_DESCRIPTION]:\n" + mainMediaLinks.join(", ");
            fullContextWithImageDescription += "\n[MEDIA_DESCRIPTION]:\n" + mainMediaLinksDescription;
            
            logData.imageDescription = mainMediaLinksDescription;
          }
          
          if (quotedText) {
            fullContext += "\n[QUOTED_TWEET]:\n" + quotedText;
            fullContextWithImageDescription += "\n[QUOTED_TWEET]:\n" + quotedText;
            if (quotedMediaLinks.length > 0) {
              let quotedMediaLinksDescription = await getImageDescription(quotedMediaLinks, apiKey, tweetId, userHandle);
              fullContext += "\n[QUOTED_TWEET_MEDIA_DESCRIPTION]:\n" + quotedMediaLinks.join(", ");
              fullContextWithImageDescription += "\n[QUOTED_TWEET_MEDIA_DESCRIPTION]:\n" + quotedMediaLinksDescription;
              
              if (logData.imageDescription) {
                logData.imageDescription += "\n\nQUOTED TWEET IMAGES:\n" + quotedMediaLinksDescription;
              } else {
                logData.imageDescription = "QUOTED TWEET IMAGES:\n" + quotedMediaLinksDescription;
              }
            }
          }
      
          // --- Conversation Thread Handling ---
          const conversation = document.querySelector('div[aria-label="Timeline: Conversation"]');
          if (conversation && conversation.dataset.threadHist) {
            // If this tweet is not the original tweet, prepend the thread history.
            if (!isOriginalTweet(tweetArticle)) {
              fullContextWithImageDescription = conversation.dataset.threadHist + "\n[REPLY]\n" + fullContextWithImageDescription;
              logData.isReply = true;
            }
          }
      
          logData.fullContext = fullContextWithImageDescription;
          tweetArticle.dataset.fullContext = fullContextWithImageDescription;
          
          // --- API Call or Fallback ---
          if (apiKey && fullContext) {
            try {
              const rating = await rateTweetWithOpenRouter(fullContextWithImageDescription, tweetId, apiKey);
              score = rating.score;
              description = rating.content;
              tweetArticle.dataset.ratingStatus = rating.error ? 'error' : 'rated';
              tweetArticle.dataset.ratingDescription = description || "not available";
              
              logData.status = rating.error ? "Rating error" : "Rating complete";
              logData.score = score;
              logData.modelResponse = description;
              logData.isError = rating.error;
              
              if (rating.error) {
                logData.error = rating.content;
              }
            } catch (apiError) {
              logData.status = "API error";
              logData.error = apiError.toString();
              logData.isError = true;
              
              score = Math.floor(Math.random() * 10) + 1; // Fallback to a random score
              tweetArticle.dataset.ratingStatus = 'error';
            }
          } else {
            // If there's no API key or textual content (e.g., only media), use a fallback random score.
            score = Math.floor(Math.random() * 10) + 1;
            tweetArticle.dataset.ratingStatus = 'rated';
            
            if (!apiKey) {
              logData.status = "No API key - using random score";
            } else if (!fullContext) {
              logData.status = "No textual content - using random score";
            }
            
            logData.score = score;
          }
      
          tweetArticle.dataset.sloppinessScore = score.toString();
          setScoreIndicator(tweetArticle, score, tweetArticle.dataset.ratingStatus, tweetArticle.dataset.ratingDescription);
          filterSingleTweet(tweetArticle);
          
          // Update final status
          if (!logData.status.includes("complete")) {
            logData.status = "Rating process complete";
          }
          
          // Log all collected information at once
          logFinalRating(tweetId, userHandle, logData);
          
        } catch (error) {
          logData.status = "Error processing tweet";
          logData.error = error.toString();
          logData.isError = true;
          
          // Log the error information
          logFinalRating(tweetId, userHandle || "unknown", logData);
          
          if (!tweetArticle.dataset.sloppinessScore) {
            tweetArticle.dataset.sloppinessScore = '5';
            tweetArticle.dataset.ratingStatus = 'error';
            tweetArticle.dataset.ratingDescription = "error processing tweet";
            setScoreIndicator(tweetArticle, 5, 'error', 'Error processing tweet');
            filterSingleTweet(tweetArticle);
          }
        }
    }

    /**
     * Schedules processing of a tweet if it hasn't been processed yet.
     * @param {Element} tweetArticle - The tweet element.
     */
    function scheduleTweetProcessing(tweetArticle) {
        const tweetId = getTweetID(tweetArticle);
        // Fast-path: if author is blacklisted, assign score immediately
        const userHandle = getUserHandle(tweetArticle);
        if (userHandle && isUserBlacklisted(userHandle)) {
            tweetArticle.dataset.sloppinessScore = '10';
            tweetArticle.dataset.blacklisted = 'true';
            tweetArticle.dataset.ratingStatus = 'rated';

            tweetArticle.dataset.ratingDescription = "Whitelisted user";
            setScoreIndicator(tweetArticle, 10, 'rated');
            filterSingleTweet(tweetArticle);
            return;
        }
        // If a cached rating is available, use it immediately
        if (tweetIDRatingCache[tweetId]) {
            applyTweetCachedRating(tweetArticle);
            return;
        }
        // Skip if already processed in this session
        if (processedTweets.has(tweetId)) {
            return;
        }
        processedTweets.add(tweetId);
        setTimeout(() => { delayedProcessTweet(tweetArticle, tweetId); }, PROCESSING_DELAY_MS);
    }

    /**
     * Extracts the full context of a tweet article and returns a formatted string.
     *
     * Schema:
     * [TWEET]:
     * @[the author of the tweet]
     * [the text of the tweet]
     * [MEDIA_DESCRIPTION]:
     * [IMAGE 1]: [description], [IMAGE 2]: [description], etc.
     * [QUOTED_TWEET]:
     * [the text of the quoted tweet]
     * [QUOTED_TWEET_MEDIA_DESCRIPTION]:
     * [IMAGE 1]: [description], [IMAGE 2]: [description], etc.
     *
     * @param {Element} tweetArticle - The tweet article element.
     * @param {string} tweetId - The tweet's ID.
     * @param {string} apiKey - API key used for getting image descriptions.
     * @returns {Promise<string>} - The full context string.
     */
    async function getFullContext(tweetArticle, tweetId, apiKey) {
        const userHandle = getUserHandle(tweetArticle);
        const mainText = getElementText(tweetArticle.querySelector(TWEET_TEXT_SELECTOR));
        const mainMediaLinks = extractMediaLinks(tweetArticle, tweetId);

        // Retrieve media descriptions for the main tweet, if available.
        let mainMediaDescriptions = "[MEDIA_DESCRIPTION]:\n";
        if (mainMediaLinks.length > 0) {
            // Assuming getImageDescription returns a string formatted as:
            // "[IMAGE 1]: description, [IMAGE 2]: description, etc."
            mainMediaDescriptions = await getImageDescription(mainMediaLinks, apiKey, tweetId, userHandle);
        }

        // Retrieve quoted tweet content (if any)
        let quotedText = "";
        let quotedMediaDescriptions = "[QUOTED_TWEET_MEDIA_DESCRIPTION]:\n";
        const quoteContainer = tweetArticle.querySelector(QUOTE_CONTAINER_SELECTOR);
        if (quoteContainer) {
            quotedText = getElementText(quoteContainer.querySelector(TWEET_TEXT_SELECTOR));
            const quotedMediaLinks = extractMediaLinks(quoteContainer, tweetId);
            if (quotedMediaLinks.length > 0) {
                quotedMediaDescriptions = await getImageDescription(quotedMediaLinks, apiKey, tweetId, userHandle);
            }
        }

        // Build the formatted context string.
        let fullContext = `[TWEET]:
@${userHandle}
${mainText}

${mainMediaDescriptions}
`;
        if (quotedText) {
            fullContext += `[QUOTED_TWEET]:
${quotedText}

${quotedMediaDescriptions}
`;
        }

        return fullContext;
    }


    /**
     * Applies filtering to all tweets currently in the observed container.
     */
    function applyFilteringToAll() {
        if (!observedTargetNode) return;
        const tweets = observedTargetNode.querySelectorAll(TWEET_ARTICLE_SELECTOR);
        tweets.forEach(filterSingleTweet);
    }

    /**
     * Periodically checks and processes tweets that might have been added without triggering mutations.
     */
    function ensureAllTweetsRated() {
        if (!observedTargetNode) return;
        const tweets = observedTargetNode.querySelectorAll(TWEET_ARTICLE_SELECTOR);
        tweets.forEach(tweet => {
            if (!tweet.dataset.sloppinessScore) {
                scheduleTweetProcessing(tweet);
            }
        });
    }
    var threadHist = ""
    async function handleThreads() {
        let conversation = document.querySelector('div[aria-label="Timeline: Conversation"]');
        if (conversation) {

            if (conversation.dataset.threadHist == undefined) {

                threadHist = "";
                const firstArticle = document.querySelector('article[data-testid="tweet"]');
                if (firstArticle) {
                    conversation.dataset.threadHist = 'pending';
                    const tweetId = getTweetID(firstArticle);
                    if (tweetIDRatingCache[tweetId]) {
                        threadHist = tweetIDRatingCache[tweetId].tweetContent;
                    } else {



                        //janky, but we're assuming that since threadHist is undefined, we just opened the thread and therefore the first article is the head. 

                        const apiKey = GM_getValue('openrouter-api-key', '');

                        console.log(firstArticle);
                        const fullcxt = await getFullContext(firstArticle, tweetId, apiKey);
                        threadHist = fullcxt;
                    }
                    conversation.dataset.threadHist = threadHist;
                    //this lets us know if we are still on the main post of the conversation or if we are on a reply to the main post. Will disapear every time we dive deeper
                    conversation.firstChild.dataset.canary = "true";
                }
            }
            else if (conversation.dataset.threadHist == "pending") {
                return;
            }
            else if (conversation.dataset.threadHist != "pending" && conversation.firstChild.dataset.canary == undefined) {
                conversation.firstChild.dataset.canary = "pending";
                const nextArticle = document.querySelector('article[data-testid="tweet"]:has(~ div[data-testid="inline_reply_offscreen"])');
                const tweetId = getTweetID(nextArticle);
                if (tweetIDRatingCache[tweetId]) {
                    threadHist = threadHist + "\n[REPLY]\n" + tweetIDRatingCache[tweetId].tweetContent;
                } else {
                    const apiKey = GM_getValue('openrouter-api-key', '');
                    await new Promise(resolve => setTimeout(resolve, 500));
                    const newContext = await getFullContext(nextArticle, tweetId, apiKey);
                    threadHist = threadHist + "\n[REPLY]\n" + newContext;
                    conversation.dataset.threadHist = threadHist;
                }
            }
        }
    }
    // ----- MutationObserver Setup -----
    /**
     * Handles DOM mutations to detect new tweets added to the timeline.
     * @param {MutationRecord[]} mutationsList - List of observed mutations.
     */
    function handleMutations(mutationsList) {

        for (const mutation of mutationsList) {
            handleThreads();
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach(node => {

                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.matches && node.matches(TWEET_ARTICLE_SELECTOR)) {
                            scheduleTweetProcessing(node);
                        }
                        else if (node.querySelectorAll) {
                            const tweetsInside = node.querySelectorAll(TWEET_ARTICLE_SELECTOR);
                            tweetsInside.forEach(scheduleTweetProcessing);
                        }
                    }
                });
            }
        }
    }

    // ----- Initialization -----

    /**
     * Validates that critical UI elements exist after creation.
     * Logs warnings for any missing elements.
     */
    function validateUIElements() {
        console.log('Simplified logging enabled. All tweet processing will be logged at completion.');
        
        const requiredElements = [
            { id: 'openrouter-api-key', description: 'API Key Input' },
            { id: 'model-selector', description: 'Model Selector' },
            { id: 'image-model-selector', description: 'Image Model Selector' },
            { id: 'handle-input', description: 'Handle Input' },
            { id: 'handle-list', description: 'Handle List' },
            { id: 'user-instructions', description: 'User Instructions Textarea' },
            { id: 'tweet-filter-container', description: 'Filter Container' },
            { id: 'settings-container', description: 'Settings Container' },
            { id: 'settings-tab', description: 'Settings Tab' },
            { id: 'instructions-tab', description: 'Instructions Tab' }
        ];

        let allValid = true;
        for (const element of requiredElements) {
            const el = document.getElementById(element.id);
            if (!el) {
                console.error(`UI Validation: ${element.description} (${element.id}) is missing`);
                allValid = false;
            }
        }

        if (allValid) {
            console.log('UI validation successful: All required elements exist');
        } else {
            console.error('UI validation failed: Some elements are missing. Check the error messages above.');
        }

        return allValid;
    }

    /**
     * Initializes the observer on the main content area, adds the UI elements,
     * starts processing visible tweets, and sets up periodic checks.
     */
    function initializeObserver() {
        const target = document.querySelector('main') || document.querySelector('div[data-testid="primaryColumn"]');
        if (target) {
            observedTargetNode = target;
            console.log("X/Twitter Tweet De-Sloppification: Target node found. Observing...");
            addSliderUI();
            addSettingsUI();
            
            // Validate that UI elements were created correctly
            validateUIElements();
            
            // Create and add status indicator element
            const statusIndicator = document.createElement('div');
            statusIndicator.id = 'status-indicator';
            document.body.appendChild(statusIndicator);
            
            // If no API key is found, prompt the user
            const apiKey = GM_getValue('openrouter-api-key', '');
            if (!apiKey) {
                showStatus("No API key found. Please enter your OpenRouter API key.");
            } else {
                showStatus(`Loaded ${Object.keys(tweetIDRatingCache).length} cached ratings. Starting to rate visible tweets...`);
                fetchAvailableModels();
            }
            
            // Process all currently visible tweets
            observedTargetNode.querySelectorAll(TWEET_ARTICLE_SELECTOR).forEach(scheduleTweetProcessing);
            const observer = new MutationObserver(handleMutations);
            observer.observe(observedTargetNode, { childList: true, subtree: true });
            
            // Periodically ensure all tweets have been processed
            setInterval(ensureAllTweetsRated, 3000);
            
            window.addEventListener('beforeunload', () => {
                saveTweetRatings();
                observer.disconnect();
                const sliderUI = document.getElementById('tweet-filter-container');
                if (sliderUI) sliderUI.remove();
                const settingsUI = document.getElementById('settings-container');
                if (settingsUI) settingsUI.remove();
                const statusIndicator = document.getElementById('status-indicator');
                if (statusIndicator) statusIndicator.remove();
                console.log("X/Twitter Tweet De-Sloppification Deactivated.");
            });
        } else {
            setTimeout(initializeObserver, 1000);
        }
    }

    /**
     * Fetches the list of available models from the OpenRouter API.
     * Uses the stored API key, and updates the model selector upon success.
     */
    function fetchAvailableModels() {
        const apiKey = GM_getValue('openrouter-api-key', '');
        if (!apiKey) {
            console.log('No API key available, skipping model fetch');
            return;
        }
        const refreshBtn = document.querySelector('.refresh-models');
        if (refreshBtn) refreshBtn.classList.add('refreshing');
        showStatus('Fetching available models...');
        GM_xmlhttpRequest({
            method: "GET",
            url: "https://openrouter.ai/api/v1/models",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "HTTP-Referer": "https://twitter.com",
                "X-Title": "Tweet Rating Tool"
            },
            onload: function (response) {
                if (refreshBtn) refreshBtn.classList.remove('refreshing');
                if (response.status >= 200 && response.status < 300) {
                    try {
                        const data = JSON.parse(response.responseText);
                        availableModels = data.data || [];
                        console.log(`Fetched ${availableModels.length} models from OpenRouter`);
                        updateModelSelector();
                        updateImageModelSelector();
                        showStatus(`Loaded ${availableModels.length} models!`);
                    } catch (error) {
                        console.error('Error parsing model list:', error);
                        showStatus('Error loading models!');
                    }
                } else {
                    console.error(`Failed to fetch models: ${response.status}`);
                    showStatus('Error fetching models!');
                }
            },
            onerror: function (error) {
                if (refreshBtn) refreshBtn.classList.remove('refreshing');
                console.error('Error fetching models:', error);
                showStatus('Failed to fetch models!');
            }
        });
    }

    // Start observing tweets and initializing the UI
    initializeObserver();

    /**
     * Adds a UI panel for user-defined instructions for the scoring model.
     */
    function addInstructionsUI() {
        if (document.getElementById('instructions-container')) return;

        // Create toggle button
        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'instructions-toggle';
        toggleBtn.className = 'toggle-button';
        toggleBtn.textContent = 'Scoring Instructions';
        toggleBtn.onclick = () => {
            const container = document.getElementById('instructions-container');
            if (container.classList.contains('hidden')) {
                container.classList.remove('hidden');
                toggleBtn.textContent = 'Hide Instructions';
            } else {
                container.classList.add('hidden');
                toggleBtn.textContent = 'Scoring Instructions';
            }
        };
        document.body.appendChild(toggleBtn);

        const container = document.createElement('div');
        container.id = 'instructions-container';
        container.classList.add('hidden');

        // Add close button
        const closeBtn = document.createElement('button');
        closeBtn.className = 'close-button';
        closeBtn.innerHTML = '×';
        closeBtn.onclick = () => {
            container.classList.add('hidden');
            toggleBtn.textContent = 'Scoring Instructions';
        };
        container.appendChild(closeBtn);

        // Title
        const title = document.createElement('div');
        title.textContent = 'Custom Tweet Scoring Instructions';
        title.style.fontWeight = 'bold';
        container.appendChild(title);

        // Description
        const description = document.createElement('div');
        description.textContent = 'Add custom instructions for how the model should score tweets. These will be applied to all tweet ratings.';
        description.style.fontSize = '12px';
        description.style.marginTop = '4px';
        description.style.marginBottom = '8px';
        description.style.opacity = '0.8';
        container.appendChild(description);

        // Textarea for instructions
        const instructionsTextarea = document.createElement('textarea');
        instructionsTextarea.id = 'user-instructions';
        instructionsTextarea.placeholder = 'Examples:\n- Give high scores to tweets about technology\n- Penalize clickbait-style tweets\n- Rate educational content higher\n- Ignore political bias when scoring';
        instructionsTextarea.value = GM_getValue('userDefinedInstructions', '');
        container.appendChild(instructionsTextarea);

        // Save button
        const saveBtn = document.createElement('button');
        saveBtn.id = 'save-instructions';
        saveBtn.textContent = 'Save Instructions';
        saveBtn.onclick = () => {
            USER_DEFINED_INSTRUCTIONS = instructionsTextarea.value;
            GM_setValue('userDefinedInstructions', USER_DEFINED_INSTRUCTIONS);
            showStatus('Scoring instructions saved! New tweets will use these instructions.');

            // Clear cache if user wants to re-rate existing tweets with new instructions
            if (confirm('Do you want to clear the rating cache to apply these instructions to all tweets?')) {
                clearTweetRatings();
            }
        };
        container.appendChild(saveBtn);

        document.body.appendChild(container);
    }

    /**
     * Structured debug logger with grouping and consistent format.
     * @param {string} tweetId - The tweet ID for identifying the log group.
     * @param {string} handle - The author's handle.
     * @param {Object} data - Data to log (media URLs, contexts, ratings, etc.).
     * @param {boolean} [isError=false] - Whether this is an error log.
     */
    function debugLog(tweetId, handle, data, isError = false) {
        // Only log if we're in a development environment or debug mode
        // You could add a debug mode toggle in settings if needed
        
        const groupTitle = `Tweet ${tweetId} (@${handle})`;
        
        if (isError) {
            console.group(`❌ ERROR: ${groupTitle}`);
        } else {
            console.groupCollapsed(`🔍 ${groupTitle}`);
        }
        
        // Log each piece of data with clear labels
        if (data.mediaUrls && data.mediaUrls.length) {
            console.log('📷 Media URLs:', data.mediaUrls);
        }
        
        if (data.fullContext) {
            console.log('📝 Full Context:', data.fullContext);
        }
        
        if (data.imageDescription) {
            console.log('🖼️ Image Description:', data.imageDescription);
        }
        
        if (data.modelResponse) {
            console.log('🤖 Model Response:', data.modelResponse);
        }
        
        if (data.score !== undefined) {
            console.log(`⭐ Rating Score: ${data.score}/10`);
        }
        
        if (data.error) {
            console.error('Error Details:', data.error);
        }
        
        // Additional custom data
        for (const [key, value] of Object.entries(data)) {
            if (!['mediaUrls', 'fullContext', 'imageDescription', 'modelResponse', 'score', 'error'].includes(key)) {
                console.log(`${key}:`, value);
            }
        }
        
        console.groupEnd();
    }

    /**
     * Simple debug logger that logs all relevant information about a tweet rating in a single log.
     * @param {string} tweetId - The tweet ID.
     * @param {string} handle - The author's handle.
     * @param {Object} data - Complete data about the tweet and its rating.
     * @param {boolean} [isError=false] - Whether this is an error log.
     */
    function debugLog(tweetId, handle, data, isError = false) {
        // Just store the log data for now, actual logging happens at the end of processing
        if (!tweetId || !handle) return;
        
        // We don't actually log here, we just add to the log data
        if (!data.logged) {
            data.tweetId = tweetId;
            data.handle = handle;
            data.isError = isError;
            data.logged = false; // Will be set to true when logged
        }
    }
    
    /**
     * Logs the final rating result once all processing is complete.
     * @param {string} tweetId - The tweet ID.
     * @param {string} handle - The author's handle.
     * @param {Object} data - Complete data about the tweet and its rating.
     */
    function logFinalRating(tweetId, handle, data) {
        if (!tweetId || !handle) return;
        
        const prefix = data.isError ? "❌ ERROR: " : "";
        
        // Build a single, comprehensive log message
        console.log(`${prefix}Tweet ${tweetId} (@${handle}) - ${data.status || ""} - Score: ${data.score || "N/A"}`);
        
        // Log media if present
        if (data.mediaUrls && data.mediaUrls.length) {
            console.log(`Media URLs:`, data.mediaUrls);
        }
        
        // Log the full context
        if (data.fullContext) {
            console.log(`Tweet context:`, data.fullContext);
        }
        
        // Log model response
        if (data.modelResponse) {
            console.log(`Model response:`, data.modelResponse);
        }
        
        // Log errors if any
        if (data.error) {
            console.error(`Error:`, data.error);
        }
        
        // Mark as logged
        data.logged = true;
    }

})();