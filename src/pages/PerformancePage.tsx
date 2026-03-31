import { useState, useMemo, useEffect, useCallback } from 'react';
import { TrendingUp, Users, User, MessageSquare, Video, Brain, ChevronDown, Award, BarChart3, Calendar, Lock, Loader2, Filter, AlertCircle, Trophy, Clock, Shield, Mic } from 'lucide-react';
import SearchableSelect from '@/components/ui/searchable-select';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, Legend } from 'recharts';
import { useAuth } from '@/contexts/AuthContext';
import { loadEvaluations, loadUsersForPerformance, loadTeamsForPerformance, loadMeetingDurations, loadAgentNames, type StoredEvaluation } from '@/lib/evaluationService';
import { supabase } from '@/integrations/supabase/client';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function scoreColor(s: number) {
  if (s >= 85) return 'text-success';
  if (s >= 70) return 'text-primary';
  if (s >= 50) return 'text-warning';
  return 'text-destructive';
}
function scoreBg(s: number) {
  if (s >= 85) return 'bg-success/10 border-success/20';
  if (s >= 70) return 'bg-primary/10 border-primary/20';
  if (s >= 50) return 'bg-warning/10 border-warning/20';
  return 'bg-destructive/10 border-destructive/20';
}
function scoreLabel(s: number) {
  if (s >= 85) return 'Excelente';
  if (s >= 70) return 'Bom';
  if (s >= 50) return 'Regular';
  return 'Crítico';
}

const roleMap: Record<string, string> = {
  admin: 'admin', ceo: 'ceo', diretor: 'director', gerente: 'manager',
  coordenador: 'coordinator', supervisor: 'supervisor', vendedor: 'member',
};

