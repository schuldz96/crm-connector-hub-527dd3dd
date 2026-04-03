import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Bot, X, Info, Plus, Trash2, ChevronDown, ChevronUp, GripVertical,
  FileText, Image, Music, Video, Save,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEvolutionInstances } from '@/hooks/useEvolutionInstances';

// ── Types ─────────────────────────────────────────────────────────────────────

interface FollowUpTrigger {
  id: string;
  type: 'time' | 'keyword' | 'no_response';
  value: number;
  unit: 'minutes' | 'hours' | 'days';
  keyword?: string;
}

interface FollowUpItem {
  id: string;
  triggers: FollowUpTrigger[];
  allowReinscription: boolean;
  contents: string[];
  expanded: boolean;
}

interface QuestionItem {
  id: string;
  question: string;
  description: string;
  required: boolean;
  propertyKey?: string;
}

export interface StageAIConfig {
  // IA tab
  aiName: string;
  provider: string;
  instance: string;
  active: boolean;
  // Prompt tab
  systemPrompt: string;
  autoComplement: string;
  welcomeEnabled: boolean;
  welcomeType: 'text' | 'image' | 'audio' | 'video';
  welcomeText: string;
  // Comportamento tab
  startMode: 'immediate' | 'on_move' | 'create_or_move' | 'wait_first';
  typingDelay: number;
  responseDelay: number;
  // Perguntas tab
  autoEvaluation: boolean;
  questions: QuestionItem[];
  // Follow-ups tab
  followUps: FollowUpItem[];
  // RAG tab
  ragEnabled: boolean;
  ragSource: string;
  ragMaxTurns: number;
  // Transições tab
  transitions: {
    stageId: string;
    trigger: 'welcome_sent' | 'lead_replied' | 'lead_replied_positive' | 'lead_replied_negative' | 'ai_decision' | 'no_response' | 'keyword' | 'questions_completed';
    config?: { timeout_hours?: number; keyword?: string; prompt?: string };
  }[];
}

const DEFAULT_CONFIG: StageAIConfig = {
  aiName: '',
  provider: 'evolution',
  instance: '',
  active: false,
  systemPrompt: '',
  autoComplement: `REGRAS DE COMUNICAÇÃO (OBRIGATÓRIAS):\n— Escreva como uma pessoa real no WhatsApp — natural, direto, sem formalidades excessivas\n— NUNCA use markdown: sem #, sem **, sem bullets com —, sem tabelas\n— Emojis são bem-vindos mas use com moderação\n— Fale em português brasileiro informal\n— Cada bloco de texto separado por linha em branco será enviado como mensagem`,
  welcomeEnabled: true,
  welcomeType: 'text',
  welcomeText: 'Olá {{first_name}}! 👋 Tudo bem? Vi que você se interessou pelo nosso programa.',
  startMode: 'immediate',
  typingDelay: 10,
  responseDelay: 10,
  autoEvaluation: true,
  questions: [],
  followUps: [],
  ragEnabled: false,
  ragSource: '',
  ragMaxTurns: 10,
  transitions: [],
};

const TABS = [
  { id: 'ia', label: 'IA' },
  { id: 'prompt', label: 'Prompt' },
  { id: 'behavior', label: 'Comportamento' },
  { id: 'questions', label: 'Perguntas' },
  { id: 'followups', label: 'Follow-ups' },
  { id: 'rag', label: 'RAG' },
  { id: 'transitions', label: 'Transições' },
];

const WELCOME_TYPES = [
  { id: 'text', label: 'Texto', icon: FileText },
  { id: 'image', label: 'Imagem', icon: Image },
  { id: 'audio', label: 'Áudio', icon: Music },
  { id: 'video', label: 'Vídeo', icon: Video },
] as const;

const TRIGGER_TYPES = [
  { value: 'time', label: 'X tempo após entrar na etapa' },
  { value: 'keyword', label: 'Palavra-chave recebida' },
  { value: 'no_response', label: 'Sem resposta do lead' },
];

// ── Component ─────────────────────────────────────────────────────────────────

