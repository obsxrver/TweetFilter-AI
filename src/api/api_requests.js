// src/api_requests.js

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
    console.log(streamingRequest);
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
            
            let streamTimeout = null;
            let firstChunkReceived = false;
            const resetStreamTimeout = () => {
                if (streamTimeout) clearTimeout(streamTimeout);
                streamTimeout = setTimeout(() => {
                    console.log("Stream timed out after inactivity");
                    if (!streamComplete) {
                        streamComplete = true;
                        // Call onComplete with whatever we have so far
                        onComplete({
                            content: content,
                            reasoning: reasoning,
                            fullResponse: fullResponse,
                            data: responseObj,
                            timedOut: true
                        });
                    }
                }, 30000);
            };
            // Process the stream
            const processStream = async () => {
                try {
                    let isDone = false;
                    let emptyChunksCount = 0;
                    
                    while (!isDone && !streamComplete) {
                        const { done, value } = await reader.read();

                        if (done) {
                            isDone = true;
                            break;
                        }

                        if (!firstChunkReceived) {
                            firstChunkReceived = true;
                            resetStreamTimeout();
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
                            reasoning: reasoning,
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
            pendingRequests--;
            try {
                reqObj.abort(); // Attempt to abort the XHR request
            } catch (e) {
                console.error("Error aborting request:", e);
            }
            
            // Remove from active requests tracking
            if (tweetId && window.activeStreamingRequests) {
                delete window.activeStreamingRequests[tweetId];
            }

            // Remove incomplete entry from cache
            if (tweetId && tweetCache.has(tweetId)) {
                const entry = tweetCache.get(tweetId);
                // Only delete if it's a streaming entry without a score
                if (entry.streaming && (entry.score === undefined || entry.score === null)) {
                    tweetCache.delete(tweetId);
                }
            }
        }
    };
    
    // Track this request if we have a tweet ID
    if (tweetId && window.activeStreamingRequests) {
        window.activeStreamingRequests[tweetId] = streamingRequestObj;
    }
    
    return streamingRequestObj;
}

let isOnlineListenerAttached = false; // Flag to ensure listener is only added once

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

    // Named function to handle the 'online' event
    function handleOnline() {
        showStatus('Back online. Fetching models...');
        fetchAvailableModels(); // Retry fetching models
        window.removeEventListener('online', handleOnline); // Remove the listener
        isOnlineListenerAttached = false; // Reset the flag
    }

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

                    // Assign the slug from model.endpoint.model_variant_slug
                    filteredModels.forEach(model => {
                        // Use model.endpoint.model_variant_slug as the primary source for the slug
                        let currentSlug = model.endpoint?.model_variant_slug || model.id; // Fallback to model.id if slug is not present
                        model.slug = currentSlug; // Assign the processed slug back to model.slug for consistency elsewhere
                    });

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
            if (!navigator.onLine) {
                if (!isOnlineListenerAttached) {
                    showStatus('Offline. Will attempt to fetch models when connection returns.');
                    window.addEventListener('online', handleOnline);
                    isOnlineListenerAttached = true;
                } else {
                    showStatus('Still offline. Waiting for connection to fetch models.');
                }
            } else {
                showStatus('Error fetching models!');
            }
        }
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
    const imageDescriptionsEnabled = browserGet('enableImageDescriptions', false);
    if (!urls?.length || !imageDescriptionsEnabled) {
        return !imageDescriptionsEnabled ? '[Image descriptions disabled]' : '';
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
 * Fetches generation metadata from OpenRouter API by ID.
 *
 * @param {string} generationId - The ID of the generation to fetch metadata for.
 * @param {string} apiKey - OpenRouter API key.
 * @param {number} [timeout=10000] - Request timeout in milliseconds.
 * @returns {Promise<CompletionResult>} The result containing metadata or an error.
 */
async function getGenerationMetadata(generationId, apiKey, timeout = 10000) {
    return new Promise((resolve) => {
        GM_xmlhttpRequest({
            method: "GET",
            url: `https://openrouter.ai/api/v1/generation?id=${generationId}`,
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "HTTP-Referer": "https://greasyfork.org/en/scripts/532459-tweetfilter-ai", // Use your script's URL
                "X-Title": "TweetFilter-AI" // Replace with your script's name
            },
            timeout: timeout,
            onload: function(response) {
                if (response.status >= 200 && response.status < 300) {
                    try {
                        const data = JSON.parse(response.responseText);
                        resolve({
                            error: false,
                            message: "Metadata fetched successfully",
                            data: data // The structure is { data: { ...metadata... } }
                        });
                    } catch (error) {
                        resolve({
                            error: true,
                            message: `Failed to parse metadata response: ${error.message}`,
                            data: null
                        });
                    }
                } else if (response.status === 404) {
                     resolve({
                         error: true,
                         status: 404, // Indicate not found specifically for retry logic
                         message: `Generation metadata not found (404): ${response.responseText}`,
                         data: null
                     });
                } else {
                    resolve({
                        error: true,
                        status: response.status,
                        message: `Metadata request failed with status ${response.status}: ${response.responseText}`,
                        data: null
                    });
                }
            },
            onerror: function(error) {
                resolve({
                    error: true,
                    message: `Metadata request error: ${error.toString()}`,
                    data: null
                });
            },
            ontimeout: function() {
                resolve({
                    error: true,
                    message: `Metadata request timed out after ${timeout}ms`,
                    data: null
                });
            }
        });
    });
}

// Export the functions
// export {
//     getCompletion,
//     getCompletionStreaming,
//     fetchAvailableModels,
//     getImageDescription
// }; 