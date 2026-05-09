import express from "express";
import { z } from "zod";
import { chromium } from "playwright";

// Minimal gateway skeleton.
// For now, it provides stub endpoints so the backend can be wired.
// This implements OpenTable connect + a small subset of tools using Playwright cookies.

const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));

// Shared OpenTable account mode.
// Set these on Railway:
// - OPENTABLE_EMAIL
// - OPENTABLE_PASSWORD
const OPENTABLE_EMAIL = (process.env.OPENTABLE_EMAIL || "").trim();
const OPENTABLE_PASSWORD = (process.env.OPENTABLE_PASSWORD || "").trim();

let sharedCookies = null; // array of cookies from Playwright
let pendingMfa = null; // { browser, context, page } when MFA is required

async function withOpenTablePage(userId, fn) {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  const context = await browser.newContext();
  if (Array.isArray(sharedCookies) && sharedCookies.length) {
    try {
      await context.addCookies(sharedCookies);
    } catch {
      // ignore
    }
  }
  const page = await context.newPage();
  try {
    return await fn({ browser, context, page });
  } finally {
    await browser.close();
  }
}

async function sharedLoginOrThrow() {
  if (!OPENTABLE_EMAIL || !OPENTABLE_PASSWORD) {
    throw new Error("OPENTABLE_EMAIL/OPENTABLE_PASSWORD not set on gateway");
  }
  // If we already have cookies, assume logged in; tools will fail and we fallback to links.
  if (Array.isArray(sharedCookies) && sharedCookies.length) return { mfa_required: false };

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("https://www.opentable.com/login", {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });

  await page
    .locator('input[type="email"], input[name*="email"], input[autocomplete="email"]')
    .first()
    .fill(OPENTABLE_EMAIL);
  await page
    .locator(
      'input[type="password"], input[name*="password"], input[autocomplete="current-password"]'
    )
    .first()
    .fill(OPENTABLE_PASSWORD);

  await page
    .locator('button[type="submit"], button:has-text("Log in"), button:has-text("Sign in")')
    .first()
    .click();

  await page.waitForTimeout(4000);
  const mfaInput = page.locator(
    'input[name*="code"], input[autocomplete="one-time-code"], input[type="tel"]'
  );
  if (await mfaInput.first().isVisible().catch(() => false)) {
    pendingMfa = { browser, context, page };
    return { mfa_required: true };
  }

  sharedCookies = await context.cookies();
  await browser.close();
  return { mfa_required: false };
}

function normalizeRestaurantBase(inputUrlOrSlug) {
  const s = String(inputUrlOrSlug || "").trim();
  if (!s) return null;
  if (s.startsWith("http://") || s.startsWith("https://")) {
    try {
      const u = new URL(s);
      u.hash = "";
      let out = u.toString();
      if (out.endsWith("/")) out = out.slice(0, -1);
      return out;
    } catch {
      return null;
    }
  }
  if (s.startsWith("/")) return `https://www.opentable.com${s.split("?")[0]}`;
  return `https://www.opentable.com/restaurant/${s}`;
}

function bookingLink({ restaurantId, date, time, partySize }) {
  const base = normalizeRestaurantBase(restaurantId);
  if (!base) return "";
  const u = new URL(base.split("?")[0]);
  const covers = Number(partySize) > 0 ? Number(partySize) : 2;
  u.searchParams.set("covers", String(covers));
  if (date && time) u.searchParams.set("dateTime", `${date}T${time}:00`);
  else if (date) u.searchParams.set("dateTime", `${date}T19:00:00`);
  return u.toString();
}

function sortTimesAmPm(times) {
  const parse = (t) => {
    const m = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!m) return 99999;
    let h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const ap = m[3].toUpperCase();
    if (ap === "PM" && h !== 12) h += 12;
    if (ap === "AM" && h === 12) h = 0;
    return h * 60 + min;
  };
  return [...new Set(times.map((t) => String(t).replace(/\s+/g, " ").trim()))].sort(
    (a, b) => parse(a) - parse(b)
  );
}

