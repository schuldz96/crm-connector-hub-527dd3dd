/**
 * Edge Function: evaluate-cron
 * Roda todo dia à meia-noite para avaliar conversas WhatsApp e reuniões.
 *
 * Pode ser chamada manualmente via POST ou agendada via pg_cron + pg_net.
 * Header: Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { decryptToken } from '../_shared/tokenCrypto.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { db: { schema: 'saas' } });

// Evolution API config — loaded from DB, falls back to env vars
let _evoUrl = Deno.env.get('EVOLUTION_API_URL') || '';
let _evoToken = Deno.env.get('EVOLUTION_API_TOKEN') || '';

async function loadEvolutionConfig(empresaId: string): Promise<void> {
  try {
    const { data } = await sb.from('integracoes')
      .select('configuracao')
      .eq('empresa_id', empresaId)
      .eq('tipo', 'evolution_api')
      .eq('status', 'conectada')
      .limit(1)
      .maybeSingle();
    if (data?.configuracao?.url && data?.configuracao?.token_encrypted) {
      _evoUrl = data.configuracao.url;
      _evoToken = await decryptToken(data.configuracao.token_encrypted);
    }
  } catch { /* keep env fallback */ }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

// ─── OpenAI call via RPC ─────────────────────────────────────────────────────
async function callOpenAI(token: string, model: string, messages: any[]) {
  const { data, error } = await sb.rpc('openai_chat', {
    p_token: token,
    p_model: model || 'gpt-4o-mini',
    p_messages: JSON.stringify(messages),
    p_temperature: 0.3,
    p_max_tokens: 1500,
  });
  if (error) throw new Error(`RPC error: ${error.message}`);
  if (data?.error) throw new Error(`OpenAI: ${data.error}`);
  return data;
}

