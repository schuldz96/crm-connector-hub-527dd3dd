import { supabase } from '@/integrations/supabase/client';
import { getOrg, getOrgAndEmpresaId } from '@/lib/saas';

// Resolve email → UUID
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

export type IntegrationType = 'evolution_api';

export interface UserIntegration {
  tipo: IntegrationType;
  nome: string;
  status: 'conectada' | 'desconectada' | 'erro';
  conectado_em?: string;
}

// Save or update an integration for a user
export async function upsertUserIntegration(
  userEmail: string,
  tipo: IntegrationType,
  nome: string,
  status: 'conectada' | 'desconectada',
): Promise<void> {
  const { org, empresaId } = await getOrgAndEmpresaId();
  const usuarioId = await resolveUserUuid(userEmail);
  if (!usuarioId) return;

  const { data: existing } = await (supabase as any)
    .schema('automation')
    .from('integracoes')
    .select('id')
    .eq('org', org)
    .eq('usuario_id', usuarioId)
    .eq('tipo', tipo)
    .maybeSingle();

  if (existing) {
    await (supabase as any)
      .schema('automation')
      .from('integracoes')
      .update({
        status,
        nome,
        conectado_em: status === 'conectada' ? new Date().toISOString() : null,
      })
      .eq('id', existing.id);
  } else {
    await (supabase as any)
      .schema('automation')
      .from('integracoes')
      .insert({
        empresa_id: empresaId,
        org,
        usuario_id: usuarioId,
        tipo,
        nome,
        status,
        conectado_em: status === 'conectada' ? new Date().toISOString() : null,
      });
  }
}

// Delete integration records for a user (used on disconnect)
export async function deleteUserIntegrations(
  userEmail: string,
  tipos: IntegrationType[],
): Promise<void> {
  const org = await getOrg();
  const usuarioId = await resolveUserUuid(userEmail);
  if (!usuarioId) return;

  for (const tipo of tipos) {
    await (supabase as any)
      .schema('automation')
      .from('integracoes')
      .delete()
      .eq('org', org)
      .eq('usuario_id', usuarioId)
      .eq('tipo', tipo);
  }
}

// Load all integrations for all users in the company
export async function loadAllUserIntegrations(): Promise<
  { email: string; tipo: string; status: string; nome: string; conectado_em?: string }[]
> {
  const org = await getOrg();

  const { data, error } = await (supabase as any)
    .schema('automation')
    .from('integracoes')
    .select('tipo, nome, status, conectado_em, usuario_id')
    .eq('org', org)
    .eq('status', 'conectada');

  if (error || !data) return [];

  // Resolve UUIDs to emails
  const uuids = [...new Set(data.map((d: any) => d.usuario_id).filter(Boolean))];
  if (uuids.length === 0) return [];

  const { data: users } = await (supabase as any)
    .schema('core')
    .from('usuarios')
    .select('id, email')
    .eq('org', org)
    .in('id', uuids);

  const uuidToEmail: Record<string, string> = {};
  for (const u of (users || [])) {
    uuidToEmail[u.id] = u.email;
  }

  return data.map((d: any) => ({
    email: uuidToEmail[d.usuario_id] || '',
    tipo: d.tipo,
    status: d.status,
    nome: d.nome,
    conectado_em: d.conectado_em,
  })).filter((d: any) => d.email);
}
