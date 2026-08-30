/**
 * Parses the JSON response schema shared by tweet ratings and conversations.
 * Rating responses include Score; conversation responses omit it.
 *
 * @param {string} content - Raw model response text.
 * @returns {{response: string, score: number|null, hasScore: boolean, questions: string[], isValidJson: boolean}}
 */
function parseTweetFilterResponse(content) {
    const rawContent = typeof content === 'string' ? content.trim() : '';
    let parsed = null;

    if (rawContent) {
        let jsonContent = rawContent
            .replace(/^```(?:json)?\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();

        const firstBrace = jsonContent.indexOf('{');
        const lastBrace = jsonContent.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace >= firstBrace) {
            jsonContent = jsonContent.slice(firstBrace, lastBrace + 1);
        }

        try {
            parsed = JSON.parse(jsonContent);
        } catch (error) {
            parsed = null;
        }
    }

    const response = parsed && typeof parsed.Response === 'string'
        ? parsed.Response.trim()
        : '';
    const hasScore = parsed !== null &&
        typeof parsed === 'object' &&
        !Array.isArray(parsed) &&
        Object.prototype.hasOwnProperty.call(parsed, 'Score');
    const numericScore = parsed && parsed.Score !== undefined && parsed.Score !== null
        ? Number(parsed.Score)
        : NaN;
    const score = Number.isInteger(numericScore) ? numericScore : null;
    const questions = parsed
        ? [parsed.Question1, parsed.Question2, parsed.Question3]
            .map(question => typeof question === 'string' ? question.trim() : '')
            .filter(Boolean)
        : [];

    return {
        response,
        score,
        hasScore,
        questions,
        isValidJson: parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
    };
}

/**
 * Extracts and incrementally decodes the Response JSON string while a model is
 * still streaming an otherwise incomplete JSON object. Template fields stay
 * hidden and JSON escape sequences become display-ready characters.
 *
 * @param {string} content - Complete or partial model response text.
 * @returns {{text: string, started: boolean, complete: boolean}}
 */
function extractStreamingResponse(content) {
    const source = String(content || '');
    const propertyMatch = /["']Response["']\s*:\s*["']/i.exec(source);
    if (!propertyMatch) {
        return { text: '', started: false, complete: false };
    }

    const openingQuote = propertyMatch[0].slice(-1);
    let text = '';
    let index = propertyMatch.index + propertyMatch[0].length;

    while (index < source.length) {
        const character = source[index];
        if (character === openingQuote) {
            return { text, started: true, complete: true };
        }

        if (character !== '\\') {
            text += character;
            index += 1;
            continue;
        }

        if (index + 1 >= source.length) {
            break;
        }

        const escapedCharacter = source[index + 1];
        const simpleEscapes = {
            '"': '"',
            "'": "'",
            '\\': '\\',
            '/': '/',
            b: '\b',
            f: '\f',
            n: '\n',
            r: '\n',
            t: '\t'
        };

        if (Object.prototype.hasOwnProperty.call(simpleEscapes, escapedCharacter)) {
            text += simpleEscapes[escapedCharacter];
            index += 2;
            continue;
        }

        if (escapedCharacter === 'u') {
            const unicodeEscape = source.slice(index + 2, index + 6);
            if (unicodeEscape.length < 4) break;
            if (/^[0-9a-f]{4}$/i.test(unicodeEscape)) {
                text += String.fromCharCode(parseInt(unicodeEscape, 16));
                index += 6;
                continue;
            }
        }

        // Be forgiving while streaming malformed escape sequences. The final
        // response still goes through strict JSON schema validation.
        text += escapedCharacter;
        index += 2;
    }

    return { text, started: true, complete: false };
}

/**
 * Extracts a score from a complete or partially streamed JSON response.
 *
 * @param {string} content - Raw or partially streamed model response text.
 * @returns {number|null}
 */
function extractTweetFilterScore(content) {
    const parsedScore = parseTweetFilterResponse(content).score;
    if (parsedScore !== null) {
        return parsedScore;
    }

    const partialScoreMatch = String(content || '').match(/"Score"\s*:\s*"?(-?\d+)"?/i);
    return partialScoreMatch ? Number(partialScoreMatch[1]) : null;
}

/**
 * Extracts follow-up questions from the unified JSON response schema.
 *
 * @param {string} content - Raw model response text.
 * @returns {string[]}
 */
function extractFollowUpQuestions(content) {
    return parseTweetFilterResponse(content).questions;
}

/**
 * Checks whether a parsed tweet-analysis response satisfies the full schema.
 *
 * @param {ReturnType<parseTweetFilterResponse>} parsedResponse
 * @returns {boolean}
 */
function isCompleteTweetAnalysisResponse(parsedResponse) {
    return parsedResponse.isValidJson &&
        parsedResponse.response.length > 0 &&
        parsedResponse.hasScore &&
        parsedResponse.score !== null &&
        parsedResponse.score >= 0 &&
        parsedResponse.score <= 10 &&
        parsedResponse.questions.length === 3;
}

/**
 * Checks whether a parsed conversation response satisfies the shared schema.
 *
 * @param {ReturnType<parseTweetFilterResponse>} parsedResponse
 * @returns {boolean}
 */
function isCompleteConversationResponse(parsedResponse) {
    return parsedResponse.isValidJson &&
        parsedResponse.response.length > 0 &&
        !parsedResponse.hasScore &&
        parsedResponse.questions.length === 3;
}
