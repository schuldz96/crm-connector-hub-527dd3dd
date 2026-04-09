import { Outlet } from 'react-router-dom';
import SuperAdminSidebar from './SuperAdminSidebar';

export default function SuperAdminLayout() {
  return (
    <div className="flex h-screen bg-background">
      <SuperAdminSidebar />
      <main className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
