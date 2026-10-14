const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const exportSource = fs.readFileSync(path.join(__dirname, '../src/ui/openrouterExport.js'), 'utf8');
const indicatorSource = fs.readFileSync(path.join(__dirname, '../src/ui/ScoreIndicator.js'), 'utf8');
const parserSource = fs.readFileSync(path.join(__dirname, '../src/ui/responseParser.js'), 'utf8');
const configSource = fs.readFileSync(path.join(__dirname, '../src/config.js'), 'utf8');

function setup(overrides = {}) {
    const context = vm.createContext({
        console, Blob, selectedModel: 'test/model',
        isActiveTweetStatus: status => ['pending', 'streaming'].includes(status),
        TweetRatingStatus: { RATED: 'rated', CACHED: 'cached', BLACKLISTED: 'blacklisted', MANUAL: 'manual' },
        ...overrides
    });
    vm.runInContext(`${parserSource}\n${exportSource}\n${indicatorSource}\nglobalThis.Indicator = ScoreIndicator;`, context);
    return context;
}

function build(options) {
    return JSON.parse(JSON.stringify(setup().buildOpenRouterChatExport({ tweetId: '123', model: 'test/model', ...options })));
}

test('exports rating and conversation as ordered OpenRouter message and item graphs', () => {
    const rawRating = JSON.stringify({ Response: 'Insightful 🌟', Score: 8, Question1: 'Why?' });
    const history = [
        { role: 'system', content: [{ type: 'text', text: 'Custom rating preferences' }] },
        { role: 'user', content: [{ type: 'text', text: '{"tweet":"Example","ancestors":[]}' }] },
        { role: 'assistant', content: [{ type: 'text', text: rawRating }] },
        { role: 'user', content: 'Why?' },
        { role: 'assistant', content: 'Because.' }
    ];
    const original = JSON.stringify(history);
    const data = build({ history, reasoningByMessage: { 2: 'Initial trace', 4: 'Follow-up trace' } });
    assert.equal(data.version, 'orpg.3.0');
    assert.equal(data.characters['tweetfilter-assistant'].model, 'test/model');
    assert.equal(data.characters['tweetfilter-assistant'].includeDefaultSystemPrompt, false);
    const messages = Object.values(data.messages);
    assert.deepEqual(messages.map(message => message.type), ['user', 'assistant', 'user', 'assistant']);
    assert.equal(data.characters['tweetfilter-assistant'].description, 'Custom rating preferences');
    assert.equal(messages[0].characterId, 'USER');
    messages.forEach((message, index) => {
        assert.equal(message.parentMessageId, messages[index - 1]?.id);
        if (index) assert.ok(message.createdAt > messages[index - 1].createdAt);
        for (const ref of message.items) {
            const item = data.items[ref.id];
            assert.equal(item.messageId, message.id);
            assert.equal(item.data.type, ref.type);
            if (message.type === 'assistant') assert.equal(item.data.id, item.id);
        }
    });
    const ratingItems = messages[1].items.map(ref => data.items[ref.id].data);
    assert.equal(ratingItems[0].summary[0].text, 'Initial trace');
    assert.equal(ratingItems[1].content[0].text, 'Insightful 🌟\n\nRating: 8/10\n\nSuggested follow-up questions:\n- Why?');
    assert.equal(ratingItems[1].status, 'completed');
    assert.equal(JSON.stringify(history), original);
});

test('export removes the actual app JSON-response instructions while preserving custom preferences', () => {
    const prompt = configSource.match(/const FOLLOW_UP_SYSTEM_PROMPT = `([\s\S]*?)`;/)[1]
        .replace('{USER_INSTRUCTIONS_PLACEHOLDER}', 'Be concise. Explain JSON code when relevant.');
    const history = [{ role: 'system', content: [{ type: 'text', text: prompt }] }, { role: 'user', content: 'Tweet' }];
    const data = build({ history });
    const exported = data.characters['tweetfilter-assistant'].description;
    assert.match(exported, /Be concise\. Explain JSON code when relevant\./);
    assert.match(exported, /Do not rate the tweet unless the user asks you to/);
    assert.equal(exported, prompt.slice(0, prompt.lastIndexOf('Return only one valid JSON object.')).trim());
    assert.doesNotMatch(exported, /Return only one valid JSON object|"Response"|"Question1"|"Score"/);
    assert.equal(history[0].content[0].text, prompt);
});

