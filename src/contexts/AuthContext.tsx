import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, UserRole } from '@/types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => void;
  hasRole: (roles: UserRole[]) => boolean;
  canAccess: (resource: string) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Mock user for demo
const MOCK_USER: User = {
  id: 'usr_admin_001',
  name: 'Marcos Schuldz',
  email: 'marcos.schuldz@appmax.com.br',
  avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Marcos',
  role: 'admin',
  company: 'Appmax',
  status: 'active',
  createdAt: '2026-01-01',
};

// Valid demo credentials
const DEMO_CREDENTIALS = {
  email: 'marcos.schuldz@appmax.com.br',
  password: 'Appmax102030@',
};

const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  admin: ['*'],
  director: ['dashboard', 'meetings', 'whatsapp', 'teams', 'users', 'reports', 'integrations'],
  supervisor: ['dashboard', 'meetings', 'whatsapp', 'teams', 'reports'],
  member: ['dashboard', 'meetings', 'whatsapp'],
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for stored session
    const stored = localStorage.getItem('appmax_user');
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem('appmax_user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    await new Promise(r => setTimeout(r, 600));
    // Check exact credentials OR allow any email (demo mode)
    const isValidCredentials =
      (email === DEMO_CREDENTIALS.email && password === DEMO_CREDENTIALS.password) ||
      (email.length > 0 && password.length > 0);
    if (!isValidCredentials) {
      setIsLoading(false);
      throw new Error('Credenciais inválidas');
    }
    const mockUser = email === DEMO_CREDENTIALS.email
      ? { ...MOCK_USER }
      : { ...MOCK_USER, email };
    setUser(mockUser);
    localStorage.setItem('appmax_user', JSON.stringify(mockUser));
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

  const hasRole = (roles: UserRole[]) => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  const canAccess = (resource: string) => {
    if (!user) return false;
    const perms = ROLE_PERMISSIONS[user.role];
    return perms.includes('*') || perms.includes(resource);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      loginWithGoogle,
      logout,
      hasRole,
      canAccess,
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
