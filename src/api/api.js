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
    // Add a cleanup function to ensure pendingRequests is always decremented
    const cleanupRequest = () => {
        pendingRequests = Math.max(0, pendingRequests - 1); // Ensure it never goes below 0
        showStatus(`Rating tweet... (${pendingRequests} pending)`);
    };

    if (adAuthorCache.has(authorHandle)) {
        return {
            score: 0,
            content: "This tweet is from an ad author.",
            reasoning: "",
            error: false,
            cached: false,
        };
    }
    console.log(`Given Tweet Text: 
        ${tweetText}
        And Media URLS:`);
    console.log(mediaUrls);
    
    // Get current instructions from the manager
    const currentInstructions = instructionsManager.getCurrentInstructions();
    
    // Create the request body
    const request = {
        model: selectedModel,
        messages: [{
            role: "system",
            content: [{
                type: "text",
                text: `
                ${SYSTEM_PROMPT}`
            },]
        },
        {
            role: "user",
            content: [{
                type: "text",
                text:
                    `<TARGET_TWEET_ID_TO_RATE> 
                    [${tweetId}].
                    </TARGET_TWEET_ID_TO_RATE>
                    <USER_INSTRUCTIONS:>
                    [${currentInstructions}]
                    </USER INSTURCTIONS>
                    <TWEET>
                
                [${tweetText}]
                </TWEET>
                <EXPECTED_RESPONSE_FORMAT>

<ANALYSIS>
(Your analysis of the tweet acco(Do not include (text enclosed in parenthesis) in your response. Parenthesisized text serves as guidelines. DO include everything else.)rding to the user defined instructions) 
</ANALYSIS>
<SCORE>
SCORE_X (where X is a number from 0 to 10 for example: SCORE_0, SCORE_1, SCORE_2, SCORE_3, etc)
</SCORE>
<FOLLOW_UP_QUESTIONS>
Q_1. (Question 1)
Q_2. (Question 2)
Q_3. (Question 3)
</FOLLOW_UP_QUESTIONS>
</EXPECTED_RESPONSE_FORMAT>
                `
            }]
        }]
    };
    
    if (selectedModel.includes('gemini')) {
        request.config = {
            safetySettings: safetySettings,
        };
    }

    // Add image URLs if present and supported
    if (mediaUrls?.length > 0 && modelSupportsImages(selectedModel)) {
        for (const url of mediaUrls) {
            request.messages[1].content.push({
                type: "image_url",
                image_url: { "url": url }
            });
        }
    }
    // Add model parameters
    request.temperature = modelTemperature;
    request.top_p = modelTopP;
    request.max_tokens = maxTokens;

    // Add provider settings only if a specific sort is selected
    if (providerSort) {
        request.provider = {
            sort: providerSort,
            allow_fallbacks: true
        };
    }
    // Check if streaming is enabled
    const useStreaming = browserGet('enableStreaming', false);
    
    // Store the streaming entry in cache
    tweetCache.set(tweetId, {
        streaming: true,
        timestamp: Date.now()
    });
    
    // Implement retry logic
    let attempt = 0;
    while (attempt < maxRetries) {
        attempt++;

        // Rate limiting
        const now = Date.now();
        const timeElapsed = now - lastAPICallTime;
        if (timeElapsed < API_CALL_DELAY_MS) {
            await new Promise(resolve => setTimeout(resolve, API_CALL_DELAY_MS - timeElapsed));
        }
        lastAPICallTime = now;

        // Update status
        pendingRequests++;
        showStatus(`Rating tweet... (${pendingRequests} pending)`);
        
        try {
            let result;
            
            // Call appropriate rating function based on streaming setting
            if (useStreaming) {
                result = await rateTweetStreaming(request, apiKey, tweetId, tweetText, tweetArticle);
            } else {
                result = await rateTweet(request, apiKey);
            }
            
            cleanupRequest(); // Use cleanup function instead of direct decrement
            
            // Parse the result for score
            if (!result.error && result.content) {
                const scoreMatches = result.content.match(/SCORE_(\d+)/g);
                
                if (scoreMatches && scoreMatches.length > 0) {
                    const lastScore = scoreMatches[scoreMatches.length - 1];
                    const score = parseInt(lastScore.match(/SCORE_(\d+)/)[1], 10);
                    
                    // Store the rating in cache
                    tweetCache.set(tweetId, {
                        score: score,
                        description: result.content,
                        reasoning: result.reasoning,
                        questions: extractFollowUpQuestions(result.content),
                        lastAnswer: "",
                        tweetContent: tweetText,
                        mediaUrls: mediaUrls,
                        streaming: false,
                        timestamp: Date.now(),
                        metadata: result.data?.id ? { generationId: result.data.id } : null
                    });
                    
                    return {
                        score,
                        content: result.content,
                        reasoning: result.reasoning,
                        questions: extractFollowUpQuestions(result.content),
                        lastAnswer: "",
                        error: false,
                        cached: false,
                        data: result.data
                    };
                }
            }
            // If we get here, we couldn't find a score in the response
            if (attempt < maxRetries) {
                const backoffDelay = Math.pow(attempt, 2) * 1000;
                await new Promise(resolve => setTimeout(resolve, backoffDelay));
            }
        } catch (error) {
            cleanupRequest(); // Use cleanup function instead of direct decrement
            console.error(`API error during attempt ${attempt}:`, error);
            
            if (attempt < maxRetries) {
                const backoffDelay = Math.pow(attempt, 2) * 1000;
                await new Promise(resolve => setTimeout(resolve, backoffDelay));
            }
        }
    }
    
    // If we get here, all retries failed
    cleanupRequest(); // Ensure we cleanup even if all retries fail
    return {
        score: 5,
        content: "Failed to get valid rating after multiple attempts",
        reasoning: "",
        questions: [],
        lastAnswer: "",
        error: true,
        data: null
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
                price: meta.total_cost !== undefined ? `$${meta.total_cost.toFixed(6)}` : 'N/A' // Add total cost
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
 * @param {string} questionText - The follow-up question being asked.
 * @param {string} apiKey - The OpenRouter API key.
 * @param {Element} [tweetArticle=null] - The DOM element for the tweet article.
 * @param {ScoreIndicator} indicatorInstance - The ScoreIndicator instance to update.
 * @param {string[]} [mediaUrls=[]] - Optional array of media URLs from the original tweet.
 * @returns {Promise<void>} Resolves when the answer is generated and UI updated.
 */
async function answerFollowUpQuestion(tweetId, questionText, apiKey, tweetArticle, indicatorInstance, mediaUrls = []) {
    console.log(`[FollowUp] Answering question for ${tweetId}: "${questionText}"`);
    const useStreaming = browserGet('enableStreaming', false);

    // 1. Get original context from cache
    const cachedData = tweetCache.get(tweetId);
    let originalContext = cachedData?.tweetContent || null;
    const originalScore = cachedData?.score; // Get score
    const originalDescription = cachedData?.description; // Get description

    // If context not in cache, try to re-scrape (less ideal)
    if (!originalContext && tweetArticle) {
        try {
            console.warn(`[FollowUp] Original context not in cache for ${tweetId}. Re-scraping.`);
            originalContext = await getFullContext(tweetArticle, tweetId, apiKey);
            // Update cache with the scraped context
            if (originalContext && cachedData) {
                cachedData.tweetContent = originalContext;
                tweetCache.set(tweetId, cachedData);
            } else if (originalContext && !cachedData) {
                tweetCache.set(tweetId, { 
                    tweetContent: originalContext, 
                    timestamp: Date.now()
                });
            }
        } catch (scrapeError) {
            console.error(`[FollowUp] Failed to re-scrape context for ${tweetId}:`, scrapeError);
            indicatorInstance.update({
                lastAnswer: `Error: Could not retrieve original tweet context to answer question.`
            });
            return;
        }
    }

    if (!originalContext) {
        indicatorInstance.update({
            lastAnswer: `Error: Original tweet context unavailable.`
        });
        return;
    }

    // Get conversation history from the DOM
    let conversationHistory = '';
    // Find the tooltip for this tweet
    const tooltip = document.querySelector(`.score-description[data-tweet-id="${tweetId}"]`);
    if (tooltip) {
        const historyContainer = tooltip.querySelector('.tooltip-conversation-history');
        if (historyContainer) {
            const turns = historyContainer.querySelectorAll('.conversation-turn');
            conversationHistory = Array.from(turns).map((turn, index) => {
                const question = turn.querySelector('.conversation-question')?.textContent?.replace('You:', '').trim() || '';
                const answer = turn.querySelector('.conversation-answer')?.textContent?.replace('AI:', '').trim() || '';
                return `Q${index + 1}: ${question}\nA${index + 1}: ${answer}`;
            }).join('\n\n');
        }
    }

    console.log("Found tooltip:", tooltip);
    console.log(conversationHistory);

    const followUpPrompt = `
You are TweetFilter AI. You are answering a follow-up question about a specific tweet.

Here is the original tweet context:
_______BEGIN TWEET CONTEXT_______
${originalContext}
_______END TWEET CONTEXT_______

${originalScore !== undefined && originalDescription ? `
Here is the original AI rating and description for the tweet:
SCORE: ${originalScore}
DESCRIPTION:
${originalDescription}
---------------------------------
` : ''}

${conversationHistory ? `CONVERSATION HISTORY:
${conversationHistory}
---------------------------------

` : ''}Current follow-up question: "${questionText}"

Please consider the ENTIRE conversation history above when formulating your response. Your answer should build upon and be consistent with previous answers, and acknowledge any relevant information that was discussed in earlier exchanges.
After answering, provide 3 new, relevant follow-up questions the user might have based on your answer or the ongoing conversation context.
Follow EXPECTED_RESPONSE_FORMAT exactly. Do not include literally (text enclosed in parenthesis), but use it as a format guideline. Include everything else literally. Do not deviate from the format.
[EXPECTED_RESPONSE_FORMAT]
(NO TEXT BEFORE THE ANSWER)
<ANSWER>
(Your answer here)
</ANSWER>
<FOLLOW_UP_QUESTIONS>
Q_1. (New Question 1 here)
Q_2. (New Question 2 here)
Q_3. (New Question 3 here)
</FOLLOW_UP_QUESTIONS>
(NO TEXT AFTER THE FOLLOW UP QUESTIONS)
[/EXPECTED_RESPONSE_FORMAT]
`;
    const request = {
        model: `${selectedModel}:online`, // Use the same model as the initial rating
        messages: [
            // No system prompt needed here as instructions are inline
            {
                role: "user",
                content: [{ type: "text", text: followUpPrompt }]
            }
        ],
        temperature: modelTemperature,
        top_p: modelTopP,
        max_tokens: maxTokens,
        stream: useStreaming // Set stream based on user setting
    };

    // Add image URLs if present and supported by the *selected rating model*
    if (mediaUrls?.length > 0 && modelSupportsImages(selectedModel)) {
        console.log(`[FollowUp] Adding ${mediaUrls.length} images to follow-up request for ${tweetId}`);
        for (const url of mediaUrls) {
            request.messages[0].content.push({
                type: "image_url",
                image_url: { "url": url }
            });
        }
    }

    if (selectedModel.includes('gemini')) {
        request.config = { safetySettings: safetySettings };
    }
    if (providerSort) {
        request.provider = { sort: providerSort, allow_fallbacks: true };
    }

    // 3. Update UI immediately to show "Thinking..."
    indicatorInstance.update({
        lastAnswer: `*Answering "${questionText}"...*`,
        questions: [] // Temporarily hide old questions
    });


    // 4. Make API call (Streaming or Non-Streaming)
    try {
        let finalAnswer = "*Processing...*";
        let finalQuestions = [];

        if (useStreaming) {
            await new Promise((resolve, reject) => {
                 let aggregatedContent = "";
                 let currentAnswer = "";
                 let currentQuestions = [];
                 let aggregatedReasoning = "";

                 getCompletionStreaming(
                     request, apiKey,
                     // onChunk
                     (chunkData) => {
                         aggregatedContent = chunkData.content || aggregatedContent;
                         aggregatedReasoning = chunkData.reasoning || aggregatedReasoning;
                         indicatorInstance._renderStreamingAnswer(aggregatedContent, aggregatedReasoning);
                     },
                     // onComplete
                     (result) => {
                         aggregatedContent = result.content || aggregatedContent;
                         const answerMatch = aggregatedContent.match(/<ANSWER>\s*([\s\S]*?)\s*(?:<\/ANSWER>|<FOLLOW UP QUESTIONS>|$)/);
                         finalAnswer = answerMatch ? answerMatch[1].trim() : "[No answer found in response]";
                         finalQuestions = extractFollowUpQuestions(aggregatedContent);

                         // Extract final reasoning (assuming it's complete in aggregatedReasoning)
                         const finalReasoning = aggregatedReasoning; // Or re-parse if needed

                         // Update cache
                         const currentCache = tweetCache.get(tweetId) || {};
                         currentCache.questions = finalQuestions;
                         currentCache.timestamp = Date.now();
                         tweetCache.set(tweetId, currentCache);

                         // Final UI update using the instance helper
                         indicatorInstance._updateConversationHistory(questionText, finalAnswer, finalReasoning);
                         indicatorInstance.questions = finalQuestions;
                         indicatorInstance._updateTooltipUI();
                         resolve();
                     },
                     // onError
                     (error) => {
                         console.error("[FollowUp Stream Error]", error);
                         finalAnswer = `Error generating answer: ${error.message}`;
                         indicatorInstance._updateConversationHistory(questionText, finalAnswer);
                         indicatorInstance.questions = [];
                         indicatorInstance._updateTooltipUI();
                         reject(new Error(error.message));
                     },
                     60000,
                     `followup-${tweetId}`
                 );
             });

        } else {
            // Non-streaming follow-up
            const result = await getCompletion(request, apiKey, 60000);
             if (result.error || !result.data?.choices?.[0]?.message?.content) {
                throw new Error(result.message || "Failed to get follow-up answer.");
            }
             const content = result.data.choices[0].message.content;
             const answerMatch = content.match(/<ANSWER>\s*([\s\S]*?)\s*(?:<\/ANSWER>|<FOLLOW UP QUESTIONS>|$)/);
             finalAnswer = answerMatch ? answerMatch[1].trim() : "[No answer found in response]";
             finalQuestions = extractFollowUpQuestions(content);

             // Update cache
             const currentCache = tweetCache.get(tweetId) || {};
             currentCache.lastAnswer = finalAnswer;
             currentCache.questions = finalQuestions;
             currentCache.timestamp = Date.now();
             tweetCache.set(tweetId, currentCache);

             // Final UI update using instance helper
             indicatorInstance._updateConversationHistory(questionText, finalAnswer);
             indicatorInstance.questions = finalQuestions;
             indicatorInstance._updateTooltipUI();
        }

    } catch (error) {
        console.error(`[FollowUp] Error answering question for ${tweetId}:`, error);
        const errorMessage = `Error answering question: ${error.message}`;
        indicatorInstance._updateConversationHistory(questionText, errorMessage);
        indicatorInstance.questions = cachedData?.questions || []
        indicatorInstance._updateTooltipUI();

        const currentCache = tweetCache.get(tweetId) || {};
        currentCache.lastAnswer = errorMessage;
        currentCache.timestamp = Date.now();
        tweetCache.set(tweetId, currentCache);
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



