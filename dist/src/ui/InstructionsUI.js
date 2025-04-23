/**
 * UI component for managing instructions
 */

async function saveInstructions() {
    const instructionsTextarea = document.getElementById('user-instructions');
    const result = await window.instructionsManager.saveInstructions(instructionsTextarea.value);
    
    window.showStatus(result.message);
    if (result.success && result.shouldClearCache) {
        if (window.isMobileDevice() || confirm('Do you want to clear the rating cache to apply these instructions to all tweets?')) {
            window.clearTweetRatingsAndRefreshUI();
        }
    }

    // Refresh the history list if save was successful
    if (result.success) {
        refreshInstructionsHistory();
    }
}

/**
 * Refreshes the instructions history list in the UI.
 */
function refreshInstructionsHistory() {
    const listElement = document.getElementById('instructions-list');
    if (!listElement) return;

    const history = window.instructionsManager.getHistory();
    listElement.innerHTML = ''; // Clear existing list

    if (history.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.style.cssText = 'padding: 8px; opacity: 0.7; font-style: italic;';
        emptyMsg.textContent = 'No saved instructions yet';
        listElement.appendChild(emptyMsg);
        return;
    }

    history.forEach((entry, index) => {
        const item = createHistoryItem(entry, index);
        listElement.appendChild(item);
    });
}

/**
 * Creates a history item element
 * @param {Object} entry - The history entry
 * @param {number} index - The index in the history
 * @returns {HTMLElement}
 */
function createHistoryItem(entry, index) {
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
    useBtn.onclick = () => useInstructions(entry.instructions);
    buttons.appendChild(useBtn);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-instruction';
    removeBtn.textContent = '×';
    removeBtn.title = 'Remove from history';
    removeBtn.onclick = () => removeInstructions(index);
    buttons.appendChild(removeBtn);

    item.appendChild(buttons);
    return item;
}

/**
 * Uses the selected instructions from history.
 * @param {string} instructions - The instructions to use.
 */
function useInstructions(instructions) {
    const textarea = document.getElementById('user-instructions');
    if (textarea) {
        textarea.value = instructions;
        saveInstructions();
    }
}

/**
 * Removes instructions from history at the specified index.
 * @param {number} index - The index of the instructions to remove.
 */
function removeInstructions(index) {
    if (window.instructionsManager.removeFromHistory(index)) {
        refreshInstructionsHistory();
        window.showStatus('Instructions removed from history');
    } else {
        window.showStatus('Error removing instructions');
    }
}

/**
 * Clears all instructions history after confirmation
 */
function clearInstructionsHistory() {
    if (window.isMobileDevice() || confirm('Are you sure you want to clear all instruction history?')) {
        window.instructionsManager.clearHistory();
        refreshInstructionsHistory();
        window.showStatus('Instructions history cleared');
    }
}

// Expose functions to window object
window.saveInstructions = saveInstructions;
window.refreshInstructionsHistory = refreshInstructionsHistory;
window.useInstructions = useInstructions;
window.removeInstructions = removeInstructions;
window.clearInstructionsHistory = clearInstructionsHistory;
