import { MOCK_MEETINGS, CHART_DATA } from '@/data/mockData';
import { Button } from '@/components/ui/button';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, Radar
} from 'recharts';
import { Download, FileText, TrendingUp, Users, Video, Star, Calendar, Filter } from 'lucide-react';

const RADAR_DATA = [
  { subject: 'Rapport', A: 87, B: 73, fullMark: 100 },
  { subject: 'Descoberta', A: 82, B: 68, fullMark: 100 },
  { subject: 'Apresentação', A: 90, B: 77, fullMark: 100 },
  { subject: 'Objeções', A: 79, B: 65, fullMark: 100 },
  { subject: 'Próx. Passos', A: 88, B: 70, fullMark: 100 },
];

const SELLER_PERF = [
  { name: 'Julia Lima', meetings: 18, score: 91, conversions: 9 },
  { name: 'Diego Alves', meetings: 15, score: 79, conversions: 6 },
  { name: 'Mariana Costa', meetings: 14, score: 72, conversions: 5 },
];

export default function ReportsPage() {
  return (
    <div className="page-container animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold">Relatórios</h1>
          <p className="text-sm text-muted-foreground">Análises detalhadas de performance</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="text-xs h-8 border-border">
            <Calendar className="w-3.5 h-3.5 mr-1.5" />
            Nov 2024
          </Button>
          <Button size="sm" className="bg-gradient-primary text-xs h-8">
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Exportar PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Bar Chart */}
        <div className="glass-card p-5">
          <div className="section-header">
            <div>
              <h3 className="section-title">Performance por Vendedor</h3>
              <p className="text-xs text-muted-foreground">Reuniões e conversões no mês</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={SELLER_PERF} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="meetings" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Reuniões" />
              <Bar dataKey="conversions" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} name="Conversões" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Radar Chart */}
        <div className="glass-card p-5">
          <div className="section-header">
            <div>
              <h3 className="section-title">Scorecard Médio</h3>
              <p className="text-xs text-muted-foreground">Comparativo Alpha vs Beta</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={RADAR_DATA}>
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
              <Radar name="Alpha" dataKey="A" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} />
              <Radar name="Beta" dataKey="B" stroke="hsl(var(--accent))" fill="hsl(var(--accent))" fillOpacity={0.2} />
              <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Conversion by Team */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="glass-card p-5">
          <h3 className="section-title mb-4">Taxa de Conversão</h3>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={CHART_DATA.conversionByTeam} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" paddingAngle={4}>
                {CHART_DATA.conversionByTeam.map((entry, index) => (
                  <Cell key={index} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {CHART_DATA.conversionByTeam.map(t => (
              <div key={t.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: t.fill }} />
                  <span className="text-muted-foreground">{t.name}</span>
                </div>
                <span className="font-semibold">{t.value}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Seller Summary Table */}
        <div className="glass-card p-5 lg:col-span-2">
          <h3 className="section-title mb-4">Resumo por Vendedor</h3>
          <table className="w-full data-table">
            <thead>
              <tr>
                <th className="text-left">Vendedor</th>
                <th className="text-center">Reuniões</th>
                <th className="text-center">Score Médio</th>
                <th className="text-center">Conversões</th>
                <th className="text-center">Taxa</th>
              </tr>
            </thead>
            <tbody>
              {SELLER_PERF.map((s, i) => (
                <tr key={s.name}>
                  <td>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
                      <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${s.name}`} alt={s.name} className="w-6 h-6 rounded-full" />
                      <span className="text-sm font-medium">{s.name}</span>
                    </div>
                  </td>
                  <td className="text-center text-sm">{s.meetings}</td>
                  <td className="text-center">
                    <span className={s.score >= 85 ? 'score-excellent' : s.score >= 70 ? 'score-good' : 'score-average'}>{s.score}</span>
                  </td>
                  <td className="text-center text-sm">{s.conversions}</td>
                  <td className="text-center">
                    <span className="text-sm font-medium">{((s.conversions / s.meetings) * 100).toFixed(0)}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
