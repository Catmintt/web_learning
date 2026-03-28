import smtplib
from email.message import EmailMessage

from config import Settings, settings


def send_verification_email(email: str, code: str, config: Settings = settings) -> None:
    """通过 SMTP 向指定邮箱发送注册验证码。"""

    if not config.smtp_username or not config.smtp_password or not config.smtp_from:
        raise RuntimeError("SMTP 配置不完整，请先在 .env 中填写 QQ 邮箱授权信息")

    message = EmailMessage()
    message["Subject"] = "热统小组注册验证码"
    message["From"] = config.smtp_from
    message["To"] = email
    message.set_content(
        f"你的验证码是：{code}。\n\n验证码 {config.verification_code_ttl_seconds // 60} 分钟内有效，请勿泄露给他人。"
    )

    with smtplib.SMTP_SSL(config.smtp_host, config.smtp_port) as smtp:
        smtp.login(config.smtp_username, config.smtp_password)
        smtp.send_message(message)
