import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, DollarSign, Clock, Users, Gem } from 'lucide-react';

/* ── Agent data ─────────────────────────────────────────── */
interface Agent {
  id: string;
  name: string;
  icon: string;
  title: string;
  role: string;
}

interface Squad {
  id: string;
  name: string;
  icon: string;
  description: string;
  color: string;
  leader: Agent;
  tiers?: { name: string; agents: Agent[] }[];
  agents?: Agent[];
}

const AIOX_CORE: Agent[] = [
  { id: 'aiox-master', name: 'Orion', icon: '👑', title: 'Master Orchestrator', role: 'Orquestração geral e framework' },
  { id: 'dev', name: 'Dex', icon: '💻', title: 'Full Stack Developer', role: 'Implementação de código' },
  { id: 'architect', name: 'Aria', icon: '🏛️', title: 'System Architect', role: 'Arquitetura e design técnico' },
  { id: 'qa', name: 'Quinn', icon: '✅', title: 'Test Architect', role: 'Qualidade e testes' },
  { id: 'pm', name: 'Morgan', icon: '📋', title: 'Product Manager', role: 'Requisitos e estratégia de produto' },
  { id: 'po', name: 'Pax', icon: '🎯', title: 'Product Owner', role: 'Validação de stories e backlog' },
  { id: 'sm', name: 'River', icon: '🌊', title: 'Scrum Master', role: 'Criação de stories e facilitação' },
  { id: 'analyst', name: 'Atlas', icon: '🔍', title: 'Business Analyst', role: 'Pesquisa e análise estratégica' },
  { id: 'data-engineer', name: 'Dara', icon: '📊', title: 'Database Architect', role: 'Schema, migrations e RLS' },
  { id: 'devops', name: 'Gage', icon: '⚡', title: 'DevOps Engineer', role: 'CI/CD, deploy e git push' },
  { id: 'ux-design-expert', name: 'Uma', icon: '🎨', title: 'UX/UI Designer', role: 'Design system e usabilidade' },
  { id: 'squad-creator', name: 'Craft', icon: '🏗️', title: 'Squad Creator', role: 'Criação e gestão de squads' },
];

const SQUADS: Squad[] = [
  {
    id: 'framework',
    name: 'Metodologias de Vendas',
    icon: '🎯',
    description: 'Avaliação de reuniões, WhatsApp e ligações com metodologias de vendas',
    color: 'from-purple-500/20 to-violet-500/20 border-purple-500/30',
    leader: { id: 'coach', name: 'Coach', icon: '🎯', title: 'Sales Coach', role: 'Orquestrador de avaliações' },
    tiers: [
      {
        name: 'Core',
        agents: [
          { id: 'sandler', name: 'Sandler', icon: '🔱', title: 'Sandler Selling', role: 'Pain funnel e qualificação' },
          { id: 'spin', name: 'SPIN', icon: '🌀', title: 'SPIN Selling', role: 'Situation, Problem, Implication, Need' },
          { id: 'meddic', name: 'MEDDIC', icon: '📊', title: 'MEDDIC/MEDDPICC', role: 'Qualificação enterprise' },
          { id: 'challenger', name: 'Challenger', icon: '⚡', title: 'Challenger Sale', role: 'Ensinar, personalizar, controlar' },
          { id: 'gap', name: 'Gap', icon: '🔍', title: 'Gap Selling', role: 'Estado atual vs. futuro desejado' },
          { id: 'spiced', name: 'SPICED', icon: '🌶️', title: 'SPICED', role: 'Winning by Design framework' },
        ],
      },
      {
        name: 'Complementar',
        agents: [
          { id: 'value-selling', name: 'Value', icon: '💎', title: 'Value Selling', role: 'Venda baseada em valor' },
          { id: 'command', name: 'Command', icon: '🎤', title: 'Command of Message', role: 'Controle da narrativa' },
          { id: 'miller-heiman', name: 'Miller Heiman', icon: '🗺️', title: 'Strategic Selling', role: 'Venda estratégica complexa' },
        ],
      },
      {
        name: 'Opcional',
        agents: [
          { id: 'bant', name: 'BANT', icon: '✅', title: 'BANT', role: 'Budget, Authority, Need, Timeline' },
          { id: 'neat', name: 'NEAT', icon: '🎯', title: 'NEAT Selling', role: 'Need, Economic impact, Access, Timeline' },
          { id: 'snap', name: 'SNAP', icon: '⚡', title: 'SNAP Selling', role: 'Simple, iNvaluable, Aligned, Priority' },
        ],
      },
    ],
  },
  {
    id: 'security',
    name: 'Segurança de Sistemas',
    icon: '🛡️',
    description: 'Threat modeling, pentesting, DevSecOps, compliance LGPD e resposta a incidentes',
    color: 'from-red-500/20 to-orange-500/20 border-red-500/30',
    leader: { id: 'security-architect', name: 'Sentinel', icon: '🧠', title: 'Security Architect', role: 'Visão estratégica e orquestração' },
    agents: [
      { id: 'appsec-engineer', name: 'Shield', icon: '🛡️', title: 'AppSec Engineer', role: 'Segurança do código e OWASP' },
      { id: 'red-team', name: 'Blade', icon: '⚔️', title: 'Red Team / Pentester', role: 'Ataque simulado e exploits' },
      { id: 'devsecops', name: 'Forge', icon: '⚙️', title: 'DevSecOps Engineer', role: 'Pipeline, secrets e infra' },
      { id: 'compliance-lgpd', name: 'Guardian', icon: '📊', title: 'Compliance LGPD', role: 'Governança e dados pessoais' },
      { id: 'incident-responder', name: 'Vigil', icon: '🔍', title: 'Incident Responder', role: 'Resposta a incidentes' },
      { id: 'iam-specialist', name: 'Gatekeeper', icon: '🔐', title: 'IAM Specialist', role: 'Identidade e acesso' },
    ],
  },
];

