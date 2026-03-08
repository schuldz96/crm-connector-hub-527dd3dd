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
  name: 'Carlos Mendes',
  email: 'admin@dealintel.com.br',
  avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Carlos',
  role: 'admin',
  company: 'Deal Intel',
  status: 'active',
  createdAt: '2024-01-01',
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
    const stored = localStorage.getItem('dealintel_user');
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem('dealintel_user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, _password: string) => {
    setIsLoading(true);
    // Simulate API call
    await new Promise(r => setTimeout(r, 800));
    const mockUser = { ...MOCK_USER, email };
    setUser(mockUser);
    localStorage.setItem('dealintel_user', JSON.stringify(mockUser));
    setIsLoading(false);
  };

  const loginWithGoogle = async () => {
    setIsLoading(true);
    await new Promise(r => setTimeout(r, 600));
    setUser(MOCK_USER);
    localStorage.setItem('dealintel_user', JSON.stringify(MOCK_USER));
    setIsLoading(false);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('dealintel_user');
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
