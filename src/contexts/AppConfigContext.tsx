import React, { createContext, useContext, useState, useEffect } from 'react';

// ─── Module IDs (must match NAV_ITEMS paths) ─────────────────────────────────
export type ModuleId =
  | 'dashboard' | 'meetings' | 'whatsapp' | 'training'
  | 'teams' | 'users' | 'reports' | 'integrations'
  | 'automations' | 'ai-config' | 'admin';

export interface ModuleConfig {
  id: ModuleId;
  label: string;
  enabled: boolean;
}

export interface OpenAITokens {
  meetings: string;     // Analysis of recorded meetings
  training: string;     // Voice training simulation
  whatsapp: string;     // WhatsApp conversation analysis
  reports: string;      // Report generation / insights
  automations: string;  // Automation triggers
}

interface AppConfigContextType {
  tokens: OpenAITokens;
  modules: ModuleConfig[];
  setToken: (module: keyof OpenAITokens, value: string) => void;
  setModuleEnabled: (id: ModuleId, enabled: boolean) => void;
  isModuleEnabled: (id: ModuleId) => boolean;
  saveConfig: () => void;
}

const DEFAULT_TOKENS: OpenAITokens = {
  meetings: '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',
  training: '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',
  whatsapp: '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',
  reports: '',
  automations: '',
};

const DEFAULT_MODULES: ModuleConfig[] = [
  { id: 'dashboard',   label: 'Dashboard',     enabled: true },
  { id: 'meetings',    label: 'Reuniões',       enabled: true },
  { id: 'whatsapp',    label: 'WhatsApp',       enabled: true },
  { id: 'training',    label: 'Treinamentos',   enabled: true },
  { id: 'teams',       label: 'Times',          enabled: true },
  { id: 'users',       label: 'Usuários',       enabled: true },
  { id: 'reports',     label: 'Relatórios',     enabled: true },
  { id: 'integrations',label: 'Integrações',    enabled: true },
  { id: 'automations', label: 'Automações',     enabled: true },
  { id: 'ai-config',   label: 'Config. IA',     enabled: true },
  { id: 'admin',       label: 'Admin',          enabled: true },
];

const STORAGE_KEY_TOKENS  = 'appmax_openai_tokens';
const STORAGE_KEY_MODULES = 'appmax_modules_config';

const AppConfigContext = createContext<AppConfigContextType | null>(null);

export function AppConfigProvider({ children }: { children: React.ReactNode }) {
  const [tokens, setTokens] = useState<OpenAITokens>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_TOKENS);
      return stored ? { ...DEFAULT_TOKENS, ...JSON.parse(stored) } : DEFAULT_TOKENS;
    } catch { return DEFAULT_TOKENS; }
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

  const setToken = (module: keyof OpenAITokens, value: string) => {
    setTokens(prev => ({ ...prev, [module]: value }));
  };

  const setModuleEnabled = (id: ModuleId, enabled: boolean) => {
    setModules(prev => prev.map(m => m.id === id ? { ...m, enabled } : m));
  };

  const isModuleEnabled = (id: ModuleId) =>
    modules.find(m => m.id === id)?.enabled ?? true;

  const saveConfig = () => {
    localStorage.setItem(STORAGE_KEY_TOKENS, JSON.stringify(tokens));
    const moduleMap = Object.fromEntries(modules.map(m => [m.id, m.enabled]));
    localStorage.setItem(STORAGE_KEY_MODULES, JSON.stringify(moduleMap));
  };

  // Persist on every change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_TOKENS, JSON.stringify(tokens));
  }, [tokens]);

  useEffect(() => {
    const moduleMap = Object.fromEntries(modules.map(m => [m.id, m.enabled]));
    localStorage.setItem(STORAGE_KEY_MODULES, JSON.stringify(moduleMap));
  }, [modules]);

  return (
    <AppConfigContext.Provider value={{
      tokens, modules, setToken, setModuleEnabled, isModuleEnabled, saveConfig,
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
