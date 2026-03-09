import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, UserRole } from '@/types';
import { ROLE_HIERARCHY } from '@/types';
import { useRolePermissions } from '@/contexts/RolePermissionsContext';
import { useAuditLog } from '@/contexts/AuditLogContext';
import { supabase } from '@/integrations/supabase/client';

const ALLOWED_DOMAIN = 'appmax.com.br';

export function isAppmaxEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`);
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (googleUser: { email: string; name: string; picture?: string }) => Promise<void>;
  logout: () => void;
  hasRole: (roles: UserRole[]) => boolean;
  hasMinRole: (minRole: UserRole) => boolean;
  canAccess: (resource: string) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

function buildUser(id: string, email: string, name: string, avatar?: string, role: UserRole = 'member'): User {
  return {
    id,
    name,
    email,
    avatar: avatar ?? `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`,
    role,
    company: 'Appmax',
    status: 'active',
    createdAt: new Date().toISOString().slice(0, 10),
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { canAccess: roleCanAccess } = useRolePermissions();
  const { addEvent } = useAuditLog();

  // Restore session from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('appmax_user');
    if (stored) {
      try { setUser(JSON.parse(stored)); }
      catch { localStorage.removeItem('appmax_user'); }
    }

    // Also check Supabase session (for email/password users)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && !localStorage.getItem('appmax_user')) {
        const meta = session.user.user_metadata ?? {};
        const email = session.user.email ?? '';
        const u = buildUser(
          session.user.id,
          email,
          meta.full_name ?? meta.name ?? email.split('@')[0],
          meta.avatar_url ?? meta.picture,
        );
        setUser(u);
        localStorage.setItem('appmax_user', JSON.stringify(u));
      }
      setIsLoading(false);
    });
  }, []);

  const recordLogin = (u: User) => {
    addEvent({
      type: 'login',
      userId: u.id,
      userName: u.name,
      userRole: u.role,
      userEmail: u.email,
      page: '',
      pageLabel: '',
    });
  };

  // Email + password login via Supabase Auth
  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      if (!isAppmaxEmail(email)) {
        throw new Error('Apenas e-mails @appmax.com.br são permitidos.');
      }
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);

      const meta = data.user?.user_metadata ?? {};
      const u = buildUser(
        data.user!.id,
        email,
        meta.full_name ?? meta.name ?? email.split('@')[0],
        meta.avatar_url ?? meta.picture,
      );
      setUser(u);
      localStorage.setItem('appmax_user', JSON.stringify(u));
      recordLogin(u);
    } finally {
      setIsLoading(false);
    }
  };

  // Google OAuth via @react-oauth/google — receives user info after consent popup
  const loginWithGoogle = async (googleUser: { email: string; name: string; picture?: string }) => {
    if (!isAppmaxEmail(googleUser.email)) {
      throw new Error(`Apenas contas @${ALLOWED_DOMAIN} podem acessar a plataforma.`);
    }

    const u = buildUser(
      `google_${googleUser.email}`,
      googleUser.email,
      googleUser.name,
      googleUser.picture,
    );

    localStorage.setItem(`google_connected_${u.id}`, 'true');
    setUser(u);
    localStorage.setItem('appmax_user', JSON.stringify(u));
    recordLogin(u);
  };

  const logout = async () => {
    if (user) {
      addEvent({
        type: 'logout',
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        userEmail: user.email,
        page: '',
        pageLabel: '',
      });
    }
    setUser(null);
    localStorage.removeItem('appmax_user');
    // Also sign out from Supabase in case they used email/password
    await supabase.auth.signOut();
  };

  const hasRole = (roles: UserRole[]) => !!user && roles.includes(user.role);

  const hasMinRole = (minRole: UserRole): boolean => {
    if (!user) return false;
    const userIdx = ROLE_HIERARCHY.indexOf(user.role);
    const minIdx  = ROLE_HIERARCHY.indexOf(minRole);
    return userIdx <= minIdx;
  };

  const canAccess = (resource: string) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    return roleCanAccess(user.role, resource as any);
  };

  return (
    <AuthContext.Provider value={{
      user, isAuthenticated: !!user, isLoading,
      login, loginWithGoogle, logout,
      hasRole, hasMinRole, canAccess,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
