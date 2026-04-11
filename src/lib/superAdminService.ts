import { supabaseSaas } from '@/integrations/supabase/client';

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface SuperAdmin {
  id: string;
  nome: string;
  email: string;
}

export interface Organization {
  id: string;
  org: string;
  nome: string;
  dominio: string;
  plano: string;
  ativo: boolean;
  criado_em: string;
  subtitulo?: string;
}

export interface Plan {
  id: string;
  nome: string;
  codigo: string;
  descricao?: string;
  preco_mensal: number;
  preco_anual: number;
  preco_por_usuario: number;
  min_usuarios: number;
  max_usuarios: number;
  max_instancias_whatsapp: number;
  max_avaliacoes_ia_mes: number;
  storage_mb: number;
  permite_venda_modulo: boolean;
  ativo: boolean;
}

export interface Subscription {
  id: string;
  org: string;
  plano_id: string;
  status: string;
  ciclo: string;
  trial_ate?: string;
  inicio_em: string;
  plano_nome?: string;
  proximo_pagamento?: string;
  cancelado_em?: string;
}

export interface OrganizationWithSubscription extends Organization {
  status_assinatura?: string;
  plano_nome?: string;
  ciclo?: string;
  proximo_pagamento?: string;
}

export interface FeatureFlag {
  id: string;
  codigo: string;
  nome: string;
  descricao?: string;
  habilitado_global: boolean;
  orgs_habilitadas: string[];
  planos_habilitados: string[];
}

export interface AdminAuditEntry {
  id: string;
  admin_id?: string;
  acao: string;
  entidade_tipo?: string;
  entidade_id?: string;
  detalhes: any;
  ip_origem?: string;
  criado_em: string;
}

export interface ResourceUsage {
  id: string;
  org: string;
  mes_ref: string;
  usuarios_ativos: number;
  instancias_whatsapp: number;
  avaliacoes_ia: number;
  storage_usado_mb: number;
  mensagens_enviadas: number;
}

export interface PlatformConfig {
  id: string;
  chave: string;
  valor?: string;
  tipo: string;
  descricao?: string;
}

// ─── Schema Helpers ─────────────────────────────────────────────────────────────

const admin = () => (supabaseSaas as any).schema('admin');
const core = () => (supabaseSaas as any).schema('core');

// ─── Authentication ─────────────────────────────────────────────────────────────

export async function authenticateSuperAdmin(
  email: string,
  hashedPassword: string,
): Promise<SuperAdmin | null> {
  const { data, error } = await admin()
    .from('super_admins')
    .select('id,nome,email,senha_hash,ativo')
    .eq('email', email.trim().toLowerCase())
    .eq('ativo', true)
    .maybeSingle();

  if (error || !data) return null;
  if (data.senha_hash !== hashedPassword) return null;

  // Record last login (fire-and-forget)
  admin()
    .from('super_admins')
    .update({ ultimo_login_em: new Date().toISOString() })
    .eq('id', data.id)
    .then(() => {});

  return { id: data.id, nome: data.nome, email: data.email };
}

// ─── Organizations ──────────────────────────────────────────────────────────────

export async function createOrganization(org: {
  nome: string;
  dominio?: string;
  ativo?: boolean;
}): Promise<Organization> {
  // Format: [A-Z][0-9]{10}[A-Z] — ex: A1234567890Z
  const letter = () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)];
  const digits = Array.from({ length: 10 }, () => Math.floor(Math.random() * 10)).join('');
  const orgKey = `${letter()}${digits}${letter()}`;

  const { data, error } = await core()
    .from('empresas')
    .insert({ ...org, org: orgKey })
    .select()
    .single();

  if (error) throw new Error(`Erro ao criar organizacao: ${error.message}`);
  return data as Organization;
}

