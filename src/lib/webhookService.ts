// ─── Webhook Service ──────────────────────────────────────────────────────────
// Centralised webhook dispatcher used across the whole app.
// All pending dispatches are stored in localStorage so they survive refreshes.

export type WebhookEventId =
  | 'whatsapp.message.received'
  | 'whatsapp.ai.critical_alert'
  | 'whatsapp.instance.disconnected'
  | 'user.registered'
  | 'training.started'
  | 'training.completed'
  | 'meeting.completed'
  | 'meeting.no_show'
  | 'conversation.analyzed'
  | 'user.performance.updated';

export type DelayUnit = 'immediate' | 'seconds' | 'minutes' | 'hours' | 'days';

export interface WebhookConfig {
  id: WebhookEventId;
  label: string;
  description: string;
  category: 'whatsapp' | 'users' | 'training' | 'meetings' | 'analytics';
  icon: string;
  enabled: boolean;
  url: string;
  delayUnit: DelayUnit;
  delayValue: number; // ignored when unit = 'immediate'
  lastFired?: string;
  lastStatus?: 'success' | 'error' | 'pending';
  totalFired: number;
}

export type WebhookPayload = {
  event: WebhookEventId;
  timestamp: string;
  data: Record<string, unknown>;
};

const STORAGE_KEY = 'appmax_webhook_configs';

export const DEFAULT_WEBHOOK_CONFIGS: WebhookConfig[] = [
  {
    id: 'whatsapp.message.received',
    label: 'Nova Mensagem WhatsApp',
    description: 'Disparado quando uma nova mensagem chega em qualquer instância conectada.',
    category: 'whatsapp',
    icon: 'MessageSquare',
    enabled: false,
    url: '',
    delayUnit: 'immediate',
    delayValue: 0,
    totalFired: 0,
  },
  {
    id: 'whatsapp.ai.critical_alert',
    label: 'Alerta Crítico da IA',
    description: 'Disparado quando a IA detecta um ponto crítico definido no prompt (ex: perda iminente, cliente insatisfeito).',
    category: 'whatsapp',
    icon: 'AlertTriangle',
    enabled: false,
    url: '',
    delayUnit: 'immediate',
    delayValue: 0,
    totalFired: 0,
  },
  {
    id: 'whatsapp.instance.disconnected',
    label: 'Instância Desconectada',
    description: 'Disparado quando uma instância do WhatsApp perde a conexão. Também gera alerta interno para o supervisor.',
    category: 'whatsapp',
    icon: 'WifiOff',
    enabled: false,
    url: '',
    delayUnit: 'immediate',
    delayValue: 0,
    totalFired: 0,
  },
  {
    id: 'user.registered',
    label: 'Usuário Registrado',
    description: 'Disparado quando um novo usuário é criado na plataforma.',
    category: 'users',
    icon: 'UserPlus',
    enabled: false,
    url: '',
    delayUnit: 'immediate',
    delayValue: 0,
    totalFired: 0,
  },
  {
    id: 'training.started',
    label: 'Treinamento Iniciado',
    description: 'Disparado quando um usuário inicia um módulo de treinamento.',
    category: 'training',
    icon: 'BookOpen',
    enabled: false,
    url: '',
    delayUnit: 'immediate',
    delayValue: 0,
    totalFired: 0,
  },
  {
    id: 'training.completed',
    label: 'Treinamento Concluído',
    description: 'Disparado quando um usuário conclui um módulo de treinamento com score registrado.',
    category: 'training',
    icon: 'GraduationCap',
    enabled: false,
    url: '',
    delayUnit: 'immediate',
    delayValue: 0,
    totalFired: 0,
  },
  {
    id: 'meeting.completed',
    label: 'Reunião Concluída',
    description: 'Disparado quando uma reunião é marcada como concluída.',
    category: 'meetings',
    icon: 'CheckCircle2',
    enabled: false,
    url: '',
    delayUnit: 'immediate',
    delayValue: 0,
    totalFired: 0,
  },
  {
    id: 'meeting.no_show',
    label: 'Reunião No-Show',
    description: 'Disparado quando um lead não aparece para a reunião agendada.',
    category: 'meetings',
    icon: 'UserX',
    enabled: false,
    url: '',
    delayUnit: 'immediate',
    delayValue: 0,
    totalFired: 0,
  },
  {
    id: 'conversation.analyzed',
    label: 'Conversa Analisada pela IA',
    description: 'Disparado após a IA concluir a análise de uma conversa WhatsApp.',
    category: 'analytics',
    icon: 'Brain',
    enabled: false,
    url: '',
    delayUnit: 'immediate',
    delayValue: 0,
    totalFired: 0,
  },
  {
    id: 'user.performance.updated',
    label: 'Performance do Vendedor Atualizada',
    description: 'Disparado quando o score ou ranking de um vendedor é recalculado.',
    category: 'analytics',
    icon: 'TrendingUp',
    enabled: false,
    url: '',
    delayUnit: 'immediate',
    delayValue: 0,
    totalFired: 0,
  },
];

