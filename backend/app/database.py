from contextlib import contextmanager
from typing import Iterator

from sqlmodel import Session, SQLModel, create_engine


DATABASE_URL = "sqlite:///./polls.db"

engine = create_engine(
    DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False},
)


def init_db() -> None:
    """Create database tables if they do not exist."""
    SQLModel.metadata.create_all(engine)


def get_session() -> Iterator[Session]:
    with Session(engine) as session:
        yield session


@contextmanager
def session_scope() -> Iterator[Session]:
    """Provide a transactional scope for operations that need manual control."""
    with Session(engine) as session:
        yield session
