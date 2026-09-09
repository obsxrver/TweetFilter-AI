const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'ui', 'ScoreIndicator.js'), 'utf8');

function setup({ mobile = false } = {}) {
    const timers = new Map();
    let nextTimer = 0;
    const context = vm.createContext({
        isMobileDevice: () => mobile,
        setTimeout: callback => { timers.set(++nextTimer, callback); return nextTimer; },
        clearTimeout: id => timers.delete(id),
        window: {},
        ScoreIndicatorRegistry: { remove() {} }
    });
    const ScoreIndicator = vm.runInContext(`${source}\nScoreIndicator`, context);
    const element = () => ({
        style: { display: 'none' },
        // Simulate a stale CSS hover state after the pointer has left.
        matches: () => true,
        classList: { add() {}, remove() {} },
        setAttribute() {},
        remove() {}
    });
    const instance = Object.assign(Object.create(ScoreIndicator.prototype), {
        indicatorElement: element(),
        tooltipElement: element(),
        pinButton: element(),
        isPinned: false,
        isVisible: false,
        autoScroll: false,
        _indicatorHovered: false,
        _tooltipHovered: false,
        _hideTimer: null,
        _setPosition() {},
        _updateScrollButtonVisibility() {},
        _removeRegisteredListeners() {},
        findCurrentArticleElement: () => null
    });
    function flush() {
        const callbacks = [...timers.values()];
        timers.clear();
        callbacks.forEach(callback => callback());
    }
    return { instance, timers, flush };
}

test('leaving the score dismisses the tooltip despite stale CSS hover state', () => {
    const { instance, flush } = setup();
    instance._handleMouseEnter();
    instance._handleMouseLeave();
    assert.equal(instance.isVisible, true);
    flush();
    assert.equal(instance.isVisible, false);
    assert.equal(instance.tooltipElement.style.display, 'none');
});

test('crossing between the score and tooltip cancels dismissal without repositioning', () => {
    const { instance, flush, timers } = setup();
    instance._handleMouseEnter();
    instance._setPosition = () => assert.fail('entering the tooltip should not reposition it');
    instance._handleMouseLeave();
    instance._handleTooltipMouseEnter();
    assert.equal(timers.size, 0);
    flush();
    assert.equal(instance.isVisible, true);
    instance._handleTooltipMouseLeave();
    flush();
    assert.equal(instance.isVisible, false);
});

test('returning to the score cancels dismissal', () => {
    const { instance, flush } = setup();
    instance._handleMouseEnter();
    instance._handleMouseLeave();
    instance._handleTooltipMouseEnter();
    instance._handleTooltipMouseLeave();
    instance._handleMouseEnter();
    flush();
    assert.equal(instance.isVisible, true);
    instance._handleMouseLeave();
    flush();
    assert.equal(instance.isVisible, false);
});

test('pinned tooltips stay open on exit and close after unpinning outside', () => {
    const { instance, flush } = setup();
    instance._handleMouseEnter();
    instance.pin();
    instance._handleMouseLeave();
    flush();
    assert.equal(instance.isVisible, true);
    instance.unpin();
    flush();
    assert.equal(instance.isVisible, false);
});

test('unpinning while inside the tooltip waits for pointer exit', () => {
    const { instance, flush } = setup();
    instance.show();
    instance._handleTooltipMouseEnter();
    instance.pin();
    instance.unpin();
    flush();
    assert.equal(instance.isVisible, true);
    instance._handleTooltipMouseLeave();
    flush();
    assert.equal(instance.isVisible, false);
});

test('touch leaves a tapped tooltip open while a mouse on mobile can dismiss it', () => {
    const { instance, flush } = setup({ mobile: true });
    const touch = { pointerType: 'touch' };
    instance._handleMouseEnter(touch);
    assert.equal(instance.isVisible, false);
    instance._handleIndicatorClick({ stopPropagation() {}, preventDefault() {} });
    instance._handleMouseLeave(touch);
    instance._handleTooltipMouseEnter(touch);
    instance._handleTooltipMouseLeave(touch);
    flush();
    assert.equal(instance.isVisible, true);
    instance._handleMouseEnter({ pointerType: 'mouse' });
    instance._handleMouseLeave({ pointerType: 'mouse' });
    flush();
    assert.equal(instance.isVisible, false);
});

test('destroy cancels pending dismissal before removing the elements', () => {
    const { instance, flush, timers } = setup();
    instance._handleMouseEnter();
    instance._handleMouseLeave();
    assert.equal(timers.size, 1);
    instance.destroy();
    assert.equal(timers.size, 0);
    assert.doesNotThrow(flush);
});
