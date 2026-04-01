/**
 * Edge Function: evaluate-queue
 * Processador de fila de avaliações automáticas.
 *
 * Pega 1 item pendente da fila, avalia com TODOS os agentes multi-agente,
 * marca como concluída. Roda a cada 2 min via pg_cron.
 *
 * Fluxo:
 * 1. SELECT 1 item pendente (mais antigo) → marca como 'processando'
 * 2. Carrega agentes da empresa (meetings)
 * 3. Classifica a reunião
 * 4. Avalia com TODOS os avaliadores ativos (sequencial)
 * 5. Analisa sentimento
 * 6. Salva resultados em analises_ia (1 row por agente)
 * 7. Marca fila como 'concluida'
 * 8. Se erro → marca como 'erro' com mensagem, incrementa tentativas
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { decryptToken } from '../_shared/tokenCrypto.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { db: { schema: 'saas' } });
const log = (msg: string) => console.log(`[evaluate-queue] ${msg}`);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

// ─── OpenAI call via RPC ─────────────────────────────────────────────────────
async function callOpenAI(token: string, model: string, messages: any[], temperature = 0, maxTokens = 2000) {
  const { data, error } = await sb.rpc('openai_chat', {
    p_token: token,
    p_model: model || 'gpt-4o-mini',
    p_messages: JSON.stringify(messages),
    p_temperature: temperature,
    p_max_tokens: maxTokens,
  });
  if (error) throw new Error(`RPC error: ${error.message}`);
  if (data?.error) throw new Error(`OpenAI: ${data.error}`);
  return data;
}

function parseJSON(raw: string) {
  const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(clean);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    log('=== Processando fila ===');

    // 1. Pick oldest pending item
    const { data: item, error: pickErr } = await sb
      .from('fila_avaliacoes')
      .select('id, empresa_id, reuniao_id, tentativas')
      .eq('status', 'pendente')
      .order('criado_em', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (pickErr) throw pickErr;
    if (!item) {
      log('Fila vazia');
      return new Response(JSON.stringify({ message: 'Fila vazia' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    log(`Processando: reuniao=${item.reuniao_id} (tentativa ${item.tentativas + 1})`);

    // Mark as processing
    await sb.from('fila_avaliacoes').update({ status: 'processando', tentativas: item.tentativas + 1 }).eq('id', item.id);

    // 2. Load meeting
    const { data: reuniao } = await sb
      .from('reunioes')
      .select('id, titulo, transcricao, vendedor_id, participantes, empresa_id')
      .eq('id', item.reuniao_id)
      .single();

    if (!reuniao || !reuniao.transcricao) {
      await sb.from('fila_avaliacoes').update({ status: 'erro', erro: 'Reunião sem transcrição' }).eq('id', item.id);
      return new Response(JSON.stringify({ error: 'No transcription' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Load OpenAI token
    const { data: tokenRow } = await sb
      .from('tokens_ia_modulo')
      .select('token_criptografado, modelo')
      .eq('empresa_id', item.empresa_id)
      .eq('modulo_codigo', 'meetings')
      .eq('provedor', 'openai')
      .maybeSingle();

    if (!tokenRow?.token_criptografado) {
      await sb.from('fila_avaliacoes').update({ status: 'erro', erro: 'Token OpenAI não configurado' }).eq('id', item.id);
      return new Response(JSON.stringify({ error: 'No token' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiToken = await decryptToken(tokenRow.token_criptografado);
    const defaultModel = tokenRow.modelo || 'gpt-4o-mini';

    // 4. Load agent tree
    const { data: agents } = await sb
      .from('agentes_ia')
      .select('*')
      .eq('empresa_id', item.empresa_id)
      .eq('modulo', 'meetings')
      .order('ordem', { ascending: true });

    const allAgents = agents || [];
    const classificador = allAgents.find((a: any) => a.tipo === 'classificador' && a.ativo);
    const avaliadores = allAgents.filter((a: any) => a.tipo === 'avaliador' && a.ativo);
    const sentimentais = allAgents.filter((a: any) => a.tipo === 'sentimental' && a.ativo);

    if (avaliadores.length === 0) {
      await sb.from('fila_avaliacoes').update({ status: 'erro', erro: 'Nenhum agente avaliador ativo' }).eq('id', item.id);
      return new Response(JSON.stringify({ error: 'No evaluators' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 5. Classify meeting type
    let tipoReuniao = avaliadores[0].nome;
    if (classificador && avaliadores.length > 1) {
      try {
        const tipos = avaliadores.map((a: any) => `"${a.nome}"`).join(', ');
        const classResult = await callOpenAI(apiToken, classificador.modelo_ia || defaultModel, [
          { role: 'system', content: classificador.prompt_sistema },
          { role: 'user', content: `Classifique:\nTIPOS: [${tipos}]\nTÍTULO: ${reuniao.titulo}\nTRANSCRIÇÃO:\n${reuniao.transcricao.slice(0, 3000)}\nJSON: {"tipo":"<tipo>","confianca":<0-100>}` },
        ], 0, 200);
        const parsed = parseJSON(classResult.choices?.[0]?.message?.content || '{}');
        tipoReuniao = parsed.tipo || tipoReuniao;
        log(`Classificação: ${tipoReuniao}`);
      } catch (e: any) {
        log(`Classificação falhou: ${e.message}`);
      }
    }

    // 6. Delete old evaluations
    await sb.from('analises_ia').delete().eq('tipo_contexto', 'reuniao').eq('entidade_id', reuniao.id);

    // 7. Evaluate with ALL agents (sequential)
    let sandlerScore: number | null = null;

    for (const avaliador of avaliadores) {
      try {
        const criteriaText = (avaliador.criterios || []).map((c: any) =>
          `- ${c.label} (peso ${c.weight}%): ${c.description}`
        ).join('\n');

        const result = await callOpenAI(apiToken, avaliador.modelo_ia || defaultModel, [
          { role: 'system', content: avaliador.prompt_sistema },
          { role: 'user', content: `Analise:\nREUNIÃO: ${reuniao.titulo}\nCRITÉRIOS:\n${criteriaText}\nTRANSCRIÇÃO:\n${reuniao.transcricao.slice(0, 15000)}\nJSON: {"totalScore":<0-100>,"summary":"<resumo>","insights":"<insights>","criticalAlerts":[],"criteriaScores":[{"id":"<id>","label":"<nome>","weight":<peso>,"score":<0-100>,"feedback":"<feedback>"}]}` },
        ], 0, 2000);

        const parsed = parseJSON(result.choices?.[0]?.message?.content || '{}');
        const score = Math.round(parsed.totalScore || 0);

        // Save
        await sb.from('analises_ia').insert({
          empresa_id: item.empresa_id,
          tipo_contexto: 'reuniao',
          entidade_id: reuniao.id,
          vendedor_id: reuniao.vendedor_id,
          agente_avaliador_id: avaliador.id,
          tipo_reuniao_detectado: avaliador.nome,
          score,
          criterios: parsed.criteriaScores || [],
          resumo: parsed.summary || '',
          payload: { insights: parsed.insights, criticalAlerts: parsed.criticalAlerts, titulo: reuniao.titulo },
        });

        if (/sandler/i.test(avaliador.nome)) sandlerScore = score;
        log(`✓ ${avaliador.nome}: score ${score}`);
      } catch (e: any) {
        log(`✗ ${avaliador.nome} falhou: ${e.message}`);
      }
    }

    // 8. Sentiment analysis
    let sentimento = 'Neutro';
    if (sentimentais.length > 0) {
      try {
        const sa = sentimentais[0];
        const sentResult = await callOpenAI(apiToken, sa.modelo_ia || defaultModel, [
          { role: 'system', content: sa.prompt_sistema },
          { role: 'user', content: `Analise o sentimento:\n${reuniao.titulo}\n${reuniao.transcricao.slice(0, 10000)}\nJSON: {"sentimento":"<Positivo|Neutro|Negativo|Preocupado|Frustrado>","confianca":<0-100>,"resumo":"<resumo>"}` },
        ], 0, 300);
        const parsed = parseJSON(sentResult.choices?.[0]?.message?.content || '{}');
        sentimento = parsed.sentimento || 'Neutro';
        log(`Sentimento: ${sentimento}`);
      } catch { /* silent */ }
    }

    // 9. Update meeting with primary (Sandler) score
    const primaryScore = sandlerScore ?? 0;
    await sb.from('reunioes').update({ score: primaryScore, analisada_por_ia: true, sentimento }).eq('id', reuniao.id);

    // 10. Mark queue item as done
    await sb.from('fila_avaliacoes').update({ status: 'concluida', processado_em: new Date().toISOString() }).eq('id', item.id);

    log(`=== Concluído: ${reuniao.titulo} → score ${primaryScore} (${avaliadores.length} agentes) ===`);

    return new Response(JSON.stringify({
      success: true,
      reuniao_id: reuniao.id,
      score: primaryScore,
      agentes: avaliadores.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    log(`ERRO: ${e.message}`);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
