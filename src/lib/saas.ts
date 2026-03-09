import { supabase } from '@/integrations/supabase/client';
import type { UserRole } from '@/types';

const ALLOWED_DOMAIN = (import.meta.env.VITE_GOOGLE_ALLOWED_DOMAIN || 'appmax.com.br').trim().toLowerCase();
let empresaIdCache: string | null = null;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function getSaasEmpresaId(): Promise<string> {
  if (empresaIdCache) return empresaIdCache;

  const { data, error } = await supabase
    .schema('saas')
    .from('empresas')
    .select('id')
    .eq('dominio', ALLOWED_DOMAIN)
    .maybeSingle();

  if (error) throw error;
  if (data?.id) {
    empresaIdCache = data.id;
    return data.id;
  }

  const { data: created, error: createError } = await supabase
    .schema('saas')
    .from('empresas')
    .insert({ nome: 'Appmax', dominio: ALLOWED_DOMAIN, plano: 'enterprise' })
    .select('id')
    .single();

  if (createError) throw createError;
  empresaIdCache = created.id;
  return created.id;
}

export function roleToDb(role: UserRole): string {
  const map: Record<UserRole, string> = {
    admin: 'admin',
    ceo: 'ceo',
    director: 'diretor',
    manager: 'gerente',
    coordinator: 'coordenador',
    supervisor: 'supervisor',
    member: 'vendedor',
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
    vendedor: 'member',
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
