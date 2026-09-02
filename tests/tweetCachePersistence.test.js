const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const tweetCacheSource = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'backends', 'TweetCache.js'),
    'utf8'
);

function createCache() {
    const writes = [];
    const context = vm.createContext({
        browserGet() { return '{}'; },
        browserSet(key, value) { writes.push([key, value]); },
        updateCacheStatsUI() {},
        isCompleteCachedRating(entry) {
            return !!entry && entry.streaming !== true && entry.score !== null;
        },
        setTimeout,
        clearTimeout,
        console
    });

    vm.runInContext(`
        ${tweetCacheSource}
        globalThis.TweetCacheForTest = TweetCache;
    `, context);

    const cache = new context.TweetCacheForTest();
    let debouncedWrites = 0;
    cache.debouncedSaveToStorage = () => { debouncedWrites += 1; };
    return { cache, writes, getDebouncedWrites: () => debouncedWrites };
}

test('set, delete, and clear persist immediately by default', () => {
    const { cache, writes, getDebouncedWrites } = createCache();

    cache.set('1', { score: 8 });
    cache.delete('1');
    cache.clear();

    assert.equal(writes.length, 3);
    assert.equal(getDebouncedWrites(), 0);
});

test('set uses the debounced writer only when explicitly requested', () => {
    const { cache, writes, getDebouncedWrites } = createCache();

    cache.set('1', { score: 8 }, false);

    assert.equal(writes.length, 0);
    assert.equal(getDebouncedWrites(), 1);
});
