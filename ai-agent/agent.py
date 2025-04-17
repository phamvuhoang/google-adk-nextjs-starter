# agent.py - Main Agent Definition
# This file defines the root_agent and supporting sub-agents

import os
import json
import requests
from google.cloud import firestore
from google.adk.agents.llm_agent import LlmAgent
from google.adk.tools.agent_tool import AgentTool
from google.adk.models.google_llm import Gemini

# --- Initialize LLM --- 
# Default to Flash model, can be overridden by environment variable
llm_model_name = os.environ.get('ADK_LLM_MODEL_NAME', 'gemini-1.5-flash-001')
llm = Gemini(model_name=llm_model_name)
print(f"Using LLM model: {llm_model_name}")

# --- Firestore Client Initialization ---
# Get project ID from environment variables
project_id = os.environ.get('GOOGLE_CLOUD_PROJECT') or os.environ.get('GCLOUD_PROJECT')
if not project_id:
    print("WARNING: GOOGLE_CLOUD_PROJECT not set in environment. Firestore operations will fail.")
    print("Please set GOOGLE_CLOUD_PROJECT in your .env file or environment.")

try:
    # Explicitly pass project ID to Firestore client
    db = firestore.Client(project=project_id) if project_id else None
    if db:
        print(f"Firestore client initialized successfully for project: {project_id}")
    else:
        print("Firestore client not initialized - missing project ID")
except Exception as e:
    print(f"Error initializing Firestore client: {e}")
    db = None

# --- Tool Implementations ---

def get_session_history(session_id: str) -> str:
    """Retrieves the message history for a given session ID. Returns a JSON string of messages or an error message."""
    print(f"--- Tool Start: get_session_history for session {session_id} ---")
    if not db:
        error_msg = json.dumps({"error": "Firestore client not initialized.", 
                           "hint": "Make sure GOOGLE_CLOUD_PROJECT is set in environment"})
        print(f"--- Tool End: get_session_history (Error: Firestore not init) ---")
        return error_msg

    print(f"Tool: Getting history for session {session_id}")
    try:
        messages_ref = db.collection("sessions").document(session_id).collection("messages").order_by("createdAt", direction=firestore.Query.ASCENDING)
        docs = messages_ref.stream()

        messages = []
        for doc in docs:
            message_data = doc.to_dict()
            # Convert Firestore Timestamp to ISO 8601 string for JSON serialization
            if 'createdAt' in message_data and isinstance(message_data['createdAt'], firestore.SERVER_TIMESTAMP.__class__):
                 # Placeholder for server timestamp, maybe skip or represent differently
                 message_data['createdAt'] = None # Or a specific string
            elif 'createdAt' in message_data and hasattr(message_data['createdAt'], 'isoformat'):
                 message_data['createdAt'] = message_data['createdAt'].isoformat()

            messages.append(message_data)

        if not messages:
            result = json.dumps({"status": "success", "history": [], "message": "No messages found for this session."})
            print(f"--- Tool End: get_session_history (No messages) ---")
            return result

        print(f"Retrieved {len(messages)} messages for session {session_id}")
        # Return history as a JSON string so the LLM can potentially parse it
        result = json.dumps({"status": "success", "history": messages})
        print(f"--- Tool End: get_session_history (Success) ---")
        return result

    except Exception as e:
        print(f"Error retrieving Firestore history for session {session_id}: {e}")
        error_result = json.dumps({"status": "error", "message": f"Failed to retrieve session history: {e}"})
        print(f"--- Tool End: get_session_history (Exception) ---")
        return error_result

def generate_code_with_bolt(prompt: str, context: str) -> str:
    """Generates code using Bolt.new based on the prompt and context."""
    print(f"--- Tool Start: generate_code_with_bolt ---")
    # TODO: Implement Bolt.new integration
    print(f"Tool: Generating code for prompt: {prompt}")
    result = f"Code generated for {prompt}..." # Placeholder
    print(f"--- Tool End: generate_code_with_bolt ---")
    return result

