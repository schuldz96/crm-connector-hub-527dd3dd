import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Video, Search, Brain, Clock, Calendar,
  User, Building2, ExternalLink, Sparkles, X,
  TrendingUp, TrendingDown, Lightbulb, AlertTriangle,
  CheckCircle2, Target, MessageSquare, RefreshCw, Loader2, Users, Key
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useAppConfig } from '@/contexts/AppConfigContext';
import { useToast } from '@/hooks/use-toast';
import {
  loadMeetingsFromDb, syncMeetConferences, triggerTranscriptionFetch, pullTranscriptions,
  type DbMeeting
} from '@/lib/meetingsService';
import { evaluateMeeting, loadEvaluationByEntity, type StoredEvaluation } from '@/lib/evaluationService';

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

export default function MeetingsPage() {
  const { user } = useAuth();
  const { tokens } = useAppConfig();
  const { toast } = useToast();

  const [meetings, setMeetings] = useState<DbMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [evalProgress, setEvalProgress] = useState({ current: 0, total: 0 });
  const [evalCancelled, setEvalCancelled] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedMeeting, setSelectedMeeting] = useState<DbMeeting | null>(null);
  const [detailTab, setDetailTab] = useState<'info' | 'transcript' | 'participants'>('info');
  const [meetingEval, setMeetingEval] = useState<(StoredEvaluation & { payload?: any }) | null>(null);
  const [reEvaluating, setReEvaluating] = useState(false);

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

  // Load evaluation when meeting is selected
  useEffect(() => {
    if (selectedMeeting?.analisada_por_ia) {
      loadEvaluationByEntity(selectedMeeting.id).then(setMeetingEval).catch(() => setMeetingEval(null));
    } else {
      setMeetingEval(null);
    }
  }, [selectedMeeting?.id, selectedMeeting?.analisada_por_ia]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      // Step 1: Sync meet_conferences → saas.reunioes
      toast({ title: 'Sincronizando reuniões...', description: 'Importando dados do Google Meet.' });
      const syncResult = await syncMeetConferences();

      // Step 2: Trigger transcription fetcher API (since Feb 26)
      toast({ title: 'Buscando transcrições...', description: 'Solicitando arquivos de transcrição.' });
      try {
        await triggerTranscriptionFetch('2026-02-26T00:00:00Z');
      } catch (err) {
        console.warn('[meetings] Transcription API may be offline:', err);
      }

      // Step 3: Pull transcription text from Google Drive into DB
      const transcriptCount = await pullTranscriptions();

      // Reload meetings
      await loadMeetings();

      toast({
        title: 'Sincronização concluída',
        description: `${syncResult.inserted} novas reuniões, ${syncResult.updated} atualizadas, ${transcriptCount} transcrições importadas.`,
      });
    } catch (err: any) {
      console.error('[meetings] Sync error:', err);
      toast({ variant: 'destructive', title: 'Erro na sincronização', description: err.message });
    } finally {
      setSyncing(false);
    }
  };

  const cancelEvalRef = { current: false };
  const handleEvaluateAll = async () => {
    const token = tokens.meetings;
    if (!token?.startsWith('sk-')) {
      toast({ variant: 'destructive', title: 'Token não configurado', description: 'Configure o token de Reuniões em Admin → Tokens OpenAI.' });
      return;
    }
    const pending = meetings.filter(m => !m.analisada_por_ia && m.transcricao && m.status === 'concluida');
    if (pending.length === 0) {
      toast({ title: 'Nada para avaliar', description: 'Todas as reuniões com transcrição já foram avaliadas.' });
      return;
    }
    setEvaluating(true);
    setEvalCancelled(false);
    cancelEvalRef.current = false;
    setEvalProgress({ current: 0, total: pending.length });
    let ok = 0, fail = 0;
    for (const m of pending) {
      if (cancelEvalRef.current) break;
      setEvalProgress({ current: ok + fail + 1, total: pending.length });
      try {
        await evaluateMeeting(token, 'gpt-4o-mini', m.id, m.titulo, m.transcricao!, m.vendedor_id || null);
        ok++;
      } catch (err) {
        console.warn(`[eval] Failed ${m.id}:`, err);
        fail++;
      }
    }
    await loadMeetings();
    setEvaluating(false);
    setEvalProgress({ current: 0, total: 0 });
    if (cancelEvalRef.current) {
      toast({ title: 'Avaliação cancelada', description: `${ok} avaliadas antes do cancelamento.` });
    } else {
      toast({ title: 'Avaliação concluída', description: `${ok} avaliadas, ${fail} falharam de ${pending.length} pendentes.` });
    }
  };

  const handleCancelEval = () => {
    cancelEvalRef.current = true;
    setEvalCancelled(true);
  };

  const handleReEvaluate = async (meeting: DbMeeting) => {
    const token = tokens.meetings;
    if (!token?.startsWith('sk-') || !meeting.transcricao) return;
    setReEvaluating(true);
    try {
      const result = await evaluateMeeting(token, 'gpt-4o-mini', meeting.id, meeting.titulo, meeting.transcricao, meeting.vendedor_id || null);
      const score = result ? Math.round(result.totalScore) : null;
      await loadMeetings();
      const evalData = await loadEvaluationByEntity(meeting.id);
      setMeetingEval(evalData);
      setSelectedMeeting(prev => prev ? { ...prev, analisada_por_ia: true, score: score ?? prev.score } : null);
      toast({ title: 'Avaliação concluída', description: `Score: ${score ?? '—'}/100` });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro na avaliação', description: err.message });
    } finally {
      setReEvaluating(false);
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
            <div className="flex items-center gap-2">
              <span className={cn(
                'flex items-center gap-1.5 text-xs border rounded-lg px-3 py-1.5',
                tokens.meetings?.startsWith('sk-')
                  ? 'border-success/30 text-success bg-success/5'
                  : 'border-warning/30 text-warning bg-warning/5'
              )}>
                <Key className="w-3 h-3" />
                {tokens.meetings?.startsWith('sk-') ? 'Token Reuniões ✓' : 'Sem token — Admin → Tokens OpenAI'}
              </span>
              {evaluating ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                  <div className="flex flex-col">
                    <span className="text-[10px] font-medium text-primary">
                      Avaliando {evalProgress.current}/{evalProgress.total}
                    </span>
                    <div className="w-20 h-1 bg-muted rounded-full overflow-hidden mt-0.5">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${evalProgress.total ? (evalProgress.current / evalProgress.total) * 100 : 0}%` }} />
                    </div>
                  </div>
                  <button onClick={handleCancelEval} className="w-5 h-5 rounded hover:bg-destructive/10 flex items-center justify-center" title="Cancelar">
                    <X className="w-3 h-3 text-destructive" />
                  </button>
                </div>
              ) : (
                <Button
                  size="sm"
                  onClick={handleEvaluateAll}
                  disabled={syncing || loading}
                  className="text-xs h-8"
                  variant="outline"
                >
                  <Brain className="w-3.5 h-3.5 mr-1.5" /> Avaliar IA
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleSync}
                disabled={syncing || loading}
                className="text-xs h-8 bg-gradient-primary"
              >
                {syncing ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
                {syncing ? 'Sincronizando...' : 'Sincronizar'}
              </Button>
            </div>
          </div>

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
                Clique em "Sincronizar" para importar reuniões do Google Meet.
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

                    {/* AI Evaluation results */}
                    {selectedMeeting.analisada_por_ia && meetingEval && (
                      <div className="pt-3 border-t border-border space-y-3">
                        {/* Summary */}
                        {meetingEval.resumo && (
                          <div className="p-3 rounded-lg bg-muted/50 border border-border">
                            <p className="text-[10px] font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Resumo</p>
                            <p className="text-xs leading-relaxed">{meetingEval.resumo}</p>
                          </div>
                        )}

                        {/* Insights */}
                        {meetingEval.payload?.insights && (
                          <div className="p-3 rounded-lg bg-accent/5 border border-accent/15">
                            <p className="text-[10px] font-semibold text-accent mb-1 uppercase tracking-wide flex items-center gap-1">
                              <Sparkles className="w-3 h-3" /> Insights
                            </p>
                            <p className="text-xs leading-relaxed">{meetingEval.payload.insights}</p>
                          </div>
                        )}

                        {/* Critical Alerts */}
                        {meetingEval.payload?.criticalAlerts?.length > 0 && (
                          <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/15">
                            <p className="text-[10px] font-semibold text-destructive mb-1 uppercase tracking-wide flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> Alertas Críticos
                            </p>
                            <ul className="space-y-1">
                              {meetingEval.payload.criticalAlerts.map((a: string, i: number) => (
                                <li key={i} className="text-xs flex items-start gap-1.5">
                                  <span className="text-destructive mt-0.5">›</span> {a}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Criteria breakdown */}
                        {meetingEval.criterios?.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Critérios</p>
                            {meetingEval.criterios.map((c: any) => (
                              <div key={c.id || c.label} className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-medium">{c.label}</span>
                                  <span className={cn(
                                    'text-xs font-bold',
                                    c.score >= 80 ? 'text-success' : c.score >= 60 ? 'text-primary' : 'text-warning'
                                  )}>{c.score}</span>
                                </div>
                                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full transition-all duration-500"
                                    style={{
                                      width: `${c.score}%`,
                                      background: c.score >= 80 ? 'hsl(168 80% 42%)' : c.score >= 60 ? 'hsl(210 100% 56%)' : 'hsl(38 92% 50%)',
                                    }}
                                  />
                                </div>
                                {c.feedback && (
                                  <p className="text-[10px] text-muted-foreground leading-snug">{c.feedback}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Re-evaluate button for already evaluated meetings */}
                    {selectedMeeting.analisada_por_ia && selectedMeeting.transcricao && (
                      <div className="pt-3 border-t border-border">
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full text-xs h-8 gap-1.5"
                          disabled={reEvaluating}
                          onClick={() => handleReEvaluate(selectedMeeting)}
                        >
                          {reEvaluating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                          {reEvaluating ? 'Reavaliando...' : 'Reavaliar com IA'}
                        </Button>
                      </div>
                    )}

                    {/* Not yet evaluated */}
                    {!selectedMeeting.analisada_por_ia && selectedMeeting.status === 'concluida' && (
                      <div className="pt-3 border-t border-border flex flex-col items-center gap-3 text-muted-foreground">
                        <Brain className="w-10 h-10 opacity-20" />
                        <p className="text-xs text-center">Esta reunião ainda não foi avaliada pela IA.</p>
                        {selectedMeeting.transcricao && (
                          <Button
                            size="sm"
                            className="text-xs h-8 bg-gradient-primary gap-1.5"
                            disabled={reEvaluating}
                            onClick={() => handleReEvaluate(selectedMeeting)}
                          >
                            {reEvaluating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
                            {reEvaluating ? 'Avaliando...' : 'Avaliar com IA'}
                          </Button>
                        )}
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
                {detailTab === 'participants' && (() => {
                  // Get participation from IA evaluation payload
                  const iaParticipation: { name: string; percent: number }[] = meetingEval?.payload?.participation || [];
                  return (
                    <div className="space-y-2">
                      {selectedMeeting.participantes.length > 0 ? (
                        selectedMeeting.participantes.map((p, i) => {
                          const isExternal = !p.email.endsWith('@appmax.com.br');
                          const displayName = p.name || p.email.split('@')[0];
                          // Match participation from IA by fuzzy first-name match
                          const match = iaParticipation.find(ip => {
                            const ipFirst = ip.name.toLowerCase().split(' ')[0];
                            const dpFirst = displayName.toLowerCase().split(/[.\s]/)[0];
                            return ipFirst === dpFirst || ip.name.toLowerCase().includes(dpFirst) || displayName.toLowerCase().includes(ipFirst);
                          });
                          const pct = match?.percent || 0;
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
                                <div className="flex items-center gap-2">
                                  <p className="text-xs font-medium truncate">{displayName}</p>
                                  {pct > 0 && (
                                    <span className={cn(
                                      'text-[10px] font-bold',
                                      pct >= 30 ? 'text-success' : pct >= 10 ? 'text-primary' : 'text-muted-foreground'
                                    )}>{pct}%</span>
                                  )}
                                </div>
                                <p className="text-[10px] text-muted-foreground truncate">{p.email}</p>
                                {pct > 0 && (
                                  <div className="h-1 bg-muted rounded-full overflow-hidden mt-1">
                                    <div
                                      className="h-full rounded-full transition-all"
                                      style={{
                                        width: `${pct}%`,
                                        background: pct >= 30 ? 'hsl(168 80% 42%)' : pct >= 10 ? 'hsl(210 100% 56%)' : 'hsl(var(--muted-foreground))',
                                      }}
                                    />
                                  </div>
                                )}
                              </div>
                              {isExternal && (
                                <span className="text-[10px] font-medium text-accent bg-accent/10 px-1.5 py-0.5 rounded flex-shrink-0">Externo</span>
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
                      {iaParticipation.length === 0 && selectedMeeting.transcricao && (
                        <p className="text-[10px] text-muted-foreground text-center pt-2">
                          Avalie com IA para ver a % de participação de cada pessoa.
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
