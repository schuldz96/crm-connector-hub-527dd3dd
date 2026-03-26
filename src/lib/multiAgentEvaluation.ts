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
  participation: { email?: string; name: string; percent: number }[];
  sentimento?: string;
  sentimentoConfianca?: number;
  sentimentoResumo?: string;
}

export interface MultiAgentResults {
  results: MultiAgentResult[];
  primaryResult: MultiAgentResult;
  sentimento?: string;
  sentimentoConfianca?: number;
  sentimentoResumo?: string;
  chainLog: ChainStep[];
  participation: { email?: string; name: string; percent: number }[];
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

// ─── Step 3: Sentimental — classify relationship level ───────────────────────
async function analyzeSentiment(
  sentimental: AgentNode,
  apiToken: string,
  titulo: string,
  transcricao: string,
): Promise<{ sentimento: string; confianca: number; resumo: string }> {
  const criteriaText = (sentimental.criterios || []).map((c: any) =>
    `- ${c.label} (peso ${c.weight}%): ${c.description}`
  ).join('\n');

  const prompt = `Analise a transcrição e classifique o nível de relacionamento.

REUNIÃO: ${titulo}

CRITÉRIOS:
${criteriaText}

TRANSCRIÇÃO:
${transcricao.slice(0, 10000)}

Responda APENAS com JSON válido (sem markdown):
{"sentimento": "<Positivo|Neutro|Negativo|Preocupado|Frustrado>", "confianca": <0-100>, "resumo": "<1-2 frases>"}`;

  const data = await callOpenAI(apiToken, {
    model: sentimental.modelo_ia || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: sentimental.prompt_sistema },
      { role: 'user', content: prompt },
    ],
    temperature: 0,
    max_tokens: 300,
  });

  const raw = (data.choices?.[0]?.message?.content || '').replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  try {
    return JSON.parse(raw);
  } catch {
    return { sentimento: 'Neutro', confianca: 50, resumo: 'Não foi possível analisar o sentimento.' };
  }
}

