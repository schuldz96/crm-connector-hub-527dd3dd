/**
 * Edge Function: crm-ai-followup
 * Worker que processa follow-ups pendentes de conversas IA do CRM.
 * Roda a cada 30s (chamada via pg_cron ou setInterval no frontend).
 *
 * Lógica:
 * 1. Busca conversas IA ativas com follow-ups configurados
 * 2. Para cada conversa, verifica se o gatilho do follow-up foi atingido
 * 3. Se sim, envia a mensagem e registra na memória
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { decryptToken } from '../_shared/tokenCrypto.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { db: { schema: 'saas' } });

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const logs: string[] = [];
  const log = (msg: string) => { logs.push(`[${new Date().toISOString()}] ${msg}`); };
  let sent = 0;

  try {
    // 1. Get all active AI conversations
    const { data: conversations, error: convErr } = await sb.from('crm_ai_conversations')
      .select('*')
      .eq('status', 'active');

    if (convErr) { log(`Erro ao buscar conversas: ${convErr.message}`); return jsonRes({ error: convErr.message, logs }, 500); }
    if (!conversations?.length) { return jsonRes({ success: true, sent: 0, checked: 0, logs }); }

    log(`${conversations.length} conversa(s) ativa(s) encontrada(s)`);

    for (const conv of conversations) {
      try {
        // 2. Get stage AI config (followups + transições)
        const { data: config } = await sb.from('crm_estagio_ia_config')
          .select('followups, transicoes, perguntas, provider, instancia_id, prompt_sistema, auto_complemento')
          .eq('estagio_id', conv.estagio_id)
          .eq('empresa_id', conv.empresa_id)
          .maybeSingle();

        if (!config) continue;

        // 2b. Avaliar transições automáticas
        const transicoes = (config.transicoes || []) as any[];
        if (transicoes.length > 0) {
          const transitionFired = await evaluateTransitions(conv, transicoes, config, log);
          if (transitionFired) {
            // Conversa foi movida — não processa follow-ups deste estágio
            continue;
          }
        }

        if (!config.followups?.length) continue;

        const followups = config.followups as any[];
        const msgs = (conv.mensagens || []) as any[];
        const convCreatedAt = new Date(conv.criado_em).getTime();
        const now = Date.now();

        for (const fu of followups) {
          // Check if already sent this follow-up
          const sendCount = msgs.filter((m: any) => m.followup_id === fu.id).length;
          const alreadySent = sendCount > 0;

          // Not reinscription: send only once
          if (alreadySent && !fu.allowReinscription) continue;

          // Reinscription limit: max 3 resends
          const MAX_REINSCRIPTIONS = 3;
          if (alreadySent && fu.allowReinscription && sendCount >= MAX_REINSCRIPTIONS) continue;

          // Check trigger
          const trigger = fu.triggers?.[0]; // 1 trigger per follow-up
          if (!trigger) continue;

          let shouldFire = false;
          const value = trigger.value || 1;
          const unit = trigger.unit || 'minutes';
          const msMap: Record<string, number> = { seconds: 1000, minutes: 60000, hours: 3600000, days: 86400000 };
          const delayMs = value * (msMap[unit] || 60000);

          if (trigger.type === 'time') {
            if (!alreadySent) {
              // First send: time since conversation was created
              const elapsed = now - convCreatedAt;
              if (elapsed >= delayMs) shouldFire = true;
            } else if (fu.allowReinscription) {
              // Reinscription: time since last follow-up send
              const lastSend = msgs.filter((m: any) => m.followup_id === fu.id).pop();
              if (lastSend) {
                const lastSendTime = new Date(lastSend.timestamp).getTime();
                if (now - lastSendTime >= delayMs) shouldFire = true;
              }
            }
          }

          if (trigger.type === 'no_response') {
            // Time since last assistant message (any, not just this follow-up)
            const lastMsg = [...msgs].reverse().find((m: any) => m.role === 'assistant');
            if (lastMsg) {
              const elapsed = now - new Date(lastMsg.timestamp).getTime();
              if (elapsed >= delayMs) {
                if (!alreadySent) shouldFire = true;
                else if (fu.allowReinscription) {
                  const lastFuSend = msgs.filter((m: any) => m.followup_id === fu.id).pop();
                  if (lastFuSend && now - new Date(lastFuSend.timestamp).getTime() >= delayMs) shouldFire = true;
                }
              }
            }
          }

          if (trigger.type === 'keyword') {
            // Keyword triggers are checked on message receipt, not in cron
            continue;
          }

          if (!shouldFire) continue;

          // 3. Get content to send
          const content = fu.content;
          if (!content) { log(`Follow-up ${fu.id} sem conteúdo. Pulando.`); continue; }

          // 4. Send message
          const phone = conv.contato_telefone;
          if (!phone) { log(`Conv ${conv.id}: sem telefone.`); continue; }

          let msgSent = false;
          let finalText = '';

          if (content.type === 'ai_generate') {
            // AI generates the message using system prompt + conversation memory
            const aiText = await generateAIMessage(conv.empresa_id, conv.estagio_id, msgs, content.text, log);
            if (aiText) {
              finalText = aiText;
              msgSent = await sendText(conv.empresa_id, config.provider, config.instancia_id, phone, aiText, log);
            }
          } else if (content.type === 'text' && content.text) {
            finalText = content.text;
            msgSent = await sendText(conv.empresa_id, config.provider, config.instancia_id, phone, content.text, log);
          } else if (['image', 'audio', 'video'].includes(content.type) && content.mediaUrl) {
            finalText = `[${content.type}] ${content.mediaUrl}`;
            msgSent = await sendMedia(conv.empresa_id, config.provider, config.instancia_id, phone, content.type, content.mediaUrl, content.text, log);
          }

          if (msgSent) {
            // 5. Record in memory
            msgs.push({
              role: 'assistant',
              content: finalText,
              timestamp: new Date().toISOString(),
              followup_id: fu.id,
              type: content.type === 'ai_generate' ? 'ai_followup' : 'followup',
            });

            await sb.from('crm_ai_conversations')
              .update({ mensagens: msgs, total_mensagens: msgs.length, ultima_mensagem_em: new Date().toISOString() })
              .eq('id', conv.id);

            log(`✓ Follow-up "${fu.id}" enviado para ${phone} (conv ${conv.id})`);
            sent++;
          }
        }
      } catch (e: any) {
        log(`Erro na conv ${conv.id}: ${e.message}`);
      }
    }

    log(`=== Processado: ${sent} follow-up(s) enviado(s) ===`);
    return jsonRes({ success: true, sent, checked: conversations.length, logs });

  } catch (e: any) {
    log(`ERRO GERAL: ${e.message}`);
    return jsonRes({ error: e.message, logs }, 500);
  }
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function jsonRes(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function getEvolutionConfig(empresaId: string): Promise<{ url: string; token: string } | null> {
  try {
    const { data: rows } = await sb.from('integracoes')
      .select('configuracao')
      .eq('empresa_id', empresaId)
      .eq('tipo', 'evolution_api')
      .eq('status', 'conectada');
    const integ = (rows || []).find((r: any) => r.configuracao?.token_encrypted) || (rows || [])[0];
    if (integ?.configuracao?.url && integ?.configuracao?.token_encrypted) {
      const token = await decryptToken(integ.configuracao.token_encrypted);
      return { url: integ.configuracao.url, token };
    }
    const url = Deno.env.get('EVOLUTION_API_URL') || '';
    const token = Deno.env.get('EVOLUTION_API_TOKEN') || '';
    if (url && token) return { url, token };
  } catch { /* */ }
  return null;
}

