// ==UserScript==
// @name         TweetFilter AI
// @namespace    http://tampermonkey.net/
// @version      Version 1.5
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
    const MENU = `<div id="tweetfilter-root-container"><button id="filter-toggle" class="toggle-button" style="display: none;">Filter Slider</button><div id="tweet-filter-container"><button class="close-button" data-action="close-filter">×</button><label for="tweet-filter-slider">SlopScore:</label><div class="filter-controls"><input type="range" id="tweet-filter-slider" min="0" max="10" step="1"><input type="number" id="tweet-filter-value" min="0" max="10" step="1" value="5"></div></div><button id="settings-toggle" class="toggle-button" data-action="toggle-settings"><span style="font-size: 14px;">⚙️</span> Settings</button><div id="settings-container" class="hidden"><div class="settings-header"><div class="settings-title">Twitter De-Sloppifier</div><button class="close-button" data-action="toggle-settings">×</button></div><div class="settings-content"><div class="tab-navigation"><button class="tab-button active" data-tab="general">General</button><button class="tab-button" data-tab="models">Models</button><button class="tab-button" data-tab="instructions">Instructions</button></div><div id="general-tab" class="tab-content active"><div class="section-title"><span style="font-size: 14px;">🔑</span> OpenRouter API Key <a href="https://openrouter.ai/settings/keys" target="_blank">Get one here</a></div><input id="openrouter-api-key" placeholder="Enter your OpenRouter API key"><button class="settings-button" data-action="save-api-key">Save API Key</button><div class="section-title" style="margin-top: 20px;"><span style="font-size: 14px;">🗄️</span> Cache Statistics</div><div class="stats-container"><div class="stats-row"><div class="stats-label">Cached Tweet Ratings</div><div class="stats-value" id="cached-ratings-count">0</div></div><div class="stats-row"><div class="stats-label">Whitelisted Handles</div><div class="stats-value" id="whitelisted-handles-count">0</div></div></div><button id="clear-cache" class="settings-button danger" data-action="clear-cache">Clear Rating Cache</button><div class="section-title" style="margin-top: 20px;"><span style="font-size: 14px;">💾</span> Backup &amp; Restore</div><div class="section-description">Export your settings and cached ratings to a file for backup, or import previously saved settings.</div><button class="settings-button" data-action="export-cache">Export Cache</button><button class="settings-button danger" style="margin-top: 15px;" data-action="reset-settings">Reset to Defaults</button><div id="version-info" style="margin-top: 20px; font-size: 11px; opacity: 0.6; text-align: center;">Twitter De-Sloppifier v?.?</div></div><div id="models-tab" class="tab-content"><div class="section-title"><span style="font-size: 14px;">🧠</span> Tweet Rating Model</div><div class="section-description">The rating model is responsible for reviewing each tweet. <br>It will process images directly if you select an <strong>image-capable (🖼️)</strong> model.</div><div class="select-container" id="model-select-container"></div><div class="advanced-options"><div class="advanced-toggle" data-toggle="model-options-content"><div class="advanced-toggle-title">Options</div><div class="advanced-toggle-icon">▼</div></div><div class="advanced-content" id="model-options-content"><div class="sort-container"><label for="model-sort-order">Sort models by: </label><div class="controls-group"><select id="model-sort-order" data-setting="modelSortOrder"><option value="pricing-low-to-high">Price</option><option value="latency-low-to-high">Latency</option><option value="throughput-high-to-low">Throughput</option><option value="top-weekly">Popularity</option><option value="">Age</option></select><button id="sort-direction" class="sort-toggle" data-setting="sortDirection" data-value="default">High-Low</button></div></div><div class="sort-container"><label for="provider-sort">API Endpoint Priority: </label><select id="provider-sort" data-setting="providerSort"><option value="">Default (load-balanced)</option><option value="throughput">Throughput</option><option value="latency">Latency</option><option value="price">Price</option></select></div><div class="sort-container"><label><input type="checkbox" id="show-free-models" data-setting="showFreeModels" checked>Show Free Models</label></div><div class="parameter-row" data-param-name="modelTemperature"><div class="parameter-label" title="How random the model responses should be (0.0-1.0)">Temperature</div><div class="parameter-control"><input type="range" class="parameter-slider" min="0" max="2" step="0.1"><input type="number" class="parameter-value" min="0" max="2" step="0.01" style="width: 60px;"></div></div><div class="parameter-row" data-param-name="modelTopP"><div class="parameter-label" title="Nucleus sampling parameter (0.0-1.0)">Top-p</div><div class="parameter-control"><input type="range" class="parameter-slider" min="0" max="1" step="0.1"><input type="number" class="parameter-value" min="0" max="1" step="0.01" style="width: 60px;"></div></div><div class="parameter-row" data-param-name="maxTokens"><div class="parameter-label" title="Maximum number of tokens for the response (0 means no limit)">Max Tokens</div><div class="parameter-control"><input type="range" class="parameter-slider" min="0" max="2000" step="100"><input type="number" class="parameter-value" min="0" max="2000" step="100" style="width: 60px;"></div></div><div class="toggle-row"><div class="toggle-label" title="Stream API responses as they're generated for live updates">Enable Live Streaming</div><label class="toggle-switch"><input type="checkbox" data-setting="enableStreaming"><span class="toggle-slider"></span></label></div></div></div><div class="section-title" style="margin-top: 25px;"><span style="font-size: 14px;">🖼️</span> Image Processing Model</div><div class="section-description">This model generates <strong>text descriptions</strong> of images for the rating model.<br> Hint: If you selected an image-capable model (🖼️) as your <strong>main rating model</strong>, it will process images directly.</div><div class="toggle-row"><div class="toggle-label">Enable Image Descriptions</div><label class="toggle-switch"><input type="checkbox" data-setting="enableImageDescriptions"><span class="toggle-slider"></span></label></div><div id="image-model-container" style="display: none;"><div class="select-container" id="image-model-select-container"></div><div class="advanced-options" id="image-advanced-options"><div class="advanced-toggle" data-toggle="image-advanced-content"><div class="advanced-toggle-title">Options</div><div class="advanced-toggle-icon">▼</div></div><div class="advanced-content" id="image-advanced-content"><div class="parameter-row" data-param-name="imageModelTemperature"><div class="parameter-label" title="Randomness for image descriptions (0.0-1.0)">Temperature</div><div class="parameter-control"><input type="range" class="parameter-slider" min="0" max="2" step="0.1"><input type="number" class="parameter-value" min="0" max="2" step="0.1" style="width: 60px;"></div></div><div class="parameter-row" data-param-name="imageModelTopP"><div class="parameter-label" title="Nucleus sampling for image model (0.0-1.0)">Top-p</div><div class="parameter-control"><input type="range" class="parameter-slider" min="0" max="1" step="0.1"><input type="number" class="parameter-value" min="0" max="1" step="0.1" style="width: 60px;"></div></div></div></div></div></div><div id="instructions-tab" class="tab-content"><div class="section-title">Custom Instructions</div><div class="section-description">Add custom instructions for how the model should score tweets:</div><textarea id="user-instructions" placeholder="Examples:- Give high scores to tweets about technology- Penalize clickbait-style tweets- Rate educational content higher" data-setting="userDefinedInstructions" value=""></textarea><button class="settings-button" data-action="save-instructions">Save Instructions</button><div class="advanced-options" id="instructions-history"><div class="advanced-toggle" data-toggle="instructions-history-content"><div class="advanced-toggle-title">Custom Instructions History</div><div class="advanced-toggle-icon">▼</div></div><div class="advanced-content" id="instructions-history-content"><div class="instructions-list" id="instructions-list"><!-- Instructions entries will be added here dynamically --></div><button class="settings-button danger" style="margin-top: 10px;" data-action="clear-instructions-history">Clear All History</button></div></div><div class="section-title" style="margin-top: 20px;">Auto-Rate Handles as 10/10</div><div class="section-description">Add Twitter handles to automatically rate as 10/10:</div><div class="handle-input-container"><input id="handle-input" type="text" placeholder="Twitter handle (without @)"><button class="add-handle-btn" data-action="add-handle">Add</button></div><div class="handle-list" id="handle-list"></div></div></div><div id="status-indicator" class=""></div></div><div id="tweet-filter-stats-badge" class="tweet-filter-stats-badge"></div></div>`;
    // Embedded style.css
    const STYLE = `.refreshing {animation: spin 1s infinite linear;}@keyframes spin {0% {transform: rotate(0deg);}100% {transform: rotate(360deg);}}.score-highlight {display: inline-block;background-color: #1d9bf0;/* Twitter blue */color: white;padding: 3px 10px;border-radius: 9999px;margin: 8px 0;font-weight: bold;font-size: 0.9em;}.mobile-tooltip {/* Add specific mobile tooltip styles if needed */max-width: 90vw;/* Example */}.score-description.streaming-tooltip {scroll-behavior: smooth;border-left: 3px solid #1d9bf0;background-color: rgba(25, 30, 35, 0.98);}.score-description.streaming-tooltip::before {content: 'Live';position: absolute;top: 10px;right: 10px;background-color: #1d9bf0;color: white;font-size: 11px;padding: 2px 6px;border-radius: 10px;font-weight: bold;}.score-description::-webkit-scrollbar {width: 6px;}.score-description::-webkit-scrollbar-track {background: rgba(255, 255, 255, 0.05);border-radius: 3px;}.score-description::-webkit-scrollbar-thumb {background: rgba(255, 255, 255, 0.2);border-radius: 3px;}.score-description::-webkit-scrollbar-thumb:hover {background: rgba(255, 255, 255, 0.3);}.score-description.streaming-tooltip p::after {content: '|';display: inline-block;color: #1d9bf0;animation: blink 0.7s infinite;font-weight: bold;margin-left: 2px;}@keyframes blink {0%,100% {opacity: 0;}50% {opacity: 1;}}.streaming-rating {background-color: rgba(33, 150, 243, 0.9) !important;color: white !important;animation: pulse 1.5s infinite alternate;position: relative;}.streaming-rating::after {content: '';position: absolute;top: -2px;right: -2px;width: 6px;height: 6px;background-color: #1d9bf0;border-radius: 50%;animation: blink 0.7s infinite;box-shadow: 0 0 4px #1d9bf0;}.cached-rating {background-color: rgba(76, 175, 80, 0.9) !important;color: white !important;}.rated-rating {background-color: rgba(33, 33, 33, 0.9) !important;color: white !important;}.blacklisted-rating {background-color: rgba(255, 193, 7, 0.9) !important;color: black !important;}.pending-rating {background-color: rgba(255, 152, 0, 0.9) !important;color: white !important;}@keyframes pulse {0% {opacity: 0.8;}100% {opacity: 1;}}.error-rating {background-color: rgba(244, 67, 54, 0.9) !important;color: white !important;}#status-indicator {position: fixed;bottom: 20px;right: 20px;background-color: rgba(22, 24, 28, 0.95);color: #e7e9ea;padding: 10px 15px;border-radius: 8px;font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;font-size: 12px;z-index: 9999;display: none;border: 1px solid rgba(255, 255, 255, 0.1);box-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);transform: translateY(100px);transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);}#status-indicator.active {display: block;transform: translateY(0);}.toggle-switch {position: relative;display: inline-block;width: 36px;height: 20px;}.toggle-switch input {opacity: 0;width: 0;height: 0;}.toggle-slider {position: absolute;cursor: pointer;top: 0;left: 0;right: 0;bottom: 0;background-color: rgba(255, 255, 255, 0.2);transition: .3s;border-radius: 34px;}.toggle-slider:before {position: absolute;content: "";height: 16px;width: 16px;left: 2px;bottom: 2px;background-color: white;transition: .3s;border-radius: 50%;}input:checked+.toggle-slider {background-color: #1d9bf0;}input:checked+.toggle-slider:before {transform: translateX(16px);}.toggle-row {display: flex;align-items: center;justify-content: space-between;padding: 8px 10px;margin-bottom: 12px;background-color: rgba(255, 255, 255, 0.05);border-radius: 8px;transition: background-color 0.2s;}.toggle-row:hover {background-color: rgba(255, 255, 255, 0.08);}.toggle-label {font-size: 13px;color: #e7e9ea;}#tweet-filter-container {position: fixed;top: 70px;right: 15px;background-color: rgba(22, 24, 28, 0.95);color: #e7e9ea;padding: 10px 12px;border-radius: 12px;z-index: 9999;font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;font-size: 13px;box-shadow: 0 2px 12px rgba(0, 0, 0, 0.5);display: flex;align-items: center;gap: 10px;border: 1px solid rgba(255, 255, 255, 0.1);transform-origin: top right;transition: transform 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55), opacity 0.5s ease-in-out;opacity: 1;transform: scale(1) translateX(0);visibility: visible;}#tweet-filter-container.hidden {opacity: 0;transform: scale(0.8) translateX(50px);visibility: hidden;}.close-button {background: none;border: none;color: #e7e9ea;font-size: 16px;cursor: pointer;padding: 0;width: 28px;height: 28px;display: flex;align-items: center;justify-content: center;opacity: 0.8;transition: opacity 0.2s;border-radius: 50%;min-width: 28px;min-height: 28px;-webkit-tap-highlight-color: transparent;touch-action: manipulation;user-select: none;z-index: 30;}.close-button:hover {opacity: 1;background-color: rgba(255, 255, 255, 0.1);}.hidden {display: none !important;}/* Only override hidden for our specific containers */#tweet-filter-container.hidden,#settings-container.hidden {display: flex !important;}.toggle-button {position: fixed;right: 15px;background-color: rgba(22, 24, 28, 0.95);color: #e7e9ea;padding: 8px 12px;border-radius: 8px;cursor: pointer;font-size: 12px;z-index: 9999;border: 1px solid rgba(255, 255, 255, 0.1);box-shadow: 0 2px 12px rgba(0, 0, 0, 0.5);font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;display: flex;align-items: center;gap: 6px;transition: all 0.2s ease;}.toggle-button:hover {background-color: rgba(29, 155, 240, 0.2);}#filter-toggle {top: 70px;}#settings-toggle {top: 120px;}#tweet-filter-container label {margin: 0;font-weight: bold;}.tweet-filter-stats-badge {position: fixed;bottom: 50px;right: 20px;background-color: rgba(29, 155, 240, 0.9);color: white;padding: 5px 10px;border-radius: 15px;font-size: 12px;z-index: 9999;box-shadow: 0 2px 5px rgba(0,0,0,0.2);transition: opacity 0.3s;cursor: pointer;display: flex;align-items: center;}#tweet-filter-slider {cursor: pointer;width: 120px;vertical-align: middle;-webkit-appearance: none;appearance: none;height: 6px;border-radius: 3px;background: linear-gradient(to right,#FF0000 0%,#FF8800 calc(var(--slider-percent, 50%) * 0.166),#FFFF00 calc(var(--slider-percent, 50%) * 0.333),#00FF00 calc(var(--slider-percent, 50%) * 0.5),#00FFFF calc(var(--slider-percent, 50%) * 0.666),#0000FF calc(var(--slider-percent, 50%) * 0.833),#800080 var(--slider-percent, 50%),#DEE2E6 var(--slider-percent, 50%),#DEE2E6 100%);}#tweet-filter-slider::-webkit-slider-thumb {-webkit-appearance: none;appearance: none;width: 16px;height: 16px;border-radius: 50%;background: #1d9bf0;cursor: pointer;border: 2px solid white;box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);transition: transform 0.1s;}#tweet-filter-slider::-webkit-slider-thumb:hover {transform: scale(1.2);}#tweet-filter-slider::-moz-range-thumb {width: 16px;height: 16px;border-radius: 50%;background: #1d9bf0;cursor: pointer;border: 2px solid white;box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);transition: transform 0.1s;}#tweet-filter-slider::-moz-range-thumb:hover {transform: scale(1.2);}#tweet-filter-value {min-width: 20px;text-align: center;font-weight: bold;background-color: rgba(255, 255, 255, 0.1);padding: 2px 5px;border-radius: 4px;}#settings-container {position: fixed;top: 70px;right: 15px;background-color: rgba(22, 24, 28, 0.95);color: #e7e9ea;padding: 0;border-radius: 16px;z-index: 9999;font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;font-size: 13px;box-shadow: 0 2px 18px rgba(0, 0, 0, 0.6);display: flex;flex-direction: column;width: 90vw;max-width: 380px;max-height: 85vh;overflow: hidden;border: 1px solid rgba(255, 255, 255, 0.1);line-height: 1.3;transform-origin: top right;transition: transform 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55),opacity 0.5s ease-in-out;opacity: 1;transform: scale(1) translateX(0);visibility: visible;}#settings-container.hidden {opacity: 0;transform: scale(0.8) translateX(50px);visibility: hidden;}.settings-header {padding: 12px 15px;border-bottom: 1px solid rgba(255, 255, 255, 0.1);display: flex;justify-content: space-between;align-items: center;position: sticky;top: 0;background-color: rgba(22, 24, 28, 0.98);z-index: 20;border-radius: 16px 16px 0 0;}.settings-title {font-weight: bold;font-size: 16px;}.settings-content {overflow-y: auto;max-height: calc(85vh - 110px);padding: 0;}.settings-content::-webkit-scrollbar {width: 6px;}.settings-content::-webkit-scrollbar-track {background: rgba(255, 255, 255, 0.05);border-radius: 3px;}.settings-content::-webkit-scrollbar-thumb {background: rgba(255, 255, 255, 0.2);border-radius: 3px;}.settings-content::-webkit-scrollbar-thumb:hover {background: rgba(255, 255, 255, 0.3);}.tab-navigation {display: flex;border-bottom: 1px solid rgba(255, 255, 255, 0.1);position: sticky;top: 0;background-color: rgba(22, 24, 28, 0.98);z-index: 10;padding: 10px 15px;gap: 8px;}.tab-button {padding: 6px 10px;background: none;border: none;color: #e7e9ea;font-weight: bold;cursor: pointer;border-radius: 8px;transition: all 0.2s ease;font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;font-size: 13px;flex: 1;text-align: center;}.tab-button:hover {background-color: rgba(255, 255, 255, 0.1);}.tab-button.active {color: #1d9bf0;background-color: rgba(29, 155, 240, 0.1);border-bottom: 2px solid #1d9bf0;}.tab-content {display: none;animation: fadeIn 0.3s ease;padding: 15px;}@keyframes fadeIn {from {opacity: 0;}to {opacity: 1;}}.tab-content.active {display: block;}.select-container {position: relative;margin-bottom: 15px;}.select-container .search-field {position: sticky;top: 0;background-color: rgba(39, 44, 48, 0.95);padding: 8px;border-bottom: 1px solid rgba(255, 255, 255, 0.1);z-index: 1;}.select-container .search-input {width: 100%;padding: 8px 10px;border-radius: 8px;border: 1px solid rgba(255, 255, 255, 0.2);background-color: rgba(39, 44, 48, 0.9);color: #e7e9ea;font-size: 12px;transition: border-color 0.2s;}.select-container .search-input:focus {border-color: #1d9bf0;outline: none;}.custom-select {position: relative;display: inline-block;width: 100%;}.select-selected {background-color: rgba(39, 44, 48, 0.95);color: #e7e9ea;padding: 10px 12px;border: 1px solid rgba(255, 255, 255, 0.2);border-radius: 8px;cursor: pointer;user-select: none;display: flex;justify-content: space-between;align-items: center;font-size: 13px;transition: border-color 0.2s;}.select-selected:hover {border-color: rgba(255, 255, 255, 0.4);}.select-selected:after {content: "";width: 8px;height: 8px;border: 2px solid #e7e9ea;border-width: 0 2px 2px 0;display: inline-block;transform: rotate(45deg);margin-left: 10px;transition: transform 0.2s;}.select-selected.select-arrow-active:after {transform: rotate(-135deg);}.select-items {position: absolute;background-color: rgba(39, 44, 48, 0.98);top: 100%;left: 0;right: 0;z-index: 99;max-height: 300px;overflow-y: auto;border: 1px solid rgba(255, 255, 255, 0.2);border-radius: 8px;margin-top: 5px;box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);display: none;}.select-items div {color: #e7e9ea;padding: 10px 12px;cursor: pointer;user-select: none;transition: background-color 0.2s;border-bottom: 1px solid rgba(255, 255, 255, 0.05);}.select-items div:hover {background-color: rgba(29, 155, 240, 0.1);}.select-items div.same-as-selected {background-color: rgba(29, 155, 240, 0.2);}.select-items::-webkit-scrollbar {width: 6px;}.select-items::-webkit-scrollbar-track {background: rgba(255, 255, 255, 0.05);}.select-items::-webkit-scrollbar-thumb {background: rgba(255, 255, 255, 0.2);border-radius: 3px;}.select-items::-webkit-scrollbar-thumb:hover {background: rgba(255, 255, 255, 0.3);}#openrouter-api-key,#user-instructions {width: 100%;padding: 10px 12px;border-radius: 8px;border: 1px solid rgba(255, 255, 255, 0.2);margin-bottom: 12px;background-color: rgba(39, 44, 48, 0.95);color: #e7e9ea;font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;font-size: 13px;transition: border-color 0.2s;}#openrouter-api-key:focus,#user-instructions:focus {border-color: #1d9bf0;outline: none;}#user-instructions {height: 120px;resize: vertical;}.parameter-row {display: flex;align-items: center;margin-bottom: 12px;gap: 8px;padding: 6px;border-radius: 8px;transition: background-color 0.2s;}.parameter-row:hover {background-color: rgba(255, 255, 255, 0.05);}.parameter-label {flex: 1;font-size: 13px;color: #e7e9ea;}.parameter-control {flex: 1.5;display: flex;align-items: center;gap: 8px;}.parameter-value {min-width: 28px;text-align: center;background-color: rgba(255, 255, 255, 0.1);padding: 3px 5px;border-radius: 4px;font-size: 12px;}.parameter-slider {flex: 1;-webkit-appearance: none;height: 4px;border-radius: 4px;background: rgba(255, 255, 255, 0.2);outline: none;cursor: pointer;}.parameter-slider::-webkit-slider-thumb {-webkit-appearance: none;appearance: none;width: 14px;height: 14px;border-radius: 50%;background: #1d9bf0;cursor: pointer;transition: transform 0.1s;}.parameter-slider::-webkit-slider-thumb:hover {transform: scale(1.2);}.section-title {font-weight: bold;margin-top: 20px;margin-bottom: 8px;color: #e7e9ea;display: flex;align-items: center;gap: 6px;font-size: 14px;}.section-title:first-child {margin-top: 0;}.section-description {font-size: 12px;margin-bottom: 8px;opacity: 0.8;line-height: 1.4;}.section-title a {color: #1d9bf0;text-decoration: none;background-color: rgba(255, 255, 255, 0.1);padding: 3px 6px;border-radius: 6px;transition: all 0.2s ease;}.section-title a:hover {background-color: rgba(29, 155, 240, 0.2);text-decoration: underline;}.advanced-options {margin-top: 5px;margin-bottom: 15px;border: 1px solid rgba(255, 255, 255, 0.1);border-radius: 8px;padding: 12px;background-color: rgba(255, 255, 255, 0.03);overflow: hidden;}.advanced-toggle {display: flex;justify-content: space-between;align-items: center;cursor: pointer;margin-bottom: 5px;}.advanced-toggle-title {font-weight: bold;font-size: 13px;color: #e7e9ea;}.advanced-toggle-icon {transition: transform 0.3s;}.advanced-toggle-icon.expanded {transform: rotate(180deg);}.advanced-content {max-height: 0;overflow: hidden;transition: max-height 0.3s ease-in-out;}.advanced-content.expanded {max-height: none;}#instructions-history-content.expanded {max-height: none !important;}#instructions-history .instructions-list {max-height: 400px;overflow-y: auto;margin-bottom: 10px;}.handle-list {margin-top: 10px;max-height: 120px;overflow-y: auto;border: 1px solid rgba(255, 255, 255, 0.1);border-radius: 8px;padding: 5px;}.handle-item {display: flex;align-items: center;justify-content: space-between;padding: 6px 10px;border-bottom: 1px solid rgba(255, 255, 255, 0.05);border-radius: 4px;transition: background-color 0.2s;}.handle-item:hover {background-color: rgba(255, 255, 255, 0.05);}.handle-item:last-child {border-bottom: none;}.handle-text {font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;font-size: 12px;}.remove-handle {background: none;border: none;color: #ff5c5c;cursor: pointer;font-size: 14px;padding: 0 3px;opacity: 0.7;transition: opacity 0.2s;}.remove-handle:hover {opacity: 1;}.add-handle-btn {background-color: #1d9bf0;color: white;border: none;border-radius: 6px;padding: 7px 10px;cursor: pointer;font-weight: bold;font-size: 12px;margin-left: 5px;transition: background-color 0.2s;}.add-handle-btn:hover {background-color: #1a8cd8;}.settings-button {background-color: #1d9bf0;color: white;border: none;border-radius: 8px;padding: 10px 14px;cursor: pointer;font-weight: bold;transition: background-color 0.2s;font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;margin-top: 8px;width: 100%;font-size: 13px;}.settings-button:hover {background-color: #1a8cd8;}.settings-button.secondary {background-color: rgba(255, 255, 255, 0.1);}.settings-button.secondary:hover {background-color: rgba(255, 255, 255, 0.15);}.settings-button.danger {background-color: #ff5c5c;}.settings-button.danger:hover {background-color: #e53935;}.button-row {display: flex;gap: 8px;margin-top: 10px;}.button-row .settings-button {margin-top: 0;}.stats-container {background-color: rgba(255, 255, 255, 0.05);padding: 10px;border-radius: 8px;margin-bottom: 15px;}.stats-row {display: flex;justify-content: space-between;padding: 5px 0;border-bottom: 1px solid rgba(255, 255, 255, 0.1);}.stats-row:last-child {border-bottom: none;}.stats-label {font-size: 12px;opacity: 0.8;}.stats-value {font-weight: bold;}.score-indicator {position: absolute;top: 10px;right: 10.5%;background-color: rgba(22, 24, 28, 0.9);color: #e7e9ea;padding: 4px 10px;border-radius: 8px;font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;font-size: 14px;font-weight: bold;z-index: 100;cursor: pointer;border: 1px solid rgba(255, 255, 255, 0.1);min-width: 20px;text-align: center;box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);transition: transform 0.15s ease;}.score-indicator:hover {transform: scale(1.05);}.score-indicator.mobile-indicator {position: absolute !important;bottom: 3% !important;right: 10px !important;top: auto !important;}.score-description {display: none;background-color: rgba(22, 24, 28, 0.95);color: #e7e9ea;padding: 0 20px 16px 20px;border-radius: 12px;box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;font-size: 16px;line-height: 1.5;z-index: 99999999;position: absolute;width: 550px !important;max-width: 80vw !important;max-height: 60vh;overflow-y: auto;border: 1px solid rgba(255, 255, 255, 0.1);word-wrap: break-word;box-sizing: border-box !important;max-width: 500px;padding-bottom: 35px;}.score-description.pinned {border: 2px solid #1d9bf0 !important;}.tooltip-controls {display: flex !important;justify-content: flex-end !important;position: relative !important;margin: 0 -20px 15px -20px !important;top: 0 !important;background-color: rgba(39, 44, 48, 0.95) !important;padding: 12px 15px !important;z-index: 2 !important;border-top-left-radius: 12px !important;border-top-right-radius: 12px !important;border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;backdrop-filter: blur(5px) !important;}.tooltip-pin-button,.tooltip-copy-button {background: none !important;border: none !important;color: #8899a6 !important;cursor: pointer !important;font-size: 16px !important;padding: 4px 8px !important;margin-left: 8px !important;border-radius: 4px !important;transition: all 0.2s !important;}.tooltip-pin-button:hover,.tooltip-copy-button:hover {background-color: rgba(29, 155, 240, 0.1) !important;color: #1d9bf0 !important;}.tooltip-pin-button:active,.tooltip-copy-button:active {transform: scale(0.95) !important;}.description-text {margin: 0 0 25px 0 !important;font-size: 15px !important;line-height: 1.6 !important;max-width: 100% !important;overflow-wrap: break-word !important;padding: 5px 0 !important;color: #e1e8ed !important;letter-spacing: 0.2px !important;}/* Style different elements within description text */.description-text p {margin: 0 0 12px 0 !important;}.description-text p:last-child {margin-bottom: 0 !important;}.description-text strong {color: #fff !important;font-weight: 600 !important;}.description-text em {color: #8899a6 !important;font-style: italic !important;}.description-text code {background: rgba(255, 255, 255, 0.1) !important;padding: 2px 6px !important;border-radius: 4px !important;font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace !important;font-size: 0.9em !important;color: #1d9bf0 !important;}.description-text a {color: #1d9bf0 !important;text-decoration: none !important;transition: color 0.2s ease !important;border-bottom: 1px solid rgba(29, 155, 240, 0.3) !important;}.description-text a:hover {color: #ffffff !important;border-bottom-color: #ffffff !important;}/* Add subtle highlight for important sections */.description-text blockquote {margin: 12px 0 !important;padding: 8px 16px !important;border-left: 3px solid #1d9bf0 !important;background: rgba(29, 155, 240, 0.1) !important;border-radius: 0 4px 4px 0 !important;}/* Style lists within description */.description-text ul, .description-text ol {margin: 8px 0 12px 20px !important;padding: 0 !important;}.description-text li {margin: 4px 0 !important;line-height: 1.5 !important;}/* Style headings if present */.description-text h1,.description-text h2,.description-text h3,.description-text h4 {color: #ffffff !important;margin: 16px 0 8px 0 !important;font-weight: 600 !important;line-height: 1.3 !important;}.description-text h1 { font-size: 1.4em !important; }.description-text h2 { font-size: 1.3em !important; }.description-text h3 { font-size: 1.2em !important; }.description-text h4 { font-size: 1.1em !important; }/* Add subtle animation for content changes */.description-text {transition: opacity 0.2s ease !important;}/* Style tables if present */.description-text table {width: 100% !important;border-collapse: collapse !important;margin: 12px 0 !important;background: rgba(255, 255, 255, 0.03) !important;border-radius: 4px !important;}.description-text th,.description-text td {padding: 8px 12px !important;border: 1px solid rgba(255, 255, 255, 0.1) !important;text-align: left !important;}.description-text th {background: rgba(255, 255, 255, 0.05) !important;font-weight: 600 !important;color: #ffffff !important;}/* Add a subtle separator between major sections */.description-text hr {border: none !important;border-top: 1px solid rgba(255, 255, 255, 0.1) !important;margin: 20px 0 !important;}/* Style pre blocks for code snippets */.description-text pre {background: rgba(0, 0, 0, 0.2) !important;padding: 12px !important;border-radius: 4px !important;overflow-x: auto !important;border: 1px solid rgba(255, 255, 255, 0.1) !important;margin: 12px 0 !important;}.description-text pre code {background: none !important;padding: 0 !important;border-radius: 0 !important;font-size: 0.9em !important;color: #e1e8ed !important;}/* Add a subtle hover effect for interactive elements */.description-text *[role="button"],.description-text .interactive {transition: all 0.2s ease !important;}.description-text *[role="button"]:hover,.description-text .interactive:hover {background-color: rgba(255, 255, 255, 0.1) !important;}/* Style keyboard shortcuts or commands */.description-text kbd {background: rgba(255, 255, 255, 0.1) !important;border: 1px solid rgba(255, 255, 255, 0.2) !important;border-radius: 3px !important;padding: 2px 6px !important;font-size: 0.9em !important;font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;box-shadow: 0 1px 1px rgba(0,0,0,0.2) !important;}.tooltip-bottom-spacer {height: 10px;}.reasoning-dropdown {margin-top: 15px !important;border-top: 1px solid rgba(255, 255, 255, 0.1) !important;padding-top: 10px !important;}.reasoning-toggle {display: flex !important;align-items: center !important;color: #1d9bf0 !important;cursor: pointer !important;font-weight: bold !important;padding: 5px !important;user-select: none !important;}.reasoning-toggle:hover {background-color: rgba(29, 155, 240, 0.1) !important;border-radius: 4px !important;}.reasoning-arrow {display: inline-block !important;margin-right: 5px !important;transition: transform 0.2s ease !important;}.reasoning-content {max-height: 0 !important;overflow: hidden !important;transition: max-height 0.3s ease-out, padding 0.3s ease-out !important;background-color: rgba(0, 0, 0, 0.15) !important;border-radius: 5px !important;margin-top: 5px !important;padding: 0 !important;}.reasoning-dropdown.expanded .reasoning-content {max-height: 350px !important;overflow-y: auto !important;padding: 10px !important;}.reasoning-dropdown.expanded .reasoning-arrow {transform: rotate(90deg) !important;}.reasoning-text {font-size: 14px !important;line-height: 1.4 !important;color: #ccc !important;margin: 0 !important;padding: 5px !important;}.scroll-to-bottom-button {position: sticky;bottom: 0;width: 100%;background-color: rgba(29, 155, 240, 0.9);color: white;text-align: center;padding: 8px 0;cursor: pointer;font-weight: bold;border-top: 1px solid rgba(255, 255, 255, 0.2);margin-top: 10px;z-index: 100;transition: background-color 0.2s;}.scroll-to-bottom-button:hover {background-color: rgba(29, 155, 240, 1);}@media (max-width: 600px) {.score-indicator {position: absolute !important;bottom: 3% !important;right: 10px !important;top: auto !important;}.score-description {position: fixed !important;width: 100% !important;max-width: 100% !important;top: 5vh !important;bottom: 5vh !important;left: 0 !important;right: 0 !important;margin: 0 !important;padding: 12px !important;box-sizing: border-box !important;overflow-y: auto !important;overflow-x: hidden !important;-webkit-overflow-scrolling: touch !important;overscroll-behavior: contain !important;transform: translateZ(0) !important;border-radius: 16px 16px 0 0 !important;}.reasoning-dropdown.expanded .reasoning-content {max-height: 200px !important;}.close-button {width: 32px;height: 32px;min-width: 32px;min-height: 32px;font-size: 18px;padding: 8px;margin: -4px;}.settings-header .close-button {position: relative;right: 0;}.tooltip-close-button {font-size: 22px !important;width: 32px !important;height: 32px !important;}.tooltip-controls {padding-right: 40px !important;}}.sort-container {margin: 10px 0;display: flex;align-items: center;gap: 10px;justify-content: space-between;}.sort-container label {font-size: 14px;color: var(--text-color);white-space: nowrap;}.sort-container .controls-group {display: flex;gap: 8px;align-items: center;}.sort-container select {padding: 5px 10px;border-radius: 4px;border: 1px solid rgba(255, 255, 255, 0.2);background-color: rgba(39, 44, 48, 0.95);color: #e7e9ea;font-size: 14px;cursor: pointer;min-width: 120px;}.sort-container select:hover {border-color: #1d9bf0;}.sort-container select:focus {outline: none;border-color: #1d9bf0;box-shadow: 0 0 0 2px rgba(29, 155, 240, 0.2);}.sort-toggle {padding: 5px 10px;border-radius: 4px;border: 1px solid rgba(255, 255, 255, 0.2);background-color: rgba(39, 44, 48, 0.95);color: #e7e9ea;font-size: 14px;cursor: pointer;transition: all 0.2s ease;}.sort-toggle:hover {border-color: #1d9bf0;background-color: rgba(29, 155, 240, 0.1);}.sort-toggle.active {background-color: rgba(29, 155, 240, 0.2);border-color: #1d9bf0;}.sort-container select option {background-color: rgba(39, 44, 48, 0.95);color: #e7e9ea;}@media (min-width: 601px) {#settings-container {width: 480px;max-width: 480px;}}#handle-input {flex: 1;padding: 8px 12px;border-radius: 8px;border: 1px solid rgba(255, 255, 255, 0.2);background-color: rgba(39, 44, 48, 0.95);color: #e7e9ea;font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;font-size: 14px;transition: border-color 0.2s;min-width: 200px;}#handle-input:focus {outline: none;border-color: #1d9bf0;box-shadow: 0 0 0 2px rgba(29, 155, 240, 0.2);}#handle-input::placeholder {color: rgba(231, 233, 234, 0.5);}.handle-input-container {display: flex;gap: 8px;align-items: center;margin-bottom: 10px;padding: 5px;border-radius: 8px;background-color: rgba(255, 255, 255, 0.03);}.add-handle-btn {background-color: #1d9bf0;color: white;border: none;border-radius: 8px;padding: 8px 16px;cursor: pointer;font-weight: bold;font-size: 14px;transition: background-color 0.2s;white-space: nowrap;}.add-handle-btn:hover {background-color: #1a8cd8;}.instructions-list {margin-top: 10px;max-height: 200px;overflow-y: auto;border: 1px solid rgba(255, 255, 255, 0.1);border-radius: 8px;padding: 5px;}.instruction-item {display: flex;align-items: center;justify-content: space-between;padding: 8px 10px;border-bottom: 1px solid rgba(255, 255, 255, 0.05);border-radius: 4px;transition: background-color 0.2s;}.instruction-item:hover {background-color: rgba(255, 255, 255, 0.05);}.instruction-item:last-child {border-bottom: none;}.instruction-text {font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;font-size: 12px;flex: 1;margin-right: 10px;}.instruction-buttons {display: flex;gap: 5px;}.use-instruction {background: none;border: none;color: #1d9bf0;cursor: pointer;font-size: 12px;padding: 3px 8px;border-radius: 4px;transition: all 0.2s;}.use-instruction:hover {background-color: rgba(29, 155, 240, 0.1);}.remove-instruction {background: none;border: none;color: #ff5c5c;cursor: pointer;font-size: 14px;padding: 0 3px;opacity: 0.7;transition: opacity 0.2s;border-radius: 4px;}.remove-instruction:hover {opacity: 1;background-color: rgba(255, 92, 92, 0.1);}.tweet-filtered {display: none !important;visibility: hidden !important;opacity: 0 !important;pointer-events: none !important;/* Ensure it stays hidden even if Twitter tries to show it */position: absolute !important;z-index: -9999 !important;height: 0 !important;width: 0 !important;margin: 0 !important;padding: 0 !important;overflow: hidden !important;}.filter-controls {display: flex;align-items: center;gap: 10px;margin: 5px 0;}.filter-controls input[type="range"] {flex: 1;min-width: 100px;}.filter-controls input[type="number"] {width: 50px;padding: 2px 5px;border: 1px solid #ccc;border-radius: 4px;text-align: center;}/* Hide number input spinners */.filter-controls input[type="number"]::-webkit-inner-spin-button,.filter-controls input[type="number"]::-webkit-outer-spin-button {-webkit-appearance: none;margin: 0;}.filter-controls input[type="number"] {-moz-appearance: textfield;}/* --- Metadata Specific Styling --- */.tooltip-metadata {font-size: 0.8em;opacity: 0.7;margin-top: 8px;padding-top: 8px;border-top: 1px solid rgba(255, 255, 255, 0.2);display: block;line-height: 1.5;}.metadata-line {white-space: nowrap;overflow: hidden;text-overflow: ellipsis;margin-bottom: 2px;}.metadata-separator {display: none;}/* --- Specific Indicator Styles --- */.score-indicator.pending-rating {}/* --- Tooltip Styles --- */.score-description {/* ... existing styles ... */max-width: 500px;padding-bottom: 35px; /* Add padding for scroll button *//* ... existing styles ... */}.score-description.streaming-tooltip {border-color: #ffa500; /* Orange border for streaming */}/* ... existing .tooltip-controls, .tooltip-pin-button, .tooltip-copy-button styles ... *//* --- Reasoning Dropdown --- */.reasoning-dropdown {/* ... existing styles ... */}.reasoning-toggle {/* ... existing styles ... */}.reasoning-arrow {/* ... existing styles ... */}.reasoning-content {/* ... existing styles ... */}.reasoning-text {/* ... existing styles ... */}.description-text {/* ... existing styles ... */}/* --- Last Answer Area --- */.tooltip-last-answer {margin-top: 10px;padding: 10px;background-color: rgba(255, 255, 255, 0.05); /* Slightly different background */border-radius: 4px;font-size: 0.9em;line-height: 1.4;}.answer-separator {border: none;border-top: 1px dashed rgba(255, 255, 255, 0.2);margin: 10px 0;}/* --- Follow-Up Questions Area --- */.tooltip-follow-up-questions {margin-top: 10px;display: flex;flex-direction: column;gap: 6px; /* Spacing between buttons */}.follow-up-question-button {background-color: rgba(60, 160, 240, 0.2); /* Light blue background */border: 1px solid rgba(60, 160, 240, 0.5);color: #e1e8ed; /* Light text */padding: 8px 12px;border-radius: 15px; /* Pill shape */cursor: pointer;font-size: 0.85em;text-align: left;transition: background-color 0.2s ease, border-color 0.2s ease;white-space: normal; /* Allow wrapping */line-height: 1.3;}.follow-up-question-button:hover {background-color: rgba(60, 160, 240, 0.35);border-color: rgba(60, 160, 240, 0.8);}.follow-up-question-button:active {background-color: rgba(60, 160, 240, 0.5);}/* --- Metadata Area --- */.tooltip-metadata {margin-top: 12px;padding-top: 8px;font-size: 0.8em;color: #8899a6; /* Muted color */border-top: 1px solid rgba(255, 255, 255, 0.1);}.metadata-separator {border: none;border-top: 1px dashed rgba(255, 255, 255, 0.2);margin: 8px 0;}.metadata-line {margin-bottom: 4px;}.metadata-line:last-child {margin-bottom: 0;}/* --- Score Highlight --- */.score-highlight {/* ... existing styles ... */}/* --- Scroll Button --- */.scroll-to-bottom-button {/* ... existing styles ... */}.tooltip-bottom-spacer {/* ... existing styles ... */}/* --- Custom Question Input Area --- */.tooltip-custom-question-container {margin-top: 15px;display: flex;gap: 8px;padding-top: 10px;border-top: 1px solid rgba(255, 255, 255, 0.1); /* Separator */}.tooltip-custom-question-input {flex-grow: 1; /* Take available space */padding: 8px 10px;border-radius: 6px;border: 1px solid rgba(255, 255, 255, 0.2);background-color: rgba(39, 44, 48, 0.9);color: #e7e9ea;font-size: 0.9em;font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; /* Ensure font consistency */line-height: 1.4; /* Adjust line height for better text readability */resize: none; /* Prevent manual resizing by the user */overflow-y: hidden; /* Hide scrollbar initially, height adjustment will manage overflow */min-height: calc(0.9em * 1.4 + 16px + 2px); /* Approx height for 1 row: (font-size * line-height) + padding + border */box-sizing: border-box; /* Ensure padding and border are included in height calculation */}.tooltip-custom-question-input:focus {border-color: #1d9bf0;outline: none;}.tooltip-custom-question-button {background-color: #1d9bf0;color: white;border: none;border-radius: 6px;padding: 8px 12px;cursor: pointer;font-weight: bold;font-size: 0.9em;transition: background-color 0.2s;}.tooltip-custom-question-button:hover {background-color: #1a8cd8;}.tooltip-custom-question-button:disabled,.tooltip-custom-question-input:disabled {opacity: 0.6;cursor: not-allowed;}/* --- Conversation History Styling --- */.tooltip-conversation-history {margin-top: 15px;padding-top: 10px;border-top: 1px solid rgba(255, 255, 255, 0.1);display: flex;flex-direction: column;gap: 12px; /* Space between conversation turns */}.conversation-turn {background-color: rgba(255, 255, 255, 0.04);padding: 10px;border-radius: 6px;line-height: 1.4;}.conversation-question {font-size: 0.9em;color: #b0bec5; /* Lighter grey for user question */margin-bottom: 6px;}.conversation-question strong {color: #cfd8dc; /* Slightly brighter for "You:" */}.conversation-answer {font-size: 0.95em;color: #e1e8ed; /* Main text color for AI answer */}.conversation-answer strong {color: #1d9bf0; /* Twitter blue for "AI:" */}.conversation-separator {border: none;border-top: 1px dashed rgba(255, 255, 255, 0.15);margin: 0; /* Reset margin, gap handles spacing */}.pending-answer {color: #ffa726; /* Orange for pending state */font-style: italic;}/* Blinking cursor for streaming answers */.pending-cursor {display: inline-block;color: #1d9bf0; /* Twitter blue */animation: blink 0.7s infinite;font-weight: bold;margin-left: 2px;font-style: normal; /* Override italic from pending-answer if nested */}@keyframes blink {0%, 100% { opacity: 0; }50% { opacity: 1; }}/* Styling for links generated from markdown in AI answers */.ai-generated-link {color: #1d9bf0; /* Twitter blue */text-decoration: underline;transition: color 0.2s ease;}.ai-generated-link:hover {color: #1a8cd8; /* Slightly darker blue on hover */text-decoration: underline;}/* Style for the new tooltip close button */.tooltip-close-button {/* Reuse general close button styles */background: none !important;border: none !important;color: #8899a6 !important; /* Match other control button colors */cursor: pointer !important;font-size: 20px !important; /* Slightly larger for easier tapping */line-height: 1 !important;padding: 4px 8px !important;margin-left: 8px !important; /* Space from other buttons */border-radius: 50% !important; /* Make it round */width: 28px !important; /* Explicit size */height: 28px !important; /* Explicit size */display: flex !important;align-items: center !important;justify-content: center !important;transition: all 0.2s !important;order: 3; /* Ensure it comes after pin and copy */}.tooltip-close-button:hover {background-color: rgba(255, 92, 92, 0.1) !important; /* Reddish background on hover */color: #ff5c5c !important; /* Red color on hover */}.tooltip-close-button:active {transform: scale(0.95) !important;}/* Adjust mobile close button specifically if needed */@media (max-width: 600px) {.tooltip-close-button {font-size: 22px !important; /* Even larger on mobile */width: 32px !important;height: 32px !important;}/* Ensure controls container accommodates button */.tooltip-controls {padding-right: 40px !important; /* Add padding to prevent overlap if button was absolute */}}/* --- Styling for Reasoning Dropdown within Conversation Turn --- */.conversation-turn .reasoning-dropdown {margin-top: 8px; /* Space above the dropdown */margin-bottom: 8px; /* Space below the dropdown, before the answer */border-radius: 4px;background-color: rgba(255, 255, 255, 0.02); /* Slightly different background from turn itself */border: 1px solid rgba(255, 255, 255, 0.08);}.conversation-turn .reasoning-toggle {display: flex;align-items: center;color: #b0bec5; /* Muted color for toggle text */cursor: pointer;font-weight: normal; /* Less prominent than main reasoning toggle */font-size: 0.85em;padding: 6px 8px;user-select: none;transition: background-color 0.2s;}.conversation-turn .reasoning-toggle:hover {background-color: rgba(255, 255, 255, 0.05);}.conversation-turn .reasoning-arrow {display: inline-block;margin-right: 4px;font-size: 0.9em;transition: transform 0.2s ease;}.conversation-turn .reasoning-content {max-height: 0;overflow: hidden;transition: max-height 0.3s ease-out, padding 0.3s ease-out;background-color: rgba(0, 0, 0, 0.1);border-radius: 0 0 4px 4px;padding: 0 8px; /* Horizontal padding only when collapsed */}.conversation-turn .reasoning-dropdown.expanded .reasoning-content {max-height: 200px; /* Adjust as needed */overflow-y: auto;padding: 8px; /* Full padding when expanded */}.conversation-turn .reasoning-dropdown.expanded .reasoning-arrow {transform: rotate(90deg);}.conversation-turn .reasoning-text {font-size: 0.85em; /* Smaller text for reasoning */line-height: 1.4;color: #ccc; /* Similar to main reasoning text */margin: 0;padding: 0; /* Padding is on the content container */}/* Ensure scrollbars look consistent */.conversation-turn .reasoning-content::-webkit-scrollbar {width: 5px;}.conversation-turn .reasoning-content::-webkit-scrollbar-track {background: rgba(255, 255, 255, 0.05);border-radius: 3px;}.conversation-turn .reasoning-content::-webkit-scrollbar-thumb {background: rgba(255, 255, 255, 0.2);border-radius: 3px;}.conversation-turn .reasoning-content::-webkit-scrollbar-thumb:hover {background: rgba(255, 255, 255, 0.3);}/* --- Styling for Image Upload in Follow-up --- */.tooltip-attach-image-button {background: none;border: none;color: #8899a6; /* Muted color, similar to other controls */font-size: 1.2em; /* Slightly larger for icon visibility */cursor: pointer;padding: 6px 8px; /* Adjust padding to align with input/button height */margin: 0 4px; /* Space around the icon */border-radius: 4px;transition: all 0.2s ease;align-self: center; /* Vertically align with input and Ask button */}.tooltip-attach-image-button:hover {background-color: rgba(29, 155, 240, 0.1);color: #1d9bf0;}.tooltip-follow-up-image-preview-container {margin-top: 10px;padding-top: 10px;border-top: 1px solid rgba(255, 255, 255, 0.1);display: flex; /* Changed to flex for easier alignment of preview and button */flex-direction: row; /* Lay out previews in a row */flex-wrap: wrap; /* Allow previews to wrap to the next line */gap: 10px; /* Spacing between preview items */align-items: flex-start;}.follow-up-image-preview-item {position: relative; /* For positioning the remove button */display: flex;flex-direction: column;align-items: center;border: 1px solid rgba(255, 255, 255, 0.2);border-radius: 6px;padding: 5px;background-color: rgba(255, 255, 255, 0.05);}.follow-up-image-preview-thumbnail {max-width: 80px; /* Smaller thumbnails for multiple previews */max-height: 80px;border-radius: 4px;object-fit: cover; /* Or contain, depending on desired look */margin-bottom: 5px; /* Space between image and potential future captions */}.follow-up-image-remove-btn {position: absolute;top: -5px;right: -5px;background-color: rgba(40, 40, 40, 0.8);color: white;border: 1px solid rgba(255,255,255,0.3);border-radius: 50%; /* Circular button */width: 20px;height: 20px;font-size: 12px;font-weight: bold;line-height: 18px; /* Adjust for vertical centering of X */text-align: center;cursor: pointer;padding: 0;transition: background-color 0.2s ease, transform 0.2s ease;}.follow-up-image-remove-btn:hover {background-color: rgba(255, 92, 92, 0.9);transform: scale(1.1);}/* Adjust custom question container to be flex for alignment */.tooltip-custom-question-container {/* ... existing styles ... */display: flex; /* Ensures items are in a row */align-items: center; /* Vertically aligns items in the middle */}.tooltip-custom-question-input {/* ... existing styles ... */margin-right: 0; /* Remove right margin if any, gap handles spacing */}/* --- Styling for Uploaded Image in Conversation History --- */.conversation-image-container {margin-top: 8px; /* Space above the image */margin-bottom: 8px; /* Space below the image, before reasoning/answer */display: flex; /* Use flex for multiple images */flex-wrap: wrap; /* Allow images to wrap */gap: 8px; /* Space between images */}.conversation-uploaded-image {max-width: 80%; /* Limit width to not dominate the tooltip */max-height: 120px; /* Slightly larger than preview, but still constrained */border-radius: 6px;border: 1px solid rgba(255, 255, 255, 0.2);object-fit: contain; /* Maintain aspect ratio */display: block; /* Ensure it takes its own line if needed */cursor: pointer; /* Indicate it can be clicked (e.g., for lightbox in future) */transition: transform 0.2s ease;}.conversation-uploaded-image:hover {transform: scale(1.02); /* Slight zoom on hover */}`;
    // Apply CSS
    GM_addStyle(STYLE);
    // Set menu HTML
    GM_setValue('menuHTML', MENU);
    // ----- helpers/browserStorage.js -----
