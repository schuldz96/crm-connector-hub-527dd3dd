import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  MessageSquare, Search, Wifi, WifiOff, QrCode, Brain,
  Send, Paperclip, Zap, RefreshCcw,
  CheckCheck, Shield, AlertCircle, X, Loader2, Phone,
  Smartphone, RefreshCw, Plus, Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useEvolutionInstances, getInstanceForUser, setInstanceForUser, type EvolutionInstance } from '@/hooks/useEvolutionInstances';
import { MOCK_USERS, MOCK_TEAMS } from '@/data/mockData';

// ─── Constants ──────────────────────────────────────────────────────────────────
const EVOLUTION_API_URL = 'https://evolutionapic.contato-lojavirtual.com';
const EVOLUTION_API_TOKEN = '3ce7a42f9bd96ea526b2b0bc39a4faec';
const META_CONNECTIONS_KEY = 'meta_wa_connections';

// ─── Types ──────────────────────────────────────────────────────────────────────
interface MetaConnection {
  id: string;
  label: string;
  token: string;
  phoneNumberId: string;
  businessId: string;
  status: 'connected' | 'error' | 'unknown';
}

interface UnifiedAccount {
  type: 'evolution' | 'meta';
  id: string;
  name: string;
  phone: string;
  status: string;
  avatarUrl?: string;
  raw: EvolutionInstance | MetaConnection;
}

