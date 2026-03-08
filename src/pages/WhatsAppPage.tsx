import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  MessageSquare, Search, WifiOff, QrCode,
  RefreshCcw, AlertCircle, X, Loader2,
  Smartphone, RefreshCw, Plus, CheckCheck, Send,
  ArrowUpDown, ArrowDownAZ, SortAsc, SortDesc,
  Brain, Sparkles, AlertTriangle, ChevronRight, Star,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  useEvolutionInstances,
  getInstanceForUser,
  type EvolutionInstance,
} from '@/hooks/useEvolutionInstances';
import { MOCK_USERS, MOCK_TEAMS } from '@/data/mockData';
import { useAppConfig } from '@/contexts/AppConfigContext';
import { AI_CONFIG_STORAGE, DEFAULT_WHATSAPP_CRITERIA } from '@/pages/AIConfigPage';

const EVOLUTION_API_URL = 'https://evolutionapic.contato-lojavirtual.com';
const EVOLUTION_API_TOKEN = '3ce7a42f9bd96ea526b2b0bc39a4faec';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Chat {
  id: string;
  remoteJid: string;
  remoteJidAlt?: string; // phone JID when remoteJid is @lid
  name: string;
  phone: string;
  lastMessage: string;
  lastMessageTs: number;
  lastMessageFromMe: boolean; // used to detect new incoming msgs on poll
  unread: number;
}