// Object-specific variables
const OBJECT_VARIABLES: Record<string, { key: string; label: string }[]> = {
  deal: [
    { key: '{{deal_name}}', label: 'Nome do negócio' },
    { key: '{{deal_value}}', label: 'Valor' },
    { key: '{{deal_stage}}', label: 'Etapa' },
    { key: '{{deal_pipeline}}', label: 'Pipeline' },
    { key: '{{deal_close_date}}', label: 'Data de fechamento' },
    { key: '{{deal_owner}}', label: 'Proprietário' },
    { key: '{{deal_probability}}', label: 'Probabilidade' },
  ],
  ticket: [
    { key: '{{ticket_title}}', label: 'Título' },
    { key: '{{ticket_status}}', label: 'Status' },
    { key: '{{ticket_priority}}', label: 'Prioridade' },
    { key: '{{ticket_category}}', label: 'Categoria' },
    { key: '{{ticket_stage}}', label: 'Etapa' },
    { key: '{{ticket_pipeline}}', label: 'Pipeline' },
    { key: '{{ticket_owner}}', label: 'Proprietário' },
    { key: '{{ticket_sla}}', label: 'SLA (min)' },
  ],
};

const COMMON_VARIABLES = [
  { key: '{{name}}', label: 'Nome do contato' },
  { key: '{{first_name}}', label: 'Primeiro nome' },
  { key: '{{phone}}', label: 'Telefone' },
  { key: '{{email}}', label: 'E-mail' },
];

interface StageAIConfigModalProps {
  open: boolean;
  onClose: () => void;
  stageName: string;
  stageId: string;
  objectType?: 'deal' | 'ticket';
  allStages?: { id: string; name: string }[];
  initialConfig?: Partial<StageAIConfig>;
  onSave?: (stageId: string, config: StageAIConfig) => void;
}

