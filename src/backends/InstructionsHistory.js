/**
 * Manages the history of custom instructions
 */
class InstructionsHistory {
    constructor() {
        if (InstructionsHistory.instance) {
            return InstructionsHistory.instance;
        }
        InstructionsHistory.instance = this;

        this.history = [];
        this.maxEntries = 10;
        this.loadFromStorage();
    }

    /**
     * Generates a simple hash of a string
     * @private
     * @param {string} str - String to hash
     * @returns {string} - Hash of the string
     */
    #hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(36);
    }

    /**
     * Loads the history from browser storage
     * @private
     */
    loadFromStorage() {
        try {
            const stored = browserGet('instructionsHistory', '[]');
            this.history = JSON.parse(stored);

            if (!Array.isArray(this.history)) {
                throw new Error('Stored history is not an array');
            }

            this.history = this.history.map(entry => ({
                ...entry,
                hash: entry.hash || this.#hashString(entry.instructions)
            }));
        } catch (e) {
            console.error('Error loading instructions history:', e);
            this.history = [];
        }
    }

    /**
     * Saves the current history to browser storage
     * @private
     */
    #saveToStorage() {
        try {
            browserSet('instructionsHistory', JSON.stringify(this.history));
        } catch (e) {
            console.error('Error saving instructions history:', e);
            throw new Error('Failed to save instructions history');
        }
    }

    /**
     * Adds new instructions to the history
     * @param {string} instructions - The instructions text
     * @param {string} summary - The summary of the instructions
     * @returns {Promise<boolean>} - Whether the operation was successful
     */
    async add(instructions, summary) {
        try {
            if (!instructions?.trim() || !summary?.trim()) {
                throw new Error('Invalid instructions or summary');
            }

            const hash = this.#hashString(instructions.trim());

            const existingIndex = this.history.findIndex(entry => entry.hash === hash);
            if (existingIndex !== -1) {

                this.history[existingIndex].timestamp = Date.now();
                this.history[existingIndex].summary = summary;

                const entry = this.history.splice(existingIndex, 1)[0];
                this.history.unshift(entry);
            } else {

                this.history.unshift({
                    instructions: instructions.trim(),
                    summary: summary.trim(),
                    timestamp: Date.now(),
                    hash
                });

                if (this.history.length > this.maxEntries) {
                    this.history = this.history.slice(0, this.maxEntries);
                }
            }

            this.#saveToStorage();
            return true;
        } catch (e) {
            console.error('Error adding instructions to history:', e);
            return false;
        }
    }

    /**
     * Removes an entry from history
     * @param {number} index - The index of the entry to remove
     * @returns {boolean} - Whether the operation was successful
     */
    remove(index) {
        try {
            if (index < 0 || index >= this.history.length) {
                throw new Error('Invalid history index');
            }

            this.history.splice(index, 1);
            this.#saveToStorage();
            return true;
        } catch (e) {
            console.error('Error removing instructions from history:', e);
            return false;
        }
    }

    /**
     * Gets all history entries, sorted by timestamp (newest first)
     * @returns {Array} The history entries
     */
    getAll() {
        return [...this.history];
    }

    /**
     * Gets a specific entry from history
     * @param {number} index - The index of the entry to get
     * @returns {Object|null} The history entry or null if not found
     */
    get(index) {
        try {
            if (index < 0 || index >= this.history.length) {
                return null;
            }
            return { ...this.history[index] };
        } catch (e) {
            console.error('Error getting history entry:', e);
            return null;
        }
    }

    /**
     * Clears all history
     */
    clear() {
        try {
            this.history = [];
            this.#saveToStorage();
        } catch (e) {
            console.error('Error clearing instructions history:', e);
            throw new Error('Failed to clear instructions history');
        }
    }

    /**
     * Gets the number of entries in history
     * @returns {number} The number of entries
     */
    get size() {
        return this.history.length;
    }
}

