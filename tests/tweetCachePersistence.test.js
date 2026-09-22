const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../src/backends/TweetCache.js'), 'utf8');

function createCache(storage = new Map(), fail = () => false) {
    const writes = [], deletes = [], timers = new Map(), events = {};
    let nextTimer = 0;
    const context = vm.createContext({
        browserGet: (key, fallback) => storage.has(key) ? storage.get(key) : fallback,
        browserSet(key, value) {
            writes.push([key, value]);
            if (fail(key, value)) return false;
            storage.set(key, value);
            return true;
        },
        browserDelete(key) {
            deletes.push(key);
            if (fail(key)) return false;
            storage.delete(key);
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
    return { cache: context.cache, Cache: context.Cache, storage, writes, deletes, timers, events,
        tick() { const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach(fn => fn()); } };
}

test('batches intermediate writes and saves finished ratings immediately', () => {
    const h = createCache();
    h.tick(); h.writes.length = 0;
    h.cache.set('1', { score: 8 }, true);
    const timer = [...h.timers.keys()][0];
    for (let i = 0; i < 100; i++) h.cache.set('1', { reasoning: String(i) }, false);
    assert.equal(h.writes.length, 0);
    assert.deepEqual([...h.timers.keys()], [timer]);
    h.tick();
    assert.equal(h.writes.length, 2);
    assert.equal(h.writes[0][0], h.Cache.ENTRY_PREFIX + '1');
    assert.equal(createCache(h.storage).cache.get('1').reasoning, '99');
    h.cache.set('1', { streaming: false, score: 8 });
    assert.equal(createCache(h.storage).cache.get('1').score, 8);
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

test('one failed entry does not stop other entries and retries later', () => {
    let fail = true;
    const h = createCache(new Map(), key => fail && key === 'tweetRating.entry.1');
    h.cache.set('1', { score: 8, streaming: false });
    h.cache.set('2', { score: 9, streaming: false });
    assert.equal(createCache(h.storage).cache.get('1'), null);
    assert.equal(createCache(h.storage).cache.get('2').score, 9);
    fail = false;
    h.events.pagehide();
    assert.equal(createCache(h.storage).cache.get('1').score, 8);
});

test('more than 256 ratings and long conversations survive reload', () => {
    const h = createCache();
    for (let i = 0; i < 300; i++) h.cache.set(String(i), { score: 7 });
    h.cache.set('0', { streaming: false, qaConversationHistory: [
        { role: 'user', content: [{ type: 'text', text: 'x'.repeat(40000) }] },
        { role: 'assistant', content: [{ type: 'text', text: 'answer' }] }
    ] });
    h.tick();
    const restored = createCache(h.storage).cache;
    assert.equal(restored.size, 300);
    assert.equal(restored.get('0').qaConversationHistory[0].content[0].text.length, 40000);
    assert.equal(restored.get('299').score, 7);
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

test('invalid updates are isolated without dropping large valid entries', () => {
    const h = createCache();
    h.cache.set('1', { score: 8 });
    const circular = {}; circular.self = circular;
    h.cache.set('1', { metadata: circular });
    h.cache.set('large', { streaming: true });
    h.cache.set('large', { description: 'x'.repeat(40000), streaming: false });
    assert.equal(h.cache.get('large').description.length, 40000);
    h.cache.set('1', null);
    assert.equal(h.cache.get('1').score, 8);
    h.cache.set('2', { score: {}, questions: [null, 3, 'ok'], fullContext: {} });
    assert.equal(h.cache.get('2').score, null);
    assert.equal(h.cache.get('2').questions.length, 1);
});

test('migrates legacy entries and discards interrupted ratings', () => {
    const now = Date.now();
    const storage = new Map([['tweetRatings', JSON.stringify({
        good: { score: 8, timestamp: now },
        stale: { score: 9, timestamp: 0 },
        streaming: { score: 7, streaming: true, timestamp: now },
        invalid: null
    })]]);
    const h = createCache(storage);
    assert.equal(h.cache.size, 2);
    assert.equal(h.cache.get('good').fromStorage, true);
    h.tick();
    assert.equal(storage.has('tweetRatings'), false);
    assert.equal(createCache(storage).cache.get('good').score, 8);
});

test('migrates numbered buckets and removes them after successful writes', () => {
    const initial = createCache();
    const storage = new Map();
    for (const id of ['1', '2']) storage.set(initial.Cache.OLD_PREFIX + initial.cache.oldBucket(id),
        JSON.stringify({ version: 2, entries: [[id, { score: Number(id), timestamp: Date.now() }]] }));
    const h = createCache(storage);
    assert.equal(h.cache.size, 2);
    h.tick();
    assert.equal([...storage.keys()].some(key => key.startsWith(h.Cache.OLD_PREFIX)), false);
    assert.equal(createCache(storage).cache.get('2').score, 2);
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

test('a follow-up conversation saves immediately without an initial rating', () => {
    const h = createCache();
    h.cache.set('question-only', { qaConversationHistory: [
        { role: 'user', content: [{ type: 'text', text: 'What happened?' }] },
        { role: 'assistant', content: [{ type: 'text', text: 'An answer.' }] }
    ] });
    assert.equal(createCache(h.storage).cache.get('question-only').qaConversationHistory.length, 2);
});
