import { useState, useMemo, useEffect, useRef, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Search, Plus, Filter, ExternalLink, MoreHorizontal, X,
  ChevronLeft, ChevronRight, ChevronDown, Download, Contact,
  ArrowUpDown, BarChart3, Copy, Table2, SlidersHorizontal, Loader2,
  Trash2, PlusCircle, Save, CheckCircle2,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import PhoneInput from '@/components/ui/phone-input';
import { useCrmContacts, useCreateContact, useSaasUsers } from '@/hooks/useCrm';
import { supabaseSaas } from '@/integrations/supabase/client';
import { getOrg } from '@/lib/saas';
import { useToast } from '@/hooks/use-toast';
import type { ContactStatus } from '@/types/crm';

const STATUS_CONFIG: Record<ContactStatus, { label: string; class: string }> = {
  lead:      { label: 'Lead',        class: 'bg-muted text-muted-foreground' },
  qualified: { label: 'Qualificado', class: 'bg-warning/15 text-warning' },
  customer:  { label: 'Cliente',     class: 'bg-success/15 text-success' },
  churned:   { label: 'Churned',     class: 'bg-destructive/15 text-destructive' },
};

// Column editor — all available contact properties
const CONTACTS_COLUMNS_KEY = 'crm_contacts_visible_columns';
const CONTACT_DEFAULT_COLUMNS = ['nome', 'numero_registro', 'criado_em', 'email', 'telefone', 'fonte', 'status'];

type ContactColumnDef = { key: string; label: string; pinned?: boolean; render: (c: any) => ReactNode };

const CONTACT_COLUMNS: ContactColumnDef[] = [
  { key: 'nome', label: 'Nome', pinned: true, render: (c) => (
    <div className="flex items-center gap-2">
      <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold flex-shrink-0">
        {c.nome.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
      </div>
      <span className="font-medium text-primary hover:underline cursor-pointer text-sm truncate max-w-[200px]">{c.nome}</span>
    </div>
  )},
  { key: 'numero_registro', label: 'ID do registro', render: (c) => (
    <span className="text-muted-foreground text-xs font-mono">{c.numero_registro}</span>
  )},
  { key: 'criado_em', label: 'Data de criação', render: (c) => (
    <span className="text-muted-foreground text-xs">{new Date(c.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
  )},
  { key: 'email', label: 'E-mail', render: (c) => c.email ? (
    <a href={`mailto:${c.email}`} className="text-muted-foreground hover:text-primary text-xs flex items-center gap-1 truncate max-w-[200px]">
      {c.email} <ExternalLink className="w-2.5 h-2.5 flex-shrink-0 opacity-0 group-hover:opacity-100" />
    </a>
  ) : <span className="text-muted-foreground/40 text-xs">--</span> },
  { key: 'telefone', label: 'Número de telefone', render: (c) => c.telefone ? (
    <span className="text-primary text-xs font-medium">{c.telefone}</span>
  ) : <span className="text-muted-foreground/40 text-xs">--</span> },
  { key: 'fonte', label: 'Fonte', render: (c) => <span className="text-muted-foreground text-xs">{c.fonte || '--'}</span> },
  { key: 'status', label: 'Status', render: (c) => {
    const st = STATUS_CONFIG[c.status as ContactStatus];
    return st ? <Badge className={cn('text-[10px] px-1.5 rounded-sm', st.class)}>{st.label}</Badge> : <span className="text-muted-foreground/40 text-xs">--</span>;
  }},
  { key: 'cargo', label: 'Cargo', render: (c) => <span className="text-muted-foreground text-xs">{c.cargo || '--'}</span> },
  { key: 'score', label: 'Score', render: (c) => <span className="text-muted-foreground text-xs font-medium">{c.score ?? '--'}</span> },
  { key: 'tags', label: 'Tags', render: (c) => c.tags?.length ? (
    <div className="flex gap-1 flex-wrap">{c.tags.map((t: string) => <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>)}</div>
  ) : <span className="text-muted-foreground/40 text-xs">--</span> },
  { key: 'proprietario_nome', label: 'Proprietário', render: (c) => <span className="text-muted-foreground text-xs">{c.proprietario_nome || '--'}</span> },
  { key: 'ultima_atividade_em', label: 'Última atividade', render: (c) => c.ultima_atividade_em ? (
    <span className="text-muted-foreground text-xs">{new Date(c.ultima_atividade_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
  ) : <span className="text-muted-foreground/40 text-xs">--</span> },
  { key: 'atualizado_em', label: 'Atualizado em', render: (c) => (
    <span className="text-muted-foreground text-xs">{new Date(c.atualizado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
  )},
];

type FilterDef = { key: string; label: string; type: 'select' | 'text'; options?: { value: string; label: string; sub?: string }[] };

const DATE_OPTIONS = [
  { value: 'hoje', label: 'Hoje', sub: 'Todos de hoje' },
  { value: 'ontem', label: 'Ontem', sub: 'Dia anterior de 24 horas' },
  { value: 'esta_semana', label: 'Esta semana', sub: 'Segunda a domingo' },
  { value: 'semana_passada', label: 'Semana passada', sub: 'Últimos 7 dias' },
  { value: 'este_mes', label: 'Este mês', sub: 'Mês atual' },
  { value: 'mes_passado', label: 'Mês passado', sub: 'Últimos 30 dias' },
  { value: 'este_ano', label: 'Este ano', sub: 'Ano atual' },
];

function getDateRange(preset: string): { start: Date; end: Date } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  switch (preset) {
    case 'hoje': return { start: today, end: tomorrow };
    case 'ontem': { const d = new Date(today); d.setDate(d.getDate() - 1); return { start: d, end: today }; }
    case 'esta_semana': { const d = new Date(today); d.setDate(d.getDate() - d.getDay() + 1); return { start: d, end: tomorrow }; }
    case 'semana_passada': { const d = new Date(today); d.setDate(d.getDate() - 7); return { start: d, end: tomorrow }; }
    case 'este_mes': return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: tomorrow };
    case 'mes_passado': { const d = new Date(today); d.setDate(d.getDate() - 30); return { start: d, end: tomorrow }; }
    case 'este_ano': return { start: new Date(now.getFullYear(), 0, 1), end: tomorrow };
    default: return { start: new Date(2000, 0, 1), end: tomorrow };
  }
}

const CONTACT_FILTERS: FilterDef[] = [
  { key: 'proprietario_id', label: 'Proprietário do contato', type: 'select' },
  { key: 'criado_em', label: 'Data de criação', type: 'select', options: DATE_OPTIONS },
  { key: 'status', label: 'Status do contato', type: 'select', options: [
    { value: 'lead', label: 'Lead' }, { value: 'qualified', label: 'Qualificado' },
    { value: 'customer', label: 'Cliente' }, { value: 'churned', label: 'Churned' },
  ]},
  { key: 'fonte', label: 'Fonte', type: 'select', options: [
    { value: 'website', label: 'Website' }, { value: 'linkedin', label: 'LinkedIn' },
    { value: 'referencia', label: 'Referência' }, { value: 'campanha', label: 'Campanha' },
    { value: 'whatsapp', label: 'WhatsApp' }, { value: 'email', label: 'E-mail' },
    { value: 'telefone', label: 'Telefone' }, { value: 'evento', label: 'Evento' },
  ]},
  { key: 'cargo', label: 'Cargo', type: 'text' },
];

const CONTACT_ADV_PROPERTIES = [
  { key: 'nome', label: 'Nome' },
  { key: 'email', label: 'E-mail' },
  { key: 'telefone', label: 'Telefone' },
  { key: 'cargo', label: 'Cargo' },
  { key: 'status', label: 'Status' },
  { key: 'fonte', label: 'Fonte' },
  { key: 'score', label: 'Score' },
  { key: 'tags', label: 'Tags' },
  { key: 'proprietario_nome', label: 'Proprietário' },
  { key: 'criado_em', label: 'Data de criação' },
  { key: 'atualizado_em', label: 'Atualizado em' },
];

interface SavedView {
  id: string;
  label: string;
  filters: Record<string, string>;
}

const DEFAULT_VIEW: SavedView = { id: 'all', label: 'Todos os contatos', filters: {} };
const VIEWS_STORAGE_KEY = 'ltx_crm_contact_views';

function loadSavedViews(): SavedView[] {
  try {
    const raw = localStorage.getItem(VIEWS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      // Validate each view has required fields
      return parsed.filter((v: any) => v && typeof v.id === 'string' && typeof v.label === 'string')
        .map((v: any) => ({ ...v, filters: v.filters && typeof v.filters === 'object' ? v.filters : {} }));
    }
  } catch {
    localStorage.removeItem(VIEWS_STORAGE_KEY);
  }
  return [];
}

function persistViews(views: SavedView[]) {
  localStorage.setItem(VIEWS_STORAGE_KEY, JSON.stringify(views));
}

function formatCount(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)} mi`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)} mil`;
  return String(n);
}

export default function CRMContactsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [savedViews, setSavedViews] = useState<SavedView[]>(loadSavedViews);
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [showViewList, setShowViewList] = useState(false);
  const [editingViewId, setEditingViewId] = useState<string | null>(null);
  const [editingViewName, setEditingViewName] = useState('');
  const [creatingView, setCreatingView] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const viewMenuRef = useRef<HTMLDivElement>(null);

  // Filter state — must be declared before activeView/hasUnsavedFilters
  const [showFilters, setShowFilters] = useState(true);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [sortField, setSortField] = useState<'criado_em' | 'atualizado_em' | 'nome'>('criado_em');
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [openChip, setOpenChip] = useState<string | null>(null);
  const [chipSearch, setChipSearch] = useState('');
  const chipAreaRef = useRef<HTMLDivElement>(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<{property: string; operator: string; value: string}[]>(() => {
    try { const s = localStorage.getItem('crm_contacts_adv_filters'); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  useEffect(() => { localStorage.setItem('crm_contacts_adv_filters', JSON.stringify(advancedFilters)); }, [advancedFilters]);

  // Column editor state
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    try { const s = localStorage.getItem(CONTACTS_COLUMNS_KEY); return s ? JSON.parse(s) : CONTACT_DEFAULT_COLUMNS; }
    catch { return CONTACT_DEFAULT_COLUMNS; }
  });
  const [columnSearch, setColumnSearch] = useState('');
  const activeColumns = useMemo(() => CONTACT_COLUMNS.filter(col => col.pinned || visibleColumns.includes(col.key)), [visibleColumns]);
  useEffect(() => { localStorage.setItem(CONTACTS_COLUMNS_KEY, JSON.stringify(visibleColumns)); }, [visibleColumns]);

  // Track if active view has unsaved filter changes
  const activeView = savedViews.find(v => v.id === activeTab);
  const hasUnsavedFilters = activeView
    ? JSON.stringify(activeView.filters) !== JSON.stringify(activeFilters)
    : false;

  // Close view menu on outside click
  useEffect(() => {
    if (!showViewMenu && !showViewList) return;
    const handler = (e: MouseEvent) => {
      if (viewMenuRef.current && !viewMenuRef.current.contains(e.target as Node)) {
        setShowViewMenu(false);
        setShowViewList(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showViewMenu, showViewList]);

  const handleSaveFiltersToView = () => {
    if (!activeView) return;
    const next = savedViews.map(v => v.id === activeView.id ? { ...v, filters: { ...activeFilters } } : v);
    setSavedViews(next);
    persistViews(next);
    toast({ title: 'Filtros salvos na visualização' });
  };

  const handleCreateView = () => {
    setShowViewMenu(false);
    setShowViewList(false);
    setCreatingView(true);
    setNewViewName('');
  };

  const confirmCreateView = () => {
    if (!newViewName.trim()) { setCreatingView(false); return; }
    const newView: SavedView = {
      id: `view_${Date.now()}`,
      label: newViewName.trim(),
      filters: { ...activeFilters },
    };
    const next = [...savedViews, newView];
    setSavedViews(next);
    persistViews(next);
    setActiveTab(newView.id);
    setCreatingView(false);
    setNewViewName('');
    toast({ title: `Visualização "${newView.label}" criada` });
  };

  const handleRenameView = (id: string) => {
    if (!editingViewName.trim()) { setEditingViewId(null); return; }
    const next = savedViews.map(v => v.id === id ? { ...v, label: editingViewName.trim() } : v);
    setSavedViews(next);
    persistViews(next);
    setEditingViewId(null);
  };

  const handleDeleteView = (id: string) => {
    const next = savedViews.filter(v => v.id !== id);
    setSavedViews(next);
    persistViews(next);
    if (activeTab === id) { setActiveTab('all'); setActiveFilters({}); }
    toast({ title: 'Visualização removida' });
  };
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Dynamic form fields — can be customized per org via CRM properties
  type FormField = { key: string; label: string; required?: boolean; type?: string; placeholder?: string; dbField?: string };
  const defaultFields: FormField[] = [
    { key: 'email', label: 'E-mail', required: true, type: 'email', placeholder: 'email@exemplo.com', dbField: 'email' },
    { key: 'nome', label: 'Nome', required: true, placeholder: 'Nome', dbField: 'nome' },
    { key: 'sobrenome', label: 'Sobrenome', placeholder: 'Sobrenome' },
    { key: 'telefone', label: 'Número de telefone', type: 'tel', placeholder: '+55 11 99999-0000', dbField: 'telefone' },
  ];
  const [formFields, setFormFields] = useState<FormField[]>(defaultFields);
  const [formData, setFormData] = useState<Record<string, string>>({});

  // Email duplicate check (debounced)
  const [emailStatus, setEmailStatus] = useState<'idle' | 'checking' | 'exists' | 'available'>('idle');
  const [existingContactName, setExistingContactName] = useState('');
  const emailCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkEmailDuplicate = (email: string) => {
    if (emailCheckTimer.current) clearTimeout(emailCheckTimer.current);
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) {
      setEmailStatus('idle');
      setExistingContactName('');
      return;
    }
    setEmailStatus('checking');
    emailCheckTimer.current = setTimeout(async () => {
      try {
        const org = await getOrg();
        const { data } = await (supabaseSaas as any).schema('crm')
          .from('contatos')
          .select('nome')
          .eq('org', org)
          .ilike('email', trimmed)
          .is('deletado_em', null)
          .limit(1)
          .maybeSingle();
        if (data) {
          setEmailStatus('exists');
          setExistingContactName(data.nome || 'Contato existente');
        } else {
          setEmailStatus('available');
          setExistingContactName('');
        }
      } catch {
        setEmailStatus('idle');
      }
    }, 400);
  };

  const updateFormField = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    if (key === 'email') checkEmailDuplicate(value);
  };
  const removeField = (key: string) => {
    setFormFields(prev => prev.filter(f => f.key !== key));
    setFormData(prev => { const next = { ...prev }; delete next[key]; return next; });
  };
  const [addingField, setAddingField] = useState(false);
  const [newFieldName, setNewFieldName] = useState('');
  const confirmAddField = () => {
    if (!newFieldName.trim()) { setAddingField(false); return; }
    const key = newFieldName.trim().toLowerCase().replace(/\s+/g, '_');
    if (!formFields.some(f => f.key === key)) {
      setFormFields(prev => [...prev, { key, label: newFieldName.trim(), placeholder: newFieldName.trim() }]);
    }
    setAddingField(false);
    setNewFieldName('');
  };

  const createContact = useCreateContact();
  const { data: saasUsers = [] } = useSaasUsers();

  // Close filter dropdown on outside click
  useEffect(() => {
    if (!openChip) return;
    const handler = (e: MouseEvent) => {
      if (chipAreaRef.current && !chipAreaRef.current.contains(e.target as Node)) {
        setOpenChip(null);
        setChipSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openChip]);

  const { data: result, isLoading } = useCrmContacts({
    search: search || undefined,
    status: activeFilters.status || undefined,
    page,
    perPage,
    orderBy: 'criado_em',
    orderDir: 'desc',
  });

  const contacts = useMemo(() => {
    let list = result?.data || [];
    for (const [key, val] of Object.entries(activeFilters)) {
      if (!val) continue;
      if (key === 'proprietario_id') list = list.filter(c => c.proprietario_id === val);
      else if (key === 'status') list = list.filter(c => c.status === val);
      else if (key === 'fonte') list = list.filter(c => c.fonte === val);
      else if (key === 'cargo') list = list.filter(c => (c as any).cargo?.toLowerCase().includes(val.toLowerCase()));
      else if (key === 'criado_em') {
        const { start, end } = getDateRange(val);
        list = list.filter(c => { const t = new Date(c.criado_em).getTime(); return t >= start.getTime() && t < end.getTime(); });
      }
    }
    // Apply advanced filters
    for (const af of advancedFilters) {
      if (!af.property) continue;
      if (af.operator === 'is_known') list = list.filter(c => (c as any)[af.property] != null && (c as any)[af.property] !== '');
      else if (af.operator === 'is_unknown') list = list.filter(c => (c as any)[af.property] == null || (c as any)[af.property] === '');
      else if (af.operator === 'is_any' && af.value) list = list.filter(c => String((c as any)[af.property] ?? '').toLowerCase().includes(af.value.toLowerCase()));
      else if (af.operator === 'is_none' && af.value) list = list.filter(c => !String((c as any)[af.property] ?? '').toLowerCase().includes(af.value.toLowerCase()));
    }
    list.sort((a: any, b: any) => {
      const aVal = sortField === 'nome' ? (a.nome || '').toLowerCase() : new Date(a[sortField]).getTime();
      const bVal = sortField === 'nome' ? (b.nome || '').toLowerCase() : new Date(b[sortField]).getTime();
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [result?.data, activeFilters, advancedFilters, sortField, sortDirection]);
  const total = result?.total || 0;
  const totalPages = result?.totalPages || 1;

  const handleExport = () => {
    const headers = ['Nome', 'E-mail', 'Telefone', 'Status', 'Fonte', 'Cargo', 'Score', 'Data de criação'];
    const rows = contacts.map(c => [
      c.nome,
      c.email,
      c.telefone,
      c.status,
      c.fonte,
      (c as any).cargo,
      c.score,
      c.criado_em ? new Date(c.criado_em).toLocaleDateString('pt-BR') : '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contatos_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const submittingRef = useRef(false);
  const handleCreateContact = async () => {
    if (submittingRef.current) return;
    const email = (formData.email || '').trim();
    const nome = (formData.nome || '').trim();
    const sobrenome = (formData.sobrenome || '').trim();
    if (!email || !nome) return;
    submittingRef.current = true;

    // Build DB payload from form data
    const dbPayload: Record<string, any> = {
      nome: sobrenome ? `${nome} ${sobrenome}` : nome,
      email,
      status: 'lead',
      fonte: 'outros',
    };

    // Map known fields
    for (const field of formFields) {
      const val = (formData[field.key] || '').trim();
      if (!val || field.key === 'email' || field.key === 'nome' || field.key === 'sobrenome') continue;
      if (field.dbField) {
        dbPayload[field.dbField] = val;
      } else {
        // Custom fields go into dados_custom
        dbPayload.dados_custom = { ...(dbPayload.dados_custom || {}), [field.key]: val };
      }
    }

    try {
      await createContact.mutateAsync(dbPayload as any);
      setShowCreateModal(false);
      setFormData({});
      toast({ title: 'Contato criado com sucesso' });
    } catch (err: any) {
      const msg = err?.message?.includes('idx_crm_contatos_email_unique') ? 'Já existe um contato com este e-mail' : 'Erro ao criar contato';
      toast({ title: msg, variant: 'destructive' });
    } finally { submittingRef.current = false; }
  };

  const paginationNumbers = useMemo(() => {
    const pages: number[] = [];
    const maxVisible = 11;
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      const start = Math.max(2, page - 3);
      const end = Math.min(totalPages - 1, page + 3);
      if (start > 2) pages.push(-1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (end < totalPages - 1) pages.push(-2);
      pages.push(totalPages);
    }
    return pages;
  }, [page, totalPages]);

  return (
    <div className="flex flex-col h-full">
      {/* Top tabs bar */}
      <div className="flex items-center justify-between px-4 border-b border-border bg-card flex-shrink-0">
        <div className="flex items-center gap-0">
          <div className="flex items-center gap-1.5 px-3 py-2 border-r border-border">
            <Contact className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Contatos</span>
          </div>
          {/* Default view */}
          <button
            onClick={() => { setActiveTab('all'); setActiveFilters({}); setPage(1); }}
            className={cn(
              'px-3 py-2.5 text-sm transition-colors border-b-2 -mb-px',
              activeTab === 'all'
                ? 'border-foreground text-foreground font-medium'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            Todos os contatos
            {total > 0 && (
              <Badge variant="outline" className="ml-1.5 text-[10px] h-5 px-1.5 rounded-sm font-semibold">
                {formatCount(total)}
              </Badge>
            )}
          </button>

          {/* Saved views as tabs */}
          {savedViews.map(view => (
            <div key={view.id} className="relative flex items-center">
              {editingViewId === view.id ? (
                <div className="flex items-center gap-1 px-2 py-1.5">
                  <input
                    autoFocus
                    value={editingViewName}
                    onChange={e => setEditingViewName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleRenameView(view.id); if (e.key === 'Escape') setEditingViewId(null); }}
                    onBlur={() => handleRenameView(view.id)}
                    className="text-sm font-medium bg-transparent border-b border-primary outline-none w-[120px] text-foreground"
                  />
                </div>
              ) : (
                <button
                  onClick={() => { setActiveTab(view.id); setActiveFilters(view.filters || {}); setPage(1); }}
                  onDoubleClick={() => { setEditingViewId(view.id); setEditingViewName(view.label); }}
                  className={cn(
                    'flex items-center gap-1 px-3 py-2.5 text-sm transition-colors border-b-2 -mb-px',
                    activeTab === view.id
                      ? 'border-foreground text-foreground font-medium'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  )}
                >
                  {view.label}
                  <span
                    onClick={(e) => { e.stopPropagation(); handleDeleteView(view.id); }}
                    className="ml-0.5 text-muted-foreground/50 hover:text-destructive cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </span>
                </button>
              )}
              {/* Save filters indicator */}
              {activeTab === view.id && hasUnsavedFilters && (
                <button
                  onClick={handleSaveFiltersToView}
                  className="ml-0.5 text-primary hover:text-primary/80 transition-colors"
                  title="Salvar filtros nesta visualização"
                >
                  <Save className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}

          {/* Inline new view input */}
          {creatingView && (
            <div className="flex items-center gap-1 px-2 py-1.5 border-b-2 border-primary -mb-px">
              <input
                autoFocus
                value={newViewName}
                onChange={e => setNewViewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') confirmCreateView(); if (e.key === 'Escape') setCreatingView(false); }}
                placeholder="Nome da visualização"
                className="text-sm font-medium bg-transparent border-b border-primary/50 outline-none w-[160px] text-foreground placeholder:text-muted-foreground"
              />
              <button onClick={confirmCreateView} className="text-primary hover:text-primary/80 p-0.5" title="Confirmar">
                <CheckCircle2 className="w-4 h-4" />
              </button>
              <button onClick={() => setCreatingView(false)} className="text-muted-foreground hover:text-destructive p-0.5" title="Cancelar">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* + Button with dropdown */}
          <div ref={viewMenuRef} className="relative">
            <button
              className="flex items-center justify-center w-8 h-8 rounded-full border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors ml-1"
              onClick={() => { setShowViewMenu(v => !v); setShowViewList(false); }}
            >
              <Plus className="w-4 h-4" />
            </button>

            {showViewMenu && !showViewList && (
              <div className="absolute left-0 top-full mt-1 z-40 min-w-[220px] py-1 rounded-lg border border-border bg-card shadow-xl">
                <button
                  onClick={handleCreateView}
                  className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
                >
                  <Plus className="w-4 h-4 text-muted-foreground" />
                  Criar nova exibição
                </button>
                {savedViews.length > 0 && (
                  <button
                    onClick={() => setShowViewList(true)}
                    className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors border-t border-border"
                  >
                    <Table2 className="w-4 h-4 text-muted-foreground" />
                    Adicionar visualização ({savedViews.length})
                  </button>
                )}
              </div>
            )}

            {showViewList && (
              <div className="absolute left-0 top-full mt-1 z-40 w-[280px] rounded-lg border border-border bg-card shadow-xl overflow-hidden">
                <div className="px-3 py-2 border-b border-border">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Visualizações salvas ({savedViews.length})</p>
                </div>
                <div className="max-h-[240px] overflow-y-auto">
                  {savedViews.map(v => (
                    <button
                      key={v.id}
                      onClick={() => {
                        setActiveTab(v.id);
                        setActiveFilters(v.filters || {});
                        setPage(1);
                        setShowViewMenu(false);
                        setShowViewList(false);
                      }}
                      className={cn(
                        'flex items-center gap-2.5 w-full px-4 py-2.5 text-sm transition-colors',
                        activeTab === v.id ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-muted'
                      )}
                    >
                      <Table2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="truncate">{v.label}</span>
                      {Object.keys(v.filters).length > 0 && (
                        <span className="ml-auto text-[10px] text-muted-foreground">{Object.keys(v.filters).length} filtros</span>
                      )}
                    </button>
                  ))}
                </div>
                <div className="px-3 py-2 border-t border-border">
                  <button onClick={handleCreateView} className="text-xs text-primary hover:underline">
                    + Criar nova exibição
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => navigate('/crm/0-5?object=contact')}>Editar propriedades</DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/crm/restore?type=0-1')}>Restaurar registros</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" className="gap-1.5 h-8" onClick={() => { setShowCreateModal(true); setFormData({}); setEmailStatus('idle'); setExistingContactName(''); setFormFields([...defaultFields]); }}>
            Adicionar contatos <ChevronRight className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card flex-shrink-0">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="pl-9 h-8 text-sm"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                <SlidersHorizontal className="w-3.5 h-3.5" /> Editar colunas
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 p-0">
              <div className="p-2 border-b border-border">
                <Input placeholder="Pesquisar coluna..." value={columnSearch} onChange={e => setColumnSearch(e.target.value)} className="h-7 text-xs" />
              </div>
              <div className="max-h-64 overflow-y-auto py-1">
                {CONTACT_COLUMNS.filter(col => col.label.toLowerCase().includes(columnSearch.toLowerCase())).map(col => (
                  <label key={col.key} className={cn("flex items-center gap-2 px-3 py-1.5 cursor-pointer text-xs hover:bg-muted/50", col.pinned && "opacity-60")}>
                    <input type="checkbox" checked={col.pinned || visibleColumns.includes(col.key)} disabled={col.pinned}
                      onChange={() => setVisibleColumns(prev => prev.includes(col.key) ? prev.filter(k => k !== col.key) : [...prev, col.key])}
                      className="rounded border-border accent-primary" />
                    <span>{col.label}</span>
                    {col.pinned && <span className="text-[10px] text-muted-foreground ml-auto">Fixada</span>}
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <Button variant="outline" size="sm" className={cn("h-8 gap-1.5 text-xs font-medium", showFilters && "bg-muted")} onClick={() => setShowFilters(f => !f)}>
            <Filter className="w-3.5 h-3.5" /> Filtros
          </Button>
          <DropdownMenu open={showSortMenu} onOpenChange={setShowSortMenu}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs"><ArrowUpDown className="w-3.5 h-3.5" /> Classificar</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <p className="text-[11px] text-muted-foreground font-semibold px-2 py-1">Classificar por</p>
              {([['criado_em', 'Data de criação'], ['atualizado_em', 'Última modificação'], ['nome', 'Nome']] as const).map(([key, label]) => (
                <DropdownMenuItem key={key} onClick={() => setSortField(key)} className={cn(sortField === key && 'bg-muted font-medium')}>{label}</DropdownMenuItem>
              ))}
              <div className="border-t border-border my-1" />
              <div className="flex gap-1 px-2 py-1">
                <button onClick={() => { setSortDirection('desc'); setShowSortMenu(false); }} className={cn('flex-1 text-xs py-1 rounded', sortDirection === 'desc' ? 'bg-foreground text-background font-medium' : 'hover:bg-muted')}>Mais recente</button>
                <button onClick={() => { setSortDirection('asc'); setShowSortMenu(false); }} className={cn('flex-1 text-xs py-1 rounded', sortDirection === 'asc' ? 'bg-foreground text-background font-medium' : 'hover:bg-muted')}>Mais antigo</button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
            <BarChart3 className="w-3.5 h-3.5" /> Métrica
          </Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={handleExport}>
            <Download className="w-3.5 h-3.5" /> Exportar
          </Button>
        </div>
      </div>

      {/* Filter chips row */}
      {showFilters && (
        <div ref={chipAreaRef} className="flex items-center gap-2 px-4 py-2 border-b border-border bg-card flex-shrink-0 text-xs flex-wrap">
          {CONTACT_FILTERS.map(f => {
            const isOpen = openChip === f.key;
            const hasValue = !!activeFilters[f.key];
            let options = f.options || [];
            if (f.key === 'proprietario_id') options = saasUsers.map((u: any) => ({ value: u.id, label: u.nome }));
            const selectedLabel = hasValue ? (f.type === 'text' ? activeFilters[f.key] : options.find(o => o.value === activeFilters[f.key])?.label) : null;

            return (
              <div key={f.key} className="relative">
                <button
                  onClick={() => { setOpenChip(isOpen ? null : f.key); setChipSearch(''); }}
                  className={cn(
                    'flex items-center gap-1 font-medium px-2 py-1 rounded-md transition-colors',
                    hasValue ? 'bg-primary/15 text-primary border border-primary/30' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                >
                  {f.label}{selectedLabel ? `: ${selectedLabel}` : ''} <ChevronDown className="w-3 h-3" />
                  {hasValue && (
                    <span onClick={(e) => { e.stopPropagation(); setActiveFilters(prev => { const n = { ...prev }; delete n[f.key]; return n; }); setOpenChip(null); }}
                      className="ml-0.5 hover:text-destructive"><X className="w-3 h-3" /></span>
                  )}
                </button>
                {isOpen && (
                  <div className="absolute top-full left-0 mt-1 z-30 bg-card border border-border rounded-lg shadow-lg min-w-[200px] max-h-60 overflow-y-auto">
                    {(f.type === 'select' && options.length > 0) ? (() => {
                      const filtered = chipSearch ? options.filter(o => o.label.toLowerCase().includes(chipSearch.toLowerCase())) : options;
                      return (
                      <div className="py-1">
                        {options.length > 5 && (
                          <div className="px-2 pb-1 border-b border-border mb-1">
                            <div className="relative">
                              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                              <Input className="pl-7 text-xs h-7" placeholder="Pesquisar..." value={chipSearch} onChange={e => setChipSearch(e.target.value)} autoFocus />
                            </div>
                          </div>
                        )}
                        <button onClick={() => { setActiveFilters(prev => { const n = { ...prev }; delete n[f.key]; return n; }); setOpenChip(null); }}
                          className={cn('w-full text-left px-3 py-1.5 text-xs hover:bg-muted', !hasValue && 'font-medium')}>
                          Todos
                        </button>
                        <div className="max-h-48 overflow-y-auto">
                          {filtered.map(o => (
                            <button key={o.value} onClick={() => { setActiveFilters(prev => ({ ...prev, [f.key]: o.value })); setOpenChip(null); }}
                              className={cn('w-full text-left px-3 py-1.5 text-xs hover:bg-muted', activeFilters[f.key] === o.value && 'bg-muted font-medium')}>
                              <span>{o.label}</span>
                              {o.sub && <span className="block text-[10px] text-muted-foreground">{o.sub}</span>}
                            </button>
                          ))}
                          {filtered.length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">Nenhum resultado</p>}
                        </div>
                      </div>);
                    })() : f.type === 'text' ? (
                      <div className="p-2">
                        <Input className="text-xs h-8" placeholder={`Filtrar por ${f.label.toLowerCase()}...`}
                          value={activeFilters[f.key] || ''}
                          onChange={e => setActiveFilters(prev => e.target.value ? { ...prev, [f.key]: e.target.value } : (() => { const n = { ...prev }; delete n[f.key]; return n; })())}
                          onKeyDown={e => e.key === 'Enter' && setOpenChip(null)}
                          autoFocus />
                      </div>
                    ) : (
                      <div className="p-2 text-xs text-muted-foreground">Em breve</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          <button onClick={() => setShowAdvancedFilters(true)} className="flex items-center gap-1 text-muted-foreground hover:text-foreground font-medium px-2 py-1">
            <SlidersHorizontal className="w-3 h-3" /> Filtros avançados
          </button>
          {Object.keys(activeFilters).length > 0 && (
            <>
              <div className="w-px h-4 bg-border" />
              <button onClick={() => setActiveFilters({})} className="text-destructive hover:text-destructive/80 font-medium px-2 py-1">
                Limpar filtros
              </button>
            </>
          )}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : contacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <Contact className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm">Nenhum contato encontrado</p>
          </div>
        ) : (
          <table className="w-full min-w-max text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-border bg-muted/50">
                <th className="w-10 px-3 py-2.5">
                  <input type="checkbox" className="rounded border-border" />
                </th>
                {activeColumns.map(col => (
                  <th key={col.key} className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">
                    {col.key === 'criado_em' ? (
                      <button className="flex items-center gap-1">{col.label} (GMT-3) <ArrowUpDown className="w-3 h-3" /></button>
                    ) : col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {contacts.map(contact => (
                <tr key={contact.id} onClick={() => navigate(`/crm/record/0-1/${contact.numero_registro}`)} className="border-b border-border hover:bg-muted/20 transition-colors group cursor-pointer">
                  <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" className="rounded border-border" />
                  </td>
                  {activeColumns.map(col => (
                    <td key={col.key} className="px-3 py-2.5">{col.render(contact)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-center gap-2 px-4 py-3 border-t border-border bg-card flex-shrink-0">
        <button
          disabled={page <= 1}
          onClick={() => setPage(p => p - 1)}
          className={cn('flex items-center gap-1 text-sm', page <= 1 ? 'text-muted-foreground/30 cursor-not-allowed' : 'text-muted-foreground hover:text-foreground')}
        >
          <ChevronLeft className="w-4 h-4" /> Voltar
        </button>
        <div className="flex items-center gap-0.5">
          {paginationNumbers.map((p, idx) =>
            p < 0 ? (
              <span key={`ellipsis-${idx}`} className="px-1 text-muted-foreground">…</span>
            ) : (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={cn(
                  'min-w-[32px] h-8 px-2 text-sm rounded transition-colors',
                  p === page
                    ? 'border border-foreground font-semibold text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {p}
              </button>
            )
          )}
        </div>
        <button
          disabled={page >= totalPages}
          onClick={() => setPage(p => p + 1)}
          className={cn('flex items-center gap-1 text-sm', page >= totalPages ? 'text-muted-foreground/30 cursor-not-allowed' : 'text-muted-foreground hover:text-foreground')}
        >
          Próximo <ChevronRight className="w-4 h-4" />
        </button>
        <div className="w-px h-5 bg-border mx-2" />
        <span className="text-xs text-muted-foreground">{total} registros</span>
        <div className="w-px h-5 bg-border mx-2" />
        <Select value={String(perPage)} onValueChange={v => { setPerPage(Number(v)); setPage(1); }}>
          <SelectTrigger className="h-8 w-auto gap-1 text-sm border-0 shadow-none">
            <SelectValue />
            <span className="text-muted-foreground">por página</span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="25">25</SelectItem>
            <SelectItem value="50">50</SelectItem>
            <SelectItem value="100">100</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Create Contact Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowCreateModal(false)} />
          <div className="relative w-[440px] h-full bg-card border-l border-border shadow-xl overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-base font-semibold">Criar Contato</h2>
              <button onClick={() => setShowCreateModal(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
            <div className="px-6 py-4 space-y-4">
              {formFields.map(field => (
                <div key={field.key}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium">
                      {field.label}{field.required ? ' *' : ''}
                    </label>
                    {!field.required && (
                      <button
                        onClick={() => removeField(field.key)}
                        className="text-muted-foreground hover:text-destructive transition-colors p-0.5"
                        title={`Remover ${field.label}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {field.type === 'tel' ? (
                    <PhoneInput
                      value={formData[field.key] || ''}
                      onChange={val => updateFormField(field.key, val)}
                      placeholder="11 99999-0000"
                      className="mt-0.5"
                    />
                  ) : (
                    <Input
                      value={formData[field.key] || ''}
                      onChange={e => updateFormField(field.key, e.target.value)}
                      placeholder={field.placeholder || field.label}
                      type={field.type || 'text'}
                      className={cn('mt-0.5', field.key === 'email' && emailStatus === 'exists' && 'border-destructive focus:border-destructive')}
                    />
                  )}
                  {/* Email duplicate warning */}
                  {field.key === 'email' && emailStatus === 'exists' && (
                    <div className="flex items-center gap-1.5 mt-1.5 px-2.5 py-1.5 rounded-md bg-destructive/10 border border-destructive/20">
                      <span className="text-xs text-destructive">
                        Já existe um contato com este e-mail: <strong>{existingContactName}</strong>
                      </span>
                      <button
                        className="ml-auto text-[10px] text-primary hover:underline whitespace-nowrap"
                        onClick={() => {
                          const contacts = result?.data || [];
                          const match = contacts.find(c => c.email?.toLowerCase() === (formData.email || '').trim().toLowerCase());
                          if (match) {
                            setShowCreateModal(false);
                            navigate(`/crm/record/0-1/${match.numero_registro}`);
                          }
                        }}
                      >
                        Ver contato
                      </button>
                    </div>
                  )}
                  {field.key === 'email' && emailStatus === 'checking' && (
                    <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Verificando...
                    </p>
                  )}
                </div>
              ))}
              {addingField ? (
                <div className="flex items-center gap-1.5">
                  <Input
                    autoFocus
                    value={newFieldName}
                    onChange={e => setNewFieldName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') confirmAddField(); if (e.key === 'Escape') setAddingField(false); }}
                    placeholder="Nome da propriedade"
                    className="h-8 text-xs w-40"
                  />
                  <button onClick={confirmAddField} className="text-primary"><CheckCircle2 className="w-4 h-4" /></button>
                  <button onClick={() => setAddingField(false)} className="text-muted-foreground hover:text-destructive"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <button
                  onClick={() => { setAddingField(true); setNewFieldName(''); }}
                  className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors py-1"
                >
                  <PlusCircle className="w-3.5 h-3.5" /> Adicionar propriedade
                </button>
              )}
            </div>
            <div className="px-6 py-4 border-t border-border flex gap-2">
              <Button onClick={handleCreateContact} disabled={!(formData.email || '').trim() || !(formData.nome || '').trim() || createContact.isPending || emailStatus === 'exists'}>
                {createContact.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                Criar
              </Button>
              <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancelar</Button>
            </div>
          </div>
        </div>
      )}

      {/* Advanced Filters Sheet */}
      <Sheet open={showAdvancedFilters} onOpenChange={setShowAdvancedFilters}>
        <SheetContent side="right" className="w-[420px] sm:max-w-[420px] p-0 flex flex-col">
          <SheetHeader className="px-6 py-4 border-b border-border">
            <SheetTitle className="text-base">Todos os filtros</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <p className="text-sm font-semibold mb-4">Filtros avançados</p>
            {advancedFilters.length === 0 && (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground mb-3">Esta exibição não tem filtros avançados.</p>
              </div>
            )}
            {advancedFilters.map((af, idx) => (
              <div key={idx} className="border border-border rounded-lg p-3 mb-3 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <select className="w-full text-xs border border-border rounded px-2 py-1.5 bg-background" value={af.property}
                      onChange={e => { const nf = [...advancedFilters]; nf[idx] = { ...af, property: e.target.value }; setAdvancedFilters(nf); }}>
                      <option value="">Selecionar propriedade</option>
                      {CONTACT_ADV_PROPERTIES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                    </select>
                  </div>
                  <button onClick={() => setAdvancedFilters(f => f.filter((_, i) => i !== idx))}><X className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" /></button>
                </div>
                <select className="w-full text-xs border border-border rounded px-2 py-1.5 bg-background" value={af.operator}
                  onChange={e => { const nf = [...advancedFilters]; nf[idx] = { ...af, operator: e.target.value }; setAdvancedFilters(nf); }}>
                  <option value="is_any">é qualquer um de</option>
                  <option value="is_none">não é nenhum de</option>
                  <option value="is_known">é conhecido</option>
                  <option value="is_unknown">é desconhecido</option>
                </select>
                {(af.operator === 'is_any' || af.operator === 'is_none') && (
                  <Input className="text-xs h-8" placeholder="Pesquisar..." value={af.value}
                    onChange={e => { const nf = [...advancedFilters]; nf[idx] = { ...af, value: e.target.value }; setAdvancedFilters(nf); }} />
                )}
              </div>
            ))}
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setAdvancedFilters(f => [...f, { property: '', operator: 'is_any', value: '' }])}>
              <Plus className="w-3 h-3 mr-1" /> Adicionar filtro
            </Button>
          </div>
          <div className="px-6 py-4 border-t border-border">
            <Button className="w-full" onClick={() => setShowAdvancedFilters(false)}>Aplicar filtros</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