async function sendText(
  empresaId: string, provider: string, instance: string, phone: string, text: string, log: (msg: string) => void,
): Promise<boolean> {
  if (provider === 'evolution') {
    const evo = await getEvolutionConfig(empresaId);
    if (!evo) { log('Evolution não configurada'); return false; }
    try {
      const res = await fetch(`${evo.url}/message/sendText/${instance}`, {
        method: 'POST',
        headers: { apikey: evo.token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: phone.replace(/\D/g, ''), text }),
      });
      if (!res.ok) { log(`Evolution HTTP ${res.status}`); return false; }
      return true;
    } catch (e: any) { log(`Evolution error: ${e.message}`); return false; }
  }
  // Meta — TODO when needed
  log(`Provider ${provider} não suportado para follow-ups (ainda)`);
  return false;
}

async function sendMedia(
  empresaId: string, provider: string, instance: string, phone: string,
  mediaType: string, mediaUrl: string, caption: string | undefined, log: (msg: string) => void,
): Promise<boolean> {
  if (provider === 'evolution') {
    const evo = await getEvolutionConfig(empresaId);
    if (!evo) { log('Evolution não configurada'); return false; }
    try {
      const res = await fetch(`${evo.url}/message/sendMedia/${instance}`, {
        method: 'POST',
        headers: { apikey: evo.token, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          number: phone.replace(/\D/g, ''),
          mediatype: mediaType,
          media: mediaUrl,
          caption: caption || '',
        }),
      });
      if (!res.ok) { log(`Evolution media HTTP ${res.status}`); return false; }
      return true;
    } catch (e: any) { log(`Evolution media error: ${e.message}`); return false; }
  }
  log(`Provider ${provider} não suportado para media follow-ups (ainda)`);
  return false;
}

