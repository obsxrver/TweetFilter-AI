# TweetFilter-AI

Analyze and discuss tweets with an LLM. Custom AI-Powered analysis for X.com

<div align="center">
  <img src="https://raw.githubusercontent.com/obsxrver/TweetFilter-AI/refs/heads/main/images/UI-General.jpg" width="800" alt="General UI"/>
</div>


## Key Features

- 🧠 **AI-Powered Rating**: Rates tweets from 1-10 based on quality
- 🎯 **Smart Filtering**: Hides low-quality content based on your threshold
- 💬 **Conversations**: Chat with AI about any tweet to learn more 
- 📝 **Custom Instructions**: Define your own rating criteria
- 🧵 **Thread Context**: Understands full conversation context

## Installation

1. Download Tampermonkey https://www.tampermonkey.net/
2. Install the UserScript https://greasyfork.org/en/scripts/532459-tweetfilter-ai?version=1916539
3. Add your https://openrouter.ai API key in settings


## Configuration

<div align="center">
  <img src="https://raw.githubusercontent.com/obsxrver/TweetFilter-AI/refs/heads/main/images/UI-Instructions.jpg" width="400" alt="Custom Instructions" style="margin-right: 10px;"/>
  <img src="https://raw.githubusercontent.com/obsxrver/TweetFilter-AI/refs/heads/main/images/UI-Models.jpg" width="400" alt="Model Selection" style="margin-left: 10px;"/>
</div>


### AI Rating System
- Uses advanced language models to evaluate tweet quality
- Considers text, images, and full conversation context
- Live streaming shows the AI's thought process in real-time

<div align="center">
  <img src="https://raw.githubusercontent.com/obsxrver/TweetFilter-AI/refs/heads/main/images/Streaming-Description.jpg" width="800" alt="Live Streaming Analysis"/>
</div>

### Customization
- Choose from multiple AI models
- Set custom rating criteria
- Adjust filtering threshold
- Fine-tune model parameters
- Whitelist favorite accounts

### Thread Analysis
- Maps conversation hierarchies
- Analyzes full context of replies
- Processes all media in threads
- Optimized for performance

## Requirements

- Twitter/X web interface
- Userscript manager extension
- OpenRouter API key

---

Made with ❤️ for a better social media experience


## Cache behavior

Ratings and follow-up conversations are stored under independent tweet keys with a
small index. There is no application entry-count, age, or per-conversation size cutoff.
Completed ratings and conversations are saved immediately. Intermediate streaming
updates are batched for 1.5 seconds; hiding or leaving the page flushes them.
If one storage write fails, other ratings can still save and the failed entry is
retried on the next update or page hide. The browser's storage quota still applies.

Legacy `tweetRatings` data and numbered `tweetRatings.v2.*` buckets are imported
and removed only after their replacement entries and index are saved. Interrupted
streams are discarded. Image-capable model metadata is kept only for the two
selected models instead of storing the full list of model IDs.
Cache reads return independent snapshots; use `tweetCache.set(id, patch)` for changes.
The old immediate-save argument is accepted for compatibility; completed results save
immediately regardless of that flag.

Run regression tests with `node --test tests/*.test.js` and rebuild the userscript
with `python combine-src.py`.
