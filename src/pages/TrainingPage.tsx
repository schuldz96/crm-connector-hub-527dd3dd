import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAppConfig } from '@/contexts/AppConfigContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Plus, Brain, Trophy, Clock, Target,
  X, Play, Sparkles, CheckCircle2,
  BookOpen, BarChart3, Mic, MicOff, Volume2, VolumeX,
  Key, Eye, EyeOff, PhoneOff, Phone,
  Loader2, Waves, MessageSquare, ListChecks, ChevronDown, ChevronUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

// ─── Types ───────────────────────────────────────────────────────────────────
interface TrainingScenario {
  id: string;
  title: string;
  description: string;
  focusPoints: string[];
  avoidPoints: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  persona: string;
  script: ScriptStep[];
  createdBy: string;
  createdAt: string;
}

interface ScriptStep {
  phase: string;
  duration: string;
  goal: string;
  tips: string[];
}

interface TrainingSession {
  id: string;
  scenarioId: string;
  scenarioTitle: string;
  userId: string;
  userName: string;
  score: number;
  duration: number;
  completedAt: string;
  feedback: string;
}

interface VoiceMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

// ─── Scripts por cenário ──────────────────────────────────────────────────────
const SCRIPTS: Record<string, ScriptStep[]> = {
  sc_001: [
    {
      phase: '1. Abertura',
      duration: '0–3 min',
      goal: 'Criar rapport e contextualizar a ligação',
      tips: [
        'Se apresente: nome, empresa e motivo do contato',
        'Pergunte se tem 5 minutinhos disponíveis',
        '"Tô ligando porque vi que você usa processadora de pagamentos e queria entender um pouco da sua operação"',
      ],
    },
    {
      phase: '2. Levantamento de Dados',
      duration: '3–12 min',
      goal: 'Coletar informações da operação antes de qualquer proposta',
      tips: [
        'Volume mensal processado (TPV)',
        'Ticket médio e principais bandeiras (Visa, Master, Amex)',
        'Taxa de aprovação atual e chargeback',
        'Plataforma de e-commerce usada',
        '"Qual taxa você paga hoje no crédito à vista?"',
      ],
    },
    {
      phase: '3. Apresentação de Valor',
      duration: '12–22 min',
      goal: 'Mostrar diferencial além da taxa',
      tips: [
        'Citar aprovação acima da média do mercado (Appmax ~87% vs ~80%)',
        'Recuperação automática de carrinho abandonado',
        'Retentativa inteligente de pagamento',
        'Antifraude por IA + análise humana',
        '"Além de taxa, o que mais te preocupa na operação?"',
      ],
    },
    {
      phase: '4. Negociação e Fechamento',
      duration: '22–30 min',
      goal: 'Propor revisão com base nos números levantados',
      tips: [
        'Só negocie taxa depois de conhecer o volume',
        'Ancoragem: "Com esse volume, consigo levar uma proposta personalizada"',
        'Propor próximo passo: demo, proposta ou trial',
        '"Posso te mandar uma proposta ainda hoje com base nesse volume?"',
      ],
    },
  ],
  sc_002: [
    {
      phase: '1. Abertura Fria',
      duration: '0–3 min',
      goal: 'Despertar curiosidade sem parecer spam',
      tips: [
        'Seja direto: "Você tem 3 minutinhos? Tenho um dado interessante sobre aprovação de pagamentos."',
        'Não fale de preço na abertura',
        'Personalize: mencione a plataforma ou nicho dela',
      ],
    },
    {
      phase: '2. Qualificação',
      duration: '3–10 min',
      goal: 'Entender a operação e identificar a dor',
      tips: [
        'Volume mensal e tipo de produto (curso, mentoria, assinatura)',
        'Taxa de aprovação atual — "De cada 10 vendas, quantas aprovam?"',
        'Tem carrinho abandonado? Retentativa automática?',
        'Plataforma atual: Hotmart, Kiwify, Eduzz?',
      ],
    },
    {
      phase: '3. Despertar a Dor',
      duration: '10–18 min',
      goal: 'Fazer o cliente perceber o que está perdendo',
      tips: [
        '"Se você aprova 75% e a gente aprova 87%, são X vendas a mais por mês"',
        'Falar de recuperação de carrinho: média de 15–20% de recuperação',
        '"Você já tentou entrar em contato com quem abandonou o checkout?"',
      ],
    },
    {
      phase: '4. Próximo Passo',
      duration: '18–30 min',
      goal: 'Converter curiosidade em reunião ou demo',
      tips: [
        'Proponha uma demo de 20 minutos',
        '"Posso te mostrar quanto você estaria ganhando a mais com nossa aprovação"',
        'Ou ofereça trial de 30 dias com integração gratuita',
      ],
    },
  ],
  sc_003: [
    {
      phase: '1. Boas-vindas e Escuta',
      duration: '0–5 min',
      goal: 'Entender as dúvidas e deixar o cliente à vontade',
      tips: [
        '"Seja bem-vindo! Você acabou de ativar a conta, certo? Quais são suas principais dúvidas?"',
        'Escute sem interromper',
        'Anote as dúvidas antes de responder',
      ],
    },
    {
      phase: '2. Integração',
      duration: '5–15 min',
      goal: 'Explicar as opções de forma simples',
      tips: [
        'Plugin nativo (Shopify, WooCommerce): mais fácil, sem código',
        'API: para quem tem time técnico',
        'Link de pagamento: solução rápida enquanto integra',
        '"Qual plataforma você usa? Temos plugin nativo pra essa."',
      ],
    },
    {
      phase: '3. Financeiro e Saques',
      duration: '15–22 min',
      goal: 'Clareza sobre prazos e regras',
      tips: [
        'PIX: liquidação instantânea (D+0)',
        'Crédito: D+2 após confirmação',
        'Boleto: D+2 após compensação bancária',
        '"Você pode acompanhar tudo em tempo real no dashboard."',
      ],
    },
    {
      phase: '4. Garantia e Suporte',
      duration: '22–30 min',
      goal: 'Transmitir segurança e eliminar medos',
      tips: [
        'Appmax é autorizada pelo Banco Central',
        'Suporte técnico disponível por chat e e-mail',
        'Ofereça agendar uma sessão de setup junto',
        '"Se travar em qualquer etapa da integração, é só me chamar."',
      ],
    },
  ],
  sc_004: [
    {
      phase: '1. Escuta Ativa',
      duration: '0–5 min',
      goal: 'Deixar o cliente falar e validar a frustração',
      tips: [
        'Não se defenda na abertura',
        '"Entendo sua insatisfação. Me conta o que aconteceu com mais detalhes."',
        'Repita o que ele disse para mostrar que ouviu',
      ],
    },
    {
      phase: '2. Diagnóstico',
      duration: '5–15 min',
      goal: 'Descobrir a causa raiz da queda de aprovação',
      tips: [
        'Quando começou a queda?',
        'Mudou algo: produto, plataforma, público, volume?',
        'Qual % de reprovação é fraude vs insuficiência de limite?',
        '"Você tem acesso ao dashboard de aprovação por bandeira?"',
      ],
    },
    {
      phase: '3. Apresentação de Solução',
      duration: '15–22 min',
      goal: 'Propor ações concretas, não promessas vagas',
      tips: [
        'Revisão de regras do antifraude (pode estar muito rígido)',
        'Ajuste no checkout: order bump, PIX como primeiro método',
        'Mostrar que aprovação média da Appmax é 87%',
        'Oferecer acompanhamento semanal por 30 dias',
      ],
    },
    {
      phase: '4. Retenção',
      duration: '22–30 min',
      goal: 'Reverter o cancelamento com compromisso',
      tips: [
        '"Antes de você decidir, me dá 30 dias pra resolver isso juntos?"',
        'Não ofereça desconto de taxa como primeira solução',
        'Proponha uma call de revisão técnica com o time de performance',
        '"A Cielo não tem recuperação de vendas nem checkout próprio."',
      ],
    },
  ],
};

