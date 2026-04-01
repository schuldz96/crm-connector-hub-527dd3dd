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

/* ── Estimation — Full system analysis ──────────────────── */

const METRICS = {
  startDate: '2026-03-08',
  daysElapsed: Math.ceil((Date.now() - new Date('2026-03-08').getTime()) / 86400000),
  commits: 708,
  loc: 37_918,
  pages: 26,
  edgeFunctions: 8,
  migrations: 39,
  agents: 32,
  integrations: 4,
  teamSize: 2,
};

interface CostLine { role: string; qty: number; salaryMin: number; salaryMax: number; months: number; }
interface AIEstimate {
  team: CostLine[];
  infra: { label: string; monthlyMin: number; monthlyMax: number }[];
  timeline: { traditional: { months: string; people: string }; aiox: { months: string; people: string } };
  saas: { ticketMin: number; ticketMax: number; clientsMin: number; clientsMax: number };
  summary: string;
  updatedAt: string;
}

const STORAGE_KEY = 'sdcoach_ai_estimate_v3';
function loadAIEstimate(): AIEstimate | null { try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : null; } catch { return null; } }
function saveAIEstimate(e: AIEstimate) { localStorage.setItem(STORAGE_KEY, JSON.stringify(e)); }
function formatBRL(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }); }

