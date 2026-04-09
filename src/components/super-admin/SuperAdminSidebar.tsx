import { useNavigate, useLocation } from 'react-router-dom';
import { useSuperAdminAuth } from '@/contexts/SuperAdminAuthContext';
import {
  Shield,
  LayoutDashboard,
  Building2,
  Users,
  CreditCard,
  Receipt,
  BarChart3,
  ToggleLeft,
  FileText,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/super-admin/dashboard' },
  { label: 'Organizações', icon: Building2, path: '/super-admin/organizations' },
  { label: 'Usuários', icon: Users, path: '/super-admin/users' },
  { label: 'Planos', icon: CreditCard, path: '/super-admin/plans' },
  { label: 'Assinaturas', icon: Receipt, path: '/super-admin/subscriptions' },
  { label: 'Uso de Recursos', icon: BarChart3, path: '/super-admin/usage' },
  { label: 'Feature Flags', icon: ToggleLeft, path: '/super-admin/feature-flags' },
  { label: 'Auditoria', icon: FileText, path: '/super-admin/audit' },
  { label: 'Configurações', icon: Settings, path: '/super-admin/settings' },
];

export default function SuperAdminSidebar() {
  const { superAdmin, logout } = useSuperAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <aside className="w-64 border-r border-border bg-card h-screen flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Shield className="w-6 h-6 text-red-500" />
          <span className="font-display font-bold text-lg">LTX Admin</span>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">
          Super Admin Panel
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive =
            location.pathname === item.path ||
            (item.path !== '/super-admin/dashboard' &&
              location.pathname.startsWith(item.path));

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                isActive
                  ? 'bg-red-500/10 text-red-500 font-medium'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer — Admin info + Logout */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0">
            <Shield className="w-3.5 h-3.5 text-red-500" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-foreground truncate">
              {superAdmin?.nome}
            </p>
            <p className="text-[10px] text-muted-foreground truncate">
              {superAdmin?.email}
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            logout();
            navigate('/super-admin/login');
          }}
          className="text-xs text-red-500 hover:underline"
        >
          Sair
        </button>
      </div>
    </aside>
  );
}
