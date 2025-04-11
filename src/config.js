const processedTweets = new Set(); // Set of tweet IDs already processed in this session
const tweetIDRatingCache = {}; // ID-based cache for persistent storage
const PROCESSING_DELAY_MS = 500; // Delay before processing a tweet (ms)
const API_CALL_DELAY_MS = 250; // Minimum delay between API calls (ms)
let USER_DEFINED_INSTRUCTIONS = GM_getValue('userDefinedInstructions', `- Give high scores to insightful and impactful tweets
- Give low scores to clickbait, fearmongering, and ragebait
- Give high scores to high-effort content and artistic content`);
let currentFilterThreshold = GM_getValue('filterThreshold', 1); // Filter threshold for tweet visibility
let observedTargetNode = null;
let lastAPICallTime = 0;
let pendingRequests = 0;
const MAX_RETRIES = 3;
let availableModels = []; // List of models fetched from API
let selectedModel = GM_getValue('selectedModel', 'google/gemini-2.0-flash-lite-001');
let selectedImageModel = GM_getValue('selectedImageModel', 'google/gemini-2.0-flash-lite-001');
let blacklistedHandles = GM_getValue('blacklistedHandles', '').split('\n').filter(h => h.trim() !== '');

let storedRatings = GM_getValue('tweetRatings', '{}');
let threadHist = "";
// Settings variables
let enableImageDescriptions = GM_getValue('enableImageDescriptions', false);


// Model parameters
const SYSTEM_PROMPT=`You are a tweet filtering AI. Your task is to rate tweets on a scale of 0 to 10 based on user-defined instructions.
You will be given a Tweet, structured like this:
_______TWEET SCHEMA_______
_______BEGIN TWEET_______
[TWEET {TweetID}]
{the text of the tweet being replied to}
[MEDIA_DESCRIPTION]:
[IMAGE 1]: {description}, [IMAGE 2]: {description}, etc.
[REPLY] (if the author is replying to another tweet)
[TWEET {TweetID}]: (the tweet which you are to review)
@{the author of the tweet}
{the text of the tweet}
[MEDIA_DESCRIPTION]:
[IMAGE 1]: {description}, [IMAGE 2]: {description}, etc.
[QUOTED_TWEET]: (if the author is quoting another tweet)
{the text of the quoted tweet}
[QUOTED_TWEET_MEDIA_DESCRIPTION]:
[IMAGE 1]: {description}, [IMAGE 2]: {description}, etc.
_______END TWEET_______
_______END TWEET SCHEMA_______

You are to review and provide a rating for the tweet with the specified tweet ID.
Ensure that you consider the user-defined instructions in your analysis and scoring, specified by:
[USER-DEFINED INSTRUCTIONS]:

Provide a concise explanation of your reasoning and then, on a new line, output your final rating in the exact format:
SCORE_X where X is a number from 0 (lowest quality) to 10 (highest quality).
for example: SCORE_0, SCORE_1, SCORE_2, SCORE_3, etc.
If one of the above is not present, the program will not be able to parse the response and will return an error.
`
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

try {
    Object.assign(tweetIDRatingCache, JSON.parse(storedRatings));
    console.log(`Loaded ${Object.keys(tweetIDRatingCache).length} cached tweet ratings`);
} catch (e) {
    console.error('Error loading stored ratings:', e);
}

