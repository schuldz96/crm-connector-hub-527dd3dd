/**
 * Edge Function: meta-webhook
 * Recebe webhooks da Meta WhatsApp Business API.
 *
 * Trata:
 * - Verificação de webhook (GET com hub.verify_token)
 * - Mensagens recebidas (inbound)
 * - Status de mensagens enviadas (sent, delivered, read, failed)
 *
 * Cada mensagem é separada por phone_number_id e business_id (waba_id).
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

// ─── Find account by phone_number_id ────────────────────────────────────────
async function findAccount(phoneNumberId: string) {
  const { data } = await sb
    .from('meta_inbox_accounts')
    .select('id, empresa_id, phone_number_id, waba_id, access_token')
    .eq('phone_number_id', phoneNumberId)
    .maybeSingle();
  return data;
}

// ─── Upsert conversation ────────────────────────────────────────────────────
async function upsertConversation(
  accountId: string,
  empresaId: string,
  contactPhone: string,
  contactName: string | null,
  lastMessage: string,
  fromMe: boolean,
  ts: Date,
) {
  // Check if conversation exists
  const { data: existing } = await sb
    .from('meta_inbox_conversations')
    .select('id, unread_count')
    .eq('account_id', accountId)
    .eq('contact_phone', contactPhone)
    .maybeSingle();

  if (existing) {
    const updates: Record<string, unknown> = {
      last_message: lastMessage,
      last_message_ts: ts.toISOString(),
      last_message_from_me: fromMe,
      updated_at: new Date().toISOString(),
    };
    if (contactName) updates.contact_name = contactName;
    if (!fromMe) {
      updates.unread_count = (existing.unread_count || 0) + 1;
      updates.last_inbound_ts = ts.toISOString();
    }
    await sb.from('meta_inbox_conversations').update(updates).eq('id', existing.id);
    return existing.id;
  }

  const { data: created } = await sb
    .from('meta_inbox_conversations')
    .insert({
      account_id: accountId,
      empresa_id: empresaId,
      contact_phone: contactPhone,
      contact_name: contactName,
      last_message: lastMessage,
      last_message_ts: ts.toISOString(),
      last_message_from_me: fromMe,
      unread_count: fromMe ? 0 : 1,
      last_inbound_ts: fromMe ? null : ts.toISOString(),
    })
    .select('id')
    .single();

  return created?.id;
}

// ─── Insert inbound message ─────────────────────────────────────────────────
async function insertInboundMessage(
  conversationId: string,
  accountId: string,
  empresaId: string,
  msg: any,
  contactPhone: string,
) {
  const msgType = msg.type || 'text';
  let body = '';
  let caption = '';
  let mediaId = '';
  let mediaMime = '';
  let mediaFilename = '';

  if (msg.text) {
    body = msg.text.body || '';
  } else if (msg.image) {
    body = '[Imagem]';
    caption = msg.image.caption || '';
    mediaId = msg.image.id || '';
    mediaMime = msg.image.mime_type || '';
  } else if (msg.audio) {
    body = '[Áudio]';
    mediaId = msg.audio.id || '';
    mediaMime = msg.audio.mime_type || '';
  } else if (msg.video) {
    body = '[Vídeo]';
    caption = msg.video.caption || '';
    mediaId = msg.video.id || '';
    mediaMime = msg.video.mime_type || '';
  } else if (msg.document) {
    body = `[Documento] ${msg.document.filename || ''}`;
    mediaId = msg.document.id || '';
    mediaMime = msg.document.mime_type || '';
    mediaFilename = msg.document.filename || '';
  } else if (msg.sticker) {
    body = '[Sticker]';
    mediaId = msg.sticker.id || '';
  } else if (msg.location) {
    body = `[Localização] ${msg.location.latitude},${msg.location.longitude}`;
  } else if (msg.contacts) {
    body = '[Contato]';
  } else if (msg.reaction) {
    body = `[Reação] ${msg.reaction.emoji || ''}`;
  }

  const ts = msg.timestamp ? new Date(parseInt(msg.timestamp) * 1000) : new Date();

  await sb.from('meta_inbox_messages').insert({
    conversation_id: conversationId,
    account_id: accountId,
    empresa_id: empresaId,
    wamid: msg.id,
    from_me: false,
    from_phone: contactPhone,
    msg_type: msgType,
    body: body || caption || `[${msgType}]`,
    caption: caption || null,
    media_id: mediaId || null,
    media_mime: mediaMime || null,
    media_filename: mediaFilename || null,
    status: 'received',
    timestamp: ts.toISOString(),
  });

  return body || caption || `[${msgType}]`;
}

// ─── Update message status ──────────────────────────────────────────────────
async function updateMessageStatus(wamid: string, status: string, ts: Date, errorCode?: string, errorMsg?: string) {
  const updates: Record<string, unknown> = { status };

  if (status === 'sent') updates.sent_at = ts.toISOString();
  if (status === 'delivered') updates.delivered_at = ts.toISOString();
  if (status === 'read') updates.read_at = ts.toISOString();
  if (status === 'failed') {
    updates.failed_at = ts.toISOString();
    if (errorCode) updates.error_code = errorCode;
    if (errorMsg) updates.error_message = errorMsg;
  }

  await sb.from('meta_inbox_messages').update(updates).eq('wamid', wamid);
}

// ─── Main handler ───────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // GET = Webhook verification
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    if (mode === 'subscribe' && token && challenge) {
      // Verify token against any account's webhook_verify_token
      const { data } = await sb
        .from('meta_inbox_accounts')
        .select('id')
        .eq('webhook_verify_token', token)
        .maybeSingle();

      if (data) {
        return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
      }
    }
    return new Response('Forbidden', { status: 403 });
  }

  // POST = Webhook event
  if (req.method === 'POST') {
    try {
      const payload = await req.json();
      const entries = payload?.entry || [];

      for (const entry of entries) {
        const changes = entry?.changes || [];

        for (const change of changes) {
          if (change.field !== 'messages') continue;

          const value = change.value || {};
          const metadata = value.metadata || {};
          const phoneNumberId = metadata.phone_number_id;
          const displayPhone = metadata.display_phone_number;

          if (!phoneNumberId) continue;

          // Find account
          const account = await findAccount(phoneNumberId);
          if (!account) {
            console.warn(`[meta-webhook] No account for phone_number_id: ${phoneNumberId}`);
            continue;
          }

          // Process inbound messages
          const messages = value.messages || [];
          for (const msg of messages) {
            const contactPhone = msg.from; // e.g. "5511999990001"
            const contactInfo = (value.contacts || []).find((c: any) => c.wa_id === contactPhone);
            const contactName = contactInfo?.profile?.name || null;
            const ts = msg.timestamp ? new Date(parseInt(msg.timestamp) * 1000) : new Date();

            const convId = await upsertConversation(
              account.id, account.empresa_id, contactPhone, contactName,
              '', false, ts,
            );

            if (convId) {
              const lastMsg = await insertInboundMessage(convId, account.id, account.empresa_id, msg, contactPhone);
              // Update conversation last message
              await sb.from('meta_inbox_conversations').update({
                last_message: lastMsg,
                last_message_ts: ts.toISOString(),
              }).eq('id', convId);
            }
          }

          // Process status updates (sent, delivered, read, failed)
          const statuses = value.statuses || [];
          for (const st of statuses) {
            const wamid = st.id;
            const status = st.status; // sent, delivered, read, failed
            const ts = st.timestamp ? new Date(parseInt(st.timestamp) * 1000) : new Date();
            const errorCode = st.errors?.[0]?.code?.toString();
            const errorMsg = st.errors?.[0]?.title || st.errors?.[0]?.message;

            if (wamid && status) {
              await updateMessageStatus(wamid, status, ts, errorCode, errorMsg);
            }
          }
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (e: any) {
      console.error('[meta-webhook] Error:', e.message);
      // Always return 200 to Meta to avoid retry storms
      return new Response(JSON.stringify({ error: e.message }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response('Method not allowed', { status: 405 });
});
