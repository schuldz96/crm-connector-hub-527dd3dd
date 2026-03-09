import { useState, useMemo } from 'react';
import { TrendingUp, Users, User, MessageSquare, Video, Brain, ChevronDown, Award, BarChart3, Calendar, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MOCK_USERS, MOCK_TEAMS, MOCK_MEETINGS, MOCK_EVALUATIONS } from '@/data/mockData';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, Legend } from 'recharts';
import { AI_CONFIG_STORAGE, DEFAULT_WHATSAPP_CRITERIA } from '@/pages/AIConfigPage';
import { useAuth } from '@/contexts/AuthContext';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function loadAllAiAnalyses(): { chatId: string; result: any }[] {
  const out: { chatId: string; result: any }[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('appmax_ai_analysis_')) {
      try {
        const r = JSON.parse(localStorage.getItem(key)!);
        out.push({ chatId: key.replace('appmax_ai_analysis_', ''), result: r });
      } catch { /* ignore */ }
    }
  }
  return out;
}

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
  const { user } = useAuth();
  const role = user?.role ?? 'member';

  // ── Determine which teams/users the current user can see ──────────────────
  // admin/director → all teams & all users
  // supervisor → only their own team
  // member → only themselves
  const visibleTeams = useMemo(() => {
    if (role === 'admin' || role === 'director') return MOCK_TEAMS;
    if (role === 'supervisor') return MOCK_TEAMS.filter(t => t.supervisorId === user?.id);
    return []; // members cannot see team view
  }, [role, user?.id]);

  const visibleUsers = useMemo(() => {
    if (role === 'admin' || role === 'director') return MOCK_USERS;
    if (role === 'supervisor') {
      const myTeam = MOCK_TEAMS.find(t => t.supervisorId === user?.id);
      if (!myTeam) return MOCK_USERS.filter(u => u.id === user?.id);
      return MOCK_USERS.filter(u => myTeam.memberIds.includes(u.id) || u.id === user?.id);
    }
    // member: only themselves
    return MOCK_USERS.filter(u => u.id === user?.id);
  }, [role, user?.id]);

  // Members can only see person view; supervisors can switch; admins can switch
  const canSeeTeam = role === 'admin' || role === 'director' || role === 'supervisor';
  const canSeePerson = true;

  const [mode, setMode] = useState<'team' | 'person'>(canSeeTeam ? 'person' : 'person');
  const [selectedTeamId, setSelectedTeamId] = useState<string>(visibleTeams[0]?.id ?? '');
  const [selectedUserId, setSelectedUserId] = useState<string>(
    role === 'member' ? (user?.id ?? visibleUsers[0]?.id ?? '') : visibleUsers[0]?.id ?? ''
  );

  const allAnalyses = useMemo(() => loadAllAiAnalyses(), []);

  // ── Build user performance data ────────────────────────────────────────────
  const buildUserPerf = (userId: string) => {
    const u = MOCK_USERS.find(x => x.id === userId);
    if (!u) return null;

    // Meetings
    const userMeetings = MOCK_MEETINGS.filter(m => m.sellerId === userId && m.status === 'completed');
    const evaluatedMeetings = userMeetings.filter(m => m.score != null);
    const avgMeetingScore = evaluatedMeetings.length
      ? Math.round(evaluatedMeetings.reduce((a, m) => a + (m.score ?? 0), 0) / evaluatedMeetings.length)
      : null;

    // Detailed eval criteria (from MOCK_EVALUATIONS)
    const evals = MOCK_EVALUATIONS.filter(e => userMeetings.some(m => m.id === e.meetingId));
    const avgCriteria = evals.length ? {
      rapport:      Math.round(evals.reduce((a, e) => a + e.rapport, 0) / evals.length),
      discovery:    Math.round(evals.reduce((a, e) => a + e.discovery, 0) / evals.length),
      presentation: Math.round(evals.reduce((a, e) => a + e.presentation, 0) / evals.length),
      objections:   Math.round(evals.reduce((a, e) => a + e.objections, 0) / evals.length),
      nextSteps:    Math.round(evals.reduce((a, e) => a + e.nextSteps, 0) / evals.length),
    } : null;

    // WhatsApp AI analyses (all cached in localStorage, filter by instance assigned to user)
    // Since we don't have instanceId in analysis, we use all analyses as a demo (or could be scoped)
    const waAnalyses = allAnalyses.filter(a => a.result?.totalScore != null);
    const avgWaScore = waAnalyses.length
      ? Math.round(waAnalyses.reduce((a, x) => a + x.result.totalScore, 0) / waAnalyses.length)
      : null;

    // WA criteria breakdown (average across analyses)
    const waCriteria = waAnalyses.length
      ? (() => {
          const criMap: Record<string, number[]> = {};
          waAnalyses.forEach(a => {
            (a.result.criteriaScores ?? []).forEach((c: any) => {
              if (!criMap[c.label]) criMap[c.label] = [];
              criMap[c.label].push(c.score);
            });
          });
          return Object.entries(criMap).map(([label, scores]) => ({
            label,
            score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
          }));
        })()
      : null;

    // Combined overall score
    const parts = [avgMeetingScore, avgWaScore].filter(Boolean) as number[];
    const overallScore = parts.length ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length) : null;

    // Score trend (per meeting)
    const trend = evaluatedMeetings
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(m => ({ date: new Date(m.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), score: m.score ?? 0, title: m.title }));

    // Radar data
    const radarData = avgCriteria ? [
      { subject: 'Rapport',     A: avgCriteria.rapport },
      { subject: 'Descoberta',  A: avgCriteria.discovery },
      { subject: 'Apresentação',A: avgCriteria.presentation },
      { subject: 'Objeções',    A: avgCriteria.objections },
      { subject: 'Prox. Passos',A: avgCriteria.nextSteps },
    ] : null;

    return { u, avgMeetingScore, avgWaScore, overallScore, avgCriteria, waCriteria, trend, radarData, evaluatedMeetings, evals, waAnalyses };
  };

  // ── Team mode ─────────────────────────────────────────────────────────────
  const buildTeamPerf = (teamId: string) => {
    const team = MOCK_TEAMS.find(t => t.id === teamId);
    if (!team) return null;
    const teamUserIds = [...team.memberIds, team.supervisorId];
    const members = teamUserIds.map(id => buildUserPerf(id)).filter(Boolean) as NonNullable<ReturnType<typeof buildUserPerf>>[];
    const avgOverall = members.filter(m => m.overallScore).length
      ? Math.round(members.filter(m => m.overallScore != null).reduce((a, m) => a + (m.overallScore ?? 0), 0) / members.filter(m => m.overallScore != null).length)
      : null;
    const totalMeetings = members.reduce((a, m) => a + m.evaluatedMeetings.length, 0);
    const totalWaAnalyses = members.reduce((a, m) => a + m.waAnalyses.length, 0);
    return { team, members, avgOverall, totalMeetings, totalWaAnalyses };
  };

  // For members, always show their own profile regardless of selection
  const effectiveUserId = role === 'member' ? (user?.id ?? selectedUserId) : selectedUserId;
  // For supervisors with only one team, auto-use that team
  const effectiveTeamId = visibleTeams.length === 1 ? visibleTeams[0].id : selectedTeamId;

  const userPerf = mode === 'person' ? buildUserPerf(effectiveUserId) : null;
  const teamPerf = mode === 'team' ? buildTeamPerf(effectiveTeamId) : null;

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
      <div className="glass-card p-3 mb-5 flex items-center gap-3 flex-wrap">
        {/* Mode toggle — hidden for members (only person view) */}
        {canSeeTeam && (
          <div className="flex gap-1 p-0.5 bg-secondary rounded-lg border border-border">
            {(['person', 'team'] as const).map(m => (
              <button key={m}
                onClick={() => setMode(m)}
                className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                  mode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
                {m === 'person' ? <User className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
                {m === 'person' ? 'Vendedor' : 'Time'}
              </button>
            ))}
          </div>
        )}

        {/* Selector — members see a static label, others get a dropdown */}
        {mode === 'person' ? (
          role === 'member' ? (
            <div className="flex items-center gap-2 px-3 h-9 rounded-lg bg-secondary border border-border text-xs text-foreground">
              <User className="w-3.5 h-3.5 text-muted-foreground" />
              {visibleUsers[0]?.name ?? 'Você'}
            </div>
          ) : (
            <div className="relative">
              <select
                value={selectedUserId}
                onChange={e => setSelectedUserId(e.target.value)}
                className="text-xs bg-secondary border border-border rounded-lg pl-3 pr-7 h-9 text-foreground outline-none focus:border-primary/50 cursor-pointer appearance-none min-w-[200px]">
                {visibleUsers.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name} — {u.role === 'member' ? 'Vendedor' : u.role === 'supervisor' ? 'Supervisor' : u.role === 'director' ? 'Diretor' : 'Admin'}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-muted-foreground absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )
        ) : (
          visibleTeams.length > 1 ? (
            <div className="relative">
              <select
                value={selectedTeamId}
                onChange={e => setSelectedTeamId(e.target.value)}
                className="text-xs bg-secondary border border-border rounded-lg pl-3 pr-7 h-9 text-foreground outline-none focus:border-primary/50 cursor-pointer appearance-none min-w-[200px]">
                {visibleTeams.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-muted-foreground absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
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
        const { u, avgMeetingScore, avgWaScore, overallScore, avgCriteria, waCriteria, trend, radarData, evaluatedMeetings, evals, waAnalyses } = userPerf;
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
                  {MOCK_TEAMS.find(t => t.id === u.teamId) && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                      {MOCK_TEAMS.find(t => t.id === u.teamId)?.name}
                    </span>
                  )}
                  <span className={cn('text-[10px] px-2 py-0.5 rounded-full border', u.status === 'active' ? 'bg-success/10 text-success border-success/20' : 'bg-muted text-muted-foreground border-border')}>
                    {u.status === 'active' ? 'Ativo' : 'Inativo'}
                  </span>
                  {overallScore !== null && (
                    <span className={cn('text-[10px] px-2 py-0.5 rounded-full border font-bold', scoreBg(overallScore))}>
                      {scoreLabel(overallScore)} · {overallScore}/100
                    </span>
                  )}
                </div>
              </div>
              {overallScore !== null && (
                <div className={cn('w-20 h-20 rounded-full border-4 flex flex-col items-center justify-center flex-shrink-0', overallScore >= 85 ? 'border-success' : overallScore >= 70 ? 'border-primary' : overallScore >= 50 ? 'border-warning' : 'border-destructive')}>
                  <span className={cn('text-2xl font-bold font-mono', scoreColor(overallScore))}>{overallScore}</span>
                  <span className="text-[9px] text-muted-foreground uppercase">Score</span>
                </div>
              )}
              {overallScore === null && (
                <div className="w-20 h-20 rounded-full border-4 border-border flex flex-col items-center justify-center flex-shrink-0 opacity-30">
                  <span className="text-lg font-bold text-muted-foreground">—</span>
                  <span className="text-[9px] text-muted-foreground uppercase">Sem dados</span>
                </div>
              )}
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <ScoreCard label="Score Médio Reuniões" value={avgMeetingScore ?? '—'} icon={Video} sub={`${evaluatedMeetings.length} reuniões avaliadas`} />
              <ScoreCard label="Score Médio WhatsApp" value={avgWaScore ?? '—'} icon={MessageSquare} sub={`${waAnalyses.length} análises IA`} />
              <ScoreCard label="Reuniões Totais" value={evaluatedMeetings.length} icon={Calendar} sub="concluídas" />
              <ScoreCard label="Score Global" value={overallScore ?? '—'} icon={Award} sub="média reuniões + WhatsApp" />
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

              {/* Radar — meeting criteria */}
              {radarData && (
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

              {/* Score trend */}
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

              {/* Meeting criteria breakdown */}
              {avgCriteria && (
                <div className="glass-card p-4">
                  <p className="text-xs font-semibold mb-3 flex items-center gap-1.5">
                    <Video className="w-3.5 h-3.5 text-primary" /> Detalhamento — Reuniões
                  </p>
                  <div className="space-y-2.5">
                    <MiniBar label="Rapport" score={avgCriteria.rapport} />
                    <MiniBar label="Descoberta" score={avgCriteria.discovery} />
                    <MiniBar label="Apresentação" score={avgCriteria.presentation} />
                    <MiniBar label="Objeções" score={avgCriteria.objections} />
                    <MiniBar label="Próximos Passos" score={avgCriteria.nextSteps} />
                  </div>
                  {evals.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border/50">
                      <p className="text-[10px] text-muted-foreground font-semibold mb-2 uppercase tracking-wide">Última análise IA</p>
                      <p className="text-[11px] text-muted-foreground/80 leading-snug">{evals[evals.length - 1]?.aiSummary || 'Sem resumo.'}</p>
                    </div>
                  )}
                </div>
              )}

              {/* WhatsApp criteria */}
              {waCriteria && waCriteria.length > 0 && (
                <div className="glass-card p-4">
                  <p className="text-xs font-semibold mb-3 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-success" /> Detalhamento — WhatsApp
                    <span className="text-[10px] text-muted-foreground ml-1">({waAnalyses.length} análises)</span>
                  </p>
                  <div className="space-y-2.5">
                    {waCriteria.map(c => (
                      <MiniBar key={c.label} label={c.label} score={c.score} />
                    ))}
                  </div>
                </div>
              )}

              {/* Placeholder if no WA analyses */}
              {(!waCriteria || waCriteria.length === 0) && (
                <div className="glass-card p-4 flex flex-col items-center justify-center gap-2 text-center">
                  <Brain className="w-8 h-8 opacity-15" />
                  <p className="text-xs text-muted-foreground">Nenhuma análise de WhatsApp encontrada</p>
                  <p className="text-[10px] text-muted-foreground/60">Abra uma conversa no WhatsApp e clique em "IA" para analisar</p>
                </div>
              )}
            </div>

            {/* Recent meetings table */}
            {evaluatedMeetings.length > 0 && (
              <div className="glass-card p-4">
                <p className="text-xs font-semibold mb-3 flex items-center gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5 text-accent" /> Reuniões Avaliadas
                </p>
                <div className="space-y-2">
                  {evaluatedMeetings.slice().reverse().map(m => (
                    <div key={m.id} className="flex items-center gap-3 py-2 border-b border-border/40 last:border-0">
                      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-bold font-mono', scoreBg(m.score ?? 0))}>
                        <span className={scoreColor(m.score ?? 0)}>{m.score}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{m.title}</p>
                        <p className="text-[10px] text-muted-foreground">{m.clientName} · {new Date(m.date).toLocaleDateString('pt-BR')}</p>
                      </div>
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border', scoreBg(m.score ?? 0))}>
                        <span className={scoreColor(m.score ?? 0)}>{scoreLabel(m.score ?? 0)}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ════════════════ TEAM VIEW ═══════════════════════════════════════════ */}
      {mode === 'team' && teamPerf && (() => {
        const { team, members, avgOverall, totalMeetings, totalWaAnalyses } = teamPerf;
        const supervisor = MOCK_USERS.find(u => u.id === team.supervisorId);

        // Comparison bar chart
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
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground">
                    Meta: {team.goal ?? '—'} reuniões/mês
                  </span>
                  {avgOverall !== null && (
                    <span className={cn('text-[10px] px-2 py-0.5 rounded-full border font-bold', scoreBg(avgOverall))}>
                      {scoreLabel(avgOverall)} · {avgOverall}/100
                    </span>
                  )}
                </div>
              </div>
              {avgOverall !== null && (
                <div className={cn('w-20 h-20 rounded-full border-4 flex flex-col items-center justify-center flex-shrink-0', avgOverall >= 85 ? 'border-success' : avgOverall >= 70 ? 'border-primary' : avgOverall >= 50 ? 'border-warning' : 'border-destructive')}>
                  <span className={cn('text-2xl font-bold font-mono', scoreColor(avgOverall))}>{avgOverall}</span>
                  <span className="text-[9px] text-muted-foreground uppercase">Médio</span>
                </div>
              )}
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-3 gap-3">
              <ScoreCard label="Score Médio Geral" value={avgOverall ?? '—'} icon={Award} sub="média de todos os membros" />
              <ScoreCard label="Reuniões Avaliadas" value={totalMeetings} icon={Video} sub="com scorecard" />
              <ScoreCard label="Análises WhatsApp" value={totalWaAnalyses} icon={Brain} sub="conversas analisadas por IA" />
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

    </div>
  );
}
