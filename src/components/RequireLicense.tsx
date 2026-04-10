/**
 * RequireLicense — Guard that blocks page rendering if the org's plan
 * does not include the required module/feature.
 *
 * Shows an upgrade prompt instead of the page content.
 *
 * Usage:
 *   <RequireLicense module="crm">
 *     <CRMContactsPage />
 *   </RequireLicense>
 */
import { useLicense } from '@/contexts/LicenseContext';
import { getDefaultRoute } from '@/contexts/AuthContext';
import { useAuth } from '@/contexts/AuthContext';
import { Lock, ArrowUpCircle, AlertTriangle, Clock } from 'lucide-react';

interface RequireLicenseProps {
  children: React.ReactNode;
  /** Module code to check (e.g. 'crm', 'whatsapp', 'campaigns') */
  module?: string;
}

export default function RequireLicense({ children, module }: RequireLicenseProps) {
  const { user } = useAuth();
  const license = useLicense();

  // Still loading — show nothing (avoids flash)
  if (!license.loaded) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-sm text-muted-foreground animate-pulse">Verificando licença...</span>
      </div>
    );
  }

  // No subscription at all → allow access (no license enforcement yet)
  if (!license.subscription) {
    return <>{children}</>;
  }

  // Subscription expired or cancelled
  if (license.isExpired) {
    return (
      <UpgradeScreen
        icon={<AlertTriangle className="w-8 h-8 text-destructive" />}
        title="Assinatura expirada"
        description="Sua assinatura expirou. Renove seu plano para continuar usando a plataforma."
        userRole={user?.role}
      />
    );
  }

  // Subscription suspended
  if (license.isSuspended) {
    return (
      <UpgradeScreen
        icon={<AlertTriangle className="w-8 h-8 text-warning" />}
        title="Assinatura suspensa"
        description="Sua assinatura está suspensa. Regularize o pagamento para reativar o acesso."
        userRole={user?.role}
      />
    );
  }

  // Trial warning — full plan trial
  const trialBanner = license.isTrial ? (
    <div className="bg-warning/10 border border-warning/30 rounded-lg px-4 py-2 mb-4 flex items-center gap-2">
      <Clock className="w-4 h-4 text-warning flex-shrink-0" />
      <span className="text-sm text-warning">
        Período de teste: <strong>{license.trialDaysLeft} dias restantes</strong>.
        Faça upgrade para manter o acesso.
      </span>
    </div>
  ) : null;

  // Module-level trial banner
  const moduleTrialBanner = module && license.isModuleOnTrial(module) ? (
    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg px-4 py-2 mb-4 flex items-center gap-2">
      <Clock className="w-4 h-4 text-blue-400 flex-shrink-0" />
      <span className="text-sm text-blue-400">
        Trial deste módulo: <strong>{license.moduleTrialDaysLeft(module)} dias restantes</strong>.
        Contrate para manter o acesso.
      </span>
    </div>
  ) : null;

  // Module check
  if (module && !license.canAccessModule(module)) {
    return (
      <UpgradeScreen
        icon={<Lock className="w-8 h-8 text-muted-foreground" />}
        title="Módulo não disponível"
        description={`O módulo "${module}" não está incluído no seu plano ${license.planName}. Faça upgrade para acessar este recurso.`}
        planName={license.planName}
        userRole={user?.role}
      />
    );
  }

  return (
    <>
      {trialBanner}
      {moduleTrialBanner}
      {children}
    </>
  );
}

// ─── Upgrade Screen ─────────────────────────────────────────────────────────────

function UpgradeScreen({
  icon,
  title,
  description,
  planName,
  userRole,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  planName?: string;
  userRole?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 p-8 animate-fade-in">
      <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center">
        {icon}
      </div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground text-center max-w-md">
        {description}
      </p>
      {planName && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
          Plano atual: {planName}
        </div>
      )}
      <div className="flex items-center gap-3 mt-2">
        <a
          href={getDefaultRoute(userRole as any)}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Voltar ao início
        </a>
        <a
          href="/admin?s=company"
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <ArrowUpCircle className="w-4 h-4" />
          Fazer upgrade
        </a>
      </div>
    </div>
  );
}
