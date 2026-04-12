import { useState } from 'react';
import { Trash2, ChevronDown, ChevronRight } from 'lucide-react';
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
} from '@/components/lp-editor/lp-editor-types';
import { getColumnsFromLayout } from '@/components/lp-editor/lp-editor-types';

/* ── Props ── */

interface LPEditorPropertiesProps {
  block: LPBlock | null;
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

/* ── Columns Properties ── */
function ColumnsProperties({ block, onUpdate }: { block: LPBlock; onUpdate: LPEditorPropertiesProps['onUpdate'] }) {
  const p = block.props as ColumnsBlockProps;
  const u = (k: string, v: any) => onUpdate(block.id, { [k]: v });

  const updateColumn = (idx: number, field: keyof ColumnContent, value: string) => {
    const cols = [...(p.columns || [])];
    cols[idx] = { ...(cols[idx] || { title: '', text: '', imageUrl: '', iconEmoji: '', buttonText: '', buttonUrl: '' }), [field]: value };
    u('columns', cols);
  };

  const changeLayout = (layout: ColumnLayout) => {
    const newCount = getColumnsFromLayout(layout);
    const cols = Array.from({ length: newCount }, (_, i) =>
      p.columns?.[i] || { title: `Coluna ${i + 1}`, text: 'Descrição aqui.', imageUrl: '', iconEmoji: ['🚀', '⚡', '🎯', '✨'][i] || '✨', buttonText: '', buttonUrl: '' },
    );
    onUpdate(block.id, { layout, columns: cols });
  };

  const currentLayout = p.layout || '33-33-33';
  const colCount = getColumnsFromLayout(currentLayout);

  return (
    <div className="space-y-3">
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
      <RangeField label="Espaçamento" value={p.gap ?? 24} min={0} max={48} step={4} onChange={(v) => u('gap', v)} />
      <RangeField label="Padding" value={p.padding ?? 48} min={0} max={100} step={8} onChange={(v) => u('padding', v)} />

      <Divider label="Fundo" />
      <ColorField label="Cor de fundo" value={p.bgColor || '#ffffff'} onChange={(v) => u('bgColor', v)} />
      <TextField label="Imagem de fundo (URL)" value={p.bgImage || ''} onChange={(v) => u('bgImage', v)} placeholder="https://..." />
      {p.bgImage && <RangeField label="Opacidade do overlay" value={p.bgOverlay ?? 0} min={0} max={100} step={5} unit="%" onChange={(v) => u('bgOverlay', v)} />}
      <ColorField label="Cor do texto" value={p.textColor || '#0f172a'} onChange={(v) => u('textColor', v)} />

      {Array.from({ length: colCount }, (_, i) => {
        const col = p.columns?.[i] || { title: '', text: '', imageUrl: '', iconEmoji: '', buttonText: '', buttonUrl: '' };
        return (
          <div key={i} className="space-y-2">
            <Divider label={`Coluna ${i + 1}`} />
            <TextField label="Emoji / ícone" value={col.iconEmoji || ''} onChange={(v) => updateColumn(i, 'iconEmoji', v)} placeholder="🚀" />
            <TextField label="Imagem (URL)" value={col.imageUrl || ''} onChange={(v) => updateColumn(i, 'imageUrl', v)} placeholder="https://..." />
            <TextField label="Título" value={col.title || ''} onChange={(v) => updateColumn(i, 'title', v)} />
            <TextField label="Texto" value={col.text || ''} onChange={(v) => updateColumn(i, 'text', v)} multiline />
            <TextField label="Texto do botão" value={col.buttonText || ''} onChange={(v) => updateColumn(i, 'buttonText', v)} placeholder="Saiba mais" />
            <TextField label="URL do botão" value={col.buttonUrl || ''} onChange={(v) => updateColumn(i, 'buttonUrl', v)} placeholder="https://..." />
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
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Formulario vinculado</Label>
        <Select value={p.formId || 'none'} onValueChange={(v) => onUpdate(block.id, { formId: v === 'none' ? '' : v })}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Nenhum</SelectItem>
            {forms.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
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

/* ══════════════════════════════════════════════════════════════
   Main Properties Panel
   ══════════════════════════════════════════════════════════════ */

export function LPEditorProperties({ block, forms, onUpdate, onUpdateStyles, onDelete }: LPEditorPropertiesProps) {
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

  const renderProperties = () => {
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
        <h3 className="font-semibold text-sm">{BLOCK_TYPE_LABELS[block.type]}</h3>
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
