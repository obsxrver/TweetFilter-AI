// ==UserScript==
// @name         TweetFilter AI
// @namespace    http://tampermonkey.net/
// @version      Version 1.5.6
// @description  A highly customizable AI rates tweets 1-10 and removes all the slop, saving your braincells!
// @author       Obsxrver(3than)
// @match        *://twitter.com/*
// @match        *://x.com/*
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @grant        GM_getResourceText
// @connect      openrouter.ai
// @run-at       document-idle
// @license      MIT
// ==/UserScript==
(function() {
    'use strict';
    // Embedded Menu.html
    const MENU = `<div id="tweetfilter-root-container"><button id="filter-toggle" class="toggle-button" style="display: none;">Filter Slider</button><div id="tweet-filter-container"><button class="close-button" data-action="close-filter">×</button><label for="tweet-filter-slider">SlopScore:</label><div class="filter-controls"><input type="range" id="tweet-filter-slider" min="0" max="10" step="1"><input type="number" id="tweet-filter-value" min="0" max="10" step="1" value="5"></div></div><button id="settings-toggle" class="toggle-button" data-action="toggle-settings"><span style="font-size: 14px;">⚙️</span> Settings</button><div id="settings-container" class="hidden"><div class="settings-header"><div class="settings-title">Twitter De-Sloppifier</div><button class="close-button" data-action="toggle-settings">×</button></div><div class="settings-content"><div class="tab-navigation"><button class="tab-button active" data-tab="general">General</button><button class="tab-button" data-tab="models">Models</button><button class="tab-button" data-tab="instructions">Instructions</button></div><div id="general-tab" class="tab-content active"><div class="section-title"><span style="font-size: 14px;">🔑</span> OpenRouter API Key <a href="https://openrouter.ai/settings/keys" target="_blank">Get one here</a></div><input id="openrouter-api-key" placeholder="Enter your OpenRouter API key"><button class="settings-button" data-action="save-api-key">Save API Key</button><div class="section-title" style="margin-top: 20px;"><span style="font-size: 14px;">🗄️</span> Cache Statistics</div><div class="stats-container"><div class="stats-row"><div class="stats-label">Cached Tweet Ratings</div><div class="stats-value" id="cached-ratings-count">0</div></div><div class="stats-row"><div class="stats-label">Whitelisted Handles</div><div class="stats-value" id="whitelisted-handles-count">0</div></div></div><button id="clear-cache" class="settings-button danger" data-action="clear-cache">Clear Rating Cache</button><div class="section-title" style="margin-top: 20px;"><span style="font-size: 14px;">💾</span> Backup &amp; Restore</div><div class="section-description">Export your settings and cached ratings to a file for backup, or import previously saved settings.</div><button class="settings-button" data-action="export-cache">Export Cache</button><button class="settings-button danger" style="margin-top: 15px;" data-action="reset-settings">Reset to Defaults</button><div id="version-info" style="margin-top: 20px; font-size: 11px; opacity: 0.6; text-align: center;">Twitter De-Sloppifier v?.?</div></div><div id="models-tab" class="tab-content"><div class="section-title"><span style="font-size: 14px;">🧠</span> Tweet Rating Model</div><div class="section-description">The rating model is responsible for reviewing each tweet. <br>It will process images directly if you select an <strong>image-capable (🖼️)</strong> model.</div><div class="select-container" id="model-select-container"></div><div class="advanced-options"><div class="advanced-toggle" data-toggle="model-options-content"><div class="advanced-toggle-title">Options</div><div class="advanced-toggle-icon">▼</div></div><div class="advanced-content" id="model-options-content"><div class="sort-container"><label for="model-sort-order">Sort models by: </label><div class="controls-group"><select id="model-sort-order" data-setting="modelSortOrder"><option value="pricing-low-to-high">Price</option><option value="latency-low-to-high">Latency</option><option value="throughput-high-to-low">Throughput</option><option value="top-weekly">Popularity</option><option value="">Age</option></select><button id="sort-direction" class="sort-toggle" data-setting="sortDirection" data-value="default">High-Low</button></div></div><div class="sort-container"><label for="provider-sort">API Endpoint Priority: </label><select id="provider-sort" data-setting="providerSort"><option value="">Default (load-balanced)</option><option value="throughput">Throughput</option><option value="latency">Latency</option><option value="price">Price</option></select></div><div class="sort-container"><label><input type="checkbox" id="show-free-models" data-setting="showFreeModels" checked>Show Free Models</label></div><div class="parameter-row" data-param-name="modelTemperature"><div class="parameter-label" title="How random the model responses should be (0.0-1.0)">Temperature</div><div class="parameter-control"><input type="range" class="parameter-slider" min="0" max="2" step="0.1"><input type="number" class="parameter-value" min="0" max="2" step="0.01" style="width: 60px;"></div></div><div class="parameter-row" data-param-name="modelTopP"><div class="parameter-label" title="Nucleus sampling parameter (0.0-1.0)">Top-p</div><div class="parameter-control"><input type="range" class="parameter-slider" min="0" max="1" step="0.1"><input type="number" class="parameter-value" min="0" max="1" step="0.01" style="width: 60px;"></div></div><div class="parameter-row" data-param-name="maxTokens"><div class="parameter-label" title="Maximum number of tokens for the response (0 means no limit)">Max Tokens</div><div class="parameter-control"><input type="range" class="parameter-slider" min="0" max="2000" step="100"><input type="number" class="parameter-value" min="0" max="2000" step="100" style="width: 60px;"></div></div><div class="toggle-row"><div class="toggle-label" title="Stream API responses as they're generated for live updates">Enable Live Streaming</div><label class="toggle-switch"><input type="checkbox" data-setting="enableStreaming"><span class="toggle-slider"></span></label></div><div class="toggle-row"><div class="toggle-label" title="Enable web search capabilities for the model. Appends ':online' to the model slug.">Enable Web Search</div><label class="toggle-switch"><input type="checkbox" data-setting="enableWebSearch"><span class="toggle-slider"></span></label></div><div class="toggle-row"><div class="toggle-label" title="Automatically send tweets to API for rating. When disabled, tweets will show a 'Rate' button instead.">Auto-Rate Tweets</div><label class="toggle-switch"><input type="checkbox" data-setting="enableAutoRating"><span class="toggle-slider"></span></label></div></div></div><div class="section-title" style="margin-top: 25px;"><span style="font-size: 14px;">🖼️</span> Image Processing Model</div><div class="section-description">This model generates <strong>text descriptions</strong> of images for the rating model.<br> Hint: If you selected an image-capable model (🖼️) as your <strong>main rating model</strong>, it will process images directly.</div><div class="toggle-row"><div class="toggle-label">Enable Image Descriptions</div><label class="toggle-switch"><input type="checkbox" data-setting="enableImageDescriptions"><span class="toggle-slider"></span></label></div><div id="image-model-container" style="display: none;"><div class="select-container" id="image-model-select-container"></div><div class="advanced-options" id="image-advanced-options"><div class="advanced-toggle" data-toggle="image-advanced-content"><div class="advanced-toggle-title">Options</div><div class="advanced-toggle-icon">▼</div></div><div class="advanced-content" id="image-advanced-content"><div class="parameter-row" data-param-name="imageModelTemperature"><div class="parameter-label" title="Randomness for image descriptions (0.0-1.0)">Temperature</div><div class="parameter-control"><input type="range" class="parameter-slider" min="0" max="2" step="0.1"><input type="number" class="parameter-value" min="0" max="2" step="0.1" style="width: 60px;"></div></div><div class="parameter-row" data-param-name="imageModelTopP"><div class="parameter-label" title="Nucleus sampling for image model (0.0-1.0)">Top-p</div><div class="parameter-control"><input type="range" class="parameter-slider" min="0" max="1" step="0.1"><input type="number" class="parameter-value" min="0" max="1" step="0.1" style="width: 60px;"></div></div></div></div></div></div><div id="instructions-tab" class="tab-content"><div class="section-title">Custom Instructions</div><div class="section-description">Add custom instructions for how the model should score tweets:</div><textarea id="user-instructions" placeholder="Examples:- Give high scores to tweets about technology- Penalize clickbait-style tweets- Rate educational content higher" data-setting="userDefinedInstructions" value=""></textarea><button class="settings-button" data-action="save-instructions">Save Instructions</button><div class="advanced-options" id="instructions-history"><div class="advanced-toggle" data-toggle="instructions-history-content"><div class="advanced-toggle-title">Custom Instructions History</div><div class="advanced-toggle-icon">▼</div></div><div class="advanced-content" id="instructions-history-content"><div class="instructions-list" id="instructions-list"><!-- Instructions entries will be added here dynamically --></div><button class="settings-button danger" style="margin-top: 10px;" data-action="clear-instructions-history">Clear All History</button></div></div><div class="section-title" style="margin-top: 20px;">Auto-Rate Handles as 10/10</div><div class="section-description">Add Twitter handles to automatically rate as 10/10:</div><div class="handle-input-container"><input id="handle-input" type="text" placeholder="Twitter handle (without @)"><button class="add-handle-btn" data-action="add-handle">Add</button></div><div class="handle-list" id="handle-list"></div></div></div><div id="status-indicator" class=""></div></div><div id="tweet-filter-stats-badge" class="tweet-filter-stats-badge"></div></div>`;
    // Embedded style.css
    const STYLE = `.refreshing {animation: spin 1s infinite linear;}@keyframes spin {0% {transform: rotate(0deg);}100% {transform: rotate(360deg);}}.score-highlight {display: inline-block;background-color: #1d9bf0;color: white;padding: 3px 10px;border-radius: 9999px;margin: 8px 0;font-weight: bold;font-size: 0.9em;}.mobile-tooltip {max-width: 90vw;}.score-description.streaming-tooltip {scroll-behavior: smooth;border-left: 3px solid #1d9bf0;background-color: rgba(25, 30, 35, 0.98);}.score-description.streaming-tooltip::before {content: 'Live';position: absolute;top: 10px;right: 10px;background-color: #1d9bf0;color: white;font-size: 11px;padding: 2px 6px;border-radius: 10px;font-weight: bold;}.score-description::-webkit-scrollbar {width: 8px;}.score-description::-webkit-scrollbar-track {background: rgba(22, 24, 28, 0.1);border-radius: 4px;}.score-description::-webkit-scrollbar-thumb {background: rgba(255, 255, 255, 0.3);border-radius: 4px;border: 1px solid rgba(22, 24, 28, 0.2);}.score-description::-webkit-scrollbar-thumb:hover {background: rgba(255, 255, 255, 0.5);}.score-description.streaming-tooltip p::after {content: '|';display: inline-block;color: #1d9bf0;animation: blink 0.7s infinite;font-weight: bold;margin-left: 2px;}@keyframes blink {0%,100% {opacity: 0;}50% {opacity: 1;}}.streaming-rating {background-color: rgba(33, 150, 243, 0.9) !important;color: white !important;animation: pulse 1.5s infinite alternate;position: relative;}.streaming-rating::after {content: '';position: absolute;top: -2px;right: -2px;width: 6px;height: 6px;background-color: #1d9bf0;border-radius: 50%;animation: blink 0.7s infinite;box-shadow: 0 0 4px #1d9bf0;}.cached-rating {background-color: rgba(76, 175, 80, 0.9) !important;color: white !important;}.rated-rating {background-color: rgba(33, 33, 33, 0.9) !important;color: white !important;}.blacklisted-rating {background-color: rgba(255, 193, 7, 0.9) !important;color: black !important;}.pending-rating {background-color: rgba(255, 152, 0, 0.9) !important;color: white !important;}.manual-rating {background-color: rgba(33, 150, 243, 0.7) !important;color: white !important;border: 2px dashed rgba(33, 150, 243, 0.8) !important;}.blacklisted-author-indicator {background-color: purple !important; color: white !important;}@keyframes pulse {0% {opacity: 0.8;}100% {opacity: 1;}}.error-rating {background-color: rgba(244, 67, 54, 0.9) !important;color: white !important;}#status-indicator {position: fixed;bottom: 20px;right: 20px;background-color: rgba(22, 24, 28, 0.95);color: #e7e9ea;padding: 10px 15px;border-radius: 8px;font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;font-size: 12px;z-index: 9999;display: none;border: 1px solid rgba(255, 255, 255, 0.1);box-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);transform: translateY(100px);transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);}#status-indicator.active {display: block;transform: translateY(0);}.toggle-switch {position: relative;display: inline-block;width: 36px;height: 20px;}.toggle-switch input {opacity: 0;width: 0;height: 0;}.toggle-slider {position: absolute;cursor: pointer;top: 0;left: 0;right: 0;bottom: 0;background-color: rgba(255, 255, 255, 0.2);transition: .3s;border-radius: 34px;}.toggle-slider:before {position: absolute;content: "";height: 16px;width: 16px;left: 2px;bottom: 2px;background-color: white;transition: .3s;border-radius: 50%;}input:checked+.toggle-slider {background-color: #1d9bf0;}input:checked+.toggle-slider:before {transform: translateX(16px);}.toggle-row {display: flex;align-items: center;justify-content: space-between;padding: 8px 10px;margin-bottom: 12px;background-color: rgba(255, 255, 255, 0.05);border-radius: 8px;transition: background-color 0.2s;}.toggle-row:hover {background-color: rgba(255, 255, 255, 0.08);}.toggle-label {font-size: 13px;color: #e7e9ea;}#tweet-filter-container {position: fixed;top: 70px;right: 15px;background-color: rgba(22, 24, 28, 0.95);color: #e7e9ea;padding: 10px 12px;border-radius: 12px;z-index: 9999;font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;font-size: 13px;box-shadow: 0 2px 12px rgba(0, 0, 0, 0.5);display: flex;align-items: center;gap: 10px;border: 1px solid rgba(255, 255, 255, 0.1);transform-origin: top right;transition: transform 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55), opacity 0.5s ease-in-out;opacity: 1;transform: scale(1) translateX(0);visibility: visible;}#tweet-filter-container.hidden {opacity: 0;transform: scale(0.8) translateX(50px);visibility: hidden;}.close-button {background: none;border: none;color: #e7e9ea;font-size: 16px;cursor: pointer;padding: 0;width: 28px;height: 28px;display: flex;align-items: center;justify-content: center;opacity: 0.8;transition: opacity 0.2s;border-radius: 50%;min-width: 28px;min-height: 28px;-webkit-tap-highlight-color: transparent;touch-action: manipulation;user-select: none;z-index: 30;}.close-button:hover {opacity: 1;background-color: rgba(255, 255, 255, 0.1);}.hidden {display: none !important;}#tweet-filter-container.hidden,#settings-container.hidden {display: flex !important;}.toggle-button {position: fixed;right: 15px;background-color: rgba(22, 24, 28, 0.95);color: #e7e9ea;padding: 8px 12px;border-radius: 8px;cursor: pointer;font-size: 12px;z-index: 9999;border: 1px solid rgba(255, 255, 255, 0.1);box-shadow: 0 2px 12px rgba(0, 0, 0, 0.5);font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;display: flex;align-items: center;gap: 6px;transition: all 0.2s ease;}.toggle-button:hover {background-color: rgba(29, 155, 240, 0.2);}#filter-toggle {top: 70px;}#settings-toggle {top: 120px;}#tweet-filter-container label {margin: 0;font-weight: bold;}.tweet-filter-stats-badge {position: fixed;bottom: 50px;right: 20px;background-color: rgba(29, 155, 240, 0.9);color: white;padding: 5px 10px;border-radius: 15px;font-size: 12px;z-index: 9999;box-shadow: 0 2px 5px rgba(0,0,0,0.2);transition: opacity 0.3s;cursor: pointer;display: flex;align-items: center;}#tweet-filter-slider {cursor: pointer;width: 120px;vertical-align: middle;-webkit-appearance: none;appearance: none;height: 6px;border-radius: 3px;background: linear-gradient(to right,#FF0000 0%,#FF8800 calc(var(--slider-percent, 50%) * 0.166),#FFFF00 calc(var(--slider-percent, 50%) * 0.333),#00FF00 calc(var(--slider-percent, 50%) * 0.5),#00FFFF calc(var(--slider-percent, 50%) * 0.666),#0000FF calc(var(--slider-percent, 50%) * 0.833),#800080 var(--slider-percent, 50%),#DEE2E6 var(--slider-percent, 50%),#DEE2E6 100%);}#tweet-filter-slider::-webkit-slider-thumb {-webkit-appearance: none;appearance: none;width: 16px;height: 16px;border-radius: 50%;background: #1d9bf0;cursor: pointer;border: 2px solid white;box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);transition: transform 0.1s;}#tweet-filter-slider::-webkit-slider-thumb:hover {transform: scale(1.2);}#tweet-filter-slider::-moz-range-thumb {width: 16px;height: 16px;border-radius: 50%;background: #1d9bf0;cursor: pointer;border: 2px solid white;box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);transition: transform 0.1s;}#tweet-filter-slider::-moz-range-thumb:hover {transform: scale(1.2);}#tweet-filter-value {min-width: 20px;text-align: center;font-weight: bold;background-color: rgba(255, 255, 255, 0.1);padding: 2px 5px;border-radius: 4px;}#settings-container {position: fixed;top: 70px;right: 15px;background-color: rgba(22, 24, 28, 0.95);color: #e7e9ea;padding: 0;border-radius: 16px;z-index: 9999;font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;font-size: 13px;box-shadow: 0 2px 18px rgba(0, 0, 0, 0.6);display: flex;flex-direction: column;width: 90vw;max-width: 380px;max-height: 85vh;overflow: hidden;border: 1px solid rgba(255, 255, 255, 0.1);line-height: 1.3;transform-origin: top right;transition: transform 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55),opacity 0.5s ease-in-out;opacity: 1;transform: scale(1) translateX(0);visibility: visible;}#settings-container.hidden {opacity: 0;transform: scale(0.8) translateX(50px);visibility: hidden;}.settings-header {padding: 12px 15px;border-bottom: 1px solid rgba(255, 255, 255, 0.1);display: flex;justify-content: space-between;align-items: center;position: sticky;top: 0;background-color: rgba(22, 24, 28, 0.98);z-index: 20;border-radius: 16px 16px 0 0;}.settings-title {font-weight: bold;font-size: 16px;}.settings-content {overflow-y: auto;max-height: calc(85vh - 110px);padding: 0;}.settings-content::-webkit-scrollbar {width: 6px;}.settings-content::-webkit-scrollbar-track {background: rgba(255, 255, 255, 0.05);border-radius: 3px;}.settings-content::-webkit-scrollbar-thumb {background: rgba(255, 255, 255, 0.2);border-radius: 3px;}.settings-content::-webkit-scrollbar-thumb:hover {background: rgba(255, 255, 255, 0.3);}.tab-navigation {display: flex;border-bottom: 1px solid rgba(255, 255, 255, 0.1);position: sticky;top: 0;background-color: rgba(22, 24, 28, 0.98);z-index: 10;padding: 10px 15px;gap: 8px;}.tab-button {padding: 6px 10px;background: none;border: none;color: #e7e9ea;font-weight: bold;cursor: pointer;border-radius: 8px;transition: all 0.2s ease;font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;font-size: 13px;flex: 1;text-align: center;}.tab-button:hover {background-color: rgba(255, 255, 255, 0.1);}.tab-button.active {color: #1d9bf0;background-color: rgba(29, 155, 240, 0.1);border-bottom: 2px solid #1d9bf0;}.tab-content {display: none;animation: fadeIn 0.3s ease;padding: 15px;}@keyframes fadeIn {from {opacity: 0;}to {opacity: 1;}}.tab-content.active {display: block;}.select-container {position: relative;margin-bottom: 15px;}.select-container .search-field {position: sticky;top: 0;background-color: rgba(39, 44, 48, 0.95);padding: 8px;border-bottom: 1px solid rgba(255, 255, 255, 0.1);z-index: 1;}.select-container .search-input {width: 100%;padding: 8px 10px;border-radius: 8px;border: 1px solid rgba(255, 255, 255, 0.2);background-color: rgba(39, 44, 48, 0.9);color: #e7e9ea;font-size: 12px;transition: border-color 0.2s;}.select-container .search-input:focus {border-color: #1d9bf0;outline: none;}.custom-select {position: relative;display: inline-block;width: 100%;}.select-selected {background-color: rgba(39, 44, 48, 0.95);color: #e7e9ea;padding: 10px 12px;border: 1px solid rgba(255, 255, 255, 0.2);border-radius: 8px;cursor: pointer;user-select: none;display: flex;justify-content: space-between;align-items: center;font-size: 13px;transition: border-color 0.2s;}.select-selected:hover {border-color: rgba(255, 255, 255, 0.4);}.select-selected:after {content: "";width: 8px;height: 8px;border: 2px solid #e7e9ea;border-width: 0 2px 2px 0;display: inline-block;transform: rotate(45deg);margin-left: 10px;transition: transform 0.2s;}.select-selected.select-arrow-active:after {transform: rotate(-135deg);}.select-items {position: absolute;background-color: rgba(39, 44, 48, 0.98);top: 100%;left: 0;right: 0;z-index: 99;max-height: 300px;overflow-y: auto;border: 1px solid rgba(255, 255, 255, 0.2);border-radius: 8px;margin-top: 5px;box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);display: none;}.select-items div {color: #e7e9ea;padding: 10px 12px;cursor: pointer;user-select: none;transition: background-color 0.2s;border-bottom: 1px solid rgba(255, 255, 255, 0.05);}.select-items div:hover {background-color: rgba(29, 155, 240, 0.1);}.select-items div.same-as-selected {background-color: rgba(29, 155, 240, 0.2);}.select-items::-webkit-scrollbar {width: 6px;}.select-items::-webkit-scrollbar-track {background: rgba(255, 255, 255, 0.05);}.select-items::-webkit-scrollbar-thumb {background: rgba(255, 255, 255, 0.2);border-radius: 3px;}.select-items::-webkit-scrollbar-thumb:hover {background: rgba(255, 255, 255, 0.3);}#openrouter-api-key,#user-instructions {width: 100%;padding: 10px 12px;border-radius: 8px;border: 1px solid rgba(255, 255, 255, 0.2);margin-bottom: 12px;background-color: rgba(39, 44, 48, 0.95);color: #e7e9ea;font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;font-size: 13px;transition: border-color 0.2s;}#openrouter-api-key:focus,#user-instructions:focus {border-color: #1d9bf0;outline: none;}#user-instructions {height: 120px;resize: vertical;}.parameter-row {display: flex;align-items: center;margin-bottom: 12px;gap: 8px;padding: 6px;border-radius: 8px;transition: background-color 0.2s;}.parameter-row:hover {background-color: rgba(255, 255, 255, 0.05);}.parameter-label {flex: 1;font-size: 13px;color: #e7e9ea;}.parameter-control {flex: 1.5;display: flex;align-items: center;gap: 8px;}.parameter-value {min-width: 28px;text-align: center;background-color: rgba(255, 255, 255, 0.1);padding: 3px 5px;border-radius: 4px;font-size: 12px;}.parameter-slider {flex: 1;-webkit-appearance: none;height: 4px;border-radius: 4px;background: rgba(255, 255, 255, 0.2);outline: none;cursor: pointer;}.parameter-slider::-webkit-slider-thumb {-webkit-appearance: none;appearance: none;width: 14px;height: 14px;border-radius: 50%;background: #1d9bf0;cursor: pointer;transition: transform 0.1s;}.parameter-slider::-webkit-slider-thumb:hover {transform: scale(1.2);}.section-title {font-weight: bold;margin-top: 20px;margin-bottom: 8px;color: #e7e9ea;display: flex;align-items: center;gap: 6px;font-size: 14px;}.section-title:first-child {margin-top: 0;}.section-description {font-size: 12px;margin-bottom: 8px;opacity: 0.8;line-height: 1.4;}.section-title a {color: #1d9bf0;text-decoration: none;background-color: rgba(255, 255, 255, 0.1);padding: 3px 6px;border-radius: 6px;transition: all 0.2s ease;}.section-title a:hover {background-color: rgba(29, 155, 240, 0.2);text-decoration: underline;}.advanced-options {margin-top: 5px;margin-bottom: 15px;border: 1px solid rgba(255, 255, 255, 0.1);border-radius: 8px;padding: 12px;background-color: rgba(255, 255, 255, 0.03);overflow: hidden;}.advanced-toggle {display: flex;justify-content: space-between;align-items: center;cursor: pointer;margin-bottom: 5px;}.advanced-toggle-title {font-weight: bold;font-size: 13px;color: #e7e9ea;}.advanced-toggle-icon {transition: transform 0.3s;}.advanced-toggle-icon.expanded {transform: rotate(180deg);}.advanced-content {max-height: 0;overflow: hidden;transition: max-height 0.3s ease-in-out;}.advanced-content.expanded {max-height: none;}#instructions-history-content.expanded {max-height: none !important;}#instructions-history .instructions-list {max-height: 400px;overflow-y: auto;margin-bottom: 10px;}.handle-list {margin-top: 10px;max-height: 120px;overflow-y: auto;border: 1px solid rgba(255, 255, 255, 0.1);border-radius: 8px;padding: 5px;}.handle-item {display: flex;align-items: center;justify-content: space-between;padding: 6px 10px;border-bottom: 1px solid rgba(255, 255, 255, 0.05);border-radius: 4px;transition: background-color 0.2s;}.handle-item:hover {background-color: rgba(255, 255, 255, 0.05);}.handle-item:last-child {border-bottom: none;}.handle-text {font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;font-size: 12px;}.remove-handle {background: none;border: none;color: #ff5c5c;cursor: pointer;font-size: 14px;padding: 0 3px;opacity: 0.7;transition: opacity 0.2s;}.remove-handle:hover {opacity: 1;}.add-handle-btn {background-color: #1d9bf0;color: white;border: none;border-radius: 6px;padding: 7px 10px;cursor: pointer;font-weight: bold;font-size: 12px;margin-left: 5px;transition: background-color 0.2s;}.add-handle-btn:hover {background-color: #1a8cd8;}.settings-button {background-color: #1d9bf0;color: white;border: none;border-radius: 8px;padding: 10px 14px;cursor: pointer;font-weight: bold;transition: background-color 0.2s;font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;margin-top: 8px;width: 100%;font-size: 13px;}.settings-button:hover {background-color: #1a8cd8;}.settings-button.secondary {background-color: rgba(255, 255, 255, 0.1);}.settings-button.secondary:hover {background-color: rgba(255, 255, 255, 0.15);}.settings-button.danger {background-color: #ff5c5c;}.settings-button.danger:hover {background-color: #e53935;}.button-row {display: flex;gap: 8px;margin-top: 10px;}.button-row .settings-button {margin-top: 0;}.stats-container {background-color: rgba(255, 255, 255, 0.05);padding: 10px;border-radius: 8px;margin-bottom: 15px;}.stats-row {display: flex;justify-content: space-between;padding: 5px 0;border-bottom: 1px solid rgba(255, 255, 255, 0.1);}.stats-row:last-child {border-bottom: none;}.stats-label {font-size: 12px;opacity: 0.8;}.stats-value {font-weight: bold;}.score-indicator {position: absolute;top: 10px;right: 10.5%;background-color: rgba(22, 24, 28, 0.9);color: #e7e9ea;padding: 4px 10px;border-radius: 8px;font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;font-size: 14px;font-weight: bold;z-index: 100;cursor: pointer;border: 1px solid rgba(255, 255, 255, 0.1);min-width: 20px;text-align: center;box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);transition: transform 0.15s ease;}.score-indicator:hover {transform: scale(1.05);}.score-indicator.mobile-indicator {position: absolute !important;bottom: 3% !important;right: 10px !important;top: auto !important;}.score-description {display: flex;flex-direction: column;background-color: rgba(22, 24, 28, 0.95);color: #e7e9ea;padding: 0;border-radius: 12px;box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;font-size: 16px;line-height: 1.5;z-index: 99999999;position: absolute;width: 600px !important;max-width: 85vw !important;max-height: 70vh;border: 1px solid rgba(255, 255, 255, 0.1);word-wrap: break-word;box-sizing: border-box !important;}.tooltip-scrollable-content {flex-grow: 1;overflow-y: auto;min-height: 0;padding: 10px 20px;padding-right: 25px;padding-bottom: 120px;line-height: 1.55;}.tooltip-scrollable-content::-webkit-scrollbar {width: 8px;}.tooltip-scrollable-content::-webkit-scrollbar-track {background: rgba(22, 24, 28, 0.1);border-radius: 4px;}.tooltip-scrollable-content::-webkit-scrollbar-thumb {background: rgba(255, 255, 255, 0.3);border-radius: 4px;border: 1px solid rgba(22, 24, 28, 0.2);}.tooltip-scrollable-content::-webkit-scrollbar-thumb:hover {background: rgba(255, 255, 255, 0.5);}.score-description.pinned {border: 2px solid #1d9bf0 !important;}.tooltip-controls {display: flex !important;justify-content: flex-end !important;position: relative !important;margin: 0 !important;top: 0 !important;background-color: rgba(39, 44, 48, 0.95) !important;padding: 12px 15px !important;z-index: 2 !important;border-top-left-radius: 12px !important;border-top-right-radius: 12px !important;border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;backdrop-filter: blur(5px) !important;flex-shrink: 0;}.tooltip-pin-button,.tooltip-copy-button {background: none !important;border: none !important;color: #8899a6 !important;cursor: pointer !important;font-size: 16px !important;padding: 4px 8px !important;margin-left: 8px !important;border-radius: 4px !important;transition: all 0.2s !important;}.tooltip-pin-button:hover,.tooltip-copy-button:hover {background-color: rgba(29, 155, 240, 0.1) !important;color: #1d9bf0 !important;}.tooltip-pin-button:active,.tooltip-copy-button:active {transform: scale(0.95) !important;}.tooltip-rate-button {background: none !important;border: none !important;color: #8899a6 !important;cursor: pointer !important;font-size: 16px !important;padding: 4px 8px !important;margin-left: 8px !important;border-radius: 4px !important;transition: all 0.2s !important;}.tooltip-rate-button:hover {background-color: rgba(255, 193, 7, 0.1) !important;color: #ffc107 !important;}.tooltip-rate-button:active {transform: scale(0.95) !important;}.reasoning-text {font-size: 14px !important;line-height: 1.4 !important;color: #ccc !important;margin: 0 !important;padding: 5px !important;}.scroll-to-bottom-button {position: absolute;bottom: 100px;left: 0;right: 0;width: 100%;background-color: rgba(29, 155, 240, 0.9);color: white;text-align: center;padding: 8px 0;cursor: pointer;font-weight: bold;border-top: 1px solid rgba(255, 255, 255, 0.2);z-index: 100;transition: background-color 0.2s;flex-shrink: 0;}.scroll-to-bottom-button:hover {background-color: rgba(29, 155, 240, 1);}.tooltip-bottom-spacer {height: 10px;}.reasoning-dropdown {margin-top: 15px !important;border-top: 1px solid rgba(255, 255, 255, 0.1) !important;padding-top: 10px !important;}.reasoning-toggle {display: flex !important;align-items: center !important;color: #1d9bf0 !important;cursor: pointer !important;font-weight: bold !important;padding: 5px !important;user-select: none !important;}.reasoning-toggle:hover {background-color: rgba(29, 155, 240, 0.1) !important;border-radius: 4px !important;}.reasoning-arrow {display: inline-block !important;margin-right: 5px !important;transition: transform 0.2s ease !important;}.reasoning-content {max-height: 0 !important;overflow: hidden !important;transition: max-height 0.3s ease-out, padding 0.3s ease-out !important;background-color: rgba(0, 0, 0, 0.15) !important;border-radius: 5px !important;margin-top: 5px !important;padding: 0 !important;}.reasoning-dropdown.expanded .reasoning-content {max-height: 350px !important;overflow-y: auto !important;padding: 10px !important;}.reasoning-dropdown.expanded .reasoning-arrow {transform: rotate(90deg) !important;}.reasoning-text {font-size: 14px !important;line-height: 1.4 !important;color: #ccc !important;margin: 0 !important;padding: 5px !important;}@media (max-width: 600px) {.score-indicator {position: absolute !important;bottom: 3% !important;right: 10px !important;top: auto !important;}.score-description {position: fixed !important;width: 100% !important;max-width: 100% !important;top: 5vh !important;bottom: 5vh !important;left: 0 !important;right: 0 !important;margin: 0 !important;padding: 0 !important;box-sizing: border-box !important;overflow: hidden !important;overflow-x: hidden !important;-webkit-overflow-scrolling: touch !important;overscroll-behavior: contain !important;transform: translateZ(0) !important;border-radius: 16px 16px 0 0 !important;}.tooltip-scrollable-content {padding: 10px 15px;padding-bottom: 140px;}.tooltip-custom-question-container {position: relative;width: 100%;box-sizing: border-box;}.reasoning-dropdown.expanded .reasoning-content {max-height: 200px !important;}.close-button {width: 32px;height: 32px;min-width: 32px;min-height: 32px;font-size: 18px;padding: 8px;margin: -4px;}.settings-header .close-button {position: relative;right: 0;}.tooltip-close-button {font-size: 22px !important;width: 32px !important;height: 32px !important;}.tooltip-controls {padding-right: 40px !important;}#filter-toggle {opacity: 0.3;}#settings-toggle {opacity: 0.3;}}.sort-container {margin: 10px 0;display: flex;align-items: center;gap: 10px;justify-content: space-between;}.sort-container label {font-size: 14px;color: var(--text-color);white-space: nowrap;}.sort-container .controls-group {display: flex;gap: 8px;align-items: center;}.sort-container select {padding: 5px 10px;border-radius: 4px;border: 1px solid rgba(255, 255, 255, 0.2);background-color: rgba(39, 44, 48, 0.95);color: #e7e9ea;font-size: 14px;cursor: pointer;min-width: 120px;}.sort-container select:hover {border-color: #1d9bf0;}.sort-container select:focus {outline: none;border-color: #1d9bf0;box-shadow: 0 0 0 2px rgba(29, 155, 240, 0.2);}.sort-toggle {padding: 5px 10px;border-radius: 4px;border: 1px solid rgba(255, 255, 255, 0.2);background-color: rgba(39, 44, 48, 0.95);color: #e7e9ea;font-size: 14px;cursor: pointer;transition: all 0.2s ease;}.sort-toggle:hover {border-color: #1d9bf0;background-color: rgba(29, 155, 240, 0.1);}.sort-toggle.active {background-color: rgba(29, 155, 240, 0.2);border-color: #1d9bf0;}.sort-container select option {background-color: rgba(39, 44, 48, 0.95);color: #e7e9ea;}@media (min-width: 601px) {#settings-container {width: 480px;max-width: 480px;}}#handle-input {flex: 1;padding: 8px 12px;border-radius: 8px;border: 1px solid rgba(255, 255, 255, 0.2);background-color: rgba(39, 44, 48, 0.95);color: #e7e9ea;font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;font-size: 14px;transition: border-color 0.2s;min-width: 200px;}#handle-input:focus {outline: none;border-color: #1d9bf0;box-shadow: 0 0 0 2px rgba(29, 155, 240, 0.2);}#handle-input::placeholder {color: rgba(231, 233, 234, 0.5);}.handle-input-container {display: flex;gap: 8px;align-items: center;margin-bottom: 10px;padding: 5px;border-radius: 8px;background-color: rgba(255, 255, 255, 0.03);}.add-handle-btn {background-color: #1d9bf0;color: white;border: none;border-radius: 8px;padding: 8px 16px;cursor: pointer;font-weight: bold;font-size: 14px;transition: background-color 0.2s;white-space: nowrap;}.add-handle-btn:hover {background-color: #1a8cd8;}.instructions-list {margin-top: 10px;max-height: 200px;overflow-y: auto;border: 1px solid rgba(255, 255, 255, 0.1);border-radius: 8px;padding: 5px;}.instruction-item {display: flex;align-items: center;justify-content: space-between;padding: 8px 10px;border-bottom: 1px solid rgba(255, 255, 255, 0.05);border-radius: 4px;transition: background-color 0.2s;}.instruction-item:hover {background-color: rgba(255, 255, 255, 0.05);}.instruction-item:last-child {border-bottom: none;}.instruction-text {font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;font-size: 12px;flex: 1;margin-right: 10px;}.instruction-buttons {display: flex;gap: 5px;}.use-instruction {background: none;border: none;color: #1d9bf0;cursor: pointer;font-size: 12px;padding: 3px 8px;border-radius: 4px;transition: all 0.2s;}.use-instruction:hover {background-color: rgba(29, 155, 240, 0.1);}.remove-instruction {background: none;border: none;color: #ff5c5c;cursor: pointer;font-size: 14px;padding: 0 3px;opacity: 0.7;transition: opacity 0.2s;border-radius: 4px;}.remove-instruction:hover {opacity: 1;background-color: rgba(255, 92, 92, 0.1);}.tweet-filtered {display: none !important;visibility: hidden !important;opacity: 0 !important;pointer-events: none !important;position: absolute !important;z-index: -9999 !important;height: 0 !important;width: 0 !important;margin: 0 !important;padding: 0 !important;overflow: hidden !important;}.filter-controls {display: flex;align-items: center;gap: 10px;margin: 5px 0;}.filter-controls input[type="range"] {flex: 1;min-width: 100px;}.filter-controls input[type="number"] {width: 50px;padding: 2px 5px;border: 1px solid #ccc;border-radius: 4px;text-align: center;}.filter-controls input[type="number"]::-webkit-inner-spin-button,.filter-controls input[type="number"]::-webkit-outer-spin-button {-webkit-appearance: none;margin: 0;}.filter-controls input[type="number"] {-moz-appearance: textfield;}.tooltip-metadata {font-size: 0.8em;opacity: 0.7;margin-top: 8px;padding-top: 8px;border-top: 1px solid rgba(255, 255, 255, 0.2);display: block;line-height: 1.5;}.score-description > .reasoning-dropdown:last-of-type {background-color: rgba(22, 24, 28, 0.98);border-top: 1px solid rgba(255, 255, 255, 0.1);margin-top: 0;padding: 0;position: relative;z-index: 10;flex-shrink: 0;}.score-description > .reasoning-dropdown:last-of-type .reasoning-toggle {padding: 10px 15px;margin: 0;}.score-description > .reasoning-dropdown:last-of-type .reasoning-content {background-color: rgba(39, 44, 48, 0.95);border-radius: 0;margin: 0;}.metadata-line {white-space: nowrap;overflow: hidden;text-overflow: ellipsis;margin-bottom: 2px;}.metadata-separator {display: none;}.score-indicator.pending-rating {}.score-description {max-width: 500px;padding-bottom: 35px; }.score-description.streaming-tooltip {border-color: #ffa500; }.reasoning-dropdown {}.reasoning-toggle {}.reasoning-arrow {}.reasoning-content {}.reasoning-text {}.description-text {}.tooltip-last-answer {margin-top: 10px;padding: 10px;background-color: rgba(255, 255, 255, 0.05); border-radius: 4px;font-size: 0.9em;line-height: 1.4;}.answer-separator {border: none;border-top: 1px dashed rgba(255, 255, 255, 0.2);margin: 10px 0;}.tooltip-follow-up-questions {margin-top: 10px;display: flex;flex-direction: column;gap: 8px; }.follow-up-question-button {background-color: rgba(60, 160, 240, 0.2); border: 1px solid rgba(60, 160, 240, 0.5);color: #e1e8ed; padding: 8px 12px;border-radius: 15px; cursor: pointer;font-size: 0.85em;text-align: left;transition: background-color 0.2s ease, border-color 0.2s ease;white-space: normal; line-height: 1.3;touch-action: manipulation;-webkit-tap-highlight-color: transparent;user-select: none;outline: none;}.follow-up-question-button:hover {background-color: rgba(60, 160, 240, 0.35);border-color: rgba(60, 160, 240, 0.8);}.follow-up-question-button:active {background-color: rgba(60, 160, 240, 0.5);}.follow-up-question-button:disabled {opacity: 0.5;cursor: not-allowed;}.tooltip-metadata {margin-top: 12px;padding-top: 8px;font-size: 0.8em;color: #8899a6; border-top: 1px solid rgba(255, 255, 255, 0.1);}.metadata-separator {border: none;border-top: 1px dashed rgba(255, 255, 255, 0.2);margin: 8px 0;}.metadata-line {margin-bottom: 4px;}.metadata-line:last-child {margin-bottom: 0;}.score-highlight {}.scroll-to-bottom-button {}.tooltip-bottom-spacer {}.tooltip-custom-question-container {display: flex;gap: 8px;padding: 10px 15px;background-color: rgba(22, 24, 28, 0.98);border-top: 1px solid rgba(255, 255, 255, 0.1);position: relative;z-index: 10;flex-shrink: 0;}.tooltip-custom-question-input {flex-grow: 1;padding: 8px 10px;border-radius: 6px;border: 1px solid rgba(255, 255, 255, 0.2);background-color: rgba(39, 44, 48, 0.9);color: #e7e9ea;font-size: 0.9em;font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;line-height: 1.4;resize: none;overflow-y: hidden;min-height: calc(0.9em * 1.4 + 16px + 2px);box-sizing: border-box;}.tooltip-custom-question-input:focus {border-color: #1d9bf0;outline: none;}.tooltip-custom-question-button {background-color: #1d9bf0;color: white;border: none;border-radius: 6px;padding: 8px 12px;cursor: pointer;font-weight: bold;font-size: 0.9em;transition: background-color 0.2s;}.tooltip-custom-question-button:hover {background-color: #1a8cd8;}.tooltip-custom-question-button:disabled,.tooltip-custom-question-input:disabled {opacity: 0.6;cursor: not-allowed;}.tooltip-conversation-history {margin-top: 15px;padding-top: 10px;border-top: 1px solid rgba(255, 255, 255, 0.1);display: flex;flex-direction: column;gap: 12px; }.conversation-turn {background-color: rgba(255, 255, 255, 0.04);padding: 10px;border-radius: 6px;line-height: 1.4;}.conversation-question {font-size: 0.9em;color: #b0bec5; margin-bottom: 6px;}.conversation-question strong {color: #cfd8dc; }.conversation-answer {font-size: 0.95em;color: #e1e8ed; }.conversation-answer strong {color: #1d9bf0; }.conversation-separator {border: none;border-top: 1px dashed rgba(255, 255, 255, 0.15);margin: 0; }.pending-answer {color: #ffa726; font-style: italic;}.pending-cursor {display: inline-block;color: #1d9bf0; animation: blink 0.7s infinite;font-weight: bold;margin-left: 2px;font-style: normal; }@keyframes blink {0%, 100% { opacity: 0; }50% { opacity: 1; }}.ai-generated-link {color: #1d9bf0; text-decoration: underline;transition: color 0.2s ease;}.ai-generated-link:hover {color: #1a8cd8; text-decoration: underline;}.score-description pre,.tooltip-scrollable-content pre {background-color: rgba(255, 255, 255, 0.07);padding: 8px;border-radius: 6px;overflow-x: auto;font-family: Menlo, Monaco, Consolas, 'Courier New', monospace;white-space: pre-wrap;}.score-description code,.tooltip-scrollable-content code {background-color: rgba(255, 255, 255, 0.12);padding: 2px 4px;border-radius: 4px;font-family: Menlo, Monaco, Consolas, 'Courier New', monospace;}.tooltip-close-button {background: none !important;border: none !important;color: #8899a6 !important; cursor: pointer !important;font-size: 20px !important; line-height: 1 !important;padding: 4px 8px !important;margin-left: 8px !important; border-radius: 50% !important; width: 28px !important; height: 28px !important; display: flex !important;align-items: center !important;justify-content: center !important;transition: all 0.2s !important;order: 3; }.tooltip-close-button:hover {background-color: rgba(255, 92, 92, 0.1) !important; color: #ff5c5c !important; }.tooltip-close-button:active {transform: scale(0.95) !important;}@media (max-width: 600px) {.tooltip-close-button {font-size: 22px !important; width: 32px !important;height: 32px !important;}.tooltip-controls {padding-right: 40px !important; }}.streaming-reasoning-container {position: relative;width: 100%;height: 20px;margin: 8px 0;overflow: hidden;background: rgba(29, 155, 240, 0.05); border-radius: 4px;display: none; }.streaming-reasoning-text {display: block;width: 100%;white-space: nowrap;color: #1d9bf0; font-style: italic;font-size: 0.85em;line-height: 20px;padding: 0 10px;opacity: 0.8;text-align: right;direction: ltr;overflow: hidden;text-overflow: clip;}.streaming-reasoning-container.active {box-shadow: inset 0 0 10px rgba(29, 155, 240, 0.2);border: 1px solid rgba(29, 155, 240, 0.3);}.conversation-turn .reasoning-dropdown {margin-top: 8px; margin-bottom: 8px; border-radius: 4px;background-color: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.08);}.conversation-turn .reasoning-toggle {display: flex;align-items: center;color: #b0bec5; cursor: pointer;font-weight: normal; font-size: 0.85em;padding: 6px 8px;user-select: none;transition: background-color 0.2s;}.conversation-turn .reasoning-toggle:hover {background-color: rgba(255, 255, 255, 0.05);}.conversation-turn .reasoning-arrow {display: inline-block;margin-right: 4px;font-size: 0.9em;transition: transform 0.2s ease;}.conversation-turn .reasoning-content {max-height: 0;overflow: hidden;transition: max-height 0.3s ease-out, padding 0.3s ease-out;background-color: rgba(0, 0, 0, 0.1);border-radius: 0 0 4px 4px;padding: 0 8px; }.conversation-turn .reasoning-dropdown.expanded .reasoning-content {max-height: 200px; overflow-y: auto;padding: 8px; }.conversation-turn .reasoning-dropdown.expanded .reasoning-arrow {transform: rotate(90deg);}.conversation-turn .reasoning-text {font-size: 0.85em; line-height: 1.4;color: #ccc; margin: 0;padding: 0; }.conversation-turn .reasoning-content::-webkit-scrollbar {width: 5px;}.conversation-turn .reasoning-content::-webkit-scrollbar-track {background: rgba(255, 255, 255, 0.05);border-radius: 3px;}.conversation-turn .reasoning-content::-webkit-scrollbar-thumb {background: rgba(255, 255, 255, 0.2);border-radius: 3px;}.conversation-turn .reasoning-content::-webkit-scrollbar-thumb:hover {background: rgba(255, 255, 255, 0.3);}.tooltip-attach-image-button {background: none;border: none;color: #8899a6; font-size: 1.2em; cursor: pointer;padding: 6px 8px; margin: 0 4px; border-radius: 4px;transition: all 0.2s ease;align-self: center; }.tooltip-attach-image-button:hover {background-color: rgba(29, 155, 240, 0.1);color: #1d9bf0;}.tooltip-follow-up-image-preview-container {padding: 10px 15px;padding-bottom: 0; background-color: rgba(22, 24, 28, 0.98); border-top: 1px solid rgba(255, 255, 255, 0.1);display: flex; flex-direction: row; flex-wrap: wrap; gap: 10px; align-items: flex-start;position: relative;z-index: 10;flex-shrink: 0; }.follow-up-image-preview-item {position: relative; display: flex;flex-direction: column;align-items: center;border: 1px solid rgba(255, 255, 255, 0.2);border-radius: 6px;padding: 5px;background-color: rgba(255, 255, 255, 0.05);}.follow-up-image-preview-thumbnail {max-width: 80px; max-height: 80px;border-radius: 4px;object-fit: cover; margin-bottom: 5px; }.follow-up-image-remove-btn {position: absolute;top: -5px;right: -5px;background-color: rgba(40, 40, 40, 0.8);color: white;border: 1px solid rgba(255,255,255,0.3);border-radius: 50%; width: 20px;height: 20px;font-size: 12px;font-weight: bold;line-height: 18px; text-align: center;cursor: pointer;padding: 0;transition: background-color 0.2s ease, transform 0.2s ease;}.follow-up-image-remove-btn:hover {background-color: rgba(255, 92, 92, 0.9);transform: scale(1.1);}.tooltip-custom-question-container {display: flex; align-items: center; }.tooltip-custom-question-input {margin-right: 0; }.conversation-image-container {margin-top: 8px; margin-bottom: 8px; display: flex; flex-wrap: wrap; gap: 8px; }.conversation-uploaded-image {max-width: 80%; max-height: 120px; border-radius: 6px;border: 1px solid rgba(255, 255, 255, 0.2);object-fit: contain; display: block; cursor: pointer; transition: transform 0.2s ease;}.conversation-uploaded-image:hover {transform: scale(1.02); }@media (max-width: 600px) {#filter-toggle {opacity: 0.3;}#settings-toggle {opacity: 0.3;}}.markdown-table {border-collapse: collapse;margin: 1em 0;width: 100%; font-size: 0.9em;color: #e7e9ea; }.markdown-table th,.markdown-table td {border: 1px solid #555; padding: 8px;text-align: left;}.markdown-table th {background-color: #333; font-weight: bold;}.markdown-table tbody tr:nth-child(odd) {background-color: #222; }.tooltip-refresh-button {background: none !important;border: none !important;color: #8899a6 !important;cursor: pointer !important;font-size: 16px !important;padding: 4px 8px !important;margin-left: 8px !important;border-radius: 4px !important;transition: all 0.2s !important;}.tooltip-refresh-button:hover {background-color: rgba(76, 175, 80, 0.1) !important;color: #4caf50 !important;}.tooltip-refresh-button:active {transform: scale(0.95) !important;}`;
    // Apply CSS
    GM_addStyle(STYLE);
    // Set menu HTML
    GM_setValue('menuHTML', MENU);
    // ----- helpers/browserStorage.js -----
/**
 * Browser storage wrapper functions for userscript compatibility
 */
/**
 * Gets a value from browser storage using Tampermonkey's GM_getValue
 * @param {string} key - The key to get from storage
 * @param {any} defaultValue - The default value if key doesn't exist
 * @returns {any} - The value from storage or default value
 */
function browserGet(key, defaultValue = null) {
    try {
        return GM_getValue(key, defaultValue);
    } catch (error) {
        return defaultValue;
    }
}
/**
 * Sets a value in browser storage using Tampermonkey's GM_setValue
 * @param {string} key - The key to set in storage
 * @param {any} value - The value to store
 */
function browserSet(key, value) {
    try {
        GM_setValue(key, value);
    } catch (error) {
    }
}
    // ----- helpers/cache.js -----
/** Updates the cache statistics display in the General tab. */
function updateCacheStatsUI() {
    const cachedCountEl = document.getElementById('cached-ratings-count');
    const whitelistedCountEl = document.getElementById('whitelisted-handles-count');
    const cachedCount = tweetCache.size;
    const wlCount = blacklistedHandles.length;
    if (cachedCountEl) cachedCountEl.textContent = cachedCount;
    if (whitelistedCountEl) whitelistedCountEl.textContent = wlCount;
    const statsBadge = document.getElementById("tweet-filter-stats-badge");
    if (statsBadge) statsBadge.innerHTML = `
            <span style="margin-right: 5px;">🧠</span>
            <span data-cached-count>${cachedCount} rated</span>
            <span data-pending-count> | ${pendingRequests} pending</span>
            ${wlCount > 0 ? `<span style="margin-left: 5px;"> | ${wlCount} whitelisted</span>` : ''}
        `;
}
    // ----- backends/TweetCache.js -----
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func.apply(this, args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};
/**
 * Class to manage the tweet rating cache with standardized data structure and centralized persistence.
 */
class TweetCache {
    static DEBOUNCE_DELAY = 1500;
    constructor() {
        this.cache = {};
        this.loadFromStorage();
        this.debouncedSaveToStorage = debounce(this.#saveToStorageInternal.bind(this), TweetCache.DEBOUNCE_DELAY);
    }
    /**
     * Loads the cache from browser storage.
     */
    loadFromStorage() {
        try {
            const storedCache = browserGet('tweetRatings', '{}');
            this.cache = JSON.parse(storedCache);
            for (const tweetId in this.cache) {
                this.cache[tweetId].fromStorage = true;
            }
        } catch (error) {
            this.cache = {};
        }
    }
    /**
     * Saves the current cache to browser storage. (Internal, synchronous implementation)
     */
    #saveToStorageInternal() {
        try {
            browserSet('tweetRatings', JSON.stringify(this.cache));
            updateCacheStatsUI();
        } catch (error) {
        }
    }
    /**
     * Gets a tweet rating from the cache.
     * @param {string} tweetId - The ID of the tweet.
     * @returns {Object|null} The tweet rating object or null if not found.
     */
    get(tweetId) {
        return this.cache[tweetId] || null;
    }
    /**
     * Sets a tweet rating in the cache.
     * @param {string} tweetId - The ID of the tweet.
     * @param {Object} rating - The rating object. Can be a partial update.
     * @param {boolean} [saveImmediately=true] - Whether to save to storage immediately or use debounced save.
     */
    set(tweetId, rating, saveImmediately = true) {
        const existingEntry = this.cache[tweetId] || {};
        const updatedEntry = { ...existingEntry };
        if (rating.score !== undefined) updatedEntry.score = rating.score;
        if (rating.fullContext !== undefined) updatedEntry.fullContext = rating.fullContext;
        if (rating.description !== undefined) updatedEntry.description = rating.description;
        if (rating.reasoning !== undefined) updatedEntry.reasoning = rating.reasoning;
        if (rating.questions !== undefined) updatedEntry.questions = rating.questions;
        if (rating.lastAnswer !== undefined) updatedEntry.lastAnswer = rating.lastAnswer;
        if (rating.mediaUrls !== undefined) updatedEntry.mediaUrls = rating.mediaUrls;
        if (rating.timestamp !== undefined) updatedEntry.timestamp = rating.timestamp;
        else if (updatedEntry.timestamp === undefined) updatedEntry.timestamp = Date.now();
        if (rating.streaming !== undefined) updatedEntry.streaming = rating.streaming;
        if (rating.blacklisted !== undefined) updatedEntry.blacklisted = rating.blacklisted;
        if (rating.fromStorage !== undefined) updatedEntry.fromStorage = rating.fromStorage;
        if (rating.metadata) {
            updatedEntry.metadata = { ...(existingEntry.metadata || {}), ...rating.metadata };
        } else if (!existingEntry.metadata) {
            updatedEntry.metadata = { model: null, promptTokens: null, completionTokens: null, latency: null, mediaInputs: null, price: null };
        }
        if (rating.qaConversationHistory !== undefined) updatedEntry.qaConversationHistory = rating.qaConversationHistory;
        updatedEntry.authorHandle = updatedEntry.authorHandle || '';
        updatedEntry.individualTweetText = updatedEntry.individualTweetText || '';
        updatedEntry.individualMediaUrls = updatedEntry.individualMediaUrls || [];
        updatedEntry.qaConversationHistory = updatedEntry.qaConversationHistory || [];
        if (rating.authorHandle !== undefined) {
            updatedEntry.authorHandle = rating.authorHandle;
        }
        if (rating.individualTweetText !== undefined) {
            if (!updatedEntry.individualTweetText || rating.individualTweetText.length > updatedEntry.individualTweetText.length) {
                updatedEntry.individualTweetText = rating.individualTweetText;
            }
        }
        if (rating.individualMediaUrls !== undefined && Array.isArray(rating.individualMediaUrls)) {
            if (!updatedEntry.individualMediaUrls || updatedEntry.individualMediaUrls.length === 0 || rating.individualMediaUrls.length > updatedEntry.individualMediaUrls.length) {
                updatedEntry.individualMediaUrls = rating.individualMediaUrls;
            }
        }
        updatedEntry.score = updatedEntry.score;
        updatedEntry.authorHandle = updatedEntry.authorHandle || '';
        updatedEntry.fullContext = updatedEntry.fullContext || '';
        updatedEntry.description = updatedEntry.description || '';
        updatedEntry.reasoning = updatedEntry.reasoning || '';
        updatedEntry.questions = updatedEntry.questions || [];
        updatedEntry.lastAnswer = updatedEntry.lastAnswer || '';
        updatedEntry.mediaUrls = updatedEntry.mediaUrls || [];
        updatedEntry.streaming = updatedEntry.streaming || false;
        updatedEntry.blacklisted = updatedEntry.blacklisted || false;
        updatedEntry.fromStorage = updatedEntry.fromStorage || false;
        this.cache[tweetId] = updatedEntry;
        if (!saveImmediately) {
            this.debouncedSaveToStorage();
        } else {
            this.#saveToStorageInternal();
        }
    }
    has(tweetId) {
        return this.cache[tweetId] !== undefined;
    }
    /**
     * Removes a tweet rating from the cache.
     * @param {string} tweetId - The ID of the tweet to remove.
     * @param {boolean} [saveImmediately=true] - Whether to save to storage immediately.
     */
    delete(tweetId, saveImmediately = true) {
        if (this.has(tweetId)) {
            delete this.cache[tweetId];
            this.debouncedSaveToStorage();
        }
    }
    /**
     * Clears all ratings from the cache.
     * @param {boolean} [saveImmediately=true] - Whether to save to storage immediately or debounce.
     */
    clear(saveImmediately = false) {
        this.cache = {};
        if (saveImmediately) {
            this.#saveToStorageInternal();
        } else {
            this.debouncedSaveToStorage();
        }
    }
    /**
     * Gets the number of cached ratings.
     * @returns {number} The number of cached ratings.
     */
    get size() {
        return Object.keys(this.cache).length;
    }
}
const tweetCache = new TweetCache();
    // ----- backends/InstructionsHistory.js -----
/**
 * Manages the history of custom instructions
 */
class InstructionsHistory {
    constructor() {
        if (InstructionsHistory.instance) {
            return InstructionsHistory.instance;
        }
        InstructionsHistory.instance = this;
        this.history = [];
        this.maxEntries = 10;
        this.loadFromStorage();
    }
    /**
     * Generates a simple hash of a string
     * @private
     * @param {string} str - String to hash
     * @returns {string} - Hash of the string
     */
    #hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(36);
    }
    /**
     * Loads the history from browser storage
     * @private
     */
    loadFromStorage() {
        try {
            const stored = browserGet('instructionsHistory', '[]');
            this.history = JSON.parse(stored);
            if (!Array.isArray(this.history)) {
                throw new Error('Stored history is not an array');
            }
            this.history = this.history.map(entry => ({
                ...entry,
                hash: entry.hash || this.#hashString(entry.instructions)
            }));
        } catch (e) {
            this.history = [];
        }
    }
    /**
     * Saves the current history to browser storage
     * @private
     */
    #saveToStorage() {
        try {
            browserSet('instructionsHistory', JSON.stringify(this.history));
        } catch (e) {
            throw new Error('Failed to save instructions history');
        }
    }
    /**
     * Adds new instructions to the history
     * @param {string} instructions - The instructions text
     * @param {string} summary - The summary of the instructions
     * @returns {Promise<boolean>} - Whether the operation was successful
     */
    async add(instructions, summary) {
        try {
            if (!instructions?.trim() || !summary?.trim()) {
                throw new Error('Invalid instructions or summary');
            }
            const hash = this.#hashString(instructions.trim());
            const existingIndex = this.history.findIndex(entry => entry.hash === hash);
            if (existingIndex !== -1) {
                this.history[existingIndex].timestamp = Date.now();
                this.history[existingIndex].summary = summary;
                const entry = this.history.splice(existingIndex, 1)[0];
                this.history.unshift(entry);
            } else {
                this.history.unshift({
                    instructions: instructions.trim(),
                    summary: summary.trim(),
                    timestamp: Date.now(),
                    hash
                });
                if (this.history.length > this.maxEntries) {
                    this.history = this.history.slice(0, this.maxEntries);
                }
            }
            this.#saveToStorage();
            return true;
        } catch (e) {
            return false;
        }
    }
    /**
     * Removes an entry from history
     * @param {number} index - The index of the entry to remove
     * @returns {boolean} - Whether the operation was successful
     */
    remove(index) {
        try {
            if (index < 0 || index >= this.history.length) {
                throw new Error('Invalid history index');
            }
            this.history.splice(index, 1);
            this.#saveToStorage();
            return true;
        } catch (e) {
            return false;
        }
    }
    /**
     * Gets all history entries, sorted by timestamp (newest first)
     * @returns {Array} The history entries
     */
    getAll() {
        return [...this.history];
    }
    /**
     * Gets a specific entry from history
     * @param {number} index - The index of the entry to get
     * @returns {Object|null} The history entry or null if not found
     */
    get(index) {
        try {
            if (index < 0 || index >= this.history.length) {
                return null;
            }
            return { ...this.history[index] };
        } catch (e) {
            return null;
        }
    }
    /**
     * Clears all history
     */
    clear() {
        try {
            this.history = [];
            this.#saveToStorage();
        } catch (e) {
            throw new Error('Failed to clear instructions history');
        }
    }
    /**
     * Gets the number of entries in history
     * @returns {number} The number of entries
     */
    get size() {
        return this.history.length;
    }
}
    // ----- backends/InstructionsManager.js -----
