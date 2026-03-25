import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  SlidersHorizontal, Brain, Plus, X, Save, Sparkles,
  Video, MessageSquare, Trash2, GripVertical,
  CheckCircle2, Star, Target, AlertTriangle, Loader2,
  Crown, GitBranch, Users, FileText, Upload, ChevronDown, ChevronRight,
  Power, PowerOff, Copy, Pencil, ZoomIn, ZoomOut, Maximize2, Minus,
  Heart, Clock, History, ChevronUp,
  BookOpen, Zap, Phone
} from 'lucide-react';
import { loadRecentChainLogs } from '@/lib/evaluationService';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { loadAIConfig, saveAIConfig } from '@/lib/aiConfigService';
import { useAppConfig } from '@/contexts/AppConfigContext';
import { callOpenAI } from '@/lib/openaiProxy';
import {
  loadAgentTree, saveAgent, deleteAgent, initializeAgentTree,
  loadAgentFiles, saveAgentFile, deleteAgentFile, buildAgentTree,
  type AgentNode, type AgentFile, type AgentTipo,
} from '@/lib/agentService';
import { METHODOLOGY_PRESETS, type MethodologyPreset } from '@/lib/methodologyPresets';

// ─── Storage keys (shared with WhatsApp analysis panel) ──────────────────────
export const AI_CONFIG_STORAGE = {
  WHATSAPP_CRITERIA:   'appmax_ai_whatsapp_criteria',
  WHATSAPP_PROMPT:     'appmax_ai_whatsapp_prompt',
  MEETINGS_CRITERIA:   'appmax_ai_meetings_criteria',
  MEETINGS_PROMPT:     'appmax_ai_meetings_prompt',
};

export interface EvalCriteria {
  id: string;
  label: string;
  description: string;
  weight: number;
  examples: string[];
  positiveSignals: string[];
  negativeSignals: string[];
}

export const DEFAULT_MEETING_CRITERIA: EvalCriteria[] = [
  {
    id: 'rapport', label: 'Rapport', weight: 20,
    description: 'Conexão emocional e abertura do cliente durante a conversa',
    examples: ['Apresentação amigável', 'Tom de voz adequado', 'Personalização do pitch'],
    positiveSignals: ['Cliente compartilha informações voluntariamente', 'Tom descontraído e aberto'],
    negativeSignals: ['Silêncios longos no início', 'Tom defensivo do cliente'],
  },
  {
    id: 'discovery', label: 'Descoberta', weight: 25,
    description: 'Qualidade e profundidade das perguntas de qualificação',
    examples: ['Perguntas abertas SPIN', 'Identificação de budget', 'Mapeamento de decisores'],
    positiveSignals: ['Cliente descreve dores com detalhes', 'Timeline identificada'],
    negativeSignals: ['Vai para demo sem qualificar', 'Não identifica economic buyer'],
  },
  {
    id: 'presentation', label: 'Apresentação', weight: 20,
    description: 'Clareza e impacto da proposta de valor apresentada',
    examples: ['Alinhamento com dores descobertas', 'Cases relevantes', 'ROI quantificado'],
    positiveSignals: ['Cliente faz perguntas de aprofundamento', 'Solicita proposta comercial'],
    negativeSignals: ['Demo genérica', 'Sem conexão com dores identificadas'],
  },
  {
    id: 'objections', label: 'Objeções', weight: 20,
    description: 'Capacidade de tratar resistências sem defensividade',
    examples: ['Ancoragem de valor', 'Perguntas de esclarecimento', 'Reformulação da objeção'],
    positiveSignals: ['Objeção transformada em pergunta', 'Cliente satisfeito com resposta'],
    negativeSignals: ['Desconto imediato', 'Resposta defensiva', 'Evitar a objeção'],
  },
  {
    id: 'nextSteps', label: 'Próximos Passos', weight: 15,
    description: 'Clareza no fechamento e comprometimento com próximas ações',
    examples: ['Data e hora definidos', 'Responsáveis mapeados', 'Prazo de decisão acordado'],
    positiveSignals: ['Próxima reunião agendada na call', 'Cliente confirma envolvimento do decisor'],
    negativeSignals: ['Sair sem data definida', 'Vago nos próximos passos'],
  },
];

export const DEFAULT_WHATSAPP_CRITERIA: EvalCriteria[] = [
  {
    id: 'response_time', label: 'Tempo de Resposta', weight: 15,
    description: 'Velocidade e consistência nas respostas ao lead',
    examples: ['Resposta em menos de 5 minutos', 'Manter ritmo da conversa'],
    positiveSignals: ['Resposta rápida e contextualizada', 'Horário adequado'],
    negativeSignals: ['Demora acima de 30 min em horário comercial', 'Mensagem fora de contexto'],
  },
  {
    id: 'engagement', label: 'Engajamento', weight: 25,
    description: 'Capacidade de manter o lead engajado e avançar a conversa',
    examples: ['Perguntas abertas', 'Conteúdo de valor', 'Personalização da abordagem'],
    positiveSignals: ['Lead responde com entusiasmo', 'Solicita mais informações'],
    negativeSignals: ['Respostas monossilábicas do lead', 'Lead deixa de responder'],
  },
  {
    id: 'qualification', label: 'Qualificação', weight: 25,
    description: 'Identificação de perfil, budget e timing via chat',
    examples: ['Identificar empresa e cargo', 'Mapear necessidade principal', 'Verificar decisor'],
    positiveSignals: ['Lead confirma fit com produto', 'Urgência identificada'],
    negativeSignals: ['Lead sem budget ou timing', 'Perfil fora do ICP'],
  },
  {
    id: 'cta', label: 'CTA e Next Steps', weight: 20,
    description: 'Clareza nas chamadas para ação e avanço do pipeline',
    examples: ['Propor reunião via link', 'Enviar material relevante', 'Confirmar próxima ação'],
    positiveSignals: ['Lead aceita agendar reunião', 'Solicita proposta'],
    negativeSignals: ['Conversa termina sem CTA', 'Lead esfria sem direcionamento'],
  },
  {
    id: 'language', label: 'Tom e Linguagem', weight: 15,
    description: 'Adequação do vocabulário e tom ao perfil do lead',
    examples: ['Linguagem adequada ao cargo', 'Sem erros de português', 'Tom consultivo'],
    positiveSignals: ['Lead responde no mesmo tom', 'Vocabulário técnico adequado'],
    negativeSignals: ['Excesso de emojis', 'Erros de digitação frequentes', 'Tom muito formal ou informal'],
  },
];

