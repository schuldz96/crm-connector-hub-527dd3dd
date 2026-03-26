import { supabase, supabaseSaas } from '@/integrations/supabase/client';
import type { UserRole } from '@/types';
import {
  getSaasEmpresaId,
  normalizeEmail,
  roleFromDb,
  roleToDb,
} from '@/lib/saas';

// ─── Password hashing (MD5) ─────────────────────────────────────────────────
async function hashPassword(plain: string): Promise<string> {
  // MD5 implementation (RFC 1321)
  function md5(input: string): string {
    function safeAdd(x: number, y: number) {
      const lsw = (x & 0xffff) + (y & 0xffff);
      return (((x >> 16) + (y >> 16) + (lsw >> 16)) << 16) | (lsw & 0xffff);
    }
    function bitRotateLeft(num: number, cnt: number) {
      return (num << cnt) | (num >>> (32 - cnt));
    }
    function md5cmn(q: number, a: number, b: number, x: number, s: number, t: number) {
      return safeAdd(bitRotateLeft(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b);
    }
    function md5ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
      return md5cmn((b & c) | (~b & d), a, b, x, s, t);
    }
    function md5gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
      return md5cmn((b & d) | (c & ~d), a, b, x, s, t);
    }
    function md5hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
      return md5cmn(b ^ c ^ d, a, b, x, s, t);
    }
    function md5ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
      return md5cmn(c ^ (b | ~d), a, b, x, s, t);
    }

    const bytes: number[] = [];
    for (let i = 0; i < input.length; i++) {
      const code = input.charCodeAt(i);
      bytes.push(code & 0xff);
      if (code > 0xff) bytes.push((code >> 8) & 0xff);
    }

    const bitLen = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    bytes.push(bitLen & 0xff, (bitLen >> 8) & 0xff, (bitLen >> 16) & 0xff, (bitLen >> 24) & 0xff, 0, 0, 0, 0);

    const words: number[] = [];
    for (let i = 0; i < bytes.length; i += 4) {
      words.push(bytes[i] | (bytes[i + 1] << 8) | (bytes[i + 2] << 16) | (bytes[i + 3] << 24));
    }

    let a = 0x67452301, b = 0xefcdab89, c = 0x98badcfe, d = 0x10325476;
    for (let i = 0; i < words.length; i += 16) {
      const aa = a, bb = b, cc = c, dd = d;
      a = md5ff(a, b, c, d, words[i], 7, -680876936); d = md5ff(d, a, b, c, words[i + 1], 12, -389564586);
      c = md5ff(c, d, a, b, words[i + 2], 17, 606105819); b = md5ff(b, c, d, a, words[i + 3], 22, -1044525330);
      a = md5ff(a, b, c, d, words[i + 4], 7, -176418897); d = md5ff(d, a, b, c, words[i + 5], 12, 1200080426);
      c = md5ff(c, d, a, b, words[i + 6], 17, -1473231341); b = md5ff(b, c, d, a, words[i + 7], 22, -45705983);
      a = md5ff(a, b, c, d, words[i + 8], 7, 1770035416); d = md5ff(d, a, b, c, words[i + 9], 12, -1958414417);
      c = md5ff(c, d, a, b, words[i + 10], 17, -42063); b = md5ff(b, c, d, a, words[i + 11], 22, -1990404162);
      a = md5ff(a, b, c, d, words[i + 12], 7, 1804603682); d = md5ff(d, a, b, c, words[i + 13], 12, -40341101);
      c = md5ff(c, d, a, b, words[i + 14], 17, -1502002290); b = md5ff(b, c, d, a, words[i + 15], 22, 1236535329);
      a = md5gg(a, b, c, d, words[i + 1], 5, -165796510); d = md5gg(d, a, b, c, words[i + 6], 9, -1069501632);
      c = md5gg(c, d, a, b, words[i + 11], 14, 643717713); b = md5gg(b, c, d, a, words[i], 20, -373897302);
      a = md5gg(a, b, c, d, words[i + 5], 5, -701558691); d = md5gg(d, a, b, c, words[i + 10], 9, 38016083);
      c = md5gg(c, d, a, b, words[i + 15], 14, -660478335); b = md5gg(b, c, d, a, words[i + 4], 20, -405537848);
      a = md5gg(a, b, c, d, words[i + 9], 5, 568446438); d = md5gg(d, a, b, c, words[i + 14], 9, -1019803690);
      c = md5gg(c, d, a, b, words[i + 3], 14, -187363961); b = md5gg(b, c, d, a, words[i + 8], 20, 1163531501);
      a = md5gg(a, b, c, d, words[i + 13], 5, -1444681467); d = md5gg(d, a, b, c, words[i + 2], 9, -51403784);
      c = md5gg(c, d, a, b, words[i + 7], 14, 1735328473); b = md5gg(b, c, d, a, words[i + 12], 20, -1926607734);
      a = md5hh(a, b, c, d, words[i + 5], 4, -378558); d = md5hh(d, a, b, c, words[i + 8], 11, -2022574463);
      c = md5hh(c, d, a, b, words[i + 11], 16, 1839030562); b = md5hh(b, c, d, a, words[i + 14], 23, -35309556);
      a = md5hh(a, b, c, d, words[i + 1], 4, -1530992060); d = md5hh(d, a, b, c, words[i + 4], 11, 1272893353);
      c = md5hh(c, d, a, b, words[i + 7], 16, -155497632); b = md5hh(b, c, d, a, words[i + 10], 23, -1094730640);
      a = md5hh(a, b, c, d, words[i + 13], 4, 681279174); d = md5hh(d, a, b, c, words[i + 0], 11, -358537222);
      c = md5hh(c, d, a, b, words[i + 3], 16, -722521979); b = md5hh(b, c, d, a, words[i + 6], 23, 76029189);
      a = md5hh(a, b, c, d, words[i + 9], 4, -640364487); d = md5hh(d, a, b, c, words[i + 12], 11, -421815835);
      c = md5hh(c, d, a, b, words[i + 15], 16, 530742520); b = md5hh(b, c, d, a, words[i + 2], 23, -995338651);
      a = md5ii(a, b, c, d, words[i], 6, -198630844); d = md5ii(d, a, b, c, words[i + 7], 10, 1126891415);
      c = md5ii(c, d, a, b, words[i + 14], 15, -1416354905); b = md5ii(b, c, d, a, words[i + 5], 21, -57434055);
      a = md5ii(a, b, c, d, words[i + 12], 6, 1700485571); d = md5ii(d, a, b, c, words[i + 3], 10, -1894986606);
      c = md5ii(c, d, a, b, words[i + 10], 15, -1051523); b = md5ii(b, c, d, a, words[i + 1], 21, -2054922799);
      a = md5ii(a, b, c, d, words[i + 8], 6, 1873313359); d = md5ii(d, a, b, c, words[i + 15], 10, -30611744);
      c = md5ii(c, d, a, b, words[i + 6], 15, -1560198380); b = md5ii(b, c, d, a, words[i + 13], 21, 1309151649);
      a = md5ii(a, b, c, d, words[i + 4], 6, -145523070); d = md5ii(d, a, b, c, words[i + 11], 10, -1120210379);
      c = md5ii(c, d, a, b, words[i + 2], 15, 718787259); b = md5ii(b, c, d, a, words[i + 9], 21, -343485551);
      a = safeAdd(a, aa); b = safeAdd(b, bb); c = safeAdd(c, cc); d = safeAdd(d, dd);
    }

    const hex = (n: number) =>
      Array.from({ length: 4 }, (_, i) => ((n >> (i * 8)) & 0xff).toString(16).padStart(2, '0')).join('');
    return hex(a) + hex(b) + hex(c) + hex(d);
  }

  return md5(plain);
}

