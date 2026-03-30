import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Search, Plus, Filter, ExternalLink, MoreHorizontal,
  ChevronLeft, ChevronRight, Download, Contact, Settings2,
  ArrowUpDown, BarChart3, Copy, Table2, SlidersHorizontal,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface ContactItem {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  source: string;
  status: 'lead' | 'qualified' | 'customer' | 'churned';
  createdAt: string;
  lastActivity: string;
}

const STATUS_CONFIG: Record<ContactItem['status'], { label: string; class: string }> = {
  lead:      { label: 'Lead',        class: 'bg-muted text-muted-foreground' },
  qualified: { label: 'Qualificado', class: 'bg-warning/15 text-warning' },
  customer:  { label: 'Cliente',     class: 'bg-success/15 text-success' },
  churned:   { label: 'Churned',     class: 'bg-destructive/15 text-destructive' },
};

const TABS = [
  { id: 'all', label: 'Todos os contatos', count: 692600 },
  { id: 'lead', label: '1. Lead' },
  { id: 'produtor', label: '2. Produtor' },
  { id: 'integrado', label: '3. Integrado' },
  { id: 'temp', label: 'Temporário Schuldz' },
];

const MOCK_CONTACTS: ContactItem[] = Array.from({ length: 80 }, (_, i) => ({
  id: `c-${i}`,
  name: ['Igor Sepúlveda', 'Jussara Kelly Matosin...', 'Thiago Nascimento G...', 'Fabricoi Pascoal De O...', 'Comercial Gladis Perf...', 'CANAL DOA JOGOS H...', 'Ronaltin S Lopes', 'Leon Victor Silva Oliv...', 'Erica Custodia Parreir...', 'Julio Minatto', 'Maria das graças Silv...', 'S1B2S3 Barcelos', 'Maiara Costa De Oliv...', 'Ryan Barboza Dantas', 'Marisa Elina Santos d...', 'Gilton Felix Santos'][i % 16],
  email: [`trafego@hospedare.io`, `jussarasemijoias0@gmail.c...`, `thiagonasc26@icloud.com...`, `oficial.ebookpro@gmail.co...`, `contato@gladisperfumaria...`, `marinhobruno04@gmail.c...`, `rootsemroot@gmail.com`, `vleon4558@gmail.com`, `pedroparreirasyt@gmail.c...`, `juliominatto123@gmail.co...`, `mdgra0305@gmail.com`, `sbsbarcelos4@gmail.com`, `maya_2008@outlook.com...`, `ryanbarboza5@gmail.com...`, `fenixgestao97@gmail.com...`, `eduardogoessilva@mozej.c...`][i % 16],
  phone: [`+55-73-99909-9972`, `+55-31-97182-5582`, `+55-35-99226-5156`, `+55-13-99620-4549`, `+55-45-99156-2306`, `--`, `+55-73-99934-6714`, `+55-73-98119-0077`, `+55-31-98499-1492`, `+55-47-99103-3535`, `+55-11-97733-2784`, `--`, `+55-71-99686-5418`, `+55-11-95887-2879`, `+55-21-96568-5509`, `+55-79-98806-1455`][i % 16],
  company: ['Hospedare', 'SemiJoias', 'TechCo', 'EbookPro', 'Gladis Perfumaria', 'Canal DOA', 'RootSem', 'VLeon', 'Parreira', 'Minatto', 'Silva Inc', 'Barcelos', 'Costa Ltd', 'Barboza', 'Fenix', 'Felix'][i % 16],
  source: ['Outras Campanhas', 'Referências', 'Outras Campanhas', 'Referências', 'Fontes off-line', 'Fontes off-line', 'AI Referrals', 'Outras Campanhas', 'Tráfego direto', 'Outras Campanhas', 'Outras Campanhas', 'Fontes off-line', 'Outras Campanhas', 'Pesquisa Orgânica', 'Fontes off-line', 'Outras Campanhas'][i % 16],
  status: (['lead', 'qualified', 'customer', 'churned'] as const)[i % 4],
  createdAt: new Date(Date.now() - i * 3600000).toISOString(),
  lastActivity: new Date(Date.now() - i * 1800000).toISOString(),
}));

function formatCount(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)} mi`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)} mil`;
  return String(n);
}

export default function CRMContactsPage() {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);

  const filtered = useMemo(() =>
    MOCK_CONTACTS.filter(c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search)
    ), [search]);

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

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
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
          <Button size="sm" className="gap-1.5 h-8">
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
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-medium">
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
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-card flex-shrink-0 text-xs">
        <button className="flex items-center gap-1 text-muted-foreground hover:text-foreground font-medium">
          Proprietário do contato <ChevronRight className="w-3 h-3 rotate-90" />
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
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">Conversão inicial n1</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">Conversão inicial n2</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map(contact => (
              <tr key={contact.id} className="border-b border-border hover:bg-muted/20 transition-colors group">
                <td className="px-3 py-2.5">
                  <input type="checkbox" className="rounded border-border" />
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                      {contact.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <span className="font-medium text-primary hover:underline cursor-pointer text-sm truncate max-w-[200px]">
                      {contact.name}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-muted-foreground text-xs font-mono">
                  {Math.floor(21230000000 + Math.random() * 1000000000)}
                </td>
                <td className="px-3 py-2.5 text-muted-foreground text-xs">
                  Hoje às {new Date(contact.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} GMT-3
                </td>
                <td className="px-3 py-2.5">
                  <a href={`mailto:${contact.email}`} className="text-muted-foreground hover:text-primary text-xs flex items-center gap-1 truncate max-w-[200px]">
                    {contact.email} <ExternalLink className="w-2.5 h-2.5 flex-shrink-0 opacity-0 group-hover:opacity-100" />
                  </a>
                </td>
                <td className="px-3 py-2.5">
                  {contact.phone !== '--' ? (
                    <span className="text-primary text-xs font-medium">{contact.phone}</span>
                  ) : (
                    <span className="text-muted-foreground/40 text-xs">--</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-muted-foreground text-xs">{contact.source}</td>
                <td className="px-3 py-2.5 text-muted-foreground text-xs">
                  {['appmax-site', 'login.appmax.com.br', 'chatgpt.com', 'appmax_app', 'Ouvidoria-Max'][parseInt(contact.id.split('-')[1]) % 5]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination - HubSpot style */}
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
