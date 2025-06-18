//src/ratingEngine.js
/**
 * Applies filtering to a single tweet by replacing its contents with a minimal placeholder.
 * Also updates the rating indicator.
 * @param {Element} tweetArticle - The tweet element.
 */
function filterSingleTweet(tweetArticle) {
    const cell = tweetArticle.closest('div[data-testid="cellInnerDiv"]');

    if (!cell) {
        console.warn("Couldn't find cellInnerDiv for tweet");
        return;
    }

    const handles = getUserHandles(tweetArticle);
    const authorHandle = handles.length > 0 ? handles[0] : '';
    const isAuthorActuallyBlacklisted = authorHandle && isUserBlacklisted(authorHandle);

    // Always store tweet data in dataset regardless of filtering
    const tweetText = getElementText(tweetArticle.querySelector(TWEET_TEXT_SELECTOR)) || '';
    const mediaUrls = extractMediaLinksSync(tweetArticle);
    const tid = getTweetID(tweetArticle);
    cell.dataset.tweetText = tweetText;
    cell.dataset.authorHandle = authorHandle;
    cell.dataset.mediaUrls = JSON.stringify(mediaUrls);
    cell.dataset.tweetId = tid;

    const cacheUpdateData = {
        authorHandle: authorHandle, // Ensure authorHandle is cached for fallback
        individualTweetText: tweetText,
        individualMediaUrls: mediaUrls, // Use the synchronously extracted mediaUrls
        timestamp: Date.now() // Update timestamp to reflect new data
    };
    tweetCache.set(tid, cacheUpdateData, false); // Use debounced save

    if (authorHandle && adAuthorCache.has(authorHandle)) {
        const tweetId = getTweetID(tweetArticle);
        if (tweetId) {
            ScoreIndicatorRegistry.get(tweetId)?.destroy();
        }
        cell.innerHTML = '';
        cell.dataset.filtered = 'true';
        cell.dataset.isAd = 'true';
        return;
    }

    const score = parseInt(tweetArticle.dataset.sloppinessScore || '9', 10);
    const tweetId = getTweetID(tweetArticle);
    const indicatorInstance = ScoreIndicatorRegistry.get(tweetId, tweetArticle);

    indicatorInstance?.ensureIndicatorAttached();
    const currentFilterThreshold = parseInt(browserGet('filterThreshold', '1'));
    const ratingStatus = tweetArticle.dataset.ratingStatus;

    if (indicatorInstance) {
        indicatorInstance.isAuthorBlacklisted = isAuthorActuallyBlacklisted;
    }

    if (isAuthorActuallyBlacklisted) {
        delete cell.dataset.filtered;
        cell.dataset.authorBlacklisted = 'true';
        if (indicatorInstance) {
            indicatorInstance._updateIndicatorUI();
        }
    } else {
        delete cell.dataset.authorBlacklisted;
        if (ratingStatus === 'pending' || ratingStatus === 'streaming') {
            delete cell.dataset.filtered;
        } else if (isNaN(score) || score < currentFilterThreshold) {
            const existingInstanceToDestroy = ScoreIndicatorRegistry.get(tweetId, tweetArticle);
            if (existingInstanceToDestroy) {
                existingInstanceToDestroy.destroy();
            }
            cell.innerHTML = '';
            cell.dataset.filtered = 'true';
        } else {
            delete cell.dataset.filtered;
            if (indicatorInstance) {
                indicatorInstance._updateIndicatorUI();
            }
        }
    }
}


/**
 * Applies a cached rating (if available) to a tweet article.
 * Also sets the rating status to 'rated' and updates the indicator.
 * @param {Element} tweetArticle - The tweet element.
 * @returns {boolean} True if a cached rating was applied.
 */
async function applyTweetCachedRating(tweetArticle) {
    const tweetId = getTweetID(tweetArticle);
    const handles = getUserHandles(tweetArticle);
    const userHandle = handles.length > 0 ? handles[0] : '';

    // Check cache for rating
    const cachedRating = tweetCache.get(tweetId);
    if (cachedRating) {
        // Skip incomplete streaming entries that don't have a score yet
        if (cachedRating.streaming === true &&
            (cachedRating.score === undefined || cachedRating.score === null)) {
            // console.log(`Skipping incomplete streaming cache for ${tweetId}`);
            return false;
        }

        // Ensure the score exists before applying it
        if (cachedRating.score !== undefined && cachedRating.score !== null) {
            // Update tweet article dataset properties - this is crucial for filterSingleTweet to work
            tweetArticle.dataset.sloppinessScore = cachedRating.score.toString();
            tweetArticle.dataset.ratingStatus = cachedRating.fromStorage ? 'cached' : 'rated';
            tweetArticle.dataset.ratingDescription = cachedRating.description || "not available";
            tweetArticle.dataset.ratingReasoning = cachedRating.reasoning || '';

            const indicatorInstance = ScoreIndicatorRegistry.get(tweetId, tweetArticle);
            if (indicatorInstance) {
                indicatorInstance.rehydrateFromCache(cachedRating);

            } else {
                console.warn(`[applyTweetCachedRating] Could not get/create ScoreIndicator for ${tweetId} to apply cached rating.`);
                return false; // Cannot apply if indicator doesn't exist
            }

            filterSingleTweet(tweetArticle);
            return true;
        } else if (!cachedRating.streaming) {
            // Invalid cache entry - missing score
            console.warn(`Invalid cache entry for tweet ${tweetId}: missing score`);
            tweetCache.delete(tweetId);
            return false;
        }
    }

    return false;
}

// ----- UI Helper Functions -----


/**
 * Checks if a given user handle is in the blacklist.
 * @param {string} handle - The Twitter handle.
 * @returns {boolean} True if blacklisted, false otherwise.
 */
function isUserBlacklisted(handle) {
    if (!handle) return false;
    handle = handle.toLowerCase().trim();
    return blacklistedHandles.some(h => h.toLowerCase().trim() === handle);
}

// Add near the top with other globals
const VALID_FINAL_STATES = ['rated', 'cached', 'blacklisted', 'manual'];
const VALID_INTERIM_STATES = ['pending', 'streaming'];

// Add near other global variables
const getFullContextPromises = new Map();

function isValidFinalState(status) {
    return VALID_FINAL_STATES.includes(status);
}

function isValidInterimState(status) {
    return VALID_INTERIM_STATES.includes(status);
}

