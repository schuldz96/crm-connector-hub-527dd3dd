import { useState } from 'react';
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
  Puzzle,
  FileText,
  Settings,
  KanbanSquare,
  LogOut,
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
  { label: 'Módulos', icon: Puzzle, path: '/super-admin/modules' },
  { label: 'Backlog Board', icon: KanbanSquare, path: '/super-admin/backlog' },
  { label: 'Auditoria', icon: FileText, path: '/super-admin/audit' },
  { label: 'Configurações', icon: Settings, path: '/super-admin/settings' },
];

export default function SuperAdminSidebar() {
  const { superAdmin, logout } = useSuperAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [expanded, setExpanded] = useState(false);

  return (
    <aside
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      className={cn(
        'border-r border-border bg-card h-screen flex flex-col transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0',
        expanded ? 'w-64' : 'w-16'
      )}
    >
      {/* Header */}
      <div className="border-b border-border min-h-[60px] flex items-center px-0">
        <div className="w-16 flex items-center justify-center flex-shrink-0">
          <Shield className="w-6 h-6 text-red-500" />
        </div>
        <div
          className={cn(
            'overflow-hidden whitespace-nowrap transition-all duration-300',
            expanded ? 'opacity-100 max-w-[180px]' : 'opacity-0 max-w-0'
          )}
        >
          <span className="font-display font-bold text-lg">LTX Admin</span>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Super Admin Panel
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-2 space-y-1 overflow-y-auto overflow-x-hidden">
        {NAV_ITEMS.map((item) => {
          const isActive =
            location.pathname === item.path ||
            (item.path !== '/super-admin/dashboard' &&
              location.pathname.startsWith(item.path));

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              title={!expanded ? item.label : undefined}
              className={cn(
                'w-full flex items-center rounded-none text-sm transition-colors',
                isActive
                  ? 'bg-red-500/10 text-red-500 font-medium'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <div className="w-16 h-9 flex items-center justify-center flex-shrink-0">
                <item.icon className="w-4 h-4" />
              </div>
              <span
                className={cn(
                  'whitespace-nowrap overflow-hidden transition-all duration-300',
                  expanded ? 'opacity-100 max-w-[180px]' : 'opacity-0 max-w-0'
                )}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Footer — Admin info + Logout */}
      <div className="border-t border-border py-2">
        <div className="flex items-center">
          <div className="w-16 flex items-center justify-center flex-shrink-0">
            <div className="w-7 h-7 rounded-full bg-red-500/10 flex items-center justify-center">
              <Shield className="w-3.5 h-3.5 text-red-500" />
            </div>
          </div>
          <div
            className={cn(
              'min-w-0 overflow-hidden transition-all duration-300',
              expanded ? 'opacity-100 max-w-[180px]' : 'opacity-0 max-w-0'
            )}
          >
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
          title={!expanded ? 'Sair' : undefined}
          className="w-full flex items-center text-xs text-red-500 hover:underline mt-1"
        >
          <div className="w-16 flex items-center justify-center flex-shrink-0">
            <LogOut className="w-3.5 h-3.5" />
          </div>
          <span
            className={cn(
              'whitespace-nowrap overflow-hidden transition-all duration-300',
              expanded ? 'opacity-100 max-w-[180px]' : 'opacity-0 max-w-0'
            )}
          >
            Sair
          </span>
        </button>
      </div>
    </aside>
  );
}
