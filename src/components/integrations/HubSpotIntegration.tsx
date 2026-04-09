import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Loader2, CheckCircle2, AlertCircle, Link2, Unlink, Eye, EyeOff,
  Search, Users, Building2, Briefcase, Ticket,
  StickyNote, Calendar, PhoneCall, ListTodo, Mail,
  MessageCircle, Mailbox, ClipboardList,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { getOrg } from '@/lib/saas';
import { encryptToken, decryptToken } from '@/lib/tokenCrypto';
import {
  verifyConnection, getObject, getDeepEngagements, getPipelines, getOwners, ENGAGEMENT_TYPES,
  type HsObjectType, type HsObject, type HsPipeline, type HsOwner,
} from '@/lib/hubspotService';

const OBJECT_TYPES: { value: HsObjectType; label: string; icon: typeof Users }[] = [
  { value: 'contacts', label: 'Contato', icon: Users },
  { value: 'companies', label: 'Empresa', icon: Building2 },
  { value: 'deals', label: 'Negócio', icon: Briefcase },
  { value: 'tickets', label: 'Ticket', icon: Ticket },
];

const ALL_TYPE_META: Record<string, { label: string; icon: typeof Users }> = {
  contacts: { label: 'Contato', icon: Users },
  companies: { label: 'Empresa', icon: Building2 },
  deals: { label: 'Negócio', icon: Briefcase },
  tickets: { label: 'Ticket', icon: Ticket },
  notes: { label: 'Nota', icon: StickyNote },
  meetings: { label: 'Reunião', icon: Calendar },
  calls: { label: 'Ligação', icon: PhoneCall },
  tasks: { label: 'Tarefa', icon: ListTodo },
  emails: { label: 'E-mail', icon: Mail },
  communications: { label: 'Mensagem', icon: MessageCircle },
  postal_mail: { label: 'Correio', icon: Mailbox },
  feedback_submissions: { label: 'Formulário', icon: ClipboardList },
};

