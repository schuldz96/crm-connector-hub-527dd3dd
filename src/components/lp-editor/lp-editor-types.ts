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
  | 'divider'
  | 'scheduling';

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
  title: string;
  subtitle: string;
  buttonText: string;
  buttonColor: string;
  bgColor: string;
  textColor: string;
  layout: 'stacked' | 'inline'; // stacked = vertical, inline = side by side
}

export interface SpacerBlockProps {
  height: number; // in px
}

// ── Column sub-block system ─────────────────────────────────
// Each column contains an array of sub-blocks (mini-editor)

export type ColumnItemType = 'icon' | 'heading' | 'text' | 'image' | 'button' | 'video' | 'audio' | 'spacer' | 'list';

export interface ColumnItem {
  id: string;
  type: ColumnItemType;
  // Universal props for each type
  content: string;       // text content (heading text, paragraph, button label, list items separated by \n)
  url: string;           // image src, video url, audio src, button href
  color: string;         // text color, button bg, icon color
  bgColor: string;       // item background
  size: 'sm' | 'md' | 'lg' | 'xl'; // font size, icon size, button size
  alignment: 'left' | 'center' | 'right';
  bold: boolean;
  italic: boolean;
}

export const DEFAULT_COLUMN_ITEM: Omit<ColumnItem, 'id' | 'type'> = {
  content: '', url: '', color: '', bgColor: '', size: 'md', alignment: 'left', bold: false, italic: false,
};

export interface ColumnContent {
  items: ColumnItem[];
  verticalAlign: 'top' | 'center' | 'bottom';
  bgColor: string;
  padding: number;
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

export interface SchedulingBlockProps {
  title: string;
  subtitle: string;
  bgColor: string;
  textColor: string;
  accentColor: string;
  startHour: number; // 0-23
  endHour: number;   // 0-23
  slotMinutes: number; // 15, 30, 60
  daysToShow: number; // how many days ahead to show (7, 14, 30)
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
  | DividerBlockProps
  | SchedulingBlockProps;

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
    title: 'Entre em contato',
    subtitle: 'Preencha o formulário abaixo',
    buttonText: 'Enviar',
    buttonColor: '#6366f1',
    bgColor: '#f8fafc',
    textColor: '#0f172a',
    layout: 'stacked',
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
      { verticalAlign: 'top', bgColor: '', padding: 20, items: [
        { id: 'i1', type: 'icon', content: '🚀', url: '', color: '', bgColor: '', size: 'lg', alignment: 'left', bold: false, italic: false },
        { id: 'i2', type: 'heading', content: 'Recurso 1', url: '', color: '', bgColor: '', size: 'md', alignment: 'left', bold: true, italic: false },
        { id: 'i3', type: 'text', content: 'Descrição do primeiro recurso ou benefício.', url: '', color: '', bgColor: '', size: 'sm', alignment: 'left', bold: false, italic: false },
      ]},
      { verticalAlign: 'top', bgColor: '', padding: 20, items: [
        { id: 'i4', type: 'icon', content: '⚡', url: '', color: '', bgColor: '', size: 'lg', alignment: 'left', bold: false, italic: false },
        { id: 'i5', type: 'heading', content: 'Recurso 2', url: '', color: '', bgColor: '', size: 'md', alignment: 'left', bold: true, italic: false },
        { id: 'i6', type: 'text', content: 'Descrição do segundo recurso ou benefício.', url: '', color: '', bgColor: '', size: 'sm', alignment: 'left', bold: false, italic: false },
      ]},
      { verticalAlign: 'top', bgColor: '', padding: 20, items: [
        { id: 'i7', type: 'icon', content: '🎯', url: '', color: '', bgColor: '', size: 'lg', alignment: 'left', bold: false, italic: false },
        { id: 'i8', type: 'heading', content: 'Recurso 3', url: '', color: '', bgColor: '', size: 'md', alignment: 'left', bold: true, italic: false },
        { id: 'i9', type: 'text', content: 'Descrição do terceiro recurso ou benefício.', url: '', color: '', bgColor: '', size: 'sm', alignment: 'left', bold: false, italic: false },
      ]},
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
  scheduling: {
    title: 'Agende uma demonstração',
    subtitle: 'Escolha o melhor horário para você',
    bgColor: '#ffffff',
    textColor: '#0f172a',
    accentColor: '#6366f1',
    startHour: 8,
    endHour: 20,
    slotMinutes: 30,
    daysToShow: 7,
  } as SchedulingBlockProps,
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
      { type: 'scheduling', label: 'Agendamento', icon: 'CalendarClock' },
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
