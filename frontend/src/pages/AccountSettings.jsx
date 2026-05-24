import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AccountSettingsPanel from "../components/AccountSettingsPanel";
import AppShellHeader from "../components/AppShellHeader";
import InPageMobileFooter from "../components/InPageMobileFooter";
import { useAuth } from "../hooks/useAuth";

export default function AccountSettings() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, deleteAccount } = useAuth();

  const handleLogout = useCallback(async () => {
    await logout();
    navigate("/login", { replace: true });
  }, [logout, navigate]);

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
    navigate("/home", { replace: true });
  };

  return (
    <div className="account-settings-route bg-sky-50/40 text-slate-900">
      <AppShellHeader title="Settings" showBack onBack={goBack} user={user} showAccountAvatar={false} />

      <AccountSettingsPanel
        variant="page"
        user={user}
        onLogout={handleLogout}
        onDeleteAccount={deleteAccount}
        onDeleted={() => navigate("/login", { replace: true })}
        onViewPlans={() => navigate("/home", { state: { openPricing: true } })}
        onClose={goBack}
      />
      <InPageMobileFooter />
    </div>
  );
}
