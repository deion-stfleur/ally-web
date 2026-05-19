import { useCallback, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../hooks/useAuth";
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
    name: "Ally",
    price: 10,
    tagline: "Text Ally when you need a hand.",
    features: [
      "Web chat + Google (Gmail, Calendar, Drive)",
      "SMS with Ally on your phone",
      "Summaries, drafts, and quick errands",
      "You text first — Ally replies",
    ],
  },
  {
    id: "pro",
    name: "Ally Pro",
    price: 30,
    tagline: "Ally stays on it and texts you first.",
    featured: true,
    features: [
      "Everything in Ally",
      "Proactive texts when something moves",
      "Multi-step errands in one thread",
      "Morning recaps and scheduled briefs",
    ],
  },
];

export default function Pricing() {
  const { sessionToken, user } = useAuth();
  const [busyPlan, setBusyPlan] = useState(null);
  const [error, setError] = useState(null);

  const startCheckout = useCallback(async (plan) => {
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
  }, []);

  const openPortal = useCallback(async () => {
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
  }, []);

  if (!sessionToken) {
    return <Navigate to="/login" replace state={{ from: "/pricing" }} />;
  }

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
                {isCurrent ? (
                  <p className="alm-pricing__current">Your current plan</p>
                ) : (
                  <button
                    type="button"
                    className="alm-pricing__cta"
                    disabled={Boolean(busyPlan) || isOther}
                    onClick={() => startCheckout(plan.id)}
                  >
                    {busyPlan === plan.id ? "Redirecting…" : `Get ${plan.name}`}
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

        <p className="alm-pricing__back">
          <Link to="/chat">Back to chat</Link>
        </p>
      </main>
    </div>
  );
}
