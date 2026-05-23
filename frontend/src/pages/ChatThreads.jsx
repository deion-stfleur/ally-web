import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import AppShellHeader from "../components/AppShellHeader";
import InPageMobileFooter from "../components/InPageMobileFooter";
import { useAuth } from "../hooks/useAuth";

function formatWhen(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function ChatThreads() {
  const navigate = useNavigate();
  const { sessionToken } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionToken) return;
    let cancelled = false;
    api
      .get("/api/chat/conversations")
      .then((res) => {
        if (!cancelled) setItems(res.data?.conversations || []);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionToken]);

  return (
    <div className="chat-threads-page bg-sky-50/40 text-slate-900">
      <AppShellHeader
        title="Your chats"
        showBack
        onBack={() => navigate("/chat")}
      />

      <div className="chat-threads-page__body">
        <p className="chat-threads-page__lead">
          Open a thread to see what you asked and how Ally worked through each reply.
        </p>

        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-slate-500">No saved chats yet. Start one from the home grid.</p>
        ) : (
          <ul className="chat-threads-page__list">
            {items.map((c) => (
              <li key={c.conversation_id}>
                <Link to={`/chats/${c.conversation_id}`} className="chat-threads-page__row">
                  <span className="chat-threads-page__row-title">{c.title || "Chat"}</span>
                  <span className="chat-threads-page__row-when">{formatWhen(c.updated_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <InPageMobileFooter />
    </div>
  );
}
