import { useMemo, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { MOCK_MEETINGS, CHART_DATA } from '@/data/mockData';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import {
  Video, MessageSquare, TrendingUp, Star, ArrowUp, ArrowDown,
  MoreHorizontal, Calendar, Clock, Users, Target, Zap, Brain
} from 'lucide-react';

const colorMap: Record<string, string> = {
  violet: 'hsl(261 86% 68%)',
  lavender: 'hsl(258 55% 76%)',
  purple: 'hsl(270 76% 62%)',
  graphite: 'hsl(255 8% 63%)',
};

const statusStyle: Record<string, string> = {
  completed: 'score-good',
  scheduled: 'score-excellent',
  cancelled: 'score-poor',
  no_show: 'score-average',
};
const statusLabel: Record<string, string> = {
  completed: 'Concluída',
  scheduled: 'Agendada',
  cancelled: 'Cancelada',
  no_show: 'No-show',
};

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const meetingsThisMonth = useMemo(() => {
    const now = new Date();
    return MOCK_MEETINGS.filter(m => {
      const d = new Date(m.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
  }, []);
  const avgScore = useMemo(() => {
    const completedWithScore = MOCK_MEETINGS.filter(m => typeof m.score === 'number');
    if (!completedWithScore.length) return 0;
    return Number((completedWithScore.reduce((sum, m) => sum + (m.score || 0), 0) / completedWithScore.length).toFixed(1));
  }, []);
  const conversionRate = useMemo(() => {
    const completed = MOCK_MEETINGS.filter(m => m.status === 'completed').length;
    if (!MOCK_MEETINGS.length) return 0;
    return Number(((completed / MOCK_MEETINGS.length) * 100).toFixed(1));
  }, []);
  const recentMeetings = useMemo(() => MOCK_MEETINGS.slice(0, 5), []);
  const topSellers = useMemo(() => {
    const bySeller = new Map<string, { name: string; meetings: number; scoreSum: number; scoreCount: number }>();
    for (const m of MOCK_MEETINGS) {
      const cur = bySeller.get(m.sellerId) || { name: m.sellerName, meetings: 0, scoreSum: 0, scoreCount: 0 };
      cur.meetings += 1;
      if (typeof m.score === 'number') {
        cur.scoreSum += m.score;
        cur.scoreCount += 1;
      }
      bySeller.set(m.sellerId, cur);
    }
    return Array.from(bySeller.values())
      .map(s => ({
        name: s.name,
        meetings: s.meetings,
        score: s.scoreCount ? Math.round(s.scoreSum / s.scoreCount) : 0,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(s.name)}`,
        trend: 'up' as const,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);
  }, []);

  const kpiCards = [
    { label: 'Reuniões este mês', value: String(meetingsThisMonth), change: 0, icon: Video, color: 'violet', unit: '' },
    { label: 'Score médio', value: String(avgScore || 0), change: 0, icon: Star, color: 'lavender', unit: 'pts' },
    { label: 'Taxa de conversão', value: String(conversionRate || 0), change: 0, icon: TrendingUp, color: 'purple', unit: '%' },
    { label: 'Conversas ativas', value: '0', change: 0, icon: MessageSquare, color: 'graphite', unit: '' },
  ];

  return (
    <div className="page-container space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">
            Olá, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Aqui está o resumo de performance da sua equipe hoje.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="text-xs h-8 border-border">
            <Calendar className="w-3.5 h-3.5 mr-1.5" />
            Mar 2026
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
              <span className={`flex items-center gap-0.5 text-xs font-medium ${kpi.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {kpi.change >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                {Math.abs(kpi.change)}{kpi.unit === '%' ? 'pp' : '%'}
              </span>
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
              <h3 className="section-title">Reuniões & Conversões</h3>
              <p className="text-xs text-muted-foreground">Últimos 6 meses</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={CHART_DATA.meetingsPerMonth}>
              <defs>
                <linearGradient id="gradBlue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(261 86% 68%)" stopOpacity={0.34} />
                  <stop offset="95%" stopColor="hsl(261 86% 68%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradGreen" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(258 55% 76%)" stopOpacity={0.34} />
                  <stop offset="95%" stopColor="hsl(258 55% 76%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Area type="monotone" dataKey="meetings" stroke="hsl(261 86% 68%)" fill="url(#gradBlue)" strokeWidth={2.2} name="Reuniões" />
              <Area type="monotone" dataKey="conversions" stroke="hsl(258 55% 76%)" fill="url(#gradGreen)" strokeWidth={2.2} name="Conversões" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Score Evolution */}
        <div className="glass-card p-5">
          <div className="section-header">
            <div>
              <h3 className="section-title">Score por Vendedor</h3>
              <p className="text-xs text-muted-foreground">Últimas 4 semanas</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={CHART_DATA.scoreEvolution}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="week" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} domain={[60, 100]} />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
              />
              <Line type="monotone" dataKey="julia" stroke="hsl(261 86% 68%)" strokeWidth={2.2} dot={{ r: 3 }} name="Julia" />
              <Line type="monotone" dataKey="diego" stroke="hsl(258 55% 76%)" strokeWidth={2.2} dot={{ r: 3 }} name="Diego" />
              <Line type="monotone" dataKey="mariana" stroke="hsl(270 76% 62%)" strokeWidth={2.2} dot={{ r: 3 }} name="Mariana" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Ranking */}
        <div className="glass-card p-5">
          <div className="section-header">
            <h3 className="section-title">🏆 Ranking</h3>
            <Button variant="ghost" size="sm" className="text-xs h-7 text-muted-foreground" onClick={() => navigate('/performance')}>
              Ver todos
            </Button>
          </div>
          <div className="space-y-3">
            {topSellers.map((seller, i) => (
              <div key={seller.name} className="flex items-center gap-3">
                <span className={`text-sm font-bold w-5 text-center ${i === 0 ? 'text-yellow-400' : 'text-muted-foreground'}`}>
                  {i + 1}
                </span>
                <img src={seller.avatar} alt={seller.name} className="w-8 h-8 rounded-full border border-border" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{seller.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Progress value={seller.score} className="h-1 flex-1" />
                    <span className="text-xs text-muted-foreground">{seller.score}</span>
                  </div>
                </div>
                <span className={`text-xs ${seller.trend === 'up' ? 'text-green-400' : 'text-red-400'}`}>
                  {seller.trend === 'up' ? '↑' : '↓'}
                </span>
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
                  <p className="text-sm font-medium truncate">{m.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground">{m.sellerName}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />{m.duration}min
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {m.score && (
                    <span className={m.score >= 85 ? 'score-excellent' : m.score >= 70 ? 'score-good' : 'score-average'}>
                      {m.score}
                    </span>
                  )}
                  {m.aiAnalyzed && (
                    <Brain className="w-3.5 h-3.5 text-accent" aria-label="Analisado por IA" />
                  )}
                  <span className={statusStyle[m.status]}>{statusLabel[m.status]}</span>
                </div>
              </div>
            ))}
            {recentMeetings.length === 0 && (
              <p className="text-xs text-muted-foreground p-2">Sem reuniões cadastradas ainda.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
