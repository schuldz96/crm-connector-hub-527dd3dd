import { supabase } from '@/integrations/supabase/client';
import { getSaasEmpresaId } from '@/lib/saas';

// Resolve email → UUID
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

export type IntegrationType = 'google_calendar' | 'google_meet' | 'evolution_api';

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
  const empresaId = await getSaasEmpresaId();
  const usuarioId = await resolveUserUuid(userEmail);
  if (!usuarioId) return;

  const { data: existing } = await (supabase as any)
    .schema('saas')
    .from('integracoes')
    .select('id')
    .eq('empresa_id', empresaId)
    .eq('usuario_id', usuarioId)
    .eq('tipo', tipo)
    .maybeSingle();

  if (existing) {
    await (supabase as any)
      .schema('saas')
      .from('integracoes')
      .update({
        status,
        nome,
        conectado_em: status === 'conectada' ? new Date().toISOString() : null,
      })
      .eq('id', existing.id);
  } else {
    await (supabase as any)
      .schema('saas')
      .from('integracoes')
      .insert({
        empresa_id: empresaId,
        usuario_id: usuarioId,
        tipo,
        nome,
        status,
        conectado_em: status === 'conectada' ? new Date().toISOString() : null,
      });
  }
}

// Load all integrations for all users in the company
export async function loadAllUserIntegrations(): Promise<
  { email: string; tipo: string; status: string; nome: string; conectado_em?: string }[]
> {
  const empresaId = await getSaasEmpresaId();

  const { data, error } = await (supabase as any)
    .schema('saas')
    .from('integracoes')
    .select('tipo, nome, status, conectado_em, usuario_id')
    .eq('empresa_id', empresaId)
    .eq('status', 'conectada');

  if (error || !data) return [];

  // Resolve UUIDs to emails
  const uuids = [...new Set(data.map((d: any) => d.usuario_id).filter(Boolean))];
  if (uuids.length === 0) return [];

  const { data: users } = await (supabase as any)
    .schema('saas')
    .from('usuarios')
    .select('id, email')
    .eq('empresa_id', empresaId)
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
