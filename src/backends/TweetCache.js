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

    static DEBOUNCE_DELAY = 1500;

    constructor() {
        this.cache = {};
        this.loadFromStorage();

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
            updateCacheStatsUI();
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
    set(tweetId, rating, saveImmediately = true) {
        const existingEntry = this.cache[tweetId] || {};
        const updatedEntry = { ...existingEntry };

        if (rating.score !== undefined) updatedEntry.score = rating.score;
        if (rating.fullContext !== undefined) updatedEntry.fullContext = rating.fullContext;
        if (rating.description !== undefined) updatedEntry.description = rating.description;
        if (rating.reasoning !== undefined) updatedEntry.reasoning = rating.reasoning;
        if (rating.questions !== undefined) updatedEntry.questions = rating.questions;
        if (rating.lastAnswer !== undefined) updatedEntry.lastAnswer = rating.lastAnswer;
        if (rating.mediaUrls !== undefined) updatedEntry.mediaUrls = rating.mediaUrls;
        if (rating.timestamp !== undefined) updatedEntry.timestamp = rating.timestamp;
        else if (updatedEntry.timestamp === undefined) updatedEntry.timestamp = Date.now();
        if (rating.streaming !== undefined) updatedEntry.streaming = rating.streaming;
        if (rating.blacklisted !== undefined) updatedEntry.blacklisted = rating.blacklisted;
        if (rating.fromStorage !== undefined) updatedEntry.fromStorage = rating.fromStorage;

        if (rating.metadata) {
            updatedEntry.metadata = { ...(existingEntry.metadata || {}), ...rating.metadata };
        } else if (!existingEntry.metadata) {
            updatedEntry.metadata = { model: null, promptTokens: null, completionTokens: null, latency: null, mediaInputs: null, price: null };
        }

        if (rating.qaConversationHistory !== undefined) updatedEntry.qaConversationHistory = rating.qaConversationHistory;

        updatedEntry.authorHandle = updatedEntry.authorHandle || '';
        updatedEntry.individualTweetText = updatedEntry.individualTweetText || '';
        updatedEntry.individualMediaUrls = updatedEntry.individualMediaUrls || [];
        updatedEntry.qaConversationHistory = updatedEntry.qaConversationHistory || [];

        if (rating.authorHandle !== undefined) {
            updatedEntry.authorHandle = rating.authorHandle;
        }

        if (rating.individualTweetText !== undefined) {
            if (!updatedEntry.individualTweetText || rating.individualTweetText.length > updatedEntry.individualTweetText.length) {
                updatedEntry.individualTweetText = rating.individualTweetText;
            }
        }

        if (rating.individualMediaUrls !== undefined && Array.isArray(rating.individualMediaUrls)) {
            if (!updatedEntry.individualMediaUrls || updatedEntry.individualMediaUrls.length === 0 || rating.individualMediaUrls.length > updatedEntry.individualMediaUrls.length) {
                updatedEntry.individualMediaUrls = rating.individualMediaUrls;
            }
        }

        updatedEntry.score = updatedEntry.score;
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
    delete(tweetId, saveImmediately = true) {
        if (this.has(tweetId)) {
            delete this.cache[tweetId];

            this.debouncedSaveToStorage();
        }
    }

    /**
     * Clears all ratings from the cache.
     * @param {boolean} [saveImmediately=true] - Whether to save to storage immediately or debounce.
     */
    clear(saveImmediately = false) {
        this.cache = {};

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
}

const tweetCache = new TweetCache();

