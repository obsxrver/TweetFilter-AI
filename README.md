# X/Twitter De-Sloppifier

Advanced tweet rating and filtering userscript with model selection, enhanced rating indicators, API retry functionalities, and handle management.

![Tweet Analysis Example](images/analysis-example.png)

## Features

- **Tweet Rating**: Automatically rates tweets on a scale from 1-10 using AI
- **Filtering System**: Hide low-quality tweets based on your chosen threshold
- **Model Selection**: Choose from multiple AI models for tweet rating
- **Image Processing**: Dedicated image model for analyzing tweet images
- **Handle Management**: Auto-rate specific accounts as 10/10
- **Custom Instructions**: Define your own criteria for how tweets should be rated
- **Dark Theme UI**: Sleek interface matching X's design language
- **Parameter Control**: Adjust temperature and top-p values for both models

## Installation

1. Install a userscript manager like [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/)
2. Install X/Twitter De-Sloppifier from [GreasyFork](https://greasyfork.org/en/scripts/placeholder-link)
3. Get an API key from [OpenRouter](https://openrouter.ai/)
4. Configure the script with your API key

## Usage

After installation:

1. Navigate to Twitter/X
2. The minimum score filter will appear in the top-right corner
3. Click "Open Menu" to access the full settings
4. Input your OpenRouter API key
5. Choose your preferred models and settings
6. Save settings and enjoy a cleaner Twitter experience

![Menu Display](images/menu-display.png)

## Configuration

### Rating Model Settings

- Select any OpenRouter-compatible model for tweet rating
- Adjust temperature and top-p parameters to control randomness
- Create custom rating instructions to personalize scoring criteria

### Image Model Settings

- Choose a vision-capable model for image analysis
- Control generation parameters separately from the main model

### Handle Management

- Add Twitter handles to automatically rate as 10/10
- Useful for accounts you always want to see

## How It Works

The userscript analyzes tweets using AI to determine their quality based on:

1. **Text Content**: Evaluates writing quality, information value, and relevance
2. **Media Analysis**: Uses vision-capable models to understand images in tweets
3. **Context Recognition**: Considers conversations and quoted tweets for better rating
4. **Custom Criteria**: Applies your personalized rating instructions

Each tweet receives a score from 1-10, which is displayed in the top-right corner. Low-scoring tweets can be automatically hidden based on your threshold setting.

## Prerequisites

- An OpenRouter API key
- A userscript manager extension
- Twitter/X account

## Limitations

- API call limits based on your OpenRouter plan
- Only works on Twitter/X web interface, not the mobile app
- Processing tweets may take a moment depending on the model selected

## Contributing

Contributions are welcome! Feel free to submit issues or pull requests.

## License

This userscript is provided as-is under the MIT License.

## Acknowledgments

- Thanks to OpenRouter for providing model access
- Inspired by the need for a better social media experience
