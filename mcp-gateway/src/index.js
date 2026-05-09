import express from "express";
import { z } from "zod";
import fetch from "node-fetch";
import { chromium } from "playwright";

// Minimal gateway skeleton.
// For now, it provides stub endpoints so the backend can be wired.
// This implements OpenTable connect + a small subset of tools using Playwright cookies.

const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));

const BACKEND_URL = (process.env.ALLY_BACKEND_URL || "").trim();
const GATEWAY_SECRET = (process.env.MCP_GATEWAY_SECRET || "").trim();

async function fetchSessionBlob(userId) {
  if (!BACKEND_URL || !GATEWAY_SECRET) return "";
  const url = `${BACKEND_URL.replace(/\\/$/, "")}/api/opentable/session?user_id=${encodeURIComponent(
    userId
  )}`;
  const resp = await fetch(url, {
    headers: { "X-MCP-Gateway-Secret": GATEWAY_SECRET },
  });
  if (!resp.ok) return "";
  const data = await resp.json();
  return typeof data.session_blob === "string" ? data.session_blob : "";
}

function parseCookieBlob(blob) {
  if (!blob) return [];
  try {
    const parsed = JSON.parse(blob);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function withOpenTablePage(userId, fn) {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  const context = await browser.newContext();
  const blob = await fetchSessionBlob(userId);
  const cookies = parseCookieBlob(blob);
  if (cookies.length) {
    try {
      await context.addCookies(cookies);
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
      const blob = await fetchSessionBlob(user_id);
      return res.json({ success: true, isLoggedIn: Boolean(blob && blob.length > 10) });
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
    return res.status(500).json({ success: false, error: String(e?.message || e) });
  }
});

// OpenTable connect endpoints (backend calls these).
const connectSchema = z.object({
  user_id: z.string().min(1),
  email: z.string().min(3),
  password: z.string().min(1),
});

app.post("/opentable/connect", async (req, res) => {
  const parsed = connectSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_request", detail: parsed.error.format() });
  }
  const { user_id, email, password } = parsed.data;

  // Best-effort login automation. If MFA is required, we keep state in memory.
  try {
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

    // Try common selectors.
    await page.locator('input[type="email"], input[name*="email"], input[autocomplete="email"]').first().fill(email);
    await page
      .locator('input[type="password"], input[name*="password"], input[autocomplete="current-password"]')
      .first()
      .fill(password);

    await page
      .locator('button[type="submit"], button:has-text("Log in"), button:has-text("Sign in")')
      .first()
      .click();

    await page.waitForTimeout(4000);

    // Detect MFA prompt.
    const mfaInput = page.locator('input[name*="code"], input[autocomplete="one-time-code"], input[type="tel"]');
    if (await mfaInput.first().isVisible().catch(() => false)) {
      pendingMfa.set(user_id, { browser, context, page });
      return res.json({ mfa_required: true });
    }

    const cookies = await context.cookies();
    await browser.close();
    return res.json({ mfa_required: false, session_blob: JSON.stringify(cookies) });
  } catch (e) {
    return res.status(500).json({ error: "connect_failed", detail: String(e?.message || e) });
  }
});

const mfaSchema = z.object({
  user_id: z.string().min(1),
  code: z.string().min(4),
});

app.post("/opentable/connect/mfa", async (req, res) => {
  const parsed = mfaSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_request", detail: parsed.error.format() });
  }
  const { user_id, code } = parsed.data;
  const state = pendingMfa.get(user_id);
  if (!state) return res.status(400).json({ error: "no_pending_mfa" });
  pendingMfa.delete(user_id);

  try {
    const { browser, context, page } = state;
    const mfaInput = page
      .locator('input[name*="code"], input[autocomplete="one-time-code"], input[type="tel"]')
      .first();
    await mfaInput.fill(code);
    await page
      .locator('button[type="submit"], button:has-text("Verify"), button:has-text("Continue")')
      .first()
      .click();
    await page.waitForTimeout(4000);
    const cookies = await context.cookies();
    await browser.close();
    return res.json({ session_blob: JSON.stringify(cookies) });
  } catch (e) {
    try {
      await state.browser.close();
    } catch {
      // ignore
    }
    return res.status(500).json({ error: "mfa_failed", detail: String(e?.message || e) });
  }
});

const port = Number(process.env.PORT || 3001);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`mcp-gateway listening on ${port}`);
});

// In-memory MFA state: { user_id -> {browser,context,page} }
const pendingMfa = new Map();

