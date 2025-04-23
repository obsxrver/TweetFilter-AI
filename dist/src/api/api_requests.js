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
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
                "HTTP-Referer": "https://greasyfork.org/en/scripts/532459-tweetfilter-ai",
                "X-Title": "TweetFilter-AI"
            },
            body: JSON.stringify(request),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}: ${await response.text()}`);
        }

        const data = await response.json();
        
        if (data.content === "") {
            return {
                error: true,
                message: `No content returned${data.choices[0].native_finish_reason=="SAFETY"?" (SAFETY FILTER)":""}`,
                data: data
            };
        }

        return {
            error: false,
            message: "Request successful",
            data: data
        };
    } catch (error) {
        return {
            error: true,
            message: error.name === 'AbortError' ? 
                `Request timed out after ${timeout}ms` : 
                `Request error: ${error.message}`,
            data: null
        };
    }
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
    const controller = new AbortController();
    let streamComplete = false;
    let fullResponse = "";
    let content = "";
    let reasoning = "";
    let responseObj = null;

    // Add stream parameter to request
    const streamingRequest = {
        ...request,
        stream: true
    };

    const timeoutId = setTimeout(() => {
        if (!streamComplete) {
            controller.abort();
            onComplete({
                content: content,
                reasoning: reasoning,
                fullResponse: fullResponse,
                data: responseObj,
                timedOut: true
            });
        }
    }, timeout);

    fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
            "HTTP-Referer": "https://greasyfork.org/en/scripts/532459-tweetfilter-ai",
            "X-Title": "TweetFilter-AI"
        },
        body: JSON.stringify(streamingRequest),
        signal: controller.signal
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.body.getReader();
    })
    .then(reader => {
        let streamTimeout = null;
        
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
                resetStreamTimeout();
                let isDone = false;
                let emptyChunksCount = 0;

                while (!isDone && !streamComplete) {
                    const { done, value } = await reader.read();

                    if (done) {
                        isDone = true;
                        break;
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
                                        content: content,
                                        reasoning: reasoning,
                                        delta: parsed.choices[0].delta,
                                        tweetId: tweetId
                                    });
                                }
                            } catch (error) {
                                console.error("Error parsing stream data:", error);
                            }
                        }
                    }
                }

                if (!streamComplete) {
                    streamComplete = true;
                    clearTimeout(streamTimeout);
                    onComplete({
                        content: content,
                        reasoning: reasoning,
                        fullResponse: fullResponse,
                        data: responseObj
                    });
                }
            } catch (error) {
                onError(error);
            }
        };

        processStream();
    })
    .catch(error => {
        onError(error);
    });

    return {
        abort: () => {
            controller.abort();
            if (!streamComplete) {
                streamComplete = true;
                onComplete({
                    content: content,
                    reasoning: reasoning,
                    fullResponse: fullResponse,
                    data: responseObj,
                    aborted: true
                });
            }
        }
    };
}

/**
 * Fetches the list of available models from the OpenRouter API.
 * Uses the stored API key, and updates the model selector upon success.
 */
async function fetchAvailableModels() {
    const apiKey = await browserGet('openrouter-api-key', '');
    if (!apiKey) {
        showStatus('Please enter your OpenRouter API key');
        return;
    }
    
    showStatus('Fetching available models...');
    const sortOrder = await browserGet('modelSortOrder', 'throughput-high-to-low');
    
    try {
        const response = await fetch(`https://openrouter.ai/api/frontend/models/find?order=${sortOrder}`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "HTTP-Referer": "https://greasyfork.org/en/scripts/532182-twitter-x-ai-tweet-filter",
                "X-Title": "Tweet Rating Tool"
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
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
        console.error('Error fetching models:', error);
        showStatus('Error fetching models!');
    }
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

// Export the functions
export {
    getCompletion,
    getCompletionStreaming,
    fetchAvailableModels,
    getImageDescription
}; 