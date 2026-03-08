import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  SlidersHorizontal, Brain, Plus, X, Save, Sparkles,
  Video, MessageSquare, Trash2, GripVertical,
  CheckCircle2, Star, Target, AlertTriangle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface EvalCriteria {
  id: string;
  label: string;
  description: string;
  weight: number;
  examples: string[];
  positiveSignals: string[];
  negativeSignals: string[];
}

const DEFAULT_MEETING_CRITERIA: EvalCriteria[] = [
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

const DEFAULT_WHATSAPP_CRITERIA: EvalCriteria[] = [
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

export default function AIConfigPage() {
  const { toast } = useToast();
  const [activeType, setActiveType] = useState<'meetings' | 'whatsapp'>('meetings');
  const [meetingCriteria, setMeetingCriteria] = useState(DEFAULT_MEETING_CRITERIA);
  const [whatsappCriteria, setWhatsappCriteria] = useState(DEFAULT_WHATSAPP_CRITERIA);
  const [editingCriteria, setEditingCriteria] = useState<EvalCriteria | null>(null);
  const [addingCriteria, setAddingCriteria] = useState(false);
  const [meetingPrompt, setMeetingPrompt] = useState(
    'Você é um avaliador especialista em vendas consultivas. Analise a transcrição da reunião e avalie cada critério com base nos sinais identificados. Seja específico e construtivo nos feedbacks.'
  );
  const [whatsappPrompt, setWhatsappPrompt] = useState(
    'Você é um especialista em vendas digitais e atendimento via WhatsApp. Avalie as conversas com foco em efetividade comercial, qualificação de leads e conversão.'
  );

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

  const handleSaveConfig = () => {
    if (totalWeight !== 100) {
      toast({
        variant: 'destructive',
        title: 'Pesos inválidos',
        description: `Os pesos devem somar 100%. Atualmente somam ${totalWeight}%.`,
      });
      return;
    }
    toast({
      title: 'Configuração salva!',
      description: `Critérios de ${activeType === 'meetings' ? 'reuniões' : 'WhatsApp'} salvos com sucesso.`,
    });
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

          {remainingWeight <= 0 && totalWeight < 100 && (
            <p className="text-[10px] text-muted-foreground text-center">Todos os 100% foram distribuídos.</p>
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
              Este prompt define o comportamento base da IA ao avaliar {activeType === 'meetings' ? 'reuniões' : 'conversas de WhatsApp'}.
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
                { label: 'Modelo de IA', value: activeType === 'meetings' ? 'GPT-4o / Gemini Pro' : 'GPT-4o Mini' },
              ].map(p => (
                <div key={p.label} className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{p.label}</span>
                  <span className="text-xs font-semibold text-foreground">{p.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card p-4 rounded-xl">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-accent" />
              <h3 className="text-xs font-semibold">Testar Configuração</h3>
            </div>
            <p className="text-[10px] text-muted-foreground mb-3">
              Execute uma avaliação de teste com uma reunião/conversa existente para validar os critérios antes de salvar.
            </p>
            <Button size="sm" variant="outline" className="w-full text-xs border-border h-8">
              <Brain className="w-3.5 h-3.5 mr-1.5" /> Testar com Exemplo
            </Button>
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
          maxWeight={remainingWeight + editingCriteria.weight} // allow up to current + available
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
    </div>
  );
}
