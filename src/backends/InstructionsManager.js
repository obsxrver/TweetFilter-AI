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

        // Update global variable
        if (typeof USER_DEFINED_INSTRUCTIONS !== 'undefined') {
            USER_DEFINED_INSTRUCTIONS = instructions;
        }

        // Get 5-word summary for the instructions
        const summary = await getCustomInstructionsDescription(instructions);
        if (!summary.error) {
            await this.history.add(instructions, summary.content);
        }

        return { 
            success: true, 
            message: 'Scoring instructions saved! New tweets will use these instructions.',
            shouldClearCache: true
        };
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

// Create and export the singleton instance
const instructionsManager = new InstructionsManager(); 