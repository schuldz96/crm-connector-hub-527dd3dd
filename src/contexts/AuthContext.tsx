import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, UserRole } from '@/types';
import { ROLE_HIERARCHY } from '@/types';
import { useRolePermissions } from '@/contexts/RolePermissionsContext';
import { useAuditLog } from '@/contexts/AuditLogContext';
import {
  createOrRefreshAccessRequest,
  getAllowedUserByEmail,
  updateAllowedUserProfile,
  hashPasswordForLogin,
  recordLastLogin,
} from '@/lib/accessControl';
import { CONFIG } from '@/lib/config';

const ALLOWED_DOMAIN = CONFIG.GOOGLE_ALLOWED_DOMAIN;
const SESSION_KEY = 'appmax_session';

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
  updateProfile: (changes: { name?: string; avatar?: string }) => Promise<void>;
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
  areaId?: string,
  teamId?: string,
): User {
  return {
    id,
    name,
    email,
    avatar: avatar ?? `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(email)}`,
    role,
    teamId,
    areaId,
    company: 'Appmax',
    status: 'active',
    createdAt: new Date().toISOString().slice(0, 10),
  };
}

function saveSession(user: User) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

function loadSession(): User | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as User;
  } catch {
    clearSession();
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { canAccess: roleCanAccess } = useRolePermissions();
  const { addEvent } = useAuditLog();

  // Restore session on mount
  useEffect(() => {
    const restored = loadSession();
    if (restored) {
      setUser(restored);
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

  // Email + password — validates against allowed users list
  const login = async (email: string, password: string) => {
    setIsLoading(true);
    await new Promise(r => setTimeout(r, 500));
    try {
      const normalized = email.trim().toLowerCase();

      if (!isAppmaxEmail(normalized)) {
        throw new Error('Apenas e-mails @appmax.com.br são permitidos.');
      }

      const allowedMatch = await getAllowedUserByEmail(normalized);
      if (!allowedMatch) {
        throw new Error('Usuário não autorizado.');
      }

      const hashedInput = await hashPasswordForLogin(password);
      if (!allowedMatch.password || (allowedMatch.password !== hashedInput && allowedMatch.password !== password)) {
        throw new Error('Credenciais inválidas. Verifique seu e-mail e senha.');
      }

      const u = buildUser(
        `user_${normalized}`,
        allowedMatch.email,
        allowedMatch.name,
        allowedMatch.role,
        allowedMatch.avatar,
        allowedMatch.areaId,
        allowedMatch.teamId,
      );
      setUser(u);
      saveSession(u);
      recordLogin(u);
      recordLastLogin(normalized).catch(() => {});
    } finally {
      setIsLoading(false);
    }
  };

  // Google OAuth callback — receives user info after consent
  const loginWithGoogle = async (googleUser: { email: string; name: string; picture?: string }) => {
    const normalized = googleUser.email.trim().toLowerCase();

    if (!isAppmaxEmail(normalized)) {
      throw new Error(`Apenas contas @${ALLOWED_DOMAIN} podem acessar a plataforma.`);
    }

    const match = await getAllowedUserByEmail(normalized);
    if (!match) {
      await createOrRefreshAccessRequest({
        email: normalized,
        name: googleUser.name,
        picture: googleUser.picture,
      });
      throw new Error('Acesso pendente de aprovação. Um administrador precisa aprovar sua conta.');
    }

    const u = buildUser(
      `google_${normalized}`,
      match.email,
      googleUser.name || match.name,
      match.role,
      googleUser.picture,
      match.areaId,
      match.teamId,
    );

    setUser(u);
    saveSession(u);
    recordLogin(u);
    recordLastLogin(normalized).catch(() => {});
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
    clearSession();
    setUser(null);
  };

  const updateProfile = async (changes: { name?: string; avatar?: string }) => {
    if (!user) return;
    await updateAllowedUserProfile({
      email: user.email,
      name: changes.name,
      avatar: changes.avatar,
    });
    setUser(prev => {
      if (!prev) return prev;
      const updated = {
        ...prev,
        ...(typeof changes.name === 'string' ? { name: changes.name.trim() || prev.name } : {}),
        ...(typeof changes.avatar === 'string' ? { avatar: changes.avatar } : {}),
      };
      saveSession(updated);
      return updated;
    });
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
      updateProfile,
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
