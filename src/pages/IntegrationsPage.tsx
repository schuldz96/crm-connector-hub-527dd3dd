import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  RefreshCw, Loader2, Smartphone, QrCode, MessageSquare,
  Phone, Wifi, WifiOff, X, CheckCircle2, XCircle,
  AlertTriangle, Activity, ArrowDown, ArrowUp, CheckCheck,
  ExternalLink, Database
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { assignInstanceToUser, getInstanceForUserFromList, type EvolutionInstance as EvoInstance } from '@/hooks/useEvolutionInstances';
import { loadAllowedUsers } from '@/lib/accessControl';
import { supabase, supabaseSaas } from '@/integrations/supabase/client';
import { getSaasEmpresaId } from '@/lib/saas';

import { CONFIG } from '@/lib/config';

// ─── Evolution API config ─────────────────────────────────────────────────────
const EVOLUTION_API_URL = CONFIG.EVOLUTION_API_URL;
const EVOLUTION_API_TOKEN = CONFIG.EVOLUTION_API_TOKEN;

// ─── Evolution API helpers ────────────────────────────────────────────────────
interface EvolutionInstance {
  id: string;
  name: string;
  connectionStatus: string;
  ownerJid?: string;
  profileName?: string;
  profilePicUrl?: string;
  assignedUserEmail?: string;
  _count?: { Message: number; Contact: number; Chat: number };
}

