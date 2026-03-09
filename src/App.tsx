import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppConfigProvider } from "@/contexts/AppConfigContext";
import { RolePermissionsProvider } from "@/contexts/RolePermissionsContext";
import { AuditLogProvider } from "@/contexts/AuditLogContext";
import AppLayout from "@/components/AppLayout";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import MeetingsPage from "@/pages/MeetingsPage";
import WhatsAppPage from "@/pages/WhatsAppPage";
import TeamsPage from "@/pages/TeamsPage";
import UsersPage from "@/pages/UsersPage";
import IntegrationsPage from "@/pages/IntegrationsPage";
import AutomationsPage from "@/pages/AutomationsPage";
import AdminPage from "@/pages/AdminPage";
import ReportsPage from "@/pages/ReportsPage";
import TrainingPage from "@/pages/TrainingPage";
import AIConfigPage from "@/pages/AIConfigPage";
import PerformancePage from "@/pages/PerformancePage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoutes() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center animate-pulse">
            <span className="text-primary-foreground font-bold text-lg">D</span>
          </div>
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
        <Route path="/training"     element={<TrainingPage />} />
        <Route path="/teams"        element={<TeamsPage />} />
        <Route path="/users"        element={<UsersPage />} />
        <Route path="/reports"      element={<ReportsPage />} />
        <Route path="/integrations" element={<IntegrationsPage />} />
        <Route path="/automations"  element={<AutomationsPage />} />
        <Route path="/ai-config"    element={<AIConfigPage />} />
        <Route path="/admin"        element={<AdminPage />} />
        <Route path="/performance"  element={<PerformancePage />} />
        <Route path="/"             element={<Navigate to="/dashboard" replace />} />
        <Route path="*"             element={<NotFound />} />
      </Route>
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuditLogProvider>
          <RolePermissionsProvider>
            <AppConfigProvider>
              <AuthProvider>
                <Routes>
                  <Route path="/login" element={<LoginPageWrapper />} />
                  <Route path="/*"     element={<ProtectedRoutes />} />
                </Routes>
              </AuthProvider>
            </AppConfigProvider>
          </RolePermissionsProvider>
        </AuditLogProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

function LoginPageWrapper() {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <LoginPage />;
}

export default App;