/** Strip HTML tags and decode common entities */
function stripHtml(html: string | null | undefined): string {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function objectName(obj: HsObject, type: string): string {
  const p = obj.properties;
  if (type === 'contacts') return [p.firstname, p.lastname].filter(Boolean).join(' ') || `Contato #${obj.id}`;
  if (type === 'companies') return p.name || `Empresa #${obj.id}`;
  if (type === 'deals') return p.dealname || `Negócio #${obj.id}`;
  if (type === 'tickets') return p.subject || `Ticket #${obj.id}`;
  if (type === 'notes') return stripHtml(p.hs_note_body).slice(0, 120) || `Nota #${obj.id}`;
  if (type === 'meetings') return p.hs_meeting_title || `Reunião #${obj.id}`;
  if (type === 'calls') return p.hs_call_title || stripHtml(p.hs_call_body).slice(0, 80) || `Ligação #${obj.id}`;
  if (type === 'tasks') return p.hs_task_subject || stripHtml(p.hs_task_body).slice(0, 80) || `Tarefa #${obj.id}`;
  if (type === 'emails') return p.hs_email_subject || `E-mail #${obj.id}`;
  if (type === 'communications') return stripHtml(p.hs_communication_body).slice(0, 120) || `Mensagem #${obj.id}`;
  if (type === 'postal_mail') return stripHtml(p.hs_postal_mail_body).slice(0, 120) || `Correio #${obj.id}`;
  if (type === 'feedback_submissions') return p.hs_submission_name || stripHtml(p.hs_content).slice(0, 80) || `Formulário #${obj.id}`;
  return `#${obj.id}`;
}

function objectTypeLabel(type: string): string {
  return ALL_TYPE_META[type]?.label || type;
}

function engagementExtra(obj: HsObject, type: string): string | undefined {
  const p = obj.properties;
  if (type === 'meetings') {
    if (p.hs_meeting_start_time) {
      const d = new Date(p.hs_meeting_start_time);
      return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    }
    return p.hs_meeting_outcome || undefined;
  }
  if (type === 'calls') {
    const parts: string[] = [];
    if (p.hs_call_direction) parts.push(p.hs_call_direction === 'INBOUND' ? '← Recebida' : '→ Realizada');
    if (p.hs_call_duration) {
      const secs = parseInt(p.hs_call_duration);
      parts.push(secs >= 60 ? `${Math.floor(secs / 60)}min` : `${secs}s`);
    }
    return parts.join(' · ') || undefined;
  }
  if (type === 'tasks') {
    const status = p.hs_task_status;
    if (status === 'COMPLETED') return '✓ Concluída';
    if (status === 'NOT_STARTED') return '○ Não iniciada';
    if (status === 'IN_PROGRESS') return '◐ Em andamento';
    if (status === 'WAITING') return '◷ Aguardando';
    return status || undefined;
  }
  if (type === 'emails') {
    return p.hs_email_direction === 'INCOMING_EMAIL' ? '← Recebido' : '→ Enviado';
  }
  if (type === 'communications') {
    const channel = p.hs_communication_channel_type;
    const channelLabels: Record<string, string> = {
      SMS: 'SMS', WHATS_APP: 'WhatsApp', LIVE_CHAT: 'Chat ao vivo',
      FB_MESSENGER: 'Messenger', LINKEDIN_MESSAGE: 'LinkedIn',
    };
    return channelLabels[channel || ''] || channel || undefined;
  }
  if (type === 'feedback_submissions') {
    return p.hs_response_group || undefined;
  }
  return undefined;
}

interface ListItem {
  id: string;
  name: string;
  type: string;
  typeLabel: string;
  extra?: string;
  createdate?: string;
  pipelineLabel?: string;
  stageLabel?: string;
  ownerName?: string;
}

export default function HubSpotIntegration() {
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [portalId, setPortalId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const [searchType, setSearchType] = useState<HsObjectType>('contacts');
  const [searchId, setSearchId] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ListItem[]>([]);
  const [engagements, setEngagements] = useState<ListItem[]>([]);
  const [mainObject, setMainObject] = useState<ListItem | null>(null);
  const [activeTab, setActiveTab] = useState<'objects' | 'activities'>('objects');

  const [owners, setOwners] = useState<HsOwner[]>([]);
  const [dealPipelines, setDealPipelines] = useState<HsPipeline[]>([]);
  const [ticketPipelines, setTicketPipelines] = useState<HsPipeline[]>([]);

  const { toast } = useToast();

  // ─── Load saved integration on mount ───────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const org = await getOrg();
        const { data } = await (supabase as any).schema('automation').from('integracoes')
          .select('configuracao, status')
          .eq('org', org)
          .eq('tipo', 'hubspot')
          .eq('status', 'conectada')
          .limit(1)
          .maybeSingle();

        if (cancelled || !data?.configuracao?.token_encrypted) return;

        const decrypted = await decryptToken(data.configuracao.token_encrypted);
        if (cancelled || !decrypted) return;

        // Verify the token is still valid
        const result = await verifyConnection(decrypted);
        if (cancelled) return;

        if (result.ok) {
          setToken(decrypted);
          setPortalId(result.portalId || data.configuracao.portal_id || null);
          setConnected(true);

          const [ownersData, dealPipes, ticketPipes] = await Promise.all([
            getOwners(decrypted).catch(() => []),
            getPipelines(decrypted, 'deals').catch(() => []),
            getPipelines(decrypted, 'tickets').catch(() => []),
          ]);
          if (!cancelled) {
            setOwners(ownersData);
            setDealPipelines(dealPipes);
            setTicketPipelines(ticketPipes);
          }
        }
      } catch {
        // No saved integration or token expired — user will connect manually
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ─── Connect ────────────────────────────────────────
  const handleConnect = async () => {
    if (!token.trim()) return;
    setConnecting(true);
    setError('');
    try {
      const result = await verifyConnection(token.trim());
      if (!result.ok) throw new Error(result.error || 'Token inválido');
      setPortalId(result.portalId || null);
      setConnected(true);

      // Load owners + pipelines in parallel
      const [ownersData, dealPipes, ticketPipes] = await Promise.all([
        getOwners(token.trim()).catch(() => []),
        getPipelines(token.trim(), 'deals').catch(() => []),
        getPipelines(token.trim(), 'tickets').catch(() => []),
      ]);
      setOwners(ownersData);
      setDealPipelines(dealPipes);
      setTicketPipelines(ticketPipes);

      const org = await getOrg();
      const encrypted = await encryptToken(token.trim());
      await (supabase as any).schema('automation').from('integracoes').upsert({
        empresa_id: org,
        tipo: 'hubspot',
        nome: `HubSpot Portal ${result.portalId}`,
        status: 'conectada',
        configuracao: { portal_id: result.portalId, token_encrypted: encrypted },
        conectado_em: new Date().toISOString(),
      }, { onConflict: 'empresa_id,tipo,nome' });

      toast({ title: 'HubSpot conectado!', description: `Portal ID: ${result.portalId}` });
    } catch (e: any) {
      setError(e.message);
      toast({ variant: 'destructive', title: 'Erro ao conectar', description: e.message });
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setConnected(false);
    setToken('');
    setPortalId(null);
    setResults([]);
    setMainObject(null);
    setOwners([]);
    setDealPipelines([]);
    setTicketPipelines([]);

    try {
      const org = await getOrg();
      await (supabase as any).schema('automation').from('integracoes')
        .update({ status: 'desconectada', configuracao: {} })
        .eq('org', org)
        .eq('tipo', 'hubspot');
    } catch { /* best-effort cleanup */ }

    toast({ title: 'HubSpot desconectado' });
  };

  // ─── Helpers ─────────────────────────────────────────
  const resolveOwner = (ownerId: string | null | undefined): string | undefined => {
    if (!ownerId) return undefined;
    const owner = owners.find(o => o.id === ownerId);
    return owner ? [owner.firstName, owner.lastName].filter(Boolean).join(' ') || owner.email : undefined;
  };

  const resolvePipeline = (type: string, pipelineId: string | null | undefined, stageId: string | null | undefined) => {
    if (type !== 'deals' && type !== 'tickets') return {};
    const pipes = type === 'deals' ? dealPipelines : ticketPipelines;
    const pipe = pipes.find(p => p.id === pipelineId);
    const stage = pipe?.stages.find(s => s.id === stageId);
    return { pipelineLabel: pipe?.label, stageLabel: stage?.label };
  };

  const isEngagement = (type: string) => (ENGAGEMENT_TYPES as string[]).includes(type);

  const buildListItem = (obj: HsObject, type: string): ListItem => {
    const p = obj.properties;
    const { pipelineLabel, stageLabel } = resolvePipeline(
      type,
      type === 'deals' ? p.pipeline : p.hs_pipeline,
      type === 'deals' ? p.dealstage : p.hs_pipeline_stage,
    );
    return {
      id: obj.id,
      name: objectName(obj, type),
      type,
      typeLabel: objectTypeLabel(type),
      extra: isEngagement(type)
        ? engagementExtra(obj, type)
        : (p.email || p.domain || (p.amount ? `R$ ${p.amount}` : undefined) || undefined),
      createdate: p.createdate || p.hs_createdate || p.hs_timestamp || undefined,
      pipelineLabel,
      stageLabel,
      ownerName: resolveOwner(p.hubspot_owner_id),
    };
  };

  // ─── Search ─────────────────────────────────────────
  const handleSearch = async () => {
    if (!searchId.trim()) return;
    setLoading(true);
    setResults([]);
    setEngagements([]);
    setMainObject(null);
    setActiveTab('objects');
    try {
      const obj = await getObject(token.trim(), searchType, searchId.trim());
      setMainObject(buildListItem(obj, searchType));

      // Deep fetch: CRM objects + ALL engagements (from main + associated objects), deduplicated
      const { crmObjects, engagements: engObjs } = await getDeepEngagements(token.trim(), obj, searchType);

      const crmItems = crmObjects.map(({ type, obj: o }) => buildListItem(o, type));
      const activityItems = engObjs.map(({ type, obj: o }) => buildListItem(o, type));

      // Sort activities by date (newest first)
      activityItems.sort((a, b) => {
        const da = a.createdate ? new Date(a.createdate).getTime() : 0;
        const db = b.createdate ? new Date(b.createdate).getTime() : 0;
        return db - da;
      });

      // Sort CRM objects by date (newest first)
      crmItems.sort((a, b) => {
        const da = a.createdate ? new Date(a.createdate).getTime() : 0;
        const db = b.createdate ? new Date(b.createdate).getTime() : 0;
        return db - da;
      });

      setResults(crmItems);
      setEngagements(activityItems);

      const total = crmItems.length + activityItems.length;
      if (total === 0) {
        toast({ title: 'Objeto encontrado', description: 'Nenhum vínculo ou atividade associada.' });
      } else {
        toast({ title: `${crmItems.length} vínculo${crmItems.length !== 1 ? 's' : ''} + ${activityItems.length} atividade${activityItems.length !== 1 ? 's' : ''}` });
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao buscar', description: e.message });
    } finally {
      setLoading(false);
    }
  };

  const typeIcon = (type: string) => {
    const meta = ALL_TYPE_META[type];
    return meta ? <meta.icon className="w-3.5 h-3.5" /> : null;
  };

  const typeBadgeColor = (type: string) => {
    if (type === 'contacts') return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    if (type === 'companies') return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    if (type === 'deals') return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
    if (type === 'tickets') return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    if (type === 'notes') return 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30';
    if (type === 'meetings') return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
    if (type === 'calls') return 'bg-green-500/15 text-green-400 border-green-500/30';
    if (type === 'tasks') return 'bg-orange-500/15 text-orange-400 border-orange-500/30';
    if (type === 'emails') return 'bg-pink-500/15 text-pink-400 border-pink-500/30';
    if (type === 'communications') return 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
    if (type === 'postal_mail') return 'bg-stone-500/15 text-stone-400 border-stone-500/30';
    if (type === 'feedback_submissions') return 'bg-teal-500/15 text-teal-400 border-teal-500/30';
    return '';
  };

  return (
    <div className="space-y-4">
      {/* Connection */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#ff7a59]/10 flex items-center justify-center text-xl">🔗</div>
          <div className="flex-1">
            <h3 className="font-semibold text-sm">HubSpot CRM</h3>
            <p className="text-[11px] text-muted-foreground">Conecte sua conta HubSpot para visualizar registros vinculados.</p>
          </div>
          {connected && (
            <Badge className="bg-green-500/15 text-green-500 border-green-500/30 gap-1">
              <CheckCircle2 className="w-3 h-3" /> Conectado
            </Badge>
          )}
        </div>

        {initialLoading ? (
          <div className="flex items-center gap-2 py-3">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Verificando conexão salva...</span>
          </div>
        ) : !connected ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium block mb-1.5">Token de Acesso (Private App)</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showToken ? 'text' : 'password'}
                    value={token}
                    onChange={e => setToken(e.target.value)}
                    placeholder="pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    className="h-9 text-xs font-mono pr-9"
                  />
                  <button onClick={() => setShowToken(!showToken)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <Button size="sm" className="h-9 gap-1.5" onClick={handleConnect} disabled={connecting || !token.trim()}>
                  {connecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                  {connecting ? 'Verificando...' : 'Conectar'}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5">
                HubSpot → Settings → Integrations → Private Apps. Escopos: crm.objects.contacts.read, crm.objects.deals.read, crm.objects.companies.read, crm.objects.tickets.read
              </p>
            </div>
            {error && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-destructive/10 border border-destructive/20">
                <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
                <span className="text-xs text-destructive">{error}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Portal ID: <strong className="text-foreground">{portalId}</strong></span>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-destructive hover:text-destructive" onClick={handleDisconnect}>
              <Unlink className="w-3 h-3" /> Desconectar
            </Button>
          </div>
        )}
      </div>

      {/* Search */}
      {connected && (
        <div className="glass-card p-5">
          <h4 className="text-sm font-semibold mb-1 flex items-center gap-2">
            <Search className="w-4 h-4 text-primary" />
            Buscar registros vinculados
          </h4>
          <p className="text-[11px] text-muted-foreground mb-4">
            Selecione o tipo de objeto e informe o Record ID do HubSpot para listar os registros vinculados a ele.
          </p>

          <div className="flex gap-2 mb-4">
            <Select value={searchType} onValueChange={v => { setSearchType(v as HsObjectType); setResults([]); setMainObject(null); }}>
              <SelectTrigger className="w-[160px] h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OBJECT_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value} className="text-xs">
                    <div className="flex items-center gap-2"><t.icon className="w-3.5 h-3.5" />{t.label}</div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={searchId}
              onChange={e => setSearchId(e.target.value)}
              placeholder="Record ID (ex: 12345)"
              className="h-9 text-xs font-mono flex-1"
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
            <Button size="sm" className="h-9 gap-1.5" onClick={handleSearch} disabled={loading || !searchId.trim()}>
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              Carregar
            </Button>
          </div>

          {/* Main object */}
          {mainObject && (
            <div className="mb-3 p-3 rounded-lg border border-primary/30 bg-primary/5">
              <div className="flex items-center gap-3">
                {typeIcon(mainObject.type)}
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold">{mainObject.name}</span>
                  {mainObject.extra && <span className="text-xs text-muted-foreground ml-2">{mainObject.extra}</span>}
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    {mainObject.createdate && (
                      <span className="text-[10px] text-muted-foreground">Criado: {new Date(mainObject.createdate).toLocaleDateString('pt-BR')}</span>
                    )}
                    {mainObject.pipelineLabel && (
                      <span className="text-[10px] text-muted-foreground">Pipeline: {mainObject.pipelineLabel}{mainObject.stageLabel ? ` → ${mainObject.stageLabel}` : ''}</span>
                    )}
                    {mainObject.ownerName && (
                      <span className="text-[10px] text-muted-foreground">Proprietário: {mainObject.ownerName}</span>
                    )}
                  </div>
                </div>
                <Badge variant="outline" className={cn('text-[9px] h-5', typeBadgeColor(mainObject.type))}>{mainObject.typeLabel}</Badge>
                <span className="text-[10px] text-muted-foreground font-mono">#{mainObject.id}</span>
              </div>
            </div>
          )}

          {/* Tabs: Objects / Activities */}
          {mainObject && (results.length > 0 || engagements.length > 0) && (
            <div className="flex gap-1 p-1 bg-secondary rounded-lg border border-border mb-3 w-fit">
              <button onClick={() => setActiveTab('objects')}
                className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                  activeTab === 'objects' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
                <Building2 className="w-3 h-3" /> Vínculos
                {results.length > 0 && <span className="text-[9px] ml-0.5 opacity-70">({results.length})</span>}
              </button>
              <button onClick={() => setActiveTab('activities')}
                className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                  activeTab === 'activities' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
                <Calendar className="w-3 h-3" /> Atividades
                {engagements.length > 0 && <span className="text-[9px] ml-0.5 opacity-70">({engagements.length})</span>}
              </button>
            </div>
          )}

          {/* CRM Objects table */}
          {activeTab === 'objects' && results.length > 0 && (
            <div className="rounded-lg border border-border/50 overflow-hidden">
              <div className="px-4 py-2 bg-muted/20 border-b border-border/30">
                <span className="text-xs font-medium">{results.length} registro{results.length !== 1 ? 's' : ''} vinculado{results.length !== 1 ? 's' : ''}</span>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/30 text-muted-foreground">
                    <th className="text-left px-4 py-2 font-medium w-20">ID</th>
                    <th className="text-left px-4 py-2 font-medium">Nome</th>
                    <th className="text-left px-4 py-2 font-medium w-28">Objeto</th>
                    <th className="text-left px-4 py-2 font-medium w-24">Criado em</th>
                    <th className="text-left px-4 py-2 font-medium">Pipeline / Etapa</th>
                    <th className="text-left px-4 py-2 font-medium w-28">Proprietário</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map(item => (
                    <tr key={`${item.type}-${item.id}`} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2 font-mono text-muted-foreground">{item.id}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{item.name}</span>
                          {item.extra && <span className="text-muted-foreground">{item.extra}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <Badge variant="outline" className={cn('text-[9px] h-5 gap-1', typeBadgeColor(item.type))}>
                          {typeIcon(item.type)} {item.typeLabel}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {item.createdate ? new Date(item.createdate).toLocaleDateString('pt-BR') : '—'}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {item.pipelineLabel ? (
                          <span>{item.pipelineLabel}{item.stageLabel ? <span className="text-foreground font-medium"> → {item.stageLabel}</span> : ''}</span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {item.ownerName || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Activities timeline */}
          {activeTab === 'activities' && engagements.length > 0 && (
            <div className="space-y-2">
              {engagements.map(item => (
                <div key={`${item.type}-${item.id}`} className="flex items-start gap-3 p-3 rounded-lg border border-border/30 hover:bg-muted/10 transition-colors">
                  <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', typeBadgeColor(item.type).replace('border-', 'border border-'))}>
                    {typeIcon(item.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Badge variant="outline" className={cn('text-[9px] h-4 gap-0.5', typeBadgeColor(item.type))}>
                        {item.typeLabel}
                      </Badge>
                      {item.createdate && (
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(item.createdate).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                      {item.ownerName && (
                        <span className="text-[10px] text-muted-foreground">· {item.ownerName}</span>
                      )}
                    </div>
                    <p className="text-xs font-medium truncate">{item.name}</p>
                    {item.extra && <p className="text-[11px] text-muted-foreground mt-0.5">{item.extra}</p>}
                  </div>
                  <span className="text-[9px] text-muted-foreground font-mono flex-shrink-0">#{item.id}</span>
                </div>
              ))}
            </div>
          )}

          {/* Empty states */}
          {activeTab === 'objects' && mainObject && results.length === 0 && !loading && (
            <div className="text-center py-6">
              <p className="text-xs text-muted-foreground">Nenhum registro vinculado encontrado.</p>
            </div>
          )}
          {activeTab === 'activities' && mainObject && engagements.length === 0 && !loading && (
            <div className="text-center py-6">
              <p className="text-xs text-muted-foreground">Nenhuma atividade encontrada (notas, reuniões, ligações, tarefas, e-mails).</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
