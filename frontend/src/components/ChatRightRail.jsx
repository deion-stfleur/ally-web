import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { newClientTodoId } from "../hooks/useUserTodos";

export default function ChatRightRail({
  user,
  sessionToken = null,
  onPickQuickRequest,
  composerBusy = false,
  todos,
  setTodos,
  todosLoaded = true,
  todosSaveError = null,
  onLogout,
}) {
  const [darkRail, setDarkRail] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountWrapRef = useRef(null);
  const [quickRequests, setQuickRequests] = useState([]);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState(null);

  const fetchQuickRequests = useCallback(async () => {
    if (!sessionToken) return;
    setQrLoading(true);
    setQrError(null);
    try {
      const { data } = await api.post("/api/quick-requests", {});
      setQuickRequests(Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      const detail = e.response?.data?.detail;
      setQrError(
        typeof detail === "string"
          ? detail
          : Array.isArray(detail)
            ? detail.map((d) => d.msg || d).join(" ")
          : "Could not load suggestions."
      );
      setQuickRequests([]);
    } finally {
      setQrLoading(false);
    }
  }, [sessionToken]);

  useEffect(() => {
    if (!sessionToken) {
      setQuickRequests([]);
      setQrError(null);
      return;
    }
    fetchQuickRequests();
  }, [sessionToken, fetchQuickRequests]);

  useEffect(() => {
    if (!accountOpen) return undefined;
    function onPointerDown(e) {
      if (!accountWrapRef.current?.contains(e.target)) {
        setAccountOpen(false);
      }
    }
    function onKeyDown(e) {
      if (e.key === "Escape") setAccountOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [accountOpen]);

  const firstName =
    user?.name?.trim()?.split(/\s+/)[0] ||
    user?.email?.split("@")[0] ||
    "You";
  const initial =
    firstName[0]?.toUpperCase() ||
    user?.email?.[0]?.toUpperCase() ||
    "?";

  const toggleTodo = useCallback(
    (id) => {
      setTodos((prev) =>
        prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
      );
    },
    [setTodos]
  );

  const addTodo = useCallback(() => {
    setTodos((prev) => [
      ...prev,
      { id: newClientTodoId(), text: "New task", done: false },
    ]);
  }, [setTodos]);

  const updateTodoText = useCallback(
    (id, text) => {
      setTodos((prev) =>
        prev.map((t) => (t.id === id ? { ...t, text } : t))
      );
    },
    [setTodos]
  );

  const markAllDone = useCallback(() => {
    setTodos((prev) => prev.map((t) => ({ ...t, done: true })));
  }, [setTodos]);

  const shell = darkRail
    ? "border-slate-600 bg-slate-900 text-slate-100 shadow-xl shadow-slate-900/40"
    : "border-slate-200/90 bg-white text-slate-900 shadow-orbit";

  const cardMuted = darkRail ? "bg-slate-800/80" : "bg-slate-50";
  const borderSubtle = darkRail ? "border-slate-600" : "border-slate-200";
  const todoRow = darkRail
    ? "border-slate-600 bg-slate-800/50"
    : "border-slate-200 bg-white";

  return (
    <aside className="hidden h-full min-h-0 shrink-0 flex-col py-3 pl-0 pr-3 lg:flex lg:w-[min(100%,360px)] lg:max-w-[360px]">
      <div
        className={`flex max-h-full min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border ${shell}`}
      >
        {/* Header: theme + profile */}
        <div
          className={`flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3 ${borderSubtle}`}
        >
          <div
            className={`inline-flex rounded-full p-0.5 ${darkRail ? "bg-slate-800" : "bg-slate-100"}`}
            role="group"
            aria-label="Theme"
          >
            <button
              type="button"
              onClick={() => setDarkRail(false)}
              className={`rounded-full p-1.5 transition ${
                !darkRail
                  ? "bg-white text-amber-500 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              title="Light"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.25a.75.75 0 0 1 .75.75v2.25a.75.75 0 0 1-1.5 0V3a.75.75 0 0 1 .75-.75ZM7.5 12a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM18.894 6.166a.75.75 0 0 0-1.06-1.06l-1.591 1.59a.75.75 0 1 0 1.06 1.061l1.591-1.59ZM21.75 12a.75.75 0 0 1-.75.75h-2.25a.75.75 0 0 1 0-1.5H21a.75.75 0 0 1 .75.75ZM17.834 18.894a.75.75 0 0 0 1.06-1.06l-1.59-1.591a.75.75 0 1 1-1.061 1.06l1.59 1.591ZM12 18a.75.75 0 0 1 .75.75V21a.75.75 0 0 1-1.5 0v-2.25A.75.75 0 0 1 12 18ZM7.758 17.303a.75.75 0 0 0-1.061-1.06l-1.59 1.59a.75.75 0 1 0 1.06 1.061l1.59-1.59ZM6 12a.75.75 0 0 1-.75.75H3a.75.75 0 0 1 0-1.5h2.25A.75.75 0 0 1 6 12ZM6.697 7.757a.75.75 0 0 0 1.06-1.06l-1.59-1.591a.75.75 0 0 0-1.061 1.06l1.59 1.591Z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setDarkRail(true)}
              className={`rounded-full p-1.5 transition ${
                darkRail
                  ? "bg-slate-700 text-sky-300 shadow-inner"
                  : "text-slate-400 hover:text-slate-700"
              }`}
              title="Dark panel"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path
                  fillRule="evenodd"
                  d="M9.528 1.718a.75.75 0 0 1 .162.819A8.97 8.97 0 0 0 9 6a9 9 0 0 0 9 9 8.97 8.97 0 0 0 3.463-.69.75.75 0 1 1 .981.98 10.503 10.503 0 0 1-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 0 1 .818.162Z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
          <div className="relative min-w-0 flex-1" ref={accountWrapRef}>
            <button
              type="button"
              onClick={() => setAccountOpen((o) => !o)}
              aria-expanded={accountOpen}
              aria-haspopup="menu"
              aria-controls="chat-right-account-menu"
              className={`flex w-full min-w-0 items-center justify-end gap-2 rounded-xl px-2 py-1.5 text-left transition ${
                darkRail ? "hover:bg-slate-800" : "hover:bg-slate-50"
              } ${accountOpen ? (darkRail ? "bg-slate-800" : "bg-slate-50") : ""}`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                  darkRail
                    ? "bg-slate-700 text-slate-100"
                    : "bg-gradient-to-br from-sky-500 to-indigo-600 text-white"
                }`}
              >
                {initial}
              </span>
              <span className="truncate text-sm font-medium">{firstName}</span>
              <svg
                className={`h-4 w-4 shrink-0 text-slate-400 transition ${accountOpen ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
            {accountOpen && (
              <div
                id="chat-right-account-menu"
                role="menu"
                className={`absolute right-0 top-full z-50 mt-1 min-w-[11rem] rounded-xl border py-1 shadow-lg ${
                  darkRail
                    ? "border-slate-600 bg-slate-800 text-slate-100"
                    : "border-slate-200 bg-white text-slate-900"
                }`}
              >
                {user?.email && (
                  <p
                    className={`truncate px-3 py-2 text-[11px] leading-snug ${
                      darkRail ? "text-slate-400" : "text-slate-500"
                    }`}
                    title={user.email}
                  >
                    {user.email}
                  </p>
                )}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setAccountOpen(false);
                    onLogout?.();
                  }}
                  className={`flex w-full items-center gap-2 border-t px-3 py-2 text-left text-sm font-medium transition ${
                    darkRail
                      ? "border-slate-600 text-slate-100 hover:bg-slate-700"
                      : "border-slate-100 text-slate-800 hover:bg-slate-50"
                  }`}
                >
                  <svg
                    className="h-4 w-4 shrink-0 opacity-70"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.75}
                    stroke="currentColor"
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M18 12H9m0 0l3-3m-3 3l3 3"
                    />
                  </svg>
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          {/* Quick requests (inbox, last 7 days, AI-filtered actionable) */}
          <div className={`rounded-2xl border p-4 ${borderSubtle} ${cardMuted}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold tracking-tight">Quick requests</h2>
                <p
                  className={`mt-1 text-[11px] leading-relaxed ${darkRail ? "text-slate-400" : "text-slate-500"}`}
                >
                  From your inbox (7 days). Tap to add to the composer.
                </p>
              </div>
              <button
                type="button"
                onClick={() => fetchQuickRequests()}
                disabled={!sessionToken || qrLoading}
                className={`shrink-0 rounded-lg px-2 py-1 text-[11px] font-semibold uppercase tracking-wide transition disabled:cursor-not-allowed disabled:opacity-40 ${
                  darkRail
                    ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                    : "bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
                }`}
              >
                Refresh
              </button>
            </div>
            {!sessionToken && (
              <p className={`mt-3 text-xs ${darkRail ? "text-slate-400" : "text-slate-500"}`}>
                Sign in to load suggestions from Gmail.
              </p>
            )}
            {sessionToken && qrLoading && quickRequests.length === 0 && (
              <p className={`mt-3 text-xs ${darkRail ? "text-slate-400" : "text-slate-500"}`}>
                Scanning recent mail…
              </p>
            )}
            {qrError && (
              <p className="mt-3 text-xs text-red-500" role="alert">
                {qrError}
              </p>
            )}
            {sessionToken && !qrLoading && !qrError && quickRequests.length === 0 && (
              <p className={`mt-3 text-xs ${darkRail ? "text-slate-400" : "text-slate-500"}`}>
                No clear action items in this window. Try Refresh after new mail arrives.
              </p>
            )}
            {quickRequests.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {quickRequests.map((row) => (
                  <li key={row.thread_id}>
                    <button
                      type="button"
                      onClick={() => onPickQuickRequest?.(row.prefill)}
                      disabled={composerBusy}
                      className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs transition disabled:cursor-not-allowed disabled:opacity-50 ${
                        darkRail
                          ? "border-slate-600 bg-slate-800/50 text-slate-100 hover:border-slate-500"
                          : "border-slate-200 bg-white text-slate-800 hover:border-slate-300"
                      }`}
                    >
                      <span className="min-w-0 flex-1 font-medium leading-snug">{row.label}</span>
                      <svg
                        className={`h-4 w-4 shrink-0 ${darkRail ? "text-slate-500" : "text-slate-400"}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                        aria-hidden
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* To do */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-tight">To Do</h2>
              <button
                type="button"
                onClick={addTodo}
                disabled={!todosLoaded}
                className={`rounded-lg p-1 text-lg leading-none transition disabled:cursor-not-allowed disabled:opacity-40 ${
                  darkRail
                    ? "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                }`}
                aria-label="Add task"
              >
                +
              </button>
            </div>
            {todosSaveError && (
              <p className="mb-2 text-xs text-red-500" role="alert">
                {todosSaveError}
              </p>
            )}
            {!todosLoaded && (
              <p
                className={`mb-3 rounded-xl border border-dashed px-3 py-4 text-center text-xs ${
                  darkRail
                    ? "border-slate-600 text-slate-400"
                    : "border-slate-200 text-slate-500"
                }`}
              >
                Loading tasks…
              </p>
            )}
            {todosLoaded && todos.length === 0 && (
              <p
                className={`mb-3 rounded-xl border border-dashed px-3 py-4 text-center text-xs ${
                  darkRail
                    ? "border-slate-600 text-slate-400"
                    : "border-slate-200 text-slate-500"
                }`}
              >
                No tasks yet. Use <strong className="font-medium">+</strong> or type in chat:{" "}
                <code
                  className={`rounded px-1 py-0.5 text-[10px] ${
                    darkRail ? "bg-white/10" : "bg-black/5"
                  }`}
                >
                  todo: your task
                </code>
              </p>
            )}
            <ul className={`space-y-2 ${!todosLoaded ? "pointer-events-none opacity-50" : ""}`}>
              {todos.map((t) => {
                const cbId = `todo-done-${t.id}`;
                return (
                  <li key={t.id}>
                    <div
                      className={`flex items-center gap-3 rounded-xl border px-3 py-2 transition ${todoRow} ${
                        darkRail ? "hover:border-slate-500" : "hover:border-slate-300"
                      }`}
                    >
                      <label
                        htmlFor={cbId}
                        className="flex shrink-0 cursor-pointer items-center py-0.5"
                      >
                        <input
                          id={cbId}
                          type="checkbox"
                          checked={t.done}
                          onChange={() => toggleTodo(t.id)}
                          className="sr-only"
                        />
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition ${
                            t.done
                              ? "border-emerald-500 bg-emerald-500 text-white"
                              : darkRail
                                ? "border-slate-500 bg-transparent"
                                : "border-slate-300 bg-white"
                          }`}
                          aria-hidden
                        >
                          {t.done && (
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          )}
                        </span>
                      </label>
                      <input
                        type="text"
                        value={t.text}
                        onChange={(e) => updateTodoText(t.id, e.target.value)}
                        maxLength={4000}
                        placeholder="Task"
                        readOnly={!todosLoaded}
                        className={`min-w-0 flex-1 border-0 bg-transparent py-0.5 text-sm outline-none ring-0 focus:ring-0 ${
                          t.done
                            ? darkRail
                              ? "text-slate-500 line-through"
                              : "text-slate-400 line-through"
                            : darkRail
                              ? "text-slate-100 placeholder:text-slate-500"
                              : "text-slate-900 placeholder:text-slate-400"
                        }`}
                        aria-label="Task text"
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              onClick={markAllDone}
              disabled={todos.length === 0 || !todosLoaded}
              className={`mt-4 w-full rounded-xl py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                darkRail
                  ? "bg-sky-900/40 text-sky-100 hover:bg-sky-900/60"
                  : "bg-sky-100 text-sky-900 hover:bg-sky-200"
              }`}
            >
              Mark as Done
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
