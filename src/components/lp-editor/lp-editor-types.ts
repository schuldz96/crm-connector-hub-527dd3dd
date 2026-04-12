// ─────────────────────────────────────────────────────────────
// LP Editor Types — Foundation for the entire LP editor system
// ─────────────────────────────────────────────────────────────

// ── Block Types ──────────────────────────────────────────────

export type LPBlockType =
  | 'hero'
  | 'text'
  | 'image'
  | 'button'
  | 'form'
  | 'spacer'
  | 'columns'
  | 'section'
  | 'video'
  | 'countdown'
  | 'divider';

// ── Universal Block Styles ───────────────────────────────────

export interface BlockStyles {
  // Background
  bgColor: string;
  bgImage: string;
  bgOverlay: number; // 0-100
  // Borders
  borderColor: string;
  borderWidth: number;
  borderStyle: 'none' | 'solid' | 'dashed' | 'dotted';
  borderRadius: number;
  // Spacing
  marginTop: number;
  marginBottom: number;
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  // Shadow
  shadowColor: string;
  shadowBlur: number;
  shadowX: number;
  shadowY: number;
  // Visibility
  hideOnMobile: boolean;
  hideOnDesktop: boolean;
}

export const DEFAULT_BLOCK_STYLES: BlockStyles = {
  bgColor: '',
  bgImage: '',
  bgOverlay: 0,
  borderColor: '#e2e8f0',
  borderWidth: 0,
  borderStyle: 'none',
  borderRadius: 0,
  marginTop: 0,
  marginBottom: 0,
  paddingTop: 0,
  paddingRight: 0,
  paddingBottom: 0,
  paddingLeft: 0,
  shadowColor: 'rgba(0,0,0,0.1)',
  shadowBlur: 0,
  shadowX: 0,
  shadowY: 0,
  hideOnMobile: false,
  hideOnDesktop: false,
};

// ── Block Prop Interfaces ────────────────────────────────────

export interface HeroBlockProps {
  headline: string;
  subheadline: string;
  bgColor: string;
  bgImage: string;
  bgOverlay: number; // 0-100 opacity of dark overlay
  textColor: string;
  alignment: 'left' | 'center' | 'right';
  height: 'small' | 'medium' | 'large' | 'fullscreen';
}

export interface TextBlockProps {
  content: string;
  alignment: 'left' | 'center' | 'right';
  fontSize: 'sm' | 'base' | 'lg' | 'xl' | '2xl';
}

export interface ImageBlockProps {
  src: string;
  alt: string;
  width: 'small' | 'medium' | 'full';
  alignment: 'left' | 'center' | 'right';
  borderRadius: number;
}

export interface ButtonBlockProps {
  text: string;
  url: string;
  color: string;
  variant: 'filled' | 'outline';
  alignment: 'left' | 'center' | 'right';
  size: 'sm' | 'md' | 'lg';
}

export interface FormBlockProps {
  formId: string;
}

export interface SpacerBlockProps {
  height: number; // in px
}

export interface ColumnContent {
  title: string;
  text: string;
  imageUrl: string;
  iconEmoji: string;
  buttonText: string;
  buttonUrl: string;
}

export type ColumnLayout =
  | '100'
  | '50-50'
  | '33-66'
  | '66-33'
  | '33-33-33'
  | '25-50-25'
  | '25-25-25-25';

export interface ColumnsBlockProps {
  layout: ColumnLayout;
  /** @deprecated Use `layout` instead. Kept for backward compat with saved data. */
  columnCount?: 1 | 2 | 3 | 4;
  gap: number;
  bgColor: string;
  bgImage: string;
  bgOverlay: number;
  textColor: string;
  padding: number;
  columns: ColumnContent[];
}

