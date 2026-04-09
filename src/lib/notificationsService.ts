import { supabase } from '@/integrations/supabase/client';
import { getOrg, getOrgAndEmpresaId } from '@/lib/saas';
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
  const org = await getOrg();
  const { data } = await (supabase as any)
    .schema('core')
    .from('usuarios')
    .select('id')
    .eq('org', org)
    .eq('email', email.trim().toLowerCase())
    .maybeSingle();
  return data?.id ?? null;
}

export async function loadNotifications(userEmail: string): Promise<Notification[]> {
  const uuid = await resolveUserUuid(userEmail);
  if (!uuid) return [];

  const { data, error } = await (supabase as any)
    .schema('automation')
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
    .schema('automation')
    .from('notificacoes')
    .update({ status: 'lida', lida_em: new Date().toISOString() })
    .eq('id', notificationId);
}

export async function markAllNotificationsRead(userEmail: string): Promise<void> {
  const uuid = await resolveUserUuid(userEmail);
  if (!uuid) return;

  await (supabase as any)
    .schema('automation')
    .from('notificacoes')
    .update({ status: 'lida', lida_em: new Date().toISOString() })
    .eq('usuario_id', uuid)
    .eq('status', 'nao_lida');
}

export async function deleteNotification(notificationId: string): Promise<void> {
  await (supabase as any)
    .schema('automation')
    .from('notificacoes')
    .update({ status: 'arquivada' })
    .eq('id', notificationId);
}

/**
 * Create an internal alert/notification.
 * When targetRoles is provided (non-empty), only users with those roles receive the alert.
 * When targetRoles is empty/undefined, all active users receive the alert.
 *
 * Supported roles: gerente, coordenador, supervisor, responsavel (mapped to DB: vendedor for responsavel).
 */
export async function createInternalAlert(params: {
  type: NotificationType;
  title: string;
  description: string;
  link?: string;
  targetRoles?: string[];
}): Promise<void> {
  const { org, empresaId } = await getOrgAndEmpresaId();

  // Build user query
  let query = (supabase as any)
    .schema('core')
    .from('usuarios')
    .select('id, cargo')
    .eq('org', org)
    .eq('ativo', true);

  // Filter by roles if specified
  const roles = params.targetRoles?.filter(r => r.length > 0) || [];
  if (roles.length > 0) {
    // Map frontend role names to DB cargo values
    const dbRoles = roles.map(r => {
      if (r === 'responsavel') return 'vendedor';
      return r; // gerente, coordenador, supervisor are the same in DB
    });
    query = query.in('cargo', dbRoles);
  }

  const { data: users, error: usersError } = await query;

  if (usersError) {
    console.error('[notifications] createInternalAlert - users query error:', usersError);
    throw new Error(`Erro ao buscar usuários: ${usersError.message}`);
  }

  if (!users || users.length === 0) {
    console.warn('[notifications] createInternalAlert - no users found for roles:', roles);
    return;
  }

  const tipo = tipoToDb[params.type] || 'sistema';

  // Insert a notification for each user
  const rows = users.map((u: any) => ({
    empresa_id: empresaId,
    org,
    usuario_id: u.id,
    tipo,
    titulo: params.title,
    descricao: params.description,
    link: params.link || null,
    status: 'nao_lida',
  }));

  console.log('[notifications] createInternalAlert inserting', rows.length, 'notifications for roles:', roles.length > 0 ? roles : 'all');

  const { error } = await (supabase as any)
    .schema('automation')
    .from('notificacoes')
    .insert(rows);

  if (error) {
    console.error('[notifications] createInternalAlert insert error:', error);
    throw new Error(`Erro ao criar alertas: ${error.message}`);
  }

  console.log('[notifications] createInternalAlert success:', rows.length, 'notifications created');
}
