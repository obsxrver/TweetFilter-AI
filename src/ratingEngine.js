/**
 * Applies filtering to a single tweet by hiding it if its score is below the threshold.
 * Also updates the rating indicator.
 * @param {Element} tweetArticle - The tweet element.
 */
function filterSingleTweet(tweetArticle) {
    const score = parseInt(tweetArticle.dataset.sloppinessScore || '1', 10);
    // Update the indicator based on the tweet's rating status
    setScoreIndicator(tweetArticle, score, tweetArticle.dataset.ratingStatus || 'rated', tweetArticle.dataset.ratingDescription);
    // If the tweet is still pending a rating, keep it visible
    // Always get the latest threshold directly from storage
    const currentFilterThreshold = parseInt(GM_getValue('filterThreshold', '1'));
    if (tweetArticle.dataset.ratingStatus === 'pending') {
        //tweetArticle.style.display = '';
        tweetArticle.closest('div[data-testid="cellInnerDiv"]').style.display= '';
    } else if (isNaN(score) || score < currentFilterThreshold) {
        //tweetArticle.style.display = 'none';
        tweetArticle.closest('div[data-testid="cellInnerDiv"]').style.display= 'none';
    } else {
        //tweetArticle.style.display = '';
        tweetArticle.closest('div[data-testid="cellInnerDiv"]').style.display= '';
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
        //console.debug(`Blacklisted user detected: ${userHandle}, assigning score 10`);
        tweetArticle.dataset.sloppinessScore = '10';
        tweetArticle.dataset.blacklisted = 'true';
        tweetArticle.dataset.ratingStatus = 'blacklisted';
        tweetArticle.dataset.ratingDescription = 'Whitelisted user';
        setScoreIndicator(tweetArticle, 10, 'blacklisted', "User is whitelisted");
        filterSingleTweet(tweetArticle);
        return true;
    }
    // Check ID-based cache
    if (tweetIDRatingCache[tweetId]) {
        // Skip incomplete streaming entries that don't have a score yet
        if (tweetIDRatingCache[tweetId].streaming === true && 
            (tweetIDRatingCache[tweetId].score === undefined || tweetIDRatingCache[tweetId].score === null)) {
            return false;
        }
        
        // Ensure the score exists before applying it
        if (tweetIDRatingCache[tweetId].score !== undefined && tweetIDRatingCache[tweetId].score !== null) {
            const score = tweetIDRatingCache[tweetId].score;
            const desc = tweetIDRatingCache[tweetId].description;
            //console.debug(`Applied cached rating for tweet ${tweetId}: ${score}`);
            tweetArticle.dataset.sloppinessScore = score.toString();
            tweetArticle.dataset.cachedRating = 'true';
            
            // If it's a streaming entry that's not complete, mark as streaming instead of cached
            if (tweetIDRatingCache[tweetId].streaming === true) {
                tweetArticle.dataset.ratingStatus = 'streaming';
                setScoreIndicator(tweetArticle, score, 'streaming', desc);
            } else {
                // Check if this rating is from storage (cached) or newly created
                const isFromStorage = tweetIDRatingCache[tweetId].fromStorage === true;
                
                // Set status based on source
                if (isFromStorage) {
                tweetArticle.dataset.ratingStatus = 'cached';
                setScoreIndicator(tweetArticle, score, 'cached', desc);
                    console.log(`Set CACHED status for tweet ${tweetId}, score ${score}`);
                } else {
                    tweetArticle.dataset.ratingStatus = 'rated';
                    setScoreIndicator(tweetArticle, score, 'rated', desc);
                    console.log(`Set RATED status for tweet ${tweetId}, score ${score}`);
                }
            }
            
            tweetArticle.dataset.ratingDescription = desc;
            filterSingleTweet(tweetArticle);
            return true;
        } else {
            // Invalid cache entry - missing score
            console.warn(`Invalid cache entry for tweet ${tweetId}: missing score`);
            delete tweetIDRatingCache[tweetId];  // Remove invalid entry
            saveTweetRatings();
            return false;
        }
    }

    return false;
}
// ----- UI Helper Functions -----

