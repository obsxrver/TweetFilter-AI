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

        this.tweetId = getTweetID(this.tweetArticle);
        this.isAuthorBlacklisted = false;

        this.indicatorElement = null;
        this.tooltipElement = null;

        this.tooltipControls = null;
        this.pinButton = null;
        this.copyButton = null;
        this.tooltipCloseButton = null;
        this.reasoningDropdown = null;
        this.reasoningToggle = null;
        this.reasoningArrow = null;
        this.reasoningContent = null;
        this.reasoningTextElement = null;
        this.descriptionElement = null;
        this.scoreTextElement = null;
        this.followUpQuestionsTextElement = null;
        this.scrollButton = null;
        this.metadataElement = null;
        this.conversationContainerElement = null;
        this.followUpQuestionsElement = null;
        this.customQuestionContainer = null;
        this.customQuestionInput = null;
        this.customQuestionButton = null;
        this.attachImageButton = null;
        this.refreshButton = null;

        this.followUpImageContainer = null;
        this.followUpImageInput = null;

        this.metadataDropdown = null;
        this.metadataToggle = null;
        this.metadataArrow = null;
        this.metadataContent = null;

        this.tooltipScrollableContentElement = null;

        this.status = 'pending';
        this.score = null;
        this.description = '';
        this.reasoning = '';
        this.metadata = null;
        this.conversationHistory = [];
        this.questions = [];
        this.isPinned = false;
        this.isVisible = false;
        this.autoScroll = true;
        this.userInitiatedScroll = false;
        this.uploadedImageDataUrls = [];
        this.qaConversationHistory = [];
        this.currentFollowUpSource = null;
        this.isFollowUpPending = false;
        this.editingTurnIndex = null;
        this._lastScrollPosition = 0;

        this._boundHandlers = {
            handleAttachImageClick: null,
            handleKeyDown: null,
            handleFollowUpTouchStart: null,
            handleFollowUpTouchEnd: null,
            handleConversationReasoningToggle: null,
            handleConversationAction: null,
            handleQuestionPaste: null
        };
        this._boundMethodHandlers = Object.create(null);
        this._listenerTeardowns = [];

        try {
            this._createElements(tweetArticle);
            this._addEventListeners();

            ScoreIndicatorRegistry.add(this.tweetId, this);
        } catch (error) {
            console.error(`[ScoreIndicator ${this.tweetId}] Failed initialization:`, error);

            this.destroy();
            throw error;
        }
    }

    /**
     * Creates the indicator and tooltip DOM elements.
     * @param {Element} initialTweetArticle - The article element to attach to initially.
     */
    _createElements(initialTweetArticle) {

        this.indicatorElement = document.createElement('button');
        this.indicatorElement.type = 'button';
        this.indicatorElement.className = 'score-indicator';
        this.indicatorElement.dataset.tweetId = this.tweetId;
        this.indicatorElement.setAttribute('aria-label', 'Open TweetFilter AI score details');
        this.indicatorElement.title = 'Open TweetFilter AI score details';

        initialTweetArticle.appendChild(this.indicatorElement);
        this._attachIndicatorToMetadataRow(initialTweetArticle);

        this.tooltipElement = document.createElement('div');
        this.tooltipElement.className = 'score-description';
        this.tooltipElement.style.display = 'none';
        this.tooltipElement.dataset.tweetId = this.tweetId;
        this.tooltipElement.dataset.autoScroll = this.autoScroll ? 'true' : 'false';

        if (isMobileDevice()) {
            this.tooltipElement.style.touchAction = 'pan-x pan-y pinch-zoom';
        }

        this.tooltipControls = document.createElement('div');
        this.tooltipControls.className = 'tooltip-controls';

        const tooltipTitle = document.createElement('div');
        tooltipTitle.className = 'tooltip-title';
        tooltipTitle.textContent = 'TweetFilter AI';
        this.tooltipControls.appendChild(tooltipTitle);

        this.tooltipCloseButton = document.createElement('button');
        this.tooltipCloseButton.className = 'close-button tooltip-close-button';
        this.tooltipCloseButton.innerHTML = '×';
        this.tooltipCloseButton.title = 'Close tooltip';
        this.tooltipCloseButton.type = 'button';
        this.tooltipCloseButton.setAttribute('aria-label', 'Close score details');

        this.pinButton = document.createElement('button');
        this.pinButton.className = 'tooltip-pin-button';
        this.pinButton.innerHTML = '📌';
        this.pinButton.title = 'Pin tooltip (prevents auto-closing)';
        this.pinButton.type = 'button';
        this.pinButton.setAttribute('aria-label', 'Pin score details');

        this.copyButton = document.createElement('button');
        this.copyButton.className = 'tooltip-copy-button';
        this.copyButton.innerHTML = '📋';
        this.copyButton.title = 'Copy content to clipboard';
        this.copyButton.type = 'button';
        this.copyButton.setAttribute('aria-label', 'Copy score details');

        this.refreshButton = document.createElement('button');
        this.refreshButton.className = 'tooltip-refresh-button';
        this.refreshButton.innerHTML = '🔄';
        this.refreshButton.title = 'Re-rate this tweet';
        this.refreshButton.type = 'button';
        this.refreshButton.setAttribute('aria-label', 'Re-rate this tweet');

        this.rateButton = document.createElement('button');
        this.rateButton.className = 'tooltip-rate-button';
        this.rateButton.innerHTML = '⭐';
        this.rateButton.title = 'Rate this tweet';
        this.rateButton.type = 'button';
        this.rateButton.setAttribute('aria-label', 'Rate this tweet');
        this.rateButton.style.display = 'none';

        this.tooltipControls.appendChild(this.pinButton);
        this.tooltipControls.appendChild(this.copyButton);
        this.tooltipControls.appendChild(this.refreshButton);
        this.tooltipControls.appendChild(this.rateButton);
        this.tooltipControls.appendChild(this.tooltipCloseButton);

        this.tooltipElement.appendChild(this.tooltipControls);

        this.tooltipScrollableContentElement = document.createElement('div');
        this.tooltipScrollableContentElement.className = 'tooltip-scrollable-content';

        if (isMobileDevice()) {
            this.tooltipScrollableContentElement.style.webkitOverflowScrolling = 'touch';
            this.tooltipScrollableContentElement.style.overscrollBehavior = 'contain';
        }

        this.reasoningDropdown = document.createElement('div');
        this.reasoningDropdown.className = 'reasoning-dropdown';
        this.reasoningDropdown.style.display = 'none';

        this.reasoningToggle = document.createElement('div');
        this.reasoningToggle.className = 'reasoning-toggle';

        this.reasoningArrow = document.createElement('span');
        this.reasoningArrow.className = 'reasoning-arrow';
        this.reasoningArrow.textContent = '▶';

        this.reasoningToggle.appendChild(this.reasoningArrow);
        this.reasoningToggle.appendChild(document.createTextNode(' Show Reasoning Trace'));

        this.reasoningContent = document.createElement('div');
        this.reasoningContent.className = 'reasoning-content';
        this.reasoningTextElement = document.createElement('div');
        this.reasoningTextElement.className = 'reasoning-text';
        this.reasoningContent.appendChild(this.reasoningTextElement);

        this.reasoningDropdown.appendChild(this.reasoningToggle);
        this.reasoningDropdown.appendChild(this.reasoningContent);
        this.tooltipScrollableContentElement.appendChild(this.reasoningDropdown);

        this.descriptionElement = document.createElement('div');
        this.descriptionElement.className = 'description-text';
        this.tooltipScrollableContentElement.appendChild(this.descriptionElement);

        this.scoreTextElement = document.createElement('div');
        this.scoreTextElement.className = 'score-text-from-description';
        this.scoreTextElement.style.display = 'none';
        this.tooltipScrollableContentElement.appendChild(this.scoreTextElement);

        this.followUpQuestionsTextElement = document.createElement('div');
        this.followUpQuestionsTextElement.className = 'follow-up-questions-text-from-description';
        this.followUpQuestionsTextElement.style.display = 'none';
        this.tooltipScrollableContentElement.appendChild(this.followUpQuestionsTextElement);

        this.conversationContainerElement = document.createElement('div');
        this.conversationContainerElement.className = 'tooltip-conversation-history';
        this.tooltipScrollableContentElement.appendChild(this.conversationContainerElement);

        this.followUpQuestionsElement = document.createElement('div');
        this.followUpQuestionsElement.className = 'tooltip-follow-up-questions';
        this.followUpQuestionsElement.style.display = 'none';
        this.tooltipScrollableContentElement.appendChild(this.followUpQuestionsElement);

        this.customQuestionContainer = document.createElement('div');
        this.customQuestionContainer.className = 'tooltip-custom-question-container';

        this.customQuestionInput = document.createElement('textarea');
        this.customQuestionInput.placeholder = 'Ask your own question...';
        this.customQuestionInput.className = 'tooltip-custom-question-input';
        this.customQuestionInput.rows = 1;

        this.customQuestionInput.addEventListener('input', function() {

            if (this.value.trim() === '') {
                this.style.height = 'auto';
                this.rows = 1;
            } else {
                this.style.height = 'auto';
                this.style.height = (this.scrollHeight) + 'px';
            }

        });

        const currentSelectedModel = browserGet('selectedModel', 'openai/gpt-4.1-nano');
        const supportsImages = typeof modelSupportsImages === 'function' && modelSupportsImages(currentSelectedModel);

        if (supportsImages) {
            this.attachImageButton = document.createElement('button');
            this.attachImageButton.textContent = '📎';
            this.attachImageButton.className = 'tooltip-attach-image-button';
            this.attachImageButton.title = 'Attach image(s) or PDF(s)';
            this.attachImageButton.type = 'button';
            this.attachImageButton.setAttribute('aria-label', 'Attach images or PDFs');

            this.followUpImageInput = document.createElement('input');
            this.followUpImageInput.type = 'file';
            // I escaped the slash here because it was messing up the comment stripping code.
            this.followUpImageInput.accept = `image${"/"}*,.pdf,application/pdf`;
            this.followUpImageInput.multiple = true;
            this.followUpImageInput.style.display = 'none';
        }

        this.customQuestionButton = document.createElement('button');
        this.customQuestionButton.textContent = 'Ask';
        this.customQuestionButton.className = 'tooltip-custom-question-button';
        this.customQuestionButton.type = 'button';

        this.customQuestionContainer.appendChild(this.customQuestionInput);
        if (this.attachImageButton) {
            this.customQuestionContainer.appendChild(this.attachImageButton);
            if (this.followUpImageInput) {
                this.customQuestionContainer.appendChild(this.followUpImageInput);
            }
        }
        this.customQuestionContainer.appendChild(this.customQuestionButton);

        if (isMobileDevice() && this.customQuestionInput) {
            const initialScroll = this.tooltipScrollableContentElement?.scrollTop || 0;

            setTimeout(() => {
                if (!this.customQuestionInput || !this.tooltipScrollableContentElement) {
                    return;
                }

                const preventScroll = (e) => {
                    this.tooltipScrollableContentElement.scrollTop = initialScroll;
                    e.preventDefault();
                };

                this.tooltipScrollableContentElement.addEventListener('scroll', preventScroll, { passive: false });
                this.customQuestionInput.focus({ preventScroll: true });
                this.customQuestionInput.blur();

                setTimeout(() => {
                    this.tooltipScrollableContentElement?.removeEventListener('scroll', preventScroll);
                    if (this.tooltipScrollableContentElement) {
                        this.tooltipScrollableContentElement.scrollTop = initialScroll;
                    }
                }, 100);
            }, 50);
        }

        if (supportsImages) {
            this.followUpImageContainer = document.createElement('div');
            this.followUpImageContainer.className = 'tooltip-follow-up-image-preview-container';
        }

        this.metadataDropdown = document.createElement('div');
        this.metadataDropdown.className = 'reasoning-dropdown';
        this.metadataDropdown.style.display = 'none';

        this.metadataToggle = document.createElement('div');
        this.metadataToggle.className = 'reasoning-toggle';

        this.metadataArrow = document.createElement('span');
        this.metadataArrow.className = 'reasoning-arrow';
        this.metadataArrow.textContent = '▶';

        this.metadataToggle.appendChild(this.metadataArrow);
        this.metadataToggle.appendChild(document.createTextNode(' Show Metadata'));

        this.metadataContent = document.createElement('div');
        this.metadataContent.className = 'reasoning-content';

        this.metadataElement = document.createElement('div');
        this.metadataElement.className = 'tooltip-metadata';

        this.metadataContent.appendChild(this.metadataElement);
        this.metadataDropdown.appendChild(this.metadataToggle);
        this.metadataDropdown.appendChild(this.metadataContent);

        this.tooltipElement.appendChild(this.tooltipScrollableContentElement);

        if (this.followUpImageContainer) {
            this.tooltipElement.appendChild(this.followUpImageContainer);
        }

        this.tooltipElement.appendChild(this.customQuestionContainer);
        this.tooltipElement.appendChild(this.metadataDropdown);

        this.scrollButton = document.createElement('div');
        this.scrollButton.className = 'scroll-to-bottom-button';
        this.scrollButton.innerHTML = '⬇ Scroll to bottom';
        this.scrollButton.style.display = 'none';
        this.tooltipElement.appendChild(this.scrollButton);

        const bottomSpacer = document.createElement('div');
        bottomSpacer.className = 'tooltip-bottom-spacer';
        this.tooltipScrollableContentElement.appendChild(bottomSpacer);

        document.body.appendChild(this.tooltipElement);

        if (isMobileDevice()) {
            this.indicatorElement?.classList.add('mobile-indicator');
            this.tooltipElement?.classList.add('mobile-tooltip');
        }

        this._updateIndicatorUI();
        this._updateTooltipUI();

        this.autoScrollConversation = true;
        if (this.conversationContainerElement) {
            this._registerDomListener(
                this.conversationContainerElement,
                'scroll',
                this._getBoundMethodHandler('_handleConversationScroll')
            );
        }

        if (isMobileDevice()) {
            this._initializeMobileInteractionFix();
        }
    }

    /**
     * Initializes the mobile scroll interaction workaround.
     * @private
     */
    _initializeMobileInteractionFix() {
        this._hasFirstInteraction = false;

        const handleFirstTap = (e) => {
            if (!this._hasFirstInteraction) {

                this._hasFirstInteraction = true;

                const scrollTop = this.tooltipScrollableContentElement?.scrollTop || 0;

                setTimeout(() => {
                    if (this.tooltipScrollableContentElement &&
                        this.tooltipScrollableContentElement.scrollTop !== scrollTop) {

                        this.tooltipScrollableContentElement.scrollTop = scrollTop;
                    }
                }, 0);

                if (e.target === this.customQuestionInput && e.type === 'touchstart') {

                    requestAnimationFrame(() => {
                        if (this.tooltipScrollableContentElement) {
                            this.tooltipScrollableContentElement.scrollTop = scrollTop;
                        }
                    });
                }
            }
        };

        const interactiveElements = [
            this.customQuestionInput,
            this.customQuestionButton,
            this.reasoningToggle,
            this.metadataToggle,
            this.pinButton,
            this.copyButton,
            this.tooltipCloseButton,
            this.refreshButton,
            this.rateButton,
            this.scrollButton
        ].filter(el => el);

        interactiveElements.forEach(element => {
            this._registerDomListener(element, 'touchstart', handleFirstTap, { passive: true, capture: true });
        });

        if (this.customQuestionInput) {
            let scrollBeforeFocus = 0;

            const handleInputTouchStart = () => {
                scrollBeforeFocus = this.tooltipScrollableContentElement?.scrollTop || 0;
            };
            this._registerDomListener(this.customQuestionInput, 'touchstart', handleInputTouchStart, { passive: true });

            const handleInputFocus = () => {

                if (scrollBeforeFocus > 0) {
                    requestAnimationFrame(() => {
                        if (this.tooltipScrollableContentElement) {
                            this.tooltipScrollableContentElement.scrollTop = scrollBeforeFocus;
                        }
                    });
                }
            };
            this._registerDomListener(this.customQuestionInput, 'focus', handleInputFocus);
        }

        if (this.conversationContainerElement) {

            const handleConversationTouchStart = (e) => {
                const toggle = e.target.closest('.reasoning-toggle');
                if (toggle) {
                    handleFirstTap(e);
                }
            };
            this._registerDomListener(this.conversationContainerElement, 'touchstart', handleConversationTouchStart, { passive: true, capture: true });
        }

        if (this.tooltipScrollableContentElement) {
            let scrollLocked = false;

            const handleTooltipTouchStart = (e) => {
                scrollLocked = false;

                if (!this._hasFirstInteraction) {
                    const interactiveTarget = e.target.closest('button, textarea, .reasoning-toggle');
                    if (interactiveTarget) {
                        scrollLocked = true;
                        const scrollTop = this.tooltipScrollableContentElement.scrollTop;

                        requestAnimationFrame(() => {
                            if (scrollLocked && this.tooltipScrollableContentElement) {
                                this.tooltipScrollableContentElement.scrollTop = scrollTop;
                            }
                        });

                        setTimeout(() => {
                            scrollLocked = false;
                        }, 100);
                    }
                }
            };
            this._registerDomListener(this.tooltipScrollableContentElement, 'touchstart', handleTooltipTouchStart, { passive: true });
        }
    }

    /**
     * Simulates initial tap events on mobile interactive elements to bypass
     * the first-tap scrolling issue that occurs on some mobile browsers.
     * @private
     */
    _simulateInitialMobileTaps() {

        setTimeout(() => {

            const elementsToTap = [
                this.customQuestionInput,
                this.customQuestionButton,
                this.reasoningToggle,
                this.metadataToggle
            ].filter(el => el);

            elementsToTap.forEach(element => {
                try {

                    const touchEvent = new TouchEvent('touchstart', {
                        bubbles: true,
                        cancelable: true,
                        view: window,
                        touches: [new Touch({
                            identifier: Date.now(),
                            target: element,
                            clientX: 0,
                            clientY: 0,
                            screenX: 0,
                            screenY: 0,
                            pageX: 0,
                            pageY: 0,
                        })]
                    });
                    element.dispatchEvent(touchEvent);

                    const touchEndEvent = new TouchEvent('touchend', {
                        bubbles: true,
                        cancelable: true,
                        view: window,
                        changedTouches: [new Touch({
                            identifier: Date.now(),
                            target: element,
                            clientX: 0,
                            clientY: 0,
                            screenX: 0,
                            screenY: 0,
                            pageX: 0,
                            pageY: 0,
                        })]
                    });
                    element.dispatchEvent(touchEndEvent);
                } catch (e) {

                    try {
                        const event = document.createEvent('TouchEvent');
                        event.initTouchEvent('touchstart', true, true);
                        element.dispatchEvent(event);
                    } catch (fallbackError) {

                        element.click();

                        if (element.blur) {
                            element.blur();
                        }
                    }
                }
            });
        }, 100);
    }

    /**
     * Returns a memoized instance-bound handler for a class method.
     * @param {string} methodName
     * @returns {Function}
     */
    _getBoundMethodHandler(methodName) {
        if (!this._boundMethodHandlers[methodName]) {
            const method = this[methodName];
            if (typeof method !== 'function') {
                throw new Error(`[ScoreIndicator ${this.tweetId}] Missing handler method: ${methodName}`);
            }
            this._boundMethodHandlers[methodName] = method.bind(this);
        }
        return this._boundMethodHandlers[methodName];
    }

    /**
     * Registers a DOM event listener and tracks teardown for `destroy()`.
     * @param {EventTarget | null | undefined} target
     * @param {string} eventName
     * @param {Function} handler
     * @param {AddEventListenerOptions|boolean} [options]
     */
    _registerDomListener(target, eventName, handler, options) {
        if (!target || typeof target.addEventListener !== 'function' || typeof handler !== 'function') {
            return;
        }
        target.addEventListener(eventName, handler, options);
        this._listenerTeardowns.push(() => {
            if (target && typeof target.removeEventListener === 'function') {
                target.removeEventListener(eventName, handler, options);
            }
        });
    }

    /**
     * Runs and clears all registered listener teardowns.
     */
    _removeRegisteredListeners() {
        for (let i = this._listenerTeardowns.length - 1; i >= 0; i -= 1) {
            try {
                this._listenerTeardowns[i]();
            } catch (error) {
                console.warn(`[ScoreIndicator ${this.tweetId}] Failed to remove a listener:`, error);
            }
        }
        this._listenerTeardowns = [];
    }

    /** Adds necessary event listeners to the indicator and tooltip. */
    _addEventListeners() {
        if (!this.indicatorElement || !this.tooltipElement) return;

        this._registerDomListener(this.indicatorElement, 'mouseenter', this._getBoundMethodHandler('_handleMouseEnter'));
        this._registerDomListener(this.indicatorElement, 'mouseleave', this._getBoundMethodHandler('_handleMouseLeave'));
        this._registerDomListener(this.indicatorElement, 'click', this._getBoundMethodHandler('_handleIndicatorClick'));

        this._registerDomListener(this.tooltipElement, 'mouseenter', this._getBoundMethodHandler('_handleTooltipMouseEnter'));
        this._registerDomListener(this.tooltipElement, 'mouseleave', this._getBoundMethodHandler('_handleTooltipMouseLeave'));

        this._registerDomListener(this.tooltipScrollableContentElement, 'scroll', this._getBoundMethodHandler('_handleTooltipScroll'));

        this._registerDomListener(this.pinButton, 'click', this._getBoundMethodHandler('_handlePinClick'));
        this._registerDomListener(this.copyButton, 'click', this._getBoundMethodHandler('_handleCopyClick'));
        this._registerDomListener(this.tooltipCloseButton, 'click', this._getBoundMethodHandler('_handleCloseClick'));
        this._registerDomListener(this.reasoningToggle, 'click', this._getBoundMethodHandler('_handleReasoningToggleClick'));
        this._registerDomListener(this.scrollButton, 'click', this._getBoundMethodHandler('_handleScrollButtonClick'));
        this._registerDomListener(this.refreshButton, 'click', this._getBoundMethodHandler('_handleRefreshClick'));
        this._registerDomListener(this.rateButton, 'click', this._getBoundMethodHandler('_handleRateClick'));

        this._registerDomListener(this.followUpQuestionsElement, 'click', this._getBoundMethodHandler('_handleFollowUpQuestionClick'));

        if (isMobileDevice() && this.followUpQuestionsElement) {
            this._boundHandlers.handleFollowUpTouchStart = (e) => {
                const button = e.target.closest('.follow-up-question-button');
                if (button) {
                    e.preventDefault();

                    button.dataset.touchStartX = e.touches[0].clientX;
                    button.dataset.touchStartY = e.touches[0].clientY;
                }
            };

            this._boundHandlers.handleFollowUpTouchEnd = (e) => {
                const button = e.target.closest('.follow-up-question-button');
                if (button && button.dataset.touchStartX) {
                    e.preventDefault();

                    const touchEndX = e.changedTouches[0].clientX;
                    const touchEndY = e.changedTouches[0].clientY;
                    const deltaX = Math.abs(touchEndX - parseFloat(button.dataset.touchStartX));
                    const deltaY = Math.abs(touchEndY - parseFloat(button.dataset.touchStartY));

                    if (deltaX < 10 && deltaY < 10) {

                        this._handleFollowUpQuestionClick({
                            target: button,
                            preventDefault: () => {},
                            stopPropagation: () => {}
                        });
                    }

                    delete button.dataset.touchStartX;
                    delete button.dataset.touchStartY;
                }
            };

            this._registerDomListener(this.followUpQuestionsElement, 'touchstart', this._boundHandlers.handleFollowUpTouchStart, { passive: false });
            this._registerDomListener(this.followUpQuestionsElement, 'touchend', this._boundHandlers.handleFollowUpTouchEnd, { passive: false });
        }

        this._registerDomListener(this.customQuestionButton, 'click', this._getBoundMethodHandler('_handleCustomQuestionClick'));

        this._boundHandlers.handleKeyDown = (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                this._handleCustomQuestionClick(event);
            }
        };
        this._registerDomListener(this.customQuestionInput, 'keydown', this._boundHandlers.handleKeyDown);
        this._boundHandlers.handleQuestionPaste = this._getBoundMethodHandler('_handleQuestionPaste');
        this._registerDomListener(this.customQuestionInput, 'paste', this._boundHandlers.handleQuestionPaste);

        this._registerDomListener(this.metadataToggle, 'click', this._getBoundMethodHandler('_handleMetadataToggleClick'));

        if (this.attachImageButton && this.followUpImageInput) {
            this._boundHandlers.handleAttachImageClick = (event) => {
                event.preventDefault();
                event.stopPropagation();
                this.followUpImageInput.click();
            };
            this._registerDomListener(this.attachImageButton, 'click', this._boundHandlers.handleAttachImageClick);
            this._registerDomListener(this.followUpImageInput, 'change', this._getBoundMethodHandler('_handleFollowUpImageSelect'));
        }

    }

    /**
     * Finds the tweet metadata row containing the post time and, on detail
     * pages, the Views link.
     * @param {Element} article
     * @returns {Element|null}
     */
    _findTweetMetadataRow(article) {
        if (!article || !this.tweetId) return null;

        const timeLinks = Array.from(article.querySelectorAll(`a[href*="/status/${this.tweetId}"]`))
            .filter(link => link.querySelector('time'));
        for (const timeLink of timeLinks) {
            let candidate = timeLink.parentElement;
            for (let depth = 0; candidate && candidate !== article && depth < 4; depth += 1) {
                const hasViewsLink = candidate.querySelector(`a[href*="/status/${this.tweetId}/analytics"]`);
                const hasTime = candidate.querySelector('time');
                if (hasTime && hasViewsLink) {
                    return candidate;
                }
                candidate = candidate.parentElement;
            }
        }

        const primaryTimeLink = timeLinks[0];
        return primaryTimeLink?.parentElement?.parentElement || primaryTimeLink?.parentElement || null;
    }

    /** Places the score in normal document flow next to post time and views. */
    _attachIndicatorToMetadataRow(article) {
        if (!this.indicatorElement || !article) return false;
        const metadataRow = this._findTweetMetadataRow(article);
        if (!metadataRow) return false;

        if (this.indicatorElement.parentElement !== metadataRow) {
            metadataRow.appendChild(this.indicatorElement);
        }
        return true;
    }

    /** Updates the visual appearance of the indicator (icon/text, class). */
    _updateIndicatorUI() {
        if (!this.indicatorElement) return;

        const classList = this.indicatorElement.classList;
        classList.remove(
            'pending-rating', 'rated-rating', 'error-rating',
            'cached-rating', 'blacklisted-rating', 'streaming-rating',
            'manual-rating', 'blacklisted-author-indicator'
        );

        let indicatorText = '';
        let indicatorClass = '';

        if (this.isAuthorBlacklisted) {
            indicatorClass = 'blacklisted-author-indicator';
            indicatorText = (this.score !== null && this.score !== undefined) ? String(this.score) : '?';
        } else {
            switch (this.status) {
                case TweetRatingStatus.PENDING:
                    indicatorClass = 'pending-rating';
                    indicatorText = '...';
                    break;
                case TweetRatingStatus.STREAMING:
                    indicatorClass = 'streaming-rating';
                    indicatorText = (this.score !== null && this.score !== undefined) ? String(this.score) : '~';
                    break;
                case TweetRatingStatus.ERROR:
                    indicatorClass = 'error-rating';
                    indicatorText = '!';
                    break;
                case TweetRatingStatus.CACHED:
                    indicatorClass = 'cached-rating';
                    indicatorText = String(this.score);
                    break;
                case TweetRatingStatus.BLACKLISTED:
                    indicatorClass = 'blacklisted-rating';
                    indicatorText = String(this.score);
                    break;
                case TweetRatingStatus.MANUAL:
                    indicatorClass = 'manual-rating';
                    indicatorText = 'Rate';
                    break;
                case TweetRatingStatus.AD:
                    indicatorClass = 'rated-rating';
                    indicatorText = 'Ad';
                    break;
                case TweetRatingStatus.RATED:
                default:
                    indicatorClass = 'rated-rating';
                    indicatorText = String(this.score);
                    break;
            }
        }

        if (indicatorClass) {
            classList.add(indicatorClass);
        }
        const readableText = `Score: ${indicatorText}`;
        this.indicatorElement.textContent = `SCORE: ${indicatorText}`;
        this.indicatorElement.setAttribute('aria-label', `${readableText}. Open TweetFilter AI score details`);
    }

    /**
     * Splits a unified JSON response into tooltip display sections.
     * @param {string} fullDescription
     * @returns {{analysisContent: string, scoreContent: string, questionsContent: string}}
     */
    _extractDescriptionSections(fullDescription) {
        const parsedResponse = parseTweetFilterResponse(fullDescription);
        const streamingResponse = extractStreamingResponse(fullDescription);
        const looksLikeJsonEnvelope = /^\s*(?:```(?:json)?\s*)?\{/i.test(String(fullDescription || ''));
        const analysisContent = parsedResponse.response || streamingResponse.text ||
            ((parsedResponse.isValidJson || looksLikeJsonEnvelope) ? "*Waiting for analysis...*" : fullDescription);
        const scoreContent = parsedResponse.score !== null ? String(parsedResponse.score) : "";
        const questionsContent = parsedResponse.questions.join('\n');

        return { analysisContent, scoreContent, questionsContent };
    }

    /**
     * Computes metadata panel content and visibility from current metadata.
     * @returns {{metadataHTML: string, showMetadataDropdown: boolean}}
     */
    _buildMetadataDisplayState() {
        let metadataHTML = '';
        let showMetadataDropdown = false;
        const hasFullMetadata = this.metadata && Object.keys(this.metadata).length > 1 && this.metadata.model;
        const hasOnlyGenId = this.metadata && this.metadata.generationId && Object.keys(this.metadata).length === 1;

        if (hasFullMetadata) {
            if (this.metadata.providerName && this.metadata.providerName !== 'N/A') {
                metadataHTML += `<div class="metadata-line">Provider: ${escapeTooltipHtml(this.metadata.providerName)}</div>`;
            }
            metadataHTML += `<div class="metadata-line">Model: ${escapeTooltipHtml(this.metadata.model)}</div>`;
            metadataHTML += `<div class="metadata-line">Tokens: prompt: ${escapeTooltipHtml(this.metadata.promptTokens)} / completion: ${escapeTooltipHtml(this.metadata.completionTokens)}</div>`;
            if (this.metadata.reasoningTokens > 0) {
                metadataHTML += `<div class="metadata-line">Reasoning Tokens: ${escapeTooltipHtml(this.metadata.reasoningTokens)}</div>`;
            }
            metadataHTML += `<div class="metadata-line">Latency: ${escapeTooltipHtml(this.metadata.latency)}</div>`;
            if (this.metadata.mediaInputs > 0) {
                metadataHTML += `<div class="metadata-line">Media: ${escapeTooltipHtml(this.metadata.mediaInputs)}</div>`;
            }
            metadataHTML += `<div class="metadata-line">Price: ${escapeTooltipHtml(this.metadata.price)}</div>`;
            showMetadataDropdown = true;
        } else if (hasOnlyGenId) {
            metadataHTML += `<div class="metadata-line">Generation ID: ${escapeTooltipHtml(this.metadata.generationId)}</div>`;
            showMetadataDropdown = true;
        }

        return { metadataHTML, showMetadataDropdown };
    }

    /** Updates the content and potentially scroll position of the tooltip. */
    _updateTooltipUI() {

        if (!this.tooltipElement || !this.tooltipScrollableContentElement || !this.descriptionElement || !this.scoreTextElement || !this.followUpQuestionsTextElement || !this.reasoningTextElement || !this.reasoningDropdown || !this.conversationContainerElement || !this.followUpQuestionsElement || !this.metadataElement || !this.metadataDropdown) {
            return;
        }

        const previousScrollTop = this.tooltipScrollableContentElement.scrollTop;

        const {
            analysisContent,
            scoreContent,
            questionsContent
        } = this._extractDescriptionSections(this.description || "");

        let contentChanged = false;

        const formattedAnalysis = formatTooltipDescription(analysisContent).description;
        if (this.descriptionElement.innerHTML !== formattedAnalysis) {
            this.descriptionElement.innerHTML = formattedAnalysis;
            contentChanged = true;
        }

        if (scoreContent) {

            const formattedScoreText = `<span class="score-highlight">SCORE: ${scoreContent.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>`;

            if (this.scoreTextElement.innerHTML !== formattedScoreText) {
                this.scoreTextElement.innerHTML = formattedScoreText;
                contentChanged = true;
            }
            this.scoreTextElement.style.display = 'block';
        } else {
            if (this.scoreTextElement.style.display !== 'none') {
                this.scoreTextElement.style.display = 'none';
                this.scoreTextElement.innerHTML = '';
                contentChanged = true;
            }
        }

        if (questionsContent) {
            const formattedQuestionsText = questionsContent.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
            if (this.followUpQuestionsTextElement.innerHTML !== formattedQuestionsText) {
                this.followUpQuestionsTextElement.innerHTML = formattedQuestionsText;

            }
        } else {
            if (this.followUpQuestionsTextElement.innerHTML !== '') {
                this.followUpQuestionsTextElement.innerHTML = '';
            }
        }
        this.followUpQuestionsTextElement.style.display = 'none';

        const formattedReasoning = formatTooltipDescription("", this.reasoning).reasoning;
        if (this.reasoningTextElement.innerHTML !== formattedReasoning) {
            this.reasoningTextElement.innerHTML = formattedReasoning;
            contentChanged = true;
        }
        const showReasoning = !!formattedReasoning;
        if ((this.reasoningDropdown.style.display === 'none') === showReasoning) {
            this.reasoningDropdown.style.display = showReasoning ? 'block' : 'none';
            contentChanged = true;
        }

        const renderedHistory = this._renderConversationHistory();
        if (this.conversationContainerElement.innerHTML !== renderedHistory) {
            this.conversationContainerElement.innerHTML = renderedHistory;
            this.conversationContainerElement.style.display = this.conversationHistory.length > 0 ? 'block' : 'none';
            this._attachConversationReasoningListeners();
            contentChanged = true;
        }

        let questionsButtonsChanged = false;

        if (this.followUpQuestionsElement.children.length !== (this.questions?.length || 0)) {
            questionsButtonsChanged = true;
        } else {

            this.questions?.forEach((q, i) => {
                const button = this.followUpQuestionsElement.children[i];
                if (!button || button.dataset.questionText !== q) {
                    questionsButtonsChanged = true;
                }
            });
        }

        if (questionsButtonsChanged) {
            this.followUpQuestionsElement.innerHTML = '';
            if (this.questions && this.questions.length > 0) {
                this.questions.forEach((question, index) => {
                    const questionButton = document.createElement('button');
                    questionButton.className = 'follow-up-question-button';
                    questionButton.textContent = `🤔 ${question}`;
                    questionButton.dataset.questionIndex = index;
                    questionButton.dataset.questionText = question;

                    if (isMobileDevice()) {

                        let hasBeenTapped = false;

                        questionButton.addEventListener('touchstart', (e) => {
                            if (!hasBeenTapped) {
                                hasBeenTapped = true;
                                const scrollTop = this.tooltipScrollableContentElement?.scrollTop || 0;
                                requestAnimationFrame(() => {
                                    if (this.tooltipScrollableContentElement) {
                                        this.tooltipScrollableContentElement.scrollTop = scrollTop;
                                    }
                                });
                            }
                        }, { passive: true });

                        questionButton.addEventListener('focus', (e) => {

                            e.target.blur();
                        }, { passive: true });
                    }

                    this.followUpQuestionsElement.appendChild(questionButton);
                });
                this.followUpQuestionsElement.style.display = 'block';
            } else {
                this.followUpQuestionsElement.style.display = 'none';
            }
            contentChanged = true;
        }

        const { metadataHTML, showMetadataDropdown } = this._buildMetadataDisplayState();

        if (this.metadataElement.innerHTML !== metadataHTML) {
            this.metadataElement.innerHTML = metadataHTML;
            contentChanged = true;
        }

        if (this.metadataDropdown) {
            const currentDisplay = this.metadataDropdown.style.display;
            const newDisplay = showMetadataDropdown ? 'block' : 'none';
            if (currentDisplay !== newDisplay) {
                this.metadataDropdown.style.display = newDisplay;
                contentChanged = true;
            }
        }

        const isStreaming = this.status === TweetRatingStatus.STREAMING;
        if (this.tooltipElement.classList.contains('streaming-tooltip') !== isStreaming) {
             this.tooltipElement.classList.toggle('streaming-tooltip', isStreaming);
             contentChanged = true;
        }

        if (this.rateButton) {
            const showRateButton = this.status === TweetRatingStatus.MANUAL;
            const currentDisplay = this.rateButton.style.display;
            const newDisplay = showRateButton ? 'inline-block' : 'none';
            if (currentDisplay !== newDisplay) {
                this.rateButton.style.display = newDisplay;
                contentChanged = true;
            }
        }

        if (contentChanged) {
            requestAnimationFrame(() => {

                if (this.tooltipScrollableContentElement && this.isVisible) {
                    if (this.autoScroll) {
                        this._performAutoScroll();
                    } else {

                        this.tooltipScrollableContentElement.scrollTop = previousScrollTop;
                    }
                }
                this._updateScrollButtonVisibility();
            });
        } else {

            this._updateScrollButtonVisibility();
        }
    }

    /** Renders the conversation history into HTML string */
    _renderConversationHistory() {
        if (!this.conversationHistory || this.conversationHistory.length === 0) {
            return '';
        }

        const expandedStates = new Map();
        if (this.conversationContainerElement) {
            this.conversationContainerElement.querySelectorAll('.conversation-reasoning').forEach(dropdown => {
                expandedStates.set(Number(dropdown.dataset.index), dropdown.classList.contains('expanded'));
            });
        }

        let historyHtml = '';
        this.conversationHistory.forEach((turn, index) => {
            const formattedQuestion = escapeTooltipHtml(turn.question).replace(/\n/g, '<br>');
            const isEditing = this.editingTurnIndex === index;
            const actionsDisabled = this.isFollowUpPending ? ' disabled' : '';
            const canRevise = turn.answer !== 'pending' && Number.isInteger(turn.qaUserIndex);

            let uploadedImageHtml = '';
            if (turn.uploadedImages && turn.uploadedImages.length > 0) {
                uploadedImageHtml = `
                    <div class="conversation-image-container">
                        ${turn.uploadedImages.map(url => {
                            if (url.startsWith('data:application/pdf')) {

                                return `
                                    <div class="conversation-uploaded-pdf" style="display: inline-block; text-align: center; margin: 4px;">
                                        <span style="font-size: 48px;">📄</span>
                                        <div style="font-size: 12px;">PDF Document</div>
                                    </div>
                                `;
                            } else {

                                return `<img src="${escapeTooltipHtml(url)}" alt="User uploaded image" class="conversation-uploaded-image">`;
                            }
                        }).join('')}
                    </div>
                `;
            }

            let formattedAnswer;
            if (turn.answer === 'pending') {
                formattedAnswer = '<em class="pending-answer">Answering...</em>';
            } else {
                formattedAnswer = renderTooltipMarkdown(turn.answer);
            }

            if (index > 0) {
                historyHtml += '<hr class="conversation-separator">';
            }

            let reasoningHtml = '';
            if (turn.reasoning && turn.reasoning.trim() !== '' && turn.answer !== 'pending') {
                const formattedReasoning = formatTooltipDescription("", turn.reasoning).reasoning;

                const wasExpanded = expandedStates.get(index);
                const expandedClass = wasExpanded ? ' expanded' : '';
                const arrowChar = wasExpanded ? '▼' : '▶';
                const contentStyle = wasExpanded ? 'style="max-height: 200px; padding: 8px;"' : 'style="max-height: 0; padding: 0 8px;"';

                reasoningHtml = `
                    <div class="reasoning-dropdown conversation-reasoning${expandedClass}" data-index="${index}">
                        <div class="reasoning-toggle" role="button" tabindex="0" aria-expanded="${wasExpanded ? 'true' : 'false'}">
                            <span class="reasoning-arrow">${arrowChar}</span> Show Reasoning Trace
                        </div>
                        <div class="reasoning-content" ${contentStyle}>
                            <p class="reasoning-text">${formattedReasoning}</p>
                        </div>
                    </div>
                `;
            }

            const questionHtml = isEditing
                ? `
                    <div class="conversation-edit-form" data-turn-index="${index}">
                        <label for="conversation-edit-${this.tweetId}-${index}">Edit your message</label>
                        <textarea id="conversation-edit-${this.tweetId}-${index}" class="conversation-edit-input" rows="3">${escapeTooltipHtml(turn.question)}</textarea>
                        <div class="conversation-edit-actions">
                            <button type="button" class="conversation-action-button conversation-save-edit" data-turn-index="${index}">Save & resubmit</button>
                            <button type="button" class="conversation-action-button conversation-cancel-edit" data-turn-index="${index}">Cancel</button>
                        </div>
                    </div>`
                : `
                    <div class="conversation-question-row">
                        <div class="conversation-question"><strong>You:</strong> ${formattedQuestion}</div>
                        ${canRevise ? `<button type="button" class="conversation-action-button conversation-edit-button" data-turn-index="${index}" aria-label="Edit and resubmit this message" title="Edit and resubmit"${actionsDisabled}>Edit</button>` : ''}
                    </div>`;

            const rerollButton = canRevise && !isEditing
                ? `<button type="button" class="conversation-action-button conversation-reroll-button" data-turn-index="${index}" aria-label="Reroll this AI response" title="Reroll response"${actionsDisabled}>Reroll</button>`
                : '';

            historyHtml += `
                <div class="conversation-turn">
                    ${questionHtml}
                    ${uploadedImageHtml}
                    ${reasoningHtml}
                    <div class="conversation-answer-row">
                        <div class="conversation-answer"><strong>AI:</strong> ${formattedAnswer}</div>
                        ${rerollButton}
                    </div>
                </div>
            `;
        });

        return historyHtml;
    }

    /**
     * Attaches event listeners to reasoning toggles within the conversation history.
     * Uses event delegation.
     */
    _attachConversationReasoningListeners() {
        if (!this.conversationContainerElement) return;

        if (!this._boundHandlers.handleConversationAction) {
            this._boundHandlers.handleConversationAction = this._getBoundMethodHandler('_handleConversationAction');
            this._registerDomListener(this.conversationContainerElement, 'click', this._boundHandlers.handleConversationAction);
        }

        if (this._boundHandlers.handleConversationReasoningToggle) {
            return;
        }

        this._boundHandlers.handleConversationReasoningToggle = (e) => {
            const toggleButton = e.target.closest('.conversation-reasoning .reasoning-toggle');
            if (!toggleButton) return;

            if (e.type === 'click' && !e.isTrusted) {

                return;
            }

            const dropdown = toggleButton.closest('.reasoning-dropdown');
            const content = dropdown?.querySelector('.reasoning-content');
            const arrow = dropdown?.querySelector('.reasoning-arrow');

            if (!dropdown || !content || !arrow) return;

            const scrollTop = this.tooltipScrollableContentElement?.scrollTop || 0;

            const isExpanded = dropdown.classList.toggle('expanded');
            arrow.textContent = isExpanded ? '▼' : '▶';
            toggleButton.setAttribute('aria-expanded', isExpanded);
            content.style.maxHeight = isExpanded ? '200px' : '0';
            content.style.padding = isExpanded ? '8px' : '0 8px';

            if (isMobileDevice() && this.tooltipScrollableContentElement) {
                requestAnimationFrame(() => {
                    if (this.tooltipScrollableContentElement) {
                        this.tooltipScrollableContentElement.scrollTop = scrollTop;
                    }
                });
            }
        };

        this._registerDomListener(this.conversationContainerElement, 'click', this._boundHandlers.handleConversationReasoningToggle);
    }

    /** Handles edit, save, cancel, and reroll actions for prior turns. */
    _handleConversationAction(event) {
        const actionButton = event.target.closest('.conversation-action-button');
        if (!actionButton) return;

        event.preventDefault();
        event.stopPropagation();
        if (this.isFollowUpPending) return;

        const turnIndex = Number(actionButton.dataset.turnIndex);
        if (!Number.isInteger(turnIndex) || !this.conversationHistory[turnIndex]) return;

        if (actionButton.classList.contains('conversation-edit-button')) {
            this.editingTurnIndex = turnIndex;
            this.autoScroll = false;
            this.userInitiatedScroll = true;
            this._updateTooltipUI();
            requestAnimationFrame(() => {
                const input = this.conversationContainerElement?.querySelector(`.conversation-edit-input[id$="-${turnIndex}"]`);
                input?.focus({ preventScroll: true });
                input?.setSelectionRange(input.value.length, input.value.length);
            });
            return;
        }

        if (actionButton.classList.contains('conversation-cancel-edit')) {
            this.editingTurnIndex = null;
            this._updateTooltipUI();
            return;
        }

        if (actionButton.classList.contains('conversation-save-edit')) {
            const input = actionButton.closest('.conversation-edit-form')?.querySelector('.conversation-edit-input');
            const revisedQuestion = input?.value.trim() || '';
            const hasFiles = (this.conversationHistory[turnIndex].uploadedImages || []).length > 0;
            if (!revisedQuestion && !hasFiles) {
                showStatus('A message cannot be empty.', 'warning');
                input?.focus();
                return;
            }
            this._resubmitConversationTurn(turnIndex, revisedQuestion || '[file only message]');
            return;
        }

        if (actionButton.classList.contains('conversation-reroll-button')) {
            this._resubmitConversationTurn(turnIndex, this.conversationHistory[turnIndex].question, true);
        }
    }

    _cloneConversationMessage(message) {
        if (!message) return null;
        if (typeof structuredClone === 'function') {
            return structuredClone(message);
        }
        return JSON.parse(JSON.stringify(message));
    }

    /** Maps each rendered turn to its user/assistant messages in API history. */
    _syncConversationHistoryApiIndices() {
        if (!Array.isArray(this.qaConversationHistory) || !Array.isArray(this.conversationHistory)) return;

        const initialAssistantText = this.qaConversationHistory[2]?.role === 'assistant'
            ? this.qaConversationHistory[2].content?.find(item => item.type === 'text')?.text || ''
            : '';
        const hasInitialRating = this.qaConversationHistory[1]?.role === 'user' &&
            this.qaConversationHistory[2]?.role === 'assistant' &&
            parseTweetFilterResponse(initialAssistantText).hasScore;
        let turnIndex = 0;

        for (let messageIndex = hasInitialRating ? 3 : 1; messageIndex < this.qaConversationHistory.length; messageIndex += 1) {
            if (this.qaConversationHistory[messageIndex]?.role !== 'user') continue;
            const assistantIndex = this.qaConversationHistory.findIndex((message, index) =>
                index > messageIndex && message.role === 'assistant'
            );
            if (assistantIndex === -1 || !this.conversationHistory[turnIndex]) break;
            this.conversationHistory[turnIndex].qaUserIndex = messageIndex;
            this.conversationHistory[turnIndex].qaAssistantIndex = assistantIndex;
            turnIndex += 1;
            messageIndex = assistantIndex;
        }
    }

    _replaceQuestionInApiMessage(message, questionText) {
        const clonedMessage = this._cloneConversationMessage(message);
        if (!clonedMessage || !Array.isArray(clonedMessage.content)) return clonedMessage;

        const textItem = clonedMessage.content.find(item => item.type === 'text');
        if (!textItem) {
            clonedMessage.content.unshift({ type: 'text', text: questionText });
            return clonedMessage;
        }

        const questionMarker = '\n\nQuestion:\n';
        const markerIndex = String(textItem.text || '').lastIndexOf(questionMarker);
        textItem.text = markerIndex === -1
            ? questionText
            : `${String(textItem.text).slice(0, markerIndex + questionMarker.length)}${questionText}`;
        return clonedMessage;
    }

    /**
     * Resubmits an edited user message or rerolls its answer. Later turns are
     * deliberately discarded; this UI maintains one linear conversation.
     */
    _resubmitConversationTurn(turnIndex, questionText, isReroll = false) {
        if (this.isFollowUpPending) return;

        const apiKey = browserGet('openrouter-api-key', '');
        if (!apiKey) {
            showStatus('API key missing. Cannot resubmit this message.', 'error');
            return;
        }

        this._syncConversationHistoryApiIndices();
        const originalTurn = this.conversationHistory[turnIndex];
        const userMessageIndex = originalTurn?.qaUserIndex;
        const originalUserMessage = Number.isInteger(userMessageIndex)
            ? this.qaConversationHistory[userMessageIndex]
            : null;
        if (!originalTurn || !originalUserMessage) {
            showStatus('Could not locate this message in conversation history.', 'error');
            return;
        }

        const userApiMessage = isReroll
            ? this._cloneConversationMessage(originalUserMessage)
            : this._replaceQuestionInApiMessage(originalUserMessage, questionText);
        const historyPrefix = this.qaConversationHistory
            .slice(0, userMessageIndex)
            .map(message => this._cloneConversationMessage(message));

        this.qaConversationHistory = historyPrefix;
        this.conversationHistory = this.conversationHistory.slice(0, turnIndex);
        this.conversationHistory.push({
            question: questionText,
            answer: 'pending',
            uploadedImages: [...(originalTurn.uploadedImages || [])],
            reasoning: ''
        });
        this.questions = [];
        this.editingTurnIndex = null;
        this.isFollowUpPending = true;
        this.currentFollowUpSource = 'revision';
        this._setFollowUpControlsDisabled(true, isReroll ? 'Rerolling...' : 'Resubmitting...');

        const currentCache = tweetCache.get(this.tweetId) || {};
        tweetCache.set(this.tweetId, {
            ...currentCache,
            qaConversationHistory: historyPrefix,
            lastAnswer: '',
            questions: [],
            timestamp: Date.now()
        });

        this._updateTooltipUI();
        const currentArticle = this.findCurrentArticleElement();
        answerFollowUpQuestion(
            this.tweetId,
            [...historyPrefix, userApiMessage],
            apiKey,
            currentArticle,
            this
        );
    }

    _performAutoScroll() {
        if (!this.tooltipScrollableContentElement || !this.autoScroll || !this.isVisible) return;

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {

                if (this.tooltipScrollableContentElement && this.autoScroll && this.isVisible) {
                    const targetScroll = this.tooltipScrollableContentElement.scrollHeight;
                    this.tooltipScrollableContentElement.scrollTo({
                        top: targetScroll,
                        behavior: 'instant'
                    });

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
        const isMobile = isMobileDevice();
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        const safeAreaHeight = viewportHeight - margin;
        const safeAreaWidth = viewportWidth - margin;

        tooltip.style.maxHeight = '';
        tooltip.style.overflowY = '';
        tooltip.style.visibility = 'hidden';
        tooltip.style.display = 'block';

        const computedStyle = window.getComputedStyle(tooltip);
        const tooltipWidth = parseFloat(computedStyle.width);
        let tooltipHeight = parseFloat(computedStyle.height);

        let left, top;
        let finalMaxHeight = '';
        let finalOverflowY = '';

        if (isMobile) {

            left = Math.max(margin, (viewportWidth - tooltipWidth) / 2);
            if (left + tooltipWidth > safeAreaWidth) {
                left = safeAreaWidth - tooltipWidth;
            }

            const maxTooltipHeight = viewportHeight * 0.8;
            if (tooltipHeight > maxTooltipHeight) {
                finalMaxHeight = `${maxTooltipHeight}px`;
                finalOverflowY = 'scroll';
                tooltipHeight = maxTooltipHeight;
            }

            top = Math.max(margin, (viewportHeight - tooltipHeight) / 2);
            if (top + tooltipHeight > safeAreaHeight) {
                top = safeAreaHeight - tooltipHeight;
            }

        } else {

            left = indicatorRect.right + margin;
            top = indicatorRect.top + (indicatorRect.height / 2) - (tooltipHeight / 2);

            if (left + tooltipWidth > safeAreaWidth) {

                left = indicatorRect.left - tooltipWidth - margin;

                if (left < margin) {

                    left = Math.max(margin, (viewportWidth - tooltipWidth) / 2);

                    if (indicatorRect.bottom + tooltipHeight + margin <= safeAreaHeight) {
                        top = indicatorRect.bottom + margin;
                    }

                    else if (indicatorRect.top - tooltipHeight - margin >= margin) {
                        top = indicatorRect.top - tooltipHeight - margin;
                    }

                    else {
                        top = margin;
                        finalMaxHeight = `${safeAreaHeight - margin}px`;
                        finalOverflowY = 'scroll';
                        tooltipHeight = safeAreaHeight - margin;
                    }
                }
            }

            if (top < margin) {
                top = margin;
            }
            if (top + tooltipHeight > safeAreaHeight) {

                if (tooltipHeight > safeAreaHeight - margin) {
                    top = margin;
                    finalMaxHeight = `${safeAreaHeight - margin}px`;
                    finalOverflowY = 'scroll';
                } else {

                    top = safeAreaHeight - tooltipHeight;
                }
            }
        }

        tooltip.style.position = 'fixed';
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
        tooltip.style.zIndex = '99999999';
        tooltip.style.maxHeight = finalMaxHeight;

        tooltip.style.overflowY = '';

        tooltip.style.display = 'flex';

        tooltip.style.visibility = 'visible';
    }

    _updateScrollButtonVisibility() {
        if (!this.tooltipScrollableContentElement || !this.scrollButton) return;
        const isStreaming = this.status === TweetRatingStatus.STREAMING;
        if (!isStreaming) {
            this.scrollButton.style.display = 'none';
            return;
        }

        const isNearBottom = this.tooltipScrollableContentElement.scrollHeight - this.tooltipScrollableContentElement.scrollTop - this.tooltipScrollableContentElement.clientHeight < (isMobileDevice() ? 40 : 55);
        this.scrollButton.style.display = isNearBottom ? 'none' : 'block';
    }

    _handleMouseEnter(event) {
        if (isMobileDevice()) return;
        this.show();
    }

    _handleMouseLeave(event) {
        if (isMobileDevice()) return;

        setTimeout(() => {

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

        if (!this.isPinned) {
            this.show();
        }
    }

    _handleTooltipMouseLeave() {

        setTimeout(() => {
            if (!this.isPinned && !(this.indicatorElement.matches(':hover') || this.tooltipElement.matches(':hover'))) {
                this.hide();
            }
        }, 100);
    }

    _handleTooltipScroll() {
        if (!this.tooltipScrollableContentElement) return;

        const isNearBottom = this.tooltipScrollableContentElement.scrollHeight - this.tooltipScrollableContentElement.scrollTop - this.tooltipScrollableContentElement.clientHeight < (isMobileDevice() ? 40 : 55);

        if (!isNearBottom) {
            if (this.autoScroll) {
                this.autoScroll = false;
                this.tooltipElement.dataset.autoScroll = 'false';
                this.userInitiatedScroll = true;
            }
        } else {

            if (this.userInitiatedScroll) {
                this.autoScroll = true;
                this.tooltipElement.dataset.autoScroll = 'true';
                this.userInitiatedScroll = false;
            }
        }
        this._updateScrollButtonVisibility();
    }

    _handlePinClick(e) {
        if (e) {
            e.stopPropagation();
        }
        if (this.isPinned) {
            this.unpin();
        } else {
            this.pin();
        }
    }

    _handleCopyClick(e) {
        if (e) {
            e.stopPropagation();
        }
        if (!this.descriptionElement || !this.reasoningTextElement || !this.copyButton) return;

        let textToCopy = this.descriptionElement.textContent || '';
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

        });
    }

    _handleReasoningToggleClick(e) {
        if (e) {
            e.stopPropagation();
        }
        if (!this.reasoningDropdown || !this.reasoningContent || !this.reasoningArrow) return;

        const scrollTop = this.tooltipScrollableContentElement?.scrollTop || 0;

        const isExpanded = this.reasoningDropdown.classList.toggle('expanded');
        this.reasoningArrow.textContent = isExpanded ? '▼' : '▶';

        if (isExpanded) {
            this.reasoningContent.style.maxHeight = '300px';
            this.reasoningContent.style.padding = '10px';
        } else {
            this.reasoningContent.style.maxHeight = '0';
            this.reasoningContent.style.padding = '0 10px';
        }

        if (isMobileDevice() && this.tooltipScrollableContentElement) {
            requestAnimationFrame(() => {
                if (this.tooltipScrollableContentElement) {
                    this.tooltipScrollableContentElement.scrollTop = scrollTop;
                }
            });
        }
    }

    _handleScrollButtonClick(e) {
        if (e) {
            e.stopPropagation();
        }
        if (!this.tooltipScrollableContentElement) return;

        this.autoScroll = true;
        this.tooltipElement.dataset.autoScroll = 'true';
        this._performAutoScroll();
        this._updateScrollButtonVisibility();
    }

    _handleFollowUpQuestionClick(event) {

        if (event && typeof event.preventDefault === 'function') {
            event.preventDefault();
        }

        const isMockEvent = event.target && event.target.dataset && event.target.dataset.questionText && typeof event.target.closest !== 'function';
        const button = isMockEvent ? event.target : event.target.closest('.follow-up-question-button');

        if (!button) return false;

        event.stopPropagation();

        const questionText = button.dataset.questionText;
        const apiKey = browserGet('openrouter-api-key', '');

        if (!questionText) {
            showStatus('Could not identify the follow-up question.', 'error');
            return false;
        }
        if (!apiKey) {
            showStatus('API key missing. Cannot answer question.', 'error');
            return false;
        }

        this.currentFollowUpSource = isMockEvent ? 'custom' : 'suggested';
        this.isFollowUpPending = true;
        this.editingTurnIndex = null;
        this._setFollowUpControlsDisabled(true, 'Asking...');

        if (!isMockEvent) {
            button.textContent = `🤔 Asking: ${questionText}...`;
        }

        this.conversationHistory.push({
            question: questionText,
            answer: 'pending',
            uploadedImages: [...this.uploadedImageDataUrls],
            reasoning: ''
        });

        const userMessageContentForHistory = [{ type: "text", text: questionText }];
        if (this.uploadedImageDataUrls && this.uploadedImageDataUrls.length > 0) {
            this.uploadedImageDataUrls.forEach(url => {
                if (url.startsWith('data:application/pdf')) {

                    const previewItem = this.followUpImageContainer?.querySelector(`[data-image-data-url="${CSS.escape(url)}"]`);
                    const fileName = previewItem?.querySelector('.follow-up-pdf-preview span:last-child')?.textContent || 'document.pdf';

                    userMessageContentForHistory.push({
                        type: "file",
                        file: {
                            filename: fileName,
                            file_data: url
                        }
                    });
                } else {

                    const modelImageUrl = stripImageUrlNameParam(url);
                    userMessageContentForHistory.push({
                        type: "image_url",
                        image_url: { "url": modelImageUrl }
                    });
                }
            });
        }
        const userApiMessage = { role: "user", content: userMessageContentForHistory };

        const historyForApiCall = [...this.qaConversationHistory, userApiMessage];

        this._clearFollowUpImage();
        this._updateTooltipUI();
        this.questions = [];
        this._updateTooltipUI();

        const currentArticle = this.findCurrentArticleElement();

        try {

            answerFollowUpQuestion(this.tweetId, historyForApiCall, apiKey, currentArticle, this);
        } finally {

        }
        return true;
    }

    _handleCustomQuestionClick(event) {

        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        if (!this.customQuestionInput || !this.customQuestionButton) return;

        const questionText = this.customQuestionInput.value.trim();
        const hasImages = this.uploadedImageDataUrls && this.uploadedImageDataUrls.length > 0;

        if (!questionText && !hasImages) {
            showStatus("Please enter a question or attach a file.", "warning");
            this.customQuestionInput.focus();
            return;
        }

        const submissionText = questionText || (hasImages ? "[file only message]" : "");

        const mockButton = {
            dataset: { questionText: submissionText },
            disabled: false,
            textContent: ''
        };

        this.followUpQuestionsElement?.querySelectorAll('.follow-up-question-button').forEach(btn => btn.disabled = true);

        const submitted = this._handleFollowUpQuestionClick({
            target: mockButton,
            stopPropagation: () => {},
            preventDefault: () => {}
        });

        if (!submitted) return;

        if (this.customQuestionInput) {
            this.customQuestionInput.value = '';

            this.customQuestionInput.style.height = 'auto';
            this.customQuestionInput.rows = 1;
        }
    }

    async _handleFollowUpImageSelect(event) {
        if (event) {
            event.preventDefault();
        }

        const files = event?.target?.files;
        if (!files || files.length === 0) return;

        await this._processFollowUpFiles(Array.from(files));
        event.target.value = null;
    }

    async _handleQuestionPaste(event) {
        const imageFiles = Array.from(event.clipboardData?.items || [])
            .filter(item => item.kind === 'file' && item.type.startsWith('image/'))
            .map(item => item.getAsFile())
            .filter(Boolean);
        if (imageFiles.length === 0) return;

        if (!this.followUpImageContainer || !this.attachImageButton) {
            showStatus('The selected model does not support pasted images.', 'warning');
            return;
        }

        event.preventDefault();
        await this._processFollowUpFiles(imageFiles);
    }

    async _processFollowUpFiles(files) {
        if (!files || files.length === 0 || this.isFollowUpPending) return;

        if (this.followUpImageContainer && files.length > 0) {
            this.followUpImageContainer.style.display = 'flex';
        }

        // Disable Ask button while processing files
        if (this.customQuestionButton) {
            this.customQuestionButton.disabled = true;
            this.customQuestionButton.textContent = 'Processing files...';
        }

        const filePromises = Array.from(files).map(file => {
            if (file && file.type.startsWith('image/')) {
                return resizeImage(file, 1024)
                    .then(resizedDataUrl => {
                        this.uploadedImageDataUrls.push(resizedDataUrl);
                        this._addPreviewToContainer(resizedDataUrl, 'image');
                    })
                    .catch(error => {
                        console.error("Error resizing image:", error);
                        showStatus(`Could not process image ${file.name}: ${error.message}`, "error");
                    });
            } else if (file && file.type === 'application/pdf') {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const dataUrl = e.target.result;
                        this.uploadedImageDataUrls.push(dataUrl);
                        this._addPreviewToContainer(dataUrl, 'pdf', file.name);
                        resolve();
                    };
                    reader.onerror = (error) => {
                        console.error("Error reading PDF:", error);
                        showStatus(`Could not process PDF ${file.name}: ${error.message}`, "error");
                        reject(error);
                    };
                    reader.readAsDataURL(file);
                });
            } else if (file) {
                showStatus(`Skipping unsupported file type: ${file.name}`, "warning");
                return Promise.resolve();
            }
            return Promise.resolve();
        });

        // Wait for all files to be processed
        await Promise.allSettled(filePromises);

        // Re-enable Ask button
        if (this.customQuestionButton) {
            this.customQuestionButton.disabled = false;
            this.customQuestionButton.textContent = 'Ask';
        }
    }

    _addPreviewToContainer(dataUrl, fileType = 'image', fileName = '') {
        if (!this.followUpImageContainer) return;

        const previewItem = document.createElement('div');
        previewItem.className = 'follow-up-image-preview-item';
        previewItem.dataset.imageDataUrl = dataUrl;

        if (fileType === 'pdf') {

            const pdfIcon = document.createElement('div');
            pdfIcon.className = 'follow-up-pdf-preview';
            pdfIcon.innerHTML = `<span style="font-size: 24px;">📄</span><br><span style="font-size: 11px; word-break: break-all;">${escapeTooltipHtml(fileName || 'PDF')}</span>`;
            pdfIcon.style.textAlign = 'center';
            pdfIcon.style.padding = '8px';
            pdfIcon.style.width = '60px';
            pdfIcon.style.height = '60px';
            pdfIcon.style.display = 'flex';
            pdfIcon.style.flexDirection = 'column';
            pdfIcon.style.justifyContent = 'center';
            pdfIcon.style.alignItems = 'center';
            previewItem.appendChild(pdfIcon);
        } else {

            const img = document.createElement('img');
            img.src = dataUrl;
            img.className = 'follow-up-image-preview-thumbnail';
            previewItem.appendChild(img);
        }

        const removeBtn = document.createElement('button');
        removeBtn.textContent = '×';
        removeBtn.className = 'follow-up-image-remove-btn';
        removeBtn.title = 'Remove this file';
        removeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this._removeSpecificUploadedImage(dataUrl);
        });

        previewItem.appendChild(removeBtn);
        this.followUpImageContainer.appendChild(previewItem);
    }

    _removeSpecificUploadedImage(imageDataUrl) {
        this.uploadedImageDataUrls = this.uploadedImageDataUrls.filter(url => url !== imageDataUrl);

        if (this.followUpImageContainer) {
            const previewItemToRemove = this.followUpImageContainer.querySelector(`div.follow-up-image-preview-item[data-image-data-url="${CSS.escape(imageDataUrl)}"]`);
            if (previewItemToRemove) {
                previewItemToRemove.remove();
                }

            if (this.uploadedImageDataUrls.length === 0) {
                this.followUpImageContainer.style.display = 'none';
            }
        }
    }

    _clearFollowUpImage() {
        this.uploadedImageDataUrls = [];
        if (this.followUpImageContainer) {
            this.followUpImageContainer.innerHTML = '';
            this.followUpImageContainer.style.display = 'none';
        }
        if (this.followUpImageInput) {
            this.followUpImageInput.value = null;
        }
    }

    _setFollowUpControlsDisabled(disabled, buttonText = 'Ask') {
        this.followUpQuestionsElement?.querySelectorAll('.follow-up-question-button').forEach(button => {
            button.disabled = disabled;
        });
        if (this.customQuestionInput) this.customQuestionInput.disabled = disabled;
        if (this.customQuestionButton) {
            this.customQuestionButton.disabled = disabled;
            this.customQuestionButton.textContent = disabled ? buttonText : 'Ask';
        }
        if (this.attachImageButton) this.attachImageButton.disabled = disabled;
    }

    _finalizeFollowUpInteraction() {
        this.isFollowUpPending = false;
        this._setFollowUpControlsDisabled(false);
        this.currentFollowUpSource = null;
        this._updateTooltipUI();
    }

    /** Public wrapper for indicator refresh. */
    refreshIndicatorUI() {
        this._updateIndicatorUI();
    }

    /** Public wrapper for tooltip refresh. */
    refreshTooltipUI() {
        this._updateTooltipUI();
    }

    /**
     * Updates blacklist UI state without exposing internal rendering methods.
     * @param {boolean} isBlacklisted
     */
    setAuthorBlacklistState(isBlacklisted) {
        this.isAuthorBlacklisted = Boolean(isBlacklisted);
    }

    /**
     * Sets follow-up question list while preserving internal state ownership.
     * @param {string[]} questions
     */
    setFollowUpQuestions(questions) {
        this.questions = Array.isArray(questions) ? questions : [];
    }

    /**
     * Public wrapper used by streaming follow-up handlers.
     * @param {string} question
     * @param {string} answer
     * @param {string} [reasoning='']
     */
    updateConversationHistoryEntry(question, answer, reasoning = '') {
        this._updateConversationHistory(question, answer, reasoning);
    }

    /**
     * Public wrapper used by streaming follow-up handlers.
     * @param {string} streamingText
     * @param {string} [reasoningText='']
     */
    renderStreamingAnswer(streamingText, reasoningText = '') {
        this._renderStreamingAnswer(streamingText, reasoningText);
    }

    /** Public wrapper to finalize follow-up UI state. */
    finalizeFollowUpInteraction() {
        this._finalizeFollowUpInteraction();
    }

    /**
     * Finds a pending entry in the conversation history by question text and updates its answer.
     * Also updates the UI.
     * @param {string} question - The text of the question that was asked.
     * @param {string} answer - The new answer (or error message).
     * @param {string} [reasoning=''] - Optional reasoning text associated with the answer.
     */
    _updateConversationHistory(question, answer, reasoning = '') {
        const entryIndex = this.conversationHistory.findIndex(turn => turn.question === question && turn.answer === 'pending');
        if (entryIndex !== -1) {
            this.conversationHistory[entryIndex].answer = answer;
            this.conversationHistory[entryIndex].reasoning = reasoning;
            this._updateTooltipUI();
        } else {
            console.warn(`[ScoreIndicator ${this.tweetId}] Could not find pending history entry for question: "${question}"`);

        }
    }

    /**
     * Updates the visual display of the last answer element during streaming
     * without changing the underlying conversationHistory state.
     * @param {string} streamingText - The current aggregated text from the stream.
     * @param {string} [reasoningText=''] - Optional reasoning text from the stream.
     */
    _renderStreamingAnswer(streamingText, reasoningText = '') {
        if (!this.conversationContainerElement) return;

        const conversationTurns = this.conversationContainerElement.querySelectorAll('.conversation-turn');
        const lastTurnElement = conversationTurns.length > 0 ? conversationTurns[conversationTurns.length - 1] : null;

        if (!lastTurnElement) {
            console.warn(`[ScoreIndicator ${this.tweetId}] Could not find last conversation turn to render streaming answer.`);
            return;
        }

        const lastHistoryEntry = this.conversationHistory.length > 0 ? this.conversationHistory[this.conversationHistory.length -1] : null;
        if (!(lastHistoryEntry && lastHistoryEntry.answer === 'pending')) {
            console.warn(`[ScoreIndicator ${this.tweetId}] Attempted to render streaming answer, but last history entry is not pending.`);
            return;
        }

        let streamingReasoningContainer = lastTurnElement.querySelector('.streaming-reasoning-container');
        const hasReasoning = reasoningText && reasoningText.trim() !== '';

        if (hasReasoning && !streamingReasoningContainer) {

            streamingReasoningContainer = document.createElement('div');
            streamingReasoningContainer.className = 'streaming-reasoning-container active';
            streamingReasoningContainer.style.display = 'block';

            const streamingReasoningText = document.createElement('div');
            streamingReasoningText.className = 'streaming-reasoning-text';
            streamingReasoningContainer.appendChild(streamingReasoningText);

            const answerElement = lastTurnElement.querySelector('.conversation-answer');
            if (answerElement) {
                const answerRow = answerElement.closest('.conversation-answer-row');
                lastTurnElement.insertBefore(streamingReasoningContainer, answerRow || answerElement);
            } else {
                lastTurnElement.appendChild(streamingReasoningContainer);
            }
        }

        if (streamingReasoningContainer && hasReasoning) {
            const streamingTextElement = streamingReasoningContainer.querySelector('.streaming-reasoning-text');
            if (streamingTextElement) {

                const maxDisplayLength = 200;
                let displayText = reasoningText;
                if (reasoningText.length > maxDisplayLength) {
                    displayText = reasoningText.slice(-maxDisplayLength);
                }
                streamingTextElement.textContent = displayText;
            }
        }

        let reasoningDropdown = lastTurnElement.querySelector('.reasoning-dropdown');
        if (reasoningDropdown) {

            reasoningDropdown.style.display = 'none';
        }

        const lastAnswerElement = lastTurnElement.querySelector('.conversation-answer');
        if (lastAnswerElement) {

            const streamingResponse = extractStreamingResponse(streamingText);
            const formattedStreamingAnswer = renderTooltipMarkdown(
                streamingResponse.text || '*Waiting for response...*'
            );

            lastAnswerElement.innerHTML = `<strong>AI:</strong> ${formattedStreamingAnswer}<em class="pending-cursor">|</em>`;
        } else {
             console.warn(`[ScoreIndicator ${this.tweetId}] Could not find answer element in last conversation turn.`);
        }

        if (this.autoScroll) {
            this._performAutoScroll();
        }

        this._performConversationAutoScroll();
    }

    /**
     * Updates the indicator's state and refreshes the UI.
     * @param {object} options
     * @param {string} [options.status] - New status ('pending', 'streaming', 'rated', 'error', 'cached', 'blacklisted').
     * @param {number|null} [options.score] - New score.
     * @param {string} [options.description] - New description text.
     * @param {string} [options.reasoning] - New reasoning text.
     * @param {object|null} [options.metadata] - New metadata object.
     * @param {string[]} [options.questions] - New follow-up questions.
     */
    update({ status, score = null, description = '', reasoning = '', metadata = null, questions = undefined }) {

        const statusChanged = status !== undefined && this.status !== status;
        const scoreChanged = score !== null && this.score !== score;
        const descriptionChanged = description !== '' && this.description !== description;
        const reasoningChanged = reasoning !== '' && this.reasoning !== reasoning;
        const metadataChanged = metadata !== null && JSON.stringify(this.metadata) !== JSON.stringify(metadata);
        const questionsChanged = questions !== undefined && JSON.stringify(this.questions) !== JSON.stringify(questions);

        if (!statusChanged && !scoreChanged && !descriptionChanged && !reasoningChanged && !metadataChanged && !questionsChanged) {

            return;
        }

        if (statusChanged) this.status = status;

        if (scoreChanged || statusChanged) {
            this.score = (this.status === TweetRatingStatus.PENDING || this.status === TweetRatingStatus.ERROR) ? score :
                (this.status === TweetRatingStatus.STREAMING && score === null) ? this.score :
                    score;
        }
        if (descriptionChanged) this.description = description;
        if (reasoningChanged) this.reasoning = reasoning;
        if (metadataChanged) this.metadata = metadata;
        if (questionsChanged) this.questions = questions;

        if (statusChanged) {
            const shouldAutoScroll = (this.status === TweetRatingStatus.PENDING || this.status === TweetRatingStatus.STREAMING);
            if (this.autoScroll !== shouldAutoScroll) {
                this.autoScroll = shouldAutoScroll;

                if (this.tooltipElement) {
                    this.tooltipElement.dataset.autoScroll = this.autoScroll ? 'true' : 'false';
                }
            }
        }

        if (statusChanged || scoreChanged) {
            this._updateIndicatorUI();
        }

        if (descriptionChanged || reasoningChanged || statusChanged || metadataChanged || questionsChanged) {
            this._updateTooltipUI();
        } else {

            this._updateScrollButtonVisibility();
        }
    }

    /** Shows the tooltip and positions it correctly. */
    show() {
        if (!this.tooltipElement) return;

        this.isVisible = true;
        this.tooltipElement.style.display = 'flex';
        this._setPosition();

        if (this.autoScroll && (this.status === TweetRatingStatus.STREAMING || this.status === TweetRatingStatus.PENDING)) {
            this._performAutoScroll();
        }

        this._updateScrollButtonVisibility();
    }

    /** Hides the tooltip unless it's pinned. */
    hide() {
        if (!this.isPinned && this.tooltipElement) {

            this.isVisible = false;
            this.tooltipElement.style.display = 'none';
        }
    }

    /** Toggles the tooltip's visibility. */
    toggle() {
        if (this.isVisible && !this.isPinned) {
            this.hide();
        } else {

            this.show();
        }
    }

    /** Pins the tooltip open. */
    pin() {
        if (!this.tooltipElement || !this.pinButton) return;

        this.isPinned = true;
        this.tooltipElement.classList.add('pinned');
        this.pinButton.innerHTML = '📍';
        this.pinButton.title = 'Unpin tooltip';
        this.pinButton.setAttribute('aria-label', 'Unpin score details');

    }

    /** Unpins the tooltip, allowing it to be hidden automatically. */
    unpin() {
        if (!this.tooltipElement || !this.pinButton) return;

        this.isPinned = false;
        this.tooltipElement.classList.remove('pinned');
        this.pinButton.innerHTML = '📌';
        this.pinButton.title = 'Pin tooltip (prevents auto-closing)';
        this.pinButton.setAttribute('aria-label', 'Pin score details');

        setTimeout(() => {
            if (this.tooltipElement && !this.tooltipElement.matches(':hover') &&
                this.indicatorElement && !this.indicatorElement.matches(':hover')) {
                this.hide();
            }
        }, 0);
    }

    _handleCloseClick(e) {
        if (e) {
            e.stopPropagation();
        }
        this.hide();
    }

    /** Removes the indicator, tooltip, and listeners from the DOM and registry. */
    destroy() {

        if (window.activeStreamingRequests && window.activeStreamingRequests[this.tweetId]) {
            console.log(`Cleaning up active streaming request for tweet ${this.tweetId}`);
            window.activeStreamingRequests[this.tweetId].abort();
            delete window.activeStreamingRequests[this.tweetId];
        }

        this._removeRegisteredListeners();

        this.indicatorElement?.remove();
        this.tooltipElement?.remove();

        ScoreIndicatorRegistry.remove(this.tweetId);

        const currentArticle = this.findCurrentArticleElement();
        if (currentArticle) {
            delete currentArticle.dataset.hasScoreIndicator;

        }

        this.tweetArticle = null;
        this.indicatorElement = null;
        this.tooltipElement = null;
        this.pinButton = null;
        this.copyButton = null;
        this.tooltipCloseButton = null;
        this.reasoningToggle = null;
        this.scrollButton = null;
        this.conversationContainerElement = null;
        this.followUpQuestionsElement = null;
        this.customQuestionContainer = null;
        this.customQuestionInput = null;
        this.customQuestionButton = null;

        this.followUpImageContainer = null;
        this.followUpImageInput = null;
        this.uploadedImageDataUrls = [];
        this.refreshButton = null;
        this.rateButton = null;

        this.metadataDropdown = null;
        this.metadataToggle = null;
        this.metadataArrow = null;
        this.metadataContent = null;

        this.tooltipScrollableContentElement = null;
        this._boundMethodHandlers = Object.create(null);
        this._listenerTeardowns = [];
    }

    /** Ensures the indicator element is attached to the correct current article element. */
    ensureIndicatorAttached() {
        if (!this.indicatorElement) return false;
        const currentArticle = this.findCurrentArticleElement();
        if (!currentArticle) return false;

        this.tweetArticle = currentArticle;
        if (!this._attachIndicatorToMetadataRow(currentArticle) && this.indicatorElement.parentElement !== currentArticle) {
            currentArticle.appendChild(this.indicatorElement);
        }
        return true;
    }

    /** Finds the current DOM element for the tweet article based on tweetId. */
    findCurrentArticleElement() {
        const timeline = document.querySelector('main') || document.querySelector('div[data-testid="primaryColumn"]');
        if (!timeline) return null;
        const linkSelector = `a[href*="/status/${this.tweetId}"]`;
        const linkElement = timeline.querySelector(linkSelector);
        const article = linkElement?.closest('article[data-testid="tweet"]');
        if (article && getTweetID(article) === this.tweetId) {
            return article;
        }
        for (const art of timeline.querySelectorAll('article[data-testid="tweet"]')) {
            if (getTweetID(art) === this.tweetId) return art;
        }
        return null;
    }

    /**
     * Updates the indicator's state after an initial review and builds the conversation history.
     * @param {object} params
     * @param {string} params.fullContext - The full text context of the tweet.
     * @param {string[]} params.mediaUrls - Array of media URLs from the tweet.
     * @param {string} params.apiResponseContent - The raw content from the API response.
     * @param {string} params.reviewSystemPrompt - The system prompt used for the initial review.
     * @param {string} params.followUpSystemPrompt - The system prompt to be used for follow-ups.
     * @param {string} [params.userInstructions] - The user's custom instructions for rating tweets.
     */
    updateInitialReviewAndBuildHistory({ fullContext, mediaUrls, apiResponseContent, reviewSystemPrompt, followUpSystemPrompt, userInstructions = '' }) {
        const parsedResponse = parseTweetFilterResponse(apiResponseContent);

        this.score = parsedResponse.score;
        this.description = parsedResponse.response || apiResponseContent;
        this.questions = parsedResponse.questions;
        this.status = this.score !== null ? 'rated' : 'error';

        const userMessageContent = [{ type: "text", text: fullContext }];
        if (typeof collectRatingImageUrls === 'function' && typeof appendRatingMediaContent === 'function' && modelSupportsImages(selectedModel)) {
            appendRatingMediaContent(userMessageContent, collectRatingImageUrls(mediaUrls, fullContext));
        }

        const followUpSystemPromptWithInstructions = followUpSystemPrompt.replace(
            '{USER_INSTRUCTIONS_PLACEHOLDER}',
            userInstructions || 'Rate the tweet on a scale from 1 to 10 based on its clarity, insight, creativity, and overall quality.'
        );

        this.qaConversationHistory = [
            { role: "system", content: [{ type: "text", text: followUpSystemPromptWithInstructions }] },
            { role: "user", content: userMessageContent },
            { role: "assistant", content: [{ type: "text", text: apiResponseContent }] }
        ];

        this._updateIndicatorUI();
        this._updateTooltipUI();
    }

    /**
     * Updates the indicator's state after a follow-up question has been answered.
     * @param {object} params
     * @param {string} params.assistantResponseContent - The raw content of the AI's response.
     * @param {object[]} params.updatedQaHistory - The fully updated qaConversationHistory array.
     */
    updateAfterFollowUp({ assistantResponseContent, updatedQaHistory }) {
        this.qaConversationHistory = updatedQaHistory;

        const parsedResponse = parseTweetFilterResponse(assistantResponseContent);
        const answerText = parsedResponse.response || assistantResponseContent;

        this.questions = parsedResponse.questions;

        if (this.conversationHistory.length > 0) {
            const lastTurn = this.conversationHistory[this.conversationHistory.length - 1];
            if (lastTurn.answer === 'pending') {
                lastTurn.answer = answerText;

            }
        }

        this._syncConversationHistoryApiIndices();

        this._convertStreamingToDropdown();

        this._updateTooltipUI();
    }

    /**
     * Converts the streaming reasoning container to a proper reasoning dropdown after streaming completes.
     * @private
     */
    _convertStreamingToDropdown() {
        if (!this.conversationContainerElement) return;

        const conversationTurns = this.conversationContainerElement.querySelectorAll('.conversation-turn');
        const lastTurnElement = conversationTurns.length > 0 ? conversationTurns[conversationTurns.length - 1] : null;

        if (!lastTurnElement) return;

        const streamingContainer = lastTurnElement.querySelector('.streaming-reasoning-container');
        if (streamingContainer) {
            streamingContainer.remove();
        }

        const lastHistoryEntry = this.conversationHistory.length > 0 ? this.conversationHistory[this.conversationHistory.length - 1] : null;
        if (!lastHistoryEntry || !lastHistoryEntry.reasoning || lastHistoryEntry.reasoning.trim() === '') {
            return;
        }

        let reasoningDropdown = lastTurnElement.querySelector('.reasoning-dropdown');
        if (!reasoningDropdown) {
            reasoningDropdown = document.createElement('div');
            reasoningDropdown.className = 'reasoning-dropdown conversation-reasoning';

            const reasoningToggle = document.createElement('div');
            reasoningToggle.className = 'reasoning-toggle';

            const reasoningArrow = document.createElement('span');
            reasoningArrow.className = 'reasoning-arrow';
            reasoningArrow.textContent = '▶';

            reasoningToggle.appendChild(reasoningArrow);
            reasoningToggle.appendChild(document.createTextNode(' Show Reasoning Trace'));

            const reasoningContent = document.createElement('div');
            reasoningContent.className = 'reasoning-content';
            const reasoningTextElement = document.createElement('div');
            reasoningTextElement.className = 'reasoning-text';
            reasoningContent.appendChild(reasoningTextElement);

            reasoningDropdown.appendChild(reasoningToggle);
            reasoningDropdown.appendChild(reasoningContent);

            const answerElement = lastTurnElement.querySelector('.conversation-answer');
            if (answerElement) {
                lastTurnElement.insertBefore(reasoningDropdown, answerElement);
            } else {
                lastTurnElement.appendChild(reasoningDropdown);
            }

            reasoningToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                const dropdown = e.target.closest('.reasoning-dropdown');
                const content = dropdown?.querySelector('.reasoning-content');
                const arrow = dropdown?.querySelector('.reasoning-arrow');
                if (!dropdown || !content || !arrow) return;

                const isExpanded = dropdown.classList.toggle('expanded');
                arrow.textContent = isExpanded ? '▼' : '▶';
                content.style.maxHeight = isExpanded ? '200px' : '0';
                content.style.padding = isExpanded ? '8px' : '0 8px';
            });
        }

        const reasoningTextElement = reasoningDropdown.querySelector('.reasoning-text');
        if (reasoningTextElement) {
            const formattedReasoning = formatTooltipDescription("", lastHistoryEntry.reasoning).reasoning;
            reasoningTextElement.innerHTML = formattedReasoning;
        }

        reasoningDropdown.style.display = 'block';
    }

    /**
     * Rehydrates the ScoreIndicator instance from cached data.
     * @param {object} cachedData - The cached data object.
     */
    rehydrateFromCache(cachedData) {
        this.score = cachedData.score;
        this.description = cachedData.description;
        this.reasoning = cachedData.reasoning;
        this.questions = cachedData.questions || [];
        this.status = cachedData.status || (cachedData.score !== null ? (cachedData.fromStorage ? 'cached' : 'rated') : 'error');
        this.metadata = cachedData.metadata || null;
        this.qaConversationHistory = cachedData.qaConversationHistory || [];
        this.isPinned = cachedData.isPinned || false;

        this.conversationHistory = [];
        if (this.qaConversationHistory.length > 0) {
            let currentQuestion = null;
            let currentUploadedImages = [];

            const initialAssistantText = this.qaConversationHistory[2]?.role === 'assistant'
                ? this.qaConversationHistory[2].content?.find(item => item.type === 'text')?.text || ''
                : '';
            const hasInitialRating = this.qaConversationHistory[1]?.role === 'user' &&
                this.qaConversationHistory[2]?.role === 'assistant' &&
                parseTweetFilterResponse(initialAssistantText).hasScore;
            const startIndex = hasInitialRating ? 3 : 1;

            for (let i = startIndex; i < this.qaConversationHistory.length; i++) {
                const message = this.qaConversationHistory[i];
                if (message.role === 'user') {

                    const textContent = message.content.find(c => c.type === 'text');
                    const storedQuestion = textContent ? textContent.text : "[Question not found]";
                    const questionMarker = '\n\nQuestion:\n';
                    const questionMarkerIndex = storedQuestion.lastIndexOf(questionMarker);
                    currentQuestion = questionMarkerIndex === -1
                        ? storedQuestion
                        : storedQuestion.slice(questionMarkerIndex + questionMarker.length).trim();

                    currentUploadedImages = message.content
                        .filter(c => c.type === 'image_url' && c.image_url && c.image_url.url.startsWith('data:image'))
                        .map(c => c.image_url.url);
                    currentUploadedImages.push(...message.content
                        .filter(c => c.type === 'file' && c.file?.file_data?.startsWith('data:application/pdf'))
                        .map(c => c.file.file_data));

                } else if (message.role === 'assistant' && currentQuestion) {
                    const assistantTextContent = message.content.find(c => c.type === 'text');
                    const assistantAnswer = assistantTextContent ? assistantTextContent.text : "[Answer not found]";

                    const parsedAnswer = parseTweetFilterResponse(assistantAnswer);
                    const uiAnswer = parsedAnswer.response || assistantAnswer;

                    this.conversationHistory.push({
                        question: currentQuestion,
                        answer: uiAnswer,
                        uploadedImages: currentUploadedImages,
                        reasoning: ''
                    });
                    currentQuestion = null;
                    currentUploadedImages = [];
                }
            }
        }

        this._syncConversationHistoryApiIndices();

        if (this.isPinned) {
            this.pinButton.innerHTML = '📍';
            this.pinButton.setAttribute('aria-label', 'Unpin score details');
            this.tooltipElement?.classList.add('pinned');
        } else {
            this.pinButton.innerHTML = '📌';
            this.pinButton.setAttribute('aria-label', 'Pin score details');
            this.tooltipElement?.classList.remove('pinned');
        }

        this._updateIndicatorUI();
        this._updateTooltipUI();
    }

    _handleMetadataToggleClick(e) {
        if (e) {
            e.stopPropagation();
        }
        if (!this.metadataDropdown || !this.metadataContent || !this.metadataArrow) return;

        const scrollTop = this.tooltipScrollableContentElement?.scrollTop || 0;

        const isExpanded = this.metadataDropdown.classList.toggle('expanded');
        this.metadataArrow.textContent = isExpanded ? '▼' : '▶';

        if (isExpanded) {
            this.metadataContent.style.maxHeight = '300px';
            this.metadataContent.style.padding = '10px';
        } else {
            this.metadataContent.style.maxHeight = '0';
            this.metadataContent.style.padding = '0 10px';
        }

        if (isMobileDevice() && this.tooltipScrollableContentElement) {
            requestAnimationFrame(() => {
                if (this.tooltipScrollableContentElement) {
                    this.tooltipScrollableContentElement.scrollTop = scrollTop;
                }
            });
        }
    }

    _handleRefreshClick(e) {
        e && e.stopPropagation();

        if (!this.tweetId) return;

        if (window.activeStreamingRequests && window.activeStreamingRequests[this.tweetId]) {
            window.activeStreamingRequests[this.tweetId].abort();
            delete window.activeStreamingRequests[this.tweetId];
        }

        if (tweetCache.has(this.tweetId)) {
            tweetCache.delete(this.tweetId);
        }

        tweetProcessingState.clear(this.tweetId);

        const currentArticle = this.findCurrentArticleElement();
        this.destroy();

        if (currentArticle && typeof scheduleTweetProcessing === 'function') {
            scheduleTweetProcessing(currentArticle);
        }
    }

    _handleRateClick(e) {
        e && e.stopPropagation();

        if (!this.tweetId) return;

        this.update({
            status: TweetRatingStatus.PENDING,
            score: null,
            description: 'Rating tweet...',
            reasoning: '',
            questions: []
        });

        const currentArticle = this.findCurrentArticleElement();
        if (currentArticle && typeof scheduleTweetProcessing === 'function') {

            tweetProcessingState.clear(this.tweetId);
            scheduleTweetProcessing(currentArticle, true);
        }
    }

    /**
     * Handle scroll events in the conversation history area for granular auto-scroll.
     */
    _handleConversationScroll() {
        if (!this.conversationContainerElement) return;
        const isNearBottom = this.conversationContainerElement.scrollHeight - this.conversationContainerElement.scrollTop - this.conversationContainerElement.clientHeight < 40;
        if (!isNearBottom) {
            if (this.autoScrollConversation) {
                this.autoScrollConversation = false;
            }
        } else {
            if (!this.autoScrollConversation) {
                this.autoScrollConversation = true;
            }
        }
    }

    /**
     * Auto-scroll the conversation history area to the bottom if allowed.
     */
    _performConversationAutoScroll() {
        if (!this.conversationContainerElement || !this.autoScrollConversation) return;
        requestAnimationFrame(() => {
            this.conversationContainerElement.scrollTo({
                top: this.conversationContainerElement.scrollHeight,
                behavior: 'instant'
            });
        });
    }
}

const ScoreIndicatorRegistry = {
    managers: new Map(),

    /**
     * Gets an existing manager or creates a new one.
     * Ensures only one manager exists per tweetId.
     * @param {string} tweetId
     * @param {Element} [tweetArticle=null] - Required if creating a new instance.
     * @returns {ScoreIndicator | null}
     */
    get(tweetId, tweetArticle = null) {
        if (!tweetId) {
            console.error("[Registry] Attempted to get instance with invalid tweetId:", tweetId);
            return null;
        }

        if (this.managers.has(tweetId)) {
            const existingManager = this.managers.get(tweetId);

            return existingManager;
        } else if (tweetArticle) {
            try {

                const existingIndicator = tweetArticle.querySelector(`.score-indicator[data-tweet-id="${tweetId}"]`);
                const existingTooltip = document.querySelector(`.score-description[data-tweet-id="${tweetId}"]`);

                if (existingIndicator || existingTooltip) {
                    console.warn(`[Registry] Found existing indicator/tooltip elements for tweet ${tweetId} outside registry. Removing them before creating new manager.`);
                    existingIndicator?.remove();
                    existingTooltip?.remove();
                }

                return new ScoreIndicator(tweetArticle);
            } catch (e) {
                console.error(`[Registry] Error creating ScoreIndicator for ${tweetId}:`, e);
                return null;
            }
        }

        return null;
    },

    /**
     * Adds an instance to the registry (called by constructor).
     * @param {string} tweetId
     * @param {ScoreIndicator} instance
     */
    add(tweetId, instance) {
        if (this.managers.has(tweetId)) {
            console.warn(`[Registry] Overwriting existing manager for tweet ${tweetId}. This may indicate an issue.`);

        }
        this.managers.set(tweetId, instance);

    },

    /**
     * Removes an instance from the registry (called by destroy method).
     * @param {string} tweetId
     */
    remove(tweetId) {
        if (this.managers.has(tweetId)) {
            this.managers.delete(tweetId);
        }
    },

    /**
     * Cleans up managers whose corresponding tweet articles are no longer in the main timeline DOM.
     */
    cleanupOrphaned() {
        let removedCount = 0;
        const observedTimeline = document.querySelector('main') || document.querySelector('div[data-testid="primaryColumn"]');

        if (!observedTimeline) return;

        const visibleTweetIds = new Set();
        observedTimeline.querySelectorAll('article[data-testid="tweet"]').forEach(article => {
            const id = getTweetID(article);
            if (id) visibleTweetIds.add(id);
        });

        for (const [tweetId, manager] of this.managers.entries()) {
            const isConnected = manager.indicatorElement?.isConnected;
            const isVisible = visibleTweetIds.has(tweetId);
            if (!isConnected || !isVisible) {
                manager.destroy();
                removedCount++;
            }
        }
    },

    /**
     * Destroys all managed indicators. Useful for full cleanup on script unload/major UI reset.
     */
    destroyAll() {
        console.log(`[Registry] Destroying all ${this.managers.size} indicators.`);

        [...this.managers.values()].forEach(manager => manager.destroy());
        this.managers.clear();
    }
};

function formatTooltipDescription(description = "", reasoning = "") {
    const descriptionText = description || '*waiting for content...*';
    const reasoningText = reasoning && reasoning.trim()
        ? reasoning.replace(/\\n/g, '\n')
        : '';
    return {
        description: renderTooltipMarkdown(descriptionText),
        reasoning: reasoningText ? renderTooltipMarkdown(reasoningText) : ''
    };
}
