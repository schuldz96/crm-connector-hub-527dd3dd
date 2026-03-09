import { useState, useEffect, useCallback } from 'react';

const EVOLUTION_API_URL = import.meta.env.VITE_EVOLUTION_API_URL || '';
const EVOLUTION_API_TOKEN = import.meta.env.VITE_EVOLUTION_API_TOKEN || '';

export interface EvolutionInstance {
  id: string;
  name: string;
  connectionStatus: string; // "open" | "close" | "connecting"
  ownerJid?: string;
  profileName?: string;
  profilePicUrl?: string;
  _count?: { Message: number; Contact: number; Chat: number };
}

export function useEvolutionInstances() {
  const [instances, setInstances] = useState<EvolutionInstance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!EVOLUTION_API_URL || !EVOLUTION_API_TOKEN) {
        throw new Error('Evolution API não configurada no .env');
      }
      const res = await window.fetch(`${EVOLUTION_API_URL}/instance/fetchInstances`, {
        headers: { apikey: EVOLUTION_API_TOKEN, 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setInstances(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { instances, loading, error, refetch: fetch };
}

// localStorage helpers — chave compartilhada entre UsersPage e IntegrationsPage
export const getInstanceForUser = (userId: string) =>
  localStorage.getItem(`wa_instance_${userId}`) || '';

export const setInstanceForUser = (userId: string, instanceName: string) => {
  if (instanceName) localStorage.setItem(`wa_instance_${userId}`, instanceName);
  else localStorage.removeItem(`wa_instance_${userId}`);
};
