import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

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

const INITIAL_NOTIFICATIONS: Notification[] = [
  {
    id: '1',
    type: 'meeting',
    title: 'Nova transcrição disponível',
    description: 'A reunião com cliente Appmax foi transcrita e está pronta para análise.',
    createdAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    read: false,
    link: '/meetings',
  },
  {
    id: '2',
    type: 'whatsapp',
    title: '3 conversas sem resposta',
    description: 'Você tem conversas pendentes há mais de 2 horas no WhatsApp.',
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    read: false,
    link: '/whatsapp',
  },
  {
    id: '3',
    type: 'performance',
    title: 'Meta semanal atingida',
    description: 'Você atingiu 100% da meta de reuniões esta semana. Parabéns!',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    read: false,
    link: '/performance',
  },
  {
    id: '4',
    type: 'system',
    title: 'Google Calendar sincronizado',
    description: 'Todas as reuniões foram importadas com sucesso do Google Calendar.',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
    read: true,
  },
  {
    id: '5',
    type: 'meeting',
    title: 'Scorecard gerado automaticamente',
    description: 'A IA analisou a reunião de demo e gerou um scorecard com nota 8.4.',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    read: true,
    link: '/meetings',
  },
];

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>(INITIAL_NOTIFICATIONS);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

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