// ─── Mock data — Appmax ────────────────────────────────────────────────────────
const MOCK_SCENARIOS: TrainingScenario[] = [
  {
    id: 'sc_001',
    title: 'Negociação de Taxas — Ecommerce Médio',
    description: 'Dono de e-commerce está insatisfeito com as taxas atuais e ameaça migrar para a concorrência. Seu objetivo é coletar dados da operação, entender o volume e propor uma revisão de taxas que faça sentido para a Appmax.',
    focusPoints: [
      'Levantar volume mensal de transações (TPV)',
      'Entender ticket médio e mix de bandeiras',
      'Apresentar benefícios do ecossistema Appmax (antifraude, recuperação, checkout)',
      'Propor revisão de taxa com base nos números reais',
      'Citar aprovação acima da média do mercado como diferencial',
    ],
    avoidPoints: [
      'Ceder desconto sem entender o volume do cliente',
      'Não perguntar sobre chargeback e aprovação atual',
      'Falar só de taxa sem apresentar valor agregado',
      'Prometer condições que precisam de aprovação sem alinhar internamente',
      'Ignorar a dor de perda de vendas por reprovação',
    ],
    script: SCRIPTS.sc_001,
    difficulty: 'hard',
    persona: 'Ricardo, dono de e-commerce de moda feminina. Fatura R$180k/mês, ticket médio de R$220. Está com taxa de 3,2% no crédito e ouviu que um concorrente oferece 2,8%. É direto, fala rápido e quer números concretos.',
    createdBy: 'Appmax Training',
    createdAt: '2026-02-10',
  },
  {
    id: 'sc_002',
    title: 'Prospecção — Lead Frio (Infoproduto)',
    description: 'Você está ligando para um produtor digital que nunca ouviu falar da Appmax. Ele usa uma plataforma concorrente há 2 anos. Seu objetivo é qualificar a operação, identificar dores (aprovação baixa, sem recuperação de vendas) e gerar interesse em uma demo.',
    focusPoints: [
      'Apresentar a Appmax como fintech focada em conversão, não apenas gateway',
      'Fazer perguntas sobre taxa de aprovação atual',
      'Introduzir recuperação de carrinho e retentativa automática',
      'Perguntar sobre volume e tipo de produto (curso, mentoria, assinatura)',
      'Propor próximo passo concreto: demo ou envio de proposta',
    ],
    avoidPoints: [
      'Entrar em detalhes técnicos de integração antes de qualificar',
      'Falar de preço antes de entender a operação',
      'Assumir que o cliente quer migrar — primeiro entender a dor',
      'Gastar mais de 2 minutos sem fazer uma pergunta aberta',
      'Prometer funcionalidades sem confirmar se existem para o caso dele',
    ],
    script: SCRIPTS.sc_002,
    difficulty: 'medium',
    persona: 'Fernanda, criadora de cursos online de nutrição. Vende entre R$40k e R$60k/mês, usa plataforma de infoproduto concorrente. Não está insatisfeita, mas se ouvir que perde vendas pode abrir espaço. É educada mas ocupada.',
    createdBy: 'Appmax Training',
    createdAt: '2026-02-15',
  },
  {
    id: 'sc_003',
    title: 'Onboarding — Dúvidas de Integração e Saque',
    description: 'Cliente recém-ativado está com dúvidas sobre como integrar a Appmax na loja e sobre as regras de saque. Seu objetivo é transmitir segurança, explicar o processo claramente e garantir que ele siga em frente sem abandonar o onboarding.',
    focusPoints: [
      'Explicar opções de integração: plugin nativo, API, link de pagamento',
      'Esclarecer o prazo de saque (D+2 no crédito, instantâneo no PIX)',
      'Citar suporte e equipe técnica disponível para ajudar na integração',
      'Mencionar o dashboard e relatórios de aprovação em tempo real',
      'Reforçar que a Appmax é autorizada pelo Banco Central — transmitir confiança',
    ],
    avoidPoints: [
      'Usar termos técnicos sem explicar (webhook, payload, OAuth)',
      'Dar informações imprecisas sobre prazo de saque',
      'Apressar o cliente para "ativar rápido" sem entender suas dúvidas',
      'Não oferecer suporte técnico ou materiais de apoio',
      'Ignorar perguntas sobre segurança e conformidade',
    ],
    script: SCRIPTS.sc_003,
    difficulty: 'easy',
    persona: 'Carlos, dono de loja virtual de suplementos, 42 anos, não é técnico. Acabou de assinar com a Appmax mas está inseguro. Preocupado com "e se der erro na integração?" e "quando vou receber meu dinheiro?". Precisa de clareza e paciência.',
    createdBy: 'Appmax Training',
    createdAt: '2026-03-01',
  },
  {
    id: 'sc_004',
    title: 'Retenção — Cliente Ameaçando Cancelar',
    description: 'Cliente ativo há 8 meses está insatisfeito com a taxa de aprovação e quer cancelar a conta. Você deve investigar a causa raiz, apresentar soluções e reverter o cancelamento.',
    focusPoints: [
      'Escutar e validar a frustração do cliente antes de apresentar solução',
      'Investigar a causa da reprovação: tipo de produto, perfil do comprador, bandeiras',
      'Propor revisão no antifraude ou ajuste no checkout',
      'Apresentar dados: aprovação média da Appmax vs mercado',
      'Oferecer acompanhamento próximo por 30 dias',
    ],
    avoidPoints: [
      'Entrar na defensiva ou justificar o problema',
      'Oferecer desconto de taxa como primeira solução',
      'Prometer melhora sem entender a causa raiz',
      'Deixar o cliente falar sem fazer perguntas de diagnóstico',
      'Ameaçar com multa contratual de cancelamento',
    ],
    script: SCRIPTS.sc_004,
    difficulty: 'hard',
    persona: 'Alexandre, e-commerce de eletrônicos, fatura R$300k/mês. Taxa de aprovação caiu de 82% para 71% nos últimos 2 meses. Está irritado, já pesquisou concorrentes e tem uma reunião com a Cielo amanhã. Quer solução ou vai embora.',
    createdBy: 'Appmax Training',
    createdAt: '2026-03-05',
  },
];

