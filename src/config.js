//src/config.js
const processedTweets = new Set(); // Set of tweet IDs already processed in this session
const adAuthorCache = new Set(); // Cache of handles that post ads

const PROCESSING_DELAY_MS = 250; // Delay before processing a tweet (ms)
const API_CALL_DELAY_MS = 20; // Minimum delay between API calls (ms)
let USER_DEFINED_INSTRUCTIONS = browserGet('userDefinedInstructions', `- Give high scores to insightful and impactful tweets
- Give low scores to clickbait, fearmongering, and ragebait
- Give high scores to high-effort content and artistic content`);
let currentFilterThreshold = browserGet('filterThreshold', 1); // Filter threshold for tweet visibility
let observedTargetNode = null;
let lastAPICallTime = 0;
let pendingRequests = 0;
const MAX_RETRIES = 5;
let availableModels = []; // List of models fetched from API
let listedModels = []; // Filtered list of models actually shown in UI
let selectedModel = browserGet('selectedModel', 'openai/gpt-4.1-nano');
let selectedImageModel = browserGet('selectedImageModel', 'openai/gpt-4.1-nano');
let showFreeModels = browserGet('showFreeModels', true);
let providerSort = browserGet('providerSort', ''); // Default to load-balanced
let blacklistedHandles = browserGet('blacklistedHandles', '').split('\n').filter(h => h.trim() !== '');

let storedRatings = browserGet('tweetRatings', '{}');
let threadHist = "";
// Settings variables
let enableImageDescriptions = browserGet('enableImageDescriptions', false);
let enableStreaming = browserGet('enableStreaming', true); // Enable streaming by default for better UX


// Model parameters
const SYSTEM_PROMPT=`You are a tweet filtering AI. Your task is to rate tweets on a scale of 0 to 10 based on user-defined instructions.You will be given a Tweet and user defined instructions to rate the tweet. You are to review and provide a rating for the tweet with the specified tweet ID.Ensure that you consider the user-defined instructions in your analysis and scoring.Follow the user-defined instructions exactly, and do not deviate from them. Then, on a new line, provide a score between 0 and 10.Output your analysis first. Then, on a new line, provide a score between 0 and 10. in this exact format:SCORE_X (where X is a number from 0 (lowest quality) to 10 (highest quality).)for example: SCORE_0, SCORE_1, SCORE_2, SCORE_3, etc.If one of the above is not present, the program will not be able to parse the response and will return an error.`
let modelTemperature = browserGet('modelTemperature', 1);
let modelTopP = browserGet('modelTopP', 1);
let imageModelTemperature = browserGet('imageModelTemperature', 1);
let imageModelTopP = browserGet('imageModelTopP', 1);
let maxTokens = browserGet('maxTokens', 0); // Maximum number of tokens for API requests, 0 means no limit
// ----- DOM Selectors (for tweet elements) -----
const TWEET_ARTICLE_SELECTOR = 'article[data-testid="tweet"]';
const QUOTE_CONTAINER_SELECTOR = 'div[role="link"][tabindex="0"]';
const USER_HANDLE_SELECTOR = 'div[data-testid="User-Name"] a[role="link"]';
const TWEET_TEXT_SELECTOR = 'div[data-testid="tweetText"]';
const MEDIA_IMG_SELECTOR = 'div[data-testid="tweetPhoto"] img, img[src*="pbs.twimg.com/media"]';
const MEDIA_VIDEO_SELECTOR = 'video[poster*="pbs.twimg.com"], video';
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
