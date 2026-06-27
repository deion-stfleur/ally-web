"""Stripe plan tiers: Task Runner ($9.99), Ally ($19.99), Ally Pro ($49.99)."""

from __future__ import annotations

from config import settings

PLAN_TASK_RUNNER = "task_runner"
PLAN_STARTER = "starter"
PLAN_PRO = "pro"

VALID_PLANS = frozenset({PLAN_TASK_RUNNER, PLAN_STARTER, PLAN_PRO})
ACTIVE_STATUSES = frozenset({"active", "trialing"})
TASK_RUNNER_DAILY_AUTOMATIONS = 3


def stripe_billing_configured() -> bool:
    return bool(
        (settings.stripe_secret_key or "").strip()
        and (
            price_id_for_plan(PLAN_TASK_RUNNER)
            or price_id_for_plan(PLAN_STARTER)
            or price_id_for_plan(PLAN_PRO)
        )
    )


def price_id_for_plan(plan: str) -> str | None:
    p = (plan or "").strip().lower()
    if p == PLAN_TASK_RUNNER:
        return (settings.stripe_price_task_runner_monthly or "").strip() or None
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
    task_runner = (settings.stripe_price_task_runner_monthly or "").strip()
    starter = (settings.stripe_price_starter_monthly or "").strip()
    pro = (settings.stripe_price_pro_monthly or "").strip()
    legacy = (settings.stripe_price_sms_monthly or "").strip()
    if task_runner and pid == task_runner:
        return PLAN_TASK_RUNNER
    if starter and pid == starter:
        return PLAN_STARTER
    if pro and pid == pro:
        return PLAN_PRO
    if legacy and pid == legacy:
        return PLAN_PRO
    return None


def subscription_is_active(status: str | None) -> bool:
    return (status or "").strip().lower() in ACTIVE_STATUSES


def user_plan(user) -> str | None:
    """Active subscription tier, or None when billing is off / user has no active sub."""
    if not stripe_billing_configured():
        return None
    if not subscription_is_active(user.stripe_subscription_status):
        return None
    p = (user.stripe_plan or "").strip().lower()
    return p if p in VALID_PLANS else None


def user_on_task_runner(user) -> bool:
    return user_plan(user) == PLAN_TASK_RUNNER


def user_has_starter_or_pro(user) -> bool:
    """True when user may use Starter+ features (SMS watches, meeting auto-join, etc.)."""
    if not stripe_billing_configured():
        return True
    p = user_plan(user)
    return p in (PLAN_STARTER, PLAN_PRO)


def user_has_ally_pro(user) -> bool:
    """True when user may use Pro-only features (browser automation, proactive SMS)."""
    if not stripe_billing_configured():
        return True
    if not subscription_is_active(user.stripe_subscription_status):
        return False
    return (user.stripe_plan or "").strip().lower() == PLAN_PRO


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


STARTER_REQUIRED_MSG = (
    "SMS watches and meeting auto-join require ally ($19.99/mo) or pro — upgrade at "
    f"{settings.frontend_url.rstrip('/')}/pricing"
)
