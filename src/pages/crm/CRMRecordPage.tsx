import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  useCrmRecord, useCrmActivities, useCrmAssociatedRecords,
  useCreateActivity, useCreateAssociation, useDeleteAssociation,
  useCrmContacts, useCrmCompanies, useCrmDeals, useCrmTickets,
  useCreateContact, useCreateCompany, useCreateDeal, useCreateTicket,
  useCrmPipelines, useSaasUsers,
} from '@/hooks/useCrm';
import type { CrmObjectType, ActivityType, CrmActivity } from '@/types/crm';
import {
  ArrowLeft, Pencil, StickyNote, Mail, Phone, CalendarDays, CheckSquare,
  MoreHorizontal, Plus, Settings, ChevronDown, Copy, Building2, User,
  Briefcase, Ticket, Clock, MapPin, Users, Eye, Trash2, GitMerge,
  History, Shield, Star, Sparkles, RefreshCw, Loader2, X,
  MessageSquare, Linkedin, Send,
} from 'lucide-react';

// ========================
// Constants
// ========================

const OBJECT_TYPE_MAP: Record<string, CrmObjectType> = {
  '0-1': 'contact',
  '0-2': 'company',
  '0-3': 'deal',
  '0-4': 'ticket',
};

const OBJECT_LABELS: Record<CrmObjectType, { singular: string; plural: string; back: string }> = {
  contact: { singular: 'Contato', plural: 'Contatos', back: 'Contatos' },
  company: { singular: 'Empresa', plural: 'Empresas', back: 'Empresas' },
  deal: { singular: 'Negócio', plural: 'Negócios', back: 'Negócios' },
  ticket: { singular: 'Ticket', plural: 'Tickets', back: 'Tickets' },
};

const ACTIVITY_TABS: { id: ActivityType | 'all'; label: string }[] = [
  { id: 'all', label: 'Todas as atividades' },
  { id: 'nota', label: 'Observações' },
  { id: 'email', label: 'E-mails' },
  { id: 'chamada', label: 'Chamadas' },
  { id: 'tarefa', label: 'Tarefas' },
  { id: 'reuniao', label: 'Reuniões' },
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Baixa' },
  { value: 'medium', label: 'Média' },
  { value: 'high', label: 'Alta' },
  { value: 'urgent', label: 'Urgente' },
];

const CALL_OUTCOMES = [
  { value: 'connected', label: 'Conectado' },
  { value: 'busy', label: 'Ocupado' },
  { value: 'no_answer', label: 'Sem resposta' },
  { value: 'left_voicemail', label: 'Deixou recado' },
  { value: 'wrong_number', label: 'Número errado' },
];

const MEETING_TYPES = [
  { value: 'presencial', label: 'Presencial' },
  { value: 'video', label: 'Videoconferência' },
  { value: 'telefone', label: 'Telefone' },
];

type ActiveModal = 'nota' | 'email' | 'chamada' | 'tarefa' | 'reuniao' | null;