// ─── Main: run the full multi-agent chain (ALL active avaliadores) ───────────
export async function evaluateMeetingMultiAgent(
  apiToken: string,
  reuniaoId: string,
  titulo: string,
  transcricao: string,
  vendedorId: string | null,
  participantEmails?: string[],
): Promise<MultiAgentResults | null> {
  if (!apiToken || !transcricao) return null;

  const agents = await loadAgentTree();
  const { gerente, classificador, avaliadores, sentimentais } = buildAgentTree(agents);

  if (!classificador || avaliadores.length === 0) return null;

  const chainLog: ChainStep[] = [];
  const activeAvaliadores = avaliadores.filter(a => a.ativo);

  // Step 1: Classify (to determine the primary avaliador)
  let primaryAvaliador: AgentNode;
  let tipoReuniao = '';

  if (activeAvaliadores.length === 1) {
    primaryAvaliador = activeAvaliadores[0];
    tipoReuniao = primaryAvaliador.nome;
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

    const exactMatch = activeAvaliadores.find(a =>
      a.nome.toLowerCase() === tipoReuniao.toLowerCase()
    );
    const fuzzyMatch = !exactMatch ? activeAvaliadores.find(a =>
      tipoReuniao.toLowerCase().includes(a.nome.toLowerCase()) ||
      a.nome.toLowerCase().includes(tipoReuniao.toLowerCase())
    ) : null;
    const fallbackAgent = activeAvaliadores.find(a =>
      /fallback|padr[aã]o|default|geral/i.test(a.nome)
    ) || activeAvaliadores[0];

    primaryAvaliador = exactMatch || fuzzyMatch || fallbackAgent;

    if (!exactMatch && !fuzzyMatch) {
      chainLog.push({
        agente: 'Fallback', tipo: 'fallback',
        input_resumo: `Classificação "${tipoReuniao}" não encontrou avaliador correspondente`,
        output_resumo: `Usando fallback: ${primaryAvaliador.nome}`,
        duracao_ms: 0,
      });
    }
  }

  // Step 2: Evaluate ALL active avaliadores in parallel
  console.log(`[multiAgent] Evaluating with ${activeAvaliadores.length} agents: ${activeAvaliadores.map(a => a.nome).join(', ')}`);

  // Run evaluations SEQUENTIALLY (avoid OpenAI rate limits with parallel calls)
  const evalResults: { avaliador: AgentNode; result: EvaluationResult; step: ChainStep }[] = [];

  for (const avaliador of activeAvaliadores) {
    try {
      const files = await loadAgentFiles(avaliador.id);
      const fileTexts = files
        .filter(f => f.texto_extraido && f.texto_extraido.length > 0)
        .map(f => `[${f.nome}]\n${f.texto_extraido}`);

      const t1 = Date.now();
      console.log(`[multiAgent] → Evaluating: ${avaliador.nome}...`);
      const result = await evaluateWithAgent(avaliador, apiToken, titulo, transcricao, fileTexts);
      const step: ChainStep = {
        agente: avaliador.nome, tipo: 'avaliador',
        input_resumo: `Transcrição: ${transcricao.length} chars, ${fileTexts.length} arquivos ref`,
        output_resumo: `Score: ${result.totalScore}, ${result.criteriaScores?.length || 0} critérios`,
        duracao_ms: Date.now() - t1,
      };
      console.log(`[multiAgent] ✓ ${avaliador.nome}: score ${result.totalScore} (${Date.now() - t1}ms)`);
      evalResults.push({ avaliador, result, step });
    } catch (err: any) {
      console.error(`[multiAgent] ✗ ${avaliador.nome} failed:`, err.message || err);
    }
  }

  console.log(`[multiAgent] ${evalResults.length}/${activeAvaliadores.length} evaluations succeeded`);

  if (evalResults.length === 0) {
    console.error('[multiAgent] All evaluations failed');
    return null;
  }

  // Add all avaliador steps to chainLog
  for (const er of evalResults) {
    chainLog.push(er.step);
  }

  // Step 3: Sentiment analysis
  let sentimento: string | undefined;
  let sentimentoConfianca: number | undefined;
  let sentimentoResumo: string | undefined;

  const activeSentimentais = sentimentais.filter(a => a.ativo);
  if (activeSentimentais.length > 0) {
    const sentimentalAgent = activeSentimentais[0];
    const t2 = Date.now();
    try {
      const sentResult = await analyzeSentiment(sentimentalAgent, apiToken, titulo, transcricao);
      sentimento = sentResult.sentimento;
      sentimentoConfianca = sentResult.confianca;
      sentimentoResumo = sentResult.resumo;
      chainLog.push({
        agente: sentimentalAgent.nome, tipo: 'sentimental',
        input_resumo: `Transcrição: ${transcricao.length} chars`,
        output_resumo: `Sentimento: ${sentimento} (${sentimentoConfianca}%)`,
        duracao_ms: Date.now() - t2,
      });
    } catch (e) {
      console.error('[multiAgent] Sentiment analysis failed:', e);
      chainLog.push({
        agente: sentimentalAgent.nome, tipo: 'sentimental',
        input_resumo: `Transcrição: ${transcricao.length} chars`,
        output_resumo: `Erro na análise de sentimento`,
        duracao_ms: Date.now() - t2,
      });
    }
  }

  // Calculate participation deterministically
  const participation = parseTranscriptParticipation(transcricao, participantEmails || []);

  // Persist to DB — delete ALL existing evaluations for this meeting
  const empresaId = await getSaasEmpresaId();

  await (supabase as any)
    .schema('saas')
    .from('analises_ia')
    .delete()
    .eq('tipo_contexto', 'reuniao')
    .eq('entidade_id', reuniaoId);

  // Determine primary result — ALWAYS prefer Sandler for the main score
  const sandlerResult = evalResults.find(er => /sandler/i.test(er.avaliador.nome));
  const primaryEvalResult = sandlerResult || evalResults.find(er => er.avaliador.id === primaryAvaliador.id) || evalResults[0];
  const primaryScoreVal = Math.round(primaryEvalResult.result.totalScore);

  // Insert ONE row PER avaliador
  const allResults: MultiAgentResult[] = [];

  for (const er of evalResults) {
    const isPrimary = er.avaliador.id === primaryAvaliador.id;
    const scoreVal = Math.round(er.result.totalScore);

    const { error: insertErr } = await (supabase as any)
      .schema('saas')
      .from('analises_ia')
      .insert({
        empresa_id: empresaId,
        tipo_contexto: 'reuniao',
        entidade_id: reuniaoId,
        vendedor_id: vendedorId,
        agente_avaliador_id: er.avaliador.id,
        tipo_reuniao_detectado: er.avaliador.nome,
        chain_log: isPrimary ? chainLog : [er.step],
        score: scoreVal,
        criterios: er.result.criteriaScores,
        resumo: er.result.summary,
        payload: {
          insights: er.result.insights,
          criticalAlerts: er.result.criticalAlerts,
          titulo,
          participation,
          ...(isPrimary ? { sentimento, sentimentoConfianca, sentimentoResumo } : {}),
        },
      });

    if (insertErr) console.error(`[multiAgent] Insert failed for ${er.avaliador.nome}:`, insertErr);

    allResults.push({
      ...er.result,
      tipoReuniao: er.avaliador.nome,
      agenteAvaliadorId: er.avaliador.id,
      chainLog: isPrimary ? chainLog : [er.step],
      participation,
      ...(isPrimary ? { sentimento, sentimentoConfianca, sentimentoResumo } : {}),
    });
  }

  // Update reunioes with PRIMARY score
  const reuniaoUpdate: any = { score: primaryScoreVal, analisada_por_ia: true };
  if (sentimento) reuniaoUpdate.sentimento = sentimento;

  await (supabase as any)
    .schema('saas')
    .from('reunioes')
    .update(reuniaoUpdate)
    .eq('id', reuniaoId);

  const primaryMultiResult = allResults.find(r => r.agenteAvaliadorId === primaryAvaliador.id) || allResults[0];

  return {
    results: allResults,
    primaryResult: primaryMultiResult,
    sentimento,
    sentimentoConfianca,
    sentimentoResumo,
    chainLog,
    participation,
  };
}
