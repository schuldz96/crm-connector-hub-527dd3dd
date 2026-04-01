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

/* ── Estimation (AI-powered) ────────────────────────────── */
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
    { label: 'Time tradicional', months: '8–14', people: '5–8' },
    { label: 'Com AIOX + Claude (real)', months: '~0.8', people: '2', highlight: true },
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
function loadEstimates(): Estimates { try { const r = localStorage.getItem(STORAGE_KEY); if (r) return JSON.parse(r); } catch {} return DEFAULT_ESTIMATES; }
function saveEstimates(e: Estimates) { localStorage.setItem(STORAGE_KEY, JSON.stringify(e)); }
function formatBRL(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }); }

/* ── Main ───────────────────────────────────────────────── */
export default function AgentOrgChart() {
  const [estimates, setEstimates] = useState<Estimates>(loadEstimates);
  const [generating, setGenerating] = useState(false);
  const [zoom, setZoom] = useState(0.85);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const { tokens } = useAppConfig();
  const { toast } = useToast();

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

  // Real project metrics from git history
  const PROJECT_METRICS = {
    startDate: '2026-03-08',
    currentDate: new Date().toISOString().slice(0, 10),
    daysElapsed: Math.ceil((Date.now() - new Date('2026-03-08').getTime()) / 86400000),
    commits: 708,
    linesOfCode: 37918,
    pages: 26,
    edgeFunctions: 8,
    migrations: 39,
    agents: 32,
    team: '2 pessoas (Marcos + Yuri) + IA (Claude Code + Lovable)',
    authors: 'gpt-engineer-app[bot]: 377 commits, Processos-appmax: 237, Maxter: 82, Yuri: 11',
  };

  const generateEstimates = async () => {
    const token = tokens.meetings || tokens.whatsapp || tokens.training;
    if (!token) { toast({ variant: 'destructive', title: 'Token OpenAI não configurado', description: 'Configure em Config. IA.' }); return; }
    setGenerating(true);
    try {
      const m = PROJECT_METRICS;
      const result = await callOpenAI(token, {
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: `Analise este projeto SaaS REAL e gere estimativas precisas em JSON.

## DADOS REAIS DO PROJETO (git log)
- Primeiro commit: ${m.startDate}
- Hoje: ${m.currentDate}
- Tempo de desenvolvimento: ${m.daysElapsed} dias (~${(m.daysElapsed / 30).toFixed(1)} meses)
- Total de commits: ${m.commits}
- Autores: ${m.authors}
- Equipe REAL: ${m.team}
- Linhas de código (src/): ${m.linesOfCode.toLocaleString()}
- Páginas: ${m.pages}
- Edge Functions: ${m.edgeFunctions}
- Migrations SQL: ${m.migrations}
- Agentes de IA: ${m.agents}

## SOBRE O PROJETO
Smart Deal Coach — SaaS B2B de coaching de vendas com IA para Appmax.
Stack: React 18 + TypeScript + Vite + Tailwind + shadcn/ui + Supabase (PostgreSQL + Edge Functions + Storage + RLS)
Integrações: WhatsApp (Evolution API + Meta WABA), Google Meet (transcrição), OpenAI (gpt-4o-mini)
Features: CRM completo (contatos, empresas, negócios, tickets, pipeline kanban), avaliação multi-agente de vendas (12 metodologias), inbox WhatsApp com templates Meta, multi-tenant com RBAC hierárquico, criptografia AES-256-GCM nos tokens, squad de segurança (7 agentes), squad de vendas (13 agentes).

## INSTRUÇÕES
Estime quanto custaria se uma empresa contratasse um time tradicional para construir isso DO ZERO.
O campo "Com AIOX + Claude" deve refletir o que REALMENTE aconteceu: ${m.daysElapsed} dias, 2 pessoas.

Retorne APENAS JSON válido (sem markdown):
{"cost":[{"label":"Desenvolvimento","min":N,"max":N},{"label":"UI/UX Design","min":N,"max":N},{"label":"Infraestrutura (12 meses)","min":N,"max":N},{"label":"IA / OpenAI (12 meses)","min":N,"max":N},{"label":"Total Estimado","min":N,"max":N}],"timeline":[{"label":"Time tradicional","months":"X–Y","people":"X–Y"},{"label":"Com AIOX + Claude (real)","months":"~${(m.daysElapsed / 30).toFixed(1)}","people":"2","highlight":true}],"saas":[{"label":"MRR (50–150 clientes)","min":N,"max":N},{"label":"ARR projetado","min":N,"max":N},{"label":"Valuation (10x ARR)","min":N,"max":N}]}

Valores em BRL. Benchmark: devs sênior full-stack R$25–35k/mês, UX sênior R$15–20k/mês, PM R$18–25k/mês, Supabase Pro ~R$150/mês, OpenAI ~R$1.500–3.000/mês. Valuation: 10x ARR (SaaS early-stage).` }],
        temperature: 0.3, max_tokens: 1000,
      });
      const content = result?.choices?.[0]?.message?.content || result?.content || '';
      const jsonStr = typeof content === 'string' ? content.replace(/```json?\n?/g, '').replace(/```/g, '').trim() : JSON.stringify(content);
      const parsed = JSON.parse(jsonStr);
      const ne: Estimates = { ...parsed, updatedAt: new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), aiGenerated: true };
      setEstimates(ne); saveEstimates(ne);
      toast({ title: 'Estimativas atualizadas com IA!' });
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

      {/* Estimativas */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Gem className="w-4 h-4 text-primary" />
            <h2 className="font-display font-semibold text-lg">Estimativa do Projeto</h2>
            {estimates.aiGenerated && <Badge className="text-[9px] h-4 bg-primary/20 text-primary border-primary/30 gap-1"><Sparkles className="w-2.5 h-2.5" /> IA</Badge>}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">{estimates.updatedAt}</span>
            <Button size="sm" variant="outline" className="text-xs h-7 gap-1.5" onClick={generateEstimates} disabled={generating}>
              {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              {generating ? 'Gerando...' : 'Atualizar com IA'}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <div className="glass-card p-4 space-y-2">
            <div className="flex items-center gap-2 mb-1"><DollarSign className="w-4 h-4 text-green-500" /><h3 className="font-semibold text-sm">Custo</h3></div>
            {estimates.cost.map((item, i) => {
              const t = item.label.includes('Total');
              return (<div key={i} className={cn('flex justify-between', t && 'pt-2 border-t border-border/40')}><span className={cn('text-xs', t ? 'font-semibold' : 'text-muted-foreground')}>{item.label}</span><span className={cn('text-xs font-mono', t ? 'font-bold text-primary' : '')}>{formatBRL(item.min)} – {formatBRL(item.max)}</span></div>);
            })}
          </div>
          <div className="glass-card p-4 space-y-3">
            <div className="flex items-center gap-2 mb-1"><Clock className="w-4 h-4 text-blue-500" /><h3 className="font-semibold text-sm">Prazo & Equipe</h3></div>
            {estimates.timeline.map((t, i) => (
              <div key={i} className={cn('p-3 rounded-lg border', t.highlight ? 'bg-primary/5 border-primary/30' : 'bg-muted/30 border-border/40')}>
                <div className="flex items-center justify-between mb-1"><span className="text-xs font-medium">{t.label}</span>{t.highlight && <Badge className="text-[9px] h-4 bg-primary/20 text-primary border-primary/30">Atual</Badge>}</div>
                <div className="flex gap-4"><span className="text-sm font-bold">{t.months} meses</span><span className="text-sm font-bold">{t.people} pessoas</span></div>
              </div>
            ))}
          </div>
          <div className="glass-card p-4 space-y-2">
            <div className="flex items-center gap-2 mb-1"><Gem className="w-4 h-4 text-purple-500" /><h3 className="font-semibold text-sm">Valor SaaS</h3></div>
            {estimates.saas.map((item, i) => {
              const h = item.label.includes('Valuation');
              return (<div key={i} className={cn('flex justify-between', h && 'pt-2 border-t border-border/40')}><span className={cn('text-xs', h ? 'font-semibold' : 'text-muted-foreground')}>{item.label}</span><span className={cn('text-xs font-mono', h ? 'font-bold text-primary' : '')}>{formatBRL(item.min)} – {formatBRL(item.max)}</span></div>);
            })}
          </div>
        </div>

        <div className="mt-4 p-3 rounded-lg bg-muted/30 border border-border/40">
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            <strong>Dados reais do git:</strong> Início em 08/03/2026, 708 commits, 37.918 linhas de código, 26 páginas, 8 edge functions, 39 migrations, 32 agentes IA.
            Equipe: 2 pessoas + IA (Claude Code + Lovable). Benchmarks: devs sênior R$ 25–35k/mês, UX R$ 15–20k/mês. Valuation 10x ARR.
            {estimates.aiGenerated && ' Estimativas geradas por IA com base nos dados reais do projeto.'}
          </p>
        </div>
      </div>
    </div>
  );
}
