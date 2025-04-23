// Main content script for TweetFilter AI

// Wait for all required functions to be available
function waitForDependencies() {
    return new Promise((resolve) => {
        const check = () => {
            if (window.browserGet && 
                window.browserSet && 
                window.initializeStorage && 
                window.TweetCache && 
                window.InstructionsManager && 
                window.initializeUI) {
                resolve();
            } else {
                setTimeout(check, 100);
            }
        };
        check();
    });
}

// Initialize components
async function initialize() {
    try {
        // Wait for all dependencies to be loaded
        await waitForDependencies();
        
        // Initialize storage and cache
        await window.initializeStorage();
        const tweetCache = new window.TweetCache();
        
        // Initialize the instructions manager
        const instructionsManager = new window.InstructionsManager();
        await instructionsManager.initialize();
        
        // Initialize the rating engine
        const ratingEngine = new window.RatingEngine(tweetCache, instructionsManager);
        
        // Set up DOM scraper
        const scraper = window.setupDOMScraper(ratingEngine);
        
        // Initialize UI components
        window.initializeUI(ratingEngine, instructionsManager);
        
        // Start monitoring for tweets
        scraper.startMonitoring();
        
        console.log('TweetFilter AI initialized successfully');
    } catch (error) {
        console.error('Error initializing TweetFilter AI:', error);
    }
}

// Start the extension when the DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
} 