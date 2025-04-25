// ==UserScript==
// @name         TweetFilter AI
// @namespace    http://tampermonkey.net/
// @version      Version 1.4.1
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
    console.log("X/Twitter Tweet De-Sloppification Activated (Combined Version)");
    // Embedded Menu.html
    const MENU = `<div id="tweetfilter-root-container"><button id="filter-toggle" class="toggle-button" style="display: none;">Filter Slider</button><div id="tweet-filter-container"><button class="close-button" data-action="close-filter">×</button><label for="tweet-filter-slider">SlopScore:</label><div class="filter-controls"><input type="range" id="tweet-filter-slider" min="0" max="10" step="1"><input type="number" id="tweet-filter-value" min="0" max="10" step="1" value="5"></div></div><button id="settings-toggle" class="toggle-button" data-action="toggle-settings"><span style="font-size: 14px;">⚙️</span> Settings</button><div id="settings-container" class="hidden"><div class="settings-header"><div class="settings-title">Twitter De-Sloppifier</div><button class="close-button" data-action="toggle-settings">×</button></div><div class="settings-content"><div class="tab-navigation"><button class="tab-button active" data-tab="general">General</button><button class="tab-button" data-tab="models">Models</button><button class="tab-button" data-tab="instructions">Instructions</button></div><div id="general-tab" class="tab-content active"><div class="section-title"><span style="font-size: 14px;">🔑</span> OpenRouter API Key <a href="https://openrouter.ai/settings/keys" target="_blank">Get one here</a></div><input id="openrouter-api-key" placeholder="Enter your OpenRouter API key"><button class="settings-button" data-action="save-api-key">Save API Key</button><div class="section-title" style="margin-top: 20px;"><span style="font-size: 14px;">🗄️</span> Cache Statistics</div><div class="stats-container"><div class="stats-row"><div class="stats-label">Cached Tweet Ratings</div><div class="stats-value" id="cached-ratings-count">0</div></div><div class="stats-row"><div class="stats-label">Whitelisted Handles</div><div class="stats-value" id="whitelisted-handles-count">0</div></div></div><button id="clear-cache" class="settings-button danger" data-action="clear-cache">Clear Rating Cache</button><div class="section-title" style="margin-top: 20px;"><span style="font-size: 14px;">💾</span> Backup &amp; Restore</div><div class="section-description">Export your settings and cached ratings to a file for backup, or import previously saved settings.</div><button class="settings-button danger" style="margin-top: 15px;" data-action="reset-settings">Reset to Defaults</button><div id="version-info" style="margin-top: 20px; font-size: 11px; opacity: 0.6; text-align: center;">Twitter De-Sloppifier v?.?</div></div><div id="models-tab" class="tab-content"><div class="section-title"><span style="font-size: 14px;">🧠</span> Tweet Rating Model</div><div class="section-description">The rating model is responsible for reviewing each tweet. <br>It will process images directly if you select an <strong>image-capable (🖼️)</strong> model.</div><div class="select-container" id="model-select-container"></div><div class="advanced-options"><div class="advanced-toggle" data-toggle="model-options-content"><div class="advanced-toggle-title">Options</div><div class="advanced-toggle-icon">▼</div></div><div class="advanced-content" id="model-options-content"><div class="sort-container"><label for="model-sort-order">Sort models by: </label><div class="controls-group"><select id="model-sort-order" data-setting="modelSortOrder"><option value="pricing-low-to-high">Price</option><option value="latency-low-to-high">Latency</option><option value="throughput-high-to-low">Throughput</option><option value="top-weekly">Popularity</option><option value="">Age</option></select><button id="sort-direction" class="sort-toggle" data-setting="sortDirection" data-value="default">High-Low</button></div></div><div class="sort-container"><label for="provider-sort">API Endpoint Priority: </label><select id="provider-sort" data-setting="providerSort"><option value="">Default (load-balanced)</option><option value="throughput">Throughput</option><option value="latency">Latency</option><option value="price">Price</option></select></div><div class="sort-container"><label><input type="checkbox" id="show-free-models" data-setting="showFreeModels" checked>Show Free Models</label></div><div class="parameter-row" data-param-name="modelTemperature"><div class="parameter-label" title="How random the model responses should be (0.0-1.0)">Temperature</div><div class="parameter-control"><input type="range" class="parameter-slider" min="0" max="2" step="0.1"><input type="number" class="parameter-value" min="0" max="2" step="0.01" style="width: 60px;"></div></div><div class="parameter-row" data-param-name="modelTopP"><div class="parameter-label" title="Nucleus sampling parameter (0.0-1.0)">Top-p</div><div class="parameter-control"><input type="range" class="parameter-slider" min="0" max="1" step="0.1"><input type="number" class="parameter-value" min="0" max="1" step="0.01" style="width: 60px;"></div></div><div class="parameter-row" data-param-name="maxTokens"><div class="parameter-label" title="Maximum number of tokens for the response (0 means no limit)">Max Tokens</div><div class="parameter-control"><input type="range" class="parameter-slider" min="0" max="2000" step="100"><input type="number" class="parameter-value" min="0" max="2000" step="100" style="width: 60px;"></div></div><div class="toggle-row"><div class="toggle-label" title="Stream API responses as they're generated for live updates">Enable Live Streaming</div><label class="toggle-switch"><input type="checkbox" data-setting="enableStreaming"><span class="toggle-slider"></span></label></div></div></div><div class="section-title" style="margin-top: 25px;"><span style="font-size: 14px;">🖼️</span> Image Processing Model</div><div class="section-description">This model generates <strong>text descriptions</strong> of images for the rating model.<br> Hint: If you selected an image-capable model (🖼️) as your <strong>main rating model</strong>, it will process images directly.</div><div class="toggle-row"><div class="toggle-label">Enable Image Descriptions</div><label class="toggle-switch"><input type="checkbox" data-setting="enableImageDescriptions"><span class="toggle-slider"></span></label></div><div id="image-model-container" style="display: none;"><div class="select-container" id="image-model-select-container"></div><div class="advanced-options" id="image-advanced-options"><div class="advanced-toggle" data-toggle="image-advanced-content"><div class="advanced-toggle-title">Options</div><div class="advanced-toggle-icon">▼</div></div><div class="advanced-content" id="image-advanced-content"><div class="parameter-row" data-param-name="imageModelTemperature"><div class="parameter-label" title="Randomness for image descriptions (0.0-1.0)">Temperature</div><div class="parameter-control"><input type="range" class="parameter-slider" min="0" max="2" step="0.1"><input type="number" class="parameter-value" min="0" max="2" step="0.1" style="width: 60px;"></div></div><div class="parameter-row" data-param-name="imageModelTopP"><div class="parameter-label" title="Nucleus sampling for image model (0.0-1.0)">Top-p</div><div class="parameter-control"><input type="range" class="parameter-slider" min="0" max="1" step="0.1"><input type="number" class="parameter-value" min="0" max="1" step="0.1" style="width: 60px;"></div></div></div></div></div></div><div id="instructions-tab" class="tab-content"><div class="section-title">Custom Instructions</div><div class="section-description">Add custom instructions for how the model should score tweets:</div><textarea id="user-instructions" placeholder="Examples:- Give high scores to tweets about technology- Penalize clickbait-style tweets- Rate educational content higher" data-setting="userDefinedInstructions" value=""></textarea><button class="settings-button" data-action="save-instructions">Save Instructions</button><div class="advanced-options" id="instructions-history"><div class="advanced-toggle" data-toggle="instructions-history-content"><div class="advanced-toggle-title">Custom Instructions History</div><div class="advanced-toggle-icon">▼</div></div><div class="advanced-content" id="instructions-history-content"><div class="instructions-list" id="instructions-list"><!-- Instructions entries will be added here dynamically --></div><button class="settings-button danger" style="margin-top: 10px;" data-action="clear-instructions-history">Clear All History</button></div></div><div class="section-title" style="margin-top: 20px;">Auto-Rate Handles as 10/10</div><div class="section-description">Add Twitter handles to automatically rate as 10/10:</div><div class="handle-input-container"><input id="handle-input" type="text" placeholder="Twitter handle (without @)"><button class="add-handle-btn" data-action="add-handle">Add</button></div><div class="handle-list" id="handle-list"></div></div></div><div id="status-indicator" class=""></div></div><div id="tweet-filter-stats-badge" class="tweet-filter-stats-badge"></div></div>`;
    // Embedded style.css
    const STYLE = `.refreshing {animation: spin 1s infinite linear;}@keyframes spin {0% {transform: rotate(0deg);}100% {transform: rotate(360deg);}}.score-highlight {display: inline-block;background-color: #1d9bf0;/* Twitter blue */color: white;padding: 3px 10px;border-radius: 9999px;margin: 8px 0;font-weight: bold;font-size: 0.9em;}.mobile-tooltip {/* Add specific mobile tooltip styles if needed */max-width: 90vw;/* Example */}.score-description.streaming-tooltip {scroll-behavior: smooth;border-left: 3px solid #1d9bf0;background-color: rgba(25, 30, 35, 0.98);}.score-description.streaming-tooltip::before {content: 'Live';position: absolute;top: 10px;right: 10px;background-color: #1d9bf0;color: white;font-size: 11px;padding: 2px 6px;border-radius: 10px;font-weight: bold;}.score-description::-webkit-scrollbar {width: 6px;}.score-description::-webkit-scrollbar-track {background: rgba(255, 255, 255, 0.05);border-radius: 3px;}.score-description::-webkit-scrollbar-thumb {background: rgba(255, 255, 255, 0.2);border-radius: 3px;}.score-description::-webkit-scrollbar-thumb:hover {background: rgba(255, 255, 255, 0.3);}.score-description.streaming-tooltip p::after {content: '|';display: inline-block;color: #1d9bf0;animation: blink 0.7s infinite;font-weight: bold;margin-left: 2px;}@keyframes blink {0%,100% {opacity: 0;}50% {opacity: 1;}}.streaming-rating {background-color: rgba(33, 150, 243, 0.9) !important;color: white !important;animation: pulse 1.5s infinite alternate;position: relative;}.streaming-rating::after {content: '';position: absolute;top: -2px;right: -2px;width: 6px;height: 6px;background-color: #1d9bf0;border-radius: 50%;animation: blink 0.7s infinite;box-shadow: 0 0 4px #1d9bf0;}.cached-rating {background-color: rgba(76, 175, 80, 0.9) !important;color: white !important;}.rated-rating {background-color: rgba(33, 33, 33, 0.9) !important;color: white !important;}.blacklisted-rating {background-color: rgba(255, 193, 7, 0.9) !important;color: black !important;}.pending-rating {background-color: rgba(255, 152, 0, 0.9) !important;color: white !important;}@keyframes pulse {0% {opacity: 0.8;}100% {opacity: 1;}}.error-rating {background-color: rgba(244, 67, 54, 0.9) !important;color: white !important;}#status-indicator {position: fixed;bottom: 20px;right: 20px;background-color: rgba(22, 24, 28, 0.95);color: #e7e9ea;padding: 10px 15px;border-radius: 8px;font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;font-size: 12px;z-index: 9999;display: none;border: 1px solid rgba(255, 255, 255, 0.1);box-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);transform: translateY(100px);transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);}#status-indicator.active {display: block;transform: translateY(0);}.toggle-switch {position: relative;display: inline-block;width: 36px;height: 20px;}.toggle-switch input {opacity: 0;width: 0;height: 0;}.toggle-slider {position: absolute;cursor: pointer;top: 0;left: 0;right: 0;bottom: 0;background-color: rgba(255, 255, 255, 0.2);transition: .3s;border-radius: 34px;}.toggle-slider:before {position: absolute;content: "";height: 16px;width: 16px;left: 2px;bottom: 2px;background-color: white;transition: .3s;border-radius: 50%;}input:checked+.toggle-slider {background-color: #1d9bf0;}input:checked+.toggle-slider:before {transform: translateX(16px);}.toggle-row {display: flex;align-items: center;justify-content: space-between;padding: 8px 10px;margin-bottom: 12px;background-color: rgba(255, 255, 255, 0.05);border-radius: 8px;transition: background-color 0.2s;}.toggle-row:hover {background-color: rgba(255, 255, 255, 0.08);}.toggle-label {font-size: 13px;color: #e7e9ea;}#tweet-filter-container {position: fixed;top: 70px;right: 15px;background-color: rgba(22, 24, 28, 0.95);color: #e7e9ea;padding: 10px 12px;border-radius: 12px;z-index: 9999;font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;font-size: 13px;box-shadow: 0 2px 12px rgba(0, 0, 0, 0.5);display: flex;align-items: center;gap: 10px;border: 1px solid rgba(255, 255, 255, 0.1);transform-origin: top right;transition: transform 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55), opacity 0.5s ease-in-out;opacity: 1;transform: scale(1) translateX(0);visibility: visible;}#tweet-filter-container.hidden {opacity: 0;transform: scale(0.8) translateX(50px);visibility: hidden;}.close-button {background: none;border: none;color: #e7e9ea;font-size: 16px;cursor: pointer;padding: 0;width: 28px;height: 28px;display: flex;align-items: center;justify-content: center;opacity: 0.8;transition: opacity 0.2s;border-radius: 50%;min-width: 28px;min-height: 28px;-webkit-tap-highlight-color: transparent;touch-action: manipulation;user-select: none;z-index: 30;}.close-button:hover {opacity: 1;background-color: rgba(255, 255, 255, 0.1);}.hidden {display: none !important;}/* Only override hidden for our specific containers */#tweet-filter-container.hidden,#settings-container.hidden {display: flex !important;}.toggle-button {position: fixed;right: 15px;background-color: rgba(22, 24, 28, 0.95);color: #e7e9ea;padding: 8px 12px;border-radius: 8px;cursor: pointer;font-size: 12px;z-index: 9999;border: 1px solid rgba(255, 255, 255, 0.1);box-shadow: 0 2px 12px rgba(0, 0, 0, 0.5);font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;display: flex;align-items: center;gap: 6px;transition: all 0.2s ease;}.toggle-button:hover {background-color: rgba(29, 155, 240, 0.2);}#filter-toggle {top: 70px;}#settings-toggle {top: 120px;}#tweet-filter-container label {margin: 0;font-weight: bold;}.tweet-filter-stats-badge {position: fixed;bottom: 50px;right: 20px;background-color: rgba(29, 155, 240, 0.9);color: white;padding: 5px 10px;border-radius: 15px;font-size: 12px;z-index: 9999;box-shadow: 0 2px 5px rgba(0,0,0,0.2);transition: opacity 0.3s;cursor: pointer;display: flex;align-items: center;}#tweet-filter-slider {cursor: pointer;width: 120px;vertical-align: middle;-webkit-appearance: none;appearance: none;height: 6px;border-radius: 3px;background: linear-gradient(to right,#FF0000 0%,#FF8800 calc(var(--slider-percent, 50%) * 0.166),#FFFF00 calc(var(--slider-percent, 50%) * 0.333),#00FF00 calc(var(--slider-percent, 50%) * 0.5),#00FFFF calc(var(--slider-percent, 50%) * 0.666),#0000FF calc(var(--slider-percent, 50%) * 0.833),#800080 var(--slider-percent, 50%),#DEE2E6 var(--slider-percent, 50%),#DEE2E6 100%);}#tweet-filter-slider::-webkit-slider-thumb {-webkit-appearance: none;appearance: none;width: 16px;height: 16px;border-radius: 50%;background: #1d9bf0;cursor: pointer;border: 2px solid white;box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);transition: transform 0.1s;}#tweet-filter-slider::-webkit-slider-thumb:hover {transform: scale(1.2);}#tweet-filter-slider::-moz-range-thumb {width: 16px;height: 16px;border-radius: 50%;background: #1d9bf0;cursor: pointer;border: 2px solid white;box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);transition: transform 0.1s;}#tweet-filter-slider::-moz-range-thumb:hover {transform: scale(1.2);}#tweet-filter-value {min-width: 20px;text-align: center;font-weight: bold;background-color: rgba(255, 255, 255, 0.1);padding: 2px 5px;border-radius: 4px;}#settings-container {position: fixed;top: 70px;right: 15px;background-color: rgba(22, 24, 28, 0.95);color: #e7e9ea;padding: 0;border-radius: 16px;z-index: 9999;font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;font-size: 13px;box-shadow: 0 2px 18px rgba(0, 0, 0, 0.6);display: flex;flex-direction: column;width: 90vw;max-width: 380px;max-height: 85vh;overflow: hidden;border: 1px solid rgba(255, 255, 255, 0.1);line-height: 1.3;transform-origin: top right;transition: transform 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55),opacity 0.5s ease-in-out;opacity: 1;transform: scale(1) translateX(0);visibility: visible;}#settings-container.hidden {opacity: 0;transform: scale(0.8) translateX(50px);visibility: hidden;}.settings-header {padding: 12px 15px;border-bottom: 1px solid rgba(255, 255, 255, 0.1);display: flex;justify-content: space-between;align-items: center;position: sticky;top: 0;background-color: rgba(22, 24, 28, 0.98);z-index: 20;border-radius: 16px 16px 0 0;}.settings-title {font-weight: bold;font-size: 16px;}.settings-content {overflow-y: auto;max-height: calc(85vh - 110px);padding: 0;}.settings-content::-webkit-scrollbar {width: 6px;}.settings-content::-webkit-scrollbar-track {background: rgba(255, 255, 255, 0.05);border-radius: 3px;}.settings-content::-webkit-scrollbar-thumb {background: rgba(255, 255, 255, 0.2);border-radius: 3px;}.settings-content::-webkit-scrollbar-thumb:hover {background: rgba(255, 255, 255, 0.3);}.tab-navigation {display: flex;border-bottom: 1px solid rgba(255, 255, 255, 0.1);position: sticky;top: 0;background-color: rgba(22, 24, 28, 0.98);z-index: 10;padding: 10px 15px;gap: 8px;}.tab-button {padding: 6px 10px;background: none;border: none;color: #e7e9ea;font-weight: bold;cursor: pointer;border-radius: 8px;transition: all 0.2s ease;font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;font-size: 13px;flex: 1;text-align: center;}.tab-button:hover {background-color: rgba(255, 255, 255, 0.1);}.tab-button.active {color: #1d9bf0;background-color: rgba(29, 155, 240, 0.1);border-bottom: 2px solid #1d9bf0;}.tab-content {display: none;animation: fadeIn 0.3s ease;padding: 15px;}@keyframes fadeIn {from {opacity: 0;}to {opacity: 1;}}.tab-content.active {display: block;}.select-container {position: relative;margin-bottom: 15px;}.select-container .search-field {position: sticky;top: 0;background-color: rgba(39, 44, 48, 0.95);padding: 8px;border-bottom: 1px solid rgba(255, 255, 255, 0.1);z-index: 1;}.select-container .search-input {width: 100%;padding: 8px 10px;border-radius: 8px;border: 1px solid rgba(255, 255, 255, 0.2);background-color: rgba(39, 44, 48, 0.9);color: #e7e9ea;font-size: 12px;transition: border-color 0.2s;}.select-container .search-input:focus {border-color: #1d9bf0;outline: none;}.custom-select {position: relative;display: inline-block;width: 100%;}.select-selected {background-color: rgba(39, 44, 48, 0.95);color: #e7e9ea;padding: 10px 12px;border: 1px solid rgba(255, 255, 255, 0.2);border-radius: 8px;cursor: pointer;user-select: none;display: flex;justify-content: space-between;align-items: center;font-size: 13px;transition: border-color 0.2s;}.select-selected:hover {border-color: rgba(255, 255, 255, 0.4);}.select-selected:after {content: "";width: 8px;height: 8px;border: 2px solid #e7e9ea;border-width: 0 2px 2px 0;display: inline-block;transform: rotate(45deg);margin-left: 10px;transition: transform 0.2s;}.select-selected.select-arrow-active:after {transform: rotate(-135deg);}.select-items {position: absolute;background-color: rgba(39, 44, 48, 0.98);top: 100%;left: 0;right: 0;z-index: 99;max-height: 300px;overflow-y: auto;border: 1px solid rgba(255, 255, 255, 0.2);border-radius: 8px;margin-top: 5px;box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);display: none;}.select-items div {color: #e7e9ea;padding: 10px 12px;cursor: pointer;user-select: none;transition: background-color 0.2s;border-bottom: 1px solid rgba(255, 255, 255, 0.05);}.select-items div:hover {background-color: rgba(29, 155, 240, 0.1);}.select-items div.same-as-selected {background-color: rgba(29, 155, 240, 0.2);}.select-items::-webkit-scrollbar {width: 6px;}.select-items::-webkit-scrollbar-track {background: rgba(255, 255, 255, 0.05);}.select-items::-webkit-scrollbar-thumb {background: rgba(255, 255, 255, 0.2);border-radius: 3px;}.select-items::-webkit-scrollbar-thumb:hover {background: rgba(255, 255, 255, 0.3);}#openrouter-api-key,#user-instructions {width: 100%;padding: 10px 12px;border-radius: 8px;border: 1px solid rgba(255, 255, 255, 0.2);margin-bottom: 12px;background-color: rgba(39, 44, 48, 0.95);color: #e7e9ea;font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;font-size: 13px;transition: border-color 0.2s;}#openrouter-api-key:focus,#user-instructions:focus {border-color: #1d9bf0;outline: none;}#user-instructions {height: 120px;resize: vertical;}.parameter-row {display: flex;align-items: center;margin-bottom: 12px;gap: 8px;padding: 6px;border-radius: 8px;transition: background-color 0.2s;}.parameter-row:hover {background-color: rgba(255, 255, 255, 0.05);}.parameter-label {flex: 1;font-size: 13px;color: #e7e9ea;}.parameter-control {flex: 1.5;display: flex;align-items: center;gap: 8px;}.parameter-value {min-width: 28px;text-align: center;background-color: rgba(255, 255, 255, 0.1);padding: 3px 5px;border-radius: 4px;font-size: 12px;}.parameter-slider {flex: 1;-webkit-appearance: none;height: 4px;border-radius: 4px;background: rgba(255, 255, 255, 0.2);outline: none;cursor: pointer;}.parameter-slider::-webkit-slider-thumb {-webkit-appearance: none;appearance: none;width: 14px;height: 14px;border-radius: 50%;background: #1d9bf0;cursor: pointer;transition: transform 0.1s;}.parameter-slider::-webkit-slider-thumb:hover {transform: scale(1.2);}.section-title {font-weight: bold;margin-top: 20px;margin-bottom: 8px;color: #e7e9ea;display: flex;align-items: center;gap: 6px;font-size: 14px;}.section-title:first-child {margin-top: 0;}.section-description {font-size: 12px;margin-bottom: 8px;opacity: 0.8;line-height: 1.4;}.section-title a {color: #1d9bf0;text-decoration: none;background-color: rgba(255, 255, 255, 0.1);padding: 3px 6px;border-radius: 6px;transition: all 0.2s ease;}.section-title a:hover {background-color: rgba(29, 155, 240, 0.2);text-decoration: underline;}.advanced-options {margin-top: 5px;margin-bottom: 15px;border: 1px solid rgba(255, 255, 255, 0.1);border-radius: 8px;padding: 12px;background-color: rgba(255, 255, 255, 0.03);overflow: hidden;}.advanced-toggle {display: flex;justify-content: space-between;align-items: center;cursor: pointer;margin-bottom: 5px;}.advanced-toggle-title {font-weight: bold;font-size: 13px;color: #e7e9ea;}.advanced-toggle-icon {transition: transform 0.3s;}.advanced-toggle-icon.expanded {transform: rotate(180deg);}.advanced-content {max-height: 0;overflow: hidden;transition: max-height 0.3s ease-in-out;}.advanced-content.expanded {max-height: none;}#instructions-history-content.expanded {max-height: none !important;}#instructions-history .instructions-list {max-height: 400px;overflow-y: auto;margin-bottom: 10px;}.handle-list {margin-top: 10px;max-height: 120px;overflow-y: auto;border: 1px solid rgba(255, 255, 255, 0.1);border-radius: 8px;padding: 5px;}.handle-item {display: flex;align-items: center;justify-content: space-between;padding: 6px 10px;border-bottom: 1px solid rgba(255, 255, 255, 0.05);border-radius: 4px;transition: background-color 0.2s;}.handle-item:hover {background-color: rgba(255, 255, 255, 0.05);}.handle-item:last-child {border-bottom: none;}.handle-text {font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;font-size: 12px;}.remove-handle {background: none;border: none;color: #ff5c5c;cursor: pointer;font-size: 14px;padding: 0 3px;opacity: 0.7;transition: opacity 0.2s;}.remove-handle:hover {opacity: 1;}.add-handle-btn {background-color: #1d9bf0;color: white;border: none;border-radius: 6px;padding: 7px 10px;cursor: pointer;font-weight: bold;font-size: 12px;margin-left: 5px;transition: background-color 0.2s;}.add-handle-btn:hover {background-color: #1a8cd8;}.settings-button {background-color: #1d9bf0;color: white;border: none;border-radius: 8px;padding: 10px 14px;cursor: pointer;font-weight: bold;transition: background-color 0.2s;font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;margin-top: 8px;width: 100%;font-size: 13px;}.settings-button:hover {background-color: #1a8cd8;}.settings-button.secondary {background-color: rgba(255, 255, 255, 0.1);}.settings-button.secondary:hover {background-color: rgba(255, 255, 255, 0.15);}.settings-button.danger {background-color: #ff5c5c;}.settings-button.danger:hover {background-color: #e53935;}.button-row {display: flex;gap: 8px;margin-top: 10px;}.button-row .settings-button {margin-top: 0;}.stats-container {background-color: rgba(255, 255, 255, 0.05);padding: 10px;border-radius: 8px;margin-bottom: 15px;}.stats-row {display: flex;justify-content: space-between;padding: 5px 0;border-bottom: 1px solid rgba(255, 255, 255, 0.1);}.stats-row:last-child {border-bottom: none;}.stats-label {font-size: 12px;opacity: 0.8;}.stats-value {font-weight: bold;}.score-indicator {position: absolute;top: 10px;right: 10.5%;background-color: rgba(22, 24, 28, 0.9);color: #e7e9ea;padding: 4px 10px;border-radius: 8px;font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;font-size: 14px;font-weight: bold;z-index: 100;cursor: pointer;border: 1px solid rgba(255, 255, 255, 0.1);min-width: 20px;text-align: center;box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);transition: transform 0.15s ease;}.score-indicator:hover {transform: scale(1.05);}.score-indicator.mobile-indicator {position: absolute !important;bottom: 3% !important;right: 10px !important;top: auto !important;}.score-description {display: none;background-color: rgba(22, 24, 28, 0.95);color: #e7e9ea;padding: 0 20px 16px 20px;border-radius: 12px;box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;font-size: 16px;line-height: 1.5;z-index: 99999999;position: absolute;width: 550px !important;max-width: 80vw !important;max-height: 60vh;overflow-y: auto;border: 1px solid rgba(255, 255, 255, 0.1);word-wrap: break-word;box-sizing: border-box !important;}.score-description.pinned {border: 2px solid #1d9bf0 !important;}.tooltip-controls {display: flex !important;justify-content: flex-end !important;margin: 0 -20px 15px -20px !important;position: sticky !important;top: 0 !important;background-color: rgba(39, 44, 48, 0.95) !important;padding: 12px 15px !important;z-index: 2 !important;border-top-left-radius: 12px !important;border-top-right-radius: 12px !important;border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;backdrop-filter: blur(5px) !important;}.tooltip-pin-button,.tooltip-copy-button {background: none !important;border: none !important;color: #8899a6 !important;cursor: pointer !important;font-size: 16px !important;padding: 4px 8px !important;margin-left: 8px !important;border-radius: 4px !important;transition: all 0.2s !important;}.tooltip-pin-button:hover,.tooltip-copy-button:hover {background-color: rgba(29, 155, 240, 0.1) !important;color: #1d9bf0 !important;}.tooltip-pin-button:active,.tooltip-copy-button:active {transform: scale(0.95) !important;}.description-text {margin: 0 0 25px 0 !important;font-size: 15px !important;line-height: 1.6 !important;max-width: 100% !important;overflow-wrap: break-word !important;padding: 5px 0 !important;}.tooltip-bottom-spacer {height: 30px !important;width: 100% !important;margin-bottom: 10px !important;}.reasoning-dropdown {margin-top: 15px !important;border-top: 1px solid rgba(255, 255, 255, 0.1) !important;padding-top: 10px !important;}.reasoning-toggle {display: flex !important;align-items: center !important;color: #1d9bf0 !important;cursor: pointer !important;font-weight: bold !important;padding: 5px !important;user-select: none !important;}.reasoning-toggle:hover {background-color: rgba(29, 155, 240, 0.1) !important;border-radius: 4px !important;}.reasoning-arrow {display: inline-block !important;margin-right: 5px !important;transition: transform 0.2s ease !important;}.reasoning-content {max-height: 0 !important;overflow: hidden !important;transition: max-height 0.3s ease-out, padding 0.3s ease-out !important;background-color: rgba(0, 0, 0, 0.15) !important;border-radius: 5px !important;margin-top: 5px !important;padding: 0 !important;}.reasoning-dropdown.expanded .reasoning-content {max-height: 350px !important;overflow-y: auto !important;padding: 10px !important;}.reasoning-dropdown.expanded .reasoning-arrow {transform: rotate(90deg) !important;}.reasoning-text {font-size: 14px !important;line-height: 1.4 !important;color: #ccc !important;margin: 0 !important;padding: 5px !important;}.scroll-to-bottom-button {position: sticky;bottom: 0;width: 100%;background-color: rgba(29, 155, 240, 0.9);color: white;text-align: center;padding: 8px 0;cursor: pointer;font-weight: bold;border-top: 1px solid rgba(255, 255, 255, 0.2);margin-top: 10px;z-index: 100;transition: background-color 0.2s;}.scroll-to-bottom-button:hover {background-color: rgba(29, 155, 240, 1);}@media (max-width: 600px) {.score-indicator {position: absolute !important;bottom: 3% !important;right: 10px !important;top: auto !important;}.score-description {position: fixed !important;width: 100% !important;max-width: 100% !important;max-height: 80vh !important;left: 0 !important;right: 0 !important;margin: 10vh auto 0 !important;padding: 12px !important;box-sizing: border-box !important;overflow-y: auto !important;overflow-x: hidden !important;-webkit-overflow-scrolling: touch !important;overscroll-behavior: contain !important;transform: translateZ(0) !important;border-radius: 16px 16px 0 0 !important;}.reasoning-dropdown.expanded .reasoning-content {max-height: 200px !important;}.close-button {width: 32px;height: 32px;min-width: 32px;min-height: 32px;font-size: 18px;padding: 8px;margin: -4px;}.settings-header .close-button {position: relative;right: 0;}}.sort-container {margin: 10px 0;display: flex;align-items: center;gap: 10px;justify-content: space-between;}.sort-container label {font-size: 14px;color: var(--text-color);white-space: nowrap;}.sort-container .controls-group {display: flex;gap: 8px;align-items: center;}.sort-container select {padding: 5px 10px;border-radius: 4px;border: 1px solid rgba(255, 255, 255, 0.2);background-color: rgba(39, 44, 48, 0.95);color: #e7e9ea;font-size: 14px;cursor: pointer;min-width: 120px;}.sort-container select:hover {border-color: #1d9bf0;}.sort-container select:focus {outline: none;border-color: #1d9bf0;box-shadow: 0 0 0 2px rgba(29, 155, 240, 0.2);}.sort-toggle {padding: 5px 10px;border-radius: 4px;border: 1px solid rgba(255, 255, 255, 0.2);background-color: rgba(39, 44, 48, 0.95);color: #e7e9ea;font-size: 14px;cursor: pointer;transition: all 0.2s ease;}.sort-toggle:hover {border-color: #1d9bf0;background-color: rgba(29, 155, 240, 0.1);}.sort-toggle.active {background-color: rgba(29, 155, 240, 0.2);border-color: #1d9bf0;}.sort-container select option {background-color: rgba(39, 44, 48, 0.95);color: #e7e9ea;}@media (min-width: 601px) {#settings-container {width: 480px;max-width: 480px;}}#handle-input {flex: 1;padding: 8px 12px;border-radius: 8px;border: 1px solid rgba(255, 255, 255, 0.2);background-color: rgba(39, 44, 48, 0.95);color: #e7e9ea;font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;font-size: 14px;transition: border-color 0.2s;min-width: 200px;}#handle-input:focus {outline: none;border-color: #1d9bf0;box-shadow: 0 0 0 2px rgba(29, 155, 240, 0.2);}#handle-input::placeholder {color: rgba(231, 233, 234, 0.5);}.handle-input-container {display: flex;gap: 8px;align-items: center;margin-bottom: 10px;padding: 5px;border-radius: 8px;background-color: rgba(255, 255, 255, 0.03);}.add-handle-btn {background-color: #1d9bf0;color: white;border: none;border-radius: 8px;padding: 8px 16px;cursor: pointer;font-weight: bold;font-size: 14px;transition: background-color 0.2s;white-space: nowrap;}.add-handle-btn:hover {background-color: #1a8cd8;}.instructions-list {margin-top: 10px;max-height: 200px;overflow-y: auto;border: 1px solid rgba(255, 255, 255, 0.1);border-radius: 8px;padding: 5px;}.instruction-item {display: flex;align-items: center;justify-content: space-between;padding: 8px 10px;border-bottom: 1px solid rgba(255, 255, 255, 0.05);border-radius: 4px;transition: background-color 0.2s;}.instruction-item:hover {background-color: rgba(255, 255, 255, 0.05);}.instruction-item:last-child {border-bottom: none;}.instruction-text {font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;font-size: 12px;flex: 1;margin-right: 10px;}.instruction-buttons {display: flex;gap: 5px;}.use-instruction {background: none;border: none;color: #1d9bf0;cursor: pointer;font-size: 12px;padding: 3px 8px;border-radius: 4px;transition: all 0.2s;}.use-instruction:hover {background-color: rgba(29, 155, 240, 0.1);}.remove-instruction {background: none;border: none;color: #ff5c5c;cursor: pointer;font-size: 14px;padding: 0 3px;opacity: 0.7;transition: opacity 0.2s;border-radius: 4px;}.remove-instruction:hover {opacity: 1;background-color: rgba(255, 92, 92, 0.1);}.tweet-filtered {display: none !important;visibility: hidden !important;opacity: 0 !important;pointer-events: none !important;/* Ensure it stays hidden even if Twitter tries to show it */position: absolute !important;z-index: -9999 !important;height: 0 !important;width: 0 !important;margin: 0 !important;padding: 0 !important;overflow: hidden !important;}.filter-controls {display: flex;align-items: center;gap: 10px;margin: 5px 0;}.filter-controls input[type="range"] {flex: 1;min-width: 100px;}.filter-controls input[type="number"] {width: 50px;padding: 2px 5px;border: 1px solid #ccc;border-radius: 4px;text-align: center;}/* Hide number input spinners */.filter-controls input[type="number"]::-webkit-inner-spin-button,.filter-controls input[type="number"]::-webkit-outer-spin-button {-webkit-appearance: none;margin: 0;}.filter-controls input[type="number"] {-moz-appearance: textfield;}.metadata-section {margin-top: 15px;border-top: 1px solid rgba(255, 255, 255, 0.1);padding: 10px 0;}.metadata-header {font-weight: bold;color: #1d9bf0;margin-bottom: 8px;font-size: 14px;}.metadata-content {display: flex;flex-direction: column;gap: 6px;}.metadata-item {font-size: 12px;color: #e7e9ea;opacity: 0.9;display: flex;justify-content: space-between;padding: 2px 0;}.metadata-item span {color: #8899a6;margin-right: 8px;}`;
    // Apply CSS
    GM_addStyle(STYLE);
    // Set menu HTML
    GM_setValue('menuHTML', MENU);
    // ----- helpers/browserStorage.js -----
