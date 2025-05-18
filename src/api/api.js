// src/api.js
//import { getCompletion, getCompletionStreaming, fetchAvailableModels, getImageDescription } from './api_requests.js';


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

    // Ensure all markers are present and in the correct order
    if (q1Start !== -1 && q2Start > q1Start && q3Start > q2Start) {
        // Extract Q1: text between Q_1. and Q_2.
        const q1Text = content.substring(q1Start + q1Marker.length, q2Start).trim();
        questions.push(q1Text);

        // Extract Q2: text between Q_2. and Q_3.
        const q2Text = content.substring(q2Start + q2Marker.length, q3Start).trim();
        questions.push(q2Text);

        // Extract Q3: text after Q_3. until the end of the content
        // (Or potentially until the next major marker if the prompt changes later)
        let q3Text = content.substring(q3Start + q3Marker.length).trim();
        // Remove any trailing markers from Q3 if necessary
        const endMarker = "</FOLLOW_UP_QUESTIONS>";
        if (q3Text.endsWith(endMarker)) {
            q3Text = q3Text.substring(0, q3Text.length - endMarker.length).trim();
        }
        questions.push(q3Text);

        // Basic validation: Ensure questions are not empty
        if (questions.every(q => q.length > 0)) {
            return questions;
        }
    }

    // If markers aren't found or questions are empty, return empty array
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
        // Cannot proceed without an indicator instance to store qaConversationHistory
        return {
            score: 5, // Default error score
            content: "Failed to initialize UI components for rating.",
            reasoning: "",
            questions: [],
            lastAnswer: "",
            error: true,
            cached: false,
            data: null,
            qaConversationHistory: [] // Empty history
        };
    }

    if (adAuthorCache.has(authorHandle)) {
        // ... existing ad author handling ...
        indicatorInstance.updateInitialReviewAndBuildHistory({
            fullContext: tweetText, // or a specific ad message
            mediaUrls: [],
            apiResponseContent: "<ANALYSIS>This tweet is from an ad author.</ANALYSIS><SCORE>SCORE_0</SCORE><FOLLOW_UP_QUESTIONS>Q_1. N/A\\nQ_2. N/A\\nQ_3. N/A</FOLLOW_UP_QUESTIONS>",
            reviewSystemPrompt: REVIEW_SYSTEM_PROMPT, // Globally available from config.js
            followUpSystemPrompt: FOLLOW_UP_SYSTEM_PROMPT // Globally available from config.js
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
                content: [{ type: "text", text: REVIEW_SYSTEM_PROMPT}]
            },
            {
                role: "user",
                content: [
                    { 
                        type: "text", 
                        text: `<TARGET_TWEET_ID>[${tweetId}]</TARGET_TWEET_ID>

<USER_INSTRUCTIONS>[${currentInstructions}]</USER_INSTRUCTIONS>

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
    
   /* // Simplified user message text, relying on system prompt for full format instruction
    requestBody.messages[1].content[0].text = `<TARGET_TWEET_ID>[${tweetId}]</TARGET_TWEET_ID>

<USER_INSTRUCTIONS>[${currentInstructions}]</USER_INSTRUCTIONS>

<TWEET>[${tweetText}]</TWEET>`;
*/
    if (selectedModel.includes('gemini')) {
        requestBody.config = { safetySettings: safetySettings };
    }
    if (mediaUrls?.length > 0 && modelSupportsImages(selectedModel)) {
        mediaUrls.forEach(url => {
            requestBody.messages[1].content.push({
                type: "image_url",
                image_url: { "url": url }
            });
        });
    }
    if (providerSort) {
        requestBody.provider = { sort: providerSort, allow_fallbacks: true };
    }

    const useStreaming = browserGet('enableStreaming', false);
    // Initial cache entry for streaming - qaConversationHistory will be added later
    tweetCache.set(tweetId, {
        streaming: true,
        timestamp: Date.now(),
        tweetContent: tweetText, // Store original tweet text for context
        mediaUrls: mediaUrls     // Store original media URLs
    });

    let attempt = 0;
    while (attempt < maxRetries) {
        attempt++;

        // Rate limiting
        const now = Date.now();
        const timeElapsed = now - lastAPICallTime;
        if (timeElapsed < API_CALL_DELAY_MS) {
            await new Promise(resolve => setTimeout(resolve, Math.max(0, API_CALL_DELAY_MS - timeElapsed)));
        }
        lastAPICallTime = now;

        // Update status
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
                    fullContext: tweetText, // The full text of the tweet that was rated
                    mediaUrls: mediaUrls,   // The media URLs associated with that tweet
                    apiResponseContent: result.content,
                    reviewSystemPrompt: REVIEW_SYSTEM_PROMPT,
                    followUpSystemPrompt: FOLLOW_UP_SYSTEM_PROMPT
                });

                const finalScore = indicatorInstance.score;
                const finalQuestions = indicatorInstance.questions;
                const finalDescription = indicatorInstance.description; // Analysis part
                const finalQaHistory = indicatorInstance.qaConversationHistory;

                tweetCache.set(tweetId, {
                    score: finalScore,
                    description: finalDescription, // Analysis
                    reasoning: result.reasoning || "", // If rateTweet/Streaming provide it separately
                    questions: finalQuestions,
                    lastAnswer: "",
                    tweetContent: tweetText, 
                    mediaUrls: mediaUrls,
                    streaming: false,
                    timestamp: Date.now(),
                    metadata: result.data?.id ? { generationId: result.data.id } : null,
                    qaConversationHistory: finalQaHistory // Store the history
                });
                   
                return {
                    score: finalScore,
                    content: result.content, // Keep raw content for direct use if needed
                    reasoning: result.reasoning || "",
                    questions: finalQuestions,
                    error: false,
                    cached: false,
                    data: result.data,
                    qaConversationHistory: finalQaHistory
                };
            }
            // Retry logic if result was error or no content
            if (attempt < maxRetries && (result.error || !result.content)) {
                const backoffDelay = Math.pow(attempt, 2) * 1000;
                await new Promise(resolve => setTimeout(resolve, backoffDelay));
            } else if (result.error || !result.content) {
                 // Last attempt failed or no content
                throw new Error(result.content || "Failed to get valid rating content after multiple attempts");
            }

        } catch (error) {
            cleanupRequest();
            console.error(`API error during attempt ${attempt}:`, error);
            if (attempt < maxRetries) {
                const backoffDelay = Math.pow(attempt, 2) * 1000;
                await new Promise(resolve => setTimeout(resolve, backoffDelay));
            } else {
                // All retries failed, update indicator and cache with error state
                const errorContent = `Failed to get valid rating after multiple attempts: ${error.message}`;
                indicatorInstance.updateInitialReviewAndBuildHistory({
                    fullContext: tweetText,
                    mediaUrls: mediaUrls,
                    apiResponseContent: `<ANALYSIS>${errorContent}</ANALYSIS><SCORE>SCORE_5</SCORE><FOLLOW_UP_QUESTIONS>Q_1. N/A\\nQ_2. N/A\\nQ_3. N/A</FOLLOW_UP_QUESTIONS>`,
                    reviewSystemPrompt: REVIEW_SYSTEM_PROMPT,
                    followUpSystemPrompt: FOLLOW_UP_SYSTEM_PROMPT
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
    
    // Fallback if loop finishes unexpectedly (should be caught by error handling within loop)
    cleanupRequest(); 
    const fallbackError = "Unexpected failure in rating process.";
    indicatorInstance.updateInitialReviewAndBuildHistory({
        fullContext: tweetText,
        mediaUrls: mediaUrls,
        apiResponseContent: `<ANALYSIS>${fallbackError}</ANALYSIS><SCORE>SCORE_5</SCORE><FOLLOW_UP_QUESTIONS>Q_1. N/A\\nQ_2. N/A\\nQ_3. N/A</FOLLOW_UP_QUESTIONS>`,
        reviewSystemPrompt: REVIEW_SYSTEM_PROMPT,
        followUpSystemPrompt: FOLLOW_UP_SYSTEM_PROMPT
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
 * Summarizes the custom instructions for the user
 * 
 * @param {Object} request - The formatted request body
 * @param {string} apiKey - API key for authentication
 * @returns {Promise<{content: string, reasoning: string, error: boolean, data: any}>} The rating result
 */
async function getCustomInstructionsDescription(instructions) {
    const INSTRUCTION_SUMMARY_MODEL = "google/gemini-2.5-flash-preview";
    const request={
        model: INSTRUCTION_SUMMARY_MODEL,
        messages: [{
            role: "system",
            content: [{
                type: "text",
                text: `
                Please come up with a 5-word summary of the following instructions.
                `
            }]
        },
    {
        role: "user",
        content: [{
            type: "text",
            text: `Please come up with a 5-word summary of the following instructions:
            ${instructions}
            `
        }]
    }]
}
    let key = browserGet('openrouter-api-key');
    const result = await getCompletion(request,key);
    
    if (!result.error && result.data?.choices?.[0]?.message) {
        const content = result.data.choices[0].message.content || "";
        
        
        return {
            content,
            error: false,
        };
    }

    return {
        error: true,
        content: result.error || "Unknown error"
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
        
        // Store the rating in cache
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
    // Check if there's already an active streaming request for this tweet
    if (window.activeStreamingRequests && window.activeStreamingRequests[tweetId]) {
        console.log(`Aborting existing streaming request for tweet ${tweetId}`);
        window.activeStreamingRequests[tweetId].abort();
        delete window.activeStreamingRequests[tweetId];
    }
    // Store initial streaming entry only if not already cached with a score
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
        // Get or create the indicator instance *once*
        // Use the passed-in tweetArticle
        const indicatorInstance = ScoreIndicatorRegistry.get(tweetId, tweetArticle);
        if (!indicatorInstance) {
             console.error(`[API Stream] Could not get/create ScoreIndicator for ${tweetId}. Aborting stream setup.`);
             // Update cache to reflect error/non-streaming state
             if (tweetCache.has(tweetId)) {
                 tweetCache.get(tweetId).streaming = false;
                 tweetCache.get(tweetId).error = "Indicator initialization failed";
             }
             return reject(new Error(`ScoreIndicator instance could not be initialized for tweet ${tweetId}`));
        }

        let aggregatedContent = existingCache?.description || "";
        let aggregatedReasoning = existingCache?.reasoning || "";
        let aggregatedQuestions = existingCache?.questions || [];
        let finalData = null;
        let score = existingCache?.score || null;
        
        getCompletionStreaming(
            request,
            apiKey,
            // onChunk callback - update the ScoreIndicator instance
            (chunkData) => {
                aggregatedContent = chunkData.content || aggregatedContent;
                aggregatedReasoning = chunkData.reasoning || aggregatedReasoning;
                
                // Look for a score in the accumulated content so far
                const scoreMatches = aggregatedContent.match(/SCORE_(\d+)/g); // Use global flag to get all matches
                // Always use the last score found in the stream
                if (scoreMatches && scoreMatches.length > 0) {
                    const lastScore = scoreMatches[scoreMatches.length - 1];
                    score = parseInt(lastScore.match(/SCORE_(\d+)/)[1], 10);
                }
                
                // Update the instance
                 indicatorInstance.update({
                    status: 'streaming',
                    score: score,
                    description: aggregatedContent || "Rating in progress...",
                    reasoning: aggregatedReasoning,
                    questions: [],
                    lastAnswer: ""
                });
                
                // Update cache with partial data during streaming
                if (tweetCache.has(tweetId)) {
                    const entry = tweetCache.get(tweetId);
                    entry.description = aggregatedContent;
                    entry.reasoning = aggregatedReasoning;
                    entry.score = score;
                    entry.streaming = true; // Still streaming
                }
            },
            // onComplete callback - finalize the rating
            (finalResult) => {
                console.log(finalResult);
                aggregatedContent = finalResult.content || aggregatedContent;
                aggregatedReasoning = finalResult.reasoning || aggregatedReasoning;
                finalData = finalResult.data;
                // console.log("Final stream data:", finalData);

                // Final check for score
                const scoreMatches = aggregatedContent.match(/SCORE_(\d+)/g);
                if (scoreMatches && scoreMatches.length > 0) {
                    const lastScore = scoreMatches[scoreMatches.length - 1];
                    score = parseInt(lastScore.match(/SCORE_(\d+)/)[1], 10);
                }

                let finalStatus = 'rated';
                // If no score was found anywhere, mark as error
                if (score === null || score === undefined) {
                    console.warn(`[API Stream] No score found in final content for tweet ${tweetId}. Content: ${aggregatedContent.substring(0, 100)}...`);
                    finalStatus = 'error';
                    score = 5; // Assign default error score
                    aggregatedContent += "\n[No score detected - Error]";
                }

                // Store final result in cache (non-streaming)
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

                // Finalize UI update via instance
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

                // --- Fetch Generation Metadata (New) ---
                const generationId = finalData?.id;
                if (generationId && apiKey) {
                    fetchAndStoreGenerationMetadata(tweetId, generationId, apiKey, indicatorInstance);
                }
                // --- End Fetch Generation Metadata ---

                resolve({
                    score: score,
                    content: aggregatedContent,
                    reasoning: aggregatedReasoning,
                    error: finalStatus === 'error',
                    cached: false,
                    data: finalData
                });
            },
            // onError callback
            (errorData) => {
                 console.error(`[API Stream Error] Tweet ${tweetId}: ${errorData.message}`);
                // Update UI via instance to show error
                indicatorInstance.update({
                    status: 'error',
                    score: 5,
                    description: `Stream Error: ${errorData.message}`,
                    reasoning: '',
                    questions: [],
                    lastAnswer: ''
                });

                // Update cache to reflect error
                if (tweetCache.has(tweetId)) {
                     const entry = tweetCache.get(tweetId);
                     entry.streaming = false;
                     entry.error = errorData.message;
                     entry.score = 5; // Store default error score in cache too
                     entry.description = `Stream Error: ${errorData.message}`; // Store error message
                }
                

                reject(new Error(errorData.message)); // Reject the promise
            },
            30000,
            tweetId  // Pass the tweet ID to associate with this request
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
        // console.log(`[Metadata Fetch ${tweetId}] Attempt ${attempt + 1} for generation ${generationId} after ${delay}ms`);
        const metadataResult = await getGenerationMetadata(generationId, apiKey);

        if (!metadataResult.error && metadataResult.data?.data) {
            const meta = metadataResult.data.data;
            // console.log(`[Metadata Fetch ${tweetId}] Success for generation ${generationId}`, meta);

            const extractedMetadata = {
                model: meta.model || 'N/A',
                promptTokens: meta.tokens_prompt || 0,
                completionTokens: meta.tokens_completion || 0, // Use this for total completion output
                reasoningTokens: meta.native_tokens_reasoning || 0, // Specific reasoning tokens if available
                latency: meta.latency !== undefined ? (meta.latency / 1000).toFixed(2) + 's' : 'N/A', // Convert ms to s
                mediaInputs: meta.num_media_prompt || 0,
                price: meta.total_cost !== undefined ? `$${meta.total_cost.toFixed(6)}` : 'N/A', // Add total cost
                providerName: meta.provider_name || 'N/A' // Add provider_name
            };

            // Update the cache
            const currentCache = tweetCache.get(tweetId);
            if (currentCache) {
                currentCache.metadata = extractedMetadata;
                tweetCache.set(tweetId, currentCache); // Save updated cache entry

                // Update the ScoreIndicator instance
                indicatorInstance.update({ metadata: extractedMetadata });
                console.log(`[Metadata Fetch ${tweetId}] Stored metadata and updated UI for generation ${generationId}`);
            } else {
                console.warn(`[Metadata Fetch ${tweetId}] Cache entry disappeared before metadata could be stored for generation ${generationId}.`);
            }
            return; // Success, stop retrying
        } else if (metadataResult.status === 404) {
            // console.log(`[Metadata Fetch ${tweetId}] Generation ${generationId} not found yet (404), retrying...`);
            fetchAndStoreGenerationMetadata(tweetId, generationId, apiKey, indicatorInstance, attempt + 1, delays);
        } else {
            console.warn(`[Metadata Fetch ${tweetId}] Error fetching metadata (Attempt ${attempt + 1}) for ${generationId}: ${metadataResult.message}`);
            fetchAndStoreGenerationMetadata(tweetId, generationId, apiKey, indicatorInstance, attempt + 1, delays); // Retry on other errors too
        }
    } catch (error) {
        console.error(`[Metadata Fetch ${tweetId}] Unexpected error during fetch (Attempt ${attempt + 1}) for ${generationId}:`, error);
        // Still retry on unexpected errors
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

    // Prepare messages for the API call: template the last user message in the history
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
        return msg; // Return other messages (system prompts, previous assistant messages, previous user messages) as is
    });
    
    const effectiveModel = browserGet('enableWebSearch', false) ? `${selectedModel}:online` : selectedModel;

    const request = {
        model: effectiveModel,
        messages: messagesForApi, // Use the history with the last user message templated
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

    // UI update for "Thinking..." is handled by ScoreIndicator's _handleFollowUpQuestionClick

    try { // Outer try for the finally block
        try { // Inner try for existing error handling
            let finalAnswerContent = "*Processing...*"; // This is the raw AI response string
            let finalQaHistory = [...qaHistoryForApiCall]; // Start with a copy

            if (useStreaming) {
                await new Promise((resolve, reject) => {
                    let aggregatedContent = "";
                    // Reasoning is part of the assistant's message in qaHistory, not a separate stream here.
                    // We will parse it after the full message is received.

                    getCompletionStreaming(
                        request, apiKey,
                        // onChunk
                        (chunkData) => {
                            aggregatedContent = chunkData.content || aggregatedContent;
                            // Render streaming answer directly to UI.
                            // The reasoning part of the UI will be updated once the full message is available.
                            indicatorInstance._renderStreamingAnswer(aggregatedContent, "");
                        },
                        // onComplete
                        (result) => {
                            finalAnswerContent = result.content || aggregatedContent;
                            const assistantMessage = { role: "assistant", content: [{ type: "text", text: finalAnswerContent }] };
                            finalQaHistory.push(assistantMessage);

                            indicatorInstance.updateAfterFollowUp({
                                assistantResponseContent: finalAnswerContent,
                                updatedQaHistory: finalQaHistory
                            });
                            
                            // Update cache with the new full QA history
                            const currentCache = tweetCache.get(tweetId) || {};
                            currentCache.qaConversationHistory = finalQaHistory;
                            // also update questions and lastAnswer for compatibility if needed, though qaHistory is prime
                            const parsedAnswer = finalAnswerContent.match(/<ANSWER>([\s\S]*?)<\/ANSWER>/);
                            currentCache.lastAnswer = parsedAnswer ? parsedAnswer[1].trim() : finalAnswerContent;
                            currentCache.questions = extractFollowUpQuestions(finalAnswerContent);
                            currentCache.timestamp = Date.now();
                            tweetCache.set(tweetId, currentCache);

                            resolve();
                        },
                        // onError
                        (error) => {
                            console.error("[FollowUp Stream Error]", error);
                            const errorMessage = `Error generating answer: ${error.message}`;
                            // Update ScoreIndicator's UI part of conversationHistory
                            indicatorInstance._updateConversationHistory(questionTextForLogging, errorMessage); 
                            indicatorInstance.questions = tweetCache.get(tweetId)?.questions || []; // Restore old questions
                            indicatorInstance._updateTooltipUI(); // Refresh

                            // Update cache with error state for this turn if needed, though qaHistory won't have AI response
                            const currentCache = tweetCache.get(tweetId) || {};
                            currentCache.lastAnswer = errorMessage; // Store error message
                            currentCache.timestamp = Date.now();
                            tweetCache.set(tweetId, currentCache);

                            reject(new Error(error.message));
                        },
                        60000,
                        `followup-${tweetId}`
                    );
                });
            } else { // Non-streaming follow-up
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

                // Update cache
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
            indicatorInstance._updateConversationHistory(questionTextForLogging, errorMessage); // Update UI history
            indicatorInstance.questions = tweetCache.get(tweetId)?.questions || []; // Restore old questions from cache
            indicatorInstance._updateTooltipUI(); // Refresh

            const currentCache = tweetCache.get(tweetId) || {};
            currentCache.lastAnswer = errorMessage; // Store error in cache
            currentCache.timestamp = Date.now();
            tweetCache.set(tweetId, currentCache);
            // No re-throw needed, as the finally block will handle cleanup.
        }
    } finally {
        // This block ensures that UI elements are re-enabled regardless of success or failure.
        if (indicatorInstance && typeof indicatorInstance._finalizeFollowUpInteraction === 'function') {
            indicatorInstance._finalizeFollowUpInteraction();
        }
    }
}

// Export all functions
// // export {
//     safetySettings,
//     rateTweetWithOpenRouter,
//     getCustomInstructionsDescription,
//     rateTweet,
//     rateTweetStreaming
// };



