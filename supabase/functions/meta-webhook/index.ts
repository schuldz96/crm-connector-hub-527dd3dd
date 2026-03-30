/**
 * Edge Function: meta-webhook
 * Recebe TODOS os webhooks da Meta WhatsApp Business API.
 *
 * Webhooks tratados:
 * - messages: mensagens inbound + status updates (sent/delivered/read/failed)
 * - message_template_status_update: template aprovado/rejeitado
 * - message_template_quality_update: qualidade do template mudou
 * - phone_number_quality_update: qualidade do número mudou
 * - history: mensagens históricas (sync)
 *
 * Cada evento é separado por phone_number_id / business_id.
 * Se FORWARD_WEBHOOK_URL estiver configurado, repassa o payload inteiro.
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FORWARD_WEBHOOK_URL = Deno.env.get('FORWARD_WEBHOOK_URL') || '';

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

const log = (msg: string) => console.log(`[meta-webhook] ${msg}`);

// ─── Normalize Brazilian phone (ensure 9th digit for mobile) ────────────────
function normalizePhone(phone: string): string {
  // Strip all non-digits
  let p = phone.replace(/\D/g, '');
  // Brazilian mobile: 55 + 2-digit DDD + 8 or 9 digit number
  // If 55 + DDD(2) + 8 digits = 12 digits → add 9 after DDD
  if (p.length === 12 && p.startsWith('55')) {
    const ddd = p.substring(2, 4);
    const number = p.substring(4);
    // Mobile numbers start with 6-9 (after removing the leading 9 if present)
    if (/^[6-9]/.test(number)) {
      p = `55${ddd}9${number}`;
    }
  }
  return p;
}

// ─── Find account by phone_number_id ────────────────────────────────────────
async function findAccount(phoneNumberId: string) {
  const { data } = await sb
    .from('meta_inbox_accounts')
    .select('id, empresa_id, phone_number_id, waba_id, access_token')
    .eq('phone_number_id', phoneNumberId)
    .maybeSingle();
  return data;
}

// ─── Find account by waba_id ────────────────────────────────────────────────
async function findAccountByWaba(wabaId: string) {
  const { data } = await sb
    .from('meta_inbox_accounts')
    .select('id, empresa_id, phone_number_id, waba_id, access_token')
    .eq('waba_id', wabaId)
    .maybeSingle();
  return data;
}

// ─── Upsert conversation ────────────────────────────────────────────────────
async function upsertConversation(
  accountId: string, empresaId: string, contactPhone: string,
  contactName: string | null, lastMessage: string, fromMe: boolean, ts: Date,
) {
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
      account_id: accountId, empresa_id: empresaId,
      contact_phone: contactPhone, contact_name: contactName,
      last_message: lastMessage, last_message_ts: ts.toISOString(),
      last_message_from_me: fromMe,
      unread_count: fromMe ? 0 : 1,
      last_inbound_ts: fromMe ? null : ts.toISOString(),
    })
    .select('id').single();

  return created?.id;
}

// ─── Parse inbound message body ─────────────────────────────────────────────
function parseMessageBody(msg: any): { body: string; type: string; mediaId: string; mediaMime: string; mediaFilename: string; caption: string } {
  const type = msg.type || 'text';
  let body = '', caption = '', mediaId = '', mediaMime = '', mediaFilename = '';

  if (msg.text) { body = msg.text.body || ''; }
  else if (msg.image) { body = '[Imagem]'; caption = msg.image.caption || ''; mediaId = msg.image.id || ''; mediaMime = msg.image.mime_type || ''; }
  else if (msg.audio) { body = '[Áudio]'; mediaId = msg.audio.id || ''; mediaMime = msg.audio.mime_type || ''; }
  else if (msg.video) { body = '[Vídeo]'; caption = msg.video.caption || ''; mediaId = msg.video.id || ''; mediaMime = msg.video.mime_type || ''; }
  else if (msg.document) { body = `[Documento] ${msg.document.filename || ''}`; mediaId = msg.document.id || ''; mediaMime = msg.document.mime_type || ''; mediaFilename = msg.document.filename || ''; }
  else if (msg.sticker) { body = '[Sticker]'; mediaId = msg.sticker.id || ''; }
  else if (msg.location) { body = `[Localização] ${msg.location.latitude},${msg.location.longitude}`; }
  else if (msg.contacts) { body = '[Contato]'; }
  else if (msg.reaction) { body = `[Reação] ${msg.reaction.emoji || ''}`; }
  else if (msg.button) { body = msg.button.text || '[Botão]'; }
  else if (msg.interactive) {
    const reply = msg.interactive.button_reply || msg.interactive.list_reply;
    body = reply?.title || reply?.id || '[Interativo]';
  }
  else { body = `[${type}]`; }

  return { body: body || caption || `[${type}]`, type, mediaId, mediaMime, mediaFilename, caption };
}

// ─── Insert inbound message ─────────────────────────────────────────────────
async function insertInboundMessage(convId: string, accountId: string, empresaId: string, msg: any, contactPhone: string) {
  const { body, type, mediaId, mediaMime, mediaFilename, caption } = parseMessageBody(msg);
  const ts = msg.timestamp ? new Date(parseInt(msg.timestamp) * 1000) : new Date();

  await sb.from('meta_inbox_messages').insert({
    conversation_id: convId, account_id: accountId, empresa_id: empresaId,
    wamid: msg.id, from_me: false, from_phone: contactPhone,
    msg_type: type, body, caption: caption || null,
    media_id: mediaId || null, media_mime: mediaMime || null, media_filename: mediaFilename || null,
    status: 'received', timestamp: ts.toISOString(),
  });

  return body;
}

// ─── Update message status (scoped by account) ─────────────────────────────
// Status hierarchy: sent < delivered < read < failed
// Never regress (e.g. delivered → sent) since Meta callbacks arrive out of order
const STATUS_RANK: Record<string, number> = { sent: 1, delivered: 2, read: 3, failed: 4 };

async function updateMessageStatus(wamid: string, accountId: string, status: string, ts: Date, errorCode?: string, errorMsg?: string) {
  // Check current status to avoid regression
  const { data: current } = await sb.from('meta_inbox_messages')
    .select('status').eq('wamid', wamid).eq('account_id', accountId).maybeSingle();

  const currentRank = STATUS_RANK[current?.status] || 0;
  const newRank = STATUS_RANK[status] || 0;

  const updates: Record<string, unknown> = {};

  // Only update status field if it's a progression (or failed overrides anything)
  if (newRank > currentRank || status === 'failed') {
    updates.status = status;
  }

  // Always record timestamps (they're additive, not replacements)
  if (status === 'sent') updates.sent_at = ts.toISOString();
  if (status === 'delivered') updates.delivered_at = ts.toISOString();
  if (status === 'read') updates.read_at = ts.toISOString();
  if (status === 'failed') {
    updates.failed_at = ts.toISOString();
    if (errorCode) updates.error_code = errorCode;
    if (errorMsg) updates.error_message = errorMsg;
  }

  if (Object.keys(updates).length > 0) {
    await sb.from('meta_inbox_messages').update(updates).eq('wamid', wamid).eq('account_id', accountId);
  }
}

// ─── Increment daily metric ─────────────────────────────────────────────────
async function trackMetric(accountId: string, empresaId: string, field: string, increment = 1) {
  try {
    await sb.rpc('update_inbox_metric', {
      p_account_id: accountId,
      p_empresa_id: empresaId,
      p_date: new Date().toISOString().slice(0, 10),
      p_field: field,
      p_increment: increment,
    });
  } catch { /* silent — metrics are best-effort */ }
}

