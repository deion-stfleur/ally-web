import { useCallback, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../hooks/useAuth";
import { APP_HOME_PATH } from "../utils/appPaths";
import AppShellHeader from "./AppShellHeader";
import MobileSlideMenu from "./MobileSlideMenu";

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
  menuOpen: menuOpenProp,
  onMenuOpenChange,
  onOpenPricing,
  showHeaderMenu = true,
  headerRight = null,
  headerClassName = "",
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const [menuOpenInternal, setMenuOpenInternal] = useState(false);
  const [billingBusy, setBillingBusy] = useState(false);

  const menuOpen = menuOpenProp ?? menuOpenInternal;
  const setMenuOpen = onMenuOpenChange ?? setMenuOpenInternal;

  const closeMenu = useCallback(() => setMenuOpen(false), [setMenuOpen]);

  const openBilling = useCallback(async () => {
    closeMenu();
    setBillingBusy(true);
    try {
      const { data } = await api.post("/api/billing/portal-session");
      if (data?.url) window.location.href = data.url;
      else onOpenPricing?.();
    } catch {
      onOpenPricing?.();
    } finally {
      setBillingBusy(false);
    }
  }, [closeMenu, onOpenPricing]);

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

  const menuButton = showHeaderMenu ? (
    <button
      type="button"
      className="app-shell-header__menu-btn"
      aria-expanded={menuOpen}
      aria-label={menuOpen ? "Close menu" : "Open menu"}
      onClick={() => setMenuOpen((o) => !o)}
    >
      {menuOpen ? <IconClose /> : <IconMenu />}
    </button>
  ) : null;

  const right = (
    <>
      {headerRight}
      {menuButton}
    </>
  );

  return (
    <>
      <AppShellHeader right={right} user={user} className={headerClassName} />

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
            className="app-shell-header__menu-btn"
            aria-label="Close menu"
            onClick={closeMenu}
          >
            <IconClose />
          </button>
        </div>
        <nav className="mobile-slide-menu__links">
          {menuItem("Home", () => navigate(APP_HOME_PATH))}
          {menuItem("Account", () =>
            navigate("/account", { state: { from: location.pathname } })
          )}
          {menuItem(billingBusy ? "Opening billing…" : "Billing & plan", openBilling)}
          {menuItem("Pricing", () => onOpenPricing?.())}
          {menuItem("New chat", onNewChat)}
          {menuItem("Search chats", onOpenSearch)}
          {menuItem("Sign out", async () => {
            await logout();
            navigate("/login", { replace: true });
          })}
        </nav>
      </MobileSlideMenu>

    </>
  );
}

export function ChatMobileMenuIcon({ className = "" }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={className}
    >
      <path
        d="M4 7h16M4 12h16M4 17h16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
