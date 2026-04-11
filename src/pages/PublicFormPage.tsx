import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const crm = () => (supabase as any).schema('crm');

interface FormField {
  id: string;
  label: string;
  type: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
  dbField?: string;
}

interface FormData {
  id: string;
  nome: string;
  descricao: string;
  tipo_criacao: string;
  campos: FormField[];
  empresa_id: string;
  org: string;
}

export default function PublicFormPage() {
  const { slug, org } = useParams<{ slug: string; org?: string }>();
  const [form, setForm] = useState<FormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!slug) return;
    let query = crm().from('formularios').select('id, nome, descricao, tipo_criacao, campos, empresa_id, org')
      .eq('slug', slug).eq('ativo', true);
    if (org) query = query.eq('org', org);
    query.maybeSingle()
      .then(({ data }: any) => { setForm(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [slug, org]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || submitting) return;

    // Validate required
    for (const field of form.campos) {
      if (field.required && !values[field.id]?.trim()) {
        setError(`Campo "${field.label}" é obrigatório`);
        return;
      }
    }

    setSubmitting(true);
    setError('');
    try {
      // Build record payload
      const payload: Record<string, any> = { empresa_id: form.empresa_id, org: form.org };
      for (const field of form.campos) {
        const val = values[field.id]?.trim();
        if (!val) continue;
        if (field.dbField) payload[field.dbField] = val;
        else payload.dados_custom = { ...(payload.dados_custom || {}), [field.label]: val };
      }

      // Create record based on tipo_criacao
      const tableMap: Record<string, string> = {
        contact: 'contatos', company: 'empresas_crm', deal: 'negocios', ticket: 'tickets_crm',
      };
      const table = tableMap[form.tipo_criacao];
      if (table) {
        if (form.tipo_criacao === 'contact') payload.status = payload.status || 'lead';
        if (form.tipo_criacao === 'deal') { payload.status = 'aberto'; payload.nome = payload.nome || values[form.campos[0]?.id] || 'Novo negócio'; }
        if (form.tipo_criacao === 'ticket') { payload.status = 'aberto'; payload.titulo = payload.titulo || values[form.campos[0]?.id] || 'Novo ticket'; }

        let created: { id: string } | null = null;

        // Upsert: check if record already exists (by email for contacts, by dominio for companies)
        if (form.tipo_criacao === 'contact' && payload.email) {
          const { data: existing } = await crm().from(table).select('id').eq('empresa_id', form.empresa_id).ilike('email', payload.email).is('deletado_em', null).maybeSingle();
          if (existing) {
            const { email: _e, empresa_id: _eid, org: _o, status: _s, ...updateFields } = payload;
            await crm().from(table).update(updateFields).eq('id', existing.id);
            created = existing;
          }
        } else if (form.tipo_criacao === 'company' && payload.dominio) {
          const { data: existing } = await crm().from(table).select('id').eq('empresa_id', form.empresa_id).ilike('dominio', payload.dominio).is('deletado_em', null).maybeSingle();
          if (existing) {
            const { empresa_id: _eid, org: _o, ...updateFields } = payload;
            await crm().from(table).update(updateFields).eq('id', existing.id);
            created = existing;
          }
        }

        // If no existing found, create new
        if (!created) {
          const { data } = await crm().from(table).insert(payload).select('id').single();
          created = data;
        }

        // Log submission
        await crm().from('formulario_submissoes').insert({
          formulario_id: form.id, empresa_id: form.empresa_id, org: form.org,
          dados: values, registro_criado_id: created?.id, registro_criado_tipo: form.tipo_criacao,
        });

        // Increment counter
        await crm().from('formularios').update({ submissoes: (form as any).submissoes + 1 }).eq('id', form.id);
      }

      setSubmitted(true);
    } catch (err: any) {
      setError(err?.message || 'Erro ao enviar formulário');
    }
    finally { setSubmitting(false); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  if (!form) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-xl font-semibold">Formulário não encontrado</h1>
        <p className="text-muted-foreground mt-1">Este formulário não existe ou está desativado.</p>
      </div>
    </div>
  );

  if (submitted) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
        <h1 className="text-xl font-semibold">Enviado com sucesso!</h1>
        <p className="text-muted-foreground mt-1">Obrigado por preencher o formulário.</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex items-start justify-center pt-12 px-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-display font-bold">{form.nome}</h1>
          {form.descricao && <p className="text-muted-foreground mt-1">{form.descricao}</p>}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 bg-card border border-border rounded-xl p-6">
          {form.campos.map(field => (
            <div key={field.id}>
              <label className="text-sm font-medium">{field.label}{field.required && ' *'}</label>
              {field.type === 'textarea' ? (
                <textarea value={values[field.id] || ''} onChange={e => setValues(v => ({ ...v, [field.id]: e.target.value }))}
                  placeholder={field.placeholder} className="mt-1 w-full h-20 text-sm border border-border rounded-md px-3 py-2 bg-background resize-none" />
              ) : field.type === 'select' && field.options ? (
                <select value={values[field.id] || ''} onChange={e => setValues(v => ({ ...v, [field.id]: e.target.value }))}
                  className="mt-1 w-full h-9 text-sm border border-border rounded-md px-2 bg-background">
                  <option value="">Selecione...</option>
                  {field.options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <Input value={values[field.id] || ''} onChange={e => setValues(v => ({ ...v, [field.id]: e.target.value }))}
                  type={field.type === 'phone' ? 'tel' : field.type} placeholder={field.placeholder} className="mt-1" />
              )}
            </div>
          ))}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            Enviar
          </Button>
        </form>
      </div>
    </div>
  );
}
