import { useState } from 'react';
import { MOCK_TEAMS, MOCK_USERS } from '@/data/mockData';
import type { Team } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Plus, Users, Target, Trophy, ChevronRight, Pencil,
  TrendingUp, Video, X, Check, UserPlus, Trash2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

// ─── Create / Edit Team Modal ─────────────────────────────────────────────────
function TeamModal({
  team,
  onClose,
  onSave,
}: {
  team?: Team;
  onClose: () => void;
  onSave: (data: Partial<Team>) => void;
}) {
  const isEdit = !!team;
  const [name, setName] = useState(team?.name ?? '');
  const [supervisorId, setSupervisorId] = useState(team?.supervisorId ?? '');
  const [memberIds, setMemberIds] = useState<string[]>(team?.memberIds ?? []);
  const [goal, setGoal] = useState(String(team?.goal ?? 40));

  const supervisors = MOCK_USERS.filter(u => ['admin', 'director', 'supervisor'].includes(u.role));
  const availableMembers = MOCK_USERS.filter(u => u.role === 'member');

  const toggleMember = (id: string) =>
    setMemberIds(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({ name: name.trim(), supervisorId, memberIds, goal: Number(goal) });
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
            <label className="text-xs font-medium block mb-1.5">Supervisor responsável</label>
            <Select value={supervisorId} onValueChange={setSupervisorId}>
              <SelectTrigger className="h-9 text-xs bg-secondary border-border">
                <SelectValue placeholder="Selecione um supervisor..." />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {supervisors.map(u => (
                  <SelectItem key={u.id} value={u.id} className="text-xs">
                    <div className="flex items-center gap-2">
                      <img src={u.avatar} alt={u.name} className="w-5 h-5 rounded-full" />
                      {u.name}
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
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {availableMembers.map(u => {
                const selected = memberIds.includes(u.id);
                return (
                  <div
                    key={u.id}
                    onClick={() => toggleMember(u.id)}
                    className={cn(
                      'flex items-center gap-2.5 p-2 rounded-lg border cursor-pointer transition-all',
                      selected ? 'bg-primary/8 border-primary/30' : 'border-border hover:bg-muted/40'
                    )}
                  >
                    <img src={u.avatar} alt={u.name} className="w-7 h-7 rounded-full border border-border" />
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
  admin: 'Admin', director: 'Diretor', supervisor: 'Supervisor', member: 'Vendedor'
};

export default function TeamsPage() {
  const { toast } = useToast();
  const [teams, setTeams] = useState(MOCK_TEAMS);
  const [selected, setSelected] = useState(MOCK_TEAMS[0]?.id ?? '');
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<Team | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Team | null>(null);

  const team = teams.find(t => t.id === selected) ?? null;
  const supervisor = team ? MOCK_USERS.find(u => u.id === team.supervisorId) : null;
  const members = team ? MOCK_USERS.filter(u => team.memberIds.includes(u.id)) : [];

  const teamStats = team ? [
    { label: 'Reuniões',    value: selected === 'team_001' ? '32' : '25', icon: Video },
    { label: 'Score Médio', value: selected === 'team_001' ? '79' : '73', icon: Trophy },
    { label: 'Meta',        value: `${team?.goal ?? 0}`,                  icon: Target },
  ] : [];

  const handleCreate = (data: Partial<Team>) => {
    const newTeam: Team = {
      id: `team_${Date.now()}`,
      name: data.name!,
      supervisorId: data.supervisorId!,
      memberIds: data.memberIds ?? [],
      companyId: 'comp_001',
      goal: data.goal,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    setTeams(prev => [...prev, newTeam]);
    setSelected(newTeam.id);
    toast({ title: 'Time criado', description: `${newTeam.name} foi criado com sucesso.` });
  };

  const handleEdit = (data: Partial<Team>) => {
    setTeams(prev => prev.map(t => t.id === editTarget!.id ? { ...t, ...data } : t));
    toast({ title: 'Time atualizado', description: 'As alterações foram salvas.' });
  };

  const handleDelete = () => {
    setTeams(prev => prev.filter(t => t.id !== deleteTarget!.id));
    if (selected === deleteTarget!.id) setSelected(teams.filter(t => t.id !== deleteTarget!.id)[0]?.id ?? '');
    toast({ title: 'Time excluído', variant: 'destructive' });
  };

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
            const sup = MOCK_USERS.find(u => u.id === t.supervisorId);
            const mbrs = MOCK_USERS.filter(u => t.memberIds.includes(u.id));
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
                      <p className="text-xs text-muted-foreground truncate">{sup?.name ?? '—'}</p>
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
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {mbrs.slice(0, 3).map(m => (
                      <img key={m.id} src={m.avatar} alt={m.name} className="w-6 h-6 rounded-full border-2 border-card" />
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">{mbrs.length} membros</span>
                </div>
              </div>
            );
          })}
          {teams.length === 0 && (
            <div className="glass-card p-5 text-center">
              <p className="text-sm font-medium mb-1">Nenhum time criado</p>
              <p className="text-xs text-muted-foreground mb-3">Comece criando seu primeiro time real.</p>
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
              <div className="grid grid-cols-3 gap-4">
                {teamStats.map(s => (
                  <div key={s.label} className="text-center p-3 rounded-xl bg-muted/50">
                    <s.icon className="w-5 h-5 mx-auto mb-1 text-primary" />
                    <p className="text-xl font-display font-bold">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {supervisor && (
              <div className="glass-card p-5">
                <h3 className="section-title mb-4">Supervisor</h3>
                <div className="flex items-center gap-3">
                  <img src={supervisor.avatar} alt={supervisor.name} className="w-10 h-10 rounded-full border border-border" />
                  <div>
                    <p className="font-semibold">{supervisor.name}</p>
                    <p className="text-xs text-muted-foreground">{supervisor.email}</p>
                  </div>
                  <Badge className="ml-auto text-xs" style={{ background: 'hsl(var(--primary)/0.15)', color: 'hsl(var(--primary))', border: '1px solid hsl(var(--primary)/0.2)' }}>
                    {roleLabels[supervisor.role]}
                  </Badge>
                </div>
              </div>
            )}

            <div className="glass-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="section-title">Membros ({members.length})</h3>
                <Button size="sm" variant="outline" className="text-xs h-7 border-border gap-1" onClick={() => setEditTarget(team)}>
                  <UserPlus className="w-3 h-3" /> Gerenciar
                </Button>
              </div>
              <div className="space-y-3">
                {members.map((m, i) => (
                  <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/60 transition-colors">
                    <span className="text-sm font-bold text-muted-foreground w-5">{i + 1}</span>
                    <img src={m.avatar} alt={m.name} className="w-8 h-8 rounded-full border border-border" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{m.name}</p>
                      <p className="text-xs text-muted-foreground">{m.email}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right hidden sm:block">
                        <p className="text-xs text-muted-foreground">Score</p>
                        <div className="flex items-center gap-2">
                          <Progress value={i === 0 ? 91 : i === 1 ? 87 : 72} className="w-16 h-1" />
                          <span className="text-xs font-medium">{i === 0 ? 91 : i === 1 ? 87 : 72}</span>
                        </div>
                      </div>
                      <span className={cn('text-[10px] px-2 py-0.5 rounded-full border',
                        m.status === 'active' ? 'bg-success/10 text-success border-success/20' : 'bg-muted text-muted-foreground border-border')}>
                        {m.status === 'active' ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                  </div>
                ))}
                {members.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">Nenhum membro neste time. Clique em "Gerenciar" para adicionar.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {showCreate  && <TeamModal onClose={() => setShowCreate(false)} onSave={handleCreate} />}
      {editTarget  && <TeamModal team={editTarget} onClose={() => setEditTarget(null)} onSave={handleEdit} />}
      {deleteTarget && <DeleteTeamModal team={deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} />}
    </div>
  );
}