async function evolutionFetch(path: string, options: RequestInit = {}) {
  if (!EVOLUTION_API_URL || !EVOLUTION_API_TOKEN) {
    throw new Error('Evolution API não configurada no .env');
  }
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

// ─── Status badge ─────────────────────────────────────────────────────────────
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

// Sync API instances to DB so that assignInstanceToUser can find them
async function syncInstancesToDbFromPage(apiInstances: EvolutionInstance[]) {
  const empresaId = await getSaasEmpresaId();
  const statusMap: Record<string, string> = { open: 'conectada', close: 'desconectada', connecting: 'conectando' };
  for (const inst of apiInstances) {
    await (supabase as any)
      .schema('saas')
      .from('instancias_whatsapp')
      .upsert(
        {
          empresa_id: empresaId,
          nome: inst.name,
          telefone: inst.ownerJid?.replace('@s.whatsapp.net', '') || null,
          status: statusMap[inst.connectionStatus] || 'desconectada',
          owner_jid: inst.ownerJid || null,
          ultimo_evento_em: new Date().toISOString(),
        },
        { onConflict: 'empresa_id,nome' },
      );
  }
}

// ─── Evolution Instances Panel ────────────────────────────────────────────────
function EvolutionPanel() {
  const { toast } = useToast();
  const { user: currentUser, hasRole } = useAuth();
  const isAdmin = hasRole(['admin', 'director', 'supervisor']);
  const [realUsers, setRealUsers] = useState<Array<{ id: string; name: string; email: string; avatar: string; status: 'active' }>>([]);

  const [instances, setInstances] = useState<EvolutionInstance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qrInstanceName, setQrInstanceName] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loadingQr, setLoadingQr] = useState(false);
  const [instanceUserMap, setInstanceUserMap] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    return map;
  });

  useEffect(() => {
    const run = async () => {
      try {
        const users = await loadAllowedUsers();
        const mapped = users.map((u) => ({
          id: `user_${u.email.toLowerCase()}`,
          name: u.name,
          email: u.email.toLowerCase(),
          avatar: u.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(u.email.toLowerCase())}`,
          status: 'active' as const,
        }));
        setRealUsers(mapped);
      } catch (e: any) {
        toast({ variant: 'destructive', title: 'Erro ao carregar usuários', description: e?.message || 'Tente novamente.' });
      }
    };
    run();
  }, [toast]);

  const fetchInstances = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Load from DB first for instant display
      try {
        const empresaId = await getSaasEmpresaId();
        const { data: dbData } = await (supabase as any)
          .schema('saas')
          .from('instancias_whatsapp')
          .select('id,nome,telefone,status,owner_jid,usuario_id')
          .eq('empresa_id', empresaId)
          .order('nome', { ascending: true });

        if (dbData && dbData.length > 0) {
          // Resolve usuario_id UUIDs to emails for user mapping
          const uuids = [...new Set(dbData.map((r: any) => r.usuario_id).filter(Boolean))];
          let uuidToEmail: Record<string, string> = {};
          if (uuids.length > 0) {
            const { data: usrs } = await (supabase as any)
              .schema('saas').from('usuarios').select('id, email')
              .eq('empresa_id', empresaId).in('id', uuids);
            for (const u of (usrs || [])) uuidToEmail[u.id] = u.email;
          }

          const statusMap: Record<string, string> = { conectada: 'open', desconectada: 'close', conectando: 'connecting' };
          const dbInstances: EvolutionInstance[] = dbData.map((r: any) => ({
            id: r.id,
            name: r.nome,
            connectionStatus: statusMap[r.status] || 'close',
            ownerJid: r.owner_jid || undefined,
            profileName: r.nome,
            assignedUserEmail: r.usuario_id ? uuidToEmail[r.usuario_id] : undefined,
          }));
          setInstances(dbInstances);

          // Build instanceUserMap from DB assignments
          const map: Record<string, string> = {};
          dbInstances.forEach(inst => {
            if (inst.assignedUserEmail) {
              const uid = `user_${inst.assignedUserEmail.toLowerCase()}`;
              map[inst.name] = uid;
            }
          });
          setInstanceUserMap(map);
        }
      } catch { /* DB read failed, will try API */ }

      // Then fetch live from Evolution API
      const data = await evolutionFetch('/instance/fetchInstances');
      const apiInstances: EvolutionInstance[] = Array.isArray(data) ? data : [];
      // Merge DB user assignments into live API data
      const prevMap = new Map(instances.map(i => [i.name, i.assignedUserEmail]));
      setInstances(apiInstances.map(inst => ({
        ...inst,
        assignedUserEmail: prevMap.get(inst.name) || undefined,
      })));
      // Sync live instances to DB in background (so future assignments find the row)
      syncInstancesToDbFromPage(apiInstances).catch(() => {});
    } catch (e: any) {
      // Only show error if we have no instances at all
      if (instances.length === 0) {
        setError(`Erro ao carregar instâncias: ${e.message}`);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchInstances(); }, [fetchInstances]);

  const handleGetQr = async (instanceName: string) => {
    setQrInstanceName(instanceName);
    setLoadingQr(true);
    setQrCode(null);
    try {
      const data = await evolutionFetch(`/instance/connect/${instanceName}`);
      const base64 = data?.base64 || data?.qrcode?.base64 || null;
      setQrCode(base64);
      if (!base64) toast({ title: 'Instância já conectada' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao obter QR Code', description: e.message });
    } finally {
      setLoadingQr(false);
    }
  };

  const handleAssignUser = (instanceName: string, userId: string) => {
    // Update local state immediately
    setInstanceUserMap(m => {
      const next = { ...m };
      Object.keys(next).forEach(k => { if (next[k] === instanceName) delete next[k]; });
      if (userId) next[instanceName] = userId;
      return next;
    });
    // Persist to DB in background
    assignInstanceToUser(instanceName, userId).catch((e) => {
      console.warn('[assign] Falha ao salvar atribuição no banco:', e);
    });
  };

  const myInstance = instances.find(i => {
    const email = currentUser?.email?.toLowerCase() || '';
    return i.assignedUserEmail?.toLowerCase() === email;
  });

  return (
    <div className="space-y-4">
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

      {!isAdmin && myInstance && (
        <div className={cn(
          'p-3 rounded-xl border flex items-center gap-3',
          myInstance.connectionStatus === 'open' ? 'bg-success/5 border-success/20' : 'bg-warning/5 border-warning/20'
        )}>
          <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-semibold">{myInstance.profileName || myInstance.name}</p>
            <p className="text-xs text-muted-foreground">{myInstance.ownerJid?.replace('@s.whatsapp.net', '') || '—'}</p>
          </div>
          <StatusBadge status={myInstance.connectionStatus} />
          {myInstance.connectionStatus !== 'open' && (
            <Button size="sm" className="text-xs h-7 bg-gradient-primary" onClick={() => handleGetQr(myInstance.name)}>
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

      {!loading && instances.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {instances.map(inst => {
            const isOpen = inst.connectionStatus === 'open';
            const phone = inst.ownerJid?.replace('@s.whatsapp.net', '');
            const assignedUserId = instanceUserMap[inst.name];
            const assignedUser = realUsers.find(u => u.id === assignedUserId);

            return (
              <div key={inst.id} className="glass-card p-4 flex flex-col gap-3 border-border hover:border-primary/20 transition-all">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    {inst.profilePicUrl ? (
                      <img src={inst.profilePicUrl} alt={inst.name} className="w-9 h-9 rounded-full border border-border object-cover" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center">
                        <Smartphone className="w-4 h-4 text-accent" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate">{inst.profileName || inst.name}</p>
                      <p className="text-[10px] text-muted-foreground font-mono truncate">{phone || inst.name}</p>
                    </div>
                  </div>
                  <StatusBadge status={inst.connectionStatus} />
                </div>

                {inst._count && (
                  <div className="flex gap-3 text-[10px] text-muted-foreground">
                    <span>💬 {inst._count.Message.toLocaleString('pt-BR')} msgs</span>
                    <span>👥 {inst._count.Contact.toLocaleString('pt-BR')} contatos</span>
                  </div>
                )}

                {assignedUser && (
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <img src={assignedUser.avatar} alt={assignedUser.name} className="w-4 h-4 rounded-full border border-border" />
                    {assignedUser.name}
                  </div>
                )}

                {isAdmin && (
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-1">Atribuir a usuário</label>
                    <select
                      value={assignedUserId || ''}
                      onChange={e => handleAssignUser(inst.name, e.target.value)}
                      className="w-full h-7 text-[10px] bg-secondary border border-border rounded-lg px-2 text-foreground"
                    >
                      <option value="">— Sem atribuição —</option>
                      {realUsers.filter(u => u.status === 'active').map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {!isOpen && (
                  <Button
                    size="sm"
                    className="text-[10px] h-6 bg-gradient-primary"
                    onClick={() => handleGetQr(inst.name)}
                    disabled={loadingQr && qrInstanceName === inst.name}
                  >
                    <QrCode className="w-3 h-3 mr-1" />
                    {loadingQr && qrInstanceName === inst.name ? 'Aguarde...' : 'Conectar / QR'}
                  </Button>
                )}
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
    </div>
  );
}

// ─── Webhook Logs (from saas.eventos_webhooks) ──────────────────────────────
interface WebhookLog {
  id: string;
  evento: string;
  status: 'sucesso' | 'erro' | 'pendente';
  payload: any;
  tentativas: number;
  ultimo_erro: string | null;
  processado_em: string | null;
  criado_em: string;
}

function WebhookLogs() {
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<WebhookLog | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'sucesso' | 'erro' | 'pendente'>('all');

  const loadLogs = useCallback(async () => {
    try {
      const empresaId = await getSaasEmpresaId();
      const { data, error } = await (supabase as any)
        .schema('saas')
        .from('eventos_webhooks')
        .select('id, evento, status, payload, tentativas, ultimo_erro, processado_em, criado_em')
        .eq('empresa_id', empresaId)
        .order('criado_em', { ascending: false })
        .limit(200);

      if (!error && data) setLogs(data);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  const filtered = logs.filter(l => statusFilter === 'all' || l.status === statusFilter);

  const todayStr = new Date().toISOString().split('T')[0];
  const todayLogs = logs.filter(l => l.criado_em?.startsWith(todayStr));

  const statusConfig = {
    sucesso: { icon: CheckCheck, class: 'text-success bg-success/10 border-success/20', label: 'Sucesso' },
    erro: { icon: AlertTriangle, class: 'text-destructive bg-destructive/10 border-destructive/20', label: 'Erro' },
    pendente: { icon: Loader2, class: 'text-warning bg-warning/10 border-warning/20', label: 'Pendente' },
  };

  const durationMs = (log: WebhookLog): number | null => {
    if (!log.processado_em || !log.criado_em) return null;
    return new Date(log.processado_em).getTime() - new Date(log.criado_em).getTime();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="grid grid-cols-4 gap-3 flex-1">
          {[
            { label: 'Total hoje', value: todayLogs.length, color: 'text-foreground' },
            { label: 'Sucesso', value: todayLogs.filter(l => l.status === 'sucesso').length, color: 'text-success' },
            { label: 'Erros', value: todayLogs.filter(l => l.status === 'erro').length, color: 'text-destructive' },
            { label: 'Pendentes', value: todayLogs.filter(l => l.status === 'pendente').length, color: 'text-warning' },
          ].map(s => (
            <div key={s.label} className="glass-card p-3 rounded-xl text-center">
              <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
        <button onClick={() => { setLoading(true); loadLogs(); }} className="ml-3 p-2 rounded-lg hover:bg-muted" title="Atualizar">
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
        </button>
      </div>

      <div className="flex items-center gap-1.5">
        {(['all', 'sucesso', 'erro', 'pendente'] as const).map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={cn('text-xs px-2.5 py-1.5 rounded-lg border transition-all',
              statusFilter === s ? 'bg-primary/15 border-primary/30 text-primary' : 'border-border text-muted-foreground hover:bg-muted')}>
            {{ all: 'Todos', sucesso: '✓ Sucesso', erro: '✕ Erro', pendente: '◷ Pendente' }[s]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          Nenhum log de webhook encontrado.
        </div>
      ) : (
        <div className="flex gap-4">
          <div className={cn('glass-card overflow-hidden flex-1', selected && 'lg:w-1/2')}>
            <table className="w-full data-table">
              <thead>
                <tr>
                  <th className="text-left">Evento</th>
                  <th className="text-center">Status</th>
                  <th className="text-center hidden lg:table-cell">Tentativas</th>
                  <th className="text-center hidden lg:table-cell">Duração</th>
                  <th className="text-center">Data/Hora</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(log => {
                  const sc = statusConfig[log.status] || statusConfig.pendente;
                  const ScIcon = sc.icon;
                  const dur = durationMs(log);
                  return (
                    <tr key={log.id} className={cn('cursor-pointer', selected?.id === log.id && 'bg-primary/5')}
                      onClick={() => setSelected(selected?.id === log.id ? null : log)}>
                      <td>
                        <p className="text-xs font-medium font-mono">{log.evento}</p>
                      </td>
                      <td className="text-center">
                        <span className={cn('inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border', sc.class)}>
                          <ScIcon className="w-2.5 h-2.5" />
                          {sc.label}
                        </span>
                      </td>
                      <td className="text-center hidden lg:table-cell">
                        <span className="text-xs text-muted-foreground">{log.tentativas}</span>
                      </td>
                      <td className="text-center hidden lg:table-cell">
                        <span className={cn('text-xs', dur && dur > 1000 ? 'text-warning' : 'text-muted-foreground')}>
                          {dur != null ? `${dur}ms` : '—'}
                        </span>
                      </td>
                      <td className="text-center">
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(log.criado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
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
                <h4 className="text-xs font-semibold">Detalhes do Evento</h4>
                <button onClick={() => setSelected(null)} className="w-5 h-5 flex items-center justify-center hover:bg-muted rounded">
                  <X className="w-3 h-3 text-muted-foreground" />
                </button>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Evento</span><span className="font-mono text-primary">{selected.evento}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span className="font-medium">{statusConfig[selected.status]?.label || selected.status}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Tentativas</span><span>{selected.tentativas}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Criado em</span><span>{new Date(selected.criado_em).toLocaleString('pt-BR')}</span></div>
                {selected.processado_em && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Processado em</span><span>{new Date(selected.processado_em).toLocaleString('pt-BR')}</span></div>
                )}
              </div>
              {selected.ultimo_erro && (
                <div>
                  <p className="text-[10px] text-destructive font-semibold uppercase tracking-wide mb-1.5">Último Erro</p>
                  <pre className="text-[10px] font-mono bg-destructive/5 border border-destructive/20 rounded-lg p-3 overflow-x-auto text-destructive whitespace-pre-wrap break-all">
                    {selected.ultimo_erro}
                  </pre>
                </div>
              )}
              <div>
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-1.5">Payload</p>
                <pre className="text-[10px] font-mono bg-secondary border border-border rounded-lg p-3 overflow-x-auto text-muted-foreground whitespace-pre-wrap break-all max-h-64 overflow-y-auto">
                  {JSON.stringify(selected.payload, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Database Integrations Panel ─────────────────────────────────────────────
interface DbIntegration {
  id: string;
  tipo: string;
  nome: string;
  status: string;
  configuracao: Record<string, unknown>;
  conectado_em: string | null;
}

interface DbToken {
  id: number;
  modulo_codigo: string;
  provedor: string;
  modelo: string | null;
  ativo: boolean;
}

function DatabasePanel() {
  const [integrations, setIntegrations] = useState<DbIntegration[]>([]);
  const [tokens, setTokens] = useState<DbToken[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const empresaId = await getSaasEmpresaId();

      const [intRes, tokRes] = await Promise.all([
        (supabaseSaas as any).schema('saas').from('integracoes')
          .select('id,tipo,nome,status,configuracao,conectado_em')
          .eq('empresa_id', empresaId)
          .order('tipo', { ascending: true }),
        (supabaseSaas as any).schema('saas').from('tokens_ia_modulo')
          .select('id,modulo_codigo,provedor,modelo,ativo')
          .eq('empresa_id', empresaId)
          .order('modulo_codigo', { ascending: true }),
      ]);

      if (intRes.error) throw intRes.error;
      if (tokRes.error) throw tokRes.error;

      setIntegrations((intRes.data || []) as unknown as DbIntegration[]);
      setTokens((tokRes.data || []) as unknown as DbToken[]);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao carregar dados do banco', description: e.message });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadData(); }, [loadData]);

  const statusLabel: Record<string, { label: string; class: string }> = {
    conectada: { label: 'Conectada', class: 'bg-success/10 text-success border-success/20' },
    desconectada: { label: 'Desconectada', class: 'bg-muted text-muted-foreground border-border' },
    erro: { label: 'Erro', class: 'bg-destructive/10 text-destructive border-destructive/20' },
  };

  const tipoIcon: Record<string, string> = {
    evolution_api: '📱',
    openai: '🤖',
    hubspot: '🔗',
    n8n: '⚡',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-xs">Carregando dados do banco...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Integrations */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold">Integrações cadastradas</h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">{integrations.length}</span>
          </div>
          <Button size="sm" variant="outline" className="text-xs h-7 border-border gap-1.5" onClick={loadData}>
            <RefreshCw className="w-3 h-3" /> Atualizar
          </Button>
        </div>

        {integrations.length === 0 ? (
          <div className="text-center py-6 glass-card">
            <p className="text-xs text-muted-foreground">Nenhuma integração cadastrada no banco</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {integrations.map(int => {
              const st = statusLabel[int.status] || statusLabel.desconectada;
              return (
                <div key={int.id} className="glass-card p-4 flex flex-col gap-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{tipoIcon[int.tipo] || '🔌'}</span>
                      <div>
                        <p className="text-xs font-semibold">{int.nome}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{int.tipo}</p>
                      </div>
                    </div>
                    <span className={cn('inline-flex items-center text-[10px] px-2 py-0.5 rounded-full border font-medium', st.class)}>
                      {st.label}
                    </span>
                  </div>
                  {int.configuracao && Object.keys(int.configuracao).length > 0 && (
                    <div className="bg-secondary/50 rounded-lg p-2 mt-1">
                      {Object.entries(int.configuracao).map(([key, val]) => (
                        <div key={key} className="flex justify-between text-[10px] py-0.5">
                          <span className="text-muted-foreground">{key}</span>
                          <span className="font-mono text-foreground truncate max-w-[180px]">
                            {String(val).startsWith('sk-') || key === 'token'
                              ? `${String(val).slice(0, 8)}...${String(val).slice(-4)}`
                              : String(val)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {int.conectado_em && (
                    <p className="text-[10px] text-muted-foreground">
                      Conectado em {new Date(int.conectado_em).toLocaleDateString('pt-BR')}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* AI Tokens */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">🤖</span>
          <h3 className="text-sm font-semibold">Tokens de IA por módulo</h3>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20 font-medium">{tokens.length}</span>
        </div>

        {tokens.length === 0 ? (
          <div className="text-center py-6 glass-card">
            <p className="text-xs text-muted-foreground">Nenhum token de IA cadastrado no banco</p>
          </div>
        ) : (
          <div className="glass-card overflow-hidden">
            <table className="w-full data-table">
              <thead>
                <tr>
                  <th className="text-left">Módulo</th>
                  <th className="text-left">Provedor</th>
                  <th className="text-left">Modelo</th>
                  <th className="text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {tokens.map(tok => (
                  <tr key={tok.id}>
                    <td><span className="text-xs font-semibold capitalize">{tok.modulo_codigo}</span></td>
                    <td><span className="text-xs text-muted-foreground">{tok.provedor}</span></td>
                    <td><span className="text-xs font-mono">{tok.modelo || '—'}</span></td>
                    <td className="text-center">
                      <span className={cn(
                        'inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-medium',
                        tok.ativo ? 'bg-success/10 text-success border-success/20' : 'bg-muted text-muted-foreground border-border'
                      )}>
                        {tok.ativo ? '● Ativo' : '○ Inativo'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function IntegrationsPage() {
  const [tab, setTab] = useState<'whatsapp' | 'database' | 'logs'>('whatsapp');

  return (
    <div className="page-container animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold">Integrações</h1>
          <p className="text-sm text-muted-foreground">Gerencie suas integrações WhatsApp, tokens e logs</p>
        </div>
      </div>

      <div className="flex gap-1 p-1 bg-secondary rounded-lg border border-border mb-6 w-fit">
        {[
          { key: 'whatsapp', label: 'WhatsApp',  icon: MessageSquare },
          { key: 'database', label: 'Banco / Tokens', icon: Database },
          { key: 'logs',     label: 'Logs',      icon: Activity },
        ].map(t => {
          const IconComp = t.icon;
          return (
            <button key={t.key} onClick={() => setTab(t.key as any)}
              className={cn('flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-medium transition-colors',
                tab === t.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
              <IconComp className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'whatsapp' && <EvolutionPanel />}
      {tab === 'database' && <DatabasePanel />}
      {tab === 'logs'     && <WebhookLogs />}
    </div>
  );
}
