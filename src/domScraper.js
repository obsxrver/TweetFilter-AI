// ==UserScript==
// @name         TweetFilter AI - DOM Scraper Module
// @namespace    http://tampermonkey.net/
// @version      Version 1.2.3r2
// @description  DOM manipulation functions for TweetFilter AI
// @author       Obsxrver(3than)
// @require      https://raw.githubusercontent.com/obsxrver/TweetFilter-AI/dev/src/config.js?v=1.2.3r3
// @license      MIT
// ==/UserScript==
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
    const handleElement = tweetArticle.querySelectorAll(USER_HANDLE_SELECTOR);
    let handles=[];
    if (handleElement) {
        /*
        const href = handleElement.getAttribute('href');
        if (href && href.startsWith('/')) {
            return href.slice(1);
        }
        */
       handleElement.forEach(element => {
        const href = element.getAttribute('href');
        if (href && href.startsWith('/')) {
            handles.push(href.slice(1));
        }
       });
    }
    return handles;
}


/**
 * Extracts and returns an array of media URLs from the tweet element.
 * @param {Element} scopeElement - The tweet element.
 * @param {string} tweetIdForDebug - The tweet ID (for logging).
 * @returns {string[]} An array of media URLs.
 */
function extractMediaLinks(scopeElement) {
    if (!scopeElement) return [];
    
    const mediaLinks = new Set();
    
    // Find all images and videos in the tweet
    scopeElement.querySelectorAll(`${MEDIA_IMG_SELECTOR}, ${MEDIA_VIDEO_SELECTOR}`).forEach(mediaEl => {
        // Get the source URL (src for images, poster for videos)
        const sourceUrl = mediaEl.tagName === 'IMG' ? mediaEl.src : mediaEl.poster;
        
        // Skip if not a Twitter media URL
        if (!sourceUrl || 
           !(sourceUrl.includes('pbs.twimg.com/media') || 
             sourceUrl.includes('pbs.twimg.com/amplify_video_thumb'))) {
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
            
            // Log both the original and final URLs for debugging
            //console.log(`[Tweet ${tweetIdForDebug}] Processing media: ${sourceUrl} → ${finalUrl}`);
            
            mediaLinks.add(finalUrl);
        } catch (error) {
            //console.error(`[Tweet ${tweetIdForDebug}] Error processing media URL: ${sourceUrl}`, error);
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

    for (const mutation of mutationsList) {
        handleThreads();
        if (mutation.type === 'childList') {
            // Process added nodes
            if (mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.matches && node.matches(TWEET_ARTICLE_SELECTOR)) {
                            scheduleTweetProcessing(node);
                        }
                        else if (node.querySelectorAll) {
                            const tweetsInside = node.querySelectorAll(TWEET_ARTICLE_SELECTOR);
                            tweetsInside.forEach(scheduleTweetProcessing);
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
}