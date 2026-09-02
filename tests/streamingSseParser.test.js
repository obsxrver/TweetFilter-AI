const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const apiRequestsSource = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'api', 'api_requests.js'),
    'utf8'
);

function createContext(gmXmlhttpRequest = () => ({ abort() {} })) {
    const context = vm.createContext({
        Blob,
        console,
        clearTimeout,
        FileReader: class {},
        GM_xmlhttpRequest: gmXmlhttpRequest,
        ArrayBuffer,
        setTimeout,
        TextDecoder,
        URL,
        window: { activeStreamingRequests: {} }
    });
    vm.runInContext(apiRequestsSource, context);
    return context;
}

function makeSseBody(contentChunks) {
    return contentChunks.map(content => {
        const event = {
            choices: [{ delta: { content } }]
        };
        return `data: ${JSON.stringify(event)}\r\n\r\n`;
    }).join('') + 'data: [DONE]\r\n\r\n';
}

test('SSE parser preserves events split at arbitrary mobile transport boundaries', () => {
    const context = createContext();
    const received = [];
    const parser = context.createSseEventParser(data => {
        received.push(data);
        return data === '[DONE]';
    });
    const body = makeSseBody(['{"Response":"Hello ', 'mobile"}']);

    let sawDone = false;
    for (let index = 0; index < body.length; index += 3) {
        sawDone = parser.push(body.slice(index, index + 3)) || sawDone;
    }
    sawDone = parser.flush() || sawDone;

    assert.equal(sawDone, true);
    assert.equal(received.length, 3);
    assert.equal(JSON.parse(received[0]).choices[0].delta.content, '{"Response":"Hello ');
    assert.equal(JSON.parse(received[1]).choices[0].delta.content, 'mobile"}');
    assert.equal(received[2], '[DONE]');
});

test('streaming completion decodes UTF-8 characters split across reader chunks', async () => {
    const expectedContent = '{"Response":"Works on 📱","Question1":"A","Question2":"B","Question3":"C"}';
    const bodyBytes = new TextEncoder().encode(makeSseBody([expectedContent]));
    let requestOptions;
    const context = createContext(options => {
        requestOptions = options;
        return { abort() {} };
    });

    const completion = new Promise((resolve, reject) => {
        context.getCompletionStreaming(
            { model: 'test', messages: [] },
            'key',
            () => {},
            resolve,
            error => reject(new Error(error.message))
        );
    });

    const chunks = [];
    for (let index = 0; index < bodyBytes.length; index += 5) {
        chunks.push(bodyBytes.slice(index, index + 5));
    }
    const reader = {
        async read() {
            return chunks.length
                ? { done: false, value: chunks.shift() }
                : { done: true, value: undefined };
        }
    };
    requestOptions.onloadstart({ response: { getReader: () => reader } });

    const result = await completion;
    assert.equal(result.content, expectedContent);
});

test('buffered mobile fallback completes when ReadableStream is unavailable', async () => {
    const expectedContent = '{"Response":"Buffered","Question1":"A","Question2":"B","Question3":"C"}';
    const responseText = makeSseBody([expectedContent]);
    let requestOptions;
    let completionCount = 0;
    const context = createContext(options => {
        requestOptions = options;
        return { abort() {} };
    });

    const completion = new Promise((resolve, reject) => {
        context.getCompletionStreaming(
            { model: 'test', messages: [] },
            'key',
            () => {},
            result => {
                completionCount += 1;
                resolve(result);
            },
            error => reject(new Error(error.message))
        );
    });

    requestOptions.onloadstart({ response: responseText });
    requestOptions.onprogress({ responseText: responseText.slice(0, 17) });
    requestOptions.onload({ responseText });

    const result = await completion;
    requestOptions.onload({ responseText });

    assert.equal(result.content, expectedContent);
    assert.equal(result.completedByLoadFallback, true);
    assert.equal(completionCount, 1);
});

test('buffered mobile fallback reads a Blob response body', async () => {
    const expectedContent = '{"Response":"Blob","Question1":"A","Question2":"B","Question3":"C"}';
    const responseBody = new Blob([makeSseBody([expectedContent])]);
    let requestOptions;
    const context = createContext(options => {
        requestOptions = options;
        return { abort() {} };
    });

    const completion = new Promise((resolve, reject) => {
        context.getCompletionStreaming(
            { model: 'test', messages: [] },
            'key',
            () => {},
            resolve,
            error => reject(new Error(error.message))
        );
    });

    requestOptions.onloadstart({ response: responseBody });
    await requestOptions.onload({ response: responseBody });

    const result = await completion;
    assert.equal(result.content, expectedContent);
    assert.equal(result.completedByLoadFallback, true);
});
