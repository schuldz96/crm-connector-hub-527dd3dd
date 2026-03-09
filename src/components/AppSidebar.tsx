import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAppConfig } from '@/contexts/AppConfigContext';
import { useRolePermissions } from '@/contexts/RolePermissionsContext';
import { ROLE_LABELS } from '@/types';
import { Badge } from '@/components/ui/badge';
import {
  LayoutDashboard, Video, MessageSquare, Users,
  BarChart3, Zap, ChevronLeft, ChevronRight, TrendingUp,
  LogOut, ChevronDown, Building2, Shield, Plug2,
  GraduationCap, SlidersHorizontal, User, Target, Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
  resource?: string;
}

const NAV_ITEMS: NavItem[] = [
  { path: '/dashboard',    label: 'Dashboard',     icon: LayoutDashboard, resource: 'dashboard' },
  { path: '/meetings',     label: 'Reuniões',       icon: Video,           resource: 'meetings' },
  { path: '/whatsapp',     label: 'WhatsApp',       icon: MessageSquare,   resource: 'whatsapp' },
  { path: '/performance',  label: 'Desempenho',     icon: Activity,        resource: 'performance' },
  { path: '/training',     label: 'Treinamentos',   icon: GraduationCap,   resource: 'training' },
  { path: '/teams',        label: 'Times',          icon: Target,          resource: 'teams' },
  { path: '/users',        label: 'Usuários',       icon: Users,           resource: 'users' },
  { path: '/reports',      label: 'Relatórios',     icon: BarChart3,       resource: 'reports' },
  { path: '/integrations', label: 'Integrações',    icon: Plug2,           resource: 'integrations' },
  { path: '/automations',  label: 'Automações',     icon: Zap,             resource: 'automations' },
  { path: '/ai-config',    label: 'Config. IA',     icon: SlidersHorizontal, resource: 'ai-config' },
  { path: '/admin',        label: 'Admin',          icon: Shield,          resource: 'admin' },
];

export default function AppSidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { user, logout, canAccess } = useAuth();
  const { isModuleEnabledForUser } = useAppConfig();
  const { getPermission } = useRolePermissions();
  const location = useLocation();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  const visibleItems = NAV_ITEMS.filter(item => {
    const moduleId = item.path.replace('/', '') as any;
    const resourceOk = !item.resource || canAccess(item.resource);
    const moduleOk = isModuleEnabledForUser(moduleId, user?.id ?? '', user?.teamId);
    return resourceOk && moduleOk;
  });

  const roleLabel = user?.role ? (ROLE_LABELS[user.role] ?? user.role) : 'Usuário';
  const rolePerm = user?.role ? getPermission(user.role) : undefined;

  // Color badge per role
  const roleColorClass: Record<string, string> = {
    destructive: 'text-destructive',
    primary: 'text-primary',
    accent: 'text-accent',
    warning: 'text-warning',
    success: 'text-success',
    'muted-foreground': 'text-muted-foreground',
  };

  return (
    <aside
      className={cn(
        'flex flex-col h-screen sticky top-0 border-r border-sidebar-border transition-all duration-300 z-20',
        collapsed ? 'w-[68px]' : 'w-[240px]'
      )}
      style={{ background: 'var(--gradient-sidebar)' }}
    >
      {/* Logo */}
      <div className={cn(
        'flex items-center border-b border-sidebar-border h-14 flex-shrink-0',
        collapsed ? 'justify-center px-0' : 'px-4 gap-3'
      )}>
        <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center flex-shrink-0">
          <TrendingUp className="w-4 h-4 text-primary-foreground" />
        </div>
        {!collapsed && (
          <div>
            <span className="font-display font-bold text-foreground text-sm">Appmax</span>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-[10px] text-muted-foreground">Revenue Intelligence</span>
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {!collapsed && (
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-2 mb-2">
            Principal
          </p>
        )}
        {visibleItems.map((item) => (
          <div
            key={item.path}
            className={cn('nav-item', isActive(item.path) && 'active')}
            onClick={() => navigate(item.path)}
            title={collapsed ? item.label : undefined}
          >
            <item.icon className="w-4 h-4 flex-shrink-0" />
            {!collapsed && (
              <>
                <span className="flex-1 truncate">{item.label}</span>
                {item.badge && (
                  <Badge
                    className="h-4 min-w-[18px] px-1 text-[10px] font-bold"
                    style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
                  >
                    {item.badge}
                  </Badge>
                )}
              </>
            )}
          </div>
        ))}
      </nav>

      {/* Profile */}
      <div className="border-t border-sidebar-border p-2 flex-shrink-0">
        <div
          className={cn(
            'flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors hover:bg-sidebar-accent',
            collapsed && 'justify-center'
          )}
          onClick={() => setProfileOpen(o => !o)}
        >
          <img
            src={user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.name}`}
            alt={user?.name}
            className="w-7 h-7 rounded-full border border-sidebar-border flex-shrink-0"
          />
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">{user?.name}</p>
                <p className={cn('text-[10px]', rolePerm ? roleColorClass[rolePerm.color] : 'text-muted-foreground')}>
                  {roleLabel}
                </p>
              </div>
              <ChevronDown className={cn('w-3 h-3 text-muted-foreground transition-transform', profileOpen && 'rotate-180')} />
            </>
          )}
        </div>

        {profileOpen && (
          <div className="mt-1 space-y-0.5 pb-1">
            {!collapsed && (
              <>
                <div className="px-2 py-1.5">
                  <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide font-semibold">
                    {user?.email}
                  </p>
                </div>
                <button
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
                >
                  <User className="w-3 h-3" /> Meu Perfil
                </button>
                <button
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
                >
                  <Building2 className="w-3 h-3" /> {roleLabel}
                </button>
                <div className="h-px bg-sidebar-border mx-2 my-1" />
              </>
            )}
            <button
              onClick={logout}
              className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title={collapsed ? 'Sair da conta' : undefined}
            >
              <LogOut className="w-3 h-3" />
              {!collapsed && 'Sair da conta'}
            </button>
          </div>
        )}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-16 w-6 h-6 rounded-full border border-border bg-secondary flex items-center justify-center hover:bg-muted transition-colors z-10"
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>
    </aside>
  );
}
