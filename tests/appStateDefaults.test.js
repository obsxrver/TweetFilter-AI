const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const appStateSource = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'appState.js'),
    'utf8'
);

test('rating defaults use Opus 4.6 with auto-rating disabled', () => {
    const context = vm.createContext({
        browserGet() {},
        browserSet() {},
        window: {}
    });

    vm.runInContext(`
        ${appStateSource}
        globalThis.defaultsForTest = { ...DEFAULT_SETTINGS };
    `, context);

    assert.equal(context.defaultsForTest.selectedModel, 'anthropic/claude-opus-4.6');
    assert.equal(context.defaultsForTest.enableAutoRating, false);
});

test('cache writes are debounced only for automatic ratings while auto-rate is enabled', () => {
    let autoRatingEnabled = true;
    const context = vm.createContext({
        browserGet(key, fallback) {
            return key === 'enableAutoRating' ? autoRatingEnabled : fallback;
        },
        browserSet() {},
        window: {}
    });

    vm.runInContext(`
        ${appStateSource}
        globalThis.shouldSaveImmediatelyForTest = shouldSaveRatingCacheImmediately;
    `, context);

    assert.equal(context.shouldSaveImmediatelyForTest(false), false);
    assert.equal(context.shouldSaveImmediatelyForTest(true), true);

    autoRatingEnabled = false;
    assert.equal(context.shouldSaveImmediatelyForTest(false), true);
});
