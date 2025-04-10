// ==UserScript==
// @name         TweetFilter AI - Rating Engine Module
// @namespace    http://tampermonkey.net/
// @version      Version 1.2.3r4
// @description  Tweet rating logic for TweetFilter AI
// @author       Obsxrver(3than)
// @grant        GM_getValue
// @grant        GM_setValue
// @require      https://raw.githubusercontent.com/obsxrver/TweetFilter-AI/dev/src/config.js?v=1.2.3r4
// @require      https://raw.githubusercontent.com/obsxrver/TweetFilter-AI/dev/src/api.js?v=1.2.3r4
// @require      https://raw.githubusercontent.com/obsxrver/TweetFilter-AI/dev/src/domScraper.js?v=1.2.3r4
// @license      MIT
// ==/UserScript==

/**
 * Applies filtering to a single tweet by hiding it if its score is below the threshold.
 * Also updates the rating indicator.
 * @param {Element} tweetArticle - The tweet element.
 */
function filterSingleTweet(tweetArticle) {
    const score = parseInt(tweetArticle.dataset.sloppinessScore || '0', 10);
    // Update the indicator based on the tweet's rating status
    setScoreIndicator(tweetArticle, score, tweetArticle.dataset.ratingStatus || 'rated', tweetArticle.dataset.ratingDescription);
    // If the tweet is still pending a rating, keep it visible
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
        tweetArticle.dataset.ratingStatus = 'rated';
        tweetArticle.dataset.ratingDescription = 'Whtielisted user';
        setScoreIndicator(tweetArticle, 10, 'rated');
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
        tweetArticle.dataset.ratingStatus = 'rated';
        tweetArticle.dataset.ratingDescription = desc;
        setScoreIndicator(tweetArticle, score, 'rated', desc);
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
    let score = 5; // Default score if rating fails
    let description = "";

    try {
        // Get user handle
        const handles = getUserHandles(tweetArticle);
        const userHandle = handles.length > 0 ? handles[0] : '';
        const quotedHandle = handles.length > 1 ? handles[1] : '';
        const allMediaLinks = extractMediaLinks(tweetArticle);
        // Check if tweet's author is blacklisted (fast path)
        if (userHandle && isUserBlacklisted(userHandle)) {
            tweetArticle.dataset.sloppinessScore = '10';
            tweetArticle.dataset.blacklisted = 'true';
            tweetArticle.dataset.ratingStatus = 'rated';
            tweetArticle.dataset.ratingDescription = "Blacklisted user";
            setScoreIndicator(tweetArticle, 10, 'rated', "User is blacklisted");
            filterSingleTweet(tweetArticle);
            return;
        }
        // Check if a cached rating exists
        if (applyTweetCachedRating(tweetArticle)) {
            return;
        }
        /**
        // --- Extract Main Tweet Content ---
        const mainText = getElementText(tweetArticle.querySelector(TWEET_TEXT_SELECTOR));
        let allMediaLinks = extractMediaLinks(tweetArticle);

        // --- Extract Quoted Tweet Content (if any) ---
        let quotedText = "";
        let quotedMediaLinks = [];
        const quoteContainer = tweetArticle.querySelector(QUOTE_CONTAINER_SELECTOR);
        if (quoteContainer) {
            quotedText = getElementText(quoteContainer.querySelector(TWEET_TEXT_SELECTOR));
            quotedMediaLinks = extractMediaLinks(quoteContainer);
        }
        // Remove any media links from the main tweet that also appear in the quoted tweet
        let mainMediaLinks = allMediaLinks.filter(link => !quotedMediaLinks.includes(link));
        let fullContextWithImageDescription = `[TWEET ${tweetId}]
 Author:@${userHandle}:
` + mainText;

        if (mainMediaLinks.length > 0) {
            // Process main tweet images only if image descriptions are enabled
            if (enableImageDescriptions) {
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
        if (quotedText) {
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
                } else {
                    // Just add the URLs when descriptions are disabled
                    fullContextWithImageDescription += `
[QUOTED_TWEET_MEDIA_URLS]:
${quotedMediaLinks.join(", ")}`;
                }
            }
        }

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
        */
        const fullContextWithImageDescription = await getFullContext(tweetArticle, tweetId, apiKey);
        // --- API Call or Fallback ---
        if (apiKey && fullContextWithImageDescription) {
            try {
                const rating = await rateTweetWithOpenRouter(fullContextWithImageDescription, tweetId, apiKey, allMediaLinks);
                score = rating.score;
                description = rating.content;
                tweetArticle.dataset.ratingStatus = rating.error ? 'error' : 'rated';
                tweetArticle.dataset.ratingDescription = description || "not available";
                tweetArticle.dataset.sloppinessScore = score.toString();
                setScoreIndicator(tweetArticle, score, tweetArticle.dataset.ratingStatus, tweetArticle.dataset.ratingDescription);
                filterSingleTweet(tweetArticle);

            } catch (apiError) {
                score = Math.floor(Math.random() * 10) + 1; // Fallback to a random score
                tweetArticle.dataset.ratingStatus = 'error';
            }
        } else {
            // If there's no API key or textual content (e.g., only media), use a fallback random score.
            score = Math.floor(Math.random() * 10) + 1;
            tweetArticle.dataset.ratingStatus = 'rated';
        }

        tweetArticle.dataset.sloppinessScore = score.toString();
        filterSingleTweet(tweetArticle);
        
        // Log all collected information at once
        console.log(`Tweet ${tweetId}:
${fullContextWithImageDescription} - ${score} Model response: - ${description}`);

    } catch (error) {
        if (!tweetArticle.dataset.sloppinessScore) {
            tweetArticle.dataset.sloppinessScore = '5';
            tweetArticle.dataset.ratingStatus = 'error';
            tweetArticle.dataset.ratingDescription = "error processing tweet";
            setScoreIndicator(tweetArticle, 5, 'error', 'Error processing tweet');
            filterSingleTweet(tweetArticle);
        }
    }
}