export async function updateOrganization(id: string, updates: Partial<Organization>): Promise<Organization> {
  // Whitelist: nunca deixar frontend mudar org key, id, criado_em ou qualquer outra coluna arbitrária.
  const allowed: Record<string, unknown> = {};
  if (updates.nome !== undefined) allowed.nome = updates.nome;
  if (updates.dominio !== undefined) allowed.dominio = updates.dominio;
  if (updates.plano !== undefined) allowed.plano = updates.plano;
  if (updates.ativo !== undefined) allowed.ativo = updates.ativo;
  if (updates.subtitulo !== undefined) allowed.subtitulo = updates.subtitulo;

  const { data, error } = await core()
    .from('empresas')
    .update(allowed)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Erro ao atualizar organizacao: ${error.message}`);
  return data as Organization;
}

export async function getAllOrganizations(): Promise<Organization[]> {
  const { data, error } = await core()
    .from('empresas')
    .select('*')
    .order('criado_em', { ascending: false });

  if (error) throw new Error(`Erro ao buscar organizações: ${error.message}`);
  return (data ?? []) as Organization[];
}

export async function inviteUserToOrg(payload: {
  email: string;
  nome: string;
  papel: string;
  empresa_id: string;
  org: string;
  area_id?: string | null;
  time_id?: string | null;
}): Promise<{ success: boolean; user_id: string }> {
  const { data, error } = await supabaseSaas.functions.invoke('admin-invite-user', {
    body: payload,
  });
  if (error) {
    try {
      const ctx: any = (error as any).context;
      if (ctx?.body) {
        const parsed = typeof ctx.body === 'string' ? JSON.parse(ctx.body) : ctx.body;
        if (parsed?.error) throw new Error(parsed.error);
      }
    } catch (parseErr: any) {
      if (parseErr?.message && parseErr.message !== error.message) throw parseErr;
    }
    throw new Error(`Erro ao convidar usuario: ${error.message}`);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

function calcProximoPagamento(inicioEm: Date, ciclo: string, status: string, trialAte?: string): string | null {
  if (status === 'trial' && trialAte) return new Date(trialAte).toISOString();
  if (status === 'cancelada' || status === 'suspensa' || status === 'expirada') return null;
  const next = new Date(inicioEm);
  if (ciclo === 'anual') next.setFullYear(next.getFullYear() + 1);
  else next.setMonth(next.getMonth() + 1);
  return next.toISOString();
}

export async function getAllOrganizationsWithSubscription(): Promise<OrganizationWithSubscription[]> {
  const [orgs, subs] = await Promise.all([
    core().from('empresas').select('*').order('criado_em', { ascending: false }),
    admin().from('assinaturas').select('*, planos(nome)').order('inicio_em', { ascending: false }),
  ]);

  if (orgs.error) throw new Error(`Erro ao buscar organizacoes: ${orgs.error.message}`);
  if (subs.error) throw new Error(`Erro ao buscar assinaturas: ${subs.error.message}`);

  // Quando há múltiplas assinaturas pra mesma org, priorizar ativa → trial → demais.
  // Dentro do mesmo tier, a primeira (inicio_em DESC) vence.
  const statusPriority = (s: string | null | undefined): number => {
    if (s === 'ativa') return 0;
    if (s === 'trial') return 1;
    if (s === 'suspensa') return 2;
    if (s === 'expirada') return 3;
    return 4; // cancelada e quaisquer outros
  };
  const subsMap = new Map<string, any>();
  for (const sub of (subs.data ?? [])) {
    const existing = subsMap.get(sub.org);
    if (!existing || statusPriority(sub.status) < statusPriority(existing.status)) {
      subsMap.set(sub.org, sub);
    }
  }

  const now = new Date();
  return (orgs.data ?? []).map((org: any) => {
    const sub = subsMap.get(org.org);
    let status = sub?.status;
    if (status === 'trial' && sub?.trial_ate) {
      const trialEnd = new Date(sub.trial_ate);
      trialEnd.setHours(23, 59, 59, 999);
      if (trialEnd < now) status = 'expirada';
    }
    return {
      ...org,
      status_assinatura: status,
      plano_nome: sub?.planos?.nome,
      ciclo: sub?.ciclo,
      proximo_pagamento: sub?.proximo_pagamento,
    };
  });
}

export async function createSubscription(sub: {
  org: string;
  plano_id: string;
  ciclo?: string;
  status?: string;
  trial_ate?: string;
}): Promise<Subscription> {
  const ciclo = sub.ciclo ?? 'mensal';
  const status = sub.status ?? 'ativa';
  const inicioEm = new Date();
  const proximoPagamento = calcProximoPagamento(inicioEm, ciclo, status, sub.trial_ate);

  const { data, error } = await admin()
    .from('assinaturas')
    .insert({
      org: sub.org,
      plano_id: sub.plano_id,
      ciclo,
      status,
      trial_ate: sub.trial_ate ?? null,
      inicio_em: inicioEm.toISOString(),
      proximo_pagamento: proximoPagamento,
    })
    .select('*,planos(nome)')
    .single();

  if (error) throw new Error(`Erro ao criar assinatura: ${error.message}`);
  return {
    id: data.id,
    org: data.org,
    plano_id: data.plano_id,
    status: data.status,
    ciclo: data.ciclo,
    trial_ate: data.trial_ate ?? undefined,
    inicio_em: data.inicio_em,
    plano_nome: (data as any).planos?.nome ?? undefined,
    proximo_pagamento: data.proximo_pagamento ?? undefined,
    cancelado_em: data.cancelado_em ?? undefined,
  };
}

export async function getOrgDetail(org: string): Promise<Organization | null> {
  const { data, error } = await core()
    .from('empresas')
    .select('*')
    .eq('org', org)
    .maybeSingle();

  if (error) throw new Error(`Erro ao buscar organização: ${error.message}`);
  return (data as Organization) ?? null;
}

export async function getOrgUsers(org: string) {
  const { data, error } = await core()
    .from('usuarios')
    .select('id,nome,email,papel,status,avatar_url,criado_em,ultimo_login_em')
    .eq('org', org)
    .order('nome', { ascending: true });

  if (error) throw new Error(`Erro ao buscar usuários da org: ${error.message}`);
  return data ?? [];
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
}

export interface UserQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  org?: string;
  papel?: string;
  status?: string;
  sortBy?: string;
  sortAsc?: boolean;
}

export async function getPaginatedUsers(params: UserQueryParams = {}): Promise<PaginatedResult<any>> {
  const { page = 1, pageSize = 20, search, org, papel, status, sortBy = 'criado_em', sortAsc = false } = params;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = core()
    .from('usuarios')
    .select('id,nome,email,org,papel,status,ultimo_login_em,criado_em', { count: 'exact' });

  if (search) query = query.or(`nome.ilike.%${search}%,email.ilike.%${search}%`);
  if (org && org !== 'all') query = query.eq('org', org);
  if (papel && papel !== 'all') query = query.eq('papel', papel);
  if (status && status !== 'all') query = query.eq('status', status);

  query = query.order(sortBy, { ascending: sortAsc }).range(from, to);

  const { data, count, error } = await query;
  if (error) throw new Error(`Erro ao buscar usuarios: ${error.message}`);
  return { data: data ?? [], total: count ?? 0 };
}

export async function updateUser(id: string, updates: Record<string, any>) {
  const { data, error } = await core()
    .from('usuarios')
    .update({ ...updates, atualizado_em: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Erro ao atualizar usuario: ${error.message}`);
  return data;
}

