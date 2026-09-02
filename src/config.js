const processedTweets = tweetProcessingState.processedTweetIds;
const adAuthorCache = new Set();

const PROCESSING_DELAY_MS = 1;
const API_CALL_DELAY_MS = 1;
let userDefinedInstructions = instructionsManager.getCurrentInstructions() || DEFAULT_INSTRUCTIONS;
let currentFilterThreshold = appSettings.getInteger('filterThreshold');
let observedTargetNode = null;
let lastAPICallTime = 0;
let pendingRequests = 0;
const MAX_RETRIES = 5;
let availableModels = [];
let listedModels = [];
let selectedModel = appSettings.get('selectedModel');
let selectedImageModel = appSettings.get('selectedImageModel');
let showFreeModels = appSettings.getBoolean('showFreeModels');
let modelFamilyFilter = appSettings.get('modelFamilyFilter');
let providerSort = appSettings.get('providerSort');
let blacklistedHandles = appSettings.getHandles();

let enableImageDescriptions = appSettings.getBoolean('enableImageDescriptions');
let enableStreaming = appSettings.getBoolean('enableStreaming');
let enableWebSearch = appSettings.getBoolean('enableWebSearch');
let enableAutoRating = appSettings.getBoolean('enableAutoRating');
let reasoningEffort = appSettings.get('reasoningEffort');

const REVIEW_SYSTEM_PROMPT = `
Analyze the supplied tweet according to the user's custom instructions, assign it an integer score from 0 through 10, and suggest three relevant follow-up questions that you can confidently answer.
Your response content should be a json object that follows this schema. 
{
  "Response": "Your tweet analysis",
  "Score": 0,
  "Question1": "First follow-up question",
  "Question2": "Second follow-up question",
  "Question3": "Third follow-up question"
}

"Response" must follow the user's response and style preferences. "Score" is required for tweet analysis and must be a JSON number. Do not directly address the user in the suggested questions.
`;
const FOLLOW_UP_SYSTEM_PROMPT = `
You are TweetFilter-AI, having a conversation about a tweet.
The conversation contains the tweet and any available thread or media context. An earlier assistant message may contain a rating, but a rating is not required to discuss the tweet.

Use these preferences as guidance for the style and focus of your answers. Do not rate the tweet unless the user asks you to:
{USER_INSTRUCTIONS_PLACEHOLDER}

Answer the latest question and suggest three relevant follow-up questions that you can confidently answer.

Return only one valid JSON object. Do not use text outside the JSON object. Use exactly this schema:
{
  "Response": "Your answer",
  "Question1": "First follow-up question",
  "Question2": "Second follow-up question",
  "Question3": "Third follow-up question"
}

Do not include "Score" in conversation responses. If the user asks about the tweet's rating, answer in "Response". Do not directly address the user in the suggested questions.
`;
let modelTemperature = appSettings.getNumber('modelTemperature');
let modelTopP = appSettings.getNumber('modelTopP');
let imageModelTemperature = appSettings.getNumber('imageModelTemperature');
let imageModelTopP = appSettings.getNumber('imageModelTopP');
let maxTokens = appSettings.getInteger('maxTokens');

const TWEET_ARTICLE_SELECTOR = 'article[data-testid="tweet"]';
const QUOTE_CONTAINER_SELECTOR = 'div[role="link"][tabindex="0"]';
const USER_HANDLE_SELECTOR = 'div[data-testid="User-Name"] a[role="link"]';
const TWEET_TEXT_SELECTOR = 'div[data-testid="tweetText"]';
const MEDIA_IMG_SELECTOR = 'div[data-testid="tweetPhoto"] img, img[src*="pbs.twimg.com/media"], img[src*="pbs.twimg.com/amplify_video_thumb"]';
const MEDIA_VIDEO_SELECTOR = 'video[poster*="pbs.twimg.com"], video';
const PERMALINK_SELECTOR = 'a[href*="/status/"] time';
const WEBSITE_CARD_SELECTOR = '[data-testid="card.wrapper"]';

function getModelIdentifierCandidates(model) {
  return [
    model?.slug,
    model?.id,
    model?.canonical_slug,
    model?.endpoint?.model_variant_slug,
    model?.name
  ];
}

function modelHasImageInput(model) {
  if (!model) {
    return false;
  }

  const modalities = [
    ...(Array.isArray(model.input_modalities) ? model.input_modalities : []),
    ...(Array.isArray(model.architecture?.input_modalities) ? model.architecture.input_modalities : []),
    ...(typeof model.architecture?.modality === 'string' ? model.architecture.modality.split(/[+,/ ]/) : [])
  ].map(modality => modality.toLowerCase());

  return modalities.includes('image');
}

function getCachedImageCapableModelIds() {
  const cachedIds = browserGet('imageCapableModelIds', []);
  if (Array.isArray(cachedIds)) {
    return cachedIds;
  }
  try {
    const parsedIds = JSON.parse(cachedIds);
    return Array.isArray(parsedIds) ? parsedIds : [];
  } catch (error) {
    return [];
  }
}

/**
 * Helper function to check if a model supports images based on its architecture
 * @param {string} modelId - The model ID to check
 * @returns {boolean} - Whether the model supports image input
 */
function modelSupportsImages(modelId) {
  if (!modelId) {
    return false;
  }

  const normalizedModelId = modelId.toLowerCase();
  const model = availableModels?.find(model =>
    getModelIdentifierCandidates(model)
      .filter(Boolean)
      .some(value => value.toLowerCase() === normalizedModelId)
  );

  if (model) {
    return modelHasImageInput(model);
  }

  return getCachedImageCapableModelIds()
    .filter(Boolean)
    .some(value => value.toLowerCase() === normalizedModelId);
}
