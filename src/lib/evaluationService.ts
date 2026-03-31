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

// ─── Parse transcript to calculate participation % by character count ────────
export function parseTranscriptParticipation(
  transcricao: string,
  participantEmails: string[] = [],
): { email?: string; name: string; percent: number }[] {
  if (!transcricao) return [];

  const normalize = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const displayNameFromEmail = (email: string) =>
    email.split('@')[0].replace(/[._-]/g, ' ');

  const lines = transcricao
    .split(/\r?\n/)
    .map((line) => line.replace(/\r/g, '').trim())
    .filter(Boolean);

  const ignoredSpeakers = new Set([
    'read ai meeting notes',
    'transcricao',
    'participantes',
    'meeting notes',
  ]);

  const speakerCharCount: Record<string, number> = {};
  let currentSpeaker = '';

  const isTimestampLine = (value: string) =>
    /^\d{1,2}:\d{2}(:\d{2})?\s*(AM|PM)?$/i.test(value);

  const isValidSpeakerName = (value: string) => {
    const n = normalize(value);
    if (!n || n.length < 3) return false;
    if (ignoredSpeakers.has(n)) return false;
    if (/^\d/.test(n)) return false;
    return true;
  };

  for (const line of lines) {
    if (isTimestampLine(line)) continue;

    const speakerWithText = line.match(/^([^:]{2,80}):\s*(.*)$/);
    if (speakerWithText) {
      const speaker = speakerWithText[1].trim();
      const content = (speakerWithText[2] || '').trim();

      if (isValidSpeakerName(speaker)) {
        currentSpeaker = speaker;
        if (!speakerCharCount[currentSpeaker]) speakerCharCount[currentSpeaker] = 0;
        if (content) speakerCharCount[currentSpeaker] += content.length;
        continue;
      }
    }

    if (currentSpeaker) {
      speakerCharCount[currentSpeaker] += line.length;
    }
  }

  const totalChars = Object.values(speakerCharCount).reduce((sum, chars) => sum + chars, 0);
  if (totalChars === 0) return [];

  const emailCandidates = participantEmails
    .filter(Boolean)
    .map((email) => {
      const normalized = normalize(displayNameFromEmail(email));
      return {
        email,
        normalized,
        tokens: normalized.split(' ').filter((t) => t.length >= 3),
      };
    });

  const mapSpeakerToEmail = (speaker: string): string | undefined => {
    if (emailCandidates.length === 0) return undefined;

    const normalizedSpeaker = normalize(speaker);
    const speakerTokens = normalizedSpeaker.split(' ').filter((t) => t.length >= 3);

    const exact = emailCandidates.find((candidate) => candidate.normalized === normalizedSpeaker);
    if (exact) return exact.email;

    const tokenMatch = emailCandidates.find((candidate) =>
      speakerTokens.some((token) => candidate.tokens.includes(token))
    );

    return tokenMatch?.email;
  };

  const rawResults = Object.entries(speakerCharCount).map(([speaker, chars]) => ({
    name: speaker,
    email: mapSpeakerToEmail(speaker),
    chars,
    percent: Math.round((chars / totalChars) * 100),
  }));

  const sum = rawResults.reduce((acc, row) => acc + row.percent, 0);
  if (sum !== 100 && rawResults.length > 0) {
    const sorted = [...rawResults].sort((a, b) => b.chars - a.chars);
    sorted[0].percent += (100 - sum);
  }

  return rawResults
    .filter((row) => row.percent > 0)
    .map((row) => ({ email: row.email, name: row.name, percent: row.percent }));
}

// ─── Evaluate a meeting ──────────────────────────────────────────────────────
export async function evaluateMeeting(
  apiToken: string,
  aiModel: string,
  reuniaoId: string,
  titulo: string,
  transcricao: string,
  vendedorId: string | null,
  participantEmails?: string[],
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

  // Calculate participation deterministically by character count
  const participation = parseTranscriptParticipation(transcricao, participantEmails || []);

  const data = await callOpenAI(apiToken, {
    model: aiModel || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0,
    max_tokens: 2000,
  });

  const raw = data.choices?.[0]?.message?.content || '';
  const jsonStr = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const result: EvaluationResult = JSON.parse(jsonStr);

  // Persist to DB - delete first then insert to avoid upsert issues
  const empresaId = await getSaasEmpresaId();
  const scoreVal = Math.round(result.totalScore);

  // Delete existing evaluation
  await (supabase as any)
    .schema('saas')
    .from('analises_ia')
    .delete()
    .eq('tipo_contexto', 'reuniao')
    .eq('entidade_id', reuniaoId);

  // Insert new evaluation
  const { error: insertErr } = await (supabase as any)
    .schema('saas')
    .from('analises_ia')
    .insert({
      empresa_id: empresaId,
      tipo_contexto: 'reuniao',
      entidade_id: reuniaoId,
      vendedor_id: vendedorId,
      score: scoreVal,
      criterios: result.criteriaScores,
      resumo: result.summary,
      payload: {
        insights: result.insights,
        criticalAlerts: result.criticalAlerts,
        titulo,
        participation,
      },
    });

  if (insertErr) {
    console.error('[eval] Insert analises_ia failed:', insertErr);
  }

  // Also update reunioes table
  await (supabase as any)
    .schema('saas')
    .from('reunioes')
    .update({ score: scoreVal, analisada_por_ia: true })
    .eq('id', reuniaoId);

  return result;
}

