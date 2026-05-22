import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

const NAV_LINKS = [
  { to: "/features", label: "Features" },
  { to: "/use-cases", label: "Use cases" },
  { to: "/pricing", label: "Pricing" },
];

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

export default function MarketingNav({ overlay = false }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") closeMenu();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen, closeMenu]);

  return (
    <header className={`alm-nav${overlay ? " alm-nav--overlay" : ""}`}>
      <div className="alm-nav__inner">
        <Link to="/" className="alm-nav__logo" onClick={closeMenu}>
          <span aria-hidden>✳</span> ally
        </Link>
        <nav className="alm-nav__links" aria-label="Marketing">
          {NAV_LINKS.map(({ to, label }) => (
            <Link key={to} to={to}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="alm-nav__actions">
          <Link to="/login" className="alm-nav__cta alm-nav__cta--desktop">
            Get started
          </Link>
          <button
            type="button"
            className="alm-nav__menu-btn"
            aria-expanded={menuOpen}
            aria-controls="alm-nav-drawer"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? <IconClose /> : <IconMenu />}
          </button>
        </div>
      </div>

      <div
        id="alm-nav-drawer"
        className={`alm-nav__drawer${menuOpen ? " is-open" : ""}`}
        aria-hidden={!menuOpen}
      >
        <div className="alm-nav__drawer-head">
          <Link to="/" className="alm-nav__drawer-logo" onClick={closeMenu}>
            <span aria-hidden>✳</span> ally
          </Link>
          <button
            type="button"
            className="alm-nav__menu-btn alm-nav__menu-btn--in-drawer"
            aria-label="Close menu"
            onClick={closeMenu}
          >
            <IconClose />
          </button>
        </div>
        <nav className="alm-nav__drawer-links" aria-label="Mobile">
          {NAV_LINKS.map(({ to, label }) => (
            <Link key={to} to={to} onClick={closeMenu}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="alm-nav__drawer-foot">
          <Link to="/login" className="alm-nav__drawer-cta" onClick={closeMenu}>
            Text Ally
          </Link>
        </div>
      </div>
    </header>
  );
}
