//src/ui/ScoreIndicator.js
/**
 * Manages the state and UI for a single score indicator and its associated tooltip.
 */
class ScoreIndicator {
    /**
     * @param {Element} tweetArticle - The tweet article element this indicator belongs to.
     */
    constructor(tweetArticle) {
        if (!tweetArticle || !tweetArticle.nodeType || tweetArticle.nodeType !== Node.ELEMENT_NODE) {
            throw new Error("ScoreIndicator requires a valid tweet article DOM element.");
        }
        this.tweetArticle = tweetArticle;
        this.tweetId = window.getTweetID(this.tweetArticle);

        this.indicatorElement = null;
        this.tooltipElement = null;

        // Tooltip sub-elements (cache references during creation)
        this.tooltipControls = null;
        this.pinButton = null;
        this.copyButton = null;
        this.reasoningDropdown = null;
        this.reasoningToggle = null;
        this.reasoningArrow = null;
        this.reasoningContent = null;
        this.reasoningTextElement = null;
        this.descriptionElement = null;
        this.scrollButton = null;

        this.status = 'pending';
        this.score = null;
        this.description = '';
        this.reasoning = '';
        this.isPinned = false;
        this.isVisible = false;
        this.autoScroll = true;
        this.userInitiatedScroll = false;

        try {
            this._createElements(tweetArticle);
            this._addEventListeners();
            ScoreIndicatorRegistry.add(this.tweetId, this);
            this.updateDatasetAttributes(tweetArticle);
        } catch (error) {
            console.error(`[ScoreIndicator ${this.tweetId}] Failed initialization:`, error);
            this.destroy();
            throw error;
        }
    }

    // --- Private Methods ---

    /** 
     * Creates the indicator and tooltip DOM elements.
     * @param {Element} initialTweetArticle - The article element to attach to initially.
     */
    _createElements(initialTweetArticle) {
        // --- Indicator ---
        this.indicatorElement = document.createElement('div');
        this.indicatorElement.className = 'score-indicator';
        this.indicatorElement.dataset.tweetId = this.tweetId; // Link indicator to tweetId
        // Ensure parent is positioned only if not already relative or absolute
        const currentPosition = window.getComputedStyle(initialTweetArticle).position;
        if (currentPosition !== 'relative' && currentPosition !== 'absolute' && currentPosition !== 'fixed' && currentPosition !== 'sticky') {
            initialTweetArticle.style.position = 'relative';
        }
        initialTweetArticle.appendChild(this.indicatorElement);

        // --- Tooltip ---
        this.tooltipElement = document.createElement('div');
        this.tooltipElement.className = 'score-description';
        this.tooltipElement.style.display = 'none';
        this.tooltipElement.dataset.tweetId = this.tweetId; // Link tooltip to tweetId
        this.tooltipElement.dataset.autoScroll = this.autoScroll ? 'true' : 'false';

        // --- Tooltip Controls ---
        this.tooltipControls = document.createElement('div');
        this.tooltipControls.className = 'tooltip-controls';

        this.pinButton = document.createElement('button');
        this.pinButton.className = 'tooltip-pin-button';
        this.pinButton.innerHTML = '📌';
        this.pinButton.title = 'Pin tooltip (prevents auto-closing)';

        this.copyButton = document.createElement('button');
        this.copyButton.className = 'tooltip-copy-button';
        this.copyButton.innerHTML = '📋';
        this.copyButton.title = 'Copy content to clipboard';

        this.tooltipControls.appendChild(this.pinButton);
        this.tooltipControls.appendChild(this.copyButton);
        this.tooltipElement.appendChild(this.tooltipControls);

        // --- Reasoning Dropdown ---
        this.reasoningDropdown = document.createElement('div');
        this.reasoningDropdown.className = 'reasoning-dropdown';
        this.reasoningDropdown.style.display = 'none'; // Hide initially

        this.reasoningToggle = document.createElement('div');
        this.reasoningToggle.className = 'reasoning-toggle';

        this.reasoningArrow = document.createElement('span');
        this.reasoningArrow.className = 'reasoning-arrow';
        this.reasoningArrow.textContent = '▶';

        this.reasoningToggle.appendChild(this.reasoningArrow);
        this.reasoningToggle.appendChild(document.createTextNode(' Show Reasoning Trace'));

        this.reasoningContent = document.createElement('div');
        this.reasoningContent.className = 'reasoning-content';
        this.reasoningTextElement = document.createElement('p');
        this.reasoningTextElement.className = 'reasoning-text';
        this.reasoningContent.appendChild(this.reasoningTextElement);

        this.reasoningDropdown.appendChild(this.reasoningToggle);
        this.reasoningDropdown.appendChild(this.reasoningContent);
        this.tooltipElement.appendChild(this.reasoningDropdown);

        // --- Description Area ---
        this.descriptionElement = document.createElement('p');
        this.descriptionElement.className = 'description-text';
        this.tooltipElement.appendChild(this.descriptionElement);

        // --- Scroll-to-Bottom Button ---
        this.scrollButton = document.createElement('div');
        this.scrollButton.className = 'scroll-to-bottom-button';
        this.scrollButton.innerHTML = '⬇ Scroll to bottom';
        this.scrollButton.style.display = 'none'; // Hidden by default
        this.tooltipElement.appendChild(this.scrollButton);

        // --- Bottom Spacer ---
        const bottomSpacer = document.createElement('div');
        bottomSpacer.className = 'tooltip-bottom-spacer';
        this.tooltipElement.appendChild(bottomSpacer);

        // Append tooltip to body
        document.body.appendChild(this.tooltipElement);

        // Apply mobile styling if needed (assuming isMobileDevice is global)
        if (isMobileDevice()) {
            this.indicatorElement?.classList.add('mobile-indicator');
            this.tooltipElement?.classList.add('mobile-tooltip'); // Add class for mobile tooltip styling
        }

        this._updateIndicatorUI(); // Set initial UI state
        this._updateTooltipUI(); // Set initial tooltip content (e.g., placeholders)
    }


