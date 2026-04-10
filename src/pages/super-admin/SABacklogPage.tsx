import { useState, useEffect } from 'react';
import {
  getBacklogTasks, createBacklogTask, updateBacklogTask, deleteBacklogTask,
  type BacklogTask,
} from '@/lib/superAdminService';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Loader2, Plus, KanbanSquare, List, Trash2, GripVertical,
  Bug, Sparkles, Wrench, FileCode, FileText, Clock, User,
  ChevronRight, AlertCircle, ArrowUp, ArrowRight, ArrowDown, Flame,
  Settings2, MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Constants ──────────────────────────────────────────────────────────────────

const COLUMNS = [
  { id: 'backlog',     label: 'Backlog',           emoji: '📋', color: 'border-zinc-500/30' },
  { id: 'analyzing',   label: 'Analisando',        emoji: '🔍', color: 'border-yellow-500/30' },
  { id: 'planning',    label: 'Planejando',        emoji: '🗺️', color: 'border-blue-500/30' },
  { id: 'developing',  label: 'Desenvolvendo',     emoji: '💻', color: 'border-purple-500/30' },
  { id: 'reviewing',   label: 'Revisando',         emoji: '👀', color: 'border-orange-500/30' },
  { id: 'testing',     label: 'Testando',          emoji: '✅', color: 'border-cyan-500/30' },
  { id: 'deploying',   label: 'Deployando',        emoji: '🚀', color: 'border-pink-500/30' },
  { id: 'done',        label: 'Concluído',         emoji: '✨', color: 'border-green-500/30' },
];

const AGENTS = [
  { id: 'architect',  label: 'Architect',   emoji: '🏛️' },
  { id: 'dev',        label: 'Dev',         emoji: '💻' },
  { id: 'qa',         label: 'QA',          emoji: '✓' },
  { id: 'pm',         label: 'PM',          emoji: '📊' },
  { id: 'po',         label: 'PO',          emoji: '🎯' },
  { id: 'analyst',    label: 'Analyst',     emoji: '📈' },
  { id: 'devops',     label: 'DevOps',      emoji: '⚙️' },
  { id: 'ux',         label: 'UX Design',   emoji: '🎨' },
  { id: 'data-eng',   label: 'Data Eng',    emoji: '🗄️' },
];

const PRIORITY_CONFIG: Record<string, { label: string; icon: typeof ArrowUp; class: string }> = {
  urgent: { label: 'Urgente', icon: Flame,      class: 'text-red-400' },
  high:   { label: 'Alta',    icon: ArrowUp,     class: 'text-orange-400' },
  medium: { label: 'Média',   icon: ArrowRight,  class: 'text-yellow-400' },
  low:    { label: 'Baixa',   icon: ArrowDown,   class: 'text-blue-400' },
};

const TYPE_CONFIG: Record<string, { label: string; icon: typeof Bug; class: string }> = {
  feature:     { label: 'Feature',     icon: Sparkles,  class: 'text-purple-400' },
  bug:         { label: 'Bug',         icon: Bug,       class: 'text-red-400' },
  improvement: { label: 'Melhoria',    icon: Wrench,    class: 'text-blue-400' },
  refactor:    { label: 'Refactor',    icon: FileCode,  class: 'text-cyan-400' },
  docs:        { label: 'Docs',        icon: FileText,  class: 'text-green-400' },
};

// ─── Component ──────────────────────────────────────────────────────────────────

const emptyTask: Partial<BacklogTask> = {
  titulo: '', descricao: '', status: 'backlog', prioridade: 'medium',
  tipo: 'feature', agente_atual: null, tags: [], estimativa_horas: null, modulo: null,
};

