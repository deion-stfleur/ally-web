from __future__ import annotations

import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import PhoneOtpChallenge
from services.phone_e164 import normalize_e164
from services.sendblue_webhook_service import send_sendblue_text_async


def _otp_secret() -> bytes:
    # Stable server secret so hashes remain valid across processes.
    raw = os.getenv("PHONE_OTP_SECRET", "").strip()
    if not raw:
        # Fall back to JWT_SECRET if present (already required).
        raw = os.getenv("JWT_SECRET", "").strip()
    return raw.encode("utf-8")


def _hash_code(*, phone_e164: str, code: str) -> str:
    key = _otp_secret()
    msg = f"{phone_e164}:{code}".encode("utf-8")
    return hmac.new(key, msg, hashlib.sha256).hexdigest()


def _new_code() -> str:
    # 6 digits, no leading zeros issues (000123 is valid).
    return f"{secrets.randbelow(1_000_000):06d}"


async def request_phone_otp(
    db: AsyncSession,
    *,
    phone: str,
    ttl_minutes: int = 10,
) -> None:
    phone_e164 = normalize_e164(phone)
    if not phone_e164:
        raise ValueError("invalid_phone")

    now = datetime.now(timezone.utc)
    # Best-effort cleanup of old challenges for this phone.
    await db.execute(
        delete(PhoneOtpChallenge).where(PhoneOtpChallenge.phone_e164 == phone_e164)
    )

    code = _new_code()
    expires_at = now + timedelta(minutes=max(3, min(ttl_minutes, 30)))
    chal = PhoneOtpChallenge(
        phone_e164=phone_e164,
        code_hash=_hash_code(phone_e164=phone_e164, code=code),
        expires_at=expires_at,
        attempts=0,
    )
    db.add(chal)
    await db.commit()

    await send_sendblue_text_async(
        to_number=phone_e164,
        content=f"Your Ally code is {code}. It expires in 10 minutes.",
    )


async def verify_phone_otp(
    db: AsyncSession,
    *,
    phone: str,
    code: str,
    max_attempts: int = 6,
) -> bool:
    phone_e164 = normalize_e164(phone)
    code = (code or "").strip()
    if not phone_e164 or not code:
        return False

    now = datetime.now(timezone.utc)
    r = await db.execute(
        select(PhoneOtpChallenge)
        .where(PhoneOtpChallenge.phone_e164 == phone_e164)
        .order_by(PhoneOtpChallenge.created_at.desc())
        .limit(1)
    )
    chal = r.scalar_one_or_none()
    if chal is None:
        return False
    if chal.expires_at <= now:
        await db.execute(delete(PhoneOtpChallenge).where(PhoneOtpChallenge.id == chal.id))
        await db.commit()
        return False
    if chal.attempts >= max_attempts:
        await db.execute(delete(PhoneOtpChallenge).where(PhoneOtpChallenge.id == chal.id))
        await db.commit()
        return False

    expected = chal.code_hash
    got = _hash_code(phone_e164=phone_e164, code=code)
    ok = hmac.compare_digest(expected, got)
    if ok:
        await db.execute(delete(PhoneOtpChallenge).where(PhoneOtpChallenge.id == chal.id))
        await db.commit()
        return True

    chal.attempts = int(chal.attempts or 0) + 1
    await db.commit()
    return False

