import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Loader2, CheckCircle2, AlertCircle, Link2, Unlink, Eye, EyeOff,
  Search, Users, Building2, Briefcase, Ticket,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { getSaasEmpresaId } from '@/lib/saas';
import { encryptToken } from '@/lib/tokenCrypto';
import {
  verifyConnection, getObject, getObjectsBatch,
  type HsObjectType, type HsObject,
} from '@/lib/hubspotService';

const OBJECT_TYPES: { value: HsObjectType; label: string; icon: typeof Users }[] = [
  { value: 'contacts', label: 'Contato', icon: Users },
  { value: 'companies', label: 'Empresa', icon: Building2 },
  { value: 'deals', label: 'Negócio', icon: Briefcase },
  { value: 'tickets', label: 'Ticket', icon: Ticket },
];

function objectName(obj: HsObject, type: string): string {
  const p = obj.properties;
  if (type === 'contacts') return [p.firstname, p.lastname].filter(Boolean).join(' ') || `Contato #${obj.id}`;
  if (type === 'companies') return p.name || `Empresa #${obj.id}`;
  if (type === 'deals') return p.dealname || `Negócio #${obj.id}`;
  if (type === 'tickets') return p.subject || `Ticket #${obj.id}`;
  return `#${obj.id}`;
}

function objectTypeLabel(type: string): string {
  return OBJECT_TYPES.find(t => t.value === type)?.label || type;
}

interface ListItem {
  id: string;
  name: string;
  type: string;
  typeLabel: string;
  extra?: string;
}

export default function HubSpotIntegration() {
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [portalId, setPortalId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const [searchType, setSearchType] = useState<HsObjectType>('contacts');
  const [searchId, setSearchId] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ListItem[]>([]);
  const [mainObject, setMainObject] = useState<ListItem | null>(null);

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

      toast({ title: 'HubSpot conectado!', description: `Portal ID: ${result.portalId}` });
    } catch (e: any) {
      setError(e.message);
      toast({ variant: 'destructive', title: 'Erro ao conectar', description: e.message });
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = () => {
    setConnected(false);
    setPortalId(null);
    setResults([]);
    setMainObject(null);
    toast({ title: 'HubSpot desconectado' });
  };

  // ─── Search ─────────────────────────────────────────
  const handleSearch = async () => {
    if (!searchId.trim()) return;
    setLoading(true);
    setResults([]);
    setMainObject(null);
    try {
      const obj = await getObject(token.trim(), searchType, searchId.trim());

      // Main object
      const main: ListItem = {
        id: obj.id,
        name: objectName(obj, searchType),
        type: searchType,
        typeLabel: objectTypeLabel(searchType),
        extra: obj.properties.email || obj.properties.domain || obj.properties.amount ? `R$ ${obj.properties.amount}` : undefined,
      };
      setMainObject(main);

      // Associated objects
      const items: ListItem[] = [];
      if (obj.associations) {
        for (const [assocType, assocData] of Object.entries(obj.associations)) {
          const ids = assocData.results?.map((r: any) => r.id) || [];
          if (ids.length > 0) {
            const objects = await getObjectsBatch(token.trim(), assocType as HsObjectType, ids);
            for (const o of objects) {
              items.push({
                id: o.id,
                name: objectName(o, assocType),
                type: assocType,
                typeLabel: objectTypeLabel(assocType),
                extra: o.properties.email || o.properties.domain || (o.properties.amount ? `R$ ${o.properties.amount}` : undefined) || undefined,
              });
            }
          }
        }
      }
      setResults(items);

      if (items.length === 0) {
        toast({ title: 'Objeto encontrado', description: 'Nenhum vínculo associado.' });
      } else {
        toast({ title: `${items.length} vínculos encontrados` });
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao buscar', description: e.message });
    } finally {
      setLoading(false);
    }
  };

  const typeIcon = (type: string) => {
    const T = OBJECT_TYPES.find(t => t.value === type);
    return T ? <T.icon className="w-3.5 h-3.5" /> : null;
  };

  const typeBadgeColor = (type: string) => {
    if (type === 'contacts') return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    if (type === 'companies') return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    if (type === 'deals') return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
    if (type === 'tickets') return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
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
                </div>
                <Badge variant="outline" className={cn('text-[9px] h-5', typeBadgeColor(mainObject.type))}>{mainObject.typeLabel}</Badge>
                <span className="text-[10px] text-muted-foreground font-mono">#{mainObject.id}</span>
              </div>
            </div>
          )}

          {/* Results table */}
          {results.length > 0 && (
            <div className="rounded-lg border border-border/50 overflow-hidden">
              <div className="px-4 py-2 bg-muted/20 border-b border-border/30">
                <span className="text-xs font-medium">{results.length} registro{results.length !== 1 ? 's' : ''} vinculado{results.length !== 1 ? 's' : ''}</span>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/30 text-muted-foreground">
                    <th className="text-left px-4 py-2 font-medium w-20">ID</th>
                    <th className="text-left px-4 py-2 font-medium">Nome</th>
                    <th className="text-left px-4 py-2 font-medium w-32">Objeto</th>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Empty state after search */}
          {mainObject && results.length === 0 && !loading && (
            <div className="text-center py-6">
              <p className="text-xs text-muted-foreground">Nenhum registro vinculado encontrado para este objeto.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
