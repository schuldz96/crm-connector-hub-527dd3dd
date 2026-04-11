import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Plus, X, FileText, Copy, Loader2, Trash2, ExternalLink, ToggleLeft, ToggleRight,
  GripVertical, Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { getOrg, getOrgAndEmpresaId } from '@/lib/saas';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface FormField {
  id: string;
  label: string;
  type: 'text' | 'email' | 'phone' | 'number' | 'select' | 'textarea';
  required: boolean;
  placeholder?: string;
  options?: string[];
  dbField?: string;
}

interface CrmForm {
  id: string;
  nome: string;
  slug: string;
  descricao: string;
  tipo_criacao: string;
  campos: FormField[];
  ativo: boolean;
  submissoes: number;
  criado_em: string;
}

const crm = () => (supabase as any).schema('crm');

const DEFAULT_CONTACT_FIELDS: FormField[] = [
  { id: '1', label: 'Nome', type: 'text', required: true, placeholder: 'Seu nome completo', dbField: 'nome' },
  { id: '2', label: 'E-mail', type: 'email', required: true, placeholder: 'seu@email.com', dbField: 'email' },
  { id: '3', label: 'Telefone', type: 'phone', required: false, placeholder: '+55 11 99999-0000', dbField: 'telefone' },
];

export default function CRMFormsPage() {
  const { toast } = useToast();
  const [forms, setForms] = useState<CrmForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingForm, setEditingForm] = useState<CrmForm | null>(null);
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formType, setFormType] = useState('contact');
  const [formFields, setFormFields] = useState<FormField[]>(DEFAULT_CONTACT_FIELDS);
  const submittingRef = useRef(false);

  useEffect(() => { loadForms(); }, []);

  async function loadForms() {
    setLoading(true);
    try {
      const { empresaId } = await getOrgAndEmpresaId();
      const { data } = await crm().from('formularios').select('*').eq('empresa_id', empresaId).order('criado_em', { ascending: false });
      setForms(data || []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }

  async function handleSave() {
    if (submittingRef.current || !formName.trim() || !formSlug.trim()) return;
    submittingRef.current = true;
    try {
      const { org, empresaId } = await getOrgAndEmpresaId();
      const slug = formSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
      if (editingForm) {
        await crm().from('formularios').update({
          nome: formName, slug, tipo_criacao: formType, campos: formFields, atualizado_em: new Date().toISOString(),
        }).eq('id', editingForm.id);
        toast({ title: 'Formulário atualizado' });
      } else {
        await crm().from('formularios').insert({
          empresa_id: empresaId, org, nome: formName, slug, tipo_criacao: formType, campos: formFields,
        });
        toast({ title: 'Formulário criado' });
      }
      setShowCreate(false);
      setEditingForm(null);
      resetForm();
      loadForms();
    } catch (e: any) {
      toast({ title: 'Erro', description: e?.message?.includes('idx_crm_formularios_slug') ? 'Slug já existe' : e?.message, variant: 'destructive' });
    }
    finally { submittingRef.current = false; }
  }

  function resetForm() {
    setFormName('');
    setFormSlug('');
    setFormType('contact');
    setFormFields(DEFAULT_CONTACT_FIELDS);
  }

  function openEdit(form: CrmForm) {
    setEditingForm(form);
    setFormName(form.nome);
    setFormSlug(form.slug);
    setFormType(form.tipo_criacao);
    setFormFields(form.campos || DEFAULT_CONTACT_FIELDS);
    setShowCreate(true);
  }

  async function toggleActive(form: CrmForm) {
    await crm().from('formularios').update({ ativo: !form.ativo }).eq('id', form.id);
    loadForms();
  }

  async function deleteForm(id: string) {
    if (!confirm('Excluir este formulário?')) return;
    await crm().from('formularios').delete().eq('id', id);
    loadForms();
    toast({ title: 'Formulário excluído' });
  }

  function addField() {
    setFormFields(f => [...f, { id: crypto.randomUUID(), label: '', type: 'text', required: false }]);
  }

  function removeField(id: string) {
    setFormFields(f => f.filter(x => x.id !== id));
  }

  function updateField(id: string, key: string, value: any) {
    setFormFields(f => f.map(x => x.id === id ? { ...x, [key]: value } : x));
  }

  const formUrl = (slug: string) => `${window.location.origin}/f/${slug}`;

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            Formulários
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{forms.length} formulários</p>
        </div>
        <Button onClick={() => { resetForm(); setEditingForm(null); setShowCreate(true); }} className="gap-1.5">
          <Plus className="w-4 h-4" /> Novo Formulário
        </Button>
      </div>

      {/* List */}
      <div className="grid gap-3">
        {forms.map(form => (
          <div key={form.id} className="border border-border rounded-lg p-4 bg-card hover:bg-muted/20 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-primary" />
                <div>
                  <h3 className="font-medium">{form.nome}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">/f/{form.slug}</code>
                    <button onClick={() => { navigator.clipboard.writeText(formUrl(form.slug)); toast({ title: 'URL copiada!' }); }}
                      className="text-muted-foreground hover:text-foreground"><Copy className="w-3 h-3" /></button>
                    <Badge variant="outline" className="text-[10px]">{form.tipo_criacao}</Badge>
                    <span className="text-[10px] text-muted-foreground">{form.campos?.length || 0} campos • {form.submissoes || 0} envios</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => toggleActive(form)} className={cn('text-xs', form.ativo ? 'text-green-500' : 'text-muted-foreground')}>
                  {form.ativo ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                </button>
                <Button variant="outline" size="sm" onClick={() => openEdit(form)}>Editar</Button>
                <a href={formUrl(form.slug)} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary">
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button onClick={() => deleteForm(form.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
        {forms.length === 0 && <p className="text-center text-muted-foreground py-8">Nenhum formulário criado ainda</p>}
      </div>

      {/* Create/Edit modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-start justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setShowCreate(false); setEditingForm(null); }} />
          <div className="relative w-[480px] h-full bg-card border-l border-border shadow-xl overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-base font-semibold">{editingForm ? 'Editar' : 'Novo'} Formulário</h2>
              <button onClick={() => { setShowCreate(false); setEditingForm(null); }}><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="text-sm font-medium">Nome *</label>
                <Input value={formName} onChange={e => { setFormName(e.target.value); if (!editingForm) setFormSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-')); }} placeholder="Formulário de contato" className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Slug (URL) *</label>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-xs text-muted-foreground">/f/</span>
                  <Input value={formSlug} onChange={e => setFormSlug(e.target.value)} placeholder="contato-vendas" className="flex-1" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Criar ao submeter</label>
                <Select value={formType} onValueChange={setFormType}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contact">Contato</SelectItem>
                    <SelectItem value="company">Empresa</SelectItem>
                    <SelectItem value="deal">Negócio</SelectItem>
                    <SelectItem value="ticket">Ticket</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="border-t border-border pt-3">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Campos</label>
                  <Button variant="outline" size="sm" onClick={addField} className="h-7 text-xs"><Plus className="w-3 h-3 mr-1" /> Campo</Button>
                </div>
                <div className="space-y-2">
                  {formFields.map((field, idx) => (
                    <div key={field.id} className="flex items-center gap-2 p-2 border border-border rounded-md bg-muted/20">
                      <GripVertical className="w-3 h-3 text-muted-foreground shrink-0" />
                      <Input value={field.label} onChange={e => updateField(field.id, 'label', e.target.value)} placeholder="Label" className="h-7 text-xs flex-1" />
                      <select value={field.type} onChange={e => updateField(field.id, 'type', e.target.value)}
                        className="h-7 text-xs border border-border rounded px-1 bg-background w-20">
                        <option value="text">Texto</option>
                        <option value="email">E-mail</option>
                        <option value="phone">Telefone</option>
                        <option value="number">Número</option>
                        <option value="textarea">Área texto</option>
                        <option value="select">Seleção</option>
                      </select>
                      <button onClick={() => updateField(field.id, 'required', !field.required)}
                        className={cn('text-[10px] px-1.5 py-0.5 rounded border', field.required ? 'bg-primary/10 text-primary border-primary/30' : 'text-muted-foreground border-border')}>
                        {field.required ? 'Obrigatório' : 'Opcional'}
                      </button>
                      <button onClick={() => removeField(field.id)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-border">
              <Button onClick={handleSave} className="w-full">
                {editingForm ? 'Salvar' : 'Criar Formulário'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
