//src/api.js
/**
 * Gets a completion from OpenRouter API
 * 
 * @param {CompletionRequest} request - The completion request
 * @param {string} apiKey - OpenRouter API key
 * @param {number} [timeout=30000] - Request timeout in milliseconds
 * @returns {Promise<CompletionResult>} The completion result
 */
async function getCompletion(request, apiKey, timeout = 30000) {
    return new Promise((resolve) => {
        GM_xmlhttpRequest({
            method: "POST",
            url: "https://openrouter.ai/api/v1/chat/completions",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
                "HTTP-Referer": "https://greasyfork.org/en/scripts/532459-tweetfilter-ai",
                "X-Title": "TweetFilter-AI"
            },
            data: JSON.stringify(request),
            timeout: timeout,
            onload: function (response) {
                if (response.status >= 200 && response.status < 300) {
                    try {
                        const data = JSON.parse(response.responseText);
                        if (data.content==="") {
                            resolve({
                                error: true,
                                message: `No content returned${data.choices[0].native_finish_reason=="SAFETY"?" (SAFETY FILTER)":""}`,
                                data: data
                            });
                        }
                        resolve({
                            error: false,
                            message: "Request successful",
                            data: data
                        });
                    } catch (error) {
                        resolve({
                            error: true,
                            message: `Failed to parse response: ${error.message}`,
                            data: null
                        });
                    }
                } else {
                    resolve({
                        error: true,
                        message: `Request failed with status ${response.status}: ${response.responseText}`,
                        data: null
                    });
                }
            },
            onerror: function (error) {
                resolve({
                    error: true,
                    message: `Request error: ${error.toString()}`,
                    data: null
                });
            },
            ontimeout: function () {
                resolve({
                    error: true,
                    message: `Request timed out after ${timeout}ms`,
                    data: null
                });
            }
        });
    });
}

/**
 * Gets a streaming completion from OpenRouter API
 * 
 * @param {CompletionRequest} request - The completion request
 * @param {string} apiKey - OpenRouter API key
 * @param {Function} onChunk - Callback for each chunk of streamed response
 * @param {Function} onComplete - Callback when streaming is complete
 * @param {Function} onError - Callback when an error occurs
 * @param {number} [timeout=30000] - Request timeout in milliseconds
 * @param {string} [tweetId=null] - Optional tweet ID to associate with this request
 * @returns {Object} The request object with an abort method
 */
