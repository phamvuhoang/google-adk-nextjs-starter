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
    if not db:
        return json.dumps({"error": "Firestore client not initialized.", 
                           "hint": "Make sure GOOGLE_CLOUD_PROJECT is set in environment"})

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
            return json.dumps({"status": "success", "history": [], "message": "No messages found for this session."}) 

        print(f"Retrieved {len(messages)} messages for session {session_id}")
        # Return history as a JSON string so the LLM can potentially parse it
        return json.dumps({"status": "success", "history": messages})

    except Exception as e:
        print(f"Error retrieving Firestore history for session {session_id}: {e}")
        return json.dumps({"status": "error", "message": f"Failed to retrieve session history: {e}"})

def generate_code_with_bolt(prompt: str, context: str) -> str:
    """Generates code using Bolt.new based on the prompt and context."""
    # TODO: Implement Bolt.new integration
    print(f"Tool: Generating code for prompt: {prompt}")
    return f"Code generated for {prompt}..."

def search_web(query: str) -> str:
    """Searches the web for relevant information using Serper API. 
    Returns a JSON string with search results.
    
    Args:
        query: The search query
        
    Returns:
        JSON string with search results or error message
    """
    # Check if SERPER_API_KEY is available
    serper_api_key = os.environ.get('SERPER_API_KEY')
    if not serper_api_key:
        print("Warning: SERPER_API_KEY not set. Using fallback search implementation.")
        return json.dumps({
            "status": "error", 
            "message": "Search API key not configured. Please set SERPER_API_KEY environment variable.",
            "fallback_results": [
                {"title": "Sample result (fallback mode)", "link": "https://example.com", "snippet": "This is a sample result because the search API is not configured."}
            ]
        })
        
    print(f"Searching for: {query}")
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
        return json.dumps(formatted_results)
    except Exception as e:
        print(f"Search error: {e}")
        return json.dumps({
            "status": "error",
            "message": f"Search failed: {str(e)}",
            "fallback_results": [
                {"title": "Error occurred during search", "link": "https://example.com", "snippet": f"An error occurred: {str(e)}"}
            ]
        })

# --- Define Specialized Agents ---

# Brainstormer Agent: Helps generate and refine startup ideas
brainstormer_agent = LlmAgent(
    name="IdeaBrainstormer",
    description="Specializes in generating creative and diverse startup ideas based on user prompts or themes. Focuses on novelty and feasibility.",
    instruction="""You are an Idea Brainstormer AI.
Your goal is to generate a list of creative and diverse startup ideas based on the user's input.
Focus on novelty, feasibility, and market potential.
Present the ideas clearly and concisely.

When you have generated the ideas, provide your final response inside ```json { "content": "Your ideas here...", "next_actions": ["Validate this idea", "Research the market for [Idea]", "Refine these ideas"] } ```.
Make sure to suggest relevant next actions based on the conversation and the ideas generated. You can use the get_session_history tool if needed.""",
    model=llm,
    tools=[get_session_history],
)

# Validator Agent: Evaluates feasibility and viability of startup ideas
validator_agent = LlmAgent(
    name="IdeaValidator",
    description="Analyzes the viability of a specific startup idea, considering market fit, potential challenges, and strengths. Provides critical feedback.",
    instruction="""You are an Idea Validator AI.
Your task is to critically evaluate a given startup idea.
Assess its market fit, potential challenges, feasibility, scalability, and unique selling points.
Provide constructive feedback and identify key risks and opportunities.

After evaluating the idea, provide your final response inside ```json { "content": "Your evaluation here...", "next_actions": ["Refine the idea based on feedback", "Research competitors for this idea", "Develop a basic business model"] } ```.
Suggest next steps accordingly, considering the evaluation outcome and conversation history. You can use the get_session_history tool if needed.""",
    model=llm,
    tools=[get_session_history, search_web],
)

# Market Researcher Agent: Gathers market data and competitive intelligence
market_researcher_agent = LlmAgent(
    name="MarketResearcher",
    description="Gathers and synthesizes market data, competitor information, and industry trends relevant to a specific startup idea or sector.",
    instruction="""You are a Market Researcher AI.
Your objective is to gather and analyze market information relevant to a user's query or startup idea.
Use the search_web tool to find data on market size, target audience, competitors, and industry trends.
Synthesize the findings into a clear summary.

Once you have gathered the information, provide your final response inside ```json { "content": "Market research findings here...", "next_actions": ["Analyze competitors in detail", "Estimate potential market share", "Identify key market trends"] } ```.
Include suggestions for further research or strategic actions based on your findings and the conversation history. You must use the search_web tool to find relevant information.""",
    model=llm,
    tools=[get_session_history, search_web],
)

# --- Define the Root Agent (AI Cofounder) ---

# This agent orchestrates the sub-agents.
root_agent = LlmAgent(
    name="AICofounder",
    description="The main orchestrator agent that interacts with the user, delegates tasks to specialized sub-agents (IdeaBrainstormer, IdeaValidator, MarketResearcher), and synthesizes information.",
    instruction="""You are AICofounder, an AI assistant designed to help users develop and evaluate startup ideas.
Interact with the user, understand their needs, and manage the conversation flow.

**Delegation Strategy:**
- If the user asks for new ideas or brainstorming, delegate to **IdeaBrainstormer**.
- If the user wants to evaluate a specific idea's viability, delegate to **IdeaValidator**.
- If the user needs market data, competitor analysis, or trend information, delegate to **MarketResearcher**.
- If the user asks for code generation, use the **generate_code_with_bolt** tool directly.
- If the user asks a general question or clarification you can answer directly, do so.
- Use **get_session_history** to understand the context before deciding whether to delegate or answer directly.

**Response Formatting:**
When providing the final answer to the user (either directly or after receiving results from a sub-agent), format your response as a JSON object within a code block like this:
```json
{
  "content": "Your response content here...",
  "next_actions": ["Suggested action 1", "Suggested action 2", "Suggested action 3"]
}
```
- The 'content' field should contain the core information or answer.
- The 'next_actions' field should contain 2-3 relevant follow-up actions the user might want to take, based on the current conversation context and the response provided. Ensure these suggestions are helpful and logical.

Always strive to be helpful, clear, and action-oriented.""",
    model=llm,
    tools=[
        AgentTool(agent=brainstormer_agent),
        AgentTool(agent=validator_agent),
        AgentTool(agent=market_researcher_agent),
        generate_code_with_bolt,
        search_web,
        get_session_history,
    ],
) 