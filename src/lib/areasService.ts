import { supabase } from '@/integrations/supabase/client';
import { getOrg, getOrgAndEmpresaId } from '@/lib/saas';

export interface AreaRecord {
  id: string;
  nome: string;
  gerente_id: string | null;
  gerente_email?: string;
  gerente_nome?: string;
  criado_em: string;
}

/** Load all areas for the current company */
export async function loadAreas(): Promise<AreaRecord[]> {
  const org = await getOrg();
  const { data, error } = await (supabase as any)
    .schema('core')
    .from('areas')
    .select('id, nome, gerente_id, criado_em')
    .eq('org', org)
    .order('nome', { ascending: true });

  if (error) throw error;

  // Resolve gerente UUIDs to names/emails
  const gerenteIds = [...new Set((data || []).map((a: any) => a.gerente_id).filter(Boolean))];
  let gerenteMap: Record<string, { nome: string; email: string }> = {};
  if (gerenteIds.length > 0) {
    const { data: users } = await (supabase as any)
      .schema('core')
      .from('usuarios')
      .select('id, nome, email')
      .eq('org', org)
      .in('id', gerenteIds);
    for (const u of (users || [])) {
      gerenteMap[u.id] = { nome: u.nome, email: u.email };
    }
  }

  return (data || []).map((a: any) => ({
    id: a.id,
    nome: a.nome,
    gerente_id: a.gerente_id,
    gerente_email: a.gerente_id ? gerenteMap[a.gerente_id]?.email : undefined,
    gerente_nome: a.gerente_id ? gerenteMap[a.gerente_id]?.nome : undefined,
    criado_em: a.criado_em,
  }));
}

/** Create a new area */
export async function createArea(nome: string, gerenteEmail?: string, memberEmails?: string[]): Promise<void> {
  const { org, empresaId } = await getOrgAndEmpresaId();
  let gerenteId: string | null = null;

  if (gerenteEmail) {
    const { data } = await (supabase as any)
      .schema('core')
      .from('usuarios')
      .select('id')
      .eq('org', org)
      .eq('email', gerenteEmail.trim().toLowerCase())
      .maybeSingle();
    gerenteId = data?.id ?? null;
  }

  const { data: row, error } = await (supabase as any)
    .schema('core')
    .from('areas')
    .insert({
      empresa_id: empresaId,
      org,
      nome: nome.trim(),
      gerente_id: gerenteId,
    })
    .select('id')
    .single();

  if (error) throw error;

  if (memberEmails && memberEmails.length > 0 && row?.id) {
    await assignAreaMembers(row.id, memberEmails);
  }
}

/** Update an area */
export async function updateArea(areaId: string, nome: string, gerenteEmail?: string, memberEmails?: string[]): Promise<void> {
  const org = await getOrg();
  let gerenteId: string | null = null;

  if (gerenteEmail) {
    const { data } = await (supabase as any)
      .schema('core')
      .from('usuarios')
      .select('id')
      .eq('org', org)
      .eq('email', gerenteEmail.trim().toLowerCase())
      .maybeSingle();
    gerenteId = data?.id ?? null;
  }

  const { error } = await (supabase as any)
    .schema('core')
    .from('areas')
    .update({
      nome: nome.trim(),
      gerente_id: gerenteId,
      atualizado_em: new Date().toISOString(),
    })
    .eq('id', areaId);

  if (error) throw error;

  if (memberEmails !== undefined) {
    await assignAreaMembers(areaId, memberEmails);
  }
}

/** Delete an area */
export async function deleteArea(areaId: string): Promise<void> {
  const { error } = await (supabase as any)
    .schema('core')
    .from('areas')
    .delete()
    .eq('id', areaId);

  if (error) throw error;
}

/** Load teams associated with an area */
export async function loadTeamsByArea(areaId: string): Promise<{ id: string; nome: string }[]> {
  const org = await getOrg();
  const { data, error } = await (supabase as any)
    .schema('core')
    .from('times')
    .select('id, nome')
    .eq('org', org)
    .eq('area_id', areaId);

  if (error) return [];
  return data || [];
}

/** Count users in an area */
export async function countUsersInArea(areaId: string): Promise<number> {
  const org = await getOrg();
  const { data } = await (supabase as any)
    .schema('core')
    .from('usuarios')
    .select('id')
    .eq('org', org)
    .eq('area_id', areaId);

  return data?.length || 0;
}

/** Load members directly assigned to an area */
export async function loadAreaMembers(areaId: string): Promise<{ id: string; nome: string; email: string; papel: string }[]> {
  const org = await getOrg();
  const { data } = await (supabase as any)
    .schema('core')
    .from('usuarios')
    .select('id, nome, email, papel')
    .eq('org', org)
    .eq('area_id', areaId);

  return data || [];
}

/** Assign members to an area (set area_id on usuarios) */
export async function assignAreaMembers(areaId: string, memberEmails: string[]): Promise<void> {
  const org = await getOrg();

  // Remove current direct members from this area (only those NOT in a team of this area)
  await (supabase as any)
    .schema('core')
    .from('usuarios')
    .update({ area_id: null })
    .eq('org', org)
    .eq('area_id', areaId);

  // Assign new members
  for (const email of memberEmails) {
    await (supabase as any)
      .schema('core')
      .from('usuarios')
      .update({ area_id: areaId })
      .eq('org', org)
      .eq('email', email.trim().toLowerCase());
  }
}
