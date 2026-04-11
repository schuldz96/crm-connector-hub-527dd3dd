import { Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  LPBlock,
  LPBlockType,
  HeroBlockProps,
  TextBlockProps,
  ImageBlockProps,
  ButtonBlockProps,
  FormBlockProps,
  SpacerBlockProps,
} from '@/components/lp-editor/lp-editor-types';

interface LPEditorPropertiesProps {
  block: LPBlock | null;
  forms: { id: string; nome: string }[];
  onUpdate: (blockId: string, props: Partial<any>) => void;
  onDelete: (blockId: string) => void;
}

const BLOCK_TYPE_LABELS: Record<LPBlockType, string> = {
  hero: 'Hero / Banner',
  text: 'Texto',
  image: 'Imagem',
  button: 'Botao',
  form: 'Formulario',
  spacer: 'Espacador',
};

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-8 h-8 rounded border cursor-pointer"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 h-8 text-xs"
        />
      </div>
    </div>
  );
}

function AlignmentSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">Alinhamento</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="left">Esquerda</SelectItem>
          <SelectItem value="center">Centro</SelectItem>
          <SelectItem value="right">Direita</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function HeroProperties({
  block,
  onUpdate,
}: {
  block: LPBlock;
  onUpdate: LPEditorPropertiesProps['onUpdate'];
}) {
  const props = block.props as HeroBlockProps;
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Titulo</Label>
        <Input
          value={props.headline}
          onChange={(e) => onUpdate(block.id, { headline: e.target.value })}
          className="h-8 text-xs"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Subtitulo</Label>
        <Textarea
          value={props.subheadline}
          onChange={(e) => onUpdate(block.id, { subheadline: e.target.value })}
          rows={2}
          className="text-xs"
        />
      </div>
      <ColorField
        label="Cor de fundo"
        value={props.bgColor}
        onChange={(val) => onUpdate(block.id, { bgColor: val })}
      />
      <ColorField
        label="Cor do texto"
        value={props.textColor}
        onChange={(val) => onUpdate(block.id, { textColor: val })}
      />
      <AlignmentSelect
        value={props.alignment}
        onChange={(val) => onUpdate(block.id, { alignment: val })}
      />
    </div>
  );
}

function TextProperties({
  block,
  onUpdate,
}: {
  block: LPBlock;
  onUpdate: LPEditorPropertiesProps['onUpdate'];
}) {
  const props = block.props as TextBlockProps;
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Conteudo</Label>
        <Textarea
          value={props.content}
          onChange={(e) => onUpdate(block.id, { content: e.target.value })}
          rows={4}
          className="text-xs"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Tamanho da fonte</Label>
        <Select
          value={props.fontSize}
          onValueChange={(val) => onUpdate(block.id, { fontSize: val })}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sm">Pequeno</SelectItem>
            <SelectItem value="base">Normal</SelectItem>
            <SelectItem value="lg">Grande</SelectItem>
            <SelectItem value="xl">Extra Grande</SelectItem>
            <SelectItem value="2xl">Enorme</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <AlignmentSelect
        value={props.alignment}
        onChange={(val) => onUpdate(block.id, { alignment: val })}
      />
    </div>
  );
}

function ImageProperties({
  block,
  onUpdate,
}: {
  block: LPBlock;
  onUpdate: LPEditorPropertiesProps['onUpdate'];
}) {
  const props = block.props as ImageBlockProps;
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">URL da imagem</Label>
        <Input
          value={props.src}
          onChange={(e) => onUpdate(block.id, { src: e.target.value })}
          placeholder="https://..."
          className="h-8 text-xs"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Texto alternativo</Label>
        <Input
          value={props.alt}
          onChange={(e) => onUpdate(block.id, { alt: e.target.value })}
          className="h-8 text-xs"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Largura</Label>
        <Select
          value={props.width}
          onValueChange={(val) => onUpdate(block.id, { width: val })}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="small">Pequena</SelectItem>
            <SelectItem value="medium">Media</SelectItem>
            <SelectItem value="full">Largura total</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <AlignmentSelect
        value={props.alignment}
        onChange={(val) => onUpdate(block.id, { alignment: val })}
      />
    </div>
  );
}

