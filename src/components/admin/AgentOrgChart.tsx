import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, DollarSign, Clock, Users, Gem, Sparkles, Loader2, RefreshCw } from 'lucide-react';
import { useAppConfig } from '@/contexts/AppConfigContext';
import { callOpenAI } from '@/lib/openaiProxy';
import { useToast } from '@/hooks/use-toast';

/* ── Types ──────────────────────────────────────────────── */
interface Agent {
  id: string;
  name: string;
  icon: string;
  title: string;
  cargo: string; // Diretor, Gerente, Supervisor, Analista, Especialista
}

interface OrgNode {
  agent: Agent;
  children?: OrgNode[];
  tierLabel?: string;
}

/* ── Org Chart CSS ──────────────────────────────────────── */
const treeStyles = `
.org-tree { display: flex; flex-direction: column; align-items: center; }
.org-tree ul { display: flex; gap: 0; justify-content: center; padding-top: 20px; position: relative; }
.org-tree ul::before {
  content: ''; position: absolute; top: 0; left: 50%; border-left: 1.5px solid hsl(var(--border)/0.5);
  height: 20px; width: 0;
}
.org-tree li {
  display: flex; flex-direction: column; align-items: center; position: relative;
  padding: 0 6px;
}
.org-tree li::before, .org-tree li::after {
  content: ''; position: absolute; top: 0; border-top: 1.5px solid hsl(var(--border)/0.5);
  width: 50%; height: 20px;
}
.org-tree li::before { left: 0; border-right: 1.5px solid hsl(var(--border)/0.5); }
.org-tree li::after { right: 0; border-left: none; }
.org-tree li:first-child::before { border: 0; }
.org-tree li:last-child::after { border: 0; }
.org-tree li:only-child::before, .org-tree li:only-child::after { border: 0; }
.org-tree li:only-child { padding-top: 20px; }
.org-tree li:only-child::before { border-left: 1.5px solid hsl(var(--border)/0.5); height: 20px; width: 0; left: 50%; }
.org-tree li:first-child::after { border-top: 1.5px solid hsl(var(--border)/0.5); }
.org-tree li:last-child::before { border-top: 1.5px solid hsl(var(--border)/0.5); border-right: 1.5px solid hsl(var(--border)/0.5); }
`;

/* ── Data ───────────────────────────────────────────────── */
const AIOX_ORG: OrgNode = {
  agent: { id: 'aiox-master', name: 'Orion', icon: '👑', title: 'Master Orchestrator', cargo: 'CEO / Diretor' },
  children: [
    {
      agent: { id: 'pm', name: 'Morgan', icon: '📋', title: 'Product Manager', cargo: 'Gerente de Produto' },
      children: [
        { agent: { id: 'po', name: 'Pax', icon: '🎯', title: 'Product Owner', cargo: 'Supervisor' } },
        { agent: { id: 'sm', name: 'River', icon: '🌊', title: 'Scrum Master', cargo: 'Supervisor' } },
        { agent: { id: 'analyst', name: 'Atlas', icon: '🔍', title: 'Business Analyst', cargo: 'Analista' } },
      ],
    },
    {
      agent: { id: 'architect', name: 'Aria', icon: '🏛️', title: 'System Architect', cargo: 'Gerente Técnico' },
      children: [
        { agent: { id: 'dev', name: 'Dex', icon: '💻', title: 'Full Stack Dev', cargo: 'Desenvolvedor Sênior' } },
        { agent: { id: 'data-engineer', name: 'Dara', icon: '📊', title: 'Database Architect', cargo: 'Especialista' } },
        { agent: { id: 'ux-design-expert', name: 'Uma', icon: '🎨', title: 'UX/UI Designer', cargo: 'Especialista' } },
      ],
    },
    {
      agent: { id: 'qa', name: 'Quinn', icon: '✅', title: 'Test Architect', cargo: 'Gerente de Qualidade' },
      children: [
        { agent: { id: 'devops', name: 'Gage', icon: '⚡', title: 'DevOps Engineer', cargo: 'Especialista' } },
        { agent: { id: 'squad-creator', name: 'Craft', icon: '🏗️', title: 'Squad Creator', cargo: 'Especialista' } },
      ],
    },
  ],
};

