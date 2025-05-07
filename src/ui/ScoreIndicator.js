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
        // Ensure getTweetID is available globally due to Tampermonkey concatenation
        this.tweetId = getTweetID(this.tweetArticle);

        this.indicatorElement = null;
        this.tooltipElement = null;

        // Tooltip sub-elements (cache references during creation)
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
        this.metadataElement = null; // Add element for metadata
        this.conversationContainerElement = null; // Container for Q&A history
        this.followUpQuestionsElement = null; // Element for follow-up questions
        this.customQuestionContainer = null; // Container for custom question input/button
        this.customQuestionInput = null;
        this.customQuestionButton = null;
        this.attachImageButton = null; // Moved here

        // --- New: Image Upload Elements for Follow-up ---
        this.followUpImageContainer = null; // This will hold preview and remove button
        this.followUpImageInput = null;
        this.followUpImagePreview = null;
        this.followUpRemoveImageButton = null;
        this.uploadedImageDataUrls = []; // Changed from single string to array
        // --- End New ---

        this.status = 'pending'; // Initial status
        this.score = null;
        this.description = '';
        this.reasoning = '';
        this.metadata = null; // Add property to store metadata
        this.conversationHistory = []; // Array to store { question, answer } pairs
        this.questions = []; // Add property to store follow-up questions
        this.isPinned = false;
        this.isVisible = false;
        this.autoScroll = true; // Default to true for pending/streaming
        this.userInitiatedScroll = false; // Track user scroll interaction
        this.uploadedImageDataUrls = []; // Initialize
        this.qaConversationHistory = []; // Stores the full conversation history for API calls

        try {
            this._createElements(tweetArticle);
            this._addEventListeners();
            // Add to registry
            ScoreIndicatorRegistry.add(this.tweetId, this);
            // Set initial dataset attributes on the initial article
            this.updateDatasetAttributes(tweetArticle);
        } catch (error) {
            console.error(`[ScoreIndicator ${this.tweetId}] Failed initialization:`, error);
            // Attempt cleanup if elements were partially created
            this.destroy();
            throw error; // Re-throw error after cleanup attempt
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

        // --- New Close Button ---
        this.tooltipCloseButton = document.createElement('button');
        this.tooltipCloseButton.className = 'close-button tooltip-close-button'; // Reuse existing style + add specific class
        this.tooltipCloseButton.innerHTML = '×';
        this.tooltipCloseButton.title = 'Close tooltip';
        // --- End New Close Button ---

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
        this.tooltipControls.appendChild(this.tooltipCloseButton); // Add the close button to controls
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
        this.descriptionElement = document.createElement('div');
        this.descriptionElement.className = 'description-text';
        this.tooltipElement.appendChild(this.descriptionElement);

        // --- Score Text Area (from description) ---
        this.scoreTextElement = document.createElement('div');
        this.scoreTextElement.className = 'score-text-from-description';
        this.scoreTextElement.style.display = 'none'; // Hide initially
        this.tooltipElement.appendChild(this.scoreTextElement);

        // --- Follow-Up Questions Text Area (from description, hidden) ---
        this.followUpQuestionsTextElement = document.createElement('div');
        this.followUpQuestionsTextElement.className = 'follow-up-questions-text-from-description';
        this.followUpQuestionsTextElement.style.display = 'none'; // Always hidden
        this.tooltipElement.appendChild(this.followUpQuestionsTextElement);

        // --- Conversation History Area ---
        this.conversationContainerElement = document.createElement('div');
        this.conversationContainerElement.className = 'tooltip-conversation-history';
        this.tooltipElement.appendChild(this.conversationContainerElement);

        // --- Follow-Up Questions Area ---
        this.followUpQuestionsElement = document.createElement('div');
        this.followUpQuestionsElement.className = 'tooltip-follow-up-questions';
        this.followUpQuestionsElement.style.display = 'none'; // Hide initially
        this.tooltipElement.appendChild(this.followUpQuestionsElement);

        // --- Custom Question Area ---
        this.customQuestionContainer = document.createElement('div');
        this.customQuestionContainer.className = 'tooltip-custom-question-container';

        this.customQuestionInput = document.createElement('textarea');
        this.customQuestionInput.placeholder = 'Ask your own question...';
        this.customQuestionInput.className = 'tooltip-custom-question-input';
        this.customQuestionInput.rows = 1; // Start with a single row

        // Add event listener for dynamic height adjustment
        this.customQuestionInput.addEventListener('input', function() {
            this.style.height = 'auto'; // Reset height to recalculate
            this.style.height = (this.scrollHeight) + 'px'; // Set to scroll height
            // Optionally, adjust rows attribute if preferred, but direct height is often smoother
            // const computedStyle = window.getComputedStyle(this);
            // const lineHeight = parseFloat(computedStyle.lineHeight);
            // const paddingTop = parseFloat(computedStyle.paddingTop);
            // const paddingBottom = parseFloat(computedStyle.paddingBottom);
            // const borderTop = parseFloat(computedStyle.borderTopWidth);
            // const borderBottom = parseFloat(computedStyle.borderBottomWidth);
            // const verticalPaddingAndBorder = paddingTop + paddingBottom + borderTop + borderBottom;
            // const lines = Math.floor((this.scrollHeight - verticalPaddingAndBorder) / lineHeight);
            // this.rows = Math.max(1, lines);
        });

        // Check if model supports images to conditionally create image attach button
        const currentSelectedModel = browserGet('selectedModel', 'openai/gpt-4.1-nano'); // Provide a default or ensure it's always set
        const supportsImages = typeof modelSupportsImages === 'function' && modelSupportsImages(currentSelectedModel);

        if (supportsImages) {
            this.attachImageButton = document.createElement('button');
            this.attachImageButton.textContent = '📎'; // Paperclip Icon
            this.attachImageButton.className = 'tooltip-attach-image-button';
            this.attachImageButton.title = 'Attach image(s)'; // Updated title

            this.followUpImageInput = document.createElement('input');
            this.followUpImageInput.type = 'file';
            this.followUpImageInput.accept = 'image/' + '*';
            this.followUpImageInput.multiple = true; // Allow multiple files
            this.followUpImageInput.style.display = 'none'; // Hide the actual input
        }

        this.customQuestionButton = document.createElement('button');
        this.customQuestionButton.textContent = 'Ask';
        this.customQuestionButton.className = 'tooltip-custom-question-button';

        this.customQuestionContainer.appendChild(this.customQuestionInput);
        if (this.attachImageButton) {
            this.customQuestionContainer.appendChild(this.attachImageButton);
            // The input needs to be in the DOM to be clickable, even if hidden.
            // It can be a direct child of the container or outside, as long as it's in the document.
            // For simplicity, let's add it here if attachImageButton exists.
            if (this.followUpImageInput) {
                 this.customQuestionContainer.appendChild(this.followUpImageInput);
            }
        }
        this.customQuestionContainer.appendChild(this.customQuestionButton);
        this.tooltipElement.appendChild(this.customQuestionContainer);

        // --- Image Preview and Remove Area (conditionally created) ---
        if (supportsImages) {
            this.followUpImageContainer = document.createElement('div');
            this.followUpImageContainer.className = 'tooltip-follow-up-image-preview-container'; // New class for styling
            // this.followUpImageContainer.style.display = 'none'; // Display handled by content

            // No single preview/remove button here anymore; they are per image.
            // this.followUpImagePreview = document.createElement('img');
            // this.followUpImagePreview.className = 'tooltip-follow-up-image-preview';

            // this.followUpRemoveImageButton = document.createElement('button');
            // this.followUpRemoveImageButton.textContent = 'Remove Image';
            // this.followUpRemoveImageButton.className = 'tooltip-remove-image-button';

            // this.followUpImageContainer.appendChild(this.followUpImagePreview);
            // this.followUpImageContainer.appendChild(this.followUpRemoveImageButton);
            this.tooltipElement.insertBefore(this.followUpImageContainer, this.metadataElement);
        }
        // --- End Image Preview and Remove Area ---

        // --- Metadata Area ---
        this.metadataElement = document.createElement('div');
        this.metadataElement.className = 'tooltip-metadata';
        this.metadataElement.style.display = 'none'; // Hide initially
        this.tooltipElement.appendChild(this.metadataElement);

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
        this.tooltipElement.addEventListener('scroll', this._handleTooltipScroll.bind(this));

        // Tooltip Controls Events
        this.pinButton?.addEventListener('click', this._handlePinClick.bind(this));
        this.copyButton?.addEventListener('click', this._handleCopyClick.bind(this));
        this.tooltipCloseButton?.addEventListener('click', this._handleCloseClick.bind(this));
        this.reasoningToggle?.addEventListener('click', this._handleReasoningToggleClick.bind(this));
        this.scrollButton?.addEventListener('click', this._handleScrollButtonClick.bind(this));

        // Follow-up Questions (using delegation on the container)
        this.followUpQuestionsElement?.addEventListener('click', this._handleFollowUpQuestionClick.bind(this));

        // Custom Question Button
        this.customQuestionButton?.addEventListener('click', this._handleCustomQuestionClick.bind(this));
        // Allow submitting custom question with Enter key
        this.customQuestionInput?.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault(); // Prevent default form submission/newline
                this._handleCustomQuestionClick();
            }
        });

        // --- New: Event Listeners for Image Upload (conditional) ---
        if (this.attachImageButton && this.followUpImageInput) {
            this.attachImageButton.addEventListener('click', () => this.followUpImageInput.click());
            this.followUpImageInput.addEventListener('change', this._handleFollowUpImageSelect.bind(this));
        }
        // No global remove button listener now
        // if (this.followUpRemoveImageButton) { 
        //     this.followUpRemoveImageButton.addEventListener('click', this._handleRemoveFollowUpImage.bind(this));
        // }
        // --- End New ---
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
        // Ensure required elements exist
        if (!this.tooltipElement || !this.descriptionElement || !this.scoreTextElement || !this.followUpQuestionsTextElement || !this.reasoningTextElement || !this.reasoningDropdown || !this.conversationContainerElement || !this.followUpQuestionsElement || !this.metadataElement) {
            return;
        }

        // Store current scroll position and whether we were at bottom before update
        const wasNearBottom = this.tooltipElement.scrollHeight - this.tooltipElement.scrollTop - this.tooltipElement.clientHeight < (isMobileDevice() ? 40 : 55);
        const previousScrollTop = this.tooltipElement.scrollTop;
        const previousScrollHeight = this.tooltipElement.scrollHeight;

        // --- Parse the description into parts ---
        const fullDescription = this.description || "";
        const analysisMatch = fullDescription.match(/<ANALYSIS>([^<]+)<\/ANALYSIS>/);
        const scoreMatch = fullDescription.match(/<SCORE>([^<]+)<\/SCORE>/);
        const questionsMatch = fullDescription.match(/<FOLLOW_UP_QUESTIONS>([^<]+)<\/FOLLOW_UP_QUESTIONS>/);

        let analysisContent = "";
        let scoreContent = "";
        let questionsContent = "";

        if (analysisMatch && analysisMatch[1] !== undefined) {
            analysisContent = analysisMatch[1].trim();
        } else if (!scoreMatch && !questionsMatch) {
            // Fallback: If no tags found, assume entire description is analysis
            analysisContent = fullDescription;
        } else {
            // If other tags exist but no analysis tag, leave analysis empty
            analysisContent = "*Waiting for analysis...*"; // Or some placeholder
        }

        if (scoreMatch && scoreMatch[1] !== undefined) {
            scoreContent = scoreMatch[1].trim();
        }

        if (questionsMatch && questionsMatch[1] !== undefined) {
            questionsContent = questionsMatch[1].trim();
        }
        // --- End Parsing ---

        // Use a flag to track if any significant content affecting layout changed
        let contentChanged = false;

        // Update Analysis display (using descriptionElement)
        const formattedAnalysis = formatTooltipDescription(analysisContent).description; // Pass only analysis part
        if (this.descriptionElement.innerHTML !== formattedAnalysis) {
            this.descriptionElement.innerHTML = formattedAnalysis;
            contentChanged = true;
        }

        // Update Score display (using scoreTextElement)
        if (scoreContent) {
            // Apply score highlighting specifically here
            const formattedScoreText = scoreContent
                .replace(/</g, '&lt;').replace(/>/g, '&gt;') // Basic escaping
                .replace(/SCORE_(\d+)/g, '<span class="score-highlight">SCORE: $1</span>') // Apply highlighting
                .replace(/\n/g, '<br>'); // Line breaks

            if (this.scoreTextElement.innerHTML !== formattedScoreText) {
                this.scoreTextElement.innerHTML = formattedScoreText;
                contentChanged = true;
            }
            this.scoreTextElement.style.display = 'block';
        } else {
            if (this.scoreTextElement.style.display !== 'none') {
                this.scoreTextElement.style.display = 'none';
                this.scoreTextElement.innerHTML = '';
                contentChanged = true; // Hiding/showing counts as change
            }
        }

        // Update Follow-up Questions display (using followUpQuestionsTextElement - always hidden)
        if (questionsContent) {
            const formattedQuestionsText = questionsContent.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
            if (this.followUpQuestionsTextElement.innerHTML !== formattedQuestionsText) {
                this.followUpQuestionsTextElement.innerHTML = formattedQuestionsText;
                // No contentChanged = true needed as it's always hidden
            }
        } else {
            if (this.followUpQuestionsTextElement.innerHTML !== '') {
                this.followUpQuestionsTextElement.innerHTML = '';
            }
        }
        this.followUpQuestionsTextElement.style.display = 'none'; // Ensure it's always hidden

        // --- Update Reasoning Display ---
        const formattedReasoning = formatTooltipDescription("", this.reasoning).reasoning;
        if (this.reasoningTextElement.innerHTML !== formattedReasoning) {
            this.reasoningTextElement.innerHTML = formattedReasoning;
            contentChanged = true;
        }
        const showReasoning = !!formattedReasoning;
        if ((this.reasoningDropdown.style.display === 'none') === showReasoning) {
            this.reasoningDropdown.style.display = showReasoning ? 'block' : 'none';
            contentChanged = true; // Hiding/showing counts as change
        }

        // --- Update Conversation History Display ---
        const renderedHistory = this._renderConversationHistory();
        if (this.conversationContainerElement.innerHTML !== renderedHistory) {
            this.conversationContainerElement.innerHTML = renderedHistory;
            this.conversationContainerElement.style.display = this.conversationHistory.length > 0 ? 'block' : 'none';
            contentChanged = true;
        }

        // --- Update Follow-Up Questions Buttons Display ---
        let questionsButtonsChanged = false;
        // Simple check: compare number of buttons to number of questions
        if (this.followUpQuestionsElement.children.length !== (this.questions?.length || 0)) {
            questionsButtonsChanged = true;
        } else {
            // More thorough check: compare text of each question
            this.questions?.forEach((q, i) => {
                const button = this.followUpQuestionsElement.children[i];
                if (!button || button.dataset.questionText !== q) {
                    questionsButtonsChanged = true;
                }
            });
        }

        if (questionsButtonsChanged) {
            this.followUpQuestionsElement.innerHTML = ''; // Clear previous questions
            if (this.questions && this.questions.length > 0) {
                this.questions.forEach((question, index) => {
                    const questionButton = document.createElement('button');
                    questionButton.className = 'follow-up-question-button';
                    questionButton.textContent = `🤔 ${question}`;
                    questionButton.dataset.questionIndex = index;
                    questionButton.dataset.questionText = question; // Store text for handler
                    this.followUpQuestionsElement.appendChild(questionButton);
                });
                this.followUpQuestionsElement.style.display = 'block';
            } else {
                this.followUpQuestionsElement.style.display = 'none';
            }
            contentChanged = true;
        }

        // --- Update Metadata Display ---
        let metadataHTML = '';
        let showMetadata = false;
        const hasFullMetadata = this.metadata && Object.keys(this.metadata).length > 1 && this.metadata.model;
        const hasOnlyGenId = this.metadata && this.metadata.generationId && Object.keys(this.metadata).length === 1;

        if (hasFullMetadata) {
            metadataHTML += '<hr class="metadata-separator">';
            metadataHTML += `<div class="metadata-line">Model: ${this.metadata.model}</div>`;
            metadataHTML += `<div class="metadata-line">Tokens: prompt: ${this.metadata.promptTokens} / completion: ${this.metadata.completionTokens}</div>`;
            if (this.metadata.reasoningTokens > 0) {
                metadataHTML += `<div class="metadata-line">Reasoning Tokens: ${this.metadata.reasoningTokens}</div>`;
            }
            metadataHTML += `<div class="metadata-line">Latency: ${this.metadata.latency}</div>`;
            if (this.metadata.mediaInputs > 0) {
                metadataHTML += `<div class="metadata-line">Media: ${this.metadata.mediaInputs}</div>`;
            }
            metadataHTML += `<div class="metadata-line">Price: ${this.metadata.price}</div>`;
            showMetadata = true;
        } else if (hasOnlyGenId) {
            metadataHTML += '<hr class="metadata-separator">';
            metadataHTML += `<div class="metadata-line">Generation ID: ${this.metadata.generationId} (fetching details...)</div>`;
            showMetadata = true;
        }

        if (this.metadataElement.innerHTML !== metadataHTML) {
            this.metadataElement.innerHTML = metadataHTML;
            contentChanged = true;
        }
        if ((this.metadataElement.style.display === 'none') === showMetadata) {
            this.metadataElement.style.display = showMetadata ? 'block' : 'none';
            contentChanged = true;
        }
        // --- End Metadata Display Update ---

        // Add/remove streaming class
        const isStreaming = this.status === 'streaming';
        if (this.tooltipElement.classList.contains('streaming-tooltip') !== isStreaming) {
             this.tooltipElement.classList.toggle('streaming-tooltip', isStreaming);
             contentChanged = true; // Class change might affect layout/appearance
        }

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
            // Ensure scroll button visibility is correct even if content didn't change significantly
            this._updateScrollButtonVisibility();
        }
    }

    /** Renders the conversation history into HTML string */
    _renderConversationHistory() {
        if (!this.conversationHistory || this.conversationHistory.length === 0) {
            return '';
        }

        // Store current expanded states before re-rendering
        const expandedStates = new Map();
        if (this.conversationContainerElement) {
            this.conversationContainerElement.querySelectorAll('.conversation-reasoning').forEach((dropdown, index) => {
                expandedStates.set(index, dropdown.classList.contains('expanded'));
            });
        }

        let historyHtml = '';
        this.conversationHistory.forEach((turn, index) => {
            const formattedQuestion = turn.question
                .replace(/</g, '&lt;').replace(/>/g, '&gt;'); // Basic escaping

            let uploadedImageHtml = '';
            if (turn.uploadedImages && turn.uploadedImages.length > 0) {
                uploadedImageHtml = `
                    <div class="conversation-image-container">
                        ${turn.uploadedImages.map(imageUrl => `
                            <img src="${imageUrl}" alt="User uploaded image" class="conversation-uploaded-image">
                        `).join('')}
                    </div>
                `;
            }

            let formattedAnswer;
            if (turn.answer === 'pending') {
                formattedAnswer = '<em class="pending-answer">Answering...</em>';
            } else {
                // Apply formatting similar to the main description/reasoning
                formattedAnswer = turn.answer
                    .replace(/</g, '&lt;').replace(/>/g, '&gt;') // Escape potential raw HTML first
                    // Format markdown links: [text](url) -> <a href="url">text</a>
                    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="ai-generated-link">$1</a>') // Added class
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\*(.*?)\*/g, '<em>$1</em>')
                    .replace(/`([^`]+)`/g, '<code>$1</code>')
                    .replace(/\n/g, '<br>');
            }

            // Add a separator before each Q&A pair except the first one
            if (index > 0) {
                historyHtml += '<hr class="conversation-separator">';
            }

            // --- Add Reasoning Dropdown (if present) ---
            let reasoningHtml = '';
            if (turn.reasoning && turn.reasoning.trim() !== '') {
                const formattedReasoning = formatTooltipDescription("", turn.reasoning).reasoning;
                // Check if this dropdown was expanded
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

            historyHtml += `
                <div class="conversation-turn">
                    <div class="conversation-question"><strong>You:</strong> ${formattedQuestion}</div>
                    ${uploadedImageHtml}
                    ${reasoningHtml}
                    <div class="conversation-answer"><strong>AI:</strong> ${formattedAnswer}</div>
                </div>
            `;
        });

        // Update the conversation container with the new HTML
        if (this.conversationContainerElement) {
            this.conversationContainerElement.innerHTML = historyHtml;
            // Attach event listeners after updating the HTML
            this._attachConversationReasoningListeners();
        }

        return historyHtml;
    }

    /**
     * Attaches event listeners to reasoning toggles within the conversation history.
     * Uses event delegation.
     */
    _attachConversationReasoningListeners() {
        if (!this.conversationContainerElement) return;

        // Remove any existing listener
        this.conversationContainerElement.removeEventListener('click', this._handleConversationReasoningToggle);
        // Add the new listener, making sure to bind 'this'
        this.conversationContainerElement.addEventListener('click', (e) => {
            const toggleButton = e.target.closest('.conversation-reasoning .reasoning-toggle');
            if (!toggleButton) return;

            e.stopPropagation();
            const dropdown = toggleButton.closest('.reasoning-dropdown');
            const content = dropdown?.querySelector('.reasoning-content');
            const arrow = dropdown?.querySelector('.reasoning-arrow');

            if (!dropdown || !content || !arrow) return;

            const isExpanded = dropdown.classList.toggle('expanded');
            arrow.textContent = isExpanded ? '▼' : '▶';
            toggleButton.setAttribute('aria-expanded', isExpanded);
            content.style.maxHeight = isExpanded ? '200px' : '0';
            content.style.padding = isExpanded ? '8px' : '0 8px';
        });
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
        // If the click is directly on the tooltip background (not its children),
        // and it's not pinned, maybe hide? Let's disable this for now to rely on the X button.
        // This prevents accidental closures when selecting text.

        /* --- Removed Background Click Close ---
        if (!this.isPinned && event.target === this.tooltipElement) {
             // Check if the click is on interactive elements or their container
             if (!event.target.closest('.tooltip-controls') &&
                 !event.target.closest('.reasoning-toggle') &&
                 !event.target.closest('.scroll-to-bottom-button') &&
                 !event.target.closest('.follow-up-question-button') &&
                 !event.target.closest('.tooltip-custom-question-container') &&
                 !event.target.closest('a') && // Prevent closing when clicking links
                 window.getSelection().toString().length === 0) // Prevent closing during text selection
             {
                 this.hide();
             }
        }
        */
        // Clicks on specific buttons are handled by their own listeners.
        // We might still want to stop propagation for clicks inside the tooltip
        // to prevent them from reaching document-level listeners if any exist.
        // event.stopPropagation(); // Optional: uncomment if needed
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

    _handleFollowUpQuestionClick(event) {
        // If called from _handleCustomQuestionClick, event.target will be our mockButton
        // Otherwise, it's a real DOM event and we need to find the button.
        const isMockEvent = event.target && event.target.dataset && event.target.dataset.questionText && typeof event.target.closest !== 'function';
        const button = isMockEvent ? event.target : event.target.closest('.follow-up-question-button');

        if (!button) return; // Should not happen if called from custom handler with mockButton

        event.stopPropagation(); // Prevent tooltip hide if it's a real event

        const questionText = button.dataset.questionText;
        const apiKey = browserGet('openrouter-api-key', '');

        // Add immediate feedback - only if it's a real button
        if (!isMockEvent) {
        button.disabled = true;
        button.textContent = `🤔 Asking: ${questionText}...`;
        // Optionally disable other question buttons too
        this.followUpQuestionsElement.querySelectorAll('.follow-up-question-button').forEach(btn => btn.disabled = true);
        } else {
            // For custom questions, disable the input and button
            if (this.customQuestionInput) this.customQuestionInput.disabled = true;
            if (this.customQuestionButton) {
                this.customQuestionButton.disabled = true;
                this.customQuestionButton.textContent = 'Asking...';
            }
        }

        this.conversationHistory.push({ 
            question: questionText, 
            answer: 'pending', 
            uploadedImages: [...this.uploadedImageDataUrls], // Store a copy of the image URLs array
            reasoning: '' // Initialize reasoning for this turn
        });
        this._updateTooltipUI(); // Update UI to show pending state
        this.questions = []; // Clear suggested questions
        this._updateTooltipUI(); // Update UI again to remove suggested questions

        // Construct the user message for the API
        const userMessageContent = [{ type: "text", text: questionText }];
        if (this.uploadedImageDataUrls && this.uploadedImageDataUrls.length > 0) {
            this.uploadedImageDataUrls.forEach(url => {
                userMessageContent.push({ type: "image_url", image_url: { "url": url } });
            });
        }
        const userApiMessage = { role: "user", content: userMessageContent };

        // Create a new history array for the API call, including the new user message
        const historyForApiCall = [...this.qaConversationHistory, userApiMessage];

        if (!apiKey) {
            showStatus('API key missing. Cannot answer question.', 'error');
            this._updateConversationHistory(questionText, "Error: API Key missing.", "");
            // Re-enable buttons
            if (!isMockEvent) {
                button.disabled = false;
                this.followUpQuestionsElement.querySelectorAll('.follow-up-question-button').forEach(btn => btn.disabled = false);
            }
            if (this.customQuestionInput) this.customQuestionInput.disabled = false;
            if (this.customQuestionButton) {
                this.customQuestionButton.disabled = false;
                this.customQuestionButton.textContent = 'Ask';
            }
            this._clearFollowUpImage(); // Clear image even on error
            return;
        }

        if (!questionText) {
            console.error("Follow-up question text not found on button.");
            this._updateConversationHistory(questionText || "Error: Empty Question", "Error: Could not identify question.", "");
            // Re-enable buttons
             if (!isMockEvent) {
                button.disabled = false;
                this.followUpQuestionsElement.querySelectorAll('.follow-up-question-button').forEach(btn => btn.disabled = false);
            }
            if (this.customQuestionInput) this.customQuestionInput.disabled = false;
            if (this.customQuestionButton) {
                this.customQuestionButton.disabled = false;
                this.customQuestionButton.textContent = 'Ask';
            }
            this._clearFollowUpImage();
            return;
        }

        const currentArticle = this.findCurrentArticleElement();
        // We no longer need to pass original mediaUrls from cache, as they are in qaConversationHistory
        // const cachedData = tweetCache.get(this.tweetId);
        // const mediaUrls = cachedData?.mediaUrls || []; 

        try {
            // Pass the augmented history to answerFollowUpQuestion
            answerFollowUpQuestion(this.tweetId, historyForApiCall, apiKey, currentArticle, this);
        } finally {
            setTimeout(() => {
                 if (this.followUpQuestionsElement) {
                    this.followUpQuestionsElement.querySelectorAll('.follow-up-question-button').forEach(btn => {
                         btn.disabled = false;
                    });
                }
                 // Re-enable custom question UI if it was used
                if (this.customQuestionInput) this.customQuestionInput.disabled = false;
                if (this.customQuestionButton) {
                    this.customQuestionButton.disabled = false;
                    this.customQuestionButton.textContent = 'Ask';
                }
                this._clearFollowUpImage(); // Clear image after sending
            }, 100);
        }
    }

    _handleCustomQuestionClick() {
        if (!this.customQuestionInput || !this.customQuestionButton) return;

        const questionText = this.customQuestionInput.value.trim();
        if (!questionText) {
            showStatus("Please enter a question.", "warning");
            this.customQuestionInput.focus();
            return;
        }

        // This reuses the logic from _handleFollowUpQuestionClick for sending the question
        // The actual API call happens there. We just need to trigger it.
        // Create a temporary "button" like object to pass to _handleFollowUpQuestionClick
        // or refactor to a common sending function. For now, let's simulate a click.

        const mockButton = {
            dataset: { questionText: questionText },
            disabled: false,
            textContent: ''
        };
        // Temporarily disable suggested questions if any
        this.followUpQuestionsElement?.querySelectorAll('.follow-up-question-button').forEach(btn => btn.disabled = true);

        // Call the handler, it will manage UI updates and API call
        this._handleFollowUpQuestionClick({ target: mockButton, stopPropagation: () => {} });

        // Clear the input field after initiating the send for custom questions
        if (this.customQuestionInput) {
            this.customQuestionInput.value = '';
        }
    }

    // --- New: Image Handling Methods for Follow-up ---
    _handleFollowUpImageSelect(event) {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        // Ensure the container is visible if we're adding images
        if (this.followUpImageContainer && files.length > 0) {
            this.followUpImageContainer.style.display = 'flex'; // Or 'block', depending on final styling
        }

        Array.from(files).forEach(file => {
            if (file && file.type.startsWith('image/')) {
                resizeImage(file, 512) // Resize to max 512px
                    .then(resizedDataUrl => {
                        this.uploadedImageDataUrls.push(resizedDataUrl);
                        this._addPreviewToContainer(resizedDataUrl);
                    })
                    .catch(error => {
                        console.error("Error resizing image:", error);
                        showStatus(`Could not process image ${file.name}: ${error.message}`, "error");
                    });
            } else if (file) {
                showStatus(`Skipping non-image file: ${file.name}`, "warning");
        }
        });

        // Reset file input to allow selecting the same file again if removed
        event.target.value = null;
    }

    _addPreviewToContainer(imageDataUrl) {
        if (!this.followUpImageContainer) return;

        const previewItem = document.createElement('div');
        previewItem.className = 'follow-up-image-preview-item';
        previewItem.dataset.imageDataUrl = imageDataUrl; // Store for easy removal

        const img = document.createElement('img');
        img.src = imageDataUrl;
        img.className = 'follow-up-image-preview-thumbnail';

        const removeBtn = document.createElement('button');
        removeBtn.textContent = '×'; // 'X' character for close
        removeBtn.className = 'follow-up-image-remove-btn';
        removeBtn.title = 'Remove this image';
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this._removeSpecificUploadedImage(imageDataUrl);
        });

        previewItem.appendChild(img);
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
            // Hide container if no images are left
            if (this.uploadedImageDataUrls.length === 0) {
                this.followUpImageContainer.style.display = 'none';
            }
        }
    }


    _clearFollowUpImage() {
        this.uploadedImageDataUrls = []; // Reset the array
        if (this.followUpImageContainer) {
            this.followUpImageContainer.innerHTML = ''; // Clear all preview items
            this.followUpImageContainer.style.display = 'none'; // Hide the container
        }
        if (this.followUpImageInput) {
            this.followUpImageInput.value = null; // Clear the file input
        }
    }
    // --- End New ---

    // --- Public API ---

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
            this.conversationHistory[entryIndex].reasoning = reasoning; // Store reasoning
            this._updateTooltipUI(); // Refresh the view to show the updated answer
        } else {
            console.warn(`[ScoreIndicator ${this.tweetId}] Could not find pending history entry for question: "${question}"`);
            // Optionally, append as a new entry if not found, though this might indicate a logic error
            // this.conversationHistory.push({ question: question, answer: answer });
            // this._updateTooltipUI();
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

        // Find the last conversation turn element
        const conversationTurns = this.conversationContainerElement.querySelectorAll('.conversation-turn');
        const lastTurnElement = conversationTurns.length > 0 ? conversationTurns[conversationTurns.length - 1] : null;

        if (!lastTurnElement) {
            console.warn(`[ScoreIndicator ${this.tweetId}] Could not find last conversation turn to render streaming answer.`);
            return;
        }

        // Ensure the corresponding state is actually pending before updating visuals
        const lastHistoryEntry = this.conversationHistory.length > 0 ? this.conversationHistory[this.conversationHistory.length -1] : null;
        if (!(lastHistoryEntry && lastHistoryEntry.answer === 'pending')) {
            console.warn(`[ScoreIndicator ${this.tweetId}] Attempted to render streaming answer, but last history entry is not pending.`);
            return;
        }

        // --- Handle Reasoning Dropdown ---
        let reasoningDropdown = lastTurnElement.querySelector('.reasoning-dropdown');
        const hasReasoning = reasoningText && reasoningText.trim() !== '';

        if (hasReasoning && !reasoningDropdown) {
            // Create reasoning dropdown elements if they don't exist for this turn
            reasoningDropdown = document.createElement('div');
            reasoningDropdown.className = 'reasoning-dropdown conversation-reasoning'; // Add specific class

            const reasoningToggle = document.createElement('div');
            reasoningToggle.className = 'reasoning-toggle';

            const reasoningArrow = document.createElement('span');
            reasoningArrow.className = 'reasoning-arrow';
            reasoningArrow.textContent = '▶';

            reasoningToggle.appendChild(reasoningArrow);
            reasoningToggle.appendChild(document.createTextNode(' Show Reasoning Trace'));

            const reasoningContent = document.createElement('div');
            reasoningContent.className = 'reasoning-content';
            const reasoningTextElement = document.createElement('p');
            reasoningTextElement.className = 'reasoning-text';
            reasoningContent.appendChild(reasoningTextElement);

            reasoningDropdown.appendChild(reasoningToggle);
            reasoningDropdown.appendChild(reasoningContent);

            // Insert the dropdown *before* the answer element within the turn
            const answerElement = lastTurnElement.querySelector('.conversation-answer');
            if (answerElement) {
                lastTurnElement.insertBefore(reasoningDropdown, answerElement);
            } else {
                lastTurnElement.appendChild(reasoningDropdown); // Fallback
            }

            // Add toggle listener specifically for this dropdown
            reasoningToggle.addEventListener('click', (e) => {
                 e.stopPropagation();
                 const dropdown = e.target.closest('.reasoning-dropdown');
                 const content = dropdown?.querySelector('.reasoning-content');
                 const arrow = dropdown?.querySelector('.reasoning-arrow');
                 if (!dropdown || !content || !arrow) return;

                 const isExpanded = dropdown.classList.toggle('expanded');
                 arrow.textContent = isExpanded ? '▼' : '▶';
                 content.style.maxHeight = isExpanded ? '200px' : '0'; // Adjust max-height as needed
                 content.style.padding = isExpanded ? '8px' : '0 8px';
            });
        }

        // Update reasoning content if dropdown exists and reasoning is present
        if (reasoningDropdown && hasReasoning) {
            const reasoningTextElement = reasoningDropdown.querySelector('.reasoning-text');
            if (reasoningTextElement) {
                const formattedReasoning = formatTooltipDescription("", reasoningText).reasoning;
                if (reasoningTextElement.innerHTML !== formattedReasoning) {
                    reasoningTextElement.innerHTML = formattedReasoning;
                }
            }
            reasoningDropdown.style.display = 'block';
        } else if (reasoningDropdown) {
            // Hide dropdown if reasoning disappears (shouldn't normally happen mid-stream)
            reasoningDropdown.style.display = 'none';
        }

        // --- Handle Answer Text ---
        const lastAnswerElement = lastTurnElement.querySelector('.conversation-answer');
        if (lastAnswerElement) {
            // Format the streaming answer
            const formattedStreamingAnswer = streamingText
                .replace(/</g, '&lt;').replace(/>/g, '&gt;') // Escape potential raw HTML first
                .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="ai-generated-link">$1</a>')
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/`([^`]+)`/g, '<code>$1</code>')
                .replace(/\n/g, '<br>');

            // Update the innerHTML directly, adding the cursor
            lastAnswerElement.innerHTML = `<strong>AI:</strong> ${formattedStreamingAnswer}<em class="pending-cursor">|</em>`;
        } else {
             console.warn(`[ScoreIndicator ${this.tweetId}] Could not find answer element in last conversation turn.`);
        }


        // Ensure autoscroll if needed
        if (this.autoScroll) {
            this._performAutoScroll();
        }
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
        // console.log(`[ScoreIndicator ${this.tweetId}] Updating state - Status: ${status}, Score: ${score}`);
        const statusChanged = status !== undefined && this.status !== status;
        const scoreChanged = score !== null && this.score !== score;
        const descriptionChanged = description !== '' && this.description !== description;
        const reasoningChanged = reasoning !== '' && this.reasoning !== reasoning;
        const metadataChanged = metadata !== null && JSON.stringify(this.metadata) !== JSON.stringify(metadata);
        const questionsChanged = questions !== undefined && JSON.stringify(this.questions) !== JSON.stringify(questions);
        // Conversation history updates are handled separately now

        // Only update if something actually changed
        if (!statusChanged && !scoreChanged && !descriptionChanged && !reasoningChanged && !metadataChanged && !questionsChanged) {
            // console.log(`[ScoreIndicator ${this.tweetId}] No state change detected.`);
            return;
        }

        if (statusChanged) this.status = status;
        // Ensure score is null if status implies it (e.g., pending without previous score)
        if (scoreChanged || statusChanged) {
            this.score = (this.status === 'pending' || this.status === 'error') ? score : // Allow score display for error state if provided
                (this.status === 'streaming' && score === null) ? this.score : // Keep existing score during streaming if new one is null
                    score;
        }
        if (descriptionChanged) this.description = description;
        if (reasoningChanged) this.reasoning = reasoning;
        if (metadataChanged) this.metadata = metadata;
        if (questionsChanged) this.questions = questions;

        // Update autoScroll state based on new status BEFORE UI updates
        if (statusChanged) {
            const shouldAutoScroll = (this.status === 'pending' || this.status === 'streaming');
            if (this.autoScroll !== shouldAutoScroll) {
                this.autoScroll = shouldAutoScroll;
                // Add null check before accessing dataset
                if (this.tooltipElement) {
                    this.tooltipElement.dataset.autoScroll = this.autoScroll ? 'true' : 'false';
                }
            }
        }

        // Update UI elements
        if (statusChanged || scoreChanged) {
            this._updateIndicatorUI();
        }
        // Update tooltip if content changed or if visibility/scrolling might need adjustment
        if (descriptionChanged || reasoningChanged || statusChanged || metadataChanged || questionsChanged) {
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

    // --- New Event Handler for Close Button ---
    _handleCloseClick(e) {
        e.stopPropagation();
        this.hide(); // Simply hide the tooltip
    }
    // --- End New Event Handler ---

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
        this.tooltipElement?.removeEventListener('scroll', this._handleTooltipScroll);
        this.pinButton?.removeEventListener('click', this._handlePinClick);
        this.copyButton?.removeEventListener('click', this._handleCopyClick);
        this.tooltipCloseButton?.removeEventListener('click', this._handleCloseClick);
        this.reasoningToggle?.removeEventListener('click', this._handleReasoningToggleClick);
        this.scrollButton?.removeEventListener('click', this._handleScrollButtonClick);
        this.followUpQuestionsElement?.removeEventListener('click', this._handleFollowUpQuestionClick);
        this.customQuestionButton?.removeEventListener('click', this._handleCustomQuestionClick);
        this.customQuestionInput?.removeEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault(); // Prevent default form submission/newline
                this._handleCustomQuestionClick();
            }
        });


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
        this.tooltipCloseButton = null;
        this.reasoningToggle = null;
        this.scrollButton = null;
        this.conversationContainerElement = null;
        this.followUpQuestionsElement = null;
        this.customQuestionContainer = null;
        this.customQuestionInput = null;
        this.customQuestionButton = null;
        // --- New: Nullify Image Upload Elements ---
        this.followUpImageContainer = null;
        this.followUpImageInput = null;
        this.followUpImagePreview = null;
        this.followUpRemoveImageButton = null;
        this.attachImageButton = null; // Added for cleanup
        this.uploadedImageDataUrls = []; // Ensure it's reset here too
        // --- End New ---
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
            if (getTweetID(article) === this.tweetId) {
                return article;
            }
        }

        // Fallback: Iterate through all articles if specific link not found
        // This is less efficient but necessary if the ID isn't easily queryable
        const articles = timeline.querySelectorAll('article[data-testid="tweet"]');
        for (const art of articles) {
            if (getTweetID(art) === this.tweetId) {
                return art;
            }
        }

        return null; // Not found
    }

    /**
     * Updates the indicator's state after an initial review and builds the conversation history.
     * @param {object} params
     * @param {string} params.fullContext - The full text context of the tweet.
     * @param {string[]} params.mediaUrls - Array of media URLs from the tweet.
     * @param {string} params.apiResponseContent - The raw content from the API response.
     * @param {string} params.reviewSystemPrompt - The system prompt used for the initial review.
     * @param {string} params.followUpSystemPrompt - The system prompt to be used for follow-ups.
     */
    updateInitialReviewAndBuildHistory({ fullContext, mediaUrls, apiResponseContent, reviewSystemPrompt, followUpSystemPrompt }) {
        // Parse apiResponseContent for analysis, score, and initial questions
        const analysisMatch = apiResponseContent.match(/<ANALYSIS>([\s\S]*?)<\/ANALYSIS>/);
        const scoreMatch = apiResponseContent.match(/<SCORE>\s*SCORE_(\d+)\s*<\/SCORE>/);
        // extractFollowUpQuestions function is defined in api.js, assuming it's globally available
        const initialQuestions = extractFollowUpQuestions(apiResponseContent);

        this.score = scoreMatch ? parseInt(scoreMatch[1], 10) : null;
        this.description = analysisMatch ? analysisMatch[1].trim() : apiResponseContent; // Fallback to full content
        this.questions = initialQuestions;
        this.status = this.score !== null ? 'rated' : 'error'; // Or some other logic for status

        // Construct qaConversationHistory
        const userMessageContent = [{ type: "text", text: fullContext }];
        mediaUrls.forEach(url => {
            userMessageContent.push({ type: "image_url", image_url: { "url": url } });
        });

        this.qaConversationHistory = [
            { role: "system", content: [{ type: "text", text: reviewSystemPrompt }] },
            { role: "user", content: userMessageContent },
            { role: "assistant", content: [{ type: "text", text: apiResponseContent }] },
            { role: "system", content: [{ type: "text", text: followUpSystemPrompt }] }
        ];

        // Update UI elements
        this._updateIndicatorUI();
        this._updateTooltipUI();
        this.updateDatasetAttributes();
    }

    /**
     * Updates the indicator's state after a follow-up question has been answered.
     * @param {object} params
     * @param {string} params.assistantResponseContent - The raw content of the AI's response.
     * @param {object[]} params.updatedQaHistory - The fully updated qaConversationHistory array.
     */
    updateAfterFollowUp({ assistantResponseContent, updatedQaHistory }) {
        this.qaConversationHistory = updatedQaHistory;

        // Parse assistantResponseContent for the answer and new follow-up questions
        const answerMatch = assistantResponseContent.match(/<ANSWER>([\s\S]*?)<\/ANSWER>/);
        const newFollowUpQuestions = extractFollowUpQuestions(assistantResponseContent);

        const answerText = answerMatch ? answerMatch[1].trim() : assistantResponseContent; // Fallback

        // Update this.questions for the UI buttons
        this.questions = newFollowUpQuestions;

        // Update the last turn in this.conversationHistory (for UI rendering)
        if (this.conversationHistory.length > 0) {
            const lastTurn = this.conversationHistory[this.conversationHistory.length - 1];
            if (lastTurn.answer === 'pending') {
                lastTurn.answer = answerText;
                // Assuming reasoning might be part of assistantResponseContent or handled elsewhere
                // For now, let's assume reasoning isn't explicitly parsed here for simplicity
                // lastTurn.reasoning = ...;
            }
        }

        // Refresh the tooltip UI
        this._updateTooltipUI();
        this.updateDatasetAttributes(); // Ensure dataset reflects any score/status change if applicable
    }

    /**
     * Rehydrates the ScoreIndicator instance from cached data.
     * @param {object} cachedData - The cached data object.
     */
    rehydrateFromCache(cachedData) {
        this.score = cachedData.score;
        this.description = cachedData.description; // This should be the analysis part
        this.reasoning = cachedData.reasoning;
        this.questions = cachedData.questions || [];
        this.status = cachedData.status || (cachedData.score !== null ? (cachedData.fromStorage ? 'cached' : 'rated') : 'error');
        this.metadata = cachedData.metadata || null;
        this.qaConversationHistory = cachedData.qaConversationHistory || [];
        this.isPinned = cachedData.isPinned || false; // Assuming we might cache pin state

        // Rebuild this.conversationHistory (for UI) from qaConversationHistory
        this.conversationHistory = [];
        if (this.qaConversationHistory.length > 0) {
            let currentQuestion = null;
            let currentUploadedImages = [];

            // Start iterating after the initial assistant review and the follow-up system prompt
            // Initial structure: [SysReview, UserTweet, AssReview, SysFollowUp, UserQ1, AssA1, ...]
            // We look for UserQ -> AssA pairs
            let startIndex = 0;
            for(let i=0; i < this.qaConversationHistory.length; i++) {
                if (this.qaConversationHistory[i].role === 'system' && this.qaConversationHistory[i].content[0].text.includes('FOLLOW_UP_SYSTEM_PROMPT')) {
                    startIndex = i + 1;
                    break;
                }
                 // Fallback if FOLLOW_UP_SYSTEM_PROMPT is not found (e.g. very old cache)
                if (i === 3 && this.qaConversationHistory[i].role === 'system') {
                    startIndex = i + 1;
                }
            }


            for (let i = startIndex; i < this.qaConversationHistory.length; i++) {
                const message = this.qaConversationHistory[i];
                if (message.role === 'user') {
                    // Find the text part of the user's message
                    const textContent = message.content.find(c => c.type === 'text');
                    currentQuestion = textContent ? textContent.text : "[Question not found]";
                    
                    // Extract uploaded images if any
                    currentUploadedImages = message.content
                        .filter(c => c.type === 'image_url' && c.image_url && c.image_url.url.startsWith('data:image'))
                        .map(c => c.image_url.url);

                } else if (message.role === 'assistant' && currentQuestion) {
                    const assistantTextContent = message.content.find(c => c.type === 'text');
                    const assistantAnswer = assistantTextContent ? assistantTextContent.text : "[Answer not found]";
                    
                    // Attempt to parse out just the answer part for the UI history
                    const answerMatch = assistantAnswer.match(/<ANSWER>([\s\S]*?)<\/ANSWER>/);
                    const uiAnswer = answerMatch ? answerMatch[1].trim() : assistantAnswer;

                    this.conversationHistory.push({
                        question: currentQuestion,
                        answer: uiAnswer,
                        uploadedImages: currentUploadedImages,
                        reasoning: '' // Reasoning extraction from assistant's full response for UI needs more logic
                    });
                    currentQuestion = null; // Reset for the next pair
                    currentUploadedImages = [];
                }
            }
        }

        if (this.isPinned) {
            this.pinButton.innerHTML = '📍';
            this.tooltipElement?.classList.add('pinned');
        } else {
            this.pinButton.innerHTML = '📌';
            this.tooltipElement?.classList.remove('pinned');
        }
        
        this._updateIndicatorUI();
        this._updateTooltipUI();
        this.updateDatasetAttributes();
    }
}

