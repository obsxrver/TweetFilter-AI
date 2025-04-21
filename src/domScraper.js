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
 * Extracts and returns an array of media URLs from the tweet element.
 * @param {Element} scopeElement - The tweet element.
 * @returns {string[]} An array of media URLs.
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
    const RETRY_DELAY = 100; // ms
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
        // Get the source URL (src for images, poster for videos)
        const sourceUrl = mediaEl.tagName === 'IMG' ? mediaEl.src : mediaEl.poster;
        
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
                // Replace format=jpg&name=small with format=jpg&name=orig
                finalUrl = sourceUrl.replace(`name=${name}`, 'name=orig');
            }
            
            mediaLinks.add(finalUrl);
        } catch (error) {
            // Fallback: just add the raw URL as is
            mediaLinks.add(sourceUrl);
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
    let needsCleanup = false; // Add flag to track if cleanup is needed

    for (const mutation of mutationsList) {
        if (mutation.type === 'childList') {
            // Process added nodes
            if (mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.matches && node.matches(TWEET_ARTICLE_SELECTOR)) {
                            scheduleTweetProcessing(node);
                            tweetsAdded = true;
                        }
                        else if (node.querySelector) {
                            const tweetsInside = node.querySelector(TWEET_ARTICLE_SELECTOR);
                            if (tweetsInside) {
                                scheduleTweetProcessing(tweetsInside);
                                tweetsAdded = true;
                            }
                        }
                    }
                });
            }

            // Process removed nodes to clean up description elements
            if (mutation.removedNodes.length > 0) {
                mutation.removedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Check if the removed node is a tweet article
                        if (node.matches && node.matches(TWEET_ARTICLE_SELECTOR)) {
                             const tweetId = getTweetID(node);
                             if (tweetId) {
                                 // Destroy the corresponding ScoreIndicator instance, if it exists
                                 ScoreIndicatorRegistry.get(tweetId)?.destroy();
                                 needsCleanup = true; // Mark that registry cleanup might be needed
                             }
                        }
                        // Check if the removed node *contains* a tweet article 
                        // (e.g., a cell wrapper removed)
                        else if (node.querySelectorAll) {
                             const removedTweets = node.querySelectorAll(TWEET_ARTICLE_SELECTOR);
                             removedTweets.forEach(tweet => {
                                 const tweetId = getTweetID(tweet);
                                 if (tweetId) {
                                     ScoreIndicatorRegistry.get(tweetId)?.destroy();
                                     needsCleanup = true;
                                 }
                             });
                        }
                        
                        // Direct check if an indicator itself was removed (less likely but possible)
                        if (node.matches && node.matches('.score-indicator')) {
                             const tweetId = node.dataset.tweetId;
                             if (tweetId) {
                                  ScoreIndicatorRegistry.get(tweetId)?.destroy();
                                  needsCleanup = true;
                             }
                        }
                         // Check if the removed node *contains* an indicator
                        else if (node.querySelector && node.querySelector('.score-indicator')) {
                             const indicator = node.querySelector('.score-indicator');
                             const tweetId = indicator.dataset.tweetId;
                             if (tweetId) {
                                  ScoreIndicatorRegistry.get(tweetId)?.destroy();
                                  needsCleanup = true;
                             }
                        }
                    }
                });
            }
        }
    }
    
    // If any tweets were added, ensure filtering is applied
    if (tweetsAdded) {
        // Apply a small delay to allow processing to start first
        setTimeout(() => {
            applyFilteringToAll();
        }, 100);
    }

    // If cleanup is needed, call the registry cleanup function
    if (needsCleanup) {
        ScoreIndicatorRegistry.cleanupOrphaned();
    }
}