const MOCK_SESSIONS: TrainingSession[] = [
  { id: 'ses_001', scenarioId: 'sc_001', scenarioTitle: 'Negociação de Taxas — Ecommerce Médio', userId: 'usr_004', userName: 'Julia Lima', score: 87, duration: 18, completedAt: '2026-03-05T14:00:00', feedback: 'Boa coleta de dados da operação. Melhorar na apresentação dos diferenciais além da taxa (recuperação de vendas, antifraude).' },
  { id: 'ses_002', scenarioId: 'sc_002', scenarioTitle: 'Prospecção — Lead Frio (Infoproduto)', userId: 'usr_005', userName: 'Diego Alves', score: 72, duration: 22, completedAt: '2026-03-06T10:00:00', feedback: 'Qualificação boa, mas foi para proposta de preço sem antes despertar a dor de aprovação. Explore mais os números antes de falar de custo.' },
  { id: 'ses_003', scenarioId: 'sc_003', scenarioTitle: 'Onboarding — Dúvidas de Integração e Saque', userId: 'usr_004', userName: 'Julia Lima', score: 94, duration: 15, completedAt: '2026-03-07T11:00:00', feedback: 'Excelente didática. Explicou prazos de saque com clareza e ofereceu suporte técnico. Cliente saiu seguro para avançar.' },
  { id: 'ses_004', scenarioId: 'sc_001', scenarioTitle: 'Negociação de Taxas — Ecommerce Médio', userId: 'usr_006', userName: 'Mariana Costa', score: 65, duration: 25, completedAt: '2026-03-07T15:00:00', feedback: 'Cedeu revisão de taxa antes de entender o volume completo da operação. Precisa treinar a sequência: coletar dados → apresentar valor → negociar.' },
];

