// ==UserScript==
// @name         TweetFilter AI
// @namespace    http://tampermonkey.net/
// @version      Version 1.3.5.1
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
// @require      https://raw.githubusercontent.com/obsxrver/TweetFilter-AI/dev/src/config.js
// @require      https://raw.githubusercontent.com/obsxrver/TweetFilter-AI/dev/src/api.js
// @require      https://raw.githubusercontent.com/obsxrver/TweetFilter-AI/dev/src/domScraper.js
// @require      https://raw.githubusercontent.com/obsxrver/TweetFilter-AI/dev/src/ratingEngine.js
// @require      https://raw.githubusercontent.com/obsxrver/TweetFilter-AI/dev/src/ui.js
// @resource     MENU_HTML https://raw.githubusercontent.com/obsxrver/TweetFilter-AI/dev/src/Menu.html
// @resource     STYLESHEET https://raw.githubusercontent.com/obsxrver/TweetFilter-AI/dev/src/style.css
// @run-at       document-idle
// @license      MIT
// ==/UserScript==
(function () {
    'use strict';
    console.log("X/Twitter Tweet De-Sloppification Activated (v1.3.5.1 - Enhanced)");

    // Load CSS stylesheet
    //const css = GM_getResourceText('STYLESHEET');
    let menuhtml = GM_getResourceText("MENU_HTML");
    GM_setValue('menuHTML', menuhtml);
    let firstRun = GM_getValue('firstRun', true);

    //GM_addStyle(css);

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
            if (firstRun) {
                resetSettings(true);
                GM_setValue('firstRun', false);
            }
            // If no API key is found, prompt the user
            const apiKey = GM_getValue('openrouter-api-key', '');
            if (apiKey) {
                GM_setValue('openrouter-api-key', apiKey);
                showStatus("No API Key found Using promotional key.");
                showStatus(`Loaded ${Object.keys(tweetIDRatingCache).length} cached ratings. Starting to rate visible tweets...`);
                fetchAvailableModels();
            }
            // Process all currently visible tweets
            observedTargetNode.querySelectorAll(TWEET_ARTICLE_SELECTOR).forEach(scheduleTweetProcessing);

            // Apply filtering based on current threshold
            applyFilteringToAll();

            const observer = new MutationObserver(handleMutations);
            observer.observe(observedTargetNode, { childList: true, subtree: true });
            ensureAllTweetsRated();
            window.addEventListener('beforeunload', () => {
                saveTweetRatings();
                observer.disconnect();
                const sliderUI = document.getElementById('tweet-filter-container');
                if (sliderUI) sliderUI.remove();
                const settingsUI = document.getElementById('settings-container');
                if (settingsUI) settingsUI.remove();
                const statusIndicator = document.getElementById('status-indicator');
                if (statusIndicator) statusIndicator.remove();
                //Now WHY TF did it call this LMAO. That's why it was broken!
                //cleanupDescriptionElements();
                console.log("X/Twitter Tweet De-Sloppification Deactivated.");
            });
        } else {
            setTimeout(initializeObserver, 1000);
        }
    }
    // Start observing tweets and initializing the UI
    initializeObserver();
})();
