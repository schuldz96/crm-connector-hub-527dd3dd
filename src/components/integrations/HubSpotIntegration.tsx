import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Loader2, CheckCircle2, AlertCircle, Link2, Unlink, Eye, EyeOff,
  ChevronDown, ChevronRight, Download, ArrowRight, Users, Building2,
  Briefcase, Ticket, ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { getSaasEmpresaId } from '@/lib/saas';
import { encryptToken, decryptToken } from '@/lib/tokenCrypto';
import {
  verifyConnection, getPipelines, getObject, getObjectsBatch,
  mapContact, mapCompany, mapDeal, mapTicket,
  type HsPipeline, type HsObjectType, type HsObject,
} from '@/lib/hubspotService';
import * as crm from '@/lib/crmService';

const OBJECT_TYPES: { value: HsObjectType; label: string; icon: typeof Users }[] = [
  { value: 'contacts', label: 'Contato', icon: Users },
  { value: 'companies', label: 'Empresa', icon: Building2 },
  { value: 'deals', label: 'Negócio', icon: Briefcase },
  { value: 'tickets', label: 'Ticket', icon: Ticket },
];

export default function HubSpotIntegration() {
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [portalId, setPortalId] = useState<number | null>(null);
  const [error, setError] = useState('');

  // Pipelines
  const [dealPipelines, setDealPipelines] = useState<HsPipeline[]>([]);
  const [ticketPipelines, setTicketPipelines] = useState<HsPipeline[]>([]);
  const [showPipelines, setShowPipelines] = useState(false);

  // Import
  const [importType, setImportType] = useState<HsObjectType>('contacts');
  const [importId, setImportId] = useState('');
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<HsObject | null>(null);
  const [associations, setAssociations] = useState<Record<string, HsObject[]>>({});
  const [importLog, setImportLog] = useState<string[]>([]);

  const { toast } = useToast();

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

      // Save token encrypted
      const empresaId = await getSaasEmpresaId();
      const encrypted = await encryptToken(token.trim());
      await (supabase as any).schema('saas').from('integracoes').upsert({
        empresa_id: empresaId,
        tipo: 'hubspot',
        nome: `HubSpot Portal ${result.portalId}`,
        status: 'conectada',
        configuracao: { portal_id: result.portalId, token_encrypted: encrypted },
        conectado_em: new Date().toISOString(),
      }, { onConflict: 'empresa_id,tipo,nome' });

      // Load pipelines
      const [deals, tickets] = await Promise.all([
        getPipelines(token.trim(), 'deals'),
        getPipelines(token.trim(), 'tickets'),
      ]);
      setDealPipelines(deals);
      setTicketPipelines(tickets);

      toast({ title: 'HubSpot conectado!', description: `Portal ID: ${result.portalId}` });
    } catch (e: any) {
      setError(e.message);
      setConnected(false);
      toast({ variant: 'destructive', title: 'Erro ao conectar', description: e.message });
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setConnected(false);
    setPortalId(null);
    setDealPipelines([]);
    setTicketPipelines([]);
    setPreview(null);
    setAssociations({});
    setImportLog([]);
    try {
      const empresaId = await getSaasEmpresaId();
      await (supabase as any).schema('saas').from('integracoes')
        .update({ status: 'desconectada' })
        .eq('empresa_id', empresaId)
        .eq('tipo', 'hubspot');
    } catch {}
    toast({ title: 'HubSpot desconectado' });
  };

  // ─── Preview Object ────────────────────────────────
  const handlePreview = async () => {
    if (!importId.trim()) return;
    setImporting(true);
    setPreview(null);
    setAssociations({});
    setImportLog([]);
    try {
      const obj = await getObject(token.trim(), importType, importId.trim());
      setPreview(obj);

      // Load associations
      const assocs: Record<string, HsObject[]> = {};
      if (obj.associations) {
        for (const [key, val] of Object.entries(obj.associations)) {
          const ids = val.results?.map((r: any) => r.id) || [];
          if (ids.length > 0) {
            const type = key as HsObjectType;
            assocs[key] = await getObjectsBatch(token.trim(), type, ids);
          }
        }
      }
      setAssociations(assocs);
      toast({ title: 'Objeto carregado!', description: `${Object.keys(assocs).length} tipos de associação encontrados` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao buscar objeto', description: e.message });
    } finally {
      setImporting(false);
    }
  };

  // ─── Import Object + Associations ──────────────────
  const handleImport = async () => {
    if (!preview) return;
    setImporting(true);
    const log: string[] = [];
    try {
      // Import main object
      let mainRecord: any;
      if (importType === 'contacts') {
        mainRecord = await crm.createContact(mapContact(preview));
        log.push(`Contato "${mainRecord.nome}" importado (ID: ${mainRecord.numero_registro})`);
      } else if (importType === 'companies') {
        mainRecord = await crm.createCompany(mapCompany(preview));
        log.push(`Empresa "${mainRecord.nome}" importado (ID: ${mainRecord.numero_registro})`);
      } else if (importType === 'deals') {
        mainRecord = await crm.createDeal(mapDeal(preview));
        log.push(`Negócio "${mainRecord.nome}" importado (ID: ${mainRecord.numero_registro})`);
      } else if (importType === 'tickets') {
        mainRecord = await crm.createTicket(mapTicket(preview));
        log.push(`Ticket "${mainRecord.titulo}" importado (ID: ${mainRecord.numero_registro})`);
      }

      // Import associated objects
      for (const [assocType, objects] of Object.entries(associations)) {
        for (const obj of objects) {
          try {
            let assocRecord: any;
            if (assocType === 'contacts') {
              assocRecord = await crm.createContact(mapContact(obj));
              log.push(`  → Contato associado "${assocRecord.nome}" importado`);
            } else if (assocType === 'companies') {
              assocRecord = await crm.createCompany(mapCompany(obj));
              log.push(`  → Empresa associada "${assocRecord.nome}" importada`);
            } else if (assocType === 'deals') {
              assocRecord = await crm.createDeal(mapDeal(obj));
              log.push(`  → Negócio associado "${assocRecord.nome}" importado`);
            } else if (assocType === 'tickets') {
              assocRecord = await crm.createTicket(mapTicket(obj));
              log.push(`  → Ticket associado "${assocRecord.titulo}" importado`);
            }

            // Create association
            if (mainRecord && assocRecord) {
              const origemTipo = importType === 'contacts' ? 'contact' : importType === 'companies' ? 'company' : importType === 'deals' ? 'deal' : 'ticket';
              const destinoTipo = assocType === 'contacts' ? 'contact' : assocType === 'companies' ? 'company' : assocType === 'deals' ? 'deal' : 'ticket';
              await crm.createAssociation({
                origem_tipo: origemTipo,
                origem_id: mainRecord.id,
                destino_tipo: destinoTipo,
                destino_id: assocRecord.id,
                tipo_associacao: 'relacionado',
              });
              log.push(`  → Vínculo criado: ${origemTipo} ↔ ${destinoTipo}`);
            }
          } catch (e: any) {
            log.push(`  ✗ Erro ao importar ${assocType}: ${e.message}`);
          }
        }
      }

      setImportLog(log);
      toast({ title: 'Importação concluída!', description: `${log.length} operações realizadas` });
    } catch (e: any) {
      log.push(`✗ Erro: ${e.message}`);
      setImportLog(log);
      toast({ variant: 'destructive', title: 'Erro na importação', description: e.message });
    } finally {
      setImporting(false);
    }
  };

  // ─── Render ────────────────────────────────────────
  const totalAssocs = Object.values(associations).reduce((s, a) => s + a.length, 0);

  return (
    <div className="space-y-4">
      {/* Connection Card */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#ff7a59]/10 flex items-center justify-center text-xl">🔗</div>
          <div className="flex-1">
            <h3 className="font-semibold text-sm">HubSpot CRM</h3>
            <p className="text-[11px] text-muted-foreground">Conecte sua conta HubSpot para sincronizar contatos, negócios, empresas e tickets.</p>
          </div>
          {connected && (
            <Badge className="bg-green-500/15 text-green-500 border-green-500/30 gap-1">
              <CheckCircle2 className="w-3 h-3" /> Conectado
            </Badge>
          )}
        </div>

        {!connected ? (
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
                  {connecting ? 'Conectando...' : 'Conectar'}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5">
                Crie um Private App em HubSpot → Settings → Integrations → Private Apps.
                Permissões necessárias: crm.objects.contacts.read, crm.objects.deals.read, crm.objects.companies.read, crm.objects.tickets.read
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
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>Portal ID: <strong className="text-foreground">{portalId}</strong></span>
              <span>Pipelines: <strong className="text-foreground">{dealPipelines.length + ticketPipelines.length}</strong></span>
            </div>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-destructive hover:text-destructive" onClick={handleDisconnect}>
              <Unlink className="w-3 h-3" /> Desconectar
            </Button>
          </div>
        )}
      </div>

      {/* Pipelines */}
      {connected && (dealPipelines.length > 0 || ticketPipelines.length > 0) && (
        <div className="glass-card p-4">
          <button onClick={() => setShowPipelines(!showPipelines)} className="w-full flex items-center justify-between">
            <h4 className="text-xs font-semibold">Pipelines HubSpot ({dealPipelines.length + ticketPipelines.length})</h4>
            {showPipelines ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          {showPipelines && (
            <div className="mt-3 space-y-3">
              {[...dealPipelines.map(p => ({ ...p, type: 'Negócios' })), ...ticketPipelines.map(p => ({ ...p, type: 'Tickets' }))].map(p => (
                <div key={p.id} className="rounded-lg border border-border/50 overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 bg-muted/20">
                    <span className="text-xs font-medium">{p.label}</span>
                    <Badge variant="outline" className="text-[9px] h-4">{p.type} · {p.stages.length} etapas</Badge>
                  </div>
                  <div className="px-3 py-2 flex flex-wrap gap-1.5">
                    {p.stages.map((s, i) => (
                      <div key={s.id} className="flex items-center gap-1">
                        <Badge variant="outline" className="text-[9px] h-5">{s.label}</Badge>
                        {i < p.stages.length - 1 && <ArrowRight className="w-2.5 h-2.5 text-muted-foreground/40" />}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Import */}
      {connected && (
        <div className="glass-card p-5">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Download className="w-4 h-4 text-primary" />
            Importar Objeto
          </h4>
          <p className="text-[11px] text-muted-foreground mb-4">
            Informe o ID de um objeto do HubSpot para importar com todos os seus vínculos.
          </p>

          <div className="flex gap-2 mb-4">
            <Select value={importType} onValueChange={v => { setImportType(v as HsObjectType); setPreview(null); setAssociations({}); setImportLog([]); }}>
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
              value={importId}
              onChange={e => setImportId(e.target.value)}
              placeholder="ID do objeto (ex: 12345)"
              className="h-9 text-xs font-mono flex-1"
            />
            <Button size="sm" className="h-9 gap-1.5" onClick={handlePreview} disabled={importing || !importId.trim()}>
              {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
              Buscar
            </Button>
          </div>

          {/* Preview */}
          {preview && (
            <div className="space-y-3">
              <div className="rounded-lg border border-border/50 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold">Dados do {OBJECT_TYPES.find(t => t.value === importType)?.label}</span>
                  <Badge variant="outline" className="text-[9px]">HS #{preview.id}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  {Object.entries(preview.properties).filter(([, v]) => v).map(([key, val]) => (
                    <div key={key} className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground truncate mr-2">{key}</span>
                      <span className="font-medium truncate text-right max-w-[200px]">{val}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Associations */}
              {totalAssocs > 0 && (
                <div className="rounded-lg border border-border/50 p-3">
                  <span className="text-xs font-semibold block mb-2">Vínculos encontrados ({totalAssocs})</span>
                  {Object.entries(associations).map(([type, objects]) => (
                    <div key={type} className="mb-2">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{type} ({objects.length})</span>
                      <div className="space-y-1 mt-1">
                        {objects.map(obj => {
                          const name = obj.properties.firstname
                            ? `${obj.properties.firstname} ${obj.properties.lastname || ''}`
                            : obj.properties.name || obj.properties.dealname || obj.properties.subject || `ID ${obj.id}`;
                          return (
                            <div key={obj.id} className="flex items-center justify-between text-[11px] px-2 py-1 rounded bg-muted/20">
                              <span className="truncate">{name}</span>
                              <span className="text-muted-foreground font-mono">#{obj.id}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <Button className="w-full gap-2" onClick={handleImport} disabled={importing}>
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Importar para o CRM {totalAssocs > 0 && `(+ ${totalAssocs} vínculos)`}
              </Button>
            </div>
          )}

          {/* Import Log */}
          {importLog.length > 0 && (
            <div className="mt-3 rounded-lg border border-border/50 p-3 bg-muted/10 max-h-48 overflow-y-auto">
              <span className="text-[10px] font-semibold block mb-1.5">Log da importação</span>
              {importLog.map((line, i) => (
                <p key={i} className={cn('text-[11px] font-mono', line.startsWith('✗') ? 'text-destructive' : 'text-muted-foreground')}>
                  {line}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
