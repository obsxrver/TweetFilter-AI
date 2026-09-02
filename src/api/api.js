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
 * Extracts display-ready metadata from an OpenRouter completion response object.
 * @param {object|null} responseData
 * @returns {object|null}
 */
function extractCompletionMetadata(responseData) {
    if (!responseData) return null;

    const usage = responseData.usage || {};
    const completionTokenDetails = usage.completion_tokens_details || {};
    const explicitMediaInputs = responseData.num_media_prompt ?? responseData.media_inputs ?? responseData.mediaInputs;
    const totalCost = usage.cost ?? usage.total_cost ?? usage.cost_details?.upstream_inference_cost ?? responseData.total_cost;
    const latencyMs = responseData.latency ?? responseData.latency_ms;

    const metadata = {
        generationId: responseData.id || null,
        model: responseData.model || 'N/A',
        promptTokens: usage.prompt_tokens ?? responseData.tokens_prompt ?? 0,
        completionTokens: usage.completion_tokens ?? responseData.tokens_completion ?? 0,
        reasoningTokens: completionTokenDetails.reasoning_tokens ?? responseData.native_tokens_reasoning ?? 0,
        latency: latencyMs !== undefined ? (latencyMs / 1000).toFixed(2) + 's' : 'N/A',
        mediaInputs: explicitMediaInputs ?? 0,
        price: totalCost !== undefined ? `$${Number(totalCost).toFixed(6)}` : 'N/A',
        providerName: responseData.provider || responseData.provider_name || 'N/A'
    };

    return metadata.generationId || metadata.model !== 'N/A' || Object.keys(usage).length > 0
        ? metadata
        : null;
}

/**
 * Orders media URLs by their first appearance in the provided thread text.
 * URLs not found in the text keep their original relative order and are placed last.
 * @param {string[]} mediaUrls
 * @param {string} threadText
 * @returns {string[]}
 */
function orderMediaUrlsByThreadAppearance(mediaUrls, threadText) {
    if (!Array.isArray(mediaUrls) || mediaUrls.length <= 1 || !threadText) {
        return mediaUrls;
    }

    return mediaUrls
        .map((url, originalIndex) => ({
            url,
            originalIndex,
            firstIndex: typeof url === 'string' ? threadText.indexOf(url) : -1
        }))
        .sort((a, b) => {
            const aMissing = a.firstIndex === -1;
            const bMissing = b.firstIndex === -1;

            if (aMissing && bMissing) {
                return a.originalIndex - b.originalIndex;
            }
            if (aMissing) {
                return 1;
            }
            if (bMissing) {
                return -1;
            }
            if (a.firstIndex !== b.firstIndex) {
                return a.firstIndex - b.firstIndex;
            }
            return a.originalIndex - b.originalIndex;
        })
        .map(item => item.url);
}

function collectRatingImageUrls(mediaUrls, tweetText) {
    const imageUrls = [];
    const seenUrls = new Set();

    const addUrl = (url) => {
        const trimmedUrl = typeof url === 'string' ? url.trim() : '';
        if (!trimmedUrl || trimmedUrl.startsWith('[VIDEO_DESCRIPTION]:') || seenUrls.has(trimmedUrl)) {
            return;
        }
        seenUrls.add(trimmedUrl);
        imageUrls.push(trimmedUrl);
    };

    if (Array.isArray(mediaUrls)) {
        mediaUrls.forEach(addUrl);
    }

    if (tweetText) {
        const urlPattern = /https?:\/\/[^\s,\])>]+/g;
        const contextUrls = tweetText.match(urlPattern) || [];
        contextUrls.forEach(url => {
            if (/\/\/pbs\.twimg\.com\//.test(url) || /\.(png|jpe?g|webp|gif)(\?|$)/i.test(url)) {
                if(!url.includes("profile_image")){
                addUrl(url);
                }
            }
        });
    }

    return orderMediaUrlsByThreadAppearance(imageUrls, tweetText);
}

