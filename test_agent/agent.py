from google.adk.agents import Agent

# Define a tool with a clear return and no input parameters (if you want it that way)
def html_page(_: str = "unused") -> str:
    with open("test_agent/new_page.html", 'r', encoding='utf-8') as infile:
        return infile.read()

# Set up the agent
root_agent = Agent(
    model='gemini-2.0-flash-001',
    name='root_agent',
    description='A helpful assistant for user questions.',
    instruction='Look for the content of the page passed in the prompt and retrieve the html page, remove from it css and return the final html page.',
    tools=[google_search]
)
