import { useState, useEffect, useCallback } from 'react';
import {
  getBacklogTasks, createBacklogTask, updateBacklogTask, deleteBacklogTask,
  type BacklogTask,
} from '@/lib/superAdminService';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
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
  Settings2, MessageSquare, Timer,
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
  { id: 'security-review', label: 'Segurança',     emoji: '🛡️', color: 'border-red-500/30' },
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
  { id: 'security',   label: 'Security',    emoji: '🛡️' },
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

// ─── Pipeline metrics ──────────────────────────────────────────────────────────

interface PipelineMetrics {
  totalMs: number;
  phases: { agente: string; status: string; durationMs: number; nota?: string }[];
  qaCycles: number;
  agents: string[];
}

function computeMetrics(historico: { agente: string; status: string; timestamp: string; nota?: string }[]): PipelineMetrics | null {
  if (!historico || historico.length < 2) return null;
  const sorted = [...historico].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const phases: PipelineMetrics['phases'] = [];
  for (let i = 0; i < sorted.length; i++) {
    const start = new Date(sorted[i].timestamp).getTime();
    const end = i < sorted.length - 1 ? new Date(sorted[i + 1].timestamp).getTime() : start;
    phases.push({ agente: sorted[i].agente, status: sorted[i].status, durationMs: end - start, nota: sorted[i].nota });
  }
  const totalMs = new Date(sorted[sorted.length - 1].timestamp).getTime() - new Date(sorted[0].timestamp).getTime();
  const qaCycles = sorted.filter(h => h.status === 'testing').length;
  const agents = [...new Set(sorted.map(h => h.agente))];
  return { totalMs, phases, qaCycles, agents };
}

