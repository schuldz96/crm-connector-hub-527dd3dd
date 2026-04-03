import { useState, useRef, useCallback } from 'react';
import type { ElementType } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAppConfig } from '@/contexts/AppConfigContext';
import { useRolePermissions } from '@/contexts/RolePermissionsContext';
import { ROLE_LABELS } from '@/types';
import { Badge } from '@/components/ui/badge';
import BrandLogo from '@/components/BrandLogo';
import {
  LayoutDashboard, Video, MessageSquare, Users, Bell,
  BarChart3, Zap, ChevronLeft, ChevronRight,
  LogOut, ChevronDown, Building2, Shield, Plug2,
  GraduationCap, SlidersHorizontal, User, Target, Activity, Inbox,
  Contact, Briefcase, Ticket, Factory, List,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  path: string;
  label: string;
  icon: ElementType;
  badge?: number;
  resource?: string;
  children?: NavItem[];
}

const NAV_ITEMS: NavItem[] = [
  { path: '/dashboard',    label: 'Dashboard',       icon: LayoutDashboard, resource: 'dashboard' },
  { path: '/meetings',     label: 'Reuniões',         icon: Video,           resource: 'meetings' },
  { path: '/whatsapp',     label: 'WhatsApp',         icon: MessageSquare,   resource: 'whatsapp' },
  { path: '/inbox',        label: 'Caixa de Entrada', icon: Inbox,           resource: 'inbox' },
  { path: '/performance',  label: 'Desempenho',       icon: Activity,        resource: 'performance' },
  { path: '/training',     label: 'Treinamentos',     icon: GraduationCap,   resource: 'training' },
  {
    path: '/crm',
    label: 'CRM',
    icon: Briefcase,
    resource: 'crm',
    children: [
      { path: '/crm/0-1',  label: 'Contatos',      icon: Contact,   resource: 'crm' },
      { path: '/crm/0-2',  label: 'Empresas',      icon: Factory,   resource: 'crm' },
      { path: '/crm/0-3',  label: 'Negócios',      icon: Briefcase, resource: 'crm' },
      { path: '/crm/0-4',  label: 'Tickets',       icon: Ticket,    resource: 'crm' },
      { path: '/crm/0-5',  label: 'Propriedades',  icon: List,      resource: 'crm' },
    ],
  },
  { path: '/teams',        label: 'Times',            icon: Target,          resource: 'teams' },
  { path: '/users',        label: 'Usuários',         icon: Users,           resource: 'users' },
  { path: '/integrations', label: 'Integrações',      icon: Plug2,           resource: 'integrations' },
  { path: '/automations',  label: 'Automações',       icon: Bell,            resource: 'automations' },
  { path: '/ai-config',    label: 'Config. IA',       icon: SlidersHorizontal, resource: 'ai-config' },
  { path: '/admin?s=company', label: 'Admin',          icon: Shield,          resource: 'admin' },
];

