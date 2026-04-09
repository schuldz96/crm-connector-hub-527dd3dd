import { supabase } from '@/integrations/supabase/client';
import { getOrg, getOrgAndEmpresaId } from '@/lib/saas';
import type { Team } from '@/types';

// ─── Helper: extract email from frontend ID format ──────────────────────────
function emailFromFrontendId(frontendId: string): string {
  return frontendId.replace(/^(user_|google_)/, '');
}

// ─── Helper: resolve email → UUID from core.usuarios ────────────────────────
async function resolveEmailToUuid(email: string, org: string): Promise<string | null> {
  const { data } = await (supabase as any)
    .schema('core')
    .from('usuarios')
    .select('id')
    .eq('org', org)
    .eq('email', email)
    .maybeSingle();
  return data?.id ?? null;
}

// ─── Helper: resolve UUID → frontend ID (user_email) from core.usuarios ─────
async function resolveUuidToFrontendId(uuid: string, org: string): Promise<string> {
  const { data } = await (supabase as any)
    .schema('core')
    .from('usuarios')
    .select('email')
    .eq('id', uuid)
    .eq('org', org)
    .maybeSingle();
  return data?.email ? `user_${data.email}` : '';
}

// ─── Load all teams from saas.times ──────────────────────────────────────────
export async function loadTeams(): Promise<Team[]> {
  const org = await getOrg();
  const { data, error } = await (supabase as any)
    .schema('core')
    .from('times')
    .select('*')
    .eq('org', org)
    .order('criado_em', { ascending: false });

  if (error) {
    console.error('[teams] loadTeams error:', error);
    return [];
  }

  // Load member assignments (usuarios with time_id)
  const teamIds = (data || []).map((t: any) => t.id);
  let memberMap: Record<string, string[]> = {};

  if (teamIds.length > 0) {
    const { data: users } = await (supabase as any)
      .schema('core')
      .from('usuarios')
      .select('id, email, time_id')
      .eq('org', org)
      .in('time_id', teamIds);

    if (users) {
      for (const u of users) {
        if (!u.time_id) continue;
        if (!memberMap[u.time_id]) memberMap[u.time_id] = [];
        // Store as frontend ID format: user_email
        memberMap[u.time_id].push(`user_${u.email}`);
      }
    }
  }

  // Resolve supervisor UUIDs to frontend IDs
  const supervisorUuids: string[] = [...new Set((data || []).map((t: any) => t.supervisor_id).filter(Boolean))] as string[];
  const supervisorMap: Record<string, string> = {};
  for (const uuid of supervisorUuids) {
    supervisorMap[uuid] = await resolveUuidToFrontendId(uuid, org);
  }

  return (data || []).map((t: any) => ({
    id: t.id,
    name: t.nome,
    supervisorId: t.supervisor_id ? (supervisorMap[t.supervisor_id] || '') : '',
    memberIds: memberMap[t.id] || [],
    companyId: org,
    areaId: t.area_id || undefined,
    goal: t.meta ? Number(t.meta) : undefined,
    createdAt: t.criado_em ? new Date(t.criado_em).toISOString().slice(0, 10) : '',
  }));
}

// ─── Create a team ───────────────────────────────────────────────────────────
export async function createTeam(data: Partial<Team>): Promise<Team> {
  const { org, empresaId } = await getOrgAndEmpresaId();

  // Resolve supervisor frontend ID → UUID
  let supervisorUuid: string | null = null;
  if (data.supervisorId) {
    const email = emailFromFrontendId(data.supervisorId);
    supervisorUuid = await resolveEmailToUuid(email, org);
  }

  const { data: row, error } = await (supabase as any)
    .schema('core')
    .from('times')
    .insert({
      empresa_id: empresaId,
      org,
      nome: data.name,
      supervisor_id: supervisorUuid,
      meta: data.goal ?? 40,
      area_id: data.areaId || null,
    })
    .select('*')
    .single();

  if (error) throw new Error(`Erro ao criar time: ${error.message}`);

  // Assign members
  if (data.memberIds && data.memberIds.length > 0) {
    await assignMembers(row.id, data.memberIds, org);
  }

  return {
    id: row.id,
    name: row.nome,
    supervisorId: data.supervisorId || '',
    memberIds: data.memberIds || [],
    companyId: org,
    areaId: row.area_id || undefined,
    goal: row.meta ? Number(row.meta) : undefined,
    createdAt: new Date(row.criado_em).toISOString().slice(0, 10),
  };
}

// ─── Update a team ───────────────────────────────────────────────────────────
export async function updateTeam(teamId: string, data: Partial<Team>): Promise<void> {
  const org = await getOrg();
  const updates: Record<string, any> = { atualizado_em: new Date().toISOString() };

  if (data.name !== undefined) updates.nome = data.name;
  if (data.goal !== undefined) updates.meta = data.goal;
  if (data.areaId !== undefined) updates.area_id = data.areaId || null;

  // Resolve supervisor frontend ID → UUID
  if (data.supervisorId !== undefined) {
    if (data.supervisorId) {
      const email = emailFromFrontendId(data.supervisorId);
      updates.supervisor_id = await resolveEmailToUuid(email, org);
    } else {
      updates.supervisor_id = null;
    }
  }

  const { error } = await (supabase as any)
    .schema('core')
    .from('times')
    .update(updates)
    .eq('id', teamId);

  if (error) throw new Error(`Erro ao atualizar time: ${error.message}`);

  // Update member assignments
  if (data.memberIds !== undefined) {
    await assignMembers(teamId, data.memberIds, org);
  }
}

// ─── Delete a team ───────────────────────────────────────────────────────────
export async function deleteTeam(teamId: string): Promise<void> {
  const org = await getOrg();

  // Remove team assignment from users first
  await (supabase as any)
    .schema('core')
    .from('usuarios')
    .update({ time_id: null })
    .eq('org', org)
    .eq('time_id', teamId);

  const { error } = await (supabase as any)
    .schema('core')
    .from('times')
    .delete()
    .eq('id', teamId);

  if (error) throw new Error(`Erro ao excluir time: ${error.message}`);
}

// ─── Assign members to a team ────────────────────────────────────────────────
async function assignMembers(teamId: string, memberIds: string[], org: string): Promise<void> {
  // Remove current members from this team
  await (supabase as any)
    .schema('core')
    .from('usuarios')
    .update({ time_id: null })
    .eq('org', org)
    .eq('time_id', teamId);

  // Assign new members (resolve frontend IDs → emails, then match by email)
  if (memberIds.length > 0) {
    for (const frontendId of memberIds) {
      const email = emailFromFrontendId(frontendId);
      await (supabase as any)
        .schema('core')
        .from('usuarios')
        .update({ time_id: teamId })
        .eq('email', email)
        .eq('org', org);
    }
  }
}
