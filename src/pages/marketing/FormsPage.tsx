import { FileText } from 'lucide-react';

export default function FormsPage() {
  return (
    <div className="page-container animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold">Formulários</h1>
          <p className="text-sm text-muted-foreground">Capture leads com formulários personalizados</p>
        </div>
      </div>
      <div className="glass-card p-12 flex flex-col items-center justify-center text-center">
        <FileText className="w-12 h-12 text-muted-foreground/40 mb-4" />
        <h3 className="text-lg font-semibold mb-1">Formulários</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Crie formulários de captura de leads, integre com o CRM e acompanhe conversões em tempo real.
        </p>
      </div>
    </div>
  );
}
