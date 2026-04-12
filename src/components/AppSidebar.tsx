import { useState } from 'react';
import type { ElementType } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useOrgNavigate, usePathWithoutOrg } from '@/hooks/useOrgNavigate';
import { useAppConfig } from '@/contexts/AppConfigContext';
import { useRolePermissions } from '@/contexts/RolePermissionsContext';
import { useLicense } from '@/contexts/LicenseContext';
import { useTheme } from '@/contexts/ThemeContext';
import type { AccentColor } from '@/contexts/ThemeContext';
import { ROLE_LABELS } from '@/types';
import BrandLogo from '@/components/BrandLogo';
import {
  LayoutDashboard, Video, MessageSquare, Users, Bell,
  LogOut, Shield, Plug2,
  GraduationCap, SlidersHorizontal, User, Target, Activity, Inbox,
  Contact, Briefcase, Ticket, Factory, List,
  ClipboardCheck, TrendingUp, Headphones, Megaphone, Mail, FileText, CheckSquare, Globe,
  ShoppingCart, HeartPulse, Rocket, Star,
  DollarSign, BarChart3, PieChart, Settings,
  Sun, Moon, Palette, ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ── Types ─────────────────────────────────────────────────────────── */

interface NavItem {
  path: string;
  label: string;
  icon: ElementType;
  resource?: string;
  children?: NavItem[];
}

interface NavSection {
  label: string;
  items: NavItem[];
}

/* ── Navigation data ───────────────────────────────────────────────── */

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Auditoria',
    items: [
      {
        path: '/audit',
        label: 'Auditoria',
        icon: ClipboardCheck,
        resource: 'dashboard',
        children: [
          { path: '/dashboard',   label: 'Dashboard',  icon: LayoutDashboard, resource: 'dashboard' },
          { path: '/meetings',    label: 'Reuniões',    icon: Video,           resource: 'meetings' },
          { path: '/whatsapp',    label: 'WhatsApp',    icon: MessageSquare,   resource: 'whatsapp' },
          { path: '/training',    label: 'Treinamentos', icon: GraduationCap,  resource: 'training' },
        ],
      },
    ],
  },
  {
    label: 'CRM',
    items: [
      {
        path: '/crm',
        label: 'CRM',
        icon: Briefcase,
        resource: 'crm',
        children: [
          { path: '/crm/0-1', label: 'Contatos',     icon: Contact,   resource: 'crm' },
          { path: '/crm/0-2', label: 'Empresas',     icon: Factory,   resource: 'crm' },
          { path: '/crm/0-3', label: 'Negócios',     icon: Briefcase, resource: 'crm' },
          { path: '/crm/0-4', label: 'Tickets',      icon: Ticket,    resource: 'crm' },
          { path: '/crm/tasks', label: 'Tarefas',      icon: CheckSquare, resource: 'crm' },
          { path: '/crm/forms', label: 'Formulários', icon: FileText,   resource: 'crm' },
          { path: '/crm/0-5', label: 'Propriedades',  icon: List,       resource: 'crm' },
        ],
      },
    ],
  },
  {
    label: 'REVops',
    items: [
      {
        path: '/revops',
        label: 'REVops',
        icon: TrendingUp,
        resource: 'dashboard',
        children: [
          { path: '/reports',      label: 'Relatórios',  icon: BarChart3,   resource: 'reports' },
          { path: '/performance',  label: 'Performance',  icon: TrendingUp,  resource: 'performance' },
        ],
      },
    ],
  },
  {
    label: 'Atendimento',
    items: [
      {
        path: '/service',
        label: 'Atendimento',
        icon: Headphones,
        resource: 'whatsapp',
        children: [
          { path: '/whatsapp', label: 'WhatsApp',         icon: MessageSquare, resource: 'whatsapp' },
          { path: '/inbox',    label: 'Caixa de Entrada', icon: Inbox,         resource: 'inbox' },
        ],
      },
    ],
  },
  {
    label: 'Marketing',
    items: [
      {
        path: '/marketing',
        label: 'Marketing',
        icon: Megaphone,
        resource: 'campaigns',
        children: [
          { path: '/marketing/campaigns',      label: 'Campanhas',        icon: Megaphone, resource: 'campaigns' },
          { path: '/marketing/email-marketing', label: 'E-mail Marketing', icon: Mail,      resource: 'email-marketing' },
          { path: '/crm/forms',                label: 'Formulários',      icon: FileText,  resource: 'crm' },
          { path: '/crm/landing-pages',        label: 'Landing Pages',    icon: Globe,     resource: 'crm' },
        ],
      },
    ],
  },
  {
    label: 'CS',
    items: [
      {
        path: '/cs',
        label: 'CS',
        icon: HeartPulse,
        resource: 'health-score',
        children: [
          { path: '/cs/health-score', label: 'Health Score',  icon: HeartPulse, resource: 'health-score' },
          { path: '/cs/onboarding',   label: 'Onboarding',    icon: Rocket,     resource: 'onboarding' },
          { path: '/cs/nps-surveys',  label: 'Pesquisas NPS', icon: Star,       resource: 'nps-surveys' },
        ],
      },
    ],
  },
  {
    label: 'Sistema',
    items: [
      {
        path: '/system',
        label: 'Sistema',
        icon: Settings,
        resource: 'admin',
        children: [
          { path: '/admin?s=company', label: 'Admin',        icon: Shield,            resource: 'admin' },
          { path: '/integrations',    label: 'Integrações',  icon: Plug2,             resource: 'integrations' },
          { path: '/automations',     label: 'Automações',   icon: Bell,              resource: 'automations' },
          { path: '/ai-config',       label: 'Config. IA',   icon: SlidersHorizontal, resource: 'ai-config' },
        ],
      },
    ],
  },
];

