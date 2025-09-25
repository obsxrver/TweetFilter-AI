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

    const tweetText = getTweetText(tweetArticle) || '';
    const mediaUrls = extractMediaLinks(tweetArticle);
    const tid = getTweetID(tweetArticle);
    const cacheUpdateData = {
        authorHandle: authorHandle,
        individualTweetText: tweetText,
        individualMediaUrls: mediaUrls,
        timestamp: Date.now()
    };
    tweetCache.set(tid, cacheUpdateData, false);

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

    cell.dataset.tweetText = tweetText;
    cell.dataset.authorHandle = authorHandle;
    cell.dataset.mediaUrls = JSON.stringify(mediaUrls);
    cell.dataset.tweetId = tid;

    const score = parseInt(tweetArticle.dataset.slopScore || '9', 10);
    const tweetId = getTweetID(tweetArticle);
    const indicatorInstance = ScoreIndicatorRegistry.get(tweetId, tweetArticle);

    indicatorInstance?.ensureIndicatorAttached();
    const currentFilterThreshold = parseInt(browserGet('filterThreshold', '1'));
    const ratingStatus = tweetArticle.dataset.ratingStatus;

    if (indicatorInstance) {
        indicatorInstance.isAuthorBlacklisted = isUserBlacklisted(authorHandle);
    }

    if (isUserBlacklisted(authorHandle)) {
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
function applyTweetCachedRating(tweetArticle) {
    const tweetId = getTweetID(tweetArticle);

    const cachedRating = tweetCache.get(tweetId);
    if (cachedRating) {

        if (cachedRating.streaming === true &&
            (cachedRating.score === undefined || cachedRating.score === null)) {

            return false;
        }

        if (cachedRating.score !== undefined && cachedRating.score !== null) {

            tweetArticle.dataset.slopScore = cachedRating.score.toString();
            tweetArticle.dataset.ratingStatus = cachedRating.fromStorage ? 'cached' : 'rated';
            tweetArticle.dataset.ratingDescription = cachedRating.description || "not available";
            tweetArticle.dataset.ratingReasoning = cachedRating.reasoning || '';

            const indicatorInstance = ScoreIndicatorRegistry.get(tweetId, tweetArticle);
            if (indicatorInstance) {
                indicatorInstance.rehydrateFromCache(cachedRating);

            } else {
                console.warn(`[applyTweetCachedRating] Could not get/create ScoreIndicator for ${tweetId} to apply cached rating.`);
                return false;
            }
            filterSingleTweet(tweetArticle);
            return true;
        } else if (!cachedRating.streaming) {
            //cached object with score undefined or null, and not pending rating.
            tweetCache.delete(tweetId);
            return false;
        }
    }

    return false;
}

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

const VALID_FINAL_STATES = ['rated', 'cached', 'blacklisted', 'manual'];
const VALID_INTERIM_STATES = ['pending', 'streaming'];

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


        if (apiKey) {

            let score = 5;
            let description = "";
            let reasoning = "";
            let questions = [];
            let lastAnswer = "";
            try {
                const cachedRating = tweetCache.get(tweetId);
                if (cachedRating && !cachedRating.score && !cachedRating.streaming) {
                    console.warn(`Invalid cache entry for tweet ${tweetId}, removing from cache`, cachedRating);
                    tweetCache.delete(tweetId);
                }

                const fullContextWithImageDescription = await getFullContext(tweetArticle, tweetId, apiKey);
                if (!fullContextWithImageDescription) {
                    throw new Error("Failed to get tweet context");
                }
                let mediaURLs = [];

                if (document.querySelector('div[aria-label="Timeline: Conversation"]')) {
                    const replyInfo = getTweetReplyInfo(tweetId);
                    if (replyInfo && replyInfo.replyTo) {

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

                const mediaMatches1 = fullContextWithImageDescription.matchAll(/(?:\[MEDIA_URLS\]:\s*\n)(.*?)(?:\n|$)/g);
                const mediaMatches2 = fullContextWithImageDescription.matchAll(/(?:\[QUOTED_TWEET_MEDIA_URLS\]:\s*\n)(.*?)(?:\n|$)/g);
                const videoMatches1 = fullContextWithImageDescription.matchAll(/(?:\[VIDEO_DESCRIPTIONS\]:\s*\n)([\s\S]*?)(?:\n\[|$)/g);
                const videoMatches2 = fullContextWithImageDescription.matchAll(/(?:\[QUOTED_TWEET_VIDEO_DESCRIPTIONS\]:\s*\n)([\s\S]*?)(?:\n\[|$)/g);

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

                for (const match of videoMatches1) {
                    if (match[1]) {
                        const videoLines = match[1].trim().split('\n').filter(line => line.trim());
                        videoLines.forEach(line => {
                            if (line.startsWith('[VIDEO ')) {
                                const desc = line.replace(/^\[VIDEO \d+\]: /, '');
                                mediaURLs.push(`[VIDEO_DESCRIPTION]: ${desc}`);
                            }
                        });
                    }
                }
                for (const match of videoMatches2) {
                    if (match[1]) {
                        const videoLines = match[1].trim().split('\n').filter(line => line.trim());
                        videoLines.forEach(line => {
                            if (line.startsWith('[VIDEO ')) {
                                const desc = line.replace(/^\[VIDEO \d+\]: /, '');
                                mediaURLs.push(`[VIDEO_DESCRIPTION]: ${desc}`);
                            }
                        });
                    }
                }

                mediaURLs = [...new Set(mediaURLs.filter(item => item.trim()))];

                const hasPotentialImageContainers = tweetArticle.querySelector('div[data-testid="tweetPhoto"], div[data-testid="videoPlayer"]');
                const imageDescriptionsEnabled = browserGet('enableImageDescriptions', false);

                if (hasPotentialImageContainers && mediaURLs.length === 0 && (imageDescriptionsEnabled || modelSupportsImages(selectedModel))) {
                    console.warn(`Tweet ${tweetId}: Potential media containers found in DOM, but no media content (URLs or video descriptions) was extracted by getFullContext.`);
                }
                if (fullContextWithImageDescription) {
                    try {
                        const currentCache = tweetCache.get(tweetId);
                        const isCached = currentCache &&
                            !currentCache.streaming &&
                            currentCache.score !== undefined &&
                            currentCache.score !== null;

                        if (isCached) {

                            score = currentCache.score;
                            description = currentCache.description || "";
                            reasoning = currentCache.reasoning || "";
                            questions = currentCache.questions || [];
                            lastAnswer = currentCache.lastAnswer || "";
                            const mediaUrls = currentCache.mediaUrls || [];
                            processingSuccessful = true;
                            console.log(`Using valid cache entry found for ${tweetId} before API call.`);

                            ScoreIndicatorRegistry.get(tweetId, tweetArticle)?.update({
                                status: currentCache.fromStorage ? 'cached' : 'rated',
                                score: score,
                                description: description,
                                reasoning: reasoning,
                                questions: questions,
                                lastAnswer: lastAnswer,
                                metadata: currentCache.metadata || null,
                                mediaUrls: mediaUrls
                            });
                            filterSingleTweet(tweetArticle);
                            return;
                        }

                        const filteredMediaURLs = mediaURLs.filter(item => !item.startsWith('[VIDEO_DESCRIPTION]:'));

                        const rating = await rateTweetWithOpenRouter(fullContextWithImageDescription, tweetId, apiKey, filteredMediaURLs, 3, tweetArticle, authorHandle);
                        score = rating.score;
                        description = rating.content;
                        reasoning = rating.reasoning || '';
                        questions = rating.questions || [];
                        lastAnswer = "";

                        let finalStatus = rating.error ? 'error' : 'rated';
                        if (!rating.error) {
                            const cacheEntry = tweetCache.get(tweetId);
                            if (cacheEntry && cacheEntry.fromStorage) {
                                finalStatus = 'cached';
                            } else if (rating.cached) {
                                finalStatus = 'cached';
                            }
                        }

                        tweetArticle.dataset.ratingStatus = finalStatus;
                        tweetArticle.dataset.ratingDescription = description || "not available";
                        tweetArticle.dataset.slopScore = score?.toString() || '';
                        tweetArticle.dataset.ratingReasoning = reasoning;

                        ScoreIndicatorRegistry.get(tweetId, tweetArticle)?.update({
                            status: finalStatus,
                            score: score,
                            description: description,
                            reasoning: reasoning,
                            questions: questions,
                            lastAnswer: lastAnswer,
                            metadata: rating.data?.id ? { generationId: rating.data.id } : null,
                            mediaUrls: mediaURLs
                        });

                        processingSuccessful = !rating.error;

                        filterSingleTweet(tweetArticle);
                        return;

                    } catch (apiError) {
                        console.error(`API error processing tweet ${tweetId}:`, apiError);
                        score = 5;
                        description = `API Error: ${apiError.message}`;
                        reasoning = '';
                        questions = [];
                        lastAnswer = '';
                        processingSuccessful = false;

                        ScoreIndicatorRegistry.get(tweetId, tweetArticle)?.update({
                            status: 'error',
                            score: score,
                            description: description,
                            questions: [],
                            lastAnswer: ""
                        });

                        const errorCacheEntry = tweetCache.get(tweetId) || {};
                        const errorUpdate = {
                            ...errorCacheEntry,
                            score: score,
                            description: description,
                            reasoning: reasoning,
                            questions: questions,
                            lastAnswer: lastAnswer,
                            streaming: false,

                            timestamp: Date.now()
                        };
                        tweetCache.set(tweetId, errorUpdate, true);

                        filterSingleTweet(tweetArticle);
                        return;
                    }
                }
                filterSingleTweet(tweetArticle);

            } catch (error) {
                console.error(`Generic error processing tweet ${tweetId}: ${error}`, error.stack);

                if (error.message === "Media content not extracted despite presence of media containers.") {
                    if (tweetCache.has(tweetId)) {
                        tweetCache.delete(tweetId);
                        console.log(`[delayedProcessTweet] Deleted cache for ${tweetId} due to media extraction failure.`);
                    }
                }

                ScoreIndicatorRegistry.get(tweetId, tweetArticle)?.update({
                    status: 'error',
                    score: 5,
                    description: "Error during processing: " + error.message,
                    questions: [],
                    lastAnswer: ""
                });
                processingSuccessful = false;
            } finally {
                if (!processingSuccessful) {
                    processedTweets.delete(tweetId);
                }
            }
        } else {
            tweetArticle.dataset.ratingStatus = 'error';
            tweetArticle.dataset.ratingDescription = "No API key";
            ScoreIndicatorRegistry.get(tweetId, tweetArticle)?.update({
                status: 'error',
                score: 9,
                description: "No API key",
                questions: [],
                lastAnswer: ""
            });
            processingSuccessful = true;
        }

        filterSingleTweet(tweetArticle);
        return;
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

        if (!processingSuccessful) {
            processedTweets.delete(tweetId);

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

const MAPPING_INCOMPLETE_TWEETS = new Set();

async function scheduleTweetProcessing(tweetArticle, rateAnyway = false) {

    const tweetId = getTweetID(tweetArticle);
    if (!tweetId) {
        return;
    }

    if (window.activeStreamingRequests && window.activeStreamingRequests[tweetId]) {
        console.log(`Tweet ${tweetId} has an active streaming request, skipping processing`);
        return;
    }

    const handles = getUserHandles(tweetArticle);
    const authorHandle = handles.length > 0 ? handles[0] : '';

    if ((authorHandle && adAuthorCache.has(authorHandle)) || isAd(tweetArticle)) {
        if (authorHandle && !adAuthorCache.has(authorHandle)) adAuthorCache.add(authorHandle);
        tweetArticle.dataset.ratingStatus = 'rated';
        tweetArticle.dataset.ratingDescription = "Advertisement";
        tweetArticle.dataset.slopScore = '0';
        ScoreIndicatorRegistry.get(tweetId, tweetArticle)?.update({
            status: 'rated',
            score: 0,
            description: "Advertisement",
            questions: [],
            lastAnswer: ""
        });
        filterSingleTweet(tweetArticle);
        return;
    }

    const existingInstance = ScoreIndicatorRegistry.get(tweetId);
    existingInstance?.ensureIndicatorAttached();
    if (existingInstance && !rateAnyway) {
        if (isValidFinalState(existingInstance.status) || (isValidInterimState(existingInstance.status) && processedTweets.has(tweetId))) {
            filterSingleTweet(tweetArticle);
            return;
        }

        processedTweets.delete(tweetId);
    }
    const conversation = document.querySelector('div[aria-label="Timeline: Conversation"]') ||
        document.querySelector('div[aria-label^="Timeline: Conversation"]');
    if (conversation) {
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
    if (tweetCache.has(tweetId)) {
        const isIncompleteStreaming = tweetCache.get(tweetId).streaming === true && !tweetCache.get(tweetId).score;
        if (!isIncompleteStreaming && applyTweetCachedRating(tweetArticle)) {
            return;
        }
    }

    if (processedTweets.has(tweetId)) {
        const instance = ScoreIndicatorRegistry.get(tweetId);
        if (instance) {
            instance.ensureIndicatorAttached();
            if (instance.status === 'pending' || instance.status === 'streaming') {
                filterSingleTweet(tweetArticle);
                return;
            }
        }

        processedTweets.delete(tweetId);
    }

    const indicatorInstance = ScoreIndicatorRegistry.get(tweetId, tweetArticle);
    if (indicatorInstance) {
        if (indicatorInstance.status !== 'blacklisted' &&
            indicatorInstance.status !== 'cached' &&
            indicatorInstance.status !== 'rated') {
            indicatorInstance.update({ status: 'pending', score: null, description: 'Rating scheduled...', questions: [], lastAnswer: "" });
        } else {

            indicatorInstance.ensureIndicatorAttached();
            filterSingleTweet(tweetArticle);
            return;
        }
    } else {
        console.error(`Failed to get/create indicator instance for tweet ${tweetId} during scheduling.`);
    }

    if (!processedTweets.has(tweetId)) {
        processedTweets.add(tweetId);
    }

    setTimeout(() => {
        try {
            if (!browserGet('enableAutoRating', true) && !rateAnyway) {

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

let threadRelationships = {};
const THREAD_CHECK_INTERVAL = 1500;
const SWEEP_INTERVAL = 2500;
const THREAD_MAPPING_TIMEOUT = 1000;
let threadMappingInProgress = false;

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

function saveThreadRelationships() {
    try {

        const relationshipCount = Object.keys(threadRelationships).length;
        if (relationshipCount > 1000) {

            const entries = Object.entries(threadRelationships);

            entries.sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0));
            const recent = entries.slice(0, 500);
            threadRelationships = Object.fromEntries(recent);
        }

        browserSet('threadRelationships', JSON.stringify(threadRelationships));
    } catch (e) {
        console.error('Error saving thread relationships:', e);
    }
}

loadThreadRelationships();

async function buildReplyChain(tweetId, maxDepth = Infinity) {
    if (!tweetId || maxDepth <= 0) return [];

    const chain = [];

    let currentId = tweetId;
    let depth = 0;

    while (currentId && depth < maxDepth) {
        const replyInfo = threadRelationships[currentId];
        if (!replyInfo || !replyInfo.replyTo) break;

        chain.push({
            fromId: currentId,
            toId: replyInfo.replyTo,
            from: replyInfo.from,
            to: replyInfo.to
        });

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

        return getFullContextPromises.get(tweetId);
    }

    const contextPromise = (async () => {
        try {

            const handles = getUserHandles(tweetArticle);

            const userHandle = handles.length > 0 ? handles[0] : '';
            const quotedHandle = handles.length > 1 ? handles[1] : '';

            const mainText = getTweetText(tweetArticle);

            let allMediaLinks = extractMediaLinks(tweetArticle);

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
                quotedMediaLinks = extractMediaLinks(quoteContainer);
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

            const mainImageUrls = [];
            const mainVideoDescriptions = [];

            mainMediaLinks.forEach(item => {
                if (item.startsWith('[VIDEO_DESCRIPTION]:')) {
                    mainVideoDescriptions.push(item.replace('[VIDEO_DESCRIPTION]: ', ''));
                } else {
                    mainImageUrls.push(item);
                }
            });

            let engagementStats = "";
            const engagementDiv = tweetArticle.querySelector('div[role="group"][aria-label$=" views"]');
            if (engagementDiv) {
                engagementStats = engagementDiv.getAttribute('aria-label')?.trim() || "";
            }

            let fullContextWithImageDescription = `[TWEET ${tweetId}]
 Author:@${userHandle}:
` + mainText;

            if (mainVideoDescriptions.length > 0) {
                fullContextWithImageDescription += `
[VIDEO_DESCRIPTIONS]:
${mainVideoDescriptions.map((desc, i) => `[VIDEO ${i + 1}]: ${desc}`).join('\n')}`;
            }

            if (mainImageUrls.length > 0) {
                if (browserGet('enableImageDescriptions', false)) {
                    let mainMediaLinksDescription = await getImageDescription(mainImageUrls, apiKey, tweetId, userHandle);
                    fullContextWithImageDescription += `
[MEDIA_DESCRIPTION]:
${mainMediaLinksDescription}`;
                }
                fullContextWithImageDescription += `
[MEDIA_URLS]:
${mainImageUrls.join(", ")}`;
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

                    const quotedImageUrls = [];
                    const quotedVideoDescriptions = [];

                    quotedMediaLinks.forEach(item => {
                        if (item.startsWith('[VIDEO_DESCRIPTION]:')) {
                            quotedVideoDescriptions.push(item.replace('[VIDEO_DESCRIPTION]: ', ''));
                        } else {
                            quotedImageUrls.push(item);
                        }
                    });

                    if (quotedVideoDescriptions.length > 0) {
                        fullContextWithImageDescription += `
[QUOTED_TWEET_VIDEO_DESCRIPTIONS]:
${quotedVideoDescriptions.map((desc, i) => `[VIDEO ${i + 1}]: ${desc}`).join('\n')}`;
                    }

                    if (quotedImageUrls.length > 0) {
                        if (browserGet('enableImageDescriptions', false)) {
                            let quotedMediaLinksDescription = await getImageDescription(quotedImageUrls, apiKey, tweetId, userHandle);
                            fullContextWithImageDescription += `
[QUOTED_TWEET_MEDIA_DESCRIPTION]:
${quotedMediaLinksDescription}`;
                        }
                        fullContextWithImageDescription += `
[QUOTED_TWEET_MEDIA_URLS]:
${quotedImageUrls.join(", ")}`;
                    }
                }
            }

            const conversationElement = document.querySelector('div[aria-label="Timeline: Conversation"], div[aria-label^="Timeline: Conversation"]');
            if (conversationElement) {
                const replyChain = await buildReplyChain(tweetId);
                let threadHistoryIncluded = false;

                if (conversationElement.dataset.threadHist) {
                    if (!isOriginalTweet(tweetArticle)) {

                        fullContextWithImageDescription = conversationElement.dataset.threadHist + `\n[REPLY]\n` + fullContextWithImageDescription;
                        threadHistoryIncluded = true;
                    }
                }

                if (replyChain.length > 0 && !threadHistoryIncluded) {
                    let parentContextsString = "";
                    let previousParentAuthor = null;

                    for (let i = replyChain.length - 1; i >= 0; i--) {
                        const link = replyChain[i];
                        const parentId = link.toId;
                        const parentUser = link.to || 'unknown';
                        let currentParentContent = null;

                        const parentCacheEntry = tweetCache.get(parentId);

                        if (parentCacheEntry && parentCacheEntry.fullContext) {
                            currentParentContent = parentCacheEntry.fullContext;
                        } else {

                            const parentArticleElement = Array.from(document.querySelectorAll(TWEET_ARTICLE_SELECTOR))
                                .find(el => getTweetID(el) === parentId);

                            if (parentArticleElement) {
                                const originalParentRelationship = threadRelationships[parentId];
                                delete threadRelationships[parentId];
                                try {
                                    currentParentContent = await getFullContext(parentArticleElement, parentId, apiKey);
                                } finally {
                                    if (originalParentRelationship) {
                                        threadRelationships[parentId] = originalParentRelationship;
                                    }
                                }
                            } else if (parentCacheEntry && parentCacheEntry.individualTweetText) {

                                currentParentContent = `[TWEET ${parentId}]\n Author:@${parentCacheEntry.authorHandle || parentUser}:\n${parentCacheEntry.individualTweetText}`;
                                if (parentCacheEntry.individualMediaUrls && parentCacheEntry.individualMediaUrls.length > 0) {
                                    try {
                                        if (browserGet('enableImageDescriptions', false)) {
                                            const parentMediaDesc = await getImageDescription(
                                                parentCacheEntry.individualMediaUrls,
                                                apiKey,
                                                parentId,
                                                parentCacheEntry.authorHandle || parentUser
                                            );
                                            currentParentContent += `\n[MEDIA_DESCRIPTION]:\n${parentMediaDesc}`;
                                        }
                                    } catch (e) {
                                        console.warn(`[getFullContext] Failed to fetch parent media descriptions for ${parentId}:`, e);
                                    }
                                    currentParentContent += `\n[MEDIA_URLS]:\n${parentCacheEntry.individualMediaUrls.join(", ")}`;
                                }
                            }
                        }

                        if (previousParentAuthor) {
                            parentContextsString += `\n[REPLY TO @${previousParentAuthor}]\n`;
                        }

                        if (currentParentContent) {

                            const lastTweetMarker = currentParentContent.lastIndexOf('[TWEET ');
                            if (lastTweetMarker > 0) {
                                currentParentContent = currentParentContent.substring(lastTweetMarker);
                            }
                            parentContextsString += currentParentContent;
                        } else {
                            parentContextsString += `[CONTEXT UNAVAILABLE FOR TWEET ${parentId} @${parentUser}]`;
                        }
                        previousParentAuthor = parentUser;
                    }

                    if (previousParentAuthor) {
                        parentContextsString += `\n[REPLY TO @${previousParentAuthor}]\n`;
                    }

                    fullContextWithImageDescription = parentContextsString + fullContextWithImageDescription;
                }

                const replyInfo = getTweetReplyInfo(tweetId);
                if (replyInfo && replyInfo.to && !threadHistoryIncluded && replyChain.length === 0) {
                    fullContextWithImageDescription = `[REPLY TO @${replyInfo.to}]\n` + fullContextWithImageDescription;
                }
            }

            tweetArticle.dataset.fullContext = fullContextWithImageDescription;

            const existingCacheEntryForCurrentTweet = tweetCache.get(tweetId) || {};
            const updatedCacheEntry = {
                ...existingCacheEntryForCurrentTweet,
                fullContext: fullContextWithImageDescription,
                timestamp: existingCacheEntryForCurrentTweet.timestamp || Date.now()
            };

            if (existingCacheEntryForCurrentTweet.score === undefined && updatedCacheEntry.score === null) {

                updatedCacheEntry.score = undefined;
            }
            tweetCache.set(tweetId, updatedCacheEntry, false);

            return fullContextWithImageDescription;

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
    if (document.querySelector('div[aria-label="Timeline: Conversation"]') || !browserGet('enableAutoRating', false)) {
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
        let conversation = document.querySelector('div[aria-label="Timeline: Conversation"]');
        if (!conversation) {
            conversation = document.querySelector('div[aria-label^="Timeline: Conversation"]');
        }
        if (!conversation) return;
        if (threadMappingInProgress || conversation.dataset.threadMappingInProgress === "true") {
            return;
        }
        const lastMappedTimestamp = parseInt(conversation.dataset.threadMappedAt || '0', 10);
        const MAPPING_COOLDOWN_MS = 1000;
        if (Date.now() - lastMappedTimestamp < MAPPING_COOLDOWN_MS) {
            return;
        }

        const match = location.pathname.match(/status\/(\d+)/);
        const pageTweetId = match ? match[1] : null;
        if (!pageTweetId) return;

        let rootTweetId = pageTweetId;
        while (threadRelationships[rootTweetId] && threadRelationships[rootTweetId].replyTo) {
            rootTweetId = threadRelationships[rootTweetId].replyTo;
        }

        await mapThreadStructure(conversation, rootTweetId);

    } catch (error) {
        console.error("Error in handleThreads:", error);
        threadMappingInProgress = false;
    }
}

async function mapThreadStructure(conversation, localRootTweetId) {

    if (threadMappingInProgress || conversation.dataset.threadMappingInProgress) {
        return;
    }

    conversation.dataset.threadMappingInProgress = "true";
    threadMappingInProgress = true;

    try {

        const timeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Thread mapping timed out')), THREAD_MAPPING_TIMEOUT)
        );

        const mapping = async () => {

            const urlMatch = location.pathname.match(/status\/(\d+)/);
            const urlTweetId = urlMatch ? urlMatch[1] : null;

            let cellDivs = Array.from(conversation.querySelectorAll('div[data-testid="cellInnerDiv"]'));

            if (!cellDivs.length) {
                console.log("No cell divs found, thread mapping aborted");
                delete conversation.dataset.threadMappingInProgress;
                threadMappingInProgress = false;
                return;
            }

            cellDivs.forEach((cell, idx) => {
                const tweetId = cell.dataset.tweetId;
                const authorHandle = cell.dataset.authorHandle;

            });

            cellDivs.sort((a, b) => {
                const aY = parseInt(a.style.transform.match(/translateY\((\d+)/)?.[1] || '0');
                const bY = parseInt(b.style.transform.match(/translateY\((\d+)/)?.[1] || '0');
                return aY - bY;
            });

            cellDivs.forEach((cell, idx) => {
                const tweetId = cell.dataset.tweetId;
                const authorHandle = cell.dataset.authorHandle;

            });

            let tweetCells = [];
            let processedCount = 0;
            let urlTweetCellIndex = -1;

            for (let idx = 0; idx < cellDivs.length; idx++) {
                const cell = cellDivs[idx];
                let tweetId, username, text, mediaLinks = [], quotedMediaLinks = [];
                let article = cell.querySelector('article[data-testid="tweet"]');

                if (article) {
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
                    text = getTweetText(article).replace(/\n+/g, ' ⏎ ');
                    mediaLinks = extractMediaLinks(article);
                    const quoteContainer = article.querySelector(QUOTE_CONTAINER_SELECTOR);
                    if (quoteContainer) {
                        quotedMediaLinks = extractMediaLinks(quoteContainer);
                    }
                }


                tweetId = (tweetId || cell.dataset.tweetId) || '';
                username = (username || cell.dataset.authorHandle) || '';
                text = (text || cell.dataset.tweetText) || '';
                mediaLinks = (mediaLinks || JSON.parse(cell.dataset.mediaUrls)) || [];


                if (tweetId && username) {
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
                        index: processedCount
                    };
                    tweetCells.push(currentCellItem);

                    if (tweetId === urlTweetId) {

                        urlTweetCellIndex = tweetCells.length - 1;
                    }
                    processedCount++;

                    if (article && !processedTweets.has(tweetId)) {
                        scheduleTweetProcessing(article);
                    }
                } else {
                    tweetCells.push({
                        type: 'separator',
                        cellDiv: cell,
                        cellIndex: idx,
                    });

                }
            }

            const urlTweetObject = urlTweetCellIndex !== -1 ? tweetCells[urlTweetCellIndex] : null;

            let effectiveUrlTweetInfo = null;
            if (urlTweetObject) {
                effectiveUrlTweetInfo = {
                    tweetId: urlTweetObject.tweetId,
                    username: urlTweetObject.username
                };

            } else if (urlTweetId) {
                const cachedUrlTweet = tweetCache.get(urlTweetId);
                if (cachedUrlTweet && cachedUrlTweet.authorHandle) {
                    effectiveUrlTweetInfo = {
                        tweetId: urlTweetId,
                        username: cachedUrlTweet.authorHandle
                    };

                } else {

                }
            } else {

            }

            const actualTweets = tweetCells.filter(tc => tc.type === 'tweet');
            if (actualTweets.length === 0) {
                console.log("No valid tweets found, thread mapping aborted");
                delete conversation.dataset.threadMappingInProgress;
                threadMappingInProgress = false;
                return;
            }

            for (let i = 0; i < tweetCells.length; ++i) {
                let currentItem = tweetCells[i];

                if (currentItem.type === 'separator') {

                    continue;
                }

                if (i === 0) {
                    currentItem.replyTo = null;
                    currentItem.replyToId = null;
                    currentItem.isRoot = true;

                } else {
                    const previousItem = tweetCells[i - 1];
                    if (previousItem.type === 'separator') {
                        if (effectiveUrlTweetInfo && currentItem.tweetId !== effectiveUrlTweetInfo.tweetId) {
                            currentItem.replyTo = effectiveUrlTweetInfo.username;
                            currentItem.replyToId = effectiveUrlTweetInfo.tweetId;
                            currentItem.isRoot = false;

                        } else if (effectiveUrlTweetInfo && currentItem.tweetId === effectiveUrlTweetInfo.tweetId) {

                            currentItem.replyTo = null;
                            currentItem.replyToId = null;
                            currentItem.isRoot = true;

                        } else {

                            currentItem.replyTo = null;
                            currentItem.replyToId = null;
                            currentItem.isRoot = true;

                        }
                    } else if (previousItem.type === 'tweet') {
                        currentItem.replyTo = previousItem.username;
                        currentItem.replyToId = previousItem.tweetId;
                        currentItem.isRoot = false;

                    } else {

                        currentItem.replyTo = null;
                        currentItem.replyToId = null;
                        currentItem.isRoot = true;
                    }
                }
            }

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

            conversation.dataset.threadMapping = JSON.stringify(replyDocs);

            for (const waitingTweetId of MAPPING_INCOMPLETE_TWEETS) {
                const mappedTweet = replyDocs.find(doc => doc.tweetId === waitingTweetId);
                if (mappedTweet) {

                    const tweetArticle = tweetCells.find(tc => tc.tweetId === waitingTweetId)?.tweetNode;
                    if (tweetArticle) {
                        processedTweets.delete(waitingTweetId);
                        scheduleTweetProcessing(tweetArticle);
                    }
                }
            }
            MAPPING_INCOMPLETE_TWEETS.clear();

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

            saveThreadRelationships();

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

                        if (doc.tweetId && processedTweets.has(doc.tweetId)) {

                            const tweetCell = tweetCells.find(tc => tc.tweetId === doc.tweetId);
                            if (tweetCell && tweetCell.tweetNode) {

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

                if (i + batchSize < replyDocs.length) {
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
            }

            delete conversation.dataset.threadMappingInProgress;
            threadMappingInProgress = false;
            conversation.dataset.threadMappedAt = Date.now().toString();

        };

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

        await Promise.race([mapping(), timeout]);

    } catch (error) {
        console.error("Error in mapThreadStructure:", error);

        delete conversation.dataset.threadMappingInProgress;
        threadMappingInProgress = false;

    }
}

function getTweetReplyInfo(tweetId) {
    if (threadRelationships[tweetId]) {
        return threadRelationships[tweetId];
    }
    return null;
}

setInterval(handleThreads, THREAD_CHECK_INTERVAL);

setInterval(ensureAllTweetsRated, SWEEP_INTERVAL);

//setInterval(applyFilteringToAll, SWEEP_INTERVAL);
