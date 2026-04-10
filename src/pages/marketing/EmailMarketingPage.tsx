import { Mail } from 'lucide-react';

export default function EmailMarketingPage() {
  return (
    <div className="page-container animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold">E-mail Marketing</h1>
          <p className="text-sm text-muted-foreground">Crie e envie campanhas de e-mail</p>
        </div>
      </div>
      <div className="glass-card p-12 flex flex-col items-center justify-center text-center">
        <Mail className="w-12 h-12 text-muted-foreground/40 mb-4" />
        <h3 className="text-lg font-semibold mb-1">E-mail Marketing</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Crie templates, segmente listas e dispare campanhas de e-mail com acompanhamento de abertura e cliques.
        </p>
      </div>
    </div>
  );
}
