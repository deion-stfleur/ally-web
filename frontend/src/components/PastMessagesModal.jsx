import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../api/client";
import ChatMessage from "./ChatMessage";
import "./past-messages-modal.css";

function formatWhen(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/**
 * Browse past Ally threads read-only; optional handoff to live /chat.
 */
export default function PastMessagesModal({
  open,
  onClose,
  sessionToken,
  onContinueInChat,
}) {
  const [conversations, setConversations] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedTitle, setSelectedTitle] = useState("");
  const [messages, setMessages] = useState([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) {
      setSelectedId(null);
      setSelectedTitle("");
      setMessages([]);
      setError(null);
      return undefined;
    }
    if (!sessionToken) return undefined;
    let cancelled = false;
    setLoadingList(true);
    api
      .get("/api/chat/conversations")
      .then((res) => {
        if (!cancelled) setConversations(res.data?.conversations || []);
      })
      .catch(() => {
        if (!cancelled) setConversations([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingList(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, sessionToken]);

  const openThread = useCallback(
    async (conversationId, title) => {
      const id = String(conversationId || "").trim();
      if (!id || !sessionToken) return;
      setSelectedId(id);
      setSelectedTitle(title || "Chat");
      setMessages([]);
      setError(null);
      setLoadingThread(true);
      try {
        const { data } = await api.get(`/api/chat/conversations/${id}`);
        setMessages(
          (data.messages || []).map((m, i) => ({
            id: `${id}-${i}`,
            role: m.role,
            content: m.content,
          }))
        );
      } catch (e) {
        setError(e.message || "Could not load this chat");
      } finally {
        setLoadingThread(false);
      }
    },
    [sessionToken]
  );

  const backToList = useCallback(() => {
    setSelectedId(null);
    setSelectedTitle("");
    setMessages([]);
    setError(null);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(e) {
      if (e.key === "Escape") {
        if (selectedId) backToList();
        else onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, selectedId, backToList, onClose]);

  if (!open) return null;

  const node = (
    <div
      className="past-messages-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="past-messages-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="past-messages-modal__panel" onMouseDown={(e) => e.stopPropagation()}>
        <header className="past-messages-modal__head">
          {selectedId ? (
            <button
              type="button"
              className="past-messages-modal__back"
              onClick={backToList}
              aria-label="Back to all messages"
            >
              ←
            </button>
          ) : null}
          <div className="past-messages-modal__head-text">
            <h2 id="past-messages-title" className="past-messages-modal__title">
              {selectedId ? selectedTitle : "Past messages"}
            </h2>
            <p className="past-messages-modal__sub">
              {selectedId
                ? "Read-only preview"
                : "Select a thread to review what you and Ally discussed"}
            </p>
          </div>
          <button
            type="button"
            className="past-messages-modal__close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </header>

        {!selectedId ? (
          <div className="past-messages-modal__list-wrap">
            {loadingList ? (
              <p className="past-messages-modal__empty">Loading…</p>
            ) : conversations.length === 0 ? (
              <div className="past-messages-modal__empty">
                <p>No past chats yet.</p>
                <p className="past-messages-modal__empty-hint">
                  Start a new chat from the home screen — your threads will show up here.
                </p>
              </div>
            ) : (
              <ul className="past-messages-modal__list">
                {conversations.map((c) => (
                  <li key={c.conversation_id}>
                    <button
                      type="button"
                      className="past-messages-modal__row"
                      onClick={() => openThread(c.conversation_id, c.title)}
                    >
                      <span className="past-messages-modal__row-title">
                        {c.title || "Chat"}
                      </span>
                      <span className="past-messages-modal__row-when">
                        {formatWhen(c.updated_at)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="past-messages-modal__thread">
            {loadingThread ? (
              <p className="past-messages-modal__empty">Loading thread…</p>
            ) : error ? (
              <p className="past-messages-modal__error" role="alert">
                {error}
              </p>
            ) : messages.length === 0 ? (
              <p className="past-messages-modal__empty">This thread is empty.</p>
            ) : (
              <div className="past-messages-modal__messages">
                {messages.map((m) => (
                  <ChatMessage key={m.id} message={m} />
                ))}
              </div>
            )}
            {selectedId && !loadingThread ? (
              <footer className="past-messages-modal__foot">
                <button
                  type="button"
                  className="past-messages-modal__continue"
                  onClick={() => {
                    onContinueInChat?.(selectedId);
                    onClose();
                  }}
                >
                  Continue in chat
                </button>
              </footer>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