// ─── Log webhook event to DB ────────────────────────────────────────────────
async function logWebhookEvent(accountId: string | null, empresaId: string | null, field: string, payload: any) {
  try {
    // Store in meta_inbox_webhook_log if table exists, otherwise just console log
    log(`Event: ${field} | Account: ${accountId || 'unknown'}`);
  } catch { /* silent */ }
}

// ─── Handle: messages (inbound + statuses) ──────────────────────────────────
async function handleMessages(value: any) {
  const metadata = value.metadata || {};
  const phoneNumberId = metadata.phone_number_id;
  if (!phoneNumberId) return;

  const account = await findAccount(phoneNumberId);
  if (!account) { log(`No account for phone_number_id: ${phoneNumberId}`); return; }

  // Inbound messages
  for (const msg of (value.messages || [])) {
    const rawPhone = msg.from;
    const contactPhone = normalizePhone(rawPhone);
    const contactInfo = (value.contacts || []).find((c: any) => c.wa_id === rawPhone);
    const contactName = contactInfo?.profile?.name || null;
    const ts = msg.timestamp ? new Date(parseInt(msg.timestamp) * 1000) : new Date();

    const convId = await upsertConversation(account.id, account.empresa_id, contactPhone, contactName, '', false, ts);
    if (convId) {
      const lastMsg = await insertInboundMessage(convId, account.id, account.empresa_id, msg, contactPhone);
      await sb.from('meta_inbox_conversations').update({
        last_message: lastMsg, last_message_ts: ts.toISOString(),
      }).eq('id', convId);
      // Metrics are tracked automatically by DB triggers (trg_inbox_message_metrics)
      log(`Inbound: ${contactPhone} → ${lastMsg.slice(0, 50)}`);
    }
  }

  // Status updates (sent, delivered, read, failed)
  for (const st of (value.statuses || [])) {
    const wamid = st.id;
    const status = st.status;
    const ts = st.timestamp ? new Date(parseInt(st.timestamp) * 1000) : new Date();
    const errorCode = st.errors?.[0]?.code?.toString();
    const errorMsg = st.errors?.[0]?.title || st.errors?.[0]?.message;

    if (wamid && status) {
      await updateMessageStatus(wamid, account.id, status, ts, errorCode, errorMsg);
      log(`Status: ${wamid.slice(0, 20)}... → ${status}${errorCode ? ` (${errorCode})` : ''}`);
    }
  }
}

