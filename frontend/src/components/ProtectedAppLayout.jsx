import { Outlet, useLocation } from "react-router-dom";
import { useAppRouteLayout } from "../hooks/useAppRouteLayout";

/**
 * Keeps route layout classes stable while moving between signed-in pages (avoids flicker).
 */
export default function ProtectedAppLayout() {
  const { pathname } = useLocation();
  const layoutMode = pathname === "/chat" ? "chat" : "scroll";
  useAppRouteLayout(layoutMode);
  return <Outlet />;
}
