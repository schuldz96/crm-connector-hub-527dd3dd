import { supabase } from '@/integrations/supabase/client';
import type { UserRole } from '@/types';
import {
  getSaasEmpresaId,
  normalizeEmail,
  roleFromDb,
  roleToDb,
} from '@/lib/saas';

export interface AllowedUser {
  email: string;
  name: string;
  role: UserRole;
  password?: string;
  avatar?: string;
  createdAt?: string;
}

export interface AccessRequest {
  id: string;
  email: string;
  name: string;
  picture?: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  decidedAt?: string;
  decidedByEmail?: string;
  role?: UserRole;
}

const DEFAULT_ALLOWED_USERS: AllowedUser[] = [
  { email: 'marcos.schuldz@appmax.com.br', name: 'Marcos Schuldz', role: 'admin' },
  { email: 'yuri.santos@appmax.com.br', name: 'Yuri Santos', role: 'admin' },
];

function norm(email: string): string {
  return normalizeEmail(email);
}

function mergeDefaults(users: AllowedUser[]): AllowedUser[] {
  const map = new Map<string, AllowedUser>();
  for (const u of DEFAULT_ALLOWED_USERS) map.set(norm(u.email), { ...u, email: norm(u.email) });
  for (const u of users) map.set(norm(u.email), { ...u, email: norm(u.email) });
  return Array.from(map.values());
}

export async function loadAllowedUsers(): Promise<AllowedUser[]> {
  const empresaId = await getSaasEmpresaId();
  const { data, error } = await supabase
    .schema('saas')
    .from('usuarios')
    .select('email,nome,papel,senha_hash,avatar_url,criado_em,status')
    .eq('empresa_id', empresaId)
    .eq('status', 'ativo')
    .order('nome', { ascending: true });

  if (error) throw error;
  const users: AllowedUser[] = (data || []).map((u) => ({
    email: norm(u.email),
    name: u.nome,
    role: roleFromDb(u.papel),
    password: u.senha_hash || undefined,
    avatar: u.avatar_url || undefined,
    createdAt: u.criado_em,
  }));

  return mergeDefaults(users);
}

export async function upsertAllowedUser(user: AllowedUser): Promise<void> {
  const empresaId = await getSaasEmpresaId();
  const email = norm(user.email);

  const payload: Record<string, any> = {
    empresa_id: empresaId,
    email,
    nome: user.name,
    papel: roleToDb(user.role),
    status: 'ativo',
  };

  // Only update password/avatar if explicitly provided (avoid clearing on role-only updates)
  if (user.password !== undefined) payload.senha_hash = user.password || null;
  if (user.avatar !== undefined) payload.avatar_url = user.avatar || null;

  const { error } = await supabase
    .schema('saas')
    .from('usuarios')
    .upsert(payload, { onConflict: 'email' });

  if (error) throw error;
}

export async function removeAllowedUser(email: string): Promise<boolean> {
  const key = norm(email);
  const defaults = new Set(DEFAULT_ALLOWED_USERS.map(u => norm(u.email)));
  if (defaults.has(key)) return false;

  const empresaId = await getSaasEmpresaId();
  const { error } = await supabase
    .schema('saas')
    .from('usuarios')
    .update({ status: 'inativo' })
    .eq('empresa_id', empresaId)
    .eq('email', key);

  if (error) throw error;
  return true;
}

export async function getPendingAccessRequests(): Promise<AccessRequest[]> {
  const empresaId = await getSaasEmpresaId();
  const { data, error } = await supabase
    .schema('saas')
    .from('solicitacoes_acesso')
    .select('id,email,nome,foto_url,solicitado_em,status,decidido_em,papel_sugerido,decidido_por_usuario_id')
    .eq('empresa_id', empresaId)
    .eq('status', 'pendente')
    .order('solicitado_em', { ascending: false });

  if (error) throw error;

  return (data || []).map((r) => ({
    id: r.id,
    email: norm(r.email),
    name: r.nome,
    picture: r.foto_url || undefined,
    requestedAt: r.solicitado_em,
    status: 'pending',
    decidedAt: r.decidido_em || undefined,
    role: r.papel_sugerido ? roleFromDb(r.papel_sugerido) : undefined,
  }));
}

