/**
 * Applies filtering to a single tweet by hiding it if its score is below the threshold.
 * Also updates the rating indicator.
 * @param {Element} tweetArticle - The tweet element.
 */
function filterSingleTweet(tweetArticle) {
    const score = parseInt(tweetArticle.dataset.sloppinessScore || '9', 10);
    // Update the indicator based on the tweet's rating status
    setScoreIndicator(tweetArticle, score, tweetArticle.dataset.ratingStatus || 'rated', tweetArticle.dataset.ratingDescription);
    // If the tweet is still pending a rating, keep it visible
    // Always get the latest threshold directly from storage
    const currentFilterThreshold = parseInt(browserGet('filterThreshold', '1'));
    if (tweetArticle.dataset.ratingStatus === 'pending' || tweetArticle.dataset.ratingStatus === 'streaming') {
        //tweetArticle.style.display = '';
        tweetArticle.closest('div[data-testid="cellInnerDiv"]').style.display = '';
    } else if (isNaN(score) || score < currentFilterThreshold) {
        //tweetArticle.style.display = 'none';
        tweetArticle.closest('div[data-testid="cellInnerDiv"]').style.display = 'none';
    } else {
        //tweetArticle.style.display = '';
        tweetArticle.closest('div[data-testid="cellInnerDiv"]').style.display = '';
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
    const handles = getUserHandles(tweetArticle);
    const userHandle = handles.length > 0 ? handles[0] : '';
    
    // Blacklisted users are automatically given a score of 10
    if (userHandle && isUserBlacklisted(userHandle)) {
        tweetArticle.dataset.sloppinessScore = '10';
        tweetArticle.dataset.blacklisted = 'true';
        tweetArticle.dataset.ratingStatus = 'blacklisted';
        tweetArticle.dataset.ratingDescription = 'Whitelisted user';
        setScoreIndicator(tweetArticle, 10, 'blacklisted', "User is whitelisted");
        filterSingleTweet(tweetArticle);
        return true;
    }

    // Check cache for rating
    const cachedRating = tweetCache.get(tweetId);
    if (cachedRating) {
        // Skip incomplete streaming entries that don't have a score yet
        if (cachedRating.streaming === true && 
            (cachedRating.score === undefined || cachedRating.score === null)) {
            return false;
        }

        // Ensure the score exists before applying it
        if (cachedRating.score !== undefined && cachedRating.score !== null) {
            const score = cachedRating.score;
            const desc = cachedRating.description;
            const reasoning = cachedRating.reasoning || "";
            
            tweetArticle.dataset.sloppinessScore = score.toString();
            tweetArticle.dataset.cachedRating = 'true';
            if (reasoning) {
                tweetArticle.dataset.ratingReasoning = reasoning;
            }

            // If it's a streaming entry that's not complete, mark as streaming instead of cached
            if (cachedRating.streaming === true) {
                tweetArticle.dataset.ratingStatus = 'streaming';
                setScoreIndicator(tweetArticle, score, 'streaming', desc);
            } else {
                // Check if this rating is from storage (cached) or newly created
                const isFromStorage = cachedRating.fromStorage === true;

                // Set status based on source
                if (isFromStorage) {
                    tweetArticle.dataset.ratingStatus = 'cached';
                    setScoreIndicator(tweetArticle, score, 'cached', desc);
                } else {
                    tweetArticle.dataset.ratingStatus = 'rated';
                    setScoreIndicator(tweetArticle, score, 'rated', desc);
                }
            }

            tweetArticle.dataset.ratingDescription = desc;
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

async function delayedProcessTweet(tweetArticle, tweetId) {
    const apiKey = browserGet('openrouter-api-key', '');
    if (!apiKey) {
        tweetArticle.dataset.ratingStatus = 'error';
        tweetArticle.dataset.ratingDescription = "No API key";
        try {
            setScoreIndicator(tweetArticle, 9, 'error', "No API key");
            // Verify indicator was actually created
            if (!tweetArticle.querySelector('.score-indicator')) {
                console.error(`Failed to create score indicator for tweet ${tweetId}`);
            }
        } catch (e) {
            console.error(`Error setting score indicator for tweet ${tweetId}:`, e);
        }
        filterSingleTweet(tweetArticle);
        // Remove from processedTweets to allow retrying
        processedTweets.delete(tweetId);
        console.error(`Failed to process tweet ${tweetId}: No API key`);
        return;
    }
    let score = 5; // Default score if rating fails
    let description = "";
    let processingSuccessful = false;

    try {
        // Get user handle
        const handles = getUserHandles(tweetArticle);
        const userHandle = handles.length > 0 ? handles[0] : '';
        const quotedHandle = handles.length > 1 ? handles[1] : '';



        // Check if tweet's author is blacklisted (fast path)
        if (userHandle && isUserBlacklisted(userHandle)) {
            tweetArticle.dataset.sloppinessScore = '10';
            tweetArticle.dataset.blacklisted = 'true';
            tweetArticle.dataset.ratingStatus = 'blacklisted';
            tweetArticle.dataset.ratingDescription = "Blacklisted user";
            try {
                setScoreIndicator(tweetArticle, 10, 'blacklisted', "User is blacklisted");
                // Verify indicator was actually created
                if (!tweetArticle.querySelector('.score-indicator')) {
                    throw new Error("Failed to create score indicator");
                }
            } catch (e) {
                console.error(`Error setting blacklist indicator for tweet ${tweetId}:`, e);
                // Even if indicator fails, we've set the dataset properties
            }
            filterSingleTweet(tweetArticle);
            processingSuccessful = true;
            
        }

        // Check for a cached rating, but only use it if it has a valid score
        // and is not an incomplete streaming entry
        const cachedRating = tweetCache.get(tweetId);
        if (cachedRating) {
            const isValidCacheEntry =
                cachedRating.score !== undefined &&
                cachedRating.score !== null &&
                !(cachedRating.streaming === true && cachedRating.score === undefined);

            if (isValidCacheEntry) {
                const cacheApplied = applyTweetCachedRating(tweetArticle);
                if (cacheApplied) {
                    // Verify the indicator exists after applying cached rating
                    if (!tweetArticle.querySelector('.score-indicator')) {
                        console.error(`Missing indicator after applying cached rating to tweet ${tweetId}`);
                        processingSuccessful = false;
                    } else {
                        processingSuccessful = true;
                    }
                    return;
                }
            } else if (cachedRating.streaming === true) {
                // This is a streaming entry that's still in progress
                // Don't delete it, but don't use it either
                console.log(`Tweet ${tweetId} has incomplete streaming cache entry, continuing with processing`);
            } else {
                // Invalid cache entry, delete it
                console.warn(`Invalid cache entry for tweet ${tweetId}, removing from cache`, cachedRating);
                tweetCache.delete(tweetId);
            }
        }

        const fullContextWithImageDescription = await getFullContext(tweetArticle, tweetId, apiKey);
        if (!fullContextWithImageDescription) {
            throw new Error("Failed to get tweet context");
        }
        
        // Add thread relationship context
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

        //Get the media URLS from the entire fullContextWithImageDescription, and pass that to the rating engine
        //This allows us to get the media links from the thread history as well
        const mediaURLs = [];
        // Extract regular media URLs
        const mediaMatches = fullContextWithImageDescription.match(/\[MEDIA_URLS\]:\s*\n(.*?)(?:\n|$)/);
        if (mediaMatches && mediaMatches[1]) {
            mediaURLs.push(...mediaMatches[1].split(', '));
        }
        // Extract quoted tweet media URLs
        const quotedMediaMatches = fullContextWithImageDescription.match(/\[QUOTED_TWEET_MEDIA_URLS\]:\s*\n(.*?)(?:\n|$)/);
        if (quotedMediaMatches && quotedMediaMatches[1]) {
            mediaURLs.push(...quotedMediaMatches[1].split(', '));
        }

        // --- API Call or Fallback ---
        if (apiKey && fullContextWithImageDescription) {
            try {
                // Check if there's already a complete entry in the cache before calling the API
                const isCached = tweetCache.has(tweetId) &&
                    !tweetCache.get(tweetId).streaming &&
                    tweetCache.get(tweetId).score !== undefined;
                const rating = await rateTweetWithOpenRouter(fullContextWithImageDescription, tweetId, apiKey, mediaURLs);
                score = rating.score;
                description = rating.content;

                // Check if this rating was loaded from storage
                if (tweetCache.has(tweetId) && tweetCache.get(tweetId).fromStorage === true) {
                    // If it was loaded from storage, mark it as cached
                    tweetArticle.dataset.ratingStatus = 'cached';
                } else {
                    // Otherwise use the normal logic
                    tweetArticle.dataset.ratingStatus = rating.error ? 'error' : (isCached || rating.cached ? 'cached' : 'rated');
                }
                tweetArticle.dataset.ratingDescription = description || "not available";
                tweetArticle.dataset.sloppinessScore = score.toString();

                if (!isUserBlacklisted(userHandle)){
                try {
                    setScoreIndicator(tweetArticle, score, tweetArticle.dataset.ratingStatus, tweetArticle.dataset.ratingDescription);
                    // Verify the indicator exists
                    if (!tweetArticle.querySelector('.score-indicator')) {
                        throw new Error("Failed to create score indicator");
                    }
                    // Log indicator classes after setting

                } catch (e) {
                    console.error(`Error setting rated indicator for tweet ${tweetId}:`, e);
                    // Continue even if indicator fails - we've set the dataset properties
                }

                filterSingleTweet(tweetArticle);
            }
                processingSuccessful = !rating.error;
                // Store the full context after rating is complete
                if (!rating.error) {
                    if (tweetCache.has(tweetId)) {
                        tweetCache.get(tweetId).score = score;
                        tweetCache.get(tweetId).description = description;
                        tweetCache.get(tweetId).tweetContent = fullContextWithImageDescription;
                        tweetCache.get(tweetId).streaming = false; // Mark as complete
                    } else {
                        tweetCache.set(tweetId, {
                            score: score,
                            description: description,
                            tweetContent: fullContextWithImageDescription,
                            streaming: false // Mark as complete
                        });
                    }

                    // Save ratings to persistent storage
                    saveTweetRatings();
                } else {
                    // On error, remove any existing cache entry to allow retry
                    if (tweetCache.has(tweetId)) {
                        tweetCache.delete(tweetId);
                        saveTweetRatings();
                    }
                }

            } catch (apiError) {
                score = 10; // Fallback to a random score
                tweetArticle.dataset.ratingStatus = 'error';
                tweetArticle.dataset.ratingDescription = "API error";
                // Don't consider API errors as successful processing
                processingSuccessful = false;
            }
        } else if (fullContextWithImageDescription) {
            score = 10;
            //show all tweets that errored
            tweetArticle.dataset.ratingStatus = 'error';
            tweetArticle.dataset.ratingDescription = "No API key";
            processingSuccessful = true;
        } else {
            //show all tweets that errored
            score = 10;
            tweetArticle.dataset.ratingStatus = 'error';
            tweetArticle.dataset.ratingDescription = "No content";
            processingSuccessful = true;
        }

        // Always ensure a valid score is set
        if (score === undefined || score === null) {
            score = 5;
        }

        tweetArticle.dataset.sloppinessScore = score.toString();
        try {
            //group should default to closed
            console.groupCollapsed(`Tweet Rating ${tweetId} by ${userHandle} Score: ${score}`);
            console.log(`Tweet ${tweetId}`);
            console.log(`${fullContextWithImageDescription}`);
            console.log(`Status ${tweetArticle.dataset.ratingStatus}`);
            console.log(`Score ${score}`);
            console.log(`Model ${browserGet('selectedModel', '')}`);console.log(`Description ${description}`);
            console.groupEnd();
            setScoreIndicator(tweetArticle, score, tweetArticle.dataset.ratingStatus, tweetArticle.dataset.ratingDescription || "");
            // Final verification of indicator
            if (!tweetArticle.querySelector('.score-indicator')) {
                processingSuccessful = false;
            }
        } catch (e) {
            console.error(`Final error setting indicator for tweet ${tweetId}:`, e);
            processingSuccessful = false;
        }
        filterSingleTweet(tweetArticle);
    } catch (error) {
        console.error(`Error processing tweet ${tweetId}: ${error}`);
        if (!tweetArticle.dataset.sloppinessScore) {
            tweetArticle.dataset.sloppinessScore = '5';
            tweetArticle.dataset.ratingStatus = 'error';
            tweetArticle.dataset.ratingDescription = "error processing tweet";
            try {
                setScoreIndicator(tweetArticle, 5, 'error', 'Error processing tweet');
                // Verify indicator exists
                if (!tweetArticle.querySelector('.score-indicator')) {
                    console.error(`Failed to create error indicator for tweet ${tweetId}`);
                }
            } catch (e) {
                console.error(`Error setting error indicator for tweet ${tweetId}:`, e);
            }
            filterSingleTweet(tweetArticle);
        }
        processingSuccessful = false;
    } finally {
        // If processing was not successful, remove from processedTweets
        // to allow future retry attempts
        if (!processingSuccessful) {
            processedTweets.delete(tweetId);
        }
    }
}

/**
 * Schedules processing of a tweet if it hasn't been processed yet.
 * @param {Element} tweetArticle - The tweet element.
 */
function scheduleTweetProcessing(tweetArticle) {
    // First, ensure the tweet has a valid ID
    const tweetId = getTweetID(tweetArticle);
    if (!tweetId) {
        return;
    }

    // Fast-path: if author is blacklisted, assign score immediately
    const handles = getUserHandles(tweetArticle);
    const userHandle = handles.length > 0 ? handles[0] : '';
    if (userHandle && isUserBlacklisted(userHandle)) {
        tweetArticle.dataset.sloppinessScore = '10';
        tweetArticle.dataset.blacklisted = 'true';
        tweetArticle.dataset.ratingStatus = 'blacklisted';
        tweetArticle.dataset.ratingDescription = "Whitelisted user";
        setScoreIndicator(tweetArticle, 10, 'blacklisted', "User is whitelisted");
        filterSingleTweet(tweetArticle);
        return;
    }

    // Check for a cached rating, but be careful with streaming cache entries
    if (tweetCache.has(tweetId)) {
        // Only apply cached rating if it has a valid score and isn't an incomplete streaming entry
        const isIncompleteStreaming =
            tweetCache.get(tweetId).streaming === true &&
            (tweetCache.get(tweetId).score === undefined || tweetCache.get(tweetId).score === null);
        
        if (!isIncompleteStreaming) {
            const wasApplied = applyTweetCachedRating(tweetArticle);
            if (wasApplied) {
                // Force redraw filter to ensure the tweet is properly filtered
                filterSingleTweet(tweetArticle);
                return;
            }
        }
    }

    // Skip if already processed in this session
    if (processedTweets.has(tweetId)) {
        // Verify that the tweet actually has an indicator - if not, remove from processed
        const hasIndicator = !!tweetArticle.querySelector('.score-indicator');
        if (!hasIndicator) {
            console.warn(`Tweet ${tweetId} was marked as processed but has no indicator, reprocessing`);
            processedTweets.delete(tweetId);
        } else {
            return;
        }
    }

    // Immediately mark as pending before scheduling actual processing
    if (!processedTweets.has(tweetId)) {
        processedTweets.add(tweetId);
    }
    tweetArticle.dataset.ratingStatus = 'pending';

    // Ensure indicator is set
    try {
        setScoreIndicator(tweetArticle, null, 'pending');
    } catch (e) {
        console.error(`Failed to set indicator for tweet ${tweetId}:`, e);
    }

    // Now schedule the actual rating processing
    setTimeout(() => {
        try {
            delayedProcessTweet(tweetArticle, tweetId);
        } catch (e) {
            console.error(`Error in delayed processing of tweet ${tweetId}:`, e);
            processedTweets.delete(tweetId);
        }
    }, PROCESSING_DELAY_MS);
}

// Add this near the beginning of the file with other global variables
// Store reply relationships across sessions
let threadRelationships = {};
let lastThreadCheck = 0;
const THREAD_CHECK_INTERVAL = 2000; // 2 seconds between thread checks
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
async function buildReplyChain(tweetId, maxDepth = 5) {
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
    const handles = getUserHandles(tweetArticle);

    const userHandle = handles.length > 0 ? handles[0] : '';
    const quotedHandle = handles.length > 1 ? handles[1] : '';
    // --- Extract Main Tweet Content ---
    const mainText = getElementText(tweetArticle.querySelector(TWEET_TEXT_SELECTOR));
    
    // Allow a small delay for images to load
    await new Promise(resolve => setTimeout(resolve, 10));
    
    let allMediaLinks = extractMediaLinks(tweetArticle);

    // --- Extract Quoted Tweet Content (if any) ---
    let quotedText = "";
    let quotedMediaLinks = [];
    let quotedTweetId = null;
    
    const quoteContainer = tweetArticle.querySelector(QUOTE_CONTAINER_SELECTOR);
    if (quoteContainer) {
        // Try to get the quoted tweet ID from the link
        const quotedLink = quoteContainer.querySelector('a[href*="/status/"]');
        if (quotedLink) {
            const href = quotedLink.getAttribute('href');
            const match = href.match(/\/status\/(\d+)/);
            if (match && match[1]) {
                quotedTweetId = match[1];
            }
        }
        
        quotedText = getElementText(quoteContainer.querySelector(TWEET_TEXT_SELECTOR)) || "";
        // Short delay to ensure quoted tweet images are loaded
        await new Promise(resolve => setTimeout(resolve, 20));
        quotedMediaLinks = extractMediaLinks(quoteContainer);
    }
    
    // Get thread media URLs from cache if available
    const conversation = document.querySelector('div[aria-label="Timeline: Conversation"]') || 
        document.querySelector('div[aria-label^="Timeline: Conversation"]');
    
    let threadMediaUrls = [];
    if (conversation && conversation.dataset.threadMapping && tweetCache.has(tweetId) && tweetCache.get(tweetId).threadContext?.threadMediaUrls) {
        // Get thread media URLs from cache if available
        threadMediaUrls = tweetCache.get(tweetId).threadContext.threadMediaUrls || [];
    } else if (conversation && conversation.dataset.threadMediaUrls) {
        // Or get them from the dataset if available
        try {
            const allMediaUrls = JSON.parse(conversation.dataset.threadMediaUrls);
            threadMediaUrls = Array.isArray(allMediaUrls) ? allMediaUrls : [];
        } catch (e) {
            console.error("Error parsing thread media URLs:", e);
        }
    }
    
    // Combine all media URLs: current tweet + quoted tweet + thread context
    let allAvailableMediaLinks = [...allMediaLinks];
    
    // Remove any media links from the main tweet that also appear in the quoted tweet
    let mainMediaLinks = allAvailableMediaLinks.filter(link => !quotedMediaLinks.includes(link));
    
    // Start building the context
    let fullContextWithImageDescription = `[TWEET ${tweetId}]
 Author:@${userHandle}:
` + mainText;

    // Add media from the current tweet
    if (mainMediaLinks.length > 0) {
        // Process main tweet images only if image descriptions are enabled
        if (enableImageDescriptions = browserGet('enableImageDescriptions', false)) {
            let mainMediaLinksDescription = await getImageDescription(mainMediaLinks, apiKey, tweetId, userHandle);
            fullContextWithImageDescription += `
[MEDIA_DESCRIPTION]:
${mainMediaLinksDescription}`;
        }
        // Just add the URLs when descriptions are disabled
        fullContextWithImageDescription += `
[MEDIA_URLS]:
${mainMediaLinks.join(", ")}`;
    }
    
    // Add thread media URLs if this is a reply and we have previous media
    if (!isOriginalTweet(tweetArticle) && threadMediaUrls.length > 0) {
        // Filter out duplicates
        const uniqueThreadMediaUrls = threadMediaUrls.filter(url => 
            !mainMediaLinks.includes(url) && !quotedMediaLinks.includes(url));
            
        if (uniqueThreadMediaUrls.length > 0) {
            fullContextWithImageDescription += `
[THREAD_MEDIA_URLS]:
${uniqueThreadMediaUrls.join(", ")}`;
        }
    }
        
    // --- Quoted Tweet Handling ---
    if (quotedText || quotedMediaLinks.length > 0) {
        fullContextWithImageDescription += `
[QUOTED_TWEET${quotedTweetId ? ' ' + quotedTweetId : ''}]:
 Author:@${quotedHandle}:
${quotedText}`;
        if (quotedMediaLinks.length > 0) {
            // Process quoted tweet images only if image descriptions are enabled
            if (enableImageDescriptions) {
                let quotedMediaLinksDescription = await getImageDescription(quotedMediaLinks, apiKey, tweetId, userHandle);
                fullContextWithImageDescription += `
[QUOTED_TWEET_MEDIA_DESCRIPTION]:
${quotedMediaLinksDescription}`;
            }
            // Just add the URLs when descriptions are disabled
            fullContextWithImageDescription += `
[QUOTED_TWEET_MEDIA_URLS]:
${quotedMediaLinks.join(", ")}`;
        }
    }
    
    // --- Get complete reply chain using persistent relationships ---
    const replyChain = await buildReplyChain(tweetId);
    
    // --- Conversation Thread Handling ---
    let threadHistoryIncluded = false;
    if (conversation && conversation.dataset.threadHist) {
        // If this tweet is not the original tweet, prepend the thread history.
        if (!isOriginalTweet(tweetArticle)) {
            fullContextWithImageDescription = conversation.dataset.threadHist + `
[REPLY]
` + fullContextWithImageDescription;
            threadHistoryIncluded = true;
        }
    }
    
    // Add recursive reply chain information if available and not already included in thread history
    if (replyChain.length > 0 && !threadHistoryIncluded) {
        let replyChainText = '\n[REPLY CHAIN]\n';
        
        for (let i = replyChain.length - 1; i >= 0; i--) {
            const link = replyChain[i];
            replyChainText += `Tweet ${link.fromId} by @${link.from || 'unknown'} is a reply to tweet ${link.toId} by @${link.to || 'unknown'}\n`;
        }
        
        fullContextWithImageDescription = replyChainText + fullContextWithImageDescription;
    }
    
    // Individual reply marker if needed
    const replyInfo = getTweetReplyInfo(tweetId);
    if (replyInfo && replyInfo.replyTo && !threadHistoryIncluded && replyChain.length === 0) {
        fullContextWithImageDescription = `[REPLY TO TWEET ${replyInfo.replyTo}]\n` + fullContextWithImageDescription;
    }
    
    tweetArticle.dataset.fullContext = fullContextWithImageDescription;
    return fullContextWithImageDescription;
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
    if (!observedTargetNode) return;
    const tweets = observedTargetNode.querySelectorAll(TWEET_ARTICLE_SELECTOR);

    if (tweets.length > 0) {
        console.log(`Checking ${tweets.length} tweets to ensure all are rated...`);
        let unreatedCount = 0;

        tweets.forEach(tweet => {
            const tweetId = getTweetID(tweet);
            if (!tweetId) return; // Skip tweets without a valid ID

            // Check for any issues that would require processing:
            // 1. No score data attribute
            // 2. Error status
            // 3. Missing indicator element (even if in processedTweets)
            const hasScore = !!tweet.dataset.sloppinessScore;
            const hasError = tweet.dataset.ratingStatus === 'error';
            const hasIndicator = !!tweet.querySelector('.score-indicator');
            const isStreaming = tweet.dataset.ratingStatus === 'streaming';

            // If tweet is in processedTweets but missing indicator, remove it from processed
            if (processedTweets.has(tweetId) && !hasIndicator) {
                console.warn(`Tweet ${tweetId} in processedTweets but missing indicator, removing`);
                processedTweets.delete(tweetId);
            }

            // Schedule processing if needed and not already in progress
            const needsProcessing = (!hasScore && !isStreaming) || hasError || !hasIndicator;
            if (needsProcessing && !processedTweets.has(tweetId)) {
                unreatedCount++;
                const status = !hasIndicator ? 'missing indicator' :
                    !hasScore ? 'unrated' :
                        hasError ? 'error' : 'unknown issue';

                //console.log(`Found tweet ${tweetId} with ${status}, scheduling processing`);
                scheduleTweetProcessing(tweet);
            }
        });

        if (unreatedCount > 0) {
            //console.log(`Scheduled ${unreatedCount} tweets for processing`);
        }
    }
}

async function handleThreads() {
    try {
        // Don't check too frequently
        const now = Date.now();
        if (now - lastThreadCheck < THREAD_CHECK_INTERVAL) {
            return;
        }
        lastThreadCheck = now;
        
        // Find the conversation timeline using a more specific selector
        let conversation = document.querySelector('div[aria-label="Timeline: Conversation"]');
        if (!conversation) {
            conversation = document.querySelector('div[aria-label^="Timeline: Conversation"]');
        }
        
        if (!conversation) return;

        // More reliable state checking with both DOM and memory-based flags
        if (threadMappingInProgress || conversation.dataset.threadHist === "pending") {
            return; // Don't interrupt pending operations
        }
        
        // Add protection to avoid re-processing if we already mapped this thread recently
        if (conversation.dataset.threadMappedAt) {
            const lastMappedTime = parseInt(conversation.dataset.threadMappedAt, 10);
            // If we've mapped this thread in the last 10 seconds, skip
            if (now - lastMappedTime < 10000) {
                return;
            }
        }

        // Extract the root tweet ID from the URL for improved thread mapping
        const match = location.pathname.match(/status\/(\d+)/);
        const localRootTweetId = match ? match[1] : null;
        
        if (!localRootTweetId) return; // Only proceed if we can identify the root tweet
        
        // Initialize thread history
        if (conversation.dataset.threadHist === undefined) {
            // Original behavior - initialize thread history
            threadHist = "";
            const firstArticle = document.querySelector('article[data-testid="tweet"]');
            if (firstArticle) {
                conversation.dataset.threadHist = 'pending';
                threadMappingInProgress = true; // Set memory-based flag
                
                try {
                    const tweetId = getTweetID(firstArticle);
                    if (!tweetId) {
                        throw new Error("Failed to get tweet ID from first article");
                    }
                    
                    // Get the full context of the root tweet
                    const apiKey = browserGet('openrouter-api-key', '');
                    const fullcxt = await getFullContext(firstArticle, tweetId, apiKey);
                    if (!fullcxt) {
                        throw new Error("Failed to get full context for root tweet");
                    }
                    
                    threadHist = fullcxt;
                    conversation.dataset.threadHist = threadHist;
                    
                    if (conversation.firstChild) {
                        conversation.firstChild.dataset.canary = "true";
                    }
                    
                    // Schedule processing for the original tweet
                    if (!processedTweets.has(tweetId)) {
                        scheduleTweetProcessing(firstArticle);
                    }
                    
                    // Use improved thread detection to map the structure
                    setTimeout(() => {
                        mapThreadStructure(conversation, localRootTweetId);
                    }, 500);
                } catch (error) {
                    console.error("Error initializing thread history:", error);
                    // Clean up on error
                    threadMappingInProgress = false;
                    delete conversation.dataset.threadHist;
                }
                
                return;
            }
        } else if (conversation.dataset.threadHist !== "pending" && 
                  conversation.firstChild && 
                  conversation.firstChild.dataset.canary === undefined) {
            // Original behavior for deep-diving into replies
            if (conversation.firstChild) {
                conversation.firstChild.dataset.canary = "pending";
            }
            threadMappingInProgress = true; // Set memory-based flag
            
            try {
                const nextArticle = document.querySelector('article[data-testid="tweet"]:has(~ div[data-testid="inline_reply_offscreen"])');
                if (nextArticle) {
                    const tweetId = getTweetID(nextArticle);
                    if (!tweetId) {
                        throw new Error("Failed to get tweet ID from next article");
                    }
                    
                    if (tweetCache.has(tweetId) && tweetCache.get(tweetId).tweetContent) {
                        threadHist = threadHist + "\n[REPLY]\n" + tweetCache.get(tweetId).tweetContent;
                    } else {
                        const apiKey = browserGet('openrouter-api-key', '');
                        await new Promise(resolve => setTimeout(resolve, 100));
                        const newContext = await getFullContext(nextArticle, tweetId, apiKey);
                        if (!newContext) {
                            throw new Error("Failed to get context for next article");
                        }
                        threadHist = threadHist + "\n[REPLY]\n" + newContext;
                    }
                    conversation.dataset.threadHist = threadHist;
                }
                
                // Map thread structure after updating history
                setTimeout(() => {
                    mapThreadStructure(conversation, localRootTweetId);
                }, 500);
            } catch (error) {
                console.error("Error processing reply:", error);
                // Clean up on error
                threadMappingInProgress = false;
                if (conversation.firstChild) {
                    delete conversation.firstChild.dataset.canary;
                }
            }
        } else if (!threadMappingInProgress && !conversation.dataset.threadMappingInProgress) {
            // Run thread mapping periodically to catch new tweets loaded during scrolling
            threadMappingInProgress = true; // Set memory-based flag
            
            setTimeout(() => {
                mapThreadStructure(conversation, localRootTweetId);
            }, 500);
        }
    } catch (error) {
        console.error("Error in handleThreads:", error);
        // Clean up all state on error
        threadMappingInProgress = false;
    }
}

// Enhance the thread mapping to associate usernames with tweet IDs
async function mapThreadStructure(conversation, localRootTweetId) {
    // Mark mapping in progress to prevent duplicate processing
    conversation.dataset.threadMappingInProgress = "true";
    conversation.dataset.threadMappedAt = Date.now().toString();
    threadMappingInProgress = true; // Set memory-based flag
    
    try {
        // Use a timeout promise to prevent hanging
        const timeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Thread mapping timed out')), 5000)
        );
        
        // The actual mapping function
        const mapping = async () => {
            // Process all visible tweets using the cellInnerDiv structure for improved mapping
            let cellDivs = Array.from(document.querySelectorAll('div[data-testid="cellInnerDiv"]'));
            if (!cellDivs.length) {
                console.log("No cell divs found, thread mapping aborted");
                delete conversation.dataset.threadMappingInProgress;
                threadMappingInProgress = false;
                return;
            }
            
            let tweetCells = [];
            let processedCount = 0;
            
            // First pass: collect all tweet data
            for (let idx = 0; idx < cellDivs.length; idx++) {
                const cell = cellDivs[idx];
                const article = cell.querySelector('article[data-testid="tweet"]');
                if (!article) continue;
                
                // Extract tweet metadata with proper error handling
                try {
                    let tweetId = getTweetID(article);
                    if (!tweetId) {
                        let tweetLink = article.querySelector('a[href*="/status/"]');
                        if (tweetLink) {
                            let match = tweetLink.href.match(/status\/(\d+)/);
                            if (match) tweetId = match[1];
                        }
                    }
                    
                    // Skip if we still can't get a tweet ID
                    if (!tweetId) continue;
                    
                    // Extract username using existing functions if available
                    const handles = getUserHandles(article);
                    let username = handles.length > 0 ? handles[0] : null;
                    
                    // Skip if we can't get a username
                    if (!username) continue;
                    
                    // Extract tweet text
                    let tweetTextSpan = article.querySelector('[data-testid="tweetText"]');
                    let text = tweetTextSpan ? tweetTextSpan.innerText.trim().replace(/\n+/g, ' ⏎ ') : '';
                    
                    // Extract media links from this tweet
                    let mediaLinks = extractMediaLinks(article);
                    
                    // Extract quoted tweet media if any
                    let quotedMediaLinks = [];
                    const quoteContainer = article.querySelector(QUOTE_CONTAINER_SELECTOR);
                    if (quoteContainer) {
                        quotedMediaLinks = extractMediaLinks(quoteContainer);
                    }
                    
                    // Detect reply structure based on DOM
                    let prevCell = cellDivs[idx - 1] || null;
                    let isReplyToRoot = false;
                    if (prevCell && prevCell.childElementCount === 1) {
                        let onlyChild = prevCell.children[0];
                        if (onlyChild && onlyChild.children.length === 0 && onlyChild.innerHTML.trim() === '') {
                            isReplyToRoot = true;
                        }
                    }
                    
                    tweetCells.push({
                        tweetNode: article,
                        username,
                        tweetId,
                        text,
                        mediaLinks,
                        quotedMediaLinks,
                        cellIndex: idx,
                        isReplyToRoot,
                        cellDiv: cell,
                        index: processedCount++
                    });
                    
                    // Schedule processing for this tweet if not already processed
                    if (!processedTweets.has(tweetId)) {
                        scheduleTweetProcessing(article);
                    }
                } catch (err) {
                    console.error("Error processing tweet in mapThreadStructure:", err);
                    // Continue with next tweet
                    continue;
                }
            }
            
            // Build reply structure only if we have tweets to process
            if (tweetCells.length === 0) {
                console.log("No valid tweets found, thread mapping aborted");
                delete conversation.dataset.threadMappingInProgress;
                threadMappingInProgress = false;
                return;
            }
            
            // Second pass: build the reply structure with the right relationship chain
            for (let i = 0; i < tweetCells.length; ++i) {
                let tw = tweetCells[i];
                if (tw.tweetId === localRootTweetId) {
                    tw.replyTo = null;
                    tw.isRoot = true;
                } else if (tw.isReplyToRoot) {
                    let root = tweetCells.find(tk => tk.tweetId === localRootTweetId);
                    tw.replyTo = root ? root.username : null;
                    tw.replyToId = root ? root.tweetId : null;
                    tw.isRoot = false;
                } else if (i > 0) {
                    tw.replyTo = tweetCells[i - 1].username;
                    tw.replyToId = tweetCells[i - 1].tweetId;
                    tw.isRoot = false;
                }
            }
            
            // Create thread mapping with media URLs for context generation
            const replyDocs = tweetCells.map(tw => ({
                from: tw.username,
                tweetId: tw.tweetId,
                to: tw.replyTo,
                toId: tw.replyToId,
                isRoot: tw.isRoot === true,
                text: tw.text,
                mediaLinks: tw.mediaLinks || [],
                quotedMediaLinks: tw.quotedMediaLinks || []
            }));
            
            // Third pass: enhance with additional relationship information
            // If a tweet is a reply to another tweet not in this view, check 
            // our persistent relationships to add that info
            for (let tw of tweetCells) {
                if (!tw.replyToId && !tw.isRoot && threadRelationships[tw.tweetId]?.replyTo) {
                    // Found a reply relationship from persistent storage that isn't captured in this view
                    tw.replyToId = threadRelationships[tw.tweetId].replyTo;
                    tw.replyTo = threadRelationships[tw.tweetId].to;
                    
                    // Update the corresponding replyDoc
                    const doc = replyDocs.find(d => d.tweetId === tw.tweetId);
                    if (doc) {
                        doc.toId = tw.replyToId;
                        doc.to = tw.replyTo;
                    }
                }
            }
            
            // Store the thread mapping in a dataset attribute for debugging
            conversation.dataset.threadMapping = JSON.stringify(replyDocs);
            
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
            
            // Build thread history with full context including media links
            let completeThreadHistory = "";
            
            // Start with the root post
            const rootTweet = replyDocs.find(t => t.isRoot === true);
            if (rootTweet && rootTweet.tweetId) {
                const rootTweetElement = tweetCells.find(t => t.tweetId === rootTweet.tweetId)?.tweetNode;
                if (rootTweetElement) {
                    try {
                        const apiKey = browserGet('openrouter-api-key', '');
                        const rootContext = await getFullContext(rootTweetElement, rootTweet.tweetId, apiKey);
                        if (rootContext) {
                            completeThreadHistory = rootContext;
                            // Store the thread history in dataset for getFullContext to use
                            conversation.dataset.threadHist = completeThreadHistory;
                            
                            // Also store the comprehensive media URLs from the entire thread
                            const allMediaUrls = [];
                            replyDocs.forEach(doc => {
                                if (doc.mediaLinks && doc.mediaLinks.length) {
                                    allMediaUrls.push(...doc.mediaLinks);
                                }
                                if (doc.quotedMediaLinks && doc.quotedMediaLinks.length) {
                                    allMediaUrls.push(...doc.quotedMediaLinks);
                                }
                            });
                            
                            if (allMediaUrls.length > 0) {
                                conversation.dataset.threadMediaUrls = JSON.stringify(allMediaUrls);
                            }
                        }
                    } catch (error) {
                        console.error("Error getting root context:", error);
                        // Continue processing even if full context fails
                    }
                }
            }
            
            
            // Fourth pass: Update the cache with thread context
            // but with a limit on how many we process at once
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
        };
        
        // Helper function to get all media URLs from tweets that came before the current one in the thread
        function getAllPreviousMediaUrls(tweetId, replyDocs) {
            const allMediaUrls = [];
            const index = replyDocs.findIndex(doc => doc.tweetId === tweetId);
            
            if (index > 0) {
                // Get all media URLs from tweets before this one in the thread
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
        delete conversation.dataset.threadMappedAt;
        delete conversation.dataset.threadMappingInProgress;
        threadMappingInProgress = false;
    }
}

// For use in getFullContext to check if a tweet is a reply using persistent relationships
function getTweetReplyInfo(tweetId) {
    if (threadRelationships[tweetId]) {
        return threadRelationships[tweetId];
    }
    return null;
}

