/**
     * Extracts and returns trimmed text content from the given element(s).
     * @param {Node|NodeList} elements - A DOM element or a NodeList.
     * @returns {string} The trimmed text content.
     */
function extractVisibleTextWithEmoji(element) {
    if (!element) return '';

    const textParts = [];
    const walk = (node) => {
        if (!node) return;

        if (node.nodeType === Node.TEXT_NODE) {
            textParts.push(node.textContent || '');
            return;
        }

        if (node.nodeType !== Node.ELEMENT_NODE) return;
        const el = node;

        if (el.tagName === 'IMG') {
            const altText = el.getAttribute('alt');
            if (altText) textParts.push(altText);
            return;
        }

        if (el.tagName === 'BR') {
            textParts.push('\n');
            return;
        }

        for (const child of el.childNodes) {
            walk(child);
        }
    };

    walk(element);
    return textParts.join('').replace(/\u00A0/g, ' ').trim();
}

function getElementText(elements) {
    if (!elements) return '';
    const elementList = elements instanceof NodeList ? Array.from(elements) : [elements];
    for (const element of elementList) {
        const text = extractVisibleTextWithEmoji(element);
        if (text) return text;
    }
    return '';
}

/**
 * Finds the interactive card that represents a quoted tweet.
 *
 * X uses the same generic role/tabindex attributes for unrelated controls,
 * including verified-account popovers. Starting from quote-only content keeps
 * those controls from being mistaken for the quoted tweet.
 *
 * @param {Element} tweetArticle - The tweet article element.
 * @returns {Element|null} The quoted-tweet card, when present.
 */
function getQuotedTweetContainer(tweetArticle) {
    if (!tweetArticle) return null;

    const quoteSignals = tweetArticle.querySelectorAll(
        `div[data-testid="User-Name"], ${TWEET_TEXT_SELECTOR}`
    );

    for (const signal of quoteSignals) {
        const quoteContainer = signal.closest?.(QUOTE_CONTAINER_SELECTOR);
        if (quoteContainer && quoteContainer !== tweetArticle && tweetArticle.contains(quoteContainer)) {
            return quoteContainer;
        }
    }

    return null;
}

/**
 * Extracts the text of a tweet, excluding any text from quoted tweets.
 * @param {Element} tweetArticle - The tweet article element.
 * @returns {string} The text of the main tweet.
 */
function getTweetText(tweetArticle) {
    const allTextElements = tweetArticle.querySelectorAll(TWEET_TEXT_SELECTOR);
    const quoteContainer = getQuotedTweetContainer(tweetArticle);

    for (const textElement of allTextElements) {

        if (!quoteContainer || !quoteContainer.contains(textElement)) {
            const tweetText = extractVisibleTextWithEmoji(textElement);
            if (tweetText) return tweetText;
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
    if (!tweetArticle) return '';

    const timeEl = tweetArticle.querySelector(PERMALINK_SELECTOR);
    let tweetId = timeEl?.parentElement?.href;
    if (tweetId && tweetId.includes('/status/')) {
        const match = tweetId.match(/\/status\/(\d+)/);
        if (match && match[1]) {
            return match[1];
        }
        return tweetId.substring(tweetId.indexOf('/status/') + 1);
    }

    if (!tweetArticle.dataset.tweetFilterGeneratedId) {
        tweetArticle.dataset.tweetFilterGeneratedId = `generated-${Math.random().toString(36).substring(2, 15)}-${Date.now()}`;
    }
    return tweetArticle.dataset.tweetFilterGeneratedId;
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
        const quoteContainer = getQuotedTweetContainer(tweetArticle);
        if (quoteContainer) {
            const userAvatarDiv = quoteContainer.querySelector('div[data-testid^="UserAvatar-Container-"]');
            let quotedHandle = '';

            if (userAvatarDiv) {
                const testId = userAvatarDiv.getAttribute('data-testid');
                const avatarPrefix = 'UserAvatar-Container-';
                if (testId?.startsWith(avatarPrefix)) {
                    quotedHandle = testId.slice(avatarPrefix.length);
                }
            }

            if (!quotedHandle) {
                const quotedLink = quoteContainer.querySelector('a[href*="/status/"]');
                if (quotedLink) {
                    const href = quotedLink.getAttribute('href');
                    const match = href.match(/^\/([^/]+)\/status\/\d+/);
                    quotedHandle = match?.[1] || '';
                }
            }

            if (!quotedHandle) {
                const quotedUserName = quoteContainer.querySelector('div[data-testid="User-Name"]');
                const handleText = Array.from(quotedUserName?.querySelectorAll('span') || [])
                    .map(span => span.textContent?.trim() || '')
                    .find(text => /^@[A-Za-z0-9_]{1,15}$/.test(text));
                quotedHandle = handleText ? handleText.slice(1) : '';
            }

            handles.push(quotedHandle);
        }
    }

    return handles.length > 0 ? handles : [''];
}

/**
 * Synchronous version of extractMediaLinks without retry logic.
 * @param {Element} scopeElement - The tweet element.
 * @returns {string[]} An array of media URLs (for images) and video descriptions (for videos).
 */
function extractMediaLinks(scopeElement) {
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
            if (mediaEl.poster) mediaLinks.add(mediaEl.poster);
        } else if (mediaEl.tagName === 'IMG') {
            const sourceUrl = mediaEl.src;
            if(!sourceUrl) return;
            const isAvatar = sourceUrl.includes('/profile_images/') ||
                Boolean(mediaEl.closest?.('[data-testid^="UserAvatar-Container-"], [data-testid="Tweet-User-Avatar"]'));
            if (isAvatar) return;
            mediaLinks.add(sourceUrl);          
        }
    });
    return Array.from(mediaLinks);
}

