const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const scoreIndicatorSource = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'ui', 'ScoreIndicator.js'),
    'utf8'
);

function createContext() {
    const context = vm.createContext({
        console,
        Map,
        setTimeout,
        TweetRatingStatus: {
            PENDING: 'pending',
            STREAMING: 'streaming',
            RATED: 'rated',
            CACHED: 'cached',
            MANUAL: 'manual',
            ERROR: 'error',
            BLACKLISTED: 'blacklisted',
            AD: 'ad'
        },
        window: { activeStreamingRequests: {} }
    });
    vm.runInContext(`
        ${scoreIndicatorSource}
        globalThis.ScoreIndicatorForTest = ScoreIndicator;
    `, context);
    return context;
}

test('clearing for a new rating preserves the tooltip instance and visibility', () => {
    const { ScoreIndicatorForTest } = createContext();
    const tooltipElement = {
        dataset: { autoScroll: 'false' }
    };
    const instance = Object.assign(Object.create(ScoreIndicatorForTest.prototype), {
        status: 'rated',
        score: 8,
        description: 'Old rating',
        reasoning: 'Old reasoning',
        metadata: { model: 'old-model' },
        conversationHistory: [{ question: 'Old?', answer: 'Yes' }],
        questions: ['Old?'],
        qaConversationHistory: [{ role: 'system', content: [] }],
        currentFollowUpSource: 'button',
        isFollowUpPending: true,
        editingTurnIndex: 0,
        autoScroll: false,
        autoScrollConversation: false,
        userInitiatedScroll: true,
        _lastScrollPosition: 100,
        isVisible: true,
        isPinned: true,
        tooltipElement,
        tooltipScrollableContentElement: { scrollTop: 100 },
        customQuestionInput: { value: 'old question', style: { height: '50px' }, rows: 3 },
        _clearFollowUpImage() {},
        _setFollowUpControlsDisabled() {},
        _updateIndicatorUI() {},
        _updateTooltipUI() {}
    });

    instance.clearForRating();

    assert.equal(instance.tooltipElement, tooltipElement);
    assert.equal(instance.isVisible, true);
    assert.equal(instance.isPinned, true);
    assert.equal(instance.status, 'pending');
    assert.equal(instance.score, null);
    assert.equal(instance.description, '');
    assert.equal(instance.reasoning, '');
    assert.equal(instance.metadata, null);
    assert.equal(instance.conversationHistory.length, 0);
    assert.equal(instance.questions.length, 0);
    assert.equal(instance.qaConversationHistory.length, 0);
    assert.equal(instance.customQuestionInput.value, '');
    assert.equal(instance.tooltipScrollableContentElement.scrollTop, 0);
    assert.equal(instance.tooltipElement.dataset.autoScroll, 'true');
});

test('retry reuses the manager and forces regeneration', () => {
    const context = createContext();
    const { ScoreIndicatorForTest } = context;
    const article = { id: 'article' };
    const calls = [];
    context.tweetCache = {
        has: () => true,
        delete: tweetId => calls.push(['delete-cache', tweetId])
    };
    context.tweetProcessingState = {
        clear: tweetId => calls.push(['clear-processing', tweetId]),
        resetRetries: tweetId => calls.push(['reset-retries', tweetId])
    };
    context.scheduleTweetProcessing = (target, rateAnyway) => calls.push(['schedule', target, rateAnyway]);

    const instance = Object.assign(Object.create(ScoreIndicatorForTest.prototype), {
        tweetId: '123',
        findCurrentArticleElement: () => article,
        clearForRating: () => calls.push(['clear-instance'])
    });
    instance.destroy = () => calls.push(['destroy']);

    instance._handleRefreshClick({ stopPropagation() {} });

    assert.equal(calls.some(call => call[0] === 'destroy'), false);
    assert.deepEqual(calls, [
        ['delete-cache', '123'],
        ['clear-processing', '123'],
        ['reset-retries', '123'],
        ['clear-instance'],
        ['schedule', article, true]
    ]);
});

