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
  startMode: 'immediate' | 'wait_first';
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
  transitions: { stageId: string; condition: string; trigger: string }[];
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

interface StageAIConfigModalProps {
  open: boolean;
  onClose: () => void;
  stageName: string;
  stageId: string;
  allStages?: { id: string; name: string }[];
  initialConfig?: Partial<StageAIConfig>;
  onSave?: (stageId: string, config: StageAIConfig) => void;
}

export default function StageAIConfigModal({
  open, onClose, stageName, stageId, allStages = [], initialConfig, onSave,
}: StageAIConfigModalProps) {
  const [activeTab, setActiveTab] = useState('ia');
  const [config, setConfig] = useState<StageAIConfig>({ ...DEFAULT_CONFIG, ...initialConfig });

  const update = <K extends keyof StageAIConfig>(key: K, value: StageAIConfig[K]) =>
    setConfig(prev => ({ ...prev, [key]: value }));

  const handleSave = () => {
    onSave?.(stageId, config);
    onClose();
  };

  const addQuestion = () => {
    update('questions', [...config.questions, { id: crypto.randomUUID(), question: '', description: '' }]);
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
                    placeholder="Ex: Marco Rebucci"
                    className="h-10"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Provedor</label>
                  <Select value={config.provider} onValueChange={v => update('provider', v)}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="evolution">Evolution API</SelectItem>
                      <SelectItem value="meta">Meta WhatsApp</SelectItem>
                      <SelectItem value="openai">OpenAI Direct</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Instância conectada</label>
                  <Select value={config.instance} onValueChange={v => update('instance', v)}>
                    <SelectTrigger className="h-10"><SelectValue placeholder="Selecione uma instância..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="instance-1">MarcoR 🟢</SelectItem>
                      <SelectItem value="instance-2">SupportBot 🟢</SelectItem>
                      <SelectItem value="instance-3">SalesAI 🔴</SelectItem>
                    </SelectContent>
                  </Select>
                  {config.instance && (
                    <p className="text-xs text-muted-foreground mt-1">Instância da Evolution API conectada</p>
                  )}
                </div>

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
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Use variáveis:</span>
                      {['{{name}}', '{{first_name}}', '{{phone}}'].map(v => (
                        <Badge key={v} variant="outline" className="text-[10px] font-mono cursor-pointer hover:bg-muted"
                          onClick={() => update('welcomeText', config.welcomeText + ' ' + v)}>
                          {v}
                        </Badge>
                      ))}
                    </div>

                    <div>
                      <label className="text-xs font-medium text-foreground mb-1.5 block">Tipo</label>
                      <div className="grid grid-cols-4 gap-2">
                        {WELCOME_TYPES.map(t => (
                          <button
                            key={t.id}
                            onClick={() => update('welcomeType', t.id)}
                            className={cn(
                              'flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors',
                              config.welcomeType === t.id
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                            )}
                          >
                            <t.icon className="w-3.5 h-3.5" /> {t.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-foreground mb-1.5 block">Texto</label>
                      <Textarea
                        value={config.welcomeText}
                        onChange={e => update('welcomeText', e.target.value)}
                        className="min-h-[80px] resize-y"
                      />
                    </div>
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
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="startMode"
                      checked={config.startMode === 'immediate'}
                      onChange={() => update('startMode', 'immediate')}
                      className="accent-primary"
                    />
                    <span className="text-sm text-foreground">Ao criar o registro (envia boas-vindas imediatamente)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="startMode"
                      checked={config.startMode === 'wait_first'}
                      onChange={() => update('startMode', 'wait_first')}
                      className="accent-primary"
                    />
                    <span className="text-sm text-foreground">Aguardar 1ª mensagem do contato</span>
                  </label>
                </div>
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
              {/* Info banner */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
                <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">Avaliação Automática Ativada</p>
                  <p className="text-xs text-muted-foreground">A IA avaliará cada mensagem e marcará perguntas como concluídas automaticamente</p>
                </div>
              </div>

              <div className="border border-border rounded-lg p-4 space-y-3">
                {config.questions.map((q, idx) => (
                  <div key={q.id} className="space-y-2 pb-3 border-b border-border last:border-0 last:pb-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground">Pergunta {idx + 1}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeQuestion(q.id)}>
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </Button>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-foreground mb-1 block">Pergunta</label>
                      <Input
                        value={q.question}
                        onChange={e => updateQuestion(q.id, 'question', e.target.value)}
                        placeholder="Digite uma nova pergunta..."
                        className="h-9"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-foreground mb-1 block">Descrição (opcional)</label>
                      <Input
                        value={q.description}
                        onChange={e => updateQuestion(q.id, 'description', e.target.value)}
                        placeholder="Ex: Ajuda a IA a entender melhor..."
                        className="h-9"
                      />
                    </div>
                  </div>
                ))}

                <button onClick={addQuestion} className="text-sm text-primary hover:underline flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" /> Adicionar
                </button>
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
                        <SelectItem value="historico-marcor">Histórico MarcoR (31577 chunks)</SelectItem>
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
          {activeTab === 'transitions' && (
            <>
              <p className="text-sm text-muted-foreground">
                Configure quando o lead deve ser movido automaticamente para outra etapa. Cada regra define um gatilho e a etapa de destino.
              </p>

              {config.transitions.length > 0 && (
                <div className="space-y-3">
                  {config.transitions.map((t, idx) => (
                    <div key={idx} className="border border-border rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted-foreground">Transição {idx + 1}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                          update('transitions', config.transitions.filter((_, i) => i !== idx));
                        }}>
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-foreground mb-1 block">Gatilho</label>
                        <Input
                          value={t.trigger}
                          onChange={e => {
                            const updated = [...config.transitions];
                            updated[idx] = { ...updated[idx], trigger: e.target.value };
                            update('transitions', updated);
                          }}
                          placeholder="Ex: lead respondeu positivamente"
                          className="h-8 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-foreground mb-1 block">Etapa de destino</label>
                        <Select
                          value={t.stageId}
                          onValueChange={v => {
                            const updated = [...config.transitions];
                            updated[idx] = { ...updated[idx], stageId: v };
                            update('transitions', updated);
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                          <SelectContent>
                            {allStages.filter(s => s.id !== stageId).map(s => (
                              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={() => update('transitions', [...config.transitions, { stageId: '', condition: '', trigger: '' }])}
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar transição
              </button>
            </>
          )}
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