export async function countActiveAdmins(org: string): Promise<number> {
  const { count, error } = await core()
    .from('usuarios')
    .select('id', { count: 'exact', head: true })
    .eq('org', org)
    .eq('papel', 'admin')
    .eq('status', 'ativo');

  if (error) throw new Error(`Erro ao contar admins: ${error.message}`);
  return count ?? 0;
}

export async function getOrgStats(org: string) {
  const { count: totalUsers, error: usersErr } = await core()
    .from('usuarios')
    .select('id', { count: 'exact', head: true })
    .eq('org', org);

  const { count: activeUsers, error: activeErr } = await core()
    .from('usuarios')
    .select('id', { count: 'exact', head: true })
    .eq('org', org)
    .eq('status', 'ativo');

  if (usersErr) throw new Error(`Erro ao contar usuários: ${usersErr.message}`);
  if (activeErr) throw new Error(`Erro ao contar usuários ativos: ${activeErr.message}`);

  return {
    totalUsers: totalUsers ?? 0,
    activeUsers: activeUsers ?? 0,
  };
}

// ─── Plans ──────────────────────────────────────────────────────────────────────

export async function getAllPlans(): Promise<Plan[]> {
  const { data, error } = await admin()
    .from('planos')
    .select('*')
    .order('preco_mensal', { ascending: true });

  if (error) throw new Error(`Erro ao buscar planos: ${error.message}`);
  return (data ?? []) as Plan[];
}

