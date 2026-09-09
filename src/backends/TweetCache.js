const EMPTY_TWEET_METADATA = Object.freeze({
    model: null, promptTokens: null, completionTokens: null,
    latency: null, mediaInputs: null, price: null
});

function normalizeScore(score) {
    if (score === undefined || score === null || score === '' ||
        !['number', 'string'].includes(typeof score)) return null;
    const value = Number(score);
    return Number.isFinite(value) ? Math.max(0, Math.min(10, value)) : null;
}

function normalizeTweetCacheEntry(entry = {}) {
    const result = {};
    for (const key of ['fullContext', 'description', 'reasoning', 'lastAnswer',
        'tweetContent', 'authorHandle', 'individualTweetText']) {
        result[key] = typeof entry[key] === 'string' ? entry[key] : '';
    }
    for (const key of ['questions', 'mediaUrls', 'individualMediaUrls']) {
        result[key] = Array.isArray(entry[key]) ? entry[key].filter(value => typeof value === 'string') : [];
    }
    result.qaConversationHistory = Array.isArray(entry.qaConversationHistory)
        ? entry.qaConversationHistory.filter(message => message && ['system', 'user', 'assistant'].includes(message.role))
            .map(message => ({ role: message.role, content: typeof message.content === 'string'
                ? [{ type: 'text', text: message.content }]
                : (Array.isArray(message.content) ? message.content.filter(part => part && (
                    (part.type === 'text' && typeof part.text === 'string') ||
                    (part.type === 'image_url' && typeof part.image_url?.url === 'string') ||
                    (part.type === 'file' && typeof part.file?.file_data === 'string')
                )) : []) })) : [];
    result.score = normalizeScore(entry.score);
    result.status = typeof entry.status === 'string' ? entry.status : null;
    result.metadata = entry.metadata && typeof entry.metadata === 'object'
        ? { ...EMPTY_TWEET_METADATA, ...entry.metadata } : { ...EMPTY_TWEET_METADATA };
    result.threadContext = entry.threadContext && typeof entry.threadContext === 'object' ? entry.threadContext : null;
    result.streaming = entry.streaming === true;
    result.blacklisted = entry.blacklisted === true;
    result.error = typeof entry.error === 'string' ? entry.error : null;
    result.fromStorage = entry.fromStorage === true;
    result.timestamp = Number.isFinite(entry.timestamp) ? entry.timestamp : Date.now();
    return result;
}

/** Bounded, disposable storage. Reads return snapshots; all updates go through set(). */
class TweetCache {
    static BUCKETS = 16;
    static MAX_ENTRIES = 256;
    static MAX_BYTES = 1024 * 1024;
    static MAX_ENTRY_BYTES = 32 * 1024;
    static MAX_AGE = 30 * 24 * 60 * 60 * 1000;
    static SAVE_DELAY = 1500;
    static PREFIX = 'tweetRatings.v2.';