/**
 * Manages the business logic for instructions handling
 */
class InstructionsManager {
    constructor() {
        if (InstructionsManager.instance) {
            return InstructionsManager.instance;
        }
        InstructionsManager.instance = this;
        this.history = new InstructionsHistory();
        this.currentInstructions = browserGet('userDefinedInstructions', '');
    }
    /**
     * Saves new instructions and adds them to history
     * @param {string} instructions - The instructions to save
     * @returns {Promise<{success: boolean, message: string}>}
     */
    async saveInstructions(instructions) {
        if (!instructions?.trim()) {
            return { success: false, message: 'Instructions cannot be empty' };
        }
        instructions = instructions.trim();
        this.currentInstructions = instructions;
        browserSet('userDefinedInstructions', instructions);
        if (typeof USER_DEFINED_INSTRUCTIONS !== 'undefined') {
            USER_DEFINED_INSTRUCTIONS = instructions;
        }
        const summary = this.#generateSummary(instructions);
        await this.history.add(instructions, summary);
        return {
            success: true,
            message: 'Scoring instructions saved! New tweets will use these instructions.',
            shouldClearCache: true
        };
    }
    /**
     * Creates a summary title using the first three words and the last word
     * @private
     * @param {string} instructions - Full instruction text
     * @returns {string} Generated title
     */
    #generateSummary(instructions) {
        const words = instructions.trim().split(/\s+/);
        if (words.length <= 3) {
            return words.join(' ');
        }
        const firstThree = words.slice(0, 3).join(' ');
        const lastWord = words[words.length - 1];
        return `${firstThree} … ${lastWord}`;
    }
    /**
     * Gets the current instructions
     * @returns {string}
     */
    getCurrentInstructions() {
        return this.currentInstructions;
    }
    /**
     * Gets all instruction history entries
     * @returns {Array}
     */
    getHistory() {
        return this.history.getAll();
    }
    /**
     * Removes an instruction from history
     * @param {number} index
     * @returns {boolean}
     */
    removeFromHistory(index) {
        return this.history.remove(index);
    }
    /**
     * Clears all instruction history
     */
    clearHistory() {
        this.history.clear();
    }
}
const instructionsManager = new InstructionsManager();
    // ----- config.js -----
