import { Rocket } from 'lucide-react';

export default function OnboardingPage() {
  return (
    <div className="page-container animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold">Onboarding</h1>
          <p className="text-sm text-muted-foreground">Gerencie a jornada de ativação dos clientes</p>
        </div>
      </div>
      <div className="glass-card p-12 flex flex-col items-center justify-center text-center">
        <Rocket className="w-12 h-12 text-muted-foreground/40 mb-4" />
        <h3 className="text-lg font-semibold mb-1">Onboarding</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Crie playbooks de onboarding, acompanhe marcos de ativação e garanta o sucesso na implantação.
        </p>
      </div>
    </div>
  );
}
