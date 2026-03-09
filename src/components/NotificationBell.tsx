import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, X, CheckCheck, Filter, Video, MessageSquare, Zap, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotifications, type NotificationType } from '@/contexts/NotificationsContext';

const TYPE_CONFIG: Record<NotificationType, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  meeting:     { icon: Video,          color: 'text-primary',     bg: 'bg-primary/10',     label: 'Reunião' },
  whatsapp:    { icon: MessageSquare,  color: 'text-success',     bg: 'bg-success/10',     label: 'WhatsApp' },
  performance: { icon: Zap,            color: 'text-warning',     bg: 'bg-warning/10',     label: 'Desempenho' },
  system:      { icon: AlertCircle,    color: 'text-accent',      bg: 'bg-accent/10',      label: 'Sistema' },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `${m}min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  return `${Math.floor(h / 24)}d atrás`;
}

type FilterMode = 'all' | 'unread';

export default function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, removeNotification } = useNotifications();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<FilterMode>('all');
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const visible = filter === 'unread'
    ? notifications.filter(n => !n.read)
    : notifications;

  const handleClick = (id: string, link?: string) => {
    markAsRead(id);
    if (link) {
      navigate(link);
      setOpen(false);
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'relative w-8 h-8 rounded-lg border flex items-center justify-center transition-colors',
          open
            ? 'bg-primary/10 border-primary/30 text-primary'
            : 'bg-secondary border-border text-muted-foreground hover:bg-muted'
        )}
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center px-1">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-[360px] rounded-2xl border border-border bg-popover shadow-2xl z-50 overflow-hidden animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Bell className="w-3.5 h-3.5 text-primary" />
              <span className="text-sm font-semibold">Notificações</span>
              {unreadCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
                  {unreadCount} não lidas
                </span>
              )}
            </div>
            <button
              onClick={() => setOpen(false)}
              className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Filters */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-muted/20">
            <div className="flex items-center gap-1">
              {([['all', 'Todas'], ['unread', 'Não lidas']] as [FilterMode, string][]).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setFilter(val)}
                  className={cn(
                    'text-[11px] px-2.5 py-1 rounded-lg font-medium transition-colors',
                    filter === val
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="flex items-center gap-1 text-[11px] text-primary hover:underline"
              >
                <CheckCheck className="w-3 h-3" /> Marcar todas como lidas
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[380px] overflow-y-auto">
            {visible.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-3">
                  <Bell className="w-5 h-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">Tudo em dia!</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {filter === 'unread' ? 'Nenhuma notificação não lida.' : 'Nenhuma notificação.'}
                </p>
              </div>
            ) : (
              visible.map(n => {
                const cfg = TYPE_CONFIG[n.type];
                const Icon = cfg.icon;
                return (
                  <div
                    key={n.id}
                    onClick={() => handleClick(n.id, n.link)}
                    className={cn(
                      'group flex items-start gap-3 px-4 py-3 border-b border-border/40 transition-colors cursor-pointer last:border-0',
                      !n.read ? 'bg-primary/[0.03] hover:bg-primary/[0.06]' : 'hover:bg-muted/30'
                    )}
                  >
                    {/* Icon */}
                    <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5', cfg.bg)}>
                      <Icon className={cn('w-3.5 h-3.5', cfg.color)} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn('text-xs font-semibold leading-snug', !n.read && 'text-foreground')}>
                          {n.title}
                        </p>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">{timeAgo(n.createdAt)}</span>
                          <button
                            onClick={e => { e.stopPropagation(); removeNotification(n.id); }}
                            className="opacity-0 group-hover:opacity-100 w-4 h-4 rounded flex items-center justify-center text-muted-foreground hover:text-destructive transition-all"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5 line-clamp-2">
                        {n.description}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', cfg.bg, cfg.color)}>
                          {cfg.label}
                        </span>
                        {!n.read && (
                          <button
                            onClick={e => { e.stopPropagation(); markAsRead(n.id); }}
                            className="text-[10px] text-primary hover:underline"
                          >
                            Marcar como lida
                          </button>
                        )}
                        {n.link && (
                          <span className="text-[10px] text-muted-foreground/60">→ Ver detalhes</span>
                        )}
                      </div>
                    </div>

                    {/* Unread dot */}
                    {!n.read && (
                      <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
