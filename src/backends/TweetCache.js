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
     * @param {Object} rating - The rating object. Can be a partial update.
     * @param {boolean} [saveImmediately=true] - Whether to save to storage immediately or use debounced save.
     */
    set(tweetId, rating, saveImmediately = false) {
        const existingEntry = this.cache[tweetId] || {};
        const updatedEntry = { ...existingEntry }; // Start with a copy

        // Update standard fields if provided in rating object
        if (rating.score !== undefined) updatedEntry.score = rating.score;
        if (rating.fullContext !== undefined) updatedEntry.fullContext = rating.fullContext;
        if (rating.description !== undefined) updatedEntry.description = rating.description;
        if (rating.reasoning !== undefined) updatedEntry.reasoning = rating.reasoning;
        if (rating.questions !== undefined) updatedEntry.questions = rating.questions;
        if (rating.lastAnswer !== undefined) updatedEntry.lastAnswer = rating.lastAnswer;
        if (rating.mediaUrls !== undefined) updatedEntry.mediaUrls = rating.mediaUrls; // These are for full context
        if (rating.timestamp !== undefined) updatedEntry.timestamp = rating.timestamp;
        else if (updatedEntry.timestamp === undefined) updatedEntry.timestamp = Date.now(); // Ensure timestamp exists
        if (rating.streaming !== undefined) updatedEntry.streaming = rating.streaming;
        if (rating.blacklisted !== undefined) updatedEntry.blacklisted = rating.blacklisted;
        if (rating.fromStorage !== undefined) updatedEntry.fromStorage = rating.fromStorage;
        
        if (rating.metadata) {
            updatedEntry.metadata = { ...(existingEntry.metadata || {}), ...rating.metadata };
        } else if (!existingEntry.metadata) {
            updatedEntry.metadata = { model: null, promptTokens: null, completionTokens: null, latency: null, mediaInputs: null, price: null };
        }

        if (rating.qaConversationHistory !== undefined) updatedEntry.qaConversationHistory = rating.qaConversationHistory;

        // Initialize new/specific fields if they don't exist on updatedEntry from existingEntry
        updatedEntry.authorHandle = updatedEntry.authorHandle || '';
        updatedEntry.individualTweetText = updatedEntry.individualTweetText || '';
        updatedEntry.individualMediaUrls = updatedEntry.individualMediaUrls || [];
        updatedEntry.qaConversationHistory = updatedEntry.qaConversationHistory || [];


        // Specific update logic for authorHandle
        if (rating.authorHandle !== undefined) {
            updatedEntry.authorHandle = rating.authorHandle;
        }

        // Specific update logic for individualTweetText
        if (rating.individualTweetText !== undefined) {
            if (!updatedEntry.individualTweetText || rating.individualTweetText.length > updatedEntry.individualTweetText.length) {
                updatedEntry.individualTweetText = rating.individualTweetText;
            }
        }

        // Specific update logic for individualMediaUrls
        if (rating.individualMediaUrls !== undefined && Array.isArray(rating.individualMediaUrls)) {
            if (!updatedEntry.individualMediaUrls || updatedEntry.individualMediaUrls.length === 0 || rating.individualMediaUrls.length > updatedEntry.individualMediaUrls.length) {
                updatedEntry.individualMediaUrls = rating.individualMediaUrls;
            }
        }
        
        // Ensure defaults for any fields that might still be undefined after merge
        updatedEntry.score = updatedEntry.score; // Remains undefined if not set
        updatedEntry.authorHandle = updatedEntry.authorHandle || '';
        updatedEntry.fullContext = updatedEntry.fullContext || '';
        updatedEntry.description = updatedEntry.description || '';
        updatedEntry.reasoning = updatedEntry.reasoning || '';
        updatedEntry.questions = updatedEntry.questions || [];
        updatedEntry.lastAnswer = updatedEntry.lastAnswer || '';
        updatedEntry.mediaUrls = updatedEntry.mediaUrls || [];
        updatedEntry.streaming = updatedEntry.streaming || false;
        updatedEntry.blacklisted = updatedEntry.blacklisted || false;
        updatedEntry.fromStorage = updatedEntry.fromStorage || false;


        this.cache[tweetId] = updatedEntry;

        if (!saveImmediately) {
            this.debouncedSaveToStorage();
        } else {
            this.#saveToStorageInternal();
        }
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
        let missingQaHistoryCount = 0;

        for (const tweetId in this.cache) {
            const entry = this.cache[tweetId];
            let shouldDelete = false;
            if (entry.score === undefined || entry.score === null) {
                if (entry.streaming === true) {
                    streamingDeletedCount++;
                } else {
                    undefinedScoreCount++;
                }
                shouldDelete = true;
            }
            if (!entry.streaming && entry.score !== undefined && entry.score !== null && !entry.blacklisted && 
                (!entry.qaConversationHistory || !Array.isArray(entry.qaConversationHistory) || entry.qaConversationHistory.length < 3)) {
                console.warn(`[Cache Cleanup] Tweet ${tweetId} is rated but has invalid/missing qaConversationHistory. Deleting.`);
                missingQaHistoryCount++;
                shouldDelete = true;
            }

            if (shouldDelete) {
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
            undefinedScoreCount,
            missingQaHistoryCount
        };
    }
}

const tweetCache = new TweetCache();
// Export for use in other modules
//export { tweetCache, TweetCache }; 