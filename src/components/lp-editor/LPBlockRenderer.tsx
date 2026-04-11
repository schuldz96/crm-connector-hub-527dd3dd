import { Image as ImageIcon, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  LPBlock,
  HeroBlockProps,
  TextBlockProps,
  ImageBlockProps,
  ButtonBlockProps,
  FormBlockProps,
  SpacerBlockProps,
  ColumnsBlockProps,
  SectionBlockProps,
} from './lp-editor-types';

interface LPBlockRendererProps {
  block: LPBlock;
  selected?: boolean;
  onClick?: () => void;
}

const FONT_SIZE_MAP: Record<string, string> = {
  sm: 'text-sm', base: 'text-base', lg: 'text-lg', xl: 'text-xl', '2xl': 'text-2xl',
};
const ALIGN_TEXT: Record<string, string> = { left: 'text-left', center: 'text-center', right: 'text-right' };
const ALIGN_FLEX: Record<string, string> = { left: 'justify-start', center: 'justify-center', right: 'justify-end' };
const ALIGN_ITEMS: Record<string, string> = { left: 'items-start', center: 'items-center', right: 'items-end' };
const IMG_WIDTH: Record<string, string> = { small: 'max-w-xs', medium: 'max-w-md', full: 'w-full' };
const HERO_HEIGHT: Record<string, string> = { small: 'py-16', medium: 'py-24', large: 'py-36', fullscreen: 'min-h-[80vh] py-24' };
const BTN_SIZE: Record<string, string> = { sm: 'px-4 py-2 text-sm', md: 'px-6 py-3 text-sm', lg: 'px-8 py-4 text-base' };
const MAX_WIDTH: Record<string, string> = { sm: 'max-w-sm', md: 'max-w-2xl', lg: 'max-w-4xl', xl: 'max-w-6xl', full: 'max-w-full' };

