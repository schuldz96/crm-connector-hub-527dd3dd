import { useState, useEffect, useMemo } from 'react';
import {
  getAllSubscriptions, createSubscription, updateSubscription,
  getAllOrganizations, getAllPlans,
} from '@/lib/superAdminService';
import type { Subscription, Organization, Plan } from '@/lib/superAdminService';
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
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Loader2, AlertCircle, CreditCard, Plus, Pencil, XCircle } from 'lucide-react';

const statusColors: Record<string, string> = {
  ativa: 'bg-green-500/10 text-green-400 border-green-500/20',
  trial: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  cancelada: 'bg-red-500/10 text-red-400 border-red-500/20',
  suspensa: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  expirada: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
};

const emptyForm = { org: '', plano_id: '', ciclo: 'mensal', status: 'ativa', trial_ate: '' };

export default function SASubscriptionsPage() {
  const { toast } = useToast();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Cancel confirm
  const [cancelId, setCancelId] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [subs, orgList, planList] = await Promise.all([
        getAllSubscriptions(),
        getAllOrganizations(),
        getAllPlans(),
      ]);
      setSubscriptions(subs);
      setOrgs(orgList);
      setPlans(planList.filter((p) => p.ativo));
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  const statuses = useMemo(() => {
    const set = new Set(subscriptions.map((s) => s.status).filter(Boolean));
    return Array.from(set).sort();
  }, [subscriptions]);

  const filtered = useMemo(() => {
    if (filterStatus === 'all') return subscriptions;
    return subscriptions.filter((s) => s.status === filterStatus);
  }, [subscriptions, filterStatus]);

  function openCreate() {
    setForm({ ...emptyForm });
    setEditingId(null);
    setDialogOpen(true);
  }

  function openEdit(sub: Subscription) {
    setForm({
      org: sub.org,
      plano_id: sub.plano_id,
      ciclo: sub.ciclo,
      status: sub.status,
      trial_ate: sub.trial_ate ?? '',
    });
    setEditingId(sub.id);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.org || !form.plano_id) {
      toast({ title: 'Erro', description: 'Organizacao e plano sao obrigatorios', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await updateSubscription(editingId, {
          plano_id: form.plano_id,
          ciclo: form.ciclo,
          status: form.status,
          trial_ate: form.trial_ate || null,
          atualizado_em: new Date().toISOString(),
        });
        toast({ title: 'Assinatura atualizada com sucesso' });
      } else {
        await createSubscription({
          org: form.org,
          plano_id: form.plano_id,
          ciclo: form.ciclo,
          status: form.status,
          trial_ate: form.trial_ate || undefined,
        });
        toast({ title: 'Assinatura criada com sucesso' });
      }
      setDialogOpen(false);
      await loadData();
    } catch (err: any) {
      toast({ title: 'Erro', description: err?.message ?? 'Erro ao salvar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel(id: string) {
    setSaving(true);
    try {
      await updateSubscription(id, {
        status: 'cancelada',
        cancelado_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString(),
      });
      toast({ title: 'Assinatura cancelada' });
      setCancelId(null);
      await loadData();
    } catch (err: any) {
      toast({ title: 'Erro', description: err?.message ?? 'Erro ao cancelar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  function getOrgName(orgKey: string) {
    const org = orgs.find((o) => o.org === orgKey);
    return org ? `${org.nome} (${orgKey})` : orgKey;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-red-500" />
            Assinaturas
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {subscriptions.length} assinaturas registradas
          </p>
        </div>
        <Button onClick={openCreate} className="bg-red-600 hover:bg-red-700 text-white">
          <Plus className="w-4 h-4 mr-2" /> Nova Assinatura
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px] bg-input border-border">
            <SelectValue placeholder="Todos os status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {statuses.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="glass-card border border-border rounded-lg bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Org</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ciclo</TableHead>
              <TableHead>Inicio</TableHead>
              <TableHead>Trial Ate</TableHead>
              <TableHead className="w-24">Acoes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Nenhuma assinatura encontrada.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((sub) => (
                <TableRow key={sub.id}>
                  <TableCell className="font-mono text-sm">{getOrgName(sub.org)}</TableCell>
                  <TableCell className="font-medium">{sub.plano_nome ?? sub.plano_id}</TableCell>
                  <TableCell>
                    <Badge className={statusColors[sub.status] ?? statusColors.expirada}>
                      {sub.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{sub.ciclo}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(sub.inicio_em).toLocaleDateString('pt-BR')}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {sub.trial_ate
                      ? new Date(sub.trial_ate).toLocaleDateString('pt-BR')
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(sub)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      {sub.status !== 'cancelada' && (
                        <Button variant="ghost" size="sm" onClick={() => setCancelId(sub.id)} className="text-red-400 hover:text-red-300">
                          <XCircle className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        Exibindo {filtered.length} de {subscriptions.length} assinaturas
      </p>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Assinatura' : 'Nova Assinatura'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm mb-1.5 block">Organizacao *</Label>
              <Select
                value={form.org}
                onValueChange={(val) => setForm((prev) => ({ ...prev, org: val }))}
                disabled={!!editingId}
              >
                <SelectTrigger className="bg-input border-border">
                  <SelectValue placeholder="Selecione a organizacao" />
                </SelectTrigger>
                <SelectContent>
                  {orgs.map((o) => (
                    <SelectItem key={o.org} value={o.org}>
                      {o.nome} ({o.org})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm mb-1.5 block">Plano *</Label>
              <Select
                value={form.plano_id}
                onValueChange={(val) => setForm((prev) => ({ ...prev, plano_id: val }))}
              >
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
                <Select
                  value={form.ciclo}
                  onValueChange={(val) => setForm((prev) => ({ ...prev, ciclo: val }))}
                >
                  <SelectTrigger className="bg-input border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mensal">Mensal</SelectItem>
                    <SelectItem value="anual">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm mb-1.5 block">Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(val) => setForm((prev) => ({ ...prev, status: val }))}
                >
                  <SelectTrigger className="bg-input border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativa">Ativa</SelectItem>
                    <SelectItem value="trial">Trial</SelectItem>
                    <SelectItem value="suspensa">Suspensa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.status === 'trial' && (
              <div>
                <Label className="text-sm mb-1.5 block">Trial ate</Label>
                <Input
                  type="date"
                  value={form.trial_ate}
                  onChange={(e) => setForm((prev) => ({ ...prev, trial_ate: e.target.value }))}
                  className="bg-input border-border"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-red-600 hover:bg-red-700 text-white">
              {saving ? 'Salvando...' : editingId ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={!!cancelId} onOpenChange={() => setCancelId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cancelar Assinatura</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja cancelar esta assinatura? Esta acao nao pode ser desfeita.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelId(null)} disabled={saving}>
              Voltar
            </Button>
            <Button
              onClick={() => cancelId && handleCancel(cancelId)}
              disabled={saving}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {saving ? 'Cancelando...' : 'Confirmar Cancelamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
