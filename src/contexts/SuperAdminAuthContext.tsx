import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  authenticateSuperAdmin,
  logAdminAction,
  type SuperAdmin,
} from '@/lib/superAdminService';
import { hashPasswordForLogin } from '@/lib/accessControl';

const SESSION_KEY = 'ltx_super_admin_session';

interface SuperAdminAuthContextType {
  superAdmin: SuperAdmin | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const SuperAdminAuthContext = createContext<SuperAdminAuthContextType>({
  superAdmin: null,
  isAuthenticated: false,
  isLoading: true,
  login: async () => {},
  logout: () => {},
});

export function useSuperAdminAuth() {
  return useContext(SuperAdminAuthContext);
}

export function SuperAdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [superAdmin, setSuperAdmin] = useState<SuperAdmin | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SESSION_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as SuperAdmin;
        if (parsed && parsed.id && parsed.email) {
          setSuperAdmin(parsed);
        } else {
          localStorage.removeItem(SESSION_KEY);
        }
      }
    } catch {
      localStorage.removeItem(SESSION_KEY);
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const hash = await hashPasswordForLogin(password);
    const result = await authenticateSuperAdmin(email, hash);
    if (!result) {
      throw new Error('Credenciais inválidas');
    }
    setSuperAdmin(result);
    localStorage.setItem(SESSION_KEY, JSON.stringify(result));
    await logAdminAction(result.id, 'login').catch(() => {});
  }, []);

  const logout = useCallback(() => {
    if (superAdmin) {
      logAdminAction(superAdmin.id, 'logout').catch(() => {});
    }
    setSuperAdmin(null);
    localStorage.removeItem(SESSION_KEY);
  }, [superAdmin]);

  return (
    <SuperAdminAuthContext.Provider
      value={{
        superAdmin,
        isAuthenticated: !!superAdmin,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </SuperAdminAuthContext.Provider>
  );
}
