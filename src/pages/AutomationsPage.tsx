import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Zap, Bell, Brain, MessageSquare, TrendingUp,
  Globe, WifiOff, UserPlus, BookOpen, GraduationCap, CheckCircle2,
  UserX, AlertTriangle, ChevronDown, ChevronRight, TestTube2, Save,
  ToggleLeft, ToggleRight, Activity, Workflow, Timer,
  RefreshCw, ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  type WebhookConfig, type DelayUnit, type WebhookEventId,
  loadWebhookConfigs, saveWebhookConfigs, testWebhook,
  DEFAULT_WEBHOOK_CONFIGS,
} from '@/lib/webhookService';
import { useToast } from '@/hooks/use-toast';

// ─── Icon map ──────────────────────────────────────────────────────────────────
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  MessageSquare, AlertTriangle, WifiOff, UserPlus, BookOpen,
  GraduationCap, CheckCircle2, UserX, Brain, TrendingUp,
};

const CATEGORY_LABELS: Record<WebhookConfig['category'], string> = {
  whatsapp: '📱 WhatsApp',
  users:    '👤 Usuários',
  training: '📚 Treinamentos',
  meetings: '🗓 Reuniões',
  analytics:'📊 Analytics',
};

const CATEGORY_COLORS: Record<WebhookConfig['category'], string> = {
  whatsapp: 'bg-success/10 text-success border-success/20',
  users:    'bg-primary/10 text-primary border-primary/20',
  training: 'bg-accent/10 text-accent border-accent/20',
  meetings: 'bg-warning/10 text-warning border-warning/20',
  analytics:'bg-secondary text-muted-foreground border-border',
};

const DELAY_UNITS: { value: DelayUnit; label: string }[] = [
  { value: 'immediate', label: 'Imediato' },
  { value: 'seconds',   label: 'Segundos' },
  { value: 'minutes',   label: 'Minutos' },
  { value: 'hours',     label: 'Horas' },
  { value: 'days',      label: 'Dias' },
];


