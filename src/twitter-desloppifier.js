// ==UserScript==
// @name         TweetFilter AI (Refactored!)
// @namespace    http://tampermonkey.net/
// @version      Version 1.3r
// @description  A highly customizable AI rates tweets 1-10 and removes all the slop, saving your braincells!
// @author       Obsxrver(3than)
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
            //console.log(`Media URLs:`, data.mediaUrls);
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