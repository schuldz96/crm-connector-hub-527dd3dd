import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAppConfig } from '@/contexts/AppConfigContext';
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
  roles?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { path: '/dashboard',    label: 'Dashboard',     icon: LayoutDashboard },
  { path: '/meetings',     label: 'Reuniões',       icon: Video,           badge: 3 },
  { path: '/whatsapp',     label: 'WhatsApp',       icon: MessageSquare,   badge: 6 },
  { path: '/performance',  label: 'Desempenho',     icon: Activity },
  { path: '/training',     label: 'Treinamentos',   icon: GraduationCap },
  { path: '/teams',        label: 'Times',          icon: Target,          roles: ['admin', 'director', 'supervisor'] },
  { path: '/users',        label: 'Usuários',       icon: Users,           roles: ['admin', 'director'] },
  { path: '/reports',      label: 'Relatórios',     icon: BarChart3 },
  { path: '/integrations', label: 'Integrações',    icon: Plug2,           roles: ['admin'] },
  { path: '/automations',  label: 'Automações',     icon: Zap,             roles: ['admin'] },
  { path: '/ai-config',    label: 'Config. IA',     icon: SlidersHorizontal, roles: ['admin'] },
  { path: '/admin',        label: 'Admin',          icon: Shield,          roles: ['admin'] },
];

export default function AppSidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { user, logout, hasRole } = useAuth();
  const { isModuleEnabled, isModuleEnabledForUser } = useAppConfig();
  const location = useLocation();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  const visibleItems = NAV_ITEMS.filter(item => {
    const moduleId = item.path.replace('/', '') as any;
    const roleOk = !item.roles || hasRole(item.roles as any[]);
    const moduleOk = isModuleEnabledForUser(moduleId, user?.id ?? '', user?.teamId);
    return roleOk && moduleOk;
  });

  const roleLabels: Record<string, string> = {
    admin: 'Administrador',
    director: 'Diretor',
    supervisor: 'Supervisor',
    member: 'Vendedor',
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
                <p className="text-[10px] text-muted-foreground">{roleLabels[user?.role || 'member']}</p>
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
                  onClick={() => { setProfileOpen(false); }}
                  className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
                >
                  <User className="w-3 h-3" />
                  Meu Perfil
                </button>
                <button
                  onClick={() => { setProfileOpen(false); }}
                  className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
                >
                  <Building2 className="w-3 h-3" />
                  {roleLabels[user?.role || 'member']}
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
