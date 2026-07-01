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

const EMPTY_TWEET_METADATA = Object.freeze({
    model: null,
    promptTokens: null,
    completionTokens: null,
    latency: null,
    mediaInputs: null,
    price: null
});

function normalizeScore(score) {
    if (score === undefined || score === null || score === '') {
        return null;
    }
    const parsedScore = Number(score);
    if (!Number.isFinite(parsedScore)) {
        return null;
    }
    return Math.max(0, Math.min(10, parsedScore));
}

function normalizeTweetCacheEntry(entry = {}) {
    const normalizedScore = normalizeScore(entry.score);
    return {
        score: normalizedScore,
        status: entry.status || null,
        fullContext: entry.fullContext || '',
        description: entry.description || '',
        reasoning: entry.reasoning || '',
        questions: Array.isArray(entry.questions) ? entry.questions : [],
        lastAnswer: entry.lastAnswer || '',
        mediaUrls: Array.isArray(entry.mediaUrls) ? entry.mediaUrls : [],
        tweetContent: entry.tweetContent || '',
        authorHandle: entry.authorHandle || '',
        individualTweetText: entry.individualTweetText || '',
        individualMediaUrls: Array.isArray(entry.individualMediaUrls) ? entry.individualMediaUrls : [],
        qaConversationHistory: Array.isArray(entry.qaConversationHistory) ? entry.qaConversationHistory : [],
        metadata: entry.metadata ? { ...entry.metadata } : { ...EMPTY_TWEET_METADATA },
        threadContext: entry.threadContext || null,
        streaming: entry.streaming === true,
        blacklisted: entry.blacklisted === true,
        error: entry.error || null,
        fromStorage: entry.fromStorage === true,
        timestamp: Number.isFinite(Number(entry.timestamp)) ? Number(entry.timestamp) : Date.now()
    };
}

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
                this.cache[tweetId] = normalizeTweetCacheEntry({
                    ...this.cache[tweetId],
                    fromStorage: true
                });
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
        if (!tweetId) {
            return;
        }

        const existingEntry = normalizeTweetCacheEntry(this.cache[tweetId] || {});
        const updatedEntry = normalizeTweetCacheEntry({
            ...existingEntry,
            ...rating,
            metadata: rating.metadata ? { ...(existingEntry.metadata || {}), ...rating.metadata } : existingEntry.metadata,
            timestamp: rating.timestamp !== undefined ? rating.timestamp : Date.now()
        });

        if (rating.individualTweetText !== undefined &&
            existingEntry.individualTweetText &&
            existingEntry.individualTweetText.length > String(rating.individualTweetText).length) {
            updatedEntry.individualTweetText = existingEntry.individualTweetText;
        }

        if (rating.individualMediaUrls !== undefined &&
            Array.isArray(existingEntry.individualMediaUrls) &&
            Array.isArray(rating.individualMediaUrls) &&
            existingEntry.individualMediaUrls.length > rating.individualMediaUrls.length) {
            updatedEntry.individualMediaUrls = existingEntry.individualMediaUrls;
        }

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

    hasCompleteRating(tweetId) {
        return isCompleteCachedRating(this.cache[tweetId]);
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

