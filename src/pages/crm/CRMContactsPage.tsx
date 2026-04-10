import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Search, Plus, Filter, ExternalLink, MoreHorizontal, X,
  ChevronLeft, ChevronRight, ChevronDown, Download, Contact, Settings2,
  ArrowUpDown, BarChart3, Copy, Table2, SlidersHorizontal, Loader2,
  Trash2, PlusCircle,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import PhoneInput from '@/components/ui/phone-input';
import { useCrmContacts, useCreateContact, useSaasUsers } from '@/hooks/useCrm';
import { useToast } from '@/hooks/use-toast';
import type { ContactStatus } from '@/types/crm';

const STATUS_CONFIG: Record<ContactStatus, { label: string; class: string }> = {
  lead:      { label: 'Lead',        class: 'bg-muted text-muted-foreground' },
  qualified: { label: 'Qualificado', class: 'bg-warning/15 text-warning' },
  customer:  { label: 'Cliente',     class: 'bg-success/15 text-success' },
  churned:   { label: 'Churned',     class: 'bg-destructive/15 text-destructive' },
};

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

const TABS = [
  { id: 'all', label: 'Todos os contatos' },
  { id: 'lead', label: '1. Lead' },
  { id: 'qualified', label: '2. Qualificado' },
  { id: 'customer', label: '3. Cliente' },
  { id: 'churned', label: '4. Churned' },
];

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

  const updateFormField = (key: string, value: string) => setFormData(prev => ({ ...prev, [key]: value }));
  const removeField = (key: string) => {
    setFormFields(prev => prev.filter(f => f.key !== key));
    setFormData(prev => { const next = { ...prev }; delete next[key]; return next; });
  };
  const addField = () => {
    const name = prompt('Nome da propriedade:');
    if (!name?.trim()) return;
    const key = name.trim().toLowerCase().replace(/\s+/g, '_');
    if (formFields.some(f => f.key === key)) return;
    setFormFields(prev => [...prev, { key, label: name.trim(), placeholder: name.trim() }]);
  };

  const createContact = useCreateContact();
  const { data: saasUsers = [] } = useSaasUsers();
  const [showFilters, setShowFilters] = useState(true);
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [openChip, setOpenChip] = useState<string | null>(null);
  const [chipSearch, setChipSearch] = useState('');

  const { data: result, isLoading } = useCrmContacts({
    search: search || undefined,
    status: activeTab !== 'all' ? activeTab : undefined,
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
    return list;
  }, [result?.data, activeFilters]);
  const total = result?.total || 0;
  const totalPages = result?.totalPages || 1;

  const handleCreateContact = async () => {
    const email = (formData.email || '').trim();
    const nome = (formData.nome || '').trim();
    const sobrenome = (formData.sobrenome || '').trim();
    if (!email || !nome) return;

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
    }
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
              <DropdownMenuItem onClick={() => navigate('/crm/0-5?object=contact')}>Editar propriedades</DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/crm/restore?type=0-1')}>Restaurar registros</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" className="gap-1.5 h-8" onClick={() => setShowCreateModal(true)}>
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
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
            <Table2 className="w-3.5 h-3.5" /> Exibição de tabela
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Settings2 className="w-3.5 h-3.5" />
          </Button>
          <div className="w-px h-5 bg-border mx-1" />
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
            Editar colunas
          </Button>
          <Button variant="outline" size="sm" className={cn("h-8 gap-1.5 text-xs font-medium", showFilters && "bg-muted")} onClick={() => setShowFilters(f => !f)}>
            <Filter className="w-3.5 h-3.5" /> Filtros
          </Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
            <ArrowUpDown className="w-3.5 h-3.5" /> Classificar
          </Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
            <BarChart3 className="w-3.5 h-3.5" /> Métrica
          </Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
            <Download className="w-3.5 h-3.5" /> Exportar
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Copy className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Filter chips row */}
      {showFilters && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-card flex-shrink-0 text-xs flex-wrap">
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
          <button className="text-muted-foreground hover:text-foreground font-medium px-2 py-1">+ Mais</button>
          <div className="w-px h-4 bg-border" />
          <button className="flex items-center gap-1 text-muted-foreground hover:text-foreground font-medium px-2 py-1">
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
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-border bg-muted/50">
                <th className="w-10 px-3 py-2.5">
                  <input type="checkbox" className="rounded border-border" />
                </th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">Nome</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">ID do registro</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">
                  <button className="flex items-center gap-1">Data de criação (GMT-3) <ArrowUpDown className="w-3 h-3" /></button>
                </th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">E-mail</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">Número de telefone</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">Fonte</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">Status</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map(contact => {
                const st = STATUS_CONFIG[contact.status];
                return (
                  <tr key={contact.id} onClick={() => navigate(`/crm/record/0-1/${contact.numero_registro}`)} className="border-b border-border hover:bg-muted/20 transition-colors group cursor-pointer">
                    <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" className="rounded border-border" />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                          {contact.nome.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <span className="font-medium text-primary hover:underline cursor-pointer text-sm truncate max-w-[200px]">
                          {contact.nome}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground text-xs font-mono">
                      {contact.numero_registro}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground text-xs">
                      {new Date(contact.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-3 py-2.5">
                      {contact.email ? (
                        <a href={`mailto:${contact.email}`} className="text-muted-foreground hover:text-primary text-xs flex items-center gap-1 truncate max-w-[200px]">
                          {contact.email} <ExternalLink className="w-2.5 h-2.5 flex-shrink-0 opacity-0 group-hover:opacity-100" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground/40 text-xs">--</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {contact.telefone ? (
                        <span className="text-primary text-xs font-medium">{contact.telefone}</span>
                      ) : (
                        <span className="text-muted-foreground/40 text-xs">--</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground text-xs">{contact.fonte || '--'}</td>
                    <td className="px-3 py-2.5">
                      <Badge className={cn('text-[10px] px-1.5 rounded-sm', st.class)}>{st.label}</Badge>
                    </td>
                  </tr>
                );
              })}
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
                      className="mt-0.5"
                    />
                  )}
                </div>
              ))}
              <button
                onClick={addField}
                className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors py-1"
              >
                <PlusCircle className="w-3.5 h-3.5" /> Adicionar propriedade
              </button>
            </div>
            <div className="px-6 py-4 border-t border-border flex gap-2">
              <Button onClick={handleCreateContact} disabled={!(formData.email || '').trim() || !(formData.nome || '').trim() || createContact.isPending}>
                {createContact.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                Criar
              </Button>
              <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancelar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
