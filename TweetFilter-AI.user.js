// ==UserScript==
// @name         TweetFilter AI
// @namespace    http://tampermonkey.net/
// @version      Version 1.3.6.2
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
    const MENU = `<style>
/*
        Modern X-Inspired Styles - Enhanced
        ---------------------------------
    */

    /* Main tweet filter container */
    #tweet-filter-container {
        position: fixed;
        top: 70px;
        right: 15px;
        background-color: rgba(22, 24, 28, 0.95);
        color: #e7e9ea;
        padding: 10px 12px;
        border-radius: 12px;
        z-index: 9999;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 13px;
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        gap: 10px;
        border: 1px solid rgba(255, 255, 255, 0.1);
    }

    /* Close button styles */
    .close-button {
        background: none;
        border: none;
        color: #e7e9ea;
        font-size: 16px;
        cursor: pointer;
        padding: 0;
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0.8;
        transition: opacity 0.2s;
        border-radius: 50%;
        /* Enhanced touch target and mobile styles */
        min-width: 28px;
        min-height: 28px;
        -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
        user-select: none;
        z-index: 30;
    }

    .close-button:hover {
        opacity: 1;
        background-color: rgba(255, 255, 255, 0.1);
    }

    /* Hidden state */
    .hidden {
        display: none !important;
    }

    /* Show/hide button */
    .toggle-button {
        position: fixed;
        right: 15px;
        background-color: rgba(22, 24, 28, 0.95);
        color: #e7e9ea;
        padding: 8px 12px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 12px;
        z-index: 9999;
        border: 1px solid rgba(255, 255, 255, 0.1);
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.5);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        display: flex;
        align-items: center;
        gap: 6px;
        transition: all 0.2s ease;
    }
    
    .toggle-button:hover {
        background-color: rgba(29, 155, 240, 0.2);
    }

    #filter-toggle {
        top: 70px;
    }

    #settings-toggle {
        top: 120px;
    }

    #tweet-filter-container label {
        margin: 0;
        font-weight: bold;
    }

    #tweet-filter-slider {
        cursor: pointer;
        width: 120px;
        vertical-align: middle;
        -webkit-appearance: none;
        appearance: none;
        height: 6px;
        border-radius: 3px;
        background: linear-gradient(to right,
            #FF0000 0%,
            #FF8800 calc(var(--slider-percent, 50%) * 0.166),
            #FFFF00 calc(var(--slider-percent, 50%) * 0.333),
            #00FF00 calc(var(--slider-percent, 50%) * 0.5),
            #00FFFF calc(var(--slider-percent, 50%) * 0.666),
            #0000FF calc(var(--slider-percent, 50%) * 0.833),
            #800080 var(--slider-percent, 50%),
            #DEE2E6 var(--slider-percent, 50%),
            #DEE2E6 100%
        );
    }

    #tweet-filter-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: #1d9bf0;
        cursor: pointer;
        border: 2px solid white;
        box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        transition: transform 0.1s;
    }

    #tweet-filter-slider::-webkit-slider-thumb:hover {
        transform: scale(1.2);
    }

    #tweet-filter-slider::-moz-range-thumb {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: #1d9bf0;
        cursor: pointer;
        border: 2px solid white;
        box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        transition: transform 0.1s;
    }

    #tweet-filter-slider::-moz-range-thumb:hover {
        transform: scale(1.2);
    }

    #tweet-filter-value {
        min-width: 20px;
        text-align: center;
        font-weight: bold;
        background-color: rgba(255, 255, 255, 0.1);
        padding: 2px 5px;
        border-radius: 4px;
    }

    /* Settings UI with Tabs */
    #settings-container {
        position: fixed;
        top: 70px;
        right: 15px;
        background-color: rgba(22, 24, 28, 0.95);
        color: #e7e9ea;
        padding: 0; /* Remove padding to accommodate sticky header */
        border-radius: 16px;
        z-index: 9999;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 13px;
        box-shadow: 0 2px 18px rgba(0, 0, 0, 0.6);
        display: flex;
        flex-direction: column;
        width: 90vw; /* Default width for mobile */
        max-width: 380px; /* Default max-width for mobile */
        max-height: 85vh;
        overflow: hidden; /* Hide overflow to make the sticky header work properly */
        border: 1px solid rgba(255, 255, 255, 0.1);
        line-height: 1.3;
        transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        transform-origin: top right;
    }
    
    #settings-container.hidden {
        opacity: 0;
        transform: scale(0.9);
        pointer-events: none;
    }
    
    /* Header section */
    .settings-header {
        padding: 12px 15px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        display: flex;
        justify-content: space-between;
        align-items: center;
        position: sticky;
        top: 0;
        background-color: rgba(22, 24, 28, 0.98);
        z-index: 20;
        border-radius: 16px 16px 0 0;
    }
    
    .settings-title {
        font-weight: bold;
        font-size: 16px;
    }
    
    /* Content area with scrolling */
    .settings-content {
        overflow-y: auto;
        max-height: calc(85vh - 110px); /* Account for header and tabs */
        padding: 0;
    }
    
    /* Scrollbar styling for settings container */
    .settings-content::-webkit-scrollbar {
        width: 6px;
    }

    .settings-content::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.05);
        border-radius: 3px;
    }

    .settings-content::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 3px;
    }

    .settings-content::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.3);
    }

    /* Tab Navigation */
    .tab-navigation {
        display: flex;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        position: sticky;
        top: 0;
        background-color: rgba(22, 24, 28, 0.98);
        z-index: 10;
        padding: 10px 15px;
        gap: 8px;
    }

    .tab-button {
        padding: 6px 10px;
        background: none;
        border: none;
        color: #e7e9ea;
        font-weight: bold;
        cursor: pointer;
        border-radius: 8px;
        transition: all 0.2s ease;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 13px;
        flex: 1;
        text-align: center;
    }

    .tab-button:hover {
        background-color: rgba(255, 255, 255, 0.1);
    }

    .tab-button.active {
        color: #1d9bf0;
        background-color: rgba(29, 155, 240, 0.1);
        border-bottom: 2px solid #1d9bf0;
    }

    /* Tab Content */
    .tab-content {
        display: none;
        animation: fadeIn 0.3s ease;
        padding: 15px;
    }
    
    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }

    .tab-content.active {
        display: block;
    }

    /* Enhanced dropdowns */
    .select-container {
        position: relative;
        margin-bottom: 15px;
    }
    
    .select-container .search-field {
        position: sticky;
        top: 0;
        background-color: rgba(39, 44, 48, 0.95);
        padding: 8px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        z-index: 1;
    }
    
    .select-container .search-input {
        width: 100%;
        padding: 8px 10px;
        border-radius: 8px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        background-color: rgba(39, 44, 48, 0.9);
        color: #e7e9ea;
        font-size: 12px;
        transition: border-color 0.2s;
    }
    
    .select-container .search-input:focus {
        border-color: #1d9bf0;
        outline: none;
    }
    
    .custom-select {
        position: relative;
        display: inline-block;
        width: 100%;
    }
    
    .select-selected {
        background-color: rgba(39, 44, 48, 0.95);
        color: #e7e9ea;
        padding: 10px 12px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 8px;
        cursor: pointer;
        user-select: none;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 13px;
        transition: border-color 0.2s;
    }
    
    .select-selected:hover {
        border-color: rgba(255, 255, 255, 0.4);
    }
    
    .select-selected:after {
        content: "";
        width: 8px;
        height: 8px;
        border: 2px solid #e7e9ea;
        border-width: 0 2px 2px 0;
        display: inline-block;
        transform: rotate(45deg);
        margin-left: 10px;
        transition: transform 0.2s;
    }
    
    .select-selected.select-arrow-active:after {
        transform: rotate(-135deg);
    }
    
    .select-items {
        position: absolute;
        background-color: rgba(39, 44, 48, 0.98);
        top: 100%;
        left: 0;
        right: 0;
        z-index: 99;
        max-height: 300px;
        overflow-y: auto;
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 8px;
        margin-top: 5px;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
        display: none;
    }
    
    .select-items div {
        color: #e7e9ea;
        padding: 10px 12px;
        cursor: pointer;
        user-select: none;
        transition: background-color 0.2s;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }
    
    .select-items div:hover {
        background-color: rgba(29, 155, 240, 0.1);
    }
    
    .select-items div.same-as-selected {
        background-color: rgba(29, 155, 240, 0.2);
    }
    
    /* Scrollbar for select items */
    .select-items::-webkit-scrollbar {
        width: 6px;
    }
    
    .select-items::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.05);
    }
    
    .select-items::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 3px;
    }
    
    .select-items::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.3);
    }
    
    /* Form elements */
    #openrouter-api-key,
    #user-instructions {
        width: 100%;
        padding: 10px 12px;
        border-radius: 8px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        margin-bottom: 12px;
        background-color: rgba(39, 44, 48, 0.95);
        color: #e7e9ea;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 13px;
        transition: border-color 0.2s;
    }
    
    #openrouter-api-key:focus,
    #user-instructions:focus {
        border-color: #1d9bf0;
        outline: none;
    }

    #user-instructions {
        height: 120px;
        resize: vertical;
    }

    /* Parameter controls */
    .parameter-row {
        display: flex;
        align-items: center;
        margin-bottom: 12px;
        gap: 8px;
        padding: 6px;
        border-radius: 8px;
        transition: background-color 0.2s;
    }
    
    .parameter-row:hover {
        background-color: rgba(255, 255, 255, 0.05);
    }

    .parameter-label {
        flex: 1;
        font-size: 13px;
        color: #e7e9ea;
    }

    .parameter-control {
        flex: 1.5;
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .parameter-value {
        min-width: 28px;
        text-align: center;
        background-color: rgba(255, 255, 255, 0.1);
        padding: 3px 5px;
        border-radius: 4px;
        font-size: 12px;
    }

    .parameter-slider {
        flex: 1;
        -webkit-appearance: none;
        height: 4px;
        border-radius: 4px;
        background: rgba(255, 255, 255, 0.2);
        outline: none;
        cursor: pointer;
    }

    .parameter-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: #1d9bf0;
        cursor: pointer;
        transition: transform 0.1s;
    }
    
    .parameter-slider::-webkit-slider-thumb:hover {
        transform: scale(1.2);
    }

    /* Section styles */
    .section-title {
        font-weight: bold;
        margin-top: 20px;
        margin-bottom: 8px;
        color: #e7e9ea;
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 14px;
    }
    
    .section-title:first-child {
        margin-top: 0;
    }

    .section-description {
        font-size: 12px;
        margin-bottom: 8px;
        opacity: 0.8;
        line-height: 1.4;
    }
    
    /* Advanced options section */
    .advanced-options {
        margin-top: 5px;
        margin-bottom: 15px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        padding: 12px;
        background-color: rgba(255, 255, 255, 0.03);
        overflow: hidden;
    }
    
    .advanced-toggle {
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: pointer;
        margin-bottom: 5px;
    }
    
    .advanced-toggle-title {
        font-weight: bold;
        font-size: 13px;
        color: #e7e9ea;
    }
    
    .advanced-toggle-icon {
        transition: transform 0.3s;
    }
    
    .advanced-toggle-icon.expanded {
        transform: rotate(180deg);
    }
    
    .advanced-content {
        max-height: 0;
        overflow: hidden;
        transition: max-height 0.3s ease-in-out;
    }
    
    .advanced-content.expanded {
        max-height: 300px;
    }

    /* Handle list styling */
    .handle-list {
        margin-top: 10px;
        max-height: 120px;
        overflow-y: auto;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        padding: 5px;
    }

    .handle-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 6px 10px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 4px;
        transition: background-color 0.2s;
    }
    
    .handle-item:hover {
        background-color: rgba(255, 255, 255, 0.05);
    }

    .handle-item:last-child {
        border-bottom: none;
    }

    .handle-text {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 12px;
    }

    .remove-handle {
        background: none;
        border: none;
        color: #ff5c5c;
        cursor: pointer;
        font-size: 14px;
        padding: 0 3px;
        opacity: 0.7;
        transition: opacity 0.2s;
    }
    
    .remove-handle:hover {
        opacity: 1;
    }

    .add-handle-btn {
        background-color: #1d9bf0;
        color: white;
        border: none;
        border-radius: 6px;
        padding: 7px 10px;
        cursor: pointer;
        font-weight: bold;
        font-size: 12px;
        margin-left: 5px;
        transition: background-color 0.2s;
    }
    
    .add-handle-btn:hover {
        background-color: #1a8cd8;
    }

    /* Button styling */
    .settings-button {
        background-color: #1d9bf0;
        color: white;
        border: none;
        border-radius: 8px;
        padding: 10px 14px;
        cursor: pointer;
        font-weight: bold;
        transition: background-color 0.2s;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        margin-top: 8px;
        width: 100%;
        font-size: 13px;
    }

    .settings-button:hover {
        background-color: #1a8cd8;
    }

    .settings-button.secondary {
        background-color: rgba(255, 255, 255, 0.1);
    }
    
    .settings-button.secondary:hover {
        background-color: rgba(255, 255, 255, 0.15);
    }

    .settings-button.danger {
        background-color: #ff5c5c;
    }

    .settings-button.danger:hover {
        background-color: #e53935;
    }
    
    /* For smaller buttons that sit side by side */
    .button-row {
        display: flex;
        gap: 8px;
        margin-top: 10px;
    }
    
    .button-row .settings-button {
        margin-top: 0;
    }
    
    /* Stats display */
    .stats-container {
        background-color: rgba(255, 255, 255, 0.05);
        padding: 10px;
        border-radius: 8px;
        margin-bottom: 15px;
    }
    
    .stats-row {
        display: flex;
        justify-content: space-between;
        padding: 5px 0;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .stats-row:last-child {
        border-bottom: none;
    }
    
    .stats-label {
        font-size: 12px;
        opacity: 0.8;
    }
    
    .stats-value {
        font-weight: bold;
    }

    /* Rating indicator shown on tweets */ 
    .score-indicator {
        position: absolute;
        top: 10px;
        right: 10.5%;
        background-color: rgba(22, 24, 28, 0.9);
        color: #e7e9ea;
        padding: 4px 10px;
        border-radius: 8px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 14px;
        font-weight: bold;
        z-index: 100;
        cursor: pointer;
        border: 1px solid rgba(255, 255, 255, 0.1);
        min-width: 20px;
        text-align: center;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        transition: transform 0.15s ease;
    }
    
    .score-indicator:hover {
        transform: scale(1.05);
    }

    /* Mobile indicator positioning */
    .score-indicator.mobile-indicator {
        position: absolute !important;
        bottom: 3% !important;
        right: 10px !important;
        top: auto !important;
    }

    /* Base description box styles */
    .score-description {
        display: none;
        background-color: rgba(22, 24, 28, 0.95);
        color: #e7e9ea;
        padding: 0 20px 16px 20px; /* Remove top padding */
        border-radius: 12px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 16px;
        line-height: 1.5;
        z-index: 99999999;
        position: absolute;
        width: 550px !important;
        max-width: 80vw !important;
        max-height: 60vh;
        overflow-y: auto;
        border: 1px solid rgba(255, 255, 255, 0.1);
        word-wrap: break-word;
        box-sizing: border-box !important;
    }

    .score-description.pinned {
        border: 2px solid #1d9bf0 !important;
    }

    /* Tooltip controls */
    .tooltip-controls {
        display: flex !important;
        justify-content: flex-end !important;
        margin: 0 -20px 15px -20px !important;
        position: sticky !important;
        top: 0 !important;
        background-color: rgba(39, 44, 48, 0.95) !important;
        padding: 12px 15px !important;
        z-index: 2 !important;
        border-top-left-radius: 12px !important;
        border-top-right-radius: 12px !important;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
        backdrop-filter: blur(5px) !important;
    }

    .tooltip-pin-button,
    .tooltip-copy-button {
        background: none !important;
        border: none !important;
        color: #8899a6 !important;
        cursor: pointer !important;
        font-size: 16px !important;
        padding: 4px 8px !important;
        margin-left: 8px !important;
        border-radius: 4px !important;
        transition: all 0.2s !important;
    }

    .tooltip-pin-button:hover,
    .tooltip-copy-button:hover {
        background-color: rgba(29, 155, 240, 0.1) !important;
        color: #1d9bf0 !important;
    }

    .tooltip-pin-button:active,
    .tooltip-copy-button:active {
        transform: scale(0.95) !important;
    }

    /* Description text container needs padding to account for sticky header */
    .description-text {
        margin: 0 0 25px 0 !important;
        font-size: 15px !important;
        line-height: 1.6 !important;
        max-width: 100% !important;
        overflow-wrap: break-word !important;
        padding: 5px 0 !important;
    }

    .tooltip-bottom-spacer {
        height: 30px !important;
        width: 100% !important;
        margin-bottom: 10px !important;
    }

    /* Reasoning dropdown */
    .reasoning-dropdown {
        margin-top: 15px !important;
        border-top: 1px solid rgba(255, 255, 255, 0.1) !important;
        padding-top: 10px !important;
    }

    .reasoning-toggle {
        display: flex !important;
        align-items: center !important;
        color: #1d9bf0 !important;
        cursor: pointer !important;
        font-weight: bold !important;
        padding: 5px !important;
        user-select: none !important;
    }

    .reasoning-toggle:hover {
        background-color: rgba(29, 155, 240, 0.1) !important;
        border-radius: 4px !important;
    }

    .reasoning-arrow {
        display: inline-block !important;
        margin-right: 5px !important;
        transition: transform 0.2s ease !important;
    }

    .reasoning-content {
        max-height: 0 !important;
        overflow: hidden !important;
        transition: max-height 0.3s ease-out, padding 0.3s ease-out !important;
        background-color: rgba(0, 0, 0, 0.15) !important;
        border-radius: 5px !important;
        margin-top: 5px !important;
        padding: 0 !important;
    }

    .reasoning-dropdown.expanded .reasoning-content {
        max-height: 350px !important;
        overflow-y: auto !important;
        padding: 10px !important;
    }

    .reasoning-dropdown.expanded .reasoning-arrow {
        transform: rotate(90deg) !important;
    }

    .reasoning-text {
        font-size: 14px !important;
        line-height: 1.4 !important;
        color: #ccc !important;
        margin: 0 !important;
        padding: 5px !important;
    }

    /* Scroll to bottom button */
    .scroll-to-bottom-button {
        position: sticky;
        bottom: 0;
        width: 100%;
        background-color: rgba(29, 155, 240, 0.9);
        color: white;
        text-align: center;
        padding: 8px 0;
        cursor: pointer;
        font-weight: bold;
        border-top: 1px solid rgba(255, 255, 255, 0.2);
        margin-top: 10px;
        z-index: 100;
        transition: background-color 0.2s;
    }

    .scroll-to-bottom-button:hover {
        background-color: rgba(29, 155, 240, 1);
    }

    /* Mobile specific styles */
    @media (max-width: 600px) {
        .score-indicator {
            position: absolute !important;
            bottom: 3% !important;
            right: 10px !important;
            top: auto !important;
        }

        .score-description {
            width: 90vw !important;
            max-width: 90vw !important;
            max-height: 60vh !important;
            left: 5vw !important;
            right: 5vw !important;
            margin: 0 auto !important;
            padding: 12px !important;
            box-sizing: border-box !important;
            overflow-y: auto !important;
            -webkit-overflow-scrolling: touch !important;
            overscroll-behavior: contain !important;
            transform: translateZ(0) !important; /* Force GPU acceleration */
        }

        .reasoning-dropdown.expanded .reasoning-content {
            max-height: 200px !important;
        }

        .close-button {
            width: 32px;
            height: 32px;
            min-width: 32px;
            min-height: 32px;
            font-size: 18px;
            padding: 8px;
            margin: -4px;  /* Compensate for larger padding while maintaining alignment */
        }
        
        /* Ensure header close button is properly positioned */
        .settings-header .close-button {
            position: relative;
            right: 0;
        }
    }

    /* Existing styles */
    
    /* Sort container styles */
    .sort-container {
        margin: 10px 0;
        display: flex;
        align-items: center;
        gap: 10px;
        justify-content: space-between;
    }
    
    .sort-container label {
        font-size: 14px;
        color: var(--text-color);
        white-space: nowrap;
    }

    .sort-container .controls-group {
        display: flex;
        gap: 8px;
        align-items: center;
    }
    
    .sort-container select {
        padding: 5px 10px;
        border-radius: 4px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        background-color: rgba(39, 44, 48, 0.95);
        color: #e7e9ea;
        font-size: 14px;
        cursor: pointer;
        min-width: 120px;
    }
    
    .sort-container select:hover {
        border-color: #1d9bf0;
    }
    
    .sort-container select:focus {
        outline: none;
        border-color: #1d9bf0;
        box-shadow: 0 0 0 2px rgba(29, 155, 240, 0.2);
    }

    .sort-toggle {
        padding: 5px 10px;
        border-radius: 4px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        background-color: rgba(39, 44, 48, 0.95);
        color: #e7e9ea;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .sort-toggle:hover {
        border-color: #1d9bf0;
        background-color: rgba(29, 155, 240, 0.1);
    }

    .sort-toggle.active {
        background-color: rgba(29, 155, 240, 0.2);
        border-color: #1d9bf0;
    }

    /* Dropdown option styling */
    .sort-container select option {
        background-color: rgba(39, 44, 48, 0.95);
        color: #e7e9ea;
    }

    /* Desktop-specific width */
    @media (min-width: 601px) {
        #settings-container {
            width: 480px;
            max-width: 480px;
        }
    }

    /* Handle input styling */
    #handle-input {
        flex: 1;
        padding: 8px 12px;
        border-radius: 8px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        background-color: rgba(39, 44, 48, 0.95);
        color: #e7e9ea;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 14px;
        transition: border-color 0.2s;
        min-width: 200px;
    }

    #handle-input:focus {
        outline: none;
        border-color: #1d9bf0;
        box-shadow: 0 0 0 2px rgba(29, 155, 240, 0.2);
    }

    #handle-input::placeholder {
        color: rgba(231, 233, 234, 0.5);
    }

    .handle-input-container {
        display: flex;
        gap: 8px;
        align-items: center;
        margin-bottom: 10px;
        padding: 5px;
        border-radius: 8px;
        background-color: rgba(255, 255, 255, 0.03);
    }

    .add-handle-btn {
        background-color: #1d9bf0;
        color: white;
        border: none;
        border-radius: 8px;
        padding: 8px 16px;
        cursor: pointer;
        font-weight: bold;
        font-size: 14px;
        transition: background-color 0.2s;
        white-space: nowrap;
    }
    
    .add-handle-btn:hover {
        background-color: #1a8cd8;
    }
</style>
<div id="tweetfilter-root-container">
    <button id="filter-toggle" class="toggle-button" style="display: none;">Filter Slider</button>
    <div id="tweet-filter-container">
        <button class="close-button" data-action="close-filter">×</button>
        <label for="tweet-filter-slider">SlopScore:</label>
        <input type="range" id="tweet-filter-slider" min="0" max="10" step="1">
        <span id="tweet-filter-value">5</span>
    </div>

    <button id="settings-toggle" class="toggle-button">
        <span style="font-size: 14px;">⚙️</span> Settings
    </button>
    <div id="settings-container" class="hidden">
        <div class="settings-header">
            <div class="settings-title">Twitter De-Sloppifier</div>
            <button class="close-button" data-action="close-settings">×</button>
        </div>
        <div class="settings-content">
            <div class="tab-navigation">
                <button class="tab-button active" data-tab="general">General</button>
                <button class="tab-button" data-tab="models">Models</button>
                <button class="tab-button" data-tab="instructions">Instructions</button>
            </div>
            <div id="general-tab" class="tab-content active">
                <div class="section-title"><span style="font-size: 14px;">🔑</span> OpenRouter API Key <a href="https://openrouter.ai/" target="_blank">Get one here</a></div>
                <input id="openrouter-api-key" placeholder="Enter your OpenRouter API key">
                <button class="settings-button" data-action="save-api-key">Save API Key</button>
                <div class="section-title" style="margin-top: 20px;"><span style="font-size: 14px;">🗄️</span> Cache Statistics</div>
                <div class="stats-container">
                    <div class="stats-row">
                        <div class="stats-label">Cached Tweet Ratings</div>
                        <div class="stats-value" id="cached-ratings-count">0</div>
                    </div>
                    <div class="stats-row">
                        <div class="stats-label">Whitelisted Handles</div>
                        <div class="stats-value" id="whitelisted-handles-count">0</div>
                    </div>
                </div>
                <button id="clear-cache" class="settings-button danger" data-action="clear-cache">Clear Rating Cache</button>
                <div class="section-title" style="margin-top: 20px;">
                    <span style="font-size: 14px;">💾</span> Backup &amp; Restore
                </div>
                <div class="section-description">
                    Export your settings and cached ratings to a file for backup, or import previously saved settings.
                </div>
                <div class="button-row">
                    <button class="settings-button secondary" data-action="export-settings">Export Settings</button>
                    <button class="settings-button secondary" data-action="import-settings">Import Settings</button>
                </div>
                <button class="settings-button danger" style="margin-top: 15px;" data-action="reset-settings">Reset to Defaults</button>
                <div id="version-info" style="margin-top: 20px; font-size: 11px; opacity: 0.6; text-align: center;">Twitter De-Sloppifier v?.?</div>
            </div>
            <div id="models-tab" class="tab-content">
                <div class="section-title">
                    <span style="font-size: 14px;">🧠</span> Tweet Rating Model
                </div>
                <div class="section-description">
                    The rating model is responsible for reviewing each tweet. <br>It will process images directly if you select an <strong>image-capable (🖼️)</strong> model.
                </div>
                <div class="select-container" id="model-select-container">
                </div>

                <div class="advanced-options">
                    <div class="advanced-toggle" data-toggle="model-options-content">
                        <div class="advanced-toggle-title">Options</div>
                        <div class="advanced-toggle-icon">▼</div>
                    </div>
                    <div class="advanced-content" id="model-options-content">
                        <div class="sort-container">
                            <label for="model-sort-order">Sort models by: </label>
                            <div class="controls-group">
                                <select id="model-sort-order" data-setting="modelSortOrder">
                                    <option value="pricing-low-to-high">Price</option>
                                    <option value="latency-low-to-high">Latency</option>
                                    <option value="throughput-high-to-low">Throughput</option>
                                    <option value="top-weekly">Popularity</option>
                                    <option value="">Age</option>
                                </select>
                                <button id="sort-direction" class="sort-toggle" data-setting="sortDirection" data-value="default">High-Low</button>
                            </div>
                        </div>
                        <div class="sort-container">
                            <label for="provider-sort">API Endpoint Priority: </label>
                            <select id="provider-sort" data-setting="providerSort">
                                <option value="">Default (load-balanced)</option>
                                <option value="throughput">Throughput</option>
                                <option value="latency">Latency</option>
                                <option value="price">Price</option>
                            </select>
                        </div>
                        <div class="sort-container">
                            <label>
                                <input type="checkbox" id="show-free-models" data-setting="showFreeModels" checked>
                                Show Free Models
                            </label>
                        </div>

                        <div class="parameter-row" data-param-name="modelTemperature">
                            <div class="parameter-label" title="How random the model responses should be (0.0-1.0)">Temperature</div>
                            <div class="parameter-control">
                                <input type="range" class="parameter-slider" min="0" max="2" step="0.1">
                                <input type="number" class="parameter-value" min="0" max="2" step="0.01" style="width: 60px;">
                            </div>
                        </div>
                        <div class="parameter-row" data-param-name="modelTopP">
                            <div class="parameter-label" title="Nucleus sampling parameter (0.0-1.0)">Top-p</div>
                            <div class="parameter-control">
                                <input type="range" class="parameter-slider" min="0" max="1" step="0.1">
                                <input type="number" class="parameter-value" min="0" max="1" step="0.01" style="width: 60px;">
                            </div>
                        </div>
                        <div class="parameter-row" data-param-name="maxTokens">
                            <div class="parameter-label" title="Maximum number of tokens for the response (0 means no limit)">Max Tokens</div>
                            <div class="parameter-control">
                                <input type="range" class="parameter-slider" min="0" max="2000" step="100">
                                <input type="number" class="parameter-value" min="0" max="2000" step="100" style="width: 60px;">
                            </div>
                        </div>
                        
                        <div class="toggle-row">
                            <div class="toggle-label" title="Stream API responses as they're generated for live updates">Enable Live Streaming</div>
                            <label class="toggle-switch">
                                <input type="checkbox" data-setting="enableStreaming">
                                <span class="toggle-slider"></span>
                            </label>
                        </div>
                    </div>
                </div>

                <div class="section-title" style="margin-top: 25px;"><span style="font-size: 14px;">🖼️</span> Image Processing Model</div>
                <div class="section-description">This model generates <strong>text descriptions</strong> of images for the rating model.<br> Hint: If you selected an image-capable model (🖼️) as your <strong>main rating model</strong>, it will process images directly.</div>
                <div class="toggle-row">
                    <div class="toggle-label">Enable Image Descriptions</div>
                    <label class="toggle-switch">
                        <input type="checkbox" data-setting="enableImageDescriptions">
                        <span class="toggle-slider"></span>
                    </label>
                </div>
                <div id="image-model-container" style="display: none;">
                    <div class="select-container" id="image-model-select-container">
                    </div>
                    <div class="advanced-options" id="image-advanced-options">
                        <div class="advanced-toggle" data-toggle="image-advanced-content">
                            <div class="advanced-toggle-title">Options</div>
                            <div class="advanced-toggle-icon">▼</div>
                        </div>
                        <div class="advanced-content" id="image-advanced-content">
                            <div class="parameter-row" data-param-name="imageModelTemperature">
                                <div class="parameter-label" title="Randomness for image descriptions (0.0-1.0)">Temperature</div>
                                <div class="parameter-control">
                                    <input type="range" class="parameter-slider" min="0" max="2" step="0.1">
                                    <input type="number" class="parameter-value" min="0" max="2" step="0.1" style="width: 60px;">
                                </div>
                            </div>
                            <div class="parameter-row" data-param-name="imageModelTopP">
                                <div class="parameter-label" title="Nucleus sampling for image model (0.0-1.0)">Top-p</div>
                                <div class="parameter-control">
                                    <input type="range" class="parameter-slider" min="0" max="1" step="0.1">
                                    <input type="number" class="parameter-value" min="0" max="1" step="0.1" style="width: 60px;">
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div id="instructions-tab" class="tab-content">
                <div class="section-title">Custom Instructions</div>
                <div class="section-description">Add custom instructions for how the model should score tweets:</div>
                <textarea id="user-instructions" placeholder="Examples:
                - Give high scores to tweets about technology
                - Penalize clickbait-style tweets
                - Rate educational content higher" data-setting="userDefinedInstructions" value=""></textarea>
                <button class="settings-button" data-action="save-instructions">Save Instructions</button>
                <div class="section-title" style="margin-top: 20px;">Auto-Rate Handles as 10/10</div>
                <div class="section-description">Add Twitter handles to automatically rate as 10/10:</div>
                <div class="handle-input-container">
                    <input id="handle-input" type="text" placeholder="Twitter handle (without @)">
                    <button class="add-handle-btn" data-action="add-handle">Add</button>
                </div>
                <div class="handle-list" id="handle-list">
                </div>
            </div>
        </div>
        <div id="status-indicator" class=""></div>
    </div>
</div>`;

    // Embedded style.css
    const STYLE = `/*
        Modern X-Inspired Styles - Enhanced
        ---------------------------------
    */

    /* Main tweet filter container */
    #tweet-filter-container {
        position: fixed;
        top: 70px;
        right: 15px;
        background-color: rgba(22, 24, 28, 0.95);
        color: #e7e9ea;
        padding: 10px 12px;
        border-radius: 12px;
        z-index: 9999;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 13px;
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        gap: 10px;
        border: 1px solid rgba(255, 255, 255, 0.1);
    }

    /* Close button styles */
    .close-button {
        background: none;
        border: none;
        color: #e7e9ea;
        font-size: 16px;
        cursor: pointer;
        padding: 0;
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0.8;
        transition: opacity 0.2s;
        border-radius: 50%;
    }

    .close-button:hover {
        opacity: 1;
        background-color: rgba(255, 255, 255, 0.1);
    }

    /* Hidden state */
    .hidden {
        display: none !important;
    }

    /* Show/hide button */
    .toggle-button {
        position: fixed;
        right: 15px;
        background-color: rgba(22, 24, 28, 0.95);
        color: #e7e9ea;
        padding: 8px 12px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 12px;
        z-index: 9999;
        border: 1px solid rgba(255, 255, 255, 0.1);
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.5);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        display: flex;
        align-items: center;
        gap: 6px;
        transition: all 0.2s ease;
    }
    
    .toggle-button:hover {
        background-color: rgba(29, 155, 240, 0.2);
    }

    #filter-toggle {
        top: 70px;
    }

    #settings-toggle {
        top: 120px;
    }

    #tweet-filter-container label {
        margin: 0;
        font-weight: bold;
    }

    #tweet-filter-slider {
        cursor: pointer;
        width: 120px;
        vertical-align: middle;
        accent-color: #1d9bf0;
    }

    #tweet-filter-value {
        min-width: 20px;
        text-align: center;
        font-weight: bold;
        background-color: rgba(255, 255, 255, 0.1);
        padding: 2px 5px;
        border-radius: 4px;
    }

    /* Settings UI with Tabs */
    #settings-container {
        position: fixed;
        top: 70px;
        right: 15px;
        background-color: rgba(22, 24, 28, 0.95);
        color: #e7e9ea;
        padding: 0; /* Remove padding to accommodate sticky header */
        border-radius: 16px;
        z-index: 9999;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 13px;
        box-shadow: 0 2px 18px rgba(0, 0, 0, 0.6);
        display: flex;
        flex-direction: column;
        width: 380px;
        max-height: 85vh;
        overflow: hidden; /* Hide overflow to make the sticky header work properly */
        border: 1px solid rgba(255, 255, 255, 0.1);
        line-height: 1.3;
        transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        transform-origin: top right;
    }
    
    #settings-container.hidden {
        opacity: 0;
        transform: scale(0.9);
        pointer-events: none;
    }
    
    /* Header section */
    .settings-header {
        padding: 12px 15px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        display: flex;
        justify-content: space-between;
        align-items: center;
        position: sticky;
        top: 0;
        background-color: rgba(22, 24, 28, 0.98);
        z-index: 20;
        border-radius: 16px 16px 0 0;
    }
    
    .settings-title {
        font-weight: bold;
        font-size: 16px;
    }
    
    /* Content area with scrolling */
    .settings-content {
        overflow-y: auto;
        max-height: calc(85vh - 110px); /* Account for header and tabs */
        padding: 0;
    }
    
    /* Scrollbar styling for settings container */
    .settings-content::-webkit-scrollbar {
        width: 6px;
    }

    .settings-content::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.05);
        border-radius: 3px;
    }

    .settings-content::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 3px;
    }

    .settings-content::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.3);
    }

    /* Tab Navigation */
    .tab-navigation {
        display: flex;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        position: sticky;
        top: 0;
        background-color: rgba(22, 24, 28, 0.98);
        z-index: 10;
        padding: 10px 15px;
        gap: 8px;
    }

    .tab-button {
        padding: 6px 10px;
        background: none;
        border: none;
        color: #e7e9ea;
        font-weight: bold;
        cursor: pointer;
        border-radius: 8px;
        transition: all 0.2s ease;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 13px;
        flex: 1;
        text-align: center;
    }

    .tab-button:hover {
        background-color: rgba(255, 255, 255, 0.1);
    }

    .tab-button.active {
        color: #1d9bf0;
        background-color: rgba(29, 155, 240, 0.1);
        border-bottom: 2px solid #1d9bf0;
    }

    /* Tab Content */
    .tab-content {
        display: none;
        animation: fadeIn 0.3s ease;
        padding: 15px;
    }
    
    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }

    .tab-content.active {
        display: block;
    }

    /* Enhanced dropdowns */
    .select-container {
        position: relative;
        margin-bottom: 15px;
    }
    
    .select-container .search-field {
        position: sticky;
        top: 0;
        background-color: rgba(39, 44, 48, 0.95);
        padding: 8px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        z-index: 1;
    }
    
    .select-container .search-input {
        width: 100%;
        padding: 8px 10px;
        border-radius: 8px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        background-color: rgba(39, 44, 48, 0.9);
        color: #e7e9ea;
        font-size: 12px;
        transition: border-color 0.2s;
    }
    
    .select-container .search-input:focus {
        border-color: #1d9bf0;
        outline: none;
    }
    
    .custom-select {
        position: relative;
        display: inline-block;
        width: 100%;
    }
    
    .select-selected {
        background-color: rgba(39, 44, 48, 0.95);
        color: #e7e9ea;
        padding: 10px 12px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 8px;
        cursor: pointer;
        user-select: none;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 13px;
        transition: border-color 0.2s;
    }
    
    .select-selected:hover {
        border-color: rgba(255, 255, 255, 0.4);
    }
    
    .select-selected:after {
        content: "";
        width: 8px;
        height: 8px;
        border: 2px solid #e7e9ea;
        border-width: 0 2px 2px 0;
        display: inline-block;
        transform: rotate(45deg);
        margin-left: 10px;
        transition: transform 0.2s;
    }
    
    .select-selected.select-arrow-active:after {
        transform: rotate(-135deg);
    }
    
    .select-items {
        position: absolute;
        background-color: rgba(39, 44, 48, 0.98);
        top: 100%;
        left: 0;
        right: 0;
        z-index: 99;
        max-height: 300px;
        overflow-y: auto;
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 8px;
        margin-top: 5px;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
        display: none;
    }
    
    .select-items div {
        color: #e7e9ea;
        padding: 10px 12px;
        cursor: pointer;
        user-select: none;
        transition: background-color 0.2s;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }
    
    .select-items div:hover {
        background-color: rgba(29, 155, 240, 0.1);
    }
    
    .select-items div.same-as-selected {
        background-color: rgba(29, 155, 240, 0.2);
    }
    
    /* Scrollbar for select items */
    .select-items::-webkit-scrollbar {
        width: 6px;
    }
    
    .select-items::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.05);
    }
    
    .select-items::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 3px;
    }
    
    .select-items::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.3);
    }
    
    /* Form elements */
    #openrouter-api-key,
    #user-instructions {
        width: 100%;
        padding: 10px 12px;
        border-radius: 8px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        margin-bottom: 12px;
        background-color: rgba(39, 44, 48, 0.95);
        color: #e7e9ea;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 13px;
        transition: border-color 0.2s;
    }
    
    #openrouter-api-key:focus,
    #user-instructions:focus {
        border-color: #1d9bf0;
        outline: none;
    }

    #user-instructions {
        height: 120px;
        resize: vertical;
    }

    /* Parameter controls */
    .parameter-row {
        display: flex;
        align-items: center;
        margin-bottom: 12px;
        gap: 8px;
        padding: 6px;
        border-radius: 8px;
        transition: background-color 0.2s;
    }
    
    .parameter-row:hover {
        background-color: rgba(255, 255, 255, 0.05);
    }

    .parameter-label {
        flex: 1;
        font-size: 13px;
        color: #e7e9ea;
    }

    .parameter-control {
        flex: 1.5;
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .parameter-value {
        min-width: 28px;
        text-align: center;
        background-color: rgba(255, 255, 255, 0.1);
        padding: 3px 5px;
        border-radius: 4px;
        font-size: 12px;
    }

    .parameter-slider {
        flex: 1;
        -webkit-appearance: none;
        height: 4px;
        border-radius: 4px;
        background: rgba(255, 255, 255, 0.2);
        outline: none;
        cursor: pointer;
    }

    .parameter-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: #1d9bf0;
        cursor: pointer;
        transition: transform 0.1s;
    }
    
    .parameter-slider::-webkit-slider-thumb:hover {
        transform: scale(1.2);
    }

    /* Section styles */
    .section-title {
        font-weight: bold;
        margin-top: 20px;
        margin-bottom: 8px;
        color: #e7e9ea;
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 14px;
    }
    
    .section-title:first-child {
        margin-top: 0;
    }

    .section-description {
        font-size: 12px;
        margin-bottom: 8px;
        opacity: 0.8;
        line-height: 1.4;
    }
    
    /* Advanced options section */
    .advanced-options {
        margin-top: 5px;
        margin-bottom: 15px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        padding: 12px;
        background-color: rgba(255, 255, 255, 0.03);
        overflow: hidden;
    }
    
    .advanced-toggle {
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: pointer;
        margin-bottom: 5px;
    }
    
    .advanced-toggle-title {
        font-weight: bold;
        font-size: 13px;
        color: #e7e9ea;
    }
    
    .advanced-toggle-icon {
        transition: transform 0.3s;
    }
    
    .advanced-toggle-icon.expanded {
        transform: rotate(180deg);
    }
    
    .advanced-content {
        max-height: 0;
        overflow: hidden;
        transition: max-height 0.3s ease-in-out;
    }
    
    .advanced-content.expanded {
        max-height: 300px;
    }

    /* Handle list styling */
    .handle-list {
        margin-top: 10px;
        max-height: 120px;
        overflow-y: auto;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        padding: 5px;
    }

    .handle-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 6px 10px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 4px;
        transition: background-color 0.2s;
    }
    
    .handle-item:hover {
        background-color: rgba(255, 255, 255, 0.05);
    }

    .handle-item:last-child {
        border-bottom: none;
    }

    .handle-text {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 12px;
    }

    .remove-handle {
        background: none;
        border: none;
        color: #ff5c5c;
        cursor: pointer;
        font-size: 14px;
        padding: 0 3px;
        opacity: 0.7;
        transition: opacity 0.2s;
    }
    
    .remove-handle:hover {
        opacity: 1;
    }

    .add-handle-btn {
        background-color: #1d9bf0;
        color: white;
        border: none;
        border-radius: 6px;
        padding: 7px 10px;
        cursor: pointer;
        font-weight: bold;
        font-size: 12px;
        margin-left: 5px;
        transition: background-color 0.2s;
    }
    
    .add-handle-btn:hover {
        background-color: #1a8cd8;
    }

    /* Button styling */
    .settings-button {
        background-color: #1d9bf0;
        color: white;
        border: none;
        border-radius: 8px;
        padding: 10px 14px;
        cursor: pointer;
        font-weight: bold;
        transition: background-color 0.2s;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        margin-top: 8px;
        width: 100%;
        font-size: 13px;
    }

    .settings-button:hover {
        background-color: #1a8cd8;
    }

    .settings-button.secondary {
        background-color: rgba(255, 255, 255, 0.1);
    }
    
    .settings-button.secondary:hover {
        background-color: rgba(255, 255, 255, 0.15);
    }

    .settings-button.danger {
        background-color: #ff5c5c;
    }

    .settings-button.danger:hover {
        background-color: #e53935;
    }
    
    /* For smaller buttons that sit side by side */
    .button-row {
        display: flex;
        gap: 8px;
        margin-top: 10px;
    }
    
    .button-row .settings-button {
        margin-top: 0;
    }
    
    /* Stats display */
    .stats-container {
        background-color: rgba(255, 255, 255, 0.05);
        padding: 10px;
        border-radius: 8px;
        margin-bottom: 15px;
    }
    
    .stats-row {
        display: flex;
        justify-content: space-between;
        padding: 5px 0;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .stats-row:last-child {
        border-bottom: none;
    }
    
    .stats-label {
        font-size: 12px;
        opacity: 0.8;
    }
    
    .stats-value {
        font-weight: bold;
    }

    /* Rating indicator shown on tweets */ 
    .score-indicator {
        position: absolute;
        top: 10px;
        right: 10.5%;
        background-color: rgba(22, 24, 28, 0.9);
        color: #e7e9ea;
        padding: 4px 10px;
        border-radius: 8px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 14px;
        font-weight: bold;
        z-index: 100;
        cursor: pointer;
        border: 1px solid rgba(255, 255, 255, 0.1);
        min-width: 20px;
        text-align: center;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        transition: transform 0.15s ease;
    }
    
    .score-indicator:hover {
        transform: scale(1.05);
    }

    /* Refresh animation */
    .refreshing {
        animation: spin 1s infinite linear;
    }

    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }

    /* The description box for ratings */
    .score-description {
        display: none;
        background-color: rgba(22, 24, 28, 0.95);
        color: #e7e9ea;
        padding: 16px 20px;
        border-radius: 12px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 16px;
        line-height: 1.5;
        z-index: 99999999;
        position: fixed;
        width: clamp(300px, 30vw, 500px);
        max-height: 60vh;
        overflow-y: auto;
        border: 1px solid rgba(255, 255, 255, 0.1);
        word-wrap: break-word;
    }
    
    /* Ensure the tooltip scrolls to the bottom during streaming */
    .score-description.streaming-tooltip {
        scroll-behavior: smooth;
        border-left: 3px solid #1d9bf0;
        background-color: rgba(25, 30, 35, 0.98);
    }
    
    /* Add a small badge to indicate streaming status */
    .score-description.streaming-tooltip::before {
        content: 'Live';
        position: absolute;
        top: 10px;
        right: 10px;
        background-color: #1d9bf0;
        color: white;
        font-size: 11px;
        padding: 2px 6px;
        border-radius: 10px;
        font-weight: bold;
    }
    
    /* Add scrollbars to tooltip for better UX */
    .score-description::-webkit-scrollbar {
        width: 6px;
    }
    
    .score-description::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.05);
        border-radius: 3px;
    }
    
    .score-description::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 3px;
    }
    
    .score-description::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.3);
    }
    
    /* Add animated cursor to the streaming tooltip content */
    .score-description.streaming-tooltip p::after {
        content: '|';
        display: inline-block;
        color: #1d9bf0;
        animation: blink 0.7s infinite;
        font-weight: bold;
        margin-left: 2px;
    }
    
    @keyframes blink {
        0%, 100% { opacity: 0; }
        50% { opacity: 1; }
    }
    
    .streaming-rating {
        background-color: rgba(33, 150, 243, 0.9) !important;
        color: white !important;
        animation: pulse 1.5s infinite alternate; /* Add pulsing animation for live updates */
        position: relative;
    }
    
    /* Add a small dot to indicate streaming in progress */
    .streaming-rating::after {
        content: '';
        position: absolute;
        top: -2px;
        right: -2px;
        width: 6px;
        height: 6px;
        background-color: #1d9bf0;
        border-radius: 50%;
        animation: blink 0.7s infinite;
        box-shadow: 0 0 4px #1d9bf0;
    }

    /* Rating status classes */
    .cached-rating {
        background-color: rgba(76, 175, 80, 0.9) !important;
        color: white !important;
    }
    
    .rated-rating {
        background-color: rgba(33, 33, 33, 0.9) !important;
        color: white !important;
    }

    .blacklisted-rating {
        background-color: rgba(255, 193, 7, 0.9) !important;
        color: black !important;
    }

    .pending-rating {
        background-color: rgba(255, 152, 0, 0.9) !important;
        color: white !important;
    }
    
    @keyframes pulse {
        0% { opacity: 0.8; }
        100% { opacity: 1; }
    }

    .error-rating {
        background-color: rgba(244, 67, 54, 0.9) !important;
        color: white !important;
    }

    /* Status indicator at bottom-right */
    #status-indicator {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background-color: rgba(22, 24, 28, 0.95);
        color: #e7e9ea;
        padding: 10px 15px;
        border-radius: 8px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 12px;
        z-index: 9999;
        display: none;
        border: 1px solid rgba(255, 255, 255, 0.1);
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);
        transform: translateY(100px);
        transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }

    #status-indicator.active {
        display: block;
        transform: translateY(0);
    }
    
    /* Toggle switch styling */
    .toggle-switch {
        position: relative;
        display: inline-block;
        width: 36px;
        height: 20px;
    }
    
    .toggle-switch input {
        opacity: 0;
        width: 0;
        height: 0;
    }
    
    .toggle-slider {
        position: absolute;
        cursor: pointer;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(255, 255, 255, 0.2);
        transition: .3s;
        border-radius: 34px;
    }
    
    .toggle-slider:before {
        position: absolute;
        content: "";
        height: 16px;
        width: 16px;
        left: 2px;
        bottom: 2px;
        background-color: white;
        transition: .3s;
        border-radius: 50%;
    }
    
    input:checked + .toggle-slider {
        background-color: #1d9bf0;
    }
    
    input:checked + .toggle-slider:before {
        transform: translateX(16px);
    }
    
    .toggle-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 10px;
        margin-bottom: 12px;
        background-color: rgba(255, 255, 255, 0.05);
        border-radius: 8px;
        transition: background-color 0.2s;
    }
    
    .toggle-row:hover {
        background-color: rgba(255, 255, 255, 0.08);
    }
    
    .toggle-label {
        font-size: 13px;
        color: #e7e9ea;
    }

    /* Existing styles */
    
    /* Sort container styles */
    .sort-container {
        margin: 10px 0;
        display: flex;
        align-items: center;
        gap: 10px;
    }
    
    .sort-container label {
        font-size: 14px;
        color: var(--text-color);
    }
    
    .sort-container select {
        padding: 5px 10px;
        border-radius: 4px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        background-color: rgba(39, 44, 48, 0.95);
        color: #e7e9ea;
        font-size: 14px;
        cursor: pointer;
    }
    
    .sort-container select:hover {
        border-color: #1d9bf0;
    }
    
    .sort-container select:focus {
        outline: none;
        border-color: #1d9bf0;
        box-shadow: 0 0 0 2px rgba(29, 155, 240, 0.2);
    }
    
    /* Dropdown option styling */
    .sort-container select option {
        background-color: rgba(39, 44, 48, 0.95);
        color: #e7e9ea;
    }`;

    // Apply CSS
    GM_addStyle(STYLE);

    // Set menu HTML
    GM_setValue('menuHTML', MENU);

    // ----- twitter-desloppifier.js -----

