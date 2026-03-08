import { MOCK_MEETINGS, MOCK_USERS, CHART_DATA } from '@/data/mockData';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
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

const KPI_CARDS = [
  { label: 'Reuniões este mês', value: '47', change: +12, icon: Video, color: 'blue', unit: '' },
  { label: 'Score médio', value: '79.4', change: +5.2, icon: Star, color: 'green', unit: 'pts' },
  { label: 'Taxa de conversão', value: '44.7', change: +3.1, icon: TrendingUp, color: 'purple', unit: '%' },
  { label: 'Conversas ativas', value: '28', change: -2, icon: MessageSquare, color: 'orange', unit: '' },
];

const colorMap: Record<string, string> = {
  blue: 'hsl(210 100% 56%)',
  green: 'hsl(168 80% 42%)',
  purple: 'hsl(270 80% 65%)',
  orange: 'hsl(38 92% 50%)',
};

const TOP_SELLERS = [
  { name: 'Julia Lima', score: 91, meetings: 18, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Julia', trend: 'up' },
  { name: 'Diego Alves', score: 79, meetings: 15, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Diego', trend: 'up' },
  { name: 'Mariana Costa', score: 72, meetings: 14, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Mariana', trend: 'down' },
  { name: 'Felipe Rocha', score: 68, meetings: 9, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felipe', trend: 'down' },
];

const RECENT_MEETINGS = MOCK_MEETINGS.slice(0, 5);

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
            Nov 2024
          </Button>
          <Button size="sm" className="text-xs h-8 bg-gradient-primary">
            <Zap className="w-3.5 h-3.5 mr-1.5" />
            Gerar Relatório IA
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {KPI_CARDS.map((kpi) => (
          <div key={kpi.label} className="kpi-card" style={{ '--kpi-color': colorMap[kpi.color] } as React.CSSProperties}>
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
                  <stop offset="5%" stopColor="hsl(210 100% 56%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(210 100% 56%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradGreen" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(168 80% 42%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(168 80% 42%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Area type="monotone" dataKey="meetings" stroke="hsl(210 100% 56%)" fill="url(#gradBlue)" strokeWidth={2} name="Reuniões" />
              <Area type="monotone" dataKey="conversions" stroke="hsl(168 80% 42%)" fill="url(#gradGreen)" strokeWidth={2} name="Conversões" />
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
              <Line type="monotone" dataKey="julia" stroke="hsl(210 100% 56%)" strokeWidth={2} dot={{ r: 3 }} name="Julia" />
              <Line type="monotone" dataKey="diego" stroke="hsl(168 80% 42%)" strokeWidth={2} dot={{ r: 3 }} name="Diego" />
              <Line type="monotone" dataKey="mariana" stroke="hsl(270 80% 65%)" strokeWidth={2} dot={{ r: 3 }} name="Mariana" />
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
            <Button variant="ghost" size="sm" className="text-xs h-7 text-muted-foreground">Ver todos</Button>
          </div>
          <div className="space-y-3">
            {TOP_SELLERS.map((seller, i) => (
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
          </div>
        </div>

        {/* Recent Meetings */}
        <div className="glass-card p-5 lg:col-span-2">
          <div className="section-header">
            <h3 className="section-title">Reuniões Recentes</h3>
            <Button variant="ghost" size="sm" className="text-xs h-7 text-muted-foreground">Ver todas</Button>
          </div>
          <div className="space-y-2">
            {RECENT_MEETINGS.map((m) => (
              <div key={m.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
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
          </div>
        </div>
      </div>
    </div>
  );
}
