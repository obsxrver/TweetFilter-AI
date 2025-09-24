/**
 * Formats description text for the tooltip.
 * Copy of the function from ui.js to ensure it's available for streaming.
 */
const safetySettings = [
    {
        category: "HARM_CATEGORY_HARASSMENT",
        threshold: "BLOCK_NONE",
    },
    {
        category: "HARM_CATEGORY_HATE_SPEECH",
        threshold: "BLOCK_NONE",
    },
    {
        category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        threshold: "BLOCK_NONE",
    },
    {
        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
        threshold: "BLOCK_NONE",
    },
    {
        category: "HARM_CATEGORY_CIVIC_INTEGRITY",
        threshold: "BLOCK_NONE",
    },
];

/**
 * Extracts follow-up questions from the AI response content.
 * @param {string} content - The full AI response content.
 * @returns {string[]} An array of 3 questions, or an empty array if not found.
 */
function extractFollowUpQuestions(content) {
    if (!content) return [];

    const questions = [];
    const q1Marker = "Q_1.";
    const q2Marker = "Q_2.";
    const q3Marker = "Q_3.";

    const q1Start = content.indexOf(q1Marker);
    const q2Start = content.indexOf(q2Marker);
    const q3Start = content.indexOf(q3Marker);

    if (q1Start !== -1 && q2Start > q1Start && q3Start > q2Start) {

        const q1Text = content.substring(q1Start + q1Marker.length, q2Start).trim();
        questions.push(q1Text);

        const q2Text = content.substring(q2Start + q2Marker.length, q3Start).trim();
        questions.push(q2Text);

        let q3Text = content.substring(q3Start + q3Marker.length).trim();

        const endMarker = "</FOLLOW_UP_QUESTIONS>";
        if (q3Text.endsWith(endMarker)) {
            q3Text = q3Text.substring(0, q3Text.length - endMarker.length).trim();
        }
        questions.push(q3Text);

        if (questions.every(q => q.length > 0)) {
            return questions;
        }
    }

    console.warn("[extractFollowUpQuestions] Failed to find or parse Q_1/Q_2/Q_3 markers.");
    return [];
}

/**
 * Rates a tweet using the OpenRouter API with automatic retry functionality.
 *
 * @param {string} tweetText - The text content of the tweet
 * @param {string} tweetId - The unique tweet ID
 * @param {string} apiKey - The API key for authentication
 * @param {string[]} mediaUrls - Array of media URLs associated with the tweet
 * @param {number} [maxRetries=3] - Maximum number of retry attempts
 * @param {Element} [tweetArticle=null] - Optional: The tweet article DOM element (for streaming updates)
 * @returns {Promise<{score: number, content: string, error: boolean, cached?: boolean, data?: any, questions?: string[]}>} The rating result
 */
