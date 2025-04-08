// ==UserScript==
// @name         AI Tweet Filter for Twitter/X
// @namespace    http://tampermonkey.net/
// @version      Version 1.2
// @description  A highly customizable AI rates tweets 1-10 and removes all the slop, saving your braincells!// @author       Obsxrver
// @match        *://twitter.com/*
// @match        *://x.com/*
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @connect      openrouter.ai
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';

    console.log("X/Twitter Tweet De-Sloppification Activated (v5.1 - Enhanced)");

    // ----- Global Variables & Caches -----
    const processedTweets = new Set(); // Set of tweet IDs already processed in this session
    const tweetIDRatingCache = {}; // ID-based cache for persistent storage
    const PROCESSING_DELAY_MS = 1000; // Delay before processing a tweet (ms)
    const API_CALL_DELAY_MS = 250; // Minimum delay between API calls (ms)
    let USER_DEFINED_INSTRUCTIONS = GM_getValue('userDefinedInstructions', '');
    let currentFilterThreshold = GM_getValue('filterThreshold', 1); // Filter threshold for tweet visibility
    let observedTargetNode = null;
    let lastAPICallTime = 0;
    let pendingRequests = 0;
    let availableModels = []; // List of models fetched from API
    let selectedModel = GM_getValue('selectedModel', 'mistralai/mistral-small-3.1-24b-instruct');
    let selectedImageModel = GM_getValue('selectedImageModel', 'mistralai/mistral-small-3.1-24b-instruct');
    let blacklistedHandles = GM_getValue('blacklistedHandles', '').split('\n').filter(h => h.trim() !== '');

    // Settings variables
    let enableImageDescriptions = GM_getValue('enableImageDescriptions', true);


    // Model parameters
    let modelTemperature = GM_getValue('modelTemperature', 0.5);
    let modelTopP = GM_getValue('modelTopP', 0.9);
    let imageModelTemperature = GM_getValue('imageModelTemperature', 0.5);
    let imageModelTopP = GM_getValue('imageModelTopP', 0.9);

    /**
     * Helper function to check if a model supports images based on its architecture
     * @param {string} modelId - The model ID to check
     * @returns {boolean} - Whether the model supports image input
     */
    function modelSupportsImages(modelId) {
        if (!availableModels || availableModels.length === 0) {
            return false; // If we don't have model info, assume it doesn't support images
        }

        const model = availableModels.find(m => m.slug === modelId);
        if (!model) {
            return false; // Model not found in available models list
        }

        // Check if model supports images based on its architecture
        return model.input_modalities &&
            model.input_modalities.includes('image');
    }

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
    const MEDIA_IMG_SELECTOR = 'div[data-testid="tweetPhoto"] img, img[src*="pbs.twimg.com/media"]';
    const MEDIA_VIDEO_SELECTOR = 'video[poster*="pbs.twimg.com"], video[poster*="pbs.twimg.com"]';
    const PERMALINK_SELECTOR = 'a[href*="/status/"] time';

    // ----- UI Styling -----
    GM_addStyle(`/*
        Modern X-Inspired Styles - Enhanced
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
        background: none;
        border: none;
        color: #e7e9ea;
        font-size: 16px;
        cursor: pointer;
        padding: 0;
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0.8;
        transition: opacity 0.2s;
        border-radius: 50%;
    }

    .close-button:hover {
        opacity: 1;
        background-color: rgba(255, 255, 255, 0.1);
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
        display: flex;
        align-items: center;
        gap: 6px;
        transition: all 0.2s ease;
    }
    
    .toggle-button:hover {
        background-color: rgba(29, 155, 240, 0.2);
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
        top: 70px;
        right: 15px;
        background-color: rgba(22, 24, 28, 0.95);
        color: #e7e9ea;
        padding: 0; /* Remove padding to accommodate sticky header */
        border-radius: 16px;
        z-index: 9999;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 13px;
        box-shadow: 0 2px 18px rgba(0, 0, 0, 0.6);
        display: flex;
        flex-direction: column;
        width: 380px;
        max-height: 85vh;
        overflow: hidden; /* Hide overflow to make the sticky header work properly */
        border: 1px solid rgba(255, 255, 255, 0.1);
        line-height: 1.3;
        transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        transform-origin: top right;
    }
    
    #settings-container.hidden {
        opacity: 0;
        transform: scale(0.9);
        pointer-events: none;
    }
    
    /* Header section */
    .settings-header {
        padding: 12px 15px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        display: flex;
        justify-content: space-between;
        align-items: center;
        position: sticky;
        top: 0;
        background-color: rgba(22, 24, 28, 0.98);
        z-index: 20;
        border-radius: 16px 16px 0 0;
    }
    
    .settings-title {
        font-weight: bold;
        font-size: 16px;
    }
    
    /* Content area with scrolling */
    .settings-content {
        overflow-y: auto;
        max-height: calc(85vh - 110px); /* Account for header and tabs */
        padding: 0;
    }
    
    /* Scrollbar styling for settings container */
    .settings-content::-webkit-scrollbar {
        width: 6px;
    }

    .settings-content::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.05);
        border-radius: 3px;
    }

    .settings-content::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 3px;
    }

    .settings-content::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.3);
    }

    /* Tab Navigation */
    .tab-navigation {
        display: flex;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        position: sticky;
        top: 0;
        background-color: rgba(22, 24, 28, 0.98);
        z-index: 10;
        padding: 10px 15px;
        gap: 8px;
    }

    .tab-button {
        padding: 6px 10px;
        background: none;
        border: none;
        color: #e7e9ea;
        font-weight: bold;
        cursor: pointer;
        border-radius: 8px;
        transition: all 0.2s ease;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 13px;
        flex: 1;
        text-align: center;
    }

    .tab-button:hover {
        background-color: rgba(255, 255, 255, 0.1);
    }

    .tab-button.active {
        color: #1d9bf0;
        background-color: rgba(29, 155, 240, 0.1);
        border-bottom: 2px solid #1d9bf0;
    }

    /* Tab Content */
    .tab-content {
        display: none;
        animation: fadeIn 0.3s ease;
        padding: 15px;
    }
    
    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }

    .tab-content.active {
        display: block;
    }

    /* Enhanced dropdowns */
    .select-container {
        position: relative;
        margin-bottom: 15px;
    }
    
    .select-container .search-field {
        position: sticky;
        top: 0;
        background-color: rgba(39, 44, 48, 0.95);
        padding: 8px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        z-index: 1;
    }
    
    .select-container .search-input {
        width: 100%;
        padding: 8px 10px;
        border-radius: 8px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        background-color: rgba(39, 44, 48, 0.9);
        color: #e7e9ea;
        font-size: 12px;
        transition: border-color 0.2s;
    }
    
    .select-container .search-input:focus {
        border-color: #1d9bf0;
        outline: none;
    }
    
    .custom-select {
        position: relative;
        display: inline-block;
        width: 100%;
    }
    
    .select-selected {
        background-color: rgba(39, 44, 48, 0.95);
        color: #e7e9ea;
        padding: 10px 12px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 8px;
        cursor: pointer;
        user-select: none;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 13px;
        transition: border-color 0.2s;
    }
    
    .select-selected:hover {
        border-color: rgba(255, 255, 255, 0.4);
    }
    
    .select-selected:after {
        content: "";
        width: 8px;
        height: 8px;
        border: 2px solid #e7e9ea;
        border-width: 0 2px 2px 0;
        display: inline-block;
        transform: rotate(45deg);
        margin-left: 10px;
        transition: transform 0.2s;
    }
    
    .select-selected.select-arrow-active:after {
        transform: rotate(-135deg);
    }
    
    .select-items {
        position: absolute;
        background-color: rgba(39, 44, 48, 0.98);
        top: 100%;
        left: 0;
        right: 0;
        z-index: 99;
        max-height: 300px;
        overflow-y: auto;
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 8px;
        margin-top: 5px;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
        display: none;
    }
    
    .select-items div {
        color: #e7e9ea;
        padding: 10px 12px;
        cursor: pointer;
        user-select: none;
        transition: background-color 0.2s;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }
    
    .select-items div:hover {
        background-color: rgba(29, 155, 240, 0.1);
    }
    
    .select-items div.same-as-selected {
        background-color: rgba(29, 155, 240, 0.2);
    }
    
    /* Scrollbar for select items */
    .select-items::-webkit-scrollbar {
        width: 6px;
    }
    
    .select-items::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.05);
    }
    
    .select-items::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 3px;
    }
    
    .select-items::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.3);
    }
    
    /* Form elements */
    #openrouter-api-key,
    #user-instructions {
        width: 100%;
        padding: 10px 12px;
        border-radius: 8px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        margin-bottom: 12px;
        background-color: rgba(39, 44, 48, 0.95);
        color: #e7e9ea;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 13px;
        transition: border-color 0.2s;
    }
    
    #openrouter-api-key:focus,
    #user-instructions:focus {
        border-color: #1d9bf0;
        outline: none;
    }

    #user-instructions {
        height: 120px;
        resize: vertical;
    }

    /* Parameter controls */
    .parameter-row {
        display: flex;
        align-items: center;
        margin-bottom: 12px;
        gap: 8px;
        padding: 6px;
        border-radius: 8px;
        transition: background-color 0.2s;
    }
    
    .parameter-row:hover {
        background-color: rgba(255, 255, 255, 0.05);
    }

    .parameter-label {
        flex: 1;
        font-size: 13px;
        color: #e7e9ea;
    }

    .parameter-control {
        flex: 1.5;
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .parameter-value {
        min-width: 28px;
        text-align: center;
        background-color: rgba(255, 255, 255, 0.1);
        padding: 3px 5px;
        border-radius: 4px;
        font-size: 12px;
    }

    .parameter-slider {
        flex: 1;
        -webkit-appearance: none;
        height: 4px;
        border-radius: 4px;
        background: rgba(255, 255, 255, 0.2);
        outline: none;
        cursor: pointer;
    }

    .parameter-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: #1d9bf0;
        cursor: pointer;
        transition: transform 0.1s;
    }
    
    .parameter-slider::-webkit-slider-thumb:hover {
        transform: scale(1.2);
    }

    /* Section styles */
    .section-title {
        font-weight: bold;
        margin-top: 20px;
        margin-bottom: 8px;
        color: #e7e9ea;
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 14px;
    }
    
    .section-title:first-child {
        margin-top: 0;
    }

    .section-description {
        font-size: 12px;
        margin-bottom: 8px;
        opacity: 0.8;
        line-height: 1.4;
    }
    
    /* Advanced options section */
    .advanced-options {
        margin-top: 5px;
        margin-bottom: 15px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        padding: 12px;
        background-color: rgba(255, 255, 255, 0.03);
        overflow: hidden;
    }
    
    .advanced-toggle {
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: pointer;
        margin-bottom: 5px;
    }
    
    .advanced-toggle-title {
        font-weight: bold;
        font-size: 13px;
        color: #e7e9ea;
    }
    
    .advanced-toggle-icon {
        transition: transform 0.3s;
    }
    
    .advanced-toggle-icon.expanded {
        transform: rotate(180deg);
    }
    
    .advanced-content {
        max-height: 0;
        overflow: hidden;
        transition: max-height 0.3s ease-in-out;
    }
    
    .advanced-content.expanded {
        max-height: 300px;
    }

    /* Handle list styling */
    .handle-list {
        margin-top: 10px;
        max-height: 120px;
        overflow-y: auto;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        padding: 5px;
    }

    .handle-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 6px 10px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 4px;
        transition: background-color 0.2s;
    }
    
    .handle-item:hover {
        background-color: rgba(255, 255, 255, 0.05);
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
        opacity: 0.7;
        transition: opacity 0.2s;
    }
    
    .remove-handle:hover {
        opacity: 1;
    }

    .add-handle-btn {
        background-color: #1d9bf0;
        color: white;
        border: none;
        border-radius: 6px;
        padding: 7px 10px;
        cursor: pointer;
        font-weight: bold;
        font-size: 12px;
        margin-left: 5px;
        transition: background-color 0.2s;
    }
    
    .add-handle-btn:hover {
        background-color: #1a8cd8;
    }

    /* Button styling */
    .settings-button {
        background-color: #1d9bf0;
        color: white;
        border: none;
        border-radius: 8px;
        padding: 10px 14px;
        cursor: pointer;
        font-weight: bold;
        transition: background-color 0.2s;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        margin-top: 8px;
        width: 100%;
        font-size: 13px;
    }

    .settings-button:hover {
        background-color: #1a8cd8;
    }

    .settings-button.secondary {
        background-color: rgba(255, 255, 255, 0.1);
    }
    
    .settings-button.secondary:hover {
        background-color: rgba(255, 255, 255, 0.15);
    }

    .settings-button.danger {
        background-color: #ff5c5c;
    }

    .settings-button.danger:hover {
        background-color: #e53935;
    }
    
    /* For smaller buttons that sit side by side */
    .button-row {
        display: flex;
        gap: 8px;
        margin-top: 10px;
    }
    
    .button-row .settings-button {
        margin-top: 0;
    }
    
    /* Stats display */
    .stats-container {
        background-color: rgba(255, 255, 255, 0.05);
        padding: 10px;
        border-radius: 8px;
        margin-bottom: 15px;
    }
    
    .stats-row {
        display: flex;
        justify-content: space-between;
        padding: 5px 0;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .stats-row:last-child {
        border-bottom: none;
    }
    
    .stats-label {
        font-size: 12px;
        opacity: 0.8;
    }
    
    .stats-value {
        font-weight: bold;
    }

    /* Rating indicator shown on tweets */ 
    .score-indicator {
        position: absolute;
        top: 10px;
        right: 10.5%;
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
        transition: transform 0.15s ease;
    }
    
    .score-indicator:hover {
        transform: scale(1.05);
    }

    /* Refresh animation */
    .refreshing {
        animation: spin 1s infinite linear;
    }

    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
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
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);
        transform: translateY(100px);
        transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }

    #status-indicator.active {
        display: block;
        transform: translateY(0);
    }
    
    /* Toggle switch styling */
    .toggle-switch {
        position: relative;
        display: inline-block;
        width: 36px;
        height: 20px;
    }
    
    .toggle-switch input {
        opacity: 0;
        width: 0;
        height: 0;
    }
    
    .toggle-slider {
        position: absolute;
        cursor: pointer;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(255, 255, 255, 0.2);
        transition: .3s;
        border-radius: 34px;
    }
    
    .toggle-slider:before {
        position: absolute;
        content: "";
        height: 16px;
        width: 16px;
        left: 2px;
        bottom: 2px;
        background-color: white;
        transition: .3s;
        border-radius: 50%;
    }
    
    input:checked + .toggle-slider {
        background-color: #1d9bf0;
    }
    
    input:checked + .toggle-slider:before {
        transform: translateX(16px);
    }
    
    .toggle-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 10px;
        margin-bottom: 12px;
        background-color: rgba(255, 255, 255, 0.05);
        border-radius: 8px;
        transition: background-color 0.2s;
    }
    
    .toggle-row:hover {
        background-color: rgba(255, 255, 255, 0.08);
    }
    
    .toggle-label {
        font-size: 13px;
        color: #e7e9ea;
    }

    /* Existing styles */
    
    /* Sort container styles */
    .sort-container {
        margin: 10px 0;
        display: flex;
        align-items: center;
        gap: 10px;
    }
    
    .sort-container label {
        font-size: 14px;
        color: var(--text-color);
    }
    
    .sort-container select {
        padding: 5px 10px;
        border-radius: 4px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        background-color: rgba(39, 44, 48, 0.95);
        color: #e7e9ea;
        font-size: 14px;
        cursor: pointer;
    }
    
    .sort-container select:hover {
        border-color: #1d9bf0;
    }
    
    .sort-container select:focus {
        outline: none;
        border-color: #1d9bf0;
        box-shadow: 0 0 0 2px rgba(29, 155, 240, 0.2);
    }
    
    /* Dropdown option styling */
    .sort-container select option {
        background-color: rgba(39, 44, 48, 0.95);
        color: #e7e9ea;
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
     * Adds the filtering slider UI to the page.
     * This will be shown by default.
     */
    function addSliderUI() {
        if (document.getElementById('tweet-filter-container')) return;

        // Create toggle button for reopening the slider
        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'filter-toggle';
        toggleBtn.className = 'toggle-button';
        toggleBtn.textContent = 'Filter Slider';
        toggleBtn.style.display = 'none'; // Hidden by default since slider is visible
        toggleBtn.onclick = () => {
            const container = document.getElementById('tweet-filter-container');
            if (container) {
                container.classList.remove('hidden');
                toggleBtn.style.display = 'none';
            }
        };
        document.body.appendChild(toggleBtn);

        const container = document.createElement('div');
        container.id = 'tweet-filter-container';

        // Add close button
        const closeBtn = document.createElement('button');
        closeBtn.className = 'close-button';
        closeBtn.innerHTML = '×';
        closeBtn.onclick = () => {
            container.classList.add('hidden');
            // Show the toggle button when slider is closed
            const filterToggle = document.getElementById('filter-toggle');
            if (filterToggle) {
                filterToggle.style.display = 'block';
            }
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
        
        // Find all images and videos in the tweet
        scopeElement.querySelectorAll(`${MEDIA_IMG_SELECTOR}, ${MEDIA_VIDEO_SELECTOR}`).forEach(mediaEl => {
            // Get the source URL (src for images, poster for videos)
            const sourceUrl = mediaEl.tagName === 'IMG' ? mediaEl.src : mediaEl.poster;
            
            // Skip if not a Twitter media URL
            if (!sourceUrl || 
               !(sourceUrl.includes('pbs.twimg.com/media') || 
                 sourceUrl.includes('pbs.twimg.com/amplify_video_thumb'))) {
                return;
            }
            
            try {
                // Parse the URL to handle format parameters
                const url = new URL(sourceUrl);
                const format = url.searchParams.get('format');
                const name = url.searchParams.get('name'); // 'small', 'medium', 'large', etc.
                
                // Create the final URL with the right format and size
                let finalUrl = sourceUrl;
                
                // Try to get the original size by removing size indicator
                if (name && name !== 'orig') {
                    // Replace format=jpg&name=small with format=jpg&name=orig
                    finalUrl = sourceUrl.replace(`name=${name}`, 'name=orig');
                }
                
                // Log both the original and final URLs for debugging
                console.log(`[Tweet ${tweetIdForDebug}] Processing media: ${sourceUrl} → ${finalUrl}`);
                
                mediaLinks.add(finalUrl);
            } catch (error) {
                console.error(`[Tweet ${tweetIdForDebug}] Error processing media URL: ${sourceUrl}`, error);
                // Fallback: just add the raw URL as is
                mediaLinks.add(sourceUrl);
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
            //console.debug(`Blacklisted user detected: ${userHandle}, assigning score 10`);
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
            //console.debug(`Applied cached rating for tweet ${tweetId}: ${score}`);
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
        if (!urls || urls.length === 0) return '';

        // Check if image descriptions are disabled
        if (!enableImageDescriptions) {
            return '[Image descriptions disabled]';
        }

        let imageDescriptions = ""
        // Add image URLs to the request
        for (let i = 0; i < urls.length; i++) {
            try {
                const requestBody = {
                    model: selectedImageModel,
                    messages: [
                        {
                            role: "user",
                            content: [
                                {
                                    type: "text",
                                    text: "Describe what you see in this image in a concise way, focusing on the main elements and any text visible. Keep the description under 100 words."
                                },
                                {
                                    type: "image_url",
                                    image_url: urls[i]
                                }
                            ]
                        }
                    ],
                    temperature: imageModelTemperature,
                    top_p: imageModelTopP
                };
                // Add provider sorting
                const sortOrder = GM_getValue('modelSortOrder', 'throughput-high-to-low');
                const sortType = sortOrder.split('-')[0]; // Extract sort type (price, throughput, latency)
                requestBody.provider = {
                    sort: sortType,
                    allow_fallbacks: true
                };
                const imageDescription = await new Promise((resolve) => {
                    GM.xmlHttpRequest({
                        method: "POST",
                        url: 'https://openrouter.ai/api/v1/chat/completions',
                        headers: {
                            Authorization: `Bearer ${apiKey}`,
                            'Content-Type': 'application/json',
                        },
                        data: JSON.stringify(requestBody),
                        onload: function (response) {
                            try {
                                if (response.status === 200) {
                                    const data = JSON.parse(response.responseText);
                                    if (data && data.choices && data.choices.length > 0 && data.choices[0].message) {
                                        resolve(data.choices[0].message.content || "[No description available]");
                                    } else {
                                        console.error("Invalid response structure from image API:", data);
                                        resolve("[Error: Invalid API response structure]");
                                    }
                                } else {
                                    console.error("Error fetching image description:", response.status, response.statusText);
                                    resolve(`[Error fetching image description: ${response.status}]`);
                                }
                            } catch (error) {
                                console.error("Exception while processing image API response:", error);
                                resolve("[Error processing image description]");
                            }
                        },
                        onerror: function (error) {
                            console.error("Network error while fetching image description:", error);
                            resolve("[Error: Network problem while fetching image description]");
                        },
                        ontimeout: function () {
                            console.error("Timeout while fetching image description");
                            resolve("[Error: Timeout while fetching image description]");
                        }
                    });
                });

                // Add the description to our aggregate with proper formatting
                imageDescriptions += `[IMAGE ${i + 1}]: ${imageDescription}\n`;
            } catch (error) {
                console.error(`Error getting description for image:`, error);
                return "[Error getting description]\n";
            }
        }
        return imageDescriptions;
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
    function rateTweetWithOpenRouter(tweetText, tweetId, apiKey, mediaUrls, attempt = 1, maxAttempts = 3) {
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

                let messages = [
                    {
                        "role": "user",
                        "content": [{
                            "type": "text", "text":
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
                        SCORE_X where X is a number from 1 (lowest quality) to 10 (highest quality).
                        for example: SCORE_1, SCORE_2, SCORE_3, etc.
                        If one of the above is not present, the program will not be able to parse the response and will return an error.
                        Ensure that you consider these additionaluser-defined instructions in your analysis and scoring:
                        [USER-DEFINED INSTRUCTIONS]:
                        ${USER_DEFINED_INSTRUCTIONS}
                        _______BEGIN TWEET_______
                        ${tweetText}
                        _______END TWEET_______`
                        }]
                    }];

                // Check if image descriptions are enabled AND we have media URLs
                if (mediaUrls && mediaUrls.length > 0) {
                    // Check if the selected model supports images
                    const supportsImages = modelSupportsImages(selectedModel);

                    if (supportsImages) {
                        console.log(`Adding ${mediaUrls.length} image(s) to the tweet rating request`);

                        // Convert message content to array format for multimodal input
                        const textContent = messages[0].content[0].text;
                        messages[0].content = [
                            {
                                "type": "text",
                                "text": textContent
                            }
                        ];

                        // Add each image URL to the message content
                        for (const url of mediaUrls) {
                            messages[0].content.push({
                                "type": "image_url",
                                "image_url": { "url": url }
                            });
                        }
                    } else {
                        console.log(`Selected model ${selectedModel} does not support images. Using text-only rating.`);
                    }
                } else {
                    if (!mediaUrls || mediaUrls.length === 0) {
                        console.log(`No media URLs to process for tweet ${tweetId}.`);
                    }
                }

                // Prepare the request body with provider options
                const requestBody = {
                    model: selectedModel,
                    messages: messages,
                    temperature: modelTemperature,
                    top_p: modelTopP
                };
                console.log(messages);
                // Add provider sorting
                const sortOrder = GM_getValue('modelSortOrder', 'throughput-high-to-low');
                const sortType = sortOrder.split('-')[0]; // Extract sort type (price, throughput, latency)
                requestBody.provider = {
                    sort: sortType,
                    allow_fallbacks: true
                };
                console.log(`Rating tweet ${tweetId} using model: ${selectedModel} with provider sort: ${sortType}`);

                GM_xmlhttpRequest({
                    method: "POST",
                    url: "https://openrouter.ai/api/v1/chat/completions",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${apiKey}`,
                        "HTTP-Referer": "https://twitter.com",
                        "X-Title": "Tweet Rating Tool"
                    },
                    data: JSON.stringify(requestBody),
                    timeout: 30000, // 30 seconds timeout
                    onload: function (response) {
                        pendingRequests--;

                        // Log the response status and headers for debugging
                        console.log(`API Response for tweet ${tweetId} - Status: ${response.status}`);

                        if (response.status >= 200 && response.status < 300) {
                            try {
                                const data = JSON.parse(response.responseText);
                                const content = data.choices?.[0]?.message?.content;

                                // Check if we have a proper response
                                if (!content) {
                                    console.error(`No content in OpenRouter response from ${selectedModel} for tweet ${tweetId}. Response:`, data);

                                    // Check for specific errors in the response
                                    if (data.error) {
                                        console.error(`Error from OpenRouter: ${data.error.message || JSON.stringify(data.error)}`);

                                        // Handle rate limiting errors
                                        if (data.error.type === 'rate_limit_exceeded' ||
                                            data.error.message?.includes('rate limit') ||
                                            data.error.message?.includes('quota')) {
                                            showStatus('Rate limit exceeded. Waiting before retry...');

                                            // Increase delay for future requests
                                            const backoffTime = Math.min(API_CALL_DELAY_MS * 2, 10000);
                                            console.log(`Increasing delay between requests to ${backoffTime}ms due to rate limiting`);
                                            API_CALL_DELAY_MS = backoffTime;
                                        }
                                    }

                                    // Retry with exponential backoff if not at max attempts
                                    if (currentAttempt < maxAttempts) {
                                        const backoffDelay = Math.pow(2, currentAttempt) * 1000;
                                        console.log(`Retrying request for tweet ${tweetId} in ${backoffDelay}ms (attempt ${currentAttempt + 1}/${maxAttempts})`);
                                        setTimeout(() => { attemptRating(currentAttempt + 1); }, backoffDelay);
                                        return;
                                    }

                                    resolve({ score: 5, content: "No content in OpenRouter response. Please check for rate limits or token quotas.", error: true });
                                    return;
                                }

                                // Extract score
                                const scoreMatch = content.match(/\SCORE_(\d+)/);
                                if (scoreMatch) {
                                    const score = parseInt(scoreMatch[1], 10);

                                    // Cache the score
                                    tweetIDRatingCache[tweetId] = { tweetContent: tweetText, score: score, description: content };
                                    saveTweetRatings();
                                    resolve({ score: score, content: content, error: false });
                                    return;
                                } else {
                                    console.error(`No rating score found in response for tweet ${tweetId}. Content:`, content);
                                    resolve({ score: 5, content: "No rating score found in response", error: true });
                                    return;
                                }
                            } catch (error) {
                                console.error(`Error parsing response for tweet ${tweetId}:`, error, response.responseText);
                                resolve({ score: 5, content: "Error parsing response", error: true });
                                return;
                            }
                        } else {
                            console.error(`API error for tweet ${tweetId}: ${response.status}`, response.responseText);

                            // If we got a 429 (too many requests) or 500+ (server error), add exponential backoff
                            if ((response.status === 429 || response.status >= 500) && currentAttempt < maxAttempts) {
                                const backoffDelay = Math.pow(2, currentAttempt) * 1000;
                                console.log(`Rate limited or server error. Retrying in ${backoffDelay}ms (attempt ${currentAttempt + 1}/${maxAttempts})`);
                                setTimeout(() => { attemptRating(currentAttempt + 1); }, backoffDelay);
                                return;
                            }

                            resolve({ score: 5, content: `API error: ${response.status}`, error: true });
                        }
                    },
                    onerror: function (error) {
                        pendingRequests--;
                        console.error(`Network error for tweet ${tweetId}:`, error);
                        if (currentAttempt < maxAttempts) {
                            const backoffDelay = Math.pow(2, currentAttempt) * 1000;
                            console.log(`Network error. Retrying in ${backoffDelay}ms (attempt ${currentAttempt + 1}/${maxAttempts})`);
                            setTimeout(() => { attemptRating(currentAttempt + 1); }, backoffDelay);
                        } else {
                            resolve({ score: 5, content: "Error making request", error: true });
                        }
                    },
                    ontimeout: function () {
                        pendingRequests--;
                        console.error(`Request timeout for tweet ${tweetId}`);
                        if (currentAttempt < maxAttempts) {
                            const backoffDelay = Math.pow(2, currentAttempt) * 1000;
                            console.log(`Request timed out. Retrying in ${backoffDelay}ms (attempt ${currentAttempt + 1}/${maxAttempts})`);
                            setTimeout(() => { attemptRating(currentAttempt + 1); }, backoffDelay);
                        } else {
                            resolve({ score: 5, content: "Request timed out", error: true });
                        }
                    }
                });
            }
            attemptRating(attempt);
        });
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

            // Status is already set to pending in scheduleTweetProcessing
            logData.status = "Processing tweet";

            // --- Extract Main Tweet Content ---
            const mainText = getElementText(tweetArticle.querySelector(TWEET_TEXT_SELECTOR));
            let allMediaLinks = extractMediaLinks(tweetArticle, tweetId);

            // --- Extract Quoted Tweet Content (if any) ---
            let quotedText = "";
            let quotedMediaLinks = [];
            const quoteContainer = tweetArticle.querySelector(QUOTE_CONTAINER_SELECTOR);
            if (quoteContainer) {
                quotedText = getElementText(quoteContainer.querySelector(TWEET_TEXT_SELECTOR));
                quotedMediaLinks = extractMediaLinks(quoteContainer, tweetId);
            }

            // Remove any media links from the main tweet that also appear in the quoted tweet
            let mainMediaLinks = allMediaLinks.filter(link => !quotedMediaLinks.includes(link));
            //redefine allMediaLinks as the union of mainMediaLinks and quotedMediaLinks
            // Collect media URLs
            if (mainMediaLinks.length > 0 || quotedMediaLinks.length > 0) {
                logData.mediaUrls = [...mainMediaLinks, ...quotedMediaLinks];
            }

            // --- Build the full context ---
            let fullContext = `[TWEET ${tweetId}]\n Author:@${userHandle}:\n` + mainText;
            let fullContextWithImageDescription = fullContext;

            if (mainMediaLinks.length > 0) {
                // Add media URLs always for context
                fullContext += "\n[MEDIA_URLS]:\n" + mainMediaLinks.join(", ");

                // Process main tweet images only if image descriptions are enabled
                if (enableImageDescriptions) {
                    let mainMediaLinksDescription = await getImageDescription(mainMediaLinks, apiKey, tweetId, userHandle);
                    fullContextWithImageDescription += "\n[MEDIA_DESCRIPTION]:\n" + mainMediaLinksDescription;
                    logData.imageDescription = mainMediaLinksDescription;
                } else {
                    // Just add the URLs when descriptions are disabled
                    fullContextWithImageDescription += "\n[MEDIA_URLS]:\n" + mainMediaLinks.join(", ");
                }
            }

            if (quotedText) {
                fullContext += "\n[QUOTED_TWEET]:\n" + quotedText;
                fullContextWithImageDescription += "\n[QUOTED_TWEET]:\n" + quotedText;

                if (quotedMediaLinks.length > 0) {
                    // Add media URLs always for context
                    fullContext += "\n[QUOTED_TWEET_MEDIA_URLS]:\n" + quotedMediaLinks.join(", ");

                    // Process quoted tweet images only if image descriptions are enabled
                    if (enableImageDescriptions) {
                        let quotedMediaLinksDescription = await getImageDescription(quotedMediaLinks, apiKey, tweetId, userHandle);
                        fullContextWithImageDescription += "\n[QUOTED_TWEET_MEDIA_DESCRIPTION]:\n" + quotedMediaLinksDescription;

                        if (logData.imageDescription) {
                            logData.imageDescription += "\n\nQUOTED TWEET IMAGES:\n" + quotedMediaLinksDescription;
                        } else {
                            logData.imageDescription = "QUOTED TWEET IMAGES:\n" + quotedMediaLinksDescription;
                        }
                    } else {
                        // Just add the URLs when descriptions are disabled
                        fullContextWithImageDescription += "\n[QUOTED_TWEET_MEDIA_URLS]:\n" + quotedMediaLinks.join(", ");
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
                    const rating = await rateTweetWithOpenRouter(fullContextWithImageDescription, tweetId, apiKey, allMediaLinks);
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
            logFinalRating(tweetId, logData.handle || "unknown", logData);

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

        // Immediately mark as pending before scheduling actual processing
        processedTweets.add(tweetId);
        tweetArticle.dataset.ratingStatus = 'pending';
        setScoreIndicator(tweetArticle, null, 'pending');

        // Now schedule the actual rating processing
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

        // Build the base formatted context string
        let fullContext = `[TWEET]:
@${userHandle}
${mainText}
`;

        // Handle media content
        if (mainMediaLinks.length > 0) {
            if (enableImageDescriptions) {
                // Get descriptions for images if enabled
                const mainMediaDescriptions = await getImageDescription(mainMediaLinks, apiKey, tweetId, userHandle);
                fullContext += `[MEDIA_DESCRIPTION]:
${mainMediaDescriptions}
`;
            } else {
                // Just include the URLs if descriptions are disabled
                fullContext += `[MEDIA_URLS]:
${mainMediaLinks.join(", ")}
`;
            }
        }

        // Retrieve quoted tweet content (if any)
        let quotedText = "";
        let quotedMediaLinks = [];
        const quoteContainer = tweetArticle.querySelector(QUOTE_CONTAINER_SELECTOR);

        if (quoteContainer) {
            quotedText = getElementText(quoteContainer.querySelector(TWEET_TEXT_SELECTOR));
            quotedMediaLinks = extractMediaLinks(quoteContainer, tweetId);

            // Add quoted tweet content if present
            if (quotedText) {
                fullContext += `[QUOTED_TWEET]:
${quotedText}
`;

                // Handle quoted tweet media
                if (quotedMediaLinks.length > 0) {
                    if (enableImageDescriptions) {
                        // Get descriptions for quoted tweet images if enabled
                        const quotedMediaDescriptions = await getImageDescription(quotedMediaLinks, apiKey, tweetId, userHandle);
                        fullContext += `[QUOTED_TWEET_MEDIA_DESCRIPTION]:
${quotedMediaDescriptions}
`;
                    } else {
                        // Just include the URLs if descriptions are disabled
                        fullContext += `[QUOTED_TWEET_MEDIA_URLS]:
${quotedMediaLinks.join(", ")}
`;
                    }
                }
            }
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
            if (mutation.type === 'childList') {
                // Process added nodes
                if (mutation.addedNodes.length > 0) {
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

                // Process removed nodes to clean up description elements
                if (mutation.removedNodes.length > 0) {
                    mutation.removedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            // Check if the removed node is a tweet article or contains tweet articles
                            const isTweet = node.matches && node.matches(TWEET_ARTICLE_SELECTOR);
                            const removedTweets = isTweet ? [node] :
                                (node.querySelectorAll ? Array.from(node.querySelectorAll(TWEET_ARTICLE_SELECTOR)) : []);

                            // For each removed tweet, find and remove its description element
                            removedTweets.forEach(tweet => {
                                const indicator = tweet.querySelector('.score-indicator');
                                if (indicator && indicator.dataset.id) {
                                    const descId = 'desc-' + indicator.dataset.id;
                                    const descBox = document.getElementById(descId);
                                    if (descBox) {
                                        descBox.remove();
                                        //console.debug(`Removed description box ${descId} for tweet that was removed from the DOM`);
                                    }
                                }
                            });
                        }
                    });
                }
            }
        }
    }

    // ----- Initialization -----



    /**
     * Cleans up all score description elements from the DOM
     */
    function cleanupDescriptionElements() {
        // Remove all score description elements
        const descElements = document.querySelectorAll('.score-description');
        descElements.forEach(el => el.remove());
        console.log(`Cleaned up ${descElements.length} description elements`);
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

                // Clean up all description elements
                cleanupDescriptionElements();

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
            showStatus('Please enter your OpenRouter API key');
            return;
        }

        showStatus('Fetching available models...');

        // Get the current sort order from storage or use default
        const sortOrder = GM_getValue('modelSortOrder', 'throughput-high-to-low');

        GM_xmlhttpRequest({
            method: "GET",
            url: `https://openrouter.ai/api/frontend/models/find?order=${sortOrder}`,
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "HTTP-Referer": "https://twitter.com",
                "X-Title": "Tweet Rating Tool"
            },
            onload: function (response) {
                if (response.status >= 200 && response.status < 300) {
                    try {
                        const data = JSON.parse(response.responseText);
                        if (data.data && data.data.models) {
                            availableModels = data.data.models || [];
                            console.log(`Fetched ${availableModels.length} models from OpenRouter`);

                            // After fetching models, update any UI that depends on them
                            refreshModelsUI();
                            showStatus(`Loaded ${availableModels.length} models!`);
                        } else {
                            console.error('Unexpected data format from OpenRouter API:', data);
                            showStatus('Error: Unexpected data format from API');
                        }
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
                console.error('Error fetching models:', error);
                showStatus('Failed to fetch models!');
            }
        });
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




    // Start observing tweets and initializing the UI
    initializeObserver();



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
            selectedModel = 'mistralai/mistral-small-3.1-24b-instruct';
            selectedImageModel = 'mistralai/mistral-small-3.1-24b-instruct';
            enableImageDescriptions = true;
            modelTemperature = 0.5;
            modelTopP = 0.9;
            imageModelTemperature = 0.5;
            imageModelTopP = 0.9;
            currentFilterThreshold = 1;
            USER_DEFINED_INSTRUCTIONS = '';

            // Save reset values to storage
            GM_setValue('selectedModel', selectedModel);
            GM_setValue('selectedImageModel', selectedImageModel);
            GM_setValue('enableImageDescriptions', enableImageDescriptions);
            GM_setValue('modelTemperature', modelTemperature);
            GM_setValue('modelTopP', modelTopP);
            GM_setValue('imageModelTemperature', imageModelTemperature);
            GM_setValue('imageModelTopP', imageModelTopP);
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
     * Creates a parameter control with a slider and value display.
     * @param {HTMLElement} parent - Parent element to attach the control to
     * @param {string} label - Label for the parameter
     * @param {string} paramName - Name of the parameter in global scope
     * @param {string} description - Description of the parameter
     * @param {number} value - Current value
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @param {number} step - Step size
     * @param {Function} onChange - Callback when value changes
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

        const valueDisplay = document.createElement('div');
        valueDisplay.className = 'parameter-value';
        valueDisplay.textContent = value;

        slider.addEventListener('input', () => {
            const newValue = parseFloat(slider.value);
            valueDisplay.textContent = newValue.toFixed(1);
            window[paramName] = newValue; // Update the global variable

            // Call onChange callback if provided
            if (typeof onChange === 'function') {
                onChange(newValue);
            }
        });

        control.appendChild(slider);
        control.appendChild(valueDisplay);
        row.appendChild(control);

        parent.appendChild(row);
    }

})();