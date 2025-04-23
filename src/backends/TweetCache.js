//src/backends/TweetCache.js
// Helper function for debouncing
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func.apply(this, args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

/**
 * Class to manage the tweet rating cache with standardized data structure and centralized persistence.
 */
class TweetCache {
    // Debounce delay in milliseconds
    static DEBOUNCE_DELAY = 1500;

    constructor() {
        this.cache = {};
        this.loadFromStorage();
        // Create a debounced version of the internal save method
        this.debouncedSaveToStorage = debounce(this.#saveToStorageInternal.bind(this), TweetCache.DEBOUNCE_DELAY);
    }

    /**
     * Loads the cache from browser storage.
     */
    loadFromStorage() {
        try {
            const storedCache = browserGet('tweetRatings', '{}');
            this.cache = JSON.parse(storedCache);
            for (const tweetId in this.cache) {
                this.cache[tweetId].fromStorage = true;
            }
        } catch (error) {
            console.error('Error loading tweet cache:', error);
            this.cache = {};
        }
    }

    /**
     * Saves the current cache to browser storage. (Internal, synchronous implementation)
     */
    #saveToStorageInternal() {
        try {
            browserSet('tweetRatings', JSON.stringify(this.cache));
            updateCacheStatsUI(); // Update UI after saving
        } catch (error) {
            console.error("Error saving tweet cache to storage:", error);
        }
    }

    /**
     * Gets a tweet rating from the cache.
     * @param {string} tweetId - The ID of the tweet.
     * @returns {Object|null} The tweet rating object or null if not found.
     */
    get(tweetId) {
        return this.cache[tweetId] || null;
    }

    /**
     * Sets a tweet rating in the cache.
     * @param {string} tweetId - The ID of the tweet.
     * @param {Object} rating - The rating object: {score(required), description, reasoning, timestamp, streaming, blacklisted,fromStorage}
     * @param {boolean} [saveImmediately=true] - Whether to save to storage immediately. DEPRECATED - Saving is now debounced.
     */
    set(tweetId, rating, saveImmediately = true) { // saveImmediately is now ignored
        // Standardize the rating object structure
        this.cache[tweetId] = {
            score: rating.score,
            description: rating.description || '',
            reasoning: rating.reasoning || '',
            timestamp: rating.timestamp || Date.now(),
            streaming: rating.streaming || false,
            blacklisted: rating.blacklisted || false,
            fromStorage: rating.fromStorage || false
        };

        // Always use the debounced save
        this.debouncedSaveToStorage();
    }
    has(tweetId) {
        return this.cache[tweetId] !== undefined;
    }
    /**
     * Removes a tweet rating from the cache.
     * @param {string} tweetId - The ID of the tweet to remove.
     * @param {boolean} [saveImmediately=true] - Whether to save to storage immediately. DEPRECATED - Saving is now debounced.
     */
    delete(tweetId, saveImmediately = true) { // saveImmediately is now ignored
        if (this.has(tweetId)) {
            delete this.cache[tweetId];
            // Use the debounced save
            this.debouncedSaveToStorage();
        }
    }

    /**
     * Clears all ratings from the cache.
     * @param {boolean} [saveImmediately=true] - Whether to save to storage immediately or debounce.
     */
    clear(saveImmediately = false) {
        this.cache = {};
        // Use the debounced save
        if (saveImmediately) {
            this.#saveToStorageInternal();
        } else {
            this.debouncedSaveToStorage();
        }
    }

    /**
     * Gets the number of cached ratings.
     * @returns {number} The number of cached ratings.
     */
    get size() {
        return Object.keys(this.cache).length;
    }

    /**
     * Cleans up invalid entries in the cache.
     * @param {boolean} [saveImmediately=true] - Whether to save to storage immediately. DEPRECATED - Saving is now debounced.
     * @returns {Object} Statistics about the cleanup operation.
     */
    cleanup(saveImmediately = true) { // saveImmediately is now ignored
        const beforeCount = this.size;
        let deletedCount = 0;
        let streamingDeletedCount = 0;
        let undefinedScoreCount = 0;

        for (const tweetId in this.cache) {
            const entry = this.cache[tweetId];
            if (entry.score === undefined || entry.score === null) {
                if (entry.streaming === true) {
                    streamingDeletedCount++;
                } else {
                    undefinedScoreCount++;
                }
                delete this.cache[tweetId];
                deletedCount++;
            }
        }

        if (deletedCount > 0) {
            // Use the debounced save if changes were made
            this.debouncedSaveToStorage();
        }

        return {
            beforeCount,
            afterCount: this.size,
            deletedCount,
            streamingDeletedCount,
            undefinedScoreCount
        };
    }
}

const tweetCache = new TweetCache();
// Export for use in other modules
//export { tweetCache, TweetCache }; 