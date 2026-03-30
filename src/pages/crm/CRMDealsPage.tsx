import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Search, Plus, Filter, ChevronDown, ChevronRight, MoreHorizontal,
  Briefcase, Calendar, DollarSign, User, Download,
  ArrowUpDown, BarChart3, Copy, Settings2, SlidersHorizontal, Kanban,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface Pipeline {
  id: string;
  name: string;
  stages: { id: string; name: string; color: string }[];
}

interface Deal {
  id: string;
  name: string;
  value: number;
  stageId: string;
  owner: string;
  company: string;
  platform: string;
  pipelineId: string;
  lastActivity: string;
  tags: string[];
}

const PIPELINES: Pipeline[] = [
  {
    id: 'closer-outbound',
    name: 'Processo de Closer Outbo...',
    stages: [
      { id: 'reunion-scheduled', name: 'Reunião agendada', color: 'hsl(var(--primary))' },
      { id: 'no-show',           name: 'No-show',          color: 'hsl(var(--warning))' },
      { id: 'reunion-done',      name: 'Reunião realizada', color: 'hsl(var(--accent))' },
      { id: 'proposal-analysis', name: 'Proposta em análise', color: 'hsl(var(--muted-foreground))' },
      { id: 'proposal-accepted', name: 'Proposta aceita',   color: 'hsl(var(--success))' },
      { id: 'integrated',        name: 'Parceiro integrado', color: 'hsl(var(--success))' },
    ],
  },
  {
    id: 'inbound',
    name: 'Processo Inbound',
    stages: [
      { id: 'inb-new',       name: 'Novo lead',         color: 'hsl(var(--primary))' },
      { id: 'inb-contact',   name: 'Em contato',        color: 'hsl(var(--warning))' },
      { id: 'inb-qualified', name: 'Qualificado',       color: 'hsl(var(--accent))' },
      { id: 'inb-proposal',  name: 'Proposta enviada',  color: 'hsl(var(--muted-foreground))' },
      { id: 'inb-won',       name: 'Ganho',             color: 'hsl(var(--success))' },
      { id: 'inb-lost',      name: 'Perdido',           color: 'hsl(var(--destructive))' },
    ],
  },
];

const TABS = [
  { id: 'all', label: 'Todos os negócios', count: 7333 },
  { id: 'listbuilding', label: 'Listbuilding' },
  { id: 'mine', label: 'Meus negócios' },
];

function generateDeals(pipelineId: string, stages: Pipeline['stages']): Deal[] {
  const names = ['Dental Odonto - Novo(a) Deal', 'Rogerio Sócio', 'odonto equipamentos - Novo(a) Deal', 'Raposo Cosméticos - Novo(a) Deal', 'Olimpob2b - Olimpob2b', 'Ouro Caps - Novo(a) Deal', 'CDJ BEAUTY & BEAUTY COSMETICOS LTDA -...', 'https://mvcrossmultimarca - Mv.cross', 'https://roadtrip021.com.br - RoadTrip021', 'https://www.obafactory.co'];
  const owners = ['Guilherme site', 'Rogério Perfect rodas', 'Guilherme Romano', '', 'Tiago De Oliveira Jesus', 'Elizabeth GonÇalves', 'Jean Cabral', 'Eduardo Financeiro', 'Wagner Souza', 'Gabriela Fonseca'];
  return stages.flatMap((stage, si) =>
    Array.from({ length: Math.floor(Math.random() * 4) + 2 }, (_, di) => ({
      id: `${pipelineId}-${stage.id}-${di}`,
      name: names[(si * 3 + di) % names.length],
      value: [50000, 200000, 500000, 65000, 250000, 2500000, 300000, 400000, 100000, 1200000][(si + di) % 10],
      stageId: stage.id,
      owner: owners[(si + di) % owners.length],
      company: names[(si * 3 + di) % names.length],
      platform: ['Loja Inte...', 'Bagy', 'VTEX', 'Shopify', 'Wordpress', 'Nuvemshop', 'Tray', 'Wix'][(si + di) % 8],
      pipelineId,
      lastActivity: `Reunião há ${Math.floor(Math.random() * 5) + 1} dias`,
      tags: di % 3 === 0 ? ['Integrado'] : di % 3 === 1 ? ['Listbuilding'] : [],
    }))
  );
}

const TAG_COLORS: Record<string, string> = {
  'Integrado': 'bg-success/15 text-success border-success/30',
  'Listbuilding': 'bg-primary/15 text-primary border-primary/30',
  'Primeira Venda 30+': 'bg-warning/15 text-warning border-warning/30',
};

const formatCurrency = (v: number) =>
  v >= 1000000 ? `R$ ${(v / 1000000).toFixed(1)} mi` :
  v >= 1000 ? `R$ ${(v / 1000).toFixed(0)} mil` :
  `R$ ${v}`;

