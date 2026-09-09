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

Ratings use a bounded, disposable cache: up to 256 entries and 1 MiB of serialized
entry data, with entries expiring after 30 days. Least recently used entries are
evicted first. Entries larger than 32 KiB (including long conversations or embedded
uploads) are not cached; their older cached version is removed to avoid stale results.

Updates are batched every 1.5 seconds into 16 storage buckets. Only changed buckets
are written. Hiding or leaving the page flushes pending changes; clearing the cache
flushes immediately. A browser process killed before a flush can lose recent updates.
Storage failures disable persistence for the current page while the bounded memory
cache remains available. Reloading retries persistence; Clear Rating Cache also retries.

Valid legacy ratings migrate automatically within these limits. Legacy payloads over
4 MiB, corrupt records, expired entries, and interrupted streams are discarded.
Cache reads return independent snapshots; use `tweetCache.set(id, patch)` for changes.
The old immediate-save argument is accepted for compatibility but writes are batched.

Run regression tests with `node --test tests/*.test.js` and rebuild the userscript
with `python combine-src.py`.
