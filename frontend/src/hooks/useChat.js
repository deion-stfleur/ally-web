import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api/client";

/** Survives refresh / remount when Postgres has nothing yet or hydrate races auth. */
export const CHAT_UI_SNAPSHOT_KEY = "ally_chat_ui_snapshot_v1";

/**
 * After Google sign-in, AuthContext stores the new session token here so /chat opens on the home
 * screen. Value must match the current session token (not a bare "1") so refresh never mis-fires.
 */
export const OPEN_HOME_AFTER_AUTH_KEY = "ally_open_home_v1";

let msgId = 0;
function nextId() {
  msgId += 1;
  return String(msgId);
}

function formatApiError(err) {
  const d = err.response?.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d))
    return d.map((x) => x.msg ?? JSON.stringify(x)).join("; ");
  if (d && typeof d === "object") return JSON.stringify(d);
  return err.message || "Request failed";
}

/**
 * @param {{ sessionToken?: string | null }} [opts]
 */
export function useChat(opts = {}) {
  const { sessionToken = null } = opts;
  const [, setConversationId] = useState(null);
  const conversationIdRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const [streaming, setStreaming] = useState(false);
  const [attachIds, setAttachIds] = useState([]);
  const [pendingEmail, setPendingEmail] = useState(null);
  const [emailSending, setEmailSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  /** @type {React.MutableRefObject<{ media_type: string, data_base64: string }[]>} */
  const pendingReceiptImagesRef = useRef([]);

  const priorSessionTokenRef = useRef(null);
  /**
   * React Strict Mode runs this effect twice on mount. The first pass consumes the open-home
   * sessionStorage marker; without this ref the second pass would fetch /api/chat/state and
   * repopulate messages. When set to the current token, skip server hydrate for that token.
   */
  const openHomeAppliedForTokenRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!sessionToken) {
      priorSessionTokenRef.current = null;
      openHomeAppliedForTokenRef.current = null;
      setReady(true);
      try {
        sessionStorage.removeItem(CHAT_UI_SNAPSHOT_KEY);
      } catch {
        /* ignore */
      }
      setMessages([]);
      setConversationId(null);
      conversationIdRef.current = null;
      messagesRef.current = [];
      return;
    }
    setReady(false);
    const switchedSession =
      priorSessionTokenRef.current !== null &&
      priorSessionTokenRef.current !== sessionToken;
    priorSessionTokenRef.current = sessionToken;

    let cancelled = false;
    (async () => {
      try {
      if (switchedSession) {
        openHomeAppliedForTokenRef.current = null;
      }
      if (openHomeAppliedForTokenRef.current === sessionToken) {
        return;
      }

      function readOpenHomeAfterAuth() {
        try {
          const marker = sessionStorage.getItem(OPEN_HOME_AFTER_AUTH_KEY);
          if (marker && marker === sessionToken) {
            sessionStorage.removeItem(OPEN_HOME_AFTER_AUTH_KEY);
            return true;
          }
        } catch {
          /* ignore */
        }
        return false;
      }

      function readSnapshot() {
        try {
          const raw = sessionStorage.getItem(CHAT_UI_SNAPSHOT_KEY);
          if (!raw) return null;
          const snap = JSON.parse(raw);
          if (
            snap?.token === sessionToken &&
            Array.isArray(snap.messages) &&
            snap.messages.length > 0
          ) {
            return snap;
          }
        } catch {
          /* ignore */
        }
        return null;
      }

      if (readOpenHomeAfterAuth()) {
        if (cancelled) return;
        openHomeAppliedForTokenRef.current = sessionToken;
        setMessages([]);
        messagesRef.current = [];
        setConversationId(null);
        conversationIdRef.current = null;
        try {
          sessionStorage.removeItem(CHAT_UI_SNAPSHOT_KEY);
        } catch {
          /* ignore */
        }
        return;
      }

      try {
        const { data } = await api.get("/api/chat/state");
        if (cancelled) return;
        const mapped = (data.messages || []).map((m) => ({
          id: nextId(),
          role: m.role,
          content: m.content,
        }));
        const cid = data.conversation_id || null;

        if (mapped.length > 0) {
          setMessages(mapped);
          messagesRef.current = mapped;
          setConversationId(cid);
          conversationIdRef.current = cid;
          return;
        }

        const snap = readSnapshot();
        if (snap) {
          setMessages(snap.messages);
          messagesRef.current = snap.messages;
          const snapCid = snap.conversationId ?? null;
          setConversationId(snapCid);
          conversationIdRef.current = snapCid;
          return;
        }
        if (messagesRef.current.length > 0 && !switchedSession) {
          return;
        }
        setMessages(mapped);
        messagesRef.current = mapped;
        setConversationId(cid);
        conversationIdRef.current = cid;
      } catch {
        if (cancelled) return;
        const snap = readSnapshot();
        if (snap) {
          setMessages(snap.messages);
          messagesRef.current = snap.messages;
          const snapCid = snap.conversationId ?? null;
          setConversationId(snapCid);
          conversationIdRef.current = snapCid;
        }
      }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionToken]);

  useEffect(() => {
    if (!sessionToken || messages.length === 0) return;
    try {
      sessionStorage.setItem(
        CHAT_UI_SNAPSHOT_KEY,
        JSON.stringify({
          token: sessionToken,
          conversationId: conversationIdRef.current,
          messages,
        })
      );
    } catch {
      /* quota / private mode */
    }
  }, [messages, sessionToken]);

  const addReceiptImages = useCallback((items) => {
    if (!Array.isArray(items) || items.length === 0) return;
    const cur = pendingReceiptImagesRef.current;
    const next = [...cur, ...items].slice(0, 4);
    pendingReceiptImagesRef.current = next;
  }, []);

  const clearPendingReceiptImages = useCallback(() => {
    pendingReceiptImagesRef.current = [];
  }, []);

  const sendMessage = useCallback(async (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    setSendError(null);
    setPendingEmail(null);

    const prior = messagesRef.current;
    const history = prior
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-20)
      .map((m) => ({ role: m.role, content: m.content }));

    const imgs = pendingReceiptImagesRef.current;
    const userDisplay =
      imgs.length > 0
        ? `${trimmed}\n\n[${imgs.length} receipt image(s) attached]`
        : trimmed;
    const userMsg = { id: nextId(), role: "user", content: userDisplay };
    const afterUser = [...prior, userMsg];
    messagesRef.current = afterUser;
    setMessages(afterUser);

    setStreaming(true);
    try {
      const payload = { message: trimmed, history };
      if (imgs.length > 0) {
        payload.images = imgs;
      }
      if (conversationIdRef.current) {
        payload.conversation_id = conversationIdRef.current;
      }
      const { data } = await api.post("/api/chat", payload);
      if (data.conversation_id) {
        setConversationId(data.conversation_id);
        conversationIdRef.current = data.conversation_id;
      }
      let assistantContent = data.reply || "";
      if (data.scheduled_job) {
        const sj = data.scheduled_job;
        const when =
          sj.run_at != null
            ? new Date(sj.run_at).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })
            : String(sj.run_at);
        assistantContent += `\n\n— Email scheduled for ${when}. Job id: ${sj.id}. Keep the worker running so it sends on time.`;
      }
      if (data.background_job) {
        const bj = data.background_job;
        assistantContent +=
          "\n\n— Background task queued; you'll get an SMS when it's done if this account has a verified phone. Keep the worker dyno running.";
        if (bj?.id) assistantContent += ` Job id: ${bj.id}.`;
      }
      if (data.watch_rule?.id) {
        const wr = data.watch_rule;
        assistantContent += `\n\n— Daily SMS watch saved (${wr.time_local} ${wr.timezone}). Next run: ${wr.next_run_at ? new Date(wr.next_run_at).toLocaleString() : "—"}. Worker must be running.`;
      }
      const assistantMsg = {
        id: nextId(),
        role: "assistant",
        content: assistantContent,
      };
      setMessages((p) => {
        const next = [...p, assistantMsg];
        messagesRef.current = next;
        return next;
      });
      if (data.email_action) {
        setPendingEmail(data.email_action);
      }
    } catch (e) {
      setSendError(formatApiError(e));
      const errMsg = {
        id: nextId(),
        role: "assistant",
        content: `Something went wrong: ${formatApiError(e)}`,
      };
      setMessages((p) => {
        const next = [...p, errMsg];
        messagesRef.current = next;
        return next;
      });
    } finally {
      pendingReceiptImagesRef.current = [];
      setStreaming(false);
    }
  }, []);

  const confirmSendEmail = useCallback(
    async ({ to, subject, body }) => {
      setSendError(null);
      setEmailSending(true);
      try {
        const payload = {
          to,
          subject,
          body,
        };
        if (pendingEmail?.thread_id) {
          payload.thread_id = pendingEmail.thread_id;
        }
        await api.post("/api/gmail/send", payload);
        const confirm = {
          id: nextId(),
          role: "assistant",
          content: `Email sent to ${to}.`,
        };
        setMessages((p) => {
          const next = [...p, confirm];
          messagesRef.current = next;
          return next;
        });
        setPendingEmail(null);
      } catch (e) {
        setSendError(formatApiError(e));
      } finally {
        setEmailSending(false);
      }
    },
    [pendingEmail]
  );

  const cancelEmailDraft = useCallback(() => {
    setPendingEmail(null);
    setSendError(null);
  }, []);

  const startNewChat = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    conversationIdRef.current = null;
    messagesRef.current = [];
    pendingReceiptImagesRef.current = [];
    setPendingEmail(null);
    setSendError(null);
    try {
      sessionStorage.removeItem(CHAT_UI_SNAPSHOT_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const loadConversation = useCallback(
    async (conversationId) => {
      const id = String(conversationId || "").trim();
      if (!id || !sessionToken) return;
      setSendError(null);
      setPendingEmail(null);
      pendingReceiptImagesRef.current = [];
      try {
        const { data } = await api.get(`/api/chat/conversations/${id}`);
        const mapped = (data.messages || []).map((m) => ({
          id: nextId(),
          role: m.role,
          content: m.content,
        }));
        setMessages(mapped);
        messagesRef.current = mapped;
        const cid = data.conversation_id || id;
        setConversationId(cid);
        conversationIdRef.current = cid;
        try {
          sessionStorage.setItem(
            CHAT_UI_SNAPSHOT_KEY,
            JSON.stringify({
              token: sessionToken,
              conversationId: cid,
              messages: mapped,
            })
          );
        } catch {
          /* ignore */
        }
      } catch (e) {
        setSendError(formatApiError(e));
      }
    },
    [sessionToken]
  );

  return {
    ready,
    messages,
    sendMessage,
    addReceiptImages,
    clearPendingReceiptImages,
    startNewChat,
    loadConversation,
    streaming,
    attachIds,
    setAttachIds,
    pendingEmail,
    confirmSendEmail,
    cancelEmailDraft,
    emailSending,
    sendError,
  };
}
