import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Video, Search, Brain, Clock, Calendar,
  User, Building2, ExternalLink, Sparkles, X,
  TrendingUp, TrendingDown, Lightbulb, AlertTriangle,
  CheckCircle2, Target, MessageSquare, RefreshCw, Loader2, Users
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { loadMeetingsFromDb, syncGoogleMeetTranscripts, type DbMeeting, type SyncResult } from '@/lib/googleSyncService';

const STATUS_CONFIG: Record<string, { label: string; class: string }> = {
  concluida: { label: 'Concluída', class: 'score-good' },
  agendada: { label: 'Agendada', class: 'score-excellent' },
  cancelada: { label: 'Cancelada', class: 'score-poor' },
  no_show: { label: 'No-show', class: 'score-average' },
};

const SCORE_CRITERIA = [
  { key: 'rapport', label: 'Rapport', icon: '🤝', tip: 'Conexão emocional e abertura do cliente' },
  { key: 'discovery', label: 'Descoberta', icon: '🔍', tip: 'Qualidade das perguntas de qualificação' },
  { key: 'presentation', label: 'Apresentação', icon: '💡', tip: 'Clareza e impacto da proposta de valor' },
  { key: 'objections', label: 'Objeções', icon: '🛡️', tip: 'Tratamento de resistências do cliente' },
  { key: 'nextSteps', label: 'Próximos Passos', icon: '📅', tip: 'Clareza e comprometimento do fechamento' },
];

