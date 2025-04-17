/**
 * Refreshes the instructions history list in the UI.
 */

function refreshInstructionsHistory() {
    const listElement = document.getElementById('instructions-list');
    if (!listElement) return;

    // Get history from singleton
    const history = instructionsHistory.getAll();
    listElement.innerHTML = ''; // Clear existing list

    if (history.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.style.cssText = 'padding: 8px; opacity: 0.7; font-style: italic;';
        emptyMsg.textContent = 'No saved instructions yet';
        listElement.appendChild(emptyMsg);
        return;
    }

    history.forEach((entry, index) => {
        const item = document.createElement('div');
        item.className = 'instruction-item';
        item.dataset.index = index;

        const text = document.createElement('div');
        text.className = 'instruction-text';
        text.textContent = entry.summary;
        text.title = entry.instructions; // Show full instructions on hover
        item.appendChild(text);

        const buttons = document.createElement('div');
        buttons.className = 'instruction-buttons';

        const useBtn = document.createElement('button');
        useBtn.className = 'use-instruction';
        useBtn.textContent = 'Use';
        useBtn.title = 'Use these instructions';
        useBtn.onclick = () => useInstructions(entry.instructions);
        buttons.appendChild(useBtn);

        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-instruction';
        removeBtn.textContent = '×';
        removeBtn.title = 'Remove from history';
        removeBtn.onclick = () => removeInstructions(index);
        buttons.appendChild(removeBtn);

        item.appendChild(buttons);
        listElement.appendChild(item);
    });
}

/**
 * Uses the selected instructions from history.
 * @param {string} instructions - The instructions to use.
 */
function useInstructions(instructions) {
    const textarea = document.getElementById('user-instructions');
    if (textarea) {
        textarea.value = instructions;
        EventHandlers.saveInstructions();
    }
}

/**
 * Removes instructions from history at the specified index.
 * @param {number} index - The index of the instructions to remove.
 */
function removeInstructions(index) {
    if (instructionsHistory.remove(index)) {
        refreshInstructionsHistory();
        UIUtils.showStatus('Instructions removed from history');
    } else {
        UIUtils.showStatus('Error removing instructions');
    }
}

// --- Rating Indicator Logic (Simplified, assuming CSS handles most styling) ---

/**
 * Updates or creates the rating indicator on a tweet article.
 * @param {Element} tweetArticle - The tweet article element.
 * @param {number|null} score - The numeric rating (null if pending/error).
 * @param {string} status - 'pending', 'rated', 'error', 'cached', 'blacklisted', 'streaming'.
 * @param {string} [description] - Optional description for hover tooltip.
 * @param {string} [reasoning] - Optional reasoning trace.
 */

