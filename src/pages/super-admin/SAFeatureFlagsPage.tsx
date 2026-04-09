import { useState, useEffect } from 'react';
import {
  getFeatureFlags, updateFeatureFlag, createFeatureFlag, getAllPlans,
} from '@/lib/superAdminService';
import type { FeatureFlag, Plan } from '@/lib/superAdminService';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Loader2, AlertCircle, Plus, Pencil, Flag } from 'lucide-react';

const emptyFlag: Partial<FeatureFlag> = {
  codigo: '',
  nome: '',
  descricao: '',
  habilitado_global: false,
  orgs_habilitadas: [],
  planos_habilitados: [],
};

export default function SAFeatureFlagsPage() {
  const { toast } = useToast();
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFlag, setEditingFlag] = useState<Partial<FeatureFlag>>(emptyFlag);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [orgsText, setOrgsText] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [flagsData, plansData] = await Promise.all([
        getFeatureFlags(),
        getAllPlans(),
      ]);
      setFlags(flagsData);
      setPlans(plansData);
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao carregar feature flags');
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditingFlag({ ...emptyFlag });
    setOrgsText('');
    setIsEditing(false);
    setDialogOpen(true);
  }

  function openEdit(flag: FeatureFlag) {
    setEditingFlag({ ...flag });
    setOrgsText((flag.orgs_habilitadas ?? []).join('\n'));
    setIsEditing(true);
    setDialogOpen(true);
  }

  async function handleToggleGlobal(flag: FeatureFlag) {
    try {
      await updateFeatureFlag(flag.id, { habilitado_global: !flag.habilitado_global });
      toast({ title: `Flag "${flag.nome}" ${!flag.habilitado_global ? 'habilitada' : 'desabilitada'} globalmente` });
      await loadData();
    } catch (err: any) {
      toast({ title: 'Erro', description: err?.message, variant: 'destructive' });
    }
  }

  async function handleSave() {
    if (!editingFlag.codigo || !editingFlag.nome) {
      toast({ title: 'Erro', description: 'Codigo e nome sao obrigatorios', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const orgsArray = orgsText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);

      const payload = {
        ...editingFlag,
        orgs_habilitadas: orgsArray,
      };

      if (isEditing && editingFlag.id) {
        const { id, ...updates } = payload;
        await updateFeatureFlag(id!, updates);
        toast({ title: 'Feature flag atualizada com sucesso' });
      } else {
        await createFeatureFlag(payload);
        toast({ title: 'Feature flag criada com sucesso' });
      }
      setDialogOpen(false);
      await loadData();
    } catch (err: any) {
      toast({ title: 'Erro', description: err?.message ?? 'Erro ao salvar flag', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  function togglePlan(planCodigo: string) {
    const current = editingFlag.planos_habilitados ?? [];
    const updated = current.includes(planCodigo)
      ? current.filter((p) => p !== planCodigo)
      : [...current, planCodigo];
    setEditingFlag((prev) => ({ ...prev, planos_habilitados: updated }));
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
            <Flag className="w-6 h-6 text-red-500" />
            Feature Flags
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{flags.length} flags cadastradas</p>
        </div>
        <Button onClick={openCreate} className="bg-red-600 hover:bg-red-700 text-white">
          <Plus className="w-4 h-4 mr-2" /> Nova Flag
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
              <TableHead>Codigo</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Descricao</TableHead>
              <TableHead>Global</TableHead>
              <TableHead>Orgs</TableHead>
              <TableHead>Planos</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {flags.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Nenhuma feature flag cadastrada.
                </TableCell>
              </TableRow>
            ) : (
              flags.map((flag) => (
                <TableRow key={flag.id}>
                  <TableCell className="font-mono text-xs">{flag.codigo}</TableCell>
                  <TableCell className="font-medium">{flag.nome}</TableCell>
                  <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                    {flag.descricao || '—'}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={flag.habilitado_global}
                      onCheckedChange={() => handleToggleGlobal(flag)}
                    />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {flag.orgs_habilitadas.length > 0
                      ? `${flag.orgs_habilitadas.length} org(s)`
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {flag.planos_habilitados.length > 0 ? (
                        flag.planos_habilitados.map((p) => (
                          <Badge key={p} variant="outline" className="text-[10px] px-1.5 py-0">
                            {p}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(flag)}>
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
            <DialogTitle>{isEditing ? 'Editar Feature Flag' : 'Nova Feature Flag'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm mb-1.5 block">Codigo</Label>
                <Input
                  value={editingFlag.codigo ?? ''}
                  onChange={(e) =>
                    setEditingFlag((prev) => ({ ...prev, codigo: e.target.value }))
                  }
                  className="bg-input border-border"
                  placeholder="ex: whatsapp_audio"
                />
              </div>
              <div>
                <Label className="text-sm mb-1.5 block">Nome</Label>
                <Input
                  value={editingFlag.nome ?? ''}
                  onChange={(e) =>
                    setEditingFlag((prev) => ({ ...prev, nome: e.target.value }))
                  }
                  className="bg-input border-border"
                />
              </div>
            </div>
            <div>
              <Label className="text-sm mb-1.5 block">Descricao</Label>
              <Input
                value={editingFlag.descricao ?? ''}
                onChange={(e) =>
                  setEditingFlag((prev) => ({ ...prev, descricao: e.target.value }))
                }
                className="bg-input border-border"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={editingFlag.habilitado_global ?? false}
                onCheckedChange={(val) =>
                  setEditingFlag((prev) => ({ ...prev, habilitado_global: val }))
                }
              />
              <Label className="text-sm">Habilitado Globalmente</Label>
            </div>
            <div>
              <Label className="text-sm mb-1.5 block">Orgs Habilitadas (uma por linha)</Label>
              <Textarea
                value={orgsText}
                onChange={(e) => setOrgsText(e.target.value)}
                className="bg-input border-border min-h-[80px] font-mono text-xs"
                placeholder={"org_key_1\norg_key_2"}
              />
            </div>
            <div>
              <Label className="text-sm mb-1.5 block">Planos Habilitados</Label>
              <div className="flex flex-wrap gap-2">
                {plans.map((plan) => (
                  <button
                    key={plan.codigo}
                    type="button"
                    onClick={() => togglePlan(plan.codigo)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                      (editingFlag.planos_habilitados ?? []).includes(plan.codigo)
                        ? 'bg-red-500/10 border-red-500/30 text-red-400'
                        : 'bg-muted border-border text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {plan.nome} ({plan.codigo})
                  </button>
                ))}
                {plans.length === 0 && (
                  <p className="text-xs text-muted-foreground">Nenhum plano cadastrado.</p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {saving ? 'Salvando...' : isEditing ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
