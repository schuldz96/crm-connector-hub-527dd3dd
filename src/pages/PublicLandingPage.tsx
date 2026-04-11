import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import PublicFormPage from './PublicFormPage';

const crm = () => (supabase as any).schema('crm');

interface LPData {
  id: string;
  nome: string;
  config: {
    headline?: string;
    subheadline?: string;
    ctaText?: string;
    bgColor?: string;
    accentColor?: string;
  };
  formulario_id: string | null;
  formulario_slug: string | null;
}

export default function PublicLandingPage() {
  const { slug } = useParams<{ slug: string }>();
  const [lp, setLp] = useState<LPData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (!slug) return;
    crm().from('landing_pages').select('id, nome, config, formulario_id, status')
      .eq('slug', slug).eq('status', 'publicada').maybeSingle()
      .then(async ({ data }: any) => {
        if (data?.formulario_id) {
          const { data: form } = await crm().from('formularios').select('slug').eq('id', data.formulario_id).maybeSingle();
          data.formulario_slug = form?.slug;
        }
        setLp(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // Track visit
    if (slug) {
      crm().from('landing_pages').select('visitas').eq('slug', slug).maybeSingle()
        .then(({ data }: any) => {
          if (data) crm().from('landing_pages').update({ visitas: (data.visitas || 0) + 1 }).eq('slug', slug);
        });
    }
  }, [slug]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  if (!lp) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-xl font-semibold">Página não encontrada</h1>
      </div>
    </div>
  );

  const cfg = lp.config || {};

  if (showForm && lp.formulario_slug) {
    return <PublicFormPage />;
  }

  return (
    <div className="min-h-screen" style={{ background: cfg.bgColor || '#0f172a', color: '#fff' }}>
      {/* Hero Section */}
      <div className="max-w-4xl mx-auto px-6 py-24 text-center">
        <h1 className="text-4xl md:text-6xl font-display font-bold leading-tight mb-6">
          {cfg.headline || lp.nome}
        </h1>
        {cfg.subheadline && (
          <p className="text-lg md:text-xl opacity-80 max-w-2xl mx-auto mb-8 leading-relaxed">
            {cfg.subheadline}
          </p>
        )}
        {lp.formulario_slug ? (
          <a href={`/f/${lp.formulario_slug}`}>
            <Button size="lg" className="text-lg px-8 py-6 rounded-xl" style={{ background: cfg.accentColor || '#6366f1' }}>
              {cfg.ctaText || 'Quero saber mais'}
            </Button>
          </a>
        ) : (
          <Button size="lg" className="text-lg px-8 py-6 rounded-xl" style={{ background: cfg.accentColor || '#6366f1' }}>
            {cfg.ctaText || 'Quero saber mais'}
          </Button>
        )}
      </div>

      {/* Footer */}
      <div className="text-center py-8 opacity-40 text-sm">
        Powered by LTX
      </div>
    </div>
  );
}