function setScoreIndicator(tweetArticle, score, status, description = "", reasoning = "") {
    const tweetId = getTweetID(tweetArticle);
    let indicator = tweetArticle.querySelector('.score-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.className = 'score-indicator';
        tweetArticle.style.position = 'relative'; // Ensure parent is positioned
        tweetArticle.appendChild(indicator);
        
        // Create a unique tooltip for this indicator
        const tooltip = document.createElement('div');
        tooltip.className = 'score-description';
        tooltip.style.display = 'none';
        
        // Store the tweet ID in the tooltip's dataset for cleanup
        tooltip.dataset.tweetId = tweetId;
        
        // Create the fixed structure for the tooltip
        // Add tooltip controls row with pin and copy buttons
        const tooltipControls = document.createElement('div');
        tooltipControls.className = 'tooltip-controls';
        
        const pinButton = document.createElement('button');
        pinButton.className = 'tooltip-pin-button';
        pinButton.innerHTML = '📌';
        pinButton.title = 'Pin tooltip (prevents auto-closing)';
        pinButton.addEventListener('click', function(e) {
            e.stopPropagation();
            const isPinned = tooltip.classList.toggle('pinned');
            this.innerHTML = isPinned ? '📍' : '📌';
            this.title = isPinned ? 'Unpin tooltip' : 'Pin tooltip (prevents auto-closing)';
        });
        
        const copyButton = document.createElement('button');
        copyButton.className = 'tooltip-copy-button';
        copyButton.innerHTML = '📋';
        copyButton.title = 'Copy content to clipboard';
        copyButton.addEventListener('click', function(e) {
            e.stopPropagation();
            const description = tooltip.querySelector('.description-text');
            const reasoning = tooltip.querySelector('.reasoning-text');
            let textToCopy = description ? description.textContent : '';
            if (reasoning && reasoning.textContent) {
                textToCopy += '\n\nReasoning:\n' + reasoning.textContent;
            }
            navigator.clipboard.writeText(textToCopy).then(() => {
                const originalText = this.innerHTML;
                this.innerHTML = '✓';
                setTimeout(() => {
                    this.innerHTML = originalText;
                }, 1500);
            }).catch(err => {
                console.error('Failed to copy text: ', err);
            });
        });
        
        tooltipControls.appendChild(pinButton);
        tooltipControls.appendChild(copyButton);
        tooltip.appendChild(tooltipControls);
        
        // Create the reasoning dropdown structure upfront
        const reasoningDropdown = document.createElement('div');
        reasoningDropdown.className = 'reasoning-dropdown';
        
        // Create the toggle button without inline event
        const reasoningToggle = document.createElement('div');
        reasoningToggle.className = 'reasoning-toggle';
        
        const arrow = document.createElement('span');
        arrow.className = 'reasoning-arrow';
        arrow.textContent = '▶';
        
        reasoningToggle.appendChild(arrow);
        reasoningToggle.appendChild(document.createTextNode(' Show Reasoning Trace'));
        
        // Add event listener properly
        reasoningToggle.addEventListener('click', function(e) {
            e.stopPropagation(); // Prevent bubbling to tooltip click handler
            const dropdown = this.closest('.reasoning-dropdown');
            dropdown.classList.toggle('expanded');
            
            // Update arrow
            const arrowSpan = this.querySelector('.reasoning-arrow');
            arrowSpan.textContent = dropdown.classList.contains('expanded') ? '▼' : '▶';
            
            // Ensure content is visible when expanded
            const content = dropdown.querySelector('.reasoning-content');
            if (dropdown.classList.contains('expanded')) {
                content.style.maxHeight = '300px';
                content.style.padding = '10px';
            } else {
                content.style.maxHeight = '0';
                content.style.padding = '0';
            }
        });
        
        // Create reasoning content
        const reasoningContent = document.createElement('div');
        reasoningContent.className = 'reasoning-content';
        
        const reasoningText = document.createElement('p');
        reasoningText.className = 'reasoning-text';
        
        reasoningContent.appendChild(reasoningText);
        
        // Assemble the dropdown
        reasoningDropdown.appendChild(reasoningToggle);
        reasoningDropdown.appendChild(reasoningContent);
        
        tooltip.appendChild(reasoningDropdown);
        
        // Create a paragraph for the description
        const descriptionParagraph = document.createElement('p');
        descriptionParagraph.className = 'description-text';
        tooltip.appendChild(descriptionParagraph);
        
        // Add scroll-to-bottom button
        const scrollButton = document.createElement('div');
        scrollButton.className = 'scroll-to-bottom-button';
        scrollButton.innerHTML = '⬇ Scroll to bottom';
        scrollButton.style.display = 'none'; // Hidden by default
        scrollButton.addEventListener('click', (e) => {
            e.stopPropagation();
            tooltip.dataset.autoScroll = 'true';
            
            // Use double requestAnimationFrame to ensure we get the final scroll height
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    tooltip.scrollTo({
                        top: tooltip.scrollHeight,
                        behavior: 'instant'  // Use instant instead of smooth
                    });
                    
                    // Double-check scroll position after a small delay
                    setTimeout(() => {
                        if (tooltip.dataset.autoScroll === 'true') {
                            tooltip.scrollTop = tooltip.scrollHeight;
                        }
                    }, 50);
                });
            });
            
            scrollButton.style.display = 'none';
        });
        tooltip.appendChild(scrollButton);
        
        // Add some spacing at the bottom for better scrolling experience
        const bottomSpacer = document.createElement('div');
        bottomSpacer.className = 'tooltip-bottom-spacer';
        tooltip.appendChild(bottomSpacer);
        
        // Set initial auto-scroll state
        tooltip.dataset.autoScroll = status=='rated' || status=='cached'?'false':'true';
        
        // Add scroll event to detect when user manually scrolls
        tooltip.addEventListener('scroll', () => {
            // Check if we're near the bottom
            const isNearBottom = tooltip.scrollHeight - tooltip.scrollTop - tooltip.clientHeight < (UIUtils.isMobileDevice() ? 40 : 55);
            const isStreaming = tooltip.classList.contains('streaming-tooltip');
            const scrollButton = tooltip.querySelector('.scroll-to-bottom-button');
            
            if (!isNearBottom) {
                // User has scrolled up
                if (tooltip.dataset.autoScroll === 'true') {
                    tooltip.dataset.autoScroll = 'false';
                }
                
                // Show the scroll-to-bottom button if we're streaming
                if (isStreaming && scrollButton) {
                    scrollButton.style.display = 'block';
                }
            } else {
                // User has scrolled to bottom
                if (scrollButton) {
                    scrollButton.style.display = 'none';
                }
                // Only re-enable auto-scroll if user explicitly scrolled to bottom
                if (tooltip.dataset.userInitiatedScroll === 'true') {
                    tooltip.dataset.autoScroll = 'true';
                }
            }
            
            // Track that this was a user-initiated scroll
            tooltip.dataset.userInitiatedScroll = 'true';
            
            // Clear the flag after a short delay
            setTimeout(() => {
                tooltip.dataset.userInitiatedScroll = 'false';
            }, 100);
        });
        
        document.body.appendChild(tooltip); // Append to body instead of indicator
        
        // Store the tooltip reference
        indicator.scoreTooltip = tooltip;
        
        // Add mouse hover listeners
        indicator.addEventListener('mouseenter', handleIndicatorMouseEnter);
        indicator.addEventListener('mouseleave', handleIndicatorMouseLeave);
        
        // Add click/tap handler for toggling tooltip
        indicator.addEventListener('click', function(e) {
            e.stopPropagation(); // Prevent opening the tweet
            e.preventDefault();
            toggleTooltipVisibility(this);
        });
        
        // Also add hover listeners to the tooltip
        tooltip.addEventListener('mouseenter', () => {
            if (!tooltip.classList.contains('pinned')) {
                tooltip.style.display = 'block';
            }
        });
        tooltip.addEventListener('mouseleave', () => {
            if (!tooltip.classList.contains('pinned')) {
                tooltip.style.display = 'none';
            }
        });
        
        // Add click handler to close tooltip when clicking outside
        tooltip.addEventListener('click', (e) => {
            // Only if not clicking reasoning toggle, buttons, or scroll button
            if (!e.target.closest('.reasoning-toggle') && 
                !e.target.closest('.scroll-to-bottom-button') &&
                !e.target.closest('.tooltip-controls')) {
                if (!tooltip.classList.contains('pinned')) {
                    tooltip.style.display = 'none';
                }
            }
        });
        
        // Apply mobile positioning if needed
        if (UIUtils.isMobileDevice()) {
            indicator.classList.add('mobile-indicator');
        }
    }

    // Update status class and text content
    indicator.classList.remove('pending-rating', 'rated-rating', 'error-rating', 'cached-rating', 'blacklisted-rating', 'streaming-rating'); // Clear previous
    indicator.dataset.description = description || ''; // Store description
    indicator.dataset.reasoning = reasoning || ''; // Store reasoning
    indicator.dataset.tweetId = tweetId; // Store tweet ID in indicator
    
    // Update the tooltip content
    const tooltip = indicator.scoreTooltip;
    if (tooltip) {
        tooltip.dataset.tweetId = tweetId; // Ensure the tooltip also has the tweet ID
        TooltipManager.updateTooltipContent(tooltip, description, reasoning);
    }

    switch (status) {
        case 'pending':
            indicator.classList.add('pending-rating');
            indicator.textContent = '⏳';
            break;
        case 'streaming':
            indicator.classList.add('streaming-rating');
            indicator.textContent = '🔄';
            break;
        case 'error':
            indicator.classList.add('error-rating');
            indicator.textContent = '⚠️';
            break;
        case 'cached':
            indicator.classList.add('cached-rating');
            indicator.textContent = score;
            break;
        case 'blacklisted':
            indicator.classList.add('blacklisted-rating');
            indicator.textContent = score; // Typically 10 for blacklisted
            break;
        case 'rated': // Default/normal rated
        default:
            indicator.classList.add('rated-rating'); // Add a general rated class
            indicator.textContent = score;
            break;
    }
}