export default function SABacklogPage() {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<BacklogTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Partial<BacklogTask>>(emptyTask);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragTask, setDragTask] = useState<string | null>(null);

  useEffect(() => { loadTasks(); }, []);

  async function loadTasks() {
    setLoading(true);
    try {
      setTasks(await getBacklogTasks());
    } catch (err: any) {
      toast({ title: 'Erro ao carregar backlog', description: err?.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  function openCreate(status = 'backlog') {
    setEditingTask({ ...emptyTask, status });
    setIsEditing(false);
    setDialogOpen(true);
  }

  function openEdit(task: BacklogTask) {
    setEditingTask({ ...task });
    setIsEditing(true);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!editingTask.titulo?.trim()) {
      toast({ title: 'Título é obrigatório', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      if (isEditing && editingTask.id) {
        const { id, ...updates } = editingTask;
        await updateBacklogTask(id, updates);
        toast({ title: 'Task atualizada' });
      } else {
        await createBacklogTask(editingTask);
        toast({ title: 'Task criada' });
      }
      setDialogOpen(false);
      await loadTasks();
    } catch (err: any) {
      toast({ title: 'Erro', description: err?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteBacklogTask(id);
      setTasks(prev => prev.filter(t => t.id !== id));
      toast({ title: 'Task excluída' });
    } catch (err: any) {
      toast({ title: 'Erro', description: err?.message, variant: 'destructive' });
    }
  }

  async function handleMoveTask(taskId: string, newStatus: string) {
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.status === newStatus) return;

    // Determine which agent should be assigned based on status
    const agentMap: Record<string, string> = {
      analyzing: 'analyst', planning: 'architect', developing: 'dev',
      reviewing: 'qa', testing: 'qa', deploying: 'devops',
    };
    const newAgent = agentMap[newStatus] || task.agente_atual;

    const historyEntry = {
      agente: newAgent || 'system',
      status: newStatus,
      timestamp: new Date().toISOString(),
      nota: `Movido para ${COLUMNS.find(c => c.id === newStatus)?.label}`,
    };

    try {
      await updateBacklogTask(taskId, {
        status: newStatus,
        agente_atual: newAgent || null,
        agente_historico: [...(task.agente_historico || []), historyEntry],
      });
      setTasks(prev => prev.map(t => t.id === taskId
        ? { ...t, status: newStatus, agente_atual: newAgent || null, agente_historico: [...(t.agente_historico || []), historyEntry] }
        : t
      ));
    } catch (err: any) {
      toast({ title: 'Erro ao mover task', description: err?.message, variant: 'destructive' });
    }
  }

  // Drag and drop handlers
  function onDragStart(taskId: string) { setDragTask(taskId); }
  function onDragOver(e: React.DragEvent) { e.preventDefault(); }
  function onDrop(status: string) {
    if (dragTask) { handleMoveTask(dragTask, status); setDragTask(null); }
  }

  function updateField(field: string, value: any) {
    setEditingTask(prev => ({ ...prev, [field]: value }));
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4 animate-fade-in h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <KanbanSquare className="w-6 h-6 text-red-500" />
            Backlog Board
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{tasks.length} tasks</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border border-border rounded-lg overflow-hidden">
            <button onClick={() => setView('kanban')} className={cn('px-3 py-1.5 text-xs font-medium transition-colors', view === 'kanban' ? 'bg-red-500/10 text-red-500' : 'text-muted-foreground hover:text-foreground')}>
              <KanbanSquare className="w-3.5 h-3.5 inline mr-1" />Kanban
            </button>
            <button onClick={() => setView('list')} className={cn('px-3 py-1.5 text-xs font-medium transition-colors border-l border-border', view === 'list' ? 'bg-red-500/10 text-red-500' : 'text-muted-foreground hover:text-foreground')}>
              <List className="w-3.5 h-3.5 inline mr-1" />Lista
            </button>
          </div>
          <Button onClick={() => openCreate()} className="bg-red-600 hover:bg-red-700 text-white">
            <Plus className="w-4 h-4 mr-2" /> Nova Task
          </Button>
        </div>
      </div>

      {/* Agent pipeline indicator */}
      <div className="flex items-center gap-1 px-1 flex-shrink-0 overflow-x-auto">
        {COLUMNS.map((col, i) => {
          const count = tasks.filter(t => t.status === col.id).length;
          return (
            <div key={col.id} className="flex items-center">
              {i > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground/30 mx-0.5 flex-shrink-0" />}
              <span className={cn('text-[10px] px-2 py-0.5 rounded-full border whitespace-nowrap', col.color, count > 0 ? 'text-foreground' : 'text-muted-foreground/50')}>
                {col.emoji} {col.label} {count > 0 && <span className="font-bold ml-0.5">{count}</span>}
              </span>
            </div>
          );
        })}
      </div>

      {/* Kanban View */}
      {view === 'kanban' && (
        <div className="flex gap-3 flex-1 overflow-x-auto pb-4">
          {COLUMNS.map(col => {
            const colTasks = tasks.filter(t => t.status === col.id);
            return (
              <div
                key={col.id}
                className={cn('flex flex-col min-w-[260px] w-[260px] rounded-xl border bg-card/50', col.color)}
                onDragOver={onDragOver}
                onDrop={() => onDrop(col.id)}
              >
                {/* Column header */}
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">{col.emoji}</span>
                    <span className="text-xs font-semibold text-foreground">{col.label}</span>
                    <Badge variant="outline" className="text-[10px] h-4 px-1 font-bold">{colTasks.length}</Badge>
                  </div>
                  <button onClick={() => openCreate(col.id)} className="text-muted-foreground hover:text-foreground">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Cards */}
                <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                  {colTasks.map(task => (
                    <TaskCard key={task.id} task={task} onEdit={openEdit} onDelete={handleDelete} onDragStart={onDragStart} />
                  ))}
                  {colTasks.length === 0 && (
                    <p className="text-[10px] text-muted-foreground/40 text-center py-6">Sem tasks</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List View */}
      {view === 'list' && (
        <div className="glass-card border border-border rounded-lg bg-card overflow-hidden flex-1 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 sticky top-0">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Título</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Prioridade</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Tipo</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Agente</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Módulo</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(task => {
                const pri = PRIORITY_CONFIG[task.prioridade] || PRIORITY_CONFIG.medium;
                const typ = TYPE_CONFIG[task.tipo] || TYPE_CONFIG.feature;
                const agent = AGENTS.find(a => a.id === task.agente_atual);
                const col = COLUMNS.find(c => c.id === task.status);
                return (
                  <tr key={task.id} className="border-t border-border hover:bg-muted/20 cursor-pointer" onClick={() => openEdit(task)}>
                    <td className="px-4 py-2.5 font-medium">{task.titulo}</td>
                    <td className="px-4 py-2.5"><span className="text-xs">{col?.emoji} {col?.label}</span></td>
                    <td className="px-4 py-2.5"><span className={cn('text-xs flex items-center gap-1', pri.class)}><pri.icon className="w-3 h-3" />{pri.label}</span></td>
                    <td className="px-4 py-2.5"><span className={cn('text-xs flex items-center gap-1', typ.class)}><typ.icon className="w-3 h-3" />{typ.label}</span></td>
                    <td className="px-4 py-2.5"><span className="text-xs">{agent ? `${agent.emoji} ${agent.label}` : '—'}</span></td>
                    <td className="px-4 py-2.5"><span className="text-xs text-muted-foreground">{task.modulo || '—'}</span></td>
                    <td className="px-4 py-2.5">
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(task.id); }} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {tasks.length === 0 && (
                <tr><td colSpan={7} className="text-center text-muted-foreground py-12">Nenhuma task no backlog</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Editar Task' : 'Nova Task'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div>
              <label className="text-sm font-medium block mb-1.5">Título *</label>
              <Input value={editingTask.titulo ?? ''} onChange={e => updateField('titulo', e.target.value)} placeholder="Ex: Implementar export PDF nos relatórios" />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">Descrição</label>
              <Textarea value={editingTask.descricao ?? ''} onChange={e => updateField('descricao', e.target.value)} placeholder="Detalhes da task, contexto, requisitos..." className="min-h-[80px]" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium block mb-1.5">Status</label>
                <Select value={editingTask.status ?? 'backlog'} onValueChange={v => updateField('status', v)}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COLUMNS.map(c => <SelectItem key={c.id} value={c.id}>{c.emoji} {c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1.5">Prioridade</label>
                <Select value={editingTask.prioridade ?? 'medium'} onValueChange={v => updateField('prioridade', v)}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1.5">Tipo</label>
                <Select value={editingTask.tipo ?? 'feature'} onValueChange={v => updateField('tipo', v)}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium block mb-1.5">Agente Responsável</label>
                <Select value={editingTask.agente_atual ?? '_none'} onValueChange={v => updateField('agente_atual', v === '_none' ? null : v)}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Nenhum</SelectItem>
                    {AGENTS.map(a => <SelectItem key={a.id} value={a.id}>{a.emoji} {a.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1.5">Módulo</label>
                <Input value={editingTask.modulo ?? ''} onChange={e => updateField('modulo', e.target.value || null)} placeholder="Ex: crm, whatsapp, marketing" className="h-9 text-xs" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium block mb-1.5">Estimativa (horas)</label>
              <Input type="number" value={editingTask.estimativa_horas ?? ''} onChange={e => updateField('estimativa_horas', e.target.value ? Number(e.target.value) : null)} placeholder="Ex: 4" className="h-9 text-xs w-32" />
            </div>

            {/* Agent history (edit mode only) */}
            {isEditing && editingTask.agente_historico && editingTask.agente_historico.length > 0 && (
              <div>
                <label className="text-xs font-medium block mb-1.5">Histórico de Agentes</label>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {editingTask.agente_historico.map((h, i) => {
                    const ag = AGENTS.find(a => a.id === h.agente);
                    const col = COLUMNS.find(c => c.id === h.status);
                    return (
                      <div key={i} className="flex items-center gap-2 text-[10px] text-muted-foreground px-2 py-1 rounded bg-muted/30">
                        <span>{ag?.emoji ?? '🤖'} {ag?.label ?? h.agente}</span>
                        <ChevronRight className="w-2.5 h-2.5" />
                        <span>{col?.emoji} {col?.label ?? h.status}</span>
                        <span className="ml-auto">{new Date(h.timestamp).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-red-600 hover:bg-red-700 text-white">
              {saving ? 'Salvando...' : isEditing ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Task Card ──────────────────────────────────────────────────────────────────

function TaskCard({ task, onEdit, onDelete, onDragStart }: {
  task: BacklogTask;
  onEdit: (t: BacklogTask) => void;
  onDelete: (id: string) => void;
  onDragStart: (id: string) => void;
}) {
  const pri = PRIORITY_CONFIG[task.prioridade] || PRIORITY_CONFIG.medium;
  const typ = TYPE_CONFIG[task.tipo] || TYPE_CONFIG.feature;
  const agent = AGENTS.find(a => a.id === task.agente_atual);

  return (
    <div
      draggable
      onDragStart={() => onDragStart(task.id)}
      onClick={() => onEdit(task)}
      className="group p-3 rounded-lg bg-card border border-border hover:border-primary/30 cursor-pointer transition-all"
    >
      <div className="flex items-start justify-between gap-1 mb-1.5">
        <span className={cn('flex items-center gap-1 text-[10px]', typ.class)}>
          <typ.icon className="w-3 h-3" /> {typ.label}
        </span>
        <span className={cn('flex items-center gap-0.5 text-[10px]', pri.class)}>
          <pri.icon className="w-3 h-3" />
        </span>
      </div>
      <p className="text-xs font-semibold text-foreground leading-snug mb-1.5">{task.titulo}</p>
      {task.descricao && (
        <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2 mb-2">{task.descricao}</p>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {agent && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              {agent.emoji} {agent.label}
            </span>
          )}
          {task.modulo && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
              {task.modulo}
            </span>
          )}
        </div>
        {task.estimativa_horas && (
          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
            <Clock className="w-2.5 h-2.5" /> {task.estimativa_horas}h
          </span>
        )}
      </div>
    </div>
  );
}
