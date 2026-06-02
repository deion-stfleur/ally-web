import { Link } from "react-router-dom";
import BrandWordmark from "./BrandWordmark";
import { APP_NAME } from "../constants/brand";

export default function MarketingFooter() {
  return (
    <footer className="alm-site-footer">
      <div className="alm-site-footer__inner">
        <div className="alm-site-footer__brand">
          <BrandWordmark markClassName="alm-site-footer__logo" nameClassName="alm-site-footer__name" />
          <div>
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
          <div className="alm-site-footer__col">
            <h2 className="alm-site-footer__heading">Legal</h2>
            <ul className="alm-site-footer__list">
              <li>
                <Link to="/privacy">Privacy Policy</Link>
              </li>
              <li>
                <Link to="/terms">Terms of Service</Link>
              </li>
            </ul>
          </div>
        </div>
      </div>
      <div className="alm-site-footer__bottom" id="contact">
        <p className="alm-site-footer__copy">
          © {new Date().getFullYear()} {APP_NAME}. All rights reserved.
        </p>
        <p className="alm-site-footer__legal-links">
          <Link to="/privacy">Privacy</Link>
          <span aria-hidden="true"> · </span>
          <Link to="/terms">Terms</Link>
        </p>
      </div>
    </footer>
  );
}
