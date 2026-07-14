import os
from dotenv import load_dotenv
from datetime import datetime, timedelta


# Force load the .env file
load_dotenv()

import json
import traceback
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field, SecretStr
from langchain_groq import ChatGroq

from .database import engine, Base, get_db
from .models import Interaction
from .schemas import InteractionCreate, InteractionResponse, ChatRequest

# Create the database tables on startup if they don't exist
Base.metadata.create_all(bind=engine)

app = FastAPI(title="AI-First CRM HCP Module Backend")

# Enable CORS (Cross-Origin Resource Sharing)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Define a strict parsing schema for Groq to match your React form exactly
class StructuredFormExtractor(BaseModel):
    hcp_name: str = Field(description="Name of the Doctor or HCP mentioned, e.g. Dr. Smith")
    interaction_type: str = Field(description="Must be one of: Meeting, Email, Phone Call, Lunch & Learn")
    date: str = Field(description="Date mentioned, or leave as existing value if not mentioned")
    time: str = Field(description="Time mentioned, or leave as existing value if not mentioned")
    attendees: str = Field(description="Names of other staff members or companions present")
    topics_discussed: str = Field(description="Summary of the medical or clinical topics discussed")
    materials_shared: str = Field(description="Any brochures, documents, or clinical papers shared")
    samples_distributed: str = Field(description="Any drug or product samples given to the HCP")
    sentiment: str = Field(description="Must be one of: Positive, Neutral, Negative")
    outcomes: str = Field(description="Summary of how the conversation concluded")
    followup_actions: str = Field(description="Action items or next steps requested by either party")
    reply: str = Field(description="A natural, conversational response back to the user acknowledging the log details.")

# Initialize a direct structured LLM compiler
llm = ChatGroq(
    model="llama-3.3-70b-versatile", 
    temperature=0.1,
    groq_api_key=SecretStr(os.environ.get("GROQ_API_KEY", "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"))
).with_structured_output(StructuredFormExtractor)

@app.get("/")
def read_root():
    return {"message": "AI-First CRM Backend is running smoothly!"}

@app.post("/api/interactions", response_model=InteractionResponse)
def save_interaction(interaction: InteractionCreate, db: Session = Depends(get_db)):
    try:
        db_interaction = Interaction(**interaction.model_dump())
        db.add(db_interaction)
        db.commit()
        db.refresh(db_interaction)
        return db_interaction
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@app.post("/api/chat")
async def process_chat(request: ChatRequest):
    """Bypasses graph variance to force deterministic form filling via Structured Output API."""
    try:
        current_state = request.current_form_state or {}
        
        # Build an airtight extraction prompt containing the history state context
        system_prompt = f"""
        You are an expert CRM data processing assistant. 
        Your job is to read the user's message and merge the extracted details into the existing form state layout below.
        
        CURRENT DRAFT STATE:
        {json.dumps(current_state, indent=2)}
        
        INSTRUCTIONS:
        1. Extract new details from the User Message and update the fields.
        2. If a field isn't mentioned in the new message, keep the value from the CURRENT DRAFT STATE.
        3. Ensure 'interaction_type' defaults to 'Meeting' if unknown, and 'sentiment' defaults to 'Neutral' unless explicit keywords show up.
        4. Write a brief, friendly validation message in the 'reply' attribute confirming what you updated.
        """

        # Force the engine to evaluate the instruction set
        extracted_data = llm.invoke([
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": request.message}
        ])

        # Convert pydantic mapping to clean python dict layout
        result_dict = extracted_data.model_dump()
        ai_reply = result_dict.pop("reply", "Form state updated successfully.")

        return {
            "reply": ai_reply,
            "detected_tool": "LOG_INTERACTION",
            "tool_updates": result_dict,
            "form_state": result_dict
        }
    except Exception as e:
        print("\n=== CRITICAL API CHAT ERROR EXCEPTION ===")
        traceback.print_exc()
        print("==========================================\n")
        raise HTTPException(status_code=500, detail=f"Structured parsing failure: {str(e)}")
    
  # ⚡ Added timedelta for past/future relative dates

# ... (Keep all your existing middleware, imports, and database code exactly the same) ...

from datetime import datetime, timedelta

# ... (Keep all your existing middleware, imports, and database code exactly the same) ...

def get_days_of_week_context(base_date: datetime) -> str:
    """Calculates precise dates for past and upcoming week days for AI context."""
    # Days dictionary to map strings
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    current_weekday = base_date.weekday() # 0 = Monday, 6 = Sunday
    
    context_lines = []
    
    # Calculate dates for the last 7 days and next 7 days
    for offset in range(-7, 8):
        target_date = base_date + timedelta(days=offset)
        day_name = days[target_date.weekday()]
        date_str = target_date.strftime("%Y-%m-%d")
        
        if offset == 0:
            context_lines.append(f"- '{day_name}' (TODAY): {date_str}")
        elif offset < 0:
            context_lines.append(f"- 'last {day_name}' or '{day_name} passed': {date_str}")
        else:
            context_lines.append(f"- 'next {day_name}' or 'upcoming {day_name}': {date_str}")
            
    return "\n".join(context_lines)

@app.post("/api/chat")
async def process_chat(request: ChatRequest):
    """Bypasses graph variance to force deterministic form filling via Structured Output API."""
    try:
        current_state = request.current_form_state or {}
        
        # 🗓️ 1. DYNAMIC DATES ENGINE
        now = datetime.now()
        today_str = now.strftime("%Y-%m-%d")
        yesterday_str = (now - timedelta(days=1)).strftime("%Y-%m-%d")
        tomorrow_str = (now + timedelta(days=1)).strftime("%Y-%m-%d")
        
        # Generate calendar context for specific week days (e.g., last Sunday)
        weekday_map = get_days_of_week_context(now)
        
        # Build an airtight extraction prompt containing computed calendar values
        system_prompt = f"""
        You are an expert CRM data processing assistant. 
        Your job is to read the user's message and merge the extracted details into the existing form state layout below.
        
        CRITICAL CALENDAR REFERENCE CONTEXT:
        - Exact Date for 'today': {today_str}
        - Exact Date for 'yesterday': {yesterday_str}
        - Exact Date for 'tomorrow': {tomorrow_str}
        
        WEEK DAY MAP REFERENCE:
        {weekday_map}
        
        CURRENT DRAFT STATE:
        {json.dumps(current_state, indent=2)}
        
        INSTRUCTIONS:
        1. Extract new details from the User Message and update the fields.
        2. NEVER write raw weekday words like 'Sunday', 'Monday', or 'yesterday' into the 'date' field. 
        3. Convert any relative time terms ('last Sunday', 'this Monday', etc.) into their absolute numerical YYYY-MM-DD format using the WEEK DAY MAP REFERENCE table provided above.
        4. If a field isn't mentioned in the new message, keep the value from the CURRENT DRAFT STATE.
        5. Write a brief, friendly validation message in the 'reply' attribute confirming what you updated.
        """

        # Force the engine to evaluate the instruction set
        extracted_data = llm.invoke([
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": request.message}
        ])

        # Convert pydantic mapping to clean python dict layout
        result_dict = extracted_data.model_dump()
        ai_reply = result_dict.pop("reply", "Form state updated successfully.")

        return {
            "reply": ai_reply,
            "detected_tool": "LOG_INTERACTION",
            "tool_updates": result_dict,
            "form_state": result_dict
        }
    except Exception as e:
        print("\n=== CRITICAL API CHAT ERROR EXCEPTION ===")
        traceback.print_exc()
        print("==========================================\n")
        raise HTTPException(status_code=500, detail=f"Structured parsing failure: {str(e)}")