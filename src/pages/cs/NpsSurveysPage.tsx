import { Star } from 'lucide-react';

export default function NpsSurveysPage() {
  return (
    <div className="page-container animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold">Pesquisas NPS</h1>
          <p className="text-sm text-muted-foreground">Meça a satisfação e lealdade dos seus clientes</p>
        </div>
      </div>
      <div className="glass-card p-12 flex flex-col items-center justify-center text-center">
        <Star className="w-12 h-12 text-muted-foreground/40 mb-4" />
        <h3 className="text-lg font-semibold mb-1">Pesquisas NPS</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Envie pesquisas NPS, acompanhe promotores, neutros e detratores, e tome ações baseadas em feedback.
        </p>
      </div>
    </div>
  );
}
