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

/** Each rating has an independent storage key. Reads return snapshots. */
class TweetCache {
    static SAVE_DELAY = 1500;
    static INDEX_KEY = 'tweetRating.index';
    static ENTRY_PREFIX = 'tweetRating.entry.';
    static OLD_PREFIX = 'tweetRatings.v2.';
    static OLD_BUCKETS = 16;

    constructor() {
        this.entries = new Map();
        this.dirty = new Set();
        this.persistedIds = new Set();
        this.legacyKeys = new Set();
        this.indexDirty = false;
        this.timer = null;
        this.loadFromStorage();
        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'hidden') this.flush();
            });
        }
        if (typeof window !== 'undefined') window.addEventListener('pagehide', () => this.flush());
    }

    oldBucket(id) {
        let hash = 0;
        for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
        return (hash >>> 0) % TweetCache.OLD_BUCKETS;
    }

    entryKey(id) { return TweetCache.ENTRY_PREFIX + encodeURIComponent(id); }

    loadFromStorage() {
        const rawIndex = browserGet(TweetCache.INDEX_KEY, '[]');
        let ids = [];
        try {
            const parsed = JSON.parse(rawIndex);
            if (Array.isArray(parsed)) ids = parsed.filter(id => typeof id === 'string');
            else this.indexDirty = true;
        } catch (_) { this.indexDirty = true; }
        for (const id of ids) {
            this.persistedIds.add(id);
            const raw = browserGet(this.entryKey(id), null);
            try {
                if (typeof raw === 'string' && this.restore(id, JSON.parse(raw))) {
                    this.dirty.delete(id);
                } else {
                    this.persistedIds.delete(id);
                    this.dirty.add(id);
                    this.indexDirty = true;
                }
            } catch (_) {
                this.persistedIds.delete(id);
                this.dirty.add(id);
                this.indexDirty = true;
            }
        }
        for (let bucket = 0; bucket < TweetCache.OLD_BUCKETS; bucket++) {
            const key = TweetCache.OLD_PREFIX + bucket;
            try {
                const raw = browserGet(key, null);
                if (raw === null) continue;
                this.legacyKeys.add(key);
                const data = JSON.parse(raw);
                if (data.version !== 2 || !Array.isArray(data.entries)) continue;
                for (const pair of data.entries) {
                    if (Array.isArray(pair) && typeof pair[0] === 'string' &&
                        this.oldBucket(pair[0]) === bucket && !this.entries.has(pair[0])) {
                        this.restore(pair[0], pair[1]);
                    }
                }
            } catch (_) { /* A corrupt bucket must not prevent startup. */ }
        }
        try {
            const raw = browserGet('tweetRatings', null);
            if (raw !== null) {
                this.legacyKeys.add('tweetRatings');
                const legacy = JSON.parse(raw);
                if (legacy && typeof legacy === 'object' && !Array.isArray(legacy)) {
                    for (const [id, entry] of Object.entries(legacy)) {
                        if (!this.entries.has(id)) this.restore(id, entry);
                    }
                }
            }
        } catch (_) { /* A corrupt legacy cache must not prevent startup. */ }
        this.scheduleSave();
    }

    restore(id, entry) {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
        // An interrupted request cannot resume after navigation.
        if (entry.streaming || ['pending', 'streaming', 'processing'].includes(entry.status)) return false;
        return this.put(id, { ...entry, streaming: false, fromStorage: true });
    }

    put(id, value) {
        if (typeof id !== 'string' || !id || id.length > 128) return false;
        let json;
        try { json = JSON.stringify(normalizeTweetCacheEntry(value)); } catch (_) { return false; }
        if (this.entries.get(id) === json) return false;
        this.entries.set(id, json);
        this.dirty.add(id);
        return true;
    }

    get(id) {
        id = String(id);
        const json = this.entries.get(id);
        return json ? JSON.parse(json) : null;
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
        if (this.put(id, next)) {
            if ((rating.streaming === false && next.score != null) ||
                (Array.isArray(rating.qaConversationHistory) && next.streaming !== true)) this.flush();
            else this.scheduleSave();
        }
    }

    has(id) { return this.get(id) !== null; }
    hasCompleteRating(id) { return isCompleteCachedRating(this.get(id)); }
    get size() { return this.entries.size; }
    get cache() { return Object.fromEntries([...this.entries].map(([id, json]) => [id, JSON.parse(json)])); }

    remove(id) {
        if (this.entries.delete(id) || this.persistedIds.has(id)) this.dirty.add(id);
    }

    delete(id) {
        this.remove(String(id));
        this.scheduleSave();
    }

    clear() {
        for (const id of this.entries.keys()) this.dirty.add(id);
        for (const id of this.persistedIds) this.dirty.add(id);
        this.entries.clear();
        this.indexDirty = true;
        this.flush();
    }

    scheduleSave() {
        if (this.timer !== null || (!this.dirty.size && !this.indexDirty && !this.legacyKeys.size)) return;
        // Fixed deadline: continuous streaming cannot postpone persistence indefinitely.
        this.timer = setTimeout(() => { this.timer = null; this.flush(); }, TweetCache.SAVE_DELAY);
    }

    flush() {
        if (this.timer !== null) clearTimeout(this.timer);
        this.timer = null;
        let failed = false;
        for (const id of [...this.dirty]) {
            const json = this.entries.get(id);
            const saved = json === undefined ? browserDelete(this.entryKey(id)) : browserSet(this.entryKey(id), json);
            if (saved === false) { failed = true; continue; }
            if (json === undefined) this.persistedIds.delete(id);
            else this.persistedIds.add(id);
            this.dirty.delete(id);
            this.indexDirty = true;
        }
        if (this.indexDirty && browserSet(TweetCache.INDEX_KEY, JSON.stringify([...this.persistedIds])) !== false) {
            this.indexDirty = false;
        } else if (this.indexDirty) failed = true;
        if (!failed && !this.dirty.size && !this.indexDirty) {
            for (const key of [...this.legacyKeys]) {
                if (browserDelete(key) !== false) this.legacyKeys.delete(key);
            }
        }
        if (failed) {
            console.warn('Some tweet ratings could not be saved; the next update will retry.');
        }
        if (typeof updateCacheStatsUI === 'function') {
            try { updateCacheStatsUI(); } catch (_) { /* UI may not be initialized yet. */ }
        }
    }
}

const tweetCache = new TweetCache();
