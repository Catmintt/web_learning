from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from config import settings


class Base(DeclarativeBase):
    """定义 SQLAlchemy 模型基类。"""


engine: Engine
SessionLocal: sessionmaker[Session]


def configure_database(database_url: str) -> None:
    """根据给定连接串初始化引擎和会话工厂。"""

    global engine
    global SessionLocal

    connect_args = {"check_same_thread": False} if database_url.startswith("sqlite") else {}
    engine = create_engine(
        database_url,
        future=True,
        pool_pre_ping=True,
        connect_args=connect_args,
    )
    SessionLocal = sessionmaker(
        bind=engine,
        autoflush=False,
        autocommit=False,
        expire_on_commit=False,
    )


def init_database() -> None:
    """创建当前服务需要的全部表结构。"""

    import models  # noqa: F401

    Base.metadata.create_all(bind=engine)


def get_db() -> Generator[Session, None, None]:
    """为 FastAPI 路由提供数据库会话。"""

    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


configure_database(settings.database_url)
