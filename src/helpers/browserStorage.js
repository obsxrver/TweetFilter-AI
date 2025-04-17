/**
 * Browser storage wrapper functions for userscript compatibility
 */

/**
 * Gets a value from browser storage using Tampermonkey's GM_getValue
 * @param {string} key - The key to get from storage
 * @param {any} defaultValue - The default value if key doesn't exist
 * @returns {any} - The value from storage or default value
 */
function browserGet(key, defaultValue = null) {
    try {
        return GM_getValue(key, defaultValue);
    } catch (error) {
        console.error('Error reading from browser storage:', error);
        return defaultValue;
    }
}

/**
 * Sets a value in browser storage using Tampermonkey's GM_setValue
 * @param {string} key - The key to set in storage
 * @param {any} value - The value to store
 */
function browserSet(key, value) {
    try {
        GM_setValue(key, value);
    } catch (error) {
        console.error('Error writing to browser storage:', error);
    }
}

//export { browserGet, browserSet }; 