function formatDuration(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}min`;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.round((ms % 3_600_000) / 60_000);
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

// ─── Image helpers (stores single base64 or JSON array in imagem_url) ──────────

function parseImages(url: string | null | undefined): string[] {
  if (!url) return [];
  if (url.startsWith('[')) {
    try { return JSON.parse(url); } catch { return [url]; }
  }
  return [url];
}

function serializeImages(imgs: string[]): string | null {
  if (imgs.length === 0) return null;
  if (imgs.length === 1) return imgs[0];
  return JSON.stringify(imgs);
}

// ─── Component ──────────────────────────────────────────────────────────────────

const emptyTask: Partial<BacklogTask> = {
  titulo: '', descricao: '', status: 'backlog', prioridade: 'medium',
  tipo: 'feature', agente_atual: null, tags: [], estimativa_horas: null, modulo: null, imagem_url: null,
};

export default function SABacklogPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [tasks, setTasks] = useState<BacklogTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Partial<BacklogTask>>(emptyTask);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragTask, setDragTask] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      setTasks(await getBacklogTasks());
    } catch (err: any) {
      toast({ title: 'Erro ao carregar backlog', description: err?.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  // Realtime + polling fallback: atualiza kanban automaticamente
  useEffect(() => {
    let realtimeActive = false;

    // 1. Supabase Realtime (instant, needs publication enabled)
    const channel = supabase
      .channel('backlog-realtime')
      .on('postgres_changes', { event: '*', schema: 'admin', table: 'backlog_tasks' }, (payload) => {
        realtimeActive = true;
        if (payload.eventType === 'INSERT') {
          setTasks(prev => [payload.new as BacklogTask, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setTasks(prev => prev.map(t => t.id === (payload.new as BacklogTask).id ? (payload.new as BacklogTask) : t));
        } else if (payload.eventType === 'DELETE') {
          setTasks(prev => prev.filter(t => t.id !== (payload.old as { id: string }).id));
        }
      })
      .subscribe();

    // 2. Polling fallback (every 8s, stops if realtime is active)
    const poll = setInterval(async () => {
      if (realtimeActive) return;
      try {
        const fresh = await getBacklogTasks();
        setTasks(fresh);
      } catch { /* silent */ }
    }, 8000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, []);

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
        await createBacklogTask({ ...editingTask, criado_por: user?.name || 'Desconhecido' });
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
      reviewing: 'qa', testing: 'qa', 'security-review': 'security', deploying: 'devops',
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
        <div className="flex gap-3 flex-1 overflow-x-auto pb-4 scrollbar-thick" style={{ scrollbarWidth: 'auto', scrollbarColor: 'hsl(var(--muted-foreground) / 0.3) transparent' }}>
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
        <DialogContent className="max-w-lg" onPaste={e => {
          const items = e.clipboardData?.items;
          if (!items) return;
          for (const item of Array.from(items)) {
            if (item.type.startsWith('image/')) {
              const file = item.getAsFile();
              if (!file) continue;
              const reader = new FileReader();
              reader.onload = () => {
                const current = parseImages(editingTask.imagem_url);
                updateField('imagem_url', serializeImages([...current, reader.result as string]));
              };
              reader.readAsDataURL(file);
              e.preventDefault();
              return;
            }
          }
        }}>
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
            <div>
              <label className="text-xs font-medium block mb-1.5">Tipo</label>
              <div className="flex gap-2">
                {Object.entries(TYPE_CONFIG).map(([k, v]) => (
                  <button key={k} type="button" onClick={() => updateField('tipo', k)}
                    className={cn('flex items-center gap-1.5 flex-1 px-3 py-2 rounded-lg border text-xs font-medium transition-all',
                      editingTask.tipo === k ? 'bg-primary/15 border-primary/30 text-primary' : 'border-border text-muted-foreground hover:bg-muted')}>
                    <v.icon className="w-3.5 h-3.5" /> {v.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Image references — paste, drop or upload (multi-image) */}
            <div>
              <label className="text-xs font-medium block mb-1.5">Imagens de referência</label>
              {(() => {
                const images = parseImages(editingTask.imagem_url);
                const addImage = (base64: string) => {
                  updateField('imagem_url', serializeImages([...images, base64]));
                };
                const removeImage = (idx: number) => {
                  updateField('imagem_url', serializeImages(images.filter((_, i) => i !== idx)));
                };
                return (
                  <>
                    {images.length > 0 && (
                      <div className="grid grid-cols-3 gap-2 mb-2">
                        {images.map((img, idx) => (
                          <div key={idx} className="relative group">
                            <img src={img} alt={`Ref ${idx + 1}`} className="h-24 w-full rounded-lg border border-border object-cover bg-black/5" />
                            <button onClick={() => removeImage(idx)}
                              className="absolute top-1 right-1 p-1 rounded bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div
                      onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-primary'); }}
                      onDragLeave={e => { e.currentTarget.classList.remove('border-primary'); }}
                      onDrop={e => {
                        e.preventDefault();
                        e.currentTarget.classList.remove('border-primary');
                        const file = e.dataTransfer.files?.[0];
                        if (!file || !file.type.startsWith('image/')) return;
                        const reader = new FileReader();
                        reader.onload = () => addImage(reader.result as string);
                        reader.readAsDataURL(file);
                      }}
                      className="flex flex-col items-center justify-center gap-1.5 p-4 rounded-lg border-2 border-dashed border-border hover:border-muted-foreground/50 transition-colors cursor-pointer"
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        input.multiple = true;
                        input.onchange = () => {
                          const files = input.files;
                          if (!files) return;
                          Array.from(files).forEach(file => {
                            const reader = new FileReader();
                            reader.onload = () => addImage(reader.result as string);
                            reader.readAsDataURL(file);
                          });
                        };
                        input.click();
                      }}
                    >
                      <span className="text-lg">{images.length > 0 ? '➕' : '📋'}</span>
                      <p className="text-[10px] text-muted-foreground text-center">
                        <strong className="text-foreground">Ctrl+V</strong> &middot; arrastar &middot; clique para {images.length > 0 ? 'adicionar mais' : 'selecionar'}
                      </p>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Pipeline metrics + Agent history (edit mode only) */}
            {isEditing && editingTask.agente_historico && editingTask.agente_historico.length > 0 && (
              <div>
                {editingTask.agente_historico.length >= 2 && (() => {
                  const m = computeMetrics(editingTask.agente_historico);
                  if (!m) return null;
                  return (
                    <div className="flex items-center gap-3 mb-2 p-2 rounded-lg bg-muted/40 border border-border/50">
                      <div className="flex items-center gap-1 text-xs"><Timer className="w-3.5 h-3.5 text-primary" /><span className="font-medium">{formatDuration(m.totalMs)}</span></div>
                      <div className="w-px h-4 bg-border" />
                      <div className="flex items-center gap-1 text-xs text-muted-foreground"><User className="w-3 h-3" />{m.agents.length} agentes</div>
                      <div className="w-px h-4 bg-border" />
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">{m.qaCycles}x QA</div>
                      <div className="w-px h-4 bg-border" />
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">{m.phases.length} fases</div>
                    </div>
                  );
                })()}
                <label className="text-xs font-medium block mb-1.5">Histórico de Agentes</label>
                <div className="space-y-0 max-h-48 overflow-y-auto">
                  {editingTask.agente_historico.map((h, i, arr) => {
                    const ag = AGENTS.find(a => a.id === h.agente);
                    const col = COLUMNS.find(c => c.id === h.status);
                    const ts = new Date(h.timestamp);
                    const prev = i > 0 ? new Date(arr[i - 1].timestamp) : null;
                    const diffMs = prev ? ts.getTime() - prev.getTime() : 0;
                    const diffMin = Math.round(diffMs / 60000);
                    const durLabel = diffMin < 1 ? '<1min' : diffMin < 60 ? `${diffMin}min` : `${Math.floor(diffMin / 60)}h${diffMin % 60 > 0 ? `${diffMin % 60}m` : ''}`;
                    return (
                      <div key={i}>
                        {i > 0 && (
                          <div className="flex items-center gap-1.5 pl-4 py-0.5">
                            <div className="w-px h-3 bg-border" />
                            <span className="text-[9px] text-muted-foreground/60 font-mono">⏱ {durLabel}</span>
                          </div>
                        )}
                        <div className="flex items-start gap-2 text-[11px] text-muted-foreground px-2.5 py-1.5 rounded bg-muted/30">
                          <div className="flex items-center gap-1.5 shrink-0 min-w-[100px]">
                            <span>{ag?.emoji ?? '🤖'} {ag?.label ?? h.agente}</span>
                            <ChevronRight className="w-2.5 h-2.5 shrink-0" />
                            <span className="whitespace-nowrap">{col?.emoji} {col?.label ?? h.status}</span>
                          </div>
                          {h.nota && (
                            <span className="text-[10px] text-foreground/70 border-l border-border pl-2 ml-1">{h.nota}</span>
                          )}
                          <span className="ml-auto text-[10px] text-muted-foreground/50 whitespace-nowrap shrink-0">
                            {ts.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {/* Total duration */}
                  {editingTask.agente_historico.length > 1 && (() => {
                    const first = new Date(editingTask.agente_historico[0].timestamp).getTime();
                    const last = new Date(editingTask.agente_historico[editingTask.agente_historico.length - 1].timestamp).getTime();
                    const totalMin = Math.round((last - first) / 60000);
                    const totalLabel = totalMin < 60 ? `${totalMin}min` : `${Math.floor(totalMin / 60)}h${totalMin % 60 > 0 ? `${totalMin % 60}m` : ''}`;
                    return (
                      <div className="flex items-center justify-end gap-1.5 pt-1.5 mt-1 border-t border-border/50">
                        <Clock className="w-3 h-3 text-muted-foreground/50" />
                        <span className="text-[10px] font-medium text-muted-foreground/70">Tempo total: {totalLabel}</span>
                      </div>
                    );
                  })()}
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
      {task.imagem_url && (() => {
        const imgs = parseImages(task.imagem_url);
        if (imgs.length === 0) return null;
        if (imgs.length === 1) return <img src={imgs[0]} alt="" className="w-full max-h-24 object-cover rounded-md border border-border mb-1.5" />;
        return (
          <div className="grid grid-cols-2 gap-1 mb-1.5">
            {imgs.slice(0, 4).map((img, i) => (
              <div key={i} className="relative">
                <img src={img} alt="" className="w-full h-14 object-cover rounded border border-border" />
                {i === 3 && imgs.length > 4 && (
                  <div className="absolute inset-0 bg-black/50 rounded flex items-center justify-center text-white text-xs font-bold">+{imgs.length - 4}</div>
                )}
              </div>
            ))}
          </div>
        );
      })()}
      {task.descricao && (
        <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2 mb-2">{task.descricao}</p>
      )}
      {task.status === 'done' && task.agente_historico?.length >= 2 && (() => {
        const m = computeMetrics(task.agente_historico);
        if (!m) return null;
        return (
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-1.5 px-1">
            <span className="flex items-center gap-0.5"><Timer className="w-2.5 h-2.5" />{formatDuration(m.totalMs)}</span>
            <span>{m.agents.length} agentes</span>
            {m.qaCycles > 1 && <span className="text-yellow-500">{m.qaCycles}x QA</span>}
          </div>
        );
      })()}
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
        <div className="flex items-center gap-1.5">
          {task.criado_por && task.criado_por !== 'super-admin' && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              <User className="w-2.5 h-2.5" /> {task.criado_por}
            </span>
          )}
        {task.estimativa_horas && (
          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
            <Clock className="w-2.5 h-2.5" /> {task.estimativa_horas}h
          </span>
        )}
        </div>
      </div>
    </div>
  );
}
