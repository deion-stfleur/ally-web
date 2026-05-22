import { useCallback, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../hooks/useAuth";
import AccountSettingsModal from "./AccountSettingsModal";
import MobileSlideMenu from "./MobileSlideMenu";
import PricingModal from "./PricingModal";

function IconMenu() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16M4 12h16M4 17h16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconClose() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Mobile chat top bar + menu (account, billing, new chat) — desktop uses right rail.
 */
export default function ChatMobileHeader({
  user,
  onNewChat,
  onOpenSearch,
  onLinkPhone,
}) {
  const navigate = useNavigate();
  const { deleteAccount, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [billingBusy, setBillingBusy] = useState(false);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  const openBilling = useCallback(async () => {
    closeMenu();
    setBillingBusy(true);
    try {
      const { data } = await api.post("/api/billing/portal-session");
      if (data?.url) window.location.href = data.url;
      else       setPricingOpen(true);
    } catch {
      setPricingOpen(true);
    } finally {
      setBillingBusy(false);
    }
  }, [closeMenu, navigate]);

  const menuItem = (label, onClick) => (
    <button
      type="button"
      className="mobile-slide-menu__link-btn"
      onClick={() => {
        onClick();
        closeMenu();
      }}
    >
      {label}
    </button>
  );

  return (
    <>
      <header className="chat-mobile-header lg:hidden">
        <Link to="/chat" className="chat-mobile-header__logo">
          <span aria-hidden>✳</span> ally
        </Link>
        <button
          type="button"
          className="chat-mobile-header__menu-btn"
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          onClick={() => setMenuOpen((o) => !o)}
        >
          {menuOpen ? <IconClose /> : <IconMenu />}
        </button>
      </header>

      <MobileSlideMenu
        open={menuOpen}
        onClose={closeMenu}
        ariaLabel="Chat menu"
        panelClassName="mobile-slide-menu__panel--chat"
        footer={
          <div className="mobile-slide-menu__foot">
            <button
              type="button"
              className="mobile-slide-menu__cta"
              onClick={() => {
                closeMenu();
                onLinkPhone?.();
              }}
            >
              Text Ally
            </button>
          </div>
        }
      >
        <div className="mobile-slide-menu__head">
          <span className="mobile-slide-menu__head-logo">
            <span aria-hidden>✳</span> ally
          </span>
          <button
            type="button"
            className="chat-mobile-header__menu-btn"
            aria-label="Close menu"
            onClick={closeMenu}
          >
            <IconClose />
          </button>
        </div>
        <nav className="mobile-slide-menu__links">
          {menuItem("Home", () => navigate("/automations"))}
          {menuItem("Account", () => setSettingsOpen(true))}
          {menuItem(billingBusy ? "Opening billing…" : "Billing & plan", openBilling)}
          {menuItem("Pricing", () => setPricingOpen(true))}
          {menuItem("New chat", onNewChat)}
          {menuItem("Search chats", onOpenSearch)}
          {menuItem("Sign out", async () => {
            await logout();
            navigate("/login", { replace: true });
          })}
        </nav>
      </MobileSlideMenu>

      <AccountSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        user={user}
        onDeleteAccount={deleteAccount}
        onDeleted={() => navigate("/login", { replace: true })}
      />

      <PricingModal open={pricingOpen} onClose={() => setPricingOpen(false)} />
    </>
  );
}
