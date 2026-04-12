import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, LayoutTemplate, ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LPBlockRenderer } from './LPBlockRenderer';
import type { LPBlock } from './lp-editor-types';

export const CANVAS_DROPPABLE_ID = 'lp-canvas-drop-zone';

interface LPEditorCanvasProps {
  blocks: LPBlock[];
  selectedBlockId: string | null;
  selectedColumnIndex: number | null;
  onSelectBlock: (id: string | null) => void;
  onSelectColumn: (colIndex: number | null) => void;
  onReorderBlocks: (blocks: LPBlock[]) => void;
  previewMode: 'desktop' | 'tablet' | 'mobile';
  onMoveBlock: (blockId: string, direction: 'up' | 'down') => void;
  onDeleteBlock: (blockId: string) => void;
}

function SortableBlock({
  block,
  selected,
  selectedColumnIndex,
  onSelect,
  onSelectColumn,
  onMoveUp,
  onMoveDown,
  onDelete,
}: {
  block: LPBlock;
  selected: boolean;
  selectedColumnIndex: number | null;
  onSelect: () => void;
  onSelectColumn: (i: number) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <div
        {...attributes}
        {...listeners}
        className="absolute -left-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity z-10"
      >
        <GripVertical className="w-4 h-4 text-muted-foreground" />
      </div>
      {/* Block controls — visible on hover */}
      <div className="absolute -right-10 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1 z-10">
        <button onClick={(e) => { e.stopPropagation(); onMoveUp(); }} className="w-7 h-7 rounded bg-card border flex items-center justify-center text-muted-foreground hover:text-foreground">
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onMoveDown(); }} className="w-7 h-7 rounded bg-card border flex items-center justify-center text-muted-foreground hover:text-foreground">
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="w-7 h-7 rounded bg-card border flex items-center justify-center text-muted-foreground hover:text-destructive">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <LPBlockRenderer block={block} selected={selected} selectedColumnIndex={selected ? selectedColumnIndex : null} onClick={onSelect} onClickColumn={onSelectColumn} />
    </div>
  );
}

export default function LPEditorCanvas({
  blocks,
  selectedBlockId,
  selectedColumnIndex,
  onSelectBlock,
  onSelectColumn,
  onReorderBlocks,
  previewMode,
  onMoveBlock,
  onDeleteBlock,
}: LPEditorCanvasProps) {
  const blockIds = blocks.map((b) => b.id);

  const { setNodeRef, isOver } = useDroppable({ id: CANVAS_DROPPABLE_ID });

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onSelectBlock(null);
    }
  };

  const canvasWidthClass = {
    desktop: 'max-w-3xl',
    tablet: 'max-w-md',
    mobile: 'max-w-xs',
  }[previewMode];

  return (
    <div
      className="flex-1 bg-muted/30 overflow-y-auto p-8"
      onClick={handleCanvasClick}
    >
      <div
        ref={setNodeRef}
        className={cn(
          canvasWidthClass,
          'mx-auto bg-white min-h-[600px] rounded-lg shadow relative transition-all',
          isOver && 'ring-2 ring-primary ring-dashed',
        )}
        onClick={handleCanvasClick}
      >
        {blocks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[600px] text-muted-foreground">
            <div className={cn(
              'rounded-xl border-2 border-dashed p-12 flex flex-col items-center gap-4 transition-colors',
              isOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25',
            )}>
              <LayoutTemplate className={cn('w-12 h-12', isOver ? 'text-primary' : 'text-muted-foreground/40')} />
              <p className="text-sm text-center max-w-[240px]">
                {isOver ? 'Solte aqui para adicionar' : 'Arraste módulos da barra lateral ou clique para adicionar'}
              </p>
            </div>
          </div>
        ) : (
          <SortableContext items={blockIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-0">
              {blocks.map((block) => (
                <SortableBlock
                  key={block.id}
                  block={block}
                  selected={block.id === selectedBlockId}
                  selectedColumnIndex={block.id === selectedBlockId ? selectedColumnIndex : null}
                  onSelect={() => onSelectBlock(block.id)}
                  onSelectColumn={(i) => { onSelectBlock(block.id); onSelectColumn(i); }}
                  onMoveUp={() => onMoveBlock(block.id, 'up')}
                  onMoveDown={() => onMoveBlock(block.id, 'down')}
                  onDelete={() => onDeleteBlock(block.id)}
                />
              ))}
              {/* Drop indicator at bottom when dragging over */}
              {isOver && blocks.length > 0 && (
                <div className="h-1 bg-primary rounded-full animate-pulse" />
              )}
            </div>
          </SortableContext>
        )}
      </div>
    </div>
  );
}

export { arrayMove };
export type { LPEditorCanvasProps };
