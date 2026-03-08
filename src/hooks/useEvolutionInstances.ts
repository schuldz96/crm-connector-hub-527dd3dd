import { useState, useEffect, useCallback } from 'react';

const EVOLUTION_API_URL = 'https://evolutionapic.contato-lojavirtual.com';
const EVOLUTION_API_TOKEN = '3ce7a42f9bd96ea526b2b0bc39a4faec';

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
