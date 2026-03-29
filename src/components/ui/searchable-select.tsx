import { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SearchableOption {
  value: string;
  label: string;
  sub?: string;
}

interface SearchableSelectProps {
  options: SearchableOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  size?: 'sm' | 'md';
  allowClear?: boolean;
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Selecione...',
  searchPlaceholder = 'Pesquisar...',
  className,
  size = 'md',
  allowClear = false,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find(o => o.value === value);

  const filtered = options.filter(o =>
    !search ||
    o.label.toLowerCase().includes(search.toLowerCase()) ||
    (o.sub && o.sub.toLowerCase().includes(search.toLowerCase()))
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (open) {
      setSearch('');
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const h = size === 'sm' ? 'h-7 text-[10px]' : 'h-9 text-xs';

  return (
    <div ref={ref} className={cn('relative', className)}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'w-full flex items-center gap-2 bg-secondary border border-border rounded-lg px-3 text-foreground outline-none focus:border-primary/50 cursor-pointer',
          h
        )}
      >
        <span className="flex-1 text-left truncate">
          {selected ? selected.label : <span className="text-muted-foreground">{placeholder}</span>}
        </span>
        {allowClear && value ? (
          <X
            className="w-3 h-3 text-muted-foreground hover:text-foreground flex-shrink-0"
            onClick={e => { e.stopPropagation(); onChange(''); }}
          />
        ) : (
          <ChevronDown className={cn('w-3 h-3 text-muted-foreground flex-shrink-0 transition-transform', open && 'rotate-180')} />
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[220px] bg-card border border-border rounded-lg shadow-xl overflow-hidden">
          {/* Search input */}
          <div className="p-1.5 border-b border-border">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={inputRef}
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className={cn('w-full bg-secondary border border-border rounded-md pl-7 pr-2 outline-none focus:border-primary/50', h)}
              />
            </div>
          </div>

          {/* Options list */}
          <div className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-3">Nenhum resultado</p>
            )}
            {filtered.map(o => (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false); }}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-muted/60',
                  size === 'sm' ? 'text-[10px]' : 'text-xs',
                  o.value === value && 'bg-primary/10 text-primary'
                )}
              >
                <div className="flex-1 min-w-0">
                  <span className="truncate block">{o.label}</span>
                  {o.sub && <span className="text-muted-foreground truncate block text-[10px]">{o.sub}</span>}
                </div>
                {o.value === value && <Check className="w-3 h-3 flex-shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
