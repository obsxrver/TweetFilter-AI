console.log("!!! TweetFilter Content Script START !!! - browserStorage.js loaded");
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
    // Check if chrome.storage is available
    if (typeof chrome?.storage?.sync?.get !== 'function') {
        console.warn('[TweetFilter] browserGet: chrome.storage.sync.get is not available.');
        return defaultValue;
    }
    try {
        const result = await chrome.storage.sync.get([key]);
        // Check for runtime error after the promise resolves (common pattern for storage API)
        if (chrome.runtime.lastError) {
            // Specifically check for context invalidated error
            if (chrome.runtime.lastError.message?.includes('Extension context invalidated')) {
                 console.warn(`[TweetFilter] browserGet: Context invalidated while getting key "${key}". Returning default.`);
            } else {
                // Log other runtime errors
                console.error(`[TweetFilter] browserGet: Runtime error getting key "${key}":`, chrome.runtime.lastError.message);
            }
            return defaultValue; // Return default value on runtime error
        }
        // Return the value if found, otherwise the default
        return result[key] !== undefined ? result[key] : defaultValue;
    } catch (error) {
        // Catch errors during the await/promise itself
        // Specifically check for context invalidated error
        if (error.message?.includes('Extension context invalidated')) {
            console.warn(`[TweetFilter] browserGet: Context invalidated error while getting key "${key}". Returning default.`);
        } else {
             // Log other async errors
             console.error(`[TweetFilter] browserGet: Async error reading key "${key}" from browser storage:`, error);
        }
        return defaultValue; // Return default value on error
    }
}

/**
 * Sets a value in browser storage using Chrome's storage API
 * @param {string} key - The key to set in storage
 * @param {any} value - The value to store
 * @returns {Promise<void>}
 */
async function browserSet(key, value) {
    // Check if chrome.storage is available
    if (typeof chrome?.storage?.sync?.set !== 'function') {
        console.warn(`[TweetFilter] browserSet: chrome.storage.sync.set not available. Cannot set key "${key}".`);
        return;
    }
    try {
        const data = {};
        data[key] = value;
        await chrome.storage.sync.set(data);
        // Check for runtime error after the promise resolves
        if (chrome.runtime.lastError) {
            // Specifically check for context invalidated error
            if (chrome.runtime.lastError.message?.includes('Extension context invalidated')) {
                 console.warn(`[TweetFilter] browserSet: Context invalidated while setting key "${key}".`);
            } else {
                // Log other runtime errors
                console.error(`[TweetFilter] browserSet: Runtime error setting key "${key}":`, chrome.runtime.lastError.message);
            }
        }
    } catch (error) {
         // Catch errors during the await/promise itself
         // Specifically check for context invalidated error
         if (error.message?.includes('Extension context invalidated')) {
            console.warn(`[TweetFilter] browserSet: Context invalidated error while setting key "${key}".`);
        } else {
            // Log other async errors
            console.error(`[TweetFilter] browserSet: Async error writing key "${key}" to browser storage:`, error);
        }
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