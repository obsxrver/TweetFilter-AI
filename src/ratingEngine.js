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
    const currentFilterThreshold=GM_getValue('filterThreshold', 1);
    if (tweetArticle.dataset.ratingStatus === 'pending') {
        tweetArticle.style.display = '';
    } else if (isNaN(score) || score < currentFilterThreshold) {
        tweetArticle.style.display = 'none';
    } else {
        tweetArticle.style.display = '';
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
        tweetArticle.dataset.ratingDescription = 'Whtielisted user';
        setScoreIndicator(tweetArticle, 10, 'blacklisted', "User is whitelisted");
        filterSingleTweet(tweetArticle);
        return true;
    }
    // Check ID-based cache
    if (tweetIDRatingCache[tweetId]) {
        const score = tweetIDRatingCache[tweetId].score;
        const desc = tweetIDRatingCache[tweetId].description;
        //console.debug(`Applied cached rating for tweet ${tweetId}: ${score}`);
        tweetArticle.dataset.sloppinessScore = score.toString();
        tweetArticle.dataset.cachedRating = 'true';
        tweetArticle.dataset.ratingStatus = 'cached';
        tweetArticle.dataset.ratingDescription = desc;
        setScoreIndicator(tweetArticle, score, 'cached', desc);
        filterSingleTweet(tweetArticle);
        return true;
    }

    return false;
}
// ----- UI Helper Functions -----

/**
 * Saves the tweet ratings (by tweet ID) to persistent storage.
 */
