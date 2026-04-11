import { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import {
  Layout,
  PanelTop,
  Type,
  Image,
  MousePointerClick,
  FileText,
  SeparatorHorizontal,
  Columns3,
  Play,
  Timer,
  Minus,
  LayoutGrid,
  ChevronDown,
  ChevronRight,
  LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BLOCK_CATALOG, LPBlockType } from '@/components/lp-editor/lp-editor-types';

const ICON_MAP: Record<string, LucideIcon> = {
  Layout,
  PanelTop,
  Type,
  Image,
  MousePointerClick,
  FileText,
  SeparatorHorizontal,
  Columns3,
  Play,
  Timer,
  Minus,
};

interface LPEditorSidebarProps {
  onAddBlock: (type: LPBlockType) => void;
}

function DraggableCatalogItem({
  type,
  label,
  iconName,
  onAddBlock,
}: {
  type: LPBlockType;
  label: string;
  iconName: string;
  onAddBlock: (type: LPBlockType) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `catalog-${type}`,
    data: { type, fromCatalog: true },
  });

  const Icon = ICON_MAP[iconName];
  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;

  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={style}
      onClick={() => onAddBlock(type)}
      className={cn(
        'flex items-center gap-2 w-full rounded-md border bg-background py-2.5 px-3',
        'text-sm text-left cursor-grab transition-colors',
        'hover:bg-accent hover:border-accent-foreground/20',
        isDragging && 'opacity-50 shadow-lg',
      )}
    >
      {Icon && <Icon className="h-4 w-4 text-muted-foreground shrink-0" />}
      <span className="truncate text-xs">{label}</span>
    </button>
  );
}

export function LPEditorSidebar({ onAddBlock }: LPEditorSidebarProps) {
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(BLOCK_CATALOG.map((cat) => [cat.label, true])),
  );

  const toggleCategory = (label: string) => {
    setExpandedCategories((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <div className="w-[240px] shrink-0 border-r bg-card h-full overflow-y-auto">
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <LayoutGrid className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Blocos</h3>
        </div>

        <p className="text-xs text-muted-foreground">
          Arraste ou clique para adicionar blocos a sua pagina.
        </p>

        <div className="space-y-3">
          {BLOCK_CATALOG.map((category) => {
            const isExpanded = expandedCategories[category.label] ?? true;

            return (
              <div key={category.label}>
                <button
                  onClick={() => toggleCategory(category.label)}
                  className="flex items-center gap-1.5 w-full text-left text-xs font-medium text-muted-foreground hover:text-foreground transition-colors py-1"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                  )}
                  {category.label}
                </button>

                {isExpanded && (
                  <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                    {category.items.map((item) => (
                      <DraggableCatalogItem
                        key={item.type}
                        type={item.type}
                        label={item.label}
                        iconName={item.icon}
                        onAddBlock={onAddBlock}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
