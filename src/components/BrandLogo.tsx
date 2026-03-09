import { cn } from '@/lib/utils';

interface BrandLogoProps {
  compact?: boolean;
  className?: string;
}

export default function BrandLogo({ compact = false, className }: BrandLogoProps) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <img
        src="/appmax-favicon.png"
        alt="Appmax"
        className={cn(
          'rounded-xl object-cover shadow-lg shadow-primary/20',
          compact ? 'w-8 h-8' : 'w-10 h-10'
        )}
      />
      {!compact && (
        <div className="min-w-0">
          <p className="font-display text-base font-bold leading-none tracking-tight text-foreground">APPMAX</p>
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Revenue OS</p>
        </div>
      )}
    </div>
  );
}

