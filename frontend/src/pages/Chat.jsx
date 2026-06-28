import { useCallback, useEffect, useRef, useState } from "react";
import ChatMobileHeader, { ChatMobileMenuIcon } from "../components/ChatMobileHeader";
import PricingModal from "../components/PricingModal";
import ChatSearchModal from "../components/ChatSearchModal";
import PhonePromptModal from "../components/PhonePromptModal";
import SmsSubscribeBanner from "../components/SmsSubscribeBanner";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import ChatInput from "../components/ChatInput";
import InPageMobileFooter from "../components/InPageMobileFooter";
import ChatMessage from "../components/ChatMessage";
import ContextFilesPanel from "../components/ContextFilesPanel";
import EmailDraftCard from "../components/EmailDraftCard";
import { api } from "../api/client";
import { useAuth } from "../hooks/useAuth";
import { WAITLIST_MODE } from "../constants/waitlist";
import { useChat } from "../hooks/useChat";
import { newClientTodoId, useUserTodos } from "../hooks/useUserTodos";
import {
  clearPendingPhone,
  getPendingPhone,
  markShowSmsHandoff,
} from "../utils/phoneOnboarding";

const PHONE_PROMPT_DISMISS_KEY = "ally_chat_phone_prompt_dismissed";

async function savePendingPhoneAfterSubscribe(refreshUser) {
  const pending = getPendingPhone();
  if (!pending) return refreshUser();
  try {
    await api.patch("/api/auth/me/phone", { phone: pending });
    clearPendingPhone();
    markShowSmsHandoff();
    return refreshUser();
  } catch {
    return refreshUser();
  }
}

function localCalendarDateKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function Chat({
  embedded = false,
  onExit,
  initialNewChat = false,
  initialConversationId = null,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, sessionToken, refreshUser } = useAuth();
  const [contextOpen, setContextOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [phonePromptOpen, setPhonePromptOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);
  const urlParamsHandled = useRef(false);
  const { appendTodo } = useUserTodos(sessionToken);
  const {
    ready,
    messages,
    sendMessage,
    addReceiptImages,
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

  useEffect(() => {
    const sub = searchParams.get("sub");
    const sms = searchParams.get("sms_sub");
    const status = sub || sms;
    if (!status || !sessionToken) return;
    if (status === "success") {
      const hadPending = Boolean(getPendingPhone());
      savePendingPhoneAfterSubscribe(refreshUser).then((me) => {
        setSearchParams({}, { replace: true });
        if (!me) return;
        if (hadPending || !me.phone_e164) {
          setPhonePromptOpen(true);
        }
      });
    } else if (status === "cancel" || sms === "cancel") {
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, sessionToken, refreshUser, setSearchParams]);

  useEffect(() => {
    if (!sessionToken || !user) return;
    if (user.phone_e164) return;
    let dismissed = null;
    try {
      dismissed = window.localStorage.getItem(PHONE_PROMPT_DISMISS_KEY);
    } catch {
      /* ignore */
    }
    if (dismissed === localCalendarDateKey()) return;
    setPhonePromptOpen(true);
  }, [sessionToken, user]);

  const dismissPhonePrompt = useCallback((opts) => {
    if (!opts?.saved) {
      try {
        window.localStorage.setItem(PHONE_PROMPT_DISMISS_KEY, localCalendarDateKey());
      } catch {
        /* ignore */
      }
    }
    setPhonePromptOpen(false);
  }, []);

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

  useEffect(() => {
    const state = location.state;
    if (!state) return;

    if (!WAITLIST_MODE && state.openPricing) {
      setPricingOpen(true);
    }
    if (state.seedPrompt) {
      sendFromComposer(state.seedPrompt);
    }

    if (state.openPricing || state.seedPrompt) {
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [
    location.pathname,
    location.state,
    navigate,
    sendFromComposer,
  ]);

  useEffect(() => {
    if (!ready || urlParamsHandled.current || embedded) return;
    const isNew = searchParams.get("new") === "1";
    const loadId = (searchParams.get("c") || "").trim();
    if (!isNew && !loadId) return;

    urlParamsHandled.current = true;
    if (isNew) {
      startNewChat();
    } else if (loadId) {
      loadConversation(loadId);
    }
    setSearchParams({}, { replace: true });
  }, [
    ready,
    embedded,
    searchParams,
    setSearchParams,
    startNewChat,
    loadConversation,
  ]);

  useEffect(() => {
    if (!embedded || !ready || urlParamsHandled.current) return;
    urlParamsHandled.current = true;
    if (initialNewChat) {
      startNewChat();
    } else if (initialConversationId) {
      loadConversation(initialConversationId);
    }
  }, [
    embedded,
    ready,
    initialNewChat,
    initialConversationId,
    startNewChat,
    loadConversation,
  ]);

  const handleNewChat = useCallback(() => {
    startNewChat();
  }, [startNewChat]);

  return (
    <div className="chat-page flex h-full min-h-0 bg-[#F9FAFB] text-slate-900">
      <PhonePromptModal
        open={phonePromptOpen}
        onDismiss={dismissPhonePrompt}
        refreshUser={refreshUser}
        smsPlanActive={Boolean(user?.sms_plan_active)}
        userPhoneE164={user?.phone_e164}
        onViewPlans={() => {
          setPhonePromptOpen(false);
          setPricingOpen(true);
        }}
      />
      <PricingModal open={pricingOpen} onClose={() => setPricingOpen(false)} />
      <div className="chat-page__main relative flex min-h-0 min-w-0 flex-1 flex-col">
        <ChatMobileHeader
          user={user}
          menuOpen={mobileMenuOpen}
          onMenuOpenChange={setMobileMenuOpen}
          onOpenPricing={() => setPricingOpen(true)}
          showBack={embedded}
          onBack={onExit}
          backLabel="Home"
          onNewChat={() => {
            setSearchOpen(false);
            setContextOpen(false);
            handleNewChat();
          }}
          onOpenSearch={() => setSearchOpen(true)}
          onLinkPhone={() => setPhonePromptOpen(true)}
          headerRight={
            <div className="chat-app-header__actions">
                <button
                  type="button"
                  title="Search chats and completed tasks"
                  onClick={() => setSearchOpen(true)}
                  className="chat-app-header__icon-btn"
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
                    setContextOpen(false);
                    handleNewChat();
                  }}
                  className="chat-app-header__new-chat"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                New chat
              </button>
            </div>
          }
        />
        {!WAITLIST_MODE && !user?.sms_plan_active ? (
          <SmsSubscribeBanner
            phoneE164={user?.phone_e164}
            onViewPlans={() => setPricingOpen(true)}
          />
        ) : null}
        <button
          type="button"
          className="chat-mobile-menu-fab lg:hidden"
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Open menu"
        >
          <ChatMobileMenuIcon />
        </button>
        <ContextFilesPanel
          open={contextOpen}
          onClose={() => setContextOpen(false)}
          attachIds={attachIds}
          onAttachChange={setAttachIds}
        />

        <ChatSearchModal
          open={searchOpen}
          onClose={() => setSearchOpen(false)}
          sessionToken={sessionToken}
          onSelectConversation={(id) => {
            loadConversation(id);
          }}
        />

        <div className="chat-page__scroll min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl space-y-4 px-4 py-8">
            {user?.email && (
              <p className="text-center text-xs text-slate-400">{user.email}</p>
            )}
            {!ready ? (
              <p className="text-center text-sm text-slate-500">Loading chat…</p>
            ) : null}
            {ready && messages.length === 0 ? (
                <div className="chat-page__empty rounded-2xl border border-slate-200/90 bg-white px-5 py-8 text-center shadow-sm">
                  <p className="text-base font-semibold text-slate-900">New chat with Ally</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">
                    Ask about Gmail, Calendar, Drive, Docs, or Sheets. Ally uses your connected
                    Google account to complete tasks you request.
                  </p>
                  <ul className="mt-4 space-y-2 text-left text-sm text-slate-600">
                    <li>“What&apos;s on my calendar today?”</li>
                    <li>“Summarize my unread emails from this week”</li>
                    <li>“Search my Drive for recent spreadsheets”</li>
              </ul>
            </div>
            ) : null}
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
          <InPageMobileFooter />
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

        <div className="chat-page__composer-wrap">
          <ChatInput
              onSend={sendFromComposer}
              disabled={streaming || emailSending}
              attachIds={attachIds}
              onRemoveAttach={(id) =>
                setAttachIds((prev) => prev.filter((x) => x !== id))
              }
              onReceiptImages={addReceiptImages}
            onOpenMobileMenu={() => setMobileMenuOpen(true)}
          />
        </div>
      </div>
    </div>
  );
}