// ─── Webhook Row ───────────────────────────────────────────────────────────────
function WebhookRow({
  cfg,
  onChange,
  onTest,
}: {
  cfg: WebhookConfig;
  onChange: (updated: WebhookConfig) => void;
  onTest: (cfg: WebhookConfig) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const Icon = ICON_MAP[cfg.icon] || Zap;

  return (
    <div className={cn(
      'glass-card overflow-hidden transition-all',
      cfg.enabled ? 'border-border' : 'opacity-60',
    )}>
      {/* ── Header row ── */}
      <div className="flex items-center gap-3 p-3">
        {/* Toggle */}
        <button
          onClick={() => onChange({ ...cfg, enabled: !cfg.enabled })}
          className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          title={cfg.enabled ? 'Desativar' : 'Ativar'}>
          {cfg.enabled
            ? <ToggleRight className="w-5 h-5 text-success" />
            : <ToggleLeft className="w-5 h-5" />}
        </button>

        {/* Icon + text */}
        <button
          className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
          onClick={() => setExpanded(e => !e)}>
          <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0',
            cfg.enabled ? 'bg-primary/10' : 'bg-secondary')}>
            <Icon className={cn('w-3.5 h-3.5', cfg.enabled ? 'text-primary' : 'text-muted-foreground')} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold">{cfg.label}</span>
              <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border', CATEGORY_COLORS[cfg.category])}>
                {CATEGORY_LABELS[cfg.category]}
              </span>
              {cfg.internalAlert && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
                  <Bell className="w-2.5 h-2.5" /> Alerta
                </span>
              )}
              {cfg.delayUnit !== 'immediate' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20 flex items-center gap-1">
                  <Timer className="w-2.5 h-2.5" /> {cfg.delayValue} {cfg.delayUnit === 'seconds' ? 's' : cfg.delayUnit === 'minutes' ? 'min' : cfg.delayUnit === 'hours' ? 'h' : 'd'}
                </span>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground truncate mt-0.5">
              {cfg.url || <span className="italic">URL não configurada</span>}
            </p>
          </div>
          {expanded
            ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
        </button>

        {/* Status badge */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {cfg.lastStatus && (
            <span className={cn(
              'text-[10px] px-1.5 py-0.5 rounded-full border',
              cfg.lastStatus === 'success'
                ? 'bg-success/10 text-success border-success/20'
                : cfg.lastStatus === 'error'
                  ? 'bg-destructive/10 text-destructive border-destructive/20'
                  : 'bg-warning/10 text-warning border-warning/20',
            )}>
              {cfg.lastStatus === 'success' ? '✓ OK' : cfg.lastStatus === 'error' ? '✗ Erro' : '⏳'}
            </span>
          )}
          {cfg.totalFired > 0 && (
            <span className="text-[10px] text-muted-foreground font-mono">{cfg.totalFired}x</span>
          )}
        </div>
      </div>

      {/* ── Expanded config ── */}
      {expanded && (
        <div className="px-3 pb-3 border-t border-border/50 space-y-3 pt-3">
          <p className="text-xs text-muted-foreground">{cfg.description}</p>

          {/* URL input */}
          <div>
            <label className="text-[11px] font-medium block mb-1 text-muted-foreground uppercase tracking-wide">
              URL do Webhook
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={cfg.url}
                onChange={e => onChange({ ...cfg, url: e.target.value })}
                placeholder="https://n8n.meudominio.com/webhook/..."
                className="flex-1 text-xs bg-secondary border border-border rounded-lg px-3 h-8 text-foreground outline-none focus:border-primary/50 font-mono"
              />
              {cfg.url && (
                <a href={cfg.url} target="_blank" rel="noopener noreferrer"
                  className="w-8 h-8 rounded-lg border border-border bg-secondary flex items-center justify-center hover:bg-muted transition-colors">
                  <ExternalLink className="w-3 h-3 text-muted-foreground" />
                </a>
              )}
            </div>
          </div>

          {/* Internal alert toggle */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-[11px] font-medium block text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <Bell className="w-3 h-3" /> Alerta Interno
              </label>
              <p className="text-[10px] text-muted-foreground mt-0.5">Criar notificação no sino quando o evento ocorrer</p>
            </div>
            <button
              onClick={() => onChange({ ...cfg, internalAlert: !cfg.internalAlert })}
              className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              title={cfg.internalAlert ? 'Desativar alerta interno' : 'Ativar alerta interno'}>
              {cfg.internalAlert
                ? <ToggleRight className="w-5 h-5 text-primary" />
                : <ToggleLeft className="w-5 h-5" />}
            </button>
          </div>

          {/* Delay config */}
          <div>
            <label className="text-[11px] font-medium block mb-1 text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <Timer className="w-3 h-3" /> Atraso no Disparo
            </label>
            <div className="flex items-center gap-2">
              <select
                value={cfg.delayUnit}
                onChange={e => onChange({ ...cfg, delayUnit: e.target.value as DelayUnit, delayValue: e.target.value === 'immediate' ? 0 : cfg.delayValue || 5 })}
                className="text-xs bg-secondary border border-border rounded-lg px-2 h-8 text-foreground outline-none focus:border-primary/50 cursor-pointer">
                {DELAY_UNITS.map(u => (
                  <option key={u.value} value={u.value}>{u.label}</option>
                ))}
              </select>
              {cfg.delayUnit !== 'immediate' && (
                <input
                  type="number"
                  min={1}
                  max={cfg.delayUnit === 'seconds' ? 3600 : cfg.delayUnit === 'minutes' ? 1440 : cfg.delayUnit === 'hours' ? 168 : 30}
                  value={cfg.delayValue}
                  onChange={e => onChange({ ...cfg, delayValue: Math.max(1, Number(e.target.value)) })}
                  className="w-20 text-xs bg-secondary border border-border rounded-lg px-2 h-8 text-foreground outline-none focus:border-primary/50 text-center font-mono"
                />
              )}
              {cfg.delayUnit !== 'immediate' && (
                <span className="text-xs text-muted-foreground">
                  {cfg.delayUnit === 'seconds' ? 'segundos' : cfg.delayUnit === 'minutes' ? 'minutos' : cfg.delayUnit === 'hours' ? 'horas' : 'dias'} após o evento
                </span>
              )}
              {cfg.delayUnit === 'immediate' && (
                <span className="text-xs text-muted-foreground">Dispara instantaneamente ao evento</span>
              )}
            </div>
          </div>

          {/* Footer: last fired + test button */}
          <div className="flex items-center justify-between pt-1">
            <div className="text-[10px] text-muted-foreground">
              {cfg.lastFired
                ? `Último disparo: ${new Date(cfg.lastFired).toLocaleString('pt-BR')}`
                : 'Nunca disparado'}
              {cfg.totalFired > 0 && ` · ${cfg.totalFired} total`}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7 border-primary/30 text-primary px-2 gap-1"
              onClick={() => onTest(cfg)}
              disabled={!cfg.url.trim() && !cfg.internalAlert}>
              <TestTube2 className="w-3 h-3" /> Testar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function AutomationsPage() {
  const { toast } = useToast();
  const [configs, setConfigs] = useState<WebhookConfig[]>(() => loadWebhookConfigs());
  const [testingId, setTestingId] = useState<WebhookEventId | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [hasUnsaved, setHasUnsaved] = useState(false);

  const updateConfig = useCallback((updated: WebhookConfig) => {
    setConfigs(prev => prev.map(c => c.id === updated.id ? updated : c));
    setHasUnsaved(true);
  }, []);

  const handleSaveAll = () => {
    saveWebhookConfigs(configs);
    setHasUnsaved(false);
    toast({ title: 'Configurações salvas!', description: 'Todos os webhooks foram atualizados.' });
  };

  const handleTest = async (cfg: WebhookConfig) => {
    setTestingId(cfg.id);

    const results: string[] = [];

    // Test internal alert
    if (cfg.internalAlert) {
      try {
        const { createInternalAlert } = await import('@/lib/notificationsService');
        const categoryToType: Record<string, 'meeting' | 'whatsapp' | 'system' | 'performance'> = {
          whatsapp: 'whatsapp', meetings: 'meeting', analytics: 'performance', users: 'system', training: 'system',
        };
        await createInternalAlert({
          type: categoryToType[cfg.category] || 'system',
          title: `[Teste] ${cfg.label}`,
          description: `Alerta de teste disparado manualmente.`,
        });
        results.push('Alerta interno criado');
      } catch (err: any) {
        results.push(`Erro no alerta: ${err.message}`);
      }
    }

    // Test webhook URL
    if (cfg.url.trim()) {
      const result = await testWebhook(cfg);
      results.push(result === 'success' ? `Webhook enviado para ${cfg.url}` : 'Webhook disparado (CORS pode mascarar resposta)');
    }

    setTestingId(null);
    toast({
      title: '✓ Teste concluído',
      description: results.join(' · ') || 'Nenhuma ação configurada.',
    });
  };

  const handleResetAll = () => {
    setConfigs(DEFAULT_WEBHOOK_CONFIGS);
    setHasUnsaved(true);
    toast({ title: 'Configurações resetadas', description: 'Todos os eventos voltaram ao padrão.' });
  };

  const enabledCount = configs.filter(c => c.enabled).length;
  const totalFired = configs.reduce((sum, c) => sum + c.totalFired, 0);

  const categories = ['all', ...Array.from(new Set(configs.map(c => c.category)))];
  const visibleConfigs = activeCategory === 'all'
    ? configs
    : configs.filter(c => c.category === activeCategory as WebhookConfig['category']);

  return (
    <div className="page-container animate-fade-in">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold">Alertas & Webhooks</h1>
          <p className="text-sm text-muted-foreground">Configure webhooks para alertas e integrações</p>
        </div>
        <div className="flex items-center gap-2">
          {hasUnsaved && (
            <span className="text-xs text-warning flex items-center gap-1">
              <Activity className="w-3 h-3" /> Alterações não salvas
            </span>
          )}
          <Button size="sm" variant="outline" className="text-xs h-8 border-border gap-1" onClick={handleResetAll}>
            <RefreshCw className="w-3.5 h-3.5" /> Reset
          </Button>
          <Button size="sm" className="bg-gradient-primary text-xs h-8 gap-1" onClick={handleSaveAll}>
            <Save className="w-3.5 h-3.5" /> Salvar Tudo
          </Button>
        </div>
      </div>

      {/* ── Stats strip ── */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Webhooks Ativos', value: enabledCount, icon: Zap, color: 'text-success' },
          { label: 'Total de Eventos', value: configs.length, icon: Workflow, color: 'text-primary' },
          { label: 'Disparos Totais', value: totalFired, icon: Activity, color: 'text-accent' },
        ].map(stat => (
          <div key={stat.label} className="glass-card p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
              <stat.icon className={cn('w-4 h-4', stat.color)} />
            </div>
            <div>
              <p className="text-lg font-bold font-mono leading-none">{stat.value}</p>
              <p className="text-[11px] text-muted-foreground">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* ════ LEFT: Webhooks ════════════════════════════════════════════════ */}
        <div className="lg:col-span-3">
          {/* Category tabs */}
          <div className="flex items-center gap-1.5 mb-4 flex-wrap">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  'text-[11px] px-2.5 py-1 rounded-full font-medium transition-colors',
                  activeCategory === cat
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-muted-foreground hover:text-foreground'
                )}>
                {cat === 'all' ? '🔗 Todos' : CATEGORY_LABELS[cat as WebhookConfig['category']]}
                <span className="opacity-60 ml-1">
                  ({cat === 'all' ? configs.length : configs.filter(c => c.category === cat).length})
                </span>
              </button>
            ))}
          </div>

          {/* Webhook rows */}
          <div className="space-y-2">
            {visibleConfigs.map(cfg => (
              <WebhookRow
                key={cfg.id}
                cfg={testingId === cfg.id ? { ...cfg } : cfg}
                onChange={updateConfig}
                onTest={handleTest}
              />
            ))}
          </div>
        </div>

        {/* ════ RIGHT: Legend ═════════════════════════════════════════════ */}
        <div className="lg:col-span-2 space-y-5">

          {/* Delay guide */}
          <div className="glass-card p-4" style={{ background: 'linear-gradient(135deg, hsl(var(--primary)/0.05), hsl(var(--accent)/0.05))' }}>
            <div className="flex items-center gap-2 mb-3">
              <Timer className="w-4 h-4 text-accent" />
              <span className="text-sm font-semibold">Como o Atraso Funciona</span>
            </div>
            <div className="space-y-2">
              {[
                { unit: 'Imediato', desc: 'Dispara no momento exato do evento' },
                { unit: 'Segundos / Minutos', desc: 'Útil para aguardar ações rápidas antes de notificar' },
                { unit: 'Horas', desc: 'Ideal para follow-ups e lembretes com margem de tempo' },
                { unit: 'Dias', desc: 'Para re-engajamento ou relatórios consolidados' },
              ].map(tip => (
                <div key={tip.unit} className="flex gap-2 text-xs">
                  <span className="font-semibold text-primary flex-shrink-0 w-36">{tip.unit}</span>
                  <span className="text-muted-foreground">{tip.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Payload example */}
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Globe className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">Exemplo de Payload</span>
            </div>
            <pre className="text-[10px] text-muted-foreground bg-secondary rounded-lg p-3 overflow-x-auto leading-relaxed">{`{
  "event": "whatsapp.message.received",
  "timestamp": "2026-03-08T16:30:00.000Z",
  "data": {
    "instanceName": "BDR_Julia",
    "from": "+5511999990001",
    "body": "Olá! Tenho interesse...",
    "conversationId": "conv_001"
  }
}`}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}
