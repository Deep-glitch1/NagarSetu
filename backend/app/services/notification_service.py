"""NagarSetu notification helpers using the existing SMTP configuration."""

from __future__ import annotations

import logging
import smtplib
import ssl
from email.message import EmailMessage

from app.core.config import settings


logger = logging.getLogger("nagarseu.notifications")


def _validate_smtp_configuration() -> None:
    if not all(
        [
            settings.SMTP_HOST,
            settings.SMTP_USERNAME,
            settings.SMTP_PASSWORD,
            settings.SMTP_FROM_EMAIL,
        ]
    ):
        raise RuntimeError(
            "SMTP configuration is incomplete. "
            "Check SMTP_HOST, SMTP_USERNAME, SMTP_PASSWORD "
            "and SMTP_FROM_EMAIL in .env."
        )


def send_email_notification(
    *,
    to_email: str,
    subject: str,
    body: str,
) -> None:
    """Send a plain-text notification through the existing SMTP setup."""
    _validate_smtp_configuration()

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = settings.SMTP_FROM_EMAIL
    message["To"] = to_email
    message.set_content(body.strip())

    ssl_context = ssl.create_default_context()

    with smtplib.SMTP(
        settings.SMTP_HOST,
        settings.SMTP_PORT,
        timeout=10,
    ) as smtp:
        smtp.ehlo()
        smtp.starttls(context=ssl_context)
        smtp.ehlo()
        smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
        smtp.send_message(message)


def send_sla_escalation_notification(
    *,
    to_email: str,
    recipient_name: str | None,
    complaint_number: str,
    escalation_level: int,
    escalation_percentage: int,
    reason: str,
) -> None:
    """Notify the escalation target that a complaint has been escalated."""
    name = recipient_name or "Officer"

    send_email_notification(
        to_email=to_email,
        subject=(
            "NagarSetu - Complaint SLA Escalation "
            f"[{complaint_number}]"
        ),
        body=f"""
Hello {name},

A NagarSetu complaint has reached an SLA escalation threshold and requires your attention.

Complaint: {complaint_number}
Escalation level: {escalation_level}
Current SLA usage: {escalation_percentage}%

Reason:
{reason}

Please review the complaint and take the required action.

Regards,
NagarSetu Team
""",
    )


def safe_send_sla_escalation_notification(**kwargs) -> bool:
    """Send an escalation email without breaking the SLA job on SMTP failure."""
    try:
        send_sla_escalation_notification(**kwargs)
        return True
    except Exception:
        logger.exception(
            "Failed to send SLA escalation notification for complaint %s",
            kwargs.get("complaint_number"),
        )
        return False
