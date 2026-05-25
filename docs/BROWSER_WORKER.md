# Ally browser worker (Browser Use + Railway)

**Ally Pro only.** When Claude emits a `browser_task` action, a job is stored in `scheduled_jobs` (`job_type = browser_task`). The **Railway** service polls the same Postgres DB and runs [Browser Use](https://github.com/browser-use/browser-use), then callbacks Heroku to SMS the user.

## Architecture

- **Heroku** — API, SMS, creates `browser_task` jobs (Pro gate in `create_browser_task_job`)
- **Heroku worker** — does **not** run `browser_task` jobs (SQL excludes them)
- **Railway** — `browser-worker/` polls and runs Browser Use
- **Callback** — `POST /api/internal/browser-jobs/complete` with `X-Ally-Internal-Secret`

## Heroku env (add)

```bash
ALLY_INTERNAL_SECRET=<random-long-secret>
BROWSER_WORKER_MAX_STEPS=25
```

`BACKEND_PUBLIC_URL` should already be set (used in callback URL from Railway).

## Railway service

1. New service from repo, root directory **`browser-worker/`** (or set Dockerfile path).
2. Attach **same `DATABASE_URL`** as production Postgres.
3. Env:

```bash
DATABASE_URL=...
ANTHROPIC_API_KEY=...
ANTHROPIC_MODEL=claude-sonnet-4-20250514
BACKEND_PUBLIC_URL=https://ally-web-backend-9e9dc3fed95b.herokuapp.com
ALLY_INTERNAL_SECRET=<same as Heroku>
BROWSER_WORKER_MAX_CONCURRENT=4
BROWSER_WORKER_MAX_STEPS=25
BROWSER_TASK_TIMEOUT_SECONDS=600
```

4. Plan: **≥ 2 GB RAM** recommended for a few parallel Chromium instances.

## Pro gating

- `user_has_ally_pro()` in `billing_plans.py`
- Starter / no sub → `pro_required` error; SMS points to `/pricing`

## Claude action

```json
{"action":"browser_task","task":"check showtimes for Dune 3 near Boston","start_url":"https://www.google.com"}
```

## Local smoke test (optional)

```bash
cd browser-worker
pip install -r requirements.txt
export DATABASE_URL=... ANTHROPIC_API_KEY=... BACKEND_PUBLIC_URL=... ALLY_INTERNAL_SECRET=...
python worker.py
```
