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

/** Updates the cache statistics display in the General tab. */
function updateCacheStatsUI() {
    const cachedCountEl = document.getElementById('cached-ratings-count');
    const whitelistedCountEl = document.getElementById('whitelisted-handles-count');
    const cachedCount = tweetCache.size;
    const wlCount = blacklistedHandles.length;
    
    if (cachedCountEl) cachedCountEl.textContent = cachedCount;
    if (whitelistedCountEl) whitelistedCountEl.textContent = wlCount;
    
    const statsBadge = document.getElementById("tweet-filter-stats-badge");
    if (statsBadge) statsBadge.innerHTML = `
            <span style="margin-right: 5px;">🧠</span>
            <span data-cached-count>${cachedCount} rated</span>
            ${wlCount > 0 ? `<span style="margin-left: 5px;"> | ${wlCount} whitelisted</span>` : ''}
        `;
}

// Export functions for use in other modules
//export { saveTweetRatings, cleanupInvalidCacheEntries, updateCacheStatsUI };