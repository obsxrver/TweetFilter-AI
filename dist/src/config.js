//src/config.js

// Initialize configuration
async function initializeConfig() {
    window.processedTweets = new Set(); // Set of tweet IDs already processed in this session
    window.adAuthorCache = new Set(); // Cache of handles that post ads

    window.PROCESSING_DELAY_MS = 250; // Delay before processing a tweet (ms)
    window.API_CALL_DELAY_MS = 25; // Minimum delay between API calls
    window.USER_DEFINED_INSTRUCTIONS = 'Rate the tweet on a scale from 1 to 10 based on its clarity, insight, creativity, and overall quality.';
    window.currentFilterThreshold = parseInt(await window.browserGet('filterThreshold', '5')); // Filter threshold for tweet visibility
    window.observedTargetNode = null;
    window.lastAPICallTime = 0;
    window.pendingRequests = 0;
    window.MAX_RETRIES = 5;
    window.availableModels = []; // List of models fetched from API
    window.listedModels = []; // Filtered list of models actually shown in UI
    window.selectedModel = await window.browserGet('selectedModel', 'openai/gpt-4.1-nano');
    window.selectedImageModel = await window.browserGet('selectedImageModel', 'openai/gpt-4.1-nano');
    window.showFreeModels = await window.browserGet('showFreeModels', true);
    window.providerSort = await window.browserGet('providerSort', ''); // Default to load-balanced
    window.blacklistedHandles = (await window.browserGet('blacklistedHandles', '')).split('\n').filter(h => h.trim() !== '');

    window.storedRatings = await window.browserGet('tweetRatings', '{}');
    window.threadHist = "";
    // Settings variables
    window.enableImageDescriptions = await window.browserGet('enableImageDescriptions', false);
    window.enableStreaming = await window.browserGet('enableStreaming', true); // Enable streaming by default for better UX

    // Model parameters
    window.SYSTEM_PROMPT = `You are a tweet filtering AI. Your task is to rate tweets on a scale of 0 to 10 based on user-defined instructions.You will be given a Tweet and user defined instructions to rate the tweet. You are to review and provide a rating for the tweet with the specified tweet ID.Ensure that you consider the user-defined instructions in your analysis and scoring.Follow the user-defined instructions exactly, and do not deviate from them. Then, on a new line, provide a score between 0 and 10.Output your analysis first. Then, on a new line, provide a score between 0 and 10. in this exact format:SCORE_X (where X is a number from 0 (lowest quality) to 10 (highest quality).)for example: SCORE_0, SCORE_1, SCORE_2, SCORE_3, etc.If one of the above is not present, the program will not be able to parse the response and will return an error.`;
    window.modelTemperature = parseFloat(await window.browserGet('modelTemperature', '0.5'));
    window.modelTopP = parseFloat(await window.browserGet('modelTopP', '0.9'));
    window.imageModelTemperature = parseFloat(await window.browserGet('imageModelTemperature', '0.5'));
    window.imageModelTopP = parseFloat(await window.browserGet('imageModelTopP', '0.9'));
    window.maxTokens = parseInt(await window.browserGet('maxTokens', '0')); // Maximum number of tokens for API requests, 0 means no limit

    // DOM Selectors (for tweet elements)
    window.TWEET_ARTICLE_SELECTOR = 'article[data-testid="tweet"]';
    window.QUOTE_CONTAINER_SELECTOR = 'div[role="link"][tabindex="0"]';
    window.USER_HANDLE_SELECTOR = 'div[data-testid="User-Name"] a[role="link"]';
    window.TWEET_TEXT_SELECTOR = 'div[data-testid="tweetText"]';
    window.MEDIA_IMG_SELECTOR = 'div[data-testid="tweetPhoto"] img, img[src*="pbs.twimg.com/media"]';
    window.MEDIA_VIDEO_SELECTOR = 'video[poster*="pbs.twimg.com"], video';
    window.PERMALINK_SELECTOR = 'a[href*="/status/"] time';
}

/**
 * Helper function to check if a model supports images based on its architecture
 * @param {string} modelId - The model ID to check
 * @returns {boolean} - Whether the model supports image input
 */
function modelSupportsImages(modelId) {
    if (!window.availableModels || window.availableModels.length === 0) {
        return false; // If we don't have model info, assume it doesn't support images
    }

    const model = window.availableModels.find(m => m.slug === modelId);
    if (!model) {
        return false; // Model not found in available models list
    }

    // Check if model supports images based on its architecture
    return model.input_modalities &&
        model.input_modalities.includes('image');
}

// Expose functions to window object
window.initializeConfig = initializeConfig;
window.modelSupportsImages = modelSupportsImages;
