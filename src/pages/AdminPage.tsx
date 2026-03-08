import { useState } from 'react';
import { MOCK_USERS, MOCK_TEAMS } from '@/data/mockData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Shield, Users, Plug2, Bell, Building2, Key,
  ChevronRight, CheckCircle2, AlertCircle, Save, Eye, EyeOff,
  TrendingUp, Lock, ToggleLeft, ToggleRight, SlidersHorizontal
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppConfig, DEFAULT_MODULES, type ModuleId } from '@/contexts/AppConfigContext';
import { useToast } from '@/hooks/use-toast';

const ADMIN_SECTIONS = [
  { id: 'company',      label: 'Empresa',              icon: Building2 },
  { id: 'users',        label: 'Usuários & Permissões', icon: Users },
  { id: 'api-keys',     label: 'Tokens OpenAI',         icon: Key },
  { id: 'modules',      label: 'Módulos Visíveis',      icon: ToggleRight },
  { id: 'security',     label: 'Segurança & RLS',       icon: Lock },
  { id: 'notifications',label: 'Notificações',          icon: Bell },
  { id: 'billing',      label: 'Plano & Faturamento',   icon: TrendingUp },
];

const TOKEN_FIELDS: { key: keyof import('@/contexts/AppConfigContext').OpenAITokens; label: string; desc: string; icon: string }[] = [
  { key: 'meetings',    label: 'Token — Reuniões',                icon: '🎙️', desc: 'Análise e transcrição de reuniões gravadas' },
  { key: 'training',    label: 'Token — Treinamentos (voz)',       icon: '🎓', desc: 'Simulação de voz em tempo real com a IA' },
  { key: 'whatsapp',    label: 'Token — WhatsApp / Conversas',    icon: '💬', desc: 'Análise e sugestão nas conversas do WhatsApp' },
  { key: 'reports',     label: 'Token — Relatórios & Insights',   icon: '📊', desc: 'Geração automática de relatórios com IA' },
  { key: 'automations', label: 'Token — Automações',              icon: '⚡', desc: 'IA nos gatilhos e ações das automações' },
];

