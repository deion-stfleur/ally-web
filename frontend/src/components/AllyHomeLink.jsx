import { useLocation, useNavigate } from "react-router-dom";
import { APP_HOME_PATH } from "../utils/appPaths";

/** Signed-in dashboard at /home (not /chat). */
export function goToAllyHome(navigate, location) {
  navigate(APP_HOME_PATH, {
    replace: location.pathname === APP_HOME_PATH,
  });
}

export default function AllyHomeLink({ className = "app-shell-header__logo", children }) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <a
      href={APP_HOME_PATH}
      className={className}
      aria-label="Ally home"
      onClick={(e) => {
        e.preventDefault();
        goToAllyHome(navigate, location);
      }}
    >
      {children ?? (
        <>
          <span aria-hidden>✳</span> ally
        </>
      )}
    </a>
  );
}
