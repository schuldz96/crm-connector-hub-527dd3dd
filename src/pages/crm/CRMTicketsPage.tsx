import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
import { useCrmPipelines, useCrmTicketsByPipeline, useCreateTicket, useUpdateTicket, useSaasUsers } from '@/hooks/useCrm';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { getOrg } from '@/lib/saas';
import { triggerCrmAI } from '@/lib/crmService';
import { useToast } from '@/hooks/use-toast';
import type { CrmTicket, CrmPipelineStage, TicketPriority } from '@/types/crm';

type FilterDef = { key: string; label: string; type: 'select' | 'text'; options?: { value: string; label: string; sub?: string }[] };

const DATE_OPTIONS = [
  { value: 'hoje', label: 'Hoje', sub: 'Todos de hoje' },
  { value: 'ontem', label: 'Ontem', sub: 'Dia anterior de 24 horas' },
  { value: 'esta_semana', label: 'Esta semana', sub: 'Segunda a domingo' },
  { value: 'semana_passada', label: 'Semana passada', sub: 'Últimos 7 dias' },
  { value: 'este_mes', label: 'Este mês', sub: 'Mês atual' },
  { value: 'mes_passado', label: 'Mês passado', sub: 'Últimos 30 dias' },
  { value: 'este_trimestre', label: 'Este trimestre', sub: 'Trimestre atual' },
  { value: 'este_ano', label: 'Este ano', sub: 'Ano atual' },
  { value: 'mais_30_dias', label: 'Mais de 30 dias', sub: 'Criado há mais de 30 dias' },
  { value: 'mais_90_dias', label: 'Mais de 90 dias', sub: 'Criado há mais de 90 dias' },
];

function getDateRange(preset: string): { start: Date; end: Date } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  switch (preset) {
    case 'hoje': return { start: today, end: tomorrow };
    case 'ontem': { const d = new Date(today); d.setDate(d.getDate() - 1); return { start: d, end: today }; }
    case 'esta_semana': { const d = new Date(today); d.setDate(d.getDate() - d.getDay() + 1); return { start: d, end: tomorrow }; }
    case 'semana_passada': { const d = new Date(today); d.setDate(d.getDate() - 7); return { start: d, end: tomorrow }; }
    case 'este_mes': return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: tomorrow };
    case 'mes_passado': { const d = new Date(today); d.setDate(d.getDate() - 30); return { start: d, end: tomorrow }; }
    case 'este_trimestre': { const q = Math.floor(now.getMonth() / 3) * 3; return { start: new Date(now.getFullYear(), q, 1), end: tomorrow }; }
    case 'este_ano': return { start: new Date(now.getFullYear(), 0, 1), end: tomorrow };
    case 'mais_30_dias': { const d = new Date(today); d.setDate(d.getDate() - 30); return { start: new Date(2000, 0, 1), end: d }; }
    case 'mais_90_dias': { const d = new Date(today); d.setDate(d.getDate() - 90); return { start: new Date(2000, 0, 1), end: d }; }
    default: return { start: new Date(2000, 0, 1), end: tomorrow };
  }
}