def search_web(query: str) -> str:
    """Searches the web for relevant information using Serper API. 
    Returns a JSON string with search results.
    
    Args:
        query: The search query
        
    Returns:
        JSON string with search results or error message
    """
    print(f"--- Tool Start: search_web for query: '{query}' ---")
    # Check if SERPER_API_KEY is available
    serper_api_key = os.environ.get('SERPER_API_KEY')
    if not serper_api_key:
        print("Warning: SERPER_API_KEY not set. Using fallback search implementation.")
        fallback_result = json.dumps({
            "status": "error", 
            "message": "Search API key not configured. Please set SERPER_API_KEY environment variable.",
            "fallback_results": [
                {"title": "Sample result (fallback mode)", "link": "https://example.com", "snippet": "This is a sample result because the search API is not configured."}
            ]
        })
        print(f"--- Tool End: search_web (Fallback: No API Key) ---")
        return fallback_result
        
    print(f"Searching web for: {query}")
    try:
        # Use Serper API for web search
        response = requests.post(
            "https://google.serper.dev/search",
            headers={"X-API-KEY": serper_api_key, "Content-Type": "application/json"},
            json={"q": query, "gl": "us", "hl": "en", "num": 5}
        )
        response.raise_for_status()  # Raise exception for HTTP errors
        results = response.json()
        
        # Format and return results
        formatted_results = {
            "status": "success",
            "organic": results.get("organic", []),
            "knowledge_graph": results.get("knowledgeGraph", {})
        }
        result_json = json.dumps(formatted_results)
        print(f"--- Tool End: search_web (Success) ---")
        return result_json
    except Exception as e:
        print(f"Search error: {e}")
        error_result = json.dumps({
            "status": "error",
            "message": f"Search failed: {str(e)}",
            "fallback_results": [
                {"title": "Error occurred during search", "link": "https://example.com", "snippet": f"An error occurred: {str(e)}"}
            ]
        })
        print(f"--- Tool End: search_web (Exception) ---")
        return error_result

# --- Define Specialized Agents ---

# Brainstormer Agent: Helps generate and refine startup ideas
brainstormer_agent = LlmAgent(
    name="IdeaBrainstormer",
    description="Specializes in generating creative and diverse startup ideas based on user prompts or themes. Focuses on novelty and feasibility.",
    instruction="""You are an Idea Brainstormer AI.
**Log your start:** Print 'IdeaBrainstormer: Starting task.'
Your goal is to generate a list of creative and diverse startup ideas based on the user's input.
Focus on novelty, feasibility, and market potential.
Present the ideas clearly and concisely.
Use the get_session_history tool if needed to understand context.

When you have generated the ideas, **Log your completion:** Print 'IdeaBrainstormer: Task complete. Formatting response.' Provide your final response inside ```json { "content": "Your ideas here...", "next_actions": ["Validate this idea", "Research the market for [Idea]"] } ```.
Make sure to suggest relevant next actions based on the conversation and the ideas generated.""",
    model=llm,
    tools=[get_session_history],
)

# Validator Agent: Evaluates feasibility and viability of startup ideas
validator_agent = LlmAgent(
    name="IdeaValidator",
    description="Analyzes the viability of a specific startup idea, considering market fit, potential challenges, and strengths. Provides critical feedback.",
    instruction="""You are an Idea Validator AI.
**Log your start:** Print 'IdeaValidator: Starting evaluation.'
Your task is to critically evaluate a given startup idea.
Assess its market fit, potential challenges, feasibility, scalability, and unique selling points.
Provide constructive feedback and identify key risks and opportunities.
Use tools like get_session_history and search_web if needed.

After evaluating the idea, **Log your completion:** Print 'IdeaValidator: Evaluation complete. Formatting response.' Provide your final response inside ```json { "content": "Your evaluation here...", "next_actions": ["Refine the idea based on feedback", "Research competitors for this idea", "Develop a basic business model"] } ```.
Suggest next steps accordingly, considering the evaluation outcome and conversation history.""",
    model=llm,
    tools=[get_session_history, search_web],
)

