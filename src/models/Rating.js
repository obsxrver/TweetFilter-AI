/**
 * Represents a rating for a tweet
 */
class Rating {
    /**
     * Constructor for creating a Rating
     * @param {Object|number} scoreOrObject - Either a score number or an object with all properties
     * @param {string} review - The review/analysis text
     * @param {string} reasoning - The reasoning text
     * @param {Object} metadata - Additional metadata
     */
    constructor(scoreOrObject, review = '', reasoning = '', metadata = {}) {
        if (typeof scoreOrObject === 'object' && scoreOrObject !== null) {
            // Initialize from object (for hydration)
            this._initFromObject(scoreOrObject);
        } else {
            // Standard constructor
            this.score = scoreOrObject;
            this.review = review;
            this.reasoning = reasoning;
            this.metadata = new Map(Object.entries(metadata));
            
            // Additional properties
            this.questions = [];
            this.lastAnswer = '';
            this.qaConversationHistory = [];
            this.timestamp = Date.now();
            this.cached = false;
            this.streaming = false;
        }
    }

    /**
     * Initialize Rating from a plain object
     * @private
     */
    _initFromObject(obj) {
        this.score = obj.score;
        this.review = obj.review || '';
        this.reasoning = obj.reasoning || '';
        
        // Convert metadata back to Map
        if (obj.metadata instanceof Map) {
            this.metadata = obj.metadata;
        } else if (obj.metadata && typeof obj.metadata === 'object') {
            this.metadata = new Map(Object.entries(obj.metadata));
        } else {
            this.metadata = new Map();
        }
        
        // Additional properties
        this.questions = obj.questions || [];
        this.lastAnswer = obj.lastAnswer || '';
        this.qaConversationHistory = obj.qaConversationHistory || [];
        this.timestamp = obj.timestamp || Date.now();
        this.cached = obj.cached || false;
        this.streaming = obj.streaming || false;
    }

    /**
     * Parse rating from API response content
     * @param {string} apiResponseContent - Raw API response
     * @returns {Rating} New Rating instance
     */
    static fromAPIResponse(apiResponseContent) {
        const rating = new Rating(null);
        
        // Parse score
        const scoreMatch = apiResponseContent.match(/SCORE_(\d+)/);
        if (scoreMatch) {
            rating.score = parseInt(scoreMatch[1], 10);
        }
        
        // Parse analysis/review
        const analysisMatch = apiResponseContent.match(/<ANALYSIS>([\s\S]*?)<\/ANALYSIS>/);
        if (analysisMatch) {
            rating.review = analysisMatch[1].trim();
        } else {
            // Fallback: use entire content as review if no tags found
            rating.review = apiResponseContent;
        }
        
        // Parse follow-up questions
        const questionsMatch = apiResponseContent.match(/<FOLLOW_UP_QUESTIONS>([\s\S]*?)<\/FOLLOW_UP_QUESTIONS>/);
        if (questionsMatch) {
            rating.questions = extractFollowUpQuestions(apiResponseContent);
        }
        
        return rating;
    }

    /**
     * Update metadata
     * @param {string} key - Metadata key
     * @param {any} value - Metadata value
     */
    setMetadata(key, value) {
        this.metadata.set(key, value);
    }

    /**
     * Get metadata value
     * @param {string} key - Metadata key
     * @returns {any} Metadata value
     */
    getMetadata(key) {
        return this.metadata.get(key);
    }

    /**
     * Update all metadata from an object
     * @param {Object} metadataObj - Object with metadata properties
     */
    updateMetadata(metadataObj) {
        if (metadataObj && typeof metadataObj === 'object') {
            Object.entries(metadataObj).forEach(([key, value]) => {
                this.metadata.set(key, value);
            });
        }
    }

    /**
     * Add a Q&A turn to the conversation history
     * @param {string} question - The question asked
     * @param {string} answer - The answer received
     * @param {string[]} uploadedImages - Any images uploaded with the question
     * @param {string} reasoning - Any reasoning for this answer
     */
    addConversationTurn(question, answer, uploadedImages = [], reasoning = '') {
        // This is for UI display
        if (!this.conversationHistory) {
            this.conversationHistory = [];
        }
        this.conversationHistory.push({
            question,
            answer,
            uploadedImages,
            reasoning
        });
    }

    /**
     * Update the Q&A conversation history for API calls
     * @param {Array} history - The full conversation history array
     */
    updateQAHistory(history) {
        this.qaConversationHistory = history;
    }

    /**
     * Get formatted metadata for display
     * @returns {Object} Formatted metadata object
     */
    getFormattedMetadata() {
        const formatted = {};
        
        // Convert Map entries to object
        for (const [key, value] of this.metadata) {
            formatted[key] = value;
        }
        
        // Ensure standard fields exist
        return {
            model: formatted.model || 'N/A',
            promptTokens: formatted.promptTokens || 0,
            completionTokens: formatted.completionTokens || 0,
            reasoningTokens: formatted.reasoningTokens || 0,
            latency: formatted.latency || 'N/A',
            mediaInputs: formatted.mediaInputs || 0,
            price: formatted.price || 'N/A',
            providerName: formatted.providerName || 'N/A',
            generationId: formatted.generationId || null,
            ...formatted // Include any additional metadata
        };
    }

    /**
     * Check if rating is valid
     * @returns {boolean}
     */
    isValid() {
        return this.score !== null && this.score !== undefined && !isNaN(this.score);
    }

    /**
     * Convert rating to JSON for caching
     * @returns {Object} JSON representation
     */
    toJSON() {
        return {
            score: this.score,
            review: this.review,
            reasoning: this.reasoning,
            metadata: Object.fromEntries(this.metadata), // Convert Map to object
            questions: this.questions,
            lastAnswer: this.lastAnswer,
            qaConversationHistory: this.qaConversationHistory,
            timestamp: this.timestamp,
            cached: this.cached,
            streaming: this.streaming,
            conversationHistory: this.conversationHistory || []
        };
    }

    /**
     * Create a Rating instance from JSON
     * @param {Object} json - JSON object
     * @returns {Rating} New Rating instance
     */
    static fromJSON(json) {
        return new Rating(json);
    }

    /**
     * Get the full API response content (reconstructed)
     * This is useful for compatibility with existing code
     * @returns {string}
     */
    getFullContent() {
        let content = '';
        
        if (this.review) {
            content += `<ANALYSIS>\n${this.review}\n</ANALYSIS>\n\n`;
        }
        
        if (this.score !== null && this.score !== undefined) {
            content += `<SCORE>\nSCORE_${this.score}\n</SCORE>\n\n`;
        }
        
        if (this.questions && this.questions.length > 0) {
            content += `<FOLLOW_UP_QUESTIONS>\n`;
            this.questions.forEach((q, i) => {
                content += `Q_${i + 1}. ${q}\n`;
            });
            content += `</FOLLOW_UP_QUESTIONS>`;
        }
        
        return content;
    }
} 