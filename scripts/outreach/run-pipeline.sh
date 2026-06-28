#!/usr/bin/env bash
# Full Ally outreach pipeline: discover → enrich → emails → sync landing pages
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CSV="${1:-$ROOT/scripts/outreach/discovered-leads.csv}"
CITY="${2:-Boston, MA}"
LIMIT="${3:-10}"

echo "==> 1/4 Discover businesses ($CITY, $LIMIT per category)"
python3 "$ROOT/scripts/outreach/discover_leads.py" --city "$CITY" --limit "$LIMIT" --output "$CSV"

echo ""
echo "==> 2/4 Enrich emails from websites (optional: set HUNTER_API_KEY in backend/.env)"
python3 "$ROOT/scripts/outreach/discover_leads.py" --enrich "$CSV"

echo ""
echo "==> 3/4 Generate personalized emails"
node "$ROOT/scripts/outreach/generate-emails.mjs" --csv "$CSV"

echo ""
echo "==> 4/4 Sync slugs to outreach-leads.json (for yourfriendally.com/{slug})"
python3 "$ROOT/scripts/outreach/discover_leads.py" --sync-only --output "$CSV"

echo ""
echo "Done. Review: $CSV and scripts/outreach/output/"
echo "Deploy frontend after adding leads. Set OUTREACH_BOOKING_URL / REACT_APP_OUTREACH_BOOKING_URL."
