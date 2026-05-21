import { Link } from "react-router-dom";

export default function MarketingNav({ overlay = false }) {
  return (
    <header className={`alm-nav${overlay ? " alm-nav--overlay" : ""}`}>
      <div className="alm-nav__inner">
        <Link to="/" className="alm-nav__logo">
          <span aria-hidden>✳</span> ally
        </Link>
        <nav className="alm-nav__links" aria-label="Marketing">
          <Link to="/features">Features</Link>
          <Link to="/use-cases">Use cases</Link>
          <Link to="/pricing">Pricing</Link>
        </nav>
        <div className="alm-nav__actions">
          <Link to="/login" className="alm-nav__cta">
            Get started free
          </Link>
        </div>
      </div>
    </header>
  );
}
