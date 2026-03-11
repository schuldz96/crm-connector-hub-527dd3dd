/**
 * Multi-agent evaluation engine for meetings.
 * Flow: Gerente → Classificador → Avaliador específico
 */
import { supabase } from '@/integrations/supabase/client';
import { getSaasEmpresaId } from '@/lib/saas';
import { callOpenAI } from '@/lib/openaiProxy';
import { loadAgentTree, loadAgentFiles, buildAgentTree, type AgentNode } from '@/lib/agentService';
import { parseTranscriptParticipation, type EvaluationResult } from '@/lib/evaluationService';

interface ChainStep {
  agente: string;
  tipo: string;
  input_resumo: string;
  output_resumo: string;
  duracao_ms: number;
}

export interface MultiAgentResult extends EvaluationResult {
  tipoReuniao: string;
  agenteAvaliadorId: string;
  chainLog: ChainStep[];
  participation: { email: string; name: string; percent: number }[];
}

// ─── Step 1: Classificador — detect meeting type ─────────────────────────────
async function classifyMeeting(
  classificador: AgentNode,
  apiToken: string,
  titulo: string,
  transcricao: string,
  avaliadorNames: string[],
): Promise<{ tipo: string; confianca: number }> {
  const tiposDisponiveis = avaliadorNames.map(n => `"${n}"`).join(', ');

  const prompt = `Classifique o tipo desta reunião.

TIPOS DISPONÍVEIS: [${tiposDisponiveis}]

TÍTULO: ${titulo}

INÍCIO DA TRANSCRIÇÃO:
${transcricao.slice(0, 3000)}

Responda APENAS com JSON válido (sem markdown):
{"tipo": "<um dos tipos disponíveis acima>", "confianca": <0-100>}`;

  const data = await callOpenAI(apiToken, {
    model: classificador.modelo_ia || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: classificador.prompt_sistema },
      { role: 'user', content: prompt },
    ],
    temperature: 0,
    max_tokens: 200,
  });

  const raw = (data.choices?.[0]?.message?.content || '').replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  try {
    return JSON.parse(raw);
  } catch {
    return { tipo: avaliadorNames[0] || 'default', confianca: 50 };
  }
}

