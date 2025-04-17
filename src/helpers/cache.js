//MODULE
//Helper functions and wiring for the cache
// Import the TweetCache instance

/**
 * Saves the tweet ratings to persistent storage and updates the UI.
 * @deprecated Use tweetCache.saveToStorage() instead.
 */
function saveTweetRatings() {
    tweetCache.saveToStorage();
}

/**
 * Removes invalid entries from the cache.
 * @param {boolean} saveAfterCleanup - Whether to save the cache after cleanup
 * @returns {Object} - Statistics about the cleanup operation
 * @deprecated Use tweetCache.cleanup() instead.
 */
function cleanupInvalidCacheEntries(saveAfterCleanup = true) {
    return tweetCache.cleanup(saveAfterCleanup);
}

// Export functions for use in other modules
//export { saveTweetRatings, cleanupInvalidCacheEntries };