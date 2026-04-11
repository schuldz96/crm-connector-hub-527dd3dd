import { useState, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Search, Plus, X, CheckSquare, Clock, User, Loader2,
  ArrowUp, ArrowRight, ArrowDown, Flame, Calendar, Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCrmTasks, useCreateTask, useUpdateTask, useDeleteTask, useSaasUsers } from '@/hooks/useCrm';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { CrmTask } from '@/lib/crmService';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pendente: { label: 'Pendente', color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30' },
  em_andamento: { label: 'Em andamento', color: 'bg-blue-500/10 text-blue-600 border-blue-500/30' },
  concluida: { label: 'Concluída', color: 'bg-green-500/10 text-green-600 border-green-500/30' },
  cancelada: { label: 'Cancelada', color: 'bg-gray-500/10 text-gray-600 border-gray-500/30' },
};

const PRIORITY_CONFIG: Record<string, { label: string; icon: typeof ArrowUp; color: string }> = {
  urgent: { label: 'Urgente', icon: Flame, color: 'text-red-500' },
  high: { label: 'Alta', icon: ArrowUp, color: 'text-orange-500' },
  medium: { label: 'Média', icon: ArrowRight, color: 'text-yellow-500' },
  low: { label: 'Baixa', icon: ArrowDown, color: 'text-blue-500' },
};

export default function CRMTasksPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: tasks = [], isLoading } = useCrmTasks();
  const { data: saasUsers = [] } = useSaasUsers();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const submittingRef = useRef(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ titulo: '', descricao: '', prioridade: 'medium', data_vencimento: '' });

  const filtered = useMemo(() => {
    let list = tasks;
    if (statusFilter !== 'all') list = list.filter(t => t.status === statusFilter);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(t => t.titulo.toLowerCase().includes(s) || t.descricao?.toLowerCase().includes(s));
    }
    return list;
  }, [tasks, search, statusFilter]);

  const handleCreate = async () => {
    if (submittingRef.current || !form.titulo.trim()) return;
    submittingRef.current = true;
    try {
      const myId = saasUsers.find(u => u.email.toLowerCase() === user?.email?.toLowerCase())?.id;
      await createTask.mutateAsync({
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim(),
        prioridade: form.prioridade,
        data_vencimento: form.data_vencimento || null,
        proprietario_id: myId || null,
        proprietario_nome: user?.name || null,
      } as any);
      setForm({ titulo: '', descricao: '', prioridade: 'medium', data_vencimento: '' });
      setShowCreate(false);
      toast({ title: 'Tarefa criada' });
    } catch { toast({ title: 'Erro ao criar tarefa', variant: 'destructive' }); }
    finally { submittingRef.current = false; }
  };

  const handleStatusChange = async (task: CrmTask, newStatus: string) => {
    try {
      await updateTask.mutateAsync({ id: task.id, status: newStatus } as any);
    } catch { toast({ title: 'Erro ao atualizar', variant: 'destructive' }); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta tarefa?')) return;
    try { await deleteTask.mutateAsync(id); toast({ title: 'Tarefa excluída' }); }
    catch { toast({ title: 'Erro ao excluir', variant: 'destructive' }); }
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <CheckSquare className="w-6 h-6 text-primary" />
            Tarefas
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{tasks.length} tarefas</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-1.5">
          <Plus className="w-4 h-4" /> Nova Tarefa
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar tarefas..." className="pl-9 h-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Kanban by status */}
      <div className="grid grid-cols-4 gap-3">
        {Object.entries(STATUS_CONFIG).map(([statusKey, statusCfg]) => {
          const col = filtered.filter(t => t.status === statusKey);
          return (
            <div key={statusKey} className="border border-border rounded-xl bg-card/50 min-h-[200px]">
              <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className={cn('text-[10px]', statusCfg.color)}>{statusCfg.label}</Badge>
                  <span className="text-xs text-muted-foreground font-medium">{col.length}</span>
                </div>
              </div>
              <div className="p-2 space-y-2">
                {col.map(task => {
                  const pri = PRIORITY_CONFIG[task.prioridade] || PRIORITY_CONFIG.medium;
                  const PriIcon = pri.icon;
                  const isOverdue = task.data_vencimento && new Date(task.data_vencimento) < new Date() && task.status !== 'concluida';
                  return (
                    <div key={task.id} className={cn('p-2.5 rounded-lg border bg-card hover:bg-muted/30 transition-colors', isOverdue && 'border-red-500/30')}>
                      <div className="flex items-start justify-between gap-1">
                        <p className="text-sm font-medium leading-tight">{task.titulo}</p>
                        <button onClick={() => handleDelete(task.id)} className="text-muted-foreground hover:text-destructive shrink-0 opacity-0 group-hover:opacity-100">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      {task.descricao && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.descricao}</p>}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className={cn('text-[10px] flex items-center gap-0.5', pri.color)}>
                          <PriIcon className="w-3 h-3" /> {pri.label}
                        </span>
                        {task.data_vencimento && (
                          <span className={cn('text-[10px] flex items-center gap-0.5', isOverdue ? 'text-red-500' : 'text-muted-foreground')}>
                            <Calendar className="w-3 h-3" /> {new Date(task.data_vencimento).toLocaleDateString('pt-BR')}
                          </span>
                        )}
                        {task.proprietario_nome && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <User className="w-3 h-3" /> {task.proprietario_nome}
                          </span>
                        )}
                      </div>
                      {/* Quick status change */}
                      <div className="flex gap-1 mt-2">
                        {Object.entries(STATUS_CONFIG).filter(([k]) => k !== task.status).map(([k, v]) => (
                          <button key={k} onClick={() => handleStatusChange(task, k)}
                            className={cn('text-[9px] px-1.5 py-0.5 rounded border', v.color, 'hover:opacity-80')}>
                            {v.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {col.length === 0 && <p className="text-[10px] text-muted-foreground text-center py-4">Sem tarefas</p>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-start justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowCreate(false)} />
          <div className="relative w-[400px] h-full bg-card border-l border-border shadow-xl overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-base font-semibold">Nova Tarefa</h2>
              <button onClick={() => setShowCreate(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="text-sm font-medium">Título *</label>
                <Input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Ligar para João" className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Descrição</label>
                <textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Detalhes..." className="mt-1 w-full h-20 text-sm border border-border rounded-md px-3 py-2 bg-background resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Prioridade</label>
                  <Select value={form.prioridade} onValueChange={v => setForm(f => ({ ...f, prioridade: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Vencimento</label>
                  <Input type="date" value={form.data_vencimento} onChange={e => setForm(f => ({ ...f, data_vencimento: e.target.value }))} className="mt-1" />
                </div>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-border">
              <Button onClick={handleCreate} disabled={!form.titulo.trim() || createTask.isPending} className="w-full">
                {createTask.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                Criar Tarefa
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
