// Handle Management Module
const HandleManager = {
    /**
     * Adds a handle to the blacklist, saves, and refreshes the UI.
     * @param {string} handle - The Twitter handle to add (with or without @).
     */
    addHandleToBlacklist(handle) {
        handle = handle.trim().replace(/^@/, ''); // Clean handle
        if (handle === '' || blacklistedHandles.includes(handle)) {
            UIUtils.showStatus(handle === '' ? 'Handle cannot be empty.' : `@${handle} is already on the list.`);
            return;
        }
        blacklistedHandles.push(handle);
        browserSet('blacklistedHandles', blacklistedHandles.join('\n'));
        UIUtils.refreshHandleList(document.getElementById('handle-list'));
        UIUtils.showStatus(`Added @${handle} to auto-rate list.`);
    },

    /**
     * Removes a handle from the blacklist, saves, and refreshes the UI.
     * @param {string} handle - The Twitter handle to remove (without @).
     */
    removeHandleFromBlacklist(handle) {
        const index = blacklistedHandles.indexOf(handle);
        if (index > -1) {
            blacklistedHandles.splice(index, 1);
            browserSet('blacklistedHandles', blacklistedHandles.join('\n'));
            UIUtils.refreshHandleList(document.getElementById('handle-list'));
            UIUtils.showStatus(`Removed @${handle} from auto-rate list.`);
        } else {
            console.warn(`Attempted to remove non-existent handle: ${handle}`);
        }
    },

    /**
     * Adds a handle from the input field to the blacklist.
     */
    addHandleFromInput() {
        const handleInput = document.getElementById('handle-input');
        const handle = handleInput.value.trim();
        if (handle) {
            this.addHandleToBlacklist(handle);
            handleInput.value = ''; // Clear input after adding
        }
    }
}; 