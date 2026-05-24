import { useNavigate } from "react-router-dom";
import { openAccountSettings } from "../utils/openAccountSettings";
import "./chat-home-grid.css";

const TILES = [
  {
    id: "search",
    title: "Search",
    meta: "Past threads",
    action: "search",
  },
  {
    id: "account",
    title: "Account",
    meta: "Profile & billing",
    action: "account",
  },
  {
    id: "recipes",
    title: "Ally recipes",
    meta: "Quick how-tos",
    action: "link",
    to: "/recipes",
  },
  {
    id: "automations",
    title: "Automations",
    meta: "Pro workflows",
    action: "link",
    to: "/automations",
  },
  {
    id: "text",
    title: "Text Ally",
    meta: "SMS setup",
    action: "phone",
  },
  {
    id: "new",
    title: "New chat",
    meta: "Fresh thread",
    action: "newChat",
  },
];

export default function ChatHomeGrid({
  onOpenSearch,
  onLinkPhone,
  onNewChat,
}) {
  const navigate = useNavigate();

  const handleTile = (tile) => {
    switch (tile.action) {
      case "link":
        navigate(tile.to);
        break;
      case "account":
        openAccountSettings(navigate, window.location.pathname);
        break;
      case "phone":
        onLinkPhone?.();
        break;
      case "newChat":
        onNewChat?.();
        break;
      case "search":
        onOpenSearch?.();
        break;
      default:
        break;
    }
  };

  return (
    <nav className="chat-home-grid" aria-label="Chat home">
      <ul className="chat-home-grid__tiles">
        {TILES.map((tile) => (
          <li key={tile.id}>
            <button type="button" className="chat-home-grid__tile" onClick={() => handleTile(tile)}>
              <span className="chat-home-grid__tile-kicker">{tile.title}</span>
              <span className="chat-home-grid__tile-foot">
                <span className="chat-home-grid__tile-label">{tile.meta}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