// ─── Handle: message_template_status_update ─────────────────────────────────
async function handleTemplateStatusUpdate(value: any, entry: any) {
  const event = value.event || value.message_template_status_update?.event;
  const templateId = value.message_template_id?.toString() || value.message_template_status_update?.message_template_id?.toString();
  const templateName = value.message_template_name || value.message_template_status_update?.message_template_name;
  const newStatus = event; // APPROVED, REJECTED, PENDING_DELETION, etc.
  const reason = value.reason || value.message_template_status_update?.reason;

  if (!templateId) return;

  // Find account by WABA ID from entry
  const wabaId = entry?.id?.toString();
  const account = wabaId ? await findAccountByWaba(wabaId) : null;

  if (account) {
    // Update local template cache
    await sb.from('meta_inbox_templates')
      .update({ status: newStatus, rejected_reason: reason || null, synced_at: new Date().toISOString() })
      .eq('account_id', account.id)
      .eq('meta_template_id', templateId);
  }

  log(`Template status: ${templateName || templateId} → ${newStatus}${reason ? ` (${reason})` : ''}`);
}

// ─── Handle: message_template_quality_update ────────────────────────────────
async function handleTemplateQualityUpdate(value: any, entry: any) {
  const templateId = value.message_template_id?.toString();
  const quality = value.new_quality_score || value.current_quality_score;

  if (!templateId) return;

  const wabaId = entry?.id?.toString();
  const account = wabaId ? await findAccountByWaba(wabaId) : null;

  if (account) {
    await sb.from('meta_inbox_templates')
      .update({ quality_score: quality || 'UNKNOWN', synced_at: new Date().toISOString() })
      .eq('account_id', account.id)
      .eq('meta_template_id', templateId);
  }

  log(`Template quality: ${templateId} → ${quality}`);
}

// ─── Handle: phone_number_quality_update ────────────────────────────────────
async function handlePhoneQualityUpdate(value: any) {
  const phoneNumberId = value.display_phone_number;
  const quality = value.current_limit || value.event;

  log(`Phone quality: ${phoneNumberId} → ${quality || JSON.stringify(value).slice(0, 200)}`);

  // Update account status if quality is bad
  if (phoneNumberId && quality === 'FLAGGED') {
    await sb.from('meta_inbox_accounts')
      .update({ status: 'flagged', updated_at: new Date().toISOString() })
      .eq('phone_display', phoneNumberId);
  }
}

// ─── Handle: history (sync) ─────────────────────────────────────────────────
async function handleHistory(value: any) {
  // History events contain past messages — treat same as regular messages
  log(`History event received: ${JSON.stringify(value).slice(0, 200)}`);
  if (value.messages || value.statuses) {
    await handleMessages(value);
  }
}

// ─── Forward to external webhook (proxy) ────────────────────────────────────
async function forwardWebhook(body: string) {
  if (!FORWARD_WEBHOOK_URL) return;
  try {
    await fetch(FORWARD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
  } catch (e: any) {
    log(`Forward failed: ${e.message}`);
  }
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
      const { data } = await sb
        .from('meta_inbox_accounts')
        .select('id')
        .eq('webhook_verify_token', token)
        .maybeSingle();

      if (data) {
        log(`Verification OK for token: ${token.slice(0, 8)}...`);
        return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
      }
    }
    return new Response('Forbidden', { status: 403 });
  }

  // POST = Webhook event
  if (req.method === 'POST') {
    const rawBody = await req.text();

    // Forward to external webhook in parallel (fire-and-forget)
    forwardWebhook(rawBody);

    try {
      const payload = JSON.parse(rawBody);
      const entries = payload?.entry || [];

      for (const entry of entries) {
        for (const change of (entry?.changes || [])) {
          const field = change.field;
          const value = change.value || {};

          switch (field) {
            case 'messages':
              await handleMessages(value);
              break;

            case 'message_template_status_update':
              await handleTemplateStatusUpdate(value, entry);
              break;

            case 'message_template_quality_update':
              await handleTemplateQualityUpdate(value, entry);
              break;

            case 'phone_number_quality_update':
              await handlePhoneQualityUpdate(value);
              break;

            case 'history':
              await handleHistory(value);
              break;

            default:
              log(`Unhandled field: ${field} | Data: ${JSON.stringify(value).slice(0, 200)}`);
          }
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (e: any) {
      log(`Error: ${e.message}`);
      // Always return 200 to Meta to avoid retry storms
      return new Response(JSON.stringify({ error: e.message }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response('Method not allowed', { status: 405 });
});