function saveTweetRatings() {
    GM_setValue('tweetRatings', JSON.stringify(tweetIDRatingCache));
    //console.log(`Saved ${Object.keys(tweetIDRatingCache).length} tweet ratings to storage`);
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
        const userHandle = handles.length > 0 ? handles[0] : '';
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
        // Check if a cached rating exists
        if (applyTweetCachedRating(tweetArticle)) {
            // Verify the indicator exists after applying cached rating
            if (!tweetArticle.querySelector('.score-indicator')) {
                console.error(`Missing indicator after applying cached rating to tweet ${tweetId}`);
                processingSuccessful = false;
            } else {
                processingSuccessful = true;
            }
            return;
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
                const rating = await rateTweetWithOpenRouter(fullContextWithImageDescription, tweetId, apiKey, mediaURLs);
                score = rating.score;
                description = rating.content;
                tweetArticle.dataset.ratingStatus = rating.error ? 'error' : 'rated';
                tweetArticle.dataset.ratingDescription = description || "not available";
                tweetArticle.dataset.sloppinessScore = score.toString();
                
                try {
                    setScoreIndicator(tweetArticle, score, tweetArticle.dataset.ratingStatus, tweetArticle.dataset.ratingDescription);
                    // Verify the indicator exists
                    if (!tweetArticle.querySelector('.score-indicator')) {
                        throw new Error("Failed to create score indicator");
                    }
                } catch (e) {
                    console.error(`Error setting rated indicator for tweet ${tweetId}:`, e);
                    // Continue even if indicator fails - we've set the dataset properties
                }
                
                filterSingleTweet(tweetArticle);
                processingSuccessful = !rating.error;
                
                // Store the full context after rating is complete
                if (tweetIDRatingCache[tweetId]) {
                    tweetIDRatingCache[tweetId].score = score;
                    tweetIDRatingCache[tweetId].description = description;
                    tweetIDRatingCache[tweetId].tweetContent = fullContextWithImageDescription;
                } else {
                    tweetIDRatingCache[tweetId] = {
                        score: score,
                        description: description,
                        tweetContent: fullContextWithImageDescription
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
        tweetArticle.dataset.ratingStatus = 'rated';
        tweetArticle.dataset.ratingDescription = "Whitelisted user";
        setScoreIndicator(tweetArticle, 10, 'blacklisted', "User is whitelisted");
        filterSingleTweet(tweetArticle);
        return;
    }
    
    // If a cached rating is available, use it immediately
    if (tweetIDRatingCache[tweetId]) {
        applyTweetCachedRating(tweetArticle);
        return;
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
    const userHandle = handles.length > 0 ? handles[0] : '';
    const quotedHandle = handles.length > 1 ? handles[1] : '';
    // --- Extract Main Tweet Content ---
    const mainText = getElementText(tweetArticle.querySelector(TWEET_TEXT_SELECTOR));
    
    // Allow a small delay for images to load
    await new Promise(resolve => setTimeout(resolve, 300));
    
    let allMediaLinks = extractMediaLinks(tweetArticle);

        // --- Extract Quoted Tweet Content (if any) ---
        let quotedText = "";
        let quotedMediaLinks = [];
        const quoteContainer = tweetArticle.querySelector(QUOTE_CONTAINER_SELECTOR);
        if (quoteContainer) {
            quotedText = getElementText(quoteContainer.querySelector(TWEET_TEXT_SELECTOR)) || "";
            // Short delay to ensure quoted tweet images are loaded
            await new Promise(resolve => setTimeout(resolve, 300));
            quotedMediaLinks = extractMediaLinks(quoteContainer);
            console.log(`Quoted media links for tweet ${tweetId}:`, quotedMediaLinks);
        }
        // Remove any media links from the main tweet that also appear in the quoted tweet
        let mainMediaLinks = allMediaLinks.filter(link => !quotedMediaLinks.includes(link));
        let fullContextWithImageDescription = `[TWEET ${tweetId}]
 Author:@${userHandle}:
` + mainText;

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
        // --- Quoted Tweet Handling ---
        if (quotedText||quotedMediaLinks.length > 0) {
            fullContextWithImageDescription += `
[QUOTED_TWEET]:
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
        const conversation = document.querySelector('div[aria-label="Timeline: Conversation"]');
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
    let conversation = document.querySelector('div[aria-label="Timeline: Conversation"]');
    if (conversation) {

        if (conversation.dataset.threadHist == undefined) {

            threadHist = "";
            const firstArticle = document.querySelector('article[data-testid="tweet"]');
            if (firstArticle) {
                conversation.dataset.threadHist = 'pending';
                const tweetId = getTweetID(firstArticle);
                
                const apiKey = GM_getValue('openrouter-api-key', '');
                const fullcxt = await getFullContext(firstArticle, tweetId, apiKey);
                threadHist = fullcxt;
                
                conversation.dataset.threadHist = threadHist;
                //this lets us know if we are still on the main post of the conversation or if we are on a reply to the main post. Will disapear every time we dive deeper
                conversation.firstChild.dataset.canary = "true";
                
                // Schedule processing for the original tweet
                if (!processedTweets.has(tweetId)) {
                    scheduleTweetProcessing(firstArticle);
                }
            }
        }
        else if (conversation.dataset.threadHist == "pending") {
            return;
        }
        else if (conversation.dataset.threadHist != "pending" && conversation.firstChild.dataset.canary == undefined) {
            conversation.firstChild.dataset.canary = "pending";
            const nextArticle = document.querySelector('article[data-testid="tweet"]:has(~ div[data-testid="inline_reply_offscreen"])');
            if (nextArticle) {
                const tweetId = getTweetID(nextArticle);
                if (tweetIDRatingCache[tweetId] && tweetIDRatingCache[tweetId].tweetContent) {
                    threadHist = threadHist + "\n[REPLY]\n" + tweetIDRatingCache[tweetId].tweetContent;
                } else {
                    const apiKey = GM_getValue('openrouter-api-key', '');
                    await new Promise(resolve => setTimeout(resolve, 500));
                    const newContext = await getFullContext(nextArticle, tweetId, apiKey);
                    threadHist = threadHist + "\n[REPLY]\n" + newContext;
                }
                conversation.dataset.threadHist = threadHist;
            }
        }
    }
}

