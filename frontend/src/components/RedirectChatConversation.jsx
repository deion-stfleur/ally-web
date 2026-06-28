import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { APP_HOME_PATH, CHAT_PATH } from "../utils/appPaths";

/** Old /chats/:id links open the thread on /chat instead of a separate page. */
export default function RedirectChatConversation() {
  const { conversationId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    const id = String(conversationId || "").trim();
    navigate(id ? `${CHAT_PATH}?c=${encodeURIComponent(id)}` : APP_HOME_PATH, {
      replace: true,
    });
  }, [conversationId, navigate]);

  return null;
}
