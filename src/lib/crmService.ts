/**
 * CRM Service — Smart Deal Coach
 * Operações CRUD para contatos, empresas, negócios, tickets, pipelines e associações
 */
import { supabase } from '@/integrations/supabase/client';
import { getOrg, getOrgAndEmpresaId } from '@/lib/saas';
import type {
  CrmContact, CrmCompany, CrmDeal, CrmTicket,
  CrmPipeline, CrmPipelineStage, CrmAssociation, CrmNote,
  CrmActivity, ActivityType, CrmListParams, CrmListResult, CrmObjectType,
} from '@/types/crm';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const crm = () => (supabase as any).schema('crm');

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://lwusznsduxcqjjmbbobt.supabase.co';

/** Fire-and-forget: trigger CRM AI for stage events */
export function triggerCrmAI(entidadeTipo: 'deal' | 'ticket', entidadeId: string, estagioId: string, empresaId: string, evento: 'create' | 'move') {
  fetch(`${SUPABASE_URL}/functions/v1/crm-ai-trigger`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entidade_tipo: entidadeTipo, entidade_id: entidadeId, estagio_id: estagioId, empresa_id: empresaId, evento }),
  }).catch(e => console.warn('[crm-ai-trigger]', e.message));
}

// ========================
// Helper: Build paginated query
// ========================
function applyListParams(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  params: CrmListParams,
  searchColumns: string[] = ['nome'],
) {
  const { search, status, proprietario_id, pipeline_id, estagio_id, tags, orderBy, orderDir } = params;

  // Soft delete filter
  query = query.is('deletado_em', null);

  if (search && searchColumns.length > 0) {
    const or = searchColumns.map(col => `${col}.ilike.%${search}%`).join(',');
    query = query.or(or);
  }
  if (status) query = query.eq('status', status);
  if (proprietario_id) query = query.eq('proprietario_id', proprietario_id);
  if (pipeline_id) query = query.eq('pipeline_id', pipeline_id);
  if (estagio_id) query = query.eq('estagio_id', estagio_id);
  if (tags && tags.length > 0) query = query.overlaps('tags', tags);
  query = query.order(orderBy || 'criado_em', { ascending: (orderDir || 'desc') === 'asc' });

  return query;
}

async function paginatedQuery<T>(
  table: string,
  params: CrmListParams,
  searchColumns: string[] = ['nome'],
): Promise<CrmListResult<T>> {
  const org = await getOrg();
  const page = params.page || 1;
  const perPage = params.perPage || 25;
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  // Count total
  let countQuery = crm().from(table).select('id', { count: 'exact', head: true }).eq('org', org);
  countQuery = applyListParams(countQuery, params, searchColumns);
  const { count } = await countQuery;

  // Fetch page
  let dataQuery = crm().from(table).select('*').eq('org', org).range(from, to);
  dataQuery = applyListParams(dataQuery, params, searchColumns);
  const { data, error } = await dataQuery;

  if (error) throw error;

  const total = count || 0;
  return {
    data: (data || []) as T[],
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
  };
}

// ========================
// CONTATOS (0-1)
// ========================
export async function listContacts(params: CrmListParams = {}): Promise<CrmListResult<CrmContact>> {
  return paginatedQuery<CrmContact>('contatos', params, ['nome', 'email', 'telefone']);
}

