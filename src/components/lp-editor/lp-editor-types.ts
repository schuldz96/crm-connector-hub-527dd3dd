// Block types supported by the editor
export type LPBlockType = 'hero' | 'text' | 'image' | 'button' | 'form' | 'spacer' | 'columns';

// Props for each block type
export interface HeroBlockProps {
  headline: string;
  subheadline: string;
  bgColor: string;
  textColor: string;
  alignment: 'left' | 'center' | 'right';
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
}

export interface ButtonBlockProps {
  text: string;
  url: string;
  color: string;
  variant: 'filled' | 'outline';
  alignment: 'left' | 'center' | 'right';
}

export interface FormBlockProps {
  formId: string;
}

export interface SpacerBlockProps {
  height: number; // in px
}

export interface ColumnsBlockProps {
  columnCount: 1 | 2 | 3;
  gap: number; // in px
  contents: string[]; // placeholder text per column
}

// Union type for all block props
export type LPBlockProps =
  | HeroBlockProps
  | TextBlockProps
  | ImageBlockProps
  | ButtonBlockProps
  | FormBlockProps
  | SpacerBlockProps
  | ColumnsBlockProps;

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
  icon: string; // lucide icon name
  defaultProps: LPBlockProps;
}

// Default props for each block type
export const DEFAULT_BLOCK_PROPS: Record<LPBlockType, LPBlockProps> = {
  hero: {
    headline: 'Titulo principal',
    subheadline: 'Subtitulo da sua landing page',
    bgColor: '#0f172a',
    textColor: '#ffffff',
    alignment: 'center',
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
  } as ImageBlockProps,
  button: {
    text: 'Clique aqui',
    url: '#',
    color: '#6366f1',
    variant: 'filled',
    alignment: 'center',
  } as ButtonBlockProps,
  form: {
    formId: '',
  } as FormBlockProps,
  spacer: {
    height: 40,
  } as SpacerBlockProps,
  columns: {
    columnCount: 2,
    gap: 16,
    contents: ['Coluna 1', 'Coluna 2'],
  } as ColumnsBlockProps,
};

// Block catalog for the sidebar
export const BLOCK_CATALOG: BlockCatalogItem[] = [
  { type: 'hero', label: 'Hero / Banner', icon: 'Layout', defaultProps: DEFAULT_BLOCK_PROPS.hero },
  { type: 'text', label: 'Texto', icon: 'Type', defaultProps: DEFAULT_BLOCK_PROPS.text },
  { type: 'image', label: 'Imagem', icon: 'Image', defaultProps: DEFAULT_BLOCK_PROPS.image },
  { type: 'button', label: 'Botao', icon: 'MousePointerClick', defaultProps: DEFAULT_BLOCK_PROPS.button },
  { type: 'form', label: 'Formulario', icon: 'FileText', defaultProps: DEFAULT_BLOCK_PROPS.form },
  { type: 'spacer', label: 'Espacador', icon: 'SeparatorHorizontal', defaultProps: DEFAULT_BLOCK_PROPS.spacer },
  { type: 'columns', label: 'Colunas (1/2/3)', icon: 'Columns3', defaultProps: DEFAULT_BLOCK_PROPS.columns },
];
