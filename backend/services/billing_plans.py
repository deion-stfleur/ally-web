"""Stripe plan tiers: Ally ($10) and Ally Pro ($30)."""

from __future__ import annotations

from config import settings

PLAN_STARTER = "starter"
PLAN_PRO = "pro"

ACTIVE_STATUSES = frozenset({"active", "trialing"})


def stripe_billing_configured() -> bool:
    return bool(
        (settings.stripe_secret_key or "").strip()
        and (price_id_for_plan(PLAN_STARTER) or price_id_for_plan(PLAN_PRO))
    )


def price_id_for_plan(plan: str) -> str | None:
    p = (plan or "").strip().lower()
    if p == PLAN_STARTER:
        return (settings.stripe_price_starter_monthly or "").strip() or None
    if p == PLAN_PRO:
        pro = (settings.stripe_price_pro_monthly or "").strip()
        if pro:
            return pro
        return (settings.stripe_price_sms_monthly or "").strip() or None
    return None


def plan_for_price_id(price_id: str | None) -> str | None:
    pid = (price_id or "").strip()
    if not pid:
        return None
    starter = (settings.stripe_price_starter_monthly or "").strip()
    pro = (settings.stripe_price_pro_monthly or "").strip()
    legacy = (settings.stripe_price_sms_monthly or "").strip()
    if starter and pid == starter:
        return PLAN_STARTER
    if pro and pid == pro:
        return PLAN_PRO
    if legacy and pid == legacy:
        return PLAN_PRO
    return None


def subscription_is_active(status: str | None) -> bool:
    return (status or "").strip().lower() in ACTIVE_STATUSES


def plan_from_subscription_object(sub: dict) -> tuple[str | None, str | None]:
    """Return (plan, price_id) from a Stripe subscription dict."""
    items = (sub.get("items") or {}).get("data") or []
    if not items:
        return None, None
    first = items[0] or {}
    price = first.get("price") or {}
    price_id = price.get("id")
    if not price_id and first.get("plan"):
        price_id = (first.get("plan") or {}).get("id")
    plan = plan_for_price_id(str(price_id) if price_id else None)
    return plan, str(price_id) if price_id else None
