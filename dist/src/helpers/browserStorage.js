//src/helpers/browserStorage.js
/**
 * Browser storage wrapper functions for Chrome extension compatibility
 */

/**
 * Gets a value from browser storage using Chrome's storage API
 * @param {string} key - The key to get from storage
 * @param {any} defaultValue - The default value if key doesn't exist
 * @returns {Promise<any>} - The value from storage or default value
 */
async function browserGet(key, defaultValue = null) {
    try {
        const result = await chrome.storage.sync.get([key]);
        return result[key] !== undefined ? result[key] : defaultValue;
    } catch (error) {
        console.error('Error reading from browser storage:', error);
        return defaultValue;
    }
}

/**
 * Sets a value in browser storage using Chrome's storage API
 * @param {string} key - The key to set in storage
 * @param {any} value - The value to store
 * @returns {Promise<void>}
 */
async function browserSet(key, value) {
    try {
        const data = {};
        data[key] = value;
        await chrome.storage.sync.set(data);
    } catch (error) {
        console.error('Error writing to browser storage:', error);
    }
}

/**
 * Initialize storage with default values if needed
 */
async function initializeStorage() {
    const defaults = {
        isEnabled: true,
        lastUpdate: Date.now(),
        version: chrome.runtime.getManifest().version,
        settings: {
            filterEnabled: true,
            minimumScore: 5,
            autoExpand: true
        }
    };

    for (const [key, value] of Object.entries(defaults)) {
        const existing = await browserGet(key);
        if (existing === null) {
            await browserSet(key, value);
        }
    }
}

window.browserGet = browserGet;
window.browserSet = browserSet;
window.initializeStorage = initializeStorage; 