function browserGet(key, defaultValue = null) {
    try {
        return GM_getValue(key, defaultValue);
    } catch (error) {
        return defaultValue;
    }
}
function browserSet(key, value) {
    try {
        GM_setValue(key, value);
    } catch (error) {
    }
}
    // ----- helpers/cache.js -----
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
class TweetCache {
    static DEBOUNCE_DELAY = 1500;
    constructor() {
        this.cache = {};
        this.loadFromStorage();
        this.debouncedSaveToStorage = debounce(this.#saveToStorageInternal.bind(this), TweetCache.DEBOUNCE_DELAY);
    }
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
    #saveToStorageInternal() {
        try {
            browserSet('tweetRatings', JSON.stringify(this.cache));
            updateCacheStatsUI();
        } catch (error) {
        }
    }
    get(tweetId) {
        return this.cache[tweetId] || null;
    }
    set(tweetId, rating, saveImmediately = true) {
        this.cache[tweetId] = {
            score: rating.score,
            fullContext: rating.fullContext || '',
            description: rating.description || '',
            reasoning: rating.reasoning || '',
            questions: rating.questions || [],
            lastAnswer: rating.lastAnswer || '',
            mediaUrls: rating.mediaUrls || [],
            timestamp: rating.timestamp || Date.now(),
            streaming: rating.streaming || false,
            blacklisted: rating.blacklisted || false,
            fromStorage: rating.fromStorage || false,
            metadata: {
                model: rating.metadata?.model || null,
                promptTokens: rating.metadata?.promptTokens || null,
                completionTokens: rating.metadata?.completionTokens || null,
                latency: rating.metadata?.latency || null,
                mediaInputs: rating.metadata?.mediaInputs || null,
                price: rating.metadata?.price || null
            },
            qaConversationHistory: rating.qaConversationHistory || []
        };
        if(!saveImmediately) {
            this.debouncedSaveToStorage();
        } else {
            this.#saveToStorageInternal();
        }
    }
    has(tweetId) {
        return this.cache[tweetId] !== undefined;
    }
    delete(tweetId, saveImmediately = true) {
        if (this.has(tweetId)) {
            delete this.cache[tweetId];
            this.debouncedSaveToStorage();
        }
    }
    clear(saveImmediately = false) {
        this.cache = {};
        if (saveImmediately) {
            this.#saveToStorageInternal();
        } else {
            this.debouncedSaveToStorage();
        }
    }
    get size() {
        return Object.keys(this.cache).length;
    }
    cleanup(saveImmediately = true) {
        const beforeCount = this.size;
        let deletedCount = 0;
        let streamingDeletedCount = 0;
        let undefinedScoreCount = 0;
        let missingQaHistoryCount = 0;
        for (const tweetId in this.cache) {
            const entry = this.cache[tweetId];
            let shouldDelete = false;
            if (entry.score === undefined || entry.score === null) {
                if (entry.streaming === true) {
                    streamingDeletedCount++;
                } else {
                    undefinedScoreCount++;
                }
                shouldDelete = true;
            }
            if (!entry.streaming && entry.score !== undefined && entry.score !== null && !entry.blacklisted && 
                (!entry.qaConversationHistory || !Array.isArray(entry.qaConversationHistory) || entry.qaConversationHistory.length < 3)) {
                missingQaHistoryCount++;
                shouldDelete = true;
            }
            if (shouldDelete) {
                delete this.cache[tweetId];
                deletedCount++;
            }
        }
        if (deletedCount > 0) {
            this.debouncedSaveToStorage();
        }
        return {
            beforeCount,
            afterCount: this.size,
            deletedCount,
            streamingDeletedCount,
            undefinedScoreCount,
            missingQaHistoryCount
        };
    }
}
const tweetCache = new TweetCache();
    // ----- backends/InstructionsHistory.js -----
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
    #hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(36);
    }
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
    #saveToStorage() {
        try {
            browserSet('instructionsHistory', JSON.stringify(this.history));
        } catch (e) {
            throw new Error('Failed to save instructions history');
        }
    }
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
    getAll() {
        return [...this.history];
    }
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
    clear() {
        try {
            this.history = [];
            this.#saveToStorage();
        } catch (e) {
            throw new Error('Failed to clear instructions history');
        }
    }
    get size() {
        return this.history.length;
    }
}
    // ----- backends/InstructionsManager.js -----
