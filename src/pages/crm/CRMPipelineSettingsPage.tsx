import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  ChevronDown, ChevronLeft, Plus, Trash2, GripVertical, Loader2,
  Briefcase, Ticket, ExternalLink, Settings2, MoreHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCrmPipelines } from '@/hooks/useCrm';
import { supabase } from '@/integrations/supabase/client';
import { getSaasEmpresaId } from '@/lib/saas';
import type { CrmPipeline, CrmPipelineStage } from '@/types/crm';
import { useToast } from '@/hooks/use-toast';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const saas = () => (supabase as any).schema('saas');

const OBJECT_TYPES = [
  { id: 'deal', label: 'Negócios', icon: Briefcase },
  { id: 'ticket', label: 'Tickets', icon: Ticket },
] as const;

const PROB_OPTIONS = [
  { value: '0', label: 'Perdidos (0%)' },
  { value: '5', label: '5%' },
  { value: '10', label: '10%' },
  { value: '20', label: '20%' },
  { value: '30', label: '30%' },
  { value: '40', label: '40%' },
  { value: '50', label: '50%' },
  { value: '60', label: '60%' },
  { value: '70', label: '70%' },
  { value: '80', label: '80%' },
  { value: '90', label: '90%' },
  { value: '100', label: 'Fechados (100%)' },
];

const STAGE_COLORS = [
  '#3B82F6', '#F59E0B', '#8B5CF6', '#6B7280', '#10B981',
  '#22C55E', '#EF4444', '#06B6D4', '#EC4899', '#F97316',
];

const TABS = [
  { id: 'config', label: 'Configurar' },
  { id: 'rules', label: 'Regras do pipeline' },
  { id: 'automate', label: 'Automatizar' },
  { id: 'tags', label: 'Negócio tags' },
];

interface EditableStage {
  id: string;
  nome: string;
  cor: string;
  probabilidade: number;
  ordem: number;
  isNew?: boolean;
}

