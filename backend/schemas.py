import re
from typing import Annotated

from pydantic import BaseModel, EmailStr, Field, field_validator

ACCOUNT_PATTERN = re.compile(r"^[A-Za-z0-9]+$")


def validate_account_value(value: str) -> str:
    """校验账号只能包含英文和数字，且前后与中间均不能有空格。"""

    if value != value.strip():
        raise ValueError("账号前后不能有空格")
    if " " in value:
        raise ValueError("账号中间不能有空格")
    if not ACCOUNT_PATTERN.fullmatch(value):
        raise ValueError("账号只能包含英文和数字，不能包含中文或特殊字符")
    return value


class SendCodeRequest(BaseModel):
    """定义发送邮箱验证码的请求体。"""

    account: str
    email: EmailStr

    @field_validator("account")
    @classmethod
    def validate_account(cls, value: str) -> str:
        return validate_account_value(value)


class RegisterRequest(SendCodeRequest):
    """定义注册请求体。"""

    verification_code: Annotated[str, Field(min_length=6, max_length=6)]
    password: str
    confirm_password: str

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("密码不能为空或纯空格")
        return value


class LoginRequest(BaseModel):
    """定义登录请求体。"""

    account: str
    password: str
    remember_me: bool = False


class ApiMessageResponse(BaseModel):
    """定义通用成功消息响应体。"""

    success: bool
    message: str


class LoginResponse(ApiMessageResponse):
    """定义登录成功后的响应体。"""

    account: str
    remember_me: bool
    session_days: int