export async function createPlan(plan: Partial<Plan>): Promise<Plan> {
  const { data, error } = await admin()
    .from('planos')
    .insert(plan)
    .select()
    .single();

  if (error) throw new Error(`Erro ao criar plano: ${error.message}`);
  return data as Plan;
}

export async function updatePlan(id: string, updates: Partial<Plan>): Promise<Plan> {
  const { data, error } = await admin()
    .from('planos')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Erro ao atualizar plano: ${error.message}`);
  return data as Plan;
}

// ─── Subscriptions ──────────────────────────────────────────────────────────────

export async function getAllSubscriptions(): Promise<Subscription[]> {
  const { data, error } = await admin()
    .from('assinaturas')
    .select('*,planos(nome)')
    .order('inicio_em', { ascending: false });

  if (error) throw new Error(`Erro ao buscar assinaturas: ${error.message}`);

  return (data ?? []).map((s: any) => ({
    id: s.id,
    org: s.org,
    plano_id: s.plano_id,
    status: s.status,
    ciclo: s.ciclo,
    trial_ate: s.trial_ate ?? undefined,
    inicio_em: s.inicio_em,
    plano_nome: s.planos?.nome ?? undefined,
    proximo_pagamento: s.proximo_pagamento ?? undefined,
    cancelado_em: s.cancelado_em ?? undefined,
  }));
}

export async function getOrgSubscriptionHistory(org: string): Promise<Subscription[]> {
  const { data, error } = await admin()
    .from('assinaturas')
    .select('*,planos(nome)')
    .eq('org', org)
    .order('inicio_em', { ascending: false });

  if (error) throw new Error(`Erro ao buscar historico de assinaturas: ${error.message}`);

  return (data ?? []).map((s: any) => ({
    id: s.id,
    org: s.org,
    plano_id: s.plano_id,
    status: s.status,
    ciclo: s.ciclo,
    trial_ate: s.trial_ate ?? undefined,
    inicio_em: s.inicio_em,
    plano_nome: s.planos?.nome ?? undefined,
    proximo_pagamento: s.proximo_pagamento ?? undefined,
    cancelado_em: s.cancelado_em ?? undefined,
  }));
}

export async function hasActiveSubscription(org: string): Promise<boolean> {
  const { count, error } = await admin()
    .from('assinaturas')
    .select('id', { count: 'exact', head: true })
    .eq('org', org)
    .eq('status', 'ativa');

  if (error) throw new Error(`Erro ao verificar assinatura ativa: ${error.message}`);
  return (count ?? 0) > 0;
}

export async function getOrgSubscription(org: string): Promise<Subscription | null> {
  const { data, error } = await admin()
    .from('assinaturas')
    .select('*,planos(nome)')
    .eq('org', org)
    .order('inicio_em', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Erro ao buscar assinatura da org: ${error.message}`);
  if (!data) return null;

  return {
    id: data.id,
    org: data.org,
    plano_id: data.plano_id,
    status: data.status,
    ciclo: data.ciclo,
    trial_ate: data.trial_ate ?? undefined,
    inicio_em: data.inicio_em,
    plano_nome: data.planos?.nome ?? undefined,
    proximo_pagamento: data.proximo_pagamento ?? undefined,
    cancelado_em: data.cancelado_em ?? undefined,
  };
}

