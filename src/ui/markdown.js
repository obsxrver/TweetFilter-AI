/**
 * Escapes text before it is inserted into tooltip HTML.
 * @param {unknown} value
 * @returns {string}
 */
function escapeTooltipHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Only allows links that are safe to open from an AI-generated response.
 * @param {string} value
 * @returns {string|null}
 */
function sanitizeMarkdownUrl(value) {
    const url = String(value || '').trim();
    if (/^(https?:|mailto:)/i.test(url) || url.startsWith('/') || url.startsWith('#')) {
        return url;
    }
    return null;
}

/**
 * Renders the inline subset of Markdown used by AI responses.
 * @param {string} source
 * @returns {string}
 */
function renderInlineMarkdown(source) {
    const protectedFragments = [];
    const protect = (html) => {
        const token = `\u0000TFMARKDOWN${protectedFragments.length}\u0000`;
        protectedFragments.push(html);
        return token;
    };

    let text = String(source || '');

    text = text.replace(/`([^`\n]+)`/g, (match, code) =>
        protect(`<code>${escapeTooltipHtml(code)}</code>`)
    );

    text = text.replace(/\[([^\]\n]+)\]\(([^)\s]+)(?:\s+["']([^"']*)["'])?\)/g, (match, label, url, title) => {
        const safeUrl = sanitizeMarkdownUrl(url);
        if (!safeUrl) {
            return `${label} (${url})`;
        }
        const titleAttribute = title ? ` title="${escapeTooltipHtml(title)}"` : '';
        return protect(
            `<a href="${escapeTooltipHtml(safeUrl)}" target="_blank" rel="noopener noreferrer" class="ai-generated-link"${titleAttribute}>${escapeTooltipHtml(label)}</a>`
        );
    });

    text = escapeTooltipHtml(text)
        .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
        .replace(/__([^_\n]+)__/g, '<strong>$1</strong>')
        .replace(/~~([^~\n]+)~~/g, '<del>$1</del>')
        .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
        .replace(/(^|[^_\w])_([^_\n]+)_(?!\w)/g, '$1<em>$2</em>');

    return text.replace(/\u0000TFMARKDOWN(\d+)\u0000/g, (match, index) =>
        protectedFragments[Number(index)] || ''
    );
}

function splitMarkdownTableRow(row) {
    return String(row || '')
        .trim()
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split(/(?<!\\)\|/)
        .map(cell => cell.trim().replace(/\\\|/g, '|'));
}

function isMarkdownTableDivider(line) {
    const cells = splitMarkdownTableRow(line);
    return cells.length > 0 && cells.every(cell => /^:?-{3,}:?$/.test(cell));
}

/**
 * Converts a safe, practical subset of Markdown into tooltip HTML. This covers
 * headings, paragraphs, links, emphasis, strike-through, code, quotes, lists,
 * task lists, horizontal rules, and tables without accepting arbitrary HTML.
 * @param {string} source
 * @returns {string}
 */
function renderTooltipMarkdown(source) {
    const lines = String(source || '').replace(/\r\n?/g, '\n').split('\n');
    const output = [];
    let index = 0;

    while (index < lines.length) {
        const line = lines[index];

        if (!line.trim()) {
            index += 1;
            continue;
        }

        const fenceMatch = line.match(/^\s*```\s*([\w+-]*)\s*$/);
        if (fenceMatch) {
            const codeLines = [];
            index += 1;
            while (index < lines.length && !/^\s*```\s*$/.test(lines[index])) {
                codeLines.push(lines[index]);
                index += 1;
            }
            if (index < lines.length) index += 1;
            const languageClass = fenceMatch[1]
                ? ` class="language-${escapeTooltipHtml(fenceMatch[1])}"`
                : '';
            output.push(`<pre><code${languageClass}>${escapeTooltipHtml(codeLines.join('\n'))}</code></pre>`);
            continue;
        }

        const headingMatch = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
        if (headingMatch) {
            const level = headingMatch[1].length;
            output.push(`<h${level}>${renderInlineMarkdown(headingMatch[2])}</h${level}>`);
            index += 1;
            continue;
        }

        if (/^\s{0,3}((\*|-|_)\s*){3,}$/.test(line)) {
            output.push('<hr>');
            index += 1;
            continue;
        }

        if (index + 1 < lines.length && line.includes('|') && isMarkdownTableDivider(lines[index + 1])) {
            const headers = splitMarkdownTableRow(line);
            index += 2;
            const rows = [];
            while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {
                rows.push(splitMarkdownTableRow(lines[index]));
                index += 1;
            }
            const headerHtml = headers.map(cell => `<th>${renderInlineMarkdown(cell)}</th>`).join('');
            const bodyHtml = rows.map(row => {
                const cells = headers.map((unused, cellIndex) =>
                    `<td>${renderInlineMarkdown(row[cellIndex] || '')}</td>`
                ).join('');
                return `<tr>${cells}</tr>`;
            }).join('');
            output.push(`<div class="markdown-table-wrapper"><table class="markdown-table"><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></div>`);
            continue;
        }

        if (/^\s{0,3}>/.test(line)) {
            const quoteLines = [];
            while (index < lines.length && /^\s{0,3}>/.test(lines[index])) {
                quoteLines.push(lines[index].replace(/^\s{0,3}>\s?/, ''));
                index += 1;
            }
            output.push(`<blockquote>${quoteLines.map(renderInlineMarkdown).join('<br>')}</blockquote>`);
            continue;
        }

        const listMatch = line.match(/^\s{0,3}([-+*]|\d+[.)])\s+(.+)$/);
        if (listMatch) {
            const ordered = /^\d/.test(listMatch[1]);
            const tag = ordered ? 'ol' : 'ul';
            const items = [];
            while (index < lines.length) {
                const itemMatch = lines[index].match(/^\s{0,3}([-+*]|\d+[.)])\s+(.+)$/);
                if (!itemMatch || /^\d/.test(itemMatch[1]) !== ordered) break;
                let itemText = itemMatch[2];
                const taskMatch = itemText.match(/^\[([ xX])\]\s+(.+)$/);
                if (taskMatch) {
                    const checked = taskMatch[1].toLowerCase() === 'x';
                    itemText = `<input type="checkbox" disabled${checked ? ' checked' : ''}> ${renderInlineMarkdown(taskMatch[2])}`;
                    items.push(`<li class="markdown-task-item">${itemText}</li>`);
                } else {
                    items.push(`<li>${renderInlineMarkdown(itemText)}</li>`);
                }
                index += 1;
            }
            output.push(`<${tag}>${items.join('')}</${tag}>`);
            continue;
        }

        const paragraphLines = [line.trim()];
        index += 1;
        while (index < lines.length && lines[index].trim()) {
            const nextLine = lines[index];
            const startsBlock = /^\s*```/.test(nextLine) ||
                /^\s{0,3}(#{1,6})\s+/.test(nextLine) ||
                /^\s{0,3}>/.test(nextLine) ||
                /^\s{0,3}([-+*]|\d+[.)])\s+/.test(nextLine) ||
                /^\s{0,3}((\*|-|_)\s*){3,}$/.test(nextLine) ||
                (index + 1 < lines.length && nextLine.includes('|') && isMarkdownTableDivider(lines[index + 1]));
            if (startsBlock) break;
            paragraphLines.push(nextLine.trim());
            index += 1;
        }
        output.push(`<p>${paragraphLines.map(renderInlineMarkdown).join('<br>')}</p>`);
    }

    return output.join('');
}