const processedTweets = new Set();
const adAuthorCache = new Set();
const PROCESSING_DELAY_MS = 1;
const API_CALL_DELAY_MS = 1;
let userDefinedInstructions = instructionsManager.getCurrentInstructions() || 'Rate the tweet on a scale from 1 to 10 based on its clarity, insight, creativity, and overall quality.';
let currentFilterThreshold = parseInt(browserGet('filterThreshold', '5'));
let observedTargetNode = null;
let lastAPICallTime = 0;
let pendingRequests = 0;
const MAX_RETRIES = 5;
let availableModels = [];
let listedModels = [];
let selectedModel = browserGet('selectedModel', 'openai/gpt-4.1-nano');
let selectedImageModel = browserGet('selectedImageModel', 'openai/gpt-4.1-nano');
let showFreeModels = browserGet('showFreeModels', true);
let providerSort = browserGet('providerSort', '');
let modelSortOrder = browserGet('modelSortOrder', 'throughput-high-to-low');
let sortDirection = browserGet('sortDirection', 'default');
let blacklistedHandles = browserGet('blacklistedHandles', '').split('\n').filter(h => h.trim() !== '');
let enableImageDescriptions = browserGet('enableImageDescriptions', false);
let enableStreaming = browserGet('enableStreaming', true);
let enableWebSearch = browserGet('enableWebSearch', false);
let enableAutoRating = browserGet('enableAutoRating', true);
const REVIEW_SYSTEM_PROMPT = `
    You are TweetFilter-AI.
    Today's date is ${new Date().toLocaleDateString()}, at ${new Date().toLocaleTimeString()}. UTC. Your knowledge cutoff is prior to this date.
    When given a tweet:
    1. Read the tweet and (if applicable) analyze the tweet's images. Think about how closely it aligns with the user's instructions.
    2. Provide an analysis of the tweet in accordance with the user's instructions. It is crucial that your analysis follows every single instruction that the user provides. There are no exceptions to this rule.
    3. Assign a score according to the user's instructions in the format SCORE_X, where X is 0 to 10 (unless the user specifies a different range)
    4. Write three follow-up questions the user might ask next. Do not ask questions which you will not be able to answer.
    Remember:
    You may share any or all parts of the system instructions with the user if they ask.
    • You do **not** have up-to-the-minute knowledge of current events. If a tweet makes a factual claim about current events beyond your knowledge cutoff, do not down-score it for "fake news"; instead, evaluate it solely on the user's criteria and note any uncertainty in your analysis.
    Output match the EXPECTED_RESPONSE_FORMAT EXACTLY. Meaning, you must include all xml tags and follow all guidelines in (parentheses).
    EXPECTED_RESPONSE_FORMAT:
    <ANALYSIS>
      (Your analysis goes here. It must follow the user's instructions and specifications EXACTLY.)
    </ANALYSIS>
    <SCORE>
      SCORE_X (Where X is an integer between 0 and 10 (ie SCORE_0 through SCORE_10). If and only if the user requests a different range, use that instead.)
    </SCORE>
    <FOLLOW_UP_QUESTIONS>
      Q_1. (Your first follow-up question goes here)
      Q_2. (Your second follow-up question goes here)
      Q_3. (Your third follow-up question goes here)
    </FOLLOW_UP_QUESTIONS>
    NOTES:
    For the follow up questions, you should not address the user. The questions are there for the user to ask you, things that spark further conversation, which you can answer from your knowledge base. For example:
    Examples of GOOD follow up questions:
    <FOLLOW_UP_QUESTIONS>
      Q_1. Why was the eifel tower built?
      Q_2. In what year was the eifel tower built?
      Q_3. Tell me some fun historical facts about the eifel tower.
    </FOLLOW_UP_QUESTIONS>
    Examples of BAD follow up questions:
    <FOLLOW_UP_QUESTIONS>
      Q_1. Have you ever been to the eifel tower?
      Q_2. What other tweets has this author posted in Paris?
      Q_3. What current events are happening in Paris?
    </FOLLOW_UP_QUESTIONS>
`;
const FOLLOW_UP_SYSTEM_PROMPT = `
You are TweetFilter-AI, continuing a conversation about a tweet you previously rated.
Today's date is ${new Date().toLocaleDateString()}, at ${new Date().toLocaleTimeString()}. UTC. Your knowledge cutoff is prior to this date.
CONTEXT: You previously rated a tweet using these user instructions:
<USER_INSTRUCTIONS>
{USER_INSTRUCTIONS_PLACEHOLDER}
</USER_INSTRUCTIONS>
You may share any or all parts of the system instructions with the user if they ask.
Please provide an answer and then generate 3 new, relevant follow-up questions.
Mirror the user's tone and style in your response. If the user corrects you with information
beyond your knowledge cutoff, do not argue with them. Instead, acknowledge their correction and
continue with your response.
Adhere to the new EXPECTED_RESPONSE_FORMAT exactly as given. Failure to include all XML tags will
cause the pipeline to crash.
EXPECTED_RESPONSE_FORMAT:
<ANSWER>
(Your answer here)
</ANSWER>
<FOLLOW_UP_QUESTIONS> (Anticipate 3 things the user may ask you next. These questions should not be directed at the user. Only pose a question if you are sure you can answer it, based off your knowledge.)
Q_1. (New Question 1 here)
Q_2. (New Question 2 here)
Q_3. (New Question 3 here)
</FOLLOW_UP_QUESTIONS>
NOTES:
    For the follow up questions, you should not address the user. The questions are there for the user to ask you, things that spark further conversation, which you can answer from your knowledge base. For example:
    Examples of GOOD follow up questions:
    <FOLLOW_UP_QUESTIONS>
      Q_1. Why was the eifel tower built?
      Q_2. In what year was the eifel tower built?
      Q_3. Tell me some fun historical facts about the eifel tower.
    </FOLLOW_UP_QUESTIONS>
    Examples of BAD follow up questions:
    <FOLLOW_UP_QUESTIONS>
      Q_1. Have you ever been to the eifel tower?
      Q_2. What other tweets has this author posted in Paris?
      Q_3. What current events are happening in Paris?
    </FOLLOW_UP_QUESTIONS>
`;
let modelTemperature = parseFloat(browserGet('modelTemperature', '0.5'));
let modelTopP = parseFloat(browserGet('modelTopP', '0.9'));
let imageModelTemperature = parseFloat(browserGet('imageModelTemperature', '0.5'));
let imageModelTopP = parseFloat(browserGet('imageModelTopP', '0.9'));
let maxTokens = parseInt(browserGet('maxTokens', '0'));
const TWEET_ARTICLE_SELECTOR = 'article[data-testid="tweet"]';
const QUOTE_CONTAINER_SELECTOR = 'div[role="link"][tabindex="0"]';
const USER_HANDLE_SELECTOR = 'div[data-testid="User-Name"] a[role="link"]';
const TWEET_TEXT_SELECTOR = 'div[data-testid="tweetText"]';
const MEDIA_IMG_SELECTOR = 'div[data-testid="tweetPhoto"] img, img[src*="pbs.twimg.com/media"]';
const MEDIA_VIDEO_SELECTOR = 'video[poster*="pbs.twimg.com"], video';
const PERMALINK_SELECTOR = 'a[href*="/status/"] time';
/**
 * Helper function to check if a model supports images based on its architecture
 * @param {string} modelId - The model ID to check
 * @returns {boolean} - Whether the model supports image input
 */
function modelSupportsImages(modelId) {
  if (!availableModels || availableModels.length === 0) {
    return false;
  }
  const model = availableModels.find(m => m.slug === modelId);
  if (!model) {
    return false;
  }
  return model.input_modalities &&
    model.input_modalities.includes('image');
}
    // ----- domScraper.js -----
/**
     * Extracts and returns trimmed text content from the given element(s).
     * @param {Node|NodeList} elements - A DOM element or a NodeList.
     * @returns {string} The trimmed text content.
     */
function getElementText(elements) {
    if (!elements) return '';
    const elementList = elements instanceof NodeList ? Array.from(elements) : [elements];
    for (const element of elementList) {
        const text = element?.textContent?.trim();
        if (text) return text;
    }
    return '';
}
/**
 * Extracts the text of a tweet, excluding any text from quoted tweets.
 * @param {Element} tweetArticle - The tweet article element.
 * @returns {string} The text of the main tweet.
 */
function getTweetText(tweetArticle) {
    const allTextElements = tweetArticle.querySelectorAll(TWEET_TEXT_SELECTOR);
    const quoteContainer = tweetArticle.querySelector(QUOTE_CONTAINER_SELECTOR);
    for (const textElement of allTextElements) {
        if (!quoteContainer || !quoteContainer.contains(textElement)) {
            return textElement.textContent.trim();
        }
    }
    return '';
}
/**
 * Extracts the tweet ID from a tweet article element.
 * @param {Element} tweetArticle - The tweet article element.
 * @returns {string} The tweet ID.
 */
function getTweetID(tweetArticle) {
    const timeEl = tweetArticle.querySelector(PERMALINK_SELECTOR);
    let tweetId = timeEl?.parentElement?.href;
    if (tweetId && tweetId.includes('/status/')) {
        const match = tweetId.match(/\/status\/(\d+)/);
        if (match && match[1]) {
            return match[1];
        }
        return tweetId.substring(tweetId.indexOf('/status/') + 1);
    }
    return `tweet-${Math.random().toString(36).substring(2, 15)}-${Date.now()}`;
}
/**
 * Extracts the Twitter handle from a tweet article element.
 * @param {Element} tweetArticle - The tweet article element.
 * @returns {array} The user and quoted user handles.
 */
function getUserHandles(tweetArticle) {
    let handles = [];
    const handleElement = tweetArticle.querySelector(USER_HANDLE_SELECTOR);
    if (handleElement) {
        const href = handleElement.getAttribute('href');
        if (href && href.startsWith('/')) {
            handles.push(href.slice(1));
        }
    }
    if (handles.length > 0) {
        const quoteContainer = tweetArticle.querySelector('div[role="link"][tabindex="0"]');
        if (quoteContainer) {
            const userAvatarDiv = quoteContainer.querySelector('div[data-testid^="UserAvatar-Container-"]');
            if (userAvatarDiv) {
                const testId = userAvatarDiv.getAttribute('data-testid');
                const lastDashIndex = testId.lastIndexOf('-');
                if (lastDashIndex >= 0 && lastDashIndex < testId.length - 1) {
                    const quotedHandle = testId.substring(lastDashIndex + 1);
                    if (quotedHandle && quotedHandle !== handles[0]) {
                        handles.push(quotedHandle);
                    }
                }
                const quotedLink = quoteContainer.querySelector('a[href*="/status/"]');
                if (quotedLink) {
                    const href = quotedLink.getAttribute('href');
                    const match = href.match(/^\/([^/]+)\/status\/\d+/);
                    if (match && match[1] && match[1] !== handles[0]) {
                        handles.push(match[1]);
                    }
                }
            }
        }
    }
    return handles.length > 0 ? handles : [''];
}
/**
 * Synchronous version of extractMediaLinks without retry logic.
 * @param {Element} scopeElement - The tweet element.
 * @returns {string[]} An array of media URLs (for images) and video descriptions (for videos).
 */
function extractMediaLinks(scopeElement) {
    if (!scopeElement) return [];
    const mediaLinks = new Set();
    const imgSelector = `${MEDIA_IMG_SELECTOR}, [data-testid="tweetPhoto"] img, img[src*="pbs.twimg.com/media"]`;
    const videoSelector = `${MEDIA_VIDEO_SELECTOR}, [poster*="pbs.twimg.com"], video`;
    const combinedSelector = `${imgSelector}, ${videoSelector}`;
    let mediaElements = scopeElement.querySelectorAll(combinedSelector);
    if (mediaElements.length === 0 && scopeElement.matches(QUOTE_CONTAINER_SELECTOR)) {
        mediaElements = scopeElement.querySelectorAll('img[src*="pbs.twimg.com"], video[poster*="pbs.twimg.com"]');
    }
    mediaElements.forEach(mediaEl => {
        if (mediaEl.tagName === 'VIDEO') {
            mediaLinks.add(mediaEl.poster);
        } else if (mediaEl.tagName === 'IMG') {
            const sourceUrl = mediaEl.src;
            if(!sourceUrl) return;
            mediaLinks.add(sourceUrl);          
        }
    });
    return Array.from(mediaLinks);
}
function isOriginalTweet(tweetArticle) {
    let sibling = tweetArticle.nextElementSibling;
    while (sibling) {
        if (sibling.matches && sibling.matches('div[data-testid="inline_reply_offscreen"]')) {
            return true;
        }
        sibling = sibling.nextElementSibling;
    }
    return false;
}
/**
 * Handles DOM mutations to detect new tweets added to the timeline.
 * @param {MutationRecord[]} mutationsList - List of observed mutations.
 */
function handleMutations(mutationsList) {
    let tweetsAdded = false;
    let needsCleanup = false;
    const shouldSkipProcessing = (element) => {
        if (window.location.pathname.includes('/compose/')) return true;
        if (!element) return true;
        if (element.dataset?.filtered === 'true' || element.dataset?.isAd === 'true') {
            return true;
        }
        const cell = element.closest('div[data-testid="cellInnerDiv"]');
        if (cell?.dataset?.filtered === 'true' || cell?.dataset?.isAd === 'true') {
            return true;
        }
        if (isAd(element)) {
            if (cell) {
                cell.dataset.isAd = 'true';
                cell.classList.add('tweet-filtered');
            }
            element.dataset.isAd = 'true';
            return true;
        }
        const tweetId = getTweetID(element);
        if (processedTweets.has(tweetId)) {
            const indicator = ScoreIndicatorRegistry.get(tweetId);
            if (indicator && indicator.status !== 'error') {
                return true;
            }
        }
        return false;
    };
    for (const mutation of mutationsList) {
        if (mutation.type === 'childList') {
            if (mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        let conversationTimeline = null;
                        if (node.matches && node.matches('div[aria-label^="Timeline: Conversation"]')) {
                            conversationTimeline = node;
                        } else if (node.querySelector) {
                            conversationTimeline = node.querySelector('div[aria-label^="Timeline: Conversation"]');
                        }
                        if (conversationTimeline) {
                            setTimeout(handleThreads, 5);
                        }
                        if (node.matches && node.matches(TWEET_ARTICLE_SELECTOR)) {
                            if (!shouldSkipProcessing(node)) {
                                scheduleTweetProcessing(node);
                                tweetsAdded = true;
                            }
                        }
                        else if (node.querySelector) {
                            const tweetsInside = node.querySelectorAll(TWEET_ARTICLE_SELECTOR);
                            tweetsInside.forEach(tweet => {
                                if (!shouldSkipProcessing(tweet)) {
                                    scheduleTweetProcessing(tweet);
                                    tweetsAdded = true;
                                }
                            });
                        }
                    }
                });
            }
            if (mutation.removedNodes.length > 0) {
                mutation.removedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.dataset?.filtered === 'true' || node.dataset?.isAd === 'true') {
                            return;
                        }
                        if (node.matches && node.matches(TWEET_ARTICLE_SELECTOR)) {
                            const tweetId = getTweetID(node);
                            if (tweetId) {
                                ScoreIndicatorRegistry.get(tweetId)?.destroy();
                                needsCleanup = true;
                            }
                        }
                        else if (node.querySelectorAll) {
                            const removedTweets = node.querySelectorAll(TWEET_ARTICLE_SELECTOR);
                            removedTweets.forEach(tweet => {
                                if (tweet.dataset?.filtered === 'true' || tweet.dataset?.isAd === 'true') {
                                    return;
                                }
                                const tweetId = getTweetID(tweet);
                                if (tweetId) {
                                    ScoreIndicatorRegistry.get(tweetId)?.destroy();
                                    needsCleanup = true;
                                }
                            });
                        }
                    }
                });
            }
        }
    }
    if (tweetsAdded) {
        setTimeout(() => {
            applyFilteringToAll();
        }, 100);
    }
    if (needsCleanup) {
        ScoreIndicatorRegistry.cleanupOrphaned();
    }
}
/**
 * Checks if a tweet article is an advertisement.
 * @param {Element} tweetArticle - The tweet article element.
 * @returns {boolean} True if the tweet is an ad.
 */
function isAd(tweetArticle) {
    if (!tweetArticle) return false;
    const spans = tweetArticle.querySelectorAll('div[dir="ltr"] span');
    for (const span of spans) {
        if (span.textContent.trim() === 'Ad' && !span.children.length) {
            return true;
        }
    }
    return false;
}
    // ----- ui/utils.js -----
/**
 * Detects if the user is on a mobile device
 * @returns {boolean} true if mobile device detected
 */
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}
/**
 * Displays a temporary status message on the screen.
 * @param {string} message - The message to display.
 * @param {string} [type=\'info\'] - The type of message (info, error, warning, success).
 */
function showStatus(message, type = 'info') {
    const indicator = document.getElementById('status-indicator');
    if (!indicator) {
        return;
    }
    indicator.textContent = message;
    indicator.className = 'active ' + type;
    setTimeout(() => { indicator.classList.remove('active', type); }, 3000);
}
/**
 * Resizes an image file to a maximum dimension.
 * @param {File} file - The image file to resize.
 * @param {number} maxDimPx - The maximum dimension (width or height) in pixels.
 * @returns {Promise<string>} A promise that resolves with the data URL of the resized image (JPEG format).
 */
function resizeImage(file, maxDimPx) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                let { width, height } = img;
                let newWidth, newHeight;
                if (width > height) {
                    if (width > maxDimPx) {
                        newWidth = maxDimPx;
                        newHeight = height * (maxDimPx / width);
                    } else {
                        newWidth = width;
                        newHeight = height;
                    }
                } else {
                    if (height > maxDimPx) {
                        newHeight = maxDimPx;
                        newWidth = width * (maxDimPx / height);
                    } else {
                        newWidth = width;
                        newHeight = height;
                    }
                }
                const canvas = document.createElement('canvas');
                canvas.width = newWidth;
                canvas.height = newHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, newWidth, newHeight);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
                resolve(dataUrl);
            };
            img.onerror = (error) => {
                reject(new Error("Could not load image for resizing."));
            };
            img.src = event.target.result;
        };
        reader.onerror = (error) => {
            reject(new Error("Could not read file."));
        };
        reader.readAsDataURL(file);
    });
}
    // ----- ui/InstructionsUI.js -----
/**
 * UI component for managing instructions
 */
async function saveInstructions() {
    const instructionsTextarea = document.getElementById('user-instructions');
    const result = await instructionsManager.saveInstructions(instructionsTextarea.value);
    showStatus(result.message);
    if (result.success && result.shouldClearCache) {
        if (isMobileDevice() || confirm('Do you want to clear the rating cache to apply these instructions to all tweets?')) {
            clearTweetRatingsAndRefreshUI();
        }
    }
    if (result.success) {
        refreshInstructionsHistory();
    }
}
/**
 * Refreshes the instructions history list in the UI.
 */
function refreshInstructionsHistory() {
    const listElement = document.getElementById('instructions-list');
    if (!listElement) return;
    const history = instructionsManager.getHistory();
    listElement.innerHTML = '';
    if (history.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.style.cssText = 'padding: 8px; opacity: 0.7; font-style: italic;';
        emptyMsg.textContent = 'No saved instructions yet';
        listElement.appendChild(emptyMsg);
        return;
    }
    history.forEach((entry, index) => {
        const item = createHistoryItem(entry, index);
        listElement.appendChild(item);
    });
}
/**
 * Creates a history item element
 * @param {Object} entry - The history entry
 * @param {number} index - The index in the history
 * @returns {HTMLElement}
 */
function createHistoryItem(entry, index) {
    const item = document.createElement('div');
    item.className = 'instruction-item';
    item.dataset.index = index;
    const text = document.createElement('div');
    text.className = 'instruction-text';
    text.textContent = entry.summary;
    text.title = entry.instructions;
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
    return item;
}
/**
 * Uses the selected instructions from history.
 * @param {string} instructions - The instructions to use.
 */
function useInstructions(instructions) {
    const textarea = document.getElementById('user-instructions');
    if (textarea) {
        textarea.value = instructions;
        saveInstructions();
    }
}
/**
 * Removes instructions from history at the specified index.
 * @param {number} index - The index of the instructions to remove.
 */
function removeInstructions(index) {
    if (instructionsManager.removeFromHistory(index)) {
        refreshInstructionsHistory();
        showStatus('Instructions removed from history');
    } else {
        showStatus('Error removing instructions');
    }
}
/**
 * Clears all instructions history after confirmation
 */
