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
      <div className={cn(
        'rounded-xl flex items-center justify-center font-display font-bold text-primary-foreground bg-gradient-to-br from-primary to-primary/70 shadow-lg shadow-primary/20',
        compact ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm'
      )}>
        LTX
      </div>
      {!compact && (
        <div className="min-w-0">
          <p className="font-display text-base font-bold leading-none tracking-tight text-foreground">LTX</p>
        </div>
      )}
    </div>
  );
}
