import { useState, useEffect } from 'react';
import { Image as ImageIcon, FileText, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  LPBlock,
  BlockStyles,
  HeroBlockProps,
  TextBlockProps,
  ImageBlockProps,
  ButtonBlockProps,
  FormBlockProps,
  SpacerBlockProps,
  ColumnsBlockProps,
  SectionBlockProps,
  VideoBlockProps,
  CountdownBlockProps,
  DividerBlockProps,
  ColumnItem,
  ColumnContent,
} from './lp-editor-types';
import { getColumnWidths } from './lp-editor-types';

// ── Renderer Props ──────────────────────────────────────────

interface LPBlockRendererProps {
  block: LPBlock;
  selected?: boolean;
  selectedColumnIndex?: number | null;
  onClick?: () => void;
  onClickColumn?: (colIndex: number) => void;
}

// ── Lookup Maps ─────────────────────────────────────────────

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

const ASPECT_RATIO_PADDING: Record<string, string> = {
  '16:9': '56.25%',
  '4:3': '75%',
  '1:1': '100%',
};

// ── Universal BlockStyles → CSSProperties ───────────────────

function applyBlockStyles(styles: BlockStyles | undefined): React.CSSProperties {
  const s = styles || ({} as Partial<BlockStyles>);
  const css: React.CSSProperties = {};

  if (s.bgColor) css.backgroundColor = s.bgColor;
  if (s.borderWidth && s.borderStyle !== 'none') {
    css.borderWidth = s.borderWidth;
    css.borderStyle = s.borderStyle;
    css.borderColor = s.borderColor;
  }
  if (s.borderRadius) css.borderRadius = s.borderRadius;
  if (s.marginTop) css.marginTop = s.marginTop;
  if (s.marginBottom) css.marginBottom = s.marginBottom;
  if (s.paddingTop) css.paddingTop = s.paddingTop;
  if (s.paddingRight) css.paddingRight = s.paddingRight;
  if (s.paddingBottom) css.paddingBottom = s.paddingBottom;
  if (s.paddingLeft) css.paddingLeft = s.paddingLeft;
  if (s.shadowBlur) {
    css.boxShadow = `${s.shadowX || 0}px ${s.shadowY || 0}px ${s.shadowBlur}px ${s.shadowColor || 'rgba(0,0,0,0.1)'}`;
  }

  return css;
}

// ── Background helper (shared by hero & section) ────────────

