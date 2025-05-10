# AI Web Modifier - Chrome Extension

This Chrome extension allows you to modify web pages using AI. Simply describe how you want to change the page, and the extension will generate a new version of the page based on your request.

## Installation Guide

### Prerequisites

- Google Chrome browser
- A Gemini API key (get one from [Google AI Studio](https://makersuite.google.com/app/apikey))

### Local Installation

1. **Download the extension**
   - Clone this repository or download it as a ZIP file and extract it to a folder on your computer

2. **Set up your API key**
   - Create a file named `.env` in the root directory of the extension folder
   - Add your Gemini API key to the file in this format:
     ```
     GEMINI_API_KEY=your_api_key_here
     ```
   - Replace `your_api_key_here` with your actual Gemini API key

3. **Load the extension in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" by toggling the switch in the top-right corner
   - Click "Load unpacked" and select the folder containing the extension files
   - The AI Web Modifier extension should now appear in your extensions list

4. **Pin the extension (optional)**
   - Click the puzzle piece icon in the Chrome toolbar
   - Find the AI Web Modifier extension and click the pin icon to keep it visible in your toolbar

## How to Use

1. **Navigate to any web page** you want to modify
2. **Click the AI Web Modifier icon** in your Chrome toolbar
3. **Enter your modification request** in the text area (e.g., "Change all blue text to red")
4. **Click "Modify Page"** and wait for the AI to process your request
5. **View the modified page** - the current page will be replaced with the AI-generated version

## Troubleshooting

- **API Key Issues**: Make sure your `.env` file is properly formatted and contains a valid API key
- **Page Not Modifying**: Some websites with strict Content Security Policies may prevent the extension from working
- **Error Messages**: Check the debug info section in the extension popup for detailed error messages 