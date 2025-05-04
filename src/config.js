//src/config.js
const processedTweets = new Set(); // Set of tweet IDs already processed in this session
const adAuthorCache = new Set(); // Cache of handles that post ads

const PROCESSING_DELAY_MS = 150; // Delay before processing a tweet (ms)
const API_CALL_DELAY_MS = 25; // Minimum delay between API calls
let USER_DEFINED_INSTRUCTIONS = instructionsManager.getCurrentInstructions() || 'Rate the tweet on a scale from 1 to 10 based on its clarity, insight, creativity, and overall quality.';
let currentFilterThreshold = parseInt(browserGet('filterThreshold', '5')); // Filter threshold for tweet visibility
let observedTargetNode = null;
let lastAPICallTime = 0;
let pendingRequests = 0; // Global counter for pending API requests
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
const SYSTEM_PROMPT=`
<SYSTEM_INSTRUCTIONS>
<TASK_DESCRIPTION>
You are a tweet filtering AI. In short, you will be given a tweet to process. Your task has 3-parts. 
First, carefully analyze the tweet. And determine how well it aligns with the user's instructions. Your analysis should align with and precisely follow the user's instructions. 
Second, rate the tweet ONLY according to the extent that it aligns with the user's defined instructions. 
Third, provide 3 follow up questions designed to spark further discussion about the tweet. Which the user may ask the AI. The questions should be discursory in nature. 
Do NOT ask questions which you cannot answer, such as context related to the tweet author's other tweets. Your internet search function will be enabled when providing follow up questions. 
Remember to ALWAYS follow the EXPECTED_RESPONSE_FORMAT EXACTLY. If you fail to respond with this format, the upstream processing pipeline will be unable to parse your response, leading to a crash. 
</TASK_DESCRIPTION>
<EXPECTED_RESPONSE_FORMAT>
(Do not include (text enclosed in parenthesis) in your response. Parenthesisized text serves as guidelines. DO include everything else.)
[ANALYSIS] 
(Your analysis of the tweet according to the user defined instructions) 
[/ANALYSIS]
[SCORE]
SCORE_X (where X is a number from 0 to 10 for example: SCORE_0, SCORE_1, SCORE_2, SCORE_3, etc)
[/SCORE]
[FOLLOW_UP_QUESTIONS]
Q_1. (Question 1)
Q_2. (Question 2)
Q_3. (Question 3)
[/FOLLOW_UP_QUESTIONS]
</EXPECTED_RESPONSE_FORMAT>
</SYSTEM_INSTRUCTIONS>
`
let modelTemperature = parseFloat(browserGet('modelTemperature', '0.5'));
let modelTopP = parseFloat(browserGet('modelTopP', '0.9'));
let imageModelTemperature = parseFloat(browserGet('imageModelTemperature', '0.5'));
let imageModelTopP = parseFloat(browserGet('imageModelTopP', '0.9'));
let maxTokens = parseInt(browserGet('maxTokens', '0')); // Maximum number of tokens for API requests, 0 means no limit
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