async function rateTweetWithOpenRouter(tweetText, tweetId, apiKey, mediaUrls, maxRetries = 3, tweetArticle = null, authorHandle="") {
    console.log("given tweettext\n", tweetText);
    const cleanupRequest = () => {
        pendingRequests = Math.max(0, pendingRequests - 1);
        showStatus(`Rating tweet... (${pendingRequests} pending)`);
    };

    const indicatorInstance = ScoreIndicatorRegistry.get(tweetId, tweetArticle);
    if (!indicatorInstance) {
        console.error(`[API rateTweetWithOpenRouter] Could not get/create ScoreIndicator for ${tweetId}.`);

        return {
            score: 5,
            content: "Failed to initialize UI components for rating.",
            reasoning: "",
            questions: [],
            lastAnswer: "",
            error: true,
            cached: false,
            data: null,
            qaConversationHistory: []
        };
    }

    if (adAuthorCache.has(authorHandle)) {

        indicatorInstance.updateInitialReviewAndBuildHistory({
            fullContext: tweetText,
            mediaUrls: [],
            apiResponseContent: "<ANALYSIS>This tweet is from an ad author.</ANALYSIS><SCORE>SCORE_0</SCORE><FOLLOW_UP_QUESTIONS>Q_1. N/A\\nQ_2. N/A\\nQ_3. N/A</FOLLOW_UP_QUESTIONS>",
            reviewSystemPrompt: REVIEW_SYSTEM_PROMPT,
            followUpSystemPrompt: FOLLOW_UP_SYSTEM_PROMPT,
            userInstructions: currentInstructions
        });
        return {
            score: 0,
            content: indicatorInstance.description,
            reasoning: "",
            error: false,
            cached: false,
            questions: indicatorInstance.questions,
            qaConversationHistory: indicatorInstance.qaConversationHistory
        };
    }

    const currentInstructions = instructionsManager.getCurrentInstructions();
    const effectiveModel = browserGet('enableWebSearch', false) ? `${selectedModel}:online` : selectedModel;

    const requestBody = {
        model: effectiveModel,
        messages: [
            {
                role: "system",
                content: [{ type: "text", text: REVIEW_SYSTEM_PROMPT + `

USER'S CUSTOM INSTRUCTIONS:
${currentInstructions}`}]
            },
            {
                role: "user",
                content: [
                    {
                        type: "text",
                        text: `<TARGET_TWEET_ID>[${tweetId}]</TARGET_TWEET_ID>

<TWEET>[${tweetText}]</TWEET>
Follow this expected response format exactly, or you break the UI:
EXPECTED_RESPONSE_FORMAT:\n
  <ANALYSIS>\n
    \n(Your analysis according to the user instructions. Follow the user instructions EXACTLY.)
  </ANALYSIS>\n

  <SCORE>\n
    SCORE_X (Where X is a number between 0 and 10, unless the user requests a different range)\n
  </SCORE>\n

  <FOLLOW_UP_QUESTIONS>\n
    Q_1. …\n
    Q_2. …\n
    Q_3. …\n
  </FOLLOW_UP_QUESTIONS>
`
                    }
                ]
            }
        ],
        temperature: modelTemperature,
        top_p: modelTopP,
        max_tokens: maxTokens
    };

    if (selectedModel.includes('gemini')) {
        requestBody.config = { safetySettings: safetySettings };
    }
    if (mediaUrls?.length > 0) {

        const imageUrls = [];
        const videoDescriptions = [];

        mediaUrls.forEach(item => {
            if (item.startsWith('[VIDEO_DESCRIPTION]:')) {
                videoDescriptions.push(item);
            } else {
                imageUrls.push(item);
            }
        });

        if (imageUrls.length > 0 && modelSupportsImages(selectedModel)) {
            imageUrls.forEach(url => {
                if (url.startsWith('data:application/pdf')) {

                    requestBody.messages[1].content.push({
                        type: "file",
                        file: {
                            filename: "attachment.pdf",
                            file_data: url
                        }
                    });
                } else if (url.startsWith('http://') || url.startsWith('https://')) {

                    requestBody.messages[1].content.push({
                        type: "image_url",
                        image_url: { "url": url }
                    });
                } else {

                    console.warn(`[API] Skipping invalid URL for image processing: ${url.substring(0, 100)}...`);
                }
            });
        }
    }
    if (providerSort) {
        requestBody.provider = { sort: providerSort, allow_fallbacks: true };
    }

    const useStreaming = browserGet('enableStreaming', false);

    tweetCache.set(tweetId, {
        streaming: true,
        timestamp: Date.now(),
        tweetContent: tweetText,
        mediaUrls: mediaUrls
    });

    let attempt = 0;
    while (attempt < maxRetries) {
        attempt++;

        const now = Date.now();
        const timeElapsed = now - lastAPICallTime;
        if (timeElapsed < API_CALL_DELAY_MS) {
            await new Promise(resolve => setTimeout(resolve, Math.max(0, API_CALL_DELAY_MS - timeElapsed)));
        }
        lastAPICallTime = now;

        pendingRequests++;
        showStatus(`Rating tweet... (${pendingRequests} pending)`);

        try {
            let result;
            if (useStreaming) {
                result = await rateTweetStreaming(requestBody, apiKey, tweetId, tweetText, tweetArticle);
            } else {
                result = await rateTweet(requestBody, apiKey);
            }
            cleanupRequest();

            if (!result.error && result.content) {
                indicatorInstance.updateInitialReviewAndBuildHistory({
                    fullContext: tweetText,
                    mediaUrls: mediaUrls,
                    apiResponseContent: result.content,
                    reviewSystemPrompt: REVIEW_SYSTEM_PROMPT,
                    followUpSystemPrompt: FOLLOW_UP_SYSTEM_PROMPT,
                    userInstructions: currentInstructions
                });

                const finalScore = indicatorInstance.score;
                const finalQuestions = indicatorInstance.questions;
                const finalDescription = indicatorInstance.description;
                const finalQaHistory = indicatorInstance.qaConversationHistory;

                tweetCache.set(tweetId, {
                    score: finalScore,
                    description: finalDescription,
                    reasoning: result.reasoning || "",
                    questions: finalQuestions,
                    lastAnswer: "",
                    tweetContent: tweetText,
                    mediaUrls: mediaUrls,
                    streaming: false,
                    timestamp: Date.now(),
                    metadata: result.data?.id ? { generationId: result.data.id } : null,
                    qaConversationHistory: finalQaHistory
                });

                return {
                    score: finalScore,
                    content: result.content,
                    reasoning: result.reasoning || "",
                    questions: finalQuestions,
                    error: false,
                    cached: false,
                    data: result.data,
                    qaConversationHistory: finalQaHistory
                };
            }

            if (attempt < maxRetries && (result.error || !result.content)) {
                const backoffDelay = Math.pow(attempt, 2) * 1000;
                await new Promise(resolve => setTimeout(resolve, backoffDelay));
            } else if (result.error || !result.content) {

                throw new Error(result.content || "Failed to get valid rating content after multiple attempts");
            }

        } catch (error) {
            cleanupRequest();
            console.error(`API error during attempt ${attempt}:`, error);
            if (attempt < maxRetries) {
                const backoffDelay = Math.pow(attempt, 2) * 1000;
                await new Promise(resolve => setTimeout(resolve, backoffDelay));
            } else {

                const errorContent = `Failed to get valid rating after multiple attempts: ${error.message}`;
                indicatorInstance.updateInitialReviewAndBuildHistory({
                    fullContext: tweetText,
                    mediaUrls: mediaUrls,
                    apiResponseContent: `<ANALYSIS>${errorContent}</ANALYSIS><SCORE>SCORE_5</SCORE><FOLLOW_UP_QUESTIONS>Q_1. N/A\\nQ_2. N/A\\nQ_3. N/A</FOLLOW_UP_QUESTIONS>`,
                    reviewSystemPrompt: REVIEW_SYSTEM_PROMPT,
                    followUpSystemPrompt: FOLLOW_UP_SYSTEM_PROMPT,
                    userInstructions: currentInstructions
                });
                tweetCache.set(tweetId, {
                    score: 5,
                    description: errorContent,
                    reasoning: "",
                    questions: [],
                    lastAnswer: "",
                    error: true,
                    tweetContent: tweetText,
                    mediaUrls: mediaUrls,
                    streaming: false,
                    timestamp: Date.now(),
                    qaConversationHistory: indicatorInstance.qaConversationHistory
                });
                return {
                    score: 5,
                    content: errorContent,
                    reasoning: "",
                    questions: [],
                    lastAnswer: "",
                    error: true,
                    data: null,
                    qaConversationHistory: indicatorInstance.qaConversationHistory
                };
            }
        }
    }

    cleanupRequest();
    const fallbackError = "Unexpected failure in rating process.";
    indicatorInstance.updateInitialReviewAndBuildHistory({
        fullContext: tweetText,
        mediaUrls: mediaUrls,
        apiResponseContent: `<ANALYSIS>${fallbackError}</ANALYSIS><SCORE>SCORE_5</SCORE><FOLLOW_UP_QUESTIONS>Q_1. N/A\\nQ_2. N/A\\nQ_3. N/A</FOLLOW_UP_QUESTIONS>`,
        reviewSystemPrompt: REVIEW_SYSTEM_PROMPT,
        followUpSystemPrompt: FOLLOW_UP_SYSTEM_PROMPT,
        userInstructions: currentInstructions
    });
    return {
        score: 5,
        content: fallbackError,
        reasoning: "",
        questions: [],
        lastAnswer: "",
        error: true,
        data: null,
        qaConversationHistory: indicatorInstance.qaConversationHistory
    };
}

