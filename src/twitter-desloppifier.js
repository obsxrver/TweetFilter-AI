const VERSION = '1.5.6';
(function () {

    'use strict';
    console.log(`X/Twitter Tweet De-Sloppification Activated (v${VERSION}- Enhanced)`);

    let menuhtml = GM_getResourceText("MENU_HTML");
    browserSet('menuHTML', menuhtml);
    let firstRun = browserGet('firstRun', true);

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

            let apiKey = browserGet('openrouter-api-key', '');
            if(!apiKey){
                alert("No API Key found. Please enter your API Key in Settings > General.")
            }

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
            setTimeout(initializeObserver, 1);
        }
    }
    initializeObserver();
})();
