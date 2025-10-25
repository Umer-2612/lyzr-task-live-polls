from __future__ import annotations

from typing import List

from fastapi import Depends, FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select

from .database import get_session, init_db, session_scope
from .models import Poll, PollOption
from .schemas import ApiMessage, PollCreate, PollRead, VoteRequest
from .websocket_manager import ConnectionManager


app = FastAPI(
    title="QuickPoll API",
    version="0.1.0",
    description="Backend service for the QuickPoll real-time polling platform.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

manager = ConnectionManager()


@app.on_event("startup")
def on_startup() -> None:
    init_db()


def serialize_poll(poll: Poll) -> PollRead:
    return PollRead.model_validate(poll)


def get_poll_with_options(session: Session, poll_id: int) -> Poll:
    statement = select(Poll).where(Poll.id == poll_id)
    poll = session.exec(statement).one_or_none()
    if not poll:
        raise HTTPException(status_code=404, detail="Poll not found")
    _ = poll.options  # trigger relationship load
    return poll


@app.get("/health", response_model=ApiMessage)
async def healthcheck() -> ApiMessage:
    return ApiMessage(detail="ok")


@app.get("/polls", response_model=List[PollRead])
async def list_polls(session: Session = Depends(get_session)) -> List[PollRead]:
    polls = session.exec(select(Poll).order_by(Poll.created_at.desc())).all()
    return [serialize_poll(poll) for poll in polls]


@app.post("/polls", response_model=PollRead, status_code=201)
async def create_poll(payload: PollCreate, session: Session = Depends(get_session)) -> PollRead:
    options = [option.strip() for option in payload.options if option.strip()]
    if len(options) < 2:
        raise HTTPException(status_code=400, detail="A poll requires at least two options.")

    poll = Poll(question=payload.question.strip(), description=payload.description)
    poll.options = [PollOption(text=option) for option in options]

    session.add(poll)
    session.commit()

    poll = get_poll_with_options(session, poll.id)
    serialized = serialize_poll(poll)

    await manager.broadcast({"type": "poll_created", "poll": serialized.model_dump(mode="json")})

    return serialized


@app.get("/polls/{poll_id}", response_model=PollRead)
async def get_poll(poll_id: int, session: Session = Depends(get_session)) -> PollRead:
    poll = get_poll_with_options(session, poll_id)
    return serialize_poll(poll)


@app.post("/polls/{poll_id}/vote", response_model=PollRead)
async def vote_on_poll(
    poll_id: int,
    vote: VoteRequest,
    session: Session = Depends(get_session),
) -> PollRead:
    poll = get_poll_with_options(session, poll_id)

    option = session.get(PollOption, vote.option_id)
    if not option or option.poll_id != poll.id:
        raise HTTPException(status_code=400, detail="Option does not belong to this poll.")

    option.votes += 1
    session.add(option)
    session.commit()

    poll = get_poll_with_options(session, poll_id)
    serialized = serialize_poll(poll)
    await manager.broadcast({"type": "poll_updated", "poll": serialized.model_dump(mode="json")})
    return serialized


@app.post("/polls/{poll_id}/like", response_model=PollRead)
async def like_poll(poll_id: int, session: Session = Depends(get_session)) -> PollRead:
    poll = get_poll_with_options(session, poll_id)
    poll.likes += 1
    session.add(poll)
    session.commit()

    poll = get_poll_with_options(session, poll_id)
    serialized = serialize_poll(poll)
    await manager.broadcast({"type": "poll_updated", "poll": serialized.model_dump(mode="json")})
    return serialized


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await manager.connect(websocket)
    try:
        # Send an initial snapshot to the newly connected client.
        with session_scope() as session:
            polls = session.exec(select(Poll).order_by(Poll.created_at.desc())).all()
            await websocket.send_json(
                {
                    "type": "poll_snapshot",
                    "polls": [serialize_poll(poll).model_dump(mode="json") for poll in polls],
                }
            )

        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await manager.disconnect(websocket)
    except Exception:
        await manager.disconnect(websocket)
        raise
