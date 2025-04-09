
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

        // Create a single data object to collect all information during processing
        const logData = {
            status: "Started processing",
            tweetId: tweetId
        };

        try {
            // Get user handle
            const handles = getUserHandles(tweetArticle);
            const userHandle = handles.length > 0 ? handles[0] : '';
            const quotedHandle = handles.length > 1 ? handles[1] : '';
            logData.handle = userHandle;

            // Check if tweet's author is blacklisted (fast path)
            if (userHandle && isUserBlacklisted(userHandle)) {
                logData.status = "Blacklisted user - auto-score 10/10";
                logData.score = 10;

                tweetArticle.dataset.sloppinessScore = '10';
                tweetArticle.dataset.blacklisted = 'true';
                tweetArticle.dataset.ratingStatus = 'rated';
                tweetArticle.dataset.ratingDescription = "Blacklisted user";
                setScoreIndicator(tweetArticle, 10, 'rated', "Blacklisted user");
                filterSingleTweet(tweetArticle);

                
                return;
            }

            // Check if a cached rating exists
            if (applyTweetCachedRating(tweetArticle)) {
                logData.status = "Using cached rating";
                logData.score = parseInt(tweetArticle.dataset.sloppinessScore, 10);

                return;
            }

            // Status is already set to pending in scheduleTweetProcessing
            logData.status = "Processing tweet";

            // --- Extract Main Tweet Content ---
            const mainText = getElementText(tweetArticle.querySelector(TWEET_TEXT_SELECTOR));
            let allMediaLinks = extractMediaLinks(tweetArticle, tweetId);

            // --- Extract Quoted Tweet Content (if any) ---
            let quotedText = "";
            let quotedMediaLinks = [];
            const quoteContainer = tweetArticle.querySelector(QUOTE_CONTAINER_SELECTOR);
            if (quoteContainer) {
                quotedText = getElementText(quoteContainer.querySelector(TWEET_TEXT_SELECTOR));
                quotedMediaLinks = extractMediaLinks(quoteContainer, tweetId);
            }

            // Remove any media links from the main tweet that also appear in the quoted tweet
            let mainMediaLinks = allMediaLinks.filter(link => !quotedMediaLinks.includes(link));
            
            if (mainMediaLinks.length > 0 || quotedMediaLinks.length > 0) {
                logData.mediaUrls = [...mainMediaLinks, ...quotedMediaLinks];
            }

            // --- Build the full context ---
            let fullContext = `[TWEET ${tweetId}]\n Author:@${userHandle}:\n` + mainText;
            let fullContextWithImageDescription = fullContext;

            if (mainMediaLinks.length > 0) {
                // Add media URLs always for context
                fullContext += "\n[MEDIA_URLS]:\n" + mainMediaLinks.join(", ");

                // Process main tweet images only if image descriptions are enabled
                if (enableImageDescriptions) {
                    let mainMediaLinksDescription = await getImageDescription(mainMediaLinks, apiKey, tweetId, userHandle);
                    fullContextWithImageDescription += "\n[MEDIA_DESCRIPTION]:\n" + mainMediaLinksDescription;
                    logData.imageDescription = mainMediaLinksDescription;
                } else {
                    // Just add the URLs when descriptions are disabled
                    fullContextWithImageDescription += "\n[MEDIA_URLS]:\n" + mainMediaLinks.join(", ");
                }
            }

            if (quotedText) {
                fullContext += "\n[QUOTED_TWEET]:\n Author:@${quotedHandle}:\n" + quotedText;
                fullContextWithImageDescription += "\n[QUOTED_TWEET]:\n Author:@${quotedHandle}:\n" + quotedText;

                if (quotedMediaLinks.length > 0) {
                    // Add media URLs always for context
                    fullContext += "\n[QUOTED_TWEET_MEDIA_URLS]:\n" + quotedMediaLinks.join(", ");

                    // Process quoted tweet images only if image descriptions are enabled
                    if (enableImageDescriptions) {
                        let quotedMediaLinksDescription = await getImageDescription(quotedMediaLinks, apiKey, tweetId, userHandle);
                        fullContextWithImageDescription += "\n[QUOTED_TWEET_MEDIA_DESCRIPTION]:\n" + quotedMediaLinksDescription;

                        if (logData.imageDescription) {
                            logData.imageDescription += "\n\nQUOTED TWEET IMAGES:\n" + quotedMediaLinksDescription;
                        } else {
                            logData.imageDescription = "QUOTED TWEET IMAGES:\n" + quotedMediaLinksDescription;
                        }
                    } else {
                        // Just add the URLs when descriptions are disabled
                        fullContextWithImageDescription += "\n[QUOTED_TWEET_MEDIA_URLS]:\n" + quotedMediaLinks.join(", ");
                    }
                }
            }

            // --- Conversation Thread Handling ---
            const conversation = document.querySelector('div[aria-label="Timeline: Conversation"]');
            if (conversation && conversation.dataset.threadHist) {
                // If this tweet is not the original tweet, prepend the thread history.
                if (!isOriginalTweet(tweetArticle)) {
                    fullContextWithImageDescription = conversation.dataset.threadHist + "\n[REPLY]\n" + fullContextWithImageDescription;
                    logData.isReply = true;
                }
            }

            logData.fullContext = fullContextWithImageDescription;
            tweetArticle.dataset.fullContext = fullContextWithImageDescription;

            // --- API Call or Fallback ---
            if (apiKey && fullContext) {
                try {
                    const rating = await rateTweetWithOpenRouter(fullContextWithImageDescription, tweetId, apiKey, allMediaLinks);
                    score = rating.score;
                    description = rating.content;
                    tweetArticle.dataset.ratingStatus = rating.error ? 'error' : 'rated';
                    tweetArticle.dataset.ratingDescription = description || "not available";

                    logData.status = rating.error ? "Rating error" : "Rating complete";
                    logData.score = score;
                    logData.modelResponse = description;
                    logData.isError = rating.error;

                    if (rating.error) {
                        logData.error = rating.content;
                    }
                } catch (apiError) {
                    logData.status = "API error";
                    logData.error = apiError.toString();
                    logData.isError = true;

                    score = Math.floor(Math.random() * 10) + 1; // Fallback to a random score
                    tweetArticle.dataset.ratingStatus = 'error';
                }
            } else {
                // If there's no API key or textual content (e.g., only media), use a fallback random score.
                score = Math.floor(Math.random() * 10) + 1;
                tweetArticle.dataset.ratingStatus = 'rated';

                if (!apiKey) {
                    logData.status = "No API key - using random score";
                } else if (!fullContext) {
                    logData.status = "No textual content - using random score";
                }

                logData.score = score;
            }

            tweetArticle.dataset.sloppinessScore = score.toString();
            setScoreIndicator(tweetArticle, score, tweetArticle.dataset.ratingStatus, tweetArticle.dataset.ratingDescription);
            filterSingleTweet(tweetArticle);

            // Update final status
            if (!logData.status.includes("complete")) {
                logData.status = "Rating process complete";
            }

            // Log all collected information at once
            console.log(`Tweet ${tweetId}:\n${fullContextWithImageDescription} - ${score}Model response: - ${description}`);

        } catch (error) {
            logData.status = "Error processing tweet";
            logData.error = error.toString();
            logData.isError = true;

            

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
        const mainText = getElementText(tweetArticle.querySelector(TWEET_TEXT_SELECTOR));
        const mainMediaLinks = extractMediaLinks(tweetArticle, tweetId);

        // Build the base formatted context string
        let fullContext = `[TWEET]:
@${userHandle}
${mainText}
`;

        // Handle media content
        if (mainMediaLinks.length > 0) {
            if (enableImageDescriptions) {
                // Get descriptions for images if enabled
                const mainMediaDescriptions = await getImageDescription(mainMediaLinks, apiKey, tweetId, userHandle);
                fullContext += `[MEDIA_DESCRIPTION]:
${mainMediaDescriptions}
`;
            } else {
                // Just include the URLs if descriptions are disabled
                fullContext += `[MEDIA_URLS]:
${mainMediaLinks.join(", ")}
`;
            }
        }

        // Retrieve quoted tweet content (if any)
        let quotedText = "";
        let quotedMediaLinks = [];
        const quoteContainer = tweetArticle.querySelector(QUOTE_CONTAINER_SELECTOR);

        if (quoteContainer) {
            quotedText = getElementText(quoteContainer.querySelector(TWEET_TEXT_SELECTOR));
            quotedMediaLinks = extractMediaLinks(quoteContainer, tweetId);

            // Add quoted tweet content if present
            if (quotedText) {
                fullContext += `[QUOTED_TWEET]:
${quotedText}
`;

                // Handle quoted tweet media
                if (quotedMediaLinks.length > 0) {
                    if (enableImageDescriptions) {
                        // Get descriptions for quoted tweet images if enabled
                        const quotedMediaDescriptions = await getImageDescription(quotedMediaLinks, apiKey, tweetId, userHandle);
                        fullContext += `[QUOTED_TWEET_MEDIA_DESCRIPTION]:
${quotedMediaDescriptions}
`;
                    } else {
                        // Just include the URLs if descriptions are disabled
                        fullContext += `[QUOTED_TWEET_MEDIA_URLS]:
${quotedMediaLinks.join(", ")}
`;
                    }
                }
            }
        }

        return fullContext;
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



                        //janky, but we're assuming that since threadHist is undefined, we just opened the thread and therefore the first article is the head.

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
    