export async function updateSubscription(id: string, updates: Record<string, any>): Promise<Subscription> {
  const { data, error } = await admin()
    .from('assinaturas')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Erro ao atualizar assinatura: ${error.message}`);
  return data as Subscription;
}

// ─── Feature Flags ──────────────────────────────────────────────────────────────

export async function getFeatureFlags(): Promise<FeatureFlag[]> {
  const { data, error } = await admin()
    .from('feature_flags')
    .select('*')
    .order('codigo', { ascending: true });

  if (error) throw new Error(`Erro ao buscar feature flags: ${error.message}`);
  return (data ?? []) as FeatureFlag[];
}

export async function updateFeatureFlag(id: string, updates: Partial<FeatureFlag>): Promise<FeatureFlag> {
  const { data, error } = await admin()
    .from('feature_flags')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Erro ao atualizar feature flag: ${error.message}`);
  return data as FeatureFlag;
}

export async function createFeatureFlag(flag: Partial<FeatureFlag>): Promise<FeatureFlag> {
  const { data, error } = await admin()
    .from('feature_flags')
    .insert(flag)
    .select()
    .single();

  if (error) throw new Error(`Erro ao criar feature flag: ${error.message}`);
  return data as FeatureFlag;
}

export async function deleteFeatureFlag(id: string): Promise<void> {
  const { error } = await admin()
    .from('feature_flags')
    .delete()
    .eq('id', id);
  if (error) throw new Error(`Erro ao excluir feature flag: ${error.message}`);
}

// ─── Resource Usage ─────────────────────────────────────────────────────────────

export async function getResourceUsage(org?: string): Promise<ResourceUsage[]> {
  let query = admin()
    .from('uso_recursos')
    .select('*')
    .order('mes_ref', { ascending: false });

  if (org) {
    query = query.eq('org', org);
  }

  const { data, error } = await query;

  if (error) throw new Error(`Erro ao buscar uso de recursos: ${error.message}`);
  return (data ?? []) as ResourceUsage[];
}

// ─── Platform Config ────────────────────────────────────────────────────────────

export async function getPlatformConfig(): Promise<PlatformConfig[]> {
  const { data, error } = await admin()
    .from('config_plataforma')
    .select('*')
    .order('chave', { ascending: true });

  if (error) throw new Error(`Erro ao buscar configurações: ${error.message}`);
  return (data ?? []) as PlatformConfig[];
}

export async function updatePlatformConfig(id: string, valor: string): Promise<PlatformConfig> {
  const { data, error } = await admin()
    .from('config_plataforma')
    .update({ valor })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Erro ao atualizar configuração: ${error.message}`);
  return data as PlatformConfig;
}

// ─── Audit ──────────────────────────────────────────────────────────────────────

export async function getAdminAuditLogs(limit: number = 100): Promise<AdminAuditEntry[]> {
  const { data, error } = await admin()
    .from('audit_admin')
    .select('*')
    .order('criado_em', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Erro ao buscar logs de auditoria: ${error.message}`);
  return (data ?? []) as AdminAuditEntry[];
}

export interface AuditFilters {
  acao?: string;
  entidade_tipo?: string;
  de?: string;
  ate?: string;
}

export async function getFilteredAuditLogs(
  filters: AuditFilters = {},
  limit: number = 200,
): Promise<AdminAuditEntry[]> {
  let query = admin()
    .from('audit_admin')
    .select('*')
    .order('criado_em', { ascending: false })
    .limit(limit);

  if (filters.acao) query = query.eq('acao', filters.acao);
  if (filters.entidade_tipo) query = query.eq('entidade_tipo', filters.entidade_tipo);
  if (filters.de) query = query.gte('criado_em', `${filters.de}T00:00:00`);
  if (filters.ate) query = query.lte('criado_em', `${filters.ate}T23:59:59`);

  const { data, error } = await query;
  if (error) throw new Error(`Erro ao buscar logs filtrados: ${error.message}`);
  return (data ?? []) as AdminAuditEntry[];
}