export default function CRMPipelineSettingsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const objectType = (searchParams.get('type') || 'deal') as 'deal' | 'ticket';
  const pipelineIdParam = searchParams.get('pipeline');

  const { data: pipelines = [], isLoading, refetch } = useCrmPipelines(objectType);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(pipelineIdParam);
  const [stages, setStages] = useState<EditableStage[]>([]);
  const [activeTab, setActiveTab] = useState('config');
  const [saving, setSaving] = useState(false);
  const [pipelineDropdown, setPipelineDropdown] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const selectedPipeline = pipelines.find(p => p.id === selectedPipelineId) || pipelines[0];

  // Load stages when pipeline changes
  useEffect(() => {
    if (selectedPipeline?.estagios) {
      setStages(selectedPipeline.estagios.map(s => ({
        id: s.id,
        nome: s.nome,
        cor: s.cor,
        probabilidade: s.probabilidade,
        ordem: s.ordem,
      })));
      setHasChanges(false);
    }
  }, [selectedPipeline?.id]);

  // Auto-select first pipeline
  useEffect(() => {
    if (!selectedPipelineId && pipelines.length > 0) {
      setSelectedPipelineId(pipelines[0].id);
    }
  }, [pipelines, selectedPipelineId]);

  const updateStage = (idx: number, field: keyof EditableStage, value: string | number) => {
    setStages(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
    setHasChanges(true);
  };

  const addStage = () => {
    setStages(prev => [...prev, {
      id: `new-${Date.now()}`,
      nome: '',
      cor: STAGE_COLORS[prev.length % STAGE_COLORS.length],
      probabilidade: 0,
      ordem: prev.length,
      isNew: true,
    }]);
    setHasChanges(true);
  };

  const removeStage = (idx: number) => {
    setStages(prev => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, ordem: i })));
    setHasChanges(true);
  };

  // Stage drag-and-drop reorder
  const dragStageIdx = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const handleStageDrop = (dropIdx: number) => {
    const fromIdx = dragStageIdx.current;
    if (fromIdx === null || fromIdx === dropIdx) return;
    setStages(prev => {
      const arr = [...prev];
      const [moved] = arr.splice(fromIdx, 1);
      arr.splice(dropIdx, 0, moved);
      return arr.map((s, i) => ({ ...s, ordem: i }));
    });
    setHasChanges(true);
    dragStageIdx.current = null;
    setDragOverIdx(null);
  };

  const saveChanges = async () => {
    if (!selectedPipeline) return;
    setSaving(true);
    try {
      // Delete removed stages
      const existingIds = (selectedPipeline.estagios || []).map(s => s.id);
      const currentIds = stages.filter(s => !s.isNew).map(s => s.id);
      const deletedIds = existingIds.filter(id => !currentIds.includes(id));

      if (deletedIds.length > 0) {
        await saas().from('crm_pipeline_estagios').delete().in('id', deletedIds);
      }

      // Upsert stages
      for (const stage of stages) {
        if (stage.isNew) {
          await saas().from('crm_pipeline_estagios').insert({
            pipeline_id: selectedPipeline.id,
            nome: stage.nome,
            cor: stage.cor,
            probabilidade: stage.probabilidade,
            ordem: stage.ordem,
          });
        } else {
          await saas().from('crm_pipeline_estagios').update({
            nome: stage.nome,
            cor: stage.cor,
            probabilidade: stage.probabilidade,
            ordem: stage.ordem,
          }).eq('id', stage.id);
        }
      }

      await refetch();
      setHasChanges(false);
      toast({ title: 'Pipeline salvo', description: 'Alterações salvas com sucesso.' });
    } catch (err) {
      toast({ title: 'Erro ao salvar', description: String(err), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const createNewPipeline = async () => {
    try {
      const empresaId = await getSaasEmpresaId();
      const { data, error } = await saas().from('crm_pipelines').insert({
        empresa_id: empresaId,
        nome: `Novo pipeline ${pipelines.length + 1}`,
        tipo: objectType,
        ordem: pipelines.length,
      }).select().single();
      if (error) throw error;
      // Add default stages
      await saas().from('crm_pipeline_estagios').insert([
        { pipeline_id: data.id, nome: 'Novo', cor: '#3B82F6', probabilidade: 0, ordem: 0 },
        { pipeline_id: data.id, nome: 'Em progresso', cor: '#F59E0B', probabilidade: 50, ordem: 1 },
        { pipeline_id: data.id, nome: 'Concluído', cor: '#22C55E', probabilidade: 100, ordem: 2 },
      ]);
      await refetch();
      setSelectedPipelineId(data.id);
      toast({ title: 'Pipeline criado' });
    } catch (err) {
      toast({ title: 'Erro', description: String(err), variant: 'destructive' });
    }
  };

  const deletePipeline = async () => {
    if (!selectedPipeline) return;
    if (pipelines.length <= 1) {
      toast({ title: 'Não é possível excluir', description: 'Deve existir pelo menos 1 pipeline.', variant: 'destructive' });
      return;
    }
    try {
      await saas().from('crm_pipelines').delete().eq('id', selectedPipeline.id);
      setSelectedPipelineId(null);
      await refetch();
      toast({ title: 'Pipeline excluído' });
    } catch (err) {
      toast({ title: 'Erro', description: String(err), variant: 'destructive' });
    }
  };

  const renamePipeline = async () => {
    if (!selectedPipeline) return;
    const newName = prompt('Novo nome do pipeline:', selectedPipeline.nome);
    if (!newName || newName === selectedPipeline.nome) return;
    try {
      await saas().from('crm_pipelines').update({ nome: newName }).eq('id', selectedPipeline.id);
      await refetch();
      toast({ title: 'Pipeline renomeado' });
    } catch (err) {
      toast({ title: 'Erro', description: String(err), variant: 'destructive' });
    }
  };

  const [reorderMode, setReorderMode] = useState(false);
  const [reorderList, setReorderList] = useState<{ id: string; nome: string; ordem: number }[]>([]);
  const [savingReorder, setSavingReorder] = useState(false);

  const startReorder = () => {
    setReorderList(pipelines.map(p => ({ id: p.id, nome: p.nome, ordem: p.ordem })));
    setReorderMode(true);
  };

  const moveReorder = (idx: number, dir: -1 | 1) => {
    const next = idx + dir;
    if (next < 0 || next >= reorderList.length) return;
    setReorderList(prev => {
      const arr = [...prev];
      [arr[idx], arr[next]] = [arr[next], arr[idx]];
      return arr.map((p, i) => ({ ...p, ordem: i }));
    });
  };

  const saveReorder = async () => {
    setSavingReorder(true);
    try {
      for (const p of reorderList) {
        await saas().from('crm_pipelines').update({ ordem: p.ordem }).eq('id', p.id);
      }
      await refetch();
      setReorderMode(false);
      toast({ title: 'Ordem dos pipelines salva' });
    } catch (err) {
      toast({ title: 'Erro', description: String(err), variant: 'destructive' });
    } finally {
      setSavingReorder(false);
    }
  };

  const clonePipeline = async () => {
    if (!selectedPipeline) return;
    try {
      const empresaId = await getSaasEmpresaId();
      const { data, error } = await saas().from('crm_pipelines').insert({
        empresa_id: empresaId,
        nome: `${selectedPipeline.nome} (cópia)`,
        tipo: objectType,
        ordem: pipelines.length,
      }).select().single();
      if (error) throw error;
      // Clone stages
      if (selectedPipeline.estagios && selectedPipeline.estagios.length > 0) {
        const clonedStages = selectedPipeline.estagios.map(s => ({
          pipeline_id: data.id,
          nome: s.nome,
          cor: s.cor,
          probabilidade: s.probabilidade,
          ordem: s.ordem,
        }));
        await saas().from('crm_pipeline_estagios').insert(clonedStages);
      }
      await refetch();
      setSelectedPipelineId(data.id);
      toast({ title: 'Pipeline clonado com sucesso' });
    } catch (err) {
      toast({ title: 'Erro ao clonar', description: String(err), variant: 'destructive' });
    }
  };

  const ObjIcon = OBJECT_TYPES.find(o => o.id === objectType)?.icon || Briefcase;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-card">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold">Pipelines</h1>
        </div>

        {/* Object selector */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Selecione um objeto:</span>
          <Select value={objectType} onValueChange={v => navigate(`/crm/0-6?type=${v}`)}>
            <SelectTrigger className="w-48 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OBJECT_TYPES.map(o => (
                <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-6">

        {/* Pipeline selector + actions */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <DropdownMenu open={pipelineDropdown} onOpenChange={setPipelineDropdown}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 h-9">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: stages[0]?.cor || '#6B7280' }} />
                  {selectedPipeline?.nome || 'Selecionar pipeline'}
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-72">
                <div className="p-2">
                  <Input placeholder="Pesquisar" className="h-7 text-xs mb-2" />
                </div>
                {pipelines.map(p => (
                  <DropdownMenuItem
                    key={p.id}
                    onClick={() => { setSelectedPipelineId(p.id); setPipelineDropdown(false); }}
                    className={cn(p.id === selectedPipeline?.id && 'bg-muted font-medium')}
                  >
                    <span className="w-2.5 h-2.5 rounded-full mr-2 flex-shrink-0" style={{ backgroundColor: p.estagios?.[0]?.cor || '#6B7280' }} />
                    {p.nome}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <span className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: stages[0]?.cor || '#6B7280', opacity: 0.3 }} />
            <button className="text-muted-foreground hover:text-foreground text-sm font-mono">&lt;/&gt;</button>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" className="gap-1.5 h-9" onClick={createNewPipeline}>
              Criar pipeline <Plus className="w-3 h-3" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-1.5">
                  Ações <ChevronDown className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={renamePipeline}>Renomear este pipeline</DropdownMenuItem>
                <DropdownMenuItem onClick={startReorder}>Reordenar pipelines</DropdownMenuItem>
                <DropdownMenuItem>Gerenciar acesso</DropdownMenuItem>
                <DropdownMenuItem onClick={clonePipeline}>Clonar esse pipeline</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={deletePipeline} className="text-destructive">Excluir este pipeline</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Sub-tabs */}
        <div className="flex gap-0 border-b border-border mb-4">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-4 py-2.5 text-sm transition-colors border-b-2 -mb-px',
                activeTab === tab.id
                  ? 'border-foreground text-foreground font-medium'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab: Configurar */}
        {activeTab === 'config' && (
          <div>
            {/* Stages table */}
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="w-8" />
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs w-[280px]">Nome da fase</th>
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs w-[60px]">Cor</th>
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs w-[200px]">Probabilidade</th>
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">Propriedades de fase condicional</th>
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">Regras do pipeline</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {stages.map((stage, idx) => (
                  <tr
                    key={stage.id}
                    draggable
                    onDragStart={() => { dragStageIdx.current = idx; }}
                    onDragOver={(e) => { e.preventDefault(); setDragOverIdx(idx); }}
                    onDragLeave={() => { if (dragOverIdx === idx) setDragOverIdx(null); }}
                    onDrop={(e) => { e.preventDefault(); handleStageDrop(idx); }}
                    onDragEnd={() => { dragStageIdx.current = null; setDragOverIdx(null); }}
                    className={cn('border-b border-border group hover:bg-muted/20', dragOverIdx === idx && 'bg-primary/5 border-primary/30')}
                  >
                    <td className="px-1 py-3">
                      <GripVertical className="w-4 h-4 text-muted-foreground/40 cursor-grab" />
                    </td>
                    <td className="px-3 py-3">
                      <Input
                        value={stage.nome}
                        onChange={e => updateStage(idx, 'nome', e.target.value)}
                        className="h-9 text-sm"
                        placeholder="Nome da fase"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <input
                        type="color"
                        value={stage.cor}
                        onChange={e => updateStage(idx, 'cor', e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer border border-border"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <Select value={String(stage.probabilidade)} onValueChange={v => updateStage(idx, 'probabilidade', Number(v))}>
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PROB_OPTIONS.map(o => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">
                      {stage.probabilidade >= 40 && stage.probabilidade < 100 && 'Múltiplas propriedades'}
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">
                      {stage.probabilidade > 0 && stage.probabilidade < 100 && 'Várias regras'}
                      {stage.probabilidade === 0 && 'Restringir o movimento para retroceder'}
                    </td>
                    <td className="px-3 py-3">
                      <button
                        onClick={() => removeStage(idx)}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <button
              onClick={addStage}
              className="text-sm text-primary hover:underline font-medium mt-3 flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Adicionar fase
            </button>

            {/* Save button */}
            {hasChanges && (
              <div className="mt-6 flex items-center gap-3 p-4 bg-muted/50 rounded-lg border border-border">
                <span className="text-sm text-muted-foreground">Você tem alterações não salvas.</span>
                <Button onClick={saveChanges} disabled={saving} size="sm">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                  Salvar alterações
                </Button>
                <Button variant="ghost" size="sm" onClick={() => {
                  if (selectedPipeline?.estagios) {
                    setStages(selectedPipeline.estagios.map(s => ({
                      id: s.id, nome: s.nome, cor: s.cor, probabilidade: s.probabilidade, ordem: s.ordem,
                    })));
                    setHasChanges(false);
                  }
                }}>
                  Descartar
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Tab: Regras do pipeline */}
        {activeTab === 'rules' && (
          <div>
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mb-6">
              <p className="text-sm text-muted-foreground">
                <strong>Observação:</strong> superadministradores, usuários com permissão para editar configurações de propriedades e automações de pipeline podem ignorar todas as regras, exceto as do processo de aprovação.
              </p>
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">Regras do pipeline</th>
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">Fases</th>
                  <th className="w-24" />
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border">
                  <td className="px-3 py-4">
                    <p className="font-medium text-sm">Limitar a criação de negócio a um fases específico</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Os usuários somente podem criar um novo negócio na fases selecionada.</p>
                  </td>
                  <td className="px-3 py-4 text-sm text-muted-foreground">{stages[0]?.nome || '—'}</td>
                  <td className="px-3 py-4 text-right">
                    <div className="flex items-center gap-2 justify-end">
                      <div className="w-10 h-5 rounded-full bg-primary/20 flex items-center px-0.5">
                        <div className="w-4 h-4 rounded-full bg-primary ml-auto" />
                      </div>
                      <Settings2 className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <td className="px-3 py-4">
                    <p className="font-medium text-sm">Restringir negócios de ignorar fases</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Os usuários podem mover um negócio somente à fase seguinte à fase atual.</p>
                  </td>
                  <td className="px-3 py-4 text-sm text-muted-foreground">
                    {stages.slice(2, 4).map(s => s.nome).join(', ')}{stages.length > 4 ? `, e mais ${stages.length - 4}` : ''}
                  </td>
                  <td className="px-3 py-4 text-right">
                    <div className="flex items-center gap-2 justify-end">
                      <div className="w-10 h-5 rounded-full bg-primary/20 flex items-center px-0.5">
                        <div className="w-4 h-4 rounded-full bg-primary ml-auto" />
                      </div>
                      <Settings2 className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <td className="px-3 py-4">
                    <p className="font-medium text-sm">Restringir negócios de se moverem regressivamente</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Os usuários podem mover um negócio somente progressivamente em um pipeline.</p>
                  </td>
                  <td className="px-3 py-4 text-sm text-muted-foreground">Todos os Fases</td>
                  <td className="px-3 py-4 text-right">
                    <div className="flex items-center gap-2 justify-end">
                      <div className="w-10 h-5 rounded-full bg-primary/20 flex items-center px-0.5">
                        <div className="w-4 h-4 rounded-full bg-primary ml-auto" />
                      </div>
                      <Settings2 className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <td className="px-3 py-4">
                    <p className="font-medium text-sm">Controle o acesso de edição negócio</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Limite quem pode editar negócios em fases selecionadas.</p>
                  </td>
                  <td className="px-3 py-4 text-sm text-muted-foreground" />
                  <td className="px-3 py-4 text-right">
                    <div className="w-10 h-5 rounded-full bg-muted flex items-center px-0.5">
                      <div className="w-4 h-4 rounded-full bg-muted-foreground/30" />
                    </div>
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <td className="px-3 py-4">
                    <p className="font-medium text-sm">Adicionar processo de aprovação para negócios</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Negócios precisará de aprovação assim que atingir uma fase de aprovação.</p>
                  </td>
                  <td className="px-3 py-4 text-sm text-muted-foreground" />
                  <td className="px-3 py-4 text-right">
                    <div className="w-10 h-5 rounded-full bg-muted flex items-center px-0.5">
                      <div className="w-4 h-4 rounded-full bg-muted-foreground/30" />
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Tab: Automatizar */}
        {activeTab === 'automate' && (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <Settings2 className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm">Automações de pipeline em breve</p>
          </div>
        )}

        {/* Tab: Tags */}
        {activeTab === 'tags' && (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <Settings2 className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm">Configuração de tags em breve</p>
          </div>
        )}
      </div>

      {/* Reorder Pipelines Modal */}
      {reorderMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setReorderMode(false)} />
          <div className="relative w-[440px] bg-card border border-border rounded-xl shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-base font-semibold">Reordenar pipelines</h2>
              <button onClick={() => setReorderMode(false)} className="text-muted-foreground hover:text-foreground">
                <span className="text-lg">&times;</span>
              </button>
            </div>
            <div className="px-6 py-4 space-y-1 max-h-[400px] overflow-y-auto">
              {reorderList.map((p, idx) => (
                <div key={p.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border bg-muted/20 hover:bg-muted/40">
                  <GripVertical className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />
                  <span className="flex-1 text-sm font-medium">{p.nome}</span>
                  <div className="flex items-center gap-1">
                    <button
                      disabled={idx === 0}
                      onClick={() => moveReorder(idx, -1)}
                      className={cn('w-6 h-6 rounded flex items-center justify-center text-xs', idx === 0 ? 'text-muted-foreground/30' : 'text-muted-foreground hover:bg-muted')}
                    >
                      ▲
                    </button>
                    <button
                      disabled={idx === reorderList.length - 1}
                      onClick={() => moveReorder(idx, 1)}
                      className={cn('w-6 h-6 rounded flex items-center justify-center text-xs', idx === reorderList.length - 1 ? 'text-muted-foreground/30' : 'text-muted-foreground hover:bg-muted')}
                    >
                      ▼
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setReorderMode(false)}>Cancelar</Button>
              <Button size="sm" onClick={saveReorder} disabled={savingReorder}>
                {savingReorder ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                Salvar ordem
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
