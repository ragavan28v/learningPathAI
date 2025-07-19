from pydantic import BaseModel
from typing import List, Optional

class PlanRequest(BaseModel):
    topic: str
    timeframe: str
    prior_knowledge: Optional[str] = None
    pace: Optional[str] = None
    learning_style: Optional[str] = None

class Resource(BaseModel):
    type: str
    title: str
    url: str

class PlanNode(BaseModel):
    id: str
    topic: str
    date: str
    prerequisites: List[str]
    materials: List[str]
    resources: List[Resource]
    children: List['PlanNode'] = []

    class Config:
        arbitrary_types_allowed = True
        orm_mode = True

class PlanResponse(BaseModel):
    plan: List[PlanNode]

class DailyContentResponse(BaseModel):
    daily: str  # Replace with structured daily content later 