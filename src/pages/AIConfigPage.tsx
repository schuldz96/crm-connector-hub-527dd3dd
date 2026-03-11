import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  SlidersHorizontal, Brain, Plus, X, Save, Sparkles,
  Video, MessageSquare, Trash2, GripVertical,
  CheckCircle2, Star, Target, AlertTriangle, Loader2,
  Crown, GitBranch, Users, FileText, Upload, ChevronDown, ChevronRight,
  Power, PowerOff, Copy, Pencil
} from 'lucide-react';
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

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const s = localStorage.getItem(key);
    return s ? JSON.parse(s) : fallback;
  } catch { return fallback; }
}

const DEFAULT_MEETING_PROMPT = 'Você é um avaliador especialista em vendas consultivas. Analise a transcrição da reunião e avalie cada critério com base nos sinais identificados. Seja específico e construtivo nos feedbacks.';
const DEFAULT_WHATSAPP_PROMPT = 'Você é um especialista em vendas digitais e atendimento via WhatsApp. Avalie as conversas com foco em efetividade comercial, qualificação de leads e conversão.';

// ─── Agent Organogram Card ───────────────────────────────────────────────────
function AgentCard({
  agent,
  isSelected,
  onSelect,
  onToggle,
}: {
  agent: AgentNode;
  isSelected: boolean;
  onSelect: () => void;
  onToggle: () => void;
}) {
  const iconByType = { gerente: Crown, classificador: GitBranch, avaliador: Users };
  const colorByType = {
    gerente: 'border-red-500/40 bg-red-500/5',
    classificador: 'border-orange-500/40 bg-orange-500/5',
    avaliador: 'border-blue-500/40 bg-blue-500/5',
  };
  const Icon = iconByType[agent.tipo];

  return (
    <div
      onClick={onSelect}
      className={cn(
        'relative p-3 rounded-xl border-2 cursor-pointer transition-all min-w-[140px] max-w-[180px]',
        colorByType[agent.tipo],
        isSelected ? 'ring-2 ring-primary shadow-lg scale-105' : 'hover:shadow-md hover:scale-[1.02]',
        !agent.ativo && 'opacity-40'
      )}
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="text-[11px] font-semibold truncate">{agent.nome}</span>
      </div>
      <p className="text-[9px] text-muted-foreground line-clamp-2">{agent.descricao || agent.tipo}</p>
      {agent.tipo === 'avaliador' && (
        <div className="flex items-center gap-1 mt-1.5">
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
            {(agent.criterios || []).length} critérios
          </span>
        </div>
      )}
      <button
        onClick={e => { e.stopPropagation(); onToggle(); }}
        className={cn('absolute top-2 right-2 p-0.5 rounded', agent.ativo ? 'text-success' : 'text-muted-foreground')}
        title={agent.ativo ? 'Ativo' : 'Inativo'}
      >
        {agent.ativo ? <Power className="w-3 h-3" /> : <PowerOff className="w-3 h-3" />}
      </button>
    </div>
  );
}