/**
 * Performs a non-streaming tweet rating request
 *
 * @param {Object} request - The formatted request body
 * @param {string} apiKey - API key for authentication
 * @returns {Promise<{content: string, reasoning: string, error: boolean, data: any}>} The rating result
 */
async function rateTweet(request, apiKey) {
    const tweetId = request.tweetId;
    const existingScore = tweetCache.get(tweetId)?.score;

    const result = await getCompletion(request, apiKey);

    if (!result.error && result.data?.choices?.[0]?.message) {
        const content = result.data.choices[0].message.content || "";
        const reasoning = result.data.choices[0].message.reasoning || "";

        const scoreMatches = content.match(/SCORE_(\d+)/g);
        const score = existingScore || (scoreMatches && scoreMatches.length > 0
            ? parseInt(scoreMatches[scoreMatches.length - 1].match(/SCORE_(\d+)/)[1], 10)
            : null);

        tweetCache.set(tweetId, {
            score: score,
            description: content,
            tweetContent: request.tweetText,
            streaming: false
        });

        return {
            content,
            reasoning
        };
    }

    return {
        error: true,
        content: result.error || "Unknown error",
        reasoning: "",
        data: null
    };
}

/**
 * Performs a streaming tweet rating request with real-time UI updates
 *
 * @param {Object} request - The formatted request body
 * @param {string} apiKey - API key for authentication
 * @param {string} tweetId - The tweet ID
 * @param {string} tweetText - The text content of the tweet
 * @param {Element} tweetArticle - Optional: The tweet article DOM element (for streaming updates)
 * @returns {Promise<{content: string, reasoning: string, error: boolean, data: any}>} The rating result including final content and reasoning
 */
