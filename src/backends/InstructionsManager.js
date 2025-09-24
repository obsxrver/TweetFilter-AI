/**
 * Manages the business logic for instructions handling
 */
class InstructionsManager {
    constructor() {
        if (InstructionsManager.instance) {
            return InstructionsManager.instance;
        }
        InstructionsManager.instance = this;

        this.history = new InstructionsHistory();
        this.currentInstructions = browserGet('userDefinedInstructions', '');
    }

    /**
     * Saves new instructions and adds them to history
     * @param {string} instructions - The instructions to save
     * @returns {Promise<{success: boolean, message: string}>}
     */
    async saveInstructions(instructions) {
        if (!instructions?.trim()) {
            return { success: false, message: 'Instructions cannot be empty' };
        }

        instructions = instructions.trim();
        this.currentInstructions = instructions;
        browserSet('userDefinedInstructions', instructions);

        if (typeof USER_DEFINED_INSTRUCTIONS !== 'undefined') {
            USER_DEFINED_INSTRUCTIONS = instructions;
        }

        const summary = this.#generateSummary(instructions);
        await this.history.add(instructions, summary);

        return {
            success: true,
            message: 'Scoring instructions saved! New tweets will use these instructions.',
            shouldClearCache: true
        };
    }

    /**
     * Creates a summary title using the first three words and the last word
     * @private
     * @param {string} instructions - Full instruction text
     * @returns {string} Generated title
     */
    #generateSummary(instructions) {
        const words = instructions.trim().split(/\s+/);
        if (words.length <= 3) {
            return words.join(' ');
        }
        const firstThree = words.slice(0, 3).join(' ');
        const lastWord = words[words.length - 1];
        return `${firstThree} … ${lastWord}`;
    }

    /**
     * Gets the current instructions
     * @returns {string}
     */
    getCurrentInstructions() {
        return this.currentInstructions;
    }

    /**
     * Gets all instruction history entries
     * @returns {Array}
     */
    getHistory() {
        return this.history.getAll();
    }

    /**
     * Removes an instruction from history
     * @param {number} index
     * @returns {boolean}
     */
    removeFromHistory(index) {
        return this.history.remove(index);
    }

    /**
     * Clears all instruction history
     */
    clearHistory() {
        this.history.clear();
    }
}

const instructionsManager = new InstructionsManager();
