import { useState, useEffect } from 'react';
import { getAllPlans, createPlan, updatePlan } from '@/lib/superAdminService';
import type { Plan } from '@/lib/superAdminService';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Loader2, AlertCircle, Plus, Pencil, Package, UserPlus } from 'lucide-react';

const emptyPlan: Partial<Plan> = {
  nome: '',
  codigo: '',
  descricao: '',
  preco_mensal: 0,
  preco_anual: 0,
  preco_por_usuario: 0,
  min_usuarios: 1,
  max_usuarios: 10,
  max_instancias_whatsapp: 1,
  max_avaliacoes_ia_mes: 100,
  storage_mb: 1024,
  permite_venda_modulo: false,
  ativo: true,
};

export default function SAPlansPage() {
  const { toast } = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Partial<Plan>>(emptyPlan);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPlans();
  }, []);

  async function loadPlans() {
    setLoading(true);
    setError('');
    try {
      const data = await getAllPlans();
      setPlans(data);
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao carregar planos');
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditingPlan({ ...emptyPlan });
    setIsEditing(false);
    setDialogOpen(true);
  }

  function openEdit(plan: Plan) {
    setEditingPlan({ ...plan });
    setIsEditing(true);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!editingPlan.nome || !editingPlan.codigo) {
      toast({ title: 'Erro', description: 'Nome e codigo sao obrigatorios', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      if (isEditing && editingPlan.id) {
        const { id, ...updates } = editingPlan;
        await updatePlan(id, updates);
        toast({ title: 'Plano atualizado com sucesso' });
      } else {
        await createPlan(editingPlan);
        toast({ title: 'Plano criado com sucesso' });
      }
      setDialogOpen(false);
      await loadPlans();
    } catch (err: any) {
      toast({ title: 'Erro', description: err?.message ?? 'Erro ao salvar plano', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  function updateField(field: keyof Plan, value: any) {
    setEditingPlan((prev) => ({ ...prev, [field]: value }));
  }

  function formatBRL(value: number) {
    return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
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
            <Package className="w-6 h-6 text-red-500" />
            Planos
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{plans.length} planos cadastrados</p>
        </div>
        <Button onClick={openCreate} className="bg-red-600 hover:bg-red-700 text-white">
          <Plus className="w-4 h-4 mr-2" /> Novo Plano
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="glass-card border border-border rounded-lg bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Codigo</TableHead>
              <TableHead>Plataforma</TableHead>
              <TableHead>Por Usuario</TableHead>
              <TableHead>Min / Max Users</TableHead>
              <TableHead>WhatsApp</TableHead>
              <TableHead>IA/mes</TableHead>
              <TableHead>Storage</TableHead>
              <TableHead>Venda Modulo</TableHead>
              <TableHead>Ativo</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plans.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                  Nenhum plano cadastrado.
                </TableCell>
              </TableRow>
            ) : (
              plans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell className="font-medium">{plan.nome}</TableCell>
                  <TableCell className="font-mono text-xs">{plan.codigo}</TableCell>
                  <TableCell>{formatBRL(plan.preco_mensal)}</TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1">
                      <UserPlus className="w-3 h-3 text-muted-foreground" />
                      {formatBRL(plan.preco_por_usuario ?? 0)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs">{plan.min_usuarios ?? 1} / {plan.max_usuarios}</span>
                  </TableCell>
                  <TableCell>{plan.max_instancias_whatsapp}</TableCell>
                  <TableCell>{plan.max_avaliacoes_ia_mes.toLocaleString('pt-BR')}</TableCell>
                  <TableCell>{plan.storage_mb.toLocaleString('pt-BR')} MB</TableCell>
                  <TableCell>
                    <Badge className={
                      plan.permite_venda_modulo
                        ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                        : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                    }>
                      {plan.permite_venda_modulo ? 'Sim' : 'Nao'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={
                      plan.ativo
                        ? 'bg-green-500/10 text-green-400 border-green-500/20'
                        : 'bg-red-500/10 text-red-400 border-red-500/20'
                    }>
                      {plan.ativo ? 'Sim' : 'Nao'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(plan)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Editar Plano' : 'Novo Plano'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            {/* Nome + Codigo */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm mb-1.5 block">Nome</Label>
                <Input value={editingPlan.nome ?? ''} onChange={(e) => updateField('nome', e.target.value)} className="bg-input border-border" />
              </div>
              <div>
                <Label className="text-sm mb-1.5 block">Codigo</Label>
                <Input value={editingPlan.codigo ?? ''} onChange={(e) => updateField('codigo', e.target.value)} className="bg-input border-border" />
              </div>
            </div>

            {/* Descricao */}
            <div>
              <Label className="text-sm mb-1.5 block">Descricao</Label>
              <Input value={editingPlan.descricao ?? ''} onChange={(e) => updateField('descricao', e.target.value)} className="bg-input border-border" />
            </div>

            {/* Pricing */}
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-2">Precificacao</p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-sm mb-1.5 block">Plataforma/mes (R$)</Label>
                <Input type="number" value={editingPlan.preco_mensal ?? 0} onChange={(e) => updateField('preco_mensal', Number(e.target.value))} className="bg-input border-border" />
              </div>
              <div>
                <Label className="text-sm mb-1.5 block">Plataforma/ano (R$)</Label>
                <Input type="number" value={editingPlan.preco_anual ?? 0} onChange={(e) => updateField('preco_anual', Number(e.target.value))} className="bg-input border-border" />
              </div>
              <div>
                <Label className="text-sm mb-1.5 block">Por usuario/mes (R$)</Label>
                <Input type="number" value={editingPlan.preco_por_usuario ?? 0} onChange={(e) => updateField('preco_por_usuario', Number(e.target.value))} className="bg-input border-border" />
              </div>
            </div>

            {/* Limites */}
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-2">Limites</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm mb-1.5 block">Min Usuarios</Label>
                <Input type="number" value={editingPlan.min_usuarios ?? 1} onChange={(e) => updateField('min_usuarios', Number(e.target.value))} className="bg-input border-border" />
              </div>
              <div>
                <Label className="text-sm mb-1.5 block">Max Usuarios</Label>
                <Input type="number" value={editingPlan.max_usuarios ?? 0} onChange={(e) => updateField('max_usuarios', Number(e.target.value))} className="bg-input border-border" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm mb-1.5 block">Max WhatsApp</Label>
                <Input type="number" value={editingPlan.max_instancias_whatsapp ?? 0} onChange={(e) => updateField('max_instancias_whatsapp', Number(e.target.value))} className="bg-input border-border" />
              </div>
              <div>
                <Label className="text-sm mb-1.5 block">Max Avaliacoes IA/mes</Label>
                <Input type="number" value={editingPlan.max_avaliacoes_ia_mes ?? 0} onChange={(e) => updateField('max_avaliacoes_ia_mes', Number(e.target.value))} className="bg-input border-border" />
              </div>
            </div>
            <div>
              <Label className="text-sm mb-1.5 block">Storage (MB)</Label>
              <Input type="number" value={editingPlan.storage_mb ?? 0} onChange={(e) => updateField('storage_mb', Number(e.target.value))} className="bg-input border-border" />
            </div>

            {/* Toggles */}
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-2">Opcoes</p>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Switch checked={editingPlan.permite_venda_modulo ?? false} onCheckedChange={(val) => updateField('permite_venda_modulo', val)} />
                <Label className="text-sm">Permite venda por modulo individual</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editingPlan.ativo ?? true} onCheckedChange={(val) => updateField('ativo', val)} />
                <Label className="text-sm">Ativo</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-red-600 hover:bg-red-700 text-white">
              {saving ? 'Salvando...' : isEditing ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
