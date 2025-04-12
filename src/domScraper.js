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
                console.log("Found UserAvatar container with ID:", testId);
                // Extract username from the data-testid attribute (part after the last dash)
                const lastDashIndex = testId.lastIndexOf('-');
                if (lastDashIndex >= 0 && lastDashIndex < testId.length - 1) {
                    const quotedHandle = testId.substring(lastDashIndex + 1);
                    console.log("Extracted quoted handle:", quotedHandle);
                    if (quotedHandle && quotedHandle !== handles[0]) {
                        handles.push(quotedHandle);
                    }
                }
            } else {
                console.log("No UserAvatar container found in quote, trying fallback method");
                
                // Fallback: try to extract handle from status link
                const quotedLink = quoteContainer.querySelector('a[href*="/status/"]');
                if (quotedLink) {
                    const href = quotedLink.getAttribute('href');
                    // Extract username from URL structure /username/status/id
                    const match = href.match(/^\/([^/]+)\/status\/\d+/);
                    if (match && match[1] && match[1] !== handles[0]) {
                        console.log("Extracted quoted handle from link:", match[1]);
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
function extractMediaLinks(scopeElement) {
    if (!scopeElement) return [];
    
    const mediaLinks = new Set();
    
    // Find all images and videos in the tweet
    const imgSelector = `${MEDIA_IMG_SELECTOR}, [data-testid="tweetPhoto"] img, img[src*="pbs.twimg.com/media"]`;
    const videoSelector = `${MEDIA_VIDEO_SELECTOR}, video[poster*="pbs.twimg.com"], video`;
    
    // First try the standard selectors
    let mediaElements = scopeElement.querySelectorAll(`${imgSelector}, ${videoSelector}`);
    
    // If no media found and this is a quoted tweet, try more aggressive selectors
    if (mediaElements.length === 0 && scopeElement.matches(QUOTE_CONTAINER_SELECTOR)) {
        // Try to find any image within the quoted tweet
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
            const format = url.searchParams.get('format');
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


// ----- MutationObserver Setup -----
/**
 * Handles DOM mutations to detect new tweets added to the timeline.
 * @param {MutationRecord[]} mutationsList - List of observed mutations.
 */
function handleMutations(mutationsList) {
    let tweetsAdded = false;

    for (const mutation of mutationsList) {
        handleThreads();
        if (mutation.type === 'childList') {
            // Process added nodes
            if (mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.matches && node.matches(TWEET_ARTICLE_SELECTOR)) {
                            scheduleTweetProcessing(node);
                            tweetsAdded = true;
                        }
                        else if (node.querySelectorAll) {
                            const tweetsInside = node.querySelectorAll(TWEET_ARTICLE_SELECTOR);
                            if (tweetsInside.length > 0) {
                                tweetsInside.forEach(scheduleTweetProcessing);
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
                        // Check if the removed node is a tweet article or contains tweet articles
                        const isTweet = node.matches && node.matches(TWEET_ARTICLE_SELECTOR);
                        const removedTweets = isTweet ? [node] :
                            (node.querySelectorAll ? Array.from(node.querySelectorAll(TWEET_ARTICLE_SELECTOR)) : []);

                        // For each removed tweet, find and remove its description element
                        removedTweets.forEach(tweet => {
                            const indicator = tweet.querySelector('.score-indicator');
                            if (indicator && indicator.dataset.id) {
                                const descId = 'desc-' + indicator.dataset.id;
                                const descBox = document.getElementById(descId);
                                if (descBox) {
                                    descBox.remove();
                                    //console.debug(`Removed description box ${descId} for tweet that was removed from the DOM`);
                                }
                            }
                        });
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
}