const VERSION = '1.3.6.2'; 
(function () {
    
    'use strict';

    // Load CSS stylesheet
    //const css = GM_getResourceText('STYLESHEET');
    let menuhtml = GM_getResourceText("MENU_HTML");
    GM_setValue('menuHTML', menuhtml);
    let firstRun = GM_getValue('firstRun', true);

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

            initialiseUI();
            if (firstRun) {
                resetSettings(true);
                GM_setValue('firstRun', false);
            }
            // If no API key is found, prompt the user
            let apiKey = GM_getValue('openrouter-api-key', '');
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
                GM_setValue('openrouter-api-key', apiKey);
                showStatus(`Loaded ${Object.keys(tweetIDRatingCache).length} cached ratings. Starting to rate visible tweets...`);
                fetchAvailableModels();
            }
            // Process all currently visible tweets
            observedTargetNode.querySelectorAll(TWEET_ARTICLE_SELECTOR).forEach(scheduleTweetProcessing);

            // Apply filtering based on current threshold
            applyFilteringToAll();

            const observer = new MutationObserver(handleMutations);
            observer.observe(observedTargetNode, { childList: true, subtree: true });
            ensureAllTweetsRated();
            window.addEventListener('beforeunload', () => {
                saveTweetRatings();
                observer.disconnect();
                const sliderUI = document.getElementById('tweet-filter-container');
                if (sliderUI) sliderUI.remove();
                const settingsUI = document.getElementById('settings-container');
                if (settingsUI) settingsUI.remove();
                const statusIndicator = document.getElementById('status-indicator');
                if (statusIndicator) statusIndicator.remove();
                //Now WHY TF did it call this LMAO. That's why it was broken!
                //cleanupDescriptionElements();

            });
        } else {
            setTimeout(initializeObserver, 1000);
        }
    }
    // Start observing tweets and initializing the UI
    initializeObserver();
})();

    // ----- config.js -----
