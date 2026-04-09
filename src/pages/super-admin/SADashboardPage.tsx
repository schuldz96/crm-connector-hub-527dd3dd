import { useState, useEffect } from 'react';
import { useSuperAdminAuth } from '@/contexts/SuperAdminAuthContext';
import { getDashboardStats, getAdminAuditLogs } from '@/lib/superAdminService';
import type { DashboardStats, AdminAuditEntry } from '@/lib/superAdminService';
import { Badge } from '@/components/ui/badge';
import { Building2, Users, CreditCard, DollarSign, Loader2, AlertCircle, Clock } from 'lucide-react';

export default function SADashboardPage() {
  const { superAdmin } = useSuperAdminAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentLogs, setRecentLogs] = useState<AdminAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [s, logs] = await Promise.all([
          getDashboardStats(),
          getAdminAuditLogs(10),
        ]);
        setStats(s);
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
        },
        {
          label: 'Total Usuarios',
          value: String(stats.totalUsers),
          icon: Users,
          color: 'text-green-400',
          bg: 'bg-green-500/10',
        },
        {
          label: 'Assinaturas Ativas',
          value: String(stats.totalActiveSubscriptions),
          icon: CreditCard,
          color: 'text-purple-400',
          bg: 'bg-purple-500/10',
        },
        {
          label: 'MRR',
          value: `R$ ${stats.mrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          icon: DollarSign,
          color: 'text-red-400',
          bg: 'bg-red-500/10',
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
      <div>
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi) => (
          <div
            key={kpi.label}
            className="glass-card p-5 border border-border rounded-lg bg-card"
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
                className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
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
