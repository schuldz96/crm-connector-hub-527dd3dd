import { useState, useEffect, useCallback } from 'react';
import { MOCK_USERS, MOCK_TEAMS, MOCK_AREAS } from '@/data/mockData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Shield, Users, Building2, Key,
  ChevronRight, CheckCircle2, AlertCircle, Save, Eye, EyeOff,
  Lock, ToggleLeft, ToggleRight, SlidersHorizontal,
  Layers, Plus, Trash2, ChevronDown, ChevronUp, GitBranch,
  ScrollText, LogIn, LogOut, MonitorSmartphone, Search, RefreshCw, Trash,
  Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppConfig, DEFAULT_MODULES, type ModuleId } from '@/contexts/AppConfigContext';
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

const ADMIN_SECTIONS = [
  { id: 'company',    label: 'Empresa',              icon: Building2 },
  { id: 'roles',      label: 'Níveis de Acesso',     icon: Layers },
  { id: 'users',      label: 'Usuários',             icon: Users },
  { id: 'api-keys',   label: 'Tokens OpenAI',        icon: Key },
  { id: 'modules',    label: 'Módulos Visíveis',     icon: ToggleRight },
  { id: 'security',   label: 'Segurança & RLS',      icon: Lock },
  { id: 'logs',       label: 'Logs de Acesso',       icon: ScrollText },
];

const TOKEN_FIELDS: { key: keyof import('@/contexts/AppConfigContext').OpenAITokens; label: string; desc: string; icon: string }[] = [
  { key: 'meetings',    label: 'Token — Reuniões',                icon: '🎙️', desc: 'Análise e transcrição de reuniões gravadas' },
  { key: 'training',    label: 'Token — Treinamentos (voz)',       icon: '🎓', desc: 'Simulação de voz em tempo real com a IA' },
  { key: 'whatsapp',    label: 'Token — WhatsApp / Conversas',    icon: '💬', desc: 'Análise e sugestão nas conversas do WhatsApp' },
  { key: 'reports',     label: 'Token — Relatórios & Insights',   icon: '📊', desc: 'Geração automática de relatórios com IA' },
  { key: 'automations', label: 'Token — Automações',              icon: '⚡', desc: 'IA nos gatilhos e ações das automações' },
];

// Role color badge classes
const roleColorMap: Record<string, { bg: string; text: string; border: string }> = {
  destructive:        { bg: 'bg-destructive/10',       text: 'text-destructive',       border: 'border-destructive/20' },
  primary:            { bg: 'bg-primary/10',           text: 'text-primary',           border: 'border-primary/20' },
  accent:             { bg: 'bg-accent/15',            text: 'text-accent',            border: 'border-accent/30' },
  warning:            { bg: 'bg-warning/10',           text: 'text-warning',           border: 'border-warning/20' },
  success:            { bg: 'bg-success/10',           text: 'text-success',           border: 'border-success/20' },
  'muted-foreground': { bg: 'bg-muted',                text: 'text-muted-foreground',  border: 'border-border' },
};

const SCOPE_ICONS: Record<string, string> = {
  all: '🌐', area: '🏢', team: '👥', self: '👤',
};