const processedTweets = new Set(); // Set of tweet IDs already processed in this session

/**
 * Cache for tweet ratings - each entry should have:
 * Required fields:
 * - score: Number - The numerical rating score (must not be undefined/null)
 * 
 * Optional fields:
 * - description: String - Text description of the rating
 * - tweetContent: String - Full context of the tweet
 * - streaming: Boolean - Whether rating is still being streamed (should be false for completed entries)
 * - reasoning: String - Reasoning behind the rating
 * - fromStorage: Boolean - Whether entry was loaded from persistent storage
 * - threadContext: Object - Contains thread relationship data:
 *   - replyTo: String - Username being replied to
 *   - replyToId: String - Tweet ID being replied to
 *   - isRoot: Boolean - Whether this is a root tweet
 *   - threadMediaUrls: Array - Media URLs from previous tweets in thread
 */
const tweetIDRatingCache = {}; // ID-based cache for persistent storage

/**
 * Removes invalid entries from tweetIDRatingCache, including:
 * - Entries with undefined/null scores
 * - Streaming entries with undefined scores
 * @param {boolean} saveAfterCleanup - Whether to save the cache after cleanup
 * @returns {Object} - Statistics about the cleanup operation
 */
function cleanupInvalidCacheEntries(saveAfterCleanup = true) {
    const beforeCount = Object.keys(tweetIDRatingCache).length;
    let deletedCount = 0;
    let streamingDeletedCount = 0;
    let undefinedScoreCount = 0;
    
    // Iterate through all entries
    for (const tweetId in tweetIDRatingCache) {
        const entry = tweetIDRatingCache[tweetId];
        
        // Check for invalid entries
        if (entry.score === undefined || entry.score === null) {
            // Count streaming entries separately
            if (entry.streaming === true) {
                streamingDeletedCount++;
            } else {
                undefinedScoreCount++;
            }
            
            // Delete the invalid entry
            delete tweetIDRatingCache[tweetId];
            deletedCount++;
        }
    }
    
    // Save the cleaned cache if requested
    if (saveAfterCleanup && deletedCount > 0) {
        saveTweetRatings();
    }
    
    // Return cleanup statistics
    return {
        beforeCount,
        afterCount: Object.keys(tweetIDRatingCache).length,
        deletedCount,
        streamingDeletedCount,
        undefinedScoreCount
    };
}

