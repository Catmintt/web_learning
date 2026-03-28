from collections.abc import Generator

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app import app, get_db, get_email_sender, get_verification_store
from config import settings
from db import Base
from models import UserAccount
from security import verify_password
from verification_store import InMemoryVerificationStore

TEST_DATABASE_URL = "sqlite+pysqlite:///:memory:"


def build_test_client(sent_codes: dict[str, str]) -> TestClient:
    """构建带测试依赖覆盖的 FastAPI 客户端。"""

    engine = create_engine(
        TEST_DATABASE_URL,
        future=True,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(
        bind=engine,
        autoflush=False,
        autocommit=False,
        expire_on_commit=False,
    )
    Base.metadata.create_all(bind=engine)

    def override_get_db() -> Generator[Session, None, None]:
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    def fake_email_sender(email: str, code: str) -> None:
        sent_codes[email] = code

    verification_store = InMemoryVerificationStore(
        ttl_seconds=settings.verification_code_ttl_seconds,
        rate_limit_window_seconds=settings.verification_rate_limit_window_seconds,
        rate_limit_max_sends=settings.verification_rate_limit_max_sends,
    )

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_email_sender] = lambda: fake_email_sender
    app.dependency_overrides[get_verification_store] = lambda: verification_store
    return TestClient(app)


def test_send_code_sends_email_and_rejects_duplicate_account():
    sent_codes: dict[str, str] = {}
    client = build_test_client(sent_codes)

    response = client.post(
        "/api/register/send-code",
        json={"account": "alice01", "email": "alice@example.com"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "success": True,
        "message": "验证码已发送，请前往邮箱查收。",
    }
    assert "alice@example.com" in sent_codes


def test_send_code_applies_rate_limit_after_five_requests():
    sent_codes: dict[str, str] = {}
    client = build_test_client(sent_codes)
    payload = {"account": "limituser1", "email": "limit@example.com"}

    for _ in range(5):
        response = client.post("/api/register/send-code", json=payload)
        assert response.status_code == 200

    blocked_response = client.post("/api/register/send-code", json=payload)

    assert blocked_response.status_code == 429
    assert blocked_response.json() == {
        "detail": "10 分钟内最多发送 5 次验证码，请稍后再试",
    }


def test_register_creates_account_with_hashed_password_and_login_works():
    sent_codes: dict[str, str] = {}
    client = build_test_client(sent_codes)
    email = "tom@example.com"

    send_code_response = client.post(
        "/api/register/send-code",
        json={"account": "tom2026", "email": email},
    )
    assert send_code_response.status_code == 200

    register_response = client.post(
        "/api/register",
        json={
            "account": "tom2026",
            "email": email,
            "verification_code": sent_codes[email],
            "password": "password123",
            "confirm_password": "password123",
        },
    )

    assert register_response.status_code == 200
    assert register_response.json() == {
        "success": True,
        "message": "注册成功，当前账号已经可以登录。",
    }

    db_session = next(app.dependency_overrides[get_db]())
    saved_user = db_session.query(UserAccount).filter_by(account="tom2026").one()
    assert saved_user.password != "password123"
    assert verify_password("password123", saved_user.password)
    db_session.close()

    login_response = client.post(
        "/api/login",
        json={
            "account": "tom2026",
            "password": "password123",
            "remember_me": False,
        },
    )
    assert login_response.status_code == 200
    assert login_response.json()["session_days"] == 7

    long_login_response = client.post(
        "/api/login",
        json={
            "account": "tom2026",
            "password": "password123",
            "remember_me": True,
        },
    )
    assert long_login_response.status_code == 200
    assert long_login_response.json()["session_days"] == 3650

def test_register_rejects_previous_code_after_resend():
    sent_codes: dict[str, str] = {}
    client = build_test_client(sent_codes)
    email = "refresh@example.com"

    first_send = client.post(
        "/api/register/send-code",
        json={"account": "refresh2026", "email": email},
    )
    assert first_send.status_code == 200
    first_code = sent_codes[email]

    second_send = client.post(
        "/api/register/send-code",
        json={"account": "refresh2026", "email": email},
    )
    assert second_send.status_code == 200
    second_code = sent_codes[email]
    assert second_code != first_code

    old_code_response = client.post(
        "/api/register",
        json={
            "account": "refresh2026",
            "email": email,
            "verification_code": first_code,
            "password": "password123",
            "confirm_password": "password123",
        },
    )
    assert old_code_response.status_code == 400
    assert old_code_response.json() == {"detail": "验证码错误或已过期"}

    new_code_response = client.post(
        "/api/register",
        json={
            "account": "refresh2026",
            "email": email,
            "verification_code": second_code,
            "password": "password123",
            "confirm_password": "password123",
        },
    )
    assert new_code_response.status_code == 200


def test_register_rejects_invalid_inputs():
    sent_codes: dict[str, str] = {}
    client = build_test_client(sent_codes)

    invalid_account_response = client.post(
        "/api/register/send-code",
        json={"account": "中文账号", "email": "bad@example.com"},
    )
    assert invalid_account_response.status_code == 422

    client.post(
        "/api/register/send-code",
        json={"account": "bob2026", "email": "bob@example.com"},
    )

    mismatch_response = client.post(
        "/api/register",
        json={
            "account": "bob2026",
            "email": "bob@example.com",
            "verification_code": sent_codes["bob@example.com"],
            "password": "password123",
            "confirm_password": "password999",
        },
    )
    assert mismatch_response.status_code == 400
    assert mismatch_response.json() == {"detail": "两次输入的密码不一致"}

    blank_password_response = client.post(
        "/api/register",
        json={
            "account": "bob2026",
            "email": "bob@example.com",
            "verification_code": sent_codes["bob@example.com"],
            "password": "   ",
            "confirm_password": "   ",
        },
    )
    assert blank_password_response.status_code == 422

    client.post(
        "/api/register/send-code",
        json={"account": "singlepass1", "email": "single@example.com"},
    )
    single_char_password_response = client.post(
        "/api/register",
        json={
            "account": "singlepass1",
            "email": "single@example.com",
            "verification_code": sent_codes["single@example.com"],
            "password": "a",
            "confirm_password": "a",
        },
    )
    assert single_char_password_response.status_code == 200
