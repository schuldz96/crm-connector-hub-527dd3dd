import { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Search, Plus, Filter, ChevronDown, ChevronRight, MoreHorizontal, X,
  User, Ticket, Download, Table2,
  ArrowUpDown, BarChart3, Copy, Settings2, SlidersHorizontal, Kanban, Bot, Loader2,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import StageAIConfigModal, { type StageAIConfig } from '@/components/crm/StageAIConfigModal';
import { useCrmPipelines, useCrmTicketsByPipeline, useCreateTicket, useUpdateTicket } from '@/hooks/useCrm';
import { useToast } from '@/hooks/use-toast';
import type { CrmTicket, CrmPipelineStage, TicketPriority } from '@/types/crm';

const TABS = [
  { id: 'all', label: 'Todos os tickets' },
  { id: 'mine', label: 'Meus tickets abertos' },
  { id: 'unassigned', label: 'Tickets não atribuídos' },
];

const PRIORITY_CONFIG: Record<TicketPriority, { label: string; class: string; dot: string }> = {
  low:    { label: 'Baixa',   class: 'bg-muted text-muted-foreground', dot: 'bg-success' },
  medium: { label: 'Média',   class: 'bg-warning/15 text-warning', dot: 'bg-warning' },
  high:   { label: 'Alta',    class: 'bg-destructive/15 text-destructive', dot: 'bg-destructive' },
  urgent: { label: 'Urgente', class: 'bg-destructive/20 text-destructive font-semibold', dot: 'bg-destructive' },
};

const TAG_COLORS: Record<string, string> = {
  'Conta Criada': 'bg-success/15 text-success border-success/30',
  'Integrado': 'bg-success/15 text-success border-success/30',
  'Cadência não cumprida': 'bg-destructive/15 text-destructive border-destructive/30',
};

function daysSince(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Aberto hoje';
  if (days === 1) return 'Aberto por 1 dia';
  if (days < 30) return `Aberto por ${days} dias`;
  const months = Math.floor(days / 30);
  return `Aberto por ${months} ${months === 1 ? 'mês' : 'meses'}`;
}

export default function CRMTicketsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'board' | 'table'>('board');
  const [pipelineDropdown, setPipelineDropdown] = useState(false);
  const [aiConfigStage, setAiConfigStage] = useState<{ id: string; name: string } | null>(null);
  const [stageAIConfigs, setStageAIConfigs] = useState<Record<string, StageAIConfig>>({});
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Create ticket form
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState<TicketPriority>('medium');
  const [newStage, setNewStage] = useState('');
  const createTicket = useCreateTicket();
  const updateTicket = useUpdateTicket();

  // Drag-and-drop state
  const dragItemRef = useRef<{ ticketId: string; fromStageId: string } | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);

  const { data: pipelines = [], isLoading: loadingPipelines } = useCrmPipelines('ticket');
  const [activePipelineId, setActivePipelineId] = useState<string | null>(null);

  const pipeline = pipelines.find(p => p.id === activePipelineId) || pipelines[0];
  const pipelineId = pipeline?.id || '';

  const { data: allTickets = [], isLoading: loadingTickets } = useCrmTicketsByPipeline(pipelineId);

  const filteredTickets = useMemo(() =>
    search ? allTickets.filter(t => t.titulo.toLowerCase().includes(search.toLowerCase())) : allTickets,
    [allTickets, search]);

  const ticketsByStage = useMemo(() => {
    const map: Record<string, CrmTicket[]> = {};
    for (const stage of (pipeline?.estagios || [])) map[stage.id] = [];
    for (const ticket of filteredTickets) {
      if (ticket.estagio_id && map[ticket.estagio_id]) map[ticket.estagio_id].push(ticket);
    }
    return map;
  }, [filteredTickets, pipeline?.estagios]);

  const isLoading = loadingPipelines || loadingTickets;
  const stages: CrmPipelineStage[] = pipeline?.estagios || [];

  const handleCreateTicket = async () => {
    if (!newTitle.trim()) return;
    try {
      await createTicket.mutateAsync({
        titulo: newTitle,
        prioridade: newPriority,
        pipeline_id: pipelineId,
        estagio_id: newStage || stages[0]?.id,
        status: 'aberto',
      } as any);
      setShowCreateModal(false);
      setNewTitle('');
      setNewPriority('medium');
      setNewStage('');
      toast({ title: 'Ticket criado com sucesso' });
    } catch {
      toast({ title: 'Erro ao criar ticket', variant: 'destructive' });
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Top tabs bar */}
      <div className="flex items-center justify-between px-4 border-b border-border bg-card flex-shrink-0">
        <div className="flex items-center gap-0">
          <div className="flex items-center gap-1.5 px-3 py-2 border-r border-border">
            <Ticket className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Tickets</span>
          </div>
          {TABS.map((tab, idx) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-3 py-2.5 text-sm transition-colors border-b-2 -mb-px',
                activeTab === tab.id
                  ? 'border-foreground text-foreground font-medium'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.label}
              {idx === 0 && allTickets.length > 0 && (
                <Badge variant="outline" className="ml-1.5 text-[10px] h-5 px-1.5 rounded-sm font-semibold">
                  {allTickets.length.toLocaleString('pt-BR')}
                </Badge>
              )}
            </button>
          ))}
          <button className="px-3 py-2.5 text-muted-foreground hover:text-foreground">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
          <Button size="sm" className="gap-1.5 h-8" onClick={() => setShowCreateModal(true)}>
            Adicionar tickets <ChevronRight className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card flex-shrink-0">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Pesquisar" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-8 text-sm" />
        </div>
        <div className="flex items-center gap-1.5">
          {/* View mode toggle */}
          <div className="flex border border-border rounded-md overflow-hidden">
            <button
              onClick={() => setViewMode('table')}
              className={cn('px-2.5 py-1.5 text-xs flex items-center gap-1', viewMode === 'table' ? 'bg-muted font-medium' : 'hover:bg-muted/50')}
            >
              <Table2 className="w-3.5 h-3.5" /> Exibição de tabela
            </button>
            <button
              onClick={() => setViewMode('board')}
              className={cn('px-2.5 py-1.5 text-xs flex items-center gap-1 border-l border-border', viewMode === 'board' ? 'bg-muted font-medium' : 'hover:bg-muted/50')}
            >
              <Kanban className="w-3.5 h-3.5" /> Exibição de quadro
            </button>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8"><Settings2 className="w-3.5 h-3.5" /></Button>
          <div className="w-px h-5 bg-border mx-1" />
          <DropdownMenu open={pipelineDropdown} onOpenChange={setPipelineDropdown}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                {pipeline?.nome || 'Pipeline'} <ChevronDown className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              {pipelines.map(p => (
                <DropdownMenuItem key={p.id} onClick={() => { setActivePipelineId(p.id); setPipelineDropdown(false); }}
                  className={cn(p.id === pipelineId && 'bg-muted font-medium')}>{p.nome}</DropdownMenuItem>
              ))}
              <div className="border-t border-border mt-1 pt-1 px-2 pb-1">
                <button
                  onClick={() => navigate(`/crm/0-6?type=ticket&pipeline=${pipelineId}`)}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  Editar pipeline <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="w-px h-5 bg-border mx-1" />
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-medium"><Filter className="w-3.5 h-3.5" /> Filtros</Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs"><ArrowUpDown className="w-3.5 h-3.5" /> Classificar</Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs"><BarChart3 className="w-3.5 h-3.5" /> Métrica</Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs"><Download className="w-3.5 h-3.5" /> Exportar</Button>
          <Button variant="ghost" size="icon" className="h-8 w-8"><Copy className="w-3.5 h-3.5" /></Button>
        </div>
      </div>

      {/* Filter chips row */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-card flex-shrink-0 text-xs">
        <button className="flex items-center gap-1 text-muted-foreground hover:text-foreground font-medium">
          Proprietário do ticket <ChevronRight className="w-3 h-3 rotate-90" />
        </button>
        <button className="flex items-center gap-1 text-muted-foreground hover:text-foreground font-medium">
          Data de criação <ChevronRight className="w-3 h-3 rotate-90" />
        </button>
        <button className="flex items-center gap-1 text-muted-foreground hover:text-foreground font-medium">
          Prioridade <ChevronRight className="w-3 h-3 rotate-90" />
        </button>
        <button className="text-muted-foreground hover:text-foreground font-medium">+ Mais</button>
        <div className="w-px h-4 bg-border" />
        <button className="flex items-center gap-1 text-muted-foreground hover:text-foreground font-medium">
          <SlidersHorizontal className="w-3 h-3" /> Filtros avançados
        </button>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : stages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <Ticket className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm">Nenhum pipeline configurado</p>
          </div>
        ) : viewMode === 'board' ? (
          /* ========== KANBAN VIEW (drag-and-drop) ========== */
          <div className="flex gap-3 min-w-max h-full p-4">
            {stages.map(stage => {
              const stageTickets = ticketsByStage[stage.id] || [];
              const isOver = dragOverStageId === stage.id;
              return (
                <div
                  key={stage.id}
                  className="w-[260px] flex flex-col flex-shrink-0"
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverStageId(stage.id); }}
                  onDragLeave={() => { if (dragOverStageId === stage.id) setDragOverStageId(null); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverStageId(null);
                    const ref = dragItemRef.current;
                    if (ref && ref.fromStageId !== stage.id) {
                      updateTicket.mutate({ id: ref.ticketId, estagio_id: stage.id });
                      toast({ title: `Ticket movido para ${stage.nome}` });
                    }
                    dragItemRef.current = null;
                  }}
                >
                  <div className="flex items-center justify-between px-3 py-2 bg-muted/50 rounded-t-lg border border-border border-b-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-semibold text-foreground truncate">{stage.nome}</span>
                      <Badge variant="outline" className="text-[10px] h-4 px-1 flex-shrink-0">{stageTickets.length}</Badge>
                    </div>
                    <button
                      onClick={() => setAiConfigStage({ id: stage.id, name: stage.nome })}
                      className={cn(
                        'flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors',
                        stageAIConfigs[stage.id]?.active
                          ? 'bg-primary/15 text-primary border border-primary/30'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      )}
                    >
                      <Bot className="w-3 h-3" /> IA
                      {stageAIConfigs[stage.id]?.active && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                    </button>
                  </div>
                  <div className={cn(
                    'flex-1 overflow-y-auto border-x border-border p-1.5 space-y-1.5 max-h-[calc(100vh-320px)] transition-colors',
                    isOver ? 'bg-primary/5 border-primary/30' : 'bg-muted/5'
                  )}>
                    {stageTickets.map(ticket => {
                      const pri = PRIORITY_CONFIG[ticket.prioridade];
                      return (
                        <div
                          key={ticket.id}
                          draggable
                          onDragStart={(e) => {
                            dragItemRef.current = { ticketId: ticket.id, fromStageId: stage.id };
                            e.dataTransfer.effectAllowed = 'move';
                            (e.currentTarget as HTMLElement).style.opacity = '0.5';
                          }}
                          onDragEnd={(e) => {
                            (e.currentTarget as HTMLElement).style.opacity = '1';
                            setDragOverStageId(null);
                            dragItemRef.current = null;
                          }}
                          onClick={() => navigate(`/crm/record/0-4/${ticket.numero_registro}`)}
                          className="bg-card border border-border rounded-lg p-3 space-y-1.5 hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing"
                        >
                          <p className="text-[13px] font-semibold text-primary hover:underline leading-tight">{ticket.titulo}</p>
                          <p className="text-xs text-muted-foreground">{daysSince(ticket.criado_em)}</p>
                          {ticket.plataforma && <p className="text-xs text-muted-foreground">Plataforma: {ticket.plataforma}</p>}
                          {ticket.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-0.5">
                              {ticket.tags.map(tag => (
                                <Badge key={tag} variant="outline" className={cn('text-[10px] px-1.5 py-0 rounded-sm', TAG_COLORS[tag] || '')}>{tag}</Badge>
                              ))}
                            </div>
                          )}
                          {ticket.prioridade !== 'low' && (
                            <div className="flex items-center gap-1.5">
                              <div className={cn('w-2 h-2 rounded-full', pri.dot)} />
                              <span className={cn('text-[10px]', pri.class)}>{pri.label}</span>
                            </div>
                          )}
                          <p className="text-[10px] text-muted-foreground font-mono">{ticket.numero_registro}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ========== TABLE VIEW ========== */
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-border bg-muted/50">
                <th className="w-10 px-3 py-2.5"><input type="checkbox" className="rounded border-border" /></th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">Título</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">ID</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">Prioridade</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">Etapa</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">Plataforma</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">Aberto desde</th>
              </tr>
            </thead>
            <tbody>
              {filteredTickets.map(ticket => {
                const stageName = stages.find(s => s.id === ticket.estagio_id)?.nome || '—';
                const pri = PRIORITY_CONFIG[ticket.prioridade];
                return (
                  <tr
                    key={ticket.id}
                    onClick={() => navigate(`/crm/record/0-4/${ticket.numero_registro}`)}
                    className="border-b border-border hover:bg-muted/20 transition-colors cursor-pointer"
                  >
                    <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" className="rounded border-border" />
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="font-medium text-primary hover:underline text-sm">{ticket.titulo}</span>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground text-xs font-mono">{ticket.numero_registro}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <div className={cn('w-2 h-2 rounded-full', pri.dot)} />
                        <span className="text-xs">{pri.label}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5"><Badge variant="outline" className="text-[10px]">{stageName}</Badge></td>
                    <td className="px-3 py-2.5 text-muted-foreground text-xs">{ticket.plataforma || '—'}</td>
                    <td className="px-3 py-2.5 text-muted-foreground text-xs">{daysSince(ticket.criado_em)}</td>
                  </tr>
                );
              })}
              {filteredTickets.length === 0 && (
                <tr><td colSpan={7} className="text-center py-10 text-muted-foreground text-sm">Nenhum ticket encontrado</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Ticket Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowCreateModal(false)} />
          <div className="relative w-[440px] h-full bg-card border-l border-border shadow-xl overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-base font-semibold">Criar Ticket</h2>
              <button onClick={() => setShowCreateModal(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="text-sm font-medium">Título *</label>
                <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Título do ticket" className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Prioridade</label>
                <Select value={newPriority} onValueChange={v => setNewPriority(v as TicketPriority)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Pipeline</label>
                <p className="text-sm text-muted-foreground mt-1">{pipeline?.nome}</p>
              </div>
              <div>
                <label className="text-sm font-medium">Etapa</label>
                <Select value={newStage || stages[0]?.id || ''} onValueChange={setNewStage}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {stages.map(s => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border flex gap-2">
              <Button onClick={handleCreateTicket} disabled={!newTitle.trim() || createTicket.isPending}>
                {createTicket.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                Criar
              </Button>
              <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancelar</Button>
            </div>
          </div>
        </div>
      )}

      {/* AI Config Modal */}
      {aiConfigStage && (
        <StageAIConfigModal
          open={!!aiConfigStage}
          onClose={() => setAiConfigStage(null)}
          stageName={aiConfigStage.name}
          stageId={aiConfigStage.id}
          allStages={stages.map(s => ({ id: s.id, name: s.nome }))}
          initialConfig={stageAIConfigs[aiConfigStage.id]}
          onSave={(id, cfg) => setStageAIConfigs(prev => ({ ...prev, [id]: cfg }))}
        />
      )}
    </div>
  );
}
