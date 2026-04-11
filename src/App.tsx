import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider, useAuth, getDefaultRoute } from "@/contexts/AuthContext";
import { AppConfigProvider } from "@/contexts/AppConfigContext";
import { RolePermissionsProvider } from "@/contexts/RolePermissionsContext";
import { AuditLogProvider } from "@/contexts/AuditLogContext";
import { NotificationsProvider } from "@/contexts/NotificationsContext";
import { LicenseProvider } from "@/contexts/LicenseContext";
import AppLayout from "@/components/AppLayout";
import RequireRole from "@/components/RequireRole";
import RequireLicense from "@/components/RequireLicense";
import { SuperAdminAuthProvider } from "@/contexts/SuperAdminAuthContext";
import SuperAdminLoginPage from "@/pages/super-admin/SuperAdminLoginPage";
import SuperAdminProtectedRoutes from "@/components/super-admin/SuperAdminProtectedRoutes";
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
import CRMTasksPage from "@/pages/crm/CRMTasksPage";
import CRMFormsPage from "@/pages/crm/CRMFormsPage";
import PublicFormPage from "@/pages/PublicFormPage";
import CRMPipelineSettingsPage from "@/pages/crm/CRMPipelineSettingsPage";
import CRMPropertiesPage from "@/pages/crm/CRMPropertiesPage";
import CRMRecordPage from "@/pages/crm/CRMRecordPage";
import CRMRestorePage from "@/pages/crm/CRMRestorePage";
import CampaignsPage from "@/pages/marketing/CampaignsPage";
import EmailMarketingPage from "@/pages/marketing/EmailMarketingPage";
import FormsPage from "@/pages/marketing/FormsPage";
import HealthScorePage from "@/pages/cs/HealthScorePage";
import OnboardingPage from "@/pages/cs/OnboardingPage";
import NpsSurveysPage from "@/pages/cs/NpsSurveysPage";
import NotFound from "@/pages/NotFound";

import { CONFIG } from '@/lib/config';

// Publishable Google OAuth Client ID (safe to expose in frontend)
export const GOOGLE_CLIENT_ID = CONFIG.GOOGLE_CLIENT_ID;

const queryClient = new QueryClient();

/**
 * R() — atalho para envolver páginas com RequireRole + RequireLicense.
 * resource: verifica cargo (permissoes_papeis)
 * module: verifica licença/plano (plano_features)
 */
const R = (el: React.ReactNode, opts: { resource?: string; minRole?: string; module?: string }) => (
  <RequireRole resource={opts.resource} minRole={opts.minRole as any}>
    <RequireLicense module={opts.module ?? opts.resource}>
      {el}
    </RequireLicense>
  </RequireRole>
);

function LegacyRecordRedirect() {
  const { typeId, numero } = useParams();
  return <Navigate to={`/crm/record/${typeId}/${numero}`} replace />;
}

function ProtectedRoutes() {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <span className="text-lg font-display font-bold text-primary animate-pulse">LTX</span>
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
        <Route path="/teams"        element={<Navigate to="/admin?s=teams" replace />} />
        <Route path="/users"        element={<Navigate to="/admin?s=users-full" replace />} />
        <Route path="/integrations" element={R(<IntegrationsPage />, { resource: 'integrations' })} />
        <Route path="/automations"  element={R(<AutomationsPage />,  { resource: 'automations' })} />
        <Route path="/ai-config"    element={R(<AIConfigPage />,     { resource: 'ai-config' })} />
        <Route path="/admin"        element={R(<AdminPage />,        { resource: 'admin' })} />

        {/* Marketing */}
        <Route path="/marketing/campaigns"      element={R(<CampaignsPage />,      { resource: 'campaigns' })} />
        <Route path="/marketing/email-marketing" element={R(<EmailMarketingPage />, { resource: 'email-marketing' })} />
        <Route path="/marketing/forms"          element={R(<FormsPage />,          { resource: 'forms' })} />

        {/* CS — Customer Success */}
        <Route path="/cs/health-score" element={R(<HealthScorePage />, { resource: 'health-score' })} />
        <Route path="/cs/onboarding"   element={R(<OnboardingPage />,  { resource: 'onboarding' })} />
        <Route path="/cs/nps-surveys"  element={R(<NpsSurveysPage />,  { resource: 'nps-surveys' })} />

        {/* CRM — URLs primárias: /crm/0-{N}/{view} (padrão HubSpot) */}
        <Route path="/crm/0-1"                 element={R(<CRMContactsPage />,         { resource: 'crm' })} />
        <Route path="/crm/0-2"                 element={R(<CRMCompaniesPage />,        { resource: 'crm' })} />
        <Route path="/crm/0-3"                 element={R(<CRMDealsPage />,            { resource: 'crm' })} />
        <Route path="/crm/0-4"                 element={R(<CRMTicketsPage />,          { resource: 'crm' })} />
        <Route path="/crm/tasks"               element={R(<CRMTasksPage />,            { resource: 'crm' })} />
        <Route path="/crm/forms"               element={R(<CRMFormsPage />,            { resource: 'crm' })} />
        <Route path="/crm/0-5"                 element={R(<CRMPropertiesPage />,       { resource: 'crm' })} />
        <Route path="/crm/0-6"                 element={R(<CRMPipelineSettingsPage />, { resource: 'crm' })} />
        <Route path="/crm/restore"                element={R(<CRMRestorePage />,       { resource: 'crm' })} />
        <Route path="/crm/record/:typeId/:numero" element={R(<CRMRecordPage />,       { resource: 'crm' })} />

        {/* CRM — redirects legados para manter compatibilidade */}
        <Route path="/crm/contacts"            element={<Navigate to="/crm/0-1" replace />} />
        <Route path="/crm/companies"           element={<Navigate to="/crm/0-2" replace />} />
        <Route path="/crm/deals"               element={<Navigate to="/crm/0-3" replace />} />
        <Route path="/crm/tickets"             element={<Navigate to="/crm/0-4" replace />} />
        <Route path="/crm/properties"          element={<Navigate to="/crm/0-5" replace />} />
        <Route path="/crm/pipeline-settings"   element={<Navigate to="/crm/0-6" replace />} />
        <Route path="/objects/0-1/views/*"     element={<Navigate to="/crm/0-1" replace />} />
        <Route path="/objects/0-2/views/*"     element={<Navigate to="/crm/0-2" replace />} />
        <Route path="/objects/0-3/views/*"     element={<Navigate to="/crm/0-3" replace />} />
        <Route path="/objects/0-4/views/*"     element={<Navigate to="/crm/0-4" replace />} />
        <Route path="/record/:typeId/:numero"  element={<LegacyRecordRedirect />} />

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
                  <LicenseProvider>
                  <NotificationsProvider>
                    <Routes>
                      {/* Super Admin — independent auth */}
                      <Route path="/super-admin/login" element={
                        <SuperAdminAuthProvider>
                          <SuperAdminLoginPage />
                        </SuperAdminAuthProvider>
                      } />
                      <Route path="/super-admin/*" element={
                        <SuperAdminAuthProvider>
                          <SuperAdminProtectedRoutes />
                        </SuperAdminAuthProvider>
                      } />

                      {/* Public routes */}
                      <Route path="/login"                element={<LoginPageWrapper />} />
                      <Route path="/auth/google/callback" element={<GoogleCallbackPage />} />
                      <Route path="/f/:slug" element={<PublicFormPage />} />
                      {/* Protected routes */}
                      <Route path="/*" element={<ProtectedRoutes />} />
                    </Routes>
                  </NotificationsProvider>
                  </LicenseProvider>
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