export const hashPasswordForLogin = hashPassword;

export interface AllowedUser {
  email: string;
  name: string;
  role: UserRole;
  password?: string;
  avatar?: string;
  createdAt?: string;
  areaId?: string;
  teamId?: string;
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
  const { data, error } = await supabaseSaas
    .schema(\'saas\')
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

  // Check if user already exists
  const { data: existing } = await supabaseSaas
    .schema(\'saas\')
    .from('usuarios')
    .select('id')
    .eq('empresa_id', empresaId)
    .eq('email', email)
    .maybeSingle();

  if (existing) {
    // UPDATE only the fields that were provided (never clear password/avatar)
    const patch: Record<string, any> = {
      nome: user.name,
      papel: roleToDb(user.role),
      status: 'ativo',
    };
    if (user.password) patch.senha_hash = await hashPassword(user.password);
    if (user.avatar !== undefined) patch.avatar_url = user.avatar || null;

    const { error } = await supabaseSaas
      .schema(\'saas\')
      .from('usuarios')
      .update(patch)
      .eq('id', existing.id);

    if (error) throw error;
  } else {
    // INSERT new user
    const { error } = await supabaseSaas
      .schema(\'saas\')
      .from('usuarios')
      .insert({
        empresa_id: empresaId,
        email,
        nome: user.name,
        papel: roleToDb(user.role),
        status: 'ativo',
        senha_hash: user.password ? await hashPassword(user.password) : null,
        avatar_url: user.avatar || null,
      });

    if (error) throw error;
  }
}

export async function updateUserRole(email: string, role: UserRole): Promise<void> {
  const empresaId = await getSaasEmpresaId();
  const { error } = await supabaseSaas
    .schema(\'saas\')
    .from('usuarios')
    .update({ papel: roleToDb(role) })
    .eq('empresa_id', empresaId)
    .eq('email', norm(email));

  if (error) throw error;
}

export async function removeAllowedUser(email: string): Promise<boolean> {
  const key = norm(email);
  const defaults = new Set(DEFAULT_ALLOWED_USERS.map(u => norm(u.email)));
  if (defaults.has(key)) return false;

  const empresaId = await getSaasEmpresaId();
  const { error } = await supabaseSaas
    .schema(\'saas\')
    .from('usuarios')
    .update({ status: 'inativo' })
    .eq('empresa_id', empresaId)
    .eq('email', key);

  if (error) throw error;
  return true;
}

export async function getPendingAccessRequests(): Promise<AccessRequest[]> {
  const empresaId = await getSaasEmpresaId();
  const { data, error } = await supabaseSaas
    .schema(\'saas\')
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

  const { data: existing, error: findErr } = await supabaseSaas
    .schema(\'saas\')
    .from('solicitacoes_acesso')
    .select('id')
    .eq('empresa_id', empresaId)
    .eq('email', email)
    .eq('status', 'pendente')
    .maybeSingle();

  if (findErr) throw findErr;

  if (existing?.id) {
    const { data: updated, error: updErr } = await supabaseSaas
      .schema(\'saas\')
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

  const { data: created, error: createErr } = await supabaseSaas
    .schema(\'saas\')
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
  const { data, error } = await supabaseSaas
    .schema(\'saas\')
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

  const { data: req, error: reqErr } = await supabaseSaas
    .schema(\'saas\')
    .from('solicitacoes_acesso')
    .select('id,empresa_id,email,nome,foto_url,status')
    .eq('id', params.requestId)
    .maybeSingle();

  if (reqErr || !req) return false;

  const { error: updErr } = await supabaseSaas
    .schema(\'saas\')
    .from('solicitacoes_acesso')
    .update({
      status: 'aprovada',
      papel_sugerido: roleToDb(params.role),
      decidido_em: new Date().toISOString(),
      decidido_por_usuario_id: approverId,
    })
    .eq('id', params.requestId);

  if (updErr) return false;

  const { error: upsertErr } = await supabaseSaas
    .schema(\'saas\')
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
  const { error } = await supabaseSaas
    .schema(\'saas\')
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

  const { data, error } = await supabaseSaas
    .schema(\'saas\')
    .from('usuarios')
    .select('email,nome,papel,senha_hash,avatar_url,status,criado_em,area_id,time_id')
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
    areaId: data.area_id || undefined,
    teamId: data.time_id || undefined,
  };
}

export async function updateAllowedUserProfile(params: { email: string; name?: string; avatar?: string }) {
  const empresaId = await getSaasEmpresaId();
  const patch: Record<string, unknown> = {};
  if (typeof params.name === 'string' && params.name.trim()) patch.nome = params.name.trim();
  if (typeof params.avatar === 'string') patch.avatar_url = params.avatar;
  if (!Object.keys(patch).length) return;

  const { error } = await supabaseSaas
    .schema(\'saas\')
    .from('usuarios')
    .update(patch)
    .eq('empresa_id', empresaId)
    .eq('email', norm(params.email));

  if (error) throw error;
}

export async function autoCreateAppmaxUser(email: string): Promise<void> {
  const empresaId = await getSaasEmpresaId();
  const normalized = norm(email);

  // Check if already exists
  const { data: existing } = await supabaseSaas
    .schema(\'saas\')
    .from('usuarios')
    .select('id')
    .eq('empresa_id', empresaId)
    .eq('email', normalized)
    .maybeSingle();

  if (existing) return; // already registered

  // Generate random password and hash with MD5
  const randomPass = crypto.getRandomValues(new Uint8Array(16));
  const randomHex = Array.from(randomPass).map(b => b.toString(16).padStart(2, '0')).join('');
  const hash = await hashPassword(randomHex);

  const namePart = normalized.split('@')[0].replace(/[._]/g, ' ');
  const name = namePart.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  const { error } = await supabaseSaas
    .schema(\'saas\')
    .from('usuarios')
    .insert({
      empresa_id: empresaId,
      email: normalized,
      nome: name,
      papel: 'vendedor',
      status: 'ativo',
      senha_hash: hash,
    });

  if (error) throw error;
}

export async function resetUserPassword(email: string, newPassword: string): Promise<void> {
  const empresaId = await getSaasEmpresaId();
  const hash = await hashPassword(newPassword);
  const { error } = await supabaseSaas
    .schema(\'saas\')
    .from('usuarios')
    .update({ senha_hash: hash })
    .eq('empresa_id', empresaId)
    .eq('email', norm(email));

  if (error) throw error;
}

export async function recordLastLogin(email: string): Promise<void> {
  const empresaId = await getSaasEmpresaId();
  await supabaseSaas
    .schema(\'saas\')
    .from('usuarios')
    .update({ ultimo_login_em: new Date().toISOString() })
    .eq('empresa_id', empresaId)
    .eq('email', norm(email));
}
