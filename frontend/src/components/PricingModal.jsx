import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../api/client";
import { useAuth } from "../hooks/useAuth";

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
      "Works with Gmail, Calendar, Drive, Sheets and more",
      "Handles tasks and searches web for you",
      "Keeps going until the job's done, then texts you",
      "Available on web and iMessage",
      "Learns your habits and preferences from chat",
    ],
    footnote: "$10/mo. cancel anytime.",
  },
  {
    id: "pro",
    tier: "Pro",
    name: "Ally Pro",
    price: 30,
    tagline: "Ally stays on it and texts you first.",
    featured: true,
    footnote: "cancel anytime. switch plans from your dashboard.",
    features: [
      "Everything in Starter",
      "Remembers your interests, schedule, and tasks across all chats",
      "Texts you automatically when there's an update",
      "Handles complex tasks until they're done, all in one thread",
      "Sends scheduled recaps, check-ins, and reminders",
      "Run 24/7 background tasks for you",
    ],
  },
];

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
      className="fixed inset-0 z-[115] flex items-end justify-center bg-black/50 px-0 py-0 sm:items-center sm:px-4 sm:py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pricing-modal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex max-h-[min(92vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-xl sm:max-w-2xl sm:rounded-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 id="pricing-modal-title" className="text-lg font-semibold text-slate-900">
            Pick your plan
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <p className="text-sm text-slate-600">
            Both plans include web and SMS. Pro adds proactive texts and deeper follow-through.
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {PLANS.map((plan) => {
              const isCurrent = hasSub && activePlan === plan.id;
              const isOther = hasSub && activePlan && activePlan !== plan.id;
              return (
                <article
                  key={plan.id}
                  className={`rounded-2xl border p-4 ${
                    plan.featured
                      ? "border-violet-200 bg-violet-50/40"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  {plan.featured ? (
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-violet-700">
                      Most popular
                    </p>
                  ) : null}
                  <h3 className="text-base font-semibold text-slate-900">{plan.name}</h3>
                  <p className="mt-1 text-xs text-slate-600">{plan.tagline}</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">
                    ${plan.price}
                    <span className="text-sm font-medium text-slate-500">/month</span>
                  </p>
                  <ul className="mt-3 space-y-1.5 text-xs leading-relaxed text-slate-600">
                    {plan.features.slice(0, 4).map((f) => (
                      <li key={f}>• {f}</li>
                    ))}
                  </ul>
                  {isCurrent ? (
                    <p className="mt-4 text-center text-xs font-medium text-emerald-700">
                      Your current plan
                    </p>
                  ) : (
                    <button
                      type="button"
                      className={`mt-4 w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white ${
                        plan.featured ? "bg-violet-600 hover:bg-violet-700" : "bg-slate-900 hover:bg-slate-800"
                      } disabled:opacity-50`}
                      disabled={Boolean(busyPlan) || (isOther)}
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
            <button
              type="button"
              className="mt-4 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              disabled={Boolean(busyPlan)}
              onClick={openPortal}
            >
              {busyPlan === "portal" ? "Opening…" : "Manage billing or change plan"}
            </button>
          ) : null}

          {error ? (
            <p className="mt-3 text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
