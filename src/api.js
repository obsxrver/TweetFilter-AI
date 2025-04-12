/**
 * @typedef {Object} CompletionResponse
 * @property {string} id - Response ID from OpenRouter
 * @property {string} model - Model used for completion
 * @property {Array<{
 *   message: {
 *     role: string,
 *     content: string
 *   },
 *   finish_reason: string,
 *   index: number
 * }>} choices - Array of completion choices
 * @property {Object} usage - Token usage statistics
 * @property {number} usage.prompt_tokens - Number of tokens in prompt
 * @property {number} usage.completion_tokens - Number of tokens in completion
 * @property {number} usage.total_tokens - Total tokens used
 */

/**
 * @typedef {Object} CompletionRequest
 * @property {string} model - Model ID to use
 * @property {Array<{role: string, content: Array<{type: string, text?: string, image_url?: {url: string}}>}>} messages - Messages for completion
 * @property {number} temperature - Temperature for sampling
 * @property {number} top_p - Top P for sampling
 * @property {number} max_tokens - Maximum tokens to generate
 * @property {Object} provider - Provider settings
 * @property {string} provider.sort - Sort order for models
 * @property {boolean} provider.allow_fallbacks - Whether to allow fallback models
 */

/**
 * @typedef {Object} CompletionResult
 * @property {boolean} error - Whether an error occurred
 * @property {string} message - Error or success message
 * @property {CompletionResponse|null} data - The completion response data if successful
 */

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
 */
function getCompletionStreaming(request, apiKey, onChunk, onComplete, onError, timeout = 30000) {
    // Add stream parameter to request
    const streamingRequest = {
        ...request,
        stream: true
    };
    
    let fullResponse = "";
    let content = "";
    let responseObj = null;
    
    GM_xmlhttpRequest({
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
            
            // Process the stream
            const processStream = async () => {
                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        
                        if (done) {
                            break;
                        }
                        
                        // Convert the chunk to text
                        const chunk = new TextDecoder().decode(value);
                        fullResponse += chunk;
                        
                        // Split by lines - server-sent events format
                        const lines = chunk.split("\n");
                        for (const line of lines) {
                            if (line.startsWith("data: ")) {
                                const data = line.substring(6);
                                
                                // Check for the end of the stream
                                if (data === "[DONE]") {
                                    continue;
                                }
                                
                                try {
                                    const parsed = JSON.parse(data);
                                    responseObj = parsed;
                                    
                                    // Extract the content
                                    if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta) {
                                        const delta = parsed.choices[0].delta.content || "";
                                        content += delta;
                                        
                                        // Call the chunk callback
                                        onChunk({
                                            chunk: delta,
                                            content: content,
                                            data: parsed
                                        });
                                    }
                                } catch (e) {
                                    console.error("Error parsing SSE data:", e, data);
                                }
                            }
                        }
                    }
                    
                    // When done, call the complete callback
                    onComplete({
                        content: content,
                        fullResponse: fullResponse,
                        data: responseObj
                    });
                    
                } catch (error) {
                    console.error("Stream processing error:", error);
                    onError({
                        error: true,
                        message: `Stream processing error: ${error.toString()}`,
                        data: null
                    });
                }
            };
            
            processStream();
        },
        onerror: function(error) {
            onError({
                error: true,
                message: `Request error: ${error.toString()}`,
                data: null
            });
        },
        ontimeout: function() {
            onError({
                error: true,
                message: `Request timed out after ${timeout}ms`,
                data: null
            });
        }
    });
}

/** 
 * Formats description text for the tooltip.
 * Copy of the function from ui.js to ensure it's available for streaming.
 */
function formatTooltipDescription(description) {
    if (!description) return '';
    // Basic formatting, can be expanded
    description = description.replace(/SCORE_(\d+)/g, '<span style="display:inline-block;background-color:#1d9bf0;color:white;padding:3px 10px;border-radius:9999px;margin:8px 0;font-weight:bold;">SCORE: $1</span>');
    description = description.replace(/\n\n/g, '</p><p style="margin-top: 10px;">'); // Smaller margin
    description = description.replace(/\n/g, '<br>');
    return `<p>${description}</p>`;
}

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
 * @returns {Promise<{score: number, content: string, error: boolean}>} The rating result
 */
