import { supabase } from '@/integrations/supabase/client';
import { getSaasEmpresaId } from '@/lib/saas';

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
  const empresaId = await getSaasEmpresaId();
  const { data, error } = await (supabase as any)
    .schema('saas')
    .from('areas')
    .select('id, nome, gerente_id, criado_em')
    .eq('empresa_id', empresaId)
    .order('nome', { ascending: true });

  if (error) throw error;

  // Resolve gerente UUIDs to names/emails
  const gerenteIds = [...new Set((data || []).map((a: any) => a.gerente_id).filter(Boolean))];
  let gerenteMap: Record<string, { nome: string; email: string }> = {};
  if (gerenteIds.length > 0) {
    const { data: users } = await (supabase as any)
      .schema('saas')
      .from('usuarios')
      .select('id, nome, email')
      .eq('empresa_id', empresaId)
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
export async function createArea(nome: string, gerenteEmail?: string): Promise<void> {
  const empresaId = await getSaasEmpresaId();
  let gerenteId: string | null = null;

  if (gerenteEmail) {
    const { data } = await (supabase as any)
      .schema('saas')
      .from('usuarios')
      .select('id')
      .eq('empresa_id', empresaId)
      .eq('email', gerenteEmail.trim().toLowerCase())
      .maybeSingle();
    gerenteId = data?.id ?? null;
  }

  const { error } = await (supabase as any)
    .schema('saas')
    .from('areas')
    .insert({
      empresa_id: empresaId,
      nome: nome.trim(),
      gerente_id: gerenteId,
    });

  if (error) throw error;
}

/** Update an area */
export async function updateArea(areaId: string, nome: string, gerenteEmail?: string): Promise<void> {
  const empresaId = await getSaasEmpresaId();
  let gerenteId: string | null = null;

  if (gerenteEmail) {
    const { data } = await (supabase as any)
      .schema('saas')
      .from('usuarios')
      .select('id')
      .eq('empresa_id', empresaId)
      .eq('email', gerenteEmail.trim().toLowerCase())
      .maybeSingle();
    gerenteId = data?.id ?? null;
  }

  const { error } = await (supabase as any)
    .schema('saas')
    .from('areas')
    .update({
      nome: nome.trim(),
      gerente_id: gerenteId,
      atualizado_em: new Date().toISOString(),
    })
    .eq('id', areaId);

  if (error) throw error;
}

/** Delete an area */
export async function deleteArea(areaId: string): Promise<void> {
  const { error } = await (supabase as any)
    .schema('saas')
    .from('areas')
    .delete()
    .eq('id', areaId);

  if (error) throw error;
}

/** Load teams associated with an area */
export async function loadTeamsByArea(areaId: string): Promise<{ id: string; nome: string }[]> {
  const empresaId = await getSaasEmpresaId();
  const { data, error } = await (supabase as any)
    .schema('saas')
    .from('times')
    .select('id, nome')
    .eq('empresa_id', empresaId)
    .eq('area_id', areaId);

  if (error) return [];
  return data || [];
}

/** Count users in an area */
export async function countUsersInArea(areaId: string): Promise<number> {
  const empresaId = await getSaasEmpresaId();
  const { data } = await (supabase as any)
    .schema('saas')
    .from('usuarios')
    .select('id')
    .eq('empresa_id', empresaId)
    .eq('area_id', areaId);

  return data?.length || 0;
}
