// ==UserScript==
// @name         X/Twitter Tweet De-Sloppification (Enhanced)
// @namespace    http://tampermonkey.net/
// @version      5.1
// @description  Advanced tweet rating and filtering with model search, enhanced rating indicator, API retry functionalities, and blacklist support.
// @author       Buddy & You
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
    let currentFilterThreshold = 5; // Filter threshold for tweet visibility
    let observedTargetNode = null;
    let lastAPICallTime = 0;
    let pendingRequests = 0;
    let availableModels = []; // List of models fetched from API
    let selectedModel = GM_getValue('selectedModel', 'deepseek/deepseek-r1-distill-llama-70b');
    let blacklistedHandles = GM_getValue('blacklistedHandles', '').split('\n').filter(h => h.trim() !== '');

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
        Modern Twitter-Inspired Styles
        ---------------------------------
        This stylesheet provides sleek, modern styling for tweet filter containers,
        API key and settings UI, rating indicators, and description boxes.
    */
    
    /* Main tweet filter container */
    #tweet-filter-container {
        position: fixed;
        top: 70px;
        right: 15px;
        background-color: rgba(29, 155, 240, 0.9);
        color: white;
        padding: 12px 15px;
        border-radius: 8px;
        z-index: 9999;
        font-family: sans-serif;
        font-size: 13px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        display: flex;
        align-items: center;
        gap: 12px;
    }
    
    #tweet-filter-container label {
        margin: 0;
        font-weight: bold;
    }
    
    #tweet-filter-slider {
        cursor: pointer;
        width: 120px;
        vertical-align: middle;
    }
    
    #tweet-filter-value {
        min-width: 20px;
        text-align: center;
        font-weight: bold;
        background-color: rgba(0, 0, 0, 0.2);
        padding: 2px 5px;
        border-radius: 4px;
    }
    
    /* API key and settings UI */
    #api-key-container {
        position: fixed;
        top: 120px;
        right: 15px;
        background-color: rgba(29, 155, 240, 0.9);
        color: white;
        padding: 12px 15px;
        border-radius: 8px;
        z-index: 9999;
        font-family: sans-serif;
        font-size: 13px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        display: flex;
        flex-direction: column;
        gap: 8px;
        width: 300px;
    }
    
    #api-key-form {
        width: 100%;
    }
    
    #openrouter-api-key,
    #model-selector,
    #model-search-box {
        width: 100%;
        padding: 5px;
        border-radius: 4px;
        border: none;
        margin-top: 5px;
    }
    
    .button-row {
        display: flex;
        gap: 5px;
    }
    
    .button-row button {
        flex: 1;
    }
    
    #save-api-key {
        margin-top: 5px;
        background-color: white;
        color: #1d9bf0;
        border: none;
        border-radius: 4px;
        padding: 5px 10px;
        cursor: pointer;
        font-weight: bold;
    }
    
    #test-connection {
        margin-top: 5px;
        background-color: #4CAF50;
        color: white;
        border: none;
        border-radius: 4px;
        padding: 5px 10px;
        cursor: pointer;
        font-weight: bold;
    }
    
    #clear-cache {
        margin-top: 5px;
        background-color: #f44336;
        color: white;
        border: none;
        border-radius: 4px;
        padding: 5px 10px;
        cursor: pointer;
        font-weight: bold;
    }
    
    #blacklist-handles {
        width: 100%;
        height: 80px;
        padding: 5px;
        border-radius: 4px;
        border: none;
        margin-top: 5px;
        resize: vertical;
        font-family: monospace;
        font-size: 12px;
    }
    
    /* Rating indicator shown on tweets */
    .score-indicator {
        position: absolute;
        top: 5px;
        right: 5px;
        background-color: rgba(29, 155, 240, 0.9);
        color: white;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: bold;
        z-index: 100;
        cursor: pointer;
    }
    
    /* The description box appended to document.body */
    .score-description {
        display: none;
        background-color: #fff;
        color: #333;
        padding: 12px 16px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        font-size: 14px;
        line-height: 1.4;
        z-index: 99999999;  /* Ensures it appears on top of all content */
        position: absolute;
        max-width: 300px;
    }
    
    /* Rating status classes */
    .cached-rating {
        background-color: rgba(76, 175, 80, 0.9) !important;
    }
    
    .blacklisted-rating {
        background-color: rgba(255, 193, 7, 0.9) !important;
    }
    
    .pending-rating {
        background-color: rgba(255, 165, 0, 0.9) !important;
    }
    
    .error-rating {
        background-color: rgba(255, 0, 0, 0.9) !important;
    }
    
    /* Status indicator at bottom-right */
    #status-indicator {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background-color: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 12px;
        z-index: 9999;
        display: none;
    }
    
    #status-indicator.active {
        display: block;
    }
    
    /* Section titles */
    .section-title {
        font-weight: bold;
        margin-top: 10px;
        margin-bottom: 5px;
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
        color: white;
        font-size: 14px;
        cursor: pointer;
        margin-left: 5px;
    }
    
    .refresh-models:hover {
        color: #f1f1f1;
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
     */
    function updateModelSelector(filter = '') {
        const selector = document.getElementById('model-selector');
        if (!selector) return;
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
                if (filter && !displayText.toLowerCase().includes(filter.toLowerCase())) {
                    return; // Skip options that don't match the search query
                }
                const option = document.createElement('option');
                option.value = model.id;
                option.textContent = displayText;
                if (model.id === selectedModel) {
                    option.selected = true;
                }
                selector.appendChild(option);
            });
        }

        // If no matching models, add the selected model to the list
        if (selector.options.length === 0 || !Array.from(selector.options).some(opt => opt.value === selectedModel)) {
            const option = document.createElement('option');
            option.value = selectedModel;
            option.textContent = selectedModel;
            option.selected = true;
            selector.appendChild(option);
        }
    }

    /**
     * Adds the filtering slider UI to the page.
     */
    function addSliderUI() {
        if (document.getElementById('tweet-filter-container')) return;
        const container = document.createElement('div');
        container.id = 'tweet-filter-container';
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
            applyFilteringToAll();
        });
        container.appendChild(label);
        container.appendChild(slider);
        container.appendChild(valueDisplay);
        document.body.appendChild(container);
    }

    /**
     * Adds the API key, model selector, model search box, and blacklist UI.
     */
    function addApiKeyUI() {
        if (document.getElementById('api-key-container')) return;
        const container = document.createElement('div');
        container.id = 'api-key-container';

        // Title for the settings panel
        const title = document.createElement('div');
        title.textContent = 'OpenRouter API Key';
        title.style.fontWeight = 'bold';

        // Form for API key and settings
        const form = document.createElement('form');
        form.id = 'api-key-form';
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const input = document.getElementById('openrouter-api-key');
            GM_setValue('openrouter-api-key', input.value);
            // Save model selection
            const modelSelector = document.getElementById('model-selector');
            if (modelSelector && modelSelector.value) {
                selectedModel = modelSelector.value;
                GM_setValue('selectedModel', selectedModel);
            }
            // Save blacklist
            const blacklistTextarea = document.getElementById('blacklist-handles');
            if (blacklistTextarea) {
                const handles = blacklistTextarea.value.split('\n').filter(h => h.trim() !== '');
                blacklistedHandles = handles;
                GM_setValue('blacklistedHandles', blacklistTextarea.value);
            }
            alert('Settings saved!');
            showStatus("Settings saved!");
            // Fetch models with new API key
            fetchAvailableModels();
        });

        // API Key input field
        const apiKeyLabel = document.createElement('div');
        apiKeyLabel.className = 'section-title';
        apiKeyLabel.textContent = 'API Key:';
        const input = document.createElement('input');
        input.type = 'password';
        input.id = 'openrouter-api-key';
        input.placeholder = 'Enter API key';
        input.value = GM_getValue('openrouter-api-key', '');

        // Model Selector Section
        const modelLabel = document.createElement('div');
        modelLabel.className = 'section-title';
        modelLabel.textContent = 'LLM Model:';
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

        // Search box for filtering models
        const modelSearchBox = document.createElement('input');
        modelSearchBox.id = 'model-search-box';
        modelSearchBox.type = 'text';
        modelSearchBox.placeholder = 'Search models...';
        modelSearchBox.addEventListener('input', function (e) {
            updateModelSelector(this.value);
        });

        // Dropdown for model selection
        const modelSelector = document.createElement('select');
        modelSelector.id = 'model-selector';

        // Blacklist Section
        const blacklistLabel = document.createElement('div');
        blacklistLabel.className = 'section-title';
        blacklistLabel.textContent = 'Auto-Rate These Handles as 10/10:';
        const blacklistTextarea = document.createElement('textarea');
        blacklistTextarea.id = 'blacklist-handles';
        blacklistTextarea.placeholder = 'Enter Twitter handles, one per line';
        blacklistTextarea.value = GM_getValue('blacklistedHandles', '');

        // Buttons: Save Settings, Test Connection, Clear Cache
        const saveBtn = document.createElement('button');
        saveBtn.id = 'save-api-key';
        saveBtn.textContent = 'Save Settings';
        saveBtn.type = 'submit';
        const testBtn = document.createElement('button');
        testBtn.id = 'test-connection';
        testBtn.textContent = 'Test Connection';
        testBtn.type = 'button';
        testBtn.addEventListener('click', testAPIConnection);
        const clearBtn = document.createElement('button');
        clearBtn.id = 'clear-cache';
        clearBtn.textContent = 'Clear Rating Cache';
        clearBtn.type = 'button';
        clearBtn.addEventListener('click', clearTweetRatings);

        const buttonRow1 = document.createElement('div');
        buttonRow1.className = 'button-row';
        buttonRow1.appendChild(saveBtn);
        buttonRow1.appendChild(testBtn);
        const buttonRow2 = document.createElement('div');
        buttonRow2.className = 'button-row';
        buttonRow2.appendChild(clearBtn);

        // Assemble form elements
        form.appendChild(apiKeyLabel);
        form.appendChild(input);
        form.appendChild(modelLabel);
        form.appendChild(modelSearchBox); // New search box added here
        form.appendChild(modelSelector);
        form.appendChild(blacklistLabel);
        form.appendChild(blacklistTextarea);
        form.appendChild(buttonRow1);
        form.appendChild(buttonRow2);

        container.appendChild(title);
        container.appendChild(form);
        document.body.appendChild(container);

        // Populate model selector with current models (filtered if needed)
        updateModelSelector();
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
        descBox.textContent = description;
        
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
            // Set the description box’s position relative to the document
            descBox.style.position = 'absolute';
            descBox.style.left = (rect.right + 10 + window.scrollX) + 'px'; // 10px gap to the right
            // Vertically center the box relative to the indicator
            // We'll adjust after making it visible to get its height
            descBox.style.display = 'block';
            // After rendering, adjust top based on the box's height
            const boxHeight = descBox.offsetHeight;
            descBox.style.top = (rect.top + window.scrollY + rect.height / 2 - boxHeight / 2) + 'px';
        };
        indicator.onmouseleave = () => {
            descBox.style.display = 'none';
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
    async function getImageDescription(urls, apiKey) {
        let userMessage = [
            {
                "type": "text",
                "text": "Return a brief description of each image in the format [IMAGE 1]: Description, [IMAGE 2]: Description, etc."
            }
        ];
        urls.forEach((url) => {
            userMessage.push({ "type": "image_url", "image_url": { "url": url } });
        });

        return new Promise((resolve) => {
            GM.xmlHttpRequest({
                method: "POST",
                url: 'https://openrouter.ai/api/v1/chat/completions',
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                data: JSON.stringify({
                    model: 'openrouter/quasar-alpha',
                    messages: [
                        {
                            role: "user",
                            content: userMessage
                        }
                    ],
                }),
                onload: function (response) {
                    if (response.status === 200) {
                        const data = JSON.parse(response.responseText);
                        resolve(data.choices[0].message.content);
                    } else {
                        console.error(`Server responded with status ${response.status}`);
                        resolve("Error fetching image description.");
                    }
                },
                onerror: function (error) {
                    console.error('Error fetching image description:', error);
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
                //console.log(tweetText);
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
                                    `You are an expert critic of tweets.
                                Read the following tweet carefully and analyze its clarity, insightfulness, creativity, and overall impact. 
                                Provide a concise explanation of your reasoning and then, on a new line, output your final rating in the exact format: 
                                [SCORE: X], where X is a number from 1 (lowest quality) to 10 (highest quality).
                                Tweet:
                                ${tweetText}`
                            }
                        ],
                        "temperature": 0.8,
                        "max_tokens": 12000
                    }),
                    timeout: 30000, // 30 seconds timeout
                    onload: function (response) {
                        pendingRequests--;
                        if (response.status >= 200 && response.status < 300) {
                            try {
                                const data = JSON.parse(response.responseText);
                                const content = data.choices?.[0]?.message?.content;
                                if (!content) {
                                    console.warn('No content in OpenRouter response');
                                    resolve({ score: 5, content: "No content in OpenRouter response", error: true });
                                    return;
                                }
                                console.debug(`OpenRouter response: ${content}`);
                                // New extraction logic: Look for a line with [SCORE: number]
                                const scoreMatch = content.match(/\[SCORE:\s*(\d+)\s*\]/);
                                if (scoreMatch) {
                                    const score = parseInt(scoreMatch[1], 10);
                                    // Cache the score in both caches

                                    tweetIDRatingCache[tweetId] = { score: score, description: content };
                                    saveTweetRatings();
                                    resolve({ score: score, content: content, error: false });
                                    return;
                                } else {
                                    console.warn('Could not extract rating from OpenRouter response:', content);
                                    resolve({ score: 5, content: "No content in OpenRouter response", error: true });
                                    return;
                                }
                            } catch (error) {
                                console.error('Error parsing OpenRouter response:', error);
                                resolve({ score: 5, content: "No content in OpenRouter response", error: true });
                                return;
                            }
                        } else {
                            // Handle non-successful response statuses here (retry logic, etc.)
                            console.error(`OpenRouter API error: ${response.status}`);
                            // Retry logic or immediate fallback would go here
                            resolve({ score: 5,content: "No content in OpenRouter response", error: true });
                        }
                    }
                    ,
                    onerror: function (error) {
                        pendingRequests--;
                        console.error('Error making request to OpenRouter:', error);
                        if (currentAttempt < maxAttempts) {
                            setTimeout(() => { attemptRating(currentAttempt + 1); }, API_CALL_DELAY_MS);
                        } else {
                            resolve({ score: 5, content: "No content in OpenRouter response", error: true });
                        }
                    },
                    ontimeout: function () {
                        pendingRequests--;
                        console.error('OpenRouter request timed out');
                        if (currentAttempt < maxAttempts) {
                            setTimeout(() => { attemptRating(currentAttempt + 1); }, API_CALL_DELAY_MS);
                        } else {
                            resolve({ score: 5,content: "No content in OpenRouter response", error: true });
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
    async function delayedProcessTweet(tweetArticle, tweetId) {
    const apiKey = GM_getValue('openrouter-api-key', '');
    console.groupCollapsed(`Tweet Log (Delayed ${PROCESSING_DELAY_MS}ms): ${tweetId}`);
    let score = 5; // Default score if rating fails
    let description = "";
    try {
        // Check if tweet's author is blacklisted (fast path)
        const userHandle = getUserHandle(tweetArticle);
        if (userHandle && isUserBlacklisted(userHandle)) {
            console.debug(`[${tweetId}] Author @${userHandle} is blacklisted, assigning score 10`);
            tweetArticle.dataset.sloppinessScore = '10';
            tweetArticle.dataset.blacklisted = 'true';
            tweetArticle.dataset.ratingStatus = 'rated';
            tweetArticle.dataset.ratingDescription = "Blacklisted user";
            setScoreIndicator(tweetArticle, 10, 'rated', "Blacklisted user");
            filterSingleTweet(tweetArticle);
            console.groupEnd();
            return;
        }

        // Check if a cached rating exists (either ID-based or text-based)
        if (applyTweetCachedRating(tweetArticle)) {
            // Even if cached, update conversation context if possible.
            if (tweetArticle.dataset.fullContextWithImageDescription) {
                updateConversationContext(tweetArticle, tweetArticle.dataset.fullContextWithImageDescription);
            }
            console.debug(`[${tweetId}] Using cached rating: ${tweetArticle.dataset.sloppinessScore}`);
            console.groupEnd();
            return;
        }

        // --- Set pending status before calling API ---
        tweetArticle.dataset.ratingStatus = 'pending';
        setScoreIndicator(tweetArticle, null, 'pending');

        // --- Extract Main Tweet Content ---
        const mainText = getElementText(tweetArticle.querySelector(TWEET_TEXT_SELECTOR));
        const mainMediaLinks = extractMediaLinks(tweetArticle, tweetId);

        // --- Extract Quoted Tweet Content (if any) ---
        let quotedText = "";
        let quotedMediaLinks = [];
        const quoteContainer = tweetArticle.querySelector(QUOTE_CONTAINER_SELECTOR);
        if (quoteContainer) {
            quotedText = getElementText(quoteContainer.querySelector(TWEET_TEXT_SELECTOR));
            quotedMediaLinks = extractMediaLinks(quoteContainer, tweetId);
        }

        let fullContext = `${userHandle}\n` + mainText;
        let fullContextWithImageDescription = fullContext;

        if (mainMediaLinks.length > 0) {
            let mainMediaLinksDescription = await getImageDescription(mainMediaLinks, apiKey);
            fullContext += "\nMedia: " + mainMediaLinks.join(", ");
            fullContextWithImageDescription += "\nMedia Description: " + mainMediaLinksDescription;
        }
        if (quotedText) {
            fullContext += "\nQuoted tweet: " + quotedText;
            fullContextWithImageDescription += "\nQuoted tweet: " + quotedText;
            if (quotedMediaLinks.length > 0) {
                let quotedMediaLinksDescription = await getImageDescription(quotedMediaLinks, apiKey);
                fullContext += "\nQuoted Media: " + quotedMediaLinks.join(", ");
                fullContextWithImageDescription += "\nQuoted Media Description: " + quotedMediaLinksDescription;
            }
        }

        // --- Save full context in dataset for future reference ---
        tweetArticle.dataset.fullContextWithImageDescription = fullContextWithImageDescription;

        // --- Conversation Thread Handling ---
        // Even if the tweet isn’t newly processed, update the conversation container.
        updateConversationContext(tweetArticle, fullContextWithImageDescription);

        console.debug(`[${tweetId}] Full context for rating: ${fullContextWithImageDescription}`);

        // --- API Call or Fallback ---
        if (apiKey && fullContext) {
            try {
                const rating = await rateTweetWithOpenRouter(fullContextWithImageDescription, tweetId, apiKey);
                score = rating.score;
                description = rating.content;
                tweetArticle.dataset.ratingStatus = rating.error ? 'error' : 'rated';
                tweetArticle.dataset.ratingDescription = description || "not available";
            } catch (apiError) {
                console.error(`[${tweetId}] API error:`, apiError);
                score = Math.floor(Math.random() * 10) + 1; // Fallback to a random score
                tweetArticle.dataset.ratingStatus = 'error';
            }
        } else {
            // Fallback if there's no API key or textual content.
            score = Math.floor(Math.random() * 10) + 1;
            tweetArticle.dataset.ratingStatus = 'rated';
            if (!apiKey) {
                console.debug(`[${tweetId}] No API key - using random score: ${score}`);
            } else if (!fullContext) {
                console.debug(`[${tweetId}] No textual content - using random score: ${score}`);
            }
        }

        tweetArticle.dataset.sloppinessScore = score.toString();
        setScoreIndicator(tweetArticle, score, tweetArticle.dataset.ratingStatus, tweetArticle.dataset.ratingDescription);
        filterSingleTweet(tweetArticle);
        console.log(`${tweetId}: ${fullContext} (Score: ${score})`);
    } catch (error) {
        console.error("Error processing tweet:", tweetId, error);
        if (!tweetArticle.dataset.sloppinessScore) {
            tweetArticle.dataset.sloppinessScore = '5';
            tweetArticle.dataset.ratingStatus = 'error';
            tweetArticle.dataset.ratingDescription = "error processing tweet";
            setScoreIndicator(tweetArticle, 5, 'error', 'Error processing tweet');
            filterSingleTweet(tweetArticle);
        }
    } finally {
        console.groupEnd();
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
            
            tweetArticle.dataset.ratingDescription="Whitelisted user";
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

    // ----- MutationObserver Setup -----

    /**
     * Handles DOM mutations to detect new tweets added to the timeline.
     * @param {MutationRecord[]} mutationsList - List of observed mutations.
     */
    function handleMutations(mutationsList) {
        for (const mutation of mutationsList) {
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
     * Initializes the observer on the main content area, adds the UI elements,
     * starts processing visible tweets, and sets up periodic checks.
     */
    function initializeObserver() {
        const target = document.querySelector('main') || document.querySelector('div[data-testid="primaryColumn"]');
        if (target) {
            observedTargetNode = target;
            console.log("X/Twitter Tweet De-Sloppification: Target node found. Observing...");
            addSliderUI();
            addApiKeyUI();
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
                const apiKeyUI = document.getElementById('api-key-container');
                if (apiKeyUI) apiKeyUI.remove();
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

})();