// ─── Fetch messages from Evolution API ───────────────────────────────────────
async function fetchEvolutionMessages(instanceName: string, remoteJid: string): Promise<any[]> {
  try {
    const res = await fetch(`${_evoUrl}/chat/findMessages/${instanceName}`, {
      method: 'POST',
      headers: { apikey: _evoToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        where: { key: { remoteJid } },
        limit: 100,
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const records = data?.messages?.records || (Array.isArray(data) ? data : []);
    return records;
  } catch {
    return [];
  }
}

// ─── Build evaluation prompt ─────────────────────────────────────────────────
function buildPrompt(criteria: any[], transcript: string, type: 'whatsapp' | 'reuniao') {
  const criteriaText = criteria.map((c: any) =>
    `- ${c.label} (peso ${c.weight}%): ${c.description}. Sinais positivos: ${(c.positiveSignals || []).join(', ') || 'N/A'}. Sinais negativos: ${(c.negativeSignals || []).join(', ') || 'N/A'}.`
  ).join('\n');

  const context = type === 'whatsapp'
    ? 'a seguinte conversa de WhatsApp entre um vendedor e um lead'
    : 'a seguinte transcrição de reunião de vendas';

  return `Analise ${context}.

CRITÉRIOS DE AVALIAÇÃO:
${criteriaText}

${type === 'whatsapp' ? 'CONVERSA' : 'TRANSCRIÇÃO'}:
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
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const logs: string[] = [];
  const log = (msg: string) => { logs.push(`[${new Date().toISOString()}] ${msg}`); console.log(msg); };

  try {
    log('=== Início avaliação automática ===');

    // 1. Get empresa
    const { data: empresa } = await sb.from('empresas').select('id').limit(1).single();
    if (!empresa) throw new Error('Nenhuma empresa encontrada');
    const empresaId = empresa.id;
    log(`Empresa: ${empresaId}`);

    // 1b. Load Evolution API config from DB (falls back to env)
    await loadEvolutionConfig(empresaId);
    log(`Evolution API: ${_evoUrl ? _evoUrl : '(não configurada)'}`);

    // 2. Get OpenAI tokens
    const { data: tokens } = await sb.from('tokens_ia_modulo')
      .select('modulo_codigo,token_criptografado,modelo')
      .eq('empresa_id', empresaId)
      .eq('provedor', 'openai');

    const tokenMap: Record<string, { token: string; model: string }> = {};
    for (const t of tokens || []) {
      if (t.token_criptografado) {
        const decrypted = await decryptToken(t.token_criptografado);
        tokenMap[t.modulo_codigo] = { token: decrypted, model: t.modelo || 'gpt-4o-mini' };
      }
    }
    log(`Tokens encontrados: ${Object.keys(tokenMap).join(', ')}`);

    // 3. Get AI criteria
    const { data: configs } = await sb.from('configuracoes_ia')
      .select('modulo_codigo,criterios,prompt_sistema')
      .eq('empresa_id', empresaId);

    const criteriaMap: Record<string, { criterios: any[]; prompt: string }> = {};
    for (const c of configs || []) {
      criteriaMap[c.modulo_codigo] = {
        criterios: c.criterios || [],
        prompt: c.prompt_sistema || '',
      };
    }

    const today = new Date().toISOString().split('T')[0];
    let waEvaluated = 0;
    let meetEvaluated = 0;

    // ═══ WHATSAPP EVALUATION ═══════════════════════════════════════════════
    if (tokenMap.whatsapp) {
      const waToken = tokenMap.whatsapp;
      const waCriteria = criteriaMap.whatsapp?.criterios?.length
        ? criteriaMap.whatsapp.criterios
        : [
            { id: 'response_time', label: 'Tempo de Resposta', weight: 15, description: 'Velocidade e consistência nas respostas', positiveSignals: [], negativeSignals: [] },
            { id: 'engagement', label: 'Engajamento', weight: 25, description: 'Capacidade de manter o lead engajado', positiveSignals: [], negativeSignals: [] },
            { id: 'qualification', label: 'Qualificação', weight: 25, description: 'Identificação de perfil, budget e timing', positiveSignals: [], negativeSignals: [] },
            { id: 'cta', label: 'CTA e Next Steps', weight: 20, description: 'Clareza nas chamadas para ação', positiveSignals: [], negativeSignals: [] },
            { id: 'tone', label: 'Tom e Linguagem', weight: 15, description: 'Adequação do vocabulário e tom', positiveSignals: [], negativeSignals: [] },
          ];
      const waPrompt = criteriaMap.whatsapp?.prompt || 'Você é um especialista em vendas digitais e atendimento via WhatsApp.';

      // Get all connected instances
      const { data: instances } = await sb.from('instancias_whatsapp')
        .select('id,nome,usuario_id')
        .eq('empresa_id', empresaId)
        .eq('status', 'conectada');

      log(`Instâncias WhatsApp conectadas: ${instances?.length || 0}`);

      for (const inst of instances || []) {
        // Get conversations with recent activity
        const { data: convs } = await sb.from('conversas_whatsapp')
          .select('id,contato_telefone,contato_nome')
          .eq('instancia_id', inst.id)
          .gte('ultima_mensagem_em', `${today}T00:00:00`)
          .lt('ultima_mensagem_em', `${today}T23:59:59`);

        log(`Instância ${inst.nome}: ${convs?.length || 0} conversas hoje`);

        for (const conv of convs || []) {
          // Check if already evaluated today
          const { data: existing } = await sb.from('analises_ia')
            .select('id')
            .eq('tipo_contexto', 'whatsapp')
            .eq('instancia_nome', inst.nome)
            .eq('contato_telefone', conv.contato_telefone)
            .eq('periodo_ref', today)
            .maybeSingle();

          if (existing) {
            log(`  Já avaliada: ${conv.contato_nome || conv.contato_telefone}`);
            continue;
          }

          // Fetch messages from Evolution
          const jid = conv.contato_telefone.replace(/\D/g, '') + '@s.whatsapp.net';
          const rawMsgs = await fetchEvolutionMessages(inst.nome, jid);

          if (rawMsgs.length < 3) {
            log(`  Poucas mensagens (${rawMsgs.length}): ${conv.contato_nome || conv.contato_telefone}`);
            continue;
          }

          // Build transcript
          const transcript = rawMsgs
            .filter((m: any) => m.messageType !== 'protocolMessage' && m.messageType !== 'reactionMessage')
            .map((m: any) => {
              const fromMe = m.key?.fromMe === true;
              const body = m.message?.conversation || m.message?.extendedTextMessage?.text || `[${m.messageType || 'mídia'}]`;
              return `[${fromMe ? 'VENDEDOR' : 'LEAD'}] ${body}`;
            })
            .join('\n');

          if (transcript.length < 50) continue;

          try {
            const userPrompt = buildPrompt(waCriteria, transcript, 'whatsapp');
            const result = await callOpenAI(waToken.token, waToken.model, [
              { role: 'system', content: waPrompt },
              { role: 'user', content: userPrompt },
            ]);

            const raw = result.choices?.[0]?.message?.content || '';
            const jsonStr = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            const parsed = JSON.parse(jsonStr);

            await sb.from('analises_ia').insert({
              empresa_id: empresaId,
              tipo_contexto: 'whatsapp',
              vendedor_id: inst.usuario_id,
              instancia_nome: inst.nome,
              contato_telefone: conv.contato_telefone,
              periodo_ref: today,
              score: Math.round(parsed.totalScore),
              criterios: parsed.criteriaScores,
              resumo: parsed.summary,
              payload: { insights: parsed.insights, criticalAlerts: parsed.criticalAlerts, contactName: conv.contato_nome },
            });

            waEvaluated++;
            log(`  Avaliada: ${conv.contato_nome || conv.contato_telefone} → ${parsed.totalScore}`);
          } catch (e: any) {
            log(`  ERRO ao avaliar ${conv.contato_nome || conv.contato_telefone}: ${e.message}`);
          }
        }
      }
    } else {
      log('Token WhatsApp não configurado, pulando avaliação de conversas');
    }

    // ═══ MEETINGS EVALUATION ═══════════════════════════════════════════════
    if (tokenMap.meetings) {
      const meetToken = tokenMap.meetings;
      const meetCriteria = criteriaMap.meetings?.criterios?.length
        ? criteriaMap.meetings.criterios
        : [
            { id: 'rapport', label: 'Rapport', weight: 20, description: 'Conexão emocional com o cliente', positiveSignals: [], negativeSignals: [] },
            { id: 'discovery', label: 'Descoberta', weight: 25, description: 'Qualidade das perguntas de qualificação', positiveSignals: [], negativeSignals: [] },
            { id: 'presentation', label: 'Apresentação', weight: 20, description: 'Clareza da proposta de valor', positiveSignals: [], negativeSignals: [] },
            { id: 'objections', label: 'Objeções', weight: 20, description: 'Tratamento de objeções', positiveSignals: [], negativeSignals: [] },
            { id: 'next_steps', label: 'Próximos Passos', weight: 15, description: 'Clareza no fechamento', positiveSignals: [], negativeSignals: [] },
          ];
      const meetPrompt = criteriaMap.meetings?.prompt || 'Você é um avaliador especialista em vendas consultivas.';

      // Get meetings with transcription not yet evaluated
      const { data: meetings } = await sb.from('reunioes')
        .select('id,titulo,transcricao,vendedor_id')
        .eq('empresa_id', empresaId)
        .eq('status', 'concluida')
        .not('transcricao', 'is', null);

      log(`Reuniões com transcrição: ${meetings?.length || 0}`);

      for (const meet of meetings || []) {
        if (!meet.transcricao || meet.transcricao.length < 50) continue;

        // Check if already evaluated (skip if has valid score > 0)
        const { data: existing } = await sb.from('analises_ia')
          .select('id,score')
          .eq('tipo_contexto', 'reuniao')
          .eq('entidade_id', meet.id)
          .maybeSingle();

        if (existing && (existing as any).score > 0) {
          log(`  Já avaliada: ${meet.titulo}`);
          continue;
        }
        // If score is 0 or null, delete old analysis to re-evaluate
        if (existing) {
          await sb.from('analises_ia').delete().eq('id', existing.id);
          log(`  Reavaliando (score=0): ${meet.titulo}`);
        }

        try {
          const userPrompt = buildPrompt(meetCriteria, meet.transcricao, 'reuniao');
          const result = await callOpenAI(meetToken.token, meetToken.model, [
            { role: 'system', content: meetPrompt },
            { role: 'user', content: userPrompt },
          ]);

          const raw = result.choices?.[0]?.message?.content || '';
          const jsonStr = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          const parsed = JSON.parse(jsonStr);

          await sb.from('analises_ia').insert({
            empresa_id: empresaId,
            tipo_contexto: 'reuniao',
            entidade_id: meet.id,
            vendedor_id: meet.vendedor_id,
            score: Math.round(parsed.totalScore),
            criterios: parsed.criteriaScores,
            resumo: parsed.summary,
            payload: { insights: parsed.insights, criticalAlerts: parsed.criticalAlerts, titulo: meet.titulo },
          });

          // Update meeting record
          await sb.from('reunioes')
            .update({ score: Math.round(parsed.totalScore), analisada_por_ia: true })
            .eq('id', meet.id);

          meetEvaluated++;
          log(`  Avaliada: ${meet.titulo} → ${parsed.totalScore}`);
        } catch (e: any) {
          log(`  ERRO ao avaliar reunião ${meet.titulo}: ${e.message}`);
        }
      }
    } else {
      log('Token Meetings não configurado, pulando avaliação de reuniões');
    }

    log(`=== Concluído: ${waEvaluated} conversas + ${meetEvaluated} reuniões avaliadas ===`);

    return new Response(
      JSON.stringify({ success: true, waEvaluated, meetEvaluated, logs }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e: any) {
    log(`ERRO FATAL: ${e.message}`);
    return new Response(
      JSON.stringify({ error: e.message, logs }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