    /** Adds necessary event listeners to the indicator and tooltip. */
    _addEventListeners() {
        if (!this.indicatorElement || !this.tooltipElement) return;

        // Indicator Events
        this.indicatorElement.addEventListener('mouseenter', this._handleMouseEnter.bind(this));
        this.indicatorElement.addEventListener('mouseleave', this._handleMouseLeave.bind(this));
        this.indicatorElement.addEventListener('click', this._handleIndicatorClick.bind(this));

        // Tooltip Events
        this.tooltipElement.addEventListener('mouseenter', this._handleTooltipMouseEnter.bind(this));
        this.tooltipElement.addEventListener('mouseleave', this._handleTooltipMouseLeave.bind(this));
        this.tooltipElement.addEventListener('click', this._handleTooltipClick.bind(this)); // Handles background clicks
        this.tooltipElement.addEventListener('scroll', this._handleTooltipScroll.bind(this));

        // Tooltip Controls Events
        this.pinButton?.addEventListener('click', this._handlePinClick.bind(this));
        this.copyButton?.addEventListener('click', this._handleCopyClick.bind(this));
        this.reasoningToggle?.addEventListener('click', this._handleReasoningToggleClick.bind(this));
        this.scrollButton?.addEventListener('click', this._handleScrollButtonClick.bind(this));
    }

    /** 
     * Updates the tweet article's dataset attributes based on the instance's state.
     * Requires the current tweet article element to be passed or found.
     * @param {Element} [currentTweetArticle] - Optional: The current article element.
     */
    updateDatasetAttributes(currentTweetArticle) {
        const article = currentTweetArticle || this.findCurrentArticleElement();
        if (!article) {
            // console.warn(`[ScoreIndicator ${this.tweetId}] Could not find article element to update dataset.`);
            return;
        }
        article.dataset.ratingStatus = this.status;
        article.dataset.sloppinessScore = this.score !== null ? String(this.score) : '';
        article.dataset.ratingDescription = this.description;
        article.dataset.ratingReasoning = this.reasoning;
        article.dataset.blacklisted = String(this.status === 'blacklisted');
        article.dataset.cachedRating = String(this.status === 'cached');
        // Store indicator/tooltip existence for checks elsewhere if needed
        // article.dataset.hasScoreIndicator = 'true'; // Less reliable now
    }

