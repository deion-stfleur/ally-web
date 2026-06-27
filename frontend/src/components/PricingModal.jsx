import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../api/client";
import { PLANS } from "../constants/plans";
import PlanPriceDisplay from "./PlanPriceDisplay";
import { useAuth } from "../hooks/useAuth";

function formatApiError(err) {
  const d = err.response?.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => x.msg ?? JSON.stringify(x)).join("; ");
  if (d && typeof d === "object") return JSON.stringify(d);
  return err.message || "Request failed";
}

function subscribeLabel(plan, busy) {
  if (busy) return "Redirecting…";
  return `Subscribe to ${plan.tier}`;
}

/**
 * In-app pricing (keeps user on /chat — no full-page navigation).
 */
export default function PricingModal({ open, onClose }) {
  const { sessionToken, user } = useAuth();
  const [busyPlan, setBusyPlan] = useState(null);
  const [error, setError] = useState(null);

  const startCheckout = useCallback(
    async (plan) => {
      if (!sessionToken) {
        setError("Sign in to subscribe.");
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
    },
    [sessionToken]
  );

  const openPortal = useCallback(async () => {
    if (!sessionToken) return;
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
  }, [sessionToken]);

  const activePlan = user?.subscription_plan;
  const hasSub = user?.sms_plan_active;

  if (!open) return null;

  const node = (
    <div
      className="pricing-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pricing-modal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="pricing-modal__panel" onMouseDown={(e) => e.stopPropagation()}>
        <div className="pricing-modal__header">
          <button
            type="button"
            onClick={onClose}
            className="pricing-modal__close"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="pricing-modal__head-copy">
            <h2 id="pricing-modal-title" className="pricing-modal__title">
              Pick your plan
            </h2>
            <p className="pricing-modal__intro">
              Task Runner is 3 jobs/day — no Gmail, no chat memory. Ally and Ally Pro are full assistants with Google tools.
            </p>
          </div>
        </div>

        <div className="pricing-modal__body">
          <div className="pricing-modal__grid">
            {PLANS.map((plan) => {
              const isCurrent = hasSub && activePlan === plan.id;
              const isOther = hasSub && activePlan && activePlan !== plan.id;
              return (
                <article
                  key={plan.id}
                  className={`pricing-modal__card${plan.featured ? " pricing-modal__card--featured" : ""}`}
                >
                  <div className="pricing-modal__card-main">
                    {plan.featured ? (
                      <p className="pricing-modal__badge">Most popular</p>
                    ) : (
                      <p className="pricing-modal__badge pricing-modal__badge--spacer" aria-hidden>
                        &nbsp;
                      </p>
                    )}
                    <h3 className="pricing-modal__plan-name">{plan.name}</h3>
                    <p className="pricing-modal__plan-tag">{plan.tagline}</p>
                    {plan.description ? (
                      <p className="pricing-modal__plan-desc">{plan.description}</p>
                    ) : null}
                    <PlanPriceDisplay
                      plan={plan}
                      priceClassName="pricing-modal__price"
                      compareClassName="pricing-modal__price-compare"
                      currentClassName="pricing-modal__price-current"
                      unitClassName="pricing-modal__price-unit"
                    />
                    <ul className="pricing-modal__features">
                      {plan.features.slice(0, 4).map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="pricing-modal__card-foot">
                    {isCurrent ? (
                      <p className="pricing-modal__current">Your current plan</p>
                    ) : (
                      <button
                        type="button"
                        className={`pricing-modal__cta${plan.featured ? " pricing-modal__cta--featured" : ""}`}
                        disabled={Boolean(busyPlan) || isOther}
                        onClick={() => startCheckout(plan.id)}
                      >
                        {subscribeLabel(plan, busyPlan === plan.id)}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          {hasSub ? (
            <button
              type="button"
              className="pricing-modal__portal"
              disabled={Boolean(busyPlan)}
              onClick={openPortal}
            >
              {busyPlan === "portal" ? "Opening…" : "Manage billing or change plan"}
            </button>
          ) : null}

          {error ? (
            <p className="pricing-modal__error" role="alert">
              {error}
            </p>
          ) : null}

        </div>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
