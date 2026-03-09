import { useState } from 'react';
import { MOCK_USERS } from '@/data/mockData';
import type { User, UserRole } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Plus, Search, Mail, MoreHorizontal, Trash2, UserX, UserCheck,
  UserPlus, Eye, EyeOff, Shield, SlidersHorizontal, AlertTriangle,
  Smartphone, Wifi, WifiOff, Loader2, Link2, Link2Off
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAppConfig, DEFAULT_MODULES, type ModuleId } from '@/contexts/AppConfigContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { useEvolutionInstances, getInstanceForUser, setInstanceForUser } from '@/hooks/useEvolutionInstances';

const ROLE_CONFIG: Record<UserRole, { label: string; class: string }> = {
  admin:       { label: 'Admin',        class: 'bg-destructive/10 text-destructive border-destructive/20' },
  ceo:         { label: 'CEO',          class: 'bg-destructive/10 text-destructive border-destructive/30' },
  director:    { label: 'Diretor',      class: 'bg-primary/10 text-primary border-primary/20' },
  manager:     { label: 'Gerente',      class: 'bg-accent/15 text-accent border-accent/30' },
  coordinator: { label: 'Coordenador',  class: 'bg-warning/10 text-warning border-warning/20' },
  supervisor:  { label: 'Supervisor',   class: 'bg-success/10 text-success border-success/20' },
  member:      { label: 'Vendedor',     class: 'bg-muted text-muted-foreground border-border' },
};

