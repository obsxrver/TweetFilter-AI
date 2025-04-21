//src/ratingEngine.js
/**
 * Applies filtering to a single tweet by hiding it if its score is below the threshold.
 * Also updates the rating indicator.
 * @param {Element} tweetArticle - The tweet element.
 */
function filterSingleTweet(tweetArticle) {
    const score = parseInt(tweetArticle.dataset.sloppinessScore || '9', 10);
    const tweetId = getTweetID(tweetArticle);
    const indicatorInstance = ScoreIndicatorRegistry.get(tweetId); // Get instance (don't create here)

    // If no instance exists, we can't filter reliably based on status yet.
    // We could potentially hide it by default, but let's assume scheduleTweetProcessing handles creation.
    if (!indicatorInstance) return;

    // Ensure the indicator is attached to *this specific* article element
    indicatorInstance.ensureIndicatorAttached();
    const currentFilterThreshold = parseInt(browserGet('filterThreshold', '1'));
    const ratingStatus = tweetArticle.dataset.ratingStatus;
    const cell = tweetArticle.closest('div[data-testid="cellInnerDiv"]');
    if (!cell) {
         console.warn("Couldn't find cellInnerDiv for tweet:", tweetId);
         return;
    }

    // If the tweet is still pending/streaming a rating, keep it visible
    if (ratingStatus === 'pending' || ratingStatus === 'streaming') {
        cell.style.display = '';
    } else if (isNaN(score) || score < currentFilterThreshold) {
        cell.innerHTML = '';
    } else {
        // Show otherwise
        cell.style.display = '';
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
        // Use the ScoreIndicator instance to update UI
        ScoreIndicatorRegistry.get(tweetId, tweetArticle)?.update({
            status: 'blacklisted',
            score: 10,
            description: "User is whitelisted"
        });
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

            let status = 'rated'; // Default status
            // If it's a streaming entry that's not complete, mark as streaming instead of cached
            if (cachedRating.streaming === true && !cachedRating.score) {
                status = 'streaming';
                // No need to update indicator yet if still streaming incomplete data
                 console.log(`Tweet ${tweetId} has incomplete streaming cache, skipping immediate indicator update.`);
                 return false; // Don't treat as successfully applied cache yet
            } else {
                // Check if this rating is from storage (cached) or newly created
                const isFromStorage = cachedRating.fromStorage === true;
                status = isFromStorage ? 'cached' : 'rated';
            }
            
            // Update the indicator via the registry
            ScoreIndicatorRegistry.get(tweetId, tweetArticle)?.update({
                 status: status,
                 score: score,
                 description: desc,
                 reasoning: reasoning
            });

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
        ScoreIndicatorRegistry.get(tweetId, tweetArticle)?.update({
            status: 'error',
            score: 9, // Or a default error score like 9?
            description: "No API key"
        });
        filterSingleTweet(tweetArticle);
        // Remove from processedTweets to allow retrying
        processedTweets.delete(tweetId);
        console.error(`Failed to process tweet ${tweetId}: No API key`);
        return;
    }
    let score = 5; // Default score if rating fails
    let description = "";
    let processingSuccessful = false;
    let reasoning = "";
    try {
        const cachedRating = tweetCache.get(tweetId);
        if (cachedRating) {
            // Handle incomplete streaming entries specifically
            if (cachedRating.streaming === true &&
               (cachedRating.score === undefined || cachedRating.score === null)) {
                console.log(`Tweet ${tweetId} has incomplete streaming cache entry, continuing with processing`);
            }
            // REDUNDANT CACHE APPLICATION REMOVED: applyTweetCachedRating was already called in scheduleTweetProcessing
            // We will check cache again *before* the API call below.
            else if (!cachedRating.streaming && (cachedRating.score === undefined || cachedRating.score === null)) {
                // Invalid cache entry (non-streaming but missing score), delete it
                console.warn(`Invalid cache entry for tweet ${tweetId}, removing from cache`, cachedRating);
                tweetCache.delete(tweetId);
            }
        }
        // END REMOVED/MODIFIED BLOCK

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
                     processingSuccessful = true;
                     console.log(`Using valid cache entry found for ${tweetId} before API call.`);

                     // Update UI using cached data
                     ScoreIndicatorRegistry.get(tweetId, tweetArticle)?.update({
                         status: currentCache.fromStorage ? 'cached' : 'rated', // Determine status based on cache source
                         score: score,
                         description: description,
                         reasoning: reasoning
                     });
                     filterSingleTweet(tweetArticle);
                     return; // Exit after using cache
                }

                // If not cached, proceed with API call
                const rating = await rateTweetWithOpenRouter(fullContextWithImageDescription, tweetId, apiKey, mediaURLs, 3, tweetArticle);
                score = rating.score;
                description = rating.content;
                reasoning = rating.reasoning || ''; // Get reasoning from result

                // Determine status based on cache/error state
                let finalStatus = rating.error ? 'error' : 'rated';
                if (!rating.error) {
                    const cacheEntry = tweetCache.get(tweetId);
                    if (cacheEntry && cacheEntry.fromStorage) {
                        finalStatus = 'cached';
                    } else if (rating.cached) { // Check if the API function itself marked it as cached
                         finalStatus = 'cached';
                    }
                }

                // Update tweet dataset (might still be useful for debugging/other features)
                tweetArticle.dataset.ratingStatus = finalStatus;
                tweetArticle.dataset.ratingDescription = description || "not available";
                tweetArticle.dataset.sloppinessScore = score?.toString() || '';
                tweetArticle.dataset.ratingReasoning = reasoning;

                // Update UI via ScoreIndicator
                ScoreIndicatorRegistry.get(tweetId, tweetArticle)?.update({
                    status: finalStatus,
                    score: score,
                    description: description,
                    reasoning: reasoning
                });

                processingSuccessful = !rating.error;
                if (tweetCache.has(tweetId)) {
                    const entry = tweetCache.get(tweetId);
                    entry.score = score;
                    entry.description = description;
                    entry.reasoning = reasoning; // Store reasoning in cache
                    entry.tweetContent = fullContextWithImageDescription;
                    entry.streaming = false; // Mark as complete
                    if (rating.error) entry.error = true; // Mark error in cache
                } else if (!rating.error) {
                    tweetCache.set(tweetId, {
                        score: score,
                        description: description,
                        reasoning: reasoning,
                        tweetContent: fullContextWithImageDescription,
                        streaming: false // Mark as complete
                    });
                }

                filterSingleTweet(tweetArticle);
                // Return after API call attempt
                return;

            } catch (apiError) {
                console.error(`API error processing tweet ${tweetId}:`, apiError);
                score = 5; // Fallback score on API error
                description = `API Error: ${apiError.message}`;
                reasoning = '';
                processingSuccessful = false;
                // Update UI to reflect API error state
                ScoreIndicatorRegistry.get(tweetId, tweetArticle)?.update({
                    status: 'error',
                    score: score,
                    description: description
                });
                if (tweetCache.has(tweetId)) {
                     tweetCache.get(tweetId).streaming = false;
                }
                // Need to filter after error state update
                 filterSingleTweet(tweetArticle);
                 // Return after API error handling
                 return;
            }
        }
        filterSingleTweet(tweetArticle);

    } catch (error) {
        console.error(`Generic error processing tweet ${tweetId}: ${error}`, error.stack);
        // Ensure some error state is shown if processing fails unexpectedly
         const indicatorInstance = ScoreIndicatorRegistry.get(tweetId);
         if (indicatorInstance && indicatorInstance.status !== 'error') {
            indicatorInstance.update({
                status: 'error',
                score: 5, // Default error score
                description: "Error during processing: " + error.message
            });
        }
        filterSingleTweet(tweetArticle); // Apply filtering even on generic error
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

    const existingInstance = ScoreIndicatorRegistry.get(tweetId);
    if (existingInstance) {
         existingInstance.ensureIndicatorAttached();
         // Re-apply filtering just in case
         filterSingleTweet(tweetArticle);
         // Don't proceed with scheduling if already processed/rated/cached/blacklisted
         if (existingInstance.status !== 'error' && existingInstance.status !== 'pending') {
              return; 
         }
    }

    // Fast-path: if author is blacklisted, assign score immediately
    const handles = getUserHandles(tweetArticle);
    const userHandle = handles.length > 0 ? handles[0] : '';
    if (userHandle && isUserBlacklisted(userHandle)) {
        tweetArticle.dataset.sloppinessScore = '10';
        tweetArticle.dataset.blacklisted = 'true';
        tweetArticle.dataset.ratingStatus = 'blacklisted';
        tweetArticle.dataset.ratingDescription = "Whitelisted user";
        ScoreIndicatorRegistry.get(tweetId, tweetArticle)?.update({
            status: 'blacklisted',
            score: 10,
            description: "User is whitelisted"
        });
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
            
        }
    }

    // Skip if already processed in this session
    if (processedTweets.has(tweetId)) {
            const instance = ScoreIndicatorRegistry.get(tweetId);
            if (instance) {
                 instance.ensureIndicatorAttached();
                 filterSingleTweet(tweetArticle);
            }
            return;
        // }
    }

    // Immediately mark as pending before scheduling actual processing
    const indicatorInstance = ScoreIndicatorRegistry.get(tweetId, tweetArticle);
    if (indicatorInstance) {
         if (indicatorInstance.status !== 'blacklisted' && indicatorInstance.status !== 'cached' && indicatorInstance.status !== 'rated') {
            indicatorInstance.update({ status: 'pending', score: null, description: 'Rating scheduled...' });
        } else {
             // If already in a final state, ensure it's attached and filtered
             indicatorInstance.ensureIndicatorAttached();
             filterSingleTweet(tweetArticle);
             // Don't add to processedTweets or schedule API call if already rated/cached/blacklisted
             return;
        }
    } else {
        // If get failed, something is wrong, log error but don't stop everything
        console.error(`Failed to get/create indicator instance for tweet ${tweetId} during scheduling.`);
        // We might still add to processedTweets to avoid infinite loops, but ideally creation works
    }
    
    // Add to processed set *after* successfully getting/creating instance
    if (!processedTweets.has(tweetId)) {
        processedTweets.add(tweetId);
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
const THREAD_CHECK_INTERVAL = 2500; // 2 seconds between thread checks
const SWEEP_INTERVAL = 1000; // 2.5 seconds between full sweeps
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
    
    let allMediaLinks = await extractMediaLinks(tweetArticle);

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
        // No need to wait for image load just to get URLs
        // await waitForImagesToLoad(quoteContainer);
        quotedMediaLinks = await extractMediaLinks(quoteContainer);
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
    
    let allAvailableMediaLinks = [...allMediaLinks];
    
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
    if(document.querySelector('div[aria-label="Timeline: Conversation"]', 'div[aria-label^="Timeline: Conversation"]')){
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
        

        tweets.forEach(tweet => {
            const tweetId = getTweetID(tweet);
            if (!tweetId) return; 
            const indicatorInstance = ScoreIndicatorRegistry.get(tweetId);
            const needsProcessing = !indicatorInstance || indicatorInstance.status === 'error';
            if (needsProcessing && !processedTweets.has(tweetId)) {
                
                scheduleTweetProcessing(tweet);
            } else if (indicatorInstance && indicatorInstance.status !== 'pending' && indicatorInstance.status !== 'streaming') {
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

        // More reliable state checking with both DOM and memory-based flags
        if (threadMappingInProgress || conversation.dataset.threadHist === "pending") {
            return; // Don't interrupt pending operations
        }
        
        // Add protection to avoid re-processing if we already mapped this thread recently
        if (conversation.dataset.threadMappedAt) {
            const lastMappedTime = parseInt(conversation.dataset.threadMappedAt, 10);
            // If we've mapped this thread in the last 10 seconds, skip
            if (Date.now() - lastMappedTime < 10000) {
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
                    }, 10);
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
                        await new Promise(resolve => setTimeout(resolve, 10));
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
            }, 250);
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
                    let mediaLinks = await extractMediaLinks(article);
                    
                    // Extract quoted tweet media if any
                    let quotedMediaLinks = [];
                    const quoteContainer = article.querySelector(QUOTE_CONTAINER_SELECTOR);
                    if (quoteContainer) {
                        quotedMediaLinks = await extractMediaLinks(quoteContainer);
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

// Add the setInterval call at the end of the file or in an init function
setInterval(handleThreads, THREAD_CHECK_INTERVAL);
setInterval(ensureAllTweetsRated, SWEEP_INTERVAL);
setInterval(applyFilteringToAll, SWEEP_INTERVAL);
