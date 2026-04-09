import { Navigate, Routes, Route } from 'react-router-dom';
import { useSuperAdminAuth } from '@/contexts/SuperAdminAuthContext';
import SuperAdminLayout from './SuperAdminLayout';
import SADashboardPage from '@/pages/super-admin/SADashboardPage';
import SAOrganizationsPage from '@/pages/super-admin/SAOrganizationsPage';
import SAOrgDetailPage from '@/pages/super-admin/SAOrgDetailPage';
import SAUsersPage from '@/pages/super-admin/SAUsersPage';
import SAPlansPage from '@/pages/super-admin/SAPlansPage';
import SASubscriptionsPage from '@/pages/super-admin/SASubscriptionsPage';
import SAUsagePage from '@/pages/super-admin/SAUsagePage';
import SAFeatureFlagsPage from '@/pages/super-admin/SAFeatureFlagsPage';
import SAAuditPage from '@/pages/super-admin/SAAuditPage';
import SASettingsPage from '@/pages/super-admin/SASettingsPage';

export default function SuperAdminProtectedRoutes() {
  const { isAuthenticated, isLoading } = useSuperAdminAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <span className="text-lg font-bold text-red-500 animate-pulse">
          LTX Admin
        </span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/super-admin/login" replace />;
  }

  return (
    <Routes>
      <Route element={<SuperAdminLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<SADashboardPage />} />
        <Route path="organizations" element={<SAOrganizationsPage />} />
        <Route path="organizations/:org" element={<SAOrgDetailPage />} />
        <Route path="users" element={<SAUsersPage />} />
        <Route path="plans" element={<SAPlansPage />} />
        <Route path="subscriptions" element={<SASubscriptionsPage />} />
        <Route path="usage" element={<SAUsagePage />} />
        <Route path="feature-flags" element={<SAFeatureFlagsPage />} />
        <Route path="audit" element={<SAAuditPage />} />
        <Route path="settings" element={<SASettingsPage />} />
      </Route>
    </Routes>
  );
}
