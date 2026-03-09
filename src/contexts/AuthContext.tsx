import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, UserRole } from '@/types';
import { ROLE_HIERARCHY } from '@/types';
import { useRolePermissions } from '@/contexts/RolePermissionsContext';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => void;
  /** True if user's role is one of the listed roles */
  hasRole: (roles: UserRole[]) => boolean;
  /** True if user's role is >= minRole in the hierarchy (i.e. has equal or higher authority) */
  hasMinRole: (minRole: UserRole) => boolean;
  canAccess: (resource: string) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Mock admin user for demo
const MOCK_USER: User = {
  id: 'usr_001',
  name: 'Marcos Schuldz',
  email: 'marcos.schuldz@appmax.com.br',
  avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Marcos',
  role: 'admin',
  company: 'Appmax',
  status: 'active',
  createdAt: '2026-01-01',
};

const DEMO_CREDENTIALS = {
  email: 'marcos.schuldz@appmax.com.br',
  password: 'Appmax102030@',
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { canAccess: roleCanAccess } = useRolePermissions();

  useEffect(() => {
    const stored = localStorage.getItem('appmax_user');
    if (stored) {
      try { setUser(JSON.parse(stored)); }
      catch { localStorage.removeItem('appmax_user'); }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    await new Promise(r => setTimeout(r, 600));
    const isValid =
      (email === DEMO_CREDENTIALS.email && password === DEMO_CREDENTIALS.password) ||
      (email.length > 0 && password.length > 0);
    if (!isValid) { setIsLoading(false); throw new Error('Credenciais inválidas'); }
    const u = email === DEMO_CREDENTIALS.email ? { ...MOCK_USER } : { ...MOCK_USER, email };
    setUser(u);
    localStorage.setItem('appmax_user', JSON.stringify(u));
    setIsLoading(false);
  };

  const loginWithGoogle = async () => {
    setIsLoading(true);
    await new Promise(r => setTimeout(r, 600));
    setUser(MOCK_USER);
    localStorage.setItem('appmax_user', JSON.stringify(MOCK_USER));
    setIsLoading(false);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('appmax_user');
  };

  const hasRole = (roles: UserRole[]) => !!user && roles.includes(user.role);

  // Returns true if the logged-in user has authority >= minRole
  const hasMinRole = (minRole: UserRole): boolean => {
    if (!user) return false;
    const userIdx = ROLE_HIERARCHY.indexOf(user.role);
    const minIdx  = ROLE_HIERARCHY.indexOf(minRole);
    return userIdx <= minIdx; // lower index = higher authority
  };

  const canAccess = (resource: string) => {
    if (!user) return false;
    // admin always gets everything
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
