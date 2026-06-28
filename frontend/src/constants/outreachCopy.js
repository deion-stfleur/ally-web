import { ASSISTANT_NAME, APP_DOMAIN } from "./brand";
import playbook from "../data/outreach-playbook.json";

/** Replace with your Calendly or booking link. */
export const OUTREACH_BOOKING_URL =
  process.env.REACT_APP_OUTREACH_BOOKING_URL || "https://calendly.com/yourfriendally/15min";

export const GOOGLE_TOOL_LABELS = [
  { id: "gmail", label: "Gmail" },
  { id: "calendar", label: "Calendar" },
  { id: "drive", label: "Drive" },
  { id: "sheets", label: "Sheets" },
  { id: "docs", label: "Docs" },
];

export function playbookForVertical(vertical) {
  const key = vertical && playbook[vertical] ? vertical : "default";
  return playbook[key];
}

/** Flat list for backwards compatibility / simple lists */
export function casesForVertical(vertical) {
  const pb = playbookForVertical(vertical);
  return pb.groups.flatMap((g) => g.items.map((i) => i.title));
}

/** Top N concrete examples for cold email bullets */
export function emailHighlightsForVertical(vertical, limit = 3) {
  const pb = playbookForVertical(vertical);
  const picks = [];
  for (const group of pb.groups) {
    for (const item of group.items) {
      picks.push(`${item.title} — e.g. ${item.example.replace(/^"|"$/g, "")}`);
      if (picks.length >= limit) return picks;
    }
  }
  return picks;
}

export function outreachPageUrl(slug) {
  return `https://${APP_DOMAIN}/${slug}`;
}

export function firstName(contactName) {
  const raw = (contactName || "").trim();
  if (!raw) return "there";
  if (raw.startsWith("Dr.")) return raw;
  return raw.split(/\s+/)[0];
}

export function buildOutreachEmail(lead, slug) {
  const name = firstName(lead.contactName);
  const biz = lead.businessName || "your team";
  const link = outreachPageUrl(slug);
  const highlights = emailHighlightsForVertical(lead.vertical, 3);

  return {
    subject: `${name}, Google Workspace on autopilot for ${biz}`,
    body: `Hi ${name},

I'm Deion — I built Ally for teams like ${biz} who already live in Gmail and Calendar but still lose hours to admin.

I put together a page with real examples for ${biz} — Gmail, Calendar, Drive, Sheets, and background tasks you can queue from your phone:
${link}

Three things ${ASSISTANT_NAME} could handle this week:
• ${highlights[0]}
• ${highlights[1]}
• ${highlights[2]}

Start solo ($9.99/mo Task Runner) or roll out to the team ($19.99+ with full Google tools). Most shops pick one workflow — inbox, scheduling, or sheet logging — then expand.

15-minute walkthrough: ${OUTREACH_BOOKING_URL}

— Deion
yourfriendally.com`,
  };
}
