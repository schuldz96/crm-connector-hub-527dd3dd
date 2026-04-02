/**
 * Evolution API config loader — loads URL + token from saas.integracoes.
 * Falls back to CONFIG (.env) if no DB record exists.
 * Caches in memory to avoid repeated DB calls.
 */
import { supabase } from '@/integrations/supabase/client';
import { getSaasEmpresaId } from '@/lib/saas';
import { encryptToken, decryptToken } from '@/lib/tokenCrypto';
import { CONFIG } from '@/lib/config';

export interface EvolutionApiConfig {
  url: string;
  token: string;
}

let cached: EvolutionApiConfig | null = null;
let inflight: Promise<EvolutionApiConfig> | null = null;

export async function getEvolutionConfig(): Promise<EvolutionApiConfig> {
  if (cached) return cached;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const empresaId = await getSaasEmpresaId();
      const { data } = await (supabase as any).schema('saas').from('integracoes')
        .select('configuracao')
        .eq('empresa_id', empresaId)
        .eq('tipo', 'evolution')
        .eq('status', 'conectada')
        .limit(1)
        .maybeSingle();

      if (data?.configuracao?.url && data?.configuracao?.token_encrypted) {
        const token = await decryptToken(data.configuracao.token_encrypted);
        if (token) {
          cached = { url: data.configuracao.url, token };
          return cached;
        }
      }
    } catch {
      // DB failed, fall through to .env
    }

    // Fallback to .env / hardcoded config
    cached = { url: CONFIG.EVOLUTION_API_URL, token: CONFIG.EVOLUTION_API_TOKEN };
    return cached;
  })();

  const result = await inflight;
  inflight = null;
  return result;
}

export async function saveEvolutionConfig(url: string, token: string): Promise<void> {
  const empresaId = await getSaasEmpresaId();
  const encrypted = await encryptToken(token);

  await (supabase as any).schema('saas').from('integracoes').upsert({
    empresa_id: empresaId,
    tipo: 'evolution',
    nome: 'Evolution API',
    status: 'conectada',
    configuracao: { url, token_encrypted: encrypted },
    conectado_em: new Date().toISOString(),
  }, { onConflict: 'empresa_id,tipo,nome' });

  cached = { url, token };
}

export async function disconnectEvolution(): Promise<void> {
  try {
    const empresaId = await getSaasEmpresaId();
    await (supabase as any).schema('saas').from('integracoes')
      .update({ status: 'desconectada', configuracao: {} })
      .eq('empresa_id', empresaId)
      .eq('tipo', 'evolution');
  } catch { /* best-effort */ }
  cached = null;
}

export function clearEvolutionConfigCache(): void {
  cached = null;
}