function ButtonProperties({
  block,
  onUpdate,
}: {
  block: LPBlock;
  onUpdate: LPEditorPropertiesProps['onUpdate'];
}) {
  const props = block.props as ButtonBlockProps;
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Texto</Label>
        <Input
          value={props.text}
          onChange={(e) => onUpdate(block.id, { text: e.target.value })}
          className="h-8 text-xs"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">URL do link</Label>
        <Input
          value={props.url}
          onChange={(e) => onUpdate(block.id, { url: e.target.value })}
          placeholder="https://..."
          className="h-8 text-xs"
        />
      </div>
      <ColorField
        label="Cor"
        value={props.color}
        onChange={(val) => onUpdate(block.id, { color: val })}
      />
      <div className="space-y-1.5">
        <Label className="text-xs">Estilo</Label>
        <Select
          value={props.variant}
          onValueChange={(val) => onUpdate(block.id, { variant: val })}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="filled">Preenchido</SelectItem>
            <SelectItem value="outline">Contorno</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <AlignmentSelect
        value={props.alignment}
        onChange={(val) => onUpdate(block.id, { alignment: val })}
      />
    </div>
  );
}

function FormProperties({
  block,
  forms,
  onUpdate,
}: {
  block: LPBlock;
  forms: LPEditorPropertiesProps['forms'];
  onUpdate: LPEditorPropertiesProps['onUpdate'];
}) {
  const props = block.props as FormBlockProps;
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Formulario vinculado</Label>
        <Select
          value={props.formId || 'none'}
          onValueChange={(val) =>
            onUpdate(block.id, { formId: val === 'none' ? '' : val })
          }
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Selecione um formulario" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Nenhum</SelectItem>
            {forms.map((form) => (
              <SelectItem key={form.id} value={form.id}>
                {form.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function SpacerProperties({
  block,
  onUpdate,
}: {
  block: LPBlock;
  onUpdate: LPEditorPropertiesProps['onUpdate'];
}) {
  const props = block.props as SpacerBlockProps;
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Altura</Label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={8}
            max={200}
            step={8}
            value={props.height}
            onChange={(e) =>
              onUpdate(block.id, { height: Number(e.target.value) })
            }
            className="flex-1"
          />
          <span className="text-xs text-muted-foreground w-12 text-right">
            {props.height}px
          </span>
        </div>
      </div>
    </div>
  );
}

export function LPEditorProperties({
  block,
  forms,
  onUpdate,
  onDelete,
}: LPEditorPropertiesProps) {
  if (!block) {
    return (
      <div className="w-[280px] shrink-0 border-l bg-card h-full overflow-y-auto">
        <div className="flex items-center justify-center h-full p-6">
          <p className="text-sm text-muted-foreground text-center">
            Selecione um bloco para editar suas propriedades
          </p>
        </div>
      </div>
    );
  }

  const renderProperties = () => {
    switch (block.type) {
      case 'hero':
        return <HeroProperties block={block} onUpdate={onUpdate} />;
      case 'text':
        return <TextProperties block={block} onUpdate={onUpdate} />;
      case 'image':
        return <ImageProperties block={block} onUpdate={onUpdate} />;
      case 'button':
        return <ButtonProperties block={block} onUpdate={onUpdate} />;
      case 'form':
        return (
          <FormProperties block={block} forms={forms} onUpdate={onUpdate} />
        );
      case 'spacer':
        return <SpacerProperties block={block} onUpdate={onUpdate} />;
      default:
        return null;
    }
  };

  return (
    <div className="w-[280px] shrink-0 border-l bg-card h-full overflow-y-auto">
      <div className="p-4 space-y-4">
        <h3 className="font-semibold text-sm">
          {BLOCK_TYPE_LABELS[block.type]}
        </h3>

        {renderProperties()}

        <div className="pt-3 border-t">
          <Button
            variant="destructive"
            size="sm"
            className="w-full"
            onClick={() => onDelete(block.id)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Excluir bloco
          </Button>
        </div>
      </div>
    </div>
  );
}
