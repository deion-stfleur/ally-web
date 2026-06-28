from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage

import httpx

from config import settings
from services.sendblue_webhook_service import (
    _send_message_sync,
    sendblue_outbound_configured,
)

logger = logging.getLogger(__name__)


def _build_body(
    *,
    email: str,
    name: str | None,
    company: str | None,
    use_case: str | None,
    source: str | None,
) -> str:
    lines = [
        "New Ally waitlist signup",
        "",
        f"Email: {email}",
    ]
    if name:
        lines.append(f"Name: {name}")
    if company:
        lines.append(f"Company: {company}")
    if source:
        lines.append(f"Source: {source}")
    if use_case:
        lines.extend(["", "How they want to use Ally:", use_case])
    lines.extend(
        [
            "",
            "Grant access by replying to this person when Google OAuth is approved.",
        ]
    )
    return "\n".join(lines)


def _send_via_resend(*, to_email: str, subject: str, body: str) -> bool:
    api_key = (settings.resend_api_key or "").strip()
    if not api_key:
        return False
    from_email = (settings.waitlist_from_email or "Ally Waitlist <onboarding@resend.dev>").strip()
    try:
        with httpx.Client(timeout=15.0) as client:
            res = client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": from_email,
                    "to": [to_email],
                    "subject": subject,
                    "text": body,
                },
            )
        if res.status_code >= 400:
            logger.warning("Resend waitlist notify failed: %s %s", res.status_code, res.text)
            return False
        return True
    except Exception:
        logger.exception("Resend waitlist notify error")
        return False


def _send_via_smtp(*, to_email: str, subject: str, body: str) -> bool:
    host = (settings.waitlist_smtp_host or "").strip()
    user = (settings.waitlist_smtp_user or "").strip()
    password = (settings.waitlist_smtp_password or "").strip()
    if not host or not user or not password:
        return False
    from_email = (settings.waitlist_from_email or user).strip()
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = from_email
    msg["To"] = to_email
    msg.set_content(body)
    try:
        with smtplib.SMTP(host, settings.waitlist_smtp_port, timeout=20) as smtp:
            smtp.starttls()
            smtp.login(user, password)
            smtp.send_message(msg)
        return True
    except Exception:
        logger.exception("SMTP waitlist notify error")
        return False


def _send_via_sendblue_sms(*, subject: str, body: str) -> bool:
    to_number = (settings.waitlist_notify_phone or "").strip()
    if not to_number or not sendblue_outbound_configured():
        return False
    content = f"{subject}\n\n{body}"[:1500]
    try:
        _send_message_sync(content=content, to_number=to_number)
        return True
    except Exception:
        logger.exception("Sendblue waitlist notify error")
        return False


def notify_waitlist_signup(
    *,
    email: str,
    name: str | None = None,
    company: str | None = None,
    use_case: str | None = None,
    source: str | None = None,
) -> bool:
    """Email the site owner about a new waitlist signup. Returns True if sent."""
    to_email = (settings.waitlist_notify_email or "").strip()
    if not to_email:
        logger.warning("WAITLIST_NOTIFY_EMAIL not configured; skipping notify")
        return False
    subject = f"Ally waitlist: {email}"
    body = _build_body(
        email=email,
        name=name,
        company=company,
        use_case=use_case,
        source=source,
    )
    if _send_via_resend(to_email=to_email, subject=subject, body=body):
        return True
    if _send_via_smtp(to_email=to_email, subject=subject, body=body):
        return True
    if _send_via_sendblue_sms(subject=subject, body=body):
        logger.info("Waitlist notify sent via Sendblue SMS to owner")
        return True
    logger.warning(
        "Waitlist signup saved but owner not notified "
        "(set RESEND_API_KEY, WAITLIST_SMTP_*, or WAITLIST_NOTIFY_PHONE / SENDBLUE_ALLOWED_E164)."
    )
    return False
