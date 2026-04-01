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

/* ── Estimation — Deterministic + AI salary lookup ──────── */

// Auto-collected from git/filesystem before each build (scripts/collect-metrics.sh)
import rawMetrics from '@/lib/projectMetrics.json';

const METRICS = {
  ...rawMetrics,
  daysElapsed: Math.ceil((Date.now() - new Date(rawMetrics.startDate).getTime()) / 86400000),
};

// Fixed team structure — derived from project inventory, NEVER changes with AI
// Months calculated: LOC÷productivity + complexity factor per role
const TEAM_STRUCTURE: { role: string; qty: number; months: number; why: string }[] = [
  { role: 'Dev Full-Stack Sênior', qty: 2, months: 10, why: `${METRICS.loc.toLocaleString()} LOC + ${METRICS.edgeFunctions} edge functions + ${METRICS.integrations} integrações` },
  { role: 'Dev Frontend Pleno', qty: 1, months: 8, why: `${METRICS.pages} páginas + componentes UI + responsividade` },
  { role: 'DBA / Data Engineer', qty: 1, months: 5, why: `${METRICS.migrations} migrations + RLS + triggers + schema multi-tenant` },
  { role: 'UX/UI Designer', qty: 1, months: 6, why: `${METRICS.pages} telas + design system + fluxos CRM` },
  { role: 'Product Manager', qty: 1, months: 10, why: 'Requisitos + roadmap + stakeholders + go-to-market' },
  { role: 'QA Engineer', qty: 1, months: 8, why: 'Testes e2e + multi-tenant + integrações WhatsApp/Meet' },
  { role: 'Eng. IA / Prompts', qty: 1, months: 4, why: `${METRICS.agents} agentes IA + prompts + squad vendas/segurança` },
];

// Default salaries (Glassdoor SP, Mar 2026) — AI can update these
const DEFAULT_SALARIES: Record<string, [number, number]> = {
  'Dev Full-Stack Sênior': [18_000, 28_000],
  'Dev Frontend Pleno': [10_000, 16_000],
  'DBA / Data Engineer': [15_000, 22_000],
  'UX/UI Designer': [12_000, 18_000],
  'Product Manager': [16_000, 24_000],
  'QA Engineer': [10_000, 15_000],
  'Eng. IA / Prompts': [18_000, 30_000],
};

const INFRA_COSTS = [
  { label: 'Supabase Pro', monthlyMin: 150, monthlyMax: 300 },
  { label: 'OpenAI API (gpt-4o-mini)', monthlyMin: 800, monthlyMax: 2_500 },
  { label: 'Domínio + DNS + SSL', monthlyMin: 30, monthlyMax: 80 },
  { label: 'Monitoring / Logs', monthlyMin: 100, monthlyMax: 300 },
];

const SAAS_PARAMS = { ticketMin: 299, ticketMax: 599, clientsMin: 50, clientsMax: 150 };

type Salaries = Record<string, [number, number]>;

interface StoredEstimate {
  salaries: Salaries;
  updatedAt: string;
  source: 'default' | 'ai';
}

const STORAGE_KEY = 'sdcoach_estimate_v4';
function loadStored(): StoredEstimate {
  try { const r = localStorage.getItem(STORAGE_KEY); if (r) return JSON.parse(r); } catch {}
  return { salaries: DEFAULT_SALARIES, updatedAt: new Date().toLocaleDateString('pt-BR'), source: 'default' };
}
function saveStored(e: StoredEstimate) { localStorage.setItem(STORAGE_KEY, JSON.stringify(e)); }

const PROJECT_MONTHS = Math.max(1, Math.ceil(METRICS.daysElapsed / 30));

function calcTotal(salaries: Salaries) {
  let minTotal = 0, maxTotal = 0;
  for (const t of TEAM_STRUCTURE) {
    const [sMin, sMax] = salaries[t.role] || DEFAULT_SALARIES[t.role] || [15000, 25000];
    minTotal += t.qty * sMin * t.months;
    maxTotal += t.qty * sMax * t.months;
  }
  const infraMin = INFRA_COSTS.reduce((s, i) => s + i.monthlyMin, 0) * PROJECT_MONTHS;
  const infraMax = INFRA_COSTS.reduce((s, i) => s + i.monthlyMax, 0) * PROJECT_MONTHS;
  return { teamMin: minTotal, teamMax: maxTotal, infraMin, infraMax, totalMin: minTotal + infraMin, totalMax: maxTotal + infraMax };
}

function formatBRL(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }); }

