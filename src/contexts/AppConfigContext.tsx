import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getSaasEmpresaId } from '@/lib/saas';
import { CONFIG } from '@/lib/config';

// ─── Module IDs (must match NAV_ITEMS paths) ─────────────────────────────────
export type ModuleId =
  | 'dashboard' | 'meetings' | 'whatsapp' | 'training'
  | 'teams' | 'users' | 'reports' | 'integrations'
  | 'automations' | 'ai-config' | 'inbox' | 'admin'
  | 'crm';

export interface ModuleConfig {
  id: ModuleId;
  label: string;
  enabled: boolean; // global default
}

export type AIModelId =
  | 'gpt-4o-mini'
  | 'gpt-4o'
  | 'gpt-4-turbo'
  | 'gpt-4'
  | 'o1-mini'
  | 'o1-preview'
  | 'o3-mini'
  | 'o3'
  | 'gpt-5o-mini'
  | 'gpt-5o'
  | 'gpt-5-turbo'
  | 'gpt-5'
  | 'o4-mini'
  | 'o4-preview'
  | 'o5-mini'
  | 'o5';

export const AI_MODELS: { id: AIModelId; label: string; desc: string; badge: string }[] = [
  // GPT-4 series
  { id: 'gpt-4o-mini',  label: 'GPT-4o Mini',   desc: 'Rápido e econômico — melhor custo-benefício',            badge: '⚡ Padrão'     },
  { id: 'gpt-4o',       label: 'GPT-4o',         desc: 'Multimodal e poderoso — equilíbrio perfeito',            badge: '⚖️ Balanceado' },
  { id: 'gpt-4-turbo',  label: 'GPT-4 Turbo',    desc: 'Alta capacidade com janela de contexto ampla',           badge: '🚀 Turbo'      },
  { id: 'gpt-4',        label: 'GPT-4',           desc: 'Raciocínio avançado e tarefas complexas',               badge: '🧠 Premium'    },
  { id: 'o1-mini',      label: 'o1 Mini',         desc: 'Raciocínio passo a passo — tarefas técnicas',            badge: '🔬 Raciocínio' },
  { id: 'o1-preview',   label: 'o1 Preview',      desc: 'Máximo raciocínio — problemas complexos e científicos',  badge: '🏆 Top'        },
  { id: 'o3-mini',      label: 'o3 Mini',         desc: 'Nova geração de raciocínio — eficiente e rápido',        badge: '🆕 o3'         },
  { id: 'o3',           label: 'o3',              desc: 'Topo absoluto da série 4 — raciocínio de nível humano',  badge: '👑 Elite'      },
  // GPT-5 series
  { id: 'gpt-5o-mini',  label: 'GPT-5o Mini',    desc: 'GPT-5 compacto — rápido e econômico',                    badge: '⚡ GPT-5'      },
  { id: 'gpt-5o',       label: 'GPT-5o',          desc: 'Multimodal de nova geração — desempenho superior',       badge: '⚖️ GPT-5'      },
  { id: 'gpt-5-turbo',  label: 'GPT-5 Turbo',     desc: 'GPT-5 acelerado — contexto amplo e alta velocidade',    badge: '🚀 GPT-5'      },
  { id: 'gpt-5',        label: 'GPT-5',           desc: 'Modelo mais avançado da OpenAI — máxima inteligência',   badge: '🧠 GPT-5'      },
  { id: 'o4-mini',      label: 'o4 Mini',         desc: 'Raciocínio avançado compacto — série 5',                 badge: '🔬 o4'         },
  { id: 'o4-preview',   label: 'o4 Preview',      desc: 'Raciocínio o4 completo — precisão máxima',               badge: '🏆 o4'         },
  { id: 'o5-mini',      label: 'o5 Mini',         desc: 'Topo da nova série — raciocínio eficiente',              badge: '🆕 o5'         },
  { id: 'o5',           label: 'o5',              desc: 'Ápice absoluto da OpenAI — inteligência de ponta',       badge: '👑 o5'         },
];