async function delayedProcessTweet(tweetArticle, tweetId, authorHandle) {
    let processingSuccessful = false;
    try {
        const apiKey = browserGet('openrouter-api-key', '');
        if (!apiKey) {
            // Just set a default state and stop - no point retrying without an API key
            tweetArticle.dataset.ratingStatus = 'error';
            tweetArticle.dataset.ratingDescription = "No API key";
            ScoreIndicatorRegistry.get(tweetId, tweetArticle)?.update({
                status: 'error',
                score: 9,
                description: "No API key",
                questions: [],
                lastAnswer: ""
            });
            filterSingleTweet(tweetArticle);
            // Don't remove from processedTweets - we don't want to reprocess until they add a key and refresh
            return;
        }

        // Check if this is from a known ad author
        if (authorHandle && adAuthorCache.has(authorHandle)) {
            tweetArticle.dataset.ratingStatus = 'rated';
            tweetArticle.dataset.ratingDescription = "Advertisement";
            tweetArticle.dataset.sloppinessScore = '0';
            ScoreIndicatorRegistry.get(tweetId, tweetArticle)?.update({
                status: 'rated',
                score: 0,
                description: "Advertisement from known ad author",
                questions: [],
                lastAnswer: ""
            });
            filterSingleTweet(tweetArticle);
            processingSuccessful = true;
            return;
        }

        // Check if this is an ad
        if (isAd(tweetArticle)) {
            if (authorHandle) {
                adAuthorCache.add(authorHandle);
            }
            tweetArticle.dataset.ratingStatus = 'rated';
            tweetArticle.dataset.ratingDescription = "Advertisement";
            tweetArticle.dataset.sloppinessScore = '0';
            ScoreIndicatorRegistry.get(tweetId, tweetArticle)?.update({
                status: 'rated',
                score: 0,
                description: "Advertisement",
                questions: [],
                lastAnswer: ""
            });
            filterSingleTweet(tweetArticle);
            processingSuccessful = true;
            return;
        }

        let score = 5; // Default score if rating fails
        let description = "";
        let reasoning = "";
        let questions = []; // Initialize questions
        let lastAnswer = ""; // Initialize lastAnswer

        try {
            const cachedRating = tweetCache.get(tweetId);
            if (cachedRating) {
                // Handle incomplete streaming entries specifically
                if (cachedRating.streaming === true &&
                    (cachedRating.score === undefined || cachedRating.score === null)) {
                    console.log(`Tweet ${tweetId} has incomplete streaming cache entry, continuing with processing`);
                }
                else if (!cachedRating.streaming && (cachedRating.score === undefined || cachedRating.score === null)) {
                    // Invalid cache entry (non-streaming but missing score), delete it
                    console.warn(`Invalid cache entry for tweet ${tweetId}, removing from cache`, cachedRating);
                    tweetCache.delete(tweetId);
                }
            }

            const fullContextWithImageDescription = await getFullContext(tweetArticle, tweetId, apiKey);
            if (!fullContextWithImageDescription) {
                throw new Error("Failed to get tweet context");
            }
            let mediaURLs = [];

            // Add thread relationship context only if is conversation
            if (document.querySelector('div[aria-label="Timeline: Conversation"]')) {
                const replyInfo = getTweetReplyInfo(tweetId);
                if (replyInfo && replyInfo.replyTo) {
                    // Add thread context to cache entry if we process this tweet
                    if (!tweetCache.has(tweetId)) {
                        tweetCache.set(tweetId, {});
                    }

                    if (!tweetCache.get(tweetId).threadContext) {
                        tweetCache.get(tweetId).threadContext = {
                            replyTo: replyInfo.to,
                            replyToId: replyInfo.replyTo,
                            isRoot: false
                        };
                    }
                }
            }
            // Get all media URLs from any section in one go
            const mediaMatches1 = fullContextWithImageDescription.matchAll(/(?:\[MEDIA_URLS\]:\s*\n)(.*?)(?:\n|$)/g);
            const mediaMatches2 = fullContextWithImageDescription.matchAll(/(?:\[QUOTED_TWEET_MEDIA_URLS\]:\s*\n)(.*?)(?:\n|$)/g);

            for (const match of mediaMatches1) {
                if (match[1]) {
                    mediaURLs.push(...match[1].split(', ').filter(url => url.trim()));
                }
            }
            for (const match of mediaMatches2) {
                if (match[1]) {
                    mediaURLs.push(...match[1].split(', ').filter(url => url.trim()));
                }
            }
            // Remove duplicates and empty URLs
            mediaURLs = [...new Set(mediaURLs.filter(url => url.trim()))];

            // ---- Start of new check for media extraction failure ----
            const hasPotentialImageContainers = tweetArticle.querySelector('div[data-testid="tweetPhoto"], div[data-testid="videoPlayer"]'); // Check for photo or video containers
            const imageDescriptionsEnabled = browserGet('enableImageDescriptions', false);

            if (hasPotentialImageContainers && mediaURLs.length === 0 && (imageDescriptionsEnabled || modelSupportsImages(selectedModel))) {
                // Heuristic: If image/video containers are in the DOM, but we extracted no media URLs,
                // and either image descriptions are on OR the model supports images (meaning URLs are important),
                // then it's likely an extraction failure.
                const warningMessage = `Tweet ${tweetId}: Potential media containers found in DOM, but no media URLs were extracted by getFullContext. Forcing error for retry.`;
                console.warn(warningMessage);
                // Throw an error that will be caught by the generic catch block below,
                // which will set the status to 'error' and trigger the retry mechanism.
                throw new Error("Media URLs not extracted despite presence of media containers.");
            }
            // ---- End of new check ----

            // --- API Call or Fallback ---
            if (fullContextWithImageDescription) {
                try {
                    // Check if there's already a complete entry in the cache before calling the API
                    // This handles cases where cache appeared/completed *after* scheduling
                    const currentCache = tweetCache.get(tweetId); // Re-fetch fresh cache state
                    const isCached = currentCache &&
                        !currentCache.streaming &&
                        currentCache.score !== undefined &&
                        currentCache.score !== null;

                    if (isCached) {
                        // Use cached data instead of calling API
                        score = currentCache.score;
                        description = currentCache.description || "";
                        reasoning = currentCache.reasoning || "";
                        questions = currentCache.questions || []; // Get questions from cache
                        lastAnswer = currentCache.lastAnswer || ""; // Get answer from cache
                        const mediaUrls = currentCache.mediaUrls || []; // Get mediaUrls from cache
                        processingSuccessful = true;
                        console.log(`Using valid cache entry found for ${tweetId} before API call.`);

                        // Update UI using cached data
                        ScoreIndicatorRegistry.get(tweetId, tweetArticle)?.update({
                            status: currentCache.fromStorage ? 'cached' : 'rated',
                            score: score,
                            description: description,
                            reasoning: reasoning,
                            questions: questions,
                            lastAnswer: lastAnswer,
                            metadata: currentCache.metadata || null,
                            mediaUrls: mediaUrls // Pass mediaUrls to indicator
                        });
                        filterSingleTweet(tweetArticle);
                        return; // Exit after using cache
                    }

                    // If not cached, proceed with API call
                    // rateTweetWithOpenRouter now returns questions as well
                    const rating = await rateTweetWithOpenRouter(fullContextWithImageDescription, tweetId, apiKey, mediaURLs, 3, tweetArticle, authorHandle);
                    score = rating.score;
                    description = rating.content;
                    reasoning = rating.reasoning || '';
                    questions = rating.questions || []; // Get questions from API result
                    lastAnswer = ""; // Reset lastAnswer on new rating

                    // Determine status based on cache/error state
                    let finalStatus = rating.error ? 'error' : 'rated';
                    if (!rating.error) {
                        const cacheEntry = tweetCache.get(tweetId);
                        if (cacheEntry && cacheEntry.fromStorage) {
                            finalStatus = 'cached';
                        } else if (rating.cached) {
                            finalStatus = 'cached';
                        }
                    }

                    // Update tweet dataset
                    tweetArticle.dataset.ratingStatus = finalStatus;
                    tweetArticle.dataset.ratingDescription = description || "not available";
                    tweetArticle.dataset.sloppinessScore = score?.toString() || '';
                    tweetArticle.dataset.ratingReasoning = reasoning;
                    // Optionally store questions/answer in dataset if needed
                    // tweetArticle.dataset.ratingQuestions = JSON.stringify(questions);
                    // tweetArticle.dataset.ratingLastAnswer = lastAnswer;

                    // Update UI via ScoreIndicator
                    ScoreIndicatorRegistry.get(tweetId, tweetArticle)?.update({
                        status: finalStatus,
                        score: score,
                        description: description,
                        reasoning: reasoning,
                        questions: questions,
                        lastAnswer: lastAnswer,
                        metadata: rating.data?.id ? { generationId: rating.data.id } : null, // Pass metadata
                        mediaUrls: mediaURLs // Pass mediaUrls to indicator
                    });

                    processingSuccessful = !rating.error;

                    // Cache is already updated by rateTweetWithOpenRouter, no need to duplicate here
                    // We rely on rateTweetWithOpenRouter (or its sub-functions) to set the cache correctly,
                    // including score, description, reasoning, questions, lastAnswer, metadata ID etc.

                    filterSingleTweet(tweetArticle);
                    return; // Return after API call attempt

                } catch (apiError) {
                    console.error(`API error processing tweet ${tweetId}:`, apiError);
                    score = 5; // Fallback score on API error
                    description = `API Error: ${apiError.message}`;
                    reasoning = '';
                    questions = []; // Clear questions on error
                    lastAnswer = ''; // Clear answer on error
                    processingSuccessful = false;

                    // Update UI to reflect API error state
                    ScoreIndicatorRegistry.get(tweetId, tweetArticle)?.update({
                        status: 'error',
                        score: score,
                        description: description,
                        questions: [],
                        lastAnswer: ""
                    });

                    // Update cache error state
                    const errorCacheEntry = tweetCache.get(tweetId) || {}; // Get existing
                    const errorUpdate = {
                        ...errorCacheEntry, // Preserve existing fields like fullContext
                        score: score, // Fallback score
                        description: description, // Error message
                        reasoning: reasoning,
                        questions: questions,
                        lastAnswer: lastAnswer,
                        streaming: false,
                        // error: true, // Consider standardizing 'error' field in TweetCache if used extensively
                        timestamp: Date.now() // Update timestamp
                    };
                    tweetCache.set(tweetId, errorUpdate, true); // Original used immediate save, retain for errors.

                    filterSingleTweet(tweetArticle);
                    return; // Return after API error handling
                }
            }
            filterSingleTweet(tweetArticle);

        } catch (error) {
            console.error(`Generic error processing tweet ${tweetId}: ${error}`, error.stack);

            if (error.message === "Media URLs not extracted despite presence of media containers.") {
                if (tweetCache.has(tweetId)) {
                    tweetCache.delete(tweetId);
                    console.log(`[delayedProcessTweet] Deleted cache for ${tweetId} due to media extraction failure.`);
                }
            }

            // Ensure some error state is shown if processing fails unexpectedly
            ScoreIndicatorRegistry.get(tweetId, tweetArticle)?.update({
                status: 'error',
                score: 5,
                description: "Error during processing: " + error.message,
                questions: [],
                lastAnswer: ""
            });
            filterSingleTweet(tweetArticle); // Apply filtering even on generic error
            processingSuccessful = false;
        } finally {
            if (!processingSuccessful) {
                processedTweets.delete(tweetId);
            }
        }
    } catch (error) {
        console.error(`Error processing tweet ${tweetId}:`, error);
        const indicatorInstance = ScoreIndicatorRegistry.get(tweetId);
        if (indicatorInstance) {
            indicatorInstance.update({
                status: 'error',
                score: 5,
                description: "Error during processing: " + error.message,
                questions: [],
                lastAnswer: ""
            });
        }
        filterSingleTweet(tweetArticle);
        processingSuccessful = false;
    } finally {
        // Always clean up the processed state if we didn't succeed
        if (!processingSuccessful) {
            processedTweets.delete(tweetId);
            // Check if we need to retry
            const indicatorInstance = ScoreIndicatorRegistry.get(tweetId);
            if (indicatorInstance && !isValidFinalState(indicatorInstance.status)) {
                console.log(`Tweet ${tweetId} processing failed, will retry later`);
                setTimeout(() => {
                    if (!isValidFinalState(ScoreIndicatorRegistry.get(tweetId)?.status)) {
                        scheduleTweetProcessing(tweetArticle);
                    }
                }, PROCESSING_DELAY_MS * 2);
            }
        }
    }
}

