from __future__ import annotations

import asyncio
import logging
import uuid
from typing import Any

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request, status
from stripe.error import SignatureVerificationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from db.models import User
from deps import get_current_session, get_db
from models.schemas import BillingPortalResponse, CheckoutSessionResponse
from services.chat_persist import resolve_db_user_id
from services.session_store import UserSession

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/billing", tags=["billing"])


def _stripe_checkout_ready() -> bool:
    return bool(
        (settings.stripe_secret_key or "").strip()
        and (settings.stripe_price_sms_monthly or "").strip()
    )


def _set_stripe_key() -> None:
    sk = (settings.stripe_secret_key or "").strip()
    if not sk:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stripe is not configured (missing STRIPE_SECRET_KEY).",
        )
    stripe.api_key = sk


async def _load_billing_user(
    db: AsyncSession, session: UserSession
) -> tuple[uuid.UUID, User]:
    user_id = await resolve_db_user_id(db, session.google_sub, session.db_user_id)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not found; sign in again.",
        )
    r = await db.execute(select(User).where(User.id == user_id))
    row = r.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    return user_id, row


async def _sync_subscription_on_user(
    db: AsyncSession,
    *,
    user_id: uuid.UUID | None,
    customer_id: str | None,
    subscription_id: str | None,
    status: str | None,
) -> None:
    """Attach Stripe IDs and status to the app user (idempotent)."""
    row: User | None = None
    if user_id is not None:
        r = await db.execute(select(User).where(User.id == user_id))
        row = r.scalar_one_or_none()
    if row is None and customer_id:
        r = await db.execute(select(User).where(User.stripe_customer_id == customer_id))
        row = r.scalar_one_or_none()
    if row is None and subscription_id:
        r = await db.execute(select(User).where(User.stripe_subscription_id == subscription_id))
        row = r.scalar_one_or_none()
    if row is None:
        logger.warning(
            "stripe: no user for sync user_id=%s customer=%s sub=%s",
            user_id,
            customer_id,
            subscription_id,
        )
        return
    if customer_id:
        row.stripe_customer_id = customer_id
    if subscription_id:
        row.stripe_subscription_id = subscription_id
    if status is not None and str(status).strip():
        row.stripe_subscription_status = str(status).strip()[:64]
    await db.commit()


@router.post("/checkout-session", response_model=CheckoutSessionResponse)
async def create_checkout_session(
    session: UserSession = Depends(get_current_session),
    db: AsyncSession = Depends(get_db),
) -> CheckoutSessionResponse:
    if not _stripe_checkout_ready():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Checkout is not configured. Set STRIPE_SECRET_KEY and STRIPE_PRICE_SMS_MONTHLY.",
        )
    _set_stripe_key()
    user_id, user = await _load_billing_user(db, session)
    base = settings.frontend_url.rstrip("/")
    success_url = f"{base}/chat?sms_sub=success"
    cancel_url = f"{base}/chat?sms_sub=cancel"
    params: dict[str, Any] = {
        "mode": "subscription",
        "line_items": [{"price": settings.stripe_price_sms_monthly, "quantity": 1}],
        "success_url": success_url,
        "cancel_url": cancel_url,
        "metadata": {"user_id": str(user_id)},
        "client_reference_id": str(user_id),
        "allow_promotion_codes": True,
    }
    cust = (user.stripe_customer_id or "").strip()
    if cust:
        params["customer"] = cust
    elif session.email:
        params["customer_email"] = session.email
    checkout_session = await asyncio.to_thread(stripe.checkout.Session.create, **params)
    url = checkout_session.get("url")
    if not url:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Stripe did not return a checkout URL.",
        )
    return CheckoutSessionResponse(url=url)


@router.post("/portal-session", response_model=BillingPortalResponse)
async def create_portal_session(
    session: UserSession = Depends(get_current_session),
    db: AsyncSession = Depends(get_db),
) -> BillingPortalResponse:
    _set_stripe_key()
    _user_id, user = await _load_billing_user(db, session)
    cust = (user.stripe_customer_id or "").strip()
    if not cust:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No Stripe customer on file. Subscribe once from checkout first.",
        )
    base = settings.frontend_url.rstrip("/")
    portal = await asyncio.to_thread(
        stripe.billing_portal.Session.create,
        customer=cust,
        return_url=f"{base}/chat",
    )
    url = portal.get("url")
    if not url:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Stripe did not return a portal URL.",
        )
    return BillingPortalResponse(url=url)


@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict[str, bool]:
    """Stripe sends raw body; signature must be verified with STRIPE_WEBHOOK_SECRET."""
    wh_secret = (settings.stripe_webhook_secret or "").strip()
    if not wh_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="STRIPE_WEBHOOK_SECRET is not set.",
        )
    _set_stripe_key()
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    if not sig_header:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing Stripe-Signature")
    try:
        event = stripe.Webhook.construct_event(payload, sig_header, wh_secret)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    except SignatureVerificationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Stripe signature",
        ) from e

    etype = event.get("type")
    obj = (event.get("data") or {}).get("object") or {}

    try:
        if etype == "checkout.session.completed":
            sess = obj
            if sess.get("mode") != "subscription":
                return {"received": True}
            md = sess.get("metadata") or {}
            uid_raw = md.get("user_id")
            user_uuid: uuid.UUID | None = None
            if uid_raw:
                try:
                    user_uuid = uuid.UUID(str(uid_raw))
                except ValueError:
                    logger.error("stripe checkout: bad user_id metadata %r", uid_raw)
            sub_id = sess.get("subscription")
            cust_id = sess.get("customer")
            if isinstance(sub_id, dict):
                sub_id = sub_id.get("id")
            status_str = None
            if sub_id:
                sub = await asyncio.to_thread(stripe.Subscription.retrieve, sub_id)
                status_str = sub.get("status")
            elif not cust_id:
                logger.warning("stripe checkout.session.completed missing subscription and customer")
            await _sync_subscription_on_user(
                db,
                user_id=user_uuid,
                customer_id=str(cust_id) if cust_id else None,
                subscription_id=str(sub_id) if sub_id else None,
                status=status_str,
            )

        elif etype in ("customer.subscription.updated", "customer.subscription.deleted"):
            sub_id = obj.get("id")
            cust_id = obj.get("customer")
            status_str = obj.get("status")
            await _sync_subscription_on_user(
                db,
                user_id=None,
                customer_id=str(cust_id) if cust_id else None,
                subscription_id=str(sub_id) if sub_id else None,
                status=status_str,
            )
    except Exception:
        logger.exception("stripe webhook handler failed event=%s", etype)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Webhook processing failed",
        ) from None

    return {"received": True}
