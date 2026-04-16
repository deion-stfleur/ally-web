# Exact steps: deploy Ally API to Heroku (then connect Google, Sendblue, frontend)

Pick a **Heroku app name** now (letters, numbers, hyphens; must be globally unique). Example: `ally-api-deion`. Everywhere below, replace `YOUR_APP_NAME` with that name.

Your API base URL will be:

`https://YOUR_APP_NAME.herokuapp.com`

---

## Step 0 — One-time tools

1. Install [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli).
2. In a terminal, run:

```bash
heroku login
```

3. Go to the repo root on your machine:

```bash
cd /Users/deionstfleur/ally-web
```

(Use your real path if different.)

---

## Step 1 — Create the Heroku app + Postgres

Run (replace `YOUR_APP_NAME`):

```bash
heroku create YOUR_APP_NAME
heroku addons:create heroku-postgresql:essential-0 --app YOUR_APP_NAME
```

- Heroku sets **`DATABASE_URL`** for you. You do **not** need to paste the DB URL into Config Vars manually.

---

## Step 2 — Attach Git remote (if not already)

If this repo is not linked yet:

```bash
heroku git:remote --app YOUR_APP_NAME
```

If it says the remote already exists, you’re fine.

---

## Step 3 — Set Heroku config vars (copy from your local `backend/.env`)

### 3a — Open config in the browser

1. Dashboard: `https://dashboard.heroku.com/apps/YOUR_APP_NAME/settings`
2. Click **Reveal Config Vars** (or add vars one by one).

### 3b — Add each variable

Copy values from your working **`backend/.env`** (same names). Set at least:

| Key | Value |
|-----|--------|
| `GOOGLE_CLIENT_ID` | Same as local |
| `GOOGLE_CLIENT_SECRET` | Same as local |
| `GOOGLE_REDIRECT_URI` | **`https://YOUR_APP_NAME.herokuapp.com/api/auth/callback`** (exactly this; replace `YOUR_APP_NAME`) |
| `JWT_SECRET` | Same as local (long random secret) |
| `ANTHROPIC_API_KEY` | Same as local |
| `FRONTEND_URL` | Your real frontend origin, e.g. `https://your-site.netlify.app` (**no** trailing slash) |
| `SENDBLUE_API_KEY` | If you use Sendblue |
| `SENDBLUE_API_SECRET` | If you use Sendblue |
| `SENDBLUE_FROM_NUMBER` | Your Sendblue line, e.g. `+16452468277` |
| `SENDBLUE_ALLOWED_E164` | Your phone, e.g. `+15555550123` |
| `SENDBLUE_OWNER_EMAIL` | Same email as your Google login row in the DB (lowercase as stored) |
| `SENDBLUE_WEBHOOK_SECRET` | Optional; only if you configured a secret on the webhook |

Optional:

| Key | Value |
|-----|--------|
| `ADDITIONAL_CORS_ORIGINS` | Extra allowed origins, comma-separated, no spaces after commas |
| `ANTHROPIC_MODEL` | Only if you override the default model |

**Do not** set `PORT` yourself — Heroku injects it.

---

## Step 4 — Google Cloud: allow the Heroku redirect URL

