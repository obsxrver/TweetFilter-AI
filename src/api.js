// ==UserScript==
// @name         TweetFilter AI - API Module
// @namespace    http://tampermonkey.net/
// @version      Version 1.3r
// @description  API communication functions for TweetFilter AI
// @author       Obsxrver(3than)
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      openrouter.ai
// @require      https://raw.githubusercontent.com/obsxrver/TweetFilter-AI/dev/src/config.js
// @require      https://raw.githubusercontent.com/obsxrver/TweetFilter-AI/dev/src/utils.js
// @license      MIT
// ==/UserScript==

// ----- API Functions -----

function GM_POST(request_url, request_headers, request_data, request_timeout) {
    return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
            method: "POST",
            url: request_url,
            headers: request_headers,
            data: request_data,
            timeout: request_timeout,
            onload: function (response) {
                if(response.status >= 200 && response.status < 300){
                    resolve({error: false, message: "Request successful", response: response});
                }else{
                    resolve({error: true, message: "Request failed", response: response});
                }
            },
            onerror: function (error) {
                resolve({error: true, message: error, response: null});
            },
            ontimeout: function () {
                resolve({error: true, message: "Request timed out", response: null});
            }

        })
    });
    
}
/**
     * Rates a tweet using the OpenRouter API with automatic retry functionality.
     * The function retries up to 3 times in case of failures.
     * @param {string} tweetText - The text content of the tweet.
     * @param {string} tweetId - The unique tweet ID.
     * @param {string} apiKey - The API key for authentication.
     * @param {number} [attempt=1] - The current attempt number.
     * @param {number} [maxAttempts=3] - The maximum number of retry attempts.
     * @returns {Promise<{score: number, error: boolean}>} The rating score and error flag.
     */
