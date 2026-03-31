/**
 * CRM Types — Smart Deal Coach
 * Mapeamento das tabelas saas.crm_* para TypeScript
 */

// Object type IDs (padrão HubSpot)
export const CRM_OBJECT_TYPES = {
  contact: '0-1',
  company: '0-2',
  deal: '0-3',
  ticket: '0-4',
} as const;

export type CrmObjectType = 'contact' | 'company' | 'deal' | 'ticket';

// ========================
// Contatos (0-1)
// ========================
export type ContactStatus = 'lead' | 'qualified' | 'customer' | 'churned';
export type ContactSource = 'website' | 'linkedin' | 'referencia' | 'campanha' | 'whatsapp' | 'email' | 'telefone' | 'evento' | 'importacao' | 'outros';

export interface CrmContact {
  id: string;
  numero_registro: string;
  empresa_id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  cargo: string | null;
  avatar_url: string | null;
  status: ContactStatus;
  fonte: ContactSource | null;
  score: number;
  tags: string[];
  proprietario_id: string | null;
  proprietario_nome?: string;
  dados_custom: Record<string, unknown>;
  ultima_atividade_em: string | null;
  criado_em: string;
  atualizado_em: string;
  deletado_em: string | null;
}

// ========================
// Empresas (0-2)
// ========================
export interface CrmCompany {
  id: string;
  numero_registro: string;
  empresa_id: string;
  nome: string;
  dominio: string | null;
  cnpj: string | null;
  telefone: string | null;
  website: string | null;
  logo_url: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  pais: string;
  cep: string | null;
  setor: string | null;
  porte: string | null;
  plataforma: string | null;
  tags: string[];
  proprietario_id: string | null;
  proprietario_nome?: string;
  empresa_pai_id: string | null;
  dados_custom: Record<string, unknown>;
  ultima_atividade_em: string | null;
  criado_em: string;
  atualizado_em: string;
  deletado_em: string | null;
}

// ========================
// Negócios/Deals (0-3)
// ========================
export type DealStatus = 'aberto' | 'ganho' | 'perdido';

export interface CrmDeal {
  id: string;
  numero_registro: string;
  empresa_id: string;
  nome: string;
  valor: number;
  moeda: string;
  pipeline_id: string | null;
  estagio_id: string | null;
  probabilidade: number;
  status: DealStatus;
  motivo_perda: string | null;
  data_fechamento_prevista: string | null;
  data_fechamento: string | null;
  proprietario_id: string | null;
  proprietario_nome?: string;
  plataforma: string | null;
  tags: string[];
  dados_custom: Record<string, unknown>;
  ultima_atividade_em: string | null;
  criado_em: string;
  atualizado_em: string;
  deletado_em: string | null;
}

// ========================
// Tickets (0-4)
// ========================
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketStatus = 'aberto' | 'em_andamento' | 'aguardando' | 'resolvido' | 'fechado';

export interface CrmTicket {
  id: string;
  numero_registro: string;
  empresa_id: string;
  titulo: string;
  descricao: string | null;
  pipeline_id: string | null;
  estagio_id: string | null;
  prioridade: TicketPriority;
  status: TicketStatus;
  categoria: string | null;
  plataforma: string | null;
  tags: string[];
  proprietario_id: string | null;
  proprietario_nome?: string;
  sla_minutos: number | null;
  primeira_resposta_em: string | null;
  dados_custom: Record<string, unknown>;
  ultima_atividade_em: string | null;
  resolvido_em: string | null;
  criado_em: string;
  atualizado_em: string;
  deletado_em: string | null;
}

// ========================
// Pipelines & Estágios
// ========================
export interface CrmPipeline {
  id: string;
  empresa_id: string;
  registro_id: string;
  nome: string;
  tipo: 'deal' | 'ticket';
  ativo: boolean;
  ordem: number;
  estagios?: CrmPipelineStage[];
  criado_em: string;
  atualizado_em: string;
}

export interface CrmPipelineStage {
  id: string;
  pipeline_id: string;
  nome: string;
  cor: string;
  ordem: number;
  probabilidade: number;
  criado_em: string;
  atualizado_em: string;
}

// ========================
// Associações
// ========================
export interface CrmAssociation {
  id: string;
  empresa_id: string;
  origem_tipo: CrmObjectType;
  origem_id: string;
  destino_tipo: CrmObjectType;
  destino_id: string;
  tipo_associacao: string;
  criado_por: string | null;
  criado_em: string;
}

// ========================
// Notas
// ========================
export interface CrmNote {
  id: string;
  empresa_id: string;
  entidade_tipo: CrmObjectType;
  entidade_id: string;
  conteudo: string;
  criado_por: string | null;
  criado_em: string;
  atualizado_em: string;
}

// ========================
// Histórico de Estágios
// ========================
export interface CrmStageHistory {
  id: string;
  empresa_id: string;
  entidade_tipo: 'deal' | 'ticket';
  entidade_id: string;
  estagio_anterior_id: string | null;
  estagio_novo_id: string | null;
  realizado_por: string | null;
  criado_em: string;
}

// ========================
// Atividades (unificado)
// ========================
export type ActivityType = 'nota' | 'email' | 'chamada' | 'tarefa' | 'reuniao' | 'whatsapp' | 'sms' | 'linkedin';
export type TaskStatus = 'pendente' | 'em_andamento' | 'concluida' | 'cancelada';

export interface CrmActivity {
  id: string;
  empresa_id: string;
  tipo: ActivityType;
  titulo: string | null;
  conteudo: string | null;
  // Email
  email_para: string | null;
  email_de: string | null;
  email_cc: string | null;
  email_assunto: string | null;
  // Chamada
  chamada_duracao: number | null;
  chamada_resultado: string | null;
  chamada_direcao: string | null;
  // Tarefa
  tarefa_status: TaskStatus | null;
  tarefa_prioridade: string | null;
  tarefa_tipo: string | null;
  tarefa_fila: string | null;
  tarefa_data_vencimento: string | null;
  tarefa_lembrete: string | null;
  tarefa_repetir: boolean;
  // Reunião
  reuniao_inicio: string | null;
  reuniao_fim: string | null;
  reuniao_tipo: string | null;
  reuniao_localizacao: string | null;
  reuniao_participantes: { nome: string; email: string }[];
  reuniao_lembretes: { valor: number; unidade: string }[];
  // Proprietário
  criado_por: string | null;
  criado_por_nome?: string;
  atribuido_para: string | null;
  atribuido_para_nome?: string;
  // Associações
  contato_ids: string[];
  empresa_crm_ids: string[];
  negocio_ids: string[];
  ticket_ids: string[];
  // Timestamps
  data_atividade: string;
  criado_em: string;
  atualizado_em: string;
}

// ========================
// Filters & Pagination
// ========================
export interface CrmListParams {
  search?: string;
  status?: string;
  proprietario_id?: string;
  pipeline_id?: string;
  estagio_id?: string;
  tags?: string[];
  page?: number;
  perPage?: number;
  orderBy?: string;
  orderDir?: 'asc' | 'desc';
}

export interface CrmListResult<T> {
  data: T[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}
