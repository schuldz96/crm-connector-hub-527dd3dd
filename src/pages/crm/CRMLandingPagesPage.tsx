import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Plus, Globe, Copy, Loader2, Trash2, ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { getOrg, getOrgAndEmpresaId } from '@/lib/saas';
import { useToast } from '@/hooks/use-toast';
import { useOrgNavigate } from '@/hooks/useOrgNavigate';

interface LandingPage {
  id: string;
  nome: string;
  slug: string;
  status: string;
  formulario_id: string | null;
  config: {
    headline?: string;
    subheadline?: string;
    ctaText?: string;
    bgColor?: string;
    textColor?: string;
    accentColor?: string;
    logoUrl?: string;
    heroImage?: string;
    sections?: { type: string; content: string }[];
  };
  visitas: number;
  conversoes: number;
  criado_em: string;
}

const crm = () => (supabase as any).schema('crm');

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  rascunho: { label: 'Rascunho', color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30' },
  publicada: { label: 'Publicada', color: 'bg-green-500/10 text-green-600 border-green-500/30' },
  arquivada: { label: 'Arquivada', color: 'bg-gray-500/10 text-gray-600 border-gray-500/30' },
};

export default function CRMLandingPagesPage() {
  const { toast } = useToast();
  const navigate = useOrgNavigate();
  const [pages, setPages] = useState<LandingPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentOrg, setCurrentOrg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { loadData(); getOrg().then(setCurrentOrg).catch(() => {}); }, []);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const { empresaId } = await getOrgAndEmpresaId();
      const { data } = await crm()
        .from('landing_pages')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('criado_em', { ascending: false });
      setPages(data || []);
    } catch (e: any) {
      console.error('LP loadData error:', e);
      setError(e?.message || 'Erro ao carregar landing pages');
    }
    finally { setLoading(false); }
  }

  function openNew() {
    navigate('/crm/landing-pages/editor/new');
  }

  function openEdit(lp: LandingPage) {
    navigate(`/crm/landing-pages/editor/${lp.id}`);
  }

  async function updateStatus(lp: LandingPage, status: string) {
    await crm().from('landing_pages').update({ status }).eq('id', lp.id);
    loadData();
  }

  async function deleteLp(id: string) {
    if (!confirm('Excluir esta LP?')) return;
    await crm().from('landing_pages').delete().eq('id', id);
    loadData();
    toast({ title: 'LP excluída' });
  }

  const lpUrl = (s: string) => `${window.location.origin}/lp/${currentOrg}/${s}`;

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (error) return (
    <div className="flex flex-col items-center justify-center py-12 gap-3">
      <p className="text-destructive text-sm">{error}</p>
      <Button variant="outline" onClick={loadData}>Tentar novamente</Button>
    </div>
  );

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <Globe className="w-6 h-6 text-primary" />
            Landing Pages
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{pages.length} páginas</p>
        </div>
        <Button onClick={openNew} className="gap-1.5"><Plus className="w-4 h-4" /> Nova LP</Button>
      </div>

      {/* List */}
      <div className="grid gap-3">
        {pages.map(lp => {
          const st = STATUS_CONFIG[lp.status] || STATUS_CONFIG.rascunho;
          const convRate = lp.visitas > 0 ? ((lp.conversoes / lp.visitas) * 100).toFixed(1) : '0';
          return (
            <div key={lp.id} className="border border-border rounded-lg p-4 bg-card hover:bg-muted/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: lp.config?.accentColor || '#6366f1' }}>
                    <Globe className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-medium">{lp.nome}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">/lp/{currentOrg}/{lp.slug}</code>
                      <button onClick={() => { navigator.clipboard.writeText(lpUrl(lp.slug)); toast({ title: 'URL copiada!' }); }}
                        className="text-muted-foreground hover:text-foreground"><Copy className="w-3 h-3" /></button>
                      <Badge variant="outline" className={cn('text-[10px]', st.color)}>{st.label}</Badge>
                      <span className="text-[10px] text-muted-foreground">{lp.visitas} visitas • {lp.conversoes} conversões • {convRate}%</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {lp.status === 'rascunho' && <Button variant="outline" size="sm" onClick={() => updateStatus(lp, 'publicada')}>Publicar</Button>}
                  {lp.status === 'publicada' && <Button variant="outline" size="sm" onClick={() => updateStatus(lp, 'arquivada')}>Arquivar</Button>}
                  <Button variant="outline" size="sm" onClick={() => openEdit(lp)}>Editar</Button>
                  <a href={lpUrl(lp.slug)} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary"><ExternalLink className="w-4 h-4" /></a>
                  <button onClick={() => deleteLp(lp.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          );
        })}
        {pages.length === 0 && (
          <div className="border border-dashed border-border rounded-xl p-12 text-center bg-card">
            <Globe className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground">Nenhuma landing page criada</h3>
            <p className="text-muted-foreground text-sm mt-1 mb-4">Crie sua primeira LP para capturar leads com formulários personalizados.</p>
            <Button onClick={openNew} className="gap-1.5"><Plus className="w-4 h-4" /> Criar Landing Page</Button>
          </div>
        )}
      </div>

    </div>
  );
}
