import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Plus, Brain, Send, Trophy, Clock, Target, Users,
  ChevronRight, Star, TrendingUp, X, Play, Sparkles,
  CheckCircle2, AlertTriangle, MessageSquare, Zap, BookOpen,
  BarChart3, Calendar
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// ─── Types ───────────────────────────────────────────────────────────────────
interface TrainingScenario {
  id: string;
  title: string;
  description: string;
  focusPoints: string[];
  avoidPoints: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  persona: string;
  createdBy: string;
  createdAt: string;
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

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

// ─── Mock data ───────────────────────────────────────────────────────────────
const MOCK_SCENARIOS: TrainingScenario[] = [
  {
    id: 'sc_001',
    title: 'Objeção de Preço — SaaS B2B',
    description: 'Cliente questiona o custo frente a concorrentes. Simula um decisor financeiro de uma empresa de médio porte.',
    focusPoints: ['Ancoragem de valor', 'ROI em números', 'Comparativo com custo da inação'],
    avoidPoints: ['Dar desconto imediato', 'Falar mal da concorrência', 'Justificar pelo custo de desenvolvimento'],
    difficulty: 'hard',
    persona: 'CFO de empresa de 150 funcionários, cético com novos gastos e focado em payback rápido.',
    createdBy: 'Marcos Schuldz',
    createdAt: '2026-02-10',
  },
  {
    id: 'sc_002',
    title: 'Qualificação MEDDIC — Lead Frio',
    description: 'Lead que baixou um material mas não respondeu follow-ups. Objetivo: requalificar e identificar timing.',
    focusPoints: ['Descoberta de dores', 'Identificar economic buyer', 'Mapear processo de decisão'],
    avoidPoints: ['Ir direto para demo', 'Falar de preço', 'Prometer funcionalidades futuras'],
    difficulty: 'medium',
    persona: 'Gestor de operações que está avaliando soluções mas não tem urgência clara definida.',
    createdBy: 'Marcos Schuldz',
    createdAt: '2026-02-15',
  },
  {
    id: 'sc_003',
    title: 'Demo de Produto — Fechamento',
    description: 'Demo para um prospect quente que já conhece o produto. Momento de criar urgência e fechar próximos passos.',
    focusPoints: ['Confirmar dores mapeadas', 'Personalizar a demo', 'Criar urgência e next steps com data'],
    avoidPoints: ['Demo genérica', 'Não confirmar budget', 'Sair sem data de decisão definida'],
    difficulty: 'easy',
    persona: 'Head de Vendas animado com a solução, mas aguardando aprovação do CEO.',
    createdBy: 'Rafael Torres',
    createdAt: '2026-03-01',
  },
];

const MOCK_SESSIONS: TrainingSession[] = [
  { id: 'ses_001', scenarioId: 'sc_001', scenarioTitle: 'Objeção de Preço — SaaS B2B', userId: 'usr_004', userName: 'Julia Lima', score: 87, duration: 18, completedAt: '2026-03-05T14:00:00', feedback: 'Excelente ancoragem de ROI. Melhorar na exploração de riscos da inação.' },
  { id: 'ses_002', scenarioId: 'sc_002', scenarioTitle: 'Qualificação MEDDIC — Lead Frio', userId: 'usr_005', userName: 'Diego Alves', score: 72, duration: 22, completedAt: '2026-03-06T10:00:00', feedback: 'Boa descoberta, mas foi para a demo rápido demais. Falta mapear o budget authority.' },
  { id: 'ses_003', scenarioId: 'sc_003', scenarioTitle: 'Demo de Produto — Fechamento', userId: 'usr_004', userName: 'Julia Lima', score: 94, duration: 15, completedAt: '2026-03-07T11:00:00', feedback: 'Demo excepcional. Personalizou para o contexto do cliente e fechou com data definida.' },
  { id: 'ses_004', scenarioId: 'sc_001', scenarioTitle: 'Objeção de Preço — SaaS B2B', userId: 'usr_006', userName: 'Mariana Costa', score: 65, duration: 25, completedAt: '2026-03-07T15:00:00', feedback: 'Deu desconto antes de explorar o valor. Precisa treinar ancoragem.' },
];

// ─── Simulate AI messages ────────────────────────────────────────────────────
const AI_RESPONSES_BY_SCENARIO: Record<string, string[]> = {
  sc_001: [
    'Olá! Recebi a proposta de vocês... mas, olhando os números, o valor está bem acima do que eu esperava. Temos outra solução no mercado por quase metade do preço. Por que eu pagaria esse diferencial?',
    'Entendo o argumento do ROI, mas no momento nossa empresa está com budget travado para novos softwares. Não conseguiria aprovar isso agora.',
    'Vamos supondo que o ROI seja real... em quanto tempo eu recuperaria esse investimento?',
    'Interessante esse ponto. Mas como você comprova que esses números se aplicam à nossa realidade?',
    'Ok, você me convenceu a ouvir mais. Qual seria o próximo passo que você propõe?',
  ],
  sc_002: [
    'Oi, vi que você me enviou algumas mensagens. Desculpa a demora, ando bem ocupado. O que exatamente você oferece?',
    'Sim, temos alguns processos manuais que travam o time, mas não é nossa prioridade agora.',
    'Como isso funciona na prática? Vocês precisam de integração com nossos sistemas?',
    'Quando falamos de prazo, preciso consultar a diretoria. Não temos nada definido por enquanto.',
  ],
  sc_003: [
    'Olá! Estou animado para ver a demonstração. Vi alguns materiais de vocês e parece que pode resolver nosso problema de visibilidade.',
    'Que interessante! E isso funciona em tempo real? Nosso gestor precisaria ver o desempenho do time ao vivo.',
    'Quanto custa? Tenho que levar para o CEO aprovar.',
    'Ótimo. Mas o CEO vai querer saber: quanto tempo leva para implementar e quanto de trabalho dá para o nosso time?',
  ],
};

// ─── Create Scenario Modal ────────────────────────────────────────────────────
function CreateScenarioModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    persona: '',
    difficulty: 'medium',
    focusPoint: '',
    avoidPoint: '',
    focusPoints: [] as string[],
    avoidPoints: [] as string[],
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
                <button
                  key={d}
                  onClick={() => setForm(f => ({ ...f, difficulty: d }))}
                  className={cn(
                    'flex-1 py-1.5 rounded-lg border text-xs font-medium transition-all',
                    form.difficulty === d ? 'bg-primary/15 border-primary/30 text-primary' : 'border-border text-muted-foreground hover:bg-muted'
                  )}
                >
                  {{ easy: '🟢 Fácil', medium: '🟡 Médio', hard: '🔴 Difícil' }[d]}
                </button>
              ))}
            </div>
          </div>

          {/* Focus points */}
          <div>
            <label className="text-xs font-medium block mb-1.5 text-success">✓ O vendedor deve focar em...</label>
            <div className="flex gap-2 mb-2">
              <Input
                value={form.focusPoint}
                onChange={e => setForm(f => ({ ...f, focusPoint: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && addFocus()}
                placeholder="Ex: Ancoragem de valor"
                className="h-8 text-xs bg-secondary border-border flex-1"
              />
              <Button size="sm" variant="outline" className="h-8 text-xs border-border" onClick={addFocus}>Adicionar</Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {form.focusPoints.map((p, i) => (
                <span key={i} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-success/10 text-success border border-success/20">
                  {p}
                  <button onClick={() => setForm(f => ({ ...f, focusPoints: f.focusPoints.filter((_, j) => j !== i) }))}>
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Avoid points */}
          <div>
            <label className="text-xs font-medium block mb-1.5 text-destructive">✕ O vendedor deve evitar...</label>
            <div className="flex gap-2 mb-2">
              <Input
                value={form.avoidPoint}
                onChange={e => setForm(f => ({ ...f, avoidPoint: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && addAvoid()}
                placeholder="Ex: Dar desconto imediato"
                className="h-8 text-xs bg-secondary border-border flex-1"
              />
              <Button size="sm" variant="outline" className="h-8 text-xs border-border" onClick={addAvoid}>Adicionar</Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {form.avoidPoints.map((p, i) => (
                <span key={i} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-destructive/10 text-destructive border border-destructive/20">
                  {p}
                  <button onClick={() => setForm(f => ({ ...f, avoidPoints: f.avoidPoints.filter((_, j) => j !== i) }))}>
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button size="sm" className="flex-1 bg-gradient-primary text-xs h-9">
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Criar Cenário
            </Button>
            <Button size="sm" variant="outline" className="text-xs border-border h-9" onClick={onClose}>Cancelar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Training Chat ────────────────────────────────────────────────────────────
function TrainingChat({ scenario, onFinish }: { scenario: TrainingScenario; onFinish: (score: number, feedback: string) => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: `Olá! Estou pronto para o treinamento "${scenario.title}". ${scenario.persona.split('.')[0]}. Pode começar quando quiser!`,
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [turn, setTurn] = useState(0);
  const [finished, setFinished] = useState(false);
  const [finalScore] = useState(Math.floor(Math.random() * 25) + 70);
  const bottomRef = useRef<HTMLDivElement>(null);
  const responses = AI_RESPONSES_BY_SCENARIO[scenario.id] || AI_RESPONSES_BY_SCENARIO['sc_001'];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const sendMessage = () => {
    if (!input.trim() || isTyping) return;
    const userMsg: ChatMessage = { role: 'user', content: input, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    const isLastTurn = turn >= responses.length - 1;

    setTimeout(() => {
      if (isLastTurn) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `Obrigado pela conversa! Vou encerrar a simulação aqui. Foi uma boa demonstração das suas habilidades.`,
          timestamp: new Date().toISOString(),
        }]);
        setIsTyping(false);
        setFinished(true);
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: responses[turn],
          timestamp: new Date().toISOString(),
        }]);
        setTurn(t => t + 1);
        setIsTyping(false);
      }
    }, 1200 + Math.random() * 800);
  };

  if (finished) {
    const mockFeedback = `Você demonstrou boa capacidade de ${scenario.focusPoints[0].toLowerCase()}. ${scenario.avoidPoints.length > 0 ? `Atenção: em alguns momentos você tendeu a ${scenario.avoidPoints[0].toLowerCase()}.` : ''} Continue praticando!`;
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 p-8 text-center">
        <div className="w-20 h-20 rounded-full bg-gradient-primary flex items-center justify-center">
          <Trophy className="w-10 h-10 text-primary-foreground" />
        </div>
        <div>
          <h3 className="font-display font-bold text-2xl mb-1">Treinamento Concluído!</h3>
          <p className="text-sm text-muted-foreground">{scenario.title}</p>
        </div>
        <div className={cn(
          'text-6xl font-bold',
          finalScore >= 85 ? 'text-success' : finalScore >= 70 ? 'text-primary' : 'text-warning'
        )}>
          {finalScore}
          <span className="text-2xl text-muted-foreground">/100</span>
        </div>
        <div className="max-w-sm p-4 rounded-xl bg-secondary border border-border text-left">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-accent" />
            <span className="text-xs font-semibold">Feedback da IA</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{mockFeedback}</p>
        </div>
        <Button className="bg-gradient-primary" onClick={() => onFinish(finalScore, mockFeedback)}>
          <CheckCircle2 className="w-4 h-4 mr-2" /> Finalizar e Salvar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Scenario brief */}
      <div className="px-4 py-3 border-b border-border bg-secondary/30 flex-shrink-0">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <p className="text-xs font-semibold mb-1">{scenario.title}</p>
            <p className="text-[11px] text-muted-foreground">{scenario.persona}</p>
          </div>
          <div className="flex flex-wrap gap-1 flex-shrink-0 max-w-[180px]">
            {scenario.focusPoints.slice(0, 2).map((p, i) => (
              <span key={i} className="text-[9px] px-1.5 py-0.5 rounded-full bg-success/10 text-success border border-success/20">{p}</span>
            ))}
          </div>
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground">{turn}/{responses.length} trocas</span>
          <div className="flex-1 h-1 bg-muted rounded-full">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(turn / responses.length) * 100}%` }} />
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={cn('flex gap-2.5', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
            <div className={cn(
              'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
              msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-accent/20 text-accent'
            )}>
              {msg.role === 'user' ? 'V' : '🤖'}
            </div>
            <div className={cn(
              'max-w-[75%] px-3 py-2.5 rounded-2xl text-xs',
              msg.role === 'user'
                ? 'bg-primary text-primary-foreground rounded-tr-sm'
                : 'bg-secondary text-foreground rounded-tl-sm border border-border'
            )}>
              <p className="leading-relaxed">{msg.content}</p>
              <p className={cn('text-[10px] mt-1', msg.role === 'user' ? 'text-primary-foreground/60 text-right' : 'text-muted-foreground')}>
                {new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex gap-2.5">
            <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center text-xs flex-shrink-0">🤖</div>
            <div className="px-3 py-2.5 rounded-2xl bg-secondary border border-border rounded-tl-sm">
              <div className="flex gap-1 items-center h-4">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border flex-shrink-0">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder="Responda ao cliente..."
            className="flex-1 h-9 text-xs bg-secondary border-border"
            disabled={isTyping}
          />
          <button
            onClick={sendMessage}
            disabled={isTyping || !input.trim()}
            className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            <Send className="w-3.5 h-3.5 text-primary-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function TrainingPage() {
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole(['admin', 'director', 'supervisor']);
  const [tab, setTab] = useState<'scenarios' | 'history'>('scenarios');
  const [activeSession, setActiveSession] = useState<TrainingScenario | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const myHistory = MOCK_SESSIONS.filter(s => s.userId === user?.id || isAdmin);
  const avgScore = myHistory.length
    ? Math.round(myHistory.reduce((a, s) => a + s.score, 0) / myHistory.length)
    : 0;

  const DIFF_CONFIG = {
    easy: { label: 'Fácil', class: 'bg-success/10 text-success border-success/20' },
    medium: { label: 'Médio', class: 'bg-warning/10 text-warning border-warning/20' },
    hard: { label: 'Difícil', class: 'bg-destructive/10 text-destructive border-destructive/20' },
  };

  if (activeSession) {
    return (
      <div className="page-container animate-fade-in h-[calc(100vh-56px)] flex flex-col">
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveSession(null)}
              className="w-8 h-8 rounded-lg border border-border hover:bg-muted flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-lg font-display font-bold">{activeSession.title}</h1>
              <p className="text-xs text-muted-foreground">Simulação em andamento</p>
            </div>
          </div>
          <span className={cn('text-xs px-2.5 py-1 rounded-full border font-medium', DIFF_CONFIG[activeSession.difficulty].class)}>
            {DIFF_CONFIG[activeSession.difficulty].label}
          </span>
        </div>
        <div className="flex-1 min-h-0 glass-card overflow-hidden">
          <TrainingChat
            scenario={activeSession}
            onFinish={(_score, _feedback) => setActiveSession(null)}
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
          <p className="text-sm text-muted-foreground">Simulações de vendas com IA em tempo real</p>
        </div>
        {isAdmin && (
          <Button size="sm" className="bg-gradient-primary text-xs h-8" onClick={() => setShowCreate(true)}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Criar Cenário
          </Button>
        )}
      </div>

      {/* Stats row */}
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
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-medium transition-colors',
              tab === t.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
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
                  <span className={cn('text-[10px] px-2 py-0.5 rounded-full border font-medium', DIFF_CONFIG[scenario.difficulty].class)}>
                    {DIFF_CONFIG[scenario.difficulty].label}
                  </span>
                </div>

                <div>
                  <h3 className="font-semibold text-sm mb-1">{scenario.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{scenario.description}</p>
                </div>

                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Foco</p>
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

                <div className="flex items-center justify-between mt-auto pt-2 border-t border-border">
                  {bestScore ? (
                    <span className={cn('text-xs font-semibold', bestScore >= 85 ? 'text-success' : bestScore >= 70 ? 'text-primary' : 'text-warning')}>
                      Melhor: {bestScore} pts
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Não realizado</span>
                  )}
                  <Button
                    size="sm"
                    className="bg-gradient-primary text-xs h-7"
                    onClick={() => setActiveSession(scenario)}
                  >
                    <Play className="w-3 h-3 mr-1" /> Iniciar
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
                    <span className={cn(
                      'text-xs font-bold px-2 py-0.5 rounded-full',
                      session.score >= 85 ? 'bg-success/10 text-success' : session.score >= 70 ? 'bg-primary/10 text-primary' : 'bg-warning/10 text-warning'
                    )}>
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
                    <span className="text-xs text-muted-foreground">
                      {new Date(session.completedAt).toLocaleDateString('pt-BR')}
                    </span>
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
