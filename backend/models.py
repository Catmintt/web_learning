from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from db import Base


class UserAccount(Base):
    """定义账号表，仅保存最小账号和密码字段。"""

    __tablename__ = "user_accounts"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    account: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    password: Mapped[str] = mapped_column(String(255))
