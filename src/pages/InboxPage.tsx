import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Inbox, Search, MessageSquare, Settings, Send, CheckCheck, Plus,
  Loader2, RefreshCw, ChevronRight, Phone, Clock, Check,
  Paperclip, Image as ImageIcon, FileText, Mic, MicOff, LayoutTemplate,
  AlertTriangle, X, UserPlus, Trash2, RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getSaasEmpresaId } from '@/lib/saas';
import InboxSettingsModal from '@/components/inbox/InboxSettingsModal';
import {
  loadConversations, loadMessages, markConversationRead,
  sendTextMessage, sendMediaMessage, sendTemplateMessage,
  uploadMediaToMeta, isWithin24hWindow,
  type InboxConversation, type InboxMessage,
} from '@/lib/metaInboxService';

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
}

/* ── Avatar ────────────────────────────────────────────── */
const AvatarInitials = ({ name }: { name: string }) => (
  <div className="w-10 h-10 rounded-full bg-primary/15 text-primary font-bold flex items-center justify-center flex-shrink-0 text-sm">
    {(name || '?')[0].toUpperCase()}
  </div>
);

/* ── Normalize Brazilian phone (ensure 9th digit for mobile) */
/* ── Convert AudioBuffer to MP3 using lamejs ─────── */
async function audioBufferToMp3(audioBuffer: AudioBuffer): Promise<Blob> {
  const { Mp3Encoder } = await import('lamejs');
  const sampleRate = audioBuffer.sampleRate;
  const samples = audioBuffer.getChannelData(0);
  const encoder = new Mp3Encoder(1, sampleRate, 128); // mono, 128kbps
  const blockSize = 1152;
  const mp3Data: any[] = [];

  // Convert float32 to int16
  const int16 = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }

  for (let i = 0; i < int16.length; i += blockSize) {
    const chunk = int16.subarray(i, i + blockSize);
    const mp3buf = encoder.encodeBuffer(chunk);
    if (mp3buf.length > 0) mp3Data.push(new Uint8Array(mp3buf));
  }
  const end = encoder.flush();
  if (end.length > 0) mp3Data.push(new Uint8Array(end));

  return new Blob(mp3Data, { type: 'audio/mpeg' });
}

function normalizePhone(phone: string): string {
  let p = phone.replace(/\D/g, '');
  // 55 + DDD(2) + 8 digits → add 9 after DDD for mobile
  if (p.length === 12 && p.startsWith('55')) {
    const ddd = p.substring(2, 4);
    const number = p.substring(4);
    if (/^[6-9]/.test(number)) {
      p = `55${ddd}9${number}`;
    }
  }
  return p;
}

