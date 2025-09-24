/**
     * Extracts and returns trimmed text content from the given element(s).
     * @param {Node|NodeList} elements - A DOM element or a NodeList.
     * @returns {string} The trimmed text content.
     */
function getElementText(elements) {
    if (!elements) return '';
    const elementList = elements instanceof NodeList ? Array.from(elements) : [elements];
    for (const element of elementList) {
        const text = element?.textContent?.trim();
        if (text) return text;
    }
    return '';
}
/**
 * Extracts the text of a tweet, excluding any text from quoted tweets.
 * @param {Element} tweetArticle - The tweet article element.
 * @returns {string} The text of the main tweet.
 */
function getTweetText(tweetArticle) {
    const allTextElements = tweetArticle.querySelectorAll(TWEET_TEXT_SELECTOR);
    const quoteContainer = tweetArticle.querySelector(QUOTE_CONTAINER_SELECTOR);

    for (const textElement of allTextElements) {

        if (!quoteContainer || !quoteContainer.contains(textElement)) {
            return textElement.textContent.trim();
        }
    }

    return '';
}
/**
 * Extracts the tweet ID from a tweet article element.
 * @param {Element} tweetArticle - The tweet article element.
 * @returns {string} The tweet ID.
 */
function getTweetID(tweetArticle) {
    const timeEl = tweetArticle.querySelector(PERMALINK_SELECTOR);
    let tweetId = timeEl?.parentElement?.href;
    if (tweetId && tweetId.includes('/status/')) {
        const match = tweetId.match(/\/status\/(\d+)/);
        if (match && match[1]) {
            return match[1];
        }
        return tweetId.substring(tweetId.indexOf('/status/') + 1);
    }
    return `tweet-${Math.random().toString(36).substring(2, 15)}-${Date.now()}`;
}

/**
 * Extracts the Twitter handle from a tweet article element.
 * @param {Element} tweetArticle - The tweet article element.
 * @returns {array} The user and quoted user handles.
 */
function getUserHandles(tweetArticle) {
    let handles = [];

    const handleElement = tweetArticle.querySelector(USER_HANDLE_SELECTOR);
    if (handleElement) {
        const href = handleElement.getAttribute('href');
        if (href && href.startsWith('/')) {
            handles.push(href.slice(1));
        }
    }

    if (handles.length > 0) {
        const quoteContainer = tweetArticle.querySelector('div[role="link"][tabindex="0"]');
        if (quoteContainer) {

            const userAvatarDiv = quoteContainer.querySelector('div[data-testid^="UserAvatar-Container-"]');
            if (userAvatarDiv) {
                const testId = userAvatarDiv.getAttribute('data-testid');

                const lastDashIndex = testId.lastIndexOf('-');
                if (lastDashIndex >= 0 && lastDashIndex < testId.length - 1) {
                    const quotedHandle = testId.substring(lastDashIndex + 1);

                    if (quotedHandle && quotedHandle !== handles[0]) {
                        handles.push(quotedHandle);
                    }
                }

                const quotedLink = quoteContainer.querySelector('a[href*="/status/"]');
                if (quotedLink) {
                    const href = quotedLink.getAttribute('href');

                    const match = href.match(/^\/([^/]+)\/status\/\d+/);
                    if (match && match[1] && match[1] !== handles[0]) {
                        handles.push(match[1]);
                    }
                }
            }
        }
    }

    return handles.length > 0 ? handles : [''];
}
/**
 * Extracts and returns an array of media URLs and video descriptions from the tweet element.
 * @param {Element} scopeElement - The tweet element.
 * @returns {string[]} An array of media URLs (for images) and video descriptions (for videos).
 */