/* ── Main ───────────────────────────────────────────────── */
export default function AgentOrgChart() {
  const [stored, setStored] = useState<StoredEstimate>(loadStored);
  const [generating, setGenerating] = useState(false);
  const [zoom, setZoom] = useState(0.85);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const { tokens } = useAppConfig();
  const { toast } = useToast();
  const totals = calcTotal(stored.salaries);

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

  const updateSalaries = async () => {
    const token = tokens.meetings || tokens.whatsapp || tokens.training;
    if (!token) { toast({ variant: 'destructive', title: 'Token OpenAI não configurado', description: 'Configure em Config. IA.' }); return; }
    setGenerating(true);
    try {
      const roles = TEAM_STRUCTURE.map(t => t.role);
      const result = await callOpenAI(token, {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Você é um headhunter de TI em São Paulo. Retorne APENAS JSON com salários CLT reais do mercado (Glassdoor, Levels.fyi, Vagas.com.br). Março 2026.' },
          { role: 'user', content: `Informe o salário CLT mensal (min e max) em BRL para cada cargo abaixo. Mercado de São Paulo, empresas de tecnologia/SaaS, nível sênior quando aplicável.

Cargos: ${roles.join(', ')}

Retorne APENAS JSON válido, sem markdown:
{${roles.map(r => `"${r}":[MIN,MAX]`).join(',')}}

Valores inteiros em BRL. Exemplo: "Dev Full-Stack Sênior":[18000,28000]` }],
        temperature: 0, max_tokens: 300,
      });
      const content = result?.choices?.[0]?.message?.content || result?.content || '';
      const jsonStr = typeof content === 'string' ? content.replace(/```json?\n?/g, '').replace(/```/g, '').trim() : JSON.stringify(content);
      const parsed = JSON.parse(jsonStr) as Salaries;
      const updated: StoredEstimate = {
        salaries: { ...DEFAULT_SALARIES, ...parsed },
        updatedAt: new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        source: 'ai',
      };
      setStored(updated); saveStored(updated);
      toast({ title: 'Salários atualizados com dados de mercado!' });
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

      {/* Estimativas — Deterministic */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Gem className="w-4 h-4 text-primary" />
            <h2 className="font-display font-semibold text-lg">Estimativa do Projeto</h2>
            <Badge variant="outline" className="text-[9px] h-4">{stored.source === 'ai' ? 'Salários via IA' : 'Salários padrão'}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">{stored.updatedAt}</span>
            <Button size="sm" variant="outline" className="text-xs h-7 gap-1.5" onClick={updateSalaries} disabled={generating}>
              {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              {generating ? 'Pesquisando...' : 'Atualizar salários'}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* Team table */}
          <div className="glass-card p-4 space-y-2 xl:col-span-2">
            <div className="flex items-center gap-2 mb-2"><Users className="w-4 h-4 text-green-500" /><h3 className="font-semibold text-sm">Custo de Equipe (time tradicional)</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-muted-foreground border-b border-border/30">
                    <th className="text-left py-1 font-medium">Cargo</th>
                    <th className="text-center py-1 font-medium">Qtd</th>
                    <th className="text-right py-1 font-medium">Salário CLT/mês</th>
                    <th className="text-center py-1 font-medium">Meses</th>
                    <th className="text-right py-1 font-medium">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {TEAM_STRUCTURE.map((t, i) => {
                    const [sMin, sMax] = stored.salaries[t.role] || DEFAULT_SALARIES[t.role];
                    return (
                      <tr key={i} className="border-b border-border/20 group" title={t.why}>
                        <td className="py-1.5">{t.role}<span className="text-[9px] text-muted-foreground/50 ml-1 hidden group-hover:inline">({t.why})</span></td>
                        <td className="text-center">{t.qty}</td>
                        <td className="text-right font-mono">{formatBRL(sMin)}–{formatBRL(sMax)}</td>
                        <td className="text-center">{t.months}</td>
                        <td className="text-right font-mono">{formatBRL(t.qty * sMin * t.months)}–{formatBRL(t.qty * sMax * t.months)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border/40 font-semibold">
                    <td className="py-1.5" colSpan={4}>Subtotal Equipe</td>
                    <td className="text-right font-mono text-primary">{formatBRL(totals.teamMin)}–{formatBRL(totals.teamMax)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {/* Infra */}
            <div className="pt-2 border-t border-border/30 space-y-1">
              <span className="text-[10px] font-medium text-muted-foreground">Infraestrutura ({PROJECT_MONTHS} meses de projeto)</span>
              {INFRA_COSTS.map((inf, i) => (
                <div key={i} className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground">{inf.label}</span>
                  <span className="font-mono">{formatBRL(inf.monthlyMin * PROJECT_MONTHS)}–{formatBRL(inf.monthlyMax * PROJECT_MONTHS)}</span>
                </div>
              ))}
              <div className="flex justify-between text-[11px] font-medium pt-1 border-t border-border/20">
                <span>Subtotal Infra</span>
                <span className="font-mono">{formatBRL(totals.infraMin)}–{formatBRL(totals.infraMax)}</span>
              </div>
            </div>
            {/* Grand total */}
            <div className="pt-3 border-t-2 border-primary/30 flex justify-between items-center">
              <span className="font-display font-bold text-sm">Total do Projeto</span>
              <span className="font-display font-bold text-lg text-primary font-mono">{formatBRL(totals.totalMin)}–{formatBRL(totals.totalMax)}</span>
            </div>
          </div>

          {/* Timeline + SaaS */}
          <div className="space-y-4">
            <div className="glass-card p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1"><Clock className="w-4 h-4 text-blue-500" /><h3 className="font-semibold text-sm">Prazo</h3></div>
              <div className="p-3 rounded-lg border bg-muted/30 border-border/40">
                <span className="text-xs font-medium">Time tradicional</span>
                <div className="flex gap-3 mt-1">
                  <span className="text-sm font-bold">{Math.max(...TEAM_STRUCTURE.map(t => t.months))} meses</span>
                  <span className="text-sm font-bold">{TEAM_STRUCTURE.reduce((s, t) => s + t.qty, 0)} pessoas</span>
                </div>
              </div>
              <div className="p-3 rounded-lg border bg-primary/5 border-primary/30">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">Com Claude Code</span>
                  <Badge className="text-[9px] h-4 bg-primary/20 text-primary border-primary/30">Real</Badge>
                </div>
                <div className="flex gap-3 mt-1">
                  <span className="text-sm font-bold">{METRICS.daysElapsed} dias</span>
                  <span className="text-sm font-bold">{METRICS.teamSize} pessoas</span>
                </div>
                <p className="text-[9px] text-muted-foreground mt-1">{METRICS.commits} commits | Início: {METRICS.startDate}</p>
              </div>
            </div>

            <div className="glass-card p-4 space-y-2">
              <div className="flex items-center gap-2 mb-1"><Gem className="w-4 h-4 text-purple-500" /><h3 className="font-semibold text-sm">Valor SaaS</h3></div>
              {(() => {
                const s = SAAS_PARAMS;
                const mrrMin = s.ticketMin * s.clientsMin, mrrMax = s.ticketMax * s.clientsMax;
                return [
                  { label: `Ticket (${s.clientsMin}–${s.clientsMax} clientes)`, v: `${formatBRL(s.ticketMin)}–${formatBRL(s.ticketMax)}/mês` },
                  { label: 'MRR', v: `${formatBRL(mrrMin)}–${formatBRL(mrrMax)}` },
                  { label: 'ARR', v: `${formatBRL(mrrMin * 12)}–${formatBRL(mrrMax * 12)}` },
                  { label: 'Valuation (10x ARR)', v: `${formatBRL(mrrMin * 120)}–${formatBRL(mrrMax * 120)}`, h: true },
                ].map((item, i) => (
                  <div key={i} className={cn('flex justify-between', item.h && 'pt-2 border-t border-border/40')}>
                    <span className={cn('text-[11px]', item.h ? 'font-semibold' : 'text-muted-foreground')}>{item.label}</span>
                    <span className={cn('text-[11px] font-mono', item.h ? 'font-bold text-primary' : '')}>{item.v}</span>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>

        <div className="mt-4 p-3 rounded-lg bg-muted/30 border border-border/40">
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            <strong>Métricas coletadas automaticamente a cada build:</strong> {METRICS.loc.toLocaleString()} LOC, {METRICS.pages} páginas, {METRICS.components} componentes,
            {METRICS.edgeFunctions} edge functions, {METRICS.migrations} migrations, {METRICS.agents} agentes, {METRICS.squads} squads.
            Salários pesquisáveis via IA (mercado SP, CLT). Infra calculada por {PROJECT_MONTHS} meses (desde {METRICS.startDate}).
            Coletado em: {rawMetrics.collectedAt ? new Date(rawMetrics.collectedAt).toLocaleString('pt-BR') : '—'}.
          </p>
        </div>
      </div>
    </div>
  );
}
