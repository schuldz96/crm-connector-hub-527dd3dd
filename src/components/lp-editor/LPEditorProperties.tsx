import { useState } from 'react';
import { Trash2, ChevronDown, ChevronRight, ArrowUp, ArrowDown, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type {
  LPBlock, LPBlockType, BlockStyles, HeroBlockProps, TextBlockProps, ImageBlockProps,
  ButtonBlockProps, FormBlockProps, SpacerBlockProps, ColumnsBlockProps, SectionBlockProps,
  VideoBlockProps, CountdownBlockProps, DividerBlockProps, ColumnContent, ColumnLayout,
  ColumnItem, ColumnItemType,
} from '@/components/lp-editor/lp-editor-types';
import { getColumnsFromLayout, DEFAULT_COLUMN_ITEM } from '@/components/lp-editor/lp-editor-types';

/* ── Props ── */

interface LPEditorPropertiesProps {
  block: LPBlock | null;
  selectedColumnIndex?: number | null;
  forms: { id: string; nome: string }[];
  onUpdate: (blockId: string, props: Partial<any>) => void;
  onUpdateStyles: (blockId: string, styles: Partial<BlockStyles>) => void;
  onDelete: (blockId: string) => void;
}

/* ── Block type labels ── */

const BLOCK_TYPE_LABELS: Record<LPBlockType, string> = {
  hero: 'Hero / Banner', section: 'Seção', columns: 'Colunas',
  text: 'Texto', image: 'Imagem', button: 'Botão',
  form: 'Formulário', spacer: 'Espaçador',
  video: 'Vídeo', countdown: 'Countdown', divider: 'Divisor',
};

/* ══════════════════════════════════════════════════════════════
   Reusable field helpers
   ══════════════════════════════════════════════════════════════ */

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-2">
        <input type="color" value={value || '#000000'} onChange={(e) => onChange(e.target.value)} className="w-8 h-8 rounded border cursor-pointer" />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="flex-1 h-8 text-xs" />
      </div>
    </div>
  );
}

function AlignmentSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">Alinhamento</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="left">Esquerda</SelectItem>
          <SelectItem value="center">Centro</SelectItem>
          <SelectItem value="right">Direita</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function RangeField({ label, value, min, max, step, unit, onChange }: { label: string; value: number; min: number; max: number; step: number; unit?: string; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-3">
        <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="flex-1" />
        <span className="text-xs text-muted-foreground w-14 text-right">{value}{unit || 'px'}</span>
      </div>
    </div>
  );
}

function TextField({ label, value, onChange, placeholder, multiline }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {multiline ? (
        <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2} className="text-xs" placeholder={placeholder} />
      ) : (
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-8 text-xs" placeholder={placeholder} />
      )}
    </div>
  );
}

function Divider({ label }: { label: string }) {
  return <div className="pt-2 border-t"><Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</Label></div>;
}

function CheckboxField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="rounded" />
      <span className="text-xs">{label}</span>
    </label>
  );
}

/* ══════════════════════════════════════════════════════════════
   Accordion Section (collapsible)
   ══════════════════════════════════════════════════════════════ */

