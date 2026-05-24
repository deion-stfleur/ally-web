# Ally agent capabilities (P1 + P2a + sites + sports)

## What shipped

| Feature | How |
|---------|-----|
| **P1 Flights** | Tool `build_flight_search_link` → Google Flights + Kayak URLs |
| **P1 Movies** | Tool `build_movie_search_link` → Fandango + Google showtimes |
| **P1 Restaurants** | Prompt: always send `booking_url` from OpenTable/Resy MCP |
| **P2a Local** | Tool `things_to_do_near` → Google Geocoding + Places (`GOOGLE_MAPS_API_KEY`) |
| **Sites (vibe coding)** | Multi-file projects, versions, `preview_url`, `publish_ally_site` → `{FRONTEND_URL}/s/{slug}` |
| **Sports** | Prompt-only: research + opinion, **no odds** or sportsbook links |

## Environment

```bash
# P2a — enable Geocoding API + Places API in Google Cloud
GOOGLE_MAPS_API_KEY=

# Optional override for site URLs in tool results (default: FRONTEND_URL)
ALLY_SITES_PUBLIC_BASE_URL=
```

Run migration:

```bash
cd backend && alembic upgrade head
```

## Public site URLs

- **Preview (draft):** `https://<frontend>/s/my-slug?preview=<token>` (token from tool `preview_url`)
- **Live:** `https://<frontend>/s/my-slug` after `publish_ally_site`
- **Assets API:** `GET /api/sites/{slug}/styles.css` (same `?preview=` for draft)

### Site tools

| Tool | Purpose |
|------|---------|
| `create_ally_site` | New project + files (min `index.html`) |
| `write_site_files` | Merge edits → new version |
| `read_site_file` / `list_site_files` | Inspect before editing |
| `publish_ally_site` | Draft → live |

Pass `design_tokens`: `{ "accent": "#0ea5e9", "vibe": "editorial minimal" }` for consistent iterations.

Hosted on **your** stack (Postgres + API), not per-user Netlify.

## Cost notes

- **Places**: Google Maps $200/mo credit; light usage often low cost.
- **Flights/movies P1**: no extra API fees.
- **Sites**: DB storage only on your Heroku/Postgres plan.
- **Sports**: no odds API; uses existing Anthropic + web search.

## Instant push watches

- `register_watch` with `"mode":"instant"` — worker polls every ~15 min (configurable 5–60).
- Texts only when state **changes** vs `last_digest`; `ALL_QUIET` skips SMS.
- Daily mode unchanged: once per day at `time_local`.

## Calendar meeting auto-join (opt-in)

- User must **explicitly** enable via SMS/chat (`enable_meeting_auto_join` or phrases like "auto join my meetings").
- Worker reads Google Calendar for video links and dispatches Meeting BaaS ~2 min before start.
- Say "stop auto join meetings" to disable. Still requires Google connected + worker dyno.

## Not included (future P2b)

- Flight pricing API (Duffel/Amadeus live search)
- Movie seat inventory API
- Netlify per-deploy multi-tenant sync
