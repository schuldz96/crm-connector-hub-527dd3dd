import { useState, useEffect, useMemo } from 'react';
import { getAllOrganizations } from '@/lib/superAdminService';
import type { Organization } from '@/lib/superAdminService';
import { supabaseSaas } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Search, Loader2, AlertCircle, Users } from 'lucide-react';

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

async function fetchAllUsers(): Promise<UserRow[]> {
  const { data, error } = await (supabaseSaas as any)
    .schema('core')
    .from('usuarios')
    .select('id,nome,email,org,papel,status,ultimo_login_em,criado_em')
    .order('criado_em', { ascending: false });

  if (error) throw new Error(`Erro ao buscar usuarios: ${error.message}`);
  return (data ?? []) as UserRow[];
}

export default function SAUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterOrg, setFilterOrg] = useState('all');
  const [filterPapel, setFilterPapel] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [usersData, orgsData] = await Promise.all([
          fetchAllUsers(),
          getAllOrganizations(),
        ]);
        setUsers(usersData);
        setOrgs(orgsData);
      } catch (err: any) {
        setError(err?.message ?? 'Erro ao carregar usuarios');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const papeis = useMemo(() => {
    const set = new Set(users.map((u) => u.papel).filter(Boolean));
    return Array.from(set).sort();
  }, [users]);

  const statuses = useMemo(() => {
    const set = new Set(users.map((u) => u.status).filter(Boolean));
    return Array.from(set).sort();
  }, [users]);

  const filtered = useMemo(() => {
    let list = users;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (u) =>
          (u.nome && u.nome.toLowerCase().includes(q)) ||
          u.email.toLowerCase().includes(q),
      );
    }
    if (filterOrg !== 'all') {
      list = list.filter((u) => u.org === filterOrg);
    }
    if (filterPapel !== 'all') {
      list = list.filter((u) => u.papel === filterPapel);
    }
    if (filterStatus !== 'all') {
      list = list.filter((u) => u.status === filterStatus);
    }
    return list;
  }, [users, search, filterOrg, filterPapel, filterStatus]);

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
          <Users className="w-6 h-6 text-red-500" />
          Usuarios
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {users.length} usuarios em todas as organizacoes
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
        <Select value={filterOrg} onValueChange={setFilterOrg}>
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
        <Select value={filterPapel} onValueChange={setFilterPapel}>
          <SelectTrigger className="w-[150px] bg-input border-border">
            <SelectValue placeholder="Todos papeis" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos papeis</SelectItem>
            {papeis.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[140px] bg-input border-border">
            <SelectValue placeholder="Todos status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
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
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Org</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ultimo Login</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Nenhum usuario encontrado.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((u) => (
                <TableRow key={u.id} className="sa-table-row">
                  <TableCell className="font-medium">{u.nome || '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell className="font-mono text-xs">{u.org}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {u.papel || 'N/A'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        u.status === 'ativo'
                          ? 'bg-green-500/10 text-green-400 border-green-500/20'
                          : 'bg-red-500/10 text-red-400 border-red-500/20'
                      }
                    >
                      {u.status || 'N/A'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {u.ultimo_login_em
                      ? new Date(u.ultimo_login_em).toLocaleString('pt-BR')
                      : 'Nunca'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="sa-count-pill">
        Exibindo {filtered.length} de {users.length} usuarios
      </div>
    </div>
  );
}