async function extractMediaLinks(scopeElement) {
    if (!scopeElement) return [];

    const mediaLinks = new Set();

    const imgSelector = `${MEDIA_IMG_SELECTOR}, [data-testid="tweetPhoto"] img, img[src*="pbs.twimg.com/media"]`;
    const videoSelector = `${MEDIA_VIDEO_SELECTOR}, video[poster*="pbs.twimg.com"], video`;
    const combinedSelector = `${imgSelector}, ${videoSelector}`;

    let mediaElements = scopeElement.querySelectorAll(combinedSelector);
    const RETRY_DELAY = 5;
    let retries = 0;

    while (mediaElements.length === 0 && retries < MAX_RETRIES) {
        retries++;

        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        mediaElements = scopeElement.querySelectorAll(combinedSelector);
    }

    if (mediaElements.length === 0 && scopeElement.matches(QUOTE_CONTAINER_SELECTOR)) {
        mediaElements = scopeElement.querySelectorAll('img[src*="pbs.twimg.com"], video[poster*="pbs.twimg.com"]');
    }

    mediaElements.forEach(mediaEl => {
        if (mediaEl.tagName === 'VIDEO') {

            const videoDescription = mediaEl.getAttribute('aria-label');
            if (videoDescription && videoDescription.trim()) {
                mediaLinks.add(`[VIDEO_DESCRIPTION]: ${videoDescription.trim()}`);
            } else {

                const posterUrl = mediaEl.poster;
                if (posterUrl && posterUrl.includes('pbs.twimg.com/') && !posterUrl.includes('profile_images')) {
                    try {
                        const url = new URL(posterUrl);
                        const name = url.searchParams.get('name');
                        let finalUrl = posterUrl;
                        if (name && name !== 'orig') {
                            finalUrl = posterUrl.replace(`name=${name}`, 'name=small');
                        }
                        mediaLinks.add(finalUrl);
                    } catch (error) {
                        mediaLinks.add(posterUrl);
                    }
                }
            }
        } else if (mediaEl.tagName === 'IMG') {

            const sourceUrl = mediaEl.src;

            if (!sourceUrl ||
               !(sourceUrl.includes('pbs.twimg.com/')) ||
               sourceUrl.includes('profile_images')) {
                return;
            }

            try {

                const url = new URL(sourceUrl);
                const name = url.searchParams.get('name');

                let finalUrl = sourceUrl;

                if (name && name !== 'orig') {

                    finalUrl = sourceUrl.replace(`name=${name}`, 'name=small');
                }

                mediaLinks.add(finalUrl);
            } catch (error) {

                mediaLinks.add(sourceUrl);
            }
        }
    });

    return Array.from(mediaLinks);
}

/**
 * Synchronous version of extractMediaLinks without retry logic.
 * @param {Element} scopeElement - The tweet element.
 * @returns {string[]} An array of media URLs (for images) and video descriptions (for videos).
 */
function extractMediaLinksSync(scopeElement) {
    if (!scopeElement) return [];

    const mediaLinks = new Set();

    const imgSelector = `${MEDIA_IMG_SELECTOR}, [data-testid="tweetPhoto"] img, img[src*="pbs.twimg.com/media"]`;
    const videoSelector = `${MEDIA_VIDEO_SELECTOR}, [poster*="pbs.twimg.com"], video`;
    const combinedSelector = `${imgSelector}, ${videoSelector}`;

    let mediaElements = scopeElement.querySelectorAll(combinedSelector);

    if (mediaElements.length === 0 && scopeElement.matches(QUOTE_CONTAINER_SELECTOR)) {
        mediaElements = scopeElement.querySelectorAll('img[src*="pbs.twimg.com"], video[poster*="pbs.twimg.com"]');
    }

    mediaElements.forEach(mediaEl => {
        if (mediaEl.tagName === 'VIDEO') {

            const videoDescription = mediaEl.getAttribute('aria-label');
            if (videoDescription && videoDescription.trim()) {
                mediaLinks.add(`[VIDEO_DESCRIPTION]: ${videoDescription.trim()}`);
            } else {

                const posterUrl = mediaEl.poster;
                if (posterUrl && posterUrl.includes('pbs.twimg.com/') && !posterUrl.includes('profile_images')) {
                    try {
                        const url = new URL(posterUrl);
                        const name = url.searchParams.get('name');
                        let finalUrl = posterUrl;
                        if (name && name !== 'orig') {
                            finalUrl = posterUrl.replace(`name=${name}`, 'name=small');
                        }
                        mediaLinks.add(finalUrl);
                    } catch (error) {
                        mediaLinks.add(posterUrl);
                    }
                }
            }
        } else if (mediaEl.tagName === 'IMG') {

            const sourceUrl = mediaEl.src;

            if (!sourceUrl ||
               !(sourceUrl.includes('pbs.twimg.com/')) ||
               sourceUrl.includes('profile_images')) {
                return;
            }

            try {

                const url = new URL(sourceUrl);
                const name = url.searchParams.get('name');

                let finalUrl = sourceUrl;

                if (name && name !== 'orig') {

                    finalUrl = sourceUrl.replace(`name=${name}`, 'name=small');
                }

                mediaLinks.add(finalUrl);
            } catch (error) {

                mediaLinks.add(sourceUrl);
            }
        }
    });

    return Array.from(mediaLinks);
}

/**
 * Processes a single tweet after a delay.
 * It first sets a pending indicator, then either applies a cached rating,
 * or calls the API to rate the tweet (with retry logic).
 * Finally, it applies the filtering logic.
 * @param {Element} tweetArticle - The tweet element.
 * @param {string} tweetId - The tweet ID.
 */

