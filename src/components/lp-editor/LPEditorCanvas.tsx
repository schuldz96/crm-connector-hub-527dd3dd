import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, LayoutTemplate } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LPBlockRenderer } from './LPBlockRenderer';
import type { LPBlock } from './lp-editor-types';

interface LPEditorCanvasProps {
  blocks: LPBlock[];
  selectedBlockId: string | null;
  onSelectBlock: (id: string | null) => void;
  onReorderBlocks: (blocks: LPBlock[]) => void;
}

function SortableBlock({
  block,
  selected,
  onSelect,
}: {
  block: LPBlock;
  selected: boolean;
  onSelect: () => void;
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
      <LPBlockRenderer block={block} selected={selected} onClick={onSelect} />
    </div>
  );
}

export default function LPEditorCanvas({
  blocks,
  selectedBlockId,
  onSelectBlock,
  onReorderBlocks,
}: LPEditorCanvasProps) {
  const blockIds = blocks.map((b) => b.id);

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onSelectBlock(null);
    }
  };

  return (
    <div
      className="flex-1 bg-muted/30 overflow-y-auto p-8"
      onClick={handleCanvasClick}
    >
      <div
        className="max-w-3xl mx-auto bg-white min-h-[600px] rounded-lg shadow relative"
        onClick={handleCanvasClick}
      >
        {blocks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[600px] text-muted-foreground">
            <div className="rounded-xl border-2 border-dashed border-muted-foreground/25 p-12 flex flex-col items-center gap-4">
              <LayoutTemplate className="w-12 h-12 text-muted-foreground/40" />
              <p className="text-sm text-center max-w-[240px]">
                Arraste modulos da barra lateral ou clique para adicionar
              </p>
            </div>
          </div>
        ) : (
          <SortableContext items={blockIds} strategy={verticalListSortingStrategy}>
            <div className="p-6 space-y-2">
              {blocks.map((block) => (
                <SortableBlock
                  key={block.id}
                  block={block}
                  selected={block.id === selectedBlockId}
                  onSelect={() => onSelectBlock(block.id)}
                />
              ))}
            </div>
          </SortableContext>
        )}
      </div>
    </div>
  );
}

export { arrayMove };
export type { LPEditorCanvasProps };
