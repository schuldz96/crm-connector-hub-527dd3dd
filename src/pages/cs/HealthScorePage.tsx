import { HeartPulse } from 'lucide-react';

export default function HealthScorePage() {
  return (
    <div className="page-container animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold">Health Score</h1>
          <p className="text-sm text-muted-foreground">Monitore a saúde dos seus clientes</p>
        </div>
      </div>
      <div className="glass-card p-12 flex flex-col items-center justify-center text-center">
        <HeartPulse className="w-12 h-12 text-muted-foreground/40 mb-4" />
        <h3 className="text-lg font-semibold mb-1">Health Score</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Acompanhe indicadores de saúde do cliente, identifique riscos de churn e oportunidades de expansão.
        </p>
      </div>
    </div>
  );
}