    /** Updates the visual appearance of the indicator (icon/text, class). */
    _updateIndicatorUI() {
        if (!this.indicatorElement) return;

        // Clear previous status classes
        const classList = this.indicatorElement.classList;
        classList.remove(
            'pending-rating', 'rated-rating', 'error-rating',
            'cached-rating', 'blacklisted-rating', 'streaming-rating'
        );

        let indicatorText = '';
        let indicatorClass = '';

        switch (this.status) {
            case 'pending':
                indicatorClass = 'pending-rating';
                indicatorText = '⏳';
                break;
            case 'streaming':
                indicatorClass = 'streaming-rating';
                indicatorText = (this.score !== null && this.score !== undefined) ? String(this.score) : '🔄';
                break;
            case 'error':
                indicatorClass = 'error-rating';
                indicatorText = '⚠️';
                break;
            case 'cached':
                indicatorClass = 'cached-rating';
                indicatorText = String(this.score);
                break;
            case 'blacklisted':
                indicatorClass = 'blacklisted-rating';
                indicatorText = String(this.score); // Usually 10
                break;
            case 'rated':
            default:
                indicatorClass = 'rated-rating';
                indicatorText = String(this.score);
                break;
        }

        if (indicatorClass) {
            classList.add(indicatorClass);
        }
        this.indicatorElement.textContent = indicatorText;
    }

    /** Updates the content and potentially scroll position of the tooltip. */
    _updateTooltipUI() {
        if (!this.tooltipElement || !this.descriptionElement || !this.reasoningTextElement || !this.reasoningDropdown) return;

        // Store current scroll position and whether we were at bottom before update
        const wasNearBottom = this.tooltipElement.scrollHeight - this.tooltipElement.scrollTop - this.tooltipElement.clientHeight < (isMobileDevice() ? 40 : 55);
        const previousScrollTop = this.tooltipElement.scrollTop;
        const previousScrollHeight = this.tooltipElement.scrollHeight;

        // Assume formatTooltipDescription is globally available
        const formatted = formatTooltipDescription(this.description, this.reasoning);

        const contentChanged = this.descriptionElement.innerHTML !== formatted.description ||
            this.reasoningTextElement.innerHTML !== formatted.reasoning;

        // Update description and reasoning text
        this.descriptionElement.innerHTML = formatted.description;
        this.reasoningTextElement.innerHTML = formatted.reasoning;

        // Show/hide reasoning dropdown
        this.reasoningDropdown.style.display = (formatted.reasoning) ? 'block' : 'none';

        // Add/remove streaming class
        this.tooltipElement.classList.toggle('streaming-tooltip', this.status === 'streaming');

        // Handle scrolling after content update
        if (contentChanged) {
            requestAnimationFrame(() => {
                // If auto-scroll is enabled and we were at bottom, or if this is first content
                if (this.autoScroll && (wasNearBottom || !previousScrollHeight)) {
                    this._performAutoScroll();
                } else if (!this.autoScroll && previousScrollHeight > 0) {
                    // Maintain relative scroll position for user-scrolled content
                    const newScrollHeight = this.tooltipElement.scrollHeight;
                    const scrollDiff = newScrollHeight - previousScrollHeight;
                    this.tooltipElement.scrollTop = previousScrollTop + scrollDiff;
                }
                this._updateScrollButtonVisibility();
            });
        } else {
            this._updateScrollButtonVisibility();
        }
    }

