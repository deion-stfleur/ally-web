import { useLocation } from "react-router-dom";
import MarketingFooter from "./MarketingFooter";

const MARKETING_PATHS = new Set(["/", "/features", "/use-cases", "/pricing", "/login"]);

/**
 * Footer for marketing pages on mobile (end of document scroll).
 * App routes (/chat, /account, /automations) use InPageMobileFooter instead.
 */
export default function GlobalMobileFooter() {
  const { pathname } = useLocation();
  if (!MARKETING_PATHS.has(pathname)) return null;

  return (
    <div className="app-mobile-footer">
      <MarketingFooter />
    </div>
  );
}
