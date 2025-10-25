from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict
from sqlmodel import SQLModel


class PollOptionRead(SQLModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    text: str
    votes: int


class PollRead(SQLModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    question: str
    description: Optional[str] = None
    likes: int
    created_at: datetime
    options: List[PollOptionRead]


class PollCreate(BaseModel):
    question: str
    description: Optional[str] = None
    options: List[str]


class VoteRequest(BaseModel):
    option_id: int


class ApiMessage(BaseModel):
    detail: str
