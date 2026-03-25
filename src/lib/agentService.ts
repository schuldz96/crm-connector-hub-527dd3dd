/**
 * Service for managing AI agent hierarchy (gerente → classificador → avaliadores).
 * Each agent has its own prompt, criteria, and optional reference files.
 */
import { supabase } from '@/integrations/supabase/client';
import { getSaasEmpresaId } from '@/lib/saas';
import type { EvalCriteria } from '@/pages/AIConfigPage';

// ─── Types ───────────────────────────────────────────────────────────────────
export type AgentTipo = 'gerente' | 'classificador' | 'avaliador' | 'sentimental';

export type AgentModulo = 'meetings' | 'whatsapp';

export interface AgentNode {
  id: string;
  empresa_id: string;
  parent_id: string | null;
  modulo: AgentModulo;
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

// ─── Load full agent tree for current empresa (filtered by modulo) ───────────
export async function loadAgentTree(modulo: AgentModulo = 'meetings'): Promise<AgentNode[]> {
  const empresaId = await getSaasEmpresaId();
  const { data, error } = await (supabase as any)
    .schema('saas')
    .from('agentes_ia')
    .select('*')
    .eq('empresa_id', empresaId)
    .eq('modulo', modulo)
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
export async function initializeAgentTree(modulo: AgentModulo = 'meetings'): Promise<AgentNode[]> {
  const empresaId = await getSaasEmpresaId();

  const isMeetings = modulo === 'meetings';
  const gerenteDesc = isMeetings
    ? 'Agente orquestrador que coordena a avaliação das reuniões'
    : 'Agente orquestrador que coordena a avaliação das conversas WhatsApp';
  const gerentePrompt = isMeetings
    ? 'Você é o gerente de avaliação de reuniões. Seu papel é coordenar os agentes especializados para avaliar cada reunião de forma precisa e consistente.'
    : 'Você é o gerente de avaliação de conversas WhatsApp. Seu papel é coordenar os agentes especializados para avaliar cada conversa de forma precisa e consistente.';
  const classDesc = isMeetings
    ? 'Identifica o tipo da reunião para direcionar ao avaliador correto'
    : 'Identifica o tipo da conversa para direcionar ao avaliador correto';
  const classPrompt = isMeetings
    ? 'Você é um classificador de reuniões. Analise o título e o início da transcrição para identificar o tipo da reunião. Retorne APENAS JSON: {"tipo": "<nome exato do tipo>", "confianca": <0-100>}'
    : 'Você é um classificador de conversas WhatsApp. Analise as primeiras mensagens para identificar o tipo da conversa (prospecção, qualificação, follow-up, suporte, etc). Retorne APENAS JSON: {"tipo": "<nome exato do tipo>", "confianca": <0-100>}';

  // Create Gerente
  const { data: gerente } = await (supabase as any)
    .schema('saas')
    .from('agentes_ia')
    .insert({
      empresa_id: empresaId,
      modulo,
      tipo: 'gerente',
      nome: 'Gerente',
      descricao: gerenteDesc,
      prompt_sistema: gerentePrompt,
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
      modulo,
      parent_id: gerente.id,
      tipo: 'classificador',
      nome: 'Classificador',
      descricao: classDesc,
      prompt_sistema: classPrompt,
      ordem: 0,
    })
    .select()
    .single();

  if (!classificador) return [gerente];

  // Create one default avaliador
  const avaliadorConfig = isMeetings
    ? {
        nome: '[Closer In] Apresentação',
        descricao: 'Avalia reuniões de apresentação de vendas (closer inbound)',
        prompt: 'Você é um avaliador especialista em vendas consultivas. Analise a transcrição da reunião e avalie cada critério com base nos sinais identificados. Seja específico e construtivo nos feedbacks.',
      }
    : {
        nome: '[WhatsApp] Atendimento Comercial',
        descricao: 'Avalia conversas de prospecção e qualificação via WhatsApp',
        prompt: 'Você é um especialista em vendas digitais e atendimento via WhatsApp. Avalie as conversas com foco em efetividade comercial, qualificação de leads e conversão. Seja específico e construtivo.',
      };

  const avaliadorCriteria = isMeetings
    ? [
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
      ]
    : [
        {
          id: 'response_time', label: 'Tempo de Resposta', weight: 15,
          description: 'Velocidade e consistência nas respostas ao lead',
          examples: ['Responder em menos de 5 min', 'Manter cadência constante'],
          positiveSignals: ['Respostas rápidas e relevantes'],
          negativeSignals: ['Horas sem resposta', 'Lead precisou cobrar'],
        },
        {
          id: 'engagement', label: 'Engajamento', weight: 25,
          description: 'Capacidade de manter o lead engajado na conversa',
          examples: ['Perguntas abertas', 'Conteúdo de valor', 'Personalização'],
          positiveSignals: ['Lead responde com detalhes', 'Faz perguntas espontâneas'],
          negativeSignals: ['Respostas monossilábicas', 'Lead some da conversa'],
        },
        {
          id: 'qualification', label: 'Qualificação', weight: 25,
          description: 'Identificação de perfil, budget, timing e autoridade',
          examples: ['Perguntar sobre decisão', 'Mapear necessidade', 'Entender budget'],
          positiveSignals: ['Lead compartilha informações de negócio'],
          negativeSignals: ['Nenhuma pergunta de qualificação'],
        },
        {
          id: 'cta', label: 'CTA e Next Steps', weight: 20,
          description: 'Clareza nas chamadas para ação e próximos passos',
          examples: ['Agendar call', 'Enviar proposta', 'Definir data'],
          positiveSignals: ['Próximo passo definido com data'],
          negativeSignals: ['Conversa morre sem CTA'],
        },
        {
          id: 'tone', label: 'Tom e Linguagem', weight: 15,
          description: 'Adequação do vocabulário, tom profissional e empatia',
          examples: ['Tom consultivo', 'Sem erros gramaticais', 'Empático'],
          positiveSignals: ['Lead elogia atendimento'],
          negativeSignals: ['Tom robótico', 'Erros frequentes', 'Agressividade'],
        },
      ];

  const { data: avaliador } = await (supabase as any)
    .schema('saas')
    .from('agentes_ia')
    .insert({
      empresa_id: empresaId,
      modulo,
      parent_id: classificador.id,
      tipo: 'avaliador',
      nome: avaliadorConfig.nome,
      descricao: avaliadorConfig.descricao,
      prompt_sistema: avaliadorConfig.prompt,
      criterios: JSON.parse(JSON.stringify(avaliadorCriteria)),
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
  sentimentais: AgentNode[];
} {
  const gerente = agents.find(a => a.tipo === 'gerente') || null;
  const classificador = agents.find(a => a.tipo === 'classificador') || null;
  const avaliadores = agents.filter(a => a.tipo === 'avaliador').sort((a, b) => a.ordem - b.ordem);
  const sentimentais = agents.filter(a => a.tipo === 'sentimental').sort((a, b) => a.ordem - b.ordem);
  return { gerente, classificador, avaliadores, sentimentais };
}
