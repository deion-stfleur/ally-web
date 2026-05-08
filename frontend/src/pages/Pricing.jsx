import { useCallback, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../hooks/useAuth";

function formatApiError(err) {
  const d = err.response?.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => x.msg ?? JSON.stringify(x)).join("; ");
  if (d && typeof d === "object") return JSON.stringify(d);
  return err.message || "Request failed";
}

export default function Pricing() {
  const { sessionToken, user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const startCheckout = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.post("/api/billing/checkout-session");
      if (data?.url) {
        window.location.assign(data.url);
        return;
      }
      setError("Checkout did not return a URL.");
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setBusy(false);
    }
  }, []);

  if (!sessionToken) {
    return <Navigate to="/login" replace state={{ from: "/pricing" }} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-16 text-slate-900">
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">SMS add-on</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Ally on your phone</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Web chat stays free. SMS uses your number and our messaging cost, so it is a small monthly add-on.
        </p>
        <ul className="mt-6 space-y-2 text-sm text-slate-700">
          <li className="flex gap-2">
            <span className="text-violet-600" aria-hidden>
              ✓
            </span>
            Same Ally and Google connection as the web app
          </li>
          <li className="flex gap-2">
            <span className="text-violet-600" aria-hidden>
              ✓
            </span>
            One text thread for inbox and calendar errands
          </li>
          <li className="flex gap-2">
            <span className="text-violet-600" aria-hidden>
              ✓
            </span>
            Cancel anytime from the billing portal after you subscribe
          </li>
        </ul>
        <p className="mt-8 text-3xl font-bold tracking-tight">
          $12.99<span className="text-base font-semibold text-slate-500">/month</span>
        </p>
        {user?.sms_plan_active ? (
          <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            Your SMS plan is active. Text Ally from the number you set in Settings.
          </p>
        ) : (
          <button
            type="button"
            onClick={startCheckout}
            disabled={busy}
            className="mt-6 w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white shadow transition hover:bg-slate-800 disabled:opacity-50"
          >
            {busy ? "Redirecting…" : "Continue to secure checkout"}
          </button>
        )}
        {error ? (
          <p className="mt-4 text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        <p className="mt-8 text-center text-sm text-slate-500">
          <Link to="/chat" className="font-medium text-violet-700 hover:underline">
            Back to chat
          </Link>
        </p>
      </div>
    </div>
  );
}
