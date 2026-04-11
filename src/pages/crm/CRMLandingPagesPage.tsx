import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Plus, X, Globe, Copy, Loader2, Trash2, ExternalLink, Eye, Palette,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { getOrgAndEmpresaId } from '@/lib/saas';
import { useToast } from '@/hooks/use-toast';

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

interface FormOption {
  id: string;
  nome: string;
  slug: string;
}

const crm = () => (supabase as any).schema('crm');

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  rascunho: { label: 'Rascunho', color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30' },
  publicada: { label: 'Publicada', color: 'bg-green-500/10 text-green-600 border-green-500/30' },
  arquivada: { label: 'Arquivada', color: 'bg-gray-500/10 text-gray-600 border-gray-500/30' },
};

export default function CRMLandingPagesPage() {
  const { toast } = useToast();
  const [pages, setPages] = useState<LandingPage[]>([]);
  const [forms, setForms] = useState<FormOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editing, setEditing] = useState<LandingPage | null>(null);
  const submittingRef = useRef(false);

  // Editor state
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [formId, setFormId] = useState('');
  const [headline, setHeadline] = useState('');
  const [subheadline, setSubheadline] = useState('');
  const [ctaText, setCtaText] = useState('Quero saber mais');
  const [bgColor, setBgColor] = useState('#0f172a');
  const [accentColor, setAccentColor] = useState('#6366f1');

  const [error, setError] = useState('');

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const { empresaId } = await getOrgAndEmpresaId();
      const [lpRes, formRes] = await Promise.all([
        crm().from('landing_pages').select('*').eq('empresa_id', empresaId).order('criado_em', { ascending: false }),
        crm().from('formularios').select('id, nome, slug').eq('empresa_id', empresaId).eq('ativo', true),
      ]);
      setPages(lpRes.data || []);
      setForms(formRes.data || []);
    } catch (e: any) {
      console.error('LP loadData error:', e);
      setError(e?.message || 'Erro ao carregar landing pages');
    }
    finally { setLoading(false); }
  }

  function openNew() {
    setEditing(null);
    setName(''); setSlug(''); setFormId(''); setHeadline(''); setSubheadline('');
    setCtaText('Quero saber mais'); setBgColor('#0f172a'); setAccentColor('#6366f1');
    setShowEditor(true);
  }

  function openEdit(lp: LandingPage) {
    setEditing(lp);
    setName(lp.nome); setSlug(lp.slug); setFormId(lp.formulario_id || '');
    setHeadline(lp.config?.headline || ''); setSubheadline(lp.config?.subheadline || '');
    setCtaText(lp.config?.ctaText || 'Quero saber mais');
    setBgColor(lp.config?.bgColor || '#0f172a'); setAccentColor(lp.config?.accentColor || '#6366f1');
    setShowEditor(true);
  }

  async function handleSave() {
    if (submittingRef.current || !name.trim() || !slug.trim()) return;
    submittingRef.current = true;
    try {
      const { org, empresaId } = await getOrgAndEmpresaId();
      const s = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
      const config = { headline, subheadline, ctaText, bgColor, accentColor };
      if (editing) {
        await crm().from('landing_pages').update({ nome: name, slug: s, formulario_id: formId || null, config, atualizado_em: new Date().toISOString() }).eq('id', editing.id);
      } else {
        await crm().from('landing_pages').insert({ empresa_id: empresaId, org, nome: name, slug: s, formulario_id: formId || null, config });
      }
      setShowEditor(false);
      loadData();
      toast({ title: editing ? 'LP atualizada' : 'LP criada' });
    } catch (e: any) {
      toast({ title: 'Erro', description: e?.message?.includes('idx_crm_lp_slug') ? 'Slug já existe' : e?.message, variant: 'destructive' });
    }
    finally { submittingRef.current = false; }
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

  const lpUrl = (s: string) => `${window.location.origin}/lp/${s}`;

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
                      <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">/lp/{lp.slug}</code>
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

      {/* Editor Dialog (centralizado) */}
      <Dialog open={showEditor} onOpenChange={open => { if (!open) setShowEditor(false); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Palette className="w-4 h-4" /> {editing ? 'Editar' : 'Nova'} Landing Page</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium">Nome *</label>
              <Input value={name} onChange={e => { setName(e.target.value); if (!editing) setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-')); }} className="mt-1" placeholder="Minha Landing Page" />
            </div>
            <div>
              <label className="text-sm font-medium">Slug (URL) *</label>
              <div className="flex items-center gap-1 mt-1">
                <code className="text-xs text-muted-foreground bg-muted px-1.5 py-1 rounded">{window.location.origin}/lp/</code>
                <Input value={slug} onChange={e => setSlug(e.target.value)} className="flex-1" />
              </div>
              {slug && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <code className="text-xs text-primary bg-primary/10 px-2 py-1 rounded flex-1 truncate">{lpUrl(slug)}</code>
                  <button onClick={() => { navigator.clipboard.writeText(lpUrl(slug)); toast({ title: 'URL copiada!' }); }}
                    className="text-muted-foreground hover:text-primary shrink-0"><Copy className="w-3.5 h-3.5" /></button>
                </div>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Formulário vinculado</label>
              <Select value={formId} onValueChange={setFormId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione um formulário" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhum</SelectItem>
                  {forms.map(f => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="border-t border-border pt-3">
              <label className="text-sm font-medium mb-2 block">Conteúdo</label>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground">Título principal</label>
                  <Input value={headline} onChange={e => setHeadline(e.target.value)} placeholder="Transforme seus resultados" className="mt-1" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Subtítulo</label>
                  <Textarea value={subheadline} onChange={e => setSubheadline(e.target.value)} placeholder="Descubra como nossa solução..." className="mt-1 h-16" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Texto do botão CTA</label>
                  <Input value={ctaText} onChange={e => setCtaText(e.target.value)} className="mt-1" />
                </div>
              </div>
            </div>

            <div className="border-t border-border pt-3">
              <label className="text-sm font-medium mb-2 block">Identidade visual</label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Cor de fundo</label>
                  <div className="flex gap-2 mt-1">
                    <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)} className="w-8 h-8 rounded border" />
                    <Input value={bgColor} onChange={e => setBgColor(e.target.value)} className="flex-1 h-8 text-xs" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Cor de destaque</label>
                  <div className="flex gap-2 mt-1">
                    <input type="color" value={accentColor} onChange={e => setAccentColor(e.target.value)} className="w-8 h-8 rounded border" />
                    <Input value={accentColor} onChange={e => setAccentColor(e.target.value)} className="flex-1 h-8 text-xs" />
                  </div>
                </div>
              </div>
            </div>

            <Button onClick={handleSave} className="w-full">{editing ? 'Salvar' : 'Criar LP'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
