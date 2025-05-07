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
const REVIEW_SYSTEM_PROMPT=`
    You are **TweetFilter-AI**.

    When given a tweet, do these three steps **in order**:

    1. **ANALYZE** - Judge how closely the tweet matches the user's instructions.  
    2. **SCORE** - Assign an integer from 0'10 (inclusive) based *only* on that alignment.  
    3. **ASK** - Write **exactly three** open-ended follow-up questions the user might ask next.  
       • Questions must be answerable from the tweet itself or general knowledge.  
       • Do **not** ask for information that requires unavailable context (e.g., the author's other tweets).

    **Important constraints**

    • You do **not** have up-to-the-minute knowledge of current events.  
      → If a tweet makes a factual claim you cannot verify, **do not down-score it** for "fake news"; instead, evaluate it solely on the user's criteria and note any uncertainty in your analysis.  
      → Only down-score when the tweet contradicts widely-known, stable facts or directly violates the user's instructions.

    ⚠️ Output must match **exactly** the EXPECTED_RESPONSE_FORMAT" - no extra text, no missing tags - or the pipeline crashes.
  EXPECTED_RESPONSE_FORMAT: (begin with <ANALYSIS> and end with </FOLLOW_UP_QUESTIONS>)
    <ANALYSIS>
      (Your analysis goes here.)
    </ANALYSIS>

    <SCORE>
      SCORE_X
    </SCORE>

    <FOLLOW_UP_QUESTIONS>
      Q_1. …
      Q_2. …
      Q_3. …
    </FOLLOW_UP_QUESTIONS>
  End of EXPECTED_RESPONSE_FORMAT
`;
const FOLLOW_UP_SYSTEM_PROMPT = `
You are TweetFilter-AI, continuing a conversation about a tweet.
The user has asked a follow-up question.
Your entire conversation history up to this point is provided in the message list.
Please provide an answer and then generate 3 new, relevant follow-up questions.
Adhere strictly to the following response format:
<ANSWER>
(Your answer here)
</ANSWER>
<FOLLOW_UP_QUESTIONS>
Q_1. (New Question 1 here)
Q_2. (New Question 2 here)
Q_3. (New Question 3 here)
</FOLLOW_UP_QUESTIONS>
`;
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
