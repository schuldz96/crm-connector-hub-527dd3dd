import { supabase } from '@/integrations/supabase/client';
import { getSaasEmpresaId } from '@/lib/saas';
import type { Notification, NotificationType } from '@/contexts/NotificationsContext';

// Map DB tipo to frontend type
const tipoMap: Record<string, NotificationType> = {
  reuniao: 'meeting',
  whatsapp: 'whatsapp',
  sistema: 'system',
  performance: 'performance',
};

const tipoToDb: Record<NotificationType, string> = {
  meeting: 'reuniao',
  whatsapp: 'whatsapp',
  system: 'sistema',
  performance: 'performance',
};

// Resolve email → UUID from saas.usuarios
async function resolveUserUuid(email: string): Promise<string | null> {
  const empresaId = await getSaasEmpresaId();
  const { data } = await (supabase as any)
    .schema('saas')
    .from('usuarios')
    .select('id')
    .eq('empresa_id', empresaId)
    .eq('email', email.trim().toLowerCase())
    .maybeSingle();
  return data?.id ?? null;
}

export async function loadNotifications(userEmail: string): Promise<Notification[]> {
  const uuid = await resolveUserUuid(userEmail);
  if (!uuid) return [];

  const { data, error } = await (supabase as any)
    .schema('saas')
    .from('notificacoes')
    .select('*')
    .eq('usuario_id', uuid)
    .order('criado_em', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[notifications] load error:', error);
    return [];
  }

  return (data || []).map((n: any) => ({
    id: n.id,
    type: tipoMap[n.tipo] || 'system',
    title: n.titulo,
    description: n.descricao || '',
    createdAt: n.criado_em,
    read: n.status !== 'nao_lida',
    link: n.link || undefined,
  }));
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  await (supabase as any)
    .schema('saas')
    .from('notificacoes')
    .update({ status: 'lida', lida_em: new Date().toISOString() })
    .eq('id', notificationId);
}

export async function markAllNotificationsRead(userEmail: string): Promise<void> {
  const uuid = await resolveUserUuid(userEmail);
  if (!uuid) return;

  await (supabase as any)
    .schema('saas')
    .from('notificacoes')
    .update({ status: 'lida', lida_em: new Date().toISOString() })
    .eq('usuario_id', uuid)
    .eq('status', 'nao_lida');
}

export async function deleteNotification(notificationId: string): Promise<void> {
  await (supabase as any)
    .schema('saas')
    .from('notificacoes')
    .update({ status: 'arquivada' })
    .eq('id', notificationId);
}