// Add near the top with other global variables
const MAPPING_INCOMPLETE_TWEETS = new Set();

// Modify scheduleTweetProcessing to check for incomplete mapping
async function scheduleTweetProcessing(tweetArticle, rateAnyway = false) {
    // First, ensure the tweet has a valid ID
    const tweetId = getTweetID(tweetArticle);
    if (!tweetId) {
        return;
    }

    // Check if there's already an active streaming request
    if (window.activeStreamingRequests && window.activeStreamingRequests[tweetId]) {
        console.log(`Tweet ${tweetId} has an active streaming request, skipping processing`);
        return;
    }

    // Get the author handle
    const handles = getUserHandles(tweetArticle);
    const authorHandle = handles.length > 0 ? handles[0] : '';

    // Check if this is from a known ad author
    if (authorHandle && adAuthorCache.has(authorHandle)) {
        filterSingleTweet(tweetArticle); // This will hide it
        return;
    }

    // Check if this is an ad
    if (isAd(tweetArticle)) {
        if (authorHandle) {
            adAuthorCache.add(authorHandle);
        }
        filterSingleTweet(tweetArticle); // This will hide it
        return;
    }

    const existingInstance = ScoreIndicatorRegistry.get(tweetId);
    if (existingInstance) {
        existingInstance.ensureIndicatorAttached();

        // If we have a valid final state, just filter and return
        if (isValidFinalState(existingInstance.status)) {
            filterSingleTweet(tweetArticle);
            return;
        }

        // If we're in a valid interim state and marked as processed, keep waiting
        if (isValidInterimState(existingInstance.status) && processedTweets.has(tweetId)) {
            filterSingleTweet(tweetArticle);
            return;
        }

        // If we get here, we either have an error state or invalid state
        // Remove from processed set to allow reprocessing
        processedTweets.delete(tweetId);
    }

    // Check if we're in a conversation view
    const conversation = document.querySelector('div[aria-label="Timeline: Conversation"]') ||
        document.querySelector('div[aria-label^="Timeline: Conversation"]');

    if (conversation) {
        // If we're in a conversation and mapping is not complete, mark this tweet for later processing
        if (!conversation.dataset.threadMapping) {
            console.log(`[scheduleTweetProcessing] Tweet ${tweetId} waiting for thread mapping`);
            MAPPING_INCOMPLETE_TWEETS.add(tweetId);
            const indicatorInstance = ScoreIndicatorRegistry.get(tweetId, tweetArticle);
            if (indicatorInstance) {
                indicatorInstance.update({
                    status: 'pending',
                    score: null,
                    description: 'Waiting for thread context...',
                    questions: [],
                    lastAnswer: ""
                });
            }
            return;
        }

        // If we have thread mapping, check if this tweet is in it
        try {
            const mapping = JSON.parse(conversation.dataset.threadMapping);
            const tweetMapping = mapping.find(m => m.tweetId === tweetId);
            if (!tweetMapping) {
                console.log(`[scheduleTweetProcessing] Tweet ${tweetId} not found in thread mapping, waiting`);
                MAPPING_INCOMPLETE_TWEETS.add(tweetId);
                const indicatorInstance = ScoreIndicatorRegistry.get(tweetId, tweetArticle);
                if (indicatorInstance) {
                    indicatorInstance.update({
                        status: 'pending',
                        score: null,
                        description: 'Waiting for thread context...',
                        questions: [],
                        lastAnswer: ""
                    });
                }
                return;
            }
        } catch (e) {
            console.error("Error parsing thread mapping:", e);
        }
    }

    // Check for a cached rating, but be careful with streaming cache entries
    if (tweetCache.has(tweetId)) {
        // Only apply cached rating if it has a valid score and isn't an incomplete streaming entry
        const isIncompleteStreaming =
            tweetCache.get(tweetId).streaming === true &&
            (tweetCache.get(tweetId).score === undefined || tweetCache.get(tweetId).score === null);

        if (!isIncompleteStreaming) {
            const wasApplied = await applyTweetCachedRating(tweetArticle);
            if (wasApplied) {
                return;
            }
        }
    }

    // Skip if already being processed in this session
    if (processedTweets.has(tweetId)) {
        const instance = ScoreIndicatorRegistry.get(tweetId);
        if (instance) {
            instance.ensureIndicatorAttached();
            if (instance.status === 'pending' || instance.status === 'streaming') {
                filterSingleTweet(tweetArticle);
                return;
            }
        }
        // If we get here, the tweet is marked as processed but doesn't have a valid state
        // Remove it from processed set to allow reprocessing
        processedTweets.delete(tweetId);
    }

    // Immediately mark as pending before scheduling actual processing
    const indicatorInstance = ScoreIndicatorRegistry.get(tweetId, tweetArticle);
    if (indicatorInstance) {
        if (indicatorInstance.status !== 'blacklisted' &&
            indicatorInstance.status !== 'cached' &&
            indicatorInstance.status !== 'rated') {
            indicatorInstance.update({ status: 'pending', score: null, description: 'Rating scheduled...', questions: [], lastAnswer: "" });
        } else {
            // If already in a final state, ensure it's attached and filtered
            indicatorInstance.ensureIndicatorAttached();
            filterSingleTweet(tweetArticle);
            return;
        }
    } else {
        console.error(`Failed to get/create indicator instance for tweet ${tweetId} during scheduling.`);
    }

    // Add to processed set *after* successfully getting/creating instance
    if (!processedTweets.has(tweetId)) {
        processedTweets.add(tweetId);
    }

    // Now schedule the actual rating processing
    setTimeout(() => {
        try {
            // Check if auto-rating is enabled, unless we're forcing a manual rate
            if (!browserGet('enableAutoRating', true) && !rateAnyway) {
                // If auto-rating is disabled, set status to manual instead of processing
                const indicatorInstance = ScoreIndicatorRegistry.get(tweetId, tweetArticle);
                if (indicatorInstance) {
                    indicatorInstance.update({
                        status: 'manual',
                        score: null,
                        description: 'Click the Rate button to rate this tweet',
                        reasoning: '',
                        questions: [],
                        lastAnswer: ""
                    });
                    filterSingleTweet(tweetArticle);
                }
                return;
            }

            delayedProcessTweet(tweetArticle, tweetId, authorHandle);
        } catch (e) {
            console.error(`Error in delayed processing of tweet ${tweetId}:`, e);
            processedTweets.delete(tweetId);
        }
    }, PROCESSING_DELAY_MS);
}

