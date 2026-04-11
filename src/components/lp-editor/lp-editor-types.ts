// Block types supported by the editor
export type LPBlockType = 'hero' | 'text' | 'image' | 'button' | 'form' | 'spacer' | 'columns' | 'section';

// Props for each block type
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
}

export interface ColumnsBlockProps {
  columnCount: 1 | 2 | 3;
  gap: number;
  bgColor: string;
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

// Union type for all block props
export type LPBlockProps =
  | HeroBlockProps
  | TextBlockProps
  | ImageBlockProps
  | ButtonBlockProps
  | FormBlockProps
  | SpacerBlockProps
  | ColumnsBlockProps
  | SectionBlockProps;

// A single block in the editor
export interface LPBlock {
  id: string;
  type: LPBlockType;
  props: LPBlockProps;
}

// The full LP config stored in the database config JSON field
export interface LPEditorConfig {
  blocks: LPBlock[];
}

// Block catalog item (for the sidebar)
export interface BlockCatalogItem {
  type: LPBlockType;
  label: string;
  icon: string;
  defaultProps: LPBlockProps;
}

// Default props for each block type
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
    columnCount: 3,
    gap: 24,
    bgColor: '#ffffff',
    padding: 32,
    columns: [
      { title: 'Recurso 1', text: 'Descrição do primeiro recurso ou benefício.', imageUrl: '', iconEmoji: '🚀' },
      { title: 'Recurso 2', text: 'Descrição do segundo recurso ou benefício.', imageUrl: '', iconEmoji: '⚡' },
      { title: 'Recurso 3', text: 'Descrição do terceiro recurso ou benefício.', imageUrl: '', iconEmoji: '🎯' },
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
};

// Block catalog for the sidebar
export const BLOCK_CATALOG: BlockCatalogItem[] = [
  { type: 'hero', label: 'Hero / Banner', icon: 'Layout', defaultProps: DEFAULT_BLOCK_PROPS.hero },
  { type: 'section', label: 'Seção', icon: 'PanelTop', defaultProps: DEFAULT_BLOCK_PROPS.section },
  { type: 'columns', label: 'Colunas (1/2/3)', icon: 'Columns3', defaultProps: DEFAULT_BLOCK_PROPS.columns },
  { type: 'text', label: 'Texto', icon: 'Type', defaultProps: DEFAULT_BLOCK_PROPS.text },
  { type: 'image', label: 'Imagem', icon: 'Image', defaultProps: DEFAULT_BLOCK_PROPS.image },
  { type: 'button', label: 'Botão', icon: 'MousePointerClick', defaultProps: DEFAULT_BLOCK_PROPS.button },
  { type: 'form', label: 'Formulário', icon: 'FileText', defaultProps: DEFAULT_BLOCK_PROPS.form },
  { type: 'spacer', label: 'Espaçador', icon: 'SeparatorHorizontal', defaultProps: DEFAULT_BLOCK_PROPS.spacer },
];
