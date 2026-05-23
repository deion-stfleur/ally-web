import { Link, useLocation, useNavigate } from "react-router-dom";
import AccountSettingsPanel from "../components/AccountSettingsPanel";
import InPageMobileFooter from "../components/InPageMobileFooter";
import { useAuth } from "../hooks/useAuth";
import { useAppRouteLayout } from "../hooks/useAppRouteLayout";

export default function AccountSettings() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, deleteAccount } = useAuth();

  const goBack = () => {
    const from = location.state?.from;
    if (typeof from === "string" && from.startsWith("/")) {
      navigate(from, { replace: true });
      return;
    }
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/chat", { replace: true });
  };

  useAppRouteLayout("scroll");

  return (
    <div className="account-settings-route bg-sky-50/40 text-slate-900">
      <header className="account-settings-route__header">
        <button
          type="button"
          className="account-settings-route__back"
          onClick={goBack}
          aria-label="Go back"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back
        </button>
        <h1 className="account-settings-route__title">Settings</h1>
        <Link to="/chat" className="account-settings-route__logo" aria-label="Ally home">
          <span aria-hidden>✳</span> ally
        </Link>
      </header>

      <AccountSettingsPanel
        variant="page"
        user={user}
        onDeleteAccount={deleteAccount}
        onDeleted={() => navigate("/login", { replace: true })}
        onViewPlans={() => navigate("/chat", { state: { openPricing: true } })}
        onClose={goBack}
      />
      <InPageMobileFooter />
    </div>
  );
}
