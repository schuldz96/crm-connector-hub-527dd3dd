import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  MessageSquare, Search, WifiOff, QrCode,
  RefreshCcw, AlertCircle, X, Loader2,
  Smartphone, RefreshCw, Plus, CheckCheck, Send,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  useEvolutionInstances,
  getInstanceForUser,
  type EvolutionInstance,
} from '@/hooks/useEvolutionInstances';
import { MOCK_USERS } from '@/data/mockData';

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

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function WhatsAppPage() {
  const { user, hasRole } = useAuth();
  const { toast } = useToast();
  const isAdmin = hasRole(['admin', 'director', 'supervisor']);
  const { instances: evoInstances, loading: evoLoading, refetch: refetchEvo } = useEvolutionInstances();

  const [showCreateInst, setShowCreateInst] = useState(false);
  const [qrInstanceName, setQrInstanceName] = useState<string | null>(null);

  // Filter instances for non-admins
  const visibleInstances = evoInstances.filter(i => {
    if (!isAdmin) return getInstanceForUser(user?.id || '') === i.name;
    return true;
  });

  // ── Column 1: selected instance ────────────────────────────────────────────
  const [activeInstance, setActiveInstance] = useState<EvolutionInstance | null>(null);

  // Auto-select first instance
  useEffect(() => {
    if (visibleInstances.length > 0 && !activeInstance) {
      setActiveInstance(visibleInstances[0]);
    }
  }, [visibleInstances.length]);

  // ── Column 2: chats for selected instance ──────────────────────────────────
  const [chats, setChats] = useState<Chat[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [chatSearch, setChatSearch] = useState('');
  const [activeChat, setActiveChat] = useState<Chat | null>(null);

  // resolvePhone: for @lid JIDs, use the @lid number itself as the unique identifier.
  // DO NOT use remoteJidAlt — that field contains the INSTANCE OWNER's JID, not the contact's.
  const resolvePhone = (c: any): string => {
    const jid: string = c.remoteJid || '';
    // Strip the @domain suffix to get the numeric identifier
    return jid.replace(/@.*/, '');
  };


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

      // Deduplicate by phone — prefer @lid JID as primary (it has both sent+received)
      // Key insight: Evolution stores received msgs under @lid and sent under @s.whatsapp.net
      // We must query BOTH. Always keep @lid as remoteJid and phone JID as remoteJidAlt.
      const phoneMap = new Map<string, Chat>();
      for (const c of raw) {
        const phone = resolvePhone(c);
        if (!phone) continue;
        const ts =
          c.lastMessage?.messageTimestamp ||
          (c.updatedAt ? Math.floor(new Date(c.updatedAt).getTime() / 1000) : 0);

        const jid: string = c.remoteJid || c.id || '';
        const isLid = jid.includes('@lid');
        const phoneJid = phone ? `${phone}@s.whatsapp.net` : undefined;

        const existing = phoneMap.get(phone);

        if (!existing) {
          // displayPhone: for @lid use phoneJid number (real phone), for @s.whatsapp.net use phone directly
          const displayPhone = isLid ? (phoneJid?.replace(/@.*/, '') || phone) : phone;
          phoneMap.set(phone, {
            id: jid,
            remoteJid: jid,
            // For @lid chats, remoteJidAlt = phone JID; for phone JID chats, remoteJidAlt = undefined (not needed)
            remoteJidAlt: isLid ? phoneJid : undefined,
            phone: displayPhone,
            name: c.name || c.pushName || c.lastMessage?.pushName || displayPhone || 'Desconhecido',
            lastMessage:
              c.lastMessage?.message?.conversation ||
              c.lastMessage?.message?.extendedTextMessage?.text ||
              '',
            lastMessageTs: ts,
            unread: c.unreadCount || 0,
          });
        } else {
          // Merge: always prefer @lid as the primary remoteJid
          const existingIsLid = existing.remoteJid.includes('@lid');
          const mergedEntry: Chat = {
            ...existing,
            // Update name/message/ts if newer
            name: (c.name || c.pushName || c.lastMessage?.pushName || existing.name),
            lastMessage: ts > existing.lastMessageTs
              ? (c.lastMessage?.message?.conversation || c.lastMessage?.message?.extendedTextMessage?.text || existing.lastMessage)
              : existing.lastMessage,
            lastMessageTs: Math.max(ts, existing.lastMessageTs),
            unread: Math.max(c.unreadCount || 0, existing.unread),
          };

          if (isLid && !existingIsLid) {
            // New entry is @lid — upgrade primary JID to @lid, keep phone JID as alt
            mergedEntry.remoteJid = jid;
            mergedEntry.id = jid;
            mergedEntry.remoteJidAlt = existing.remoteJid; // save the old @s.whatsapp.net as alt
            // existing.phone already has the real phone number (from @s.whatsapp.net)
            mergedEntry.phone = existing.phone;
          } else if (!isLid && existingIsLid) {
            // Existing is @lid (preferred) — store new phone JID as alt, update phone to real number
            mergedEntry.remoteJidAlt = jid;
            mergedEntry.phone = phone; // phone here is extracted from @s.whatsapp.net = real number
          }
          phoneMap.set(phone, mergedEntry);
        }
      }
      // Sort by latest message
      const sorted = Array.from(phoneMap.values()).sort((a, b) => b.lastMessageTs - a.lastMessageTs);
      if (silent) {
        // On silent poll: merge unread counts but keep 0 for the active chat
        setChats(prev => {
          const prevMap = new Map(prev.map(c => [c.id, c]));
          return sorted.map(newChat => {
            const existing = prevMap.get(newChat.id);
            // If this chat is currently open, keep unread = 0
            const isOpen = activeChatRef.current?.id === newChat.id;
            return {
              ...newChat,
              unread: isOpen ? 0 : newChat.unread,
              // If we had previously zeroed a badge by clicking, don't re-show unless there's actually new unread
              ...(existing && existing.unread === 0 && newChat.unread === 0 ? {} : {}),
            };
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
    const t = setInterval(() => loadChats(activeInstance.name, true), 10000);
    return () => clearInterval(t);
  }, [activeInstance?.name, activeInstance?.connectionStatus]);



  const filteredChats = chats.filter(c =>
    c.name.toLowerCase().includes(chatSearch.toLowerCase()) ||
    c.phone.includes(chatSearch) ||
    c.lastMessage.toLowerCase().includes(chatSearch.toLowerCase())
  );

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

  // loadMessages: for @lid chats, query the @lid directly (Evolution stores both directions under @lid).
  // Do NOT add phoneJid = remoteJidAlt, because remoteJidAlt is the instance owner's JID, not the contact's.
  const loadMessages = useCallback(async (
    instanceName: string,
    remoteJid: string,
    scroll = false,
  ) => {
    if (scroll) setLoadingMsgs(true);
    try {
      const data = await evoFetch(`/chat/findMessages/${instanceName}`, {
        method: 'POST',
        body: JSON.stringify({ where: { key: { remoteJid } }, limit: 60 }),
      });

      const raw: any[] = Array.isArray(data?.messages?.records)
        ? data.messages.records
        : Array.isArray(data) ? data : [];

      // Deduplicate by message key id
      const seen = new Set<string>();
      const parsed: Message[] = raw
        .filter((m: any) => {
          if (m.messageType === 'protocolMessage' || m.messageType === 'reactionMessage') return false;
          const msgId = m.key?.id || m.id;
          if (!msgId || seen.has(msgId)) return false;
          seen.add(msgId);
          return true;
        })
        .map((m: any) => ({
          id: m.key?.id || m.id || `${m.messageTimestamp}_${Math.random()}`,
          fromMe: m.key?.fromMe === true,
          body: parseBody(m),
          timestamp: m.messageTimestamp || 0,
        }))
        .sort((a, b) => a.timestamp - b.timestamp);

      setMessages(parsed);
    } catch { /* silent */ }
    finally { if (scroll) setLoadingMsgs(false); }
  }, []);

  useEffect(() => {
    if (!activeChat || !activeInstance) return;
    loadMessages(activeInstance.name, activeChat.remoteJid, true);
  }, [activeChat?.id, activeInstance?.name]);

  // Real-time poll every 3s
  useEffect(() => {
    if (!activeChat || !activeInstance || activeInstance.connectionStatus !== 'open') return;
    const t = setInterval(
      () => loadMessages(activeInstance.name, activeChat.remoteJid, false),
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
      await loadMessages(activeInstance.name, activeChat.remoteJid, false);
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
          <Button size="sm" variant="outline" className="text-xs h-8 border-border" onClick={refetchEvo} disabled={evoLoading}>
            {evoLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>

      {/* ── 3-column layout ────────────────────────────────────────────────── */}
      <div className="flex-1 flex min-h-0 gap-0 rounded-xl overflow-hidden border border-border">

        {/* ════ COLUMN 1 — INSTANCES ════════════════════════════════════════ */}
        <div className="w-[220px] flex-shrink-0 bg-card border-r border-border flex flex-col">
          <div className="px-3 py-2.5 border-b border-border flex-shrink-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5" /> Instâncias
            </p>
          </div>
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
        <div className="w-[260px] flex-shrink-0 bg-card border-r border-border flex flex-col">
          {/* Header */}
          <div className="px-3 py-2.5 border-b border-border flex-shrink-0 flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
              {activeInstance
                ? (activeInstance.profileName || activeInstance.name)
                : 'Conversas'}
            </p>
            {activeInstance && isConnected && (
              <button
                onClick={() => loadChats(activeInstance.name)}
                className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
                <RefreshCw className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Search */}
          <div className="px-3 py-2 border-b border-border flex-shrink-0">
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

          {/* List */}
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
                  // Zero unread badge visually when opening the chat
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
                  <div className="flex items-center justify-between gap-1">
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
                    size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground"
                    onClick={() => loadMessages(activeInstance!.name, activeChat.remoteJid, true)}>
                    {loadingMsgs ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setActiveChat(null); setMessages([]); }}>
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

      </div>

      {/* Modals */}
      {qrInstanceName && <QRCodeModal instanceName={qrInstanceName} onClose={() => setQrInstanceName(null)} />}
      {showCreateInst && <CreateInstanceModal onClose={() => setShowCreateInst(false)} onCreated={refetchEvo} />}
    </div>
  );
}
