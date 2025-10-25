from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy.orm import relationship
from sqlmodel import Field, Relationship, SQLModel


class Poll(SQLModel, table=True):
    __tablename__ = "poll"

    id: Optional[int] = Field(default=None, primary_key=True)
    question: str = Field(index=True)
    description: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    likes: int = Field(default=0, ge=0)

    options: list["PollOption"] = Relationship(
        back_populates="poll",
        sa_relationship=relationship(
            "PollOption", back_populates="poll", cascade="all, delete-orphan"
        ),
    )


class PollOption(SQLModel, table=True):
    __tablename__ = "poll_option"

    id: Optional[int] = Field(default=None, primary_key=True)
    text: str
    votes: int = Field(default=0, ge=0)
    poll_id: int = Field(foreign_key="poll.id")

    poll: "Poll" = Relationship(
        back_populates="options",
        sa_relationship=relationship("Poll", back_populates="options"),
    )