test('rating actions switch between rate and re-rate as a rating is generated', () => {
    const { ScoreIndicatorForTest } = createContext();
    const instance = Object.assign(Object.create(ScoreIndicatorForTest.prototype), {
        status: 'manual',
        score: null,
        rateButton: { style: { display: 'none' } },
        refreshButton: { style: { display: 'none' } }
    });

    instance._updateRatingActionVisibility();
    assert.equal(instance.rateButton.style.display, 'inline-block');
    assert.equal(instance.refreshButton.style.display, 'none');

    instance.score = 8;
    instance._updateRatingActionVisibility();
    assert.equal(instance.rateButton.style.display, 'none');
    assert.equal(instance.refreshButton.style.display, 'none');

    instance.status = 'pending';
    instance.score = null;
    instance._updateRatingActionVisibility();
    assert.equal(instance.rateButton.style.display, 'none');
    assert.equal(instance.refreshButton.style.display, 'none');

    instance.status = 'rated';
    instance.score = 8;
    instance._updateRatingActionVisibility();
    assert.equal(instance.rateButton.style.display, 'none');
    assert.equal(instance.refreshButton.style.display, 'inline-block');
});

test('cached ratings expose re-rate while errors expose neither action', () => {
    const { ScoreIndicatorForTest } = createContext();
    const instance = Object.assign(Object.create(ScoreIndicatorForTest.prototype), {
        status: 'cached',
        score: 7,
        rateButton: { style: { display: 'inline-block' } },
        refreshButton: { style: { display: 'none' } }
    });

    instance._updateRatingActionVisibility();
    assert.equal(instance.rateButton.style.display, 'none');
    assert.equal(instance.refreshButton.style.display, 'inline-block');

    instance.status = 'error';
    instance.score = null;
    instance._updateRatingActionVisibility();
    assert.equal(instance.rateButton.style.display, 'none');
    assert.equal(instance.refreshButton.style.display, 'none');
});

test('streamed reasoning is finalized before the direct answer row', () => {
    const context = createContext();
    const { ScoreIndicatorForTest } = context;

    class FakeElement {
        constructor(className = '') {
            this.className = className;
            this.children = [];
            this.parentElement = null;
            this.style = {};
            this.textContent = '';
            this.innerHTML = '';
        }

        appendChild(child) {
            child.parentElement = this;
            this.children.push(child);
            return child;
        }

        insertBefore(child, reference) {
            const referenceIndex = this.children.indexOf(reference);
            if (referenceIndex === -1) {
                throw new Error('NotFoundError: reference is not a direct child');
            }
            child.parentElement = this;
            this.children.splice(referenceIndex, 0, child);
            return child;
        }

        remove() {
            if (!this.parentElement) return;
            const index = this.parentElement.children.indexOf(this);
            if (index !== -1) this.parentElement.children.splice(index, 1);
            this.parentElement = null;
        }

        querySelector(selector) {
            const className = selector.startsWith('.') ? selector.slice(1) : '';
            for (const child of this.children) {
                if (String(child.className || '').split(/\s+/).includes(className)) return child;
                const nestedMatch = child.querySelector?.(selector);
                if (nestedMatch) return nestedMatch;
            }
            return null;
        }

        addEventListener() {}
    }

    context.document = {
        createElement: () => new FakeElement(),
        createTextNode: text => ({ textContent: text, parentElement: null })
    };
    context.formatTooltipDescription = (_description, reasoning) => ({
        description: '',
        reasoning: `formatted:${reasoning}`
    });

    const lastTurn = new FakeElement('conversation-turn');
    const streamingReasoning = new FakeElement('streaming-reasoning-container');
    const answerRow = new FakeElement('conversation-answer-row');
    const answer = new FakeElement('conversation-answer');
    answerRow.appendChild(answer);
    lastTurn.appendChild(streamingReasoning);
    lastTurn.appendChild(answerRow);

    const conversationContainer = {
        querySelectorAll: selector => selector === '.conversation-turn' ? [lastTurn] : []
    };
    const instance = Object.assign(Object.create(ScoreIndicatorForTest.prototype), {
        conversationContainerElement: conversationContainer,
        conversationHistory: [{ question: 'Why?', answer: 'Because.', reasoning: 'trace' }]
    });

    instance._convertStreamingToDropdown();

    assert.equal(lastTurn.children.length, 2);
    assert.match(lastTurn.children[0].className, /conversation-reasoning/);
    assert.equal(lastTurn.children[1], answerRow);
    assert.equal(lastTurn.children[0].querySelector('.reasoning-text').innerHTML, 'formatted:trace');
});