    _performAutoScroll() {
        if (!this.tooltipElement || !this.autoScroll) return;
        // Use double RAF to ensure DOM has updated dimensions
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                // Check again in case state changed during RAF
                if (this.tooltipElement && this.autoScroll && this.isVisible) {
                    const targetScroll = this.tooltipElement.scrollHeight;
                    this.tooltipElement.scrollTo({
                        top: targetScroll,
                        behavior: 'instant'
                    });
                    // Double-check after a short delay
                    setTimeout(() => {
                        if (this.tooltipElement && this.autoScroll && this.isVisible) {
                            // Check if we are actually at the bottom, if not, scroll again
                            const isNearBottom = this.tooltipElement.scrollHeight - this.tooltipElement.scrollTop - this.tooltipElement.clientHeight < 5; // Use a small tolerance
                            if (!isNearBottom) {
                                this.tooltipElement.scrollTop = this.tooltipElement.scrollHeight;
                            }
                        }
                    }, 50);
                }
            });
        });
    }


    /** Calculates and sets the tooltip's position. */
    _setPosition() {
        if (!this.isVisible || !this.indicatorElement || !this.tooltipElement) return;

        const indicatorRect = this.indicatorElement.getBoundingClientRect();
        const tooltip = this.tooltipElement;
        const margin = 10;
        const isMobile = isMobileDevice(); // Assume global function
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        const safeAreaHeight = viewportHeight - margin;
        const safeAreaWidth = viewportWidth - margin;

        // Reset styles that affect measurement
        tooltip.style.maxHeight = '';
        tooltip.style.overflowY = '';
        tooltip.style.visibility = 'hidden'; // Keep hidden during measurement
        tooltip.style.display = 'block'; // Ensure it's displayed for measurement

        // Use getComputedStyle for more reliable dimensions
        const computedStyle = window.getComputedStyle(tooltip);
        const tooltipWidth = parseFloat(computedStyle.width);
        let tooltipHeight = parseFloat(computedStyle.height);

        let left, top;
        let finalMaxHeight = '';
        let finalOverflowY = '';

        if (isMobile) {
            // Center horizontally, clamp to viewport
            left = Math.max(margin, (viewportWidth - tooltipWidth) / 2);
            if (left + tooltipWidth > safeAreaWidth) {
                left = safeAreaWidth - tooltipWidth; // Adjust if too wide
            }

            // Limit height to 80% of viewport
            const maxTooltipHeight = viewportHeight * 0.8;
            if (tooltipHeight > maxTooltipHeight) {
                finalMaxHeight = `${maxTooltipHeight}px`;
                finalOverflowY = 'scroll';
                tooltipHeight = maxTooltipHeight; // Use constrained height for positioning
            }

            // Center vertically, clamp to viewport
            top = Math.max(margin, (viewportHeight - tooltipHeight) / 2);
            if (top + tooltipHeight > safeAreaHeight) {
                top = safeAreaHeight - tooltipHeight;
            }

        } else { // Desktop Positioning
            // Default: Right of indicator
            left = indicatorRect.right + margin;
            top = indicatorRect.top + (indicatorRect.height / 2) - (tooltipHeight / 2);

            // Check right overflow
            if (left + tooltipWidth > safeAreaWidth) {
                // Try: Left of indicator
                left = indicatorRect.left - tooltipWidth - margin;

                // Check left overflow
                if (left < margin) {
                    // Try: Centered horizontally
                    left = Math.max(margin, (viewportWidth - tooltipWidth) / 2);

                    // Try: Below indicator
                    if (indicatorRect.bottom + tooltipHeight + margin <= safeAreaHeight) {
                        top = indicatorRect.bottom + margin;
                    }
                    // Try: Above indicator
                    else if (indicatorRect.top - tooltipHeight - margin >= margin) {
                        top = indicatorRect.top - tooltipHeight - margin;
                    }
                    // Last resort: Fit vertically with scrolling
                    else {
                        top = margin;
                        finalMaxHeight = `${safeAreaHeight - margin}px`; // Use remaining height
                        finalOverflowY = 'scroll';
                        tooltipHeight = safeAreaHeight - margin; // Use constrained height
                    }
                }
            }

            // Final vertical check & adjustment
            if (top < margin) {
                top = margin;
            }
            if (top + tooltipHeight > safeAreaHeight) {
                // If tooltip is taller than viewport space, enable scrolling
                if (tooltipHeight > safeAreaHeight - margin) {
                    top = margin;
                    finalMaxHeight = `${safeAreaHeight - margin}px`;
                    finalOverflowY = 'scroll';
                } else {
                    // Otherwise, just move it up
                    top = safeAreaHeight - tooltipHeight;
                }
            }
        }

        // Apply calculated styles
        tooltip.style.position = 'fixed';
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
        tooltip.style.zIndex = '99999999'; // Ensure high z-index
        tooltip.style.maxHeight = finalMaxHeight;
        tooltip.style.overflowY = finalOverflowY;

        // Force scrollbars on WebKit if needed
        if (finalOverflowY === 'scroll') {
            tooltip.style.webkitOverflowScrolling = 'touch';
        }

        // Make visible AFTER positioning
        tooltip.style.visibility = 'visible';
    }

    _updateScrollButtonVisibility() {
        if (!this.tooltipElement || !this.scrollButton) return;
        const isStreaming = this.status === 'streaming';
        if (!isStreaming) {
            this.scrollButton.style.display = 'none';
            return;
        }

        // Check if scrolled near the bottom
        const isNearBottom = this.tooltipElement.scrollHeight - this.tooltipElement.scrollTop - this.tooltipElement.clientHeight < (isMobileDevice() ? 40 : 55);
        this.scrollButton.style.display = isNearBottom ? 'none' : 'block';
    }

    // --- Event Handlers ---

    _handleMouseEnter(event) {
        if (isMobileDevice()) return;
        this.show();
    }

    _handleMouseLeave(event) {
        if (isMobileDevice()) return;
        // Use timeout to allow moving cursor to the tooltip itself
        setTimeout(() => {
            // Check if the tooltip itself or the indicator is still hovered
            if (this.tooltipElement && !this.tooltipElement.matches(':hover') &&
                this.indicatorElement && !this.indicatorElement.matches(':hover')) {
                this.hide();
            }
        }, 100);
    }

    _handleIndicatorClick(event) {
        event.stopPropagation();
        event.preventDefault();
        this.toggle();
    }

    _handleTooltipMouseEnter() {
        // Keep tooltip visible when mouse enters it (necessary if mouseleave timeout is short)
        if (!this.isPinned) {
            this.show(); // Re-affirm visibility
        }
    }

    _handleTooltipMouseLeave() {
        // If not pinned, hide the tooltip when mouse leaves it
        if (!this.isPinned) {
            this.hide();
        }
    }

    _handleTooltipClick(event) {
        // This handler is mainly for clicks *outside* interactive elements within the tooltip
        if (!this.isPinned &&
            !event.target.closest('.tooltip-controls button') &&
            !event.target.closest('.reasoning-toggle') &&
            !event.target.closest('.scroll-to-bottom-button')) {
            this.hide();
        }
        // Clicks on buttons are handled by their specific handlers (_handlePinClick, etc.)
        // We don't need to stop propagation here unless it causes issues elsewhere.
    }

    _handleTooltipScroll() {
        if (!this.tooltipElement) return;

        // Check if we're near the bottom BEFORE potentially disabling autoScroll
        const isNearBottom = this.tooltipElement.scrollHeight - this.tooltipElement.scrollTop - this.tooltipElement.clientHeight < (isMobileDevice() ? 40 : 55);

        // If user is scrolling up or away from bottom
        if (!isNearBottom) {
            if (this.autoScroll) {
                this.autoScroll = false;
                this.tooltipElement.dataset.autoScroll = 'false';
                this.userInitiatedScroll = true;
            }
        } else {
            // Only re-enable auto-scroll if user explicitly scrolled to bottom
            if (this.userInitiatedScroll) {
                this.autoScroll = true;
                this.tooltipElement.dataset.autoScroll = 'true';
                this.userInitiatedScroll = false;
            }
        }
        this._updateScrollButtonVisibility();
    }

    _handlePinClick(e) {
        e.stopPropagation();
        if (this.isPinned) {
            this.unpin();
        } else {
            this.pin();
        }
    }

    _handleCopyClick(e) {
        e.stopPropagation();
        if (!this.descriptionElement || !this.reasoningTextElement || !this.copyButton) return;

        let textToCopy = this.descriptionElement.textContent || ''; // Use textContent to avoid HTML
        const reasoningContent = this.reasoningTextElement.textContent || '';
        if (reasoningContent) {
            textToCopy += '\n\nReasoning:\n' + reasoningContent;
        }

        navigator.clipboard.writeText(textToCopy).then(() => {
            const originalText = this.copyButton.innerHTML;
            this.copyButton.innerHTML = '✓';
            this.copyButton.disabled = true;
            setTimeout(() => {
                this.copyButton.innerHTML = originalText;
                this.copyButton.disabled = false;
            }, 1500);
        }).catch(err => {
            console.error('[ScoreIndicator] Failed to copy text: ', err);
            // Optionally provide user feedback here
        });
    }

    _handleReasoningToggleClick(e) {
        e.stopPropagation();
        if (!this.reasoningDropdown || !this.reasoningContent || !this.reasoningArrow) return;

        const isExpanded = this.reasoningDropdown.classList.toggle('expanded');
        this.reasoningArrow.textContent = isExpanded ? '▼' : '▶';

        if (isExpanded) {
            this.reasoningContent.style.maxHeight = '300px'; // Allow height transition
            this.reasoningContent.style.padding = '10px';
        } else {
            this.reasoningContent.style.maxHeight = '0';
            this.reasoningContent.style.padding = '0 10px'; // Keep horizontal padding
        }
    }


    _handleScrollButtonClick(e) {
        e.stopPropagation();
        if (!this.tooltipElement) return;

        this.autoScroll = true;
        this.tooltipElement.dataset.autoScroll = 'true';
        this._performAutoScroll();
        this._updateScrollButtonVisibility(); // Should hide the button now
    }

    // --- Public API ---

    /**
     * Updates the indicator's state and refreshes the UI.
     * @param {object} options
     * @param {string} options.status - New status ('pending', 'streaming', 'rated', 'error', 'cached', 'blacklisted').
     * @param {number|null} [options.score] - New score.
     * @param {string} [options.description] - New description text.
     * @param {string} [options.reasoning] - New reasoning text.
     */
    update({ status, score = null, description = '', reasoning = '' }) {
        // console.log(`[ScoreIndicator ${this.tweetId}] Updating state - Status: ${status}, Score: ${score}`);
        const statusChanged = this.status !== status;
        const scoreChanged = this.score !== score;
        const descriptionChanged = this.description !== description;
        const reasoningChanged = this.reasoning !== reasoning;

        // Only update if something actually changed
        if (!statusChanged && !scoreChanged && !descriptionChanged && !reasoningChanged) {
            // console.log(`[ScoreIndicator ${this.tweetId}] No state change detected.`);
            return;
        }

        this.status = status;
        // Ensure score is null if status implies it (e.g., pending without previous score)
        this.score = (status === 'pending' || status === 'error') ? score : // Allow score display for error state if provided
            (status === 'streaming' && score === null) ? this.score : // Keep existing score during streaming if new one is null
                score;
        this.description = description;
        this.reasoning = reasoning;

        // Update autoScroll state based on new status BEFORE UI updates
        const shouldAutoScroll = (this.status === 'pending' || this.status === 'streaming');
        if (this.autoScroll !== shouldAutoScroll) {
            this.autoScroll = shouldAutoScroll;
            // Add null check before accessing dataset
            if (this.tooltipElement) {
                this.tooltipElement.dataset.autoScroll = this.autoScroll ? 'true' : 'false';
            }
        }

        // Update UI elements
        if (statusChanged || scoreChanged) {
            this._updateIndicatorUI();
        }
        // Update tooltip if content changed or if visibility/scrolling might need adjustment
        if (descriptionChanged || reasoningChanged || statusChanged) {
            this._updateTooltipUI(); // This handles content and auto-scroll if visible
        } else {
            // If only score changed, ensure scroll button visibility is correct
            this._updateScrollButtonVisibility();
        }

        // Update dataset attributes on the article
        this.updateDatasetAttributes();
    }


    /** Shows the tooltip and positions it correctly. */
    show() {
        if (!this.tooltipElement) return;
        // console.log(`[ScoreIndicator ${this.tweetId}] Showing tooltip`);
        this.isVisible = true;
        this.tooltipElement.style.display = 'block';
        this._setPosition(); // Calculate and apply position

        // Handle auto-scroll on show if needed
        if (this.autoScroll && (this.status === 'streaming' || this.status === 'pending')) {
            this._performAutoScroll();
        }
        // Ensure scroll button visibility is correct on show
        this._updateScrollButtonVisibility();
    }

    /** Hides the tooltip unless it's pinned. */
    hide() {
        if (!this.isPinned && this.tooltipElement) {
            // console.log(`[ScoreIndicator ${this.tweetId}] Hiding tooltip`);
            this.isVisible = false;
            this.tooltipElement.style.display = 'none';
        } else if (this.isPinned) {
            // console.log(`[ScoreIndicator ${this.tweetId}] Attempted to hide pinned tooltip`);
        }
    }

    /** Toggles the tooltip's visibility. */
    toggle() {
        if (this.isVisible && !this.isPinned) {
            this.hide();
        } else {
            // If pinned and visible, clicking should maybe unpin? Decided against for now.
            this.show(); // show() handles positioning and makes it visible
        }
    }

    /** Pins the tooltip open. */
    pin() {
        if (!this.tooltipElement || !this.pinButton) return;
        // console.log(`[ScoreIndicator ${this.tweetId}] Pinning tooltip`);
        this.isPinned = true;
        this.tooltipElement.classList.add('pinned');
        this.pinButton.innerHTML = '📍'; // Use the filled pin icon
        this.pinButton.title = 'Unpin tooltip';
        // Tooltip remains visible even if mouse leaves
    }

    /** Unpins the tooltip, allowing it to be hidden automatically. */
    unpin() {
        if (!this.tooltipElement || !this.pinButton) return;
        // console.log(`[ScoreIndicator ${this.tweetId}] Unpinning tooltip`);
        this.isPinned = false;
        this.tooltipElement.classList.remove('pinned');
        this.pinButton.innerHTML = '📌'; // Use the outline pin icon
        this.pinButton.title = 'Pin tooltip (prevents auto-closing)';
        // Check if mouse is currently outside the tooltip/indicator; if so, hide it now
        setTimeout(() => {
            if (this.tooltipElement && !this.tooltipElement.matches(':hover') &&
                this.indicatorElement && !this.indicatorElement.matches(':hover')) {
                this.hide();
            }
        }, 0);
    }


    /** Removes the indicator, tooltip, and listeners from the DOM and registry. */
    destroy() {
        // console.log(`[ScoreIndicator ${this.tweetId}] Destroying...`);

        // Clean up any active streaming request for this tweet
        if (window.activeStreamingRequests && window.activeStreamingRequests[this.tweetId]) {
            console.log(`Cleaning up active streaming request for tweet ${this.tweetId}`);
            window.activeStreamingRequests[this.tweetId].abort();
            delete window.activeStreamingRequests[this.tweetId];
        }

        // Remove event listeners first to prevent errors during removal
        this.indicatorElement?.removeEventListener('mouseenter', this._handleMouseEnter);
        this.indicatorElement?.removeEventListener('mouseleave', this._handleMouseLeave);
        this.indicatorElement?.removeEventListener('click', this._handleIndicatorClick);
        this.tooltipElement?.removeEventListener('mouseenter', this._handleTooltipMouseEnter);
        this.tooltipElement?.removeEventListener('mouseleave', this._handleTooltipMouseLeave);
        this.tooltipElement?.removeEventListener('click', this._handleTooltipClick);
        this.tooltipElement?.removeEventListener('scroll', this._handleTooltipScroll);
        this.pinButton?.removeEventListener('click', this._handlePinClick);
        this.copyButton?.removeEventListener('click', this._handleCopyClick);
        this.reasoningToggle?.removeEventListener('click', this._handleReasoningToggleClick);
        this.scrollButton?.removeEventListener('click', this._handleScrollButtonClick);


        this.indicatorElement?.remove();
        this.tooltipElement?.remove();

        // Remove from registry
        ScoreIndicatorRegistry.remove(this.tweetId);

        // Update dataset attribute on article (if it still exists)
        const currentArticle = this.findCurrentArticleElement(); // Find before nullifying
        if (currentArticle) {
            delete currentArticle.dataset.hasScoreIndicator;
            // delete currentArticle.dataset.indicatorManaged; // No longer using this
        }

        // Nullify references to help garbage collection
        this.tweetArticle = null;
        this.indicatorElement = null;
        this.tooltipElement = null;
        this.pinButton = null;
        this.copyButton = null;
        this.reasoningToggle = null;
        this.scrollButton = null;
    }

    /** Ensures the indicator element is attached to the correct current article element. */
    ensureIndicatorAttached() {
        if (!this.indicatorElement) return; // Nothing to attach
        const currentArticle = this.findCurrentArticleElement();
        if (!currentArticle) {
            return;
        }

        // Check if the indicator is already in the *correct* article
        if (this.indicatorElement.parentElement !== currentArticle) {
            // console.log(`[ScoreIndicator ${this.tweetId}] Re-attaching indicator to current article.`);
            // Ensure parent is positioned
            const currentPosition = window.getComputedStyle(currentArticle).position;
            if (currentPosition !== 'relative' && currentPosition !== 'absolute' && currentPosition !== 'fixed' && currentPosition !== 'sticky') {
                currentArticle.style.position = 'relative';
            }
            currentArticle.appendChild(this.indicatorElement);
        }
        // Ensure dataset is up-to-date on the *current* article
        this.updateDatasetAttributes(currentArticle);
    }

    /** Finds the current DOM element for the tweet article based on tweetId. */
    findCurrentArticleElement() {
        const timeline = document.querySelector('main') || document.querySelector('div[data-testid="primaryColumn"]');
        if (!timeline) return null;

        // Try finding via a link containing the tweetId first
        const linkSelector = `a[href*="/status/${this.tweetId}"]`;
        const linkElement = timeline.querySelector(linkSelector);
        const article = linkElement?.closest('article[data-testid="tweet"]');

        if (article) {
            // Verify the found article's ID matches, just in case the link wasn't the permalink
            if (window.getTweetID(article) === this.tweetId) {
                return article;
            }
        }

        // Fallback: Iterate through all articles if specific link not found
        // This is less efficient but necessary if the ID isn't easily queryable
        const articles = timeline.querySelectorAll('article[data-testid="tweet"]');
        for (const art of articles) {
            if (window.getTweetID(art) === this.tweetId) {
                return art;
            }
        }

        return null; // Not found
    }
}

