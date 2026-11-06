# Boston outreach playbook (Ally)

Personalized links: **`https://yourfriendally.com/{slug}`**  
Example: `https://yourfriendally.com/harborline-law`

---

## What’s built in the repo

| Piece | Location |
|--------|-----------|
| Lead data (slug → business) | `frontend/src/data/outreach-leads.json` (git-ignored; fresh clones copy `outreach-leads.example.json`) |
| Personalized landing page | `frontend/src/pages/BusinessOutreach.jsx` |
| Email copy + use cases by vertical | `frontend/src/constants/outreachCopy.js` |
| CSV template | `scripts/outreach/leads-template.csv` |
| Email generator | `scripts/outreach/generate-emails.mjs` |

### Add a lead

1. Edit `frontend/src/data/outreach-leads.json` **or** fill `scripts/outreach/leads-template.csv` and sync:

```bash
node scripts/outreach/generate-emails.mjs --csv scripts/outreach/leads-template.csv
```

2. Generate emails:

```bash
node scripts/outreach/generate-emails.mjs
# one lead only:
node scripts/outreach/generate-emails.mjs --slug harborline-law
```

3. Output lands in `scripts/outreach/output/`.

4. Set your booking link (Calendly):

```bash
# Heroku / Netlify env
REACT_APP_OUTREACH_BOOKING_URL=https://calendly.com/yourfriendally/15min

# For email generator locally
OUTREACH_BOOKING_URL=https://calendly.com/yourfriendally/15min node scripts/outreach/generate-emails.mjs
```

5. Deploy frontend so new slugs go live.

**Verticals** (auto use cases): `legal`, `dental`, `real_estate`, `accounting`, or omit for `default`.

---

## Lead discovery system (automated)

Uses **Google Places API (New)** (same `GOOGLE_MAPS_API_KEY` as Ally’s maps tools) to find businesses, then optionally pulls public emails from their websites.

In Google Cloud Console, enable **Places API (New)** — not the legacy “Places API”.

### One-command pipeline

```bash
chmod +x scripts/outreach/run-pipeline.sh
./scripts/outreach/run-pipeline.sh
# or: ./scripts/outreach/run-pipeline.sh scripts/outreach/discovered-leads.csv "Boston, MA" 10
```

### Step by step

```bash
# 1) Find businesses (law, dental, real estate, accounting in Boston)
python3 scripts/outreach/discover_leads.py --city "Boston, MA" --limit 10

# 2) Try to find emails on their websites (+ Hunter.io if HUNTER_API_KEY set)
python3 scripts/outreach/discover_leads.py --enrich scripts/outreach/discovered-leads.csv

# 3) You: open CSV, add contactName from LinkedIn where missing

# 4) Generate emails + personalized links
node scripts/outreach/generate-emails.mjs --csv scripts/outreach/discovered-leads.csv

# 5) Publish landing pages
python3 scripts/outreach/discover_leads.py --sync-only
# Deploy frontend
```

### API keys (`backend/.env`)

| Key | Required | Purpose |
|-----|----------|---------|
| `GOOGLE_MAPS_API_KEY` | Yes for discover | Places Text Search + Place Details |
| `HUNTER_API_KEY` | Optional | Verified B2B emails by domain ([hunter.io](https://hunter.io)) |

Enable **Places API** and **Place Details** in [Google Cloud Console](https://console.cloud.google.com/apis/library).

### What gets found vs what you add

| Field | Source |
|-------|--------|
| businessName, address, phone, website | Google Places |
| email | Website `mailto:` / contact page, or Hunter.io |
| contactName | **You** — LinkedIn, website team page, or call the front desk |
| slug | Auto from business name → `yourfriendally.com/{slug}` |

Rows with `needsReview=yes` and no email are skipped on sync until you fill them in.

### Compliance

- Only email addresses **published on the business’s own site** or from Hunter’s verified B2B database.
- Still follow CAN-SPAM; prefer `info@` / `contact@` only when no named contact exists.
- Do not blast — review each row before sending.

---

## Where to get Boston leads (manual / supplemental)

I can’t scrape or hand you a bulk email list — you need opt-in or publicly published business contact info, and you must follow CAN-SPAM (physical address, unsubscribe, honest subject lines).

**Legitimate sources for Boston SMBs:**

| Source | Best for |
|--------|-----------|
| [Boston Chamber of Commerce](https://www.bostonchamber.com/) member directory | Local businesses, often with contact names |
| [Greater Boston Chamber](https://www.greaterbostonchamber.com/) | SMB owners, events |
| Google Maps + business website “Contact” / team page | Verify email on their site before sending |
| LinkedIn Sales Navigator (Boston + title filters) | Owner, Office Manager, Ops — export to CSV via tools you pay for |
| [Apollo.io](https://www.apollo.io/) / [Hunter.io](https://hunter.io/) | B2B emails with verification flags |
| Industry lists: Mass Bar, BBB Greater Boston, NAIOP, local dental/realtor associations | Vertical-specific |
| Warm intros: accountants, IT consultants, co-working spaces (WeWork Boston, CIC) | Highest reply rate |

**Boston neighborhoods to target first:** Financial District, Back Bay, Seaport, Cambridge (Kendall), Somerville — professional services, dental, boutique law, real estate, accounting.

**Titles that convert:** Owner, Managing Partner, Office Manager, Executive Assistant, Director of Operations.

---

## Email structure (what the generator writes)

1. **Subject:** `{First name}, a faster way to run {Business} (Boston, MA)`
2. **Personal link:** `yourfriendally.com/{slug}` — landing page uses their name + business + vertical use cases
3. **Two tailored bullets** by industry
4. **Solo vs team:** Task Runner $9.99 → Ally $19.99+ for rollout
5. **CTA:** Book 15 min OR use the personalized link

---

## Sending checklist

- [ ] Email is on their website or you have a lawful B2B basis to contact
- [ ] Replace `example.com` emails in the template with real addresses
- [ ] Set Calendly / booking URL
- [ ] Deploy site with new slugs in `outreach-leads.json`
- [ ] Send from a real inbox (not a new domain on day one)
- [ ] Include physical mailing address + unsubscribe in footer (CAN-SPAM)
- [ ] Cap volume: ~20–40 highly personalized emails/day beats 500 blasts

---

## Example slugs (demo — replace with real leads)

| Slug | URL |
|------|-----|
| `harborline-law` | https://yourfriendally.com/harborline-law |
| `back-bay-dental` | https://yourfriendally.com/back-bay-dental |
| `charles-realty` | https://yourfriendally.com/charles-realty |

Delete or overwrite the placeholder `@example.com` rows before sending.