interface Message {
  id: string;
  fromMe: boolean;
  body: string;
  timestamp: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function evoFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${EVOLUTION_API_URL}${path}`, {
    ...options,
    headers: {
      apikey: EVOLUTION_API_TOKEN,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ─── QR Code Modal ────────────────────────────────────────────────────────────
function QRCodeModal({ instanceName, onClose }: { instanceName: string; onClose: () => void }) {
  const { toast } = useToast();
  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const generate = useCallback(async () => {
    setLoading(true);
    setQrBase64(null);
    try {
      const data = await evoFetch(`/instance/connect/${instanceName}`);
      const b64 = data?.base64 || data?.qrcode?.base64 || null;
      if (b64) setQrBase64(b64);
      else toast({ title: 'Instância já conectada', description: 'Esta instância já está online.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao gerar QR Code', description: e.message });
    } finally { setLoading(false); }
  }, [instanceName]);

  useEffect(() => { generate(); }, [generate]);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            <QrCode className="w-4 h-4 text-primary" /> Conectar — {instanceName}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-2">
          <p className="text-xs text-muted-foreground text-center">
            WhatsApp → Dispositivos vinculados → Vincular dispositivo
          </p>
          <div className="w-52 h-52 bg-secondary rounded-2xl border border-border flex items-center justify-center overflow-hidden">
            {loading
              ? <Loader2 className="w-8 h-8 text-primary animate-spin" />
              : qrBase64
                ? <img src={qrBase64} alt="QR Code" className="w-48 h-48 object-contain" />
                : <QrCode className="w-12 h-12 text-muted-foreground/30" />}
          </div>
          <p className="text-[10px] text-muted-foreground">QR Code expira em 60 segundos</p>
          <Button size="sm" className="w-full h-9 text-xs" onClick={generate} disabled={loading}>
            {loading
              ? <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" />Gerando...</>
              : <><RefreshCcw className="w-3 h-3 mr-1.5" />{qrBase64 ? 'Regenerar' : 'Gerar QR Code'}</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Create Instance Modal ────────────────────────────────────────────────────
function CreateInstanceModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return toast({ variant: 'destructive', title: 'Informe um nome para a instância.' });
    setLoading(true);
    try {
      await evoFetch('/instance/create', {
        method: 'POST',
        body: JSON.stringify({ instanceName: name.trim(), integration: 'WHATSAPP-BAILEYS' }),
      });
      toast({ title: 'Instância criada!', description: `${name.trim()} criada com sucesso.` });
      onCreated();
      onClose();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao criar instância', description: e.message });
    } finally { setLoading(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            <Plus className="w-4 h-4 text-primary" /> Criar Instância Evolution
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div>
            <label className="text-xs font-medium block mb-1.5">Nome da instância</label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: BDR_NomeVendedor"
              className="h-9 text-xs bg-secondary border-border font-mono"
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" className="flex-1 text-xs h-9" onClick={handleCreate} disabled={loading || !name.trim()}>
              {loading ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Criando...</> : <><Plus className="w-3.5 h-3.5 mr-1.5" />Criar</>}
            </Button>
            <Button size="sm" variant="outline" className="text-xs border-border h-9" onClick={onClose}>Cancelar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Status Dot ───────────────────────────────────────────────────────────────
const StatusDot = ({ status, className }: { status: string; className?: string }) => {
  const isOpen = status === 'open' || status === 'connected';
  const isWaiting = status === 'connecting' || status === 'qrcode';
  return (
    <span className={cn(
      'w-2.5 h-2.5 rounded-full flex-shrink-0 inline-block border-2 border-background',
      isOpen ? 'bg-success' : isWaiting ? 'bg-warning animate-pulse' : 'bg-muted-foreground/40',
      className
    )} />
  );
};

// ─── Avatar Initials ──────────────────────────────────────────────────────────
const AvatarInitials = ({ name, size = 'md', src }: { name: string; size?: 'sm' | 'md' | 'lg'; src?: string }) => {
  const sizeClass = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-12 h-12 text-base' : 'w-10 h-10 text-sm';
  if (src) return <img src={src} className={cn(sizeClass, 'rounded-full object-cover border border-border flex-shrink-0')} alt="" />;
  return (
    <div className={cn(sizeClass, 'rounded-full bg-primary/15 text-primary font-bold flex items-center justify-center flex-shrink-0')}>
      {(name || '?')[0].toUpperCase()}
    </div>
  );
};

// ─── AI Analysis Panel ────────────────────────────────────────────────────────
interface CriteriaScore { id: string; label: string; weight: number; score: number; feedback: string; }
interface AIAnalysisResult {
  totalScore: number;
  summary: string;
  insights: string;
  criticalAlerts: string[];
  criteriaScores: CriteriaScore[];
  analyzedAt: string;
}

function AIAnalysisPanel({
  chat,
  messages,
  apiToken,
}: {
  chat: { id: string; name: string; phone: string };
  messages: { fromMe: boolean; body: string; timestamp: number }[];
  apiToken: string;
}) {
  const { toast } = useToast();
  const [result, setResult] = useState<AIAnalysisResult | null>(() => {
    try {
      const stored = localStorage.getItem(`appmax_ai_analysis_${chat.id}`);
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });
  const [loading, setLoading] = useState(false);

  // Load cached result when chat changes
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`appmax_ai_analysis_${chat.id}`);
      setResult(stored ? JSON.parse(stored) : null);
    } catch { setResult(null); }
  }, [chat.id]);

  const loadCriteria = () => {
    try {
      const stored = localStorage.getItem(AI_CONFIG_STORAGE.WHATSAPP_CRITERIA);
      return stored ? JSON.parse(stored) : DEFAULT_WHATSAPP_CRITERIA;
    } catch { return DEFAULT_WHATSAPP_CRITERIA; }
  };
  const loadPrompt = () => {
    try {
      const stored = localStorage.getItem(AI_CONFIG_STORAGE.WHATSAPP_PROMPT);
      return stored ? JSON.parse(stored) : 'Você é um especialista em vendas digitais e atendimento via WhatsApp. Avalie as conversas com foco em efetividade comercial, qualificação de leads e conversão.';
    } catch { return 'Você é um especialista em vendas digitais e atendimento via WhatsApp.'; }
  };

  const analyze = async () => {
    if (!apiToken) {
      toast({ variant: 'destructive', title: 'Token OpenAI não configurado', description: 'Configure o token em Config. IA → Integrações.' });
      return;
    }
    if (messages.length === 0) {
      toast({ variant: 'destructive', title: 'Sem mensagens', description: 'Não há mensagens para analisar.' });
      return;
    }
    setLoading(true);
    try {
      const criteria = loadCriteria();
      const systemPrompt = loadPrompt();
      const transcript = messages.map(m =>
        `[${m.fromMe ? 'VENDEDOR' : 'LEAD'}] ${m.body}`
      ).join('\n');

      const criteriaText = criteria.map((c: any) =>
        `- ${c.label} (peso ${c.weight}%): ${c.description}. Sinais positivos: ${c.positiveSignals?.join(', ') || 'N/A'}. Sinais negativos: ${c.negativeSignals?.join(', ') || 'N/A'}.`
      ).join('\n');

      const userPrompt = `Analise a seguinte conversa de WhatsApp entre um vendedor e um lead.

CRITÉRIOS DE AVALIAÇÃO:
${criteriaText}

CONVERSA:
${transcript}

Responda APENAS com JSON válido no seguinte formato (sem markdown, sem explicações):
{
  "totalScore": <número 0-100>,
  "summary": "<resumo conciso da conversa em 2-3 frases>",
  "insights": "<insights principais sobre a qualidade do atendimento em 2-3 frases>",
  "criticalAlerts": ["<alerta 1 se houver>", "<alerta 2 se houver>"],
  "criteriaScores": [
    { "id": "<id do critério>", "label": "<nome>", "weight": <peso>, "score": <0-100>, "feedback": "<feedback específico>" }
  ]
}`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens: 1500,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error?.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const raw = data.choices?.[0]?.message?.content || '';
      // Strip possible markdown fences
      const jsonStr = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed: AIAnalysisResult = { ...JSON.parse(jsonStr), analyzedAt: new Date().toISOString() };
      setResult(parsed);
      localStorage.setItem(`appmax_ai_analysis_${chat.id}`, JSON.stringify(parsed));
      toast({ title: '✓ Análise concluída!', description: `Score: ${parsed.totalScore}/100` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro na análise', description: e.message });
    } finally {
      setLoading(false);
    }
  };

  const scoreColor = (s: number) =>
    s >= 85 ? 'text-success' : s >= 70 ? 'text-primary' : s >= 50 ? 'text-warning' : 'text-destructive';
  const scoreBg = (s: number) =>
    s >= 85 ? 'bg-success/10 border-success/20' : s >= 70 ? 'bg-primary/10 border-primary/20' : s >= 50 ? 'bg-warning/10 border-warning/20' : 'bg-destructive/10 border-destructive/20';

  return (
    <div className="w-[280px] flex-shrink-0 bg-card border-l border-border flex flex-col">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-border flex-shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Brain className="w-3.5 h-3.5 text-accent" />
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Análise IA</p>
        </div>
        <Button
          size="sm"
          className="h-7 text-[10px] bg-gradient-primary px-2 gap-1"
          onClick={analyze}
          disabled={loading}>
          {loading
            ? <><Loader2 className="w-3 h-3 animate-spin" /> Analisando...</>
            : <><Sparkles className="w-3 h-3" /> {result ? 'Re-analisar' : 'Analisar'}</>}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {!result && !loading && (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center text-muted-foreground gap-3">
            <Brain className="w-10 h-10 opacity-15" />
            <p className="text-xs font-medium">Nenhuma análise ainda</p>
            <p className="text-[10px] text-muted-foreground/70">
              Clique em "Analisar" para avaliar esta conversa com base nos critérios definidos na Config. IA
            </p>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center gap-3">
            <div className="relative">
              <Brain className="w-10 h-10 text-accent/30" />
              <Loader2 className="w-5 h-5 text-accent animate-spin absolute -bottom-1 -right-1" />
            </div>
            <p className="text-xs text-muted-foreground">Analisando conversa com IA...</p>
          </div>
        )}

        {result && !loading && (
          <div className="p-3 space-y-3">
            {/* Score total */}
            <div className={cn('rounded-xl p-3 border text-center', scoreBg(result.totalScore))}>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Score Total</p>
              <p className={cn('text-3xl font-bold font-mono', scoreColor(result.totalScore))}>
                {result.totalScore}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">/ 100</p>
            </div>

            {/* Alertas críticos */}
            {result.criticalAlerts && result.criticalAlerts.length > 0 && (
              <div className="rounded-xl p-3 border bg-destructive/5 border-destructive/20">
                <div className="flex items-center gap-1.5 mb-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
                  <p className="text-[10px] font-semibold text-destructive uppercase tracking-wide">Alertas Críticos</p>
                </div>
                <div className="space-y-1.5">
                  {result.criticalAlerts.map((a, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <ChevronRight className="w-3 h-3 text-destructive flex-shrink-0 mt-0.5" />
                      <p className="text-[10px] text-muted-foreground leading-snug">{a}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Resumo */}
            <div className="rounded-xl p-3 border border-border bg-secondary/50">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Resumo</p>
              <p className="text-[11px] text-foreground/80 leading-snug">{result.summary}</p>
            </div>

            {/* Insights */}
            <div className="rounded-xl p-3 border border-accent/20 bg-accent/5">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Star className="w-3 h-3 text-accent" />
                <p className="text-[10px] font-semibold uppercase tracking-wide text-accent">Insights</p>
              </div>
              <p className="text-[11px] text-foreground/80 leading-snug">{result.insights}</p>
            </div>

            {/* Critérios */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Critérios</p>
              <div className="space-y-2">
                {result.criteriaScores?.map(c => (
                  <div key={c.id} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium">{c.label}</span>
                      <span className={cn('text-[11px] font-bold font-mono', scoreColor(c.score))}>{c.score}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all', c.score >= 85 ? 'bg-success' : c.score >= 70 ? 'bg-primary' : c.score >= 50 ? 'bg-warning' : 'bg-destructive')}
                        style={{ width: `${c.score}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-snug">{c.feedback}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <p className="text-[9px] text-muted-foreground/50 text-center pt-1">
              Analisado em {new Date(result.analyzedAt).toLocaleString('pt-BR')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function WhatsAppPage() {
  const { user, hasRole } = useAuth();
  const { toast } = useToast();
  const isAdmin = hasRole(['admin', 'director', 'supervisor']);
  const { instances: evoInstances, loading: evoLoading, refetch: refetchEvo } = useEvolutionInstances();
  const { tokens } = useAppConfig();

  const [showCreateInst, setShowCreateInst] = useState(false);
  const [qrInstanceName, setQrInstanceName] = useState<string | null>(null);
  const [showAiPanel, setShowAiPanel] = useState(false);

  // ── Instance filters ────────────────────────────────────────────────────────
  type InstStatusFilter = 'all' | 'connected' | 'disconnected';
  type InstSortKey = 'recent' | 'alpha';
  type SortDir = 'asc' | 'desc';
  const [instStatusFilter, setInstStatusFilter] = useState<InstStatusFilter>('all');
  const [instSortKey, setInstSortKey] = useState<InstSortKey>('recent');
  const [instSortDir, setInstSortDir] = useState<SortDir>('desc');
  const [instTeamFilter, setInstTeamFilter] = useState<string>('all');

  // Filter instances for non-admins
  const baseInstances = evoInstances.filter(i => {
    if (!isAdmin) return getInstanceForUser(user?.id || '') === i.name;
    return true;
  });

  // Helper: find team for an instance by looking up the assigned user's teamId
  const getInstTeamId = (instName: string): string | null => {
    const assignedUser = MOCK_USERS.find(u => getInstanceForUser(u.id) === instName);
    return assignedUser?.teamId ?? null;
  };

  const visibleInstances = (() => {
    let list = baseInstances.filter(i => {
      if (instStatusFilter === 'connected') return i.connectionStatus === 'open';
      if (instStatusFilter === 'disconnected') return i.connectionStatus !== 'open';
      return true;
    }).filter(i => {
      if (instTeamFilter === 'all') return true;
      if (instTeamFilter === 'unassigned') return !getInstTeamId(i.name);
      return getInstTeamId(i.name) === instTeamFilter;
    });
    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (instSortKey === 'alpha') {
        cmp = (a.profileName || a.name).localeCompare(b.profileName || b.name, 'pt-BR');
      } else {
        cmp = (b._count?.Message || 0) - (a._count?.Message || 0);
      }
      return instSortDir === 'asc' ? -cmp : cmp;
    });
    return list;
  })();