//src/helpers/browserStorage.js
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
        console.error('Error reading from browser storage:', error);
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
        console.error('Error writing to browser storage:', error);
    }
}
//export { browserGet, browserSet }; 
    // ----- helpers/cache.js -----
//src/helpers/cache.js
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
// Export functions for use in other modules
//export { saveTweetRatings, cleanupInvalidCacheEntries, updateCacheStatsUI };
    // ----- backends/TweetCache.js -----
//src/backends/TweetCache.js
// Helper function for debouncing
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
    // Debounce delay in milliseconds
    static DEBOUNCE_DELAY = 1500;
    constructor() {
        this.cache = {};
        this.loadFromStorage();
        // Create a debounced version of the internal save method
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
            console.error('Error loading tweet cache:', error);
            this.cache = {};
        }
    }
    /**
     * Saves the current cache to browser storage. (Internal, synchronous implementation)
     */
    #saveToStorageInternal() {
        try {
            browserSet('tweetRatings', JSON.stringify(this.cache));
            updateCacheStatsUI(); // Update UI after saving
        } catch (error) {
            console.error("Error saving tweet cache to storage:", error);
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
     * @param {Object} rating - The rating object: {score(required), description, reasoning, timestamp, streaming, blacklisted, fromStorage, metadata}
     * @param {boolean} [saveImmediately=true] - Whether to save to storage immediately. DEPRECATED - Saving is now debounced.
     */
    set(tweetId, rating, saveImmediately = true) { // saveImmediately is now ignored
        // Standardize the rating object structure
        this.cache[tweetId] = {
            score: rating.score,
            description: rating.description || '',
            reasoning: rating.reasoning || '',
            timestamp: rating.timestamp || Date.now(),
            streaming: rating.streaming || false,
            blacklisted: rating.blacklisted || false,
            fromStorage: rating.fromStorage || false,
            metadata: rating.metadata,
        };
        if(saveImmediately) {
            this.#saveToStorageInternal();
        } else {
            this.debouncedSaveToStorage();
        }
    }
    has(tweetId) {
        return this.cache[tweetId] !== undefined;
    }
    /**
     * Removes a tweet rating from the cache.
     * @param {string} tweetId - The ID of the tweet to remove.
     * @param {boolean} [saveImmediately=true] - Whether to save to storage immediately. DEPRECATED - Saving is now debounced.
     */
    delete(tweetId, saveImmediately = true) { // saveImmediately is now ignored
        if (this.has(tweetId)) {
            delete this.cache[tweetId];
            // Use the debounced save
            this.debouncedSaveToStorage();
        }
    }
    /**
     * Clears all ratings from the cache.
     * @param {boolean} [saveImmediately=true] - Whether to save to storage immediately or debounce.
     */
    clear(saveImmediately = false) {
        this.cache = {};
        // Use the debounced save
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
    /**
     * Cleans up invalid entries in the cache.
     * @param {boolean} [saveImmediately=true] - Whether to save to storage immediately. DEPRECATED - Saving is now debounced.
     * @returns {Object} Statistics about the cleanup operation.
     */
    cleanup(saveImmediately = true) { // saveImmediately is now ignored
        const beforeCount = this.size;
        let deletedCount = 0;
        let streamingDeletedCount = 0;
        let undefinedScoreCount = 0;
        for (const tweetId in this.cache) {
            const entry = this.cache[tweetId];
            if (entry.score === undefined || entry.score === null) {
                if (entry.streaming === true) {
                    streamingDeletedCount++;
                } else {
                    undefinedScoreCount++;
                }
                delete this.cache[tweetId];
                deletedCount++;
            }
        }
        if (deletedCount > 0) {
            // Use the debounced save if changes were made
            this.debouncedSaveToStorage();
        }
        return {
            beforeCount,
            afterCount: this.size,
            deletedCount,
            streamingDeletedCount,
            undefinedScoreCount
        };
    }
}
const tweetCache = new TweetCache();
// Export for use in other modules
//export { tweetCache, TweetCache }; 
    // ----- backends/InstructionsHistory.js -----
//src/backends/InstructionsHistory.js
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
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString(36); // Convert to base36 for shorter hash
    }
    /**
     * Loads the history from browser storage
     * @private
     */
    loadFromStorage() {
        try {
            const stored = browserGet('instructionsHistory', '[]');
            this.history = JSON.parse(stored);
            // Ensure it's an array
            if (!Array.isArray(this.history)) {
                throw new Error('Stored history is not an array');
            }
            // Add hashes to existing entries if they don't have them
            this.history = this.history.map(entry => ({
                ...entry,
                hash: entry.hash || this.#hashString(entry.instructions)
            }));
        } catch (e) {
            console.error('Error loading instructions history:', e);
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
            console.error('Error saving instructions history:', e);
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
            // Check if these instructions already exist
            const existingIndex = this.history.findIndex(entry => entry.hash === hash);
            if (existingIndex !== -1) {
                // Update the existing entry's timestamp and summary
                this.history[existingIndex].timestamp = Date.now();
                this.history[existingIndex].summary = summary;
                // Move it to the top of the list
                const entry = this.history.splice(existingIndex, 1)[0];
                this.history.unshift(entry);
            } else {
                // Add new entry
                this.history.unshift({
                    instructions: instructions.trim(),
                    summary: summary.trim(),
                    timestamp: Date.now(),
                    hash
                });
                // Keep only the most recent entries
                if (this.history.length > this.maxEntries) {
                    this.history = this.history.slice(0, this.maxEntries);
                }
            }
            this.#saveToStorage();
            return true;
        } catch (e) {
            console.error('Error adding instructions to history:', e);
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
            console.error('Error removing instructions from history:', e);
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
            console.error('Error getting history entry:', e);
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
            console.error('Error clearing instructions history:', e);
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
        // Update global variable
        if (typeof USER_DEFINED_INSTRUCTIONS !== 'undefined') {
            USER_DEFINED_INSTRUCTIONS = instructions;
        }
        // Get 5-word summary for the instructions
        const summary = await getCustomInstructionsDescription(instructions);
        if (!summary.error) {
            await this.history.add(instructions, summary.content);
        }
        return { 
            success: true, 
            message: 'Scoring instructions saved! New tweets will use these instructions.',
            shouldClearCache: true
        };
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
// Create and export the singleton instance
const instructionsManager = new InstructionsManager(); 
    // ----- config.js -----
//src/config.js
const processedTweets = new Set(); // Set of tweet IDs already processed in this session
const adAuthorCache = new Set(); // Cache of handles that post ads
const PROCESSING_DELAY_MS = 150; // Delay before processing a tweet (ms)
const API_CALL_DELAY_MS = 25; // Minimum delay between API calls
let USER_DEFINED_INSTRUCTIONS = instructionsManager.getCurrentInstructions() || 'Rate the tweet on a scale from 1 to 10 based on its clarity, insight, creativity, and overall quality.';
let currentFilterThreshold = parseInt(browserGet('filterThreshold', '5')); // Filter threshold for tweet visibility
let observedTargetNode = null;
let lastAPICallTime = 0;
let pendingRequests = 0; // Global counter for pending API requests
const MAX_RETRIES = 5;
let availableModels = []; // List of models fetched from API
let listedModels = []; // Filtered list of models actually shown in UI
let selectedModel = browserGet('selectedModel', 'openai/gpt-4.1-nano');
let selectedImageModel = browserGet('selectedImageModel', 'openai/gpt-4.1-nano');
let showFreeModels = browserGet('showFreeModels', true);
let providerSort = browserGet('providerSort', ''); // Default to load-balanced
let blacklistedHandles = browserGet('blacklistedHandles', '').split('\n').filter(h => h.trim() !== '');
let storedRatings = browserGet('tweetRatings', '{}');
let threadHist = "";
// Settings variables
let enableImageDescriptions = browserGet('enableImageDescriptions', false);
let enableStreaming = browserGet('enableStreaming', true); // Enable streaming by default for better UX
// Model parameters
const SYSTEM_PROMPT=`You are a tweet filtering AI. Your task is to rate tweets on a scale of 0 to 10 based on user-defined instructions.You will be given a Tweet and user defined instructions to rate the tweet. You are to review and provide a rating for the tweet with the specified tweet ID.Ensure that you consider the user-defined instructions in your analysis and scoring.Follow the user-defined instructions exactly, and do not deviate from them. Then, on a new line, provide a score between 0 and 10.Output your analysis first. Then, on a new line, provide a score between 0 and 10. in this exact format:SCORE_X (where X is a number from 0 (lowest quality) to 10 (highest quality).)for example: SCORE_0, SCORE_1, SCORE_2, SCORE_3, etc.If one of the above is not present, the program will not be able to parse the response and will return an error.`
let modelTemperature = parseFloat(browserGet('modelTemperature', '0.5'));
let modelTopP = parseFloat(browserGet('modelTopP', '0.9'));
let imageModelTemperature = parseFloat(browserGet('imageModelTemperature', '0.5'));
let imageModelTopP = parseFloat(browserGet('imageModelTopP', '0.9'));
let maxTokens = parseInt(browserGet('maxTokens', '0')); // Maximum number of tokens for API requests, 0 means no limit
// ----- DOM Selectors (for tweet elements) -----
const TWEET_ARTICLE_SELECTOR = 'article[data-testid="tweet"]';
const QUOTE_CONTAINER_SELECTOR = 'div[role="link"][tabindex="0"]';
const USER_HANDLE_SELECTOR = 'div[data-testid="User-Name"] a[role="link"]';
const TWEET_TEXT_SELECTOR = 'div[data-testid="tweetText"]';
const MEDIA_IMG_SELECTOR = 'div[data-testid="tweetPhoto"] img, img[src*="pbs.twimg.com/media"]';
const MEDIA_VIDEO_SELECTOR = 'video[poster*="pbs.twimg.com"], video';
const PERMALINK_SELECTOR = 'a[href*="/status/"] time';
// ----- Dom Elements -----
/**
 * Helper function to check if a model supports images based on its architecture
 * @param {string} modelId - The model ID to check
 * @returns {boolean} - Whether the model supports image input
 */
function modelSupportsImages(modelId) {
    if (!availableModels || availableModels.length === 0) {
        return false; // If we don't have model info, assume it doesn't support images
    }
    const model = availableModels.find(m => m.slug === modelId);
    if (!model) {
        return false; // Model not found in available models list
    }
    // Check if model supports images based on its architecture
    return model.input_modalities &&
        model.input_modalities.includes('image');
}
    // ----- domScraper.js -----
//src/domScraper.js
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
    // Extract the main author's handle - take only the first one
    const handleElement = tweetArticle.querySelector(USER_HANDLE_SELECTOR);
    if (handleElement) {
        const href = handleElement.getAttribute('href');
        if (href && href.startsWith('/')) {
            handles.push(href.slice(1));
        }
    }
    // If we have the main author's handle, try to get the quoted author
    if (handles.length > 0) {
        const quoteContainer = tweetArticle.querySelector('div[role="link"][tabindex="0"]');
        if (quoteContainer) {
            // Look for a div with data-testid="UserAvatar-Container-username"
            const userAvatarDiv = quoteContainer.querySelector('div[data-testid^="UserAvatar-Container-"]');
            if (userAvatarDiv) {
                const testId = userAvatarDiv.getAttribute('data-testid');
                // Extract username from the data-testid attribute (part after the last dash)
                const lastDashIndex = testId.lastIndexOf('-');
                if (lastDashIndex >= 0 && lastDashIndex < testId.length - 1) {
                    const quotedHandle = testId.substring(lastDashIndex + 1);
                    if (quotedHandle && quotedHandle !== handles[0]) {
                        handles.push(quotedHandle);
                    }
                }
                // Fallback: try to extract handle from status link
                const quotedLink = quoteContainer.querySelector('a[href*="/status/"]');
                if (quotedLink) {
                    const href = quotedLink.getAttribute('href');
                    // Extract username from URL structure /username/status/id
                    const match = href.match(/^\/([^/]+)\/status\/\d+/);
                    if (match && match[1] && match[1] !== handles[0]) {
                        handles.push(match[1]);
                    }
                }
            }
        }
    }
    // Return non-empty array or [''] if no handles found
    return handles.length > 0 ? handles : [''];
}
/**
 * Extracts and returns an array of media URLs from the tweet element.
 * @param {Element} scopeElement - The tweet element.
 * @returns {string[]} An array of media URLs.
 */
async function extractMediaLinks(scopeElement) {
    if (!scopeElement) return [];
    const mediaLinks = new Set();
    // Find all images and videos in the tweet
    const imgSelector = `${MEDIA_IMG_SELECTOR}, [data-testid="tweetPhoto"] img, img[src*="pbs.twimg.com/media"]`;
    const videoSelector = `${MEDIA_VIDEO_SELECTOR}, video[poster*="pbs.twimg.com"], video`;
    const combinedSelector = `${imgSelector}, ${videoSelector}`;
    // --- Retry Logic --- 
    let mediaElements = scopeElement.querySelectorAll(combinedSelector);
    const RETRY_DELAY = 100; // ms
    let retries = 0;
    while (mediaElements.length === 0 && retries < MAX_RETRIES) {
        retries++;
        // console.log(`[extractMediaLinks] Retry ${retries}/${MAX_RETRIES} for media in:`, scopeElement); 
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        mediaElements = scopeElement.querySelectorAll(combinedSelector);
    }
    // --- End Retry Logic ---
    // If no media found after retries and this is a quoted tweet, try more aggressive selectors
    if (mediaElements.length === 0 && scopeElement.matches(QUOTE_CONTAINER_SELECTOR)) {
        mediaElements = scopeElement.querySelectorAll('img[src*="pbs.twimg.com"], video[poster*="pbs.twimg.com"]');
    }
    mediaElements.forEach(mediaEl => {
        // Get the source URL (src for images, poster for videos)
        const sourceUrl = mediaEl.tagName === 'IMG' ? mediaEl.src : mediaEl.poster;
        // Skip if not a Twitter media URL or if undefined or if it's a profile image
        if (!sourceUrl || 
           !(sourceUrl.includes('pbs.twimg.com/')) ||
           sourceUrl.includes('profile_images')) {
            return;
        }
        try {
            // Parse the URL to handle format parameters
            const url = new URL(sourceUrl);
            const name = url.searchParams.get('name'); // 'small', 'medium', 'large', etc.
            // Create the final URL with the right format and size
            let finalUrl = sourceUrl;
            // Try to get the original size by removing size indicator
            if (name && name !== 'orig') {
                // Replace format=jpg&name=x with format=jpg&name=small
                finalUrl = sourceUrl.replace(`name=${name}`, 'name=small');
            }
            mediaLinks.add(finalUrl);
        } catch (error) {
            // Fallback: just add the raw URL as is
            mediaLinks.add(sourceUrl);
        }
    });
    return Array.from(mediaLinks);
}
// ----- Rating Indicator Functions -----
/**
 * Processes a single tweet after a delay.
 * It first sets a pending indicator, then either applies a cached rating,
 * or calls the API to rate the tweet (with retry logic).
 * Finally, it applies the filtering logic.
 * @param {Element} tweetArticle - The tweet element.
 * @param {string} tweetId - The tweet ID.
 */
// Helper function to determine if a tweet is the original tweet in a conversation.
// We check if the tweet article has a following sibling with data-testid="inline_reply_offscreen".
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
        if (!element) return true;
        // Skip if the element itself is marked as filtered or ad
        if (element.dataset?.filtered === 'true' || element.dataset?.isAd === 'true') {
            return true;
        }
        // Skip if the cell is marked as filtered or ad
        const cell = element.closest('div[data-testid="cellInnerDiv"]');
        if (cell?.dataset?.filtered === 'true' || cell?.dataset?.isAd === 'true') {
            return true;
        }
        // Skip if it's an ad
        if (isAd(element)) {
            // Mark it as an ad and filter it
            if (cell) {
                cell.dataset.isAd = 'true';
                cell.classList.add('tweet-filtered');
            }
            element.dataset.isAd = 'true';
            return true;
        }
        // Skip if it's already in processedTweets and not an error
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
            // Process added nodes
            if (mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
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
            // Process removed nodes to clean up description elements
            if (mutation.removedNodes.length > 0) {
                mutation.removedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Skip cleanup for filtered tweets and ads
                        if (node.dataset?.filtered === 'true' || node.dataset?.isAd === 'true') {
                            return;
                        }
                        // Check if the removed node is a tweet article
                        if (node.matches && node.matches(TWEET_ARTICLE_SELECTOR)) {
                            const tweetId = getTweetID(node);
                            if (tweetId) {
                                ScoreIndicatorRegistry.get(tweetId)?.destroy();
                                needsCleanup = true;
                            }
                        }
                        // Check if the removed node contains tweet articles
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
    // If any tweets were added, ensure filtering is applied
    if (tweetsAdded) {
        setTimeout(() => {
            applyFilteringToAll();
        }, 100);
    }
    // If cleanup is needed, call the registry cleanup function
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
    // Look for any span that contains exactly "Ad" and nothing else
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
    return (window.innerWidth <= 600 || 
            /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
}
/**
 * Displays a temporary status message on the screen.
 * @param {string} message - The message to display.
 */
function showStatus(message) {
    const indicator = document.getElementById('status-indicator');
    if (!indicator) {
        console.error('#status-indicator element not found.');
        return;
    }
    indicator.textContent = message;
    indicator.classList.add('active');
    setTimeout(() => { indicator.classList.remove('active'); }, 3000);
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
    // Refresh the history list if save was successful
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
    listElement.innerHTML = ''; // Clear existing list
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
    text.title = entry.instructions; // Show full instructions on hover
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
        this.reasoningDropdown = null;
        this.reasoningToggle = null;
        this.reasoningArrow = null;
        this.reasoningContent = null;
        this.reasoningTextElement = null;
        this.descriptionElement = null;
        this.scrollButton = null;
        this.metadataElement = null;
        this.status = 'pending'; // Initial status
        this.score = null;
        this.description = '';
        this.reasoning = '';
        this.metadata = null; // Store generation metadata
        this.isPinned = false;
        this.isVisible = false;
        this.autoScroll = true; // Default to true for pending/streaming
        this.userInitiatedScroll = false; // Track user scroll interaction
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
        // Add metadata section before bottom spacer
        this.metadataElement = document.createElement('div');
        this.metadataElement.className = 'metadata-section';
        this.metadataElement.style.display = 'none'; // Hidden by default
        this.tooltipElement.insertBefore(this.metadataElement, bottomSpacer);
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
        if (!this.tooltipElement || !this.descriptionElement || !this.reasoningTextElement || !this.reasoningDropdown || !this.metadataElement) return;
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
        // Update metadata section if available
        if (this.metadata) {
            let metadataHtml = '<div class="metadata-header">Generation Stats:</div>';
            metadataHtml += '<div class="metadata-content">';
            // Model info
            if (this.metadata.model) {
                metadataHtml += `<div class="metadata-item"><span>Model:</span> ${this.metadata.model}</div>`;
            }
            // Token counts
            if (this.metadata.tokens_prompt || this.metadata.tokens_completion) {
                metadataHtml += `<div class="metadata-item"><span>Tokens:</span> ${this.metadata.tokens_prompt || 0} in / ${this.metadata.tokens_completion || 0} out`;
                if (this.metadata.native_tokens_reasoning) {
                    metadataHtml += ` / ${this.metadata.native_tokens_reasoning} reasoning`;
                }
                metadataHtml += '</div>';
            }
            // Media inputs
            if (this.metadata.num_media_prompt) {
                metadataHtml += `<div class="metadata-item"><span>Media Inputs:</span> ${this.metadata.num_media_prompt}</div>`;
            }
            // Latency
            if (this.metadata.latency) {
                metadataHtml += `<div class="metadata-item"><span>Latency:</span> ${(this.metadata.latency / 1000).toFixed(2)}s</div>`;
            }
            // Cost if available
            if (this.metadata.total_cost) {
                metadataHtml += `<div class="metadata-item"><span>Cost:</span> $${this.metadata.total_cost.toFixed(6)}</div>`;
            }
            metadataHtml += '</div>';
            this.metadataElement.innerHTML = metadataHtml;
            this.metadataElement.style.display = 'block';
        } else {
            this.metadataElement.style.display = 'none';
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
     * @param {object} [options.metadata] - Generation metadata.
     */
    update({ status, score = null, description = '', reasoning = '', metadata = null }) {
        // console.log(`[ScoreIndicator ${this.tweetId}] Updating state - Status: ${status}, Score: ${score}`);
        const statusChanged = this.status !== status;
        const scoreChanged = this.score !== score;
        const descriptionChanged = this.description !== description;
        const reasoningChanged = this.reasoning !== reasoning;
        const metadataChanged = JSON.stringify(this.metadata) !== JSON.stringify(metadata);
        // Only update if something actually changed
        if (!statusChanged && !scoreChanged && !descriptionChanged && !reasoningChanged && !metadataChanged) {
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
        this.metadata = metadata;
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
        if (descriptionChanged || reasoningChanged || statusChanged || metadataChanged) {
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
    description = description || "*waiting for content...*";
    // Enhanced Markdown-like formatting
    description = description
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
    return { description, reasoning: formattedReasoning };
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
    // Update button text immediately
    toggleButton.innerHTML = isCurrentlyHidden ? openText : closedText;
    if (isCurrentlyHidden) {
        // Opening
        element.style.display = 'flex';
        // Force reflow
        element.offsetHeight;
        element.classList.remove('hidden');
    } else {
        // Closing
        element.classList.add('hidden');
        // Wait for animation to complete before changing display
        setTimeout(() => {
            if (element.classList.contains('hidden')) {
                element.style.display = 'none';
            }
        }, 500); // Match the CSS transition duration
    }
    // Special case for filter slider button
    if (element.id === 'tweet-filter-container') {
        const filterToggle = document.getElementById('filter-toggle');
        if (filterToggle) {
            if (!isCurrentlyHidden) { // We're closing the filter
                setTimeout(() => {
                    filterToggle.style.display = 'block';
                }, 500); // Match the CSS transition duration
            } else {
                filterToggle.style.display = 'none';
            }
        }
    }
}
// --- Core UI Logic ---
/**
 * Injects the UI elements from the HTML resource into the page.
 */
function injectUI() {
    //combined userscript has a const named MENU. If it exists, use it.
    let menuHTML;
    if (MENU) {
        menuHTML = MENU;
    } else {
        menuHTML = browserGet('menuHTML');
    }
    if (!menuHTML) {
        console.error('Failed to load Menu.html resource!');
        showStatus('Error: Could not load UI components.');
        return null;
    }
    // Create a container to inject HTML
    const containerId = 'tweetfilter-root-container'; // Use the ID from the updated HTML
    let uiContainer = document.getElementById(containerId);
    if (uiContainer) {
        console.warn('UI container already exists. Skipping injection.');
        return uiContainer; // Return existing container
    }
    uiContainer = document.createElement('div');
    uiContainer.id = containerId;
    uiContainer.innerHTML = menuHTML;
    // Append the rest of the UI elements
    document.body.appendChild(uiContainer);
    console.log('TweetFilter UI Injected from HTML resource.');
    // Set version number
    const versionInfo = uiContainer.querySelector('#version-info');
    if (versionInfo) {
        versionInfo.textContent = `Twitter De-Sloppifier v${VERSION}`;
    }
    return uiContainer; // Return the newly created container
}
/**
 * Initializes all UI event listeners using event delegation.
 * @param {HTMLElement} uiContainer - The root container element for the UI.
 */
function initializeEventListeners(uiContainer) {
    if (!uiContainer) {
        console.error('UI Container not found for event listeners.');
        return;
    }
    console.log('Wiring UI events...');
    const settingsContainer = uiContainer.querySelector('#settings-container');
    const filterContainer = uiContainer.querySelector('#tweet-filter-container');
    const settingsToggleBtn = uiContainer.querySelector('#settings-toggle');
    const filterToggleBtn = uiContainer.querySelector('#filter-toggle');
    // --- Delegated Event Listener for Clicks ---
    uiContainer.addEventListener('click', (event) => {
        const target = event.target;
        const actionElement = target.closest('[data-action]');
        const action = actionElement?.dataset.action;
        const setting = target.dataset.setting;
        const paramName = target.closest('.parameter-row')?.dataset.paramName;
        const tab = target.dataset.tab;
        const toggleTargetId = target.closest('[data-toggle]')?.dataset.toggle;
        // Button Actions
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
            }
        }
        // Handle List Removal (delegated)
        if (target.classList.contains('remove-handle')) {
            const handleItem = target.closest('.handle-item');
            const handleTextElement = handleItem?.querySelector('.handle-text');
            if (handleTextElement) {
                const handle = handleTextElement.textContent.substring(1); // Remove '@'
                removeHandleFromBlacklist(handle);
            }
        }
        // Tab Switching
        if (tab) {
            switchTab(tab);
        }
        // Advanced Options Toggle
        if (toggleTargetId) {
            toggleAdvancedOptions(toggleTargetId);
        }
    });
    // --- Delegated Event Listener for Input/Change ---
    uiContainer.addEventListener('input', (event) => {
        const target = event.target;
        const setting = target.dataset.setting;
        const paramName = target.closest('.parameter-row')?.dataset.paramName;
        // Settings Inputs / Toggles
        if (setting) {
            handleSettingChange(target, setting);
        }
        // Parameter Controls (Sliders/Number Inputs)
        if (paramName) {
            handleParameterChange(target, paramName);
        }
        // Filter Slider
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
        // Settings Inputs / Toggles (for selects like sort order)
        if (setting === 'modelSortOrder') {
            handleSettingChange(target, setting);
            fetchAvailableModels(); // Refresh models on sort change
        }
        // Settings Checkbox toggle (need change event for checkboxes)
        if (setting === 'enableImageDescriptions') {
            handleSettingChange(target, setting);
        }
    });
    // --- Direct Event Listeners (Less common cases) ---
    // Filter Toggle Button
    if (filterToggleBtn) {
        filterToggleBtn.onclick = () => {
            if (filterContainer) {
                filterContainer.style.display = 'flex';
                // Force a reflow
                filterContainer.offsetHeight;
                filterContainer.classList.remove('hidden');
            }
            filterToggleBtn.style.display = 'none';
        };
    }
    // Close custom selects when clicking outside
    document.addEventListener('click', closeAllSelectBoxes);
    // Add handlers for new controls
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
            // Set default direction for latency and age
            if (this.value === 'latency-low-to-high') {
                browserSet('sortDirection', 'default'); // Show lowest latency first
            } else if (this.value === '') { // Age
                browserSet('sortDirection', 'default'); // Show newest first
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
    console.log('UI events wired.');
}
// --- Event Handlers ---
/** Saves the API key from the input field. */
function saveApiKey() {
    const apiKeyInput = document.getElementById('openrouter-api-key');
    const apiKey = apiKeyInput.value.trim();
    let previousAPIKey = browserGet('openrouter-api-key', '').length > 0 ? true : false;
    if (apiKey) {
        if (!previousAPIKey) {
            resetSettings(true);
            //jank hack to get the UI defaults to load correctly
        }
        browserSet('openrouter-api-key', apiKey);
        showStatus('API key saved successfully!');
        fetchAvailableModels(); // Refresh model list
        //refresh the website
        location.reload();
    } else {
        showStatus('Please enter a valid API key');
    }
}
/** Clears tweet ratings and updates the relevant UI parts. */
function clearTweetRatingsAndRefreshUI() {
    if (isMobileDevice() || confirm('Are you sure you want to clear all cached tweet ratings?')) {
        // Clear all ratings
        tweetCache.clear(true);
        // Reset pending requests counter
        pendingRequests = 0;
        // Clear thread relationships cache
        if (window.threadRelationships) {
            window.threadRelationships = {};
            browserSet('threadRelationships', '{}');
            console.log('Cleared thread relationships cache');
        }
        showStatus('All cached ratings and thread relationships cleared!');
        console.log('Cleared all tweet ratings and thread relationships');
        // Reset all tweet elements to unrated state and reprocess them
        if (observedTargetNode) {
            observedTargetNode.querySelectorAll('article[data-testid="tweet"]').forEach(tweet => {
                tweet.removeAttribute('data-sloppiness-score');
                tweet.removeAttribute('data-rating-status');
                tweet.removeAttribute('data-rating-description');
                tweet.removeAttribute('data-cached-rating');
                const indicator = tweet.querySelector('.score-indicator');
                if (indicator) {
                    indicator.remove();
                }
                // Remove from processed set and schedule reprocessing
                const tweetId = getTweetID(tweet); // Get ID *before* potential errors
                if (tweetId) { // Ensure we have an ID
                    processedTweets.delete(tweetId);
                    // Explicitly destroy the old ScoreIndicator instance from the registry
                    const indicatorInstance = ScoreIndicatorRegistry.get(tweetId);
                    if (indicatorInstance) {
                        indicatorInstance.destroy();
                    }
                    scheduleTweetProcessing(tweet); // Now schedule processing
                }
            });
        }
        // Reset thread mapping on any conversation containers
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
    // Update global variable if it exists
    if (window[settingName] !== undefined) {
        window[settingName] = value;
    }
    // Save to GM storage
    browserSet(settingName, value);
    // Special UI updates for specific settings
    if (settingName === 'enableImageDescriptions') {
        const imageModelContainer = document.getElementById('image-model-container');
        if (imageModelContainer) {
            imageModelContainer.style.display = value ? 'block' : 'none';
        }
        showStatus('Image descriptions ' + (value ? 'enabled' : 'disabled'));
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
    // Clamp value if it's from the number input
    if (target.type === 'number' && !isNaN(newValue)) {
        newValue = Math.max(min, Math.min(max, newValue));
    }
    // Update both slider and input
    if (slider && valueInput) {
        slider.value = newValue;
        valueInput.value = newValue;
    }
    // Update global variable
    if (window[paramName] !== undefined) {
        window[paramName] = newValue;
    }
    // Save to GM storage
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
    // Update the gradient position based on the slider value
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
    // Clamp value between 0 and 10
    value = Math.max(0, Math.min(10, value));
    input.value = value.toString(); // Update input to clamped value
    const slider = document.getElementById('tweet-filter-slider');
    if (slider) {
        slider.value = value.toString();
        // Update the gradient position
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
    // Adjust max-height for smooth animation
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
    // Update general settings inputs/toggles
    document.querySelectorAll('[data-setting]').forEach(input => {
        const settingName = input.dataset.setting;
        const value = browserGet(settingName, window[settingName]); // Get saved or default value
        if (input.type === 'checkbox') {
            input.checked = value;
            // Trigger change handler for side effects (like hiding/showing image model section)
            handleSettingChange(input, settingName);
        } else {
            input.value = value;
        }
    });
    // Update parameter controls (sliders/number inputs)
    document.querySelectorAll('.parameter-row[data-param-name]').forEach(row => {
        const paramName = row.dataset.paramName;
        const slider = row.querySelector('.parameter-slider');
        const valueInput = row.querySelector('.parameter-value');
        const value = browserGet(paramName, window[paramName]);
        if (slider) slider.value = value;
        if (valueInput) valueInput.value = value;
    });
    // Update filter slider and value input
    const filterSlider = document.getElementById('tweet-filter-slider');
    const filterValueInput = document.getElementById('tweet-filter-value');
    const currentThreshold = browserGet('filterThreshold', '5');
    if (filterSlider && filterValueInput) {
        filterSlider.value = currentThreshold;
        filterValueInput.value = currentThreshold;
        // Initialize the gradient position
        const percentage = (parseInt(currentThreshold, 10) / 10) * 100;
        filterSlider.style.setProperty('--slider-percent', `${percentage}%`);
    }
    // Refresh dynamically populated lists/dropdowns
    refreshHandleList(document.getElementById('handle-list'));
    refreshModelsUI(); // Refreshes model dropdowns
    // Set initial state for advanced sections (collapsed by default unless CSS specifies otherwise)
    document.querySelectorAll('.advanced-content').forEach(content => {
        if (!content.classList.contains('expanded')) {
            content.style.maxHeight = '0';
        }
    });
    document.querySelectorAll('.advanced-toggle-icon.expanded').forEach(icon => {
        // Ensure icon matches state if CSS defaults to expanded
        if (!icon.closest('.advanced-toggle')?.nextElementSibling?.classList.contains('expanded')) {
            icon.classList.remove('expanded');
        }
    });
    // Refresh instructions history
    refreshInstructionsHistory();
}
/**
 * Refreshes the handle list UI.
 * @param {HTMLElement} listElement - The list element to refresh.
 */
function refreshHandleList(listElement) {
    if (!listElement) return;
    listElement.innerHTML = ''; // Clear existing list
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
        // removeBtn listener is handled by delegation in initializeEventListeners
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
    // Filter and sort models
    listedModels = [...availableModels];
    // Filter free models if needed
    if (!showFreeModels) {
        listedModels = listedModels.filter(model => !model.slug.endsWith(':free'));
    }
    // Sort models based on current sort order and direction
    const sortDirection = browserGet('sortDirection', 'default');
    const sortOrder = browserGet('modelSortOrder', 'throughput-high-to-low');
    // Update toggle button text based on sort order
    const toggleBtn = document.getElementById('sort-direction');
    if (toggleBtn) {
        switch (sortOrder) {
            case 'latency-low-to-high':
                toggleBtn.textContent = sortDirection === 'default' ? 'High-Low' : 'Low-High';
                if (sortDirection === 'reverse') listedModels.reverse();
                break;
            case '': // Age
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
    // Update main model selector
    if (modelSelectContainer) {
        modelSelectContainer.innerHTML = '';
        createCustomSelect(
            modelSelectContainer,
            'model-selector',
            listedModels.map(model => ({ value: model.slug || model.id, label: formatModelLabel(model) })),
            selectedModel,
            (newValue) => {
                selectedModel = newValue;
                browserSet('selectedModel', selectedModel);
                showStatus('Rating model updated');
            },
            'Search rating models...'
        );
    }
    // Update image model selector
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
            visionModels.map(model => ({ value: model.slug || model.id, label: formatModelLabel(model) })),
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
    let label = model.slug || model.id || model.name || 'Unknown Model';
    let pricingInfo = '';
    // Extract pricing
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
            // Handle case where only completion price is available (less common)
            pricingInfo += ` - $${(completionPrice * 1e6).toFixed(4)}/mil. tok.-out`;
        }
    }
    // Add vision icon
    const isVision = model.input_modalities?.includes('image') ||
        model.architecture?.input_modalities?.includes('image') ||
        model.architecture?.modality?.includes('image');
    if (isVision) {
        label = '🖼️ ' + label;
    }
    return label + pricingInfo;
}
// --- Custom Select Dropdown Logic (largely unchanged, but included for completeness) ---
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
    selectItems.style.display = 'none'; // Initially hidden
    const searchField = document.createElement('div');
    searchField.className = 'search-field';
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'search-input';
    searchInput.placeholder = searchPlaceholder || 'Search...';
    searchField.appendChild(searchInput);
    selectItems.appendChild(searchField);
    // Function to render options
    function renderOptions(filter = '') {
        // Clear previous options (excluding search field)
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
                e.stopPropagation(); // Prevent closing immediately
                currentSelectedValue = option.value;
                selectSelected.textContent = option.label;
                selectItems.style.display = 'none';
                selectSelected.classList.remove('select-arrow-active');
                // Update classes for all items
                selectItems.querySelectorAll('div[data-value]').forEach(div => {
                    div.classList.toggle('same-as-selected', div.dataset.value === currentSelectedValue);
                });
                onChange(currentSelectedValue);
            });
            selectItems.appendChild(optionDiv);
        });
    }
    // Set initial display text
    const initialOption = options.find(opt => opt.value === currentSelectedValue);
    selectSelected.textContent = initialOption ? initialOption.label : 'Select an option';
    customSelect.appendChild(selectSelected);
    customSelect.appendChild(selectItems);
    container.appendChild(customSelect);
    // Initial rendering
    renderOptions();
    // Event listeners
    searchInput.addEventListener('input', () => renderOptions(searchInput.value));
    searchInput.addEventListener('click', e => e.stopPropagation()); // Prevent closing
    selectSelected.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAllSelectBoxes(customSelect); // Close others
        const isHidden = selectItems.style.display === 'none';
        selectItems.style.display = isHidden ? 'block' : 'none';
        selectSelected.classList.toggle('select-arrow-active', isHidden);
        if (isHidden) {
            searchInput.focus();
            searchInput.select(); // Select text for easy replacement
            renderOptions(); // Re-render in case options changed
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
        // Define defaults (should match config.js ideally)
        const defaults = {
            selectedModel: 'openai/gpt-4.1-nano',
            selectedImageModel: 'openai/gpt-4.1-nano',
            enableImageDescriptions: false,
            enableStreaming: true,
            modelTemperature: 0.5,
            modelTopP: 0.9,
            imageModelTemperature: 0.5,
            imageModelTopP: 0.9,
            maxTokens: 0,
            filterThreshold: 5,
            userDefinedInstructions: 'Rate the tweet on a scale from 1 to 10 based on its clarity, insight, creativity, and overall quality.',
            modelSortOrder: 'throughput-high-to-low'
        };
        // Apply defaults
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
// --- Blacklist/Whitelist Logic ---
/**
 * Adds a handle to the blacklist, saves, and refreshes the UI.
 * @param {string} handle - The Twitter handle to add (with or without @).
 */
function addHandleToBlacklist(handle) {
    handle = handle.trim().replace(/^@/, ''); // Clean handle
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
// --- Initialization ---
/**
 * Main initialization function for the UI module.
 */
function initialiseUI() {
    const uiContainer = injectUI();
    if (!uiContainer) return;
    initializeEventListeners(uiContainer);
    refreshSettingsUI();
    fetchAvailableModels();
    // Initialize the floating cache stats badge
    initializeFloatingCacheStats();
    setInterval(updateCacheStatsUI, 3000);
    // Initialize tracking object for streaming requests if it doesn't exist
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
    // Add tooltip functionality
    statsBadge.title = 'Click to open settings';
    // Add click event to open settings
    statsBadge.addEventListener('click', () => {
        const settingsToggle = document.getElementById('settings-toggle');
        if (settingsToggle) {
            settingsToggle.click();
        }
    });
    // Auto-hide after 5 seconds of inactivity
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
//src/ratingEngine.js
/**
 * Applies filtering to a single tweet by replacing its contents with a minimal placeholder.
 * Also updates the rating indicator.
 * @param {Element} tweetArticle - The tweet element.
 */
function filterSingleTweet(tweetArticle) {
    const cell = tweetArticle.closest('div[data-testid="cellInnerDiv"]');
    if (!cell) {
        console.warn("Couldn't find cellInnerDiv for tweet");
        return;
    }
    // Get the author handle
    const handles = getUserHandles(tweetArticle);
    const authorHandle = handles.length > 0 ? handles[0] : '';
    // If it's already a known ad author, hide it immediately
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
    const score = parseInt(tweetArticle.dataset.sloppinessScore || '9', 10);
    const tweetId = getTweetID(tweetArticle);
    const indicatorInstance = ScoreIndicatorRegistry.get(tweetId);
    // Ensure the indicator is attached to *this specific* article element
    indicatorInstance?.ensureIndicatorAttached();
    const currentFilterThreshold = parseInt(browserGet('filterThreshold', '1'));
    const ratingStatus = tweetArticle.dataset.ratingStatus;
    // If the tweet is still pending/streaming a rating, keep it visible
    if (ratingStatus === 'pending' || ratingStatus === 'streaming') {
        // Do nothing - let it stay visible
        delete cell.dataset.filtered;
    } else if (isNaN(score) || score < currentFilterThreshold) {
        if (tweetId) {
            ScoreIndicatorRegistry.get(tweetId)?.destroy();
        }
        cell.innerHTML = '';
        cell.dataset.filtered = 'true';
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
    const handles = getUserHandles(tweetArticle);
    const userHandle = handles.length > 0 ? handles[0] : '';
    // Blacklisted users are automatically given a score of 10
    if (userHandle && isUserBlacklisted(userHandle)) {
        tweetArticle.dataset.sloppinessScore = '10';
        tweetArticle.dataset.blacklisted = 'true';
        tweetArticle.dataset.ratingStatus = 'blacklisted';
        tweetArticle.dataset.ratingDescription = 'Whitelisted user';
        // Use the ScoreIndicator instance to update UI
        ScoreIndicatorRegistry.get(tweetId, tweetArticle)?.update({
            status: 'blacklisted',
            score: 10,
            description: "User is whitelisted",
            metadata: null // No metadata for blacklisted tweets
        });
        filterSingleTweet(tweetArticle);
        return true;
    }
    // Check cache for rating
    const cachedRating = tweetCache.get(tweetId);
    if (cachedRating) {
        // Skip incomplete streaming entries that don't have a score yet
        if (cachedRating.streaming === true &&
            (cachedRating.score === undefined || cachedRating.score === null)) {
            return false;
        }
        // Ensure the score exists before applying it
        if (cachedRating.score !== undefined && cachedRating.score !== null) {
            const score = cachedRating.score;
            const desc = cachedRating.description;
            const reasoning = cachedRating.reasoning || "";
            const metadata = cachedRating.metadata || null; // Get metadata from cache
            tweetArticle.dataset.sloppinessScore = score.toString();
            tweetArticle.dataset.cachedRating = 'true';
            if (reasoning) {
                tweetArticle.dataset.ratingReasoning = reasoning;
            }
            let status = 'rated'; // Default status
            // If it's a streaming entry that's not complete, mark as streaming instead of cached
            if (cachedRating.streaming === true && !cachedRating.score) {
                status = 'streaming';
                // No need to update indicator yet if still streaming incomplete data
                console.log(`Tweet ${tweetId} has incomplete streaming cache, skipping immediate indicator update.`);
                return false; // Don't treat as successfully applied cache yet
            } else {
                // Check if this rating is from storage (cached) or newly created
                const isFromStorage = cachedRating.fromStorage === true;
                status = isFromStorage ? 'cached' : 'rated';
            }
            // Update the indicator via the registry, including metadata
            ScoreIndicatorRegistry.get(tweetId, tweetArticle)?.update({
                status: status,
                score: score,
                description: desc,
                reasoning: reasoning,
                metadata: metadata // Pass metadata to the indicator
            });
            filterSingleTweet(tweetArticle);
            return true;
        } else if (!cachedRating.streaming) {
            // Invalid cache entry - missing score
            console.warn(`Invalid cache entry for tweet ${tweetId}: missing score`);
            tweetCache.delete(tweetId);
            return false;
        }
    }
    return false;
}
// ----- UI Helper Functions -----
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
// Add near the top with other globals
const VALID_FINAL_STATES = ['rated', 'cached', 'blacklisted'];
const VALID_INTERIM_STATES = ['pending', 'streaming'];
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
        if (!apiKey) {
            // Just set a default state and stop - no point retrying without an API key
            tweetArticle.dataset.ratingStatus = 'error';
            tweetArticle.dataset.ratingDescription = "No API key";
            ScoreIndicatorRegistry.get(tweetId, tweetArticle)?.update({
                status: 'error',
                score: 9,
                description: "No API key"
            });
            filterSingleTweet(tweetArticle);
            // Don't remove from processedTweets - we don't want to reprocess until they add a key and refresh
            return;
        }
        // Check if this is from a known ad author
        if (authorHandle && adAuthorCache.has(authorHandle)) {
            tweetArticle.dataset.ratingStatus = 'rated';
            tweetArticle.dataset.ratingDescription = "Advertisement";
            tweetArticle.dataset.sloppinessScore = '0';
            ScoreIndicatorRegistry.get(tweetId, tweetArticle)?.update({
                status: 'rated',
                score: 0,
                description: "Advertisement from known ad author"
            });
            filterSingleTweet(tweetArticle);
            processingSuccessful = true;
            return;
        }
        // Check if this is an ad
        if (isAd(tweetArticle)) {
            if (authorHandle) {
                adAuthorCache.add(authorHandle);
            }
            tweetArticle.dataset.ratingStatus = 'rated';
            tweetArticle.dataset.ratingDescription = "Advertisement";
            tweetArticle.dataset.sloppinessScore = '0';
            ScoreIndicatorRegistry.get(tweetId, tweetArticle)?.update({
                status: 'rated',
                score: 0,
                description: "Advertisement"
            });
            filterSingleTweet(tweetArticle);
            processingSuccessful = true;
            return;
        }
        let score = 5; // Default score if rating fails
        let description = "";
        let reasoning = "";
        try {
            const cachedRating = tweetCache.get(tweetId);
            if (cachedRating) {
                // Handle incomplete streaming entries specifically
                if (cachedRating.streaming === true &&
                    (cachedRating.score === undefined || cachedRating.score === null)) {
                    console.log(`Tweet ${tweetId} has incomplete streaming cache entry, continuing with processing`);
                }
                else if (!cachedRating.streaming && (cachedRating.score === undefined || cachedRating.score === null)) {
                    // Invalid cache entry (non-streaming but missing score), delete it
                    console.warn(`Invalid cache entry for tweet ${tweetId}, removing from cache`, cachedRating);
                    tweetCache.delete(tweetId);
                }
            }
            const fullContextWithImageDescription = await getFullContext(tweetArticle, tweetId, apiKey);
            if (!fullContextWithImageDescription) {
                throw new Error("Failed to get tweet context");
            }
            let mediaURLs = [];
            // Add thread relationship context only if is conversation
            if (document.querySelector('div[aria-label="Timeline: Conversation"]')) {
                const replyInfo = getTweetReplyInfo(tweetId);
                if (replyInfo && replyInfo.replyTo) {
                    // Add thread context to cache entry if we process this tweet
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
            // Get all media URLs from any section in one go
            const mediaMatches1 = fullContextWithImageDescription.matchAll(/(?:\[MEDIA_URLS\]:\s*\n)(.*?)(?:\n|$)/g);
            const mediaMatches2 = fullContextWithImageDescription.matchAll(/(?:\[QUOTED_TWEET_MEDIA_URLS\]:\s*\n)(.*?)(?:\n|$)/g);
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
            // Remove duplicates and empty URLs
            mediaURLs = [...new Set(mediaURLs.filter(url => url.trim()))];
            // --- API Call or Fallback ---
            if (fullContextWithImageDescription) {
                try {
                    // Check if there's already a complete entry in the cache before calling the API
                    // This handles cases where cache appeared/completed *after* scheduling
                    const currentCache = tweetCache.get(tweetId); // Re-fetch fresh cache state
                    const isCached = currentCache &&
                        !currentCache.streaming &&
                        currentCache.score !== undefined &&
                        currentCache.score !== null;
                    if (isCached) {
                        // Use cached data instead of calling API
                        score = currentCache.score;
                        description = currentCache.description || "";
                        reasoning = currentCache.reasoning || "";
                        processingSuccessful = true;
                        console.log(`Using valid cache entry found for ${tweetId} before API call.`);
                        // Update UI using cached data
                        ScoreIndicatorRegistry.get(tweetId, tweetArticle)?.update({
                            status: currentCache.fromStorage ? 'cached' : 'rated',
                            score: score,
                            description: description,
                            reasoning: reasoning
                        });
                        filterSingleTweet(tweetArticle);
                        return; // Exit after using cache
                    }
                    // If not cached, proceed with API call
                    const rating = await rateTweetWithOpenRouter(fullContextWithImageDescription, tweetId, apiKey, mediaURLs, 3, tweetArticle, authorHandle);
                    score = rating.score;
                    description = rating.content;
                    reasoning = rating.reasoning || ''; // Get reasoning from result
                    // Determine status based on cache/error state
                    let finalStatus = rating.error ? 'error' : 'rated';
                    if (!rating.error) {
                        const cacheEntry = tweetCache.get(tweetId);
                        if (cacheEntry && cacheEntry.fromStorage) {
                            finalStatus = 'cached';
                        } else if (rating.cached) { // Check if the API function itself marked it as cached
                            finalStatus = 'cached';
                        }
                    }
                    // Update tweet dataset (might still be useful for debugging/other features)
                    tweetArticle.dataset.ratingStatus = finalStatus;
                    tweetArticle.dataset.ratingDescription = description || "not available";
                    tweetArticle.dataset.sloppinessScore = score?.toString() || '';
                    tweetArticle.dataset.ratingReasoning = reasoning;
                    // Update UI via ScoreIndicator
                    ScoreIndicatorRegistry.get(tweetId, tweetArticle)?.update({
                        status: finalStatus,
                        score: score,
                        description: description,
                        reasoning: reasoning
                    });
                    processingSuccessful = !rating.error;
                    if (tweetCache.has(tweetId)) {
                        const entry = tweetCache.get(tweetId);
                        entry.score = score;
                        entry.description = description;
                        entry.reasoning = reasoning; // Store reasoning in cache
                        entry.tweetContent = fullContextWithImageDescription;
                        entry.streaming = false; // Mark as complete
                        if (rating.error) entry.error = true; // Mark error in cache
                    } else if (!rating.error) {
                        tweetCache.set(tweetId, {
                            score: score,
                            description: description,
                            reasoning: reasoning,
                            tweetContent: fullContextWithImageDescription,
                            streaming: false // Mark as complete
                        });
                    }
                    filterSingleTweet(tweetArticle);
                    // Return after API call attempt
                    return;
                } catch (apiError) {
                    console.error(`API error processing tweet ${tweetId}:`, apiError);
                    score = 5; // Fallback score on API error
                    description = `API Error: ${apiError.message}`;
                    reasoning = '';
                    processingSuccessful = false;
                    // Update UI to reflect API error state
                    ScoreIndicatorRegistry.get(tweetId, tweetArticle)?.update({
                        status: 'error',
                        score: score,
                        description: description
                    });
                    if (tweetCache.has(tweetId)) {
                        tweetCache.get(tweetId).streaming = false;
                    }
                    // Need to filter after error state update
                    filterSingleTweet(tweetArticle);
                    // Return after API error handling
                    return;
                }
            }
            filterSingleTweet(tweetArticle);
        } catch (error) {
            console.error(`Generic error processing tweet ${tweetId}: ${error}`, error.stack);
            // Ensure some error state is shown if processing fails unexpectedly
            const indicatorInstance = ScoreIndicatorRegistry.get(tweetId);
            if (indicatorInstance && indicatorInstance.status !== 'error') {
                indicatorInstance.update({
                    status: 'error',
                    score: 5,
                    description: "Error during processing: " + error.message
                });
            }
            filterSingleTweet(tweetArticle); // Apply filtering even on generic error
            processingSuccessful = false;
        } finally {
            // If processing was not successful, remove from processedTweets
            // to allow future retry attempts
            if (!processingSuccessful) {
                processedTweets.delete(tweetId);
            }
        }
    } catch (error) {
        console.error(`Error processing tweet ${tweetId}:`, error);
        const indicatorInstance = ScoreIndicatorRegistry.get(tweetId);
        if (indicatorInstance) {
            indicatorInstance.update({
                status: 'error',
                score: 5,
                description: "Error during processing: " + error.message
            });
        }
        filterSingleTweet(tweetArticle);
        processingSuccessful = false;
    } finally {
        // Always clean up the processed state if we didn't succeed
        if (!processingSuccessful) {
            processedTweets.delete(tweetId);
            // Check if we need to retry
            const indicatorInstance = ScoreIndicatorRegistry.get(tweetId);
            if (indicatorInstance && !isValidFinalState(indicatorInstance.status)) {
                console.log(`Tweet ${tweetId} processing failed, will retry later`);
                // Don't retry immediately to avoid spam
                setTimeout(() => {
                    if (!isValidFinalState(ScoreIndicatorRegistry.get(tweetId)?.status)) {
                        scheduleTweetProcessing(tweetArticle);
                    }
                }, PROCESSING_DELAY_MS * 2);
            }
        }
    }
}
/**
 * Schedules processing of a tweet if it hasn't been processed yet.
 * @param {Element} tweetArticle - The tweet element.
 */
function scheduleTweetProcessing(tweetArticle) {
    // First, ensure the tweet has a valid ID
    const tweetId = getTweetID(tweetArticle);
    if (!tweetId) {
        return;
    }
    // Check if there's already an active streaming request
    if (window.activeStreamingRequests && window.activeStreamingRequests[tweetId]) {
        console.log(`Tweet ${tweetId} has an active streaming request, skipping processing`);
        return;
    }
    // Get the author handle
    const handles = getUserHandles(tweetArticle);
    const authorHandle = handles.length > 0 ? handles[0] : '';
    // Check if this is from a known ad author
    if (authorHandle && adAuthorCache.has(authorHandle)) {
        filterSingleTweet(tweetArticle); // This will hide it
        return;
    }
    // Check if this is an ad
    if (isAd(tweetArticle)) {
        if (authorHandle) {
            adAuthorCache.add(authorHandle);
        }
        filterSingleTweet(tweetArticle); // This will hide it
        return;
    }
    const existingInstance = ScoreIndicatorRegistry.get(tweetId);
    if (existingInstance) {
        existingInstance.ensureIndicatorAttached();
        // If we have a valid final state, just filter and return
        if (isValidFinalState(existingInstance.status)) {
            filterSingleTweet(tweetArticle);
            return;
        }
        // If we're in a valid interim state and marked as processed, keep waiting
        if (isValidInterimState(existingInstance.status) && processedTweets.has(tweetId)) {
            filterSingleTweet(tweetArticle);
            return;
        }
        // If we get here, we either have an error state or invalid state
        // Remove from processed set to allow reprocessing
        processedTweets.delete(tweetId);
    }
    // Fast-path: if author is blacklisted, assign score immediately
    if (authorHandle && isUserBlacklisted(authorHandle)) {
        tweetArticle.dataset.sloppinessScore = '10';
        tweetArticle.dataset.blacklisted = 'true';
        tweetArticle.dataset.ratingStatus = 'blacklisted';
        tweetArticle.dataset.ratingDescription = "Whitelisted user";
        ScoreIndicatorRegistry.get(tweetId, tweetArticle)?.update({
            status: 'blacklisted',
            score: 10,
            description: "User is whitelisted"
        });
        filterSingleTweet(tweetArticle);
        return;
    }
    // Check for a cached rating, but be careful with streaming cache entries
    if (tweetCache.has(tweetId)) {
        // Only apply cached rating if it has a valid score and isn't an incomplete streaming entry
        const isIncompleteStreaming =
            tweetCache.get(tweetId).streaming === true &&
            (tweetCache.get(tweetId).score === undefined || tweetCache.get(tweetId).score === null);
        if (!isIncompleteStreaming) {
            const wasApplied = applyTweetCachedRating(tweetArticle);
            if (wasApplied) {
                return;
            }
        }
    }
    // Skip if already being processed in this session
    if (processedTweets.has(tweetId)) {
        const instance = ScoreIndicatorRegistry.get(tweetId);
        if (instance) {
            instance.ensureIndicatorAttached();
            if (instance.status === 'pending' || instance.status === 'streaming') {
                filterSingleTweet(tweetArticle);
                return;
            }
        }
        // If we get here, the tweet is marked as processed but doesn't have a valid state
        // Remove it from processed set to allow reprocessing
        processedTweets.delete(tweetId);
    }
    // Immediately mark as pending before scheduling actual processing
    const indicatorInstance = ScoreIndicatorRegistry.get(tweetId, tweetArticle);
    if (indicatorInstance) {
        if (indicatorInstance.status !== 'blacklisted' &&
            indicatorInstance.status !== 'cached' &&
            indicatorInstance.status !== 'rated') {
            indicatorInstance.update({ status: 'pending', score: null, description: 'Rating scheduled...' });
        } else {
            // If already in a final state, ensure it's attached and filtered
            indicatorInstance.ensureIndicatorAttached();
            filterSingleTweet(tweetArticle);
            return;
        }
    } else {
        console.error(`Failed to get/create indicator instance for tweet ${tweetId} during scheduling.`);
    }
    // Add to processed set *after* successfully getting/creating instance
    if (!processedTweets.has(tweetId)) {
        processedTweets.add(tweetId);
    }
    // Now schedule the actual rating processing
    setTimeout(() => {
        try {
            delayedProcessTweet(tweetArticle, tweetId, authorHandle);
        } catch (e) {
            console.error(`Error in delayed processing of tweet ${tweetId}:`, e);
            processedTweets.delete(tweetId);
        }
    }, PROCESSING_DELAY_MS);
}
// Add this near the beginning of the file with other global variables
// Store reply relationships across sessions
let threadRelationships = {};
const THREAD_CHECK_INTERVAL = 2500; // 2 seconds between thread checks
const SWEEP_INTERVAL = 1000; // 2.5 seconds between full sweeps
let threadMappingInProgress = false; // Add a memory-based flag for more reliable state tracking
// Load thread relationships from storage on script initialization
function loadThreadRelationships() {
    try {
        const savedRelationships = browserGet('threadRelationships', '{}');
        threadRelationships = JSON.parse(savedRelationships);
        console.log(`Loaded ${Object.keys(threadRelationships).length} thread relationships`);
    } catch (e) {
        console.error('Error loading thread relationships:', e);
        threadRelationships = {};
    }
}
// Save thread relationships to persistent storage
function saveThreadRelationships() {
    try {
        // Limit size to prevent storage issues
        const relationshipCount = Object.keys(threadRelationships).length;
        if (relationshipCount > 1000) {
            // If over 1000, keep only the most recent 500
            const entries = Object.entries(threadRelationships);
            // Sort by timestamp if available, otherwise keep newest entries by default key order
            entries.sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0));
            const recent = entries.slice(0, 500);
            threadRelationships = Object.fromEntries(recent);
        }
        browserSet('threadRelationships', JSON.stringify(threadRelationships));
    } catch (e) {
        console.error('Error saving thread relationships:', e);
    }
}
// Initialize thread relationships on load
loadThreadRelationships();
// Add this function to build a complete chain of replies
async function buildReplyChain(tweetId, maxDepth = 5) {
    if (!tweetId || maxDepth <= 0) return [];
    // Start with empty chain
    const chain = [];
    // Current tweet ID to process
    let currentId = tweetId;
    let depth = 0;
    // Traverse up the chain recursively
    while (currentId && depth < maxDepth) {
        const replyInfo = threadRelationships[currentId];
        if (!replyInfo || !replyInfo.replyTo) break;
        // Add this link in the chain
        chain.push({
            fromId: currentId,
            toId: replyInfo.replyTo,
            from: replyInfo.from,
            to: replyInfo.to
        });
        // Move up the chain
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
    const handles = getUserHandles(tweetArticle);
    const userHandle = handles.length > 0 ? handles[0] : '';
    const quotedHandle = handles.length > 1 ? handles[1] : '';
    // --- Extract Main Tweet Content ---
    const mainText = getElementText(tweetArticle.querySelector(TWEET_TEXT_SELECTOR));
    let allMediaLinks = await extractMediaLinks(tweetArticle);
    // --- Extract Quoted Tweet Content (if any) ---
    let quotedText = "";
    let quotedMediaLinks = [];
    let quotedTweetId = null;
    const quoteContainer = tweetArticle.querySelector(QUOTE_CONTAINER_SELECTOR);
    if (quoteContainer) {
        // Try to get the quoted tweet ID from the link
        const quotedLink = quoteContainer.querySelector('a[href*="/status/"]');
        if (quotedLink) {
            const href = quotedLink.getAttribute('href');
            const match = href.match(/\/status\/(\d+)/);
            if (match && match[1]) {
                quotedTweetId = match[1];
            }
        }
        quotedText = getElementText(quoteContainer.querySelector(TWEET_TEXT_SELECTOR)) || "";
        // No need to wait for image load just to get URLs
        // await waitForImagesToLoad(quoteContainer);
        quotedMediaLinks = await extractMediaLinks(quoteContainer);
    }
    // Get thread media URLs from cache if available
    const conversation = document.querySelector('div[aria-label="Timeline: Conversation"]') ||
        document.querySelector('div[aria-label^="Timeline: Conversation"]');
    let threadMediaUrls = [];
    if (conversation && conversation.dataset.threadMapping && tweetCache.has(tweetId) && tweetCache.get(tweetId).threadContext?.threadMediaUrls) {
        // Get thread media URLs from cache if available
        threadMediaUrls = tweetCache.get(tweetId).threadContext.threadMediaUrls || [];
    } else if (conversation && conversation.dataset.threadMediaUrls) {
        // Or get them from the dataset if available
        try {
            const allMediaUrls = JSON.parse(conversation.dataset.threadMediaUrls);
            threadMediaUrls = Array.isArray(allMediaUrls) ? allMediaUrls : [];
        } catch (e) {
            console.error("Error parsing thread media URLs:", e);
        }
    }
    let allAvailableMediaLinks = [...allMediaLinks];
    let mainMediaLinks = allAvailableMediaLinks.filter(link => !quotedMediaLinks.includes(link));
    // Start building the context
    let fullContextWithImageDescription = `[TWEET ${tweetId}]
 Author:@${userHandle}:
` + mainText;
    // Add media from the current tweet
    if (mainMediaLinks.length > 0) {
        // Process main tweet images only if image descriptions are enabled
        if (enableImageDescriptions = browserGet('enableImageDescriptions', false)) {
            let mainMediaLinksDescription = await getImageDescription(mainMediaLinks, apiKey, tweetId, userHandle);
            fullContextWithImageDescription += `
[MEDIA_DESCRIPTION]:
${mainMediaLinksDescription}`;
        }
        // Just add the URLs when descriptions are disabled
        fullContextWithImageDescription += `
[MEDIA_URLS]:
${mainMediaLinks.join(", ")}`;
    }
    // Add thread media URLs if this is a reply and we have previous media
    if (!isOriginalTweet(tweetArticle) && threadMediaUrls.length > 0) {
        // Filter out duplicates
        const uniqueThreadMediaUrls = threadMediaUrls.filter(url =>
            !mainMediaLinks.includes(url) && !quotedMediaLinks.includes(url));
        if (uniqueThreadMediaUrls.length > 0) {
            fullContextWithImageDescription += `
[THREAD_MEDIA_URLS]:
${uniqueThreadMediaUrls.join(", ")}`;
        }
    }
    // --- Quoted Tweet Handling ---
    if (quotedText || quotedMediaLinks.length > 0) {
        fullContextWithImageDescription += `
[QUOTED_TWEET${quotedTweetId ? ' ' + quotedTweetId : ''}]:
 Author:@${quotedHandle}:
${quotedText}`;
        if (quotedMediaLinks.length > 0) {
            // Process quoted tweet images only if image descriptions are enabled
            if (enableImageDescriptions) {
                let quotedMediaLinksDescription = await getImageDescription(quotedMediaLinks, apiKey, tweetId, userHandle);
                fullContextWithImageDescription += `
[QUOTED_TWEET_MEDIA_DESCRIPTION]:
${quotedMediaLinksDescription}`;
            }
            // Just add the URLs when descriptions are disabled
            fullContextWithImageDescription += `
[QUOTED_TWEET_MEDIA_URLS]:
${quotedMediaLinks.join(", ")}`;
        }
    }
    if (document.querySelector('div[aria-label="Timeline: Conversation"]', 'div[aria-label^="Timeline: Conversation"]')) {
        // --- Get complete reply chain using persistent relationships ---
        const replyChain = await buildReplyChain(tweetId);
        // --- Conversation Thread Handling ---
        let threadHistoryIncluded = false;
        if (conversation && conversation.dataset.threadHist) {
            // If this tweet is not the original tweet, prepend the thread history.
            if (!isOriginalTweet(tweetArticle)) {
                fullContextWithImageDescription = conversation.dataset.threadHist + `
[REPLY]
` + fullContextWithImageDescription;
                threadHistoryIncluded = true;
            }
        }
        // Add recursive reply chain information if available and not already included in thread history
        if (replyChain.length > 0 && !threadHistoryIncluded) {
            let replyChainText = '\n[REPLY CHAIN]\n';
            for (let i = replyChain.length - 1; i >= 0; i--) {
                const link = replyChain[i];
                replyChainText += `Tweet ${link.fromId} by @${link.from || 'unknown'} is a reply to tweet ${link.toId} by @${link.to || 'unknown'}\n`;
            }
            fullContextWithImageDescription = replyChainText + fullContextWithImageDescription;
        }
        // Individual reply marker if needed
        const replyInfo = getTweetReplyInfo(tweetId);
        if (replyInfo && replyInfo.replyTo && !threadHistoryIncluded && replyChain.length === 0) {
            fullContextWithImageDescription = `[REPLY TO TWEET ${replyInfo.replyTo}]\n` + fullContextWithImageDescription;
        }
    }
    tweetArticle.dataset.fullContext = fullContextWithImageDescription;
    return fullContextWithImageDescription;
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
    if (!observedTargetNode) return;
    const tweets = observedTargetNode.querySelectorAll(TWEET_ARTICLE_SELECTOR);
    if (tweets.length > 0) {
        console.log(`Checking ${tweets.length} tweets to ensure all are rated...`);
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
                    console.log(`Tweet ${tweetId} marked as processed but in invalid state: ${indicatorInstance?.status}`);
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
        // Find the conversation timeline using a more specific selector
        let conversation = document.querySelector('div[aria-label="Timeline: Conversation"]');
        if (!conversation) {
            conversation = document.querySelector('div[aria-label^="Timeline: Conversation"]');
        }
        if (!conversation) return;
        // More reliable state checking with both DOM and memory-based flags
        if (threadMappingInProgress || conversation.dataset.threadHist === "pending") {
            return; // Don't interrupt pending operations
        }
        // Add protection to avoid re-processing if we already mapped this thread recently
        if (conversation.dataset.threadMappedAt) {
            const lastMappedTime = parseInt(conversation.dataset.threadMappedAt, 10);
            // If we've mapped this thread in the last 10 seconds, skip
            if (Date.now() - lastMappedTime < 10000) {
                return;
            }
        }
        // Extract the root tweet ID from the URL for improved thread mapping
        const match = location.pathname.match(/status\/(\d+)/);
        const localRootTweetId = match ? match[1] : null;
        if (!localRootTweetId) return; // Only proceed if we can identify the root tweet
        // Initialize thread history
        if (conversation.dataset.threadHist === undefined) {
            // Original behavior - initialize thread history
            threadHist = "";
            const firstArticle = document.querySelector('article[data-testid="tweet"]');
            if (firstArticle) {
                conversation.dataset.threadHist = 'pending';
                threadMappingInProgress = true; // Set memory-based flag
                try {
                    const tweetId = getTweetID(firstArticle);
                    if (!tweetId) {
                        throw new Error("Failed to get tweet ID from first article");
                    }
                    // Get the full context of the root tweet
                    const apiKey = browserGet('openrouter-api-key', '');
                    const fullcxt = await getFullContext(firstArticle, tweetId, apiKey);
                    if (!fullcxt) {
                        throw new Error("Failed to get full context for root tweet");
                    }
                    threadHist = fullcxt;
                    conversation.dataset.threadHist = threadHist;
                    if (conversation.firstChild) {
                        conversation.firstChild.dataset.canary = "true";
                    }
                    // Schedule processing for the original tweet
                    if (!processedTweets.has(tweetId)) {
                        scheduleTweetProcessing(firstArticle);
                    }
                    // Use improved thread detection to map the structure
                    setTimeout(() => {
                        mapThreadStructure(conversation, localRootTweetId);
                    }, 10);
                } catch (error) {
                    console.error("Error initializing thread history:", error);
                    // Clean up on error
                    threadMappingInProgress = false;
                    delete conversation.dataset.threadHist;
                }
                return;
            }
        } else if (conversation.dataset.threadHist !== "pending" &&
            conversation.firstChild &&
            conversation.firstChild.dataset.canary === undefined) {
            // Original behavior for deep-diving into replies
            if (conversation.firstChild) {
                conversation.firstChild.dataset.canary = "pending";
            }
            threadMappingInProgress = true; // Set memory-based flag
            try {
                const nextArticle = document.querySelector('article[data-testid="tweet"]:has(~ div[data-testid="inline_reply_offscreen"])');
                if (nextArticle) {
                    const tweetId = getTweetID(nextArticle);
                    if (!tweetId) {
                        throw new Error("Failed to get tweet ID from next article");
                    }
                    if (tweetCache.has(tweetId) && tweetCache.get(tweetId).tweetContent) {
                        threadHist = threadHist + "\n[REPLY]\n" + tweetCache.get(tweetId).tweetContent;
                    } else {
                        const apiKey = browserGet('openrouter-api-key', '');
                        await new Promise(resolve => setTimeout(resolve, 10));
                        const newContext = await getFullContext(nextArticle, tweetId, apiKey);
                        if (!newContext) {
                            throw new Error("Failed to get context for next article");
                        }
                        threadHist = threadHist + "\n[REPLY]\n" + newContext;
                    }
                    conversation.dataset.threadHist = threadHist;
                }
                // Map thread structure after updating history
                setTimeout(() => {
                    mapThreadStructure(conversation, localRootTweetId);
                }, 500);
            } catch (error) {
                console.error("Error processing reply:", error);
                // Clean up on error
                threadMappingInProgress = false;
                if (conversation.firstChild) {
                    delete conversation.firstChild.dataset.canary;
                }
            }
        } else if (!threadMappingInProgress && !conversation.dataset.threadMappingInProgress) {
            // Run thread mapping periodically to catch new tweets loaded during scrolling
            threadMappingInProgress = true; // Set memory-based flag
            setTimeout(() => {
                mapThreadStructure(conversation, localRootTweetId);
            }, 250);
        }
    } catch (error) {
        console.error("Error in handleThreads:", error);
        // Clean up all state on error
        threadMappingInProgress = false;
    }
}
// Enhance the thread mapping to associate usernames with tweet IDs
async function mapThreadStructure(conversation, localRootTweetId) {
    // Mark mapping in progress to prevent duplicate processing
    conversation.dataset.threadMappingInProgress = "true";
    conversation.dataset.threadMappedAt = Date.now().toString();
    threadMappingInProgress = true; // Set memory-based flag
    try {
        // Use a timeout promise to prevent hanging
        const timeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Thread mapping timed out')), 5000)
        );
        // The actual mapping function
        const mapping = async () => {
            // Process all visible tweets using the cellInnerDiv structure for improved mapping
            let cellDivs = Array.from(document.querySelectorAll('div[data-testid="cellInnerDiv"]'));
            if (!cellDivs.length) {
                console.log("No cell divs found, thread mapping aborted");
                delete conversation.dataset.threadMappingInProgress;
                threadMappingInProgress = false;
                return;
            }
            let tweetCells = [];
            let processedCount = 0;
            // First pass: collect all tweet data
            for (let idx = 0; idx < cellDivs.length; idx++) {
                const cell = cellDivs[idx];
                const article = cell.querySelector('article[data-testid="tweet"]');
                if (!article) continue;
                // Extract tweet metadata with proper error handling
                try {
                    let tweetId = getTweetID(article);
                    if (!tweetId) {
                        let tweetLink = article.querySelector('a[href*="/status/"]');
                        if (tweetLink) {
                            let match = tweetLink.href.match(/status\/(\d+)/);
                            if (match) tweetId = match[1];
                        }
                    }
                    // Skip if we still can't get a tweet ID
                    if (!tweetId) continue;
                    // Extract username using existing functions if available
                    const handles = getUserHandles(article);
                    let username = handles.length > 0 ? handles[0] : null;
                    // Skip if we can't get a username
                    if (!username) continue;
                    // Extract tweet text
                    let tweetTextSpan = article.querySelector('[data-testid="tweetText"]');
                    let text = tweetTextSpan ? tweetTextSpan.innerText.trim().replace(/\n+/g, ' ⏎ ') : '';
                    // Extract media links from this tweet
                    let mediaLinks = await extractMediaLinks(article);
                    // Extract quoted tweet media if any
                    let quotedMediaLinks = [];
                    const quoteContainer = article.querySelector(QUOTE_CONTAINER_SELECTOR);
                    if (quoteContainer) {
                        quotedMediaLinks = await extractMediaLinks(quoteContainer);
                    }
                    // Detect reply structure based on DOM
                    let prevCell = cellDivs[idx - 1] || null;
                    let isReplyToRoot = false;
                    if (prevCell && prevCell.childElementCount === 1) {
                        let onlyChild = prevCell.children[0];
                        if (onlyChild && onlyChild.children.length === 0 && onlyChild.innerHTML.trim() === '') {
                            isReplyToRoot = true;
                        }
                    }
                    tweetCells.push({
                        tweetNode: article,
                        username,
                        tweetId,
                        text,
                        mediaLinks,
                        quotedMediaLinks,
                        cellIndex: idx,
                        isReplyToRoot,
                        cellDiv: cell,
                        index: processedCount++
                    });
                    // Schedule processing for this tweet if not already processed
                    if (!processedTweets.has(tweetId)) {
                        scheduleTweetProcessing(article);
                    }
                } catch (err) {
                    console.error("Error processing tweet in mapThreadStructure:", err);
                    // Continue with next tweet
                    continue;
                }
            }
            // Build reply structure only if we have tweets to process
            if (tweetCells.length === 0) {
                console.log("No valid tweets found, thread mapping aborted");
                delete conversation.dataset.threadMappingInProgress;
                threadMappingInProgress = false;
                return;
            }
            // Second pass: build the reply structure with the right relationship chain
            for (let i = 0; i < tweetCells.length; ++i) {
                let tw = tweetCells[i];
                if (tw.tweetId === localRootTweetId) {
                    tw.replyTo = null;
                    tw.isRoot = true;
                } else if (tw.isReplyToRoot) {
                    let root = tweetCells.find(tk => tk.tweetId === localRootTweetId);
                    tw.replyTo = root ? root.username : null;
                    tw.replyToId = root ? root.tweetId : null;
                    tw.isRoot = false;
                } else if (i > 0) {
                    tw.replyTo = tweetCells[i - 1].username;
                    tw.replyToId = tweetCells[i - 1].tweetId;
                    tw.isRoot = false;
                }
            }
            // Create thread mapping with media URLs for context generation
            const replyDocs = tweetCells.map(tw => ({
                from: tw.username,
                tweetId: tw.tweetId,
                to: tw.replyTo,
                toId: tw.replyToId,
                isRoot: tw.isRoot === true,
                text: tw.text,
                mediaLinks: tw.mediaLinks || [],
                quotedMediaLinks: tw.quotedMediaLinks || []
            }));
            // Third pass: enhance with additional relationship information
            // If a tweet is a reply to another tweet not in this view, check 
            // our persistent relationships to add that info
            for (let tw of tweetCells) {
                if (!tw.replyToId && !tw.isRoot && threadRelationships[tw.tweetId]?.replyTo) {
                    // Found a reply relationship from persistent storage that isn't captured in this view
                    tw.replyToId = threadRelationships[tw.tweetId].replyTo;
                    tw.replyTo = threadRelationships[tw.tweetId].to;
                    // Update the corresponding replyDoc
                    const doc = replyDocs.find(d => d.tweetId === tw.tweetId);
                    if (doc) {
                        doc.toId = tw.replyToId;
                        doc.to = tw.replyTo;
                    }
                }
            }
            // Store the thread mapping in a dataset attribute for debugging
            conversation.dataset.threadMapping = JSON.stringify(replyDocs);
            // Update the global thread relationships
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
            // Save relationships to persistent storage
            saveThreadRelationships();
            // Build thread history with full context including media links
            let completeThreadHistory = "";
            // Start with the root post
            const rootTweet = replyDocs.find(t => t.isRoot === true);
            if (rootTweet && rootTweet.tweetId) {
                const rootTweetElement = tweetCells.find(t => t.tweetId === rootTweet.tweetId)?.tweetNode;
                if (rootTweetElement) {
                    try {
                        const apiKey = browserGet('openrouter-api-key', '');
                        const rootContext = await getFullContext(rootTweetElement, rootTweet.tweetId, apiKey);
                        if (rootContext) {
                            completeThreadHistory = rootContext;
                            // Store the thread history in dataset for getFullContext to use
                            conversation.dataset.threadHist = completeThreadHistory;
                            // Also store the comprehensive media URLs from the entire thread
                            const allMediaUrls = [];
                            replyDocs.forEach(doc => {
                                if (doc.mediaLinks && doc.mediaLinks.length) {
                                    allMediaUrls.push(...doc.mediaLinks);
                                }
                                if (doc.quotedMediaLinks && doc.quotedMediaLinks.length) {
                                    allMediaUrls.push(...doc.quotedMediaLinks);
                                }
                            });
                            if (allMediaUrls.length > 0) {
                                conversation.dataset.threadMediaUrls = JSON.stringify(allMediaUrls);
                            }
                        }
                    } catch (error) {
                        console.error("Error getting root context:", error);
                        // Continue processing even if full context fails
                    }
                }
            }
            // Fourth pass: Update the cache with thread context
            // but with a limit on how many we process at once
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
                        // If this was just mapped, force reprocessing to use improved context
                        if (doc.tweetId && processedTweets.has(doc.tweetId)) {
                            // Find the corresponding tweet article from our collected tweet cells
                            const tweetCell = tweetCells.find(tc => tc.tweetId === doc.tweetId);
                            if (tweetCell && tweetCell.tweetNode) {
                                // Don't reprocess if the tweet is currently streaming
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
                // Yield to main thread every batch to avoid locking UI
                if (i + batchSize < replyDocs.length) {
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
            }
            // Mark mapping as complete
            delete conversation.dataset.threadMappingInProgress;
            threadMappingInProgress = false;
        };
        // Helper function to get all media URLs from tweets that came before the current one in the thread
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
        // Race the mapping against the timeout
        await Promise.race([mapping(), timeout]);
    } catch (error) {
        console.error("Error in mapThreadStructure:", error);
        // Clear the mapped timestamp and in-progress flag so we can try again later
        delete conversation.dataset.threadMappedAt;
        delete conversation.dataset.threadMappingInProgress;
        threadMappingInProgress = false;
    }
}
// For use in getFullContext to check if a tweet is a reply using persistent relationships
function getTweetReplyInfo(tweetId) {
    if (threadRelationships[tweetId]) {
        return threadRelationships[tweetId];
    }
    return null;
}
// Add the setInterval call at the end of the file or in an init function
setInterval(handleThreads, THREAD_CHECK_INTERVAL);
setInterval(ensureAllTweetsRated, SWEEP_INTERVAL);
setInterval(applyFilteringToAll, SWEEP_INTERVAL);
    // ----- api/api_requests.js -----
// src/api_requests.js
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
    // Add stream parameter to request
    const streamingRequest = {
        ...request,
        stream: true
    };
    let fullResponse = "";
    let content = "";
    let reasoning = ""; // Add a variable to track reasoning content
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
            // Get the ReadableStream from the response
            const reader = response.response.getReader();
            // Setup timeout to prevent hanging indefinitely
            const resetStreamTimeout = () => {
                if (streamTimeout) clearTimeout(streamTimeout);
                streamTimeout = setTimeout(() => {
                    console.log("Stream timed out after inactivity");
                    if (!streamComplete) {
                        streamComplete = true;
                        // Call onComplete with whatever we have so far
                        onComplete({
                            content: content,
                            reasoning: reasoning,
                            fullResponse: fullResponse,
                            data: responseObj,
                            timedOut: true
                        });
                    }
                }, 30000); // 10 second timeout without activity
            };
            let streamTimeout = null;
            // Process the stream
            const processStream = async () => {
                try {
                    resetStreamTimeout()
                    let isDone = false;
                    let emptyChunksCount = 0;
                    while (!isDone && !streamComplete) {
                        const { done, value } = await reader.read();
                        if (done) {
                            isDone = true;
                            break;
                        }
                        // Convert the chunk to text
                        const chunk = new TextDecoder().decode(value);
                        clearTimeout(streamTimeout);
                        // Reset timeout on activity
                        resetStreamTimeout();
                        // Check for empty chunks - may indicate end of stream
                        if (chunk.trim() === '') {
                            emptyChunksCount++;
                            // After receiving 3 consecutive empty chunks, consider the stream done
                            if (emptyChunksCount >= 3) {
                                isDone = true;
                                break;
                            }
                            continue;
                        }
                        emptyChunksCount = 0; // Reset the counter if we got content
                        fullResponse += chunk;
                        // Split by lines - server-sent events format
                        const lines = chunk.split("\n");
                        for (const line of lines) {
                            if (line.startsWith("data: ")) {
                                const data = line.substring(6);
                                // Check for the end of the stream
                                if (data === "[DONE]") {
                                    isDone = true;
                                    break;
                                }
                                try {
                                    const parsed = JSON.parse(data);
                                    responseObj = parsed;
                                    // Extract the content and reasoning
                                    if (parsed.choices && parsed.choices[0]) {
                                        // Check for delta content
                                        if (parsed.choices[0].delta && parsed.choices[0].delta.content !== undefined) {
                                            const delta = parsed.choices[0].delta.content || "";
                                            content += delta;
                                        }
                                        // Check for reasoning in delta
                                        if (parsed.choices[0].delta && parsed.choices[0].delta.reasoning !== undefined) {
                                            const reasoningDelta = parsed.choices[0].delta.reasoning || "";
                                            reasoning += reasoningDelta;
                                        }
                                        // Call the chunk callback
                                        onChunk({
                                            chunk: parsed.choices[0].delta?.content || "",
                                            reasoningChunk: parsed.choices[0].delta?.reasoning || "",
                                            content: content,
                                            reasoning: reasoning,
                                            data: parsed
                                        });
                                    }
                                } catch (e) {
                                    console.error("Error parsing SSE data:", e, data);
                                }
                            }
                        }
                    }
                    // When done, call the complete callback if not already completed
                    if (!streamComplete) {
                        streamComplete = true;
                        if (streamTimeout) clearTimeout(streamTimeout);
                        // Remove from active requests tracking
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
                    console.error("Stream processing error:", error);
                    // Make sure we clean up and call onError
                    if (streamTimeout) clearTimeout(streamTimeout);
                    if (!streamComplete) {
                        streamComplete = true;
                        // Remove from active requests tracking
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
                console.error("Unhandled stream error:", error);
                if (streamTimeout) clearTimeout(streamTimeout);
                if (!streamComplete) {
                    streamComplete = true;
                    // Remove from active requests tracking
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
            // Remove from active requests tracking
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
            // Remove from active requests tracking
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
    // Create an object with an abort method that can be called to cancel the request
    const streamingRequestObj = {
        abort: function() {
            streamComplete = true; // Set flag to prevent further processing
            pendingRequests--;
            try {
                reqObj.abort(); // Attempt to abort the XHR request
            } catch (e) {
                console.error("Error aborting request:", e);
            }
            // Remove from active requests tracking
            if (tweetId && window.activeStreamingRequests) {
                delete window.activeStreamingRequests[tweetId];
            }
            // Remove incomplete entry from cache
            if (tweetId && tweetCache.has(tweetId)) {
                const entry = tweetCache.get(tweetId);
                // Only delete if it's a streaming entry without a score
                if (entry.streaming && (entry.score === undefined || entry.score === null)) {
                    tweetCache.delete(tweetId);
                }
            }
        }
    };
    // Track this request if we have a tweet ID
    if (tweetId && window.activeStreamingRequests) {
        window.activeStreamingRequests[tweetId] = streamingRequestObj;
    }
    return streamingRequestObj;
}
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
                    //filter all models that don't have key "endpoint" or endpoint is null
                    let filteredModels = data.data.models.filter(model => model.endpoint && model.endpoint !== null);
                    // Reverse initial order for latency sorting to match High-Low expectations
                    if (sortOrder === 'latency-low-to-high'|| sortOrder === 'pricing-low-to-high') {
                        filteredModels.reverse();
                    }
                    availableModels = filteredModels || [];
                    listedModels = [...availableModels]; // Initialize listedModels
                    refreshModelsUI();
                    showStatus('Models updated!');
                }
            } catch (error) {
                console.error('Error parsing model list:', error);
                showStatus('Error parsing models list');
            }
        },
        onerror: function (error) {
            console.error('Error fetching models:', error);
            showStatus('Error fetching models!');
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
    if (!urls?.length || !enableImageDescriptions) {
        return !enableImageDescriptions ? '[Image descriptions disabled]' : '';
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
                        text: "Describe what you see in this image in a concise way, focusing on the main elements and any text visible. Keep the description under 100 words."
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
// Export the functions
// export {
//     getCompletion,
//     getCompletionStreaming,
//     fetchAvailableModels,
//     getImageDescription
// }; 
    // ----- api/api.js -----
// src/api.js
//import { getCompletion, getCompletionStreaming, fetchAvailableModels, getImageDescription } from './api_requests.js';
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
 * Rates a tweet using the OpenRouter API with automatic retry functionality.
 * 
 * @param {string} tweetText - The text content of the tweet
 * @param {string} tweetId - The unique tweet ID
 * @param {string} apiKey - The API key for authentication
 * @param {string[]} mediaUrls - Array of media URLs associated with the tweet
 * @param {number} [maxRetries=3] - Maximum number of retry attempts
 * @param {Element} [tweetArticle=null] - Optional: The tweet article DOM element (for streaming updates)
 * @returns {Promise<{score: number, content: string, error: boolean, cached?: boolean, data?: any}>} The rating result
 */
async function rateTweetWithOpenRouter(tweetText, tweetId, apiKey, mediaUrls, maxRetries = 3, tweetArticle = null, authorHandle="") {
    // Add a cleanup function to ensure pendingRequests is always decremented
    const cleanupRequest = () => {
        pendingRequests = Math.max(0, pendingRequests - 1); // Ensure it never goes below 0
        showStatus(`Rating tweet... (${pendingRequests} pending)`);
    };
    if (adAuthorCache.has(authorHandle)) {
        return {
            score: 0,
            content: "This tweet is from an ad author.",
            reasoning: "",
            error: false,
            cached: false,
        };
    }
    console.log(`Given Tweet Text: 
        ${tweetText}
        And Media URLS:`);
    console.log(mediaUrls);
    // Get current instructions from the manager
    const currentInstructions = instructionsManager.getCurrentInstructions();
    // Create the request body
    const request = {
        model: selectedModel,
        messages: [{
            role: "system",
            content: [{
                type: "text",
                text: `
                ${SYSTEM_PROMPT}`
            },]
        },
        {
            role: "user",
            content: [{
                type: "text",
                text:
                    `provide your reasoning, and a rating according to the the following instructions for the tweet with tweet ID ${tweetId}.
        ${currentInstructions}
                _______BEGIN TWEET_______
                ${tweetText}
                _______END TWEET_______
                Make sure your response ends with SCORE_0, SCORE_1, SCORE_2, SCORE_3, SCORE_4, SCORE_5, SCORE_6, SCORE_7, SCORE_8, SCORE_9, or SCORE_10.`
            }]
        }]
    };
    if (selectedModel.includes('gemini')) {
        request.config = {
            safetySettings: safetySettings,
        };
    }
    // Add image URLs if present and supported
    if (mediaUrls?.length > 0 && modelSupportsImages(selectedModel)) {
        for (const url of mediaUrls) {
            request.messages[1].content.push({
                type: "image_url",
                image_url: { url }
            });
        }
    }
    // Add model parameters
    request.temperature = modelTemperature;
    request.top_p = modelTopP;
    request.max_tokens = maxTokens;
    // Add provider settings only if a specific sort is selected
    if (providerSort) {
        request.provider = {
            sort: providerSort,
            allow_fallbacks: true
        };
    }
    // Check if streaming is enabled
    const useStreaming = browserGet('enableStreaming', false);
    // Store the streaming entry in cache
    tweetCache.set(tweetId, {
        streaming: true,
        timestamp: Date.now()
    });
    // Implement retry logic
    let attempt = 0;
    while (attempt < maxRetries) {
        attempt++;
        // Rate limiting
        const now = Date.now();
        const timeElapsed = now - lastAPICallTime;
        if (timeElapsed < API_CALL_DELAY_MS) {
            await new Promise(resolve => setTimeout(resolve, API_CALL_DELAY_MS - timeElapsed));
        }
        lastAPICallTime = now;
        // Update status
        pendingRequests++;
        showStatus(`Rating tweet... (${pendingRequests} pending)`);
        try {
            let result;
            // Call appropriate rating function based on streaming setting
            if (useStreaming) {
                result = await rateTweetStreaming(request, apiKey, tweetId, tweetText, tweetArticle);
            } else {
                result = await rateTweet(request, apiKey);
            }
            cleanupRequest(); // Use cleanup function instead of direct decrement
            // Parse the result for score
            if (!result.error && result.content) {
                const scoreMatches = result.content.match(/SCORE_(\d+)/g);
                if (scoreMatches && scoreMatches.length > 0) {
                    const lastScore = scoreMatches[scoreMatches.length - 1];
                    const score = parseInt(lastScore.match(/SCORE_(\d+)/)[1], 10);
                    // Store the rating in cache
                    tweetCache.set(tweetId, {
                        score: score,
                        description: result.content,
                        tweetContent: tweetText,
                        streaming: false
                    });
                    return {
                        score,
                        content: result.content,
                        reasoning: result.reasoning,
                        error: false,
                        cached: false,
                        data: result.data
                    };
                }
            }
            // If we get here, we couldn't find a score in the response
            if (attempt < maxRetries) {
                const backoffDelay = Math.pow(attempt, 2) * 1000;
                await new Promise(resolve => setTimeout(resolve, backoffDelay));
            }
        } catch (error) {
            cleanupRequest(); // Use cleanup function instead of direct decrement
            console.error(`API error during attempt ${attempt}:`, error);
            if (attempt < maxRetries) {
                const backoffDelay = Math.pow(attempt, 2) * 1000;
                await new Promise(resolve => setTimeout(resolve, backoffDelay));
            }
        }
    }
    // If we get here, all retries failed
    cleanupRequest(); // Ensure we cleanup even if all retries fail
    return {
        score: 5,
        content: "Failed to get valid rating after multiple attempts",
        reasoning: "",
        error: true,
        data: null
    };
}
/**
 * Summarizes the custom instructions for the user
 * 
 * @param {Object} request - The formatted request body
 * @param {string} apiKey - API key for authentication
 * @returns {Promise<{content: string, reasoning: string, error: boolean, data: any}>} The rating result
 */
async function getCustomInstructionsDescription(instructions) {
    const request={
        model: selectedModel,
        messages: [{
            role: "system",
            content: [{
                type: "text",
                text: `
                Please come up with a 5-word summary of the following instructions:
                ${instructions}
                `
            }]
        },
    {
        role: "user",
        content: [{
            type: "text",
            text: `Please come up with a 5-word summary of the following instructions:
            ${instructions}
            `
        }]
    }]
}
    let key = browserGet('openrouter-api-key');
    const result = await getCompletion(request,key);
    if (!result.error && result.data?.choices?.[0]?.message) {
        const content = result.data.choices[0].message.content || "";
        return {
            content,
            error: false,
        };
    }
    return {
        error: true,
        content: result.error || "Unknown error"
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
    const tweetId = request.messages[1].content.find(c => typeof c.text === 'string' && c.text.includes('tweet ID'))?.text.match(/tweet ID (\S+)/)?.[1];
    const existingScore = tweetCache.get(tweetId)?.score;
    const result = await getCompletion(request, apiKey);
    if (!result.error && result.data?.choices?.[0]?.message) {
        const content = result.data.choices[0].message.content || "";
        const reasoning = result.data.choices[0].message.reasoning || "";
        let metadata = null;
        if (result.data?.id && tweetId) {
            metadata = await fetchGenerationMetadata(result.data.id, apiKey, tweetId);
        }
        const scoreMatches = content.match(/SCORE_(\d+)/g);
        const score = existingScore || (scoreMatches && scoreMatches.length > 0 
            ? parseInt(scoreMatches[scoreMatches.length - 1].match(/SCORE_(\d+)/)[1], 10) 
            : null);
        if(metadata){
        tweetCache.set(tweetId, {
            score: score,
            description: content,
            tweetContent: request.messages.find(m => m.role === 'user')?.content[0].text,
            streaming: false,
            metadata: metadata
        });
    }else{
        tweetCache.set(tweetId, {
            score: score,
            description: content,
            tweetContent: request.messages.find(m => m.role === 'user')?.content[0].text,
            streaming: false
        });
    }
        return {
            content,
            reasoning,
            error: false,
            data: result.data,
            metadata: metadata
        };
    }
    return {
        error: true,
        content: result.error || "Unknown error",
        reasoning: "",
        data: null,
        metadata: null
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
 * @returns {Promise<{content: string, error: boolean, data: any}>} The rating result
 */
async function rateTweetStreaming(request, apiKey, tweetId, tweetText, tweetArticle) {
    // Check if there's already an active streaming request for this tweet
    if (window.activeStreamingRequests && window.activeStreamingRequests[tweetId]) {
        console.log(`Aborting existing streaming request for tweet ${tweetId}`);
        window.activeStreamingRequests[tweetId].abort();
        delete window.activeStreamingRequests[tweetId];
    }
    // Store initial streaming entry only if not already cached with a score
    const existingCache = tweetCache.get(tweetId);
    if (!existingCache || existingCache.score === undefined || existingCache.score === null) {
        tweetCache.set(tweetId, {
            streaming: true,
            timestamp: Date.now(),
            tweetContent: tweetText,
            description: "",
            reasoning: "",
            score: null
        });
    }
    return new Promise((resolve, reject) => {
        let aggregatedContent = '';
        let aggregatedReasoning = '';
        let score = null;
        let finalData = null;
        let generationId = null;
        // Get or create the indicator instance *once*
        const indicatorInstance = ScoreIndicatorRegistry.get(tweetId, tweetArticle);
        if (!indicatorInstance) {
            reject(new Error("Failed to get/create score indicator instance"));
            return;
        }
        getCompletionStreaming(
            request,
            apiKey,
            // onChunk callback
            async (chunk) => {
                aggregatedContent = chunk.content || aggregatedContent;
                aggregatedReasoning = chunk.reasoning || aggregatedReasoning;
                if (chunk.data?.id && !generationId) {
                    generationId = chunk.data.id;
                }
                // Look for a score in the accumulated content so far
                const scoreMatches = aggregatedContent.match(/SCORE_(\d+)/g); // Use global flag to get all matches
                // Always use the last score found in the stream
                if (scoreMatches && scoreMatches.length > 0) {
                    const lastScore = scoreMatches[scoreMatches.length - 1];
                    score = parseInt(lastScore.match(/SCORE_(\d+)/)[1], 10);
                }
                // Update the instance
                 indicatorInstance.update({
                    status: 'streaming',
                    score: score,
                    description: aggregatedContent || "Rating in progress...",
                    reasoning: aggregatedReasoning
                });
                // Update cache with partial data during streaming
                if (tweetCache.has(tweetId)) {
                    const entry = tweetCache.get(tweetId);
                    entry.description = aggregatedContent;
                    entry.reasoning = aggregatedReasoning;
                    entry.score = score;
                    entry.streaming = true; // Still streaming
                }
            },
            // onComplete callback
            async (finalResult) => {
                aggregatedContent = finalResult.content || aggregatedContent;
                aggregatedReasoning = finalResult.reasoning || aggregatedReasoning;
                finalData = finalResult.data;
                if (!generationId && finalResult.data?.id) {
                    generationId = finalResult.data.id;
                }
                let metadata = null;
                if (generationId) {
                    metadata = await fetchGenerationMetadata(generationId, apiKey, tweetId);
                }
                // Final check for score
                const scoreMatches = aggregatedContent.match(/SCORE_(\d+)/g);
                if (scoreMatches && scoreMatches.length > 0) {
                    const lastScore = scoreMatches[scoreMatches.length - 1];
                    score = parseInt(lastScore.match(/SCORE_(\d+)/)[1], 10);
                }
                let finalStatus = 'rated';
                // If no score was found anywhere, mark as error
                if (score === null || score === undefined) {
                    console.warn(`[API Stream] No score found in final content for tweet ${tweetId}. Content: ${aggregatedContent.substring(0, 100)}...`);
                    finalStatus = 'error';
                    score = 5; // Assign default error score
                    aggregatedContent += "\n[No score detected - Error]";
                }
                // Final cache update (ensure metadata is included)
                if(metadata){
                tweetCache.set(tweetId, {
                    tweetContent: tweetText,
                    score: score,
                    description: aggregatedContent,
                    reasoning: aggregatedReasoning,
                    metadata: metadata,
                    streaming: false,
                    timestamp: Date.now(),
                    error: finalStatus === 'error' ? "No score detected" : undefined
                });
                }else{
                tweetCache.set(tweetId, {
                    tweetContent: tweetText,
                    score: score,
                    description: aggregatedContent,
                    reasoning: aggregatedReasoning,
                    streaming: false,
                    timestamp: Date.now(),
                    error: finalStatus === 'error' ? "No score detected" : undefined
                });
                }
                // Finalize UI update via instance
                indicatorInstance.update({
                    status: finalStatus,
                    score: score,
                    description: aggregatedContent,
                    reasoning: aggregatedReasoning,
                    metadata: metadata
                });
                if (tweetArticle) {
                    filterSingleTweet(tweetArticle);
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
            // onError callback
            (errorData) => {
                 console.error(`[API Stream Error] Tweet ${tweetId}: ${errorData.message}`);
                // Update UI via instance to show error
                indicatorInstance.update({
                    status: 'error',
                    score: 5,
                    description: `Stream Error: ${errorData.message}`,
                    reasoning: ''
                });
                // Update cache to reflect error
                if (tweetCache.has(tweetId)) {
                     const entry = tweetCache.get(tweetId);
                     entry.streaming = false;
                     entry.error = errorData.message;
                     entry.score = 5; // Store default error score in cache too
                     entry.description = `Stream Error: ${errorData.message}`; // Store error message
                }
                reject(new Error(errorData.message)); // Reject the promise
            },
            30000,
            tweetId  // Pass the tweet ID to associate with this request
        );
    });
}
// Add this function near the top with other utility functions
async function fetchGenerationMetadata(generationId, apiKey, tweetId, retryDelays = [1000, 2000, 4000, 8000]) {
    if (!generationId || !tweetId) return null;
    for (const delay of retryDelays) {
        try {
            await new Promise(resolve => setTimeout(resolve, delay));
            const result = await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: 'https://openrouter.ai/api/v1/generation?id=' + generationId,
                    headers: {
                        'Authorization': 'Bearer ' + apiKey,
                        'HTTP-Referer': 'https://twitter.com',
                    },
                    onload: function(response) {
                        if (response.status === 200) {
                            try {
                                const data = JSON.parse(response.responseText);
                                console.log(data);
                                tweetCache.set(tweetId, { metadata: "data", timestamp: Date.now() },true);
                                resolve(data);
                            } catch (e) {
                                console.log(response);
                                reject(new Error('Failed to parse metadata response'));
                            }
                        } else {
                            reject(new Error(`HTTP ${response.status}: ${response.statusText}`));
                        }
                    },
                    onerror: function(error) {
                        reject(new Error('Failed to fetch metadata: ' + error.toString()));
                    }
                });
            });
            return result.data; // Return fetched metadata
        } catch (error) {
            console.warn(`Error fetching metadata (attempt after ${delay}ms):`, error);
            // Continue to next retry
        }
    }
    return null;
}
// Export all functions
// // export {
//     safetySettings,
//     rateTweetWithOpenRouter,
//     getCustomInstructionsDescription,
//     rateTweet,
//     rateTweetStreaming
// };
    // ----- twitter-desloppifier.js -----
//src/twitter-desloppifier.js
const VERSION = '1.4.1'; 
(function () {
    'use strict';
    console.log("X/Twitter Tweet De-Sloppification Activated (v1.4.1- Enhanced)");
    // Load CSS stylesheet
    //const css = GM_getResourceText('STYLESHEET');
    let menuhtml = GM_getResourceText("MENU_HTML");
    browserSet('menuHTML', menuhtml);
    let firstRun = browserGet('firstRun', true);
    //GM_addStyle(css);
    // ----- Initialization -----
    /**
     * Initializes the observer on the main content area, adds the UI elements,
     * starts processing visible tweets, and sets up periodic checks.
     */
    function initializeObserver() {
        const target = document.querySelector('main') || document.querySelector('div[data-testid="primaryColumn"]');
        if (target) {
            observedTargetNode = target;
            console.log("X/Twitter Tweet De-Sloppification: Target node found. Observing...");
            initialiseUI();
            if (firstRun) {
                resetSettings(true);
                browserSet('firstRun', false);
            }
            // If no API key is found, prompt the user
            let apiKey = browserGet('openrouter-api-key', '');
            if(!apiKey){
                alert("No API Key found. Please enter your API Key in Settings > General.")
            }
            /*
            if (!apiKey){
                //key is dead
                apiKey = '*'
                showStatus(`No API Key Found. Using Promotional Key`);
            }*/
            if (apiKey) {
                browserSet('openrouter-api-key', apiKey);
                showStatus(`Loaded ${tweetCache.size} cached ratings. Starting to rate visible tweets...`);
                fetchAvailableModels();
            }
            observedTargetNode.querySelectorAll(TWEET_ARTICLE_SELECTOR).forEach(scheduleTweetProcessing);
            applyFilteringToAll();
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
                console.log("X/Twitter Tweet De-Sloppification Deactivated.");
            });
        } else {
            setTimeout(initializeObserver, 1000);
        }
    }
    initializeObserver();
})();
})();
