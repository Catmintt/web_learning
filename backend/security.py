from pwdlib import PasswordHash

password_hash = PasswordHash.recommended()


def hash_password(password: str) -> str:
    """对原始密码做单向哈希，避免明文入库。"""

    return password_hash.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    """校验原始密码与数据库哈希密码是否匹配。"""

    return password_hash.verify(password, hashed_password)
