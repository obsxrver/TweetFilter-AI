/**
 * Enum for tweet states
 */
const TweetState = {
    PENDING: 'pending',
    STREAMING: 'streaming',
    RATED: 'rated',
    ERROR: 'error',
    CACHED: 'cached',
    BLACKLISTED: 'blacklisted'
};

/**
 * Represents a tweet with all its associated data
 */
class Tweet {
    /**
     * Constructor for creating a Tweet from raw data
     * @param {string} id - Tweet ID
     * @param {string} author - Tweet author handle
     * @param {string} textContent - Tweet text content
     * @param {string[]} mediaURLs - Array of media URLs
     * @param {boolean} isAd - Whether the tweet is an ad
     */
    constructor(id, author, textContent, mediaURLs = [], isAd = false) {
        // Handle different constructor signatures
        if (typeof id === 'object' && id !== null) {
            // Constructor from object (for hydration from cache)
            this._initFromObject(id);
        } else if (id instanceof Element) {
            // Constructor from DOM article
            this._initFromDOM(id);
        } else {
            // Standard constructor
            this.id = id;
            this.author = author;
            this.textContent = textContent;
            this.mediaURLs = mediaURLs || [];
            this.isAd = isAd;
            this.state = TweetState.PENDING;
            this.error = null;
            this.rating = null;
            this.parent = null;
            this.quote = null;
            
            // Additional properties
            this.engagementStats = '';
            this.timestamp = Date.now();
            this.threadContext = null;
            this.individualMediaUrls = [...this.mediaURLs]; // Store original media URLs
            this.quotedMediaUrls = [];
            this.quotedAuthor = '';
            this.quotedText = '';
            this.quotedTweetId = null;
        }
    }

    /**
     * Initialize Tweet from a plain object (for cache hydration)
     * @private
     */
    _initFromObject(obj) {
        this.id = obj.id;
        this.author = obj.author;
        this.textContent = obj.textContent;
        this.mediaURLs = obj.mediaURLs || [];
        this.isAd = obj.isAd || false;
        this.state = obj.state || TweetState.PENDING;
        this.error = obj.error || null;
        
        // Reconstruct Rating if present
        this.rating = obj.rating ? new Rating(obj.rating) : null;
        
        // Don't reconstruct parent/quote as full Tweet objects to avoid circular dependencies
        // Store just the IDs and reconstruct relationships later if needed
        this.parentId = obj.parentId || null;
        this.quoteId = obj.quoteId || null;
        
        // Additional properties
        this.engagementStats = obj.engagementStats || '';
        this.timestamp = obj.timestamp || Date.now();
        this.threadContext = obj.threadContext || null;
        this.individualMediaUrls = obj.individualMediaUrls || [...this.mediaURLs];
        this.quotedMediaUrls = obj.quotedMediaUrls || [];
        this.quotedAuthor = obj.quotedAuthor || '';
        this.quotedText = obj.quotedText || '';
        this.quotedTweetId = obj.quotedTweetId || null;
    }

