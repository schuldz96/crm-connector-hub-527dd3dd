import { useState, useEffect, useMemo } from 'react';
import { getAllInvoices, getAllOrganizations, createInvoice } from '@/lib/superAdminService';
import type { Invoice, Organization } from '@/lib/superAdminService';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Loader2, AlertCircle, Receipt, Plus } from 'lucide-react';

const statusColors: Record<string, string> = {
  paga: 'bg-green-500/10 text-green-400 border-green-500/20',
  pendente: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  atrasada: 'bg-red-500/10 text-red-400 border-red-500/20',
};

function getEffectiveInvoiceStatus(inv: Invoice): string {
  if (inv.status === 'pendente' && inv.vencimento_em) {
    const venc = new Date(inv.vencimento_em);
    venc.setHours(23, 59, 59, 999);
    if (venc < new Date()) return 'atrasada';
  }
  return inv.status;
}

export default function SAInvoicesPage() {
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [filterOrg, setFilterOrg] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [formOrg, setFormOrg] = useState('');
  const [formValor, setFormValor] = useState('');
  const [formDescricao, setFormDescricao] = useState('');
  const [formVencimento, setFormVencimento] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [invs, orgsData] = await Promise.all([
          getAllInvoices(),
          getAllOrganizations(),
        ]);
        setInvoices(invs);
        setOrgs(orgsData);
      } catch (err: any) {
        setError(err?.message ?? 'Erro ao carregar faturas');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const orgMap = useMemo(() => {
    const map = new Map<string, string>();
    orgs.forEach((o) => map.set(o.org, o.nome));
    return map;
  }, [orgs]);

  const filtered = useMemo(() => {
    let list = invoices;
    if (filterOrg !== 'all') list = list.filter((i) => i.org === filterOrg);
    if (filterStatus !== 'all') {
      list = list.filter((i) => getEffectiveInvoiceStatus(i) === filterStatus);
    }
    return list;
  }, [invoices, filterOrg, filterStatus]);

  async function handleCreate() {
    if (!formOrg || !formValor || !formVencimento) {
      toast({ title: 'Erro', description: 'Preencha todos os campos obrigatorios', variant: 'destructive' });
      return;
    }
    const valor = parseFloat(formValor.replace(',', '.'));
    if (isNaN(valor) || valor <= 0) {
      toast({ title: 'Erro', description: 'Valor invalido', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const inv = await createInvoice({
        org: formOrg,
        valor,
        descricao: formDescricao.trim() || undefined,
        vencimento_em: formVencimento,
      });
      setInvoices((prev) => [inv, ...prev]);
      toast({ title: 'Fatura criada com sucesso' });
      setCreateOpen(false);
      setFormOrg('');
      setFormValor('');
      setFormDescricao('');
      setFormVencimento('');
    } catch (err: any) {
      toast({ title: 'Erro', description: err?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
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
        <div className="sa-page-header">
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <Receipt className="w-6 h-6 text-red-500" />
            Faturas
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {invoices.length} faturas registradas
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="bg-red-600 hover:bg-red-700 text-white">
          <Plus className="w-4 h-4 mr-2" /> Nova Fatura
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={filterOrg} onValueChange={setFilterOrg}>
          <SelectTrigger className="w-[200px] bg-input border-border">
            <SelectValue placeholder="Todas as orgs" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as orgs</SelectItem>
            {orgs.map((o) => (
              <SelectItem key={o.org} value={o.org}>{o.nome} ({o.org})</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px] bg-input border-border">
            <SelectValue placeholder="Todos status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="paga">Paga</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="atrasada">Atrasada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="glass-card border border-border rounded-lg bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Org</TableHead>
              <TableHead>Descricao</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Pago em</TableHead>
              <TableHead>Criado em</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Nenhuma fatura encontrada.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((inv) => {
                const effectiveStatus = getEffectiveInvoiceStatus(inv);
                return (
                  <TableRow key={inv.id} className="sa-table-row">
                    <TableCell className="font-medium text-sm">
                      {orgMap.get(inv.org) || inv.org}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {inv.descricao || '—'}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      R$ {inv.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[effectiveStatus] ?? statusColors.pendente}>
                        {effectiveStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(inv.vencimento_em).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {inv.pago_em ? new Date(inv.pago_em).toLocaleDateString('pt-BR') : '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(inv.criado_em).toLocaleDateString('pt-BR')}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="sa-count-pill">
        Exibindo {filtered.length} de {invoices.length} faturas
      </div>

      {/* Create Invoice Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Fatura</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm mb-1.5 block">Organizacao *</Label>
              <Select value={formOrg} onValueChange={setFormOrg}>
                <SelectTrigger className="bg-input border-border">
                  <SelectValue placeholder="Selecione a org" />
                </SelectTrigger>
                <SelectContent>
                  {orgs.map((o) => (
                    <SelectItem key={o.org} value={o.org}>{o.nome} ({o.org})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm mb-1.5 block">Valor (R$) *</Label>
              <Input
                value={formValor}
                onChange={(e) => setFormValor(e.target.value)}
                placeholder="199.90"
                className="bg-input border-border"
              />
            </div>
            <div>
              <Label className="text-sm mb-1.5 block">Descricao</Label>
              <Input
                value={formDescricao}
                onChange={(e) => setFormDescricao(e.target.value)}
                placeholder="Mensalidade plano Pro - Abril/2026"
                className="bg-input border-border"
              />
            </div>
            <div>
              <Label className="text-sm mb-1.5 block">Vencimento *</Label>
              <Input
                type="date"
                value={formVencimento}
                onChange={(e) => setFormVencimento(e.target.value)}
                className="bg-input border-border"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>
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
