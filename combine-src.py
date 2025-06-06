#!/usr/bin/env python3
import os
import re
import argparse
import requests

# Set up command line arguments
parser = argparse.ArgumentParser(description='Combine TweetFilter-AI source files into a single userscript.')
parser.add_argument('--nolog', action='store_true', help='Remove console.* logging statements')
parser.add_argument('--nocomment', action='store_true', help='Remove JavaScript comments')
parser.add_argument('--minify', action='store_true', help='Create an additional minified version of the script')
args = parser.parse_args()

# Define the files to combine in the correct order
files_to_combine = [
    # Helpers first
    "helpers/browserStorage.js",
    
    "helpers/cache.js",
    "backends/TweetCache.js",
    # Backend logic
    "backends/InstructionsHistory.js",
    "backends/InstructionsManager.js",

    # Configuration
    "config.js",
    # Core DOM/UI definitions needed by ScoreIndicator
    "domScraper.js",
    "ui/utils.js",
    "ui/InstructionsUI.js",
    "ui/ScoreIndicator.js",
    "ui/ui.js", 
    "ratingEngine.js",
    "api/api_requests.js",
    "api/api.js", 
    # Main script file (header excluded, contains initialization)
    "twitter-desloppifier.js", 
]

# Define embedded resources
resources = [
    "Menu.html",
    "style.css"
]

src_dir = "src"
output_file = "TweetFilter-AI.user.js"

# Function to remove console.* statements
def remove_console_logs(text):
    # Remove single-line console.* statements (with or without semicolon)
    text = re.sub(r'^\s*console\.[a-zA-Z]+\(.*?\);?\s*$', '', text, flags=re.MULTILINE)
    
    # Remove console.* statements with template literals, being careful not to consume too much
    text = re.sub(r'^\s*console\.[a-zA-Z]+\(`[^`]*`\);?\s*$', '', text, flags=re.MULTILINE)
    
    # Remove multiline console.* statements with template literals
    text = re.sub(r'^\s*console\.[a-zA-Z]+\(`(?:[^`]|`(?!;?\s*$))*`\);?\s*$', '', text, flags=re.MULTILINE)
    
    # Remove commented console statements
    text = re.sub(r'^\s*\/\/\s*console\.[a-zA-Z]+\(.*$', '', text, flags=re.MULTILINE)
    
    # Clean up any double blank lines created
    text = re.sub(r'\n\s*\n\s*\n', '\n\n', text)
    
    return text

# Function to remove JavaScript comments
def remove_comments(text):
    # Remove multi-line comments /* ... */ first
    # Use [\s\S] to match any character including newline, non-greedily
    text = re.sub(r'/\*[\s\S]*?\*/', '', text)
    # Remove full-line comments
    text = re.sub(r'^\s*//.*$', '', text, flags=re.MULTILINE)
    # Remove inline comments after semicolons
    text = re.sub(r';\s*//.*$', ';', text, flags=re.MULTILINE)
    # Remove inline comments after opening curly braces
    text = re.sub(r'\{\s*//.*$', '{', text, flags=re.MULTILINE)
    text = re.sub(r'^\\s*\\n', '', text, flags=re.MULTILINE)
    return text

# Read header from main file
with open(os.path.join(src_dir, "twitter-desloppifier.js"), 'r', encoding='utf-8') as f:
    header_lines = []
    for line in f:
        header_lines.append(line)
        if line.strip() == "// ==/UserScript==":
            break

# Filter out @require and @resource lines
filtered_header = []
for line in header_lines:
    if not line.strip().startswith("// @require") and not line.strip().startswith("// @resource"):
        filtered_header.append(line)

# Store header for later use
userscript_header = ''.join(filtered_header)

# Start building the combined script
combined_lines = filtered_header

# Add IIFE beginning
combined_lines.append("(function() {\n")
combined_lines.append("    'use strict';\n")
if not args.nolog:
    combined_lines.append("    console.log(\"X/Twitter Tweet De-Sloppification Activated (Combined Version)\");\n\n")
else:
    combined_lines.append("\n")

# Add embedded resources
for resource in resources:
    resource_name = resource.split('.')[0].upper()
    combined_lines.append(f"    // Embedded {resource}\n")
    combined_lines.append(f"    const {resource_name} = `")
    
    with open(os.path.join(src_dir, resource), 'r', encoding='utf-8') as f:
        content = f.read()
        # Escape backticks
        content = content.replace('`', '\\`')
        content = content.replace('    ', '')
        content = content.replace('\n', '')
        combined_lines.append(content)
    
    combined_lines.append("`;\n\n")

# Apply CSS directly
combined_lines.append("    // Apply CSS\n")
combined_lines.append("    GM_addStyle(STYLE);\n\n")

# Set menu HTML
combined_lines.append("    // Set menu HTML\n")
combined_lines.append("    GM_setValue('menuHTML', MENU);\n\n")

# Add all JavaScript files except header of the main file
for js_file in files_to_combine:
    combined_lines.append(f"    // ----- {js_file} -----\n")
    
    with open(os.path.join(src_dir, js_file), 'r', encoding='utf-8') as f:
        content = f.read()
        
        # Skip userscript header for twitter-desloppifier.js
        if js_file == "twitter-desloppifier.js":
            # Find where the header ends
            header_end = content.find("// ==/UserScript==") + len("// ==/UserScript==")
            content = content[header_end:]
        
        # Remove console logs if --nolog is specified
        if args.nolog:
            content = remove_console_logs(content)
        
        # Remove comments if --nocomment is specified
        if args.nocomment:
            content = remove_comments(content)
        
        combined_lines.append(content)
    
    combined_lines.append("\n")

# Close IIFE
combined_lines.append("})();\n")

# Join all lines into a single string and remove empty lines
combined_content = ''.join(combined_lines)
combined_content = re.sub(r'\n\s*\n', '\n', combined_content)

# Always write the non-minified version
output_file = "TweetFilter-AI.user.js"
with open(output_file, 'w', encoding='utf-8') as f:
    f.write(combined_content)

status_message = f"Successfully created {output_file}"
log_status = " (without console logs)" if args.nolog else ""
comment_status = " (without comments)" if args.nocomment else ""

# Create minified version if requested
if args.minify:
    try:
        print("Minifying JavaScript code...")
        # Remove header before minifying
        code_without_header = combined_content[len(userscript_header):]
        
        response = requests.post(
            'https://www.toptal.com/developers/javascript-minifier/api/raw',
            data=dict(input=code_without_header)
        )
        if response.status_code == 200:
            minified_output = "TweetFilter-AI.minified.user.js"
            with open(minified_output, 'w', encoding='utf-8') as f:
                # Write header first, then minified code
                f.write(userscript_header)
                f.write(response.text)
            print(f"Successfully created {minified_output} (minified)")
        else:
            print(f"Warning: Minification failed with status code {response.status_code}")
    except Exception as e:
        print(f"Warning: Minification failed with error: {str(e)}")

print(status_message + log_status + comment_status)