export default function AdminPage() {
  const [section, setSection] = useState('roles');
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [moduleTarget, setModuleTarget] = useState<'global' | string>('global');
  const [selectedRole, setSelectedRole] = useState<UserRole>('ceo');
  const [expandedRole, setExpandedRole] = useState<UserRole | null>('ceo');

  // Audit logs state
  const [logs, setLogs] = useState<AuditEvent[]>([]);
  const [logSearch, setLogSearch] = useState('');
  const [logTypeFilter, setLogTypeFilter] = useState<AuditEventType | 'all'>('all');
  const [logRoleFilter, setLogRoleFilter] = useState<UserRole | 'all'>('all');

  const { tokens, setToken, modules, setModuleEnabled, saveConfig,
          getUserDisabledModules, setUserModuleOverride } = useAppConfig();
  const { permissions, updatePermission } = useRolePermissions();
  const { getLogs, clearLogs } = useAuditLog();
  const { toast } = useToast();

  // Load logs whenever the tab is selected
  useEffect(() => {
    if (section === 'logs') {
      setLogs(getLogs());
    }
  }, [section, getLogs]);

  const refreshLogs = () => setLogs(getLogs());

  const toggleKey = (k: string) => setShowKey(prev => ({ ...prev, [k]: !prev[k] }));

  const handleSaveTokens = () => {
    saveConfig();
    toast({ title: 'Tokens salvos', description: 'Configurações de API atualizadas com sucesso.' });
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
  const orgLevels = ROLE_HIERARCHY.map(role => ({
    role,
    perm: permissions.find(p => p.role === role),
    users: MOCK_USERS.filter(u => u.role === role),
  }));

  return (
    <div className="page-container animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold">Painel Administrativo</h1>
        <p className="text-sm text-muted-foreground">Configurações globais da plataforma</p>
      </div>

      <div className="flex gap-6">
        {/* Menu */}
        <div className="w-56 flex-shrink-0">
          <nav className="space-y-1">
            {ADMIN_SECTIONS.map(s => (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                className={cn('w-full nav-item', section === s.id && 'active')}
              >
                <s.icon className="w-4 h-4 flex-shrink-0" />
                <span>{s.label}</span>
                {section !== s.id && <ChevronRight className="w-3 h-3 ml-auto text-muted-foreground/50" />}
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
                  { label: 'Nome da Empresa', value: 'Appmax', placeholder: 'Sua empresa' },
                  { label: 'Domínio', value: 'appmax.com.br', placeholder: 'dominio.com.br' },
                  { label: 'CNPJ', value: '', placeholder: '00.000.000/0001-00' },
                  { label: 'Email de Contato', value: 'admin@appmax.com.br', placeholder: 'admin@empresa.com' },
                ].map(f => (
                  <div key={f.label}>
                    <label className="text-xs font-medium block mb-1.5">{f.label}</label>
                    <Input defaultValue={f.value} placeholder={f.placeholder} className="h-9 text-sm bg-secondary border-border" />
                  </div>
                ))}
              </div>
              <Button size="sm" className="bg-gradient-primary text-xs">
                <Save className="w-3 h-3 mr-1" /> Salvar Alterações
              </Button>
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
                  {orgLevels.map((item, idx) => {
                    const color = roleColorMap[item.perm?.color ?? 'muted-foreground'];
                    const isAdmin = item.role === 'admin';
                    return (
                      <div key={item.role}>
                        {/* Indent line */}
                        <div className="flex items-stretch gap-0">
                          {/* Left indent bars */}
                          {Array.from({ length: idx }).map((_, i) => (
                            <div key={i} className="w-5 flex-shrink-0 flex justify-center">
                              <div className="w-px bg-border/50 h-full" />
                            </div>
                          ))}
                          {/* Row */}
                          <div className="flex-1">
                            <button
                              onClick={() => setExpandedRole(expandedRole === item.role ? null : item.role)}
                              className={cn(
                                'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all text-left',
                                expandedRole === item.role
                                  ? `${color.bg} ${color.border} border`
                                  : 'border-border/30 hover:bg-muted/30'
                              )}
                            >
                              {/* Hierarchy level dot */}
                              <div className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', color.bg, `border ${color.border}`)}>
                                <div className={cn('w-full h-full rounded-full', color.text.replace('text-', 'bg-'))} />
                              </div>
                              <span className={cn('text-sm font-semibold', color.text)}>{ROLE_LABELS[item.role]}</span>
                              {isAdmin && <Lock className="w-3 h-3 text-muted-foreground" />}
                              <span className="text-[10px] text-muted-foreground ml-1">
                                {SCOPE_ICONS[item.perm?.scope ?? 'self']} {SCOPE_LABELS[item.perm?.scope ?? 'self']}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground ml-auto">
                                {item.users.length} {item.users.length === 1 ? 'usuário' : 'usuários'}
                              </span>
                              {expandedRole === item.role
                                ? <ChevronUp className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                                : <ChevronDown className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
                            </button>

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
              </div>

              {/* Areas */}
              <div className="glass-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-accent" />
                    <h2 className="font-display font-semibold">Áreas da Empresa</h2>
                  </div>
                  <Button size="sm" variant="outline" className="text-xs h-7 gap-1">
                    <Plus className="w-3 h-3" /> Nova Área
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  Áreas agrupam times sob um Gerente. Coordenadores e abaixo enxergam apenas dentro da sua área.
                </p>
                <div className="space-y-3">
                  {MOCK_AREAS.map(area => {
                    const manager = MOCK_USERS.find(u => u.id === area.managerId);
                    const areaTeams = MOCK_TEAMS.filter(t => area.teamIds.includes(t.id));
                    const areaMembers = MOCK_USERS.filter(u => u.areaId === area.id);
                    return (
                      <div key={area.id} className="p-4 rounded-xl border border-border/60 bg-muted/10 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold">{area.name}</p>
                            {manager && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                <img src={manager.avatar} alt={manager.name} className="w-3.5 h-3.5 rounded-full" />
                                Gerente: {manager.name}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>{areaTeams.length} times</span>
                            <span>{areaMembers.length} pessoas</span>
                          </div>
                        </div>
                        {/* Teams in area */}
                        <div className="flex flex-wrap gap-1.5">
                          {areaTeams.map(team => {
                            const sup = MOCK_USERS.find(u => u.id === team.supervisorId);
                            return (
                              <div key={team.id} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-secondary border border-border">
                                <span>👥</span> {team.name}
                                {sup && <span className="text-muted-foreground">· {sup.name.split(' ')[0]}</span>}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
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
            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-display font-semibold text-lg">Usuários & Permissões</h2>
                <Button size="sm" className="text-xs bg-gradient-primary h-8">+ Convidar</Button>
              </div>
              <div className="space-y-2">
                {MOCK_USERS.map(u => {
                  const perm = permissions.find(p => p.role === u.role);
                  const color = roleColorMap[perm?.color ?? 'muted-foreground'];
                  return (
                    <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/30 transition-colors">
                      <img src={u.avatar} alt={u.name} className="w-8 h-8 rounded-full border border-border" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{u.name}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                      <span className={cn('text-[10px] px-2 py-0.5 rounded-full border font-medium', color.bg, color.text, color.border)}>
                        {ROLE_LABELS[u.role]}
                      </span>
                      <select
                        defaultValue={u.role}
                        className="text-xs bg-secondary border border-border rounded-lg px-2 py-1 text-foreground"
                      >
                        {ROLE_HIERARCHY.map(r => (
                          <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                        ))}
                      </select>
                      <span className={cn('w-2 h-2 rounded-full', u.status === 'active' ? 'bg-success' : 'bg-muted-foreground')} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Tokens OpenAI ── */}
          {section === 'api-keys' && (
            <div className="glass-card p-6 space-y-5">
              <div>
                <h2 className="font-display font-semibold text-lg">Tokens OpenAI por Módulo</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Configure chaves separadas por funcionalidade para controle granular de custos.
                </p>
              </div>
              <div className="space-y-4">
                {TOKEN_FIELDS.map(f => (
                  <div key={f.key} className="p-4 rounded-xl bg-muted/30 border border-border/50 space-y-2">
                    <div>
                      <label className="text-xs font-semibold flex items-center gap-1.5 mb-0.5">
                        <span>{f.icon}</span> {f.label}
                      </label>
                      <p className="text-[10px] text-muted-foreground">{f.desc}</p>
                    </div>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          type={showKey[f.key] ? 'text' : 'password'}
                          value={tokens[f.key]}
                          onChange={e => setToken(f.key, e.target.value)}
                          placeholder="sk-proj-..."
                          className="h-9 text-xs bg-secondary border-border pr-10 font-mono"
                        />
                        <button
                          onClick={() => toggleKey(f.key)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                        >
                          {showKey[f.key] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <div className={cn(
                        'flex items-center px-2 rounded-lg text-[10px] font-medium border',
                        tokens[f.key].startsWith('sk-')
                          ? 'bg-success/10 text-success border-success/20'
                          : 'bg-muted text-muted-foreground border-border'
                      )}>
                        {tokens[f.key].startsWith('sk-') ? '✓ OK' : 'Vazio'}
                      </div>
                    </div>
                  </div>
                ))}
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <p className="text-xs text-muted-foreground">
                    🔐 As chaves ficam salvas no armazenamento local do seu dispositivo.
                  </p>
                </div>
                <Button size="sm" className="bg-gradient-primary text-xs" onClick={handleSaveTokens}>
                  <Save className="w-3 h-3 mr-1" /> Salvar Tokens
                </Button>
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
            <div className="glass-card p-6 space-y-5">
              <h2 className="font-display font-semibold text-lg">Segurança & Row Level Security</h2>
              <div className="space-y-3">
                {[
                  { label: 'RLS habilitado nas tabelas',  status: true,  desc: 'Usuários só acessam dados autorizados pelo seu role' },
                  { label: 'Auth 2FA disponível',          status: false, desc: 'Autenticação de dois fatores para maior segurança' },
                  { label: 'Logs de auditoria',            status: true,  desc: 'Registro de todas as ações críticas' },
                  { label: 'Sessões com expiração',        status: true,  desc: 'Tokens expiram após 7 dias de inatividade' },
                ].map(item => (
                  <div key={item.label} className="flex items-start gap-3 p-3 rounded-xl bg-muted/30">
                    {item.status
                      ? <CheckCircle2 className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                      : <AlertCircle  className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />}
                    <div>
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                    <span className={cn(
                      'ml-auto text-xs px-2 py-0.5 rounded-full border flex-shrink-0',
                      item.status
                        ? 'bg-success/10 text-success border-success/20'
                        : 'bg-warning/10 text-warning border-warning/20'
                    )}>
                      {item.status ? 'Ativo' : 'Pendente'}
                    </span>
                  </div>
                ))}
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

        </div>
      </div>
    </div>
  );
}