test('export removes rating output schema without stripping input-context guidance', () => {
    const prompt = configSource.match(/const REVIEW_SYSTEM_PROMPT = `([\s\S]*?)`;/)[1];
    const data = build({ history: [{ role: 'system', content: prompt }, { role: 'user', content: 'Tweet' }] });
    const exported = data.characters['tweetfilter-assistant'].description;
    assert.match(exported, /The input is JSON/);
    assert.match(exported, /assign it an integer score from 0 through 10/);
    assert.doesNotMatch(exported, /response content should be a json object|"Response"|"Score"|"Question1"/);
});

test('native character prompt joins leading instructions without duplicating them as chat messages', () => {
    const data = build({ history: [
        { role: 'system', content: [{ type: 'text', text: 'First instruction.' }, { type: 'text', text: 'Second instruction.' }] },
        { role: 'system', content: 'Third instruction.' },
        { role: 'user', content: 'Tweet' },
        { role: 'assistant', content: 'Analysis' },
        { role: 'system', content: 'A later instruction.' },
        { role: 'user', content: 'Follow-up' }
    ] });
    assert.equal(data.characters['tweetfilter-assistant'].description, 'First instruction.\n\nSecond instruction.\n\nThird instruction.');
    assert.equal(data.characters['tweetfilter-assistant'].includeDefaultSystemPrompt, false);
    const messages = Object.values(data.messages);
    assert.deepEqual(messages.map(message => message.type), ['user', 'assistant', 'system', 'user']);
    assert.equal(messages[0].parentMessageId, undefined);
    assert.equal(messages[2].parentMessageId, messages[1].id);
    const laterSystemItem = data.items[messages[2].items[0].id];
    assert.equal(laterSystemItem.data.content[0].text, 'A later instruction.');
});

test('export renders fenced replies and zero ratings but preserves prose and unrelated JSON', () => {
    const context = setup();
    assert.equal(context.formatOpenRouterAssistantText('```json\n{"Response":"**Answer**\\nSecond line","Question1":"Next?"}\n```'),
        '**Answer**\nSecond line\n\nSuggested follow-up questions:\n- Next?');
    assert.equal(context.formatOpenRouterAssistantText('{"Response":"Low quality","Score":0}'), 'Low quality\n\nRating: 0/10');
    for (const text of ['Plain **Markdown** reply.', '{"example":true}', '{"Response":"unfinished']) {
        assert.equal(context.formatOpenRouterAssistantText(text), text);
    }
});

test('preserves remote images, embedded images, and PDF attachments', () => {
    const data = build({ history: [{ role: 'user', content: [
        { type: 'text', text: 'Read these' },
        { type: 'image_url', image_url: { url: 'https://pbs.twimg.com/media/test.jpg', detail: 'high' } },
        { type: 'image_url', image_url: { url: 'data:image/png;base64,aW1hZ2U=' } },
        { type: 'file', file: { filename: 'notes.pdf', file_data: 'data:application/pdf;base64,cGRm' } },
        { type: 'file', file: { filename: 'remote.pdf', file_data: 'https://example.com/remote.pdf' } }
    ] }] });
    const content = Object.values(data.items)[0].data.content;
    assert.deepEqual(content, [
        { type: 'input_text', text: 'Read these' },
        { type: 'input_image', image_url: 'https://pbs.twimg.com/media/test.jpg', detail: 'high' },
        { type: 'input_image', image_url: 'data:image/png;base64,aW1hZ2U=', detail: 'auto' },
        { type: 'input_file', filename: 'notes.pdf', file_data: 'cGRm' },
        { type: 'input_file', filename: 'remote.pdf', file_url: 'https://example.com/remote.pdf' }
    ]);
});

test('fails explicitly for empty history or unsupported attachments', () => {
    assert.throws(() => build({ history: [] }), /No completed rating/);
    assert.throws(() => build({ history: [{ role: 'user', content: [{ type: 'unknown' }] }] }), /Cannot export attachment type/);
});

