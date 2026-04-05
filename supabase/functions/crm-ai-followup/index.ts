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
        // 2. Get stage AI config
        const { data: config } = await sb.from('crm_estagio_ia_config')
          .select('followups, provider, instancia_id')
          .eq('estagio_id', conv.estagio_id)
          .eq('empresa_id', conv.empresa_id)
          .maybeSingle();

        if (!config?.followups?.length) continue;

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

          if (content.type === 'text' && content.text) {
            msgSent = await sendText(conv.empresa_id, config.provider, config.instancia_id, phone, content.text, log);
          } else if (['image', 'audio', 'video'].includes(content.type) && content.mediaUrl) {
            msgSent = await sendMedia(conv.empresa_id, config.provider, config.instancia_id, phone, content.type, content.mediaUrl, content.text, log);
          }

          if (msgSent) {
            // 5. Record in memory
            msgs.push({
              role: 'assistant',
              content: content.type === 'text' ? content.text : `[${content.type}] ${content.mediaUrl || ''}`,
              timestamp: new Date().toISOString(),
              followup_id: fu.id,
              type: 'followup',
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
