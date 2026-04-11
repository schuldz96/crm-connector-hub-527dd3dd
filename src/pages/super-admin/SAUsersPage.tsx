import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { getAllOrganizations, getPaginatedUsers, updateUser, countActiveAdmins } from '@/lib/superAdminService';
import type { Organization } from '@/lib/superAdminService';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Search, Loader2, AlertCircle, Users, Pencil, ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react';

const PAPEIS = [
  'admin', 'ceo', 'diretor', 'gerente', 'coordenador', 'supervisor',
  'vendedor', 'suporte', 'bdr', 'sdr', 'closer', 'key_account', 'csm', 'low_touch',
];
const PAGE_SIZE = 20;

interface UserRow {
  id: string;
  nome: string;
  email: string;
  org: string;
  papel: string;
  status: string;
  ultimo_login_em?: string;
  criado_em: string;
}

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
          <TableCell><Skeleton className="h-4 w-10" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-4 w-8" /></TableCell>
        </TableRow>
      ))}
    </>
  );
}

export default function SAUsersPage() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterOrg, setFilterOrg] = useState('all');
  const [filterPapel, setFilterPapel] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  // Pagination
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('criado_em');
  const [sortAsc, setSortAsc] = useState(false);

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [editPapel, setEditPapel] = useState('');
  const [saving, setSaving] = useState(false);

  // Debounce search
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  // Load orgs once
  useEffect(() => {
    getAllOrganizations().then(setOrgs).catch(() => {});
  }, []);

  // Load users when filters/page change
  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await getPaginatedUsers({
        page,
        pageSize: PAGE_SIZE,
        search: debouncedSearch || undefined,
        org: filterOrg,
        papel: filterPapel,
        status: filterStatus,
        sortBy,
        sortAsc,
      });
      setUsers(result.data as UserRow[]);
      setTotal(result.total);
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao carregar usuarios');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, filterOrg, filterPapel, filterStatus, sortBy, sortAsc]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const orgMap = useMemo(() => {
    const map = new Map<string, string>();
    orgs.forEach((o) => map.set(o.org, o.nome));
    return map;
  }, [orgs]);

  function handleSort(column: string) {
    if (sortBy === column) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(column);
      setSortAsc(true);
    }
    setPage(1);
  }

  function openEditDialog(user: UserRow) {
    setEditingUser(user);
    setEditPapel(user.papel);
    setEditDialogOpen(true);
  }

  async function handleEditSave() {
    if (!editingUser) return;
    setSaving(true);
    try {
      await updateUser(editingUser.id, { papel: editPapel });
      toast({ title: 'Papel atualizado com sucesso' });
      setEditDialogOpen(false);
      setUsers((prev) => prev.map((u) => u.id === editingUser.id ? { ...u, papel: editPapel } : u));
    } catch (err: any) {
      toast({ title: 'Erro', description: err?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus(user: UserRow) {
    const newStatus = user.status === 'ativo' ? 'inativo' : 'ativo';
    if (newStatus === 'inativo' && user.papel === 'admin') {
      const adminCount = await countActiveAdmins(user.org);
      if (adminCount <= 1) {
        toast({ title: 'Erro', description: 'Nao e possivel desativar o ultimo admin da organizacao', variant: 'destructive' });
        return;
      }
    }
    try {
      await updateUser(user.id, { status: newStatus });
      toast({ title: newStatus === 'ativo' ? 'Usuario ativado' : 'Usuario desativado' });
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, status: newStatus } : u));
    } catch (err: any) {
      toast({ title: 'Erro', description: err?.message, variant: 'destructive' });
    }
  }

  function SortableHead({ column, children }: { column: string; children: React.ReactNode }) {
    return (
      <TableHead
        className="cursor-pointer select-none hover:text-foreground transition-colors"
        onClick={() => handleSort(column)}
      >
        <span className="flex items-center gap-1">
          {children}
          <ArrowUpDown className={`w-3 h-3 ${sortBy === column ? 'text-foreground' : 'text-muted-foreground/50'}`} />
        </span>
      </TableHead>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="sa-page-header">
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <Users className="w-6 h-6 text-red-500" />
          Usuarios
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {total} usuarios em todas as organizacoes
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-input border-border"
          />
        </div>
        <Select value={filterOrg} onValueChange={(v) => { setFilterOrg(v); setPage(1); }}>
          <SelectTrigger className="w-[180px] bg-input border-border">
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
        <Select value={filterPapel} onValueChange={(v) => { setFilterPapel(v); setPage(1); }}>
          <SelectTrigger className="w-[150px] bg-input border-border">
            <SelectValue placeholder="Todos papeis" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos papeis</SelectItem>
            {PAPEIS.map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(1); }}>
          <SelectTrigger className="w-[140px] bg-input border-border">
            <SelectValue placeholder="Todos status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="ativo">ativo</SelectItem>
            <SelectItem value="inativo">inativo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="glass-card border border-border rounded-lg bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead column="nome">Nome</SortableHead>
              <TableHead>Email</TableHead>
              <TableHead>Org</TableHead>
              <SortableHead column="papel">Papel</SortableHead>
              <TableHead>Status</TableHead>
              <SortableHead column="ultimo_login_em">Ultimo Login</SortableHead>
              <TableHead className="w-24">Acoes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableSkeleton />
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Nenhum usuario encontrado.
                </TableCell>
              </TableRow>
            ) : (
              users.map((u) => (
                <TableRow key={u.id} className="sa-table-row">
                  <TableCell className="font-medium">{u.nome || '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell className="text-sm">{orgMap.get(u.org) || u.org}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {u.papel || 'N/A'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={u.status === 'ativo'}
                      onCheckedChange={() => handleToggleStatus(u)}
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {u.ultimo_login_em
                      ? new Date(u.ultimo_login_em).toLocaleString('pt-BR')
                      : 'Nunca'}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" className="sa-action-btn" onClick={() => openEditDialog(u)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="sa-count-pill">
          Pagina {page} de {totalPages} ({total} usuarios)
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Edit Role Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar Usuario</DialogTitle>
          </DialogHeader>
          {editingUser && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">{editingUser.nome || editingUser.email}</p>
                <p className="text-xs text-muted-foreground">{editingUser.email}</p>
              </div>
              <div>
                <Label className="text-sm mb-1.5 block">Papel</Label>
                <Select value={editPapel} onValueChange={setEditPapel}>
                  <SelectTrigger className="bg-input border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAPEIS.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleEditSave} disabled={saving} className="bg-red-600 hover:bg-red-700 text-white">
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
