import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import ChatMobileHeader, { ChatMobileMenuIcon } from "../components/ChatMobileHeader";
import PricingModal from "../components/PricingModal";
import ChatSearchModal from "../components/ChatSearchModal";
import PastMessagesModal from "../components/PastMessagesModal";
import PhonePromptModal from "../components/PhonePromptModal";
import SmsSubscribeBanner from "../components/SmsSubscribeBanner";
import InPageMobileFooter from "../components/InPageMobileFooter";
import HomeExploreSection from "../components/home/HomeExploreSection";
import Chat from "./Chat";
import { api } from "../api/client";
import { useAuth } from "../hooks/useAuth";
import { WAITLIST_MODE } from "../constants/waitlist";
import {
  CHAT_UI_SNAPSHOT_KEY,
  FORCE_NEW_CHAT_KEY,
  OPEN_HOME_AFTER_AUTH_KEY,
} from "../hooks/useChat";
import { CHAT_PATH } from "../utils/appPaths";
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

export default function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, sessionToken, refreshUser } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);
  const [pastMessagesOpen, setPastMessagesOpen] = useState(false);
  const [phonePromptOpen, setPhonePromptOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [allySmsE164, setAllySmsE164] = useState(null);
  /** Inline chat on /home — avoids route flash when opening new chat. */
  const [inlineChat, setInlineChat] = useState(null);
  useEffect(() => {
    if (!sessionToken) return;
    try {
      const marker = sessionStorage.getItem(OPEN_HOME_AFTER_AUTH_KEY);
      if (marker === sessionToken) {
        sessionStorage.removeItem(OPEN_HOME_AFTER_AUTH_KEY);
        sessionStorage.removeItem(CHAT_UI_SNAPSHOT_KEY);
      }
    } catch {
      /* ignore */
    }
  }, [sessionToken]);

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
    if (!sessionToken) return;
    let cancelled = false;
    api
      .get("/api/auth/app-config")
      .then((res) => {
        if (!cancelled) setAllySmsE164(res.data?.ally_sms_e164 || null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [sessionToken]);

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

  const openChat = useCallback(
    (state) => {
      if (state?.newChat) {
        try {
          if (sessionToken) {
            sessionStorage.setItem(FORCE_NEW_CHAT_KEY, sessionToken);
          }
        } catch {
          /* ignore */
        }
        setInlineChat({ newChat: true });
        return;
      }
      if (state?.loadConversationId) {
        setInlineChat({ conversationId: state.loadConversationId });
        return;
      }
      if (state?.seedPrompt) {
        navigate(CHAT_PATH, { state: { seedPrompt: state.seedPrompt } });
        return;
      }
      navigate(CHAT_PATH);
    },
    [navigate, sessionToken]
  );

  useEffect(() => {
    if (WAITLIST_MODE || !location.state?.openPricing) return;
    setPricingOpen(true);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  if (inlineChat) {
    return (
      <Chat
        embedded
        onExit={() => setInlineChat(null)}
        initialNewChat={Boolean(inlineChat.newChat)}
        initialConversationId={inlineChat.conversationId || null}
      />
    );
  }

  return (
    <div className="chat-page chat-page--home flex h-full min-h-0 text-slate-900">
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
          headerClassName="app-shell-header--home"
          showHeaderMenu={false}
          menuOpen={mobileMenuOpen}
          onMenuOpenChange={setMobileMenuOpen}
          onOpenPricing={() => setPricingOpen(true)}
          onNewChat={() => openChat({ newChat: true })}
          onOpenSearch={() => setSearchOpen(true)}
          onLinkPhone={() => setPhonePromptOpen(true)}
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

        <ChatSearchModal
          open={searchOpen}
          onClose={() => setSearchOpen(false)}
          sessionToken={sessionToken}
          onSelectConversation={(id) => openChat({ loadConversationId: id })}
        />

        <PastMessagesModal
          open={pastMessagesOpen}
          onClose={() => setPastMessagesOpen(false)}
          sessionToken={sessionToken}
          onContinueInChat={(id) => openChat({ loadConversationId: id })}
        />

        <div className="chat-page__scroll chat-page__scroll--home min-h-0 flex-1 overflow-y-auto">
          <HomeExploreSection
            user={user}
            allySmsE164={allySmsE164}
            onOpenSearch={() => setSearchOpen(true)}
            onOpenPastMessages={() => setPastMessagesOpen(true)}
            onLinkPhone={() => setPhonePromptOpen(true)}
            onOpenChat={openChat}
          />
          <InPageMobileFooter />
        </div>
      </div>
    </div>
  );
}
