//MODULE
//Helper functions and wiring for the cache
/**
 * Saves the tweet ratings (by tweet ID) to persistent storage and updates the UI.
 */
function saveTweetRatings() {
    browserSet('tweetRatings', JSON.stringify(tweetIDRatingCache));
    updateCacheStatsUI();
}
/**
 * Removes invalid entries from tweetIDRatingCache, including:
 * - Entries with undefined/null scores
 * - Streaming entries with undefined scores
 * @param {boolean} saveAfterCleanup - Whether to save the cache after cleanup
 * @returns {Object} - Statistics about the cleanup operation
 */
function cleanupInvalidCacheEntries(saveAfterCleanup = true) {
    const beforeCount = Object.keys(tweetIDRatingCache).length;
    let deletedCount = 0;
    let streamingDeletedCount = 0;
    let undefinedScoreCount = 0;
    
    // Iterate through all entries
    for (const tweetId in tweetIDRatingCache) {
        const entry = tweetIDRatingCache[tweetId];
        
        // Check for invalid entries
        if (entry.score === undefined || entry.score === null) {
            // Count streaming entries separately
            if (entry.streaming === true) {
                streamingDeletedCount++;
            } else {
                undefinedScoreCount++;
            }
            
            // Delete the invalid entry
            delete tweetIDRatingCache[tweetId];
            deletedCount++;
        }
    }
    
    // Save the cleaned cache if requested
    if (saveAfterCleanup && deletedCount > 0) {
        saveTweetRatings();
    }
    
    // Return cleanup statistics
    return {
        beforeCount,
        afterCount: Object.keys(tweetIDRatingCache).length,
        deletedCount,
        streamingDeletedCount,
        undefinedScoreCount
    };
}
/** Updates the cache statistics display in the General tab. */
function updateCacheStatsUI() {
    const cachedCountEl = document.getElementById('cached-ratings-count');
    const whitelistedCountEl = document.getElementById('whitelisted-handles-count');
    if (cachedCountEl) cachedCountEl.textContent = Object.keys(tweetIDRatingCache).length;
    if (whitelistedCountEl) whitelistedCountEl.textContent = blacklistedHandles.length;
}