  // ── Column 1: selected instance ────────────────────────────────────────────
  const [activeInstance, setActiveInstance] = useState<EvolutionInstance | null>(null);

  // Auto-select first instance
  useEffect(() => {
    if (visibleInstances.length > 0 && !activeInstance) {
      setActiveInstance(visibleInstances[0]);
    }
  }, [visibleInstances.length]);

  // ── Column 2: chats for selected instance ──────────────────────────────────
  type ChatFilter = 'all' | 'pending' | 'unreplied' | 'replied';
  type ChatSortKey = 'recent' | 'oldest' | 'alpha_asc' | 'alpha_desc';
  const [chats, setChats] = useState<Chat[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [chatSearch, setChatSearch] = useState('');
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [chatFilter, setChatFilter] = useState<ChatFilter>('all');
  const [chatSortKey, setChatSortKey] = useState<ChatSortKey>('recent');

  // resolvePhone: for @lid JIDs, use the @lid number itself as the unique identifier.
  const parseBody = (m: any): string => {
    const msg = m.message || {};
    return (
      msg.conversation ||
      msg.extendedTextMessage?.text ||
      msg.imageMessage?.caption ||
      msg.videoMessage?.caption ||
      msg.documentMessage?.title ||
      (msg.audioMessage ? '🎵 Áudio' : '') ||
      (msg.stickerMessage ? '🪄 Sticker' : '') ||
      (msg.locationMessage ? '📍 Localização' : '') ||
      '[mídia]'
    );
  };

  // For @lid chats, the real phone number is in lastMessage.key.remoteJidAlt.
  // We use it as the dedup key so @lid and @s.whatsapp.net entries merge into one chat.
  const getDedupeKey = (c: any): string => {
    const jid: string = c.remoteJid || '';
    if (jid.includes('@lid')) {
      const alt: string = c.lastMessage?.key?.remoteJidAlt || '';
      if (alt) return alt.replace(/@.*/, ''); // real phone → same key as @s.whatsapp.net entry
    }
    return jid.replace(/@.*/, '');
  };

  const loadChats = useCallback(async (instanceName: string, silent = false) => {
    if (!silent) {
      setLoadingChats(true);
      setChats([]);
    }
    try {
      const data = await evoFetch(`/chat/findChats/${instanceName}`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const raw: any[] = Array.isArray(data) ? data : (data?.chats || []);

      // Key = real phone number (same for both @lid and @s.whatsapp.net of same contact)
      const phoneMap = new Map<string, Chat>();

      for (const c of raw) {
        const key = getDedupeKey(c);
        if (!key) continue;

        const jid: string = c.remoteJid || c.id || '';
        const isLid = jid.includes('@lid');
        const ts =
          c.lastMessage?.messageTimestamp ||
          (c.updatedAt ? Math.floor(new Date(c.updatedAt).getTime() / 1000) : 0);

        const fromMe: boolean = c.lastMessage?.key?.fromMe === true;

        // Real phone: for @lid use remoteJidAlt number, for @s.whatsapp.net use jid number
        const realPhone = isLid
          ? (c.lastMessage?.key?.remoteJidAlt || '').replace(/@.*/, '') || key
          : jid.replace(/@.*/, '');

        const name = c.name || c.pushName || c.lastMessage?.pushName || '';
        const lastMsg =
          c.lastMessage?.message?.conversation ||
          c.lastMessage?.message?.extendedTextMessage?.text || '';

        const existing = phoneMap.get(key);

        if (!existing) {
          phoneMap.set(key, {
            id: jid,
            remoteJid: jid,
            remoteJidAlt: undefined,
            phone: realPhone,
            name: name || realPhone || key,
            lastMessage: lastMsg,
            lastMessageTs: ts,
            lastMessageFromMe: fromMe,
            unread: c.unreadCount || 0,
          });
        } else {
          // Merge — always prefer @lid as primary (has received msgs), phone JID as alt (has sent msgs)
          const existingIsLid = existing.remoteJid.includes('@lid');
          const betterName = name || existing.name;
          const betterTs = Math.max(ts, existing.lastMessageTs);
          const newerIsThis = ts >= existing.lastMessageTs;
          const betterMsg = newerIsThis ? (lastMsg || existing.lastMessage) : existing.lastMessage;
          const betterFromMe = newerIsThis ? fromMe : existing.lastMessageFromMe;

          const merged: Chat = {
            ...existing,
            name: betterName || existing.phone,
            lastMessage: betterMsg,
            lastMessageTs: betterTs,
            lastMessageFromMe: betterFromMe,
            unread: Math.max(c.unreadCount || 0, existing.unread),
            phone: realPhone || existing.phone,
          };

          if (isLid && !existingIsLid) {
            merged.id = jid;
            merged.remoteJid = jid;
            merged.remoteJidAlt = existing.remoteJid;
          } else if (!isLid && existingIsLid) {
            merged.remoteJidAlt = jid;
          }

          phoneMap.set(key, merged);
        }
      }

      const sorted = Array.from(phoneMap.values()).sort((a, b) => b.lastMessageTs - a.lastMessageTs);

      if (silent) {
        // On silent poll: detect new incoming messages by comparing timestamps
        setChats(prev => {
          const prevMap = new Map(prev.map(c => [c.id, c]));
          return sorted.map(newChat => {
            const isOpen = activeChatRef.current?.id === newChat.id;
            if (isOpen) return { ...newChat, unread: 0 };
            const old = prevMap.get(newChat.id);
            // New message arrived and it's from the contact (not from me) → increment unread
            if (old && newChat.lastMessageTs > old.lastMessageTs && !newChat.lastMessageFromMe) {
              return { ...newChat, unread: old.unread + 1 };
            }
            // Keep existing unread count (don't reset it based on API null)
            return { ...newChat, unread: old ? old.unread : newChat.unread };
          });
        });
      } else {
        setChats(sorted.slice(0, 200));
      }
    } catch {
      if (!silent) setChats([]);
    } finally {
      if (!silent) setLoadingChats(false);
    }
  }, []);

  useEffect(() => {
    if (activeInstance?.connectionStatus === 'open') {
      loadChats(activeInstance.name);
    } else {
      setChats([]);
    }
    setActiveChat(null);
    setMessages([]);
  }, [activeInstance?.name]);

  // Poll chat list every 10s to update unread counts and new conversations
  useEffect(() => {
    if (!activeInstance || activeInstance.connectionStatus !== 'open') return;
    const t = setInterval(() => loadChats(activeInstance.name, true), 3000);
    return () => clearInterval(t);
  }, [activeInstance?.name, activeInstance?.connectionStatus]);



  const filteredChats = (() => {
    let list = chats.filter(c =>
      c.name.toLowerCase().includes(chatSearch.toLowerCase()) ||
      c.phone.includes(chatSearch) ||
      c.lastMessage.toLowerCase().includes(chatSearch.toLowerCase())
    );

    // Status filter
    if (chatFilter === 'pending') {
      list = list.filter(c => c.unread > 0);
    } else if (chatFilter === 'unreplied') {
      // Last message is from the lead (not from me) AND unread === 0 (already seen)
      list = list.filter(c => !c.lastMessageFromMe && c.unread === 0);
    } else if (chatFilter === 'replied') {
      list = list.filter(c => c.lastMessageFromMe);
    }

    // Sort
    list = [...list].sort((a, b) => {
      if (chatSortKey === 'oldest') return a.lastMessageTs - b.lastMessageTs;
      if (chatSortKey === 'alpha_asc') return (a.name || a.phone).localeCompare(b.name || b.phone, 'pt-BR');
      if (chatSortKey === 'alpha_desc') return (b.name || b.phone).localeCompare(a.name || a.phone, 'pt-BR');
      return b.lastMessageTs - a.lastMessageTs; // 'recent' default
    });

    return list;
  })();


  const displayName = (c: Chat) => (c.name && c.name !== c.phone ? c.name : c.phone);

  // ── Column 3: messages ─────────────────────────────────────────────────────
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Ref to track active chat inside polling callbacks without stale closure
  const activeChatRef = useRef<Chat | null>(null);
  useEffect(() => { activeChatRef.current = activeChat; }, [activeChat]);

  // loadMessages: fetches from BOTH @lid (received) and @s.whatsapp.net (sent) JIDs and merges
  const loadMessages = useCallback(async (
    instanceName: string,
    chat: Chat,
    scroll = false,
  ) => {
    if (scroll) setLoadingMsgs(true);
    try {
      // Build list of JIDs to query
      const jids = [chat.remoteJid];
      if (chat.remoteJidAlt) jids.push(chat.remoteJidAlt);

      const results = await Promise.all(
        jids.map(jid =>
          evoFetch(`/chat/findMessages/${instanceName}`, {
            method: 'POST',
            body: JSON.stringify({ where: { key: { remoteJid: jid } }, limit: 60 }),
          }).catch(() => null)
        )
      );

      const seen = new Set<string>();
      const parsed: Message[] = [];

      for (const data of results) {
        if (!data) continue;
        const raw: any[] = Array.isArray(data?.messages?.records)
          ? data.messages.records
          : Array.isArray(data) ? data : [];

        for (const m of raw) {
          if (m.messageType === 'protocolMessage' || m.messageType === 'reactionMessage') continue;
          const msgId = m.key?.id || m.id;
          if (!msgId || seen.has(msgId)) continue;
          seen.add(msgId);
          parsed.push({
            id: msgId,
            fromMe: m.key?.fromMe === true,
            body: parseBody(m),
            timestamp: m.messageTimestamp || 0,
          });
        }
      }

      parsed.sort((a, b) => a.timestamp - b.timestamp);
      setMessages(parsed);
    } catch { /* silent */ }
    finally { if (scroll) setLoadingMsgs(false); }
  }, []);

  useEffect(() => {
    if (!activeChat || !activeInstance) return;
    loadMessages(activeInstance.name, activeChat, true);
  }, [activeChat?.id, activeInstance?.name]);

  // Real-time poll every 3s
  useEffect(() => {
    if (!activeChat || !activeInstance || activeInstance.connectionStatus !== 'open') return;
    const t = setInterval(
      () => loadMessages(activeInstance.name, activeChat, false),
      3000,
    );
    return () => clearInterval(t);
  }, [activeChat?.id, activeInstance?.name]);


  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || !activeChat || !activeInstance) return;
    setSending(true);
    try {
      await evoFetch(`/message/sendText/${activeInstance.name}`, {
        method: 'POST',
        body: JSON.stringify({ number: activeChat.phone || activeChat.remoteJid, text }),
      });
      setInputText('');
      await loadMessages(activeInstance.name, activeChat, false);
      inputRef.current?.focus();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao enviar', description: e.message });
    } finally { setSending(false); }
  };

