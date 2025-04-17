#!/usr/bin/env python3
import os
import re
import argparse

# Set up command line arguments
parser = argparse.ArgumentParser(description='Combine TweetFilter-AI source files into a single userscript.')
parser.add_argument('--nolog', action='store_true', help='Remove console.* logging statements')
args = parser.parse_args()

# Define the files to combine in the correct order
files_to_combine = [
    "twitter-desloppifier.js",
    "helpers/browserStorage.js",
    "helpers/TweetCache.js",
    "helpers/cache.js",
    
    "config.js",
    "api.js",
    "domScraper.js", 
    "ratingEngine.js",
    "ui.js",
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
        
        combined_lines.append(content)
    
    combined_lines.append("\n")

# Close IIFE
combined_lines.append("})();\n")

# Write the combined script to file
with open(output_file, 'w', encoding='utf-8') as f:
    f.writelines(combined_lines)

print(f"Successfully created {output_file}{' (without console logs)' if args.nolog else ''}")
