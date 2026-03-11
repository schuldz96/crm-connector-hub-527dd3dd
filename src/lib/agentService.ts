/**
 * Service for managing AI agent hierarchy (gerente → classificador → avaliadores).
 * Each agent has its own prompt, criteria, and optional reference files.
 */
import { supabase } from '@/integrations/supabase/client';
import { getSaasEmpresaId } from '@/lib/saas';
import type { EvalCriteria } from '@/pages/AIConfigPage';

// ─── Types ───────────────────────────────────────────────────────────────────
export type AgentTipo = 'gerente' | 'classificador' | 'avaliador' | 'sentimental';

export interface AgentNode {
  id: string;
  empresa_id: string;
  parent_id: string | null;
  tipo: AgentTipo;
  nome: string;
  descricao: string;
  prompt_sistema: string;
  criterios: EvalCriteria[];
  modelo_ia: string;
  temperatura: number;
  ordem: number;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface AgentFile {
  id: string;
  agente_id: string;
  nome: string;
  tipo_mime: string;
  tamanho: number;
  storage_path: string;
  texto_extraido: string;
  criado_em: string;
}

// ─── Load full agent tree for current empresa ────────────────────────────────
export async function loadAgentTree(): Promise<AgentNode[]> {
  const empresaId = await getSaasEmpresaId();
  const { data, error } = await (supabase as any)
    .schema('saas')
    .from('agentes_ia')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('ordem', { ascending: true });

  if (error) {
    console.error('[agentService] loadAgentTree error:', error);
    return [];
  }
  return (data || []) as AgentNode[];
}

// ─── Save (upsert) a single agent ───────────────────────────────────────────
export async function saveAgent(agent: Partial<AgentNode> & { tipo: AgentTipo; nome: string }): Promise<AgentNode | null> {
  const empresaId = await getSaasEmpresaId();
  const payload = {
    ...agent,
    empresa_id: empresaId,
    criterios: JSON.parse(JSON.stringify(agent.criterios || [])),
    atualizado_em: new Date().toISOString(),
  };

  if (agent.id) {
    // Update existing
    const { data, error } = await (supabase as any)
      .schema('saas')
      .from('agentes_ia')
      .update(payload)
      .eq('id', agent.id)
      .select()
      .single();
    if (error) console.error('[agentService] update error:', error);
    return data || null;
  } else {
    // Insert new
    const { data, error } = await (supabase as any)
      .schema('saas')
      .from('agentes_ia')
      .insert(payload)
      .select()
      .single();
    if (error) console.error('[agentService] insert error:', error);
    return data || null;
  }
}

// ─── Delete an agent (cascades to children and files) ────────────────────────
export async function deleteAgent(agentId: string): Promise<void> {
  const { error } = await (supabase as any)
    .schema('saas')
    .from('agentes_ia')
    .delete()
    .eq('id', agentId);
  if (error) console.error('[agentService] delete error:', error);
}

// ─── Initialize default agent tree ──────────────────────────────────────────
export async function initializeAgentTree(): Promise<AgentNode[]> {
  const empresaId = await getSaasEmpresaId();

  // Create Gerente
  const { data: gerente } = await (supabase as any)
    .schema('saas')
    .from('agentes_ia')
    .insert({
      empresa_id: empresaId,
      tipo: 'gerente',
      nome: 'Gerente',
      descricao: 'Agente orquestrador que coordena a avaliação das reuniões',
      prompt_sistema: 'Você é o gerente de avaliação de reuniões. Seu papel é coordenar os agentes especializados para avaliar cada reunião de forma precisa e consistente.',
      ordem: 0,
    })
    .select()
    .single();

  if (!gerente) return [];

  // Create Classificador
  const { data: classificador } = await (supabase as any)
    .schema('saas')
    .from('agentes_ia')
    .insert({
      empresa_id: empresaId,
      parent_id: gerente.id,
      tipo: 'classificador',
      nome: 'Classificador',
      descricao: 'Identifica o tipo da reunião para direcionar ao avaliador correto',
      prompt_sistema: 'Você é um classificador de reuniões. Analise o título e o início da transcrição para identificar o tipo da reunião. Retorne APENAS JSON: {"tipo": "<nome exato do tipo>", "confianca": <0-100>}',
      ordem: 0,
    })
    .select()
    .single();

  if (!classificador) return [gerente];

  // Create one default avaliador
  const { data: avaliador } = await (supabase as any)
    .schema('saas')
    .from('agentes_ia')
    .insert({
      empresa_id: empresaId,
      parent_id: classificador.id,
      tipo: 'avaliador',
      nome: '[Closer In] Apresentação',
      descricao: 'Avalia reuniões de apresentação de vendas (closer inbound)',
      prompt_sistema: 'Você é um avaliador especialista em vendas consultivas. Analise a transcrição da reunião e avalie cada critério com base nos sinais identificados. Seja específico e construtivo nos feedbacks.',
      criterios: JSON.parse(JSON.stringify([
        {
          id: 'rapport', label: 'Rapport', weight: 20,
          description: 'Conexão emocional e abertura do cliente durante a conversa',
          examples: ['Apresentação amigável', 'Tom de voz adequado'],
          positiveSignals: ['Cliente compartilha informações voluntariamente'],
          negativeSignals: ['Silêncios longos no início'],
        },
        {
          id: 'discovery', label: 'Descoberta', weight: 25,
          description: 'Qualidade das perguntas de qualificação',
          examples: ['Perguntas abertas SPIN', 'Mapeamento de decisores'],
          positiveSignals: ['Cliente descreve dores com detalhes'],
          negativeSignals: ['Vai para demo sem qualificar'],
        },
        {
          id: 'presentation', label: 'Apresentação', weight: 20,
          description: 'Clareza e impacto da proposta de valor',
          examples: ['Cases relevantes', 'ROI quantificado'],
          positiveSignals: ['Cliente faz perguntas de aprofundamento'],
          negativeSignals: ['Demo genérica'],
        },
        {
          id: 'objections', label: 'Objeções', weight: 20,
          description: 'Tratamento de resistências',
          examples: ['Ancoragem de valor', 'Reformulação da objeção'],
          positiveSignals: ['Objeção transformada em pergunta'],
          negativeSignals: ['Desconto imediato'],
        },
        {
          id: 'nextSteps', label: 'Próximos Passos', weight: 15,
          description: 'Clareza no fechamento e comprometimento',
          examples: ['Data e hora definidos', 'Responsáveis mapeados'],
          positiveSignals: ['Próxima reunião agendada na call'],
          negativeSignals: ['Sair sem data definida'],
        },
      ])),
      ordem: 0,
    })
    .select()
    .single();

  return [gerente, classificador, avaliador].filter(Boolean) as AgentNode[];
}

// ─── File management ─────────────────────────────────────────────────────────
export async function loadAgentFiles(agentId: string): Promise<AgentFile[]> {
  const { data, error } = await (supabase as any)
    .schema('saas')
    .from('agente_arquivos')
    .select('*')
    .eq('agente_id', agentId)
    .order('criado_em', { ascending: false });

  if (error) {
    console.error('[agentService] loadAgentFiles error:', error);
    return [];
  }
  return (data || []) as AgentFile[];
}

export async function saveAgentFile(
  agentId: string,
  file: File,
  extractedText: string,
): Promise<AgentFile | null> {
  const empresaId = await getSaasEmpresaId();
  const fileId = crypto.randomUUID();
  const storagePath = `${empresaId}/${agentId}/${fileId}_${file.name}`;

  // Upload to Supabase Storage
  const { error: uploadErr } = await supabase.storage
    .from('agente-arquivos')
    .upload(storagePath, file);

  if (uploadErr) {
    console.error('[agentService] upload error:', uploadErr);
    return null;
  }

  // Save metadata
  const { data, error } = await (supabase as any)
    .schema('saas')
    .from('agente_arquivos')
    .insert({
      agente_id: agentId,
      empresa_id: empresaId,
      nome: file.name,
      tipo_mime: file.type,
      tamanho: file.size,
      storage_path: storagePath,
      texto_extraido: extractedText,
    })
    .select()
    .single();

  if (error) console.error('[agentService] saveAgentFile error:', error);
  return data || null;
}

export async function deleteAgentFile(fileId: string, storagePath: string): Promise<void> {
  await supabase.storage.from('agente-arquivos').remove([storagePath]);
  await (supabase as any)
    .schema('saas')
    .from('agente_arquivos')
    .delete()
    .eq('id', fileId);
}

// ─── Helper: build tree structure from flat array ────────────────────────────
export function buildAgentTree(agents: AgentNode[]): {
  gerente: AgentNode | null;
  classificador: AgentNode | null;
  avaliadores: AgentNode[];
} {
  const gerente = agents.find(a => a.tipo === 'gerente') || null;
  const classificador = agents.find(a => a.tipo === 'classificador') || null;
  const avaliadores = agents.filter(a => a.tipo === 'avaliador').sort((a, b) => a.ordem - b.ordem);
  return { gerente, classificador, avaliadores };
}