function setupClick({ failDownload = false } = {}) {
    const calls = [];
    let blob;
    const link = {
        style: {},
        click() { calls.push('download'); if (failDownload) throw new Error('Download failed'); },
        remove() { calls.push('remove'); }
    };
    const context = setup({
        URL: { createObjectURL(value) { blob = value; return 'blob:export'; }, revokeObjectURL: url => calls.push(['revoke', url]) },
        document: { createElement: () => link, body: { appendChild() {} } },
        window: { open: (...args) => calls.push(['open', ...args]) },
        setTimeout: callback => { callback(); },
        showStatus: (...args) => calls.push(['status', ...args]),
        tweetCache: { get: () => ({ tweet: { text: 'Legacy tweet' } }) }
    });
    const instance = Object.assign(Object.create(context.Indicator.prototype), {
        tweetId: '123', status: 'rated', score: 8, description: 'Rating', reasoning: 'Trace',
        qaConversationHistory: [{ role: 'user', content: 'Tweet' }, { role: 'assistant', content: 'Rating' }],
        conversationHistory: [], metadata: { model: 'original/model', apiKey: 'never-export-this' },
        exportInstructionsElement: { hidden: true, textContent: '' }
    });
    return { instance, calls, link, getBlob: () => blob };
}

test('export click downloads JSON, opens OpenRouter, explains import, and cleans up', async () => {
    const { instance, calls, link, getBlob } = setupClick();
    instance._handleExportClick({ preventDefault() {}, stopPropagation() {} });
    const json = await getBlob().text();
    const data = JSON.parse(json);
    assert.equal(link.download, 'TweetFilter-AI-123-openrouter.json');
    assert.equal(data.characters['tweetfilter-assistant'].model, 'original/model');
    assert.ok(!json.includes('never-export-this'));
    assert.ok(calls.indexOf('download') < calls.findIndex(call => call[0] === 'open'));
    assert.deepEqual(calls.find(call => call[0] === 'open'), ['open', 'https://openrouter.ai/chat', '_blank', 'noopener,noreferrer']);
    assert.match(calls.find(call => call[0] === 'status')[1], /click the New chat button first, then Room settings → Import/);
    assert.equal(instance.exportInstructionsElement.hidden, false);
    assert.match(instance.exportInstructionsElement.textContent, /blank landing page has no target room/);
    assert.ok(calls.includes('remove'));
    assert.deepEqual(calls.at(-1), ['revoke', 'blob:export']);
});

test('legacy cached ratings export tweet context, score, and reasoning', async () => {
    const { instance, getBlob } = setupClick();
    instance.qaConversationHistory = [];
    instance._handleExportClick();
    const data = JSON.parse(await getBlob().text());
    const items = Object.values(data.items).map(item => item.data);
    assert.match(items[0].content[0].text, /Legacy tweet/);
    assert.match(items[0].content[0].text, /https:\/\/x.com\/i\/status\/123/);
    assert.equal(items[1].summary[0].text, 'Trace');
    assert.equal(items[2].content[0].text, 'Rating\n\nRating: 8/10');
});

test('active streams cannot be exported and download failures leave no tab or link behind', () => {
    const pending = setupClick();
    pending.instance.isFollowUpPending = true;
    pending.instance._handleExportClick();
    assert.equal(pending.getBlob(), undefined);
    pending.instance.isFollowUpPending = false;
    pending.instance.status = 'streaming';
    pending.instance._handleExportClick();
    assert.equal(pending.getBlob(), undefined);
    const failure = setupClick({ failDownload: true });
    failure.instance._handleExportClick();
    assert.ok(!failure.calls.some(call => call[0] === 'open'));
    assert.ok(failure.calls.includes('remove'));
    assert.equal(failure.calls.find(call => call[0] === 'status')[2], 'error');
    assert.deepEqual(failure.calls.at(-1), ['revoke', 'blob:export']);
});

test('export becomes available for ratings and unrated conversations and disables during follow-up', () => {
    const context = setup();
    const instance = Object.assign(Object.create(context.Indicator.prototype), {
        exportButton: { style: {} }, score: null, status: 'manual', qaConversationHistory: []
    });
    instance._updateRatingActionVisibility();
    assert.equal(instance.exportButton.style.display, 'none');
    instance.status = 'cached';
    instance.score = 8;
    instance._updateRatingActionVisibility();
    assert.equal(instance.exportButton.style.display, 'inline-flex');
    instance.status = 'manual';
    instance.score = null;
    instance.qaConversationHistory = [{ role: 'assistant', content: 'An unrated conversation' }];
    instance._updateRatingActionVisibility();
    assert.equal(instance.exportButton.style.display, 'inline-flex');
    assert.equal(instance.exportButton.disabled, false);
    instance.isFollowUpPending = true;
    instance._updateRatingActionVisibility();
    assert.equal(instance.exportButton.disabled, true);
});