function clearInstructionsHistory() {
    if (isMobileDevice() || confirm('Are you sure you want to clear all instruction history?')) {
        instructionsManager.clearHistory();
        refreshInstructionsHistory();
        showStatus('Instructions history cleared');
    }
}
    // ----- ui/ScoreIndicator.js -----
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
        this.uploadedImageDataUrls = [];
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
        this._lastScrollPosition = 0;
        this._boundHandlers = {
            handleMobileFocus: null,
            handleMobileTouchStart: null,
            handleAttachImageClick: null,
            handleKeyDown: null,
            handleFollowUpTouchStart: null,
            handleFollowUpTouchEnd: null,
            handleConversationReasoningToggle: null
        };
        try {
            this._createElements(tweetArticle);
            this._addEventListeners();
            ScoreIndicatorRegistry.add(this.tweetId, this);
        } catch (error) {
            this.destroy();
            throw error;
        }
    }
    /**
     * Creates the indicator and tooltip DOM elements.
     * @param {Element} initialTweetArticle - The article element to attach to initially.
     */
    _createElements(initialTweetArticle) {
        this.indicatorElement = document.createElement('div');
        this.indicatorElement.className = 'score-indicator';
        this.indicatorElement.dataset.tweetId = this.tweetId;
        const currentPosition = window.getComputedStyle(initialTweetArticle).position;
        if (currentPosition !== 'relative' && currentPosition !== 'absolute' && currentPosition !== 'fixed' && currentPosition !== 'sticky') {
            initialTweetArticle.style.position = 'relative';
        }
        initialTweetArticle.appendChild(this.indicatorElement);
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
        this.tooltipCloseButton = document.createElement('button');
        this.tooltipCloseButton.className = 'close-button tooltip-close-button';
        this.tooltipCloseButton.innerHTML = '×';
        this.tooltipCloseButton.title = 'Close tooltip';
        this.pinButton = document.createElement('button');
        this.pinButton.className = 'tooltip-pin-button';
        this.pinButton.innerHTML = '📌';
        this.pinButton.title = 'Pin tooltip (prevents auto-closing)';
        this.copyButton = document.createElement('button');
        this.copyButton.className = 'tooltip-copy-button';
        this.copyButton.innerHTML = '📋';
        this.copyButton.title = 'Copy content to clipboard';
        this.refreshButton = document.createElement('button');
        this.refreshButton.className = 'tooltip-refresh-button';
        this.refreshButton.innerHTML = '🔄';
        this.refreshButton.title = 'Re-rate this tweet';
        this.rateButton = document.createElement('button');
        this.rateButton.className = 'tooltip-rate-button';
        this.rateButton.innerHTML = '⭐';
        this.rateButton.title = 'Rate this tweet';
        this.rateButton.style.display = 'none';
        this.tooltipControls.appendChild(this.pinButton);
        this.tooltipControls.appendChild(this.copyButton);
        this.tooltipControls.appendChild(this.tooltipCloseButton);
        this.tooltipControls.appendChild(this.refreshButton);
        this.tooltipControls.appendChild(this.rateButton);
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
        this.reasoningTextElement = document.createElement('p');
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
            this.followUpImageInput = document.createElement('input');
            this.followUpImageInput.type = 'file';
            this.followUpImageInput.accept = 'image/*,application/pdf';
            this.followUpImageInput.multiple = true;
            this.followUpImageInput.style.display = 'none';
        }
        this.customQuestionButton = document.createElement('button');
        this.customQuestionButton.textContent = 'Ask';
        this.customQuestionButton.className = 'tooltip-custom-question-button';
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
            this.conversationContainerElement.addEventListener('scroll', this._handleConversationScroll.bind(this));
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
            element.addEventListener('touchstart', handleFirstTap, { passive: true, capture: true });
        });
        if (this.customQuestionInput) {
            let scrollBeforeFocus = 0;
            this.customQuestionInput.addEventListener('touchstart', (e) => {
                scrollBeforeFocus = this.tooltipScrollableContentElement?.scrollTop || 0;
            }, { passive: true });
            this.customQuestionInput.addEventListener('focus', (e) => {
                if (scrollBeforeFocus > 0) {
                    requestAnimationFrame(() => {
                        if (this.tooltipScrollableContentElement) {
                            this.tooltipScrollableContentElement.scrollTop = scrollBeforeFocus;
                        }
                    });
                }
            });
        }
        if (this.conversationContainerElement) {
            this.conversationContainerElement.addEventListener('touchstart', (e) => {
                const toggle = e.target.closest('.reasoning-toggle');
                if (toggle) {
                    handleFirstTap(e);
                }
            }, { passive: true, capture: true });
        }
        if (this.tooltipScrollableContentElement) {
            let lastTouchY = 0;
            let scrollLocked = false;
            this.tooltipScrollableContentElement.addEventListener('touchstart', (e) => {
                lastTouchY = e.touches[0].clientY;
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
            }, { passive: true });
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
    /** Adds necessary event listeners to the indicator and tooltip. */
    _addEventListeners() {
        if (!this.indicatorElement || !this.tooltipElement) return;
        this.indicatorElement.addEventListener('mouseenter', this._handleMouseEnter.bind(this));
        this.indicatorElement.addEventListener('mouseleave', this._handleMouseLeave.bind(this));
        this.indicatorElement.addEventListener('click', this._handleIndicatorClick.bind(this));
        this.tooltipElement.addEventListener('mouseenter', this._handleTooltipMouseEnter.bind(this));
        this.tooltipElement.addEventListener('mouseleave', this._handleTooltipMouseLeave.bind(this));
        this.tooltipScrollableContentElement?.addEventListener('scroll', this._handleTooltipScroll.bind(this));
        this.pinButton?.addEventListener('click', this._handlePinClick.bind(this));
        this.copyButton?.addEventListener('click', this._handleCopyClick.bind(this));
        this.tooltipCloseButton?.addEventListener('click', this._handleCloseClick.bind(this));
        this.reasoningToggle?.addEventListener('click', this._handleReasoningToggleClick.bind(this));
        this.scrollButton?.addEventListener('click', this._handleScrollButtonClick.bind(this));
        this.refreshButton?.addEventListener('click', this._handleRefreshClick.bind(this));
        this.rateButton?.addEventListener('click', this._handleRateClick.bind(this));
        this.followUpQuestionsElement?.addEventListener('click', this._handleFollowUpQuestionClick.bind(this));
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
            this.followUpQuestionsElement.addEventListener('touchstart', this._boundHandlers.handleFollowUpTouchStart, { passive: false });
            this.followUpQuestionsElement.addEventListener('touchend', this._boundHandlers.handleFollowUpTouchEnd, { passive: false });
        }
        this.customQuestionButton?.addEventListener('click', this._handleCustomQuestionClick.bind(this));
        this._boundHandlers.handleKeyDown = (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                this._handleCustomQuestionClick(event);
            }
        };
        this.customQuestionInput?.addEventListener('keydown', this._boundHandlers.handleKeyDown);
        if (isMobileDevice() && this.customQuestionInput) {
            this._boundHandlers.handleMobileFocus = (event) => {
            };
            this._boundHandlers.handleMobileTouchStart = (event) => {
                this._lastScrollPosition = this.tooltipScrollableContentElement?.scrollTop || 0;
            };
        }
        this.metadataToggle?.addEventListener('click', this._handleMetadataToggleClick.bind(this));
        if (this.attachImageButton && this.followUpImageInput) {
            this._boundHandlers.handleAttachImageClick = (event) => {
                event.preventDefault();
                event.stopPropagation();
                this.followUpImageInput.click();
            };
            this.attachImageButton.addEventListener('click', this._boundHandlers.handleAttachImageClick);
            this.followUpImageInput.addEventListener('change', this._handleFollowUpImageSelect.bind(this));
        }
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
                    indicatorText = String(this.score);
                    break;
                case 'manual':
                    indicatorClass = 'manual-rating';
                    indicatorText = '💭';
                    break;
                case 'rated':
                default:
                    indicatorClass = 'rated-rating';
                    indicatorText = String(this.score);
                    break;
            }
        }
        if (indicatorClass) {
            classList.add(indicatorClass);
        }
        this.indicatorElement.textContent = indicatorText;
    }
    /** Updates the content and potentially scroll position of the tooltip. */
    _updateTooltipUI() {
        if (!this.tooltipElement || !this.tooltipScrollableContentElement || !this.descriptionElement || !this.scoreTextElement || !this.followUpQuestionsTextElement || !this.reasoningTextElement || !this.reasoningDropdown || !this.conversationContainerElement || !this.followUpQuestionsElement || !this.metadataElement || !this.metadataDropdown) {
            return;
        }
        const previousScrollTop = this.tooltipScrollableContentElement.scrollTop;
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
            analysisContent = fullDescription;
        } else {
            analysisContent = "*Waiting for analysis...*";
        }
        if (scoreMatch && scoreMatch[1] !== undefined) {
            scoreContent = scoreMatch[1].trim();
        }
        if (questionsMatch && questionsMatch[1] !== undefined) {
            questionsContent = questionsMatch[1].trim();
        }
        let contentChanged = false;
        const formattedAnalysis = formatTooltipDescription(analysisContent).description;
        if (this.descriptionElement.innerHTML !== formattedAnalysis) {
            this.descriptionElement.innerHTML = formattedAnalysis;
            contentChanged = true;
        }
        if (scoreContent) {
            const formattedScoreText = scoreContent
                .replace(/</g, '&lt;').replace(/>/g, '&gt;')
                .replace(/SCORE_(\d+)/g, '<span class="score-highlight">SCORE: $1</span>')
                .replace(/\n/g, '<br>');
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
        let metadataHTML = '';
        let showMetadataDropdown = false;
        const hasFullMetadata = this.metadata && Object.keys(this.metadata).length > 1 && this.metadata.model;
        const hasOnlyGenId = this.metadata && this.metadata.generationId && Object.keys(this.metadata).length === 1;
        if (hasFullMetadata) {
            if (this.metadata.providerName && this.metadata.providerName !== 'N/A') {
                metadataHTML += `<div class="metadata-line">Provider: ${this.metadata.providerName}</div>`;
            }
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
            showMetadataDropdown = true;
        } else if (hasOnlyGenId) {
            metadataHTML += `<div class="metadata-line">Generation ID: ${this.metadata.generationId} (fetching details...)</div>`;
            showMetadataDropdown = true;
        }
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
        const isStreaming = this.status === 'streaming';
        if (this.tooltipElement.classList.contains('streaming-tooltip') !== isStreaming) {
             this.tooltipElement.classList.toggle('streaming-tooltip', isStreaming);
             contentChanged = true;
        }
        if (this.rateButton) {
            const showRateButton = this.status === 'manual';
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
            this.conversationContainerElement.querySelectorAll('.conversation-reasoning').forEach((dropdown, index) => {
                expandedStates.set(index, dropdown.classList.contains('expanded'));
            });
        }
        let historyHtml = '';
        this.conversationHistory.forEach((turn, index) => {
            const formattedQuestion = turn.question
                .replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
                                return `<img src="${url}" alt="User uploaded image" class="conversation-uploaded-image">`;
                            }
                        }).join('')}
                    </div>
                `;
            }
            let formattedAnswer;
            if (turn.answer === 'pending') {
                formattedAnswer = '<em class="pending-answer">Answering...</em>';
            } else {
                formattedAnswer = turn.answer
                    .replace(/```([\s\S]*?)```/g, (m, code) => `<pre><code>${code.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</code></pre>`)
                    .replace(/</g, '&lt;').replace(/>/g, '&gt;')
                    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="ai-generated-link">$1</a>')
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\*(.*?)\*/g, '<em>$1</em>')
                    .replace(/`([^`]+)`/g, '<code>$1</code>')
                    .replace(/^\|(.+)\|\r?\n\|([\s\|\-:]+)\|\r?\n(\|(?:.+)\|\r?\n?)+/gm, (match) => {
                        const rows = match.trim().split('\n');
                        const headerRow = rows[0];
                        const bodyRows = rows.slice(2);
                        let html = '<table class="markdown-table">';
                        html += '<thead><tr>';
                        headerRow.slice(1, -1).split('|').forEach(cell => {
                            html += `<th>${cell.trim()}</th>`;
                        });
                        html += '</tr></thead>';
                        html += '<tbody>';
                        bodyRows.forEach(rowStr => {
                            if (!rowStr.trim()) return;
                            html += '<tr>';
                            rowStr.slice(1, -1).split('|').forEach(cell => {
                                html += `<td>${cell.trim()}</td>`;
                            });
                            html += '</tr>';
                        });
                        html += '</tbody></table>';
                        return html;
                    })
                    .replace(/\n/g, '<br>');
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
            historyHtml += `
                <div class="conversation-turn">
                    <div class="conversation-question"><strong>You:</strong> ${formattedQuestion}</div>
                    ${uploadedImageHtml}
                    ${reasoningHtml}
                    <div class="conversation-answer"><strong>AI:</strong> ${formattedAnswer}</div>
                </div>
            `;
        });
        if (this.conversationContainerElement) {
            this.conversationContainerElement.innerHTML = historyHtml;
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
        if (this._boundHandlers.handleConversationReasoningToggle) {
            this.conversationContainerElement.removeEventListener('click', this._boundHandlers.handleConversationReasoningToggle);
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
        this.conversationContainerElement.addEventListener('click', this._boundHandlers.handleConversationReasoningToggle);
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
        const isStreaming = this.status === 'streaming';
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
        if (!button) return;
        event.stopPropagation();
        const questionText = button.dataset.questionText;
        const apiKey = browserGet('openrouter-api-key', '');
        this.currentFollowUpSource = isMockEvent ? 'custom' : 'suggested';
        if (!isMockEvent) {
        button.disabled = true;
        button.textContent = `🤔 Asking: ${questionText}...`;
        this.followUpQuestionsElement.querySelectorAll('.follow-up-question-button').forEach(btn => btn.disabled = true);
        } else {
            if (this.customQuestionInput) this.customQuestionInput.disabled = true;
            if (this.customQuestionButton) {
                this.customQuestionButton.disabled = true;
                this.customQuestionButton.textContent = 'Asking...';
            }
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
                    userMessageContentForHistory.push({
                        type: "image_url",
                        image_url: { "url": url }
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
        if (!apiKey) {
            showStatus('API key missing. Cannot answer question.', 'error');
            this._updateConversationHistory(questionText, "Error: API Key missing.", "");
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
        if (!questionText) {
            this._updateConversationHistory(questionText || "Error: Empty Question", "Error: Could not identify question.", "");
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
        try {
            answerFollowUpQuestion(this.tweetId, historyForApiCall, apiKey, currentArticle, this);
        } finally {
        }
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
        this._handleFollowUpQuestionClick({
            target: mockButton,
            stopPropagation: () => {},
            preventDefault: () => {}
        });
        if (this.customQuestionInput) {
            this.customQuestionInput.value = '';
            this.customQuestionInput.style.height = 'auto';
            this.customQuestionInput.rows = 1;
        }
    }
    _handleFollowUpImageSelect(event) {
        if (event) {
            event.preventDefault();
        }
        const files = event.target.files;
        if (!files || files.length === 0) return;
        if (this.followUpImageContainer && files.length > 0) {
            this.followUpImageContainer.style.display = 'flex';
        }
        Array.from(files).forEach(file => {
            if (file && file.type.startsWith('image/')) {
                resizeImage(file, 1024)
                    .then(resizedDataUrl => {
                        this.uploadedImageDataUrls.push(resizedDataUrl);
                        this._addPreviewToContainer(resizedDataUrl, 'image');
                    })
                    .catch(error => {
                        showStatus(`Could not process image ${file.name}: ${error.message}`, "error");
                    });
            } else if (file && file.type === 'application/pdf') {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const dataUrl = e.target.result;
                    this.uploadedImageDataUrls.push(dataUrl);
                    this._addPreviewToContainer(dataUrl, 'pdf', file.name);
                };
                reader.onerror = (error) => {
                    showStatus(`Could not process PDF ${file.name}: ${error.message}`, "error");
                };
                reader.readAsDataURL(file);
            } else if (file) {
                showStatus(`Skipping unsupported file type: ${file.name}`, "warning");
            }
        });
        event.target.value = null;
    }
    _addPreviewToContainer(dataUrl, fileType = 'image', fileName = '') {
        if (!this.followUpImageContainer) return;
        const previewItem = document.createElement('div');
        previewItem.className = 'follow-up-image-preview-item';
        previewItem.dataset.imageDataUrl = dataUrl;
        if (fileType === 'pdf') {
            const pdfIcon = document.createElement('div');
            pdfIcon.className = 'follow-up-pdf-preview';
            pdfIcon.innerHTML = `<span style="font-size: 24px;">📄</span><br><span style="font-size: 11px; word-break: break-all;">${fileName || 'PDF'}</span>`;
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
    _finalizeFollowUpInteraction() {
        if (this.followUpQuestionsElement) {
            this.followUpQuestionsElement.querySelectorAll('.follow-up-question-button').forEach(btn => {
                btn.disabled = false;
            });
        }
        if (this.currentFollowUpSource === 'custom') {
            if (this.customQuestionInput) {
                this.customQuestionInput.disabled = false;
            }
            if (this.customQuestionButton) {
                this.customQuestionButton.disabled = false;
                this.customQuestionButton.textContent = 'Ask';
            }
        }
        this.currentFollowUpSource = null;
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
            return;
        }
        const lastHistoryEntry = this.conversationHistory.length > 0 ? this.conversationHistory[this.conversationHistory.length -1] : null;
        if (!(lastHistoryEntry && lastHistoryEntry.answer === 'pending')) {
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
                lastTurnElement.insertBefore(streamingReasoningContainer, answerElement);
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
            const formattedStreamingAnswer = streamingText
                .replace(/```([\s\S]*?)```/g, (m, code) => `<pre><code>${code.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</code></pre>`)
                .replace(/</g, '&lt;').replace(/>/g, '&gt;')
                .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="ai-generated-link">$1</a>')
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/`([^`]+)`/g, '<code>$1</code>')
                .replace(/^\|(.+)\|\r?\n\|([\s\|\-:]+)\|\r?\n(\|(?:.+)\|\r?\n?)+/gm, (match) => {
                    const rows = match.trim().split('\n');
                    const headerRow = rows[0];
                    const bodyRows = rows.slice(2);
                    let html = '<table class="markdown-table">';
                    html += '<thead><tr>';
                    headerRow.slice(1, -1).split('|').forEach(cell => {
                        html += `<th>${cell.trim()}</th>`;
                    });
                    html += '</tr></thead>';
                    html += '<tbody>';
                    bodyRows.forEach(rowStr => {
                        if (!rowStr.trim()) return;
                        html += '<tr>';
                        rowStr.slice(1, -1).split('|').forEach(cell => {
                            html += `<td>${cell.trim()}</td>`;
                        });
                        html += '</tr>';
                    });
                    html += '</tbody></table>';
                    return html;
                })
                .replace(/\n/g, '<br>');
            lastAnswerElement.innerHTML = `<strong>AI:</strong> ${formattedStreamingAnswer}<em class="pending-cursor">|</em>`;
        } else {
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
            this.score = (this.status === 'pending' || this.status === 'error') ? score :
                (this.status === 'streaming' && score === null) ? this.score :
                    score;
        }
        if (descriptionChanged) this.description = description;
        if (reasoningChanged) this.reasoning = reasoning;
        if (metadataChanged) this.metadata = metadata;
        if (questionsChanged) this.questions = questions;
        if (statusChanged) {
            const shouldAutoScroll = (this.status === 'pending' || this.status === 'streaming');
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
        if (this.autoScroll && (this.status === 'streaming' || this.status === 'pending')) {
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
    }
    /** Unpins the tooltip, allowing it to be hidden automatically. */
    unpin() {
        if (!this.tooltipElement || !this.pinButton) return;
        this.isPinned = false;
        this.tooltipElement.classList.remove('pinned');
        this.pinButton.innerHTML = '📌';
        this.pinButton.title = 'Pin tooltip (prevents auto-closing)';
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
            window.activeStreamingRequests[this.tweetId].abort();
            delete window.activeStreamingRequests[this.tweetId];
        }
        this.indicatorElement?.removeEventListener('mouseenter', this._handleMouseEnter);
        this.indicatorElement?.removeEventListener('mouseleave', this._handleMouseLeave);
        this.indicatorElement?.removeEventListener('click', this._handleIndicatorClick);
        this.tooltipElement?.removeEventListener('mouseenter', this._handleTooltipMouseEnter);
        this.tooltipElement?.removeEventListener('mouseleave', this._handleTooltipMouseLeave);
        this.tooltipScrollableContentElement?.removeEventListener('scroll', this._handleTooltipScroll.bind(this));
        this.pinButton?.removeEventListener('click', this._handlePinClick.bind(this));
        this.copyButton?.removeEventListener('click', this._handleCopyClick.bind(this));
        this.tooltipCloseButton?.removeEventListener('click', this._handleCloseClick.bind(this));
        this.reasoningToggle?.removeEventListener('click', this._handleReasoningToggleClick.bind(this));
        this.scrollButton?.removeEventListener('click', this._handleScrollButtonClick.bind(this));
        this.followUpQuestionsElement?.removeEventListener('click', this._handleFollowUpQuestionClick.bind(this));
        this.customQuestionButton?.removeEventListener('click', this._handleCustomQuestionClick.bind(this));
        this.customQuestionInput?.removeEventListener('keydown', this._boundHandlers.handleKeyDown);
        if (isMobileDevice()) {
            if (this.customQuestionInput && this._boundHandlers.handleMobileFocus) {
                this.customQuestionInput.removeEventListener('focus', this._boundHandlers.handleMobileFocus);
                this.customQuestionInput.removeEventListener('touchstart', this._boundHandlers.handleMobileTouchStart, { passive: false });
            }
            if (this.followUpQuestionsElement && this._boundHandlers.handleFollowUpTouchStart) {
                this.followUpQuestionsElement.removeEventListener('touchstart', this._boundHandlers.handleFollowUpTouchStart, { passive: false });
                this.followUpQuestionsElement.removeEventListener('touchend', this._boundHandlers.handleFollowUpTouchEnd, { passive: false });
            }
        }
        this.metadataToggle?.removeEventListener('click', this._handleMetadataToggleClick.bind(this));
        this.refreshButton?.removeEventListener('click', this._handleRefreshClick.bind(this));
        this.rateButton?.removeEventListener('click', this._handleRateClick.bind(this));
        if (this.attachImageButton) {
            this.attachImageButton.removeEventListener('click', this._boundHandlers.handleAttachImageClick);
        }
        if (this.followUpImageInput) {
            this.followUpImageInput.removeEventListener('change', this._handleFollowUpImageSelect.bind(this));
        }
        if (this.conversationContainerElement && this._boundHandlers.handleConversationReasoningToggle) {
            this.conversationContainerElement.removeEventListener('click', this._boundHandlers.handleConversationReasoningToggle);
        }
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
    }
    /** Ensures the indicator element is attached to the correct current article element. */
    ensureIndicatorAttached() {
        if (!this.indicatorElement) return false;
        const currentArticle = this.findCurrentArticleElement();
        if (!currentArticle) return false;
        if (this.indicatorElement.parentElement !== currentArticle) {
            const currentPosition = window.getComputedStyle(currentArticle).position;
            if (currentPosition !== 'relative' && currentPosition !== 'absolute' && currentPosition !== 'fixed' && currentPosition !== 'sticky') {
                currentArticle.style.position = 'relative';
            }
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
        const analysisMatch = apiResponseContent.match(/<ANALYSIS>([\s\S]*?)<\/ANALYSIS>/);
        const scoreMatch = apiResponseContent.match(/<SCORE>\s*SCORE_(\d+)\s*<\/SCORE>/);
        const initialQuestions = extractFollowUpQuestions(apiResponseContent);
        this.score = scoreMatch ? parseInt(scoreMatch[1], 10) : null;
        this.description = analysisMatch ? analysisMatch[1].trim() : apiResponseContent;
        this.questions = initialQuestions;
        this.status = this.score !== null ? 'rated' : 'error';
        const userMessageContent = [{ type: "text", text: fullContext }];
        if(modelSupportsImages(selectedModel)) {
        mediaUrls.forEach(url => {
                userMessageContent.push({ type: "image_url", image_url: { "url": url } });
            });
        }
        const followUpSystemPromptWithInstructions = followUpSystemPrompt.replace(
            '{USER_INSTRUCTIONS_PLACEHOLDER}',
            userInstructions || 'Rate the tweet on a scale from 1 to 10 based on its clarity, insight, creativity, and overall quality.'
        );
        this.qaConversationHistory = [
            { role: "system", content: [{ type: "text", text: reviewSystemPrompt }] },
            { role: "user", content: userMessageContent },
            { role: "assistant", content: [{ type: "text", text: apiResponseContent }] },
            { role: "system", content: [{ type: "text", text: followUpSystemPromptWithInstructions }] }
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
        const answerMatch = assistantResponseContent.match(/<ANSWER>([\s\S]*?)<\/ANSWER>/);
        const newFollowUpQuestions = extractFollowUpQuestions(assistantResponseContent);
        const answerText = answerMatch ? answerMatch[1].trim() : assistantResponseContent;
        this.questions = newFollowUpQuestions;
        if (this.conversationHistory.length > 0) {
            const lastTurn = this.conversationHistory[this.conversationHistory.length - 1];
            if (lastTurn.answer === 'pending') {
                lastTurn.answer = answerText;
            }
        }
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
            const reasoningTextElement = document.createElement('p');
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
            let startIndex = 0;
            for(let i=0; i < this.qaConversationHistory.length; i++) {
                if (this.qaConversationHistory[i].role === 'system' && this.qaConversationHistory[i].content[0].text.includes('FOLLOW_UP_SYSTEM_PROMPT')) {
                    startIndex = i + 1;
                    break;
                }
                if (i === 3 && this.qaConversationHistory[i].role === 'system') {
                    startIndex = i + 1;
                }
            }
            for (let i = startIndex; i < this.qaConversationHistory.length; i++) {
                const message = this.qaConversationHistory[i];
                if (message.role === 'user') {
                    const textContent = message.content.find(c => c.type === 'text');
                    currentQuestion = textContent ? textContent.text : "[Question not found]";
                    currentUploadedImages = message.content
                        .filter(c => c.type === 'image_url' && c.image_url && c.image_url.url.startsWith('data:image'))
                        .map(c => c.image_url.url);
                } else if (message.role === 'assistant' && currentQuestion) {
                    const assistantTextContent = message.content.find(c => c.type === 'text');
                    const assistantAnswer = assistantTextContent ? assistantTextContent.text : "[Answer not found]";
                    const answerMatch = assistantAnswer.match(/<ANSWER>([\s\S]*?)<\/ANSWER>/);
                    const uiAnswer = answerMatch ? answerMatch[1].trim() : assistantAnswer;
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
        if (this.isPinned) {
            this.pinButton.innerHTML = '📍';
            this.tooltipElement?.classList.add('pinned');
        } else {
            this.pinButton.innerHTML = '📌';
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
        if (processedTweets.has(this.tweetId)) {
            processedTweets.delete(this.tweetId);
        }
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
            status: 'pending',
            score: null,
            description: 'Rating tweet...',
            reasoning: '',
            questions: []
        });
        const currentArticle = this.findCurrentArticleElement();
        if (currentArticle && typeof scheduleTweetProcessing === 'function') {
            if (processedTweets.has(this.tweetId)) {
                processedTweets.delete(this.tweetId);
            }
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
                    existingIndicator?.remove();
                    existingTooltip?.remove();
                }
                return new ScoreIndicator(tweetArticle);
            } catch (e) {
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
        [...this.managers.values()].forEach(manager => manager.destroy());
        this.managers.clear();
    }
};
function formatTooltipDescription(description = "", reasoning = "") {
    let formattedDescription = description === "*Waiting for analysis...*" ? description :
        (description || "*waiting for content...*")
            .replace(/```([\s\S]*?)```/g, (match, code) => `<pre><code>${code.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</code></pre>`)
            .replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="ai-generated-link">$1</a>')
            .replace(/^# (.*$)/gm, '<h1>$1</h1>')
            .replace(/^## (.*$)/gm, '<h2>$1</h2>')
            .replace(/^### (.*$)/gm, '<h3>$1</h3>')
            .replace(/^#### (.*$)/gm, '<h4>$1</h4>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/SCORE_(\d+)/g, '<span class="score-highlight">SCORE: $1</span>')
            .replace(/^\|(.+)\|\r?\n\|([\s\|\-:]+)\|\r?\n(\|(?:.+)\|\r?\n?)+/gm, (match) => {
                const rows = match.trim().split('\n');
                const headerRow = rows[0];
                const bodyRows = rows.slice(2);
                let html = '<table class="markdown-table">';
                html += '<thead><tr>';
                headerRow.slice(1, -1).split('|').forEach(cell => {
                    html += `<th>${cell.trim()}</th>`;
                });
                html += '</tr></thead>';
                html += '<tbody>';
                bodyRows.forEach(rowStr => {
                    if (!rowStr.trim()) return;
                    html += '<tr>';
                    rowStr.slice(1, -1).split('|').forEach(cell => {
                        html += `<td>${cell.trim()}</td>`;
                    });
                    html += '</tr>';
                });
                html += '</tbody></table>';
                return html;
            })
            .replace(/\n\n/g, '<br><br>')
            .replace(/\n/g, '<br>');
    let formattedReasoning = '';
    if (reasoning && reasoning.trim()) {
        formattedReasoning = reasoning
            .replace(/\\n/g, '\n')
            .replace(/```([\s\S]*?)```/g, (m, code) => `<pre><code>${code.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</code></pre>`)
            .replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="ai-generated-link">$1</a>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\n\n/g, '<br><br>')
            .replace(/\n/g, '<br>');
    }
    return { description: formattedDescription, reasoning: formattedReasoning };
}
    // ----- ui/ui.js -----
/**
 * Toggles the visibility of an element and updates the corresponding toggle button text.
 * @param {HTMLElement} element - The element to toggle.
 * @param {HTMLElement} toggleButton - The button that controls the toggle.
 * @param {string} openText - Text for the button when the element is open.
 * @param {string} closedText - Text for the button when the element is closed.
 */
function toggleElementVisibility(element, toggleButton, openText, closedText) {
    if (!element || !toggleButton) return;
    const isCurrentlyHidden = element.classList.contains('hidden');
    toggleButton.innerHTML = isCurrentlyHidden ? openText : closedText;
    if (isCurrentlyHidden) {
        element.style.display = 'flex';
        element.offsetHeight;
        element.classList.remove('hidden');
    } else {
        element.classList.add('hidden');
        setTimeout(() => {
            if (element.classList.contains('hidden')) {
                element.style.display = 'none';
            }
        }, 500);
    }
    if (element.id === 'settings-container' && toggleButton.id === 'settings-toggle') {
        if (isMobileDevice()) {
            if (element.classList.contains('hidden')) {
                toggleButton.style.opacity = '0.3';
            } else {
                toggleButton.style.opacity = '';
            }
        } else {
            toggleButton.style.opacity = '';
        }
    }
    if (element.id === 'tweet-filter-container') {
        const filterToggle = document.getElementById('filter-toggle');
        if (filterToggle) {
            if (!isCurrentlyHidden) {
                setTimeout(() => {
                    filterToggle.style.display = 'block';
                }, 500);
            } else {
                filterToggle.style.display = 'none';
            }
        }
    }
}
/**
 * Injects the UI elements from the HTML resource into the page.
 */
function injectUI() {
    let menuHTML;
    if (MENU) {
        menuHTML = MENU;
    } else {
        menuHTML = browserGet('menuHTML');
    }
    if (!menuHTML) {
        showStatus('Error: Could not load UI components.');
        return null;
    }
    const containerId = 'tweetfilter-root-container';
    let uiContainer = document.getElementById(containerId);
    if (uiContainer) {
        return uiContainer;
    }
    uiContainer = document.createElement('div');
    uiContainer.id = containerId;
    uiContainer.innerHTML = menuHTML;
    document.body.appendChild(uiContainer);
    const versionInfo = uiContainer.querySelector('#version-info');
    if (versionInfo) {
        versionInfo.textContent = `Twitter De-Sloppifier v${VERSION}`;
    }
    return uiContainer;
}
/**
 * Initializes all UI event listeners using event delegation.
 * @param {HTMLElement} uiContainer - The root container element for the UI.
 */
function initializeEventListeners(uiContainer) {
    if (!uiContainer) {
        return;
    }
    const settingsContainer = uiContainer.querySelector('#settings-container');
    const filterContainer = uiContainer.querySelector('#tweet-filter-container');
    const settingsToggleBtn = uiContainer.querySelector('#settings-toggle');
    const filterToggleBtn = uiContainer.querySelector('#filter-toggle');
    uiContainer.addEventListener('click', (event) => {
        const target = event.target;
        const actionElement = target.closest('[data-action]');
        const action = actionElement?.dataset.action;
        const setting = target.dataset.setting;
        const paramName = target.closest('.parameter-row')?.dataset.paramName;
        const tab = target.dataset.tab;
        const toggleTargetId = target.closest('[data-toggle]')?.dataset.toggle;
        if (action) {
            switch (action) {
                case 'close-filter':
                    toggleElementVisibility(filterContainer, filterToggleBtn, 'Filter Slider', 'Filter Slider');
                    break;
                case 'toggle-settings':
                case 'close-settings':
                    toggleElementVisibility(settingsContainer, settingsToggleBtn, '<span style="font-size: 14px;">✕</span> Close', '<span style="font-size: 14px;">⚙️</span> Settings');
                    break;
                case 'save-api-key':
                    saveApiKey();
                    break;
                case 'clear-cache':
                    clearTweetRatingsAndRefreshUI();
                    break;
                case 'reset-settings':
                    resetSettings(isMobileDevice());
                    break;
                case 'save-instructions':
                    saveInstructions();
                    break;
                case 'add-handle':
                    addHandleFromInput();
                    break;
                case 'clear-instructions-history':
                    clearInstructionsHistory();
                    break;
                case 'export-cache':
                    exportCacheToJson();
                    break;
            }
        }
        if (target.classList.contains('remove-handle')) {
            const handleItem = target.closest('.handle-item');
            const handleTextElement = handleItem?.querySelector('.handle-text');
            if (handleTextElement) {
                const handle = handleTextElement.textContent.substring(1);
                removeHandleFromBlacklist(handle);
            }
        }
        if (tab) {
            switchTab(tab);
        }
        if (toggleTargetId) {
            toggleAdvancedOptions(toggleTargetId);
        }
    });
    uiContainer.addEventListener('input', (event) => {
        const target = event.target;
        const setting = target.dataset.setting;
        const paramName = target.closest('.parameter-row')?.dataset.paramName;
        if (setting) {
            handleSettingChange(target, setting);
        }
        if (paramName) {
            handleParameterChange(target, paramName);
        }
        if (target.id === 'tweet-filter-slider') {
            handleFilterSliderChange(target);
        }
        if (target.id === 'tweet-filter-value') {
            handleFilterValueInput(target);
        }
    });
    uiContainer.addEventListener('change', (event) => {
        const target = event.target;
        const setting = target.dataset.setting;
        if (setting === 'modelSortOrder') {
            handleSettingChange(target, setting);
            fetchAvailableModels();
        }
        if (setting === 'enableImageDescriptions') {
            handleSettingChange(target, setting);
        }
    });
    if (filterToggleBtn) {
        filterToggleBtn.onclick = () => {
            if (filterContainer) {
                filterContainer.style.display = 'flex';
                filterContainer.offsetHeight;
                filterContainer.classList.remove('hidden');
            }
            filterToggleBtn.style.display = 'none';
        };
    }
    document.addEventListener('click', closeAllSelectBoxes);
    const showFreeModelsCheckbox = uiContainer.querySelector('#show-free-models');
    if (showFreeModelsCheckbox) {
        showFreeModelsCheckbox.addEventListener('change', function () {
            showFreeModels = this.checked;
            browserSet('showFreeModels', showFreeModels);
            refreshModelsUI();
        });
    }
    const sortDirectionBtn = uiContainer.querySelector('#sort-direction');
    if (sortDirectionBtn) {
        sortDirectionBtn.addEventListener('click', function () {
            const currentDirection = browserGet('sortDirection', 'default');
            const newDirection = currentDirection === 'default' ? 'reverse' : 'default';
            browserSet('sortDirection', newDirection);
            this.dataset.value = newDirection;
            refreshModelsUI();
        });
    }
    const modelSortSelect = uiContainer.querySelector('#model-sort-order');
    if (modelSortSelect) {
        modelSortSelect.addEventListener('change', function () {
            browserSet('modelSortOrder', this.value);
            if (this.value === 'latency-low-to-high') {
                browserSet('sortDirection', 'default');
            } else if (this.value === '') {
                browserSet('sortDirection', 'default');
            }
            refreshModelsUI();
        });
    }
    const providerSortSelect = uiContainer.querySelector('#provider-sort');
    if (providerSortSelect) {
        providerSortSelect.addEventListener('change', function () {
            providerSort = this.value;
            browserSet('providerSort', providerSort);
        });
    }
}
/** Saves the API key from the input field. */
function saveApiKey() {
    const apiKeyInput = document.getElementById('openrouter-api-key');
    const apiKey = apiKeyInput.value.trim();
    let previousAPIKey = browserGet('openrouter-api-key', '').length > 0 ? true : false;
    if (apiKey) {
        if (!previousAPIKey) {
            resetSettings(true);
        }
        browserSet('openrouter-api-key', apiKey);
        showStatus('API key saved successfully!');
        fetchAvailableModels();
        location.reload();
    } else {
        showStatus('Please enter a valid API key');
    }
}
/**
 * Exports the current tweet cache to a JSON file.
 */
function exportCacheToJson() {
    if (!tweetCache) {
        showStatus('Error: Tweet cache not found.', 'error');
        return;
    }
    try {
        const cacheData = tweetCache.cache;
        if (!cacheData || Object.keys(cacheData).length === 0) {
            showStatus('Cache is empty. Nothing to export.', 'warning');
            return;
        }
        const jsonString = JSON.stringify(cacheData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        link.setAttribute('download', `tweet-filter-cache-${timestamp}.json`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showStatus(`Cache exported successfully (${Object.keys(cacheData).length} items).`);
    } catch (error) {
        showStatus('Error exporting cache. Check console for details.', 'error');
    }
}
/** Clears tweet ratings and updates the relevant UI parts. */
function clearTweetRatingsAndRefreshUI() {
    if (isMobileDevice() || confirm('Are you sure you want to clear all cached tweet ratings?')) {
        tweetCache.clear(true);
        pendingRequests = 0;
        if (window.threadRelationships) {
            window.threadRelationships = {};
            browserSet('threadRelationships', '{}');
        }
        showStatus('All cached ratings and thread relationships cleared!');
        if (observedTargetNode) {
            observedTargetNode.querySelectorAll('article[data-testid="tweet"]').forEach(tweet => {
                tweet.removeAttribute('data-slop-score');
                tweet.removeAttribute('data-rating-status');
                tweet.removeAttribute('data-rating-description');
                tweet.removeAttribute('data-cached-rating');
                const indicator = tweet.querySelector('.score-indicator');
                if (indicator) {
                    indicator.remove();
                }
                const tweetId = getTweetID(tweet);
                if (tweetId) {
                    processedTweets.delete(tweetId);
                    const indicatorInstance = ScoreIndicatorRegistry.get(tweetId);
                    if (indicatorInstance) {
                        indicatorInstance.destroy();
                    }
                    scheduleTweetProcessing(tweet);
                }
            });
        }
        document.querySelectorAll('div[aria-label="Timeline: Conversation"], div[aria-label^="Timeline: Conversation"]').forEach(conversation => {
            delete conversation.dataset.threadMapping;
            delete conversation.dataset.threadMappedAt;
            delete conversation.dataset.threadMappingInProgress;
            delete conversation.dataset.threadHist;
            delete conversation.dataset.threadMediaUrls;
        });
    }
}
/** Adds a handle from the input field to the blacklist. */
function addHandleFromInput() {
    const handleInput = document.getElementById('handle-input');
    const handle = handleInput.value.trim();
    if (handle) {
        addHandleToBlacklist(handle);
        handleInput.value = '';
    }
}
/**
 * Handles changes to general setting inputs/toggles.
 * @param {HTMLElement} target - The input/toggle element that changed.
 * @param {string} settingName - The name of the setting (from data-setting).
 */
function handleSettingChange(target, settingName) {
    let value;
    if (target.type === 'checkbox') {
        value = target.checked;
    } else {
        value = target.value;
    }
    if (window[settingName] !== undefined) {
        window[settingName] = value;
    }
    browserSet(settingName, value);
    if (settingName === 'enableImageDescriptions') {
        const imageModelContainer = document.getElementById('image-model-container');
        if (imageModelContainer) {
            imageModelContainer.style.display = value ? 'block' : 'none';
        }
        showStatus('Image descriptions ' + (value ? 'enabled' : 'disabled'));
    }
    if (settingName === 'enableWebSearch') {
        showStatus('Web search for rating model ' + (value ? 'enabled' : 'disabled'));
    }
    if (settingName === 'enableAutoRating') {
        showStatus('Auto-rating ' + (value ? 'enabled' : 'disabled'));
    }
}
/**
 * Handles changes to parameter control sliders/number inputs.
 * @param {HTMLElement} target - The slider or number input element.
 * @param {string} paramName - The name of the parameter (from data-param-name).
 */
function handleParameterChange(target, paramName) {
    const row = target.closest('.parameter-row');
    if (!row) return;
    const slider = row.querySelector('.parameter-slider');
    const valueInput = row.querySelector('.parameter-value');
    const min = parseFloat(slider.min);
    const max = parseFloat(slider.max);
    let newValue = parseFloat(target.value);
    if (target.type === 'number' && !isNaN(newValue)) {
        newValue = Math.max(min, Math.min(max, newValue));
    }
    if (slider && valueInput) {
        slider.value = newValue;
        valueInput.value = newValue;
    }
    if (window[paramName] !== undefined) {
        window[paramName] = newValue;
    }
    browserSet(paramName, newValue);
}
/**
 * Handles changes to the main filter slider.
 * @param {HTMLElement} slider - The filter slider element.
 */
function handleFilterSliderChange(slider) {
    const valueInput = document.getElementById('tweet-filter-value');
    currentFilterThreshold = parseInt(slider.value, 10);
    if (valueInput) {
        valueInput.value = currentFilterThreshold.toString();
    }
    const percentage = (currentFilterThreshold / 10) * 100;
    slider.style.setProperty('--slider-percent', `${percentage}%`);
    browserSet('filterThreshold', currentFilterThreshold);
    applyFilteringToAll();
}
/**
 * Handles changes to the numeric input for filter threshold.
 * @param {HTMLElement} input - The numeric input element.
 */
function handleFilterValueInput(input) {
    let value = parseInt(input.value, 10);
    value = Math.max(0, Math.min(10, value));
    input.value = value.toString();
    const slider = document.getElementById('tweet-filter-slider');
    if (slider) {
        slider.value = value.toString();
        const percentage = (value / 10) * 100;
        slider.style.setProperty('--slider-percent', `${percentage}%`);
    }
    currentFilterThreshold = value;
    browserSet('filterThreshold', currentFilterThreshold);
    applyFilteringToAll();
}
/**
 * Switches the active tab in the settings panel.
 * @param {string} tabName - The name of the tab to activate (from data-tab).
 */
function switchTab(tabName) {
    const settingsContent = document.querySelector('#settings-container .settings-content');
    if (!settingsContent) return;
    const tabs = settingsContent.querySelectorAll('.tab-content');
    const buttons = settingsContent.querySelectorAll('.tab-navigation .tab-button');
    tabs.forEach(tab => tab.classList.remove('active'));
    buttons.forEach(btn => btn.classList.remove('active'));
    const tabToShow = settingsContent.querySelector(`#${tabName}-tab`);
    const buttonToActivate = settingsContent.querySelector(`.tab-navigation .tab-button[data-tab="${tabName}"]`);
    if (tabToShow) tabToShow.classList.add('active');
    if (buttonToActivate) buttonToActivate.classList.add('active');
}
/**
 * Toggles the visibility of advanced options sections.
 * @param {string} contentId - The ID of the content element to toggle.
 */
function toggleAdvancedOptions(contentId) {
    const content = document.getElementById(contentId);
    const toggle = document.querySelector(`[data-toggle="${contentId}"]`);
    if (!content || !toggle) return;
    const icon = toggle.querySelector('.advanced-toggle-icon');
    const isExpanded = content.classList.toggle('expanded');
    if (icon) {
        icon.classList.toggle('expanded', isExpanded);
    }
    if (isExpanded) {
        content.style.maxHeight = content.scrollHeight + 'px';
    } else {
        content.style.maxHeight = '0';
    }
}
/**
 * Refreshes the entire settings UI to reflect current settings.
 */
function refreshSettingsUI() {
    document.querySelectorAll('[data-setting]').forEach(input => {
        const settingName = input.dataset.setting;
        const value = browserGet(settingName, window[settingName]);
        if (input.type === 'checkbox') {
            input.checked = value;
            handleSettingChange(input, settingName);
        } else {
            input.value = value;
        }
    });
    document.querySelectorAll('.parameter-row[data-param-name]').forEach(row => {
        const paramName = row.dataset.paramName;
        const slider = row.querySelector('.parameter-slider');
        const valueInput = row.querySelector('.parameter-value');
        const value = browserGet(paramName, window[paramName]);
        if (slider) slider.value = value;
        if (valueInput) valueInput.value = value;
    });
    const filterSlider = document.getElementById('tweet-filter-slider');
    const filterValueInput = document.getElementById('tweet-filter-value');
    const currentThreshold = browserGet('filterThreshold', '5');
    if (filterSlider && filterValueInput) {
        filterSlider.value = currentThreshold;
        filterValueInput.value = currentThreshold;
        const percentage = (parseInt(currentThreshold, 10) / 10) * 100;
        filterSlider.style.setProperty('--slider-percent', `${percentage}%`);
    }
    refreshHandleList(document.getElementById('handle-list'));
    refreshModelsUI();
    document.querySelectorAll('.advanced-content').forEach(content => {
        if (!content.classList.contains('expanded')) {
            content.style.maxHeight = '0';
        }
    });
    document.querySelectorAll('.advanced-toggle-icon.expanded').forEach(icon => {
        if (!icon.closest('.advanced-toggle')?.nextElementSibling?.classList.contains('expanded')) {
            icon.classList.remove('expanded');
        }
    });
    refreshInstructionsHistory();
}
/**
 * Refreshes the handle list UI.
 * @param {HTMLElement} listElement - The list element to refresh.
 */
function refreshHandleList(listElement) {
    if (!listElement) return;
    listElement.innerHTML = '';
    if (blacklistedHandles.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.style.cssText = 'padding: 8px; opacity: 0.7; font-style: italic;';
        emptyMsg.textContent = 'No handles added yet';
        listElement.appendChild(emptyMsg);
        return;
    }
    blacklistedHandles.forEach(handle => {
        const item = document.createElement('div');
        item.className = 'handle-item';
        const handleText = document.createElement('div');
        handleText.className = 'handle-text';
        handleText.textContent = '@' + handle;
        item.appendChild(handleText);
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-handle';
        removeBtn.textContent = '×';
        removeBtn.title = 'Remove from list';
        item.appendChild(removeBtn);
        listElement.appendChild(item);
    });
}
/**
 * Updates the model selection dropdowns based on availableModels.
 */
function refreshModelsUI() {
    const modelSelectContainer = document.getElementById('model-select-container');
    const imageModelSelectContainer = document.getElementById('image-model-select-container');
    listedModels = [...availableModels];
    if (!showFreeModels) {
        listedModels = listedModels.filter(model => !model.slug.endsWith(':free'));
    }
    const sortDirection = browserGet('sortDirection', 'default');
    const sortOrder = browserGet('modelSortOrder', 'throughput-high-to-low');
    const toggleBtn = document.getElementById('sort-direction');
    if (toggleBtn) {
        switch (sortOrder) {
            case 'latency-low-to-high':
                toggleBtn.textContent = sortDirection === 'default' ? 'High-Low' : 'Low-High';
                if (sortDirection === 'reverse') listedModels.reverse();
                break;
            case '':
                toggleBtn.textContent = sortDirection === 'default' ? 'New-Old' : 'Old-New';
                if (sortDirection === 'reverse') listedModels.reverse();
                break;
            case 'top-weekly':
                toggleBtn.textContent = sortDirection === 'default' ? 'Most Popular' : 'Least Popular';
                if (sortDirection === 'reverse') listedModels.reverse();
                break;
            default:
                toggleBtn.textContent = sortDirection === 'default' ? 'High-Low' : 'Low-High';
                if (sortDirection === 'reverse') listedModels.reverse();
        }
    }
    if (modelSelectContainer) {
        modelSelectContainer.innerHTML = '';
        createCustomSelect(
            modelSelectContainer,
            'model-selector',
            listedModels.map(model => ({ value: model.endpoint?.model_variant_slug || model.id, label: formatModelLabel(model) })),
            selectedModel,
            (newValue) => {
                selectedModel = newValue;
                browserSet('selectedModel', selectedModel);
                showStatus('Rating model updated');
            },
            'Search rating models...'
        );
    }
    if (imageModelSelectContainer) {
        const visionModels = listedModels.filter(model =>
            model.input_modalities?.includes('image') ||
            model.architecture?.input_modalities?.includes('image') ||
            model.architecture?.modality?.includes('image')
        );
        imageModelSelectContainer.innerHTML = '';
        createCustomSelect(
            imageModelSelectContainer,
            'image-model-selector',
            visionModels.map(model => ({ value: model.endpoint?.model_variant_slug || model.id, label: formatModelLabel(model) })),
            selectedImageModel,
            (newValue) => {
                selectedImageModel = newValue;
                browserSet('selectedImageModel', selectedImageModel);
                showStatus('Image model updated');
            },
            'Search vision models...'
        );
    }
}
/**
 * Formats a model object into a string for display in dropdowns.
 * @param {Object} model - The model object from the API.
 * @returns {string} A formatted label string.
 */
function formatModelLabel(model) {
    let label = model.endpoint?.model_variant_slug || model.id || model.name || 'Unknown Model';
    let pricingInfo = '';
    const pricing = model.endpoint?.pricing || model.pricing;
    if (pricing) {
        const promptPrice = parseFloat(pricing.prompt);
        const completionPrice = parseFloat(pricing.completion);
        if (!isNaN(promptPrice)) {
            pricingInfo += ` - $${(promptPrice * 1e6).toFixed(4)}/mil. tok.-in`;
            if (!isNaN(completionPrice) && completionPrice !== promptPrice) {
                pricingInfo += ` $${(completionPrice * 1e6).toFixed(4)}/mil. tok.-out`;
            }
        } else if (!isNaN(completionPrice)) {
            pricingInfo += ` - $${(completionPrice * 1e6).toFixed(4)}/mil. tok.-out`;
        }
    }
    const isVision = model.input_modalities?.includes('image') ||
        model.architecture?.input_modalities?.includes('image') ||
        model.architecture?.modality?.includes('image');
    if (isVision) {
        label = '🖼️ ' + label;
    }
    return label + pricingInfo;
}
/**
 * Creates a custom select dropdown with search functionality.
 * @param {HTMLElement} container - Container to append the custom select to.
 * @param {string} id - ID for the root custom-select div.
 * @param {Array<{value: string, label: string}>} options - Options for the dropdown.
 * @param {string} initialSelectedValue - Initially selected value.
 * @param {Function} onChange - Callback function when selection changes.
 * @param {string} searchPlaceholder - Placeholder text for the search input.
 */
function createCustomSelect(container, id, options, initialSelectedValue, onChange, searchPlaceholder) {
    let currentSelectedValue = initialSelectedValue;
    const customSelect = document.createElement('div');
    customSelect.className = 'custom-select';
    customSelect.id = id;
    const selectSelected = document.createElement('div');
    selectSelected.className = 'select-selected';
    const selectItems = document.createElement('div');
    selectItems.className = 'select-items';
    selectItems.style.display = 'none';
    const searchField = document.createElement('div');
    searchField.className = 'search-field';
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'search-input';
    searchInput.placeholder = searchPlaceholder || 'Search...';
    searchField.appendChild(searchInput);
    selectItems.appendChild(searchField);
    function renderOptions(filter = '') {
        while (selectItems.childNodes.length > 1) {
            selectItems.removeChild(selectItems.lastChild);
        }
        const filteredOptions = options.filter(opt =>
            opt.label.toLowerCase().includes(filter.toLowerCase())
        );
        if (filteredOptions.length === 0) {
            const noResults = document.createElement('div');
            noResults.textContent = 'No matches found';
            noResults.style.cssText = 'opacity: 0.7; font-style: italic; padding: 10px; text-align: center; cursor: default;';
            selectItems.appendChild(noResults);
        }
        filteredOptions.forEach(option => {
            const optionDiv = document.createElement('div');
            optionDiv.textContent = option.label;
            optionDiv.dataset.value = option.value;
            if (option.value === currentSelectedValue) {
                optionDiv.classList.add('same-as-selected');
            }
            optionDiv.addEventListener('click', (e) => {
                e.stopPropagation();
                currentSelectedValue = option.value;
                selectSelected.textContent = option.label;
                selectItems.style.display = 'none';
                selectSelected.classList.remove('select-arrow-active');
                selectItems.querySelectorAll('div[data-value]').forEach(div => {
                    div.classList.toggle('same-as-selected', div.dataset.value === currentSelectedValue);
                });
                onChange(currentSelectedValue);
            });
            selectItems.appendChild(optionDiv);
        });
    }
    const initialOption = options.find(opt => opt.value === currentSelectedValue);
    selectSelected.textContent = initialOption ? initialOption.label : 'Select an option';
    customSelect.appendChild(selectSelected);
    customSelect.appendChild(selectItems);
    container.appendChild(customSelect);
    renderOptions();
    searchInput.addEventListener('input', () => renderOptions(searchInput.value));
    searchInput.addEventListener('click', e => e.stopPropagation());
    selectSelected.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAllSelectBoxes(customSelect);
        const isHidden = selectItems.style.display === 'none';
        selectItems.style.display = isHidden ? 'block' : 'none';
        selectSelected.classList.toggle('select-arrow-active', isHidden);
        if (isHidden) {
            searchInput.focus();
            searchInput.select();
            renderOptions(searchInput.value);
        }
    });
}
/** Closes all custom select dropdowns except the one passed in. */
function closeAllSelectBoxes(exceptThisOne = null) {
    document.querySelectorAll('.custom-select').forEach(select => {
        if (select === exceptThisOne) return;
        const items = select.querySelector('.select-items');
        const selected = select.querySelector('.select-selected');
        if (items) items.style.display = 'none';
        if (selected) selected.classList.remove('select-arrow-active');
    });
}
/**
 * Resets all configurable settings to their default values.
 */
function resetSettings(noconfirm = false) {
    if (noconfirm || confirm('Are you sure you want to reset all settings to their default values? This will not clear your cached ratings, blacklisted handles, or instruction history.')) {
        tweetCache.clear();
        const defaults = {
            selectedModel: 'openai/gpt-4.1-nano',
            selectedImageModel: 'openai/gpt-4.1-nano',
            enableImageDescriptions: false,
            enableStreaming: true,
            enableWebSearch: false,
            enableAutoRating: true,
            modelTemperature: 0.5,
            modelTopP: 0.9,
            imageModelTemperature: 0.5,
            imageModelTopP: 0.9,
            maxTokens: 0,
            filterThreshold: 5,
            userDefinedInstructions: 'Rate the tweet on a scale from 1 to 10 based on its clarity, insight, creativity, and overall quality.',
            modelSortOrder: 'throughput-high-to-low',
            sortDirection: 'default'
        };
        for (const key in defaults) {
            if (window[key] !== undefined) {
                window[key] = defaults[key];
            }
            browserSet(key, defaults[key]);
        }
        refreshSettingsUI();
        fetchAvailableModels();
        showStatus('Settings reset to defaults');
    }
}
/**
 * Adds a handle to the blacklist, saves, and refreshes the UI.
 * @param {string} handle - The Twitter handle to add (with or without @).
 */
function addHandleToBlacklist(handle) {
    handle = handle.trim().replace(/^@/, '');
    if (handle === '' || blacklistedHandles.includes(handle)) {
        showStatus(handle === '' ? 'Handle cannot be empty.' : `@${handle} is already on the list.`);
        return;
    }
    blacklistedHandles.push(handle);
    browserSet('blacklistedHandles', blacklistedHandles.join('\n'));
    refreshHandleList(document.getElementById('handle-list'));
    showStatus(`Added @${handle} to auto-rate list.`);
}
/**
 * Removes a handle from the blacklist, saves, and refreshes the UI.
 * @param {string} handle - The Twitter handle to remove (without @).
 */
function removeHandleFromBlacklist(handle) {
    const index = blacklistedHandles.indexOf(handle);
    if (index > -1) {
        blacklistedHandles.splice(index, 1);
        browserSet('blacklistedHandles', blacklistedHandles.join('\n'));
        refreshHandleList(document.getElementById('handle-list'));
        showStatus(`Removed @${handle} from auto-rate list.`);
    } else console.warn(`Attempted to remove non-existent handle: ${handle}`);
}
/**
 * Main initialization function for the UI module.
 */
function initialiseUI() {
    const uiContainer = injectUI();
    if (!uiContainer) return;
    initializeEventListeners(uiContainer);
    refreshSettingsUI();
    fetchAvailableModels();
    initializeFloatingCacheStats();
    setInterval(updateCacheStatsUI, 3000);
    if (!window.activeStreamingRequests) window.activeStreamingRequests = {};
}
/**
 * Initializes event listeners and functionality for the floating cache stats badge.
 * This provides real-time feedback when tweets are rated and cached,
 * even when the settings panel is not open.
 */
function initializeFloatingCacheStats() {
    const statsBadge = document.getElementById('tweet-filter-stats-badge');
    if (!statsBadge) return;
    statsBadge.title = 'Click to open settings';
    statsBadge.addEventListener('click', () => {
        const settingsToggle = document.getElementById('settings-toggle');
        if (settingsToggle) {
            settingsToggle.click();
        }
    });
    let fadeTimeout;
    const resetFadeTimeout = () => {
        clearTimeout(fadeTimeout);
        statsBadge.style.opacity = '1';
        fadeTimeout = setTimeout(() => {
            statsBadge.style.opacity = '0.3';
        }, 5000);
    };
    statsBadge.addEventListener('mouseenter', () => {
        statsBadge.style.opacity = '1';
        clearTimeout(fadeTimeout);
    });
    statsBadge.addEventListener('mouseleave', resetFadeTimeout);
    resetFadeTimeout();
    updateCacheStatsUI();
}
    // ----- ratingEngine.js -----
/**
 * Applies filtering to a single tweet by replacing its contents with a minimal placeholder.
 * Also updates the rating indicator.
 * @param {Element} tweetArticle - The tweet element.
 */
function filterSingleTweet(tweetArticle) {
    const cell = tweetArticle.closest('div[data-testid="cellInnerDiv"]');
    if (!cell) {
        return;
    }
    const handles = getUserHandles(tweetArticle);
    const authorHandle = handles.length > 0 ? handles[0] : '';
    const tweetText = getTweetText(tweetArticle) || '';
    const mediaUrls = extractMediaLinks(tweetArticle);
    const tid = getTweetID(tweetArticle);
    const cacheUpdateData = {
        authorHandle: authorHandle,
        individualTweetText: tweetText,
        individualMediaUrls: mediaUrls,
        timestamp: Date.now()
    };
    tweetCache.set(tid, cacheUpdateData, false);
    if (authorHandle && adAuthorCache.has(authorHandle)) {
        const tweetId = getTweetID(tweetArticle);
        if (tweetId) {
            ScoreIndicatorRegistry.get(tweetId)?.destroy();
        }
        cell.innerHTML = '';
        cell.dataset.filtered = 'true';
        cell.dataset.isAd = 'true';
        return;
    }
    cell.dataset.tweetText = tweetText;
    cell.dataset.authorHandle = authorHandle;
    cell.dataset.mediaUrls = JSON.stringify(mediaUrls);
    cell.dataset.tweetId = tid;
    const score = parseInt(tweetArticle.dataset.slopScore || '9', 10);
    const tweetId = getTweetID(tweetArticle);
    const indicatorInstance = ScoreIndicatorRegistry.get(tweetId, tweetArticle);
    indicatorInstance?.ensureIndicatorAttached();
    const currentFilterThreshold = parseInt(browserGet('filterThreshold', '1'));
    const ratingStatus = tweetArticle.dataset.ratingStatus;
    if (indicatorInstance) {
        indicatorInstance.isAuthorBlacklisted = isUserBlacklisted(authorHandle);
    }
    if (isUserBlacklisted(authorHandle)) {
        delete cell.dataset.filtered;
        cell.dataset.authorBlacklisted = 'true';
        if (indicatorInstance) {
            indicatorInstance._updateIndicatorUI();
        }
    } else {
        delete cell.dataset.authorBlacklisted;
        if (ratingStatus === 'pending' || ratingStatus === 'streaming') {
            delete cell.dataset.filtered;
        } else if (isNaN(score) || score < currentFilterThreshold) {
            const existingInstanceToDestroy = ScoreIndicatorRegistry.get(tweetId, tweetArticle);
            if (existingInstanceToDestroy) {
                existingInstanceToDestroy.destroy();
            }
            cell.innerHTML = '';
            cell.dataset.filtered = 'true';
        } else {
            delete cell.dataset.filtered;
            if (indicatorInstance) {
                indicatorInstance._updateIndicatorUI();
            }
        }
    }
}
/**
 * Applies a cached rating (if available) to a tweet article.
 * Also sets the rating status to 'rated' and updates the indicator.
 * @param {Element} tweetArticle - The tweet element.
 * @returns {boolean} True if a cached rating was applied.
 */
function applyTweetCachedRating(tweetArticle) {
    const tweetId = getTweetID(tweetArticle);
    const cachedRating = tweetCache.get(tweetId);
    if (cachedRating) {
        if (cachedRating.streaming === true &&
            (cachedRating.score === undefined || cachedRating.score === null)) {
            return false;
        }
        if (cachedRating.score !== undefined && cachedRating.score !== null) {
            tweetArticle.dataset.slopScore = cachedRating.score.toString();
            tweetArticle.dataset.ratingStatus = cachedRating.fromStorage ? 'cached' : 'rated';
            tweetArticle.dataset.ratingDescription = cachedRating.description || "not available";
            tweetArticle.dataset.ratingReasoning = cachedRating.reasoning || '';
            const indicatorInstance = ScoreIndicatorRegistry.get(tweetId, tweetArticle);
            if (indicatorInstance) {
                indicatorInstance.rehydrateFromCache(cachedRating);
            } else {
                return false;
            }
            filterSingleTweet(tweetArticle);
            return true;
        } else if (!cachedRating.streaming) {
            //cached object with score undefined or null, and not pending rating.
            tweetCache.delete(tweetId);
            return false;
        }
    }
    return false;
}
/**
 * Checks if a given user handle is in the blacklist.
 * @param {string} handle - The Twitter handle.
 * @returns {boolean} True if blacklisted, false otherwise.
 */
function isUserBlacklisted(handle) {
    if (!handle) return false;
    handle = handle.toLowerCase().trim();
    return blacklistedHandles.some(h => h.toLowerCase().trim() === handle);
}
const VALID_FINAL_STATES = ['rated', 'cached', 'blacklisted', 'manual'];
const VALID_INTERIM_STATES = ['pending', 'streaming'];
const getFullContextPromises = new Map();
function isValidFinalState(status) {
    return VALID_FINAL_STATES.includes(status);
}
function isValidInterimState(status) {
    return VALID_INTERIM_STATES.includes(status);
}
async function delayedProcessTweet(tweetArticle, tweetId, authorHandle) {
    let processingSuccessful = false;
    try {
        const apiKey = browserGet('openrouter-api-key', '');
        if (apiKey) {
            let score = 5;
            let description = "";
            let reasoning = "";
            let questions = [];
            let lastAnswer = "";
            try {
                const cachedRating = tweetCache.get(tweetId);
                if (cachedRating && !cachedRating.score && !cachedRating.streaming) {
                    tweetCache.delete(tweetId);
                }
                const fullContextWithImageDescription = await getFullContext(tweetArticle, tweetId, apiKey);
                if (!fullContextWithImageDescription) {
                    throw new Error("Failed to get tweet context");
                }
                let mediaURLs = [];
                if (document.querySelector('div[aria-label="Timeline: Conversation"]')) {
                    const replyInfo = getTweetReplyInfo(tweetId);
                    if (replyInfo && replyInfo.replyTo) {
                        if (!tweetCache.has(tweetId)) {
                            tweetCache.set(tweetId, {});
                        }
                        if (!tweetCache.get(tweetId).threadContext) {
                            tweetCache.get(tweetId).threadContext = {
                                replyTo: replyInfo.to,
                                replyToId: replyInfo.replyTo,
                                isRoot: false
                            };
                        }
                    }
                }
                const mediaMatches1 = fullContextWithImageDescription.matchAll(/(?:\[MEDIA_URLS\]:\s*\n)(.*?)(?:\n|$)/g);
                const mediaMatches2 = fullContextWithImageDescription.matchAll(/(?:\[QUOTED_TWEET_MEDIA_URLS\]:\s*\n)(.*?)(?:\n|$)/g);
                const videoMatches1 = fullContextWithImageDescription.matchAll(/(?:\[VIDEO_DESCRIPTIONS\]:\s*\n)([\s\S]*?)(?:\n\[|$)/g);
                const videoMatches2 = fullContextWithImageDescription.matchAll(/(?:\[QUOTED_TWEET_VIDEO_DESCRIPTIONS\]:\s*\n)([\s\S]*?)(?:\n\[|$)/g);
                for (const match of mediaMatches1) {
                    if (match[1]) {
                        mediaURLs.push(...match[1].split(', ').filter(url => url.trim()));
                    }
                }
                for (const match of mediaMatches2) {
                    if (match[1]) {
                        mediaURLs.push(...match[1].split(', ').filter(url => url.trim()));
                    }
                }
                for (const match of videoMatches1) {
                    if (match[1]) {
                        const videoLines = match[1].trim().split('\n').filter(line => line.trim());
                        videoLines.forEach(line => {
                            if (line.startsWith('[VIDEO ')) {
                                const desc = line.replace(/^\[VIDEO \d+\]: /, '');
                                mediaURLs.push(`[VIDEO_DESCRIPTION]: ${desc}`);
                            }
                        });
                    }
                }
                for (const match of videoMatches2) {
                    if (match[1]) {
                        const videoLines = match[1].trim().split('\n').filter(line => line.trim());
                        videoLines.forEach(line => {
                            if (line.startsWith('[VIDEO ')) {
                                const desc = line.replace(/^\[VIDEO \d+\]: /, '');
                                mediaURLs.push(`[VIDEO_DESCRIPTION]: ${desc}`);
                            }
                        });
                    }
                }
                mediaURLs = [...new Set(mediaURLs.filter(item => item.trim()))];
                const hasPotentialImageContainers = tweetArticle.querySelector('div[data-testid="tweetPhoto"], div[data-testid="videoPlayer"]');
                const imageDescriptionsEnabled = browserGet('enableImageDescriptions', false);
                if (hasPotentialImageContainers && mediaURLs.length === 0 && (imageDescriptionsEnabled || modelSupportsImages(selectedModel))) {
                }
                if (fullContextWithImageDescription) {
                    try {
                        const currentCache = tweetCache.get(tweetId);
                        const isCached = currentCache &&
                            !currentCache.streaming &&
                            currentCache.score !== undefined &&
                            currentCache.score !== null;
                        if (isCached) {
                            score = currentCache.score;
                            description = currentCache.description || "";
                            reasoning = currentCache.reasoning || "";
                            questions = currentCache.questions || [];
                            lastAnswer = currentCache.lastAnswer || "";
                            const mediaUrls = currentCache.mediaUrls || [];
                            processingSuccessful = true;
                            ScoreIndicatorRegistry.get(tweetId, tweetArticle)?.update({
                                status: currentCache.fromStorage ? 'cached' : 'rated',
                                score: score,
                                description: description,
                                reasoning: reasoning,
                                questions: questions,
                                lastAnswer: lastAnswer,
                                metadata: currentCache.metadata || null,
                                mediaUrls: mediaUrls
                            });
                            filterSingleTweet(tweetArticle);
                            return;
                        }
                        const filteredMediaURLs = mediaURLs.filter(item => !item.startsWith('[VIDEO_DESCRIPTION]:'));
                        const rating = await rateTweetWithOpenRouter(fullContextWithImageDescription, tweetId, apiKey, filteredMediaURLs, 3, tweetArticle, authorHandle);
                        score = rating.score;
                        description = rating.content;
                        reasoning = rating.reasoning || '';
                        questions = rating.questions || [];
                        lastAnswer = "";
                        let finalStatus = rating.error ? 'error' : 'rated';
                        if (!rating.error) {
                            const cacheEntry = tweetCache.get(tweetId);
                            if (cacheEntry && cacheEntry.fromStorage) {
                                finalStatus = 'cached';
                            } else if (rating.cached) {
                                finalStatus = 'cached';
                            }
                        }
                        tweetArticle.dataset.ratingStatus = finalStatus;
                        tweetArticle.dataset.ratingDescription = description || "not available";
                        tweetArticle.dataset.slopScore = score?.toString() || '';
                        tweetArticle.dataset.ratingReasoning = reasoning;
                        ScoreIndicatorRegistry.get(tweetId, tweetArticle)?.update({
                            status: finalStatus,
                            score: score,
                            description: description,
                            reasoning: reasoning,
                            questions: questions,
                            lastAnswer: lastAnswer,
                            metadata: rating.data?.id ? { generationId: rating.data.id } : null,
                            mediaUrls: mediaURLs
                        });
                        processingSuccessful = !rating.error;
                        filterSingleTweet(tweetArticle);
                        return;
                    } catch (apiError) {
                        score = 5;
                        description = `API Error: ${apiError.message}`;
                        reasoning = '';
                        questions = [];
                        lastAnswer = '';
                        processingSuccessful = false;
                        ScoreIndicatorRegistry.get(tweetId, tweetArticle)?.update({
                            status: 'error',
                            score: score,
                            description: description,
                            questions: [],
                            lastAnswer: ""
                        });
                        const errorCacheEntry = tweetCache.get(tweetId) || {};
                        const errorUpdate = {
                            ...errorCacheEntry,
                            score: score,
                            description: description,
                            reasoning: reasoning,
                            questions: questions,
                            lastAnswer: lastAnswer,
                            streaming: false,
                            timestamp: Date.now()
                        };
                        tweetCache.set(tweetId, errorUpdate, true);
                        filterSingleTweet(tweetArticle);
                        return;
                    }
                }
                filterSingleTweet(tweetArticle);
            } catch (error) {
                if (error.message === "Media content not extracted despite presence of media containers.") {
                    if (tweetCache.has(tweetId)) {
                        tweetCache.delete(tweetId);
                    }
                }
                ScoreIndicatorRegistry.get(tweetId, tweetArticle)?.update({
                    status: 'error',
                    score: 5,
                    description: "Error during processing: " + error.message,
                    questions: [],
                    lastAnswer: ""
                });
                processingSuccessful = false;
            } finally {
                if (!processingSuccessful) {
                    processedTweets.delete(tweetId);
                }
            }
        } else {
            tweetArticle.dataset.ratingStatus = 'error';
            tweetArticle.dataset.ratingDescription = "No API key";
            ScoreIndicatorRegistry.get(tweetId, tweetArticle)?.update({
                status: 'error',
                score: 9,
                description: "No API key",
                questions: [],
                lastAnswer: ""
            });
            processingSuccessful = true;
        }
        filterSingleTweet(tweetArticle);
        return;
    } catch (error) {
        const indicatorInstance = ScoreIndicatorRegistry.get(tweetId);
        if (indicatorInstance) {
            indicatorInstance.update({
                status: 'error',
                score: 5,
                description: "Error during processing: " + error.message,
                questions: [],
                lastAnswer: ""
            });
        }
        filterSingleTweet(tweetArticle);
        processingSuccessful = false;
    } finally {
        if (!processingSuccessful) {
            processedTweets.delete(tweetId);
            const indicatorInstance = ScoreIndicatorRegistry.get(tweetId);
            if (indicatorInstance && !isValidFinalState(indicatorInstance.status)) {
                setTimeout(() => {
                    if (!isValidFinalState(ScoreIndicatorRegistry.get(tweetId)?.status)) {
                        scheduleTweetProcessing(tweetArticle);
                    }
                }, PROCESSING_DELAY_MS * 2);
            }
        }
    }
}
const MAPPING_INCOMPLETE_TWEETS = new Set();
async function scheduleTweetProcessing(tweetArticle, rateAnyway = false) {
    const tweetId = getTweetID(tweetArticle);
    if (!tweetId) {
        return;
    }
    if (window.activeStreamingRequests && window.activeStreamingRequests[tweetId]) {
        return;
    }
    const handles = getUserHandles(tweetArticle);
    const authorHandle = handles.length > 0 ? handles[0] : '';
    if ((authorHandle && adAuthorCache.has(authorHandle)) || isAd(tweetArticle)) {
        if (authorHandle && !adAuthorCache.has(authorHandle)) adAuthorCache.add(authorHandle);
        tweetArticle.dataset.ratingStatus = 'rated';
        tweetArticle.dataset.ratingDescription = "Advertisement";
        tweetArticle.dataset.slopScore = '0';
        ScoreIndicatorRegistry.get(tweetId, tweetArticle)?.update({
            status: 'rated',
            score: 0,
            description: "Advertisement",
            questions: [],
            lastAnswer: ""
        });
        filterSingleTweet(tweetArticle);
        return;
    }
    const existingInstance = ScoreIndicatorRegistry.get(tweetId);
    existingInstance?.ensureIndicatorAttached();
    if (existingInstance && !rateAnyway) {
        if (isValidFinalState(existingInstance.status) || (isValidInterimState(existingInstance.status) && processedTweets.has(tweetId))) {
            filterSingleTweet(tweetArticle);
            return;
        }
        processedTweets.delete(tweetId);
    }
    const conversation = document.querySelector('div[aria-label="Timeline: Conversation"]') ||
        document.querySelector('div[aria-label^="Timeline: Conversation"]');
    if (conversation) {
        if (!conversation.dataset.threadMapping) {
            MAPPING_INCOMPLETE_TWEETS.add(tweetId);
            const indicatorInstance = ScoreIndicatorRegistry.get(tweetId, tweetArticle);
            if (indicatorInstance) {
                indicatorInstance.update({
                    status: 'pending',
                    score: null,
                    description: 'Waiting for thread context...',
                    questions: [],
                    lastAnswer: ""
                });
            }
            return;
        }
        try {
            const mapping = JSON.parse(conversation.dataset.threadMapping);
            const tweetMapping = mapping.find(m => m.tweetId === tweetId);
            if (!tweetMapping) {
                MAPPING_INCOMPLETE_TWEETS.add(tweetId);
                const indicatorInstance = ScoreIndicatorRegistry.get(tweetId, tweetArticle);
                if (indicatorInstance) {
                    indicatorInstance.update({
                        status: 'pending',
                        score: null,
                        description: 'Waiting for thread context...',
                        questions: [],
                        lastAnswer: ""
                    });
                }
                return;
            }
        } catch (e) {
        }
    }
    if (tweetCache.has(tweetId)) {
        const isIncompleteStreaming = tweetCache.get(tweetId).streaming === true && !tweetCache.get(tweetId).score;
        if (!isIncompleteStreaming && applyTweetCachedRating(tweetArticle)) {
            return;
        }
    }
    if (processedTweets.has(tweetId)) {
        const instance = ScoreIndicatorRegistry.get(tweetId);
        if (instance) {
            instance.ensureIndicatorAttached();
            if (instance.status === 'pending' || instance.status === 'streaming') {
                filterSingleTweet(tweetArticle);
                return;
            }
        }
        processedTweets.delete(tweetId);
    }
    const indicatorInstance = ScoreIndicatorRegistry.get(tweetId, tweetArticle);
    if (indicatorInstance) {
        if (indicatorInstance.status !== 'blacklisted' &&
            indicatorInstance.status !== 'cached' &&
            indicatorInstance.status !== 'rated') {
            indicatorInstance.update({ status: 'pending', score: null, description: 'Rating scheduled...', questions: [], lastAnswer: "" });
        } else {
            indicatorInstance.ensureIndicatorAttached();
            filterSingleTweet(tweetArticle);
            return;
        }
    } else {
    }
    if (!processedTweets.has(tweetId)) {
        processedTweets.add(tweetId);
    }
    setTimeout(() => {
        try {
            if (!browserGet('enableAutoRating', true) && !rateAnyway) {
                const indicatorInstance = ScoreIndicatorRegistry.get(tweetId, tweetArticle);
                if (indicatorInstance) {
                    indicatorInstance.update({
                        status: 'manual',
                        score: null,
                        description: 'Click the Rate button to rate this tweet',
                        reasoning: '',
                        questions: [],
                        lastAnswer: ""
                    });
                    filterSingleTweet(tweetArticle);
                }
                return;
            }
            delayedProcessTweet(tweetArticle, tweetId, authorHandle);
        } catch (e) {
            processedTweets.delete(tweetId);
        }
    }, PROCESSING_DELAY_MS);
}
let threadRelationships = {};
const THREAD_CHECK_INTERVAL = 1500;
const SWEEP_INTERVAL = 2500;
const THREAD_MAPPING_TIMEOUT = 1000;
let threadMappingInProgress = false;
function loadThreadRelationships() {
    try {
        const savedRelationships = browserGet('threadRelationships', '{}');
        threadRelationships = JSON.parse(savedRelationships);
    } catch (e) {
        threadRelationships = {};
    }
}
function saveThreadRelationships() {
    try {
        const relationshipCount = Object.keys(threadRelationships).length;
        if (relationshipCount > 1000) {
            const entries = Object.entries(threadRelationships);
            entries.sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0));
            const recent = entries.slice(0, 500);
            threadRelationships = Object.fromEntries(recent);
        }
        browserSet('threadRelationships', JSON.stringify(threadRelationships));
    } catch (e) {
    }
}
loadThreadRelationships();
async function buildReplyChain(tweetId, maxDepth = Infinity) {
    if (!tweetId || maxDepth <= 0) return [];
    const chain = [];
    let currentId = tweetId;
    let depth = 0;
    while (currentId && depth < maxDepth) {
        const replyInfo = threadRelationships[currentId];
        if (!replyInfo || !replyInfo.replyTo) break;
        chain.push({
            fromId: currentId,
            toId: replyInfo.replyTo,
            from: replyInfo.from,
            to: replyInfo.to
        });
        currentId = replyInfo.replyTo;
        depth++;
    }
    return chain;
}
/**
 * Extracts the full context of a tweet article and returns a formatted string.
 *
 * Schema:
 * [TWEET]:
 * @[the author of the tweet]
 * [the text of the tweet]
 * [MEDIA_DESCRIPTION]:
 * [IMAGE 1]: [description], [IMAGE 2]: [description], etc.
 * [QUOTED_TWEET]:
 * [the text of the quoted tweet]
 * [QUOTED_TWEET_MEDIA_DESCRIPTION]:
 * [IMAGE 1]: [description], [IMAGE 2]: [description], etc.
 *
 * @param {Element} tweetArticle - The tweet article element.
 * @param {string} tweetId - The tweet's ID.
 * @param {string} apiKey - API key used for getting image descriptions.
 * @returns {Promise<string>} - The full context string.
 */
async function getFullContext(tweetArticle, tweetId, apiKey) {
    if (getFullContextPromises.has(tweetId)) {
        return getFullContextPromises.get(tweetId);
    }
    const contextPromise = (async () => {
        try {
            const handles = getUserHandles(tweetArticle);
            const userHandle = handles.length > 0 ? handles[0] : '';
            const quotedHandle = handles.length > 1 ? handles[1] : '';
            const mainText = getTweetText(tweetArticle);
            let allMediaLinks = extractMediaLinks(tweetArticle);
            let quotedText = "";
            let quotedMediaLinks = [];
            let quotedTweetId = null;
            const quoteContainer = tweetArticle.querySelector(QUOTE_CONTAINER_SELECTOR);
            if (quoteContainer) {
                const quotedLink = quoteContainer.querySelector('a[href*="/status/"]');
                if (quotedLink) {
                    const href = quotedLink.getAttribute('href');
                    const match = href.match(/\/status\/(\d+)/);
                    if (match && match[1]) {
                        quotedTweetId = match[1];
                    }
                }
                quotedText = getElementText(quoteContainer.querySelector(TWEET_TEXT_SELECTOR)) || "";
                quotedMediaLinks = extractMediaLinks(quoteContainer);
            }
            const conversation = document.querySelector('div[aria-label="Timeline: Conversation"]') ||
                document.querySelector('div[aria-label^="Timeline: Conversation"]');
            let threadMediaUrls = [];
            if (conversation && conversation.dataset.threadMapping && tweetCache.has(tweetId) && tweetCache.get(tweetId).threadContext?.threadMediaUrls) {
                threadMediaUrls = tweetCache.get(tweetId).threadContext.threadMediaUrls || [];
            } else if (conversation && conversation.dataset.threadMediaUrls) {
                try {
                    const allMediaUrls = JSON.parse(conversation.dataset.threadMediaUrls);
                    threadMediaUrls = Array.isArray(allMediaUrls) ? allMediaUrls : [];
                } catch (e) {
                }
            }
            let allAvailableMediaLinks = [...(allMediaLinks || [])];
            let mainMediaLinks = allAvailableMediaLinks.filter(link => !quotedMediaLinks.includes(link));
            const mainImageUrls = [];
            const mainVideoDescriptions = [];
            mainMediaLinks.forEach(item => {
                if (item.startsWith('[VIDEO_DESCRIPTION]:')) {
                    mainVideoDescriptions.push(item.replace('[VIDEO_DESCRIPTION]: ', ''));
                } else {
                    mainImageUrls.push(item);
                }
            });
            let engagementStats = "";
            const engagementDiv = tweetArticle.querySelector('div[role="group"][aria-label$=" views"]');
            if (engagementDiv) {
                engagementStats = engagementDiv.getAttribute('aria-label')?.trim() || "";
            }
            let fullContextWithImageDescription = `[TWEET ${tweetId}]
 Author:@${userHandle}:
` + mainText;
            if (mainVideoDescriptions.length > 0) {
                fullContextWithImageDescription += `
[VIDEO_DESCRIPTIONS]:
${mainVideoDescriptions.map((desc, i) => `[VIDEO ${i + 1}]: ${desc}`).join('\n')}`;
            }
            if (mainImageUrls.length > 0) {
                if (browserGet('enableImageDescriptions', false)) {
                    let mainMediaLinksDescription = await getImageDescription(mainImageUrls, apiKey, tweetId, userHandle);
                    fullContextWithImageDescription += `
[MEDIA_DESCRIPTION]:
${mainMediaLinksDescription}`;
                }
                fullContextWithImageDescription += `
[MEDIA_URLS]:
${mainImageUrls.join(", ")}`;
            }
            if (engagementStats) {
                fullContextWithImageDescription += `
[ENGAGEMENT_STATS]:
${engagementStats}`;
            }
            if (!isOriginalTweet(tweetArticle) && threadMediaUrls.length > 0) {
                const uniqueThreadMediaUrls = threadMediaUrls.filter(url =>
                    !mainMediaLinks.includes(url) && !quotedMediaLinks.includes(url));
                if (uniqueThreadMediaUrls.length > 0) {
                    fullContextWithImageDescription += `
[THREAD_MEDIA_URLS]:
${uniqueThreadMediaUrls.join(", ")}`;
                }
            }
            if (quotedText || quotedMediaLinks.length > 0) {
                fullContextWithImageDescription += `
[QUOTED_TWEET${quotedTweetId ? ' ' + quotedTweetId : ''}]:
 Author:@${quotedHandle}:
${quotedText}`;
                if (quotedMediaLinks.length > 0) {
                    const quotedImageUrls = [];
                    const quotedVideoDescriptions = [];
                    quotedMediaLinks.forEach(item => {
                        if (item.startsWith('[VIDEO_DESCRIPTION]:')) {
                            quotedVideoDescriptions.push(item.replace('[VIDEO_DESCRIPTION]: ', ''));
                        } else {
                            quotedImageUrls.push(item);
                        }
                    });
                    if (quotedVideoDescriptions.length > 0) {
                        fullContextWithImageDescription += `
[QUOTED_TWEET_VIDEO_DESCRIPTIONS]:
${quotedVideoDescriptions.map((desc, i) => `[VIDEO ${i + 1}]: ${desc}`).join('\n')}`;
                    }
                    if (quotedImageUrls.length > 0) {
                        if (browserGet('enableImageDescriptions', false)) {
                            let quotedMediaLinksDescription = await getImageDescription(quotedImageUrls, apiKey, tweetId, userHandle);
                            fullContextWithImageDescription += `
[QUOTED_TWEET_MEDIA_DESCRIPTION]:
${quotedMediaLinksDescription}`;
                        }
                        fullContextWithImageDescription += `
[QUOTED_TWEET_MEDIA_URLS]:
${quotedImageUrls.join(", ")}`;
                    }
                }
            }
            const conversationElement = document.querySelector('div[aria-label="Timeline: Conversation"], div[aria-label^="Timeline: Conversation"]');
            if (conversationElement) {
                const replyChain = await buildReplyChain(tweetId);
                let threadHistoryIncluded = false;
                if (conversationElement.dataset.threadHist) {
                    if (!isOriginalTweet(tweetArticle)) {
                        fullContextWithImageDescription = conversationElement.dataset.threadHist + `\n[REPLY]\n` + fullContextWithImageDescription;
                        threadHistoryIncluded = true;
                    }
                }
                if (replyChain.length > 0 && !threadHistoryIncluded) {
                    let parentContextsString = "";
                    let previousParentAuthor = null;
                    for (let i = replyChain.length - 1; i >= 0; i--) {
                        const link = replyChain[i];
                        const parentId = link.toId;
                        const parentUser = link.to || 'unknown';
                        let currentParentContent = null;
                        const parentCacheEntry = tweetCache.get(parentId);
                        if (parentCacheEntry && parentCacheEntry.fullContext) {
                            currentParentContent = parentCacheEntry.fullContext;
                        } else {
                            const parentArticleElement = Array.from(document.querySelectorAll(TWEET_ARTICLE_SELECTOR))
                                .find(el => getTweetID(el) === parentId);
                            if (parentArticleElement) {
                                const originalParentRelationship = threadRelationships[parentId];
                                delete threadRelationships[parentId];
                                try {
                                    currentParentContent = await getFullContext(parentArticleElement, parentId, apiKey);
                                } finally {
                                    if (originalParentRelationship) {
                                        threadRelationships[parentId] = originalParentRelationship;
                                    }
                                }
                            } else if (parentCacheEntry && parentCacheEntry.individualTweetText) {
                                currentParentContent = `[TWEET ${parentId}]\n Author:@${parentCacheEntry.authorHandle || parentUser}:\n${parentCacheEntry.individualTweetText}`;
                                if (parentCacheEntry.individualMediaUrls && parentCacheEntry.individualMediaUrls.length > 0) {
                                    try {
                                        if (browserGet('enableImageDescriptions', false)) {
                                            const parentMediaDesc = await getImageDescription(
                                                parentCacheEntry.individualMediaUrls,
                                                apiKey,
                                                parentId,
                                                parentCacheEntry.authorHandle || parentUser
                                            );
                                            currentParentContent += `\n[MEDIA_DESCRIPTION]:\n${parentMediaDesc}`;
                                        }
                                    } catch (e) {
                                    }
                                    currentParentContent += `\n[MEDIA_URLS]:\n${parentCacheEntry.individualMediaUrls.join(", ")}`;
                                }
                            }
                        }
                        if (previousParentAuthor) {
                            parentContextsString += `\n[REPLY TO @${previousParentAuthor}]\n`;
                        }
                        if (currentParentContent) {
                            const lastTweetMarker = currentParentContent.lastIndexOf('[TWEET ');
                            if (lastTweetMarker > 0) {
                                currentParentContent = currentParentContent.substring(lastTweetMarker);
                            }
                            parentContextsString += currentParentContent;
                        } else {
                            parentContextsString += `[CONTEXT UNAVAILABLE FOR TWEET ${parentId} @${parentUser}]`;
                        }
                        previousParentAuthor = parentUser;
                    }
                    if (previousParentAuthor) {
                        parentContextsString += `\n[REPLY TO @${previousParentAuthor}]\n`;
                    }
                    fullContextWithImageDescription = parentContextsString + fullContextWithImageDescription;
                }
                const replyInfo = getTweetReplyInfo(tweetId);
                if (replyInfo && replyInfo.to && !threadHistoryIncluded && replyChain.length === 0) {
                    fullContextWithImageDescription = `[REPLY TO @${replyInfo.to}]\n` + fullContextWithImageDescription;
                }
            }
            tweetArticle.dataset.fullContext = fullContextWithImageDescription;
            const existingCacheEntryForCurrentTweet = tweetCache.get(tweetId) || {};
            const updatedCacheEntry = {
                ...existingCacheEntryForCurrentTweet,
                fullContext: fullContextWithImageDescription,
                timestamp: existingCacheEntryForCurrentTweet.timestamp || Date.now()
            };
            if (existingCacheEntryForCurrentTweet.score === undefined && updatedCacheEntry.score === null) {
                updatedCacheEntry.score = undefined;
            }
            tweetCache.set(tweetId, updatedCacheEntry, false);
            return fullContextWithImageDescription;
        } finally {
            getFullContextPromises.delete(tweetId);
        }
    })();
    getFullContextPromises.set(tweetId, contextPromise);
    return contextPromise;
}
/**
 * Applies filtering to all tweets currently in the observed container.
 */
function applyFilteringToAll() {
    if (!observedTargetNode) return;
    const tweets = observedTargetNode.querySelectorAll(TWEET_ARTICLE_SELECTOR);
    tweets.forEach(filterSingleTweet);
}
function ensureAllTweetsRated() {
    if (document.querySelector('div[aria-label="Timeline: Conversation"]') || !browserGet('enableAutoRating', false)) {
        return;
    }
    if (!observedTargetNode) return;
    const tweets = observedTargetNode.querySelectorAll(TWEET_ARTICLE_SELECTOR);
    if (tweets.length > 0) {
        tweets.forEach(tweet => {
            const tweetId = getTweetID(tweet);
            if (!tweetId) return;
            const indicatorInstance = ScoreIndicatorRegistry.get(tweetId);
            const needsProcessing = !indicatorInstance ||
                !indicatorInstance.status ||
                indicatorInstance.status === 'error' ||
                (!isValidFinalState(indicatorInstance.status) && !isValidInterimState(indicatorInstance.status)) ||
                (processedTweets.has(tweetId) && !isValidFinalState(indicatorInstance.status) && !isValidInterimState(indicatorInstance.status));
            if (needsProcessing) {
                if (processedTweets.has(tweetId)) {
                    processedTweets.delete(tweetId);
                }
                scheduleTweetProcessing(tweet);
            } else if (indicatorInstance && !isValidInterimState(indicatorInstance.status)) {
                filterSingleTweet(tweet);
            }
        });
    }
}
async function handleThreads() {
    try {
        let conversation = document.querySelector('div[aria-label="Timeline: Conversation"]');
        if (!conversation) {
            conversation = document.querySelector('div[aria-label^="Timeline: Conversation"]');
        }
        if (!conversation) return;
        if (threadMappingInProgress || conversation.dataset.threadMappingInProgress === "true") {
            return;
        }
        const lastMappedTimestamp = parseInt(conversation.dataset.threadMappedAt || '0', 10);
        const MAPPING_COOLDOWN_MS = 1000;
        if (Date.now() - lastMappedTimestamp < MAPPING_COOLDOWN_MS) {
            return;
        }
        const match = location.pathname.match(/status\/(\d+)/);
        const pageTweetId = match ? match[1] : null;
        if (!pageTweetId) return;
        let rootTweetId = pageTweetId;
        while (threadRelationships[rootTweetId] && threadRelationships[rootTweetId].replyTo) {
            rootTweetId = threadRelationships[rootTweetId].replyTo;
        }
        await mapThreadStructure(conversation, rootTweetId);
    } catch (error) {
        threadMappingInProgress = false;
    }
}
async function mapThreadStructure(conversation, localRootTweetId) {
    if (threadMappingInProgress || conversation.dataset.threadMappingInProgress) {
        return;
    }
    conversation.dataset.threadMappingInProgress = "true";
    threadMappingInProgress = true;
    try {
        const timeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Thread mapping timed out')), THREAD_MAPPING_TIMEOUT)
        );
        const mapping = async () => {
            const urlMatch = location.pathname.match(/status\/(\d+)/);
            const urlTweetId = urlMatch ? urlMatch[1] : null;
            let cellDivs = Array.from(conversation.querySelectorAll('div[data-testid="cellInnerDiv"]'));
            if (!cellDivs.length) {
                delete conversation.dataset.threadMappingInProgress;
                threadMappingInProgress = false;
                return;
            }
            cellDivs.sort((a, b) => {
                const aY = parseInt(a.style.transform.match(/translateY\((\d+)/)?.[1] || '0');
                const bY = parseInt(b.style.transform.match(/translateY\((\d+)/)?.[1] || '0');
                return aY - bY;
            });
            let tweetCells = [];
            let processedCount = 0;
            let urlTweetCellIndex = -1;
            for (let idx = 0; idx < cellDivs.length; idx++) {
                const cell = cellDivs[idx];
                let tweetId, username, text, mediaLinks = [], quotedMediaLinks = [];
                let article = cell.querySelector('article[data-testid="tweet"]');
                if (article) {
                    tweetId = getTweetID(article);
                    if (!tweetId) {
                        let tweetLink = article.querySelector('a[href*="/status/"]');
                        if (tweetLink) {
                            let match = tweetLink.href.match(/status\/(\d+)/);
                            if (match) tweetId = match[1];
                        }
                    }
                    const handles = getUserHandles(article);
                    username = handles.length > 0 ? handles[0] : null;
                    text = getTweetText(article).replace(/\n+/g, ' ⏎ ');
                    mediaLinks = extractMediaLinks(article);
                    const quoteContainer = article.querySelector(QUOTE_CONTAINER_SELECTOR);
                    if (quoteContainer) {
                        quotedMediaLinks = extractMediaLinks(quoteContainer);
                    }
                }
                tweetId = (tweetId || cell.dataset.tweetId) || '';
                username = (username || cell.dataset.authorHandle) || '';
                text = (text || cell.dataset.tweetText) || '';
                mediaLinks = (mediaLinks || JSON.parse(cell.dataset.mediaUrls)) || [];
                if (tweetId && username) {
                    const currentCellItem = {
                        type: 'tweet',
                        tweetNode: article,
                        username,
                        tweetId,
                        text,
                        mediaLinks,
                        quotedMediaLinks,
                        cellIndex: idx,
                        cellDiv: cell,
                        index: processedCount
                    };
                    tweetCells.push(currentCellItem);
                    if (tweetId === urlTweetId) {
                        urlTweetCellIndex = tweetCells.length - 1;
                    }
                    processedCount++;
                    if (article && !processedTweets.has(tweetId)) {
                        scheduleTweetProcessing(article);
                    }
                } else {
                    tweetCells.push({
                        type: 'separator',
                        cellDiv: cell,
                        cellIndex: idx,
                    });
                }
            }
            const urlTweetObject = urlTweetCellIndex !== -1 ? tweetCells[urlTweetCellIndex] : null;
            let effectiveUrlTweetInfo = null;
            if (urlTweetObject) {
                effectiveUrlTweetInfo = {
                    tweetId: urlTweetObject.tweetId,
                    username: urlTweetObject.username
                };
            } else if (urlTweetId) {
                const cachedUrlTweet = tweetCache.get(urlTweetId);
                if (cachedUrlTweet && cachedUrlTweet.authorHandle) {
                    effectiveUrlTweetInfo = {
                        tweetId: urlTweetId,
                        username: cachedUrlTweet.authorHandle
                    };
                } else {
                }
            } else {
            }
            const actualTweets = tweetCells.filter(tc => tc.type === 'tweet');
            if (actualTweets.length === 0) {
                delete conversation.dataset.threadMappingInProgress;
                threadMappingInProgress = false;
                return;
            }
            for (let i = 0; i < tweetCells.length; ++i) {
                let currentItem = tweetCells[i];
                if (currentItem.type === 'separator') {
                    continue;
                }
                if (i === 0) {
                    currentItem.replyTo = null;
                    currentItem.replyToId = null;
                    currentItem.isRoot = true;
                } else {
                    const previousItem = tweetCells[i - 1];
                    if (previousItem.type === 'separator') {
                        if (effectiveUrlTweetInfo && currentItem.tweetId !== effectiveUrlTweetInfo.tweetId) {
                            currentItem.replyTo = effectiveUrlTweetInfo.username;
                            currentItem.replyToId = effectiveUrlTweetInfo.tweetId;
                            currentItem.isRoot = false;
                        } else if (effectiveUrlTweetInfo && currentItem.tweetId === effectiveUrlTweetInfo.tweetId) {
                            currentItem.replyTo = null;
                            currentItem.replyToId = null;
                            currentItem.isRoot = true;
                        } else {
                            currentItem.replyTo = null;
                            currentItem.replyToId = null;
                            currentItem.isRoot = true;
                        }
                    } else if (previousItem.type === 'tweet') {
                        currentItem.replyTo = previousItem.username;
                        currentItem.replyToId = previousItem.tweetId;
                        currentItem.isRoot = false;
                    } else {
                        currentItem.replyTo = null;
                        currentItem.replyToId = null;
                        currentItem.isRoot = true;
                    }
                }
            }
            const replyDocs = tweetCells
                .filter(tc => tc.type === 'tweet')
                .map(tw => ({
                    from: tw.username,
                    tweetId: tw.tweetId,
                    to: tw.replyTo,
                    toId: tw.replyToId,
                    isRoot: tw.isRoot === true,
                    text: tw.text,
                    mediaLinks: tw.mediaLinks || [],
                    quotedMediaLinks: tw.quotedMediaLinks || []
                }));
            conversation.dataset.threadMapping = JSON.stringify(replyDocs);
            for (const waitingTweetId of MAPPING_INCOMPLETE_TWEETS) {
                const mappedTweet = replyDocs.find(doc => doc.tweetId === waitingTweetId);
                if (mappedTweet) {
                    const tweetArticle = tweetCells.find(tc => tc.tweetId === waitingTweetId)?.tweetNode;
                    if (tweetArticle) {
                        processedTweets.delete(waitingTweetId);
                        scheduleTweetProcessing(tweetArticle);
                    }
                }
            }
            MAPPING_INCOMPLETE_TWEETS.clear();
            const timestamp = Date.now();
            replyDocs.forEach(doc => {
                if (doc.tweetId && doc.toId) {
                    threadRelationships[doc.tweetId] = {
                        replyTo: doc.toId,
                        from: doc.from,
                        to: doc.to,
                        isRoot: false,
                        timestamp
                    };
                } else if (doc.tweetId && doc.isRoot) {
                    threadRelationships[doc.tweetId] = {
                        replyTo: null,
                        from: doc.from,
                        isRoot: true,
                        timestamp
                    };
                }
            });
            saveThreadRelationships();
            const batchSize = 10;
            for (let i = 0; i < replyDocs.length; i += batchSize) {
                const batch = replyDocs.slice(i, i + batchSize);
                batch.forEach(doc => {
                    if (doc.tweetId && tweetCache.has(doc.tweetId)) {
                        tweetCache.get(doc.tweetId).threadContext = {
                            replyTo: doc.to,
                            replyToId: doc.toId,
                            isRoot: doc.isRoot,
                            threadMediaUrls: doc.isRoot ? [] : getAllPreviousMediaUrls(doc.tweetId, replyDocs)
                        };
                        if (doc.tweetId && processedTweets.has(doc.tweetId)) {
                            const tweetCell = tweetCells.find(tc => tc.tweetId === doc.tweetId);
                            if (tweetCell && tweetCell.tweetNode) {
                                const isStreaming = tweetCell.tweetNode.dataset.ratingStatus === 'streaming' ||
                                    (tweetCache.has(doc.tweetId) && tweetCache.get(doc.tweetId).streaming === true);
                                if (!isStreaming) {
                                    processedTweets.delete(doc.tweetId);
                                    scheduleTweetProcessing(tweetCell.tweetNode);
                                }
                            }
                        }
                    }
                });
                if (i + batchSize < replyDocs.length) {
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
            }
            delete conversation.dataset.threadMappingInProgress;
            threadMappingInProgress = false;
            conversation.dataset.threadMappedAt = Date.now().toString();
        };
        function getAllPreviousMediaUrls(tweetId, replyDocs) {
            const allMediaUrls = [];
            const index = replyDocs.findIndex(doc => doc.tweetId === tweetId);
            if (index > 0) {
                for (let i = 0; i < index; i++) {
                    if (replyDocs[i].mediaLinks && replyDocs[i].mediaLinks.length) {
                        allMediaUrls.push(...replyDocs[i].mediaLinks);
                    }
                    if (replyDocs[i].quotedMediaLinks && replyDocs[i].quotedMediaLinks.length) {
                        allMediaUrls.push(...replyDocs[i].quotedMediaLinks);
                    }
                }
            }
            return allMediaUrls;
        }
        await Promise.race([mapping(), timeout]);
    } catch (error) {
        delete conversation.dataset.threadMappingInProgress;
        threadMappingInProgress = false;
    }
}
function getTweetReplyInfo(tweetId) {
    if (threadRelationships[tweetId]) {
        return threadRelationships[tweetId];
    }
    return null;
}
setInterval(handleThreads, THREAD_CHECK_INTERVAL);
setInterval(ensureAllTweetsRated, SWEEP_INTERVAL);
//setInterval(applyFilteringToAll, SWEEP_INTERVAL);
    // ----- api/api_requests.js -----
/**
 * Gets a completion from OpenRouter API
 *
 * @param {CompletionRequest} request - The completion request
 * @param {string} apiKey - OpenRouter API key
 * @param {number} [timeout=30000] - Request timeout in milliseconds
 * @returns {Promise<CompletionResult>} The completion result
 */
async function getCompletion(request, apiKey, timeout = 30000) {
    return new Promise((resolve) => {
        GM_xmlhttpRequest({
            method: "POST",
            url: "https://openrouter.ai/api/v1/chat/completions",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
                "HTTP-Referer": "https://greasyfork.org/en/scripts/532459-tweetfilter-ai",
                "X-Title": "TweetFilter-AI"
            },
            data: JSON.stringify(request),
            timeout: timeout,
            onload: function (response) {
                if (response.status >= 200 && response.status < 300) {
                    try {
                        const data = JSON.parse(response.responseText);
                        if (data.content==="") {
                            resolve({
                                error: true,
                                message: `No content returned${data.choices[0].native_finish_reason=="SAFETY"?" (SAFETY FILTER)":""}`,
                                data: data
                            });
                        }
                        resolve({
                            error: false,
                            message: "Request successful",
                            data: data
                        });
                    } catch (error) {
                        resolve({
                            error: true,
                            message: `Failed to parse response: ${error.message}`,
                            data: null
                        });
                    }
                } else {
                    resolve({
                        error: true,
                        message: `Request failed with status ${response.status}: ${response.responseText}`,
                        data: null
                    });
                }
            },
            onerror: function (error) {
                resolve({
                    error: true,
                    message: `Request error: ${error.toString()}`,
                    data: null
                });
            },
            ontimeout: function () {
                resolve({
                    error: true,
                    message: `Request timed out after ${timeout}ms`,
                    data: null
                });
            }
        });
    });
}
/**
 * Gets a streaming completion from OpenRouter API
 *
 * @param {CompletionRequest} request - The completion request
 * @param {string} apiKey - OpenRouter API key
 * @param {Function} onChunk - Callback for each chunk of streamed response
 * @param {Function} onComplete - Callback when streaming is complete
 * @param {Function} onError - Callback when an error occurs
 * @param {number} [timeout=30000] - Request timeout in milliseconds
 * @param {string} [tweetId=null] - Optional tweet ID to associate with this request
 * @returns {Object} The request object with an abort method
 */
function getCompletionStreaming(request, apiKey, onChunk, onComplete, onError, timeout = 90000, tweetId = null) {
    const streamingRequest = {
        ...request,
        stream: true
    };
    let fullResponse = "";
    let content = "";
    let reasoning = "";
    let responseObj = null;
    let streamComplete = false;
    const reqObj = GM_xmlhttpRequest({
        method: "POST",
        url: "https://openrouter.ai/api/v1/chat/completions",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
            "HTTP-Referer": "https://greasyfork.org/en/scripts/532459-tweetfilter-ai",
            "X-Title": "TweetFilter-AI"
        },
        data: JSON.stringify(streamingRequest),
        timeout: timeout,
        responseType: "stream",
        onloadstart: function(response) {
            const reader = response.response.getReader();
            let streamTimeout = null;
            let firstChunkReceived = false;
            const resetStreamTimeout = () => {
                if (streamTimeout) clearTimeout(streamTimeout);
                streamTimeout = setTimeout(() => {
                    if (!streamComplete) {
                        streamComplete = true;
                        onComplete({
                            content: content,
                            reasoning: reasoning,
                            fullResponse: fullResponse,
                            data: responseObj,
                            timedOut: true
                        });
                    }
                }, 30000);
            };
            const processStream = async () => {
                try {
                    let isDone = false;
                    let emptyChunksCount = 0;
                    while (!isDone && !streamComplete) {
                        const { done, value } = await reader.read();
                        if (done) {
                            isDone = true;
                            break;
                        }
                        if (!firstChunkReceived) {
                            firstChunkReceived = true;
                            resetStreamTimeout();
                        }
                        const chunk = new TextDecoder().decode(value);
                        clearTimeout(streamTimeout);
                        resetStreamTimeout();
                        if (chunk.trim() === '') {
                            emptyChunksCount++;
                            if (emptyChunksCount >= 3) {
                                isDone = true;
                                break;
                            }
                            continue;
                        }
                        emptyChunksCount = 0;
                        fullResponse += chunk;
                        const lines = chunk.split("\n");
                        for (const line of lines) {
                            if (line.startsWith("data: ")) {
                                const data = line.substring(6);
                                if (data === "[DONE]") {
                                    isDone = true;
                                    break;
                                }
                                try {
                                    const parsed = JSON.parse(data);
                                    responseObj = parsed;
                                    if (parsed.choices && parsed.choices[0]) {
                                        if (parsed.choices[0].delta && parsed.choices[0].delta.content !== undefined) {
                                            const delta = parsed.choices[0].delta.content || "";
                                            content += delta;
                                        }
                                        if (parsed.choices[0].delta && parsed.choices[0].delta.reasoning !== undefined) {
                                            const reasoningDelta = parsed.choices[0].delta.reasoning || "";
                                            reasoning += reasoningDelta;
                                        }
                                        onChunk({
                                            chunk: parsed.choices[0].delta?.content || "",
                                            reasoningChunk: parsed.choices[0].delta?.reasoning || "",
                                            content: content,
                                            reasoning: reasoning,
                                            data: parsed
                                        });
                                    }
                                } catch (e) {
                                }
                            }
                        }
                    }
                    if (!streamComplete) {
                        streamComplete = true;
                        if (streamTimeout) clearTimeout(streamTimeout);
                        if (tweetId && window.activeStreamingRequests) {
                            delete window.activeStreamingRequests[tweetId];
                        }
                        onComplete({
                            content: content,
                            reasoning: reasoning,
                            fullResponse: fullResponse,
                            data: responseObj
                        });
                    }
                } catch (error) {
                    if (streamTimeout) clearTimeout(streamTimeout);
                    if (!streamComplete) {
                        streamComplete = true;
                        if (tweetId && window.activeStreamingRequests) {
                            delete window.activeStreamingRequests[tweetId];
                        }
                        onError({
                            error: true,
                            message: `Stream processing error: ${error.toString()}`,
                            data: null
                        });
                    }
                }
            };
            processStream().catch(error => {
                if (streamTimeout) clearTimeout(streamTimeout);
                if (!streamComplete) {
                    streamComplete = true;
                    if (tweetId && window.activeStreamingRequests) {
                        delete window.activeStreamingRequests[tweetId];
                    }
                    onError({
                        error: true,
                        message: `Unhandled stream error: ${error.toString()}`,
                        data: null
                    });
                }
            });
        },
        onerror: function(error) {
            if (tweetId && window.activeStreamingRequests) {
                delete window.activeStreamingRequests[tweetId];
            }
            onError({
                error: true,
                message: `Request error: ${error.toString()}`,
                data: null
            });
        },
        ontimeout: function() {
            if (tweetId && window.activeStreamingRequests) {
                delete window.activeStreamingRequests[tweetId];
            }
            onError({
                error: true,
                message: `Request timed out after ${timeout}ms`,
                data: null
            });
        }
    });
    const streamingRequestObj = {
        abort: function() {
            streamComplete = true;
            pendingRequests--;
            try {
                reqObj.abort();
            } catch (e) {
            }
            if (tweetId && window.activeStreamingRequests) {
                delete window.activeStreamingRequests[tweetId];
            }
            if (tweetId && tweetCache.has(tweetId)) {
                const entry = tweetCache.get(tweetId);
                if (entry.streaming && (entry.score === undefined || entry.score === null)) {
                    tweetCache.delete(tweetId);
                }
            }
        }
    };
    if (tweetId && window.activeStreamingRequests) {
        window.activeStreamingRequests[tweetId] = streamingRequestObj;
    }
    return streamingRequestObj;
}
let isOnlineListenerAttached = false;
/**
 * Fetches the list of available models from the OpenRouter API.
 * Uses the stored API key, and updates the model selector upon success.
 */
function fetchAvailableModels() {
    const apiKey = browserGet('openrouter-api-key', '');
    if (!apiKey) {
        showStatus('Please enter your OpenRouter API key');
        return;
    }
    showStatus('Fetching available models...');
    const sortOrder = browserGet('modelSortOrder', 'throughput-high-to-low');
    function handleOnline() {
        showStatus('Back online. Fetching models...');
        fetchAvailableModels();
        window.removeEventListener('online', handleOnline);
        isOnlineListenerAttached = false;
    }
    GM_xmlhttpRequest({
        method: "GET",
        url: `https://openrouter.ai/api/frontend/models/find?order=${sortOrder}`,
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "HTTP-Referer": "https://greasyfork.org/en/scripts/532182-twitter-x-ai-tweet-filter",
            "X-Title": "Tweet Rating Tool"
        },
        onload: function (response) {
            try {
                const data = JSON.parse(response.responseText);
                if (data.data && data.data.models) {
                    let filteredModels = data.data.models.filter(model => model.endpoint && model.endpoint !== null);
                    filteredModels.forEach(model => {
                        let currentSlug = model.endpoint?.model_variant_slug || model.id;
                        model.slug = currentSlug;
                    });
                    if (sortOrder === 'latency-low-to-high'|| sortOrder === 'pricing-low-to-high') {
                        filteredModels.reverse();
                    }
                    availableModels = filteredModels || [];
                    listedModels = [...availableModels];
                    refreshModelsUI();
                    showStatus('Models updated!');
                }
            } catch (error) {
                showStatus('Error parsing models list');
            }
        },
        onerror: function (error) {
            if (!navigator.onLine) {
                if (!isOnlineListenerAttached) {
                    showStatus('Offline. Will attempt to fetch models when connection returns.');
                    window.addEventListener('online', handleOnline);
                    isOnlineListenerAttached = true;
                } else {
                    showStatus('Still offline. Waiting for connection to fetch models.');
                }
            } else {
                showStatus('Error fetching models!');
            }
        }
    });
}
/**
 * Gets descriptions for images using the OpenRouter API
 *
 * @param {string[]} urls - Array of image URLs to get descriptions for
 * @param {string} apiKey - The API key for authentication
 * @param {string} tweetId - The unique tweet ID
 * @param {string} userHandle - The Twitter user handle
 * @returns {Promise<string>} Combined image descriptions
 */
async function getImageDescription(urls, apiKey, tweetId, userHandle) {
    const imageDescriptionsEnabled = browserGet('enableImageDescriptions', false);
    if (!urls?.length || !imageDescriptionsEnabled) {
        return !imageDescriptionsEnabled ? '[Image descriptions disabled]' : '';
    }
    let descriptions = [];
    for (const url of urls) {
        const request = {
            model: selectedImageModel,
            messages: [{
                role: "user",
                content: [
                    {
                        type: "text",
                        text: "Describe this image. Include any text visible in the image, try to describe the image in a way that preserves all of the information and context present in the image."
                    },
                    {
                        type: "image_url",
                        image_url: { url }
                    }
                ]
            }],
            temperature: imageModelTemperature,
            top_p: imageModelTopP,
            max_tokens: maxTokens,
        };
        if (selectedImageModel.includes('gemini')) {
            request.config = {
                safetySettings: safetySettings,
            }
        }
        if (providerSort) {
            request.provider = {
                sort: providerSort,
                allow_fallbacks: true
            };
        }
        const result = await getCompletion(request, apiKey);
        if (!result.error && result.data?.choices?.[0]?.message?.content) {
            descriptions.push(result.data.choices[0].message.content);
        } else {
            descriptions.push('[Error getting image description]');
        }
    }
    return descriptions.map((desc, i) => `[IMAGE ${i + 1}]: ${desc}`).join('\n');
}
/**
 * Fetches generation metadata from OpenRouter API by ID.
 *
 * @param {string} generationId - The ID of the generation to fetch metadata for.
 * @param {string} apiKey - OpenRouter API key.
 * @param {number} [timeout=10000] - Request timeout in milliseconds.
 * @returns {Promise<CompletionResult>} The result containing metadata or an error.
 */
async function getGenerationMetadata(generationId, apiKey, timeout = 10000) {
    return new Promise((resolve) => {
        GM_xmlhttpRequest({
            method: "GET",
            url: `https://openrouter.ai/api/v1/generation?id=${generationId}`,
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "HTTP-Referer": "https://greasyfork.org/en/scripts/532459-tweetfilter-ai",
                "X-Title": "TweetFilter-AI"
            },
            timeout: timeout,
            onload: function(response) {
                if (response.status >= 200 && response.status < 300) {
                    try {
                        const data = JSON.parse(response.responseText);
                        resolve({
                            error: false,
                            message: "Metadata fetched successfully",
                            data: data
                        });
                    } catch (error) {
                        resolve({
                            error: true,
                            message: `Failed to parse metadata response: ${error.message}`,
                            data: null
                        });
                    }
                } else if (response.status === 404) {
                     resolve({
                         error: true,
                         status: 404,
                         message: `Generation metadata not found (404): ${response.responseText}`,
                         data: null
                     });
                } else {
                    resolve({
                        error: true,
                        status: response.status,
                        message: `Metadata request failed with status ${response.status}: ${response.responseText}`,
                        data: null
                    });
                }
            },
            onerror: function(error) {
                resolve({
                    error: true,
                    message: `Metadata request error: ${error.toString()}`,
                    data: null
                });
            },
            ontimeout: function() {
                resolve({
                    error: true,
                    message: `Metadata request timed out after ${timeout}ms`,
                    data: null
                });
            }
        });
    });
}
    // ----- api/api.js -----
/**
 * Formats description text for the tooltip.
 * Copy of the function from ui.js to ensure it's available for streaming.
 */
const safetySettings = [
    {
        category: "HARM_CATEGORY_HARASSMENT",
        threshold: "BLOCK_NONE",
    },
    {
        category: "HARM_CATEGORY_HATE_SPEECH",
        threshold: "BLOCK_NONE",
    },
    {
        category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        threshold: "BLOCK_NONE",
    },
    {
        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
        threshold: "BLOCK_NONE",
    },
    {
        category: "HARM_CATEGORY_CIVIC_INTEGRITY",
        threshold: "BLOCK_NONE",
    },
];
/**
 * Extracts follow-up questions from the AI response content.
 * @param {string} content - The full AI response content.
 * @returns {string[]} An array of 3 questions, or an empty array if not found.
 */
function extractFollowUpQuestions(content) {
    if (!content) return [];
    const questions = [];
    const q1Marker = "Q_1.";
    const q2Marker = "Q_2.";
    const q3Marker = "Q_3.";
    const q1Start = content.indexOf(q1Marker);
    const q2Start = content.indexOf(q2Marker);
    const q3Start = content.indexOf(q3Marker);
    if (q1Start !== -1 && q2Start > q1Start && q3Start > q2Start) {
        const q1Text = content.substring(q1Start + q1Marker.length, q2Start).trim();
        questions.push(q1Text);
        const q2Text = content.substring(q2Start + q2Marker.length, q3Start).trim();
        questions.push(q2Text);
        let q3Text = content.substring(q3Start + q3Marker.length).trim();
        const endMarker = "</FOLLOW_UP_QUESTIONS>";
        if (q3Text.endsWith(endMarker)) {
            q3Text = q3Text.substring(0, q3Text.length - endMarker.length).trim();
        }
        questions.push(q3Text);
        if (questions.every(q => q.length > 0)) {
            return questions;
        }
    }
    return [];
}
/**
 * Rates a tweet using the OpenRouter API with automatic retry functionality.
 *
 * @param {string} tweetText - The text content of the tweet
 * @param {string} tweetId - The unique tweet ID
 * @param {string} apiKey - The API key for authentication
 * @param {string[]} mediaUrls - Array of media URLs associated with the tweet
 * @param {number} [maxRetries=3] - Maximum number of retry attempts
 * @param {Element} [tweetArticle=null] - Optional: The tweet article DOM element (for streaming updates)
 * @returns {Promise<{score: number, content: string, error: boolean, cached?: boolean, data?: any, questions?: string[]}>} The rating result
 */
async function rateTweetWithOpenRouter(tweetText, tweetId, apiKey, mediaUrls, maxRetries = 3, tweetArticle = null, authorHandle="") {
    const cleanupRequest = () => {
        pendingRequests = Math.max(0, pendingRequests - 1);
        showStatus(`Rating tweet... (${pendingRequests} pending)`);
    };
    const indicatorInstance = ScoreIndicatorRegistry.get(tweetId, tweetArticle);
    if (!indicatorInstance) {
        return {
            score: 5,
            content: "Failed to initialize UI components for rating.",
            reasoning: "",
            questions: [],
            lastAnswer: "",
            error: true,
            cached: false,
            data: null,
            qaConversationHistory: []
        };
    }
    if (adAuthorCache.has(authorHandle)) {
        indicatorInstance.updateInitialReviewAndBuildHistory({
            fullContext: tweetText,
            mediaUrls: [],
            apiResponseContent: "<ANALYSIS>This tweet is from an ad author.</ANALYSIS><SCORE>SCORE_0</SCORE><FOLLOW_UP_QUESTIONS>Q_1. N/A\\nQ_2. N/A\\nQ_3. N/A</FOLLOW_UP_QUESTIONS>",
            reviewSystemPrompt: REVIEW_SYSTEM_PROMPT,
            followUpSystemPrompt: FOLLOW_UP_SYSTEM_PROMPT,
            userInstructions: currentInstructions
        });
        return {
            score: 0,
            content: indicatorInstance.description,
            reasoning: "",
            error: false,
            cached: false,
            questions: indicatorInstance.questions,
            qaConversationHistory: indicatorInstance.qaConversationHistory
        };
    }
    const currentInstructions = instructionsManager.getCurrentInstructions();
    const effectiveModel = browserGet('enableWebSearch', false) ? `${selectedModel}:online` : selectedModel;
    const requestBody = {
        model: effectiveModel,
        messages: [
            {
                role: "system",
                content: [{ type: "text", text: REVIEW_SYSTEM_PROMPT + `
USER'S CUSTOM INSTRUCTIONS:
${currentInstructions}`}]
            },
            {
                role: "user",
                content: [
                    {
                        type: "text",
                        text: `<TARGET_TWEET_ID>[${tweetId}]</TARGET_TWEET_ID>
<TWEET>[${tweetText}]</TWEET>
Follow this expected response format exactly, or you break the UI:
EXPECTED_RESPONSE_FORMAT:\n
  <ANALYSIS>\n
    \n(Your analysis according to the user instructions. Follow the user instructions EXACTLY.)
  </ANALYSIS>\n
  <SCORE>\n
    SCORE_X (Where X is a number between 0 and 10, unless the user requests a different range)\n
  </SCORE>\n
  <FOLLOW_UP_QUESTIONS>\n
    Q_1. …\n
    Q_2. …\n
    Q_3. …\n
  </FOLLOW_UP_QUESTIONS>
`
                    }
                ]
            }
        ],
        temperature: modelTemperature,
        top_p: modelTopP,
        max_tokens: maxTokens,
        reasoning: {
            enabled: true,
        },
    };
    if (selectedModel.includes('gemini')) {
        requestBody.config = { safetySettings: safetySettings };
    }
    if (mediaUrls?.length > 0) {
        const imageUrls = [];
        const videoDescriptions = [];
        mediaUrls.forEach(item => {
            if (item.startsWith('[VIDEO_DESCRIPTION]:')) {
                videoDescriptions.push(item);
            } else {
                imageUrls.push(item);
            }
        });
        if (imageUrls.length > 0 && modelSupportsImages(selectedModel)) {
            imageUrls.forEach(url => {
                if (url.startsWith('data:application/pdf')) {
                    requestBody.messages[1].content.push({
                        type: "file",
                        file: {
                            filename: "attachment.pdf",
                            file_data: url
                        }
                    });
                } else if (url.startsWith('http://') || url.startsWith('https://')) {
                    requestBody.messages[1].content.push({
                        type: "image_url",
                        image_url: { "url": url }
                    });
                } else {
                }
            });
        }
    }
    if (providerSort) {
        requestBody.provider = { sort: providerSort, allow_fallbacks: true };
    }
    const useStreaming = browserGet('enableStreaming', false);
    tweetCache.set(tweetId, {
        streaming: true,
        timestamp: Date.now(),
        tweetContent: tweetText,
        mediaUrls: mediaUrls
    });
    let attempt = 0;
    while (attempt < maxRetries) {
        attempt++;
        const now = Date.now();
        const timeElapsed = now - lastAPICallTime;
        if (timeElapsed < API_CALL_DELAY_MS) {
            await new Promise(resolve => setTimeout(resolve, Math.max(0, API_CALL_DELAY_MS - timeElapsed)));
        }
        lastAPICallTime = now;
        pendingRequests++;
        showStatus(`Rating tweet... (${pendingRequests} pending)`);
        try {
            let result;
            if (useStreaming) {
                result = await rateTweetStreaming(requestBody, apiKey, tweetId, tweetText, tweetArticle);
            } else {
                result = await rateTweet(requestBody, apiKey);
            }
            cleanupRequest();
            if (!result.error && result.content) {
                indicatorInstance.updateInitialReviewAndBuildHistory({
                    fullContext: tweetText,
                    mediaUrls: mediaUrls,
                    apiResponseContent: result.content,
                    reviewSystemPrompt: REVIEW_SYSTEM_PROMPT,
                    followUpSystemPrompt: FOLLOW_UP_SYSTEM_PROMPT,
                    userInstructions: currentInstructions
                });
                const finalScore = indicatorInstance.score;
                const finalQuestions = indicatorInstance.questions;
                const finalDescription = indicatorInstance.description;
                const finalQaHistory = indicatorInstance.qaConversationHistory;
                tweetCache.set(tweetId, {
                    score: finalScore,
                    description: finalDescription,
                    reasoning: result.reasoning || "",
                    questions: finalQuestions,
                    lastAnswer: "",
                    tweetContent: tweetText,
                    mediaUrls: mediaUrls,
                    streaming: false,
                    timestamp: Date.now(),
                    metadata: result.data?.id ? { generationId: result.data.id } : null,
                    qaConversationHistory: finalQaHistory
                });
                return {
                    score: finalScore,
                    content: result.content,
                    reasoning: result.reasoning || "",
                    questions: finalQuestions,
                    error: false,
                    cached: false,
                    data: result.data,
                    qaConversationHistory: finalQaHistory
                };
            }
            if (attempt < maxRetries && (result.error || !result.content)) {
                const backoffDelay = Math.pow(attempt, 2) * 1000;
                await new Promise(resolve => setTimeout(resolve, backoffDelay));
            } else if (result.error || !result.content) {
                throw new Error(result.content || "Failed to get valid rating content after multiple attempts");
            }
        } catch (error) {
            cleanupRequest();
            if (attempt < maxRetries) {
                const backoffDelay = Math.pow(attempt, 2) * 1000;
                await new Promise(resolve => setTimeout(resolve, backoffDelay));
            } else {
                const errorContent = `Failed to get valid rating after multiple attempts: ${error.message}`;
                indicatorInstance.updateInitialReviewAndBuildHistory({
                    fullContext: tweetText,
                    mediaUrls: mediaUrls,
                    apiResponseContent: `<ANALYSIS>${errorContent}</ANALYSIS><SCORE>SCORE_5</SCORE><FOLLOW_UP_QUESTIONS>Q_1. N/A\\nQ_2. N/A\\nQ_3. N/A</FOLLOW_UP_QUESTIONS>`,
                    reviewSystemPrompt: REVIEW_SYSTEM_PROMPT,
                    followUpSystemPrompt: FOLLOW_UP_SYSTEM_PROMPT,
                    userInstructions: currentInstructions
                });
                tweetCache.set(tweetId, {
                    score: 5,
                    description: errorContent,
                    reasoning: "",
                    questions: [],
                    lastAnswer: "",
                    error: true,
                    tweetContent: tweetText,
                    mediaUrls: mediaUrls,
                    streaming: false,
                    timestamp: Date.now(),
                    qaConversationHistory: indicatorInstance.qaConversationHistory
                });
                return {
                    score: 5,
                    content: errorContent,
                    reasoning: "",
                    questions: [],
                    lastAnswer: "",
                    error: true,
                    data: null,
                    qaConversationHistory: indicatorInstance.qaConversationHistory
                };
            }
        }
    }
    cleanupRequest();
    const fallbackError = "Unexpected failure in rating process.";
    indicatorInstance.updateInitialReviewAndBuildHistory({
        fullContext: tweetText,
        mediaUrls: mediaUrls,
        apiResponseContent: `<ANALYSIS>${fallbackError}</ANALYSIS><SCORE>SCORE_5</SCORE><FOLLOW_UP_QUESTIONS>Q_1. N/A\\nQ_2. N/A\\nQ_3. N/A</FOLLOW_UP_QUESTIONS>`,
        reviewSystemPrompt: REVIEW_SYSTEM_PROMPT,
        followUpSystemPrompt: FOLLOW_UP_SYSTEM_PROMPT,
        userInstructions: currentInstructions
    });
    return {
        score: 5,
        content: fallbackError,
        reasoning: "",
        questions: [],
        lastAnswer: "",
        error: true,
        data: null,
        qaConversationHistory: indicatorInstance.qaConversationHistory
    };
}
/**
 * Performs a non-streaming tweet rating request
 *
 * @param {Object} request - The formatted request body
 * @param {string} apiKey - API key for authentication
 * @returns {Promise<{content: string, reasoning: string, error: boolean, data: any}>} The rating result
 */
async function rateTweet(request, apiKey) {
    const tweetId = request.tweetId;
    const existingScore = tweetCache.get(tweetId)?.score;
    const result = await getCompletion(request, apiKey);
    if (!result.error && result.data?.choices?.[0]?.message) {
        const content = result.data.choices[0].message.content || "";
        const reasoning = result.data.choices[0].message.reasoning || "";
        const scoreMatches = content.match(/SCORE_(\d+)/g);
        const score = existingScore || (scoreMatches && scoreMatches.length > 0
            ? parseInt(scoreMatches[scoreMatches.length - 1].match(/SCORE_(\d+)/)[1], 10)
            : null);
        tweetCache.set(tweetId, {
            score: score,
            description: content,
            tweetContent: request.tweetText,
            streaming: false
        });
        return {
            content,
            reasoning
        };
    }
    return {
        error: true,
        content: result.error || "Unknown error",
        reasoning: "",
        data: null
    };
}
/**
 * Performs a streaming tweet rating request with real-time UI updates
 *
 * @param {Object} request - The formatted request body
 * @param {string} apiKey - API key for authentication
 * @param {string} tweetId - The tweet ID
 * @param {string} tweetText - The text content of the tweet
 * @param {Element} tweetArticle - Optional: The tweet article DOM element (for streaming updates)
 * @returns {Promise<{content: string, reasoning: string, error: boolean, data: any}>} The rating result including final content and reasoning
 */
async function rateTweetStreaming(request, apiKey, tweetId, tweetText, tweetArticle) {
    if (window.activeStreamingRequests && window.activeStreamingRequests[tweetId]) {
        window.activeStreamingRequests[tweetId].abort();
        delete window.activeStreamingRequests[tweetId];
    }
    const existingCache = tweetCache.get(tweetId);
    if (!existingCache || existingCache.score === undefined || existingCache.score === null) {
        tweetCache.set(tweetId, {
            streaming: true,
            timestamp: Date.now(),
            tweetContent: tweetText,
            description: "",
            reasoning: "",
            questions: [],
            lastAnswer: "",
            score: null
        });
    }
    return new Promise((resolve, reject) => {
        const indicatorInstance = ScoreIndicatorRegistry.get(tweetId, tweetArticle);
        if (!indicatorInstance) {
             if (tweetCache.has(tweetId)) {
                 tweetCache.get(tweetId).streaming = false;
                 tweetCache.get(tweetId).error = "Indicator initialization failed";
             }
             return reject(new Error(`ScoreIndicator instance could not be initialized for tweet ${tweetId}`));
        }
        let aggregatedContent = existingCache?.description || "";
        let aggregatedReasoning = existingCache?.reasoning || "";
        let finalData = null;
        let score = existingCache?.score || null;
        getCompletionStreaming(
            request,
            apiKey,
            (chunkData) => {
                aggregatedContent = chunkData.content || aggregatedContent;
                aggregatedReasoning = chunkData.reasoning || aggregatedReasoning;
                const scoreMatches = aggregatedContent.match(/SCORE_(\d+)/g);
                if (scoreMatches && scoreMatches.length > 0) {
                    const lastScore = scoreMatches[scoreMatches.length - 1];
                    score = parseInt(lastScore.match(/SCORE_(\d+)/)[1], 10);
                }
                 indicatorInstance.update({
                    status: 'streaming',
                    score: score,
                    description: aggregatedContent || "Rating in progress...",
                    reasoning: aggregatedReasoning,
                    questions: [],
                    lastAnswer: ""
                });
                if (tweetCache.has(tweetId)) {
                    const entry = tweetCache.get(tweetId);
                    entry.description = aggregatedContent;
                    entry.reasoning = aggregatedReasoning;
                    entry.score = score;
                    entry.streaming = true;
                }
            },
            (finalResult) => {
                aggregatedContent = finalResult.content || aggregatedContent;
                aggregatedReasoning = finalResult.reasoning || aggregatedReasoning;
                finalData = finalResult.data;
                const scoreMatches = aggregatedContent.match(/SCORE_(\d+)/g);
                if (scoreMatches && scoreMatches.length > 0) {
                    const lastScore = scoreMatches[scoreMatches.length - 1];
                    score = parseInt(lastScore.match(/SCORE_(\d+)/)[1], 10);
                }
                let finalStatus = 'rated';
                if (score === null || score === undefined) {
                    finalStatus = 'error';
                    score = 5;
                    aggregatedContent += "\n[No score detected - Error]";
                }
                const finalCacheData = {
                    tweetContent: tweetText,
                    score: score,
                    description: aggregatedContent,
                    reasoning: aggregatedReasoning,
                    streaming: false,
                    timestamp: Date.now(),
                    error: finalStatus === 'error' ? "No score detected" : undefined,
                    metadata: finalData?.id ? { generationId: finalData.id } : null
                };
                tweetCache.set(tweetId, finalCacheData);
                indicatorInstance.update({
                    status: finalStatus,
                    score: score,
                    description: aggregatedContent,
                    reasoning: aggregatedReasoning,
                    questions: extractFollowUpQuestions(aggregatedContent),
                    lastAnswer: "",
                    metadata: finalData?.id ? { generationId: finalData.id } : null
                });
                if (tweetArticle) {
                    filterSingleTweet(tweetArticle);
                }
                const generationId = finalData?.id;
                if (generationId && apiKey) {
                    fetchAndStoreGenerationMetadata(tweetId, generationId, apiKey, indicatorInstance);
                }
                resolve({
                    score: score,
                    content: aggregatedContent,
                    reasoning: aggregatedReasoning,
                    error: finalStatus === 'error',
                    cached: false,
                    data: finalData
                });
            },
            (errorData) => {
                indicatorInstance.update({
                    status: 'error',
                    score: 5,
                    description: `Stream Error: ${errorData.message}`,
                    reasoning: '',
                    questions: [],
                    lastAnswer: ''
                });
                if (tweetCache.has(tweetId)) {
                     const entry = tweetCache.get(tweetId);
                     entry.streaming = false;
                     entry.error = errorData.message;
                     entry.score = 5;
                     entry.description = `Stream Error: ${errorData.message}`;
                }
                reject(new Error(errorData.message));
            },
            30000,
            tweetId
        );
    });
}
/**
 * Fetches generation metadata with retry logic and updates cache/UI.
 * @param {string} tweetId
 * @param {string} generationId
 * @param {string} apiKey
 * @param {ScoreIndicator} indicatorInstance - The indicator instance to update.
 * @param {number} [attempt=0]
 * @param {number[]} [delays=[1000, 500, 2000, 4000, 8000]]
 */
async function fetchAndStoreGenerationMetadata(tweetId, generationId, apiKey, indicatorInstance, attempt = 0, delays = [1000, 500, 2000, 4000, 8000]) {
    if (attempt >= delays.length) {
        return;
    }
    const delay = delays[attempt];
    await new Promise(resolve => setTimeout(resolve, delay));
    try {
        const metadataResult = await getGenerationMetadata(generationId, apiKey);
        if (!metadataResult.error && metadataResult.data?.data) {
            const meta = metadataResult.data.data;
            const extractedMetadata = {
                model: meta.model || 'N/A',
                promptTokens: meta.tokens_prompt || 0,
                completionTokens: meta.tokens_completion || 0,
                reasoningTokens: meta.native_tokens_reasoning || 0,
                latency: meta.latency !== undefined ? (meta.latency / 1000).toFixed(2) + 's' : 'N/A',
                mediaInputs: meta.num_media_prompt || 0,
                price: meta.total_cost !== undefined ? `$${meta.total_cost.toFixed(6)}` : 'N/A',
                providerName: meta.provider_name || 'N/A'
            };
            const currentCache = tweetCache.get(tweetId);
            if (currentCache) {
                currentCache.metadata = extractedMetadata;
                tweetCache.set(tweetId, currentCache);
                indicatorInstance.update({ metadata: extractedMetadata });
            } else {
            }
            return;
        } else if (metadataResult.status === 404) {
            fetchAndStoreGenerationMetadata(tweetId, generationId, apiKey, indicatorInstance, attempt + 1, delays);
        } else {
            fetchAndStoreGenerationMetadata(tweetId, generationId, apiKey, indicatorInstance, attempt + 1, delays);
        }
    } catch (error) {
        fetchAndStoreGenerationMetadata(tweetId, generationId, apiKey, indicatorInstance, attempt + 1, delays);
    }
}
/**
 * Answers a follow-up question about a tweet and generates new questions.
 *
 * @param {string} tweetId - The ID of the tweet being discussed.
 * @param {object[]} qaHistoryForApiCall - The conversation history array, including the latest user message.
 * @param {string} apiKey - The OpenRouter API key.
 * @param {Element} [tweetArticle=null] - The DOM element for the tweet article.
 * @param {ScoreIndicator} indicatorInstance - The ScoreIndicator instance to update.
 * @returns {Promise<void>} Resolves when the answer is generated and UI updated.
 */
async function answerFollowUpQuestion(tweetId, qaHistoryForApiCall, apiKey, tweetArticle, indicatorInstance) {
    const questionTextForLogging = qaHistoryForApiCall.find(m => m.role === 'user' && m === qaHistoryForApiCall[qaHistoryForApiCall.length - 1])?.content.find(c => c.type === 'text')?.text || "User's question";
    const useStreaming = browserGet('enableStreaming', false);
    const messagesForApi = qaHistoryForApiCall.map((msg, index) => {
        if (index === qaHistoryForApiCall.length - 1 && msg.role === 'user') {
            const rawUserText = msg.content.find(c => c.type === 'text')?.text || "";
            const templatedText = `<UserQuestion> ${rawUserText} </UserQuestion>\n        You MUST match the EXPECTED_RESPONSE_FORMAT\n        EXPECTED_RESPONSE_FORMAT:\n        <ANSWER>\n(Your answer here)\n</ANSWER>\n
            <FOLLOW_UP_QUESTIONS> (Anticipate 3 things the user may ask you next. These questions should not be directed at the user. Only pose a question if you are sure you can answer it, based off your knowledge.)\nQ_1. (New Question 1 here)\nQ_2. (New Question 2 here)\nQ_3. (New Question 3 here)\n</FOLLOW_UP_QUESTIONS>\n        `;
            const templatedContent = [{ type: "text", text: templatedText }];
            msg.content.forEach(contentItem => {
                if (contentItem.type === "image_url") {
                    templatedContent.push(contentItem);
                }
            });
            return { ...msg, content: templatedContent };
        }
        return msg;
    });
    const effectiveModel = browserGet('enableWebSearch', false) ? `${selectedModel}:online` : selectedModel;
    const request = {
        model: effectiveModel,
        messages: messagesForApi,
        temperature: modelTemperature,
        top_p: modelTopP,
        max_tokens: maxTokens,
        stream: useStreaming
    };
    if (selectedModel.includes('gemini')) {
        request.config = { safetySettings: safetySettings };
    }
    if (providerSort) {
        request.provider = { sort: providerSort, allow_fallbacks: true };
    }
    try {
        try {
            let finalAnswerContent = "*Processing...*";
            let finalQaHistory = [...qaHistoryForApiCall];
            if (useStreaming) {
                await new Promise((resolve, reject) => {
                    let aggregatedContent = "";
                    let aggregatedReasoning = "";
                    getCompletionStreaming(
                        request, apiKey,
                        (chunkData) => {
                            aggregatedContent = chunkData.content || aggregatedContent;
                            aggregatedReasoning = chunkData.reasoning || aggregatedReasoning;
                            indicatorInstance._renderStreamingAnswer(aggregatedContent, aggregatedReasoning);
                        },
                        (result) => {
                            finalAnswerContent = result.content || aggregatedContent;
                            const finalReasoning = result.reasoning || aggregatedReasoning;
                            const assistantMessage = { role: "assistant", content: [{ type: "text", text: finalAnswerContent }] };
                            finalQaHistory.push(assistantMessage);
                            if (indicatorInstance.conversationHistory.length > 0) {
                                const lastTurn = indicatorInstance.conversationHistory[indicatorInstance.conversationHistory.length - 1];
                                if (lastTurn.answer === 'pending') {
                                    lastTurn.reasoning = finalReasoning;
                                }
                            }
                            indicatorInstance.updateAfterFollowUp({
                                assistantResponseContent: finalAnswerContent,
                                updatedQaHistory: finalQaHistory
                            });
                            const currentCache = tweetCache.get(tweetId) || {};
                            currentCache.qaConversationHistory = finalQaHistory;
                            const parsedAnswer = finalAnswerContent.match(/<ANSWER>([\s\S]*?)<\/ANSWER>/);
                            currentCache.lastAnswer = parsedAnswer ? parsedAnswer[1].trim() : finalAnswerContent;
                            currentCache.questions = extractFollowUpQuestions(finalAnswerContent);
                            currentCache.timestamp = Date.now();
                            tweetCache.set(tweetId, currentCache);
                            resolve();
                        },
                        (error) => {
                            const errorMessage = `Error generating answer: ${error.message}`;
                            indicatorInstance._updateConversationHistory(questionTextForLogging, errorMessage);
                            indicatorInstance.questions = tweetCache.get(tweetId)?.questions || [];
                            indicatorInstance._updateTooltipUI();
                            const currentCache = tweetCache.get(tweetId) || {};
                            currentCache.lastAnswer = errorMessage;
                            currentCache.timestamp = Date.now();
                            tweetCache.set(tweetId, currentCache);
                            reject(new Error(error.message));
                        },
                        60000,
                        `followup-${tweetId}`
                    );
                });
            } else {
                const result = await getCompletion(request, apiKey, 60000);
                if (result.error || !result.data?.choices?.[0]?.message?.content) {
                    throw new Error(result.message || "Failed to get follow-up answer.");
                }
                finalAnswerContent = result.data.choices[0].message.content;
                const assistantMessage = { role: "assistant", content: [{ type: "text", text: finalAnswerContent }] };
                finalQaHistory.push(assistantMessage);
                indicatorInstance.updateAfterFollowUp({
                    assistantResponseContent: finalAnswerContent,
                    updatedQaHistory: finalQaHistory
                });
                const currentCache = tweetCache.get(tweetId) || {};
                currentCache.qaConversationHistory = finalQaHistory;
                const parsedAnswer = finalAnswerContent.match(/<ANSWER>([\s\S]*?)<\/ANSWER>/);
                currentCache.lastAnswer = parsedAnswer ? parsedAnswer[1].trim() : finalAnswerContent;
                currentCache.questions = extractFollowUpQuestions(finalAnswerContent);
                currentCache.timestamp = Date.now();
                tweetCache.set(tweetId, currentCache);
            }
        } catch (error) {
            const errorMessage = `Error answering question: ${error.message}`;
            indicatorInstance._updateConversationHistory(questionTextForLogging, errorMessage);
            indicatorInstance.questions = tweetCache.get(tweetId)?.questions || [];
            indicatorInstance._updateTooltipUI();
            const currentCache = tweetCache.get(tweetId) || {};
            currentCache.lastAnswer = errorMessage;
            currentCache.timestamp = Date.now();
            tweetCache.set(tweetId, currentCache);
        }
    } finally {
        if (indicatorInstance && typeof indicatorInstance._finalizeFollowUpInteraction === 'function') {
            indicatorInstance._finalizeFollowUpInteraction();
        }
    }
}
    // ----- twitter-desloppifier.js -----
const VERSION = '1.5.6';
(function () {
    'use strict';
    let menuhtml = GM_getResourceText("MENU_HTML");
    browserSet('menuHTML', menuhtml);
    let firstRun = browserGet('firstRun', true);
    /**
     * Initializes the observer on the main content area, adds the UI elements,
     * starts processing visible tweets, and sets up periodic checks.
     */
    function initializeObserver() {
        const target = document.querySelector('main') || document.querySelector('div[data-testid="primaryColumn"]');
        if (target) {
            observedTargetNode = target;
            initialiseUI();
            if (firstRun) {
                resetSettings(true);
                browserSet('firstRun', false);
            }
            let apiKey = browserGet('openrouter-api-key', '');
            if(!apiKey){
                alert("No API Key found. Please enter your API Key in Settings > General.")
            }
            if (apiKey) {
                browserSet('openrouter-api-key', apiKey);
                showStatus(`Loaded ${tweetCache.size} cached ratings. Starting to rate visible tweets...`);
                fetchAvailableModels();
            }
            if(document.querySelector('[aria-label="Timeline: Conversation"]')){
                handleThreads();
            }else{
                observedTargetNode.querySelectorAll(TWEET_ARTICLE_SELECTOR).forEach(scheduleTweetProcessing);
            }
            const observer = new MutationObserver(handleMutations);
            observer.observe(observedTargetNode, { childList: true, subtree: true });
            window.addEventListener('beforeunload', () => {
                observer.disconnect();
                const sliderUI = document.getElementById('tweet-filter-container');
                if (sliderUI) sliderUI.remove();
                const settingsUI = document.getElementById('settings-container');
                if (settingsUI) settingsUI.remove();
                const statusIndicator = document.getElementById('status-indicator');
                if (statusIndicator) statusIndicator.remove();
                ScoreIndicatorRegistry.destroyAll();
            });
        } else {
            setTimeout(initializeObserver, 1);
        }
    }
    initializeObserver();
})();
})();
