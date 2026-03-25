# Integração Evolution API — Código Completo

Este documento contém **todo o código** relacionado à integração com a Evolution API (WhatsApp) no projeto Smart Deal Coach.
Objetivo: permitir que outro agente entenda completamente como a integração foi feita.

---

## Sumário

1. [Configuração (config.ts)](#1-configuração)
2. [Types (types/index.ts)](#2-types)
3. [Hook de Instâncias (useEvolutionInstances.ts)](#3-hook-de-instâncias)
4. [Serviço de Integrações (integrationsService.ts)](#4-serviço-de-integrações)
5. [Serviço de Webhooks (webhookService.ts)](#5-serviço-de-webhooks)
6. [Página WhatsApp (WhatsAppPage.tsx)](#6-página-whatsapp)
7. [Página Integrações (IntegrationsPage.tsx)](#7-página-integrações)
8. [Cron de Avaliação (evaluate-cron/index.ts)](#8-cron-de-avaliação)
9. [Schema do Banco (migration SQL)](#9-schema-do-banco)
10. [Endpoints da Evolution API usados](#10-endpoints-da-evolution-api)

---

## 1. Configuração

**Arquivo:** `src/lib/config.ts`

```typescript
// Configurações centralizadas do projeto.
// Valores lidos de import.meta.env com fallback hardcoded para garantir
// funcionamento em ambientes que não injetam .env (ex: Lovable).

export const CONFIG = {
  // Supabase
  SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || 'https://lwusznsduxcqjjmbbobt.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_c0yDYJ79ltCXMGznHYyOQQ_Y2zjyhtY',

  // Google SSO
  GOOGLE_CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID || '19779916042-ur7fs5qdorm32bsen7vtfcurkoka4sp7.apps.googleusercontent.com',
  GOOGLE_ALLOWED_DOMAIN: (import.meta.env.VITE_GOOGLE_ALLOWED_DOMAIN || 'appmax.com.br').trim().toLowerCase(),
  GOOGLE_REDIRECT_URI: import.meta.env.VITE_GOOGLE_REDIRECT_URI || 'https://smart-deal-coach.lovable.app/auth/google/callback',

  // Evolution API (WhatsApp)
  EVOLUTION_API_URL: import.meta.env.VITE_EVOLUTION_API_URL || 'https://evolutionapic.contato-lojavirtual.com',
  EVOLUTION_API_TOKEN: import.meta.env.VITE_EVOLUTION_API_TOKEN || '3ce7a42f9bd96ea526b2b0bc39a4faec',

  // OpenAI Tokens
  OPENAI_TOKEN_MEETINGS: import.meta.env.VITE_OPENAI_TOKEN_MEETINGS || '',
  OPENAI_TOKEN_TRAINING: import.meta.env.VITE_OPENAI_TOKEN_TRAINING || '',
  OPENAI_TOKEN_WHATSAPP: import.meta.env.VITE_OPENAI_TOKEN_WHATSAPP || '',
  OPENAI_TOKEN_REPORTS: import.meta.env.VITE_OPENAI_TOKEN_REPORTS || '',
  OPENAI_TOKEN_AUTOMATIONS: import.meta.env.VITE_OPENAI_TOKEN_AUTOMATIONS || '',
} as const;
```

**Variáveis de ambiente relevantes:**
- `VITE_EVOLUTION_API_URL` — URL base da Evolution API
- `VITE_EVOLUTION_API_TOKEN` — Token de autenticação (header `apikey`)

---

## 2. Types

**Arquivo:** `src/types/index.ts` (trechos relevantes)

```typescript
export interface WhatsAppInstance {
  id: string;
  name: string;
  phone?: string;
  status: 'connected' | 'disconnected' | 'connecting';
  userId: string;
  teamId?: string;
  qrCode?: string;
  lastSeen?: string;
  createdAt: string;
}

export interface WhatsAppMessage {
  id: string;
  instanceId: string;
  conversationId: string;
  from: string;
  to: string;
  body: string;
  type: 'text' | 'image' | 'audio' | 'document';
  direction: 'inbound' | 'outbound';
  timestamp: string;
}

export interface Conversation {
  id: string;
  instanceId: string;
  contactName: string;
  contactPhone: string;
  contactAvatar?: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  assignedTo?: string;
  tags: string[];
  score?: number;
  aiAnalyzed: boolean;
}

export interface Integration {
  id: string;
  type: 'google_calendar' | 'google_meet' | 'hubspot' | 'openai' | 'evolution_api' | 'n8n';
  name: string;
  status: 'connected' | 'disconnected' | 'error';
  configuredAt?: string;
  config?: Record<string, string>;
}
```

---

## 3. Hook de Instâncias

**Arquivo:** `src/hooks/useEvolutionInstances.ts`

```typescript
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getSaasEmpresaId } from '@/lib/saas';
import { CONFIG } from '@/lib/config';

const EVOLUTION_API_URL = CONFIG.EVOLUTION_API_URL;
const EVOLUTION_API_TOKEN = CONFIG.EVOLUTION_API_TOKEN;

export interface EvolutionInstance {
  id: string;
  name: string;
  connectionStatus: string; // "open" | "close" | "connecting"
  ownerJid?: string;
  profileName?: string;
  profilePicUrl?: string;
  assignedUserEmail?: string; // email of assigned user (from DB)
  _count?: { Message: number; Contact: number; Chat: number };
}

const STATUS_TO_DB: Record<string, string> = {
  open: 'conectada',
  close: 'desconectada',
  connecting: 'conectando',
};

const STATUS_FROM_DB: Record<string, string> = {
  conectada: 'open',
  desconectada: 'close',
  conectando: 'connecting',
};

/** Extract email from frontend user ID like "user_foo@bar.com" or "google_foo@bar.com" */
function emailFromFrontendId(userId: string): string {
  return userId.replace(/^(user_|google_)/, '').trim().toLowerCase();
}

/** Resolve email → UUID in saas.usuarios */
async function resolveEmailToUuid(email: string): Promise<string | null> {
  const empresaId = await getSaasEmpresaId();
  const { data } = await (supabase as any)
    .schema('saas')
    .from('usuarios')
    .select('id')
    .eq('empresa_id', empresaId)
    .eq('email', email.trim().toLowerCase())
    .maybeSingle();
  return data?.id ?? null;
}

async function syncInstancesToDb(apiInstances: EvolutionInstance[]) {
  try {
    const empresaId = await getSaasEmpresaId();
    for (const inst of apiInstances) {
      const dbStatus = STATUS_TO_DB[inst.connectionStatus] || 'desconectada';
      await supabase
        .schema('saas')
        .from('instancias_whatsapp')
        .upsert(
          {
            empresa_id: empresaId,
            nome: inst.name,
            telefone: inst.ownerJid?.replace('@s.whatsapp.net', '') || null,
            status: dbStatus,
            owner_jid: inst.ownerJid || null,
            ultimo_evento_em: new Date().toISOString(),
          },
          { onConflict: 'empresa_id,nome' },
        );
    }
  } catch (e) {
    console.warn('[sync] Falha ao sincronizar instâncias no banco:', e);
  }
}

async function loadInstancesFromDb(): Promise<EvolutionInstance[]> {
  const empresaId = await getSaasEmpresaId();
  const { data, error } = await supabase
    .schema('saas')
    .from('instancias_whatsapp')
    .select('id,nome,telefone,status,owner_jid,usuario_id')
    .eq('empresa_id', empresaId)
    .order('nome', { ascending: true });

  if (error) throw error;

  // Resolve usuario_id UUIDs to emails
  const uuids = [...new Set((data || []).map((r: any) => r.usuario_id).filter(Boolean))];
  let uuidToEmail: Record<string, string> = {};
  if (uuids.length > 0) {
    const { data: users } = await (supabase as any)
      .schema('saas')
      .from('usuarios')
      .select('id, email')
      .eq('empresa_id', empresaId)
      .in('id', uuids);
    for (const u of (users || [])) {
      uuidToEmail[u.id] = u.email;
    }
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    name: row.nome,
    connectionStatus: STATUS_FROM_DB[row.status] || 'close',
    ownerJid: row.owner_jid || undefined,
    profileName: row.nome,
    assignedUserEmail: row.usuario_id ? (uuidToEmail[row.usuario_id] || undefined) : undefined,
  }));
}

export function useEvolutionInstances() {
  const [instances, setInstances] = useState<EvolutionInstance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Load user assignments from DB (we'll merge these into API results)
    let dbInstances: EvolutionInstance[] = [];
    try {
      dbInstances = await loadInstancesFromDb();
      if (dbInstances.length > 0) {
        setInstances(dbInstances);
      }
    } catch (dbErr) {
      console.warn('[instances] Falha ao carregar do banco (ignorando):', dbErr);
    }

    try {
      // Fetch live data from Evolution API
      if (EVOLUTION_API_URL && EVOLUTION_API_TOKEN) {
        const res = await window.fetch(`${EVOLUTION_API_URL}/instance/fetchInstances`, {
          headers: { apikey: EVOLUTION_API_TOKEN, 'Content-Type': 'application/json' },
        });
        if (res.ok) {
          const apiData = await res.json();
          const apiInstances: EvolutionInstance[] = Array.isArray(apiData) ? apiData : [];
          // Merge DB user assignments into API instances
          const dbMap = new Map(dbInstances.map(d => [d.name, d.assignedUserEmail]));
          const merged = apiInstances.map(inst => ({
            ...inst,
            assignedUserEmail: dbMap.get(inst.name) || undefined,
          }));
          setInstances(merged);
          // Sync live data back to database in background
          syncInstancesToDb(apiInstances).catch(() => {});
        } else {
          throw new Error(`Evolution API HTTP ${res.status}`);
        }
      } else {
        throw new Error('Evolution API não configurada (VITE_EVOLUTION_API_URL ou VITE_EVOLUTION_API_TOKEN vazios).');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return { instances, loading, error, refetch: fetchAll };
}

// ── DB-backed instance ↔ user assignment ──────────────────────────────────────

/**
 * Assign or unassign an instance to a user (writes to DB).
 * Pass empty userId to unassign.
 */
export async function assignInstanceToUser(instanceName: string, userId: string): Promise<void> {
  const empresaId = await getSaasEmpresaId();
  const email = userId ? emailFromFrontendId(userId) : '';
  const usuarioId = email ? await resolveEmailToUuid(email) : null;

  // Ensure the instance row exists in DB (it may only exist in the API so far)
  await (supabase as any)
    .schema('saas')
    .from('instancias_whatsapp')
    .upsert(
      {
        empresa_id: empresaId,
        nome: instanceName,
        status: 'desconectada',
        usuario_id: usuarioId,
      },
      { onConflict: 'empresa_id,nome' },
    );

  // Also update explicitly in case upsert on conflict didn't touch usuario_id
  await (supabase as any)
    .schema('saas')
    .from('instancias_whatsapp')
    .update({ usuario_id: usuarioId })
    .eq('empresa_id', empresaId)
    .eq('nome', instanceName);
}

/**
 * Get instance name assigned to a user (from the loaded instances array).
 * This is a synchronous helper that works from already-loaded data.
 */
export function getInstanceForUserFromList(instances: EvolutionInstance[], userId: string): string {
  if (!userId) return '';
  const email = emailFromFrontendId(userId);
  const inst = instances.find(i => i.assignedUserEmail?.toLowerCase() === email);
  return inst?.name || '';
}

// ── Legacy localStorage helpers (kept for migration, will read DB data first) ─

export const getInstanceForUser = (userId: string) =>
  localStorage.getItem(`wa_instance_${userId}`) || '';

export const setInstanceForUser = (userId: string, instanceName: string) => {
  if (instanceName) localStorage.setItem(`wa_instance_${userId}`, instanceName);
  else localStorage.removeItem(`wa_instance_${userId}`);
};
```

---

## 4. Serviço de Integrações

**Arquivo:** `src/lib/integrationsService.ts`

```typescript
import { supabase } from '@/integrations/supabase/client';
import { getSaasEmpresaId } from '@/lib/saas';

// Resolve email → UUID
async function resolveUserUuid(email: string): Promise<string | null> {
  const empresaId = await getSaasEmpresaId();
  const { data } = await (supabase as any)
    .schema('saas')
    .from('usuarios')
    .select('id')
    .eq('empresa_id', empresaId)
    .eq('email', email.trim().toLowerCase())
    .maybeSingle();
  return data?.id ?? null;
}

export type IntegrationType = 'google_calendar' | 'google_meet' | 'evolution_api';

export interface UserIntegration {
  tipo: IntegrationType;
  nome: string;
  status: 'conectada' | 'desconectada' | 'erro';
  conectado_em?: string;
}

// Save or update an integration for a user
export async function upsertUserIntegration(
  userEmail: string,
  tipo: IntegrationType,
  nome: string,
  status: 'conectada' | 'desconectada',
): Promise<void> {
  const empresaId = await getSaasEmpresaId();
  const usuarioId = await resolveUserUuid(userEmail);
  if (!usuarioId) return;

  const { data: existing } = await (supabase as any)
    .schema('saas')
    .from('integracoes')
    .select('id')
    .eq('empresa_id', empresaId)
    .eq('usuario_id', usuarioId)
    .eq('tipo', tipo)
    .maybeSingle();

  if (existing) {
    await (supabase as any)
      .schema('saas')
      .from('integracoes')
      .update({
        status,
        nome,
        conectado_em: status === 'conectada' ? new Date().toISOString() : null,
      })
      .eq('id', existing.id);
  } else {
    await (supabase as any)
      .schema('saas')
      .from('integracoes')
      .insert({
        empresa_id: empresaId,
        usuario_id: usuarioId,
        tipo,
        nome,
        status,
        conectado_em: status === 'conectada' ? new Date().toISOString() : null,
      });
  }
}

// Delete integration records for a user (used on disconnect)
export async function deleteUserIntegrations(
  userEmail: string,
  tipos: IntegrationType[],
): Promise<void> {
  const empresaId = await getSaasEmpresaId();
  const usuarioId = await resolveUserUuid(userEmail);
  if (!usuarioId) return;

  for (const tipo of tipos) {
    await (supabase as any)
      .schema('saas')
      .from('integracoes')
      .delete()
      .eq('empresa_id', empresaId)
      .eq('usuario_id', usuarioId)
      .eq('tipo', tipo);
  }
}

// Load all integrations for all users in the company
export async function loadAllUserIntegrations(): Promise<
  { email: string; tipo: string; status: string; nome: string; conectado_em?: string }[]
> {
  const empresaId = await getSaasEmpresaId();

  const { data, error } = await (supabase as any)
    .schema('saas')
    .from('integracoes')
    .select('tipo, nome, status, conectado_em, usuario_id')
    .eq('empresa_id', empresaId)
    .eq('status', 'conectada');

  if (error || !data) return [];

  // Resolve UUIDs to emails
  const uuids = [...new Set(data.map((d: any) => d.usuario_id).filter(Boolean))];
  if (uuids.length === 0) return [];

  const { data: users } = await (supabase as any)
    .schema('saas')
    .from('usuarios')
    .select('id, email')
    .eq('empresa_id', empresaId)
    .in('id', uuids);

  const uuidToEmail: Record<string, string> = {};
  for (const u of (users || [])) {
    uuidToEmail[u.id] = u.email;
  }

  return data.map((d: any) => ({
    email: uuidToEmail[d.usuario_id] || '',
    tipo: d.tipo,
    status: d.status,
    nome: d.nome,
    conectado_em: d.conectado_em,
  })).filter((d: any) => d.email);
}
```

---

## 5. Serviço de Webhooks

**Arquivo:** `src/lib/webhookService.ts`

```typescript
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
  delayValue: number;
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
    enabled: false, url: '', delayUnit: 'immediate', delayValue: 0, totalFired: 0,
  },
  {
    id: 'whatsapp.ai.critical_alert',
    label: 'Alerta Crítico da IA',
    description: 'Disparado quando a IA detecta um ponto crítico definido no prompt.',
    category: 'whatsapp',
    icon: 'AlertTriangle',
    enabled: false, url: '', delayUnit: 'immediate', delayValue: 0, totalFired: 0,
  },
  {
    id: 'whatsapp.instance.disconnected',
    label: 'Instância Desconectada',
    description: 'Disparado quando uma instância do WhatsApp perde a conexão.',
    category: 'whatsapp',
    icon: 'WifiOff',
    enabled: false, url: '', delayUnit: 'immediate', delayValue: 0, totalFired: 0,
  },
  // ... demais webhooks (user.registered, training.*, meeting.*, conversation.analyzed, user.performance.updated)
];

// ─── Persistence ──────────────────────────────────────────────────────────────

export function loadWebhookConfigs(): WebhookConfig[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_WEBHOOK_CONFIGS;
    const parsed: Partial<WebhookConfig>[] = JSON.parse(stored);
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

// ─── Dispatcher ───────────────────────────────────────────────────────────────

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

  const fire = async () => {
    try {
      await fetch(cfg.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        mode: 'no-cors',
      });
      // Update stats...
    } catch { /* ... */ }
  };

  const delayMs = /* calculated from cfg.delayUnit and cfg.delayValue */0;
  if (delayMs > 0) setTimeout(fire, delayMs);
  else fire();
}
```

---

## 6. Página WhatsApp

**Arquivo:** `src/pages/WhatsAppPage.tsx` (1885 linhas)

### 6.1 — Helper `evoFetch` (chamadas à Evolution API com timeout)

```typescript
const EVOLUTION_API_URL = CONFIG.EVOLUTION_API_URL;
const EVOLUTION_API_TOKEN = CONFIG.EVOLUTION_API_TOKEN;

async function evoFetch(path: string, options: RequestInit = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${EVOLUTION_API_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        apikey: EVOLUTION_API_TOKEN,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      console.error('[evoFetch] HTTP', res.status, path, errBody.slice(0, 500));
      throw new Error(`HTTP ${res.status}: ${errBody.slice(0, 200)}`);
    }
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}
```

### 6.2 — Types internos da página

```typescript
interface Chat {
  id: string;
  remoteJid: string;
  remoteJidAlt?: string; // phone JID when remoteJid is @lid
  name: string;
  phone: string;
  lastMessage: string;
  lastMessageTs: number;
  lastMessageFromMe: boolean;
  unread: number;
  aiScore?: number;
}

type MsgType = 'text' | 'image' | 'video' | 'audio' | 'ptt' | 'document' | 'sticker' | 'location' | 'contact' | 'unknown';

interface Message {
  id: string;
  fromMe: boolean;
  body: string;
  timestamp: number;
  type: MsgType;
  mediaUrl?: string;
  mimetype?: string;
  fileName?: string;
  thumbnailB64?: string;
  latitude?: number;
  longitude?: number;
  rawMsgKey?: { id: string; remoteJid: string; fromMe: boolean };
  rawMessage?: any;
}
```

### 6.3 — QR Code Modal (conectar instância)

```typescript
function QRCodeModal({ instanceName, onClose }: { instanceName: string; onClose: () => void }) {
  const generate = useCallback(async () => {
    setLoading(true);
    setQrBase64(null);
    try {
      const data = await evoFetch(`/instance/connect/${instanceName}`);
      const b64 = data?.base64 || data?.qrcode?.base64 || null;
      if (b64) setQrBase64(b64);
      else toast({ title: 'Instância já conectada' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao gerar QR Code', description: e.message });
    } finally { setLoading(false); }
  }, [instanceName]);

  // ... render QR code image
}
```

### 6.4 — Criar Instância

```typescript
function CreateInstanceModal({ onClose, onCreated }) {
  const handleCreate = async () => {
    await evoFetch('/instance/create', {
      method: 'POST',
      body: JSON.stringify({ instanceName: name.trim(), integration: 'WHATSAPP-BAILEYS' }),
    });
    toast({ title: 'Instância criada!' });
    onCreated();
  };
}
```

### 6.5 — Parsing de mensagens (detectar tipo, extrair body, mídia)

```typescript
const parseBodyText = (m: any): string => {
  const msg = m.message || {};
  return (
    msg.conversation ||
    msg.extendedTextMessage?.text ||
    msg.imageMessage?.caption ||
    msg.videoMessage?.caption ||
    msg.documentMessage?.title || msg.documentMessage?.fileName ||
    (msg.audioMessage ? '🎵 Áudio' : '') ||
    (msg.stickerMessage ? '🪄 Sticker' : '') ||
    (msg.locationMessage ? '📍 Localização' : '') ||
    (msg.contactMessage || msg.contactsArrayMessage ? '👤 Contato' : '') ||
    '[mídia]'
  );
};

const detectMsgType = (m: any): MsgType => {
  const msg = m.message || {};
  if (msg.imageMessage) return 'image';
  if (msg.videoMessage) return 'video';
  if (msg.audioMessage) return msg.audioMessage.ptt ? 'ptt' : 'audio';
  if (msg.documentMessage || msg.documentWithCaptionMessage) return 'document';
  if (msg.stickerMessage) return 'sticker';
  if (msg.locationMessage || msg.liveLocationMessage) return 'location';
  if (msg.contactMessage || msg.contactsArrayMessage) return 'contact';
  if (msg.conversation || msg.extendedTextMessage) return 'text';
  // Fallback: Evolution API messageType field
  const mt = (m.messageType || '').toLowerCase();
  if (mt === 'imagemessage' || mt === 'image') return 'image';
  if (mt === 'videomessage' || mt === 'video') return 'video';
  // ... etc
  return 'unknown';
};

const parseFullMessage = (m: any): Message => {
  const msg = m.message || {};
  const type = detectMsgType(m);
  const docMsg = msg.documentMessage || msg.documentWithCaptionMessage?.message?.documentMessage;

  return {
    id: m.key?.id || m.id || '',
    fromMe: m.key?.fromMe === true,
    body: parseBodyText(m),
    timestamp: m.messageTimestamp || 0,
    type,
    mimetype: msg.imageMessage?.mimetype || msg.videoMessage?.mimetype ||
      msg.audioMessage?.mimetype || docMsg?.mimetype ||
      msg.stickerMessage?.mimetype || undefined,
    fileName: docMsg?.fileName || docMsg?.title || undefined,
    thumbnailB64: msg.imageMessage?.jpegThumbnail || msg.videoMessage?.jpegThumbnail ||
      msg.stickerMessage?.jpegThumbnail || undefined,
    latitude: msg.locationMessage?.degreesLatitude || msg.liveLocationMessage?.degreesLatitude,
    longitude: msg.locationMessage?.degreesLongitude || msg.liveLocationMessage?.degreesLongitude,
    rawMsgKey: m.key ? { id: m.key.id, remoteJid: m.key.remoteJid, fromMe: m.key.fromMe === true } : undefined,
    rawMessage: m,
  };
};
```

### 6.6 — Fetch Base64 para mídias

```typescript
const fetchMediaBase64 = async (
  instanceName: string,
  rawMessage: any,
  convertToMp4 = false,
): Promise<string | null> => {
  try {
    const data = await evoFetch(`/chat/getBase64FromMediaMessage/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify({ message: rawMessage, convertToMp4 }),
    });
    return data?.base64 || null;
  } catch (err) {
    console.error('[Media] Falha ao carregar base64:', err);
    return null;
  }
};
```

### 6.7 — Carregar chats (conversas)

```typescript
const loadChats = useCallback(async (instanceName: string, silent = false) => {
  try {
    const data = await evoFetch(`/chat/findChats/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const raw: any[] = Array.isArray(data) ? data : (data?.chats || []);

    // Dedup: merge @lid and @s.whatsapp.net entries for the same phone number
    const phoneMap = new Map<string, Chat>();

    for (const c of raw) {
      const key = getDedupeKey(c);
      // ... merge logic (keeping @lid as primary, phone JID as alt)
      // ... parse lastMessage, calculate unread from local "last seen" tracking
    }

    const sorted = Array.from(phoneMap.values()).sort((a, b) => b.lastMessageTs - a.lastMessageTs);
    setChats(sorted);
  } catch { /* ... */ }
}, []);

// Poll chat list every 3s
useEffect(() => {
  if (!activeInstance || activeInstance.connectionStatus !== 'open') return;
  const t = setInterval(() => loadChats(activeInstance.name, true), 3000);
  return () => clearInterval(t);
}, [activeInstance?.name, activeInstance?.connectionStatus]);
```

### 6.8 — Carregar mensagens

```typescript
const loadMessages = useCallback(async (instanceName: string, chat: Chat, scroll = false) => {
  // Build list of JIDs to query (both @lid and @s.whatsapp.net)
  const jids = [chat.remoteJid];
  if (chat.remoteJidAlt) jids.push(chat.remoteJidAlt);

  const results = await Promise.all(
    jids.map(jid =>
      evoFetch(`/chat/findMessages/${instanceName}`, {
        method: 'POST',
        body: JSON.stringify({ where: { key: { remoteJid: jid } }, limit: 60 }),
      }).catch(() => null)
    )
  );

  // Dedup by message ID, parse all messages, sort by timestamp
  const seen = new Set<string>();
  const parsed: Message[] = [];
  for (const data of results) {
    const raw = data?.messages?.records || (Array.isArray(data) ? data : []);
    for (const m of raw) {
      if (m.messageType === 'protocolMessage' || m.messageType === 'reactionMessage') continue;
      const msgId = m.key?.id || m.id;
      if (!msgId || seen.has(msgId)) continue;
      seen.add(msgId);
      parsed.push(parseFullMessage(m));
    }
  }
  parsed.sort((a, b) => a.timestamp - b.timestamp);
  setMessages(parsed);
}, []);

// Real-time poll every 3s
useEffect(() => {
  if (!activeChat || !activeInstance) return;
  const t = setInterval(() => loadMessages(activeInstance.name, activeChat, false), 3000);
  return () => clearInterval(t);
}, [activeChat?.id, activeInstance?.name]);
```

### 6.9 — Enviar texto

```typescript
const handleSend = async () => {
  const text = inputText.trim();
  if (!text || !activeChat || !activeInstance) return;
  setSending(true);
  try {
    await evoFetch(`/message/sendText/${activeInstance.name}`, {
      method: 'POST',
      body: JSON.stringify({ number: activeChat.phone || activeChat.remoteJid, text }),
    });
    setInputText('');
    await loadMessages(activeInstance.name, activeChat, false);
  } catch (e: any) {
    toast({ variant: 'destructive', title: 'Erro ao enviar', description: e.message });
  } finally { setSending(false); }
};
```

### 6.10 — Enviar mídia (imagem/vídeo/documento)

```typescript
const handleSendMedia = async (file: File) => {
  const reader = new FileReader();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const mediatype = file.type.startsWith('image/') ? 'image'
    : file.type.startsWith('video/') ? 'video' : 'document';
  const base64 = dataUrl.split(',')[1];

  await evoFetch(`/message/sendMedia/${activeInstance.name}`, {
    method: 'POST',
    body: JSON.stringify({
      number: activeChat.phone || activeChat.remoteJid,
      mediatype,
      mimetype: file.type,
      caption: '',
      media: base64,
      fileName: file.name,
    }),
  });
};
```

### 6.11 — Enviar áudio (gravação do microfone)

```typescript
// Grava com MediaRecorder (audio/webm;codecs=opus)
// No onstop, converte para base64 e envia:
await evoFetch(`/message/sendWhatsAppAudio/${activeInstance.name}`, {
  method: 'POST',
  body: JSON.stringify({
    number,
    audio: base64, // base64 do blob de áudio
  }),
});
```

### 6.12 — Painel de Análise IA (AIAnalysisPanel)

```typescript
// Componente que analisa a conversa usando OpenAI
// Carrega critérios de avaliação do DB ou localStorage
// Envia transcrição formatada para OpenAI
// Exibe score total, critérios individuais, alertas críticos, resumo e insights
// Resultados são cacheados em localStorage por chat ID
```

### 6.13 — Carregar scores IA do banco (cron)

```typescript
// Load AI scores from DB for current instance
useEffect(() => {
  const loadScores = async () => {
    const empresaId = await getSaasEmpresaId();
    const { data } = await (supabase as any)
      .schema('saas')
      .from('analises_ia')
      .select('contato_telefone,score,periodo_ref')
      .eq('empresa_id', empresaId)
      .eq('tipo_contexto', 'whatsapp')
      .eq('instancia_nome', activeInstance.name)
      .not('contato_telefone', 'is', null)
      .order('periodo_ref', { ascending: false });

    if (data) {
      const map = new Map<string, number>();
      for (const row of data) {
        if (!map.has(row.contato_telefone)) {
          map.set(row.contato_telefone, row.score);
        }
      }
      setChatScores(map);
    }
  };
  loadScores();
}, [activeInstance?.name]);
```

---

## 7. Página Integrações

**Arquivo:** `src/pages/IntegrationsPage.tsx` (1155 linhas)

### 7.1 — Helper `evolutionFetch`

```typescript
async function evolutionFetch(path: string, options: RequestInit = {}) {
  if (!EVOLUTION_API_URL || !EVOLUTION_API_TOKEN) {
    throw new Error('Evolution API não configurada no .env');
  }
  const res = await fetch(`${EVOLUTION_API_URL}${path}`, {
    ...options,
    headers: {
      apikey: EVOLUTION_API_TOKEN,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
```

### 7.2 — Sync instâncias para o banco

```typescript
async function syncInstancesToDbFromPage(apiInstances: EvolutionInstance[]) {
  const empresaId = await getSaasEmpresaId();
  const statusMap: Record<string, string> = { open: 'conectada', close: 'desconectada', connecting: 'conectando' };
  for (const inst of apiInstances) {
    await (supabase as any)
      .schema('saas')
      .from('instancias_whatsapp')
      .upsert(
        {
          empresa_id: empresaId,
          nome: inst.name,
          telefone: inst.ownerJid?.replace('@s.whatsapp.net', '') || null,
          status: statusMap[inst.connectionStatus] || 'desconectada',
          owner_jid: inst.ownerJid || null,
          ultimo_evento_em: new Date().toISOString(),
        },
        { onConflict: 'empresa_id,nome' },
      );
  }
}
```

### 7.3 — EvolutionPanel (gerenciamento de instâncias)

```typescript
function EvolutionPanel() {
  // Carrega instâncias do DB primeiro (para exibição imediata)
  // Depois busca dados ao vivo da Evolution API
  // Merge atribuições de usuário do DB nos dados da API
  // Permite admin atribuir instância a um usuário (select dropdown)
  // Permite gerar QR Code para conectar instância offline
  // Exibe: nome, telefone, status, foto de perfil, contadores, usuário atribuído

  const fetchInstances = useCallback(async () => {
    // 1. Load from DB first
    const { data: dbData } = await supabase.schema('saas').from('instancias_whatsapp')...
    // 2. Fetch live from Evolution API
    const data = await evolutionFetch('/instance/fetchInstances');
    // 3. Merge + sync back to DB
    syncInstancesToDbFromPage(apiInstances);
  }, []);

  const handleGetQr = async (instanceName: string) => {
    const data = await evolutionFetch(`/instance/connect/${instanceName}`);
    const base64 = data?.base64 || data?.qrcode?.base64 || null;
    setQrCode(base64);
  };

  const handleAssignUser = (instanceName: string, userId: string) => {
    setInstanceUserMap(m => { /* update local state */ });
    assignInstanceToUser(instanceName, userId); // persist to DB
  };
}
```

---

## 8. Cron de Avaliação

**Arquivo:** `supabase/functions/evaluate-cron/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL') || 'https://evolutionapic.contato-lojavirtual.com';
const EVOLUTION_API_TOKEN = Deno.env.get('EVOLUTION_API_TOKEN') || '3ce7a42f9bd96ea526b2b0bc39a4faec';

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { db: { schema: 'saas' } });

// ─── Fetch messages from Evolution API ───────────────────────────────────────
async function fetchEvolutionMessages(instanceName: string, remoteJid: string): Promise<any[]> {
  try {
    const res = await fetch(`${EVOLUTION_API_URL}/chat/findMessages/${instanceName}`, {
      method: 'POST',
      headers: { apikey: EVOLUTION_API_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        where: { key: { remoteJid } },
        limit: 100,
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data?.messages?.records || (Array.isArray(data) ? data : []);
  } catch { return []; }
}

// ─── Build evaluation prompt ─────────────────────────────────────────────────
function buildPrompt(criteria: any[], transcript: string, type: 'whatsapp' | 'reuniao') {
  // Formata critérios e transcrição para enviar ao OpenAI
  // Pede resposta JSON com: totalScore, summary, insights, criticalAlerts, criteriaScores
}

serve(async (req) => {
  // 1. Get empresa
  // 2. Get OpenAI tokens from saas.tokens_ia_modulo
  // 3. Get AI criteria from saas.configuracoes_ia

  // ═══ WHATSAPP EVALUATION ═══
  // Para cada instância conectada:
  //   Para cada conversa com atividade hoje:
  //     - Verifica se já foi avaliada hoje (saas.analises_ia)
  //     - Busca mensagens da Evolution API via fetchEvolutionMessages()
  //     - Monta transcrição [VENDEDOR] / [LEAD]
  //     - Envia para OpenAI via RPC
  //     - Salva resultado em saas.analises_ia

  // ═══ MEETINGS EVALUATION ═══
  // (similar, mas usa transcrição de reuniões do DB em vez de Evolution API)
});
```

---

## 9. Schema do Banco

**Arquivo:** `supabase/migrations/20260309164000_schema_saas.sql` (trechos relevantes)

```sql
-- Enums
create type saas.status_instancia_whatsapp as enum ('conectada', 'desconectada', 'conectando');
create type saas.tipo_integracao as enum ('google_calendar', 'google_meet', 'hubspot', 'openai', 'evolution_api', 'n8n');
create type saas.status_integracao as enum ('conectada', 'desconectada', 'erro');

-- Tabela de integrações (usada para registrar conexão com Evolution API)
create table if not exists saas.integracoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references saas.empresas(id) on delete cascade,
  usuario_id uuid references saas.usuarios(id) on delete set null,
  tipo saas.tipo_integracao not null,
  nome text not null,
  status saas.status_integracao not null default 'desconectada',
  configuracao jsonb not null default '{}'::jsonb,
  conectado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (empresa_id, usuario_id, tipo)
);

-- =========================
-- WHATSAPP E IA
-- =========================
create table if not exists saas.instancias_whatsapp (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references saas.empresas(id) on delete cascade,
  usuario_id uuid references saas.usuarios(id) on delete set null,
  time_id uuid references saas.times(id) on delete set null,
  nome text not null,
  telefone text,
  status saas.status_instancia_whatsapp not null default 'desconectada',
  qr_code text,
  owner_jid text,
  ultimo_evento_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (empresa_id, nome)
);

create table if not exists saas.conversas_whatsapp (
  id uuid primary key default gen_random_uuid(),
  instancia_id uuid not null references saas.instancias_whatsapp(id) on delete cascade,
  contato_nome text,
  contato_telefone text not null,
  contato_avatar_url text,
  ultima_mensagem text,
  ultima_mensagem_em timestamptz,
  nao_lidas integer not null default 0,
  responsavel_usuario_id uuid references saas.usuarios(id) on delete set null,
  score smallint check (score between 0 and 100),
  analisada_por_ia boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (instancia_id, contato_telefone)
);

create table if not exists saas.mensagens_whatsapp (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references saas.conversas_whatsapp(id) on delete cascade,
  instancia_id uuid not null references saas.instancias_whatsapp(id) on delete cascade,
  de_jid text,
  para_jid text,
  corpo text,
  tipo text not null default 'texto',
  direcao text not null check (direcao in ('entrada', 'saida')),
  external_message_id text,
  enviada_em timestamptz not null,
  criado_em timestamptz not null default now(),
  unique (instancia_id, external_message_id)
);

create table if not exists saas.analises_ia (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references saas.empresas(id) on delete cascade,
  tipo_contexto text not null check (tipo_contexto in ('reuniao', 'whatsapp', 'treinamento', 'relatorio')),
  entidade_id uuid,
  score smallint check (score between 0 and 100),
  criterios jsonb,
  resumo text,
  payload jsonb,
  -- campos adicionais para WhatsApp (cron):
  vendedor_id uuid,
  instancia_nome text,
  contato_telefone text,
  periodo_ref date,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Indexes
create index if not exists idx_instancias_empresa on saas.instancias_whatsapp (empresa_id);
create index if not exists idx_conversas_instancia on saas.conversas_whatsapp (instancia_id);
create index if not exists idx_mensagens_conversa_data on saas.mensagens_whatsapp (conversa_id, enviada_em desc);
create index if not exists idx_analises_contexto on saas.analises_ia (tipo_contexto, entidade_id);

-- Triggers (auto-update atualizado_em)
create trigger trg_instancias_whatsapp_atualizado_em before update on saas.instancias_whatsapp for each row execute function saas.definir_atualizado_em();
create trigger trg_conversas_whatsapp_atualizado_em before update on saas.conversas_whatsapp for each row execute function saas.definir_atualizado_em();
create trigger trg_analises_ia_atualizado_em before update on saas.analises_ia for each row execute function saas.definir_atualizado_em();
```

---

## 10. Endpoints da Evolution API usados

### Gerenciamento de Instâncias

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/instance/fetchInstances` | Lista todas as instâncias |
| POST | `/instance/connect/{instanceName}` | Gera QR Code para conectar |
| POST | `/instance/create` | Cria nova instância (`{ instanceName, integration: 'WHATSAPP-BAILEYS' }`) |

### Chat & Mensagens

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/chat/findChats/{instanceName}` | Lista todas as conversas (body: `{}`) |
| POST | `/chat/findMessages/{instanceName}` | Busca mensagens (body: `{ where: { key: { remoteJid } }, limit }`) |
| POST | `/chat/getBase64FromMediaMessage/{instanceName}` | Obtém mídia em base64 (body: `{ message: rawMessage, convertToMp4 }`) |

### Envio de Mensagens

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/message/sendText/{instanceName}` | Envia texto (body: `{ number, text }`) |
| POST | `/message/sendMedia/{instanceName}` | Envia mídia (body: `{ number, mediatype, mimetype, caption, media, fileName }`) |
| POST | `/message/sendWhatsAppAudio/{instanceName}` | Envia áudio (body: `{ number, audio }`) |

### Autenticação

- **Header:** `apikey: <EVOLUTION_API_TOKEN>`
- **Content-Type:** `application/json`
- **Timeout:** 30 segundos (no frontend)

---

## Arquitetura resumida

```
┌─────────────────┐     ┌──────────────────┐     ┌────────────────┐
│  Frontend React  │────▶│  Evolution API    │────▶│  WhatsApp Web  │
│  (WhatsAppPage)  │◀────│  (Baileys)        │◀────│  (dispositivo) │
└────────┬────────┘     └──────────────────┘     └────────────────┘
         │
         │ Supabase (schema: saas)
         ▼
┌─────────────────────────────────────────┐
│  instancias_whatsapp (sync bidirecional)│
│  conversas_whatsapp                      │
│  mensagens_whatsapp                      │
│  analises_ia (scores IA)                 │
│  integracoes (registro de conexão)       │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────────┐
│  evaluate-cron   │────▶│  OpenAI API      │
│  (Edge Function) │◀────│  (gpt-4o-mini)   │
└─────────────────┘     └──────────────────┘
```

**Fluxo:**
1. Frontend busca instâncias da Evolution API + banco (merge com atribuições de usuário)
2. Instâncias são sincronizadas automaticamente para `saas.instancias_whatsapp`
3. Chats e mensagens são buscados diretamente da Evolution API (não armazenados no banco)
4. Mídias são carregadas via `getBase64FromMediaMessage` (URLs encriptadas do Baileys não são acessíveis no browser)
5. Mensagens são enviadas via endpoints `sendText`, `sendMedia`, `sendWhatsAppAudio`
6. O cron `evaluate-cron` roda diariamente, busca mensagens da Evolution API e avalia com OpenAI
7. Scores são salvos em `saas.analises_ia` e exibidos no frontend junto aos chats
