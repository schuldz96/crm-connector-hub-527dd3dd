import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ChevronLeft, Search, Loader2, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { getOrg } from '@/lib/saas';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useSaasUsers } from '@/hooks/useCrm';
import type { CrmObjectType } from '@/types/crm';

const crm = () => (supabase as any).schema('crm');

const OBJECT_CONFIG: Record<CrmObjectType, { table: string; label: string; labelPlural: string; nameField: string }> = {
  contact: { table: 'contatos', label: 'Contato', labelPlural: 'Contatos', nameField: 'nome' },
  company: { table: 'empresas_crm', label: 'Empresa', labelPlural: 'Empresas', nameField: 'nome' },
  deal:    { table: 'negocios', label: 'Negócio', labelPlural: 'Negócios', nameField: 'nome' },
  ticket:  { table: 'tickets',  label: 'Ticket',  labelPlural: 'Tickets',  nameField: 'titulo' },
};

const TYPE_ID_MAP: Record<string, CrmObjectType> = { '0-1': 'contact', '0-2': 'company', '0-3': 'deal', '0-4': 'ticket' };

export default function CRMRestorePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: saasUsers = [] } = useSaasUsers();

  const typeParam = searchParams.get('type') || '0-3';
  const objectType: CrmObjectType = TYPE_ID_MAP[typeParam] || 'deal';
  const config = OBJECT_CONFIG[objectType];

  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [restoring, setRestoring] = useState(false);

  // Date range: last 90 days
  const ninetyDaysAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 90);
    return d.toISOString();
  }, []);

  const { data: deletedRecords = [], isLoading, refetch } = useQuery({
    queryKey: ['crm.deleted', objectType],
    queryFn: async () => {
      const org = await getOrg();
      const { data, error } = await crm()
        .from(config.table)
        .select('*')
        .eq('org', org)
        .not('deletado_em', 'is', null)
        .gte('deletado_em', ninetyDaysAgo)
        .order('deletado_em', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = useMemo(() => {
    let list = deletedRecords;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((r: any) => {
        const name = r[config.nameField] || '';
        return name.toLowerCase().includes(q);
      });
    }
    return list;
  }, [deletedRecords, search, config.nameField]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((r: any) => r.id)));
    }
  };

  const handleRestore = async () => {
    if (selectedIds.size === 0) return;
    setRestoring(true);
    try {
      const ids = Array.from(selectedIds);
      const { error } = await crm()
        .from(config.table)
        .update({ deletado_em: null })
        .in('id', ids);
      if (error) throw error;
      toast({ title: `${ids.length} ${ids.length === 1 ? 'registro restaurado' : 'registros restaurados'}` });
      setSelectedIds(new Set());
      refetch();
      qc.invalidateQueries({ predicate: (q) => q.queryKey.some(k => typeof k === 'string' && k.startsWith('crm')) });
    } catch (err) {
      toast({ title: 'Erro ao restaurar', description: String(err), variant: 'destructive' });
    } finally {
      setRestoring(false);
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-semibold">Restaurar {config.labelPlural}</h1>
            <p className="text-xs text-muted-foreground">
              Restaurar {config.labelPlural} excluídos nos últimos 90 dias
            </p>
          </div>
        </div>
        <Button onClick={handleRestore} disabled={selectedIds.size === 0 || restoring} size="sm">
          {restoring ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RotateCcw className="w-3.5 h-3.5 mr-1" />}
          Restaurar {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 px-6 py-3 border-b border-border bg-card flex-shrink-0">
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input placeholder="Pesquisar" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-8 text-xs" />
        </div>
        <Select value={selectedUser} onValueChange={setSelectedUser}>
          <SelectTrigger className="w-52 h-8 text-xs">
            <SelectValue placeholder="Selecione um usuário" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os usuários</SelectItem>
            {saasUsers.map(u => (
              <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="outline" className="text-xs">
          {filtered.length} {filtered.length === 1 ? 'registro' : 'registros'}
        </Badge>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <RotateCcw className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm">Nenhum registro excluído encontrado</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-border bg-muted/50">
                <th className="w-10 px-3 py-2.5">
                  <input type="checkbox" className="rounded border-border" checked={selectedIds.size === filtered.length && filtered.length > 0} onChange={toggleAll} />
                </th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">Nome</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">Excluído por</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">Hora da exclusão</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((record: any) => {
                const name = record[config.nameField] || '—';
                const isSelected = selectedIds.has(record.id);
                return (
                  <tr key={record.id} className={cn('border-b border-border hover:bg-muted/20 transition-colors', isSelected && 'bg-primary/5')}>
                    <td className="px-3 py-2.5">
                      <input type="checkbox" className="rounded border-border" checked={isSelected} onChange={() => toggleSelect(record.id)} />
                    </td>
                    <td className="px-3 py-2.5 font-medium">{name}</td>
                    <td className="px-3 py-2.5 text-muted-foreground text-xs">
                      {record.proprietario_id
                        ? saasUsers.find(u => u.id === record.proprietario_id)?.nome || '—'
                        : 'Sistema'}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground text-xs capitalize">
                      {record.deletado_em ? formatDate(record.deletado_em) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