export default function AppSidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { user, logout, canAccess } = useAuth();
  const { isModuleEnabledForUser, configLoaded } = useAppConfig();
  const { getPermission } = useRolePermissions();
  const location = useLocation();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [hoverItem, setHoverItem] = useState<string | null>(null);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = useCallback((path: string) => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    setHoverItem(path);
  }, []);
  const handleMouseLeave = useCallback(() => {
    hoverTimeout.current = setTimeout(() => setHoverItem(null), 150);
  }, []);

  const isActive = (path: string) => location.pathname === path.split('?')[0];
  const isChildActive = (item: NavItem) =>
    item.children?.some(c => location.pathname.startsWith(c.path)) ?? false;

  // Normalize user ID: google_email → user_email (DB stores as user_)
  const normalizedUserId = (user?.id ?? '').replace(/^google_/, 'user_');

  // Don't render nav items until config is loaded (prevents flash of unauthorized items)
  const CRM_ALLOWED_EMAILS = ['marcos.schuldz@appmax.com.br', 'yuri.santos@appmax.com.br', 'leonardo.machado@appmax.com.br'];
  const visibleItems = configLoaded ? NAV_ITEMS.filter(item => {
    const moduleId = item.path.split('?')[0].replace('/', '') as any;
    // CRM: acesso exclusivo por email
    if (item.resource === 'crm' && !CRM_ALLOWED_EMAILS.includes(user?.email?.toLowerCase() || '')) return false;
    const resourceOk = !item.resource || canAccess(item.resource);
    const moduleOk = isModuleEnabledForUser(moduleId, normalizedUserId, user?.teamId);
    return resourceOk && moduleOk;
  }) : [];

  const toggleGroup = (path: string) => {
    setExpandedGroups(prev => ({ ...prev, [path]: !prev[path] }));
  };

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
        <BrandLogo compact={collapsed} />
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {!collapsed && (
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-2 mb-2">
            Principal
          </p>
        )}
        {visibleItems.map((item) => {
          const hasChildren = item.children && item.children.length > 0;
          const isHovered = hoverItem === item.path;

          // Items with children — hover flyout
          if (hasChildren) {
            const isOpen = expandedGroups[item.path] ?? isChildActive(item);
            return (
              <div
                key={item.path}
                className="relative"
                onMouseEnter={() => handleMouseEnter(item.path)}
                onMouseLeave={handleMouseLeave}
              >
                <div
                  className={cn('nav-item', isChildActive(item) && 'active')}
                  onClick={() => {
                    if (collapsed) {
                      navigate(item.children![0].path);
                    } else {
                      toggleGroup(item.path);
                    }
                  }}
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  {!collapsed && (
                    <>
                      <span className="flex-1 truncate">{item.label}</span>
                      <ChevronDown className={cn(
                        'w-3 h-3 text-muted-foreground transition-transform',
                        isOpen && 'rotate-180'
                      )} />
                    </>
                  )}
                </div>

                {/* Flyout popup on hover */}
                {isHovered && collapsed && (
                  <div
                    className="absolute left-full top-0 ml-2 z-50 min-w-[180px] py-2 rounded-lg border border-border bg-card shadow-xl"
                    onMouseEnter={() => handleMouseEnter(item.path)}
                    onMouseLeave={handleMouseLeave}
                  >
                    <p className="text-xs font-semibold text-foreground px-3 pb-1.5 border-b border-border mb-1">{item.label}</p>
                    {item.children!.map((child) => (
                      <button
                        key={child.path}
                        className={cn(
                          'flex items-center gap-2 w-full px-3 py-1.5 text-xs transition-colors',
                          isActive(child.path)
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                        )}
                        onClick={() => { navigate(child.path); setHoverItem(null); }}
                      >
                        <child.icon className="w-3.5 h-3.5" />
                        {child.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Expanded children (when sidebar is open) */}
                {!collapsed && isOpen && (
                  <div className="ml-4 pl-2 border-l border-sidebar-border/50 space-y-0.5 mt-0.5">
                    {item.children!.map((child) => (
                      <div
                        key={child.path}
                        className={cn('nav-item text-[13px]', isActive(child.path) && 'active')}
                        onClick={() => navigate(child.path)}
                      >
                        <child.icon className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="flex-1 truncate">{child.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          // Regular items — hover tooltip when collapsed
          return (
            <div
              key={item.path}
              className="relative"
              onMouseEnter={() => collapsed ? handleMouseEnter(item.path) : undefined}
              onMouseLeave={() => collapsed ? handleMouseLeave() : undefined}
            >
              <div
                className={cn('nav-item', isActive(item.path) && 'active')}
                onClick={() => navigate(item.path)}
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
              {/* Tooltip on hover when collapsed */}
              {isHovered && collapsed && (
                <div
                  className="absolute left-full top-0 ml-2 z-50 px-3 py-1.5 rounded-md border border-border bg-card shadow-lg text-xs font-medium text-foreground whitespace-nowrap"
                  onMouseEnter={() => handleMouseEnter(item.path)}
                  onMouseLeave={handleMouseLeave}
                >
                  {item.label}
                </div>
              )}
            </div>
          );
        })}
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
                  onClick={() => {
                    setProfileOpen(false);
                    navigate('/users');
                  }}
                  className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
                >
                  <User className="w-3 h-3" /> Meu Perfil
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