// ── Transition Evaluation ──────────────────────────────────────────────────

async function evaluateTransitions(
  conv: any, transicoes: any[], config: any, log: (msg: string) => void,
): Promise<boolean> {
  const msgs = (conv.mensagens || []) as any[];
  const now = Date.now();
  const convCreatedAt = new Date(conv.criado_em).getTime();
  const hasUserMessage = msgs.some((m: any) => m.role === 'user');
  const lastUserMsg = [...msgs].reverse().find((m: any) => m.role === 'user');
  const lastAssistantMsg = [...msgs].reverse().find((m: any) => m.role === 'assistant');

  for (const t of transicoes) {
    if (!t.stageId || !t.trigger) continue;

    let shouldMove = false;

    switch (t.trigger) {
      // welcome_sent é tratado no crm-ai-trigger, mas checamos aqui como fallback
      case 'welcome_sent': {
        const welcomeMsg = msgs.find((m: any) => m.role === 'assistant' && !m.followup_id);
        if (welcomeMsg) shouldMove = true;
        break;
      }

      case 'lead_replied': {
        if (hasUserMessage) shouldMove = true;
        break;
      }

      case 'lead_replied_positive': {
        if (lastUserMsg) {
          const verdict = await evaluateWithAI(
            conv.empresa_id, config,
            msgs,
            'Analise a ÚLTIMA resposta do lead. Responda APENAS "SIM" se a resposta é positiva (interesse, aceite, confirmação, entusiasmo, concordância) ou "NÃO" se não é positiva.',
            log,
          );
          if (verdict === 'SIM') shouldMove = true;
        }
        break;
      }

      case 'lead_replied_negative': {
        if (lastUserMsg) {
          const verdict = await evaluateWithAI(
            conv.empresa_id, config,
            msgs,
            'Analise a ÚLTIMA resposta do lead. Responda APENAS "SIM" se a resposta é negativa (rejeição, desinteresse, recusa, cancelamento, insatisfação) ou "NÃO" se não é negativa.',
            log,
          );
          if (verdict === 'SIM') shouldMove = true;
        }
        break;
      }

      case 'ai_decision': {
        if (lastUserMsg && t.config?.prompt) {
          const verdict = await evaluateWithAI(
            conv.empresa_id, config,
            msgs,
            `${t.config.prompt}\n\nResponda APENAS "SIM" ou "NÃO".`,
            log,
          );
          if (verdict === 'SIM') shouldMove = true;
        }
        break;
      }

      case 'no_response': {
        const timeoutHours = t.config?.timeout_hours || 24;
        const timeoutMs = timeoutHours * 3600000;
        // Verifica tempo desde a última mensagem do assistente sem resposta do lead
        if (lastAssistantMsg && !hasUserMessage) {
          const elapsed = now - new Date(lastAssistantMsg.timestamp).getTime();
          if (elapsed >= timeoutMs) shouldMove = true;
        } else if (lastAssistantMsg && lastUserMsg) {
          // Se o lead já respondeu alguma vez, verificar se a ÚLTIMA msg é do assistente e não houve resposta depois
          const lastMsgOverall = msgs[msgs.length - 1];
          if (lastMsgOverall?.role === 'assistant') {
            const elapsed = now - new Date(lastMsgOverall.timestamp).getTime();
            if (elapsed >= timeoutMs) shouldMove = true;
          }
        }
        break;
      }

      case 'keyword': {
        if (lastUserMsg && t.config?.keyword) {
          const keywords = t.config.keyword.split(',').map((k: string) => k.trim().toLowerCase()).filter(Boolean);
          const userText = (lastUserMsg.content || '').toLowerCase();
          if (keywords.some((kw: string) => userText.includes(kw))) shouldMove = true;
        }
        break;
      }

      case 'questions_completed': {
        const perguntas = (config.perguntas || []) as any[];
        if (perguntas.length > 0) {
          // Conta quantas perguntas do assistente foram respondidas (pares assistant→user)
          let answeredCount = 0;
          for (let i = 0; i < msgs.length - 1; i++) {
            if (msgs[i].role === 'assistant' && msgs[i].question_id && msgs[i + 1]?.role === 'user') {
              answeredCount++;
            }
          }
          // Também contar por user messages gerais (pergunta pode vir no fluxo natural)
          const userMsgCount = msgs.filter((m: any) => m.role === 'user').length;
          if (answeredCount >= perguntas.length || userMsgCount >= perguntas.length) {
            shouldMove = true;
          }
        }
        break;
      }
    }

    if (shouldMove) {
      log(`Transição ${t.trigger} → movendo ${conv.entidade_tipo} ${conv.entidade_id} para estágio ${t.stageId}`);
      const moveTable = conv.entidade_tipo === 'deal' ? 'crm_negocios' : 'crm_tickets';
      const { error: moveErr } = await sb.from(moveTable)
        .update({ estagio_id: t.stageId })
        .eq('id', conv.entidade_id);

      if (moveErr) {
        log(`Erro ao mover: ${moveErr.message}`);
        return false;
      }

      // Marcar conversa como completed (este estágio terminou) e atualizar estagio_id
      await sb.from('crm_ai_conversations')
        .update({ status: 'completed', estagio_id: t.stageId })
        .eq('id', conv.id);

      log(`✓ ${conv.entidade_tipo} movido para estágio ${t.stageId} (trigger: ${t.trigger})`);
      return true;
    }
  }

  return false;
}

