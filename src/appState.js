const DEFAULT_INSTRUCTIONS = 'Rate the tweet on a scale from 1 to 10 based on its clarity, insight, creativity, and overall quality.';

const DEFAULT_SETTINGS = Object.freeze({
    selectedModel: 'openai/gpt-4.1-nano',
    selectedImageModel: 'google/gemini-2.5-flash',
    showFreeModels: true,
    modelFamilyFilter: '',
    providerSort: '',
    enableImageDescriptions: false,
    enableStreaming: true,
    enableWebSearch: false,
    enableAutoRating: true,
    reasoningEffort: 'none',
    modelTemperature: 0.5,
    modelTopP: 0.9,
    imageModelTemperature: 0.5,
    imageModelTopP: 0.9,
    maxTokens: 0,
    filterThreshold: 5,
    userDefinedInstructions: DEFAULT_INSTRUCTIONS,
    blacklistedHandles: ''
});

const TweetRatingStatus = Object.freeze({
    PENDING: 'pending',
    STREAMING: 'streaming',
    RATED: 'rated',
    CACHED: 'cached',
    MANUAL: 'manual',
    ERROR: 'error',
    BLACKLISTED: 'blacklisted',
    AD: 'ad'
});

const FINAL_TWEET_STATUSES = new Set([
    TweetRatingStatus.RATED,
    TweetRatingStatus.CACHED,
    TweetRatingStatus.MANUAL,
    TweetRatingStatus.BLACKLISTED,
    TweetRatingStatus.AD
]);

const ACTIVE_TWEET_STATUSES = new Set([
    TweetRatingStatus.PENDING,
    TweetRatingStatus.STREAMING
]);

function coerceBoolean(value, fallback = false) {
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return fallback;
}

function coerceNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

function coerceInteger(value, fallback = 0) {
    const number = parseInt(value, 10);
    return Number.isFinite(number) ? number : fallback;
}

function parseHandleList(value) {
    return String(value || '')
        .split('\n')
        .map(handle => handle.trim().replace(/^@/, ''))
        .filter(Boolean);
}

class AppSettingsStore {
    get(key) {
        return browserGet(key, DEFAULT_SETTINGS[key]);
    }

    set(key, value) {
        browserSet(key, value);
        window[key] = value;
    }

    getBoolean(key) {
        return coerceBoolean(this.get(key), DEFAULT_SETTINGS[key]);
    }

    getNumber(key) {
        return coerceNumber(this.get(key), DEFAULT_SETTINGS[key]);
    }

    getInteger(key) {
        return coerceInteger(this.get(key), DEFAULT_SETTINGS[key]);
    }

    getHandles() {
        return parseHandleList(this.get('blacklistedHandles'));
    }

    saveHandles(handles) {
        const cleanHandles = [...new Set((handles || []).map(handle => handle.trim().replace(/^@/, '')).filter(Boolean))];
        this.set('blacklistedHandles', cleanHandles.join('\n'));
        return cleanHandles;
    }

    reset() {
        Object.entries(DEFAULT_SETTINGS).forEach(([key, value]) => this.set(key, value));
        return { ...DEFAULT_SETTINGS };
    }
}

class TweetProcessingState {
    constructor() {
        this.processedTweetIds = new Set();
        this.retryCounts = new Map();
        this.pendingRequestCount = 0;
        this.maxRetriesPerTweet = 2;
    }

    markScheduled(tweetId) {
        this.processedTweetIds.add(tweetId);
    }

    isScheduled(tweetId) {
        return this.processedTweetIds.has(tweetId);
    }

    clear(tweetId) {
        this.processedTweetIds.delete(tweetId);
    }

    clearAll() {
        this.processedTweetIds.clear();
        this.retryCounts.clear();
        this.pendingRequestCount = 0;
        pendingRequests = 0;
    }

    resetRetries(tweetId) {
        this.retryCounts.delete(tweetId);
    }

    shouldRetry(tweetId) {
        const retryCount = this.retryCounts.get(tweetId) || 0;
        if (retryCount >= this.maxRetriesPerTweet) {
            return false;
        }
        this.retryCounts.set(tweetId, retryCount + 1);
        return true;
    }

    incrementPending() {
        this.pendingRequestCount += 1;
        pendingRequests = this.pendingRequestCount;
        return this.pendingRequestCount;
    }

    decrementPending() {
        this.pendingRequestCount = Math.max(0, this.pendingRequestCount - 1);
        pendingRequests = this.pendingRequestCount;
        return this.pendingRequestCount;
    }

    resetPending() {
        this.pendingRequestCount = 0;
        pendingRequests = 0;
    }
}

function isFinalTweetStatus(status) {
    return FINAL_TWEET_STATUSES.has(status);
}

function isActiveTweetStatus(status) {
    return ACTIVE_TWEET_STATUSES.has(status);
}

function isCompleteCachedRating(entry) {
    return !!entry && entry.streaming !== true && entry.score !== undefined && entry.score !== null;
}

const appSettings = new AppSettingsStore();
const tweetProcessingState = new TweetProcessingState();
