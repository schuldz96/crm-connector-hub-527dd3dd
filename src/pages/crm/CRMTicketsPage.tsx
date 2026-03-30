import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Search, Plus, Filter, ChevronDown, ChevronRight, MoreHorizontal,
  User, Ticket, Download,
  ArrowUpDown, BarChart3, Copy, Settings2, SlidersHorizontal, Kanban, Bot, Loader2,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import StageAIConfigModal, { type StageAIConfig } from '@/components/crm/StageAIConfigModal';
import { useCrmPipelines, useCrmTicketsByPipeline } from '@/hooks/useCrm';
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
  'Leads frios forum': 'bg-muted text-muted-foreground border-border',
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
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [pipelineDropdown, setPipelineDropdown] = useState(false);
  const [aiConfigStage, setAiConfigStage] = useState<{ id: string; name: string } | null>(null);
  const [stageAIConfigs, setStageAIConfigs] = useState<Record<string, StageAIConfig>>({});

  // Fetch pipelines from DB
  const { data: pipelines = [], isLoading: loadingPipelines } = useCrmPipelines('ticket');
  const [activePipelineId, setActivePipelineId] = useState<string | null>(null);

  const pipeline = pipelines.find(p => p.id === activePipelineId) || pipelines[0];
  const pipelineId = pipeline?.id || '';

  // Fetch tickets for selected pipeline
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
              {idx === 0 && <span className="ml-1 text-muted-foreground/50 cursor-pointer">×</span>}
            </button>
          ))}
          <button className="px-3 py-2.5 text-muted-foreground hover:text-foreground">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
          <Button size="sm" className="gap-1.5 h-8">Adicionar tickets <ChevronRight className="w-3 h-3" /></Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card flex-shrink-0">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Pesquisar" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-8 text-sm" />
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs"><Kanban className="w-3.5 h-3.5" /> Exibição de quadro</Button>
          <Button variant="ghost" size="icon" className="h-8 w-8"><Settings2 className="w-3.5 h-3.5" /></Button>
          <div className="w-px h-5 bg-border mx-1" />
          {/* Pipeline selector */}
          {pipelines.length > 0 && (
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
                    onClick={() => navigate(`/crm/pipeline-settings?type=ticket&pipeline=${pipelineId}`)}
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    Editar pipeline <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
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

      {/* Kanban board */}
      <div className="flex-1 overflow-x-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : stages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <Ticket className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm">Nenhum pipeline configurado</p>
            <p className="text-xs mt-1">Crie um pipeline de tickets para começar</p>
          </div>
        ) : (
          <div className="flex gap-3 min-w-max h-full">
            {stages.map(stage => {
              const stageTickets = ticketsByStage[stage.id] || [];
              return (
                <div key={stage.id} className="w-[260px] flex flex-col flex-shrink-0">
                  <div className="flex items-center justify-between px-3 py-2 bg-muted/50 rounded-t-lg border border-border border-b-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-semibold text-foreground truncate">{stage.nome}</span>
                      <Badge variant="outline" className="text-[10px] h-4 px-1 flex-shrink-0">{stageTickets.length}</Badge>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => setAiConfigStage({ id: stage.id, name: stage.nome })}
                        className={cn(
                          'flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors',
                          stageAIConfigs[stage.id]?.active
                            ? 'bg-primary/15 text-primary border border-primary/30'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                        )}
                        title="Configurar IA"
                      >
                        <Bot className="w-3 h-3" />
                        IA
                        {stageAIConfigs[stage.id]?.active && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                      </button>
                      <ChevronDown className="w-3 h-3 text-muted-foreground -rotate-90" />
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto border-x border-border bg-muted/5 p-1.5 space-y-1.5 max-h-[calc(100vh-320px)]">
                    {stageTickets.map(ticket => {
                      const pri = PRIORITY_CONFIG[ticket.prioridade];
                      return (
                        <div key={ticket.id} className="bg-card border border-border rounded-lg p-3 space-y-1.5 hover:shadow-md transition-shadow cursor-pointer">
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
                          <div className="flex items-center gap-2 pt-1 border-t border-border/50 mt-1">
                            {['📋', '✨', '📧', '🔗'].map((icon, i) => (
                              <button key={i} className="text-[10px] text-muted-foreground hover:text-foreground">{icon}</button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

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