async function scrapeOpenTableAvailability({ page, profileUrl, restaurantId, date, partySize }) {
  const baseRaw = (profileUrl || restaurantId || "").trim();
  const base = normalizeRestaurantBase(baseRaw);
  if (!base) {
    return { success: false, error: "profileUrl_or_restaurantId_required" };
  }
  const d = String(date || "").trim();
  if (!d) {
    return { success: false, error: "date_required" };
  }
  const covers = Number(partySize) > 0 ? Number(partySize) : 2;
  const u = new URL(base.split("?")[0]);
  u.searchParams.set("covers", String(covers));
  u.searchParams.set("dateTime", `${d}T19:00:00`);
  const url = u.toString();

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(1500);
  await page
    .locator('main button, main [role="button"], [data-testid*="time"], [data-test*="Time"]')
    .first()
    .waitFor({ state: "attached", timeout: 18000 })
    .catch(() => {});
  await page.waitForTimeout(4500);

  const data = await page.evaluate(() => {
    const TIME_CHUNK = /\d{1,2}:\d{2}\s*(?:AM|PM)/gi;
    const norm = (s) => s.replace(/\s+/g, " ").trim();
    const root = document.querySelector("main") || document.body;
    const found = [];
    const seen = new Set();
    root.querySelectorAll("button, [role='button'], a").forEach((el) => {
      if (el.closest("header, nav, [role='navigation'], footer")) return;
      if (el.disabled || el.getAttribute("aria-disabled") === "true") return;
      const text = el.textContent || "";
      if (text.length > 80) return;
      const matches = text.match(TIME_CHUNK);
      if (!matches) return;
      for (const raw of matches) {
        const slot = norm(raw);
        if (!seen.has(slot)) {
          seen.add(slot);
          found.push(slot);
        }
      }
    });
    const bodyText = (document.body?.innerText || "").slice(0, 14000).toLowerCase();
    let availabilityHint = null;
    if (
      bodyText.includes("no online availability") ||
      bodyText.includes("no times available") ||
      bodyText.includes("there are no times")
    ) {
      availabilityHint = "no_online_availability";
    } else if (bodyText.includes("fully booked")) {
      availabilityHint = "fully_booked_message";
    } else if (bodyText.includes("waitlist") || bodyText.includes("notify me")) {
      availabilityHint = "waitlist_offered";
    }
    return { times: found, availabilityHint, title: document.title || "" };
  });

  const available_times = sortTimesAmPm(data.times);
  let scrape_status = "ok";
  if (available_times.length === 0) {
    scrape_status = data.availabilityHint || "no_times_found";
  }

  return {
    success: true,
    date: d,
    party_size: covers,
    available_times,
    scrape_status,
    availability_hint: data.availabilityHint,
    page_title: data.title,
    booking_url: url,
    note:
      scrape_status === "ok"
        ? "Times are read from OpenTable’s live widget; confirm on the site before heading out."
        : "Could not read time buttons (layout or blocking). Open booking_url for the live picker.",
  };
}

const toolsCallSchema = z.object({
  user_id: z.string().min(1),
  server: z.string().min(1),
  tool: z.string().min(1),
  input: z.record(z.any()).default({}),
});

