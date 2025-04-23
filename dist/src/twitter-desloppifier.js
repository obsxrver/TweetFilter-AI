// Main content script for TweetFilter AI
import { browserGet, browserSet } from './helpers/browserStorage.js';
import { updateCacheStatsUI } from './helpers/cache.js';
import { tweetCache } from './backends/TweetCache.js';
import { instructionsManager } from './backends/InstructionsManager.js';
import { ScoreIndicatorRegistry } from './ui/ScoreIndicator.js';
import { initialiseUI } from './ui/ui.js';
import { fetchAvailableModels } from './api/api_requests.js';
import { getTweetID } from './domScraper.js';

const VERSION = '1.4';
console.log("X/Twitter Tweet De-Sloppification Activated (v1.4- Enhanced)");

// Load Menu HTML and CSS
async function loadResources() {
    try {
        const menuResponse = await fetch(chrome.runtime.getURL('src/Menu.html'));
        const menuHtml = await menuResponse.text();
        await browserSet('menuHTML', menuHtml);
    } catch (error) {
        console.error('Error loading resources:', error);
    }
}

// ----- Initialization -----

/**
 * Initializes the observer on the main content area, adds the UI elements,
 * starts processing visible tweets, and sets up periodic checks.
 */
async function initializeObserver() {
    const target = document.querySelector('main') || document.querySelector('div[data-testid="primaryColumn"]');
    if (target) {
        observedTargetNode = target;
        console.log("X/Twitter Tweet De-Sloppification: Target node found. Observing...");
        
        await loadResources();
        initialiseUI();
        
        const firstRun = await browserGet('firstRun', true);
        if (firstRun) {
            resetSettings(true);
            await browserSet('firstRun', false);
        }
        
        // If no API key is found, prompt the user
        let apiKey = await browserGet('openrouter-api-key', '');
        if(!apiKey){
            alert("No API Key found. Please enter your API Key in Settings > General.")
        }
        
        if (apiKey) {
            await browserSet('openrouter-api-key', apiKey);
            showStatus(`Loaded ${tweetCache.size} cached ratings. Starting to rate visible tweets...`);
            fetchAvailableModels();
        }
        
        observedTargetNode.querySelectorAll(TWEET_ARTICLE_SELECTOR).forEach(scheduleTweetProcessing);
        applyFilteringToAll();

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
        setTimeout(initializeObserver, 1000);
    }
}

initializeObserver();