export async function createOrRefreshAccessRequest(payload: { email: string; name: string; picture?: string }) {
  const empresaId = await getSaasEmpresaId();
  const email = norm(payload.email);

  const { data: existing, error: findErr } = await supabase
    .schema('saas')
    .from('solicitacoes_acesso')
    .select('id')
    .eq('empresa_id', empresaId)
    .eq('email', email)
    .eq('status', 'pendente')
    .maybeSingle();

  if (findErr) throw findErr;

  if (existing?.id) {
    const { data: updated, error: updErr } = await supabase
      .schema('saas')
      .from('solicitacoes_acesso')
      .update({ nome: payload.name || email.split('@')[0], foto_url: payload.picture || null, solicitado_em: new Date().toISOString() })
      .eq('id', existing.id)
      .select('id,email,nome,foto_url,solicitado_em,status,decidido_em,papel_sugerido')
      .single();

    if (updErr) throw updErr;

    return {
      id: updated.id,
      email: norm(updated.email),
      name: updated.nome,
      picture: updated.foto_url || undefined,
      requestedAt: updated.solicitado_em,
      status: 'pending' as const,
      decidedAt: updated.decidido_em || undefined,
      role: updated.papel_sugerido ? roleFromDb(updated.papel_sugerido) : undefined,
    };
  }

  const { data: created, error: createErr } = await supabase
    .schema('saas')
    .from('solicitacoes_acesso')
    .insert({
      empresa_id: empresaId,
      email,
      nome: payload.name || email.split('@')[0],
      foto_url: payload.picture || null,
      status: 'pendente',
    })
    .select('id,email,nome,foto_url,solicitado_em,status,decidido_em,papel_sugerido')
    .single();

  if (createErr) throw createErr;

  return {
    id: created.id,
    email: norm(created.email),
    name: created.nome,
    picture: created.foto_url || undefined,
    requestedAt: created.solicitado_em,
    status: 'pending' as const,
    decidedAt: created.decidido_em || undefined,
    role: created.papel_sugerido ? roleFromDb(created.papel_sugerido) : undefined,
  };
}

async function findApproverIdByEmail(email: string): Promise<string | null> {
  const empresaId = await getSaasEmpresaId();
  const { data, error } = await supabase
    .schema('saas')
    .from('usuarios')
    .select('id')
    .eq('empresa_id', empresaId)
    .eq('email', norm(email))
    .maybeSingle();
  if (error) throw error;
  return data?.id || null;
}

export async function approveAccessRequest(params: { requestId: string; approverEmail: string; role: UserRole }) {
  const approverId = await findApproverIdByEmail(params.approverEmail);

  const { data: req, error: reqErr } = await supabase
    .schema('saas')
    .from('solicitacoes_acesso')
    .select('id,empresa_id,email,nome,foto_url,status')
    .eq('id', params.requestId)
    .maybeSingle();

  if (reqErr || !req) return false;

  const { error: updErr } = await supabase
    .schema('saas')
    .from('solicitacoes_acesso')
    .update({
      status: 'aprovada',
      papel_sugerido: roleToDb(params.role),
      decidido_em: new Date().toISOString(),
      decidido_por_usuario_id: approverId,
    })
    .eq('id', params.requestId);

  if (updErr) return false;

  const { error: upsertErr } = await supabase
    .schema('saas')
    .from('usuarios')
    .upsert(
      {
        empresa_id: req.empresa_id,
        email: norm(req.email),
        nome: req.nome,
        avatar_url: req.foto_url || null,
        papel: roleToDb(params.role),
        status: 'ativo',
      },
      { onConflict: 'email' },
    );

  if (upsertErr) return false;

  return true;
}

export async function rejectAccessRequest(params: { requestId: string; approverEmail: string }) {
  const approverId = await findApproverIdByEmail(params.approverEmail);
  const { error } = await supabase
    .schema('saas')
    .from('solicitacoes_acesso')
    .update({
      status: 'rejeitada',
      decidido_em: new Date().toISOString(),
      decidido_por_usuario_id: approverId,
    })
    .eq('id', params.requestId);

  return !error;
}

export async function getAllowedUserByEmail(email: string): Promise<AllowedUser | null> {
  const empresaId = await getSaasEmpresaId();
  const normalized = norm(email);

  const { data, error } = await supabase
    .schema('saas')
    .from('usuarios')
    .select('email,nome,papel,senha_hash,avatar_url,status,criado_em')
    .eq('empresa_id', empresaId)
    .eq('email', normalized)
    .eq('status', 'ativo')
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    email: norm(data.email),
    name: data.nome,
    role: roleFromDb(data.papel),
    password: data.senha_hash || undefined,
    avatar: data.avatar_url || undefined,
    createdAt: data.criado_em,
  };
}

export async function updateAllowedUserProfile(params: { email: string; name?: string; avatar?: string }) {
  const empresaId = await getSaasEmpresaId();
  const patch: Record<string, unknown> = {};
  if (typeof params.name === 'string' && params.name.trim()) patch.nome = params.name.trim();
  if (typeof params.avatar === 'string') patch.avatar_url = params.avatar;
  if (!Object.keys(patch).length) return;

  const { error } = await supabase
    .schema('saas')
    .from('usuarios')
    .update(patch)
    .eq('empresa_id', empresaId)
    .eq('email', norm(params.email));

  if (error) throw error;
}
