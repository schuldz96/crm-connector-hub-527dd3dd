import { useState, useMemo, useEffect, useRef, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Search, Plus, Filter, MoreHorizontal, X, ChevronDown,
  ChevronLeft, ChevronRight, Download, Factory, Trash2,
  ArrowUpDown, BarChart3, Copy, SlidersHorizontal, Loader2,
  PlusCircle, CheckCircle2, UserPlus, Pencil,
} from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useCrmCompanies, useCreateCompany, useUpdateCompany, useSaasUsers } from '@/hooks/useCrm';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

// Column editor — all available company properties
const COMPANIES_COLUMNS_KEY = 'crm_companies_visible_columns';
const COMPANY_DEFAULT_COLUMNS = ['nome', 'numero_registro', 'criado_em', 'telefone', 'plataforma', 'cidade', 'pais'];

type CompanyColumnDef = { key: string; label: string; pinned?: boolean; render: (c: any) => ReactNode };

const COMPANY_COLUMNS: CompanyColumnDef[] = [
  { key: 'nome', label: 'Nome da empresa', pinned: true, render: (c) => (
    <div className="flex items-center gap-2">
      <div className="w-7 h-7 rounded bg-muted flex items-center justify-center flex-shrink-0">
        <Factory className="w-3.5 h-3.5 text-muted-foreground" />
      </div>
      <span className="font-medium text-primary hover:underline cursor-pointer text-sm">{c.nome}</span>
    </div>
  )},
  { key: 'numero_registro', label: 'ID do registro', render: (c) => <span className="text-muted-foreground text-xs font-mono">{c.numero_registro}</span> },
  { key: 'criado_em', label: 'Data de criação', render: (c) => (
    <span className="text-muted-foreground text-xs">{new Date(c.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
  )},
  { key: 'telefone', label: 'Número de telefone', render: (c) => c.telefone ? (
    <span className="text-primary text-xs font-medium">{c.telefone}</span>
  ) : <span className="text-muted-foreground/40 text-xs">--</span> },
  { key: 'plataforma', label: 'Plataforma', render: (c) => <span className="text-muted-foreground text-xs">{c.plataforma || '--'}</span> },
  { key: 'cidade', label: 'Cidade', render: (c) => <span className="text-muted-foreground text-xs">{c.cidade || '--'}</span> },
  { key: 'pais', label: 'País/Região', render: (c) => <span className="text-muted-foreground text-xs">{c.pais || '--'}</span> },
  { key: 'dominio', label: 'Domínio', render: (c) => <span className="text-muted-foreground text-xs">{c.dominio || '--'}</span> },
  { key: 'cnpj', label: 'CNPJ', render: (c) => <span className="text-muted-foreground text-xs font-mono">{c.cnpj || '--'}</span> },
  { key: 'website', label: 'Website', render: (c) => c.website ? (
    <a href={c.website} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary text-xs truncate max-w-[200px]">{c.website}</a>
  ) : <span className="text-muted-foreground/40 text-xs">--</span> },
  { key: 'endereco', label: 'Endereço', render: (c) => <span className="text-muted-foreground text-xs">{c.endereco || '--'}</span> },
  { key: 'estado', label: 'Estado', render: (c) => <span className="text-muted-foreground text-xs">{c.estado || '--'}</span> },
  { key: 'cep', label: 'CEP', render: (c) => <span className="text-muted-foreground text-xs font-mono">{c.cep || '--'}</span> },
  { key: 'setor', label: 'Setor', render: (c) => <span className="text-muted-foreground text-xs">{c.setor || '--'}</span> },
  { key: 'porte', label: 'Porte', render: (c) => <span className="text-muted-foreground text-xs">{c.porte || '--'}</span> },
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

const COMPANY_FILTERS: FilterDef[] = [
  { key: 'proprietario_id', label: 'Proprietário da empresa', type: 'select' },
  { key: 'criado_em', label: 'Data de criação', type: 'select', options: DATE_OPTIONS },
  { key: 'setor', label: 'Setor', type: 'text' },
  { key: 'porte', label: 'Porte', type: 'text' },
  { key: 'cidade', label: 'Cidade', type: 'text' },
  { key: 'plataforma', label: 'Plataforma', type: 'text' },
];

const COMPANY_ADV_PROPERTIES = [
  { key: 'nome', label: 'Nome' },
  { key: 'dominio', label: 'Domínio' },
  { key: 'cnpj', label: 'CNPJ' },
  { key: 'telefone', label: 'Telefone' },
  { key: 'plataforma', label: 'Plataforma' },
  { key: 'cidade', label: 'Cidade' },
  { key: 'pais', label: 'País' },
  { key: 'estado', label: 'Estado' },
  { key: 'setor', label: 'Setor' },
  { key: 'porte', label: 'Porte' },
  { key: 'tags', label: 'Tags' },
  { key: 'criado_em', label: 'Data de criação' },
  { key: 'atualizado_em', label: 'Atualizado em' },
];

const TABS = [
  { id: 'all', label: 'Todos as empresas' },
  { id: 'mine', label: 'Minhas empresas' },
  { id: 'validation', label: 'Validação manual PaaS' },
];

function formatCount(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)} mi`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)} mil`;
  return String(n);
}

export default function CRMCompaniesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: saasUsers = [] } = useSaasUsers();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(100);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [sortField, setSortField] = useState<'criado_em' | 'atualizado_em' | 'nome'>('criado_em');
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [openChip, setOpenChip] = useState<string | null>(null);
  const [chipSearch, setChipSearch] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<{property: string; operator: string; value: string}[]>(() => {
    try { const s = localStorage.getItem('crm_companies_adv_filters'); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  useEffect(() => { localStorage.setItem('crm_companies_adv_filters', JSON.stringify(advancedFilters)); }, [advancedFilters]);
  // Create company form — dynamic fields
  type FormField = { key: string; label: string; required?: boolean; type?: string; placeholder?: string; dbField?: string };
  const defaultCompanyFields: FormField[] = [
    { key: 'nome', label: 'Nome da empresa', required: true, placeholder: 'Nome da empresa', dbField: 'nome' },
    { key: 'dominio', label: 'Domínio', placeholder: 'exemplo.com.br', dbField: 'dominio' },
    { key: 'cnpj', label: 'CNPJ', placeholder: '00.000.000/0000-00', dbField: 'cnpj' },
    { key: 'telefone', label: 'Telefone', type: 'tel', placeholder: '+55 11 99999-0000', dbField: 'telefone' },
  ];
  const [formFields, setFormFields] = useState<FormField[]>(defaultCompanyFields);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [domainExists, setDomainExists] = useState(false);
  const [checkingDomain, setCheckingDomain] = useState(false);
  const [addingField, setAddingField] = useState(false);
  const [newFieldName, setNewFieldName] = useState('');
  const updateFormField = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };
  const removeField = (key: string) => {
    setFormFields(prev => prev.filter(f => f.key !== key));
    setFormData(prev => { const next = { ...prev }; delete next[key]; return next; });
  };
  const confirmAddField = () => {
    if (!newFieldName.trim()) { setAddingField(false); return; }
    const key = newFieldName.trim().toLowerCase().replace(/\s+/g, '_');
    if (!formFields.some(f => f.key === key)) {
      setFormFields(prev => [...prev, { key, label: newFieldName.trim(), placeholder: newFieldName.trim() }]);
    }
    setAddingField(false);
    setNewFieldName('');
  };
  const checkDomainExists = async (domain: string) => {
    if (!domain || !domain.includes('.')) { setDomainExists(false); return; }
    setCheckingDomain(true);
    try {
      const org = await import('@/lib/saas').then(m => m.getOrg());
      const { data } = await (supabase as any).schema('crm').from('empresas_crm').select('nome').eq('org', org).ilike('dominio', domain.trim()).is('deletado_em', null).limit(1).maybeSingle();
      setDomainExists(!!data);
    } catch { setDomainExists(false); }
    finally { setCheckingDomain(false); }
  };
  const createCompany = useCreateCompany();
  const updateCompany = useUpdateCompany();

  // Bulk selection state
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignUserId, setAssignUserId] = useState('');

  // Column editor state
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    try { const s = localStorage.getItem(COMPANIES_COLUMNS_KEY); return s ? JSON.parse(s) : COMPANY_DEFAULT_COLUMNS; }
    catch { return COMPANY_DEFAULT_COLUMNS; }
  });
  const [columnSearch, setColumnSearch] = useState('');
  const activeColumns = useMemo(() => COMPANY_COLUMNS.filter(col => col.pinned || visibleColumns.includes(col.key)), [visibleColumns]);
  useEffect(() => { localStorage.setItem(COMPANIES_COLUMNS_KEY, JSON.stringify(visibleColumns)); }, [visibleColumns]);

  const submittingRef = useRef(false);
  const handleCreateCompany = async () => {
    if (submittingRef.current) return;
    const nome = (formData.nome || '').trim();
    if (!nome) return;
    if (domainExists) { toast({ title: 'Domínio já existe', description: 'Use uma empresa existente ou altere o domínio.', variant: 'destructive' }); return; }
    submittingRef.current = true;
    try {
      const dbPayload: Record<string, any> = { nome };
      // Map known fields
      for (const field of formFields) {
        const val = (formData[field.key] || '').trim();
        if (!val || field.key === 'nome') continue;
        if (field.dbField) {
          dbPayload[field.dbField] = val;
        } else {
          dbPayload.dados_custom = { ...(dbPayload.dados_custom || {}), [field.key]: val };
        }
      }
      await createCompany.mutateAsync(dbPayload as any);
      setShowCreateModal(false);
      setFormData({});
      setFormFields(defaultCompanyFields);
      setDomainExists(false);
      toast({ title: 'Empresa criada com sucesso' });
    } catch {
      toast({ title: 'Erro ao criar empresa', variant: 'destructive' });
    } finally { submittingRef.current = false; }
  };

  const { data: result, isLoading } = useCrmCompanies({
    search: search || undefined,
    page,
    perPage,
    orderBy: 'criado_em',
    orderDir: 'desc',
  });

  const companiesRaw = result?.data || [];
  const total = result?.total || 0;
  const totalPages = result?.totalPages || 1;

  // Find current user's saas ID for "Minhas empresas" filter
  const myUserId = useMemo(() => {
    if (!user?.email) return null;
    const match = saasUsers.find(u => u.email.toLowerCase() === user!.email.toLowerCase());
    return match?.id || null;
  }, [user?.email, saasUsers]);

  // Client-side filtering
  const companies = useMemo(() => {
    let list = companiesRaw;
    if (activeTab === 'mine' && myUserId) {
      list = list.filter(c => c.proprietario_id === myUserId);
    }
    for (const [key, val] of Object.entries(activeFilters)) {
      if (!val) continue;
      if (key === 'proprietario_id') list = list.filter(c => c.proprietario_id === val);
      else if (key === 'criado_em') {
        const { start, end } = getDateRange(val);
        list = list.filter(c => { const t = new Date(c.criado_em).getTime(); return t >= start.getTime() && t < end.getTime(); });
      }
      else if (key === 'setor') list = list.filter(c => (c as any).setor?.toLowerCase().includes(val.toLowerCase()));
      else if (key === 'porte') list = list.filter(c => (c as any).porte?.toLowerCase().includes(val.toLowerCase()));
      else if (key === 'cidade') list = list.filter(c => c.cidade?.toLowerCase().includes(val.toLowerCase()));
      else if (key === 'plataforma') list = list.filter(c => c.plataforma?.toLowerCase().includes(val.toLowerCase()));
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
  }, [companiesRaw, activeTab, myUserId, activeFilters, advancedFilters, sortField, sortDirection]);

  const handleExport = () => {
    const headers = ['Nome', 'Domínio', 'CNPJ', 'Telefone', 'Plataforma', 'Cidade', 'País', 'Data de criação'];
    const rows = companies.map(c => [
      c.nome,
      c.dominio,
      c.cnpj,
      c.telefone,
      c.plataforma,
      c.cidade,
      c.pais,
      c.criado_em ? new Date(c.criado_em).toLocaleDateString('pt-BR') : '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `empresas_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleSelectCompany = (id: string) => {
    setSelectedCompanies(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const selectAllCompanies = () => {
    if (selectedCompanies.size === companies.length) setSelectedCompanies(new Set());
    else setSelectedCompanies(new Set(companies.map(c => c.id)));
  };

  const bulkDelete = async () => {
    if (selectedCompanies.size === 0) return;
    setBulkAction(true);
    try {
      const ids = Array.from(selectedCompanies);
      for (const id of ids) {
        await updateCompany.mutateAsync({ id, deletado_em: new Date().toISOString() } as any);
      }
      toast({ title: `${ids.length} empresa(s) excluída(s)` });
      setSelectedCompanies(new Set());
    } catch { toast({ title: 'Erro ao excluir', variant: 'destructive' }); }
    finally { setBulkAction(false); }
  };

  const bulkAssign = async () => {
    if (!assignUserId || selectedCompanies.size === 0) return;
    setBulkAction(true);
    try {
      const ids = Array.from(selectedCompanies);
      for (const id of ids) {
        await updateCompany.mutateAsync({ id, proprietario_id: assignUserId });
      }
      toast({ title: `${ids.length} empresa(s) atribuída(s)` });
      setSelectedCompanies(new Set());
      setShowAssignModal(false);
      setAssignUserId('');
    } catch { toast({ title: 'Erro ao atribuir', variant: 'destructive' }); }
    finally { setBulkAction(false); }
  };

  const paginationNumbers = useMemo(() => {
    const pages: number[] = [];
    if (totalPages <= 11) {
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
            <Factory className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Empresas</span>
          </div>
          {TABS.map((tab, idx) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setPage(1); }}
              className={cn(
                'px-3 py-2.5 text-sm transition-colors border-b-2 -mb-px',
                activeTab === tab.id
                  ? 'border-foreground text-foreground font-medium'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.label}
              {idx === 0 && total > 0 && (
                <Badge variant="outline" className="ml-1.5 text-[10px] h-5 px-1.5 rounded-sm font-semibold">
                  {formatCount(total)}
                </Badge>
              )}
              {idx === 0 && <span className="ml-1 text-muted-foreground/50 cursor-pointer">×</span>}
            </button>
          ))}
          <button className="px-3 py-2.5 text-muted-foreground hover:text-foreground">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => navigate('/crm/0-5?object=company')}>Editar propriedades</DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/crm/restore?type=0-2')}>Restaurar registros</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" className="gap-1.5 h-8" onClick={() => setShowCreateModal(true)}>Adicionar empresas <ChevronRight className="w-3 h-3" /></Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card flex-shrink-0">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Pesquisar" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-9 h-8 text-sm" />
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
                {COMPANY_COLUMNS.filter(col => col.label.toLowerCase().includes(columnSearch.toLowerCase())).map(col => (
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
          <Button variant="outline" size="sm" className={cn("h-8 gap-1.5 text-xs font-medium", showFilters && "bg-muted")} onClick={() => setShowFilters(f => !f)}><Filter className="w-3.5 h-3.5" /> Filtros</Button>
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
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs"><BarChart3 className="w-3.5 h-3.5" /> Métrica</Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={handleExport}><Download className="w-3.5 h-3.5" /> Exportar</Button>
        </div>
      </div>

      {/* Filter chips row */}
      {showFilters && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-card flex-shrink-0 text-xs flex-wrap">
          {COMPANY_FILTERS.map(f => {
            const isOpen = openChip === f.key;
            const hasValue = !!activeFilters[f.key];
            let options = f.options || [];
            if (f.key === 'proprietario_id') options = saasUsers.map(u => ({ value: u.id, label: u.nome }));
            const selectedLabel = hasValue ? options.find(o => o.value === activeFilters[f.key])?.label : null;

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
        ) : companies.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <Factory className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm">Nenhuma empresa encontrada</p>
          </div>
        ) : (
          <table className="w-full min-w-max text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-border bg-muted/50">
                <th className="w-10 px-3 py-2.5"><input type="checkbox" className="rounded border-border" checked={companies.length > 0 && selectedCompanies.size === companies.length} onChange={selectAllCompanies} /></th>
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
              {companies.map(company => (
                <tr key={company.id} onClick={() => navigate(`/crm/record/0-2/${company.numero_registro}`)} className="border-b border-border hover:bg-muted/20 transition-colors group cursor-pointer">
                  <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}><input type="checkbox" className="rounded border-border" checked={selectedCompanies.has(company.id)} onChange={() => toggleSelectCompany(company.id)} /></td>
                  {activeColumns.map(col => (
                    <td key={col.key} className="px-3 py-2.5">{col.render(company)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-center gap-2 px-4 py-3 border-t border-border bg-card flex-shrink-0">
        <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
          className={cn('flex items-center gap-1 text-sm', page <= 1 ? 'text-muted-foreground/30 cursor-not-allowed' : 'text-muted-foreground hover:text-foreground')}>
          <ChevronLeft className="w-4 h-4" /> Voltar
        </button>
        <div className="flex items-center gap-0.5">
          {paginationNumbers.map((p, idx) =>
            p < 0 ? <span key={`e-${idx}`} className="px-1 text-muted-foreground">…</span> : (
              <button key={p} onClick={() => setPage(p)}
                className={cn('min-w-[32px] h-8 px-2 text-sm rounded transition-colors',
                  p === page ? 'border border-foreground font-semibold text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                {p}
              </button>
            )
          )}
        </div>
        <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
          className={cn('flex items-center gap-1 text-sm', page >= totalPages ? 'text-muted-foreground/30 cursor-not-allowed' : 'text-muted-foreground hover:text-foreground')}>
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

      {/* Create Company Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowCreateModal(false)} />
          <div className="relative w-[440px] h-full bg-card border-l border-border shadow-xl overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-base font-semibold">Criar Empresa</h2>
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
                  <Input
                    value={formData[field.key] || ''}
                    onChange={e => { updateFormField(field.key, e.target.value); if (field.key === 'dominio') setDomainExists(false); }}
                    onBlur={field.key === 'dominio' ? () => checkDomainExists(formData[field.key] || '') : undefined}
                    placeholder={field.placeholder || field.label}
                    type={field.type || 'text'}
                    className="mt-0.5"
                  />
                  {field.key === 'dominio' && domainExists && (
                    <p className="text-xs text-destructive mt-1">Este domínio já existe no sistema.</p>
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
              <Button onClick={handleCreateCompany} disabled={!(formData.nome || '').trim() || createCompany.isPending || domainExists}>
                {createCompany.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
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
                  <select className="flex-1 text-xs border border-border rounded px-2 py-1.5 bg-background" value={af.property}
                    onChange={e => { const nf = [...advancedFilters]; nf[idx] = { ...af, property: e.target.value }; setAdvancedFilters(nf); }}>
                    <option value="">Selecionar propriedade</option>
                    {COMPANY_ADV_PROPERTIES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                  </select>
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

      {/* Bulk Actions Bar */}
      {selectedCompanies.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border shadow-lg px-6 py-2.5 flex items-center gap-3">
          <span className="text-sm font-medium">{selectedCompanies.size} empresa(s) selecionada(s)</span>
          <button onClick={selectAllCompanies} className="text-xs text-primary hover:underline">
            Selecionar todas as {companies.length} empresas
          </button>
          <div className="w-px h-5 bg-border" />
          <button onClick={() => setShowAssignModal(true)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted">
            <UserPlus className="w-3.5 h-3.5" /> Atribuir
          </button>
          <button onClick={() => { const name = prompt('Editar nome das empresas selecionadas:'); if (name) { Array.from(selectedCompanies).forEach(id => updateCompany.mutate({ id, nome: name })); toast({ title: 'Empresas atualizadas' }); setSelectedCompanies(new Set()); }}}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted">
            <Pencil className="w-3.5 h-3.5" /> Editar
          </button>
          <button onClick={bulkDelete} disabled={bulkAction}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive px-2 py-1 rounded hover:bg-destructive/10">
            <Trash2 className="w-3.5 h-3.5" /> Excluir
          </button>
          <div className="flex-1" />
          <button onClick={() => setSelectedCompanies(new Set())} className="text-xs text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Assign Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowAssignModal(false)} />
          <div className="relative w-[380px] bg-card border border-border rounded-xl shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="text-base font-semibold">Atribuir proprietário</h2>
              <p className="text-xs text-muted-foreground mt-1">{selectedCompanies.size} empresa(s) selecionada(s)</p>
            </div>
            <div className="px-6 py-4 max-h-72 overflow-y-auto space-y-1">
              {saasUsers.map(u => (
                <button key={u.id} onClick={() => setAssignUserId(u.id)}
                  className={cn('w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 transition-colors',
                    assignUserId === u.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted text-foreground')}>
                  <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-semibold flex-shrink-0">
                    {u.nome?.charAt(0)?.toUpperCase()}
                  </div>
                  {u.nome}
                </button>
              ))}
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowAssignModal(false)}>Cancelar</Button>
              <Button size="sm" onClick={bulkAssign} disabled={!assignUserId || bulkAction}>
                {bulkAction ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                Atribuir
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