// Add this near the beginning of the file with other global variables
// Store reply relationships across sessions
let threadRelationships = {};
const THREAD_CHECK_INTERVAL = 500; // Reduce from 2500ms to 500ms
const SWEEP_INTERVAL = 500; // Check for unrated tweets twice as often
const THREAD_MAPPING_TIMEOUT = 1000; // Reduce from 5000ms to 1000ms
let threadMappingInProgress = false; // Add a memory-based flag for more reliable state tracking

// Load thread relationships from storage on script initialization
function loadThreadRelationships() {
    try {
        const savedRelationships = browserGet('threadRelationships', '{}');
        threadRelationships = JSON.parse(savedRelationships);
        console.log(`Loaded ${Object.keys(threadRelationships).length} thread relationships`);
    } catch (e) {
        console.error('Error loading thread relationships:', e);
        threadRelationships = {};
    }
}

// Save thread relationships to persistent storage
function saveThreadRelationships() {
    try {
        // Limit size to prevent storage issues
        const relationshipCount = Object.keys(threadRelationships).length;
        if (relationshipCount > 1000) {
            // If over 1000, keep only the most recent 500
            const entries = Object.entries(threadRelationships);
            // Sort by timestamp if available, otherwise keep newest entries by default key order
            entries.sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0));
            const recent = entries.slice(0, 500);
            threadRelationships = Object.fromEntries(recent);
        }

        browserSet('threadRelationships', JSON.stringify(threadRelationships));
    } catch (e) {
        console.error('Error saving thread relationships:', e);
    }
}

// Initialize thread relationships on load
loadThreadRelationships();

// Add this function to build a complete chain of replies
async function buildReplyChain(tweetId, maxDepth = 10) {
    if (!tweetId || maxDepth <= 0) return [];

    // Start with empty chain
    const chain = [];

    // Current tweet ID to process
    let currentId = tweetId;
    let depth = 0;

    // Traverse up the chain recursively
    while (currentId && depth < maxDepth) {
        const replyInfo = threadRelationships[currentId];
        if (!replyInfo || !replyInfo.replyTo) break;

        // Add this link in the chain
        chain.push({
            fromId: currentId,
            toId: replyInfo.replyTo,
            from: replyInfo.from,
            to: replyInfo.to
        });

        // Move up the chain
        currentId = replyInfo.replyTo;
        depth++;
    }

    return chain;
}

/**
 * Extracts the full context of a tweet article and returns a formatted string.
 *
 * Schema:
 * [TWEET]:
 * @[the author of the tweet]
 * [the text of the tweet]
 * [MEDIA_DESCRIPTION]:
 * [IMAGE 1]: [description], [IMAGE 2]: [description], etc.
 * [QUOTED_TWEET]:
 * [the text of the quoted tweet]
 * [QUOTED_TWEET_MEDIA_DESCRIPTION]:
 * [IMAGE 1]: [description], [IMAGE 2]: [description], etc.
 *
 * @param {Element} tweetArticle - The tweet article element.
 * @param {string} tweetId - The tweet's ID.
 * @param {string} apiKey - API key used for getting image descriptions.
 * @returns {Promise<string>} - The full context string.
 */
