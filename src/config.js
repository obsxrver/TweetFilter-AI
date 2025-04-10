// ==UserScript==
// @name         TweetFilter AI - Config Module
// @namespace    http://tampermonkey.net/
// @version      Version 1.2.3r2
// @description  Configuration module for TweetFilter AI
// @author       Obsxrver(3than)
// @license      MIT
// ==/UserScript==

// ----- Global Variables & Caches -----
const processedTweets = new Set(); // Set of tweet IDs already processed in this session
const tweetIDRatingCache = {}; // ID-based cache for persistent storage
const PROCESSING_DELAY_MS = 1000; // Delay before processing a tweet (ms)
const API_CALL_DELAY_MS = 250; // Minimum delay between API calls (ms)
let USER_DEFINED_INSTRUCTIONS = GM_getValue('userDefinedInstructions', ` 
- Give high scores to insightful and impactful tweets
- Give low scores to clickbait, fearmongering, and ragebait
- Give high scores to high-effort content and artistic content`);
let currentFilterThreshold = GM_getValue('filterThreshold', 1); // Filter threshold for tweet visibility
let observedTargetNode = null;
let lastAPICallTime = 0;
let pendingRequests = 0;
const MAX_RETRIES = 3;
let availableModels = []; // List of models fetched from API
let selectedModel = GM_getValue('selectedModel', 'google/gemini-flash-1.5-8b');
let selectedImageModel = GM_getValue('selectedImageModel', 'google/gemini-flash-1.5-8b');
let blacklistedHandles = GM_getValue('blacklistedHandles', '').split('\n').filter(h => h.trim() !== '');

let storedRatings = GM_getValue('tweetRatings', '{}');
// Settings variables
let enableImageDescriptions = GM_getValue('enableImageDescriptions', false);


// Model parameters
let modelTemperature = GM_getValue('modelTemperature', 0.5);
let modelTopP = GM_getValue('modelTopP', 0.9);
let imageModelTemperature = GM_getValue('imageModelTemperature', 0.5);
let imageModelTopP = GM_getValue('imageModelTopP', 0.9);
let maxTokens = GM_getValue('maxTokens', 0); // Maximum number of tokens for API requests, 0 means no limit
let imageModelMaxTokens = GM_getValue('imageModelMaxTokens', 0); // Maximum number of tokens for image model API requests, 0 means no limit
//let menuHTML= "";

// ----- DOM Selectors (for tweet elements) -----
const TWEET_ARTICLE_SELECTOR = 'article[data-testid="tweet"]';
const QUOTE_CONTAINER_SELECTOR = 'div[role="link"][tabindex="0"]';
const USER_NAME_SELECTOR = 'div[data-testid="User-Name"] span > span';
const USER_HANDLE_SELECTOR = 'div[data-testid="User-Name"] a[role="link"]';
const TWEET_TEXT_SELECTOR = 'div[data-testid="tweetText"]';
const MEDIA_IMG_SELECTOR = 'div[data-testid="tweetPhoto"] img, img[src*="pbs.twimg.com/media"]';
const MEDIA_VIDEO_SELECTOR = 'video[poster*="pbs.twimg.com"], video[poster*="pbs.twimg.com"]';
const PERMALINK_SELECTOR = 'a[href*="/status/"] time';
// ----- Dom Elements -----
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

try {
    Object.assign(tweetIDRatingCache, JSON.parse(storedRatings));
    console.log(`Loaded ${Object.keys(tweetIDRatingCache).length} cached tweet ratings`);
} catch (e) {
    console.error('Error loading stored ratings:', e);
}

