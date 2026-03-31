import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Search, Plus, Filter, MoreHorizontal, X,
  ChevronLeft, ChevronRight, Download, Factory, Settings2,
  ArrowUpDown, BarChart3, Copy, Table2, SlidersHorizontal, Loader2,
} from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useCrmCompanies, useCreateCompany } from '@/hooks/useCrm';
import { useToast } from '@/hooks/use-toast';

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
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(100);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newNome, setNewNome] = useState('');
  const [newDominio, setNewDominio] = useState('');
  const [newCnpj, setNewCnpj] = useState('');
  const [newTelefone, setNewTelefone] = useState('');
  const createCompany = useCreateCompany();

  const handleCreateCompany = async () => {
    if (!newNome.trim()) return;
    try {
      await createCompany.mutateAsync({
        nome: newNome,
        dominio: newDominio || null,
        cnpj: newCnpj || null,
        telefone: newTelefone || null,
      } as any);
      setShowCreateModal(false);
      setNewNome(''); setNewDominio(''); setNewCnpj(''); setNewTelefone('');
      toast({ title: 'Empresa criada com sucesso' });
    } catch {
      toast({ title: 'Erro ao criar empresa', variant: 'destructive' });
    }
  };

  const { data: result, isLoading } = useCrmCompanies({
    search: search || undefined,
    page,
    perPage,
    orderBy: 'criado_em',
    orderDir: 'desc',
  });

  const companies = result?.data || [];
  const total = result?.total || 0;
  const totalPages = result?.totalPages || 1;

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
          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
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
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs"><Table2 className="w-3.5 h-3.5" /> Exibição de tabela</Button>
          <Button variant="ghost" size="icon" className="h-8 w-8"><Settings2 className="w-3.5 h-3.5" /></Button>
          <div className="w-px h-5 bg-border mx-1" />
          <Button variant="outline" size="sm" className="h-8 text-xs">Editar colunas</Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-medium"><Filter className="w-3.5 h-3.5" /> Filtros</Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs"><ArrowUpDown className="w-3.5 h-3.5" /> Classificar</Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs"><BarChart3 className="w-3.5 h-3.5" /> Métrica</Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs"><Download className="w-3.5 h-3.5" /> Exportar</Button>
          <Button variant="ghost" size="icon" className="h-8 w-8"><Copy className="w-3.5 h-3.5" /></Button>
        </div>
      </div>

      {/* Filter chips row */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-card flex-shrink-0 text-xs">
        <button className="flex items-center gap-1 text-muted-foreground hover:text-foreground font-medium">
          Proprietário da empresa <ChevronRight className="w-3 h-3 rotate-90" />
        </button>
        <button className="flex items-center gap-1 text-muted-foreground hover:text-foreground font-medium">
          Data de criação <ChevronRight className="w-3 h-3 rotate-90" />
        </button>
        <button className="flex items-center gap-1 text-muted-foreground hover:text-foreground font-medium">
          Data da última atividade <ChevronRight className="w-3 h-3 rotate-90" />
        </button>
        <button className="flex items-center gap-1 text-muted-foreground hover:text-foreground font-medium">
          Setor <ChevronRight className="w-3 h-3 rotate-90" />
        </button>
        <button className="text-muted-foreground hover:text-foreground font-medium">+ Mais</button>
        <div className="w-px h-4 bg-border" />
        <button className="flex items-center gap-1 text-muted-foreground hover:text-foreground font-medium">
          <SlidersHorizontal className="w-3 h-3" /> Filtros avançados
        </button>
      </div>

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
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-border bg-muted/50">
                <th className="w-10 px-3 py-2.5"><input type="checkbox" className="rounded border-border" /></th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">Nome da empresa</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">ID do registro</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">
                  <button className="flex items-center gap-1">Data de criação (GMT-3) <ArrowUpDown className="w-3 h-3" /></button>
                </th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">Número de telefone</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">Plataforma</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">Cidade</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">País/Região</th>
              </tr>
            </thead>
            <tbody>
              {companies.map(company => (
                <tr key={company.id} onClick={() => navigate(`/crm/record/0-2/${company.numero_registro}`)} className="border-b border-border hover:bg-muted/20 transition-colors group cursor-pointer">
                  <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}><input type="checkbox" className="rounded border-border" /></td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded bg-muted flex items-center justify-center flex-shrink-0">
                        <Factory className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                      <span className="font-medium text-primary hover:underline cursor-pointer text-sm">{company.nome}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground text-xs font-mono">{company.numero_registro}</td>
                  <td className="px-3 py-2.5 text-muted-foreground text-xs">
                    {new Date(company.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-3 py-2.5">
                    {company.telefone ? (
                      <span className="text-primary text-xs font-medium">{company.telefone}</span>
                    ) : (
                      <span className="text-muted-foreground/40 text-xs">--</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground text-xs">{company.plataforma || '--'}</td>
                  <td className="px-3 py-2.5 text-muted-foreground text-xs">{company.cidade || '--'}</td>
                  <td className="px-3 py-2.5 text-muted-foreground text-xs">{company.pais || '--'}</td>
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
              <div>
                <label className="text-sm font-medium">Nome da empresa *</label>
                <Input value={newNome} onChange={e => setNewNome(e.target.value)} placeholder="Nome da empresa" className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Domínio</label>
                <Input value={newDominio} onChange={e => setNewDominio(e.target.value)} placeholder="empresa.com.br" className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">CNPJ</label>
                <Input value={newCnpj} onChange={e => setNewCnpj(e.target.value)} placeholder="00.000.000/0000-00" className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Telefone</label>
                <Input value={newTelefone} onChange={e => setNewTelefone(e.target.value)} placeholder="+55 11 99999-0000" className="mt-1" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border flex gap-2">
              <Button onClick={handleCreateCompany} disabled={!newNome.trim() || createCompany.isPending}>
                {createCompany.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
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