// ========================
// Helper: format date
// ========================
function formatDate(d: string | null): string {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(d: string | null): string {
  if (!d) return '-';
  return new Date(d).toLocaleString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function formatCurrency(v: number | null | undefined): string {
  if (v == null) return 'R$ 0';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

function getRecordName(record: Record<string, unknown>, objectType: CrmObjectType): string {
  if (objectType === 'ticket') return (record.titulo as string) || 'Sem título';
  return (record.nome as string) || 'Sem nome';
}

function getActivityIcon(tipo: ActivityType) {
  switch (tipo) {
    case 'nota': return <StickyNote className="w-4 h-4" />;
    case 'email': return <Mail className="w-4 h-4" />;
    case 'chamada': return <Phone className="w-4 h-4" />;
    case 'tarefa': return <CheckSquare className="w-4 h-4" />;
    case 'reuniao': return <CalendarDays className="w-4 h-4" />;
    case 'whatsapp': return <MessageSquare className="w-4 h-4" />;
    case 'linkedin': return <Linkedin className="w-4 h-4" />;
    default: return <StickyNote className="w-4 h-4" />;
  }
}

function getActivityLabel(tipo: ActivityType): string {
  const map: Record<ActivityType, string> = {
    nota: 'Observação', email: 'E-mail', chamada: 'Chamada',
    tarefa: 'Tarefa', reuniao: 'Reunião', whatsapp: 'WhatsApp',
    sms: 'SMS', linkedin: 'LinkedIn',
  };
  return map[tipo] || tipo;
}

function groupByMonth(activities: CrmActivity[]): Record<string, CrmActivity[]> {
  const groups: Record<string, CrmActivity[]> = {};
  for (const a of activities) {
    const d = new Date(a.data_atividade || a.criado_em);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    if (!groups[label]) groups[label] = [];
    groups[label].push(a);
  }
  return groups;
}

// ========================
// Main Component
// ========================
export default function CRMRecordPage() {
  const { typeId = '', numero = '' } = useParams<{ typeId: string; numero: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const objectType = OBJECT_TYPE_MAP[typeId] || 'deal';
  const labels = OBJECT_LABELS[objectType];

  // ---- State ----
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const [activeMainTab, setActiveMainTab] = useState<'overview' | 'activities'>('overview');
  const [activeActivityTab, setActiveActivityTab] = useState<ActivityType | 'all'>('all');
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [showMoreActions, setShowMoreActions] = useState(false);
  const [associationDialog, setAssociationDialog] = useState<CrmObjectType | null>(null);
  const [associationTab, setAssociationTab] = useState<'existing' | 'new'>('existing');
  const [associationSearch, setAssociationSearch] = useState('');
  const [selectedAssociationIds, setSelectedAssociationIds] = useState<string[]>([]);
  const [expandedActivity, setExpandedActivity] = useState<string | null>(null);

  // Create new in association
  const [newContactForm, setNewContactForm] = useState({ email: '', nome: '', telefone: '', cargo: '' });
  const [newCompanyForm, setNewCompanyForm] = useState({ nome: '', dominio: '', cnpj: '' });
  const [newDealForm, setNewDealForm] = useState({ nome: '', valor: '' });
  const [newTicketForm, setNewTicketForm] = useState({ titulo: '', prioridade: 'medium' });
  const [emailExists, setEmailExists] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);

  // Activity form states
  const [noteContent, setNoteContent] = useState('');
  const [emailForm, setEmailForm] = useState({ to: '', from: '', subject: '', body: '' });
  const [callForm, setCallForm] = useState({ outcome: '', duration: '', notes: '' });
  const [taskForm, setTaskForm] = useState({ title: '', date: '', priority: 'medium', notes: '' });
  const [meetingForm, setMeetingForm] = useState({
    title: '', start: '', end: '', type: 'video', location: '', participants: '',
  });

  // ---- Data fetching ----
  const { data: record, isLoading: loadingRecord } = useCrmRecord(objectType, numero);
  const recordId = (record as Record<string, unknown>)?.id as string || '';
  const filterType = activeActivityTab === 'all' ? undefined : activeActivityTab;
  const { data: activities = [], isLoading: loadingActivities } = useCrmActivities(objectType, recordId, filterType);
  const { data: associated, isLoading: loadingAssociated } = useCrmAssociatedRecords(objectType, recordId);

  // For association search
  const { data: searchContacts } = useCrmContacts({ search: associationSearch, perPage: 10 });
  const { data: searchCompanies } = useCrmCompanies({ search: associationSearch, perPage: 10 });
  const { data: searchDeals } = useCrmDeals({ search: associationSearch, perPage: 10 });
  const { data: searchTickets } = useCrmTickets({ search: associationSearch, perPage: 10 });
  const createContact = useCreateContact();
  const createCompany = useCreateCompany();
  const createDealMut = useCreateDeal();
  const createTicketMut = useCreateTicket();
  const { data: dealPipelines = [] } = useCrmPipelines('deal');
  const { data: ticketPipelines = [] } = useCrmPipelines('ticket');
  const { data: saasUsers = [] } = useSaasUsers();

  const createActivity = useCreateActivity();
  const createAssociation = useCreateAssociation();
  const deleteAssociation = useDeleteAssociation();

  // ---- Derived ----
  const rec = (record || {}) as Record<string, unknown>;
  const recordName = getRecordName(rec, objectType);

  const associatedContacts = associated?.contacts || [];
  const associatedCompanies = associated?.companies || [];
  const associatedDeals = associated?.deals || [];
  const associatedTickets = associated?.tickets || [];
  const assocMeta = associated?.associations || { contact: [], company: [], deal: [], ticket: [] };

  const groupedActivities = useMemo(() => groupByMonth(activities as CrmActivity[]), [activities]);

  // ---- Handlers ----
  const handleBack = () => {
    // Use browser history to preserve URL params (e.g. pipeline filter)
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      const paths: Record<CrmObjectType, string> = {
        contact: '/crm/0-1', company: '/crm/0-2',
        deal: '/crm/0-3', ticket: '/crm/0-4',
      };
      navigate(paths[objectType]);
    }
  };

  const handleStartEditName = () => {
    setEditName(recordName);
    setIsEditingName(true);
  };

  const handleSaveName = () => {
    setIsEditingName(false);
    toast({ title: 'Nome atualizado', description: `Atualizado para "${editName}"` });
  };

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copiado!', description: text });
  };

  const resetForms = () => {
    setNoteContent('');
    setEmailForm({ to: '', from: '', subject: '', body: '' });
    setCallForm({ outcome: '', duration: '', notes: '' });
    setTaskForm({ title: '', date: '', priority: 'medium', notes: '' });
    setMeetingForm({ title: '', start: '', end: '', type: 'video', location: '', participants: '' });
  };

  const handleCreateNote = () => {
    if (!noteContent.trim()) return;
    createActivity.mutate({
      tipo: 'nota',
      conteudo: noteContent,
      contato_ids: objectType === 'contact' ? [recordId] : [],
      empresa_crm_ids: objectType === 'company' ? [recordId] : [],
      negocio_ids: objectType === 'deal' ? [recordId] : [],
      ticket_ids: objectType === 'ticket' ? [recordId] : [],
      data_atividade: new Date().toISOString(),
    } as Partial<CrmActivity>, {
      onSuccess: () => {
        toast({ title: 'Observação criada' });
        setActiveModal(null);
        resetForms();
      },
      onError: (e) => toast({ title: 'Erro', description: String(e), variant: 'destructive' }),
    });
  };

  const handleCreateEmail = () => {
    createActivity.mutate({
      tipo: 'email',
      email_para: emailForm.to,
      email_de: emailForm.from,
      email_assunto: emailForm.subject,
      conteudo: emailForm.body,
      contato_ids: objectType === 'contact' ? [recordId] : [],
      empresa_crm_ids: objectType === 'company' ? [recordId] : [],
      negocio_ids: objectType === 'deal' ? [recordId] : [],
      ticket_ids: objectType === 'ticket' ? [recordId] : [],
      data_atividade: new Date().toISOString(),
    } as Partial<CrmActivity>, {
      onSuccess: () => {
        toast({ title: 'E-mail registrado' });
        setActiveModal(null);
        resetForms();
      },
      onError: (e) => toast({ title: 'Erro', description: String(e), variant: 'destructive' }),
    });
  };

  const handleCreateCall = () => {
    createActivity.mutate({
      tipo: 'chamada',
      chamada_resultado: callForm.outcome,
      chamada_duracao: callForm.duration ? parseInt(callForm.duration, 10) : null,
      conteudo: callForm.notes,
      contato_ids: objectType === 'contact' ? [recordId] : [],
      empresa_crm_ids: objectType === 'company' ? [recordId] : [],
      negocio_ids: objectType === 'deal' ? [recordId] : [],
      ticket_ids: objectType === 'ticket' ? [recordId] : [],
      data_atividade: new Date().toISOString(),
    } as Partial<CrmActivity>, {
      onSuccess: () => {
        toast({ title: 'Chamada registrada' });
        setActiveModal(null);
        resetForms();
      },
      onError: (e) => toast({ title: 'Erro', description: String(e), variant: 'destructive' }),
    });
  };

  const handleCreateTask = () => {
    createActivity.mutate({
      tipo: 'tarefa',
      titulo: taskForm.title,
      tarefa_prioridade: taskForm.priority,
      tarefa_data_vencimento: taskForm.date || null,
      tarefa_status: 'pendente',
      conteudo: taskForm.notes,
      contato_ids: objectType === 'contact' ? [recordId] : [],
      empresa_crm_ids: objectType === 'company' ? [recordId] : [],
      negocio_ids: objectType === 'deal' ? [recordId] : [],
      ticket_ids: objectType === 'ticket' ? [recordId] : [],
      data_atividade: new Date().toISOString(),
    } as Partial<CrmActivity>, {
      onSuccess: () => {
        toast({ title: 'Tarefa criada' });
        setActiveModal(null);
        resetForms();
      },
      onError: (e) => toast({ title: 'Erro', description: String(e), variant: 'destructive' }),
    });
  };

  const handleCreateMeeting = () => {
    const participants = meetingForm.participants
      .split(',')
      .map(p => p.trim())
      .filter(Boolean)
      .map(email => ({ nome: '', email }));
    createActivity.mutate({
      tipo: 'reuniao',
      titulo: meetingForm.title,
      reuniao_inicio: meetingForm.start || null,
      reuniao_fim: meetingForm.end || null,
      reuniao_tipo: meetingForm.type,
      reuniao_localizacao: meetingForm.location,
      reuniao_participantes: participants,
      contato_ids: objectType === 'contact' ? [recordId] : [],
      empresa_crm_ids: objectType === 'company' ? [recordId] : [],
      negocio_ids: objectType === 'deal' ? [recordId] : [],
      ticket_ids: objectType === 'ticket' ? [recordId] : [],
      data_atividade: meetingForm.start || new Date().toISOString(),
    } as Partial<CrmActivity>, {
      onSuccess: () => {
        toast({ title: 'Reunião agendada' });
        setActiveModal(null);
        resetForms();
      },
      onError: (e) => toast({ title: 'Erro', description: String(e), variant: 'destructive' }),
    });
  };

  const handleAddAssociation = () => {
    if (!associationDialog || selectedAssociationIds.length === 0) return;
    const promises = selectedAssociationIds.map(destId =>
      createAssociation.mutateAsync({
        origem_tipo: objectType,
        origem_id: recordId,
        destino_tipo: associationDialog,
        destino_id: destId,
      }),
    );
    Promise.all(promises)
      .then(() => {
        // Auto-set first contact as primary for deals/tickets
        if (associationDialog === 'contact' && (objectType === 'deal' || objectType === 'ticket') && !rec.contato_principal_id && selectedAssociationIds[0]) {
          handleSetPrimaryContact(selectedAssociationIds[0]);
        }
        toast({ title: 'Associação criada' });
        setAssociationDialog(null);
        setSelectedAssociationIds([]);
        setAssociationSearch('');
      })
      .catch((e) => toast({ title: 'Erro', description: String(e), variant: 'destructive' }));
  };

  const checkEmailExists = async (email: string) => {
    if (!email || !email.includes('@')) { setEmailExists(false); return; }
    setCheckingEmail(true);
    try {
      const results = await import('@/lib/crmService');
      // Use search contacts to check
      const existing = searchContacts?.data?.find(c => c.email?.toLowerCase() === email.toLowerCase());
      setEmailExists(!!existing);
    } catch { setEmailExists(false); }
    finally { setCheckingEmail(false); }
  };

  const handleCreateAndAssociate = async () => {
    if (!associationDialog) return;
    try {
      let newId: string | null = null;
      if (associationDialog === 'contact') {
        if (!newContactForm.email || !newContactForm.nome) { toast({ title: 'Preencha e-mail e nome', variant: 'destructive' }); return; }
        if (emailExists) { toast({ title: 'E-mail já existe. Use "Adicionar existente"', variant: 'destructive' }); return; }
        const created = await createContact.mutateAsync({ nome: newContactForm.nome, email: newContactForm.email, telefone: newContactForm.telefone || null, cargo: newContactForm.cargo || null, status: 'lead' } as any);
        newId = created.id;
      } else if (associationDialog === 'company') {
        if (!newCompanyForm.nome) { toast({ title: 'Preencha o nome da empresa', variant: 'destructive' }); return; }
        const created = await createCompany.mutateAsync({ nome: newCompanyForm.nome, dominio: newCompanyForm.dominio || null, cnpj: newCompanyForm.cnpj || null } as any);
        newId = created.id;
      } else if (associationDialog === 'deal') {
        if (!newDealForm.nome) { toast({ title: 'Preencha o nome do negócio', variant: 'destructive' }); return; }
        const pip = dealPipelines[0];
        const created = await createDealMut.mutateAsync({ nome: newDealForm.nome, valor: parseFloat(newDealForm.valor) || 0, pipeline_id: pip?.id, estagio_id: pip?.estagios?.[0]?.id, status: 'aberto' } as any);
        newId = created.id;
      } else if (associationDialog === 'ticket') {
        if (!newTicketForm.titulo) { toast({ title: 'Preencha o nome do ticket', variant: 'destructive' }); return; }
        const pip = ticketPipelines[0];
        const created = await createTicketMut.mutateAsync({ titulo: newTicketForm.titulo, pipeline_id: pip?.id, estagio_id: pip?.estagios?.[0]?.id, prioridade: newTicketForm.prioridade, status: 'aberto' } as any);
        newId = created.id;
      }
      if (newId) {
        await createAssociation.mutateAsync({ origem_tipo: objectType, origem_id: recordId, destino_tipo: associationDialog, destino_id: newId });
        // Auto-set first contact as primary for deals/tickets
        if (associationDialog === 'contact' && (objectType === 'deal' || objectType === 'ticket') && !rec.contato_principal_id) {
          handleSetPrimaryContact(newId);
        }
        toast({ title: `${OBJECT_LABELS[associationDialog].singular} criado e associado` });
        setAssociationDialog(null);
        setNewContactForm({ email: '', nome: '', telefone: '', cargo: '' });
        setNewCompanyForm({ nome: '', dominio: '', cnpj: '' });
        setNewDealForm({ nome: '', valor: '' });
        setNewTicketForm({ titulo: '', prioridade: 'medium' });
      }
    } catch (e) { toast({ title: 'Erro ao criar', description: String(e), variant: 'destructive' }); }
  };

  const handleRemoveAssociation = (assocId: string) => {
    deleteAssociation.mutate(assocId, {
      onSuccess: () => toast({ title: 'Associação removida' }),
      onError: (e) => toast({ title: 'Erro', description: String(e), variant: 'destructive' }),
    });
  };

  const handleSetPrimaryContact = async (contactId: string) => {
    if (!recordId) return;
    const table = objectType === 'deal' ? 'crm_negocios' : objectType === 'ticket' ? 'crm_tickets' : null;
    if (!table) return;
    try {
      await (supabase as any).schema('saas').from(table)
        .update({ contato_principal_id: contactId || null })
        .eq('id', recordId);
      (rec as any).contato_principal_id = contactId || null;
      toast({ title: contactId ? 'Contato principal definido' : 'Contato principal removido' });
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  };

  const getSearchResults = (): { id: string; label: string }[] => {
    if (!associationDialog) return [];
    switch (associationDialog) {
      case 'contact':
        return (searchContacts?.data || []).map(c => ({ id: c.id, label: c.nome }));
      case 'company':
        return (searchCompanies?.data || []).map(c => ({ id: c.id, label: c.nome }));
      case 'deal':
        return (searchDeals?.data || []).map(d => ({ id: d.id, label: d.nome }));
      case 'ticket':
        return (searchTickets?.data || []).map(t => ({ id: t.id, label: t.titulo }));
      default:
        return [];
    }
  };

  // ---- Loading ----
  if (loadingRecord) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!record) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-muted-foreground">Registro não encontrado</p>
        <Button variant="outline" onClick={handleBack}>Voltar</Button>
      </div>
    );
  }

  // ========================
  // RENDER
  // ========================
  return (
    <div className="flex h-full overflow-hidden bg-background">
      {/* ============ LEFT SIDEBAR ============ */}
      <div className="w-[320px] flex-shrink-0 border-r border-border overflow-y-auto bg-card">
        <div className="p-4 space-y-4">
          {/* Header: Back + Actions */}
          <div className="flex items-center justify-between">
            <button onClick={handleBack} className="flex items-center gap-1 text-sm text-primary hover:underline">
              <ArrowLeft className="w-3.5 h-3.5" /> {labels.back}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1">Ações <ChevronDown className="w-3 h-3" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem><Star className="w-3.5 h-3.5 mr-2" /> Seguir</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate(`/crm/0-5?object=${objectType}`)}><Eye className="w-3.5 h-3.5 mr-2" /> Exibir todas as propriedades</DropdownMenuItem>
                <DropdownMenuItem><History className="w-3.5 h-3.5 mr-2" /> Exibir histórico da propriedade</DropdownMenuItem>
                <DropdownMenuItem><GitMerge className="w-3.5 h-3.5 mr-2" /> Revisar associações</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem><Sparkles className="w-3.5 h-3.5 mr-2" /> Resumir (AI)</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem><Copy className="w-3.5 h-3.5 mr-2" /> Clonar</DropdownMenuItem>
                <DropdownMenuItem className="text-destructive"><Trash2 className="w-3.5 h-3.5 mr-2" /> Excluir</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Record name + avatar */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-lg flex-shrink-0">
              {recordName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              {isEditingName ? (
                <div className="flex items-center gap-1">
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8 text-base font-semibold" autoFocus onKeyDown={(e) => e.key === 'Enter' && handleSaveName()} />
                  <Button size="sm" variant="ghost" onClick={handleSaveName}><CheckSquare className="w-4 h-4" /></Button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <h1 className="text-base font-semibold text-foreground truncate">{recordName}</h1>
                  <button onClick={handleStartEditName} className="text-muted-foreground hover:text-foreground flex-shrink-0">
                    <Pencil className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Key properties by type */}
          <div className="space-y-1 text-sm">
            {objectType === 'deal' && (
              <>
                <PropertyRow label="Valor" value={formatCurrency(rec.valor as number)} />
                <PropertyRow label="Data de fechamento" value={formatDate(rec.data_fechamento_prevista as string)} />
                <PropertyRow label="Status" value={
                  <Badge variant="outline" className={cn(
                    rec.status === 'ganho' && 'bg-green-500/15 text-green-600 border-green-500/30',
                    rec.status === 'perdido' && 'bg-red-500/15 text-red-600 border-red-500/30',
                    rec.status === 'aberto' && 'bg-blue-500/15 text-blue-600 border-blue-500/30',
                  )}>
                    {String(rec.status || 'aberto')}
                  </Badge>
                } />
                <PropertyRow label="Probabilidade" value={`${rec.probabilidade || 0}%`} />
              </>
            )}
            {objectType === 'contact' && (
              <>
                <PropertyRow label="Email" value={rec.email as string} copyable onCopy={() => handleCopyText(rec.email as string || '')} />
                <PropertyRow label="Telefone" value={rec.telefone as string} />
                <PropertyRow label="Cargo" value={rec.cargo as string} />
                <PropertyRow label="Status" value={
                  <Badge variant="outline">{String(rec.status || '-')}</Badge>
                } />
              </>
            )}
            {objectType === 'company' && (
              <>
                <PropertyRow label="Domínio" value={rec.dominio as string} />
                <PropertyRow label="CNPJ" value={rec.cnpj as string} />
                <PropertyRow label="Telefone" value={rec.telefone as string} />
                <PropertyRow label="Setor" value={rec.setor as string} />
              </>
            )}
            {objectType === 'ticket' && (
              <>
                <PropertyRow label="Prioridade" value={
                  <Badge variant="outline" className={cn(
                    rec.prioridade === 'urgent' && 'bg-red-500/15 text-red-600',
                    rec.prioridade === 'high' && 'bg-orange-500/15 text-orange-600',
                    rec.prioridade === 'medium' && 'bg-yellow-500/15 text-yellow-600',
                    rec.prioridade === 'low' && 'bg-gray-500/15 text-gray-600',
                  )}>
                    {PRIORITY_OPTIONS.find(p => p.value === rec.prioridade)?.label || String(rec.prioridade || '-')}
                  </Badge>
                } />
                <PropertyRow label="Status" value={
                  <Badge variant="outline">{String(rec.status || '-')}</Badge>
                } />
                <PropertyRow label="Categoria" value={rec.categoria as string} />
              </>
            )}
          </div>

          {/* Activity buttons — HubSpot style */}
          <div className="pt-3 border-t border-border">
            <div className="flex items-center justify-center gap-4">
              {[
                { icon: <StickyNote className="w-4 h-4" />, label: 'Observa...', type: 'nota' as const },
                { icon: <Mail className="w-4 h-4" />, label: 'E-mail', type: 'email' as const },
                { icon: <Phone className="w-4 h-4" />, label: 'Chamada', type: 'chamada' as const },
                { icon: <CheckSquare className="w-4 h-4" />, label: 'Tarefa', type: 'tarefa' as const },
                { icon: <CalendarDays className="w-4 h-4" />, label: 'Reunião', type: 'reuniao' as const },
              ].map(a => (
                <button key={a.type} onClick={() => setActiveModal(a.type)} className="flex flex-col items-center gap-1 group">
                  <div className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted-foreground group-hover:text-foreground group-hover:border-foreground transition-colors">
                    {a.icon}
                  </div>
                  <span className="text-[10px] text-muted-foreground group-hover:text-foreground">{a.label}</span>
                </button>
              ))}
              <DropdownMenu open={showMoreActions} onOpenChange={setShowMoreActions}>
                <DropdownMenuTrigger asChild>
                  <button className="flex flex-col items-center gap-1 group">
                    <div className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted-foreground group-hover:text-foreground group-hover:border-foreground transition-colors">
                      <MoreHorizontal className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] text-muted-foreground group-hover:text-foreground">Mais</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <div className="px-2 py-1.5">
                    <Input placeholder="Pesquisar" className="h-7 text-xs" />
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem><MessageSquare className="w-3.5 h-3.5 mr-2" /> Criar mensagem do WhatsApp</DropdownMenuItem>
                  <DropdownMenuItem><Send className="w-3.5 h-3.5 mr-2" /> Registrar SMS</DropdownMenuItem>
                  <DropdownMenuItem><Mail className="w-3.5 h-3.5 mr-2" /> Registrar um e-mail</DropdownMenuItem>
                  <DropdownMenuItem><Phone className="w-3.5 h-3.5 mr-2" /> Registrar uma chamada</DropdownMenuItem>
                  <DropdownMenuItem><Linkedin className="w-3.5 h-3.5 mr-2" /> Mensagem do LinkedIn</DropdownMenuItem>
                  <DropdownMenuItem><CalendarDays className="w-3.5 h-3.5 mr-2" /> Registrar uma reunião</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* About this object */}
          <div className="pt-3 border-t border-border">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <ChevronDown className="w-3 h-3" /> Sobre esse {labels.singular}
              </p>
              <div className="flex items-center gap-1">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">Ações <ChevronDown className="w-3 h-3 ml-0.5" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem onClick={() => navigate(`/crm/0-5?object=${objectType}`)}>Exibir todas as propriedades</DropdownMenuItem>
                    <DropdownMenuItem>Exibir histórico da propriedade</DropdownMenuItem>
                    <DropdownMenuItem>Ver histórico de associação</DropdownMenuItem>
                    <DropdownMenuItem>Revisar associações</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0"><Settings className="w-3 h-3 text-muted-foreground" /></Button>
              </div>
            </div>

            {/* All properties (readonly) */}
            <div className="space-y-1.5 text-xs">
              <PropertyRow label="Número" value={rec.numero_registro as string} />
              <PropertyRow label="Proprietário" value={rec.proprietario_nome as string} />
              <PropertyRow label="Criado em" value={formatDateTime(rec.criado_em as string)} />
              <PropertyRow label="Atualizado em" value={formatDateTime(rec.atualizado_em as string)} />
              <PropertyRow label="Última atividade" value={formatDateTime(rec.ultima_atividade_em as string)} />
              {(rec.tags as string[])?.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {(rec.tags as string[]).map(t => (
                    <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ============ CENTER ============ */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6">
          {/* Main tabs */}
          <div className="flex items-center gap-4 border-b border-border mb-4">
            <button
              className={cn(
                'pb-2 text-sm font-medium border-b-2 transition-colors',
                activeMainTab === 'overview'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
              onClick={() => setActiveMainTab('overview')}
            >
              Visão geral
            </button>
            <button
              className={cn(
                'pb-2 text-sm font-medium border-b-2 transition-colors',
                activeMainTab === 'activities'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
              onClick={() => setActiveMainTab('activities')}
            >
              Atividades
            </button>
          </div>

          {/* Activity sub-tabs */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {ACTIVITY_TABS.map(tab => (
              <button
                key={tab.id}
                className={cn(
                  'px-3 py-1 text-xs rounded-full border transition-colors',
                  activeActivityTab === tab.id
                    ? 'bg-primary/10 text-primary border-primary/30'
                    : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted',
                )}
                onClick={() => setActiveActivityTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Filter chips */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <Badge variant="secondary" className="text-xs gap-1">
              Atividade ({(activities as CrmActivity[]).length})
              <X className="w-3 h-3 cursor-pointer" />
            </Badge>
            <Badge variant="outline" className="text-xs">Desde sempre</Badge>
            <Badge variant="outline" className="text-xs">Atividade atribuída a</Badge>
            <Badge variant="outline" className="text-xs">Equipe</Badge>
          </div>

          {/* Inline activity form */}
          {activeModal && (
            <div className="mb-6 border border-border rounded-lg bg-card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium">
                  {activeModal === 'nota' && 'Nova observação'}
                  {activeModal === 'email' && 'Registrar e-mail'}
                  {activeModal === 'chamada' && 'Registrar chamada'}
                  {activeModal === 'tarefa' && 'Nova tarefa'}
                  {activeModal === 'reuniao' && 'Agendar reunião'}
                </h3>
                <Button variant="ghost" size="sm" onClick={() => { setActiveModal(null); resetForms(); }}>
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Note form */}
              {activeModal === 'nota' && (
                <div className="space-y-3">
                  <textarea
                    className="w-full min-h-[120px] p-3 text-sm border border-border rounded-md bg-background resize-y focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Escreva sua observação..."
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                  />
                  <div className="flex justify-end">
                    <Button size="sm" onClick={handleCreateNote} disabled={createActivity.isPending || !noteContent.trim()}>
                      {createActivity.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                      Criar observação
                    </Button>
                  </div>
                </div>
              )}

              {/* Email form */}
              {activeModal === 'email' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Para</label>
                      <Input value={emailForm.to} onChange={(e) => setEmailForm(p => ({ ...p, to: e.target.value }))} placeholder="email@exemplo.com" className="h-8" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">De</label>
                      <Input value={emailForm.from} onChange={(e) => setEmailForm(p => ({ ...p, from: e.target.value }))} placeholder="seu@email.com" className="h-8" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Assunto</label>
                    <Input value={emailForm.subject} onChange={(e) => setEmailForm(p => ({ ...p, subject: e.target.value }))} placeholder="Assunto do e-mail" className="h-8" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Corpo</label>
                    <textarea
                      className="w-full min-h-[100px] p-3 text-sm border border-border rounded-md bg-background resize-y focus:outline-none focus:ring-2 focus:ring-primary/20"
                      placeholder="Conteúdo do e-mail..."
                      value={emailForm.body}
                      onChange={(e) => setEmailForm(p => ({ ...p, body: e.target.value }))}
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button size="sm" onClick={handleCreateEmail} disabled={createActivity.isPending}>
                      {createActivity.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-3.5 h-3.5 mr-1" />}
                      Enviar
                    </Button>
                  </div>
                </div>
              )}

              {/* Call form */}
              {activeModal === 'chamada' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Resultado</label>
                      <select
                        className="w-full h-8 px-3 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                        value={callForm.outcome}
                        onChange={(e) => setCallForm(p => ({ ...p, outcome: e.target.value }))}
                      >
                        <option value="">Selecione...</option>
                        {CALL_OUTCOMES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Duração (min)</label>
                      <Input
                        type="number"
                        value={callForm.duration}
                        onChange={(e) => setCallForm(p => ({ ...p, duration: e.target.value }))}
                        placeholder="0"
                        className="h-8"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Notas</label>
                    <textarea
                      className="w-full min-h-[80px] p-3 text-sm border border-border rounded-md bg-background resize-y focus:outline-none focus:ring-2 focus:ring-primary/20"
                      placeholder="Notas da chamada..."
                      value={callForm.notes}
                      onChange={(e) => setCallForm(p => ({ ...p, notes: e.target.value }))}
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button size="sm" onClick={handleCreateCall} disabled={createActivity.isPending}>
                      {createActivity.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                      Registrar chamada
                    </Button>
                  </div>
                </div>
              )}

              {/* Task form */}
              {activeModal === 'tarefa' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Título</label>
                    <Input
                      value={taskForm.title}
                      onChange={(e) => setTaskForm(p => ({ ...p, title: e.target.value }))}
                      placeholder="Título da tarefa"
                      className="h-8"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Data de vencimento</label>
                      <Input
                        type="date"
                        value={taskForm.date}
                        onChange={(e) => setTaskForm(p => ({ ...p, date: e.target.value }))}
                        className="h-8"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Prioridade</label>
                      <select
                        className="w-full h-8 px-3 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                        value={taskForm.priority}
                        onChange={(e) => setTaskForm(p => ({ ...p, priority: e.target.value }))}
                      >
                        {PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Notas</label>
                    <textarea
                      className="w-full min-h-[80px] p-3 text-sm border border-border rounded-md bg-background resize-y focus:outline-none focus:ring-2 focus:ring-primary/20"
                      placeholder="Detalhes da tarefa..."
                      value={taskForm.notes}
                      onChange={(e) => setTaskForm(p => ({ ...p, notes: e.target.value }))}
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button size="sm" onClick={handleCreateTask} disabled={createActivity.isPending || !taskForm.title.trim()}>
                      {createActivity.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                      Criar tarefa
                    </Button>
                  </div>
                </div>
              )}

              {/* Meeting form */}
              {activeModal === 'reuniao' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Título</label>
                    <Input
                      value={meetingForm.title}
                      onChange={(e) => setMeetingForm(p => ({ ...p, title: e.target.value }))}
                      placeholder="Título da reunião"
                      className="h-8"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Início</label>
                      <Input
                        type="datetime-local"
                        value={meetingForm.start}
                        onChange={(e) => setMeetingForm(p => ({ ...p, start: e.target.value }))}
                        className="h-8"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Fim</label>
                      <Input
                        type="datetime-local"
                        value={meetingForm.end}
                        onChange={(e) => setMeetingForm(p => ({ ...p, end: e.target.value }))}
                        className="h-8"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Tipo</label>
                      <select
                        className="w-full h-8 px-3 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                        value={meetingForm.type}
                        onChange={(e) => setMeetingForm(p => ({ ...p, type: e.target.value }))}
                      >
                        {MEETING_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Local</label>
                      <Input
                        value={meetingForm.location}
                        onChange={(e) => setMeetingForm(p => ({ ...p, location: e.target.value }))}
                        placeholder="Link ou endereço"
                        className="h-8"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Participantes (e-mails separados por vírgula)</label>
                    <Input
                      value={meetingForm.participants}
                      onChange={(e) => setMeetingForm(p => ({ ...p, participants: e.target.value }))}
                      placeholder="joao@email.com, maria@email.com"
                      className="h-8"
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button size="sm" onClick={handleCreateMeeting} disabled={createActivity.isPending || !meetingForm.title.trim()}>
                      {createActivity.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CalendarDays className="w-3.5 h-3.5 mr-1" />}
                      Agendar reunião
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Timeline */}
          {loadingActivities ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (activities as CrmActivity[]).length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <StickyNote className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Nenhuma atividade registrada</p>
              <p className="text-xs mt-1">Use os botões acima para registrar a primeira atividade.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedActivities).map(([month, items]) => (
                <div key={month}>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    {month}
                  </h3>
                  <div className="space-y-2">
                    {items.map(activity => {
                      const borderColor = activity.tipo === 'nota' ? 'border-l-amber-500' : activity.tipo === 'email' ? 'border-l-blue-500' : activity.tipo === 'chamada' ? 'border-l-green-500' : activity.tipo === 'tarefa' ? 'border-l-purple-500' : activity.tipo === 'reuniao' ? 'border-l-orange-500' : 'border-l-muted-foreground';
                      return (
                      <div
                        key={activity.id}
                        className={cn('flex items-start gap-3 p-4 rounded-lg border border-border border-l-4 bg-card hover:bg-muted/20 transition-colors', borderColor)}
                      >
                        <div className="mt-0.5 p-1.5 rounded-full bg-muted text-muted-foreground">
                          {getActivityIcon(activity.tipo)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-primary">
                              {getActivityLabel(activity.tipo)}
                            </span>
                            {activity.titulo && (
                              <span className="text-sm font-medium text-foreground truncate">
                                {activity.titulo}
                              </span>
                            )}
                          </div>
                          {activity.conteudo && (
                            <p className={cn(
                              'text-xs text-muted-foreground mt-1',
                              expandedActivity !== activity.id && 'line-clamp-2',
                            )}>
                              {activity.conteudo}
                            </p>
                          )}
                          {activity.tipo === 'email' && activity.email_assunto && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Assunto: {activity.email_assunto}
                            </p>
                          )}
                          {activity.tipo === 'chamada' && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {activity.chamada_resultado && `Resultado: ${activity.chamada_resultado}`}
                              {activity.chamada_duracao ? ` | ${activity.chamada_duracao} min` : ''}
                            </p>
                          )}
                          {activity.tipo === 'tarefa' && activity.tarefa_status && (
                            <Badge variant="outline" className="text-[10px] mt-1">
                              {activity.tarefa_status}
                            </Badge>
                          )}
                          {activity.tipo === 'reuniao' && activity.reuniao_inicio && (
                            <p className="text-xs text-muted-foreground mt-1">
                              <Clock className="w-3 h-3 inline mr-1" />
                              {formatDateTime(activity.reuniao_inicio)}
                              {activity.reuniao_localizacao && (
                                <><MapPin className="w-3 h-3 inline ml-2 mr-1" />{activity.reuniao_localizacao}</>
                              )}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-[10px] text-muted-foreground">
                              {formatDateTime(activity.data_atividade || activity.criado_em)}
                            </span>
                            {activity.criado_por_nome && (
                              <span className="text-[10px] text-muted-foreground">
                                por {activity.criado_por_nome}
                              </span>
                            )}
                            <button
                              className="text-[10px] text-primary hover:underline"
                              onClick={() => setExpandedActivity(expandedActivity === activity.id ? null : activity.id)}
                            >
                              {expandedActivity === activity.id ? 'Ocultar detalhes' : 'Exibir detalhes'}
                            </button>
                          </div>
                        </div>
                      </div>
                    );})}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ============ RIGHT SIDEBAR ============ */}
      <div className="w-[320px] flex-shrink-0 border-l border-border overflow-y-auto bg-card">
        <div className="p-4 space-y-4">
          {/* Contacts section (unless current is contact) */}
          {objectType !== 'contact' && (
            <AssociationSection
              title="Contatos"
              icon={<User className="w-4 h-4" />}
              count={associatedContacts.length}
              loading={loadingAssociated}
              onAdd={() => { setAssociationDialog('contact'); setAssociationTab('existing'); setAssociationSearch(''); setSelectedAssociationIds([]); }}
              items={associatedContacts.map((c: Record<string, unknown>) => ({
                id: c.id as string,
                name: c.nome as string,
                subtitle: c.cargo as string || '',
                email: c.email as string,
                assocId: assocMeta.contact.find(a => a.id === c.id)?.assocId || '',
                href: `/crm/record/0-1/${c.numero_registro as string}`,
              }))}
              onCopy={handleCopyText}
              onRemove={handleRemoveAssociation}
              allLabel={`Exibir todos os ${OBJECT_LABELS.contact.plural} associados`}
              primaryContactId={(objectType === 'deal' || objectType === 'ticket') ? rec.contato_principal_id as string | null : undefined}
              onSetPrimary={(objectType === 'deal' || objectType === 'ticket') ? handleSetPrimaryContact : undefined}
            />
          )}

          {/* Companies section (unless current is company) */}
          {objectType !== 'company' && (
            <AssociationSection
              title="Empresas"
              icon={<Building2 className="w-4 h-4" />}
              count={associatedCompanies.length}
              loading={loadingAssociated}
              onAdd={() => { setAssociationDialog('company'); setAssociationTab('existing'); setAssociationSearch(''); setSelectedAssociationIds([]); }}
              items={associatedCompanies.map((c: Record<string, unknown>) => ({
                id: c.id as string,
                name: c.nome as string,
                subtitle: c.dominio as string || c.setor as string || '',
                email: '',
                assocId: assocMeta.company.find(a => a.id === c.id)?.assocId || '',
                href: `/crm/record/0-2/${c.numero_registro as string}`,
              }))}
              onCopy={handleCopyText}
              onRemove={handleRemoveAssociation}
              allLabel={`Exibir todas as ${OBJECT_LABELS.company.plural} associadas`}
            />
          )}

          {/* Tickets section (unless current is ticket) */}
          {objectType !== 'ticket' && (
            <AssociationSection
              title="Tickets"
              icon={<Ticket className="w-4 h-4" />}
              count={associatedTickets.length}
              loading={loadingAssociated}
              onAdd={() => { setAssociationDialog('ticket'); setAssociationTab('existing'); setAssociationSearch(''); setSelectedAssociationIds([]); }}
              items={associatedTickets.map((t: Record<string, unknown>) => ({
                id: t.id as string,
                name: t.titulo as string || 'Sem título',
                subtitle: t.status as string || '',
                email: '',
                assocId: assocMeta.ticket.find(a => a.id === t.id)?.assocId || '',
                href: `/crm/record/0-4/${t.numero_registro as string}`,
              }))}
              onCopy={handleCopyText}
              onRemove={handleRemoveAssociation}
              allLabel={`Exibir todos os ${OBJECT_LABELS.ticket.plural} associados`}
            />
          )}

          {/* Deals section (unless current is deal) */}
          {objectType !== 'deal' && (
            <AssociationSection
              title="Negócios"
              icon={<Briefcase className="w-4 h-4" />}
              count={associatedDeals.length}
              loading={loadingAssociated}
              onAdd={() => { setAssociationDialog('deal'); setAssociationTab('existing'); setAssociationSearch(''); setSelectedAssociationIds([]); }}
              items={associatedDeals.map((d: Record<string, unknown>) => ({
                id: d.id as string,
                name: d.nome as string,
                subtitle: formatCurrency(d.valor as number),
                email: '',
                assocId: assocMeta.deal.find(a => a.id === d.id)?.assocId || '',
                href: `/crm/record/0-3/${d.numero_registro as string}`,
              }))}
              onCopy={handleCopyText}
              onRemove={handleRemoveAssociation}
              allLabel={`Exibir todos os ${OBJECT_LABELS.deal.plural} associados`}
            />
          )}
        </div>
      </div>

      {/* ============ ASSOCIATION DIALOG ============ */}
      <Dialog open={!!associationDialog} onOpenChange={(open) => { if (!open) setAssociationDialog(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Adicionar {associationDialog ? OBJECT_LABELS[associationDialog].singular : ''}
            </DialogTitle>
          </DialogHeader>

          {/* Tabs */}
          <div className="flex items-center gap-2 border-b border-border mb-3">
            <button
              className={cn(
                'pb-2 text-sm font-medium border-b-2 transition-colors',
                associationTab === 'existing'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
              onClick={() => setAssociationTab('existing')}
            >
              Adicionar existente
            </button>
            <button
              className={cn(
                'pb-2 text-sm font-medium border-b-2 transition-colors',
                associationTab === 'new'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
              onClick={() => setAssociationTab('new')}
            >
              Criar novo
            </button>
          </div>

          {associationTab === 'existing' ? (
            <div className="space-y-3">
              <Input
                placeholder="Buscar..."
                value={associationSearch}
                onChange={(e) => setAssociationSearch(e.target.value)}
                className="h-8"
              />
              <div className="max-h-[240px] overflow-y-auto space-y-1">
                {getSearchResults().length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    {associationSearch ? 'Nenhum resultado encontrado' : 'Digite para buscar'}
                  </p>
                ) : (
                  getSearchResults().map(item => (
                    <label
                      key={item.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        className="rounded border-border"
                        checked={selectedAssociationIds.includes(item.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedAssociationIds(prev => [...prev, item.id]);
                          } else {
                            setSelectedAssociationIds(prev => prev.filter(id => id !== item.id));
                          }
                        }}
                      />
                      <span className="text-sm">{item.label}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* CREATE NEW CONTACT */}
              {associationDialog === 'contact' && (
                <>
                  <div>
                    <label className="text-xs font-medium">E-mail *</label>
                    <Input value={newContactForm.email} onChange={e => { setNewContactForm(p => ({ ...p, email: e.target.value })); }} onBlur={() => {
                      const email = newContactForm.email;
                      if (email && email.includes('@')) {
                        const existing = searchContacts?.data?.find(c => c.email?.toLowerCase() === email.toLowerCase());
                        setEmailExists(!!existing);
                      }
                    }} placeholder="email@exemplo.com" className="mt-1 h-8 text-sm" />
                    {emailExists && <p className="text-xs text-destructive mt-1">Este e-mail já existe. Use "Adicionar existente".</p>}
                  </div>
                  <div>
                    <label className="text-xs font-medium">Nome *</label>
                    <Input value={newContactForm.nome} onChange={e => setNewContactForm(p => ({ ...p, nome: e.target.value }))} placeholder="Nome completo" className="mt-1 h-8 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-medium">Telefone</label>
                    <Input value={newContactForm.telefone} onChange={e => setNewContactForm(p => ({ ...p, telefone: e.target.value }))} placeholder="+55 11 99999-0000" className="mt-1 h-8 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-medium">Cargo</label>
                    <Input value={newContactForm.cargo} onChange={e => setNewContactForm(p => ({ ...p, cargo: e.target.value }))} placeholder="Ex: Gerente Comercial" className="mt-1 h-8 text-sm" />
                  </div>
                </>
              )}

              {/* CREATE NEW COMPANY */}
              {associationDialog === 'company' && (
                <>
                  <div>
                    <label className="text-xs font-medium">Nome da empresa *</label>
                    <Input value={newCompanyForm.nome} onChange={e => setNewCompanyForm(p => ({ ...p, nome: e.target.value }))} placeholder="Razão social" className="mt-1 h-8 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-medium">Domínio</label>
                    <Input value={newCompanyForm.dominio} onChange={e => setNewCompanyForm(p => ({ ...p, dominio: e.target.value }))} placeholder="empresa.com.br" className="mt-1 h-8 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-medium">CNPJ</label>
                    <Input value={newCompanyForm.cnpj} onChange={e => setNewCompanyForm(p => ({ ...p, cnpj: e.target.value }))} placeholder="00.000.000/0001-00" className="mt-1 h-8 text-sm" />
                  </div>
                </>
              )}

              {/* CREATE NEW DEAL */}
              {associationDialog === 'deal' && (
                <>
                  <div>
                    <label className="text-xs font-medium">Nome do negócio *</label>
                    <Input value={newDealForm.nome} onChange={e => setNewDealForm(p => ({ ...p, nome: e.target.value }))} placeholder="Nome do negócio" className="mt-1 h-8 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-medium">Valor</label>
                    <Input type="number" value={newDealForm.valor} onChange={e => setNewDealForm(p => ({ ...p, valor: e.target.value }))} placeholder="0.00" className="mt-1 h-8 text-sm" />
                  </div>
                  {dealPipelines[0] && (
                    <div>
                      <label className="text-xs font-medium">Pipeline</label>
                      <p className="text-sm text-muted-foreground mt-1">{dealPipelines[0].nome}</p>
                    </div>
                  )}
                </>
              )}

              {/* CREATE NEW TICKET */}
              {associationDialog === 'ticket' && (
                <>
                  <div>
                    <label className="text-xs font-medium">Nome do ticket *</label>
                    <Input value={newTicketForm.titulo} onChange={e => setNewTicketForm(p => ({ ...p, titulo: e.target.value }))} placeholder="Título do ticket" className="mt-1 h-8 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-medium">Prioridade</label>
                    <select value={newTicketForm.prioridade} onChange={e => setNewTicketForm(p => ({ ...p, prioridade: e.target.value }))} className="mt-1 w-full h-8 text-sm border border-border rounded-md px-2 bg-background">
                      <option value="low">Baixa</option>
                      <option value="medium">Média</option>
                      <option value="high">Alta</option>
                      <option value="urgent">Urgente</option>
                    </select>
                  </div>
                  {ticketPipelines[0] && (
                    <div>
                      <label className="text-xs font-medium">Pipeline</label>
                      <p className="text-sm text-muted-foreground mt-1">{ticketPipelines[0].nome}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAssociationDialog(null)}>
              Cancelar
            </Button>
            {associationTab === 'existing' ? (
              <Button size="sm" onClick={handleAddAssociation} disabled={selectedAssociationIds.length === 0 || createAssociation.isPending}>
                {createAssociation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                Associar
              </Button>
            ) : (
              <Button size="sm" onClick={handleCreateAndAssociate} disabled={emailExists}>
                Criar e associar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ========================
// Sub-components
// ========================

function PropertyRow({
  label, value, copyable, onCopy,
}: {
  label: string;
  value?: string | number | null | React.ReactNode;
  copyable?: boolean;
  onCopy?: () => void;
}) {
  const display = value == null || value === '' ? '-' : value;
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <div className="flex items-center gap-1 text-right">
        {typeof display === 'string' || typeof display === 'number' ? (
          <span className="text-foreground truncate max-w-[140px]">{display}</span>
        ) : (
          display
        )}
        {copyable && value && (
          <button onClick={onCopy} className="text-muted-foreground hover:text-foreground shrink-0">
            <Copy className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}

function ActivityButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <Button variant="ghost" size="sm" className="h-8 px-2 text-xs gap-1" onClick={onClick}>
      {icon}
      {label}
    </Button>
  );
}

interface AssociationItem {
  id: string;
  name: string;
  subtitle: string;
  email: string;
  assocId: string;
  href?: string;
  isPrimary?: boolean;
}

function AssociationSection({
  title, icon, count, loading, onAdd, items, onCopy, onRemove, allLabel,
  primaryContactId, onSetPrimary,
}: {
  title: string;
  icon: React.ReactNode;
  count: number;
  loading?: boolean;
  onAdd: () => void;
  items: AssociationItem[];
  onCopy: (text: string) => void;
  onRemove: (assocId: string) => void;
  allLabel: string;
  primaryContactId?: string | null;
  onSetPrimary?: (contactId: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  return (
    <div className="border border-border rounded-lg">
      <div
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/30"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium">{title} ({count})</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={(e) => { e.stopPropagation(); onAdd(); }}
          >
            <Plus className="w-3.5 h-3.5" />
          </Button>
          <Settings className="w-3.5 h-3.5 text-muted-foreground" />
        </div>
      </div>
      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {loading ? (
            <div className="flex justify-center py-2">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">Nenhum registro associado</p>
          ) : (
            <>
              {items.slice(0, 5).map(item => {
                const isPrimary = primaryContactId === item.id;
                return (
                <div key={item.id} className={cn('flex items-start gap-2 p-2 rounded-md transition-colors', isPrimary ? 'bg-primary/10 border border-primary/20' : 'bg-muted/30 hover:bg-muted/50')}>
                  <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0', isPrimary ? 'bg-primary/20 text-primary' : 'bg-primary/10 text-primary')}>
                    {item.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {item.href ? (
                        <a href={item.href} className="text-sm font-medium text-primary hover:underline truncate">{item.name}</a>
                      ) : (
                        <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                      )}
                      {isPrimary && (
                        <Badge variant="outline" className="text-[9px] h-4 px-1 bg-primary/10 text-primary border-primary/30 shrink-0">Principal</Badge>
                      )}
                    </div>
                    {item.subtitle && (
                      <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
                    )}
                    {item.email && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-xs text-muted-foreground truncate">{item.email}</span>
                        <button onClick={() => onCopy(item.email)} className="text-muted-foreground hover:text-foreground shrink-0">
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                    {onSetPrimary && (
                      isPrimary ? (
                        <button className="text-[10px] text-muted-foreground hover:text-destructive mt-0.5" onClick={() => onSetPrimary('')}>
                          Remover principal
                        </button>
                      ) : (
                        <button className="text-[10px] text-muted-foreground hover:text-primary mt-0.5" onClick={() => onSetPrimary(item.id)}>
                          Definir como principal
                        </button>
                      )
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 shrink-0"
                    onClick={() => item.assocId && onRemove(item.assocId)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
                );
              })}
              {count > 0 && (
                <button className="w-full text-xs text-primary hover:underline text-center py-1">
                  {allLabel}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
