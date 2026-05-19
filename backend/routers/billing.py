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
from models.schemas import (
    BillingPortalResponse,
    CheckoutSessionRequest,
    CheckoutSessionResponse,
)
from services.billing_plans import (
    PLAN_PRO,
    PLAN_STARTER,
    plan_from_subscription_object,
    price_id_for_plan,
    stripe_billing_configured,
)
from services.chat_persist import resolve_db_user_id
from services.session_store import UserSession

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/billing", tags=["billing"])


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
    plan: str | None = None,
) -> None:
    """Attach Stripe IDs, status, and plan tier to the app user (idempotent)."""
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
    if plan in (PLAN_STARTER, PLAN_PRO):
        row.stripe_plan = plan
    elif status and str(status).strip().lower() in ("canceled", "unpaid", "incomplete_expired"):
        row.stripe_plan = None
    await db.commit()


async def _sync_from_subscription_id(
    db: AsyncSession,
    *,
    user_id: uuid.UUID | None,
    subscription_id: str | None,
    customer_id: str | None,
    plan_hint: str | None = None,
) -> None:
    if not subscription_id:
        await _sync_subscription_on_user(
            db,
            user_id=user_id,
            customer_id=customer_id,
            subscription_id=None,
            status=None,
            plan=None,
        )
        return
    sub = await asyncio.to_thread(stripe.Subscription.retrieve, subscription_id)
    plan, _price_id = plan_from_subscription_object(sub)
    if plan is None and plan_hint in (PLAN_STARTER, PLAN_PRO):
        plan = plan_hint
    await _sync_subscription_on_user(
        db,
        user_id=user_id,
        customer_id=str(customer_id or sub.get("customer") or "") or None,
        subscription_id=str(subscription_id),
        status=sub.get("status"),
        plan=plan,
    )


@router.post("/checkout-session", response_model=CheckoutSessionResponse)
async def create_checkout_session(
    body: CheckoutSessionRequest,
    session: UserSession = Depends(get_current_session),
    db: AsyncSession = Depends(get_db),
) -> CheckoutSessionResponse:
    plan = body.plan.strip().lower()
    price_id = price_id_for_plan(plan)
    if not stripe_billing_configured() or not price_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Checkout is not configured. Set STRIPE_SECRET_KEY and STRIPE_PRICE_STARTER_MONTHLY / STRIPE_PRICE_PRO_MONTHLY.",
        )
    _set_stripe_key()
    user_id, user = await _load_billing_user(db, session)
    base = settings.frontend_url.rstrip("/")
    success_url = f"{base}/chat?sub=success&plan={plan}"
    cancel_url = f"{base}/pricing?canceled=1"
    params: dict[str, Any] = {
        "mode": "subscription",
        "line_items": [{"price": price_id, "quantity": 1}],
        "success_url": success_url,
        "cancel_url": cancel_url,
        "metadata": {"user_id": str(user_id), "plan": plan},
        "subscription_data": {"metadata": {"user_id": str(user_id), "plan": plan}},
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
        return_url=f"{base}/pricing",
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
            plan_hint = (md.get("plan") or "").strip().lower() or None
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
            await _sync_from_subscription_id(
                db,
                user_id=user_uuid,
                subscription_id=str(sub_id) if sub_id else None,
                customer_id=str(cust_id) if cust_id else None,
                plan_hint=plan_hint if plan_hint in (PLAN_STARTER, PLAN_PRO) else None,
            )

        elif etype in ("customer.subscription.updated", "customer.subscription.deleted"):
            sub_id = obj.get("id")
            cust_id = obj.get("customer")
            plan, _ = plan_from_subscription_object(obj)
            await _sync_subscription_on_user(
                db,
                user_id=None,
                customer_id=str(cust_id) if cust_id else None,
                subscription_id=str(sub_id) if sub_id else None,
                status=obj.get("status"),
                plan=plan,
            )
    except Exception:
        logger.exception("stripe webhook handler failed event=%s", etype)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Webhook processing failed",
        ) from None

    return {"received": True}