const SALES_ORG: OrgNode = {
  agent: { id: 'coach', name: 'Coach', icon: '🎯', title: 'Sales Coach', cargo: 'Diretor Comercial' },
  children: [
    {
      agent: { id: 'sandler', name: 'Sandler', icon: '🔱', title: 'Sandler Selling', cargo: 'Gerente' },
      children: [
        { agent: { id: 'spin', name: 'SPIN', icon: '🌀', title: 'SPIN Selling', cargo: 'Supervisor' } },
        { agent: { id: 'meddic', name: 'MEDDIC', icon: '📊', title: 'MEDDIC', cargo: 'Supervisor' } },
      ],
    },
    {
      agent: { id: 'challenger', name: 'Challenger', icon: '⚡', title: 'Challenger Sale', cargo: 'Gerente' },
      children: [
        { agent: { id: 'gap', name: 'Gap', icon: '🔍', title: 'Gap Selling', cargo: 'Supervisor' } },
        { agent: { id: 'spiced', name: 'SPICED', icon: '🌶️', title: 'SPICED', cargo: 'Supervisor' } },
      ],
    },
    {
      agent: { id: 'value-selling', name: 'Value', icon: '💎', title: 'Value Selling', cargo: 'Coordenador' },
      children: [
        { agent: { id: 'command', name: 'Command', icon: '🎤', title: 'Command of Message', cargo: 'Analista' } },
        { agent: { id: 'miller-heiman', name: 'Miller Heiman', icon: '🗺️', title: 'Strategic Selling', cargo: 'Analista' } },
        { agent: { id: 'bant', name: 'BANT', icon: '✅', title: 'BANT', cargo: 'Analista' } },
        { agent: { id: 'neat', name: 'NEAT', icon: '🎯', title: 'NEAT', cargo: 'Analista' } },
        { agent: { id: 'snap', name: 'SNAP', icon: '⚡', title: 'SNAP', cargo: 'Analista' } },
      ],
    },
  ],
};

const SECURITY_ORG: OrgNode = {
  agent: { id: 'security-architect', name: 'Sentinel', icon: '🧠', title: 'Security Architect', cargo: 'Diretor de Segurança' },
  children: [
    {
      agent: { id: 'appsec-engineer', name: 'Shield', icon: '🛡️', title: 'AppSec Engineer', cargo: 'Gerente' },
      children: [
        { agent: { id: 'red-team', name: 'Blade', icon: '⚔️', title: 'Red Team', cargo: 'Especialista' } },
        { agent: { id: 'iam-specialist', name: 'Gatekeeper', icon: '🔐', title: 'IAM Specialist', cargo: 'Especialista' } },
      ],
    },
    {
      agent: { id: 'devsecops', name: 'Forge', icon: '⚙️', title: 'DevSecOps', cargo: 'Gerente' },
      children: [
        { agent: { id: 'incident-responder', name: 'Vigil', icon: '🔍', title: 'Incident Responder', cargo: 'Especialista' } },
        { agent: { id: 'compliance-lgpd', name: 'Guardian', icon: '📊', title: 'Compliance LGPD', cargo: 'Especialista' } },
      ],
    },
  ],
};

