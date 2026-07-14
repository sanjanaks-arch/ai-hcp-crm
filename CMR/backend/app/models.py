from sqlalchemy import Column, Integer, String, Text
from .database import Base

class Interaction(Base):
    __tablename__ = "interactions"

    id = Column(Integer, primary_key=True, index=True)
    hcp_name = Column(String, index=True, nullable=True)
    interaction_type = Column(String, default="Meeting")
    date = Column(String, nullable=True)
    time = Column(String, nullable=True)
    attendees = Column(Text, nullable=True)
    topics_discussed = Column(Text, nullable=True)
    materials_shared = Column(Text, nullable=True)
    samples_distributed = Column(Text, nullable=True)
    sentiment = Column(String, default="Neutral")
    outcomes = Column(Text, nullable=True)
    followup_actions = Column(Text, nullable=True)