async function rateTweetStreaming(request, apiKey, tweetId, tweetText, tweetArticle) {

    if (window.activeStreamingRequests && window.activeStreamingRequests[tweetId]) {
        console.log(`Aborting existing streaming request for tweet ${tweetId}`);
        window.activeStreamingRequests[tweetId].abort();
        delete window.activeStreamingRequests[tweetId];
    }

    const existingCache = tweetCache.get(tweetId);
    if (!existingCache || existingCache.score === undefined || existingCache.score === null) {
        tweetCache.set(tweetId, {
            streaming: true,
            timestamp: Date.now(),
            tweetContent: tweetText,
            description: "",
            reasoning: "",
            questions: [],
            lastAnswer: "",
            score: null
        });
    }

    return new Promise((resolve, reject) => {

        const indicatorInstance = ScoreIndicatorRegistry.get(tweetId, tweetArticle);
        if (!indicatorInstance) {
             console.error(`[API Stream] Could not get/create ScoreIndicator for ${tweetId}. Aborting stream setup.`);

             if (tweetCache.has(tweetId)) {
                 tweetCache.get(tweetId).streaming = false;
                 tweetCache.get(tweetId).error = "Indicator initialization failed";
             }
             return reject(new Error(`ScoreIndicator instance could not be initialized for tweet ${tweetId}`));
        }

        let aggregatedContent = existingCache?.description || "";
        let aggregatedReasoning = existingCache?.reasoning || "";
        let finalData = null;
        let score = existingCache?.score || null;

        getCompletionStreaming(
            request,
            apiKey,

            (chunkData) => {
                aggregatedContent = chunkData.content || aggregatedContent;
                aggregatedReasoning = chunkData.reasoning || aggregatedReasoning;

                const scoreMatches = aggregatedContent.match(/SCORE_(\d+)/g);

                if (scoreMatches && scoreMatches.length > 0) {
                    const lastScore = scoreMatches[scoreMatches.length - 1];
                    score = parseInt(lastScore.match(/SCORE_(\d+)/)[1], 10);
                }

                 indicatorInstance.update({
                    status: 'streaming',
                    score: score,
                    description: aggregatedContent || "Rating in progress...",
                    reasoning: aggregatedReasoning,
                    questions: [],
                    lastAnswer: ""
                });

                if (tweetCache.has(tweetId)) {
                    const entry = tweetCache.get(tweetId);
                    entry.description = aggregatedContent;
                    entry.reasoning = aggregatedReasoning;
                    entry.score = score;
                    entry.streaming = true;
                }
            },

            (finalResult) => {
                console.log(finalResult);
                aggregatedContent = finalResult.content || aggregatedContent;
                aggregatedReasoning = finalResult.reasoning || aggregatedReasoning;
                finalData = finalResult.data;

                const scoreMatches = aggregatedContent.match(/SCORE_(\d+)/g);
                if (scoreMatches && scoreMatches.length > 0) {
                    const lastScore = scoreMatches[scoreMatches.length - 1];
                    score = parseInt(lastScore.match(/SCORE_(\d+)/)[1], 10);
                }

                let finalStatus = 'rated';

                if (score === null || score === undefined) {
                    console.warn(`[API Stream] No score found in final content for tweet ${tweetId}. Content: ${aggregatedContent.substring(0, 100)}...`);
                    finalStatus = 'error';
                    score = 5;
                    aggregatedContent += "\n[No score detected - Error]";
                }

                const finalCacheData = {
                    tweetContent: tweetText,
                    score: score,
                    description: aggregatedContent,
                    reasoning: aggregatedReasoning,
                    streaming: false,
                    timestamp: Date.now(),
                    error: finalStatus === 'error' ? "No score detected" : undefined,
                    metadata: finalData?.id ? { generationId: finalData.id } : null
                };
                tweetCache.set(tweetId, finalCacheData);

                indicatorInstance.update({
                    status: finalStatus,
                    score: score,
                    description: aggregatedContent,
                    reasoning: aggregatedReasoning,
                    questions: extractFollowUpQuestions(aggregatedContent),
                    lastAnswer: "",
                    metadata: finalData?.id ? { generationId: finalData.id } : null
                });

                if (tweetArticle) {
                    filterSingleTweet(tweetArticle);
                }

                const generationId = finalData?.id;
                if (generationId && apiKey) {
                    fetchAndStoreGenerationMetadata(tweetId, generationId, apiKey, indicatorInstance);
                }

                resolve({
                    score: score,
                    content: aggregatedContent,
                    reasoning: aggregatedReasoning,
                    error: finalStatus === 'error',
                    cached: false,
                    data: finalData
                });
            },

            (errorData) => {
                 console.error(`[API Stream Error] Tweet ${tweetId}: ${errorData.message}`);

                indicatorInstance.update({
                    status: 'error',
                    score: 5,
                    description: `Stream Error: ${errorData.message}`,
                    reasoning: '',
                    questions: [],
                    lastAnswer: ''
                });

                if (tweetCache.has(tweetId)) {
                     const entry = tweetCache.get(tweetId);
                     entry.streaming = false;
                     entry.error = errorData.message;
                     entry.score = 5;
                     entry.description = `Stream Error: ${errorData.message}`;
                }

                reject(new Error(errorData.message));
            },
            30000,
            tweetId
        );
    });
}