/* ── Main ───────────────────────────────────────────────── */
export default function AgentOrgChart() {
  const [aiEst, setAiEst] = useState<AIEstimate | null>(loadAIEstimate);
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

  const runFullAnalysis = async () => {
    const token = tokens.meetings || tokens.whatsapp || tokens.training;
    if (!token) { toast({ variant: 'destructive', title: 'Token OpenAI não configurado', description: 'Configure em Config. IA.' }); return; }
    setGenerating(true);
    try {
      const m = METRICS;
      const result = await callOpenAI(token, {
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: `Você é um CTO e consultor de engenharia de software experiente em precificação de projetos SaaS no Brasil. Busque salários reais do mercado brasileiro (Glassdoor, Levels.fyi, Vagas.com) para cada cargo. Seja preciso e realista.` }, { role: 'user', content: `Analise este sistema COMPLETO e calcule quanto custaria contratar um time para construí-lo DO ZERO.

## INVENTÁRIO COMPLETO DO SISTEMA
- ${m.loc.toLocaleString()} linhas de código TypeScript/React
- ${m.pages} páginas funcionais (Dashboard, CRM com 6 sub-páginas, Reuniões, WhatsApp, Inbox, Treinamento, Desempenho, Times, Usuários, Integrações, Automações, Config IA, Admin com 10 seções, Perfil)
- ${m.edgeFunctions} Edge Functions Supabase/Deno (evaluate-cron, evaluate-queue, meta-webhook, openai-proxy, meta-download-media, meta-upload-media, fetch-transcripts, meet-gateway)
- ${m.migrations} migrations SQL (schema multi-tenant, RLS, triggers, functions, indexes)
- ${m.agents} agentes de IA (12 AIOX Core + 13 Squad Vendas + 7 Squad Segurança)
- ${m.integrations} integrações complexas: WhatsApp Evolution API (Baileys), Meta WhatsApp Business API (Cloud), Google Meet (transcrições via Drive), OpenAI (gpt-4o-mini via RPC proxy)

## FEATURES DO SISTEMA
- CRM completo: contatos, empresas, negócios, tickets, pipeline kanban drag-and-drop, propriedades customizáveis, soft delete com restore
- Inbox WhatsApp WABA: multi-conta, envio de texto/imagem/áudio/vídeo/documento, templates Meta com botões, envio em massa, métricas diárias
- Avaliação multi-agente de vendas: 12 metodologias (Sandler, SPIN, MEDDIC, Challenger, Gap, SPICED, etc), classificador + avaliadores + análise de sentimento
- Multi-tenant com RBAC hierárquico: admin→manager→supervisor→member, filtro por empresa_id, área, time
- Segurança: criptografia AES-256-GCM nos tokens, squad de 7 agentes de segurança
- Autenticação customizada + Google SSO
- Sistema de auditoria e logs
- Configuração de módulos e permissões por cargo

## COMPLEXIDADE TÉCNICA
- Schema PostgreSQL com 39 migrations, RLS, triggers, functions
- Realtime polling (3s mensagens, 5s conversas)
- Upload de mídia via proxy (CORS bypass)
- Criptografia client-side e server-side sincronizada
- Deploy automático (push to main = produção)

## INSTRUÇÕES
Liste CADA profissional necessário com salário médio REAL do mercado brasileiro (pesquise Glassdoor/Levels.fyi para São Paulo).
Calcule meses necessários para CADA um.

Retorne APENAS JSON válido (sem markdown, sem texto extra):
{
  "team":[
    {"role":"Dev Full-Stack Sênior","qty":N,"salaryMin":N,"salaryMax":N,"months":N},
    {"role":"Dev Frontend Sênior","qty":N,"salaryMin":N,"salaryMax":N,"months":N},
    ...
  ],
  "infra":[
    {"label":"Supabase Pro","monthlyMin":N,"monthlyMax":N},
    {"label":"OpenAI API","monthlyMin":N,"monthlyMax":N},
    ...
  ],
  "timeline":{"traditional":{"months":"X–Y","people":"N"},"aiox":{"months":"~${(m.daysElapsed/30).toFixed(1)}","people":"${m.teamSize}"}},
  "saas":{"ticketMin":N,"ticketMax":N,"clientsMin":50,"clientsMax":150},
  "summary":"Resumo executivo de 2 linhas sobre o valor do projeto"
}

Salários em BRL/mês. Seja realista — este é um SaaS enterprise com integrações complexas.` }],
        temperature: 0.2, max_tokens: 1500,
      });
      const content = result?.choices?.[0]?.message?.content || result?.content || '';
      const jsonStr = typeof content === 'string' ? content.replace(/```json?\n?/g, '').replace(/```/g, '').trim() : JSON.stringify(content);
      const parsed = JSON.parse(jsonStr);
      const est: AIEstimate = { ...parsed, updatedAt: new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) };
      setAiEst(est); saveAIEstimate(est);
      toast({ title: 'Análise completa finalizada!' });
    } catch (e: any) { toast({ variant: 'destructive', title: 'Erro na análise', description: e.message }); }
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

      {/* Estimativas — Full Analysis */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Gem className="w-4 h-4 text-primary" />
            <h2 className="font-display font-semibold text-lg">Estimativa do Projeto</h2>
          </div>
          <div className="flex items-center gap-2">
            {aiEst?.updatedAt && <span className="text-[10px] text-muted-foreground">{aiEst.updatedAt}</span>}
            <Button size="sm" variant="outline" className="text-xs h-7 gap-1.5" onClick={runFullAnalysis} disabled={generating}>
              {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              {generating ? 'Analisando sistema...' : 'Analisar com IA'}
            </Button>
          </div>
        </div>

        {!aiEst ? (
          <div className="text-center py-12">
            <Sparkles className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Clique em "Analisar com IA" para gerar a estimativa completa do projeto.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">A IA vai analisar {METRICS.loc.toLocaleString()} linhas, {METRICS.pages} páginas, {METRICS.agents} agentes e calcular salários reais do mercado.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              {/* Team cost breakdown */}
              <div className="glass-card p-4 space-y-2 xl:col-span-2">
                <div className="flex items-center gap-2 mb-2"><Users className="w-4 h-4 text-green-500" /><h3 className="font-semibold text-sm">Equipe Necessária (time tradicional)</h3></div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="text-muted-foreground border-b border-border/30">
                        <th className="text-left py-1 font-medium">Cargo</th>
                        <th className="text-center py-1 font-medium">Qtd</th>
                        <th className="text-right py-1 font-medium">Salário/mês</th>
                        <th className="text-center py-1 font-medium">Meses</th>
                        <th className="text-right py-1 font-medium">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aiEst.team.map((t, i) => {
                        const subMin = t.qty * t.salaryMin * t.months;
                        const subMax = t.qty * t.salaryMax * t.months;
                        return (
                          <tr key={i} className="border-b border-border/20">
                            <td className="py-1.5">{t.role}</td>
                            <td className="text-center">{t.qty}</td>
                            <td className="text-right font-mono">{formatBRL(t.salaryMin)}–{formatBRL(t.salaryMax)}</td>
                            <td className="text-center">{t.months}</td>
                            <td className="text-right font-mono">{formatBRL(subMin)}–{formatBRL(subMax)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-border/40 font-semibold">
                        <td className="py-2" colSpan={4}>Total Equipe</td>
                        <td className="text-right font-mono text-primary">
                          {formatBRL(aiEst.team.reduce((s, t) => s + t.qty * t.salaryMin * t.months, 0))}–{formatBRL(aiEst.team.reduce((s, t) => s + t.qty * t.salaryMax * t.months, 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                {/* Infra */}
                {aiEst.infra && aiEst.infra.length > 0 && (
                  <div className="pt-2 border-t border-border/30 space-y-1">
                    <span className="text-[10px] font-medium text-muted-foreground">Infraestrutura (mensal)</span>
                    {aiEst.infra.map((inf, i) => (
                      <div key={i} className="flex justify-between text-[11px]">
                        <span className="text-muted-foreground">{inf.label}</span>
                        <span className="font-mono">{formatBRL(inf.monthlyMin)}–{formatBRL(inf.monthlyMax)}/mês</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Timeline + SaaS */}
              <div className="space-y-4">
                <div className="glass-card p-4 space-y-3">
                  <div className="flex items-center gap-2 mb-1"><Clock className="w-4 h-4 text-blue-500" /><h3 className="font-semibold text-sm">Prazo</h3></div>
                  <div className="p-3 rounded-lg border bg-muted/30 border-border/40">
                    <span className="text-xs font-medium">Time tradicional</span>
                    <div className="flex gap-3 mt-1">
                      <span className="text-sm font-bold">{aiEst.timeline.traditional.months} meses</span>
                      <span className="text-sm font-bold">{aiEst.timeline.traditional.people} pessoas</span>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg border bg-primary/5 border-primary/30">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">Com AIOX + Claude</span>
                      <Badge className="text-[9px] h-4 bg-primary/20 text-primary border-primary/30">Real</Badge>
                    </div>
                    <div className="flex gap-3 mt-1">
                      <span className="text-sm font-bold">~{(METRICS.daysElapsed / 30).toFixed(1)} meses</span>
                      <span className="text-sm font-bold">{METRICS.teamSize} pessoas</span>
                    </div>
                    <p className="text-[9px] text-muted-foreground mt-1">{METRICS.daysElapsed} dias | {METRICS.commits} commits</p>
                  </div>
                </div>

                <div className="glass-card p-4 space-y-2">
                  <div className="flex items-center gap-2 mb-1"><Gem className="w-4 h-4 text-purple-500" /><h3 className="font-semibold text-sm">Valor SaaS</h3></div>
                  {(() => {
                    const s = aiEst.saas;
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

            {aiEst.summary && (
              <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-xs text-foreground">{aiEst.summary}</p>
              </div>
            )}
          </>
        )}

        <div className="mt-4 p-3 rounded-lg bg-muted/30 border border-border/40">
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            <strong>Dados do sistema:</strong> {METRICS.loc.toLocaleString()} LOC | {METRICS.pages} páginas | {METRICS.edgeFunctions} edge functions | {METRICS.migrations} migrations | {METRICS.agents} agentes IA | {METRICS.integrations} integrações | {METRICS.commits} commits em {METRICS.daysElapsed} dias.
            Salários baseados em pesquisa de mercado (SP). Clique "Analisar com IA" para recalcular a qualquer momento.
          </p>
        </div>
      </div>
    </div>
  );
}
