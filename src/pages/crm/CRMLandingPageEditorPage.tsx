import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { DndContext, DragEndEvent, DragStartEvent, DragOverlay } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { ArrowLeft, Save, Globe, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { LPEditorSidebar } from '@/components/lp-editor/LPEditorSidebar';
import LPEditorCanvas from '@/components/lp-editor/LPEditorCanvas';
import { LPEditorProperties } from '@/components/lp-editor/LPEditorProperties';
import { DEFAULT_BLOCK_PROPS, BLOCK_CATALOG } from '@/components/lp-editor/lp-editor-types';
import type { LPBlock, LPBlockType } from '@/components/lp-editor/lp-editor-types';
import { useOrgNavigate } from '@/hooks/useOrgNavigate';
import { supabase } from '@/integrations/supabase/client';
import { getOrgAndEmpresaId } from '@/lib/saas';
import { useToast } from '@/hooks/use-toast';

const crm = () => (supabase as any).schema('crm');

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  rascunho: { label: 'Rascunho', color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30' },
  publicada: { label: 'Publicada', color: 'bg-green-500/10 text-green-600 border-green-500/30' },
  arquivada: { label: 'Arquivada', color: 'bg-gray-500/10 text-gray-600 border-gray-500/30' },
};

export default function CRMLandingPageEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useOrgNavigate();
  const { toast } = useToast();

  const isNew = id === 'new';

  const [blocks, setBlocks] = useState<LPBlock[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [lpName, setLpName] = useState('');
  const [lpSlug, setLpSlug] = useState('');
  const [lpStatus, setLpStatus] = useState('rascunho');
  const [forms, setForms] = useState<{ id: string; nome: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeDragLabel, setActiveDragLabel] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function loadData() {
    setLoading(true);
    try {
      const { empresaId } = await getOrgAndEmpresaId();

      // Load forms list
      const { data: formRows } = await crm()
        .from('formularios')
        .select('id, nome')
        .eq('empresa_id', empresaId)
        .eq('ativo', true);
      setForms(formRows || []);

      // Load LP if editing
      if (!isNew && id) {
        const { data: lp, error } = await crm()
          .from('landing_pages')
          .select('*')
          .eq('id', id)
          .single();

        if (error || !lp) {
          toast({ title: 'LP nao encontrada', variant: 'destructive' });
          navigate('/crm/landing-pages');
          return;
        }

        setLpName(lp.nome || '');
        setLpSlug(lp.slug || '');
        setLpStatus(lp.status || 'rascunho');

        // Load blocks from config — with backward compatibility
        const config = lp.config || {};
        if (config.blocks && Array.isArray(config.blocks)) {
          setBlocks(config.blocks);
        } else {
          // Legacy LP: auto-create blocks from old config fields
          const legacyBlocks: LPBlock[] = [];
          if (config.headline) {
            legacyBlocks.push({
              id: crypto.randomUUID(),
              type: 'hero',
              props: {
                headline: config.headline,
                subheadline: config.subheadline || '',
                bgColor: config.bgColor || '#0f172a',
                textColor: '#ffffff',
                alignment: 'center',
              },
            });
          }
          if (config.ctaText) {
            legacyBlocks.push({
              id: crypto.randomUUID(),
              type: 'button',
              props: {
                text: config.ctaText,
                url: '#',
                color: config.accentColor || '#6366f1',
                variant: 'filled',
                alignment: 'center',
              },
            });
          }
          setBlocks(legacyBlocks);
        }
      }
    } catch (e: any) {
      console.error('LP Editor loadData error:', e);
      toast({ title: 'Erro ao carregar dados', description: e?.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  // --- Block handlers ---

  function handleAddBlock(type: LPBlockType) {
    const newBlock: LPBlock = {
      id: crypto.randomUUID(),
      type,
      props: { ...DEFAULT_BLOCK_PROPS[type] },
    };
    setBlocks((prev) => [...prev, newBlock]);
    setSelectedBlockId(newBlock.id);
  }

  function handleUpdateBlock(blockId: string, partialProps: Partial<any>) {
    setBlocks((prev) =>
      prev.map((b) =>
        b.id === blockId ? { ...b, props: { ...b.props, ...partialProps } } : b,
      ),
    );
  }

  function handleDeleteBlock(blockId: string) {
    setBlocks((prev) => prev.filter((b) => b.id !== blockId));
    if (selectedBlockId === blockId) setSelectedBlockId(null);
  }

  function handleReorderBlocks(newBlocks: LPBlock[]) {
    setBlocks(newBlocks);
  }

  // --- DnD ---

  function handleDragStart(event: DragStartEvent) {
    const fromCatalog = event.active.data.current?.fromCatalog;
    if (fromCatalog) {
      const type = event.active.data.current?.type as LPBlockType;
      const catalogItem = BLOCK_CATALOG.find((c) => c.type === type);
      setActiveDragLabel(catalogItem?.label || type);
    } else {
      const block = blocks.find((b) => b.id === event.active.id);
      setActiveDragLabel(block ? block.type : null);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragLabel(null);
    const { active, over } = event;
    if (!over) return;

    const fromCatalog = active.data.current?.fromCatalog === true;

    if (fromCatalog) {
      // New block from sidebar catalog
      const type = active.data.current?.type as LPBlockType;
      if (type) {
        const newBlock: LPBlock = {
          id: crypto.randomUUID(),
          type,
          props: { ...DEFAULT_BLOCK_PROPS[type] },
        };
        setBlocks((prev) => [...prev, newBlock]);
        setSelectedBlockId(newBlock.id);
      }
    } else {
      // Reorder within canvas
      const oldIndex = blocks.findIndex((b) => b.id === active.id);
      const newIndex = blocks.findIndex((b) => b.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        setBlocks((prev) => arrayMove(prev, oldIndex, newIndex));
      }
    }
  }

  // --- Save & Publish ---

  async function handleSave() {
    if (saving || !lpName.trim() || !lpSlug.trim()) {
      if (!lpName.trim()) toast({ title: 'Nome obrigatorio', variant: 'destructive' });
      if (!lpSlug.trim()) toast({ title: 'Slug obrigatorio', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const { org, empresaId } = await getOrgAndEmpresaId();
      const slug = lpSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');

      // Build config with backward-compatible legacy fields
      const heroBlock = blocks.find((b) => b.type === 'hero');
      const buttonBlock = blocks.find((b) => b.type === 'button');
      const config = {
        blocks,
        // Legacy fields for backward compat with PublicLandingPage
        headline: (heroBlock?.props as any)?.headline || lpName,
        subheadline: (heroBlock?.props as any)?.subheadline || '',
        bgColor: (heroBlock?.props as any)?.bgColor || '#0f172a',
        accentColor: (buttonBlock?.props as any)?.color || '#6366f1',
        ctaText: (buttonBlock?.props as any)?.text || 'Saiba mais',
      };

      if (isNew) {
        const { data, error } = await crm()
          .from('landing_pages')
          .insert({ empresa_id: empresaId, org, nome: lpName.trim(), slug, config })
          .select('id')
          .single();
        if (error) throw error;
        toast({ title: 'LP criada com sucesso' });
        // Navigate to editor with real id
        navigate(`/crm/landing-pages/editor/${data.id}`, { replace: true });
      } else {
        const { error } = await crm()
          .from('landing_pages')
          .update({
            nome: lpName.trim(),
            slug,
            config,
            atualizado_em: new Date().toISOString(),
          })
          .eq('id', id);
        if (error) throw error;
        toast({ title: 'LP salva com sucesso' });
      }
    } catch (e: any) {
      const msg = e?.message?.includes('idx_crm_lp_slug')
        ? 'Slug ja existe'
        : e?.message || 'Erro ao salvar';
      toast({ title: 'Erro', description: msg, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (isNew) {
      toast({ title: 'Salve a LP antes de publicar', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const newStatus = lpStatus === 'publicada' ? 'rascunho' : 'publicada';
      const { error } = await crm()
        .from('landing_pages')
        .update({ status: newStatus, atualizado_em: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      setLpStatus(newStatus);
      toast({ title: newStatus === 'publicada' ? 'LP publicada!' : 'LP despublicada' });
    } catch (e: any) {
      toast({ title: 'Erro', description: e?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  // --- Render ---

  const selectedBlock = blocks.find((b) => b.id === selectedBlockId) || null;
  const statusCfg = STATUS_CONFIG[lpStatus] || STATUS_CONFIG.rascunho;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Toolbar */}
      <div className="h-14 border-b bg-card flex items-center gap-3 px-4 shrink-0">
        {/* Left: Back */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/crm/landing-pages')}
          className="gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Button>

        <div className="h-6 w-px bg-border" />

        {/* Center: Name + Slug */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Input
            value={lpName}
            onChange={(e) => {
              setLpName(e.target.value);
              if (isNew) {
                setLpSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-'));
              }
            }}
            placeholder="Nome da LP"
            className="h-8 w-56 text-sm"
          />
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground whitespace-nowrap">/lp/</span>
            <Input
              value={lpSlug}
              onChange={(e) => setLpSlug(e.target.value)}
              placeholder="slug"
              className="h-8 w-40 text-xs"
            />
          </div>
        </div>

        {/* Right: Status + Save + Publish */}
        <Badge variant="outline" className={`text-[10px] ${statusCfg.color}`}>
          {statusCfg.label}
        </Badge>

        <Button
          size="sm"
          variant="outline"
          onClick={handleSave}
          disabled={saving}
          className="gap-1.5"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar
        </Button>

        <Button
          size="sm"
          onClick={handlePublish}
          disabled={saving || isNew}
          className="gap-1.5"
        >
          <Globe className="w-4 h-4" />
          {lpStatus === 'publicada' ? 'Despublicar' : 'Publicar'}
        </Button>
      </div>

      {/* Editor body */}
      <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex flex-1 overflow-hidden">
          <LPEditorSidebar onAddBlock={handleAddBlock} />

          <LPEditorCanvas
            blocks={blocks}
            selectedBlockId={selectedBlockId}
            onSelectBlock={setSelectedBlockId}
            onReorderBlocks={handleReorderBlocks}
          />

          <LPEditorProperties
            block={selectedBlock}
            forms={forms}
            onUpdate={handleUpdateBlock}
            onDelete={handleDeleteBlock}
          />
        </div>

        <DragOverlay dropAnimation={null}>
          {activeDragLabel ? (
            <div className="px-4 py-2 rounded-lg bg-primary text-primary-foreground shadow-xl text-sm font-medium pointer-events-none">
              {activeDragLabel}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
