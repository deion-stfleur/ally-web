import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import ChatMobileHeader, { ChatMobileMenuIcon } from "../components/ChatMobileHeader";
import PricingModal from "../components/PricingModal";
import ChatSearchModal from "../components/ChatSearchModal";
import PhonePromptModal from "../components/PhonePromptModal";
import SmsSubscribeBanner from "../components/SmsSubscribeBanner";
import AccountSettingsModal from "../components/AccountSettingsModal";
import InPageMobileFooter from "../components/InPageMobileFooter";
import HomeExploreSection from "../components/home/HomeExploreSection";
import { api } from "../api/client";
import { useAuth } from "../hooks/useAuth";
import { CHAT_UI_SNAPSHOT_KEY, OPEN_HOME_AFTER_AUTH_KEY } from "../hooks/useChat";
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
  const { user, sessionToken, refreshUser, deleteAccount } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);
  const [phonePromptOpen, setPhonePromptOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [allySmsE164, setAllySmsE164] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

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
      navigate(CHAT_PATH, { state });
    },
    [navigate]
  );

  useEffect(() => {
    if (!location.state?.openPricing) return;
    setPricingOpen(true);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

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
      <AccountSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        user={user}
        onDeleteAccount={deleteAccount}
        onDeleted={() => navigate("/login", { replace: true })}
        onViewPlans={() => {
          setSettingsOpen(false);
          setPricingOpen(true);
        }}
      />
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
        {!user?.sms_plan_active ? (
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

        <div className="chat-page__scroll chat-page__scroll--home min-h-0 flex-1 overflow-y-auto">
          <HomeExploreSection
            user={user}
            allySmsE164={allySmsE164}
            onOpenSearch={() => setSearchOpen(true)}
            onLinkPhone={() => setPhonePromptOpen(true)}
            onOpenChat={openChat}
            onOpenAccount={() => setSettingsOpen(true)}
          />
          <InPageMobileFooter />
        </div>
      </div>
    </div>
  );
}
