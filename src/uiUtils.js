// UI Utility Functions
const UIUtils = {
    /**
     * Displays a temporary status message on the screen.
     * @param {string} message - The message to display.
     */
    showStatus(message) {
        const indicator = document.getElementById('status-indicator');
        if (!indicator) {
            console.error('#status-indicator element not found.');
            return;
        }
        indicator.textContent = message;
        indicator.classList.add('active');
        setTimeout(() => { indicator.classList.remove('active'); }, 3000);
    },

    /**
     * Toggles the visibility of an element and updates the corresponding toggle button text.
     * @param {HTMLElement} element - The element to toggle.
     * @param {HTMLElement} toggleButton - The button that controls the toggle.
     * @param {string} openText - Text for the button when the element is open.
     * @param {string} closedText - Text for the button when the element is closed.
     */
    toggleElementVisibility(element, toggleButton, openText, closedText) {
        if (!element || !toggleButton) return;

        const isHidden = element.classList.toggle('hidden');
        toggleButton.innerHTML = isHidden ? closedText : openText;

        // Special case for filter slider button (hide it when panel is shown)
        if (element.id === 'tweet-filter-container') {
            const filterToggle = document.getElementById('filter-toggle');
            if (filterToggle) {
                filterToggle.style.display = isHidden ? 'block' : 'none';
            }
        }
    },

    /**
     * Detects if the user is on a mobile device
     * @returns {boolean} true if mobile device detected
     */
    isMobileDevice() {
        return (window.innerWidth <= 600 || 
                /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
    }
}; 