import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api/client";

function formatApiError(err) {
  const d = err.response?.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => x.msg ?? JSON.stringify(x)).join("; ");
  if (d && typeof d === "object") return JSON.stringify(d);
  return err.message || "Request failed";
}

/** @returns {string} UUID v4 for new rows (must match backend `UserTodoItem.id`). */
export function newClientTodoId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function normalizeRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => ({
    id: String(r.id),
    text: typeof r.text === "string" ? r.text : "",
    done: Boolean(r.done),
  }));
}

/**
 * Loads and debounce-persists workspace todos for the signed-in user.
 * @param {string | null | undefined} sessionToken
 */
export function useUserTodos(sessionToken) {
  const [todos, setTodos] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const skipNextPersist = useRef(true);
  const todosRef = useRef(todos);
  todosRef.current = todos;

  useEffect(() => {
    if (!sessionToken) {
      setTodos([]);
      setLoaded(false);
      setSaveError(null);
      skipNextPersist.current = true;
      return undefined;
    }

    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get("/api/todos");
        if (cancelled) return;
        setTodos(normalizeRows(data?.todos));
        setSaveError(null);
      } catch (e) {
        if (!cancelled) {
          setTodos([]);
          setSaveError(formatApiError(e));
        }
      } finally {
        if (!cancelled) {
          setLoaded(true);
          skipNextPersist.current = true;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionToken]);

  useEffect(() => {
    if (!sessionToken || !loaded) return undefined;

    if (skipNextPersist.current) {
      skipNextPersist.current = false;
      return undefined;
    }

    const handle = setTimeout(() => {
      const payload = {
        todos: todos.map((t) => ({
          id: t.id,
          text: t.text,
          done: t.done,
        })),
      };
      api
        .put("/api/todos", payload)
        .then(() => {
          setSaveError(null);
        })
        .catch((e) => {
          setSaveError(formatApiError(e));
        });
    }, 450);

    return () => clearTimeout(handle);
  }, [todos, loaded, sessionToken]);

  useEffect(() => {
    if (!sessionToken || !loaded) return undefined;

    const flush = () => {
      if (skipNextPersist.current) return;
      const list = todosRef.current;
      api
        .put("/api/todos", {
          todos: list.map((t) => ({ id: t.id, text: t.text, done: t.done })),
        })
        .then(() => setSaveError(null))
        .catch((e) => setSaveError(formatApiError(e)));
    };

    const onVis = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [sessionToken, loaded]);

  const appendTodo = useCallback((item) => {
    setTodos((prev) => [...prev, item]);
  }, []);

  return {
    todos,
    setTodos,
    todosLoaded: loaded,
    todosSaveError: saveError,
    appendTodo,
  };
}
