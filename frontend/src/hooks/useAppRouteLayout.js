import { useEffect } from "react";

const MQ = "(max-width: 1023px)";

/**
 * Mobile: document scroll + footer at bottom of page flow.
 * Desktop chat: fixed viewport height for split panes.
 */
export function useAppRouteLayout(mode = "scroll") {
  useEffect(() => {
    const mq = window.matchMedia(MQ);

    const sync = () => {
      document.documentElement.classList.remove("ally-route-chat", "ally-route-app-scroll");
      if (mode === "chat" && !mq.matches) {
        document.documentElement.classList.add("ally-route-chat");
      } else {
        document.documentElement.classList.add("ally-route-app-scroll");
      }
    };

    sync();
    mq.addEventListener("change", sync);
    return () => {
      mq.removeEventListener("change", sync);
      document.documentElement.classList.remove("ally-route-chat", "ally-route-app-scroll");
    };
  }, [mode]);
}
