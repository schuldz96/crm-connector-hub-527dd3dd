import { cn } from '@/lib/utils';
import { useAppConfig } from '@/contexts/AppConfigContext';

interface BrandLogoProps {
  compact?: boolean;
  className?: string;
}

export default function BrandLogo({ compact = false, className }: BrandLogoProps) {
  const { companySubtitle } = useAppConfig();

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <img
        src="/appmax-favicon.png"
        alt="LTX"
        className={cn(
          'rounded-xl object-cover shadow-lg shadow-primary/20',
          compact ? 'w-8 h-8' : 'w-10 h-10'
        )}
      />
      {!compact && (
        <div className="min-w-0">
          <p className="font-display text-base font-bold leading-none tracking-tight text-foreground">LTX</p>
        </div>
      )}
    </div>
  );
}
