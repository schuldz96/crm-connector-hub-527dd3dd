/**
 * Evolution API config loader — loads URL + token from saas.integracoes.
 * Falls back to CONFIG (.env) if no DB record exists.
 * Caches in memory to avoid repeated DB calls.
 */
import { supabase } from '@/integrations/supabase/client';
import { getOrg, getOrgAndEmpresaId } from '@/lib/saas';
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
      const org = await getOrg();
      const { data, error } = await (supabase as any).schema('automation').from('integracoes')
        .select('configuracao')
        .eq('org', org)
        .eq('tipo', 'evolution_api')
        .eq('status', 'conectada')
        .limit(1)
        .maybeSingle();

      if (error) console.warn('[evolutionConfig] load error:', error.message);

      if (data?.configuracao?.url && data?.configuracao?.token_encrypted) {
        const token = await decryptToken(data.configuracao.token_encrypted);
        if (token) {
          cached = { url: data.configuracao.url, token };
          return cached;
        }
      }
    } catch (e) {
      console.warn('[evolutionConfig] load failed:', e);
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
  const { org, empresaId } = await getOrgAndEmpresaId();
  const encrypted = await encryptToken(token);

  // Try upsert first (requires unique constraint empresa_id,tipo,nome)
  const { error: upsertErr } = await (supabase as any).schema('automation').from('integracoes').upsert({
    empresa_id: empresaId,
    org,
    tipo: 'evolution_api',
    nome: 'Evolution API',
    status: 'conectada',
    configuracao: { url, token_encrypted: encrypted },
    conectado_em: new Date().toISOString(),
  }, { onConflict: 'empresa_id,tipo,nome' });

  if (upsertErr) {
    console.warn('[evolutionConfig] upsert failed, trying update:', upsertErr.message);
    // Fallback: try update existing row
    const { error: updateErr } = await (supabase as any).schema('automation').from('integracoes')
      .update({
        status: 'conectada',
        configuracao: { url, token_encrypted: encrypted },
        conectado_em: new Date().toISOString(),
      })
      .eq('org', org)
      .eq('tipo', 'evolution_api');

    if (updateErr) {
      console.warn('[evolutionConfig] update also failed, trying insert:', updateErr.message);
      // Last resort: plain insert
      const { error: insertErr } = await (supabase as any).schema('automation').from('integracoes')
        .insert({
          empresa_id: empresaId,
          org,
          tipo: 'evolution_api',
          nome: 'Evolution API',
          status: 'conectada',
          configuracao: { url, token_encrypted: encrypted },
          conectado_em: new Date().toISOString(),
        });

      if (insertErr) throw new Error(`Falha ao salvar: ${insertErr.message}`);
    }
  }

  cached = { url, token };
}

export async function disconnectEvolution(): Promise<void> {
  try {
    const org = await getOrg();
    await (supabase as any).schema('automation').from('integracoes')
      .update({ status: 'desconectada', configuracao: {} })
      .eq('org', org)
      .eq('tipo', 'evolution_api');
  } catch { /* best-effort */ }
  cached = null;
}

export function clearEvolutionConfigCache(): void {
  cached = null;
}