async function evaluateWithAI(
  empresaId: string, config: any, msgs: any[], evaluationPrompt: string, log: (msg: string) => void,
): Promise<string> {
  try {
    // Get OpenAI token
    const { data: tokenRow } = await sb.from('tokens_ia_modulo')
      .select('token_criptografado, modelo')
      .eq('empresa_id', empresaId)
      .eq('modulo_codigo', 'whatsapp')
      .eq('provedor', 'openai')
      .maybeSingle();

    if (!tokenRow?.token_criptografado) { log('Sem token OpenAI para avaliação.'); return 'NÃO'; }

    const openaiToken = await decryptToken(tokenRow.token_criptografado);
    const model = tokenRow.modelo || 'gpt-4o-mini';

    let systemPrompt = config.prompt_sistema || 'Você é um assistente de vendas.';
    if (config.auto_complemento) systemPrompt += '\n\n' + config.auto_complemento;

    const openaiMsgs: { role: string; content: string }[] = [
      { role: 'system', content: systemPrompt },
    ];
    for (const m of msgs) {
      openaiMsgs.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content || '' });
    }
    openaiMsgs.push({ role: 'user', content: `[SISTEMA — AVALIAÇÃO DE TRANSIÇÃO]\n${evaluationPrompt}` });

    const { data: aiResult, error: rpcErr } = await sb.rpc('openai_chat', {
      p_token: openaiToken,
      p_model: model,
      p_messages: JSON.stringify(openaiMsgs),
      p_temperature: 0.1,
      p_max_tokens: 10,
    });

    if (rpcErr) { log(`Avaliação IA RPC error: ${rpcErr.message}`); return 'NÃO'; }
    const text = (aiResult?.choices?.[0]?.message?.content || aiResult?.content || '').trim().toUpperCase();
    log(`Avaliação IA (${evaluationPrompt.slice(0, 50)}...): ${text}`);
    return text.startsWith('SIM') ? 'SIM' : 'NÃO';
  } catch (e: any) {
    log(`Erro na avaliação IA: ${e.message}`);
    return 'NÃO';
  }
}

