import secrets
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Protocol

from redis import Redis


def generate_verification_code() -> str:
    """生成 6 位数字验证码。"""

    return "".join(secrets.choice("0123456789") for _ in range(6))


@dataclass(slots=True)
class VerificationRateLimitExceeded(Exception):
    """表示验证码发送频率已经超过限制。"""

    retry_after_seconds: int


class VerificationStore(Protocol):
    """定义验证码存储与频控能力。"""

    def ensure_send_allowed(self, email: str) -> None:
        """校验当前邮箱是否还能继续发送验证码。"""

    def save_verification_code(self, email: str, code: str) -> None:
        """保存当前邮箱对应的验证码。"""

    def verify_code(self, email: str, code: str) -> bool:
        """校验指定邮箱的验证码是否有效。"""

    def clear_verification_code(self, email: str) -> None:
        """清理当前邮箱下的验证码。"""


class RedisVerificationStore:
    """基于 Redis 管理验证码与发送频率。"""

    def __init__(
        self,
        redis_client: Redis,
        ttl_seconds: int,
        rate_limit_window_seconds: int,
        rate_limit_max_sends: int,
    ) -> None:
        self._redis = redis_client
        self._ttl_seconds = ttl_seconds
        self._rate_limit_window_seconds = rate_limit_window_seconds
        self._rate_limit_max_sends = rate_limit_max_sends

    def ensure_send_allowed(self, email: str) -> None:
        """按邮箱维度限制验证码发送频率。"""

        attempts = int(self._redis.incr(self._build_rate_key(email)))
        if attempts == 1:
            self._redis.expire(
                self._build_rate_key(email),
                self._rate_limit_window_seconds,
            )

        if attempts > self._rate_limit_max_sends:
            retry_after_seconds = int(self._redis.ttl(self._build_rate_key(email)))
            raise VerificationRateLimitExceeded(
                retry_after_seconds=max(retry_after_seconds, 0)
            )

    def save_verification_code(self, email: str, code: str) -> None:
        """覆盖写入最新验证码，并刷新其有效期。"""

        self._redis.setex(self._build_code_key(email), self._ttl_seconds, code)

    def verify_code(self, email: str, code: str) -> bool:
        """校验验证码是否匹配当前 Redis 中的最新值。"""

        saved_code = self._redis.get(self._build_code_key(email))
        return saved_code == code

    def clear_verification_code(self, email: str) -> None:
        """删除已经使用或失效的验证码。"""

        self._redis.delete(self._build_code_key(email))

    def _build_code_key(self, email: str) -> str:
        """构造验证码缓存键。"""

        return f"register:verification:code:{email}"

    def _build_rate_key(self, email: str) -> str:
        """构造验证码发送频率键。"""

        return f"register:verification:rate:{email}"


class InMemoryVerificationStore:
    """为测试环境提供无需 Redis 的内存验证码实现。"""

    def __init__(
        self,
        ttl_seconds: int,
        rate_limit_window_seconds: int,
        rate_limit_max_sends: int,
        now_factory: Callable[[], datetime] | None = None,
    ) -> None:
        self._ttl_seconds = ttl_seconds
        self._rate_limit_window_seconds = rate_limit_window_seconds
        self._rate_limit_max_sends = rate_limit_max_sends
        self._now_factory = now_factory or (lambda: datetime.now(UTC))
        self._code_store: dict[str, tuple[str, datetime]] = {}
        self._rate_store: dict[str, tuple[int, datetime]] = {}

    def ensure_send_allowed(self, email: str) -> None:
        """按邮箱维度在内存中限制验证码发送频率。"""

        now = self._now_factory()
        attempts, expires_at = self._rate_store.get(
            email,
            (
                0,
                now + timedelta(seconds=self._rate_limit_window_seconds),
            ),
        )

        if now > expires_at:
            attempts = 0
            expires_at = now + timedelta(seconds=self._rate_limit_window_seconds)

        attempts += 1
        self._rate_store[email] = (attempts, expires_at)

        if attempts > self._rate_limit_max_sends:
            retry_after_seconds = max(int((expires_at - now).total_seconds()), 0)
            raise VerificationRateLimitExceeded(
                retry_after_seconds=retry_after_seconds
            )

    def save_verification_code(self, email: str, code: str) -> None:
        """保存最新验证码，并自动覆盖旧验证码。"""

        self._code_store[email] = (
            code,
            self._now_factory() + timedelta(seconds=self._ttl_seconds),
        )

    def verify_code(self, email: str, code: str) -> bool:
        """校验内存中的验证码是否有效。"""

        saved_value = self._code_store.get(email)
        if saved_value is None:
            return False

        saved_code, expires_at = saved_value
        if self._now_factory() > expires_at:
            self._code_store.pop(email, None)
            return False

        return saved_code == code

    def clear_verification_code(self, email: str) -> None:
        """删除指定邮箱对应的验证码。"""

        self._code_store.pop(email, None)
