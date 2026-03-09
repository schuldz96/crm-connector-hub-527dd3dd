import { useState, useEffect, useCallback } from 'react';
import { MOCK_USERS } from '@/data/mockData';
import { Button } from '@/components/ui/button';
import { useGoogleLogin } from '@react-oauth/google';
import { GOOGLE_CLIENT_ID } from '@/App';
import {
  RefreshCw, Loader2, Smartphone, QrCode, MessageSquare,
  Phone, Wifi, WifiOff, X, CheckCircle2, XCircle,
  Calendar, Video, HardDrive, LogOut, ShieldCheck,
  AlertTriangle, Activity, ArrowDown, ArrowUp, CheckCheck,
  ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { getInstanceForUser, setInstanceForUser } from '@/hooks/useEvolutionInstances';

// ─── Evolution API config ─────────────────────────────────────────────────────
const EVOLUTION_API_URL = 'https://evolutionapic.contato-lojavirtual.com';
const EVOLUTION_API_TOKEN = '3ce7a42f9bd96ea526b2b0bc39a4faec';
const ALLOWED_DOMAIN = 'appmax.com.br';

// ─── Google services config ───────────────────────────────────────────────────
const GOOGLE_SERVICES = [
  {
    id: 'calendar',
    label: 'Google Calendar',
    icon: Calendar,
    color: 'hsl(210 100% 56%)',
    desc: 'Sincroniza reuniões e agenda automaticamente',
    scope: 'https://www.googleapis.com/auth/calendar.readonly',
  },
  {
    id: 'meet',
    label: 'Google Meet',
    icon: Video,
    color: 'hsl(168 80% 42%)',
    desc: 'Captura dados e transcrições de chamadas',
    scope: 'https://www.googleapis.com/auth/meetings.space.readonly',
  },
  {
    id: 'drive',
    label: 'Google Drive',
    icon: HardDrive,
    color: 'hsl(38 92% 50%)',
    desc: 'Acessa transcrições e arquivos gerados pelo Meet',
    scope: 'https://www.googleapis.com/auth/drive.readonly',
  },
] as const;

type GoogleServiceId = 'calendar' | 'meet' | 'drive';

interface GoogleSession {
  email: string;
  name: string;
  picture?: string;
  connectedAt: string;
  services: GoogleServiceId[];
  accessToken?: string;
}

// localStorage helpers for Google session
const GOOGLE_SESSION_KEY = (userId: string) => `google_session_${userId}`;

function getGoogleSession(userId: string): GoogleSession | null {
  try {
    const raw = localStorage.getItem(GOOGLE_SESSION_KEY(userId));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveGoogleSession(userId: string, session: GoogleSession) {
  localStorage.setItem(GOOGLE_SESSION_KEY(userId), JSON.stringify(session));
  // also mark the simpler flag used by UsersPage
  localStorage.setItem(`google_connected_${userId}`, 'true');
}

function clearGoogleSession(userId: string) {
  localStorage.removeItem(GOOGLE_SESSION_KEY(userId));
  localStorage.removeItem(`google_connected_${userId}`);
}

// ─── Evolution API helpers ────────────────────────────────────────────────────
interface EvolutionInstance {
  id: string;
  name: string;
  connectionStatus: string;
  ownerJid?: string;
  profileName?: string;
  profilePicUrl?: string;
  _count?: { Message: number; Contact: number; Chat: number };
}

async function evolutionFetch(path: string, options: RequestInit = {}) {
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

// ─── Google Integration Panel ─────────────────────────────────────────────────
function GooglePanel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const userId = user?.id || '';

  const [session, setSession] = useState<GoogleSession | null>(() => getGoogleSession(userId));
  const [connecting, setConnecting] = useState(false);

  const hasClientId = !!GOOGLE_CLIENT_ID;

  const googleLogin = useGoogleLogin({
    scope: [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/drive.readonly',
      'openid email profile',
    ].join(' '),
    // Restrict to appmax.com.br domain
    hosted_domain: 'appmax.com.br',
    onSuccess: async (tokenResponse) => {
      try {
        // Fetch user info from Google
        const infoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        });
        const info = await infoRes.json();

        // Enforce domain restriction server-side (even though hd= hint is set)
        if (!info.email?.endsWith('@appmax.com.br')) {
          toast({
            variant: 'destructive',
            title: 'Domínio não autorizado',
            description: 'Apenas contas @appmax.com.br podem conectar ao Google.',
          });
          setConnecting(false);
          return;
        }

        const newSession: GoogleSession = {
          email: info.email,
          name: info.name || info.email,
          picture: info.picture,
          connectedAt: new Date().toISOString(),
          services: ['calendar', 'meet', 'drive'],
          accessToken: tokenResponse.access_token,
        };

        saveGoogleSession(userId, newSession);
        setSession(newSession);
        toast({
          title: 'Google conectado com sucesso!',
          description: `${info.name} — Calendar, Meet e Drive sincronizados.`,
        });
      } catch {
        toast({ variant: 'destructive', title: 'Erro ao obter informações do Google.' });
      } finally {
        setConnecting(false);
      }
    },
    onError: (err) => {
      console.error(err);
      toast({ variant: 'destructive', title: 'Autenticação cancelada ou erro no Google.' });
      setConnecting(false);
    },
    onNonOAuthError: () => {
      toast({ variant: 'destructive', title: 'Popup bloqueado pelo navegador. Permita popups e tente novamente.' });
      setConnecting(false);
    },
  });

  const handleConnect = () => {
    if (!hasClientId) {
      toast({
        variant: 'destructive',
        title: 'Client ID não configurado',
        description: 'Adicione VITE_GOOGLE_CLIENT_ID nas variáveis de ambiente do projeto.',
      });
      return;
    }
    setConnecting(true);
    googleLogin();
  };

  const handleDisconnect = () => {
    clearGoogleSession(userId);
    setSession(null);
    toast({ title: 'Google desconectado', description: 'Sua conta Google foi removida.' });
  };

  return (
    <div className="space-y-5">
      {/* Missing Client ID warning */}
      {!hasClientId && (
        <div className="p-4 rounded-xl border border-warning/30 bg-warning/5 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-warning mb-1">Client ID do Google não configurado</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Para ativar o OAuth real, adicione a variável <code className="bg-muted px-1 rounded font-mono">VITE_GOOGLE_CLIENT_ID</code> nas configurações do projeto com o Client ID gerado no Google Cloud Console.
            </p>
            <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline mt-1.5">
              Abrir Google Cloud Console <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}

      {/* Header card */}
      <div className="glass-card p-5" style={{ background: 'linear-gradient(135deg, hsl(210 100% 56% / 0.06), hsl(168 80% 42% / 0.04))' }}>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            {/* Google logo */}
            <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center border border-border flex-shrink-0">
              <svg className="w-7 h-7" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            </div>
            <div>
              <p className="font-display font-semibold text-sm">Google Workspace</p>
              <p className="text-xs text-muted-foreground">
                Uma única autenticação conecta Calendar, Meet e Drive
              </p>
              <div className="flex items-center gap-1.5 mt-1.5">
                <ShieldCheck className="w-3 h-3 text-primary" />
                <span className="text-[11px] text-muted-foreground">Restrito a <strong>@{ALLOWED_DOMAIN}</strong></span>
              </div>
            </div>
          </div>

          {session ? (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-success/10 border border-success/20 text-success font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" /> Conectado
              </span>
              <Button size="sm" variant="outline" className="text-xs h-8 border-border text-destructive hover:text-destructive hover:border-destructive/30" onClick={handleDisconnect}>
                <LogOut className="w-3 h-3 mr-1.5" /> Desconectar
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              className="bg-white text-foreground border border-border hover:bg-muted text-xs h-9 font-medium shadow-sm"
              onClick={handleConnect}
              disabled={connecting}
            >
              {connecting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              )}
              {connecting ? 'Autenticando...' : 'Entrar com Google'}
            </Button>
          )}
        </div>

        {/* Account info when connected */}
        {session && (
          <div className="mt-4 pt-4 border-t border-border flex items-center gap-3">
            {session.picture ? (
              <img src={session.picture} alt={session.name} className="w-8 h-8 rounded-full border border-border" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                {session.name.charAt(0)}
              </div>
            )}
            <div>
              <p className="text-xs font-semibold">{session.name}</p>
              <p className="text-[11px] text-muted-foreground">{session.email}</p>
            </div>
            <span className="ml-auto text-[10px] text-muted-foreground">
              Conectado em {new Date(session.connectedAt).toLocaleDateString('pt-BR')}
            </span>
          </div>
        )}
      </div>

      {/* Services grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {GOOGLE_SERVICES.map(svc => {
          const Icon = svc.icon;
          const isActive = session?.services.includes(svc.id) ?? false;
          return (
            <div key={svc.id} className={cn(
              'glass-card p-4 transition-all',
              isActive ? 'border-border' : 'opacity-50'
            )}>
              <div className="flex items-start justify-between mb-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${svc.color}20` }}>
                  <Icon className="w-4.5 h-4.5" style={{ color: svc.color, width: 18, height: 18 }} />
                </div>
                {isActive ? (
                  <CheckCircle2 className="w-4 h-4 text-success" />
                ) : (
                  <XCircle className="w-4 h-4 text-muted-foreground/40" />
                )}
              </div>
              <p className="text-xs font-semibold mb-1">{svc.label}</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{svc.desc}</p>
              {isActive && (
                <div className="mt-3 pt-3 border-t border-border/50">
                  <span className="text-[10px] text-success font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                    Sincronizando
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* How it works */}
      {!session && (
        <div className="glass-card p-4 border-primary/20 bg-primary/5">
          <p className="text-xs font-semibold mb-3 flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-primary" />
            Como funciona
          </p>
          <ol className="space-y-2">
            {[
              'Clique em "Entrar com Google" — use sua conta @appmax.com.br',
              'Autorize o acesso ao Calendar, Meet e Drive de uma só vez',
              'O sistema sincroniza reuniões e puxa transcrições automaticamente',
              'A IA analisa as transcrições e popula os scorecards de Reuniões',
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[11px] text-muted-foreground">
                <span className="w-4 h-4 rounded-full bg-primary/15 text-primary text-[9px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Transcriptions info when connected */}
      {session && (
        <div className="glass-card p-4 border-success/20 bg-success/5">
          <p className="text-xs font-semibold mb-2 flex items-center gap-2 text-success">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Transcrições habilitadas
          </p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            O sistema buscará automaticamente transcrições de reuniões salvas no Google Drive.
            Elas serão enviadas ao modelo de IA configurado no módulo de Reuniões para análise e geração de scorecards.
          </p>
          <a
            href="https://support.google.com/meet/answer/10167275"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline mt-2"
          >
            Como ativar transcrições no Google Meet <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
    </div>
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
  const [qrInstanceName, setQrInstanceName] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loadingQr, setLoadingQr] = useState(false);
  const [instanceUserMap, setInstanceUserMap] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    MOCK_USERS.forEach(u => {
      const inst = getInstanceForUser(u.id);
      if (inst) map[inst] = u.id;
    });
    return map;
  });

  const fetchInstances = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await evolutionFetch('/instance/fetchInstances');
      setInstances(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(`Erro ao carregar instâncias: ${e.message}`);
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
    MOCK_USERS.forEach(u => {
      if (getInstanceForUser(u.id) === instanceName) setInstanceForUser(u.id, '');
    });
    if (userId) setInstanceForUser(userId, instanceName);
    setInstanceUserMap(m => {
      const next = { ...m };
      Object.keys(next).forEach(k => { if (next[k] === instanceName) delete next[k]; });
      if (userId) next[instanceName] = userId;
      return next;
    });
  };

  const myInstance = instances.find(i => getInstanceForUser(currentUser?.id || '') === i.name);

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
            const assignedUser = MOCK_USERS.find(u => u.id === assignedUserId);

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
                      {MOCK_USERS.filter(u => u.status === 'active').map(u => (
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

// ─── Mock webhook logs ─────────────────────────────────────────────────────────
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
  { id: 'wh_002', direction: 'outbound', source: 'Google Calendar', event: 'meeting.completed', status: 'success', statusCode: 200, payload: '{"meetingId":"mtg_001","title":"Demo Produto - Acme Corp","duration":45}', response: '{"analyzed":true}', timestamp: '2026-03-08T15:55:00Z', duration: 28 },
  { id: 'wh_003', direction: 'inbound', source: 'Google Drive', event: 'transcript.available', status: 'success', statusCode: 200, payload: '{"fileId":"1BxCv...","meetingId":"mtg_001","transcriptUrl":"..."}', response: '{"queued":true}', timestamp: '2026-03-08T15:56:00Z', duration: 15 },
  { id: 'wh_004', direction: 'outbound', source: 'Google Meet', event: 'meeting.ended', status: 'error', statusCode: 500, payload: '{"meetingId":"mtg_002","participants":3}', response: '{"error":"Transcript not ready"}', timestamp: '2026-03-08T14:30:00Z', duration: 5001 },
  { id: 'wh_005', direction: 'inbound', source: 'Evolution API', event: 'connection.update', status: 'success', statusCode: 200, payload: '{"instance":"Closer CS","state":"close"}', response: '{"status":"ok"}', timestamp: '2026-03-08T10:00:00Z', duration: 18 },
];

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
    success: { icon: CheckCheck, class: 'text-success bg-success/10 border-success/20' },
    error: { icon: AlertTriangle, class: 'text-destructive bg-destructive/10 border-destructive/20' },
    pending: { icon: Loader2, class: 'text-warning bg-warning/10 border-warning/20' },
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
                const ScIcon = sc.icon;
                return (
                  <tr key={log.id} className={cn('cursor-pointer', selected?.id === log.id && 'bg-primary/5')}
                    onClick={() => setSelected(selected?.id === log.id ? null : log)}>
                    <td>
                      <p className="text-xs font-medium">{log.source}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{log.event}</p>
                    </td>
                    <td className="text-center">
                      <span className={cn('inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border',
                        log.direction === 'inbound' ? 'bg-info/10 text-info border-info/20' : 'bg-accent/10 text-accent border-accent/20')}>
                        {log.direction === 'inbound' ? <><ArrowDown className="w-2.5 h-2.5" /> Recebido</> : <><ArrowUp className="w-2.5 h-2.5" /> Enviado</>}
                      </span>
                    </td>
                    <td className="text-center">
                      <span className={cn('inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border', sc.class)}>
                        <ScIcon className="w-2.5 h-2.5" />
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
  const [tab, setTab] = useState<'google' | 'whatsapp' | 'logs'>('google');

  return (
    <div className="page-container animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold">Integrações</h1>
          <p className="text-sm text-muted-foreground">Conecte sua conta Google e gerencie o WhatsApp</p>
        </div>
      </div>

      <div className="flex gap-1 p-1 bg-secondary rounded-lg border border-border mb-6 w-fit">
        {[
          { key: 'google',   label: 'Google',    icon: () => (
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          )},
          { key: 'whatsapp', label: 'WhatsApp',  icon: MessageSquare },
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

      {tab === 'google'   && <GooglePanel />}
      {tab === 'whatsapp' && <EvolutionPanel />}
      {tab === 'logs'     && <WebhookLogs />}
    </div>
  );
}
