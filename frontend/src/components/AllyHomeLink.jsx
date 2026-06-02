import { useLocation, useNavigate } from "react-router-dom";
import BrandWordmark from "./BrandWordmark";
import { APP_HOME_PATH } from "../utils/appPaths";
import { APP_NAME } from "../constants/brand";

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
      aria-label={`${APP_NAME} home`}
      onClick={(e) => {
        e.preventDefault();
        goToAllyHome(navigate, location);
      }}
    >
      {children ?? <BrandWordmark />}
    </a>
  );
}
