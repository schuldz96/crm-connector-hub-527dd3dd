import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Video, Search, Brain, Clock, Calendar,
  User, Building2, ExternalLink, Sparkles, X,
  TrendingUp, TrendingDown, Lightbulb, AlertTriangle,
  CheckCircle2, Target, MessageSquare, RefreshCw, Loader2, Users, Key, Heart, Trash2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useAppConfig } from '@/contexts/AppConfigContext';
import { useToast } from '@/hooks/use-toast';
import {
  loadMeetingsFromDb, syncMeetConferences, clearAllMeetings, dispararTranscricoes, pullTranscriptions,
  fetchTranscriptsFromDrive, ensureAppmaxParticipantsRegistered, fetchTranscriptInfo, resolveMeetingTranscript,
  type DbMeeting, type TranscriptInfo
} from '@/lib/meetingsService';
import { evaluateMeeting, loadEvaluationByEntity, loadAllEvaluationsForEntity, type StoredEvaluation } from '@/lib/evaluationService';
import { loadAgentTree } from '@/lib/agentService';
import { evaluateMeetingMultiAgent } from '@/lib/multiAgentEvaluation';

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

const TRANSCRIPT_PLACEHOLDER_RE = /^\[Transcrição no Drive:\s*(?:ID-)?([A-Za-z0-9_-]+)\]$/i;

function isTranscriptPlaceholder(text: string | null | undefined): boolean {
  return TRANSCRIPT_PLACEHOLDER_RE.test(String(text || '').trim());
}


function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTranscriptParticipantNames(transcricao: string | null | undefined): string[] {
  if (!transcricao) return [];

  const match = transcricao.match(/(?:^|\n)\s*Participantes\s*\n([^\n]+)/i);
  if (!match?.[1]) return [];

  const names = match[1]
    .split(/[;,]/)
    .map((name) => name.trim())
    .filter(Boolean);

  return Array.from(new Set(names));
}

