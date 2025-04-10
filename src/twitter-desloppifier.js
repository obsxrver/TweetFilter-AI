// ==UserScript==
// @name         TweetFilter AI (Refactored!)
// @namespace    http://tampermonkey.net/
// @version      Version 1.2.3r2
// @description  A highly customizable AI rates tweets 1-10 and removes all the slop, saving your braincells!
// @author       Obsxrver(3than)
// @match        *://twitter.com/*
// @match        *://x.com/*
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @grant        GM_getResourceText
// @connect      openrouter.ai
// @resource     MENUHTML https://raw.githubusercontent.com/obsxrver/TweetFilter-AI/dev/src/Menu.html?v=1.2.3r2
// @require      https://raw.githubusercontent.com/obsxrver/TweetFilter-AI/dev/src/config.js?v=1.2.3r2
// @require      https://raw.githubusercontent.com/obsxrver/TweetFilter-AI/dev/src/api.js?v=1.2.3r2    
// @require      https://raw.githubusercontent.com/obsxrver/TweetFilter-AI/dev/src/domScraper.js?v=1.2.3r2
// @require      https://raw.githubusercontent.com/obsxrver/TweetFilter-AI/dev/src/ratingEngine.js?v=1.2.3r2
// @require      https://raw.githubusercontent.com/obsxrver/TweetFilter-AI/dev/src/ui.js?v=1.2.3r2
// @resource     STYLESHEET https://raw.githubusercontent.com/obsxrver/TweetFilter-AI/dev/src/style.css?v=1.2.3r2
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';
    console.log("X/Twitter Tweet De-Sloppification Activated (v1.2.3r - Enhanced)");
    
    // Load CSS stylesheet
    const css = GM_getResourceText('STYLESHEET');
    GM_addStyle(css);
    
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
            initialiseUI();
            
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
    // Start observing tweets and initializing the UI
    initializeObserver();
})();