function ScoreBar({ value, label, icon, tip }: { value: number; label: string; icon: string; tip: string }) {
  const color = value >= 85
    ? 'hsl(168 80% 42%)'
    : value >= 70
    ? 'hsl(210 100% 56%)'
    : value >= 60
    ? 'hsl(38 92% 50%)'
    : 'hsl(0 72% 51%)';

  const delta = value - 75;
  return (
    <div className="group">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs">{icon}</span>
        <span className="text-xs text-muted-foreground flex-1">{label}</span>
        <span className="text-[10px] text-muted-foreground/60 hidden group-hover:block transition-all">{tip}</span>
        <div className="flex items-center gap-1">
          {delta > 0
            ? <TrendingUp className="w-3 h-3 text-success" />
            : <TrendingDown className="w-3 h-3 text-destructive" />}
          <span className="text-xs font-bold" style={{ color }}>{value}</span>
        </div>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${value}%`, background: color }}
        />
      </div>
    </div>
  );
}

function getGoogleAccessToken(userId: string): string | null {
  try {
    const raw = localStorage.getItem(`google_session_${userId}`);
    if (!raw) return null;
    const session = JSON.parse(raw);
    return session?.accessToken ?? null;
  } catch {
    return null;
  }
}

export default function MeetingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const userId = user?.id || '';

  const [meetings, setMeetings] = useState<DbMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState('');
  const [syncResult, setSyncResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedMeeting, setSelectedMeeting] = useState<DbMeeting | null>(null);
  const [detailTab, setDetailTab] = useState<'info' | 'transcript' | 'participants'>('info');

  const loadMeetings = useCallback(async () => {
    try {
      const data = await loadMeetingsFromDb();
      setMeetings(data);
    } catch (err) {
      console.error('Failed to load meetings:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadMeetings(); }, [loadMeetings]);

  const handleSync = async () => {
    const accessToken = getGoogleAccessToken(userId);
    if (!accessToken) {
      toast({
        variant: 'destructive',
        title: 'Google não conectado',
        description: 'Conecte sua conta Google em Integrações antes de sincronizar.',
      });
      return;
    }

    if (!user?.email) return;

    setSyncing(true);
    setSyncProgress('Iniciando sincronização...');
    setSyncResult(null);

    try {
      const result: SyncResult = await syncGoogleMeetTranscripts(
        accessToken,
        user.email,
        30,
        (msg) => setSyncProgress(msg),
      );

      if (result.errors.length > 0) {
        setSyncResult({
          type: 'error',
          message: `Concluída com ${result.errors.length} erro(s). ${result.synced} importada(s), ${result.skipped} já existente(s). Erro: ${result.errors[0]}`,
        });
      } else {
        setSyncResult({
          type: 'success',
          message: `Sincronização concluída — ${result.synced} nova(s) reunião(ões) importada(s), ${result.skipped} já existente(s), ${result.total} encontrada(s) no total.`,
        });
      }

      await loadMeetings();
    } catch (err: any) {
      setSyncResult({
        type: 'error',
        message: `Erro na sincronização: ${err.message || 'Erro desconhecido'}`,
      });
    } finally {
      setSyncing(false);
      setSyncProgress('');
    }
  };

  const filtered = meetings.filter(m => {
    const s = search.toLowerCase();
    const matchSearch =
      m.titulo.toLowerCase().includes(s) ||
      (m.cliente_nome || '').toLowerCase().includes(s) ||
      (m.vendedor_nome || '').toLowerCase().includes(s);
    const matchStatus = statusFilter === 'all' || m.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="page-container animate-fade-in">
      <div className="flex gap-6">
        {/* Main list */}
        <div className={cn('flex-1 min-w-0', selectedMeeting && 'lg:w-1/2')}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-display font-bold">Reuniões</h1>
              <p className="text-sm text-muted-foreground">
                {loading ? 'Carregando...' : `${filtered.length} reuniões encontradas`}
              </p>
            </div>
            <Button
              size="sm"
              onClick={handleSync}
              disabled={syncing}
              className="text-xs h-8 bg-gradient-primary"
            >
              {syncing ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
              {syncing ? 'Sincronizando...' : 'Sincronizar Google Meet'}
            </Button>
          </div>

          {syncing && syncProgress && (
            <div className="mb-4 p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs text-primary flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
              {syncProgress}
            </div>
          )}

          {!syncing && syncResult && (
            <div className={cn(
              'mb-4 p-3 rounded-lg text-xs flex items-center justify-between gap-2',
              syncResult.type === 'success'
                ? 'bg-success/10 border border-success/20 text-success'
                : 'bg-destructive/10 border border-destructive/20 text-destructive'
            )}>
              <div className="flex items-center gap-2">
                {syncResult.type === 'success'
                  ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                  : <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />}
                {syncResult.message}
              </div>
              <button onClick={() => setSyncResult(null)} className="flex-shrink-0 hover:opacity-70">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar por título, cliente, vendedor..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-8 text-xs bg-secondary border-border"
              />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {['all', 'concluida', 'agendada', 'no_show'].map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    'text-xs px-3 py-1.5 rounded-lg border transition-all',
                    statusFilter === s
                      ? 'bg-primary/15 border-primary/30 text-primary font-medium'
                      : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  {{ all: 'Todas', concluida: 'Concluídas', agendada: 'Agendadas', no_show: 'No-show' }[s]}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="glass-card p-10 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Carregando reuniões...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="glass-card p-10 text-center">
              <Video className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-1">Nenhuma reunião encontrada.</p>
              <p className="text-xs text-muted-foreground">
                Clique em "Sincronizar Google Meet" para importar reuniões com participantes externos.
              </p>
            </div>
          ) : (
            <div className="glass-card overflow-hidden">
              <table className="w-full data-table">
                <thead>
                  <tr>
                    <th className="text-left">Reunião</th>
                    <th className="text-left hidden md:table-cell">Vendedor</th>
                    <th className="text-left hidden lg:table-cell">Data</th>
                    <th className="text-center">Score</th>
                    <th className="text-center">Status</th>
                    <th className="text-center hidden lg:table-cell">Transcrição</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(m => {
                    const statusCfg = STATUS_CONFIG[m.status] || { label: m.status, class: '' };
                    return (
                      <tr
                        key={m.id}
                        className={cn('cursor-pointer', selectedMeeting?.id === m.id && 'bg-primary/5')}
                        onClick={() => setSelectedMeeting(selectedMeeting?.id === m.id ? null : m)}
                      >
                        <td>
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <Video className="w-4 h-4 text-primary" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">{m.titulo}</p>
                              <p className="text-xs text-muted-foreground">{m.cliente_nome || '—'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="hidden md:table-cell">
                          <div className="flex items-center gap-2">
                            <img
                              src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${m.vendedor_nome || 'user'}`}
                              alt={m.vendedor_nome || ''}
                              className="w-6 h-6 rounded-full border border-border"
                            />
                            <span className="text-sm">{m.vendedor_nome || '—'}</span>
                          </div>
                        </td>
                        <td className="hidden lg:table-cell">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            {new Date(m.data_reuniao).toLocaleDateString('pt-BR')}
                            <span className="ml-1 flex items-center gap-1">
                              <Clock className="w-3 h-3" />{m.duracao_minutos}min
                            </span>
                          </div>
                        </td>
                        <td className="text-center">
                          {m.score ? (
                            <span className={m.score >= 85 ? 'score-excellent' : m.score >= 70 ? 'score-good' : 'score-average'}>
                              {m.score}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="text-center">
                          <span className={statusCfg.class}>{statusCfg.label}</span>
                        </td>
                        <td className="text-center hidden lg:table-cell">
                          {m.transcricao ? (
                            <MessageSquare className="w-4 h-4 text-accent mx-auto" />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selectedMeeting && (
          <div className="w-full lg:w-[400px] xl:w-[440px] flex-shrink-0 animate-slide-in">
            <div className="glass-card sticky top-6 overflow-hidden">
              {/* Panel header */}
              <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border">
                <div className="flex-1 min-w-0">
                  <h3 className="font-display font-semibold text-sm truncate">{selectedMeeting.titulo}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={(STATUS_CONFIG[selectedMeeting.status] || {}).class || ''}>
                      {(STATUS_CONFIG[selectedMeeting.status] || {}).label || selectedMeeting.status}
                    </span>
                    {selectedMeeting.analisada_por_ia && (
                      <span className="flex items-center gap-1 text-xs text-accent font-medium">
                        <Brain className="w-3 h-3" /> IA
                      </span>
                    )}
                    {selectedMeeting.score && (
                      <span className={cn(
                        'text-xs font-bold px-2 py-0.5 rounded-full',
                        selectedMeeting.score >= 85 ? 'bg-success/10 text-success' : selectedMeeting.score >= 70 ? 'bg-primary/10 text-primary' : 'bg-warning/10 text-warning'
                      )}>
                        {selectedMeeting.score} pts
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={() => setSelectedMeeting(null)} className="w-6 h-6 rounded-md hover:bg-muted flex items-center justify-center ml-2">
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>

              {/* Meta info */}
              <div className="px-5 py-3 border-b border-border/50">
                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <User className="w-3 h-3" />
                    <span className="font-medium text-foreground">{selectedMeeting.vendedor_nome || '—'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Building2 className="w-3 h-3" />
                    <span className="font-medium text-foreground">{selectedMeeting.cliente_nome || '—'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    {new Date(selectedMeeting.data_reuniao).toLocaleDateString('pt-BR')}
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {selectedMeeting.duracao_minutos} min
                  </div>
                </div>
                {selectedMeeting.link_meet && (
                  <a
                    href={selectedMeeting.link_meet}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-primary hover:underline mt-2"
                  >
                    <ExternalLink className="w-3 h-3" /> Abrir no Google Meet
                  </a>
                )}
              </div>

              {/* Tabs */}
              <div className="flex border-b border-border">
                {[
                  { key: 'info', label: 'Detalhes', icon: Target },
                  { key: 'transcript', label: 'Transcrição', icon: MessageSquare },
                  { key: 'participants', label: 'Participantes', icon: Users },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setDetailTab(tab.key as any)}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors border-b-2',
                      detailTab === tab.key
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <tab.icon className="w-3 h-3" />
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="p-5 overflow-y-auto max-h-[calc(100vh-340px)] space-y-4">
                {/* ─ Info tab ─ */}
                {detailTab === 'info' && (
                  <div className="space-y-3">
                    {selectedMeeting.cliente_email && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">Email cliente:</span>
                        <span className="font-medium">{selectedMeeting.cliente_email}</span>
                      </div>
                    )}
                    {selectedMeeting.vendedor_email && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">Vendedor:</span>
                        <span className="font-medium">{selectedMeeting.vendedor_email}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">Participantes externos:</span>
                      <span className="font-medium">
                        {selectedMeeting.participantes.filter(p => !p.email.endsWith('@appmax.com.br')).length}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">Transcrição:</span>
                      <span className={cn('font-medium', selectedMeeting.transcricao ? 'text-success' : 'text-muted-foreground')}>
                        {selectedMeeting.transcricao ? 'Disponível' : 'Não disponível'}
                      </span>
                    </div>

                    {!selectedMeeting.analisada_por_ia && selectedMeeting.status === 'concluida' && (
                      <div className="pt-3 border-t border-border flex flex-col items-center gap-3 text-muted-foreground">
                        <Brain className="w-10 h-10 opacity-20" />
                        <p className="text-xs text-center">Esta reunião ainda não foi avaliada pela IA.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* ─ Transcript tab ─ */}
                {detailTab === 'transcript' && (
                  <div className="space-y-3">
                    {selectedMeeting.transcricao ? (
                      <div className="p-3 rounded-lg bg-muted/50 border border-border">
                        <pre className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed max-h-[60vh] overflow-y-auto">
                          {selectedMeeting.transcricao}
                        </pre>
                      </div>
                    ) : (
                      <div className="p-3 rounded-lg bg-muted/50 border border-border text-center">
                        <MessageSquare className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground">
                          Transcrição não disponível para esta reunião.
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Verifique se a transcrição automática está habilitada no Google Workspace e sincronize novamente.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* ─ Participants tab ─ */}
                {detailTab === 'participants' && (
                  <div className="space-y-2">
                    {selectedMeeting.participantes.length > 0 ? (
                      selectedMeeting.participantes.map((p, i) => {
                        const isExternal = !p.email.endsWith('@appmax.com.br');
                        return (
                          <div
                            key={i}
                            className={cn(
                              'flex items-center gap-2.5 p-2.5 rounded-lg border',
                              isExternal ? 'bg-accent/5 border-accent/15' : 'bg-secondary border-border'
                            )}
                          >
                            <div className="w-7 h-7 rounded-full bg-secondary border border-border flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                              {(p.name || p.email)[0].toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">{p.name || p.email.split('@')[0]}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{p.email}</p>
                            </div>
                            {isExternal && (
                              <span className="text-[10px] font-medium text-accent bg-accent/10 px-1.5 py-0.5 rounded">Externo</span>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-3 rounded-lg bg-muted/50 border border-border text-center">
                        <Users className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground">Nenhum participante registrado.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