// ─── Load a single evaluation by entity ──────────────────────────────────────
export async function loadEvaluationByEntity(entidadeId: string): Promise<StoredEvaluation | null> {
  const empresaId = await getSaasEmpresaId();
  const { data } = await (supabase as any)
    .schema('saas')
    .from('analises_ia')
    .select('id,tipo_contexto,vendedor_id,score,criterios,resumo,payload,instancia_nome,contato_telefone,periodo_ref,entidade_id,criado_em,agente_avaliador_id,tipo_reuniao_detectado,chain_log')
    .eq('empresa_id', empresaId)
    .eq('entidade_id', entidadeId)
    .maybeSingle();
  return data || null;
}

// ─── Load ALL evaluations for an entity (multi-agent support) ────────────────
export async function loadAllEvaluationsForEntity(entidadeId: string): Promise<(StoredEvaluation & { payload?: any })[]> {
  const empresaId = await getSaasEmpresaId();
  const { data } = await (supabase as any)
    .schema('saas')
    .from('analises_ia')
    .select('id,tipo_contexto,vendedor_id,score,criterios,resumo,payload,instancia_nome,contato_telefone,periodo_ref,entidade_id,criado_em,agente_avaliador_id,tipo_reuniao_detectado,chain_log')
    .eq('empresa_id', empresaId)
    .eq('entidade_id', entidadeId)
    .order('criado_em', { ascending: true });
  return data || [];
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
    .select('id,tipo_contexto,vendedor_id,score,criterios,resumo,instancia_nome,contato_telefone,periodo_ref,entidade_id,payload,agente_avaliador_id,criado_em')
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

// ─── Load agent names (for methodology labels) ─────────────────────────────────
export async function loadAgentNames(): Promise<Record<string, string>> {
  const empresaId = await getSaasEmpresaId();
  const { data, error } = await (supabase as any)
    .schema('saas')
    .from('agentes_ia')
    .select('id,nome')
    .eq('empresa_id', empresaId);
  if (error) return {};
  const map: Record<string, string> = {};
  for (const a of (data || [])) map[a.id] = a.nome;
  return map;
}

// ─── Load meeting durations (for avg call time metric) ────────────────────────
export async function loadMeetingDurations(): Promise<Record<string, number>> {
  const empresaId = await getSaasEmpresaId();
  const { data, error } = await (supabase as any)
    .schema('saas')
    .from('reunioes')
    .select('id,duracao_minutos,vendedor_id')
    .eq('empresa_id', empresaId)
    .gt('duracao_minutos', 0);
  if (error) return {};
  const map: Record<string, number> = {};
  for (const r of (data || [])) map[r.id] = r.duracao_minutos;
  return map;
}

// ─── Load recent evaluations with chain_log (for execution history) ─────────
export async function loadRecentChainLogs(limit = 20): Promise<{
  id: string;
  entidade_id: string;
  score: number;
  resumo: string;
  chain_log: { agente: string; tipo: string; input_resumo: string; output_resumo: string; duracao_ms: number }[];
  tipo_reuniao_detectado: string | null;
  agente_avaliador_id: string | null;
  criado_em: string;
  payload: any;
}[]> {
  const empresaId = await getSaasEmpresaId();
  const { data, error } = await (supabase as any)
    .schema('saas')
    .from('analises_ia')
    .select('id,entidade_id,score,resumo,chain_log,tipo_reuniao_detectado,agente_avaliador_id,criado_em,payload')
    .eq('empresa_id', empresaId)
    .eq('tipo_contexto', 'reuniao')
    .not('chain_log', 'is', null)
    .order('criado_em', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[Evaluation] Load chain logs error:', error);
    return [];
  }
  return (data || []) as any[];
}