// ─── Score Card ───────────────────────────────────────────────────────────────
function ScoreCard({ label, value, icon: Icon, sub }: { label: string; value: number | string; icon: any; sub?: string }) {
  const num = typeof value === 'number' ? value : null;
  return (
    <div className={cn('glass-card p-4 flex items-center gap-3', num !== null ? scoreBg(num) : '')}>
      <div className="w-10 h-10 rounded-xl bg-background/50 flex items-center justify-center flex-shrink-0">
        <Icon className={cn('w-5 h-5', num !== null ? scoreColor(num) : 'text-muted-foreground')} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn('text-2xl font-bold font-mono leading-tight', num !== null ? scoreColor(num) : 'text-foreground')}>
          {typeof value === 'number' ? value : value}
        </p>
        {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Mini Bar ─────────────────────────────────────────────────────────────────
function MiniBar({ label, score, weight }: { label: string; score: number; weight?: number }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}{weight ? <span className="text-[10px] opacity-50 ml-1">({weight}%)</span> : ''}</span>
        <span className={cn('font-bold font-mono', scoreColor(score))}>{score}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', score >= 85 ? 'bg-success' : score >= 70 ? 'bg-primary' : score >= 50 ? 'bg-warning' : 'bg-destructive')}
          style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function PerformancePage() {
  const { user, hasMinRole } = useAuth();
  const role = user?.role ?? 'member';

  // ── Period filter ─────────────────────────────────────────────────────────
  type PeriodKey = '7d' | '30d' | '90d' | 'this_month' | 'last_month' | 'all';
  const [period, setPeriod] = useState<PeriodKey>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const periodDates = useMemo(() => {
    const now = new Date();
    const fmt = (d: Date) => d.toISOString().split('T')[0];
    switch (period) {
      case '7d': { const s = new Date(now); s.setDate(s.getDate() - 7); return { from: fmt(s), to: fmt(now) }; }
      case '30d': { const s = new Date(now); s.setDate(s.getDate() - 30); return { from: fmt(s), to: fmt(now) }; }
      case '90d': { const s = new Date(now); s.setDate(s.getDate() - 90); return { from: fmt(s), to: fmt(now) }; }
      case 'this_month': return { from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`, to: fmt(now) };
      case 'last_month': {
        const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lmEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        return { from: fmt(lm), to: fmt(lmEnd) };
      }
      default: return { from: '', to: '' };
    }
  }, [period]);

  // ── Load data from DB ─────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [dbUsers, setDbUsers] = useState<any[]>([]);
  const [dbTeams, setDbTeams] = useState<any[]>([]);
  const [evaluations, setEvaluations] = useState<StoredEvaluation[]>([]);
  const [meetingDurations, setMeetingDurations] = useState<Record<string, number>>({});
  const [agentNames, setAgentNames] = useState<Record<string, string>>({});
  const [selectedEval, setSelectedEval] = useState<StoredEvaluation | null>(null);
  const [selectedMeeting, setSelectedMeeting] = useState<any>(null);
  const [loadingMeeting, setLoadingMeeting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [users, teams, evals, durations, agents] = await Promise.all([
      loadUsersForPerformance(),
      loadTeamsForPerformance(),
      loadEvaluations(),
      loadMeetingDurations(),
      loadAgentNames(),
    ]);
    setMeetingDurations(durations);
    setAgentNames(agents);
    setDbUsers(users);
    setDbTeams(teams);

    // Filter evaluations by period
    const { from, to } = periodDates;
    const filtered = from
      ? evals.filter(e => {
          const d = e.criado_em?.split('T')[0] || '';
          return d >= from && d <= to;
        })
      : evals;

    setEvaluations(filtered);
    setLoading(false);
  }, [periodDates]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Map DB users to consistent format ─────────────────────────────────────
  const users = useMemo(() => dbUsers.map(u => ({
    id: u.id,
    name: u.nome,
    email: u.email,
    avatar: u.avatar_url,
    role: roleMap[u.papel] || 'member',
    areaId: u.area_id,
    teamId: u.time_id,
  })), [dbUsers]);

  const teams = useMemo(() => dbTeams.map(t => ({
    id: t.id,
    name: t.nome,
    areaId: t.area_id,
    supervisorId: t.supervisor_id,
  })), [dbTeams]);

  // ── Role-based visibility ─────────────────────────────────────────────────
  const visibleTeams = useMemo(() => {
    if (hasMinRole('director')) return teams;
    if (role === 'manager' || role === 'coordinator')
      return teams.filter(t => t.areaId === user?.areaId);
    if (role === 'supervisor')
      return teams.filter(t => t.supervisorId === user?.id);
    return [];
  }, [role, user?.id, user?.areaId, hasMinRole, teams]);

  const visibleUsers = useMemo(() => {
    if (hasMinRole('director')) return users;
    if (role === 'manager' || role === 'coordinator')
      return users.filter(u => u.areaId === user?.areaId);
    if (role === 'supervisor') {
      const myTeam = teams.find(t => t.supervisorId === user?.id);
      if (!myTeam) return users.filter(u => u.id === user?.id);
      return users.filter(u => u.teamId === myTeam.id || u.id === user?.id);
    }
    return users.filter(u => u.id === user?.id);
  }, [role, user?.id, user?.areaId, hasMinRole, users, teams]);

  const canSeeTeam = hasMinRole('supervisor');

  const [mode, setMode] = useState<'team' | 'person'>('person');
  const [rankingLimit, setRankingLimit] = useState(5);
  const [selectedAgentIdx, setSelectedAgentIdx] = useState(0); // 0 = Sandler (first/principal)
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  // Auto-select first user/team when data loads
  useEffect(() => {
    if (visibleUsers.length > 0 && !selectedUserId) {
      setSelectedUserId(role === 'member' ? (user?.id ?? visibleUsers[0].id) : visibleUsers[0].id);
    }
  }, [visibleUsers, selectedUserId]);
  useEffect(() => {
    if (visibleTeams.length > 0 && !selectedTeamId) {
      setSelectedTeamId(visibleTeams[0].id);
    }
  }, [visibleTeams, selectedTeamId]);

  // ── Build user performance from evaluations ───────────────────────────────
  const [allEvalsForMeeting, setAllEvalsForMeeting] = useState<StoredEvaluation[]>([]);

  const openEvalDetail = async (ev: StoredEvaluation) => {
    setSelectedEval(ev);
    setSelectedMeeting(null);
    setAllEvalsForMeeting([]);
    if (ev.tipo_contexto === 'reuniao' && ev.entidade_id) {
      setLoadingMeeting(true);
      try {
        const { data } = await (supabase as any).schema('saas').from('reunioes')
          .select('id,titulo,transcricao,duracao_minutos,data_reuniao,participantes,status')
          .eq('id', ev.entidade_id).maybeSingle();
        setSelectedMeeting(data);
        // Load all evaluations for this meeting (all agents)
        const otherEvals = evaluations.filter(e => e.entidade_id === ev.entidade_id && e.tipo_contexto === 'reuniao');
        setAllEvalsForMeeting(otherEvals);
      } catch { /* ignore */ }
      finally { setLoadingMeeting(false); }
    }
  };

  const buildUserPerf = (userId: string) => {
    const u = users.find(x => x.id === userId);
    if (!u) return null;

    const userEvals = evaluations.filter(e => e.vendedor_id === userId);
    const allMeetEvals = userEvals.filter(e => e.tipo_contexto === 'reuniao');
    const waEvals = userEvals.filter(e => e.tipo_contexto === 'whatsapp');

    // Sandler is the principal methodology — use for scores/KPIs
    const sandlerAgentName = Object.entries(agentNames).find(([, name]) => name.toLowerCase().includes('sandler'));
    const sandlerAgentId = sandlerAgentName?.[0];
    const meetEvals = sandlerAgentId
      ? allMeetEvals.filter(e => (e as any).agente_avaliador_id === sandlerAgentId)
      : allMeetEvals;

    const avgMeetingScore = meetEvals.length
      ? Math.round(meetEvals.reduce((a, e) => a + (e.score || 0), 0) / meetEvals.length)
      : null;
    const avgWaScore = waEvals.length
      ? Math.round(waEvals.reduce((a, e) => a + (e.score || 0), 0) / waEvals.length)
      : null;

    const parts = [avgMeetingScore, avgWaScore].filter(Boolean) as number[];
    const overallScore = parts.length ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length) : null;

    // Criteria averages for meetings — grouped by agent (methodology) — uses ALL evals
    const meetByAgent: Record<string, { criteria: Record<string, { total: number; count: number; weight: number }> }> = {};
    for (const e of allMeetEvals) {
      const agentKey = (e as any).agente_avaliador_id || '_default';
      if (!meetByAgent[agentKey]) meetByAgent[agentKey] = { criteria: {} };
      for (const c of (e.criterios || []) as any[]) {
        const map = meetByAgent[agentKey].criteria;
        if (!map[c.label]) map[c.label] = { total: 0, count: 0, weight: c.weight || 0 };
        map[c.label].total += c.score;
        map[c.label].count++;
      }
    }
    const meetCriteriaByAgent = Object.entries(meetByAgent).map(([agentId, { criteria: cmap }]) => ({
      agentId,
      agentName: agentNames[agentId] || '',
      criteria: Object.entries(cmap).map(([label, v]) => ({
        label, score: Math.round(v.total / v.count), weight: v.weight,
      })).sort((a, b) => b.score - a.score),
    })).sort((a, b) => {
      // Sandler first (principal), then alphabetical
      const aIsSandler = a.agentName.toLowerCase().includes('sandler') ? 0 : 1;
      const bIsSandler = b.agentName.toLowerCase().includes('sandler') ? 0 : 1;
      if (aIsSandler !== bIsSandler) return aIsSandler - bIsSandler;
      return a.agentName.localeCompare(b.agentName, 'pt-BR');
    });
    // Flat list deduplicated by label (averaged) for radar
    const flatMap: Record<string, { total: number; count: number; weight: number }> = {};
    for (const g of meetCriteriaByAgent) {
      for (const c of g.criteria) {
        if (!flatMap[c.label]) flatMap[c.label] = { total: 0, count: 0, weight: c.weight };
        flatMap[c.label].total += c.score;
        flatMap[c.label].count++;
      }
    }
    const meetCriteria = Object.entries(flatMap).map(([label, v]) => ({
      label, score: Math.round(v.total / v.count), weight: v.weight,
    })).sort((a, b) => b.score - a.score);

    // Criteria averages for WhatsApp
    const waCriteriaMap: Record<string, { total: number; count: number; weight: number }> = {};
    for (const e of waEvals) {
      for (const c of (e.criterios || []) as any[]) {
        if (!waCriteriaMap[c.label]) waCriteriaMap[c.label] = { total: 0, count: 0, weight: c.weight || 0 };
        waCriteriaMap[c.label].total += c.score;
        waCriteriaMap[c.label].count++;
      }
    }
    const waCriteria = Object.entries(waCriteriaMap).map(([label, v]) => ({
      label,
      score: Math.round(v.total / v.count),
      weight: v.weight,
    }));

    // Radar data from meeting criteria
    const radarData = meetCriteria.length ? meetCriteria.slice(0, 8).map(c => ({ subject: c.label.length > 12 ? c.label.slice(0, 12) + '…' : c.label, A: c.score })) : null;

    // Score trend for meetings — fill all 30 days, carry forward last score
    const trendByDay: Record<string, { total: number; count: number }> = {};
    for (const e of meetEvals.filter(ev => ev.criado_em)) {
      const dayKey = new Date(e.criado_em).toISOString().split('T')[0];
      if (!trendByDay[dayKey]) trendByDay[dayKey] = { total: 0, count: 0 };
      trendByDay[dayKey].total += (e.score || 0);
      trendByDay[dayKey].count++;
    }
    // Generate all days in last 30 days
    const trend: { date: string; score: number; reunioes: number }[] = [];
    const today = new Date();
    let lastScore = avgMeetingScore || 0;
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      if (trendByDay[key]) {
        lastScore = Math.round(trendByDay[key].total / trendByDay[key].count);
        trend.push({ date: label, score: lastScore, reunioes: trendByDay[key].count });
      } else {
        trend.push({ date: label, score: lastScore, reunioes: 0 });
      }
    }

    return { u, avgMeetingScore, avgWaScore, overallScore, meetCriteria, meetCriteriaByAgent, waCriteria, trend, radarData, meetEvals, waEvals };
  };

  // ── Team performance ──────────────────────────────────────────────────────
  const buildTeamPerf = (teamId: string) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return null;

    const teamMembers = users.filter(u => u.teamId === teamId);
    const members = teamMembers.map(u => buildUserPerf(u.id)).filter(Boolean) as NonNullable<ReturnType<typeof buildUserPerf>>[];

    const withScore = members.filter(m => m.overallScore !== null);
    const avgOverall = withScore.length
      ? Math.round(withScore.reduce((a, m) => a + (m.overallScore ?? 0), 0) / withScore.length)
      : null;
    const totalMeetings = members.reduce((a, m) => a + m.meetEvals.length, 0);
    const totalWaAnalyses = members.reduce((a, m) => a + m.waEvals.length, 0);

    // Aggregate criteria from all members (same as person view)
    const allTeamMeetEvals = members.flatMap(m => m.meetEvals);
    const allTeamWaEvals = members.flatMap(m => m.waEvals);

    // Criteria by agent
    const teamByAgent: Record<string, { criteria: Record<string, { total: number; count: number; weight: number }> }> = {};
    for (const ev of allTeamMeetEvals) {
      const agentKey = (ev as any).agente_avaliador_id || '_default';
      if (!teamByAgent[agentKey]) teamByAgent[agentKey] = { criteria: {} };
      for (const c of ((ev.criterios || []) as any[])) {
        const map = teamByAgent[agentKey].criteria;
        if (!map[c.label]) map[c.label] = { total: 0, count: 0, weight: c.weight || 0 };
        map[c.label].total += c.score;
        map[c.label].count++;
      }
    }
    const teamCriteriaByAgent = Object.entries(teamByAgent).map(([agentId, { criteria: cmap }]) => ({
      agentId,
      agentName: agentNames[agentId] || '',
      criteria: Object.entries(cmap).map(([label, v]) => ({
        label, score: Math.round(v.total / v.count), weight: v.weight,
      })).sort((a, b) => b.score - a.score),
    })).sort((a, b) => {
      const aS = a.agentName.toLowerCase().includes('sandler') ? 0 : 1;
      const bS = b.agentName.toLowerCase().includes('sandler') ? 0 : 1;
      return aS - bS || a.agentName.localeCompare(b.agentName);
    });

    // WhatsApp criteria
    const teamWaCriteriaMap: Record<string, { total: number; count: number; weight: number }> = {};
    for (const ev of allTeamWaEvals) {
      for (const c of ((ev.criterios || []) as any[])) {
        if (!teamWaCriteriaMap[c.label]) teamWaCriteriaMap[c.label] = { total: 0, count: 0, weight: c.weight || 0 };
        teamWaCriteriaMap[c.label].total += c.score;
        teamWaCriteriaMap[c.label].count++;
      }
    }
    const teamWaCriteria = Object.entries(teamWaCriteriaMap).map(([label, v]) => ({
      label, score: Math.round(v.total / v.count), weight: v.weight,
    })).sort((a, b) => b.score - a.score);

    // Radar data (Sandler criteria or first agent)
    const sandlerGroup = teamCriteriaByAgent.find(g => g.agentName.toLowerCase().includes('sandler')) || teamCriteriaByAgent[0];
    const teamRadarData = sandlerGroup?.criteria.slice(0, 8).map(c => ({ subject: c.label.length > 12 ? c.label.slice(0, 12) + '…' : c.label, A: c.score })) || null;

    // Trend (Sandler evals, aggregated by day with carry-forward)
    const sandlerEvals = sandlerAgentId ? allTeamMeetEvals.filter(e => (e as any).agente_avaliador_id === sandlerAgentId) : allTeamMeetEvals;
    const teamTrendByDay: Record<string, { total: number; count: number }> = {};
    for (const e of sandlerEvals.filter(ev => ev.criado_em)) {
      const dayKey = new Date(e.criado_em).toISOString().split('T')[0];
      if (!teamTrendByDay[dayKey]) teamTrendByDay[dayKey] = { total: 0, count: 0 };
      teamTrendByDay[dayKey].total += (e.score || 0);
      teamTrendByDay[dayKey].count++;
    }
    const teamTrend: { date: string; score: number }[] = [];
    const todayD = new Date();
    let teamLastScore = avgOverall || 0;
    for (let i = 29; i >= 0; i--) {
      const d = new Date(todayD); d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      if (teamTrendByDay[key]) { teamLastScore = Math.round(teamTrendByDay[key].total / teamTrendByDay[key].count); }
      teamTrend.push({ date: label, score: teamLastScore });
    }

    // Avg meeting score (Sandler only)
    const teamAvgMeetScore = sandlerEvals.length ? Math.round(sandlerEvals.reduce((a, e) => a + (e.score || 0), 0) / sandlerEvals.length) : null;

    return { team, members, avgOverall, totalMeetings, totalWaAnalyses, teamCriteriaByAgent, teamWaCriteria, allTeamMeetEvals, teamRadarData, teamTrend, teamAvgMeetScore };
  };

  const effectiveUserId = role === 'member' ? (user?.id ?? selectedUserId) : selectedUserId;
  const effectiveTeamId = visibleTeams.length === 1 ? visibleTeams[0]?.id : selectedTeamId;

  const userPerf = mode === 'person' && effectiveUserId ? buildUserPerf(effectiveUserId) : null;
  const teamPerf = mode === 'team' && effectiveTeamId ? buildTeamPerf(effectiveTeamId) : null;

  if (loading) {
    return (
      <div className="page-container flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Carregando desempenho...</span>
      </div>
    );
  }

  return (
    <div className="page-container animate-fade-in">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-primary" /> Desempenho
          </h1>
          <p className="text-sm text-muted-foreground">Scores compilados de reuniões e WhatsApp por vendedor ou time</p>
        </div>
        {/* Period filter */}
        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          {([
            { key: '7d', label: '7 dias' },
            { key: '30d', label: '30 dias' },
            { key: '90d', label: '90 dias' },
            { key: 'this_month', label: 'Este mês' },
            { key: 'last_month', label: 'Mês passado' },
            { key: 'all', label: 'Tudo' },
          ] as const).map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className={cn('text-[11px] px-2.5 py-1 rounded-lg border transition-all font-medium',
                period === p.key
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:text-foreground')}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Role badge ── */}
      {role === 'member' && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-muted/50 border border-border text-xs text-muted-foreground">
          <Lock className="w-3.5 h-3.5" />
          Você está vendo apenas os seus próprios dados de desempenho.
        </div>
      )}
      {role === 'supervisor' && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20 text-xs text-primary">
          <Users className="w-3.5 h-3.5" />
          Você pode visualizar apenas os membros do seu time.
        </div>
      )}

      {/* ── Selector strip ── */}
      <div className="glass-card p-3 mb-5 flex items-center gap-3 flex-wrap relative z-20">
        {canSeeTeam && (
          <div className="flex gap-1 p-0.5 bg-secondary rounded-lg border border-border">
            {(['person', 'team'] as const).map(m => (
              <button key={m}
                onClick={() => setMode(m)}
                className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                  mode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
                {m === 'person' ? <User className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
                {m === 'person' ? 'Analista' : 'Time'}
              </button>
            ))}
          </div>
        )}

        {mode === 'person' ? (
          role === 'member' ? (
            <div className="flex items-center gap-2 px-3 h-9 rounded-lg bg-secondary border border-border text-xs text-foreground">
              <User className="w-3.5 h-3.5 text-muted-foreground" />
              {visibleUsers[0]?.name ?? 'Você'}
            </div>
          ) : (
            <SearchableSelect
              value={selectedUserId}
              onChange={setSelectedUserId}
              placeholder="Selecione um analista..."
              options={visibleUsers.filter(u => u.role === 'member').sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).map(u => {
                const perf = buildUserPerf(u.id);
                const score = perf?.overallScore;
                const dot = score != null ? (score >= 85 ? '🟢' : score >= 70 ? '🔵' : score >= 50 ? '🟡' : '🔴') : '';
                return { value: u.id, label: score != null ? `${u.name}  ${dot} ${score}` : u.name };
              })}
              className="min-w-[240px]"
            />
          )
        ) : (
          visibleTeams.length > 1 ? (
            <SearchableSelect
              value={selectedTeamId}
              onChange={setSelectedTeamId}
              placeholder="Selecione um time..."
              options={visibleTeams.map(t => ({ value: t.id, label: t.name }))}
              className="min-w-[240px]"
            />
          ) : (
            <div className="flex items-center gap-2 px-3 h-9 rounded-lg bg-secondary border border-border text-xs text-foreground">
              <Users className="w-3.5 h-3.5 text-muted-foreground" />
              {visibleTeams[0]?.name ?? 'Meu Time'}
            </div>
          )
        )}
      </div>

      {/* ════════════════ PERSON VIEW ════════════════════════════════════════ */}
      {mode === 'person' && userPerf && (() => {
        const { u, avgMeetingScore, avgWaScore, overallScore, meetCriteria, meetCriteriaByAgent, waCriteria, trend, radarData, meetEvals, waEvals } = userPerf;
        const teamName = teams.find(t => t.id === u.teamId)?.name;
        return (
          <div className="space-y-5">
            {/* Profile strip */}
            <div className="flex items-center gap-4 glass-card p-4">
              <img src={u.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.name}`}
                alt={u.name} className="w-14 h-14 rounded-full border border-border flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-lg font-display font-bold">{u.name}</p>
                <p className="text-xs text-muted-foreground">{u.email}</p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {teamName && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                      {teamName}
                    </span>
                  )}
                  {overallScore !== null && (
                    <span className={cn('text-[10px] px-2 py-0.5 rounded-full border font-bold', scoreBg(overallScore))}>
                      {scoreLabel(overallScore)} · {overallScore}/100
                    </span>
                  )}
                </div>
              </div>
              {overallScore !== null ? (
                <div className={cn('w-20 h-20 rounded-full border-4 flex flex-col items-center justify-center flex-shrink-0', overallScore >= 85 ? 'border-success' : overallScore >= 70 ? 'border-primary' : overallScore >= 50 ? 'border-warning' : 'border-destructive')}>
                  <span className={cn('text-2xl font-bold font-mono', scoreColor(overallScore))}>{overallScore}</span>
                  <span className="text-[9px] text-muted-foreground uppercase">Score</span>
                </div>
              ) : (
                <div className="w-20 h-20 rounded-full border-4 border-border flex flex-col items-center justify-center flex-shrink-0 opacity-30">
                  <span className="text-lg font-bold text-muted-foreground">—</span>
                  <span className="text-[9px] text-muted-foreground uppercase">Sem dados</span>
                </div>
              )}
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <ScoreCard label="Score Médio Reuniões" value={avgMeetingScore ?? '—'} icon={Video} sub={`${meetEvals.length} reuniões avaliadas`} />
              <ScoreCard label="Score Médio WhatsApp" value={avgWaScore ?? '—'} icon={MessageSquare} sub={`${waEvals.length} conversas avaliadas`} />
              <ScoreCard label="Total Avaliações" value={meetEvals.length + waEvals.length} icon={Calendar} sub="reuniões + WhatsApp" />
              <ScoreCard label="Score Global" value={overallScore ?? '—'} icon={Award} sub="média reuniões + WhatsApp" />
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {radarData && radarData.length > 0 && (
                <div className="glass-card p-4 lg:col-span-1">
                  <p className="text-xs font-semibold mb-3 flex items-center gap-1.5">
                    <Video className="w-3.5 h-3.5 text-primary" /> Critérios de Reunião
                  </p>
                  <ResponsiveContainer width="100%" height={200}>
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="hsl(var(--border))" />
                      <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
                      <Radar dataKey="A" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} strokeWidth={2} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {trend.length > 1 && (
                <div className="glass-card p-4 lg:col-span-2">
                  <p className="text-xs font-semibold mb-3 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-accent" /> Evolução do Score em Reuniões
                  </p>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={trend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
                      <Tooltip
                        contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }}
                        labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
                      />
                      <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: 'hsl(var(--primary))', r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Meeting + WhatsApp breakdowns */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {meetCriteriaByAgent.length > 0 && (
                <div className="glass-card p-4">
                  <p className="text-xs font-semibold mb-3 flex items-center gap-1.5">
                    <Video className="w-3.5 h-3.5 text-primary" /> Detalhamento — Reuniões
                    <span className="text-[10px] text-muted-foreground ml-1">({meetEvals.length} avaliações)</span>
                  </p>
                  {/* Agent/methodology selector buttons */}
                  {meetCriteriaByAgent.length > 1 && (
                    <div className="flex gap-1 mb-3 flex-wrap">
                      {meetCriteriaByAgent.map((group, gi) => {
                        const name = group.agentId === '_default' ? 'Padrão' : (agentNames[group.agentId] || `Agente ${gi + 1}`).replace('[Closer In] ', '');
                        const isSandler = (agentNames[group.agentId] || '').toLowerCase().includes('sandler');
                        return (
                          <button key={group.agentId} onClick={() => setSelectedAgentIdx(gi)}
                            className={cn('text-[10px] px-2.5 py-1 rounded-full border font-medium transition-all flex items-center gap-1',
                              selectedAgentIdx === gi ? 'bg-primary/15 border-primary/30 text-primary' : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted')}>
                            {name}
                            {isSandler && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {/* Show selected agent criteria */}
                  {(() => {
                    const group = meetCriteriaByAgent[selectedAgentIdx] || meetCriteriaByAgent[0];
                    if (!group) return null;
                    return (
                      <div className="space-y-2">
                        {group.criteria.map(c => (
                          <MiniBar key={c.label} label={c.label} score={c.score} weight={c.weight} />
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}

              {waCriteria.length > 0 ? (
                <div className="glass-card p-4">
                  <p className="text-xs font-semibold mb-3 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-success" /> Detalhamento — WhatsApp
                    <span className="text-[10px] text-muted-foreground ml-1">({waEvals.length} avaliações)</span>
                  </p>
                  <div className="space-y-2.5">
                    {waCriteria.map(c => (
                      <MiniBar key={c.label} label={c.label} score={c.score} weight={c.weight} />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="glass-card p-4 flex flex-col items-center justify-center gap-2 text-center">
                  <Brain className="w-8 h-8 opacity-15" />
                  <p className="text-xs text-muted-foreground">Nenhuma avaliação de WhatsApp</p>
                  <p className="text-[10px] text-muted-foreground/60">A avaliação automática roda todo dia à meia-noite</p>
                </div>
              )}
            </div>

            {/* ── New Metrics Section ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Talk Ratio */}
              <div className="glass-card p-4">
                <p className="text-xs font-semibold mb-3 flex items-center gap-1.5">
                  <Mic className="w-3.5 h-3.5 text-primary" /> Relação de Fala
                </p>
                {(() => {
                  const participations = meetEvals
                    .map(e => (e.payload as any)?.participation)
                    .filter(Boolean);
                  if (participations.length === 0) return <p className="text-xs text-muted-foreground">Sem dados de transcrição</p>;
                  const avgSeller = Math.round(participations.reduce((s: number, p: any) => s + (p.seller || p.vendedor || 50), 0) / participations.length);
                  const avgLead = 100 - avgSeller;
                  return (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-6 rounded-full overflow-hidden flex bg-muted">
                          <div className="h-full bg-primary/60 flex items-center justify-center text-[10px] font-bold text-primary-foreground" style={{ width: `${avgSeller}%` }}>{avgSeller}%</div>
                          <div className="h-full bg-success/60 flex items-center justify-center text-[10px] font-bold text-success-foreground" style={{ width: `${avgLead}%` }}>{avgLead}%</div>
                        </div>
                      </div>
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>Vendedor: {avgSeller}%</span>
                        <span>Lead: {avgLead}%</span>
                      </div>
                      {avgSeller > 65 && <p className="text-[10px] text-warning flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Excesso de fala — baixa escuta ativa</p>}
                    </div>
                  );
                })()}
              </div>

              {/* Avg Call Duration */}
              <div className="glass-card p-4">
                <p className="text-xs font-semibold mb-3 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-accent" /> Tempo Médio da Call
                </p>
                {(() => {
                  const items = meetEvals
                    .map(e => ({ id: e.id, dur: meetingDurations[e.entidade_id] || 0, title: (e as any).resumo?.slice(0, 40) || new Date(e.criado_em).toLocaleDateString('pt-BR'), date: new Date(e.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) }))
                    .filter(d => d.dur > 0)
                    .sort((a, b) => b.dur - a.dur);
                  if (items.length === 0) return <p className="text-xs text-muted-foreground">Sem dados de duração</p>;
                  const avg = Math.round(items.reduce((a, b) => a + b.dur, 0) / items.length);
                  return (
                    <div>
                      <p className="text-2xl font-bold font-mono">{avg} <span className="text-sm text-muted-foreground font-normal">min</span></p>
                      <p className="text-[10px] text-muted-foreground mb-2">{items.length} reuniões · min {items[items.length - 1].dur}min · máx {items[0].dur}min</p>
                      <div className="max-h-[100px] overflow-y-auto space-y-0.5 pr-1">
                        {items.map(d => (
                          <div key={d.id} className="flex items-center justify-between text-[10px]">
                            <span className="truncate text-muted-foreground flex-1 mr-2">{d.date} — {d.title}</span>
                            <span className={cn('font-mono font-bold flex-shrink-0', d.dur > avg * 1.5 ? 'text-warning' : d.dur < avg * 0.5 ? 'text-primary' : 'text-foreground')}>{d.dur}min</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Deviation Alerts */}
              <div className="glass-card p-4">
                <p className="text-xs font-semibold mb-3 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-destructive" /> Alertas de Desvio
                </p>
                {(() => {
                  // Extract per-meeting deviations from individual eval feedbacks
                  const deviations: { date: string; title: string; issue: string; score: number; evalObj: StoredEvaluation }[] = [];
                  for (const ev of meetEvals) {
                    const date = new Date(ev.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                    const title = (ev.payload as any)?.titulo || (ev as any).resumo?.slice(0, 30) || 'Reunião';
                    // Check critical alerts from AI
                    const critAlerts = (ev.payload as any)?.criticalAlerts || [];
                    for (const alert of critAlerts) {
                      deviations.push({ date, title, issue: alert, score: ev.score || 0, evalObj: ev });
                    }
                    // Check criteria with score < 30 (severe deviation)
                    for (const c of ((ev.criterios || []) as any[])) {
                      if (c.score < 30 && c.feedback) {
                        deviations.push({ date, title, issue: `${c.label} (${c.score}): ${c.feedback}`, score: c.score, evalObj: ev });
                      }
                    }
                  }
                  if (deviations.length === 0) return <p className="text-xs text-success flex items-center gap-1"><Shield className="w-3 h-3" /> Nenhum desvio detectado</p>;
                  return (
                    <div className="max-h-[140px] overflow-y-auto space-y-1.5 pr-1">
                      {deviations.slice(0, 20).map((d, i) => (
                        <button key={i} onClick={() => openEvalDetail(d.evalObj)}
                          className="flex items-start gap-1.5 text-[10px] text-destructive hover:bg-destructive/5 rounded p-0.5 -m-0.5 w-full text-left transition-colors">
                          <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                          <span><strong>{d.date}</strong> {d.issue}</span>
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Best meetings & conversations */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="glass-card p-4">
                <p className="text-xs font-semibold mb-3 flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5 text-warning" /> Melhores Reuniões
                </p>
                {meetEvals.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sem reuniões avaliadas</p>
                ) : (
                  <div className="space-y-1.5">
                    {[...meetEvals].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 5).map(e => (
                      <button key={e.id} onClick={() => openEvalDetail(e)}
                        className="flex items-center justify-between text-xs py-1.5 border-b border-border/50 last:border-0 hover:bg-muted/30 rounded px-1 -mx-1 transition-colors cursor-pointer w-full text-left">
                        <span className="truncate text-primary hover:underline">{(e as any).resumo?.slice(0, 60) || `Reunião ${new Date(e.criado_em).toLocaleDateString('pt-BR')}`}</span>
                        <span className={cn('font-bold font-mono ml-2 flex-shrink-0', scoreColor(e.score || 0))}>{e.score}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="glass-card p-4">
                <p className="text-xs font-semibold mb-3 flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5 text-success" /> Melhores Conversas WhatsApp
                </p>
                {waEvals.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sem conversas avaliadas</p>
                ) : (
                  <div className="space-y-1.5">
                    {[...waEvals].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 5).map(e => (
                      <div key={e.id} className="flex items-center justify-between text-xs py-1.5 border-b border-border/50 last:border-0">
                        <span className="truncate text-muted-foreground">{e.contato_telefone || (e as any).resumo?.slice(0, 60) || 'Conversa'}</span>
                        <span className={cn('font-bold font-mono ml-2', scoreColor(e.score || 0))}>{e.score}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Ranking (visible to supervisors+) */}
            {canSeeTeam && visibleUsers.length > 1 && (
              <div className="glass-card p-4">
                <p className="text-xs font-semibold mb-3 flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5 text-primary" /> Ranking de Vendedores
                </p>
                {(() => {
                  const ranked = visibleUsers
                    .map(vu => { const perf = buildUserPerf(vu.id); return perf ? { ...vu, score: perf.overallScore ?? 0, meetings: perf.meetEvals.length } : null; })
                    .filter(Boolean)
                    .sort((a, b) => (b!.score) - (a!.score));
                  return (
                    <>
                      <div className="space-y-1.5">
                        {ranked.slice(0, rankingLimit).map((vu, idx) => (
                          <div key={vu!.id} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
                            <span className={cn('w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0',
                              idx === 0 ? 'bg-warning/20 text-warning' : idx === 1 ? 'bg-muted text-foreground' : idx === 2 ? 'bg-orange-500/20 text-orange-500' : 'bg-muted/50 text-muted-foreground'
                            )}>{idx + 1}</span>
                            <span className="text-xs flex-1 truncate">{vu!.name}</span>
                            <span className="text-[10px] text-muted-foreground">{vu!.meetings} reuniões</span>
                            <span className={cn('font-bold font-mono text-xs', scoreColor(vu!.score))}>{vu!.score || '—'}</span>
                          </div>
                        ))}
                      </div>
                      {ranked.length > rankingLimit && (
                        <button onClick={() => setRankingLimit(l => l + 5)} className="w-full text-center text-xs text-primary hover:underline mt-3 py-1.5">
                          Ver mais ({ranked.length - rankingLimit} restantes)
                        </button>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        );
      })()}

      {mode === 'person' && !userPerf && !loading && (
        <div className="glass-card p-8 text-center">
          <Brain className="w-10 h-10 mx-auto opacity-15 mb-3" />
          <p className="text-sm text-muted-foreground">Selecione um vendedor para ver o desempenho</p>
        </div>
      )}

      {/* ════════════════ TEAM VIEW ═══════════════════════════════════════════ */}
      {mode === 'team' && teamPerf && (() => {
        const { team, members, avgOverall, totalMeetings, totalWaAnalyses, teamCriteriaByAgent, teamWaCriteria, allTeamMeetEvals, teamRadarData, teamTrend, teamAvgMeetScore } = teamPerf;
        const supervisor = users.find(u => u.id === team.supervisorId);

        const barData = members
          .filter(m => m.overallScore !== null)
          .map(m => ({
            name: m.u.name.split(' ')[0],
            Reuniões: m.avgMeetingScore ?? 0,
            WhatsApp: m.avgWaScore ?? 0,
          }));

        return (
          <div className="space-y-5">
            {/* Team header */}
            <div className="glass-card p-4 flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Users className="w-7 h-7 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-lg font-display font-bold">{team.name}</p>
                {supervisor && <p className="text-xs text-muted-foreground">Supervisor: {supervisor.name}</p>}
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground">
                    {members.length} membros
                  </span>
                  {avgOverall !== null && (
                    <span className={cn('text-[10px] px-2 py-0.5 rounded-full border font-bold', scoreBg(avgOverall))}>
                      {scoreLabel(avgOverall)} · {avgOverall}/100
                    </span>
                  )}
                </div>
              </div>
              {avgOverall !== null ? (
                <div className={cn('w-20 h-20 rounded-full border-4 flex flex-col items-center justify-center flex-shrink-0', avgOverall >= 85 ? 'border-success' : avgOverall >= 70 ? 'border-primary' : avgOverall >= 50 ? 'border-warning' : 'border-destructive')}>
                  <span className={cn('text-2xl font-bold font-mono', scoreColor(avgOverall))}>{avgOverall}</span>
                  <span className="text-[9px] text-muted-foreground uppercase">Médio</span>
                </div>
              ) : (
                <div className="w-20 h-20 rounded-full border-4 border-border flex flex-col items-center justify-center flex-shrink-0 opacity-30">
                  <span className="text-lg text-muted-foreground">—</span>
                </div>
              )}
            </div>

            {/* KPI cards — same as person view */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <ScoreCard label="Score Médio Reuniões" value={teamAvgMeetScore ?? '—'} icon={Video} sub={`${totalMeetings} reuniões avaliadas`} />
              <ScoreCard label="Score Médio WhatsApp" value={totalWaAnalyses > 0 ? Math.round(members.filter(m => m.avgWaScore).reduce((a, m) => a + (m.avgWaScore || 0), 0) / (members.filter(m => m.avgWaScore).length || 1)) : '—'} icon={MessageSquare} sub={`${totalWaAnalyses} conversas avaliadas`} />
              <ScoreCard label="Total Avaliações" value={totalMeetings + totalWaAnalyses} icon={Calendar} sub="reuniões + WhatsApp" />
              <ScoreCard label="Score Global" value={avgOverall ?? '—'} icon={Award} sub="média do time" />
            </div>

            {/* Comparison chart */}
            {barData.length > 0 && (
              <div className="glass-card p-4">
                <p className="text-xs font-semibold mb-3 flex items-center gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5 text-accent" /> Comparativo de Score por Vendedor
                </p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={barData} barSize={20}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Reuniões" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="WhatsApp" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Radar + Trend — same as person view */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {teamRadarData && teamRadarData.length > 0 && (
                <div className="glass-card p-4 lg:col-span-1">
                  <p className="text-xs font-semibold mb-3 flex items-center gap-1.5">
                    <Video className="w-3.5 h-3.5 text-primary" /> Critérios de Reunião
                  </p>
                  <ResponsiveContainer width="100%" height={200}>
                    <RadarChart data={teamRadarData}>
                      <PolarGrid stroke="hsl(var(--border))" />
                      <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
                      <Radar dataKey="A" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} strokeWidth={2} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              )}
              {teamTrend.length > 1 && (
                <div className="glass-card p-4 lg:col-span-2">
                  <p className="text-xs font-semibold mb-3 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-accent" /> Evolução do Score em Reuniões
                  </p>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={teamTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
                      <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }} />
                      <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: 'hsl(var(--primary))', r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Criteria breakdown — same as person view */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {teamCriteriaByAgent.length > 0 && (
                <div className="glass-card p-4">
                  <p className="text-xs font-semibold mb-3 flex items-center gap-1.5">
                    <Video className="w-3.5 h-3.5 text-primary" /> Detalhamento — Reuniões
                    <span className="text-[10px] text-muted-foreground ml-1">({totalMeetings} avaliações)</span>
                  </p>
                  {teamCriteriaByAgent.length > 1 && (
                    <div className="flex gap-1 mb-3 flex-wrap">
                      {teamCriteriaByAgent.map((group, gi) => {
                        const name = group.agentId === '_default' ? 'Padrão' : (agentNames[group.agentId] || `Agente ${gi + 1}`).replace('[Closer In] ', '');
                        const isSandler = (agentNames[group.agentId] || '').toLowerCase().includes('sandler');
                        return (
                          <button key={group.agentId} onClick={() => setSelectedAgentIdx(gi)}
                            className={cn('text-[10px] px-2.5 py-1 rounded-full border font-medium transition-all flex items-center gap-1',
                              selectedAgentIdx === gi ? 'bg-primary/15 border-primary/30 text-primary' : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted')}>
                            {name}
                            {isSandler && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {(() => {
                    const group = teamCriteriaByAgent[selectedAgentIdx] || teamCriteriaByAgent[0];
                    if (!group) return null;
                    return (
                      <div className="space-y-2">
                        {group.criteria.map(c => (
                          <MiniBar key={c.label} label={c.label} score={c.score} weight={c.weight} />
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}

              {teamWaCriteria.length > 0 ? (
                <div className="glass-card p-4">
                  <p className="text-xs font-semibold mb-3 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-success" /> Detalhamento — WhatsApp
                    <span className="text-[10px] text-muted-foreground ml-1">({totalWaAnalyses} avaliações)</span>
                  </p>
                  <div className="space-y-2.5">
                    {teamWaCriteria.map(c => (
                      <MiniBar key={c.label} label={c.label} score={c.score} weight={c.weight} />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="glass-card p-4 flex flex-col items-center justify-center gap-2 text-center">
                  <Brain className="w-8 h-8 opacity-15" />
                  <p className="text-xs text-muted-foreground">Nenhuma avaliação de WhatsApp</p>
                </div>
              )}
            </div>

            {/* Best meetings of the team */}
            {allTeamMeetEvals.length > 0 && (
              <div className="glass-card p-4">
                <p className="text-xs font-semibold mb-3 flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5 text-warning" /> Melhores Reuniões do Time
                </p>
                <div className="space-y-1.5">
                  {[...allTeamMeetEvals].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 5).map(e => {
                    const seller = users.find(u => u.id === e.vendedor_id);
                    return (
                      <button key={e.id} onClick={() => openEvalDetail(e)}
                        className="flex items-center justify-between text-xs py-1.5 border-b border-border/50 last:border-0 hover:bg-muted/30 rounded px-1 -mx-1 transition-colors cursor-pointer w-full text-left">
                        <span className="truncate text-primary hover:underline flex-1">{seller ? `${seller.name.split(' ')[0]}: ` : ''}{(e as any).resumo?.slice(0, 50) || `Reunião ${new Date(e.criado_em).toLocaleDateString('pt-BR')}`}</span>
                        <span className={cn('font-bold font-mono ml-2 flex-shrink-0', scoreColor(e.score || 0))}>{e.score}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Members list */}
            <div>
              <p className="text-xs font-semibold mb-3 uppercase tracking-wide text-muted-foreground">Membros do Time</p>
              <div className="space-y-3">
                {members.map(m => (
                  <div key={m.u.id} className="glass-card p-4 flex items-center gap-4">
                    <img src={m.u.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${m.u.name}`}
                      alt={m.u.name} className="w-10 h-10 rounded-full border border-border flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold">{m.u.name}</p>
                        {m.u.id === team.supervisorId && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">Supervisor</span>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-0.5">
                          <p className="text-[10px] text-muted-foreground">Reuniões</p>
                          <p className={cn('text-sm font-bold font-mono', m.avgMeetingScore ? scoreColor(m.avgMeetingScore) : 'text-muted-foreground')}>
                            {m.avgMeetingScore ?? '—'}
                          </p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-[10px] text-muted-foreground">WhatsApp</p>
                          <p className={cn('text-sm font-bold font-mono', m.avgWaScore ? scoreColor(m.avgWaScore) : 'text-muted-foreground')}>
                            {m.avgWaScore ?? '—'}
                          </p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-[10px] text-muted-foreground">Global</p>
                          <p className={cn('text-sm font-bold font-mono', m.overallScore ? scoreColor(m.overallScore) : 'text-muted-foreground')}>
                            {m.overallScore ?? '—'}
                          </p>
                        </div>
                      </div>
                    </div>
                    {m.overallScore !== null ? (
                      <div className={cn('w-12 h-12 rounded-full border-2 flex items-center justify-center flex-shrink-0', m.overallScore >= 85 ? 'border-success' : m.overallScore >= 70 ? 'border-primary' : m.overallScore >= 50 ? 'border-warning' : 'border-destructive')}>
                        <span className={cn('text-sm font-bold font-mono', scoreColor(m.overallScore))}>{m.overallScore}</span>
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-full border-2 border-border flex items-center justify-center flex-shrink-0 opacity-30">
                        <span className="text-xs text-muted-foreground">—</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Evaluation Detail Modal */}
      {selectedEval && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[5vh]">
          <div className="absolute inset-0 bg-black/50" onClick={() => { setSelectedEval(null); setSelectedMeeting(null); }} />
          <div className="relative w-[700px] max-h-[90vh] bg-card border border-border rounded-xl shadow-2xl overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between z-10">
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-semibold truncate">
                  {selectedMeeting?.titulo || (selectedEval.payload as any)?.titulo || 'Detalhes da Avaliação'}
                </h2>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span>{new Date(selectedEval.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  {selectedMeeting?.duracao_minutos > 0 && (
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {selectedMeeting.duracao_minutos} min</span>
                  )}
                  {selectedMeeting?.status && (
                    <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-medium">{selectedMeeting.status}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className={cn('w-14 h-14 rounded-full border-4 flex items-center justify-center', (selectedEval.score || 0) >= 70 ? 'border-success' : (selectedEval.score || 0) >= 50 ? 'border-warning' : 'border-destructive')}>
                  <span className={cn('text-xl font-bold font-mono', scoreColor(selectedEval.score || 0))}>{selectedEval.score}</span>
                </div>
                <button onClick={() => { setSelectedEval(null); setSelectedMeeting(null); }} className="text-muted-foreground hover:text-foreground">
                  <span className="text-2xl leading-none">&times;</span>
                </button>
              </div>
            </div>

            <div className="px-6 py-4 space-y-5">
              {/* Resumo + Insights */}
              {(selectedEval as any).resumo && (
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                  <p className="text-xs font-semibold text-primary mb-1">Resumo da IA</p>
                  <p className="text-sm text-foreground">{(selectedEval as any).resumo}</p>
                </div>
              )}
              {(selectedEval.payload as any)?.insights && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Insights</p>
                  <p className="text-sm text-muted-foreground">{(selectedEval.payload as any).insights}</p>
                </div>
              )}

              {/* Critical Alerts */}
              {(selectedEval.payload as any)?.criticalAlerts?.length > 0 && (
                <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/10">
                  <p className="text-xs font-semibold text-destructive mb-1.5">Alertas Críticos</p>
                  <div className="space-y-1">
                    {((selectedEval.payload as any).criticalAlerts as string[]).map((a, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-xs text-destructive"><AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" /> {a}</div>
                    ))}
                  </div>
                </div>
              )}

              {/* Critérios por agente/metodologia */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Critérios de Avaliação</p>
                {allEvalsForMeeting.length > 1 ? (
                  <div className="space-y-4">
                    {allEvalsForMeeting
                      .sort((a, b) => {
                        const aName = agentNames[(a as any).agente_avaliador_id] || '';
                        const bName = agentNames[(b as any).agente_avaliador_id] || '';
                        const aS = aName.toLowerCase().includes('sandler') ? 0 : 1;
                        const bS = bName.toLowerCase().includes('sandler') ? 0 : 1;
                        return aS - bS || aName.localeCompare(bName);
                      })
                      .map(ev => {
                        const name = agentNames[(ev as any).agente_avaliador_id] || 'Avaliação';
                        const isSandler = name.toLowerCase().includes('sandler');
                        return (
                          <div key={ev.id} className={cn('rounded-lg border p-3', isSandler ? 'border-primary/30 bg-primary/5' : 'border-border/50')}>
                            <div className="flex items-center gap-2 mb-2">
                              <Brain className="w-3 h-3 text-muted-foreground" />
                              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{name}</span>
                              <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full border font-semibold', isSandler ? 'bg-primary/10 text-primary border-primary/20' : 'bg-muted text-muted-foreground border-border')}>{isSandler ? 'Principal' : 'Complementar'}</span>
                              <span className={cn('ml-auto text-sm font-bold font-mono', scoreColor(ev.score || 0))}>{ev.score}</span>
                            </div>
                            <div className="space-y-1.5">
                              {((ev.criterios || []) as any[]).sort((a, b) => (b.score || 0) - (a.score || 0)).map((c, i) => (
                                <div key={i}>
                                  <MiniBar label={c.label} score={c.score || 0} weight={c.weight} />
                                  {c.feedback && <p className="text-[10px] text-muted-foreground mt-0.5 ml-0.5 italic">"{c.feedback}"</p>}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {((selectedEval.criterios || []) as any[]).sort((a, b) => (b.score || 0) - (a.score || 0)).map((c, i) => (
                      <div key={i} className="p-2 rounded-lg border border-border/50">
                        <MiniBar label={c.label} score={c.score || 0} weight={c.weight} />
                        {c.feedback && <p className="text-[10px] text-muted-foreground mt-1 ml-0.5 italic">"{c.feedback}"</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Participantes */}
              {selectedMeeting?.participantes && (Array.isArray(selectedMeeting.participantes) ? selectedMeeting.participantes : []).length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Participantes</p>
                  <div className="flex flex-wrap gap-2">
                    {(selectedMeeting.participantes as any[]).map((p: any, i: number) => (
                      <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/50 border border-border text-xs">
                        <Users className="w-3 h-3 text-muted-foreground" />
                        {typeof p === 'string' ? p : p.email || p.nome || 'Participante'}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Transcrição */}
              {loadingMeeting ? (
                <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
              ) : selectedMeeting?.transcricao ? (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Transcrição</p>
                  <div className="max-h-[300px] overflow-y-auto p-3 rounded-lg bg-muted/30 border border-border text-xs font-mono leading-relaxed whitespace-pre-wrap text-muted-foreground">
                    {selectedMeeting.transcricao.slice(0, 5000)}
                    {selectedMeeting.transcricao.length > 5000 && '\n\n... (truncado)'}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
