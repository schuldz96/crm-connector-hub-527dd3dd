import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppConfigProvider } from "@/contexts/AppConfigContext";
import { RolePermissionsProvider } from "@/contexts/RolePermissionsContext";
import { AuditLogProvider } from "@/contexts/AuditLogContext";
import { NotificationsProvider } from "@/contexts/NotificationsContext";
import AppLayout from "@/components/AppLayout";
import LoginPage from "@/pages/LoginPage";
import GoogleCallbackPage from "@/pages/GoogleCallbackPage";
import DashboardPage from "@/pages/DashboardPage";
import MeetingsPage from "@/pages/MeetingsPage";
import WhatsAppPage from "@/pages/WhatsAppPage";
import InboxPage from "@/pages/InboxPage";
import TeamsPage from "@/pages/TeamsPage";
import UsersPage from "@/pages/UsersPage";
import IntegrationsPage from "@/pages/IntegrationsPage";
import AutomationsPage from "@/pages/AutomationsPage";
import AdminPage from "@/pages/AdminPage";
import ReportsPage from "@/pages/ReportsPage";
import TrainingPage from "@/pages/TrainingPage";
import AIConfigPage from "@/pages/AIConfigPage";
import PerformancePage from "@/pages/PerformancePage";
import MyProfilePage from "@/pages/MyProfilePage";
import NotFound from "@/pages/NotFound";

import { CONFIG } from '@/lib/config';

// Publishable Google OAuth Client ID (safe to expose in frontend)
export const GOOGLE_CLIENT_ID = CONFIG.GOOGLE_CLIENT_ID;

const queryClient = new QueryClient();

function ProtectedRoutes() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <img src="/appmax-favicon.png" alt="Appmax" className="w-10 h-10 rounded-xl animate-pulse" />
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/dashboard"    element={<DashboardPage />} />
        <Route path="/meetings"     element={<MeetingsPage />} />
        <Route path="/whatsapp"     element={<WhatsAppPage />} />
        <Route path="/inbox"        element={<InboxPage />} />
        <Route path="/training"     element={<TrainingPage />} />
        <Route path="/teams"        element={<TeamsPage />} />
        <Route path="/users"        element={<UsersPage />} />
        <Route path="/reports"      element={<ReportsPage />} />
        <Route path="/integrations" element={<IntegrationsPage />} />
        <Route path="/automations"  element={<AutomationsPage />} />
        <Route path="/ai-config"    element={<AIConfigPage />} />
        <Route path="/admin"        element={<AdminPage />} />
        <Route path="/performance"  element={<PerformancePage />} />
        <Route path="/me"           element={<MyProfilePage />} />
        <Route path="/"             element={<Navigate to="/dashboard" replace />} />
        <Route path="*"             element={<NotFound />} />
      </Route>
    </Routes>
  );
}

const App = () => (
  <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuditLogProvider>
            <RolePermissionsProvider>
              <AppConfigProvider>
                <AuthProvider>
                  <NotificationsProvider>
                    <Routes>
                      {/* Public routes */}
                      <Route path="/login"                element={<LoginPageWrapper />} />
                      <Route path="/auth/google/callback" element={<GoogleCallbackPage />} />
                      {/* Protected routes */}
                      <Route path="/*" element={<ProtectedRoutes />} />
                    </Routes>
                  </NotificationsProvider>
                </AuthProvider>
              </AppConfigProvider>
            </RolePermissionsProvider>
          </AuditLogProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </GoogleOAuthProvider>
);

function LoginPageWrapper() {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <LoginPage />;
}

export default App;