export async function logAdminAction(
  adminId: string,
  acao: string,
  entidade_tipo?: string,
  entidade_id?: string,
  detalhes?: any,
): Promise<void> {
  const { error } = await admin()
    .from('audit_admin')
    .insert({
      admin_id: adminId,
      acao,
      entidade_tipo: entidade_tipo ?? null,
      entidade_id: entidade_id ?? null,
      detalhes: detalhes ?? null,
    });

  if (error) {
    console.error('Erro ao registrar ação de auditoria:', error.message);
  }
}

// ─── Dashboard Stats ────────────────────────────────────────────────────────────

export interface DashboardStats {
  totalOrgs: number;
  totalUsers: number;
  totalActiveSubscriptions: number;
  mrr: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  // Total organizations
  const { count: totalOrgs, error: orgsErr } = await core()
    .from('empresas')
    .select('id', { count: 'exact', head: true });

  if (orgsErr) throw new Error(`Erro ao contar organizações: ${orgsErr.message}`);

  // Total users
  const { count: totalUsers, error: usersErr } = await core()
    .from('usuarios')
    .select('id', { count: 'exact', head: true });

  if (usersErr) throw new Error(`Erro ao contar usuários: ${usersErr.message}`);

  // Active subscriptions
  const { data: activeSubs, error: subsErr } = await admin()
    .from('assinaturas')
    .select('id,plano_id')
    .eq('status', 'ativa');

  if (subsErr) throw new Error(`Erro ao buscar assinaturas ativas: ${subsErr.message}`);

  const totalActiveSubscriptions = activeSubs?.length ?? 0;

  // MRR: sum of monthly price for active subscriptions
  let mrr = 0;
  if (activeSubs && activeSubs.length > 0) {
    const planIds = [...new Set(activeSubs.map((s: any) => s.plano_id))];
    const { data: plans, error: plansErr } = await admin()
      .from('planos')
      .select('id,preco_mensal')
      .in('id', planIds);

    if (!plansErr && plans) {
      const priceMap = new Map(plans.map((p: any) => [p.id, p.preco_mensal ?? 0]));
      for (const sub of activeSubs) {
        mrr += priceMap.get(sub.plano_id) ?? 0;
      }
    }
  }

  return {
    totalOrgs: totalOrgs ?? 0,
    totalUsers: totalUsers ?? 0,
    totalActiveSubscriptions,
    mrr,
  };
}

export interface DashboardChartData {
  planDistribution: { name: string; value: number }[];
  orgStatus: { name: string; value: number }[];
  trialExpirados: number;
}

export async function getDashboardChartData(): Promise<DashboardChartData> {
  const [orgsRes, subsRes, plansRes] = await Promise.all([
    core().from('empresas').select('ativo'),
    admin().from('assinaturas').select('plano_id,status,trial_ate').order('inicio_em', { ascending: false }),
    admin().from('planos').select('id,nome'),
  ]);

  if (orgsRes.error) throw new Error(orgsRes.error.message);
  if (subsRes.error) throw new Error(subsRes.error.message);
  if (plansRes.error) throw new Error(plansRes.error.message);

  const orgs = orgsRes.data ?? [];
  const subs = subsRes.data ?? [];
  const plans = plansRes.data ?? [];

  // Org status
  const activeOrgs = orgs.filter((o: any) => o.ativo).length;
  const inactiveOrgs = orgs.length - activeOrgs;
  const orgStatus = [
    { name: 'Ativas', value: activeOrgs },
    { name: 'Inativas', value: inactiveOrgs },
  ];

  // Plan distribution (from most recent sub per org)
  const planMap = new Map(plans.map((p: any) => [p.id, p.nome]));
  const planCount = new Map<string, number>();
  const seenOrgs = new Set<string>();
  for (const sub of subs) {
    const orgId = (sub as any).org;
    if (seenOrgs.has(orgId)) continue;
    seenOrgs.add(orgId);
    const planName = planMap.get(sub.plano_id) ?? 'Desconhecido';
    planCount.set(planName, (planCount.get(planName) ?? 0) + 1);
  }
  const planDistribution = Array.from(planCount.entries()).map(([name, value]) => ({ name, value }));

  // Trials expirados
  const now = new Date();
  let trialExpirados = 0;
  for (const sub of subs) {
    if (sub.status === 'trial' && sub.trial_ate) {
      const trialEnd = new Date(sub.trial_ate);
      trialEnd.setHours(23, 59, 59, 999);
      if (trialEnd < now) trialExpirados++;
    }
  }

  return { planDistribution, orgStatus, trialExpirados };
}

