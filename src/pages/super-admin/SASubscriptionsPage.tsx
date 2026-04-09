import { useState, useEffect, useMemo } from 'react';
import { getAllSubscriptions } from '@/lib/superAdminService';
import type { Subscription } from '@/lib/superAdminService';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Loader2, AlertCircle, CreditCard } from 'lucide-react';

const statusColors: Record<string, string> = {
  ativa: 'bg-green-500/10 text-green-400 border-green-500/20',
  trial: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  cancelada: 'bg-red-500/10 text-red-400 border-red-500/20',
  suspensa: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  pendente: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
};

export default function SASubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const data = await getAllSubscriptions();
        setSubscriptions(data);
      } catch (err: any) {
        setError(err?.message ?? 'Erro ao carregar assinaturas');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const statuses = useMemo(() => {
    const set = new Set(subscriptions.map((s) => s.status).filter(Boolean));
    return Array.from(set).sort();
  }, [subscriptions]);

  const filtered = useMemo(() => {
    if (filterStatus === 'all') return subscriptions;
    return subscriptions.filter((s) => s.status === filterStatus);
  }, [subscriptions, filterStatus]);

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
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Nenhuma assinatura encontrada.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((sub) => (
                <TableRow key={sub.id}>
                  <TableCell className="font-mono text-sm">{sub.org}</TableCell>
                  <TableCell className="font-medium">{sub.plano_nome ?? sub.plano_id}</TableCell>
                  <TableCell>
                    <Badge className={statusColors[sub.status] ?? statusColors.pendente}>
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
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        Exibindo {filtered.length} de {subscriptions.length} assinaturas
      </p>
    </div>
  );
}
