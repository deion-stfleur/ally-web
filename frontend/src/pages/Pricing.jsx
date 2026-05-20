import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../hooks/useAuth";
import MarketingFooter from "../components/MarketingFooter";
import MarketingNav from "../components/MarketingNav";
import "./ally-lp.css";

function formatApiError(err) {
  const d = err.response?.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => x.msg ?? JSON.stringify(x)).join("; ");
  if (d && typeof d === "object") return JSON.stringify(d);
  return err.message || "Request failed";
}

const PLANS = [
  {
    id: "starter",
    tier: "Starter",
    name: "Ally",
    price: 10,
    tagline: "Text Ally when you need a hand.",
    features: [
      "Web chat with thread memory so follow-ups stay in context",
      "Google: Gmail, Calendar, and Drive (summaries, drafts, file lookups)",
      "Runs tasks for you over time and searches the web when it helps",
      "Keeps working the thread until the errand is done, then texts you back",
      "SMS on your phone: you text first, Ally replies",
      "Learns basics from chat: how you like updates, recurring asks, your tone",
    ],
  },
  {
    id: "pro",
    tier: "Pro",
    name: "Ally Pro",
    price: 30,
    tagline: "Ally stays on it and texts you first.",
    featured: true,
    features: [
      "Everything in Starter, plus a profile Ally builds over time",
      "Memory for interests, schedule, and what you want tracked (not just one thread)",
      "Proactive texts when something moves, no need to ping Ally first",
      "Multi-step errands in one thread until they are done",
      "Scheduled briefs: morning recap, check-ins, nudges you set",
    ],
  },
];

function subscribeLabel(plan, busy) {
  if (busy) return "Redirecting…";
  return `Subscribe to ${plan.tier}`;
}

export default function Pricing() {
  const navigate = useNavigate();
  const { sessionToken, user } = useAuth();
  const isSignedIn = Boolean(sessionToken);
  const [busyPlan, setBusyPlan] = useState(null);
  const [error, setError] = useState(null);

  const startCheckout = useCallback(async (plan) => {
    if (!sessionToken) {
      navigate("/login", { state: { from: "/pricing" } });
      return;
    }
    setBusyPlan(plan);
    setError(null);
    try {
      const { data } = await api.post("/api/billing/checkout-session", { plan });
      if (data?.url) {
        window.location.assign(data.url);
        return;
      }
      setError("Checkout did not return a URL.");
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setBusyPlan(null);
    }
  }, [navigate, sessionToken]);

  const openPortal = useCallback(async () => {
    if (!sessionToken) {
      navigate("/login", { state: { from: "/pricing" } });
      return;
    }
    setBusyPlan("portal");
    setError(null);
    try {
      const { data } = await api.post("/api/billing/portal-session");
      if (data?.url) {
        window.location.assign(data.url);
        return;
      }
      setError("Billing portal did not return a URL.");
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setBusyPlan(null);
    }
  }, [navigate, sessionToken]);

  const activePlan = user?.subscription_plan;
  const hasSub = user?.sms_plan_active;

  return (
    <div className="alm">
      <MarketingNav />
      <main className="alm-main alm-pricing">
        <div className="alm-pricing__head">
          <h1 className="alm-pricing__title">Pick your plan</h1>
          <p className="alm-pricing__sub">
            Both plans include web and SMS. Pro adds proactive texts and deeper follow-through.
          </p>
        </div>

        <div className="alm-pricing__grid">
          {PLANS.map((plan) => {
            const isCurrent = hasSub && activePlan === plan.id;
            const isOther =
              hasSub && activePlan && activePlan !== plan.id;
            return (
              <article
                key={plan.id}
                className={`alm-pricing__card${plan.featured ? " alm-pricing__card--featured" : ""}`}
              >
                {plan.featured ? <p className="alm-pricing__badge">Most popular</p> : null}
                <h2 className="alm-pricing__plan-name">{plan.name}</h2>
                <p className="alm-pricing__plan-tag">{plan.tagline}</p>
                <p className="alm-pricing__price">
                  ${plan.price}
                  <span className="alm-pricing__price-unit">/month</span>
                </p>
                <ul className="alm-pricing__features">
                  {plan.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                {isSignedIn && isCurrent ? (
                  <p className="alm-pricing__current">Your current plan</p>
                ) : (
                  <button
                    type="button"
                    className="alm-pricing__cta"
                    disabled={Boolean(busyPlan) || (isSignedIn && isOther)}
                    onClick={() => startCheckout(plan.id)}
                  >
                    {subscribeLabel(plan, busyPlan === plan.id)}
                  </button>
                )}
              </article>
            );
          })}
        </div>

        {hasSub ? (
          <div className="alm-pricing__manage">
            <button
              type="button"
              className="alm-pricing__portal"
              disabled={Boolean(busyPlan)}
              onClick={openPortal}
            >
              {busyPlan === "portal" ? "Opening…" : "Manage billing or change plan"}
            </button>
          </div>
        ) : null}

        {error ? (
          <p className="alm-pricing__error" role="alert">
            {error}
          </p>
        ) : null}

      </main>
      <MarketingFooter />
    </div>
  );
}
