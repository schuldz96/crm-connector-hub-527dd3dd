/**
 * Service for Meta WhatsApp Business API integration.
 * Handles: sending messages (text, image, audio, document, template),
 * loading conversations/messages from DB, and 24h window check.
 */
import { supabase } from '@/integrations/supabase/client';
import { getSaasEmpresaId } from '@/lib/saas';
import type { MetaInboxAccount } from '@/pages/InboxPage';

const META_API = 'https://graph.facebook.com/v19.0';

// ─── Types ───────────────────────────────────────────────────────────────────
export interface InboxConversation {
  id: string;
  account_id: string;
  contact_phone: string;
  contact_name: string | null;
  last_message: string | null;
  last_message_ts: string | null;
  last_message_from_me: boolean;
  unread_count: number;
  last_inbound_ts: string | null;
  status: string;
}

export interface InboxMessage {
  id: string;
  conversation_id: string;
  wamid: string | null;
  from_me: boolean;
  from_phone: string | null;
  to_phone: string | null;
  msg_type: string;
  body: string | null;
  caption: string | null;
  media_url: string | null;
  media_id: string | null;
  media_mime: string | null;
  media_filename: string | null;
  template_name: string | null;
  status: string;
  error_code: string | null;
  error_message: string | null;
  timestamp: string;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  failed_at: string | null;
}

// ─── Load conversations for an account ──────────────────────────────────────
export async function loadConversations(accountId: string): Promise<InboxConversation[]> {
  const { data, error } = await supabase
    .from('meta_inbox_conversations')
    .select('*')
    .eq('account_id', accountId)
    .order('last_message_ts', { ascending: false });

  if (error) { console.error('[metaInbox] loadConversations:', error); return []; }
  return (data || []) as InboxConversation[];
}

