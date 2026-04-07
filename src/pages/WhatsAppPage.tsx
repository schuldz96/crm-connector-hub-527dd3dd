import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  MessageSquare, Search, WifiOff, QrCode,
  RefreshCcw, AlertCircle, X, Loader2,
  Smartphone, RefreshCw, Plus, CheckCheck, Send,
  ArrowUpDown, ArrowDownAZ, SortAsc, SortDesc,
  Brain, Sparkles, AlertTriangle, ChevronRight, Star,
  Paperclip, Mic, MicOff, Image as ImageIcon, FileText, Play, Download, MapPin, Volume2, Trash2, Key,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  useEvolutionInstances,
  type EvolutionInstance,
} from '@/hooks/useEvolutionInstances';
import { MOCK_USERS, MOCK_TEAMS } from '@/data/mockData';
import { useAppConfig } from '@/contexts/AppConfigContext';
import { AI_CONFIG_STORAGE, DEFAULT_WHATSAPP_CRITERIA } from '@/pages/AIConfigPage';
import { loadAIConfig } from '@/lib/aiConfigService';

import { callOpenAI } from '@/lib/openaiProxy';
import { supabase } from '@/integrations/supabase/client';
import { getSaasEmpresaId } from '@/lib/saas';
import { getEvolutionConfig } from '@/lib/evolutionConfig';

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
  aiScore?: number; // 0-100, from cron evaluation
}

type MsgType = 'text' | 'image' | 'video' | 'audio' | 'ptt' | 'document' | 'sticker' | 'location' | 'contact' | 'unknown';

