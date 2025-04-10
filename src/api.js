// ==Module==
// @name         TweetFilter AI - API Module
// @namespace    http://tampermonkey.net/
// @version      Version 1.2.3r2
// @description  API communication functions for TweetFilter AI
// @author       Obsxrver(3than)
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      openrouter.ai
// @require      https://raw.githubusercontent.com/obsxrver/TweetFilter-AI/dev/src/config.js
// @license      MIT
// ==/Module==

// ----- API Functions -----

function GM_POST(request_data, request_timeout, apiKey) {
    return new Promise((resolve) => {
        GM_xmlhttpRequest({
            method: "POST",
            url: "https://openrouter.ai/api/v1/chat/completions", // request_url
            headers: { // request_headers
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`,
                    "HTTP-Referer": "https://greasyfork.org/en/scripts/532182-twitter-x-ai-tweet-filter", // Using the referer from the initial attempt
                    "X-Title": "Tweet Rating Tool"
            },
            data: JSON.stringify(request_data),
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
async function rateTweetWithOpenRouter(tweetText, tweetId, apiKey, mediaUrls, attempt = 1, maxAttempts = 3) {
    let result = {error: true, content: "", score: 5};
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

    if (mediaUrls && mediaUrls.length > 0) {
        if (modelSupportsImages(selectedModel)) {
            for (const url of mediaUrls) {
                messages[0].content.push({
                    "type": "image_url",
                    "image_url": { "url": url }
                });
            }
        } 
    } 
    const requestBody = {
        model: selectedModel,
        messages: messages,
        temperature: modelTemperature,
        top_p: modelTopP,
        max_tokens: maxTokens
    };
    const sortOrder = GM_getValue('modelSortOrder', 'throughput-high-to-low');
    const sortType = sortOrder.split('-')[0]; 
    requestBody.provider = {
        sort: sortType,
        allow_fallbacks: true
    };
    async function attemptRating(requestBody) {
        // Rate limit: wait if needed between API calls
        const now = Date.now();
        const timeElapsed = now - lastAPICallTime;
        
        if (timeElapsed < API_CALL_DELAY_MS) {
            await new Promise(resolve => setTimeout(resolve, API_CALL_DELAY_MS - timeElapsed));
        }
        
        lastAPICallTime = Date.now();
        pendingRequests++;
        showStatus(`Rating tweet... (${pendingRequests} pending)`);
        GM_POST(requestBody, 30000, apiKey).then(result => {
            pendingRequests--;
            showStatus(`Rating tweet... (${pendingRequests} pending)`); 

            if (result.error) {
                const shouldRetry = (result.message === "Request timed out" || (result.response && (result.response.status === 429 || result.response.status >= 500)));

                if (shouldRetry && attempt < maxAttempts) {
                    const backoffDelay = Math.pow(2, attempt) * 1000;
                    console.log(`Attempt ${attempt}/${maxAttempts} failed (${result}). Retrying in ${backoffDelay}ms...`);
                    setTimeout(() => { attemptRating(attempt + 1); }, backoffDelay);
                } else {
                    console.error('API Request Failed. Details:', result);
                    result = { score: 5, content: `API error: ${result.message || 'Unknown error'}`, error: true };
                }
            } else {
                // Handle successful response (status 200-299)
                try {
                    const data = JSON.parse(result.response.responseText);
                    const content = data.choices?.[0]?.message?.content;
                    
                    if (!content) {
                        console.error(`No content in OpenRouter response from ${selectedModel} for tweet ${tweetId}. Response:`, data);
                             
                        result = { score: 5, content: "No content in OpenRouter response. Please check for rate limits or token quotas.", error: true };
                        return;
                    }

                    const scoreMatch = content.match(/\SCORE_(\d+)/);
                    if (scoreMatch) {
                        const score = parseInt(scoreMatch[1], 10);
                        tweetIDRatingCache[tweetId] = { tweetContent: tweetText, score: score, description: content };
                        saveTweetRatings();
                        result = { score: score, content: content, error: false };
                    } else {
                        console.error(`No rating score found in response for tweet ${tweetId}. Content:`, content);
                        result = { score: 5, content: "No rating score found in response", error: true };
                    }
                } catch (error) {
                    console.error(`Error parsing response for tweet ${tweetId}:`, error, result.response.responseText);
                    result = { score: 5, content: "Error parsing response", error: true };
                }
            }
        });
    };

    // Make attempts up to MAX_RETRIES
    let currentAttempt = 0;
    while (result.error && currentAttempt < MAX_RETRIES) {
        currentAttempt++;
        result = await attemptRating(requestBody);
    }

    return result;
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
                 // Use GM_POST for the API call
                 GM_POST(requestBody, 30000, apiKey) // Pass request body and timeout
                 .then(result => {
                      // Handle successful response (200-299)
                      if (!result.error && result.response.status >= 200 && result.response.status < 300) {
                          try {
                              const data = JSON.parse(result.response.responseText);
                              if (data && data.choices && data.choices.length > 0 && data.choices[0].message) {
                                  resolve(data.choices[0].message.content || "[No description available]");
                              } else {
                                  console.error("Invalid response structure from image API:", data);
                                  resolve("[Error: Invalid API response structure]");
                              }
                          } catch (error) {
                              console.error("Exception while processing image API response:", error, result.response.responseText);
                              resolve("[Error processing image description]");
                          }
                      } else {
                          // Handle API errors (non-2xx status) or GM_POST internal errors
                          console.error("Error fetching image description:", result.message, `Status: ${result.response?.status}`, result.response?.responseText);
                          resolve(`[Error fetching image description: ${result.message || result.response?.status || 'Unknown Error'}]`);
                      }
                 })
                 .catch(error => {
                      // Handle network errors or unexpected issues in GM_POST itself
                      console.error("Network error or unexpected issue while fetching image description:", error);
                      resolve("[Error: Network problem or unexpected issue while fetching image description]");
                 });
            });
            imageDescriptions += `[IMAGE ${i + 1}]: ${imageDescription}\n`;
        } catch (error) {
            console.error(`Error processing image URL ${urls[i]}:`, error);
            imageDescriptions += `[IMAGE ${i + 1}]: [Error processing image]\n`;
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

