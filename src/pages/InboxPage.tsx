import '@/lib/globalPolyfill';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Inbox, Search, MessageSquare, Settings, Send, CheckCheck, Plus,
  Loader2, RefreshCw, ChevronRight, Phone, Clock, Check,
  Paperclip, Image as ImageIcon, FileText, Mic, MicOff, LayoutTemplate,
  AlertTriangle, X, UserPlus, Trash2, RotateCcw, Archive, ArchiveRestore, Download,
  Ticket, PanelRightOpen, PanelRightClose, User, Tag, Edit2,
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getSaasEmpresaId } from '@/lib/saas';
import { useAuth } from '@/contexts/AuthContext';
import InboxSettingsModal from '@/components/inbox/InboxSettingsModal';
import BulkSendModal from '@/components/inbox/BulkSendModal';
import {
  loadConversations, loadMessages, markConversationRead,
  sendTextMessage, sendMediaMessage, sendTemplateMessage,
  uploadMediaToMeta, isWithin24hWindow, normalizePhone,
  type InboxConversation, type InboxMessage,
} from '@/lib/metaInboxService';
import { decryptAccountTokens } from '@/lib/tokenCrypto';

/* ── Types ─────────────────────────────────────────────── */
export interface MetaInboxAccount {
  id: string;
  empresa_id: string;
  nome: string;
  phone_number_id: string;
  waba_id: string | null;
  access_token: string;
  token_type: string;
  phone_display: string | null;
  status: string;
  webhook_verify_token: string | null;
  created_at: string;
  updated_at: string;
  ticket_enabled?: boolean;
  ticket_pipeline_id?: string | null;
  ticket_estagio_id?: string | null;
  ticket_prioridade?: string;
}

/* ── Avatar ────────────────────────────────────────────── */
const AvatarInitials = ({ name }: { name: string }) => (
  <div className="w-10 h-10 rounded-full bg-primary/15 text-primary font-bold flex items-center justify-center flex-shrink-0 text-sm">
    {(name || '?')[0].toUpperCase()}
  </div>
);

/* ── Normalize Brazilian phone (ensure 9th digit for mobile) */
/* ── Convert AudioBuffer to WAV (PCM) ────────────── */
function audioBufferToWav(audioBuffer: AudioBuffer): Blob {
  const numCh = 1;
  const sr = audioBuffer.sampleRate;
  const samples = audioBuffer.getChannelData(0);
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true);
  w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, numCh, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * numCh * 2, true);
  v.setUint16(32, numCh * 2, true); v.setUint16(34, 16, true);
  w(36, 'data'); v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
  return new Blob([buf], { type: 'audio/wav' });
}


/* ── Format time ───────────────────────────────────────── */
function formatTime(ts: string | number) {
  const d = typeof ts === 'number' ? new Date(ts * 1000) : new Date(ts);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return time;
  const date = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  return `${date} ${time}`;
}

/* ── Status icon for sent messages ─────────────────────── */
function MsgStatusIcon({ status }: { status: string }) {
  if (status === 'read') return <CheckCheck className="w-3 h-3 text-blue-400" />;
  if (status === 'delivered') return <CheckCheck className="w-3 h-3 opacity-60" />;
  if (status === 'sent') return <Check className="w-3 h-3 opacity-60" />;
  if (status === 'failed') return <AlertTriangle className="w-3 h-3 text-destructive" />;
  return <Clock className="w-2.5 h-2.5 opacity-40" />;
}

/* ── Inline Media (image/video) with lazy URL fetching from media_id ── */
function InlineMedia({ type, mediaUrl, mediaId, account, caption }: {
  type: 'image' | 'video';
  mediaUrl: string | null;
  mediaId: string | null;
  account: MetaInboxAccount | null;
  caption?: string | null;
}) {
  const [src, setSrc] = useState<string | null>(mediaUrl || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (src || !mediaId || !account?.access_token) return;
    let cancelled = false;
    setLoading(true);
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://lwusznsduxcqjjmbbobt.supabase.co';
    const proxyUrl = `${supabaseUrl}/functions/v1/meta-download-media?media_id=${mediaId}&access_token=${encodeURIComponent(account.access_token)}`;
    fetch(proxyUrl)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
      })
      .then(blob => {
        if (!cancelled) setSrc(URL.createObjectURL(blob));
      })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [src, mediaId, account?.access_token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40 bg-muted/30">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !src) {
    return (
      <div className="flex items-center justify-center h-20 bg-muted/30 text-muted-foreground text-xs">
        {type === 'image' ? '[Imagem não disponível]' : '[Vídeo não disponível]'}
      </div>
    );
  }

  return (
    <div>
      {type === 'image'
        ? <img src={src} alt="imagem" className="max-w-full max-h-60 object-contain cursor-pointer" onClick={() => window.open(src, '_blank')} />
        : <video src={src} controls className="max-w-full max-h-60" />
      }
    </div>
  );
}

/* ── Inline Document with download via proxy ────────── */
function InlineDocument({ mediaUrl, mediaId, filename, account }: {
  mediaUrl: string | null;
  mediaId: string | null;
  filename: string | null;
  account: MetaInboxAccount | null;
}) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    const url = mediaUrl;
    if (url) { window.open(url, '_blank'); return; }
    if (!mediaId || !account?.access_token) return;

    setDownloading(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://lwusznsduxcqjjmbbobt.supabase.co';
      const proxyUrl = `${supabaseUrl}/functions/v1/meta-download-media?media_id=${mediaId}&access_token=${encodeURIComponent(account.access_token)}`;
      const res = await fetch(proxyUrl);
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename || 'document';
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('[InlineDocument] Download failed:', err);
    }
    setDownloading(false);
  };

  return (
    <button onClick={handleDownload} className="px-3.5 py-2 flex items-center gap-2 w-full hover:bg-muted/30 transition-colors">
      {downloading ? <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" /> : <FileText className="w-4 h-4 flex-shrink-0 opacity-70" />}
      <span className="text-xs truncate underline">{filename || 'Documento'}</span>
      <Download className="w-3 h-3 flex-shrink-0 opacity-50" />
    </button>
  );
}

/* ── Audio Player with lazy URL fetching ────────────── */
function AudioPlayer({ mediaUrl, mediaId, fromMe, account }: {
  mediaUrl: string | null;
  mediaId: string | null;
  fromMe: boolean;
  account: MetaInboxAccount | null;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [audioSrc, setAudioSrc] = useState(mediaUrl || '');
  const [loading, setLoading] = useState(false);

  const handlePlay = async () => {
    // If we have a src, just toggle play/pause
    if (audioSrc && audioRef.current) {
      if (audioRef.current.paused) { audioRef.current.play(); setPlaying(true); }
      else { audioRef.current.pause(); setPlaying(false); }
      return;
    }

    // Fetch media via proxy Edge Function (avoids CORS)
    if (mediaId && account?.access_token) {
      setLoading(true);
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://lwusznsduxcqjjmbbobt.supabase.co';
        const proxyUrl = `${supabaseUrl}/functions/v1/meta-download-media?media_id=${mediaId}&access_token=${encodeURIComponent(account.access_token)}`;
        const res = await fetch(proxyUrl);
        if (res.ok) {
          const blob = await res.blob();
          const blobUrl = URL.createObjectURL(blob);
          setAudioSrc(blobUrl);
          setTimeout(() => {
            if (audioRef.current) { audioRef.current.play(); setPlaying(true); }
          }, 100);
        }
      } catch (err) {
        console.error('[AudioPlayer] Failed to fetch media:', err);
      }
      setLoading(false);
    }
  };

  return (
    <div className={cn('flex items-center gap-2 rounded-full px-3 py-1.5 min-w-[200px]',
      fromMe ? 'bg-white/10' : 'bg-muted/50'
    )}>
      <button
        className={cn('w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
          fromMe ? 'bg-white/20 text-primary-foreground' : 'bg-primary/20 text-primary'
        )}
        onClick={handlePlay}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : playing ? (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 ml-0.5"><path d="M8 5v14l11-7z"/></svg>
        )}
      </button>
      <div className="flex items-center gap-[2px] flex-1 h-6">
        {Array.from({ length: 28 }, (_, i) => (
          <div key={i} className={cn('w-[3px] rounded-full', fromMe ? 'bg-white/40' : 'bg-primary/40')}
            style={{ height: `${Math.max(3, (Math.sin(i * 0.7) * 0.5 + 0.5) * 20)}px` }} />
        ))}
      </div>
      <Mic className={cn('w-4 h-4 flex-shrink-0', fromMe ? 'text-white/50' : 'text-primary/50')} />
      {audioSrc && (
        <audio ref={audioRef} src={audioSrc} preload="metadata" className="hidden"
          onEnded={() => setPlaying(false)} onPause={() => setPlaying(false)} />
      )}
    </div>
  );
}