/**
 * Fetches generation metadata with retry logic and updates cache/UI.
 * @param {string} tweetId
 * @param {string} generationId
 * @param {string} apiKey
 * @param {ScoreIndicator} indicatorInstance - The indicator instance to update.
 * @param {number} [attempt=0]
 * @param {number[]} [delays=[1000, 500, 2000, 4000, 8000]]
 */
async function fetchAndStoreGenerationMetadata(tweetId, generationId, apiKey, indicatorInstance, attempt = 0, delays = [1000, 500, 2000, 4000, 8000]) {
    if (attempt >= delays.length) {
        console.warn(`[Metadata Fetch ${tweetId}] Max retries reached for generation ${generationId}.`);
        return;
    }

    const delay = delays[attempt];

    await new Promise(resolve => setTimeout(resolve, delay));

    try {

        const metadataResult = await getGenerationMetadata(generationId, apiKey);

        if (!metadataResult.error && metadataResult.data?.data) {
            const meta = metadataResult.data.data;

            const extractedMetadata = {
                model: meta.model || 'N/A',
                promptTokens: meta.tokens_prompt || 0,
                completionTokens: meta.tokens_completion || 0,
                reasoningTokens: meta.native_tokens_reasoning || 0,
                latency: meta.latency !== undefined ? (meta.latency / 1000).toFixed(2) + 's' : 'N/A',
                mediaInputs: meta.num_media_prompt || 0,
                price: meta.total_cost !== undefined ? `$${meta.total_cost.toFixed(6)}` : 'N/A',
                providerName: meta.provider_name || 'N/A'
            };

            const currentCache = tweetCache.get(tweetId);
            if (currentCache) {
                currentCache.metadata = extractedMetadata;
                tweetCache.set(tweetId, currentCache);

                indicatorInstance.update({ metadata: extractedMetadata });
                console.log(`[Metadata Fetch ${tweetId}] Stored metadata and updated UI for generation ${generationId}`);
            } else {
                console.warn(`[Metadata Fetch ${tweetId}] Cache entry disappeared before metadata could be stored for generation ${generationId}.`);
            }
            return;
        } else if (metadataResult.status === 404) {

            fetchAndStoreGenerationMetadata(tweetId, generationId, apiKey, indicatorInstance, attempt + 1, delays);
        } else {
            console.warn(`[Metadata Fetch ${tweetId}] Error fetching metadata (Attempt ${attempt + 1}) for ${generationId}: ${metadataResult.message}`);
            fetchAndStoreGenerationMetadata(tweetId, generationId, apiKey, indicatorInstance, attempt + 1, delays);
        }
    } catch (error) {
        console.error(`[Metadata Fetch ${tweetId}] Unexpected error during fetch (Attempt ${attempt + 1}) for ${generationId}:`, error);

        fetchAndStoreGenerationMetadata(tweetId, generationId, apiKey, indicatorInstance, attempt + 1, delays);
    }
}

