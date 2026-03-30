import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Search, Plus, Filter, ChevronDown, ChevronRight, MoreHorizontal,
  Briefcase, User, Download,
  ArrowUpDown, BarChart3, Copy, Settings2, SlidersHorizontal, Kanban, Bot, Loader2,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import StageAIConfigModal, { type StageAIConfig } from '@/components/crm/StageAIConfigModal';
import { useCrmPipelines, useCrmDealsByPipeline } from '@/hooks/useCrm';
import type { CrmDeal, CrmPipelineStage } from '@/types/crm';

const TABS = [
  { id: 'all', label: 'Todos os negócios' },
  { id: 'mine', label: 'Meus negócios' },
];

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
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [pipelineDropdown, setPipelineDropdown] = useState(false);
  const [aiConfigStage, setAiConfigStage] = useState<{ id: string; name: string } | null>(null);
  const [stageAIConfigs, setStageAIConfigs] = useState<Record<string, StageAIConfig>>({});

  // Fetch pipelines from DB
  const { data: pipelines = [], isLoading: loadingPipelines } = useCrmPipelines('deal');
  const [activePipelineId, setActivePipelineId] = useState<string | null>(null);

  const pipeline = pipelines.find(p => p.id === activePipelineId) || pipelines[0];
  const pipelineId = pipeline?.id || '';

  // Fetch deals for selected pipeline
  const { data: allDeals = [], isLoading: loadingDeals } = useCrmDealsByPipeline(pipelineId);

  const filteredDeals = useMemo(() =>
    search ? allDeals.filter(d => d.nome.toLowerCase().includes(search.toLowerCase())) : allDeals,
    [allDeals, search]);

  const dealsByStage = useMemo(() => {
    const map: Record<string, CrmDeal[]> = {};
    for (const stage of (pipeline?.estagios || [])) map[stage.id] = [];
    for (const deal of filteredDeals) {
      if (deal.estagio_id && map[deal.estagio_id]) map[deal.estagio_id].push(deal);
    }
    return map;
  }, [filteredDeals, pipeline?.estagios]);

  const isLoading = loadingPipelines || loadingDeals;
  const stages: CrmPipelineStage[] = pipeline?.estagios || [];

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
              {idx === 0 && allDeals.length > 0 && (
                <Badge variant="outline" className="ml-1.5 text-[10px] h-5 px-1.5 rounded-sm font-semibold">
                  {allDeals.length.toLocaleString('pt-BR')}
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
                  onClick={() => navigate(`/crm/pipeline-settings?type=deal&pipeline=${pipelineId}`)}
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
          Proprietário do negócio <ChevronRight className="w-3 h-3 rotate-90" />
        </button>
        <button className="flex items-center gap-1 text-muted-foreground hover:text-foreground font-medium">
          Data de criação <ChevronRight className="w-3 h-3 rotate-90" />
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
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : stages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <Briefcase className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm">Nenhum pipeline configurado</p>
            <p className="text-xs mt-1">Crie um pipeline para começar a gerenciar negócios</p>
          </div>
        ) : (
          <div className="flex gap-3 min-w-max h-full">
            {stages.map((stage, stageIdx) => {
              const stageDeals = dealsByStage[stage.id] || [];
              const totalValue = stageDeals.reduce((s, d) => s + Number(d.valor || 0), 0);
              const prob = stage.probabilidade / 100;
              const weightedValue = Math.floor(totalValue * prob);
              return (
                <div key={stage.id} className="w-[260px] flex flex-col flex-shrink-0">
                  {/* Stage header */}
                  <div className="flex items-center justify-between px-3 py-2 bg-muted/50 rounded-t-lg border border-border border-b-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-semibold text-foreground truncate">{stage.nome}</span>
                      <Badge variant="outline" className="text-[10px] h-4 px-1 flex-shrink-0">{stageDeals.length}</Badge>
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

                  {/* Stage body */}
                  <div className="flex-1 overflow-y-auto border-x border-border bg-muted/5 p-1.5 space-y-1.5 max-h-[calc(100vh-320px)]">
                    {stageDeals.map(deal => (
                      <div key={deal.id} className="bg-card border border-border rounded-lg p-3 space-y-1.5 hover:shadow-md transition-shadow cursor-pointer">
                        <p className="text-[13px] font-semibold text-primary hover:underline leading-tight">{deal.nome}</p>
                        <p className="text-xs text-muted-foreground">Valor: {formatCurrency(Number(deal.valor || 0))}</p>
                        {deal.plataforma && <p className="text-xs text-muted-foreground">Plataforma: {deal.plataforma}</p>}
                        {deal.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            {deal.tags.map(tag => (
                              <Badge key={tag} variant="outline" className={cn('text-[10px] px-1.5 py-0 rounded-sm', TAG_COLORS[tag] || '')}>{tag}</Badge>
                            ))}
                          </div>
                        )}
                        <p className="text-[10px] text-muted-foreground font-mono">{deal.numero_registro}</p>
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
                    <p>{formatCurrency(weightedValue)} ({stage.probabilidade}%) | Valor ponderado</p>
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
