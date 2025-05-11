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

# Speech-to-Text Agent Setup Guide

This guide will help you set up and run the Speech-to-Text agent service.

## Prerequisites

- Python 3.7 or higher
- pip (Python package installer)
- Google Cloud account with Speech-to-Text API enabled

## Installation Steps

1. Clone the repository or download the source code

2. Create a virtual environment (recommended)
   ```bash
   python -m venv venv
   ```

3. Activate the virtual environment
   - On Windows:
     ```bash
     venv\Scripts\activate
     ```
   - On macOS/Linux:
     ```bash
     source venv/bin/activate
     ```

4. Install the required dependencies
   ```bash
   pip install -r stt_agent/requirements.txt
   ```

5. Set up Google Cloud credentials
   - The `credentials.json` file is already included in the `stt_agent` directory
   - Set the environment variable to point to your credentials file:
     ```bash
     export GOOGLE_APPLICATION_CREDENTIALS="stt_agent/credentials.json"
     ```
   - On Windows, use:
     ```bash
     set GOOGLE_APPLICATION_CREDENTIALS=stt_agent\credentials.json
     ```

## Running the Service

1. Navigate to the project directory

2. Start the FastAPI server
   ```bash
   uvicorn stt_agent.app:app --reload
   ```

3. The service should now be running at `http://localhost:8000`

## API Endpoints

- POST `/transcribe` - Upload an audio file to transcribe speech to text
- Additional endpoints may be available depending on the implementation

## Troubleshooting

- If you encounter authentication issues, verify that your `GOOGLE_APPLICATION_CREDENTIALS` environment variable is correctly set
- Make sure the Google Cloud Speech-to-Text API is enabled for your project
- Check that the service account has the necessary permissions

## Security Note

The included credentials file contains sensitive information. In a production environment, you should:
- Store credentials securely
- Use environment variables or secret management services
- Never commit credential files to public repositories 