function BgStyles({ bgColor, bgImage, bgOverlay }: { bgColor: string; bgImage?: string; bgOverlay?: number }) {
  if (!bgImage) return null;
  return (
    <>
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${bgImage})` }} />
      <div className="absolute inset-0" style={{ backgroundColor: bgColor, opacity: (bgOverlay ?? 50) / 100 }} />
    </>
  );
}

// ── YouTube/Vimeo helpers ───────────────────────────────────

function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

function extractVimeoId(url: string): string | null {
  const match = url.match(/vimeo\.com\/(\d+)/);
  return match ? match[1] : null;
}

// ── Hero ────────────────────────────────────────────────────

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

// ── Section ─────────────────────────────────────────────────

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

// ── Text ────────────────────────────────────────────────────

function TextBlock({ props }: { props: TextBlockProps }) {
  return (
    <div className="px-6 py-4">
      <p className={cn(FONT_SIZE_MAP[props.fontSize], ALIGN_TEXT[props.alignment])}>{props.content}</p>
    </div>
  );
}

// ── Image ───────────────────────────────────────────────────

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

// ── Button ──────────────────────────────────────────────────

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

// ── Form ────────────────────────────────────────────────────

function FormBlock({ props }: { props: FormBlockProps }) {
  return (
    <div className="w-full" style={{ backgroundColor: props.bgColor || '#f8fafc', color: props.textColor || '#0f172a', padding: '48px 32px' }}>
      <div className="max-w-lg mx-auto">
        {props.title && <h2 className="text-2xl font-bold mb-2 text-center">{props.title}</h2>}
        {props.subtitle && <p className="text-sm opacity-70 mb-6 text-center">{props.subtitle}</p>}
        {!props.formId ? (
          <div className="flex items-center gap-3 rounded-lg border border-dashed border-muted-foreground/30 bg-white/50 p-6">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Selecione um formulário nas propriedades</span>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Preview placeholder fields */}
            <div className="rounded-lg border bg-white p-3"><div className="text-xs text-muted-foreground mb-1">Nome *</div><div className="h-9 rounded-md bg-muted/50 border" /></div>
            <div className="rounded-lg border bg-white p-3"><div className="text-xs text-muted-foreground mb-1">E-mail *</div><div className="h-9 rounded-md bg-muted/50 border" /></div>
            <div className="rounded-lg border bg-white p-3"><div className="text-xs text-muted-foreground mb-1">Telefone</div><div className="h-9 rounded-md bg-muted/50 border" /></div>
            <button className="w-full py-3 rounded-lg text-white font-medium text-sm" style={{ backgroundColor: props.buttonColor || '#6366f1' }}>
              {props.buttonText || 'Enviar'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Spacer ──────────────────────────────────────────────────

function SpacerBlock({ props }: { props: SpacerBlockProps }) {
  return (
    <div className="relative" style={{ height: props.height }}>
      <div className="absolute inset-x-6 top-1/2 border-t border-dashed border-muted-foreground/15" />
    </div>
  );
}

// ── Column Item Renderer ────────────────────────────────────

function ColumnItemRenderer({ item }: { item: ColumnItem }) {
  const alignClass = { left: 'text-left', center: 'text-center', right: 'text-right' }[item.alignment] || '';
  const sizeMap: Record<string, string> = { sm: 'text-sm', md: 'text-base', lg: 'text-lg', xl: 'text-xl' };
  const iconSizeMap: Record<string, string> = { sm: 'text-2xl', md: 'text-3xl', lg: 'text-4xl', xl: 'text-5xl' };
  const btnSizeMap: Record<string, string> = { sm: 'px-3 py-1.5 text-xs', md: 'px-5 py-2.5 text-sm', lg: 'px-7 py-3 text-base', xl: 'px-9 py-4 text-lg' };

  switch (item.type) {
    case 'icon':
      return <div className={alignClass}><span className={iconSizeMap[item.size]}>{item.content}</span></div>;
    case 'heading':
      return (
        <h3
          className={cn(
            'font-semibold',
            sizeMap[item.size] === 'text-sm' ? 'text-base' : sizeMap[item.size] === 'text-base' ? 'text-lg' : sizeMap[item.size] === 'text-lg' ? 'text-xl' : 'text-2xl',
            alignClass,
            item.bold && 'font-bold',
            item.italic && 'italic',
          )}
          style={{ color: item.color || undefined }}
        >
          {item.content}
        </h3>
      );
    case 'text':
      return (
        <p
          className={cn(sizeMap[item.size], alignClass, item.bold && 'font-semibold', item.italic && 'italic', 'opacity-80 leading-relaxed')}
          style={{ color: item.color || undefined }}
        >
          {item.content}
        </p>
      );
    case 'image':
      return item.url
        ? <img src={item.url} alt={item.content || 'Imagem'} className="w-full rounded-lg object-cover" />
        : <div className="w-full h-32 rounded-lg bg-muted/50 border-2 border-dashed border-muted-foreground/20 flex items-center justify-center"><ImageIcon className="h-6 w-6 text-muted-foreground/30" /></div>;
    case 'button':
      return (
        <div className={alignClass}>
          <a
            href={item.url || '#'}
            className={cn('inline-block rounded-lg font-medium text-white', btnSizeMap[item.size])}
            style={{ backgroundColor: item.color || '#6366f1' }}
          >
            {item.content || 'Botao'}
          </a>
        </div>
      );
    case 'video':
      return item.url
        ? (
          <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
            <iframe
              src={item.url.includes('youtube') ? `https://www.youtube.com/embed/${item.url.match(/(?:v=|youtu\.be\/)([^&]+)/)?.[1] || ''}` : item.url}
              className="absolute inset-0 w-full h-full rounded-lg"
              allowFullScreen
            />
          </div>
        )
        : <div className="w-full h-32 rounded-lg bg-muted/50 border-2 border-dashed flex items-center justify-center text-muted-foreground/40">Video</div>;
    case 'audio':
      return item.url
        ? <audio src={item.url} controls className="w-full" />
        : <div className="w-full h-12 rounded-lg bg-muted/50 border-2 border-dashed flex items-center justify-center text-muted-foreground/40 text-sm">Audio</div>;
    case 'spacer':
      return <div style={{ height: parseInt(item.content) || 16 }} />;
    case 'list': {
      const listItems = (item.content || '').split('\n').filter(Boolean);
      return (
        <ul className={cn('space-y-1', alignClass)}>
          {listItems.map((li, idx) => (
            <li key={idx} className={cn(sizeMap[item.size], 'flex items-start gap-2')}>
              <span className="text-primary mt-0.5">&#8226;</span>
              <span style={{ color: item.color || undefined }}>{li}</span>
            </li>
          ))}
        </ul>
      );
    }
    default:
      return null;
  }
}

// ── Columns ─────────────────────────────────────────────────