// ─── Load messages for a conversation ───────────────────────────────────────
export async function loadMessages(conversationId: string): Promise<InboxMessage[]> {
  const { data, error } = await supabase
    .from('meta_inbox_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('timestamp', { ascending: true });

  if (error) { console.error('[metaInbox] loadMessages:', error); return []; }
  return (data || []) as InboxMessage[];
}

// ─── Mark conversation as read ──────────────────────────────────────────────
export async function markConversationRead(conversationId: string) {
  await supabase
    .from('meta_inbox_conversations')
    .update({ unread_count: 0 })
    .eq('id', conversationId);
}

// ─── Check 24h window ───────────────────────────────────────────────────────
export function isWithin24hWindow(lastInboundTs: string | null): boolean {
  if (!lastInboundTs) return false;
  const diff = Date.now() - new Date(lastInboundTs).getTime();
  return diff < 24 * 60 * 60 * 1000; // 24 hours in ms
}

// ─── Send text message ──────────────────────────────────────────────────────
export async function sendTextMessage(
  account: MetaInboxAccount,
  conversationId: string,
  toPhone: string,
  text: string,
): Promise<{ success: boolean; wamid?: string; error?: string }> {
  try {
    const res = await fetch(`${META_API}/${account.phone_number_id}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${account.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: toPhone,
        type: 'text',
        text: { body: text },
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);

    const wamid = data?.messages?.[0]?.id;

    // Save to DB
    const empresaId = await getSaasEmpresaId();
    await supabase.from('meta_inbox_messages').insert({
      conversation_id: conversationId,
      account_id: account.id,
      empresa_id: empresaId,
      wamid,
      from_me: true,
      from_phone: account.phone_display || account.phone_number_id,
      to_phone: toPhone,
      msg_type: 'text',
      body: text,
      status: 'sent',
      timestamp: new Date().toISOString(),
      sent_at: new Date().toISOString(),
    });

    // Update conversation
    await supabase.from('meta_inbox_conversations').update({
      last_message: text,
      last_message_ts: new Date().toISOString(),
      last_message_from_me: true,
    }).eq('id', conversationId);

    return { success: true, wamid };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ─── Send media message (image, audio, video, document) ─────────────────────
export async function sendMediaMessage(
  account: MetaInboxAccount,
  conversationId: string,
  toPhone: string,
  mediaType: 'image' | 'audio' | 'video' | 'document',
  mediaIdOrUrl: string,
  caption?: string,
  filename?: string,
): Promise<{ success: boolean; wamid?: string; error?: string }> {
  try {
    const mediaPayload: Record<string, unknown> = {};
    // If it's a Meta media ID (not a URL)
    if (mediaIdOrUrl.startsWith('http')) {
      mediaPayload.link = mediaIdOrUrl;
    } else {
      mediaPayload.id = mediaIdOrUrl;
    }
    if (caption) mediaPayload.caption = caption;
    if (filename) mediaPayload.filename = filename;

    const res = await fetch(`${META_API}/${account.phone_number_id}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${account.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: toPhone,
        type: mediaType,
        [mediaType]: mediaPayload,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);

    const wamid = data?.messages?.[0]?.id;
    const empresaId = await getSaasEmpresaId();

    const labels: Record<string, string> = { image: '[Imagem]', audio: '[Áudio]', video: '[Vídeo]', document: '[Documento]' };
    const bodyText = caption || labels[mediaType] || `[${mediaType}]`;

    await supabase.from('meta_inbox_messages').insert({
      conversation_id: conversationId,
      account_id: account.id,
      empresa_id: empresaId,
      wamid,
      from_me: true,
      to_phone: toPhone,
      msg_type: mediaType,
      body: bodyText,
      caption: caption || null,
      media_id: mediaIdOrUrl.startsWith('http') ? null : mediaIdOrUrl,
      media_url: mediaIdOrUrl.startsWith('http') ? mediaIdOrUrl : null,
      media_filename: filename || null,
      status: 'sent',
      timestamp: new Date().toISOString(),
      sent_at: new Date().toISOString(),
    });

    await supabase.from('meta_inbox_conversations').update({
      last_message: bodyText,
      last_message_ts: new Date().toISOString(),
      last_message_from_me: true,
    }).eq('id', conversationId);

    return { success: true, wamid };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ─── Upload media to Meta ───────────────────────────────────────────────────
export async function uploadMediaToMeta(
  account: MetaInboxAccount,
  file: File,
): Promise<{ mediaId?: string; error?: string }> {
  try {
    const formData = new FormData();
    formData.append('messaging_product', 'whatsapp');
    formData.append('file', file);
    formData.append('type', file.type);

    const res = await fetch(`${META_API}/${account.phone_number_id}/media`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${account.access_token}` },
      body: formData,
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
    return { mediaId: data.id };
  } catch (e: any) {
    return { error: e.message };
  }
}

// ─── Send template message ──────────────────────────────────────────────────
export async function sendTemplateMessage(
  account: MetaInboxAccount,
  conversationId: string,
  toPhone: string,
  templateName: string,
  language: string,
  components?: any[],
): Promise<{ success: boolean; wamid?: string; error?: string }> {
  try {
    const templatePayload: Record<string, unknown> = {
      name: templateName,
      language: { code: language },
    };
    if (components && components.length > 0) {
      templatePayload.components = components;
    }

    const res = await fetch(`${META_API}/${account.phone_number_id}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${account.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: toPhone,
        type: 'template',
        template: templatePayload,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);

    const wamid = data?.messages?.[0]?.id;
    const empresaId = await getSaasEmpresaId();

    await supabase.from('meta_inbox_messages').insert({
      conversation_id: conversationId,
      account_id: account.id,
      empresa_id: empresaId,
      wamid,
      from_me: true,
      to_phone: toPhone,
      msg_type: 'template',
      body: `[Template] ${templateName}`,
      template_name: templateName,
      template_language: language,
      template_components: components ? JSON.stringify(components) : null,
      status: 'sent',
      timestamp: new Date().toISOString(),
      sent_at: new Date().toISOString(),
    });

    await supabase.from('meta_inbox_conversations').update({
      last_message: `[Template] ${templateName}`,
      last_message_ts: new Date().toISOString(),
      last_message_from_me: true,
    }).eq('id', conversationId);

    return { success: true, wamid };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
