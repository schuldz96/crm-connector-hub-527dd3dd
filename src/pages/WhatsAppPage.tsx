import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  MessageSquare, Search, Wifi, WifiOff, QrCode, Brain,
  Send, Paperclip, MoreHorizontal, Zap, RefreshCcw,
  CheckCheck, Shield, Users, AlertCircle, X, Loader2, Phone,
  Smartphone, RefreshCw, Plus, Settings2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useEvolutionInstances, getInstanceForUser, type EvolutionInstance } from '@/hooks/useEvolutionInstances';

// ─── Constants ─────────────────────────────────────────────────────────────────
const EVOLUTION_API_URL = 'https://evolutionapic.contato-lojavirtual.com';
const EVOLUTION_API_TOKEN = '3ce7a42f9bd96ea526b2b0bc39a4faec';

const META_CONNECTIONS_KEY = 'meta_wa_connections';

// ─── Types ─────────────────────────────────────────────────────────────────────
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
  status: string; // "open"|"close" for evolution; "connected"|"error" for meta
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
  avatarUrl?: string;
}

interface Message {
  id: string;
  fromMe: boolean;
  body: string;
  timestamp: number;
  status?: string;
}

// ─── Evolution API helpers ──────────────────────────────────────────────────────
async function evoFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${EVOLUTION_API_URL}${path}`, {
    ...options,
    headers: { apikey: EVOLUTION_API_TOKEN, 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ─── Meta helpers ───────────────────────────────────────────────────────────────
function getMetaConnections(): MetaConnection[] {
  try { return JSON.parse(localStorage.getItem(META_CONNECTIONS_KEY) || '[]'); } catch { return []; }
}
function saveMetaConnections(conns: MetaConnection[]) {
  localStorage.setItem(META_CONNECTIONS_KEY, JSON.stringify(conns));
}
async function testMetaConnection(conn: MetaConnection): Promise<MetaConnection> {
  try {
    const r = await fetch(`https://graph.facebook.com/v19.0/${conn.phoneNumberId}`, {
      headers: { Authorization: `Bearer ${conn.token}` },
    });
    return { ...conn, status: r.ok ? 'connected' : 'error' };
  } catch {
    return { ...conn, status: 'error' };
  }
}