// ─── Step 2: Avaliador — evaluate with specific criteria + files ─────────────
async function evaluateWithAgent(
  avaliador: AgentNode,
  apiToken: string,
  titulo: string,
  transcricao: string,
  fileTexts: string[],
): Promise<EvaluationResult> {
  const criteriaText = (avaliador.criterios || []).map((c: any) =>
    `- ${c.label} (peso ${c.weight}%): ${c.description}. Sinais positivos: ${(c.positiveSignals || []).join(', ') || 'N/A'}. Sinais negativos: ${(c.negativeSignals || []).join(', ') || 'N/A'}.`
  ).join('\n');

  let fileContext = '';
  if (fileTexts.length > 0) {
    fileContext = `\n\nMATERIAL DE REFERÊNCIA (use para avaliar se o vendedor segue as boas práticas):\n${fileTexts.join('\n---\n').slice(0, 8000)}`;
  }

  const userPrompt = `Analise a seguinte transcrição de reunião.

REUNIÃO: ${titulo}

CRITÉRIOS DE AVALIAÇÃO:
${criteriaText}
${fileContext}

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
    model: avaliador.modelo_ia || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: avaliador.prompt_sistema },
      { role: 'user', content: userPrompt },
    ],
    temperature: avaliador.temperatura ?? 0,
    max_tokens: 2000,
  });

  const raw = (data.choices?.[0]?.message?.content || '').replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(raw);
}

// ─── Main: run the full multi-agent chain ────────────────────────────────────
export async function evaluateMeetingMultiAgent(
  apiToken: string,
  reuniaoId: string,
  titulo: string,
  transcricao: string,
  vendedorId: string | null,
  participantEmails?: string[],
): Promise<MultiAgentResult | null> {
  if (!apiToken || !transcricao) return null;

  const agents = await loadAgentTree();
  const { gerente, classificador, avaliadores } = buildAgentTree(agents);

  if (!classificador || avaliadores.length === 0) return null;

  const chainLog: ChainStep[] = [];
  const activeAvaliadores = avaliadores.filter(a => a.ativo);

  // Step 1: Classify
  let selectedAvaliador: AgentNode;
  let tipoReuniao = '';

  if (activeAvaliadores.length === 1) {
    // Only one avaliador, skip classification
    selectedAvaliador = activeAvaliadores[0];
    tipoReuniao = selectedAvaliador.nome;
    chainLog.push({
      agente: 'Classificador', tipo: 'classificador',
      input_resumo: 'Apenas 1 avaliador ativo — classificação pulada',
      output_resumo: `Tipo: ${tipoReuniao}`, duracao_ms: 0,
    });
  } else {
    const t0 = Date.now();
    const classification = await classifyMeeting(
      classificador, apiToken, titulo, transcricao,
      activeAvaliadores.map(a => a.nome),
    );
    tipoReuniao = classification.tipo;
    chainLog.push({
      agente: classificador.nome, tipo: 'classificador',
      input_resumo: `Título: ${titulo}`,
      output_resumo: `Tipo: ${tipoReuniao} (confiança: ${classification.confianca}%)`,
      duracao_ms: Date.now() - t0,
    });

    // Find matching avaliador (fuzzy match by name)
    selectedAvaliador = activeAvaliadores.find(a =>
      a.nome.toLowerCase() === tipoReuniao.toLowerCase()
    ) || activeAvaliadores.find(a =>
      tipoReuniao.toLowerCase().includes(a.nome.toLowerCase()) ||
      a.nome.toLowerCase().includes(tipoReuniao.toLowerCase())
    ) || activeAvaliadores[0];
  }

  // Step 2: Load reference files for the selected avaliador
  const files = await loadAgentFiles(selectedAvaliador.id);
  const fileTexts = files
    .filter(f => f.texto_extraido && f.texto_extraido.length > 0)
    .map(f => `[${f.nome}]\n${f.texto_extraido}`);

  // Step 3: Evaluate
  const t1 = Date.now();
  const result = await evaluateWithAgent(selectedAvaliador, apiToken, titulo, transcricao, fileTexts);
  chainLog.push({
    agente: selectedAvaliador.nome, tipo: 'avaliador',
    input_resumo: `Transcrição: ${transcricao.length} chars, ${fileTexts.length} arquivos ref`,
    output_resumo: `Score: ${result.totalScore}, ${result.criteriaScores?.length || 0} critérios`,
    duracao_ms: Date.now() - t1,
  });

  // Calculate participation deterministically
  const participation = parseTranscriptParticipation(transcricao, participantEmails || []);

  // Persist to DB
  const empresaId = await getSaasEmpresaId();
  const scoreVal = Math.round(result.totalScore);

  // Delete existing
  await (supabase as any)
    .schema('saas')
    .from('analises_ia')
    .delete()
    .eq('tipo_contexto', 'reuniao')
    .eq('entidade_id', reuniaoId);

  // Insert new
  const { error: insertErr } = await (supabase as any)
    .schema('saas')
    .from('analises_ia')
    .insert({
      empresa_id: empresaId,
      tipo_contexto: 'reuniao',
      entidade_id: reuniaoId,
      vendedor_id: vendedorId,
      agente_avaliador_id: selectedAvaliador.id,
      tipo_reuniao_detectado: tipoReuniao,
      chain_log: chainLog,
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

  if (insertErr) console.error('[multiAgent] Insert failed:', insertErr);

  // Update reunioes
  await (supabase as any)
    .schema('saas')
    .from('reunioes')
    .update({ score: scoreVal, analisada_por_ia: true })
    .eq('id', reuniaoId);

  return {
    ...result,
    tipoReuniao,
    agenteAvaliadorId: selectedAvaliador.id,
    chainLog,
    participation,
  };
}
