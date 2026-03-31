import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider, useAuth, getDefaultRoute } from "@/contexts/AuthContext";
import { AppConfigProvider } from "@/contexts/AppConfigContext";
import { RolePermissionsProvider } from "@/contexts/RolePermissionsContext";
import { AuditLogProvider } from "@/contexts/AuditLogContext";
import { NotificationsProvider } from "@/contexts/NotificationsContext";
import AppLayout from "@/components/AppLayout";
import RequireRole from "@/components/RequireRole";
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
import CRMContactsPage from "@/pages/crm/CRMContactsPage";
import CRMDealsPage from "@/pages/crm/CRMDealsPage";
import CRMTicketsPage from "@/pages/crm/CRMTicketsPage";
import CRMCompaniesPage from "@/pages/crm/CRMCompaniesPage";
import CRMPipelineSettingsPage from "@/pages/crm/CRMPipelineSettingsPage";
import CRMPropertiesPage from "@/pages/crm/CRMPropertiesPage";
import CRMRecordPage from "@/pages/crm/CRMRecordPage";
import NotFound from "@/pages/NotFound";

import { CONFIG } from '@/lib/config';

// Publishable Google OAuth Client ID (safe to expose in frontend)
export const GOOGLE_CLIENT_ID = CONFIG.GOOGLE_CLIENT_ID;

const queryClient = new QueryClient();

/**
 * R() — atalho para envolver páginas com RequireRole.
 * resource: verifica se o cargo do usuário tem acesso ao recurso (tabela permissoes_papeis)
 * minRole: exige cargo mínimo na hierarquia
 */
const R = (el: React.ReactNode, opts: { resource?: string; minRole?: string }) => (
  <RequireRole resource={opts.resource} minRole={opts.minRole as any}>
    {el}
  </RequireRole>
);

function ProtectedRoutes() {
  const { isAuthenticated, isLoading, user } = useAuth();

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
        {/* Páginas abertas para qualquer usuário autenticado */}
        <Route path="/dashboard"    element={R(<DashboardPage />,    { resource: 'dashboard' })} />
        <Route path="/me"           element={<MyProfilePage />} />

        {/* Páginas com controle por recurso (respeita permissoes_papeis) */}
        <Route path="/meetings"     element={R(<MeetingsPage />,     { resource: 'meetings' })} />
        <Route path="/whatsapp"     element={R(<WhatsAppPage />,     { resource: 'whatsapp' })} />
        <Route path="/inbox"        element={R(<InboxPage />,        { resource: 'inbox' })} />
        <Route path="/training"     element={R(<TrainingPage />,     { resource: 'training' })} />
        <Route path="/performance"  element={R(<PerformancePage />,  { resource: 'performance' })} />
        <Route path="/reports"      element={R(<ReportsPage />,      { resource: 'reports' })} />

        {/* Páginas restritas — exigem cargo + recurso */}
        <Route path="/teams"        element={R(<TeamsPage />,        { resource: 'teams' })} />
        <Route path="/users"        element={R(<UsersPage />,        { resource: 'users' })} />
        <Route path="/integrations" element={R(<IntegrationsPage />, { resource: 'integrations' })} />
        <Route path="/automations"  element={R(<AutomationsPage />,  { resource: 'automations' })} />
        <Route path="/ai-config"    element={R(<AIConfigPage />,     { resource: 'ai-config' })} />
        <Route path="/admin"        element={R(<AdminPage />,        { resource: 'admin' })} />

        {/* CRM — exige recurso 'crm' */}
        <Route path="/crm/contacts"           element={R(<CRMContactsPage />,       { resource: 'crm' })} />
        <Route path="/objects/0-1/views/*"     element={R(<CRMContactsPage />,       { resource: 'crm' })} />
        <Route path="/crm/companies"           element={R(<CRMCompaniesPage />,      { resource: 'crm' })} />
        <Route path="/objects/0-2/views/*"     element={R(<CRMCompaniesPage />,      { resource: 'crm' })} />
        <Route path="/crm/deals"               element={R(<CRMDealsPage />,          { resource: 'crm' })} />
        <Route path="/objects/0-3/views/*"     element={R(<CRMDealsPage />,          { resource: 'crm' })} />
        <Route path="/crm/tickets"             element={R(<CRMTicketsPage />,        { resource: 'crm' })} />
        <Route path="/objects/0-4/views/*"     element={R(<CRMTicketsPage />,        { resource: 'crm' })} />
        <Route path="/crm/pipeline-settings"   element={R(<CRMPipelineSettingsPage />, { resource: 'crm' })} />
        <Route path="/crm/properties"          element={R(<CRMPropertiesPage />,       { resource: 'crm' })} />
        <Route path="/record/:typeId/:numero"  element={R(<CRMRecordPage />,         { resource: 'crm' })} />

        {/* Fallback */}
        <Route path="/"             element={<Navigate to={getDefaultRoute(user?.role)} replace />} />
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
  const { isAuthenticated, user } = useAuth();
  if (isAuthenticated) return <Navigate to={getDefaultRoute(user?.role)} replace />;
  return <LoginPage />;
}

export default App;
