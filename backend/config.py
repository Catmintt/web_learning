import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")


class Settings:
    """集中读取当前服务的环境配置。"""

    def __init__(self) -> None:
        self.database_url = os.getenv(
            "DATABASE_URL",
            "mysql+pymysql://web_learning:WebLearningApp2026!@127.0.0.1:3307/web_learning_auth",
        )
        self.smtp_host = os.getenv("SMTP_HOST", "smtp.qq.com")
        self.smtp_port = int(os.getenv("SMTP_PORT", "465"))
        self.smtp_username = os.getenv("SMTP_USERNAME", "")
        self.smtp_password = os.getenv("SMTP_PASSWORD", "")
        self.smtp_from = os.getenv("SMTP_FROM", self.smtp_username)
        self.verification_code_ttl_seconds = int(
            os.getenv("VERIFICATION_CODE_TTL_SECONDS", "600")
        )
        self.long_lived_session_days = int(
            os.getenv("LONG_LIVED_SESSION_DAYS", "3650")
        )


settings = Settings()
