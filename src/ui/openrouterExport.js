/**
 * Builds a single-room export for OpenRouter Chat's Import action (orpg.3.0).
 * The format uses message envelopes and separately referenced Responses API items.
 * Matches the import schema served by https://openrouter.ai/chat on 2026-10-14.
 */
function buildOpenRouterChatExport({ tweetId, history, model, reasoningByMessage = {} }) {
    const messages = {};
    const items = {};
    const assistantId = 'tweetfilter-assistant';
    const createdAt = new Date().toISOString();
    let parentMessageId;

    (history || []).forEach((message, index) => {
        if (!['system', 'user', 'assistant'].includes(message?.role)) return;
        const id = `tweetfilter-message-${index}`;
        const role = message.role;
        const content = typeof message.content === 'string'
            ? [{ type: 'text', text: message.content }]
            : message.content || [];
        const text = content.filter(part => part.type === 'text').map(part => part.text).join('\n\n');
        const refs = [];
        const addItem = data => {
            const itemId = `${id}-item-${refs.length}`;
            items[itemId] = { id: itemId, messageId: id, data };
            refs.push({ id: itemId, type: data.type });
        };

        if (role === 'assistant') {
            const reasoning = reasoningByMessage[index];
            if (reasoning) {
                addItem({
                    id: `${id}-reasoning`, type: 'reasoning',
                    content: [{ type: 'reasoning_text', text: reasoning }],
                    summary: [{ type: 'summary_text', text: reasoning }]
                });
            }
            addItem({
                id: `${id}-output`, type: 'message', role, status: 'completed',
                content: [{ type: 'output_text', text, annotations: [] }]
            });
        } else {
            const inputContent = content.map(part => {
                if (part.type === 'text') return { type: 'input_text', text: part.text };
                if (part.type === 'image_url') {
                    return { type: 'input_image', image_url: part.image_url.url, detail: part.image_url.detail || 'auto' };
                }
                if (part.type === 'file') {
                    const file = part.file;
                    const isUrl = /^https?:/.test(file.file_data);
                    return {
                        type: 'input_file', filename: file.filename || 'document.pdf',
                        ...(isUrl ? { file_url: file.file_data } : { file_data: file.file_data.split(',').pop() })
                    };
                }
                throw new Error(`Cannot export attachment type: ${part.type}`);
            });
            addItem({ type: 'message', role, content: inputContent });
        }

        const turnTime = new Date(Date.parse(createdAt) + index).toISOString();
        messages[id] = {
            id, type: role, characterId: role === 'assistant' ? assistantId : role.toUpperCase(),
            context: 'main-chat', contentType: 'text',
            // OpenRouter sorts messages by createdAt. Keep turns ordered even within one millisecond.
            createdAt: turnTime, updatedAt: turnTime, parentMessageId, items: refs,
            ...(role === 'assistant' ? { isGenerating: false } : {})
        };
        parentMessageId = id;
    });

    if (Object.keys(messages).length === 0) throw new Error('No completed rating or conversation to export yet.');

    return {
        version: 'orpg.3.0', title: `TweetFilter AI — Tweet ${tweetId}`,
        characters: {
            [assistantId]: {
                id: assistantId, name: 'TweetFilter AI', model: model || 'openrouter/auto',
                includeDefaultSystemPrompt: false, samplingParameters: {}, createdAt, updatedAt: createdAt
            }
        },
        messages, items, artifacts: {}, artifactFiles: {}, artifactVersions: {}, artifactFileContents: {}
    };
}