// ─── Modules ────────────────────────────────────────────────────────────────────

export interface SystemModule {
  codigo: string;
  nome: string;
  descricao?: string;
  ativo: boolean;
}

export interface PlanFeature {
  id: string;
  plano_id: string;
  feature_codigo: string;
  feature_nome: string;
  habilitado: boolean;
  limite?: number;
}

export interface OrgModuleOverride {
  id: number;
  org: string;
  modulo_codigo: string;
  habilitado: boolean;
}

export async function getSystemModules(): Promise<SystemModule[]> {
  const { data, error } = await core().from('modulos_sistema').select('*').order('codigo');
  if (error) throw error;
  return data || [];
}

export async function updateSystemModule(codigo: string, updates: Partial<SystemModule>) {
  const { error } = await core().from('modulos_sistema').update(updates).eq('codigo', codigo);
  if (error) throw error;
}

export async function createSystemModule(module: { codigo: string; nome: string; descricao?: string }) {
  const { error } = await core().from('modulos_sistema').insert({ ...module, ativo: true });
  if (error) throw error;
}

export async function getPlanFeatures(planoId: string): Promise<PlanFeature[]> {
  const { data, error } = await admin().from('plano_features').select('*').eq('plano_id', planoId).order('feature_codigo');
  if (error) throw error;
  return data || [];
}

export async function getAllPlanFeatures(): Promise<(PlanFeature & { plano_codigo?: string })[]> {
  const { data: features, error } = await admin().from('plano_features').select('*').order('feature_codigo');
  if (error) throw error;
  return features || [];
}

export async function updatePlanFeature(id: string, habilitado: boolean, limite?: number) {
  const updates: any = { habilitado };
  if (limite !== undefined) updates.limite = limite;
  const { error } = await admin().from('plano_features').update(updates).eq('id', id);
  if (error) throw error;
}

export async function getOrgModuleOverrides(org: string): Promise<OrgModuleOverride[]> {
  const { data, error } = await core().from('configuracoes_modulos_empresa').select('*').eq('org', org);
  if (error) throw error;
  return data || [];
}

export async function setOrgModuleOverride(org: string, moduloCodigo: string, habilitado: boolean) {
  const { data: empresa } = await core().from('empresas').select('id').eq('org', org).maybeSingle();
  const empresaId = empresa?.id;

  const { data: existing } = await core().from('configuracoes_modulos_empresa')
    .select('id').eq('org', org).eq('modulo_codigo', moduloCodigo).maybeSingle();

  if (existing) {
    const { error } = await core().from('configuracoes_modulos_empresa')
      .update({ habilitado }).eq('id', existing.id);
    if (error) throw error;
  } else {
    const { error } = await core().from('configuracoes_modulos_empresa')
      .insert({ empresa_id: empresaId, org, modulo_codigo: moduloCodigo, habilitado });
    if (error) throw error;
  }
}