/**
 * Saves the tweet ratings (by tweet ID) to persistent storage and updates the UI.
 */
function saveTweetRatings() {
    GM_setValue('tweetRatings', JSON.stringify(tweetIDRatingCache));
    
    // Dynamically update the UI cache stats counter
    // Only try to update if the element exists (the settings panel is open)
    const cachedCountEl = document.getElementById('cached-ratings-count');
    if (cachedCountEl) {
        cachedCountEl.textContent = Object.keys(tweetIDRatingCache).length;
    }
    
    // Also update the cache stats in the settings panel
    try {
        // Use the UI function if it's available
        if (typeof updateCacheStatsUI === 'function') {
            updateCacheStatsUI();
        }
    } catch (e) {
        console.error('Error updating cache stats UI:', e);
    }
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

async function delayedProcessTweet(tweetArticle, tweetId) {
    const apiKey = GM_getValue('openrouter-api-key', '');
    if (!apiKey) {
        tweetArticle.dataset.ratingStatus = 'error';
        tweetArticle.dataset.ratingDescription = "No API key";
        try {
            setScoreIndicator(tweetArticle, 5, 'error', "No API key");
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
        console.log("handles", handles);
        const userHandle = handles.length > 0 ? handles[0] : '';
        const quotedHandle = handles.length > 1 ? handles[1] : '';
        
        console.log(`Tweet ${tweetId} by @${userHandle} - ${handles.length > 1 ? `Quote from @${quotedHandle}` : 'No quoted tweet'}`);
        
        // Check for avatar container for debugging
        const quoteContainer = tweetArticle.querySelector('div[role="link"][tabindex="0"]');
        if (quoteContainer) {
            const avatarDivs = quoteContainer.querySelectorAll('div[data-testid]');
            avatarDivs.forEach(div => {
                const testId = div.getAttribute('data-testid');
                if (testId && testId.includes('UserAvatar-Container')) {
                    console.log(`Found avatar container: ${testId}`);
                }
            });
        }
        
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
            return;
        }
        
        // Check for a cached rating, but only use it if it has a valid score
        // and is not an incomplete streaming entry
        if (tweetIDRatingCache[tweetId]) {
            const cacheEntry = tweetIDRatingCache[tweetId];
            const isValidCacheEntry = 
                cacheEntry.score !== undefined && 
                cacheEntry.score !== null &&
                !(cacheEntry.streaming === true && cacheEntry.score === undefined);
                
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
            } else if (cacheEntry.streaming === true) {
                // This is a streaming entry that's still in progress
                // Don't delete it, but don't use it either
                console.log(`Tweet ${tweetId} has incomplete streaming cache entry, continuing with processing`);
            } else {
                // Invalid cache entry, delete it
                console.warn(`Invalid cache entry for tweet ${tweetId}, removing from cache`, cacheEntry);
                delete tweetIDRatingCache[tweetId];
                saveTweetRatings();
            }
        }
       
        const fullContextWithImageDescription = await getFullContext(tweetArticle, tweetId, apiKey);
        if (!fullContextWithImageDescription) {
            throw new Error("Failed to get tweet context");
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
                const isCached = tweetIDRatingCache[tweetId] && 
                                !tweetIDRatingCache[tweetId].streaming && 
                                tweetIDRatingCache[tweetId].score !== undefined;
                
                const rating = await rateTweetWithOpenRouter(fullContextWithImageDescription, tweetId, apiKey, mediaURLs);
                
                console.log('got rating', rating);
                score = rating.score;
                description = rating.content;
                
                // Check if this rating was loaded from storage
                if (tweetIDRatingCache[tweetId] && tweetIDRatingCache[tweetId].fromStorage === true) {
                    // If it was loaded from storage, mark it as cached
                    tweetArticle.dataset.ratingStatus = 'cached';
                } else {
                    // Otherwise use the normal logic
                    tweetArticle.dataset.ratingStatus = rating.error ? 'error' : (isCached || rating.cached ? 'cached' : 'rated');
                }
                tweetArticle.dataset.ratingDescription = description || "not available";
                tweetArticle.dataset.sloppinessScore = score.toString();
                console.log(`Rating status for tweet ${tweetId}: ${tweetArticle.dataset.ratingStatus} (isCached: ${isCached}, rating.cached: ${rating.cached})`);
                console.log(`Indicator classes: ${tweetArticle.querySelector('.score-indicator')?.className}`);
                try {
                    setScoreIndicator(tweetArticle, score, tweetArticle.dataset.ratingStatus, tweetArticle.dataset.ratingDescription);
                    // Verify the indicator exists
                    if (!tweetArticle.querySelector('.score-indicator')) {
                        throw new Error("Failed to create score indicator");
                    }
                    // Log indicator classes after setting
                    console.log(`Indicator classes after setting: ${tweetArticle.querySelector('.score-indicator')?.className}`);
                } catch (e) {
                    console.error(`Error setting rated indicator for tweet ${tweetId}:`, e);
                    // Continue even if indicator fails - we've set the dataset properties
                }
                console.log("filtering tweet");
                filterSingleTweet(tweetArticle);
                processingSuccessful = !rating.error;
                
                // Store the full context after rating is complete
                if (tweetIDRatingCache[tweetId]) {
                    tweetIDRatingCache[tweetId].score = score;
                    tweetIDRatingCache[tweetId].description = description;
                    tweetIDRatingCache[tweetId].tweetContent = fullContextWithImageDescription;
                    tweetIDRatingCache[tweetId].streaming = false; // Mark as complete
                } else {
                    tweetIDRatingCache[tweetId] = {
                        score: score,
                        description: description,
                        tweetContent: fullContextWithImageDescription,
                        streaming: false // Mark as complete
                    };
                }
                
                // Save ratings to persistent storage
                saveTweetRatings();

            } catch (apiError) {
                console.error(`API error for tweet ${tweetId}: ${apiError}`);
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
        }else{
            //show all tweets that errored
            score=10;
            tweetArticle.dataset.ratingStatus = 'error';
            tweetArticle.dataset.ratingDescription = "No content";
            processingSuccessful = true;
        }
        
        // Always ensure a valid score is set
        if (score === undefined || score === null) {
            console.warn(`Invalid score for tweet ${tweetId}, using default score 5`);
            score = 5;
        }

        tweetArticle.dataset.sloppinessScore = score.toString();
        try {
            console.log(`Tweet ${tweetId}
${fullContextWithImageDescription}
Status: ${tweetArticle.dataset.ratingStatus}
Score: ${score}
Model: ${GM_getValue('selectedModel', '')}
${GM_getValue('enableImageDescriptions', false) ? `Image Model: ${GM_getValue('selectedImageModel', '')}` : ""}
Description: ${description}
                `)
            setScoreIndicator(tweetArticle, score, tweetArticle.dataset.ratingStatus, tweetArticle.dataset.ratingDescription || "");
            // Final verification of indicator
            if (!tweetArticle.querySelector('.score-indicator')) {
                console.error(`Final indicator check failed for tweet ${tweetId}`);
                processingSuccessful = false;
            }
            
        } catch (e) {
            console.error(`Final error setting indicator for tweet ${tweetId}:`, e);
            processingSuccessful = false;
        }
        
        filterSingleTweet(tweetArticle);
        
        // Log processed status
        //console.log(`Tweet ${tweetId} processed: score=${score}, status=${tweetArticle.dataset.ratingStatus}`);

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
            console.warn(`Removing tweet ${tweetId} from processedTweets to allow retry`);
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
        console.error("Cannot schedule tweet without valid ID", tweetArticle);
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
    if (tweetIDRatingCache[tweetId]) {
        // Only apply cached rating if it has a valid score and isn't an incomplete streaming entry
        const isIncompleteStreaming = 
            tweetIDRatingCache[tweetId].streaming === true && 
            (tweetIDRatingCache[tweetId].score === undefined || tweetIDRatingCache[tweetId].score === null);
            
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
    processedTweets.add(tweetId);
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
    console.log("handles", handles);
    
    const userHandle = handles.length > 0 ? handles[0] : '';
    const quotedHandle = handles.length > 1 ? handles[1] : '';
    
    console.log(`Tweet ${tweetId} by @${userHandle} - ${handles.length > 1 ? `Quote from @${quotedHandle}` : 'No quoted tweet'}`);
    
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
                console.log(`Found quoted tweet ID: ${quotedTweetId}`);
            }
        }
        
            quotedText = getElementText(quoteContainer.querySelector(TWEET_TEXT_SELECTOR)) || "";
            // Short delay to ensure quoted tweet images are loaded
            await new Promise(resolve => setTimeout(resolve, 20));
            quotedMediaLinks = extractMediaLinks(quoteContainer);
            console.log(`Quoted media links for tweet ${tweetId}:`, quotedMediaLinks);
        }
    
    // Get thread media URLs from cache if available
    const conversation = document.querySelector('div[aria-label="Timeline: Conversation"]') || 
                          document.querySelector('div[aria-label^="Timeline: Conversation"]') ||
                          document.querySelector('main[role="main"] div[aria-label^="Timeline:"]');
    
    let threadMediaUrls = [];
    if (conversation && conversation.dataset.threadMapping && tweetIDRatingCache[tweetId]?.threadContext?.threadMediaUrls) {
        // Get thread media URLs from cache if available
        threadMediaUrls = tweetIDRatingCache[tweetId].threadContext.threadMediaUrls || [];
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
            if (enableImageDescriptions=GM_getValue('enableImageDescriptions', false)) {
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
        
        tweetArticle.dataset.fullContext = fullContextWithImageDescription;
    
        // --- Conversation Thread Handling ---
        if (conversation && conversation.dataset.threadHist) {
            // If this tweet is not the original tweet, prepend the thread history.
            if (!isOriginalTweet(tweetArticle)) {
                fullContextWithImageDescription = conversation.dataset.threadHist + `
[REPLY]
` + fullContextWithImageDescription;
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
            
            // If tweet is in processedTweets but missing indicator, remove it from processed
            if (processedTweets.has(tweetId) && !hasIndicator) {
                console.warn(`Tweet ${tweetId} in processedTweets but missing indicator, removing`);
                processedTweets.delete(tweetId);
            }
            
            // Schedule processing if needed and not already in progress
            const needsProcessing = !hasScore || hasError || !hasIndicator;
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
        // Find the conversation timeline using the selectors from the original code
    let conversation = document.querySelector('div[aria-label="Timeline: Conversation"]');
        if (!conversation) {
            
            conversation = document.querySelector('div[aria-label^="Timeline: Conversation"]');
            
        }
        if (!conversation) return;

        // Maintain compatibility with the existing implementation by checking dataset attributes
        if (conversation.dataset.threadHist === "pending") {
            return; // Don't interrupt pending operations
        }
        
        // Add protection to avoid re-processing if we already mapped this thread recently
        // This helps avoid processing loops on page refresh
        if (conversation.dataset.threadMappedAt) {
            const lastMappedTime = parseInt(conversation.dataset.threadMappedAt, 10);
            const now = Date.now();
            // If we've mapped this thread in the last 5 seconds, skip
            if (now - lastMappedTime < 5000) {
                return;
            }
        }

        // Extract the root tweet ID from the URL for improved thread mapping
        const match = location.pathname.match(/status\/(\d+)/);
        const localRootTweetId = match ? match[1] : null;
        
        // Initialize thread history
        if (conversation.dataset.threadHist === undefined) {
            // Original behavior - initialize thread history
            threadHist = "";
            const firstArticle = document.querySelector('article[data-testid="tweet"]');
            if (firstArticle) {
                conversation.dataset.threadHist = 'pending';
                const tweetId = getTweetID(firstArticle);
                
                // Get the full context of the root tweet
                const apiKey = GM_getValue('openrouter-api-key', '');
                const fullcxt = await getFullContext(firstArticle, tweetId, apiKey);
                threadHist = fullcxt;
                
                conversation.dataset.threadHist = threadHist;
                conversation.firstChild.dataset.canary = "true";
                
                // Schedule processing for the original tweet
                if (!processedTweets.has(tweetId)) {
                    scheduleTweetProcessing(firstArticle);
                }
                
                // Use improved thread detection to map the structure, but with delay
                // This helps to avoid racing with the page load
                if (localRootTweetId) {
                    setTimeout(() => {
                        mapThreadStructure(conversation, localRootTweetId);
                    }, 500);
                }
                
            return;
        }
        } else if (conversation.dataset.threadHist !== "pending" && conversation.firstChild.dataset.canary === undefined) {
            // Original behavior for deep-diving into replies
            conversation.firstChild.dataset.canary = "pending";
            const nextArticle = document.querySelector('article[data-testid="tweet"]:has(~ div[data-testid="inline_reply_offscreen"])');
            if (nextArticle) {
                const tweetId = getTweetID(nextArticle);
                if (tweetIDRatingCache[tweetId] && tweetIDRatingCache[tweetId].tweetContent) {
                    threadHist = threadHist + "\n[REPLY]\n" + tweetIDRatingCache[tweetId].tweetContent;
                } else {
                    const apiKey = GM_getValue('openrouter-api-key', '');
                    await new Promise(resolve => setTimeout(resolve, 100));
                    const newContext = await getFullContext(nextArticle, tweetId, apiKey);
                    threadHist = threadHist + "\n[REPLY]\n" + newContext;
                }
                conversation.dataset.threadHist = threadHist;
            }
            
            // With delay to avoid competing with page load
            if (localRootTweetId) {
                setTimeout(() => {
                    mapThreadStructure(conversation, localRootTweetId);
                }, 500);
            }
        } else if (localRootTweetId && !conversation.dataset.threadMapping) {
            // Only run thread detection if we haven't already mapped this thread
            // This prevents redundant processing
            setTimeout(() => {
                mapThreadStructure(conversation, localRootTweetId);
            }, 500);
        }
    } catch (error) {
        console.error("Error in handleThreads:", error);
    }
}

// Helper function for the improved thread structure detection
async function mapThreadStructure(conversation, localRootTweetId) {
    // Add a timestamp to prevent re-processing too frequently
    conversation.dataset.threadMappedAt = Date.now().toString();
    
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
                    let prevCell = cellDivs[idx-1] || null;
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
            
            // Store the thread mapping in a dataset attribute for debugging
            // But keep it small to avoid memory issues
            conversation.dataset.threadMapping = JSON.stringify(replyDocs);
            
            // Build thread history with full context including media links
            let completeThreadHistory = "";
            
            // Start with the root post
            const rootTweet = replyDocs.find(t => t.isRoot === true);
            if (rootTweet && rootTweet.tweetId) {
                const rootTweetElement = tweetCells.find(t => t.tweetId === rootTweet.tweetId)?.tweetNode;
                if (rootTweetElement) {
                    const apiKey = GM_getValue('openrouter-api-key', '');
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
                        
                        // Log debug information
                    }
                }
            }
            
            // Log thread structure for debugging
            console.log('[Thread Mapping]', replyDocs);
            
            // Third pass: Update the cache with thread context
            // but with a limit on how many we process at once
            const batchSize = 10;
            for (let i = 0; i < replyDocs.length; i += batchSize) {
                const batch = replyDocs.slice(i, i + batchSize);
                batch.forEach(doc => {
                    if (doc.tweetId && tweetIDRatingCache[doc.tweetId]) {
                        tweetIDRatingCache[doc.tweetId].threadContext = {
                            replyTo: doc.to,
                            replyToId: doc.toId,
                            isRoot: doc.isRoot,
                            threadMediaUrls: doc.isRoot ? [] : getAllPreviousMediaUrls(doc.tweetId, replyDocs)
                        };
                    }
                });
                
                // Yield to main thread every batch to avoid locking UI
                if (i + batchSize < replyDocs.length) {
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
            }
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
        // Clear the mapped timestamp so we can try again later
        delete conversation.dataset.threadMappedAt;
    }
}