function NewConversationDialog({
  open, onClose, account, onSent,
}: {
  open: boolean;
  onClose: () => void;
  account: MetaInboxAccount | null;
  onSent: () => void;
}) {
  const { toast } = useToast();
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [templates, setTemplates] = useState<any[]>([]);
  const [loadingTpl, setLoadingTpl] = useState(false);
  const [selectedTpl, setSelectedTpl] = useState<any | null>(null);
  const [tplParams, setTplParams] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  // Load approved templates when dialog opens
  useEffect(() => {
    if (!open || !account?.waba_id) return;
    setLoadingTpl(true);
    fetch(`https://graph.facebook.com/v19.0/${account.waba_id}/message_templates?access_token=${account.access_token}&fields=id,name,status,category,language,components&limit=100`)
      .then(r => r.json())
      .then(data => setTemplates((data.data || []).filter((t: any) => t.status === 'APPROVED')))
      .catch(() => {})
      .finally(() => setLoadingTpl(false));
  }, [open, account?.waba_id]);

  // When template changes, detect params {{1}}, {{2}}, etc.
  useEffect(() => {
    if (!selectedTpl) { setTplParams([]); return; }
    const bodyComp = selectedTpl.components?.find((c: any) => c.type === 'BODY');
    const text = bodyComp?.text || '';
    const matches = text.match(/\{\{\d+\}\}/g) || [];
    setTplParams(matches.map(() => ''));
  }, [selectedTpl?.id]);

  const bodyText = selectedTpl?.components?.find((c: any) => c.type === 'BODY')?.text || '';

  // Preview: replace {{1}}, {{2}} with filled values
  const previewText = tplParams.reduce((txt, val, i) => txt.replace(`{{${i + 1}}}`, val || `{{${i + 1}}}`), bodyText);

  const handleSend = async () => {
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone || !selectedTpl || !account) return;
    setSending(true);
    try {
      const empresaId = await getSaasEmpresaId();

      // 1. Create or find conversation (normalized phone)
      let convId: string;
      const { data: existing } = await (supabase as any)
        .from('meta_inbox_conversations')
        .select('id')
        .eq('account_id', account.id)
        .eq('contact_phone', normalizedPhone)
        .maybeSingle();

      if (existing) {
        convId = existing.id;
      } else {
        const { data: created, error } = await (supabase as any)
          .from('meta_inbox_conversations')
          .insert({
            account_id: account.id,
            empresa_id: empresaId,
            contact_phone: normalizedPhone,
            contact_name: name.trim() || normalizedPhone,
            status: 'open',
          })
          .select('id')
          .single();
        if (error) throw error;
        convId = created.id;
      }

      // 2. Build template components with params
      const components: any[] = [];
      if (tplParams.length > 0) {
        components.push({
          type: 'body',
          parameters: tplParams.map(v => ({ type: 'text', text: v || ' ' })),
        });
      }

      // 3. Send template with rendered body
      const result = await sendTemplateMessage(
        account, convId, normalizedPhone,
        selectedTpl.name, selectedTpl.language, components,
        previewText,
      );

      if (!result.success) throw new Error(result.error);

      toast({ title: 'Template enviado!', description: `${selectedTpl.name} → ${normalizedPhone}` });
      setPhone(''); setName(''); setSelectedTpl(null); setTplParams([]);
      onSent();
      onClose();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao enviar', description: e.message });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg bg-card border-border max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-sm flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-primary" /> Nova Conversa
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-4 pt-2">
          {/* Phone + Name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium block mb-1">Telefone (com DDI) *</label>
              <Input value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
                placeholder="5511999990001" className="h-9 text-sm bg-secondary border-border font-mono" />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Nome do contato</label>
              <Input value={name} onChange={e => setName(e.target.value)}
                placeholder="Ex: João Silva" className="h-9 text-sm bg-secondary border-border" />
            </div>
          </div>

          {/* Template selector */}
          <div>
            <label className="text-xs font-medium block mb-1">
              <LayoutTemplate className="w-3 h-3 inline mr-1" /> Template *
              <span className="text-[10px] text-muted-foreground font-normal ml-2">
                (obrigatório para primeira mensagem — fora da janela 24h)
              </span>
            </label>
            {loadingTpl ? (
              <div className="flex items-center gap-2 py-3 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /><span className="text-xs">Carregando templates...</span>
              </div>
            ) : (
              <select
                value={selectedTpl?.id || ''}
                onChange={e => {
                  const t = templates.find((t: any) => t.id === e.target.value);
                  setSelectedTpl(t || null);
                }}
                className="w-full h-9 text-sm bg-secondary border border-border rounded-md px-3"
              >
                <option value="">Selecione um template aprovado...</option>
                {templates.map((t: any) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.category} · {t.language})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Template preview + params */}
          {selectedTpl && (
            <div className="rounded-xl border border-border bg-secondary/50 p-4 space-y-3">
              {/* Preview */}
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Prévia da mensagem</p>
                <div className="bg-primary/10 rounded-xl p-3 text-sm whitespace-pre-wrap">
                  {previewText}
                </div>
              </div>

              {/* Params */}
              {tplParams.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Parâmetros ({tplParams.length})
                  </p>
                  <div className="space-y-2">
                    {tplParams.map((val, i) => (
                      <div key={i}>
                        <label className="text-[11px] text-muted-foreground block mb-0.5">
                          {`{{${i + 1}}}`}
                        </label>
                        <Input
                          value={val}
                          onChange={e => {
                            const next = [...tplParams];
                            next[i] = e.target.value;
                            setTplParams(next);
                          }}
                          placeholder={`Valor para {{${i + 1}}}`}
                          className="h-8 text-xs bg-background border-border"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Send button */}
          <Button className="w-full h-10 text-sm" disabled={!phone.trim() || !selectedTpl || sending}
            onClick={handleSend}>
            {sending
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</>
              : <><Send className="w-4 h-4 mr-2" /> Enviar template e iniciar conversa</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────────────────────────────────────────── */
export default function InboxPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [accounts, setAccounts] = useState<MetaInboxAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [selectedAccount, setSelectedAccount] = useState<MetaInboxAccount | null>(null);
  const [conversations, setConversations] = useState<InboxConversation[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(false);
  const [selectedConv, setSelectedConv] = useState<InboxConversation | null>(null);
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  type InboxFilter = 'all' | 'pending' | 'unreplied' | 'replied' | 'archived';
  type InboxSortKey = 'recent' | 'oldest' | 'alpha_asc' | 'alpha_desc';
  const [chatFilter, setChatFilter] = useState<InboxFilter>('all');
  const [chatSortKey, setChatSortKey] = useState<InboxSortKey>('recent');
  const [msgInput, setMsgInput] = useState('');
  const [sending, setSending] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newConvOpen, setNewConvOpen] = useState(false);
  const [bulkSendOpen, setBulkSendOpen] = useState(false);
  const [confirmDeleteConv, setConfirmDeleteConv] = useState<InboxConversation | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userNameCache, setUserNameCache] = useState<Record<string, string>>({});
  const [ticketPanelOpen, setTicketPanelOpen] = useState(false);
  const [convTicket, setConvTicket] = useState<any>(null);
  const [creatingTicket, setCreatingTicket] = useState(false);
  const [ticketPipelines, setTicketPipelines] = useState<{ id: string; nome: string; estagios: { id: string; nome: string }[] }[]>([]);
  const [accountUsers, setAccountUsers] = useState<{ id: string; nome: string; email: string }[]>([]);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Resolve current user's saas.usuarios.id once ──
  useEffect(() => {
    if (!user?.email) return;
    (async () => {
      try {
        const empresaId = await getSaasEmpresaId();
        const { data } = await (supabase as any)
          .schema('saas')
          .from('usuarios')
          .select('id')
          .eq('empresa_id', empresaId)
          .eq('email', user.email.toLowerCase())
          .maybeSingle();
        if (data?.id) setCurrentUserId(data.id);
      } catch { /* non-critical */ }
    })();
  }, [user?.email]);

  // ── Load ticket pipelines once ──
  useEffect(() => {
    (async () => {
      try {
        const empresaId = await getSaasEmpresaId();
        const { data: pipes } = await (supabase as any).schema('saas').from('crm_pipelines')
          .select('id, nome').eq('empresa_id', empresaId).eq('tipo', 'ticket').eq('ativo', true).order('ordem');
        if (!pipes) return;
        const result: typeof ticketPipelines = [];
        for (const p of pipes) {
          const { data: stages } = await (supabase as any).schema('saas').from('crm_pipeline_estagios')
            .select('id, nome').eq('pipeline_id', p.id).order('ordem');
          result.push({ id: p.id, nome: p.nome, estagios: stages || [] });
        }
        setTicketPipelines(result);
      } catch { /* silent */ }
    })();
  }, []);

  // ── Load ticket linked to current conversation ──
  useEffect(() => {
    setConvTicket(null);
    if (!selectedConv) return;
    (async () => {
      try {
        const { data } = await (supabase as any).schema('saas').from('crm_tickets')
          .select('id, numero_registro, titulo, descricao, status, prioridade, categoria, plataforma, tags, pipeline_id, estagio_id, proprietario_id, sla_minutos, primeira_resposta_em, criado_em, resolvido_em, ultima_atividade_em, dados_custom')
          .eq('dados_custom->>conversation_id', selectedConv.id)
          .is('deletado_em', null)
          .order('criado_em', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data) setConvTicket(data);
      } catch { /* silent */ }
    })();
  }, [selectedConv?.id]);

  // ── Load users with access to current account (for ticket owner) ──
  useEffect(() => {
    if (!selectedAccount) { setAccountUsers([]); return; }
    (async () => {
      try {
        const { data: accessRows } = await (supabase as any)
          .from('meta_inbox_user_access')
          .select('usuario_id')
          .eq('account_id', selectedAccount.id);
        const userIds = (accessRows || []).map((r: any) => r.usuario_id).filter(Boolean);
        if (userIds.length === 0) {
          // No access restrictions — load all active users
          const empresaId = await getSaasEmpresaId();
          const { data } = await (supabase as any).schema('saas').from('usuarios')
            .select('id, nome, email').eq('empresa_id', empresaId).eq('status', 'ativo').order('nome');
          setAccountUsers(data || []);
        } else {
          const empresaId = await getSaasEmpresaId();
          const { data } = await (supabase as any).schema('saas').from('usuarios')
            .select('id, nome, email').eq('empresa_id', empresaId).in('id', userIds).order('nome');
          setAccountUsers(data || []);
        }
      } catch { setAccountUsers([]); }
    })();
  }, [selectedAccount?.id]);

  // ── Load accounts (filtered by user access for restricted roles) ──
  const needsAccessFilter = user?.role === 'support' || user?.role === 'member';

  const loadAccountsFn = useCallback(async () => {
    setLoadingAccounts(true);
    try {
      const empresaId = await getSaasEmpresaId();
      const { data: allAccounts, error } = await (supabase as any)
        .from('meta_inbox_accounts')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: true });
      if (error) throw error;

      let filtered = allAccounts || [];

      // For support/member roles, filter by meta_inbox_user_access
      if (needsAccessFilter && user?.email) {
        // Resolve saas.usuarios.id from email
        const { data: usr } = await (supabase as any)
          .schema('saas')
          .from('usuarios')
          .select('id')
          .eq('empresa_id', empresaId)
          .eq('email', user.email.toLowerCase())
          .maybeSingle();

        if (usr?.id) {
          const { data: accessRows } = await (supabase as any)
            .from('meta_inbox_user_access')
            .select('account_id')
            .eq('usuario_id', usr.id);

          const allowedIds = new Set((accessRows || []).map((r: any) => r.account_id));
          filtered = filtered.filter((a: MetaInboxAccount) => allowedIds.has(a.id));
        } else {
          filtered = [];
        }
      }

      // Decrypt access_tokens loaded from DB
      filtered = await Promise.all(
        filtered.map((a: MetaInboxAccount) => decryptAccountTokens(a)),
      );

      setAccounts(filtered);
      if (filtered.length > 0 && !selectedAccount) {
        // Check URL for inbox param
        const inboxParam = searchParams.get('inbox');
        const match = inboxParam ? filtered.find(a => a.phone_number_id === inboxParam || a.id === inboxParam) : null;
        setSelectedAccount(match || filtered[0]);
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao carregar contas', description: e.message });
    } finally {
      setLoadingAccounts(false);
    }
  }, [needsAccessFilter, user?.email]);

  useEffect(() => { loadAccountsFn(); }, [loadAccountsFn]);

  // ── Load conversations when account changes ────────────
  const loadConvs = useCallback(async () => {
    if (!selectedAccount) { setConversations([]); return; }
    setLoadingConvs(true);
    try {
      const data = await loadConversations(selectedAccount.id);
      setConversations(data);
    } catch { /* silent */ }
    finally { setLoadingConvs(false); }
  }, [selectedAccount?.id]);

  useEffect(() => {
    loadConvs();
    // Don't clear selection if coming from URL
    if (!searchParams.get('phone')) { setSelectedConv(null); setMessages([]); }
  }, [loadConvs]);

  // Auto-select conversation from URL params
  useEffect(() => {
    const phone = searchParams.get('phone');
    if (phone && conversations.length > 0 && !selectedConv) {
      const match = conversations.find(c => c.contact_phone === phone);
      if (match) setSelectedConv(match);
    }
  }, [conversations, searchParams]);

  // Poll conversations every 5s — merge instead of replace to preserve scroll position
  useEffect(() => {
    if (!selectedAccount) return;
    const t = setInterval(async () => {
      try {
        const fresh = await loadConversations(selectedAccount.id);
        setConversations(prev => {
          // Only update if something actually changed
          if (prev.length !== fresh.length) return fresh;
          let changed = false;
          const merged = prev.map(old => {
            const updated = fresh.find(f => f.id === old.id);
            if (!updated) { changed = true; return old; }
            // Check if any visible field changed
            if (
              old.last_message !== updated.last_message ||
              old.last_message_ts !== updated.last_message_ts ||
              old.unread_count !== updated.unread_count ||
              old.contact_name !== updated.contact_name ||
              old.status !== updated.status
            ) {
              changed = true;
              return updated;
            }
            return old; // keep same reference
          });
          // Check for new conversations not in prev
          const newConvs = fresh.filter(f => !prev.some(p => p.id === f.id));
          if (newConvs.length > 0) { changed = true; merged.push(...newConvs); }
          return changed ? merged : prev;
        });
      } catch { /* silent */ }
    }, 5000);
    return () => clearInterval(t);
  }, [selectedAccount?.id]);

  // ── Load messages when conversation changes ────────────
  const loadMsgs = useCallback(async () => {
    if (!selectedConv) { setMessages([]); return; }
    setLoadingMsgs(true);
    try {
      const data = await loadMessages(selectedConv.id, selectedAccount?.id);
      setMessages(data);
      markConversationRead(selectedConv.id, selectedAccount?.id);
    } catch { /* silent */ }
    finally { setLoadingMsgs(false); }
  }, [selectedConv?.id]);

  useEffect(() => { loadMsgs(); }, [loadMsgs]);

  // Poll messages every 3s
  useEffect(() => {
    if (!selectedConv) return;
    const t = setInterval(async () => {
      const data = await loadMessages(selectedConv.id, selectedAccount?.id);
      setMessages(data);
    }, 3000);
    return () => clearInterval(t);
  }, [selectedConv?.id]);

  // Auto-scroll: only when new messages arrive and user is near bottom
  const prevMsgCountRef = useRef(0);
  useEffect(() => {
    if (messages.length !== prevMsgCountRef.current) {
      const container = messagesEndRef.current?.parentElement;
      const isNearBottom = !container || (container.scrollHeight - container.scrollTop - container.clientHeight < 150);
      if (isNearBottom || prevMsgCountRef.current === 0) {
        messagesEndRef.current?.scrollIntoView({ behavior: prevMsgCountRef.current === 0 ? 'auto' : 'smooth' });
      }
      prevMsgCountRef.current = messages.length;
    }
  }, [messages]);

  // ── Resolve sender names for sent messages ──
  useEffect(() => {
    const userIds = [...new Set(messages.filter(m => m.sent_by_user_id).map(m => m.sent_by_user_id!))];
    const unknown = userIds.filter(id => !userNameCache[id]);
    if (unknown.length === 0) return;
    (async () => {
      try {
        const empresaId = await getSaasEmpresaId();
        const { data } = await (supabase as any)
          .schema('saas')
          .from('usuarios')
          .select('id, nome')
          .eq('empresa_id', empresaId)
          .in('id', unknown);
        if (data) {
          const newEntries: Record<string, string> = {};
          for (const u of data) newEntries[u.id] = u.nome || 'Usuário';
          setUserNameCache(prev => ({ ...prev, ...newEntries }));
        }
      } catch { /* non-critical */ }
    })();
  }, [messages]);

  // ── Create ticket from conversation ────────────────────
  const handleCreateTicket = async () => {
    if (!selectedConv || !selectedAccount) return;
    setCreatingTicket(true);
    try {
      const empresaId = await getSaasEmpresaId();
      const pipelineId = selectedAccount.ticket_pipeline_id;
      const estagioId = selectedAccount.ticket_estagio_id;
      const prioridade = selectedAccount.ticket_prioridade || 'medium';

      if (!pipelineId || !estagioId) {
        toast({ variant: 'destructive', title: 'Pipeline não configurado', description: 'Configure o pipeline de tickets nas configurações desta conta.' });
        setCreatingTicket(false);
        return;
      }

      const titulo = `${selectedConv.contact_name || selectedConv.contact_phone} — WhatsApp`;
      const descricao = selectedConv.last_message || '';

      const { data, error } = await (supabase as any).schema('saas').from('crm_tickets').insert({
        empresa_id: empresaId,
        titulo,
        descricao,
        pipeline_id: pipelineId,
        estagio_id: estagioId,
        prioridade,
        status: 'aberto',
        plataforma: 'whatsapp',
        proprietario_id: currentUserId || null,
        dados_custom: {
          conversation_id: selectedConv.id,
          account_id: selectedAccount.id,
          contact_phone: selectedConv.contact_phone,
          contact_name: selectedConv.contact_name,
        },
      }).select().single();

      if (error) throw error;
      setConvTicket(data);
      setTicketPanelOpen(true);
      toast({ title: 'Ticket criado!', description: `#${data.numero_registro} — ${titulo}` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao criar ticket', description: e.message });
    } finally {
      setCreatingTicket(false);
    }
  };

  const handleUpdateTicket = async (field: string, value: string) => {
    if (!convTicket) return;
    try {
      await (supabase as any).schema('saas').from('crm_tickets')
        .update({ [field]: value, ...(field === 'status' && value === 'resolvido' ? { resolvido_em: new Date().toISOString() } : {}) })
        .eq('id', convTicket.id);
      setConvTicket((prev: any) => prev ? { ...prev, [field]: value } : prev);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao atualizar ticket', description: e.message });
    }
  };

  // ── 24h window check ───────────────────────────────────
  const within24h = selectedConv ? isWithin24hWindow(selectedConv.last_inbound_ts) : false;

  // ── Send text ──────────────────────────────────────────
  const handleSendText = async () => {
    if (!msgInput.trim() || !selectedConv || !selectedAccount) return;
    setSending(true);
    const result = await sendTextMessage(selectedAccount, selectedConv.id, selectedConv.contact_phone, msgInput.trim(), currentUserId || undefined);
    if (result.success) {
      setMsgInput('');
      const data = await loadMessages(selectedConv.id, selectedAccount?.id);
      setMessages(data);
    } else {
      toast({ variant: 'destructive', title: 'Erro ao enviar', description: result.error });
    }
    setSending(false);
  };

  // ── Send file (image/audio/video/document) ─────────────
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedConv || !selectedAccount) return;
    e.target.value = '';

    setSending(true);
    try {
      // Determine type
      const type = file.type.startsWith('image/') ? 'image'
        : file.type.startsWith('audio/') ? 'audio'
        : file.type.startsWith('video/') ? 'video'
        : 'document';

      // Upload to Supabase Storage, send public URL to Meta (avoids CORS + format issues)
      const ext = file.name.split('.').pop() || 'bin';
      const storagePath = `${type}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('inbox-media').upload(storagePath, file, { contentType: file.type, upsert: true });
      if (upErr) throw new Error(upErr.message);
      const { data: urlData } = supabase.storage.from('inbox-media').getPublicUrl(storagePath);
      if (!urlData?.publicUrl) throw new Error('URL pública não disponível');

      const result = await sendMediaMessage(
        selectedAccount, selectedConv.id, selectedConv.contact_phone,
        type, urlData.publicUrl, '', type === 'document' ? file.name : undefined,
        false, currentUserId || undefined,
      );

      if (result.success) {
        const data = await loadMessages(selectedConv.id, selectedAccount?.id);
        setMessages(data);
      } else {
        toast({ variant: 'destructive', title: 'Erro ao enviar mídia', description: result.error });
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro no upload', description: err.message });
    }
    setSending(false);
  };

  // ── Send template ──────────────────────────────────────
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [pickerSelectedTpl, setPickerSelectedTpl] = useState<any | null>(null);
  const [pickerParams, setPickerParams] = useState<string[]>([]);
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [templatesList, setTemplatesList] = useState<any[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  const openTemplatePicker = async () => {
    if (!selectedAccount?.waba_id) {
      toast({ variant: 'destructive', title: 'WABA ID não configurado' });
      return;
    }
    setShowTemplatePicker(true);
    setLoadingTemplates(true);
    try {
      const url = `https://graph.facebook.com/v19.0/${selectedAccount.waba_id}/message_templates?access_token=${selectedAccount.access_token}&fields=id,name,status,category,language,components&limit=50`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTemplatesList((data.data || []).filter((t: any) => t.status === 'APPROVED'));
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro ao buscar templates', description: err.message });
    }
    setLoadingTemplates(false);
  };

  const handleSendTemplate = async () => {
    if (!selectedConv || !selectedAccount || !pickerSelectedTpl) return;
    setSending(true);
    try {
      const bodyComp = pickerSelectedTpl.components?.find((c: any) => c.type === 'BODY');
      const bodyRaw = bodyComp?.text || pickerSelectedTpl.name;
      const renderedBody = pickerParams.reduce((txt: string, val: string, i: number) => txt.replace(`{{${i + 1}}}`, val || `{{${i + 1}}}`), bodyRaw);

      const components: any[] = [];
      if (pickerParams.length > 0) {
        components.push({
          type: 'body',
          parameters: pickerParams.map(v => ({ type: 'text', text: v || ' ' })),
        });
      }

      const result = await sendTemplateMessage(
        selectedAccount, selectedConv.id, selectedConv.contact_phone,
        pickerSelectedTpl.name, pickerSelectedTpl.language, components, renderedBody,
        currentUserId || undefined,
      );
      if (result.success) {
        const data = await loadMessages(selectedConv.id, selectedAccount?.id);
        setMessages(data);
        toast({ title: 'Template enviado!', description: pickerSelectedTpl.name });
      } else {
        toast({ variant: 'destructive', title: 'Erro ao enviar template', description: result.error });
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    }
    setShowTemplatePicker(false);
    setPickerSelectedTpl(null);
    setPickerParams([]);
    setSending(false);
  };

  // ── Start new conversation ─────────────────────────────
  // ── Retry failed message ────────────────────────────────
  const handleRetry = async (msg: InboxMessage) => {
    if (!selectedAccount || !selectedConv) return;
    setSending(true);
    try {
      let result: { success: boolean; error?: string };
      if (msg.msg_type === 'template' && msg.template_name) {
        result = await sendTemplateMessage(
          selectedAccount, selectedConv.id, selectedConv.contact_phone,
          msg.template_name, msg.template_language || 'pt_BR',
          msg.template_components ? JSON.parse(msg.template_components as any) : undefined,
          msg.body || undefined,
          currentUserId || undefined,
        );
      } else {
        result = await sendTextMessage(selectedAccount, selectedConv.id, selectedConv.contact_phone, msg.body || '', currentUserId || undefined);
      }
      if (result.success) {
        // Delete the failed message
        await (supabase as any).from('meta_inbox_messages').delete().eq('id', msg.id);
        const data = await loadMessages(selectedConv.id, selectedAccount?.id);
        setMessages(data);
        toast({ title: 'Mensagem reenviada!' });
      } else {
        toast({ variant: 'destructive', title: 'Erro ao reenviar', description: result.error });
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    }
    setSending(false);
  };

  // ── Audio recording ────────────────────────────────────
  const startRecording = async () => {
    if (!selectedAccount || !selectedConv) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (blob.size < 100) return;
        setSending(true);
        try {
          // Send WebM to Python converter → converts to OGG/Opus → uploads to Meta
          const converterUrl = import.meta.env.VITE_AUDIO_CONVERTER_URL || 'https://literate-space-carnival-x5jrwvrrxx97fx4p-8787.app.github.dev';
          const formData = new FormData();
          formData.append('file', new File([blob], 'audio.webm', { type: 'audio/webm' }));
          formData.append('phone_number_id', selectedAccount!.phone_number_id);
          formData.append('access_token', selectedAccount!.access_token);

          const uploadRes = await fetch(`${converterUrl}/convert-and-upload`, { method: 'POST', body: formData });
          const uploadData = await uploadRes.json();
          if (uploadData.error || !uploadData.id) throw new Error(uploadData.error || 'Conversão falhou');

          // Send as voice message (voice: true = waveform appearance)
          const result = await sendMediaMessage(
            selectedAccount!, selectedConv!.id, selectedConv!.contact_phone,
            'audio', uploadData.id, undefined, undefined, true, currentUserId || undefined,
          );
          if (result.success) {
            const data = await loadMessages(selectedConv!.id, selectedAccount?.id);
            setMessages(data);
          } else {
            toast({ variant: 'destructive', title: 'Erro ao enviar áudio', description: result.error });
          }
        } catch (e: any) {
          toast({ variant: 'destructive', title: 'Erro', description: e.message });
        }
        setSending(false);
      };
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setRecording(true);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao acessar microfone', description: e.message });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  };

  // ── Archive/unarchive conversation ──────────────────────
  const handleArchiveConversation = async (conv: InboxConversation) => {
    const newStatus = conv.status === 'archived' ? 'open' : 'archived';
    try {
      await (supabase as any).from('meta_inbox_conversations')
        .update({ status: newStatus })
        .eq('id', conv.id);
      setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, status: newStatus } : c));
      if (newStatus === 'archived' && selectedConv?.id === conv.id) {
        setSelectedConv(null); setMessages([]);
      }
      toast({ title: newStatus === 'archived' ? 'Conversa arquivada' : 'Conversa desarquivada' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    }
  };

  // ── Delete conversation ─────────────────────────────────
  const handleDeleteConversation = async (conv: InboxConversation) => {
    try {
      // Delete messages first, then conversation
      await (supabase as any).from('meta_inbox_messages').delete().eq('conversation_id', conv.id).eq('account_id', selectedAccount?.id);
      await (supabase as any).from('meta_inbox_conversations').delete().eq('id', conv.id).eq('account_id', selectedAccount?.id);
      if (selectedConv?.id === conv.id) { setSelectedConv(null); setMessages([]); }
      setConfirmDeleteConv(null);
      await loadConvs();
      toast({ title: 'Conversa apagada' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao apagar', description: e.message });
    }
  };

  // ── Filter & sort conversations ────────────────────────
  const filteredConvs = (() => {
    let list = conversations.filter(c =>
      !searchQuery ||
      (c.contact_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.contact_phone.includes(searchQuery)
    );

    // Hide archived unless explicitly viewing archived filter
    if (chatFilter !== 'archived') {
      list = list.filter(c => c.status !== 'archived');
    }

    // Status filter
    if (chatFilter === 'pending') {
      list = list.filter(c => c.unread_count > 0);
    } else if (chatFilter === 'unreplied') {
      list = list.filter(c => !c.last_message_from_me && c.unread_count === 0);
    } else if (chatFilter === 'replied') {
      list = list.filter(c => c.last_message_from_me);
    } else if (chatFilter === 'archived') {
      list = list.filter(c => c.status === 'archived');
    }

    // Sort
    list = [...list].sort((a, b) => {
      if (chatSortKey === 'oldest') return new Date(a.last_message_ts || 0).getTime() - new Date(b.last_message_ts || 0).getTime();
      if (chatSortKey === 'alpha_asc') return (a.contact_name || a.contact_phone).localeCompare(b.contact_name || b.contact_phone, 'pt-BR');
      if (chatSortKey === 'alpha_desc') return (b.contact_name || b.contact_phone).localeCompare(a.contact_name || a.contact_phone, 'pt-BR');
      return new Date(b.last_message_ts || 0).getTime() - new Date(a.last_message_ts || 0).getTime(); // recent default
    });

    return list;
  })();

  /* ── No accounts state ──────────────────────────────── */
  if (!loadingAccounts && accounts.length === 0) {
    return (
      <>
        <div className="flex h-full items-center justify-center flex-col gap-5 p-8">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Inbox className="w-8 h-8 text-primary" />
          </div>
          <div className="text-center max-w-sm">
            <h2 className="text-lg font-semibold mb-1">
              {needsAccessFilter ? 'Nenhuma caixa de entrada atribuída' : 'Nenhuma caixa de entrada configurada'}
            </h2>
            <p className="text-sm text-muted-foreground mb-5">
              {needsAccessFilter
                ? 'Solicite ao administrador acesso a uma ou mais caixas de entrada.'
                : 'Conecte uma conta da API Oficial do WhatsApp (Meta) para começar a receber e enviar mensagens.'}
            </p>
            {!needsAccessFilter && (
              <Button onClick={() => setSettingsOpen(true)} className="gap-2">
                <Plus className="w-4 h-4" /> Conectar conta Meta WABA
              </Button>
            )}
          </div>
        </div>
        {settingsOpen && <InboxSettingsModal onClose={() => setSettingsOpen(false)} onSaved={loadAccountsFn} />}
      </>
    );
  }

  /* ── Main 3-column layout ───────────────────────────── */
  return (
    <div className="flex h-full overflow-hidden">
      {/* Col 1 — Accounts */}
      <div className="w-[200px] flex-shrink-0 border-r border-border flex flex-col bg-sidebar">
        <div className="h-14 flex items-center justify-between px-3 border-b border-border flex-shrink-0">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contas</span>
          <Button variant="ghost" size="icon" className="w-6 h-6" onClick={() => setSettingsOpen(true)} title="Configurações">
            <Settings className="w-3.5 h-3.5" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto py-1.5 px-1.5 space-y-0.5">
          {loadingAccounts ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : accounts.map(acc => (
            <button key={acc.id} onClick={() => setSelectedAccount(acc)}
              className={cn('w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left transition-colors',
                selectedAccount?.id === acc.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted/60 text-foreground')}>
              <div className="w-7 h-7 rounded-full bg-green-500/15 flex items-center justify-center flex-shrink-0">
                <MessageSquare className="w-3.5 h-3.5 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{acc.nome}</p>
                <p className="text-[10px] text-muted-foreground truncate">{acc.phone_display || acc.phone_number_id}</p>
              </div>
              <span className={cn('w-2 h-2 rounded-full flex-shrink-0', acc.status === 'active' ? 'bg-green-500' : 'bg-muted-foreground/40')} />
            </button>
          ))}
        </div>
        {!needsAccessFilter && (
          <div className="p-2 border-t border-border">
            <Button variant="outline" size="sm" className="w-full text-xs h-8 gap-1.5" onClick={() => setSettingsOpen(true)}>
              <Plus className="w-3 h-3" /> Adicionar conta
            </Button>
          </div>
        )}
      </div>

      {/* Col 2 — Conversations */}
      <div className="w-[300px] flex-shrink-0 border-r border-border flex flex-col bg-background">
        <div className="h-14 flex items-center gap-2 px-3 border-b border-border flex-shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar conversa..." className="h-8 text-xs pl-8 bg-muted/40 border-border" />
          </div>
          <Button variant="ghost" size="icon" className="w-8 h-8 flex-shrink-0" onClick={loadConvs} title="Atualizar">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="w-8 h-8 flex-shrink-0" onClick={() => setNewConvOpen(true)} title="Nova conversa">
            <UserPlus className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="w-8 h-8 flex-shrink-0" onClick={() => setBulkSendOpen(true)} title="Envio em lote">
            <Send className="w-3.5 h-3.5" />
          </Button>
        </div>

        {selectedAccount && (
          <div className="px-3 py-1.5 bg-green-500/5 border-b border-border flex items-center gap-2">
            <MessageSquare className="w-3 h-3 text-green-600 flex-shrink-0" />
            <p className="text-[10px] text-muted-foreground truncate flex-1">{selectedAccount.nome}</p>
            <Badge variant="outline" className="text-[9px] h-4 px-1">
              {selectedAccount.status === 'active' ? 'Ativo' : 'Pendente'}
            </Badge>
          </div>
        )}

        {/* Chat status filters */}
        <div className="px-2 py-1.5 border-b border-border flex-shrink-0 flex gap-1">
          {([
            { key: 'all',       label: 'Todas' },
            { key: 'pending',   label: 'Pendentes' },
            { key: 'unreplied', label: 'N. Resp.' },
            { key: 'replied',   label: 'Respond.' },
            { key: 'archived',  label: 'Arquiv.' },
          ] as const).map(f => {
            const count = f.key === 'all' ? conversations.filter(c => c.status !== 'archived').length
              : f.key === 'pending' ? conversations.filter(c => c.status !== 'archived' && c.unread_count > 0).length
              : f.key === 'unreplied' ? conversations.filter(c => c.status !== 'archived' && !c.last_message_from_me && c.unread_count === 0).length
              : f.key === 'replied' ? conversations.filter(c => c.status !== 'archived' && c.last_message_from_me).length
              : conversations.filter(c => c.status === 'archived').length;
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
            { key: 'recent',     label: 'Recente \u2193' },
            { key: 'oldest',     label: 'Antigo \u2191' },
            { key: 'alpha_asc',  label: 'A\u2013Z' },
            { key: 'alpha_desc', label: 'Z\u2013A' },
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

        <div className="flex-1 overflow-y-auto">
          {loadingConvs ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : filteredConvs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
              <MessageSquare className="w-8 h-8 opacity-30" />
              <p className="text-xs">Nenhuma conversa</p>
              <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={() => setNewConvOpen(true)}>
                <UserPlus className="w-3 h-3" /> Nova conversa
              </Button>
            </div>
          ) : filteredConvs.map(conv => (
            <div key={conv.id}
              onClick={() => {
                setSelectedConv(conv);
                markConversationRead(conv.id, selectedAccount?.id);
                const params: Record<string, string> = {};
                if (selectedAccount) params.inbox = selectedAccount.phone_number_id || selectedAccount.id;
                params.phone = conv.contact_phone;
                setSearchParams(params, { replace: true });
              }}
              className={cn('flex items-start gap-2.5 px-3 py-3 cursor-pointer border-b border-border/50 transition-colors',
                selectedConv?.id === conv.id ? 'bg-primary/5' : 'hover:bg-muted/40')}>
              <AvatarInitials name={conv.contact_name || conv.contact_phone} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <p className="text-xs font-semibold truncate">{conv.contact_name || conv.contact_phone}</p>
                  <span className="text-[10px] text-muted-foreground flex-shrink-0 ml-1">
                    {conv.last_message_ts ? formatTime(conv.last_message_ts) : ''}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-1">
                  <p className="text-[11px] text-muted-foreground truncate">{conv.last_message || '...'}</p>
                  {conv.unread_count > 0 && (
                    <Badge className="h-4 min-w-[16px] px-1 text-[9px] flex-shrink-0" style={{ background: 'hsl(var(--primary))' }}>
                      {conv.unread_count}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Col 3 — Messages */}
      <div className="flex-1 flex flex-col overflow-hidden bg-background">
        {!selectedConv ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <MessageSquare className="w-12 h-12 opacity-20" />
            <p className="text-sm">Selecione uma conversa</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="h-14 border-b border-border flex items-center gap-3 px-4 flex-shrink-0 bg-card">
              <AvatarInitials name={selectedConv.contact_name || selectedConv.contact_phone} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{selectedConv.contact_name || selectedConv.contact_phone}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Phone className="w-3 h-3" /> {selectedConv.contact_phone}
                </p>
              </div>
              {/* 24h window indicator */}
              <span className={cn('text-[9px] px-2 py-0.5 rounded-full border font-medium',
                within24h
                  ? 'bg-green-500/10 text-green-500 border-green-500/20'
                  : 'bg-warning/10 text-warning border-warning/20'
              )}>
                {within24h ? '24h ativa' : 'Fora da janela'}
              </span>
              {/* Ticket button */}
              {selectedAccount?.ticket_enabled && (
                convTicket ? (
                  <Button variant="ghost" size="sm" className={cn('h-8 text-xs gap-1', ticketPanelOpen ? 'text-orange-500' : 'text-muted-foreground')}
                    onClick={() => setTicketPanelOpen(!ticketPanelOpen)}
                    title="Ver ticket">
                    <Ticket className="w-3.5 h-3.5" />
                    <span className="font-mono">#{convTicket.numero_registro}</span>
                    {ticketPanelOpen ? <PanelRightClose className="w-3 h-3" /> : <PanelRightOpen className="w-3 h-3" />}
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" className="h-8 text-xs gap-1 text-muted-foreground hover:text-orange-500"
                    onClick={handleCreateTicket} disabled={creatingTicket}
                    title="Abrir ticket">
                    {creatingTicket ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ticket className="w-3.5 h-3.5" />}
                    Abrir Ticket
                  </Button>
                )
              )}
              {/* Archive/unarchive chat */}
              <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground hover:text-foreground"
                title={selectedConv.status === 'archived' ? 'Desarquivar conversa' : 'Arquivar conversa'}
                onClick={() => handleArchiveConversation(selectedConv)}>
                {selectedConv.status === 'archived' ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
              </Button>
              {/* Delete chat */}
              <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground hover:text-destructive"
                title="Apagar conversa"
                onClick={() => setConfirmDeleteConv(selectedConv)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>

            {/* 24h warning banner */}
            {!within24h && (
              <div className="px-4 py-2 bg-warning/5 border-b border-warning/20 flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-warning flex-shrink-0" />
                <p className="text-[10px] text-warning">
                  Fora da janela de 24h — apenas templates aprovados podem ser enviados.
                </p>
                <Button size="sm" variant="outline" className="text-[10px] h-6 px-2 ml-auto border-warning/30 text-warning"
                  onClick={openTemplatePicker}>
                  <LayoutTemplate className="w-3 h-3 mr-1" /> Enviar template
                </Button>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2" style={{ background: 'hsl(var(--muted)/0.2)' }}>
              {loadingMsgs ? (
                <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                  <MessageSquare className="w-8 h-8 opacity-20 mb-2" />
                  <p className="text-xs">Nenhuma mensagem nesta conversa</p>
                </div>
              ) : messages.map(msg => {
                // Parse template components if available
                let tplComps: any[] = [];
                try { tplComps = msg.template_components ? (typeof msg.template_components === 'string' ? JSON.parse(msg.template_components) : msg.template_components) : []; } catch { /* */ }

                return (
                <div key={msg.id} className={cn('flex', msg.from_me ? 'justify-end' : 'justify-start')}>
                  <div className={cn(
                    'max-w-[70%] rounded-2xl text-sm shadow-sm overflow-hidden',
                    msg.from_me
                      ? 'bg-primary text-primary-foreground rounded-br-sm'
                      : 'bg-card text-foreground border border-border rounded-bl-sm'
                  )}>
                    {/* Media: image, video, sticker — resolve via media_url or media_id proxy */}
                    {(msg.msg_type === 'image' || msg.msg_type === 'video' || msg.msg_type === 'sticker') && (msg.media_url || msg.media_id) && (
                      <InlineMedia
                        type={msg.msg_type === 'video' ? 'video' : 'image'}
                        mediaUrl={msg.media_url}
                        mediaId={msg.media_id}
                        account={selectedAccount}
                        caption={msg.caption}
                      />
                    )}
                    {/* Audio — WhatsApp style player */}
                    {(msg.msg_type === 'audio' || msg.msg_type === 'ptt') && (
                      <div className="px-3 py-2">
                        <AudioPlayer
                          mediaUrl={msg.media_url}
                          mediaId={msg.media_id}
                          fromMe={msg.from_me}
                          account={selectedAccount}
                        />
                      </div>
                    )}
                    {/* Document — download link via proxy */}
                    {msg.msg_type === 'document' && (msg.media_url || msg.media_id) && (
                      <InlineDocument
                        mediaUrl={msg.media_url}
                        mediaId={msg.media_id}
                        filename={msg.media_filename}
                        account={selectedAccount}
                      />
                    )}
                    {msg.msg_type === 'document' && !msg.media_url && !msg.media_id && (
                      <div className="px-3.5 py-2 flex items-center gap-2">
                        <FileText className="w-4 h-4 flex-shrink-0 opacity-70" />
                        <span className="text-xs truncate">{msg.media_filename || msg.body}</span>
                      </div>
                    )}
                    {/* Body text (hide for pure media messages) */}
                    {msg.body && !['document', 'audio', 'ptt', 'sticker'].includes(msg.msg_type) && !msg.body.startsWith('[Imagem]') && !msg.body.startsWith('[Vídeo]') && !msg.body.startsWith('[Áudio]') && !msg.body.startsWith('[Sticker]') && (
                      <p className="px-3.5 py-2 leading-relaxed whitespace-pre-wrap">{msg.body}</p>
                    )}
                    {/* Caption for media messages */}
                    {msg.caption && (msg.msg_type === 'image' || msg.msg_type === 'video' || msg.msg_type === 'document') && (
                      <p className="px-3.5 py-1.5 text-xs opacity-80 whitespace-pre-wrap">{msg.caption}</p>
                    )}
                    {/* Template buttons */}
                    {msg.msg_type === 'template' && tplComps.length > 0 && (() => {
                      const btnComp = tplComps.find((c: any) => c.type === 'BUTTONS' || c.type === 'buttons');
                      const buttons = btnComp?.buttons || [];
                      if (buttons.length === 0) return null;
                      return (
                        <div className="border-t border-white/10 px-3.5 py-1.5 flex flex-wrap gap-1">
                          {buttons.map((btn: any, bi: number) => (
                            <span key={bi} className={cn(
                              'text-[10px] px-2.5 py-1 rounded-full border font-medium',
                              msg.from_me ? 'border-white/20 text-primary-foreground/80' : 'border-border text-muted-foreground'
                            )}>
                              {btn.text}
                            </span>
                          ))}
                        </div>
                      );
                    })()}
                    {/* Error + retry */}
                    {msg.error_message && (
                      <div className="px-3.5 pb-1">
                        <p className="text-[9px] text-destructive flex items-center gap-1">
                          <AlertTriangle className="w-2.5 h-2.5" /> {msg.error_message}
                        </p>
                        <button onClick={() => handleRetry(msg)}
                          className="text-[9px] text-primary-foreground/80 hover:text-primary-foreground flex items-center gap-1 mt-0.5 underline">
                          <RotateCcw className="w-2.5 h-2.5" /> Reenviar
                        </button>
                      </div>
                    )}
                    {msg.status === 'failed' && !msg.error_message && (
                      <div className="px-3.5 pb-1">
                        <button onClick={() => handleRetry(msg)}
                          className="text-[9px] text-primary-foreground/80 hover:text-primary-foreground flex items-center gap-1 underline">
                          <RotateCcw className="w-2.5 h-2.5" /> Reenviar
                        </button>
                      </div>
                    )}
                    {/* Timestamp + sender + status */}
                    <div className={cn('flex items-center gap-1 px-3.5 pb-1.5', msg.from_me ? 'justify-end' : 'justify-start')}>
                      {msg.from_me && msg.sent_by_user_id && userNameCache[msg.sent_by_user_id] && (
                        <span className="text-[10px] opacity-50 mr-0.5">{userNameCache[msg.sent_by_user_id]}</span>
                      )}
                      <span className="text-[10px] opacity-70">{formatTime(msg.timestamp)}</span>
                      {msg.from_me && <MsgStatusIcon status={msg.status} />}
                    </div>
                  </div>
                </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input bar */}
            <div className="border-t border-border p-3 flex items-center gap-1.5 bg-card flex-shrink-0">
              {/* Hidden file input */}
              <input ref={fileInputRef} type="file" className="hidden"
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
                onChange={handleFileSelect} />

              {/* Attach button */}
              <Button variant="ghost" size="icon" className="w-9 h-9 flex-shrink-0 text-muted-foreground"
                onClick={() => fileInputRef.current?.click()} disabled={sending} title="Enviar arquivo">
                <Paperclip className="w-4 h-4" />
              </Button>

              {/* Template button */}
              <Button variant="ghost" size="icon" className="w-9 h-9 flex-shrink-0 text-muted-foreground"
                onClick={openTemplatePicker} disabled={sending} title="Enviar template">
                <LayoutTemplate className="w-4 h-4" />
              </Button>

              {/* Text input */}
              <Input value={msgInput} onChange={e => setMsgInput(e.target.value)}
                placeholder={recording ? '🔴 Gravando áudio...' : within24h ? 'Escreva uma mensagem...' : 'Fora da janela 24h — use template'}
                className={cn('flex-1 h-9 text-sm bg-muted/40 border-border', recording && 'border-destructive/50')}
                disabled={!within24h || sending || recording}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendText(); } }} />

              {/* Mic / Send button */}
              {msgInput.trim() ? (
                <Button size="icon" className="w-9 h-9 flex-shrink-0"
                  onClick={handleSendText} disabled={!within24h || sending}>
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              ) : recording ? (
                <Button size="icon" className="w-9 h-9 flex-shrink-0 bg-destructive hover:bg-destructive/90"
                  onClick={stopRecording} title="Parar e enviar áudio">
                  <Send className="w-4 h-4" />
                </Button>
              ) : (
                <Button size="icon" variant="ghost" className="w-9 h-9 flex-shrink-0 text-muted-foreground"
                  onClick={startRecording} disabled={!within24h || sending} title="Gravar áudio">
                  <Mic className="w-4 h-4" />
                </Button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Col 4 — Ticket side panel */}
      {ticketPanelOpen && convTicket && selectedAccount && (() => {
        const statusColors: Record<string, string> = {
          aberto: 'bg-green-500', em_andamento: 'bg-blue-500', aguardando: 'bg-yellow-500', resolvido: 'bg-emerald-500', fechado: 'bg-gray-500',
        };
        const statusLabels: Record<string, string> = {
          aberto: 'Aberto', em_andamento: 'Em andamento', aguardando: 'Aguardando', resolvido: 'Resolvido', fechado: 'Fechado',
        };
        const prioLabels: Record<string, string> = { low: 'Baixa', medium: 'Média', high: 'Alta', urgent: 'Urgente' };
        const prioColors: Record<string, string> = { low: '🟢', medium: '🟡', high: '🟠', urgent: '🔴' };
        const fmtDate = (d: string | null) => d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
        const ownerUser = accountUsers.find(u => u.id === convTicket.proprietario_id);

        return (
        <div className="w-[340px] flex-shrink-0 border-l border-border bg-card flex flex-col overflow-hidden">
          {/* Header */}
          <div className="p-3 border-b border-border flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <Ticket className="w-4 h-4 text-orange-500" />
              <span className="text-sm font-semibold">#{convTicket.numero_registro}</span>
              <span className={cn('w-2 h-2 rounded-full', statusColors[convTicket.status] || 'bg-gray-500')} title={statusLabels[convTicket.status]} />
            </div>
            <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => setTicketPanelOpen(false)}>
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Title — editable */}
            <div className="px-4 pt-3 pb-2">
              {editingTitle ? (
                <div className="flex gap-1">
                  <Input value={titleDraft} onChange={e => setTitleDraft(e.target.value)}
                    className="h-8 text-xs flex-1" autoFocus
                    onKeyDown={e => {
                      if (e.key === 'Enter') { handleUpdateTicket('titulo', titleDraft); setEditingTitle(false); }
                      if (e.key === 'Escape') setEditingTitle(false);
                    }} />
                  <Button size="icon" className="w-8 h-8" onClick={() => { handleUpdateTicket('titulo', titleDraft); setEditingTitle(false); }}>
                    <Check className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <button className="text-sm font-semibold text-left w-full hover:text-primary transition-colors group flex items-center gap-1"
                  onClick={() => { setTitleDraft(convTicket.titulo); setEditingTitle(true); }}>
                  {convTicket.titulo}
                  <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-50 flex-shrink-0" />
                </button>
              )}
            </div>

            <div className="px-4 space-y-3 pb-4">
              {/* Proprietário */}
              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide block mb-1">Proprietário</label>
                <select
                  value={convTicket.proprietario_id || ''}
                  onChange={e => handleUpdateTicket('proprietario_id', e.target.value || null as any)}
                  className="w-full h-8 text-xs bg-background border border-border rounded-md px-2"
                >
                  <option value="">— Sem proprietário —</option>
                  {accountUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.nome} ({u.email})</option>
                  ))}
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide block mb-1">Status</label>
                <select
                  value={convTicket.status}
                  onChange={e => handleUpdateTicket('status', e.target.value)}
                  className="w-full h-8 text-xs bg-background border border-border rounded-md px-2"
                >
                  <option value="aberto">● Aberto</option>
                  <option value="em_andamento">● Em andamento</option>
                  <option value="aguardando">● Aguardando</option>
                  <option value="resolvido">● Resolvido</option>
                  <option value="fechado">● Fechado</option>
                </select>
              </div>

              {/* Pipeline */}
              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide block mb-1">Pipeline</label>
                <select
                  value={convTicket.pipeline_id || ''}
                  onChange={e => {
                    handleUpdateTicket('pipeline_id', e.target.value);
                    const pipe = ticketPipelines.find(p => p.id === e.target.value);
                    if (pipe?.estagios[0]) handleUpdateTicket('estagio_id', pipe.estagios[0].id);
                  }}
                  className="w-full h-8 text-xs bg-background border border-border rounded-md px-2"
                >
                  <option value="">Selecione</option>
                  {ticketPipelines.map(p => (
                    <option key={p.id} value={p.id}>{p.nome}</option>
                  ))}
                </select>
              </div>

              {/* Etapa */}
              {convTicket.pipeline_id && (
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide block mb-1">Etapa</label>
                  <select
                    value={convTicket.estagio_id || ''}
                    onChange={e => handleUpdateTicket('estagio_id', e.target.value)}
                    className="w-full h-8 text-xs bg-background border border-border rounded-md px-2"
                  >
                    <option value="">Selecione</option>
                    {(ticketPipelines.find(p => p.id === convTicket.pipeline_id)?.estagios || []).map(e => (
                      <option key={e.id} value={e.id}>{e.nome}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Prioridade */}
              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide block mb-1">Prioridade</label>
                <select
                  value={convTicket.prioridade}
                  onChange={e => handleUpdateTicket('prioridade', e.target.value)}
                  className="w-full h-8 text-xs bg-background border border-border rounded-md px-2"
                >
                  <option value="low">🟢 Baixa</option>
                  <option value="medium">🟡 Média</option>
                  <option value="high">🟠 Alta</option>
                  <option value="urgent">🔴 Urgente</option>
                </select>
              </div>

              {/* Categoria */}
              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide block mb-1">Categoria</label>
                <Input
                  value={convTicket.categoria || ''}
                  onChange={e => handleUpdateTicket('categoria', e.target.value)}
                  placeholder="Ex: Suporte, Financeiro, Técnico"
                  className="h-8 text-xs"
                />
              </div>

              {/* Descrição — editable */}
              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide block mb-1">Descrição</label>
                <textarea
                  value={convTicket.descricao || ''}
                  onChange={e => setConvTicket((prev: any) => prev ? { ...prev, descricao: e.target.value } : prev)}
                  onBlur={e => handleUpdateTicket('descricao', e.target.value)}
                  placeholder="Descreva o ticket..."
                  className="w-full text-xs bg-background border border-border rounded-md px-2 py-1.5 min-h-[60px] resize-y"
                />
              </div>
            </div>

            {/* Contato */}
            <div className="px-4 py-3 border-t border-border/50">
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide block mb-2">Contato</label>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nome</span>
                  <span className="font-medium">{convTicket.dados_custom?.contact_name || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Telefone</span>
                  <span className="font-mono text-[11px]">{convTicket.dados_custom?.contact_phone || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Plataforma</span>
                  <span>{convTicket.plataforma || 'WhatsApp'}</span>
                </div>
              </div>
            </div>

            {/* Datas */}
            <div className="px-4 py-3 border-t border-border/50">
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide block mb-2">Datas</label>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Criado em</span>
                  <span>{fmtDate(convTicket.criado_em)}</span>
                </div>
                {convTicket.primeira_resposta_em && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">1ª resposta</span>
                    <span>{fmtDate(convTicket.primeira_resposta_em)}</span>
                  </div>
                )}
                {convTicket.ultima_atividade_em && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Última atividade</span>
                    <span>{fmtDate(convTicket.ultima_atividade_em)}</span>
                  </div>
                )}
                {convTicket.resolvido_em && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Resolvido em</span>
                    <span>{fmtDate(convTicket.resolvido_em)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Template picker modal */}
      {showTemplatePicker && (
        <Dialog open onOpenChange={() => { setShowTemplatePicker(false); setPickerSelectedTpl(null); setPickerParams([]); }}>
          <DialogContent className="max-w-lg bg-card border-border max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-sm flex items-center gap-2">
                <LayoutTemplate className="w-4 h-4 text-primary" />
                {pickerSelectedTpl ? 'Preencher parâmetros' : 'Selecionar Template'}
              </DialogTitle>
            </DialogHeader>

            {!pickerSelectedTpl ? (
              /* Step 1: Select template */
              <div className="flex-1 overflow-y-auto space-y-1.5 pt-2">
                {loadingTemplates ? (
                  <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
                ) : templatesList.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">Nenhum template aprovado encontrado</p>
                ) : templatesList.map((t: any) => (
                  <button key={t.id} onClick={() => {
                    setPickerSelectedTpl(t);
                    const body = t.components?.find((c: any) => c.type === 'BODY')?.text || '';
                    const matches = body.match(/\{\{\d+\}\}/g) || [];
                    setPickerParams(matches.map(() => ''));
                  }}
                    className="w-full text-left p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <code className="text-xs font-mono font-semibold">{t.name}</code>
                      <Badge variant="outline" className="text-[9px] h-4 px-1">{t.category}</Badge>
                      <span className="text-[10px] text-muted-foreground">{t.language}</span>
                    </div>
                    {t.components?.find((c: any) => c.type === 'BODY')?.text && (
                      <p className="text-[11px] text-muted-foreground line-clamp-2">
                        {t.components.find((c: any) => c.type === 'BODY').text}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              /* Step 2: Fill params + preview + send */
              <div className="flex-1 overflow-y-auto space-y-4 pt-2">
                {/* Preview */}
                <div className="rounded-xl border border-border bg-secondary/50 p-4">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Prévia</p>
                  <div className="bg-primary/10 rounded-xl p-3 text-sm whitespace-pre-wrap">
                    {pickerParams.reduce((txt: string, val: string, i: number) =>
                      txt.replace(`{{${i + 1}}}`, val || `{{${i + 1}}}`),
                      pickerSelectedTpl.components?.find((c: any) => c.type === 'BODY')?.text || ''
                    )}
                  </div>
                </div>

                {/* Params */}
                {pickerParams.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                      Parâmetros ({pickerParams.length})
                    </p>
                    {pickerParams.map((val, i) => (
                      <div key={i}>
                        <label className="text-[11px] text-muted-foreground block mb-0.5">{`{{${i + 1}}}`}</label>
                        <Input value={val}
                          onChange={e => { const next = [...pickerParams]; next[i] = e.target.value; setPickerParams(next); }}
                          placeholder={`Valor para {{${i + 1}}}`}
                          className="h-8 text-xs bg-background border-border" />
                      </div>
                    ))}
                  </div>
                )}

                {/* No params = just confirm */}
                {pickerParams.length === 0 && (
                  <p className="text-xs text-muted-foreground">Este template não possui parâmetros. Clique em enviar.</p>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="text-xs"
                    onClick={() => { setPickerSelectedTpl(null); setPickerParams([]); }}>
                    Voltar
                  </Button>
                  <Button size="sm" className="flex-1 text-xs" onClick={handleSendTemplate} disabled={sending}>
                    {sending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
                    Enviar template
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}

      {/* New conversation dialog */}
      <NewConversationDialog open={newConvOpen} onClose={() => setNewConvOpen(false)} account={selectedAccount} onSent={loadConvs} />

      {/* Settings modal */}
      {/* Confirm delete conversation */}
      {confirmDeleteConv && (
        <Dialog open onOpenChange={() => setConfirmDeleteConv(null)}>
          <DialogContent className="max-w-sm bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-sm flex items-center gap-2 text-destructive">
                <Trash2 className="w-4 h-4" /> Apagar conversa
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-1">
              <p className="text-sm text-muted-foreground">
                Tem certeza que deseja apagar a conversa com <strong>{confirmDeleteConv.contact_name || confirmDeleteConv.contact_phone}</strong>?
                Todas as mensagens serão excluídas permanentemente.
              </p>
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="outline" className="text-xs" onClick={() => setConfirmDeleteConv(null)}>
                  Cancelar
                </Button>
                <Button size="sm" variant="destructive" className="text-xs" onClick={() => handleDeleteConversation(confirmDeleteConv)}>
                  <Trash2 className="w-3 h-3 mr-1.5" /> Apagar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {settingsOpen && (
        <InboxSettingsModal onClose={() => setSettingsOpen(false)} onSaved={loadAccountsFn}
          accounts={accounts} onAccountsChange={setAccounts} />
      )}

      {/* Bulk send modal */}
      <BulkSendModal open={bulkSendOpen} onClose={() => setBulkSendOpen(false)} account={selectedAccount} />
    </div>
  );
}
