# TODO: Comp Pro access for Nathan Simeon

When the user says **"they signed up"** (or references this file), run the steps below immediately — no extra questions unless the DB lookup fails.

## Person

| Field | Value |
|-------|--------|
| Email | `nsimeon323@gmail.com` |
| Phone (E.164) | `+17817245665` |
| Display | `+1 (781) 724-5665` |

## Signup checklist (they do this first)

Send them these steps before comping:

1. Open production login (Netlify frontend → `/login`).
2. **Phone first:** `+17817245665` → enter SMS code.
3. **Then Google:** `nsimeon323@gmail.com` → **Select all** permissions on consent screen.
4. Chat briefly so interests exist; answer proactive timing if asked (morning / evening / whenever).
5. Text the Ally Sendblue number from that same phone once comp is applied.

## Agent runbook (after signup)

### 1. Confirm user exists

```bash
heroku pg:psql -a ally-web-backend -c "
SELECT id, email, phone_e164, phone_verified_at,
       stripe_subscription_status, stripe_plan,
       google_sub IS NOT NULL AS has_google
FROM users
WHERE lower(email) = lower('nsimeon323@gmail.com')
   OR phone_e164 = '+17817245665';
"
```

- **0 rows** → tell user they still need to complete signup (phone + Google).
- **1 row** → continue.

### 2. Grant free Pro (SMS + proactive)

```bash
heroku pg:psql -a ally-web-backend -c "
UPDATE users
SET
  stripe_subscription_status = 'active',
  stripe_plan = 'pro',
  phone_e164 = '+17817245665',
  phone_verified_at = COALESCE(phone_verified_at, NOW()),
  updated_at = NOW()
WHERE lower(email) = lower('nsimeon323@gmail.com')
   OR phone_e164 = '+17817245665';
"
```

### 3. Verify

```bash
heroku pg:psql -a ally-web-backend -c "
SELECT email, phone_e164, phone_verified_at,
       stripe_subscription_status, stripe_plan
FROM users
WHERE lower(email) = lower('nsimeon323@gmail.com');
"
```

Expect: `stripe_subscription_status = active`, `stripe_plan = pro`, phone verified.

### 4. Tell them to test

- Text the Sendblue number from `+1 781-724-5665` → should get a reply (not pricing upsell).
- Proactive texts: only if profile has interests + update window; first ping then waits for reply (deployed `20260521_14`).

## Prod infra (already OK as of 2026-05-21)

- Heroku app: `ally-web-backend`
- Migration head: `20260521_14` (proactive await-reply)
- Worker dyno: scaled (proactive scheduler)

## Notes

- No `is_superuser` flag in app — comp is DB `active` + `pro` only.
- `SENDBLUE_OWNER_EMAIL` does **not** grant access to other users.
- Stripe webhook may overwrite DB if they later subscribe/cancel in Stripe; prefer Stripe 100% coupon for long-term comp (optional).

## Status

- [ ] They completed signup (phone + Google)
- [ ] DB comp applied
- [ ] Verified SMS works
- [ ] (Optional) Confirmed proactive behavior after interests set
