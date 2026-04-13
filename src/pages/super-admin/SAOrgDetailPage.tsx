import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getOrgDetail, getOrgUsers, getOrgSubscription, getResourceUsage, getOrgStats,
  getAllPlans, createSubscription, updateSubscription,
} from '@/lib/superAdminService';
import type { Organization, Subscription, ResourceUsage, Plan } from '@/lib/superAdminService';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  ArrowLeft, Loader2, AlertCircle, Users, CreditCard, BarChart3, Pencil, XCircle,
} from 'lucide-react';

const statusColors: Record<string, string> = {
  ativa: 'bg-green-500/10 text-green-400 border-green-500/20',
  trial: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  cancelada: 'bg-red-500/10 text-red-400 border-red-500/20',
  suspensa: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  expirada: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
};

function getEffectiveStatus(sub: Subscription): string {
  if (sub.status === 'trial' && sub.trial_ate) {
    const trialEnd = new Date(sub.trial_ate);
    trialEnd.setHours(23, 59, 59, 999);
    if (trialEnd < new Date()) return 'expirada';
  }
  return sub.status;
}

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function SAOrgDetailPage() {
  const { org: orgKey } = useParams<{ org: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

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

  // Subscription CRUD state
  const [saving, setSaving] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansLoaded, setPlansLoaded] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formPlanoId, setFormPlanoId] = useState('');
  const [formCiclo, setFormCiclo] = useState('mensal');
  const [formStatus, setFormStatus] = useState('ativa');
  const [formTrialAte, setFormTrialAte] = useState('');

  const loadPlans = async () => {
    if (plansLoaded) return;
    const data = await getAllPlans();
    setPlans(data.filter(p => p.ativo));
    setPlansLoaded(true);
  };

  const handleCreateSubscription = async () => {
    if (!orgKey || !formPlanoId) return;
    if (formStatus === 'trial' && !formTrialAte) {
      toast({ title: 'Erro', description: 'Informe a data de fim do trial', variant: 'destructive' });
      return;
    }
    if (formStatus === 'trial' && formTrialAte && formTrialAte < getTodayStr()) {
      toast({ title: 'Erro', description: 'A data de fim do trial deve ser futura', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await createSubscription({
        org: orgKey,
        plano_id: formPlanoId,
        status: formStatus,
        ciclo: formCiclo,
        trial_ate: formStatus === 'trial' && formTrialAte ? formTrialAte : undefined,
      });
      toast({ title: 'Assinatura criada com sucesso' });
      setShowCreateForm(false);
      const updated = await getOrgSubscription(orgKey);
      setSubscription(updated);
    } catch (err: any) {
      toast({ title: 'Erro ao criar assinatura', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateSubscription = async () => {
    if (!subscription) return;
    if (formStatus === 'trial' && !formTrialAte) {
      toast({ title: 'Erro', description: 'Informe a data de fim do trial', variant: 'destructive' });
      return;
    }
    if (formStatus === 'trial' && formTrialAte && formTrialAte < getTodayStr()) {
      toast({ title: 'Erro', description: 'A data de fim do trial deve ser futura', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await updateSubscription(subscription.id, {
        plano_id: formPlanoId,
        ciclo: formCiclo,
        status: formStatus,
        trial_ate: formStatus === 'trial' && formTrialAte ? formTrialAte : null,
        // Reativação limpa cancelado_em; só permanece se a nova intenção for cancelar
        cancelado_em: formStatus === 'cancelada' ? (subscription.cancelado_em ?? new Date().toISOString()) : null,
        atualizado_em: new Date().toISOString(),
      });
      toast({ title: 'Assinatura atualizada com sucesso' });
      setEditMode(false);
      const updated = await getOrgSubscription(orgKey!);
      setSubscription(updated);
    } catch (err: any) {
      toast({ title: 'Erro ao atualizar assinatura', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!subscription) return;
    setSaving(true);
    try {
      await updateSubscription(subscription.id, {
        status: 'cancelada',
        cancelado_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString(),
      });
      toast({ title: 'Assinatura cancelada' });
      setShowCancelDialog(false);
      const updated = await getOrgSubscription(orgKey!);
      setSubscription(updated);
    } catch (err: any) {
      toast({ title: 'Erro ao cancelar assinatura', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const openEditMode = async () => {
    await loadPlans();
    if (subscription) {
      setFormPlanoId(subscription.plano_id);
      setFormCiclo(subscription.ciclo);
      setFormStatus(subscription.status);
      // trial_ate vem como ISO (YYYY-MM-DDTHH:mm:ss+TZ) — input[type=date] espera só YYYY-MM-DD
      setFormTrialAte(subscription.trial_ate?.slice(0, 10) ?? '');
    }
    setEditMode(true);
  };

  const openCreateForm = async () => {
    await loadPlans();
    setFormPlanoId('');
    setFormCiclo('mensal');
    setFormStatus('ativa');
    setFormTrialAte('');
    setShowCreateForm(true);
  };

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
            Plano: {subscription?.plano_nome || 'N/A'} | Dominio: {orgDetail.dominio || '—'}
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
              <p className="text-lg font-bold">{subscription ? getEffectiveStatus(subscription) : 'Sem assinatura'}</p>
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
            {/* State A: No subscription */}
            {!subscription && !showCreateForm && (
              <div className="text-center py-6">
                <p className="text-muted-foreground text-sm mb-4">
                  Nenhuma assinatura encontrada para esta organizacao.
                </p>
                <Button onClick={openCreateForm} className="bg-red-600 hover:bg-red-700 text-white">
                  Criar Assinatura
                </Button>
              </div>
            )}

            {/* Create Form */}
            {showCreateForm && (
              <div className="space-y-4 max-w-md">
                <h3 className="text-sm font-semibold">Nova Assinatura</h3>
                <div>
                  <Label className="text-sm mb-1.5 block">Plano *</Label>
                  <Select value={formPlanoId} onValueChange={setFormPlanoId}>
                    <SelectTrigger className="bg-input border-border">
                      <SelectValue placeholder="Selecione o plano" />
                    </SelectTrigger>
                    <SelectContent>
                      {plans.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome} — R$ {p.preco_mensal?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mes
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm mb-1.5 block">Ciclo</Label>
                    <Select value={formCiclo} onValueChange={setFormCiclo}>
                      <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mensal">Mensal</SelectItem>
                        <SelectItem value="anual">Anual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm mb-1.5 block">Status</Label>
                    <Select value={formStatus} onValueChange={setFormStatus}>
                      <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ativa">Ativa</SelectItem>
                        <SelectItem value="trial">Trial</SelectItem>
                        <SelectItem value="suspensa">Suspensa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {formStatus === 'trial' && (
                  <div>
                    <Label className="text-sm mb-1.5 block">Trial ate</Label>
                    <Input type="date" value={formTrialAte} onChange={(e) => setFormTrialAte(e.target.value)} className="bg-input border-border" />
                  </div>
                )}
                <div className="flex gap-2">
                  <Button onClick={handleCreateSubscription} disabled={saving || !formPlanoId} className="bg-red-600 hover:bg-red-700 text-white">
                    {saving ? 'Salvando...' : 'Criar'}
                  </Button>
                  <Button variant="outline" onClick={() => setShowCreateForm(false)} disabled={saving}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}

            {/* State B: Subscription exists, view mode */}
            {subscription && !editMode && (
              <div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Plano</p>
                    <p className="text-sm font-medium">{subscription.plano_nome ?? subscription.plano_id}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Status</p>
                    <Badge className={statusColors[getEffectiveStatus(subscription)] ?? statusColors.suspensa}>
                      {getEffectiveStatus(subscription)}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Ciclo</p>
                    <p className="text-sm font-medium">{subscription.ciclo}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Inicio</p>
                    <p className="text-sm font-medium">{new Date(subscription.inicio_em).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Vencimento</p>
                    <p className="text-sm font-medium">
                      {subscription.proximo_pagamento ? new Date(subscription.proximo_pagamento).toLocaleDateString('pt-BR') : '—'}
                    </p>
                  </div>
                  {subscription.trial_ate && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Trial ate</p>
                      <p className="text-sm font-medium">{new Date(subscription.trial_ate).toLocaleDateString('pt-BR')}</p>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 mt-6">
                  <Button variant="outline" size="sm" onClick={openEditMode}>
                    <Pencil className="w-4 h-4 mr-2" /> Editar
                  </Button>
                  {subscription.status !== 'cancelada' && (
                    <Button variant="outline" size="sm" className="text-red-400 hover:text-red-300 border-red-500/20" onClick={() => setShowCancelDialog(true)}>
                      <XCircle className="w-4 h-4 mr-2" /> Cancelar Assinatura
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* State C: Subscription exists, edit mode */}
            {subscription && editMode && (
              <div className="space-y-4 max-w-md">
                <h3 className="text-sm font-semibold">Editar Assinatura</h3>
                <div>
                  <Label className="text-sm mb-1.5 block">Plano</Label>
                  <Select value={formPlanoId} onValueChange={setFormPlanoId}>
                    <SelectTrigger className="bg-input border-border">
                      <SelectValue placeholder="Selecione o plano" />
                    </SelectTrigger>
                    <SelectContent>
                      {plans.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome} — R$ {p.preco_mensal?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mes
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm mb-1.5 block">Ciclo</Label>
                    <Select value={formCiclo} onValueChange={setFormCiclo}>
                      <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mensal">Mensal</SelectItem>
                        <SelectItem value="anual">Anual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm mb-1.5 block">Status</Label>
                    <Select value={formStatus} onValueChange={setFormStatus}>
                      <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ativa">Ativa</SelectItem>
                        <SelectItem value="trial">Trial</SelectItem>
                        <SelectItem value="suspensa">Suspensa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {formStatus === 'trial' && (
                  <div>
                    <Label className="text-sm mb-1.5 block">Trial ate</Label>
                    <Input type="date" value={formTrialAte} onChange={(e) => setFormTrialAte(e.target.value)} className="bg-input border-border" />
                  </div>
                )}
                <div className="flex gap-2">
                  <Button onClick={handleUpdateSubscription} disabled={saving} className="bg-red-600 hover:bg-red-700 text-white">
                    {saving ? 'Salvando...' : 'Salvar'}
                  </Button>
                  <Button variant="outline" onClick={() => setEditMode(false)} disabled={saving}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Cancel Confirmation Dialog */}
          <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Cancelar Assinatura</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                Tem certeza que deseja cancelar a assinatura desta organizacao? Esta acao ira definir o status como "cancelada".
              </p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCancelDialog(false)} disabled={saving}>
                  Voltar
                </Button>
                <Button onClick={handleCancelSubscription} disabled={saving} className="bg-red-600 hover:bg-red-700 text-white">
                  {saving ? 'Cancelando...' : 'Confirmar Cancelamento'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