    /**
     * Initialize Tweet from DOM article element
     * @private
     */
    _initFromDOM(tweetArticle) {
        // Extract ID
        let link = tweetArticle.querySelectorAll('a[href*="/status/"]');
        if(link.length >1){
            this.quoteId = link[1].href.split('/').pop();
        }
        else if (link.length > 0) {
            this.id = link[0].href.split('/').pop();
        }
        else{
            this.id = 'unknown';
        }
        
        // Extract author handles
        const handles = document.querySelectorAll('div[data-testid="User-Name"] a[role="link"]')
        //will have one node if its a standalone tweet, two if its a quote
        this.author = handles[0]?.href.split('/').pop() || 'unknown';
        this.quotedAuthor = handles[1]?.href.split('/').pop() || '';
        
        
        // Extract text content
        this.textContent = getElementText(tweetArticle.querySelector(TWEET_TEXT_SELECTOR)) || '';
        
        // Extract media URLs synchronously
        this.mediaURLs = extractMediaLinks(tweetArticle);
        this.individualMediaUrls = [...this.mediaURLs];
        
        // Check if it's an ad
        this.isAd = isAd(tweetArticle);
        
        // Extract quoted tweet if present
        const quoteContainer = tweetArticle.querySelector(QUOTE_CONTAINER_SELECTOR);
        if (quoteContainer) {
            this.quotedText = getElementText(quoteContainer.querySelector(TWEET_TEXT_SELECTOR)) || '';
            this.quotedMediaUrls = extractMediaLinksSync(quoteContainer);
            
            // Try to extract quoted tweet ID
            const quotedLink = quoteContainer.querySelector('a[href*="/status/"]');
            if (quotedLink) {
                const href = quotedLink.getAttribute('href');
                const match = href.match(/\/status\/(\d+)/);
                if (match && match[1]) {
                    this.quotedTweetId = match[1];
                }
            }
        }
        
        // Extract engagement stats
        const engagementDiv = tweetArticle.querySelector('div[role="group"][aria-label$=" views"]');
        if (engagementDiv) {
            this.engagementStats = engagementDiv.getAttribute('aria-label')?.trim() || '';
        }
        
        // Initialize other properties
        this.state = TweetState.PENDING;
        this.error = null;
        this.rating = null;
        this.parent = null;
        this.quote = null;
        this.timestamp = Date.now();
        this.threadContext = null;
    }

    /**
     * Set the parent tweet (for thread relationships)
     * @param {Tweet} parentTweet
     */
    setParent(parentTweet) {
        this.parent = parentTweet;
        this.parentId = parentTweet ? parentTweet.id : null;
    }

    /**
     * Set the quoted tweet
     * @param {Tweet} quotedTweet
     */
    setQuote(quotedTweet) {
        this.quote = quotedTweet;
        this.quoteId = quotedTweet ? quotedTweet.id : null;
    }

    /**
     * Update the tweet's state
     * @param {string} newState - One of TweetState values
     */
    setState(newState) {
        if (Object.values(TweetState).includes(newState)) {
            this.state = newState;
        } else {
            console.warn(`Invalid tweet state: ${newState}`);
        }
    }

    /**
     * Set the rating for this tweet
     * @param {Rating} rating
     */
    setRating(rating) {
        this.rating = rating;
        if (rating && rating.score !== null && rating.score !== undefined) {
            this.state = TweetState.RATED;
        }
    }

    /**
     * Set error state
     * @param {Error|string} error
     */
    setError(error) {
        this.error = error instanceof Error ? error : new Error(error);
        this.state = TweetState.ERROR;
    }