interface Message {
  id: string;
  fromMe: boolean;
  body: string;
  timestamp: number;
  type: MsgType;
  mediaUrl?: string;
  mimetype?: string;
  fileName?: string;
  thumbnailB64?: string;
  latitude?: number;
  longitude?: number;
  // raw message key object for getBase64 API
  rawMsgKey?: { id: string; remoteJid: string; fromMe: boolean };
  // full raw message for getBase64FromMediaMessage API (needs complete message object)
  rawMessage?: any;
  // Group message sender info
  senderPhone?: string;
  senderName?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function evoFetch(path: string, options: RequestInit = {}, timeoutMs = 30000) {
  const cfg = await getEvolutionConfig();
  if (!cfg.url || !cfg.token) throw new Error('Evolution API não configurada. Acesse Integrações → WhatsApp para configurar.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${cfg.url}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        apikey: cfg.token,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      console.error('[evoFetch] HTTP', res.status, path, errBody.slice(0, 500));
      throw new Error(`HTTP ${res.status}: ${errBody.slice(0, 200)}`);
    }
    return res.json();
  } finally {
    clearTimeout(timer);
  }
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
  aiModel,
  instanceName,
  fetchBase64,
}: {
  chat: { id: string; name: string; phone: string };
  messages: Message[];
  apiToken: string;
  aiModel: string;
  instanceName?: string;
  fetchBase64?: (instanceName: string, rawMessage: any, convertToMp4?: boolean) => Promise<string | null>;
}) {
  const { toast } = useToast();
  const [result, setResult] = useState<AIAnalysisResult | null>(() => {
    try {
      const stored = localStorage.getItem(`appmax_ai_analysis_${chat.id}`);
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');

  // Load cached result when chat changes
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`appmax_ai_analysis_${chat.id}`);
      setResult(stored ? JSON.parse(stored) : null);
    } catch { setResult(null); }
  }, [chat.id]);

  // DB-backed config with localStorage fallback
  const [dbCriteria, setDbCriteria] = useState<any[] | null>(null);
  const [dbPrompt, setDbPrompt] = useState<string | null>(null);

  useEffect(() => {
    loadAIConfig('whatsapp').then(cfg => {
      if (cfg && cfg.criterios.length > 0) {
        setDbCriteria(cfg.criterios);
        if (cfg.prompt_sistema) setDbPrompt(cfg.prompt_sistema);
      }
    }).catch(() => {});
  }, []);

  const loadCriteria = () => {
    if (dbCriteria && dbCriteria.length > 0) return dbCriteria;
    try {
      const stored = localStorage.getItem(AI_CONFIG_STORAGE.WHATSAPP_CRITERIA);
      return stored ? JSON.parse(stored) : DEFAULT_WHATSAPP_CRITERIA;
    } catch { return DEFAULT_WHATSAPP_CRITERIA; }
  };
  const loadPrompt = () => {
    if (dbPrompt) return dbPrompt;
    try {
      const stored = localStorage.getItem(AI_CONFIG_STORAGE.WHATSAPP_PROMPT);
      return stored ? JSON.parse(stored) : 'Você é um especialista em vendas digitais e atendimento via WhatsApp. Avalie as conversas com foco em efetividade comercial, qualificação de leads e conversão.';
    } catch { return 'Você é um especialista em vendas digitais e atendimento via WhatsApp.'; }
  };

  // Build a media-aware description for a message
  const describeMedia = (m: Message): string => {
    const sender = m.fromMe ? 'VENDEDOR' : 'LEAD';
    switch (m.type) {
      case 'image':
        return `[${sender}] [IMAGEM enviada${m.body ? ': legenda "' + m.body + '"' : ''}]`;
      case 'video':
        return `[${sender}] [VÍDEO enviado${m.body ? ': legenda "' + m.body + '"' : ''}]`;
      case 'audio':
      case 'ptt':
        return `[${sender}] [ÁUDIO/VOZ enviado]`;
      case 'document':
        return `[${sender}] [DOCUMENTO enviado: ${m.fileName || 'arquivo'}${m.body ? ' - "' + m.body + '"' : ''}]`;
      case 'sticker':
        return `[${sender}] [FIGURINHA enviada]`;
      case 'location':
        return `[${sender}] [LOCALIZAÇÃO compartilhada${m.latitude ? `: ${m.latitude},${m.longitude}` : ''}]`;
      case 'contact':
        return `[${sender}] [CONTATO compartilhado${m.body ? ': ' + m.body : ''}]`;
      default:
        return `[${sender}] ${m.body || '[mensagem sem texto]'}`;
    }
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

      // ── Collect images for GPT-4o vision (max 5 to avoid token limits) ──
      const imageMessages = messages.filter(m => m.type === 'image' && m.rawMessage && instanceName && fetchBase64);
      const imageB64List: { sender: string; base64: string; mimetype: string; caption: string }[] = [];
      if (imageMessages.length > 0 && instanceName && fetchBase64) {
        setLoadingStatus('Processando imagens...');
        const imagesToProcess = imageMessages.slice(-5); // last 5
        for (const img of imagesToProcess) {
          try {
            const b64 = await fetchBase64(instanceName, img.rawMessage);
            if (b64) {
              imageB64List.push({
                sender: img.fromMe ? 'VENDEDOR' : 'LEAD',
                base64: b64,
                mimetype: img.mimetype || 'image/jpeg',
                caption: img.body || '',
              });
            }
          } catch { /* skip failed images */ }
        }
      }

      // ── Transcribe audio messages via Whisper (max 3) ──
      const audioMessages = messages.filter(m => (m.type === 'audio' || m.type === 'ptt') && m.rawMessage && instanceName && fetchBase64);
      const audioTranscripts: { sender: string; text: string }[] = [];
      if (audioMessages.length > 0 && instanceName && fetchBase64) {
        setLoadingStatus('Transcrevendo áudios...');
        const audiosToProcess = audioMessages.slice(-3); // last 3
        for (const aud of audiosToProcess) {
          try {
            const b64 = await fetchBase64(instanceName, aud.rawMessage);
            if (b64) {
              // Call Whisper via direct API (small audio, acceptable)
              const audioBlob = await fetch(`data:${aud.mimetype || 'audio/ogg'};base64,${b64}`).then(r => r.blob());
              const formData = new FormData();
              formData.append('file', audioBlob, 'audio.ogg');
              formData.append('model', 'whisper-1');
              formData.append('language', 'pt');
              const resp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiToken}` },
                body: formData,
              });
              if (resp.ok) {
                const whisperData = await resp.json();
                if (whisperData.text) {
                  audioTranscripts.push({ sender: aud.fromMe ? 'VENDEDOR' : 'LEAD', text: whisperData.text });
                }
              }
            }
          } catch { /* skip failed audios */ }
        }
      }

      setLoadingStatus('Analisando conversa...');

      // ── Build transcript with media annotations ──
      const transcript = messages.map((m, idx) => {
        // If we have a transcription for this audio, use it
        if ((m.type === 'audio' || m.type === 'ptt') && audioTranscripts.length > 0) {
          const audioIdx = audioMessages.indexOf(m);
          const processedOffset = audioMessages.length - Math.min(3, audioMessages.length);
          const transcriptIdx = audioIdx - processedOffset;
          if (transcriptIdx >= 0 && transcriptIdx < audioTranscripts.length) {
            const t = audioTranscripts[transcriptIdx];
            return `[${t.sender}] [ÁUDIO TRANSCRITO]: "${t.text}"`;
          }
        }
        if (m.type === 'text' || !m.type) {
          return `[${m.fromMe ? 'VENDEDOR' : 'LEAD'}] ${m.body}`;
        }
        return describeMedia(m);
      }).join('\n');

      const criteriaText = criteria.map((c: any) =>
        `- ${c.label} (peso ${c.weight}%): ${c.description}. Sinais positivos: ${c.positiveSignals?.join(', ') || 'N/A'}. Sinais negativos: ${c.negativeSignals?.join(', ') || 'N/A'}.`
      ).join('\n');

      // ── Build multimodal message content ──
      const userTextPrompt = `Analise a seguinte conversa de WhatsApp entre um vendedor e um lead.
A conversa inclui texto, emojis, e anotações de mídia (imagens, áudios transcritos, vídeos, documentos, figurinhas, localizações).
${imageB64List.length > 0 ? `\nALGUMAS IMAGENS DA CONVERSA ESTÃO INCLUÍDAS ABAIXO. Analise o conteúdo visual das imagens para avaliar a qualidade do atendimento (ex: prints de produtos, catálogos, propostas, etc).` : ''}
${audioTranscripts.length > 0 ? `\n${audioTranscripts.length} ÁUDIOS FORAM TRANSCRITOS e incluídos na conversa com a marcação [ÁUDIO TRANSCRITO].` : ''}

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

      // Build content array for multimodal (images + text)
      const userContent: any[] = [{ type: 'text', text: userTextPrompt }];
      for (const img of imageB64List) {
        userContent.push({
          type: 'image_url',
          image_url: { url: `data:${img.mimetype};base64,${img.base64}`, detail: 'low' },
        });
        if (img.caption) {
          userContent.push({ type: 'text', text: `(Legenda da imagem acima, enviada pelo ${img.sender}: "${img.caption}")` });
        }
      }

      // Use vision-capable model if we have images
      const model = imageB64List.length > 0 ? 'gpt-4o' : (aiModel || 'gpt-4o-mini');

      const data = await callOpenAI(apiToken, {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: imageB64List.length > 0 ? userContent : userTextPrompt },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      });
      const raw = data.choices?.[0]?.message?.content || '';
      // Strip possible markdown fences
      const jsonStr = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed: AIAnalysisResult = { ...JSON.parse(jsonStr), analyzedAt: new Date().toISOString() };
      setResult(parsed);
      localStorage.setItem(`appmax_ai_analysis_${chat.id}`, JSON.stringify(parsed));
      const mediaInfo = [
        imageB64List.length > 0 ? `${imageB64List.length} img` : '',
        audioTranscripts.length > 0 ? `${audioTranscripts.length} áudio` : '',
      ].filter(Boolean).join(', ');
      toast({ title: '✓ Análise concluída!', description: `Score: ${parsed.totalScore}/100${mediaInfo ? ` (${mediaInfo})` : ''}` });
    } catch (e: any) {
      const msg = e.message === 'Failed to fetch'
        ? 'Não foi possível conectar à API OpenAI. Verifique o token e a conexão de internet.'
        : e.message;
      toast({ variant: 'destructive', title: 'Erro na análise', description: msg });
    } finally {
      setLoading(false);
      setLoadingStatus('');
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
            ? <><Loader2 className="w-3 h-3 animate-spin" /> {loadingStatus || 'Analisando...'}</>
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

// ─── Message Content Renderer ────────────────────────────────────────────────
function MessageContent({
  msg,
  instanceName,
  fetchBase64,
}: {
  msg: Message;
  instanceName: string;
  fetchBase64: (inst: string, rawMessage: any, mp4?: boolean) => Promise<string | null>;
}) {
  const [mediaData, setMediaData] = useState<string | null>(null);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [mediaError, setMediaError] = useState(false);
  const isFromMe = msg.fromMe;

  const loadMedia = async () => {
    if (mediaData || loadingMedia) return;
    if (!msg.rawMessage) {
      console.warn('[Media] Sem rawMessage para msg:', msg.id, msg.type);
      setMediaError(true);
      return;
    }
    setLoadingMedia(true);
    setMediaError(false);
    const b64 = await fetchBase64(instanceName, msg.rawMessage, msg.type === 'video');
    if (b64) {
      // For audio, default to ogg if no mimetype
      const defaultMime = (msg.type === 'audio' || msg.type === 'ptt') ? 'audio/ogg; codecs=opus' : 'application/octet-stream';
      const mime = msg.mimetype || defaultMime;
      setMediaData(`data:${mime};base64,${b64}`);
      console.log('[Media] Loaded', msg.type, msg.id, 'mime:', mime, 'b64len:', b64.length);
    } else {
      console.warn('[Media] Falha ao carregar:', msg.id, msg.type);
      setMediaError(true);
    }
    setLoadingMedia(false);
  };

  // Auto-load only images/stickers (small, visual). Audio/video/docs load on click.
  useEffect(() => {
    const autoLoadTypes: MsgType[] = ['image', 'sticker'];
    if (autoLoadTypes.includes(msg.type) && !mediaData && msg.rawMessage) {
      loadMedia();
    }
  }, [msg.id]);

  const audioSrc = mediaData;
  const imgSrc = mediaData || (msg.thumbnailB64 ? `data:image/jpeg;base64,${msg.thumbnailB64}` : null);

  switch (msg.type) {
    case 'image':
      return (
        <div>
          {imgSrc ? (
            <img
              src={imgSrc}
              alt="imagem"
              className={cn('max-w-full max-h-72 object-contain', !mediaData && 'opacity-60 blur-sm')}
            />
          ) : loadingMedia ? (
            <div className="flex items-center gap-2 px-3 py-4">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-xs">Carregando imagem...</span>
            </div>
          ) : (
            <button
              onClick={loadMedia}
              className="flex items-center gap-2 px-3 py-2"
              disabled={loadingMedia}
            >
              {loadingMedia ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
              <span className="text-xs">Carregar imagem</span>
            </button>
          )}
          {msg.body && msg.body !== '[mídia]' && (
            <p className="px-3 pt-1.5 leading-relaxed break-words whitespace-pre-wrap">{msg.body}</p>
          )}
        </div>
      );

    case 'video':
      return (
        <div>
          {mediaData ? (
            <video
              src={mediaData}
              controls
              className="max-w-full max-h-72 rounded-lg"
              preload="metadata"
            />
          ) : msg.thumbnailB64 ? (
            <div className="relative cursor-pointer" onClick={loadMedia}>
              <img
                src={`data:image/jpeg;base64,${msg.thumbnailB64}`}
                alt="vídeo"
                className="max-w-full max-h-72 object-contain opacity-80"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                {loadingMedia ? (
                  <Loader2 className="w-8 h-8 animate-spin text-white drop-shadow" />
                ) : (
                  <Play className="w-10 h-10 text-white drop-shadow-lg" />
                )}
              </div>
            </div>
          ) : (
            <button onClick={loadMedia} className="flex items-center gap-2 px-3 py-2" disabled={loadingMedia}>
              {loadingMedia ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              <span className="text-xs">Carregar vídeo</span>
            </button>
          )}
          {msg.body && msg.body !== '[mídia]' && (
            <p className="px-3 pt-1.5 leading-relaxed break-words whitespace-pre-wrap">{msg.body}</p>
          )}
        </div>
      );

    case 'audio':
    case 'ptt':
      return (
        <div className="px-3 py-2">
          {audioSrc ? (
            <audio controls className="max-w-[240px] h-8" preload="auto" autoPlay={false}>
              <source src={audioSrc} type={msg.mimetype || 'audio/ogg; codecs=opus'} />
              Seu navegador não suporta áudio.
            </audio>
          ) : (
            <button
              onClick={loadMedia}
              className={cn(
                'flex items-center gap-2 py-1 rounded-full text-xs',
                isFromMe ? 'text-primary-foreground/80' : 'text-muted-foreground'
              )}
              disabled={loadingMedia}
            >
              {loadingMedia ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : mediaError ? (
                <AlertCircle className="w-4 h-4 text-destructive" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
              <span>{msg.type === 'ptt' ? 'Mensagem de voz' : 'Áudio'}</span>
              <span className="text-[10px] opacity-60">
                {loadingMedia ? 'carregando...' : mediaError ? 'erro · toque para tentar novamente' : 'toque para ouvir'}
              </span>
            </button>
          )}
        </div>
      );

    case 'document':
      return (
        <div className="px-3 py-2">
          <div className={cn(
            'flex items-center gap-2.5 p-2 rounded-lg',
            isFromMe ? 'bg-primary-foreground/10' : 'bg-muted/50'
          )}>
            <FileText className="w-5 h-5 flex-shrink-0 opacity-70" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{msg.fileName || msg.body || 'Documento'}</p>
              <p className="text-[10px] opacity-60">{msg.mimetype || 'documento'}</p>
            </div>
            {mediaData ? (
              <a href={mediaData} download={msg.fileName || 'documento'} className="flex-shrink-0">
                <Download className="w-4 h-4 opacity-70 hover:opacity-100" />
              </a>
            ) : (
              <button onClick={loadMedia} disabled={loadingMedia} className="flex-shrink-0">
                {loadingMedia ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 opacity-70 hover:opacity-100" />}
              </button>
            )}
          </div>
        </div>
      );

    case 'sticker':
      return (
        <div className="p-1">
          {imgSrc ? (
            <img
              src={imgSrc!}
              alt="sticker"
              className="w-28 h-28 object-contain"
            />
          ) : (
            <button onClick={loadMedia} className="w-28 h-28 flex items-center justify-center" disabled={loadingMedia}>
              {loadingMedia ? <Loader2 className="w-5 h-5 animate-spin" /> : <span className="text-3xl">🪄</span>}
            </button>
          )}
        </div>
      );

    case 'location':
      return (
        <div className="px-3 py-2">
          {msg.latitude && msg.longitude ? (
            <a
              href={`https://www.google.com/maps?q=${msg.latitude},${msg.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'flex items-center gap-2 p-2 rounded-lg',
                isFromMe ? 'bg-primary-foreground/10 hover:bg-primary-foreground/20' : 'bg-muted/50 hover:bg-muted'
              )}
            >
              <MapPin className="w-5 h-5 flex-shrink-0" />
              <div className="text-xs">
                <p className="font-medium">Localização</p>
                <p className="opacity-60 text-[10px]">{msg.latitude.toFixed(5)}, {msg.longitude.toFixed(5)}</p>
              </div>
            </a>
          ) : (
            <p className="text-xs flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Localização</p>
          )}
        </div>
      );

    case 'contact':
      return (
        <p className="px-3 py-2 leading-relaxed break-words whitespace-pre-wrap">👤 {msg.body}</p>
      );

    default:
      return (
        <p className="px-3 py-2 leading-relaxed break-words whitespace-pre-wrap">{msg.body}</p>
      );
  }
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function WhatsAppPage() {
  const { user, hasRole } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const isAdmin = hasRole(['admin', 'ceo', 'director', 'manager', 'coordinator', 'supervisor']);
  const { instances: evoInstances, loading: evoLoading, refetch: refetchEvo } = useEvolutionInstances();
  const { tokens, models } = useAppConfig();

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
    if (!isAdmin) return i.assignedUserEmail?.toLowerCase() === user?.email?.toLowerCase();
    return true;
  });

  // Helper: find team for an instance by looking up the assigned user's teamId
  const getInstTeamId = (instName: string): string | null => {
    const inst = evoInstances.find(i => i.name === instName);
    const assignedUser = inst?.assignedUserEmail ? MOCK_USERS.find(u => u.email?.toLowerCase() === inst.assignedUserEmail?.toLowerCase()) : undefined;
    return assignedUser ? null : null;
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

  // Auto-select instance (from URL or first)
  useEffect(() => {
    if (visibleInstances.length > 0 && !activeInstance) {
      const instParam = searchParams.get('instance');
      const match = instParam ? visibleInstances.find(i => i.name === instParam) : null;
      setActiveInstance(match || visibleInstances[0]);
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

  // ── Local "last seen" tracking (independent of WhatsApp read receipts) ────
  const SEEN_KEY = 'appmax_chat_seen';
  const getSeenMap = useCallback((): Record<string, number> => {
    try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}'); } catch { return {}; }
  }, []);
  const markChatSeen = useCallback((chatId: string, ts: number) => {
    const map = getSeenMap();
    map[chatId] = ts;
    localStorage.setItem(SEEN_KEY, JSON.stringify(map));
  }, [getSeenMap]);

  // ── Message parsing with full media support ────────────────────────────────
  const parseBodyText = (m: any): string => {
    const msg = m.message || {};
    return (
      msg.conversation ||
      msg.extendedTextMessage?.text ||
      msg.imageMessage?.caption ||
      msg.videoMessage?.caption ||
      msg.documentMessage?.title || msg.documentMessage?.fileName ||
      (msg.audioMessage ? '🎵 Áudio' : '') ||
      (msg.stickerMessage ? '🪄 Sticker' : '') ||
      (msg.locationMessage ? '📍 Localização' : '') ||
      (msg.contactMessage || msg.contactsArrayMessage ? '👤 Contato' : '') ||
      '[mídia]'
    );
  };

  const detectMsgType = (m: any): MsgType => {
    const msg = m.message || {};
    // Check nested message object first
    if (msg.imageMessage) return 'image';
    if (msg.videoMessage) return 'video';
    if (msg.audioMessage) return msg.audioMessage.ptt ? 'ptt' : 'audio';
    if (msg.documentMessage || msg.documentWithCaptionMessage) return 'document';
    if (msg.stickerMessage) return 'sticker';
    if (msg.locationMessage || msg.liveLocationMessage) return 'location';
    if (msg.contactMessage || msg.contactsArrayMessage) return 'contact';
    if (msg.conversation || msg.extendedTextMessage) return 'text';
    // Fallback: Evolution API messageType field (flat structure for sent messages)
    const mt = (m.messageType || '').toLowerCase();
    if (mt === 'imagemessage' || mt === 'image') return 'image';
    if (mt === 'videomessage' || mt === 'video') return 'video';
    if (mt === 'audiomessage' || mt === 'audio' || mt === 'pttmessage') return mt.includes('ptt') ? 'ptt' : 'audio';
    if (mt === 'documentmessage' || mt === 'document' || mt === 'documentwithcaptionmessage') return 'document';
    if (mt === 'stickermessage' || mt === 'sticker') return 'sticker';
    if (mt === 'locationmessage' || mt === 'location') return 'location';
    if (mt === 'contactmessage' || mt === 'contact') return 'contact';
    if (mt === 'conversation' || mt === 'extendedtextmessage') return 'text';
    return 'unknown';
  };

  const extractMediaUrl = (_m: any): string | undefined => {
    // Baileys/Evolution returns encrypted media URLs that are NOT browser-accessible.
    // All media must be fetched via getBase64FromMediaMessage API instead.
    return undefined;
  };

  const parseFullMessage = (m: any): Message => {
    const msg = m.message || {};
    const type = detectMsgType(m);
    const mediaUrl = extractMediaUrl(m);
    const docMsg = msg.documentMessage || msg.documentWithCaptionMessage?.message?.documentMessage;

    // Group sender info: participant field contains the sender's JID in group chats
    const participant = m.key?.participant || m.participant || '';
    const senderPhone = participant ? participant.replace(/@.*/, '') : undefined;
    const senderName = m.pushName || undefined;

    return {
      id: m.key?.id || m.id || '',
      fromMe: m.key?.fromMe === true,
      body: parseBodyText(m),
      timestamp: m.messageTimestamp || 0,
      type,
      mediaUrl,
      mimetype: msg.imageMessage?.mimetype || msg.videoMessage?.mimetype ||
        msg.audioMessage?.mimetype || docMsg?.mimetype ||
        msg.stickerMessage?.mimetype || undefined,
      fileName: docMsg?.fileName || docMsg?.title || undefined,
      thumbnailB64: msg.imageMessage?.jpegThumbnail || msg.videoMessage?.jpegThumbnail ||
        msg.stickerMessage?.jpegThumbnail || undefined,
      latitude: msg.locationMessage?.degreesLatitude || msg.liveLocationMessage?.degreesLatitude,
      longitude: msg.locationMessage?.degreesLongitude || msg.liveLocationMessage?.degreesLongitude,
      rawMsgKey: m.key ? { id: m.key.id, remoteJid: m.key.remoteJid, fromMe: m.key.fromMe === true } : undefined,
      rawMessage: m,
      senderPhone,
      senderName,
    };
  };

  /** Fetch base64 for a media message from Evolution API */
  const fetchMediaBase64 = async (
    instanceName: string,
    rawMessage: any,
    convertToMp4 = false,
  ): Promise<string | null> => {
    try {
      const msgKey = rawMessage.key || rawMessage;
      console.log('[Media] Requesting base64 for:', msgKey.id, 'fromMe:', msgKey.fromMe, 'jid:', msgKey.remoteJid);
      // Evolution API needs the full raw message object, not just the key
      const data = await evoFetch(`/chat/getBase64FromMediaMessage/${instanceName}`, {
        method: 'POST',
        body: JSON.stringify({ message: rawMessage, convertToMp4 }),
      });
      console.log('[Media] API response keys:', data ? Object.keys(data) : 'null', 'hasBase64:', !!data?.base64, 'b64len:', data?.base64?.length || 0);
      return data?.base64 || null;
    } catch (err) {
      console.error('[Media] Falha ao carregar base64:', rawMessage?.key?.id, err);
      return null;
    }
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
        const lm = c.lastMessage?.message || {};
        const lastMsg =
          lm.conversation ||
          lm.extendedTextMessage?.text ||
          (lm.imageMessage ? '📷 Foto' + (lm.imageMessage.caption ? ` ${lm.imageMessage.caption}` : '') : '') ||
          (lm.videoMessage ? '🎬 Vídeo' + (lm.videoMessage.caption ? ` ${lm.videoMessage.caption}` : '') : '') ||
          (lm.audioMessage ? (lm.audioMessage.ptt ? '🎤 Áudio' : '🎵 Áudio') : '') ||
          (lm.documentMessage ? `📄 ${lm.documentMessage.fileName || lm.documentMessage.title || 'Documento'}` : '') ||
          (lm.stickerMessage ? '🪄 Sticker' : '') ||
          (lm.locationMessage || lm.liveLocationMessage ? '📍 Localização' : '') ||
          (lm.contactMessage || lm.contactsArrayMessage ? '👤 Contato' : '') ||
          '';

        const existing = phoneMap.get(key);

        // Calculate unread using local "last seen" tracking
        const seenMap = getSeenMap();
        const seenTs = seenMap[jid] || 0;
        // Unread if: last message is from contact (not me), AND timestamp > last time I opened this chat
        const localUnread = (!fromMe && ts > seenTs) ? Math.max(c.unreadCount || 0, 1) : 0;

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
            unread: localUnread,
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
            unread: Math.max(localUnread, existing.unread),
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
        // On silent poll: preserve unread badges until user reads/replies
        setChats(prev => {
          const prevMap = new Map(prev.map(c => [c.id, c]));
          return sorted.map(newChat => {
            const isOpen = activeChatRef.current?.id === newChat.id;
            if (isOpen) {
              markChatSeen(newChat.id, newChat.lastMessageTs || Math.floor(Date.now() / 1000));
              return { ...newChat, unread: 0 };
            }
            const old = prevMap.get(newChat.id);
            if (!old) return newChat; // brand new chat, use API unread

            const isNewMsg = newChat.lastMessageTs > old.lastMessageTs;

            // Someone replied from phone/app (fromMe) → conversation handled, clear badge
            if (isNewMsg && newChat.lastMessageFromMe) {
              markChatSeen(newChat.id, newChat.lastMessageTs);
              return { ...newChat, unread: 0 };
            }
            // New message from contact → increment local unread
            if (isNewMsg && !newChat.lastMessageFromMe) {
              return { ...newChat, unread: old.unread + 1 };
            }
            // No new message — never decrease unread, only user click resets it
            const bestUnread = Math.max(old.unread, newChat.unread);
            return { ...newChat, unread: bestUnread };
          });
        });
      } else {
        // Initial load: also merge with any existing local unread counts
        setChats(prev => {
          if (prev.length === 0) return sorted.slice(0, 200);
          const prevMap = new Map(prev.map(c => [c.id, c]));
          return sorted.slice(0, 200).map(newChat => {
            const old = prevMap.get(newChat.id);
            if (!old) return newChat;
            return { ...newChat, unread: Math.max(old.unread, newChat.unread) };
          });
        });
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

  // Auto-select chat from URL params
  useEffect(() => {
    const phoneParam = searchParams.get('phone');
    if (phoneParam && chats.length > 0 && !activeChat) {
      const jid = phoneParam.includes('@') ? phoneParam : phoneParam + '@s.whatsapp.net';
      const match = chats.find(c => c.id === jid || c.id.startsWith(phoneParam));
      if (match) setActiveChat(match);
    }
  }, [chats, searchParams]);

  // Poll chat list every 10s to update unread counts and new conversations
  useEffect(() => {
    if (!activeInstance || activeInstance.connectionStatus !== 'open') return;
    const t = setInterval(() => loadChats(activeInstance.name, true), 3000);
    return () => clearInterval(t);
  }, [activeInstance?.name, activeInstance?.connectionStatus]);

  // Load AI scores from DB for current instance
  const [chatScores, setChatScores] = useState<Map<string, number>>(new Map());
  useEffect(() => {
    if (!activeInstance) return;
    const loadScores = async () => {
      try {
        const empresaId = await getSaasEmpresaId();
        const { data } = await (supabase as any)
          .schema('saas')
          .from('analises_ia')
          .select('contato_telefone,score,periodo_ref')
          .eq('empresa_id', empresaId)
          .eq('tipo_contexto', 'whatsapp')
          .eq('instancia_nome', activeInstance.name)
          .not('contato_telefone', 'is', null)
          .order('periodo_ref', { ascending: false });

        if (data) {
          const map = new Map<string, number>();
          for (const row of data) {
            // Keep only the most recent score per phone
            if (!map.has(row.contato_telefone)) {
              map.set(row.contato_telefone, row.score);
            }
          }
          setChatScores(map);
        }
      } catch { /* silent */ }
    };
    loadScores();
  }, [activeInstance?.name]);



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
  const [recording, setRecording] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingFilePreview, setPendingFilePreview] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const cancelledRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
          const pm = parseFullMessage(m);
          // Debug: log media messages to understand structure
          if (pm.type !== 'text' && pm.type !== 'unknown') {
            console.log('[msg]', pm.type, pm.fromMe ? 'sent' : 'recv', 'hasKey:', !!pm.rawMsgKey, 'mime:', pm.mimetype, 'raw:', JSON.stringify(m).slice(0, 300));
          }
          parsed.push(pm);
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

  // ── Group participants: map LID → phone number ──────────────────────────
  const [groupParticipants, setGroupParticipants] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    if (!activeChat || !activeInstance) { setGroupParticipants(new Map()); return; }
    const isGroup = activeChat.remoteJid?.includes('@g.us');
    if (!isGroup) { setGroupParticipants(new Map()); return; }
    const fetchParticipants = async () => {
      try {
        const data = await evoFetch(
          `/group/participants/${activeInstance.name}?groupJid=${encodeURIComponent(activeChat.remoteJid)}`,
          { method: 'GET' },
        );
        const list: any[] = data?.participants || (Array.isArray(data) ? data : []);
        const map = new Map<string, string>();
        for (const p of list) {
          // API returns: id = LID ("23585...@Lid"), phoneNumber = real ("5551...@s.whatsapp.net"), name = push name
          const lid: string = p.id || '';
          const phoneJid: string = p.phoneNumber || '';
          const phone = phoneJid.replace(/@.*/, '');
          const lidClean = lid.replace(/@.*/, '');
          const pName = p.name || '';
          if (phone && lid) {
            // Store as "name|phone" so we can split later, or just phone if no name
            const val = pName ? `${pName}|${phone}` : phone;
            map.set(lid, val);
            map.set(lidClean, val);
          }
        }
        setGroupParticipants(map);
      } catch {
        setGroupParticipants(new Map());
      }
    };
    fetchParticipants();
  }, [activeChat?.id, activeInstance?.name]);


  // Auto-scroll only when user is near bottom or on initial load / chat switch
  const msgContainerRef = useRef<HTMLDivElement>(null);
  const prevChatIdRef = useRef<string | null>(null);
  const isNearBottom = useCallback(() => {
    const el = msgContainerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }, []);

  const prevMsgLenRef = useRef(0);
  useEffect(() => {
    const chatChanged = activeChat?.id !== prevChatIdRef.current;
    prevChatIdRef.current = activeChat?.id ?? null;
    const msgCountChanged = messages.length !== prevMsgLenRef.current;
    prevMsgLenRef.current = messages.length;
    // Always scroll on chat switch; on new messages only if near bottom
    if (chatChanged) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    } else if (msgCountChanged && isNearBottom()) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeChat?.id]);

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

  // ── Send media (image/video/document) ──────────────────────────────────────
  const handleSendMedia = async (file: File) => {
    if (!activeChat || !activeInstance) return;
    setSending(true);
    try {
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      // Evolution API expects capitalized "Image" for images
      const mediatype = isImage ? 'image' : isVideo ? 'video' : 'document';
      const number = activeChat.phone || activeChat.remoteJid;
      // Extract raw base64 from dataUrl
      const base64 = dataUrl.split(',')[1];

      await evoFetch(`/message/sendMedia/${activeInstance.name}`, {
        method: 'POST',
        body: JSON.stringify({
          number,
          mediatype,
          mimetype: file.type,
          caption: '',
          media: base64,
          fileName: file.name,
        }),
      });
      await loadMessages(activeInstance.name, activeChat, false);
      inputRef.current?.focus();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao enviar mídia', description: e.message });
    } finally { setSending(false); }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPendingFile(file);
      // Generate preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => setPendingFilePreview(reader.result as string);
        reader.readAsDataURL(file);
      } else {
        setPendingFilePreview(null);
      }
    }
    e.target.value = '';
  };

  const confirmSendFile = () => {
    if (pendingFile) {
      handleSendMedia(pendingFile);
      setPendingFile(null);
      setPendingFilePreview(null);
    }
  };

  const cancelSendFile = () => {
    setPendingFile(null);
    setPendingFilePreview(null);
  };

  // ── Audio recording ────────────────────────────────────────────────────────
  const startRecording = async () => {
    if (!activeChat || !activeInstance) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        // Check if recording was cancelled
        if (cancelledRef.current) {
          cancelledRef.current = false;
          return;
        }
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (blob.size < 100) return; // Too short, ignore

        setSending(true);
        try {
          const reader = new FileReader();
          const dataUrl = await new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });

          const number = activeChat!.phone || activeChat!.remoteJid;
          // Extract raw base64 from dataUrl
          const base64 = dataUrl.split(',')[1];

          await evoFetch(`/message/sendWhatsAppAudio/${activeInstance!.name}`, {
            method: 'POST',
            body: JSON.stringify({
              number,
              audio: base64,
            }),
          });
          await loadMessages(activeInstance!.name, activeChat!, false);
        } catch (e: any) {
          toast({ variant: 'destructive', title: 'Erro ao enviar áudio', description: e.message });
        } finally { setSending(false); }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setRecording(true);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao acessar microfone', description: e.message || 'Permita o acesso ao microfone.' });
    }
  };

  const stopRecording = () => {
    cancelledRef.current = false;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  };

  const cancelRecording = () => {
    cancelledRef.current = true;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
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
          <span className={cn(
            'flex items-center gap-1.5 text-xs border rounded-lg px-3 py-1.5',
            tokens.whatsapp?.startsWith('sk-')
              ? 'border-success/30 text-success bg-success/5'
              : 'border-warning/30 text-warning bg-warning/5'
          )}>
            <Key className="w-3 h-3" />
            {tokens.whatsapp?.startsWith('sk-') ? 'Token WhatsApp ✓' : 'Sem token — Admin → Tokens OpenAI'}
          </span>
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
              const assignedUser = inst.assignedUserEmail ? MOCK_USERS.find(u => u.email?.toLowerCase() === inst.assignedUserEmail?.toLowerCase()) : undefined;
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
                  markChatSeen(chat.id, chat.lastMessageTs || Math.floor(Date.now() / 1000));
                  setChats(prev => prev.map(c => c.id === chat.id ? { ...c, unread: 0 } : c));
                  const params: Record<string, string> = {};
                  if (activeInstance) params.instance = activeInstance.name;
                  params.phone = chat.id.replace('@s.whatsapp.net', '');
                  setSearchParams(params, { replace: true });
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
                  <div className="flex items-center gap-1">
                    {chat.name && chat.name !== chat.phone && (
                      <p className="text-[10px] text-muted-foreground/50 font-mono truncate">{chat.phone}</p>
                    )}
                    {(chatScores.get(chat.phone) ?? chat.aiScore) != null && (() => {
                      const s = chatScores.get(chat.phone) ?? chat.aiScore!;
                      const color = s >= 85 ? 'text-success' : s >= 70 ? 'text-primary' : s >= 50 ? 'text-warning' : 'text-destructive';
                      return <span className={cn('text-[9px] font-bold font-mono ml-auto flex-shrink-0', color)}>{s}</span>;
                    })()}
                  </div>
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
              <div ref={msgContainerRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5">
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
                  messages.map(msg => {
                    const isGroup = activeChat?.remoteJid?.includes('@g.us');
                    // Resolve LID to real name + phone using group participants map
                    const { senderDisplayName, senderDisplayPhone } = (() => {
                      if (!isGroup || !msg.senderPhone) return { senderDisplayName: msg.senderName, senderDisplayPhone: msg.senderPhone };
                      // Lookup in participants map (stores "name|phone" or just "phone")
                      const mapped = groupParticipants.get(msg.senderPhone) ||
                        groupParticipants.get(msg.senderPhone + '@Lid') ||
                        groupParticipants.get(msg.senderPhone + '@lid');
                      if (mapped) {
                        const parts = mapped.split('|');
                        if (parts.length === 2) return { senderDisplayName: parts[0], senderDisplayPhone: parts[1] };
                        return { senderDisplayName: msg.senderName, senderDisplayPhone: parts[0] };
                      }
                      return { senderDisplayName: msg.senderName, senderDisplayPhone: msg.senderPhone };
                    })();
                    return (
                    <div key={msg.id} className={cn('flex', msg.fromMe ? 'justify-end' : 'justify-start')}>
                      <div className={cn(
                        'max-w-[68%] rounded-2xl text-xs shadow-sm overflow-hidden',
                        msg.fromMe
                          ? 'bg-primary text-primary-foreground rounded-br-sm'
                          : 'bg-card text-foreground rounded-bl-sm border border-border/60'
                      )}>
                        {/* ── Group sender label ── */}
                        {isGroup && !msg.fromMe && (senderDisplayName || senderDisplayPhone) && (
                          <p className="px-3 pt-2 pb-0.5 text-[10px] font-semibold truncate">
                            <span className="text-accent">{senderDisplayName || senderDisplayPhone}</span>
                            {senderDisplayName && senderDisplayPhone && (
                              <span className="text-muted-foreground font-normal ml-1">· {senderDisplayPhone}</span>
                            )}
                          </p>
                        )}
                        {/* ── Media content ── */}
                        <MessageContent msg={msg} instanceName={activeInstance!.name} fetchBase64={fetchMediaBase64} />
                        {/* ── Timestamp ── */}
                        <p className={cn(
                          'text-[10px] px-3 pb-1.5 text-right flex items-center justify-end gap-1',
                          msg.fromMe ? 'text-primary-foreground/60' : 'text-muted-foreground'
                        )}>
                          {msg.timestamp > 0 && new Date(msg.timestamp * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          {msg.fromMe && <CheckCheck className="w-3 h-3" />}
                        </p>
                      </div>
                    </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="px-4 py-3 border-t border-border flex-shrink-0 bg-card">
                {/* File preview banner */}
                {pendingFile && (
                  <div className="flex items-center gap-3 px-4 py-2 bg-secondary/80 border-t border-border">
                    {pendingFilePreview ? (
                      <img src={pendingFilePreview} alt="preview" className="w-14 h-14 rounded-lg object-cover border border-border" />
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center border border-border">
                        <FileText className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{pendingFile.name}</p>
                      <p className="text-[10px] text-muted-foreground">{(pendingFile.size / 1024).toFixed(0)} KB · {pendingFile.type || 'arquivo'}</p>
                    </div>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={cancelSendFile} title="Cancelar">
                      <X className="w-4 h-4" />
                    </Button>
                    <Button size="sm" className="h-8 px-3 text-xs bg-success hover:bg-success/90"
                      onClick={confirmSendFile} disabled={sending}>
                      {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1" />}
                      Enviar
                    </Button>
                  </div>
                )}
                {isConnected ? (
                  <div className="flex items-center gap-1.5">
                    {/* Hidden file input */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
                      onChange={handleFileSelect}
                    />
                    {/* Attachment button */}
                    <Button
                      size="sm" variant="ghost"
                      className="h-10 w-10 p-0 flex-shrink-0 text-muted-foreground hover:text-foreground"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={sending || recording}
                      title="Enviar arquivo, imagem ou vídeo">
                      <Paperclip className="w-4 h-4" />
                    </Button>
                    {/* Text input */}
                    <Input
                      ref={inputRef}
                      value={inputText}
                      onChange={e => setInputText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                      placeholder={recording ? 'Gravando áudio...' : 'Digite uma mensagem...'}
                      className="flex-1 h-10 text-sm bg-secondary border-border"
                      disabled={sending || recording}
                    />
                    {/* Send or Mic button */}
                    {inputText.trim() ? (
                      <Button
                        size="sm"
                        className="h-10 w-10 p-0 flex-shrink-0"
                        onClick={handleSend}
                        disabled={sending}>
                        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      </Button>
                    ) : recording ? (
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm" variant="ghost"
                          className="h-10 w-10 p-0 flex-shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={cancelRecording}
                          title="Cancelar gravação">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        <span className="text-xs text-destructive animate-pulse font-medium">Gravando...</span>
                        <Button
                          size="sm"
                          className="h-10 w-10 p-0 flex-shrink-0 bg-success hover:bg-success/90"
                          onClick={stopRecording}
                          title="Enviar áudio">
                          <Send className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm" variant="ghost"
                        className="h-10 w-10 p-0 flex-shrink-0 text-muted-foreground hover:text-foreground"
                        onClick={startRecording}
                        disabled={sending}
                        title="Gravar áudio">
                        <Mic className="w-4 h-4" />
                      </Button>
                    )}
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
            aiModel={models.whatsapp || 'gpt-4o-mini'}
            instanceName={activeInstance?.name}
            fetchBase64={fetchMediaBase64}
          />
        )}

      </div>

      {/* Modals */}
      {qrInstanceName && <QRCodeModal instanceName={qrInstanceName} onClose={() => setQrInstanceName(null)} />}
      {showCreateInst && <CreateInstanceModal onClose={() => setShowCreateInst(false)} onCreated={refetchEvo} />}
    </div>
  );
}
