# Stripe setup (Ally $10 + Ally Pro $30)

This app uses two recurring Stripe **Prices** mapped to plan ids `starter` ($10) and `pro` ($30).

## 1. Stripe Dashboard

1. **Products** → create (or reuse) two products:
   - **Ally** — $10.00 USD / month, recurring
   - **Ally Pro** — $30.00 USD / month, recurring
2. Open each **Price** and copy the id (`price_…`).
3. **Developers → API keys** → copy the **Secret key** (`sk_live_…` or `sk_test_…`).

Optional: enable a **free trial** on the Price (e.g. 7 days) in the Dashboard; checkout uses `mode: subscription` and will honor trial settings on the price.

## 2. Webhook

**Developers → Webhooks → Add endpoint**

| Field | Value |
|--------|--------|
| URL | `https://<YOUR_BACKEND_HOST>/api/billing/webhook` |
| Events | `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted` |

Copy the **Signing secret** (`whsec_…`) → `STRIPE_WEBHOOK_SECRET`.

### Local testing

```bash
stripe listen --forward-to localhost:8000/api/billing/webhook
```

Use the CLI signing secret in `.env` while testing.

## 3. Environment variables

Set on Heroku (`ally-web-backend`) and in `backend/.env` locally:

```bash
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER_MONTHLY=price_...   # Ally $10
STRIPE_PRICE_PRO_MONTHLY=price_...       # Ally Pro $30
FRONTEND_URL=https://resplendent-melba-7d820a.netlify.app   # or your prod URL
```

Legacy: `STRIPE_PRICE_SMS_MONTHLY` is treated as the **Pro** price id if `STRIPE_PRICE_PRO_MONTHLY` is unset.

## 4. Database migration

After deploying code with `users.stripe_plan`:

```bash
# Heroku
heroku run alembic upgrade head -a ally-web-backend

# Local
cd backend && alembic upgrade head
```

## 5. API behavior

| Endpoint | Purpose |
|----------|---------|
| `POST /api/billing/checkout-session` | Body: `{ "plan": "starter" \| "pro" }` → Stripe Checkout URL |
| `POST /api/billing/portal-session` | Customer portal (change/cancel plan) |
| `POST /api/billing/webhook` | Syncs `stripe_customer_id`, subscription status, `stripe_plan` |

Frontend: signed-in users open **`/pricing`** to subscribe or manage billing.

## 6. What each plan unlocks

| Feature | Ally (`starter`) | Ally Pro (`pro`) |
|---------|------------------|------------------|
| Web + Google | ✓ | ✓ |
| SMS (inbound/outbound) | ✓ (active sub) | ✓ |
| Proactive texts | ✗ | ✓ (requires `worker=1` on Heroku) |
| Deeper multi-step follow-through | limited | full |

When Stripe is **not** configured, SMS gating and Pro-only proactive checks are skipped (local dev).

## 7. Heroku checklist

```bash
heroku config:set \
  STRIPE_SECRET_KEY=sk_... \
  STRIPE_WEBHOOK_SECRET=whsec_... \
  STRIPE_PRICE_STARTER_MONTHLY=price_... \
  STRIPE_PRICE_PRO_MONTHLY=price_... \
  -a ally-web-backend

heroku run alembic upgrade head -a ally-web-backend
heroku ps:scale worker=1 -a ally-web-backend   # proactive SMS for Pro
```

Redeploy the frontend so `/pricing` is live (`npm run build` + Netlify deploy from `frontend/`).

## 8. Verify

1. Sign in → `/pricing` → **Get Ally** or **Get Ally Pro** → complete Checkout (test card `4242…` in test mode).
2. Webhook fires → user has `sms_plan_active` and `subscription_plan` on `GET /api/auth/me`.
3. Pro user: set interests + preferred update time in chat; confirm proactive job runs with worker dyno on.
