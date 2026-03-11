/**
 * Serviço de avaliação automática de desempenho.
 * Avalia conversas WhatsApp e reuniões usando critérios da Config.AI.
 * Salva scores na tabela saas.analises_ia (sem duplicatas).
 */
import { supabase } from '@/integrations/supabase/client';
import { getSaasEmpresaId } from '@/lib/saas';
import { loadAIConfig } from '@/lib/aiConfigService';
import { callOpenAI } from '@/lib/openaiProxy';
import { DEFAULT_WHATSAPP_CRITERIA, DEFAULT_MEETING_CRITERIA } from '@/pages/AIConfigPage';

// ─── Types ───────────────────────────────────────────────────────────────────
export interface CriteriaScore {
  id: string;
  label: string;
  weight: number;
  score: number;
  feedback: string;
}

export interface EvaluationResult {
  totalScore: number;
  summary: string;
  insights: string;
  criticalAlerts: string[];
  criteriaScores: CriteriaScore[];
}

export interface StoredEvaluation {
  id: string;
  tipo_contexto: 'whatsapp' | 'reuniao';
  vendedor_id: string | null;
  score: number;
  criterios: CriteriaScore[];
  resumo: string;
  instancia_nome: string | null;
  contato_telefone: string | null;
  periodo_ref: string | null;
  entidade_id: string | null;
  criado_em: string;
}

// ─── Evaluate a WhatsApp conversation ────────────────────────────────────────
export async function evaluateWhatsAppConversation(
  apiToken: string,
  aiModel: string,
  instanceName: string,
  contactPhone: string,
  contactName: string,
  messages: { fromMe: boolean; body: string; timestamp: number }[],
  vendedorId: string | null,
  periodoRef?: string, // YYYY-MM-DD
): Promise<EvaluationResult | null> {
  if (!apiToken || messages.length === 0) return null;

  const config = await loadAIConfig('whatsapp');
  const criteria = config?.criterios?.length ? config.criterios : DEFAULT_WHATSAPP_CRITERIA;
  const systemPrompt = config?.prompt_sistema || 'Você é um especialista em vendas digitais e atendimento via WhatsApp. Avalie as conversas com foco em efetividade comercial, qualificação de leads e conversão.';

  const transcript = messages.map(m =>
    `[${m.fromMe ? 'VENDEDOR' : 'LEAD'}] ${m.body}`
  ).join('\n');

  const criteriaText = criteria.map((c: any) =>
    `- ${c.label} (peso ${c.weight}%): ${c.description}. Sinais positivos: ${(c.positiveSignals || []).join(', ') || 'N/A'}. Sinais negativos: ${(c.negativeSignals || []).join(', ') || 'N/A'}.`
  ).join('\n');

  const userPrompt = `Analise a seguinte conversa de WhatsApp entre um vendedor e um lead.

CRITÉRIOS DE AVALIAÇÃO:
${criteriaText}

CONVERSA:
${transcript.slice(0, 12000)}

Responda APENAS com JSON válido (sem markdown):
{
  "totalScore": <0-100>,
  "summary": "<resumo 2-3 frases>",
  "insights": "<insights 2-3 frases>",
  "criticalAlerts": ["<alerta se houver>"],
  "criteriaScores": [
    { "id": "<id>", "label": "<nome>", "weight": <peso>, "score": <0-100>, "feedback": "<feedback>" }
  ]
}`;

  const data = await callOpenAI(apiToken, {
    model: aiModel || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
    max_tokens: 1500,
  });

  const raw = data.choices?.[0]?.message?.content || '';
  const jsonStr = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const result: EvaluationResult = JSON.parse(jsonStr);

  // Persist to DB
  const empresaId = await getSaasEmpresaId();
  const refDate = periodoRef || new Date().toISOString().split('T')[0];

  await (supabase as any)
    .schema('saas')
    .from('analises_ia')
    .upsert(
      {
        empresa_id: empresaId,
        tipo_contexto: 'whatsapp',
        vendedor_id: vendedorId,
        instancia_nome: instanceName,
        contato_telefone: contactPhone,
        periodo_ref: refDate,
        score: Math.round(result.totalScore),
        criterios: result.criteriaScores,
        resumo: result.summary,
        payload: { insights: result.insights, criticalAlerts: result.criticalAlerts, contactName },
      },
      { onConflict: 'tipo_contexto,instancia_nome,contato_telefone,periodo_ref' },
    );

  return result;
}

