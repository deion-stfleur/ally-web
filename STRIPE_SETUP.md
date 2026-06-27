# Stripe setup (Ally Task Runner $9.99 + Ally $19.99 + Ally Pro $49.99)

This app uses three recurring Stripe **Prices** mapped to plan ids `task_runner` ($9.99), `starter` ($19.99), and `pro` ($49.99).

## 1. Stripe Dashboard

1. **Products** → create (or reuse) three products:
   - **Ally Task Runner** — $9.99 USD / month, recurring
   - **Ally** — $19.99 USD / month, recurring
   - **Ally Pro** — $49.99 USD / month, recurring
2. Open each **Price** and copy the id (`price_…`).
3. **Developers → API keys** → copy the **Secret key** (`sk_live_…` or `sk_test_…`).

Optional: enable a **free trial** on the Price (e.g. 7 days) in the Dashboard; checkout uses `mode: subscription` and will honor trial settings on the price.

### Ally Task Runner — paste into Stripe

When you create the **Ally Task Runner** product in Stripe, use these fields:

| Stripe field | Value |
|--------------|--------|
| **Name** | Ally Task Runner |
| **Description** | See block below |
| **Pricing** | $9.99 USD / month, recurring |
| **Metadata** (optional) | `plan=task_runner` |

**Description** (copy everything below into Stripe’s Description box):

```
Run up to 3 background tasks per day. Ally completes each job and texts you when it's done.

This is a task runner — not a full chat assistant. No Gmail, Calendar, Drive, or Sheets. No conversation memory, no proactive check-ins, no SMS watches.

Text or use web chat to queue a job. Ally runs it in the background and pings you when it finishes. Limit resets daily.

Upgrade to Ally ($19.99/mo) for Google Workspace, unlimited tasks, and full conversational help.
```

After saving, copy the **Price ID** (`price_…`) → `STRIPE_PRICE_TASK_RUNNER_MONTHLY`.

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
STRIPE_PRICE_TASK_RUNNER_MONTHLY=price_1TmwbQHahLICfy6LorunK9kz   # Ally Task Runner $9.99
STRIPE_PRICE_STARTER_MONTHLY=price_1TdEcxHahLICfy6LjEc7fdLG   # Ally $19.99
STRIPE_PRICE_PRO_MONTHLY=price_1TdEeZHahLICfy6L06cd66ql       # Ally Pro $49.99
FRONTEND_URL=https://resplendent-melba-7d820a.netlify.app   # or your prod URL
```

Legacy: `STRIPE_PRICE_SMS_MONTHLY` is treated as the **Pro** price id if `STRIPE_PRICE_PRO_MONTHLY` is unset.

## 4. Database migration

No new migration needed — `users.stripe_plan` already stores the tier string (`task_runner`, `starter`, or `pro`).

## 5. API behavior

| Endpoint | Purpose |
|----------|---------|
| `POST /api/billing/checkout-session` | Body: `{ "plan": "task_runner" \| "starter" \| "pro" }` → Stripe Checkout URL |
| `POST /api/billing/portal-session` | Customer portal (change/cancel plan) |
| `POST /api/billing/webhook` | Syncs `stripe_customer_id`, subscription status, `stripe_plan` |

Frontend: signed-in users open **`/pricing`** to subscribe or manage billing.

## 6. What each plan unlocks

| Feature | Task Runner (`task_runner`) | Ally (`starter`) | Ally Pro (`pro`) |
|---------|----------------------------|------------------|------------------|
| Web + SMS | ✓ (active sub) | ✓ | ✓ |
| Background automations | 3/day | unlimited | unlimited |
| Google Workspace (Gmail, Calendar, Drive, Sheets) | ✗ | ✓ | ✓ |
| SMS watches & meeting auto-join | ✗ | ✓ | ✓ |
| Proactive texts | ✗ | ✗ | ✓ (requires `worker=1` on Heroku) |
| Browser automation | ✗ | ✗ | ✓ |

When Stripe is **not** configured, SMS gating and plan limits are skipped (local dev).

## 7. Heroku checklist

```bash
heroku config:set \
  STRIPE_SECRET_KEY=sk_... \
  STRIPE_WEBHOOK_SECRET=whsec_... \
  STRIPE_PRICE_TASK_RUNNER_MONTHLY=price_1TmwbQHahLICfy6LorunK9kz \
  STRIPE_PRICE_STARTER_MONTHLY=price_1TdEcxHahLICfy6LjEc7fdLG \
  STRIPE_PRICE_PRO_MONTHLY=price_1TdEeZHahLICfy6L06cd66ql \
  -a ally-web-backend

heroku ps:scale worker=1 -a ally-web-backend   # proactive SMS for Pro
```

Redeploy the frontend so `/pricing` is live (`npm run build` + Netlify deploy from `frontend/`).

## 8. Verify

1. Sign in → `/pricing` → **Subscribe to Task Runner** (or Ally / Ally Pro) → complete Checkout (test card `4242…` in test mode).
2. Webhook fires → user has `sms_plan_active` and `subscription_plan` on `GET /api/auth/me`.
3. Task Runner user: queue 3 background tasks in one day → 4th should show upgrade message.
4. Pro user: set interests + preferred update time in chat; confirm proactive job runs with worker dyno on.