function rateTweetWithOpenRouter(tweetText, tweetId, apiKey, mediaUrls, attempt = 1, maxAttempts = 3) {
    return new Promise((resolve, reject) => {
        /**
         * Attempts the API call. On failure (or certain HTTP errors), retries if under maxAttempts.
         * On success, parses the response and resolves with the score.
         * On final failure, resolves with a default score (5) and an error flag.
         * @param {number} currentAttempt - The current attempt number.
         */

        function attemptRating(currentAttempt) {
            // Rate limit: wait if needed between API calls
            const now = Date.now();
            const timeElapsed = now - lastAPICallTime;
            if (timeElapsed < API_CALL_DELAY_MS) {
                setTimeout(() => { attemptRating(currentAttempt); }, API_CALL_DELAY_MS - timeElapsed);
                return;
            }
            console.log("max tokens", maxTokens);
            lastAPICallTime = Date.now();
            pendingRequests++;
            showStatus(`Rating tweet... (${pendingRequests} pending)`);

            let messages = [
                {
                    "role": "developer",
                    "content": [{
                        "type": "text", "text":
                            `
                         You will be given a Tweet, structured like this:

                         _______TWEET SCHEMA_______
                         _______BEGIN TWEET_______


                        [TWEET TweetID]
                        [the text of the tweet being replied to]
                        [MEDIA_DESCRIPTION]:
                        [IMAGE 1]: [description], [IMAGE 2]: [description], etc.
                        [REPLY] (if the author is replying to another tweet)
                        [TWEET TweetID]: (the tweet which you are to review)
                        @[the author of the tweet]
                        [the text of the tweet]
                        [MEDIA_DESCRIPTION]:
                        [IMAGE 1]: [description], [IMAGE 2]: [description], etc.
                        [QUOTED_TWEET]: (if the author is quoting another tweet)
                        [the text of the quoted tweet]
                        [QUOTED_TWEET_MEDIA_DESCRIPTION]:
                        [IMAGE 1]: [description], [IMAGE 2]: [description], etc.
                        _______END TWEET_______
                        _______END TWEET SCHEMA_______

                        You are an expert critic of tweets. You are to review and provide a rating for the tweet wtih tweet ID ${tweetId}.
                        Ensure that you consider these user-defined instructions in your analysis and scoring:
                        [USER-DEFINED INSTRUCTIONS]:
                        ${USER_DEFINED_INSTRUCTIONS}
                        Provide a concise explanation of your reasoning and then, on a new line, output your final rating in the exact format:
                        SCORE_X where X is a number from 1 (lowest quality) to 10 (highest quality).
                        for example: SCORE_1, SCORE_2, SCORE_3, etc.
                        If one of the above is not present, the program will not be able to parse the response and will return an error.
                        _______BEGIN TWEET_______
                        ${tweetText}
                        _______END TWEET_______`
                    }]
                }];

            // Check if image descriptions are enabled AND we have media URLs
            if (mediaUrls && mediaUrls.length > 0) {
                

                if (modelSupportsImages(selectedModel)) {

                    // Add each image URL to the message content
                    for (const url of mediaUrls) {
                        messages[0].content.push({
                            "type": "image_url",
                            "image_url": { "url": url }
                        });
                    }
                } 
            } 

            // Prepare the request body with provider options
            const requestBody = {
                model: selectedModel,
                messages: messages,
                temperature: modelTemperature,
                top_p: modelTopP,
                max_tokens: maxTokens
            };
            const sortOrder = GM_getValue('modelSortOrder', 'throughput-high-to-low');
            const sortType = sortOrder.split('-')[0]; // Extract sort type (price, throughput, latency)
            requestBody.provider = {
                sort: sortType,
                allow_fallbacks: true
            };
            // Use GM_POST for a more concise API call
            GM_POST(
                "https://openrouter.ai/api/v1/chat/completions", // request_url
                { // request_headers
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`,
                    "HTTP-Referer": "https://greasyfork.org/en/scripts/532182-twitter-x-ai-tweet-filter", // Using the referer from the initial attempt
                    "X-Title": "Tweet Rating Tool"
                },
                JSON.stringify(requestBody), // request_data
                30000 // request_timeout
            ).then(result => {
                pendingRequests--;
                showStatus(`Rating tweet... (${pendingRequests} pending)`); // Update status after request finishes

                if (result.error) {
                    const shouldRetry = (result.message === "Request timed out" || (result.response && (result.response.status === 429 || result.response.status >= 500)));

                    if (shouldRetry && currentAttempt < maxAttempts) {
                        const backoffDelay = Math.pow(2, currentAttempt) * 1000;
                        console.log(`Attempt ${currentAttempt}/${maxAttempts} failed (${result}). Retrying in ${backoffDelay}ms...`);
                        setTimeout(() => { attemptRating(currentAttempt + 1); }, backoffDelay);
                    } else {
                        // Final failure after retries or non-retryable error
                        // Log the full error details
                        console.error('API Request Failed. Details:', result);
                        // Resolve with the standardized error format
                        resolve({ score: 5, content: `API error: ${result.message || 'Unknown error'}`, error: true });
                    }
                } else {
                    // Handle successful response (status 200-299)
                    try {
                        const data = JSON.parse(result.response.responseText);
                        const content = data.choices?.[0]?.message?.content;

                        if (!content) {
                            console.error(`No content in OpenRouter response from ${selectedModel} for tweet ${tweetId}. Response:`, data);
                            
                                     if (currentAttempt < maxAttempts) {
                                        const backoffDelay = Math.pow(2, currentAttempt) * 1000;
                                        console.log(`Retrying request for tweet ${tweetId} in ${backoffDelay}ms (attempt ${currentAttempt + 1}/${maxAttempts}) due to empty content/error in response`);
                                        setTimeout(() => { attemptRating(currentAttempt + 1); }, backoffDelay);
                                        return; // Exit early, retry is scheduled
                                     }
                                 
                            
                            // If not retrying, resolve with error
                            resolve({ score: 5, content: "No content in OpenRouter response. Please check for rate limits or token quotas.", error: true });
                            return;
                        }

                        const scoreMatch = content.match(/\SCORE_(\d+)/);
                        if (scoreMatch) {
                            const score = parseInt(scoreMatch[1], 10);
                            tweetIDRatingCache[tweetId] = { tweetContent: tweetText, score: score, description: content };
                            saveTweetRatings();
                            resolve({ score: score, content: content, error: false });
                        } else {
                            console.error(`No rating score found in response for tweet ${tweetId}. Content:`, content);
                            resolve({ score: 5, content: "No rating score found in response", error: true });
                        }
                    } catch (error) {
                        console.error(`Error parsing response for tweet ${tweetId}:`, error, result.response.responseText);
                        resolve({ score: 5, content: "Error parsing response", error: true });
                    }
                }
            });
        }
        attemptRating(attempt);
    });
}

async function getImageDescription(urls, apiKey, tweetId, userHandle) {
    if (!urls || urls.length === 0) return '';

    // Check if image descriptions are disabled
    if (!enableImageDescriptions) {
        return '[Image descriptions disabled]';
    }

    let imageDescriptions = ""
    // Add image URLs to the request
    for (let i = 0; i < urls.length; i++) {
        try {
            const requestBody = {
                model: selectedImageModel,
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: "Describe what you see in this image in a concise way, focusing on the main elements and any text visible. Keep the description under 100 words."
                            },
                            {
                                type: "image_url",
                                image_url: urls[i]
                            }
                        ]
                    }
                ],
                temperature: imageModelTemperature,
                top_p: imageModelTopP,
                max_tokens: maxTokens
            };
            // Add provider sorting
            const sortOrder = GM_getValue('modelSortOrder', 'throughput-high-to-low');
            const sortType = sortOrder.split('-')[0]; // Extract sort type (price, throughput, latency)
            requestBody.provider = {
                sort: sortType,
                allow_fallbacks: true
            };
            const imageDescription = await new Promise((resolve) => {
                GM.xmlHttpRequest({
                    method: "POST",
                    url: 'https://openrouter.ai/api/v1/chat/completions',
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                        'Content-Type': 'application/json',
                    },
                    data: JSON.stringify(requestBody),
                    onload: function (response) {
                        try {
                            if (response.status === 200) {
                                const data = JSON.parse(response.responseText);
                                if (data && data.choices && data.choices.length > 0 && data.choices[0].message) {
                                    resolve(data.choices[0].message.content || "[No description available]");
                                } else {
                                    console.error("Invalid response structure from image API:", data);
                                    resolve("[Error: Invalid API response structure]");
                                }
                            } else {
                                console.error("Error fetching image description:", response.status, response.statusText);
                                resolve(`[Error fetching image description: ${response.status}]`);
                            }
                        } catch (error) {
                            console.error("Exception while processing image API response:", error);
                            resolve("[Error processing image description]");
                        }
                    },
                    onerror: function (error) {
                        console.error("Network error while fetching image description:", error);
                        resolve("[Error: Network problem while fetching image description]");
                    },
                    ontimeout: function () {
                        console.error("Timeout while fetching image description");
                        resolve("[Error: Timeout while fetching image description]");
                    }
                });
            });

            // Add the description to our aggregate with proper formatting
            imageDescriptions += `[IMAGE ${i + 1}]: ${imageDescription}\n`;
        } catch (error) {
            console.error(`Error getting description for image:`, error);
            return "[Error getting description]\n";
        }
    }
    return imageDescriptions;
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

    // Get the current sort order from storage or use default
    const sortOrder = GM_getValue('modelSortOrder', 'throughput-high-to-low');

    GM_xmlhttpRequest({
        method: "GET",
        url: `https://openrouter.ai/api/frontend/models/find?order=${sortOrder}`,
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "HTTP-Referer": "https://twitter.com",
            "X-Title": "Tweet Rating Tool"
        },
        onload: function (response) {
            if (response.status >= 200 && response.status < 300) {
                try {
                    const data = JSON.parse(response.responseText);
                    if (data.data && data.data.models) {
                        availableModels = data.data.models || [];
                        console.log(`Fetched ${availableModels.length} models from OpenRouter`);

                        // After fetching models, update any UI that depends on them
                        refreshModelsUI();
                        showStatus(`Loaded ${availableModels.length} models!`);
                    } else {
                        console.error('Unexpected data format from OpenRouter API:', data);
                        showStatus('Error: Unexpected data format from API');
                    }
                } catch (error) {
                    console.error('Error parsing model list:', error);
                    showStatus('Error loading models!');
                }
            } else {
                console.error(`Failed to fetch models: ${response.status}`);
                showStatus('Error fetching models!');
            }
        },
        onerror: function (error) {
            console.error('Error fetching models:', error);
            showStatus('Failed to fetch models!');
        }
    });
}

