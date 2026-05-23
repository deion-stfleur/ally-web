import { useEffect } from "react";
import "./home-explore.css";

/**
 * Opens the app search modal (past chats + completed tasks).
 */
export default function AllySearchField({ onOpen, className = "" }) {
  useEffect(() => {
    function onKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpen?.();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onOpen]);

  return (
    <button
      type="button"
      className={`ally-search-field ${className}`.trim()}
      onClick={() => onOpen?.()}
      aria-label="Search messages, tasks, and past chats"
    >
      <svg
        className="ally-search-field__icon"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.75}
        stroke="currentColor"
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
        />
      </svg>
      <span className="ally-search-field__placeholder">
        Search messages, tasks, and past chats
      </span>
      <kbd className="ally-search-field__kbd" aria-hidden>
        ⌘K
      </kbd>
    </button>
  );
}