/**
 * Toggles the visibility of a tooltip associated with an indicator
 * @param {HTMLElement} indicator - The indicator element
 */
function toggleTooltipVisibility(indicator) {
    const tooltip = indicator.scoreTooltip;
    if (!tooltip) return;
    
    if (tooltip.style.display === 'block') {
        // Don't close if pinned
        if (!tooltip.classList.contains('pinned')) {
            tooltip.style.display = 'none';
        }
    } else {
        TooltipManager.positionTooltip(indicator, tooltip);
        tooltip.style.display = 'block';
    }
}

/** Handles mouse enter event for score indicators. */

function handleIndicatorMouseEnter(event) {
    // Only use hover behavior on non-mobile
    if (UIUtils.isMobileDevice()) return;
    
    const indicator = event.currentTarget;
    const tooltip = indicator.scoreTooltip;
    if (!tooltip) return;
    
    // Get the tweet article
    const tweetArticle = indicator.closest('article[data-testid="tweet"]');
    const tweetId = tweetArticle ? getTweetID(tweetArticle) : null;
    
    // Position the tooltip
    TooltipManager.positionTooltip(indicator, tooltip);
    tooltip.style.display = 'block';
    
    // Check if we have cached streaming content for this tweet
    if (tweetId && tweetCache.has(tweetId) && tweetCache.get(tweetId).description) {
        const reasoning = tweetCache.get(tweetId).reasoning || "";
        const formatted = TooltipManager.formatTooltipDescription(tweetCache.get(tweetId).description, reasoning);
        
        // Update content using the proper elements
        const descriptionElement = tooltip.querySelector('.description-text');
        if (descriptionElement) {
            descriptionElement.innerHTML = formatted.description;
        }
        
        const reasoningElement = tooltip.querySelector('.reasoning-text');
        if (reasoningElement) {
            reasoningElement.innerHTML = formatted.reasoning;
            
            // Show/hide reasoning dropdown based on content
            const dropdown = tooltip.querySelector('.reasoning-dropdown');
            if (dropdown) {
                dropdown.style.display = formatted.reasoning ? 'block' : 'none';
            }
        }
        
        // Add streaming class if status is streaming
        if (tweetArticle?.dataset.ratingStatus === 'streaming' || tweetCache.get(tweetId).streaming === true) {
            tooltip.classList.add('streaming-tooltip');
            
            // Reset auto-scroll state for streaming tooltips when they're first shown
            tooltip.dataset.autoScroll = 'true';
            
            // Scroll to bottom immediately for streaming tooltips
            requestAnimationFrame(() => {
                tooltip.scrollTop = tooltip.scrollHeight;
                // Second scroll after a short delay to catch any new content
                setTimeout(() => {
                    tooltip.scrollTop = tooltip.scrollHeight;
                }, 150);
            });
            
            // Hide scroll button initially
            const scrollButton = tooltip.querySelector('.scroll-to-bottom-button');
            if (scrollButton) {
                scrollButton.style.display = 'none';
            }
        } else {
            tooltip.classList.remove('streaming-tooltip');
        }
    }
}

