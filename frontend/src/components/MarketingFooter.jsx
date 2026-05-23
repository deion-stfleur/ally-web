import { Link } from "react-router-dom";

export default function MarketingFooter() {
  return (
    <footer className="alm-site-footer">
      <div className="alm-site-footer__inner">
        <div className="alm-site-footer__brand">
          <span className="alm-site-footer__logo" aria-hidden>
            ✳
          </span>
          <div>
            <strong className="alm-site-footer__name">Ally</strong>
            <p className="alm-site-footer__tag">
              Your Google-native AI assistant.
            </p>
          </div>
        </div>
        <div className="alm-site-footer__cols">
          <div className="alm-site-footer__col">
            <h2 className="alm-site-footer__heading">Product</h2>
            <ul className="alm-site-footer__list">
              <li>
                <Link to="/features">Features</Link>
              </li>
              <li>
                <Link to="/use-cases">Use cases</Link>
              </li>
              <li>
                <Link to="/pricing">Pricing</Link>
              </li>
              <li>
                <Link to="/login">Get started</Link>
              </li>
            </ul>
          </div>
          <div className="alm-site-footer__col">
            <h2 className="alm-site-footer__heading">Account</h2>
            <ul className="alm-site-footer__list">
              <li>
                <Link to="/login">Log in</Link>
              </li>
              <li>
                <Link to="/home">Open app</Link>
              </li>
            </ul>
          </div>
        </div>
      </div>
      <div className="alm-site-footer__bottom" id="contact">
        <p className="alm-site-footer__copy">
          © {new Date().getFullYear()} Ally. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
