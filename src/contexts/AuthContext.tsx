import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, UserRole } from '@/types';
import { ROLE_HIERARCHY } from '@/types';
import { useRolePermissions } from '@/contexts/RolePermissionsContext';
import { useAuditLog } from '@/contexts/AuditLogContext';
import md5 from 'md5';

// ─── Domain restriction ───────────────────────────────────────────────────────
const ALLOWED_DOMAIN = 'appmax.com.br';

export function isAppmaxEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`);
}

// ─── Password hashing ─────────────────────────────────────────────────────────
export function hashPassword(password: string): string {
  return md5(password);
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => void;
  hasRole: (roles: UserRole[]) => boolean;
  hasMinRole: (minRole: UserRole) => boolean;
  canAccess: (resource: string) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

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

// Stored credentials: { email, passwordHash (md5) }
const DEMO_CREDENTIALS = {
  email: 'marcos.schuldz@appmax.com.br',
  passwordHash: hashPassword('Appmax102030@'),
};

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

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    await new Promise(r => setTimeout(r, 600));

    // 1. Domain restriction
    if (!isAppmaxEmail(email)) {
      setIsLoading(false);
      throw new Error('Apenas e-mails @appmax.com.br são permitidos.');
    }

    // 2. Validate credentials (compare MD5 hashes)
    const inputHash = hashPassword(password);
    const isValid = email === DEMO_CREDENTIALS.email && inputHash === DEMO_CREDENTIALS.passwordHash;

    if (!isValid) {
      setIsLoading(false);
      throw new Error('Credenciais inválidas');
    }

    const u = { ...MOCK_USER, email };
    setUser(u);
    localStorage.setItem('appmax_user', JSON.stringify(u));
    recordLogin(u);
    setIsLoading(false);
  };

  const loginWithGoogle = async () => {
    // Google domain restriction is enforced client-side via the hd (hosted domain) hint
    // and validated server-side. Here we simulate the check.
    setIsLoading(true);
    await new Promise(r => setTimeout(r, 600));

    // In a real OAuth flow the email comes from Google's ID token.
    // We simulate a Google login with the demo user (already @appmax.com.br).
    const googleEmail = MOCK_USER.email;

    if (!isAppmaxEmail(googleEmail)) {
      setIsLoading(false);
      throw new Error(`Apenas contas @${ALLOWED_DOMAIN} podem acessar a plataforma.`);
    }

    const u = { ...MOCK_USER };
    // Mark this session as Google-authenticated
    localStorage.setItem(`google_connected_${u.id}`, 'true');
    setUser(u);
    localStorage.setItem('appmax_user', JSON.stringify(u));
    recordLogin(u);
    setIsLoading(false);
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