// ─── Evaluate a meeting ──────────────────────────────────────────────────────
export async function evaluateMeeting(
  apiToken: string,
  aiModel: string,
  reuniaoId: string,
  titulo: string,
  transcricao: string,
  vendedorId: string | null,
): Promise<EvaluationResult | null> {
  if (!apiToken || !transcricao) return null;

  const config = await loadAIConfig('meetings');
  const criteria = config?.criterios?.length ? config.criterios : DEFAULT_MEETING_CRITERIA;
  const systemPrompt = config?.prompt_sistema || 'Você é um avaliador especialista em vendas consultivas. Analise a transcrição da reunião e avalie cada critério com base nos sinais identificados. Seja específico e construtivo nos feedbacks.';

  const criteriaText = criteria.map((c: any) =>
    `- ${c.label} (peso ${c.weight}%): ${c.description}. Sinais positivos: ${(c.positiveSignals || []).join(', ') || 'N/A'}. Sinais negativos: ${(c.negativeSignals || []).join(', ') || 'N/A'}.`
  ).join('\n');

  const userPrompt = `Analise a seguinte transcrição de reunião de vendas.

REUNIÃO: ${titulo}

CRITÉRIOS DE AVALIAÇÃO:
${criteriaText}

TRANSCRIÇÃO:
${transcricao.slice(0, 15000)}

Responda APENAS com JSON válido (sem markdown):
{
  "totalScore": <0-100>,
  "summary": "<resumo 2-3 frases>",
  "insights": "<insights 2-3 frases>",
  "criticalAlerts": ["<alerta se houver>"],
  "criteriaScores": [
    { "id": "<id>", "label": "<nome>", "weight": <peso>, "score": <0-100>, "feedback": "<feedback>" }
  ]
}`;

  const data = await callOpenAI(apiToken, {
    model: aiModel || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
    max_tokens: 1500,
  });

  const raw = data.choices?.[0]?.message?.content || '';
  const jsonStr = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const result: EvaluationResult = JSON.parse(jsonStr);

  // Persist to DB
  const empresaId = await getSaasEmpresaId();

  await (supabase as any)
    .schema('saas')
    .from('analises_ia')
    .upsert(
      {
        empresa_id: empresaId,
        tipo_contexto: 'reuniao',
        entidade_id: reuniaoId,
        vendedor_id: vendedorId,
        score: Math.round(result.totalScore),
        criterios: result.criteriaScores,
        resumo: result.summary,
        payload: { insights: result.insights, criticalAlerts: result.criticalAlerts, titulo },
      },
      { onConflict: 'tipo_contexto,entidade_id' },
    );

  // Also update reunioes table
  await (supabase as any)
    .schema('saas')
    .from('reunioes')
    .update({ score: Math.round(result.totalScore), analisada_por_ia: true })
    .eq('id', reuniaoId);

  return result;
}

// ─── Load a single evaluation by entity ──────────────────────────────────────
export async function loadEvaluationByEntity(entidadeId: string): Promise<StoredEvaluation | null> {
  const empresaId = await getSaasEmpresaId();
  const { data } = await (supabase as any)
    .schema('saas')
    .from('analises_ia')
    .select('id,tipo_contexto,vendedor_id,score,criterios,resumo,payload,instancia_nome,contato_telefone,periodo_ref,entidade_id,criado_em')
    .eq('empresa_id', empresaId)
    .eq('entidade_id', entidadeId)
    .maybeSingle();
  return data || null;
}

// ─── Load stored evaluations ─────────────────────────────────────────────────
export async function loadEvaluations(opts?: {
  tipoContexto?: 'whatsapp' | 'reuniao';
  vendedorId?: string;
  dataInicio?: string;
  dataFim?: string;
}): Promise<StoredEvaluation[]> {
  const empresaId = await getSaasEmpresaId();

  let query = (supabase as any)
    .schema('saas')
    .from('analises_ia')
    .select('id,tipo_contexto,vendedor_id,score,criterios,resumo,instancia_nome,contato_telefone,periodo_ref,entidade_id,criado_em')
    .eq('empresa_id', empresaId)
    .order('criado_em', { ascending: false });

  if (opts?.tipoContexto) query = query.eq('tipo_contexto', opts.tipoContexto);
  if (opts?.vendedorId) query = query.eq('vendedor_id', opts.vendedorId);
  if (opts?.dataInicio) query = query.gte('periodo_ref', opts.dataInicio);
  if (opts?.dataFim) query = query.lte('periodo_ref', opts.dataFim);

  const { data, error } = await query;
  if (error) {
    console.error('[Evaluation] Load error:', error);
    return [];
  }
  return (data || []) as StoredEvaluation[];
}

// ─── Load users from DB (for Desempenho page) ───────────────────────────────
export async function loadUsersForPerformance(): Promise<any[]> {
  const empresaId = await getSaasEmpresaId();
  const { data, error } = await (supabase as any)
    .schema('saas')
    .from('usuarios')
    .select('id,nome,email,avatar_url,papel,status,area_id,time_id')
    .eq('empresa_id', empresaId)
    .eq('status', 'ativo');

  if (error) {
    console.error('[Evaluation] Load users error:', error);
    return [];
  }
  return data || [];
}

// ─── Load teams from DB ──────────────────────────────────────────────────────
export async function loadTeamsForPerformance(): Promise<any[]> {
  const empresaId = await getSaasEmpresaId();
  const { data, error } = await (supabase as any)
    .schema('saas')
    .from('times')
    .select('id,nome,area_id,supervisor_id')
    .eq('empresa_id', empresaId);

  if (error) {
    console.error('[Evaluation] Load teams error:', error);
    return [];
  }
  return data || [];
}
