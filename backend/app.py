from contextlib import asynccontextmanager
from collections.abc import Callable

from fastapi import Depends, FastAPI, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from redis import Redis
from sqlalchemy import select
from sqlalchemy.orm import Session

from config import settings
from db import get_db, init_database
from email_service import send_verification_email
from models import UserAccount
from schemas import ApiMessageResponse, LoginRequest, LoginResponse, RegisterRequest, SendCodeRequest
from security import hash_password, verify_password
from verification_store import (
    generate_verification_code,
    RedisVerificationStore,
    VerificationRateLimitExceeded,
    VerificationStore,
)


@asynccontextmanager
async def lifespan(application: FastAPI):
    """在应用启动时初始化数据库表结构。"""

    init_database()
    redis_client = Redis.from_url(settings.redis_url, decode_responses=True)
    application.state.verification_store = RedisVerificationStore(
        redis_client=redis_client,
        ttl_seconds=settings.verification_code_ttl_seconds,
        rate_limit_window_seconds=settings.verification_rate_limit_window_seconds,
        rate_limit_max_sends=settings.verification_rate_limit_max_sends,
    )
    yield
    redis_client.close()


app = FastAPI(title="热统小组接口", version="0.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:4173",
        "http://localhost:4173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_email_sender() -> Callable[[str, str], None]:
    """返回当前注册验证码的发信函数。"""

    return send_verification_email


def get_verification_store(request: Request) -> VerificationStore:
    """从应用状态中读取当前验证码存储实现。"""

    return request.app.state.verification_store


@app.post("/api/register/send-code", response_model=ApiMessageResponse)
def send_register_code(
    payload: SendCodeRequest,
    db: Session = Depends(get_db),
    email_sender: Callable[[str, str], None] = Depends(get_email_sender),
    verification_store: VerificationStore = Depends(get_verification_store),
):
    """校验账号与邮箱后发送注册验证码。"""

    existing_user = db.scalar(
        select(UserAccount).where(UserAccount.account == payload.account)
    )
    if existing_user is not None:
        raise HTTPException(status_code=409, detail="当前账号已存在")

    try:
        verification_store.ensure_send_allowed(payload.email)
    except VerificationRateLimitExceeded as exc:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="10 分钟内最多发送 5 次验证码，请稍后再试",
            headers={"Retry-After": str(exc.retry_after_seconds)},
        ) from exc

    verification_code = generate_verification_code()
    verification_store.save_verification_code(payload.email, verification_code)
    email_sender(payload.email, verification_code)

    return {
        "success": True,
        "message": "验证码已发送，请前往邮箱查收。",
    }


@app.post("/api/register", response_model=ApiMessageResponse)
def register_user(
    payload: RegisterRequest,
    db: Session = Depends(get_db),
    verification_store: VerificationStore = Depends(get_verification_store),
):
    """完成注册校验并将账号密码写入数据库。"""

    if payload.password != payload.confirm_password:
        raise HTTPException(status_code=400, detail="两次输入的密码不一致")

    existing_user = db.scalar(
        select(UserAccount).where(UserAccount.account == payload.account)
    )
    if existing_user is not None:
        raise HTTPException(status_code=409, detail="当前账号已存在")

    if not verification_store.verify_code(payload.email, payload.verification_code):
        raise HTTPException(status_code=400, detail="验证码错误或已过期")

    user = UserAccount(
        account=payload.account,
        password=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    verification_store.clear_verification_code(payload.email)

    return {
        "success": True,
        "message": "注册成功，当前账号已经可以登录。",
    }


@app.post("/api/login", response_model=LoginResponse)
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)):
    """校验账号密码，并根据记住我策略设置登录时长。"""

    user = db.scalar(select(UserAccount).where(UserAccount.account == payload.account))
    if user is None or not verify_password(payload.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="账号或密码错误",
        )

    session_days = settings.long_lived_session_days if payload.remember_me else 7
    response.set_cookie(
        key="auth_account",
        value=user.account,
        httponly=True,
        samesite="lax",
        secure=False,
        max_age=session_days * 24 * 60 * 60,
    )

    return {
        "success": True,
        "message": (
            "已开启长期登录，除非主动退出，否则不会自动失效。"
            if payload.remember_me
            else "登录成功，默认保持登录状态 7 天。"
        ),
        "account": user.account,
        "remember_me": payload.remember_me,
        "session_days": session_days,
    }
