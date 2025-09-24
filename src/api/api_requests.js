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

    const streamingRequest = {
        ...request,
        stream: true
    };

    let fullResponse = "";
    let content = "";
    let reasoning = "";
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

            const reader = response.response.getReader();

            let streamTimeout = null;
            let firstChunkReceived = false;
            const resetStreamTimeout = () => {
                if (streamTimeout) clearTimeout(streamTimeout);
                streamTimeout = setTimeout(() => {
                    console.log("Stream timed out after inactivity");
                    if (!streamComplete) {
                        streamComplete = true;

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

                        const chunk = new TextDecoder().decode(value);

                        clearTimeout(streamTimeout);

                        resetStreamTimeout();

                        if (chunk.trim() === '') {
                            emptyChunksCount++;

                            if (emptyChunksCount >= 3) {
                                isDone = true;
                                break;
                            }
                            continue;
                        }

                        emptyChunksCount = 0;
                        fullResponse += chunk;

                        const lines = chunk.split("\n");
                        for (const line of lines) {
                            if (line.startsWith("data: ")) {
                                const data = line.substring(6);

                                if (data === "[DONE]") {
                                    isDone = true;
                                    break;
                                }

                                try {
                                    const parsed = JSON.parse(data);
                                    responseObj = parsed;

                                    if (parsed.choices && parsed.choices[0]) {

                                        if (parsed.choices[0].delta && parsed.choices[0].delta.content !== undefined) {
                                            const delta = parsed.choices[0].delta.content || "";
                                            content += delta;
                                        }

                                        if (parsed.choices[0].delta && parsed.choices[0].delta.reasoning !== undefined) {
                                            const reasoningDelta = parsed.choices[0].delta.reasoning || "";
                                            reasoning += reasoningDelta;
                                        }

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

                    if (!streamComplete) {
                        streamComplete = true;
                        if (streamTimeout) clearTimeout(streamTimeout);

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

                    if (streamTimeout) clearTimeout(streamTimeout);
                    if (!streamComplete) {
                        streamComplete = true;

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

    const streamingRequestObj = {
        abort: function() {
            streamComplete = true;
            pendingRequests--;
            try {
                reqObj.abort();
            } catch (e) {
                console.error("Error aborting request:", e);
            }

            if (tweetId && window.activeStreamingRequests) {
                delete window.activeStreamingRequests[tweetId];
            }

            if (tweetId && tweetCache.has(tweetId)) {
                const entry = tweetCache.get(tweetId);

                if (entry.streaming && (entry.score === undefined || entry.score === null)) {
                    tweetCache.delete(tweetId);
                }
            }
        }
    };

    if (tweetId && window.activeStreamingRequests) {
        window.activeStreamingRequests[tweetId] = streamingRequestObj;
    }

    return streamingRequestObj;
}

let isOnlineListenerAttached = false;

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

    function handleOnline() {
        showStatus('Back online. Fetching models...');
        fetchAvailableModels();
        window.removeEventListener('online', handleOnline);
        isOnlineListenerAttached = false;
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

                    let filteredModels = data.data.models.filter(model => model.endpoint && model.endpoint !== null);

                    filteredModels.forEach(model => {

                        let currentSlug = model.endpoint?.model_variant_slug || model.id;
                        model.slug = currentSlug;
                    });

                    if (sortOrder === 'latency-low-to-high'|| sortOrder === 'pricing-low-to-high') {
                        filteredModels.reverse();
                    }
                    availableModels = filteredModels || [];
                    listedModels = [...availableModels];
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
                        text: "Describe this image. Include any text visible in the image, try to describe the image in a way that preserves all of the information and context present in the image."
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
                "HTTP-Referer": "https://greasyfork.org/en/scripts/532459-tweetfilter-ai",
                "X-Title": "TweetFilter-AI"
            },
            timeout: timeout,
            onload: function(response) {
                if (response.status >= 200 && response.status < 300) {
                    try {
                        const data = JSON.parse(response.responseText);
                        resolve({
                            error: false,
                            message: "Metadata fetched successfully",
                            data: data
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
                         status: 404,
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