export type ModuleAIKey = 'meetings' | 'training' | 'whatsapp' | 'reports' | 'automations';

export interface OpenAITokens {
  meetings: string;
  training: string;
  whatsapp: string;
  reports: string;
  automations: string;
}

export type ModuleModels = Record<ModuleAIKey, AIModelId>;

// Per-user or per-team module overrides: key = userId or teamId, value = set of disabled module ids
export type ModuleOverrides = Record<string, Set<ModuleId>>;

interface AppConfigContextType {
  tokens: OpenAITokens;
  models: ModuleModels;
  modules: ModuleConfig[];
  userModuleOverrides: Record<string, ModuleId[]>;
  companySubtitle: string;
  configLoaded: boolean;
  setToken: (module: keyof OpenAITokens, value: string) => void;
  setModuleModel: (module: ModuleAIKey, model: AIModelId) => void;
  setModuleEnabled: (id: ModuleId, enabled: boolean) => void;
  isModuleEnabled: (id: ModuleId) => boolean;
  setUserModuleOverride: (entityId: string, disabledModules: ModuleId[]) => void;
  getUserDisabledModules: (entityId: string) => ModuleId[];
  isModuleEnabledForUser: (moduleId: ModuleId, userId: string, teamId?: string) => boolean;
  setCompanySubtitle: (value: string) => void;
  saveConfig: () => void;
}

const DEFAULT_TOKENS: OpenAITokens = {
  meetings: CONFIG.OPENAI_TOKEN_MEETINGS,
  training: CONFIG.OPENAI_TOKEN_TRAINING,
  whatsapp: CONFIG.OPENAI_TOKEN_WHATSAPP,
  reports: CONFIG.OPENAI_TOKEN_REPORTS,
  automations: CONFIG.OPENAI_TOKEN_AUTOMATIONS,
};

export const DEFAULT_MODULES: ModuleConfig[] = [
  { id: 'dashboard',    label: 'Dashboard',     enabled: true },
  { id: 'meetings',     label: 'Reuniões',       enabled: true },
  { id: 'whatsapp',     label: 'WhatsApp',       enabled: true },
  { id: 'training',     label: 'Treinamentos',   enabled: true },
  { id: 'teams',        label: 'Times',          enabled: true },
  { id: 'users',        label: 'Usuários',       enabled: true },
  { id: 'reports',      label: 'Relatórios',     enabled: true },
  { id: 'integrations', label: 'Integrações',    enabled: true },
  { id: 'automations',  label: 'Automações',     enabled: true },
  { id: 'ai-config',    label: 'Config. IA',     enabled: true },
  { id: 'inbox',        label: 'Caixa de Entrada', enabled: true },
  { id: 'admin',        label: 'Admin',          enabled: true },
  { id: 'crm',          label: 'CRM',            enabled: true },
];

const DEFAULT_MODELS: ModuleModels = {
  meetings:    'gpt-4o-mini',
  training:    'gpt-4o-mini',
  whatsapp:    'gpt-4o-mini',
  reports:     'gpt-4o-mini',
  automations: 'gpt-4o-mini',
};

const AppConfigContext = createContext<AppConfigContextType | null>(null);

