import { supabase } from '@/integrations/supabase/client';
import { getOrg, getOrgAndEmpresaId } from '@/lib/saas';
import type { EvalCriteria } from '@/pages/AIConfigPage';

export interface AIModuleConfig {
  criterios: EvalCriteria[];
  prompt_sistema: string;
  palavras_proibidas: string[];
}

/**
 * Load AI config (criteria + prompt + forbidden words) for a module from DB.
 * Returns null if not found (caller should use defaults).
 */
export async function loadAIConfig(moduloCodigo: string): Promise<AIModuleConfig | null> {
  try {
    const org = await getOrg();
    const { data, error } = await (supabase as any)
      .schema('ai')
      .from('configuracoes')
      .select('criterios, prompt_sistema, palavras_proibidas')
      .eq('org', org)
      .eq('modulo_codigo', moduloCodigo)
      .maybeSingle();

    if (error || !data) return null;
    return {
      criterios: Array.isArray(data.criterios) ? data.criterios : [],
      prompt_sistema: data.prompt_sistema || '',
      palavras_proibidas: Array.isArray(data.palavras_proibidas) ? data.palavras_proibidas : [],
    };
  } catch {
    return null;
  }
}

/**
 * Save AI config (criteria + prompt + forbidden words) for a module to DB.
 */
export async function saveAIConfig(
  moduloCodigo: string,
  criterios: EvalCriteria[],
  promptSistema: string,
  palavrasProibidas?: string[],
): Promise<void> {
  const { org, empresaId } = await getOrgAndEmpresaId();

  const payload: Record<string, unknown> = {
    empresa_id: empresaId,
    org,
    modulo_codigo: moduloCodigo,
    criterios: JSON.parse(JSON.stringify(criterios)),
    prompt_sistema: promptSistema,
    atualizado_em: new Date().toISOString(),
  };
  if (palavrasProibidas !== undefined) {
    payload.palavras_proibidas = palavrasProibidas;
  }

  await (supabase as any)
    .schema('ai')
    .from('configuracoes')
    .upsert(payload, { onConflict: 'empresa_id,modulo_codigo' });
}
