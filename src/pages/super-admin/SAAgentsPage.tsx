import AgentOrgChart from '@/components/admin/AgentOrgChart';

export default function SAAgentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Agentes & Projeto</h1>
        <p className="text-sm text-muted-foreground">Organograma de agentes e estrutura do projeto</p>
      </div>
      <AgentOrgChart />
    </div>
  );
}