  const isConnected = activeInstance?.connectionStatus === 'open';
  const onlineCount = visibleInstances.filter(i => i.connectionStatus === 'open').length;

  return (
    <div className="page-container animate-fade-in h-[calc(100vh-56px)] flex flex-col">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-display font-bold">WhatsApp</h1>
          <p className="text-sm text-muted-foreground">{onlineCount} online · {visibleInstances.length} total</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button size="sm" variant="outline" className="text-xs h-8 border-border gap-1" onClick={() => setShowCreateInst(true)}>
              <Plus className="w-3.5 h-3.5" /> Nova Instância
            </Button>
          )}
          <Button size="sm" variant="outline" className="text-xs h-8 border-border" onClick={() => { refetchEvo(); if (activeInstance?.connectionStatus === 'open') loadChats(activeInstance.name, true); }} disabled={evoLoading}>
            {evoLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>

      {/* ── 3-column layout ────────────────────────────────────────────────── */}
      <div className="flex-1 flex min-h-0 gap-0 rounded-xl overflow-hidden border border-border">

        {/* ════ COLUMN 1 — INSTANCES ════════════════════════════════════════ */}
        <div className="w-[220px] flex-shrink-0 bg-card border-r border-border flex flex-col">
          {/* Header */}
          <div className="px-3 py-2.5 border-b border-border flex-shrink-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5" /> Instâncias
            </p>
          </div>
          {/* Instance status filter */}
          <div className="px-2 py-1.5 border-b border-border flex-shrink-0 flex gap-1">
            {(['all', 'connected', 'disconnected'] as const).map(f => {
              const labels = { all: 'Todas', connected: 'Online', disconnected: 'Offline' };
              const count = f === 'all' ? baseInstances.length
                : f === 'connected' ? baseInstances.filter(i => i.connectionStatus === 'open').length
                : baseInstances.filter(i => i.connectionStatus !== 'open').length;
              return (
                <button
                  key={f}
                  onClick={() => setInstStatusFilter(f)}
                  className={cn(
                    'flex-1 text-[10px] rounded-md px-1 py-1 font-medium transition-colors',
                    instStatusFilter === f
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-muted-foreground hover:text-foreground'
                  )}>
                  {labels[f]} <span className="opacity-70">({count})</span>
                </button>
              );
            })}
          </div>
          {/* Instance sort */}
          <div className="px-2 py-1.5 border-b border-border flex-shrink-0 flex items-center gap-1">
            <button
              onClick={() => setInstSortKey(k => k === 'recent' ? 'alpha' : 'recent')}
              className="flex-1 flex items-center justify-center gap-1 text-[10px] bg-secondary rounded-md py-1 text-muted-foreground hover:text-foreground transition-colors">
              {instSortKey === 'alpha' ? <ArrowDownAZ className="w-3 h-3" /> : <ArrowUpDown className="w-3 h-3" />}
              {instSortKey === 'alpha' ? 'A–Z' : 'Recente'}
            </button>
            <button
              onClick={() => setInstSortDir(d => d === 'asc' ? 'desc' : 'asc')}
              className="flex items-center justify-center gap-1 text-[10px] bg-secondary rounded-md py-1 px-2 text-muted-foreground hover:text-foreground transition-colors">
              {instSortDir === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />}
              {instSortDir === 'asc' ? 'ASC' : 'DESC'}
            </button>
          </div>

          {/* Team filter — admins only */}
          {isAdmin && (
            <div className="px-2 py-1.5 border-b border-border flex-shrink-0">
              <select
                value={instTeamFilter}
                onChange={e => setInstTeamFilter(e.target.value)}
                className="w-full text-[10px] bg-secondary text-muted-foreground rounded-md px-2 py-1.5 border border-border focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer">
                <option value="all">🏷 Todos os times</option>
                {MOCK_TEAMS.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
                <option value="unassigned">Sem time</option>
              </select>
            </div>
          )}

          {/* Instances List */}
          <div className="flex-1 overflow-y-auto">
            {evoLoading && (
              <div className="flex items-center justify-center gap-2 p-4 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /><span className="text-xs">Carregando...</span>
              </div>
            )}
            {visibleInstances.map(inst => {
              const isOpen = inst.connectionStatus === 'open';
              const phone = inst.ownerJid?.replace('@s.whatsapp.net', '');
              const assignedUser = MOCK_USERS.find(u => getInstanceForUser(u.id) === inst.name);
              const isActive = activeInstance?.name === inst.name;
              return (
                <button
                  key={inst.id}
                  onClick={() => setActiveInstance(inst)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-3 text-left transition-colors border-b border-border/40',
                    isActive ? 'bg-primary/10 border-l-2 border-l-primary' : 'hover:bg-muted/40 border-l-2 border-l-transparent'
                  )}>
                  <div className="relative flex-shrink-0">
                    <AvatarInitials name={inst.profileName || inst.name} size="sm" src={inst.profilePicUrl} />
                    <StatusDot status={inst.connectionStatus} className="absolute -bottom-0.5 -right-0.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate leading-tight">{inst.profileName || inst.name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono truncate">{phone || inst.name}</p>
                    {assignedUser && (
                      <p className="text-[10px] text-muted-foreground/70 truncate mt-0.5">{assignedUser.name}</p>
                    )}
                  </div>
                </button>
              );
            })}
            {!evoLoading && visibleInstances.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground px-3 text-center">
                <Smartphone className="w-8 h-8 opacity-20 mb-2" />
                <p className="text-xs">Nenhuma instância</p>
                {isAdmin && (
                  <Button size="sm" variant="outline" className="text-xs mt-3 h-7 border-border" onClick={() => setShowCreateInst(true)}>
                    <Plus className="w-3 h-3 mr-1" /> Criar
                  </Button>
                )}
              </div>
            )}
          </div>
          {/* QR connect button at bottom if selected instance is offline */}
          {activeInstance && !isConnected && (
            <div className="p-3 border-t border-border flex-shrink-0">
              <Button
                size="sm" variant="outline"
                className="w-full text-xs h-8 border-border gap-1"
                onClick={() => setQrInstanceName(activeInstance.name)}>
                <QrCode className="w-3.5 h-3.5" /> Conectar via QR
              </Button>
            </div>
          )}
        </div>

        {/* ════ COLUMN 2 — CONVERSATIONS ════════════════════════════════════ */}
        <div className="w-[280px] flex-shrink-0 bg-card border-r border-border flex flex-col">
          {/* Header */}
          <div className="px-3 py-2.5 border-b border-border flex-shrink-0 flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
              {activeInstance ? (activeInstance.profileName || activeInstance.name) : 'Conversas'}
            </p>
            {activeInstance && isConnected && (
              <button
                onClick={() => loadChats(activeInstance.name, true)}
                className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
                <RefreshCw className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Search */}
          <div className="px-2 py-1.5 border-b border-border flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={chatSearch}
                onChange={e => setChatSearch(e.target.value)}
                placeholder="Buscar conversa..."
                className="h-8 text-xs pl-7 bg-secondary border-border"
              />
            </div>
          </div>

          {/* Chat status filters */}
          <div className="px-2 py-1.5 border-b border-border flex-shrink-0 flex gap-1">
            {([
              { key: 'all',       label: 'Todas' },
              { key: 'pending',   label: 'Pendentes' },
              { key: 'unreplied', label: 'N. Resp.' },
              { key: 'replied',   label: 'Respond.' },
            ] as const).map(f => {
              const count = f.key === 'all' ? chats.length
                : f.key === 'pending' ? chats.filter(c => c.unread > 0).length
                : f.key === 'unreplied' ? chats.filter(c => !c.lastMessageFromMe && c.unread === 0).length
                : chats.filter(c => c.lastMessageFromMe).length;
              return (
                <button
                  key={f.key}
                  onClick={() => setChatFilter(f.key)}
                  className={cn(
                    'flex-1 text-[10px] rounded-md px-1 py-1 font-medium transition-colors leading-tight',
                    chatFilter === f.key
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-muted-foreground hover:text-foreground'
                  )}>
                  {f.label}
                  {count > 0 && <span className="opacity-70"> ({count})</span>}
                </button>
              );
            })}
          </div>

          {/* Chat sort */}
          <div className="px-2 py-1.5 border-b border-border flex-shrink-0 flex gap-1">
            {([
              { key: 'recent',     label: 'Recente ↓' },
              { key: 'oldest',     label: 'Antigo ↑' },
              { key: 'alpha_asc',  label: 'A–Z' },
              { key: 'alpha_desc', label: 'Z–A' },
            ] as const).map(s => (
              <button
                key={s.key}
                onClick={() => setChatSortKey(s.key)}
                className={cn(
                  'flex-1 text-[10px] rounded-md px-1 py-1 font-medium transition-colors',
                  chatSortKey === s.key
                    ? 'bg-secondary text-foreground border border-border'
                    : 'text-muted-foreground hover:text-foreground'
                )}>
                {s.label}
              </button>
            ))}
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto">
            {!activeInstance && (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <Smartphone className="w-7 h-7 opacity-20 mb-2" />
                <p className="text-xs">Selecione uma instância</p>
              </div>
            )}
            {activeInstance && !isConnected && (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground px-3 text-center">
                <WifiOff className="w-7 h-7 opacity-20 mb-2" />
                <p className="text-xs mb-2">Instância offline</p>
                <Button size="sm" variant="outline" className="text-xs h-7 border-border gap-1"
                  onClick={() => setQrInstanceName(activeInstance.name)}>
                  <QrCode className="w-3 h-3" /> Conectar
                </Button>
              </div>
            )}
            {isConnected && loadingChats && (
              <div className="flex items-center justify-center gap-2 p-6 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /><span className="text-xs">Carregando...</span>
              </div>
            )}
            {isConnected && !loadingChats && filteredChats.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <MessageSquare className="w-7 h-7 opacity-20 mb-2" />
                <p className="text-xs">Nenhuma conversa</p>
              </div>
            )}
            {filteredChats.map(chat => {
              const hasUnread = activeChat?.id !== chat.id && chat.unread > 0;
              return (
              <button
                key={chat.id}
                onClick={() => {
                  setActiveChat(chat);
                  setChats(prev => prev.map(c => c.id === chat.id ? { ...c, unread: 0 } : c));
                }}
                className={cn(
                  'w-full flex items-start gap-2.5 px-3 py-3 text-left border-b border-border/40 transition-colors',
                  activeChat?.id === chat.id ? 'bg-primary/10 border-l-2 border-l-primary' : 'hover:bg-muted/30 border-l-2 border-l-transparent'
                )}>
                <div className="relative flex-shrink-0 mt-0.5">
                  <AvatarInitials name={displayName(chat)} size="sm" />
                  {hasUnread && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full bg-success border-2 border-background flex items-center justify-center text-[9px] text-white font-bold px-0.5">
                      {chat.unread > 99 ? '99+' : chat.unread}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <p className={cn('text-xs font-semibold truncate', hasUnread ? 'text-foreground' : 'text-foreground/80')}>
                      {displayName(chat)}
                    </p>
                    <span className={cn('text-[10px] flex-shrink-0', hasUnread ? 'text-success font-semibold' : 'text-muted-foreground')}>
                      {chat.lastMessageTs
                        ? new Date(chat.lastMessageTs * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                        : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {!chat.lastMessageFromMe && chat.unread === 0 && (
                      <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-warning" title="Não respondida" />
                    )}
                    <p className={cn('text-[11px] truncate', hasUnread ? 'text-foreground font-medium' : 'text-muted-foreground')}>
                      {chat.lastMessage || chat.phone}
                    </p>
                  </div>
                  {chat.name && chat.name !== chat.phone && (
                    <p className="text-[10px] text-muted-foreground/50 font-mono truncate">{chat.phone}</p>
                  )}
                </div>
              </button>
              );
            })}
          </div>
        </div>


        {/* ════ COLUMN 3 — MESSAGES ═════════════════════════════════════════ */}
        <div className="flex-1 min-w-0 flex flex-col bg-muted/5">
          {!activeChat ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <MessageSquare className="w-14 h-14 opacity-15 mb-3" />
              <p className="text-sm font-medium">Selecione uma conversa</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Escolha uma conversa ao lado para visualizar as mensagens</p>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0 bg-card">
                <div className="flex items-center gap-3">
                  <AvatarInitials name={displayName(activeChat)} size="sm" />
                  <div>
                    <p className="text-sm font-semibold leading-tight">{displayName(activeChat)}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{activeChat.phone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm" variant="ghost"
                    className={cn('h-7 px-2 gap-1 text-[10px]', showAiPanel ? 'bg-accent/10 text-accent' : 'text-muted-foreground')}
                    onClick={() => setShowAiPanel(v => !v)}
                    title="Análise IA">
                    <Brain className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">IA</span>
                  </Button>
                  <Button
                    size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground"
                    onClick={() => loadMessages(activeInstance!.name, activeChat, true)}>
                    {loadingMsgs ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setActiveChat(null); setMessages([]); setShowAiPanel(false); }}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* Messages area */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5">
                {loadingMsgs ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                    <AlertCircle className="w-8 h-8 opacity-20 mb-2" />
                    <p className="text-xs">Nenhuma mensagem nesta conversa</p>
                  </div>
                ) : (
                  messages.map(msg => (
                    <div key={msg.id} className={cn('flex', msg.fromMe ? 'justify-end' : 'justify-start')}>
                      <div className={cn(
                        'max-w-[68%] px-3 py-2 rounded-2xl text-xs shadow-sm',
                        msg.fromMe
                          ? 'bg-primary text-primary-foreground rounded-br-sm'
                          : 'bg-card text-foreground rounded-bl-sm border border-border/60'
                      )}>
                        <p className="leading-relaxed break-words whitespace-pre-wrap">{msg.body}</p>
                        <p className={cn(
                          'text-[10px] mt-0.5 text-right flex items-center justify-end gap-1',
                          msg.fromMe ? 'text-primary-foreground/60' : 'text-muted-foreground'
                        )}>
                          {msg.timestamp > 0 && new Date(msg.timestamp * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          {msg.fromMe && <CheckCheck className="w-3 h-3" />}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="px-4 py-3 border-t border-border flex-shrink-0 bg-card">
                {isConnected ? (
                  <div className="flex items-center gap-2">
                    <Input
                      ref={inputRef}
                      value={inputText}
                      onChange={e => setInputText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                      placeholder="Digite uma mensagem..."
                      className="flex-1 h-10 text-sm bg-secondary border-border"
                      disabled={sending}
                    />
                    <Button
                      size="sm"
                      className="h-10 w-10 p-0 flex-shrink-0"
                      onClick={handleSend}
                      disabled={sending || !inputText.trim()}>
                      {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 py-1">
                    <AlertCircle className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-[11px] text-muted-foreground">Instância offline — conecte via QR Code para enviar</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ════ COLUMN 4 — AI ANALYSIS ══════════════════════════════════════ */}
        {activeChat && showAiPanel && (
          <AIAnalysisPanel
            chat={activeChat}
            messages={messages}
            apiToken={tokens.whatsapp}
          />
        )}

      </div>

      {/* Modals */}
      {qrInstanceName && <QRCodeModal instanceName={qrInstanceName} onClose={() => setQrInstanceName(null)} />}
      {showCreateInst && <CreateInstanceModal onClose={() => setShowCreateInst(false)} onCreated={refetchEvo} />}
    </div>
  );
}
