import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllOrganizations, createOrganization, updateOrganization } from '@/lib/superAdminService';
import type { Organization } from '@/lib/superAdminService';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Search, Loader2, AlertCircle, Building2, Plus } from 'lucide-react';

const emptyOrg = { nome: '', dominio: '', ativo: true };

export default function SAOrganizationsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newOrg, setNewOrg] = useState(emptyOrg);
  const [saving, setSaving] = useState(false);

  async function loadOrgs() {
    setLoading(true);
    setError('');
    try {
      const data = await getAllOrganizations();
      setOrgs(data);
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao carregar organizacoes');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadOrgs(); }, []);

  async function handleCreate() {
    if (!newOrg.nome.trim()) {
      toast({ title: 'Erro', description: 'Nome e obrigatorio', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await createOrganization({
        nome: newOrg.nome.trim(),
        dominio: newOrg.dominio.trim() || undefined,
        ativo: newOrg.ativo,
      });
      toast({ title: 'Organizacao criada com sucesso' });
      setDialogOpen(false);
      setNewOrg(emptyOrg);
      await loadOrgs();
    } catch (err: any) {
      toast({ title: 'Erro', description: err?.message ?? 'Erro ao criar organizacao', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return orgs;
    const q = search.toLowerCase();
    return orgs.filter(
      (o) =>
        o.nome.toLowerCase().includes(q) ||
        o.org.toLowerCase().includes(q) ||
        (o.dominio && o.dominio.toLowerCase().includes(q)),
    );
  }, [orgs, search]);

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
            <Building2 className="w-6 h-6 text-red-500" />
            Organizacoes
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {orgs.length} organizacoes cadastradas
          </p>
        </div>
        <Button onClick={() => { setNewOrg(emptyOrg); setDialogOpen(true); }} className="bg-red-600 hover:bg-red-700 text-white">
          <Plus className="w-4 h-4 mr-2" /> Nova Organizacao
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou org key..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 bg-input border-border"
        />
      </div>

      <div className="glass-card border border-border rounded-lg bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Org Key</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Dominio</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Criado em</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  {search
                    ? 'Nenhuma organizacao encontrada para esta busca.'
                    : 'Nenhuma organizacao cadastrada.'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((org) => (
                <TableRow
                  key={org.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/super-admin/organizations/${org.org}`)}
                >
                  <TableCell className="font-mono text-sm">{org.org}</TableCell>
                  <TableCell className="font-medium">{org.nome}</TableCell>
                  <TableCell className="text-muted-foreground">{org.dominio || '—'}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {org.plano || 'N/A'}
                    </Badge>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Switch
                      checked={org.ativo}
                      onCheckedChange={async (val) => {
                        try {
                          await updateOrganization(org.id, { ativo: val });
                          toast({ title: val ? 'Organizacao ativada' : 'Organizacao desativada' });
                          await loadOrgs();
                        } catch (err: any) {
                          toast({ title: 'Erro', description: err?.message, variant: 'destructive' });
                        }
                      }}
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(org.criado_em).toLocaleDateString('pt-BR')}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create Organization Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Organizacao</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm mb-1.5 block">Nome *</Label>
              <Input
                value={newOrg.nome}
                onChange={(e) => setNewOrg((prev) => ({ ...prev, nome: e.target.value }))}
                placeholder="Nome da empresa"
                className="bg-input border-border"
              />
            </div>
            <div>
              <Label className="text-sm mb-1.5 block">Dominio</Label>
              <Input
                value={newOrg.dominio}
                onChange={(e) => setNewOrg((prev) => ({ ...prev, dominio: e.target.value }))}
                placeholder="exemplo.com.br"
                className="bg-input border-border"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={newOrg.ativo}
                onCheckedChange={(val) => setNewOrg((prev) => ({ ...prev, ativo: val }))}
              />
              <Label className="text-sm">Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={saving} className="bg-red-600 hover:bg-red-700 text-white">
              {saving ? 'Criando...' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
