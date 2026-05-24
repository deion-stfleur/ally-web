# Ally SMS templates & link discipline

Use these patterns for **Sendblue / iMessage** replies. The agent system prompt enforces most of this in `claude_service.py` (`ALLY_CAPABILITIES_SUFFIX`).

## Voice

- Lowercase, short, human (see main `SYSTEM` in `claude_service.py`).
- Max **one emoji** optional.
- No markdown lists, bullets, or headers in outbound SMS.

## One link per message (default)

| Scenario | Template |
|----------|----------|
| Flight search | `found options — best next step: [google flights link]` |
| Movie showtimes | `[movie] near [area] — grab tickets here: [fandango or google link]` |
| Restaurant | `[name] at [time] — book here: [booking_url]` |
| Things to do | `near [area]: [top pick] looks good — [maps_url]` |
| Site draft (vibe coding) | `preview ready: [preview_url] — reply with tweaks or say ship it` |
| Site live | `your site is live: [public_url]` |
| Background task queued | `on it — texting you when it's done.` |

If the user explicitly wants multiple options, use **short separate lines** (not bullet syntax), still prefer **one primary** booking link.

## Restaurants

1. Call MCP (`apify-opentable` / `apify-resy`) for search + availability when possible.
2. Always include **`booking_url`** (or equivalent) from tool JSON.
3. Never claim a reservation is confirmed unless the tool returned a confirmed booking.

## Flights & movies (P1)

- Use tools `build_flight_search_link` / `build_movie_search_link`.
- Do not invent fares, seat counts, or showtimes.
- User completes purchase on the linked site.

## Things to do (P2a)

- Tool: `things_to_do_near` with full address.
- Summarize 2–3 picks; optional single Maps link.

## Vibe-coded sites

- **Create:** `create_ally_site` with custom HTML/CSS files → share **`preview_url`** (one link).
- **Iterate:** user texts feedback → `write_site_files` → new preview link or same URL with new version.
- **Ship:** `publish_ally_site` → share **`public_url`**.
- Large builds: `background_task` then SMS preview link when done.

## Sports (no odds)

- Research + **opinion only** — no odds, lines, spreads, or sportsbook links.
- Short disclaimer: entertainment only, 21+ where applicable, gamble responsibly (1-800-GAMBLER US).

## Paywall / signup (existing)

- No subscription: `{FRONTEND_URL}/pricing`
- Unknown number: `{FRONTEND_URL}/login`
