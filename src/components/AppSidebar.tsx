import { useState, useRef, useCallback } from 'react';
import type { ElementType } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAppConfig } from '@/contexts/AppConfigContext';
import { useRolePermissions } from '@/contexts/RolePermissionsContext';
import { useLicense } from '@/contexts/LicenseContext';
import { ROLE_LABELS } from '@/types';
import BrandLogo from '@/components/BrandLogo';
import {
  LayoutDashboard, Video, MessageSquare, Users, Bell,
  LogOut, Shield, Plug2,
  GraduationCap, SlidersHorizontal, User, Target, Activity, Inbox,
  Contact, Briefcase, Ticket, Factory, List,
  ClipboardCheck, TrendingUp, Headphones, Megaphone, Mail, FileText,
  ShoppingCart, HeartPulse, Rocket, Star,
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
          { path: '/performance', label: 'Desempenho',  icon: Activity,        resource: 'performance' },
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
          { path: '/crm/0-5', label: 'Propriedades', icon: List,      resource: 'crm' },
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
        resource: 'integrations',
        children: [
          { path: '/integrations', label: 'Integrações', icon: Plug2,             resource: 'integrations' },
          { path: '/automations',  label: 'Automações',  icon: Bell,              resource: 'automations' },
          { path: '/ai-config',    label: 'Config. IA',  icon: SlidersHorizontal, resource: 'ai-config' },
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
          { path: '/marketing/forms',          label: 'Formulários',      icon: FileText,  resource: 'forms' },
        ],
      },
    ],
  },
  {
    label: 'Vendas',
    items: [
      {
        path: '/sales',
        label: 'Vendas',
        icon: ShoppingCart,
        resource: 'meetings',
        children: [
          { path: '/training', label: 'Treinamentos',  icon: GraduationCap, resource: 'training' },
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
      { path: '/admin?s=company', label: 'Admin',    icon: Shield, resource: 'admin' },
    ],
  },
];

const SIDEBAR_WIDTH = 60;

/* ── Component ─────────────────────────────────────────────────────── */

export default function AppSidebar() {
  const { user, logout, canAccess } = useAuth();
  const { isModuleEnabledForUser, configLoaded } = useAppConfig();
  const { getPermission } = useRolePermissions();
  const { canAccessModule, loaded: licenseLoaded } = useLicense();
  const location = useLocation();
  const navigate = useNavigate();

  // Hover state: which item path is hovered + its rect for flyout positioning
  const [hoverItem, setHoverItem] = useState<string | null>(null);
  const [hoverRect, setHoverRect] = useState<DOMRect | null>(null);
  const [profileHover, setProfileHover] = useState(false);
  const [profileRect, setProfileRect] = useState<DOMRect | null>(null);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const profileTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = useCallback((path: string, el: HTMLElement) => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    setHoverItem(path);
    setHoverRect(el.getBoundingClientRect());
  }, []);
  const handleMouseLeave = useCallback(() => {
    hoverTimeout.current = setTimeout(() => { setHoverItem(null); setHoverRect(null); }, 150);
  }, []);
  const handleFlyoutEnter = useCallback(() => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
  }, []);

  const handleProfileEnter = useCallback((el: HTMLElement) => {
    if (profileTimeout.current) clearTimeout(profileTimeout.current);
    setProfileHover(true);
    setProfileRect(el.getBoundingClientRect());
  }, []);
  const handleProfileLeave = useCallback(() => {
    profileTimeout.current = setTimeout(() => { setProfileHover(false); setProfileRect(null); }, 150);
  }, []);
  const handleProfileFlyoutEnter = useCallback(() => {
    if (profileTimeout.current) clearTimeout(profileTimeout.current);
  }, []);

  const isActive = (path: string) => location.pathname === path.split('?')[0];
  const isChildActive = (item: NavItem) =>
    item.children?.some(c => location.pathname.startsWith(c.path)) ?? false;

  const normalizedUserId = (user?.id ?? '').replace(/^google_/, 'user_');

  const isItemVisible = (item: NavItem): boolean => {
    const moduleId = item.path.split('?')[0].replace(/^\//, '').replace(/\//g, '-') as any;
    const resourceOk = !item.resource || canAccess(item.resource);
    const moduleOk = isModuleEnabledForUser(moduleId, normalizedUserId, user?.teamId);
    // License check: module must be enabled in the org's plan
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

  // Find the currently hovered item data for the flyout
  const hoveredItemData = hoverItem
    ? visibleSections.flatMap(s => s.items).find(i => i.path === hoverItem)
    : null;

  return (
    <>
      <aside
        className="flex flex-col h-screen sticky top-0 border-r border-sidebar-border z-20"
        style={{ background: 'var(--gradient-sidebar)', width: SIDEBAR_WIDTH }}
      >
        {/* Logo */}
        <div className="flex items-center justify-center border-b border-sidebar-border h-14 flex-shrink-0">
          <BrandLogo compact />
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2 px-1.5 space-y-0.5">
          {visibleSections.map((section, sIdx) => (
            <div key={section.label}>
              {sIdx > 0 && (
                <div className="h-px bg-sidebar-border/40 mx-1.5 my-1.5" />
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const hasChildren = item.children && item.children.length > 0;
                  const active = hasChildren ? isChildActive(item) : isActive(item.path);

                  return (
                    <div
                      key={item.path}
                      onMouseEnter={(e) => handleMouseEnter(item.path, e.currentTarget)}
                      onMouseLeave={handleMouseLeave}
                    >
                      <div
                        className={cn(
                          'flex items-center justify-center w-[44px] h-[44px] mx-auto rounded-lg cursor-pointer transition-colors',
                          active
                            ? 'bg-primary/15 text-primary'
                            : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
                        )}
                        onClick={() => {
                          if (hasChildren) navigate(item.children![0].path);
                          else navigate(item.path);
                        }}
                      >
                        <item.icon className="w-5 h-5" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Profile */}
        <div
          className="border-t border-sidebar-border p-2 flex-shrink-0"
          onMouseEnter={(e) => handleProfileEnter(e.currentTarget)}
          onMouseLeave={handleProfileLeave}
        >
          <div className="flex items-center justify-center p-1.5 rounded-lg cursor-pointer transition-colors hover:bg-sidebar-accent">
            <img
              src={user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.name}`}
              alt={user?.name}
              className="w-8 h-8 rounded-full border border-sidebar-border flex-shrink-0"
            />
          </div>
        </div>
      </aside>

      {/* ── Flyout portals (rendered outside sidebar to avoid overflow clip) ── */}

      {/* Nav flyout */}
      {hoveredItemData && hoverRect && hoveredItemData.children && createPortal(
        <div
          className="fixed z-[9999] min-w-[200px] py-2 rounded-lg border border-border bg-card shadow-xl animate-in fade-in-0 zoom-in-95 duration-100"
          style={{ left: SIDEBAR_WIDTH + 8, top: hoverRect.top }}
          onMouseEnter={handleFlyoutEnter}
          onMouseLeave={handleMouseLeave}
        >
          <p className="text-xs font-semibold text-foreground px-4 pb-2 border-b border-border mb-1">
            {hoveredItemData.label}
          </p>
          {hoveredItemData.children.map((child) => (
            <button
              key={child.path}
              className={cn(
                'flex items-center gap-2.5 w-full px-4 py-2 text-sm transition-colors',
                isActive(child.path)
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
              onClick={() => { navigate(child.path); setHoverItem(null); }}
            >
              <child.icon className="w-4 h-4" />
              {child.label}
            </button>
          ))}
        </div>,
        document.body,
      )}

      {/* Tooltip for items without children */}
      {hoveredItemData && hoverRect && !hoveredItemData.children && createPortal(
        <div
          className="fixed z-[9999] px-3 py-1.5 rounded-md border border-border bg-card shadow-lg text-xs font-medium text-foreground whitespace-nowrap"
          style={{ left: SIDEBAR_WIDTH + 8, top: hoverRect.top + hoverRect.height / 2, transform: 'translateY(-50%)' }}
          onMouseEnter={handleFlyoutEnter}
          onMouseLeave={handleMouseLeave}
        >
          {hoveredItemData.label}
        </div>,
        document.body,
      )}

      {/* Profile flyout */}
      {profileHover && profileRect && createPortal(
        <div
          className="fixed z-[9999] min-w-[200px] py-2 rounded-lg border border-border bg-card shadow-xl"
          style={{ left: SIDEBAR_WIDTH + 8, bottom: 8 }}
          onMouseEnter={handleProfileFlyoutEnter}
          onMouseLeave={handleProfileLeave}
        >
          <div className="px-4 pb-2 border-b border-border mb-1">
            <p className="text-sm font-semibold text-foreground truncate">{user?.name}</p>
            <p className={cn('text-xs', rolePerm ? roleColorClass[rolePerm.color] : 'text-muted-foreground')}>
              {roleLabel}
            </p>
            <p className="text-[10px] text-muted-foreground/60 truncate mt-0.5">{user?.email}</p>
          </div>
          <button
            onClick={() => { navigate('/me'); setProfileHover(false); }}
            className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <User className="w-4 h-4" /> Meu Perfil
          </button>
          <button
            onClick={logout}
            className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="w-4 h-4" /> Sair da conta
          </button>
        </div>,
        document.body,
      )}
    </>
  );
}