function CriteriaCard({
  criteria,
  onEdit,
  onDelete,
}: {
  criteria: EvalCriteria;
  onEdit: (c: EvalCriteria) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="glass-card p-4 rounded-xl border border-border">
      <div className="flex items-start gap-3">
        <GripVertical className="w-4 h-4 text-muted-foreground/30 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold">{criteria.label}</p>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
                {criteria.weight}%
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setExpanded(e => !e)}
                className="text-[10px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-muted"
              >
                {expanded ? 'Menos' : 'Detalhes'}
              </button>
              <button onClick={() => onEdit(criteria)} className="w-6 h-6 rounded hover:bg-muted flex items-center justify-center">
                <SlidersHorizontal className="w-3 h-3 text-muted-foreground" />
              </button>
              <button onClick={() => onDelete(criteria.id)} className="w-6 h-6 rounded hover:bg-destructive/10 flex items-center justify-center">
                <Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive" />
              </button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{criteria.description}</p>

          {expanded && (
            <div className="mt-3 space-y-2.5">
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Sinais Positivos</p>
                <div className="space-y-1">
                  {criteria.positiveSignals.map((s, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <CheckCircle2 className="w-3 h-3 text-success mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-muted-foreground">{s}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Sinais Negativos</p>
                <div className="space-y-1">
                  {criteria.negativeSignals.map((s, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <AlertTriangle className="w-3 h-3 text-warning mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-muted-foreground">{s}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Exemplos</p>
                <div className="flex flex-wrap gap-1">
                  {criteria.examples.map((e, i) => (
                    <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary border border-border text-muted-foreground">{e}</span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Add / Edit Criteria Modal ────────────────────────────────────────────────
function CriteriaModal({
  criteria,
  maxWeight,
  onClose,
  onSave,
}: {
  criteria?: EvalCriteria;
  maxWeight: number; // remaining weight available
  onClose: () => void;
  onSave: (c: EvalCriteria) => void;
}) {
  const isEdit = !!criteria;
  const [form, setForm] = useState<EvalCriteria>(criteria ?? {
    id: `crit_${Date.now()}`,
    label: '',
    description: '',
    weight: Math.min(10, maxWeight),
    examples: [],
    positiveSignals: [],
    negativeSignals: [],
  });
  const [newPositive, setNewPositive] = useState('');
  const [newNegative, setNewNegative] = useState('');
  const [newExample, setNewExample] = useState('');

  const weightError = form.weight < 1 || form.weight > maxWeight;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg glass-card p-5 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm">{isEdit ? `Editar: ${criteria.label}` : 'Adicionar Critério'}</h3>
          <button onClick={onClose} className="w-6 h-6 rounded flex items-center justify-center hover:bg-muted">
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium block mb-1.5">Nome do critério</label>
              <Input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="Ex: Rapport" className="h-8 text-xs bg-secondary border-border" />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1.5">
                Peso (%) <span className="text-muted-foreground">— máx. {maxWeight}%</span>
              </label>
              <Input
                type="number" min={1} max={maxWeight}
                value={form.weight}
                onChange={e => setForm(f => ({ ...f, weight: Math.min(maxWeight, Math.max(1, Number(e.target.value))) }))}
                className={cn('h-8 text-xs bg-secondary border-border', weightError && 'border-destructive/50')}
              />
              {weightError && <p className="text-[10px] text-destructive mt-0.5">Máximo disponível: {maxWeight}%</p>}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5">Descrição</label>
            <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Descreva o que este critério avalia..." className="text-xs bg-secondary border-border min-h-[60px] resize-none" />
          </div>

          {/* Positive signals */}
          <div>
            <label className="text-xs font-medium block mb-1.5 text-success">Sinais Positivos</label>
            <div className="space-y-1 mb-2">
              {form.positiveSignals.map((s, i) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-success/5 border border-success/15 text-xs">
                  <CheckCircle2 className="w-3 h-3 text-success flex-shrink-0" />
                  <span className="flex-1">{s}</span>
                  <button onClick={() => setForm(f => ({ ...f, positiveSignals: f.positiveSignals.filter((_, j) => j !== i) }))}>
                    <X className="w-3 h-3 text-muted-foreground" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input value={newPositive} onChange={e => setNewPositive(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && newPositive.trim()) { setForm(f => ({ ...f, positiveSignals: [...f.positiveSignals, newPositive.trim()] })); setNewPositive(''); } }}
                placeholder="Adicionar sinal positivo..." className="h-8 text-xs bg-secondary border-border" />
              <Button size="sm" variant="outline" className="h-8 text-xs border-border" onClick={() => { if (newPositive.trim()) { setForm(f => ({ ...f, positiveSignals: [...f.positiveSignals, newPositive.trim()] })); setNewPositive(''); } }}>+</Button>
            </div>
          </div>

          {/* Negative signals */}
          <div>
            <label className="text-xs font-medium block mb-1.5 text-warning">Sinais Negativos</label>
            <div className="space-y-1 mb-2">
              {form.negativeSignals.map((s, i) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-warning/5 border border-warning/15 text-xs">
                  <AlertTriangle className="w-3 h-3 text-warning flex-shrink-0" />
                  <span className="flex-1">{s}</span>
                  <button onClick={() => setForm(f => ({ ...f, negativeSignals: f.negativeSignals.filter((_, j) => j !== i) }))}>
                    <X className="w-3 h-3 text-muted-foreground" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input value={newNegative} onChange={e => setNewNegative(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && newNegative.trim()) { setForm(f => ({ ...f, negativeSignals: [...f.negativeSignals, newNegative.trim()] })); setNewNegative(''); } }}
                placeholder="Adicionar sinal negativo..." className="h-8 text-xs bg-secondary border-border" />
              <Button size="sm" variant="outline" className="h-8 text-xs border-border" onClick={() => { if (newNegative.trim()) { setForm(f => ({ ...f, negativeSignals: [...f.negativeSignals, newNegative.trim()] })); setNewNegative(''); } }}>+</Button>
            </div>
          </div>

          {/* Examples */}
          <div>
            <label className="text-xs font-medium block mb-1.5 text-muted-foreground">Exemplos</label>
            <div className="flex flex-wrap gap-1 mb-2">
              {form.examples.map((e, i) => (
                <span key={i} className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-secondary border border-border text-muted-foreground">
                  {e}
                  <button onClick={() => setForm(f => ({ ...f, examples: f.examples.filter((_, j) => j !== i) }))}><X className="w-2.5 h-2.5" /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input value={newExample} onChange={e => setNewExample(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && newExample.trim()) { setForm(f => ({ ...f, examples: [...f.examples, newExample.trim()] })); setNewExample(''); } }}
                placeholder="Adicionar exemplo..." className="h-8 text-xs bg-secondary border-border" />
              <Button size="sm" variant="outline" className="h-8 text-xs border-border" onClick={() => { if (newExample.trim()) { setForm(f => ({ ...f, examples: [...f.examples, newExample.trim()] })); setNewExample(''); } }}>+</Button>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              className="flex-1 bg-gradient-primary text-xs h-9"
              disabled={!form.label.trim() || weightError}
              onClick={() => { onSave(form); onClose(); }}
            >
              <Save className="w-3.5 h-3.5 mr-1.5" /> {isEdit ? 'Salvar' : 'Adicionar Critério'}
            </Button>
            <Button size="sm" variant="outline" className="text-xs border-border h-9" onClick={onClose}>Cancelar</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Methodology Selector ────────────────────────────────────────────────────
function MethodologySelector({
  activeType,
  onApply,
}: {
  activeType: 'meetings' | 'whatsapp';
  onApply: (preset: MethodologyPreset) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [confirmPreset, setConfirmPreset] = useState<MethodologyPreset | null>(null);

  const inputType = activeType === 'meetings' ? 'meetings' : 'whatsapp';
  const presets = METHODOLOGY_PRESETS;

  const tierLabel = (tier: string) => {
    if (tier === 'core') return { text: 'Core', cls: 'bg-primary/10 text-primary border-primary/20' };
    if (tier === 'complementary') return { text: 'Complementar', cls: 'bg-accent/10 text-accent border-accent/20' };
    return { text: 'Opcional', cls: 'bg-muted text-muted-foreground border-border' };
  };

  const isRecommended = (p: MethodologyPreset) => p.inputTypes.includes(inputType as any);

  return (
    <div className="glass-card p-4 rounded-xl border border-border mb-6">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-accent" />
          <h3 className="text-sm font-semibold">Metodologias de Vendas</h3>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20 font-medium">
            {presets.length} disponíveis
          </span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="mt-4 space-y-4">
          <p className="text-[11px] text-muted-foreground">
            Selecione uma metodologia para aplicar seus critérios e prompt como preset.
            Isso <span className="text-warning font-semibold">substituirá</span> os critérios e prompt atuais.
          </p>

          {/* Tier sections */}
          {(['core', 'complementary', 'optional'] as const).map(tier => {
            const tierPresets = presets.filter(p => p.tier === tier);
            const label = tier === 'core' ? 'Core — Essenciais' : tier === 'complementary' ? 'Complementares — Alto Valor' : 'Opcionais — Cobertura Completa';
            return (
              <div key={tier}>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">{label}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {tierPresets.map(p => {
                    const recommended = isRecommended(p);
                    const tl = tierLabel(p.tier);
                    return (
                      <button
                        key={p.id}
                        onClick={() => setConfirmPreset(p)}
                        className={cn(
                          'text-left p-3 rounded-lg border transition-all hover:shadow-sm',
                          recommended
                            ? 'border-primary/30 bg-primary/5 hover:border-primary/50'
                            : 'border-border bg-secondary/50 hover:border-border/80'
                        )}
                      >
                        <div className="flex items-start justify-between gap-1 mb-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-base">{p.icon}</span>
                            <span className="text-xs font-semibold">{p.name}</span>
                          </div>
                          {recommended && (
                            <span className="text-[8px] px-1 py-0.5 rounded bg-primary/15 text-primary font-semibold whitespace-nowrap flex-shrink-0">
                              REC
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground line-clamp-2 mb-1.5">{p.description}</p>
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className={cn('text-[8px] px-1 py-0.5 rounded-full border font-medium', tl.cls)}>{tl.text}</span>
                          {p.inputTypes.includes('meetings') && <Video className="w-2.5 h-2.5 text-muted-foreground/50" />}
                          {p.inputTypes.includes('whatsapp') && <MessageSquare className="w-2.5 h-2.5 text-muted-foreground/50" />}
                          {p.inputTypes.includes('calls') && <Phone className="w-2.5 h-2.5 text-muted-foreground/50" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation modal */}
      {confirmPreset && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setConfirmPreset(null)}>
          <div className="w-full max-w-md glass-card p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">{confirmPreset.icon}</span>
              <div>
                <h3 className="font-semibold text-sm">{confirmPreset.name}</h3>
                <p className="text-[10px] text-muted-foreground">{confirmPreset.creator}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-3">{confirmPreset.description}</p>

            <div className="mb-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1.5">Critérios que serão aplicados</p>
              <div className="space-y-1">
                {confirmPreset.criteria.map(c => (
                  <div key={c.id} className="flex justify-between text-[11px] px-2 py-1 rounded bg-secondary/50">
                    <span>{c.label}</span>
                    <span className="font-semibold text-primary">{c.weight}%</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Melhor para</p>
              <div className="flex flex-wrap gap-1">
                {confirmPreset.bestFor.map((b, i) => (
                  <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary border border-border text-muted-foreground">{b}</span>
                ))}
              </div>
            </div>

            <div className="p-2 rounded-lg bg-warning/5 border border-warning/20 mb-3">
              <p className="text-[10px] text-warning">
                <AlertTriangle className="w-3 h-3 inline mr-1" />
                Isso substituirá todos os critérios e o prompt do sistema atuais de <span className="font-semibold">{activeType === 'meetings' ? 'Reuniões' : 'WhatsApp'}</span>.
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1 bg-gradient-primary text-xs h-9"
                onClick={() => { onApply(confirmPreset); setConfirmPreset(null); setExpanded(false); }}
              >
                <Zap className="w-3.5 h-3.5 mr-1.5" /> Aplicar Metodologia
              </Button>
              <Button size="sm" variant="outline" className="text-xs border-border h-9" onClick={() => setConfirmPreset(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Methodology Inline Selector (inside AgentConfigModal) ──────────────────
function MethodologyInlineSelector({
  onApply,
}: {
  onApply: (preset: MethodologyPreset) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [confirmPreset, setConfirmPreset] = useState<MethodologyPreset | null>(null);

  const presets = METHODOLOGY_PRESETS;

  const tierLabel = (tier: string) => {
    if (tier === 'core') return { text: 'Core', cls: 'bg-primary/10 text-primary border-primary/20' };
    if (tier === 'complementary') return { text: 'Complementar', cls: 'bg-accent/10 text-accent border-accent/20' };
    return { text: 'Opcional', cls: 'bg-muted text-muted-foreground border-border' };
  };

  return (
    <div className="rounded-xl border border-border bg-secondary/30">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-3"
      >
        <div className="flex items-center gap-2">
          <BookOpen className="w-3.5 h-3.5 text-accent" />
          <span className="text-xs font-semibold">Metodologia de Vendas</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20 font-medium">
            {presets.length} presets
          </span>
        </div>
        {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          <p className="text-[10px] text-muted-foreground">
            Selecionar uma metodologia <span className="text-warning font-semibold">substituirá</span> o prompt e critérios acima. Você pode editá-los depois.
          </p>

          {(['core', 'complementary', 'optional'] as const).map(tier => {
            const tierPresets = presets.filter(p => p.tier === tier);
            const labels = { core: 'Core', complementary: 'Complementares', optional: 'Opcionais' };
            return (
              <div key={tier}>
                <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">{labels[tier]}</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {tierPresets.map(p => {
                    const tl = tierLabel(p.tier);
                    return (
                      <button
                        key={p.id}
                        onClick={() => setConfirmPreset(p)}
                        className="text-left p-2.5 rounded-lg border border-border bg-background hover:border-primary/40 hover:bg-primary/5 transition-all"
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-sm">{p.icon}</span>
                          <span className="text-[11px] font-semibold truncate">{p.name}</span>
                        </div>
                        <p className="text-[9px] text-muted-foreground line-clamp-1">{p.description}</p>
                        <div className="flex items-center gap-1 mt-1.5">
                          <span className={cn('text-[8px] px-1 py-0.5 rounded-full border font-medium', tl.cls)}>{tl.text}</span>
                          <span className="text-[8px] text-muted-foreground/60">{p.criteria.length} critérios</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation mini-modal */}
      {confirmPreset && (
        <div className="fixed inset-0 bg-background/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={() => setConfirmPreset(null)}>
          <div className="w-full max-w-sm glass-card p-4 rounded-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">{confirmPreset.icon}</span>
              <div>
                <h4 className="text-sm font-semibold">{confirmPreset.name}</h4>
                <p className="text-[10px] text-muted-foreground">{confirmPreset.creator}</p>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mb-2">{confirmPreset.description}</p>

            <div className="mb-2">
              <p className="text-[9px] font-semibold text-muted-foreground uppercase mb-1">Critérios</p>
              <div className="space-y-0.5 max-h-32 overflow-y-auto">
                {confirmPreset.criteria.map(c => (
                  <div key={c.id} className="flex justify-between text-[10px] px-2 py-0.5 rounded bg-secondary/50">
                    <span className="truncate">{c.label}</span>
                    <span className="font-semibold text-primary flex-shrink-0 ml-2">{c.weight}%</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-2 rounded-lg bg-warning/5 border border-warning/20 mb-3">
              <p className="text-[10px] text-warning">
                <AlertTriangle className="w-3 h-3 inline mr-1" />
                Isso substituirá o prompt e critérios atuais deste avaliador. Você pode editá-los depois.
              </p>
            </div>

            <div className="flex gap-2">
              <Button size="sm" className="flex-1 bg-gradient-primary text-xs h-8"
                onClick={() => { onApply(confirmPreset); setConfirmPreset(null); setExpanded(false); }}>
                <Zap className="w-3 h-3 mr-1" /> Aplicar
              </Button>
              <Button size="sm" variant="outline" className="text-xs border-border h-8" onClick={() => setConfirmPreset(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const s = localStorage.getItem(key);
    return s ? JSON.parse(s) : fallback;
  } catch { return fallback; }
}

const DEFAULT_MEETING_PROMPT = 'Você é um avaliador especialista em vendas consultivas. Analise a transcrição da reunião e avalie cada critério com base nos sinais identificados. Seja específico e construtivo nos feedbacks.';
const DEFAULT_WHATSAPP_PROMPT = 'Você é um especialista em vendas digitais e atendimento via WhatsApp. Avalie as conversas com foco em efetividade comercial, qualificação de leads e conversão.';

// ─── Agent Node (canvas card) ────────────────────────────────────────────────
function AgentNode_({
  agent,
  onClick,
  onToggle,
}: {
  agent: AgentNode;
  onClick: () => void;
  onToggle: () => void;
}) {
  const iconByType: Record<string, any> = { gerente: Crown, classificador: GitBranch, avaliador: Users, sentimental: Heart };
  const colorByType: Record<string, string> = {
    gerente: 'border-red-500/50 bg-gradient-to-br from-red-500/10 to-red-900/5 shadow-red-500/10',
    classificador: 'border-orange-500/50 bg-gradient-to-br from-orange-500/10 to-orange-900/5 shadow-orange-500/10',
    avaliador: 'border-blue-500/50 bg-gradient-to-br from-blue-500/10 to-blue-900/5 shadow-blue-500/10',
    sentimental: 'border-purple-500/50 bg-gradient-to-br from-purple-500/10 to-purple-900/5 shadow-purple-500/10',
  };
  const iconBgByType: Record<string, string> = { gerente: 'bg-red-500/20', classificador: 'bg-orange-500/20', avaliador: 'bg-blue-500/20', sentimental: 'bg-purple-500/20' };
  const Icon = iconByType[agent.tipo] || Brain;

  return (
    <div
      onClick={onClick}
      className={cn(
        'relative px-5 py-4 rounded-2xl border-2 cursor-pointer transition-all shadow-lg hover:shadow-xl hover:scale-[1.03] select-none',
        colorByType[agent.tipo],
        !agent.ativo && 'opacity-30 grayscale'
      )}
      style={{ minWidth: 170, maxWidth: 220 }}
    >
      <div className="flex items-center gap-2.5 mb-1.5">
        <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center',
          iconBgByType[agent.tipo] || 'bg-muted'
        )}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <span className="text-xs font-bold truncate block">{agent.nome}</span>
          <span className="text-[9px] text-muted-foreground uppercase tracking-wider">{agent.tipo}</span>
        </div>
      </div>
      {agent.descricao && (
        <p className="text-[10px] text-muted-foreground line-clamp-2 leading-snug">{agent.descricao}</p>
      )}
      {(agent.tipo === 'avaliador' || agent.tipo === 'sentimental') && (
        <div className="flex items-center gap-1.5 mt-2">
          {(agent.criterios || []).length > 0 && (
            <span className={cn('text-[9px] px-2 py-0.5 rounded-full border font-medium',
              agent.tipo === 'sentimental' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
            )}>
              {(agent.criterios || []).length} critérios
            </span>
          )}
          <span className="text-[9px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
            {agent.modelo_ia || 'gpt-4o-mini'}
          </span>
        </div>
      )}
      <button
        onClick={e => { e.stopPropagation(); onToggle(); }}
        className={cn('absolute top-2.5 right-2.5 w-5 h-5 rounded-full flex items-center justify-center transition-colors',
          agent.ativo ? 'bg-success/20 text-success hover:bg-success/30' : 'bg-muted text-muted-foreground hover:bg-muted/80')}
        title={agent.ativo ? 'Ativo — clique para desativar' : 'Inativo — clique para ativar'}
      >
        {agent.ativo ? <Power className="w-3 h-3" /> : <PowerOff className="w-3 h-3" />}
      </button>
    </div>
  );
}

// ─── Agent Config Modal (popup) ──────────────────────────────────────────────
function AgentConfigModal({
  agent,
  onSave,
  onDelete,
  onClose,
  files,
  onUploadFile,
  onDeleteFile,
  uploadingFile,
}: {
  agent: AgentNode;
  onSave: (a: AgentNode) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  files: AgentFile[];
  onUploadFile: (file: File) => void;
  onDeleteFile: (f: AgentFile) => void;
  uploadingFile: boolean;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<AgentNode>(agent);
  const [editingCrit, setEditingCrit] = useState<EvalCriteria | null>(null);
  const [addingCrit, setAddingCrit] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => { setForm(agent); setDirty(false); }, [agent.id]);

  const update = (patch: Partial<AgentNode>) => {
    setForm(f => ({ ...f, ...patch }));
    setDirty(true);
  };

  const totalWeight = (form.criterios || []).reduce((s, c) => s + c.weight, 0);
  const remainingWeight = 100 - totalWeight;

  const handleSaveCrit = (c: EvalCriteria) => {
    const crits = form.criterios || [];
    const exists = crits.some(x => x.id === c.id);
    const updated = exists ? crits.map(x => x.id === c.id ? c : x) : [...crits, c];
    update({ criterios: updated });
  };

  const handleDeleteCrit = (id: string) => {
    update({ criterios: (form.criterios || []).filter(c => c.id !== id) });
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-2xl glass-card rounded-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <span className={cn('text-[10px] px-2 py-1 rounded-lg font-bold uppercase tracking-wider',
              form.tipo === 'gerente' ? 'bg-red-500/10 text-red-400' :
              form.tipo === 'classificador' ? 'bg-orange-500/10 text-orange-400' :
              form.tipo === 'sentimental' ? 'bg-purple-500/10 text-purple-400' :
              'bg-blue-500/10 text-blue-400'
            )}>{form.tipo}</span>
            <h3 className="text-base font-semibold">{form.nome}</h3>
          </div>
          <div className="flex items-center gap-2">
            {dirty && (
              <Button size="sm" className="h-8 text-xs bg-gradient-primary" onClick={() => { onSave(form); setDirty(false); }}>
                <Save className="w-3.5 h-3.5 mr-1.5" /> Salvar
              </Button>
            )}
            {form.tipo !== 'gerente' && (
              <Button size="sm" variant="outline" className="h-8 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
                onClick={() => { onDelete(form.id); onClose(); }}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
            <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Modal body - scrollable */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {/* Name + Model */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium block mb-1.5">Nome</label>
              <Input value={form.nome} onChange={e => update({ nome: e.target.value })}
                className="h-9 text-sm bg-secondary border-border" />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1.5">Modelo IA</label>
              <select value={form.modelo_ia || 'gpt-4o-mini'}
                onChange={e => update({ modelo_ia: e.target.value })}
                className="w-full h-9 text-sm bg-secondary border border-border rounded-md px-3">
                <option value="gpt-4o-mini">GPT-4o Mini</option>
                <option value="gpt-4o">GPT-4o</option>
                <option value="gpt-4-turbo">GPT-4 Turbo</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium block mb-1.5">Descrição</label>
            <Input value={form.descricao || ''} onChange={e => update({ descricao: e.target.value })}
              className="h-9 text-sm bg-secondary border-border" placeholder="Ex: Avalia reuniões de closer inbound" />
          </div>

          {/* System Prompt */}
          <div>
            <label className="text-xs font-medium block mb-1.5">
              <Brain className="w-3.5 h-3.5 inline mr-1.5" />Prompt do Sistema
            </label>
            <Textarea value={form.prompt_sistema} onChange={e => update({ prompt_sistema: e.target.value })}
              className="text-sm bg-secondary border-border min-h-[120px] resize-none" />
          </div>

          {/* Methodology Preset (avaliador only) */}
          {form.tipo === 'avaliador' && (
            <MethodologyInlineSelector
              onApply={(preset) => {
                update({
                  prompt_sistema: preset.systemPrompt,
                  criterios: preset.criteria,
                });
                toast({
                  title: `${preset.icon} ${preset.name} aplicada!`,
                  description: `Prompt e ${preset.criteria.length} critérios preenchidos. Edite se necessário.`,
                });
              }}
            />
          )}

          {/* Criteria (avaliador + sentimental) */}
          {(form.tipo === 'avaliador' || form.tipo === 'sentimental') && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold">Critérios de Avaliação</label>
                  <span className={cn('text-[10px] px-2 py-0.5 rounded-full border font-semibold',
                    totalWeight === 100 ? 'bg-success/10 text-success border-success/20' :
                    'bg-warning/10 text-warning border-warning/20')}>
                    {totalWeight}%
                  </span>
                </div>
                <Button size="sm" variant="outline" className="h-7 text-xs border-border"
                  disabled={remainingWeight <= 0} onClick={() => setAddingCrit(true)}>
                  <Plus className="w-3 h-3 mr-1" /> Critério
                </Button>
              </div>
              <div className="space-y-2">
                {(form.criterios || []).map(c => (
                  <CriteriaCard key={c.id} criteria={c} onEdit={setEditingCrit} onDelete={handleDeleteCrit} />
                ))}
              </div>
            </div>
          )}

          {/* Reference Files (avaliador + sentimental) */}
          {(form.tipo === 'avaliador' || form.tipo === 'sentimental') && (
            <div>
              <label className="text-xs font-semibold block mb-2">
                <FileText className="w-3.5 h-3.5 inline mr-1.5" />Arquivos de Referência
              </label>
              <p className="text-[10px] text-muted-foreground mb-3">
                PDFs, DOCX ou CSVs que o agente deve usar como base (ex: ebooks de vendas)
              </p>
              <div className="space-y-1.5 mb-3">
                {files.map(f => (
                  <div key={f.id} className="flex items-center justify-between p-2.5 rounded-lg bg-secondary border border-border">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-xs truncate">{f.nome}</span>
                      <span className="text-[10px] text-muted-foreground flex-shrink-0">
                        {(f.tamanho / 1024).toFixed(0)}KB
                      </span>
                    </div>
                    <button onClick={() => onDeleteFile(f)} className="p-1.5 rounded hover:bg-destructive/10">
                      <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                ))}
              </div>
              <label className={cn(
                'flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed cursor-pointer transition-colors',
                uploadingFile ? 'border-primary/50 bg-primary/5' : 'border-border hover:border-primary/30 hover:bg-primary/5'
              )}>
                {uploadingFile ? (
                  <><Loader2 className="w-4 h-4 animate-spin text-primary" /><span className="text-sm text-primary">Enviando...</span></>
                ) : (
                  <><Upload className="w-4 h-4 text-muted-foreground" /><span className="text-sm text-muted-foreground">Enviar arquivo</span></>
                )}
                <input type="file" className="hidden" accept=".pdf,.csv,.docx,.odt,.txt"
                  onChange={e => { const f = e.target.files?.[0]; if (f) onUploadFile(f); e.target.value = ''; }}
                  disabled={uploadingFile} />
              </label>
            </div>
          )}
        </div>
      </div>

      {/* Criteria modals (above the agent modal) */}
      {editingCrit && (
        <CriteriaModal criteria={editingCrit} maxWeight={remainingWeight + editingCrit.weight}
          onClose={() => setEditingCrit(null)} onSave={handleSaveCrit} />
      )}
      {addingCrit && (
        <CriteriaModal maxWeight={remainingWeight}
          onClose={() => setAddingCrit(false)} onSave={handleSaveCrit} />
      )}
    </div>
  );
}

// ─── Inline add button (between siblings — visible on hover of gap area) ────
function InlineInsertButton({
  parentId,
  insertIndex,
  onAddAgent,
}: {
  parentId: string;
  insertIndex: number;
  onAddAgent: (parentId: string, tipo: AgentTipo, insertIndex: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const types: { tipo: AgentTipo; label: string; icon: any; color: string }[] = [
    { tipo: 'classificador', label: 'Classificador', icon: GitBranch, color: 'text-orange-400' },
    { tipo: 'avaliador', label: 'Avaliador', icon: Users, color: 'text-blue-400' },
    { tipo: 'sentimental', label: 'Sentimental', icon: Heart, color: 'text-purple-400' },
  ];

  return (
    <div className="relative flex items-center self-stretch group/gap" data-agent-node>
      {/* Wide hover zone */}
      <div className="w-8 flex items-center justify-center self-stretch">
        <button
          onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
          className={cn(
            'w-6 h-6 rounded-full flex items-center justify-center transition-all shadow-md',
            open
              ? 'bg-primary text-primary-foreground scale-110'
              : 'bg-primary/70 text-primary-foreground opacity-0 group-hover/gap:opacity-100 hover:scale-110'
          )}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
      {open && (
        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-50 bg-background border border-border rounded-xl shadow-2xl p-1.5 min-w-[170px]"
          onClick={e => e.stopPropagation()}>
          <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold px-2.5 py-1">Inserir aqui</p>
          {types.map(t => (
            <button
              key={t.tipo}
              onClick={() => { onAddAgent(parentId, t.tipo, insertIndex); setOpen(false); }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-muted transition-colors text-left"
            >
              <t.icon className={cn('w-3.5 h-3.5', t.color)} />
              <span className="text-[11px] font-medium">{t.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Recursive Canvas Tree Node (org chart style) ───────────────────────────
function CanvasTreeNode({
  agent,
  agents,
  getChildren,
  onClickAgent,
  onToggleAgent,
  addingChildFor,
  setAddingChildFor,
  onAddAgent,
}: {
  agent: AgentNode;
  agents: AgentNode[];
  getChildren: (parentId: string) => AgentNode[];
  onClickAgent: (id: string) => void;
  onToggleAgent: (a: AgentNode) => void;
  addingChildFor: string | null;
  setAddingChildFor: (id: string | null) => void;
  onAddAgent: (parentId: string, tipo: AgentTipo, insertIndex?: number) => void;
}) {
  const children = getChildren(agent.id);
  const addableTypes: { tipo: AgentTipo; label: string; icon: any; color: string }[] = [
    { tipo: 'classificador', label: 'Classificador', icon: GitBranch, color: 'text-orange-400' },
    { tipo: 'avaliador', label: 'Avaliador', icon: Users, color: 'text-blue-400' },
    { tipo: 'sentimental', label: 'Sentimental', icon: Heart, color: 'text-purple-400' },
  ];

  // Columns: children interleaved with insert buttons, plus add-at-end button
  const colCount = children.length + 1; // children + add button

  const addButton = (
    <div className="relative" data-agent-node>
      <button
        onClick={(e) => { e.stopPropagation(); setAddingChildFor(addingChildFor === agent.id ? null : agent.id); }}
        className="px-5 py-3 rounded-2xl border-2 border-dashed border-border/40 hover:border-primary/40 hover:bg-primary/5 transition-all flex flex-col items-center gap-1.5 min-w-[130px]"
      >
        <div className="w-8 h-8 rounded-xl bg-muted/80 flex items-center justify-center">
          <Plus className="w-4 h-4 text-muted-foreground" />
        </div>
        <span className="text-[10px] text-muted-foreground font-medium">Adicionar Agente</span>
      </button>
      {addingChildFor === agent.id && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 bg-background border border-border rounded-xl shadow-2xl p-1.5 min-w-[180px]"
          onClick={e => e.stopPropagation()}>
          <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold px-2.5 py-1.5">Tipo do Agente</p>
          {addableTypes.map(t => (
            <button
              key={t.tipo}
              onClick={() => onAddAgent(agent.id, t.tipo)}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-muted transition-colors text-left"
            >
              <t.icon className={cn('w-4 h-4', t.color)} />
              <span className="text-xs font-medium">{t.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const rowRef = useRef<HTMLDivElement>(null);
  const [hBar, setHBar] = useState<{ left: number; width: number } | null>(null);

  useEffect(() => {
    const measure = () => {
      if (!rowRef.current || colCount <= 1) { setHBar(null); return; }
      const cols = rowRef.current.querySelectorAll<HTMLElement>('[data-tree-col]');
      if (cols.length < 2) { setHBar(null); return; }
      const first = cols[0];
      const last = cols[cols.length - 1];
      const l = first.offsetLeft + first.offsetWidth / 2;
      const r = last.offsetLeft + last.offsetWidth / 2;
      setHBar({ left: l, width: r - l });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (rowRef.current) ro.observe(rowRef.current);
    return () => ro.disconnect();
  }, [colCount, children.length]);

  return (
    <div className="flex flex-col items-center">
      <div data-agent-node>
        <AgentNode_ agent={agent} onClick={() => onClickAgent(agent.id)} onToggle={() => onToggleAgent(agent)} />
      </div>

      <div className="h-8 pointer-events-none" style={{ width: 2, background: 'rgba(255,255,255,0.5)' }} />

      <div ref={rowRef} className="relative flex items-start">
        {hBar && (
          <div
            className="absolute top-0 pointer-events-none"
            style={{ left: hBar.left, width: Math.max(hBar.width, 1), height: 2, background: 'rgba(255,255,255,0.5)' }}
          />
        )}

        {/* Render children with insert buttons between them */}
        {children.map((child, i) => (
          <React.Fragment key={child.id}>
            {/* Insert button between siblings */}
            {i > 0 && (
              <InlineInsertButton parentId={agent.id} insertIndex={i} onAddAgent={onAddAgent} />
            )}
            <div data-tree-col className="flex flex-col items-center" style={{ minWidth: 230 }}>
              <div className="h-6 pointer-events-none" style={{ width: 2, background: 'rgba(255,255,255,0.5)' }} />
              <CanvasTreeNode
                agent={child}
                agents={agents}
                getChildren={getChildren}
                onClickAgent={onClickAgent}
                onToggleAgent={onToggleAgent}
                addingChildFor={addingChildFor}
                setAddingChildFor={setAddingChildFor}
                onAddAgent={onAddAgent}
              />
            </div>
          </React.Fragment>
        ))}

        {/* Add button at the end */}
        <div data-tree-col className="flex flex-col items-center" style={{ minWidth: 160 }}>
          <div className="h-6 pointer-events-none" style={{ width: 2, background: 'rgba(255,255,255,0.5)' }} />
          {addButton}
        </div>
      </div>
    </div>
  );
}

export default function AIConfigPage() {
  const { toast } = useToast();
  const { tokens, models } = useAppConfig();
  const [activeType, setActiveType] = useState<'meetings' | 'whatsapp'>('meetings');
  const [meetingCriteria, setMeetingCriteria] = useState<EvalCriteria[]>(DEFAULT_MEETING_CRITERIA);
  const [whatsappCriteria, setWhatsappCriteria] = useState<EvalCriteria[]>(DEFAULT_WHATSAPP_CRITERIA);
  const [editingCriteria, setEditingCriteria] = useState<EvalCriteria | null>(null);
  const [addingCriteria, setAddingCriteria] = useState(false);
  const [meetingPrompt, setMeetingPrompt] = useState<string>(DEFAULT_MEETING_PROMPT);
  const [whatsappPrompt, setWhatsappPrompt] = useState<string>(DEFAULT_WHATSAPP_PROMPT);

  // Multi-agent state (meetings)
  const [agents, setAgents] = useState<AgentNode[]>([]);
  // Multi-agent state (whatsapp)
  const [waAgents, setWaAgents] = useState<AgentNode[]>([]);

  const currentAgents = activeType === 'meetings' ? agents : waAgents;
  const setCurrentAgents = activeType === 'meetings' ? setAgents : setWaAgents;

  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
  const [agentFiles, setAgentFiles] = useState<AgentFile[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [initializingAgents, setInitializingAgents] = useState(false);

  // Canvas zoom/pan
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  // Add agent dropdown
  const [addingChildFor, setAddingChildFor] = useState<string | null>(null);

  // Execution history
  const [showHistory, setShowHistory] = useState(false);
  const [executionHistory, setExecutionHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const rootAgent = currentAgents.find(a => a.tipo === 'gerente') || null;
  const editingAgent = currentAgents.find(a => a.id === editingAgentId) || null;
  const hasMultiAgent = currentAgents.length > 0;

  const getChildren = (parentId: string) =>
    currentAgents.filter(a => a.parent_id === parentId).sort((a, b) => a.ordem - b.ordem);

  const handleZoomIn = () => setZoom(z => Math.min(2, z + 0.15));
  const handleZoomOut = () => setZoom(z => Math.max(0.3, z - 0.15));
  const handleZoomReset = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    setZoom(z => Math.min(2, Math.max(0.3, z + delta)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    // Only start panning if clicking on the canvas bg (not on nodes)
    if ((e.target as HTMLElement).closest('[data-agent-node]')) return;
    setIsPanning(true);
    panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return;
    setPan({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y });
  }, [isPanning]);

  const handleMouseUp = useCallback(() => setIsPanning(false), []);

  // Load agents on mount (both modules)
  useEffect(() => {
    loadAgentTree('meetings').then(setAgents);
    loadAgentTree('whatsapp').then(setWaAgents);
  }, []);

  // Reset canvas state when switching tabs
  useEffect(() => {
    setEditingAgentId(null);
    setAddingChildFor(null);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [activeType]);

  // Load files when editing agent changes
  useEffect(() => {
    if (editingAgentId) {
      loadAgentFiles(editingAgentId).then(setAgentFiles);
    } else {
      setAgentFiles([]);
    }
  }, [editingAgentId]);

  const handleInitAgents = async () => {
    setInitializingAgents(true);
    try {
      const tree = await initializeAgentTree(activeType);
      setCurrentAgents(tree);
      toast({ title: 'Multi-agente ativado!', description: 'Hierarquia criada: Gerente → Classificador → Avaliador' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally {
      setInitializingAgents(false);
    }
  };

  const handleSaveAgent = async (agent: AgentNode) => {
    const saved = await saveAgent(agent);
    if (saved) {
      setCurrentAgents(prev => prev.map(a => a.id === saved.id ? saved : a));
      toast({ title: 'Agente salvo!' });
    }
  };

  const handleDeleteAgent = async (id: string) => {
    // Also remove children
    const childIds = currentAgents.filter(a => a.parent_id === id).map(a => a.id);
    await deleteAgent(id);
    setCurrentAgents(prev => prev.filter(a => a.id !== id && !childIds.includes(a.id)));
    if (editingAgentId === id) setEditingAgentId(null);
    toast({ title: 'Agente removido' });
  };

  const defaultAgentConfig: Record<string, { nome: string; descricao: string; prompt: string }> = {
    classificador: {
      nome: 'Classificador',
      descricao: 'Identifica o tipo da reunião para direcionar ao avaliador correto',
      prompt: 'Você é um classificador de reuniões. Analise o título e o início da transcrição para identificar o tipo da reunião. Retorne APENAS JSON: {"tipo": "<nome exato do tipo>", "confianca": <0-100>}',
    },
    avaliador: {
      nome: `Novo Avaliador ${currentAgents.filter(a => a.tipo === 'avaliador').length + 1}`,
      descricao: 'Avalia reuniões com critérios específicos',
      prompt: 'Você é um avaliador de reuniões. Analise a transcrição e avalie cada critério com base nos sinais identificados. Seja específico e construtivo nos feedbacks.',
    },
    sentimental: {
      nome: 'Análise Sentimental',
      descricao: 'Classifica o nível de relacionamento e tom emocional da reunião',
      prompt: `Você é um especialista em análise de sentimentos em reuniões de vendas.
Analise a transcrição e classifique o nível de relacionamento geral da reunião.

NÍVEIS DISPONÍVEIS (use exatamente um):
- Positivo: reunião com boa energia, rapport, interesse genuíno
- Neutro: reunião profissional sem sinais claros positivos ou negativos
- Negativo: reunião com resistência, desinteresse ou conflito
- Preocupado: cliente demonstra dúvidas, incertezas sobre a solução
- Frustrado: cliente demonstra frustração, insatisfação ou impaciência

Avalie cada critério abaixo e retorne APENAS JSON válido (sem markdown):
{
  "sentimento": "<Positivo|Neutro|Negativo|Preocupado|Frustrado>",
  "confianca": <0-100>,
  "resumo": "<1-2 frases sobre o tom emocional geral>",
  "criteriaScores": [
    { "id": "<id>", "label": "<nome>", "weight": <peso>, "score": <0-100>, "feedback": "<feedback>" }
  ]
}`,
    },
  };

  const handleAddAgent = async (parentId: string, tipo: AgentTipo, insertIndex?: number) => {
    const config = defaultAgentConfig[tipo];
    if (!config) return;
    const siblings = currentAgents.filter(a => a.parent_id === parentId).sort((a, b) => a.ordem - b.ordem);
    const targetIndex = insertIndex ?? siblings.length;

    // Shift siblings at/after insertIndex
    if (insertIndex != null) {
      for (const sib of siblings) {
        if (sib.ordem >= targetIndex) {
          await saveAgent({ ...sib, ordem: sib.ordem + 1 });
        }
      }
    }

    const saved = await saveAgent({
      parent_id: parentId,
      modulo: activeType,
      tipo,
      nome: config.nome,
      descricao: config.descricao,
      prompt_sistema: config.prompt,
      criterios: tipo === 'sentimental' ? [
        { id: 'positivo', label: 'Positivo', weight: 20, description: 'Boa energia, rapport, interesse genuíno do cliente', examples: ['Tom entusiasmado', 'Perguntas de aprofundamento'], positiveSignals: ['Cliente engajado', 'Risadas naturais', 'Elogios à solução'], negativeSignals: [] },
        { id: 'neutro', label: 'Neutro', weight: 20, description: 'Profissional, sem sinais claros positivos ou negativos', examples: ['Tom formal', 'Respostas objetivas'], positiveSignals: ['Conversa fluida', 'Respostas diretas'], negativeSignals: [] },
        { id: 'negativo', label: 'Negativo', weight: 20, description: 'Resistência, desinteresse ou conflito', examples: ['Recusa em responder', 'Desinteresse'], positiveSignals: [], negativeSignals: ['Tom hostil', 'Interrupções frequentes', 'Respostas monossilábicas'] },
        { id: 'preocupado', label: 'Preocupado', weight: 20, description: 'Dúvidas, incertezas sobre a solução ou investimento', examples: ['Perguntas sobre risco', 'Hesitação'], positiveSignals: [], negativeSignals: ['Muitas perguntas de segurança', 'Pedidos de garantia', 'Menção a experiências ruins'] },
        { id: 'frustrado', label: 'Frustrado', weight: 20, description: 'Frustração, insatisfação ou impaciência do cliente', examples: ['Reclamações', 'Tom impaciente'], positiveSignals: [], negativeSignals: ['Reclamações explícitas', 'Tom elevado', 'Ameaça de cancelamento'] },
      ] : [],
      modelo_ia: 'gpt-4o-mini',
      temperatura: 0,
      ordem: targetIndex,
      ativo: true,
    });
    if (saved) {
      // Reload full tree to get updated ordem values
      const tree = await loadAgentTree(activeType);
      setCurrentAgents(tree);
      setEditingAgentId(saved.id);
      setAddingChildFor(null);
    }
  };

  const handleToggleAgent = async (agent: AgentNode) => {
    const updated = { ...agent, ativo: !agent.ativo };
    const saved = await saveAgent(updated);
    if (saved) setCurrentAgents(prev => prev.map(a => a.id === saved.id ? saved : a));
  };

  const handleUploadFile = async (file: File) => {
    if (!editingAgentId) return;
    setUploadingFile(true);
    try {
      let text = '';
      if (file.type === 'text/plain' || file.type === 'text/csv' || file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
        text = await file.text();
      } else {
        text = `[Arquivo: ${file.name}] — extração automática pendente`;
      }
      const saved = await saveAgentFile(editingAgentId, file, text);
      if (saved) setAgentFiles(prev => [saved, ...prev]);
      toast({ title: 'Arquivo enviado!' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro no upload', description: e.message });
    } finally {
      setUploadingFile(false);
    }
  };

  const handleLoadHistory = async () => {
    setShowHistory(true);
    if (executionHistory.length === 0) {
      setLoadingHistory(true);
      try {
        const logs = await loadRecentChainLogs(20);
        setExecutionHistory(logs);
      } catch (e) {
        console.error('Failed to load history:', e);
      } finally {
        setLoadingHistory(false);
      }
    }
  };

  const handleDeleteFile = async (f: AgentFile) => {
    await deleteAgentFile(f.id, f.storage_path);
    setAgentFiles(prev => prev.filter(x => x.id !== f.id));
  };

  // Load from DB on mount
  useEffect(() => {
    loadAIConfig('meetings').then(cfg => {
      if (cfg && cfg.criterios.length > 0) {
        setMeetingCriteria(cfg.criterios);
        if (cfg.prompt_sistema) setMeetingPrompt(cfg.prompt_sistema);
      } else {
        const stored = loadFromStorage(AI_CONFIG_STORAGE.MEETINGS_CRITERIA, null);
        if (stored) setMeetingCriteria(stored);
        const storedPrompt = loadFromStorage(AI_CONFIG_STORAGE.MEETINGS_PROMPT, null);
        if (storedPrompt) setMeetingPrompt(storedPrompt);
      }
    });
    loadAIConfig('whatsapp').then(cfg => {
      if (cfg && cfg.criterios.length > 0) {
        setWhatsappCriteria(cfg.criterios);
        if (cfg.prompt_sistema) setWhatsappPrompt(cfg.prompt_sistema);
      } else {
        const stored = loadFromStorage(AI_CONFIG_STORAGE.WHATSAPP_CRITERIA, null);
        if (stored) setWhatsappCriteria(stored);
        const storedPrompt = loadFromStorage(AI_CONFIG_STORAGE.WHATSAPP_PROMPT, null);
        if (storedPrompt) setWhatsappPrompt(storedPrompt);
      }
    });
  }, []);

  const criteria = activeType === 'meetings' ? meetingCriteria : whatsappCriteria;
  const setCriteria = activeType === 'meetings' ? setMeetingCriteria : setWhatsappCriteria;
  const systemPrompt = activeType === 'meetings' ? meetingPrompt : whatsappPrompt;
  const setSystemPrompt = activeType === 'meetings' ? setMeetingPrompt : setWhatsappPrompt;
  const totalWeight = criteria.reduce((a, c) => a + c.weight, 0);
  const remainingWeight = 100 - totalWeight;

  const handleApplyMethodology = (preset: MethodologyPreset) => {
    setCriteria(preset.criteria);
    setSystemPrompt(preset.systemPrompt);
    toast({
      title: `${preset.icon} ${preset.name} aplicada!`,
      description: `${preset.criteria.length} critérios e prompt do sistema atualizados. Salve para persistir.`,
    });
  };

  const handleSaveCriteria = (updated: EvalCriteria) => {
    setCriteria(prev => {
      const exists = prev.some(c => c.id === updated.id);
      return exists ? prev.map(c => c.id === updated.id ? updated : c) : [...prev, updated];
    });
  };

  const handleDelete = (id: string) => {
    setCriteria(prev => prev.filter(c => c.id !== id));
  };

  const handleSaveConfig = async () => {
    if (totalWeight !== 100) {
      toast({
        variant: 'destructive',
        title: 'Pesos inválidos',
        description: `Os pesos devem somar 100%. Atualmente somam ${totalWeight}%.`,
      });
      return;
    }
    // Persist to DB
    try {
      if (activeType === 'meetings') {
        await saveAIConfig('meetings', meetingCriteria, meetingPrompt);
        // Also keep localStorage for backwards compat
        localStorage.setItem(AI_CONFIG_STORAGE.MEETINGS_CRITERIA, JSON.stringify(meetingCriteria));
        localStorage.setItem(AI_CONFIG_STORAGE.MEETINGS_PROMPT, JSON.stringify(meetingPrompt));
      } else {
        await saveAIConfig('whatsapp', whatsappCriteria, whatsappPrompt);
        localStorage.setItem(AI_CONFIG_STORAGE.WHATSAPP_CRITERIA, JSON.stringify(whatsappCriteria));
        localStorage.setItem(AI_CONFIG_STORAGE.WHATSAPP_PROMPT, JSON.stringify(whatsappPrompt));
      }
    } catch (e: any) {
      console.warn('[ai-config] Falha ao salvar no banco:', e);
    }
    toast({
      title: 'Configuração salva!',
      description: `Critérios de ${activeType === 'meetings' ? 'reuniões' : 'WhatsApp'} salvos com sucesso.`,
    });
  };

  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ score: number; summary: string; breakdown: { label: string; score: number; feedback: string }[] } | null>(null);

  const handleTest = async () => {
    const token = activeType === 'meetings' ? tokens.meetings : tokens.whatsapp;
    const model = activeType === 'meetings' ? (models.meetings || 'gpt-4o-mini') : (models.whatsapp || 'gpt-4o-mini');
    if (!token) {
      toast({ variant: 'destructive', title: 'Token não configurado', description: 'Configure o token OpenAI no Admin antes de testar.' });
      return;
    }
    setTestLoading(true);
    setTestResult(null);
    const sampleTranscript = activeType === 'meetings'
      ? '[VENDEDOR] Olá Pedro, tudo bem? Obrigado por reservar esse tempo.\n[LEAD] Olá! Sim, vi sua proposta e quero entender melhor.\n[VENDEDOR] Ótimo! Me conta, qual é o principal desafio da sua equipe de vendas hoje?\n[LEAD] Temos dificuldade com follow-up. Os vendedores não sabem o momento certo de abordar.\n[VENDEDOR] Entendo. Nossa plataforma resolve exatamente isso com IA. Posso mostrar?\n[LEAD] Sim, pode mostrar.\n[VENDEDOR] [Apresentação de 10 min] ...e o ROI médio dos clientes é de 35%.\n[LEAD] Interessante. Qual o preço?\n[VENDEDOR] Depende do tamanho da equipe. Para vocês, seria R$1.200/mês.\n[LEAD] Preciso consultar o financeiro.\n[VENDEDOR] Claro! Posso marcar uma call com o financeiro na semana que vem?'
      : '[VENDEDOR] Olá Ana! Vi que você acessou nosso site. Posso ajudar?\n[LEAD] Oi! Sim, tenho interesse em automatizar o WhatsApp da minha equipe.\n[VENDEDOR] Perfeito! Quantos vendedores você tem?\n[LEAD] São 5 pessoas.\n[VENDEDOR] Ótimo perfil! Você é a decisora ou tem outras pessoas envolvidas?\n[LEAD] Sou eu mesma.\n[VENDEDOR] Qual é o principal problema que você quer resolver? Tempo de resposta, organização...?\n[LEAD] Os dois! Demora muito e fica tudo desorganizado.\n[VENDEDOR] Entendo. Nossa plataforma resolve isso. Posso te enviar um vídeo de 3 min demonstrando?\n[LEAD] Pode sim!\n[VENDEDOR] Ótimo, vou enviar agora. Posso marcar 15 min amanhã para tirar dúvidas?';
    const criteriaText = criteria.map(c =>
      `- ${c.label} (peso ${c.weight}%): ${c.description}`
    ).join('\n');
    try {
      const data = await callOpenAI(token, {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Analise esta conversa de exemplo usando os critérios abaixo e retorne APENAS JSON:\n\nCritérios:\n${criteriaText}\n\nConversa:\n${sampleTranscript}\n\nJSON esperado:\n{"totalScore":<0-100>,"summary":"<2 frases>","breakdown":[{"label":"<critério>","score":<0-100>,"feedback":"<1 frase>"}]}` },
        ],
        temperature: 0.3,
        max_tokens: 800,
      });
      const raw = (data.choices?.[0]?.message?.content || '').replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      setTestResult(JSON.parse(raw));
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro no teste', description: e.message });
    } finally { setTestLoading(false); }
  };

  return (
    <div className="page-container animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold">Configuração de IA</h1>
          <p className="text-sm text-muted-foreground">Defina como a IA avalia reuniões e conversas de WhatsApp</p>
        </div>
        <Button size="sm" className="bg-gradient-primary text-xs h-8" onClick={handleSaveConfig}>
          <Save className="w-3.5 h-3.5 mr-1.5" />
          Salvar Configurações
        </Button>
      </div>

      {/* Type selector */}
      <div className="flex gap-1 p-1 bg-secondary rounded-lg border border-border mb-6 w-fit">
        {([
          { key: 'meetings', label: 'Reuniões (Meet)', icon: Video },
          { key: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setActiveType(t.key)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-medium transition-colors',
              activeType === t.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══ MEETINGS TAB: Zoomable Canvas ═══ */}
      {activeType === 'meetings' && (
        <>
          {!hasMultiAgent ? (
            <div className="glass-card p-8 rounded-xl text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                <Crown className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold mb-1">Sistema Multi-Agente</h2>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Ative a hierarquia de agentes para avaliar reuniões de forma especializada.
                  Cada tipo de reunião pode ter critérios e ebooks de referência próprios.
                </p>
              </div>
              <Button className="bg-gradient-primary" onClick={handleInitAgents} disabled={initializingAgents}>
                {initializingAgents
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Criando...</>
                  : <><Crown className="w-4 h-4 mr-2" /> Ativar Multi-Agente</>}
              </Button>
            </div>
          ) : (
            <div className="relative">
              {/* History button — top right */}
              <div className="absolute top-0 right-0 z-10 mb-3">
                <Button size="sm" variant="outline" className="h-8 text-xs border-border gap-1.5" onClick={handleLoadHistory}>
                  <History className="w-3.5 h-3.5" /> Histórico de Execuções
                </Button>
              </div>

              {/* Canvas container */}
              <div
                ref={canvasRef}
                className="relative w-full rounded-2xl border border-border overflow-hidden bg-[radial-gradient(circle_at_1px_1px,hsl(var(--border)/0.3)_1px,transparent_0)] bg-[length:24px_24px] mt-10"
                style={{ height: 'calc(100vh - 260px)', minHeight: 400, cursor: isPanning ? 'grabbing' : 'grab' }}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                {/* Zoomable/pannable content */}
                <div
                  className="absolute inset-0 flex items-start justify-center pt-12 transition-transform duration-75"
                  style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: 'top center' }}
                >
                  {/* Recursive tree rendering */}
                  {rootAgent && (
                    <CanvasTreeNode
                      agent={rootAgent}
                      agents={currentAgents}
                      getChildren={getChildren}
                      onClickAgent={setEditingAgentId}
                      onToggleAgent={handleToggleAgent}
                      addingChildFor={addingChildFor}
                      setAddingChildFor={setAddingChildFor}
                      onAddAgent={handleAddAgent}
                    />
                  )}
                </div>

                {/* Zoom controls — bottom-right */}
                <div className="absolute bottom-4 right-4 flex items-center gap-1 bg-background/90 backdrop-blur-sm rounded-xl border border-border p-1 shadow-lg">
                  <button onClick={handleZoomOut} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center" title="Zoom out">
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-mono font-medium w-12 text-center text-muted-foreground">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button onClick={handleZoomIn} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center" title="Zoom in">
                    <Plus className="w-4 h-4" />
                  </button>
                  <div className="w-px h-5 bg-border mx-0.5" />
                  <button onClick={handleZoomReset} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center" title="Reset zoom">
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Legend — bottom-left */}
                <div className="absolute bottom-4 left-4 bg-background/90 backdrop-blur-sm rounded-xl border border-border px-3 py-2 shadow-lg">
                  <div className="flex items-center gap-4 text-[10px]">
                    <span className="flex items-center gap-1"><Crown className="w-3 h-3 text-red-400" /> Gerente</span>
                    <span className="flex items-center gap-1"><GitBranch className="w-3 h-3 text-orange-400" /> Classificador</span>
                    <span className="flex items-center gap-1"><Users className="w-3 h-3 text-blue-400" /> Avaliador</span>
                    <span className="flex items-center gap-1"><Heart className="w-3 h-3 text-purple-400" /> Sentimental</span>
                  </div>
                </div>
              </div>

              {/* Agent config modal */}
              {editingAgent && (
                <AgentConfigModal
                  agent={editingAgent}
                  onSave={handleSaveAgent}
                  onDelete={handleDeleteAgent}
                  onClose={() => setEditingAgentId(null)}
                  files={agentFiles}
                  onUploadFile={handleUploadFile}
                  onDeleteFile={handleDeleteFile}
                  uploadingFile={uploadingFile}
                />
              )}

              {/* ═══ Execution History Drawer ═══ */}
              {showHistory && (
                <div className="fixed inset-y-0 right-0 w-[440px] bg-background border-l border-border z-40 flex flex-col shadow-2xl animate-fade-in">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                    <div className="flex items-center gap-2">
                      <History className="w-4 h-4 text-primary" />
                      <h3 className="text-sm font-semibold">Histórico de Execuções</h3>
                    </div>
                    <button onClick={() => setShowHistory(false)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted">
                      <X className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {loadingHistory && (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                      </div>
                    )}
                    {!loadingHistory && executionHistory.length === 0 && (
                      <div className="text-center py-12">
                        <Clock className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">Nenhuma execução encontrada</p>
                        <p className="text-[10px] text-muted-foreground/60 mt-1">As execuções aparecerão aqui após avaliar reuniões</p>
                      </div>
                    )}
                    {executionHistory.map(exec => (
                      <div key={exec.id} className="glass-card p-4 rounded-xl border border-border">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold truncate flex-1 mr-2">
                            {exec.payload?.titulo || 'Reunião'}
                          </span>
                          <span className={cn('text-sm font-bold font-mono',
                            exec.score >= 85 ? 'text-success' : exec.score >= 70 ? 'text-primary' : exec.score >= 50 ? 'text-warning' : 'text-destructive'
                          )}>{exec.score}</span>
                        </div>
                        <div className="flex items-center gap-2 mb-3">
                          {exec.tipo_reuniao_detectado && (
                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 font-medium">
                              {exec.tipo_reuniao_detectado}
                            </span>
                          )}
                          <span className="text-[9px] text-muted-foreground">
                            {new Date(exec.criado_em).toLocaleDateString('pt-BR')} {new Date(exec.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        {/* Chain timeline */}
                        <div className="space-y-0">
                          {(exec.chain_log || []).map((step: any, i: number) => (
                            <div key={i} className="flex gap-3">
                              <div className="flex flex-col items-center">
                                <div className={cn('w-2.5 h-2.5 rounded-full border-2 flex-shrink-0',
                                  step.tipo === 'fallback' ? 'bg-warning border-warning/30' : 'bg-success border-success/30'
                                )} />
                                {i < (exec.chain_log || []).length - 1 && (
                                  <div className="w-0.5 flex-1 min-h-[20px] bg-border/60" />
                                )}
                              </div>
                              <div className="pb-3 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <p className="text-[11px] font-semibold">{step.agente}</p>
                                  <span className={cn('text-[8px] px-1.5 py-0.5 rounded-full font-medium uppercase',
                                    step.tipo === 'classificador' ? 'bg-orange-500/10 text-orange-400' :
                                    step.tipo === 'avaliador' ? 'bg-blue-500/10 text-blue-400' :
                                    step.tipo === 'fallback' ? 'bg-warning/10 text-warning' :
                                    'bg-muted text-muted-foreground'
                                  )}>{step.tipo}</span>
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{step.output_resumo}</p>
                                {step.duracao_ms > 0 && (
                                  <span className="text-[9px] text-muted-foreground/50">{step.duracao_ms}ms</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                        {exec.resumo && (
                          <p className="text-[10px] text-muted-foreground mt-2 pt-2 border-t border-border/50 leading-snug line-clamp-2">{exec.resumo}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ═══ WHATSAPP TAB: Same multi-agent canvas as Meetings ═══ */}
      {activeType === 'whatsapp' && (
        <>
          {!hasMultiAgent ? (
            <div className="glass-card p-8 rounded-xl text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto">
                <MessageSquare className="w-8 h-8 text-accent" />
              </div>
              <div>
                <h2 className="text-lg font-semibold mb-1">Sistema Multi-Agente — WhatsApp</h2>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Ative a hierarquia de agentes para avaliar conversas WhatsApp de forma especializada.
                  Cada tipo de conversa pode ter critérios e metodologias próprias.
                </p>
              </div>
              <Button className="bg-gradient-primary" onClick={handleInitAgents} disabled={initializingAgents}>
                {initializingAgents
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Criando...</>
                  : <><Crown className="w-4 h-4 mr-2" /> Ativar Multi-Agente</>}
              </Button>
            </div>
          ) : (
            <div className="relative">
              {/* Canvas container */}
              <div
                ref={canvasRef}
                className="relative w-full rounded-2xl border border-border overflow-hidden bg-[radial-gradient(circle_at_1px_1px,hsl(var(--border)/0.3)_1px,transparent_0)] bg-[length:24px_24px]"
                style={{ height: 'calc(100vh - 260px)', minHeight: 400, cursor: isPanning ? 'grabbing' : 'grab' }}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                <div
                  className="absolute inset-0 flex items-start justify-center pt-12 transition-transform duration-75"
                  style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: 'top center' }}
                >
                  {rootAgent && (
                    <CanvasTreeNode
                      agent={rootAgent}
                      agents={currentAgents}
                      getChildren={getChildren}
                      onClickAgent={setEditingAgentId}
                      onToggleAgent={handleToggleAgent}
                      addingChildFor={addingChildFor}
                      setAddingChildFor={setAddingChildFor}
                      onAddAgent={handleAddAgent}
                    />
                  )}
                </div>

                {/* Zoom controls */}
                <div className="absolute bottom-4 right-4 flex items-center gap-1 bg-background/90 backdrop-blur-sm rounded-xl border border-border p-1 shadow-lg">
                  <button onClick={handleZoomOut} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center" title="Zoom out">
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-mono font-medium w-12 text-center text-muted-foreground">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button onClick={handleZoomIn} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center" title="Zoom in">
                    <Plus className="w-4 h-4" />
                  </button>
                  <div className="w-px h-5 bg-border mx-0.5" />
                  <button onClick={handleZoomReset} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center" title="Reset zoom">
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Legend */}
                <div className="absolute bottom-4 left-4 bg-background/90 backdrop-blur-sm rounded-xl border border-border px-3 py-2 shadow-lg">
                  <div className="flex items-center gap-4 text-[10px]">
                    <span className="flex items-center gap-1"><Crown className="w-3 h-3 text-red-400" /> Gerente</span>
                    <span className="flex items-center gap-1"><GitBranch className="w-3 h-3 text-orange-400" /> Classificador</span>
                    <span className="flex items-center gap-1"><Users className="w-3 h-3 text-blue-400" /> Avaliador</span>
                    <span className="flex items-center gap-1"><Heart className="w-3 h-3 text-purple-400" /> Sentimental</span>
                  </div>
                </div>
              </div>

              {/* Agent config modal */}
              {editingAgent && (
                <AgentConfigModal
                  agent={editingAgent}
                  onSave={handleSaveAgent}
                  onDelete={handleDeleteAgent}
                  onClose={() => setEditingAgentId(null)}
                  files={agentFiles}
                  onUploadFile={handleUploadFile}
                  onDeleteFile={handleDeleteFile}
                  uploadingFile={uploadingFile}
                />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
