/**
 * Role Permissions System
 * Central source of truth for role definitions, hierarchy and resource access.
 * Persisted in localStorage so admins can customize via the Admin panel.
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { UserRole, ResourceId, RolePermission } from '@/types';
import { supabase, supabaseSaas } from '@/integrations/supabase/client';
import { roleFromDb, roleToDb, scopeFromDb, scopeToDb } from '@/lib/saas';

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
  { id: 'inbox',        label: 'Caixa de Entrada',  icon: '📥' },
  { id: 'admin',        label: 'Painel Admin',      icon: '🔐' },
  { id: 'crm',          label: 'CRM',               icon: '🏷️' },
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
    resources: ['dashboard','meetings','whatsapp','inbox','performance','training','teams','areas','users','reports','integrations','automations','ai-config','admin','crm'],
  },
  {
    role: 'ceo',
    label: 'CEO',
    color: 'destructive',
    canDelete: true,
    scope: 'all',
    resources: ['dashboard','meetings','whatsapp','inbox','performance','training','teams','areas','users','reports','integrations','automations','ai-config'],
  },
  {
    role: 'director',
    label: 'Diretor',
    color: 'primary',
    canDelete: true,
    scope: 'all',
    resources: ['dashboard','meetings','whatsapp','inbox','performance','training','teams','areas','users','reports'],
  },
  {
    role: 'manager',
    label: 'Gerente',
    color: 'accent',
    canDelete: true,
    scope: 'area',
    resources: ['dashboard','meetings','whatsapp','inbox','performance','training','teams','areas','users','reports'],
  },
  {
    role: 'coordinator',
    label: 'Coordenador',
    color: 'warning',
    canDelete: true,
    scope: 'area',
    resources: ['dashboard','meetings','whatsapp','inbox','performance','training','teams','reports'],
  },
  {
    role: 'supervisor',
    label: 'Supervisor',
    color: 'success',
    canDelete: true,
    scope: 'team',
    resources: ['dashboard','meetings','whatsapp','inbox','performance','training','teams','reports'],
  },
  {
    role: 'member',
    label: 'Analista',
    color: 'muted-foreground',
    canDelete: true,
    scope: 'self',
    resources: ['dashboard','meetings','whatsapp','inbox','performance','training'],
  },
  {
    role: 'support',
    label: 'Suporte',
    color: 'muted-foreground',
    canDelete: true,
    scope: 'self',
    resources: ['inbox'],
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
  return DEFAULT_ROLE_PERMISSIONS;
}

import { ROLE_HIERARCHY } from '@/types';

export function RolePermissionsProvider({ children }: { children: React.ReactNode }) {
  const [permissions, setPermissions] = useState<RolePermission[]>(load);

  useEffect(() => {
    const run = async () => {
      try {
        const { data, error } = await (supabaseSaas as any)
          .schema('saas')
          .from('permissoes_papeis')
          .select('papel,recurso,escopo,permitido');
        if (error) throw error;
        if (!data) return;

        const byRole = new Map<UserRole, { resources: ResourceId[]; scope: RolePermission['scope'] }>();
        for (const row of data) {
          if (!row.permitido) continue;
          const role = roleFromDb(row.papel);
          const current = byRole.get(role) || { resources: [], scope: scopeFromDb(row.escopo) };
          if (!current.resources.includes(row.recurso as ResourceId)) {
            current.resources.push(row.recurso as ResourceId);
          }
          current.scope = scopeFromDb(row.escopo);
          byRole.set(role, current);
        }

        setPermissions(prev =>
          prev.map(def => {
            const db = byRole.get(def.role);
            return db ? { ...def, resources: db.resources, scope: db.scope } : def;
          }),
        );
      } catch {
        // Keep defaults in case of DB failures
      }
    };
    run();
  }, []);

  const getPermission = useCallback((role: UserRole) =>
    permissions.find(p => p.role === role), [permissions]);

  const updatePermission = useCallback((role: UserRole, patch: Partial<RolePermission>) => {
    setPermissions(prev => {
      const next = prev.map(p => p.role === role ? { ...p, ...patch } : p);
      const updated = next.find(p => p.role === role);
      if (updated) {
        void (async () => {
          try {
            const rows = ALL_RESOURCES.map((r) => ({
              papel: roleToDb(role),
              recurso: r.id,
              escopo: scopeToDb(updated.scope),
              permitido: updated.resources.includes(r.id),
            }));
            const { error } = await (supabaseSaas as any)
              .schema('saas')
              .from('permissoes_papeis')
              .upsert(rows, { onConflict: 'papel,recurso' });
            if (error) throw error;
          } catch {
            // Keep UI responsive; DB retry can be done by user action
          }
        })();
      }
      return next;
    });
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
