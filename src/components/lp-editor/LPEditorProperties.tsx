import { Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type {
  LPBlock, LPBlockType, HeroBlockProps, TextBlockProps, ImageBlockProps,
  ButtonBlockProps, FormBlockProps, SpacerBlockProps, ColumnsBlockProps,
  SectionBlockProps, ColumnContent,
} from '@/components/lp-editor/lp-editor-types';

interface LPEditorPropertiesProps {
  block: LPBlock | null;
  forms: { id: string; nome: string }[];
  onUpdate: (blockId: string, props: Partial<any>) => void;
  onDelete: (blockId: string) => void;
}

const BLOCK_TYPE_LABELS: Record<LPBlockType, string> = {
  hero: 'Hero / Banner', section: 'Seção', columns: 'Colunas',
  text: 'Texto', image: 'Imagem', button: 'Botão',
  form: 'Formulário', spacer: 'Espaçador',
};

/* ── Reusable field components ── */

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

/* ── Hero Properties ── */
function HeroProperties({ block, onUpdate }: { block: LPBlock; onUpdate: LPEditorPropertiesProps['onUpdate'] }) {
  const p = block.props as HeroBlockProps;
  const u = (k: string, v: any) => onUpdate(block.id, { [k]: v });
  return (
    <div className="space-y-3">
      <TextField label="Título" value={p.headline} onChange={(v) => u('headline', v)} />
      <TextField label="Subtítulo" value={p.subheadline} onChange={(v) => u('subheadline', v)} multiline />
      <AlignmentSelect value={p.alignment} onChange={(v) => u('alignment', v)} />
      <div className="space-y-1.5">
        <Label className="text-xs">Altura</Label>
        <Select value={p.height || 'medium'} onValueChange={(v) => u('height', v)}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="small">Pequena</SelectItem>
            <SelectItem value="medium">Média</SelectItem>
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
      <TextField label="Título" value={p.title} onChange={(v) => u('title', v)} />
      <TextField label="Subtítulo" value={p.subtitle} onChange={(v) => u('subtitle', v)} multiline />
      <AlignmentSelect value={p.alignment} onChange={(v) => u('alignment', v)} />
      <div className="space-y-1.5">
        <Label className="text-xs">Largura máxima</Label>
        <Select value={p.maxWidth || 'lg'} onValueChange={(v) => u('maxWidth', v)}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="sm">Estreita</SelectItem>
            <SelectItem value="md">Média</SelectItem>
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
      <Divider label="Espaçamento" />
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
    cols[idx] = { ...(cols[idx] || { title: '', text: '', imageUrl: '', iconEmoji: '' }), [field]: value };
    u('columns', cols);
  };

  const changeCount = (count: 1 | 2 | 3) => {
    const cols = Array.from({ length: count }, (_, i) => p.columns?.[i] || { title: `Coluna ${i + 1}`, text: 'Descrição aqui.', imageUrl: '', iconEmoji: ['🚀', '⚡', '🎯'][i] || '✨' });
    onUpdate(block.id, { columnCount: count, columns: cols });
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Número de colunas</Label>
        <Select value={String(p.columnCount)} onValueChange={(v) => changeCount(Number(v) as 1 | 2 | 3)}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="1">1 coluna</SelectItem>
            <SelectItem value="2">2 colunas</SelectItem>
            <SelectItem value="3">3 colunas</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <RangeField label="Espaçamento" value={p.gap ?? 24} min={0} max={48} step={4} onChange={(v) => u('gap', v)} />
      <ColorField label="Cor de fundo" value={p.bgColor || '#ffffff'} onChange={(v) => u('bgColor', v)} />
      <RangeField label="Padding" value={p.padding ?? 32} min={0} max={80} step={8} onChange={(v) => u('padding', v)} />

      {Array.from({ length: p.columnCount || 2 }, (_, i) => {
        const col = p.columns?.[i] || { title: '', text: '', imageUrl: '', iconEmoji: '' };
        return (
          <div key={i} className="space-y-2">
            <Divider label={`Coluna ${i + 1}`} />
            <TextField label="Emoji / ícone" value={col.iconEmoji} onChange={(v) => updateColumn(i, 'iconEmoji', v)} placeholder="🚀" />
            <TextField label="Imagem (URL)" value={col.imageUrl} onChange={(v) => updateColumn(i, 'imageUrl', v)} placeholder="https://..." />
            <TextField label="Título" value={col.title} onChange={(v) => updateColumn(i, 'title', v)} />
            <TextField label="Texto" value={col.text} onChange={(v) => updateColumn(i, 'text', v)} multiline />
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
      <TextField label="Conteúdo" value={p.content} onChange={(v) => u('content', v)} multiline />
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
            <SelectItem value="medium">Média</SelectItem>
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
            <SelectItem value="md">Médio</SelectItem>
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
        <Label className="text-xs">Formulário vinculado</Label>
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

/* ── Main Properties Panel ── */
export function LPEditorProperties({ block, forms, onUpdate, onDelete }: LPEditorPropertiesProps) {
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
      default: return null;
    }
  };

  return (
    <div className="w-[280px] shrink-0 border-l bg-card h-full overflow-y-auto">
      <div className="p-4 space-y-4">
        <h3 className="font-semibold text-sm">{BLOCK_TYPE_LABELS[block.type]}</h3>
        {renderProperties()}
        <div className="pt-3 border-t">
          <Button variant="destructive" size="sm" className="w-full" onClick={() => onDelete(block.id)}>
            <Trash2 className="h-4 w-4 mr-2" /> Excluir bloco
          </Button>
        </div>
      </div>
    </div>
  );
}
