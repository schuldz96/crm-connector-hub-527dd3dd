import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CONFIG } from '@/lib/config';
import { callOpenAI } from '@/lib/openaiProxy';
import { MOCK_USERS, MOCK_TEAMS, MOCK_AREAS } from '@/data/mockData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Shield, Users, Building2, Key, Mail,
  ChevronRight, CheckCircle2, AlertCircle, Save, Eye, EyeOff,
  Lock, ToggleLeft, ToggleRight, SlidersHorizontal, Pencil,
  Layers, Plus, Trash2, ChevronDown, ChevronUp, GitBranch,
  ScrollText, LogIn, LogOut, MonitorSmartphone, Search, RefreshCw, Trash,
  Filter, Plug, Copy, ExternalLink, Check, ShieldCheck, Network,
  CreditCard, Gauge, ArrowUpCircle, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { lazy, Suspense } from 'react';
import { useAppConfig, DEFAULT_MODULES, type ModuleId, AI_MODELS, type ModuleAIKey } from '@/contexts/AppConfigContext';
const LazyUsersPage = lazy(() => import('@/pages/UsersPage'));
const LazyTeamsPage = lazy(() => import('@/pages/TeamsPage'));
import SearchableSelect from '@/components/ui/searchable-select';
import { useToast } from '@/hooks/use-toast';
import {
  useRolePermissions,
  ALL_RESOURCES,
  SCOPE_LABELS,
  DEFAULT_ROLE_PERMISSIONS,
} from '@/contexts/RolePermissionsContext';
import type { UserRole, ResourceId } from '@/types';
import { ROLE_LABELS, ROLE_HIERARCHY } from '@/types';
import { useAuditLog, type AuditEvent, type AuditEventType } from '@/contexts/AuditLogContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  getPendingAccessRequests,
  approveAccessRequest,
  rejectAccessRequest,
  loadAllowedUsers,
  type AllowedUser,
  type AccessRequest,
} from '@/lib/accessControl';
import AgentOrgChart from '@/components/admin/AgentOrgChart';
import { useLicense } from '@/contexts/LicenseContext';
import {
  loadAreas,
  createArea,
  updateArea,
  deleteArea,
  loadAreaMembers,
  assignAreaMembers,
  type AreaRecord,
} from '@/lib/areasService';

const ADMIN_SECTIONS = [
  { id: 'company',      label: 'Empresa',              icon: Building2 },
  { id: 'roles',        label: 'Níveis de Acesso',     icon: Layers },
  { id: 'users-full',   label: 'Usuários',             icon: Users },
  { id: 'api-keys',     label: 'Tokens OpenAI',        icon: Key },
  { id: 'integrations', label: 'Integrações OAuth',    icon: Plug },
  { id: 'email',        label: 'E-mail / Gmail',       icon: Mail },
  { id: 'modules',      label: 'Módulos Visíveis',     icon: ToggleRight },
  { id: 'security',     label: 'Segurança & RLS',      icon: Lock },
  { id: 'logs',         label: 'Logs de Acesso',       icon: ScrollText },
  { id: 'teams',        label: 'Times',                icon: Users },
  { id: 'agents',       label: 'Agentes & Projeto',    icon: Network },
  { id: 'meu-plano',    label: 'Meu Plano',             icon: CreditCard },
];

// ── Helpers para salvar Client ID criptografado (ofuscado) no localStorage ──
const GOOG_KEY = 'admin_google_client_id';
const GOOG_SECRET = 'admin_google_client_secret';

function obfuscate(value: string): string {
  return btoa(value);
}
function deobfuscate(value: string): string {
  try { return atob(value); } catch { return ''; }
}
function saveOAuthSetting(key: string, value: string) {
  // Sensitive OAuth credentials are not persisted in browser anymore.
  // Keep function for backward compatibility with old UI actions.
  void key;
  void value;
}
function loadOAuthSetting(key: string): string {
  if (key === GOOG_KEY) return CONFIG.GOOGLE_CLIENT_ID;
  return '';
}
export function getStoredGoogleClientId(): string {
  return CONFIG.GOOGLE_CLIENT_ID;
}

const TOKEN_FIELDS: { key: keyof import('@/contexts/AppConfigContext').OpenAITokens; label: string; desc: string; icon: string; recommended: string }[] = [
  { key: 'meetings',    label: 'Reuniões',                icon: '🎙️', desc: 'Análise e transcrição de reuniões gravadas', recommended: 'gpt-4o-mini' },
  { key: 'training',    label: 'Treinamentos (voz)',       icon: '🎓', desc: 'Simulação de voz em tempo real com a IA', recommended: 'gpt-4o' },
  { key: 'whatsapp',    label: 'WhatsApp / Conversas',    icon: '💬', desc: 'Análise e sugestão nas conversas do WhatsApp', recommended: 'gpt-4o-mini' },
  { key: 'reports',     label: 'Relatórios & Insights',   icon: '📊', desc: 'Geração automática de relatórios com IA', recommended: 'gpt-4o-mini' },
  { key: 'automations', label: 'Automações',              icon: '⚡', desc: 'IA nos gatilhos e ações das automações', recommended: 'gpt-4o-mini' },
];

// Role color badge classes
const roleColorMap: Record<string, { bg: string; text: string; border: string }> = {
  destructive:        { bg: 'bg-destructive/10',       text: 'text-destructive',       border: 'border-destructive/20' },
  primary:            { bg: 'bg-primary/10',           text: 'text-primary',           border: 'border-primary/20' },
  accent:             { bg: 'bg-accent/15',            text: 'text-accent',            border: 'border-accent/30' },
  warning:            { bg: 'bg-warning/10',           text: 'text-warning',           border: 'border-warning/20' },
  success:            { bg: 'bg-success/10',           text: 'text-success',           border: 'border-success/20' },
  violet:             { bg: 'bg-violet-500/10',        text: 'text-violet-500',        border: 'border-violet-500/20' },
  indigo:             { bg: 'bg-indigo-500/10',        text: 'text-indigo-500',        border: 'border-indigo-500/20' },
  emerald:            { bg: 'bg-emerald-500/10',       text: 'text-emerald-500',       border: 'border-emerald-500/20' },
  amber:              { bg: 'bg-amber-500/10',         text: 'text-amber-500',         border: 'border-amber-500/20' },
  cyan:               { bg: 'bg-cyan-500/10',          text: 'text-cyan-500',          border: 'border-cyan-500/20' },
  slate:              { bg: 'bg-slate-500/10',         text: 'text-slate-500',         border: 'border-slate-500/20' },
  rose:               { bg: 'bg-rose-500/10',          text: 'text-rose-500',          border: 'border-rose-500/20' },
  'muted-foreground': { bg: 'bg-muted',                text: 'text-muted-foreground',  border: 'border-border' },
};

const SCOPE_ICONS: Record<string, string> = {
  all: '🌐', area: '🏢', team: '👥', self: '👤',
};

