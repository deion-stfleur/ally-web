import { Link } from "react-router-dom";

export default function MarketingNav() {
  return (
    <header className="alm-nav">
      <div className="alm-nav__inner">
        <Link to="/" className="alm-nav__logo">
          <span aria-hidden>✳</span> ally
        </Link>
        <nav className="alm-nav__links" aria-label="Marketing">
          <Link to="/features">Features</Link>
          <Link to="/use-cases">Use cases</Link>
          <a href="/#integrations">Integrations</a>
        </nav>
        <div className="alm-nav__actions">
          <Link to="/login" className="alm-nav__login">
            Login
          </Link>
          <Link to="/login" className="alm-nav__cta">
            Get started free
          </Link>
        </div>
      </div>
    </header>
  );
}