// ─── Agent Config Panel (right side) ─────────────────────────────────────────
function AgentConfigPanel({
  agent,
  onSave,
  onDelete,
  files,
  onUploadFile,
  onDeleteFile,
  uploadingFile,
}: {
  agent: AgentNode;
  onSave: (a: AgentNode) => void;
  onDelete: (id: string) => void;
  files: AgentFile[];
  onUploadFile: (file: File) => void;
  onDeleteFile: (f: AgentFile) => void;
  uploadingFile: boolean;
}) {
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn('text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider',
            form.tipo === 'gerente' ? 'bg-red-500/10 text-red-400' :
            form.tipo === 'classificador' ? 'bg-orange-500/10 text-orange-400' :
            'bg-blue-500/10 text-blue-400'
          )}>{form.tipo}</span>
          <h3 className="text-sm font-semibold">{form.nome}</h3>
        </div>
        <div className="flex items-center gap-1">
          {dirty && (
            <Button size="sm" className="h-7 text-xs bg-gradient-primary" onClick={() => { onSave(form); setDirty(false); }}>
              <Save className="w-3 h-3 mr-1" /> Salvar
            </Button>
          )}
          {form.tipo === 'avaliador' && (
            <Button size="sm" variant="outline" className="h-7 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
              onClick={() => onDelete(form.id)}>
              <Trash2 className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Name + Description */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-medium block mb-1">Nome</label>
          <Input value={form.nome} onChange={e => update({ nome: e.target.value })}
            className="h-8 text-xs bg-secondary border-border" />
        </div>
        <div>
          <label className="text-[10px] font-medium block mb-1">Modelo IA</label>
          <select value={form.modelo_ia || 'gpt-4o-mini'}
            onChange={e => update({ modelo_ia: e.target.value })}
            className="w-full h-8 text-xs bg-secondary border border-border rounded-md px-2">
            <option value="gpt-4o-mini">GPT-4o Mini</option>
            <option value="gpt-4o">GPT-4o</option>
            <option value="gpt-4-turbo">GPT-4 Turbo</option>
          </select>
        </div>
      </div>

      <div>
        <label className="text-[10px] font-medium block mb-1">Descrição</label>
        <Input value={form.descricao || ''} onChange={e => update({ descricao: e.target.value })}
          className="h-8 text-xs bg-secondary border-border" placeholder="Ex: Avalia reuniões de closer inbound" />
      </div>

      {/* System Prompt */}
      <div>
        <label className="text-[10px] font-medium block mb-1">
          <Brain className="w-3 h-3 inline mr-1" />Prompt do Sistema
        </label>
        <Textarea value={form.prompt_sistema} onChange={e => update({ prompt_sistema: e.target.value })}
          className="text-xs bg-secondary border-border min-h-[100px] resize-none" />
      </div>

      {/* Criteria (avaliador only) */}
      {form.tipo === 'avaliador' && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-semibold">Critérios de Avaliação</label>
              <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full border font-semibold',
                totalWeight === 100 ? 'bg-success/10 text-success border-success/20' :
                'bg-warning/10 text-warning border-warning/20')}>
                {totalWeight}%
              </span>
            </div>
            <Button size="sm" variant="outline" className="h-6 text-[10px] border-border"
              disabled={remainingWeight <= 0} onClick={() => setAddingCrit(true)}>
              <Plus className="w-3 h-3 mr-0.5" /> Critério
            </Button>
          </div>
          <div className="space-y-2">
            {(form.criterios || []).map(c => (
              <CriteriaCard key={c.id} criteria={c} onEdit={setEditingCrit} onDelete={handleDeleteCrit} />
            ))}
          </div>
        </div>
      )}

      {/* Reference Files (avaliador only) */}
      {form.tipo === 'avaliador' && (
        <div>
          <label className="text-[10px] font-semibold block mb-2">
            <FileText className="w-3 h-3 inline mr-1" />Arquivos de Referência
          </label>
          <p className="text-[9px] text-muted-foreground mb-2">
            PDFs, DOCX ou CSVs que o agente deve usar como base para avaliar (ex: ebooks de vendas)
          </p>
          <div className="space-y-1.5 mb-2">
            {files.map(f => (
              <div key={f.id} className="flex items-center justify-between p-2 rounded-lg bg-secondary border border-border">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="text-[10px] truncate">{f.nome}</span>
                  <span className="text-[9px] text-muted-foreground flex-shrink-0">
                    {(f.tamanho / 1024).toFixed(0)}KB
                  </span>
                </div>
                <button onClick={() => onDeleteFile(f)} className="p-1 rounded hover:bg-destructive/10">
                  <Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            ))}
          </div>
          <label className={cn(
            'flex items-center justify-center gap-2 p-3 rounded-lg border-2 border-dashed cursor-pointer transition-colors',
            uploadingFile ? 'border-primary/50 bg-primary/5' : 'border-border hover:border-primary/30 hover:bg-primary/5'
          )}>
            {uploadingFile ? (
              <><Loader2 className="w-4 h-4 animate-spin text-primary" /><span className="text-xs text-primary">Enviando...</span></>
            ) : (
              <><Upload className="w-4 h-4 text-muted-foreground" /><span className="text-xs text-muted-foreground">Enviar arquivo</span></>
            )}
            <input type="file" className="hidden" accept=".pdf,.csv,.docx,.odt,.txt"
              onChange={e => { const f = e.target.files?.[0]; if (f) onUploadFile(f); e.target.value = ''; }}
              disabled={uploadingFile} />
          </label>
        </div>
      )}

      {/* Criteria modals */}
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

  // Multi-agent state
  const [agents, setAgents] = useState<AgentNode[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [agentFiles, setAgentFiles] = useState<AgentFile[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [initializingAgents, setInitializingAgents] = useState(false);

  const { gerente, classificador, avaliadores } = buildAgentTree(agents);
  const selectedAgent = agents.find(a => a.id === selectedAgentId) || null;
  const hasMultiAgent = agents.length > 0;

  // Load agents on mount
  useEffect(() => {
    loadAgentTree().then(data => {
      setAgents(data);
      if (data.length > 0 && !selectedAgentId) {
        const firstAvaliador = data.find(a => a.tipo === 'avaliador');
        setSelectedAgentId(firstAvaliador?.id || data[0]?.id || null);
      }
    });
  }, []);

  // Load files when selected agent changes
  useEffect(() => {
    if (selectedAgentId) {
      loadAgentFiles(selectedAgentId).then(setAgentFiles);
    } else {
      setAgentFiles([]);
    }
  }, [selectedAgentId]);

  const handleInitAgents = async () => {
    setInitializingAgents(true);
    try {
      const tree = await initializeAgentTree();
      setAgents(tree);
      const firstAvaliador = tree.find(a => a.tipo === 'avaliador');
      setSelectedAgentId(firstAvaliador?.id || tree[0]?.id || null);
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
      setAgents(prev => prev.map(a => a.id === saved.id ? saved : a));
      toast({ title: 'Agente salvo!' });
    }
  };

  const handleDeleteAgent = async (id: string) => {
    await deleteAgent(id);
    setAgents(prev => prev.filter(a => a.id !== id));
    if (selectedAgentId === id) setSelectedAgentId(null);
    toast({ title: 'Agente removido' });
  };

  const handleAddAvaliador = async () => {
    if (!classificador) return;
    const saved = await saveAgent({
      parent_id: classificador.id,
      tipo: 'avaliador',
      nome: `Novo Avaliador ${avaliadores.length + 1}`,
      descricao: '',
      prompt_sistema: 'Você é um avaliador de reuniões. Analise a transcrição e avalie cada critério.',
      criterios: [],
      modelo_ia: 'gpt-4o-mini',
      temperatura: 0,
      ordem: avaliadores.length,
      ativo: true,
    });
    if (saved) {
      setAgents(prev => [...prev, saved]);
      setSelectedAgentId(saved.id);
    }
  };

  const handleToggleAgent = async (agent: AgentNode) => {
    const updated = { ...agent, ativo: !agent.ativo };
    const saved = await saveAgent(updated);
    if (saved) setAgents(prev => prev.map(a => a.id === saved.id ? saved : a));
  };

  const handleUploadFile = async (file: File) => {
    if (!selectedAgentId) return;
    setUploadingFile(true);
    try {
      // Extract text client-side for txt/csv
      let text = '';
      if (file.type === 'text/plain' || file.type === 'text/csv' || file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
        text = await file.text();
      } else {
        // For PDF/DOCX, store empty for now (can be enhanced with pdf.js/mammoth later)
        text = `[Arquivo: ${file.name}] — extração automática pendente`;
      }
      const saved = await saveAgentFile(selectedAgentId, file, text);
      if (saved) setAgentFiles(prev => [saved, ...prev]);
      toast({ title: 'Arquivo enviado!' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro no upload', description: e.message });
    } finally {
      setUploadingFile(false);
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

      {/* ═══ MEETINGS TAB: Multi-Agent Organogram ═══ */}
      {activeType === 'meetings' && (
        <>
          {!hasMultiAgent ? (
            /* Activation banner */
            <div className="glass-card p-8 rounded-xl text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                <Crown className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold mb-1">Sistema Multi-Agente</h2>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Ative a hierarquia de agentes para avaliar reuniões de forma especializada.
                  O Gerente orquestra, o Classificador identifica o tipo, e cada Avaliador
                  tem seus próprios critérios e materiais de referência.
                </p>
              </div>
              <Button className="bg-gradient-primary" onClick={handleInitAgents} disabled={initializingAgents}>
                {initializingAgents
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Criando...</>
                  : <><Crown className="w-4 h-4 mr-2" /> Ativar Multi-Agente</>}
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* Left: Organogram */}
              <div className="lg:col-span-2 space-y-4">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <GitBranch className="w-4 h-4" /> Hierarquia de Agentes
                </h2>

                {/* Organogram tree */}
                <div className="flex flex-col items-center gap-0">
                  {/* Gerente */}
                  {gerente && (
                    <>
                      <AgentCard agent={gerente} isSelected={selectedAgentId === gerente.id}
                        onSelect={() => setSelectedAgentId(gerente.id)}
                        onToggle={() => handleToggleAgent(gerente)} />
                      <div className="w-px h-6 bg-border" />
                    </>
                  )}

                  {/* Classificador */}
                  {classificador && (
                    <>
                      <AgentCard agent={classificador} isSelected={selectedAgentId === classificador.id}
                        onSelect={() => setSelectedAgentId(classificador.id)}
                        onToggle={() => handleToggleAgent(classificador)} />
                      <div className="w-px h-6 bg-border" />
                    </>
                  )}

                  {/* Avaliadores row */}
                  <div className="relative w-full">
                    {/* Horizontal connector line */}
                    {avaliadores.length > 1 && (
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 h-px bg-border"
                        style={{ width: `${Math.min(90, avaliadores.length * 30)}%` }} />
                    )}
                    <div className="flex flex-wrap justify-center gap-3 pt-2">
                      {avaliadores.map(a => (
                        <div key={a.id} className="flex flex-col items-center">
                          <div className="w-px h-4 bg-border" />
                          <AgentCard agent={a} isSelected={selectedAgentId === a.id}
                            onSelect={() => setSelectedAgentId(a.id)}
                            onToggle={() => handleToggleAgent(a)} />
                        </div>
                      ))}
                      {/* Add avaliador button */}
                      <div className="flex flex-col items-center">
                        <div className="w-px h-4 bg-transparent" />
                        <button
                          onClick={handleAddAvaliador}
                          className="w-[140px] p-3 rounded-xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-primary/5 transition-colors flex flex-col items-center gap-1"
                        >
                          <Plus className="w-5 h-5 text-muted-foreground" />
                          <span className="text-[10px] text-muted-foreground">Novo Avaliador</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Legend */}
                <div className="glass-card p-3 rounded-xl">
                  <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Como funciona</p>
                  <div className="space-y-1.5">
                    <div className="flex items-start gap-2">
                      <Crown className="w-3 h-3 text-red-400 mt-0.5 flex-shrink-0" />
                      <p className="text-[10px] text-muted-foreground"><strong>Gerente</strong> — Orquestra a avaliação</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <GitBranch className="w-3 h-3 text-orange-400 mt-0.5 flex-shrink-0" />
                      <p className="text-[10px] text-muted-foreground"><strong>Classificador</strong> — Identifica o tipo da reunião</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <Users className="w-3 h-3 text-blue-400 mt-0.5 flex-shrink-0" />
                      <p className="text-[10px] text-muted-foreground"><strong>Avaliadores</strong> — Cada um avalia um tipo específico com seus critérios e ebooks</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Agent config panel */}
              <div className="lg:col-span-3">
                {selectedAgent ? (
                  <div className="glass-card p-5 rounded-xl">
                    <AgentConfigPanel
                      agent={selectedAgent}
                      onSave={handleSaveAgent}
                      onDelete={handleDeleteAgent}
                      files={agentFiles}
                      onUploadFile={handleUploadFile}
                      onDeleteFile={handleDeleteFile}
                      uploadingFile={uploadingFile}
                    />
                  </div>
                ) : (
                  <div className="glass-card p-8 rounded-xl text-center text-muted-foreground">
                    <Brain className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Selecione um agente para configurar</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══ WHATSAPP TAB: Original criteria view ═══ */}
      {activeType === 'whatsapp' && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Criteria list */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="text-sm font-semibold">Critérios de Avaliação</h2>
                  <span className={cn(
                    'text-[10px] px-2 py-0.5 rounded-full border font-semibold',
                    totalWeight === 100
                      ? 'bg-success/10 text-success border-success/20'
                      : totalWeight > 100
                      ? 'bg-destructive/10 text-destructive border-destructive/20'
                      : 'bg-warning/10 text-warning border-warning/20'
                  )}>
                    Total: {totalWeight}% {totalWeight !== 100 && '⚠️'}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs border-border h-7"
                  disabled={remainingWeight <= 0}
                  onClick={() => setAddingCriteria(true)}
                >
                  <Plus className="w-3 h-3 mr-1" /> Adicionar
                </Button>
              </div>

              {criteria.map(c => (
                <CriteriaCard
                  key={c.id}
                  criteria={c}
                  onEdit={setEditingCriteria}
                  onDelete={handleDelete}
                />
              ))}

              {totalWeight !== 100 && (
                <div className={cn(
                  'flex items-center gap-2 p-3 rounded-lg border',
                  totalWeight > 100
                    ? 'bg-destructive/5 border-destructive/20'
                    : 'bg-warning/5 border-warning/20'
                )}>
                  <AlertTriangle className={cn('w-4 h-4 flex-shrink-0', totalWeight > 100 ? 'text-destructive' : 'text-warning')} />
                  <p className="text-xs text-muted-foreground">
                    {totalWeight > 100
                      ? <>Os pesos ultrapassam 100%. Reduza <span className="text-destructive font-semibold">{totalWeight - 100}%</span> antes de salvar.</>
                      : <>Os pesos devem somar exatamente 100%. Faltam <span className="text-warning font-semibold">{remainingWeight}%</span> para distribuir.</>
                    }
                  </p>
                </div>
              )}
            </div>

            {/* System prompt + settings */}
            <div className="space-y-4">
              <div className="glass-card p-4 rounded-xl space-y-3">
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-accent" />
                  <h3 className="text-xs font-semibold">Prompt do Sistema</h3>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Este prompt define o comportamento base da IA ao avaliar conversas de WhatsApp.
                </p>
                <Textarea
                  value={systemPrompt}
                  onChange={e => setSystemPrompt(e.target.value)}
                  className="text-xs bg-secondary border-border min-h-[140px] resize-none"
                />
              </div>

              <div className="glass-card p-4 rounded-xl space-y-3">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" />
                  <h3 className="text-xs font-semibold">Parâmetros</h3>
                </div>
                <div className="space-y-2.5">
                  {[
                    { label: 'Score mínimo para aprovação', value: '70' },
                    { label: 'Score de excelência', value: '85' },
                    { label: 'Modelo de IA', value: 'GPT-4o Mini' },
                  ].map(p => (
                    <div key={p.label} className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{p.label}</span>
                      <span className="text-xs font-semibold text-foreground">{p.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass-card p-4 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-accent" />
                  <h3 className="text-xs font-semibold">Testar Configuração</h3>
                </div>
                <p className="text-[10px] text-muted-foreground mb-3">
                  Roda uma conversa de exemplo com a OpenAI usando seu prompt e critérios atuais.
                </p>
                <Button
                  size="sm"
                  className="w-full text-xs h-8 bg-gradient-primary"
                  onClick={handleTest}
                  disabled={testLoading}>
                  {testLoading
                    ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Analisando...</>
                    : <><Brain className="w-3.5 h-3.5 mr-1.5" /> Testar com Exemplo</>}
                </Button>

                {testResult && (
                  <div className="mt-3 space-y-2.5 pt-3 border-t border-border/50">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Score</span>
                      <span className={cn('text-lg font-bold font-mono',
                        testResult.score >= 85 ? 'text-success' : testResult.score >= 70 ? 'text-primary' : testResult.score >= 50 ? 'text-warning' : 'text-destructive')}>
                        {testResult.score}/100
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug">{testResult.summary}</p>
                    <div className="space-y-1.5">
                      {testResult.breakdown?.map((b, i) => (
                        <div key={i} className="space-y-0.5">
                          <div className="flex justify-between text-[10px]">
                            <span className="text-muted-foreground">{b.label}</span>
                            <span className={cn('font-bold font-mono',
                              b.score >= 85 ? 'text-success' : b.score >= 70 ? 'text-primary' : b.score >= 50 ? 'text-warning' : 'text-destructive')}>{b.score}</span>
                          </div>
                          <div className="h-1 rounded-full bg-muted overflow-hidden">
                            <div className={cn('h-full rounded-full', b.score >= 85 ? 'bg-success' : b.score >= 70 ? 'bg-primary' : b.score >= 50 ? 'bg-warning' : 'bg-destructive')}
                              style={{ width: `${b.score}%` }} />
                          </div>
                          <p className="text-[9px] text-muted-foreground/70">{b.feedback}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Weight overview */}
              <div className="glass-card p-4 rounded-xl">
                <div className="flex items-center gap-2 mb-3">
                  <Star className="w-4 h-4 text-primary" />
                  <h3 className="text-xs font-semibold">Distribuição de Pesos</h3>
                </div>
                <div className="space-y-2">
                  {criteria.map(c => (
                    <div key={c.id} className="space-y-1">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-muted-foreground">{c.label}</span>
                        <span className="font-medium text-foreground">{c.weight}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${c.weight}%` }} />
                      </div>
                    </div>
                  ))}
                  <div className={cn('flex justify-between text-[10px] pt-1 border-t border-border mt-1', totalWeight === 100 ? 'text-success' : 'text-warning')}>
                    <span className="font-semibold">Total</span>
                    <span className="font-bold">{totalWeight}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {editingCriteria && (
            <CriteriaModal
              criteria={editingCriteria}
              maxWeight={remainingWeight + editingCriteria.weight}
              onClose={() => setEditingCriteria(null)}
              onSave={handleSaveCriteria}
            />
          )}

          {addingCriteria && (
            <CriteriaModal
              maxWeight={remainingWeight}
              onClose={() => setAddingCriteria(false)}
              onSave={handleSaveCriteria}
            />
          )}
        </>
      )}
    </div>
  );
}