function isOriginalTweet(tweetArticle) {
    let sibling = tweetArticle.nextElementSibling;
    while (sibling) {
        if (sibling.matches && sibling.matches('div[data-testid="inline_reply_offscreen"]')) {
            return true;
        }
        sibling = sibling.nextElementSibling;
    }
    return false;
}

/**
 * Handles DOM mutations to detect new tweets added to the timeline.
 * @param {MutationRecord[]} mutationsList - List of observed mutations.
 */
function handleMutations(mutationsList) {
    let tweetsAdded = false;
    let needsCleanup = false;

    const shouldSkipProcessing = (element) => {

        if (window.location.pathname.includes('/compose/')) return true;

        if (!element) return true;

        if (element.dataset?.filtered === 'true' || element.dataset?.isAd === 'true') {
            return true;
        }

        const cell = element.closest('div[data-testid="cellInnerDiv"]');
        if (cell?.dataset?.filtered === 'true' || cell?.dataset?.isAd === 'true') {
            return true;
        }

        if (isAd(element)) {

            if (cell) {
                cell.dataset.isAd = 'true';
                cell.classList.add('tweet-filtered');
            }
            element.dataset.isAd = 'true';
            return true;
        }

        const tweetId = getTweetID(element);
        if (processedTweets.has(tweetId)) {
            const indicator = ScoreIndicatorRegistry.get(tweetId);
            if (indicator && indicator.status !== 'error') {
                return true;
            }
        }

        return false;
    };

    for (const mutation of mutationsList) {
        if (mutation.type === 'childList') {

            if (mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {

                        let conversationTimeline = null;
                        if (node.matches && node.matches('div[aria-label^="Timeline: Conversation"]')) {
                            conversationTimeline = node;
                        } else if (node.querySelector) {
                            conversationTimeline = node.querySelector('div[aria-label^="Timeline: Conversation"]');
                        }

                        if (conversationTimeline) {
                            console.log("[handleMutations] Conversation timeline detected. Triggering handleThreads.");

                            setTimeout(handleThreads, 5);
                        }

                        if (node.matches && node.matches(TWEET_ARTICLE_SELECTOR)) {
                            if (!shouldSkipProcessing(node)) {
                                scheduleTweetProcessing(node);
                                tweetsAdded = true;
                            }
                        }
                        else if (node.querySelector) {
                            const tweetsInside = node.querySelectorAll(TWEET_ARTICLE_SELECTOR);
                            tweetsInside.forEach(tweet => {
                                if (!shouldSkipProcessing(tweet)) {
                                    scheduleTweetProcessing(tweet);
                                    tweetsAdded = true;
                                }
                            });
                        }
                    }
                });
            }

            if (mutation.removedNodes.length > 0) {
                mutation.removedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {

                        if (node.dataset?.filtered === 'true' || node.dataset?.isAd === 'true') {
                            return;
                        }

                        if (node.matches && node.matches(TWEET_ARTICLE_SELECTOR)) {
                            const tweetId = getTweetID(node);
                            if (tweetId) {
                                ScoreIndicatorRegistry.get(tweetId)?.destroy();
                                needsCleanup = true;
                            }
                        }

                        else if (node.querySelectorAll) {
                            const removedTweets = node.querySelectorAll(TWEET_ARTICLE_SELECTOR);
                            removedTweets.forEach(tweet => {
                                if (tweet.dataset?.filtered === 'true' || tweet.dataset?.isAd === 'true') {
                                    return;
                                }
                                const tweetId = getTweetID(tweet);
                                if (tweetId) {
                                    ScoreIndicatorRegistry.get(tweetId)?.destroy();
                                    needsCleanup = true;
                                }
                            });
                        }
                    }
                });
            }
        }
    }

    if (tweetsAdded) {
        setTimeout(() => {
            applyFilteringToAll();
        }, 100);
    }

    if (needsCleanup) {
        ScoreIndicatorRegistry.cleanupOrphaned();
    }
}

/**
 * Checks if a tweet article is an advertisement.
 * @param {Element} tweetArticle - The tweet article element.
 * @returns {boolean} True if the tweet is an ad.
 */
function isAd(tweetArticle) {
    if (!tweetArticle) return false;

    const spans = tweetArticle.querySelectorAll('div[dir="ltr"] span');
    for (const span of spans) {
        if (span.textContent.trim() === 'Ad' && !span.children.length) {
            return true;
        }
    }
    return false;
}