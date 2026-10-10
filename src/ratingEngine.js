/** Captures content before removing filtered cells; ratings live in the registry/cache. */
function filterSingleTweet(tweetArticle, saveCacheImmediately = true) {
    const cell = tweetArticle.closest('[data-testid="cellInnerDiv"]');
    if (!cell) return;
    const tweet = parseTweet(tweetArticle);
    const authorHandle = tweet.author.handle;
    tweetCache.set(tweet.id, {
        tweet,
        authorHandle,
        individualTweetText: tweet.text,
        individualMediaUrls: collectRatingImageUrls([], { tweet, ancestors: [] })
    }, saveCacheImmediately);
    if (adAuthorCache.has(authorHandle) || isAd(tweetArticle)) {
        ScoreIndicatorRegistry.get(tweet.id)?.destroy();
        filteredCells.add(cell);
        cell.replaceChildren();
        return;
    }
    const indicator = ScoreIndicatorRegistry.get(tweet.id, tweetArticle);
    const keep = isUserBlacklisted(authorHandle);
    indicator?.setAuthorBlacklistState(keep);
    const score = indicator?.score ?? tweetCache.get(tweet.id)?.score;
    if (!keep && score != null && !isActiveTweetStatus(indicator?.status) &&
        score < appSettings.getInteger('filterThreshold')) {
        indicator?.destroy();
        filteredCells.add(cell);
        cell.replaceChildren();
    } else {
        filteredCells.delete(cell);
        indicator?.ensureIndicatorAttached();
        indicator?.refreshIndicatorUI();
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

        const hasCachedConversation = Array.isArray(cachedRating.qaConversationHistory) &&
            cachedRating.qaConversationHistory.some(message => message.role === 'system');
        if (cachedRating.score === null &&
            cachedRating.streaming !== true &&
            hasCachedConversation &&
            !appSettings.getBoolean('enableAutoRating')) {

            const indicatorInstance = ScoreIndicatorRegistry.get(tweetId, tweetArticle);
            if (!indicatorInstance) {
                return false;
            }

            indicatorInstance.rehydrateFromCache({
                ...cachedRating,
                status: TweetRatingStatus.MANUAL,
                description: cachedRating.description || 'This tweet has not been rated yet.'
            });
            filterSingleTweet(tweetArticle);
            tweetProcessingState.resetRetries(tweetId);
            return true;
        }

        if (cachedRating.streaming === true &&
            (cachedRating.score === undefined || cachedRating.score === null)) {

            return false;
        }

        if (cachedRating.score !== undefined && cachedRating.score !== null) {


            const indicatorInstance = ScoreIndicatorRegistry.get(tweetId, tweetArticle);
            if (indicatorInstance) {
                indicatorInstance.rehydrateFromCache(cachedRating);

            } else {
                console.warn(`[applyTweetCachedRating] Could not get/create ScoreIndicator for ${tweetId} to apply cached rating.`);
                return false;
            }
            filterSingleTweet(tweetArticle);
            tweetProcessingState.resetRetries(tweetId);
            return true;
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

const getFullContextPromises = new Map();

function isValidFinalState(status) {
    return isFinalTweetStatus(status);
}

function isValidInterimState(status) {
    return isActiveTweetStatus(status);
}

async function delayedProcessTweet(tweetArticle, tweetId, authorHandle, saveCacheImmediately = true) {
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
                const context = await getFullContext(tweetArticle, tweetId, apiKey, saveCacheImmediately);
                if (!context) {
                    throw new Error("Failed to get tweet context");
                }
                const mediaURLs = collectRatingImageUrls([], context);

                const hasPotentialImageContainers = tweetArticle.querySelector('div[data-testid="tweetPhoto"], div[data-testid="videoPlayer"]');
                const imageDescriptionsEnabled = browserGet('enableImageDescriptions', false);

                if (hasPotentialImageContainers && mediaURLs.length === 0 && (imageDescriptionsEnabled || modelSupportsImages(selectedModel))) {
                    console.warn(`Tweet ${tweetId}: Potential media containers found in DOM, but no media content (URLs or video descriptions) was extracted by getFullContext.`);
                }
                if (context) {
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
                                status: currentCache.fromStorage ? TweetRatingStatus.CACHED : TweetRatingStatus.RATED,
                                score: score,
                                description: description,
                                reasoning: reasoning,
                                questions: questions,
                                lastAnswer: lastAnswer,
                                metadata: currentCache.metadata || null,
                                mediaUrls: mediaUrls
                            });
                            filterSingleTweet(tweetArticle, saveCacheImmediately);
                            tweetProcessingState.resetRetries(tweetId);
                            return;
                        }

                        const rating = await rateTweetWithOpenRouter(context, tweetId, apiKey, mediaURLs, 3, tweetArticle, authorHandle, saveCacheImmediately);
                        score = rating.score;
                        description = rating.content;
                        reasoning = rating.reasoning || '';
                        questions = rating.questions || [];
                        lastAnswer = "";

                        let finalStatus = rating.error ? TweetRatingStatus.ERROR : TweetRatingStatus.RATED;
                        if (!rating.error) {
                            const cacheEntry = tweetCache.get(tweetId);
                            if (cacheEntry && cacheEntry.fromStorage) {
                                finalStatus = TweetRatingStatus.CACHED;
                            } else if (rating.cached) {
                                finalStatus = TweetRatingStatus.CACHED;
                            }
                        }


                        ScoreIndicatorRegistry.get(tweetId, tweetArticle)?.update({
                            status: finalStatus,
                            score: score,
                            description: description,
                            reasoning: reasoning,
                            questions: questions,
                            lastAnswer: lastAnswer,
                            metadata: rating.metadata || null,
                            mediaUrls: mediaURLs
                        });

                        processingSuccessful = !rating.error;

                        filterSingleTweet(tweetArticle, saveCacheImmediately);
                        if (processingSuccessful) {
                            tweetProcessingState.resetRetries(tweetId);
                        }
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
                            status: TweetRatingStatus.ERROR,
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
                        tweetCache.set(tweetId, errorUpdate, saveCacheImmediately);

                        filterSingleTweet(tweetArticle, saveCacheImmediately);
                        return;
                    }
                }
                filterSingleTweet(tweetArticle, saveCacheImmediately);

            } catch (error) {
                console.error(`Generic error processing tweet ${tweetId}: ${error}`, error.stack);

                if (error.message === "Media content not extracted despite presence of media containers.") {
                    if (tweetCache.has(tweetId)) {
                        tweetCache.delete(tweetId);
                        console.log(`[delayedProcessTweet] Deleted cache for ${tweetId} due to media extraction failure.`);
                    }
                }

                ScoreIndicatorRegistry.get(tweetId, tweetArticle)?.update({
                    status: TweetRatingStatus.ERROR,
                    score: 5,
                    description: "Error during processing: " + error.message,
                    questions: [],
                    lastAnswer: ""
                });
                processingSuccessful = false;
            } finally {
                if (!processingSuccessful) {
                    tweetProcessingState.clear(tweetId);
                }
            }
        } else {
            ScoreIndicatorRegistry.get(tweetId, tweetArticle)?.update({
                status: TweetRatingStatus.ERROR,
                score: 9,
                description: "No API key",
                questions: [],
                lastAnswer: ""
            });
            processingSuccessful = true;
            tweetProcessingState.resetRetries(tweetId);
        }

        filterSingleTweet(tweetArticle, saveCacheImmediately);
        return;
    } catch (error) {
        console.error(`Error processing tweet ${tweetId}:`, error);
        const indicatorInstance = ScoreIndicatorRegistry.get(tweetId);
        if (indicatorInstance) {
            indicatorInstance.update({
                status: TweetRatingStatus.ERROR,
                score: 5,
                description: "Error during processing: " + error.message,
                questions: [],
                lastAnswer: ""
            });
        }
        filterSingleTweet(tweetArticle, saveCacheImmediately);
        processingSuccessful = false;
    } finally {

        if (!processingSuccessful) {
            tweetProcessingState.clear(tweetId);

            const indicatorInstance = ScoreIndicatorRegistry.get(tweetId);
            if (indicatorInstance && !isValidFinalState(indicatorInstance.status) && tweetProcessingState.shouldRetry(tweetId)) {
                console.log(`Tweet ${tweetId} processing failed, will retry later`);
                setTimeout(() => {
                    if (!isValidFinalState(ScoreIndicatorRegistry.get(tweetId)?.status)) {
                        scheduleTweetProcessing(tweetArticle, saveCacheImmediately);
                    }
                }, PROCESSING_DELAY_MS * 2);
            }
        }
    }
}