async function generateAIMessage(
  empresaId: string, estagioId: string, msgs: any[], followupHint: string | undefined, log: (msg: string) => void,
): Promise<string | null> {
  try {
    // Get stage config for system prompt
    const { data: config } = await sb.from('crm_estagio_ia_config')
      .select('prompt_sistema, auto_complemento, nome_ia')
      .eq('estagio_id', estagioId)
      .eq('empresa_id', empresaId)
      .maybeSingle();

    if (!config?.prompt_sistema) {
      log('Sem system prompt configurado para gerar mensagem IA.');
      return null;
    }

    // Get OpenAI token
    const { data: tokenRow } = await sb.from('tokens_ia_modulo')
      .select('token_criptografado, modelo')
      .eq('empresa_id', empresaId)
      .eq('modulo_codigo', 'whatsapp')
      .eq('provedor', 'openai')
      .maybeSingle();

    if (!tokenRow?.token_criptografado) {
      log('Sem token OpenAI configurado (módulo whatsapp).');
      return null;
    }

    const openaiToken = await decryptToken(tokenRow.token_criptografado);
    const model = tokenRow.modelo || 'gpt-4o-mini';

    // Build messages array for OpenAI
    let systemPrompt = config.prompt_sistema;
    if (config.auto_complemento) systemPrompt += '\n\n' + config.auto_complemento;
    if (followupHint) systemPrompt += `\n\nINSTRUÇÃO PARA ESTA MENSAGEM DE FOLLOW-UP:\n${followupHint}`;

    const openaiMsgs: { role: string; content: string }[] = [
      { role: 'system', content: systemPrompt },
    ];

    // Add conversation history (memory)
    for (const m of msgs) {
      openaiMsgs.push({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content || '',
      });
    }

    // Add follow-up instruction
    openaiMsgs.push({
      role: 'user',
      content: '[SISTEMA] O lead não respondeu. Envie uma mensagem de follow-up natural, mantendo o contexto da conversa. Seja breve e direto.',
    });

    log(`Gerando mensagem IA com ${openaiMsgs.length} msgs de contexto (model: ${model})`);

    // Call OpenAI via RPC (same pattern as evaluate-cron)
    const { data: aiResult, error: rpcErr } = await sb.rpc('openai_chat', {
      p_token: openaiToken,
      p_model: model,
      p_messages: JSON.stringify(openaiMsgs),
      p_temperature: 0.7,
      p_max_tokens: 500,
    });

    if (rpcErr) { log(`OpenAI RPC error: ${rpcErr.message}`); return null; }
    if (aiResult?.error) { log(`OpenAI error: ${aiResult.error}`); return null; }

    const aiText = aiResult?.choices?.[0]?.message?.content || aiResult?.content || '';
    if (!aiText.trim()) { log('IA retornou texto vazio.'); return null; }

    log(`IA gerou: "${aiText.slice(0, 100)}..."`);
    return aiText.trim();
  } catch (e: any) {
    log(`Erro ao gerar mensagem IA: ${e.message}`);
    return null;
  }
}