async function getFullContext(tweetArticle, tweetId, apiKey) {
    if (getFullContextPromises.has(tweetId)) {
        // console.log(`[getFullContext] Waiting for existing promise for ${tweetId}`);
        return getFullContextPromises.get(tweetId);
    }

    const contextPromise = (async () => {
        try {
            // --- Original getFullContext logic starts here ---
            const handles = getUserHandles(tweetArticle);

            const userHandle = handles.length > 0 ? handles[0] : '';
            const quotedHandle = handles.length > 1 ? handles[1] : '';
            // --- Extract Main Tweet Content ---
            const mainText = getElementText(tweetArticle.querySelector(TWEET_TEXT_SELECTOR));

            let allMediaLinks = await extractMediaLinks(tweetArticle);

            // --- Extract Quoted Tweet Content (if any) ---
            let quotedText = "";
            let quotedMediaLinks = [];
            let quotedTweetId = null;

            const quoteContainer = tweetArticle.querySelector(QUOTE_CONTAINER_SELECTOR);
            if (quoteContainer) {
                const quotedLink = quoteContainer.querySelector('a[href*="/status/"]');
                if (quotedLink) {
                    const href = quotedLink.getAttribute('href');
                    const match = href.match(/\/status\/(\d+)/);
                    if (match && match[1]) {
                        quotedTweetId = match[1];
                    }
                }

                quotedText = getElementText(quoteContainer.querySelector(TWEET_TEXT_SELECTOR)) || "";
                quotedMediaLinks = await extractMediaLinks(quoteContainer);
            }

            const conversation = document.querySelector('div[aria-label="Timeline: Conversation"]') ||
                document.querySelector('div[aria-label^="Timeline: Conversation"]');

            let threadMediaUrls = [];
            if (conversation && conversation.dataset.threadMapping && tweetCache.has(tweetId) && tweetCache.get(tweetId).threadContext?.threadMediaUrls) {
                threadMediaUrls = tweetCache.get(tweetId).threadContext.threadMediaUrls || [];
            } else if (conversation && conversation.dataset.threadMediaUrls) {
                try {
                    const allMediaUrls = JSON.parse(conversation.dataset.threadMediaUrls);
                    threadMediaUrls = Array.isArray(allMediaUrls) ? allMediaUrls : [];
                } catch (e) {
                    console.error("Error parsing thread media URLs:", e);
                }
            }

            let allAvailableMediaLinks = [...(allMediaLinks || [])];
            let mainMediaLinks = allAvailableMediaLinks.filter(link => !quotedMediaLinks.includes(link));

            let engagementStats = "";
            const engagementDiv = tweetArticle.querySelector('div[role="group"][aria-label$=" views"]');
            if (engagementDiv) {
                engagementStats = engagementDiv.getAttribute('aria-label')?.trim() || "";
            }

            let fullContextWithImageDescription = `[TWEET ${tweetId}]
 Author:@${userHandle}:
` + mainText;

            if (mainMediaLinks.length > 0) {
                if (browserGet('enableImageDescriptions', false)) { // Re-check enableImageDescriptions, as it might have changed
                    let mainMediaLinksDescription = await getImageDescription(mainMediaLinks, apiKey, tweetId, userHandle);
                    fullContextWithImageDescription += `
[MEDIA_DESCRIPTION]:
${mainMediaLinksDescription}`;
                }
                fullContextWithImageDescription += `
[MEDIA_URLS]:
${mainMediaLinks.join(", ")}`;
            }

            if (engagementStats) {
                fullContextWithImageDescription += `
[ENGAGEMENT_STATS]:
${engagementStats}`;
            }

            if (!isOriginalTweet(tweetArticle) && threadMediaUrls.length > 0) {
                const uniqueThreadMediaUrls = threadMediaUrls.filter(url =>
                    !mainMediaLinks.includes(url) && !quotedMediaLinks.includes(url));

                if (uniqueThreadMediaUrls.length > 0) {
                    fullContextWithImageDescription += `
[THREAD_MEDIA_URLS]:
${uniqueThreadMediaUrls.join(", ")}`;
                }
            }

            if (quotedText || quotedMediaLinks.length > 0) {
                fullContextWithImageDescription += `
[QUOTED_TWEET${quotedTweetId ? ' ' + quotedTweetId : ''}]:
 Author:@${quotedHandle}:
${quotedText}`;
                if (quotedMediaLinks.length > 0) {
                    if (browserGet('enableImageDescriptions', false)) { // Re-check enableImageDescriptions
                        let quotedMediaLinksDescription = await getImageDescription(quotedMediaLinks, apiKey, tweetId, userHandle); // tweetId and userHandle are from main tweet for context
                        fullContextWithImageDescription += `
[QUOTED_TWEET_MEDIA_DESCRIPTION]:
${quotedMediaLinksDescription}`;
                    }
                    fullContextWithImageDescription += `
[QUOTED_TWEET_MEDIA_URLS]:
${quotedMediaLinks.join(", ")}`;
                }
            }

            // --- Thread/Reply Logic ---
            const conversationElement = document.querySelector('div[aria-label="Timeline: Conversation"], div[aria-label^="Timeline: Conversation"]');
            if (conversationElement) {
                const replyChain = await buildReplyChain(tweetId);
                let threadHistoryIncluded = false;

                if (conversationElement.dataset.threadHist) {
                    if (!isOriginalTweet(tweetArticle)) {
                        // Prepend thread history from conversation dataset
                        fullContextWithImageDescription = conversationElement.dataset.threadHist + `\n[REPLY]\n` + fullContextWithImageDescription;
                        threadHistoryIncluded = true;
                    }
                }

                if (replyChain.length > 0 && !threadHistoryIncluded) {
                    let parentContextsString = "";
                    for (let i = replyChain.length - 1; i >= 0; i--) { // Iterate from top-most parent downwards
                        const link = replyChain[i];
                        const parentId = link.toId;
                        const parentUser = link.to || 'unknown';
                        let currentParentContent = null;

                        const parentCacheEntry = tweetCache.get(parentId);

                        if (parentCacheEntry && parentCacheEntry.fullContext) {
                            currentParentContent = parentCacheEntry.fullContext;
                            // console.log(`[getFullContext] Parent ${parentId} (for ${tweetId}) context found in tweetCache.fullContext.`);
                        } else {
                            const parentArticleElement = Array.from(document.querySelectorAll(TWEET_ARTICLE_SELECTOR))
                                .find(el => getTweetID(el) === parentId);

                            if (parentArticleElement) {
                                // Check dataset as a fallback
                                if (parentArticleElement.dataset.fullContext) {
                                    currentParentContent = parentArticleElement.dataset.fullContext;
                                    // console.log(`[getFullContext] Parent ${parentId} (for ${tweetId}) context found in dataset.fullContext.`);

                                    // Update cache with this found context if cache didn't have it
                                    const entryToUpdate = tweetCache.get(parentId) || { timestamp: Date.now(), score: undefined };
                                    if (!entryToUpdate.fullContext) { // Only update if fullContext is missing
                                        entryToUpdate.fullContext = currentParentContent;
                                        tweetCache.set(parentId, entryToUpdate, false); // Debounced save
                                    }
                                } else {
                                    // console.log(`[getFullContext] Parent ${parentId} (for ${tweetId}) context not in cache/dataset, attempting to await its getFullContext.`);
                                    try {
                                        // Recursive call will populate cache for parentId via its own execution path
                                        currentParentContent = await getFullContext(parentArticleElement, parentId, apiKey);
                                        // console.log(`[getFullContext] Recursively called getFullContext for parent ${parentId}.`);
                                    } catch (e) {
                                        console.error(`[getFullContext] Error recursively getting context for parent ${parentId} (for ${tweetId}):`, e);
                                        // currentParentContent remains null
                                    }
                                }
                            }
                            // If parentArticleElement is not found (e.g., de-rendered and not in cache), currentParentContent remains null
                        }

                        if (currentParentContent) {
                            parentContextsString = parentContextsString + currentParentContent + "\n[REPLY]\n";
                        } else {
                            parentContextsString = parentContextsString + `[CONTEXT UNAVAILABLE FOR TWEET ${parentId} @${parentUser}]\n[REPLY]\n`;
                        }
                    }
                    fullContextWithImageDescription = parentContextsString + fullContextWithImageDescription;
                }

                const replyInfo = getTweetReplyInfo(tweetId);
                if (replyInfo && replyInfo.replyTo && !threadHistoryIncluded && replyChain.length === 0) {
                    fullContextWithImageDescription = `[REPLY TO TWEET ${replyInfo.replyTo}]\n` + fullContextWithImageDescription;
                }
            }
            // --- End of Thread/Reply Logic ---

            tweetArticle.dataset.fullContext = fullContextWithImageDescription;

            // Store/update fullContext in tweetCache
            const existingCacheEntryForCurrentTweet = tweetCache.get(tweetId) || {};
            const updatedCacheEntry = {
                ...existingCacheEntryForCurrentTweet, // Preserve other fields
                fullContext: fullContextWithImageDescription,
                timestamp: existingCacheEntryForCurrentTweet.timestamp || Date.now() // Update or set timestamp
            };
            // If it's a completely new entry, ensure 'score' isn't accidentally set to non-undefined
            // (it defaults to undefined in TweetCache if not provided, which is desired here)
            if (existingCacheEntryForCurrentTweet.score === undefined && updatedCacheEntry.score === null) {
                // This can happen if existingCacheEntryForCurrentTweet had score:null from a previous partial setup
                // We want it to be undefined if no actual score yet.
                updatedCacheEntry.score = undefined;
            }
            tweetCache.set(tweetId, updatedCacheEntry, false); // Use debounced save

            return fullContextWithImageDescription;
            // --- Original getFullContext logic ends here ---
        } finally {
            getFullContextPromises.delete(tweetId);
        }
    })();

    getFullContextPromises.set(tweetId, contextPromise);
    return contextPromise;
}


