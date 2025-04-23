// Background Service Worker for TweetFilter AI

// Service Worker Installation
chrome.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === 'install') {
        // First time installation
        await chrome.storage.local.set({
            isEnabled: true,
            lastUpdate: Date.now(),
            version: chrome.runtime.getManifest().version
        });
    } else if (details.reason === 'update') {
        // Handle version updates
        const currentVersion = chrome.runtime.getManifest().version;
        console.log(`Updated from ${details.previousVersion} to ${currentVersion}`);
        
        // Perform any necessary data migrations here
        await migrateDataIfNeeded(details.previousVersion, currentVersion);
    }
});

// Service Worker Activation
chrome.runtime.onStartup.addListener(() => {
    console.log('Extension started');
    // Perform any necessary initialization
    initializeExtension();
});

async function migrateDataIfNeeded(oldVersion, newVersion) {
    // Add migration logic here if needed
    console.log(`Migrating data from ${oldVersion} to ${newVersion}`);
}

async function initializeExtension() {
    // Add any necessary initialization logic
    console.log('Initializing extension');
}

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'getCompletion') {
        handleCompletionRequest(request.data, request.apiKey)
            .then(sendResponse)
            .catch(error => sendResponse({ error: true, message: error.message }));
        return true; // Will respond asynchronously
    }
    
    if (request.type === 'getCompletionStreaming') {
        handleStreamingRequest(request.data, request.apiKey, sender.tab.id, request.tweetId);
        return false; // No response needed, will use port for streaming
    }
    
    if (request.type === 'fetchModels') {
        fetchAvailableModels(request.apiKey)
            .then(sendResponse)
            .catch(error => sendResponse({ error: true, message: error.message }));
        return true;
    }
    
    if (request.type === 'getImageDescription') {
        getImageDescription(request.urls, request.apiKey, request.tweetId, request.userHandle)
            .then(sendResponse)
            .catch(error => sendResponse({ error: true, message: error.message }));
        return true;
    }
});

// Handle streaming connections
chrome.runtime.onConnect.addListener((port) => {
    if (port.name === 'streamingCompletion') {
        port.onMessage.addListener((msg) => {
            if (msg.type === 'abort') {
                // Handle abort request
                if (activeStreams[msg.tweetId]) {
                    activeStreams[msg.tweetId].controller.abort();
                    delete activeStreams[msg.tweetId];
                }
            }
        });
        
        port.onDisconnect.addListener(() => {
            // Cleanup any active streams for this port
            Object.keys(activeStreams).forEach(tweetId => {
                if (activeStreams[tweetId].port === port) {
                    activeStreams[tweetId].controller.abort();
                    delete activeStreams[tweetId];
                }
            });
        });
    }
});

// Track active streaming requests
const activeStreams = {};

async function handleCompletionRequest(request, apiKey, timeout = 30000) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
                "HTTP-Referer": "https://github.com/elebumm/TweetFilter-AI",
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
        
        if (!data.choices?.[0]?.message?.content || data.choices[0].message.content === "") {
            return {
                error: true,
                message: `No content returned${data.choices[0].finish_reason==="safety"?" (SAFETY FILTER)":""}`,
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

function handleStreamingRequest(request, apiKey, tabId, tweetId) {
    const port = chrome.tabs.connect(tabId, { name: 'streamingResponse' });
    const controller = new AbortController();
    
    // Store stream info for potential abort
    activeStreams[tweetId] = { controller, port };
    
    // Add stream parameter to request
    const streamingRequest = {
        ...request,
        stream: true
    };

    fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
            "HTTP-Referer": "https://github.com/elebumm/TweetFilter-AI",
            "X-Title": "TweetFilter-AI"
        },
        body: JSON.stringify(streamingRequest),
        signal: controller.signal
    })
    .then(response => {
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return response.body.getReader();
    })
    .then(reader => processStream(reader, port, tweetId))
    .catch(error => {
        port.postMessage({
            type: 'error',
            error: error.message,
            tweetId: tweetId
        });
        delete activeStreams[tweetId];
    });
}

async function processStream(reader, port, tweetId) {
    let content = "";
    let reasoning = "";
    
    try {
        while (true) {
            const { done, value } = await reader.read();
            
            if (done) break;
            
            const chunk = new TextDecoder().decode(value);
            const lines = chunk.split("\n");
            
            for (const line of lines) {
                if (line.startsWith("data: ")) {
                    const data = line.substring(6);
                    
                    if (data === "[DONE]") break;
                    
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.choices?.[0]?.delta) {
                            const delta = parsed.choices[0].delta;
                            
                            if (delta.content !== undefined) {
                                content += delta.content;
                            }
                            if (delta.reasoning !== undefined) {
                                reasoning += delta.reasoning;
                            }
                            
                            port.postMessage({
                                type: 'chunk',
                                content,
                                reasoning,
                                delta,
                                tweetId
                            });
                        }
                    } catch (error) {
                        console.error("Error parsing stream data:", error);
                    }
                }
            }
        }
        
        port.postMessage({
            type: 'complete',
            content,
            reasoning,
            tweetId
        });
    } catch (error) {
        port.postMessage({
            type: 'error',
            error: error.message,
            tweetId
        });
    } finally {
        delete activeStreams[tweetId];
    }
}

async function fetchAvailableModels(apiKey) {
    try {
        const response = await fetch("https://openrouter.ai/api/v1/models", {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "HTTP-Referer": "https://github.com/elebumm/TweetFilter-AI",
                "X-Title": "TweetFilter-AI"
            }
        });

        if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}`);
        }

        const data = await response.json();
        return {
            error: false,
            message: "Models fetched successfully",
            data: data
        };
    } catch (error) {
        return {
            error: true,
            message: `Failed to fetch models: ${error.message}`,
            data: null
        };
    }
}

async function getImageDescription(urls, apiKey, tweetId, userHandle) {
    try {
        const imagePrompts = urls.map(url => ({
            role: "user",
            content: [
                { type: "text", text: "What's in this image? Describe it briefly in one sentence." },
                { type: "image_url", url }
            ]
        }));

        const responses = await Promise.all(imagePrompts.map(async (prompt) => {
            const request = {
                model: "gpt-4-vision-preview",
                messages: [prompt],
                max_tokens: 100
            };

            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`,
                    "HTTP-Referer": "https://github.com/elebumm/TweetFilter-AI",
                    "X-Title": "TweetFilter-AI"
                },
                body: JSON.stringify(request)
            });

            if (!response.ok) {
                throw new Error(`Image description request failed: ${response.status}`);
            }

            const data = await response.json();
            return data.choices[0].message.content;
        }));

        return {
            error: false,
            descriptions: responses
        };
    } catch (error) {
        return {
            error: true,
            message: error.message
        };
    }
} 