/**
 * Extracts website-card metadata rendered inside a tweet.
 *
 * The URL is normally X's t.co redirect. If X exposes an expanded URL on the
 * link, that value is preferred. The optional excluded container is used to
 * keep quoted-tweet cards out of the main tweet's preview list.
 *
 * @param {Element} scopeElement - The tweet article or quoted-tweet container.
 * @param {Element|null} [excludedContainer=null] - A nested container to skip.
 * @returns {Array<{url: string, site: string, title: string, description: string, imageUrl: string}>}
 */
function extractWebsiteLinkPreviews(scopeElement, excludedContainer = null) {
    if (!scopeElement) return [];

    const cardElements = scopeElement.matches?.(WEBSITE_CARD_SELECTOR)
        ? [scopeElement]
        : Array.from(scopeElement.querySelectorAll(WEBSITE_CARD_SELECTOR));
    const previews = [];
    const seenPreviews = new Set();

    for (const cardElement of cardElements) {
        if (excludedContainer?.contains(cardElement)) continue;

        const cardLinks = Array.from(cardElement.querySelectorAll('a[href]'));
        const cardLink = cardLinks.find(link => {
            const href = link.getAttribute?.('href') || link.href || '';
            return /^https?:\/\//i.test(href);
        });
        const shortUrl = cardLink?.getAttribute?.('href') || cardLink?.href || '';
        const expandedUrlCandidates = [
            cardLink?.getAttribute?.('data-expanded-url'),
            cardLink?.getAttribute?.('title')
        ];
        const url = expandedUrlCandidates.find(value => /^https?:\/\//i.test(value || '')) || shortUrl;

        const detailElement = cardElement.querySelector(
            '[data-testid^="card.layout"][data-testid$=".detail"]'
        );
        const detailRows = Array.from(detailElement?.querySelectorAll('div[dir="auto"]') || [])
            .map(row => extractVisibleTextWithEmoji(row).replace(/\s+/g, ' ').trim())
            .filter(Boolean);

        const imageElement = cardElement.querySelector(
            'img[src*="pbs.twimg.com/card_img/"], [data-testid$=".media"] img[src], img[src]'
        );
        const imageUrl = imageElement?.getAttribute?.('src') || imageElement?.src || '';
        const preview = {
            url,
            site: detailRows[0] || '',
            title: detailRows[1] || '',
            description: detailRows.slice(2).join(' '),
            imageUrl
        };

        if (!Object.values(preview).some(Boolean)) continue;

        const previewKey = JSON.stringify(preview);
        if (seenPreviews.has(previewKey)) continue;
        seenPreviews.add(previewKey);
        previews.push(preview);
    }

    return previews;
}

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
        if (tweetProcessingState.isScheduled(tweetId)) {
            const indicator = ScoreIndicatorRegistry.get(tweetId);
            if (indicator && indicator.status !== TweetRatingStatus.ERROR) {
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