interface Chat {
  id: string;
  remoteJid: string;
  name: string;
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

// ─── API helpers ────────────────────────────────────────────────────────────────
async function evoFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${EVOLUTION_API_URL}${path}`, {
    ...options,
    headers: { apikey: EVOLUTION_API_TOKEN, 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function getMetaConnections(): MetaConnection[] {
  try { return JSON.parse(localStorage.getItem(META_CONNECTIONS_KEY) || '[]'); } catch { return []; }
}
function saveMetaConnections(c: MetaConnection[]) {
  localStorage.setItem(META_CONNECTIONS_KEY, JSON.stringify(c));
}

// ─── QR Code Modal — fetches QR only for given instanceName ────────────────────
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
    } finally {
      setLoading(false);
    }
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
                : <div className="text-center"><QrCode className="w-12 h-12 text-muted-foreground/30 mx-auto mb-2" /><p className="text-[10px] text-muted-foreground">Clique em gerar</p></div>
            }
          </div>
          <p className="text-[10px] text-muted-foreground">QR Code expira em 60 segundos</p>
          <Button size="sm" className="w-full bg-gradient-primary h-9 text-xs" onClick={generate} disabled={loading}>
            {loading ? <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" />Gerando...</> : <><RefreshCcw className="w-3 h-3 mr-1.5" />{qrBase64 ? 'Regenerar' : 'Gerar QR Code'}</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Create Evolution Instance Modal ────────────────────────────────────────────
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
    } finally {
      setLoading(false);
    }
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
            <p className="text-[10px] text-muted-foreground mt-1">Use apenas letras, números e underscores.</p>
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" className="flex-1 bg-gradient-primary text-xs h-9" onClick={handleCreate} disabled={loading || !name.trim()}>
              {loading ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Criando...</> : <><Plus className="w-3.5 h-3.5 mr-1.5" />Criar</>}
            </Button>
            <Button size="sm" variant="outline" className="text-xs border-border h-9" onClick={onClose}>Cancelar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add Meta Modal ──────────────────────────────────────────────────────────────
function AddMetaModal({ onClose, onSave }: { onClose: () => void; onSave: (c: MetaConnection) => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ label: '', token: '', phoneNumberId: '', businessId: '' });
  const [testing, setTesting] = useState(false);

  const handleSave = async () => {
    if (!form.token || !form.phoneNumberId) return toast({ variant: 'destructive', title: 'Preencha Token e Phone Number ID.' });
    setTesting(true);
    try {
      const r = await fetch(`https://graph.facebook.com/v19.0/${form.phoneNumberId}`, { headers: { Authorization: `Bearer ${form.token}` } });
      const conn: MetaConnection = { id: `meta_${Date.now()}`, ...form, status: r.ok ? 'connected' : 'error' };
      if (r.ok) { toast({ title: 'Conectado!' }); onSave(conn); onClose(); }
      else toast({ variant: 'destructive', title: 'Falha na conexão', description: 'Verifique o token.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">🔵 Adicionar número Meta WhatsApp</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          {[
            { key: 'label', label: 'Nome / Label', placeholder: 'Ex: Suporte BR', type: 'text' },
            { key: 'token', label: 'Access Token', placeholder: 'EAAxxxxx...', type: 'password' },
            { key: 'phoneNumberId', label: 'Phone Number ID', placeholder: '1234567890', type: 'text' },
            { key: 'businessId', label: 'Business Account ID', placeholder: 'Business ID', type: 'text' },
          ].map(f => (
            <div key={f.key}>
              <label className="text-xs font-medium block mb-1.5">{f.label}</label>
              <Input value={(form as any)[f.key]} onChange={e => setForm(x => ({ ...x, [f.key]: e.target.value }))} placeholder={f.placeholder} type={f.type} className="h-9 text-xs bg-secondary border-border" />
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <Button size="sm" className="flex-1 bg-gradient-primary text-xs h-9" onClick={handleSave} disabled={testing}>
              {testing ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Verificando...</> : '🔵 Conectar & Salvar'}
            </Button>
            <Button size="sm" variant="outline" className="text-xs border-border h-9" onClick={onClose}>Cancelar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── New Conversation Modal ──────────────────────────────────────────────────────
function NewConversationModal({ onClose, onStart }: { onClose: () => void; onStart: (number: string, name: string) => void }) {
  const { toast } = useToast();
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');

  const handleStart = () => {
    const clean = phone.replace(/\D/g, '');
    if (clean.length < 10) return toast({ variant: 'destructive', title: 'Número inválido', description: 'Digite o número com DDD e código do país.' });
    onStart(clean + '@s.whatsapp.net', name || clean);
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" /> Nova Conversa
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div>
            <label className="text-xs font-medium block mb-1.5">Número (com código do país)</label>
            <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="5551999990000" className="h-9 text-xs bg-secondary border-border font-mono" />
            <p className="text-[10px] text-muted-foreground mt-1">Ex: 5551 = BR + DDD 51</p>
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5">Nome do contato (opcional)</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="João Silva" className="h-9 text-xs bg-secondary border-border" />
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" className="flex-1 bg-gradient-primary text-xs h-9" onClick={handleStart}>
              <Send className="w-3.5 h-3.5 mr-1.5" /> Iniciar conversa
            </Button>
            <Button size="sm" variant="outline" className="text-xs border-border h-9" onClick={onClose}>Cancelar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Status dot ──────────────────────────────────────────────────────────────────
const StatusDot = ({ status }: { status: string }) => {
  const isOpen = status === 'open' || status === 'connected';
  const isWaiting = status === 'connecting' || status === 'qrcode';
  return <span className={cn('w-2 h-2 rounded-full flex-shrink-0 inline-block', isOpen ? 'bg-success' : isWaiting ? 'bg-warning animate-pulse' : 'bg-muted-foreground/40')} />;
};

// ─── Main ────────────────────────────────────────────────────────────────────────
export default function WhatsAppPage() {
  const { user, hasRole } = useAuth();
  const { toast } = useToast();
  const isAdmin = hasRole(['admin', 'director', 'supervisor']);
  const { instances: evoInstances, loading: evoLoading, refetch: refetchEvo } = useEvolutionInstances();

  const [metaConns, setMetaConns] = useState<MetaConnection[]>(getMetaConnections);
  const [showAddMeta, setShowAddMeta] = useState(false);
  const [showCreateInst, setShowCreateInst] = useState(false);
  const [showNewConv, setShowNewConv] = useState(false);

  // QR per-instance: track which instance name needs QR
  const [qrInstanceName, setQrInstanceName] = useState<string | null>(null);

  // Team filter
  const [teamFilter, setTeamFilter] = useState<string>('all');

  // Build unified accounts
  const allAccounts: UnifiedAccount[] = [
    ...evoInstances
      .filter(i => {
        if (!isAdmin) return getInstanceForUser(user?.id || '') === i.name;
        if (teamFilter === 'all') return true;
        // find user assigned to this instance
        const assignedUser = MOCK_USERS.find(u => getInstanceForUser(u.id) === i.name);
        return assignedUser?.teamId === teamFilter;
      })
      .map(i => ({
        type: 'evolution' as const,
        id: `evo_${i.name}`,
        name: i.profileName || i.name,
        phone: i.ownerJid?.replace('@s.whatsapp.net', '') || i.name,
        status: i.connectionStatus,
        avatarUrl: i.profilePicUrl,
        raw: i,
      })),
    ...metaConns.map(m => ({
      type: 'meta' as const,
      id: `meta_${m.id}`,
      name: m.label || `Meta ${m.phoneNumberId}`,
      phone: m.phoneNumberId,
      status: m.status,
      avatarUrl: undefined,
      raw: m,
    })),
  ];

  const [activeAccountId, setActiveAccountId] = useState<string>('');
  const [chats, setChats] = useState<Chat[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [msgInput, setMsgInput] = useState('');
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const [adminTab, setAdminTab] = useState<'chat' | 'instances'>('chat');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastMsgCountRef = useRef(0);

  // Auto-select first account once loaded
  useEffect(() => {
    if (allAccounts.length > 0 && !activeAccountId) setActiveAccountId(allAccounts[0].id);
  }, [allAccounts.length]);

  const activeAccount = allAccounts.find(a => a.id === activeAccountId) ?? null;
  const isConnected = activeAccount?.status === 'open' || activeAccount?.status === 'connected';

  // Load chats on account switch
  useEffect(() => {
    if (!activeAccount) return;
    if (activeAccount.type === 'evolution') {
      const inst = activeAccount.raw as EvolutionInstance;
      if (inst.connectionStatus === 'open') loadEvoChats(inst.name);
      else setChats([]);
    } else setChats([]);
  }, [activeAccountId]);

  const loadEvoChats = async (instanceName: string) => {
    setLoadingChats(true);
    setChats([]);
    setActiveChat(null);
    setMessages([]);
    try {
      const data = await evoFetch(`/chat/findChats/${instanceName}`, { method: 'POST', body: JSON.stringify({}) });
      const raw: any[] = Array.isArray(data) ? data : (data?.chats || []);
      setChats(raw.slice(0, 80).map((c: any) => ({
        id: c.id || c.remoteJid,
        remoteJid: c.remoteJid || c.id || '',
        name: c.name || c.pushName || c.remoteJid?.replace(/@.*/, '') || 'Desconhecido',
        lastMessage: c.lastMessage?.message?.conversation || c.lastMessage?.message?.extendedTextMessage?.text || '',
        lastMessageTs: c.lastMessage?.messageTimestamp || (c.updatedAt ? Math.floor(new Date(c.updatedAt).getTime() / 1000) : 0),
        unread: c.unreadCount || 0,
      })));
    } catch { setChats([]); }
    finally { setLoadingChats(false); }
  };

  // Load messages on chat select
  useEffect(() => {
    if (!activeChat || !activeAccount) return;
    if (activeAccount.type === 'evolution') {
      loadEvoMessages((activeAccount.raw as EvolutionInstance).name, activeChat.remoteJid, true);
    }
  }, [activeChat?.id]);

  const loadEvoMessages = async (instanceName: string, remoteJid: string, scroll = false) => {
    if (scroll) setLoadingMsgs(true);
    try {
      const data = await evoFetch(`/chat/findMessages/${instanceName}`, {
        method: 'POST',
        body: JSON.stringify({ where: { key: { remoteJid } }, limit: 50 }),
      });

      const raw: any[] = Array.isArray(data?.messages?.records)
        ? data.messages.records
        : Array.isArray(data)
        ? data
        : [];

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

      const parsed: Message[] = raw
        .filter((m: any) => {
          if (m.messageType === 'protocolMessage' || m.messageType === 'reactionMessage') return false;
          // Safety filter: only messages that belong to THIS chat
          // Sent: key.remoteJid === remoteJid
          // Received 1:1: key.remoteJid === remoteJid (same)
          // Received in LID chats: key.remoteJidAlt === remoteJid OR key.remoteJid === remoteJid
          const kr = m.key?.remoteJid || '';
          const krAlt = m.key?.remoteJidAlt || '';
          return kr === remoteJid || krAlt === remoteJid;
        })
        .map((m: any) => ({
          id: m.id || m.key?.id || `${m.messageTimestamp}_${Math.random()}`,
          fromMe: !!m.key?.fromMe,
          body: parseBody(m),
          timestamp: m.messageTimestamp || 0,
        }))
        .sort((a, b) => a.timestamp - b.timestamp);

      setMessages(prev => {
        // Always update on scroll (initial load); on poll, only update if something changed
        if (!scroll && prev.length === parsed.length && prev[prev.length - 1]?.id === parsed[parsed.length - 1]?.id) return prev;
        return parsed;
      });
      lastMsgCountRef.current = parsed.length;
    } catch { /* silent */ }
    finally { if (scroll) setLoadingMsgs(false); }
  };

  // Real-time poll every 5 seconds
  useEffect(() => {
    if (!activeChat || !activeAccount || activeAccount.type !== 'evolution') return;
    const inst = activeAccount.raw as EvolutionInstance;
    if (inst.connectionStatus !== 'open') return;
    const timer = setInterval(() => loadEvoMessages(inst.name, activeChat.remoteJid, false), 5000);
    return () => clearInterval(timer);
  }, [activeChat?.id, activeAccountId]);

  // Auto-scroll on new messages
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Send message
  const handleSend = async () => {
    if (!msgInput.trim() || !activeChat || !activeAccount) return;
    setSending(true);
    const text = msgInput.trim();
    setMsgInput('');
    const optimisticMsg: Message = { id: `opt_${Date.now()}`, fromMe: true, body: text, timestamp: Math.floor(Date.now() / 1000) };
    setMessages(prev => [...prev, optimisticMsg]);
    try {
      if (activeAccount.type === 'evolution') {
        const inst = activeAccount.raw as EvolutionInstance;
        await evoFetch(`/message/sendText/${inst.name}`, {
          method: 'POST',
          body: JSON.stringify({ number: activeChat.remoteJid, text }),
        });
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao enviar', description: e.message });
      setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
      setMsgInput(text);
    } finally { setSending(false); }
  };

  // Start new conversation
  const handleNewConversation = (remoteJid: string, name: string) => {
    const newChat: Chat = { id: remoteJid, remoteJid, name, lastMessage: '', lastMessageTs: 0, unread: 0 };
    setChats(prev => [newChat, ...prev.filter(c => c.remoteJid !== remoteJid)]);
    setActiveChat(newChat);
  };

  const handleAddMeta = (conn: MetaConnection) => {
    const updated = [...metaConns, conn];
    setMetaConns(updated);
    saveMetaConnections(updated);
  };

  const filteredChats = chats.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.lastMessage.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page-container animate-fade-in h-[calc(100vh-56px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-display font-bold">WhatsApp</h1>
          <p className="text-sm text-muted-foreground">
            {allAccounts.filter(a => a.status === 'open' || a.status === 'connected').length} online · {allAccounts.length} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <div className="flex items-center gap-1 p-1 bg-secondary rounded-lg border border-border">
              <button onClick={() => setAdminTab('chat')} className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors', adminTab === 'chat' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
                <MessageSquare className="w-3.5 h-3.5" /> Conversas
              </button>
              <button onClick={() => setAdminTab('instances')} className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors', adminTab === 'instances' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
                <Shield className="w-3.5 h-3.5" /> Instâncias
              </button>
            </div>
          )}
          <Button size="sm" variant="outline" className="text-xs h-8 border-border gap-1" onClick={() => setShowAddMeta(true)}>🔵 Meta</Button>
          {isAdmin && (
            <Button size="sm" variant="outline" className="text-xs h-8 border-border gap-1" onClick={() => setShowCreateInst(true)}>
              <Plus className="w-3.5 h-3.5" /> Instância
            </Button>
          )}
          <Button size="sm" variant="outline" className="text-xs h-8 border-border" onClick={refetchEvo} disabled={evoLoading}>
            {evoLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>

      {/* ── Admin: Instances tab ──────────────────────────────────────────────────── */}
      {isAdmin && adminTab === 'instances' && (
        <div className="flex-1 overflow-y-auto space-y-5">
          {/* Team filter */}
          <div className="flex gap-1.5 flex-wrap">
            {[{ id: 'all', name: 'Todos os Times' }, ...MOCK_TEAMS].map(t => (
              <button key={t.id} onClick={() => setTeamFilter(t.id)}
                className={cn('text-xs px-3 py-1.5 rounded-lg border transition-all',
                  teamFilter === t.id ? 'bg-primary/15 border-primary/30 text-primary' : 'border-border text-muted-foreground hover:bg-muted')}>
                {t.name}
              </button>
            ))}
          </div>

          {/* Evolution instances */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Smartphone className="w-3.5 h-3.5" /> Evolution API — {evoInstances.length} instâncias
              </p>
              <Button size="sm" variant="outline" className="text-[10px] h-6 border-border" onClick={() => setShowCreateInst(true)}>
                <Plus className="w-3 h-3 mr-1" /> Criar
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {evoInstances.map(inst => {
                const isOpen = inst.connectionStatus === 'open';
                const phone = inst.ownerJid?.replace('@s.whatsapp.net', '');
                const assignedUser = MOCK_USERS.find(u => getInstanceForUser(u.id) === inst.name);
                return (
                  <div key={inst.id} className="glass-card p-4 border border-border rounded-xl flex items-start gap-3">
                    {inst.profilePicUrl
                      ? <img src={inst.profilePicUrl} className="w-10 h-10 rounded-full border border-border object-cover flex-shrink-0" alt="" />
                      : <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0"><Smartphone className="w-4 h-4 text-muted-foreground" /></div>
                    }
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-xs font-semibold truncate">{inst.profileName || inst.name}</p>
                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', isOpen ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground')}>
                          {isOpen ? 'Online' : 'Offline'}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground font-mono">{phone || inst.name}</p>
                      {assignedUser && (
                        <div className="flex items-center gap-1 mt-1">
                          <img src={assignedUser.avatar} className="w-3.5 h-3.5 rounded-full" alt="" />
                          <span className="text-[10px] text-muted-foreground">{assignedUser.name}</span>
                        </div>
                      )}
                      {inst._count && <p className="text-[10px] text-muted-foreground mt-0.5">💬 {inst._count.Message.toLocaleString('pt-BR')} msgs</p>}
                    </div>
                    {/* ONLY show QR button — NEVER disconnect/delete */}
                    {!isOpen && (
                      <Button size="sm" className="text-[10px] h-7 bg-gradient-primary flex-shrink-0" onClick={() => setQrInstanceName(inst.name)}>
                        <QrCode className="w-3 h-3 mr-1" /> QR
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Meta connections */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">🔵 Meta WhatsApp Cloud API — {metaConns.length} número{metaConns.length !== 1 ? 's' : ''}</p>
              <Button size="sm" variant="outline" className="text-[10px] h-6 border-border" onClick={() => setShowAddMeta(true)}>
                <Plus className="w-3 h-3 mr-1" /> Adicionar
              </Button>
            </div>
            {metaConns.length === 0 ? (
              <div className="glass-card p-6 text-center border border-dashed border-border rounded-xl">
                <p className="text-xs text-muted-foreground">Nenhum número Meta configurado.</p>
                <Button size="sm" className="mt-3 bg-gradient-primary text-xs" onClick={() => setShowAddMeta(true)}><Plus className="w-3.5 h-3.5 mr-1.5" />Adicionar número Meta</Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {metaConns.map(conn => (
                  <div key={conn.id} className="glass-card p-4 border border-border rounded-xl flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-info/10 flex items-center justify-center flex-shrink-0 text-lg">🔵</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{conn.label || 'Meta'}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{conn.phoneNumberId}</p>
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', conn.status === 'connected' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive')}>
                        {conn.status === 'connected' ? 'Conectado' : 'Erro'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Chat View ─────────────────────────────────────────────────────────────── */}
      {(!isAdmin || adminTab === 'chat') && (
        <div className="flex gap-3 flex-1 min-h-0">

          {/* Sidebar: accounts + team filter */}
          <div className="w-52 flex-shrink-0 flex flex-col gap-2">
            {/* Team filter (admin only) */}
            {isAdmin && (
              <div className="flex gap-1 flex-wrap">
                {[{ id: 'all', name: 'Todos' }, ...MOCK_TEAMS.map(t => ({ id: t.id, name: t.name.replace('Equipe ', '') }))].map(t => (
                  <button key={t.id} onClick={() => setTeamFilter(t.id)}
                    className={cn('text-[10px] px-2 py-1 rounded-md border transition-all',
                      teamFilter === t.id ? 'bg-primary/15 border-primary/30 text-primary' : 'border-border text-muted-foreground hover:bg-muted')}>
                    {t.name}
                  </button>
                ))}
              </div>
            )}

            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Números</p>

            {evoLoading && allAccounts.length === 0 && (
              <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /><span className="text-xs">Carregando...</span>
              </div>
            )}
            {!evoLoading && allAccounts.length === 0 && (
              <div className="glass-card p-4 text-center border border-dashed border-border rounded-xl">
                <Phone className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-[10px] text-muted-foreground">Nenhum número vinculado.</p>
                {!isAdmin && <p className="text-[10px] text-muted-foreground mt-1">Solicite ao admin.</p>}
              </div>
            )}

            <div className="space-y-1.5 overflow-y-auto flex-1">
              {allAccounts.map(acc => (
                <button key={acc.id} onClick={() => setActiveAccountId(acc.id)}
                  className={cn('w-full flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all text-left',
                    activeAccountId === acc.id ? 'border-primary/30 bg-primary/5' : 'border-border bg-card hover:bg-muted/50')}>
                  {acc.avatarUrl
                    ? <img src={acc.avatarUrl} className="w-8 h-8 rounded-full border border-border flex-shrink-0 object-cover" alt="" />
                    : <div className={cn('w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm', acc.type === 'meta' ? 'bg-info/10' : 'bg-muted')}>
                        {acc.type === 'meta' ? '🔵' : <Smartphone className="w-3.5 h-3.5 text-muted-foreground" />}
                      </div>
                  }
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold truncate">{acc.name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono truncate">{acc.phone}</p>
                  </div>
                  <StatusDot status={acc.status} />
                </button>
              ))}
            </div>

            {activeAccount && !isConnected && activeAccount.type === 'evolution' && (
              <Button size="sm" className="w-full text-xs h-7 bg-gradient-primary" onClick={() => setQrInstanceName((activeAccount.raw as EvolutionInstance).name)}>
                <QrCode className="w-3 h-3 mr-1" /> Reconectar
              </Button>
            )}
          </div>

          {/* Chat list */}
          <div className="w-72 flex-shrink-0 glass-card flex flex-col">
            <div className="p-3 border-b border-border flex-shrink-0">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <StatusDot status={activeAccount?.status || ''} />
                  <span className="text-xs font-semibold truncate max-w-[120px]">{activeAccount?.name || '—'}</span>
                </div>
                <div className="flex items-center gap-1">
                  {activeAccount && !isConnected && activeAccount.type === 'evolution' && (
                    <button onClick={() => setQrInstanceName((activeAccount.raw as EvolutionInstance).name)}
                      className="flex items-center gap-1 text-[10px] text-warning hover:text-warning/80 transition-colors">
                      <AlertCircle className="w-3 h-3" /> Reconectar
                    </button>
                  )}
                  {isConnected && (
                    <>
                      <button onClick={() => setShowNewConv(true)} className="w-6 h-6 rounded hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors" title="Nova conversa">
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => activeAccount?.type === 'evolution' && loadEvoChats((activeAccount.raw as EvolutionInstance).name)}
                        className="w-6 h-6 rounded hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                        <RefreshCw className="w-3 h-3" />
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar conversas..." className="pl-7 h-7 text-xs bg-secondary border-border" />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {!isConnected && activeAccount && (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2 p-4 text-center">
                  <WifiOff className="w-8 h-8 opacity-30" />
                  <p className="text-xs">Instância desconectada.</p>
                  {activeAccount.type === 'evolution' && (
                    <Button size="sm" className="bg-gradient-primary text-xs h-7" onClick={() => setQrInstanceName((activeAccount.raw as EvolutionInstance).name)}>
                      <QrCode className="w-3 h-3 mr-1" /> Gerar QR Code
                    </Button>
                  )}
                </div>
              )}
              {isConnected && loadingChats && (
                <div className="flex items-center justify-center h-40 gap-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" /><span className="text-xs">Carregando...</span>
                </div>
              )}
              {isConnected && !loadingChats && filteredChats.length === 0 && (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                  <MessageSquare className="w-8 h-8 mb-2 opacity-30" />
                  <p className="text-xs">Nenhuma conversa</p>
                  <button onClick={() => setShowNewConv(true)} className="text-[10px] text-primary hover:underline mt-1">+ Iniciar nova</button>
                </div>
              )}
              {filteredChats.map(chat => (
                <div key={chat.id} onClick={() => setActiveChat(chat)}
                  className={cn('flex items-start gap-3 p-3 border-b border-border/50 cursor-pointer hover:bg-muted/30 transition-colors',
                    activeChat?.id === chat.id && 'bg-primary/5 border-l-2 border-l-primary')}>
                  <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-sm font-bold flex-shrink-0 border border-border">
                    {(chat.name || '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className="text-xs font-semibold truncate">{chat.name}</p>
                      {chat.lastMessageTs > 0 && (
                        <span className="text-[10px] text-muted-foreground flex-shrink-0 ml-1">
                          {new Date(chat.lastMessageTs * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">{chat.lastMessage || '...'}</p>
                    {chat.unread > 0 && (
                      <span className="mt-1 inline-flex w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] items-center justify-center font-bold">{chat.unread}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Chat window */}
          <div className="flex-1 min-w-0 glass-card flex flex-col">
            {!activeChat ? (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                <MessageSquare className="w-16 h-16 mb-4 opacity-10" />
                <p className="text-sm">Selecione uma conversa</p>
                {isConnected && (
                  <button onClick={() => setShowNewConv(true)} className="mt-2 text-xs text-primary hover:underline flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5" /> Iniciar nova conversa
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-sm font-bold border border-border">
                      {(activeChat.name || '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{activeChat.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{activeChat.remoteJid?.replace('@s.whatsapp.net', '')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" className="text-xs h-7 border-border gap-1">
                      <Brain className="w-3 h-3 text-accent" /> IA
                    </Button>
                    <Button size="sm" variant="outline" className="text-xs h-7 border-border gap-1">
                      <Zap className="w-3 h-3 text-primary" /> Auto
                    </Button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {loadingMsgs && <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>}
                  {!loadingMsgs && messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <MessageSquare className="w-12 h-12 mb-3 opacity-20" />
                      <p className="text-sm">Nenhuma mensagem</p>
                    </div>
                  )}
                  {messages.map(msg => (
                    <div key={msg.id} className={cn('flex', msg.fromMe ? 'justify-end' : 'justify-start')}>
                      <div className={cn('max-w-[70%] px-3 py-2 rounded-2xl text-xs',
                        msg.fromMe ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-secondary text-foreground rounded-tl-sm')}>
                        <p className="leading-relaxed">{msg.body}</p>
                        <p className={cn('text-[10px] mt-1 text-right', msg.fromMe ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                          {msg.timestamp > 0 && new Date(msg.timestamp * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          {msg.fromMe && <CheckCheck className="w-3 h-3 inline ml-1" />}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                <div className="p-3 border-t border-border flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <button className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                      <Paperclip className="w-4 h-4" />
                    </button>
                    <Input
                      value={msgInput}
                      onChange={e => setMsgInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                      placeholder={isConnected ? 'Digite uma mensagem... (Enter para enviar)' : 'Reconecte para enviar'}
                      disabled={!isConnected || sending}
                      className="flex-1 h-9 text-xs bg-secondary border-border"
                    />
                    <button onClick={handleSend}
                      disabled={!isConnected || !msgInput.trim() || sending}
                      className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-40">
                      {sending ? <Loader2 className="w-3.5 h-3.5 text-primary-foreground animate-spin" /> : <Send className="w-3.5 h-3.5 text-primary-foreground" />}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      {qrInstanceName && <QRCodeModal instanceName={qrInstanceName} onClose={() => setQrInstanceName(null)} />}
      {showAddMeta && <AddMetaModal onClose={() => setShowAddMeta(false)} onSave={handleAddMeta} />}
      {showCreateInst && <CreateInstanceModal onClose={() => setShowCreateInst(false)} onCreated={refetchEvo} />}
      {showNewConv && <NewConversationModal onClose={() => setShowNewConv(false)} onStart={handleNewConversation} />}
    </div>
  );
}