/* ── Background helper (shared by hero & section) ── */
function BgStyles({ bgColor, bgImage, bgOverlay }: { bgColor: string; bgImage?: string; bgOverlay?: number }) {
  if (!bgImage) return null;
  return (
    <>
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${bgImage})` }} />
      <div className="absolute inset-0" style={{ backgroundColor: bgColor, opacity: (bgOverlay ?? 50) / 100 }} />
    </>
  );
}

/* ── Hero ── */
function HeroBlock({ props }: { props: HeroBlockProps }) {
  const hasBgImg = !!props.bgImage;
  return (
    <div
      className={cn('relative w-full px-8 flex flex-col', HERO_HEIGHT[props.height || 'medium'], ALIGN_TEXT[props.alignment], ALIGN_ITEMS[props.alignment], 'justify-center')}
      style={{ backgroundColor: props.bgColor, color: props.textColor }}
    >
      {hasBgImg && <BgStyles bgColor={props.bgColor} bgImage={props.bgImage} bgOverlay={props.bgOverlay} />}
      <div className="relative z-10 max-w-3xl">
        <h1 className="text-4xl font-bold mb-4 leading-tight">{props.headline}</h1>
        {props.subheadline && <p className="text-xl opacity-80 leading-relaxed">{props.subheadline}</p>}
      </div>
    </div>
  );
}

/* ── Section ── */
function SectionBlock({ props }: { props: SectionBlockProps }) {
  const hasBgImg = !!props.bgImage;
  return (
    <div
      className="relative w-full"
      style={{ backgroundColor: props.bgColor, color: props.textColor, paddingTop: props.paddingY, paddingBottom: props.paddingY, paddingLeft: props.paddingX, paddingRight: props.paddingX }}
    >
      {hasBgImg && <BgStyles bgColor={props.bgColor} bgImage={props.bgImage} bgOverlay={props.bgOverlay} />}
      <div className={cn('relative z-10 mx-auto', MAX_WIDTH[props.maxWidth || 'lg'], ALIGN_TEXT[props.alignment])}>
        {props.title && <h2 className="text-3xl font-bold mb-3">{props.title}</h2>}
        {props.subtitle && <p className="text-lg opacity-70">{props.subtitle}</p>}
      </div>
    </div>
  );
}

/* ── Text ── */
function TextBlock({ props }: { props: TextBlockProps }) {
  return (
    <div className="px-6 py-4">
      <p className={cn(FONT_SIZE_MAP[props.fontSize], ALIGN_TEXT[props.alignment])}>{props.content}</p>
    </div>
  );
}

/* ── Image ── */
function ImageBlock({ props }: { props: ImageBlockProps }) {
  return (
    <div className={cn('px-6 py-4 flex', ALIGN_FLEX[props.alignment])}>
      {props.src ? (
        <img src={props.src} alt={props.alt} className={cn(IMG_WIDTH[props.width])} style={{ borderRadius: props.borderRadius ?? 8 }} />
      ) : (
        <div className={cn('flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/30 bg-muted/50 h-48', IMG_WIDTH[props.width] || 'max-w-md', 'w-full')} style={{ borderRadius: props.borderRadius ?? 8 }}>
          <ImageIcon className="h-10 w-10 text-muted-foreground/40 mb-2" />
          <span className="text-sm text-muted-foreground/50">Cole a URL de uma imagem</span>
        </div>
      )}
    </div>
  );
}

/* ── Button ── */
function ButtonBlock({ props }: { props: ButtonBlockProps }) {
  const filled = props.variant === 'filled';
  return (
    <div className={cn('px-6 py-4 flex', ALIGN_FLEX[props.alignment])}>
      <a
        href={props.url}
        className={cn('inline-block rounded-lg font-medium transition-colors', BTN_SIZE[props.size || 'md'], filled ? 'text-white' : 'bg-transparent border-2')}
        style={filled ? { backgroundColor: props.color } : { borderColor: props.color, color: props.color }}
      >
        {props.text}
      </a>
    </div>
  );
}

/* ── Form ── */
function FormBlock({ props }: { props: FormBlockProps }) {
  return (
    <div className="px-6 py-4">
      <div className="flex items-center gap-3 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/50 p-6">
        <FileText className="h-5 w-5 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{props.formId ? `Formulário vinculado: ${props.formId}` : 'Nenhum formulário vinculado'}</span>
      </div>
    </div>
  );
}

/* ── Spacer ── */
function SpacerBlock({ props }: { props: SpacerBlockProps }) {
  return <div className="relative" style={{ height: props.height }}>
    <div className="absolute inset-x-6 top-1/2 border-t border-dashed border-muted-foreground/15" />
  </div>;
}

/* ── Columns ── */
function ColumnsBlock({ props }: { props: ColumnsBlockProps }) {
  const cols = props.columns || [];
  const count = props.columnCount || cols.length || 2;
  return (
    <div style={{ backgroundColor: props.bgColor || 'transparent', padding: props.padding ?? 32 }}>
      <div className="flex" style={{ gap: props.gap ?? 24 }}>
        {Array.from({ length: count }, (_, i) => {
          const col = cols[i] || { title: '', text: '', imageUrl: '', iconEmoji: '' };
          return (
            <div key={i} className="flex-1 min-h-[120px] rounded-lg border border-border/50 bg-white p-5 flex flex-col gap-3">
              {col.imageUrl ? (
                <img src={col.imageUrl} alt={col.title} className="w-full h-32 object-cover rounded-md" />
              ) : col.iconEmoji ? (
                <span className="text-3xl">{col.iconEmoji}</span>
              ) : (
                <div className="w-full h-24 rounded-md bg-muted/50 border-2 border-dashed border-muted-foreground/20 flex items-center justify-center">
                  <ImageIcon className="h-6 w-6 text-muted-foreground/30" />
                </div>
              )}
              {col.title && <h3 className="font-semibold text-base">{col.title}</h3>}
              {col.text && <p className="text-sm text-muted-foreground leading-relaxed">{col.text}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Main Renderer ── */
export function LPBlockRenderer({ block, selected, onClick }: LPBlockRendererProps) {
  const renderBlock = () => {
    switch (block.type) {
      case 'hero': return <HeroBlock props={block.props as HeroBlockProps} />;
      case 'section': return <SectionBlock props={block.props as SectionBlockProps} />;
      case 'text': return <TextBlock props={block.props as TextBlockProps} />;
      case 'image': return <ImageBlock props={block.props as ImageBlockProps} />;
      case 'button': return <ButtonBlock props={block.props as ButtonBlockProps} />;
      case 'form': return <FormBlock props={block.props as FormBlockProps} />;
      case 'spacer': return <SpacerBlock props={block.props as SpacerBlockProps} />;
      case 'columns': return <ColumnsBlock props={block.props as ColumnsBlockProps} />;
      default: return null;
    }
  };

  return (
    <div
      className={cn('relative transition-shadow overflow-hidden', selected && 'ring-2 ring-primary rounded-md', onClick && 'cursor-pointer')}
      onClick={onClick}
    >
      {renderBlock()}
    </div>
  );
}
