/**
 * CRM React Query Hooks — Smart Deal Coach
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as crm from '@/lib/crmService';
import type { CrmListParams, CrmObjectType, ActivityType } from '@/types/crm';

// ========================
// Contatos
// ========================
export function useCrmContacts(params: CrmListParams = {}) {
  return useQuery({
    queryKey: ['crm.contacts', params],
    queryFn: () => crm.listContacts(params),
    staleTime: 60_000,
  });
}

export function useCrmContact(numero: string) {
  return useQuery({
    queryKey: ['crm.contact', numero],
    queryFn: () => crm.getContactByNumero(numero),
    enabled: !!numero,
  });
}

export function useCreateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: crm.createContact,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm.contacts'] }),
  });
}

export function useUpdateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) => crm.updateContact(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm.contacts'] });
      qc.invalidateQueries({ queryKey: ['crm.contact'] });
    },
  });
}

export function useDeleteContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: crm.deleteContact,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm.contacts'] }),
  });
}

// ========================
// Empresas
// ========================
export function useCrmCompanies(params: CrmListParams = {}) {
  return useQuery({
    queryKey: ['crm.companies', params],
    queryFn: () => crm.listCompanies(params),
    staleTime: 60_000,
  });
}

export function useCrmCompany(numero: string) {
  return useQuery({
    queryKey: ['crm.company', numero],
    queryFn: () => crm.getCompanyByNumero(numero),
    enabled: !!numero,
  });
}

export function useCreateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: crm.createCompany,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm.companies'] }),
  });
}

export function useUpdateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) => crm.updateCompany(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm.companies'] });
      qc.invalidateQueries({ queryKey: ['crm.company'] });
    },
  });
}

export function useDeleteCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: crm.deleteCompany,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm.companies'] }),
  });
}

// ========================
// Negócios
// ========================
export function useCrmDeals(params: CrmListParams = {}) {
  return useQuery({
    queryKey: ['crm.deals', params],
    queryFn: () => crm.listDeals(params),
    staleTime: 60_000,
  });
}

export function useCrmDealsByPipeline(pipelineId: string) {
  return useQuery({
    queryKey: ['crm.deals.pipeline', pipelineId],
    queryFn: () => crm.getDealsByPipeline(pipelineId),
    enabled: !!pipelineId,
    staleTime: 30_000,
  });
}

export function useCrmDeal(numero: string) {
  return useQuery({
    queryKey: ['crm.deal', numero],
    queryFn: () => crm.getDealByNumero(numero),
    enabled: !!numero,
  });
}

export function useCreateDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: crm.createDeal,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm.deals'] });
    },
  });
}

export function useUpdateDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) => crm.updateDeal(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm.deals'] });
      qc.invalidateQueries({ queryKey: ['crm.deals.pipeline'] });
      qc.invalidateQueries({ queryKey: ['crm.deal'] });
    },
  });
}

export function useDeleteDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: crm.deleteDeal,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm.deals'] }),
  });
}

// ========================
// Tickets
// ========================
export function useCrmTickets(params: CrmListParams = {}) {
  return useQuery({
    queryKey: ['crm.tickets', params],
    queryFn: () => crm.listTickets(params),
    staleTime: 60_000,
  });
}

export function useCrmTicketsByPipeline(pipelineId: string) {
  return useQuery({
    queryKey: ['crm.tickets.pipeline', pipelineId],
    queryFn: () => crm.getTicketsByPipeline(pipelineId),
    enabled: !!pipelineId,
    staleTime: 30_000,
  });
}

export function useCrmTicket(numero: string) {
  return useQuery({
    queryKey: ['crm.ticket', numero],
    queryFn: () => crm.getTicketByNumero(numero),
    enabled: !!numero,
  });
}

export function useCreateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: crm.createTicket,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm.tickets'] }),
  });
}

export function useUpdateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) => crm.updateTicket(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm.tickets'] });
      qc.invalidateQueries({ queryKey: ['crm.tickets.pipeline'] });
      qc.invalidateQueries({ queryKey: ['crm.ticket'] });
    },
  });
}

export function useDeleteTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: crm.deleteTicket,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm.tickets'] }),
  });
}

// ========================
// Pipelines
// ========================
export function useCrmPipelines(tipo: 'deal' | 'ticket') {
  return useQuery({
    queryKey: ['crm.pipelines', tipo],
    queryFn: async () => {
      await crm.ensureDefaultPipelines(tipo);
      return crm.listPipelines(tipo);
    },
    staleTime: 5 * 60_000,
  });
}

export function useCreatePipeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: crm.createPipeline,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm.pipelines'] }),
  });
}

// ========================
// Associações
// ========================
export function useCrmAssociations(tipo: CrmObjectType, id: string) {
  return useQuery({
    queryKey: ['crm.associations', tipo, id],
    queryFn: () => crm.listAssociations(tipo, id),
    enabled: !!id,
  });
}

export function useCreateAssociation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: crm.createAssociation,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm.associations'] });
      qc.invalidateQueries({ queryKey: ['crm.associated'] });
    },
  });
}

// ========================
// Notas
// ========================
export function useCrmNotes(tipo: CrmObjectType, id: string) {
  return useQuery({
    queryKey: ['crm.notes', tipo, id],
    queryFn: () => crm.listNotes(tipo, id),
    enabled: !!id,
  });
}

export function useCreateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: crm.createNote,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm.notes'] }),
  });
}

// ========================
// Atividades
// ========================
export function useCrmActivities(objectType: CrmObjectType, objectId: string, filterType?: ActivityType) {
  return useQuery({
    queryKey: ['crm.activities', objectType, objectId, filterType],
    queryFn: () => crm.listActivities(objectType, objectId, filterType),
    enabled: !!objectId,
    staleTime: 30_000,
  });
}

export function useCreateActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: crm.createActivity,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm.activities'] }),
  });
}

export function useUpdateActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) => crm.updateActivity(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm.activities'] }),
  });
}

export function useDeleteActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: crm.deleteActivity,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm.activities'] }),
  });
}

// ========================
// Record by numero (any type)
// ========================
export function useCrmRecord(objectType: CrmObjectType, numero: string) {
  return useQuery({
    queryKey: ['crm.record', objectType, numero],
    queryFn: () => crm.getRecordByNumero(objectType, numero),
    enabled: !!numero && !!objectType,
  });
}

// ========================
// Associated records detail
// ========================
export function useCrmAssociatedRecords(objectType: CrmObjectType, objectId: string) {
  return useQuery({
    queryKey: ['crm.associated', objectType, objectId],
    queryFn: () => crm.getAssociatedRecords(objectType, objectId),
    enabled: !!objectId,
    staleTime: 30_000,
  });
}

export function useDeleteAssociation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: crm.deleteAssociation,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm.associations'] });
      qc.invalidateQueries({ queryKey: ['crm.associated'] });
    },
  });
}

// ========================
// Usuários do sistema (proprietários)
// ========================
export function useSaasUsers() {
  return useQuery({
    queryKey: ['saas.users'],
    queryFn: () => crm.listSaasUsers(),
    staleTime: 5 * 60_000,
  });
}

// ========================
// Tarefas CRM
// ========================

export function useCrmTasks() {
  return useQuery({
    queryKey: ['crm.tasks'],
    queryFn: () => crm.listTasks(),
    staleTime: 30_000,
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<crm.CrmTask>) => crm.createTask(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm.tasks'] }),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & Partial<crm.CrmTask>) => crm.updateTask(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm.tasks'] }),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => crm.deleteTask(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm.tasks'] }),
  });
}