// ─── API Key Modal ────────────────────────────────────────────────────────────
function APIKeyModal({ onClose, onSave }: { onClose: () => void; onSave: (key: string) => void }) {
  const [key, setKey] = useState(() => localStorage.getItem('openai_training_key') || '');
  const [show, setShow] = useState(false);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            <Key className="w-4 h-4 text-primary" />
            Configurar OpenAI API Key
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
            <p className="text-xs text-muted-foreground leading-relaxed">
              A chave é usada diretamente no browser para a simulação de voz. Ela fica salva no seu dispositivo e não é enviada para nossos servidores.
            </p>
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5">OpenAI API Key</label>
            <div className="relative">
              <Input
                type={show ? 'text' : 'password'}
                value={key}
                onChange={e => setKey(e.target.value)}
                placeholder="sk-proj-..."
                className="h-9 text-xs bg-secondary border-border pr-9 font-mono"
              />
              <button
                onClick={() => setShow(s => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Obtenha em{' '}
              <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                platform.openai.com/api-keys
              </a>
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1 bg-gradient-primary text-xs h-9"
              onClick={() => { localStorage.setItem('openai_training_key', key); onSave(key); onClose(); }}
              disabled={!key.startsWith('sk-')}
            >
              <Key className="w-3.5 h-3.5 mr-1.5" /> Salvar e Usar
            </Button>
            <Button size="sm" variant="outline" className="text-xs border-border h-9" onClick={onClose}>
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Create Scenario Modal ────────────────────────────────────────────────────
function CreateScenarioModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({
    title: '', description: '', persona: '', difficulty: 'medium',
    focusPoint: '', avoidPoint: '', focusPoints: [] as string[], avoidPoints: [] as string[],
  });

  const addFocus = () => {
    if (form.focusPoint.trim()) {
      setForm(f => ({ ...f, focusPoints: [...f.focusPoints, f.focusPoint.trim()], focusPoint: '' }));
    }
  };
  const addAvoid = () => {
    if (form.avoidPoint.trim()) {
      setForm(f => ({ ...f, avoidPoints: [...f.avoidPoints, f.avoidPoint.trim()], avoidPoint: '' }));
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            <Plus className="w-4 h-4 text-primary" />
            Criar Cenário de Treinamento
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div>
            <label className="text-xs font-medium block mb-1.5">Título do cenário</label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex: Objeção de preço — SaaS" className="h-9 text-xs bg-secondary border-border" />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5">Descrição</label>
            <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Contexto do cenário de vendas..." className="text-xs bg-secondary border-border min-h-[64px] resize-none" />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5">Persona do cliente</label>
            <Textarea value={form.persona} onChange={e => setForm(f => ({ ...f, persona: e.target.value }))} placeholder="Descreva o perfil do cliente que a IA vai simular..." className="text-xs bg-secondary border-border min-h-[64px] resize-none" />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5">Dificuldade</label>
            <div className="flex gap-2">
              {['easy', 'medium', 'hard'].map(d => (
                <button key={d} onClick={() => setForm(f => ({ ...f, difficulty: d }))}
                  className={cn('flex-1 py-1.5 rounded-lg border text-xs font-medium transition-all',
                    form.difficulty === d ? 'bg-primary/15 border-primary/30 text-primary' : 'border-border text-muted-foreground hover:bg-muted')}>
                  {{ easy: '🟢 Fácil', medium: '🟡 Médio', hard: '🔴 Difícil' }[d]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5 text-success">✓ O vendedor deve focar em...</label>
            <div className="flex gap-2 mb-2">
              <Input value={form.focusPoint} onChange={e => setForm(f => ({ ...f, focusPoint: e.target.value }))} onKeyDown={e => e.key === 'Enter' && addFocus()} placeholder="Ex: Ancoragem de valor" className="h-8 text-xs bg-secondary border-border flex-1" />
              <Button size="sm" variant="outline" className="h-8 text-xs border-border" onClick={addFocus}>+</Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {form.focusPoints.map((p, i) => (
                <span key={i} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-success/10 text-success border border-success/20">
                  {p} <button onClick={() => setForm(f => ({ ...f, focusPoints: f.focusPoints.filter((_, j) => j !== i) }))}><X className="w-2.5 h-2.5" /></button>
                </span>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5 text-destructive">✕ O vendedor deve evitar...</label>
            <div className="flex gap-2 mb-2">
              <Input value={form.avoidPoint} onChange={e => setForm(f => ({ ...f, avoidPoint: e.target.value }))} onKeyDown={e => e.key === 'Enter' && addAvoid()} placeholder="Ex: Dar desconto imediato" className="h-8 text-xs bg-secondary border-border flex-1" />
              <Button size="sm" variant="outline" className="h-8 text-xs border-border" onClick={addAvoid}>+</Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {form.avoidPoints.map((p, i) => (
                <span key={i} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-destructive/10 text-destructive border border-destructive/20">
                  {p} <button onClick={() => setForm(f => ({ ...f, avoidPoints: f.avoidPoints.filter((_, j) => j !== i) }))}><X className="w-2.5 h-2.5" /></button>
                </span>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" className="flex-1 bg-gradient-primary text-xs h-9"><Plus className="w-3.5 h-3.5 mr-1.5" /> Criar Cenário</Button>
            <Button size="sm" variant="outline" className="text-xs border-border h-9" onClick={onClose}>Cancelar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Script Panel ─────────────────────────────────────────────────────────────
function ScriptPanel({ script, elapsedSeconds }: { script: ScriptStep[]; elapsedSeconds: number }) {
  const [open, setOpen] = useState(true);
  const totalSeconds = elapsedSeconds;
  const minutes = Math.floor(totalSeconds / 60);

  // Determine current phase based on elapsed time
  const phaseRanges = [
    { min: 0, max: 3 },
    { min: 3, max: 12 },
    { min: 12, max: 22 },
    { min: 22, max: 30 },
  ];
  const currentPhaseIndex = phaseRanges.findIndex(r => minutes >= r.min && minutes < r.max);
  const activeIndex = currentPhaseIndex === -1 ? script.length - 1 : currentPhaseIndex;

  return (
    <div className="flex flex-col bg-card border-l border-border w-72 flex-shrink-0 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between px-3 py-2.5 border-b border-border hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-1.5">
          <ListChecks className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold">Roteiro da Reunião</span>
        </div>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {script.map((step, i) => (
            <div
              key={i}
              className={cn(
                'rounded-lg border p-2.5 transition-all',
                i === activeIndex
                  ? 'border-primary/40 bg-primary/8'
                  : i < activeIndex
                  ? 'border-success/20 bg-success/5 opacity-60'
                  : 'border-border bg-secondary/40 opacity-50'
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={cn(
                  'text-[10px] font-bold',
                  i === activeIndex ? 'text-primary' : i < activeIndex ? 'text-success' : 'text-muted-foreground'
                )}>
                  {i < activeIndex ? '✓ ' : i === activeIndex ? '● ' : ''}{step.phase}
                </span>
                <span className="text-[9px] text-muted-foreground font-mono">{step.duration}</span>
              </div>
              <p className="text-[10px] text-muted-foreground mb-1.5 leading-relaxed">{step.goal}</p>
              {i === activeIndex && (
                <ul className="space-y-1">
                  {step.tips.map((tip, j) => (
                    <li key={j} className="flex items-start gap-1 text-[9px] text-foreground/80">
                      <span className="text-primary mt-0.5 flex-shrink-0">›</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}

          <div className="mt-2 p-2 rounded-lg bg-muted/30 border border-border">
            <p className="text-[9px] text-muted-foreground text-center">
              Reunião padrão: <strong className="text-foreground">30 min</strong> · Tempo restante: <strong className={cn(elapsedSeconds > 25 * 60 ? 'text-destructive' : 'text-foreground')}>{Math.max(0, 30 - minutes)} min</strong>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Voice Training Session ───────────────────────────────────────────────────
type CallState = 'idle' | 'connecting' | 'listening' | 'processing' | 'speaking' | 'finished';

function VoiceTrainingSession({
  scenario,
  apiKey,
  onFinish,
  onNeedKey,
}: {
  scenario: TrainingScenario;
  apiKey: string;
  onFinish: (score: number, feedback: string) => void;
  onNeedKey: () => void;
}) {
  const { toast } = useToast();
  const [callState, setCallState] = useState<CallState>('idle');
  const [transcript, setTranscript] = useState<VoiceMessage[]>([]);
  const [liveText, setLiveText] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showTranscript, setShowTranscript] = useState(false);
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const [finalFeedback, setFinalFeedback] = useState('');

  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
  const historyRef = useRef<{ role: string; content: string }[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Timer — auto-end at 30 min
  useEffect(() => {
    if (callState !== 'idle' && callState !== 'finished') {
      timerRef.current = setInterval(() => {
        setElapsedSeconds(s => {
          if (s >= 30 * 60 - 1) {
            endSession();
            return s;
          }
          return s + 1;
        });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callState]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  // Build system prompt — AI is the CLIENT, stays reactive, does NOT lead
  const buildSystemPrompt = () => `
Você é um CLIENTE sendo abordado por um vendedor da Appmax, uma fintech brasileira de processamento de pagamentos para e-commerce e infoprodutos.

━━━ SUA PERSONA ━━━
${scenario.persona}

━━━ CONTEXTO DO CENÁRIO ━━━
${scenario.description}

━━━ SOBRE A APPMAX (contexto para suas respostas) ━━━
A Appmax é uma processadora de pagamentos focada em e-commerce e negócios digitais. Ela oferece:
- Processamento via cartão de crédito, PIX e boleto
- Checkout de alta conversão com antifraude por IA
- Recuperação automática de carrinho abandonado e retentativa de pagamento
- Recorrência e assinaturas
- Banco digital "Max" para empreendedores
- Integrações com plataformas de e-commerce e infoprodutos
- Autorizada pelo Banco Central do Brasil

━━━ REGRAS CRÍTICAS DE COMPORTAMENTO ━━━
- Você é o CLIENTE. O vendedor conduz a conversa. Você REAGE, não lidera.
- Responda ao que o vendedor perguntou ou disse. Não mude de assunto por conta própria.
- Respostas CURTAS: máximo 2 frases. Seja direto como uma conversa telefônica real.
- NÃO faça mais de UMA pergunta por resposta. Geralmente nenhuma — espere o vendedor puxar a conversa.
- Só faça perguntas se o vendedor apresentar algo que gera dúvida natural (ex: "que taxa é essa?").
- NÃO interrompa o fluxo com perguntas encadeadas. Deixe o vendedor seguir o roteiro dele.
- Seja cético mas receptivo. Não ceda fácil, mas não seja impossível.
- Fale como dono de e-commerce real: prático, direto, sem jargões financeiros.
- Após 10–12 trocas OU se o vendedor propuser próximo passo, encerre naturalmente: "Me manda uma proposta", "Vou pensar", "Pode marcar a demo".
- NUNCA quebre o personagem, nunca mencione IA ou treinamento.
- Responda SEMPRE em português brasileiro informal.
- Se o vendedor cometer erros óbvios (prometer desconto sem saber o volume), reaja com ceticismo mas não encerre a conversa.
  `.trim();

  // Speak text via Web Speech Synthesis
  const speak = useCallback((text: string, onEnd?: () => void) => {
    if (!synth || isMuted) {
      onEnd?.();
      return;
    }
    synth.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'pt-BR';
    utter.rate = 1.0;
    utter.pitch = 1.0;

    const voices = synth.getVoices();
    const ptVoice = voices.find(v => v.lang.startsWith('pt')) || voices[0];
    if (ptVoice) utter.voice = ptVoice;

    utter.onend = () => onEnd?.();
    utter.onerror = () => onEnd?.();
    synth.speak(utter);
  }, [synth, isMuted]);

  // Call OpenAI
  const callOpenAI = useCallback(async (userMessage: string) => {
    if (!apiKey) { onNeedKey(); return; }
    setCallState('processing');

    historyRef.current.push({ role: 'user', content: userMessage });

    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: buildSystemPrompt() },
            ...historyRef.current,
          ],
          max_tokens: 120, // Keep responses short
          temperature: 0.75,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || `HTTP ${res.status}`);
      }

      const data = await res.json();
      const reply = data.choices[0]?.message?.content || '';

      historyRef.current.push({ role: 'assistant', content: reply });

      setTranscript(prev => [...prev, {
        role: 'assistant',
        content: reply,
        timestamp: new Date().toISOString(),
      }]);

      const userTurns = historyRef.current.filter(m => m.role === 'user').length;
      const isEnd = userTurns >= 12 ||
        /encerr|finaliz|próxima reunião|obrigado pela conversa|até logo|me manda a proposta|vou pensar|retorno pra você|manda o contrato|pode marcar/i.test(reply);

      if (isEnd) {
        setCallState('speaking');
        speak(reply, () => { endSession(); });
      } else {
        setCallState('speaking');
        speak(reply, () => startListening());
      }

    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro na IA', description: err.message });
      setCallState('listening');
      startListening();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, speak]);

  // Request final evaluation from OpenAI
  const requestEvaluation = useCallback(async () => {
    if (!apiKey || historyRef.current.length < 2) {
      const score = 70 + Math.floor(Math.random() * 20);
      setFinalScore(score);
      setFinalFeedback('Sessão encerrada. Conecte a API para receber feedback detalhado.');
      setCallState('finished');
      return;
    }

    try {
      const evalPrompt = `
Você é um coach especialista em vendas B2B para fintechs e processadoras de pagamentos, com foco em e-commerce.
Analise esta simulação de vendas da Appmax (processadora de pagamentos) e avalie o desempenho do vendedor.

CENÁRIO: ${scenario.title}
PERSONA DO CLIENTE: ${scenario.persona}

O VENDEDOR DEVIA FOCAR EM:
${scenario.focusPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}

O VENDEDOR DEVIA EVITAR:
${scenario.avoidPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}

TRANSCRIÇÃO DA SIMULAÇÃO:
${historyRef.current.map(m => `${m.role === 'user' ? '🟦 VENDEDOR' : '🟥 CLIENTE'}: ${m.content}`).join('\n')}

Avalie de 0 a 100 o desempenho do vendedor com base em:
- Levantamento correto de dados da operação do cliente (volume, ticket médio, aprovação atual)
- Apresentação de valor além da taxa (antifraude, recuperação de vendas, checkout)
- Tratamento de objeções de forma consultiva
- Condução da conversa em direção a um próximo passo concreto
- Evitou os erros listados acima?

Responda em JSON com:
{
  "score": <número de 0 a 100>,
  "feedback": "<feedback específico em 3-4 frases: o que foi bem, o que precisa melhorar e uma dica prática para a próxima simulação>"
}
`;
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: evalPrompt }],
          response_format: { type: 'json_object' },
          max_tokens: 250,
        }),
      });
      const data = await res.json();
      const parsed = JSON.parse(data.choices[0]?.message?.content || '{}');
      setFinalScore(parsed.score || 75);
      setFinalFeedback(parsed.feedback || 'Sessão concluída.');
    } catch {
      setFinalScore(75);
      setFinalFeedback('Sessão concluída. Não foi possível gerar feedback automaticamente.');
    }
    setCallState('finished');
  }, [apiKey, scenario]);

  const endSession = useCallback(() => {
    recognitionRef.current?.stop();
    synth?.cancel();
    if (timerRef.current) clearInterval(timerRef.current);
    requestEvaluation();
  }, [requestEvaluation, synth]);

  // Start microphone listening
  const startListening = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast({ variant: 'destructive', title: 'Não suportado', description: 'Seu browser não suporta reconhecimento de voz. Use Chrome.' });
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = 'pt-BR';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => setCallState('listening');

    recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += text;
        else interim += text;
      }
      setLiveText(interim || final);

      if (final.trim()) {
        setLiveText('');
        setTranscript(prev => [...prev, {
          role: 'user',
          content: final.trim(),
          timestamp: new Date().toISOString(),
        }]);
        callOpenAI(final.trim());
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error !== 'aborted' && event.error !== 'no-speech') {
        toast({ variant: 'destructive', title: 'Erro no microfone', description: event.error });
      }
    };

    recognition.onend = () => {
      if (callState === 'listening') setCallState('idle');
    };

    recognition.start();
  }, [callOpenAI, callState, toast]);

  // Start call
  const startCall = useCallback(async () => {
    if (!apiKey) { onNeedKey(); return; }
    setCallState('connecting');

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast({ variant: 'destructive', title: 'Microfone negado', description: 'Permita o acesso ao microfone para iniciar.' });
      setCallState('idle');
      return;
    }

    historyRef.current = [];
    setTranscript([]);
    setElapsedSeconds(0);

    const greetings: Record<string, string> = {
      sc_001: 'Alô? Oi, pode falar.',
      sc_002: 'Oi, tudo bem? Com quem eu tô falando?',
      sc_003: 'Oi! Tô aqui, pode falar.',
      sc_004: 'Oi, sim, tô te esperando. O que você tem pra me dizer?',
    };
    const greeting = greetings[scenario.id] ?? 'Alô? Pode falar.';
    const greetingMsg = { role: 'assistant' as const, content: greeting, timestamp: new Date().toISOString() };

    historyRef.current.push({ role: 'assistant', content: greeting });
    setTranscript([greetingMsg]);
    setCallState('speaking');

    speak(greeting, () => startListening());
  }, [apiKey, scenario, speak, startListening, onNeedKey, toast]);

  // Finished screen
  if (callState === 'finished' && finalScore !== null) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 p-8 text-center">
        <div className="w-20 h-20 rounded-full bg-gradient-primary flex items-center justify-center">
          <Trophy className="w-10 h-10 text-primary-foreground" />
        </div>
        <div>
          <h3 className="font-display font-bold text-2xl mb-1">Simulação Concluída!</h3>
          <p className="text-sm text-muted-foreground">{scenario.title} · {formatTime(elapsedSeconds)}</p>
        </div>
        <div className={cn('text-6xl font-bold',
          finalScore >= 85 ? 'text-success' : finalScore >= 70 ? 'text-primary' : 'text-warning')}>
          {finalScore}<span className="text-2xl text-muted-foreground">/100</span>
        </div>
        <div className="max-w-sm p-4 rounded-xl bg-secondary border border-border text-left">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-accent" />
            <span className="text-xs font-semibold">Feedback da IA</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{finalFeedback}</p>
        </div>
        <div className="flex gap-3">
          <Button
            className="bg-gradient-primary"
            onClick={() => onFinish(finalScore, finalFeedback)}
          >
            <CheckCircle2 className="w-4 h-4 mr-2" /> Finalizar
          </Button>
          <Button
            variant="outline"
            className="border-border"
            onClick={() => {
              setCallState('idle');
              setTranscript([]);
              setElapsedSeconds(0);
              historyRef.current = [];
              setFinalScore(null);
            }}
          >
            <Play className="w-4 h-4 mr-2" /> Tentar novamente
          </Button>
        </div>

        {/* Full transcript */}
        <div className="w-full max-w-lg">
          <button
            onClick={() => setShowTranscript(s => !s)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mx-auto"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            {showTranscript ? 'Ocultar' : 'Ver'} transcrição completa
          </button>
          {showTranscript && (
            <div className="mt-3 space-y-2 max-h-60 overflow-y-auto">
              {transcript.map((msg, i) => (
                <div key={i} className={cn('flex gap-2 text-xs', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
                  <span className={cn('px-3 py-2 rounded-xl max-w-[80%]',
                    msg.role === 'user' ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground')}>
                    <span className="font-semibold block text-[10px] mb-0.5">{msg.role === 'user' ? 'Você' : 'Cliente'}</span>
                    {msg.content}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Main call interface ──
  return (
    <div className="flex h-full">
      {/* Left: call area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Top bar */}
        <div className="px-4 py-2.5 border-b border-border bg-secondary/30 flex items-center justify-between flex-shrink-0">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate">{scenario.title}</p>
            <p className="text-[10px] text-muted-foreground truncate">{scenario.persona.split('.')[0]}</p>
          </div>
          <div className="flex items-center gap-3 ml-3">
            {callState !== 'idle' && (
              <span className="text-xs font-mono font-semibold text-foreground tabular-nums">
                {formatTime(elapsedSeconds)}
                <span className="text-[9px] text-muted-foreground ml-1">/ 30:00</span>
              </span>
            )}
          </div>
        </div>

        {/* Main area */}
        <div className="flex-1 flex flex-col items-center justify-center gap-5 p-5 relative overflow-hidden">

          {/* Status label */}
          <div className="absolute top-3 left-0 right-0 flex justify-center">
            <span className={cn(
              'text-xs font-medium px-3 py-1 rounded-full border transition-all',
              callState === 'idle' ? 'bg-muted/50 border-border text-muted-foreground' :
              callState === 'connecting' ? 'bg-warning/10 border-warning/20 text-warning' :
              callState === 'listening' ? 'bg-success/10 border-success/20 text-success' :
              callState === 'processing' ? 'bg-primary/10 border-primary/20 text-primary' :
              callState === 'speaking' ? 'bg-accent/10 border-accent/20 text-accent' : 'bg-muted border-border text-muted-foreground'
            )}>
              {{
                idle: '● Aguardando início',
                connecting: '◉ Conectando...',
                listening: '🎙 Ouvindo você...',
                processing: '⚡ Processando...',
                speaking: '🔊 Cliente respondendo...',
                finished: '✓ Encerrado',
              }[callState]}
            </span>
          </div>

          {/* AI avatar */}
          <div className="relative">
            {callState === 'speaking' && (
              <>
                <div className="absolute inset-0 rounded-full bg-accent/20 animate-ping scale-150" />
                <div className="absolute inset-0 rounded-full bg-accent/10 animate-ping scale-125" style={{ animationDelay: '0.3s' }} />
              </>
            )}
            {callState === 'listening' && (
              <>
                <div className="absolute inset-0 rounded-full bg-success/20 animate-ping scale-150" />
                <div className="absolute inset-0 rounded-full bg-success/10 animate-ping scale-125" style={{ animationDelay: '0.5s' }} />
              </>
            )}
            <div className={cn(
              'w-24 h-24 rounded-full flex flex-col items-center justify-center transition-all duration-300 relative z-10 border-4',
              callState === 'idle' ? 'bg-secondary border-border' :
              callState === 'listening' ? 'bg-success/15 border-success/40' :
              callState === 'processing' ? 'bg-primary/15 border-primary/40' :
              callState === 'speaking' ? 'bg-accent/15 border-accent/40' :
              callState === 'connecting' ? 'bg-warning/15 border-warning/40' : 'bg-secondary border-border'
            )}>
              <span className="text-4xl select-none">🧑‍💼</span>
            </div>
          </div>

          {/* Live feedback area */}
          <div className="w-full max-w-md min-h-[70px] flex flex-col items-center justify-center gap-2">
            {transcript.length > 0 && callState === 'speaking' && (
              <div className="w-full p-3 rounded-xl bg-accent/8 border border-accent/20 text-center">
                <p className="text-xs text-muted-foreground font-semibold mb-0.5">Cliente:</p>
                <p className="text-sm text-foreground leading-relaxed">
                  {transcript.filter(m => m.role === 'assistant').slice(-1)[0]?.content}
                </p>
              </div>
            )}

            {callState === 'processing' && (
              <div className="flex items-center gap-2 text-primary">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-xs">Processando resposta...</span>
              </div>
            )}

            {callState === 'listening' && (
              <div className="w-full">
                {liveText ? (
                  <div className="p-3 rounded-xl bg-success/8 border border-success/20 text-center">
                    <p className="text-xs text-muted-foreground font-semibold mb-0.5">Você:</p>
                    <p className="text-sm text-foreground leading-relaxed italic">{liveText}</p>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 text-success">
                    <Waves className="w-4 h-4" />
                    <span className="text-xs">Fale agora...</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-4">
            {callState === 'idle' ? (
              <Button
                size="lg"
                className="bg-gradient-primary rounded-full w-16 h-16 p-0 shadow-lg hover:scale-105 transition-transform"
                onClick={startCall}
              >
                <Phone className="w-6 h-6" />
              </Button>
            ) : (
              <>
                <button
                  onClick={() => setIsMuted(m => !m)}
                  className={cn(
                    'w-11 h-11 rounded-full border flex items-center justify-center transition-all',
                    isMuted
                      ? 'bg-destructive/15 border-destructive/30 text-destructive'
                      : 'bg-secondary border-border text-muted-foreground hover:bg-muted'
                  )}
                  title={isMuted ? 'Ativar voz da IA' : 'Silenciar voz da IA'}
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>

                <button
                  onClick={() => {
                    if (callState === 'listening') {
                      recognitionRef.current?.stop();
                      setCallState('connecting');
                    } else {
                      startListening();
                    }
                  }}
                  disabled={callState === 'processing' || callState === 'connecting' || callState === 'speaking'}
                  className={cn(
                    'w-18 h-18 rounded-full flex items-center justify-center transition-all shadow-lg relative',
                    callState === 'listening'
                      ? 'bg-success text-white scale-110 shadow-success/40'
                      : 'bg-primary text-primary-foreground hover:scale-105',
                    (callState === 'processing' || callState === 'connecting' || callState === 'speaking') && 'opacity-40 cursor-not-allowed scale-100'
                  )}
                  style={{ width: 72, height: 72 }}
                  title={callState === 'listening' ? 'Clique para parar' : 'Clique para falar'}
                >
                  {callState === 'listening' ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
                </button>

                <button
                  onClick={endSession}
                  className="w-11 h-11 rounded-full bg-destructive/15 border border-destructive/30 text-destructive flex items-center justify-center hover:bg-destructive/25 transition-all"
                  title="Encerrar simulação"
                >
                  <PhoneOff className="w-4 h-4" />
                </button>
              </>
            )}
          </div>

          {callState === 'idle' && (
            <p className="text-xs text-muted-foreground text-center max-w-xs">
              Clique em <strong>Iniciar</strong> para começar.<br />
              O cliente atende, você conduz a conversa.
            </p>
          )}

          {callState === 'speaking' && (
            <p className="text-xs text-muted-foreground/50 text-center">
              Aguarde o cliente terminar...
            </p>
          )}
        </div>

        {/* Collapsible transcript */}
        <div className="border-t border-border flex-shrink-0">
          <button
            onClick={() => setShowTranscript(s => !s)}
            className="w-full flex items-center justify-between px-4 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-1.5">
              <MessageSquare className="w-3 h-3" />
              Transcrição ({transcript.length} mensagens)
            </div>
            <span>{showTranscript ? '▲' : '▼'}</span>
          </button>
          {showTranscript && (
            <div className="max-h-40 overflow-y-auto px-4 pb-3 space-y-2">
              {transcript.map((msg, i) => (
                <div key={i} className={cn('flex gap-2', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
                  <div className={cn('max-w-[80%] px-3 py-2 rounded-xl text-xs',
                    msg.role === 'user' ? 'bg-primary/10 text-primary rounded-tr-sm' : 'bg-secondary text-muted-foreground rounded-tl-sm border border-border')}>
                    <span className="font-semibold block text-[10px] mb-0.5">{msg.role === 'user' ? 'Você' : 'Cliente'}</span>
                    {msg.content}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </div>
      </div>

      {/* Right: script panel */}
      {scenario.script && scenario.script.length > 0 && (
        <ScriptPanel script={scenario.script} elapsedSeconds={elapsedSeconds} />
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
const DIFF_CONFIG = {
  easy: { label: 'Fácil', class: 'bg-success/10 text-success border-success/20' },
  medium: { label: 'Médio', class: 'bg-warning/10 text-warning border-warning/20' },
  hard: { label: 'Difícil', class: 'bg-destructive/10 text-destructive border-destructive/20' },
};

export default function TrainingPage() {
  const { user, hasRole } = useAuth();
  const { tokens } = useAppConfig();
  const isAdmin = hasRole(['admin', 'director', 'supervisor']);
  const [tab, setTab] = useState<'scenarios' | 'history'>('scenarios');
  const [activeSession, setActiveSession] = useState<TrainingScenario | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const apiKey = tokens.training;

  const myHistory = MOCK_SESSIONS.filter(s => s.userId === user?.id || isAdmin);
  const avgScore = myHistory.length ? Math.round(myHistory.reduce((a, s) => a + s.score, 0) / myHistory.length) : 0;

  if (activeSession) {
    return (
      <div className="page-container animate-fade-in h-[calc(100vh-56px)] flex flex-col">
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                window.speechSynthesis?.cancel();
                setActiveSession(null);
              }}
              className="w-8 h-8 rounded-lg border border-border hover:bg-muted flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-lg font-display font-bold">{activeSession.title}</h1>
              <p className="text-xs text-muted-foreground">Simulação por voz · 30 min</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn(
              'flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border',
              apiKey.startsWith('sk-')
                ? 'border-success/30 bg-success/10 text-success'
                : 'border-destructive/30 bg-destructive/10 text-destructive'
            )}>
              <Key className="w-3 h-3" />
              {apiKey.startsWith('sk-') ? 'Token OK' : 'Sem token — configure em Admin → Tokens OpenAI'}
            </span>
            <span className={cn('text-xs px-2.5 py-1 rounded-full border font-medium', DIFF_CONFIG[activeSession.difficulty].class)}>
              {DIFF_CONFIG[activeSession.difficulty].label}
            </span>
          </div>
        </div>

        <div className="flex-1 min-h-0 glass-card overflow-hidden">
          <VoiceTrainingSession
            scenario={activeSession}
            apiKey={apiKey}
            onFinish={(_score, _feedback) => setActiveSession(null)}
            onNeedKey={() => setActiveSession(null)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="page-container animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold">Treinamentos</h1>
          <p className="text-sm text-muted-foreground">Simulações de vendas por voz com IA em tempo real</p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'flex items-center gap-1.5 text-xs border rounded-lg px-3 py-1.5',
              apiKey.startsWith('sk-')
                ? 'border-success/30 text-success bg-success/5'
                : 'border-warning/30 text-warning bg-warning/5'
            )}
          >
            <Key className="w-3 h-3" />
            {apiKey.startsWith('sk-') ? 'Token de treinamento ✓' : 'Configure em Admin → Tokens OpenAI'}
          </span>
          {isAdmin && (
            <Button size="sm" className="bg-gradient-primary text-xs h-8" onClick={() => setShowCreate(true)}>
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Criar Cenário
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Treinamentos', value: myHistory.length, icon: BookOpen, color: 'text-primary' },
          { label: 'Média de Score', value: `${avgScore}`, icon: Target, color: avgScore >= 80 ? 'text-success' : 'text-warning' },
          { label: 'Cenários Ativos', value: MOCK_SCENARIOS.length, icon: Brain, color: 'text-accent' },
          { label: 'Tempo Total', value: `${myHistory.reduce((a, s) => a + s.duration, 0)}min`, icon: Clock, color: 'text-info' },
        ].map(stat => (
          <div key={stat.label} className="glass-card p-4 rounded-xl">
            <div className="flex items-center gap-2 mb-1">
              <stat.icon className={cn('w-4 h-4', stat.color)} />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{stat.label}</span>
            </div>
            <p className={cn('text-2xl font-bold', stat.color)}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-secondary rounded-lg border border-border mb-5 w-fit">
        {[
          { key: 'scenarios', label: 'Cenários', icon: Brain },
          { key: 'history', label: isAdmin ? 'Histórico do Time' : 'Meu Histórico', icon: BarChart3 },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={cn('flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-medium transition-colors',
              tab === t.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
            <t.icon className="w-3.5 h-3.5" />{t.label}
          </button>
        ))}
      </div>

      {/* Scenarios */}
      {tab === 'scenarios' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {MOCK_SCENARIOS.map(scenario => {
            const myBest = MOCK_SESSIONS.filter(s => s.scenarioId === scenario.id && s.userId === user?.id);
            const bestScore = myBest.length ? Math.max(...myBest.map(s => s.score)) : null;
            return (
              <div key={scenario.id} className="glass-card-hover p-5 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <Brain className="w-5 h-5 text-accent" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" /> 30 min
                    </span>
                    <span className={cn('text-[10px] px-2 py-0.5 rounded-full border font-medium', DIFF_CONFIG[scenario.difficulty].class)}>
                      {DIFF_CONFIG[scenario.difficulty].label}
                    </span>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-sm mb-1">{scenario.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{scenario.description}</p>
                </div>

                {/* Script preview — visible to all */}
                {scenario.script && scenario.script.length > 0 && (
                  <div className="p-2.5 rounded-lg bg-secondary/60 border border-border">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 flex items-center gap-1">
                      <ListChecks className="w-3 h-3" /> Roteiro ({scenario.script.length} fases)
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {scenario.script.map((s, i) => (
                        <span key={i} className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/8 text-primary border border-primary/15">
                          {s.phase.split('.')[1]?.trim() || s.phase} · {s.duration}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Only admins/supervisors see the coaching guide */}
                {isAdmin && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Guia do Coach</p>
                    <div className="flex flex-wrap gap-1">
                      {scenario.focusPoints.map((p, i) => (
                        <span key={i} className="text-[9px] px-1.5 py-0.5 rounded-full bg-success/10 text-success border border-success/20">{p}</span>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {scenario.avoidPoints.map((p, i) => (
                        <span key={i} className="text-[9px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20">✕ {p}</span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between mt-auto pt-2 border-t border-border">
                  {bestScore ? (
                    <span className={cn('text-xs font-semibold', bestScore >= 85 ? 'text-success' : bestScore >= 70 ? 'text-primary' : 'text-warning')}>
                      Melhor: {bestScore} pts
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Não realizado</span>
                  )}
                  <Button size="sm" className="bg-gradient-primary text-xs h-7" onClick={() => {
                    if (!apiKey.startsWith('sk-')) { return; }
                    setActiveSession(scenario);
                  }}>
                    <Mic className="w-3 h-3 mr-1" /> Iniciar
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* History */}
      {tab === 'history' && (
        <div className="glass-card overflow-hidden">
          <table className="w-full data-table">
            <thead>
              <tr>
                <th className="text-left">Cenário</th>
                {isAdmin && <th className="text-left hidden md:table-cell">Vendedor</th>}
                <th className="text-center">Score</th>
                <th className="text-center hidden lg:table-cell">Duração</th>
                <th className="text-left hidden lg:table-cell">Feedback IA</th>
                <th className="text-center">Data</th>
              </tr>
            </thead>
            <tbody>
              {myHistory.map(session => (
                <tr key={session.id}>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                        <Brain className="w-3.5 h-3.5 text-accent" />
                      </div>
                      <p className="text-xs font-medium">{session.scenarioTitle}</p>
                    </div>
                  </td>
                  {isAdmin && (
                    <td className="hidden md:table-cell">
                      <div className="flex items-center gap-2">
                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${session.userName}`} alt={session.userName} className="w-6 h-6 rounded-full border border-border" />
                        <span className="text-xs">{session.userName}</span>
                      </div>
                    </td>
                  )}
                  <td className="text-center">
                    <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full',
                      session.score >= 85 ? 'bg-success/10 text-success' : session.score >= 70 ? 'bg-primary/10 text-primary' : 'bg-warning/10 text-warning')}>
                      {session.score}
                    </span>
                  </td>
                  <td className="text-center hidden lg:table-cell">
                    <span className="text-xs text-muted-foreground">{session.duration}min</span>
                  </td>
                  <td className="hidden lg:table-cell">
                    <p className="text-xs text-muted-foreground truncate max-w-[220px]">{session.feedback}</p>
                  </td>
                  <td className="text-center">
                    <span className="text-xs text-muted-foreground">{new Date(session.completedAt).toLocaleDateString('pt-BR')}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && <CreateScenarioModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