app.post("/tools/call", async (req, res) => {
  const parsed = toolsCallSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_request", detail: parsed.error.format() });
  }
  const { user_id, server, tool, input } = parsed.data;

  if (server !== "opentable") {
    return res.status(400).json({ error: "unknown_server", server });
  }

  try {
    if (tool === "opentable_status") {
      return res.json({
        success: true,
        mode: "search_and_availability",
        shared_login_configured: Boolean(OPENTABLE_EMAIL && OPENTABLE_PASSWORD),
        isLoggedIn: Array.isArray(sharedCookies) && sharedCookies.length > 10,
      });
    }

    if (tool === "opentable_booking_link") {
      const restaurantId = input.restaurantId ? String(input.restaurantId).trim() : "";
      if (!restaurantId) {
        return res.status(400).json({ success: false, error: "restaurantId_required" });
      }
      const date = input.date ? String(input.date) : "";
      const time = input.time ? String(input.time) : "";
      const partySize = input.partySize != null ? Number(input.partySize) : 2;
      const booking_url = bookingLink({ restaurantId, date, time, partySize });
      return res.json({
        success: true,
        booking_url,
        note: "Open this link to see live times and complete the reservation in the user's browser.",
      });
    }

    if (tool === "opentable_make_reservation") {
      const restaurantId = input.restaurantId ? String(input.restaurantId) : "";
      const date = input.date ? String(input.date) : "";
      const time = input.time ? String(input.time) : "";
      const partySize = input.partySize != null ? Number(input.partySize) : 2;
      return res.json({
        success: false,
        error: "ally_does_not_book",
        message: "Ally only finds options and shares links. The user must confirm the booking on OpenTable.",
        booking_url: restaurantId
          ? bookingLink({ restaurantId, date, time, partySize })
          : undefined,
      });
    }

    if (tool === "opentable_availability" || tool === "opentable_check_availability") {
      const profileUrl = input.profileUrl ? String(input.profileUrl).trim() : "";
      const restaurantId = input.restaurantId ? String(input.restaurantId).trim() : "";
      const date = input.date ? String(input.date).trim() : "";
      const partySize = input.partySize != null ? Number(input.partySize) : 2;
      if (!profileUrl && !restaurantId) {
        return res.status(400).json({ success: false, error: "profileUrl_or_restaurantId_required" });
      }
      if (!date) {
        return res.status(400).json({
          success: false,
          error: "date_required",
          message: "Pass date as YYYY-MM-DD (and profileUrl from opentable_search when possible).",
        });
      }
      const out = await withOpenTablePage(user_id, async ({ page }) =>
        scrapeOpenTableAvailability({ page, profileUrl, restaurantId, date, partySize })
      );
      if (!out.success) {
        return res.status(400).json(out);
      }
      return res.json(out);
    }

    if (tool === "opentable_search") {
      const location = String(input.location || "").trim();
      if (!location) return res.status(400).json({ success: false, error: "location_required" });
      const cuisine = input.cuisine ? String(input.cuisine) : undefined;
      const partySize = input.partySize ? Number(input.partySize) : 2;
      const date = input.date ? String(input.date) : undefined;
      const time = input.time ? String(input.time) : undefined;

      const result = await withOpenTablePage(user_id, async ({ page }) => {
        const params = new URLSearchParams();
        params.set("term", location);
        params.set("covers", String(partySize || 2));
        if (cuisine) params.set("cuisine", cuisine);
        if (date) params.set("dateTime", `${date}T${time || "19:00"}:00`);
        const url = `https://www.opentable.com/s?${params.toString()}`;
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForTimeout(2500);
        const cards = page.locator(
          '[data-test="search-result"], [data-testid="restaurant-card"], article[data-restaurant-id]'
        );
        const count = await cards.count();
        const restaurants = [];
        for (let i = 0; i < Math.min(count, 10); i++) {
          const card = cards.nth(i);
          const name = (await card.locator("h2,h3").first().textContent().catch(() => "")) || "";
          const link =
            (await card.locator("a[href*='/restaurant/']").first().getAttribute("href").catch(() => "")) ||
            "";
          if (!name.trim()) continue;
          restaurants.push({
            name: name.trim(),
            profileUrl: link ? `https://www.opentable.com${link}` : undefined,
          });
        }
        return { success: true, restaurants };
      });
      return res.json(result);
    }

    return res.status(400).json({ success: false, error: "unknown_tool", tool });
  } catch (e) {
    if (tool === "opentable_availability" || tool === "opentable_check_availability") {
      const profileUrl = input.profileUrl ? String(input.profileUrl).trim() : "";
      const restaurantId = input.restaurantId ? String(input.restaurantId).trim() : "";
      const date = input.date ? String(input.date).trim() : "";
      const partySize = input.partySize != null ? Number(input.partySize) : 2;
      const id = profileUrl || restaurantId;
      return res.json({
        success: false,
        error: String(e?.message || e),
        scrape_status: "error",
        booking_url:
          id && date ? bookingLink({ restaurantId: id, date, time: "", partySize }) : undefined,
      });
    }
    if (tool === "opentable_search") {
      const location = String(input.location || "").trim();
      const cuisine = input.cuisine ? String(input.cuisine) : "";
      const partySize = input.partySize ? Number(input.partySize) : 2;
      const date = input.date ? String(input.date) : "";
      const time = input.time ? String(input.time) : "";
      const params = new URLSearchParams();
      if (location) params.set("term", location);
      params.set("covers", String(partySize || 2));
      if (cuisine) params.set("cuisine", cuisine);
      if (date) params.set("dateTime", `${date}T${time || "19:00"}:00`);
      return res.json({
        success: false,
        error: String(e?.message || e),
        fallback_search_url: `https://www.opentable.com/s?${params.toString()}`,
      });
    }
    return res.status(500).json({ success: false, error: String(e?.message || e) });
  }
});

const port = Number(process.env.PORT || 3001);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`mcp-gateway listening on ${port}`);
});
