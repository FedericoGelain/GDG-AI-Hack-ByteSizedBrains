from google.adk.agents import Agent
from google.adk.tools import google_search

# Set up the agent
root_agent = Agent(
    model='gemini-2.0-flash-001',
    name='root_agent',
    description='A helpful assistant for user questions.',
    instruction='Look for the content of the page passed in the prompt and retrieve the html page, remove from it css and return the final html page.',
    tools=[google_search]
)