export default function CRMDealsPage() {
  const [activePipeline, setActivePipeline] = useState(PIPELINES[0].id);
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [pipelineDropdown, setPipelineDropdown] = useState(false);

  const pipeline = PIPELINES.find(p => p.id === activePipeline)!;
  const deals = useMemo(() => generateDeals(pipeline.id, pipeline.stages), [pipeline.id]);

  const filteredDeals = useMemo(() =>
    search ? deals.filter(d => d.name.toLowerCase().includes(search.toLowerCase())) : deals,
    [deals, search]);

  const dealsByStage = useMemo(() => {
    const map: Record<string, Deal[]> = {};
    for (const stage of pipeline.stages) map[stage.id] = [];
    for (const deal of filteredDeals) {
      if (map[deal.stageId]) map[deal.stageId].push(deal);
    }
    return map;
  }, [filteredDeals, pipeline.stages]);

  return (
    <div className="flex flex-col h-full">
      {/* Top tabs bar */}
      <div className="flex items-center justify-between px-4 border-b border-border bg-card flex-shrink-0">
        <div className="flex items-center gap-0">
          <div className="flex items-center gap-1.5 px-3 py-2 border-r border-border">
            <Briefcase className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Negócios</span>
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
          <Button size="sm" className="gap-1.5 h-8">Adicionar negócios <ChevronRight className="w-3 h-3" /></Button>
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
          Proprietário do negócio <ChevronRight className="w-3 h-3 rotate-90" />
        </button>
        <button className="flex items-center gap-1 text-muted-foreground hover:text-foreground font-medium">
          Data de criação <ChevronRight className="w-3 h-3 rotate-90" />
        </button>
        <button className="flex items-center gap-1 text-muted-foreground hover:text-foreground font-medium">
          Data da última atividade <ChevronRight className="w-3 h-3 rotate-90" />
        </button>
        <button className="flex items-center gap-1 text-muted-foreground hover:text-foreground font-medium">
          Data de fechamento <ChevronRight className="w-3 h-3 rotate-90" />
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
            const stageDeals = dealsByStage[stage.id] || [];
            const totalValue = stageDeals.reduce((s, d) => s + d.value, 0);
            const weightedValue = Math.floor(totalValue * ([0.1, 0.1, 0.2, 0.4, 0.6, 0.8][pipeline.stages.indexOf(stage)] || 0.1));
            return (
              <div key={stage.id} className="w-[260px] flex flex-col flex-shrink-0">
                {/* Stage header */}
                <div className="flex items-center justify-between px-3 py-2 bg-muted/50 rounded-t-lg border border-border border-b-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-semibold text-foreground truncate">{stage.name}</span>
                    <Badge variant="outline" className="text-[10px] h-4 px-1 flex-shrink-0">{stageDeals.length}</Badge>
                  </div>
                  <ChevronDown className="w-3 h-3 text-muted-foreground flex-shrink-0 -rotate-90" />
                </div>

                {/* Stage body */}
                <div className="flex-1 overflow-y-auto border-x border-border bg-muted/5 p-1.5 space-y-1.5 max-h-[calc(100vh-320px)]">
                  {stageDeals.map(deal => (
                    <div key={deal.id} className="bg-card border border-border rounded-lg p-3 space-y-1.5 hover:shadow-md transition-shadow cursor-pointer">
                      <p className="text-[13px] font-semibold text-primary hover:underline leading-tight">{deal.name}</p>
                      <p className="text-xs text-muted-foreground">Valor: {formatCurrency(deal.value)}</p>
                      <p className="text-xs text-muted-foreground">Modelo de negócio qualificação: E-c...</p>
                      <p className="text-xs text-muted-foreground">Plataforma de ecommerce: {deal.platform}</p>
                      {deal.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {deal.tags.map(tag => (
                            <Badge key={tag} variant="outline" className={cn('text-[10px] px-1.5 py-0 rounded-sm', TAG_COLORS[tag] || '')}>{tag}</Badge>
                          ))}
                        </div>
                      )}
                      {deal.owner && (
                        <div className="flex items-center gap-1.5 pt-1">
                          <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center">
                            <User className="w-3 h-3 text-muted-foreground" />
                          </div>
                          <span className="text-[11px] text-primary hover:underline">{deal.owner}</span>
                        </div>
                      )}
                      <p className="text-[10px] text-muted-foreground">{deal.lastActivity}</p>
                      <div className="flex items-center gap-2 pt-1 border-t border-border/50 mt-1">
                        {['📋', '✨', '📧', '🔗'].map((icon, i) => (
                          <button key={i} className="text-[10px] text-muted-foreground hover:text-foreground">{icon}</button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Stage footer */}
                <div className="px-3 py-2 text-[10px] text-muted-foreground border border-border rounded-b-lg bg-muted/30 space-y-0.5">
                  <p>{formatCurrency(totalValue)} | Valor total</p>
                  <p>{formatCurrency(weightedValue)} ({Math.round(weightedValue / (totalValue || 1) * 100)}%) | Valor ponderado</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