export interface SectionBlockProps {
  bgColor: string;
  bgImage: string;
  bgOverlay: number;
  paddingY: number;
  paddingX: number;
  title: string;
  subtitle: string;
  textColor: string;
  alignment: 'left' | 'center' | 'right';
  maxWidth: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

export interface VideoBlockProps {
  url: string; // YouTube, Vimeo, or direct MP4
  aspectRatio: '16:9' | '4:3' | '1:1';
  autoplay: boolean;
  alignment: 'left' | 'center' | 'right';
}

export interface CountdownBlockProps {
  endDate: string; // ISO date string
  title: string;
  bgColor: string;
  textColor: string;
  showDays: boolean;
  showHours: boolean;
  showMinutes: boolean;
  showSeconds: boolean;
}

export interface DividerBlockProps {
  style: 'solid' | 'dashed' | 'dotted';
  color: string;
  thickness: number;
  width: number; // percentage 1-100
}

// ── Union type for all block props ───────────────────────────

export type LPBlockProps =
  | HeroBlockProps
  | TextBlockProps
  | ImageBlockProps
  | ButtonBlockProps
  | FormBlockProps
  | SpacerBlockProps
  | ColumnsBlockProps
  | SectionBlockProps
  | VideoBlockProps
  | CountdownBlockProps
  | DividerBlockProps;

// ── LPBlock — a single block in the editor ───────────────────

export interface LPBlock {
  id: string;
  type: LPBlockType;
  props: LPBlockProps;
  styles: BlockStyles;
}

// ── Full LP config stored in the database config JSON field ──

export interface LPEditorConfig {
  blocks: LPBlock[];
}

// ── Default Props ────────────────────────────────────────────

export const DEFAULT_BLOCK_PROPS: Record<LPBlockType, LPBlockProps> = {
  hero: {
    headline: 'Seu título impactante aqui',
    subheadline: 'Uma descrição envolvente para capturar a atenção do visitante',
    bgColor: '#0f172a',
    bgImage: '',
    bgOverlay: 50,
    textColor: '#ffffff',
    alignment: 'center',
    height: 'medium',
  } as HeroBlockProps,
  text: {
    content: 'Digite seu texto aqui...',
    alignment: 'left',
    fontSize: 'base',
  } as TextBlockProps,
  image: {
    src: '',
    alt: 'Imagem',
    width: 'medium',
    alignment: 'center',
    borderRadius: 8,
  } as ImageBlockProps,
  button: {
    text: 'Saiba mais',
    url: '#',
    color: '#6366f1',
    variant: 'filled',
    alignment: 'center',
    size: 'lg',
  } as ButtonBlockProps,
  form: {
    formId: '',
  } as FormBlockProps,
  spacer: {
    height: 40,
  } as SpacerBlockProps,
  columns: {
    layout: '33-33-33',
    gap: 24,
    bgColor: '#ffffff',
    bgImage: '',
    bgOverlay: 0,
    textColor: '#0f172a',
    padding: 48,
    columns: [
      { title: 'Recurso 1', text: 'Descrição do primeiro recurso ou benefício.', imageUrl: '', iconEmoji: '🚀', buttonText: '', buttonUrl: '' },
      { title: 'Recurso 2', text: 'Descrição do segundo recurso ou benefício.', imageUrl: '', iconEmoji: '⚡', buttonText: '', buttonUrl: '' },
      { title: 'Recurso 3', text: 'Descrição do terceiro recurso ou benefício.', imageUrl: '', iconEmoji: '🎯', buttonText: '', buttonUrl: '' },
    ],
  } as ColumnsBlockProps,
  section: {
    bgColor: '#f8fafc',
    bgImage: '',
    bgOverlay: 0,
    paddingY: 64,
    paddingX: 24,
    title: 'Título da Seção',
    subtitle: 'Uma breve descrição para esta seção.',
    textColor: '#0f172a',
    alignment: 'center',
    maxWidth: 'lg',
  } as SectionBlockProps,
  video: {
    url: '',
    aspectRatio: '16:9',
    autoplay: false,
    alignment: 'center',
  } as VideoBlockProps,
  countdown: {
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    title: 'Oferta termina em',
    bgColor: '#0f172a',
    textColor: '#ffffff',
    showDays: true,
    showHours: true,
    showMinutes: true,
    showSeconds: true,
  } as CountdownBlockProps,
  divider: {
    style: 'solid',
    color: '#e2e8f0',
    thickness: 1,
    width: 100,
  } as DividerBlockProps,
};

// ── Block Catalog (categorized) ──────────────────────────────

export interface BlockCatalogItem {
  type: LPBlockType;
  label: string;
  icon: string;
}

export interface BlockCatalogCategory {
  label: string;
  items: BlockCatalogItem[];
}

export const BLOCK_CATALOG: BlockCatalogCategory[] = [
  {
    label: 'Elementos Básicos',
    items: [
      { type: 'hero', label: 'Hero / Banner', icon: 'Layout' },
      { type: 'section', label: 'Seção', icon: 'PanelTop' },
      { type: 'text', label: 'Texto', icon: 'Type' },
      { type: 'image', label: 'Imagem', icon: 'Image' },
      { type: 'button', label: 'Botão', icon: 'MousePointerClick' },
    ],
  },
  {
    label: 'Elementos Avançados',
    items: [
      { type: 'columns', label: 'Colunas', icon: 'Columns3' },
      { type: 'form', label: 'Formulário', icon: 'FileText' },
    ],
  },
  {
    label: 'Addons',
    items: [
      { type: 'video', label: 'Vídeo', icon: 'Play' },
      { type: 'countdown', label: 'Countdown', icon: 'Timer' },
      { type: 'divider', label: 'Divisor', icon: 'Minus' },
      { type: 'spacer', label: 'Espaçador', icon: 'SeparatorHorizontal' },
    ],
  },
];

/**
 * Flat list of all catalog items across all categories.
 * Useful for lookups (e.g. finding label by type).
 */
export const BLOCK_CATALOG_FLAT: BlockCatalogItem[] = BLOCK_CATALOG.flatMap(
  (category) => category.items,
);

// ── Column Layout Helpers ────────────────────────────────────

/**
 * Returns the number of columns from a layout string.
 */
export function getColumnsFromLayout(layout: ColumnLayout): number {
  const parts = layout.split('-');
  return parts.length;
}

/**
 * Returns CSS-ready width strings for each column in a layout.
 */
export function getColumnWidths(layout: ColumnLayout): string[] {
  const map: Record<ColumnLayout, string[]> = {
    '100': ['100%'],
    '50-50': ['50%', '50%'],
    '33-66': ['33.33%', '66.66%'],
    '66-33': ['66.66%', '33.33%'],
    '33-33-33': ['33.33%', '33.33%', '33.33%'],
    '25-50-25': ['25%', '50%', '25%'],
    '25-25-25-25': ['25%', '25%', '25%', '25%'],
  };
  return map[layout] || ['100%'];
}
