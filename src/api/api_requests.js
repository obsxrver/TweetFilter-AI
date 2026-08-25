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
            tweetProcessingState.decrementPending();
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

    function handleOnline() {
        showStatus('Back online. Fetching models...');
        fetchAvailableModels();
        window.removeEventListener('online', handleOnline);
        isOnlineListenerAttached = false;
    }

    GM_xmlhttpRequest({
        method: "GET",
        url: 'https://openrouter.ai/api/v1/models',
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "HTTP-Referer": "https://greasyfork.org/en/scripts/532182-twitter-x-ai-tweet-filter",
            "X-Title": "Tweet Rating Tool"
        },
        onload: function (response) {
            try {
                const data = JSON.parse(response.responseText);
                if (Array.isArray(data.data)) {
                    let filteredModels = data.data.filter(model => model && (model.id || model.canonical_slug));

                    filteredModels.forEach(model => {
                        model.slug = model.canonical_slug || model.id;
                    });

                    filteredModels.sort((a, b) => (Number(b.created) || 0) - (Number(a.created) || 0));
                    availableModels = filteredModels || [];
                    const imageCapableModelIds = [...new Set(availableModels
                        .filter(modelHasImageInput)
                        .flatMap(getModelIdentifierCandidates)
                        .filter(Boolean))];
                    browserSet('imageCapableModelIds', imageCapableModelIds);
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
 * Normalizes Twitter image URLs before sending them to a model.
 * @param {string} url
 * @returns {string}
 */
function stripImageUrlNameParam(url) {
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
        return url;
    }

    try {
        const parsedUrl = new URL(url);
        if (parsedUrl.hostname.toLowerCase() === 'pbs.twimg.com' && parsedUrl.pathname.includes('/amplify_video_thumb/')) {
            const formatParam = Array.from(parsedUrl.searchParams.entries())
                .find(([key]) => key.toLowerCase() === 'format');
            const format = formatParam?.[1]?.toLowerCase();
            if (format && /^[a-z0-9]+$/.test(format)) {
                if (!parsedUrl.pathname.toLowerCase().endsWith(`.${format}`)) {
                    parsedUrl.pathname += `.${format}`;
                }
                parsedUrl.searchParams.delete(formatParam[0]);
            }
        }
        for (const key of Array.from(parsedUrl.searchParams.keys())) {
            if (key.toLowerCase() === 'name') {
                parsedUrl.searchParams.delete(key);
            }
        }
        return parsedUrl.toString();
    } catch (error) {
        return url;
    }
}

/**
 * Infers an image MIME type when the response does not provide a useful one.
 * @param {string} url
 * @returns {string}
 */
function inferImageMimeType(url) {
    try {
        const parsedUrl = new URL(url);
        const format = parsedUrl.searchParams.get('format');
        const extension = (format || parsedUrl.pathname.split('.').pop() || '').toLowerCase();
        const mimeTypes = {
            avif: 'image/avif',
            gif: 'image/gif',
            jpeg: 'image/jpeg',
            jpg: 'image/jpeg',
            png: 'image/png',
            webp: 'image/webp'
        };
        return mimeTypes[extension] || '';
    } catch (error) {
        return '';
    }
}

/**
 * Downloads an image and returns a Base64 data URL suitable for model input.
 * Existing data URLs pass through unchanged.
 * @param {string} url
 * @returns {Promise<string>}
 */
async function encodeImageUrlAsDataUrl(url) {
    if (typeof url !== 'string') {
        throw new Error('Image URL must be a string.');
    }
    if (/^data:image\//i.test(url)) {
        return url;
    }
    if (!/^https?:\/\//i.test(url)) {
        throw new Error('Only HTTP(S) image URLs can be encoded.');
    }

    const normalizedUrl = stripImageUrlNameParam(url);
    return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
            method: 'GET',
            url: normalizedUrl,
            responseType: 'blob',
            timeout: 30000,
            anonymous: true,
            onload: (response) => {
                if (response.status < 200 || response.status >= 300) {
                    reject(new Error(`Image download failed with status ${response.status}.`));
                    return;
                }

                const headerMatch = response.responseHeaders?.match(/^content-type:\s*([^;\r\n]+)/im);
                const responseMimeType = response.response?.type || headerMatch?.[1]?.trim() || '';
                const mimeType = responseMimeType.toLowerCase().startsWith('image/')
                    ? responseMimeType
                    : inferImageMimeType(normalizedUrl);
                if (!mimeType || !response.response) {
                    reject(new Error('Downloaded resource is not a recognized image.'));
                    return;
                }

                const imageBlob = response.response.type === mimeType
                    ? response.response
                    : new Blob([response.response], { type: mimeType });
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => reject(new Error('Failed to encode the downloaded image.'));
                reader.readAsDataURL(imageBlob);
            },
            onerror: () => reject(new Error('Image download failed.')),
            ontimeout: () => reject(new Error('Image download timed out.'))
        });
    });
}

/**
 * Encodes remote image URLs while preserving data URLs and input order.
 * Images that cannot be downloaded are omitted instead of leaking their links
 * into model requests.
 * @param {string[]} urls
 * @returns {Promise<string[]>}
 */
async function encodeImageUrlsAsDataUrls(urls) {
    const encodedUrls = await Promise.all((urls || []).map(async (url) => {
        if (typeof url === 'string' && url.startsWith('data:application/pdf')) {
            return url;
        }
        try {
            return await encodeImageUrlAsDataUrl(url);
        } catch (error) {
            console.warn(`[Images] Skipping image that could not be Base64-encoded: ${error.message}`);
            return null;
        }
    }));
    return encodedUrls.filter(Boolean);
}

/**
 * Clones message content and Base64-encodes every remote image before an API call.
 * @param {object[]} messages
 * @returns {Promise<object[]>}
 */
async function encodeMessageImagesAsDataUrls(messages) {
    return Promise.all((messages || []).map(async (message) => {
        if (!Array.isArray(message.content)) {
            return { ...message };
        }

        const content = await Promise.all(message.content.map(async (item) => {
            const imageUrl = item?.type === 'image_url' ? item.image_url?.url : null;
            if (!imageUrl || /^data:image\//i.test(imageUrl)) {
                return item;
            }
            try {
                const dataUrl = await encodeImageUrlAsDataUrl(imageUrl);
                return { ...item, image_url: { ...item.image_url, url: dataUrl } };
            } catch (error) {
                console.warn(`[Images] Removing image that could not be Base64-encoded: ${error.message}`);
                return null;
            }
        }));

        return { ...message, content: content.filter(Boolean) };
    }));
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
        let modelImageUrl;
        try {
            modelImageUrl = await encodeImageUrlAsDataUrl(url);
        } catch (error) {
            console.warn(`[Images] Could not prepare image description input: ${error.message}`);
            descriptions.push('[Error loading image for description]');
            continue;
        }
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
                        image_url: { url: modelImageUrl }
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