export async function getContactByNumero(numero: string): Promise<CrmContact | null> {
  const { data, error } = await crm().from('contatos').select('*').eq('numero_registro', numero).is('deletado_em', null).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createContact(input: Partial<CrmContact>): Promise<CrmContact> {
  const { org, empresaId } = await getOrgAndEmpresaId();
  const { data, error } = await crm().from('contatos').insert({ ...input, empresa_id: empresaId, org }).select().single();
  if (error) throw error;
  return data;
}

export async function updateContact(id: string, input: Partial<CrmContact>): Promise<CrmContact> {
  const { data, error } = await crm().from('contatos').update(input).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteContact(id: string): Promise<void> {
  const { error } = await crm().from('contatos').update({ deletado_em: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

// ========================
// EMPRESAS (0-2)
// ========================
export async function listCompanies(params: CrmListParams = {}): Promise<CrmListResult<CrmCompany>> {
  return paginatedQuery<CrmCompany>('empresas_crm', params, ['nome', 'dominio', 'cnpj']);
}

export async function getCompanyByNumero(numero: string): Promise<CrmCompany | null> {
  const { data, error } = await crm().from('empresas_crm').select('*').eq('numero_registro', numero).is('deletado_em', null).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createCompany(input: Partial<CrmCompany>): Promise<CrmCompany> {
  const { org, empresaId } = await getOrgAndEmpresaId();
  const { data, error } = await crm().from('empresas_crm').insert({ ...input, empresa_id: empresaId, org }).select().single();
  if (error) throw error;
  return data;
}

export async function updateCompany(id: string, input: Partial<CrmCompany>): Promise<CrmCompany> {
  const { data, error } = await crm().from('empresas_crm').update(input).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteCompany(id: string): Promise<void> {
  const { error } = await crm().from('empresas_crm').update({ deletado_em: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

// ========================
// NEGÓCIOS (0-3)
// ========================
export async function listDeals(params: CrmListParams = {}): Promise<CrmListResult<CrmDeal>> {
  return paginatedQuery<CrmDeal>('negocios', params, ['nome']);
}

export async function getDealsByPipeline(pipelineId: string): Promise<CrmDeal[]> {
  const org = await getOrg();
  const { data, error } = await crm()
    .from('negocios')
    .select('*')
    .eq('org', org)
    .eq('pipeline_id', pipelineId)
    .is('deletado_em', null)
    .order('criado_em', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getDealByNumero(numero: string): Promise<CrmDeal | null> {
  const { data, error } = await crm().from('negocios').select('*').eq('numero_registro', numero).is('deletado_em', null).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createDeal(input: Partial<CrmDeal>): Promise<CrmDeal> {
  const { org, empresaId } = await getOrgAndEmpresaId();
  const { data, error } = await crm().from('negocios').insert({ ...input, empresa_id: empresaId, org }).select().single();
  if (error) throw error;
  return data;
}

export async function updateDeal(id: string, input: Partial<CrmDeal>): Promise<CrmDeal> {
  const { data, error } = await crm().from('negocios').update(input).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteDeal(id: string): Promise<void> {
  const { error } = await crm().from('negocios').update({ deletado_em: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

// ========================
// TICKETS (0-4)
// ========================
export async function listTickets(params: CrmListParams = {}): Promise<CrmListResult<CrmTicket>> {
  return paginatedQuery<CrmTicket>('tickets', params, ['titulo']);
}

export async function getTicketsByPipeline(pipelineId: string): Promise<CrmTicket[]> {
  const org = await getOrg();
  const { data, error } = await crm()
    .from('tickets')
    .select('*')
    .eq('org', org)
    .eq('pipeline_id', pipelineId)
    .is('deletado_em', null)
    .order('criado_em', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getTicketByNumero(numero: string): Promise<CrmTicket | null> {
  const { data, error } = await crm().from('tickets').select('*').eq('numero_registro', numero).is('deletado_em', null).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createTicket(input: Partial<CrmTicket>): Promise<CrmTicket> {
  const { org, empresaId } = await getOrgAndEmpresaId();
  const { data, error } = await crm().from('tickets').insert({ ...input, empresa_id: empresaId, org }).select().single();
  if (error) throw error;
  return data;
}

export async function updateTicket(id: string, input: Partial<CrmTicket>): Promise<CrmTicket> {
  const { data, error } = await crm().from('tickets').update(input).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteTicket(id: string): Promise<void> {
  const { error } = await crm().from('tickets').update({ deletado_em: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

// ========================
// PIPELINES
// ========================
export async function listPipelines(tipo: 'deal' | 'ticket'): Promise<CrmPipeline[]> {
  const org = await getOrg();
  const { data, error } = await crm()
    .from('pipelines')
    .select('*, estagios:pipeline_estagios(*)')
    .eq('org', org)
    .eq('tipo', tipo)
    .eq('ativo', true)
    .order('ordem', { ascending: true });
  if (error) throw error;
  // Sort stages by ordem
  return (data || []).map((p: CrmPipeline & { estagios: CrmPipelineStage[] }) => ({
    ...p,
    estagios: (p.estagios || []).sort((a: CrmPipelineStage, b: CrmPipelineStage) => a.ordem - b.ordem),
  }));
}

export async function createPipeline(input: { nome: string; tipo: 'deal' | 'ticket'; estagios: { nome: string; cor: string; probabilidade?: number }[] }): Promise<CrmPipeline> {
  const { org, empresaId } = await getOrgAndEmpresaId();
  const { data: pipeline, error } = await crm()
    .from('pipelines')
    .insert({ nome: input.nome, tipo: input.tipo, empresa_id: empresaId, org })
    .select()
    .single();
  if (error) throw error;

  if (input.estagios.length > 0) {
    const stages = input.estagios.map((s, i) => ({
      pipeline_id: pipeline.id,
      nome: s.nome,
      cor: s.cor,
      probabilidade: s.probabilidade || 0,
      ordem: i,
    }));
    const { error: stErr } = await crm().from('pipeline_estagios').insert(stages);
    if (stErr) throw stErr;
  }

  return pipeline;
}

// ========================
// ASSOCIAÇÕES
// ========================
export async function listAssociations(tipo: CrmObjectType, id: string): Promise<CrmAssociation[]> {
  const org = await getOrg();
  const { data, error } = await crm()
    .from('associacoes')
    .select('*')
    .eq('org', org)
    .or(`and(origem_tipo.eq.${tipo},origem_id.eq.${id}),and(destino_tipo.eq.${tipo},destino_id.eq.${id})`);
  if (error) throw error;
  return data || [];
}

export async function createAssociation(input: {
  origem_tipo: CrmObjectType;
  origem_id: string;
  destino_tipo: CrmObjectType;
  destino_id: string;
  tipo_associacao?: string;
}): Promise<CrmAssociation> {
  const { org, empresaId } = await getOrgAndEmpresaId();
  const { data, error } = await crm()
    .from('associacoes')
    .insert({ ...input, empresa_id: empresaId, org, tipo_associacao: input.tipo_associacao || 'default' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteAssociation(id: string): Promise<void> {
  const { error } = await crm().from('associacoes').delete().eq('id', id);
  if (error) throw error;
}

// ========================
// NOTAS
// ========================
export async function listNotes(entidadeTipo: CrmObjectType, entidadeId: string): Promise<CrmNote[]> {
  const org = await getOrg();
  const { data, error } = await crm()
    .from('notas')
    .select('*')
    .eq('org', org)
    .eq('entidade_tipo', entidadeTipo)
    .eq('entidade_id', entidadeId)
    .order('criado_em', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createNote(input: { entidade_tipo: CrmObjectType; entidade_id: string; conteudo: string }): Promise<CrmNote> {
  const { org, empresaId } = await getOrgAndEmpresaId();
  const { data, error } = await crm()
    .from('notas')
    .insert({ ...input, empresa_id: empresaId, org })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ========================
// ATIVIDADES (unificado)
// ========================
export async function listActivities(
  objectType: CrmObjectType,
  objectId: string,
  filterType?: ActivityType,
): Promise<CrmActivity[]> {
  const org = await getOrg();
  const col = objectType === 'contact' ? 'contato_ids'
    : objectType === 'company' ? 'empresa_crm_ids'
    : objectType === 'deal' ? 'negocio_ids'
    : 'ticket_ids';

  let q = crm()
    .from('atividades')
    .select('*')
    .eq('org', org)
    .contains(col, [objectId])
    .order('data_atividade', { ascending: false })
    .limit(100);

  if (filterType) q = q.eq('tipo', filterType);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function createActivity(input: Partial<CrmActivity>): Promise<CrmActivity> {
  const { org, empresaId } = await getOrgAndEmpresaId();
  const { data, error } = await crm()
    .from('atividades')
    .insert({ ...input, empresa_id: empresaId, org })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateActivity(id: string, input: Partial<CrmActivity>): Promise<CrmActivity> {
  const { data, error } = await crm()
    .from('atividades')
    .update(input)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteActivity(id: string): Promise<void> {
  const { error } = await crm().from('atividades').delete().eq('id', id);
  if (error) throw error;
}

// ========================
// FETCH RECORD BY NUMERO (any type)
// ========================
export async function getRecordByNumero(objectType: CrmObjectType, numero: string) {
  const table = objectType === 'contact' ? 'contatos'
    : objectType === 'company' ? 'empresas_crm'
    : objectType === 'deal' ? 'negocios'
    : 'tickets';
  const { data, error } = await crm()
    .from(table)
    .select('*')
    .eq('numero_registro', numero)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ========================
// ASSOCIATED RECORDS DETAIL
// ========================
export async function getAssociatedRecords(objectType: CrmObjectType, objectId: string) {
  const associations = await listAssociations(objectType, objectId);
  const grouped: Record<CrmObjectType, { id: string; assocId: string; tipo_associacao: string }[]> = {
    contact: [], company: [], deal: [], ticket: [],
  };

  for (const a of associations) {
    if (a.origem_tipo === objectType && a.origem_id === objectId) {
      grouped[a.destino_tipo as CrmObjectType].push({ id: a.destino_id, assocId: a.id, tipo_associacao: a.tipo_associacao });
    } else {
      grouped[a.origem_tipo as CrmObjectType].push({ id: a.origem_id, assocId: a.id, tipo_associacao: a.tipo_associacao });
    }
  }

  const fetchMany = async (table: string, ids: string[]) => {
    if (ids.length === 0) return [];
    const { data } = await crm().from(table).select('*').in('id', ids);
    return data || [];
  };

  const [contacts, companies, deals, tickets] = await Promise.all([
    fetchMany('contatos', grouped.contact.map(r => r.id)),
    fetchMany('empresas_crm', grouped.company.map(r => r.id)),
    fetchMany('negocios', grouped.deal.map(r => r.id)),
    fetchMany('tickets', grouped.ticket.map(r => r.id)),
  ]);

  return { contacts, companies, deals, tickets, associations: grouped };
}

// ========================
// USUÁRIOS DO SISTEMA (para selects de proprietário)
// ========================
export interface SaasUser {
  id: string;
  nome: string;
  email: string;
  papel: string;
}

export async function listSaasUsers(): Promise<SaasUser[]> {
  const org = await getOrg();
  const { data, error } = await (supabase as any)
    .schema('core')
    .from('usuarios')
    .select('id, nome, email, papel')
    .eq('org', org)
    .order('nome', { ascending: true });
  if (error) throw error;
  return data || [];
}