/**
 * Applies filtering to all tweets currently in the observed container.
 */
function applyFilteringToAll() {
    if (!observedTargetNode) return;
    const tweets = observedTargetNode.querySelectorAll(TWEET_ARTICLE_SELECTOR);
    tweets.forEach(filterSingleTweet);
}


function ensureAllTweetsRated() {
    if (document.querySelector('div[aria-label="Timeline: Conversation"]') || !browserGet('enableAutoRating',true)) {
        //this breaks thread handling logic, handlethreads calls scheduleTweetProcessing
        return;
    }
    if (!observedTargetNode) return;
    const tweets = observedTargetNode.querySelectorAll(TWEET_ARTICLE_SELECTOR);

    if (tweets.length > 0) {
        console.log(`Checking ${tweets.length} tweets to ensure all are rated...`);

        tweets.forEach(tweet => {
            const tweetId = getTweetID(tweet);
            if (!tweetId) return;

            const indicatorInstance = ScoreIndicatorRegistry.get(tweetId);
            const needsProcessing = !indicatorInstance ||
                !indicatorInstance.status ||
                indicatorInstance.status === 'error' ||
                (!isValidFinalState(indicatorInstance.status) && !isValidInterimState(indicatorInstance.status)) ||
                (processedTweets.has(tweetId) && !isValidFinalState(indicatorInstance.status) && !isValidInterimState(indicatorInstance.status));

            if (needsProcessing) {
                if (processedTweets.has(tweetId)) {
                    console.log(`Tweet ${tweetId} marked as processed but in invalid state: ${indicatorInstance?.status}`);
                    processedTweets.delete(tweetId);
                }
                scheduleTweetProcessing(tweet);
            } else if (indicatorInstance && !isValidInterimState(indicatorInstance.status)) {
                filterSingleTweet(tweet);
            }
        });
    }
}

async function handleThreads() {
    try {
        // Find the conversation timeline using a more specific selector
        let conversation = document.querySelector('div[aria-label="Timeline: Conversation"]');
        if (!conversation) {
            conversation = document.querySelector('div[aria-label^="Timeline: Conversation"]');
        }

        if (!conversation) return;

        // If mapping is already in progress by another call, skip
        if (threadMappingInProgress || conversation.dataset.threadMappingInProgress === "true") {
            // console.log("[handleThreads] Skipping, mapping already in progress.");
            return;
        }

        // Check if a mapping was completed very recently
        const lastMappedTimestamp = parseInt(conversation.dataset.threadMappedAt || '0', 10);
        const MAPPING_COOLDOWN_MS = 1000; // 1 second cooldown
        if (Date.now() - lastMappedTimestamp < MAPPING_COOLDOWN_MS) {
            // console.log(`[handleThreads] Skipping, last map was too recent (${Date.now() - lastMappedTimestamp}ms ago).`);
            return;
        }

        // Extract the tweet ID from the URL
        const match = location.pathname.match(/status\/(\d+)/);
        const pageTweetId = match ? match[1] : null;
        if (!pageTweetId) return;

        // Determine the actual root tweet ID by climbing persistent threadRelationships
        let rootTweetId = pageTweetId;
        while (threadRelationships[rootTweetId] && threadRelationships[rootTweetId].replyTo) {
            rootTweetId = threadRelationships[rootTweetId].replyTo;
        }

        // Run the mapping immediately
        await mapThreadStructure(conversation, rootTweetId);

    } catch (error) {
        console.error("Error in handleThreads:", error);
        threadMappingInProgress = false;
    }
}

