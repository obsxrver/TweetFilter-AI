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

const generatedTweetIds = new WeakMap();
const cellTweets = new WeakMap();
const filteredCells = new WeakSet();
const conversationStates = new WeakMap();

function getTweetID(tweetArticle) {
    if (!tweetArticle) return '';

    const quote = getQuotedTweetContainer(tweetArticle);
    const time = Array.from(tweetArticle.querySelectorAll(PERMALINK_SELECTOR))
        .find(element => !quote?.contains(element));
    const tweetId = time?.closest('a')?.getAttribute('href')?.match(/\/status\/(\d+)/)?.[1];
    if (tweetId) return tweetId;

    if (!generatedTweetIds.has(tweetArticle)) {
        generatedTweetIds.set(tweetArticle, `generated-${crypto.randomUUID()}`);
    }
    return generatedTweetIds.get(tweetArticle);
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

/**
 * @typedef {Object} ParsedTweet
 * @property {string|null} id
 * @property {{handle: string, name: string}} author
 * @property {string} text
 * @property {string|null} createdAt
 * @property {string|null} url
 * @property {Array<{type: string, url: string, alt: string, description?: string}>} media
 * @property {Array<{url: string, site: string, title: string, description: string, imageUrl: string}>} linkPreviews
 * @property {Object<string, number>} engagement
 * @property {ParsedTweet|null} quotedTweet
 * @property {{id: string, handle: string}|null} replyTo
 */
/** @returns {ParsedTweet} Plain content, without DOM references or rating state. */
function parseTweet(tweetArticle) {
    const quote = getQuotedTweetContainer(tweetArticle);
    const handles = getUserHandles(tweetArticle);
    const parseContent = (scope, handle, excluded = null) => {
        const own = selector => Array.from(scope.querySelectorAll(selector))
            .filter(element => !excluded?.contains(element));
        const time = own(PERMALINK_SELECTOR)[0];
        const link = time?.closest('a') || own('a[href*="/status/"]')[0];
        const media = own(`${MEDIA_IMG_SELECTOR}, ${MEDIA_VIDEO_SELECTOR}`)
            .filter(element => !element.src?.includes('/profile_images/'))
            .map(element => ({
                type: element.tagName === 'VIDEO' || element.closest('[data-testid="videoPlayer"]') ||
                    /video_thumb/.test(element.src || '') ? 'video' : 'image',
                url: element.tagName === 'VIDEO' ? element.poster : element.src,
                alt: element.getAttribute('alt') || ''
            })).filter(item => item.url);
        const engagement = {};
        const label = own('[role="group"][aria-label]')[0]?.getAttribute('aria-label') || '';
        for (const match of label.matchAll(/([\d,.]+[KM]?)\s+(repl(?:y|ies)|reposts?|likes?|bookmarks?|views?)/gi)) {
            const count = match[1].replace(/,/g, '');
            const key = match[2].startsWith('repl') ? 'replies' : match[2].replace(/s?$/, 's');
            engagement[key] = Math.round(parseFloat(count) * (/M$/i.test(count) ? 1e6 : /K$/i.test(count) ? 1e3 : 1));
        }
        return {
            id: link?.getAttribute('href')?.match(/\/status\/(\d+)/)?.[1] || null,
            author: { handle, name: extractVisibleTextWithEmoji(own('[data-testid="User-Name"] [dir="ltr"] span')[0]) },
            text: extractVisibleTextWithEmoji(own(TWEET_TEXT_SELECTOR)[0]),
            createdAt: time?.getAttribute('datetime') || null,
            url: link?.href || null,
            media: media.filter((item, index) => media.findIndex(other => other.url === item.url) === index),
            linkPreviews: extractWebsiteLinkPreviews(scope, excluded),
            engagement,
            quotedTweet: null,
            replyTo: null
        };
    };
    const tweet = parseContent(tweetArticle, handles[0], quote);
    tweet.id = getTweetID(tweetArticle);
    if (quote) tweet.quotedTweet = parseContent(quote, handles[1] || '');
    const cell = tweetArticle.closest('[data-testid="cellInnerDiv"]');
    if (cell) cellTweets.set(cell, tweet);
    return tweet;
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

                        if (filteredCells.has(node)) {
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
                                if (filteredCells.has(tweet.closest('[data-testid="cellInnerDiv"]'))) {
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
