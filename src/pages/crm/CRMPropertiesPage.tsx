import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft, Search, ArrowUpDown, SlidersHorizontal,
  Hash, Type, Calendar, DollarSign, Phone, Mail, FileText, Building2,
  Briefcase, Contact, Ticket, Factory, ChevronDown, ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCrmPipelines, useSaasUsers } from '@/hooks/useCrm';
import type { CrmObjectType } from '@/types/crm';

// ========================
// Property definitions
// ========================

type PropertyFieldType =
  | 'text'
  | 'number'
  | 'currency'
  | 'date'
  | 'email'
  | 'phone'
  | 'select'
  | 'auto';

interface PropertyDefinition {
  key: string;
  label: string;
  fieldType: PropertyFieldType;
  group: string;
  description: string;
  readOnly: boolean;
}

const OBJECT_TYPE_OPTIONS: { value: CrmObjectType; label: string; icon: typeof Briefcase }[] = [
  { value: 'deal',    label: 'Propriedades de Negócio',  icon: Briefcase },
  { value: 'contact', label: 'Propriedades de Contato',  icon: Contact },
  { value: 'company', label: 'Propriedades de Empresa',  icon: Factory },
  { value: 'ticket',  label: 'Propriedades de Ticket',   icon: Ticket },
];

const PROPERTIES: Record<CrmObjectType, PropertyDefinition[]> = {
  deal: [
    { key: 'numero_registro', label: 'ID do Registro',             fieldType: 'auto',     group: 'Informações do negócio', description: 'Identificador único do negócio',              readOnly: true },
    { key: 'nome',            label: 'Nome do Negócio',            fieldType: 'text',     group: 'Informações do negócio', description: 'Nome do negócio',                             readOnly: false },
    { key: 'pipeline_id',     label: 'Pipeline',                   fieldType: 'select',   group: 'Informações do negócio', description: 'Pipeline em que o negócio se encontra',       readOnly: false },
    { key: 'estagio_id',      label: 'Etapa do Negócio',           fieldType: 'select',   group: 'Informações do negócio', description: 'Etapa atual do negócio no pipeline',          readOnly: false },
    { key: 'valor',           label: 'Valor',                      fieldType: 'currency', group: 'Informações do negócio', description: 'Valor monetário do negócio',                  readOnly: false },
    { key: 'status',          label: 'Status',                     fieldType: 'select',   group: 'Informações do negócio', description: 'Status do negócio (aberto, ganho, perdido)',  readOnly: false },
    { key: 'probabilidade',   label: 'Probabilidade de Fechamento', fieldType: 'number',  group: 'Informações do negócio', description: 'Probabilidade de ganhar o negócio (%)',       readOnly: false },
    { key: 'proprietario_id', label: 'Proprietário do Negócio',    fieldType: 'select',   group: 'Informações do negócio', description: 'Usuário responsável pelo negócio',            readOnly: false },
    { key: 'data_fechamento_prevista', label: 'Data de Fechamento Prevista', fieldType: 'date', group: 'Informações do negócio', description: 'Data prevista para fechamento', readOnly: false },
    { key: 'motivo_perda',    label: 'Motivo da Perda',            fieldType: 'text',     group: 'Informações do negócio', description: 'Razão pela qual o negócio foi perdido',       readOnly: false },
    { key: 'plataforma',      label: 'Plataforma',                 fieldType: 'text',     group: 'Informações do negócio', description: 'Plataforma de origem do negócio',             readOnly: false },
    { key: 'tags',            label: 'Tags',                       fieldType: 'text',     group: 'Informações do negócio', description: 'Tags para categorizar o negócio',             readOnly: false },
    { key: 'criado_em',       label: 'Data de Criação',            fieldType: 'date',     group: 'Informações do sistema', description: 'Data em que o registro foi criado',           readOnly: true },
    { key: 'atualizado_em',   label: 'Data de Última Modificação', fieldType: 'date',     group: 'Informações do sistema', description: 'Data da última atualização do registro',      readOnly: true },
  ],
  contact: [
    { key: 'numero_registro', label: 'ID do Registro',             fieldType: 'auto',   group: 'Informações do contato', description: 'Identificador único do contato',              readOnly: true },
    { key: 'nome',            label: 'Nome do Contato',            fieldType: 'text',   group: 'Informações do contato', description: 'Nome completo do contato',                    readOnly: false },
    { key: 'telefone',        label: 'Telefone',                   fieldType: 'phone',  group: 'Informações do contato', description: 'Número de telefone do contato',               readOnly: false },
    { key: 'email',           label: 'E-mail',                     fieldType: 'email',  group: 'Informações do contato', description: 'Endereço de e-mail do contato',               readOnly: false },
    { key: 'cargo',           label: 'Cargo',                      fieldType: 'text',   group: 'Informações do contato', description: 'Cargo ou função do contato',                  readOnly: false },
    { key: 'status',          label: 'Status do Contato',          fieldType: 'select', group: 'Informações do contato', description: 'Status do lead (lead, qualificado, cliente)', readOnly: false },
    { key: 'fonte',           label: 'Fonte',                      fieldType: 'select', group: 'Informações do contato', description: 'Origem do contato (website, linkedin, etc.)', readOnly: false },
    { key: 'score',           label: 'Score',                      fieldType: 'number', group: 'Informações do contato', description: 'Pontuação de qualificação do contato',        readOnly: false },
    { key: 'proprietario_id', label: 'Proprietário do Contato',    fieldType: 'select', group: 'Informações do contato', description: 'Usuário responsável pelo contato',            readOnly: false },
    { key: 'tags',            label: 'Tags',                       fieldType: 'text',   group: 'Informações do contato', description: 'Tags para categorizar o contato',             readOnly: false },
    { key: 'criado_em',       label: 'Data de Criação',            fieldType: 'date',   group: 'Informações do sistema', description: 'Data em que o registro foi criado',           readOnly: true },
    { key: 'atualizado_em',   label: 'Data de Última Modificação', fieldType: 'date',   group: 'Informações do sistema', description: 'Data da última atualização do registro',      readOnly: true },
  ],
  company: [
    { key: 'numero_registro', label: 'ID do Registro',             fieldType: 'auto',  group: 'Informações da empresa', description: 'Identificador único da empresa',              readOnly: true },
    { key: 'nome',            label: 'Nome da Empresa',            fieldType: 'text',  group: 'Informações da empresa', description: 'Razão social ou nome fantasia',               readOnly: false },
    { key: 'cnpj',            label: 'CNPJ',                       fieldType: 'text',  group: 'Informações da empresa', description: 'CNPJ da empresa',                             readOnly: false },
    { key: 'dominio',         label: 'Domínio',                    fieldType: 'text',  group: 'Informações da empresa', description: 'Domínio web da empresa',                      readOnly: false },
    { key: 'telefone',        label: 'Telefone',                   fieldType: 'phone', group: 'Informações da empresa', description: 'Telefone principal da empresa',               readOnly: false },
    { key: 'website',         label: 'Website',                    fieldType: 'text',  group: 'Informações da empresa', description: 'URL do site da empresa',                      readOnly: false },
    { key: 'setor',           label: 'Setor',                      fieldType: 'text',  group: 'Informações da empresa', description: 'Setor de atuação da empresa',                 readOnly: false },
    { key: 'porte',           label: 'Porte',                      fieldType: 'select',group: 'Informações da empresa', description: 'Porte da empresa',                            readOnly: false },
    { key: 'endereco',        label: 'Endereço',                   fieldType: 'text',  group: 'Informações da empresa', description: 'Endereço da empresa',                         readOnly: false },
    { key: 'cidade',          label: 'Cidade',                     fieldType: 'text',  group: 'Informações da empresa', description: 'Cidade da empresa',                           readOnly: false },
    { key: 'estado',          label: 'Estado',                     fieldType: 'text',  group: 'Informações da empresa', description: 'Estado da empresa',                           readOnly: false },
    { key: 'plataforma',      label: 'Plataforma',                 fieldType: 'text',  group: 'Informações da empresa', description: 'Plataforma de e-commerce da empresa',         readOnly: false },
    { key: 'proprietario_id', label: 'Proprietário da Empresa',    fieldType: 'select',group: 'Informações da empresa', description: 'Usuário responsável pela empresa',            readOnly: false },
    { key: 'tags',            label: 'Tags',                       fieldType: 'text',  group: 'Informações da empresa', description: 'Tags para categorizar a empresa',             readOnly: false },
    { key: 'criado_em',       label: 'Data de Criação',            fieldType: 'date',  group: 'Informações do sistema', description: 'Data em que o registro foi criado',           readOnly: true },
    { key: 'atualizado_em',   label: 'Data de Última Modificação', fieldType: 'date',  group: 'Informações do sistema', description: 'Data da última atualização do registro',      readOnly: true },
  ],
  ticket: [
    { key: 'numero_registro', label: 'ID do Registro',             fieldType: 'auto',   group: 'Informações do ticket', description: 'Identificador único do ticket',               readOnly: true },
    { key: 'titulo',          label: 'Nome do Ticket',             fieldType: 'text',   group: 'Informações do ticket', description: 'Título ou assunto do ticket',                 readOnly: false },
    { key: 'pipeline_id',     label: 'Pipeline',                   fieldType: 'select', group: 'Informações do ticket', description: 'Pipeline em que o ticket se encontra',        readOnly: false },
    { key: 'estagio_id',      label: 'Etapa do Ticket',            fieldType: 'select', group: 'Informações do ticket', description: 'Etapa atual do ticket no pipeline',           readOnly: false },
    { key: 'prioridade',      label: 'Prioridade',                 fieldType: 'select', group: 'Informações do ticket', description: 'Nível de prioridade do ticket',               readOnly: false },
    { key: 'status',          label: 'Status',                     fieldType: 'select', group: 'Informações do ticket', description: 'Status atual do ticket',                      readOnly: false },
    { key: 'categoria',       label: 'Categoria',                  fieldType: 'text',   group: 'Informações do ticket', description: 'Categoria do ticket',                         readOnly: false },
    { key: 'descricao',       label: 'Descrição',                  fieldType: 'text',   group: 'Informações do ticket', description: 'Descrição detalhada do ticket',               readOnly: false },
    { key: 'proprietario_id', label: 'Proprietário do Ticket',     fieldType: 'select', group: 'Informações do ticket', description: 'Usuário responsável pelo ticket',             readOnly: false },
    { key: 'plataforma',      label: 'Plataforma',                 fieldType: 'text',   group: 'Informações do ticket', description: 'Plataforma de origem do ticket',              readOnly: false },
    { key: 'tags',            label: 'Tags',                       fieldType: 'text',   group: 'Informações do ticket', description: 'Tags para categorizar o ticket',              readOnly: false },
    { key: 'criado_em',       label: 'Data de Criação',            fieldType: 'date',   group: 'Informações do sistema', description: 'Data em que o registro foi criado',           readOnly: true },
    { key: 'atualizado_em',   label: 'Data de Última Modificação', fieldType: 'date',   group: 'Informações do sistema', description: 'Data da última atualização do registro',      readOnly: true },
  ],
};

