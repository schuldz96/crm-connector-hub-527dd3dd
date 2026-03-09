/**
 * Role Permissions System
 * Central source of truth for role definitions, hierarchy and resource access.
 * Persisted in localStorage so admins can customize via the Admin panel.
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { UserRole, ResourceId, RolePermission } from '@/types';

export const STORAGE_KEY = 'appmax_role_permissions';

export const ALL_RESOURCES: { id: ResourceId; label: string; icon: string }[] = [
  { id: 'dashboard',    label: 'Dashboard',        icon: '📊' },
  { id: 'meetings',     label: 'Reuniões',          icon: '🎥' },
  { id: 'whatsapp',     label: 'WhatsApp',          icon: '💬' },
  { id: 'performance',  label: 'Desempenho',        icon: '📈' },
  { id: 'training',     label: 'Treinamentos',      icon: '🎓' },
  { id: 'teams',        label: 'Times',             icon: '👥' },
  { id: 'areas',        label: 'Áreas',             icon: '🏢' },
  { id: 'users',        label: 'Usuários',          icon: '👤' },
  { id: 'reports',      label: 'Relatórios',        icon: '📑' },
  { id: 'integrations', label: 'Integrações',       icon: '🔌' },
  { id: 'automations',  label: 'Automações',        icon: '⚡' },
  { id: 'ai-config',    label: 'Config. IA',        icon: '🤖' },
  { id: 'admin',        label: 'Painel Admin',      icon: '🔐' },
];

export const SCOPE_LABELS: Record<RolePermission['scope'], string> = {
  all:         'Tudo (empresa inteira)',
  area:        'Área (sua área)',
  team:        'Time (seu time)',
  self:        'Somente ele mesmo',
};

export const DEFAULT_ROLE_PERMISSIONS: RolePermission[] = [
  {
    role: 'admin',
    label: 'Administrador',
    color: 'destructive',
    canDelete: false,
    scope: 'all',
    resources: ['dashboard','meetings','whatsapp','performance','training','teams','areas','users','reports','integrations','automations','ai-config','admin'],
  },
  {
    role: 'ceo',
    label: 'CEO',
    color: 'destructive',
    canDelete: true,
    scope: 'all',
    resources: ['dashboard','meetings','whatsapp','performance','training','teams','areas','users','reports','integrations','automations','ai-config'],
  },
  {
    role: 'director',
    label: 'Diretor',
    color: 'primary',
    canDelete: true,
    scope: 'all',
    resources: ['dashboard','meetings','whatsapp','performance','training','teams','areas','users','reports'],
  },
  {
    role: 'manager',
    label: 'Gerente',
    color: 'accent',
    canDelete: true,
    scope: 'area',
    resources: ['dashboard','meetings','whatsapp','performance','training','teams','areas','users','reports'],
  },
  {
    role: 'coordinator',
    label: 'Coordenador',
    color: 'warning',
    canDelete: true,
    scope: 'area',
    resources: ['dashboard','meetings','whatsapp','performance','training','teams','reports'],
  },
  {
    role: 'supervisor',
    label: 'Supervisor',
    color: 'success',
    canDelete: true,
    scope: 'team',
    resources: ['dashboard','meetings','whatsapp','performance','training','teams','reports'],
  },
  {
    role: 'member',
    label: 'Vendedor',
    color: 'muted-foreground',
    canDelete: true,
    scope: 'self',
    resources: ['dashboard','meetings','whatsapp','performance','training'],
  },
];

// ─── Context ──────────────────────────────────────────────────────────────────
import React from 'react';

interface RolePermissionsContextType {
  permissions: RolePermission[];
  getPermission: (role: UserRole) => RolePermission | undefined;
  updatePermission: (role: UserRole, patch: Partial<RolePermission>) => void;
  canAccess: (role: UserRole, resource: ResourceId) => boolean;
  isHigherOrEqual: (roleA: UserRole, roleB: UserRole) => boolean;
}

const RolePermissionsContext = createContext<RolePermissionsContextType | null>(null);

function load(): RolePermission[] {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (!s) return DEFAULT_ROLE_PERMISSIONS;
    const saved: RolePermission[] = JSON.parse(s);
    // Merge: saved overrides defaults but keep any new defaults not in saved
    const merged = DEFAULT_ROLE_PERMISSIONS.map(def => {
      const found = saved.find(s => s.role === def.role);
      return found ? { ...def, ...found } : def;
    });
    return merged;
  } catch {
    return DEFAULT_ROLE_PERMISSIONS;
  }
}

import { ROLE_HIERARCHY } from '@/types';

export function RolePermissionsProvider({ children }: { children: React.ReactNode }) {
  const [permissions, setPermissions] = useState<RolePermission[]>(load);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(permissions));
  }, [permissions]);

  const getPermission = useCallback((role: UserRole) =>
    permissions.find(p => p.role === role), [permissions]);

  const updatePermission = useCallback((role: UserRole, patch: Partial<RolePermission>) => {
    setPermissions(prev => prev.map(p => p.role === role ? { ...p, ...patch } : p));
  }, []);

  const canAccess = useCallback((role: UserRole, resource: ResourceId): boolean => {
    const perm = permissions.find(p => p.role === role);
    if (!perm) return false;
    return perm.resources.includes(resource);
  }, [permissions]);

  // Returns true if roleA is >= roleB in authority (lower index = higher authority)
  const isHigherOrEqual = useCallback((roleA: UserRole, roleB: UserRole): boolean => {
    return ROLE_HIERARCHY.indexOf(roleA) <= ROLE_HIERARCHY.indexOf(roleB);
  }, []);

  return (
    <RolePermissionsContext.Provider value={{ permissions, getPermission, updatePermission, canAccess, isHigherOrEqual }}>
      {children}
    </RolePermissionsContext.Provider>
  );
}

export function useRolePermissions() {
  const ctx = useContext(RolePermissionsContext);
  if (!ctx) throw new Error('useRolePermissions must be used inside RolePermissionsProvider');
  return ctx;
}