export async function removeOrgModuleOverride(org: string, moduloCodigo: string) {
  const { error } = await core().from('configuracoes_modulos_empresa')
    .delete().eq('org', org).eq('modulo_codigo', moduloCodigo);
  if (error) throw error;
}

// ─── Backlog Board ─────────────────────────────────────────────────────────────

export interface BacklogTask {
  id: string;
  titulo: string;
  descricao: string;
  status: string;
  prioridade: string;
  tipo: string;
  agente_atual: string | null;
  agente_historico: { agente: string; status: string; timestamp: string; nota?: string }[];
  tags: string[];
  estimativa_horas: number | null;
  modulo: string | null;
  imagem_url: string | null;
  criado_por: string;
  atualizado_em: string;
  criado_em: string;
}

// Storage key for localStorage fallback
const BACKLOG_STORAGE = 'ltx_sa_backlog_tasks';
let useLocalStorage = false;

function loadLocal(): BacklogTask[] {
  try { return JSON.parse(localStorage.getItem(BACKLOG_STORAGE) || '[]'); } catch { return []; }
}
function saveLocal(tasks: BacklogTask[]) {
  localStorage.setItem(BACKLOG_STORAGE, JSON.stringify(tasks));
}

export async function getBacklogTasks(): Promise<BacklogTask[]> {
  try {
    // Exclude imagem_url to avoid huge base64 payloads; load ALL tasks (no limit)
    const cols = 'id,titulo,descricao,status,prioridade,tipo,agente_atual,agente_historico,tags,estimativa_horas,modulo,criado_por,criado_em,atualizado_em';
    const { data, error } = await admin().from('backlog_tasks').select(cols).order('criado_em', { ascending: false });
    const all = data ?? [];
    if (error) throw error;
    useLocalStorage = false;
    return all as BacklogTask[];
  } catch {
    // Table doesn't exist yet — fallback to localStorage
    useLocalStorage = true;
    return loadLocal();
  }
}

export async function createBacklogTask(task: Partial<BacklogTask>): Promise<BacklogTask> {
  const now = new Date().toISOString();
  if (useLocalStorage) {
    const newTask: BacklogTask = {
      id: crypto.randomUUID(),
      titulo: task.titulo ?? '',
      descricao: task.descricao ?? '',
      status: task.status ?? 'backlog',
      prioridade: task.prioridade ?? 'medium',
      tipo: task.tipo ?? 'feature',
      agente_atual: task.agente_atual ?? null,
      agente_historico: task.agente_historico ?? [],
      tags: task.tags ?? [],
      estimativa_horas: task.estimativa_horas ?? null,
      modulo: task.modulo ?? null,
      imagem_url: task.imagem_url ?? null,
      criado_por: task.criado_por ?? 'super-admin',
      atualizado_em: now,
      criado_em: now,
    };
    const tasks = loadLocal();
    tasks.unshift(newTask);
    saveLocal(tasks);
    return newTask;
  }
  const { data, error } = await admin().from('backlog_tasks').insert(task).select().single();
  if (error) throw error;
  return data as BacklogTask;
}

export async function updateBacklogTask(id: string, updates: Partial<BacklogTask>): Promise<BacklogTask> {
  if (useLocalStorage) {
    const tasks = loadLocal();
    const idx = tasks.findIndex(t => t.id === id);
    if (idx === -1) throw new Error('Task não encontrada');
    tasks[idx] = { ...tasks[idx], ...updates, atualizado_em: new Date().toISOString() };
    saveLocal(tasks);
    return tasks[idx];
  }
  const { data, error } = await admin().from('backlog_tasks')
    .update({ ...updates, atualizado_em: new Date().toISOString() })
    .eq('id', id).select().single();
  if (error) throw error;
  return data as BacklogTask;
}

export async function deleteBacklogTask(id: string): Promise<void> {
  if (useLocalStorage) {
    const tasks = loadLocal().filter(t => t.id !== id);
    saveLocal(tasks);
    return;
  }
  const { error } = await admin().from('backlog_tasks').delete().eq('id', id);
  if (error) throw error;
}
