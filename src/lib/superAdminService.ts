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

export async function getAllOrganizations(): Promise<Organization[]> {
  const { data, error } = await core()
    .from('empresas')
    .select('*')
    .order('criado_em', { ascending: false });

  if (error) throw new Error(`Erro ao buscar organizações: ${error.message}`);
  return (data ?? []) as Organization[];
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
  }));
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
