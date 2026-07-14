import os
import json
from typing import TypedDict, Annotated, Sequence
from langchain_groq import ChatGroq
from langchain_core.tools import tool
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage
from langgraph.graph import StateGraph, START, END
from langgraph.prebuilt import ToolNode
from dotenv import load_dotenv
from pydantic import SecretStr

# Load environment variables
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

# 1. Define the Agent's State
class AgentState(TypedDict):
    messages: Sequence[BaseMessage]
    form_state: dict

# 2. Define the Tools with complete flexibility for any user input

@tool
def log_interaction(hcp_name: str, interaction_type: str = "Meeting", date: str = None, 
                    time: str = None, attendees: str = None, topics_discussed: str = None, 
                    sentiment: str = "Neutral", outcomes: str = None, followup_actions: str = None) -> str:
    """
    Log or capture a new interaction with any Healthcare Professional (HCP). 
    Extracts dynamic names, dates, times, attendees, and topics directly from the conversation.
    """
    data = {
        "hcp_name": hcp_name,
        "interaction_type": interaction_type,
        "date": date if date else "",
        "time": time if time else "",
        "attendees": attendees if attendees else "",
        "topics_discussed": topics_discussed if topics_discussed else "",
        "sentiment": sentiment,
        "outcomes": outcomes if outcomes else "",
        "followup_actions": followup_actions if followup_actions else ""
    }
    return f"TOOL_EXECUTION:LOG_INTERACTION:{json.dumps(data)}"


@tool
def edit_interaction(field_to_update: str, new_value: str) -> str:
    """
    Allows conversational modification of any field in the currently drafted log data.
    Valid fields are: hcp_name, interaction_type, date, time, attendees, topics_discussed, sentiment, outcomes, followup_actions.
    """
    data = {
        "field": field_to_update.strip().lower().replace(" ", "_"),
        "value": new_value
    }
    return f"TOOL_EXECUTION:EDIT_INTERACTION:{json.dumps(data)}"


@tool
def search_hcp(search_query: str) -> str:
    """
    Queries the directory of Healthcare Professionals (HCPs) to find matches.
    If no exact registry match is found, creates a dynamic fallback entry for the user.
    """
    registry = [
        {"name": "Dr. Evan Smith", "specialty": "Cardiology", "hospital": "St. Mary Medical Center"},
        {"name": "Dr. Priya Sharma", "specialty": "Oncology", "hospital": "City Cancer Institute"},
        {"name": "Dr. John Doe", "specialty": "General Medicine", "hospital": "County General Clinic"}
    ]
    matches = [hcp for hcp in registry if search_query.lower() in hcp["name"].lower()]
    return f"TOOL_EXECUTION:SEARCH_HCP:{json.dumps(matches if matches else [{'name': search_query, 'specialty': 'General Practice', 'hospital': 'New Entry'}])}"


@tool
def get_product_materials(product_name: str) -> str:
    """
    Fetches compliance-cleared clinical brochures or materials for the requested product.
    """
    catalog = {
        "product x": ["Product X Efficacy Brochure v4.1", "Patient Safety Visual Aid", "10mg Sample Kit"],
        "product y": ["Product Y Clinical Trials Data", "Dosing Schedule Guide Sheet"]
    }
    key = product_name.lower().strip()
    materials = catalog.get(key, [f"{product_name} Informational Booklet", "Standard Product Brochure"])
    return f"TOOL_EXECUTION:GET_PRODUCT_MATERIALS:{json.dumps(materials)}"


@tool
def suggest_followups(topics_discussed: str) -> str:
    """
    Generates dynamic, custom follow-up recommendations based on whatever topics were discussed.
    """
    suggestions = [
        f"Schedule standard follow-up regarding: {topics_discussed}",
        "Provide relevant documentation via secure email.",
        "Verify sample request delivery on next site visit."
    ]
    return f"TOOL_EXECUTION:SUGGEST_FOLLOWUPS:{json.dumps(suggestions)}"


# 3. Setup LangGraph Workflow Nodes and Routing
tools = [log_interaction, edit_interaction, search_hcp, get_product_materials, suggest_followups]
tool_node = ToolNode(tools)

# FIXED MODEL NAME: Updated to the modern Groq Llama 3.3 model endpoint
llm = ChatGroq(
    model="llama-3.3-70b-versatile", 
    temperature=0.1,
    groq_api_key=SecretStr("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")
)
llm_with_tools = llm.bind_tools(tools)

def call_model(state: AgentState):
    messages = state["messages"]
    form_context = state["form_state"]
    
    system_prompt = (
        "You are a dynamic, highly accurate AI CRM Sales Assistant for medical representatives.\n\n"
        "Your core task is to extract exact details from whatever meeting narrative the user provides. "
        "Do not restrict the data to any specific doctor names, times, or dates. "
        "Accept and process whatever details the user states (e.g., if they say 'I saw Dr. Anderson at 4:15 PM', extract 'Dr. Anderson' and '4:15 PM').\n\n"
        f"The current state of the draft form is: {json.dumps(form_context)}\n\n"
        "CRITICAL INSTRUCTIONS:\n"
        "1. If the user reports details about an interaction, call 'log_interaction' immediately with all extracted fields.\n"
        "2. If the user corrects a piece of info (e.g., 'Change time to 3 PM'), call 'edit_interaction'.\n"
        "3. Respond conversationally after executing tools, confirming what data you have processed."
    )
    
    response = llm_with_tools.invoke([HumanMessage(content=system_prompt)] + list(messages))
    return {"messages": [response]}

def should_continue(state: AgentState):
    messages = state["messages"]
    last_message = messages[-1]
    if last_message.tool_calls:
        return "tools"
    return END

# Build Graph
workflow = StateGraph(AgentState)
workflow.add_node("agent", call_model)
workflow.add_node("tools", tool_node)

workflow.add_edge(START, "agent")
workflow.add_conditional_edges("agent", should_continue, {"tools": "tools", END: END})
workflow.add_edge("tools", "agent")

# Compile
graph = workflow.compile()