async function rateTweetWithOpenRouter(tweetText, tweetId, apiKey, mediaUrls, maxRetries = 3) {
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
                    `provide your reasoning, and a rating (eg. SCORE_0, SCORE_1, SCORE_2, SCORE_3, etc.) for the tweet with tweet ID ${tweetId}.
        [USER-DEFINED INSTRUCTIONS]:
        ${USER_DEFINED_INSTRUCTIONS}
                _______BEGIN TWEET_______
                ${tweetText}
                _______END TWEET_______`
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

    // Add provider settings
    const sortOrder = GM_getValue('modelSortOrder', 'throughput-high-to-low');
    request.provider = {
        sort: sortOrder.split('-')[0],
        allow_fallbacks: true
    };

    // Check if streaming is enabled
    const useStreaming = GM_getValue('enableStreaming', false);
    
    if (useStreaming) {
        // Use streaming API
        return new Promise((resolve) => {
            // Update status
            pendingRequests++;
            showStatus(`Rating tweet... (${pendingRequests} pending)`);
            
            // Rate limiting
            const now = Date.now();
            const timeElapsed = now - lastAPICallTime;
            if (timeElapsed < API_CALL_DELAY_MS) {
                setTimeout(() => {
                    lastAPICallTime = Date.now();
                    processStreamingRequest();
                }, API_CALL_DELAY_MS - timeElapsed);
            } else {
                lastAPICallTime = now;
                processStreamingRequest();
            }
            
            function processStreamingRequest() {
                // Find the tweet article element for this tweet ID
                const tweetArticle = Array.from(document.querySelectorAll('article[data-testid="tweet"]'))
                    .find(article => getTweetID(article) === tweetId);
                
                let aggregatedContent = "";
                
                getCompletionStreaming(
                    request,
                    apiKey,
                    // onChunk callback - update the tweet's rating indicator in real-time
                    (chunkData) => {
                        aggregatedContent += chunkData.chunk;
                        
                        if (tweetArticle) {
                            // Look for a score in the accumulated content so far
                            const scoreMatch = aggregatedContent.match(/SCORE_(\d+)/);
                            let currentScore = scoreMatch ? parseInt(scoreMatch[1], 10) : null;
                            
                            // Store references and current state
                            const indicator = tweetArticle.querySelector('.score-indicator');
                            const tooltip = indicator?.scoreTooltip;
                            
                            // Update the indicator with current partial content
                            tweetArticle.dataset.streamingContent = aggregatedContent;
                            tweetArticle.dataset.ratingStatus = 'streaming';
                            tweetArticle.dataset.ratingDescription = aggregatedContent;
                            
                            // Don't cache the streaming result until we have a score
                            // This prevents the "Cannot read properties of undefined (reading 'toString')" error
                            if (currentScore !== null) {
                                // Only initialize cache if we have a score
                                if (!tweetIDRatingCache[tweetId]) {
                                    tweetIDRatingCache[tweetId] = {
                                        tweetContent: tweetText,
                                        score: currentScore,
                                        description: aggregatedContent,
                                        streaming: true  // Mark as streaming/incomplete
                                    };
                                } else {
                                    // Update existing cache entry if it exists
                                    tweetIDRatingCache[tweetId].description = aggregatedContent;
                                    tweetIDRatingCache[tweetId].score = currentScore;
                                    tweetIDRatingCache[tweetId].streaming = true;
                                }
                                
                                tweetArticle.dataset.sloppinessScore = currentScore.toString();
                                
                                // Save to storage periodically (once per second max)
                                if (!window.lastCacheSaveTime || Date.now() - window.lastCacheSaveTime > 1000) {
                                    saveTweetRatings();
                                    window.lastCacheSaveTime = Date.now();
                                }
                            }
                            
                            // Only update the tooltip directly
                            if (tooltip) {
                                // Update tooltip content
                                tooltip.innerHTML = formatTooltipDescription(aggregatedContent);
                                tooltip.classList.add('streaming-tooltip');
                                
                                // Auto-scroll to the bottom of the tooltip to show new content
                                if (tooltip.style.display === 'block') {
                                    // Check if scroll is at or near the bottom before auto-scrolling
                                    const isAtBottom = tooltip.scrollHeight - tooltip.scrollTop - tooltip.clientHeight < 30;
                                    
                                    // Only auto-scroll if user was already at the bottom
                                    if (isAtBottom) {
                                        tooltip.scrollTop = tooltip.scrollHeight;
                                    }
                                }
                            }
                            
                            if (currentScore !== null) {
                                // Update the score display but not the tooltip
                                if (indicator) {
                                    // Use setScoreIndicator to ensure classes are properly set
                                    // Set streaming status to keep the streaming styling/animation
                                    tweetArticle.dataset.sloppinessScore = currentScore.toString();
                                    setScoreIndicator(tweetArticle, currentScore, 'streaming', aggregatedContent);
                                    filterSingleTweet(tweetArticle);
                                }
                            } else if (indicator) {
                                // Just update the streaming indicator without changing the tooltip
                                setScoreIndicator(tweetArticle, null, 'streaming', aggregatedContent);
                            }
                        }
                    },
                    // onComplete callback - finalize the rating
                    (finalData) => {
                        pendingRequests--;
                        showStatus(`Rating tweet... (${pendingRequests} pending)`);
                        
                        const content = finalData.content;
                        const scoreMatch = content.match(/SCORE_(\d+)/);
                        
                        if (scoreMatch) {
                            const score = parseInt(scoreMatch[1], 10);
                            
                            // Cache the final result
                            tweetIDRatingCache[tweetId] = {
                                tweetContent: tweetText,
                                score: score,
                                description: content,
                                streaming: false,  // Mark as complete
                                // Store timestamp to prevent immediate re-processing
                                timestamp: Date.now()
                            };
                            saveTweetRatings();
                            
                            // Finalize the UI update
                            if (tweetArticle) {
                                tweetArticle.dataset.ratingStatus = 'rated';
                                tweetArticle.dataset.ratingDescription = content;
                                tweetArticle.dataset.sloppinessScore = score.toString();
                                
                                // Remove streaming class from tooltip
                                const indicator = tweetArticle.querySelector('.score-indicator');
                                if (indicator && indicator.scoreTooltip) {
                                    indicator.scoreTooltip.classList.remove('streaming-tooltip');
                                }
                                
                                // Use setScoreIndicator to properly set the classes
                                setScoreIndicator(tweetArticle, score, 'rated', content);
                                filterSingleTweet(tweetArticle);
                            }
                            
                            resolve({ score, content, error: false });
                        } else {
                            // No score found in the complete response
                            const errorMsg = "Failed to parse score from streaming response";
                            console.error(errorMsg, content);
                            
                            if (tweetArticle) {
                                tweetArticle.dataset.ratingStatus = 'error';
                                tweetArticle.dataset.ratingDescription = errorMsg;
                                tweetArticle.dataset.sloppinessScore = '5';
                                setScoreIndicator(tweetArticle, 5, 'error', errorMsg);
                                filterSingleTweet(tweetArticle);
                            }
                            
                            resolve({
                                score: 5,
                                content: errorMsg,
                                error: true
                            });
                        }
                    },
                    // onError callback
                    (errorData) => {
                        pendingRequests--;
                        showStatus(`Rating tweet... (${pendingRequests} pending)`);
                        console.error("Streaming error:", errorData.message);
                        
                        if (tweetArticle) {
                            tweetArticle.dataset.ratingStatus = 'error';
                            tweetArticle.dataset.ratingDescription = errorData.message;
                            tweetArticle.dataset.sloppinessScore = '5';
                            
                            // Remove streaming class from tooltip
                            const indicator = tweetArticle.querySelector('.score-indicator');
                            if (indicator && indicator.scoreTooltip) {
                                indicator.scoreTooltip.classList.remove('streaming-tooltip');
                            }
                            
                            setScoreIndicator(tweetArticle, 5, 'error', errorData.message);
                            filterSingleTweet(tweetArticle);
                        }
                        
                        resolve({
                            score: 5,
                            content: errorData.message,
                            error: true
                        });
                    }
                );
            }
        });
    } else {
        // Use non-streaming API (original implementation)
        // Implement retry logic with exponential backoff
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

            // Make API request
            const result = await getCompletion(request, apiKey);
            pendingRequests--;
            showStatus(`Rating tweet... (${pendingRequests} pending)`);

            if (!result.error && result.data?.choices?.[0]?.message?.content) {
                const content = result.data.choices[0].message.content;
                const scoreMatch = content.match(/SCORE_(\d+)/);

                if (scoreMatch) {
                    const score = parseInt(scoreMatch[1], 10);

                    tweetIDRatingCache[tweetId] = {
                        tweetContent: tweetText,
                        score: score,
                        description: content
                    };
                    saveTweetRatings();
                    return { score, content, error: false, cached: false };
                }
            }

            // Handle retries
            if (attempt < maxRetries) {
                const backoffDelay = Math.pow(attempt, 2) * 1000;
                console.log(`Attempt ${attempt}/${maxRetries} failed. Retrying in ${backoffDelay}ms...`);
                console.log('Response:', {
                    error: result.error,
                    message: result.message,
                    data: result.data,
                    content: result.data?.choices?.[0]?.message?.content
                });
                await new Promise(resolve => setTimeout(resolve, backoffDelay));
            }
        }

        return {
            score: 5,
            content: "Failed to get valid rating after multiple attempts",
            error: true
        };
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
            provider: {
                sort: GM_getValue('modelSortOrder', 'throughput-high-to-low').split('-')[0],
                allow_fallbacks: true
            }
        };
        if (selectedImageModel.includes('gemini')) {
            request.config = {
                safetySettings: safetySettings,
            }
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
    const apiKey = GM_getValue('openrouter-api-key', '');
    if (!apiKey) {
        console.log('No API key available, skipping model fetch');
        showStatus('Please enter your OpenRouter API key');
        return;
    }
    showStatus('Fetching available models...');
    const sortOrder = GM_getValue('modelSortOrder', 'throughput-high-to-low');
    GM_xmlhttpRequest({
        method: "GET",
        url: `https://openrouter.ai/api/frontend/models/find?order=${sortOrder}`,
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "HTTP-Referer": "https://greasyfork.org/en/scripts/532182-twitter-x-ai-tweet-filter", // Use a more generic referer if preferred
            "X-Title": "Tweet Rating Tool"
        },
        onload: function (response) {
            try {
                const data = JSON.parse(response.responseText);
                if (data.data && data.data.models) {
                    availableModels = data.data.models || [];
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