# Market Researcher Agent: Gathers market data and competitive intelligence
market_researcher_agent = LlmAgent(
    name="MarketResearcher",
    description="Gathers and synthesizes market data, competitor information, and industry trends relevant to a specific startup idea or sector. Uses web search.",
    instruction="""You are a Market Researcher AI.
**Log your start:** Print 'MarketResearcher: Starting research.'
Your objective is to gather and analyze market information relevant to a user's query or startup idea.
Use the search_web tool **aggressively** to find data on market size, target audience, competitors, and industry trends. Do not answer without searching.
Synthesize the findings into a clear summary.
Use get_session_history if needed for context.

Once you have gathered the information, **Log your completion:** Print 'MarketResearcher: Research complete. Formatting response.' Provide your final response inside ```json { "content": "Market research findings here...", "next_actions": ["Analyze competitors in detail", "Estimate potential market share", "Identify key market trends"] } ```.
Include suggestions for further research or strategic actions based on your findings and the conversation history. You **must** use the search_web tool to find relevant information.""",
    model=llm,
    tools=[get_session_history, search_web],
)

# --- Define the Root Agent (AI Cofounder) ---

# This agent orchestrates the sub-agents.
root_agent = LlmAgent(
    name="AICofounder",
    description="The main orchestrator agent that interacts with the user, delegates tasks to specialized sub-agents (IdeaBrainstormer, IdeaValidator, MarketResearcher), and synthesizes information.",
    instruction=r"""You are AICofounder, the main AI assistant coordinating a team to help users develop and evaluate startup ideas.
Interact with the user, understand their needs, and rely on your sub-agents for specialized tasks.

**Your Sub-Agents:**
- **IdeaBrainstormer:** Handles requests for generating new startup ideas.
- **IdeaValidator:** Handles requests to evaluate the viability of a specific idea.
- **MarketResearcher:** Handles requests for market data, competitor analysis, or industry trends.

**Your Role & Tools:**
- **Coordinate:** Analyze the user's request. If it clearly matches the description of a sub-agent, the system will automatically delegate the task to them. Trust the delegation mechanism.
- **Handle Directly:** Only handle requests yourself if they are:
    - Specific requests for code generation using the 'generate_code_with_bolt' tool.
    - Simple clarifications about the process or capabilities.
    - Direct requests for web searches that don't fit the MarketResearcher's scope (use 'search_web').
- **Use History:** Use 'get_session_history' to understand context when needed.
- **Logging:** Print logs like 'AICofounder: Analyzing intent.', 'AICofounder: Handling task directly.', 'AICofounder: Letting sub-agent [Sub-Agent Name] handle task.' when appropriate.

**Response Formatting:**
When *you* provide the final answer (because you handled it directly, NOT when a sub-agent handled it), format your response as a JSON object:
```json
{
  "content": "Your response content here...",
  "next_actions": [ /* Appropriate next actions */ ]
}
```
- **'next_actions'** should be phrased from the user's perspective and contain no placeholders (e.g., "Tell me more about X.", "Let's generate code for Y.").

**Important:** The system handles automatic delegation based on sub-agent descriptions. Your main job is coordination and handling tasks that are *not* delegated. When a sub-agent handles a request, it will provide the final response in the correct format.""",
    model=llm,
    # Define tools the ROOT agent can use DIRECTLY
    tools=[
        # AgentTools removed, sub-agents are now listed in sub_agents param
        generate_code_with_bolt,
        search_web,
        get_session_history,
    ],
    # Key Change: Define sub-agents here for automatic delegation
    sub_agents=[
        brainstormer_agent,
        validator_agent,
        market_researcher_agent,
    ]
) 