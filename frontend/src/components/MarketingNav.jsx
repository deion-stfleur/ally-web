import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import BrandWordmark from "./BrandWordmark";
import MobileSlideMenu from "./MobileSlideMenu";
import WaitlistCta from "./WaitlistCta";
import { ASSISTANT_NAME } from "../constants/brand";
import { WAITLIST_MODE } from "../constants/waitlist";

const NAV_LINKS = [
  { to: "/features", label: "Features" },
  { to: "/use-cases", label: "Use cases" },
  ...(WAITLIST_MODE ? [] : [{ to: "/pricing", label: "Pricing" }]),
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

export default function MarketingNav({ overlay = false, dark = false }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  const navClass = [
    "alm-nav",
    overlay && "alm-nav--overlay",
    dark && "alm-nav--dark",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <header className={navClass}>
      <div className="alm-nav__inner">
        <Link to="/" className="alm-nav__logo" onClick={closeMenu}>
          <BrandWordmark />
        </Link>
        <nav className="alm-nav__links" aria-label="Marketing">
          {NAV_LINKS.map(({ to, label }) => (
            <Link key={to} to={to}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="alm-nav__actions">
          <WaitlistCta
            source="nav"
            className="alm-nav__cta alm-nav__cta--desktop"
          >
            {WAITLIST_MODE ? "Join waitlist" : "Get started"}
          </WaitlistCta>
          <button
            type="button"
            className="alm-nav__menu-btn"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? <IconClose /> : <IconMenu />}
          </button>
        </div>
      </div>

      <MobileSlideMenu
        open={menuOpen}
        onClose={closeMenu}
        ariaLabel="Site menu"
        footer={
          <div className="mobile-slide-menu__foot">
            <WaitlistCta
              source="nav-mobile"
              className="mobile-slide-menu__cta"
              onClick={closeMenu}
            >
              {WAITLIST_MODE ? "Join waitlist" : `Text ${ASSISTANT_NAME}`}
            </WaitlistCta>
          </div>
        }
      >
        <div className="mobile-slide-menu__head alm-nav__drawer-head">
          <Link to="/" className="alm-nav__drawer-logo" onClick={closeMenu}>
            <BrandWordmark />
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
        <nav className="mobile-slide-menu__links alm-nav__drawer-links" aria-label="Mobile">
          {NAV_LINKS.map(({ to, label }) => (
            <Link key={to} to={to} onClick={closeMenu}>
              {label}
            </Link>
          ))}
        </nav>
      </MobileSlideMenu>
    </header>
  );
}