function getCompletionStreaming(request, apiKey, onChunk, onComplete, onError, timeout = 90000, tweetId = null) {
    // Add stream parameter to request
    const streamingRequest = {
        ...request,
        stream: true
    };
    
    let fullResponse = "";
    let content = "";
    let reasoning = ""; // Add a variable to track reasoning content
    let responseObj = null;
    let streamComplete = false;
    
    const reqObj = GM_xmlhttpRequest({
        method: "POST",
        url: "https://openrouter.ai/api/v1/chat/completions",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
            "HTTP-Referer": "https://greasyfork.org/en/scripts/532459-tweetfilter-ai",
            "X-Title": "TweetFilter-AI"
        },
        data: JSON.stringify(streamingRequest),
        timeout: timeout,
        responseType: "stream",
        onloadstart: function(response) {
            // Get the ReadableStream from the response
            const reader = response.response.getReader();
            
            // Setup timeout to prevent hanging indefinitely
            
            const resetStreamTimeout = () => {
                if (streamTimeout) clearTimeout(streamTimeout);
                streamTimeout = setTimeout(() => {
                    console.log("Stream timed out after inactivity");
                    if (!streamComplete) {
                        streamComplete = true;
                        // Call onComplete with whatever we have so far
                        onComplete({
                            content: content,
                            reasoning: reasoning, // Include reasoning in onComplete
                            fullResponse: fullResponse,
                            data: responseObj,
                            timedOut: true
                        });
                    }
                }, 30000); // 10 second timeout without activity
            };
            let streamTimeout = null;
            // Process the stream
            const processStream = async () => {
                try {
                    resetStreamTimeout()
                    let isDone = false;
                    let emptyChunksCount = 0;
                    
                    while (!isDone && !streamComplete) {
                        const { done, value } = await reader.read();
                        
                        if (done) {
                            isDone = true;
                            break;
                        }
                        
                        // Convert the chunk to text
                        const chunk = new TextDecoder().decode(value);
                        
                        clearTimeout(streamTimeout);
                        // Reset timeout on activity
                        resetStreamTimeout();
                        
                        // Check for empty chunks - may indicate end of stream
                        if (chunk.trim() === '') {
                            emptyChunksCount++;
                            // After receiving 3 consecutive empty chunks, consider the stream done
                            if (emptyChunksCount >= 3) {
                                isDone = true;
                                break;
                            }
                            continue;
                        }
                        
                        emptyChunksCount = 0; // Reset the counter if we got content
                        fullResponse += chunk;
                        
                        // Split by lines - server-sent events format
                        const lines = chunk.split("\n");
                        for (const line of lines) {
                            if (line.startsWith("data: ")) {
                                const data = line.substring(6);
                                
                                // Check for the end of the stream
                                if (data === "[DONE]") {
                                    isDone = true;
                                    break;
                                }
                                
                                try {
                                    const parsed = JSON.parse(data);
                                    responseObj = parsed;
                                    
                                    // Extract the content and reasoning
                                    if (parsed.choices && parsed.choices[0]) {
                                        // Check for delta content
                                        if (parsed.choices[0].delta && parsed.choices[0].delta.content !== undefined) {
                                            const delta = parsed.choices[0].delta.content || "";
                                            content += delta;
                                        }
                                        
                                        // Check for reasoning in delta
                                        if (parsed.choices[0].delta && parsed.choices[0].delta.reasoning !== undefined) {
                                            const reasoningDelta = parsed.choices[0].delta.reasoning || "";
                                            reasoning += reasoningDelta;
                                        }
                                        
                                        // Call the chunk callback
                                        onChunk({
                                            chunk: parsed.choices[0].delta?.content || "",
                                            reasoningChunk: parsed.choices[0].delta?.reasoning || "",
                                            content: content,
                                            reasoning: reasoning,
                                            data: parsed
                                        });
                                    }
                                } catch (e) {
                                    console.error("Error parsing SSE data:", e, data);
                                }
                            }
                        }
                    }
                    
                    // When done, call the complete callback if not already completed
                    if (!streamComplete) {
                        streamComplete = true;
                        if (streamTimeout) clearTimeout(streamTimeout);
                        
                        // Remove from active requests tracking
                        if (tweetId && window.activeStreamingRequests) {
                            delete window.activeStreamingRequests[tweetId];
                        }
                        
                        onComplete({
                            content: content,
                            reasoning: reasoning, // Include reasoning in onComplete
                            fullResponse: fullResponse,
                            data: responseObj
                        });
                    }
                    
                } catch (error) {
                    console.error("Stream processing error:", error);
                    // Make sure we clean up and call onError
                    if (streamTimeout) clearTimeout(streamTimeout);
                    if (!streamComplete) {
                        streamComplete = true;
                        
                        // Remove from active requests tracking
                        if (tweetId && window.activeStreamingRequests) {
                            delete window.activeStreamingRequests[tweetId];
                        }
                        
                        onError({
                            error: true,
                            message: `Stream processing error: ${error.toString()}`,
                            data: null
                        });
                    }
                }
            };
            
            processStream().catch(error => {
                console.error("Unhandled stream error:", error);
                if (streamTimeout) clearTimeout(streamTimeout);
                if (!streamComplete) {
                    streamComplete = true;
                    
                    // Remove from active requests tracking
                    if (tweetId && window.activeStreamingRequests) {
                        delete window.activeStreamingRequests[tweetId];
                    }
                    
                    onError({
                        error: true,
                        message: `Unhandled stream error: ${error.toString()}`,
                        data: null
                    });
                }
            });
        },
        onerror: function(error) {
            // Remove from active requests tracking
            if (tweetId && window.activeStreamingRequests) {
                delete window.activeStreamingRequests[tweetId];
            }
            
            onError({
                error: true,
                message: `Request error: ${error.toString()}`,
                data: null
            });
        },
        ontimeout: function() {
            // Remove from active requests tracking
            if (tweetId && window.activeStreamingRequests) {
                delete window.activeStreamingRequests[tweetId];
            }
            
            onError({
                error: true,
                message: `Request timed out after ${timeout}ms`,
                data: null
            });
        }
    });
    
    // Create an object with an abort method that can be called to cancel the request
    const streamingRequestObj = {
        abort: function() {
            streamComplete = true; // Set flag to prevent further processing
            try {
                reqObj.abort(); // Attempt to abort the XHR request
            } catch (e) {
                console.error("Error aborting request:", e);
            }
            
            // Remove from active requests tracking
            if (tweetId && window.activeStreamingRequests) {
                delete window.activeStreamingRequests[tweetId];
            }
        }
    };
    
    // Track this request if we have a tweet ID
    if (tweetId && window.activeStreamingRequests) {
        window.activeStreamingRequests[tweetId] = streamingRequestObj;
    }
    
    return streamingRequestObj;
}

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
                    `provide your reasoning, and a rating according to the the following instructions for the tweet with tweet ID ${tweetId}.
        ${USER_DEFINED_INSTRUCTIONS}
                _______BEGIN TWEET_______
                ${tweetText}
                _______END TWEET_______
                Make sure your response ends with SCORE_0, SCORE_1, SCORE_2, SCORE_3, SCORE_4, SCORE_5, SCORE_6, SCORE_7, SCORE_8, SCORE_9, or SCORE_10.`
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
                image_url: { url }
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
            
            pendingRequests--;
            showStatus(`Rating tweet... (${pendingRequests} pending)`);
            
            // Parse the result for score
            if (!result.error && result.content) {
                const scoreMatch = result.content.match(/SCORE_(\d+)/);
                
                if (scoreMatch) {
                    const score = parseInt(scoreMatch[1], 10);
                    
                    // Store the rating in cache
                    tweetCache.set(tweetId, {
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
            pendingRequests--;
            showStatus(`Rating tweet... (${pendingRequests} pending)`);
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
        model: selectedModel,
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
        const scoreMatch = content.match(/SCORE_(\d+)/);
        tweetCache.set(tweetId, {
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
    const existingCache = tweetCache.get(tweetId);
    if (!existingCache || existingCache.score === undefined || existingCache.score === null) {
        tweetCache.set(tweetId, {
            streaming: true,
            timestamp: Date.now(),
            tweetContent: tweetText,
            description: "",
            reasoning: "",
            score: null
        });
    }

    return new Promise((resolve, reject) => {
        // Find the tweet article element *once* if possible
        // const tweetArticle = Array.from(document.querySelectorAll('article[data-testid="tweet"]'))
        //    .find(article => getTweetID(article) === tweetId);
        
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
        let aggregatedReasoning = existingCache?.reasoning || ""; // Track reasoning traces
        let finalData = null;
        let finalScore = existingCache?.score || null;
        
        getCompletionStreaming(
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
                    score: finalScore, // Update with score found so far
                    description: aggregatedContent || "Rating in progress...",
                    reasoning: aggregatedReasoning
                });
                
                // Update cache with partial data during streaming
                if (tweetCache.has(tweetId)) {
                    const entry = tweetCache.get(tweetId);
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
                tweetCache.set(tweetId, {
                    tweetContent: tweetText,
                    score: finalScore,
                    description: aggregatedContent,
                    reasoning: aggregatedReasoning,
                    streaming: false, // Mark as complete
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
                    filterSingleTweet(tweetArticle);
                }

                resolve({
                    score: finalScore,
                    content: aggregatedContent,
                    reasoning: aggregatedReasoning,
                    error: finalStatus === 'error',
                    cached: false, // Streaming implies not from initial cache load
                    data: finalData
                });
            },
            // onError callback
            (errorData) => {
                 console.error(`[API Stream Error] Tweet ${tweetId}: ${errorData.message}`);
                // Update UI via instance to show error
                indicatorInstance.update({
                    status: 'error',
                    score: 5, // Default error score
                    description: `Stream Error: ${errorData.message}`,
                    reasoning: ''
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
            30000, // timeout
            tweetId  // Pass the tweet ID to associate with this request
        );
    });
}

/**
 * Gets descriptions for images using the OpenRouter API
 * 
 * @param {string[]} urls - Array of image URLs to get descriptions for
 * @param {string} apiKey - The API key for authentication
 * @param {string} tweetId - The unique tweet ID
 * @param {string} userHandle - The Twitter user handle
 * @returns {Promise<string>} Combined image descriptions
 */
async function getImageDescription(urls, apiKey, tweetId, userHandle) {
    if (!urls?.length || !enableImageDescriptions) {
        return !enableImageDescriptions ? '[Image descriptions disabled]' : '';
    }

    let descriptions = [];
    for (const url of urls) {
        const request = {
            model: selectedImageModel,
            messages: [{
                role: "user",
                content: [
                    {
                        type: "text",
                        text: "Describe what you see in this image in a concise way, focusing on the main elements and any text visible. Keep the description under 100 words."
                    },
                    {
                        type: "image_url",
                        image_url: { url }
                    }
                ]
            }],
            temperature: imageModelTemperature,
            top_p: imageModelTopP,
            max_tokens: maxTokens,
        };
        if (selectedImageModel.includes('gemini')) {
            request.config = {
                safetySettings: safetySettings,
            }
        }
        if (providerSort) {
            request.provider = {
                sort: providerSort,
                allow_fallbacks: true
            };
        }
        const result = await getCompletion(request, apiKey);
        if (!result.error && result.data?.choices?.[0]?.message?.content) {
            descriptions.push(result.data.choices[0].message.content);
        } else {
            descriptions.push('[Error getting image description]');
        }
    }

    return descriptions.map((desc, i) => `[IMAGE ${i + 1}]: ${desc}`).join('\n');
}

/**
 * Fetches the list of available models from the OpenRouter API.
 * Uses the stored API key, and updates the model selector upon success.
 */
function fetchAvailableModels() {
    const apiKey = browserGet('openrouter-api-key', '');
    if (!apiKey) {
        showStatus('Please enter your OpenRouter API key');
        return;
    }
    showStatus('Fetching available models...');
    const sortOrder = browserGet('modelSortOrder', 'throughput-high-to-low');
    GM_xmlhttpRequest({
        method: "GET",
        url: `https://openrouter.ai/api/frontend/models/find?order=${sortOrder}`,
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "HTTP-Referer": "https://greasyfork.org/en/scripts/532182-twitter-x-ai-tweet-filter",
            "X-Title": "Tweet Rating Tool"
        },
        onload: function (response) {
            try {
                const data = JSON.parse(response.responseText);
                if (data.data && data.data.models) {
                    //filter all models that don't have key "endpoint" or endpoint is null
                    let filteredModels = data.data.models.filter(model => model.endpoint && model.endpoint !== null);
                    // Reverse initial order for latency sorting to match High-Low expectations
                    if (sortOrder === 'latency-low-to-high'|| sortOrder === 'pricing-low-to-high') {
                        filteredModels.reverse();
                    }
                    availableModels = filteredModels || [];
                    listedModels = [...availableModels]; // Initialize listedModels
                    refreshModelsUI();
                    showStatus('Models updated!');
                }
            } catch (error) {
                console.error('Error parsing model list:', error);
                showStatus('Error parsing models list');
            }
        },
        onerror: function (error) {
            console.error('Error fetching models:', error);
            showStatus('Error fetching models!');
        }
    });
}

