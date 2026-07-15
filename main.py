import os
import json
import traceback
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field, SecretStr
from langchain_groq import ChatGroq

from  database import engine, Base, get_db
from  models import Interaction
from  schemas import InteractionCreate, InteractionResponse, ChatRequest

# Initialize tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="AI-First CRM HCP Module Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

llm = ChatGroq(
    model="llama-3.3-70b-versatile", 
    temperature=0.1,
    groq_api_key=SecretStr(os.environ.get("GROQ_API_KEY", "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"))
).with_structured_output(StructuredFormExtractor)

def get_days_of_week_context(base_date: datetime) -> str:
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    context_lines = []
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

@app.get("/")
def read_root():
    return {"message": "AI-First CRM Backend is running smoothly!"}

@app.post("/api/interactions", response_model=InteractionResponse)
def save_interaction(interaction: InteractionCreate, db: Session = Depends(get_db)):
    try:
        db_interaction = Interaction(**interaction.model_dump())
        db.add(db_interaction)
        db.commit() # Writes permanently to crm.db
        db.refresh(db_interaction)
        return db_interaction
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@app.post("/api/chat")
async def process_chat(request: ChatRequest):
    try:
        current_state = request.current_form_state or {}
        now = datetime.now()
        today_str = now.strftime("%Y-%m-%d")
        yesterday_str = (now - timedelta(days=1)).strftime("%Y-%m-%d")
        tomorrow_str = (now + timedelta(days=1)).strftime("%Y-%m-%d")
        weekday_map = get_days_of_week_context(now)
        
        system_prompt = f"""
        You are an expert CRM data processing assistant. Merge extracted details into the existing form layout.
        CRITICAL CALENDAR REFERENCE CONTEXT:
        - Exact Date for 'today': {today_str} | 'yesterday': {yesterday_str} | 'tomorrow': {tomorrow_str}
        WEEK DAY MAP REFERENCE:
        {weekday_map}
        CURRENT DRAFT STATE:
        {json.dumps(current_state, indent=2)}
        INSTRUCTIONS:
        1. Extract details and convert any relative days into exact YYYY-MM-DD text fields.
        2. Keep the existing value from CURRENT DRAFT STATE if unmentioned.
        3. Provide a friendly conversational confirmation string inside 'reply'.
        """
        extracted_data = llm.invoke([
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": request.message}
        ])
        result_dict = extracted_data.model_dump()
        ai_reply = result_dict.pop("reply", "Form state updated successfully.")
        return {
            "reply": ai_reply,
            "detected_tool": "LOG_INTERACTION",
            "tool_updates": result_dict,
            "form_state": result_dict
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Structured parsing failure: {str(e)}")