export default function AdminPage() {
  const [section, setSection] = useState('company');
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [moduleTarget, setModuleTarget] = useState<'global' | string>('global'); // 'global' | userId | teamId
  const { tokens, setToken, modules, setModuleEnabled, saveConfig,
          getUserDisabledModules, setUserModuleOverride } = useAppConfig();
  const { toast } = useToast();

  const toggleKey = (k: string) => setShowKey(prev => ({ ...prev, [k]: !prev[k] }));

  const handleSaveTokens = () => {
    saveConfig();
    toast({ title: 'Tokens salvos', description: 'Configurações de API atualizadas com sucesso.' });
  };

  const isLocked = (id: ModuleId) => id === 'admin';

  // For per-user/team module overrides
  const targetDisabled = moduleTarget === 'global' ? [] : getUserDisabledModules(moduleTarget);
  const toggleTargetModule = (id: ModuleId) => {
    if (moduleTarget === 'global') {
      setModuleEnabled(id, !!modules.find(m => m.id === id && !m.enabled));
      return;
    }
    const cur = getUserDisabledModules(moduleTarget);
    const next = cur.includes(id) ? cur.filter(m => m !== id) : [...cur, id];
    setUserModuleOverride(moduleTarget, next);
    toast({ title: 'Salvo', description: 'Permissões de módulo atualizadas.' });
  };

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
        <div className="flex-1 space-y-4">

          {/* ── Empresa ── */}
          {section === 'company' && (
            <div className="glass-card p-6 space-y-5">
              <h2 className="font-display font-semibold text-lg">Configurações da Empresa</h2>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Nome da Empresa', value: 'Appmax', placeholder: 'Sua empresa' },
                  { label: 'Domínio', value: 'appmax.com.br', placeholder: 'dominio.com.br' },
                  { label: 'CNPJ', value: '', placeholder: '00.000.000/0001-00' },
                  { label: 'Email de Contato', value: 'admin@dealintel.com.br', placeholder: 'admin@empresa.com' },
                ].map(f => (
                  <div key={f.label}>
                    <label className="text-xs font-medium block mb-1.5">{f.label}</label>
                    <Input defaultValue={f.value} placeholder={f.placeholder} className="h-9 text-sm bg-secondary border-border" />
                  </div>
                ))}
              </div>
              <div className="pt-2">
                <Button size="sm" className="bg-gradient-primary text-xs">
                  <Save className="w-3 h-3 mr-1" /> Salvar Alterações
                </Button>
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
                {MOCK_USERS.map(u => (
                  <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/30 transition-colors">
                    <img src={u.avatar} alt={u.name} className="w-8 h-8 rounded-full border border-border" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{u.name}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </div>
                    <select className="text-xs bg-secondary border border-border rounded-lg px-2 py-1 text-foreground">
                      <option value="admin"      selected={u.role === 'admin'}>Admin</option>
                      <option value="director"   selected={u.role === 'director'}>Diretor</option>
                      <option value="supervisor" selected={u.role === 'supervisor'}>Supervisor</option>
                      <option value="member"     selected={u.role === 'member'}>Vendedor</option>
                    </select>
                    <span className={cn('w-2 h-2 rounded-full', u.status === 'active' ? 'bg-success' : 'bg-muted-foreground')} />
                  </div>
                ))}
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
                    🔐 As chaves ficam salvas no armazenamento local do seu dispositivo. Para ambientes de produção, utilize Lovable Cloud com secrets.
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

              {/* Target selector */}
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
                {moduleTarget !== 'global' && (
                  <div className="p-2.5 rounded-lg bg-accent/5 border border-accent/20 text-xs text-muted-foreground">
                    ℹ️ Módulos desativados globalmente não podem ser reativados aqui. As permissões individuais se somam às globais.
                  </div>
                )}
              </div>

              {/* Module toggles */}
              <div className="space-y-2">
                {DEFAULT_MODULES.map(mod => {
                  const globallyOff = !modules.find(m => m.id === mod.id)?.enabled;
                  const userOff = moduleTarget !== 'global'
                    ? getUserDisabledModules(moduleTarget).includes(mod.id)
                    : false;
                  const isOn = moduleTarget === 'global'
                    ? !globallyOff
                    : !globallyOff && !userOff;

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
                          : <AlertCircle  className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        }
                        <div>
                          <p className="text-sm font-medium">{mod.label}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">/{mod.id}</p>
                        </div>
                        {moduleTarget !== 'global' && globallyOff && (
                          <span className="text-[9px] text-muted-foreground ml-1">(desativado globalmente)</span>
                        )}
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
                            ? 'opacity-30 cursor-not-allowed'
                            : 'cursor-pointer'
                        )}
                        title={isLocked(mod.id) ? 'Este módulo não pode ser desativado' : undefined}
                      >
                        {isOn
                          ? <ToggleRight className="w-8 h-8 text-primary" />
                          : <ToggleLeft  className="w-8 h-8 text-muted-foreground" />
                        }
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="p-3 rounded-lg bg-warning/5 border border-warning/20">
                <p className="text-xs text-muted-foreground">
                  ⚠️ Módulos desativados ficam ocultos no menu lateral. Para bloqueio total de URL, use as permissões de role.
                </p>
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
                      : <AlertCircle  className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
                    }
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

          {/* ── Pendentes ── */}
          {(section === 'notifications' || section === 'billing') && (
            <div className="glass-card p-6 text-center py-16">
              <div className="w-12 h-12 rounded-xl bg-muted mx-auto mb-4 flex items-center justify-center">
                {section === 'notifications'
                  ? <Bell className="w-6 h-6 text-muted-foreground" />
                  : <TrendingUp className="w-6 h-6 text-muted-foreground" />
                }
              </div>
              <h3 className="font-display font-semibold mb-2">
                {section === 'notifications' ? 'Notificações' : 'Plano & Faturamento'}
              </h3>
              <p className="text-sm text-muted-foreground">Esta seção está em desenvolvimento.</p>
              <Button size="sm" className="mt-4 bg-gradient-primary text-xs">Em Breve</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