// --- Registry for Managing Instances ---

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
            // Ensure the existing manager's article is still valid if possible
            if (tweetArticle && existingManager.tweetArticle !== tweetArticle) {
                // This might happen if the DOM is manipulated strangely. Log a warning.
                console.warn(`[Registry] Mismatch between provided article and existing manager for tweet ${tweetId}. Using existing manager.`);
            }
            return existingManager;
        } else if (tweetArticle) {
            try {
                // Double-check if an indicator element *already exists* for this tweet ID,
                // potentially created outside the registry (shouldn't happen with proper usage).
                const existingIndicator = tweetArticle.querySelector(`.score-indicator[data-tweet-id="${tweetId}"]`);
                const existingTooltip = document.querySelector(`.score-description[data-tweet-id="${tweetId}"]`);

                if (existingIndicator || existingTooltip) {
                    console.warn(`[Registry] Found existing indicator/tooltip elements for tweet ${tweetId} outside registry. Removing them before creating new manager.`);
                    existingIndicator?.remove();
                    existingTooltip?.remove();
                }

                // Create new instance. The constructor handles adding itself to the registry.
                return new ScoreIndicator(tweetArticle);
            } catch (e) {
                console.error(`[Registry] Error creating ScoreIndicator for ${tweetId}:`, e);
                return null;
            }
        }
        // If no instance exists and no article provided to create one
        // console.log(`[Registry] No instance found for ${tweetId} and no article provided.`);
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
            // Optionally destroy the old one first: this.managers.get(tweetId).destroy();
        }
        this.managers.set(tweetId, instance);
        // console.log(`[Registry] Added indicator for ${tweetId}. Total: ${this.managers.size}`);
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

        // Collect IDs of tweet articles currently visible in the timeline
        const visibleTweetIds = new Set();
        observedTimeline.querySelectorAll('article[data-testid="tweet"]').forEach(article => {
            const id = getTweetID(article);
            if (id) visibleTweetIds.add(id);
        });

        for (const [tweetId, manager] of this.managers.entries()) {
            const isConnected = manager.indicatorElement?.isConnected;
            const isVisible = visibleTweetIds.has(tweetId);
            if (!isConnected || !isVisible) {
                manager.destroy(); // Destroy calls remove()
                removedCount++;
            }
        }
    },

    /**
     * Destroys all managed indicators. Useful for full cleanup on script unload/major UI reset.
     */
    destroyAll() {
        console.log(`[Registry] Destroying all ${this.managers.size} indicators.`);
        // Iterate over a copy of values, as destroy() modifies the map
        [...this.managers.values()].forEach(manager => manager.destroy());
        this.managers.clear(); // Ensure map is empty
    }
};

