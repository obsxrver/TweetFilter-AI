/**
 * Browser storage wrapper functions for Chrome Extension Manifest V3 compatibility
 */

/**
 * Gets a value from browser storage
 * @param {string} key - The key to get from storage
 * @param {any} defaultValue - The default value if key doesn't exist
 * @returns {Promise<any>} - The value from storage or default value
 */
async function browserGet(key, defaultValue = null) {
    try {
        const value = GM_getValue(key, defaultValue);
        return value;
        //const result = await chrome.storage.local.get(key);
        //return result[key] !== undefined ? result[key] : defaultValue;
    } catch (error) {
        console.error('Error reading from browser storage:', error);
        return defaultValue;
    }
}

/**
 * Sets a value in browser storage
 * @param {string} key - The key to set in storage
 * @param {any} value - The value to store
 * @returns {Promise<void>}
 */
async function browserSet(key, value) {
    try {
        await chrome.storage.local.set({ [key]: value });
    } catch (error) {
        console.error('Error writing to browser storage:', error);
    }
}

// Export the functions
export { browserGet, browserSet }; 