1. Open [Google Cloud Console](https://console.cloud.google.com/) → select the project that owns your OAuth client.
2. **APIs & Services** → **Credentials** → click your **OAuth 2.0 Client ID** (Web application).
3. Under **Authorized redirect URIs**, click **ADD URI**.
4. Add exactly:

`https://YOUR_APP_NAME.herokuapp.com/api/auth/callback`

5. **Save**.

If this URI does not match **`GOOGLE_REDIRECT_URI`** on Heroku byte-for-byte, login will fail with `redirect_uri_mismatch`.

---

## Step 5 — Deploy the API (push code)

From the repo root, on the branch you want to deploy (often `main`):

```bash
git status
git push heroku HEAD:main
```

If your default branch is **`master`** instead:

```bash
git push heroku HEAD:master
```

Wait until the push finishes. Heroku runs **`release`** (`alembic upgrade head`) then starts **`web`**.

If deploy **fails**, run:

```bash
heroku logs --tail --app YOUR_APP_NAME
```

or for the last release only:

```bash
heroku releases:output --app YOUR_APP_NAME
```

---

## Step 6 — Turn on the web dyno (and worker if you need it)

```bash
heroku ps:scale web=1 --app YOUR_APP_NAME
```

Only if you use **scheduled Gmail sends** (`worker.py`):

```bash
heroku ps:scale worker=1 --app YOUR_APP_NAME
```

---

## Step 7 — Smoke test the API

```bash
curl -s https://YOUR_APP_NAME.herokuapp.com/api/health
```

You should see JSON like `{"ok":true,...}`.

---

## Step 8 — Sendblue webhook (Inbound Messages)

1. In Sendblue dashboard → **Webhook Endpoints** → **Inbound Messages** → **Add Webhook**.
2. URL (exact):

`https://YOUR_APP_NAME.herokuapp.com/api/webhooks/sendblue`

3. Optional: set a webhook secret in Sendblue and set the **same** value in Heroku as `SENDBLUE_WEBHOOK_SECRET`.
4. **Save Configuration** in Sendblue.

---

## Step 9 — Point the React app at Heroku

Wherever the frontend is built (e.g. **Netlify** → Site settings → Environment variables):

1. Set **`REACT_APP_API_BASE_URL`** to:

`https://YOUR_APP_NAME.herokuapp.com`

(no trailing slash, no `/api` suffix — your app already prefixes `/api/...` in code.)

2. Trigger a **new deploy** of the frontend so the env var is baked into the build.

---

## Step 10 — Sign in once on production

1. Open your **deployed** frontend URL in the browser.
2. Sign in with Google **once**.
3. That creates/refreshes your user row and encrypted **refresh token** in Postgres (needed for Gmail / tools / Sendblue).

---

## Step 11 — Quick checklist

- [ ] `curl .../api/health` works  
- [ ] Google redirect URI added + matches `GOOGLE_REDIRECT_URI`  
- [ ] Frontend `REACT_APP_API_BASE_URL` = `https://YOUR_APP_NAME.herokuapp.com` and redeployed  
- [ ] You signed in on production once  
- [ ] Sendblue inbound webhook URL saved  
- [ ] Text your Sendblue number → you get a reply  

If something fails, capture **Heroku logs** around the request and the **browser network tab** error for `/api/auth/google` or `/api/chat`.

---

## Quick demo today: text Sendblue while the API runs on your laptop (~10 min)

Sendblue must **POST** to a public **HTTPS** URL. Your phone does not talk to `localhost`. Use a **tunnel** so `https://…` hits your machine’s port **8000**.

### A. Run the API locally (same as always)

1. `backend/.env` has `DATABASE_URL`, Anthropic, Google, **and** all `SENDBLUE_*` vars (including `SENDBLUE_OWNER_EMAIL` = your Google login email).
2. From repo root or `backend/`, run API on **8000**:

```bash
cd backend && uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

3. Quick check: `curl -s http://127.0.0.1:8000/api/health` → should return JSON.

### B. Start a tunnel (pick one)

**ngrok** (common):

1. Install: [ngrok download](https://ngrok.com/download) or `brew install ngrok`
2. In a **second** terminal:

```bash
ngrok http 8000
```

3. Copy the **HTTPS** URL it prints, e.g. `https://abcd-12-34-56-78.ngrok-free.app` (yours will differ).

**Cloudflare Tunnel** (`cloudflared`) works too if you already use it — same idea: public HTTPS → local `8000`.

### C. Point Sendblue at the tunnel (temporary for the demo)

1. Sendblue dashboard → **Webhook Endpoints** → **Inbound Messages** → add (or edit) webhook URL to:

`https://<YOUR-NGROK-HOST>/api/webhooks/sendblue`

Example: `https://abcd-12-34-56-78.ngrok-free.app/api/webhooks/sendblue`

2. **Save Configuration**.

3. If you set `SENDBLUE_WEBHOOK_SECRET` in `.env`, configure the **same** secret on that webhook in Sendblue (or clear the secret on both sides for a quick test).

### D. Before you text

1. Sign in to the app **once** in the browser (localhost or Netlify) with the **same** Google account as `SENDBLUE_OWNER_EMAIL`, so Postgres has your **refresh token** (Sendblue uses that for Claude + Gmail tools).
2. `SENDBLUE_ALLOWED_E164` must match the phone you text **from** (E.164, e.g. `+15555550123`).

### E. Demo

Text your **Sendblue line** from your phone → you should get a reply in ~10–45s depending on Claude.

### F. After the demo

- **ngrok URLs change** when you restart ngrok (unless you pay for a fixed domain). Update Sendblue again or switch the webhook to **Heroku** when you deploy.
- Turn off ngrok when done so random traffic stops hitting your laptop.
