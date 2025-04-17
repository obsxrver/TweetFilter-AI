// Tooltip Management Module
const TooltipManager = {
    /**
     * Initializes the tooltip cleanup system.
     */
    initializeCleanup() {
        // Create a MutationObserver to watch for removed tweets
        const tweetObserver = new MutationObserver((mutations) => {
            let needsCleanup = false;
            
            mutations.forEach(mutation => {
                // Check for removed nodes that might be tweets or indicators
                mutation.removedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Check if the removed node is a tweet or contains indicators
                        if (node.matches('.score-indicator') || 
                            node.querySelector('.score-indicator')) {
                            needsCleanup = true;
                        }
                    }
                });
            });
            
            // Only run cleanup if we detected relevant DOM changes
            if (needsCleanup) {
                this.cleanupOrphanedTooltips();
            }
        });

        // Start observing the timeline with the configured parameters
        const observerConfig = {
            childList: true,
            subtree: true
        };

        // Find the main timeline container
        const timeline = document.querySelector('div[data-testid="primaryColumn"]');
        if (timeline) {
            tweetObserver.observe(timeline, observerConfig);
            console.log('Tweet removal observer initialized');
        }

        // Also keep the periodic cleanup as a backup, but with a longer interval
        setInterval(() => this.cleanupOrphanedTooltips(), 10000);
    },

    /**
     * Cleans up orphaned tooltips that no longer have a visible tweet or indicator.
     */
    cleanupOrphanedTooltips() {
        // Get all tooltips
        const tooltips = document.querySelectorAll('.score-description');
        
        tooltips.forEach(tooltip => {
            const tooltipTweetId = tooltip.dataset.tweetId;
            if (!tooltipTweetId) {
                // Remove tooltips without a tweet ID
                tooltip.remove();
                return;
            }

            // Find the corresponding indicator for this tooltip
            const indicator = document.querySelector(`.score-indicator[data-tweet-id="${tooltipTweetId}"]`) ||
                             document.querySelector(`article[data-testid="tweet"][data-tweet-id="${tooltipTweetId}"] .score-indicator`);
            
            // Only remove the tooltip if there's no indicator for it
            if (!indicator) {
                // Cancel any active streaming requests for this tweet
                if (window.activeStreamingRequests && window.activeStreamingRequests[tooltipTweetId]) {
                    console.log(`Canceling streaming request for tweet ${tooltipTweetId} as its indicator was removed`);
                    window.activeStreamingRequests[tooltipTweetId].abort();
                    delete window.activeStreamingRequests[tooltipTweetId];
                }
                
                // Remove the tooltip
                tooltip.remove();
                console.log(`Removed orphaned tooltip for tweet ${tooltipTweetId} (no indicator found)`);
            }
        });
    },

    /**
     * Cleans up all tooltip elements.
     */
    cleanupAll() {
        document.querySelectorAll('.score-description').forEach(tooltip => {
            tooltip.remove();
        });
    },

    /**
     * Positions the tooltip relative to the indicator
     * @param {HTMLElement} indicator - The indicator element
     * @param {HTMLElement} tooltip - The tooltip element
     */
    positionTooltip(indicator, tooltip) {
        if (!indicator || !tooltip) return;
        
        const rect = indicator.getBoundingClientRect();
        const margin = 10;
        const isMobile = UIUtils.isMobileDevice();
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        const safeArea = viewportHeight - margin; // Safe area to stay within
        
        // Reset any previous height constraints to measure true dimensions
        tooltip.style.maxHeight = '';
        tooltip.style.overflowY = '';
        
        // Force layout recalculation to get true dimensions
        tooltip.style.display = 'block';
        tooltip.style.visibility = 'hidden';
        
        const tooltipWidth = tooltip.offsetWidth;
        const tooltipHeight = tooltip.offsetHeight;
        
        let left, top;
        
        if (isMobile) {
            // Center tooltip horizontally on mobile
            left = Math.max(0, (viewportWidth - tooltipWidth) / 2);
            
            // Always apply a max-height on mobile to ensure scrollability
            const maxTooltipHeight = viewportHeight * 0.8; // 80% of viewport
            
            // If tooltip is taller than allowed, constrain it and enable scrolling
            if (tooltipHeight > maxTooltipHeight) {
                tooltip.style.maxHeight = `${maxTooltipHeight}px`;
                tooltip.style.overflowY = 'scroll';
            }
            
            // Position at the bottom part of the screen
            top = (viewportHeight - tooltip.offsetHeight) / 2;
            
            // Ensure it's always fully visible
            if (top < margin) {
                top = margin;
            }
            if (top + tooltip.offsetHeight > safeArea) {
                top = safeArea - tooltip.offsetHeight;
            }
        } else {
            // Desktop positioning - to the right of indicator
            left = rect.right + margin;
            top = rect.top + (rect.height / 2) - (tooltipHeight / 2);
            
            // Check horizontal overflow
            if (left + tooltipWidth > viewportWidth - margin) {
                // Try positioning to the left of indicator
                left = rect.left - tooltipWidth - margin;
                
                // If that doesn't work either, center horizontally
                if (left < margin) {
                    left = Math.max(margin, (viewportWidth - tooltipWidth) / 2);
                    // And position below or above the indicator
                    if (rect.bottom + tooltipHeight + margin <= safeArea) {
                        top = rect.bottom + margin;
                    } else if (rect.top - tooltipHeight - margin >= margin) {
                        top = rect.top - tooltipHeight - margin;
                    } else {
                        // If doesn't fit above or below, center vertically
                        top = margin;
                        // Apply max height and scrolling
                        tooltip.style.maxHeight = `${safeArea - (margin * 2)}px`;
                        tooltip.style.overflowY = 'scroll';
                    }
                }
            }
            
            // Final vertical adjustment and scrolling if needed
            if (top < margin) {
                top = margin;
            }
            if (top + tooltipHeight > safeArea) {
                // If tooltip is too tall for the viewport, enable scrolling
                if (tooltipHeight > safeArea - margin) {
                    top = margin;
                    tooltip.style.maxHeight = `${safeArea - (margin * 2)}px`;
                    tooltip.style.overflowY = 'scroll';
                } else {
                    // Otherwise just move it up
                    top = safeArea - tooltipHeight;
                }
            }
        }
        
        // Apply the position
        tooltip.style.position = 'fixed';
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
        tooltip.style.zIndex = '99999999';
        tooltip.style.visibility = 'visible';
        
        // Force scrollbars on WebKit browsers if needed
        if (tooltip.style.overflowY === 'scroll') {
            tooltip.style.WebkitOverflowScrolling = 'touch';
        }
        
        // Store the current scroll position to check if user has manually scrolled
        tooltip.lastScrollTop = tooltip.scrollTop;
        
        // Update scroll position for streaming tooltips
        if (tooltip.classList.contains('streaming-tooltip')) {
            // Only auto-scroll on initial display
            const isInitialDisplay = tooltip.lastDisplayTime === undefined || 
                                   (Date.now() - tooltip.lastDisplayTime) > 1000;
            
            if (isInitialDisplay) {
                tooltip.dataset.autoScroll = 'true';
                // Use double requestAnimationFrame to ensure content is rendered
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        tooltip.scrollTo({
                            top: tooltip.scrollHeight,
                            behavior: 'instant'
                        });
                    });
                });
            }
        }
        
        // Track when we displayed the tooltip
        tooltip.lastDisplayTime = Date.now();
    },

    /**
     * Formats description text for the tooltip.
     * @param {string} description - The description text to format
     * @param {string} reasoning - Optional reasoning text to format
     * @returns {Object} Formatted description and reasoning
     */
    formatTooltipDescription(description, reasoning = "") {
        description = description || "*waiting for content...*";
        
        // Add markdown-style formatting
        description = description.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>'); // Bold
        description = description.replace(/\*([^*]+)\*/g, '<em>$1</em>'); // Italic
        //h4
        description = description.replace(/^#### (.*)$/gm, '<h4>$1</h4>');
        //h3
        description = description.replace(/^### (.*)$/gm, '<h3>$1</h3>');
        //h2
        description = description.replace(/^## (.*)$/gm, '<h2>$1</h2>');
        //h1
        description = description.replace(/^# (.*)$/gm, '<h1>$1</h1>');
        
        // Basic formatting, can be expanded
        description = description.replace(/SCORE_(\d+)/g, '<span style="display:inline-block;background-color:#1d9bf0;color:white;padding:3px 10px;border-radius:9999px;margin:8px 0;font-weight:bold;">SCORE: $1</span>');
        description = description.replace(/\n\n/g, '<br><br>'); // Keep in single paragraph
        description = description.replace(/\n/g, '<br>');
        
        // Format reasoning trace with markdown support if provided
        let formattedReasoning = '';
        if (reasoning && reasoning.trim()) {
            formattedReasoning = reasoning
                .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>') // Bold
                .replace(/\*([^*]+)\*/g, '<em>$1</em>') // Italic
                .replace(/\n\n/g, '<br><br>') // Keep in single paragraph
                .replace(/\n/g, '<br>');
        }
        
        return {
            description: description,
            reasoning: formattedReasoning
        };
    },

    /**
     * Updates tooltip content during streaming
     * @param {HTMLElement} tooltip - The tooltip element to update
     * @param {string} description - Current description content
     * @param {string} reasoning - Current reasoning content
     */
    updateTooltipContent(tooltip, description, reasoning) {
        if (!tooltip) return;
        
        const formatted = this.formatTooltipDescription(description, reasoning);
        let contentChanged = false;
        
        // Update only the contents, not the structure
        const descriptionElement = tooltip.querySelector('.description-text');
        if (descriptionElement) {
            const oldContent = descriptionElement.innerHTML;
            descriptionElement.innerHTML = formatted.description;
            contentChanged = oldContent !== formatted.description;
        }
        
        const reasoningElement = tooltip.querySelector('.reasoning-text');
        if (reasoningElement && formatted.reasoning) {
            const oldReasoning = reasoningElement.innerHTML;
            reasoningElement.innerHTML = formatted.reasoning;
            contentChanged = contentChanged || oldReasoning !== formatted.reasoning;
            
            // Make reasoning dropdown visible only if there is content
            const dropdown = tooltip.querySelector('.reasoning-dropdown');
            if (dropdown) {
                dropdown.style.display = formatted.reasoning ? 'block' : 'none';
            }
        }
        
        // Handle auto-scrolling
        if (tooltip.style.display === 'block') {
            const isStreaming = tooltip.classList.contains('streaming-tooltip');
            const scrollButton = tooltip.querySelector('.scroll-to-bottom-button');
            
            // Calculate if we're near bottom before content update
            const wasNearBottom = tooltip.scrollHeight - tooltip.scrollTop - tooltip.clientHeight < (UIUtils.isMobileDevice() ? 40 : 55);
            
            // If content changed and we should auto-scroll
            if (contentChanged && (wasNearBottom || tooltip.dataset.autoScroll === 'true')) {
                // Use double requestAnimationFrame to ensure DOM has updated
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        // Recheck if we should still scroll (user might have scrolled during update)
                        if (tooltip.dataset.autoScroll === 'true') {
                            const targetScroll = tooltip.scrollHeight;
                            tooltip.scrollTo({
                                top: targetScroll,
                                behavior: 'instant' // Use instant to prevent interruption
                            });
                            
                            // Double-check scroll position after a small delay
                            setTimeout(() => {
                                if (tooltip.dataset.autoScroll === 'true') {
                                    tooltip.scrollTop = tooltip.scrollHeight;
                                }
                            }, 50);
                        }
                    });
                });
            }
            
            // Update scroll button visibility
            if (isStreaming && scrollButton) {
                const isNearBottom = tooltip.scrollHeight - tooltip.scrollTop - tooltip.clientHeight < (UIUtils.isMobileDevice() ? 40 : 55);
                scrollButton.style.display = isNearBottom ? 'none' : 'block';
            }
        }
    }
}; 