// ========================
// Field type display helpers
// ========================

const FIELD_TYPE_META: Record<PropertyFieldType, { label: string; icon: typeof Type }> = {
  text:     { label: 'Texto',          icon: Type },
  number:   { label: 'Número',         icon: Hash },
  currency: { label: 'Moeda',          icon: DollarSign },
  date:     { label: 'Data',           icon: Calendar },
  email:    { label: 'E-mail',         icon: Mail },
  phone:    { label: 'Telefone',       icon: Phone },
  select:   { label: 'Seleção',        icon: SlidersHorizontal },
  auto:     { label: 'Automático',     icon: Hash },
};

type SortKey = 'label' | 'fieldType' | 'group';
type SortDir = 'asc' | 'desc';

// ========================
// Component
// ========================

export default function CRMPropertiesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('label');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Object type from URL (?object=deal)
  const urlObject = searchParams.get('object') as CrmObjectType | null;
  const objectType: CrmObjectType = urlObject && ['deal', 'contact', 'company', 'ticket'].includes(urlObject) ? urlObject : 'deal';
  const setObjectType = (v: CrmObjectType) => { setSearchParams({ object: v }, { replace: true }); setGroupFilter('all'); setSearch(''); };

  const properties = PROPERTIES[objectType];
  const selectedOption = OBJECT_TYPE_OPTIONS.find(o => o.value === objectType)!;
  const hasPipeline = objectType === 'deal' || objectType === 'ticket';
  const { data: pipelines = [] } = useCrmPipelines(hasPipeline ? (objectType === 'deal' ? 'deal' : 'ticket') : 'deal');
  const { data: saasUsers = [] } = useSaasUsers();

  const groups = useMemo(() => {
    const set = new Set(properties.map(p => p.group));
    return ['all', ...Array.from(set)];
  }, [properties]);

  const filtered = useMemo(() => {
    let list = properties;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.label.toLowerCase().includes(q) ||
        p.key.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
      );
    }
    if (groupFilter !== 'all') {
      list = list.filter(p => p.group === groupFilter);
    }
    list = [...list].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      const cmp = aVal.localeCompare(bVal, 'pt-BR');
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [properties, search, groupFilter, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 text-muted-foreground/50" />;
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 text-foreground" />
      : <ChevronDown className="w-3 h-3 text-foreground" />;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card flex-shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">Propriedades</h1>
            <p className="text-xs text-muted-foreground">
              As propriedades são usadas para coletar e armazenar informações sobre seus registros no CRM.
            </p>
          </div>
        </div>
      </div>

      {/* Object type selector + search */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-card flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground font-medium">Selecione um objeto:</span>
          <Select value={objectType} onValueChange={(v) => setObjectType(v as CrmObjectType)}>
            <SelectTrigger className="w-[260px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OBJECT_TYPE_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  <div className="flex items-center gap-2">
                    <opt.icon className="w-3.5 h-3.5" />
                    {opt.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {filtered.length} {filtered.length === 1 ? 'propriedade' : 'propriedades'}
          </Badge>
        </div>
      </div>

      {/* Filters row */}
      <div className="flex items-center gap-3 px-6 py-2.5 border-b border-border bg-card flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Grupo:</span>
          <Select value={groupFilter} onValueChange={setGroupFilter}>
            <SelectTrigger className="h-8 w-[220px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {groups.map(g => (
                <SelectItem key={g} value={g} className="text-xs">
                  {g === 'all' ? 'Todos os grupos' : g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1" />
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Pesquisar propriedades..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-8 text-xs"
          />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-muted/50 backdrop-blur-sm z-10">
            <tr className="text-xs text-muted-foreground border-b border-border">
              <th className="text-left px-6 py-2.5 font-medium w-[320px]">
                <button className="flex items-center gap-1.5 hover:text-foreground transition-colors" onClick={() => toggleSort('label')}>
                  Nome <SortIcon col="label" />
                </button>
              </th>
              <th className="text-left px-4 py-2.5 font-medium w-[160px]">
                <button className="flex items-center gap-1.5 hover:text-foreground transition-colors" onClick={() => toggleSort('fieldType')}>
                  Tipo do campo <SortIcon col="fieldType" />
                </button>
              </th>
              <th className="text-left px-4 py-2.5 font-medium w-[200px]">
                <button className="flex items-center gap-1.5 hover:text-foreground transition-colors" onClick={() => toggleSort('group')}>
                  Grupo <SortIcon col="group" />
                </button>
              </th>
              <th className="text-left px-4 py-2.5 font-medium">Descrição</th>
              <th className="text-center px-4 py-2.5 font-medium w-[100px]">Editável</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((prop) => {
              const meta = FIELD_TYPE_META[prop.fieldType];
              const Icon = meta.icon;
              return (
                <tr
                  key={prop.key}
                  className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-6 py-3">
                    <div>
                      <span className="text-sm font-medium text-foreground">{prop.label}</span>
                      <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">{prop.key}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{meta.label}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-[11px] font-normal">
                      {prop.group}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-muted-foreground">{prop.description}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {prop.readOnly ? (
                      <Badge variant="secondary" className="text-[10px]">Somente leitura</Badge>
                    ) : (
                      <Badge className="text-[10px] bg-success/15 text-success border-success/30">Editável</Badge>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center">
                  <FileText className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">Nenhuma propriedade encontrada</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Tente ajustar os filtros ou a busca</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pipeline + stages with nome_interno */}
        {hasPipeline && pipelines.length > 0 && (
          <div className="border-t border-border px-6 py-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">
              Pipelines vinculados — {objectType === 'deal' ? 'Negócios' : 'Tickets'}
            </h3>
            <div className="space-y-3">
              {pipelines.map(p => (
                <div key={p.id} className="rounded-lg border border-border overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-2.5 bg-muted/20">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{p.nome}</p>
                      <p className="text-[11px] text-muted-foreground">{p.estagios?.length || 0} etapas</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[10px] text-muted-foreground">Nome interno:</span>
                      <Badge variant="outline" className="font-mono text-xs">{p.nome_interno}</Badge>
                    </div>
                  </div>
                  {p.estagios && p.estagios.length > 0 && (
                    <div className="px-4 py-2 space-y-1 bg-card">
                      {p.estagios.map(e => (
                        <div key={e.id} className="flex items-center justify-between py-1 text-xs">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: e.cor }} />
                            <span className="text-muted-foreground">{e.nome}</span>
                          </div>
                          <span className="font-mono text-muted-foreground/70">{e.nome_interno}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Usuários do sistema (proprietários) */}
        <div className="border-t border-border px-6 py-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">
            Usuários do sistema (Proprietários)
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {saasUsers.map(u => (
              <div key={u.id} className="flex items-center gap-2 px-3 py-2 rounded-md border border-border/50 bg-muted/10 text-xs">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-semibold text-primary flex-shrink-0">
                  {u.nome?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div className="min-w-0">
                  <p className="text-foreground font-medium truncate">{u.nome}</p>
                  <p className="text-muted-foreground truncate">{u.email}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
