import posthog from "posthog-js";

let initialized = false;

export function isPostHogEnabled() {
  return Boolean(process.env.REACT_APP_POSTHOG_KEY?.trim());
}

export function initPostHog() {
  if (initialized || typeof window === "undefined") return;
  const key = process.env.REACT_APP_POSTHOG_KEY?.trim();
  if (!key) return;

  if (key.startsWith("phx_")) {
    console.error(
      "[PostHog] REACT_APP_POSTHOG_KEY looks like a personal API key (phx_). " +
        "Use the Project API key (phc_...) from PostHog → Project settings → Project API key."
    );
    return;
  }

  posthog.init(key, {
    api_host: process.env.REACT_APP_POSTHOG_HOST?.trim() || "https://us.i.posthog.com",
    capture_pageview: false,
    capture_pageleave: true,
    autocapture: true,
    persistence: "localStorage+cookie",
    person_profiles: "identified_only",
  });
  initialized = true;
}

export function capturePageView(path) {
  if (!initialized) return;
  const url = `${window.location.origin}${path}`;
  posthog.capture("$pageview", { $current_url: url, path });
}

export function captureEvent(event, properties = {}) {
  if (!initialized) return;
  posthog.capture(event, properties);
}

export function identifyUser(distinctId, properties = {}) {
  if (!initialized || !distinctId) return;
  posthog.identify(distinctId, properties);
}

export function resetPostHogUser() {
  if (!initialized) return;
  posthog.reset();
}
