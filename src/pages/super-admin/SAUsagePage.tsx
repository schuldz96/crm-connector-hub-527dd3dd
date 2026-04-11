import { useState, useEffect, useMemo } from 'react';
import { getResourceUsage, getAllOrganizations } from '@/lib/superAdminService';
import type { ResourceUsage, Organization } from '@/lib/superAdminService';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Loader2, AlertCircle, BarChart3 } from 'lucide-react';

export default function SAUsagePage() {
  const [usage, setUsage] = useState<ResourceUsage[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterOrg, setFilterOrg] = useState('all');
  const [filterMonth, setFilterMonth] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [usageData, orgsData] = await Promise.all([
          getResourceUsage(),
          getAllOrganizations(),
        ]);
        setUsage(usageData);
        setOrgs(orgsData);
      } catch (err: any) {
        setError(err?.message ?? 'Erro ao carregar dados de uso');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const months = useMemo(() => {
    const set = new Set(usage.map((u) => u.mes_ref));
    return Array.from(set).sort().reverse();
  }, [usage]);

  const filtered = useMemo(() => {
    let list = usage;
    if (filterOrg !== 'all') {
      list = list.filter((u) => u.org === filterOrg);
    }
    if (filterMonth) {
      list = list.filter((u) => u.mes_ref === filterMonth);
    }
    return list;
  }, [usage, filterOrg, filterMonth]);

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
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-red-500" />
          Uso de Recursos
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {usage.length} registros de uso
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Select value={filterOrg} onValueChange={setFilterOrg}>
          <SelectTrigger className="w-[200px] bg-input border-border">
            <SelectValue placeholder="Todas as orgs" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as orgs</SelectItem>
            {orgs.map((o) => (
              <SelectItem key={o.org} value={o.org}>
                {o.nome} ({o.org})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterMonth || 'all'} onValueChange={(v) => setFilterMonth(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[160px] bg-input border-border">
            <SelectValue placeholder="Todos os meses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os meses</SelectItem>
            {months.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
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
              <TableHead>Mes</TableHead>
              <TableHead>Usuarios Ativos</TableHead>
              <TableHead>Instancias WhatsApp</TableHead>
              <TableHead>Avaliacoes IA</TableHead>
              <TableHead>Storage (MB)</TableHead>
              <TableHead>Mensagens</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Nenhum registro de uso encontrado.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((u) => (
                <TableRow key={u.id} className="sa-table-row">
                  <TableCell className="font-mono text-sm">{u.org}</TableCell>
                  <TableCell className="font-mono text-sm">{u.mes_ref}</TableCell>
                  <TableCell>{u.usuarios_ativos}</TableCell>
                  <TableCell>{u.instancias_whatsapp}</TableCell>
                  <TableCell>{u.avaliacoes_ia.toLocaleString('pt-BR')}</TableCell>
                  <TableCell>{u.storage_usado_mb.toLocaleString('pt-BR')}</TableCell>
                  <TableCell>{u.mensagens_enviadas.toLocaleString('pt-BR')}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="sa-count-pill">
        Exibindo {filtered.length} de {usage.length} registros
      </div>
    </div>
  );
}
