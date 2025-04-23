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
 * Rates a tweet using the OpenRouter API with automatic retry functionality.
 * 
 * @param {string} tweetText - The text content of the tweet
 * @param {string} tweetId - The unique tweet ID
 * @param {string} apiKey - The API key for authentication
 * @param {string[]} mediaUrls - Array of media URLs associated with the tweet
 * @param {number} [maxRetries=3] - Maximum number of retry attempts
 * @param {Element} [tweetArticle=null] - Optional: The tweet article DOM element (for streaming updates)
 * @returns {Promise<{score: number, content: string, error: boolean, cached?: boolean, data?: any}>} The rating result
 */
async function rateTweetWithOpenRouter(tweetText, tweetId, apiKey, mediaUrls, maxRetries = 3, tweetArticle = null, authorHandle="") {
    if (window.adAuthorCache.has(authorHandle)) {
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
    const currentInstructions = window.instructionsManager.getCurrentInstructions();
    
    // Create the request body
    const request = {
        model: window.selectedModel,
        messages: [{
            role: "system",
            content: [{
                type: "text",
                text: `
                ${window.SYSTEM_PROMPT}`
            },]
        },
        {
            role: "user",
            content: [{
                type: "text",
                text:
                    `provide your reasoning, and a rating according to the the following instructions for the tweet with tweet ID ${tweetId}.
        ${currentInstructions}
                _______BEGIN TWEET_______
                ${tweetText}
                _______END TWEET_______
                Make sure your response ends with SCORE_0, SCORE_1, SCORE_2, SCORE_3, SCORE_4, SCORE_5, SCORE_6, SCORE_7, SCORE_8, SCORE_9, or SCORE_10.`
            }]
        }]
    };
    
    if (window.selectedModel.includes('gemini')) {
        request.config = {
            safetySettings: safetySettings,
        };
    }

    // Add image URLs if present and supported
    if (mediaUrls?.length > 0 && window.modelSupportsImages(window.selectedModel)) {
        for (const url of mediaUrls) {
            request.messages[1].content.push({
                type: "image_url",
                image_url: { url }
            });
        }
    }
    // Add model parameters
    request.temperature = window.modelTemperature;
    request.top_p = window.modelTopP;
    request.max_tokens = window.maxTokens;

    // Add provider settings only if a specific sort is selected
    if (window.providerSort) {
        request.provider = {
            sort: window.providerSort,
            allow_fallbacks: true
        };
    }
    // Check if streaming is enabled
    const useStreaming = await window.browserGet('enableStreaming', false);
    
    // Store the streaming entry in cache
    window.tweetCache.set(tweetId, {
        streaming: true,
        timestamp: Date.now()
    });
    
    // Implement retry logic
    let attempt = 0;
    while (attempt < maxRetries) {
        attempt++;

        // Rate limiting
        const now = Date.now();
        const timeElapsed = now - window.lastAPICallTime;
        if (timeElapsed < window.API_CALL_DELAY_MS) {
            await new Promise(resolve => setTimeout(resolve, window.API_CALL_DELAY_MS - timeElapsed));
        }
        window.lastAPICallTime = now;

        // Update status
        window.pendingRequests++;
        window.showStatus(`Rating tweet... (${window.pendingRequests} pending)`);
        
        try {
            let result;
            
            // Call appropriate rating function based on streaming setting
            if (useStreaming) {
                result = await rateTweetStreaming(request, apiKey, tweetId, tweetText, tweetArticle);
            } else {
                result = await rateTweet(request, apiKey);
            }
            
            window.pendingRequests--;
            window.showStatus(`Rating tweet... (${window.pendingRequests} pending)`);
            
            // Parse the result for score
            if (!result.error && result.content) {
                const scoreMatch = result.content.match(/SCORE_(\d+)/);
                
                if (scoreMatch) {
                    const score = parseInt(scoreMatch[1], 10);
                    
                    // Store the rating in cache
                    window.tweetCache.set(tweetId, {
                        score: score,
                        description: result.content,
                        tweetContent: tweetText,
                        streaming: false
                    });
                    
                    return {
                        score,
                        content: result.content,
                        reasoning: result.reasoning,
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
            window.pendingRequests--;
            window.showStatus(`Rating tweet... (${window.pendingRequests} pending)`);
            console.error(`API error during attempt ${attempt}:`, error);
            
            if (attempt < maxRetries) {
                const backoffDelay = Math.pow(attempt, 2) * 1000;
                await new Promise(resolve => setTimeout(resolve, backoffDelay));
            }
        }
    }
    
    // If we get here, all retries failed
    return {
        score: 5,
        content: "Failed to get valid rating after multiple attempts",
        reasoning: "",
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
    const request={
        model: window.selectedModel,
        messages: [{
            role: "system",
            content: [{
                type: "text",
                text: `
                Please come up with a 5-word summary of the following instructions:
                ${instructions}
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
    let key = await window.browserGet('openrouter-api-key');
    const result = await window.getCompletion(request,key);
    
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
    const existingScore = window.tweetCache.get(tweetId)?.score;

    const result = await window.getCompletion(request, apiKey);
    
    if (!result.error && result.data?.choices?.[0]?.message) {
        const content = result.data.choices[0].message.content || "";
        const reasoning = result.data.choices[0].message.reasoning || "";
        
        // Store the rating in cache
        const scoreMatch = content.match(/SCORE_(\d+)/);
        window.tweetCache.set(tweetId, {
            score: existingScore || (scoreMatch ? parseInt(scoreMatch[1], 10) : null),
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
 * @returns {Promise<{content: string, error: boolean, data: any}>} The rating result
 */
async function rateTweetStreaming(request, apiKey, tweetId, tweetText, tweetArticle) {
    // Check if there's already an active streaming request for this tweet
    if (window.activeStreamingRequests && window.activeStreamingRequests[tweetId]) {
        console.log(`Aborting existing streaming request for tweet ${tweetId}`);
        window.activeStreamingRequests[tweetId].abort();
        delete window.activeStreamingRequests[tweetId];
    }

    // Store initial streaming entry only if not already cached with a score
    const existingCache = window.tweetCache.get(tweetId);
    if (!existingCache || existingCache.score === undefined || existingCache.score === null) {
        window.tweetCache.set(tweetId, {
            streaming: true,
            timestamp: Date.now(),
            tweetContent: tweetText,
            description: "",
            reasoning: "",
            score: null
        });
    }

    return new Promise((resolve, reject) => {
        // Get or create the indicator instance *once*
        // Use the passed-in tweetArticle
        const indicatorInstance = window.ScoreIndicatorRegistry.get(tweetId, tweetArticle);
        if (!indicatorInstance) {
             console.error(`[API Stream] Could not get/create ScoreIndicator for ${tweetId}. Aborting stream setup.`);
             // Update cache to reflect error/non-streaming state
             if (window.tweetCache.has(tweetId)) {
                 window.tweetCache.get(tweetId).streaming = false;
                 window.tweetCache.get(tweetId).error = "Indicator initialization failed";
             }
             return reject(new Error(`ScoreIndicator instance could not be initialized for tweet ${tweetId}`));
        }

        let aggregatedContent = existingCache?.description || "";
        let aggregatedReasoning = existingCache?.reasoning || ""; // Track reasoning traces
        let finalData = null;
        let finalScore = existingCache?.score || null;
        
        window.getCompletionStreaming(
            request,
            apiKey,
            // onChunk callback - update the ScoreIndicator instance
            (chunkData) => {
                aggregatedContent = chunkData.content || aggregatedContent;
                aggregatedReasoning = chunkData.reasoning || aggregatedReasoning;
                
                // Look for a score in the accumulated content so far
                const scoreMatch = aggregatedContent.match(/SCORE_(\d+)/g); // Use global flag to get all matches
                // Use the *last* score found in the stream
                if (scoreMatch) {
                    finalScore = parseInt(scoreMatch[scoreMatch.length - 1].match(/SCORE_(\d+)/)[1], 10);
                }
                
                // Update the instance
                 indicatorInstance.update({
                    status: 'streaming',
                    score: finalScore,
                    description: aggregatedContent || "Rating in progress...",
                    reasoning: aggregatedReasoning
                });
                
                // Update cache with partial data during streaming
                if (window.tweetCache.has(tweetId)) {
                    const entry = window.tweetCache.get(tweetId);
                    entry.description = aggregatedContent;
                    entry.reasoning = aggregatedReasoning;
                    entry.score = finalScore;
                    entry.streaming = true; // Still streaming
                }
            },
            // onComplete callback - finalize the rating
            (finalResult) => {
                aggregatedContent = finalResult.content || aggregatedContent;
                aggregatedReasoning = finalResult.reasoning || aggregatedReasoning;
                finalData = finalResult.data;
                
                // Final check for score
                const scoreMatch = aggregatedContent.match(/SCORE_(\d+)/g);
                if (scoreMatch) {
                    finalScore = parseInt(scoreMatch[scoreMatch.length - 1].match(/SCORE_(\d+)/)[1], 10);
                }

                let finalStatus = 'rated';
                // If no score was found anywhere, mark as error
                if (finalScore === null || finalScore === undefined) {
                    console.warn(`[API Stream] No score found in final content for tweet ${tweetId}. Content: ${aggregatedContent.substring(0, 100)}...`);
                    finalStatus = 'error';
                    finalScore = 5; // Assign default error score
                    aggregatedContent += "\n[No score detected - Error]";
                }

                // Update cache with final result (non-streaming)
                window.tweetCache.set(tweetId, {
                    tweetContent: tweetText,
                    score: finalScore,
                    description: aggregatedContent,
                    reasoning: aggregatedReasoning,
                    streaming: false,
                    timestamp: Date.now(),
                    error: finalStatus === 'error' ? "No score detected" : undefined
                });
                
                // Finalize UI update via instance
                indicatorInstance.update({
                    status: finalStatus,
                    score: finalScore,
                    description: aggregatedContent,
                    reasoning: aggregatedReasoning
                });
                
                if (tweetArticle) {
                    window.filterSingleTweet(tweetArticle);
                }

                resolve({
                    score: finalScore,
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
                    reasoning: ''
                });

                // Update cache to reflect error
                if (window.tweetCache.has(tweetId)) {
                     const entry = window.tweetCache.get(tweetId);
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

// Export all functions
// // export {
//     safetySettings,
//     rateTweetWithOpenRouter,
//     getCustomInstructionsDescription,
//     rateTweet,
//     rateTweetStreaming
// };

// Attach functions to window object
window.rateTweetWithOpenRouter = rateTweetWithOpenRouter;
window.getCustomInstructionsDescription = getCustomInstructionsDescription;
window.rateTweet = rateTweet;
window.rateTweetStreaming = rateTweetStreaming;

