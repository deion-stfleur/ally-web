import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import GlobalMobileFooter from "./components/GlobalMobileFooter";
import ProtectedAppLayout from "./components/ProtectedAppLayout";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import AccountSettings from "./pages/AccountSettings";
import AutomationsGuide from "./pages/AutomationsGuide";
import Chat from "./pages/Chat";
import Home from "./pages/Home";
import { APP_HOME_PATH, CHAT_PATH } from "./utils/appPaths";
import ChatRecipes from "./pages/ChatRecipes";
import RedirectChatConversation from "./components/RedirectChatConversation";
import Features from "./pages/Features";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Pricing from "./pages/Pricing";
import UseCases from "./pages/UseCases";

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function MarketingHome() {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) {
    return <Navigate to={APP_HOME_PATH} replace />;
  }
  return <Landing />;
}

/** Bare /chat opens the dashboard; only deep-link state stays on Chat. */
function ChatEntry() {
  const location = useLocation();
  const state = location.state;
  const hasIntent =
    state &&
    (state.newChat ||
      state.loadConversationId ||
      state.seedPrompt ||
      state.openPricing);
  if (!hasIntent) {
    return <Navigate to={APP_HOME_PATH} replace />;
  }
  return <Chat />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<MarketingHome />} />
      <Route path="/features" element={<Features />} />
      <Route path="/use-cases" element={<UseCases />} />
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <ProtectedRoute>
            <ProtectedAppLayout />
          </ProtectedRoute>
        }
      >
        <Route path={APP_HOME_PATH} element={<Home />} />
        <Route path={CHAT_PATH} element={<ChatEntry />} />
        <Route path="/automations" element={<AutomationsGuide />} />
        <Route path="/account" element={<AccountSettings />} />
        <Route path="/chats" element={<Navigate to={APP_HOME_PATH} replace />} />
        <Route path="/chats/:conversationId" element={<RedirectChatConversation />} />
        <Route path="/recipes" element={<ChatRecipes />} />
      </Route>
      <Route path="/pricing" element={<Pricing />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="app-shell">
          <div className="app-route-shell">
            <AppRoutes />
          </div>
          <GlobalMobileFooter />
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