function AccordionSection({ label, expanded, onToggle, children }: { label: string; expanded: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="border-b last:border-b-0">
      <button type="button" onClick={onToggle} className="flex items-center gap-1.5 w-full py-2 text-xs font-medium text-left hover:text-primary transition-colors">
        {expanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
        {label}
      </button>
      {expanded && <div className="pb-3 space-y-3">{children}</div>}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Configurações Tab — Block-specific property editors
   ══════════════════════════════════════════════════════════════ */

/* ── Hero Properties ── */
function HeroProperties({ block, onUpdate }: { block: LPBlock; onUpdate: LPEditorPropertiesProps['onUpdate'] }) {
  const p = block.props as HeroBlockProps;
  const u = (k: string, v: any) => onUpdate(block.id, { [k]: v });
  return (
    <div className="space-y-3">
      <TextField label="Titulo" value={p.headline} onChange={(v) => u('headline', v)} />
      <TextField label="Subtitulo" value={p.subheadline} onChange={(v) => u('subheadline', v)} multiline />
      <AlignmentSelect value={p.alignment} onChange={(v) => u('alignment', v)} />
      <div className="space-y-1.5">
        <Label className="text-xs">Altura</Label>
        <Select value={p.height || 'medium'} onValueChange={(v) => u('height', v)}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="small">Pequena</SelectItem>
            <SelectItem value="medium">Media</SelectItem>
            <SelectItem value="large">Grande</SelectItem>
            <SelectItem value="fullscreen">Tela inteira</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Divider label="Fundo" />
      <ColorField label="Cor de fundo" value={p.bgColor} onChange={(v) => u('bgColor', v)} />
      <TextField label="Imagem de fundo (URL)" value={p.bgImage || ''} onChange={(v) => u('bgImage', v)} placeholder="https://images.unsplash.com/..." />
      {p.bgImage && <RangeField label="Opacidade do overlay" value={p.bgOverlay ?? 50} min={0} max={100} step={5} unit="%" onChange={(v) => u('bgOverlay', v)} />}
      <Divider label="Texto" />
      <ColorField label="Cor do texto" value={p.textColor} onChange={(v) => u('textColor', v)} />
    </div>
  );
}

/* ── Section Properties ── */
function SectionProperties({ block, onUpdate }: { block: LPBlock; onUpdate: LPEditorPropertiesProps['onUpdate'] }) {
  const p = block.props as SectionBlockProps;
  const u = (k: string, v: any) => onUpdate(block.id, { [k]: v });
  return (
    <div className="space-y-3">
      <TextField label="Titulo" value={p.title} onChange={(v) => u('title', v)} />
      <TextField label="Subtitulo" value={p.subtitle} onChange={(v) => u('subtitle', v)} multiline />
      <AlignmentSelect value={p.alignment} onChange={(v) => u('alignment', v)} />
      <div className="space-y-1.5">
        <Label className="text-xs">Largura maxima</Label>
        <Select value={p.maxWidth || 'lg'} onValueChange={(v) => u('maxWidth', v)}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="sm">Estreita</SelectItem>
            <SelectItem value="md">Media</SelectItem>
            <SelectItem value="lg">Larga</SelectItem>
            <SelectItem value="xl">Extra larga</SelectItem>
            <SelectItem value="full">Largura total</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Divider label="Fundo" />
      <ColorField label="Cor de fundo" value={p.bgColor} onChange={(v) => u('bgColor', v)} />
      <TextField label="Imagem de fundo (URL)" value={p.bgImage || ''} onChange={(v) => u('bgImage', v)} placeholder="https://..." />
      {p.bgImage && <RangeField label="Opacidade do overlay" value={p.bgOverlay ?? 0} min={0} max={100} step={5} unit="%" onChange={(v) => u('bgOverlay', v)} />}
      <ColorField label="Cor do texto" value={p.textColor} onChange={(v) => u('textColor', v)} />
      <Divider label="Espacamento" />
      <RangeField label="Padding vertical" value={p.paddingY ?? 64} min={0} max={200} step={8} onChange={(v) => u('paddingY', v)} />
      <RangeField label="Padding horizontal" value={p.paddingX ?? 24} min={0} max={100} step={8} onChange={(v) => u('paddingX', v)} />
    </div>
  );
}

/* ── Column Item type labels ── */
const ITEM_TYPE_LABELS: Record<ColumnItemType, string> = {
  icon: '😀 Icone', heading: 'H Titulo', text: '¶ Texto', image: '🖼 Imagem',
  button: '▶ Botao', video: '🎬 Video', audio: '🔊 Audio', spacer: '↕ Espaco', list: '• Lista',
};

/* ── Column Item edit form ── */
function ColumnItemEditForm({ item, onChange }: { item: ColumnItem; onChange: (field: keyof ColumnItem, value: any) => void }) {
  switch (item.type) {
    case 'icon':
      return (
        <div className="space-y-2">
          <TextField label="Emoji" value={item.content} onChange={(v) => onChange('content', v)} placeholder="⭐" />
          <div className="space-y-1.5">
            <Label className="text-xs">Tamanho</Label>
            <Select value={item.size} onValueChange={(v) => onChange('size', v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sm">Pequeno</SelectItem>
                <SelectItem value="md">Medio</SelectItem>
                <SelectItem value="lg">Grande</SelectItem>
                <SelectItem value="xl">Extra grande</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      );
    case 'heading':
      return (
        <div className="space-y-2">
          <TextField label="Texto" value={item.content} onChange={(v) => onChange('content', v)} />
          <div className="space-y-1.5">
            <Label className="text-xs">Tamanho</Label>
            <Select value={item.size} onValueChange={(v) => onChange('size', v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sm">Pequeno</SelectItem>
                <SelectItem value="md">Medio</SelectItem>
                <SelectItem value="lg">Grande</SelectItem>
                <SelectItem value="xl">Extra grande</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <CheckboxField label="Negrito" checked={item.bold} onChange={(v) => onChange('bold', v)} />
          <CheckboxField label="Italico" checked={item.italic} onChange={(v) => onChange('italic', v)} />
          <AlignmentSelect value={item.alignment} onChange={(v) => onChange('alignment', v)} />
          <ColorField label="Cor" value={item.color} onChange={(v) => onChange('color', v)} />
        </div>
      );
    case 'text':
      return (
        <div className="space-y-2">
          <TextField label="Conteudo" value={item.content} onChange={(v) => onChange('content', v)} multiline />
          <div className="space-y-1.5">
            <Label className="text-xs">Tamanho</Label>
            <Select value={item.size} onValueChange={(v) => onChange('size', v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sm">Pequeno</SelectItem>
                <SelectItem value="md">Medio</SelectItem>
                <SelectItem value="lg">Grande</SelectItem>
                <SelectItem value="xl">Extra grande</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <CheckboxField label="Negrito" checked={item.bold} onChange={(v) => onChange('bold', v)} />
          <CheckboxField label="Italico" checked={item.italic} onChange={(v) => onChange('italic', v)} />
          <AlignmentSelect value={item.alignment} onChange={(v) => onChange('alignment', v)} />
          <ColorField label="Cor" value={item.color} onChange={(v) => onChange('color', v)} />
        </div>
      );
    case 'image':
      return (
        <div className="space-y-2">
          <TextField label="URL da imagem" value={item.url} onChange={(v) => onChange('url', v)} placeholder="https://..." />
        </div>
      );
    case 'button':
      return (
        <div className="space-y-2">
          <TextField label="Texto do botao" value={item.content} onChange={(v) => onChange('content', v)} placeholder="Saiba mais" />
          <TextField label="URL do link" value={item.url} onChange={(v) => onChange('url', v)} placeholder="https://..." />
          <ColorField label="Cor do botao" value={item.color} onChange={(v) => onChange('color', v)} />
          <div className="space-y-1.5">
            <Label className="text-xs">Tamanho</Label>
            <Select value={item.size} onValueChange={(v) => onChange('size', v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sm">Pequeno</SelectItem>
                <SelectItem value="md">Medio</SelectItem>
                <SelectItem value="lg">Grande</SelectItem>
                <SelectItem value="xl">Extra grande</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <AlignmentSelect value={item.alignment} onChange={(v) => onChange('alignment', v)} />
        </div>
      );
    case 'video':
      return (
        <div className="space-y-2">
          <TextField label="URL do video" value={item.url} onChange={(v) => onChange('url', v)} placeholder="https://youtube.com/watch?v=..." />
        </div>
      );
    case 'audio':
      return (
        <div className="space-y-2">
          <TextField label="URL do audio" value={item.url} onChange={(v) => onChange('url', v)} placeholder="https://..." />
        </div>
      );
    case 'spacer':
      return (
        <div className="space-y-2">
          <TextField label="Altura (px)" value={item.content} onChange={(v) => onChange('content', v)} placeholder="16" />
        </div>
      );
    case 'list':
      return (
        <div className="space-y-2">
          <TextField label="Itens (um por linha)" value={item.content} onChange={(v) => onChange('content', v)} multiline />
        </div>
      );
    default:
      return null;
  }
}

/* ── Columns Properties ── */
function ColumnsProperties({ block, onUpdate }: { block: LPBlock; onUpdate: LPEditorPropertiesProps['onUpdate'] }) {
  const p = block.props as ColumnsBlockProps;
  const u = (k: string, v: any) => onUpdate(block.id, { [k]: v });
  const [expandedCols, setExpandedCols] = useState<Record<number, boolean>>({});
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [showAddMenu, setShowAddMenu] = useState<Record<number, boolean>>({});

  const changeLayout = (layout: ColumnLayout) => {
    const newCount = getColumnsFromLayout(layout);
    const defaultCol: ColumnContent = { items: [], verticalAlign: 'top', bgColor: '', padding: 20 };
    const cols = Array.from({ length: newCount }, (_, i) => p.columns?.[i] || defaultCol);
    onUpdate(block.id, { layout, columns: cols });
  };

  const updateColumnProp = (colIdx: number, field: keyof ColumnContent, value: any) => {
    const cols = [...(p.columns || [])];
    const defaultCol: ColumnContent = { items: [], verticalAlign: 'top', bgColor: '', padding: 20 };
    cols[colIdx] = { ...(cols[colIdx] || defaultCol), [field]: value };
    u('columns', cols);
  };

  const addItem = (colIdx: number, type: ColumnItemType) => {
    const cols = [...(p.columns || [])];
    const defaultCol: ColumnContent = { items: [], verticalAlign: 'top', bgColor: '', padding: 20 };
    const newItem: ColumnItem = { id: crypto.randomUUID(), type, ...DEFAULT_COLUMN_ITEM };
    if (type === 'icon') newItem.content = '⭐';
    if (type === 'heading') { newItem.content = 'Titulo'; newItem.bold = true; }
    if (type === 'text') newItem.content = 'Texto aqui...';
    if (type === 'button') { newItem.content = 'Saiba mais'; newItem.color = '#6366f1'; }
    if (type === 'spacer') newItem.content = '16';
    cols[colIdx] = { ...(cols[colIdx] || defaultCol), items: [...((cols[colIdx] || defaultCol).items || []), newItem] };
    u('columns', cols);
    setShowAddMenu((prev) => ({ ...prev, [colIdx]: false }));
  };

  const deleteItem = (colIdx: number, itemId: string) => {
    const cols = [...(p.columns || [])];
    if (!cols[colIdx]) return;
    cols[colIdx] = { ...cols[colIdx], items: cols[colIdx].items.filter((it) => it.id !== itemId) };
    u('columns', cols);
  };

  const moveItem = (colIdx: number, itemIdx: number, direction: -1 | 1) => {
    const cols = [...(p.columns || [])];
    if (!cols[colIdx]) return;
    const items = [...cols[colIdx].items];
    const newIdx = itemIdx + direction;
    if (newIdx < 0 || newIdx >= items.length) return;
    [items[itemIdx], items[newIdx]] = [items[newIdx], items[itemIdx]];
    cols[colIdx] = { ...cols[colIdx], items };
    u('columns', cols);
  };

  const updateItem = (colIdx: number, itemId: string, field: keyof ColumnItem, value: any) => {
    const cols = [...(p.columns || [])];
    if (!cols[colIdx]) return;
    cols[colIdx] = {
      ...cols[colIdx],
      items: cols[colIdx].items.map((it) => it.id === itemId ? { ...it, [field]: value } : it),
    };
    u('columns', cols);
  };

  const currentLayout = p.layout || '33-33-33';
  const colCount = getColumnsFromLayout(currentLayout);

  return (
    <div className="space-y-3">
      {/* Layout */}
      <div className="space-y-1.5">
        <Label className="text-xs">Layout das colunas</Label>
        <Select value={currentLayout} onValueChange={(v) => changeLayout(v as ColumnLayout)}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="100">1 coluna (100%)</SelectItem>
            <SelectItem value="50-50">2 colunas (50/50)</SelectItem>
            <SelectItem value="33-66">2 colunas (33/66)</SelectItem>
            <SelectItem value="66-33">2 colunas (66/33)</SelectItem>
            <SelectItem value="33-33-33">3 colunas (33/33/33)</SelectItem>
            <SelectItem value="25-50-25">3 colunas (25/50/25)</SelectItem>
            <SelectItem value="25-25-25-25">4 colunas (25/25/25/25)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <RangeField label="Espacamento" value={p.gap ?? 24} min={0} max={48} step={4} onChange={(v) => u('gap', v)} />
      <RangeField label="Padding" value={p.padding ?? 48} min={0} max={100} step={8} onChange={(v) => u('padding', v)} />

      <Divider label="Fundo" />
      <ColorField label="Cor de fundo" value={p.bgColor || '#ffffff'} onChange={(v) => u('bgColor', v)} />
      <TextField label="Imagem de fundo (URL)" value={p.bgImage || ''} onChange={(v) => u('bgImage', v)} placeholder="https://..." />
      {p.bgImage && <RangeField label="Opacidade do overlay" value={p.bgOverlay ?? 0} min={0} max={100} step={5} unit="%" onChange={(v) => u('bgOverlay', v)} />}
      <ColorField label="Cor do texto" value={p.textColor || '#0f172a'} onChange={(v) => u('textColor', v)} />

      {/* Per-column settings */}
      {Array.from({ length: colCount }, (_, colIdx) => {
        const col: ColumnContent = p.columns?.[colIdx] || { items: [], verticalAlign: 'top', bgColor: '', padding: 20 };
        const isExpanded = expandedCols[colIdx] ?? true;
        const hasItems = col.items && col.items.length > 0;
        const isLegacy = p.columns?.[colIdx] && !('items' in (p.columns[colIdx] as any));

        return (
          <div key={colIdx} className="border rounded-lg overflow-hidden">
            {/* Column header */}
            <button
              type="button"
              onClick={() => setExpandedCols((prev) => ({ ...prev, [colIdx]: !isExpanded }))}
              className="flex items-center gap-1.5 w-full px-3 py-2 text-xs font-medium text-left bg-muted/50 hover:bg-muted transition-colors"
            >
              {isExpanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
              Coluna {colIdx + 1}
              <span className="ml-auto text-[10px] text-muted-foreground">{(col.items || []).length} itens</span>
            </button>

            {isExpanded && (
              <div className="p-3 space-y-3">
                {/* Column-level settings */}
                <ColorField label="Cor de fundo da coluna" value={col.bgColor || ''} onChange={(v) => updateColumnProp(colIdx, 'bgColor', v)} />
                <RangeField label="Padding interno" value={col.padding ?? 20} min={0} max={60} step={4} onChange={(v) => updateColumnProp(colIdx, 'padding', v)} />
                <div className="space-y-1.5">
                  <Label className="text-xs">Alinhamento vertical</Label>
                  <Select value={col.verticalAlign || 'top'} onValueChange={(v) => updateColumnProp(colIdx, 'verticalAlign', v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="top">Topo</SelectItem>
                      <SelectItem value="center">Centro</SelectItem>
                      <SelectItem value="bottom">Base</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Legacy data notice */}
                {isLegacy && (
                  <div className="rounded-md bg-amber-50 border border-amber-200 p-2 text-[10px] text-amber-700">
                    Dados antigos detectados. Adicione elementos abaixo para usar o novo sistema de sub-blocos.
                  </div>
                )}

                {/* Items list */}
                <Divider label="Elementos" />
                {hasItems && col.items.map((item, itemIdx) => {
                  const itemExpanded = expandedItems[item.id] ?? false;
                  return (
                    <div key={item.id} className="border rounded-md overflow-hidden bg-background">
                      {/* Item header */}
                      <div className="flex items-center gap-1 px-2 py-1.5 bg-muted/30">
                        <button
                          type="button"
                          onClick={() => setExpandedItems((prev) => ({ ...prev, [item.id]: !itemExpanded }))}
                          className="flex items-center gap-1 flex-1 text-left text-[11px] font-medium hover:text-primary transition-colors"
                        >
                          {itemExpanded ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
                          <span className="truncate">{ITEM_TYPE_LABELS[item.type]}: {item.content ? item.content.slice(0, 20) : item.url ? item.url.slice(0, 20) : '...'}</span>
                        </button>
                        <button type="button" onClick={() => moveItem(colIdx, itemIdx, -1)} disabled={itemIdx === 0} className="p-0.5 rounded hover:bg-accent disabled:opacity-30" title="Mover para cima">
                          <ArrowUp className="h-3 w-3" />
                        </button>
                        <button type="button" onClick={() => moveItem(colIdx, itemIdx, 1)} disabled={itemIdx === col.items.length - 1} className="p-0.5 rounded hover:bg-accent disabled:opacity-30" title="Mover para baixo">
                          <ArrowDown className="h-3 w-3" />
                        </button>
                        <button type="button" onClick={() => deleteItem(colIdx, item.id)} className="p-0.5 rounded hover:bg-destructive/10 text-destructive" title="Remover">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                      {/* Item edit form */}
                      {itemExpanded && (
                        <div className="p-2 border-t">
                          <ColumnItemEditForm
                            item={item}
                            onChange={(field, value) => updateItem(colIdx, item.id, field, value)}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Add element */}
                {showAddMenu[colIdx] ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] text-muted-foreground">Selecione o tipo</Label>
                      <button type="button" onClick={() => setShowAddMenu((prev) => ({ ...prev, [colIdx]: false }))} className="text-muted-foreground hover:text-foreground">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      {(['icon', 'heading', 'text', 'image', 'button', 'video', 'audio', 'spacer', 'list'] as ColumnItemType[]).map((t) => (
                        <button key={t} onClick={() => addItem(colIdx, t)} className="text-[10px] p-1.5 rounded border hover:bg-accent text-center">
                          {ITEM_TYPE_LABELS[t]}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" className="w-full text-xs h-7" onClick={() => setShowAddMenu((prev) => ({ ...prev, [colIdx]: true }))}>
                    + Adicionar elemento
                  </Button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Text Properties ── */
function TextProperties({ block, onUpdate }: { block: LPBlock; onUpdate: LPEditorPropertiesProps['onUpdate'] }) {
  const p = block.props as TextBlockProps;
  const u = (k: string, v: any) => onUpdate(block.id, { [k]: v });
  return (
    <div className="space-y-3">
      <TextField label="Conteudo" value={p.content} onChange={(v) => u('content', v)} multiline />
      <div className="space-y-1.5">
        <Label className="text-xs">Tamanho da fonte</Label>
        <Select value={p.fontSize} onValueChange={(v) => u('fontSize', v)}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="sm">Pequeno</SelectItem>
            <SelectItem value="base">Normal</SelectItem>
            <SelectItem value="lg">Grande</SelectItem>
            <SelectItem value="xl">Extra grande</SelectItem>
            <SelectItem value="2xl">Enorme</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <AlignmentSelect value={p.alignment} onChange={(v) => u('alignment', v)} />
    </div>
  );
}

/* ── Image Properties ── */
function ImageProperties({ block, onUpdate }: { block: LPBlock; onUpdate: LPEditorPropertiesProps['onUpdate'] }) {
  const p = block.props as ImageBlockProps;
  const u = (k: string, v: any) => onUpdate(block.id, { [k]: v });
  return (
    <div className="space-y-3">
      <TextField label="URL da imagem" value={p.src} onChange={(v) => u('src', v)} placeholder="https://..." />
      <TextField label="Texto alternativo" value={p.alt} onChange={(v) => u('alt', v)} />
      <div className="space-y-1.5">
        <Label className="text-xs">Largura</Label>
        <Select value={p.width} onValueChange={(v) => u('width', v)}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="small">Pequena</SelectItem>
            <SelectItem value="medium">Media</SelectItem>
            <SelectItem value="full">Largura total</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <RangeField label="Borda arredondada" value={p.borderRadius ?? 8} min={0} max={32} step={2} onChange={(v) => u('borderRadius', v)} />
      <AlignmentSelect value={p.alignment} onChange={(v) => u('alignment', v)} />
    </div>
  );
}

/* ── Button Properties ── */
function ButtonProperties({ block, onUpdate }: { block: LPBlock; onUpdate: LPEditorPropertiesProps['onUpdate'] }) {
  const p = block.props as ButtonBlockProps;
  const u = (k: string, v: any) => onUpdate(block.id, { [k]: v });
  return (
    <div className="space-y-3">
      <TextField label="Texto" value={p.text} onChange={(v) => u('text', v)} />
      <TextField label="URL do link" value={p.url} onChange={(v) => u('url', v)} placeholder="https://..." />
      <ColorField label="Cor" value={p.color} onChange={(v) => u('color', v)} />
      <div className="space-y-1.5">
        <Label className="text-xs">Estilo</Label>
        <Select value={p.variant} onValueChange={(v) => u('variant', v)}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="filled">Preenchido</SelectItem>
            <SelectItem value="outline">Contorno</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Tamanho</Label>
        <Select value={p.size || 'md'} onValueChange={(v) => u('size', v)}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="sm">Pequeno</SelectItem>
            <SelectItem value="md">Medio</SelectItem>
            <SelectItem value="lg">Grande</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <AlignmentSelect value={p.alignment} onChange={(v) => u('alignment', v)} />
    </div>
  );
}

/* ── Form Properties ── */
function FormProperties({ block, forms, onUpdate }: { block: LPBlock; forms: LPEditorPropertiesProps['forms']; onUpdate: LPEditorPropertiesProps['onUpdate'] }) {
  const p = block.props as FormBlockProps;
  const u = (k: string, v: any) => onUpdate(block.id, { [k]: v });
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Formulário vinculado</Label>
        <Select value={p.formId || 'none'} onValueChange={(v) => u('formId', v === 'none' ? '' : v)}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Nenhum</SelectItem>
            {forms.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <Divider label="Personalização" />
      <TextField label="Título" value={p.title || ''} onChange={(v) => u('title', v)} placeholder="Entre em contato" />
      <TextField label="Subtítulo" value={p.subtitle || ''} onChange={(v) => u('subtitle', v)} multiline placeholder="Preencha o formulário..." />
      <TextField label="Texto do botão" value={p.buttonText || ''} onChange={(v) => u('buttonText', v)} placeholder="Enviar" />
      <ColorField label="Cor do botão" value={p.buttonColor || '#6366f1'} onChange={(v) => u('buttonColor', v)} />
      <Divider label="Visual" />
      <ColorField label="Cor de fundo" value={p.bgColor || '#f8fafc'} onChange={(v) => u('bgColor', v)} />
      <ColorField label="Cor do texto" value={p.textColor || '#0f172a'} onChange={(v) => u('textColor', v)} />
      <div className="space-y-1.5">
        <Label className="text-xs">Layout dos campos</Label>
        <Select value={p.layout || 'stacked'} onValueChange={(v) => u('layout', v)}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="stacked">Empilhado (vertical)</SelectItem>
            <SelectItem value="inline">Lado a lado</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

/* ── Spacer Properties ── */
function SpacerProperties({ block, onUpdate }: { block: LPBlock; onUpdate: LPEditorPropertiesProps['onUpdate'] }) {
  const p = block.props as SpacerBlockProps;
  return (
    <div className="space-y-3">
      <RangeField label="Altura" value={p.height} min={8} max={200} step={8} onChange={(v) => onUpdate(block.id, { height: v })} />
    </div>
  );
}

/* ── Video Properties ── */
function VideoProperties({ block, onUpdate }: { block: LPBlock; onUpdate: LPEditorPropertiesProps['onUpdate'] }) {
  const p = block.props as VideoBlockProps;
  const u = (k: string, v: any) => onUpdate(block.id, { [k]: v });
  return (
    <div className="space-y-3">
      <TextField label="URL do video" value={p.url} onChange={(v) => u('url', v)} placeholder="https://youtube.com/watch?v=..." />
      <div className="space-y-1.5">
        <Label className="text-xs">Proporcao</Label>
        <Select value={p.aspectRatio || '16:9'} onValueChange={(v) => u('aspectRatio', v)}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="16:9">16:9 (Widescreen)</SelectItem>
            <SelectItem value="4:3">4:3 (Classico)</SelectItem>
            <SelectItem value="1:1">1:1 (Quadrado)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <CheckboxField label="Autoplay" checked={p.autoplay} onChange={(v) => u('autoplay', v)} />
      <AlignmentSelect value={p.alignment} onChange={(v) => u('alignment', v)} />
    </div>
  );
}

/* ── Countdown Properties ── */
function CountdownProperties({ block, onUpdate }: { block: LPBlock; onUpdate: LPEditorPropertiesProps['onUpdate'] }) {
  const p = block.props as CountdownBlockProps;
  const u = (k: string, v: any) => onUpdate(block.id, { [k]: v });

  // Convert ISO string to datetime-local format
  const toLocalDatetime = (iso: string) => {
    try {
      return new Date(iso).toISOString().slice(0, 16);
    } catch {
      return '';
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Data de termino</Label>
        <Input
          type="datetime-local"
          value={toLocalDatetime(p.endDate)}
          onChange={(e) => u('endDate', new Date(e.target.value).toISOString())}
          className="h-8 text-xs"
        />
      </div>
      <TextField label="Titulo" value={p.title} onChange={(v) => u('title', v)} />
      <ColorField label="Cor de fundo" value={p.bgColor} onChange={(v) => u('bgColor', v)} />
      <ColorField label="Cor do texto" value={p.textColor} onChange={(v) => u('textColor', v)} />
      <Divider label="Exibir" />
      <CheckboxField label="Dias" checked={p.showDays} onChange={(v) => u('showDays', v)} />
      <CheckboxField label="Horas" checked={p.showHours} onChange={(v) => u('showHours', v)} />
      <CheckboxField label="Minutos" checked={p.showMinutes} onChange={(v) => u('showMinutes', v)} />
      <CheckboxField label="Segundos" checked={p.showSeconds} onChange={(v) => u('showSeconds', v)} />
    </div>
  );
}

/* ── Divider Properties ── */
function DividerProperties({ block, onUpdate }: { block: LPBlock; onUpdate: LPEditorPropertiesProps['onUpdate'] }) {
  const p = block.props as DividerBlockProps;
  const u = (k: string, v: any) => onUpdate(block.id, { [k]: v });
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Estilo</Label>
        <Select value={p.style || 'solid'} onValueChange={(v) => u('style', v)}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="solid">Solido</SelectItem>
            <SelectItem value="dashed">Tracejado</SelectItem>
            <SelectItem value="dotted">Pontilhado</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <ColorField label="Cor" value={p.color} onChange={(v) => u('color', v)} />
      <RangeField label="Espessura" value={p.thickness ?? 1} min={1} max={10} step={1} onChange={(v) => u('thickness', v)} />
      <RangeField label="Largura" value={p.width ?? 100} min={10} max={100} step={5} unit="%" onChange={(v) => u('width', v)} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Estilos Tab — Universal BlockStyles editor (accordion)
   ══════════════════════════════════════════════════════════════ */

function StylesEditor({ block, onUpdateStyles }: { block: LPBlock; onUpdateStyles: LPEditorPropertiesProps['onUpdateStyles'] }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ background: true });
  const s = block.styles;
  const u = (partial: Partial<BlockStyles>) => onUpdateStyles(block.id, partial);

  const toggle = (key: string) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="space-y-0">
      {/* 1. Fundo do Elemento */}
      <AccordionSection label="Fundo do Elemento" expanded={!!expanded.background} onToggle={() => toggle('background')}>
        <ColorField label="Cor de fundo" value={s.bgColor} onChange={(v) => u({ bgColor: v })} />
        <TextField label="Imagem de fundo (URL)" value={s.bgImage} onChange={(v) => u({ bgImage: v })} placeholder="https://..." />
        {s.bgImage && (
          <RangeField label="Opacidade do overlay" value={s.bgOverlay} min={0} max={100} step={5} unit="%" onChange={(v) => u({ bgOverlay: v })} />
        )}
      </AccordionSection>

      {/* 2. Bordas */}
      <AccordionSection label="Bordas" expanded={!!expanded.borders} onToggle={() => toggle('borders')}>
        <div className="space-y-1.5">
          <Label className="text-xs">Estilo da borda</Label>
          <Select value={s.borderStyle} onValueChange={(v) => u({ borderStyle: v as BlockStyles['borderStyle'] })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhuma</SelectItem>
              <SelectItem value="solid">Solida</SelectItem>
              <SelectItem value="dashed">Tracejada</SelectItem>
              <SelectItem value="dotted">Pontilhada</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <RangeField label="Espessura" value={s.borderWidth} min={0} max={10} step={1} onChange={(v) => u({ borderWidth: v })} />
        {s.borderStyle !== 'none' && (
          <ColorField label="Cor da borda" value={s.borderColor} onChange={(v) => u({ borderColor: v })} />
        )}
        <RangeField label="Borda arredondada" value={s.borderRadius} min={0} max={32} step={1} onChange={(v) => u({ borderRadius: v })} />
      </AccordionSection>

      {/* 3. Espacos */}
      <AccordionSection label="Espacos" expanded={!!expanded.spacing} onToggle={() => toggle('spacing')}>
        <Divider label="Margem" />
        <RangeField label="Margem superior" value={s.marginTop} min={0} max={100} step={4} onChange={(v) => u({ marginTop: v })} />
        <RangeField label="Margem inferior" value={s.marginBottom} min={0} max={100} step={4} onChange={(v) => u({ marginBottom: v })} />
        <Divider label="Padding" />
        <RangeField label="Padding superior" value={s.paddingTop} min={0} max={100} step={4} onChange={(v) => u({ paddingTop: v })} />
        <RangeField label="Padding direito" value={s.paddingRight} min={0} max={100} step={4} onChange={(v) => u({ paddingRight: v })} />
        <RangeField label="Padding inferior" value={s.paddingBottom} min={0} max={100} step={4} onChange={(v) => u({ paddingBottom: v })} />
        <RangeField label="Padding esquerdo" value={s.paddingLeft} min={0} max={100} step={4} onChange={(v) => u({ paddingLeft: v })} />
      </AccordionSection>

      {/* 4. Sombra */}
      <AccordionSection label="Sombra" expanded={!!expanded.shadow} onToggle={() => toggle('shadow')}>
        <RangeField label="Desfoque" value={s.shadowBlur} min={0} max={50} step={1} onChange={(v) => u({ shadowBlur: v })} />
        <RangeField label="Deslocamento X" value={s.shadowX} min={-20} max={20} step={1} onChange={(v) => u({ shadowX: v })} />
        <RangeField label="Deslocamento Y" value={s.shadowY} min={-20} max={20} step={1} onChange={(v) => u({ shadowY: v })} />
        <ColorField label="Cor da sombra" value={s.shadowColor} onChange={(v) => u({ shadowColor: v })} />
      </AccordionSection>

      {/* 5. Visibilidade */}
      <AccordionSection label="Visibilidade" expanded={!!expanded.visibility} onToggle={() => toggle('visibility')}>
        <CheckboxField label="Ocultar no celular" checked={s.hideOnMobile} onChange={(v) => u({ hideOnMobile: v })} />
        <CheckboxField label="Ocultar no desktop" checked={s.hideOnDesktop} onChange={(v) => u({ hideOnDesktop: v })} />
      </AccordionSection>
    </div>
  );
}

/* ── Single Column Properties (shown when clicking a specific column) ── */
function SingleColumnProperties({ block, columnIndex, onUpdate }: { block: LPBlock; columnIndex: number; onUpdate: LPEditorPropertiesProps['onUpdate'] }) {
  const p = block.props as ColumnsBlockProps;
  const col = p.columns?.[columnIndex];
  if (!col) return <p className="text-xs text-muted-foreground">Coluna não encontrada</p>;

  const updateCol = (field: string, value: any) => {
    const cols = [...(p.columns || [])];
    cols[columnIndex] = { ...cols[columnIndex], [field]: value };
    onUpdate(block.id, { columns: cols });
  };

  const updateItem = (itemId: string, field: string, value: any) => {
    const cols = [...(p.columns || [])];
    const items = [...(cols[columnIndex].items || [])];
    cols[columnIndex] = { ...cols[columnIndex], items: items.map(it => it.id === itemId ? { ...it, [field]: value } : it) };
    onUpdate(block.id, { columns: cols });
  };

  const addItem = (type: ColumnItemType) => {
    const cols = [...(p.columns || [])];
    const newItem: ColumnItem = { id: crypto.randomUUID(), type, ...DEFAULT_COLUMN_ITEM };
    if (type === 'icon') newItem.content = '⭐';
    if (type === 'heading') { newItem.content = 'Título'; newItem.bold = true; }
    if (type === 'text') newItem.content = 'Texto aqui...';
    if (type === 'button') { newItem.content = 'Saiba mais'; newItem.color = '#6366f1'; }
    if (type === 'spacer') newItem.content = '16';
    if (type === 'image') newItem.content = 'Imagem';
    cols[columnIndex] = { ...cols[columnIndex], items: [...(cols[columnIndex].items || []), newItem] };
    onUpdate(block.id, { columns: cols });
  };

  const removeItem = (itemId: string) => {
    const cols = [...(p.columns || [])];
    cols[columnIndex] = { ...cols[columnIndex], items: (cols[columnIndex].items || []).filter(it => it.id !== itemId) };
    onUpdate(block.id, { columns: cols });
  };

  const moveItem = (itemId: string, dir: 'up' | 'down') => {
    const cols = [...(p.columns || [])];
    const items = [...(cols[columnIndex].items || [])];
    const idx = items.findIndex(it => it.id === itemId);
    if (idx === -1) return;
    const newIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= items.length) return;
    [items[idx], items[newIdx]] = [items[newIdx], items[idx]];
    cols[columnIndex] = { ...cols[columnIndex], items };
    onUpdate(block.id, { columns: cols });
  };

  return (
    <div className="space-y-3">
      <Divider label="Configurações da coluna" />
      <ColorField label="Cor de fundo" value={col.bgColor || ''} onChange={(v) => updateCol('bgColor', v)} />
      <RangeField label="Padding interno" value={col.padding ?? 20} min={0} max={60} step={4} onChange={(v) => updateCol('padding', v)} />
      <div className="space-y-1.5">
        <Label className="text-xs">Alinhamento vertical</Label>
        <Select value={col.verticalAlign || 'top'} onValueChange={(v) => updateCol('verticalAlign', v)}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="top">Topo</SelectItem>
            <SelectItem value="center">Centro</SelectItem>
            <SelectItem value="bottom">Inferior</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Divider label={`Elementos (${col.items?.length || 0})`} />

      {(col.items || []).map((item) => (
        <div key={item.id} className="border rounded-lg p-2 space-y-2 bg-muted/30">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {ITEM_TYPE_LABELS[item.type]}
            </span>
            <div className="flex gap-0.5">
              <button onClick={() => moveItem(item.id, 'up')} className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground"><ArrowUp className="w-3 h-3" /></button>
              <button onClick={() => moveItem(item.id, 'down')} className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground"><ArrowDown className="w-3 h-3" /></button>
              <button onClick={() => removeItem(item.id)} className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:text-destructive"><X className="w-3 h-3" /></button>
            </div>
          </div>
          <ColumnItemEditForm item={item} onUpdate={(field, value) => updateItem(item.id, field, value)} />
        </div>
      ))}

      <div className="space-y-1.5">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Adicionar elemento</Label>
        <div className="grid grid-cols-3 gap-1">
          {(['icon', 'heading', 'text', 'image', 'button', 'video', 'audio', 'spacer', 'list'] as ColumnItemType[]).map(t => (
            <button key={t} onClick={() => addItem(t)} className="text-[10px] p-1.5 rounded border hover:bg-accent text-center transition-colors">{ITEM_TYPE_LABELS[t]}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Main Properties Panel
   ══════════════════════════════════════════════════════════════ */

export function LPEditorProperties({ block, selectedColumnIndex, forms, onUpdate, onUpdateStyles, onDelete }: LPEditorPropertiesProps) {
  const [activeTab, setActiveTab] = useState<'config' | 'styles'>('config');

  if (!block) {
    return (
      <div className="w-[280px] shrink-0 border-l bg-card h-full overflow-y-auto">
        <div className="flex items-center justify-center h-full p-6">
          <p className="text-sm text-muted-foreground text-center">Selecione um bloco para editar suas propriedades</p>
        </div>
      </div>
    );
  }

  // When a specific column is selected in a columns block, show only that column's editor
  const isColumnSelected = block.type === 'columns' && selectedColumnIndex !== null && selectedColumnIndex !== undefined;

  const renderProperties = () => {
    if (isColumnSelected) {
      return <SingleColumnProperties block={block} columnIndex={selectedColumnIndex!} onUpdate={onUpdate} />;
    }
    switch (block.type) {
      case 'hero': return <HeroProperties block={block} onUpdate={onUpdate} />;
      case 'section': return <SectionProperties block={block} onUpdate={onUpdate} />;
      case 'columns': return <ColumnsProperties block={block} onUpdate={onUpdate} />;
      case 'text': return <TextProperties block={block} onUpdate={onUpdate} />;
      case 'image': return <ImageProperties block={block} onUpdate={onUpdate} />;
      case 'button': return <ButtonProperties block={block} onUpdate={onUpdate} />;
      case 'form': return <FormProperties block={block} forms={forms} onUpdate={onUpdate} />;
      case 'spacer': return <SpacerProperties block={block} onUpdate={onUpdate} />;
      case 'video': return <VideoProperties block={block} onUpdate={onUpdate} />;
      case 'countdown': return <CountdownProperties block={block} onUpdate={onUpdate} />;
      case 'divider': return <DividerProperties block={block} onUpdate={onUpdate} />;
      default: return null;
    }
  };

  return (
    <div className="w-[280px] shrink-0 border-l bg-card h-full overflow-y-auto flex flex-col">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <h3 className="font-semibold text-sm">
          {isColumnSelected ? `Coluna ${selectedColumnIndex! + 1}` : BLOCK_TYPE_LABELS[block.type]}
        </h3>
      </div>

      {/* Tab Buttons */}
      <div className="flex border-b">
        <button
          type="button"
          className={cn('flex-1 py-2 text-xs font-medium', activeTab === 'config' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground')}
          onClick={() => setActiveTab('config')}
        >
          Configuracoes
        </button>
        <button
          type="button"
          className={cn('flex-1 py-2 text-xs font-medium', activeTab === 'styles' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground')}
          onClick={() => setActiveTab('styles')}
        >
          Estilos
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'config' ? renderProperties() : <StylesEditor block={block} onUpdateStyles={onUpdateStyles} />}
      </div>

      {/* Delete Button */}
      <div className="p-4 border-t">
        <Button variant="destructive" size="sm" className="w-full" onClick={() => onDelete(block.id)}>
          <Trash2 className="h-4 w-4 mr-2" /> Excluir bloco
        </Button>
      </div>
    </div>
  );
}