/* ── Format time ───────────────────────────────────────── */
function formatTime(ts: string | number) {
  const d = typeof ts === 'number' ? new Date(ts * 1000) : new Date(ts);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

/* ── Status icon for sent messages ─────────────────────── */
function MsgStatusIcon({ status }: { status: string }) {
  if (status === 'read') return <CheckCheck className="w-3 h-3 text-blue-400" />;
  if (status === 'delivered') return <CheckCheck className="w-3 h-3 opacity-60" />;
  if (status === 'sent') return <Check className="w-3 h-3 opacity-60" />;
  if (status === 'failed') return <AlertTriangle className="w-3 h-3 text-destructive" />;
  return <Clock className="w-2.5 h-2.5 opacity-40" />;
}

/* ── New conversation dialog (with template + params) ─── */
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
  const [accounts, setAccounts] = useState<MetaInboxAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [selectedAccount, setSelectedAccount] = useState<MetaInboxAccount | null>(null);
  const [conversations, setConversations] = useState<InboxConversation[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(false);
  const [selectedConv, setSelectedConv] = useState<InboxConversation | null>(null);
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [msgInput, setMsgInput] = useState('');
  const [sending, setSending] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newConvOpen, setNewConvOpen] = useState(false);
  const [confirmDeleteConv, setConfirmDeleteConv] = useState<InboxConversation | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Load accounts ──────────────────────────────────────
  const loadAccountsFn = useCallback(async () => {
    setLoadingAccounts(true);
    try {
      const empresaId = await getSaasEmpresaId();
      const { data, error } = await (supabase as any)
        .from('meta_inbox_accounts')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setAccounts(data || []);
      if (data && data.length > 0 && !selectedAccount) {
        setSelectedAccount(data[0]);
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao carregar contas', description: e.message });
    } finally {
      setLoadingAccounts(false);
    }
  }, []);

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

  useEffect(() => { loadConvs(); setSelectedConv(null); setMessages([]); }, [loadConvs]);

  // Poll conversations every 5s
  useEffect(() => {
    if (!selectedAccount) return;
    const t = setInterval(() => loadConvs(), 5000);
    return () => clearInterval(t);
  }, [selectedAccount?.id]);

  // ── Load messages when conversation changes ────────────
  const loadMsgs = useCallback(async () => {
    if (!selectedConv) { setMessages([]); return; }
    setLoadingMsgs(true);
    try {
      const data = await loadMessages(selectedConv.id);
      setMessages(data);
      markConversationRead(selectedConv.id);
    } catch { /* silent */ }
    finally { setLoadingMsgs(false); }
  }, [selectedConv?.id]);

  useEffect(() => { loadMsgs(); }, [loadMsgs]);

  // Poll messages every 3s
  useEffect(() => {
    if (!selectedConv) return;
    const t = setInterval(async () => {
      const data = await loadMessages(selectedConv.id);
      setMessages(data);
    }, 3000);
    return () => clearInterval(t);
  }, [selectedConv?.id]);

  // Auto-scroll
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // ── 24h window check ───────────────────────────────────
  const within24h = selectedConv ? isWithin24hWindow(selectedConv.last_inbound_ts) : false;

  // ── Send text ──────────────────────────────────────────
  const handleSendText = async () => {
    if (!msgInput.trim() || !selectedConv || !selectedAccount) return;
    setSending(true);
    const result = await sendTextMessage(selectedAccount, selectedConv.id, selectedConv.contact_phone, msgInput.trim());
    if (result.success) {
      setMsgInput('');
      const data = await loadMessages(selectedConv.id);
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
      );

      if (result.success) {
        const data = await loadMessages(selectedConv.id);
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
      );
      if (result.success) {
        const data = await loadMessages(selectedConv.id);
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
        );
      } else {
        result = await sendTextMessage(selectedAccount, selectedConv.id, selectedConv.contact_phone, msg.body || '');
      }
      if (result.success) {
        // Delete the failed message
        await (supabase as any).from('meta_inbox_messages').delete().eq('id', msg.id);
        const data = await loadMessages(selectedConv.id);
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
      const mimeType = 'audio/webm;codecs=opus';
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (blob.size < 100) return;
        setSending(true);
        try {
          // Convert WebM/Opus → MP3 (audio/mpeg) which Meta accepts
          const arrayBuffer = await blob.arrayBuffer();
          const audioCtx = new AudioContext();
          const decoded = await audioCtx.decodeAudioData(arrayBuffer);
          const mp3Blob = await audioBufferToMp3(decoded);
          audioCtx.close();

          // Upload MP3 via Edge Function proxy
          const file = new File([mp3Blob], 'audio.mp3', { type: 'audio/mpeg' });
          const upload = await uploadMediaToMeta(selectedAccount!, file);
          if (upload.error || !upload.mediaId) throw new Error(upload.error || 'Upload falhou');

          const result = await sendMediaMessage(
            selectedAccount!, selectedConv!.id, selectedConv!.contact_phone,
            'audio', upload.mediaId,
          );
          if (result.success) {
            const data = await loadMessages(selectedConv!.id);
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

  // ── Delete conversation ─────────────────────────────────
  const handleDeleteConversation = async (conv: InboxConversation) => {
    try {
      // Delete messages first, then conversation
      await (supabase as any).from('meta_inbox_messages').delete().eq('conversation_id', conv.id);
      await (supabase as any).from('meta_inbox_conversations').delete().eq('id', conv.id);
      if (selectedConv?.id === conv.id) { setSelectedConv(null); setMessages([]); }
      setConfirmDeleteConv(null);
      await loadConvs();
      toast({ title: 'Conversa apagada' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao apagar', description: e.message });
    }
  };

  // ── Filter conversations ───────────────────────────────
  const filteredConvs = conversations.filter(c =>
    !searchQuery ||
    (c.contact_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.contact_phone.includes(searchQuery)
  );

  /* ── No accounts state ──────────────────────────────── */
  if (!loadingAccounts && accounts.length === 0) {
    return (
      <>
        <div className="flex h-full items-center justify-center flex-col gap-5 p-8">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Inbox className="w-8 h-8 text-primary" />
          </div>
          <div className="text-center max-w-sm">
            <h2 className="text-lg font-semibold mb-1">Nenhuma caixa de entrada configurada</h2>
            <p className="text-sm text-muted-foreground mb-5">
              Conecte uma conta da API Oficial do WhatsApp (Meta) para começar a receber e enviar mensagens.
            </p>
            <Button onClick={() => setSettingsOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" /> Conectar conta Meta WABA
            </Button>
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
        <div className="p-2 border-t border-border">
          <Button variant="outline" size="sm" className="w-full text-xs h-8 gap-1.5" onClick={() => setSettingsOpen(true)}>
            <Plus className="w-3 h-3" /> Adicionar conta
          </Button>
        </div>
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
              onClick={() => { setSelectedConv(conv); markConversationRead(conv.id); }}
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
                    {/* Media (image/video) */}
                    {(msg.msg_type === 'image' || msg.msg_type === 'video') && msg.media_url && (
                      msg.msg_type === 'image'
                        ? <img src={msg.media_url} alt="imagem" className="max-w-full max-h-60 object-contain" />
                        : <video src={msg.media_url} controls className="max-w-full max-h-60" />
                    )}
                    {/* Audio — WhatsApp style */}
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
                    {/* Document */}
                    {msg.msg_type === 'document' && (
                      <div className="px-3.5 py-2 flex items-center gap-2">
                        <FileText className="w-4 h-4 flex-shrink-0 opacity-70" />
                        <span className="text-xs truncate">{msg.media_filename || msg.body}</span>
                      </div>
                    )}
                    {/* Body text (hide for audio/media-only) */}
                    {msg.body && msg.msg_type !== 'document' && msg.msg_type !== 'audio' && msg.msg_type !== 'ptt' && !(msg.body === '[Áudio]') && (
                      <p className="px-3.5 py-2 leading-relaxed whitespace-pre-wrap">{msg.body}</p>
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
                    {/* Timestamp + status */}
                    <div className={cn('flex items-center gap-1 px-3.5 pb-1.5', msg.from_me ? 'justify-end' : 'justify-start')}>
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
    </div>
  );
}
