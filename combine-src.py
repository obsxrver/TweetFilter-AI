#!/usr/bin/env python3
import os

# Define the files to combine in the correct order
files_to_combine = [
    "twitter-desloppifier.js",
    "config.js",
    "api.js",
    "domScraper.js", 
    "ratingEngine.js",
    "ui.js"
]

# Define embedded resources
resources = [
    "Menu.html",
    "style.css"
]

src_dir = "src"
output_file = "TweetFilter-AI.user.js"

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
combined_lines.append("    console.log(\"X/Twitter Tweet De-Sloppification Activated (Combined Version)\");\n\n")

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
        content = f.readlines()
        # Skip userscript header for twitter-desloppifier.js
        if js_file == "twitter-desloppifier.js":
            skip = True
            for line in content:
                if skip and line.strip() == "// ==/UserScript==":
                    skip = False
                    continue
                if not skip:
                    combined_lines.append(line)
        else:
            combined_lines.extend(content)
    
    combined_lines.append("\n")

# Close IIFE
combined_lines.append("})();\n")

# Write the combined script to file
with open(output_file, 'w', encoding='utf-8') as f:
    f.writelines(combined_lines)

print(f"Successfully created {output_file}")