    constructor() {
        this.entries = new Map();
        this.bytes = 0;
        this.dirty = new Set();
        this.timer = null;
        this.storageDisabled = false;
        this.migrating = false;
        this.loadFromStorage();
        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'hidden') this.flush();
            });
        }
        if (typeof window !== 'undefined') window.addEventListener('pagehide', () => this.flush());
    }

    bucket(id) {
        let hash = 0;
        for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
        return (hash >>> 0) % TweetCache.BUCKETS;
    }

    loadFromStorage() {
        let found = false;
        for (let bucket = 0; bucket < TweetCache.BUCKETS; bucket++) {
            try {
                const raw = browserGet(TweetCache.PREFIX + bucket, null);
                if (raw === null) continue;
                found = true;
                if (typeof raw !== 'string' || raw.length * 2 > TweetCache.MAX_BYTES + 65536) continue;
                const data = JSON.parse(raw);
                if (data.version !== 2 || !Array.isArray(data.entries)) continue;
                for (const pair of data.entries.slice(-TweetCache.MAX_ENTRIES)) {
                    if (Array.isArray(pair) && typeof pair[0] === 'string' && this.bucket(pair[0]) === bucket) {
                        this.restore(pair[0], pair[1]);
                    }
                }
            } catch (_) { /* A corrupt bucket must not prevent startup. */ }
        }
        if (!found) {
            try {
                const raw = browserGet('tweetRatings', '{}');
                // Do not parse arbitrarily large legacy payloads on memory-constrained devices.
                if (typeof raw === 'string' && raw.length * 2 <= 4 * TweetCache.MAX_BYTES) {
                    const legacy = JSON.parse(raw);
                    if (legacy && typeof legacy === 'object' && !Array.isArray(legacy)) {
                        for (const id of Object.keys(legacy).slice(-TweetCache.MAX_ENTRIES)) this.restore(id, legacy[id]);
                    }
                }
            } catch (_) { /* Cache data is optional. */ }
            this.migrating = true;
            for (let i = 0; i < TweetCache.BUCKETS; i++) this.dirty.add(i);
        }
        this.scheduleSave();
    }

    restore(id, entry) {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry) ||
            !Number.isFinite(entry.timestamp) || Date.now() - entry.timestamp > TweetCache.MAX_AGE) return;
        // An interrupted request cannot resume after navigation.
        if (entry.streaming || ['pending', 'streaming', 'processing'].includes(entry.status)) return;
        this.put(id, { ...entry, streaming: false, fromStorage: true });
    }

    put(id, value) {
        if (typeof id !== 'string' || !id || id.length > 128) return false;
        let json;
        try { json = JSON.stringify(normalizeTweetCacheEntry(value)); } catch (_) { return false; }
        const bytes = (json.length + id.length) * 2;
        // An oversized result is not cached. Remove older state so an interrupted
        // streaming entry or obsolete conversation cannot be mistaken for the result.
        if (bytes > TweetCache.MAX_ENTRY_BYTES) {
            this.remove(id);
            return true;
        }
        const previous = this.entries.get(id);
        if (previous?.json === json) return false;
        if (previous) this.bytes -= previous.bytes;
        this.entries.delete(id);
        this.entries.set(id, { json, bytes });
        this.bytes += bytes;
        this.dirty.add(this.bucket(id));
        while (this.entries.size > TweetCache.MAX_ENTRIES || this.bytes > TweetCache.MAX_BYTES) {
            this.remove(this.entries.keys().next().value);
        }
        return true;
    }

    get(id) {
        id = String(id);
        const record = this.entries.get(id);
        if (!record) return null;
        const entry = JSON.parse(record.json);
        if (Date.now() - entry.timestamp > TweetCache.MAX_AGE) {
            this.delete(id);
            return null;
        }
        // Map insertion order tracks recent use without requiring a storage write.
        this.entries.delete(id);
        this.entries.set(id, record);
        return entry;
    }

    set(id, rating, _saveImmediately) {
        if (!id || !rating || typeof rating !== 'object') return;
        id = String(id);
        const previous = this.get(id) || {};
        const next = { ...previous, ...rating,
            metadata: { ...previous.metadata, ...rating.metadata },
            timestamp: rating.timestamp ?? Date.now() };
        if (previous.individualTweetText?.length > next.individualTweetText?.length) next.individualTweetText = previous.individualTweetText;
        if (previous.individualMediaUrls?.length > next.individualMediaUrls?.length) next.individualMediaUrls = previous.individualMediaUrls;
        if (this.put(id, next)) this.scheduleSave();
    }

    has(id) { return this.get(id) !== null; }
    hasCompleteRating(id) { return isCompleteCachedRating(this.get(id)); }
    get size() { return this.entries.size; }
    get cache() { return Object.fromEntries([...this.entries].map(([id, record]) => [id, JSON.parse(record.json)])); }

    remove(id) {
        const record = this.entries.get(id);
        if (!record) return;
        this.bytes -= record.bytes;
        this.entries.delete(id);
        this.dirty.add(this.bucket(id));
    }

    delete(id) {
        this.remove(String(id));
        this.scheduleSave();
    }

    clear() {
        this.entries.clear();
        this.bytes = 0;
        // Clear every bucket, including corrupt or skipped data, and cancel pending saves.
        for (let i = 0; i < TweetCache.BUCKETS; i++) this.dirty.add(i);
        this.storageDisabled = false;
        this.migrating = true;
        this.flush();
    }

    scheduleSave() {
        if (this.timer !== null || this.storageDisabled || !this.dirty.size) return;
        // Fixed deadline: continuous streaming cannot postpone persistence indefinitely.
        this.timer = setTimeout(() => { this.timer = null; this.flush(); }, TweetCache.SAVE_DELAY);
    }

    flush() {
        if (this.timer !== null) clearTimeout(this.timer);
        this.timer = null;
        if (this.storageDisabled || !this.dirty.size) return;
        try {
            for (const bucket of this.dirty) {
                const entries = [];
                for (const [id, record] of this.entries) {
                    if (this.bucket(id) === bucket) entries.push([id, JSON.parse(record.json)]);
                }
                const result = browserSet(TweetCache.PREFIX + bucket, JSON.stringify({ version: 2, entries }));
                if (result === false) throw new Error('Cache storage unavailable');
            }
            if (this.migrating) {
                if (browserSet('tweetRatings', '{}') === false) throw new Error('Legacy cache cleanup failed');
                this.migrating = false;
            }
            this.dirty.clear();
        } catch (error) {
            // Keep serving the bounded memory cache, without repeatedly hammering full storage.
            this.storageDisabled = true;
            console.warn('Tweet cache persistence disabled for this page:', error);
        }
        if (typeof updateCacheStatsUI === 'function') {
            try { updateCacheStatsUI(); } catch (_) { /* UI may not be initialized yet. */ }
        }
    }
}

const tweetCache = new TweetCache();