/** Handles mouse leave event for score indicators. */
function handleIndicatorMouseLeave(event) {
    // Only use hover behavior on non-mobile
    if (UIUtils.isMobileDevice()) return;
    
    const indicator = event.currentTarget;
    const tooltip = indicator.scoreTooltip;
    if (!tooltip) return;
    
    // Only hide if we're not moving to the tooltip itself and not pinned
    setTimeout(() => {
        if (tooltip && !tooltip.matches(':hover') && !tooltip.classList.contains('pinned')) {
            tooltip.style.display = 'none';
        }
    }, 100);
}


// Core UI Module
const UI = {
    /**
     * Injects the UI elements from the HTML resource into the page.
     * @returns {HTMLElement|null} The UI container element or null if injection failed
     */
    injectUI() {
        // Create a container to inject HTML
        const containerId = 'tweetfilter-root-container';
        let uiContainer = document.getElementById(containerId);
        
        // If container doesn't exist, create and inject it
        if (!uiContainer) {
            uiContainer = document.createElement('div');
            uiContainer.id = containerId;
            uiContainer.innerHTML = MENU;

            // Inject styles
            const stylesheet = uiContainer.querySelector('style');
            if (stylesheet) {
                GM_addStyle(stylesheet.textContent);
                console.log('Injected styles from Menu.html');
                stylesheet.remove(); // Remove style tag after injecting
            } else {
                console.warn('No <style> tag found in Menu.html');
            }

            // Append the rest of the UI elements
            document.body.appendChild(uiContainer);
            console.log('TweetFilter UI Injected from HTML resource.');

            // Set version number
            const versionInfo = uiContainer.querySelector('#version-info');
            if (versionInfo) {
                versionInfo.textContent = `Twitter De-Sloppifier v${VERSION}`;
            }
        } else {
            console.log('UI container exists, reinitializing event listeners.');
        }

        return uiContainer;
    },

    /**
     * Main initialization function for the UI module.
     */
    initialize() {
        const uiContainer = this.injectUI();
        if (!uiContainer) return;

        // Remove any existing event listeners by cloning and replacing the container
        const newContainer = uiContainer.cloneNode(true);
        uiContainer.parentNode.replaceChild(newContainer, uiContainer);

        // Initialize everything with the new container
        EventHandlers.initializeEventListeners(newContainer);
        SettingsManager.refreshSettingsUI();
        fetchAvailableModels();
        
        // Initialize the floating cache stats badge
        StatsManager.initializeFloatingCacheStats();
        
        setInterval(StatsManager.updateCacheStatsUI, 3000);
        
        // Initialize the tooltip cleanup system
        TooltipManager.initializeCleanup();
        
        // Initialize tracking object for streaming requests if it doesn't exist
        if (!window.activeStreamingRequests) {
            window.activeStreamingRequests = {};
        }
    }
};

// Initialize UI when the script loads
UI.initialize();

