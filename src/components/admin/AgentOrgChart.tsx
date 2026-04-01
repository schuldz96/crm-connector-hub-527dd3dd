import { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DollarSign, Clock, Users, Gem, Sparkles, Loader2, RefreshCw, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { useAppConfig } from '@/contexts/AppConfigContext';
import { callOpenAI } from '@/lib/openaiProxy';
import { useToast } from '@/hooks/use-toast';

/* ── Types ──────────────────────────────────────────────── */
interface Agent {
  id: string;
  name: string;
  icon: string;
  title: string;
  cargo: string;
  dept?: string; // visual color hint
}

interface OrgNode {
  agent: Agent;
  children?: OrgNode[];
}

/* ── Tree CSS ───────────────────────────────────────────── */
const treeCSS = `
.otree{display:flex;flex-direction:column;align-items:center}
.otree ul{display:flex;justify-content:center;padding-top:20px;position:relative;list-style:none;margin:0;padding-left:0}
.otree ul::before{content:'';position:absolute;top:0;left:50%;border-left:1.5px solid hsl(var(--border)/0.4);height:20px}
.otree li{display:flex;flex-direction:column;align-items:center;position:relative;padding:0 4px}
.otree li::before,.otree li::after{content:'';position:absolute;top:0;border-top:1.5px solid hsl(var(--border)/0.4);width:50%;height:20px}
.otree li::before{left:0;border-right:1.5px solid hsl(var(--border)/0.4)}
.otree li::after{right:0}
.otree li:first-child::before{border:0 none}
.otree li:last-child::after{border:0 none}
.otree li:only-child::before,.otree li:only-child::after{border:0 none}
.otree li:only-child{padding-top:20px}
.otree li:only-child::before{border-left:1.5px solid hsl(var(--border)/0.4);height:20px;width:0;left:50%}
.otree li:first-child::after{border-top:1.5px solid hsl(var(--border)/0.4)}
.otree li:last-child::before{border-top:1.5px solid hsl(var(--border)/0.4);border-right:1.5px solid hsl(var(--border)/0.4)}
`;

/* ── Cargo colors ───────────────────────────────────────── */
const CARGO_COLORS: Record<string, string> = {
  'CEO': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  'Diretor': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  'Gerente': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'Coordenador': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  'Supervisor': 'bg-green-500/20 text-green-400 border-green-500/30',
  'Sênior': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  'Especialista': 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  'Analista': 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

function cargoColor(cargo: string) {
  for (const [key, color] of Object.entries(CARGO_COLORS)) {
    if (cargo.includes(key)) return color;
  }
  return 'bg-muted text-muted-foreground border-border';
}

/* ── Dept border colors ─────────────────────────────────── */
const DEPT_BORDER: Record<string, string> = {
  core: 'border-primary/50 hover:border-primary',
  produto: 'border-blue-500/50 hover:border-blue-500',
  tech: 'border-emerald-500/50 hover:border-emerald-500',
  quality: 'border-amber-500/50 hover:border-amber-500',
  vendas: 'border-purple-500/50 hover:border-purple-500',
  seguranca: 'border-red-500/50 hover:border-red-500',
};

/* ── UNIFIED ORG TREE — Tudo junto ──────────────────────── */
const FULL_ORG: OrgNode = {
  agent: { id: 'aiox-master', name: 'Orion', icon: '👑', title: 'Master Orchestrator', cargo: 'CEO', dept: 'core' },
  children: [
    // ─── VP Produto ───
    {
      agent: { id: 'pm', name: 'Morgan', icon: '📋', title: 'Product Manager', cargo: 'Diretor de Produto', dept: 'produto' },
      children: [
        { agent: { id: 'po', name: 'Pax', icon: '🎯', title: 'Product Owner', cargo: 'Supervisor', dept: 'produto' } },
        { agent: { id: 'sm', name: 'River', icon: '🌊', title: 'Scrum Master', cargo: 'Supervisor', dept: 'produto' } },
        { agent: { id: 'analyst', name: 'Atlas', icon: '🔍', title: 'Business Analyst', cargo: 'Analista', dept: 'produto' } },
      ],
    },
    // ─── VP Tech ───
    {
      agent: { id: 'architect', name: 'Aria', icon: '🏛️', title: 'System Architect', cargo: 'Diretor de Tecnologia', dept: 'tech' },
      children: [
        { agent: { id: 'dev', name: 'Dex', icon: '💻', title: 'Full Stack Dev', cargo: 'Sênior', dept: 'tech' } },
        { agent: { id: 'data-engineer', name: 'Dara', icon: '📊', title: 'Database Architect', cargo: 'Especialista', dept: 'tech' } },
        { agent: { id: 'ux-design-expert', name: 'Uma', icon: '🎨', title: 'UX/UI Designer', cargo: 'Especialista', dept: 'tech' } },
        { agent: { id: 'devops', name: 'Gage', icon: '⚡', title: 'DevOps Engineer', cargo: 'Especialista', dept: 'tech' } },
        { agent: { id: 'squad-creator', name: 'Craft', icon: '🏗️', title: 'Squad Creator', cargo: 'Especialista', dept: 'tech' } },
      ],
    },
    // ─── VP Qualidade ───
    {
      agent: { id: 'qa', name: 'Quinn', icon: '✅', title: 'Test Architect', cargo: 'Diretor de Qualidade', dept: 'quality' },
    },
    // ─── Squad Vendas ───
    {
      agent: { id: 'coach', name: 'Coach', icon: '🎯', title: 'Sales Coach', cargo: 'Diretor Comercial', dept: 'vendas' },
      children: [
        {
          agent: { id: 'sandler', name: 'Sandler', icon: '🔱', title: 'Sandler Selling', cargo: 'Gerente', dept: 'vendas' },
          children: [
            { agent: { id: 'spin', name: 'SPIN', icon: '🌀', title: 'SPIN Selling', cargo: 'Supervisor', dept: 'vendas' } },
            { agent: { id: 'meddic', name: 'MEDDIC', icon: '📊', title: 'MEDDIC', cargo: 'Supervisor', dept: 'vendas' } },
          ],
        },
        {
          agent: { id: 'challenger', name: 'Challenger', icon: '⚡', title: 'Challenger Sale', cargo: 'Gerente', dept: 'vendas' },
          children: [
            { agent: { id: 'gap', name: 'Gap', icon: '🔍', title: 'Gap Selling', cargo: 'Supervisor', dept: 'vendas' } },
            { agent: { id: 'spiced', name: 'SPICED', icon: '🌶️', title: 'SPICED', cargo: 'Supervisor', dept: 'vendas' } },
          ],
        },
        {
          agent: { id: 'value-selling', name: 'Value', icon: '💎', title: 'Value Selling', cargo: 'Coordenador', dept: 'vendas' },
          children: [
            { agent: { id: 'command', name: 'Command', icon: '🎤', title: 'Command of Message', cargo: 'Analista', dept: 'vendas' } },
            { agent: { id: 'miller-heiman', name: 'Miller H.', icon: '🗺️', title: 'Strategic Selling', cargo: 'Analista', dept: 'vendas' } },
            { agent: { id: 'bant', name: 'BANT', icon: '✅', title: 'BANT', cargo: 'Analista', dept: 'vendas' } },
            { agent: { id: 'neat', name: 'NEAT', icon: '🎯', title: 'NEAT', cargo: 'Analista', dept: 'vendas' } },
            { agent: { id: 'snap', name: 'SNAP', icon: '⚡', title: 'SNAP', cargo: 'Analista', dept: 'vendas' } },
          ],
        },
      ],
    },
    // ─── Squad Segurança ───
    {
      agent: { id: 'security-architect', name: 'Sentinel', icon: '🧠', title: 'Security Architect', cargo: 'Diretor de Segurança', dept: 'seguranca' },
      children: [
        {
          agent: { id: 'appsec-engineer', name: 'Shield', icon: '🛡️', title: 'AppSec Engineer', cargo: 'Gerente', dept: 'seguranca' },
          children: [
            { agent: { id: 'red-team', name: 'Blade', icon: '⚔️', title: 'Red Team', cargo: 'Especialista', dept: 'seguranca' } },
            { agent: { id: 'iam-specialist', name: 'Gatekeeper', icon: '🔐', title: 'IAM Specialist', cargo: 'Especialista', dept: 'seguranca' } },
          ],
        },
        {
          agent: { id: 'devsecops', name: 'Forge', icon: '⚙️', title: 'DevSecOps', cargo: 'Gerente', dept: 'seguranca' },
          children: [
            { agent: { id: 'incident-responder', name: 'Vigil', icon: '🔍', title: 'Incident Responder', cargo: 'Especialista', dept: 'seguranca' } },
            { agent: { id: 'compliance-lgpd', name: 'Guardian', icon: '📊', title: 'Compliance LGPD', cargo: 'Especialista', dept: 'seguranca' } },
          ],
        },
      ],
    },
  ],
};

/* ── Org Card ───────────────────────────────────────────── */
function OrgCard({ agent }: { agent: Agent }) {
  const cc = cargoColor(agent.cargo);
  const border = agent.dept ? DEPT_BORDER[agent.dept] || '' : '';
  return (
    <div className={cn(
      'flex flex-col items-center gap-0.5 p-2 rounded-xl border bg-card/90 backdrop-blur-sm transition-all hover:shadow-lg hover:shadow-primary/5 cursor-default',
      'min-w-[110px] max-w-[130px]',
      border || 'border-border/60',
    )}>
      <span className="text-xl leading-none">{agent.icon}</span>
      <span className="text-[11px] font-bold text-center leading-tight mt-0.5">{agent.name}</span>
      <span className="text-[8px] text-muted-foreground text-center leading-tight">{agent.title}</span>
      <Badge variant="outline" className={cn('text-[7px] h-3.5 px-1 mt-0.5', cc)}>{agent.cargo}</Badge>
    </div>
  );
}

function TreeNode({ node }: { node: OrgNode }) {
  return (
    <div className="otree">
      <OrgCard agent={node.agent} />
      {node.children && node.children.length > 0 && (
        <ul>
          {node.children.map(c => (
            <li key={c.agent.id}><TreeNode node={c} /></li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ── Estimation — Formula-based + Incremental AI ────────── */

// Cost per unit (BRL) — benchmarks mercado brasileiro SaaS B2B
const UNIT_COSTS = {
  loc: 12,            // R$ por linha de código (dev sênior ~R$30k/mês, ~160h, ~20 LOC/h útil)
  page: 8_000,        // R$ por página funcional (layout + lógica + integração)
  edgeFunction: 5_000,// R$ por edge function (backend serverless)
  migration: 2_000,   // R$ por migration SQL (schema, RLS, indexes)
  agent: 3_500,       // R$ por agente IA (prompt, config, integração)
  integration: 15_000,// R$ por integração externa (WhatsApp, Meet, OpenAI)
  uxDesign: 3_500,    // R$ por tela desenhada
  infraMonth: 1_800,  // R$ infra/mês (Supabase Pro + domínio + OpenAI)
};

// Real project metrics from git
const METRICS = {
  startDate: '2026-03-08',
  daysElapsed: Math.ceil((Date.now() - new Date('2026-03-08').getTime()) / 86400000),
  commits: 708,
  loc: 37_918,
  pages: 26,
  edgeFunctions: 8,
  migrations: 39,
  agents: 32,
  integrations: 4, // WhatsApp Evolution, Meta WABA, Google Meet, OpenAI
  teamSize: 2,
};

function calcBaseCost() {
  const m = METRICS;
  const dev = m.loc * UNIT_COSTS.loc;
  const pages = m.pages * UNIT_COSTS.page;
  const edge = m.edgeFunctions * UNIT_COSTS.edgeFunction;
  const migrations = m.migrations * UNIT_COSTS.migration;
  const agents = m.agents * UNIT_COSTS.agent;
  const integrations = m.integrations * UNIT_COSTS.integration;
  const ux = m.pages * UNIT_COSTS.uxDesign;
  const infra12 = 12 * UNIT_COSTS.infraMonth;

  const devTotal = dev + pages + edge + migrations + agents + integrations;
  const total = devTotal + ux + infra12;

  return {
    dev, pages, edge, migrations, agents, integrations, ux, infra12,
    devTotal, total,
  };
}

// Incremental log
interface IncrementEntry {
  date: string;
  description: string;
  value: number;
}

interface ProjectEstimates {
  baseCost: ReturnType<typeof calcBaseCost>;
  increments: IncrementEntry[];
  lastMetrics: typeof METRICS;
  updatedAt: string;
}

const STORAGE_KEY = 'sdcoach_project_estimates_v2';

function loadProjectEstimates(): ProjectEstimates {
  try {
    const r = localStorage.getItem(STORAGE_KEY);
    if (r) {
      const parsed = JSON.parse(r);
      // Recalculate base from current metrics
      parsed.baseCost = calcBaseCost();
      return parsed;
    }
  } catch {}
  return { baseCost: calcBaseCost(), increments: [], lastMetrics: METRICS, updatedAt: new Date().toLocaleDateString('pt-BR') };
}

function saveProjectEstimates(e: ProjectEstimates) { localStorage.setItem(STORAGE_KEY, JSON.stringify(e)); }

function formatBRL(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }); }

/* ── Main ───────────────────────────────────────────────── */
export default function AgentOrgChart() {
  const [est, setEst] = useState<ProjectEstimates>(loadProjectEstimates);
  const [generating, setGenerating] = useState(false);
  const [zoom, setZoom] = useState(0.85);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const { tokens } = useAppConfig();
  const { toast } = useToast();

  const incrementTotal = est.increments.reduce((s, i) => s + i.value, 0);
  const totalProject = est.baseCost.total + incrementTotal;

  // Native wheel listener to allow preventDefault (passive: false)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setZoom(z => Math.min(1.5, Math.max(0.3, z - e.deltaY * 0.001)));
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    setPan({
      x: dragStart.current.panX + (e.clientX - dragStart.current.x),
      y: dragStart.current.panY + (e.clientY - dragStart.current.y),
    });
  }, [dragging]);

  const handleMouseUp = useCallback(() => setDragging(false), []);

  const resetView = useCallback(() => { setZoom(0.85); setPan({ x: 0, y: 0 }); }, []);

  // Traditional team estimate (formula-based)
  // COCOMO-like: Effort = LOC/productivityPerMonth, then months = Effort/people
  const tradProdPerPersonMonth = 800; // LOC/person/month for complex SaaS (industry avg)
  const tradEffortMonths = METRICS.loc / tradProdPerPersonMonth; // person-months
  const tradPeople = 5; // typical team: 2 devs + 1 UX + 1 PM + 1 QA
  const tradMonths = Math.ceil(tradEffortMonths / tradPeople);
  const tradMonthsRange = `${tradMonths}–${tradMonths + 4}`;

  const addIncrement = async () => {
    const token = tokens.meetings || tokens.whatsapp || tokens.training;
    if (!token) { toast({ variant: 'destructive', title: 'Token OpenAI não configurado', description: 'Configure em Config. IA.' }); return; }
    setGenerating(true);
    try {
      const lastDate = est.increments.length > 0 ? est.increments[est.increments.length - 1].date : METRICS.startDate;
      const result = await callOpenAI(token, {
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: `Você é um avaliador de valor de software. Analise os commits recentes deste projeto e estime o VALOR AGREGADO em BRL.

## Projeto: Smart Deal Coach (SaaS B2B de coaching de vendas com IA)
## Custo base atual: ${formatBRL(est.baseCost.total)}
## Incrementos anteriores: ${formatBRL(incrementTotal)} (${est.increments.length} entregas)
## Última avaliação: ${lastDate}

## O que foi entregue recentemente (desde ${lastDate}):
- Criptografia AES-256-GCM para tokens Meta e OpenAI
- Squad de segurança (7 agentes especializados)
- Botões em templates Meta WABA
- Organograma unificado com 32 agentes
- Estimativas de projeto baseadas em métricas reais
- Zoom e pan interativo no organograma
- Menu admin responsivo

## Custo por hora de dev sênior: R$ 180–220/h

Responda APENAS com JSON:
{"description":"Resumo curto do que agrega valor","value":NUMBER_EM_BRL}

O valor deve refletir horas estimadas x custo/hora para implementar essas features num time tradicional.` }],
        temperature: 0.2, max_tokens: 200,
      });
      const content = result?.choices?.[0]?.message?.content || result?.content || '';
      const jsonStr = typeof content === 'string' ? content.replace(/```json?\n?/g, '').replace(/```/g, '').trim() : JSON.stringify(content);
      const parsed = JSON.parse(jsonStr);

      const newIncrement: IncrementEntry = {
        date: new Date().toLocaleDateString('pt-BR'),
        description: parsed.description || 'Novas features e melhorias',
        value: typeof parsed.value === 'number' ? parsed.value : 0,
      };

      const updated: ProjectEstimates = {
        ...est,
        baseCost: calcBaseCost(),
        increments: [...est.increments, newIncrement],
        lastMetrics: METRICS,
        updatedAt: new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      };
      setEst(updated); saveProjectEstimates(updated);
      toast({ title: `+${formatBRL(newIncrement.value)} adicionado`, description: newIncrement.description });
    } catch (e: any) { toast({ variant: 'destructive', title: 'Erro', description: e.message }); }
    finally { setGenerating(false); }
  };

  return (
    <div className="space-y-6">
      <style>{treeCSS}</style>

      {/* Header */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">👑</span>
              <h2 className="font-display font-semibold text-lg">Organograma Unificado</h2>
            </div>
            <p className="text-xs text-muted-foreground">32 agentes de IA em uma única hierarquia — AIOX Core + Vendas + Segurança</p>
          </div>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setZoom(z => Math.max(0.3, z - 0.1))}><ZoomOut className="w-3.5 h-3.5" /></Button>
            <span className="text-[10px] text-muted-foreground w-8 text-center">{Math.round(zoom * 100)}%</span>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setZoom(z => Math.min(1.5, z + 0.1))}><ZoomIn className="w-3.5 h-3.5" /></Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={resetView}><Maximize2 className="w-3.5 h-3.5" /></Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <Badge variant="outline" className="text-[9px] h-4 border-primary/50 text-primary">Core</Badge>
          <Badge variant="outline" className="text-[9px] h-4 border-blue-500/50 text-blue-400">Produto</Badge>
          <Badge variant="outline" className="text-[9px] h-4 border-emerald-500/50 text-emerald-400">Tecnologia</Badge>
          <Badge variant="outline" className="text-[9px] h-4 border-amber-500/50 text-amber-400">Qualidade</Badge>
          <Badge variant="outline" className="text-[9px] h-4 border-purple-500/50 text-purple-400">Vendas</Badge>
          <Badge variant="outline" className="text-[9px] h-4 border-red-500/50 text-red-400">Segurança</Badge>
          <span className="text-[9px] text-muted-foreground ml-2">|</span>
          {Object.entries(CARGO_COLORS).map(([c, color]) => (
            <Badge key={c} variant="outline" className={cn('text-[8px] h-3.5', color)}>{c}</Badge>
          ))}
        </div>
      </div>

      {/* Unified Org Chart */}
      <div
        ref={containerRef}
        className={cn(
          'rounded-2xl border border-border/40 bg-gradient-to-b from-card/50 to-background/50 overflow-hidden relative',
          dragging ? 'cursor-grabbing' : 'cursor-grab',
        )}
        style={{ height: 520 }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'top center',
            transition: dragging ? 'none' : 'transform 0.15s ease-out',
          }}
          className="min-w-fit flex justify-center pt-6 pb-8"
        >
          <TreeNode node={FULL_ORG} />
        </div>
        <div className="absolute bottom-2 right-3 text-[9px] text-muted-foreground/50 pointer-events-none select-none">
          Scroll para zoom  |  Arraste para mover
        </div>
      </div>

      {/* Estimativas — Formula-based */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Gem className="w-4 h-4 text-primary" />
            <h2 className="font-display font-semibold text-lg">Estimativa do Projeto</h2>
            <Badge variant="outline" className="text-[9px] h-4">Baseado em métricas reais</Badge>
          </div>
          <div className="flex items-center gap-2">
            {est.updatedAt && <span className="text-[10px] text-muted-foreground">{est.updatedAt}</span>}
            <Button size="sm" variant="outline" className="text-xs h-7 gap-1.5" onClick={addIncrement} disabled={generating}>
              {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              {generating ? 'Avaliando...' : '+ Registrar entrega'}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {/* Cost breakdown */}
          <div className="glass-card p-4 space-y-2">
            <div className="flex items-center gap-2 mb-1"><DollarSign className="w-4 h-4 text-green-500" /><h3 className="font-semibold text-sm">Custo Calculado</h3></div>
            {[
              { label: `Código (${METRICS.loc.toLocaleString()} LOC × R$${UNIT_COSTS.loc})`, value: est.baseCost.dev },
              { label: `${METRICS.pages} Páginas`, value: est.baseCost.pages },
              { label: `${METRICS.edgeFunctions} Edge Functions`, value: est.baseCost.edge },
              { label: `${METRICS.migrations} Migrations SQL`, value: est.baseCost.migrations },
              { label: `${METRICS.agents} Agentes IA`, value: est.baseCost.agents },
              { label: `${METRICS.integrations} Integrações externas`, value: est.baseCost.integrations },
              { label: 'UX/UI Design', value: est.baseCost.ux },
              { label: 'Infraestrutura (12 meses)', value: est.baseCost.infra12 },
            ].map((item, i) => (
              <div key={i} className="flex justify-between">
                <span className="text-[11px] text-muted-foreground">{item.label}</span>
                <span className="text-[11px] font-mono">{formatBRL(item.value)}</span>
              </div>
            ))}
            {incrementTotal > 0 && (
              <div className="flex justify-between pt-1 border-t border-border/30">
                <span className="text-[11px] text-muted-foreground">Entregas incrementais ({est.increments.length}x)</span>
                <span className="text-[11px] font-mono text-green-400">+{formatBRL(incrementTotal)}</span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t border-border/40">
              <span className="text-xs font-semibold">Total do Projeto</span>
              <span className="text-sm font-bold text-primary font-mono">{formatBRL(totalProject)}</span>
            </div>
          </div>

          {/* Timeline — formula-based */}
          <div className="glass-card p-4 space-y-3">
            <div className="flex items-center gap-2 mb-1"><Clock className="w-4 h-4 text-blue-500" /><h3 className="font-semibold text-sm">Prazo & Equipe</h3></div>
            <div className="p-3 rounded-lg border bg-muted/30 border-border/40">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium">Time tradicional</span>
                <Badge variant="outline" className="text-[8px] h-3.5">{Math.round(tradEffortMonths)} pessoa-meses</Badge>
              </div>
              <div className="flex gap-4">
                <span className="text-sm font-bold">{tradMonthsRange} meses</span>
                <span className="text-sm font-bold">{tradPeople} pessoas</span>
              </div>
              <p className="text-[9px] text-muted-foreground mt-1">{METRICS.loc.toLocaleString()} LOC ÷ {tradProdPerPersonMonth} LOC/pessoa/mês = {Math.round(tradEffortMonths)} pessoa-meses</p>
            </div>
            <div className="p-3 rounded-lg border bg-primary/5 border-primary/30">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium">Com AIOX + Claude (real)</span>
                <Badge className="text-[9px] h-4 bg-primary/20 text-primary border-primary/30">Atual</Badge>
              </div>
              <div className="flex gap-4">
                <span className="text-sm font-bold">~{(METRICS.daysElapsed / 30).toFixed(1)} meses</span>
                <span className="text-sm font-bold">{METRICS.teamSize} pessoas</span>
              </div>
              <p className="text-[9px] text-muted-foreground mt-1">{METRICS.daysElapsed} dias, {METRICS.commits} commits, {Math.round(METRICS.commits / METRICS.daysElapsed)} commits/dia</p>
            </div>
            <div className="p-2 rounded bg-green-500/5 border border-green-500/20 text-center">
              <span className="text-[10px] text-green-400 font-medium">
                {Math.round(tradEffortMonths / (METRICS.daysElapsed / 30 * METRICS.teamSize))}x mais rápido que time tradicional
              </span>
            </div>
          </div>

          {/* SaaS Value */}
          <div className="glass-card p-4 space-y-2">
            <div className="flex items-center gap-2 mb-1"><Gem className="w-4 h-4 text-purple-500" /><h3 className="font-semibold text-sm">Valor como SaaS</h3></div>
            {(() => {
              const ticketMin = 299, ticketMax = 599;
              const clientsMin = 50, clientsMax = 150;
              const mrrMin = ticketMin * clientsMin, mrrMax = ticketMax * clientsMax;
              const arrMin = mrrMin * 12, arrMax = mrrMax * 12;
              return [
                { label: `Ticket (${clientsMin}–${clientsMax} clientes)`, value: `${formatBRL(ticketMin)} – ${formatBRL(ticketMax)}/mês` },
                { label: 'MRR', value: `${formatBRL(mrrMin)} – ${formatBRL(mrrMax)}` },
                { label: 'ARR', value: `${formatBRL(arrMin)} – ${formatBRL(arrMax)}` },
                { label: 'Valuation (10x ARR)', value: `${formatBRL(arrMin * 10)} – ${formatBRL(arrMax * 10)}`, highlight: true },
              ].map((item, i) => (
                <div key={i} className={cn('flex justify-between', item.highlight && 'pt-2 border-t border-border/40')}>
                  <span className={cn('text-[11px]', item.highlight ? 'font-semibold' : 'text-muted-foreground')}>{item.label}</span>
                  <span className={cn('text-[11px] font-mono', item.highlight ? 'font-bold text-primary' : '')}>{item.value}</span>
                </div>
              ));
            })()}
          </div>
        </div>

        {/* Increment history */}
        {est.increments.length > 0 && (
          <div className="mt-4 glass-card p-3 space-y-1">
            <h4 className="text-xs font-semibold mb-2">Histórico de Entregas</h4>
            {est.increments.map((inc, i) => (
              <div key={i} className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground w-16">{inc.date}</span>
                  <span>{inc.description}</span>
                </div>
                <span className="font-mono text-green-400">+{formatBRL(inc.value)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 p-3 rounded-lg bg-muted/30 border border-border/40">
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            <strong>Metodologia:</strong> Custo base calculado por fórmula (LOC × R${UNIT_COSTS.loc}/linha + peso por página, edge function, migration, agente IA e integração).
            Timeline tradicional baseada em produtividade de {tradProdPerPersonMonth} LOC/pessoa/mês (benchmark COCOMO para SaaS complexo).
            Dados reais: início 08/03/2026, {METRICS.commits} commits, {METRICS.loc.toLocaleString()} LOC, {METRICS.pages} páginas, equipe de {METRICS.teamSize} pessoas.
            O botão "Registrar entrega" usa IA para avaliar o valor das features recentes e acumula no total.
          </p>
        </div>
      </div>
    </div>
  );
}