/**
 * Schedules processing of a tweet if it hasn't been processed yet.
 * @param {Element} tweetArticle - The tweet element.
 */
function scheduleTweetProcessing(tweetArticle) {
    const tweetId = getTweetID(tweetArticle);
    // Fast-path: if author is blacklisted, assign score immediately
    const handles = getUserHandles(tweetArticle);
    const userHandle = handles.length > 0 ? handles[0] : '';
    if (userHandle && isUserBlacklisted(userHandle)) {
        tweetArticle.dataset.sloppinessScore = '10';
        tweetArticle.dataset.blacklisted = 'true';
        tweetArticle.dataset.ratingStatus = 'rated';

        tweetArticle.dataset.ratingDescription = "Whitelisted user";
        setScoreIndicator(tweetArticle, 10, 'rated');
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
        return;
    }

    // Immediately mark as pending before scheduling actual processing
    processedTweets.add(tweetId);
    tweetArticle.dataset.ratingStatus = 'pending';
    setScoreIndicator(tweetArticle, null, 'pending');

    // Now schedule the actual rating processing
    setTimeout(() => { delayedProcessTweet(tweetArticle, tweetId); }, PROCESSING_DELAY_MS);
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
    let allMediaLinks = extractMediaLinks(tweetArticle);

        // --- Extract Quoted Tweet Content (if any) ---
        let quotedText = "";
        let quotedMediaLinks = [];
        const quoteContainer = tweetArticle.querySelector(QUOTE_CONTAINER_SELECTOR);
        if (quoteContainer) {
            quotedText = getElementText(quoteContainer.querySelector(TWEET_TEXT_SELECTOR));
            quotedMediaLinks = extractMediaLinks(quoteContainer);
        }
        // Remove any media links from the main tweet that also appear in the quoted tweet
        let mainMediaLinks = allMediaLinks.filter(link => !quotedMediaLinks.includes(link));
        let fullContextWithImageDescription = `[TWEET ${tweetId}]
 Author:@${userHandle}:
` + mainText;

        if (mainMediaLinks.length > 0) {
            // Process main tweet images only if image descriptions are enabled
            if (enableImageDescriptions) {
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
        if (quotedText) {
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
                } else {
                    // Just add the URLs when descriptions are disabled
                    fullContextWithImageDescription += `
[QUOTED_TWEET_MEDIA_URLS]:
${quotedMediaLinks.join(", ")}`;
                }
            }
        }

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

/**
 * Periodically checks and processes tweets that might have been added without triggering mutations.
 */
function ensureAllTweetsRated() {
    if (!observedTargetNode) return;
    const tweets = observedTargetNode.querySelectorAll(TWEET_ARTICLE_SELECTOR);
    tweets.forEach(tweet => {
        if (!tweet.dataset.sloppinessScore) {
            scheduleTweetProcessing(tweet);
        }
    });
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
                if (tweetIDRatingCache[tweetId]) {
                    threadHist = tweetIDRatingCache[tweetId].tweetContent;
                } else {
                    const apiKey = GM_getValue('openrouter-api-key', '');
                    const fullcxt = await getFullContext(firstArticle, tweetId, apiKey);
                    threadHist = fullcxt;
                }
                conversation.dataset.threadHist = threadHist;
                //this lets us know if we are still on the main post of the conversation or if we are on a reply to the main post. Will disapear every time we dive deeper
                conversation.firstChild.dataset.canary = "true";
            }
        }
        else if (conversation.dataset.threadHist == "pending") {
            return;
        }
        else if (conversation.dataset.threadHist != "pending" && conversation.firstChild.dataset.canary == undefined) {
            conversation.firstChild.dataset.canary = "pending";
            const nextArticle = document.querySelector('article[data-testid="tweet"]:has(~ div[data-testid="inline_reply_offscreen"])');
            const tweetId = getTweetID(nextArticle);
            if (tweetIDRatingCache[tweetId]) {
                threadHist = threadHist + "\n[REPLY]\n" + tweetIDRatingCache[tweetId].tweetContent;
            } else {
                const apiKey = GM_getValue('openrouter-api-key', '');
                await new Promise(resolve => setTimeout(resolve, 500));
                const newContext = await getFullContext(nextArticle, tweetId, apiKey);
                threadHist = threadHist + "\n[REPLY]\n" + newContext;
                conversation.dataset.threadHist = threadHist;
            }
        }
    }
}