const SIDEBAR_WIDTH_COLLAPSED = 60;
const SIDEBAR_WIDTH_EXPANDED = 220;

/* ── Component ─────────────────────────────────────────────────────── */

export default function AppSidebar() {
  const { user, logout, canAccess } = useAuth();
  const { isModuleEnabledForUser, configLoaded } = useAppConfig();
  const { getPermission } = useRolePermissions();
  const { canAccessModule, loaded: licenseLoaded } = useLicense();
  const { mode, accent, setMode, setAccent, isDark } = useTheme();
  const location = useLocation();
  const navigate = useOrgNavigate();
  const cleanPath = usePathWithoutOrg();

  // Hover-to-expand sidebar inteira
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  // Grupos começam fechados; abrem apenas via click no chevron
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (path: string) => {
    setExpandedGroups(prev => ({ ...prev, [path]: !prev[path] }));
  };

  const isActive = (path: string) => cleanPath === path.split('?')[0];
  const isChildActive = (item: NavItem) => item.children?.some(c => cleanPath.startsWith(c.path.split('?')[0])) ?? false;

  const normalizedUserId = (user?.id ?? '').replace(/^google_/, 'user_');

  const isItemVisible = (item: NavItem): boolean => {
    const moduleId = item.path.split('?')[0].replace(/^\//, '').replace(/\//g, '-') as any;
    const resourceOk = !item.resource || canAccess(item.resource);
    const moduleOk = isModuleEnabledForUser(moduleId, normalizedUserId, user?.teamId);
    const licenseOk = !item.resource || canAccessModule(item.resource);
    return resourceOk && moduleOk && licenseOk;
  };

  const visibleSections = (configLoaded && licenseLoaded) ? NAV_SECTIONS.map(section => ({
    ...section,
    items: section.items.filter(item => {
      if (item.children) return item.children.some(child => isItemVisible(child));
      return isItemVisible(item);
    }),
  })).filter(section => section.items.length > 0) : [];

  const roleLabel = user?.role ? (ROLE_LABELS[user.role] ?? user.role) : 'Usuário';
  const rolePerm = user?.role ? getPermission(user.role) : undefined;
  const roleColorClass: Record<string, string> = {
    destructive: 'text-destructive', primary: 'text-primary',
    accent: 'text-accent', warning: 'text-warning',
    success: 'text-success', 'muted-foreground': 'text-muted-foreground',
  };

  return (
    <aside
      onMouseEnter={() => setSidebarExpanded(true)}
      onMouseLeave={() => setSidebarExpanded(false)}
      className="flex flex-col h-screen sticky top-0 border-r border-sidebar-border z-20 overflow-hidden transition-[width] duration-300 ease-in-out"
      style={{ background: 'var(--gradient-sidebar)', width: sidebarExpanded ? SIDEBAR_WIDTH_EXPANDED : SIDEBAR_WIDTH_COLLAPSED }}
    >
      {/* Logo */}
      <div className="flex items-center border-b border-sidebar-border h-14 flex-shrink-0">
        <div className="w-[60px] flex items-center justify-center flex-shrink-0">
          <BrandLogo compact />
        </div>
        <span
          className={cn(
            'font-display font-bold text-sm text-foreground whitespace-nowrap overflow-hidden transition-all duration-300',
            sidebarExpanded ? 'opacity-100 max-w-[140px]' : 'opacity-0 max-w-0',
          )}
        >
          LTX
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2">
        {visibleSections.map((section, sIdx) => (
          <div key={section.label}>
            {sIdx > 0 && <div className="h-px bg-sidebar-border/40 mx-3 my-2" />}
            {section.items.map((item) => {
              const hasChildren = item.children && item.children.length > 0;
              const active = hasChildren ? isChildActive(item) : isActive(item.path);
              const groupOpen = expandedGroups[item.path] ?? false;

              return (
                <div key={item.path} className="mb-0.5">
                  {/* Group header */}
                  <button
                    title={!sidebarExpanded ? item.label : undefined}
                    className={cn(
                      'flex items-center w-full rounded-none text-sm transition-colors',
                      active
                        ? 'bg-primary/15 text-primary font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent',
                    )}
                    onClick={() => {
                      if (hasChildren) {
                        if (sidebarExpanded) {
                          toggleGroup(item.path);
                        } else {
                          navigate(item.children![0].path);
                        }
                      } else {
                        navigate(item.path);
                      }
                    }}
                  >
                    <div className="w-[60px] h-10 flex items-center justify-center flex-shrink-0">
                      <item.icon className="w-4 h-4" />
                    </div>
                    <span
                      className={cn(
                        'flex-1 text-left whitespace-nowrap overflow-hidden transition-all duration-300',
                        sidebarExpanded ? 'opacity-100 max-w-[140px]' : 'opacity-0 max-w-0',
                      )}
                    >
                      {item.label}
                    </span>
                    {hasChildren && (
                      <ChevronDown
                        className={cn(
                          'w-3.5 h-3.5 text-muted-foreground/60 mr-3 flex-shrink-0 transition-all duration-300',
                          sidebarExpanded ? 'opacity-100' : 'opacity-0 mr-0',
                          groupOpen ? 'rotate-180' : 'rotate-0',
                        )}
                      />
                    )}
                  </button>

                  {/* Children — só quando sidebar e group expandidos */}
                  {sidebarExpanded && hasChildren && groupOpen && (
                    <div className="ml-[44px] mr-2 my-1 pl-3 border-l border-sidebar-border/60 space-y-0.5 animate-in fade-in-0 slide-in-from-top-1 duration-200">
                      {item.children!.filter(isItemVisible).map(child => (
                        <button
                          key={child.path}
                          className={cn(
                            'flex items-center gap-2.5 w-full rounded-md px-3 py-2 text-sm transition-colors',
                            isActive(child.path)
                              ? 'bg-primary/10 text-primary font-medium'
                              : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent',
                          )}
                          onClick={() => navigate(child.path)}
                        >
                          <child.icon className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate">{child.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Profile + Theme */}
      <div className="border-t border-sidebar-border flex-shrink-0">
        {/* User info */}
        <button
          onClick={() => navigate('/me')}
          className="w-full flex items-center transition-colors hover:bg-sidebar-accent py-2"
        >
          <div className="w-[60px] h-8 flex items-center justify-center flex-shrink-0">
            <img
              src={user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.name}`}
              alt={user?.name}
              className="w-8 h-8 rounded-full border border-sidebar-border"
            />
          </div>
          <div
            className={cn(
              'flex-1 min-w-0 text-left overflow-hidden transition-all duration-300',
              sidebarExpanded ? 'opacity-100 max-w-[140px]' : 'opacity-0 max-w-0',
            )}
          >
            <p className="text-xs font-medium truncate text-foreground">{user?.name}</p>
            <p className={cn('text-[10px] truncate', rolePerm ? roleColorClass[rolePerm.color] : 'text-muted-foreground')}>
              {roleLabel}
            </p>
          </div>
        </button>

        {/* Expanded-only: theme + actions */}
        {sidebarExpanded && (
          <div className="px-3 pb-3 space-y-2 animate-in fade-in-0 duration-200">
            <div className="flex items-center justify-between">
              <div className="flex gap-1">
                {(['indigo', 'blue', 'green', 'red', 'orange', 'pink', 'violet'] as AccentColor[]).map(c => (
                  <button key={c} onClick={() => setAccent(c)}
                    className={cn('w-4 h-4 rounded-full border transition-all', accent === c ? 'border-foreground scale-110' : 'border-transparent')}
                    style={{ backgroundColor: `hsl(${{'indigo':'234 89% 74%','blue':'217 91% 60%','green':'142 76% 36%','red':'0 84% 60%','orange':'25 95% 53%','pink':'330 81% 60%','violet':'263 70% 50%'}[c]})` }}
                  />
                ))}
              </div>
              <button
                onClick={() => setMode(isDark ? 'light' : 'dark')}
                className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                title={isDark ? 'Modo claro' : 'Modo escuro'}
              >
                {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              </button>
            </div>
            <button
              onClick={logout}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[11px] text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="w-3 h-3" /> Sair da conta
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