const TICKET_FILTERS: FilterDef[] = [
  { key: 'proprietario_id', label: 'Proprietário do ticket', type: 'select' },
  { key: 'criado_em', label: 'Data de criação', type: 'select', options: DATE_OPTIONS },
  { key: 'prioridade', label: 'Prioridade', type: 'select', options: [
    { value: 'low', label: 'Baixa' }, { value: 'medium', label: 'Média' }, { value: 'high', label: 'Alta' }, { value: 'urgent', label: 'Urgente' },
  ]},
  { key: 'status', label: 'Status', type: 'select', options: [
    { value: 'aberto', label: 'Aberto' }, { value: 'em_andamento', label: 'Em andamento' }, { value: 'aguardando', label: 'Aguardando' }, { value: 'resolvido', label: 'Resolvido' }, { value: 'fechado', label: 'Fechado' },
  ]},
  { key: 'estagio_id', label: 'Etapa do ticket', type: 'select' },
  { key: 'categoria', label: 'Categoria', type: 'text' },
  { key: 'plataforma', label: 'Plataforma', type: 'text' },
];

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
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: saasUsers = [] } = useSaasUsers();
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'board' | 'table'>('board');
  const [pipelineDropdown, setPipelineDropdown] = useState(false);
  const [aiConfigStage, setAiConfigStage] = useState<{ id: string; name: string } | null>(null);
  const [stageAIConfigs, setStageAIConfigs] = useState<Record<string, StageAIConfig>>({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [showMetrics, setShowMetrics] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [openChip, setOpenChip] = useState<string | null>(null);
  const [chipSearch, setChipSearch] = useState('');
  const [advFilterSearch, setAdvFilterSearch] = useState('');
  const [advFilterAdding, setAdvFilterAdding] = useState(false);
  const [advFilterGroups, setAdvFilterGroups] = useState<{ property: string; operator: string; value: string }[][]>([]);
  const [sortField, setSortField] = useState<'criado_em' | 'atualizado_em'>('criado_em');
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');

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

  // Resolve pipeline from URL param (nome_interno) or default to first
  const pipelineParam = searchParams.get('pipeline');
  const pipeline = (pipelineParam
    ? pipelines.find(p => String(p.nome_interno) === pipelineParam)
    : null) || pipelines[0];
  const pipelineId = pipeline?.id || '';

  const pipelineNomeInterno = pipeline?.nome_interno;
  useEffect(() => {
    if (pipelineNomeInterno && !searchParams.get('pipeline')) {
      setSearchParams({ pipeline: String(pipelineNomeInterno) }, { replace: true });
    }
  }, [pipelineNomeInterno]);

  const selectPipeline = (p: typeof pipeline) => {
    if (!p) return;
    setSearchParams({ pipeline: String(p.nome_interno) }, { replace: true });
  };

  const { data: allTickets = [], isLoading: loadingTickets } = useCrmTicketsByPipeline(pipelineId);

  // Find current user's saas ID for "Meus tickets" filter
  const myUserId = useMemo(() => {
    if (!user?.email) return null;
    const match = saasUsers.find(u => u.email.toLowerCase() === user.email.toLowerCase());
    return match?.id || null;
  }, [user?.email, saasUsers]);

  const filteredTickets = useMemo(() => {
    let list = allTickets;
    if (activeTab === 'mine' && myUserId) {
      list = list.filter(t => t.proprietario_id === myUserId);
    } else if (activeTab === 'unassigned') {
      list = list.filter(t => !t.proprietario_id);
    }
    if (search) {
      list = list.filter(t => t.titulo.toLowerCase().includes(search.toLowerCase()));
    }
    for (const [key, val] of Object.entries(activeFilters)) {
      if (!val) continue;
      if (key === 'status') list = list.filter(t => t.status === val);
      else if (key === 'prioridade') list = list.filter(t => t.prioridade === val);
      else if (key === 'estagio_id') list = list.filter(t => t.estagio_id === val);
      else if (key === 'proprietario_id') list = list.filter(t => t.proprietario_id === val);
      else if (key === 'categoria') list = list.filter(t => t.categoria?.toLowerCase().includes(val.toLowerCase()));
      else if (key === 'plataforma') list = list.filter(t => t.plataforma?.toLowerCase().includes(val.toLowerCase()));
      else if (key === 'criado_em') {
        const { start, end } = getDateRange(val);
        list = list.filter(t => { const time = new Date(t.criado_em).getTime(); return time >= start.getTime() && time < end.getTime(); });
      }
    }
    list = [...list].sort((a, b) => {
      const aVal = new Date(a[sortField]).getTime();
      const bVal = new Date(b[sortField]).getTime();
      return sortDirection === 'desc' ? bVal - aVal : aVal - bVal;
    });
    return list;
  }, [allTickets, search, activeTab, myUserId, sortField, sortDirection, activeFilters]);

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

  // Load stage AI configs from DB when pipeline changes
  useEffect(() => {
    if (!stages.length) return;
    const ids = stages.map(s => s.id);
    (supabase as any).schema('crm').from('estagio_ia_config')
      .select('*').in('estagio_id', ids)
      .then(({ data }: { data: any[] | null }) => {
        if (!data?.length) return;
        const map: Record<string, StageAIConfig> = {};
        for (const row of data) {
          const bv = row.mensagem_boas_vindas || {};
          map[row.estagio_id] = {
            aiName: row.nome_ia || '', provider: row.provider || '', instance: row.instancia_id || '',
            active: row.ativo ?? false, systemPrompt: row.prompt_sistema || '',
            autoComplement: row.auto_complemento || '', welcomeEnabled: bv.enabled ?? false,
            welcomeType: bv.type || 'text', welcomeText: bv.text || '',
            startMode: row.modo_inicio || 'immediate', typingDelay: row.delay_digitacao ?? 1,
            responseDelay: row.delay_resposta ?? 0, autoEvaluation: false,
            questions: row.perguntas || [], followUps: row.followups || [],
            ragEnabled: row.rag_ativo ?? false, ragSource: row.rag_fonte || '',
            ragMaxTurns: row.rag_max_turnos ?? 5, transitions: row.transicoes || [],
          };
        }
        setStageAIConfigs(map);
      });
  }, [pipelineId]);

  const handleCreateTicket = async () => {
    if (!newTitle.trim()) return;
    try {
      const stageId = newStage || stages[0]?.id;
      const created = await createTicket.mutateAsync({
        titulo: newTitle,
        prioridade: newPriority,
        pipeline_id: pipelineId,
        estagio_id: stageId,
        status: 'aberto',
      } as any);
      setShowCreateModal(false);
      setNewTitle('');
      setNewPriority('medium');
      setNewStage('');
      toast({ title: 'Ticket criado com sucesso' });
      if (created?.id && stageId) {
        getOrg().then(eid => triggerCrmAI('ticket', created.id, stageId, eid, 'create')).catch(() => {});
      }
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => navigate('/crm/0-5?object=ticket')}>Editar propriedades</DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/crm/restore?type=0-4')}>Restaurar registros</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
          {/* View mode dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                {viewMode === 'board' ? <Kanban className="w-3.5 h-3.5" /> : <Table2 className="w-3.5 h-3.5" />}
                {viewMode === 'board' ? 'Exibição de quadro' : 'Exibição de tabela'}
                <ChevronDown className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <p className="text-[11px] text-muted-foreground font-semibold px-2 py-1">Tipo de exibição</p>
              <DropdownMenuItem onClick={() => setViewMode('table')} className={cn(viewMode === 'table' && 'bg-muted font-medium')}>
                <Table2 className="w-3.5 h-3.5 mr-2" /> Exibição de tabela
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setViewMode('board')} className={cn(viewMode === 'board' && 'bg-muted font-medium')}>
                <Kanban className="w-3.5 h-3.5 mr-2" /> Exibição de quadro
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu open={pipelineDropdown} onOpenChange={setPipelineDropdown}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                {pipeline?.nome || 'Pipeline'} <ChevronDown className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              {pipelines.map(p => (
                <DropdownMenuItem key={p.id} onClick={() => { selectPipeline(p); setPipelineDropdown(false); }}
                  className={cn(p.id === pipelineId && 'bg-muted font-medium')}>
                  {p.nome}
                </DropdownMenuItem>
              ))}
              <div className="border-t border-border mt-1 pt-1 px-2 pb-1">
                <button onClick={() => navigate(`/crm/0-6?type=ticket&pipeline=${pipeline?.nome_interno || ''}`)}
                  className="text-xs text-primary hover:underline flex items-center gap-1">
                  Editar pipeline <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="w-px h-5 bg-border mx-1" />
          <Button variant="outline" size="sm" className={cn("h-8 gap-1.5 text-xs font-medium", showFilters && "bg-muted")} onClick={() => setShowFilters(f => !f)}><Filter className="w-3.5 h-3.5" /> Filtros</Button>
          <DropdownMenu open={showSortMenu} onOpenChange={setShowSortMenu}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs"><ArrowUpDown className="w-3.5 h-3.5" /> Classificar</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <p className="text-[11px] text-muted-foreground font-semibold px-2 py-1">Classificar por</p>
              {([['criado_em', 'Data de criação'], ['atualizado_em', 'Última modificação']] as const).map(([key, label]) => (
                <DropdownMenuItem key={key} onClick={() => setSortField(key)} className={cn(sortField === key && 'bg-muted font-medium')}>{label}</DropdownMenuItem>
              ))}
              <div className="border-t border-border my-1" />
              <div className="flex gap-1 px-2 py-1">
                <button onClick={() => { setSortDirection('desc'); setShowSortMenu(false); }} className={cn('flex-1 text-xs py-1 rounded', sortDirection === 'desc' ? 'bg-foreground text-background font-medium' : 'hover:bg-muted')}>Mais recente</button>
                <button onClick={() => { setSortDirection('asc'); setShowSortMenu(false); }} className={cn('flex-1 text-xs py-1 rounded', sortDirection === 'asc' ? 'bg-foreground text-background font-medium' : 'hover:bg-muted')}>Mais antigo</button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" className={cn("h-8 gap-1.5 text-xs", showMetrics && "bg-muted")} onClick={() => setShowMetrics(m => !m)}><BarChart3 className="w-3.5 h-3.5" /> Métrica</Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs"><Download className="w-3.5 h-3.5" /> Exportar</Button>
          <Button variant="ghost" size="icon" className="h-8 w-8"><Copy className="w-3.5 h-3.5" /></Button>
        </div>
      </div>

      {/* Filter chips row */}
      {showFilters && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-card flex-shrink-0 text-xs flex-wrap">
          {TICKET_FILTERS.map(f => {
            const isOpen = openChip === f.key;
            const hasValue = !!activeFilters[f.key];
            let options = f.options || [];
            if (f.key === 'proprietario_id') options = saasUsers.map(u => ({ value: u.id, label: u.nome }));
            if (f.key === 'estagio_id') options = stages.map(s => ({ value: s.id, label: s.nome }));
            const selectedLabel = hasValue ? options.find(o => o.value === activeFilters[f.key])?.label : null;
            return (
              <div key={f.key} className="relative">
                <button onClick={() => { setOpenChip(isOpen ? null : f.key); setChipSearch(''); }}
                  className={cn('flex items-center gap-1 font-medium px-2 py-1 rounded-md transition-colors',
                    hasValue ? 'bg-primary/15 text-primary border border-primary/30' : 'text-muted-foreground hover:text-foreground hover:bg-muted')}>
                  {f.label}{selectedLabel ? `: ${selectedLabel}` : ''} <ChevronDown className="w-3 h-3" />
                  {hasValue && (
                    <span onClick={(e) => { e.stopPropagation(); setActiveFilters(prev => { const n = { ...prev }; delete n[f.key]; return n; }); setOpenChip(null); }}
                      className="ml-0.5 hover:text-destructive"><X className="w-3 h-3" /></span>
                  )}
                </button>
                {isOpen && (
                  <div className="absolute top-full left-0 mt-1 z-30 bg-card border border-border rounded-lg shadow-lg min-w-[200px] max-h-60 overflow-y-auto">
                    {(f.type === 'select' && options.length > 0) ? (() => {
                      const filtered = chipSearch ? options.filter(o => o.label.toLowerCase().includes(chipSearch.toLowerCase())) : options;
                      return (
                      <div className="py-1">
                        {options.length > 5 && (
                          <div className="px-2 pb-1 border-b border-border mb-1">
                            <div className="relative">
                              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                              <Input className="pl-7 text-xs h-7" placeholder="Pesquisar..." value={chipSearch} onChange={e => setChipSearch(e.target.value)} autoFocus />
                            </div>
                          </div>
                        )}
                        <button onClick={() => { setActiveFilters(prev => { const n = { ...prev }; delete n[f.key]; return n; }); setOpenChip(null); }}
                          className={cn('w-full text-left px-3 py-1.5 text-xs hover:bg-muted', !hasValue && 'font-medium')}>Todos</button>
                        <div className="max-h-48 overflow-y-auto">
                          {filtered.map(o => (
                            <button key={o.value} onClick={() => { setActiveFilters(prev => ({ ...prev, [f.key]: o.value })); setOpenChip(null); }}
                              className={cn('w-full text-left px-3 py-1.5 text-xs hover:bg-muted', activeFilters[f.key] === o.value && 'bg-muted font-medium')}>
                              <span>{o.label}</span>
                              {o.sub && <span className="block text-[10px] text-muted-foreground">{o.sub}</span>}
                            </button>
                          ))}
                          {filtered.length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">Nenhum resultado</p>}
                        </div>
                      </div>);
                    })() : f.type === 'text' ? (
                      <div className="p-2">
                        <Input className="text-xs h-8" placeholder={`Filtrar por ${f.label.toLowerCase()}...`}
                          value={activeFilters[f.key] || ''}
                          onChange={e => setActiveFilters(prev => e.target.value ? { ...prev, [f.key]: e.target.value } : (() => { const n = { ...prev }; delete n[f.key]; return n; })())}
                          onKeyDown={e => e.key === 'Enter' && setOpenChip(null)} autoFocus />
                      </div>
                    ) : (
                      <div className="p-2 text-xs text-muted-foreground">Em breve</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          <button className="text-muted-foreground hover:text-foreground font-medium px-2 py-1">+ Mais</button>
          <div className="w-px h-4 bg-border" />
          <button onClick={() => setShowAdvancedFilters(true)} className="flex items-center gap-1 text-muted-foreground hover:text-foreground font-medium px-2 py-1">
            <SlidersHorizontal className="w-3 h-3" /> Filtros avançados
          </button>
          {Object.keys(activeFilters).length > 0 && (
            <>
              <div className="w-px h-4 bg-border" />
              <button onClick={() => setActiveFilters({})} className="text-destructive hover:text-destructive/80 font-medium px-2 py-1">Limpar filtros</button>
            </>
          )}
        </div>
      )}

      {/* Metrics row */}
      {showMetrics && filteredTickets.length > 0 && (
        <div className="flex items-stretch gap-0 border-b border-border bg-card flex-shrink-0 overflow-x-auto">
          {[
            { label: 'TOTAL DE TICKETS', value: String(filteredTickets.length) },
            { label: 'ABERTOS', value: String(filteredTickets.filter(t => t.status === 'aberto').length) },
            { label: 'EM ANDAMENTO', value: String(filteredTickets.filter(t => t.status === 'em_andamento').length) },
            { label: 'RESOLVIDOS', value: String(filteredTickets.filter(t => t.status === 'resolvido' || t.status === 'fechado').length) },
            { label: 'URGENTES', value: String(filteredTickets.filter(t => t.prioridade === 'urgent' || t.prioridade === 'high').length) },
          ].map((m, i) => (
            <div key={i} className="flex-1 min-w-[140px] px-4 py-3 text-center border-r border-border last:border-r-0">
              <p className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase">{m.label}</p>
              <p className="text-lg font-bold text-foreground mt-0.5">{m.value}</p>
            </div>
          ))}
        </div>
      )}

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
                      getOrg().then(eid => triggerCrmAI('ticket', ref.ticketId, stage.id, eid, 'move')).catch(() => {});
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

      {/* Advanced Filters Panel */}
      {showAdvancedFilters && (
        <div className="fixed inset-0 z-50 flex items-start justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowAdvancedFilters(false)} />
          <div className="relative w-[420px] h-full bg-card border-l border-border shadow-xl overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-base font-semibold">Todos os filtros</h2>
              <button onClick={() => setShowAdvancedFilters(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm font-semibold mb-4">Filtros avançados</p>
              {advFilterGroups.length === 0 && !advFilterAdding && (
                <div className="text-center py-6">
                  <p className="text-sm text-muted-foreground mb-3">Esta exibição não tem filtros avançados.</p>
                  <Button variant="outline" size="sm" onClick={() => setAdvFilterAdding(true)}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar filtro
                  </Button>
                </div>
              )}
              {advFilterGroups.map((group, gi) => (
                <div key={gi} className="border border-border rounded-lg p-3 mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold">Agrupar {gi + 1}</span>
                    <button onClick={() => setAdvFilterGroups(g => g.filter((_, i) => i !== gi))} className="text-muted-foreground hover:text-destructive"><X className="w-3.5 h-3.5" /></button>
                  </div>
                  {group.map((filter, fi) => (
                    <div key={fi} className="space-y-2 mb-2">
                      <div className="flex items-center gap-2">
                        <select className="flex-1 text-xs border border-border rounded px-2 py-1.5 bg-background" value={filter.property}
                          onChange={e => { const ng = [...advFilterGroups]; ng[gi] = [...ng[gi]]; ng[gi][fi] = { ...filter, property: e.target.value }; setAdvFilterGroups(ng); }}>
                          {TICKET_FILTERS.map(p => <option key={p.key} value={p.label}>{p.label}</option>)}
                        </select>
                        <button onClick={() => { const ng = [...advFilterGroups]; ng[gi] = ng[gi].filter((_, i) => i !== fi); if (ng[gi].length === 0) ng.splice(gi, 1); setAdvFilterGroups(ng); }}><X className="w-3.5 h-3.5 text-muted-foreground" /></button>
                      </div>
                      <select className="w-full text-xs border border-border rounded px-2 py-1.5 bg-background" value={filter.operator}
                        onChange={e => { const ng = [...advFilterGroups]; ng[gi] = [...ng[gi]]; ng[gi][fi] = { ...filter, operator: e.target.value }; setAdvFilterGroups(ng); }}>
                        <option value="any">é qualquer um de</option>
                        <option value="none">não é nenhum de</option>
                        <option value="known">é conhecido</option>
                        <option value="unknown">é desconhecido</option>
                      </select>
                      {(filter.operator === 'any' || filter.operator === 'none') && (
                        <Input className="text-xs h-8" placeholder="Pesquisar..." value={filter.value}
                          onChange={e => { const ng = [...advFilterGroups]; ng[gi] = [...ng[gi]]; ng[gi][fi] = { ...filter, value: e.target.value }; setAdvFilterGroups(ng); }} />
                      )}
                      {fi < group.length - 1 && <p className="text-[10px] text-muted-foreground font-medium">e</p>}
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="text-xs mt-1" onClick={() => { const ng = [...advFilterGroups]; ng[gi] = [...ng[gi], { property: TICKET_FILTERS[0]?.label ?? '', operator: 'any', value: '' }]; setAdvFilterGroups(ng); }}>
                    <Plus className="w-3 h-3 mr-1" /> Adicionar filtro
                  </Button>
                </div>
              ))}
              {advFilterAdding && (
                <div className="border border-border rounded-lg p-3 mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold">Adicionar filtro</span>
                    <button onClick={() => { setAdvFilterAdding(false); setAdvFilterSearch(''); }} className="text-xs text-muted-foreground hover:text-foreground">Cancelar</button>
                  </div>
                  <div className="relative mb-2">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input className="pl-8 text-xs h-8" placeholder="Pesquisar em Ticket propriedades" value={advFilterSearch} onChange={e => setAdvFilterSearch(e.target.value)} autoFocus />
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-0.5">
                    {TICKET_FILTERS.map(p => p.label).filter(p => !advFilterSearch || p.toLowerCase().includes(advFilterSearch.toLowerCase())).map(p => (
                      <button key={p} onClick={() => { setAdvFilterGroups(g => [...g, [{ property: p, operator: 'any', value: '' }]]); setAdvFilterAdding(false); setAdvFilterSearch(''); }}
                        className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted transition-colors text-foreground">{p}</button>
                    ))}
                  </div>
                </div>
              )}
              {advFilterGroups.length > 0 && !advFilterAdding && (
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className="text-[10px]">ou</Badge>
                  <Button variant="outline" size="sm" className="text-xs" onClick={() => setAdvFilterAdding(true)}>
                    <Plus className="w-3 h-3 mr-1" /> Adicionar grupo de filtros
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
          objectType="ticket"
          allStages={stages.map(s => ({ id: s.id, name: s.nome }))}
          initialConfig={stageAIConfigs[aiConfigStage.id]}
          onSave={async (id, cfg) => {
            setStageAIConfigs(prev => ({ ...prev, [id]: cfg }));
            try {
              const org = await getOrg();
              await (supabase as any).schema('crm').from('estagio_ia_config').upsert({
                empresa_id: org, estagio_id: id, ativo: cfg.active,
                nome_ia: cfg.aiName, provider: cfg.provider, instancia_id: cfg.instance,
                prompt_sistema: cfg.systemPrompt, auto_complemento: cfg.autoComplement,
                mensagem_boas_vindas: { enabled: cfg.welcomeEnabled, type: cfg.welcomeType, text: cfg.welcomeText },
                modo_inicio: cfg.startMode, delay_digitacao: cfg.typingDelay, delay_resposta: cfg.responseDelay,
                perguntas: cfg.questions, followups: cfg.followUps,
                rag_ativo: cfg.ragEnabled, rag_fonte: cfg.ragSource, rag_max_turnos: cfg.ragMaxTurns,
                transicoes: cfg.transitions, atualizado_em: new Date().toISOString(),
              }, { onConflict: 'estagio_id' });
              toast({ title: 'Configuração de IA salva' });
            } catch (e: any) {
              console.error('[StageAI] Save error:', e);
              toast({ title: 'Erro ao salvar IA', description: e?.message || String(e), variant: 'destructive' });
            }
          }}
        />
      )}
    </div>
  );
}
