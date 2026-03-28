import secrets
from datetime import UTC, datetime, timedelta

verification_store: dict[str, tuple[str, datetime]] = {}


def generate_verification_code() -> str:
    """生成 6 位数字验证码。"""

    return "".join(secrets.choice("0123456789") for _ in range(6))


def save_verification_code(email: str, code: str, ttl_seconds: int) -> None:
    """保存验证码及其过期时间。"""

    verification_store[email] = (
        code,
        datetime.now(UTC) + timedelta(seconds=ttl_seconds),
    )


def verify_code(email: str, code: str) -> bool:
    """校验邮箱验证码是否存在、匹配且未过期。"""

    stored = verification_store.get(email)
    if stored is None:
        return False

    saved_code, expires_at = stored
    if datetime.now(UTC) > expires_at:
        verification_store.pop(email, None)
        return False

    return saved_code == code


def clear_verification_code(email: str) -> None:
    """在注册完成后清理已经使用过的验证码。"""

    verification_store.pop(email, None)