// ─── Create user modal ────────────────────────────────────────────────────────
function CreateUserModal({ onClose }: { onClose: () => void }) {
  const [showPass, setShowPass] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', role: 'member', password: '' });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-primary" /> Criar Novo Usuário
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div>
            <label className="text-xs font-medium block mb-1.5">Nome completo</label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: João Silva" className="h-9 text-xs bg-secondary border-border" />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5">E-mail</label>
            <Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="joao@appmax.com.br" type="email" className="h-9 text-xs bg-secondary border-border" />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5">Perfil</label>
            <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
              <SelectTrigger className="h-9 text-xs bg-secondary border-border"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="member"      className="text-xs">Vendedor</SelectItem>
                <SelectItem value="supervisor"  className="text-xs">Supervisor</SelectItem>
                <SelectItem value="coordinator" className="text-xs">Coordenador</SelectItem>
                <SelectItem value="manager"     className="text-xs">Gerente</SelectItem>
                <SelectItem value="director"    className="text-xs">Diretor</SelectItem>
                <SelectItem value="ceo"         className="text-xs">CEO</SelectItem>
                <SelectItem value="admin"       className="text-xs">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5">Senha temporária</label>
            <div className="relative">
              <Input value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} type={showPass ? 'text' : 'password'} placeholder="Mínimo 8 caracteres" className="h-9 text-xs bg-secondary border-border pr-9" />
              <button onClick={() => setShowPass(s => !s)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
            <p className="text-[11px] text-muted-foreground">O usuário receberá um e-mail de boas-vindas e deverá redefinir a senha no primeiro acesso.</p>
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" className="flex-1 bg-gradient-primary text-xs h-9"><UserPlus className="w-3.5 h-3.5 mr-1.5" /> Criar Usuário</Button>
            <Button size="sm" variant="outline" className="text-xs border-border h-9" onClick={onClose}>Cancelar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Change role modal ────────────────────────────────────────────────────────
function ChangeRoleModal({ user, onClose, onSave }: { user: User; onClose: () => void; onSave: (role: UserRole) => void }) {
  const [role, setRole] = useState<UserRole>(user.role);
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" /> Alterar Perfil de Acesso
          </DialogTitle>
        </DialogHeader>
        <div className="py-2 space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
            <img src={user.avatar} alt={user.name} className="w-9 h-9 rounded-full border border-border" />
            <div>
              <p className="text-xs font-semibold">{user.name}</p>
              <p className="text-[11px] text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5">Novo perfil</label>
            <Select value={role} onValueChange={v => setRole(v as UserRole)}>
              <SelectTrigger className="h-9 text-xs bg-secondary border-border"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="member"      className="text-xs">Vendedor — acesso básico</SelectItem>
                <SelectItem value="supervisor"  className="text-xs">Supervisor — vê seu time</SelectItem>
                <SelectItem value="coordinator" className="text-xs">Coordenador — vê sua área</SelectItem>
                <SelectItem value="manager"     className="text-xs">Gerente — gestão de área</SelectItem>
                <SelectItem value="director"    className="text-xs">Diretor — vê todos os times</SelectItem>
                <SelectItem value="ceo"         className="text-xs">CEO — visão total</SelectItem>
                <SelectItem value="admin"       className="text-xs">Admin — acesso total</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1 bg-gradient-primary text-xs h-9" onClick={() => { onSave(role); onClose(); }}>
              <Shield className="w-3.5 h-3.5 mr-1.5" /> Confirmar
            </Button>
            <Button size="sm" variant="outline" className="text-xs border-border h-9" onClick={onClose}>Cancelar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Confirm action modal (deactivate / delete) ───────────────────────────────
function ConfirmModal({
  user, action, onClose, onConfirm,
}: {
  user: User;
  action: 'deactivate' | 'activate' | 'delete';
  onClose: () => void;
  onConfirm: () => void;
}) {
  const isDelete = action === 'delete';
  const isDeactivate = action === 'deactivate';
  const title = isDelete ? 'Excluir Usuário' : isDeactivate ? 'Desativar Usuário' : 'Ativar Usuário';
  const desc = isDelete
    ? `Tem certeza que deseja excluir <strong>${user.name}</strong>? Esta ação é irreversível e removerá todos os dados do usuário.`
    : isDeactivate
    ? `Tem certeza que deseja desativar <strong>${user.name}</strong>? O usuário perderá acesso à plataforma imediatamente.`
    : `Tem certeza que deseja reativar <strong>${user.name}</strong>?`;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader>
          <DialogTitle className={cn('text-sm font-semibold flex items-center gap-2', isDelete || isDeactivate ? 'text-destructive' : 'text-success')}>
            <AlertTriangle className="w-4 h-4" /> {title}
          </DialogTitle>
        </DialogHeader>
        <div className="py-2 space-y-4">
          <p className="text-sm text-muted-foreground" dangerouslySetInnerHTML={{ __html: desc }} />
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
            <img src={user.avatar} alt={user.name} className="w-9 h-9 rounded-full border border-border" />
            <div>
              <p className="text-xs font-semibold">{user.name}</p>
              <p className="text-[11px] text-muted-foreground">{user.email}</p>
            </div>
            <span className={cn('ml-auto text-[10px] px-2 py-0.5 rounded-full border',
              user.status === 'active' ? 'bg-success/10 text-success border-success/20' : 'bg-muted text-muted-foreground border-border')}>
              {user.status === 'active' ? 'Ativo' : 'Inativo'}
            </span>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              className={cn('flex-1 text-xs h-9', isDelete || isDeactivate ? 'bg-destructive hover:bg-destructive/90 text-white' : 'bg-success hover:bg-success/90 text-white')}
              onClick={() => { onConfirm(); onClose(); }}
            >
              {isDelete ? <><Trash2 className="w-3.5 h-3.5 mr-1.5" /> Excluir</> : isDeactivate ? <><UserX className="w-3.5 h-3.5 mr-1.5" /> Desativar</> : <><UserCheck className="w-3.5 h-3.5 mr-1.5" /> Ativar</>}
            </Button>
            <Button size="sm" variant="outline" className="text-xs border-border h-9" onClick={onClose}>Cancelar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── User profile + module permissions modal ──────────────────────────────────
function UserProfileModal({ user, onClose }: { user: User; onClose: () => void }) {
  const { getUserDisabledModules, setUserModuleOverride, modules } = useAppConfig();
  const { toast } = useToast();
  const { instances, loading: loadingInst } = useEvolutionInstances();
  const [disabled, setDisabled] = useState<ModuleId[]>(getUserDisabledModules(user.id));
  // stored as instance.name (the Evolution instance name)
  const [selectedInstance, setSelectedInstance] = useState(() => getInstanceForUser(user.id));

  const toggle = (id: ModuleId) => {
    setDisabled(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);
  };

  const globallyDisabled = new Set(modules.filter(m => !m.enabled).map(m => m.id));

  const assignedInst = instances.find(i => i.name === selectedInstance);

  const save = () => {
    setUserModuleOverride(user.id, disabled);
    setInstanceForUser(user.id, selectedInstance);
    toast({ title: 'Perfil salvo', description: `Configurações de ${user.name} atualizadas.` });
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-primary" /> Perfil & Permissões — {user.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border">
            <img src={user.avatar} alt={user.name} className="w-10 h-10 rounded-full border border-border" />
            <div className="flex-1">
              <p className="text-sm font-semibold">{user.name}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
            <span className={cn('text-[10px] px-2 py-0.5 rounded-full border font-medium', ROLE_CONFIG[user.role].class)}>
              {ROLE_CONFIG[user.role].label}
            </span>
          </div>

          {/* WhatsApp instance assignment */}
          <div className="p-3 rounded-xl border border-border space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-accent" />
                <label className="text-xs font-semibold">Instância WhatsApp (Evolution)</label>
              </div>
              {loadingInst && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
            </div>

            <Select value={selectedInstance || '__none__'} onValueChange={v => setSelectedInstance(v === '__none__' ? '' : v)}>
              <SelectTrigger className="h-9 text-xs bg-secondary border-border">
                <SelectValue placeholder={loadingInst ? 'Carregando instâncias...' : 'Selecionar instância...'} />
              </SelectTrigger>
              <SelectContent className="bg-card border-border max-h-60">
                <SelectItem value="__none__" className="text-xs text-muted-foreground">— Sem instância —</SelectItem>
                {instances.map(inst => {
                  const isOpen = inst.connectionStatus === 'open';
                  const phone = inst.ownerJid?.replace('@s.whatsapp.net', '');
                  return (
                    <SelectItem key={inst.id} value={inst.name} className="text-xs">
                      <div className="flex items-center gap-2">
                        <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0',
                          isOpen ? 'bg-success' : 'bg-muted-foreground')} />
                        <span className="truncate max-w-[140px]">{inst.profileName || inst.name}</span>
                        {phone && <span className="text-muted-foreground font-mono text-[10px]">{phone}</span>}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            {assignedInst && (
              <div className={cn(
                'flex items-center gap-2 text-[10px] px-3 py-2 rounded-lg border',
                assignedInst.connectionStatus === 'open'
                  ? 'bg-success/5 border-success/20 text-success'
                  : 'bg-muted/30 border-border text-muted-foreground'
              )}>
                {assignedInst.profilePicUrl
                  ? <img src={assignedInst.profilePicUrl} className="w-5 h-5 rounded-full border border-border" alt="" />
                  : <Smartphone className="w-3.5 h-3.5" />
                }
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{assignedInst.profileName || assignedInst.name}</p>
                  <p className="text-[9px] font-mono opacity-70">
                    {assignedInst.ownerJid?.replace('@s.whatsapp.net', '') || assignedInst.name}
                  </p>
                </div>
                {assignedInst.connectionStatus === 'open'
                  ? <Wifi className="w-3 h-3 ml-auto" />
                  : <WifiOff className="w-3 h-3 ml-auto opacity-50" />
                }
                <span className="font-medium">
                  {assignedInst.connectionStatus === 'open' ? 'Conectado' : 'Desconectado'}
                </span>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold">Módulos visíveis</label>
              <span className="text-[10px] text-muted-foreground">{DEFAULT_MODULES.length - disabled.length} de {DEFAULT_MODULES.length} ativos</span>
            </div>
            <div className="space-y-1.5">
              {DEFAULT_MODULES.filter(m => m.id !== 'admin').map(mod => {
                const isGloballyOff = globallyDisabled.has(mod.id);
                const isDisabledForUser = disabled.includes(mod.id);
                const isOn = !isGloballyOff && !isDisabledForUser;
                return (
                  <div key={mod.id} className={cn('flex items-center justify-between px-3 py-2 rounded-lg border transition-colors',
                    isOn ? 'bg-muted/30 border-border/50' : 'bg-muted/10 border-border/20 opacity-60')}>
                    <div className="flex items-center gap-2">
                      {isOn ? <CheckCircle2 className="w-3.5 h-3.5 text-success" /> : <AlertCircle className="w-3.5 h-3.5 text-muted-foreground" />}
                      <span className="text-xs font-medium">{mod.label}</span>
                      {isGloballyOff && <span className="text-[9px] text-muted-foreground">(global)</span>}
                    </div>
                    <button disabled={isGloballyOff} onClick={() => toggle(mod.id)}
                      className={cn('w-8 h-4 rounded-full border transition-all relative',
                        isOn ? 'bg-primary border-primary/50' : 'bg-muted border-border',
                        isGloballyOff && 'opacity-30 cursor-not-allowed')}>
                      <span className={cn('absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all', isOn ? 'left-4' : 'left-0.5')} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" className="flex-1 bg-gradient-primary text-xs h-9" onClick={save}>
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Salvar
            </Button>
            <Button size="sm" variant="outline" className="text-xs border-border h-9" onClick={onClose}>Cancelar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const { instances } = useEvolutionInstances();
  const [users, setUsers] = useState(MOCK_USERS);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<{ user: User; action: 'deactivate' | 'activate' | 'delete' } | null>(null);
  const [roleTarget, setRoleTarget] = useState<User | null>(null);
  const [profileTarget, setProfileTarget] = useState<User | null>(null);

  const filtered = users.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const handleToggleStatus = (u: User) => {
    if (u.id === currentUser?.id) {
      toast({ variant: 'destructive', title: 'Ação bloqueada', description: 'Você não pode desativar sua própria conta.' });
      return;
    }
    setConfirmTarget({ user: u, action: u.status === 'active' ? 'deactivate' : 'activate' });
  };

  const handleDelete = (u: User) => {
    if (u.id === currentUser?.id) {
      toast({ variant: 'destructive', title: 'Ação bloqueada', description: 'Você não pode excluir sua própria conta.' });
      return;
    }
    setConfirmTarget({ user: u, action: 'delete' });
  };

  const confirmAction = () => {
    if (!confirmTarget) return;
    const { user: u, action } = confirmTarget;
    if (action === 'delete') {
      setUsers(prev => prev.filter(x => x.id !== u.id));
      toast({ title: 'Usuário excluído', variant: 'destructive' });
    } else {
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, status: action === 'deactivate' ? 'inactive' : 'active' } : x));
      toast({ title: action === 'deactivate' ? 'Usuário desativado' : 'Usuário ativado' });
    }
  };

  const handleRoleSave = (role: UserRole) => {
    if (!roleTarget) return;
    setUsers(prev => prev.map(u => u.id === roleTarget.id ? { ...u, role } : u));
    toast({ title: 'Perfil atualizado', description: `${roleTarget.name} agora é ${ROLE_CONFIG[role].label}.` });
  };

  return (
    <div className="page-container animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold">Usuários</h1>
          <p className="text-sm text-muted-foreground">{users.length} usuários cadastrados</p>
        </div>
        <Button size="sm" className="bg-gradient-primary text-xs h-8" onClick={() => setShowCreate(true)}>
          <Plus className="w-3.5 h-3.5 mr-1.5" /> Criar Usuário
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar usuários..." className="pl-9 h-8 text-xs bg-secondary border-border" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {['all', 'admin', 'director', 'supervisor', 'member'].map(r => (
            <button key={r} onClick={() => setRoleFilter(r)}
              className={cn('text-xs px-3 py-1.5 rounded-lg border transition-all',
                roleFilter === r ? 'bg-primary/15 border-primary/30 text-primary' : 'border-border text-muted-foreground hover:bg-muted')}>
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
              <th className="text-center hidden xl:table-cell">WhatsApp</th>
              <th className="text-center hidden xl:table-cell">Google</th>
              <th className="text-center">Perfil</th>
              <th className="text-center">Status</th>
              <th className="text-center hidden lg:table-cell">Desde</th>
              <th className="text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(u => {
              const rc = ROLE_CONFIG[u.role];
              const isSelf = u.id === currentUser?.id;
              const instName = getInstanceForUser(u.id);
              const assignedInst = instances.find(i => i.name === instName);
              const isInstOpen = assignedInst?.connectionStatus === 'open';
              // Google: persisted per user in localStorage by Google OAuth flow
              const googleConnected = !!localStorage.getItem(`google_connected_${u.id}`);
              return (
                <tr key={u.id} className={cn(u.status === 'inactive' && 'opacity-60')}>
                  <td>
                    <div className="flex items-center gap-3">
                      <img src={u.avatar} alt={u.name} className="w-8 h-8 rounded-full border border-border" />
                      <div>
                        <p className="text-sm font-medium flex items-center gap-1.5">
                          {u.name}
                          {isSelf && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">Você</span>}
                        </p>
                        <p className="text-xs text-muted-foreground md:hidden">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="hidden md:table-cell">
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Mail className="w-3.5 h-3.5" /> {u.email}
                    </div>
                  </td>
                  <td className="hidden xl:table-cell text-center">
                    {assignedInst ? (
                      <div className="flex items-center justify-center gap-1.5">
                        <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', isInstOpen ? 'bg-success' : 'bg-muted-foreground')} />
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {assignedInst.ownerJid?.replace('@s.whatsapp.net', '') || assignedInst.name}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-muted-foreground/40">—</span>
                    )}
                  </td>
                  {/* Google column */}
                  <td className="hidden xl:table-cell text-center">
                    {googleConnected ? (
                      <div className="flex items-center justify-center gap-1.5">
                        <Link2 className="w-3.5 h-3.5 text-success" />
                        <span className="text-[10px] text-success font-medium">Conectado</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-1.5">
                        <Link2Off className="w-3.5 h-3.5 text-muted-foreground/40" />
                        <span className="text-[10px] text-muted-foreground/40">Desconectado</span>
                      </div>
                    )}
                  </td>
                  <td className="text-center">
                    <span className={cn('text-xs px-2.5 py-0.5 rounded-full border font-medium', rc.class)}>{rc.label}</span>
                  </td>
                  <td className="text-center">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full border',
                      u.status === 'active' ? 'bg-success/10 text-success border-success/20' : 'bg-muted text-muted-foreground border-border')}>
                      {u.status === 'active' ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="text-center hidden lg:table-cell">
                    <span className="text-xs text-muted-foreground">{new Date(u.createdAt).toLocaleDateString('pt-BR')}</span>
                  </td>
                  <td className="text-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center mx-auto transition-colors">
                          <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-card border-border w-48 text-xs">
                        <DropdownMenuItem className="gap-2 cursor-pointer text-xs" onClick={() => setProfileTarget(u)}>
                          <SlidersHorizontal className="w-3.5 h-3.5 text-primary" /> Módulos visíveis
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2 cursor-pointer text-xs" onClick={() => setRoleTarget(u)}>
                          <Shield className="w-3.5 h-3.5 text-accent" /> Alterar perfil
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className={cn('gap-2 cursor-pointer text-xs', isSelf && 'opacity-40 cursor-not-allowed')}
                          onClick={() => handleToggleStatus(u)}
                        >
                          {u.status === 'active'
                            ? <><UserX className="w-3.5 h-3.5 text-warning" /> Desativar usuário</>
                            : <><UserCheck className="w-3.5 h-3.5 text-success" /> Ativar usuário</>}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-border" />
                        <DropdownMenuItem
                          className={cn('gap-2 cursor-pointer text-xs text-destructive focus:text-destructive focus:bg-destructive/10', isSelf && 'opacity-40 cursor-not-allowed')}
                          onClick={() => handleDelete(u)}
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Excluir usuário
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

      {showCreate    && <CreateUserModal onClose={() => setShowCreate(false)} />}
      {roleTarget    && <ChangeRoleModal user={roleTarget} onClose={() => setRoleTarget(null)} onSave={handleRoleSave} />}
      {profileTarget && <UserProfileModal user={profileTarget} onClose={() => setProfileTarget(null)} />}
      {confirmTarget && (
        <ConfirmModal
          user={confirmTarget.user}
          action={confirmTarget.action}
          onClose={() => setConfirmTarget(null)}
          onConfirm={confirmAction}
        />
      )}
    </div>
  );
}