// ─── Persistence ──────────────────────────────────────────────────────────────

export function loadWebhookConfigs(): WebhookConfig[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_WEBHOOK_CONFIGS;
    const parsed: Partial<WebhookConfig>[] = JSON.parse(stored);
    // Merge: keep defaults for any new events added in code
    return DEFAULT_WEBHOOK_CONFIGS.map(def => {
      const saved = parsed.find(p => p.id === def.id);
      return saved ? { ...def, ...saved } : def;
    });
  } catch {
    return DEFAULT_WEBHOOK_CONFIGS;
  }
}

export function saveWebhookConfigs(configs: WebhookConfig[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
}

// ─── Delay helper ─────────────────────────────────────────────────────────────

function delayToMs(unit: DelayUnit, value: number): number {
  switch (unit) {
    case 'seconds': return value * 1000;
    case 'minutes': return value * 60 * 1000;
    case 'hours':   return value * 60 * 60 * 1000;
    case 'days':    return value * 24 * 60 * 60 * 1000;
    default:        return 0;
  }
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

/**
 * Fire a webhook for a given event. Loads fresh config from localStorage each time.
 * Respects configured delay. Returns immediately (fire-and-forget).
 */
export function dispatchWebhook(
  eventId: WebhookEventId,
  data: Record<string, unknown> = {},
): void {
  const configs = loadWebhookConfigs();
  const cfg = configs.find(c => c.id === eventId);
  if (!cfg || !cfg.enabled || !cfg.url.trim()) return;

  const payload: WebhookPayload = {
    event: eventId,
    timestamp: new Date().toISOString(),
    data,
  };

  const delayMs = delayToMs(cfg.delayUnit, cfg.delayValue);

  const fire = async () => {
    try {
      await fetch(cfg.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        mode: 'no-cors', // allow cross-origin webhook URLs
      });
      // Update stats
      const fresh = loadWebhookConfigs();
      const updated = fresh.map(c =>
        c.id === eventId
          ? { ...c, lastFired: new Date().toISOString(), lastStatus: 'success' as const, totalFired: c.totalFired + 1 }
          : c
      );
      saveWebhookConfigs(updated);
    } catch {
      const fresh = loadWebhookConfigs();
      const updated = fresh.map(c =>
        c.id === eventId
          ? { ...c, lastFired: new Date().toISOString(), lastStatus: 'error' as const, totalFired: c.totalFired + 1 }
          : c
      );
      saveWebhookConfigs(updated);
    }
  };

  if (delayMs > 0) {
    setTimeout(fire, delayMs);
  } else {
    fire();
  }
}

/**
 * Test-fire a webhook immediately regardless of delay, using a sample payload.
 */
export async function testWebhook(cfg: WebhookConfig): Promise<'success' | 'error'> {
  const payload: WebhookPayload = {
    event: cfg.id,
    timestamp: new Date().toISOString(),
    data: { test: true, message: 'Webhook de teste da plataforma AppMax' },
  };
  try {
    await fetch(cfg.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      mode: 'no-cors',
    });
    return 'success';
  } catch {
    return 'error';
  }
}
