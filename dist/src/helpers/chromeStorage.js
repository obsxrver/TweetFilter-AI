// Chrome storage helper functions to replace GM_* functions
export const browserStorage = {
    get: async function(key, defaultValue) {
        const result = await chrome.storage.sync.get([key]);
        return result[key] !== undefined ? result[key] : defaultValue;
    },
    
    set: async function(key, value) {
        const data = {};
        data[key] = value;
        await chrome.storage.sync.set(data);
    },
    
    // Helper to fetch Menu.html content
    getResourceText: async function(resourceName) {
        if (resourceName === 'MENU_HTML') {
            const response = await fetch(chrome.runtime.getURL('src/Menu.html'));
            return await response.text();
        }
        return null;
    },
    
    // Helper to add styles
    addStyle: function(css) {
        const style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);
    }
}; 