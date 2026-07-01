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

    You are TweetFilter-AI.
    Today's Date: ${new Date().toLocaleDateString()}.
    Overview: You will be given a tweet. You are tasked with analyzing this tweet and providing a score and follow-up questions. The score, tone of the analysis, and the follow-up questions should align with the preferences set by the user's custom instructions. 
    Tasks:
    1. Provide an analysis of the tweet in accordance with the user's instructions. It is crucial that your analysis follows the instructions and response preferences.
    2. Assign a score according to the user's instructions in the format SCORE_X, where 0<=X<=10 (unless the user specifies a different range)
    3. Write three follow-up questions the user might ask next.

    Output formatting must match the EXPECTED_RESPONSE_FORMAT. Meaning, you must include all formatting tags.
    EXPECTED_RESPONSE_FORMAT:
    <ANALYSIS>
      (Your analysis goes here. It must follow the user's response and style preferences.)
    </ANALYSIS>

    <SCORE>
      SCORE_X (Where 0<=X<=10. If and only if the user requests a different range, use that range instead.)
    </SCORE>

    <FOLLOW_UP_QUESTIONS>
      <Q1>(Your first follow-up question goes here)</Q1>
      <Q2>(Your second follow-up question goes here)</Q2>
      <Q3>(Your third follow-up question goes here)</Q3>
    </FOLLOW_UP_QUESTIONS>

    NOTES:
    For follow-up questions, do not directly address the user. Instead, generate questions that would naturally encourage further exploration or discussion, and only include questions you can confidently answer. Examples:

    GOOD follow-up questions:
    <FOLLOW_UP_QUESTIONS>
      <Q1>Why was the Eiffel Tower constructed?</Q1>
      <Q2>When was the Eiffel Tower completed?</Q2>
      <Q3>What are some interesting facts about the Eiffel Tower's history?</Q3>
    </FOLLOW_UP_QUESTIONS>

    BAD follow-up questions:
    <FOLLOW_UP_QUESTIONS>
      <Q1>Have you visited the Eiffel Tower?</Q1>
      <Q2>What other tweets has this author posted regarding Paris?</Q2>
      <Q3>What are the latest events happening in Paris?</Q3>
    </FOLLOW_UP_QUESTIONS>
`;
const FOLLOW_UP_SYSTEM_PROMPT = `
You are TweetFilter-AI, continuing a conversation about a tweet you previously rated.
Today's Date: ${new Date().toLocaleDateString()}.
CONTEXT: You previously rated a tweet using these user instructions:
<USER_INSTRUCTIONS>
{USER_INSTRUCTIONS_PLACEHOLDER}
</USER_INSTRUCTIONS>

Please provide an answer and then generate 3 new, relevant follow-up questions. Continue to follow the style and tone preferences of the user's instructions.

Adhere to the new EXPECTED_RESPONSE_FORMAT, including all <formatting tags>.
EXPECTED_RESPONSE_FORMAT:
<ANSWER>
(Your answer here)
</ANSWER>
<FOLLOW_UP_QUESTIONS>
<Q1>(New Question 1 here)</Q1>
<Q2>(New Question 2 here)</Q2>
<Q3>(New Question 3 here)</Q3>
</FOLLOW_UP_QUESTIONS>

NOTES:
    For follow-up questions, do not directly address the user. Instead, generate questions that would naturally encourage further exploration or discussion, and only include questions you can confidently answer. Examples:

    GOOD follow-up questions:
    <FOLLOW_UP_QUESTIONS>
      <Q1>Why was the Eiffel Tower constructed?</Q1>
      <Q2>When was the Eiffel Tower completed?</Q2>
      <Q3>What are some interesting facts about the Eiffel Tower's history?</Q3>
    </FOLLOW_UP_QUESTIONS>

    BAD follow-up questions:
    <FOLLOW_UP_QUESTIONS>
      <Q1>Have you visited the Eiffel Tower?</Q1>
      <Q2>What other tweets has this author posted regarding Paris?</Q2>
      <Q3>What are the latest events happening in Paris?</Q3>
    </FOLLOW_UP_QUESTIONS>
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
const MEDIA_IMG_SELECTOR = 'div[data-testid="tweetPhoto"] img, img[src*="pbs.twimg.com/media"]';
const MEDIA_VIDEO_SELECTOR = 'video[poster*="pbs.twimg.com"], video';
const PERMALINK_SELECTOR = 'a[href*="/status/"] time';

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