export function AppConfigProvider({ children }: { children: React.ReactNode }) {
  const [tokens, setTokens] = useState<OpenAITokens>(DEFAULT_TOKENS);
  const [models, setModels] = useState<ModuleModels>(DEFAULT_MODELS);
  const [modules, setModules] = useState<ModuleConfig[]>(DEFAULT_MODULES);
  const [userModuleOverrides, setUserModuleOverrides] = useState<Record<string, ModuleId[]>>({});
  const [companySubtitle, setCompanySubtitleState] = useState('Revenue OS');
  const [configLoaded, setConfigLoaded] = useState(false);

  useEffect(() => {
    const loadFromDb = async () => {
      try {
        const empresaId = await getSaasEmpresaId();

        const [tokensRes, modulesRes, usersRes, userModsRes, empresaRes] = await Promise.all([
          (supabase as any)
            .schema('saas')
            .from('tokens_ia_modulo')
            .select('modulo_codigo,token_criptografado,modelo')
            .eq('empresa_id', empresaId)
            .eq('provedor', 'openai'),
          (supabase as any)
            .schema('saas')
            .from('configuracoes_modulos_empresa')
            .select('modulo_codigo,habilitado')
            .eq('empresa_id', empresaId),
          (supabase as any)
            .schema('saas')
            .from('usuarios')
            .select('id,email')
            .eq('empresa_id', empresaId)
            .eq('status', 'ativo'),
          (supabase as any)
            .schema('saas')
            .from('configuracoes_modulos_usuario')
            .select('usuario_id,modulo_codigo,habilitado'),
          (supabase as any)
            .schema('saas')
            .from('empresas')
            .select('subtitulo')
            .eq('id', empresaId)
            .maybeSingle(),
        ]);

        if (!tokensRes.error && tokensRes.data) {
          const nextTokens = { ...DEFAULT_TOKENS };
          const nextModels = { ...DEFAULT_MODELS };
          for (const row of tokensRes.data) {
            if (row.modulo_codigo in nextTokens) {
              // Only override if DB has a non-empty token (don't clear .env defaults)
              if (row.token_criptografado) {
                (nextTokens as any)[row.modulo_codigo] = row.token_criptografado;
              }
              if (row.modelo) (nextModels as any)[row.modulo_codigo] = row.modelo;
            }
          }
          setTokens(nextTokens);
          setModels(nextModels);
        }

        if (!modulesRes.error && modulesRes.data) {
          const enabledMap = new Map<string, boolean>();
          for (const row of modulesRes.data) enabledMap.set(row.modulo_codigo, !!row.habilitado);
          setModules(DEFAULT_MODULES.map((m) => ({ ...m, enabled: enabledMap.get(m.id) ?? m.enabled })));
        }

        if (!usersRes.error && !userModsRes.error && usersRes.data && userModsRes.data) {
          const userById = new Map<string, string>();
          for (const u of usersRes.data) userById.set(u.id, `user_${(u.email || '').toLowerCase()}`);
          const next: Record<string, ModuleId[]> = {};
          for (const row of userModsRes.data) {
            const key = userById.get(row.usuario_id);
            if (!key) continue;
            if (!row.habilitado) {
              next[key] = next[key] || [];
              next[key].push(row.modulo_codigo as ModuleId);
            }
          }
          setUserModuleOverrides(next);
        }

        if (!empresaRes.error && empresaRes.data?.subtitulo) {
          setCompanySubtitleState(empresaRes.data.subtitulo);
          document.title = `Appmax ${empresaRes.data.subtitulo}`;
        }
      } catch {
        // keep defaults
      } finally {
        setConfigLoaded(true);
      }
    };
    loadFromDb();
  }, []);

  const setToken = (module: keyof OpenAITokens, value: string) => {
    setTokens(prev => ({ ...prev, [module]: value }));
    void (async () => {
      try {
        const empresaId = await getSaasEmpresaId();
        await (supabase as any)
          .schema('saas')
          .from('tokens_ia_modulo')
          .upsert({
            empresa_id: empresaId,
            modulo_codigo: module,
            provedor: 'openai',
            token_criptografado: value,
            modelo: models[module],
            ativo: true,
          }, { onConflict: 'empresa_id,modulo_codigo,provedor' });
      } catch {}
    })();
  };

  const setModuleModel = (module: ModuleAIKey, model: AIModelId) => {
    setModels(prev => ({ ...prev, [module]: model }));
    void (async () => {
      try {
        const empresaId = await getSaasEmpresaId();
        await (supabase as any)
          .schema('saas')
          .from('tokens_ia_modulo')
          .upsert({
            empresa_id: empresaId,
            modulo_codigo: module,
            provedor: 'openai',
            token_criptografado: tokens[module],
            modelo: model,
            ativo: true,
          }, { onConflict: 'empresa_id,modulo_codigo,provedor' });
      } catch {}
    })();
  };

  const setModuleEnabled = (id: ModuleId, enabled: boolean) => {
    setModules(prev => prev.map(m => m.id === id ? { ...m, enabled } : m));
    void (async () => {
      try {
        const empresaId = await getSaasEmpresaId();
        await (supabase as any)
          .schema('saas')
          .from('configuracoes_modulos_empresa')
          .upsert({ empresa_id: empresaId, modulo_codigo: id, habilitado: enabled }, { onConflict: 'empresa_id,modulo_codigo' });
      } catch {}
    })();
  };

  const isModuleEnabled = (id: ModuleId) =>
    modules.find(m => m.id === id)?.enabled ?? true;

  const setUserModuleOverride = (entityId: string, disabledModules: ModuleId[]) => {
    // Normalize: google_email → user_email (always store as user_)
    const normalizedId = entityId.replace(/^google_/, 'user_');
    setUserModuleOverrides(prev => ({ ...prev, [normalizedId]: disabledModules }));
    // Persist in DB
    if (!normalizedId.startsWith('user_')) return;
    const email = normalizedId.replace(/^user_/, '').toLowerCase();
    void (async () => {
      try {
        const empresaId = await getSaasEmpresaId();
        const { data: u } = await (supabase as any)
          .schema('saas')
          .from('usuarios')
          .select('id')
          .eq('empresa_id', empresaId)
          .eq('email', email)
          .maybeSingle();
        if (!u?.id) return;

        await (supabase as any)
          .schema('saas')
          .from('configuracoes_modulos_usuario')
          .delete()
          .eq('usuario_id', u.id);

        const rows = DEFAULT_MODULES.map((m) => ({
          usuario_id: u.id,
          modulo_codigo: m.id,
          habilitado: !disabledModules.includes(m.id),
        }));
        await (supabase as any)
          .schema('saas')
          .from('configuracoes_modulos_usuario')
          .upsert(rows, { onConflict: 'usuario_id,modulo_codigo' });
      } catch {}
    })();
  };

  const getUserDisabledModules = (entityId: string): ModuleId[] =>
    userModuleOverrides[entityId] ?? [];

  const isModuleEnabledForUser = (moduleId: ModuleId, userId: string, teamId?: string): boolean => {
    // Global toggle takes precedence
    if (!isModuleEnabled(moduleId)) return false;
    // Check user-level override
    if ((userModuleOverrides[userId] ?? []).includes(moduleId)) return false;
    // Check team-level override
    if (teamId && (userModuleOverrides[teamId] ?? []).includes(moduleId)) return false;
    return true;
  };

  const setCompanySubtitle = (value: string) => {
    setCompanySubtitleState(value);
    document.title = `Appmax ${value}`;
    void (async () => {
      try {
        const empresaId = await getSaasEmpresaId();
        await (supabase as any)
          .schema('saas')
          .from('empresas')
          .update({ subtitulo: value })
          .eq('id', empresaId);
      } catch {}
    })();
  };

  const saveConfig = () => {
    // Persistência já acontece nos setters.
  };

  return (
    <AppConfigContext.Provider value={{
      tokens, models, modules, userModuleOverrides, companySubtitle, configLoaded,
      setToken, setModuleModel, setModuleEnabled, isModuleEnabled,
      setUserModuleOverride, getUserDisabledModules, isModuleEnabledForUser,
      setCompanySubtitle, saveConfig,
    }}>
      {children}
    </AppConfigContext.Provider>
  );
}

export function useAppConfig() {
  const ctx = useContext(AppConfigContext);
  if (!ctx) throw new Error('useAppConfig must be used inside AppConfigProvider');
  return ctx;
}
