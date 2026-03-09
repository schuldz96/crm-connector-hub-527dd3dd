import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, UserRole } from '@/types';
import { ROLE_HIERARCHY } from '@/types';
import { useRolePermissions } from '@/contexts/RolePermissionsContext';
import { useAuditLog } from '@/contexts/AuditLogContext';

const ALLOWED_DOMAIN = 'appmax.com.br';

export function isAppmaxEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`);
}

// ─── Hardcoded allowed users ──────────────────────────────────────────────────
const ALLOWED_USERS: Array<{ email: string; password: string; name: string; role: UserRole }> = [
  { email: 'marcos.schuldz@appmax.com.br', password: 'Appmax102030@', name: 'Marcos Schuldz', role: 'admin' },
  { email: 'yuri.santos@appmax.com.br',    password: 'Appmax102030@', name: 'Yuri Santos',    role: 'admin' },
];

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

function buildUser(
  id: string,
  email: string,
  name: string,
  role: UserRole = 'member',
  avatar?: string,
): User {
  return {
    id,
    name,
    email,
    avatar: avatar ?? `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(email)}`,
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

  useEffect(() => {
    const stored = localStorage.getItem('appmax_user');
    if (stored) {
      try { setUser(JSON.parse(stored)); }
      catch { localStorage.removeItem('appmax_user'); }
    }
    setIsLoading(false);
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

  // Email + password — validates against hardcoded allowed users list
  const login = async (email: string, password: string) => {
    setIsLoading(true);
    await new Promise(r => setTimeout(r, 500));
    try {
      const normalized = email.trim().toLowerCase();

      if (!isAppmaxEmail(normalized)) {
        throw new Error('Apenas e-mails @appmax.com.br são permitidos.');
      }

      const match = ALLOWED_USERS.find(
        u => u.email.toLowerCase() === normalized && u.password === password
      );

      if (!match) {
        throw new Error('Credenciais inválidas. Verifique seu e-mail e senha.');
      }

      const u = buildUser(`user_${normalized}`, match.email, match.name, match.role);
      setUser(u);
      localStorage.setItem('appmax_user', JSON.stringify(u));
      recordLogin(u);
    } finally {
      setIsLoading(false);
    }
  };

  // Google OAuth callback — receives user info after consent redirect
  const loginWithGoogle = async (googleUser: { email: string; name: string; picture?: string }) => {
    const normalized = googleUser.email.trim().toLowerCase();

    if (!isAppmaxEmail(normalized)) {
      throw new Error(`Apenas contas @${ALLOWED_DOMAIN} podem acessar a plataforma.`);
    }

    // Find the matching allowed user to get the correct role
    const match = ALLOWED_USERS.find(u => u.email.toLowerCase() === normalized);
    if (!match) {
      throw new Error('Conta Google não autorizada. Contate o administrador.');
    }

    const u = buildUser(
      `google_${normalized}`,
      match.email,
      googleUser.name || match.name,
      match.role,
      googleUser.picture,
    );

    setUser(u);
    localStorage.setItem('appmax_user', JSON.stringify(u));
    recordLogin(u);
  };

  const logout = () => {
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
