import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import GlobalMobileFooter from "./components/GlobalMobileFooter";
import ProtectedAppLayout from "./components/ProtectedAppLayout";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { WaitlistProvider } from "./contexts/WaitlistContext";
import { WAITLIST_MODE } from "./constants/waitlist";
import AccountSettings from "./pages/AccountSettings";
import AutomationsGuide from "./pages/AutomationsGuide";
import Chat from "./pages/Chat";
import Home from "./pages/Home";
import { APP_HOME_PATH, CHAT_PATH } from "./utils/appPaths";
import ChatRecipes from "./pages/ChatRecipes";
import RedirectChatConversation from "./components/RedirectChatConversation";
import BusinessOutreach from "./pages/BusinessOutreach";
import Features from "./pages/Features";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Pricing from "./pages/Pricing";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import PublishedSite from "./pages/PublishedSite";
import TermsOfService from "./pages/TermsOfService";
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
        <Route path={CHAT_PATH} element={<Chat />} />
        <Route path="/automations" element={<AutomationsGuide />} />
        <Route path="/account" element={<AccountSettings />} />
        <Route path="/chats" element={<Navigate to={APP_HOME_PATH} replace />} />
        <Route path="/chats/:conversationId" element={<RedirectChatConversation />} />
        <Route path="/recipes" element={<ChatRecipes />} />
      </Route>
      <Route path="/pricing" element={WAITLIST_MODE ? <Navigate to="/" replace /> : <Pricing />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/terms" element={<TermsOfService />} />
      <Route path="/s/:slug" element={<PublishedSite />} />
      <Route path="/:slug" element={<BusinessOutreach />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <WaitlistProvider>
          <div className="app-shell">
            <div className="app-route-shell">
              <AppRoutes />
            </div>
            <GlobalMobileFooter />
          </div>
        </WaitlistProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
