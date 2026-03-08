import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAppConfig } from '@/contexts/AppConfigContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Plus, Brain, Trophy, Clock, Target,
  X, Play, Sparkles, CheckCircle2, AlertTriangle,
  BookOpen, BarChart3, Mic, MicOff, Volume2, VolumeX,
  Settings, Key, Eye, EyeOff, PhoneOff, Phone,
  Loader2, Waves, MessageSquare
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

interface VoiceMessage {
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

  // Timer
  useEffect(() => {
    if (callState !== 'idle' && callState !== 'finished') {
      timerRef.current = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [callState]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  // Build system prompt
  const buildSystemPrompt = () => `
Você é um cliente em potencial participando de uma simulação de vendas de treinamento.

SUA PERSONA:
${scenario.persona}

CENÁRIO:
${scenario.description}

REGRAS DO ROLEPLAY:
- Fale APENAS como o cliente. Nunca quebre o personagem.
- Responda de forma natural, como numa conversa real de vendas.
- Seja cético mas aberto — não seja impossível, mas não ceda fácil.
- Mantenha respostas curtas (2-4 frases) para fluir como uma call real.
- Após 6-8 trocas, encerre naturalmente dizendo que precisa de tempo ou propondo próximo passo.
- Responda SEMPRE em português brasileiro.
- NÃO mencione que é uma IA ou simulação.
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

    // Try to find a Portuguese voice
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
          max_tokens: 200,
          temperature: 0.8,
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

      // Check if session should end (after many turns or AI signals end)
      const isEnd = historyRef.current.filter(m => m.role === 'user').length >= 8 ||
        /encerr|finaliz|próxima reunião|obrigado pela conversa|até logo/i.test(reply);

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
Você é um coach de vendas especialista. Analise esta simulação de vendas e avalie o vendedor.

CENÁRIO: ${scenario.title}
FOCO: ${scenario.focusPoints.join(', ')}
EVITAR: ${scenario.avoidPoints.join(', ')}

TRANSCRIÇÃO:
${historyRef.current.map(m => `${m.role === 'user' ? 'VENDEDOR' : 'CLIENTE'}: ${m.content}`).join('\n')}

Responda em JSON com:
{
  "score": <número de 0 a 100>,
  "feedback": "<2-3 frases de feedback construtivo em português>"
}
`;
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: evalPrompt }],
          response_format: { type: 'json_object' },
          max_tokens: 200,
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
  }, [callOpenAI, callState]);

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

    // Initial AI greeting
    historyRef.current = [];
    setTranscript([]);
    setElapsedSeconds(0);

    const greeting = `Olá! ${scenario.persona.split('.')[0]}. Pode falar.`;
    const greetingMsg = { role: 'assistant' as const, content: greeting, timestamp: new Date().toISOString() };

    historyRef.current.push({ role: 'assistant', content: greeting });
    setTranscript([greetingMsg]);
    setCallState('speaking');

    speak(greeting, () => startListening());
  }, [apiKey, scenario, speak, startListening, onNeedKey]);

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
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="px-4 py-3 border-b border-border bg-secondary/30 flex items-center justify-between flex-shrink-0">
        <div className="flex-1">
          <p className="text-xs font-semibold">{scenario.title}</p>
          <p className="text-[11px] text-muted-foreground">{scenario.persona}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-wrap gap-1 max-w-[200px]">
            {scenario.focusPoints.slice(0, 2).map((p, i) => (
              <span key={i} className="text-[9px] px-1.5 py-0.5 rounded-full bg-success/10 text-success border border-success/20">{p}</span>
            ))}
          </div>
          {/* Timer */}
          {callState !== 'idle' && (
            <span className="text-xs font-mono font-semibold text-foreground tabular-nums">
              {formatTime(elapsedSeconds)}
            </span>
          )}
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6 relative overflow-hidden">

        {/* Status label */}
        <div className="absolute top-4 left-0 right-0 flex justify-center">
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
              processing: '⚡ IA processando...',
              speaking: '🔊 Cliente respondendo...',
              finished: '✓ Encerrado',
            }[callState]}
          </span>
        </div>

        {/* AI avatar with pulse animation */}
        <div className="relative">
          {/* Outer pulse rings */}
          {(callState === 'speaking') && (
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
            'w-28 h-28 rounded-full flex flex-col items-center justify-center transition-all duration-300 relative z-10 border-4',
            callState === 'idle' ? 'bg-secondary border-border' :
            callState === 'listening' ? 'bg-success/15 border-success/40' :
            callState === 'processing' ? 'bg-primary/15 border-primary/40' :
            callState === 'speaking' ? 'bg-accent/15 border-accent/40' :
            callState === 'connecting' ? 'bg-warning/15 border-warning/40' : 'bg-secondary border-border'
          )}>
            <span className="text-4xl select-none">🧑‍💼</span>
          </div>
        </div>

        {/* Live transcript */}
        <div className="w-full max-w-lg min-h-[80px] flex flex-col items-center justify-center gap-2">
          {/* Last AI message */}
          {transcript.length > 0 && callState === 'speaking' && (
            <div className="w-full p-3 rounded-xl bg-accent/8 border border-accent/20 text-center">
              <p className="text-xs text-muted-foreground font-semibold mb-1">Cliente:</p>
              <p className="text-sm text-foreground leading-relaxed">
                {transcript.filter(m => m.role === 'assistant').slice(-1)[0]?.content}
              </p>
            </div>
          )}

          {/* Processing */}
          {callState === 'processing' && (
            <div className="flex items-center gap-2 text-primary">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-xs">Processando resposta...</span>
            </div>
          )}

          {/* Live user speech */}
          {callState === 'listening' && (
            <div className="w-full">
              {liveText ? (
                <div className="p-3 rounded-xl bg-success/8 border border-success/20 text-center">
                  <p className="text-xs text-muted-foreground font-semibold mb-1">Você:</p>
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
              {/* Mute */}
              <button
                onClick={() => setIsMuted(m => !m)}
                className={cn(
                  'w-12 h-12 rounded-full border flex items-center justify-center transition-all',
                  isMuted
                    ? 'bg-destructive/15 border-destructive/30 text-destructive'
                    : 'bg-secondary border-border text-muted-foreground hover:bg-muted'
                )}
                title={isMuted ? 'Ativar voz da IA' : 'Silenciar voz da IA'}
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>

              {/* Mic button */}
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
                  'w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-lg relative',
                  callState === 'listening'
                    ? 'bg-success text-white scale-110 shadow-success/40'
                    : 'bg-primary text-primary-foreground hover:scale-105',
                  (callState === 'processing' || callState === 'connecting' || callState === 'speaking') && 'opacity-40 cursor-not-allowed scale-100'
                )}
                title={callState === 'listening' ? 'Clique para parar' : 'Clique para falar'}
              >
                {callState === 'listening' ? (
                  <MicOff className="w-7 h-7" />
                ) : (
                  <Mic className="w-7 h-7" />
                )}
              </button>

              {/* End call */}
              <button
                onClick={endSession}
                className="w-12 h-12 rounded-full bg-destructive/15 border border-destructive/30 text-destructive flex items-center justify-center hover:bg-destructive/25 transition-all"
                title="Encerrar simulação"
              >
                <PhoneOff className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        {/* Hint */}
        {callState === 'idle' && (
          <p className="text-xs text-muted-foreground text-center max-w-xs">
            Clique em <strong>Iniciar</strong> para começar a simulação.<br />
            O cliente vai falar primeiro, depois você responde pelo microfone.
          </p>
        )}

        {callState === 'speaking' && (
          <p className="text-xs text-muted-foreground/60 text-center">
            Aguarde o cliente terminar de falar...
          </p>
        )}

        {/* Turn counter */}
        {transcript.length > 0 && callState !== 'finished' && (
          <div className="absolute bottom-4 left-0 right-0 flex justify-center">
            <span className="text-[10px] text-muted-foreground/50">
              {transcript.filter(m => m.role === 'user').length} turnos · {transcript.filter(m => m.role === 'user').length >= 8 ? 'Próximo turno encerra' : `restam ~${8 - transcript.filter(m => m.role === 'user').length}`}
            </span>
          </div>
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
          <div className="max-h-48 overflow-y-auto px-4 pb-3 space-y-2">
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

  // Always use the training token from AppConfig context
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
              <p className="text-xs text-muted-foreground">Simulação por voz em tempo real</p>
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
