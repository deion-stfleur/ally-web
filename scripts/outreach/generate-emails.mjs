#!/usr/bin/env node
/**
 * Generate personalized cold emails from outreach leads.
 *
 * Usage:
 *   node scripts/outreach/generate-emails.mjs
 *   node scripts/outreach/generate-emails.mjs --csv scripts/outreach/my-leads.csv
 *   node scripts/outreach/generate-emails.mjs --slug harborline-law
 *
 * Output: scripts/outreach/output/emails.txt (and per-slug files)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const LEADS_JSON = path.join(ROOT, "frontend/src/data/outreach-leads.json");
const PLAYBOOK_JSON = path.join(ROOT, "frontend/src/data/outreach-playbook.json");
const OUTPUT_DIR = path.join(__dirname, "output");
const BOOKING_URL = process.env.OUTREACH_BOOKING_URL || "https://calendly.com/yourfriendally/15min";
const DOMAIN = "yourfriendally.com";

const playbook = JSON.parse(fs.readFileSync(PLAYBOOK_JSON, "utf8"));

function emailHighlights(vertical, limit = 3) {
  const pb = playbook[vertical] || playbook.default;
  const picks = [];
  for (const group of pb.groups) {
    for (const item of group.items) {
      const ex = item.example.replace(/^"|"$/g, "");
      picks.push(`${item.title} — e.g. ${ex}`);
      if (picks.length >= limit) return picks;
    }
  }
  return picks;
}

function firstName(contactName) {
  const raw = (contactName || "").trim();
  if (!raw) return "there";
  if (raw.startsWith("Dr.")) return raw;
  return raw.split(/\s+/)[0];
}

function buildEmail(slug, lead) {
  const name = firstName(lead.contactName);
  const biz = lead.businessName || "your team";
  const link = `https://${DOMAIN}/${slug}`;
  const highlights = emailHighlights(lead.vertical, 3);

  return {
    to: lead.email || "",
    subject: `${name}, Google Workspace on autopilot for ${biz}`,
    body: `Hi ${name},

I'm Deion — I built Ally for teams like ${biz} who already live in Gmail and Calendar but still lose hours to admin.

I put together a page with real examples for ${biz} — Gmail, Calendar, Drive, Sheets, and background tasks you can queue from your phone:
${link}

Three things Ally could handle this week:
• ${highlights[0]}
• ${highlights[1]}
• ${highlights[2]}

Start solo ($9.99/mo Task Runner) or roll out to the team ($19.99+ with full Google tools). Most shops pick one workflow — inbox, scheduling, or sheet logging — then expand.

15-minute walkthrough: ${BOOKING_URL}

— Deion
yourfriendally.com`,
  };
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  if (!lines.length) return {};
  const headers = parseCsvLine(lines[0]);
  const leads = {};
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = parseCsvLine(line);
    const row = Object.fromEntries(headers.map((h, j) => [h, cols[j] || ""]));
    if (row.slug) leads[row.slug] = row;
  }
  return leads;
}

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

function syncJsonFromCsv(csvPath) {
  const incoming = parseCsv(fs.readFileSync(csvPath, "utf8"));
  const existing = fs.existsSync(LEADS_JSON)
    ? JSON.parse(fs.readFileSync(LEADS_JSON, "utf8"))
    : {};
  for (const [slug, row] of Object.entries(incoming)) {
    existing[slug] = {
      businessName: row.businessName || "",
      contactName: row.contactName || "there",
      contactTitle: row.contactTitle || "",
      vertical: row.vertical || "default",
      city: row.city || "",
      neighborhood: row.neighborhood || "",
      email: row.email || "",
      teamSize: row.teamSize || "",
    };
  }
  fs.writeFileSync(LEADS_JSON, `${JSON.stringify(existing, null, 2)}\n`);
  console.log(`Synced ${Object.keys(incoming).length} leads → ${LEADS_JSON}`);
  return existing;
}

function main() {
  const args = process.argv.slice(2);
  const csvIdx = args.indexOf("--csv");
  const slugIdx = args.indexOf("--slug");

  let leads;
  if (csvIdx !== -1 && args[csvIdx + 1]) {
    leads = syncJsonFromCsv(path.resolve(args[csvIdx + 1]));
  } else {
    leads = JSON.parse(fs.readFileSync(LEADS_JSON, "utf8"));
  }

  const filterSlug = slugIdx !== -1 ? args[slugIdx + 1] : null;
  const slugs = filterSlug ? [filterSlug] : Object.keys(leads);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const all = [];
  for (const slug of slugs) {
    const lead = leads[slug];
    if (!lead) {
      console.warn(`Unknown slug: ${slug}`);
      continue;
    }
    if (!(lead.email || "").trim()) {
      console.warn(`Skipping ${slug} — no email`);
      continue;
    }
    const email = buildEmail(slug, lead);
    const block = [
      `=== ${slug} ===`,
      `TO: ${email.to}`,
      `SUBJECT: ${email.subject}`,
      "",
      email.body,
      "",
      "---",
      "",
    ].join("\n");
    all.push(block);
    fs.writeFileSync(path.join(OUTPUT_DIR, `${slug}.txt`), block);
    console.log(`Wrote ${slug}.txt → https://${DOMAIN}/${slug}`);
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, "emails.txt"), all.join("\n"));
  console.log(`\nDone. ${slugs.length} email(s) in ${OUTPUT_DIR}/`);
}

main();