/* ── Cargo badge colors ─────────────────────────────────── */
const CARGO_COLORS: Record<string, string> = {
  'CEO / Diretor': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  'Diretor Comercial': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  'Diretor de Segurança': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  'Gerente de Produto': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'Gerente Técnico': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'Gerente de Qualidade': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'Gerente': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'Coordenador': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  'Supervisor': 'bg-green-500/20 text-green-400 border-green-500/30',
  'Desenvolvedor Sênior': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  'Especialista': 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  'Analista': 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

/* ── Org Chart Node ─────────────────────────────────────── */
function OrgCard({ agent }: { agent: Agent }) {
  const cargoColor = CARGO_COLORS[agent.cargo] || 'bg-muted text-muted-foreground border-border';
  return (
    <div className="flex flex-col items-center gap-1 p-2.5 rounded-xl border border-border/60 bg-card/90 backdrop-blur-sm min-w-[120px] max-w-[140px] hover:border-primary/40 hover:shadow-md hover:shadow-primary/5 transition-all">
      <span className="text-xl">{agent.icon}</span>
      <span className="text-xs font-bold text-center leading-tight">{agent.name}</span>
      <span className="text-[9px] text-muted-foreground text-center leading-tight">{agent.title}</span>
      <Badge variant="outline" className={cn('text-[8px] h-4 px-1.5 mt-0.5', cargoColor)}>{agent.cargo}</Badge>
    </div>
  );
}

function OrgTreeNode({ node }: { node: OrgNode }) {
  return (
    <div className="org-tree">
      <OrgCard agent={node.agent} />
      {node.children && node.children.length > 0 && (
        <ul>
          {node.children.map(child => (
            <li key={child.agent.id}>
              <OrgTreeNode node={child} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ── Estimation with AI ─────────────────────────────────── */
interface Estimates {
  cost: { label: string; min: number; max: number }[];
  timeline: { label: string; months: string; people: string; highlight?: boolean }[];
  saas: { label: string; min: number; max: number }[];
  updatedAt: string;
  aiGenerated: boolean;
}

const DEFAULT_ESTIMATES: Estimates = {
  cost: [
    { label: 'Desenvolvimento', min: 380_000, max: 520_000 },
    { label: 'UI/UX Design', min: 45_000, max: 80_000 },
    { label: 'Infraestrutura (12 meses)', min: 12_000, max: 24_000 },
    { label: 'IA / OpenAI (12 meses)', min: 18_000, max: 36_000 },
    { label: 'Total Estimado', min: 455_000, max: 660_000 },
  ],
  timeline: [
    { label: 'Time tradicional', months: '8–12', people: '4–6' },
    { label: 'Com AIOX + Claude', months: '2–3', people: '1–2', highlight: true },
  ],
  saas: [
    { label: 'MRR (50–150 clientes)', min: 15_000, max: 45_000 },
    { label: 'ARR projetado', min: 180_000, max: 540_000 },
    { label: 'Valuation (10x ARR)', min: 1_800_000, max: 5_400_000 },
  ],
  updatedAt: new Date().toLocaleDateString('pt-BR'),
  aiGenerated: false,
};

const STORAGE_KEY = 'sdcoach_project_estimates';

function loadEstimates(): Estimates {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEFAULT_ESTIMATES;
}

function saveEstimates(e: Estimates) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(e));
}

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

/* ── Main Component ─────────────────────────────────────── */
export default function AgentOrgChart() {
  const [estimates, setEstimates] = useState<Estimates>(loadEstimates);
  const [generating, setGenerating] = useState(false);
  const [expandedSquads, setExpandedSquads] = useState<Record<string, boolean>>({ aiox: true, sales: true, security: true });
  const { tokens } = useAppConfig();
  const { toast } = useToast();

  const toggleSquad = (id: string) => setExpandedSquads(p => ({ ...p, [id]: !p[id] }));

  const generateEstimates = async () => {
    const token = tokens.meetings || tokens.whatsapp || tokens.training;
    if (!token) {
      toast({ variant: 'destructive', title: 'Token OpenAI não configurado', description: 'Configure um token em Config. IA para usar esta funcionalidade.' });
      return;
    }
    setGenerating(true);
    try {
      const prompt = `Analise este projeto SaaS e gere estimativas atualizadas em JSON.

Projeto: Smart Deal Coach — SaaS de coaching de vendas com IA para empresas.
Stack: React 18 + TypeScript + Vite + Tailwind + Supabase (PostgreSQL + Edge Functions + Storage + RLS)
Integrações: WhatsApp (Evolution API + Meta WABA), Google Meet, OpenAI (gpt-4o-mini)
Dados: ~85.000 linhas de código, 17 páginas, 8 edge functions, 14 migrations SQL, 32 agentes IA
Features: CRM completo, avaliação multi-agente de vendas, inbox WhatsApp, multi-tenant, hierarquia RBAC
Deploy: Lovable (auto-deploy via git push)

Retorne APENAS um JSON válido (sem markdown, sem texto extra) neste formato exato:
{
  "cost": [
    {"label":"Desenvolvimento","min":NUMBER,"max":NUMBER},
    {"label":"UI/UX Design","min":NUMBER,"max":NUMBER},
    {"label":"Infraestrutura (12 meses)","min":NUMBER,"max":NUMBER},
    {"label":"IA / OpenAI (12 meses)","min":NUMBER,"max":NUMBER},
    {"label":"Total Estimado","min":NUMBER,"max":NUMBER}
  ],
  "timeline": [
    {"label":"Time tradicional","months":"X–Y","people":"X–Y"},
    {"label":"Com AIOX + Claude","months":"X–Y","people":"X–Y","highlight":true}
  ],
  "saas": [
    {"label":"MRR (50–150 clientes)","min":NUMBER,"max":NUMBER},
    {"label":"ARR projetado","min":NUMBER,"max":NUMBER},
    {"label":"Valuation (10x ARR)","min":NUMBER,"max":NUMBER}
  ]
}

Valores em BRL. Considere: devs sênior R$ 25–35k/mês, designer UX R$ 15–20k/mês, Supabase Pro ~R$ 150/mês, OpenAI ~R$ 1.500–3.000/mês. Valuation: 10x ARR para SaaS early-stage.`;

      const result = await callOpenAI(token, {
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 1000,
      });

      const content = result?.choices?.[0]?.message?.content || result?.content || '';
      const jsonStr = typeof content === 'string' ? content.replace(/```json?\n?/g, '').replace(/```/g, '').trim() : JSON.stringify(content);
      const parsed = JSON.parse(jsonStr);

      const newEstimates: Estimates = {
        cost: parsed.cost,
        timeline: parsed.timeline,
        saas: parsed.saas,
        updatedAt: new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        aiGenerated: true,
      };
      setEstimates(newEstimates);
      saveEstimates(newEstimates);
      toast({ title: 'Estimativas atualizadas com IA!' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao gerar estimativas', description: e.message });
    } finally {
      setGenerating(false);
    }
  };

  const squads = [
    { id: 'aiox', label: 'AIOX Core — Desenvolvimento', icon: '👑', color: 'from-primary/10 to-accent/10 border-primary/30', org: AIOX_ORG, count: 12 },
    { id: 'sales', label: 'Squad Vendas — Metodologias', icon: '🎯', color: 'from-purple-500/15 to-violet-500/15 border-purple-500/30', org: SALES_ORG, count: 13 },
    { id: 'security', label: 'Squad Segurança — AppSec', icon: '🛡️', color: 'from-red-500/15 to-orange-500/15 border-red-500/30', org: SECURITY_ORG, count: 7 },
  ];

  return (
    <div className="space-y-6">
      <style>{treeStyles}</style>

      {/* Header */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">👑</span>
              <h2 className="font-display font-semibold text-lg">Organograma de Agentes</h2>
            </div>
            <p className="text-xs text-muted-foreground">32 agentes de IA organizados em hierarquia com cargos e responsabilidades.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {Object.entries(CARGO_COLORS).slice(0, 6).map(([cargo, color]) => (
            <Badge key={cargo} variant="outline" className={cn('text-[9px] h-4', color)}>{cargo}</Badge>
          ))}
        </div>
      </div>

      {/* Org Charts */}
      {squads.map(sq => (
        <div key={sq.id} className={cn('rounded-2xl border bg-gradient-to-br p-4', sq.color)}>
          <button onClick={() => toggleSquad(sq.id)} className="w-full flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">{sq.icon}</span>
              <h3 className="font-display font-semibold text-sm">{sq.label}</h3>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] h-5">{sq.count} agentes</Badge>
              {expandedSquads[sq.id] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </div>
          </button>
          {expandedSquads[sq.id] && (
            <div className="overflow-x-auto pb-4">
              <div className="min-w-fit flex justify-center">
                <OrgTreeNode node={sq.org} />
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Estimativas */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Gem className="w-4 h-4 text-primary" />
            <h2 className="font-display font-semibold text-lg">Estimativa do Projeto</h2>
            {estimates.aiGenerated && (
              <Badge className="text-[9px] h-4 bg-primary/20 text-primary border-primary/30 gap-1">
                <Sparkles className="w-2.5 h-2.5" /> IA
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">Atualizado: {estimates.updatedAt}</span>
            <Button size="sm" variant="outline" className="text-xs h-7 gap-1.5" onClick={generateEstimates} disabled={generating}>
              {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              {generating ? 'Gerando...' : 'Atualizar com IA'}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {/* Cost */}
          <div className="glass-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-500" />
              <h3 className="font-semibold text-sm">Custo de Desenvolvimento</h3>
            </div>
            <div className="space-y-2">
              {estimates.cost.map((item, i) => {
                const isTotal = item.label.includes('Total');
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

          {/* Timeline */}
          <div className="glass-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-500" />
              <h3 className="font-semibold text-sm">Prazo & Equipe</h3>
            </div>
            <div className="space-y-3">
              {estimates.timeline.map((t, i) => (
                <div key={i} className={cn('p-3 rounded-lg border', t.highlight ? 'bg-primary/5 border-primary/30' : 'bg-muted/30 border-border/40')}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium">{t.label}</span>
                    {t.highlight && <Badge className="text-[9px] h-4 bg-primary/20 text-primary border-primary/30">Atual</Badge>}
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
          <div className="glass-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Gem className="w-4 h-4 text-purple-500" />
              <h3 className="font-semibold text-sm">Valor como SaaS</h3>
            </div>
            <div className="space-y-2">
              {estimates.saas.map((item, i) => {
                const isHighlight = item.label.includes('Valuation');
                return (
                  <div key={i} className={cn('flex items-center justify-between', isHighlight && 'pt-2 border-t border-border/40')}>
                    <span className={cn('text-xs', isHighlight ? 'font-semibold' : 'text-muted-foreground')}>{item.label}</span>
                    <span className={cn('text-xs font-mono', isHighlight ? 'font-bold text-primary' : 'font-medium')}>
                      {formatBRL(item.min)} – {formatBRL(item.max)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-4 p-3 rounded-lg bg-muted/30 border border-border/40">
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            <strong>Metodologia:</strong> Estimativas baseadas em benchmarks de mercado para SaaS B2B com IA.
            Custo considera devs sênior (R$ 25–35k/mês), designer UX (R$ 15–20k/mês), infra Supabase Pro + OpenAI.
            Valuation usa múltiplo 10x ARR (padrão SaaS early-stage). O código tem ~85.000 linhas, 32 agentes de IA e 17 páginas.
            {estimates.aiGenerated && ' Valores gerados por IA e podem variar.'}
          </p>
        </div>
      </div>
    </div>
  );
}