export default function StageAIConfigModal({
  open, onClose, stageName, stageId, objectType = 'deal', allStages = [], initialConfig, onSave,
}: StageAIConfigModalProps) {
  const [activeTab, setActiveTab] = useState('ia');
  const [config, setConfig] = useState<StageAIConfig>({ ...DEFAULT_CONFIG, ...initialConfig });
  const { instances } = useEvolutionInstances();

  // Filter instances by provider
  const filteredInstances = config.provider === 'evolution'
    ? instances.filter(i => i.connectionStatus === 'open')
    : config.provider === 'meta'
    ? instances.filter(i => i.name?.toLowerCase().includes('meta') || i.name?.toLowerCase().includes('waba'))
    : instances;

  const update = <K extends keyof StageAIConfig>(key: K, value: StageAIConfig[K]) =>
    setConfig(prev => ({ ...prev, [key]: value }));

  const handleSave = () => {
    onSave?.(stageId, config);
    onClose();
  };

  const addQuestion = () => {
    update('questions', [...config.questions, { id: crypto.randomUUID(), question: '', description: '', required: false }]);
  };

  const removeQuestion = (id: string) => {
    update('questions', config.questions.filter(q => q.id !== id));
  };

  const updateQuestion = (id: string, field: 'question' | 'description', value: string) => {
    update('questions', config.questions.map(q => q.id === id ? { ...q, [field]: value } : q));
  };

  const addFollowUp = () => {
    update('followUps', [...config.followUps, {
      id: crypto.randomUUID(),
      triggers: [],
      allowReinscription: false,
      contents: [],
      expanded: true,
    }]);
  };

  const removeFollowUp = (id: string) => {
    update('followUps', config.followUps.filter(f => f.id !== id));
  };

  const toggleFollowUp = (id: string) => {
    update('followUps', config.followUps.map(f => f.id === id ? { ...f, expanded: !f.expanded } : f));
  };

  const addTrigger = (followUpId: string) => {
    update('followUps', config.followUps.map(f => f.id === followUpId ? {
      ...f,
      triggers: [...f.triggers, { id: crypto.randomUUID(), type: 'time' as const, value: 24, unit: 'hours' as const }],
    } : f));
  };

  const removeTrigger = (followUpId: string, triggerId: string) => {
    update('followUps', config.followUps.map(f => f.id === followUpId ? {
      ...f,
      triggers: f.triggers.filter(t => t.id !== triggerId),
    } : f));
  };

  const updateTrigger = (followUpId: string, triggerId: string, patch: Partial<FollowUpTrigger>) => {
    update('followUps', config.followUps.map(f => f.id === followUpId ? {
      ...f,
      triggers: f.triggers.map(t => t.id === triggerId ? { ...t, ...patch } : t),
    } : f));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-5 pb-0">
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            <Bot className="w-4 h-4 text-primary" />
            IA: {stageName}
          </DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="px-6 pt-4">
          <div className="flex items-center gap-0 border-b border-border">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'px-3 py-2 text-sm transition-colors border-b-2 -mb-px',
                  activeTab === tab.id
                    ? 'border-primary text-primary font-medium'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* ═══ IA Tab ═══ */}
          {activeTab === 'ia' && (
            <>
              {/* Info banner */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
                <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">Modelo padrão: GPT-4o mini</p>
                  <p className="text-xs text-muted-foreground">O token de IA é configurado em <strong>Configurações → Tokens</strong></p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Nome da IA</label>
                  <Input
                    value={config.aiName}
                    onChange={e => update('aiName', e.target.value)}
                    placeholder="Ex: Appmax Assistente"
                    className="h-10"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Provedor</label>
                  <Select value={config.provider} onValueChange={v => { update('provider', v); update('instance', ''); }}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="evolution">Evolution API</SelectItem>
                      <SelectItem value="meta">Meta WhatsApp (WABA)</SelectItem>
                      <SelectItem value="owner">Proprietário do registro</SelectItem>
                    </SelectContent>
                  </Select>
                  {config.provider === 'owner' && (
                    <p className="text-xs text-muted-foreground mt-1.5 p-2 rounded bg-muted/50">
                      A IA usará a instância vinculada ao proprietário do negócio/ticket. Se o proprietário não tiver instância, a IA não executará ação.
                    </p>
                  )}
                </div>

                {config.provider !== 'owner' && (
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1.5 block">Instância conectada</label>
                    <Select value={config.instance} onValueChange={v => update('instance', v)}>
                      <SelectTrigger className="h-10"><SelectValue placeholder="Selecione uma instância..." /></SelectTrigger>
                      <SelectContent>
                        {filteredInstances.length === 0 ? (
                          <SelectItem value="_none" disabled>Nenhuma instância disponível</SelectItem>
                        ) : (
                          filteredInstances.map(inst => (
                            <SelectItem key={inst.id || inst.name} value={inst.name}>
                              {inst.name} {inst.connectionStatus === 'open' ? '🟢' : inst.connectionStatus === 'connecting' ? '🟡' : '🔴'}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {config.instance && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Instância {config.provider === 'meta' ? 'Meta WABA' : 'Evolution API'} conectada
                      </p>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Switch checked={config.active} onCheckedChange={v => update('active', v)} />
                  <span className="text-sm font-medium text-foreground">Ativo</span>
                </div>
              </div>
            </>
          )}

          {/* ═══ Prompt Tab ═══ */}
          {activeTab === 'prompt' && (
            <>
              {/* Available variables */}
              <div className="rounded-lg border border-border/50 p-3 space-y-1.5">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Variáveis disponíveis (clique para copiar)</p>
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[10px] text-muted-foreground mr-0.5">Contato:</span>
                  {COMMON_VARIABLES.map(v => (
                    <Badge key={v.key} variant="outline" className="text-[10px] font-mono cursor-pointer hover:bg-muted"
                      onClick={() => { navigator.clipboard.writeText(v.key); }} title={v.label}>
                      {v.key}
                    </Badge>
                  ))}
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[10px] text-muted-foreground mr-0.5">{objectType === 'ticket' ? 'Ticket:' : 'Negócio:'}</span>
                  {(OBJECT_VARIABLES[objectType] || []).map(v => (
                    <Badge key={v.key} variant="outline" className="text-[10px] font-mono cursor-pointer hover:bg-primary/20 hover:text-primary"
                      onClick={() => { navigator.clipboard.writeText(v.key); }} title={v.label}>
                      {v.key}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-foreground mb-1.5 block">System Prompt</label>
                <Textarea
                  value={config.systemPrompt}
                  onChange={e => update('systemPrompt', e.target.value)}
                  placeholder="Descreva a persona e objetivo da IA..."
                  className="min-h-[120px] resize-y"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-foreground mb-1 block">Complemento automático</label>
                <p className="text-xs text-muted-foreground mb-2">
                  Adicionado automaticamente ao final do system prompt a cada mensagem. Por padrão contém as regras de formatação do WhatsApp (multi-mensagem, sem markdown, etc). Edite livremente.
                </p>
                <Textarea
                  value={config.autoComplement}
                  onChange={e => update('autoComplement', e.target.value)}
                  className="min-h-[120px] resize-y font-mono text-xs"
                />
                <button
                  onClick={() => update('autoComplement', DEFAULT_CONFIG.autoComplement)}
                  className="text-xs text-primary hover:underline mt-1"
                >
                  Restaurar padrão
                </button>
              </div>

              {/* Welcome message */}
              <div className="border border-border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">Mensagem de Boas-vindas</span>
                  <Switch checked={config.welcomeEnabled} onCheckedChange={v => update('welcomeEnabled', v)} />
                </div>

                {config.welcomeEnabled && (
                  <>
                    {config.provider === 'meta' ? (
                      /* Meta WABA: template-based welcome */
                      <div className="space-y-3">
                        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                          <Info className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-muted-foreground">Meta WABA exige que a primeira mensagem use um <strong>template aprovado</strong>. Configure o nome do template e os parâmetros.</p>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-foreground mb-1.5 block">Nome do Template</label>
                          <Input value={config.welcomeText.startsWith('template:') ? config.welcomeText.replace('template:', '') : ''} onChange={e => update('welcomeText', 'template:' + e.target.value)} placeholder="Ex: hello_world, welcome_lead" className="h-9 text-sm font-mono" />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-foreground mb-1.5 block">Variáveis do Template (uma por linha)</label>
                          <Textarea placeholder="{{1}} = Nome do contato&#10;{{2}} = Nome da empresa" className="min-h-[60px] resize-y text-xs font-mono" />
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Variáveis: {COMMON_VARIABLES.map(v => v.key).join(', ')}, {(OBJECT_VARIABLES[objectType] || []).map(v => v.key).join(', ')}
                          </p>
                        </div>
                      </div>
                    ) : (
                      /* Evolution / Owner: free-text welcome */
                      <>
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1 flex-wrap text-xs">
                            <span className="text-muted-foreground text-[10px] mr-1">Contato:</span>
                            {COMMON_VARIABLES.map(v => (
                              <Badge key={v.key} variant="outline" className="text-[10px] font-mono cursor-pointer hover:bg-muted"
                                onClick={() => update('welcomeText', config.welcomeText + ' ' + v.key)} title={v.label}>
                                {v.key}
                              </Badge>
                            ))}
                          </div>
                          <div className="flex items-center gap-1 flex-wrap text-xs">
                            <span className="text-muted-foreground text-[10px] mr-1">{objectType === 'ticket' ? 'Ticket:' : 'Negócio:'}</span>
                            {(OBJECT_VARIABLES[objectType] || []).map(v => (
                              <Badge key={v.key} variant="outline" className="text-[10px] font-mono cursor-pointer hover:bg-primary/20 hover:text-primary"
                                onClick={() => update('welcomeText', config.welcomeText + ' ' + v.key)} title={v.label}>
                                {v.key}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="text-xs font-medium text-foreground mb-1.5 block">Tipo</label>
                          <div className="grid grid-cols-4 gap-2">
                            {WELCOME_TYPES.map(t => (
                              <button key={t.id} onClick={() => update('welcomeType', t.id)}
                                className={cn('flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors',
                                  config.welcomeType === t.id ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted')}>
                                <t.icon className="w-3.5 h-3.5" /> {t.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="text-xs font-medium text-foreground mb-1.5 block">Texto</label>
                          <Textarea value={config.welcomeText} onChange={e => update('welcomeText', e.target.value)} className="min-h-[80px] resize-y" />
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            </>
          )}

          {/* ═══ Comportamento Tab ═══ */}
          {activeTab === 'behavior' && (
            <>
              <div>
                <label className="text-sm font-semibold text-foreground mb-2 block">Quando iniciar conversa</label>
                <div className="space-y-2">
                  {([
                    { value: 'immediate', label: 'Ao criar o registro (envia boas-vindas imediatamente)' },
                    { value: 'on_move', label: 'Ao mover para esta etapa (envia boas-vindas ao entrar)' },
                    { value: 'create_or_move', label: 'Ao criar ou mover para esta etapa' },
                    { value: 'wait_first', label: 'Aguardar 1ª mensagem do contato' },
                  ] as const).map(opt => (
                    <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="startMode"
                        checked={config.startMode === opt.value}
                        onChange={() => update('startMode', opt.value as any)}
                        className="accent-primary"
                      />
                      <span className="text-sm text-foreground">{opt.label}</span>
                    </label>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">
                  A IA só responde para {objectType === 'ticket' ? 'tickets' : 'negócios'} que estão neste pipeline. Registros fora do pipeline não recebem interação da IA.
                </p>
              </div>

              <div>
                <label className="text-sm font-semibold text-foreground mb-1 block">
                  Simulação de digitação: {config.typingDelay}s
                </label>
                <p className="text-xs text-muted-foreground mb-3">
                  Exibe "digitando..." no WhatsApp por esse tempo antes de enviar
                </p>
                <Slider
                  value={[config.typingDelay]}
                  onValueChange={([v]) => update('typingDelay', v)}
                  min={0}
                  max={60}
                  step={1}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground mt-1">0s a 60s</p>
              </div>

              <div>
                <label className="text-sm font-semibold text-foreground mb-1 block">
                  Delay de resposta: {config.responseDelay}s
                </label>
                <p className="text-xs text-muted-foreground mb-3">
                  Tempo máximo do recebimento até enviar a resposta (padrão 10s)
                </p>
                <Slider
                  value={[config.responseDelay]}
                  onValueChange={([v]) => update('responseDelay', v)}
                  min={0}
                  max={120}
                  step={1}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground mt-1">0s a 2 minutos</p>
              </div>
            </>
          )}

          {/* ═══ Perguntas Tab ═══ */}
          {activeTab === 'questions' && (
            <>
              {/* Auto-evaluation toggle */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20">
                <div className="flex items-start gap-3">
                  <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Avaliação Automática</p>
                    <p className="text-xs text-muted-foreground">A IA avalia cada mensagem e marca perguntas como concluídas</p>
                  </div>
                </div>
                <Switch checked={config.autoEvaluation} onCheckedChange={v => update('autoEvaluation', v)} />
              </div>

              <div className="space-y-3">
                {config.questions.map((q, idx) => (
                  <div key={q.id} className="border border-border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40" />
                        <span className="text-xs font-semibold text-muted-foreground">Pergunta {idx + 1}</span>
                        <Badge variant={q.required ? 'default' : 'outline'} className={cn('text-[10px] cursor-pointer', q.required ? 'bg-destructive/80' : '')}
                          onClick={() => update('questions', config.questions.map(item => item.id === q.id ? { ...item, required: !item.required } : item))}>
                          {q.required ? 'Obrigatória' : 'Opcional'}
                        </Badge>
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeQuestion(q.id)}>
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </Button>
                    </div>
                    <Input value={q.question} onChange={e => updateQuestion(q.id, 'question', e.target.value)} placeholder="Ex: Qual é o faturamento mensal da sua empresa?" className="h-9 text-sm" />
                    <Input value={q.description} onChange={e => updateQuestion(q.id, 'description', e.target.value)} placeholder="Descrição / critério de avaliação (opcional)" className="h-8 text-xs" />
                    <div>
                      <label className="text-[10px] text-muted-foreground">Salvar resposta na propriedade:</label>
                      <Input value={q.propertyKey || ''} onChange={e => update('questions', config.questions.map(item => item.id === q.id ? { ...item, propertyKey: e.target.value } : item))} placeholder="Ex: faturamento_mensal" className="h-7 text-xs font-mono mt-0.5" />
                    </div>
                  </div>
                ))}

                <Button variant="outline" onClick={() => update('questions', [...config.questions, { id: crypto.randomUUID(), question: '', description: '', required: true }])} className="w-full">
                  <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar pergunta
                </Button>
              </div>
            </>
          )}

          {/* ═══ Follow-ups Tab ═══ */}
          {activeTab === 'followups' && (
            <>
              {/* Info banner */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
                <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">Follow-ups com Gatilhos Avançados</p>
                  <p className="text-xs text-muted-foreground">Configure acionadores por tempo, mensagem ou palavras-chave com suporte a reinscrição</p>
                </div>
              </div>

              <Button onClick={addFollowUp} className="w-full gap-1.5">
                <Plus className="w-4 h-4" /> Adicionar Follow-up
              </Button>

              {config.followUps.map((fu, idx) => (
                <div key={fu.id} className="border border-border rounded-lg overflow-hidden">
                  {/* Follow-up header */}
                  <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
                    <div className="flex items-center gap-2">
                      <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
                      <span className="text-sm font-medium text-foreground">Follow-up {idx + 1}</span>
                      <span className="text-xs text-muted-foreground">
                        {fu.triggers.length} gatilho(s) · {fu.contents.length} conteúdo(s)
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleFollowUp(fu.id)}>
                        {fu.expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeFollowUp(fu.id)}>
                        <Trash2 className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>

                  {fu.expanded && (
                    <div className="p-4 space-y-4">
                      {/* Triggers */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-foreground">Gatilhos</span>
                          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => addTrigger(fu.id)}>
                            <Plus className="w-3 h-3" /> Adicionar Gatilho
                          </Button>
                        </div>

                        {fu.triggers.length === 0 && (
                          <p className="text-xs text-muted-foreground italic">Nenhum gatilho configurado</p>
                        )}

                        {fu.triggers.map(trigger => (
                          <div key={trigger.id} className="border border-border rounded-lg p-3 space-y-2 mb-2">
                            <div className="flex items-center gap-2">
                              <Select
                                value={trigger.type}
                                onValueChange={v => updateTrigger(fu.id, trigger.id, { type: v as FollowUpTrigger['type'] })}
                              >
                                <SelectTrigger className="h-8 flex-1"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {TRIGGER_TYPES.map(tt => (
                                    <SelectItem key={tt.value} value={tt.value}>{tt.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeTrigger(fu.id, trigger.id)}>
                                <X className="w-3.5 h-3.5" />
                              </Button>
                            </div>

                            {trigger.type === 'time' && (
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  value={trigger.value}
                                  onChange={e => updateTrigger(fu.id, trigger.id, { value: Number(e.target.value) })}
                                  className="h-8 w-24"
                                />
                                <Select
                                  value={trigger.unit}
                                  onValueChange={v => updateTrigger(fu.id, trigger.id, { unit: v as FollowUpTrigger['unit'] })}
                                >
                                  <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="minutes">Minutos</SelectItem>
                                    <SelectItem value="hours">Horas</SelectItem>
                                    <SelectItem value="days">Dias</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            )}

                            {trigger.type === 'keyword' && (
                              <Input
                                value={trigger.keyword || ''}
                                onChange={e => updateTrigger(fu.id, trigger.id, { keyword: e.target.value })}
                                placeholder="Palavra-chave..."
                                className="h-8"
                              />
                            )}

                            {trigger.type === 'no_response' && (
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  value={trigger.value}
                                  onChange={e => updateTrigger(fu.id, trigger.id, { value: Number(e.target.value) })}
                                  className="h-8 w-24"
                                />
                                <Select
                                  value={trigger.unit}
                                  onValueChange={v => updateTrigger(fu.id, trigger.id, { unit: v as FollowUpTrigger['unit'] })}
                                >
                                  <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="minutes">Minutos</SelectItem>
                                    <SelectItem value="hours">Horas</SelectItem>
                                    <SelectItem value="days">Dias</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Reinscription */}
                      <div className="border-t border-border pt-3">
                        <span className="text-sm font-semibold text-foreground block mb-2">Reinscrição</span>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={fu.allowReinscription}
                            onChange={e => update('followUps', config.followUps.map(f =>
                              f.id === fu.id ? { ...f, allowReinscription: e.target.checked } : f
                            ))}
                            className="rounded accent-primary"
                          />
                          <span className="text-sm text-foreground">Permitir reinscrição (pode ser reenviado)</span>
                        </label>
                      </div>

                      {/* Content placeholder */}
                      <div className="border border-dashed border-border rounded-lg p-4 text-center">
                        <button className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mx-auto">
                          <Plus className="w-3.5 h-3.5" /> Adicionar Conteúdo
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}

          {/* ═══ RAG Tab ═══ */}
          {activeTab === 'rag' && (
            <>
              {/* Checkbox styled like reference */}
              <div
                className={cn(
                  'flex items-center gap-3 p-4 rounded-lg border transition-colors cursor-pointer',
                  config.ragEnabled
                    ? 'bg-emerald-500/15 border-emerald-500/30'
                    : 'bg-muted/30 border-border'
                )}
                onClick={() => update('ragEnabled', !config.ragEnabled)}
              >
                <input
                  type="checkbox"
                  checked={config.ragEnabled}
                  onChange={e => update('ragEnabled', e.target.checked)}
                  className="w-5 h-5 rounded accent-primary"
                />
                <span className={cn(
                  'text-sm font-medium',
                  config.ragEnabled ? 'text-primary' : 'text-muted-foreground'
                )}>
                  Habilitar base de conhecimento RAG
                </span>
              </div>

              {config.ragEnabled && (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-semibold text-foreground mb-1.5 block">Base de Conhecimento RAG</label>
                    <Select value={config.ragSource} onValueChange={v => update('ragSource', v)}>
                      <SelectTrigger className="h-10"><SelectValue placeholder="Selecione uma base..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="historico-appmax">Histórico Appmax (31577 chunks)</SelectItem>
                        <SelectItem value="docs-produto">Docs Produto (8420 chunks)</SelectItem>
                        <SelectItem value="faq-suporte">FAQ Suporte (2150 chunks)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-foreground mb-1.5 block">Máximo de Turnos</label>
                    <Input
                      type="number"
                      value={config.ragMaxTurns}
                      onChange={e => update('ragMaxTurns', Number(e.target.value))}
                      className="h-10"
                      min={1}
                      max={50}
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {/* ═══ Transições Tab ═══ */}
          {activeTab === 'transitions' && (() => {
            const TRIGGER_OPTIONS = [
              { value: 'welcome_sent', label: 'Boas-vindas enviada', desc: 'Move quando a mensagem de boas-vindas for enviada com sucesso' },
              { value: 'lead_replied', label: 'Lead respondeu', desc: 'Move quando o lead envia qualquer resposta' },
              { value: 'lead_replied_positive', label: 'Resposta positiva', desc: 'IA avalia a resposta e move se for positiva (interesse, aceite, confirmação)' },
              { value: 'lead_replied_negative', label: 'Resposta negativa', desc: 'IA avalia a resposta e move se for negativa (rejeição, desinteresse)' },
              { value: 'ai_decision', label: 'Decisão da IA (prompt)', desc: 'IA decide com base num prompt customizado que você define' },
              { value: 'no_response', label: 'Sem resposta', desc: 'Move após X horas sem resposta do lead' },
              { value: 'keyword', label: 'Palavra-chave', desc: 'Move quando o lead responde com uma palavra-chave específica' },
              { value: 'questions_completed', label: 'Perguntas respondidas', desc: 'Move quando todas as perguntas da aba Perguntas forem respondidas' },
            ];

            const updateTransition = (idx: number, patch: Record<string, unknown>) => {
              const updated = [...config.transitions];
              updated[idx] = { ...updated[idx], ...patch } as any;
              update('transitions', updated);
            };

            return (
            <>
              <p className="text-sm text-muted-foreground">
                Configure quando o lead deve ser movido automaticamente para outra etapa. Cada regra define um gatilho e a etapa de destino.
              </p>

              {config.transitions.length > 0 && (
                <div className="space-y-3">
                  {config.transitions.map((t, idx) => {
                    const triggerInfo = TRIGGER_OPTIONS.find(o => o.value === t.trigger);
                    return (
                    <div key={idx} className="border border-border rounded-lg p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted-foreground">Transição {idx + 1}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                          update('transitions', config.transitions.filter((_, i) => i !== idx));
                        }}>
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                      </div>

                      {/* Trigger type */}
                      <div>
                        <label className="text-xs font-medium text-foreground mb-1 block">Quando</label>
                        <select
                          value={t.trigger || ''}
                          onChange={e => updateTransition(idx, { trigger: e.target.value, config: {} })}
                          className="w-full h-8 text-xs bg-background border border-border rounded-md px-2"
                        >
                          <option value="">Selecione o gatilho...</option>
                          {TRIGGER_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                        {triggerInfo && (
                          <p className="text-[10px] text-muted-foreground mt-1">{triggerInfo.desc}</p>
                        )}
                      </div>

                      {/* Trigger-specific config */}
                      {t.trigger === 'no_response' && (
                        <div>
                          <label className="text-xs font-medium text-foreground mb-1 block">Após quantas horas sem resposta?</label>
                          <Input
                            type="number"
                            value={t.config?.timeout_hours || 24}
                            onChange={e => updateTransition(idx, { config: { ...t.config, timeout_hours: parseInt(e.target.value) || 24 } })}
                            className="h-8 text-xs w-32"
                            min={1}
                          />
                        </div>
                      )}

                      {t.trigger === 'keyword' && (
                        <div>
                          <label className="text-xs font-medium text-foreground mb-1 block">Palavra-chave (case insensitive)</label>
                          <Input
                            value={t.config?.keyword || ''}
                            onChange={e => updateTransition(idx, { config: { ...t.config, keyword: e.target.value } })}
                            placeholder="Ex: sim, quero, confirmo"
                            className="h-8 text-xs"
                          />
                          <p className="text-[10px] text-muted-foreground mt-1">Separe múltiplas palavras com vírgula. Qualquer uma dispara.</p>
                        </div>
                      )}

                      {t.trigger === 'ai_decision' && (
                        <div>
                          <label className="text-xs font-medium text-foreground mb-1 block">Prompt de decisão</label>
                          <Textarea
                            value={t.config?.prompt || ''}
                            onChange={e => updateTransition(idx, { config: { ...t.config, prompt: e.target.value } })}
                            placeholder="Analise a conversa e responda apenas SIM ou NÃO: o lead está pronto para avançar?"
                            className="min-h-[80px] resize-y text-xs"
                          />
                          <p className="text-[10px] text-muted-foreground mt-1">A IA receberá a conversa completa + este prompt. Deve responder SIM para mover.</p>
                        </div>
                      )}

                      {/* Destination stage */}
                      <div>
                        <label className="text-xs font-medium text-foreground mb-1 block">Mover para</label>
                        <select
                          value={t.stageId || ''}
                          onChange={e => updateTransition(idx, { stageId: e.target.value })}
                          className="w-full h-8 text-xs bg-background border border-border rounded-md px-2"
                        >
                          <option value="">Selecione a etapa...</option>
                          {allStages.filter(s => s.id !== stageId).map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}

              <button
                onClick={() => update('transitions', [...config.transitions, { stageId: '', trigger: 'lead_replied' as any, config: {} }])}
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar transição
              </button>
            </>
            );
          })()}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border space-y-2 flex-shrink-0">
          <Button
            variant="outline"
            className="w-full border-destructive/30 text-destructive hover:bg-destructive/10"
            onClick={() => {
              setConfig(DEFAULT_CONFIG);
            }}
          >
            Remover IA desta etapa
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button className="flex-1 gap-1.5" onClick={handleSave}>
              <Save className="w-4 h-4" /> Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
