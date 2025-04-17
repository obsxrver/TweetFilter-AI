// Instructions Management Module
const InstructionsManager = {
    /**
     * Refreshes the instructions history list in the UI.
     */
    refreshInstructionsHistory() {
        const listElement = document.getElementById('instructions-list');
        if (!listElement) return;

        // Get history from singleton
        const history = instructionsHistory.getAll();
        listElement.innerHTML = ''; // Clear existing list

        if (history.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.style.cssText = 'padding: 8px; opacity: 0.7; font-style: italic;';
            emptyMsg.textContent = 'No saved instructions yet';
            listElement.appendChild(emptyMsg);
            return;
        }

        history.forEach((entry, index) => {
            const item = document.createElement('div');
            item.className = 'instruction-item';
            item.dataset.index = index;

            const text = document.createElement('div');
            text.className = 'instruction-text';
            text.textContent = entry.summary;
            text.title = entry.instructions; // Show full instructions on hover
            item.appendChild(text);

            const buttons = document.createElement('div');
            buttons.className = 'instruction-buttons';

            const useBtn = document.createElement('button');
            useBtn.className = 'use-instruction';
            useBtn.textContent = 'Use';
            useBtn.title = 'Use these instructions';
            useBtn.onclick = () => this.useInstructions(entry.instructions);
            buttons.appendChild(useBtn);

            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-instruction';
            removeBtn.textContent = '×';
            removeBtn.title = 'Remove from history';
            removeBtn.onclick = () => this.removeInstructions(index);
            buttons.appendChild(removeBtn);

            item.appendChild(buttons);
            listElement.appendChild(item);
        });
    },

    /**
     * Uses the selected instructions from history.
     * @param {string} instructions - The instructions to use.
     */
    useInstructions(instructions) {
        const textarea = document.getElementById('user-instructions');
        if (textarea) {
            textarea.value = instructions;
            EventHandlers.saveInstructions();
        }
    },

    /**
     * Removes instructions from history at the specified index.
     * @param {number} index - The index of the instructions to remove.
     */
    removeInstructions(index) {
        if (instructionsHistory.remove(index)) {
            this.refreshInstructionsHistory();
            UIUtils.showStatus('Instructions removed from history');
        } else {
            UIUtils.showStatus('Error removing instructions');
        }
    }
}; 