function ColumnsBlock({ props, selectedColumnIndex, onClickColumn }: { props: ColumnsBlockProps; selectedColumnIndex?: number | null; onClickColumn?: (i: number) => void }) {
  const cols = props.columns || [];
  const widths = getColumnWidths(props.layout || '50-50');
  const count = widths.length;
  const hasBgImg = !!props.bgImage;

  return (
    <div className="relative w-full" style={{ backgroundColor: props.bgColor || 'transparent', color: props.textColor || '#0f172a', padding: props.padding ?? 48 }}>
      {hasBgImg && <BgStyles bgColor={props.bgColor} bgImage={props.bgImage} bgOverlay={props.bgOverlay} />}
      <div className="relative z-10 flex w-full" style={{ gap: props.gap ?? 24 }}>
        {Array.from({ length: count }, (_, i) => {
          const col: ColumnContent = cols[i] || { items: [], verticalAlign: 'top', bgColor: '', padding: 20 };
          const vAlignClass = { top: 'justify-start', center: 'justify-center', bottom: 'justify-end' }[col.verticalAlign || 'top'];

          return (
            <div
              key={i}
              className={cn(
                'min-h-[120px] rounded-xl shadow-sm flex flex-col gap-3 transition-all cursor-pointer',
                vAlignClass,
                selectedColumnIndex === i && 'ring-2 ring-primary/70',
              )}
              style={{
                width: widths[i],
                flexShrink: 0,
                padding: col.padding ?? 20,
                backgroundColor: col.bgColor || 'rgba(255,255,255,0.9)',
              }}
              onClick={(e) => { e.stopPropagation(); onClickColumn?.(i); }}
            >
              {(col.items && col.items.length > 0) ? (
                col.items.map((item) => <ColumnItemRenderer key={item.id} item={item} />)
              ) : (
                <div className="w-full h-24 rounded-lg bg-muted/50 border-2 border-dashed border-muted-foreground/20 flex items-center justify-center">
                  <ImageIcon className="h-6 w-6 text-muted-foreground/30" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Video ───────────────────────────────────────────────────

function VideoBlock({ props }: { props: VideoBlockProps }) {
  const paddingBottom = ASPECT_RATIO_PADDING[props.aspectRatio] || '56.25%';

  const youtubeId = props.url ? extractYouTubeId(props.url) : null;
  const vimeoId = props.url ? extractVimeoId(props.url) : null;
  const isMp4 = props.url?.endsWith('.mp4');

  // No URL — placeholder
  if (!props.url) {
    return (
      <div className={cn('px-6 py-4 flex', ALIGN_FLEX[props.alignment])}>
        <div className="w-full max-w-2xl">
          <div className="relative" style={{ paddingBottom }}>
            <div className="absolute inset-0 rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/50 flex flex-col items-center justify-center gap-2">
              <Play className="h-10 w-10 text-muted-foreground/40" />
              <span className="text-sm text-muted-foreground/50">Cole a URL de um vídeo</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // YouTube embed
  if (youtubeId) {
    return (
      <div className={cn('px-6 py-4 flex', ALIGN_FLEX[props.alignment])}>
        <div className="w-full max-w-2xl">
          <div className="relative" style={{ paddingBottom }}>
            <iframe
              className="absolute inset-0 w-full h-full rounded-lg"
              src={`https://www.youtube.com/embed/${youtubeId}${props.autoplay ? '?autoplay=1&mute=1' : ''}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title="YouTube video"
            />
          </div>
        </div>
      </div>
    );
  }

  // Vimeo embed
  if (vimeoId) {
    return (
      <div className={cn('px-6 py-4 flex', ALIGN_FLEX[props.alignment])}>
        <div className="w-full max-w-2xl">
          <div className="relative" style={{ paddingBottom }}>
            <iframe
              className="absolute inset-0 w-full h-full rounded-lg"
              src={`https://player.vimeo.com/video/${vimeoId}${props.autoplay ? '?autoplay=1&muted=1' : ''}`}
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              title="Vimeo video"
            />
          </div>
        </div>
      </div>
    );
  }

  // Direct MP4 (or other direct URL)
  if (isMp4) {
    return (
      <div className={cn('px-6 py-4 flex', ALIGN_FLEX[props.alignment])}>
        <div className="w-full max-w-2xl">
          <div className="relative" style={{ paddingBottom }}>
            <video
              className="absolute inset-0 w-full h-full rounded-lg object-cover"
              src={props.url}
              controls
              autoPlay={props.autoplay}
              muted={props.autoplay}
            />
          </div>
        </div>
      </div>
    );
  }

  // Fallback — try iframe for unknown embed URLs
  return (
    <div className={cn('px-6 py-4 flex', ALIGN_FLEX[props.alignment])}>
      <div className="w-full max-w-2xl">
        <div className="relative" style={{ paddingBottom }}>
          <iframe
            className="absolute inset-0 w-full h-full rounded-lg"
            src={props.url}
            allow="autoplay; fullscreen"
            allowFullScreen
            title="Video"
          />
        </div>
      </div>
    </div>
  );
}

// ── Countdown ───────────────────────────────────────────────

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
}

function computeTimeLeft(endDate: string): TimeLeft {
  const diff = new Date(endDate).getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };

  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
    expired: false,
  };
}

function CountdownBlock({ props }: { props: CountdownBlockProps }) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() => computeTimeLeft(props.endDate));

  useEffect(() => {
    setTimeLeft(computeTimeLeft(props.endDate));
    const interval = setInterval(() => {
      setTimeLeft(computeTimeLeft(props.endDate));
    }, 1000);
    return () => clearInterval(interval);
  }, [props.endDate]);

  const segments: { value: number; label: string }[] = [];
  if (props.showDays) segments.push({ value: timeLeft.days, label: 'Dias' });
  if (props.showHours) segments.push({ value: timeLeft.hours, label: 'Horas' });
  if (props.showMinutes) segments.push({ value: timeLeft.minutes, label: 'Min' });
  if (props.showSeconds) segments.push({ value: timeLeft.seconds, label: 'Seg' });

  return (
    <div className="px-6 py-8 flex flex-col items-center gap-4" style={{ backgroundColor: props.bgColor, color: props.textColor }}>
      {props.title && <p className="text-lg font-semibold">{props.title}</p>}
      {timeLeft.expired ? (
        <p className="text-2xl font-bold opacity-70">Encerrado</p>
      ) : (
        <div className="flex items-center gap-3">
          {segments.map((seg, i) => (
            <div key={i} className="flex flex-col items-center">
              <div className="rounded-lg px-4 py-3 min-w-[64px] text-center" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
                <span className="text-3xl font-bold tabular-nums">{String(seg.value).padStart(2, '0')}</span>
              </div>
              <span className="text-xs mt-1 uppercase opacity-70">{seg.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Divider ─────────────────────────────────────────────────

function DividerBlock({ props }: { props: DividerBlockProps }) {
  return (
    <div className="px-6 py-4">
      <hr
        style={{
          borderStyle: props.style || 'solid',
          borderColor: props.color || '#e2e8f0',
          borderWidth: 0,
          borderTopWidth: props.thickness || 1,
          width: `${props.width || 100}%`,
          margin: '0 auto',
        }}
      />
    </div>
  );
}

// ── Main Renderer ───────────────────────────────────────────

export function LPBlockRenderer({ block, selected, selectedColumnIndex, onClick, onClickColumn }: LPBlockRendererProps) {
  const universalStyle = applyBlockStyles(block.styles);

  const renderBlock = () => {
    switch (block.type) {
      case 'hero': return <HeroBlock props={block.props as HeroBlockProps} />;
      case 'section': return <SectionBlock props={block.props as SectionBlockProps} />;
      case 'text': return <TextBlock props={block.props as TextBlockProps} />;
      case 'image': return <ImageBlock props={block.props as ImageBlockProps} />;
      case 'button': return <ButtonBlock props={block.props as ButtonBlockProps} />;
      case 'form': return <FormBlock props={block.props as FormBlockProps} />;
      case 'spacer': return <SpacerBlock props={block.props as SpacerBlockProps} />;
      case 'columns': return <ColumnsBlock props={block.props as ColumnsBlockProps} selectedColumnIndex={selectedColumnIndex} onClickColumn={onClickColumn} />;
      case 'video': return <VideoBlock props={block.props as VideoBlockProps} />;
      case 'countdown': return <CountdownBlock props={block.props as CountdownBlockProps} />;
      case 'divider': return <DividerBlock props={block.props as DividerBlockProps} />;
      default: return null;
    }
  };

  return (
    <div
      className={cn('relative transition-shadow overflow-hidden', selected && 'ring-2 ring-primary rounded-md', onClick && 'cursor-pointer')}
      style={universalStyle}
      onClick={onClick}
    >
      {/* Background image layer from universal block styles */}
      {block.styles?.bgImage && (
        <>
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${block.styles.bgImage})` }} />
          <div className="absolute inset-0" style={{ backgroundColor: '#000', opacity: (block.styles.bgOverlay || 0) / 100 }} />
        </>
      )}
      <div className="relative z-10">
        {renderBlock()}
      </div>
    </div>
  );
}
