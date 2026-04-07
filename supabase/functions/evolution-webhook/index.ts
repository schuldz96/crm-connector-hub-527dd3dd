/**
 * Edge Function: evolution-webhook
 * Recebe webhooks da Evolution API (Baileys) para integração com CRM AI.
 *
 * Eventos tratados:
 * - MESSAGES_UPSERT: mensagem recebida do lead
 *
 * Ao receber mensagem inbound:
 * 1. Busca conversa IA ativa para o telefone
 * 2. Adiciona a mensagem ao array `mensagens` da crm_ai_conversations
 * 3. O worker crm-ai-followup avalia transições no próximo ciclo (30s)
 *
 * Configuração na Evolution API:
 *   Settings → Webhook URL: https://<project>.supabase.co/functions/v1/evolution-webhook
 *   Events: MESSAGES_UPSERT
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { db: { schema: 'saas' } });

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const log = (msg: string) => console.log(`[evolution-webhook] ${msg}`);

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const event = body.event;

    // Only process inbound messages
    if (event !== 'messages.upsert' && event !== 'MESSAGES_UPSERT') {
      return jsonRes({ ok: true, skipped: event });
    }

    const data = body.data || body;
    const instance = body.instance || body.instanceName || data.instance || '';

    // Evolution API sends messages as array or single object
    const messages = Array.isArray(data.messages || data) ? (data.messages || [data]) : [data];

    let processed = 0;
    for (const msg of messages) {
      // Skip outgoing messages (fromMe=true)
      const key = msg.key || {};
      if (key.fromMe === true) continue;

      // Extract phone number and text
      const remoteJid = key.remoteJid || '';
      if (!remoteJid || remoteJid.includes('@g.us')) continue; // Skip group messages

      const phone = remoteJid.replace('@s.whatsapp.net', '').replace('@c.us', '').replace(/\D/g, '');
      if (!phone) continue;

      // Extract message text
      const messageContent = msg.message || {};
      let text = '';
      if (messageContent.conversation) text = messageContent.conversation;
      else if (messageContent.extendedTextMessage?.text) text = messageContent.extendedTextMessage.text;
      else if (messageContent.imageMessage?.caption) text = messageContent.imageMessage.caption || '[Imagem]';
      else if (messageContent.videoMessage?.caption) text = messageContent.videoMessage.caption || '[Vídeo]';
      else if (messageContent.audioMessage) text = '[Áudio]';
      else if (messageContent.documentMessage) text = `[Documento] ${messageContent.documentMessage.fileName || ''}`;
      else if (messageContent.stickerMessage) text = '[Sticker]';
      else if (messageContent.locationMessage) text = '[Localização]';
      else if (messageContent.contactMessage) text = '[Contato]';
      else if (messageContent.buttonsResponseMessage) text = messageContent.buttonsResponseMessage.selectedDisplayText || '[Botão]';
      else if (messageContent.listResponseMessage) text = messageContent.listResponseMessage.title || '[Lista]';
      else text = '[Mensagem]';

      if (!text) continue;

      log(`Inbound: ${phone} (instance: ${instance}) → ${text.slice(0, 80)}`);

      // Find active CRM AI conversation for this phone
      // Try multiple phone formats (with/without 55 prefix)
      const phoneVariants = [phone];
      if (phone.startsWith('55') && phone.length >= 12) {
        phoneVariants.push(phone.slice(2)); // without country code
      } else if (!phone.startsWith('55')) {
        phoneVariants.push('55' + phone); // with country code
      }

      const { data: conv } = await sb.from('crm_ai_conversations')
        .select('id, mensagens, empresa_id')
        .eq('status', 'active')
        .in('contato_telefone', phoneVariants)
        .maybeSingle();

      if (!conv) {
        log(`Nenhuma conversa IA ativa para ${phone}. Ignorando.`);
        continue;
      }

      // Add user message to conversation memory
      const msgs = [...(conv.mensagens || []), {
        role: 'user',
        content: text,
        timestamp: new Date().toISOString(),
      }];

      await sb.from('crm_ai_conversations')
        .update({
          mensagens: msgs,
          total_mensagens: msgs.length,
          ultima_mensagem_em: new Date().toISOString(),
        })
        .eq('id', conv.id);

      log(`✓ Msg adicionada à conv ${conv.id} (${msgs.length} msgs total)`);
      processed++;
    }

    return jsonRes({ ok: true, processed });
  } catch (e: any) {
    log(`ERRO: ${e.message}`);
    // Always return 200 to avoid retry storms
    return jsonRes({ ok: false, error: e.message });
  }
});

function jsonRes(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
