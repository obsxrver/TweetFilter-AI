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
            const isNearBottom = tooltip.scrollHeight - tooltip.scrollTop - tooltip.clientHeight < (isMobileDevice() ? 40 : 55);
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
        if (isMobileDevice()) {
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
        updateTooltipContent(tooltip, description, reasoning);
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
        positionTooltip(indicator, tooltip);
        tooltip.style.display = 'block';
    }
}

/**
 * Positions the tooltip relative to the indicator
 * @param {HTMLElement} indicator - The indicator element
 * @param {HTMLElement} tooltip - The tooltip element
 */
function positionTooltip(indicator, tooltip) {
    if (!indicator || !tooltip) return;
    
    const rect = indicator.getBoundingClientRect();
    const margin = 10;
    const isMobile = isMobileDevice();
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
}


/** Formats description text for the tooltip. */
function formatTooltipDescription(description, reasoning = "") {
    description=description||"*waiting for content...*";
    
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
}

/**
 * Updates tooltip content during streaming
 * @param {HTMLElement} tooltip - The tooltip element to update
 * @param {string} description - Current description content
 * @param {string} reasoning - Current reasoning content
 */
function updateTooltipContent(tooltip, description, reasoning) {
    if (!tooltip) return;
    
    const formatted = formatTooltipDescription(description, reasoning);
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
        const wasNearBottom = tooltip.scrollHeight - tooltip.scrollTop - tooltip.clientHeight < (isMobileDevice() ? 40 : 55);
        
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
            const isNearBottom = tooltip.scrollHeight - tooltip.scrollTop - tooltip.clientHeight < (isMobileDevice() ? 40 : 55);
            scrollButton.style.display = isNearBottom ? 'none' : 'block';
        }
    }
}

/** Handles mouse enter event for score indicators. */
function handleIndicatorMouseEnter(event) {
    // Only use hover behavior on non-mobile
    if (isMobileDevice()) return;
    
    const indicator = event.currentTarget;
    const tooltip = indicator.scoreTooltip;
    if (!tooltip) return;
    
    // Get the tweet article
    const tweetArticle = indicator.closest('article[data-testid="tweet"]');
    const tweetId = tweetArticle ? getTweetID(tweetArticle) : null;
    
    // Position the tooltip
    positionTooltip(indicator, tooltip);
    tooltip.style.display = 'block';
    
    // Check if we have cached streaming content for this tweet
    if (tweetId && tweetCache.has(tweetId) && tweetCache.get(tweetId).description) {
        const reasoning = tweetCache.get(tweetId).reasoning || "";
        const formatted = formatTooltipDescription(tweetCache.get(tweetId).description, reasoning);
        
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
    if (isMobileDevice()) return;
    
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

/** Cleans up the global score tooltip element. */
function cleanupDescriptionElements() {
    // Remove all tooltips that might be in the DOM
    document.querySelectorAll('.score-description').forEach(tooltip => {
        tooltip.remove();
    });
}

/**
 * Cleans up orphaned tooltips that no longer have a visible tweet or indicator.
 */
function cleanupOrphanedTooltips() {
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
}
