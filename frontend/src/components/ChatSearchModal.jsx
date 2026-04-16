import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../api/client";

function vagueTimeLabel(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const ms = Date.now() - d.getTime();
  const days = ms / 86400000;
  if (days < 1) return "Today";
  if (days < 7) return "Past week";
  if (days < 30) return "Past month";
  if (days < 365) return "Past year";
  return "Older";
}

/**
 * Command-palette style search: past chats (DB) + completed todos.
 */
export default function ChatSearchModal({
  open,
  onClose,
  sessionToken,
  onSelectConversation,
}) {
  const inputRef = useRef(null);
  const [query, setQuery] = useState("");
  const [conversations, setConversations] = useState([]);
  const [todosAll, setTodosAll] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const completedTodos = useMemo(
    () => (todosAll || []).filter((t) => t.done),
    [todosAll]
  );

  const chatRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (conversations || [])
      .filter((c) => !q || String(c.title || "").toLowerCase().includes(q))
      .map((c) => ({
        kind: "chat",
        key: `chat-${c.conversation_id}`,
        id: c.conversation_id,
        title: c.title || "Chat",
        when: c.updated_at,
      }));
  }, [conversations, query]);

  const taskRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return completedTodos
      .filter((t) => !q || String(t.text || "").toLowerCase().includes(q))
      .map((t) => ({
        kind: "task",
        key: `task-${t.id}`,
        id: t.id,
        title: t.text || "Task",
        when: t.created_at,
      }));
  }, [completedTodos, query]);

  const flatRows = useMemo(() => [...chatRows, ...taskRows], [chatRows, taskRows]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    setSelectedIndex((i) => Math.min(i, Math.max(flatRows.length - 1, 0)));
  }, [flatRows.length]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    const t = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(t);
  }, [open]);

  useEffect(() => {
    if (!open || !sessionToken) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [convRes, todoRes] = await Promise.all([
          api.get("/api/chat/conversations").catch(() => ({ data: { conversations: [] } })),
          api.get("/api/todos").catch(() => ({ data: { todos: [] } })),
        ]);
        if (cancelled) return;
        setConversations(convRes.data?.conversations || []);
        setTodosAll(todoRes.data?.todos || []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, sessionToken]);

  const pickChat = useCallback(
    (conversationId) => {
      onSelectConversation?.(conversationId);
      onClose();
    },
    [onSelectConversation, onClose]
  );

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, Math.max(flatRows.length - 1, 0)));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter" && flatRows.length > 0) {
        const row = flatRows[selectedIndex];
        if (row?.kind === "chat") {
          e.preventDefault();
          pickChat(row.id);
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, flatRows, selectedIndex, pickChat]);

  if (!open) return null;

  const node = (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/55 px-3 pt-[min(20vh,8rem)] sm:px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="chat-search-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-700/90 bg-slate-900 shadow-2xl shadow-black/40"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="chat-search-title" className="sr-only">
          Search chats and completed tasks
        </h2>
        <div className="flex items-center gap-3 border-b border-slate-700/80 px-4 py-3">
          <svg
            className="h-5 w-5 shrink-0 text-slate-500"
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
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats and projects"
            className="min-w-0 flex-1 border-0 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 outline-none ring-0"
            autoComplete="off"
          />
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
            aria-label="Close search"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="max-h-[min(420px,55vh)] overflow-y-auto">
          {loading && (
            <p className="px-4 py-8 text-center text-sm text-slate-500">Loading…</p>
          )}
          {!loading &&
            chatRows.length === 0 &&
            taskRows.length === 0 &&
            !query.trim() && (
              <p className="px-4 py-8 text-center text-sm text-slate-500">
                No past chats or completed tasks yet.
              </p>
            )}
          {!loading && query.trim() && chatRows.length === 0 && taskRows.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-slate-500">No matches.</p>
          )}

          {!loading && chatRows.length > 0 && (
            <>
              <p className="px-4 pt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Chats
              </p>
              <ul className="pb-1">
                {chatRows.map((row, i) => {
                  const globalIdx = i;
                  const selected = globalIdx === selectedIndex;
                  return (
                    <li key={row.key}>
                      <button
                        type="button"
                        onClick={() => pickChat(row.id)}
                        onMouseEnter={() => setSelectedIndex(globalIdx)}
                        className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${
                          selected ? "bg-slate-800" : "hover:bg-slate-800/60"
                        }`}
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-800 ring-1 ring-slate-600">
                          <svg
                            className="h-4 w-4 text-sky-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.75}
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                            />
                          </svg>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-2 text-sm font-medium text-slate-100">
                            {row.title}
                          </span>
                        </span>
                        {selected && (
                          <span
                            className="shrink-0 text-sm font-medium text-slate-500"
                            aria-hidden
                            title="Enter to open"
                          >
                            ↵
                          </span>
                        )}
                        <span className="shrink-0 text-xs text-slate-500">
                          {vagueTimeLabel(row.when)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {!loading && taskRows.length > 0 && (
            <>
              <p className="px-4 pt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Completed tasks
              </p>
              <ul className="pb-2">
                {taskRows.map((row, j) => {
                  const globalIdx = chatRows.length + j;
                  const selected = globalIdx === selectedIndex;
                  return (
                    <li key={row.key}>
                      <div
                        role="listitem"
                        onMouseEnter={() => setSelectedIndex(globalIdx)}
                        className={`flex w-full items-center gap-3 px-4 py-3 ${
                          selected ? "bg-slate-800/50" : ""
                        }`}
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-950/80 ring-1 ring-emerald-800/60">
                          <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-2 text-sm text-slate-300 line-through decoration-slate-500">
                            {row.title}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs text-slate-500">
                          {vagueTimeLabel(row.when)}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
