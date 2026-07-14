from pydantic import BaseModel
from typing import Optional

class InteractionBase(BaseModel):
    hcp_name: Optional[str] = None
    interaction_type: str = "Meeting"
    date: Optional[str] = None
    time: Optional[str] = None
    attendees: Optional[str] = None
    topics_discussed: Optional[str] = None
    materials_shared: Optional[str] = None
    samples_distributed: Optional[str] = None
    sentiment: str = "Neutral"
    outcomes: Optional[str] = None
    followup_actions: Optional[str] = None

class InteractionCreate(InteractionBase):
    pass

class InteractionResponse(InteractionBase):
    id: int

    class Config:
        from_attributes = True

class ChatRequest(BaseModel):
    message: str
    current_form_state: Optional[dict] = None