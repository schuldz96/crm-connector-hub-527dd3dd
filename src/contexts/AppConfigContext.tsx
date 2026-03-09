import React, { createContext, useContext, useState, useEffect } from 'react';

// ─── Module IDs (must match NAV_ITEMS paths) ─────────────────────────────────
export type ModuleId =
  | 'dashboard' | 'meetings' | 'whatsapp' | 'training'
  | 'teams' | 'users' | 'reports' | 'integrations'
  | 'automations' | 'ai-config' | 'admin';

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
  | 'o3';

export const AI_MODELS: { id: AIModelId; label: string; desc: string; badge: string }[] = [
  { id: 'gpt-4o-mini',  label: 'GPT-4o Mini',  desc: 'Rápido e econômico — melhor custo-benefício',            badge: '⚡ Padrão'     },
  { id: 'gpt-4o',       label: 'GPT-4o',        desc: 'Multimodal e poderoso — equilíbrio perfeito',            badge: '⚖️ Balanceado' },
  { id: 'gpt-4-turbo',  label: 'GPT-4 Turbo',   desc: 'Alta capacidade com janela de contexto ampla',           badge: '🚀 Turbo'      },
  { id: 'gpt-4',        label: 'GPT-4',          desc: 'Raciocínio avançado e tarefas complexas',               badge: '🧠 Premium'    },
  { id: 'o1-mini',      label: 'o1 Mini',        desc: 'Raciocínio passo a passo — tarefas técnicas',            badge: '🔬 Raciocínio' },
  { id: 'o1-preview',   label: 'o1 Preview',     desc: 'Máximo raciocínio — problemas complexos e científicos',  badge: '🏆 Top'        },
  { id: 'o3-mini',      label: 'o3 Mini',        desc: 'Nova geração de raciocínio — eficiente e rápido',        badge: '🆕 o3'         },
  { id: 'o3',           label: 'o3',             desc: 'Topo absoluto da OpenAI — raciocínio de nível humano',   badge: '👑 Elite'      },
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
  setToken: (module: keyof OpenAITokens, value: string) => void;
  setModuleModel: (module: ModuleAIKey, model: AIModelId) => void;
  setModuleEnabled: (id: ModuleId, enabled: boolean) => void;
  isModuleEnabled: (id: ModuleId) => boolean;
  setUserModuleOverride: (entityId: string, disabledModules: ModuleId[]) => void;
  getUserDisabledModules: (entityId: string) => ModuleId[];
  isModuleEnabledForUser: (moduleId: ModuleId, userId: string, teamId?: string) => boolean;
  saveConfig: () => void;
}

const DEFAULT_TOKENS: OpenAITokens = {
  meetings: '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',
  training: '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',
  whatsapp: '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',
  reports: '',
  automations: '',
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
  { id: 'admin',        label: 'Admin',          enabled: true },
];

const STORAGE_KEY_TOKENS    = 'appmax_openai_tokens';
const STORAGE_KEY_MODELS    = 'appmax_ai_models';
const STORAGE_KEY_MODULES   = 'appmax_modules_config';
const STORAGE_KEY_OVERRIDES = 'appmax_user_module_overrides';

const DEFAULT_MODELS: ModuleModels = {
  meetings:    'gpt-4o-mini',
  training:    'gpt-4o-mini',
  whatsapp:    'gpt-4o-mini',
  reports:     'gpt-4o-mini',
  automations: 'gpt-4o-mini',
};

const AppConfigContext = createContext<AppConfigContextType | null>(null);

export function AppConfigProvider({ children }: { children: React.ReactNode }) {
  const [tokens, setTokens] = useState<OpenAITokens>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_TOKENS);
      return stored ? { ...DEFAULT_TOKENS, ...JSON.parse(stored) } : DEFAULT_TOKENS;
    } catch { return DEFAULT_TOKENS; }
  });

  const [models, setModels] = useState<ModuleModels>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_MODELS);
      return stored ? { ...DEFAULT_MODELS, ...JSON.parse(stored) } : DEFAULT_MODELS;
    } catch { return DEFAULT_MODELS; }
  });

  const [modules, setModules] = useState<ModuleConfig[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_MODULES);
      if (stored) {
        const saved: Partial<Record<ModuleId, boolean>> = JSON.parse(stored);
        return DEFAULT_MODULES.map(m => ({ ...m, enabled: saved[m.id] ?? m.enabled }));
      }
    } catch {}
    return DEFAULT_MODULES;
  });

  // Per-user/team overrides: Record<entityId, ModuleId[]> (disabled list)
  const [userModuleOverrides, setUserModuleOverrides] = useState<Record<string, ModuleId[]>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_OVERRIDES);
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  });

  const setToken = (module: keyof OpenAITokens, value: string) => {
    setTokens(prev => ({ ...prev, [module]: value }));
  };

  const setModuleModel = (module: ModuleAIKey, model: AIModelId) => {
    setModels(prev => ({ ...prev, [module]: model }));
  };

  const setModuleEnabled = (id: ModuleId, enabled: boolean) => {
    setModules(prev => prev.map(m => m.id === id ? { ...m, enabled } : m));
  };

  const isModuleEnabled = (id: ModuleId) =>
    modules.find(m => m.id === id)?.enabled ?? true;

  const setUserModuleOverride = (entityId: string, disabledModules: ModuleId[]) => {
    setUserModuleOverrides(prev => ({ ...prev, [entityId]: disabledModules }));
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

  const saveConfig = () => {
    localStorage.setItem(STORAGE_KEY_TOKENS, JSON.stringify(tokens));
    const moduleMap = Object.fromEntries(modules.map(m => [m.id, m.enabled]));
    localStorage.setItem(STORAGE_KEY_MODULES, JSON.stringify(moduleMap));
    localStorage.setItem(STORAGE_KEY_OVERRIDES, JSON.stringify(userModuleOverrides));
  };

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_TOKENS, JSON.stringify(tokens));
  }, [tokens]);

  useEffect(() => {
    const moduleMap = Object.fromEntries(modules.map(m => [m.id, m.enabled]));
    localStorage.setItem(STORAGE_KEY_MODULES, JSON.stringify(moduleMap));
  }, [modules]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_OVERRIDES, JSON.stringify(userModuleOverrides));
  }, [userModuleOverrides]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_MODELS, JSON.stringify(models));
  }, [models]);

  return (
    <AppConfigContext.Provider value={{
      tokens, models, modules, userModuleOverrides,
      setToken, setModuleModel, setModuleEnabled, isModuleEnabled,
      setUserModuleOverride, getUserDisabledModules, isModuleEnabledForUser,
      saveConfig,
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
