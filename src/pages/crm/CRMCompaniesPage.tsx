import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Search, Plus, Filter, ExternalLink, MoreHorizontal,
  ChevronLeft, ChevronRight, Download, Factory, Settings2,
  ArrowUpDown, BarChart3, Copy, Table2, SlidersHorizontal,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface Company {
  id: string;
  name: string;
  owner: string;
  phone: string;
  city: string;
  country: string;
  createdAt: string;
  lastActivity: string;
}

const TABS = [
  { id: 'all', label: 'Todos as empresas', count: 300300 },
  { id: 'mine', label: 'Minhas empresas' },
  { id: 'validation', label: 'Validação manual PaaS' },
];

const MOCK_COMPANIES: Company[] = Array.from({ length: 60 }, (_, i) => ({
  id: `co-${i}`,
  name: ['HubSpot, Inc.', 'ayirastore.com.br', 'Integracao', 'Ohio Facebook suppo...', 'naoresponder.com', 'ejtech.com.br', 'F5LCON COMERCIO E...', 'bigacessorios.com', 'vokerstore.com.br', 'Suamusica.Com', 'Naotenhosite', 'provisaovip.com.br', 'esportemente.com.br', 'SANFLOR STORE', 'geniostore.com', 'ELETRO SHOPBR'][i % 16],
  owner: 'Nenhum proprietário',
  phone: i % 3 === 0 ? `+55 ${Math.floor(Math.random() * 90 + 10)} ${Math.floor(Math.random() * 90000 + 10000)}-${Math.floor(Math.random() * 9000 + 1000)}` : '--',
  city: ['Cambridge', 'São Paulo', 'Rio de Janeiro', '--', 'Curitiba', '--', '--', '--'][i % 8],
  country: ['United States', 'Brazil', 'Brazil', '--', 'Brazil', 'Brazil', '--', 'Brazil'][i % 8],
  createdAt: new Date(Date.now() - i * 86400000 * 30).toISOString(),
  lastActivity: new Date(Date.now() - i * 86400000 * 5).toISOString(),
}));

function formatCount(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)} mi`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)} mil`;
  return String(n);
}

export default function CRMCompaniesPage() {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(100);

  const filtered = useMemo(() =>
    MOCK_COMPANIES.filter(c => c.name.toLowerCase().includes(search.toLowerCase())), [search]);

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

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
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-3 py-2.5 text-sm transition-colors border-b-2 -mb-px',
                activeTab === tab.id
                  ? 'border-foreground text-foreground font-medium'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.label}
              {tab.count && (
                <Badge variant="outline" className="ml-1.5 text-[10px] h-5 px-1.5 rounded-sm font-semibold">
                  {formatCount(tab.count)}
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
          <Button size="sm" className="gap-1.5 h-8">Adicionar empresas <ChevronRight className="w-3 h-3" /></Button>
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
          Status do lead <ChevronRight className="w-3 h-3 rotate-90" />
        </button>
        <button className="text-muted-foreground hover:text-foreground font-medium">+ Mais</button>
        <div className="w-px h-4 bg-border" />
        <button className="flex items-center gap-1 text-muted-foreground hover:text-foreground font-medium">
          <SlidersHorizontal className="w-3 h-3" /> Filtros avançados
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-border bg-muted/50">
              <th className="w-10 px-3 py-2.5"><input type="checkbox" className="rounded border-border" /></th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">Nome da empresa</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">Proprietário da empresa</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">
                <button className="flex items-center gap-1">Data de criação (GMT-3) <ArrowUpDown className="w-3 h-3" /></button>
              </th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">Número de telefone</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">Data da última atividade (GMT-3)</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">Cidade</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">País/Região</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map(company => (
              <tr key={company.id} className="border-b border-border hover:bg-muted/20 transition-colors group">
                <td className="px-3 py-2.5"><input type="checkbox" className="rounded border-border" /></td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded bg-muted flex items-center justify-center flex-shrink-0">
                      <Factory className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <span className="font-medium text-primary hover:underline cursor-pointer text-sm">{company.name}</span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-muted-foreground text-xs">{company.owner}</td>
                <td className="px-3 py-2.5 text-muted-foreground text-xs">
                  {new Date(company.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                </td>
                <td className="px-3 py-2.5">
                  {company.phone !== '--' ? (
                    <span className="text-primary text-xs font-medium">{company.phone}</span>
                  ) : (
                    <span className="text-muted-foreground/40 text-xs">--</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-muted-foreground text-xs">
                  {new Date(company.lastActivity).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                </td>
                <td className="px-3 py-2.5 text-muted-foreground text-xs">{company.city}</td>
                <td className="px-3 py-2.5 text-muted-foreground text-xs">{company.country}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination - HubSpot style */}
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
    </div>
  );
}