// --- Helper Functions (Assume these are globally available due to Tampermonkey) ---

// function getTweetID(tweetArticle) { ... } // From domScraper.js
// function isMobileDevice() { ... } // From ui.js

// Helper for formatting description/reasoning (can be kept here or moved)
function formatTooltipDescription(description = "", reasoning = "") {
    // Only format description if it's not the placeholder
    let formattedDescription = description === "*Waiting for analysis...*" ? description :
        (description || "*waiting for content...*")
            .replace(/</g, '&lt;').replace(/>/g, '&gt;') // Escape HTML tags first
            .replace(/^# (.*$)/gm, '<h1>$1</h1>')
            .replace(/^## (.*$)/gm, '<h2>$1</h2>')
            .replace(/^### (.*$)/gm, '<h3>$1</h3>')
            .replace(/^#### (.*$)/gm, '<h4>$1</h4>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
            .replace(/\*(.*?)\*/g, '<em>$1</em>')     // Italic
            .replace(/`([^`]+)`/g, '<code>$1</code>')   // Inline code
            .replace(/SCORE_(\d+)/g, '<span class="score-highlight">SCORE: $1</span>') // Score highlight class
            .replace(/\n\n/g, '<br><br>') // Paragraph breaks
            .replace(/\n/g, '<br>');      // Line breaks

    let formattedReasoning = '';
    if (reasoning && reasoning.trim()) {
        formattedReasoning = reasoning
            .replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\n\n/g, '<br><br>')
            .replace(/\n/g, '<br>');
    }
    // Return both, even though caller might only use one
    return { description: formattedDescription, reasoning: formattedReasoning };
}
