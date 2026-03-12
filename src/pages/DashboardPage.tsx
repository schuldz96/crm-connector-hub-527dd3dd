import { useState, useEffect, useMemo, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { loadMeetingsFromDb, type DbMeeting } from '@/lib/meetingsService';
import { useEvolutionInstances } from '@/hooks/useEvolutionInstances';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, LineChart, Line
} from 'recharts';
import {
  Video, MessageSquare, TrendingUp, Star, ArrowUp, ArrowDown,
  Calendar, Clock, Zap, Brain, Wifi, WifiOff, Loader2
} from 'lucide-react';

const colorMap: Record<string, string> = {
  violet: 'hsl(261 86% 68%)',
  lavender: 'hsl(258 55% 76%)',
  purple: 'hsl(270 76% 62%)',
  green: 'hsl(142 71% 45%)',
  graphite: 'hsl(255 8% 63%)',
};

const statusStyle: Record<string, string> = {
  concluida: 'score-good',
  agendada: 'score-excellent',
  cancelada: 'score-poor',
  no_show: 'score-average',
};
const statusLabel: Record<string, string> = {
  concluida: 'Concluída',
  agendada: 'Agendada',
  cancelada: 'Cancelada',
  no_show: 'No-show',
};

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { instances } = useEvolutionInstances();
  const [meetings, setMeetings] = useState<DbMeeting[]>([]);
  const [loadingMeetings, setLoadingMeetings] = useState(true);

  useEffect(() => {
    loadMeetingsFromDb()
      .then(setMeetings)
      .catch(err => console.error('[dashboard] load meetings:', err))
      .finally(() => setLoadingMeetings(false));
  }, []);

  // ── KPIs ────────────────────────────────────────────────────────────
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const meetingsThisMonth = useMemo(() =>
    meetings.filter(m => {
      const d = new Date(m.data_reuniao);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }).length,
  [meetings, currentMonth, currentYear]);

  const avgScoreMeet = useMemo(() => {
    const withScore = meetings.filter(m => typeof m.score === 'number' && m.score !== null);
    if (!withScore.length) return 0;
    return Number((withScore.reduce((sum, m) => sum + (m.score || 0), 0) / withScore.length).toFixed(1));
  }, [meetings]);

  const avgScore = avgScoreMeet;

  const instancesConnected = useMemo(() =>
    instances.filter(i => i.connectionStatus === 'open').length,
  [instances]);

  const totalChats = useMemo(() =>
    instances.reduce((sum, i) => sum + (i._count?.Chat || 0), 0),
  [instances]);

  // ── Chart: Reuniões por mês (últimos 6 meses) ──────────────────────
  const meetingsPerMonth = useMemo(() => {
    const months: { month: string; reunioes: number; concluidas: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - i, 1);
      const label = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
      const m = d.getMonth();
      const y = d.getFullYear();
      const inMonth = meetings.filter(mt => {
        const md = new Date(mt.data_reuniao);
        return md.getMonth() === m && md.getFullYear() === y;
      });
      months.push({
        month: label.charAt(0).toUpperCase() + label.slice(1),
        reunioes: inMonth.length,
        concluidas: inMonth.filter(mt => mt.status === 'concluida').length,
      });
    }
    return months;
  }, [meetings, currentMonth, currentYear]);

  // ── Top Sellers (vendedores com mais reuniões e score) ─────────────
  const topSellers = useMemo(() => {
    const bySeller = new Map<string, { name: string; meetings: number; scoreSum: number; scoreCount: number }>();
    for (const m of meetings) {
      const key = m.vendedor_id || m.vendedor_email || 'unknown';
      const name = m.vendedor_nome || m.vendedor_email || 'Sem vendedor';
      const cur = bySeller.get(key) || { name, meetings: 0, scoreSum: 0, scoreCount: 0 };
      cur.meetings += 1;
      if (typeof m.score === 'number' && m.score !== null) {
        cur.scoreSum += m.score;
        cur.scoreCount += 1;
      }
      bySeller.set(key, cur);
    }
    return Array.from(bySeller.values())
      .filter(s => s.name !== 'Sem vendedor')
      .map(s => ({
        name: s.name,
        meetings: s.meetings,
        score: s.scoreCount ? Math.round(s.scoreSum / s.scoreCount) : 0,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(s.name)}`,
      }))
      .sort((a, b) => b.score - a.score || b.meetings - a.meetings)
      .slice(0, 6);
  }, [meetings]);

  // ── WhatsApp Instances summary ─────────────────────────────────────
  const instancesSummary = useMemo(() => {
    return instances.map(i => ({
      name: i.name,
      status: i.connectionStatus,
      chats: i._count?.Chat || 0,
      messages: i._count?.Message || 0,
    }));
  }, [instances]);

  // ── Recent meetings ────────────────────────────────────────────────
  const recentMeetings = useMemo(() => meetings.slice(0, 8), [meetings]);

  const monthLabel = now.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '');

  const kpiCards = [
    { label: 'Reuniões este mês', value: String(meetingsThisMonth), icon: Video, color: 'violet', unit: '' },
    { label: 'Score médio', value: avgScore ? String(avgScore) : '—', icon: Star, color: 'lavender', unit: avgScore ? 'pts' : '' },
    { label: 'WhatsApp conectados', value: String(instancesConnected), icon: Wifi, color: 'green', unit: `/ ${instances.length}` },
    { label: 'Total de reuniões', value: String(meetings.length), icon: TrendingUp, color: 'purple', unit: '' },
  ];

  return (
    <div className="page-container space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">
            Olá, {user?.name?.split(' ')[0] || 'Usuário'} 👋
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Aqui está o resumo de performance da sua equipe hoje.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="text-xs h-8 border-border">
            <Calendar className="w-3.5 h-3.5 mr-1.5" />
            {monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}
          </Button>
          <Button size="sm" className="text-xs h-8 bg-gradient-primary" onClick={() => navigate('/reports')}>
            <Zap className="w-3.5 h-3.5 mr-1.5" />
            Gerar Relatório IA
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi) => (
          <div key={kpi.label} className="kpi-card" style={{ '--kpi-color': colorMap[kpi.color] } as CSSProperties}>
            <div className="flex items-center justify-between">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ background: `${colorMap[kpi.color]}20` }}
              >
                <kpi.icon className="w-4.5 h-4.5" style={{ color: colorMap[kpi.color], width: 18, height: 18 }} />
              </div>
              {loadingMeetings && (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
              )}
            </div>
            <div>
              <p className="text-2xl font-display font-bold">
                {kpi.value}
                {kpi.unit && <span className="text-sm font-normal text-muted-foreground ml-1">{kpi.unit}</span>}
              </p>
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Meetings Area Chart */}
        <div className="glass-card p-5 lg:col-span-2">
          <div className="section-header">
            <div>
              <h3 className="section-title">Reuniões por Mês</h3>
              <p className="text-xs text-muted-foreground">Últimos 6 meses</p>
            </div>
          </div>
          {meetingsPerMonth.some(m => m.reunioes > 0) ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={meetingsPerMonth}>
                <defs>
                  <linearGradient id="gradReunions" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(261 86% 68%)" stopOpacity={0.34} />
                    <stop offset="95%" stopColor="hsl(261 86% 68%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradConcluidas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(142 71% 45%)" stopOpacity={0.34} />
                    <stop offset="95%" stopColor="hsl(142 71% 45%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Area type="monotone" dataKey="reunioes" stroke="hsl(261 86% 68%)" fill="url(#gradReunions)" strokeWidth={2.2} name="Total" />
                <Area type="monotone" dataKey="concluidas" stroke="hsl(142 71% 45%)" fill="url(#gradConcluidas)" strokeWidth={2.2} name="Concluídas" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
              Sem dados de reuniões ainda. Sincronize na página de Reuniões.
            </div>
          )}
        </div>

        {/* WhatsApp Instances */}
        <div className="glass-card p-5">
          <div className="section-header">
            <div>
              <h3 className="section-title">Instâncias WhatsApp</h3>
              <p className="text-xs text-muted-foreground">{instances.length} instância{instances.length !== 1 ? 's' : ''}</p>
            </div>
            <Button variant="ghost" size="sm" className="text-xs h-7 text-muted-foreground" onClick={() => navigate('/whatsapp')}>
              Ver todas
            </Button>
          </div>
          <div className="space-y-3 mt-2 max-h-[220px] overflow-y-auto pr-1">
            {instancesSummary.length > 0 ? instancesSummary.map((inst) => (
              <div key={inst.name} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  inst.status === 'open' ? 'bg-green-500/10' : 'bg-red-500/10'
                }`}>
                  {inst.status === 'open' ? (
                    <Wifi className="w-4 h-4 text-green-400" />
                  ) : (
                    <WifiOff className="w-4 h-4 text-red-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{inst.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {inst.status === 'open' ? 'Conectada' : inst.status === 'connecting' ? 'Conectando...' : 'Desconectada'}
                    {inst.chats > 0 && ` · ${inst.chats} chats`}
                    {inst.messages > 0 && ` · ${inst.messages.toLocaleString()} msgs`}
                  </p>
                </div>
                <span className={`w-2 h-2 rounded-full ${inst.status === 'open' ? 'bg-green-400' : 'bg-red-400'}`} />
              </div>
            )) : (
              <p className="text-xs text-muted-foreground p-2">Nenhuma instância encontrada. Configure em WhatsApp.</p>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Ranking */}
        <div className="glass-card p-5">
          <div className="section-header">
            <h3 className="section-title">Ranking Vendedores</h3>
            <Button variant="ghost" size="sm" className="text-xs h-7 text-muted-foreground" onClick={() => navigate('/performance')}>
              Ver todos
            </Button>
          </div>
          <div className="space-y-3">
            {topSellers.map((seller, i) => (
              <div key={seller.name} className="flex items-center gap-3">
                <span className={`text-sm font-bold w-5 text-center ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                  {i + 1}
                </span>
                <img src={seller.avatar} alt={seller.name} className="w-8 h-8 rounded-full border border-border" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{seller.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Progress value={seller.score} className="h-1 flex-1" />
                    <span className="text-xs text-muted-foreground">{seller.score || '—'}</span>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">{seller.meetings} meet{seller.meetings !== 1 ? 's' : ''}</span>
              </div>
            ))}
            {topSellers.length === 0 && (
              <p className="text-xs text-muted-foreground">Sem dados de vendedores ainda.</p>
            )}
          </div>
        </div>

        {/* Recent Meetings */}
        <div className="glass-card p-5 lg:col-span-2">
          <div className="section-header">
            <h3 className="section-title">Reuniões Recentes</h3>
            <Button variant="ghost" size="sm" className="text-xs h-7 text-muted-foreground" onClick={() => navigate('/meetings')}>
              Ver todas
            </Button>
          </div>
          <div className="space-y-2">
            {recentMeetings.map((m) => (
              <div key={m.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => navigate('/meetings')}>
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Video className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{m.titulo || 'Reunião'}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {m.vendedor_nome && <span className="text-xs text-muted-foreground">{m.vendedor_nome}</span>}
                    {m.vendedor_nome && <span className="text-muted-foreground">·</span>}
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {m.duracao_minutos > 0 ? `${m.duracao_minutos}min` : new Date(m.data_reuniao).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                    </span>
                    {m.meeting_code && (
                      <>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground font-mono">{m.meeting_code}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {m.vendedor_nome && (
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                      {m.vendedor_nome.split(' ')[0]}
                    </span>
                  )}
                  {m.score !== null && m.score !== undefined ? (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${m.score >= 85 ? 'score-excellent' : m.score >= 70 ? 'score-good' : 'score-average'}`}>
                      {m.score} pts
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                  {m.analisada_por_ia && (
                    <Brain className="w-3.5 h-3.5 text-accent" aria-label="Analisado por IA" />
                  )}
                </div>
              </div>
            ))}
            {recentMeetings.length === 0 && (
              <p className="text-xs text-muted-foreground p-2">
                {loadingMeetings ? 'Carregando reuniões...' : 'Sem reuniões cadastradas ainda. Sincronize na página de Reuniões.'}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
