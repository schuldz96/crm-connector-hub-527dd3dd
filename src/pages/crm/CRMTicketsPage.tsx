import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Search, Plus, Filter, ChevronDown, ChevronRight, MoreHorizontal,
  Calendar, User, AlertCircle, Ticket, Download,
  ArrowUpDown, BarChart3, Copy, Settings2, SlidersHorizontal, Kanban, Bot,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import StageAIConfigModal, { type StageAIConfig } from '@/components/crm/StageAIConfigModal';

interface Pipeline {
  id: string;
  name: string;
  stages: { id: string; name: string; color: string }[];
}

interface TicketItem {
  id: string;
  name: string;
  stageId: string;
  owner: string;
  platform: string;
  pipelineId: string;
  openDays: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  tags: string[];
}

const PIPELINES: Pipeline[] = [
  {
    id: 'pre-vendas',
    name: 'Pré-vendas Inbound',
    stages: [
      { id: 'new',           name: 'Novo',                 color: 'hsl(var(--primary))' },
      { id: 'contact',       name: 'Tentativa de contato', color: 'hsl(var(--warning))' },
      { id: 'connected',     name: 'Conectado',            color: 'hsl(var(--accent))' },
      { id: 'qualified',     name: 'Qualificado',          color: 'hsl(var(--success))' },
      { id: 'meeting',       name: 'Reunião agendada',     color: 'hsl(var(--success))' },
      { id: 'disqualified',  name: 'Desqualificado',       color: 'hsl(var(--destructive))' },
    ],
  },
  {
    id: 'nps',
    name: 'NPS',
    stages: [
      { id: 'nps-new',       name: 'Novo',        color: 'hsl(var(--primary))' },
      { id: 'nps-contact',   name: 'Contatado',   color: 'hsl(var(--warning))' },
      { id: 'nps-resolved',  name: 'Resolvido',   color: 'hsl(var(--success))' },
    ],
  },
  {
    id: 'appcall',
    name: 'Appcall',
    stages: [
      { id: 'ac-open',       name: 'Aberto',      color: 'hsl(var(--primary))' },
      { id: 'ac-progress',   name: 'Andamento',   color: 'hsl(var(--warning))' },
      { id: 'ac-done',       name: 'Concluído',   color: 'hsl(var(--success))' },
    ],
  },
  {
    id: 'csat',
    name: 'Csat - Detratores',
    stages: [
      { id: 'cs-new',        name: 'Novo',        color: 'hsl(var(--primary))' },
      { id: 'cs-contact',    name: 'Em contato',  color: 'hsl(var(--warning))' },
      { id: 'cs-resolved',   name: 'Resolvido',   color: 'hsl(var(--success))' },
    ],
  },
  {
    id: 'suporte-ativo',
    name: 'Suporte Ativo',
    stages: [
      { id: 'sa-open',       name: 'Aberto',           color: 'hsl(var(--primary))' },
      { id: 'sa-progress',   name: 'Em andamento',     color: 'hsl(var(--warning))' },
      { id: 'sa-waiting',    name: 'Aguardando',       color: 'hsl(var(--muted-foreground))' },
      { id: 'sa-resolved',   name: 'Resolvido',        color: 'hsl(var(--success))' },
    ],
  },
  {
    id: 'suporte-retencao',
    name: 'Suporte Retenção',
    stages: [
      { id: 'sr-new',        name: 'Novo',             color: 'hsl(var(--primary))' },
      { id: 'sr-analysis',   name: 'Em análise',       color: 'hsl(var(--warning))' },
      { id: 'sr-retained',   name: 'Retido',           color: 'hsl(var(--success))' },
      { id: 'sr-churned',    name: 'Churned',          color: 'hsl(var(--destructive))' },
    ],
  },
];

const TABS = [
  { id: 'all', label: 'Todos os tickets', count: 5067 },
  { id: 'mine', label: 'Meus tickets abertos' },
  { id: 'unassigned', label: 'tickets não atribuídos' },
];

