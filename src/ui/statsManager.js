// Stats Management Module
const StatsManager = {
    /**
     * Creates or updates a floating badge showing the current cache statistics
     */
    initializeFloatingCacheStats() {
        let statsBadge = document.getElementById('tweet-filter-stats-badge');
        
        if (!statsBadge) {
            statsBadge = document.createElement('div');
            statsBadge.id = 'tweet-filter-stats-badge';
            statsBadge.className = 'tweet-filter-stats-badge';
            statsBadge.style.cssText = `
                position: fixed;
                bottom: 50px;
                right: 20px;
                background-color: rgba(29, 155, 240, 0.9);
                color: white;
                padding: 5px 10px;
                border-radius: 15px;
                font-size: 12px;
                z-index: 9999;
                box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                transition: opacity 0.3s;
                cursor: pointer;
                display: flex;
                align-items: center;
            `;
            
            // Add tooltip functionality
            statsBadge.title = 'Click to open settings';
            
            // Add click event to open settings
            statsBadge.addEventListener('click', () => {
                const settingsToggle = document.getElementById('settings-toggle');
                if (settingsToggle) {
                    settingsToggle.click();
                }
            });
            
            document.body.appendChild(statsBadge);
            
            // Auto-hide after 5 seconds of inactivity
            let fadeTimeout;
            const resetFadeTimeout = () => {
                clearTimeout(fadeTimeout);
                statsBadge.style.opacity = '1';
                fadeTimeout = setTimeout(() => {
                    statsBadge.style.opacity = '0.3';
                }, 5000);
            };
            
            statsBadge.addEventListener('mouseenter', () => {
                statsBadge.style.opacity = '1';
                clearTimeout(fadeTimeout);
            });
            
            statsBadge.addEventListener('mouseleave', resetFadeTimeout);
            
            resetFadeTimeout();
        }
        
        this.updateCacheStatsUI();
        // Make it visible and reset the timeout
        statsBadge.style.opacity = '1';
        clearTimeout(statsBadge.fadeTimeout);
        statsBadge.fadeTimeout = setTimeout(() => {
            statsBadge.style.opacity = '0.3';
        }, 5000);
    },

    /**
     * Updates the cache statistics display in the UI
     */
    updateCacheStatsUI() {
        const cachedCountEl = document.getElementById('cached-ratings-count');
        const whitelistedCountEl = document.getElementById('whitelisted-handles-count');
        const cachedCount = tweetCache.size;
        const wlCount = blacklistedHandles.length;
        
        if (cachedCountEl) cachedCountEl.textContent = cachedCount;
        if (whitelistedCountEl) whitelistedCountEl.textContent = wlCount;
        
        const statsBadge = document.getElementById("tweet-filter-stats-badge");
        if (statsBadge) statsBadge.innerHTML = `
            <span style="margin-right: 5px;">🧠</span>
            <span data-cached-count>${cachedCount} rated</span>
            ${wlCount > 0 ? `<span style="margin-left: 5px;"> | ${wlCount} whitelisted</span>` : ''}
        `;
    }
}; 