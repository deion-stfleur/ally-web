import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import AppShellHeader from "../components/AppShellHeader";
import InPageMobileFooter from "../components/InPageMobileFooter";
import { useAuth } from "../hooks/useAuth";

function ThoughtStep({ index, userText, assistantText }) {
  return (
    <article className="chat-thought-step">
      <p className="chat-thought-step__label">Step {index}</p>
      <div className="chat-thought-step__block chat-thought-step__block--user">
        <p className="chat-thought-step__kicker">You asked</p>
        <p className="chat-thought-step__body">{userText}</p>
      </div>
      <div className="chat-thought-step__path" aria-hidden>
        <span className="chat-thought-step__dot" />
        <span className="chat-thought-step__line" />
        <span className="chat-thought-step__dot" />
      </div>
      <div className="chat-thought-step__block chat-thought-step__block--ally">
        <p className="chat-thought-step__kicker">How Ally worked</p>
        <p className="chat-thought-step__process">
          Ally read your message with the rest of this thread, used your linked Google tools when
          needed, and shaped a reply you could act on.
        </p>
        <p className="chat-thought-step__body">{assistantText}</p>
      </div>
    </article>
  );
}

function pairMessages(messages) {
  const pairs = [];
  let pendingUser = null;
  for (const m of messages || []) {
    if (m.role === "user") {
      pendingUser = m.content;
    } else if (m.role === "assistant" && pendingUser) {
      pairs.push({ user: pendingUser, assistant: m.content });
      pendingUser = null;
    }
  }
  return pairs;
}

export default function ChatThreadDetail() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { sessionToken } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!sessionToken || !conversationId) return;
    let cancelled = false;
    setLoading(true);
    api
      .get(`/api/chat/conversations/${conversationId}`)
      .then((res) => {
        if (!cancelled) setMessages(res.data?.messages || []);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || "Could not load chat");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionToken, conversationId]);

  const pairs = pairMessages(messages);

  return (
    <div className="chat-threads-page bg-sky-50/40 text-slate-900">
      <AppShellHeader
        title="Ally's process"
        showBack
        backLabel="Chats"
        onBack={() => navigate("/chats")}
      />

      <div className="chat-threads-page__body">
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : pairs.length === 0 ? (
          <p className="text-sm text-slate-500">No back-and-forth in this thread yet.</p>
        ) : (
          <div className="chat-thought-steps">
            {pairs.map((p, i) => (
              <ThoughtStep
                key={`${i}-${p.user.slice(0, 24)}`}
                index={i + 1}
                userText={p.user}
                assistantText={p.assistant}
              />
            ))}
          </div>
        )}

        <button
          type="button"
          className="chat-threads-page__open-chat"
          onClick={() => navigate("/chat", { state: { loadConversationId: conversationId } })}
        >
          Open in chat
        </button>
      </div>

      <InPageMobileFooter />
    </div>
  );
}
