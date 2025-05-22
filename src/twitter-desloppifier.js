// ==UserScript==
// @name         TweetFilter AI
// @namespace    http://tampermonkey.net/
// @version      Version 1.5.1
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
// @resource     MENU_HTML https://raw.githubusercontent.com/obsxrver/TweetFilter-AI/dev/src/Menu.html
// @resource     STYLESHEET https://raw.githubusercontent.com/obsxrver/TweetFilter-AI/dev/src/style.css
// @run-at       document-idle
// @license      MIT
// ==/UserScript==
//src/twitter-desloppifier.js
const VERSION = '1.5.1'; 
(function () {
    
    'use strict';
    console.log("X/Twitter Tweet De-Sloppification Activated (v1.5.1- Enhanced)");

    // Load CSS stylesheet
    //const css = GM_getResourceText('STYLESHEET');
    let menuhtml = GM_getResourceText("MENU_HTML");
    browserSet('menuHTML', menuhtml);
    let firstRun = browserGet('firstRun', true);

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
                browserSet('firstRun', false);
            }
            // If no API key is found, prompt the user
            let apiKey = browserGet('openrouter-api-key', '');
            if(!apiKey){
                alert("No API Key found. Please enter your API Key in Settings > General.")
            }
            /*
            if (!apiKey){
                //key is dead
                apiKey = '*'
                showStatus(`No API Key Found. Using Promotional Key`);
            }*/
            if (apiKey) {
                browserSet('openrouter-api-key', apiKey);
                showStatus(`Loaded ${tweetCache.size} cached ratings. Starting to rate visible tweets...`);
                fetchAvailableModels();
            }
            if(document.querySelector('[aria-label="Timeline: Conversation"]')){
                handleThreads();
            }else{
                observedTargetNode.querySelectorAll(TWEET_ARTICLE_SELECTOR).forEach(scheduleTweetProcessing);
            }
            

            const observer = new MutationObserver(handleMutations);
            observer.observe(observedTargetNode, { childList: true, subtree: true });
            window.addEventListener('beforeunload', () => {
                observer.disconnect();
                const sliderUI = document.getElementById('tweet-filter-container');
                if (sliderUI) sliderUI.remove();
                const settingsUI = document.getElementById('settings-container');
                if (settingsUI) settingsUI.remove();
                const statusIndicator = document.getElementById('status-indicator');
                if (statusIndicator) statusIndicator.remove();
                ScoreIndicatorRegistry.destroyAll();
                console.log("X/Twitter Tweet De-Sloppification Deactivated.");
            });
        } else {
            setTimeout(initializeObserver, 10);
        }
    }
    initializeObserver();
})();