// Modify mapThreadStructure to trigger processing of waiting tweets
async function mapThreadStructure(conversation, localRootTweetId) {
    // If already in progress, don't start another one
    if (threadMappingInProgress || conversation.dataset.threadMappingInProgress) {
        return;
    }

    // Mark mapping in progress to prevent duplicate processing
    conversation.dataset.threadMappingInProgress = "true";
    threadMappingInProgress = true; // Set memory-based flag

    try {
        // Use a timeout promise to prevent hanging
        const timeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Thread mapping timed out')), THREAD_MAPPING_TIMEOUT)
        );

        // The actual mapping function
        const mapping = async () => {
            // Get the tweet ID from the URL
            const urlMatch = location.pathname.match(/status\/(\d+)/);
            const urlTweetId = urlMatch ? urlMatch[1] : null;
            //console.log("[mapThreadStructure] URL Tweet ID:", urlTweetId);

            // Process all visible tweets using the cellInnerDiv structure for improved mapping
            // Use a more specific selector to ensure we get ALL cells in the conversation
            let cellDivs = Array.from(conversation.querySelectorAll('div[data-testid="cellInnerDiv"]'));
            //console.log("[mapThreadStructure] Found cellDivs:", cellDivs.length);

            if (!cellDivs.length) {
                console.log("No cell divs found, thread mapping aborted");
                delete conversation.dataset.threadMappingInProgress;
                threadMappingInProgress = false;
                return;
            }

            // Debug log each cell's position and tweet ID
            cellDivs.forEach((cell, idx) => {
                const tweetId = cell.dataset.tweetId;
                const authorHandle = cell.dataset.authorHandle;
                //console.log(`[mapThreadStructure] Cell ${idx}: TweetID=${tweetId}, Author=${authorHandle}, Y=${cell.style.transform}`);
            });

            // Sort cells by their vertical position to ensure correct order
            cellDivs.sort((a, b) => {
                const aY = parseInt(a.style.transform.match(/translateY\((\d+)/)?.[1] || '0');
                const bY = parseInt(b.style.transform.match(/translateY\((\d+)/)?.[1] || '0');
                return aY - bY;
            });

            // Debug log sorted positions
            cellDivs.forEach((cell, idx) => {
                const tweetId = cell.dataset.tweetId;
                const authorHandle = cell.dataset.authorHandle;
                //console.log(`[mapThreadStructure] Sorted Cell ${idx}: TweetID=${tweetId}, Author=${authorHandle}, Y=${cell.style.transform}`);
            });

            let tweetCells = [];
            let processedCount = 0;
            let urlTweetCellIndex = -1; // Index in tweetCells array

            // First pass: collect all tweet data and identify separators
            for (let idx = 0; idx < cellDivs.length; idx++) {
                const cell = cellDivs[idx];
                let tweetId, username, text, mediaLinks = [], quotedMediaLinks = [];
                let article = cell.querySelector('article[data-testid="tweet"]');

                if (article) { // Try to get data from article first
                    tweetId = getTweetID(article);
                    if (!tweetId) {
                        let tweetLink = article.querySelector('a[href*="/status/"]');
                        if (tweetLink) {
                            let match = tweetLink.href.match(/status\/(\d+)/);
                            if (match) tweetId = match[1];
                        }
                    }
                    const handles = getUserHandles(article);
                    username = handles.length > 0 ? handles[0] : null;
                    let tweetTextSpan = article.querySelector('[data-testid="tweetText"]');
                    text = tweetTextSpan ? tweetTextSpan.innerText.trim().replace(/\n+/g, ' ⏎ ') : '';
                    mediaLinks = await extractMediaLinks(article);
                    const quoteContainer = article.querySelector(QUOTE_CONTAINER_SELECTOR);
                    if (quoteContainer) {
                        quotedMediaLinks = await extractMediaLinks(quoteContainer);
                    }
                }

                // Fallback to cell dataset if article data is insufficient
                if (!tweetId && cell.dataset.tweetId) {
                    tweetId = cell.dataset.tweetId;
                }
                if (!username && cell.dataset.authorHandle) {
                    username = cell.dataset.authorHandle;
                }
                if (!text && cell.dataset.tweetText) {
                    text = cell.dataset.tweetText || '';
                }
                if ((!mediaLinks || !mediaLinks.length) && cell.dataset.mediaUrls) {
                    try {
                        mediaLinks = JSON.parse(cell.dataset.mediaUrls);
                    } catch (e) {
                        //console.warn("[mapThreadStructure] Error parsing mediaUrls from dataset:", e, cell.dataset.mediaUrls);
                        mediaLinks = [];
                    }
                }

                // Classify as 'tweet' or 'separator'
                if (tweetId && username) { // Essential data for a tweet
                    const currentCellItem = {
                        type: 'tweet',
                        tweetNode: article,
                        username,
                        tweetId,
                        text,
                        mediaLinks,
                        quotedMediaLinks,
                        cellIndex: idx,
                        cellDiv: cell,
                        index: processedCount // This index will be for actual tweets in tweetCells later
                    };
                    tweetCells.push(currentCellItem);

                    if (tweetId === urlTweetId) {
                        //console.log(`[mapThreadStructure] Found URL tweet at cellDiv index ${idx}, tweetCells index ${tweetCells.length - 1}`);
                        urlTweetCellIndex = tweetCells.length - 1; // Store index within tweetCells
                    }
                    processedCount++; // Increment only for tweets

                    // Schedule processing for this tweet if not already processed
                    if (article && !processedTweets.has(tweetId)) {
                        scheduleTweetProcessing(article);
                    }
                } else {
                    tweetCells.push({
                        type: 'separator',
                        cellDiv: cell,
                        cellIndex: idx,
                    });
                    //console.log(`[mapThreadStructure] Cell ${idx} classified as separator.`);
                }
            }

            // Debug log collected items (tweets and separators)
            //console.log("[mapThreadStructure] Collected items (tweets and separators):", tweetCells.map(t => ({ type: t.type, id: t.tweetId, user: t.username, cellIdx: t.cellIndex })));
            //console.log("[mapThreadStructure] URL tweet cell index in tweetCells:", urlTweetCellIndex);
            const urlTweetObject = urlTweetCellIndex !== -1 ? tweetCells[urlTweetCellIndex] : null;

            let effectiveUrlTweetInfo = null;
            if (urlTweetObject) {
                effectiveUrlTweetInfo = {
                    tweetId: urlTweetObject.tweetId,
                    username: urlTweetObject.username
                };
                //console.log("[mapThreadStructure] URL Tweet Object found in DOM:", effectiveUrlTweetInfo);
            } else if (urlTweetId) { // If not in DOM, try cache
                const cachedUrlTweet = tweetCache.get(urlTweetId);
                if (cachedUrlTweet && cachedUrlTweet.authorHandle) {
                    effectiveUrlTweetInfo = {
                        tweetId: urlTweetId,
                        username: cachedUrlTweet.authorHandle
                    };
                    //console.log("[mapThreadStructure] URL Tweet Object not in DOM, using cached info:", effectiveUrlTweetInfo);
                } else {
                   // console.log(`[mapThreadStructure] URL Tweet Object for ${urlTweetId} not found in DOM and no sufficient cache (missing authorHandle).`);
                }
            } else {
                //console.log("[mapThreadStructure] No URL Tweet ID available to begin with.");
            }

            // Build reply structure only if we have actual tweets to process
            const actualTweets = tweetCells.filter(tc => tc.type === 'tweet');
            if (actualTweets.length === 0) {
                console.log("No valid tweets found, thread mapping aborted");
                delete conversation.dataset.threadMappingInProgress;
                threadMappingInProgress = false;
                return;
            }

            // Second pass: build the reply structure based on new logic
            for (let i = 0; i < tweetCells.length; ++i) {
                let currentItem = tweetCells[i];

                if (currentItem.type === 'separator') {
                    //console.log(`[mapThreadStructure] Skipping separator at index ${i}`);
                    continue;
                }

                // currentItem is a tweet here
                //console.log(`[mapThreadStructure] Processing tweet ${currentItem.tweetId} at tweetCells index ${i}`);

                if (i === 0) { // First item in the list
                    currentItem.replyTo = null;
                    currentItem.replyToId = null;
                    currentItem.isRoot = true;
                    //console.log(`[mapThreadStructure] Tweet ${currentItem.tweetId} is root (first item).`);
                } else {
                    const previousItem = tweetCells[i - 1];
                    if (previousItem.type === 'separator') {
                        if (effectiveUrlTweetInfo && currentItem.tweetId !== effectiveUrlTweetInfo.tweetId) {
                            currentItem.replyTo = effectiveUrlTweetInfo.username;
                            currentItem.replyToId = effectiveUrlTweetInfo.tweetId;
                            currentItem.isRoot = false;
                            //console.log(`[mapThreadStructure] Tweet ${currentItem.tweetId} replies to URL tweet ${effectiveUrlTweetInfo.tweetId} (after separator).`);
                        } else if (effectiveUrlTweetInfo && currentItem.tweetId === effectiveUrlTweetInfo.tweetId) {
                            // Current tweet is the URL tweet AND it's after a separator. It becomes a root.
                            currentItem.replyTo = null;
                            currentItem.replyToId = null;
                            currentItem.isRoot = true;
                           // console.log(`[mapThreadStructure] Tweet ${currentItem.tweetId} (URL tweet ${effectiveUrlTweetInfo.tweetId}) is root (after separator).`);
                        } else {
                            // No URL tweet or current is URL tweet - becomes a root of a new segment.
                            currentItem.replyTo = null;
                            currentItem.replyToId = null;
                            currentItem.isRoot = true;
                          //  console.log(`[mapThreadStructure] Tweet ${currentItem.tweetId} is root (after separator, no/is URL tweet or no effective URL tweet info).`);
                        }
                    } else if (previousItem.type === 'tweet') {
                        currentItem.replyTo = previousItem.username;
                        currentItem.replyToId = previousItem.tweetId;
                        currentItem.isRoot = false;
                        //console.log(`[mapThreadStructure] Tweet ${currentItem.tweetId} replies to previous tweet ${previousItem.tweetId}.`);
                    } else {
                        // Should not happen if previousItem is always defined and typed
                        //console.warn(`[mapThreadStructure] Tweet ${currentItem.tweetId} has unexpected previous item type:`, previousItem);
                        currentItem.replyTo = null;
                        currentItem.replyToId = null;
                        currentItem.isRoot = true;
                    }
                }
            }

            // Create replyDocs from actual tweets
            const replyDocs = tweetCells
                .filter(tc => tc.type === 'tweet')
                .map(tw => ({
                    from: tw.username,
                    tweetId: tw.tweetId,
                    to: tw.replyTo,
                    toId: tw.replyToId,
                    isRoot: tw.isRoot === true,
                    text: tw.text,
                    mediaLinks: tw.mediaLinks || [],
                    quotedMediaLinks: tw.quotedMediaLinks || []
                }));

            // Debug log final mapping
            /*console.log("[mapThreadStructure] Final reply mapping:", replyDocs.map(d => ({
                from: d.from,
                tweetId: d.tweetId,
                replyTo: d.to,
                replyToId: d.toId,
                isRoot: d.isRoot
            })));*/

            // Store the thread mapping in a dataset attribute for debugging
            conversation.dataset.threadMapping = JSON.stringify(replyDocs);

            // Process any tweets that were waiting for mapping
            for (const waitingTweetId of MAPPING_INCOMPLETE_TWEETS) {
                const mappedTweet = replyDocs.find(doc => doc.tweetId === waitingTweetId);
                if (mappedTweet) {
                    //console.log(`[mapThreadStructure] Processing previously waiting tweet ${waitingTweetId}`);
                    const tweetArticle = tweetCells.find(tc => tc.tweetId === waitingTweetId)?.tweetNode;
                    if (tweetArticle) {
                        processedTweets.delete(waitingTweetId);
                        scheduleTweetProcessing(tweetArticle);
                    }
                }
            }
            MAPPING_INCOMPLETE_TWEETS.clear();

            // Update the global thread relationships
            const timestamp = Date.now();
            replyDocs.forEach(doc => {
                if (doc.tweetId && doc.toId) {
                    threadRelationships[doc.tweetId] = {
                        replyTo: doc.toId,
                        from: doc.from,
                        to: doc.to,
                        isRoot: false,
                        timestamp
                    };
                } else if (doc.tweetId && doc.isRoot) {
                    threadRelationships[doc.tweetId] = {
                        replyTo: null,
                        from: doc.from,
                        isRoot: true,
                        timestamp
                    };
                }
            });

            // Save relationships to persistent storage
            saveThreadRelationships();

            // Update the cache with thread context
            const batchSize = 10;
            for (let i = 0; i < replyDocs.length; i += batchSize) {
                const batch = replyDocs.slice(i, i + batchSize);
                batch.forEach(doc => {
                    if (doc.tweetId && tweetCache.has(doc.tweetId)) {
                        tweetCache.get(doc.tweetId).threadContext = {
                            replyTo: doc.to,
                            replyToId: doc.toId,
                            isRoot: doc.isRoot,
                            threadMediaUrls: doc.isRoot ? [] : getAllPreviousMediaUrls(doc.tweetId, replyDocs)
                        };

                        // If this was just mapped, force reprocessing to use improved context
                        if (doc.tweetId && processedTweets.has(doc.tweetId)) {
                            // Find the corresponding tweet article from our collected tweet cells
                            const tweetCell = tweetCells.find(tc => tc.tweetId === doc.tweetId);
                            if (tweetCell && tweetCell.tweetNode) {
                                // Don't reprocess if the tweet is currently streaming
                                const isStreaming = tweetCell.tweetNode.dataset.ratingStatus === 'streaming' ||
                                    (tweetCache.has(doc.tweetId) && tweetCache.get(doc.tweetId).streaming === true);

                                if (!isStreaming) {
                                    processedTweets.delete(doc.tweetId);
                                    scheduleTweetProcessing(tweetCell.tweetNode);
                                }
                            }
                        }
                    }
                });

                // Yield to main thread every batch to avoid locking UI
                if (i + batchSize < replyDocs.length) {
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
            }

            // Mark mapping as complete
            delete conversation.dataset.threadMappingInProgress;
            threadMappingInProgress = false;
            conversation.dataset.threadMappedAt = Date.now().toString(); // Update timestamp on successful completion
            // console.log(`[mapThreadStructure] Successfully completed and set threadMappedAt to ${conversation.dataset.threadMappedAt}`);
        };

        // Helper function to get all media URLs from tweets that came before the current one in the thread
        function getAllPreviousMediaUrls(tweetId, replyDocs) {
            const allMediaUrls = [];
            const index = replyDocs.findIndex(doc => doc.tweetId === tweetId);

            if (index > 0) {
                for (let i = 0; i < index; i++) {
                    if (replyDocs[i].mediaLinks && replyDocs[i].mediaLinks.length) {
                        allMediaUrls.push(...replyDocs[i].mediaLinks);
                    }
                    if (replyDocs[i].quotedMediaLinks && replyDocs[i].quotedMediaLinks.length) {
                        allMediaUrls.push(...replyDocs[i].quotedMediaLinks);
                    }
                }
            }

            return allMediaUrls;
        }

        // Race the mapping against the timeout
        await Promise.race([mapping(), timeout]);

    } catch (error) {
        console.error("Error in mapThreadStructure:", error);
        // Clear the mapped timestamp and in-progress flag so we can try again later
        delete conversation.dataset.threadMappingInProgress;
        threadMappingInProgress = false;
        // console.error("[mapThreadStructure] Error, not updating threadMappedAt.");
    }
}

// For use in getFullContext to check if a tweet is a reply using persistent relationships
function getTweetReplyInfo(tweetId) {
    if (threadRelationships[tweetId]) {
        return threadRelationships[tweetId];
    }
    return null;
}

// At the end of the file
setInterval(handleThreads, THREAD_CHECK_INTERVAL);

setInterval(ensureAllTweetsRated, SWEEP_INTERVAL);

setInterval(applyFilteringToAll, SWEEP_INTERVAL);
