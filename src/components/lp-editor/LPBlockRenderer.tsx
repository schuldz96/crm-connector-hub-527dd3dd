import { Image, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  LPBlock,
  HeroBlockProps,
  TextBlockProps,
  ImageBlockProps,
  ButtonBlockProps,
  FormBlockProps,
  SpacerBlockProps,
} from './lp-editor-types';

interface LPBlockRendererProps {
  block: LPBlock;
  selected?: boolean;
  onClick?: () => void;
}

const FONT_SIZE_MAP: Record<string, string> = {
  sm: 'text-sm',
  base: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl',
  '2xl': 'text-2xl',
};

const ALIGNMENT_MAP: Record<string, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

const FLEX_ALIGNMENT_MAP: Record<string, string> = {
  left: 'justify-start',
  center: 'justify-center',
  right: 'justify-end',
};

const IMAGE_WIDTH_MAP: Record<string, string> = {
  small: 'max-w-xs',
  medium: 'max-w-md',
  full: 'w-full',
};

function HeroBlock({ props }: { props: HeroBlockProps }) {
  return (
    <div
      className={cn('w-full py-16 px-8', ALIGNMENT_MAP[props.alignment])}
      style={{ backgroundColor: props.bgColor, color: props.textColor }}
    >
      <h1 className="text-4xl font-bold mb-4">{props.headline}</h1>
      <p className="text-xl opacity-80">{props.subheadline}</p>
    </div>
  );
}

function TextBlock({ props }: { props: TextBlockProps }) {
  return (
    <div className="p-4">
      <p className={cn(FONT_SIZE_MAP[props.fontSize], ALIGNMENT_MAP[props.alignment])}>
        {props.content}
      </p>
    </div>
  );
}

function ImageBlock({ props }: { props: ImageBlockProps }) {
  return (
    <div className={cn('p-4 flex', FLEX_ALIGNMENT_MAP[props.alignment])}>
      {props.src ? (
        <img
          src={props.src}
          alt={props.alt}
          className={cn('rounded', IMAGE_WIDTH_MAP[props.width])}
        />
      ) : (
        <div
          className={cn(
            'flex flex-col items-center justify-center rounded border-2 border-dashed border-muted-foreground/30 bg-muted/50 h-48',
            IMAGE_WIDTH_MAP[props.width],
          )}
        >
          <Image className="h-10 w-10 text-muted-foreground/50 mb-2" />
          <span className="text-sm text-muted-foreground/50">Selecione uma imagem</span>
        </div>
      )}
    </div>
  );
}

function ButtonBlock({ props }: { props: ButtonBlockProps }) {
  const isFilled = props.variant === 'filled';

  return (
    <div className={cn('p-4 flex', FLEX_ALIGNMENT_MAP[props.alignment])}>
      <a
        href={props.url}
        className={cn(
          'inline-block px-6 py-3 rounded-md font-medium text-sm transition-colors',
          isFilled ? 'text-white' : 'bg-transparent border-2',
        )}
        style={
          isFilled
            ? { backgroundColor: props.color }
            : { borderColor: props.color, color: props.color }
        }
      >
        {props.text}
      </a>
    </div>
  );
}

function FormBlock({ props }: { props: FormBlockProps }) {
  return (
    <div className="p-4">
      <div className="flex items-center gap-3 rounded-md border border-dashed border-muted-foreground/30 bg-muted/50 p-6">
        <FileText className="h-5 w-5 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          {props.formId
            ? `Formulario vinculado: ${props.formId}`
            : 'Nenhum formulario vinculado'}
        </span>
      </div>
    </div>
  );
}

function SpacerBlock({ props }: { props: SpacerBlockProps }) {
  return <div style={{ height: `${props.height}px` }} />;
}

export function LPBlockRenderer({ block, selected, onClick }: LPBlockRendererProps) {
  const wrapperClasses = cn(
    'relative transition-shadow',
    selected && 'ring-2 ring-primary rounded-md',
    onClick && 'cursor-pointer',
  );

  const renderBlock = () => {
    switch (block.type) {
      case 'hero':
        return <HeroBlock props={block.props as HeroBlockProps} />;
      case 'text':
        return <TextBlock props={block.props as TextBlockProps} />;
      case 'image':
        return <ImageBlock props={block.props as ImageBlockProps} />;
      case 'button':
        return <ButtonBlock props={block.props as ButtonBlockProps} />;
      case 'form':
        return <FormBlock props={block.props as FormBlockProps} />;
      case 'spacer':
        return <SpacerBlock props={block.props as SpacerBlockProps} />;
      default:
        return null;
    }
  };

  return (
    <div className={wrapperClasses} onClick={onClick}>
      {renderBlock()}
    </div>
  );
}
