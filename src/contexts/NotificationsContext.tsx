import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import {
  loadNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from '@/lib/notificationsService';
import { useAuth } from '@/contexts/AuthContext';

export type NotificationType = 'meeting' | 'whatsapp' | 'system' | 'performance';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  createdAt: string;
  read: boolean;
  link?: string;
}

interface NotificationsContextValue {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  addNotification: (n: Omit<Notification, 'id' | 'read' | 'createdAt'>) => void;
  removeNotification: (id: string) => void;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Load from DB when user changes
  useEffect(() => {
    if (!user?.email) {
      setNotifications([]);
      return;
    }
    loadNotifications(user.email)
      .then(setNotifications)
      .catch(() => setNotifications([]));
  }, [user?.email]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    markNotificationRead(id).catch(() => {});
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    if (user?.email) {
      markAllNotificationsRead(user.email).catch(() => {});
    }
  }, [user?.email]);

  const addNotification = useCallback((n: Omit<Notification, 'id' | 'read' | 'createdAt'>) => {
    setNotifications(prev => [{
      ...n,
      id: String(Date.now()),
      read: false,
      createdAt: new Date().toISOString(),
    }, ...prev]);
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    deleteNotification(id).catch(() => {});
  }, []);

  return (
    <NotificationsContext.Provider value={{ notifications, unreadCount, markAsRead, markAllAsRead, addNotification, removeNotification }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
}