/* ── Project Estimation ─────────────────────────────────── */
const PROJECT_ESTIMATES = {
  totalAgents: 32,
  linesOfCode: '~85.000',
  pages: 17,
  edgeFunctions: 8,
  migrations: 14,
  cost: {
    development: { min: 380_000, max: 520_000, label: 'Desenvolvimento' },
    design: { min: 45_000, max: 80_000, label: 'UI/UX Design' },
    infrastructure: { min: 12_000, max: 24_000, label: 'Infraestrutura (12 meses)' },
    ai: { min: 18_000, max: 36_000, label: 'IA / OpenAI (12 meses)' },
    total: { min: 455_000, max: 660_000, label: 'Total Estimado' },
  },
  timeline: {
    withTeam: { months: '8–12', people: '4–6', label: 'Time tradicional' },
    withAiox: { months: '2–3', people: '1–2', label: 'Com AIOX + Claude' },
  },
  saasValue: {
    mrr: { min: 15_000, max: 45_000, label: 'MRR estimado (50–150 clientes)' },
    arr: { min: 180_000, max: 540_000, label: 'ARR projetado' },
    valuation: { min: 1_800_000, max: 5_400_000, label: 'Valuation (10x ARR)' },
  },
};

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

/* ── Components ─────────────────────────────────────────── */
function AgentCard({ agent, size = 'sm' }: { agent: Agent; size?: 'sm' | 'lg' }) {
  const isLg = size === 'lg';
  return (
    <div className={cn(
      'flex items-center gap-2 rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm transition-all hover:border-primary/40 hover:shadow-md hover:shadow-primary/5',
      isLg ? 'px-4 py-3' : 'px-3 py-2',
    )}>
      <span className={cn('shrink-0', isLg ? 'text-2xl' : 'text-lg')}>{agent.icon}</span>
      <div className="min-w-0">
        <div className={cn('font-semibold truncate', isLg ? 'text-sm' : 'text-xs')}>{agent.name}</div>
        <div className={cn('text-muted-foreground truncate', isLg ? 'text-xs' : 'text-[10px]')}>{agent.title}</div>
        {isLg && <div className="text-[10px] text-muted-foreground/70 truncate">{agent.role}</div>}
      </div>
    </div>
  );
}

