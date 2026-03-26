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
      await supabaseSaas
        .schema(\'saas\')
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
  const { data, error } = await supabaseSaas
    .schema(\'saas\')
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