const PRIORITY_CONFIG: Record<TicketItem['priority'], { label: string; class: string; dot: string }> = {
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

function generateTickets(pipelineId: string, stages: Pipeline['stages']): TicketItem[] {
  const names = ['Appmax <> Texas Farm Store', 'TRANSAÇÃO APROVADA - AUMENTE ATÉ 10% SUA...', 'Isabela - Parcerias', 'Via Máfia', 'Shopinfo', 'Appmax & América Joias', 'Appmax <> Ballena', '[Onb] http://www.voeazul.com...', 'Luiz - Mídias Sociais', '[WA] https://digitalegacy.com...', 'Appmax <> L&G Authentic', '[Onb] https://www.instagram.c...', 'Manipulados Rafao Lorenzatto', 'Renato Russo', 'Luciene Dlugasz Honório'];
  const owners = ['Gabriel Luiz de...', 'Felipe Ezequiel...', 'Rysianne da Si...', 'Carlos Eduardo...', 'Jociel Victor N...', 'Luciano Jorge Miranda Fil...'];
  return stages.flatMap((stage, si) =>
    Array.from({ length: Math.max(2, Math.floor(Math.random() * 6) + 1) }, (_, di) => ({
      id: `${pipelineId}-${stage.id}-${di}`,
      name: names[(si * 3 + di) % names.length],
      stageId: stage.id,
      owner: owners[(si + di) % owners.length],
      platform: ['VTEX', 'Shopify', 'Tray', 'Nuvemshop', 'Woocom...', 'Magento', 'Outras', 'WBuy'][(si + di) % 8],
      pipelineId,
      openDays: `Aberto por ${Math.floor(Math.random() * 7) + 1} ${Math.random() > 0.5 ? 'dias' : 'meses'}`,
      priority: (['low', 'medium', 'high', 'urgent'] as const)[(si + di) % 4],
      tags: di % 2 === 0 ? ['Conta Criada', 'Cadência não cumprida'] : di % 3 === 0 ? ['Integrado'] : [],
    }))
  );
}

export default function CRMTicketsPage() {
  const [activePipeline, setActivePipeline] = useState(PIPELINES[0].id);
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [pipelineDropdown, setPipelineDropdown] = useState(false);
  const [aiConfigStage, setAiConfigStage] = useState<{ id: string; name: string } | null>(null);
  const [stageAIConfigs, setStageAIConfigs] = useState<Record<string, StageAIConfig>>({});

  const pipeline = PIPELINES.find(p => p.id === activePipeline)!;
  const tickets = useMemo(() => generateTickets(pipeline.id, pipeline.stages), [pipeline.id]);

  const filteredTickets = useMemo(() =>
    search ? tickets.filter(t => t.name.toLowerCase().includes(search.toLowerCase())) : tickets,
    [tickets, search]);

  const ticketsByStage = useMemo(() => {
    const map: Record<string, TicketItem[]> = {};
    for (const stage of pipeline.stages) map[stage.id] = [];
    for (const ticket of filteredTickets) {
      if (map[ticket.stageId]) map[ticket.stageId].push(ticket);
    }
    return map;
  }, [filteredTickets, pipeline.stages]);

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
              {tab.count && (
                <Badge variant="outline" className="ml-1.5 text-[10px] h-5 px-1.5 rounded-sm font-semibold">
                  {tab.count.toLocaleString('pt-BR')}
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
          <DropdownMenu open={pipelineDropdown} onOpenChange={setPipelineDropdown}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                {pipeline.name} <ChevronDown className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <div className="p-2">
                <Input placeholder="Pesquisar" className="h-7 text-xs mb-2" />
              </div>
              {PIPELINES.map(p => (
                <DropdownMenuItem key={p.id} onClick={() => { setActivePipeline(p.id); setPipelineDropdown(false); }}
                  className={cn(p.id === activePipeline && 'bg-muted font-medium')}>{p.name}</DropdownMenuItem>
              ))}
              <div className="border-t border-border mt-1 pt-1 px-2 pb-1">
                <button className="text-xs text-primary hover:underline flex items-center gap-1">
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
          Data da última atividade <ChevronRight className="w-3 h-3 rotate-90" />
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
        <div className="flex gap-3 min-w-max h-full">
          {pipeline.stages.map(stage => {
            const stageTickets = ticketsByStage[stage.id] || [];
            return (
              <div key={stage.id} className="w-[260px] flex flex-col flex-shrink-0">
                <div className="flex items-center justify-between px-3 py-2 bg-muted/50 rounded-t-lg border border-border border-b-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-semibold text-foreground truncate">{stage.name}</span>
                    <Badge variant="outline" className="text-[10px] h-4 px-1 flex-shrink-0">{stageTickets.length}</Badge>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => setAiConfigStage({ id: stage.id, name: stage.name })}
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
                      {stageAIConfigs[stage.id]?.active && (
                        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                      )}
                    </button>
                    <ChevronDown className="w-3 h-3 text-muted-foreground -rotate-90" />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto border-x border-border bg-muted/5 p-1.5 space-y-1.5 max-h-[calc(100vh-320px)]">
                  {stageTickets.map(ticket => {
                    const pri = PRIORITY_CONFIG[ticket.priority];
                    return (
                      <div key={ticket.id} className="bg-card border border-border rounded-lg p-3 space-y-1.5 hover:shadow-md transition-shadow cursor-pointer">
                        <p className="text-[13px] font-semibold text-primary hover:underline leading-tight">{ticket.name}</p>
                        <p className="text-xs text-muted-foreground">{ticket.openDays}</p>
                        <p className="text-xs text-muted-foreground">Plataforma de ecommerce: {ticket.platform}</p>
                        <p className="text-xs text-muted-foreground">Proprietário do ticket: {ticket.owner}</p>
                        {ticket.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            {ticket.tags.map(tag => (
                              <Badge key={tag} variant="outline" className={cn('text-[10px] px-1.5 py-0 rounded-sm', TAG_COLORS[tag] || '')}>{tag}</Badge>
                            ))}
                          </div>
                        )}
                        {ticket.priority !== 'low' && (
                          <div className="flex items-center gap-1.5">
                            <div className={cn('w-2 h-2 rounded-full', pri.dot)} />
                            <span className={cn('text-[10px]', pri.class)}>{pri.label}</span>
                          </div>
                        )}
                        {ticket.owner && (
                          <div className="flex items-center gap-1.5 pt-1">
                            <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center">
                              <User className="w-3 h-3 text-muted-foreground" />
                            </div>
                            <span className="text-[11px] text-primary hover:underline">{ticket.owner}</span>
                          </div>
                        )}
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
      </div>
      {/* AI Config Modal */}
      {aiConfigStage && (
        <StageAIConfigModal
          open={!!aiConfigStage}
          onClose={() => setAiConfigStage(null)}
          stageName={aiConfigStage.name}
          stageId={aiConfigStage.id}
          allStages={pipeline.stages.map(s => ({ id: s.id, name: s.name }))}
          initialConfig={stageAIConfigs[aiConfigStage.id]}
          onSave={(id, cfg) => setStageAIConfigs(prev => ({ ...prev, [id]: cfg }))}
        />
      )}
    </div>
  );
}
