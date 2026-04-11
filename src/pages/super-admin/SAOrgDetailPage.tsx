import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getOrgDetail, getOrgUsers, getOrgSubscription, getResourceUsage, getOrgStats,
} from '@/lib/superAdminService';
import type { Organization, Subscription, ResourceUsage } from '@/lib/superAdminService';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  ArrowLeft, Loader2, AlertCircle, Users, CreditCard, BarChart3,
} from 'lucide-react';

export default function SAOrgDetailPage() {
  const { org: orgKey } = useParams<{ org: string }>();
  const navigate = useNavigate();

  const [orgDetail, setOrgDetail] = useState<Organization | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<ResourceUsage[]>([]);
  const [orgStats, setOrgStats] = useState<{ totalUsers: number; activeUsers: number }>({
    totalUsers: 0,
    activeUsers: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!orgKey) return;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [detail, usersList, sub, usageData, stats] = await Promise.all([
          getOrgDetail(orgKey!),
          getOrgUsers(orgKey!),
          getOrgSubscription(orgKey!),
          getResourceUsage(orgKey!),
          getOrgStats(orgKey!),
        ]);
        setOrgDetail(detail);
        setUsers(usersList);
        setSubscription(sub);
        setUsage(usageData);
        setOrgStats(stats);
      } catch (err: any) {
        setError(err?.message ?? 'Erro ao carregar detalhes da organizacao');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [orgKey]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!orgDetail) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/super-admin/organizations')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
        </Button>
        <p className="text-muted-foreground">Organizacao nao encontrada.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/super-admin/organizations')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-display font-bold">{orgDetail.nome}</h1>
            <Badge variant="outline" className="text-xs font-mono">
              {orgDetail.org}
            </Badge>
            <Badge
              className={
                orgDetail.ativo
                  ? 'bg-green-500/10 text-green-400 border-green-500/20'
                  : 'bg-red-500/10 text-red-400 border-red-500/20'
              }
            >
              {orgDetail.ativo ? 'Ativo' : 'Inativo'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Plano: {orgDetail.plano || 'N/A'} | Dominio: {orgDetail.dominio || '—'}
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sa-stagger-container">
        <div className="glass-card p-4 border border-border rounded-lg bg-card sa-card-hover cursor-default">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <p className="text-lg font-bold">
                {orgStats.activeUsers} / {orgStats.totalUsers}
              </p>
              <p className="text-xs text-muted-foreground">Usuarios ativos / total</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4 border border-border rounded-lg bg-card sa-card-hover cursor-default">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <CreditCard className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <p className="text-lg font-bold">{subscription?.status ?? 'Sem assinatura'}</p>
              <p className="text-xs text-muted-foreground">
                {subscription ? `Plano: ${subscription.plano_nome ?? subscription.plano_id}` : 'Status da assinatura'}
              </p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4 border border-border rounded-lg bg-card sa-card-hover cursor-default">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-green-400" />
            </div>
            <div>
              <p className="text-lg font-bold">{usage.length}</p>
              <p className="text-xs text-muted-foreground">Registros de uso</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="users" className="w-full">
        <TabsList>
          <TabsTrigger value="users">Usuarios</TabsTrigger>
          <TabsTrigger value="subscription">Assinatura</TabsTrigger>
          <TabsTrigger value="usage">Uso</TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users">
          <div className="glass-card border border-border rounded-lg bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ultimo Login</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Nenhum usuario nesta organizacao.
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((u: any) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.nome || '—'}</TableCell>
                      <TableCell className="text-muted-foreground">{u.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {u.papel || 'N/A'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            u.status === 'ativo'
                              ? 'bg-green-500/10 text-green-400 border-green-500/20'
                              : 'bg-red-500/10 text-red-400 border-red-500/20'
                          }
                        >
                          {u.status || 'N/A'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {u.ultimo_login_em
                          ? new Date(u.ultimo_login_em).toLocaleString('pt-BR')
                          : 'Nunca'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Subscription Tab */}
        <TabsContent value="subscription">
          <div className="glass-card p-6 border border-border rounded-lg bg-card">
            {subscription ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Plano</p>
                  <p className="text-sm font-medium">
                    {subscription.plano_nome ?? subscription.plano_id}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Status</p>
                  <Badge
                    className={
                      subscription.status === 'ativa'
                        ? 'bg-green-500/10 text-green-400 border-green-500/20'
                        : subscription.status === 'trial'
                          ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                          : 'bg-red-500/10 text-red-400 border-red-500/20'
                    }
                  >
                    {subscription.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Ciclo</p>
                  <p className="text-sm font-medium">{subscription.ciclo}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Inicio</p>
                  <p className="text-sm font-medium">
                    {new Date(subscription.inicio_em).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                {subscription.trial_ate && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Trial ate</p>
                    <p className="text-sm font-medium">
                      {new Date(subscription.trial_ate).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-4">
                Nenhuma assinatura encontrada para esta organizacao.
              </p>
            )}
          </div>
        </TabsContent>

        {/* Usage Tab */}
        <TabsContent value="usage">
          <div className="glass-card border border-border rounded-lg bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mes</TableHead>
                  <TableHead>Usuarios Ativos</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Avaliacoes IA</TableHead>
                  <TableHead>Storage (MB)</TableHead>
                  <TableHead>Mensagens</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usage.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Nenhum registro de uso disponivel.
                    </TableCell>
                  </TableRow>
                ) : (
                  usage.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-mono text-sm">{u.mes_ref}</TableCell>
                      <TableCell>{u.usuarios_ativos}</TableCell>
                      <TableCell>{u.instancias_whatsapp}</TableCell>
                      <TableCell>{u.avaliacoes_ia}</TableCell>
                      <TableCell>{u.storage_usado_mb.toLocaleString('pt-BR')}</TableCell>
                      <TableCell>{u.mensagens_enviadas.toLocaleString('pt-BR')}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
