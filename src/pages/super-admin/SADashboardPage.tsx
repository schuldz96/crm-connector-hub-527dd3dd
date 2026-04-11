import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSuperAdminAuth } from '@/contexts/SuperAdminAuthContext';
import { getDashboardStats, getDashboardChartData, getAdminAuditLogs } from '@/lib/superAdminService';
import type { DashboardStats, DashboardChartData, AdminAuditEntry } from '@/lib/superAdminService';
import { Badge } from '@/components/ui/badge';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Building2, Users, CreditCard, DollarSign, Loader2, AlertCircle, Clock, AlertTriangle } from 'lucide-react';

const CHART_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899'];

export default function SADashboardPage() {
  const { superAdmin } = useSuperAdminAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [chartData, setChartData] = useState<DashboardChartData | null>(null);
  const [recentLogs, setRecentLogs] = useState<AdminAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [s, charts, logs] = await Promise.all([
          getDashboardStats(),
          getDashboardChartData(),
          getAdminAuditLogs(10),
        ]);
        setStats(s);
        setChartData(charts);
        setRecentLogs(logs);
      } catch (err: any) {
        setError(err?.message ?? 'Erro ao carregar dados do dashboard');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const kpiCards = stats
    ? [
        {
          label: 'Total Organizacoes',
          value: String(stats.totalOrgs),
          icon: Building2,
          color: 'text-blue-400',
          bg: 'bg-blue-500/10',
          path: '/super-admin/organizations',
        },
        {
          label: 'Total Usuarios',
          value: String(stats.totalUsers),
          icon: Users,
          color: 'text-green-400',
          bg: 'bg-green-500/10',
          path: '/super-admin/users',
        },
        {
          label: 'Assinaturas Ativas',
          value: String(stats.totalActiveSubscriptions),
          icon: CreditCard,
          color: 'text-purple-400',
          bg: 'bg-purple-500/10',
          path: '/super-admin/plans',
        },
        {
          label: 'MRR',
          value: `R$ ${stats.mrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          icon: DollarSign,
          color: 'text-red-400',
          bg: 'bg-red-500/10',
          path: '/super-admin/organizations',
        },
      ]
    : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="sa-page-header">
        <h1 className="text-2xl font-display font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Bem-vindo, {superAdmin?.nome ?? 'Admin'}. Visao geral da plataforma.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* KPI Cards — Clickable */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sa-stagger-container">
        {kpiCards.map((kpi) => (
          <div
            key={kpi.label}
            onClick={() => navigate(kpi.path)}
            className="glass-card p-5 border border-border rounded-lg bg-card sa-card-hover cursor-pointer transition-transform hover:scale-[1.02]"
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${kpi.bg}`}>
                <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
              </div>
            </div>
            <p className="text-2xl font-display font-bold">{kpi.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Trial expirado alert */}
      {chartData && chartData.trialExpirados > 0 && (
        <div className="flex items-center gap-2 p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg text-sm text-orange-400">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {chartData.trialExpirados} trial{chartData.trialExpirados > 1 ? 's' : ''} expirado{chartData.trialExpirados > 1 ? 's' : ''}
        </div>
      )}

      {/* Charts */}
      {chartData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Plan Distribution — Pie Chart */}
          {chartData.planDistribution.length > 0 && (
            <div className="glass-card p-5 border border-border rounded-lg bg-card">
              <h3 className="text-base font-semibold mb-1">Distribuicao de Planos</h3>
              <p className="text-xs text-muted-foreground mb-4">Plano mais recente por organizacao</p>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={chartData.planDistribution}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={50}
                    strokeWidth={2}
                    stroke="hsl(var(--card))"
                    label={({ name, value }) => `${name} (${value})`}
                    labelLine={false}
                  >
                    {chartData.planDistribution.map((_, idx) => (
                      <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Org Status — Bar Chart */}
          <div className="glass-card p-5 border border-border rounded-lg bg-card">
            <h3 className="text-base font-semibold mb-1">Organizacoes por Status</h3>
            <p className="text-xs text-muted-foreground mb-4">Ativas vs Inativas</p>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData.orgStatus} barSize={60}>
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                  itemStyle={{ color: 'hsl(var(--foreground))' }}
                  cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  <Cell fill="#22c55e" />
                  <Cell fill="#ef4444" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="glass-card p-5 border border-border rounded-lg bg-card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold">Atividade Recente</h3>
            <p className="text-xs text-muted-foreground">Ultimos 10 registros de auditoria</p>
          </div>
        </div>

        {recentLogs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Nenhuma atividade registrada.
          </p>
        ) : (
          <div className="space-y-2">
            {recentLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-3 p-3 rounded-lg sa-table-row cursor-default"
              >
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{log.acao}</span>
                    {log.entidade_tipo && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {log.entidade_tipo}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                    <span>{new Date(log.criado_em).toLocaleString('pt-BR')}</span>
                    {log.ip_origem && <span>IP: {log.ip_origem}</span>}
                    {log.entidade_id && <span>ID: {log.entidade_id}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
