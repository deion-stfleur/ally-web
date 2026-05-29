# Meeting BaaS v2 — webhooks & meeting notes SMS

Ally joins Meet / Zoom / Teams via **Meeting BaaS v2** and texts you a summary when the call ends.

## 1. Heroku env

```bash
MEETING_BAAS_API_KEY=mb-...          # v2 key from Meeting BaaS dashboard
BACKEND_PUBLIC_URL=https://ally-web-backend-9e9dc3fed95b.herokuapp.com
```

## 2. Webhook URL (use this everywhere)

```
https://ally-web-backend-9e9dc3fed95b.herokuapp.com/api/webhooks/meeting-baas
```

Verify it’s reachable:

```bash
curl -s https://ally-web-backend-9e9dc3fed95b.herokuapp.com/api/webhooks/meeting-baas/status
```

## 3. Meeting BaaS v2 dashboard

1. Log in at [meetingbaas.com](https://meetingbaas.com) (v2 team).
2. Open **Settings → Webhooks** (or **Developers → Webhooks**).
3. Set the **account webhook URL** to the URL above.
4. Ensure events include **`bot.completed`** and **`bot.failed`**.
5. Save.

> v1 webhooks do **not** carry over to v2. You must set this again in v2.

## 4. Per-bot callbacks (automatic)

When Ally joins a meeting, the API sends:

```json
"callback_config": { "url": "https://.../api/webhooks/meeting-baas" }
```

So notes can work even before account webhooks are set — but **both** are recommended.

## 5. API key type

Use a **Full Access** v2 API key for join + polling. “Sending only” keys cannot read bot details for reconciliation.

## 6. During the meeting

- Admit **“Ally Notes”** from the waiting room.
- Let people speak (silent meetings → empty transcript).

## 7. If notes still don’t arrive

- Worker dyno must be running (reconciliation polls ~8+ minutes after join).
- Check Heroku logs: `meeting baas webhook`, `meeting baas reconciled`.
- In Meeting BaaS dashboard, open the bot → check **callback / webhook delivery** logs.
- Retry from their UI: **Resend final webhook** or **Retry callback** for that `bot_id`.

## 8. Import v1 tokens (optional)

Settings → Usage → **Import from v1** if you still have token balance on v1.
