import { Megaphone } from 'lucide-react';

export default function CampaignsPage() {
  return (
    <div className="page-container animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold">Campanhas</h1>
          <p className="text-sm text-muted-foreground">Gerencie suas campanhas de marketing</p>
        </div>
      </div>
      <div className="glass-card p-12 flex flex-col items-center justify-center text-center">
        <Megaphone className="w-12 h-12 text-muted-foreground/40 mb-4" />
        <h3 className="text-lg font-semibold mb-1">Campanhas de Marketing</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Crie, gerencie e acompanhe suas campanhas de marketing multicanal. Acompanhe resultados em tempo real.
        </p>
      </div>
    </div>
  );
}
