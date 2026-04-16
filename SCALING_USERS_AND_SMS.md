# Scaling: multi-user web, per-user memory, and SMS (Sendblue)

This document captures **planning steps only**—implementation order for growing beyond a single SMS recipient and a single “owner” account, while keeping **Google data and chat memory scoped per user**.

---

## Current mental model (today)

- **Web:** Each Google sign-in → `User` row; JWT session → `user_id`. Conversations and messages are keyed by `user_id` (owned conversations). Google refresh token is **per user**.
- **SMS (Sendblue):** Inbound is gated by env (`SENDBLUE_ALLOWED_E164`) and attributed to one user via `SENDBLUE_OWNER_EMAIL`—good for **solo / demo**, not for “any customer texts in.”

---

## Phase A — Web & data isolation (baseline)

1. **Treat `user_id` as the tenant key** for every persisted feature: chats, todos, scheduled jobs, future “memory” tables.
2. **Audit API paths** so every read/write includes an ownership check (conversation belongs to `user_id`, etc.).
3. **Avoid cross-user context** in LLM calls: only pass that user’s history and tool results built from **that** user’s Google credentials.
4. **Observability:** structured logs with `user_id` (or hash) where useful; metrics on auth and chat errors.
5. **Rate limits** (later): per-user and global caps on expensive endpoints to reduce abuse and runaway cost.

---

## Phase B — Verified phone on the account

6. **Product rule:** e.g. one verified mobile per Ally account (or document if you allow multiple).
7. **Flow:** After Google sign-in, user enters phone → **verify ownership** (SMS OTP, magic link, or provider-supported verify) → only then persist.
8. **Storage:** e.g. `phone_e164` (normalized), `phone_verified_at`, optional country/metadata; **unique index** on verified `phone_e164` if one-number-per-account.
9. **Compliance:** SMS consent, opt-out (STOP), privacy policy updates; get legal input for your regions (e.g. US TCPA-style expectations).

---

## Phase C — Sendblue: route by caller, not env “owner”

10. **Inbound webhook:** Read `from_number` from Sendblue payload → normalize to E.164 → **lookup `User` by verified `phone_e164`**.
11. **Unknown caller:** Policy choice—short auto-reply with link to verify, or silent drop; log for abuse review.
12. **Known user:** Load **their** Google credentials from `User`; run the same AI + tools stack as web, scoped to **that** `user_id`.
13. **Dedicated SMS thread:** Keep (or add) a per-user SMS conversation pointer (e.g. one long-running thread per user) so SMS history does not overwrite arbitrary web threads.
14. **Retire env-based routing:** Stop using a global `SENDBLUE_OWNER_EMAIL` for “who is texting”; keep env for **API keys**, **from number**, **webhook secret**, optional allowlists during rollout.
15. **Dedupe / idempotency:** Keep or extend inbound dedupe (e.g. `message_handle`) so retries do not double-process.
16. **Staging:** Test with a second verified number and a staging webhook URL before changing production behavior.

---

## Phase D — Scale and cost

17. **Per-user and global quotas** on SMS-triggered AI (messages/day, tokens, concurrent jobs).
18. **Sendblue / carrier limits:** Re-read [Sendblue pricing](https://www.sendblue.com/pricing) and [limits docs](https://docs.sendblue.com/limits/); plan for paid lines when contact or message volume exceeds sandbox/free caps.
19. **Optional:** multiple lines / number pooling when one line’s daily contact or throughput limits become a bottleneck.
20. **Runbooks:** how to revoke a user, unlink a phone, handle compromised account.

---

## Sendblue “free plan” note

- **Sandbox / free tiers** are usually enough to **build and demo** phone → user lookup with a **small** set of verified contacts and **tight** rate limits.
- **Public signup at scale** typically requires a **paid** Sendblue (and/or carrier) posture; confirm current caps on their site before launch.

---

## Suggested order of execution

1. Finish **Phase A** confidence (web-only multi-user is solid).  
2. Implement **Phase B** (verify + store phone on `User`).  
3. Implement **Phase C** (webhook resolves user by phone; remove single-owner env routing).  
4. Add **Phase D** limits and operational polish before broad launch.

---

## Out of scope here

- Exact schema migrations and API shapes (do in implementation tickets).
- Legal final say on SMS—use counsel for production.
