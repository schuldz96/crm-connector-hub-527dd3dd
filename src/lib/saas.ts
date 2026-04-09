import { supabase } from '@/integrations/supabase/client';
import type { UserRole } from '@/types';
import { CONFIG } from '@/lib/config';

const ALLOWED_DOMAIN = CONFIG.GOOGLE_ALLOWED_DOMAIN;
let orgCache: { org: string; empresaId: string } | null = null;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Returns the org identifier (e.g. 'F9283200581J') for the current tenant.
 * Queries core.empresas by domain and caches both org and empresaId.
 */
export async function getOrg(): Promise<string> {
  if (orgCache) return orgCache.org;
  await resolveOrgCache();
  return orgCache!.org;
}

/**
 * Returns both org and empresaId for insert operations that need both columns
 * during the migration period.
 */
export async function getOrgAndEmpresaId(): Promise<{ org: string; empresaId: string }> {
  if (orgCache) return orgCache;
  await resolveOrgCache();
  return orgCache!;
}

/**
 * Backward-compatible alias — returns the empresa UUID (id).
 * Prefer getOrg() for new code.
 */
export async function getSaasEmpresaId(): Promise<string> {
  return (await getOrgAndEmpresaId()).empresaId;
}

async function resolveOrgCache(): Promise<void> {
  const { data, error } = await (supabase as any)
    .schema('core')
    .from('empresas')
    .select('id, org')
    .eq('dominio', ALLOWED_DOMAIN)
    .maybeSingle();

  if (error) throw error;
  if (data?.id && data?.org) {
    orgCache = { org: data.org, empresaId: data.id };
    return;
  }

  const { data: created, error: createError } = await (supabase as any)
    .schema('core')
    .from('empresas')
    .insert({ nome: 'LTX', dominio: ALLOWED_DOMAIN, plano: 'enterprise' })
    .select('id, org')
    .single();

  if (createError) throw createError;
  orgCache = { org: created.org, empresaId: created.id };
}

export function roleToDb(role: UserRole): string {
  const map: Record<UserRole, string> = {
    admin: 'admin',
    ceo: 'ceo',
    director: 'diretor',
    manager: 'gerente',
    coordinator: 'coordenador',
    supervisor: 'supervisor',
    bdr: 'bdr',
    sdr: 'sdr',
    closer: 'closer',
    key_account: 'key_account',
    csm: 'csm',
    low_touch: 'low_touch',
    sales_engineer: 'sales_engineer',
    member: 'vendedor',
    support: 'suporte',
  };
  return map[role];
}

export function roleFromDb(role: string | null | undefined): UserRole {
  const map: Record<string, UserRole> = {
    admin: 'admin',
    ceo: 'ceo',
    diretor: 'director',
    gerente: 'manager',
    coordenador: 'coordinator',
    supervisor: 'supervisor',
    bdr: 'bdr',
    sdr: 'sdr',
    closer: 'closer',
    key_account: 'key_account',
    csm: 'csm',
    low_touch: 'low_touch',
    sales_engineer: 'sales_engineer',
    vendedor: 'member',
    suporte: 'support',
  };
  return map[(role || '').toLowerCase()] || 'member';
}

export function scopeToDb(scope: 'all' | 'area' | 'team' | 'self'): 'todos' | 'area' | 'time' | 'proprio' {
  const map = {
    all: 'todos',
    area: 'area',
    team: 'time',
    self: 'proprio',
  } as const;
  return map[scope];
}

export function scopeFromDb(scope: string | null | undefined): 'all' | 'area' | 'team' | 'self' {
  const map: Record<string, 'all' | 'area' | 'team' | 'self'> = {
    todos: 'all',
    area: 'area',
    time: 'team',
    proprio: 'self',
  };
  return map[(scope || '').toLowerCase()] || 'self';
}
