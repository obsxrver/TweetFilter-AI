# TweetFilter AI Chrome Extension

A highly customizable AI that rates tweets 1-10 and removes all the slop, saving your braincells!

## Features

- Rate tweets on a scale of 1-10 using AI
- Customizable filtering threshold
- Support for multiple AI models via OpenRouter
- Image description capabilities
- Custom instructions for tweet rating
- Cached ratings for performance
- Beautiful and intuitive UI

## Installation

1. Clone this repository or download the latest release
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory

## Setup

1. Get an API key from [OpenRouter](https://openrouter.ai/settings/keys)
2. Click the extension settings icon (⚙️) on Twitter/X
3. Enter your API key in the General tab
4. Customize your settings and start filtering!

## Development

```bash
# Install dependencies
npm install

# Build the extension
npm run build

# Package for distribution
npm run package
```

## License

MIT License - See LICENSE file for details
