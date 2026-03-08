import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  MessageSquare, Search, WifiOff, QrCode,
  RefreshCcw, Shield, AlertCircle, X, Loader2,
  Smartphone, RefreshCw, Plus, CheckCheck,
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

const EVOLUTION_API_URL = 'https://evolutionapic.contato-lojavirtual.com';
const EVOLUTION_API_TOKEN = '3ce7a42f9bd96ea526b2b0bc39a4faec';
const META_CONNECTIONS_KEY = 'meta_wa_connections';

// ─── Types ───────────────────────────────────────────────────────────────────
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

// ─── Helpers ─────────────────────────────────────────────────────────────────
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

function getMetaConnections(): MetaConnection[] {
  try { return JSON.parse(localStorage.getItem(META_CONNECTIONS_KEY) || '[]'); } catch { return []; }
}
function saveMetaConnections(c: MetaConnection[]) {
  localStorage.setItem(META_CONNECTIONS_KEY, JSON.stringify(c));
}

// ─── QR Code Modal ───────────────────────────────────────────────────────────
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
          <Button size="sm" className="w-full bg-gradient-primary h-9 text-xs" onClick={generate} disabled={loading}>
            {loading
              ? <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" />Gerando...</>
              : <><RefreshCcw className="w-3 h-3 mr-1.5" />{qrBase64 ? 'Regenerar' : 'Gerar QR Code'}</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Create Instance Modal ───────────────────────────────────────────────────
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

// ─── Add Meta Modal ──────────────────────────────────────────────────────────
function AddMetaModal({ onClose, onSave }: { onClose: () => void; onSave: (c: MetaConnection) => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ label: '', token: '', phoneNumberId: '', businessId: '' });
  const [testing, setTesting] = useState(false);

  const handleSave = async () => {
    if (!form.token || !form.phoneNumberId)
      return toast({ variant: 'destructive', title: 'Preencha Token e Phone Number ID.' });
    setTesting(true);
    try {
      const r = await fetch(`https://graph.facebook.com/v19.0/${form.phoneNumberId}`, {
        headers: { Authorization: `Bearer ${form.token}` },
      });
      const conn: MetaConnection = { id: `meta_${Date.now()}`, ...form, status: r.ok ? 'connected' : 'error' };
      if (r.ok) { toast({ title: 'Conectado!' }); onSave(conn); onClose(); }
      else toast({ variant: 'destructive', title: 'Falha na conexão', description: 'Verifique o token.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally { setTesting(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">🔵 Adicionar número Meta WhatsApp</DialogTitle>
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
              <Input
                value={(form as any)[f.key]}
                onChange={e => setForm(x => ({ ...x, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                type={f.type}
                className="h-9 text-xs bg-secondary border-border"
              />
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

// ─── Status Dot ──────────────────────────────────────────────────────────────
const StatusDot = ({ status }: { status: string }) => {
  const isOpen = status === 'open' || status === 'connected';
  const isWaiting = status === 'connecting' || status === 'qrcode';
  return (
    <span className={cn(
      'w-2 h-2 rounded-full flex-shrink-0 inline-block',
      isOpen ? 'bg-success' : isWaiting ? 'bg-warning animate-pulse' : 'bg-muted-foreground/40'
    )} />
  );
};

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function WhatsAppPage() {
  const { user, hasRole } = useAuth();
  const { toast } = useToast();
  const isAdmin = hasRole(['admin', 'director', 'supervisor']);
  const { instances: evoInstances, loading: evoLoading, refetch: refetchEvo } = useEvolutionInstances();

  const [metaConns, setMetaConns] = useState<MetaConnection[]>(getMetaConnections);
  const [showAddMeta, setShowAddMeta] = useState(false);
  const [showCreateInst, setShowCreateInst] = useState(false);
  const [qrInstanceName, setQrInstanceName] = useState<string | null>(null);
  const [teamFilter, setTeamFilter] = useState<string>('all');

  // Build unified account list
  const allAccounts: UnifiedAccount[] = [
    ...evoInstances
      .filter(i => {
        if (!isAdmin) return getInstanceForUser(user?.id || '') === i.name;
        if (teamFilter === 'all') return true;
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
  const [search, setSearch] = useState('');
  const [adminTab, setAdminTab] = useState<'chat' | 'instances'>('chat');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-select first account
  useEffect(() => {
    if (allAccounts.length > 0 && !activeAccountId) setActiveAccountId(allAccounts[0].id);
  }, [allAccounts.length]);

  const activeAccount = allAccounts.find(a => a.id === activeAccountId) ?? null;
  const isConnected = activeAccount?.status === 'open' || activeAccount?.status === 'connected';

  // Load chats when account switches
  useEffect(() => {
    if (!activeAccount) return;
    if (activeAccount.type === 'evolution') {
      const inst = activeAccount.raw as EvolutionInstance;
      if (inst.connectionStatus === 'open') loadEvoChats(inst.name);
      else setChats([]);
    } else {
      setChats([]);
    }
    setActiveChat(null);
    setMessages([]);
  }, [activeAccountId]);

  // Resolve real phone from @lid JID using lastMessage alt fields
  const resolvePhone = (c: any): string => {
    const jid: string = c.remoteJid || '';
    if (!jid.includes('@lid')) return jid.replace(/@.*/, '');
    const alt: string =
      c.lastMessage?.key?.remoteJidAlt ||
      c.lastMessage?.key?.participantAlt ||
      '';
    return alt ? alt.replace(/@.*/, '') : jid.replace(/@.*/, '');
  };

  const loadEvoChats = async (instanceName: string) => {
    setLoadingChats(true);
    setChats([]);
    try {
      const data = await evoFetch(`/chat/findChats/${instanceName}`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const raw: any[] = Array.isArray(data) ? data : (data?.chats || []);

      // Deduplicate: @lid and phone-based JIDs for same contact → keep latest by timestamp
      const phoneMap = new Map<string, Chat>();
      for (const c of raw) {
        const phone = resolvePhone(c);
        const ts =
          c.lastMessage?.messageTimestamp ||
          (c.updatedAt ? Math.floor(new Date(c.updatedAt).getTime() / 1000) : 0);
        const existing = phoneMap.get(phone);
        if (!existing || ts > existing.lastMessageTs) {
          phoneMap.set(phone, {
            id: c.id || c.remoteJid,
            remoteJid: c.remoteJid || c.id || '',
            phone,
            name:
              c.name ||
              c.pushName ||
              c.lastMessage?.pushName ||
              phone ||
              'Desconhecido',
            lastMessage:
              c.lastMessage?.message?.conversation ||
              c.lastMessage?.message?.extendedTextMessage?.text ||
              '',
            lastMessageTs: ts,
            unread: c.unreadCount || 0,
          });
        }
      }
      setChats(Array.from(phoneMap.values()).slice(0, 80));
    } catch {
      setChats([]);
    } finally {
      setLoadingChats(false);
    }
  };

  // Load messages when chat changes
  useEffect(() => {
    if (!activeChat || !activeAccount) return;
    if (activeAccount.type === 'evolution') {
      loadEvoMessages((activeAccount.raw as EvolutionInstance).name, activeChat.remoteJid, true);
    }
  }, [activeChat?.id]);

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

      const parsed: Message[] = raw
        .filter((m: any) => {
          if (m.messageType === 'protocolMessage' || m.messageType === 'reactionMessage') return false;
          // Safety: only messages from this exact chat (handles @lid via remoteJidAlt)
          const kr: string = m.key?.remoteJid || '';
          const krAlt: string = m.key?.remoteJidAlt || '';
          return kr === remoteJid || krAlt === remoteJid;
        })
        .map((m: any) => ({
          id: m.id || m.key?.id || `${m.messageTimestamp}_${Math.random()}`,
          fromMe: m.key?.fromMe === true,
          body: parseBody(m),
          timestamp: m.messageTimestamp || 0,
        }))
        .sort((a, b) => a.timestamp - b.timestamp);

      setMessages(prev => {
        if (
          !scroll &&
          prev.length === parsed.length &&
          prev[prev.length - 1]?.id === parsed[parsed.length - 1]?.id
        ) return prev;
        return parsed;
      });
    } catch { /* silent */ }
    finally { if (scroll) setLoadingMsgs(false); }
  };

  // Real-time poll every 5 seconds
  useEffect(() => {
    if (!activeChat || !activeAccount || activeAccount.type !== 'evolution') return;
    const inst = activeAccount.raw as EvolutionInstance;
    if (inst.connectionStatus !== 'open') return;
    const timer = setInterval(
      () => loadEvoMessages(inst.name, activeChat.remoteJid, false),
      5000
    );
    return () => clearInterval(timer);
  }, [activeChat?.id, activeAccountId]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleAddMeta = (conn: MetaConnection) => {
    const updated = [...metaConns, conn];
    setMetaConns(updated);
    saveMetaConnections(updated);
  };

  const filteredChats = chats.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search) ||
    c.lastMessage.toLowerCase().includes(search.toLowerCase())
  );

  const displayName = (c: Chat) =>
    c.name && c.name !== c.phone ? c.name : c.phone;

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
              <button
                onClick={() => setAdminTab('chat')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                  adminTab === 'chat' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                )}>
                <MessageSquare className="w-3.5 h-3.5" /> Conversas
              </button>
              <button
                onClick={() => setAdminTab('instances')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                  adminTab === 'instances' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                )}>
                <Shield className="w-3.5 h-3.5" /> Instâncias
              </button>
            </div>
          )}
          <Button size="sm" variant="outline" className="text-xs h-8 border-border gap-1" onClick={() => setShowAddMeta(true)}>
            🔵 Meta
          </Button>
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

      {/* ── Instances Tab (Admin) ─────────────────────────────────────────────── */}
      {isAdmin && adminTab === 'instances' && (
        <div className="flex-1 overflow-y-auto space-y-5">
          {/* Team filter */}
          <div className="flex gap-1.5 flex-wrap">
            {[{ id: 'all', name: 'Todos os Times' }, ...MOCK_TEAMS].map(t => (
              <button
                key={t.id}
                onClick={() => setTeamFilter(t.id)}
                className={cn(
                  'text-xs px-3 py-1.5 rounded-lg border transition-all',
                  teamFilter === t.id
                    ? 'bg-primary/15 border-primary/30 text-primary'
                    : 'border-border text-muted-foreground hover:bg-muted'
                )}>
                {t.name}
              </button>
            ))}
          </div>

          {/* Evolution instances grid */}
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
                      : <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0"><Smartphone className="w-4 h-4 text-muted-foreground" /></div>}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-xs font-semibold truncate">{inst.profileName || inst.name}</p>
                        <span className={cn(
                          'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                          isOpen ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
                        )}>
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
                      <div className="flex gap-2 mt-2">
                        {!isOpen && (
                          <Button
                            size="sm" variant="outline" className="text-[10px] h-6 border-border px-2 gap-1"
                            onClick={() => setQrInstanceName(inst.name)}>
                            <QrCode className="w-3 h-3" /> Conectar
                          </Button>
                        )}
                        <Button
                          size="sm" variant="ghost" className="text-[10px] h-6 px-2 gap-1 text-muted-foreground"
                          onClick={() => { setAdminTab('chat'); setActiveAccountId(`evo_${inst.name}`); }}>
                          <MessageSquare className="w-3 h-3" /> Ver chat
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Meta connections */}
          {metaConns.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                🔵 Meta Cloud API — {metaConns.length} números
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {metaConns.map(conn => (
                  <div key={conn.id} className="glass-card p-4 border border-border rounded-xl">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-xs font-semibold">{conn.label || conn.phoneNumberId}</p>
                      <span className={cn(
                        'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                        conn.status === 'connected' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                      )}>
                        {conn.status === 'connected' ? 'Conectado' : 'Erro'}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground font-mono">{conn.phoneNumberId}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Chat Tab ─────────────────────────────────────────────────────────── */}
      {(!isAdmin || adminTab === 'chat') && (
        <div className="flex-1 flex gap-4 min-h-0">
          {/* Sidebar: accounts + chat list */}
          <div className="w-72 flex-shrink-0 glass-card flex flex-col min-h-0">
            {/* Account selector */}
            <div className="p-2 border-b border-border space-y-1 flex-shrink-0 max-h-36 overflow-y-auto">
              {allAccounts.map(acc => (
                <button
                  key={acc.id}
                  onClick={() => setActiveAccountId(acc.id)}
                  className={cn(
                    'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors',
                    activeAccountId === acc.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50 text-foreground'
                  )}>
                  {acc.avatarUrl
                    ? <img src={acc.avatarUrl} className="w-6 h-6 rounded-full border border-border object-cover flex-shrink-0" alt="" />
                    : <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center flex-shrink-0 text-[10px] font-bold">
                        {(acc.name || '?')[0]}
                      </div>}
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold truncate">{acc.name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono truncate">{acc.phone}</p>
                  </div>
                  <StatusDot status={acc.status} />
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="p-2 border-b border-border flex-shrink-0">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar conversa..."
                  className="h-7 text-[11px] pl-6 bg-secondary border-border"
                />
              </div>
            </div>

            {/* Chat list */}
            <div className="flex-1 overflow-y-auto">
              {isConnected && loadingChats && (
                <div className="flex items-center justify-center gap-2 p-4 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-xs">Carregando...</span>
                </div>
              )}
              {!isConnected && (
                <div className="p-4 text-center">
                  <WifiOff className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground mb-2">Instância desconectada</p>
                  {activeAccount?.type === 'evolution' && (
                    <Button
                      size="sm" variant="outline" className="text-xs border-border gap-1 h-7"
                      onClick={() => setQrInstanceName((activeAccount.raw as EvolutionInstance).name)}>
                      <QrCode className="w-3 h-3" /> Gerar QR Code
                    </Button>
                  )}
                </div>
              )}
              {filteredChats.map(chat => (
                <div
                  key={chat.id}
                  onClick={() => setActiveChat(chat)}
                  className={cn(
                    'flex items-start gap-3 p-3 border-b border-border/50 cursor-pointer hover:bg-muted/30 transition-colors',
                    activeChat?.id === chat.id && 'bg-muted/50'
                  )}>
                  {/* Avatar with unread indicator */}
                  <div className="relative flex-shrink-0">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                      {(displayName(chat) || '?')[0].toUpperCase()}
                    </div>
                    {chat.unread > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-success border-2 border-background" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className={cn('text-xs font-semibold truncate', chat.unread > 0 && 'text-foreground')}>
                        {displayName(chat)}
                      </p>
                      <span className="text-[10px] text-muted-foreground flex-shrink-0">
                        {chat.lastMessageTs
                          ? new Date(chat.lastMessageTs * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                          : ''}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-[11px] text-muted-foreground truncate">{chat.lastMessage}</p>
                      {chat.unread > 0 && (
                        <span className="flex-shrink-0 min-w-[18px] h-[18px] rounded-full bg-success text-white text-[10px] flex items-center justify-center font-bold px-1">
                          {chat.unread > 99 ? '99+' : chat.unread}
                        </span>
                      )}
                    </div>
                    {/* Show phone as subtitle when contact has a name */}
                    {chat.name && chat.name !== chat.phone && (
                      <p className="text-[10px] text-muted-foreground/60 font-mono">{chat.phone}</p>
                    )}
                  </div>
                </div>
              ))}
              {isConnected && !loadingChats && filteredChats.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <MessageSquare className="w-8 h-8 opacity-30 mb-2" />
                  <p className="text-xs">Nenhuma conversa</p>
                </div>
              )}
            </div>
          </div>

          {/* Chat window (read-only) */}
          <div className="flex-1 min-w-0 glass-card flex flex-col">
            {!activeChat ? (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                <MessageSquare className="w-12 h-12 opacity-20 mb-3" />
                <p className="text-sm">Selecione uma conversa para visualizar</p>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-sm font-bold border border-border">
                      {(displayName(activeChat) || '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{displayName(activeChat)}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{activeChat.phone}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {activeAccount && <StatusDot status={activeAccount.status} />}
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setActiveChat(null)}>
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Messages (read-only) */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {loadingMsgs ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                      <AlertCircle className="w-8 h-8 opacity-20 mb-2" />
                      <p className="text-xs">Nenhuma mensagem</p>
                    </div>
                  ) : (
                    messages.map(msg => (
                      <div
                        key={msg.id}
                        className={cn('flex', msg.fromMe ? 'justify-end' : 'justify-start')}>
                        <div className={cn(
                          'max-w-[70%] px-3 py-2 rounded-2xl text-xs',
                          msg.fromMe
                            ? 'bg-primary text-primary-foreground rounded-tr-sm'
                            : 'bg-secondary text-foreground rounded-tl-sm'
                        )}>
                          <p className="leading-relaxed break-words">{msg.body}</p>
                          <p className={cn(
                            'text-[10px] mt-1 text-right flex items-center justify-end gap-1',
                            msg.fromMe ? 'text-primary-foreground/70' : 'text-muted-foreground'
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

                {/* Read-only notice */}
                <div className="px-4 py-2 border-t border-border flex-shrink-0 bg-muted/30 flex items-center justify-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-[11px] text-muted-foreground">Visualização somente leitura — responda diretamente no WhatsApp do vendedor</span>
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
    </div>
  );
}
