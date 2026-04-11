import { useState, useEffect, useMemo } from 'react';
import { getAdminAuditLogs } from '@/lib/superAdminService';
import type { AdminAuditEntry } from '@/lib/superAdminService';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Loader2, AlertCircle, ScrollText } from 'lucide-react';

export default function SAAuditPage() {
  const [logs, setLogs] = useState<AdminAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [limit, setLimit] = useState(50);
  const [filterAction, setFilterAction] = useState('all');

  async function load(lim: number) {
    try {
      const data = await getAdminAuditLogs(lim);
      setLogs(data);
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao carregar logs de auditoria');
    }
  }

  useEffect(() => {
    setLoading(true);
    setError('');
    load(limit).finally(() => setLoading(false));
  }, []);

  async function handleLoadMore() {
    const newLimit = limit + 50;
    setLoadingMore(true);
    setLimit(newLimit);
    await load(newLimit);
    setLoadingMore(false);
  }

  const actions = useMemo(() => {
    const set = new Set(logs.map((l) => l.acao).filter(Boolean));
    return Array.from(set).sort();
  }, [logs]);

  const filtered = useMemo(() => {
    if (filterAction === 'all') return logs;
    return logs.filter((l) => l.acao === filterAction);
  }, [logs, filterAction]);

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
          <ScrollText className="w-6 h-6 text-red-500" />
          Auditoria
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Logs de acoes administrativas
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <Select value={filterAction} onValueChange={setFilterAction}>
          <SelectTrigger className="w-[220px] bg-input border-border">
            <SelectValue placeholder="Todas as acoes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as acoes</SelectItem>
            {actions.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

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
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Nenhum log encontrado.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((log) => (
                <TableRow key={log.id} className="sa-table-row">
                  <TableCell className="text-sm whitespace-nowrap">
                    {new Date(log.criado_em).toLocaleString('pt-BR')}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {log.admin_id ?? '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
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

      <div className="flex items-center justify-between">
        <div className="sa-count-pill">
          Exibindo {filtered.length} registros (carregados: {logs.length})
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleLoadMore}
          disabled={loadingMore}
        >
          {loadingMore ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin mr-2" />
              Carregando...
            </>
          ) : (
            'Carregar mais'
          )}
        </Button>
      </div>
    </div>
  );
}
