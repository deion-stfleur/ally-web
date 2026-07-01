import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { capturePageView } from "../analytics/posthog";

/** SPA pageviews — PostHog autocapture does not track React Router navigations. */
export default function PostHogPageView() {
  const location = useLocation();

  useEffect(() => {
    capturePageView(`${location.pathname}${location.search}`);
  }, [location.pathname, location.search]);

  return null;
}
