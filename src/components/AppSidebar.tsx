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
  Sun, Moon, Palette, ChevronDown, ChevronRight,
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

  // Track expanded groups
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    // Auto-expand the group containing the current path
    const initial: Record<string, boolean> = {};
    NAV_SECTIONS.forEach(s => {
      s.items.forEach(item => {
        const match = item.children?.some(c => cleanPath.startsWith(c.path.split('?')[0]));
        if (match) initial[item.path] = true;
      });
    });
    return initial;
  });

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
      className="flex flex-col h-screen sticky top-0 border-r border-sidebar-border z-20 overflow-hidden"
      style={{ background: 'var(--gradient-sidebar)', width: SIDEBAR_WIDTH_EXPANDED }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 border-b border-sidebar-border h-14 flex-shrink-0 px-4">
        <BrandLogo compact />
        <span className="font-display font-bold text-sm text-foreground">LTX</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        {visibleSections.map((section, sIdx) => (
          <div key={section.label}>
            {sIdx > 0 && <div className="h-px bg-sidebar-border/40 mx-2 my-2" />}
            {section.items.map((item) => {
              const hasChildren = item.children && item.children.length > 0;
              const active = hasChildren ? isChildActive(item) : isActive(item.path);
              const expanded = expandedGroups[item.path] ?? active;

              return (
                <div key={item.path} className="mb-0.5">
                  {/* Group header */}
                  <button
                    className={cn(
                      'flex items-center gap-2 w-full rounded-md px-2.5 py-2 text-sm transition-colors',
                      active
                        ? 'text-primary font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent',
                    )}
                    onClick={() => {
                      if (hasChildren) {
                        toggleGroup(item.path);
                        if (!expanded) navigate(item.children![0].path);
                      } else {
                        navigate(item.path);
                      }
                    }}
                  >
                    <item.icon className="w-4 h-4 flex-shrink-0" />
                    <span className="flex-1 text-left truncate">{item.label}</span>
                    {hasChildren && (
                      expanded
                        ? <ChevronDown className="w-3 h-3 text-muted-foreground/50" />
                        : <ChevronRight className="w-3 h-3 text-muted-foreground/50" />
                    )}
                  </button>

                  {/* Children */}
                  {hasChildren && expanded && (
                    <div className="ml-4 pl-2.5 border-l border-sidebar-border/30 space-y-0.5 mt-0.5 mb-1">
                      {item.children!.filter(isItemVisible).map(child => (
                        <button
                          key={child.path}
                          className={cn(
                            'flex items-center gap-2 w-full rounded-md px-2.5 py-1.5 text-xs transition-colors',
                            isActive(child.path)
                              ? 'bg-primary/10 text-primary font-medium'
                              : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent',
                          )}
                          onClick={() => navigate(child.path)}
                        >
                          <child.icon className="w-3.5 h-3.5 flex-shrink-0" />
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
      <div className="border-t border-sidebar-border p-3 flex-shrink-0 space-y-2">
        {/* Theme controls */}
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
          >
            {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* User info */}
        <div className="flex items-center gap-2">
          <img
            src={user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.name}`}
            alt={user?.name}
            className="w-8 h-8 rounded-full border border-sidebar-border flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate text-foreground">{user?.name}</p>
            <p className={cn('text-[10px]', rolePerm ? roleColorClass[rolePerm.color] : 'text-muted-foreground')}>
              {roleLabel}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-1">
          <button
            onClick={() => navigate('/me')}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[11px] text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
          >
            <User className="w-3 h-3" /> Perfil
          </button>
          <button
            onClick={logout}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[11px] text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="w-3 h-3" /> Sair
          </button>
        </div>
      </div>
    </aside>
  );
}
