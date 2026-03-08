import { useState } from 'react';
import { MOCK_USERS } from '@/data/mockData';
import type { User, UserRole } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Plus, Search, Mail, MoreHorizontal, Trash2, UserX, UserCheck,
  UserPlus, X, Eye, EyeOff, Shield, ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const ROLE_CONFIG: Record<UserRole, { label: string; class: string }> = {
  admin: { label: 'Admin', class: 'bg-destructive/10 text-destructive border-destructive/20' },
  director: { label: 'Diretor', class: 'bg-primary/10 text-primary border-primary/20' },
  supervisor: { label: 'Supervisor', class: 'bg-accent/10 text-accent border-accent/20' },
  member: { label: 'Vendedor', class: 'bg-muted text-muted-foreground border-border' },
};

function CreateUserModal({ onClose }: { onClose: () => void }) {
  const [showPass, setShowPass] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', role: 'member', password: '' });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-primary" />
            Criar Novo Usuário
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div>
            <label className="text-xs font-medium block mb-1.5">Nome completo</label>
            <Input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Ex: João Silva"
              className="h-9 text-xs bg-secondary border-border"
            />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5">E-mail</label>
            <Input
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="joao@appmax.com.br"
              type="email"
              className="h-9 text-xs bg-secondary border-border"
            />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5">Perfil</label>
            <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
              <SelectTrigger className="h-9 text-xs bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="member" className="text-xs">Vendedor</SelectItem>
                <SelectItem value="supervisor" className="text-xs">Supervisor</SelectItem>
                <SelectItem value="director" className="text-xs">Diretor</SelectItem>
                <SelectItem value="admin" className="text-xs">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5">Senha temporária</label>
            <div className="relative">
              <Input
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                type={showPass ? 'text' : 'password'}
                placeholder="Mínimo 8 caracteres"
                className="h-9 text-xs bg-secondary border-border pr-9"
              />
              <button
                onClick={() => setShowPass(s => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
            <p className="text-[11px] text-muted-foreground">
              O usuário receberá um e-mail de boas-vindas e deverá redefinir a senha no primeiro acesso.
            </p>
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" className="flex-1 bg-gradient-primary text-xs h-9">
              <UserPlus className="w-3.5 h-3.5 mr-1.5" /> Criar Usuário
            </Button>
            <Button size="sm" variant="outline" className="text-xs border-border h-9" onClick={onClose}>
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DeleteConfirmModal({ user, onClose }: { user: User; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold flex items-center gap-2 text-destructive">
            <Trash2 className="w-4 h-4" />
            Excluir Usuário
          </DialogTitle>
        </DialogHeader>
        <div className="py-2 space-y-4">
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja excluir <span className="text-foreground font-semibold">{user.name}</span>?
            Esta ação é irreversível.
          </p>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
            <img src={user.avatar} alt={user.name} className="w-9 h-9 rounded-full border border-border" />
            <div>
              <p className="text-xs font-semibold">{user.name}</p>
              <p className="text-[11px] text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" className="flex-1 text-xs h-9">
              <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Confirmar Exclusão
            </Button>
            <Button size="sm" variant="outline" className="text-xs border-border h-9" onClick={onClose}>
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState(MOCK_USERS);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  const filtered = users.filter(u => {
    const matchSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const toggleStatus = (id: string) => {
    setUsers(prev =>
      prev.map(u =>
        u.id === id ? { ...u, status: u.status === 'active' ? 'inactive' : 'active' } : u
      )
    );
  };

  return (
    <div className="page-container animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold">Usuários</h1>
          <p className="text-sm text-muted-foreground">{users.length} usuários cadastrados</p>
        </div>
        <Button size="sm" className="bg-gradient-primary text-xs h-8" onClick={() => setShowCreate(true)}>
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Criar Usuário
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar usuários..."
            className="pl-9 h-8 text-xs bg-secondary border-border"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {['all', 'admin', 'director', 'supervisor', 'member'].map(r => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={cn(
                'text-xs px-3 py-1.5 rounded-lg border transition-all',
                roleFilter === r
                  ? 'bg-primary/15 border-primary/30 text-primary'
                  : 'border-border text-muted-foreground hover:bg-muted'
              )}
            >
              {{ all: 'Todos', admin: 'Admin', director: 'Diretores', supervisor: 'Supervisores', member: 'Vendedores' }[r]}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full data-table">
          <thead>
            <tr>
              <th className="text-left">Usuário</th>
              <th className="text-left hidden md:table-cell">Email</th>
              <th className="text-center">Perfil</th>
              <th className="text-center">Status</th>
              <th className="text-center hidden lg:table-cell">Desde</th>
              <th className="text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(u => {
              const rc = ROLE_CONFIG[u.role];
              return (
                <tr key={u.id} className={cn(u.status === 'inactive' && 'opacity-60')}>
                  <td>
                    <div className="flex items-center gap-3">
                      <img src={u.avatar} alt={u.name} className="w-8 h-8 rounded-full border border-border" />
                      <div>
                        <p className="text-sm font-medium">{u.name}</p>
                        <p className="text-xs text-muted-foreground md:hidden">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="hidden md:table-cell">
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Mail className="w-3.5 h-3.5" />
                      {u.email}
                    </div>
                  </td>
                  <td className="text-center">
                    <span className={cn('text-xs px-2.5 py-0.5 rounded-full border font-medium', rc.class)}>
                      {rc.label}
                    </span>
                  </td>
                  <td className="text-center">
                    <span className={cn(
                      'text-xs px-2 py-0.5 rounded-full border',
                      u.status === 'active'
                        ? 'bg-success/10 text-success border-success/20'
                        : 'bg-muted text-muted-foreground border-border'
                    )}>
                      {u.status === 'active' ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="text-center hidden lg:table-cell">
                    <span className="text-xs text-muted-foreground">
                      {new Date(u.createdAt).toLocaleDateString('pt-BR')}
                    </span>
                  </td>
                  <td className="text-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center mx-auto transition-colors">
                          <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-card border-border w-44 text-xs">
                        <DropdownMenuItem
                          className="gap-2 cursor-pointer text-xs"
                          onClick={() => toggleStatus(u.id)}
                        >
                          {u.status === 'active'
                            ? <><UserX className="w-3.5 h-3.5 text-warning" /> Desativar usuário</>
                            : <><UserCheck className="w-3.5 h-3.5 text-success" /> Ativar usuário</>
                          }
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2 cursor-pointer text-xs">
                          <Shield className="w-3.5 h-3.5 text-primary" />
                          Alterar perfil
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-border" />
                        <DropdownMenuItem
                          className="gap-2 cursor-pointer text-xs text-destructive focus:text-destructive focus:bg-destructive/10"
                          onClick={() => setDeleteTarget(u)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Excluir usuário
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} />}
      {deleteTarget && <DeleteConfirmModal user={deleteTarget} onClose={() => setDeleteTarget(null)} />}
    </div>
  );
}
