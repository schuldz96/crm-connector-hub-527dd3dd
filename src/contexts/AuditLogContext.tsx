import React, { createContext, useContext, useCallback, useRef } from 'react';
import type { UserRole } from '@/types';
import { supabase, supabaseSaas } from '@/integrations/supabase/client';
import { getSaasEmpresaId } from '@/lib/saas';

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
    member: 'vendedor',
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
        const empresaId = await getSaasEmpresaId();
        const { data, error } = await supabaseSaas
          .schema(\'saas\')
          .from('logs_auditoria')
          .select('id,usuario_id,tipo_evento,pagina,pagina_label,metadados,criado_em')
          .eq('empresa_id', empresaId)
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
          const empresaId = await getSaasEmpresaId();

          // Resolve email → UUID for usuario_id column
          let usuarioId: string | null = null;
          if (entry.userEmail) {
            const { data: usr } = await supabaseSaas
              .schema(\'saas\')
              .from('usuarios')
              .select('id')
              .eq('empresa_id', empresaId)
              .eq('email', entry.userEmail.trim().toLowerCase())
              .maybeSingle();
            usuarioId = usr?.id ?? null;
          }

          await supabaseSaas.schema('saas').from('logs_auditoria').insert({
            empresa_id: empresaId,
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
        const empresaId = await getSaasEmpresaId();
        await supabaseSaas.schema('saas').from('logs_auditoria').delete().eq('empresa_id', empresaId);
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