// Registry for managing score indicators
const ScoreIndicatorRegistry = {
    instances: new Map(),

    get(tweetId, tweetArticle = null) {
        let instance = this.instances.get(tweetId);
        
        if (!instance && tweetArticle) {
            try {
                instance = new ScoreIndicator(tweetArticle);
            } catch (error) {
                console.error(`[ScoreIndicatorRegistry] Failed to create indicator for ${tweetId}:`, error);
                return null;
            }
        }
        
        return instance || null;
    },

    add(tweetId, instance) {
        if (!(instance instanceof ScoreIndicator)) {
            throw new Error('Can only add ScoreIndicator instances to registry');
        }
        this.instances.set(tweetId, instance);
    },

    remove(tweetId) {
        this.instances.delete(tweetId);
    },

    cleanupOrphaned() {
        for (const [tweetId, indicator] of this.instances) {
            if (!indicator.findCurrentArticleElement()) {
                indicator.destroy();
                this.instances.delete(tweetId);
            }
        }
    },

    destroyAll() {
        for (const indicator of this.instances.values()) {
            indicator.destroy();
        }
        this.instances.clear();
    }
};

// Helper function to format tooltip description
function formatTooltipDescription(description = "", reasoning = "") {
    let formattedDesc = description.trim();
    let formattedReasoning = reasoning.trim();
    
    // If we have both description and reasoning, format them
    if (formattedDesc && formattedReasoning) {
        return {
            description: formattedDesc,
            reasoning: formattedReasoning
        };
    }
    
    // If we only have one or the other, use it for both
    if (formattedDesc || formattedReasoning) {
        const content = formattedDesc || formattedReasoning;
        return {
            description: content,
            reasoning: content
        };
    }
    
    // If we have neither, return empty strings
    return {
        description: "",
        reasoning: ""
    };
}

// Expose to window object
window.ScoreIndicator = ScoreIndicator;
window.ScoreIndicatorRegistry = ScoreIndicatorRegistry;
window.formatTooltipDescription = formatTooltipDescription;