const PROCESSING_DELAY_MS = 100; // Delay before processing a tweet (ms)
const API_CALL_DELAY_MS = 20; // Minimum delay between API calls (ms)
let USER_DEFINED_INSTRUCTIONS = GM_getValue('userDefinedInstructions', `- Give high scores to insightful and impactful tweets
- Give low scores to clickbait, fearmongering, and ragebait
- Give high scores to high-effort content and artistic content`);
let currentFilterThreshold = GM_getValue('filterThreshold', 1); // Filter threshold for tweet visibility
let observedTargetNode = null;
let lastAPICallTime = 0;
let pendingRequests = 0;
const MAX_RETRIES = 3;
let availableModels = []; // List of models fetched from API
let listedModels = []; // Filtered list of models actually shown in UI
let selectedModel = GM_getValue('selectedModel', 'openai/gpt-4.1-nano');
let selectedImageModel = GM_getValue('selectedImageModel', 'openai/gpt-4.1-nano');
let modelSortOrder = GM_getValue('modelSortOrder', 'throughput-high-to-low');
let showFreeModels = GM_getValue('showFreeModels', true);
let providerSort = GM_getValue('providerSort', ''); // Default to load-balanced
let blacklistedHandles = GM_getValue('blacklistedHandles', '').split('\n').filter(h => h.trim() !== '');

let storedRatings = GM_getValue('tweetRatings', '{}');
let threadHist = "";
// Settings variables
let enableImageDescriptions = GM_getValue('enableImageDescriptions', false);
let enableStreaming = GM_getValue('enableStreaming', true); // Enable streaming by default for better UX

// Model parameters
const SYSTEM_PROMPT=`You are a tweet filtering AI. Your task is to rate tweets on a scale of 0 to 10 based on user-defined instructions.
You will be given a Tweet, structured like this:
_______TWEET SCHEMA_______
_______BEGIN TWEET_______
[TWEET {TweetID}]
{the text of the tweet being replied to}
[MEDIA_DESCRIPTION]:
[IMAGE 1]: {description}, [IMAGE 2]: {description}, etc.
[REPLY] (if the author is replying to another tweet)
[TWEET {TweetID}]: (the tweet which you are to review)
@{the author of the tweet}
{the text of the tweet}
[MEDIA_DESCRIPTION]:
[IMAGE 1]: {description}, [IMAGE 2]: {description}, etc.
[QUOTED_TWEET]: (if the author is quoting another tweet)
{the text of the quoted tweet}
[QUOTED_TWEET_MEDIA_DESCRIPTION]:
[IMAGE 1]: {description}, [IMAGE 2]: {description}, etc.
_______END TWEET_______
_______END TWEET SCHEMA_______

You are to review and provide a rating for the tweet with the specified tweet ID.
Ensure that you consider the user-defined instructions in your analysis and scoring.
Follow the user-defined instructions exactly, and do not deviate from them. Then, on a new line, provide a score between 0 and 10.
Output your final rating in the exact format:
(Response to user defined instructions)
SCORE_X (where X is a number from 0 (lowest quality) to 10 (highest quality).)
for example: SCORE_0, SCORE_1, SCORE_2, SCORE_3, etc.
If one of the above is not present, the program will not be able to parse the response and will return an error.
`
let modelTemperature = GM_getValue('modelTemperature', 1);
let modelTopP = GM_getValue('modelTopP', 1);
let imageModelTemperature = GM_getValue('imageModelTemperature', 1);
let imageModelTopP = GM_getValue('imageModelTopP', 1);
let maxTokens = GM_getValue('maxTokens', 0); // Maximum number of tokens for API requests, 0 means no limit
let imageModelMaxTokens = GM_getValue('imageModelMaxTokens', 0); // Maximum number of tokens for image model API requests, 0 means no limit
//let menuHTML= "";

// ----- DOM Selectors (for tweet elements) -----
const TWEET_ARTICLE_SELECTOR = 'article[data-testid="tweet"]';
const QUOTE_CONTAINER_SELECTOR = 'div[role="link"][tabindex="0"]';
const USER_NAME_SELECTOR = 'div[data-testid="User-Name"] span > span';
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
function isReasoningModel(modelId){
    if (!availableModels || availableModels.length === 0) {
        return false; // If we don't have model info, assume it doesn't support images
    }

    const model = availableModels.find(m => m.slug === modelId);
    if (!model) {
        return false; // Model not found in available models list
    }

    // Check if model supports images based on its architecture
    return model.supported_parameters &&
        model.supported_parameters.includes('include_reasoning');
}

try {
    // Load ratings from storage
    const parsedRatings = JSON.parse(storedRatings);
    
    // Mark all ratings from storage as "fromStorage: true" so they'll be 
    // properly recognized as cached when loaded
    Object.entries(parsedRatings).forEach(([tweetId, ratingData]) => {
        tweetIDRatingCache[tweetId] = {
            ...ratingData,
            fromStorage: true  // Mark as loaded from storage
        };
    });

} catch (e) {

}


    // ----- api.js -----
/**
 * @typedef {Object} CompletionResponse
 * @property {string} id - Response ID from OpenRouter
 * @property {string} model - Model used for completion
 * @property {Array<{
 *   message: {
 *     role: string,
 *     content: string
 *   },
 *   finish_reason: string,
 *   index: number
 * }>} choices - Array of completion choices
 * @property {Object} usage - Token usage statistics
 * @property {number} usage.prompt_tokens - Number of tokens in prompt
 * @property {number} usage.completion_tokens - Number of tokens in completion
 * @property {number} usage.total_tokens - Total tokens used
 */

/**
 * @typedef {Object} CompletionRequest
 * @property {string} model - Model ID to use
 * @property {Array<{role: string, content: Array<{type: string, text?: string, image_url?: {url: string}}>}>} messages - Messages for completion
 * @property {number} temperature - Temperature for sampling
 * @property {number} top_p - Top P for sampling
 * @property {number} max_tokens - Maximum tokens to generate
 * @property {Object} provider - Provider settings
 * @property {string} provider.sort - Sort order for models
 * @property {boolean} provider.allow_fallbacks - Whether to allow fallback models
 */

