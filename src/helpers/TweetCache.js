/**
 * Class to manage the tweet rating cache with standardized data structure and centralized persistence.
 */
class TweetCache {
    constructor() {
        this.cache = {};
        this.loadFromStorage();
    }

    /**
     * Loads the cache from browser storage.
     */
    loadFromStorage() {
        try {
            const storedCache = browserGet('tweetRatings', '{}');
            this.cache = JSON.parse(storedCache);
        } catch (error) {
            console.error('Error loading tweet cache:', error);
            this.cache = {};
        }
    }

    /**
     * Saves the current cache to browser storage.
     */
    saveToStorage() {
        browserSet('tweetRatings', JSON.stringify(this.cache));
        updateCacheStatsUI();
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
     * @param {Object} rating - The rating object containing score, description, etc.
     * @param {boolean} [saveImmediately=true] - Whether to save to storage immediately.
     */
    set(tweetId, rating, saveImmediately = true) {
        // Standardize the rating object structure
        this.cache[tweetId] = {
            score: rating.score,
            description: rating.description || '',
            reasoning: rating.reasoning || '',
            timestamp: rating.timestamp || Date.now(),
            streaming: rating.streaming || false,
            blacklisted: rating.blacklisted || false
        };

        if (saveImmediately) {
            this.saveToStorage();
        }
    }

    /**
     * Removes a tweet rating from the cache.
     * @param {string} tweetId - The ID of the tweet to remove.
     * @param {boolean} [saveImmediately=true] - Whether to save to storage immediately.
     */
    delete(tweetId, saveImmediately = true) {
        delete this.cache[tweetId];
        if (saveImmediately) {
            this.saveToStorage();
        }
    }

    /**
     * Clears all ratings from the cache.
     * @param {boolean} [saveImmediately=true] - Whether to save to storage immediately.
     */
    clear(saveImmediately = true) {
        this.cache = {};
        if (saveImmediately) {
            this.saveToStorage();
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
     * @param {boolean} [saveImmediately=true] - Whether to save to storage immediately.
     * @returns {Object} Statistics about the cleanup operation.
     */
    cleanup(saveImmediately = true) {
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

        if (saveImmediately && deletedCount > 0) {
            this.saveToStorage();
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

// Create a global instance
const tweetCache = new TweetCache();

// Export for use in other modules
export { tweetCache, TweetCache }; 