function SquadSection({ squad }: { squad: Squad }) {
  const [open, setOpen] = useState(true);
  const agentCount = squad.tiers
    ? squad.tiers.reduce((sum, t) => sum + t.agents.length, 0) + 1
    : (squad.agents?.length || 0) + 1;

  return (
    <div className={cn('rounded-2xl border bg-gradient-to-br p-4', squad.color)}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{squad.icon}</span>
          <div className="text-left">
            <h3 className="font-display font-semibold text-sm">{squad.name}</h3>
            <p className="text-[10px] text-muted-foreground">{squad.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] h-5">{agentCount} agentes</Badge>
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>
      </button>

      {open && (
        <div className="space-y-3">
          {/* Leader */}
          <div className="flex flex-col items-center">
            <AgentCard agent={squad.leader} size="lg" />
            <div className="w-px h-3 bg-border/60" />
          </div>

          {/* Tiers or flat agents */}
          {squad.tiers ? (
            squad.tiers.map(tier => (
              <div key={tier.name}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-px flex-1 bg-border/40" />
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{tier.name}</span>
                  <div className="h-px flex-1 bg-border/40" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
                  {tier.agents.map(a => <AgentCard key={a.id} agent={a} />)}
                </div>
              </div>
            ))
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
              {squad.agents?.map(a => <AgentCard key={a.id} agent={a} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EstimateCard({ icon, title, items }: {
  icon: React.ReactNode;
  title: string;
  items: { label: string; min: number; max: number }[];
}) {
  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="font-semibold text-sm">{title}</h3>
      </div>
      <div className="space-y-2">
        {items.map((item, i) => {
          const isTotal = item.label.includes('Total') || item.label.includes('Valuation');
          return (
            <div key={i} className={cn('flex items-center justify-between', isTotal && 'pt-2 border-t border-border/40')}>
              <span className={cn('text-xs', isTotal ? 'font-semibold' : 'text-muted-foreground')}>{item.label}</span>
              <span className={cn('text-xs font-mono', isTotal ? 'font-bold text-primary' : 'font-medium')}>
                {formatBRL(item.min)} – {formatBRL(item.max)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Main Component ─────────────────────────────────────── */
export default function AgentOrgChart() {
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">👑</span>
          <h2 className="font-display font-semibold text-lg">Agentes & Projeto</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Organograma completo dos {PROJECT_ESTIMATES.totalAgents} agentes de IA, squads especializadas e estimativas do projeto.
        </p>
        <div className="flex flex-wrap gap-3 mt-3">
          <Badge variant="outline" className="text-[10px]">👑 {AIOX_CORE.length} agentes AIOX Core</Badge>
          <Badge variant="outline" className="text-[10px]">🎯 13 agentes Vendas</Badge>
          <Badge variant="outline" className="text-[10px]">🛡️ 7 agentes Segurança</Badge>
          <Badge variant="outline" className="text-[10px]">📄 {PROJECT_ESTIMATES.pages} páginas</Badge>
          <Badge variant="outline" className="text-[10px]">⚡ {PROJECT_ESTIMATES.edgeFunctions} edge functions</Badge>
          <Badge variant="outline" className="text-[10px]">🗄️ {PROJECT_ESTIMATES.migrations} migrations</Badge>
        </div>
      </div>

      {/* AIOX Core Agents */}
      <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-accent/10 p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">👑</span>
          <div>
            <h3 className="font-display font-semibold text-sm">AIOX Core — Sistema de Desenvolvimento</h3>
            <p className="text-[10px] text-muted-foreground">Agentes do framework de orquestração de IA</p>
          </div>
          <Badge variant="outline" className="text-[10px] h-5 ml-auto">{AIOX_CORE.length} agentes</Badge>
        </div>

        {/* Master at top */}
        <div className="flex flex-col items-center mb-3">
          <AgentCard agent={AIOX_CORE[0]} size="lg" />
          <div className="w-px h-3 bg-border/60" />
        </div>

        {/* Rest in grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
          {AIOX_CORE.slice(1).map(a => <AgentCard key={a.id} agent={a} />)}
        </div>
      </div>

      {/* Squads */}
      {SQUADS.map(s => <SquadSection key={s.id} squad={s} />)}

      {/* Project Estimation */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Gem className="w-4 h-4 text-primary" />
          <h2 className="font-display font-semibold text-lg">Estimativa do Projeto</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {/* Cost */}
          <EstimateCard
            icon={<DollarSign className="w-4 h-4 text-green-500" />}
            title="Custo de Desenvolvimento"
            items={Object.values(PROJECT_ESTIMATES.cost)}
          />

          {/* Timeline */}
          <div className="glass-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-500" />
              <h3 className="font-semibold text-sm">Prazo & Equipe</h3>
            </div>
            <div className="space-y-3">
              {Object.values(PROJECT_ESTIMATES.timeline).map((t, i) => (
                <div key={i} className={cn('p-3 rounded-lg border', i === 1 ? 'bg-primary/5 border-primary/30' : 'bg-muted/30 border-border/40')}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium">{t.label}</span>
                    {i === 1 && <Badge className="text-[9px] h-4 bg-primary/20 text-primary border-primary/30">Atual</Badge>}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-muted-foreground" />
                      <span className="text-sm font-bold">{t.months} meses</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="w-3 h-3 text-muted-foreground" />
                      <span className="text-sm font-bold">{t.people} pessoas</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SaaS Value */}
          <EstimateCard
            icon={<Gem className="w-4 h-4 text-purple-500" />}
            title="Valor como SaaS"
            items={Object.values(PROJECT_ESTIMATES.saasValue)}
          />
        </div>

        <div className="mt-4 p-3 rounded-lg bg-muted/30 border border-border/40">
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            <strong>Metodologia:</strong> Estimativas baseadas em benchmarks de mercado para SaaS B2B com IA.
            Custo considera desenvolvedores sênior (R$ 25–35k/mês), designer UX (R$ 15–20k/mês), infra Supabase Pro + OpenAI.
            Valuation usa múltiplo 10x ARR (padrão SaaS early-stage com crescimento).
            O código tem {PROJECT_ESTIMATES.linesOfCode} linhas, {PROJECT_ESTIMATES.totalAgents} agentes de IA e {PROJECT_ESTIMATES.pages} páginas funcionais.
          </p>
        </div>
      </div>
    </div>
  );
}
