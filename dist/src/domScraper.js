//src/domScraper.js
/**
 * Sets up the DOM scraper with the given rating engine
 * @param {Object} ratingEngine - The rating engine instance
 * @returns {Object} - The scraper interface
 */
function setupDOMScraper(ratingEngine) {
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
        const timeEl = tweetArticle.querySelector(window.PERMALINK_SELECTOR);
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
        const handleElement = tweetArticle.querySelector(window.USER_HANDLE_SELECTOR);
        if (handleElement) {
            const href = handleElement.getAttribute('href');
            if (href && href.startsWith('/')) {
                handles.push(href.slice(1));
            }
        }
        
        // If we have the main author's handle, try to get the quoted author
        if (handles.length > 0) {
            const quoteContainer = tweetArticle.querySelector(window.QUOTE_CONTAINER_SELECTOR);
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
        const imgSelector = `${window.MEDIA_IMG_SELECTOR}, [data-testid="tweetPhoto"] img, img[src*="pbs.twimg.com/media"]`;
        const videoSelector = `${window.MEDIA_VIDEO_SELECTOR}, video[poster*="pbs.twimg.com"], video`;
        const combinedSelector = `${imgSelector}, ${videoSelector}`;
        
        // --- Retry Logic --- 
        let mediaElements = scopeElement.querySelectorAll(combinedSelector);
        const RETRY_DELAY = 100; // ms
        let retries = 0;

        while (mediaElements.length === 0 && retries < window.MAX_RETRIES) {
            retries++;
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            mediaElements = scopeElement.querySelectorAll(combinedSelector);
        }
        
        // If no media found after retries and this is a quoted tweet, try more aggressive selectors
        if (mediaElements.length === 0 && scopeElement.matches(window.QUOTE_CONTAINER_SELECTOR)) {
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

    /**
     * Helper function to determine if a tweet is the original tweet in a conversation.
     * @param {Element} tweetArticle - The tweet element.
     * @returns {boolean} Whether the tweet is the original in a conversation.
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
     * Checks if a tweet is an advertisement.
     * @param {Element} tweetArticle - The tweet element.
     * @returns {boolean} Whether the tweet is an ad.
     */
    function isAd(tweetArticle) {
        // Check for promoted tweet indicator
        const promotedSpan = tweetArticle.querySelector('span[data-testid="promotedIndicator"]');
        if (promotedSpan) return true;

        // Check for ad author in cache
        const handles = getUserHandles(tweetArticle);
        return handles.some(handle => window.adAuthorCache.has(handle));
    }

    /**
     * Handles DOM mutations to detect new tweets added to the timeline.
     * @param {MutationRecord[]} mutationsList - List of observed mutations.
     */
    function handleMutations(mutationsList) {
        let tweetsAdded = false;
        let needsCleanup = false;

        const shouldSkipProcessing = (element) => {
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

            return false;
        };

        for (const mutation of mutationsList) {
            if (mutation.type === 'childList') {
                // Process added nodes
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Check for tweet articles
                        const tweets = node.matches(window.TWEET_ARTICLE_SELECTOR) ? 
                            [node] : 
                            Array.from(node.querySelectorAll(window.TWEET_ARTICLE_SELECTOR));
                        
                        tweets.forEach(tweet => {
                            if (!shouldSkipProcessing(tweet)) {
                                const tweetId = getTweetID(tweet);
                                if (!window.processedTweets.has(tweetId)) {
                                    window.processedTweets.add(tweetId);
                                    ratingEngine.processTweet(tweet, tweetId);
                                    tweetsAdded = true;
                                }
                            }
                        });
                    }
                });

                // Check for removed nodes
                mutation.removedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        needsCleanup = true;
                    }
                });
            }
        }

        // If tweets were added, ensure all are rated
        if (tweetsAdded) {
            ratingEngine.ensureAllTweetsRated();
        }

        // If nodes were removed, clean up filtered tweets
        if (needsCleanup) {
            ratingEngine.applyFilteringToAll();
        }
    }

    /**
     * Starts monitoring the DOM for new tweets
     */
    function startMonitoring() {
        // Create an observer instance
        const observer = new MutationObserver(handleMutations);

        // Start observing the target node for configured mutations
        const config = { childList: true, subtree: true };
        
        // Find the main timeline element
        const timeline = document.querySelector('div[data-testid="primaryColumn"]');
        if (timeline) {
            window.observedTargetNode = timeline;
            observer.observe(timeline, config);
            
            // Process any existing tweets
            const existingTweets = timeline.querySelectorAll(window.TWEET_ARTICLE_SELECTOR);
            existingTweets.forEach(tweet => {
                const tweetId = getTweetID(tweet);
                if (!window.processedTweets.has(tweetId)) {
                    window.processedTweets.add(tweetId);
                    ratingEngine.processTweet(tweet, tweetId);
                }
            });
        }
    }

    // Return the public interface
    return {
        startMonitoring,
        getTweetID,
        getUserHandles,
        extractMediaLinks,
        isOriginalTweet,
        isAd,
        getElementText
    };
}

// Expose to window object
window.setupDOMScraper = setupDOMScraper;