/**
 * Answers a follow-up question about a tweet and generates new questions.
 *
 * @param {string} tweetId - The ID of the tweet being discussed.
 * @param {object[]} qaHistoryForApiCall - The conversation history array, including the latest user message.
 * @param {string} apiKey - The OpenRouter API key.
 * @param {Element} [tweetArticle=null] - The DOM element for the tweet article.
 * @param {ScoreIndicator} indicatorInstance - The ScoreIndicator instance to update.
 * @returns {Promise<void>} Resolves when the answer is generated and UI updated.
 */
async function answerFollowUpQuestion(tweetId, qaHistoryForApiCall, apiKey, tweetArticle, indicatorInstance) {
    const questionTextForLogging = qaHistoryForApiCall.find(m => m.role === 'user' && m === qaHistoryForApiCall[qaHistoryForApiCall.length - 1])?.content.find(c => c.type === 'text')?.text || "User's question";
    console.log(`[FollowUp] Answering question for ${tweetId}: "${questionTextForLogging}" using full history.`);
    const useStreaming = browserGet('enableStreaming', false);

    const messagesForApi = qaHistoryForApiCall.map((msg, index) => {
        if (index === qaHistoryForApiCall.length - 1 && msg.role === 'user') {
            const rawUserText = msg.content.find(c => c.type === 'text')?.text || "";
            const templatedText = `<UserQuestion> ${rawUserText} </UserQuestion>\n        You MUST match the EXPECTED_RESPONSE_FORMAT\n        EXPECTED_RESPONSE_FORMAT:\n        <ANSWER>\n(Your answer here)\n</ANSWER>\n
            <FOLLOW_UP_QUESTIONS> (Anticipate 3 things the user may ask you next. These questions should not be directed at the user. Only pose a question if you are sure you can answer it, based off your knowledge.)\nQ_1. (New Question 1 here)\nQ_2. (New Question 2 here)\nQ_3. (New Question 3 here)\n</FOLLOW_UP_QUESTIONS>\n        `;
            const templatedContent = [{ type: "text", text: templatedText }];
            msg.content.forEach(contentItem => {
                if (contentItem.type === "image_url") {
                    templatedContent.push(contentItem);
                }
            });
            return { ...msg, content: templatedContent };
        }
        return msg;
    });

    const effectiveModel = browserGet('enableWebSearch', false) ? `${selectedModel}:online` : selectedModel;

    const request = {
        model: effectiveModel,
        messages: messagesForApi,
        temperature: modelTemperature,
        top_p: modelTopP,
        max_tokens: maxTokens,
        stream: useStreaming
    };
    console.log(`followup request (templated): ${JSON.stringify(request)}`);

    if (selectedModel.includes('gemini')) {
        request.config = { safetySettings: safetySettings };
    }
    if (providerSort) {
        request.provider = { sort: providerSort, allow_fallbacks: true };
    }

    try {
        try {
            let finalAnswerContent = "*Processing...*";
            let finalQaHistory = [...qaHistoryForApiCall];

            if (useStreaming) {
                await new Promise((resolve, reject) => {
                    let aggregatedContent = "";
                    let aggregatedReasoning = "";

                    getCompletionStreaming(
                        request, apiKey,

                        (chunkData) => {
                            aggregatedContent = chunkData.content || aggregatedContent;
                            aggregatedReasoning = chunkData.reasoning || aggregatedReasoning;

                            indicatorInstance._renderStreamingAnswer(aggregatedContent, aggregatedReasoning);
                        },

                        (result) => {
                            finalAnswerContent = result.content || aggregatedContent;
                            const finalReasoning = result.reasoning || aggregatedReasoning;
                            const assistantMessage = { role: "assistant", content: [{ type: "text", text: finalAnswerContent }] };
                            finalQaHistory.push(assistantMessage);

                            if (indicatorInstance.conversationHistory.length > 0) {
                                const lastTurn = indicatorInstance.conversationHistory[indicatorInstance.conversationHistory.length - 1];
                                if (lastTurn.answer === 'pending') {
                                    lastTurn.reasoning = finalReasoning;
                                }
                            }

                            indicatorInstance.updateAfterFollowUp({
                                assistantResponseContent: finalAnswerContent,
                                updatedQaHistory: finalQaHistory
                            });

                            const currentCache = tweetCache.get(tweetId) || {};
                            currentCache.qaConversationHistory = finalQaHistory;

                            const parsedAnswer = finalAnswerContent.match(/<ANSWER>([\s\S]*?)<\/ANSWER>/);
                            currentCache.lastAnswer = parsedAnswer ? parsedAnswer[1].trim() : finalAnswerContent;
                            currentCache.questions = extractFollowUpQuestions(finalAnswerContent);
                            currentCache.timestamp = Date.now();
                            tweetCache.set(tweetId, currentCache);

                            resolve();
                        },

                        (error) => {
                            console.error("[FollowUp Stream Error]", error);
                            const errorMessage = `Error generating answer: ${error.message}`;

                            indicatorInstance._updateConversationHistory(questionTextForLogging, errorMessage);
                            indicatorInstance.questions = tweetCache.get(tweetId)?.questions || [];
                            indicatorInstance._updateTooltipUI();

                            const currentCache = tweetCache.get(tweetId) || {};
                            currentCache.lastAnswer = errorMessage;
                            currentCache.timestamp = Date.now();
                            tweetCache.set(tweetId, currentCache);

                            reject(new Error(error.message));
                        },
                        60000,
                        `followup-${tweetId}`
                    );
                });
            } else {
                const result = await getCompletion(request, apiKey, 60000);
                if (result.error || !result.data?.choices?.[0]?.message?.content) {
                    throw new Error(result.message || "Failed to get follow-up answer.");
                }
                finalAnswerContent = result.data.choices[0].message.content;
                const assistantMessage = { role: "assistant", content: [{ type: "text", text: finalAnswerContent }] };
                finalQaHistory.push(assistantMessage);

                indicatorInstance.updateAfterFollowUp({
                    assistantResponseContent: finalAnswerContent,
                    updatedQaHistory: finalQaHistory
                });

                const currentCache = tweetCache.get(tweetId) || {};
                currentCache.qaConversationHistory = finalQaHistory;
                const parsedAnswer = finalAnswerContent.match(/<ANSWER>([\s\S]*?)<\/ANSWER>/);
                currentCache.lastAnswer = parsedAnswer ? parsedAnswer[1].trim() : finalAnswerContent;
                currentCache.questions = extractFollowUpQuestions(finalAnswerContent);
                currentCache.timestamp = Date.now();
                tweetCache.set(tweetId, currentCache);
            }
        } catch (error) {
            console.error(`[FollowUp] Error answering question for ${tweetId}:`, error);
            const errorMessage = `Error answering question: ${error.message}`;
            indicatorInstance._updateConversationHistory(questionTextForLogging, errorMessage);
            indicatorInstance.questions = tweetCache.get(tweetId)?.questions || [];
            indicatorInstance._updateTooltipUI();

            const currentCache = tweetCache.get(tweetId) || {};
            currentCache.lastAnswer = errorMessage;
            currentCache.timestamp = Date.now();
            tweetCache.set(tweetId, currentCache);

        }
    } finally {

        if (indicatorInstance && typeof indicatorInstance._finalizeFollowUpInteraction === 'function') {
            indicatorInstance._finalizeFollowUpInteraction();
        }
    }
}

