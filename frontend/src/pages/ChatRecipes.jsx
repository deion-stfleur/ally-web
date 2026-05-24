import { useNavigate } from "react-router-dom";
import AllyQuickTips from "../components/AllyQuickTips";
import AppShellHeader from "../components/AppShellHeader";
import InPageMobileFooter from "../components/InPageMobileFooter";
import { useAuth } from "../hooks/useAuth";

export default function ChatRecipes() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="chat-recipes-page bg-sky-50/40 text-slate-900">
      <AppShellHeader
        title="Ally recipes"
        showBack
        onBack={() => navigate("/home")}
        user={user}
      />

      <div className="chat-recipes-page__body">
        <p className="chat-threads-page__lead">
          Short playbooks for chat, SMS, email, todos, and more. Tap Try in chat to start.
        </p>
        <AllyQuickTips onTryPrompt={(text) => navigate("/chat", { state: { seedPrompt: text } })} />
      </div>

      <InPageMobileFooter />
    </div>
  );
}
