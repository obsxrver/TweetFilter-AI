/**
 * Singleton class to manage the history of custom instructions
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
     * @param {string} str - String to hash
     * @returns {string} - Hash of the string
     */
    #hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString(36); // Convert to base36 for shorter hash
    }

    /**
     * Loads the history from browser storage
     */
    loadFromStorage() {
        try {
            const stored = browserGet('instructionsHistory', '[]');
            this.history = JSON.parse(stored);
            // Ensure it's an array
            if (!Array.isArray(this.history)) {
                this.history = [];
            }
            // Add hashes to existing entries if they don't have them
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
     */
    saveToStorage() {
        try {
            browserSet('instructionsHistory', JSON.stringify(this.history));
        } catch (e) {
            console.error('Error saving instructions history:', e);
        }
    }

    /**
     * Adds new instructions to the history
     * @param {string} instructions - The instructions text
     * @param {string} summary - The 5-word summary of the instructions
     * @returns {Promise<boolean>} - Whether the operation was successful
     */
    async add(instructions, summary) {
        if (!instructions || !summary) return false;

        const hash = this.#hashString(instructions);
        
        // Check if these instructions already exist
        const existingIndex = this.history.findIndex(entry => entry.hash === hash);
        if (existingIndex !== -1) {
            // Update the existing entry's timestamp and summary
            this.history[existingIndex].timestamp = Date.now();
            this.history[existingIndex].summary = summary;
            
            // Move it to the top of the list
            const entry = this.history.splice(existingIndex, 1)[0];
            this.history.unshift(entry);
            
            this.saveToStorage();
            return true;
        }

        // Add new entry
        this.history.unshift({
            instructions,
            summary,
            timestamp: Date.now(),
            hash
        });

        // Keep only the most recent entries
        if (this.history.length > this.maxEntries) {
            this.history = this.history.slice(0, this.maxEntries);
        }

        this.saveToStorage();
        return true;
    }

    /**
     * Removes an entry from history
     * @param {number} index - The index of the entry to remove
     * @returns {boolean} - Whether the operation was successful
     */
    remove(index) {
        if (index < 0 || index >= this.history.length) return false;

        this.history.splice(index, 1);
        this.saveToStorage();
        return true;
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
        if (index < 0 || index >= this.history.length) return null;
        return { ...this.history[index] };
    }

    /**
     * Clears all history
     */
    clear() {
        this.history = [];
        this.saveToStorage();
    }

    /**
     * Gets the number of entries in history
     * @returns {number} The number of entries
     */
    get size() {
        return this.history.length;
    }
}

// Create and export the singleton instance
const instructionsHistory = new InstructionsHistory();
//export { instructionsHistory };
