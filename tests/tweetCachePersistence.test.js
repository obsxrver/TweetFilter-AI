const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../src/backends/TweetCache.js'), 'utf8');

function createCache(storage = new Map(), fail = () => false) {
    const writes = [], timers = new Map(), events = {};
    let nextTimer = 0;
    const context = vm.createContext({
        browserGet: (key, fallback) => storage.has(key) ? storage.get(key) : fallback,
        browserSet(key, value) {
            writes.push([key, value]);
            if (fail()) return false;
            storage.set(key, value);
            return true;
        },
        updateCacheStatsUI() {},
        isCompleteCachedRating: entry => !!entry && !entry.streaming && entry.score !== null,
        setTimeout(fn) { timers.set(++nextTimer, fn); return nextTimer; },
        clearTimeout: id => timers.delete(id),
        document: { visibilityState: 'hidden', addEventListener: (name, fn) => events[name] = fn },
        window: { addEventListener: (name, fn) => events[name] = fn },
        console: { warn() {} }
    });
    vm.runInContext(`${source}\nglobalThis.cache = tweetCache; globalThis.Cache = TweetCache;`, context);
    return { cache: context.cache, Cache: context.Cache, storage, writes, timers, events,
        tick() { const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach(fn => fn()); } };
}

test('batches manual and automatic writes on a fixed deadline, writing only changed buckets', () => {
    const h = createCache();
    h.tick(); h.writes.length = 0;
    h.cache.set('1', { score: 8 }, true);
    const timer = [...h.timers.keys()][0];
    for (let i = 0; i < 100; i++) h.cache.set('1', { reasoning: String(i) }, false);
    assert.equal(h.writes.length, 0);
    assert.deepEqual([...h.timers.keys()], [timer]);
    h.tick();
    assert.equal(h.writes.length, 1);
    assert.equal(createCache(h.storage).cache.get('1').reasoning, '99');
});

test('clear cancels queued updates and persists an empty cache across reloads', () => {
    const h = createCache();
    h.cache.set('1', { score: 8 });
    h.cache.clear(); h.tick();
    assert.equal(h.timers.size, 0);
    assert.equal(createCache(h.storage).cache.size, 0);
});

test('delete survives reload and lifecycle events flush queued writes', () => {
    const h = createCache();
    h.cache.set('1', { score: 8 }); h.events.visibilitychange();
    assert.equal(createCache(h.storage).cache.get('1').score, 8);
    h.cache.delete('1'); h.events.pagehide();
    assert.equal(createCache(h.storage).cache.get('1'), null);
});

test('quota failures retain memory results and stop repeated writes', () => {
    let fail = false;
    const h = createCache(new Map(), () => fail);
    h.tick(); fail = true;
    h.cache.set('1', { score: 8 }); h.tick();
    const count = h.writes.length;
    h.cache.set('2', { score: 9 }); h.tick(); h.events.pagehide();
    assert.equal(h.writes.length, count);
    assert.equal(h.cache.get('2').score, 9);
    fail = false; h.cache.clear();
    assert.equal(createCache(h.storage).cache.size, 0);
});

test('bounded LRU evicts older entries and enforces a total byte budget', () => {
    const h = createCache();
    for (let i = 0; i < 256; i++) h.cache.set(String(i), { score: 7 });
    h.cache.get('0'); h.cache.set('256', { score: 8 });
    assert.equal(h.cache.get('1'), null);
    assert.equal(h.cache.get('0').score, 7);
    for (let i = 300; i < 600; i++) h.cache.set(String(i), { fullContext: 'x'.repeat(10000) });
    assert.ok(h.cache.bytes <= h.Cache.MAX_BYTES);
    assert.ok(h.cache.size <= h.Cache.MAX_ENTRIES);
    h.tick();
    assert.ok(createCache(h.storage).cache.bytes <= h.Cache.MAX_BYTES);
});

test('snapshot reads and caller-owned objects cannot mutate cached state', () => {
    const h = createCache();
    const input = { score: 8, metadata: { model: 'test' }, questions: ['why'] };
    h.cache.set('__proto__', input);
    input.questions.push('mutated');
    h.cache.get('__proto__').metadata.model = 'changed';
    h.cache.cache.__proto__.score = 0;
    assert.equal(h.cache.get('__proto__').metadata.model, 'test');
    assert.equal(h.cache.get('__proto__').questions.length, 1);
    assert.equal(h.cache.has('toString'), false);
});

test('invalid updates are isolated and oversized updates discard obsolete state', () => {
    const h = createCache();
    h.cache.set('1', { score: 8 });
    const circular = {}; circular.self = circular;
    h.cache.set('1', { metadata: circular });
    h.cache.set('large', { streaming: true });
    h.cache.set('large', { description: 'x'.repeat(h.Cache.MAX_ENTRY_BYTES), streaming: false });
    assert.equal(h.cache.get('large'), null);
    h.cache.set('1', null);
    assert.equal(h.cache.get('1').score, 8);
    h.cache.set('2', { score: {}, questions: [null, 3, 'ok'], fullContext: {} });
    assert.equal(h.cache.get('2').score, null);
    assert.equal(h.cache.get('2').questions.length, 1);
});

test('migrates valid legacy entries and discards stale or interrupted ratings', () => {
    const now = Date.now();
    const storage = new Map([['tweetRatings', JSON.stringify({
        good: { score: 8, timestamp: now },
        stale: { score: 9, timestamp: 0 },
        streaming: { score: 7, streaming: true, timestamp: now },
        invalid: null
    })]]);
    const h = createCache(storage);
    assert.equal(h.cache.size, 1);
    assert.equal(h.cache.get('good').fromStorage, true);
    h.tick();
    assert.equal(storage.get('tweetRatings'), '{}');
    assert.equal(createCache(storage).cache.get('good').score, 8);
});

test('corrupt bucket does not prevent other buckets loading', () => {
    const h = createCache();
    h.cache.set('1', { score: 8 }); h.cache.set('2', { score: 9 }); h.tick();
    h.storage.set(h.Cache.PREFIX + h.cache.bucket('1'), '{broken');
    const restored = createCache(h.storage);
    assert.equal(restored.cache.get('1'), null);
    assert.equal(restored.cache.get('2').score, 9);
});

test('streaming scores are never restored as completed ratings', () => {
    const h = createCache();
    h.cache.set('1', { score: 8, streaming: true }); h.tick();
    assert.equal(createCache(h.storage).cache.hasCompleteRating('1'), false);
    h.cache.set('1', { streaming: false }); h.tick();
    assert.equal(createCache(h.storage).cache.hasCompleteRating('1'), true);
});


test('multimodal conversations round-trip and malformed parts cannot crash rehydration', () => {
    const h = createCache();
    h.cache.set('1', { qaConversationHistory: [
        { role: 'system', content: 'instructions' },
        { role: 'user', content: [null, { type: 'text', text: 'question' },
            { type: 'image_url', image_url: { url: 'https://example.com/image' } },
            { type: 'image_url', image_url: { url: 123 } }] },
        { role: 'assistant', content: [{ type: 'text', text: 'answer' }] }
    ] });
    h.tick();
    const history = createCache(h.storage).cache.get('1').qaConversationHistory;
    assert.equal(history.length, 3);
    assert.equal(history[0].content[0].text, 'instructions');
    assert.equal(history[1].content.length, 2);
    assert.equal(history[2].content[0].text, 'answer');
});