function appendRatingMediaContent(content, mediaUrls) {
    mediaUrls.forEach(url => {
        if (url.startsWith('data:application/pdf')) {
            content.push({
                type: "file",
                file: {
                    filename: "attachment.pdf",
                    file_data: url
                }
            });
        } else if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:image/')) {
            const modelImageUrl = stripImageUrlNameParam(url);
            content.push({
                type: "image_url",
                image_url: { "url": modelImageUrl }
            });
        } else {
            console.warn(`[API] Skipping invalid URL for image processing: ${url.substring(0, 100)}...`);
        }
    });
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
async function rateTweetWithOpenRouter(tweetText, tweetId, apiKey, mediaUrls, maxRetries = 3, tweetArticle = null, authorHandle="", saveCacheImmediately = true) {
    console.log("given tweettext\n", tweetText);
    const cleanupRequest = () => {
        tweetProcessingState.decrementPending();
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

    const currentInstructions = instructionsManager.getCurrentInstructions() || DEFAULT_INSTRUCTIONS;

    if (adAuthorCache.has(authorHandle)) {

        const adResponseContent = JSON.stringify({
            Response: 'This tweet is from an ad author.',
            Score: 0,
            Question1: 'N/A',
            Question2: 'N/A',
            Question3: 'N/A'
        });

        indicatorInstance.updateInitialReviewAndBuildHistory({
            fullContext: tweetText,
            mediaUrls: [],
            apiResponseContent: adResponseContent,
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

    const reasoningEffort = browserGet('reasoningEffort', 'none');

    const requestBody = {
        model: selectedModel,
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
                        text: `Tweet ID: ${tweetId}\n\nTweet context:\n${tweetText}`
                    }
                ]
            }
        ],
        temperature: modelTemperature,
        top_p: modelTopP,
        max_tokens: maxTokens,
    };

    if (reasoningEffort !== 'none') {
        requestBody.reasoning = { effort: reasoningEffort };
    }
    if(browserGet('enableWebSearch',false)){
        requestBody.tools = [{type: "openrouter:web_search"}];
    }
    if (selectedModel.includes('gemini')) {
        requestBody.config = { safetySettings: safetySettings };
    }
    const ratingImageUrls = collectRatingImageUrls(mediaUrls, tweetText);
    let ratingMediaForModel = [];
    if (ratingImageUrls.length > 0 && modelSupportsImages(selectedModel)) {
        ratingMediaForModel = await encodeImageUrlsAsDataUrls(ratingImageUrls);
        appendRatingMediaContent(requestBody.messages[1].content, ratingMediaForModel);
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
    }, saveCacheImmediately);

    let attempt = 0;
    while (attempt < maxRetries) {
        attempt++;

        const now = Date.now();
        const timeElapsed = now - lastAPICallTime;
        if (timeElapsed < API_CALL_DELAY_MS) {
            await new Promise(resolve => setTimeout(resolve, Math.max(0, API_CALL_DELAY_MS - timeElapsed)));
        }
        lastAPICallTime = now;

        tweetProcessingState.incrementPending();
        showStatus(`Rating tweet... (${pendingRequests} pending)`);

        try {
            let result;
            if (useStreaming) {
                result = await rateTweetStreaming(requestBody, apiKey, tweetId, tweetText, tweetArticle, saveCacheImmediately);
            } else {
                result = await rateTweet(requestBody, apiKey, tweetId, tweetText, saveCacheImmediately);
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
                    metadata: result.metadata || null,
                    qaConversationHistory: finalQaHistory
                }, saveCacheImmediately);

                return {
                    score: finalScore,
                    content: result.content,
                    reasoning: result.reasoning || "",
                    questions: finalQuestions,
                    error: false,
                    cached: false,
                    data: result.data,
                    metadata: result.metadata || null,
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
                    apiResponseContent: JSON.stringify({
                        Response: errorContent,
                        Score: 5,
                        Question1: 'N/A',
                        Question2: 'N/A',
                        Question3: 'N/A'
                    }),
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
                }, saveCacheImmediately);
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
        apiResponseContent: JSON.stringify({
            Response: fallbackError,
            Score: 5,
            Question1: 'N/A',
            Question2: 'N/A',
            Question3: 'N/A'
        }),
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
async function rateTweet(request, apiKey, tweetId, tweetText, saveCacheImmediately = true) {
    const existingScore = tweetCache.get(tweetId)?.score;

    const result = await getCompletion(request, apiKey);

    if (!result.error && result.data?.choices?.[0]?.message) {
        const content = result.data.choices[0].message.content || "";
        const reasoning = result.data.choices[0].message.reasoning || "";
        const parsedResponse = parseTweetFilterResponse(content);

        if (!isCompleteTweetAnalysisResponse(parsedResponse)) {
            return {
                error: true,
                content: 'The model returned an invalid tweet-analysis JSON response.',
                reasoning,
                data: result.data
            };
        }

        const score = existingScore ?? parsedResponse.score;

        tweetCache.set(tweetId, {
            score: score,
            description: content,
            tweetContent: tweetText,
            streaming: false,
            metadata: extractCompletionMetadata(result.data)
        }, saveCacheImmediately);

        return {
            content,
            reasoning,
            data: result.data,
            metadata: extractCompletionMetadata(result.data)
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
async function rateTweetStreaming(request, apiKey, tweetId, tweetText, tweetArticle, saveCacheImmediately = true) {

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
        }, saveCacheImmediately);
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

                const streamedScore = extractTweetFilterScore(aggregatedContent);
                if (streamedScore !== null) {
                    score = streamedScore;
                }

                 indicatorInstance.update({
                    status: TweetRatingStatus.STREAMING,
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
                const completionMetadata = extractCompletionMetadata(finalData);

                const finalParsedResponse = parseTweetFilterResponse(aggregatedContent);
                if (finalParsedResponse.score !== null) {
                    score = finalParsedResponse.score;
                }

                let finalStatus = TweetRatingStatus.RATED;

                if (!isCompleteTweetAnalysisResponse(finalParsedResponse)) {
                    console.warn(`[API Stream] Invalid JSON response for tweet ${tweetId}. Content: ${aggregatedContent.substring(0, 100)}...`);
                    finalStatus = TweetRatingStatus.ERROR;
                    score = 5;
                    aggregatedContent = JSON.stringify({
                        Response: `${finalParsedResponse.response || aggregatedContent}\n\nThe model returned an invalid tweet-analysis JSON response.`,
                        Score: score,
                        Question1: finalParsedResponse.questions[0] || 'N/A',
                        Question2: finalParsedResponse.questions[1] || 'N/A',
                        Question3: finalParsedResponse.questions[2] || 'N/A'
                    });
                }

                const finalCacheData = {
                    tweetContent: tweetText,
                    score: score,
                    description: aggregatedContent,
                    reasoning: aggregatedReasoning,
                    streaming: false,
                    timestamp: Date.now(),
                    error: finalStatus === TweetRatingStatus.ERROR ? "Invalid tweet-analysis JSON response" : undefined,
                    metadata: completionMetadata
                };
                tweetCache.set(tweetId, finalCacheData, saveCacheImmediately);

                indicatorInstance.update({
                    status: finalStatus,
                    score: score,
                    description: aggregatedContent,
                    reasoning: aggregatedReasoning,
                    questions: extractFollowUpQuestions(aggregatedContent),
                    lastAnswer: "",
                    metadata: completionMetadata
                });

                if (tweetArticle) {
                    filterSingleTweet(tweetArticle, saveCacheImmediately);
                }

                resolve({
                    score: score,
                    content: aggregatedContent,
                    reasoning: aggregatedReasoning,
                    error: finalStatus === TweetRatingStatus.ERROR,
                    cached: false,
                    data: finalData,
                    metadata: completionMetadata
                });
            },

            (errorData) => {
                 console.error(`[API Stream Error] Tweet ${tweetId}: ${errorData.message}`);

                indicatorInstance.update({
                    status: TweetRatingStatus.ERROR,
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
 * Builds the initial conversation context when a question is asked before the
 * tweet has been rated.
 *
 * @param {string} tweetId - The ID of the tweet being discussed.
 * @param {string} apiKey - The OpenRouter API key.
 * @param {Element|null} tweetArticle - The DOM element for the tweet article.
 * @returns {Promise<{systemMessage: object, tweetContextContent: object[]}>} The system prompt and tweet context content.
 */
async function buildUnratedTweetConversationHistory(tweetId, apiKey, tweetArticle) {
    const cachedEntry = tweetCache.get(tweetId);
    let fullContext = cachedEntry?.fullContext || tweetArticle?.dataset?.fullContext || '';

    if (!fullContext && tweetArticle) {
        fullContext = await getFullContext(tweetArticle, tweetId, apiKey);
    }

    if (!fullContext && cachedEntry?.individualTweetText) {
        fullContext = `[TWEET ${tweetId}]\n Author:@${cachedEntry.authorHandle || ''}:\n${cachedEntry.individualTweetText}`;
    }

    if (!fullContext) {
        throw new Error('Could not collect tweet context for this conversation.');
    }

    const currentInstructions = instructionsManager.getCurrentInstructions() || DEFAULT_INSTRUCTIONS;
    const conversationSystemPrompt = FOLLOW_UP_SYSTEM_PROMPT.replace(
        '{USER_INSTRUCTIONS_PLACEHOLDER}',
        currentInstructions
    );
    const tweetContextContent = [{ type: 'text', text: fullContext }];

    if (modelSupportsImages(selectedModel)) {
        const mediaUrls = tweetArticle
            ? extractMediaLinks(tweetArticle)
            : (cachedEntry?.mediaUrls?.length ? cachedEntry.mediaUrls : cachedEntry?.individualMediaUrls || []);
        appendRatingMediaContent(tweetContextContent, collectRatingImageUrls(mediaUrls, fullContext));
    }

    return {
        systemMessage: { role: 'system', content: [{ type: 'text', text: conversationSystemPrompt }] },
        tweetContextContent
    };
}

/**
 * Migrates older unrated conversation histories that stored tweet context and
 * the first question as adjacent user messages.
 *
 * @param {object[]} messages - Conversation messages.
 * @returns {object[]} Messages without consecutive user roles.
 */
function mergeConsecutiveUserMessages(messages) {
    return (messages || []).reduce((mergedMessages, message) => {
        const clonedMessage = {
            ...message,
            content: Array.isArray(message.content)
                ? message.content.map(contentItem => ({ ...contentItem }))
                : []
        };
        const previousMessage = mergedMessages[mergedMessages.length - 1];
        if (!previousMessage || previousMessage.role !== 'user' || clonedMessage.role !== 'user') {
            mergedMessages.push(clonedMessage);
            return mergedMessages;
        }

        const previousText = previousMessage.content
            .filter(contentItem => contentItem.type === 'text')
            .map(contentItem => contentItem.text || '')
            .join('\n\n');
        const currentText = clonedMessage.content
            .filter(contentItem => contentItem.type === 'text')
            .map(contentItem => contentItem.text || '')
            .join('\n\n');
        const previousLooksLikeTweetContext = previousText.includes('[TWEET ') || previousText.startsWith('Tweet context:');
        const combinedText = previousLooksLikeTweetContext && !previousText.includes('\n\nQuestion:\n')
            ? `Tweet context:\n${previousText}\n\nQuestion:\n${currentText}`
            : `${previousText}\n\n${currentText}`.trim();

        previousMessage.content = [
            { type: 'text', text: combinedText },
            ...previousMessage.content.filter(contentItem => contentItem.type !== 'text'),
            ...clonedMessage.content.filter(contentItem => contentItem.type !== 'text')
        ];
        return mergedMessages;
    }, []);
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

    if (!qaHistoryForApiCall.some(message => message.role === 'system')) {
        try {
            const { systemMessage, tweetContextContent } = await buildUnratedTweetConversationHistory(tweetId, apiKey, tweetArticle);
            const firstUserMessageIndex = qaHistoryForApiCall.findIndex(message => message.role === 'user');

            if (firstUserMessageIndex === -1) {
                throw new Error('Could not find the question message for this conversation.');
            }

            const firstUserMessage = qaHistoryForApiCall[firstUserMessageIndex];
            const firstQuestion = firstUserMessage.content.find(contentItem => contentItem.type === 'text')?.text || '';
            const combinedUserContent = [
                {
                    type: 'text',
                    text: `Tweet context:\n${tweetContextContent[0].text}\n\nQuestion:\n${firstQuestion}`
                },
                ...tweetContextContent.slice(1),
                ...firstUserMessage.content.filter(contentItem => contentItem.type !== 'text')
            ];
            const combinedHistory = qaHistoryForApiCall.map((message, index) =>
                index === firstUserMessageIndex
                    ? { ...message, content: combinedUserContent }
                    : message
            );

            qaHistoryForApiCall = [systemMessage, ...combinedHistory];
        } catch (error) {
            console.error(`[FollowUp] Failed to initialize conversation for ${tweetId}:`, error);
            const errorMessage = `Error starting conversation: ${error.message}`;
            indicatorInstance.updateConversationHistoryEntry(questionTextForLogging, errorMessage);
            showStatus(errorMessage, 'error');
            indicatorInstance.finalizeFollowUpInteraction();
            return;
        }
    }

    qaHistoryForApiCall = mergeConsecutiveUserMessages(qaHistoryForApiCall);

    const messagesForApi = await encodeMessageImagesAsDataUrls(qaHistoryForApiCall);

    const request = {
        model: selectedModel,
        messages: messagesForApi,
        temperature: modelTemperature,
        top_p: modelTopP,
        max_tokens: maxTokens,
        stream: useStreaming
    };
    const reasoningEffort = browserGet('reasoningEffort', 'none');
    if (reasoningEffort !== 'none') {
        request.reasoning = { effort: reasoningEffort };
    }
    if(browserGet('enableWebSearch',false)){
        request.tools = [{type: "openrouter:web_search"}];
    }
    console.log(`followup request: ${JSON.stringify(request)}`);

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

                            indicatorInstance.renderStreamingAnswer(aggregatedContent, aggregatedReasoning);
                        },

                        (result) => {
                            finalAnswerContent = result.content || aggregatedContent;
                            const finalReasoning = result.reasoning || aggregatedReasoning;
                            const parsedAnswer = parseTweetFilterResponse(finalAnswerContent);

                            if (!isCompleteConversationResponse(parsedAnswer)) {
                                reject(new Error('The model returned an invalid conversation JSON response.'));
                                return;
                            }

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

                            currentCache.lastAnswer = parsedAnswer.response || finalAnswerContent;
                            currentCache.questions = parsedAnswer.questions;
                            currentCache.timestamp = Date.now();
                            tweetCache.set(tweetId, currentCache);

                            resolve();
                        },

                        (error) => {
                            console.error("[FollowUp Stream Error]", error);
                            const errorMessage = `Error generating answer: ${error.message}`;

                            indicatorInstance.updateConversationHistoryEntry(questionTextForLogging, errorMessage);
                            indicatorInstance.setFollowUpQuestions(tweetCache.get(tweetId)?.questions || []);
                            indicatorInstance.refreshTooltipUI();

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
                const parsedAnswer = parseTweetFilterResponse(finalAnswerContent);
                if (!isCompleteConversationResponse(parsedAnswer)) {
                    throw new Error('The model returned an invalid conversation JSON response.');
                }
                const assistantMessage = { role: "assistant", content: [{ type: "text", text: finalAnswerContent }] };
                finalQaHistory.push(assistantMessage);

                indicatorInstance.updateAfterFollowUp({
                    assistantResponseContent: finalAnswerContent,
                    updatedQaHistory: finalQaHistory
                });

                const currentCache = tweetCache.get(tweetId) || {};
                currentCache.qaConversationHistory = finalQaHistory;
                currentCache.lastAnswer = parsedAnswer.response || finalAnswerContent;
                currentCache.questions = parsedAnswer.questions;
                currentCache.timestamp = Date.now();
                tweetCache.set(tweetId, currentCache);
            }
        } catch (error) {
            console.error(`[FollowUp] Error answering question for ${tweetId}:`, error);
            const errorMessage = `Error answering question: ${error.message}`;
            indicatorInstance.updateConversationHistoryEntry(questionTextForLogging, errorMessage);
            indicatorInstance.setFollowUpQuestions(tweetCache.get(tweetId)?.questions || []);
            indicatorInstance.refreshTooltipUI();

            const currentCache = tweetCache.get(tweetId) || {};
            currentCache.lastAnswer = errorMessage;
            currentCache.timestamp = Date.now();
            tweetCache.set(tweetId, currentCache);

        }
    } finally {

        if (indicatorInstance && typeof indicatorInstance.finalizeFollowUpInteraction === 'function') {
            indicatorInstance.finalizeFollowUpInteraction();
        }
    }
}

