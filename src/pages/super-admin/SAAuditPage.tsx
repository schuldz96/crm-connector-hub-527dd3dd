import { useState, useEffect, useMemo, useCallback } from 'react';
import { getFilteredAuditLogs } from '@/lib/superAdminService';
import type { AdminAuditEntry, AuditFilters } from '@/lib/superAdminService';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Loader2, AlertCircle, ScrollText, Download, X } from 'lucide-react';

const actionBadgeColors: Record<string, string> = {
  create: 'bg-green-500/10 text-green-400 border-green-500/20',
  insert: 'bg-green-500/10 text-green-400 border-green-500/20',
  update: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  delete: 'bg-red-500/10 text-red-400 border-red-500/20',
  remove: 'bg-red-500/10 text-red-400 border-red-500/20',
  login: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
};

function getActionColor(acao: string): string {
  const lower = acao.toLowerCase();
  for (const [key, val] of Object.entries(actionBadgeColors)) {
    if (lower.includes(key)) return val;
  }
  return 'bg-muted text-muted-foreground border-border';
}

export default function SAAuditPage() {
  const [logs, setLogs] = useState<AdminAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [filterAction, setFilterAction] = useState('all');
  const [filterEntidade, setFilterEntidade] = useState('all');
  const [filterDe, setFilterDe] = useState('');
  const [filterAte, setFilterAte] = useState('');

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const filters: AuditFilters = {};
      if (filterAction !== 'all') filters.acao = filterAction;
      if (filterEntidade !== 'all') filters.entidade_tipo = filterEntidade;
      if (filterDe) filters.de = filterDe;
      if (filterAte) filters.ate = filterAte;
      const data = await getFilteredAuditLogs(filters);
      setLogs(data);
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao carregar logs de auditoria');
    } finally {
      setLoading(false);
    }
  }, [filterAction, filterEntidade, filterDe, filterAte]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  // Extract unique values for filter dropdowns
  const actions = useMemo(() => {
    const set = new Set(logs.map((l) => l.acao).filter(Boolean));
    return Array.from(set).sort();
  }, [logs]);

  const entidades = useMemo(() => {
    const set = new Set(logs.map((l) => l.entidade_tipo).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [logs]);

  const hasFilters = filterAction !== 'all' || filterEntidade !== 'all' || filterDe || filterAte;

  function clearFilters() {
    setFilterAction('all');
    setFilterEntidade('all');
    setFilterDe('');
    setFilterAte('');
  }

  function exportCSV() {
    const headers = ['Data/Hora', 'Admin ID', 'Acao', 'Entidade Tipo', 'Entidade ID', 'IP', 'Detalhes'];
    const rows = logs.map((l) => [
      new Date(l.criado_em).toLocaleString('pt-BR'),
      l.admin_id ?? '',
      l.acao,
      l.entidade_tipo ?? '',
      l.entidade_id ?? '',
      l.ip_origem ?? '',
      l.detalhes ? JSON.stringify(l.detalhes) : '',
    ]);
    const csv = [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="sa-page-header">
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <ScrollText className="w-6 h-6 text-red-500" />
            Auditoria
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Logs de acoes administrativas
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV} disabled={logs.length === 0}>
          <Download className="w-4 h-4 mr-2" /> Exportar CSV
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Acao</Label>
          <Select value={filterAction} onValueChange={setFilterAction}>
            <SelectTrigger className="w-[180px] bg-input border-border">
              <SelectValue placeholder="Todas as acoes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as acoes</SelectItem>
              {actions.map((a) => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Entidade</Label>
          <Select value={filterEntidade} onValueChange={setFilterEntidade}>
            <SelectTrigger className="w-[180px] bg-input border-border">
              <SelectValue placeholder="Todas as entidades" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as entidades</SelectItem>
              {entidades.map((e) => (
                <SelectItem key={e} value={e}>{e}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">De</Label>
          <Input type="date" value={filterDe} onChange={(e) => setFilterDe(e.target.value)} className="w-[160px] bg-input border-border" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Ate</Label>
          <Input type="date" value={filterAte} onChange={(e) => setFilterAte(e.target.value)} className="w-[160px] bg-input border-border" />
        </div>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
            <X className="w-4 h-4 mr-1" /> Limpar
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="glass-card border border-border rounded-lg bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Admin</TableHead>
                  <TableHead>Acao</TableHead>
                  <TableHead>Entidade</TableHead>
                  <TableHead>IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Nenhum log encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log.id} className="sa-table-row">
                      <TableCell className="text-sm whitespace-nowrap">
                        {new Date(log.criado_em).toLocaleString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {log.admin_id ?? '—'}
                      </TableCell>
                      <TableCell>
                        <Badge className={getActionColor(log.acao)}>
                          {log.acao}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {log.entidade_tipo
                          ? `${log.entidade_tipo}${log.entidade_id ? ` #${log.entidade_id}` : ''}`
                          : '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs font-mono">
                        {log.ip_origem ?? '—'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="sa-count-pill">
            Exibindo {logs.length} registros
          </div>
        </>
      )}
    </div>
  );
}