function findEmailByParticipantName(
  participantName: string,
  participants: { email: string; name?: string }[],
): string | null {
  const target = normalizeName(participantName);
  if (!target) return null;

  const targetTokens = target.split(' ').filter((t) => t.length >= 3);

  for (const participant of participants) {
    const candidateName = normalizeName(participant.name || participant.email.split('@')[0].replace(/[._-]/g, ' '));
    const candidateTokens = candidateName.split(' ').filter((t) => t.length >= 3);

    const tokenMatch = targetTokens.some((token) => candidateTokens.includes(token));
    if (candidateName === target || tokenMatch) {
      return participant.email;
    }
  }

  return null;
}


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
  const { user, hasMinRole } = useAuth();
  const { tokens } = useAppConfig();
  const { toast } = useToast();

  const [meetings, setMeetings] = useState<DbMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [evalProgress, setEvalProgress] = useState({ current: 0, total: 0 });
  const [evalCancelled, setEvalCancelled] = useState(false);
  const [search, setSearch] = useState('');
  const [transcFilter, setTranscFilter] = useState('all');
  const [selectedMeeting, setSelectedMeeting] = useState<DbMeeting | null>(null);
  const [detailTab, setDetailTab] = useState<'info' | 'transcript' | 'participants'>('info');
  const [allEvals, setAllEvals] = useState<(StoredEvaluation & { payload?: any })[]>([]);
  const [selectedEvalIdx, setSelectedEvalIdx] = useState(0);
  const meetingEval = allEvals[selectedEvalIdx] || null;
  const [reEvaluating, setReEvaluating] = useState(false);
  const [transcriptInfo, setTranscriptInfo] = useState<TranscriptInfo | null>(null);
  const [hydratingTranscript, setHydratingTranscript] = useState(false);

  const loadMeetings = useCallback(async () => {
    try {
      const data = await loadMeetingsFromDb();
      setMeetings(data);
      // Auto-create missing @appmax users in background
      ensureAppmaxParticipantsRegistered(data).then(created => {
        if (created.length > 0) {
          console.log(`[meetings] Auto-created ${created.length} @appmax users:`, created);
        }
      }).catch(e => console.warn('[meetings] Auto-create check failed:', e));
    } catch (err) {
      console.error('Failed to load meetings:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadMeetings(); }, [loadMeetings]);

  useEffect(() => {
    const timer = setInterval(() => {
      loadMeetings().catch((err) => console.warn('[meetings] auto refresh failed:', err));
    }, 60_000);

    return () => clearInterval(timer);
  }, [loadMeetings]);

  // Load all evaluations when meeting is selected (multi-agent support)
  useEffect(() => {
    if (selectedMeeting?.analisada_por_ia) {
      loadAllEvaluationsForEntity(selectedMeeting.id).then(evals => {
        setAllEvals(evals);
        // Default to first eval (primary/Sandler)
        const sandlerIdx = evals.findIndex(e =>
          (e as any).tipo_reuniao_detectado?.toLowerCase().includes('sandler')
        );
        setSelectedEvalIdx(sandlerIdx >= 0 ? sandlerIdx : 0);
      }).catch(() => {
        setAllEvals([]);
        setSelectedEvalIdx(0);
      });
    } else {
      setAllEvals([]);
      setSelectedEvalIdx(0);
    }
  }, [selectedMeeting?.id, selectedMeeting?.analisada_por_ia]);

  // Load transcript info from meet_conferences when meeting is selected
  useEffect(() => {
    if (selectedMeeting?.google_event_id) {
      setTranscriptInfo(null);
      fetchTranscriptInfo(selectedMeeting.google_event_id)
        .then(setTranscriptInfo)
        .catch(() => setTranscriptInfo(null));
    } else {
      setTranscriptInfo(null);
    }
  }, [selectedMeeting?.id, selectedMeeting?.google_event_id]);

  useEffect(() => {
    if (!selectedMeeting?.id || !selectedMeeting.google_event_id) return;
    if (!isTranscriptPlaceholder(selectedMeeting.transcricao)) return;

    let cancelled = false;
    setHydratingTranscript(true);

    resolveMeetingTranscript(selectedMeeting.id, selectedMeeting.google_event_id)
      .then((resolved) => {
        if (cancelled || !resolved) return;

        setMeetings(prev => prev.map(m =>
          m.id === selectedMeeting.id
            ? { ...m, transcricao: resolved.transcricao, transcript_file_id: resolved.transcript_file_id }
            : m
        ));

        setSelectedMeeting(prev =>
          prev && prev.id === selectedMeeting.id
            ? { ...prev, transcricao: resolved.transcricao, transcript_file_id: resolved.transcript_file_id }
            : prev
        );
      })
      .catch((err) => {
        console.warn('[meetings] Failed to resolve placeholder transcript:', err);
      })
      .finally(() => {
        if (!cancelled) setHydratingTranscript(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedMeeting?.id, selectedMeeting?.google_event_id, selectedMeeting?.transcricao]);

  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0, phase: '' });

  // Persist last sync info for F5 resilience
  const SYNC_KEY = 'meetings_last_sync';
  const [lastSync, setLastSync] = useState<{ time: string; result: string } | null>(() => {
    try { return JSON.parse(localStorage.getItem(SYNC_KEY) || 'null'); } catch { return null; }
  });

  const saveSyncStatus = (result: string) => {
    const info = { time: new Date().toISOString(), result };
    localStorage.setItem(SYNC_KEY, JSON.stringify(info));
    setLastSync(info);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      // Step 1: Import new meetings from meet_conferences (call_interna=false only)
      setSyncProgress({ current: 0, total: 0, phase: 'Importando reuniões...' });
      toast({ title: 'Sincronizando...', description: 'Buscando novas reuniões do Google Meet.' });
      const syncResult = await syncMeetConferences();

      // Step 2: Reload to get fresh list with google_event_ids
      const freshMeetings = await loadMeetingsFromDb();
      setMeetings(freshMeetings);

      // Step 3: Dispatch transcription POSTs via pg_net for NEW conferences
      setSyncProgress({ current: 0, total: 0, phase: 'Disparando transcrições para NEW...' });
      const dispatchResult = await dispararTranscricoes();
      console.log(`[meetings] Dispatched: ${dispatchResult.dispatched}, Skipped: ${dispatchResult.skipped}`);

      // Step 4: Pull TRANSCRIPT_DONE transcriptions immediately (already ready in appmax)
      setSyncProgress({ current: 0, total: 0, phase: 'Puxando transcrições prontas (TRANSCRIPT_DONE)...' });
      const pullResult = await pullTranscriptions();
      console.log('[meetings] pullTranscriptions result:', pullResult);

      // Step 5: Fetch actual transcript text from Google Drive (Edge Function)
      setSyncProgress({ current: 0, total: 0, phase: 'Buscando conteúdo das transcrições no Google Drive...' });
      let driveFetched = 0;
      try {
        const driveResult = await fetchTranscriptsFromDrive();
        driveFetched = driveResult.fetched;
        console.log('[meetings] fetchTranscriptsFromDrive result:', driveResult);
      } catch (e) {
        console.warn('[meetings] fetchTranscriptsFromDrive failed (Edge Function may not be deployed):', e);
      }

      // Step 6: If there are dispatched NEW ones, poll for them
      let extraPulled = 0;
      if (dispatchResult.dispatched > 0 && pullResult.pending > 0) {
        const maxAttempts = 12;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          setSyncProgress({
            current: attempt,
            total: maxAttempts,
            phase: `Aguardando ${pullResult.pending} transcrições pendentes... (${attempt}/${maxAttempts})`
          });
          await new Promise(r => setTimeout(r, 10000));
          const poll = await pullTranscriptions();
          extraPulled += poll.updated;
          console.log(`[meetings] Poll ${attempt}: +${poll.updated} transcripts, ${poll.pending} still pending`);
          if (poll.pending === 0) break;
        }
      }

      // Final reload
      await loadMeetings();

      const totalTranscripts = pullResult.updated + extraPulled;
      const parts = [`${syncResult.inserted} novas, ${syncResult.updated} atualizadas`];
      if (totalTranscripts > 0) parts.push(`${totalTranscripts} transcrições importadas`);
      if (driveFetched > 0) parts.push(`${driveFetched} transcrições lidas do Drive`);
      if (dispatchResult.dispatched > 0) parts.push(`${dispatchResult.dispatched} transcrições disparadas`);
      if (dispatchResult.skipped > 0) parts.push(`${dispatchResult.skipped} já processadas`);

      const resultText = parts.join('. ') + '.';
      saveSyncStatus(resultText);
      toast({ title: 'Sincronização concluída', description: resultText });
    } catch (err: any) {
      console.error('[meetings] Sync error:', err);
      saveSyncStatus(`Erro: ${err.message}`);
      toast({ variant: 'destructive', title: 'Erro na sincronização', description: err.message });
    } finally {
      setSyncing(false);
      setSyncProgress({ current: 0, total: 0, phase: '' });
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Tem certeza que deseja apagar TODAS as reuniões e análises IA? Essa ação não pode ser desfeita.')) return;
    setSyncing(true);
    try {
      await clearAllMeetings();
      setMeetings([]);
      setSelectedMeeting(null);
      toast({ title: 'Reuniões removidas', description: 'Todas as reuniões e análises foram apagadas.' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro ao limpar', description: err.message });
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
        const emails = m.participantes?.map(p => p.email) || [];
        // Use multi-agent if available, fallback to single agent
        const agentTree = await loadAgentTree();
        if (agentTree.length > 0) {
          const multiResult = await evaluateMeetingMultiAgent(token, m.id, m.titulo, m.transcricao!, m.vendedor_id || null, emails);
          if (!multiResult) throw new Error('Multi-agent evaluation returned null');
        } else {
          await evaluateMeeting(token, 'gpt-4o-mini', m.id, m.titulo, m.transcricao!, m.vendedor_id || null, emails);
        }
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
      const emails = meeting.participantes?.map(p => p.email) || [];
      // Use multi-agent if available
      const agentTree = await loadAgentTree();
      let score: number | null = null;
      if (agentTree.length > 0) {
        const multiResult = await evaluateMeetingMultiAgent(token, meeting.id, meeting.titulo, meeting.transcricao, meeting.vendedor_id || null, emails);
        score = multiResult ? Math.round(multiResult.primaryResult.totalScore) : null;
      } else {
        const result = await evaluateMeeting(token, 'gpt-4o-mini', meeting.id, meeting.titulo, meeting.transcricao, meeting.vendedor_id || null, emails);
        score = result ? Math.round(result.totalScore) : null;
      }
      await loadMeetings();
      // Reload all evaluations for multi-agent selector
      const evals = await loadAllEvaluationsForEntity(meeting.id);
      setAllEvals(evals);
      const sandlerIdx = evals.findIndex(e =>
        (e as any).tipo_reuniao_detectado?.toLowerCase().includes('sandler')
      );
      setSelectedEvalIdx(sandlerIdx >= 0 ? sandlerIdx : 0);
      setSelectedMeeting(prev => prev ? { ...prev, analisada_por_ia: true, score: score ?? prev.score } : null);
      toast({ title: 'Avaliação concluída', description: `Score: ${score ?? '—'}/100` });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro na avaliação', description: err.message });
    } finally {
      setReEvaluating(false);
    }
  };

  // ── Role-based visibility ─────────────────────────────────────────────────
  const visibleMeetings = useMemo(() => {
    // admin, ceo, director → see all
    if (hasMinRole('director')) return meetings;

    const userEmail = user?.email?.toLowerCase() || '';
    const role = user?.role;

    // manager, coordinator → see meetings from their area
    if (role === 'manager' || role === 'coordinator') {
      if (!user?.areaId) return meetings.filter(m => m.vendedor_email?.toLowerCase() === userEmail);
      return meetings.filter(m => m.area_id === user.areaId || m.vendedor_email?.toLowerCase() === userEmail);
    }

    // supervisor → see meetings from their team + own
    if (role === 'supervisor') {
      if (!user?.teamId) return meetings.filter(m => m.vendedor_email?.toLowerCase() === userEmail);
      return meetings.filter(m => m.time_id === user.teamId || m.vendedor_email?.toLowerCase() === userEmail);
    }

    // member (vendedor) → see only own meetings
    return meetings.filter(m => m.vendedor_email?.toLowerCase() === userEmail);
  }, [meetings, user?.email, user?.role, user?.areaId, user?.teamId, hasMinRole]);

  const filtered = visibleMeetings.filter(m => {
    const s = search.toLowerCase();
    const matchSearch =
      m.titulo.toLowerCase().includes(s) ||
      (m.cliente_nome || '').toLowerCase().includes(s) ||
      (m.vendedor_nome || '').toLowerCase().includes(s);
    const matchTransc = transcFilter === 'all'
      || (transcFilter === 'com' && !!m.transcricao)
      || (transcFilter === 'sem' && !m.transcricao);
    return matchSearch && matchTransc;
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
              {syncing && syncProgress.phase ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-accent/30 bg-accent/5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
                  <div className="flex flex-col">
                    <span className="text-[10px] font-medium text-accent">
                      {syncProgress.phase}
                      {syncProgress.total > 0 && ` ${syncProgress.current}/${syncProgress.total}`}
                    </span>
                    {syncProgress.total > 0 && (
                      <div className="w-20 h-1 bg-muted rounded-full overflow-hidden mt-0.5">
                        <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${(syncProgress.current / syncProgress.total) * 100}%` }} />
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleClearAll}
                  disabled={syncing || loading || meetings.length === 0}
                  className="text-xs h-8 border-destructive/50 text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  Limpar tudo
                </Button>
                <Button
                  size="sm"
                  onClick={handleSync}
                  disabled={syncing || loading}
                  className="text-xs h-8 bg-gradient-primary"
                >
                  {syncing ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
                  {syncing ? 'Sincronizando...' : 'Sincronizar'}
                </Button>
                </>
              )}
            </div>
          </div>

          {/* Sync progress / last sync info */}
          {(syncing && syncProgress.phase) && (
            <div className="flex items-center gap-2 mb-3 p-2.5 rounded-lg bg-primary/5 border border-primary/20">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary flex-shrink-0" />
              <span className="text-xs text-primary">{syncProgress.phase}</span>
              {syncProgress.total > 0 && (
                <span className="text-[10px] text-muted-foreground ml-auto">
                  {syncProgress.current}/{syncProgress.total}
                </span>
              )}
            </div>
          )}
          {!syncing && lastSync && (
            <div className="flex items-center gap-2 mb-3 text-[10px] text-muted-foreground">
              <span>Última sync: {new Date(lastSync.time).toLocaleString('pt-BR')}</span>
              <span className="opacity-50">|</span>
              <span>{lastSync.result}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar por título, cliente, owner..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-8 text-xs bg-secondary border-border"
              />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {['all', 'com', 'sem'].map(s => (
                <button
                  key={s}
                  onClick={() => setTranscFilter(s)}
                  className={cn(
                    'text-xs px-3 py-1.5 rounded-lg border transition-all',
                    transcFilter === s
                      ? 'bg-primary/15 border-primary/30 text-primary font-medium'
                      : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  {{ all: 'Todas', com: 'Com transcrição', sem: 'Sem transcrição' }[s]}
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
                    <th className="text-left hidden md:table-cell">Owner</th>
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
                              {(m.meeting_code || m.google_event_id) && (
                                <p className="text-[10px] text-muted-foreground/60 font-mono">{m.meeting_code || m.google_event_id}</p>
                              )}
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
                    {(selectedMeeting as any).sentimento && (
                      <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1',
                        (selectedMeeting as any).sentimento === 'Positivo' ? 'bg-emerald-500/10 text-emerald-400' :
                        (selectedMeeting as any).sentimento === 'Negativo' ? 'bg-red-500/10 text-red-400' :
                        (selectedMeeting as any).sentimento === 'Preocupado' ? 'bg-amber-500/10 text-amber-400' :
                        (selectedMeeting as any).sentimento === 'Frustrado' ? 'bg-orange-500/10 text-orange-400' :
                        'bg-slate-500/10 text-slate-400'
                      )}>
                        <Heart className="w-2.5 h-2.5" /> {(selectedMeeting as any).sentimento}
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

              {/* Methodology selector (multi-agent) */}
              {allEvals.length > 1 && (
                <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-secondary/30">
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase">Metodologia:</span>
                  <div className="flex gap-1 flex-wrap">
                    {allEvals.map((ev, i) => (
                      <button key={ev.id} onClick={() => setSelectedEvalIdx(i)}
                        className={cn('text-[10px] px-2 py-0.5 rounded-full border transition-colors',
                          selectedEvalIdx === i ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground')}>
                        {(ev as any).tipo_reuniao_detectado || `Avaliacao ${i + 1}`}
                      </button>
                    ))}
                  </div>
                </div>
              )}

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
                        <span className="text-muted-foreground">Owner:</span>
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
                        {hydratingTranscript ? 'Carregando transcrição...' : (selectedMeeting.transcricao ? 'Disponível' : 'Não disponível')}
                      </span>
                    </div>
                    {transcriptInfo?.transcript_copied_file_id && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">File ID:</span>
                        <span className="font-mono text-[10px] text-muted-foreground">{transcriptInfo.transcript_copied_file_id}</span>
                      </div>
                    )}
                    {transcriptInfo?.status && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">Status:</span>
                        <span className={cn('font-medium text-[10px] px-2 py-0.5 rounded-full',
                          transcriptInfo.status.toLowerCase() === 'new' ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'
                        )}>
                          {transcriptInfo.status}
                        </span>
                      </div>
                    )}
                    {(transcriptInfo?.meeting_code || selectedMeeting.meeting_code) && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">Meeting code:</span>
                        <span className="font-mono text-[10px]">{transcriptInfo?.meeting_code || selectedMeeting.meeting_code}</span>
                      </div>
                    )}
                    {selectedMeeting.google_event_id && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">Conference key:</span>
                        <span className="font-mono text-[10px] text-muted-foreground">{selectedMeeting.google_event_id}</span>
                      </div>
                    )}

                    {/* AI Evaluation results */}
                    {selectedMeeting.analisada_por_ia && meetingEval && (
                      <div className="pt-3 border-t border-border space-y-3">
                        {/* Meeting type + Agent chain */}
                        {(meetingEval as any).tipo_reuniao_detectado && (
                          <div className="p-3 rounded-lg bg-primary/5 border border-primary/15">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-[10px] font-semibold text-primary uppercase tracking-wide flex items-center gap-1">
                                <Target className="w-3 h-3" /> Tipo da Reunião
                              </p>
                              <span className="text-xs font-bold text-primary px-2 py-0.5 rounded-full bg-primary/10">
                                {(meetingEval as any).tipo_reuniao_detectado}
                              </span>
                            </div>
                            {(meetingEval as any).chain_log?.length > 0 && (
                              <div className="space-y-1 mt-2">
                                <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide">Pipeline de agentes</p>
                                <div className="flex items-center gap-1 flex-wrap">
                                  {((meetingEval as any).chain_log as any[]).map((step: any, i: number) => (
                                    <div key={i} className="flex items-center gap-1">
                                      {i > 0 && <span className="text-muted-foreground text-[10px]">→</span>}
                                      <span className={cn(
                                        'text-[10px] px-2 py-0.5 rounded-full border font-medium',
                                        step.tipo === 'classificador' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                                        step.tipo === 'avaliador' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                        step.tipo === 'fallback' ? 'bg-warning/10 text-warning border-warning/20' :
                                        'bg-muted text-muted-foreground border-border'
                                      )}>
                                        {step.agente}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                                <div className="mt-1.5 space-y-0.5">
                                  {((meetingEval as any).chain_log as any[]).map((step: any, i: number) => (
                                    <p key={i} className="text-[9px] text-muted-foreground">
                                      <strong>{step.agente}:</strong> {step.output_resumo}
                                      {step.duracao_ms > 0 && <span className="ml-1 opacity-50">({(step.duracao_ms / 1000).toFixed(1)}s)</span>}
                                    </p>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Nível de Relacionamento (Sentiment) */}
                        {meetingEval.payload?.sentimento && (() => {
                          const sentConfig: Record<string, { color: string; bg: string; border: string }> = {
                            'Positivo': { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
                            'Neutro': { color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/20' },
                            'Negativo': { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
                            'Preocupado': { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
                            'Frustrado': { color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
                          };
                          const s = meetingEval.payload.sentimento as string;
                          const cfg = sentConfig[s] || sentConfig['Neutro'];
                          return (
                            <div className={cn('p-3 rounded-lg border', cfg.bg, cfg.border)}>
                              <div className="flex items-center justify-between mb-1.5">
                                <p className={cn('text-[10px] font-semibold uppercase tracking-wide flex items-center gap-1', cfg.color)}>
                                  <Heart className="w-3 h-3" /> Nível de Relacionamento
                                </p>
                                <span className={cn('text-xs font-bold px-2.5 py-0.5 rounded-full', cfg.bg, cfg.color, cfg.border, 'border')}>
                                  {s}
                                </span>
                              </div>
                              {meetingEval.payload.sentimentoResumo && (
                                <p className="text-xs text-muted-foreground leading-relaxed">{meetingEval.payload.sentimentoResumo}</p>
                              )}
                              {meetingEval.payload.sentimentoConfianca && (
                                <div className="mt-2 flex items-center gap-2">
                                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                    <div className={cn('h-full rounded-full', cfg.bg.replace('/10', '/60'))} style={{ width: `${meetingEval.payload.sentimentoConfianca}%` }} />
                                  </div>
                                  <span className="text-[9px] text-muted-foreground font-mono">{meetingEval.payload.sentimentoConfianca}%</span>
                                </div>
                              )}
                            </div>
                          );
                        })()}

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
                  const iaParticipation: { email?: string; name: string; percent: number }[] = meetingEval?.payload?.participation || [];

                  const transcriptNames = extractTranscriptParticipantNames(selectedMeeting.transcricao);
                  const baseParticipants = transcriptNames.length > 0
                    ? transcriptNames.map((name) => ({
                        name,
                        email: findEmailByParticipantName(name, selectedMeeting.participantes) || null,
                      }))
                    : selectedMeeting.participantes.map((p) => ({
                        name: p.name || p.email.split('@')[0],
                        email: p.email,
                      }));

                  const participantsWithPct = baseParticipants.map((p) => {
                    const displayName = p.name;
                    const normalizedDisplayName = normalizeName(displayName);

                    const match = (p.email
                      ? iaParticipation.find((ip) => ip.email?.toLowerCase() === p.email?.toLowerCase())
                      : undefined)
                      || iaParticipation.find((ip) => normalizeName(ip.name) === normalizedDisplayName)
                      || iaParticipation.find((ip) => {
                        const ipTokens = normalizeName(ip.name).split(' ').filter((t) => t.length >= 3);
                        const displayTokens = normalizedDisplayName.split(' ').filter((t) => t.length >= 3);
                        return displayTokens.some((token) => ipTokens.includes(token));
                      });

                    return {
                      ...p,
                      pct: match?.percent || 0,
                    };
                  }).sort((a, b) => b.pct - a.pct);

                  const totalPct = participantsWithPct.reduce((sum, p) => sum + p.pct, 0);

                  return (
                    <div className="space-y-2">
                      {transcriptNames.length > 0 && (
                        <div className="text-[10px] text-muted-foreground px-1">
                          Participantes extraídos da transcrição.
                        </div>
                      )}
                      {totalPct > 0 && (
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1">
                          <span>Participação calculada pela IA</span>
                          <span className={cn('font-bold', totalPct === 100 ? 'text-success' : 'text-warning')}>Total: {totalPct}%</span>
                        </div>
                      )}
                      {participantsWithPct.length > 0 ? (
                        participantsWithPct.map((p, i) => {
                          const isExternal = p.email ? !p.email.endsWith('@appmax.com.br') : false;
                          const pct = p.pct;
                          return (
                            <div
                              key={i}
                              className={cn(
                                'flex items-center gap-2.5 p-2.5 rounded-lg border',
                                isExternal ? 'bg-accent/5 border-accent/15' : 'bg-secondary border-border'
                              )}
                            >
                              <div className="w-7 h-7 rounded-full bg-secondary border border-border flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                                {(p.name || '?')[0].toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-xs font-medium truncate">{p.name}</p>
                                  {pct > 0 && (
                                    <span className={cn(
                                      'text-[10px] font-bold',
                                      pct >= 30 ? 'text-success' : pct >= 10 ? 'text-primary' : 'text-muted-foreground'
                                    )}>{pct}%</span>
                                  )}
                                </div>
                                {p.email ? (
                                  <p className="text-[10px] text-muted-foreground truncate">{p.email}</p>
                                ) : (
                                  <p className="text-[10px] text-muted-foreground/70 truncate">Email não identificado</p>
                                )}
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