/**
 * @typedef {Object} CompletionResult
 * @property {boolean} error - Whether an error occurred
 * @property {string} message - Error or success message
 * @property {CompletionResponse|null} data - The completion response data if successful
 */

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
function getCompletionStreaming(request, apiKey, onChunk, onComplete, onError, timeout = 30000, tweetId = null) {
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

                    if (!streamComplete) {
                        streamComplete = true;
                        // Call onComplete with whatever we have so far
                        onComplete({
                            content: content,
                            reasoning: reasoning, // Include reasoning in onComplete
                            fullResponse: fullResponse,
                            data: responseObj,
                            timedOut: true
                        });
                    }
                }, 10000); // 10 second timeout without activity
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
                            reasoning: reasoning, // Include reasoning in onComplete
                            fullResponse: fullResponse,
                            data: responseObj
                        });
                    }
                    
                } catch (error) {

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
            try {
                reqObj.abort(); // Attempt to abort the XHR request
            } catch (e) {

            }
            
            // Remove from active requests tracking
            if (tweetId && window.activeStreamingRequests) {
                delete window.activeStreamingRequests[tweetId];
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
 * @returns {Promise<{score: number, content: string, error: boolean, cached?: boolean, data?: any}>} The rating result
 */
async function rateTweetWithOpenRouter(tweetText, tweetId, apiKey, mediaUrls, maxRetries = 3) {

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
        ${USER_DEFINED_INSTRUCTIONS}
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
    const useStreaming = GM_getValue('enableStreaming', false);
    
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
                result = await rateTweetStreaming(request, apiKey, tweetId, tweetText);
            } else {
                result = await rateTweet(request, apiKey);
            }
            
            pendingRequests--;
            showStatus(`Rating tweet... (${pendingRequests} pending)`);
            
            // Parse the result for score
            if (!result.error && result.content) {
                const scoreMatch = result.content.match(/SCORE_(\d+)/);
                
                if (scoreMatch) {
                    const score = parseInt(scoreMatch[1], 10);
                    
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
            pendingRequests--;
            showStatus(`Rating tweet... (${pendingRequests} pending)`);

            if (attempt < maxRetries) {
                const backoffDelay = Math.pow(attempt, 2) * 1000;
                await new Promise(resolve => setTimeout(resolve, backoffDelay));
            }
        }
    }
    
    // If we get here, all retries failed
    return {
        score: 5,
        content: "Failed to get valid rating after multiple attempts",
        error: true,
        data: null
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
    const result = await getCompletion(request, apiKey);
    
    if (!result.error && result.data?.choices?.[0]?.message) {
        const content = result.data.choices[0].message.content || "";
        const reasoning = result.data.choices[0].message.reasoning || "";
        
        return {
            content,
            reasoning,
            error: false,
            data: result.data
        };
    } else {
        return {
            content: result.message || "Error getting response",
            reasoning: "",
            error: true,
            data: result.data
        };
    }
}

/**
 * Performs a streaming tweet rating request with real-time UI updates
 * 
 * @param {Object} request - The formatted request body
 * @param {string} apiKey - API key for authentication
 * @param {string} tweetId - The tweet ID
 * @param {string} tweetText - The text content of the tweet
 * @returns {Promise<{content: string, error: boolean, data: any}>} The rating result
 */
async function rateTweetStreaming(request, apiKey, tweetId, tweetText) {
    return new Promise((resolve, reject) => {
        // Find the tweet article element for this tweet ID
        const tweetArticle = Array.from(document.querySelectorAll('article[data-testid="tweet"]'))
            .find(article => getTweetID(article) === tweetId);
        
        let aggregatedContent = "";
        let aggregatedReasoning = ""; // Track reasoning traces
        let finalData = null;
        
        // Initialize active streaming requests object if it doesn't exist
        if (!window.activeStreamingRequests) {
            window.activeStreamingRequests = {};
        }
        
        // Cancel any existing request for this tweet
        if (window.activeStreamingRequests[tweetId]) {

            window.activeStreamingRequests[tweetId].abort();
            delete window.activeStreamingRequests[tweetId];
        }
        tweetIDRatingCache[tweetId] = {
            tweetContent: tweetText,
            score: null,
            description: "",
            reasoning: "", // Store reasoning
            streaming: true,  // Mark as complete
            timestamp: Date.now()
        };
        saveTweetRatings();
        getCompletionStreaming(
            request,
            apiKey,
            // onChunk callback - update the tweet's rating indicator in real-time
            (chunkData) => {
                
                // Use the content and reasoning directly from chunkData instead of aggregating manually
                aggregatedContent = chunkData.content || "Rating in progress...";
                aggregatedReasoning = chunkData.reasoning || "";
                
                if (tweetArticle) {
                    // Look for a score in the accumulated content so far
                    const scoreMatch = aggregatedContent.match(/SCORE_(\d+)/);
                    let currentScore = scoreMatch ? parseInt(scoreMatch[1], 10) : null;
                    
                    // Store references and current state
                    const indicator = tweetArticle.querySelector('.score-indicator');
                    const tooltip = indicator?.scoreTooltip;
                    
                    // Update the indicator with current partial content
                    tweetArticle.dataset.streamingContent = aggregatedContent;
                    tweetArticle.dataset.ratingStatus = 'streaming';
                    tweetArticle.dataset.ratingDescription = aggregatedContent;
                    if (aggregatedReasoning) {
                        tweetArticle.dataset.ratingReasoning = aggregatedReasoning;
                    }
                    
                    // Don't cache streaming results - removed partial caching code
                    
                    // Update the tooltip content with both description and reasoning
                    if (tooltip) {
                        // Use the helper function from ui.js to update tooltip content
                        updateTooltipContent(tooltip, aggregatedContent, aggregatedReasoning);
                        tooltip.classList.add('streaming-tooltip');
                    }
                    
                    if (currentScore !== null && aggregatedReasoning !== "" && aggregatedContent !== "") {
                        // Update the score indicator but preserve tooltip state
                        if (indicator) {
                            // Store the current score
                            tweetArticle.dataset.sloppinessScore = currentScore.toString();
                            
                            // Update just the score number and class
                            indicator.textContent = currentScore;
                            indicator.className = 'score-indicator streaming-rating';
                            
                            // Get the tooltip and update only the content
                            const tooltip = indicator.scoreTooltip;
                            if (tooltip) {
                                // Update tooltip content directly without recreating it
                                const descriptionElement = tooltip.querySelector('.description-text');
                                const reasoningElement = tooltip.querySelector('.reasoning-text');
                                
                                // Format the text
                                const formatted = formatTooltipDescription(aggregatedContent, aggregatedReasoning);
                                
                                if (descriptionElement) {
                                    descriptionElement.innerHTML = formatted.description;
                                }
                                
                                if (reasoningElement) {
                                    reasoningElement.innerHTML = formatted.reasoning;
                                }
                                
                                // Preserve expanded state - only show/hide dropdown if reasoning exists
                                const dropdown = tooltip.querySelector('.reasoning-dropdown');
                                if (dropdown && !formatted.reasoning) {
                                    dropdown.style.display = 'none';
                                } else if (dropdown && formatted.reasoning && dropdown.style.display === 'none') {
                                    dropdown.style.display = 'block';
                                }
                            }
                        }
                    } else if (indicator && (aggregatedReasoning !== "" || aggregatedContent !== "")) {
                        // Handle case where score isn't available yet but reasoning is
                        indicator.className = 'score-indicator streaming-rating';
                        indicator.textContent = '🔄';
                        
                        // Update tooltip content directly
                        const tooltip = indicator.scoreTooltip;
                        if (tooltip) {
                            const descriptionElement = tooltip.querySelector('.description-text');
                            const reasoningElement = tooltip.querySelector('.reasoning-text');
                            
                            // Format the text - ensure we have at least a placeholder for content
                            const contentToShow = aggregatedContent || "Rating in progress...";
                            const formatted = formatTooltipDescription(contentToShow, aggregatedReasoning);
                            
                            if (descriptionElement) {
                                descriptionElement.innerHTML = formatted.description;
                            }
                            
                            if (reasoningElement) {
                                reasoningElement.innerHTML = formatted.reasoning;
                            }
                            
                            // Only show/hide dropdown if reasoning exists
                            const dropdown = tooltip.querySelector('.reasoning-dropdown');
                            if (dropdown && !formatted.reasoning) {
                                dropdown.style.display = 'none';
                            } else if (dropdown && formatted.reasoning && dropdown.style.display === 'none') {
                                dropdown.style.display = 'block';
                            }
                        }
                    }
                }
            },
            // onComplete callback - finalize the rating
            (finalResult) => {
                finalData = finalResult.data;
                
                // When streaming completes, update the cache with the final result
                if (tweetArticle) {
                    // Check for a score in the final content
                    const scoreMatch = aggregatedContent.match(/SCORE_(\d+)/);
                    // Also check if we already found a score during streaming
                    const existingScore = tweetIDRatingCache[tweetId]?.score;
                    
                    if (scoreMatch || existingScore) {
                        // if the AI writes multiple scores, use the last one
                        const score = scoreMatch ? parseInt(scoreMatch[scoreMatch.length - 1], 10) : existingScore;
                        
                        // Update cache with final result (non-streaming)
                        tweetIDRatingCache[tweetId] = {
                            tweetContent: tweetText,
                            score: score,
                            description: aggregatedContent,
                            reasoning: finalResult.reasoning || aggregatedReasoning, // Store reasoning
                            streaming: false,  // Mark as complete
                            timestamp: Date.now()
                        };
                        saveTweetRatings();
                        
                        // Finalize UI update
                        tweetArticle.dataset.ratingStatus = 'rated';
                        tweetArticle.dataset.ratingDescription = aggregatedContent;
                        tweetArticle.dataset.ratingReasoning = finalResult.reasoning || aggregatedReasoning;
                        tweetArticle.dataset.sloppinessScore = score.toString();
                        
                        // Remove streaming class from tooltip
                        const indicator = tweetArticle.querySelector('.score-indicator');
                        if (indicator && indicator.scoreTooltip) {
                            // Update the final tooltip content
                            updateTooltipContent(indicator.scoreTooltip, aggregatedContent, finalResult.reasoning || aggregatedReasoning);
                            indicator.scoreTooltip.classList.remove('streaming-tooltip');
                            
                            // Set final indicator state - ensure we're not recreating the tooltip
                            indicator.className = 'score-indicator rated-rating';
                            indicator.textContent = score;
                        } else {
                            // If no indicator exists yet, create one with setScoreIndicator
                            setScoreIndicator(tweetArticle, score, 'rated', aggregatedContent, finalResult.reasoning || aggregatedReasoning);
                        }
                        
                    } else {
                        // If no score was found anywhere, log a warning and set a default score

                        // Set a default score of 5
                        const defaultScore = 5;
                        
                        // Update cache with default score
                        tweetIDRatingCache[tweetId] = {
                            tweetContent: tweetText,
                            score: defaultScore,
                            description: aggregatedContent + " [No explicit score detected, using default score of 5]",
                            reasoning: finalResult.reasoning || aggregatedReasoning,
                            streaming: false,
                            timestamp: Date.now()
                        };
                        saveTweetRatings();
                        
                        // Update UI with default score
                        tweetArticle.dataset.ratingStatus = 'error';
                        tweetArticle.dataset.ratingDescription = aggregatedContent;
                        tweetArticle.dataset.ratingReasoning = finalResult.reasoning || aggregatedReasoning;
                        tweetArticle.dataset.sloppinessScore = defaultScore.toString();
                        
                        // Set indicator with default score
                        const indicator = tweetArticle.querySelector('.score-indicator');
                        if (indicator) {
                            indicator.className = 'score-indicator rated-rating';
                            indicator.textContent = defaultScore;
                            
                            if (indicator.scoreTooltip) {
                                updateTooltipContent(indicator.scoreTooltip, aggregatedContent, finalResult.reasoning || aggregatedReasoning);
                                indicator.scoreTooltip.classList.remove('streaming-tooltip');
                            }
                        } else {
                            setScoreIndicator(tweetArticle, defaultScore, 'rated', aggregatedContent, finalResult.reasoning || aggregatedReasoning);
                        }
                        
                    }
                } else {

                }
                
                resolve({
                    content: aggregatedContent,
                    reasoning: finalResult.reasoning || aggregatedReasoning,
                    error: false,
                    data: finalData
                });
            },
            // onError callback
            (errorData) => {
                // Update UI on error
                if (tweetArticle) {
                    tweetArticle.dataset.ratingStatus = 'error';
                    tweetArticle.dataset.ratingDescription = errorData.message;
                    tweetArticle.dataset.sloppinessScore = '5';
                    
                    // Remove streaming class from tooltip
                    const indicator = tweetArticle.querySelector('.score-indicator');
                    if (indicator && indicator.scoreTooltip) {
                        indicator.scoreTooltip.classList.remove('streaming-tooltip');
                    }

                    setScoreIndicator(tweetArticle, 5, 'error', errorData.message);
                }
                
                reject(new Error(errorData.message));
            },
            30000, // timeout
            tweetId  // Pass the tweet ID to associate with this request
        );
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

/**
 * Fetches the list of available models from the OpenRouter API.
 * Uses the stored API key, and updates the model selector upon success.
 */
function fetchAvailableModels() {
    const apiKey = GM_getValue('openrouter-api-key', '');
    if (!apiKey) {
        showStatus('Please enter your OpenRouter API key');
        return;
    }
    showStatus('Fetching available models...');
    const sortOrder = GM_getValue('modelSortOrder', 'throughput-high-to-low');
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
                    if (sortOrder === 'latency-low-to-high') {
                        filteredModels.reverse();
                    }
                    availableModels = filteredModels || [];
                    listedModels = [...availableModels]; // Initialize listedModels
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
function extractMediaLinks(scopeElement) {
    if (!scopeElement) return [];
    
    const mediaLinks = new Set();
    
    // Find all images and videos in the tweet
    const imgSelector = `${MEDIA_IMG_SELECTOR}, [data-testid="tweetPhoto"] img, img[src*="pbs.twimg.com/media"]`;
    const videoSelector = `${MEDIA_VIDEO_SELECTOR}, video[poster*="pbs.twimg.com"], video`;
    
    // First try the standard selectors
    let mediaElements = scopeElement.querySelectorAll(`${imgSelector}, ${videoSelector}`);
    
    // If no media found and this is a quoted tweet, try more aggressive selectors
    if (mediaElements.length === 0 && scopeElement.matches(QUOTE_CONTAINER_SELECTOR)) {
        // Try to find any image within the quoted tweet
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
            const format = url.searchParams.get('format');
            const name = url.searchParams.get('name'); // 'small', 'medium', 'large', etc.
            
            // Create the final URL with the right format and size
            let finalUrl = sourceUrl;
            
            // Try to get the original size by removing size indicator
            if (name && name !== 'orig') {
                // Replace format=jpg&name=small with format=jpg&name=orig
                finalUrl = sourceUrl.replace(`name=${name}`, 'name=orig');
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

// ----- MutationObserver Setup -----
/**
 * Handles DOM mutations to detect new tweets added to the timeline.
 * @param {MutationRecord[]} mutationsList - List of observed mutations.
 */
function handleMutations(mutationsList) {
    let tweetsAdded = false;

    for (const mutation of mutationsList) {
        handleThreads();
        if (mutation.type === 'childList') {
            // Process added nodes
            if (mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.matches && node.matches(TWEET_ARTICLE_SELECTOR)) {
                            scheduleTweetProcessing(node);
                            tweetsAdded = true;
                        }
                        else if (node.querySelectorAll) {
                            const tweetsInside = node.querySelectorAll(TWEET_ARTICLE_SELECTOR);
                            if (tweetsInside.length > 0) {
                                tweetsInside.forEach(scheduleTweetProcessing);
                                tweetsAdded = true;
                            }
                        }
                    }
                });
            }

            // Process removed nodes to clean up description elements
            if (mutation.removedNodes.length > 0) {
                mutation.removedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Check if the removed node is a tweet article or contains tweet articles
                        const isTweet = node.matches && node.matches(TWEET_ARTICLE_SELECTOR);
                        const removedTweets = isTweet ? [node] :
                            (node.querySelectorAll ? Array.from(node.querySelectorAll(TWEET_ARTICLE_SELECTOR)) : []);

                        // For each removed tweet, find and remove its description element
                        removedTweets.forEach(tweet => {
                            const indicator = tweet.querySelector('.score-indicator');
                            if (indicator && indicator.dataset.id) {
                                const descId = 'desc-' + indicator.dataset.id;
                                const descBox = document.getElementById(descId);
                                if (descBox) {
                                    descBox.remove();
                                }
                            }
                        });
                    }
                });
            }
        }
    }
    
    // If any tweets were added, ensure filtering is applied
    if (tweetsAdded) {
        // Apply a small delay to allow processing to start first
        setTimeout(() => {
            applyFilteringToAll();
        }, 100);
    }
}
    // ----- ratingEngine.js -----
/**
 * Applies filtering to a single tweet by hiding it if its score is below the threshold.
 * Also updates the rating indicator.
 * @param {Element} tweetArticle - The tweet element.
 */
function filterSingleTweet(tweetArticle) {
    const score = parseInt(tweetArticle.dataset.sloppinessScore || '9', 10);
    // Update the indicator based on the tweet's rating status
    setScoreIndicator(tweetArticle, score, tweetArticle.dataset.ratingStatus || 'rated', tweetArticle.dataset.ratingDescription);
    // If the tweet is still pending a rating, keep it visible
    // Always get the latest threshold directly from storage
    const currentFilterThreshold = parseInt(GM_getValue('filterThreshold', '1'));
    if (tweetArticle.dataset.ratingStatus === 'pending' || tweetArticle.dataset.ratingStatus === 'streaming') {
        //tweetArticle.style.display = '';
        tweetArticle.closest('div[data-testid="cellInnerDiv"]').style.display = '';
    } else if (isNaN(score) || score < currentFilterThreshold) {
        //tweetArticle.style.display = 'none';
        tweetArticle.closest('div[data-testid="cellInnerDiv"]').style.display = 'none';
    } else {
        //tweetArticle.style.display = '';
        tweetArticle.closest('div[data-testid="cellInnerDiv"]').style.display = '';
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
        setScoreIndicator(tweetArticle, 10, 'blacklisted', "User is whitelisted");
        filterSingleTweet(tweetArticle);
        return true;
    }
    // Check ID-based cache
    if (tweetIDRatingCache[tweetId]) {
        // Skip incomplete streaming entries that don't have a score yet
        if (tweetIDRatingCache[tweetId].streaming === true &&
            (tweetIDRatingCache[tweetId].score === undefined || tweetIDRatingCache[tweetId].score === null)) {
            return false;
        }

        // Ensure the score exists before applying it
        if (tweetIDRatingCache[tweetId].score !== undefined && tweetIDRatingCache[tweetId].score !== null) {
            const score = tweetIDRatingCache[tweetId].score;
            const desc = tweetIDRatingCache[tweetId].description;
            const reasoning = tweetIDRatingCache[tweetId].reasoning || "";

            tweetArticle.dataset.sloppinessScore = score.toString();
            tweetArticle.dataset.cachedRating = 'true';
            if (reasoning) {
                tweetArticle.dataset.ratingReasoning = reasoning;
            }

            // If it's a streaming entry that's not complete, mark as streaming instead of cached
            if (tweetIDRatingCache[tweetId].streaming === true) {
                tweetArticle.dataset.ratingStatus = 'streaming';
                setScoreIndicator(tweetArticle, score, 'streaming', desc);
            } else {
                // Check if this rating is from storage (cached) or newly created
                const isFromStorage = tweetIDRatingCache[tweetId].fromStorage === true;

                // Set status based on source
                if (isFromStorage) {
                    tweetArticle.dataset.ratingStatus = 'cached';
                    setScoreIndicator(tweetArticle, score, 'cached', desc);
                    
                } else {
                    tweetArticle.dataset.ratingStatus = 'rated';
                    setScoreIndicator(tweetArticle, score, 'rated', desc);
                }
            }

            tweetArticle.dataset.ratingDescription = desc;
            filterSingleTweet(tweetArticle);
            return true;
        } else if (!tweetIDRatingCache[tweetId].streaming){
            // Invalid cache entry - missing score

            delete tweetIDRatingCache[tweetId];  // Remove invalid entry
            saveTweetRatings();
            return false;
        }
    }

    return false;
}
// ----- UI Helper Functions -----

/**
 * Saves the tweet ratings (by tweet ID) to persistent storage and updates the UI.
 */
function saveTweetRatings() {
    GM_setValue('tweetRatings', JSON.stringify(tweetIDRatingCache));

    // Dynamically update the UI cache stats counter
    // Only try to update if the element exists (the settings panel is open)
    const cachedCountEl = document.getElementById('cached-ratings-count');
    if (cachedCountEl) {
        cachedCountEl.textContent = Object.keys(tweetIDRatingCache).length;
    }

    // Also update the cache stats in the settings panel
    try {
        // Use the UI function if it's available
        if (typeof updateCacheStatsUI === 'function') {
            updateCacheStatsUI();
        }
    } catch (e) {

    }
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

async function delayedProcessTweet(tweetArticle, tweetId) {
    const apiKey = GM_getValue('openrouter-api-key', '');
    if (!apiKey) {
        tweetArticle.dataset.ratingStatus = 'error';
        tweetArticle.dataset.ratingDescription = "No API key";
        try {
            setScoreIndicator(tweetArticle, 9, 'error', "No API key");
            // Verify indicator was actually created
            if (!tweetArticle.querySelector('.score-indicator')) {

            }
        } catch (e) {

        }
        filterSingleTweet(tweetArticle);
        // Remove from processedTweets to allow retrying
        processedTweets.delete(tweetId);

        return;
    }
    let score = 5; // Default score if rating fails
    let description = "";
    let processingSuccessful = false;

    try {
        // Get user handle
        const handles = getUserHandles(tweetArticle);
        const userHandle = handles.length > 0 ? handles[0] : '';
        const quotedHandle = handles.length > 1 ? handles[1] : '';

        // Check if tweet's author is blacklisted (fast path)
        if (userHandle && isUserBlacklisted(userHandle)) {
            tweetArticle.dataset.sloppinessScore = '10';
            tweetArticle.dataset.blacklisted = 'true';
            tweetArticle.dataset.ratingStatus = 'blacklisted';
            tweetArticle.dataset.ratingDescription = "Blacklisted user";
            try {
                setScoreIndicator(tweetArticle, 10, 'blacklisted', "User is blacklisted");
                // Verify indicator was actually created
                if (!tweetArticle.querySelector('.score-indicator')) {
                    throw new Error("Failed to create score indicator");
                }
            } catch (e) {

                // Even if indicator fails, we've set the dataset properties
            }
            filterSingleTweet(tweetArticle);
            processingSuccessful = true;
            
        }

        // Check for a cached rating, but only use it if it has a valid score
        // and is not an incomplete streaming entry
        if (tweetIDRatingCache[tweetId]) {
            const cacheEntry = tweetIDRatingCache[tweetId];
            const isValidCacheEntry =
                cacheEntry.score !== undefined &&
                cacheEntry.score !== null &&
                !(cacheEntry.streaming === true && cacheEntry.score === undefined);

            if (isValidCacheEntry) {
                const cacheApplied = applyTweetCachedRating(tweetArticle);
                if (cacheApplied) {
                    // Verify the indicator exists after applying cached rating
                    if (!tweetArticle.querySelector('.score-indicator')) {

                        processingSuccessful = false;
                    } else {
                        processingSuccessful = true;
                    }
                    return;
                }
            } else if (cacheEntry.streaming === true) {
                // This is a streaming entry that's still in progress
                // Don't delete it, but don't use it either

            } else {
                // Invalid cache entry, delete it

                delete tweetIDRatingCache[tweetId];
                saveTweetRatings();
            }
        }

        const fullContextWithImageDescription = await getFullContext(tweetArticle, tweetId, apiKey);
        if (!fullContextWithImageDescription) {
            throw new Error("Failed to get tweet context");
        }
        
        // Add thread relationship context
        const replyInfo = getTweetReplyInfo(tweetId);
        if (replyInfo && replyInfo.replyTo) {

            // Add thread context to cache entry if we process this tweet
            if (!tweetIDRatingCache[tweetId]) {
                tweetIDRatingCache[tweetId] = {};
            }
            
            if (!tweetIDRatingCache[tweetId].threadContext) {
                tweetIDRatingCache[tweetId].threadContext = {
                    replyTo: replyInfo.to,
                    replyToId: replyInfo.replyTo,
                    isRoot: false
                };
            }
        }

        //Get the media URLS from the entire fullContextWithImageDescription, and pass that to the rating engine
        //This allows us to get the media links from the thread history as well
        const mediaURLs = [];
        // Extract regular media URLs
        const mediaMatches = fullContextWithImageDescription.match(/\[MEDIA_URLS\]:\s*\n(.*?)(?:\n|$)/);
        if (mediaMatches && mediaMatches[1]) {
            mediaURLs.push(...mediaMatches[1].split(', '));
        }
        // Extract quoted tweet media URLs
        const quotedMediaMatches = fullContextWithImageDescription.match(/\[QUOTED_TWEET_MEDIA_URLS\]:\s*\n(.*?)(?:\n|$)/);
        if (quotedMediaMatches && quotedMediaMatches[1]) {
            mediaURLs.push(...quotedMediaMatches[1].split(', '));
        }

        // --- API Call or Fallback ---
        if (apiKey && fullContextWithImageDescription) {
            try {
                // Check if there's already a complete entry in the cache before calling the API
                const isCached = tweetIDRatingCache[tweetId] &&
                    !tweetIDRatingCache[tweetId].streaming &&
                    tweetIDRatingCache[tweetId].score !== undefined;
                const rating = await rateTweetWithOpenRouter(fullContextWithImageDescription, tweetId, apiKey, mediaURLs);
                score = rating.score;
                description = rating.content;

                // Check if this rating was loaded from storage
                if (tweetIDRatingCache[tweetId] && tweetIDRatingCache[tweetId].fromStorage === true) {
                    // If it was loaded from storage, mark it as cached
                    tweetArticle.dataset.ratingStatus = 'cached';
                } else {
                    // Otherwise use the normal logic
                    tweetArticle.dataset.ratingStatus = rating.error ? 'error' : (isCached || rating.cached ? 'cached' : 'rated');
                }
                tweetArticle.dataset.ratingDescription = description || "not available";
                tweetArticle.dataset.sloppinessScore = score.toString();

                if (!isUserBlacklisted(userHandle)){
                try {
                    setScoreIndicator(tweetArticle, score, tweetArticle.dataset.ratingStatus, tweetArticle.dataset.ratingDescription);
                    // Verify the indicator exists
                    if (!tweetArticle.querySelector('.score-indicator')) {
                        throw new Error("Failed to create score indicator");
                    }
                    // Log indicator classes after setting

                } catch (e) {

                    // Continue even if indicator fails - we've set the dataset properties
                }

                filterSingleTweet(tweetArticle);
            }
                processingSuccessful = !rating.error;
                // Store the full context after rating is complete
                if (!rating.error) {
                    if (tweetIDRatingCache[tweetId]) {
                        tweetIDRatingCache[tweetId].score = score;
                        tweetIDRatingCache[tweetId].description = description;
                        tweetIDRatingCache[tweetId].tweetContent = fullContextWithImageDescription;
                        tweetIDRatingCache[tweetId].streaming = false; // Mark as complete
                    } else {
                        tweetIDRatingCache[tweetId] = {
                            score: score,
                            description: description,
                            tweetContent: fullContextWithImageDescription,
                            streaming: false // Mark as complete
                        };
                    }

                    // Save ratings to persistent storage
                    saveTweetRatings();
                } else {
                    // On error, remove any existing cache entry to allow retry
                    if (tweetIDRatingCache[tweetId]) {
                        delete tweetIDRatingCache[tweetId];
                        saveTweetRatings();
                    }
                }

            } catch (apiError) {
                score = 10; // Fallback to a random score
                tweetArticle.dataset.ratingStatus = 'error';
                tweetArticle.dataset.ratingDescription = "API error";
                // Don't consider API errors as successful processing
                processingSuccessful = false;
            }
        } else if (fullContextWithImageDescription) {
            score = 10;
            //show all tweets that errored
            tweetArticle.dataset.ratingStatus = 'error';
            tweetArticle.dataset.ratingDescription = "No API key";
            processingSuccessful = true;
        } else {
            //show all tweets that errored
            score = 10;
            tweetArticle.dataset.ratingStatus = 'error';
            tweetArticle.dataset.ratingDescription = "No content";
            processingSuccessful = true;
        }

        // Always ensure a valid score is set
        if (score === undefined || score === null) {
            score = 5;
        }

        tweetArticle.dataset.sloppinessScore = score.toString();
        try {
            //group should default to closed

            setScoreIndicator(tweetArticle, score, tweetArticle.dataset.ratingStatus, tweetArticle.dataset.ratingDescription || "");
            // Final verification of indicator
            if (!tweetArticle.querySelector('.score-indicator')) {
                processingSuccessful = false;
            }
        } catch (e) {

            processingSuccessful = false;
        }
        filterSingleTweet(tweetArticle);
    } catch (error) {

        if (!tweetArticle.dataset.sloppinessScore) {
            tweetArticle.dataset.sloppinessScore = '5';
            tweetArticle.dataset.ratingStatus = 'error';
            tweetArticle.dataset.ratingDescription = "error processing tweet";
            try {
                setScoreIndicator(tweetArticle, 5, 'error', 'Error processing tweet');
                // Verify indicator exists
                if (!tweetArticle.querySelector('.score-indicator')) {

                }
            } catch (e) {

            }
            filterSingleTweet(tweetArticle);
        }
        processingSuccessful = false;
    } finally {
        // If processing was not successful, remove from processedTweets
        // to allow future retry attempts
        if (!processingSuccessful) {
            processedTweets.delete(tweetId);
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

    // Fast-path: if author is blacklisted, assign score immediately
    const handles = getUserHandles(tweetArticle);
    const userHandle = handles.length > 0 ? handles[0] : '';
    if (userHandle && isUserBlacklisted(userHandle)) {
        tweetArticle.dataset.sloppinessScore = '10';
        tweetArticle.dataset.blacklisted = 'true';
        tweetArticle.dataset.ratingStatus = 'blacklisted';
        tweetArticle.dataset.ratingDescription = "Whitelisted user";
        setScoreIndicator(tweetArticle, 10, 'blacklisted', "User is whitelisted");
        filterSingleTweet(tweetArticle);
        return;
    }

    // Check for a cached rating, but be careful with streaming cache entries
    if (tweetIDRatingCache[tweetId]) {
        // Only apply cached rating if it has a valid score and isn't an incomplete streaming entry
        const isIncompleteStreaming =
            tweetIDRatingCache[tweetId].streaming === true &&
            (tweetIDRatingCache[tweetId].score === undefined || tweetIDRatingCache[tweetId].score === null);
        
        if (!isIncompleteStreaming) {
            const wasApplied = applyTweetCachedRating(tweetArticle);
            if (wasApplied) {
                // Force redraw filter to ensure the tweet is properly filtered
                filterSingleTweet(tweetArticle);
                return;
            }
        }
    }

    // Skip if already processed in this session
    if (processedTweets.has(tweetId)) {
        // Verify that the tweet actually has an indicator - if not, remove from processed
        const hasIndicator = !!tweetArticle.querySelector('.score-indicator');
        if (!hasIndicator) {

            processedTweets.delete(tweetId);
        } else {
            return;
        }
    }

    // Immediately mark as pending before scheduling actual processing
    if (!processedTweets.has(tweetId)) {
        processedTweets.add(tweetId);
    }
    tweetArticle.dataset.ratingStatus = 'pending';

    // Ensure indicator is set
    try {
        setScoreIndicator(tweetArticle, null, 'pending');
    } catch (e) {

    }

    // Now schedule the actual rating processing
    setTimeout(() => {
        try {
            delayedProcessTweet(tweetArticle, tweetId);
        } catch (e) {

            processedTweets.delete(tweetId);
        }
    }, PROCESSING_DELAY_MS);
}

// Add this near the beginning of the file with other global variables
// Store reply relationships across sessions
let threadRelationships = {};
let lastThreadCheck = 0;
const THREAD_CHECK_INTERVAL = 2000; // 2 seconds between thread checks
let threadMappingInProgress = false; // Add a memory-based flag for more reliable state tracking

// Load thread relationships from storage on script initialization
function loadThreadRelationships() {
    try {
        const savedRelationships = GM_getValue('threadRelationships', '{}');
        threadRelationships = JSON.parse(savedRelationships);

    } catch (e) {

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
        
        GM_setValue('threadRelationships', JSON.stringify(threadRelationships));
    } catch (e) {

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
    
    // Allow a small delay for images to load
    await new Promise(resolve => setTimeout(resolve, 10));
    
    let allMediaLinks = extractMediaLinks(tweetArticle);

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
        // Short delay to ensure quoted tweet images are loaded
        await new Promise(resolve => setTimeout(resolve, 20));
        quotedMediaLinks = extractMediaLinks(quoteContainer);
    }
    
    // Get thread media URLs from cache if available
    const conversation = document.querySelector('div[aria-label="Timeline: Conversation"]') || 
        document.querySelector('div[aria-label^="Timeline: Conversation"]');
    
    let threadMediaUrls = [];
    if (conversation && conversation.dataset.threadMapping && tweetIDRatingCache[tweetId]?.threadContext?.threadMediaUrls) {
        // Get thread media URLs from cache if available
        threadMediaUrls = tweetIDRatingCache[tweetId].threadContext.threadMediaUrls || [];
    } else if (conversation && conversation.dataset.threadMediaUrls) {
        // Or get them from the dataset if available
        try {
            const allMediaUrls = JSON.parse(conversation.dataset.threadMediaUrls);
            threadMediaUrls = Array.isArray(allMediaUrls) ? allMediaUrls : [];
        } catch (e) {

        }
    }
    
    // Combine all media URLs: current tweet + quoted tweet + thread context
    let allAvailableMediaLinks = [...allMediaLinks];
    
    // Remove any media links from the main tweet that also appear in the quoted tweet
    let mainMediaLinks = allAvailableMediaLinks.filter(link => !quotedMediaLinks.includes(link));
    
    // Start building the context
    let fullContextWithImageDescription = `[TWEET ${tweetId}]
 Author:@${userHandle}:
` + mainText;

    // Add media from the current tweet
    if (mainMediaLinks.length > 0) {
        // Process main tweet images only if image descriptions are enabled
        if (enableImageDescriptions = GM_getValue('enableImageDescriptions', false)) {
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

        let unreatedCount = 0;

        tweets.forEach(tweet => {
            const tweetId = getTweetID(tweet);
            if (!tweetId) return; // Skip tweets without a valid ID

            // Check for any issues that would require processing:
            // 1. No score data attribute
            // 2. Error status
            // 3. Missing indicator element (even if in processedTweets)
            const hasScore = !!tweet.dataset.sloppinessScore;
            const hasError = tweet.dataset.ratingStatus === 'error';
            const hasIndicator = !!tweet.querySelector('.score-indicator');
            const isStreaming = tweet.dataset.ratingStatus === 'streaming';

            // If tweet is in processedTweets but missing indicator, remove it from processed
            if (processedTweets.has(tweetId) && !hasIndicator) {

                processedTweets.delete(tweetId);
            }

            // Schedule processing if needed and not already in progress
            const needsProcessing = (!hasScore && !isStreaming) || hasError || !hasIndicator;
            if (needsProcessing && !processedTweets.has(tweetId)) {
                unreatedCount++;
                const status = !hasIndicator ? 'missing indicator' :
                    !hasScore ? 'unrated' :
                        hasError ? 'error' : 'unknown issue';

                scheduleTweetProcessing(tweet);
            }
        });

        if (unreatedCount > 0) {

        }
    }
}

async function handleThreads() {
    try {
        // Don't check too frequently
        const now = Date.now();
        if (now - lastThreadCheck < THREAD_CHECK_INTERVAL) {
            return;
        }
        lastThreadCheck = now;
        
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
            if (now - lastMappedTime < 10000) {
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
                    const apiKey = GM_getValue('openrouter-api-key', '');
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
                    }, 500);
                } catch (error) {

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
                    
                    if (tweetIDRatingCache[tweetId] && tweetIDRatingCache[tweetId].tweetContent) {
                        threadHist = threadHist + "\n[REPLY]\n" + tweetIDRatingCache[tweetId].tweetContent;
                    } else {
                        const apiKey = GM_getValue('openrouter-api-key', '');
                        await new Promise(resolve => setTimeout(resolve, 100));
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
            }, 500);
        }
    } catch (error) {

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
                    let mediaLinks = extractMediaLinks(article);
                    
                    // Extract quoted tweet media if any
                    let quotedMediaLinks = [];
                    const quoteContainer = article.querySelector(QUOTE_CONTAINER_SELECTOR);
                    if (quoteContainer) {
                        quotedMediaLinks = extractMediaLinks(quoteContainer);
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

                    // Continue with next tweet
                    continue;
                }
            }
            
            // Build reply structure only if we have tweets to process
            if (tweetCells.length === 0) {

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
                        const apiKey = GM_getValue('openrouter-api-key', '');
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
                    if (doc.tweetId && tweetIDRatingCache[doc.tweetId]) {
                        tweetIDRatingCache[doc.tweetId].threadContext = {
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
                                                  (tweetIDRatingCache[doc.tweetId] && tweetIDRatingCache[doc.tweetId].streaming === true);
                                
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
                // Get all media URLs from tweets before this one in the thread
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


    // ----- ui.js -----
// --- Utility Functions ---

/**
 * Displays a temporary status message on the screen.
 * @param {string} message - The message to display.
 */
function showStatus(message) {
    const indicator = document.getElementById('status-indicator');
    if (!indicator) {

        return;
    }
    indicator.textContent = message;
    indicator.classList.add('active');
    setTimeout(() => { indicator.classList.remove('active'); }, 3000);
}

/**
 * Toggles the visibility of an element and updates the corresponding toggle button text.
 * @param {HTMLElement} element - The element to toggle.
 * @param {HTMLElement} toggleButton - The button that controls the toggle.
 * @param {string} openText - Text for the button when the element is open.
 * @param {string} closedText - Text for the button when the element is closed.
 */
function toggleElementVisibility(element, toggleButton, openText, closedText) {
    if (!element || !toggleButton) return;

    const isHidden = element.classList.toggle('hidden');
    toggleButton.innerHTML = isHidden ? closedText : openText;

    // Special case for filter slider button (hide it when panel is shown)
    if (element.id === 'tweet-filter-container') {
        const filterToggle = document.getElementById('filter-toggle');
        if (filterToggle) {
            filterToggle.style.display = isHidden ? 'block' : 'none';
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
    if(MENU){
        menuHTML = MENU;
    }else{
        menuHTML = GM_getValue('menuHTML');
    }
    
    if (!menuHTML) {

        showStatus('Error: Could not load UI components.');
        return null;
    }

    // Create a container to inject HTML
    const containerId = 'tweetfilter-root-container'; // Use the ID from the updated HTML
    let uiContainer = document.getElementById(containerId);
    if (uiContainer) {

        return uiContainer; // Return existing container
    }

    uiContainer = document.createElement('div');
    uiContainer.id = containerId;
    uiContainer.innerHTML = menuHTML;

    // Inject styles
    const stylesheet = uiContainer.querySelector('style');
    if (stylesheet) {
        GM_addStyle(stylesheet.textContent);

        stylesheet.remove(); // Remove style tag after injecting
    } else {

    }

    // Append the rest of the UI elements
    document.body.appendChild(uiContainer);

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

        return;
    }

    const settingsContainer = uiContainer.querySelector('#settings-container');
    const filterContainer = uiContainer.querySelector('#tweet-filter-container');
    const settingsToggleBtn = uiContainer.querySelector('#settings-toggle');
    const filterToggleBtn = uiContainer.querySelector('#filter-toggle');

    // --- Delegated Event Listener for Clicks ---
    uiContainer.addEventListener('click', (event) => {
        const target = event.target;
        const action = target.dataset.action;
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
                case 'close-settings':
                    toggleElementVisibility(settingsContainer, settingsToggleBtn, '<span style="font-size: 14px;">✕</span> Close', '<span style="font-size: 14px;">⚙️</span> Settings');
                    break;
                case 'save-api-key':
                    saveApiKey();
                    break;
                case 'clear-cache':
                    clearTweetRatingsAndRefreshUI();
                    break;
                case 'export-settings':
                    exportSettings();
                    break;
                case 'import-settings':
                    importSettings();
                    break;
                case 'reset-settings':
                    resetSettings();
                    break;
                case 'save-instructions':
                    saveInstructions();
                    break;
                case 'add-handle':
                    addHandleFromInput();
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

    // Settings Toggle Button
    if (settingsToggleBtn) {
        settingsToggleBtn.onclick = () => {
            toggleElementVisibility(settingsContainer, settingsToggleBtn, '<span style="font-size: 14px;">✕</span> Close', '<span style="font-size: 14px;">⚙️</span> Settings');
        };
    }

    // Filter Toggle Button
    if (filterToggleBtn) {
        filterToggleBtn.onclick = () => {
             // Ensure filter container is shown and button is hidden
             if (filterContainer) filterContainer.classList.remove('hidden');
             filterToggleBtn.style.display = 'none';
        };
    }

    // Close custom selects when clicking outside
    document.addEventListener('click', closeAllSelectBoxes);

    // Add handlers for new controls
    const showFreeModelsCheckbox = uiContainer.querySelector('#show-free-models');
    if (showFreeModelsCheckbox) {
        showFreeModelsCheckbox.addEventListener('change', function() {
            showFreeModels = this.checked;
            GM_setValue('showFreeModels', showFreeModels);
            refreshModelsUI();
        });
    }

    const sortDirectionBtn = uiContainer.querySelector('#sort-direction');
    if (sortDirectionBtn) {
        sortDirectionBtn.addEventListener('click', function() {
            const currentDirection = GM_getValue('sortDirection', 'default');
            const newDirection = currentDirection === 'default' ? 'reverse' : 'default';
            GM_setValue('sortDirection', newDirection);
            this.dataset.value = newDirection;
            refreshModelsUI();
        });
    }

    const modelSortSelect = uiContainer.querySelector('#model-sort-order');
    if (modelSortSelect) {
        modelSortSelect.addEventListener('change', function() {
            GM_setValue('modelSortOrder', this.value);
            // Set default direction for latency and age
            if (this.value === 'latency-low-to-high') {
                GM_setValue('sortDirection', 'default'); // Show lowest latency first
            } else if (this.value === '') { // Age
                GM_setValue('sortDirection', 'default'); // Show newest first
            }
            refreshModelsUI();
        });
    }

    const providerSortSelect = uiContainer.querySelector('#provider-sort');
    if (providerSortSelect) {
        providerSortSelect.addEventListener('change', function() {
            providerSort = this.value;
            GM_setValue('providerSort', providerSort);
        });
    }

}

// --- Event Handlers ---

/** Saves the API key from the input field. */
function saveApiKey() {
    const apiKeyInput = document.getElementById('openrouter-api-key');
    const apiKey = apiKeyInput.value.trim();
    let previousAPIKey = GM_getValue('openrouter-api-key', '').length>0?true:false;
    if (apiKey) {
        if (!previousAPIKey){
            resetSettings(true);
            //jank hack to get the UI defaults to load correctly
        }
        GM_setValue('openrouter-api-key', apiKey);
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
        // Clear tweet ratings cache
        Object.keys(tweetIDRatingCache).forEach(key => delete tweetIDRatingCache[key]);
        GM_setValue('tweetRatings', '{}');
        
        // Clear thread relationships cache
        if (window.threadRelationships) {
            window.threadRelationships = {};
            GM_setValue('threadRelationships', '{}');

        }
        
        showStatus('All cached ratings and thread relationships cleared!');

        updateCacheStatsUI();

        // Re-process visible tweets
        if (observedTargetNode) {
            observedTargetNode.querySelectorAll(TWEET_ARTICLE_SELECTOR).forEach(tweet => {
                tweet.dataset.sloppinessScore = ''; // Clear potential old score attribute
                delete tweet.dataset.cachedRating;
                delete tweet.dataset.blacklisted;
                processedTweets.delete(getTweetID(tweet));
                scheduleTweetProcessing(tweet);
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

/** Saves the custom instructions from the textarea. */
function saveInstructions() {
    const instructionsTextarea = document.getElementById('user-instructions');
    USER_DEFINED_INSTRUCTIONS = instructionsTextarea.value;
    GM_setValue('userDefinedInstructions', USER_DEFINED_INSTRUCTIONS);
    showStatus('Scoring instructions saved! New tweets will use these instructions.');
    if (isMobileDevice() || confirm('Do you want to clear the rating cache to apply these instructions to all tweets?')) {
        clearTweetRatingsAndRefreshUI();
    }
}

/** Adds a handle from the input field to the blacklist. */
function addHandleFromInput() {
    const handleInput = document.getElementById('handle-input');
    const handle = handleInput.value.trim();
    if (handle) {
        addHandleToBlacklist(handle);
        handleInput.value = ''; // Clear input after adding
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
    GM_setValue(settingName, value);

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
    GM_setValue(paramName, newValue);
}

/**
 * Handles changes to the main filter slider.
 * @param {HTMLElement} slider - The filter slider element.
 */
function handleFilterSliderChange(slider) {
    const valueDisplay = document.getElementById('tweet-filter-value');
    currentFilterThreshold = parseInt(slider.value, 10);
    if (valueDisplay) {
        valueDisplay.textContent = currentFilterThreshold.toString();
    }
    
    // Update the gradient position based on the slider value
    const percentage = (currentFilterThreshold / 10) * 100;
    slider.style.setProperty('--slider-percent', `${percentage}%`);
    
    GM_setValue('filterThreshold', currentFilterThreshold);
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

// --- UI Update Functions ---

/** Updates the cache statistics display in the General tab. */
function updateCacheStatsUI() {
    const cachedCountEl = document.getElementById('cached-ratings-count');
    const whitelistedCountEl = document.getElementById('whitelisted-handles-count');

    if (cachedCountEl) {
        cachedCountEl.textContent = Object.keys(tweetIDRatingCache).length;
    }
    if (whitelistedCountEl) {
        whitelistedCountEl.textContent = blacklistedHandles.length;
    }
}

/**
 * Refreshes the entire settings UI to reflect current settings.
 */
function refreshSettingsUI() {
    // Update general settings inputs/toggles
    document.querySelectorAll('[data-setting]').forEach(input => {
        const settingName = input.dataset.setting;
        const value = GM_getValue(settingName, window[settingName]); // Get saved or default value
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
        const value = GM_getValue(paramName, window[paramName]);

        if (slider) slider.value = value;
        if (valueInput) valueInput.value = value;
    });

    // Update filter slider
    const filterSlider = document.getElementById('tweet-filter-slider');
    const filterValueDisplay = document.getElementById('tweet-filter-value');
    if (filterSlider && filterValueDisplay) {
        filterSlider.value = currentFilterThreshold.toString();
        filterValueDisplay.textContent = currentFilterThreshold.toString();
        // Initialize the gradient position
        const percentage = (currentFilterThreshold / 10) * 100;
        filterSlider.style.setProperty('--slider-percent', `${percentage}%`);
    }

    // Refresh dynamically populated lists/dropdowns
        refreshHandleList(document.getElementById('handle-list'));
    refreshModelsUI(); // Refreshes model dropdowns

    // Update cache stats
    updateCacheStatsUI();

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
    const sortDirection = GM_getValue('sortDirection', 'default');
    const sortOrder = GM_getValue('modelSortOrder', 'throughput-high-to-low');
    
    // Update toggle button text based on sort order
    const toggleBtn = document.getElementById('sort-direction');
    if (toggleBtn) {
        switch(sortOrder) {
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
                GM_setValue('selectedModel', selectedModel);
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
                GM_setValue('selectedImageModel', selectedImageModel);
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
            pricingInfo += ` - $${promptPrice.toFixed(7)}/in`;
            if (!isNaN(completionPrice) && completionPrice !== promptPrice) {
                pricingInfo += ` $${completionPrice.toFixed(7)}/out`;
            }
        } else if (!isNaN(completionPrice)) {
            // Handle case where only completion price is available (less common)
            pricingInfo += ` - $${completionPrice.toFixed(7)}/out`;
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

// --- Rating Indicator Logic (Simplified, assuming CSS handles most styling) ---

/**
 * Updates or creates the rating indicator on a tweet article.
 * @param {Element} tweetArticle - The tweet article element.
 * @param {number|null} score - The numeric rating (null if pending/error).
 * @param {string} status - 'pending', 'rated', 'error', 'cached', 'blacklisted', 'streaming'.
 * @param {string} [description] - Optional description for hover tooltip.
 * @param {string} [reasoning] - Optional reasoning trace.
 */
function setScoreIndicator(tweetArticle, score, status, description = "", reasoning = "") {
    const tweetId = getTweetID(tweetArticle);
    let indicator = tweetArticle.querySelector('.score-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.className = 'score-indicator';
        tweetArticle.style.position = 'relative'; // Ensure parent is positioned
        tweetArticle.appendChild(indicator);
        
        // Create a unique tooltip for this indicator
        const tooltip = document.createElement('div');
        tooltip.className = 'score-description';
        tooltip.style.display = 'none';
        
        // Store the tweet ID in the tooltip's dataset for cleanup
        tooltip.dataset.tweetId = tweetId;
        
        // Create the fixed structure for the tooltip
        // Add tooltip controls row with pin and copy buttons
        const tooltipControls = document.createElement('div');
        tooltipControls.className = 'tooltip-controls';
        
        const pinButton = document.createElement('button');
        pinButton.className = 'tooltip-pin-button';
        pinButton.innerHTML = '📌';
        pinButton.title = 'Pin tooltip (prevents auto-closing)';
        pinButton.addEventListener('click', function(e) {
            e.stopPropagation();
            const isPinned = tooltip.classList.toggle('pinned');
            this.innerHTML = isPinned ? '📍' : '📌';
            this.title = isPinned ? 'Unpin tooltip' : 'Pin tooltip (prevents auto-closing)';
        });
        
        const copyButton = document.createElement('button');
        copyButton.className = 'tooltip-copy-button';
        copyButton.innerHTML = '📋';
        copyButton.title = 'Copy content to clipboard';
        copyButton.addEventListener('click', function(e) {
            e.stopPropagation();
            const description = tooltip.querySelector('.description-text');
            const reasoning = tooltip.querySelector('.reasoning-text');
            let textToCopy = description ? description.textContent : '';
            if (reasoning && reasoning.textContent) {
                textToCopy += '\n\nReasoning:\n' + reasoning.textContent;
            }
            navigator.clipboard.writeText(textToCopy).then(() => {
                const originalText = this.innerHTML;
                this.innerHTML = '✓';
                setTimeout(() => {
                    this.innerHTML = originalText;
                }, 1500);
            }).catch(err => {

            });
        });
        
        tooltipControls.appendChild(pinButton);
        tooltipControls.appendChild(copyButton);
        tooltip.appendChild(tooltipControls);
        
        // Create the reasoning dropdown structure upfront
        const reasoningDropdown = document.createElement('div');
        reasoningDropdown.className = 'reasoning-dropdown';
        
        // Create the toggle button without inline event
        const reasoningToggle = document.createElement('div');
        reasoningToggle.className = 'reasoning-toggle';
        
        const arrow = document.createElement('span');
        arrow.className = 'reasoning-arrow';
        arrow.textContent = '▶';
        
        reasoningToggle.appendChild(arrow);
        reasoningToggle.appendChild(document.createTextNode(' Show Reasoning Trace'));
        
        // Add event listener properly
        reasoningToggle.addEventListener('click', function(e) {
            e.stopPropagation(); // Prevent bubbling to tooltip click handler
            const dropdown = this.closest('.reasoning-dropdown');
            dropdown.classList.toggle('expanded');
            
            // Update arrow
            const arrowSpan = this.querySelector('.reasoning-arrow');
            arrowSpan.textContent = dropdown.classList.contains('expanded') ? '▼' : '▶';
            
            // Ensure content is visible when expanded
            const content = dropdown.querySelector('.reasoning-content');
            if (dropdown.classList.contains('expanded')) {
                content.style.maxHeight = '300px';
                content.style.padding = '10px';
            } else {
                content.style.maxHeight = '0';
                content.style.padding = '0';
            }
        });
        
        // Create reasoning content
        const reasoningContent = document.createElement('div');
        reasoningContent.className = 'reasoning-content';
        
        const reasoningText = document.createElement('p');
        reasoningText.className = 'reasoning-text';
        
        reasoningContent.appendChild(reasoningText);
        
        // Assemble the dropdown
        reasoningDropdown.appendChild(reasoningToggle);
        reasoningDropdown.appendChild(reasoningContent);
        
        tooltip.appendChild(reasoningDropdown);
        
        // Create a paragraph for the description
        const descriptionParagraph = document.createElement('p');
        descriptionParagraph.className = 'description-text';
        tooltip.appendChild(descriptionParagraph);
        
        // Add scroll-to-bottom button
        const scrollButton = document.createElement('div');
        scrollButton.className = 'scroll-to-bottom-button';
        scrollButton.innerHTML = '⬇ Scroll to bottom';
        scrollButton.style.display = 'none'; // Hidden by default
        scrollButton.addEventListener('click', (e) => {
            e.stopPropagation();
            // Enable smooth scrolling
            tooltip.style.scrollBehavior = 'smooth';
            // Smooth scroll to bottom
            tooltip.scrollTo({
                top: tooltip.scrollHeight,
                behavior: 'smooth'
            });
            // Second scroll after animation completes to catch any new content
            setTimeout(() => {
                tooltip.scrollTo({
                    top: tooltip.scrollHeight,
                    behavior: 'smooth'
                });
            }, 500);
            tooltip.dataset.autoScroll = 'true';
            scrollButton.style.display = 'none';
        });
        tooltip.appendChild(scrollButton);
        
        // Add some spacing at the bottom for better scrolling experience
        const bottomSpacer = document.createElement('div');
        bottomSpacer.className = 'tooltip-bottom-spacer';
        tooltip.appendChild(bottomSpacer);
        
        // Set initial auto-scroll state
        tooltip.dataset.autoScroll = 'true';
        
        // Add scroll event to detect when user manually scrolls
        tooltip.addEventListener('scroll', () => {
            // Check if we're near the bottom
            const isNearBottom = tooltip.scrollHeight - tooltip.scrollTop - tooltip.clientHeight < isMobileDevice()? 40: 30;
            
            if (!isNearBottom && tooltip.dataset.autoScroll === 'true') {
                // User has scrolled up, disable auto-scroll
                tooltip.dataset.autoScroll = 'false';
                
                // Show the scroll-to-bottom button
                if (tooltip.classList.contains('streaming-tooltip')) {
                    const scrollButton = tooltip.querySelector('.scroll-to-bottom-button');
                    if (scrollButton && scrollButton.style.display === 'none') {
                        scrollButton.style.display = 'block';
                    }
                }
            } else if (isNearBottom && tooltip.dataset.autoScroll === 'false') {
                // User has manually scrolled to bottom, re-enable auto-scroll
                tooltip.dataset.autoScroll = 'true';
                
                // Hide the scroll-to-bottom button
                const scrollButton = tooltip.querySelector('.scroll-to-bottom-button');
                if (scrollButton) {
                    scrollButton.style.display = 'none';
                }
            }
        });
        
        document.body.appendChild(tooltip); // Append to body instead of indicator
        
        // Store the tooltip reference
        indicator.scoreTooltip = tooltip;
        
        // Add mouse hover listeners
        indicator.addEventListener('mouseenter', handleIndicatorMouseEnter);
        indicator.addEventListener('mouseleave', handleIndicatorMouseLeave);
        
        // Add click/tap handler for toggling tooltip
        indicator.addEventListener('click', function(e) {
            e.stopPropagation(); // Prevent opening the tweet
            e.preventDefault();
            toggleTooltipVisibility(this);
        });
        
        // Also add hover listeners to the tooltip
        tooltip.addEventListener('mouseenter', () => {
            if (!tooltip.classList.contains('pinned')) {
                tooltip.style.display = 'block';
            }
        });
        tooltip.addEventListener('mouseleave', () => {
            if (!tooltip.classList.contains('pinned')) {
                tooltip.style.display = 'none';
            }
        });
        
        // Add click handler to close tooltip when clicking outside
        tooltip.addEventListener('click', (e) => {
            // Only if not clicking reasoning toggle, buttons, or scroll button
            if (!e.target.closest('.reasoning-toggle') && 
                !e.target.closest('.scroll-to-bottom-button') &&
                !e.target.closest('.tooltip-controls')) {
                if (!tooltip.classList.contains('pinned')) {
                    tooltip.style.display = 'none';
                }
            }
        });
        
        // Apply mobile positioning if needed
        if (isMobileDevice()) {
            indicator.classList.add('mobile-indicator');
        }
    }

    // Update status class and text content
    indicator.classList.remove('pending-rating', 'rated-rating', 'error-rating', 'cached-rating', 'blacklisted-rating', 'streaming-rating'); // Clear previous
    indicator.dataset.description = description || ''; // Store description
    indicator.dataset.reasoning = reasoning || ''; // Store reasoning
    indicator.dataset.tweetId = tweetId; // Store tweet ID in indicator
    
    // Update the tooltip content
    const tooltip = indicator.scoreTooltip;
    if (tooltip) {
        tooltip.dataset.tweetId = tweetId; // Ensure the tooltip also has the tweet ID
        updateTooltipContent(tooltip, description, reasoning);
    }

    switch (status) {
        case 'pending':
            indicator.classList.add('pending-rating');
            indicator.textContent = '⏳';
            break;
        case 'streaming':
            indicator.classList.add('streaming-rating');
            indicator.textContent = '🔄';
            break;
        case 'error':
            indicator.classList.add('error-rating');
            indicator.textContent = '⚠️';
            break;
        case 'cached':
            indicator.classList.add('cached-rating');
            indicator.textContent = score;
            break;
        case 'blacklisted':
            indicator.classList.add('blacklisted-rating');
            indicator.textContent = score; // Typically 10 for blacklisted
            break;
        case 'rated': // Default/normal rated
        default:
            indicator.classList.add('rated-rating'); // Add a general rated class
            indicator.textContent = score;
            break;
    }
}

/**
 * Toggles the visibility of a tooltip associated with an indicator
 * @param {HTMLElement} indicator - The indicator element
 */
function toggleTooltipVisibility(indicator) {
    const tooltip = indicator.scoreTooltip;
    if (!tooltip) return;
    
    if (tooltip.style.display === 'block') {
        // Don't close if pinned
        if (!tooltip.classList.contains('pinned')) {
            tooltip.style.display = 'none';
        }
    } else {
        positionTooltip(indicator, tooltip);
        tooltip.style.display = 'block';
    }
}

/**
 * Positions the tooltip relative to the indicator
 * @param {HTMLElement} indicator - The indicator element
 * @param {HTMLElement} tooltip - The tooltip element
 */
function positionTooltip(indicator, tooltip) {
    if (!indicator || !tooltip) return;
    
    const rect = indicator.getBoundingClientRect();
    const margin = 10;
    const isMobile = isMobileDevice();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const safeArea = viewportHeight - margin; // Safe area to stay within
    
    // Reset any previous height constraints to measure true dimensions
    tooltip.style.maxHeight = '';
    tooltip.style.overflowY = '';
    
    // Force layout recalculation to get true dimensions
    tooltip.style.display = 'block';
    tooltip.style.visibility = 'hidden';
    
    const tooltipWidth = tooltip.offsetWidth;
    const tooltipHeight = tooltip.offsetHeight;
    
    let left, top;
    
    if (isMobile) {
        // Center tooltip horizontally on mobile
        left = Math.max(0, (viewportWidth - tooltipWidth) / 2);
        
        // Always apply a max-height on mobile to ensure scrollability
        const maxTooltipHeight = viewportHeight * 0.8; // 80% of viewport
        
        // If tooltip is taller than allowed, constrain it and enable scrolling
        if (tooltipHeight > maxTooltipHeight) {
            tooltip.style.maxHeight = `${maxTooltipHeight}px`;
            tooltip.style.overflowY = 'scroll';
        }
        
        // Position at the bottom part of the screen
        top = (viewportHeight - tooltip.offsetHeight) / 2;
        
        // Ensure it's always fully visible
        if (top < margin) {
            top = margin;
        }
        if (top + tooltip.offsetHeight > safeArea) {
            top = safeArea - tooltip.offsetHeight;
        }
    } else {
        // Desktop positioning - to the right of indicator
        left = rect.right + margin;
        top = rect.top + (rect.height / 2) - (tooltipHeight / 2);
        
        // Check horizontal overflow
        if (left + tooltipWidth > viewportWidth - margin) {
            // Try positioning to the left of indicator
            left = rect.left - tooltipWidth - margin;
            
            // If that doesn't work either, center horizontally
            if (left < margin) {
                left = Math.max(margin, (viewportWidth - tooltipWidth) / 2);
                // And position below or above the indicator
                if (rect.bottom + tooltipHeight + margin <= safeArea) {
                    top = rect.bottom + margin;
                } else if (rect.top - tooltipHeight - margin >= margin) {
                    top = rect.top - tooltipHeight - margin;
                } else {
                    // If doesn't fit above or below, center vertically
                    top = margin;
                    // Apply max height and scrolling
                    tooltip.style.maxHeight = `${safeArea - (margin * 2)}px`;
                    tooltip.style.overflowY = 'scroll';
                }
            }
        }
        
        // Final vertical adjustment and scrolling if needed
        if (top < margin) {
            top = margin;
        }
        if (top + tooltipHeight > safeArea) {
            // If tooltip is too tall for the viewport, enable scrolling
            if (tooltipHeight > safeArea - margin) {
                top = margin;
                tooltip.style.maxHeight = `${safeArea - (margin * 2)}px`;
                tooltip.style.overflowY = 'scroll';
            } else {
                // Otherwise just move it up
                top = safeArea - tooltipHeight;
            }
        }
    }
    
    // Apply the position
    tooltip.style.position = 'fixed';
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.style.zIndex = '99999999';
    tooltip.style.visibility = 'visible';
    
    // Force scrollbars on WebKit browsers if needed
    if (tooltip.style.overflowY === 'scroll') {
        tooltip.style.WebkitOverflowScrolling = 'touch';
    }
    
    // Store the current scroll position to check if user has manually scrolled
    tooltip.lastScrollTop = tooltip.scrollTop;
    
    // Update scroll position for streaming tooltips
    if (tooltip.classList.contains('streaming-tooltip')) {
        const isAtBottom = tooltip.scrollHeight - tooltip.scrollTop - tooltip.clientHeight < 30;
        const isInitialDisplay = tooltip.lastDisplayTime === undefined || 
                               (Date.now() - tooltip.lastDisplayTime) > 1000;
        
        if (isInitialDisplay || isAtBottom) {
            setTimeout(() => {
                tooltip.scrollTop = tooltip.scrollHeight;
            }, 10);
        }
    }
    
    // Track when we displayed the tooltip
    tooltip.lastDisplayTime = Date.now();
}

/**
 * Detects if the user is on a mobile device
 * @returns {boolean} true if mobile device detected
 */
function isMobileDevice() {
    return (window.innerWidth <= 600 || 
            /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
}

/** 
 * This function is no longer needed as each indicator has its own tooltip 
 * It's kept for backward compatibility but is not used 
 */
function getScoreTooltip() {

    return null;
}

/** Formats description text for the tooltip. */
function formatTooltipDescription(description, reasoning = "") {
    description=description||"*waiting for content...*";
    
    // Add markdown-style formatting
    description = description.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>'); // Bold
    description = description.replace(/\*([^*]+)\*/g, '<em>$1</em>'); // Italic
    //h4
    description = description.replace(/^#### (.*)$/gm, '<h4>$1</h4>');
    //h3
    description = description.replace(/^### (.*)$/gm, '<h3>$1</h3>');
    //h2
    description = description.replace(/^## (.*)$/gm, '<h2>$1</h2>');
    //h1
    description = description.replace(/^# (.*)$/gm, '<h1>$1</h1>');
    
    // Basic formatting, can be expanded
    description = description.replace(/SCORE_(\d+)/g, '<span style="display:inline-block;background-color:#1d9bf0;color:white;padding:3px 10px;border-radius:9999px;margin:8px 0;font-weight:bold;">SCORE: $1</span>');
    description = description.replace(/\n\n/g, '<br><br>'); // Keep in single paragraph
    description = description.replace(/\n/g, '<br>');
    
    // Format reasoning trace with markdown support if provided
    let formattedReasoning = '';
    if (reasoning && reasoning.trim()) {
        formattedReasoning = reasoning
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>') // Bold
            .replace(/\*([^*]+)\*/g, '<em>$1</em>') // Italic
            .replace(/\n\n/g, '<br><br>') // Keep in single paragraph
            .replace(/\n/g, '<br>');
    }
    
    return {
        description: description,
        reasoning: formattedReasoning
    };
}

/**
 * Updates tooltip content during streaming
 * @param {HTMLElement} tooltip - The tooltip element to update
 * @param {string} description - Current description content
 * @param {string} reasoning - Current reasoning content
 */
function updateTooltipContent(tooltip, description, reasoning) {
    if (!tooltip) return;
    
    const formatted = formatTooltipDescription(description, reasoning);
    
    // Update only the contents, not the structure
    const descriptionElement = tooltip.querySelector('.description-text');
    if (descriptionElement) {
        descriptionElement.innerHTML = formatted.description;
    }
    
    const reasoningElement = tooltip.querySelector('.reasoning-text');
    if (reasoningElement && formatted.reasoning) {
        reasoningElement.innerHTML = formatted.reasoning;
        
        // Make reasoning dropdown visible only if there is content
        const dropdown = tooltip.querySelector('.reasoning-dropdown');
        if (dropdown) {
            dropdown.style.display = formatted.reasoning ? 'block' : 'none';
        }
    }
    
    // Auto-scroll behavior for streaming updates
    if (tooltip.style.display === 'block') {
        // Check if auto-scroll is enabled for this tooltip
        if (tooltip.dataset.autoScroll === 'true') {
            // Use smooth scrolling behavior
            if (!tooltip.style.scrollBehavior) {
                tooltip.style.scrollBehavior = 'smooth';
            }
            
            // Calculate if we're already near the bottom
            const isNearBottom = tooltip.scrollHeight - tooltip.scrollTop - tooltip.clientHeight < 30;
            
            // Only smooth scroll if we're not already near the bottom
            if (!isNearBottom) {
                // Use requestAnimationFrame to ensure we're scrolling after content is rendered
                requestAnimationFrame(() => {
                    tooltip.scrollTo({
                        top: tooltip.scrollHeight,
                        behavior: 'smooth'
                    });
                });
            } else {
                // If we're already near bottom, just jump to keep up with content
                requestAnimationFrame(() => {
                    tooltip.scrollTop = tooltip.scrollHeight;
                });
            }
        } else {
            // Show the scroll-to-bottom button if we're in a streaming tooltip
            if (tooltip.classList.contains('streaming-tooltip')) {
                const scrollButton = tooltip.querySelector('.scroll-to-bottom-button');
                if (scrollButton && scrollButton.style.display === 'none') {
                    scrollButton.style.display = 'block';
                }
            }
        }
    }
}

/** Handles mouse enter event for score indicators. */
function handleIndicatorMouseEnter(event) {
    // Only use hover behavior on non-mobile
    if (isMobileDevice()) return;
    
    const indicator = event.currentTarget;
    const tooltip = indicator.scoreTooltip;
    if (!tooltip) return;
    
    // Get the tweet article
    const tweetArticle = indicator.closest('article[data-testid="tweet"]');
    const tweetId = tweetArticle ? getTweetID(tweetArticle) : null;
    
    // Position the tooltip
    positionTooltip(indicator, tooltip);
    tooltip.style.display = 'block';
    
    // Check if we have cached streaming content for this tweet
    if (tweetId && tweetIDRatingCache[tweetId]?.description) {
        const reasoning = tweetIDRatingCache[tweetId].reasoning || "";
        const formatted = formatTooltipDescription(tweetIDRatingCache[tweetId].description, reasoning);
        
        // Update content using the proper elements
        const descriptionElement = tooltip.querySelector('.description-text');
        if (descriptionElement) {
            descriptionElement.innerHTML = formatted.description;
        }
        
        const reasoningElement = tooltip.querySelector('.reasoning-text');
        if (reasoningElement) {
            reasoningElement.innerHTML = formatted.reasoning;
            
            // Show/hide reasoning dropdown based on content
            const dropdown = tooltip.querySelector('.reasoning-dropdown');
            if (dropdown) {
                dropdown.style.display = formatted.reasoning ? 'block' : 'none';
            }
        }
        
        // Add streaming class if status is streaming
        if (tweetArticle?.dataset.ratingStatus === 'streaming' || tweetIDRatingCache[tweetId].streaming === true) {
            tooltip.classList.add('streaming-tooltip');
            
            // Reset auto-scroll state for streaming tooltips when they're first shown
            tooltip.dataset.autoScroll = 'true';
            
            // Scroll to bottom immediately for streaming tooltips
            requestAnimationFrame(() => {
                tooltip.scrollTop = tooltip.scrollHeight;
                // Second scroll after a short delay to catch any new content
                setTimeout(() => {
                    tooltip.scrollTop = tooltip.scrollHeight;
                }, 150);
            });
            
            // Hide scroll button initially
            const scrollButton = tooltip.querySelector('.scroll-to-bottom-button');
            if (scrollButton) {
                scrollButton.style.display = 'none';
            }
        } else {
            tooltip.classList.remove('streaming-tooltip');
        }
    }
}

/** Handles mouse leave event for score indicators. */
function handleIndicatorMouseLeave(event) {
    // Only use hover behavior on non-mobile
    if (isMobileDevice()) return;
    
    const indicator = event.currentTarget;
    const tooltip = indicator.scoreTooltip;
    if (!tooltip) return;
    
    // Only hide if we're not moving to the tooltip itself and not pinned
    setTimeout(() => {
        if (tooltip && !tooltip.matches(':hover') && !tooltip.classList.contains('pinned')) {
            tooltip.style.display = 'none';
        }
    }, 100);
}

/** Cleans up the global score tooltip element. */
function cleanupDescriptionElements() {
    // Remove all tooltips that might be in the DOM
    document.querySelectorAll('.score-description').forEach(tooltip => {
        tooltip.remove();
    });
}

/**
 * Cleans up orphaned tooltips that no longer have a visible tweet or indicator.
 */
function cleanupOrphanedTooltips() {
    // Get all tooltips
    const tooltips = document.querySelectorAll('.score-description');
    
    tooltips.forEach(tooltip => {
        const tooltipTweetId = tooltip.dataset.tweetId;
        if (!tooltipTweetId) {
            // Remove tooltips without a tweet ID
            tooltip.remove();
            return;
        }

        // Find the corresponding indicator for this tooltip
        const indicator = document.querySelector(`.score-indicator[data-tweet-id="${tooltipTweetId}"]`) ||
                         document.querySelector(`article[data-testid="tweet"][data-tweet-id="${tooltipTweetId}"] .score-indicator`);
        
        // Only remove the tooltip if there's no indicator for it
        if (!indicator) {
            // Cancel any active streaming requests for this tweet
            if (window.activeStreamingRequests && window.activeStreamingRequests[tooltipTweetId]) {

                window.activeStreamingRequests[tooltipTweetId].abort();
                delete window.activeStreamingRequests[tooltipTweetId];
            }
            
            // Remove the tooltip
            tooltip.remove();

        }
    });
}

// Add a MutationObserver to watch for removed tweets
function initializeTooltipCleanup() {
    // Create a MutationObserver to watch for removed tweets
    const tweetObserver = new MutationObserver((mutations) => {
        let needsCleanup = false;
        
        mutations.forEach(mutation => {
            // Check for removed nodes that might be tweets or indicators
            mutation.removedNodes.forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    // Check if the removed node is a tweet or contains indicators
                    if (node.matches('.score-indicator') || 
                        node.querySelector('.score-indicator')) {
                        needsCleanup = true;
                    }
                }
            });
        });
        
        // Only run cleanup if we detected relevant DOM changes
        if (needsCleanup) {
            cleanupOrphanedTooltips();
        }
    });

    // Start observing the timeline with the configured parameters
    const observerConfig = {
        childList: true,
        subtree: true
    };

    // Find the main timeline container
    const timeline = document.querySelector('div[data-testid="primaryColumn"]');
    if (timeline) {
        tweetObserver.observe(timeline, observerConfig);

    }

    // Also keep the periodic cleanup as a backup, but with a longer interval
    setInterval(cleanupOrphanedTooltips, 10000);
}

// --- Settings Import/Export (Simplified) ---

/**
 * Exports all settings and cache to a JSON file.
 */
function exportSettings() {
    try {
        const settingsToExport = {
            apiKey: GM_getValue('openrouter-api-key', ''),
            selectedModel: GM_getValue('selectedModel', 'openai/gpt-4.1-nano'),
            selectedImageModel: GM_getValue('selectedImageModel', 'openai/gpt-4.1-nano'),
            enableImageDescriptions: GM_getValue('enableImageDescriptions', false),
            enableStreaming: GM_getValue('enableStreaming', true),
            modelTemperature: GM_getValue('modelTemperature', 1),
            modelTopP: GM_getValue('modelTopP', 1),
            imageModelTemperature: GM_getValue('imageModelTemperature', 1),
            imageModelTopP: GM_getValue('imageModelTopP', 1),
            maxTokens: GM_getValue('maxTokens', 0),
            filterThreshold: GM_getValue('filterThreshold', 1),
            userDefinedInstructions: GM_getValue('userDefinedInstructions', 'Rate the tweet on a scale from 1 to 10 based on its clarity, insight, creativity, and overall quality.'),
            modelSortOrder: GM_getValue('modelSortOrder', 'throughput-high-to-low')
        };

        const data = {
            version: VERSION,
            date: new Date().toISOString(),
            settings: settingsToExport,
            blacklistedHandles: blacklistedHandles || [],
            tweetRatings: tweetIDRatingCache || {}
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tweetfilter-ai-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showStatus('Settings exported successfully!');
    } catch (error) {

        showStatus('Error exporting settings: ' + error.message);
    }
}

/**
 * Imports settings and cache from a JSON file.
 */
function importSettings() {
    try {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';

        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    if (!data.settings) throw new Error('Invalid backup file format');

                    // Import settings
                    for (const key in data.settings) {
                        if (window[key] !== undefined) {
                            window[key] = data.settings[key];
                        }
                        GM_setValue(key, data.settings[key]);
                    }

                    // Import blacklisted handles
                    if (data.blacklistedHandles && Array.isArray(data.blacklistedHandles)) {
                        blacklistedHandles = data.blacklistedHandles;
                        GM_setValue('blacklistedHandles', blacklistedHandles.join('\n'));
                    }

                    // Import tweet ratings (merge with existing)
                    if (data.tweetRatings && typeof data.tweetRatings === 'object') {
                        Object.assign(tweetIDRatingCache, data.tweetRatings);
                        saveTweetRatings();
                    }

                    refreshSettingsUI();
                    fetchAvailableModels();
                    showStatus('Settings imported successfully!');

                } catch (error) {

                    showStatus('Error importing settings: ' + error.message);
                }
            };
            reader.readAsText(file);
        };
        input.click();
    } catch (error) {

        showStatus('Error importing settings: ' + error.message);
    }
}

/**
 * Resets all configurable settings to their default values.
 */
function resetSettings(noconfirm=false) {
    if (noconfirm || confirm('Are you sure you want to reset all settings to their default values? This will not clear your cached ratings or blacklisted handles.')) {
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
            GM_setValue(key, defaults[key]);
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
    GM_setValue('blacklistedHandles', blacklistedHandles.join('\n'));
    refreshHandleList(document.getElementById('handle-list'));
    updateCacheStatsUI();
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
        GM_setValue('blacklistedHandles', blacklistedHandles.join('\n'));
        refreshHandleList(document.getElementById('handle-list'));
        updateCacheStatsUI();
        showStatus(`Removed @${handle} from auto-rate list.`);
                } else {

    }
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
    updateFloatingCacheStats();
    
    // Set up a periodic refresh of the cache stats to catch any updates
    setInterval(updateFloatingCacheStats, 10000);
    
    // Initialize the tooltip cleanup system
    initializeTooltipCleanup();
    
    // Initialize tracking object for streaming requests if it doesn't exist
    if (!window.activeStreamingRequests) {
        window.activeStreamingRequests = {};
    }
}

/**
 * Creates or updates a floating badge showing the current cache statistics
 * This provides real-time feedback when tweets are rated and cached,
 * even when the settings panel is not open.
 */
function updateFloatingCacheStats() {
    let statsBadge = document.getElementById('tweet-filter-stats-badge');
    
    if (!statsBadge) {
        statsBadge = document.createElement('div');
        statsBadge.id = 'tweet-filter-stats-badge';
        statsBadge.className = 'tweet-filter-stats-badge';
        statsBadge.style.cssText = `
            position: fixed;
            bottom: 50px;
            right: 20px;
            background-color: rgba(29, 155, 240, 0.9);
            color: white;
            padding: 5px 10px;
            border-radius: 15px;
            font-size: 12px;
            z-index: 9999;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            transition: opacity 0.3s;
            cursor: pointer;
            display: flex;
            align-items: center;
        `;
        
        // Add tooltip functionality
        statsBadge.title = 'Click to open settings';
        
        // Add click event to open settings
        statsBadge.addEventListener('click', () => {
            const settingsToggle = document.querySelector('.settings-toggle');
            if (settingsToggle) {
                settingsToggle.click();
            }
        });
        
        document.body.appendChild(statsBadge);
        
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
    }
    
    // Update the content
    const cachedCount = Object.keys(tweetIDRatingCache).length;
    const wlCount = blacklistedHandles.length;
    
    statsBadge.innerHTML = `
        <span style="margin-right: 5px;">🧠</span>
        <span>${cachedCount} rated</span>
        ${wlCount > 0 ? `<span style="margin-left: 5px;"> | ${wlCount} whitelisted</span>` : ''}
    `;
    
    // Make it visible and reset the timeout
    statsBadge.style.opacity = '1';
    clearTimeout(statsBadge.fadeTimeout);
    statsBadge.fadeTimeout = setTimeout(() => {
        statsBadge.style.opacity = '0.3';
    }, 5000);
}

// Extend the updateCacheStatsUI function to also update the floating stats badge
const originalUpdateCacheStatsUI = updateCacheStatsUI;
updateCacheStatsUI = function() {
    // Call the original function
    originalUpdateCacheStatsUI.apply(this, arguments);
    
    // Update the floating badge
    updateFloatingCacheStats();
};

})();
