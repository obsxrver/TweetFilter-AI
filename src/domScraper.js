//src/domScraper.js
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
        // If the text element is not inside the quote container, it's the main tweet's text.
        if (!quoteContainer || !quoteContainer.contains(textElement)) {
            return textElement.textContent.trim();
        }
    }
    
    // If loop finishes, it means all found text elements were inside a quote,
    // so the main tweet has no text.
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
    
    // Extract the main author's handle - take only the first one
    const handleElement = tweetArticle.querySelector(USER_HANDLE_SELECTOR);
    if (handleElement) {
        const href = handleElement.getAttribute('href');
        if (href && href.startsWith('/')) {
            handles.push(href.slice(1));
        }
    }
    
    // If we have the main author's handle, try to get the quoted author
    if (handles.length > 0) {
        const quoteContainer = tweetArticle.querySelector('div[role="link"][tabindex="0"]');
        if (quoteContainer) {
            // Look for a div with data-testid="UserAvatar-Container-username"
            const userAvatarDiv = quoteContainer.querySelector('div[data-testid^="UserAvatar-Container-"]');
            if (userAvatarDiv) {
                const testId = userAvatarDiv.getAttribute('data-testid');
                
                // Extract username from the data-testid attribute (part after the last dash)
                const lastDashIndex = testId.lastIndexOf('-');
                if (lastDashIndex >= 0 && lastDashIndex < testId.length - 1) {
                    const quotedHandle = testId.substring(lastDashIndex + 1);
                    
                    if (quotedHandle && quotedHandle !== handles[0]) {
                        handles.push(quotedHandle);
                    }
                }
                
                // Fallback: try to extract handle from status link
                const quotedLink = quoteContainer.querySelector('a[href*="/status/"]');
                if (quotedLink) {
                    const href = quotedLink.getAttribute('href');
                    // Extract username from URL structure /username/status/id
                    const match = href.match(/^\/([^/]+)\/status\/\d+/);
                    if (match && match[1] && match[1] !== handles[0]) {
                        handles.push(match[1]);
                    }
                }
            }
        }
    }
    
    // Return non-empty array or [''] if no handles found
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
    
    // Find all images and videos in the tweet
    const imgSelector = `${MEDIA_IMG_SELECTOR}, [data-testid="tweetPhoto"] img, img[src*="pbs.twimg.com/media"]`;
    const videoSelector = `${MEDIA_VIDEO_SELECTOR}, video[poster*="pbs.twimg.com"], video`;
    const combinedSelector = `${imgSelector}, ${videoSelector}`;
    
    // --- Retry Logic --- 
    let mediaElements = scopeElement.querySelectorAll(combinedSelector);
    const RETRY_DELAY = 5; // ms
    let retries = 0;

    while (mediaElements.length === 0 && retries < MAX_RETRIES) {
        retries++;
        // console.log(`[extractMediaLinks] Retry ${retries}/${MAX_RETRIES} for media in:`, scopeElement); 
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        mediaElements = scopeElement.querySelectorAll(combinedSelector);
    }
    // --- End Retry Logic ---
    
    // If no media found after retries and this is a quoted tweet, try more aggressive selectors
    if (mediaElements.length === 0 && scopeElement.matches(QUOTE_CONTAINER_SELECTOR)) {
        mediaElements = scopeElement.querySelectorAll('img[src*="pbs.twimg.com"], video[poster*="pbs.twimg.com"]');
    }
    
    mediaElements.forEach(mediaEl => {
        if (mediaEl.tagName === 'VIDEO') {
            // For videos, try to get the aria-label description
            const videoDescription = mediaEl.getAttribute('aria-label');
            if (videoDescription && videoDescription.trim()) {
                mediaLinks.add(`[VIDEO_DESCRIPTION]: ${videoDescription.trim()}`);
            } else {
                // Fallback to poster URL if no aria-label
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
            // For images, continue with URL extraction as before
            const sourceUrl = mediaEl.src;
            
            // Skip if not a Twitter media URL or if undefined or if it's a profile image
            if (!sourceUrl || 
               !(sourceUrl.includes('pbs.twimg.com/')) ||
               sourceUrl.includes('profile_images')) {
                return;
            }
            
            try {
                // Parse the URL to handle format parameters
                const url = new URL(sourceUrl);
                const name = url.searchParams.get('name'); // 'small', 'medium', 'large', etc.
                
                // Create the final URL with the right format and size
                let finalUrl = sourceUrl;
                
                // Try to get the original size by removing size indicator
                if (name && name !== 'orig') {
                    // Replace format=jpg&name=x with format=jpg&name=small
                    finalUrl = sourceUrl.replace(`name=${name}`, 'name=small');
                }
                
                mediaLinks.add(finalUrl);
            } catch (error) {
                // Fallback: just add the raw URL as is
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
    
    // Find all images and videos in the tweet
    const imgSelector = `${MEDIA_IMG_SELECTOR}, [data-testid="tweetPhoto"] img, img[src*="pbs.twimg.com/media"]`;
    const videoSelector = `${MEDIA_VIDEO_SELECTOR}, [poster*="pbs.twimg.com"], video`;
    const combinedSelector = `${imgSelector}, ${videoSelector}`;
    
    let mediaElements = scopeElement.querySelectorAll(combinedSelector);
    
    // If no media found and this is a quoted tweet, try more aggressive selectors
    if (mediaElements.length === 0 && scopeElement.matches(QUOTE_CONTAINER_SELECTOR)) {
        mediaElements = scopeElement.querySelectorAll('img[src*="pbs.twimg.com"], video[poster*="pbs.twimg.com"]');
    }
    
    mediaElements.forEach(mediaEl => {
        if (mediaEl.tagName === 'VIDEO') {
            // For videos, try to get the aria-label description
            const videoDescription = mediaEl.getAttribute('aria-label');
            if (videoDescription && videoDescription.trim()) {
                mediaLinks.add(`[VIDEO_DESCRIPTION]: ${videoDescription.trim()}`);
            } else {
                // Fallback to poster URL if no aria-label
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
            // For images, continue with URL extraction as before
            const sourceUrl = mediaEl.src;
            
            // Skip if not a Twitter media URL or if undefined or if it's a profile image
            if (!sourceUrl || 
               !(sourceUrl.includes('pbs.twimg.com/')) ||
               sourceUrl.includes('profile_images')) {
                return;
            }
            
            try {
                // Parse the URL to handle format parameters
                const url = new URL(sourceUrl);
                const name = url.searchParams.get('name'); // 'small', 'medium', 'large', etc.
                
                // Create the final URL with the right format and size
                let finalUrl = sourceUrl;
                
                // Try to get the original size by removing size indicator
                if (name && name !== 'orig') {
                    // Replace format=jpg&name=x with format=jpg&name=small
                    finalUrl = sourceUrl.replace(`name=${name}`, 'name=small');
                }
                
                mediaLinks.add(finalUrl);
            } catch (error) {
                // Fallback: just add the raw URL as is
                mediaLinks.add(sourceUrl);
            }
        }
    });
    
    return Array.from(mediaLinks);
}

// ----- Rating Indicator Functions -----

/**
 * Processes a single tweet after a delay.
 * It first sets a pending indicator, then either applies a cached rating,
 * or calls the API to rate the tweet (with retry logic).
 * Finally, it applies the filtering logic.
 * @param {Element} tweetArticle - The tweet element.
 * @param {string} tweetId - The tweet ID.
 */
// Helper function to determine if a tweet is the original tweet in a conversation.
// We check if the tweet article has a following sibling with data-testid="inline_reply_offscreen".
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
        //if url has /compose/ return true
        if (window.location.pathname.includes('/compose/')) return true;
        
        if (!element) return true;
        
        // Skip if the element itself is marked as filtered or ad
        if (element.dataset?.filtered === 'true' || element.dataset?.isAd === 'true') {
            return true;
        }

        // Skip if the cell is marked as filtered or ad
        const cell = element.closest('div[data-testid="cellInnerDiv"]');
        if (cell?.dataset?.filtered === 'true' || cell?.dataset?.isAd === 'true') {
            return true;
        }

        // Skip if it's an ad
        if (isAd(element)) {
            // Mark it as an ad and filter it
            if (cell) {
                cell.dataset.isAd = 'true';
                cell.classList.add('tweet-filtered');
            }
            element.dataset.isAd = 'true';
            return true;
        }

        // Skip if it's already in processedTweets and not an error
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
            // Process added nodes
            if (mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Check if the added node IS or CONTAINS the conversation timeline
                        let conversationTimeline = null;
                        if (node.matches && node.matches('div[aria-label^="Timeline: Conversation"]')) {
                            conversationTimeline = node;
                        } else if (node.querySelector) {
                            conversationTimeline = node.querySelector('div[aria-label^="Timeline: Conversation"]');
                        }

                        if (conversationTimeline) {
                            console.log("[handleMutations] Conversation timeline detected. Triggering handleThreads.");
                            // Call handleThreads immediately. The internal checks within handleThreads
                            // should prevent redundant processing if it's already running.
                            setTimeout(handleThreads, 5); // Short delay to potentially allow elements to settle
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

            // Process removed nodes to clean up description elements
            if (mutation.removedNodes.length > 0) {
                mutation.removedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Skip cleanup for filtered tweets and ads
                        if (node.dataset?.filtered === 'true' || node.dataset?.isAd === 'true') {
                            return;
                        }
                        
                        // Check if the removed node is a tweet article
                        if (node.matches && node.matches(TWEET_ARTICLE_SELECTOR)) {
                            const tweetId = getTweetID(node);
                            if (tweetId) {
                                ScoreIndicatorRegistry.get(tweetId)?.destroy();
                                needsCleanup = true;
                            }
                        }
                        // Check if the removed node contains tweet articles
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
    
    // If any tweets were added, ensure filtering is applied
    if (tweetsAdded) {
        setTimeout(() => {
            applyFilteringToAll();
        }, 100);
    }

    // If cleanup is needed, call the registry cleanup function
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
    // Look for any span that contains exactly "Ad" and nothing else
    const spans = tweetArticle.querySelectorAll('div[dir="ltr"] span');
    for (const span of spans) {
        if (span.textContent.trim() === 'Ad' && !span.children.length) {
            return true;
        }
    }
    return false;
}