const pendingThreadTweets = new Map();

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
        ScoreIndicatorRegistry.get(tweetId, tweetArticle)?.update({
            status: TweetRatingStatus.AD,
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
        if (isValidFinalState(existingInstance.status) || (isValidInterimState(existingInstance.status) && tweetProcessingState.isScheduled(tweetId))) {
            filterSingleTweet(tweetArticle);
            return;
        }

        tweetProcessingState.clear(tweetId);
    }
    const conversation = document.querySelector('div[aria-label="Timeline: Conversation"]') ||
        document.querySelector('div[aria-label^="Timeline: Conversation"]');
    const thread = conversation && conversationStates.get(conversation);
    const pageId = location.pathname.match(/status\/(\d+)/)?.[1];
    if (conversation && (thread?.pageId !== pageId || !thread?.tweets.has(tweetId))) {
        pendingThreadTweets.set(tweetId, rateAnyway);
        ScoreIndicatorRegistry.get(tweetId, tweetArticle)?.update({
            status: TweetRatingStatus.PENDING,
            score: null,
            description: 'Waiting for thread context...',
            questions: [],
            lastAnswer: ''
        });
        handleThreads();
        return;
    }
    if (!rateAnyway && tweetCache.has(tweetId)) {
        const cachedEntry = tweetCache.get(tweetId);
        const isIncompleteStreaming = cachedEntry.streaming === true && cachedEntry.score === null;
        if (!isIncompleteStreaming && applyTweetCachedRating(tweetArticle)) {
            return;
        }
    }

    if (tweetProcessingState.isScheduled(tweetId)) {
        const instance = ScoreIndicatorRegistry.get(tweetId);
        if (instance) {
            instance.ensureIndicatorAttached();
            if (isActiveTweetStatus(instance.status)) {
                filterSingleTweet(tweetArticle);
                return;
            }
        }

        tweetProcessingState.clear(tweetId);
    }

    const indicatorInstance = ScoreIndicatorRegistry.get(tweetId, tweetArticle);
    if (indicatorInstance) {
        if (indicatorInstance.status !== TweetRatingStatus.BLACKLISTED &&
            indicatorInstance.status !== TweetRatingStatus.CACHED &&
            indicatorInstance.status !== TweetRatingStatus.RATED &&
            indicatorInstance.status !== TweetRatingStatus.AD) {
            indicatorInstance.update({ status: TweetRatingStatus.PENDING, score: null, description: 'Rating scheduled...', questions: [], lastAnswer: "" });
        } else {

            indicatorInstance.ensureIndicatorAttached();
            filterSingleTweet(tweetArticle);
            return;
        }
    } else {
        console.error(`Failed to get/create indicator instance for tweet ${tweetId} during scheduling.`);
    }

    if (!tweetProcessingState.isScheduled(tweetId)) {
        tweetProcessingState.markScheduled(tweetId);
    }

    setTimeout(() => {
        try {
            if (!appSettings.getBoolean('enableAutoRating') && !rateAnyway) {

                const indicatorInstance = ScoreIndicatorRegistry.get(tweetId, tweetArticle);
                if (indicatorInstance) {
                    indicatorInstance.update({
                        status: TweetRatingStatus.MANUAL,
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

            const saveCacheImmediately = shouldSaveRatingCacheImmediately(rateAnyway);
            delayedProcessTweet(tweetArticle, tweetId, authorHandle, saveCacheImmediately);
        } catch (e) {
            console.error(`Error in delayed processing of tweet ${tweetId}:`, e);
            tweetProcessingState.clear(tweetId);
        }
    }, PROCESSING_DELAY_MS);
}

let threadRelationships = {};

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
    const visited = new Set();
    let currentId = tweetId;
    let depth = 0;

    while (currentId && depth < maxDepth) {
        if (visited.has(currentId)) {
            console.warn(`[buildReplyChain] Detected reply chain cycle at ${currentId}`);
            break;
        }
        visited.add(currentId);

        const replyInfo = getStoredReplyInfo(currentId);
        if (!replyInfo?.replyTo || visited.has(replyInfo.replyTo)) break;

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

function getStoredReplyInfo(tweetId) {
    if (!tweetId) return null;

    const relationship = threadRelationships[tweetId];
    const cachedEntry = tweetCache.get(tweetId);
    const threadContext = cachedEntry?.threadContext;

    if (relationship) {
        const replyTo = relationship.replyTo || threadContext?.replyToId || null;
        return {
            ...relationship,
            replyTo,
            from: relationship.from || cachedEntry?.authorHandle || '',
            to: relationship.to || threadContext?.replyTo || null,
            isRoot: replyTo ? false : (relationship.isRoot === true || threadContext?.isRoot === true)
        };
    }

    if (threadContext?.replyToId) {
        return {
            replyTo: threadContext.replyToId,
            from: cachedEntry?.authorHandle || '',
            to: threadContext.replyTo || null,
            isRoot: false,
            timestamp: cachedEntry?.timestamp || 0
        };
    }

    if (threadContext?.isRoot) {
        return {
            replyTo: null,
            from: cachedEntry?.authorHandle || '',
            to: null,
            isRoot: true,
            timestamp: cachedEntry?.timestamp || 0
        };
    }

    return null;
}

/** Returns a defined rating context; serialize only at the API boundary. */
async function getFullContext(tweetArticle, tweetId, apiKey, saveCacheImmediately = true) {
    if (getFullContextPromises.has(tweetId)) return getFullContextPromises.get(tweetId);
    const promise = (async () => {
        const tweet = parseTweet(tweetArticle);
        const replyInfo = getStoredReplyInfo(tweetId);
        tweet.replyTo = replyInfo?.replyTo ? { id: replyInfo.replyTo, handle: replyInfo.to || '' } : null;
        const ancestors = [];
        const chain = await buildReplyChain(tweetId);
        for (const link of chain.reverse()) {
            const cached = tweetCache.get(link.toId);
            const article = Array.from(document.querySelectorAll(TWEET_ARTICLE_SELECTOR))
                .find(element => getTweetID(element) === link.toId);
            const parent = article ? parseTweet(article) : cached?.tweet || cached?.fullContext?.tweet;
            ancestors.push(parent || {
                id: link.toId,
                author: { handle: link.to || '', name: '' },
                text: cached?.individualTweetText || '',
                createdAt: null,
                url: null,
                media: (cached?.individualMediaUrls || []).map(url => ({ type: 'image', url, alt: '' })),
                linkPreviews: [],
                engagement: {},
                quotedTweet: null,
                replyTo: null,
                unavailable: !cached?.individualTweetText
            });
            const parentReply = getStoredReplyInfo(link.toId);
            ancestors[ancestors.length - 1].replyTo = parentReply?.replyTo
                ? { id: parentReply.replyTo, handle: parentReply.to || '' } : null;
        }
        const context = { tweet, ancestors };
        if (appSettings.getBoolean('enableImageDescriptions')) {
            for (const item of [...ancestors, tweet].flatMap(item => [item, item.quotedTweet]).filter(Boolean)) {
                const media = item.media.filter(media => !media.description);
                if (media.length) {
                    const descriptions = await getImageDescriptions(media.map(media => media.url), apiKey);
                    media.forEach((media, index) => { media.description = descriptions[index] || ''; });
                }
            }
        }
        tweetCache.set(tweetId, { tweet, fullContext: context }, saveCacheImmediately);
        return context;
    })();
    getFullContextPromises.set(tweetId, promise);
    try { return await promise; }
    finally { getFullContextPromises.delete(tweetId); }
}

/**
 * Applies filtering to all tweets currently in the observed container.
 */
function applyFilteringToAll() {
    if (!observedTargetNode) return;
    const tweets = observedTargetNode.querySelectorAll(TWEET_ARTICLE_SELECTOR);
    tweets.forEach(tweet => filterSingleTweet(tweet));
}

function ensureAllTweetsRated() {
    if (document.querySelector('div[aria-label="Timeline: Conversation"]') || !appSettings.getBoolean('enableAutoRating')) {
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
                indicatorInstance.status === TweetRatingStatus.ERROR ||
                (!isValidFinalState(indicatorInstance.status) && !isValidInterimState(indicatorInstance.status)) ||
                (tweetProcessingState.isScheduled(tweetId) && !isValidFinalState(indicatorInstance.status) && !isValidInterimState(indicatorInstance.status));

            if (needsProcessing) {
                if (tweetProcessingState.isScheduled(tweetId)) {
                    console.log(`Tweet ${tweetId} marked as processed but in invalid state: ${indicatorInstance?.status}`);
                    tweetProcessingState.clear(tweetId);
                }
                scheduleTweetProcessing(tweet);
            } else if (indicatorInstance && !isValidInterimState(indicatorInstance.status)) {
                filterSingleTweet(tweet);
            }
        });
    }
}

async function handleThreads() {
    const conversation = document.querySelector('div[aria-label^="Timeline: Conversation"]');
    const pageId = location.pathname.match(/status\/(\d+)/)?.[1];
    if (!conversation || !pageId) return;
    await mapThreadStructure(conversation, pageId);
}

/** Separator cells start a new branch under the page tweet; adjacent tweets form a chain. */
async function mapThreadStructure(conversation, pageId) {
    const cells = Array.from(conversation.querySelectorAll('[data-testid="cellInnerDiv"]'));
    const position = cell => parseFloat(cell.style.transform.match(/translateY\((-?[\d.]+)/)?.[1] || '0');
    cells.sort((a, b) => position(a) - position(b));
    const pageIndex = cells.findIndex(cell => {
        const article = cell.querySelector(TWEET_ARTICLE_SELECTOR);
        return (article ? getTweetID(article) : cellTweets.get(cell)?.id) === pageId;
    });
    const tweets = new Map();
    const articles = new Map();
    let previous = null;
    const timestamp = Date.now();
    for (const [index, cell] of cells.entries()) {
        const article = cell.querySelector(TWEET_ARTICLE_SELECTOR);
        const tweet = article ? parseTweet(article) : cellTweets.get(cell);
        if (!tweet || !tweet.author.handle || (article && isAd(article))) {
            previous = null;
            continue;
        }
        const stored = getStoredReplyInfo(tweet.id);
        const parentId = previous?.id || stored?.replyTo ||
            (index > pageIndex && tweet.id !== pageId && !stored?.isRoot ? pageId : null);
        const parentHandle = previous?.author.handle || tweets.get(parentId)?.author.handle ||
            tweetCache.get(parentId)?.authorHandle || stored?.to || '';
        // Keep known ancestry for the page tweet when its ancestors have scrolled out of view.
        const replyToId = parentId === tweet.id ? null : parentId || null;
        tweet.replyTo = replyToId ? { id: replyToId, handle: parentHandle } : null;
        threadRelationships[tweet.id] = {
            replyTo: replyToId, from: tweet.author.handle, to: parentHandle || null,
            isRoot: !replyToId, timestamp
        };
        tweetCache.set(tweet.id, {
            tweet, authorHandle: tweet.author.handle, individualTweetText: tweet.text,
            individualMediaUrls: collectRatingImageUrls([], { tweet, ancestors: [] }),
            threadContext: { replyTo: parentHandle || null, replyToId, isRoot: !replyToId }
        });
        tweets.set(tweet.id, tweet);
        if (article) articles.set(tweet.id, article);
        previous = tweet;
    }
    conversationStates.set(conversation, { pageId, tweets });
    saveThreadRelationships();
    for (const [tweetId, article] of articles) {
        const rateAnyway = pendingThreadTweets.get(tweetId) || false;
        if (pendingThreadTweets.delete(tweetId)) tweetProcessingState.clear(tweetId);
        scheduleTweetProcessing(article, rateAnyway);
    }
}
