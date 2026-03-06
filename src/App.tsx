// Build trigger - frontend redeploy 2026-03-06c
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { FloatingChat } from "@/components/FloatingChat";
import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";
import Analyze from "./pages/Analyze";
import Dashboard from "./pages/Dashboard";
import Insights from "./pages/Insights";
import Queue from "./pages/Queue";
import Voice from "./pages/Voice";
import Playbook from "./pages/Playbook";
import MyStory from "./pages/MyStory";
import KnowledgeBase from "./pages/KnowledgeBase";
import Chat from "./pages/Chat";
import SettingsPage from "./pages/SettingsPage";
import Templates from "./pages/Templates";
import NotFound from "./pages/NotFound";
import Landing from "./pages/Landing";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import DataDeletion from "./pages/DataDeletion";

const queryClient = new QueryClient();

const Home = () => {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (session) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Landing />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/landing" element={<Landing />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/data-deletion" element={<DataDeletion />} />
            <Route path="/login" element={<Login />} />
            <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
            <Route path="/analyze" element={<ProtectedRoute><Analyze /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
            <Route path="/insights" element={<ProtectedRoute><Insights /></ProtectedRoute>} />
            <Route path="/playbook" element={<ProtectedRoute><Playbook /></ProtectedRoute>} />
            <Route path="/templates" element={<ProtectedRoute><Templates /></ProtectedRoute>} />
            <Route path="/strategy" element={<Navigate to="/dashboard" replace />} />
            <Route path="/queue" element={<ProtectedRoute><Queue /></ProtectedRoute>} />
            <Route path="/my-story" element={<ProtectedRoute><MyStory /></ProtectedRoute>} />
            <Route path="/identity" element={<ProtectedRoute><MyStory /></ProtectedRoute>} />
            <Route path="/voice" element={<ProtectedRoute><Voice /></ProtectedRoute>} />
            <Route path="/knowledge-base" element={<ProtectedRoute><KnowledgeBase /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <FloatingChat />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
