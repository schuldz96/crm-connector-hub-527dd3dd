/**
 * LicenseContext — Loads and exposes the org's subscription, plan, features,
 * limits and usage. Every page/component can check license state via useLicense().
 *
 * Flow:
 *   1. On mount, resolves the current org (via saas.ts)
 *   2. Fetches: assinatura → plano → plano_features → uso_recursos
 *   3. Exposes helper functions: canAccessModule, isWithinLimit, etc.
 *   4. Checks trial expiration and subscription status
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabaseSaas } from '@/integrations/supabase/client';
import { getOrg } from '@/lib/saas';

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface LicensePlan {
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
}

export interface ModuleTrial {
  modulo: string;
  expira_em: string;
}

export interface LicenseSubscription {
  id: string;
  org: string;
  plano_id: string;
  status: 'ativa' | 'cancelada' | 'suspensa' | 'trial' | 'expirada';
  ciclo: 'mensal' | 'anual';
  trial_ate?: string;
  inicio_em: string;
  trial_modulos: ModuleTrial[];
}

export interface LicenseFeature {
  feature_codigo: string;
  feature_nome: string;
  habilitado: boolean;
  limite?: number;
}

export interface LicenseUsage {
  usuarios_ativos: number;
  instancias_whatsapp: number;
  avaliacoes_ia: number;
  storage_usado_mb: number;
  mensagens_enviadas: number;
}

export interface LicenseContextType {
  // Raw data
  plan: LicensePlan | null;
  subscription: LicenseSubscription | null;
  features: LicenseFeature[];
  usage: LicenseUsage | null;
  isLoading: boolean;
  loaded: boolean;

  // Status helpers
  isActive: boolean;
  isTrial: boolean;
  isExpired: boolean;
  isSuspended: boolean;
  trialDaysLeft: number;
  planName: string;
  planCode: string;

  // Module trials
  trialModules: ModuleTrial[];
  isModuleOnTrial: (moduleCode: string) => boolean;
  moduleTrialDaysLeft: (moduleCode: string) => number;

  // Access checks
  canAccessModule: (moduleCode: string) => boolean;
  getFeatureLimit: (featureCode: string) => number | null;

  // Quota checks
  isWithinUserLimit: (currentCount: number) => boolean;
  isWithinWhatsAppLimit: (currentCount: number) => boolean;
  isWithinAILimit: (currentCount: number) => boolean;
  isWithinStorageLimit: (currentMb: number) => boolean;

  // Plan limits (for display)
  maxUsers: number;
  maxWhatsApp: number;
  maxAI: number;
  maxStorageMb: number;
  pricePerUser: number;

  // Refresh
  refresh: () => Promise<void>;
}

const LicenseContext = createContext<LicenseContextType | null>(null);

// ─── Helpers ────────────────────────────────────────────────────────────────────

const admin = () => (supabaseSaas as any).schema('admin');

function daysBetween(a: Date, b: Date): number {
  return Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

// ─── Provider ───────────────────────────────────────────────────────────────────

export function LicenseProvider({ children }: { children: React.ReactNode }) {
  const [plan, setPlan] = useState<LicensePlan | null>(null);
  const [subscription, setSubscription] = useState<LicenseSubscription | null>(null);
  const [features, setFeatures] = useState<LicenseFeature[]>([]);
  const [usage, setUsage] = useState<LicenseUsage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);

  const loadLicense = useCallback(async () => {
    try {
      const org = await getOrg();

      // 1. Get subscription
      const { data: subData } = await admin()
        .from('assinaturas')
        .select('*')
        .eq('org', org)
        .order('inicio_em', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!subData) {
        // No subscription — org has no plan
        setSubscription(null);
        setPlan(null);
        setFeatures([]);
        setUsage(null);
        return;
      }

      setSubscription({
        ...subData,
        trial_modulos: Array.isArray(subData.trial_modulos) ? subData.trial_modulos : [],
      } as LicenseSubscription);

      // 2. Get plan details
      const { data: planData } = await admin()
        .from('planos')
        .select('*')
        .eq('id', subData.plano_id)
        .single();

      if (planData) {
        setPlan({
          id: planData.id,
          nome: planData.nome,
          codigo: planData.codigo,
          descricao: planData.descricao,
          preco_mensal: planData.preco_mensal ?? 0,
          preco_anual: planData.preco_anual ?? 0,
          preco_por_usuario: planData.preco_por_usuario ?? 0,
          min_usuarios: planData.min_usuarios ?? 1,
          max_usuarios: planData.max_usuarios ?? 999,
          max_instancias_whatsapp: planData.max_instancias_whatsapp ?? 0,
          max_avaliacoes_ia_mes: planData.max_avaliacoes_ia_mes ?? 0,
          storage_mb: planData.storage_mb ?? 0,
          permite_venda_modulo: planData.permite_venda_modulo ?? false,
        });

        // 3. Get plan features
        const { data: featData } = await admin()
          .from('plano_features')
          .select('feature_codigo,feature_nome,habilitado,limite')
          .eq('plano_id', subData.plano_id);

        setFeatures((featData ?? []) as LicenseFeature[]);
      }

      // 4. Get current month usage
      const now = new Date();
      const mesRef = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const { data: usageData } = await admin()
        .from('uso_recursos')
        .select('usuarios_ativos,instancias_whatsapp,avaliacoes_ia,storage_usado_mb,mensagens_enviadas')
        .eq('org', org)
        .eq('mes_ref', mesRef)
        .maybeSingle();

      setUsage(usageData as LicenseUsage | null);
    } catch (err) {
      console.error('[LicenseContext] Failed to load license:', err);
    } finally {
      setIsLoading(false);
      setLoaded(true);
    }
  }, []);

  useEffect(() => { loadLicense(); }, [loadLicense]);

  // ── Derived state ─────────────────────────────────────────────────────────────

  const now = new Date();

  const isTrial = subscription?.status === 'trial';
  const trialEnd = subscription?.trial_ate ? new Date(subscription.trial_ate) : null;
  const trialExpired = isTrial && trialEnd ? trialEnd < now : false;
  const trialDaysLeft = isTrial && trialEnd ? Math.max(0, daysBetween(now, trialEnd)) : 0;

  const isActive = subscription?.status === 'ativa' || (isTrial && !trialExpired);
  const isExpired = subscription?.status === 'expirada' || subscription?.status === 'cancelada' || trialExpired;
  const isSuspended = subscription?.status === 'suspensa';

  const planName = plan?.nome ?? 'Sem plano';
  const planCode = plan?.codigo ?? '';
  const maxUsers = plan?.max_usuarios ?? 0;
  const maxWhatsApp = plan?.max_instancias_whatsapp ?? 0;
  const maxAI = plan?.max_avaliacoes_ia_mes ?? 0;
  const maxStorageMb = plan?.storage_mb ?? 0;
  const pricePerUser = plan?.preco_por_usuario ?? 0;

  // ── Module trials ──────────────────────────────────────────────────────────────

  const activeTrialModules = (subscription?.trial_modulos ?? []).filter(t => {
    return new Date(t.expira_em) > now;
  });

  const isModuleOnTrial = useCallback((moduleCode: string): boolean => {
    return activeTrialModules.some(t => t.modulo === moduleCode);
  }, [activeTrialModules]);

  const moduleTrialDaysLeft = useCallback((moduleCode: string): number => {
    const trial = activeTrialModules.find(t => t.modulo === moduleCode);
    if (!trial) return 0;
    return Math.max(0, daysBetween(now, new Date(trial.expira_em)));
  }, [activeTrialModules]);

  // ── Access checks ─────────────────────────────────────────────────────────────

  const canAccessModule = useCallback((moduleCode: string): boolean => {
    // No subscription at all → allow everything (no license enforcement yet)
    if (!subscription) return true;

    // Subscription exists but expired/suspended → block everything except dashboard
    if (isExpired || isSuspended) {
      return moduleCode === 'dashboard';
    }

    // Check if module is on individual trial (even if not in plan)
    if (isModuleOnTrial(moduleCode)) return true;

    // If no features loaded yet, allow (avoid flash of blocked content)
    if (features.length === 0) return true;

    const feat = features.find(f => f.feature_codigo === moduleCode);
    // If feature not in plan mapping, default to allowed (backwards compat)
    if (!feat) return true;

    return feat.habilitado;
  }, [subscription, features, isExpired, isSuspended, isModuleOnTrial]);

  const getFeatureLimit = useCallback((featureCode: string): number | null => {
    const feat = features.find(f => f.feature_codigo === featureCode);
    return feat?.limite ?? null;
  }, [features]);

  // ── Quota checks ──────────────────────────────────────────────────────────────

  const isWithinUserLimit = useCallback((currentCount: number): boolean => {
    if (maxUsers <= 0) return true; // 0 = unlimited
    return currentCount < maxUsers;
  }, [maxUsers]);

  const isWithinWhatsAppLimit = useCallback((currentCount: number): boolean => {
    if (maxWhatsApp <= 0) return true;
    return currentCount < maxWhatsApp;
  }, [maxWhatsApp]);

  const isWithinAILimit = useCallback((currentCount: number): boolean => {
    if (maxAI <= 0) return true;
    const usedThisMonth = usage?.avaliacoes_ia ?? 0;
    return (usedThisMonth + currentCount) <= maxAI;
  }, [maxAI, usage]);

  const isWithinStorageLimit = useCallback((currentMb: number): boolean => {
    if (maxStorageMb <= 0) return true;
    return currentMb <= maxStorageMb;
  }, [maxStorageMb]);

  return (
    <LicenseContext.Provider value={{
      plan, subscription, features, usage, isLoading, loaded,
      isActive, isTrial, isExpired, isSuspended, trialDaysLeft,
      planName, planCode,
      trialModules: activeTrialModules, isModuleOnTrial, moduleTrialDaysLeft,
      canAccessModule, getFeatureLimit,
      isWithinUserLimit, isWithinWhatsAppLimit, isWithinAILimit, isWithinStorageLimit,
      maxUsers, maxWhatsApp, maxAI, maxStorageMb, pricePerUser,
      refresh: loadLicense,
    }}>
      {children}
    </LicenseContext.Provider>
  );
}

// ─── Hook ───────────────────────────────────────────────────────────────────────

export function useLicense() {
  const ctx = useContext(LicenseContext);
  if (!ctx) throw new Error('useLicense must be used inside LicenseProvider');
  return ctx;
}
