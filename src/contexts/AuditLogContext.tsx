import React, { createContext, useContext, useCallback, useRef } from 'react';
import type { UserRole } from '@/types';
import { supabase, supabaseSaas } from '@/integrations/supabase/client';
import { getOrg } from '@/lib/saas';

// ── Types ──────────────────────────────────────────────────────────────────

export type AuditEventType = 'login' | 'logout' | 'page_view';

export interface AuditEvent {
  id: string;
  type: AuditEventType;
  userId: string;
  userName: string;
  userRole: UserRole;
  userEmail: string;
  /** For page_view: the pathname. For login/logout: empty string */
  page: string;
  /** Human-readable page label */
  pageLabel: string;
  timestamp: string; // ISO
  /** IP-like session ID (random per session) */
  sessionId: string;
}

interface AuditLogContextType {
  getLogs: () => AuditEvent[];
  addEvent: (event: Omit<AuditEvent, 'id' | 'timestamp' | 'sessionId'>) => void;
  clearLogs: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const MAX_ENTRIES = 2000;

const SESSION_ID = Math.random().toString(36).slice(2, 10).toUpperCase();

function roleToDb(role: UserRole): string {
  const map: Record<UserRole, string> = {
    admin: 'admin',
    ceo: 'ceo',
    director: 'diretor',
    manager: 'gerente',
    coordinator: 'coordenador',
    supervisor: 'supervisor',
    bdr: 'bdr',
    sdr: 'sdr',
    closer: 'closer',
    key_account: 'key_account',
    csm: 'csm',
    low_touch: 'low_touch',
    sales_engineer: 'sales_engineer',
    member: 'vendedor',
    support: 'suporte',
  };
  return map[role];
}

function roleFromDb(role: string | null | undefined): UserRole {
  const map: Record<string, UserRole> = {
    admin: 'admin',
    ceo: 'ceo',
    diretor: 'director',
    gerente: 'manager',
    coordenador: 'coordinator',
    supervisor: 'supervisor',
    bdr: 'bdr',
    sdr: 'sdr',
    closer: 'closer',
    key_account: 'key_account',
    csm: 'csm',
    low_touch: 'low_touch',
    sales_engineer: 'sales_engineer',
    vendedor: 'member',
  };
  return map[(role || '').toLowerCase()] || 'member';
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ── Context ────────────────────────────────────────────────────────────────

const AuditLogContext = createContext<AuditLogContextType | null>(null);

export function AuditLogProvider({ children }: { children: React.ReactNode }) {
  // Keep a ref so callbacks never become stale
  const logsRef = useRef<AuditEvent[]>([]);

  const getLogs = useCallback((): AuditEvent[] => {
    return logsRef.current;
  }, []);

  React.useEffect(() => {
    const run = async () => {
      try {
        const org = await getOrg();
        const { data, error } = await (supabaseSaas as any)
          .schema('audit')
          .from('logs')
          .select('id,usuario_id,tipo_evento,pagina,pagina_label,metadados,criado_em')
          .eq('org', org)
          .order('criado_em', { ascending: false })
          .limit(MAX_ENTRIES);
        if (error) throw error;
        logsRef.current = (data || []).map((r: any) => ({
          id: r.id,
          type: (r.tipo_evento || 'page_view') as AuditEventType,
          userId: r.metadados?.user_id || r.usuario_id || '',
          userName: r.metadados?.user_name || 'Usuário',
          userRole: roleFromDb(r.metadados?.user_role),
          userEmail: r.metadados?.user_email || '',
          page: r.pagina || '',
          pageLabel: r.pagina_label || '',
          timestamp: r.criado_em,
          sessionId: r.metadados?.session_id || SESSION_ID,
        }));
      } catch {
        logsRef.current = [];
      }
    };
    run();
  }, []);

  const addEvent = useCallback(
    (event: Omit<AuditEvent, 'id' | 'timestamp' | 'sessionId'>) => {
      const entry: AuditEvent = {
        ...event,
        id: uid(),
        timestamp: new Date().toISOString(),
        sessionId: SESSION_ID,
      };
      logsRef.current = [entry, ...logsRef.current].slice(0, MAX_ENTRIES);
      void (async () => {
        try {
          const org = await getOrg();

          // Resolve email → UUID for usuario_id column
          let usuarioId: string | null = null;
          if (entry.userEmail) {
            const { data: usr } = await (supabaseSaas as any)
              .schema('core')
              .from('usuarios')
              .select('id')
              .eq('org', org)
              .eq('email', entry.userEmail.trim().toLowerCase())
              .maybeSingle();
            usuarioId = usr?.id ?? null;
          }

          await (supabaseSaas as any).schema('audit').from('logs').insert({
            empresa_id: org,
            usuario_id: usuarioId,
            tipo_evento: entry.type,
            pagina: entry.page || null,
            pagina_label: entry.pageLabel || null,
            metadados: {
              user_id: entry.userId,
              user_name: entry.userName,
              user_role: roleToDb(entry.userRole),
              user_email: entry.userEmail,
              session_id: entry.sessionId,
            },
          });
        } catch {
          // no-op
        }
      })();
    },
    [],
  );

  const clearLogs = useCallback(() => {
    logsRef.current = [];
    void (async () => {
      try {
        const org = await getOrg();
        await (supabaseSaas as any).schema('audit').from('logs').delete().eq('org', org);
      } catch {
        // no-op
      }
    })();
  }, []);

  return (
    <AuditLogContext.Provider value={{ getLogs, addEvent, clearLogs }}>
      {children}
    </AuditLogContext.Provider>
  );
}

export function useAuditLog() {
  const ctx = useContext(AuditLogContext);
  if (!ctx) throw new Error('useAuditLog must be used inside AuditLogProvider');
  return ctx;
}
