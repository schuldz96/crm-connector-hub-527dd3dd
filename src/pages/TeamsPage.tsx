import { useState, useEffect, useCallback } from 'react';
import { MOCK_USERS } from '@/data/mockData';
import type { Team } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Plus, Users, Target, Trophy, ChevronRight, Pencil,
  TrendingUp, Video, X, Check, UserPlus, Trash2, Loader2, Search
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { loadTeams, createTeam, updateTeam, deleteTeam } from '@/lib/teamsService';
import { loadAllowedUsers, type AllowedUser } from '@/lib/accessControl';
import { loadAreas, type AreaRecord } from '@/lib/areasService';

// ─── Create / Edit Team Modal ─────────────────────────────────────────────────
function TeamModal({
  team,
  users,
  areas,
  onClose,
  onSave,
}: {
  team?: Team;
  users: AllowedUser[];
  areas: AreaRecord[];
  onClose: () => void;
  onSave: (data: Partial<Team>) => void;
}) {
  const isEdit = !!team;
  const [name, setName] = useState(team?.name ?? '');
  const [supervisorId, setSupervisorId] = useState(team?.supervisorId ?? '');
  const [areaId, setAreaId] = useState(team?.areaId ?? '');
  const [memberIds, setMemberIds] = useState<string[]>(team?.memberIds ?? []);
  const [memberSearch, setMemberSearch] = useState('');
  const [goal, setGoal] = useState(String(team?.goal ?? 40));

  const supervisors = users.filter(u => ['admin', 'director', 'supervisor'].includes(u.role));
  const availableMembers = users;

  const toggleMember = (id: string) =>
    setMemberIds(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({ name: name.trim(), supervisorId, areaId: areaId || undefined, memberIds, goal: Number(goal) });
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            {isEdit ? <Pencil className="w-4 h-4 text-primary" /> : <Plus className="w-4 h-4 text-primary" />}
            {isEdit ? 'Editar Time' : 'Criar Novo Time'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div>
            <label className="text-xs font-medium block mb-1.5">Nome do time</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Equipe Gamma" className="h-9 text-xs bg-secondary border-border" />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5">Supervisor responsável <span className="text-muted-foreground font-normal">(opcional)</span></label>
            <Select value={supervisorId || '__none__'} onValueChange={v => setSupervisorId(v === '__none__' ? '' : v)}>
              <SelectTrigger className="h-9 text-xs bg-secondary border-border">
                <SelectValue placeholder="Selecione um supervisor..." />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="__none__" className="text-xs text-muted-foreground">
                  Nenhum (atribuir depois)
                </SelectItem>
                {supervisors.map(u => (
                  <SelectItem key={`user_${u.email}`} value={`user_${u.email}`} className="text-xs">
                    <div className="flex items-center gap-2">
                      {u.name}
                      <span className="text-muted-foreground">({u.role})</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5">Área <span className="text-muted-foreground font-normal">(opcional)</span></label>
            <Select value={areaId || '__none__'} onValueChange={v => setAreaId(v === '__none__' ? '' : v)}>
              <SelectTrigger className="h-9 text-xs bg-secondary border-border">
                <SelectValue placeholder="Selecione uma área..." />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="__none__" className="text-xs text-muted-foreground">
                  Nenhuma área
                </SelectItem>
                {areas.map(a => (
                  <SelectItem key={a.id} value={a.id} className="text-xs">
                    <div className="flex items-center gap-2">
                      {a.nome}
                      {a.gerente_nome && <span className="text-muted-foreground">({a.gerente_nome})</span>}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5">Meta mensal (reuniões)</label>
            <Input value={goal} onChange={e => setGoal(e.target.value)} type="number" min={1} className="h-9 text-xs bg-secondary border-border" />
          </div>
          <div>
            <label className="text-xs font-medium block mb-2">
              Membros — {memberIds.length} selecionado(s)
            </label>
            <div className="relative mb-2">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Pesquisar membros..."
                value={memberSearch}
                onChange={e => setMemberSearch(e.target.value)}
                className="h-8 text-xs bg-secondary border-border pl-8"
              />
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {availableMembers.filter(u =>
                !memberSearch || u.name.toLowerCase().includes(memberSearch.toLowerCase()) || u.email.toLowerCase().includes(memberSearch.toLowerCase())
              ).map(u => {
                const userId = `user_${u.email}`;
                const selected = memberIds.includes(userId);
                return (
                  <div
                    key={userId}
                    onClick={() => toggleMember(userId)}
                    className={cn(
                      'flex items-center gap-2.5 p-2 rounded-lg border cursor-pointer transition-all',
                      selected ? 'bg-primary/8 border-primary/30' : 'border-border hover:bg-muted/40'
                    )}
                  >
                    <div className="w-7 h-7 rounded-full bg-primary/15 text-primary font-bold flex items-center justify-center flex-shrink-0 text-xs">
                      {u.name[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium">{u.name}</p>
                      <p className="text-[10px] text-muted-foreground">{u.email}</p>
                    </div>
                    <div className={cn('w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0',
                      selected ? 'bg-primary border-primary' : 'border-border')}>
                      {selected && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                    </div>
                  </div>
                );
              })}
              {availableMembers.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-3">Nenhum usuário cadastrado.</p>
              )}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" className="flex-1 bg-gradient-primary text-xs h-9" onClick={handleSave} disabled={!name.trim()}>
              {isEdit ? <><Pencil className="w-3.5 h-3.5 mr-1.5" /> Salvar Alterações</> : <><Plus className="w-3.5 h-3.5 mr-1.5" /> Criar Time</>}
            </Button>
            <Button size="sm" variant="outline" className="text-xs border-border h-9" onClick={onClose}>Cancelar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Delete confirm ───────────────────────────────────────────────────────────
function DeleteTeamModal({ team, onClose, onConfirm }: { team: Team; onClose: () => void; onConfirm: () => void }) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold text-destructive flex items-center gap-2">
            <Trash2 className="w-4 h-4" /> Excluir Time
          </DialogTitle>
        </DialogHeader>
        <div className="py-2 space-y-4">
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja excluir <span className="text-foreground font-semibold">{team.name}</span>? Esta ação é irreversível.
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" className="flex-1 text-xs h-9" onClick={() => { onConfirm(); onClose(); }}>
              <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Confirmar Exclusão
            </Button>
            <Button size="sm" variant="outline" className="text-xs border-border h-9" onClick={onClose}>Cancelar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const roleLabels: Record<string, string> = {
  admin: 'Admin', director: 'Diretor', supervisor: 'Supervisor', bdr: 'BDR', sdr: 'SDR', closer: 'Closer', key_account: 'Key Account', csm: 'CSM', low_touch: 'Low Touch', member: 'Membro'
};

export default function TeamsPage() {
  const { toast } = useToast();
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<AllowedUser[]>([]);
  const [areas, setAreas] = useState<AreaRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<Team | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Team | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [teamsData, usersData, areasData] = await Promise.all([loadTeams(), loadAllowedUsers(), loadAreas()]);
      setTeams(teamsData);
      setUsers(usersData);
      setAreas(areasData);
      if (teamsData.length > 0 && !selected) setSelected(teamsData[0].id);
    } catch (e: any) {
      console.error('[teams] fetch error:', e);
      toast({ variant: 'destructive', title: 'Erro ao carregar times', description: e.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const team = teams.find(t => t.id === selected) ?? null;

  // Find user info by id (format: user_email@...)
  const findUser = (userId: string): AllowedUser | undefined => {
    const email = userId.replace(/^(user_|google_)/, '');
    return users.find(u => u.email === email);
  };

  const findArea = (areaId?: string): AreaRecord | undefined => areas.find(a => a.id === areaId);

  const teamStats = team ? [
    { label: 'Membros', value: String(team.memberIds.length), icon: Users },
    { label: 'Meta', value: `${team.goal ?? 0}`, icon: Target },
  ] : [];

  const handleCreate = async (data: Partial<Team>) => {
    try {
      const newTeam = await createTeam(data);
      setTeams(prev => [newTeam, ...prev]);
      setSelected(newTeam.id);
      toast({ title: 'Time criado', description: `${newTeam.name} foi criado com sucesso.` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao criar time', description: e.message });
    }
  };

  const handleEdit = async (data: Partial<Team>) => {
    if (!editTarget) return;
    try {
      await updateTeam(editTarget.id, data);
      setTeams(prev => prev.map(t => t.id === editTarget.id ? { ...t, ...data } : t));
      toast({ title: 'Time atualizado', description: 'As alterações foram salvas.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao atualizar', description: e.message });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteTeam(deleteTarget.id);
      setTeams(prev => prev.filter(t => t.id !== deleteTarget.id));
      if (selected === deleteTarget.id) {
        const remaining = teams.filter(t => t.id !== deleteTarget.id);
        setSelected(remaining[0]?.id ?? '');
      }
      toast({ title: 'Time excluído', variant: 'destructive' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao excluir', description: e.message });
    }
  };

  if (loading) {
    return (
      <div className="page-container animate-fade-in flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Carregando times...</span>
      </div>
    );
  }

  return (
    <div className="page-container animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold">Times</h1>
          <p className="text-sm text-muted-foreground">Gerencie equipes e performance</p>
        </div>
        <Button size="sm" className="bg-gradient-primary text-xs h-8" onClick={() => setShowCreate(true)}>
          <Plus className="w-3.5 h-3.5 mr-1.5" /> Criar Time
        </Button>
      </div>

      <div className="flex gap-6">
        {/* Teams List */}
        <div className="w-72 flex-shrink-0 space-y-3">
          {teams.map(t => {
            const sup = findUser(t.supervisorId);
            const memberCount = t.memberIds.length;
            return (
              <div
                key={t.id}
                className={cn('glass-card p-4 cursor-pointer transition-all group', selected === t.id ? 'border-primary/30' : 'hover:border-border/80')}
                onClick={() => setSelected(t.id)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Users className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{t.name}</p>
                      {sup ? (
                        <p className="text-xs text-muted-foreground truncate">{sup.name}</p>
                      ) : (
                        <p className="text-xs text-amber-500 truncate">Sem supervisor</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 ml-1">
                    <button
                      onClick={e => { e.stopPropagation(); setEditTarget(t); }}
                      className="w-6 h-6 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-all"
                      title="Editar time"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); setDeleteTarget(t); }}
                      className="w-6 h-6 rounded-md hover:bg-destructive/10 flex items-center justify-center text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                      title="Excluir time"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                    <ChevronRight className={cn('w-4 h-4 text-muted-foreground transition-transform', selected === t.id && 'rotate-90 text-primary')} />
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {findArea(t.areaId) && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-medium">
                      {findArea(t.areaId)!.nome}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">{memberCount} membros</span>
                  {t.goal && <span className="text-xs text-muted-foreground">· Meta: {t.goal}</span>}
                </div>
              </div>
            );
          })}
          {teams.length === 0 && (
            <div className="glass-card p-5 text-center">
              <p className="text-sm font-medium mb-1">Nenhum time criado</p>
              <p className="text-xs text-muted-foreground mb-3">Comece criando seu primeiro time.</p>
              <Button size="sm" className="bg-gradient-primary text-xs h-8" onClick={() => setShowCreate(true)}>
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Criar Time
              </Button>
            </div>
          )}
        </div>

        {/* Team Detail */}
        {team && (
          <div className="flex-1 space-y-4">
            <div className="glass-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-display font-bold">{team.name}</h2>
                <Button variant="outline" size="sm" className="text-xs h-7 border-border gap-1.5" onClick={() => setEditTarget(team)}>
                  <Pencil className="w-3 h-3" /> Editar
                </Button>
              </div>
              {findArea(team.areaId) && (
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xs text-muted-foreground">Área:</span>
                  <span className="text-xs px-2 py-0.5 rounded-lg bg-primary/10 text-primary border border-primary/20 font-medium">
                    {findArea(team.areaId)!.nome}
                  </span>
                  {findArea(team.areaId)!.gerente_nome && (
                    <span className="text-xs text-muted-foreground">· Gerente: {findArea(team.areaId)!.gerente_nome}</span>
                  )}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                {teamStats.map(s => (
                  <div key={s.label} className="text-center p-3 rounded-xl bg-muted/50">
                    <s.icon className="w-5 h-5 mx-auto mb-1 text-primary" />
                    <p className="text-xl font-display font-bold">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-card p-5">
              <h3 className="section-title mb-4">Supervisor</h3>
              {team.supervisorId && findUser(team.supervisorId) ? (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/15 text-primary font-bold flex items-center justify-center text-sm">
                    {findUser(team.supervisorId)!.name[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold">{findUser(team.supervisorId)!.name}</p>
                    <p className="text-xs text-muted-foreground">{findUser(team.supervisorId)!.email}</p>
                  </div>
                  <Badge className="ml-auto text-xs" style={{ background: 'hsl(var(--primary)/0.15)', color: 'hsl(var(--primary))', border: '1px solid hsl(var(--primary)/0.2)' }}>
                    {roleLabels[findUser(team.supervisorId)!.role] || findUser(team.supervisorId)!.role}
                  </Badge>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <div className="w-10 h-10 rounded-full bg-amber-500/15 text-amber-500 font-bold flex items-center justify-center text-sm">
                    ?
                  </div>
                  <div>
                    <p className="font-semibold text-amber-600 dark:text-amber-400">Sem supervisor atribuído</p>
                    <p className="text-xs text-muted-foreground">Clique em "Editar" para atribuir um responsável</p>
                  </div>
                </div>
              )}
            </div>

            <div className="glass-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="section-title">Membros ({team.memberIds.length})</h3>
                <Button size="sm" variant="outline" className="text-xs h-7 border-border gap-1" onClick={() => setEditTarget(team)}>
                  <UserPlus className="w-3 h-3" /> Gerenciar
                </Button>
              </div>
              <div className="space-y-3">
                {team.memberIds.map((mId, i) => {
                  const m = findUser(mId);
                  if (!m) return null;
                  return (
                    <div key={mId} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/60 transition-colors">
                      <span className="text-sm font-bold text-muted-foreground w-5">{i + 1}</span>
                      <div className="w-8 h-8 rounded-full bg-primary/15 text-primary font-bold flex items-center justify-center text-xs flex-shrink-0">
                        {m.name[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{m.name}</p>
                        <p className="text-xs text-muted-foreground">{m.email}</p>
                      </div>
                      <Badge className="text-[10px]" style={{ background: 'hsl(var(--primary)/0.1)', color: 'hsl(var(--primary))', border: '1px solid hsl(var(--primary)/0.15)' }}>
                        {roleLabels[m.role] || m.role}
                      </Badge>
                    </div>
                  );
                })}
                {team.memberIds.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">Nenhum membro neste time. Clique em "Gerenciar" para adicionar.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {showCreate && <TeamModal users={users} areas={areas} onClose={() => setShowCreate(false)} onSave={handleCreate} />}
      {editTarget && <TeamModal team={editTarget} users={users} areas={areas} onClose={() => setEditTarget(null)} onSave={handleEdit} />}
      {deleteTarget && <DeleteTeamModal team={deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} />}
    </div>
  );
}