class InstructionsManager {
    constructor() {
        if (InstructionsManager.instance) {
            return InstructionsManager.instance;
        }
        InstructionsManager.instance = this;
        this.history = new InstructionsHistory();
        this.currentInstructions = browserGet('userDefinedInstructions', '');
    }
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
    getCurrentInstructions() {
        return this.currentInstructions;
    }
    getHistory() {
        return this.history.getAll();
    }
    removeFromHistory(index) {
        return this.history.remove(index);
    }
    clearHistory() {
        this.history.clear();
    }
}
const instructionsManager = new InstructionsManager(); 
    // ----- config.js -----
const processedTweets = new Set();
const adAuthorCache = new Set();
const PROCESSING_DELAY_MS = 150;
const API_CALL_DELAY_MS = 25;
let USER_DEFINED_INSTRUCTIONS = instructionsManager.getCurrentInstructions() || 'Rate the tweet on a scale from 1 to 10 based on its clarity, insight, creativity, and overall quality.';
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
let blacklistedHandles = browserGet('blacklistedHandles', '').split('\n').filter(h => h.trim() !== '');
let storedRatings = browserGet('tweetRatings', '{}');
let threadHist = "";
let enableImageDescriptions = browserGet('enableImageDescriptions', false);
let enableStreaming = browserGet('enableStreaming', true);
const REVIEW_SYSTEM_PROMPT=`
    You are **TweetFilter-AI**.
    When given a tweet, do these three steps **in order**:
    1. **ANALYZE** - Judge how closely the tweet matches the user's instructions.  
    2. **SCORE** - Assign an integer from 0'10 (inclusive) based *only* on that alignment.  
    3. **ASK** - Write **exactly three** open-ended follow-up questions the user might ask next.  
       • Questions must be answerable from the tweet itself or general knowledge.  
       • Do **not** ask for information that requires unavailable context (e.g., the author's other tweets).
    **Important constraints**
    • You do **not** have up-to-the-minute knowledge of current events.  
      → If a tweet makes a factual claim you cannot verify, **do not down-score it** for "fake news"; instead, evaluate it solely on the user's criteria and note any uncertainty in your analysis.  
      → Only down-score when the tweet contradicts widely-known, stable facts or directly violates the user's instructions.
    ⚠️ Output must match **exactly** the EXPECTED_RESPONSE_FORMAT" - no extra text, no missing tags - or the pipeline crashes.
  EXPECTED_RESPONSE_FORMAT: (begin with <ANALYSIS> and end with </FOLLOW_UP_QUESTIONS>)
    <ANALYSIS>
      (Your analysis goes here.)
    </ANALYSIS>
    <SCORE>
      SCORE_X
    </SCORE>
    <FOLLOW_UP_QUESTIONS>
      Q_1. …
      Q_2. …
      Q_3. …
    </FOLLOW_UP_QUESTIONS>
  End of EXPECTED_RESPONSE_FORMAT
`;
const FOLLOW_UP_SYSTEM_PROMPT = `
You are TweetFilter-AI, continuing a conversation about a tweet.
The user has asked a follow-up question.
Your entire conversation history up to this point is provided in the message list.
Please provide an answer and then generate 3 new, relevant follow-up questions.
Adhere strictly to the following response format:
<ANSWER>
(Your answer here)
</ANSWER>
<FOLLOW_UP_QUESTIONS>
Q_1. (New Question 1 here)
Q_2. (New Question 2 here)
Q_3. (New Question 3 here)
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
function getElementText(elements) {
    if (!elements) return '';
    const elementList = elements instanceof NodeList ? Array.from(elements) : [elements];
    for (const element of elementList) {
        const text = element?.textContent?.trim();
        if (text) return text;
    }
    return '';
}
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
async function extractMediaLinks(scopeElement) {
    if (!scopeElement) return [];
    const mediaLinks = new Set();
    const imgSelector = `${MEDIA_IMG_SELECTOR}, [data-testid="tweetPhoto"] img, img[src*="pbs.twimg.com/media"]`;
    const videoSelector = `${MEDIA_VIDEO_SELECTOR}, video[poster*="pbs.twimg.com"], video`;
    const combinedSelector = `${imgSelector}, ${videoSelector}`;
    let mediaElements = scopeElement.querySelectorAll(combinedSelector);
    const RETRY_DELAY = 100;
    let retries = 0;
    while (mediaElements.length === 0 && retries < MAX_RETRIES) {
        retries++;
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        mediaElements = scopeElement.querySelectorAll(combinedSelector);
    }
    if (mediaElements.length === 0 && scopeElement.matches(QUOTE_CONTAINER_SELECTOR)) {
        mediaElements = scopeElement.querySelectorAll('img[src*="pbs.twimg.com"], video[poster*="pbs.twimg.com"]');
    }
    mediaElements.forEach(mediaEl => {
        const sourceUrl = mediaEl.tagName === 'IMG' ? mediaEl.src : mediaEl.poster;
        if (!sourceUrl || 
           !(sourceUrl.includes('pbs.twimg.com/')) ||
           sourceUrl.includes('profile_images')) {
            return;
        }
        try {
            const url = new URL(sourceUrl);
            const name = url.searchParams.get('name');
            let finalUrl = sourceUrl;
            if (name && name !== 'orig') {
                finalUrl = sourceUrl.replace(`name=${name}`, 'name=small');
            }
            mediaLinks.add(finalUrl);
        } catch (error) {
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
function handleMutations(mutationsList) {
    let tweetsAdded = false;
    let needsCleanup = false;
    const shouldSkipProcessing = (element) => {
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
                            setTimeout(handleThreads, 50);
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
function isMobileDevice() {
    return (window.innerWidth <= 600 || 
            /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
}
function showStatus(message, type = 'info') {
    const indicator = document.getElementById('status-indicator');
    if (!indicator) {
        return;
    }
    indicator.textContent = message;
    indicator.className = 'active ' + type;
    setTimeout(() => { indicator.classList.remove('active', type); }, 3000);
}
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
function useInstructions(instructions) {
    const textarea = document.getElementById('user-instructions');
    if (textarea) {
        textarea.value = instructions;
        saveInstructions();
    }
}
function removeInstructions(index) {
    if (instructionsManager.removeFromHistory(index)) {
        refreshInstructionsHistory();
        showStatus('Instructions removed from history');
    } else {
        showStatus('Error removing instructions');
    }
}
function clearInstructionsHistory() {
    if (isMobileDevice() || confirm('Are you sure you want to clear all instruction history?')) {
        instructionsManager.clearHistory();
        refreshInstructionsHistory();
        showStatus('Instructions history cleared');
    }
}
    // ----- ui/ScoreIndicator.js -----
class ScoreIndicator {
    constructor(tweetArticle) {
        if (!tweetArticle || !tweetArticle.nodeType || tweetArticle.nodeType !== Node.ELEMENT_NODE) {
            throw new Error("ScoreIndicator requires a valid tweet article DOM element.");
        }
        this.tweetArticle = tweetArticle;
        this.tweetId = getTweetID(this.tweetArticle);
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
        this.followUpImageContainer = null;
        this.followUpImageInput = null;
        this.followUpImagePreview = null;
        this.followUpRemoveImageButton = null;
        this.uploadedImageDataUrls = [];
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
        try {
            this._createElements(tweetArticle);
            this._addEventListeners();
            ScoreIndicatorRegistry.add(this.tweetId, this);
            this.updateDatasetAttributes(tweetArticle);
        } catch (error) {
            this.destroy();
            throw error;
        }
    }
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
        this.tooltipControls.appendChild(this.pinButton);
        this.tooltipControls.appendChild(this.copyButton);
        this.tooltipControls.appendChild(this.tooltipCloseButton);
        this.tooltipElement.appendChild(this.tooltipControls);
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
        this.tooltipElement.appendChild(this.reasoningDropdown);
        this.descriptionElement = document.createElement('div');
        this.descriptionElement.className = 'description-text';
        this.tooltipElement.appendChild(this.descriptionElement);
        this.scoreTextElement = document.createElement('div');
        this.scoreTextElement.className = 'score-text-from-description';
        this.scoreTextElement.style.display = 'none';
        this.tooltipElement.appendChild(this.scoreTextElement);
        this.followUpQuestionsTextElement = document.createElement('div');
        this.followUpQuestionsTextElement.className = 'follow-up-questions-text-from-description';
        this.followUpQuestionsTextElement.style.display = 'none';
        this.tooltipElement.appendChild(this.followUpQuestionsTextElement);
        this.conversationContainerElement = document.createElement('div');
        this.conversationContainerElement.className = 'tooltip-conversation-history';
        this.tooltipElement.appendChild(this.conversationContainerElement);
        this.followUpQuestionsElement = document.createElement('div');
        this.followUpQuestionsElement.className = 'tooltip-follow-up-questions';
        this.followUpQuestionsElement.style.display = 'none';
        this.tooltipElement.appendChild(this.followUpQuestionsElement);
        this.customQuestionContainer = document.createElement('div');
        this.customQuestionContainer.className = 'tooltip-custom-question-container';
        this.customQuestionInput = document.createElement('textarea');
        this.customQuestionInput.placeholder = 'Ask your own question...';
        this.customQuestionInput.className = 'tooltip-custom-question-input';
        this.customQuestionInput.rows = 1;
        this.customQuestionInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight) + 'px';
        });
        const currentSelectedModel = browserGet('selectedModel', 'openai/gpt-4.1-nano');
        const supportsImages = typeof modelSupportsImages === 'function' && modelSupportsImages(currentSelectedModel);
        if (supportsImages) {
            this.attachImageButton = document.createElement('button');
            this.attachImageButton.textContent = '📎';
            this.attachImageButton.className = 'tooltip-attach-image-button';
            this.attachImageButton.title = 'Attach image(s)';
            this.followUpImageInput = document.createElement('input');
            this.followUpImageInput.type = 'file';
            this.followUpImageInput.accept = 'image/' + '*';
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
        this.tooltipElement.appendChild(this.customQuestionContainer);
        if (supportsImages) {
            this.followUpImageContainer = document.createElement('div');
            this.followUpImageContainer.className = 'tooltip-follow-up-image-preview-container';
            this.tooltipElement.insertBefore(this.followUpImageContainer, this.metadataElement);
        }
        this.metadataElement = document.createElement('div');
        this.metadataElement.className = 'tooltip-metadata';
        this.metadataElement.style.display = 'none';
        this.tooltipElement.appendChild(this.metadataElement);
        this.scrollButton = document.createElement('div');
        this.scrollButton.className = 'scroll-to-bottom-button';
        this.scrollButton.innerHTML = '⬇ Scroll to bottom';
        this.scrollButton.style.display = 'none';
        this.tooltipElement.appendChild(this.scrollButton);
        const bottomSpacer = document.createElement('div');
        bottomSpacer.className = 'tooltip-bottom-spacer';
        this.tooltipElement.appendChild(bottomSpacer);
        document.body.appendChild(this.tooltipElement);
        if (isMobileDevice()) {
            this.indicatorElement?.classList.add('mobile-indicator');
            this.tooltipElement?.classList.add('mobile-tooltip');
        }
        this._updateIndicatorUI();
        this._updateTooltipUI();
    }
    _addEventListeners() {
        if (!this.indicatorElement || !this.tooltipElement) return;
        this.indicatorElement.addEventListener('mouseenter', this._handleMouseEnter.bind(this));
        this.indicatorElement.addEventListener('mouseleave', this._handleMouseLeave.bind(this));
        this.indicatorElement.addEventListener('click', this._handleIndicatorClick.bind(this));
        this.tooltipElement.addEventListener('mouseenter', this._handleTooltipMouseEnter.bind(this));
        this.tooltipElement.addEventListener('mouseleave', this._handleTooltipMouseLeave.bind(this));
        this.tooltipElement.addEventListener('scroll', this._handleTooltipScroll.bind(this));
        this.pinButton?.addEventListener('click', this._handlePinClick.bind(this));
        this.copyButton?.addEventListener('click', this._handleCopyClick.bind(this));
        this.tooltipCloseButton?.addEventListener('click', this._handleCloseClick.bind(this));
        this.reasoningToggle?.addEventListener('click', this._handleReasoningToggleClick.bind(this));
        this.scrollButton?.addEventListener('click', this._handleScrollButtonClick.bind(this));
        this.followUpQuestionsElement?.addEventListener('click', this._handleFollowUpQuestionClick.bind(this));
        this.customQuestionButton?.addEventListener('click', this._handleCustomQuestionClick.bind(this));
        this.customQuestionInput?.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                this._handleCustomQuestionClick();
            }
        });
        if (this.attachImageButton && this.followUpImageInput) {
            this.attachImageButton.addEventListener('click', () => this.followUpImageInput.click());
            this.followUpImageInput.addEventListener('change', this._handleFollowUpImageSelect.bind(this));
        }
    }
    updateDatasetAttributes(currentTweetArticle) {
        const article = currentTweetArticle || this.findCurrentArticleElement();
        if (!article) {
            return;
        }
        article.dataset.ratingStatus = this.status;
        article.dataset.sloppinessScore = this.score !== null ? String(this.score) : '';
        article.dataset.ratingDescription = this.description;
        article.dataset.ratingReasoning = this.reasoning;
        article.dataset.blacklisted = String(this.status === 'blacklisted');
        article.dataset.cachedRating = String(this.status === 'cached');
    }
    _updateIndicatorUI() {
        if (!this.indicatorElement) return;
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
                indicatorText = String(this.score);
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
    _updateTooltipUI() {
        if (!this.tooltipElement || !this.descriptionElement || !this.scoreTextElement || !this.followUpQuestionsTextElement || !this.reasoningTextElement || !this.reasoningDropdown || !this.conversationContainerElement || !this.followUpQuestionsElement || !this.metadataElement) {
            return;
        }
        const wasNearBottom = this.tooltipElement.scrollHeight - this.tooltipElement.scrollTop - this.tooltipElement.clientHeight < (isMobileDevice() ? 40 : 55);
        const previousScrollTop = this.tooltipElement.scrollTop;
        const previousScrollHeight = this.tooltipElement.scrollHeight;
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
                .replace(/</g, '&lt;').replace(/>/g, '&gt;') // Basic escaping
                .replace(/SCORE_(\d+)/g, '<span class="score-highlight">SCORE: $1</span>') // Apply highlighting
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
                    this.followUpQuestionsElement.appendChild(questionButton);
                });
                this.followUpQuestionsElement.style.display = 'block';
            } else {
                this.followUpQuestionsElement.style.display = 'none';
            }
            contentChanged = true;
        }
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
        const isStreaming = this.status === 'streaming';
        if (this.tooltipElement.classList.contains('streaming-tooltip') !== isStreaming) {
             this.tooltipElement.classList.toggle('streaming-tooltip', isStreaming);
             contentChanged = true;
        }
        if (contentChanged) {
            requestAnimationFrame(() => {
                if (this.autoScroll && (wasNearBottom || !previousScrollHeight)) {
                    this._performAutoScroll();
                } else if (!this.autoScroll && previousScrollHeight > 0) {
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
                formattedAnswer = turn.answer
                    .replace(/</g, '&lt;').replace(/>/g, '&gt;') // Escape potential raw HTML first
                    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="ai-generated-link">$1</a>') // Added class
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\*(.*?)\*/g, '<em>$1</em>')
                    .replace(/`([^`]+)`/g, '<code>$1</code>')
                    .replace(/\n/g, '<br>');
            }
            if (index > 0) {
                historyHtml += '<hr class="conversation-separator">';
            }
            let reasoningHtml = '';
            if (turn.reasoning && turn.reasoning.trim() !== '') {
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
    _attachConversationReasoningListeners() {
        if (!this.conversationContainerElement) return;
        this.conversationContainerElement.removeEventListener('click', this._handleConversationReasoningToggle);
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
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                if (this.tooltipElement && this.autoScroll && this.isVisible) {
                    const targetScroll = this.tooltipElement.scrollHeight;
                    this.tooltipElement.scrollTo({
                        top: targetScroll,
                        behavior: 'instant'
                    });
                    setTimeout(() => {
                        if (this.tooltipElement && this.autoScroll && this.isVisible) {
                            const isNearBottom = this.tooltipElement.scrollHeight - this.tooltipElement.scrollTop - this.tooltipElement.clientHeight < 5;
                            if (!isNearBottom) {
                                this.tooltipElement.scrollTop = this.tooltipElement.scrollHeight;
                            }
                        }
                    }, 50);
                }
            });
        });
    }
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
        tooltip.style.overflowY = finalOverflowY;
        if (finalOverflowY === 'scroll') {
            tooltip.style.webkitOverflowScrolling = 'touch';
        }
        tooltip.style.visibility = 'visible';
    }
    _updateScrollButtonVisibility() {
        if (!this.tooltipElement || !this.scrollButton) return;
        const isStreaming = this.status === 'streaming';
        if (!isStreaming) {
            this.scrollButton.style.display = 'none';
            return;
        }
        const isNearBottom = this.tooltipElement.scrollHeight - this.tooltipElement.scrollTop - this.tooltipElement.clientHeight < (isMobileDevice() ? 40 : 55);
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
        if (!this.isPinned) {
            this.hide();
        }
    }
    _handleTooltipClick(event) {
    }
    _handleTooltipScroll() {
        if (!this.tooltipElement) return;
        const isNearBottom = this.tooltipElement.scrollHeight - this.tooltipElement.scrollTop - this.tooltipElement.clientHeight < (isMobileDevice() ? 40 : 55);
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
        e.stopPropagation();
        if (!this.reasoningDropdown || !this.reasoningContent || !this.reasoningArrow) return;
        const isExpanded = this.reasoningDropdown.classList.toggle('expanded');
        this.reasoningArrow.textContent = isExpanded ? '▼' : '▶';
        if (isExpanded) {
            this.reasoningContent.style.maxHeight = '300px';
            this.reasoningContent.style.padding = '10px';
        } else {
            this.reasoningContent.style.maxHeight = '0';
            this.reasoningContent.style.padding = '0 10px';
        }
    }
    _handleScrollButtonClick(e) {
        e.stopPropagation();
        if (!this.tooltipElement) return;
        this.autoScroll = true;
        this.tooltipElement.dataset.autoScroll = 'true';
        this._performAutoScroll();
        this._updateScrollButtonVisibility();
    }
    _handleFollowUpQuestionClick(event) {
        const isMockEvent = event.target && event.target.dataset && event.target.dataset.questionText && typeof event.target.closest !== 'function';
        const button = isMockEvent ? event.target : event.target.closest('.follow-up-question-button');
        if (!button) return;
        event.stopPropagation();
        const questionText = button.dataset.questionText;
        const apiKey = browserGet('openrouter-api-key', '');
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
            uploadedImages: [...this.uploadedImageDataUrls], // Store a copy of the image URLs array
            reasoning: '' // Initialize reasoning for this turn
        });
        this._updateTooltipUI();
        this.questions = [];
        this._updateTooltipUI();
        const userMessageContent = [{ type: "text", text: questionText }];
        if (this.uploadedImageDataUrls && this.uploadedImageDataUrls.length > 0) {
            this.uploadedImageDataUrls.forEach(url => {
                userMessageContent.push({ type: "image_url", image_url: { "url": url } });
            });
        }
        const userApiMessage = { role: "user", content: userMessageContent };
        const historyForApiCall = [...this.qaConversationHistory, userApiMessage];
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
            setTimeout(() => {
                 if (this.followUpQuestionsElement) {
                    this.followUpQuestionsElement.querySelectorAll('.follow-up-question-button').forEach(btn => {
                         btn.disabled = false;
                    });
                }
                if (this.customQuestionInput) this.customQuestionInput.disabled = false;
                if (this.customQuestionButton) {
                    this.customQuestionButton.disabled = false;
                    this.customQuestionButton.textContent = 'Ask';
                }
                this._clearFollowUpImage();
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
        const mockButton = {
            dataset: { questionText: questionText },
            disabled: false,
            textContent: ''
        };
        this.followUpQuestionsElement?.querySelectorAll('.follow-up-question-button').forEach(btn => btn.disabled = true);
        this._handleFollowUpQuestionClick({ target: mockButton, stopPropagation: () => {} });
        if (this.customQuestionInput) {
            this.customQuestionInput.value = '';
        }
    }
    _handleFollowUpImageSelect(event) {
        const files = event.target.files;
        if (!files || files.length === 0) return;
        if (this.followUpImageContainer && files.length > 0) {
            this.followUpImageContainer.style.display = 'flex';
        }
        Array.from(files).forEach(file => {
            if (file && file.type.startsWith('image/')) {
                resizeImage(file, 512) // Resize to max 512px
                    .then(resizedDataUrl => {
                        this.uploadedImageDataUrls.push(resizedDataUrl);
                        this._addPreviewToContainer(resizedDataUrl);
                    })
                    .catch(error => {
                        showStatus(`Could not process image ${file.name}: ${error.message}`, "error");
                    });
            } else if (file) {
                showStatus(`Skipping non-image file: ${file.name}`, "warning");
        }
        });
        event.target.value = null;
    }
    _addPreviewToContainer(imageDataUrl) {
        if (!this.followUpImageContainer) return;
        const previewItem = document.createElement('div');
        previewItem.className = 'follow-up-image-preview-item';
        previewItem.dataset.imageDataUrl = imageDataUrl;
        const img = document.createElement('img');
        img.src = imageDataUrl;
        img.className = 'follow-up-image-preview-thumbnail';
        const removeBtn = document.createElement('button');
        removeBtn.textContent = '×';
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
    _updateConversationHistory(question, answer, reasoning = '') {
        const entryIndex = this.conversationHistory.findIndex(turn => turn.question === question && turn.answer === 'pending');
        if (entryIndex !== -1) {
            this.conversationHistory[entryIndex].answer = answer;
            this.conversationHistory[entryIndex].reasoning = reasoning;
            this._updateTooltipUI();
        } else {
        }
    }
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
        let reasoningDropdown = lastTurnElement.querySelector('.reasoning-dropdown');
        const hasReasoning = reasoningText && reasoningText.trim() !== '';
        if (hasReasoning && !reasoningDropdown) {
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
            reasoningDropdown.style.display = 'none';
        }
        const lastAnswerElement = lastTurnElement.querySelector('.conversation-answer');
        if (lastAnswerElement) {
            const formattedStreamingAnswer = streamingText
                .replace(/</g, '&lt;').replace(/>/g, '&gt;') // Escape potential raw HTML first
                .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="ai-generated-link">$1</a>')
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/`([^`]+)`/g, '<code>$1</code>')
                .replace(/\n/g, '<br>');
            lastAnswerElement.innerHTML = `<strong>AI:</strong> ${formattedStreamingAnswer}<em class="pending-cursor">|</em>`;
        } else {
        }
        if (this.autoScroll) {
            this._performAutoScroll();
        }
    }
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
            this.score = (this.status === 'pending' || this.status === 'error') ? score : // Allow score display for error state if provided
                (this.status === 'streaming' && score === null) ? this.score : // Keep existing score during streaming if new one is null
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
        this.updateDatasetAttributes();
    }
    show() {
        if (!this.tooltipElement) return;
        this.isVisible = true;
        this.tooltipElement.style.display = 'block';
        this._setPosition();
        if (this.autoScroll && (this.status === 'streaming' || this.status === 'pending')) {
            this._performAutoScroll();
        }
        this._updateScrollButtonVisibility();
    }
    hide() {
        if (!this.isPinned && this.tooltipElement) {
            this.isVisible = false;
            this.tooltipElement.style.display = 'none';
        } else if (this.isPinned) {
        }
    }
    toggle() {
        if (this.isVisible && !this.isPinned) {
            this.hide();
        } else {
            this.show();
        }
    }
    pin() {
        if (!this.tooltipElement || !this.pinButton) return;
        this.isPinned = true;
        this.tooltipElement.classList.add('pinned');
        this.pinButton.innerHTML = '📍';
        this.pinButton.title = 'Unpin tooltip';
    }
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
        e.stopPropagation();
        this.hide();
    }
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
                event.preventDefault();
                this._handleCustomQuestionClick();
            }
        });
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
        this.followUpImagePreview = null;
        this.followUpRemoveImageButton = null;
        this.attachImageButton = null;
        this.uploadedImageDataUrls = [];
    }
    ensureIndicatorAttached() {
        if (!this.indicatorElement) return;
        const currentArticle = this.findCurrentArticleElement();
        if (!currentArticle) {
            return;
        }
        if (this.indicatorElement.parentElement !== currentArticle) {
            const currentPosition = window.getComputedStyle(currentArticle).position;
            if (currentPosition !== 'relative' && currentPosition !== 'absolute' && currentPosition !== 'fixed' && currentPosition !== 'sticky') {
                currentArticle.style.position = 'relative';
            }
            currentArticle.appendChild(this.indicatorElement);
        }
        this.updateDatasetAttributes(currentArticle);
    }
    findCurrentArticleElement() {
        const timeline = document.querySelector('main') || document.querySelector('div[data-testid="primaryColumn"]');
        if (!timeline) return null;
        const linkSelector = `a[href*="/status/${this.tweetId}"]`;
        const linkElement = timeline.querySelector(linkSelector);
        const article = linkElement?.closest('article[data-testid="tweet"]');
        if (article) {
            if (getTweetID(article) === this.tweetId) {
                return article;
            }
        }
        const articles = timeline.querySelectorAll('article[data-testid="tweet"]');
        for (const art of articles) {
            if (getTweetID(art) === this.tweetId) {
                return art;
            }
        }
        return null;
    }
    updateInitialReviewAndBuildHistory({ fullContext, mediaUrls, apiResponseContent, reviewSystemPrompt, followUpSystemPrompt }) {
        const analysisMatch = apiResponseContent.match(/<ANALYSIS>([\s\S]*?)<\/ANALYSIS>/);
        const scoreMatch = apiResponseContent.match(/<SCORE>\s*SCORE_(\d+)\s*<\/SCORE>/);
        const initialQuestions = extractFollowUpQuestions(apiResponseContent);
        this.score = scoreMatch ? parseInt(scoreMatch[1], 10) : null;
        this.description = analysisMatch ? analysisMatch[1].trim() : apiResponseContent;
        this.questions = initialQuestions;
        this.status = this.score !== null ? 'rated' : 'error';
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
        this._updateIndicatorUI();
        this._updateTooltipUI();
        this.updateDatasetAttributes();
    }
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
        this._updateTooltipUI();
        this.updateDatasetAttributes();
    }
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
                        reasoning: '' // Reasoning extraction from assistant's full response for UI needs more logic
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
        this.updateDatasetAttributes();
    }
}
const ScoreIndicatorRegistry = {
    managers: new Map(),
    get(tweetId, tweetArticle = null) {
        if (!tweetId) {
            return null;
        }
        if (this.managers.has(tweetId)) {
            const existingManager = this.managers.get(tweetId);
            if (tweetArticle && existingManager.tweetArticle !== tweetArticle) {
            }
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
    add(tweetId, instance) {
        if (this.managers.has(tweetId)) {
        }
        this.managers.set(tweetId, instance);
    },
    remove(tweetId) {
        if (this.managers.has(tweetId)) {
            this.managers.delete(tweetId);
        }
    },
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
    destroyAll() {
        [...this.managers.values()].forEach(manager => manager.destroy());
        this.managers.clear();
    }
};
function formatTooltipDescription(description = "", reasoning = "") {
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
            .replace(/\n/g, '<br>');
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
    return { description: formattedDescription, reasoning: formattedReasoning };
}
    // ----- ui/ui.js -----
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
                tweet.removeAttribute('data-sloppiness-score');
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
function addHandleFromInput() {
    const handleInput = document.getElementById('handle-input');
    const handle = handleInput.value.trim();
    if (handle) {
        addHandleToBlacklist(handle);
        handleInput.value = '';
    }
}
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
}
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
function formatModelLabel(model) {
    let label = model.slug || model.id || model.name || 'Unknown Model';
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
            renderOptions();
        }
    });
}
function closeAllSelectBoxes(exceptThisOne = null) {
    document.querySelectorAll('.custom-select').forEach(select => {
        if (select === exceptThisOne) return;
        const items = select.querySelector('.select-items');
        const selected = select.querySelector('.select-selected');
        if (items) items.style.display = 'none';
        if (selected) selected.classList.remove('select-arrow-active');
    });
}
function resetSettings(noconfirm = false) {
    if (noconfirm || confirm('Are you sure you want to reset all settings to their default values? This will not clear your cached ratings, blacklisted handles, or instruction history.')) {
        tweetCache.clear();
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
function removeHandleFromBlacklist(handle) {
    const index = blacklistedHandles.indexOf(handle);
    if (index > -1) {
        blacklistedHandles.splice(index, 1);
        browserSet('blacklistedHandles', blacklistedHandles.join('\n'));
        refreshHandleList(document.getElementById('handle-list'));
        showStatus(`Removed @${handle} from auto-rate list.`);
    } else console.warn(`Attempted to remove non-existent handle: ${handle}`);
}
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
function filterSingleTweet(tweetArticle) {
    const cell = tweetArticle.closest('div[data-testid="cellInnerDiv"]');
    if (!cell) {
        return;
    }
    const handles = getUserHandles(tweetArticle);
    const authorHandle = handles.length > 0 ? handles[0] : '';
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
    indicatorInstance?.ensureIndicatorAttached();
    const currentFilterThreshold = parseInt(browserGet('filterThreshold', '1'));
    const ratingStatus = tweetArticle.dataset.ratingStatus;
    if (ratingStatus === 'pending' || ratingStatus === 'streaming') {
        delete cell.dataset.filtered;
    } else if (isNaN(score) || score < currentFilterThreshold) {
        if (tweetId) {
            ScoreIndicatorRegistry.get(tweetId)?.destroy();
        }
        cell.innerHTML = '';
        cell.dataset.filtered = 'true';
    }
}
async function applyTweetCachedRating(tweetArticle) {
    const tweetId = getTweetID(tweetArticle);
    const handles = getUserHandles(tweetArticle);
    const userHandle = handles.length > 0 ? handles[0] : '';
    if (userHandle && isUserBlacklisted(userHandle)) {
        const indicatorInstance = ScoreIndicatorRegistry.get(tweetId, tweetArticle);
        if (indicatorInstance) {
            const tweetText = getElementText(tweetArticle.querySelector(TWEET_TEXT_SELECTOR)) || "[Tweet text not found]";
            const mediaUrls = await extractMediaLinks(tweetArticle);
            const blacklistResponse = `<ANALYSIS>
            This user is on the blacklist. Tweets from this user are not rated by the AI and are always shown.
            </ANALYSIS>
            <SCORE>
            SCORE_10
            </SCORE>
            <FOLLOW_UP_QUESTIONS>
            Q_1. Rate this tweet anyway.
            Q_2. N/A
            Q_3. N/A
            </FOLLOW_UP_QUESTIONS>`;
            indicatorInstance.updateInitialReviewAndBuildHistory({
                fullContext: tweetText,
                mediaUrls: mediaUrls,
                apiResponseContent: blacklistResponse,
                reviewSystemPrompt: REVIEW_SYSTEM_PROMPT, // Assumed global
                followUpSystemPrompt: FOLLOW_UP_SYSTEM_PROMPT // Assumed global
            });
            tweetCache.set(tweetId, {
                score: 10,
                description: indicatorInstance.description,
                reasoning: "",
                questions: indicatorInstance.questions,
                lastAnswer: "",
                tweetContent: tweetText,
                mediaUrls: mediaUrls,
                streaming: false,
                blacklisted: true,
                timestamp: Date.now(),
                qaConversationHistory: indicatorInstance.qaConversationHistory
            });
        } else {
            tweetArticle.dataset.sloppinessScore = '10';
            tweetArticle.dataset.blacklisted = 'true';
            tweetArticle.dataset.ratingStatus = 'blacklisted';
            tweetArticle.dataset.ratingDescription = 'User is blacklisted';
        }
        filterSingleTweet(tweetArticle);
        return true;
    }
    const cachedRating = tweetCache.get(tweetId);
    if (cachedRating) {
        if (cachedRating.streaming === true &&
            (cachedRating.score === undefined || cachedRating.score === null)) {
            return false;
        }
        if (cachedRating.score !== undefined && cachedRating.score !== null) {
            const indicatorInstance = ScoreIndicatorRegistry.get(tweetId, tweetArticle);
            if (indicatorInstance) {
                indicatorInstance.rehydrateFromCache(cachedRating);
            } else {
                return false;
            }
            filterSingleTweet(tweetArticle);
            return true;
        } else if (!cachedRating.streaming) {
            tweetCache.delete(tweetId);
            return false;
        }
    }
    return false;
}
function isUserBlacklisted(handle) {
    if (!handle) return false;
    handle = handle.toLowerCase().trim();
    return blacklistedHandles.some(h => h.toLowerCase().trim() === handle);
}
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
            tweetArticle.dataset.ratingStatus = 'error';
            tweetArticle.dataset.ratingDescription = "No API key";
            ScoreIndicatorRegistry.get(tweetId, tweetArticle)?.update({
                status: 'error',
                score: 9,
                description: "No API key",
                questions: [],
                lastAnswer: ""
            });
            filterSingleTweet(tweetArticle);
            return;
        }
        if (authorHandle && adAuthorCache.has(authorHandle)) {
            tweetArticle.dataset.ratingStatus = 'rated';
            tweetArticle.dataset.ratingDescription = "Advertisement";
            tweetArticle.dataset.sloppinessScore = '0';
            ScoreIndicatorRegistry.get(tweetId, tweetArticle)?.update({
                status: 'rated',
                score: 0,
                description: "Advertisement from known ad author",
                questions: [],
                lastAnswer: ""
            });
            filterSingleTweet(tweetArticle);
            processingSuccessful = true;
            return;
        }
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
                description: "Advertisement",
                questions: [],
                lastAnswer: ""
            });
            filterSingleTweet(tweetArticle);
            processingSuccessful = true;
            return;
        }
        let score = 5;
        let description = "";
        let reasoning = "";
        let questions = [];
        let lastAnswer = "";
        try {
            const cachedRating = tweetCache.get(tweetId);
            if (cachedRating) {
                if (cachedRating.streaming === true &&
                    (cachedRating.score === undefined || cachedRating.score === null)) {
                }
                else if (!cachedRating.streaming && (cachedRating.score === undefined || cachedRating.score === null)) {
                    tweetCache.delete(tweetId);
                }
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
            mediaURLs = [...new Set(mediaURLs.filter(url => url.trim()))];
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
                            mediaUrls: mediaUrls // Pass mediaUrls to indicator
                        });
                        filterSingleTweet(tweetArticle);
                        return;
                    }
                    const rating = await rateTweetWithOpenRouter(fullContextWithImageDescription, tweetId, apiKey, mediaURLs, 3, tweetArticle, authorHandle);
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
                    tweetArticle.dataset.sloppinessScore = score?.toString() || '';
                    tweetArticle.dataset.ratingReasoning = reasoning;
                    ScoreIndicatorRegistry.get(tweetId, tweetArticle)?.update({
                        status: finalStatus,
                        score: score,
                        description: description,
                        reasoning: reasoning,
                        questions: questions,
                        lastAnswer: lastAnswer,
                        metadata: rating.data?.id ? { generationId: rating.data.id } : null, // Pass metadata
                        mediaUrls: mediaURLs // Pass mediaUrls to indicator
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
                    errorCacheEntry.score = score;
                    errorCacheEntry.description = description;
                    errorCacheEntry.reasoning = reasoning;
                    errorCacheEntry.questions = questions;
                    errorCacheEntry.lastAnswer = lastAnswer;
                    errorCacheEntry.error = true;
                    errorCacheEntry.streaming = false;
                    tweetCache.set(tweetId, errorCacheEntry);
                    filterSingleTweet(tweetArticle);
                    return;
                }
            }
            filterSingleTweet(tweetArticle);
        } catch (error) {
            ScoreIndicatorRegistry.get(tweetId, tweetArticle)?.update({
                status: 'error',
                score: 5,
                description: "Error during processing: " + error.message,
                questions: [],
                lastAnswer: ""
            });
            filterSingleTweet(tweetArticle);
            processingSuccessful = false;
        } finally {
            if (!processingSuccessful) {
                processedTweets.delete(tweetId);
            }
        }
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
async function scheduleTweetProcessing(tweetArticle) {
    const tweetId = getTweetID(tweetArticle);
    if (!tweetId) {
        return;
    }
    if (window.activeStreamingRequests && window.activeStreamingRequests[tweetId]) {
        return;
    }
    const handles = getUserHandles(tweetArticle);
    const authorHandle = handles.length > 0 ? handles[0] : '';
    if (authorHandle && adAuthorCache.has(authorHandle)) {
        filterSingleTweet(tweetArticle);
        return;
    }
    if (isAd(tweetArticle)) {
        if (authorHandle) {
            adAuthorCache.add(authorHandle);
        }
        filterSingleTweet(tweetArticle);
        return;
    }
    const existingInstance = ScoreIndicatorRegistry.get(tweetId);
    if (existingInstance) {
        existingInstance.ensureIndicatorAttached();
        if (isValidFinalState(existingInstance.status)) {
            filterSingleTweet(tweetArticle);
            return;
        }
        if (isValidInterimState(existingInstance.status) && processedTweets.has(tweetId)) {
            filterSingleTweet(tweetArticle);
            return;
        }
        processedTweets.delete(tweetId);
    }
    if (authorHandle && isUserBlacklisted(authorHandle)) {
        const indicatorInstance = ScoreIndicatorRegistry.get(tweetId, tweetArticle);
        if (indicatorInstance) {
            const tweetText = getElementText(tweetArticle.querySelector(TWEET_TEXT_SELECTOR)) || "[Tweet text not found]";
            const mediaUrls = await extractMediaLinks(tweetArticle);
            const blacklistResponse = `<ANALYSIS>
            This user is on the blacklist. Tweets from this user are not rated by the AI and are always shown.
            </ANALYSIS>
            <SCORE>
            SCORE_10
            </SCORE>
            <FOLLOW_UP_QUESTIONS>
            Q_1. Rate this tweet anyway.
            Q_2. N/A
            Q_3. N/A
            </FOLLOW_UP_QUESTIONS>`;
            indicatorInstance.updateInitialReviewAndBuildHistory({
                fullContext: tweetText,
                mediaUrls: mediaUrls,
                apiResponseContent: blacklistResponse,
                reviewSystemPrompt: REVIEW_SYSTEM_PROMPT, // Assumed global
                followUpSystemPrompt: FOLLOW_UP_SYSTEM_PROMPT // Assumed global
            });
            tweetCache.set(tweetId, {
                score: 10,
                description: indicatorInstance.description,
                reasoning: "",
                questions: indicatorInstance.questions,
                lastAnswer: "",
                tweetContent: tweetText,
                mediaUrls: mediaUrls,
                streaming: false,
                blacklisted: true,
                timestamp: Date.now(),
                qaConversationHistory: indicatorInstance.qaConversationHistory
            });
        } else {
            tweetArticle.dataset.sloppinessScore = '10';
            tweetArticle.dataset.blacklisted = 'true';
            tweetArticle.dataset.ratingStatus = 'blacklisted';
            tweetArticle.dataset.ratingDescription = 'User is blacklisted';
        }
        filterSingleTweet(tweetArticle);
        return;
    }
    if (tweetCache.has(tweetId)) {
        const isIncompleteStreaming =
            tweetCache.get(tweetId).streaming === true &&
            (tweetCache.get(tweetId).score === undefined || tweetCache.get(tweetId).score === null);
        if (!isIncompleteStreaming) {
            const wasApplied = await applyTweetCachedRating(tweetArticle);
            if (wasApplied) {
                return;
            }
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
            delayedProcessTweet(tweetArticle, tweetId, authorHandle);
        } catch (e) {
            processedTweets.delete(tweetId);
        }
    }, PROCESSING_DELAY_MS);
}
let threadRelationships = {};
const THREAD_CHECK_INTERVAL = 2500;
const SWEEP_INTERVAL = 1000;
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
async function buildReplyChain(tweetId, maxDepth = 5) {
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
async function getFullContext(tweetArticle, tweetId, apiKey) {
    const handles = getUserHandles(tweetArticle);
    const userHandle = handles.length > 0 ? handles[0] : '';
    const quotedHandle = handles.length > 1 ? handles[1] : '';
    const mainText = getElementText(tweetArticle.querySelector(TWEET_TEXT_SELECTOR));
    let allMediaLinks = await extractMediaLinks(tweetArticle);
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
        quotedMediaLinks = await extractMediaLinks(quoteContainer);
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
    let allAvailableMediaLinks = [...allMediaLinks];
    let mainMediaLinks = allAvailableMediaLinks.filter(link => !quotedMediaLinks.includes(link));
    let engagementStats = "";
    const engagementDiv = tweetArticle.querySelector('div[role="group"][aria-label$=" views"]');
    if (engagementDiv) {
        engagementStats = engagementDiv.getAttribute('aria-label')?.trim() || "";
    }
    let fullContextWithImageDescription = `[TWEET ${tweetId}]
 Author:@${userHandle}:
` + mainText;
    if (mainMediaLinks.length > 0) {
        if (enableImageDescriptions = browserGet('enableImageDescriptions', false)) {
            let mainMediaLinksDescription = await getImageDescription(mainMediaLinks, apiKey, tweetId, userHandle);
            fullContextWithImageDescription += `
[MEDIA_DESCRIPTION]:
${mainMediaLinksDescription}`;
        }
        fullContextWithImageDescription += `
[MEDIA_URLS]:
${mainMediaLinks.join(", ")}`;
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
            if (enableImageDescriptions) {
                let quotedMediaLinksDescription = await getImageDescription(quotedMediaLinks, apiKey, tweetId, userHandle);
                fullContextWithImageDescription += `
[QUOTED_TWEET_MEDIA_DESCRIPTION]:
${quotedMediaLinksDescription}`;
            }
            fullContextWithImageDescription += `
[QUOTED_TWEET_MEDIA_URLS]:
${quotedMediaLinks.join(", ")}`;
        }
    }
    if (document.querySelector('div[aria-label="Timeline: Conversation"]', 'div[aria-label^="Timeline: Conversation"]')) {
        const replyChain = await buildReplyChain(tweetId);
        let threadHistoryIncluded = false;
        if (conversation && conversation.dataset.threadHist) {
            if (!isOriginalTweet(tweetArticle)) {
                fullContextWithImageDescription = conversation.dataset.threadHist + `
[REPLY]
` + fullContextWithImageDescription;
                threadHistoryIncluded = true;
            }
        }
        if (replyChain.length > 0 && !threadHistoryIncluded) {
            let parentContexts = "";
            for (let i = replyChain.length - 1; i >= 0; i--) {
                const link = replyChain[i];
                const parentId = link.toId;
                const parentCache = tweetCache.get(parentId);
                const parentContent = parentCache?.tweetContent;
                if (parentContent) {
                    parentContexts = parentContent + "\n[REPLY]\n" + parentContexts;
                } else {
                    parentContexts = `[CONTEXT UNAVAILABLE FOR TWEET ${parentId} @${link.to || 'unknown'}]\n[REPLY]\n` + parentContexts;
                }
            }
            fullContextWithImageDescription = parentContexts + fullContextWithImageDescription;
        }
        const replyInfo = getTweetReplyInfo(tweetId);
        if (replyInfo && replyInfo.replyTo && !threadHistoryIncluded && replyChain.length === 0) {
            fullContextWithImageDescription = `[REPLY TO TWEET ${replyInfo.replyTo}]\n` + fullContextWithImageDescription;
        }
    }
    tweetArticle.dataset.fullContext = fullContextWithImageDescription;
    return fullContextWithImageDescription;
}
function applyFilteringToAll() {
    if (!observedTargetNode) return;
    const tweets = observedTargetNode.querySelectorAll(TWEET_ARTICLE_SELECTOR);
    tweets.forEach(filterSingleTweet);
}
function ensureAllTweetsRated() {
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
        if (threadMappingInProgress || conversation.dataset.threadHist === "pending") {
            return;
        }
        if (conversation.dataset.threadMappedAt) {
            const lastMappedTime = parseInt(conversation.dataset.threadMappedAt, 10);
            if (Date.now() - lastMappedTime < 10000) {
                return;
            }
        }
        const match = location.pathname.match(/status\/(\d+)/);
        const pageTweetId = match ? match[1] : null;
        if (!pageTweetId) return;
        let rootTweetId = pageTweetId;
        while (threadRelationships[rootTweetId] && threadRelationships[rootTweetId].replyTo) {
            rootTweetId = threadRelationships[rootTweetId].replyTo;
        }
        if (conversation.dataset.threadHist === undefined) {
            threadHist = "";
            const rootArticle = Array.from(conversation.querySelectorAll('article[data-testid="tweet"]'))
                .find(el => getTweetID(el) === rootTweetId)
                || document.querySelector('article[data-testid="tweet"]');
            if (rootArticle) {
                conversation.dataset.threadHist = 'pending';
                threadMappingInProgress = true;
                try {
                    const tweetId = getTweetID(rootArticle);
                    if (!tweetId) {
                        throw new Error("Failed to get tweet ID from first article");
                    }
                    const apiKey = browserGet('openrouter-api-key', '');
                    const fullcxt = await getFullContext(rootArticle, tweetId, apiKey);
                    if (!fullcxt) {
                        throw new Error("Failed to get full context for root tweet");
                    }
                    threadHist = fullcxt;
                    conversation.dataset.threadHist = threadHist;
                    if (conversation.firstChild) {
                        conversation.firstChild.dataset.canary = "true";
                    }
                    if (!processedTweets.has(tweetId)) {
                        scheduleTweetProcessing(rootArticle);
                    }
                    setTimeout(() => {
                        mapThreadStructure(conversation, rootTweetId);
                    }, 10);
                } catch (error) {
                    threadMappingInProgress = false;
                    delete conversation.dataset.threadHist;
                }
                return;
            }
        } else if (conversation.dataset.threadHist !== "pending" &&
            conversation.firstChild &&
            conversation.firstChild.dataset.canary === undefined) {
            if (conversation.firstChild) {
                conversation.firstChild.dataset.canary = "pending";
            }
            threadMappingInProgress = true;
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
                setTimeout(() => {
                    mapThreadStructure(conversation, rootTweetId);
                }, 500);
            } catch (error) {
                threadMappingInProgress = false;
                if (conversation.firstChild) {
                    delete conversation.firstChild.dataset.canary;
                }
            }
        } else if (!threadMappingInProgress && !conversation.dataset.threadMappingInProgress) {
            threadMappingInProgress = true;
            setTimeout(() => {
                mapThreadStructure(conversation, rootTweetId);
            }, 250);
        }
    } catch (error) {
        threadMappingInProgress = false;
    }
}
async function mapThreadStructure(conversation, localRootTweetId) {
    conversation.dataset.threadMappingInProgress = "true";
    conversation.dataset.threadMappedAt = Date.now().toString();
    threadMappingInProgress = true;
    try {
        const timeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Thread mapping timed out')), 5000)
        );
        const mapping = async () => {
            let cellDivs = Array.from(document.querySelectorAll('div[data-testid="cellInnerDiv"]'));
            if (!cellDivs.length) {
                delete conversation.dataset.threadMappingInProgress;
                threadMappingInProgress = false;
                return;
            }
            let tweetCells = [];
            let processedCount = 0;
            for (let idx = 0; idx < cellDivs.length; idx++) {
                const cell = cellDivs[idx];
                const article = cell.querySelector('article[data-testid="tweet"]');
                if (!article) continue;
                try {
                    let tweetId = getTweetID(article);
                    if (!tweetId) {
                        let tweetLink = article.querySelector('a[href*="/status/"]');
                        if (tweetLink) {
                            let match = tweetLink.href.match(/status\/(\d+)/);
                            if (match) tweetId = match[1];
                        }
                    }
                    if (!tweetId) continue;
                    const handles = getUserHandles(article);
                    let username = handles.length > 0 ? handles[0] : null;
                    if (!username) continue;
                    let tweetTextSpan = article.querySelector('[data-testid="tweetText"]');
                    let text = tweetTextSpan ? tweetTextSpan.innerText.trim().replace(/\n+/g, ' ⏎ ') : '';
                    let mediaLinks = await extractMediaLinks(article);
                    let quotedMediaLinks = [];
                    const quoteContainer = article.querySelector(QUOTE_CONTAINER_SELECTOR);
                    if (quoteContainer) {
                        quotedMediaLinks = await extractMediaLinks(quoteContainer);
                    }
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
                    if (!processedTweets.has(tweetId)) {
                        scheduleTweetProcessing(article);
                    }
                } catch (err) {
                    continue;
                }
            }
            if (tweetCells.length === 0) {
                delete conversation.dataset.threadMappingInProgress;
                threadMappingInProgress = false;
                return;
            }
            for (let i = 0; i < tweetCells.length; ++i) {
                let tw = tweetCells[i];
                const persistentRelation = threadRelationships[tw.tweetId];
                if (tw.tweetId === localRootTweetId) {
                    tw.replyTo = null;
                    tw.replyToId = null;
                    tw.isRoot = true;
                } else if (persistentRelation && persistentRelation.replyTo) {
                    tw.replyTo = persistentRelation.to;
                    tw.replyToId = persistentRelation.replyTo;
                    tw.isRoot = false;
                } else if (tw.isReplyToRoot) {
                    let root = tweetCells.find(tk => tk.tweetId === localRootTweetId);
                    tw.replyTo = root ? root.username : null;
                    tw.replyToId = root ? root.tweetId : null;
                    tw.isRoot = false;
                } else if (i > 0) {
                    tw.replyTo = tweetCells[i - 1].username;
                    tw.replyToId = tweetCells[i - 1].tweetId;
                    tw.isRoot = false;
                } else {
                    tw.replyTo = null;
                    tw.replyToId = null;
                    tw.isRoot = false;
                }
            }
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
            for (let tw of tweetCells) {
                if (!tw.replyToId && !tw.isRoot && threadRelationships[tw.tweetId]?.replyTo) {
                    tw.replyToId = threadRelationships[tw.tweetId].replyTo;
                    tw.replyTo = threadRelationships[tw.tweetId].to;
                    const doc = replyDocs.find(d => d.tweetId === tw.tweetId);
                    if (doc) {
                        doc.toId = tw.replyToId;
                        doc.to = tw.replyTo;
                    }
                }
            }
            conversation.dataset.threadMapping = JSON.stringify(replyDocs);
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
            let completeThreadHistory = "";
            const rootTweet = replyDocs.find(t => t.isRoot === true);
            if (rootTweet && rootTweet.tweetId) {
                const rootTweetElement = tweetCells.find(t => t.tweetId === rootTweet.tweetId)?.tweetNode;
                if (rootTweetElement) {
                    try {
                        const apiKey = browserGet('openrouter-api-key', '');
                        const rootContext = await getFullContext(rootTweetElement, rootTweet.tweetId, apiKey);
                        if (rootContext) {
                            completeThreadHistory = rootContext;
                            conversation.dataset.threadHist = completeThreadHistory;
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
                    }
                }
            }
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
        delete conversation.dataset.threadMappedAt;
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
setInterval(applyFilteringToAll, SWEEP_INTERVAL);
    // ----- api/api_requests.js -----
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
            let streamTimeout = null;
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
                    let filteredModels = data.data.models.filter(model => model.endpoint && model.endpoint !== null);
                    filteredModels.forEach(model => {
                        const endpointPricing = model.endpoint?.pricing;
                        const isFree = !endpointPricing || (
                            (endpointPricing.completion == null || parseFloat(endpointPricing.completion) === 0) &&
                            (endpointPricing.prompt == null || parseFloat(endpointPricing.prompt) === 0)
                        );
                        if (isFree && model.slug && !model.slug.endsWith(':free')) {
                            model.slug += ':free';
                        }
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
            showStatus('Error fetching models!');
        }
    });
}
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
async function getGenerationMetadata(generationId, apiKey, timeout = 10000) {
    return new Promise((resolve) => {
        GM_xmlhttpRequest({
            method: "GET",
            url: `https://openrouter.ai/api/v1/generation?id=${generationId}`,
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "HTTP-Referer": "https://greasyfork.org/en/scripts/532459-tweetfilter-ai", // Use your script's URL
                "X-Title": "TweetFilter-AI" // Replace with your script's name
            },
            timeout: timeout,
            onload: function(response) {
                if (response.status >= 200 && response.status < 300) {
                    try {
                        const data = JSON.parse(response.responseText);
                        resolve({
                            error: false,
                            message: "Metadata fetched successfully",
                            data: data // The structure is { data: { ...metadata... } }
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
                         status: 404, // Indicate not found specifically for retry logic
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
async function rateTweetWithOpenRouter(tweetText, tweetId, apiKey, mediaUrls, maxRetries = 3, tweetArticle = null, authorHandle="") {
    const cleanupRequest = () => {
        pendingRequests = Math.max(0, pendingRequests - 1);
        showStatus(`Rating tweet... (${pendingRequests} pending)`);
    };
    const indicatorInstance = ScoreIndicatorRegistry.get(tweetId, tweetArticle);
    if (!indicatorInstance) {
        return {
            score: 5, // Default error score
            content: "Failed to initialize UI components for rating.",
            reasoning: "",
            questions: [],
            lastAnswer: "",
            error: true,
            cached: false,
            data: null,
            qaConversationHistory: [] // Empty history
        };
    }
    if (adAuthorCache.has(authorHandle)) {
        indicatorInstance.updateInitialReviewAndBuildHistory({
            fullContext: tweetText, // or a specific ad message
            mediaUrls: [],
            apiResponseContent: "<ANALYSIS>This tweet is from an ad author.</ANALYSIS><SCORE>SCORE_0</SCORE><FOLLOW_UP_QUESTIONS>Q_1. N/A\\nQ_2. N/A\\nQ_3. N/A</FOLLOW_UP_QUESTIONS>",
            reviewSystemPrompt: REVIEW_SYSTEM_PROMPT, // Globally available from config.js
            followUpSystemPrompt: FOLLOW_UP_SYSTEM_PROMPT // Globally available from config.js
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
    const requestBody = {
        model: selectedModel,
        messages: [
            {
                role: "system",
                content: [{ type: "text", text: REVIEW_SYSTEM_PROMPT}]
            },
            {
                role: "user",
                content: [
                    { 
                        type: "text", 
                        text: `<TARGET_TWEET_ID>[${tweetId}]</TARGET_TWEET_ID>
<USER_INSTRUCTIONS>[${currentInstructions}]</USER_INSTRUCTIONS>
<TWEET>[${tweetText}]</TWEET>
Follow this expected response format exactly, or you break the UI:
<EXPECTED_RESPONSE_FORMAT>
  <ANALYSIS>
    (Your analysis according to the user instructions.)
  </ANALYSIS>
  <SCORE>
    SCORE_X (Where X is a number between 0 and 10)
  </SCORE>
  <FOLLOW_UP_QUESTIONS>
    Q_1. …
    Q_2. …
    Q_3. …
  </FOLLOW_UP_QUESTIONS>
</EXPECTED_RESPONSE_FORMAT>
`
                    }
                ]
            }
        ],
        temperature: modelTemperature,
        top_p: modelTopP,
        max_tokens: maxTokens
    };
    if (selectedModel.includes('gemini')) {
        requestBody.config = { safetySettings: safetySettings };
    }
    if (mediaUrls?.length > 0 && modelSupportsImages(selectedModel)) {
        mediaUrls.forEach(url => {
            requestBody.messages[1].content.push({
                type: "image_url",
                image_url: { "url": url }
            });
        });
    }
    if (providerSort) {
        requestBody.provider = { sort: providerSort, allow_fallbacks: true };
    }
    const useStreaming = browserGet('enableStreaming', false);
    tweetCache.set(tweetId, {
        streaming: true,
        timestamp: Date.now(),
        tweetContent: tweetText, // Store original tweet text for context
        mediaUrls: mediaUrls     // Store original media URLs
    });
    let attempt = 0;
    while (attempt < maxRetries) {
        attempt++;
        const now = Date.now();
        const timeElapsed = now - lastAPICallTime;
        if (timeElapsed < API_CALL_DELAY_MS) {
            await new Promise(resolve => setTimeout(resolve, API_CALL_DELAY_MS - timeElapsed));
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
                    fullContext: tweetText, // The full text of the tweet that was rated
                    mediaUrls: mediaUrls,   // The media URLs associated with that tweet
                    apiResponseContent: result.content,
                    reviewSystemPrompt: REVIEW_SYSTEM_PROMPT,
                    followUpSystemPrompt: FOLLOW_UP_SYSTEM_PROMPT
                });
                const finalScore = indicatorInstance.score;
                const finalQuestions = indicatorInstance.questions;
                const finalDescription = indicatorInstance.description;
                const finalQaHistory = indicatorInstance.qaConversationHistory;
                tweetCache.set(tweetId, {
                    score: finalScore,
                    description: finalDescription, // Analysis
                    reasoning: result.reasoning || "", // If rateTweet/Streaming provide it separately
                    questions: finalQuestions,
                    lastAnswer: "",
                    tweetContent: tweetText, 
                    mediaUrls: mediaUrls,
                    streaming: false,
                    timestamp: Date.now(),
                    metadata: result.data?.id ? { generationId: result.data.id } : null,
                    qaConversationHistory: finalQaHistory // Store the history
                });
                return {
                    score: finalScore,
                    content: result.content, // Keep raw content for direct use if needed
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
                    followUpSystemPrompt: FOLLOW_UP_SYSTEM_PROMPT
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
        followUpSystemPrompt: FOLLOW_UP_SYSTEM_PROMPT
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
async function getCustomInstructionsDescription(instructions) {
    const INSTRUCTION_SUMMARY_MODEL = "google/gemini-2.5-flash-preview";
    const request={
        model: INSTRUCTION_SUMMARY_MODEL,
        messages: [{
            role: "system",
            content: [{
                type: "text",
                text: `
                Please come up with a 5-word summary of the following instructions.
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
        let aggregatedQuestions = existingCache?.questions || [];
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
            tweetId  // Pass the tweet ID to associate with this request
        );
    });
}
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
                completionTokens: meta.tokens_completion || 0, // Use this for total completion output
                reasoningTokens: meta.native_tokens_reasoning || 0, // Specific reasoning tokens if available
                latency: meta.latency !== undefined ? (meta.latency / 1000).toFixed(2) + 's' : 'N/A', // Convert ms to s
                mediaInputs: meta.num_media_prompt || 0,
                price: meta.total_cost !== undefined ? `$${meta.total_cost.toFixed(6)}` : 'N/A' // Add total cost
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
async function answerFollowUpQuestion(tweetId, qaHistoryForApiCall, apiKey, tweetArticle, indicatorInstance) {
    const questionText = qaHistoryForApiCall.find(m => m.role === 'user' && m === qaHistoryForApiCall[qaHistoryForApiCall.length - 1])?.content.find(c => c.type === 'text')?.text || "User's question";
    const useStreaming = browserGet('enableStreaming', false);
    const request = {
        model: selectedModel,//was using :online but the search results are irrelevant
        messages: qaHistoryForApiCall, // The entire history IS the messages array
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
        let finalAnswerContent = "*Processing...*";
        let finalQaHistory = [...qaHistoryForApiCall];
        if (useStreaming) {
            await new Promise((resolve, reject) => {
                 let aggregatedContent = "";
                 getCompletionStreaming(
                     request, apiKey,
                     (chunkData) => {
                         aggregatedContent = chunkData.content || aggregatedContent;
                         indicatorInstance._renderStreamingAnswer(aggregatedContent, "");
                     },
                     (result) => {
                         finalAnswerContent = result.content || aggregatedContent;
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
                         resolve();
                     },
                     (error) => {
                         const errorMessage = `Error generating answer: ${error.message}`;
                         indicatorInstance._updateConversationHistory(questionText, errorMessage); 
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
        indicatorInstance._updateConversationHistory(questionText, errorMessage);
        indicatorInstance.questions = tweetCache.get(tweetId)?.questions || [];
        indicatorInstance._updateTooltipUI();
        const currentCache = tweetCache.get(tweetId) || {};
        currentCache.lastAnswer = errorMessage;
        currentCache.timestamp = Date.now();
        tweetCache.set(tweetId, currentCache);
    }
}
    // ----- twitter-desloppifier.js -----
const VERSION = '1.5'; 
(function () {
    'use strict';
    let menuhtml = GM_getResourceText("MENU_HTML");
    browserSet('menuHTML', menuhtml);
    let firstRun = browserGet('firstRun', true);
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
            });
        } else {
            setTimeout(initializeObserver, 1000);
        }
    }
    initializeObserver();
})();
})();