    /**
     * Build the full context string for LLM processing
     * This replaces the getFullContext function
     * @param {string} apiKey - API key for image descriptions
     * @returns {Promise<string>} The formatted context string
     */
    async toString(apiKey = null) {
        let fullContext = `[TWEET ${this.id}]\n Author:@${this.author}:\n${this.textContent}`;
        
        // Add main tweet media
        if (this.individualMediaUrls.length > 0) {
            if (browserGet('enableImageDescriptions', false) && apiKey) {
                const descriptions = await getImageDescription(this.individualMediaUrls, apiKey, this.id, this.author);
                fullContext += `\n[MEDIA_DESCRIPTION]:\n${descriptions}`;
            }
            fullContext += `\n[MEDIA_URLS]:\n${this.individualMediaUrls.join(", ")}`;
        }
        
        // Add engagement stats
        if (this.engagementStats) {
            fullContext += `\n[ENGAGEMENT_STATS]:\n${this.engagementStats}`;
        }
        
        // Add thread media if in a thread
        if (this.threadContext?.threadMediaUrls?.length > 0) {
            const uniqueThreadMediaUrls = this.threadContext.threadMediaUrls.filter(url =>
                !this.individualMediaUrls.includes(url) && !this.quotedMediaUrls.includes(url));
            
            if (uniqueThreadMediaUrls.length > 0) {
                fullContext += `\n[THREAD_MEDIA_URLS]:\n${uniqueThreadMediaUrls.join(", ")}`;
            }
        }
        
        // Add quoted tweet
        if (this.quotedText || this.quotedMediaUrls.length > 0) {
            fullContext += `\n[QUOTED_TWEET${this.quotedTweetId ? ' ' + this.quotedTweetId : ''}]:`;
            fullContext += `\n Author:@${this.quotedAuthor}:\n${this.quotedText}`;
            
            if (this.quotedMediaUrls.length > 0) {
                if (browserGet('enableImageDescriptions', false) && apiKey) {
                    const descriptions = await getImageDescription(this.quotedMediaUrls, apiKey, this.id, this.author);
                    fullContext += `\n[QUOTED_TWEET_MEDIA_DESCRIPTION]:\n${descriptions}`;
                }
                fullContext += `\n[QUOTED_TWEET_MEDIA_URLS]:\n${this.quotedMediaUrls.join(", ")}`;
            }
        }
        
        // Add parent context if in a thread
        if (this.parent) {
            const parentContext = await this.parent.toString(apiKey);
            fullContext = parentContext + "\n[REPLY]\n" + fullContext;
        } else if (this.threadContext?.replyToId) {
            // Build parent context from threadContext
            const parentTweet = tweetCache.get(this.threadContext.replyToId);
            if (parentTweet && parentTweet instanceof Tweet) {
                const parentContext = await parentTweet.toString(apiKey);
                fullContext = parentContext + "\n[REPLY]\n" + fullContext;
            } else {
                // If parent tweet not in cache or not a Tweet object, show minimal context
                const parentAuthor = this.threadContext.replyTo || 'unknown';
                fullContext = `[REPLY TO TWEET ${this.threadContext.replyToId}]\n Author:@${parentAuthor}:\n[CONTEXT UNAVAILABLE]\n[REPLY]\n` + fullContext;
            }
        }
        
        return fullContext;
    }

    /**
     * Convert tweet to JSON for caching
     * @returns {Object} JSON representation
     */
    toJSON() {
        return {
            id: this.id,
            author: this.author,
            textContent: this.textContent,
            mediaURLs: this.mediaURLs,
            isAd: this.isAd,
            state: this.state,
            error: this.error ? this.error.message : null,
            rating: this.rating ? this.rating.toJSON() : null,
            parentId: this.parentId,
            quoteId: this.quoteId,
            engagementStats: this.engagementStats,
            timestamp: this.timestamp,
            threadContext: this.threadContext,
            individualMediaUrls: this.individualMediaUrls,
            quotedMediaUrls: this.quotedMediaUrls,
            quotedAuthor: this.quotedAuthor,
            quotedText: this.quotedText,
            quotedTweetId: this.quotedTweetId
        };
    }

    /**
     * Create a Tweet instance from JSON
     * @param {Object} json - JSON object
     * @returns {Tweet} New Tweet instance
     */
    static fromJSON(json) {
        return new Tweet(json);
    }

    /**
     * Create a Tweet instance from DOM element
     * @param {Element} tweetArticle - DOM element
     * @returns {Tweet} New Tweet instance
     */
    static fromDOM(tweetArticle) {
        return new Tweet(tweetArticle);
    }

    /**
     * Check if tweet is from a blacklisted author
     * @returns {boolean}
     */
    isAuthorBlacklisted() {
        return isUserBlacklisted(this.author);
    }

    /**
     * Check if tweet should be filtered based on score and threshold
     * @param {number} threshold - Filter threshold
     * @returns {boolean}
     */
    shouldBeFiltered(threshold) {
        if (this.isAd || (this.author && adAuthorCache.has(this.author))) {
            return true;
        }
        
        if (this.isAuthorBlacklisted()) {
            return false; // Don't filter blacklisted authors, just mark them
        }
        
        if (this.state === TweetState.PENDING || this.state === TweetState.STREAMING) {
            return false; // Don't filter while processing
        }
        
        const score = this.rating?.score;
        return score !== null && score !== undefined && score < threshold;
    }
} 