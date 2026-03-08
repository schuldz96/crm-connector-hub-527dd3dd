import { useState, useEffect, useCallback } from 'react';
import { MOCK_INTEGRATIONS, MOCK_USERS } from '@/data/mockData';
import type { Integration } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Plug2, CheckCircle2, XCircle, AlertCircle, Settings2, RefreshCcw,
  Eye, EyeOff, Save, Zap, Brain, Workflow, Activity, ArrowDown,
  ArrowUp, Clock, CheckCheck, AlertTriangle, X, Loader2,
  Smartphone, QrCode, Link2, MessageSquare, Phone, Wifi, WifiOff,
  ExternalLink, RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

// ─── Evolution API config (hardcoded from user) ───────────────────────────────
const EVOLUTION_API_URL = 'https://evolutionapic.contato-lojavirtual.com';
const EVOLUTION_API_TOKEN = '3ce7a42f9bd96ea526b2b0bc39a4faec';

const INTEGRATION_META: Record<string, { icon: string; color: string; desc: string }> = {
  google_calendar: { icon: '📅', color: 'hsl(var(--info))', desc: 'Sincroniza reuniões automaticamente do Google Calendar' },
  google_meet: { icon: '🎥', color: 'hsl(var(--success))', desc: 'Captura dados de chamadas do Google Meet' },
  hubspot: { icon: '🧡', color: 'hsl(38 92% 50%)', desc: 'CRM — sincronize contatos, empresas e negócios' },
  openai: { icon: '🤖', color: 'hsl(var(--primary))', desc: 'IA para análise de reuniões e conversas' },
  evolution_api: { icon: '💬', color: 'hsl(var(--accent))', desc: 'WhatsApp Business via Evolution API' },
  n8n: { icon: '⚡', color: 'hsl(270 80% 65%)', desc: 'Orquestração de automações e fluxos' },
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface EvolutionInstance {
  instance: {
    instanceName: string;
    instanceId: string;
    status: string;
    owner?: string;
    profileName?: string;
    profilePictureUrl?: string;
    number?: string;
  };
  connectionStatus?: string;
}

interface EvolutionMessage {
  key: { id: string; remoteJid: string; fromMe: boolean };
  message?: { conversation?: string; extendedTextMessage?: { text: string }; imageMessage?: { caption?: string } };
  pushName?: string;
  messageTimestamp?: number;
  messageType?: string;
}

interface WebhookLog {
  id: string;
  direction: 'inbound' | 'outbound';
  source: string;
  event: string;
  status: 'success' | 'error' | 'pending';
  statusCode?: number;
  payload: string;
  response?: string;
  timestamp: string;
  duration: number;
}

const MOCK_WEBHOOK_LOGS: WebhookLog[] = [
  { id: 'wh_001', direction: 'inbound', source: 'Evolution API', event: 'messages.upsert', status: 'success', statusCode: 200, payload: '{"event":"messages.upsert","instance":"Vendas Principal","data":{"key":{"id":"3EB0F..."},"message":{"conversation":"Pode me enviar a proposta?"}}}', response: '{"status":"ok"}', timestamp: '2026-03-08T16:20:15Z', duration: 42 },
  { id: 'wh_002', direction: 'outbound', source: 'HubSpot', event: 'contact.note.create', status: 'success', statusCode: 201, payload: '{"contactId":"C-3912","note":"WhatsApp: +55 11 91234-5678 — Solicitou proposta comercial","ownerId":"U-887"}', response: '{"id":"note_99182"}', timestamp: '2026-03-08T16:20:18Z', duration: 310 },
  { id: 'wh_003', direction: 'inbound', source: 'Google Calendar', event: 'meeting.completed', status: 'success', statusCode: 200, payload: '{"meetingId":"mtg_001","title":"Demo Produto - Acme Corp","duration":45}', response: '{"analyzed":true}', timestamp: '2026-03-08T15:55:00Z', duration: 28 },
  { id: 'wh_004', direction: 'outbound', source: 'N8N', event: 'meeting.analyzed', status: 'error', statusCode: 500, payload: '{"meetingId":"mtg_001","score":87,"aiSummary":"Excelente reunião..."}', response: '{"error":"Connection refused"}', timestamp: '2026-03-08T15:55:05Z', duration: 5001 },
  { id: 'wh_005', direction: 'inbound', source: 'Evolution API', event: 'connection.update', status: 'success', statusCode: 200, payload: '{"instance":"Closer CS","state":"close"}', response: '{"status":"ok"}', timestamp: '2026-03-08T10:00:00Z', duration: 18 },
  { id: 'wh_006', direction: 'outbound', source: 'HubSpot', event: 'deal.note.create', status: 'pending', payload: '{"dealId":"D-5521","note":"Call com Roberto Faria — Score 87..."}', timestamp: '2026-03-08T09:00:00Z', duration: 0 },
  { id: 'wh_007', direction: 'inbound', source: 'Evolution API', event: 'messages.upsert', status: 'success', statusCode: 200, payload: '{"event":"messages.upsert","instance":"SDR Team Beta","data":{...}}', response: '{"status":"ok"}', timestamp: '2026-03-08T08:00:00Z', duration: 55 },
];

// ─── Evolution API helpers ────────────────────────────────────────────────────
async function evolutionFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${EVOLUTION_API_URL}${path}`, {
    ...options,
    headers: {
      'apikey': EVOLUTION_API_TOKEN,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ─── Instance Status Badge ────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const isOpen = status === 'open' || status === 'connected';
  const isConnecting = status === 'connecting' || status === 'qrcode';
  return (
    <span className={cn(
      'inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-medium',
      isOpen ? 'bg-success/10 text-success border-success/20' :
      isConnecting ? 'bg-warning/10 text-warning border-warning/20' :
      'bg-muted text-muted-foreground border-border'
    )}>
      {isOpen ? <Wifi className="w-2.5 h-2.5" /> : isConnecting ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <WifiOff className="w-2.5 h-2.5" />}
      {isOpen ? 'Conectado' : isConnecting ? 'Conectando...' : 'Desconectado'}
    </span>
  );
}

// ─── Evolution Instances Panel ────────────────────────────────────────────────
function EvolutionPanel() {
  const { toast } = useToast();
  const { user: currentUser, hasRole } = useAuth();
  const isAdmin = hasRole(['admin', 'director', 'supervisor']);

  const [instances, setInstances] = useState<EvolutionInstance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedInstance, setSelectedInstance] = useState<EvolutionInstance | null>(null);
  const [messages, setMessages] = useState<EvolutionMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loadingQr, setLoadingQr] = useState(false);
  // instance → userId mapping (in-memory)
  const [instanceUserMap, setInstanceUserMap] = useState<Record<string, string>>({});

  const fetchInstances = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await evolutionFetch('/instance/fetchInstances');
      const list: EvolutionInstance[] = Array.isArray(data) ? data : [];
      setInstances(list);
    } catch (e: any) {
      setError(`Erro ao carregar instâncias: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchInstances(); }, [fetchInstances]);

  const fetchMessages = async (instanceName: string) => {
    setLoadingMessages(true);
    try {
      const data = await evolutionFetch(`/chat/findMessages/${instanceName}`, {
        method: 'POST',
        body: JSON.stringify({ where: {}, limit: 20 }),
      });
      const msgs: EvolutionMessage[] = Array.isArray(data?.messages?.records) ? data.messages.records : [];
      setMessages(msgs);
    } catch {
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleSelectInstance = (inst: EvolutionInstance) => {
    setSelectedInstance(inst);
    setQrCode(null);
    fetchMessages(inst.instance.instanceName);
  };

  const handleGetQr = async (instanceName: string) => {
    setLoadingQr(true);
    setQrCode(null);
    try {
      const data = await evolutionFetch(`/instance/connect/${instanceName}`);
      const base64 = data?.base64 || data?.qrcode?.base64 || null;
      setQrCode(base64);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao obter QR Code', description: e.message });
    } finally {
      setLoadingQr(false);
    }
  };

  const handleDisconnect = async (instanceName: string) => {
    try {
      await evolutionFetch(`/instance/logout/${instanceName}`, { method: 'DELETE' });
      toast({ title: 'Instância desconectada' });
      fetchInstances();
      setSelectedInstance(null);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    }
  };

  const myInstance = instances.find(i =>
    instanceUserMap[i.instance.instanceName] === currentUser?.id
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-accent" />
          </div>
          <div>
            <p className="text-sm font-semibold">Evolution API — WhatsApp</p>
            <p className="text-xs text-muted-foreground">{EVOLUTION_API_URL}</p>
          </div>
        </div>
        <Button size="sm" variant="outline" className="text-xs h-7 border-border gap-1.5" onClick={fetchInstances} disabled={loading}>
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Atualizar
        </Button>
      </div>

      {/* My instance banner (non-admin) */}
      {!isAdmin && myInstance && (
        <div className={cn(
          'p-3 rounded-xl border flex items-center gap-3',
          myInstance.instance.status === 'open' ? 'bg-success/5 border-success/20' : 'bg-warning/5 border-warning/20'
        )}>
          <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-semibold">{myInstance.instance.profileName || myInstance.instance.instanceName}</p>
            <p className="text-xs text-muted-foreground">{myInstance.instance.number || myInstance.instance.owner || '—'}</p>
          </div>
          <StatusBadge status={myInstance.instance.status} />
          {myInstance.instance.status !== 'open' && (
            <Button size="sm" className="text-xs h-7 bg-gradient-primary" onClick={() => handleGetQr(myInstance.instance.instanceName)}>
              <QrCode className="w-3 h-3 mr-1" /> Reconectar
            </Button>
          )}
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
          <p className="text-xs text-muted-foreground">{error}</p>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-xs">Carregando instâncias...</span>
        </div>
      )}

      {!loading && instances.length === 0 && !error && (
        <div className="text-center py-8">
          <MessageSquare className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">Nenhuma instância encontrada</p>
        </div>
      )}

      {/* Instances grid */}
      {!loading && instances.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {instances.map(inst => {
            const name = inst.instance.instanceName;
            const status = inst.instance.status;
            const isOpen = status === 'open';
            const assignedUserId = instanceUserMap[name];
            const assignedUser = MOCK_USERS.find(u => u.id === assignedUserId);
            const isSelected = selectedInstance?.instance.instanceName === name;

            return (
              <div
                key={name}
                className={cn(
                  'glass-card p-4 flex flex-col gap-3 cursor-pointer transition-all border',
                  isSelected ? 'border-primary/40 bg-primary/5' : 'border-border hover:border-primary/20'
                )}
                onClick={() => handleSelectInstance(inst)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    {inst.instance.profilePictureUrl ? (
                      <img src={inst.instance.profilePictureUrl} alt={name} className="w-9 h-9 rounded-full border border-border object-cover" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center">
                        <Smartphone className="w-4 h-4 text-accent" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate">{inst.instance.profileName || name}</p>
                      <p className="text-[10px] text-muted-foreground font-mono truncate">
                        {inst.instance.number || inst.instance.owner || name}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={status} />
                </div>

                {assignedUser && (
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <img src={assignedUser.avatar} alt={assignedUser.name} className="w-4 h-4 rounded-full border border-border" />
                    {assignedUser.name}
                  </div>
                )}

                {isAdmin && (
                  <div onClick={e => e.stopPropagation()}>
                    <label className="text-[10px] text-muted-foreground block mb-1">Atribuir a usuário</label>
                    <select
                      value={assignedUserId || ''}
                      onChange={e => setInstanceUserMap(m => ({ ...m, [name]: e.target.value }))}
                      className="w-full h-7 text-[10px] bg-secondary border border-border rounded-lg px-2 text-foreground"
                    >
                      <option value="">— Sem atribuição —</option>
                      {MOCK_USERS.filter(u => u.status === 'active').map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex gap-1.5">
                  {!isOpen ? (
                    <Button
                      size="sm"
                      className="flex-1 text-[10px] h-6 bg-gradient-primary"
                      onClick={e => { e.stopPropagation(); handleGetQr(name); }}
                      disabled={loadingQr}
                    >
                      <QrCode className="w-3 h-3 mr-1" /> {loadingQr ? 'Aguarde...' : 'Conectar / QR'}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-[10px] h-6 border-destructive/30 text-destructive hover:bg-destructive/10"
                      onClick={e => { e.stopPropagation(); handleDisconnect(name); }}
                    >
                      <WifiOff className="w-3 h-3 mr-1" /> Desconectar
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* QR Code modal */}
      {qrCode && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setQrCode(null)}>
          <div className="glass-card p-6 max-w-sm w-full text-center space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Escanear QR Code</h3>
              <button onClick={() => setQrCode(null)} className="w-6 h-6 rounded hover:bg-muted flex items-center justify-center">
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">Abra o WhatsApp → Dispositivos vinculados → Vincular dispositivo</p>
            <img src={qrCode} alt="QR Code" className="w-56 h-56 mx-auto rounded-xl border border-border" />
            <p className="text-[10px] text-muted-foreground">O QR Code expira em 60 segundos</p>
            <Button size="sm" variant="outline" className="w-full text-xs border-border" onClick={() => setQrCode(null)}>Fechar</Button>
          </div>
        </div>
      )}

      {/* Messages panel */}
      {selectedInstance && (
        <div className="glass-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-accent" />
              <p className="text-xs font-semibold">
                Mensagens — {selectedInstance.instance.profileName || selectedInstance.instance.instanceName}
              </p>
            </div>
            <Button size="sm" variant="outline" className="text-xs h-6 border-border" onClick={() => fetchMessages(selectedInstance.instance.instanceName)}>
              <RefreshCw className="w-3 h-3" />
            </Button>
          </div>

          {loadingMessages && (
            <div className="flex items-center justify-center py-4 gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-xs">Carregando mensagens...</span>
            </div>
          )}

          {!loadingMessages && messages.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">Nenhuma mensagem encontrada</p>
          )}

          {!loadingMessages && messages.length > 0 && (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {messages.slice(0, 20).map((msg, i) => {
                const text = msg.message?.conversation
                  || msg.message?.extendedTextMessage?.text
                  || msg.message?.imageMessage?.caption
                  || '[mídia]';
                const isOut = msg.key.fromMe;
                const ts = msg.messageTimestamp ? new Date(msg.messageTimestamp * 1000) : null;
                const jid = msg.key.remoteJid?.replace('@s.whatsapp.net', '').replace('@g.us', ' (grupo)');
                return (
                  <div key={i} className={cn('flex gap-2', isOut ? 'flex-row-reverse' : 'flex-row')}>
                    <div className={cn(
                      'max-w-[75%] px-3 py-2 rounded-xl text-xs',
                      isOut ? 'bg-primary/10 text-primary rounded-tr-sm' : 'bg-secondary text-muted-foreground rounded-tl-sm border border-border'
                    )}>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-semibold text-[10px]">
                          {isOut ? 'Você' : (msg.pushName || jid)}
                        </span>
                        <span className="text-[9px] opacity-60">{ts?.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                        <span className={cn('text-[8px] px-1 rounded', isOut ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground')}>
                          {isOut ? '↑ saída' : '↓ entrada'}
                        </span>
                      </div>
                      <p>{text}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Meta WhatsApp Config ─────────────────────────────────────────────────────
function MetaWhatsAppPanel() {
  const { toast } = useToast();
  const [showToken, setShowToken] = useState(false);
  const [form, setForm] = useState({
    token: localStorage.getItem('meta_wa_token') || '',
    phoneNumberId: localStorage.getItem('meta_wa_phone_id') || '',
    businessId: localStorage.getItem('meta_wa_business_id') || '',
  });
  const [testing, setTesting] = useState(false);

  const handleSave = () => {
    localStorage.setItem('meta_wa_token', form.token);
    localStorage.setItem('meta_wa_phone_id', form.phoneNumberId);
    localStorage.setItem('meta_wa_business_id', form.businessId);
    toast({ title: 'Credenciais Meta salvas', description: 'Configuração da API do WhatsApp (Meta) atualizada.' });
  };

  const handleTest = async () => {
    if (!form.token || !form.phoneNumberId) {
      toast({ variant: 'destructive', title: 'Preencha Token e Phone Number ID antes de testar.' });
      return;
    }
    setTesting(true);
    try {
      const res = await fetch(`https://graph.facebook.com/v19.0/${form.phoneNumberId}`, {
        headers: { Authorization: `Bearer ${form.token}` },
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: 'Conexão OK!', description: `Número: ${data.display_phone_number || form.phoneNumberId}` });
      } else {
        toast({ variant: 'destructive', title: 'Falha na conexão', description: data.error?.message || 'Verifique o token.' });
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl" style={{ background: 'hsl(215 100% 56% / 0.1)' }}>
          🔵
        </div>
        <div>
          <p className="text-sm font-semibold">WhatsApp Business API — Meta</p>
          <p className="text-xs text-muted-foreground">Conecte via token de acesso da Meta (Cloud API)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="md:col-span-2">
          <label className="text-xs font-medium block mb-1.5">Access Token</label>
          <div className="relative">
            <Input
              type={showToken ? 'text' : 'password'}
              value={form.token}
              onChange={e => setForm(f => ({ ...f, token: e.target.value }))}
              placeholder="EAAxxxxx..."
              className="h-9 text-xs bg-secondary border-border pr-9 font-mono"
            />
            <button onClick={() => setShowToken(s => !s)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
              {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
        <div>
          <label className="text-xs font-medium block mb-1.5">Phone Number ID</label>
          <Input
            value={form.phoneNumberId}
            onChange={e => setForm(f => ({ ...f, phoneNumberId: e.target.value }))}
            placeholder="1234567890"
            className="h-9 text-xs bg-secondary border-border font-mono"
          />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1.5">Business ID</label>
          <Input
            value={form.businessId}
            onChange={e => setForm(f => ({ ...f, businessId: e.target.value }))}
            placeholder="9876543210"
            className="h-9 text-xs bg-secondary border-border font-mono"
          />
        </div>
      </div>

      <div className="p-3 rounded-lg bg-info/5 border border-info/20">
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Obtenha as credenciais em{' '}
          <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer" className="text-primary underline inline-flex items-center gap-0.5">
            developers.facebook.com <ExternalLink className="w-2.5 h-2.5" />
          </a>
          {' '}→ Seu App → WhatsApp → Configuração da API.
        </p>
      </div>

      <div className="flex gap-2">
        <Button size="sm" className="flex-1 text-xs h-8 bg-gradient-primary" onClick={handleSave}>
          <Save className="w-3 h-3 mr-1.5" /> Salvar
        </Button>
        <Button size="sm" variant="outline" className="text-xs h-8 border-border" onClick={handleTest} disabled={testing}>
          {testing ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Link2 className="w-3 h-3 mr-1" />}
          Testar Conexão
        </Button>
      </div>
    </div>
  );
}

// ─── Other integration card ────────────────────────────────────────────────────
function IntegrationCard({ integration, onConfig }: { integration: Integration; onConfig: (i: Integration) => void }) {
  const meta = INTEGRATION_META[integration.type];
  const statusConfig = {
    connected: { icon: CheckCircle2, class: 'text-success', label: 'Conectado' },
    disconnected: { icon: XCircle, class: 'text-muted-foreground', label: 'Desconectado' },
    error: { icon: AlertCircle, class: 'text-destructive', label: 'Erro' },
  }[integration.status];

  return (
    <div className="glass-card-hover p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: `${meta.color}20` }}>
            {meta.icon}
          </div>
          <div>
            <p className="font-semibold text-sm">{integration.name}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <statusConfig.icon className={cn('w-3 h-3', statusConfig.class)} />
              <span className={cn('text-xs', statusConfig.class)}>{statusConfig.label}</span>
            </div>
          </div>
        </div>
        <button onClick={() => onConfig(integration)} className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center transition-colors">
          <Settings2 className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>
      <p className="text-xs text-muted-foreground mb-4">{meta.desc}</p>
      <div className="flex items-center gap-2">
        {integration.status === 'connected' ? (
          <Button size="sm" variant="outline" className="text-xs h-7 border-border flex-1">
            <RefreshCcw className="w-3 h-3 mr-1" /> Sincronizar
          </Button>
        ) : (
          <Button size="sm" className="text-xs h-7 bg-gradient-primary flex-1">
            <Plug2 className="w-3 h-3 mr-1" /> Conectar
          </Button>
        )}
        {integration.configuredAt && (
          <span className="text-[10px] text-muted-foreground">
            {new Date(integration.configuredAt).toLocaleDateString('pt-BR')}
          </span>
        )}
      </div>
    </div>
  );
}

function ConfigPanel({ integration, onClose }: { integration: Integration; onClose: () => void }) {
  const [showKey, setShowKey] = useState(false);
  const fields: Record<string, { fields: { key: string; label: string; placeholder: string }[] }> = {
    openai: { fields: [{ key: 'api_key', label: 'API Key', placeholder: 'sk-proj-...' }] },
    evolution_api: { fields: [{ key: 'url', label: 'URL da API', placeholder: 'https://api.evolution.com' }, { key: 'token', label: 'API Token', placeholder: 'Token de autenticação' }] },
    n8n: { fields: [{ key: 'webhook_url', label: 'Webhook URL', placeholder: 'https://n8n.meudominio.com/webhook/...' }, { key: 'api_key', label: 'API Key (opcional)', placeholder: 'Bearer token' }] },
    hubspot: { fields: [{ key: 'access_token', label: 'Access Token', placeholder: 'pat-...' }] },
    google_calendar: { fields: [{ key: 'client_id', label: 'Client ID', placeholder: 'xxx.apps.googleusercontent.com' }, { key: 'client_secret', label: 'Client Secret', placeholder: 'GOCSPX-...' }] },
    google_meet: { fields: [{ key: 'same', label: 'Usa as mesmas credenciais do Google Calendar', placeholder: '' }] },
  };
  const config = fields[integration.type];

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-semibold text-sm">Configurar {integration.name}</h3>
        <button onClick={onClose} className="w-6 h-6 rounded flex items-center justify-center hover:bg-muted">
          <X className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>
      <div className="space-y-3">
        {config?.fields.map(f => (
          <div key={f.key}>
            <label className="text-xs font-medium block mb-1.5">{f.label}</label>
            <div className="relative">
              <Input type={showKey ? 'text' : 'password'} placeholder={f.placeholder} className="h-8 text-xs bg-secondary border-border pr-8" />
              <button onClick={() => setShowKey(!showKey)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        ))}
        <div className="p-3 rounded-lg bg-muted/50 border border-border">
          <p className="text-xs text-muted-foreground">⚠️ As credenciais são armazenadas com criptografia e nunca expostas no frontend.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="flex-1 text-xs bg-gradient-primary h-8"><Save className="w-3 h-3 mr-1" /> Salvar</Button>
          <Button size="sm" variant="outline" className="text-xs border-border h-8">Testar Conexão</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Webhook Logs ─────────────────────────────────────────────────────────────
function WebhookLogs() {
  const [selected, setSelected] = useState<WebhookLog | null>(null);
  const [dirFilter, setDirFilter] = useState<'all' | 'inbound' | 'outbound'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'error' | 'pending'>('all');

  const filtered = MOCK_WEBHOOK_LOGS.filter(l => {
    const matchDir = dirFilter === 'all' || l.direction === dirFilter;
    const matchStatus = statusFilter === 'all' || l.status === statusFilter;
    return matchDir && matchStatus;
  });

  const statusConfig = {
    success: { icon: CheckCheck, class: 'text-success bg-success/10 border-success/20', dot: 'bg-success' },
    error: { icon: AlertTriangle, class: 'text-destructive bg-destructive/10 border-destructive/20', dot: 'bg-destructive' },
    pending: { icon: Loader2, class: 'text-warning bg-warning/10 border-warning/20', dot: 'bg-warning' },
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total hoje', value: MOCK_WEBHOOK_LOGS.length, color: 'text-foreground' },
          { label: 'Sucesso', value: MOCK_WEBHOOK_LOGS.filter(l => l.status === 'success').length, color: 'text-success' },
          { label: 'Erros', value: MOCK_WEBHOOK_LOGS.filter(l => l.status === 'error').length, color: 'text-destructive' },
          { label: 'Pendentes', value: MOCK_WEBHOOK_LOGS.filter(l => l.status === 'pending').length, color: 'text-warning' },
        ].map(s => (
          <div key={s.label} className="glass-card p-3 rounded-xl text-center">
            <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1 p-1 bg-secondary rounded-lg border border-border">
          {(['all', 'inbound', 'outbound'] as const).map(d => (
            <button key={d} onClick={() => setDirFilter(d)}
              className={cn('flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors',
                dirFilter === d ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
              {d === 'inbound' ? <ArrowDown className="w-3 h-3" /> : d === 'outbound' ? <ArrowUp className="w-3 h-3" /> : <Activity className="w-3 h-3" />}
              {{ all: 'Todos', inbound: 'Recebidos', outbound: 'Enviados' }[d]}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          {(['all', 'success', 'error', 'pending'] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={cn('text-xs px-2.5 py-1.5 rounded-lg border transition-all',
                statusFilter === s ? 'bg-primary/15 border-primary/30 text-primary' : 'border-border text-muted-foreground hover:bg-muted')}>
              {{ all: 'Todos', success: '✓ Sucesso', error: '✕ Erro', pending: '◷ Pendente' }[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-4">
        <div className={cn('glass-card overflow-hidden flex-1', selected && 'lg:w-1/2')}>
          <table className="w-full data-table">
            <thead>
              <tr>
                <th className="text-left">Evento</th>
                <th className="text-center">Direção</th>
                <th className="text-center">Status</th>
                <th className="text-center hidden lg:table-cell">Código</th>
                <th className="text-center hidden lg:table-cell">Duração</th>
                <th className="text-center">Hora</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(log => {
                const sc = statusConfig[log.status];
                return (
                  <tr key={log.id} className={cn('cursor-pointer', selected?.id === log.id && 'bg-primary/5')}
                    onClick={() => setSelected(selected?.id === log.id ? null : log)}>
                    <td>
                      <div>
                        <p className="text-xs font-medium">{log.source}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{log.event}</p>
                      </div>
                    </td>
                    <td className="text-center">
                      <span className={cn('inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border',
                        log.direction === 'inbound' ? 'bg-info/10 text-info border-info/20' : 'bg-accent/10 text-accent border-accent/20')}>
                        {log.direction === 'inbound'
                          ? <><ArrowDown className="w-2.5 h-2.5" /> Recebido</>
                          : <><ArrowUp className="w-2.5 h-2.5" /> Enviado</>}
                      </span>
                    </td>
                    <td className="text-center">
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded border', sc.class)}>
                        {log.status === 'success' ? 'Sucesso' : log.status === 'error' ? 'Erro' : 'Pendente'}
                      </span>
                    </td>
                    <td className="text-center hidden lg:table-cell">
                      <span className={cn('text-xs font-mono font-semibold',
                        log.statusCode && log.statusCode >= 400 ? 'text-destructive' : log.statusCode ? 'text-success' : 'text-muted-foreground')}>
                        {log.statusCode || '—'}
                      </span>
                    </td>
                    <td className="text-center hidden lg:table-cell">
                      <span className={cn('text-xs', log.duration > 1000 ? 'text-warning' : 'text-muted-foreground')}>
                        {log.duration ? `${log.duration}ms` : '—'}
                      </span>
                    </td>
                    <td className="text-center">
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(log.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {selected && (
          <div className="w-full lg:w-[360px] flex-shrink-0 glass-card p-4 space-y-3 animate-slide-in">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold">Detalhes do Webhook</h4>
              <button onClick={() => setSelected(null)} className="w-5 h-5 flex items-center justify-center hover:bg-muted rounded">
                <X className="w-3 h-3 text-muted-foreground" />
              </button>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">Fonte</span><span className="font-medium">{selected.source}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Evento</span><span className="font-mono text-primary">{selected.event}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Direção</span><span>{selected.direction === 'inbound' ? '↓ Recebido' : '↑ Enviado'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Status HTTP</span><span className={cn('font-bold', selected.statusCode && selected.statusCode >= 400 ? 'text-destructive' : 'text-success')}>{selected.statusCode || '—'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Duração</span><span>{selected.duration ? `${selected.duration}ms` : '—'}</span></div>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-1.5">Payload</p>
              <pre className="text-[10px] font-mono bg-secondary border border-border rounded-lg p-3 overflow-x-auto text-muted-foreground whitespace-pre-wrap break-all">
                {JSON.stringify(JSON.parse(selected.payload), null, 2)}
              </pre>
            </div>
            {selected.response && (
              <div>
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-1.5">Response</p>
                <pre className="text-[10px] font-mono bg-secondary border border-border rounded-lg p-3 overflow-x-auto text-muted-foreground whitespace-pre-wrap break-all">
                  {JSON.stringify(JSON.parse(selected.response), null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function IntegrationsPage() {
  const [configuring, setConfiguring] = useState<Integration | null>(null);
  const [tab, setTab] = useState<'integrations' | 'evolution' | 'meta' | 'webhooks'>('integrations');

  const otherIntegrations = MOCK_INTEGRATIONS.filter(i => i.type !== 'evolution_api');

  return (
    <div className="page-container animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold">Integrações</h1>
          <p className="text-sm text-muted-foreground">Conecte ferramentas à Appmax</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-secondary rounded-lg border border-border mb-6 w-fit flex-wrap">
        {[
          { key: 'integrations', label: 'Conexões', icon: Plug2 },
          { key: 'evolution', label: 'Evolution API', icon: MessageSquare },
          { key: 'meta', label: 'Meta WhatsApp', icon: Phone },
          { key: 'webhooks', label: 'Logs', icon: Activity },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={cn('flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-medium transition-colors',
              tab === t.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'integrations' && (
        <>
          <div className="glass-card p-5 mb-6 border-primary/20" style={{ background: 'linear-gradient(135deg, hsl(var(--primary)/0.08), hsl(var(--accent)/0.05))' }}>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-display font-semibold">Automações N8N</p>
                  <p className="text-xs text-muted-foreground">Dispare fluxos automáticos a partir de eventos na plataforma</p>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" className="text-xs h-8 border-primary/30 text-primary"><Zap className="w-3 h-3 mr-1" /> Iniciar Automação WhatsApp</Button>
                <Button size="sm" variant="outline" className="text-xs h-8 border-primary/30 text-primary"><Brain className="w-3 h-3 mr-1" /> Analisar Conversa</Button>
                <Button size="sm" variant="outline" className="text-xs h-8 border-primary/30 text-primary"><Workflow className="w-3 h-3 mr-1" /> Fluxo de Vendas</Button>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {otherIntegrations.map(i => (
              <IntegrationCard key={i.id} integration={i} onConfig={setConfiguring} />
            ))}
          </div>
        </>
      )}

      {tab === 'evolution' && <EvolutionPanel />}
      {tab === 'meta' && <MetaWhatsAppPanel />}
      {tab === 'webhooks' && <WebhookLogs />}

      {configuring && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setConfiguring(null)}>
          <div className="w-full max-w-md" onClick={e => e.stopPropagation()}>
            <ConfigPanel integration={configuring} onClose={() => setConfiguring(null)} />
          </div>
        </div>
      )}
    </div>
  );
}
