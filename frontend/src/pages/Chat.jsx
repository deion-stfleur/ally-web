import { useCallback, useState } from "react";
import ChatSearchModal from "../components/ChatSearchModal";
import { useNavigate } from "react-router-dom";
import ChatInput from "../components/ChatInput";
import ChatLanding from "../components/ChatLanding";
import ChatMessage from "../components/ChatMessage";
import ChatRail from "../components/ChatRail";
import ChatRightRail from "../components/ChatRightRail";
import ContextFilesPanel from "../components/ContextFilesPanel";
import EmailDraftCard from "../components/EmailDraftCard";
import { useAuth } from "../hooks/useAuth";
import { useChat } from "../hooks/useChat";
import { newClientTodoId, useUserTodos } from "../hooks/useUserTodos";

export default function Chat() {
  const navigate = useNavigate();
  const { user, sessionToken, logout } = useAuth();
  const [contextOpen, setContextOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const {
    todos: railTodos,
    setTodos: setRailTodos,
    todosLoaded,
    todosSaveError,
    appendTodo,
  } = useUserTodos(sessionToken);
  const {
    messages,
    sendMessage,
    startNewChat,
    streaming,
    attachIds,
    setAttachIds,
    pendingEmail,
    confirmSendEmail,
    cancelEmailDraft,
    emailSending,
    sendError,
    loadConversation,
  } = useChat({ sessionToken });

  const sendFromComposer = useCallback(
    (text) => {
      const raw = text.trim();
      const m =
        raw.match(/^todo:\s*(.+)$/i) || raw.match(/^add\s+todo\s*[:\-]?\s*(.+)$/i);
      if (m) {
        const label = m[1].trim();
        if (label) {
          appendTodo({ id: newClientTodoId(), text: label, done: false });
        }
        return;
      }
      sendMessage(text);
    },
    [sendMessage, appendTodo]
  );

  async function onLogoutClick() {
    await logout();
    navigate("/login", { replace: true });
  }

  const showChatChrome = messages.length > 0;

  return (
    <div
      className={`flex h-full min-h-0 text-slate-900 ${showChatChrome ? "bg-[#F9FAFB]" : "bg-sky-100/40"}`}
    >
      <ChatRail
        user={user}
        onLogout={onLogoutClick}
        contextOpen={contextOpen}
        onToggleContext={() => setContextOpen((o) => !o)}
      />
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <ContextFilesPanel
          open={contextOpen}
          onClose={() => setContextOpen(false)}
          attachIds={attachIds}
          onAttachChange={setAttachIds}
        />

        {showChatChrome && (
          <header className="flex shrink-0 items-center justify-end gap-2 border-b border-slate-200/80 bg-white/90 px-5 py-3.5 backdrop-blur-md sm:px-6">
            <button
              type="button"
              title="Search chats and completed tasks"
              onClick={() => setSearchOpen(true)}
              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => {
                setSearchOpen(false);
                startNewChat();
                setContextOpen(false);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 sm:text-sm"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
              New chat
            </button>
          </header>
        )}

        <ChatSearchModal
          open={searchOpen}
          onClose={() => setSearchOpen(false)}
          sessionToken={sessionToken}
          onSelectConversation={(id) => loadConversation(id)}
        />

        <div className="min-h-0 flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <ChatLanding user={user} onPickPrompt={(t) => sendFromComposer(t)} />
          ) : (
            <div className="mx-auto max-w-3xl space-y-4 px-4 py-8">
              {user?.email && (
                <p className="text-center text-xs text-slate-400">{user.email}</p>
              )}
              {messages.map((m) => (
                <ChatMessage key={m.id} message={m} />
              ))}
              {streaming && (
                <p className="text-center text-xs italic text-slate-400">Assistant is typing…</p>
              )}
              {sendError && !pendingEmail && (
                <p className="text-center text-xs text-red-600" role="alert">
                  {sendError}
                </p>
              )}
            </div>
          )}
        </div>

        {pendingEmail && (
          <div className="shrink-0 border-t border-slate-200/80 bg-white/95 px-4 py-3 backdrop-blur">
            <div className="mx-auto max-w-3xl">
              <EmailDraftCard
                draft={pendingEmail}
                onSend={confirmSendEmail}
                onCancel={cancelEmailDraft}
                sending={emailSending}
                error={sendError}
              />
            </div>
          </div>
        )}

        <ChatInput
          onSend={sendFromComposer}
          disabled={streaming || emailSending}
          attachIds={attachIds}
          onRemoveAttach={(id) =>
            setAttachIds((prev) => prev.filter((x) => x !== id))
          }
        />
      </div>
      <ChatRightRail
        user={user}
        sessionToken={sessionToken}
        onPickQuickRequest={sendFromComposer}
        composerBusy={streaming || emailSending}
        todos={railTodos}
        setTodos={setRailTodos}
        todosLoaded={todosLoaded}
        todosSaveError={todosSaveError}
        onLogout={onLogoutClick}
      />
    </div>
  );
}