// ─── QR Code Modal (Evolution real) ────────────────────────────────────────────
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
      if (b64) {
        setQrBase64(b64);
      } else {
        toast({ title: 'Instância já conectada ou QR não disponível', description: JSON.stringify(data) });
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao gerar QR Code', description: e.message });
    } finally {
      setLoading(false);
    }
  }, [instanceName, toast]);

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
            Abra o WhatsApp → Dispositivos vinculados → Vincular dispositivo
          </p>
          <div className="w-52 h-52 bg-secondary rounded-2xl border border-border flex items-center justify-center overflow-hidden">
            {loading ? (
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            ) : qrBase64 ? (
              <img src={qrBase64} alt="QR Code" className="w-48 h-48 object-contain" />
            ) : (
              <div className="text-center">
                <QrCode className="w-12 h-12 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-[10px] text-muted-foreground">Clique em gerar</p>
              </div>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">QR Code expira em 60 segundos</p>
          <Button size="sm" className="w-full bg-gradient-primary h-9 text-xs" onClick={generate} disabled={loading}>
            {loading ? <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> Gerando...</> : <><RefreshCcw className="w-3 h-3 mr-1.5" /> {qrBase64 ? 'Regenerar QR Code' : 'Gerar QR Code'}</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add Meta Connection Modal ──────────────────────────────────────────────────
function AddMetaModal({ onClose, onSave }: { onClose: () => void; onSave: (conn: MetaConnection) => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ label: '', token: '', phoneNumberId: '', businessId: '' });
  const [testing, setTesting] = useState(false);

  const handleSave = async () => {
    if (!form.token || !form.phoneNumberId) {
      toast({ variant: 'destructive', title: 'Preencha Token e Phone Number ID.' });
      return;
    }
    setTesting(true);
    const conn: MetaConnection = { id: `meta_${Date.now()}`, ...form, status: 'unknown' };
    const tested = await testMetaConnection(conn);
    setTesting(false);
    if (tested.status === 'connected') {
      toast({ title: 'Conectado!', description: `Número ${form.phoneNumberId} verificado com sucesso.` });
      onSave(tested);
      onClose();
    } else {
      toast({ variant: 'destructive', title: 'Falha na conexão', description: 'Verifique o token e Phone Number ID.' });
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            🔵 Adicionar número Meta WhatsApp
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div>
            <label className="text-xs font-medium block mb-1.5">Nome / Label</label>
            <Input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="Ex: Suporte BR" className="h-9 text-xs bg-secondary border-border" />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5">Access Token</label>
            <Input value={form.token} onChange={e => setForm(f => ({ ...f, token: e.target.value }))} placeholder="EAAxxxxx..." type="password" className="h-9 text-xs bg-secondary border-border font-mono" />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5">Phone Number ID</label>
            <Input value={form.phoneNumberId} onChange={e => setForm(f => ({ ...f, phoneNumberId: e.target.value }))} placeholder="1234567890" className="h-9 text-xs bg-secondary border-border font-mono" />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5">Business Account ID</label>
            <Input value={form.businessId} onChange={e => setForm(f => ({ ...f, businessId: e.target.value }))} placeholder="Business ID" className="h-9 text-xs bg-secondary border-border font-mono" />
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" className="flex-1 bg-gradient-primary text-xs h-9" onClick={handleSave} disabled={testing}>
              {testing ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Verificando...</> : '🔵 Conectar & Salvar'}
            </Button>
            <Button size="sm" variant="outline" className="text-xs border-border h-9" onClick={onClose}>Cancelar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Status badge ───────────────────────────────────────────────────────────────
function StatusDot({ status }: { status: string }) {
  const isOpen = status === 'open' || status === 'connected';
  const isWaiting = status === 'connecting' || status === 'qrcode';
  return (
    <span className={cn('w-2 h-2 rounded-full flex-shrink-0',
      isOpen ? 'bg-success' : isWaiting ? 'bg-warning animate-pulse' : 'bg-muted-foreground/40')} />
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────────
export default function WhatsAppPage() {
  const { user, hasRole } = useAuth();
  const { toast } = useToast();
  const isAdmin = hasRole(['admin', 'director', 'supervisor']);
  const { instances: evoInstances, loading: evoLoading, refetch: refetchEvo } = useEvolutionInstances();

  // ── Meta connections (persisted in localStorage) ──────────────────────────────
  const [metaConns, setMetaConns] = useState<MetaConnection[]>(getMetaConnections);
  const [showAddMeta, setShowAddMeta] = useState(false);

  // ── Build unified account list ─────────────────────────────────────────────────
  const allAccounts: UnifiedAccount[] = [
    ...evoInstances
      .filter(i => isAdmin || getInstanceForUser(user?.id || '') === i.name)
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

  // ── State ──────────────────────────────────────────────────────────────────────
  const [activeAccountId, setActiveAccountId] = useState<string>('');
  const [chats, setChats] = useState<Chat[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [msgInput, setMsgInput] = useState('');
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const [qrInstanceName, setQrInstanceName] = useState<string | null>(null);
  const [adminTab, setAdminTab] = useState<'chat' | 'instances'>('chat');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // auto-select first account
  useEffect(() => {
    if (allAccounts.length > 0 && !activeAccountId) {
      setActiveAccountId(allAccounts[0].id);
    }
  }, [allAccounts.length]);

  const activeAccount = allAccounts.find(a => a.id === activeAccountId);

  // ── Load chats when active account changes ─────────────────────────────────────
  useEffect(() => {
    if (!activeAccount) return;
    if (activeAccount.type === 'evolution') {
      const inst = activeAccount.raw as EvolutionInstance;
      if (inst.connectionStatus !== 'open') { setChats([]); return; }
      loadEvoChats(inst.name);
    } else {
      // Meta: no chat list API in basic tier, show placeholder
      setChats([]);
    }
  }, [activeAccountId]);

  const loadEvoChats = async (instanceName: string) => {
    setLoadingChats(true);
    setChats([]);
    setActiveChat(null);
    setMessages([]);
    try {
      const data = await evoFetch(`/chat/findChats/${instanceName}`, { method: 'POST', body: JSON.stringify({}) });
      const raw: any[] = Array.isArray(data) ? data : (data?.chats || []);
      const parsed: Chat[] = raw.slice(0, 50).map((c: any) => ({
        id: c.id || c.remoteJid,
        remoteJid: c.remoteJid || c.id || '',
        name: c.name || c.pushName || c.remoteJid?.replace('@s.whatsapp.net', '') || 'Desconhecido',
        lastMessage: c.lastMessage?.message?.conversation || c.lastMessage?.message?.extendedTextMessage?.text || '',
        lastMessageTs: c.lastMessage?.messageTimestamp || c.updatedAt ? new Date(c.updatedAt).getTime() / 1000 : 0,
        unread: c.unreadCount || 0,
        avatarUrl: c.profilePicUrl,
      }));
      setChats(parsed);
    } catch {
      setChats([]);
    } finally {
      setLoadingChats(false);
    }
  };

  // ── Load messages when chat changes ────────────────────────────────────────────
  useEffect(() => {
    if (!activeChat || !activeAccount) return;
    if (activeAccount.type === 'evolution') {
      loadEvoMessages((activeAccount.raw as EvolutionInstance).name, activeChat.remoteJid);
    }
  }, [activeChat?.id]);

  const loadEvoMessages = async (instanceName: string, remoteJid: string) => {
    setLoadingMsgs(true);
    try {
      const data = await evoFetch(`/chat/findMessages/${instanceName}`, {
        method: 'POST',
        body: JSON.stringify({ where: { key: { remoteJid } }, limit: 40 }),
      });
      const raw: any[] = Array.isArray(data?.messages?.records) ? data.messages.records : Array.isArray(data) ? data : [];
      const parsed: Message[] = raw.map((m: any) => ({
        id: m.key?.id || Math.random().toString(),
        fromMe: !!m.key?.fromMe,
        body: m.message?.conversation || m.message?.extendedTextMessage?.text || m.message?.imageMessage?.caption || '[mídia]',
        timestamp: m.messageTimestamp || 0,
        status: m.status,
      })).sort((a, b) => a.timestamp - b.timestamp);
      setMessages(parsed);
    } catch {
      setMessages([]);
    } finally {
      setLoadingMsgs(false);
    }
  };

  // auto-scroll
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // ── Send message ───────────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!msgInput.trim() || !activeChat || !activeAccount) return;
    setSending(true);
    const text = msgInput.trim();
    setMsgInput('');
    try {
      if (activeAccount.type === 'evolution') {
        const inst = activeAccount.raw as EvolutionInstance;
        await evoFetch(`/message/sendText/${inst.name}`, {
          method: 'POST',
          body: JSON.stringify({ number: activeChat.remoteJid, text }),
        });
        // Optimistic
        setMessages(prev => [...prev, {
          id: `temp_${Date.now()}`, fromMe: true, body: text,
          timestamp: Math.floor(Date.now() / 1000),
        }]);
      }
      // Meta: would use Graph API send message
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao enviar mensagem', description: e.message });
      setMsgInput(text);
    } finally {
      setSending(false);
    }
  };

  // ── Auto-refresh messages ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeChat || !activeAccount || activeAccount.type !== 'evolution') return;
    const inst = activeAccount.raw as EvolutionInstance;
    if (inst.connectionStatus !== 'open') return;
    const timer = setInterval(() => loadEvoMessages(inst.name, activeChat.remoteJid), 8000);
    return () => clearInterval(timer);
  }, [activeChat?.id, activeAccountId]);

  // ── Meta save ──────────────────────────────────────────────────────────────────
  const handleAddMeta = (conn: MetaConnection) => {
    const updated = [...metaConns, conn];
    setMetaConns(updated);
    saveMetaConnections(updated);
  };
  const handleRemoveMeta = (id: string) => {
    const updated = metaConns.filter(c => c.id !== id);
    setMetaConns(updated);
    saveMetaConnections(updated);
  };

  // ── Filtered chats ─────────────────────────────────────────────────────────────
  const filteredChats = chats.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.lastMessage.toLowerCase().includes(search.toLowerCase())
  );

  const isConnected = activeAccount?.status === 'open' || activeAccount?.status === 'connected';

  return (
    <div className="page-container animate-fade-in h-[calc(100vh-56px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-display font-bold">WhatsApp</h1>
          <p className="text-sm text-muted-foreground">
            {allAccounts.length} número{allAccounts.length !== 1 ? 's' : ''} conectado{allAccounts.length !== 1 ? 's' : ''}
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
          <Button size="sm" variant="outline" className="text-xs h-8 border-border gap-1.5" onClick={() => setShowAddMeta(true)}>
            🔵 <Plus className="w-3 h-3" /> Meta
          </Button>
          <Button size="sm" variant="outline" className="text-xs h-8 border-border gap-1.5" onClick={refetchEvo} disabled={evoLoading}>
            {evoLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>

      {/* ── Admin: Instances overview ─────────────────────────────────────────────── */}
      {isAdmin && adminTab === 'instances' && (
        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Evolution instances */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
              <Smartphone className="w-3.5 h-3.5" /> Evolution API — {evoInstances.length} instâncias
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {evoInstances.map(inst => {
                const isOpen = inst.connectionStatus === 'open';
                const phone = inst.ownerJid?.replace('@s.whatsapp.net', '');
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
                      {inst._count && <p className="text-[10px] text-muted-foreground mt-0.5">💬 {inst._count.Message.toLocaleString('pt-BR')} msgs</p>}
                    </div>
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
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                🔵 Meta WhatsApp Cloud API — {metaConns.length} número{metaConns.length !== 1 ? 's' : ''}
              </p>
              <Button size="sm" variant="outline" className="text-[10px] h-6 border-border" onClick={() => setShowAddMeta(true)}>
                <Plus className="w-3 h-3 mr-1" /> Adicionar
              </Button>
            </div>
            {metaConns.length === 0 ? (
              <div className="glass-card p-6 text-center border border-dashed border-border rounded-xl">
                <p className="text-xs text-muted-foreground">Nenhum número Meta configurado.</p>
                <Button size="sm" className="mt-3 bg-gradient-primary text-xs" onClick={() => setShowAddMeta(true)}>
                  <Plus className="w-3.5 h-3.5 mr-1.5" /> Adicionar número Meta
                </Button>
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
                        {conn.status === 'connected' ? 'Conectado' : conn.status === 'error' ? 'Erro' : 'Desconhecido'}
                      </span>
                    </div>
                    <button onClick={() => handleRemoveMeta(conn.id)} className="w-6 h-6 rounded hover:bg-muted flex items-center justify-center flex-shrink-0">
                      <X className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
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

          {/* Sidebar: account list */}
          <div className="w-48 flex-shrink-0 flex flex-col gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Números</p>

            {evoLoading && allAccounts.length === 0 && (
              <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-xs">Carregando...</span>
              </div>
            )}

            {!evoLoading && allAccounts.length === 0 && (
              <div className="glass-card p-4 text-center border border-dashed border-border rounded-xl">
                <Phone className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-[10px] text-muted-foreground">Nenhum número vinculado.</p>
                {!isAdmin && <p className="text-[10px] text-muted-foreground mt-1">Peça ao admin para atribuir uma instância.</p>}
              </div>
            )}

            <div className="space-y-1.5 overflow-y-auto flex-1">
              {allAccounts.map(acc => (
                <button
                  key={acc.id}
                  onClick={() => setActiveAccountId(acc.id)}
                  className={cn(
                    'w-full flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all text-left',
                    activeAccountId === acc.id ? 'border-primary/30 bg-primary/5' : 'border-border bg-card hover:bg-muted/50'
                  )}
                >
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

            {/* Reconnect button for disconnected active account */}
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
                  <span className="text-xs font-semibold truncate max-w-[140px]">{activeAccount?.name || '—'}</span>
                </div>
                {activeAccount && !isConnected && activeAccount.type === 'evolution' && (
                  <button onClick={() => setQrInstanceName((activeAccount.raw as EvolutionInstance).name)}
                    className="flex items-center gap-1 text-[10px] text-warning hover:text-warning/80 transition-colors">
                    <AlertCircle className="w-3 h-3" /> Reconectar
                  </button>
                )}
                {activeAccount && isConnected && (
                  <button onClick={() => activeAccount.type === 'evolution' && loadEvoChats((activeAccount.raw as EvolutionInstance).name)}
                    className="text-muted-foreground hover:text-foreground transition-colors">
                    <RefreshCw className="w-3 h-3" />
                  </button>
                )}
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
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-xs">Carregando conversas...</span>
                </div>
              )}
              {isConnected && !loadingChats && filteredChats.length === 0 && (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                  <MessageSquare className="w-8 h-8 mb-2 opacity-30" />
                  <p className="text-xs">Nenhuma conversa encontrada</p>
                </div>
              )}
              {filteredChats.map(chat => (
                <div
                  key={chat.id}
                  onClick={() => setActiveChat(chat)}
                  className={cn(
                    'flex items-start gap-3 p-3 border-b border-border/50 cursor-pointer hover:bg-muted/30 transition-colors',
                    activeChat?.id === chat.id && 'bg-primary/5 border-l-2 border-l-primary'
                  )}
                >
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
                      <span className="mt-1 inline-flex w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] items-center justify-center font-bold">
                        {chat.unread}
                      </span>
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
              </div>
            ) : (
              <>
                {/* Chat header */}
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
                      <Brain className="w-3 h-3 text-accent" /> Analisar IA
                    </Button>
                    <Button size="sm" variant="outline" className="text-xs h-7 border-border gap-1">
                      <Zap className="w-3 h-3 text-primary" /> Automação
                    </Button>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {loadingMsgs && (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                  )}
                  {!loadingMsgs && messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <MessageSquare className="w-12 h-12 mb-3 opacity-20" />
                      <p className="text-sm">Nenhuma mensagem</p>
                    </div>
                  )}
                  {messages.map(msg => (
                    <div key={msg.id} className={cn('flex', msg.fromMe ? 'justify-end' : 'justify-start')}>
                      <div className={cn(
                        'max-w-[70%] px-3 py-2 rounded-2xl text-xs',
                        msg.fromMe ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-secondary text-foreground rounded-tl-sm'
                      )}>
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

                {/* Input */}
                <div className="p-3 border-t border-border flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <button className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                      <Paperclip className="w-4 h-4" />
                    </button>
                    <Input
                      value={msgInput}
                      onChange={e => setMsgInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                      placeholder={isConnected ? 'Digite uma mensagem...' : 'Reconecte para enviar mensagens'}
                      disabled={!isConnected || sending}
                      className="flex-1 h-9 text-xs bg-secondary border-border"
                    />
                    <button
                      onClick={handleSend}
                      disabled={!isConnected || !msgInput.trim() || sending}
                      className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-40"
                    >
                      {sending ? <Loader2 className="w-3.5 h-3.5 text-primary-foreground animate-spin" /> : <Send className="w-3.5 h-3.5 text-primary-foreground" />}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* QR Code modal */}
      {qrInstanceName && <QRCodeModal instanceName={qrInstanceName} onClose={() => setQrInstanceName(null)} />}

      {/* Add Meta modal */}
      {showAddMeta && <AddMetaModal onClose={() => setShowAddMeta(false)} onSave={handleAddMeta} />}
    </div>
  );
}