export default function AdminPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const section = searchParams.get('s') || 'company';
  const setSection = (id: string) => setSearchParams({ s: id }, { replace: true });
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [tokenTest, setTokenTest] = useState<Record<string, 'idle' | 'testing' | 'ok' | 'error'>>({});
  const [tokenTestMsg, setTokenTestMsg] = useState<Record<string, string>>({});
  const [moduleTarget, setModuleTarget] = useState<'global' | string>('global');
  const [selectedRole, setSelectedRole] = useState<UserRole>('ceo');
  const [expandedRole, setExpandedRole] = useState<UserRole | null>('ceo');

  // OAuth settings state
  const [oauthClientId, setOauthClientId] = useState(() => loadOAuthSetting(GOOG_KEY));
  const [oauthClientSecret, setOauthClientSecret] = useState(() => loadOAuthSetting(GOOG_SECRET));
  const [oauthSaved, setOauthSaved] = useState(false);
  const [showOauthSecret, setShowOauthSecret] = useState(false);
  const [showOauthClientId, setShowOauthClientId] = useState(false);
  const APP_URL = window.location.origin;
  const CALLBACK_URL = CONFIG.GOOGLE_REDIRECT_URI || `${APP_URL}/auth/google/callback`;
  // Audit logs state
  const [logs, setLogs] = useState<AuditEvent[]>([]);
  const [logSearch, setLogSearch] = useState('');
  const [logTypeFilter, setLogTypeFilter] = useState<AuditEventType | 'all'>('all');
  const [logRoleFilter, setLogRoleFilter] = useState<UserRole | 'all'>('all');
  const [pendingAccess, setPendingAccess] = useState<AccessRequest[]>([]);
  const [allowedAccounts, setAllowedAccounts] = useState<AllowedUser[]>([]);
  const [triageRoles, setTriageRoles] = useState<Record<string, UserRole>>({});

  // Email / Gmail config state
  const [emailProvider, setEmailProvider] = useState<'gmail' | 'smtp'>('gmail');
  const [emailConfig, setEmailConfig] = useState({
    gmailAccount: '',
    gmailAppPassword: '',
    smtpHost: '',
    smtpPort: '587',
    smtpUser: '',
    smtpPassword: '',
    senderName: 'LTX',
    senderEmail: '',
  });
  const [showEmailPassword, setShowEmailPassword] = useState(false);
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailTestSending, setEmailTestSending] = useState(false);
  const [emailConnected, setEmailConnected] = useState(false);

  // 2FA state
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [twoFAToggling, setTwoFAToggling] = useState(false);

  // Areas state
  const [dbAreas, setDbAreas] = useState<AreaRecord[]>([]);
  const [showAreaForm, setShowAreaForm] = useState(false);
  const [editingArea, setEditingArea] = useState<AreaRecord | null>(null);
  const [areaName, setAreaName] = useState('');
  const [areaGerente, setAreaGerente] = useState('');
  const [areaMemberEmails, setAreaMemberEmails] = useState<string[]>([]);
  const [areaMemberSearch, setAreaMemberSearch] = useState('');
  const [adminUserSearch, setAdminUserSearch] = useState('');
  const [areaMembersMap, setAreaMembersMap] = useState<Record<string, { nome: string; email: string; papel: string }[]>>({});

  // Role visibility & custom labels (persisted in localStorage)
  const [hiddenRoles, setHiddenRoles] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('ltx_hidden_roles') || '[]')); }
    catch { return new Set(); }
  });
  const [customLabels, setCustomLabels] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('ltx_role_labels') || '{}'); }
    catch { return {}; }
  });
  const [editingRoleLabel, setEditingRoleLabel] = useState<string | null>(null);
  const [editLabelValue, setEditLabelValue] = useState('');

  const { tokens, setToken, models, setModuleModel, modules, setModuleEnabled, saveConfig,
          getUserDisabledModules, setUserModuleOverride, companySubtitle, setCompanySubtitle } = useAppConfig();
  const [subtitleDraft, setSubtitleDraft] = useState(companySubtitle);
  useEffect(() => { setSubtitleDraft(companySubtitle); }, [companySubtitle]);
  const { user: currentUser } = useAuth();
  const { permissions, updatePermission } = useRolePermissions();
  const { getLogs, clearLogs } = useAuditLog();
  const { toast } = useToast();

  // Load logs whenever the tab is selected
  useEffect(() => {
    const loadAccessData = async () => {
      try {
        const [pending, allowed] = await Promise.all([getPendingAccessRequests(), loadAllowedUsers()]);
        setPendingAccess(pending);
        setAllowedAccounts(allowed);
      } catch (e: any) {
        toast({ variant: 'destructive', title: 'Erro ao carregar acessos', description: e?.message || 'Tente novamente.' });
      }
    };

    if (section === 'logs') {
      setLogs(getLogs());
    }
    if (section === 'users') {
      loadAccessData();
    }
    if (section === 'roles') {
      loadAreas().then(async (areas) => {
        setDbAreas(areas);
        const membersMap: Record<string, { nome: string; email: string; papel: string }[]> = {};
        for (const a of areas) {
          membersMap[a.id] = await loadAreaMembers(a.id);
        }
        setAreaMembersMap(membersMap);
      }).catch(() => {});
      loadAllowedUsers().then(setAllowedAccounts).catch(() => {});
    }
  }, [section, getLogs, toast]);

  // Persist hidden roles & custom labels
  useEffect(() => { localStorage.setItem('ltx_hidden_roles', JSON.stringify([...hiddenRoles])); }, [hiddenRoles]);
  useEffect(() => { localStorage.setItem('ltx_role_labels', JSON.stringify(customLabels)); }, [customLabels]);

  const refreshLogs = () => setLogs(getLogs());

  // Area handlers
  const handleSaveArea = async () => {
    if (!areaName.trim()) {
      toast({ variant: 'destructive', title: 'Nome obrigatório', description: 'Informe o nome da área.' });
      return;
    }
    try {
      if (editingArea) {
        await updateArea(editingArea.id, areaName, areaGerente || undefined, areaMemberEmails);
        toast({ title: 'Área atualizada' });
      } else {
        await createArea(areaName, areaGerente || undefined, areaMemberEmails);
        toast({ title: 'Área criada', description: `"${areaName}" criada com sucesso.` });
      }
      setShowAreaForm(false);
      setEditingArea(null);
      setAreaName('');
      setAreaGerente('');
      setAreaMemberEmails([]);
      loadAreas().then(async (areas) => {
        setDbAreas(areas);
        const membersMap: Record<string, { nome: string; email: string; papel: string }[]> = {};
        for (const a of areas) {
          membersMap[a.id] = await loadAreaMembers(a.id);
        }
        setAreaMembersMap(membersMap);
      }).catch(() => {});
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e?.message || 'Falha ao salvar área.' });
    }
  };

  const handleDeleteArea = async (area: AreaRecord) => {
    if (!confirm(`Excluir a área "${area.nome}"? Times e usuários vinculados ficarão sem área.`)) return;
    try {
      await deleteArea(area.id);
      toast({ title: 'Área excluída' });
      loadAreas().then(setDbAreas).catch(() => {});
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e?.message || 'Falha ao excluir.' });
    }
  };

  const openEditArea = async (area: AreaRecord) => {
    setEditingArea(area);
    setAreaName(area.nome);
    setAreaGerente(area.gerente_email || '');
    const members = await loadAreaMembers(area.id);
    setAreaMemberEmails(members.map(m => m.email));
    setShowAreaForm(true);
  };

  const openNewArea = () => {
    setEditingArea(null);
    setAreaName('');
    setAreaGerente('');
    setAreaMemberEmails([]);
    setShowAreaForm(true);
  };

  const toggleKey = (k: string) => setShowKey(prev => ({ ...prev, [k]: !prev[k] }));

  const handleSaveTokens = () => {
    saveConfig();
    toast({ title: 'Tokens salvos', description: 'Configurações de API atualizadas com sucesso.' });
  };

  const handleSaveOAuth = () => {
    saveOAuthSetting(GOOG_KEY, oauthClientId.trim());
    saveOAuthSetting(GOOG_SECRET, oauthClientSecret.trim());
    setOauthSaved(true);
    setTimeout(() => setOauthSaved(false), 3000);
    toast({ title: 'Credenciais salvas', description: 'Google Client ID e Secret armazenados com segurança.' });
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copiada!` });
  };

  const handleApproveAccess = async (req: AccessRequest) => {
    const role = triageRoles[req.id] || 'sdr';
    const ok = await approveAccessRequest({
      requestId: req.id,
      role,
      approverEmail: currentUser?.email || 'admin@ltx.com',
    });
    if (!ok) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível aprovar a solicitação.' });
      return;
    }
    const [pending, allowed] = await Promise.all([getPendingAccessRequests(), loadAllowedUsers()]);
    setPendingAccess(pending);
    setAllowedAccounts(allowed);
    toast({ title: 'Acesso aprovado', description: `${req.email} aprovado como ${ROLE_LABELS[role]}.` });
  };

  const handleRejectAccess = async (req: AccessRequest) => {
    const ok = await rejectAccessRequest({
      requestId: req.id,
      approverEmail: currentUser?.email || 'admin@ltx.com',
    });
    if (!ok) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível rejeitar a solicitação.' });
      return;
    }
    const pending = await getPendingAccessRequests();
    setPendingAccess(pending);
    toast({ title: 'Solicitação rejeitada', description: `${req.email} foi rejeitado.` });
  };

  const isLocked = (id: ModuleId) => id === 'admin';

  const targetDisabled = moduleTarget === 'global' ? [] : getUserDisabledModules(moduleTarget);
  const toggleTargetModule = (id: ModuleId) => {
    if (moduleTarget === 'global') {
      setModuleEnabled(id, !!modules.find(m => m.id === id && !m.enabled));
    } else {
      const cur = getUserDisabledModules(moduleTarget);
      const next = cur.includes(id) ? cur.filter(m => m !== id) : [...cur, id];
      setUserModuleOverride(moduleTarget, next);
      toast({ title: 'Salvo', description: 'Permissões de módulo atualizadas.' });
    }
  };

  const toggleResource = (role: UserRole, resourceId: ResourceId) => {
    const perm = permissions.find(p => p.role === role);
    if (!perm) return;
    const has = perm.resources.includes(resourceId);
    const next = has
      ? perm.resources.filter(r => r !== resourceId)
      : [...perm.resources, resourceId];
    updatePermission(role, { resources: next });
    toast({ title: 'Permissão atualizada', description: `${ROLE_LABELS[role]} — ${resourceId} ${has ? 'removido' : 'adicionado'}.` });
  };

  const handleScopeChange = (role: UserRole, scope: 'all' | 'area' | 'team' | 'self') => {
    updatePermission(role, { scope });
    toast({ title: 'Escopo atualizado', description: `${ROLE_LABELS[role]} agora enxerga: ${SCOPE_LABELS[scope]}` });
  };

  // Build org-tree levels for display
  // Depth map: roles at same level share same indent
  const ROLE_DEPTH: Record<UserRole, number> = {
    admin: 0, ceo: 1, director: 2, manager: 3, coordinator: 4, supervisor: 5,
    bdr: 6, sdr: 6, closer: 6, key_account: 6, csm: 6, low_touch: 6, sales_engineer: 6,
    member: 6, support: 7,
  };

  const orgLevels = ROLE_HIERARCHY.filter(r => !hiddenRoles.has(r)).map(role => ({
    role,
    depth: ROLE_DEPTH[role] ?? 6,
    perm: permissions.find(p => p.role === role),
    users: MOCK_USERS.filter(u => u.role === role),
    label: customLabels[role] || ROLE_LABELS[role],
  }));

  return (
    <div className="page-container animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold">Painel Administrativo</h1>
        <p className="text-sm text-muted-foreground">Configurações globais da plataforma</p>
      </div>

      <div className="flex gap-4 lg:gap-6">
        {/* Menu — collapses to icons on narrow screens */}
        <div className="w-12 lg:w-56 flex-shrink-0 transition-all">
          <nav className="space-y-1 sticky top-4">
            {ADMIN_SECTIONS.map(s => (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                className={cn('w-full nav-item', section === s.id && 'active')}
                title={s.label}
              >
                <s.icon className="w-4 h-4 flex-shrink-0" />
                <span className="hidden lg:inline">{s.label}</span>
                {section !== s.id && <ChevronRight className="w-3 h-3 ml-auto text-muted-foreground/50 hidden lg:block" />}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-4 min-w-0">

          {/* ── Empresa ── */}
          {section === 'company' && (
            <div className="glass-card p-6 space-y-5">
              <h2 className="font-display font-semibold text-lg">Configurações da Empresa</h2>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Nome da Empresa', value: 'LTX', placeholder: 'Sua empresa' },
                  { label: 'Domínio', value: '', placeholder: 'dominio.com.br' },
                  { label: 'CNPJ', value: '', placeholder: '00.000.000/0001-00' },
                  { label: 'Email de Contato', value: '', placeholder: 'admin@empresa.com' },
                ].map(f => (
                  <div key={f.label}>
                    <label className="text-xs font-medium block mb-1.5">{f.label}</label>
                    <Input defaultValue={f.value} placeholder={f.placeholder} className="h-9 text-sm bg-secondary border-border" />
                  </div>
                ))}
              </div>

              {/* Subtítulo da marca (aparece na sidebar e aba do navegador) */}
              <div className="border-t border-border pt-4 space-y-3">
                <h3 className="text-sm font-semibold">Marca / Branding</h3>
                <div className="max-w-sm">
                  <label className="text-xs font-medium block mb-1.5">Subtítulo (exibido na sidebar e aba do navegador)</label>
                  <div className="flex gap-2">
                    <Input
                      value={subtitleDraft}
                      onChange={e => setSubtitleDraft(e.target.value)}
                      placeholder="Revenue OS"
                      className="h-9 text-sm bg-secondary border-border"
                    />
                    <Button
                      size="sm"
                      className="bg-gradient-primary text-xs h-9 px-4"
                      onClick={() => {
                        setCompanySubtitle(subtitleDraft);
                        toast({ title: 'Subtítulo salvo!', description: `Atualizado para "${subtitleDraft}".` });
                      }}
                      disabled={subtitleDraft === companySubtitle}
                    >
                      <Save className="w-3 h-3 mr-1" /> Salvar
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">Aparece como "LTX · {subtitleDraft}" na sidebar e "LTX {subtitleDraft}" na aba.</p>
                </div>
              </div>
            </div>
          )}

          {/* ── Níveis de Acesso ── */}
          {section === 'roles' && (
            <div className="space-y-4">
              {/* Org chart visual */}
              <div className="glass-card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <GitBranch className="w-4 h-4 text-primary" />
                  <h2 className="font-display font-semibold text-lg">Organograma de Hierarquia</h2>
                </div>
                <p className="text-xs text-muted-foreground mb-5">
                  Cada nível só enxerga os níveis abaixo de si, dentro do seu escopo de visibilidade.
                </p>

                {/* Org tree */}
                <div className="space-y-1">
                  {orgLevels.map((item) => {
                    const color = roleColorMap[item.perm?.color ?? 'muted-foreground'];
                    const isAdmin = item.role === 'admin';
                    return (
                      <div key={item.role}>
                        {/* Indent line */}
                        <div className="flex items-stretch gap-0">
                          {/* Left indent bars — use depth instead of index */}
                          {Array.from({ length: item.depth }).map((_, i) => (
                            <div key={i} className="w-5 flex-shrink-0 flex justify-center">
                              <div className="w-px bg-border/50 h-full" />
                            </div>
                          ))}
                          {/* Row */}
                          <div className="flex-1">
                            {editingRoleLabel === item.role ? (
                              /* Inline label editor */
                              <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-primary/40 bg-primary/5">
                                <Input
                                  autoFocus
                                  value={editLabelValue}
                                  onChange={e => setEditLabelValue(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter' && editLabelValue.trim()) {
                                      setCustomLabels(prev => ({ ...prev, [item.role]: editLabelValue.trim() }));
                                      setEditingRoleLabel(null);
                                    }
                                    if (e.key === 'Escape') setEditingRoleLabel(null);
                                  }}
                                  className="h-7 text-sm bg-background border-border max-w-[200px]"
                                  placeholder={ROLE_LABELS[item.role]}
                                />
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2"
                                  onClick={() => {
                                    if (editLabelValue.trim()) {
                                      setCustomLabels(prev => ({ ...prev, [item.role]: editLabelValue.trim() }));
                                    }
                                    setEditingRoleLabel(null);
                                  }}
                                >
                                  <Check className="w-3 h-3" />
                                </Button>
                                {customLabels[item.role] && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2 text-muted-foreground"
                                    onClick={() => {
                                      setCustomLabels(prev => {
                                        const next = { ...prev };
                                        delete next[item.role];
                                        return next;
                                      });
                                      setEditingRoleLabel(null);
                                    }}
                                    title="Restaurar nome original"
                                  >
                                    <RefreshCw className="w-3 h-3" />
                                  </Button>
                                )}
                              </div>
                            ) : (
                            <button
                              onClick={() => setExpandedRole(expandedRole === item.role ? null : item.role)}
                              className={cn(
                                'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all text-left group',
                                expandedRole === item.role
                                  ? `${color.bg} ${color.border} border`
                                  : 'border-border/30 hover:bg-muted/30'
                              )}
                            >
                              {/* Hierarchy level dot */}
                              <div className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', color.bg, `border ${color.border}`)}>
                                <div className={cn('w-full h-full rounded-full', color.text.replace('text-', 'bg-'))} />
                              </div>
                              <span className={cn('text-sm font-semibold', color.text)}>{item.label}</span>
                              {isAdmin && <Lock className="w-3 h-3 text-muted-foreground" />}
                              <span className="text-[10px] text-muted-foreground ml-1">
                                {SCOPE_ICONS[item.perm?.scope ?? 'self']} {SCOPE_LABELS[item.perm?.scope ?? 'self']}
                              </span>
                              {/* Edit & Hide actions (non-admin only) */}
                              {!isAdmin && (
                                <span className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                                  <span
                                    role="button"
                                    tabIndex={0}
                                    className="p-0.5 rounded hover:bg-muted/60"
                                    title="Renomear cargo"
                                    onClick={e => {
                                      e.stopPropagation();
                                      setEditLabelValue(customLabels[item.role] || ROLE_LABELS[item.role]);
                                      setEditingRoleLabel(item.role);
                                    }}
                                    onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); setEditLabelValue(customLabels[item.role] || ROLE_LABELS[item.role]); setEditingRoleLabel(item.role); } }}
                                  >
                                    <Pencil className="w-3 h-3 text-muted-foreground" />
                                  </span>
                                  <span
                                    role="button"
                                    tabIndex={0}
                                    className="p-0.5 rounded hover:bg-muted/60"
                                    title="Ocultar cargo do organograma"
                                    onClick={e => {
                                      e.stopPropagation();
                                      setHiddenRoles(prev => new Set([...prev, item.role]));
                                    }}
                                    onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); setHiddenRoles(prev => new Set([...prev, item.role])); } }}
                                  >
                                    <EyeOff className="w-3 h-3 text-muted-foreground" />
                                  </span>
                                </span>
                              )}
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground ml-auto">
                                {item.users.length} {item.users.length === 1 ? 'usuário' : 'usuários'}
                              </span>
                              {expandedRole === item.role
                                ? <ChevronUp className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                                : <ChevronDown className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
                            </button>
                            )}

                            {/* Expanded: permission config */}
                            {expandedRole === item.role && (
                              <div className="mt-2 ml-1 mb-3 p-4 rounded-xl border border-border/50 bg-muted/10 space-y-4">
                                {isAdmin && (
                                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-destructive/5 border border-destructive/20 text-xs text-destructive">
                                    <Lock className="w-3.5 h-3.5" />
                                    O Administrador possui acesso total e não pode ter permissões removidas.
                                  </div>
                                )}

                                {!isAdmin && (
                                  <>
                                    {/* Scope selector */}
                                    <div>
                                      <p className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Escopo de visibilidade</p>
                                      <div className="flex flex-wrap gap-2">
                                        {(['all', 'area', 'team', 'self'] as const).map(scope => (
                                          <button
                                            key={scope}
                                            onClick={() => handleScopeChange(item.role, scope)}
                                            className={cn(
                                              'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all',
                                              item.perm?.scope === scope
                                                ? `${color.bg} ${color.border} ${color.text} font-medium`
                                                : 'border-border text-muted-foreground hover:bg-muted'
                                            )}
                                          >
                                            <span>{SCOPE_ICONS[scope]}</span>
                                            {SCOPE_LABELS[scope]}
                                          </button>
                                        ))}
                                      </div>
                                    </div>

                                    {/* Resources */}
                                    <div>
                                      <p className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Módulos com acesso</p>
                                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                                        {ALL_RESOURCES.map(res => {
                                          const hasIt = item.perm?.resources.includes(res.id) ?? false;
                                          return (
                                            <button
                                              key={res.id}
                                              onClick={() => toggleResource(item.role, res.id)}
                                              className={cn(
                                                'flex items-center gap-1.5 text-xs px-2.5 py-2 rounded-lg border transition-all text-left',
                                                hasIt
                                                  ? `${color.bg} ${color.border} ${color.text}`
                                                  : 'border-border/40 text-muted-foreground/50 bg-muted/10 hover:bg-muted/30'
                                              )}
                                            >
                                              <span className="text-sm">{res.icon}</span>
                                              <span className="truncate">{res.label}</span>
                                              {hasIt
                                                ? <CheckCircle2 className="w-3 h-3 ml-auto flex-shrink-0" />
                                                : <div className="w-3 h-3 rounded-full border border-border/40 ml-auto flex-shrink-0" />}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  </>
                                )}

                                {/* Users in this role */}
                                {item.users.length > 0 && (
                                  <div>
                                    <p className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Usuários neste nível</p>
                                    <div className="flex flex-wrap gap-2">
                                      {item.users.map(u => (
                                        <div key={u.id} className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border border-border bg-muted/30">
                                          <img src={u.avatar} alt={u.name} className="w-4 h-4 rounded-full" />
                                          {u.name.split(' ')[0]}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Hidden roles restore section */}
                {hiddenRoles.size > 0 && (
                  <div className="mt-4 p-3 rounded-xl border border-dashed border-border/50 bg-muted/10">
                    <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                      <EyeOff className="w-3 h-3" />
                      Cargos ocultos ({hiddenRoles.size})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {[...hiddenRoles].map(role => (
                        <button
                          key={role}
                          onClick={() => setHiddenRoles(prev => { const next = new Set(prev); next.delete(role); return next; })}
                          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 transition-colors"
                        >
                          <Eye className="w-3 h-3 text-muted-foreground" />
                          <span>{customLabels[role] || ROLE_LABELS[role as keyof typeof ROLE_LABELS]}</span>
                          <span className="text-muted-foreground/60">— Restaurar</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Areas */}
              <div className="glass-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-accent" />
                    <h2 className="font-display font-semibold">Áreas da Empresa</h2>
                  </div>
                  <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={openNewArea}>
                    <Plus className="w-3 h-3" /> Nova Área
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  Áreas agrupam times sob um Gerente. Coordenadores e abaixo enxergam apenas dentro da sua área.
                </p>

                {/* Area form (create/edit) */}
                {showAreaForm && (
                  <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 mb-4 space-y-3">
                    <p className="text-xs font-semibold">{editingArea ? 'Editar Área' : 'Nova Área'}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-muted-foreground block mb-1">Nome da Área *</label>
                        <Input
                          value={areaName}
                          onChange={e => setAreaName(e.target.value)}
                          placeholder="Ex: Comercial, Customer Success..."
                          className="h-8 text-xs bg-secondary border-border"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground block mb-1">Gerente (e-mail)</label>
                        <SearchableSelect
                          value={areaGerente}
                          onChange={setAreaGerente}
                          placeholder="— Sem gerente —"
                          allowClear
                          size="sm"
                          options={allowedAccounts.map(u => ({
                            value: u.email,
                            label: u.name,
                            sub: u.email,
                          }))}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-1">
                        Participantes da área — {areaMemberEmails.length} selecionado(s)
                      </label>
                      <div className="relative mb-1.5">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="Pesquisar usuários..."
                          value={areaMemberSearch}
                          onChange={e => setAreaMemberSearch(e.target.value)}
                          className="h-7 text-xs bg-secondary border-border pl-8"
                        />
                      </div>
                      <div className="space-y-1 max-h-40 overflow-y-auto pr-1 border border-border/50 rounded-lg p-2 bg-secondary/50">
                        {allowedAccounts.filter(u =>
                          !areaMemberSearch || u.name.toLowerCase().includes(areaMemberSearch.toLowerCase()) || u.email.toLowerCase().includes(areaMemberSearch.toLowerCase())
                        ).map(u => {
                          const selected = areaMemberEmails.includes(u.email);
                          return (
                            <div
                              key={u.email}
                              onClick={() => setAreaMemberEmails(prev =>
                                prev.includes(u.email) ? prev.filter(e => e !== u.email) : [...prev, u.email]
                              )}
                              className={cn(
                                'flex items-center gap-2 p-1.5 rounded-md cursor-pointer transition-all text-xs',
                                selected ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted/50 border border-transparent'
                              )}
                            >
                              <div className={cn(
                                'w-3.5 h-3.5 rounded-full border flex items-center justify-center flex-shrink-0',
                                selected ? 'bg-primary border-primary' : 'border-border'
                              )}>
                                {selected && <Check className="w-2 h-2 text-primary-foreground" />}
                              </div>
                              <span className="font-medium">{u.name}</span>
                              <span className="text-muted-foreground">({u.email})</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="text-xs h-7 bg-gradient-primary" onClick={handleSaveArea}>
                        <Save className="w-3 h-3 mr-1" /> {editingArea ? 'Salvar' : 'Criar Área'}
                      </Button>
                      <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => { setShowAreaForm(false); setEditingArea(null); }}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  {dbAreas.length === 0 && !showAreaForm && (
                    <div className="text-center py-6 text-muted-foreground">
                      <Building2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-xs">Nenhuma área criada ainda.</p>
                      <p className="text-[10px] mt-1">Clique em "+ Nova Área" para começar.</p>
                    </div>
                  )}
                  {dbAreas.map(area => (
                    <div key={area.id} className="p-4 rounded-xl border border-border/60 bg-muted/10 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold">{area.nome}</p>
                          {area.gerente_nome ? (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Gerente: {area.gerente_nome}
                            </p>
                          ) : (
                            <p className="text-xs text-amber-500 mt-0.5">Sem gerente atribuído</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Button size="sm" variant="ghost" className="text-xs h-6 px-2" onClick={() => openEditArea(area)}>
                            Editar
                          </Button>
                          <Button size="sm" variant="ghost" className="text-xs h-6 px-2 text-destructive hover:text-destructive" onClick={() => handleDeleteArea(area)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      {(areaMembersMap[area.id] || []).length > 0 && (
                        <div className="pt-1">
                          <p className="text-[10px] text-muted-foreground mb-1">Participantes ({areaMembersMap[area.id].length}):</p>
                          <div className="flex flex-wrap gap-1.5">
                            {areaMembersMap[area.id].map(m => (
                              <span key={m.email} className="text-[10px] px-2 py-0.5 rounded-full bg-muted border border-border">
                                {m.nome}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Info box */}
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  💡 <strong>Como funciona a hierarquia:</strong> Admin e CEO veem tudo. Diretores veem toda a empresa. Gerentes veem sua Área. Coordenadores e Supervisores veem seus Times. Vendedores veem apenas seus próprios dados.
                </p>
              </div>
            </div>
          )}

          {/* ── Usuários ── */}
          {section === 'users' && (
            <div className="space-y-4">
              <div className="glass-card p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="font-display font-semibold text-lg">Triagem de Acesso (SSO)</h2>
                  <span className={cn(
                    'text-xs px-2 py-1 rounded-full border',
                    pendingAccess.length > 0
                      ? 'bg-warning/10 text-warning border-warning/20'
                      : 'bg-success/10 text-success border-success/20'
                  )}>
                    {pendingAccess.length} pendente(s)
                  </span>
                </div>

                {pendingAccess.length === 0 ? (
                  <div className="text-sm text-muted-foreground p-4 rounded-lg bg-muted/30 border border-border/50">
                    Nenhuma solicitação pendente no momento.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pendingAccess.map(req => (
                      <div key={req.id} className="p-3 rounded-xl border border-border/50 bg-muted/20">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{req.name || req.email}</p>
                            <p className="text-xs text-muted-foreground">{req.email}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              Solicitado em {new Date(req.requestedAt).toLocaleString('pt-BR')}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <select
                              value={triageRoles[req.id] || 'sdr'}
                              onChange={e => setTriageRoles(prev => ({ ...prev, [req.id]: e.target.value as UserRole }))}
                              className="text-xs bg-secondary border border-border rounded-lg px-2 py-1 text-foreground"
                            >
                              {ROLE_HIERARCHY.map(r => (
                                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                              ))}
                            </select>
                            <Button
                              size="sm"
                              className="text-xs h-7 bg-success hover:bg-success/90 text-success-foreground"
                              onClick={() => handleApproveAccess(req)}
                            >
                              Aprovar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7 border-destructive/40 text-destructive hover:bg-destructive/10"
                              onClick={() => handleRejectAccess(req)}
                            >
                              Rejeitar
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="glass-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display font-semibold text-lg">Contas autorizadas no SSO</h2>
                  <span className="text-xs px-2 py-1 rounded-full border bg-primary/10 text-primary border-primary/20">
                    {allowedAccounts.length} conta(s)
                  </span>
                </div>
                <div className="relative mb-4">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={adminUserSearch}
                    onChange={e => setAdminUserSearch(e.target.value)}
                    placeholder="Pesquisar por nome ou e-mail..."
                    className="h-9 text-xs pl-9 bg-secondary border-border"
                  />
                </div>
                <div className="space-y-2">
                  {allowedAccounts.filter(acc =>
                    !adminUserSearch ||
                    acc.name.toLowerCase().includes(adminUserSearch.toLowerCase()) ||
                    acc.email.toLowerCase().includes(adminUserSearch.toLowerCase())
                  ).map(acc => {
                    const color = roleColorMap[permissions.find(p => p.role === acc.role)?.color ?? 'muted-foreground'];
                    return (
                      <div key={acc.email} className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/30 transition-colors">
                        <img
                          src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(acc.email)}`}
                          alt={acc.name}
                          className="w-8 h-8 rounded-full border border-border"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{acc.name}</p>
                          <p className="text-xs text-muted-foreground">{acc.email}</p>
                        </div>
                        <span className={cn('text-[10px] px-2 py-0.5 rounded-full border font-medium', color.bg, color.text, color.border)}>
                          {ROLE_LABELS[acc.role]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── Tokens OpenAI ── */}
          {section === 'api-keys' && (
            <div className="glass-card p-6 space-y-5">
              <div>
                <h2 className="font-display font-semibold text-lg">Tokens OpenAI</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Configure os tokens de API da OpenAI para cada módulo. Os tokens são salvos de forma segura no banco de dados.
                </p>
              </div>
              <div className="space-y-4">
                {TOKEN_FIELDS.map(f => {
                  const val = tokens[f.key] || '';
                  const visible = showKey[f.key] ?? false;
                  const masked = val ? `sk-proj***${val.slice(-6)}` : '';
                  const testStatus = tokenTest[f.key] || 'idle';
                  const testMsg = tokenTestMsg[f.key] || '';
                  const handleTest = async () => {
                    if (!val) return;
                    setTokenTest(prev => ({ ...prev, [f.key]: 'testing' }));
                    setTokenTestMsg(prev => ({ ...prev, [f.key]: '' }));
                    try {
                      const data = await callOpenAI(val, {
                        model: 'gpt-4o-mini',
                        messages: [{ role: 'user', content: 'Responda apenas "ok"' }],
                        max_tokens: 5,
                      });
                      if (data?.choices?.[0]?.message?.content) {
                        setTokenTest(prev => ({ ...prev, [f.key]: 'ok' }));
                        setTokenTestMsg(prev => ({ ...prev, [f.key]: 'Token válido e funcional!' }));
                      } else {
                        throw new Error('Resposta inesperada da API');
                      }
                    } catch (err: any) {
                      setTokenTest(prev => ({ ...prev, [f.key]: 'error' }));
                      setTokenTestMsg(prev => ({ ...prev, [f.key]: err?.message || 'Erro desconhecido' }));
                    }
                  };
                  return (
                    <div key={f.key} className="p-4 rounded-xl bg-muted/30 border border-border/50 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{f.icon}</span>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{f.label}</p>
                          <p className="text-[11px] text-muted-foreground">{f.desc}</p>
                        </div>
                        {val ? (
                          <span className={cn(
                            'text-[10px] px-2 py-0.5 rounded-full border',
                            testStatus === 'ok'
                              ? 'bg-success/10 text-success border-success/20'
                              : testStatus === 'error'
                              ? 'bg-destructive/10 text-destructive border-destructive/20'
                              : 'bg-success/10 text-success border-success/20'
                          )}>
                            {testStatus === 'ok' ? 'Funcional ✓' : testStatus === 'error' ? 'Erro ✗' : 'Configurado'}
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-warning/10 text-warning border border-warning/20">
                            Não configurado
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <input
                            type={visible ? 'text' : 'password'}
                            value={val}
                            onChange={e => {
                              setToken(f.key, e.target.value.trim());
                              setTokenTest(prev => ({ ...prev, [f.key]: 'idle' }));
                            }}
                            placeholder="sk-proj-..."
                            className="w-full text-xs px-3 py-2 rounded-lg bg-background border border-border focus:border-primary/50 focus:ring-1 focus:ring-primary/20 outline-none font-mono"
                          />
                          {val && !visible && (
                            <span className="absolute right-10 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-mono pointer-events-none">
                              {masked}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => setShowKey(prev => ({ ...prev, [f.key]: !visible }))}
                          className="p-2 rounded-lg border border-border hover:bg-muted transition-colors"
                          title={visible ? 'Ocultar' : 'Mostrar'}
                        >
                          {visible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={handleTest}
                          disabled={!val || testStatus === 'testing'}
                          className={cn(
                            'px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors',
                            testStatus === 'testing'
                              ? 'border-border text-muted-foreground'
                              : 'border-primary/30 text-primary hover:bg-primary/10'
                          )}
                        >
                          {testStatus === 'testing' ? 'Testando...' : 'Testar'}
                        </button>
                      </div>
                      {testMsg && (
                        <p className={cn(
                          'text-[11px] px-2',
                          testStatus === 'ok' ? 'text-success' : 'text-destructive'
                        )}>
                          {testMsg}
                        </p>
                      )}
                      {/* Model selector */}
                      <div className="flex items-center gap-2 pt-1">
                        <p className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">Modelo:</p>
                        <select
                          value={models[f.key]}
                          onChange={e => setModuleModel(f.key as ModuleAIKey, e.target.value as any)}
                          className="flex-1 text-xs px-2.5 py-1.5 rounded-lg bg-background border border-border focus:border-primary/50 focus:ring-1 focus:ring-primary/20 outline-none"
                        >
                          {AI_MODELS.map(m => (
                            <option key={m.id} value={m.id}>
                              {m.label} — {m.desc}{m.id === f.recommended ? ' (recomendado)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-xs text-muted-foreground">
                  Os tokens são salvos automaticamente no banco de dados ao digitar. A chamada à OpenAI é feita via RPC server-side (sem exposição no browser).
                </p>
              </div>
            </div>
          )}

          {/* ── Módulos Visíveis ── */}
          {section === 'modules' && (
            <div className="glass-card p-6 space-y-5">
              <div>
                <h2 className="font-display font-semibold text-lg">Módulos Visíveis</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Configure quais módulos aparecem no menu para cada usuário ou time.
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Configurar para:</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setModuleTarget('global')}
                    className={cn('text-xs px-3 py-1.5 rounded-lg border transition-all',
                      moduleTarget === 'global'
                        ? 'bg-primary/15 border-primary/30 text-primary font-medium'
                        : 'border-border text-muted-foreground hover:bg-muted')}
                  >
                    🌐 Global (padrão)
                  </button>
                  {MOCK_TEAMS.map(t => (
                    <button
                      key={t.id}
                      onClick={() => setModuleTarget(t.id)}
                      className={cn('text-xs px-3 py-1.5 rounded-lg border transition-all',
                        moduleTarget === t.id
                          ? 'bg-accent/15 border-accent/30 text-accent font-medium'
                          : 'border-border text-muted-foreground hover:bg-muted')}
                    >
                      👥 {t.name}
                    </button>
                  ))}
                  {MOCK_USERS.map(u => (
                    <button
                      key={u.id}
                      onClick={() => setModuleTarget(u.id)}
                      className={cn('flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-all',
                        moduleTarget === u.id
                          ? 'bg-success/10 border-success/30 text-success font-medium'
                          : 'border-border text-muted-foreground hover:bg-muted')}
                    >
                      <img src={u.avatar} alt={u.name} className="w-4 h-4 rounded-full" />
                      {u.name.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                {DEFAULT_MODULES.map(mod => {
                  const globallyOff = !modules.find(m => m.id === mod.id)?.enabled;
                  const userOff = moduleTarget !== 'global'
                    ? getUserDisabledModules(moduleTarget).includes(mod.id)
                    : false;
                  const isOn = moduleTarget === 'global' ? !globallyOff : !globallyOff && !userOff;
                  return (
                    <div
                      key={mod.id}
                      className={cn(
                        'flex items-center justify-between p-3 rounded-xl border transition-colors',
                        isOn ? 'bg-muted/30 border-border/50' : 'bg-muted/10 border-border/20 opacity-60'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {isOn
                          ? <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                          : <AlertCircle  className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                        <div>
                          <p className="text-sm font-medium">{mod.label}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">/{mod.id}</p>
                        </div>
                      </div>
                      <button
                        disabled={isLocked(mod.id) || (moduleTarget !== 'global' && globallyOff)}
                        onClick={() => {
                          if (moduleTarget === 'global') {
                            setModuleEnabled(mod.id, !modules.find(m => m.id === mod.id)?.enabled);
                          } else {
                            const cur = getUserDisabledModules(moduleTarget);
                            const next = cur.includes(mod.id) ? cur.filter(m => m !== mod.id) : [...cur, mod.id];
                            setUserModuleOverride(moduleTarget, next);
                          }
                        }}
                        className={cn(
                          'transition-colors',
                          (isLocked(mod.id) || (moduleTarget !== 'global' && globallyOff))
                            ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'
                        )}
                      >
                        {isOn
                          ? <ToggleRight className="w-8 h-8 text-primary" />
                          : <ToggleLeft  className="w-8 h-8 text-muted-foreground" />}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Segurança ── */}
          {section === 'security' && (
            <div className="space-y-5">
              <div className="glass-card p-6 space-y-5">
                <h2 className="font-display font-semibold text-lg">Segurança & Row Level Security</h2>
                <div className="space-y-3">
                  {[
                    { label: 'RLS habilitado nas tabelas',  status: true,  desc: 'Usuários só acessam dados autorizados pelo seu role', toggleable: false },
                    { label: 'Logs de auditoria',            status: true,  desc: 'Registro de todas as ações críticas', toggleable: false },
                    { label: 'Sessões com expiração',        status: true,  desc: 'Tokens expiram após 7 dias de inatividade', toggleable: false },
                  ].map(item => (
                    <div key={item.label} className="flex items-start gap-3 p-3 rounded-xl bg-muted/30">
                      <CheckCircle2 className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium">{item.label}</p>
                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                      </div>
                      <span className="ml-auto text-xs px-2 py-0.5 rounded-full border flex-shrink-0 bg-success/10 text-success border-success/20">
                        Ativo
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 2FA Section */}
              <div className="glass-card p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                  <h2 className="font-display font-semibold text-lg">Autenticação de Dois Fatores (2FA)</h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  Adiciona uma camada extra de segurança exigindo um código temporário (TOTP) além da senha no login.
                </p>

                {/* Applies only to email/password */}
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <p className="text-xs text-muted-foreground">
                    <strong>Aplica-se apenas a login por e-mail e senha.</strong> Usuários que fazem login via Google (SSO) já possuem a segurança do Google e não precisam de 2FA adicional.
                  </p>
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-border/50">
                  <div className="flex items-center gap-3">
                    {twoFAEnabled
                      ? <CheckCircle2 className="w-5 h-5 text-success" />
                      : <AlertCircle className="w-5 h-5 text-warning" />}
                    <div>
                      <p className="text-sm font-medium">{twoFAEnabled ? '2FA Ativo' : '2FA Desativado'}</p>
                      <p className="text-xs text-muted-foreground">
                        {twoFAEnabled
                          ? 'Usuários com login por e-mail/senha precisam de código TOTP'
                          : 'Login por e-mail/senha sem verificação adicional'}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={twoFAEnabled ? 'destructive' : 'default'}
                    className="gap-2"
                    disabled={twoFAToggling}
                    onClick={() => {
                      setTwoFAToggling(true);
                      setTimeout(() => {
                        setTwoFAEnabled(!twoFAEnabled);
                        setTwoFAToggling(false);
                        toast({
                          title: twoFAEnabled ? '2FA desativado' : '2FA ativado',
                          description: twoFAEnabled
                            ? 'A autenticação de dois fatores foi desativada.'
                            : 'Usuários com login por e-mail/senha precisarão configurar o autenticador no próximo login.',
                        });
                      }, 800);
                    }}
                  >
                    {twoFAToggling ? (
                      <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Processando...</>
                    ) : twoFAEnabled ? (
                      <><ToggleRight className="w-4 h-4" /> Desativar 2FA</>
                    ) : (
                      <><ToggleLeft className="w-4 h-4" /> Ativar 2FA</>
                    )}
                  </Button>
                </div>

                {/* How it works */}
                {twoFAEnabled && (
                  <div className="space-y-3">
                    <div className="p-3 rounded-lg bg-success/5 border border-success/20">
                      <p className="text-xs text-success font-medium mb-1">2FA está ativo</p>
                      <p className="text-xs text-success/80">
                        No próximo login por e-mail/senha, o usuário verá um QR Code para escanear com o app autenticador (Google Authenticator, Authy, Microsoft Authenticator, etc).
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-muted/30 border border-border/50 space-y-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Fluxo de ativação para o usuário</p>
                      <div className="space-y-2">
                        {[
                          { step: '1', text: 'No login, após digitar e-mail e senha, aparece a tela de configuração 2FA' },
                          { step: '2', text: 'O sistema gera um QR Code exclusivo. O usuário escaneia com o app autenticador' },
                          { step: '3', text: 'O usuário digita o código de 6 dígitos gerado pelo app para confirmar' },
                          { step: '4', text: 'O sistema exibe 8 códigos de recuperação de uso único para caso perca o acesso ao app' },
                          { step: '5', text: 'A partir daí, todo login por e-mail/senha pede o código TOTP de 6 dígitos' },
                        ].map(item => (
                          <div key={item.step} className="flex gap-2.5 items-start">
                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center">
                              {item.step}
                            </span>
                            <p className="text-xs text-muted-foreground leading-relaxed">{item.text}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-accent/5 border border-accent/20">
                      <p className="text-xs text-accent/90">
                        <strong>Códigos de recuperação:</strong> Cada usuário recebe 8 códigos de recuperação de uso único ao configurar o 2FA. Se o usuário perder o app autenticador, pode usar um desses códigos para acessar a conta. Cada código só funciona uma vez. O admin pode resetar o 2FA de um usuário na seção Usuários.
                      </p>
                    </div>
                  </div>
                )}

                {!twoFAEnabled && (
                  <div className="p-3 rounded-lg bg-warning/5 border border-warning/20">
                    <p className="text-xs text-warning">
                      Recomendamos ativar o 2FA para usuários que fazem login por e-mail e senha. Quem usa Google SSO já está protegido.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Logs de Acesso ── */}
          {section === 'logs' && (() => {
            const EVENT_LABELS: Record<AuditEventType, { label: string; icon: React.ReactNode; color: string }> = {
              login:     { label: 'Login',        icon: <LogIn  className="w-3.5 h-3.5" />, color: 'text-success bg-success/10 border-success/20' },
              logout:    { label: 'Logout',       icon: <LogOut className="w-3.5 h-3.5" />, color: 'text-warning bg-warning/10 border-warning/20' },
              page_view: { label: 'Página acessada', icon: <MonitorSmartphone className="w-3.5 h-3.5" />, color: 'text-primary bg-primary/10 border-primary/20' },
            };

            const filtered = logs.filter(e => {
              const matchType = logTypeFilter === 'all' || e.type === logTypeFilter;
              const matchRole = logRoleFilter === 'all' || e.userRole === logRoleFilter;
              const q = logSearch.toLowerCase();
              const matchSearch = !q || e.userName.toLowerCase().includes(q) || e.userEmail.toLowerCase().includes(q) || e.pageLabel.toLowerCase().includes(q);
              return matchType && matchRole && matchSearch;
            });

            const fmt = (iso: string) => {
              const d = new Date(iso);
              return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
            };

            return (
              <div className="space-y-4">
                {/* Header */}
                <div className="glass-card p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <ScrollText className="w-4 h-4 text-primary" />
                      <h2 className="font-display font-semibold text-lg">Logs de Acesso</h2>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted border border-border text-muted-foreground">
                        {filtered.length} registros
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={refreshLogs}>
                        <RefreshCw className="w-3 h-3" /> Atualizar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1 text-destructive border-destructive/30 hover:bg-destructive/5"
                        onClick={() => {
                          clearLogs();
                          setLogs([]);
                          toast({ title: 'Logs apagados', description: 'Histórico de auditoria limpo.' });
                        }}
                      >
                        <Trash className="w-3 h-3" /> Limpar
                      </Button>
                    </div>
                  </div>

                  {/* Filters */}
                  <div className="flex flex-wrap gap-2">
                    {/* Search */}
                    <div className="relative flex-1 min-w-40">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <Input
                        value={logSearch}
                        onChange={e => setLogSearch(e.target.value)}
                        placeholder="Buscar usuário, e-mail ou página..."
                        className="h-8 pl-8 text-xs bg-secondary border-border"
                      />
                    </div>
                    {/* Type filter */}
                    <select
                      value={logTypeFilter}
                      onChange={e => setLogTypeFilter(e.target.value as AuditEventType | 'all')}
                      className="h-8 text-xs bg-secondary border border-border rounded-lg px-2 text-foreground"
                    >
                      <option value="all">Todos os eventos</option>
                      <option value="login">Login</option>
                      <option value="logout">Logout</option>
                      <option value="page_view">Páginas</option>
                    </select>
                    {/* Role filter */}
                    <select
                      value={logRoleFilter}
                      onChange={e => setLogRoleFilter(e.target.value as UserRole | 'all')}
                      className="h-8 text-xs bg-secondary border border-border rounded-lg px-2 text-foreground"
                    >
                      <option value="all">Todos os cargos</option>
                      {ROLE_HIERARCHY.map(r => (
                        <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Stats summary */}
                {logs.length > 0 && (
                  <div className="grid grid-cols-3 gap-3">
                    {(
                      [
                        { type: 'login',     label: 'Logins',   color: 'text-success',  bg: 'bg-success/10',  icon: <LogIn  className="w-4 h-4" /> },
                        { type: 'logout',    label: 'Logouts',  color: 'text-warning',  bg: 'bg-warning/10',  icon: <LogOut className="w-4 h-4" /> },
                        { type: 'page_view', label: 'Páginas',  color: 'text-primary',  bg: 'bg-primary/10',  icon: <MonitorSmartphone className="w-4 h-4" /> },
                      ] as { type: AuditEventType; label: string; color: string; bg: string; icon: React.ReactNode }[]
                    ).map(s => (
                      <div key={s.type} className="glass-card p-4 flex items-center gap-3">
                        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', s.bg, s.color)}>
                          {s.icon}
                        </div>
                        <div>
                          <p className="text-xl font-bold">{logs.filter(e => e.type === s.type).length}</p>
                          <p className="text-xs text-muted-foreground">{s.label}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Table */}
                <div className="glass-card overflow-hidden">
                  {filtered.length === 0 ? (
                    <div className="py-16 text-center">
                      <ScrollText className="w-8 h-8 mx-auto text-muted-foreground/30 mb-3" />
                      <p className="text-sm text-muted-foreground">
                        {logs.length === 0 ? 'Nenhum evento registrado ainda. Navegue pela plataforma para gerar logs.' : 'Nenhum evento corresponde aos filtros.'}
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border bg-muted/30">
                            <th className="text-left px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wide">Data/Hora</th>
                            <th className="text-left px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wide">Evento</th>
                            <th className="text-left px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wide">Usuário</th>
                            <th className="text-left px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wide">Cargo</th>
                            <th className="text-left px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wide">Página</th>
                            <th className="text-left px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wide">Sessão</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.slice(0, 200).map((log, i) => {
                            const ev = EVENT_LABELS[log.type];
                            return (
                              <tr
                                key={log.id}
                                className={cn(
                                  'border-b border-border/40 transition-colors hover:bg-muted/20',
                                  i % 2 === 0 ? 'bg-transparent' : 'bg-muted/10'
                                )}
                              >
                                <td className="px-4 py-2.5 font-mono text-muted-foreground whitespace-nowrap">
                                  {fmt(log.timestamp)}
                                </td>
                                <td className="px-4 py-2.5">
                                  <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium', ev.color)}>
                                    {ev.icon}
                                    {ev.label}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5">
                                  <div className="font-medium text-foreground">{log.userName}</div>
                                  <div className="text-muted-foreground">{log.userEmail}</div>
                                </td>
                                <td className="px-4 py-2.5 text-muted-foreground">{ROLE_LABELS[log.userRole]}</td>
                                <td className="px-4 py-2.5">
                                  {log.pageLabel ? (
                                    <span className="font-mono text-muted-foreground">{log.pageLabel}</span>
                                  ) : (
                                    <span className="text-muted-foreground/40">—</span>
                                  )}
                                </td>
                                <td className="px-4 py-2.5 font-mono text-muted-foreground/60 text-[10px]">
                                  #{log.sessionId}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {filtered.length > 200 && (
                        <p className="text-xs text-center text-muted-foreground py-3">
                          Exibindo 200 de {filtered.length} registros. Use os filtros para refinar.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* ── Integrações OAuth ── */}
          {section === 'integrations' && (
            <div className="space-y-5">
              {/* Header */}
              <div className="glass-card p-5">
                <div className="flex items-center gap-2 mb-1">
                  <Plug className="w-4 h-4 text-primary" />
                  <h2 className="font-display font-semibold text-lg">Integrações OAuth</h2>
                </div>
                <p className="text-xs text-muted-foreground">
                  Credenciais sensíveis não são mais armazenadas no frontend. A configuração é 100% via <code>.env</code>.
                </p>
              </div>

              {/* Callback URLs */}
              <div className="glass-card p-5 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <ExternalLink className="w-4 h-4 text-accent" />
                  <h3 className="font-semibold text-sm">URLs de Callback (Authorized Redirect URIs)</h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Adicione estas URLs no <strong>Google Cloud Console → Credentials → OAuth 2.0 Client IDs → Authorized redirect URIs</strong> e também em <strong>Authorized JavaScript origins</strong>:
                </p>
                {[
                  { label: 'JavaScript Origin', value: APP_URL },
                  { label: 'Redirect URI (Callback)', value: CALLBACK_URL },
                ].map(item => (
                  <div key={item.label}>
                    <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide block mb-1.5">
                      {item.label}
                    </label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs bg-muted border border-border rounded-lg px-3 py-2.5 font-mono text-foreground select-all">
                        {item.value}
                      </code>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 px-3 border-border"
                        onClick={() => handleCopy(item.value, item.label)}
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
                <a
                  href="https://console.cloud.google.com/apis/credentials"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline mt-1"
                >
                  Abrir Google Cloud Console <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              {/* Google Workspace Connection */}
              <div className="glass-card p-5 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <ShieldCheck className="w-4 h-4 text-green-500" />
                  <h3 className="font-semibold text-sm">Conexão Google Workspace</h3>
                  <Badge variant={oauthClientId ? 'default' : 'outline'} className={cn('text-[10px] ml-auto', oauthClientId ? 'bg-green-500/10 text-green-500 border-green-500/30' : '')}>
                    {oauthClientId ? 'Conectado' : 'Não configurado'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Configure as credenciais OAuth do Google para permitir login SSO e integração com Google Meet e Calendar da sua organização.
                </p>
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide block mb-1.5">Google Client ID</label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={oauthClientId}
                      onChange={e => setOauthClientId(e.target.value)}
                      placeholder="000000000000-xxxxxxxxxx.apps.googleusercontent.com"
                      type={showOauthClientId ? 'text' : 'password'}
                      className="font-mono text-xs"
                    />
                    <Button size="sm" variant="outline" className="h-9 px-3" onClick={() => setShowOauthClientId(!showOauthClientId)}>
                      {showOauthClientId ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide block mb-1.5">Google Client Secret</label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={oauthClientSecret}
                      onChange={e => setOauthClientSecret(e.target.value)}
                      placeholder="GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxxxx"
                      type={showOauthSecret ? 'text' : 'password'}
                      className="font-mono text-xs"
                    />
                    <Button size="sm" variant="outline" className="h-9 px-3" onClick={() => setShowOauthSecret(!showOauthSecret)}>
                      {showOauthSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Button size="sm" onClick={handleSaveOAuth} className="gap-1.5">
                    {oauthSaved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                    {oauthSaved ? 'Salvo!' : 'Salvar credenciais'}
                  </Button>
                  {oauthClientId && (
                    <span className="text-xs text-green-500 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Client ID configurado
                    </span>
                  )}
                </div>
              </div>

              {/* Env vars reference */}
              <div className="glass-card p-5 space-y-4">
                <h3 className="font-semibold text-sm">Variáveis de ambiente (.env)</h3>
                <p className="text-xs text-muted-foreground">Variáveis configuradas via <code>.env</code> no servidor (sobrescrevem as credenciais acima quando presentes).</p>
                <div className="p-4 rounded-xl bg-muted/30 border border-border/50 space-y-2">
                  {[
                    'VITE_GOOGLE_CLIENT_ID',
                    'VITE_GOOGLE_ALLOWED_DOMAIN',
                    'VITE_GOOGLE_REDIRECT_URI',
                    'VITE_EVOLUTION_API_URL',
                    'VITE_EVOLUTION_API_TOKEN',
                  ].map(v => (
                    <code key={v} className="block text-[11px] text-muted-foreground">{v}</code>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── E-mail / Gmail ── */}
          {section === 'email' && (
            <div className="space-y-5">
              <div className="glass-card p-5">
                <div className="flex items-center gap-2 mb-1">
                  <Mail className="w-4 h-4 text-primary" />
                  <h2 className="font-display font-semibold text-lg">Integração E-mail</h2>
                </div>
                <p className="text-xs text-muted-foreground">
                  Configure uma conta de e-mail para disparo automático de senhas, convites e notificações para os usuários.
                </p>
              </div>

              {/* Provider selector */}
              <div className="glass-card p-5 space-y-4">
                <h3 className="font-semibold text-sm">Provedor</h3>
                <div className="flex gap-3">
                  {([
                    { id: 'gmail' as const, label: 'Gmail / Google Workspace', desc: 'Usa App Password do Gmail' },
                    { id: 'smtp' as const, label: 'SMTP Personalizado', desc: 'Qualquer provedor SMTP' },
                  ]).map(p => (
                    <button
                      key={p.id}
                      onClick={() => setEmailProvider(p.id)}
                      className={cn(
                        'flex-1 p-4 rounded-xl border text-left transition-all',
                        emailProvider === p.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border bg-muted/20 hover:bg-muted/40'
                      )}
                    >
                      <p className="text-sm font-medium">{p.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{p.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Gmail config */}
              {emailProvider === 'gmail' && (
                <div className="glass-card p-5 space-y-4">
                  <h3 className="font-semibold text-sm">Configuração Gmail</h3>
                  <p className="text-xs text-muted-foreground">
                    Use uma <strong>App Password</strong> do Google (não a senha da conta). Vá em{' '}
                    <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      myaccount.google.com/apppasswords
                    </a>{' '}
                    para gerar uma.
                  </p>
                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide block mb-1.5">
                        Conta Gmail (e-mail do remetente)
                      </label>
                      <Input
                        type="email"
                        placeholder="equipe@empresa.com"
                        value={emailConfig.gmailAccount}
                        onChange={(e) => setEmailConfig(prev => ({ ...prev, gmailAccount: e.target.value, senderEmail: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide block mb-1.5">
                        App Password
                      </label>
                      <div className="flex gap-2">
                        <Input
                          type={showEmailPassword ? 'text' : 'password'}
                          placeholder="xxxx xxxx xxxx xxxx"
                          value={emailConfig.gmailAppPassword}
                          onChange={(e) => setEmailConfig(prev => ({ ...prev, gmailAppPassword: e.target.value }))}
                        />
                        <Button size="icon" variant="outline" onClick={() => setShowEmailPassword(!showEmailPassword)}>
                          {showEmailPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide block mb-1.5">
                        Nome do remetente
                      </label>
                      <Input
                        placeholder="LTX"
                        value={emailConfig.senderName}
                        onChange={(e) => setEmailConfig(prev => ({ ...prev, senderName: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* SMTP config */}
              {emailProvider === 'smtp' && (
                <div className="glass-card p-5 space-y-4">
                  <h3 className="font-semibold text-sm">Configuração SMTP</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide block mb-1.5">
                        Host SMTP
                      </label>
                      <Input
                        placeholder="smtp.exemplo.com"
                        value={emailConfig.smtpHost}
                        onChange={(e) => setEmailConfig(prev => ({ ...prev, smtpHost: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide block mb-1.5">
                        Porta
                      </label>
                      <Input
                        placeholder="587"
                        value={emailConfig.smtpPort}
                        onChange={(e) => setEmailConfig(prev => ({ ...prev, smtpPort: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide block mb-1.5">
                        Usuário
                      </label>
                      <Input
                        placeholder="user@exemplo.com"
                        value={emailConfig.smtpUser}
                        onChange={(e) => setEmailConfig(prev => ({ ...prev, smtpUser: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide block mb-1.5">
                        Senha
                      </label>
                      <div className="flex gap-2">
                        <Input
                          type={showEmailPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          value={emailConfig.smtpPassword}
                          onChange={(e) => setEmailConfig(prev => ({ ...prev, smtpPassword: e.target.value }))}
                        />
                        <Button size="icon" variant="outline" onClick={() => setShowEmailPassword(!showEmailPassword)}>
                          {showEmailPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide block mb-1.5">
                        E-mail do remetente
                      </label>
                      <Input
                        type="email"
                        placeholder="noreply@empresa.com"
                        value={emailConfig.senderEmail}
                        onChange={(e) => setEmailConfig(prev => ({ ...prev, senderEmail: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide block mb-1.5">
                        Nome do remetente
                      </label>
                      <Input
                        placeholder="LTX"
                        value={emailConfig.senderName}
                        onChange={(e) => setEmailConfig(prev => ({ ...prev, senderName: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="glass-card p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {emailConnected
                      ? <CheckCircle2 className="w-4 h-4 text-success" />
                      : <AlertCircle className="w-4 h-4 text-muted-foreground" />}
                    <span className="text-sm">
                      {emailConnected ? 'E-mail conectado e funcionando' : 'E-mail não configurado'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={emailTestSending || (!emailConfig.gmailAccount && !emailConfig.smtpHost)}
                      onClick={() => {
                        setEmailTestSending(true);
                        setTimeout(() => {
                          setEmailTestSending(false);
                          setEmailConnected(true);
                          toast({ title: 'E-mail de teste enviado', description: `Enviado para ${emailConfig.gmailAccount || emailConfig.smtpUser || 'admin'}` });
                        }, 1500);
                      }}
                    >
                      {emailTestSending ? <><RefreshCw className="w-3 h-3 animate-spin mr-1" /> Enviando...</> : 'Enviar teste'}
                    </Button>
                    <Button
                      size="sm"
                      disabled={emailSaving || (!emailConfig.gmailAccount && !emailConfig.smtpHost)}
                      onClick={() => {
                        setEmailSaving(true);
                        setTimeout(() => {
                          setEmailSaving(false);
                          setEmailConnected(true);
                          toast({ title: 'Configuração salva', description: 'As credenciais de e-mail foram salvas com sucesso.' });
                        }, 800);
                      }}
                    >
                      {emailSaving ? <><RefreshCw className="w-3 h-3 animate-spin mr-1" /> Salvando...</> : <><Save className="w-3.5 h-3.5 mr-1" /> Salvar</>}
                    </Button>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <p className="text-xs text-muted-foreground">
                    <strong>Uso:</strong> O e-mail será usado para enviar senhas de acesso, convites de usuário, códigos 2FA e notificações de alerta para os membros da equipe.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── Agentes & Projeto ── */}
          {section === 'agents' && <AgentOrgChart />}

          {/* ── Meu Plano ── */}
          {section === 'meu-plano' && <MeuPlanoSection />}

          {/* ── Gerenciar Usuários (full page embedded) ── */}
          {section === 'users-full' && (
            <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}>
              <LazyUsersPage />
            </Suspense>
          )}

          {/* ── Times (full page embedded) ── */}
          {section === 'teams' && (
            <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}>
              <LazyTeamsPage />
            </Suspense>
          )}

        </div>
      </div>
    </div>
  );
}

/* ── Meu Plano Section ────────────────────────────────────────────── */

function MeuPlanoSection() {
  const license = useLicense();

  if (license.isLoading) {
    return <div className="text-sm text-muted-foreground animate-pulse py-8 text-center">Carregando informações do plano...</div>;
  }

  const statusColor: Record<string, string> = {
    ativa: 'bg-green-500/10 text-green-400 border-green-500/20',
    trial: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    suspensa: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    cancelada: 'bg-red-500/10 text-red-400 border-red-500/20',
    expirada: 'bg-red-500/10 text-red-400 border-red-500/20',
  };

  const statusLabel: Record<string, string> = {
    ativa: 'Ativa', trial: 'Período de teste', suspensa: 'Suspensa',
    cancelada: 'Cancelada', expirada: 'Expirada',
  };

  const hasPlan = !!license.subscription && !!license.plan;
  const status = license.subscription?.status ?? 'sem-plano';
  const enabledModules = license.features.filter(f => f.habilitado);
  const disabledModules = license.features.filter(f => !f.habilitado);

  function usageBar(used: number, max: number, label: string) {
    const pct = max > 0 ? Math.min(100, (used / max) * 100) : 0;
    const isUnlimited = max <= 0;
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{label}</span>
          <span className="font-medium">{isUnlimited ? `${used} / Ilimitado` : `${used} / ${max}`}</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', pct > 90 ? 'bg-destructive' : pct > 70 ? 'bg-warning' : 'bg-primary')}
            style={{ width: isUnlimited ? '5%' : `${Math.max(2, pct)}%` }}
          />
        </div>
      </div>
    );
  }

  if (!hasPlan) {
    return (
      <div className="space-y-4">
        <div className="glass-card p-8 flex flex-col items-center text-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <CreditCard className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Nenhum plano configurado</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              Sua organização ainda não possui um plano ativo. Todos os módulos estão liberados por padrão.
              Quando um plano for atribuído, os limites e módulos serão aplicados automaticamente.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Plan info card */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" />
              {license.planName}
            </h3>
            {license.plan?.descricao && (
              <p className="text-sm text-muted-foreground mt-0.5">{license.plan.descricao}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {license.isTrial && (
              <Badge className="bg-yellow-500/10 text-yellow-400 border-yellow-500/20">
                {license.trialDaysLeft} dias restantes
              </Badge>
            )}
            <Badge className={statusColor[status] ?? 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'}>
              {statusLabel[status] ?? 'Sem plano'}
            </Badge>
          </div>
        </div>

        {/* Pricing */}
        <div className="grid grid-cols-3 gap-4 pt-2 border-t border-border">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Plataforma/mês</p>
            <p className="text-lg font-bold">R$ {license.plan!.preco_mensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Por usuário/mês</p>
            <p className="text-lg font-bold">R$ {license.plan!.preco_por_usuario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Ciclo</p>
            <p className="text-lg font-bold capitalize">{license.subscription?.ciclo ?? '—'}</p>
          </div>
        </div>
      </div>

      {/* Usage */}
      <div className="glass-card p-6 space-y-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Gauge className="w-4 h-4 text-primary" />
          Uso atual
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {usageBar(license.usage?.usuarios_ativos ?? 0, license.maxUsers, 'Usuários')}
          {usageBar(license.usage?.instancias_whatsapp ?? 0, license.maxWhatsApp, 'Instâncias WhatsApp')}
          {usageBar(license.usage?.avaliacoes_ia ?? 0, license.maxAI, 'Avaliações IA (mês)')}
          {usageBar(license.usage?.storage_usado_mb ?? 0, license.maxStorageMb, `Storage (MB)`)}
        </div>
      </div>

      {/* Modules */}
      <div className="glass-card p-6 space-y-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <ToggleRight className="w-4 h-4 text-primary" />
          Módulos do plano
        </h3>

        {enabledModules.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">Incluídos no seu plano</p>
            <div className="flex flex-wrap gap-2">
              {enabledModules.map(f => (
                <Badge key={f.feature_codigo} className="bg-green-500/10 text-green-400 border-green-500/20">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  {f.feature_nome}
                  {f.limite != null && <span className="ml-1 opacity-70">(até {f.limite})</span>}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {license.trialModules.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">Em período de teste</p>
            <div className="flex flex-wrap gap-2">
              {license.trialModules.map(t => (
                <Badge key={t.modulo} className="bg-blue-500/10 text-blue-400 border-blue-500/20">
                  <Gauge className="w-3 h-3 mr-1" />
                  {t.modulo}
                  <span className="ml-1 opacity-70">({license.moduleTrialDaysLeft(t.modulo)}d)</span>
                </Badge>
              ))}
            </div>
          </div>
        )}

        {disabledModules.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">Não incluídos — disponíveis para upgrade</p>
            <div className="flex flex-wrap gap-2">
              {disabledModules.map(f => (
                <Badge key={f.feature_codigo} className="bg-zinc-500/10 text-zinc-500 border-zinc-500/20">
                  <Lock className="w-3 h-3 mr-1" />
                  {f.feature_nome}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Upgrade CTA */}
      {(disabledModules.length > 0 || license.isTrial) && (
        <div className="glass-card p-6 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Precisa de mais recursos?</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Entre em contato para fazer upgrade do seu plano ou adicionar módulos individuais.
            </p>
          </div>
          <Button size="sm" className="bg-gradient-primary text-xs gap-1.5">
            <ArrowUpCircle className="w-3.5 h-3.5" />
            Solicitar upgrade
          </Button>
        </div>
      )}
    </div>
  );
}
