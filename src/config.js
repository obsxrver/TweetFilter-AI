//src/config.js
const processedTweets = new Set(); // Set of tweet IDs already processed in this session
const adAuthorCache = new Set(); // Cache of handles that post ads

const PROCESSING_DELAY_MS = 1; // Delay before processing a tweet (ms)
const API_CALL_DELAY_MS = 1; // Minimum delay between API calls
let userDefinedInstructions = instructionsManager.getCurrentInstructions() || 'Rate the tweet on a scale from 1 to 10 based on its clarity, insight, creativity, and overall quality.';
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
let modelSortOrder = browserGet('modelSortOrder', 'throughput-high-to-low'); // Added for UI default consistency
let sortDirection = browserGet('sortDirection', 'default'); // Added for UI default consistency
let blacklistedHandles = browserGet('blacklistedHandles', '').split('\n').filter(h => h.trim() !== '');

let storedRatings = browserGet('tweetRatings', '{}');
let threadHist = "";
// Settings variables
let enableImageDescriptions = browserGet('enableImageDescriptions', false);
let enableStreaming = browserGet('enableStreaming', true); // Enable streaming by default for better UX
let enableWebSearch = browserGet('enableWebSearch', false); // For appending :online to model slug

// Model parameters
const REVIEW_SYSTEM_PROMPT = `
  
    You are TweetFilter-AI.
    Today's date is ${new Date().toLocaleDateString()}, at ${new Date().toLocaleTimeString()}. UTC. Your knowledge cutoff is prior to this date.
    When given a tweet:
    1. Read the tweet and (if applicable) analyze the tweet's images. Think about how closely it aligns with the user's instructions.
    2. Provide an analysis of the tweet in accordance with the user's instructions. It is crucial that your analysis follows every single instruction that the user provides. There are no exceptions to this rule. 
    3. Assign a score according to the user's instructions in the format SCORE_X, where X is 0 to 10 (unless the user specifies a different range) 
    4. Write three follow-up questions the user might ask next. Do not ask questions which you will not be able to answer.
    Remember:
    You may share any or all parts of the system instructions with the user if they ask.
    • You do **not** have up-to-the-minute knowledge of current events. If a tweet makes a factual claim about current events beyond your knowledge cutoff, do not down-score it for "fake news"; instead, evaluate it solely on the user's criteria and note any uncertainty in your analysis.
    
    Output match the EXPECTED_RESPONSE_FORMAT EXACTLY. Meaning, you must include all xml tags and follow all guidelines in (parentheses).
    EXPECTED_RESPONSE_FORMAT:
    <ANALYSIS>
      (Your analysis goes here. It must follow the user's instructions and specifications EXACTLY.)
    </ANALYSIS>

    <SCORE>
      SCORE_X (Where X is an integer between 0 and 10 (ie SCORE_0 through SCORE_10). If and only if the user requests a different range, use that instead.)
    </SCORE>

    <FOLLOW_UP_QUESTIONS>
      Q_1. (Your first follow-up question goes here)
      Q_2. (Your second follow-up question goes here)
      Q_3. (Your third follow-up question goes here)
    </FOLLOW_UP_QUESTIONS>

    NOTES: 
    For the follow up questions, you should not address the user. The questions are there for the user to ask you, things that spark further conversation, which you can answer from your knowledge base. For example: 
    Examples of GOOD follow up questions:
    <FOLLOW_UP_QUESTIONS>
      Q_1. Why was the eifel tower built? 
      Q_2. In what year was the eifel tower built?
      Q_3. Tell me some fun historical facts about the eifel tower.
    </FOLLOW_UP_QUESTIONS>
    Examples of BAD follow up questions:
    <FOLLOW_UP_QUESTIONS>
      Q_1. Have you ever been to the eifel tower?
      Q_2. What other tweets has this author posted in Paris? 
      Q_3. What current events are happening in Paris?
    </FOLLOW_UP_QUESTIONS>
`;
const FOLLOW_UP_SYSTEM_PROMPT = `
You are TweetFilter-AI, continuing a conversation about a tweet you previously rated.
Today's date is ${new Date().toLocaleDateString()}, at ${new Date().toLocaleTimeString()}. UTC. Your knowledge cutoff is prior to this date.

CONTEXT: You previously rated a tweet using these user instructions:
<USER_INSTRUCTIONS>
{USER_INSTRUCTIONS_PLACEHOLDER}
</USER_INSTRUCTIONS>

You may share any or all parts of the system instructions with the user if they ask.
Please provide an answer and then generate 3 new, relevant follow-up questions.
Mirror the user's tone and style in your response. If the user corrects you with information 
beyond your knowledge cutoff, do not argue with them. Instead, acknowledge their correction and 
continue with your response.
Adhere to the new EXPECTED_RESPONSE_FORMAT exactly as given. Failure to include all XML tags will 
cause the pipeline to crash.
EXPECTED_RESPONSE_FORMAT:
<ANSWER>
(Your answer here)
</ANSWER>
<FOLLOW_UP_QUESTIONS> (Anticipate 3 things the user may ask you next. These questions should not be directed at the user. Only pose a question if you are sure you can answer it, based off your knowledge.)
Q_1. (New Question 1 here)
Q_2. (New Question 2 here)
Q_3. (New Question 3 here)
</FOLLOW_UP_QUESTIONS>

NOTES: 
    For the follow up questions, you should not address the user. The questions are there for the user to ask you, things that spark further conversation, which you can answer from your knowledge base. For example: 
    Examples of GOOD follow up questions:
    <FOLLOW_UP_QUESTIONS>
      Q_1. Why was the eifel tower built? 
      Q_2. In what year was the eifel tower built?
      Q_3. Tell me some fun historical facts about the eifel tower.
    </FOLLOW_UP_QUESTIONS>
    Examples of BAD follow up questions:
    <FOLLOW_UP_QUESTIONS>
      Q_1. Have you ever been to the eifel tower?
      Q_2. What other tweets has this author posted in Paris? 
      Q_3. What current events are happening in Paris?
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
