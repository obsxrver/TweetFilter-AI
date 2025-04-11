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
            const scoreMatch = content.match(/\SCORE_(\d+)/);

            if (scoreMatch) {
                const score = parseInt(scoreMatch[1], 10);

                tweetIDRatingCache[tweetId] = {
                    tweetContent: tweetText,
                    score: score,
                    description: content
                };
                saveTweetRatings();
                return { score, content, error: false };
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

