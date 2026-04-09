import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Settings, Plus, Trash2, Edit2, Save, X, Loader2,
  Check, AlertCircle, MessageSquare, Key, ExternalLink,
  Copy, CheckCheck, LayoutTemplate, ChevronDown, ChevronUp,
  RefreshCw, Globe, Shield, RotateCcw, Users, Ticket,
  Zap, Tag, FileText, Image as ImageIcon, Mic, Palette,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import SearchableSelect from '@/components/ui/searchable-select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getOrg } from '@/lib/saas';
import { useAuth } from '@/contexts/AuthContext';
import { encryptToken } from '@/lib/tokenCrypto';
import type { MetaInboxAccount } from '@/pages/InboxPage';

/* ── Meta Template types ────────────────────────────── */
export type TemplateStatus = 'APPROVED' | 'PENDING' | 'REJECTED' | 'DRAFT' | 'PAUSED' | 'DISABLED';
export type TemplateCategory = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
export type TemplateLanguage = 'pt_BR' | 'en_US' | 'es' | string;

export interface TemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  text?: string;
  example?: any;
  buttons?: { type: string; text: string; url?: string; phone_number?: string; example?: any }[];
}

export type TemplateQuality = 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN';

export interface MetaTemplate {
  id: string;
  name: string;
  status: TemplateStatus;
  category: TemplateCategory;
  language: TemplateLanguage;
  components: TemplateComponent[];
  rejected_reason?: string;
  quality_score?: { score: TemplateQuality; date?: number } | null;
}

/* ── Account form ───────────────────────────────────── */
interface AccountFormData {
  nome: string;
  phone_number_id: string;
  waba_id: string;
  access_token: string;
  token_type: 'permanent' | 'oauth';
  phone_display: string;
  ticket_enabled: boolean;
  ticket_pipeline_id: string;
  ticket_estagio_id: string;
  ticket_prioridade: string;
}

const EMPTY_FORM: AccountFormData = {
  nome: '',
  phone_number_id: '',
  waba_id: '',
  access_token: '',
  token_type: 'permanent',
  phone_display: '',
  ticket_enabled: false,
  ticket_pipeline_id: '',
  ticket_estagio_id: '',
  ticket_prioridade: 'medium',
};

interface TicketPipeline {
  id: string;
  nome: string;
  estagios: { id: string; nome: string; ordem: number }[];
}

/* ── Status badge ───────────────────────────────────── */
const StatusBadge = ({ status }: { status: TemplateStatus }) => {
  const map: Record<TemplateStatus, { label: string; className: string }> = {
    APPROVED: { label: 'Aprovado', className: 'bg-green-500/10 text-green-600 border-green-500/20' },
    PENDING: { label: 'Pendente', className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' },
    REJECTED: { label: 'Rejeitado', className: 'bg-red-500/10 text-red-600 border-red-500/20' },
    DRAFT: { label: 'Rascunho', className: 'bg-muted text-muted-foreground border-border' },
    PAUSED: { label: 'Pausado', className: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
    DISABLED: { label: 'Desativado', className: 'bg-muted text-muted-foreground border-border' },
  };
  const cfg = map[status] || map.DRAFT;
  return <Badge variant="outline" className={cn('text-[10px] h-5 px-1.5', cfg.className)}>{cfg.label}</Badge>;
};

/* ── Quality badge ──────────────────────────────────── */
const QualityBadge = ({ quality }: { quality?: MetaTemplate['quality_score'] }) => {
  const score = quality?.score || 'UNKNOWN';
  const map: Record<string, { label: string; className: string }> = {
    GREEN: { label: 'Alta', className: 'bg-green-500/10 text-green-500 border-green-500/20' },
    YELLOW: { label: 'Média', className: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' },
    RED: { label: 'Baixa', className: 'bg-red-500/10 text-red-500 border-red-500/20' },
    UNKNOWN: { label: 'N/A', className: 'bg-muted text-muted-foreground border-border' },
  };
  const cfg = map[score] || map.UNKNOWN;
  return <Badge variant="outline" className={cn('text-[10px] h-5 px-1.5', cfg.className)}>Q: {cfg.label}</Badge>;
};

/* ── Category badge ─────────────────────────────────── */
const CatBadge = ({ cat }: { cat: TemplateCategory }) => {
  const map: Record<TemplateCategory, string> = {
    MARKETING: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
    UTILITY: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    AUTHENTICATION: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  };
  return (
    <Badge variant="outline" className={cn('text-[10px] h-5 px-1.5', map[cat] || '')}>
      {cat === 'MARKETING' ? 'Marketing' : cat === 'UTILITY' ? 'Utilidade' : 'Autenticação'}
    </Badge>
  );
};

/* ── Template form ──────────────────────────────────── */
type TemplateButtonType = 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
interface TemplateButton {
  type: TemplateButtonType;
  text: string;
  url?: string;
  phone_number?: string;
}

interface TemplateFormData {
  name: string;
  category: TemplateCategory;
  language: TemplateLanguage;
  header_text: string;
  body_text: string;
  footer_text: string;
  buttons: TemplateButton[];
}

const EMPTY_TEMPLATE: TemplateFormData = {
  name: '',
  category: 'UTILITY',
  language: 'pt_BR',
  header_text: '',
  body_text: '',
  footer_text: '',
  buttons: [],
};

/* ──────────────────────────────────────────────────── */
interface Props {
  onClose: () => void;
  onSaved: () => void;
  accounts?: MetaInboxAccount[];
  onAccountsChange?: (accounts: MetaInboxAccount[]) => void;
}

interface UserAccessRow {
  id: string;
  usuario_id: string;
  nome: string;
  email: string;
}

export default function InboxSettingsModal({ onClose, onSaved, accounts = [], onAccountsChange }: Props) {
  const { toast } = useToast();
  const { user } = useAuth();
  const isRestrictedRole = ['support', 'bdr', 'sdr', 'closer', 'key_account', 'csm', 'low_touch', 'sales_engineer', 'member'].includes(user?.role || '');
  const [tab, setTab] = useState(isRestrictedRole ? 'templates' : 'accounts');
  const [selectedAccount, setSelectedAccount] = useState<MetaInboxAccount | null>(accounts[0] ?? null);

  // Account form
  const [showAccountForm, setShowAccountForm] = useState(accounts.length === 0);
  const [editingAccount, setEditingAccount] = useState<MetaInboxAccount | null>(null);
  const [accountForm, setAccountForm] = useState<AccountFormData>(EMPTY_FORM);
  const [savingAccount, setSavingAccount] = useState(false);
  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(null);

  // Ticket pipelines
  const [ticketPipelines, setTicketPipelines] = useState<TicketPipeline[]>([]);

  // Templates
  const [templates, setTemplates] = useState<MetaTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MetaTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState<TemplateFormData>(EMPTY_TEMPLATE);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Access management
  const [accessUsers, setAccessUsers] = useState<UserAccessRow[]>([]);
  const [allUsers, setAllUsers] = useState<{ id: string; nome: string; email: string }[]>([]);
  const [loadingAccess, setLoadingAccess] = useState(false);
  const [savingAccess, setSavingAccess] = useState(false);
  const [accessAccountId, setAccessAccountId] = useState<string>(accounts[0]?.id || '');

  // Macros
  interface Macro { id: string; nome: string; tipo: string; conteudo: string | null; media_url: string | null; media_nome: string | null; account_ids: string[]; }
  const [macros, setMacros] = useState<Macro[]>([]);
  const [macroForm, setMacroForm] = useState({ nome: '', tipo: 'text', conteudo: '', media_url: '', media_nome: '', account_ids: [] as string[] });
  const [editingMacro, setEditingMacro] = useState<string | null>(null);
  const [savingMacro, setSavingMacro] = useState(false);

  // Tags
  interface TagDef { id: string; nome: string; cor: string; account_ids: string[]; }
  const [tags, setTags] = useState<TagDef[]>([]);
  const [tagForm, setTagForm] = useState({ nome: '', cor: '#8B5CF6', account_ids: [] as string[] });
  const [savingTag, setSavingTag] = useState(false);

  const TAG_COLORS = ['#8B5CF6', '#F59E0B', '#EF4444', '#10B981', '#3B82F6', '#EC4899', '#6366F1', '#14B8A6', '#F97316', '#64748B'];

  useEffect(() => {
    if (selectedAccount && tab === 'templates') {
      fetchTemplates(selectedAccount);
    }
  }, [selectedAccount, tab]);

  // Load ticket pipelines for account config
  useEffect(() => {
    (async () => {
      try {
        const org = await getOrg();
        const { data: pipes } = await (supabase as any)
          .schema('crm')
          .from('pipelines')
          .select('id, nome')
          .eq('org', org)
          .eq('tipo', 'ticket')
          .eq('ativo', true)
          .order('ordem');

        if (pipes) {
          const pipelinesWithStages: TicketPipeline[] = [];
          for (const p of pipes) {
            const { data: stages } = await (supabase as any)
              .schema('crm')
              .from('pipeline_estagios')
              .select('id, nome, ordem')
              .eq('pipeline_id', p.id)
              .order('ordem');
            pipelinesWithStages.push({ id: p.id, nome: p.nome, estagios: stages || [] });
          }
          setTicketPipelines(pipelinesWithStages);
        }
      } catch { /* silent */ }
    })();
  }, []);

  // Load access data when tab changes to 'access'
  useEffect(() => {
    if (tab === 'access') {
      loadAllUsers();
      if (accessAccountId) loadAccessForAccount(accessAccountId);
    }
  }, [tab, accessAccountId]);

  // Load all macros/tags for empresa
  const loadMacros = useCallback(async () => {
    const org = await getOrg();
    const { data } = await supabase.schema('channels').from('meta_macros').select('*').eq('org', org).order('nome');
    setMacros((data || []) as Macro[]);
  }, []);

  const loadTags = useCallback(async () => {
    const org = await getOrg();
    const { data } = await supabase.schema('channels').from('meta_tags').select('*').eq('org', org).order('nome');
    setTags((data || []) as TagDef[]);
  }, []);

  useEffect(() => {
    if (tab === 'macros') loadMacros();
    if (tab === 'tags') loadTags();
  }, [tab]);

  const saveMacro = async () => {
    if (!macroForm.nome.trim() || macroForm.account_ids.length === 0) {
      toast({ variant: 'destructive', title: 'Selecione ao menos uma caixa de entrada' });
      return;
    }
    setSavingMacro(true);
    try {
      const org = await getOrg();
      const payload = {
        empresa_id: org,
        account_ids: macroForm.account_ids,
        nome: macroForm.nome.trim().toLowerCase().replace(/\s+/g, '_'),
        tipo: macroForm.tipo, conteudo: macroForm.conteudo || null,
        media_url: macroForm.media_url || null, media_nome: macroForm.media_nome || null,
      };
      if (editingMacro) {
        await supabase.schema('channels').from('meta_macros').update(payload).eq('id', editingMacro);
      } else {
        await supabase.schema('channels').from('meta_macros').insert(payload);
      }
      setMacroForm({ nome: '', tipo: 'text', conteudo: '', media_url: '', media_nome: '', account_ids: [] });
      setEditingMacro(null);
      await loadMacros();
      toast({ title: editingMacro ? 'Macro atualizada' : 'Macro criada' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally { setSavingMacro(false); }
  };

  const deleteMacro = async (id: string) => {
    await supabase.schema('channels').from('meta_macros').delete().eq('id', id);
    await loadMacros();
    toast({ title: 'Macro removida' });
  };

  const saveTag = async () => {
    if (!tagForm.nome.trim() || tagForm.account_ids.length === 0) {
      toast({ variant: 'destructive', title: 'Selecione ao menos uma caixa de entrada' });
      return;
    }
    setSavingTag(true);
    try {
      const org = await getOrg();
      await supabase.schema('channels').from('meta_tags').insert({
        empresa_id: org,
        account_ids: tagForm.account_ids,
        nome: tagForm.nome.trim(), cor: tagForm.cor,
      });
      setTagForm({ nome: '', cor: '#8B5CF6', account_ids: [] });
      await loadTags();
      toast({ title: 'Tag criada' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro', description: e.message });
    } finally { setSavingTag(false); }
  };

  const deleteTag = async (id: string) => {
    await supabase.schema('channels').from('meta_tags').delete().eq('id', id);
    await loadTags();
    toast({ title: 'Tag removida' });
  };

  const toggleAccountInList = (list: string[], accId: string) =>
    list.includes(accId) ? list.filter(id => id !== accId) : [...list, accId];

  const AccountCheckboxes = ({ selected, onChange }: { selected: string[]; onChange: (ids: string[]) => void }) => (
    <div className="flex flex-wrap gap-1.5">
      {accounts.map(acc => (
        <button key={acc.id} onClick={() => onChange(toggleAccountInList(selected, acc.id))}
          className={cn('text-[10px] px-2 py-1 rounded-md border transition-colors',
            selected.includes(acc.id) ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary text-muted-foreground border-border hover:text-foreground'
          )}>
          {acc.nome}
        </button>
      ))}
    </div>
  );

  const loadAllUsers = async () => {
    try {
      const org = await getOrg();
      const { data } = await (supabase as any)
        .schema('core')
        .from('usuarios')
        .select('id,nome,email')
        .eq('org', org)
        .eq('status', 'ativo')
        .order('nome');
      setAllUsers(data || []);
    } catch { /* silent */ }
  };

  const loadAccessForAccount = async (accountId: string) => {
    setLoadingAccess(true);
    try {
      const { data, error } = await (supabase as any)
        .schema('channels').from('meta_user_access')
        .select('id, usuario_id')
        .eq('account_id', accountId);
      if (error) throw error;

      const rows: UserAccessRow[] = (data || []).map((r: any) => {
        const usr = allUsers.find(u => u.id === r.usuario_id) || { nome: '?', email: '?' };
        return { id: r.id, usuario_id: r.usuario_id, nome: usr.nome, email: usr.email };
      });

      // If allUsers hasn't loaded yet, resolve names from DB
      if (allUsers.length === 0 && data?.length) {
        const org = await getOrg();
        const ids = data.map((r: any) => r.usuario_id);
        const { data: usrs } = await (supabase as any)
          .schema('core')
          .from('usuarios')
          .select('id,nome,email')
          .eq('org', org)
          .in('id', ids);
        const usrMap = new Map((usrs || []).map((u: any) => [u.id, u]));
        for (const row of rows) {
          const u: any = usrMap.get(row.usuario_id);
          if (u) { row.nome = u.nome; row.email = u.email; }
        }
      }
      setAccessUsers(rows);
    } catch { /* silent */ }
    finally { setLoadingAccess(false); }
  };

  const addUserAccess = async (userId: string) => {
    if (!accessAccountId || accessUsers.some(u => u.usuario_id === userId)) return;
    setSavingAccess(true);
    try {
      const { data, error } = await (supabase as any)
        .schema('channels').from('meta_user_access')
        .insert({ usuario_id: userId, account_id: accessAccountId })
        .select('id, usuario_id')
        .single();
      if (error) throw error;
      const usr = allUsers.find(u => u.id === userId) || { nome: '?', email: '?' };
      setAccessUsers(prev => [...prev, { id: data.id, usuario_id: userId, nome: usr.nome, email: usr.email }]);
      toast({ title: `${usr.nome} adicionado(a) à caixa.` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao adicionar acesso', description: e.message });
    } finally { setSavingAccess(false); }
  };

  const removeUserAccess = async (accessId: string, userName: string) => {
    try {
      const { error } = await (supabase as any)
        .schema('channels').from('meta_user_access')
        .delete()
        .eq('id', accessId);
      if (error) throw error;
      setAccessUsers(prev => prev.filter(u => u.id !== accessId));
      toast({ title: `${userName} removido(a) da caixa.` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao remover acesso', description: e.message });
    }
  };

  /* ── Fetch templates via Meta Graph API ─────────────── */
  const fetchTemplates = useCallback(async (account: MetaInboxAccount) => {
    if (!account.waba_id || !account.access_token) {
      toast({ variant: 'destructive', title: 'Conta incompleta', description: 'Informe o WABA ID e o Access Token para buscar templates.' });
      return;
    }
    setLoadingTemplates(true);
    try {
      const url = `https://graph.facebook.com/v21.0/${account.waba_id}/message_templates?access_token=${account.access_token}&fields=id,name,status,category,language,components,rejected_reason,quality_score&limit=100`;
      const res = await fetch(url);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setTemplates(data.data || []);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao buscar templates', description: e.message });
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  /* ── Save account ───────────────────────────────────── */
  const saveAccount = async () => {
    if (!accountForm.nome.trim()) return toast({ variant: 'destructive', title: 'Informe o nome da conta.' });
    if (!accountForm.phone_number_id.trim()) return toast({ variant: 'destructive', title: 'Informe o Phone Number ID.' });
    if (!accountForm.access_token.trim()) return toast({ variant: 'destructive', title: 'Informe o Access Token.' });

    setSavingAccount(true);
    try {
      const org = await getOrg();
      const encryptedToken = await encryptToken(accountForm.access_token.trim());
      const payload: Record<string, unknown> = {
        empresa_id: org,
        nome: accountForm.nome.trim(),
        phone_number_id: accountForm.phone_number_id.trim(),
        waba_id: accountForm.waba_id.trim() || null,
        access_token: encryptedToken,
        token_type: accountForm.token_type,
        phone_display: accountForm.phone_display.trim() || null,
        status: 'active',
        ticket_enabled: accountForm.ticket_enabled,
        ticket_pipeline_id: accountForm.ticket_pipeline_id || null,
        ticket_estagio_id: accountForm.ticket_estagio_id || null,
        ticket_prioridade: accountForm.ticket_prioridade || 'medium',
      };

      let result;
      if (editingAccount) {
        const { data, error } = await (supabase as any)
          .schema('channels').from('meta_accounts')
          .update(payload)
          .eq('id', editingAccount.id)
          .select()
          .single();
        if (error) throw error;
        result = data;
      } else {
        const { data, error } = await (supabase as any)
          .schema('channels').from('meta_accounts')
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        result = data;
      }

      toast({ title: editingAccount ? 'Conta atualizada!' : 'Conta adicionada!' });
      setAccountForm(EMPTY_FORM);
      setEditingAccount(null);
      setShowAccountForm(false);
      onSaved();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao salvar conta', description: e.message });
    } finally {
      setSavingAccount(false);
    }
  };

  const deleteAccount = async (id: string) => {
    setDeletingAccountId(id);
    try {
      const { error } = await (supabase as any).schema('channels').from('meta_accounts').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Conta removida.' });
      onSaved();
      if (selectedAccount?.id === id) setSelectedAccount(null);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao remover conta', description: e.message });
    } finally {
      setDeletingAccountId(null);
    }
  };

  /* ── Create/update template via Meta Graph API ──────── */
  const saveTemplate = async () => {
    if (!selectedAccount) return toast({ variant: 'destructive', title: 'Selecione uma conta primeiro.' });
    if (!selectedAccount.waba_id || !selectedAccount.access_token) {
      return toast({ variant: 'destructive', title: 'Conta incompleta', description: 'Informe o WABA ID e Access Token na conta.' });
    }
    if (!templateForm.name.trim()) return toast({ variant: 'destructive', title: 'Informe o nome do template.' });
    if (!templateForm.body_text.trim()) return toast({ variant: 'destructive', title: 'Informe o corpo do template.' });

    setSavingTemplate(true);
    try {
      const components: any[] = [];
      if (templateForm.header_text.trim()) {
        components.push({ type: 'HEADER', format: 'TEXT', text: templateForm.header_text.trim() });
      }
      components.push({ type: 'BODY', text: templateForm.body_text.trim() });
      if (templateForm.footer_text.trim()) {
        components.push({ type: 'FOOTER', text: templateForm.footer_text.trim() });
      }

      if (templateForm.buttons.length > 0) {
        components.push({
          type: 'BUTTONS',
          buttons: templateForm.buttons.map(b => {
            const btn: Record<string, string> = { type: b.type, text: b.text };
            if (b.type === 'URL' && b.url) btn.url = b.url;
            if (b.type === 'PHONE_NUMBER' && b.phone_number) btn.phone_number = b.phone_number;
            return btn;
          }),
        });
      }

      const payload = {
        name: templateForm.name.trim().toLowerCase().replace(/\s+/g, '_'),
        category: templateForm.category,
        language: templateForm.language,
        components,
      };

      let url: string;
      let method: string;

      if (editingTemplate) {
        url = `https://graph.facebook.com/v21.0/${editingTemplate.id}`;
        method = 'POST';
      } else {
        url = `https://graph.facebook.com/v21.0/${selectedAccount.waba_id}/message_templates`;
        method = 'POST';
      }

      const res = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${selectedAccount.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || `HTTP ${res.status}`);
      }

      toast({ title: editingTemplate ? 'Template atualizado!' : 'Template criado e enviado para revisão pela Meta!' });
      setTemplateForm(EMPTY_TEMPLATE);
      setEditingTemplate(null);
      setShowTemplateForm(false);
      await fetchTemplates(selectedAccount);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao salvar template', description: e.message });
    } finally {
      setSavingTemplate(false);
    }
  };

  const deleteTemplate = async (templateId: string) => {
    if (!selectedAccount?.waba_id || !selectedAccount?.access_token) return;
    setDeletingTemplateId(templateId);
    try {
      const tmpl = templates.find(t => t.id === templateId);
      if (!tmpl?.name) throw new Error('Nome do template não encontrado.');

      // Meta Graph API: DELETE by name (required). hsm_id is optional but can cause permission errors.
      const url = `https://graph.facebook.com/v21.0/${selectedAccount.waba_id}/message_templates?name=${encodeURIComponent(tmpl.name)}`;
      const res = await fetch(url, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${selectedAccount.access_token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || `HTTP ${res.status}`);
      }
      toast({ title: 'Template excluído.' });
      setTemplates(prev => prev.filter(t => t.id !== templateId));
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao excluir template', description: e.message });
    } finally {
      setDeletingTemplateId(null);
    }
  };

  const [recreatingId, setRecreatingId] = useState<string | null>(null);

  const recreateTemplate = async (tmpl: MetaTemplate) => {
    if (!selectedAccount?.waba_id || !selectedAccount?.access_token) return;
    setRecreatingId(tmpl.id);
    try {
      const org = await (await import('@/lib/saas')).getOrg();

      // Find current version from DB
      const { data: existing } = await (supabase as any)
        .schema('channels').from('meta_templates')
        .select('version, display_name')
        .eq('account_id', selectedAccount.id)
        .eq('name', tmpl.name)
        .maybeSingle();

      const baseName = tmpl.name.replace(/_[a-z0-9]{6}$/, '').replace(/_v\d+(_\d+)?$/, '');
      const displayName = existing?.display_name || baseName;
      const nextVersion = (existing?.version || 1) + 1;
      // Random 6-char suffix (a-z0-9) — never collides, avoids Meta's 4-week quarantine
      const rnd = Array.from({ length: 6 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('');
      const newMetaName = `${baseName}_${rnd}`;

      // Build components — normalize to what Meta accepts on creation
      const components: any[] = [];
      for (const c of tmpl.components) {
        if (c.type === 'HEADER') {
          if (c.format === 'TEXT' && c.text) {
            components.push({ type: 'HEADER', format: 'TEXT', text: c.text });
          }
        } else if (c.type === 'BODY') {
          if (c.text) {
            const body: any = { type: 'BODY', text: c.text };
            if (c.example) body.example = c.example;
            components.push(body);
          }
        } else if (c.type === 'FOOTER') {
          if (c.text) components.push({ type: 'FOOTER', text: c.text });
        } else if (c.type === 'BUTTONS' && c.buttons?.length) {
          const cleanButtons = c.buttons.map((btn: any) => {
            if (btn.type === 'QUICK_REPLY') return { type: 'QUICK_REPLY', text: btn.text };
            if (btn.type === 'URL') return { type: 'URL', text: btn.text, url: btn.url, ...(btn.example ? { example: btn.example } : {}) };
            if (btn.type === 'PHONE_NUMBER') return { type: 'PHONE_NUMBER', text: btn.text, phone_number: btn.phone_number };
            return { type: btn.type, text: btn.text };
          });
          components.push({ type: 'BUTTONS', buttons: cleanButtons });
        }
      }
      if (!components.some(c => c.type === 'BODY')) {
        throw new Error('Template sem corpo (BODY) — não é possível recriar.');
      }

      // Single call — random suffix guarantees unique name, no quarantine issues
      const payload = { name: newMetaName, category: tmpl.category, language: tmpl.language, components };
      const res = await fetch(`https://graph.facebook.com/v21.0/${selectedAccount.waba_id}/message_templates`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${selectedAccount.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const detail = err?.error?.error_user_msg || err?.error?.message || `HTTP ${res.status}`;
        throw new Error(detail);
      }

      const data = await res.json();
      const newTemplateId = data.id;

      // Mark old version as inactive in local DB
      await (supabase as any)
        .schema('channels').from('meta_templates')
        .update({ is_active: false })
        .eq('account_id', selectedAccount.id)
        .eq('name', tmpl.name);

      // Save new version in local DB
      await (supabase as any)
        .schema('channels').from('meta_templates')
        .upsert({
          account_id: selectedAccount.id,
          empresa_id: org,
          meta_template_id: newTemplateId,
          name: newMetaName,
          display_name: displayName,
          version: nextVersion,
          is_active: true,
          status: 'PENDING',
          category: tmpl.category,
          language: tmpl.language,
          components: JSON.stringify(components),
          synced_at: new Date().toISOString(),
        }, { onConflict: 'account_id,meta_template_id' });

      toast({ title: 'Template recriado!', description: `${displayName} v${nextVersion} (${newMetaName}) enviado para aprovação.` });
      await fetchTemplates(selectedAccount);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao recriar template', description: e.message });
    } finally {
      setRecreatingId(null);
    }
  };

  const startEditTemplate = (t: MetaTemplate) => {
    const body = t.components.find(c => c.type === 'BODY')?.text || '';
    const header = t.components.find(c => c.type === 'HEADER')?.text || '';
    const footer = t.components.find(c => c.type === 'FOOTER')?.text || '';
    const btnsComp = t.components.find(c => c.type === 'BUTTONS');
    const buttons: TemplateButton[] = (btnsComp?.buttons || []).map(b => ({
      type: b.type as TemplateButtonType,
      text: b.text,
      url: b.url || '',
      phone_number: b.phone_number || '',
    }));
    setTemplateForm({
      name: t.name,
      category: t.category,
      language: t.language,
      header_text: header,
      body_text: body,
      footer_text: footer,
      buttons,
    });
    setEditingTemplate(t);
    setShowTemplateForm(true);
  };

  const copyToken = () => {
    if (selectedAccount?.webhook_verify_token) {
      navigator.clipboard.writeText(selectedAccount.webhook_verify_token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-3xl max-h-[88vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border flex-shrink-0">
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            <Settings className="w-4 h-4 text-primary" />
            Configurações — Caixa de Entrada (Meta WABA)
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-5 mt-3 flex-shrink-0 w-fit">
            {!isRestrictedRole && (
              <TabsTrigger value="accounts" className="text-xs gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" /> Contas
              </TabsTrigger>
            )}
            <TabsTrigger value="templates" className="text-xs gap-1.5">
              <LayoutTemplate className="w-3.5 h-3.5" /> Templates
            </TabsTrigger>
            <TabsTrigger value="macros" className="text-xs gap-1.5">
              <Zap className="w-3.5 h-3.5" /> Macros
            </TabsTrigger>
            <TabsTrigger value="tags" className="text-xs gap-1.5">
              <Tag className="w-3.5 h-3.5" /> Tags
            </TabsTrigger>
            {!isRestrictedRole && (
              <>
                <TabsTrigger value="access" className="text-xs gap-1.5">
                  <Users className="w-3.5 h-3.5" /> Acesso
                </TabsTrigger>
                <TabsTrigger value="webhook" className="text-xs gap-1.5">
                  <Globe className="w-3.5 h-3.5" /> Webhook
                </TabsTrigger>
              </>
            )}
          </TabsList>

          {/* ── Tab: Accounts ─────────────────────────────── */}
          <TabsContent value="accounts" className="flex-1 overflow-y-auto px-5 pb-5 mt-0 pt-4">
            <div className="space-y-4">
              {accounts.map(acc => (
                <div key={acc.id} className="border border-border rounded-xl p-4 bg-background space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                        <MessageSquare className="w-4 h-4 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{acc.nome}</p>
                        <p className="text-xs text-muted-foreground">{acc.phone_display || acc.phone_number_id}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {(acc as any).ticket_enabled && (
                        <Badge variant="outline" className="text-[10px] h-5 bg-orange-500/10 text-orange-500 border-orange-500/20 gap-0.5">
                          <Ticket className="w-2.5 h-2.5" /> Tickets
                        </Badge>
                      )}
                      <Badge variant="outline" className={cn(
                        'text-[10px] h-5',
                        acc.status === 'active' ? 'bg-green-500/10 text-green-600 border-green-500/20' : 'text-muted-foreground'
                      )}>
                        {acc.status === 'active' ? 'Ativo' : 'Pendente'}
                      </Badge>
                      <Button
                        variant="ghost" size="icon" className="w-7 h-7"
                        onClick={() => {
                          setEditingAccount(acc);
                          setAccountForm({
                            nome: acc.nome, phone_number_id: acc.phone_number_id,
                            waba_id: acc.waba_id || '', access_token: acc.access_token,
                            token_type: acc.token_type as 'permanent' | 'oauth',
                            phone_display: acc.phone_display || '',
                            ticket_enabled: (acc as any).ticket_enabled || false,
                            ticket_pipeline_id: (acc as any).ticket_pipeline_id || '',
                            ticket_estagio_id: (acc as any).ticket_estagio_id || '',
                            ticket_prioridade: (acc as any).ticket_prioridade || 'medium',
                          });
                          setShowAccountForm(true);
                        }}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="w-7 h-7 text-destructive hover:text-destructive"
                        onClick={() => deleteAccount(acc.id)}
                        disabled={deletingAccountId === acc.id}
                      >
                        {deletingAccountId === acc.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <span>Phone ID: <code className="text-foreground font-mono text-[11px]">{acc.phone_number_id}</code></span>
                    {acc.waba_id && <span>WABA: <code className="text-foreground font-mono text-[11px]">{acc.waba_id}</code></span>}
                    <span>Tipo: <span className="text-foreground capitalize">{acc.token_type === 'permanent' ? 'Token permanente' : 'OAuth Facebook'}</span></span>
                  </div>
                </div>
              ))}

              {/* Account form */}
              {showAccountForm ? (
                <div className="border border-primary/30 rounded-xl p-4 bg-primary/5 space-y-3">
                  <p className="text-sm font-semibold text-primary">{editingAccount ? 'Editar conta' : 'Nova conta Meta WABA'}</p>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium block mb-1">Nome da conta *</label>
                      <Input value={accountForm.nome} onChange={e => setAccountForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Vendas Principal" className="h-8 text-xs bg-background border-border" />
                    </div>
                    <div>
                      <label className="text-xs font-medium block mb-1">Número exibido</label>
                      <Input value={accountForm.phone_display} onChange={e => setAccountForm(f => ({ ...f, phone_display: e.target.value }))} placeholder="+55 11 99999-0000" className="h-8 text-xs bg-background border-border" />
                    </div>
                    <div>
                      <label className="text-xs font-medium block mb-1">Phone Number ID *</label>
                      <Input value={accountForm.phone_number_id} onChange={e => setAccountForm(f => ({ ...f, phone_number_id: e.target.value }))} placeholder="123456789012345" className="h-8 text-xs bg-background border-border font-mono" />
                      <p className="text-[10px] text-muted-foreground mt-0.5">Meta Business Suite → WhatsApp → Configurações</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium block mb-1">WABA ID</label>
                      <Input value={accountForm.waba_id} onChange={e => setAccountForm(f => ({ ...f, waba_id: e.target.value }))} placeholder="ID da conta WhatsApp Business" className="h-8 text-xs bg-background border-border font-mono" />
                      <p className="text-[10px] text-muted-foreground mt-0.5">Necessário para gerenciar templates</p>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium block mb-1">Tipo de token</label>
                    <div className="flex gap-2">
                      {(['permanent', 'oauth'] as const).map(type => (
                        <button
                          key={type}
                          onClick={() => setAccountForm(f => ({ ...f, token_type: type }))}
                          className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors',
                            accountForm.token_type === type
                              ? 'border-primary bg-primary/10 text-primary font-medium'
                              : 'border-border bg-background text-muted-foreground hover:text-foreground'
                          )}
                        >
                          {type === 'permanent' ? <Key className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
                          {type === 'permanent' ? 'Token Permanente' : 'OAuth Facebook'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium block mb-1">Access Token *</label>
                    <Input
                      value={accountForm.access_token}
                      onChange={e => setAccountForm(f => ({ ...f, access_token: e.target.value }))}
                      placeholder={accountForm.token_type === 'permanent' ? 'EAA...' : 'Token gerado via Facebook Login'}
                      className="h-8 text-xs bg-background border-border font-mono"
                      type="password"
                    />
                    <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                      <ExternalLink className="w-2.5 h-2.5" />
                      <a href="https://developers.facebook.com/apps/" target="_blank" rel="noreferrer" className="hover:text-primary">
                        Meta for Developers → Suas apps → Token de acesso
                      </a>
                    </p>
                  </div>

                  {/* ── Ticket Configuration ─────────────── */}
                  <div className="border-t border-border/50 pt-3 mt-1">
                    <label className="flex items-center justify-between cursor-pointer mb-3" onClick={() => setAccountForm(f => ({ ...f, ticket_enabled: !f.ticket_enabled }))}>
                      <div className="flex items-center gap-2">
                        <Ticket className="w-4 h-4 text-orange-500" />
                        <div>
                          <p className="text-xs font-semibold">Gerar Tickets</p>
                          <p className="text-[10px] text-muted-foreground">Conversas desta conta podem abrir tickets no CRM</p>
                        </div>
                      </div>
                      <div className={cn(
                        'w-10 h-5 rounded-full relative transition-colors flex-shrink-0',
                        accountForm.ticket_enabled ? 'bg-orange-500' : 'bg-muted'
                      )}>
                        <div className={cn(
                          'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
                          accountForm.ticket_enabled ? 'translate-x-5' : 'translate-x-0.5'
                        )} />
                      </div>
                    </label>

                    {accountForm.ticket_enabled && (
                      <div className="space-y-3 pl-6 border-l-2 border-orange-500/20 animate-fade-in">
                        <div>
                          <label className="text-xs font-medium block mb-1">Pipeline de tickets *</label>
                          <select
                            value={accountForm.ticket_pipeline_id}
                            onChange={e => setAccountForm(f => ({ ...f, ticket_pipeline_id: e.target.value, ticket_estagio_id: '' }))}
                            className="w-full h-8 text-xs bg-background border border-border rounded-md px-2"
                          >
                            <option value="">Selecione o pipeline</option>
                            {ticketPipelines.map(p => (
                              <option key={p.id} value={p.id}>{p.nome}</option>
                            ))}
                          </select>
                          {ticketPipelines.length === 0 && (
                            <p className="text-[10px] text-warning mt-0.5">Nenhum pipeline de ticket encontrado. Crie um em CRM → Tickets.</p>
                          )}
                        </div>

                        {accountForm.ticket_pipeline_id && (
                          <div>
                            <label className="text-xs font-medium block mb-1">Estágio inicial *</label>
                            <select
                              value={accountForm.ticket_estagio_id}
                              onChange={e => setAccountForm(f => ({ ...f, ticket_estagio_id: e.target.value }))}
                              className="w-full h-8 text-xs bg-background border border-border rounded-md px-2"
                            >
                              <option value="">Selecione o estágio</option>
                              {(ticketPipelines.find(p => p.id === accountForm.ticket_pipeline_id)?.estagios || []).map(e => (
                                <option key={e.id} value={e.id}>{e.nome}</option>
                              ))}
                            </select>
                          </div>
                        )}

                        <div>
                          <label className="text-xs font-medium block mb-1">Prioridade padrão</label>
                          <select
                            value={accountForm.ticket_prioridade}
                            onChange={e => setAccountForm(f => ({ ...f, ticket_prioridade: e.target.value }))}
                            className="w-full h-8 text-xs bg-background border border-border rounded-md px-2"
                          >
                            <option value="low">Baixa</option>
                            <option value="medium">Média</option>
                            <option value="high">Alta</option>
                            <option value="urgent">Urgente</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-xs font-medium block mb-1">Status do ticket</label>
                          <div className="flex gap-2">
                            <span className="text-[10px] px-2 py-1 rounded-full bg-green-500/10 text-green-500 border border-green-500/20">Aberto</span>
                            <span className="text-[10px] px-2 py-1 rounded-full bg-muted text-muted-foreground border border-border">Fechado</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1">Tickets criados como "Aberto". Operador fecha manualmente.</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button size="sm" className="text-xs h-8 gap-1.5" onClick={saveAccount} disabled={savingAccount}>
                      {savingAccount ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      {editingAccount ? 'Salvar alterações' : 'Adicionar conta'}
                    </Button>
                    <Button size="sm" variant="outline" className="text-xs h-8 border-border" onClick={() => { setShowAccountForm(false); setEditingAccount(null); setAccountForm(EMPTY_FORM); }}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="outline" size="sm" className="text-xs h-9 gap-1.5 border-dashed w-full" onClick={() => { setEditingAccount(null); setAccountForm(EMPTY_FORM); setShowAccountForm(true); }}>
                  <Plus className="w-3.5 h-3.5" /> Adicionar nova conta
                </Button>
              )}
            </div>
          </TabsContent>

          {/* ── Tab: Templates ────────────────────────────── */}
          <TabsContent value="templates" className="flex-1 overflow-hidden flex flex-col mt-0">
            <div className="px-5 pt-4 pb-3 flex items-center gap-2 flex-shrink-0 border-b border-border">
              {/* Account selector */}
              <div className="flex-1 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Conta:</span>
                <select
                  value={selectedAccount?.id || ''}
                  onChange={e => {
                    const acc = accounts.find(a => a.id === e.target.value) || null;
                    setSelectedAccount(acc);
                    if (acc) fetchTemplates(acc);
                  }}
                  className="h-7 text-xs rounded-md border border-border bg-background px-2 flex-1"
                >
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.nome}</option>
                  ))}
                </select>
                <Button variant="outline" size="icon" className="w-7 h-7" onClick={() => selectedAccount && fetchTemplates(selectedAccount)} disabled={loadingTemplates}>
                  {loadingTemplates ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                </Button>
              </div>
              <Button size="sm" className="text-xs h-7 gap-1" onClick={() => { setEditingTemplate(null); setTemplateForm(EMPTY_TEMPLATE); setShowTemplateForm(true); }}>
                <Plus className="w-3 h-3" /> Novo template
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-5">
              {/* Template form */}
              {showTemplateForm && (
                <div className="mt-4 border border-primary/30 rounded-xl p-4 bg-primary/5 space-y-3">
                  <p className="text-sm font-semibold text-primary">{editingTemplate ? 'Editar template' : 'Novo template'}</p>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-3 sm:col-span-1">
                      <label className="text-xs font-medium block mb-1">Nome (sem espaços) *</label>
                      <Input
                        value={templateForm.name}
                        onChange={e => setTemplateForm(f => ({ ...f, name: e.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') }))}
                        placeholder="ex: confirmacao_pedido"
                        className="h-8 text-xs bg-background border-border font-mono"
                        disabled={!!editingTemplate}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium block mb-1">Categoria *</label>
                      <select value={templateForm.category} onChange={e => setTemplateForm(f => ({ ...f, category: e.target.value as TemplateCategory }))} className="h-8 w-full text-xs rounded-md border border-border bg-background px-2">
                        <option value="UTILITY">Utilidade</option>
                        <option value="MARKETING">Marketing</option>
                        <option value="AUTHENTICATION">Autenticação</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium block mb-1">Idioma *</label>
                      <select value={templateForm.language} onChange={e => setTemplateForm(f => ({ ...f, language: e.target.value }))} className="h-8 w-full text-xs rounded-md border border-border bg-background px-2">
                        <option value="pt_BR">Português (BR)</option>
                        <option value="en_US">English (US)</option>
                        <option value="es">Español</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium block mb-1">Cabeçalho (opcional)</label>
                    <Input value={templateForm.header_text} onChange={e => setTemplateForm(f => ({ ...f, header_text: e.target.value }))} placeholder="Título do template" className="h-8 text-xs bg-background border-border" />
                  </div>

                  <div>
                    <label className="text-xs font-medium block mb-1">Corpo *</label>
                    <Textarea
                      value={templateForm.body_text}
                      onChange={e => setTemplateForm(f => ({ ...f, body_text: e.target.value }))}
                      placeholder="Olá {{1}}, seu pedido {{2}} foi confirmado!"
                      className="text-xs bg-background border-border min-h-[80px] resize-none"
                    />
                    <p className="text-[10px] text-muted-foreground mt-0.5">Use {'{{1}}'}, {'{{2}}'}... para variáveis dinâmicas</p>
                  </div>

                  <div>
                    <label className="text-xs font-medium block mb-1">Rodapé (opcional)</label>
                    <Input value={templateForm.footer_text} onChange={e => setTemplateForm(f => ({ ...f, footer_text: e.target.value }))} placeholder="Não responda a esta mensagem" className="h-8 text-xs bg-background border-border" />
                  </div>

                  {/* Buttons section */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium">Botões (opcional)</label>
                      {templateForm.buttons.length < 10 && (
                        <select
                          className="h-7 text-[10px] rounded-md border border-border bg-background px-1.5 cursor-pointer"
                          value=""
                          onChange={e => {
                            const btnType = e.target.value as TemplateButtonType;
                            if (!btnType) return;
                            setTemplateForm(f => ({
                              ...f,
                              buttons: [...f.buttons, { type: btnType, text: '', url: '', phone_number: '' }],
                            }));
                            e.target.value = '';
                          }}
                        >
                          <option value="">+ Adicionar botão</option>
                          <option value="QUICK_REPLY">Resposta rápida</option>
                          <option value="URL">Link (URL)</option>
                          <option value="PHONE_NUMBER">Telefone</option>
                        </select>
                      )}
                    </div>
                    {templateForm.buttons.length > 0 && (
                      <div className="space-y-2">
                        {templateForm.buttons.map((btn, idx) => (
                          <div key={idx} className="flex items-start gap-2 p-2 rounded-lg border border-border bg-background">
                            <div className="flex-1 space-y-1.5">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-[9px] h-4 px-1 shrink-0">
                                  {btn.type === 'QUICK_REPLY' ? 'Resposta rápida' : btn.type === 'URL' ? 'Link' : 'Telefone'}
                                </Badge>
                                <Input
                                  value={btn.text}
                                  onChange={e => {
                                    const updated = [...templateForm.buttons];
                                    updated[idx] = { ...updated[idx], text: e.target.value };
                                    setTemplateForm(f => ({ ...f, buttons: updated }));
                                  }}
                                  placeholder="Texto do botão"
                                  maxLength={25}
                                  className="h-7 text-xs bg-background border-border"
                                />
                                <span className="text-[9px] text-muted-foreground shrink-0">{btn.text.length}/25</span>
                              </div>
                              {btn.type === 'URL' && (
                                <Input
                                  value={btn.url || ''}
                                  onChange={e => {
                                    const updated = [...templateForm.buttons];
                                    updated[idx] = { ...updated[idx], url: e.target.value };
                                    setTemplateForm(f => ({ ...f, buttons: updated }));
                                  }}
                                  placeholder="https://exemplo.com/{{1}}"
                                  className="h-7 text-xs bg-background border-border"
                                />
                              )}
                              {btn.type === 'PHONE_NUMBER' && (
                                <Input
                                  value={btn.phone_number || ''}
                                  onChange={e => {
                                    const updated = [...templateForm.buttons];
                                    updated[idx] = { ...updated[idx], phone_number: e.target.value };
                                    setTemplateForm(f => ({ ...f, buttons: updated }));
                                  }}
                                  placeholder="+5511999999999"
                                  className="h-7 text-xs bg-background border-border"
                                />
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                              onClick={() => setTemplateForm(f => ({ ...f, buttons: f.buttons.filter((_, i) => i !== idx) }))}
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                    {templateForm.buttons.length > 3 && (
                      <p className="text-[10px] text-muted-foreground mt-1">Mais de 3 botões serão exibidos em lista no WhatsApp</p>
                    )}
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button size="sm" className="text-xs h-8 gap-1.5" onClick={saveTemplate} disabled={savingTemplate}>
                      {savingTemplate ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      {editingTemplate ? 'Salvar alterações' : 'Criar e enviar para Meta'}
                    </Button>
                    <Button size="sm" variant="outline" className="text-xs h-8 border-border" onClick={() => { setShowTemplateForm(false); setEditingTemplate(null); }}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}

              {/* Templates list */}
              {loadingTemplates ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : templates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
                  <LayoutTemplate className="w-10 h-10 opacity-20" />
                  <p className="text-sm">Nenhum template encontrado</p>
                  <p className="text-xs">Certifique-se de ter informado o WABA ID e Access Token corretos.</p>
                </div>
              ) : (
                <div className="space-y-2 mt-4">
                  {templates.map(t => (
                    <div key={t.id} className="border border-border rounded-xl bg-background overflow-hidden">
                      <div
                        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                        onClick={() => setExpandedTemplate(expandedTemplate === t.id ? null : t.id)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <code className="text-xs font-mono font-semibold">{t.name}</code>
                            <StatusBadge status={t.status} />
                            <CatBadge cat={t.category} />
                            <QualityBadge quality={t.quality_score} />
                            <span className="text-[10px] text-muted-foreground">{t.language}</span>
                          </div>
                          {t.rejected_reason && t.rejected_reason !== 'NONE' && (
                            <p className="text-[10px] text-red-500 mt-0.5 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> {t.rejected_reason}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost" size="icon" className="w-7 h-7 text-primary hover:text-primary"
                            title="Recriar template (nova versão)"
                            onClick={e => { e.stopPropagation(); recreateTemplate(t); }}
                            disabled={recreatingId === t.id}
                          >
                            {recreatingId === t.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="w-7 h-7"
                            onClick={e => { e.stopPropagation(); startEditTemplate(t); }}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="w-7 h-7 text-destructive hover:text-destructive"
                            onClick={e => { e.stopPropagation(); deleteTemplate(t.id); }}
                            disabled={deletingTemplateId === t.id}
                          >
                            {deletingTemplateId === t.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </Button>
                          {expandedTemplate === t.id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                        </div>
                      </div>

                      {expandedTemplate === t.id && (
                        <div className="px-4 pb-4 border-t border-border space-y-2 pt-3">
                          {t.components.map((comp, ci) => (
                            <div key={ci} className="space-y-0.5">
                              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{comp.type}</p>
                              {comp.text && <p className="text-xs bg-muted/50 rounded-lg p-2 whitespace-pre-wrap">{comp.text}</p>}
                              {comp.buttons && comp.buttons.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                  {comp.buttons.map((btn, bi) => (
                                    <span key={bi} className="text-[10px] border border-border rounded px-2 py-0.5 bg-background">{btn.text}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* ── Tab: Access ───────────────────────────────── */}
          <TabsContent value="access" className="flex-1 overflow-y-auto px-5 pb-5 mt-0 pt-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Caixa:</span>
                <select
                  value={accessAccountId}
                  onChange={e => setAccessAccountId(e.target.value)}
                  className="h-7 text-xs rounded-md border border-border bg-background px-2 flex-1"
                >
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.nome} {a.phone_display ? `(${a.phone_display})` : ''}</option>
                  ))}
                </select>
              </div>

              <p className="text-xs text-muted-foreground">
                Usuários com cargo <strong>Suporte</strong> ou <strong>Analista</strong> só veem as caixas que estiverem atribuídas aqui. Cargos superiores veem todas as caixas automaticamente.
              </p>

              {/* Current users with access */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Usuários com acesso {loadingAccess && <Loader2 className="w-3 h-3 inline animate-spin ml-1" />}
                </p>
                {accessUsers.length === 0 && !loadingAccess && (
                  <p className="text-xs text-muted-foreground py-3 text-center border border-dashed border-border rounded-lg">
                    Nenhum usuário atribuído — somente cargos superiores podem ver esta caixa.
                  </p>
                )}
                {accessUsers.map(u => (
                  <div key={u.id} className="flex items-center justify-between border border-border rounded-lg px-3 py-2 bg-background">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary">
                        {(u.nome || '?')[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{u.nome}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost" size="icon" className="w-7 h-7 text-destructive hover:text-destructive flex-shrink-0"
                      onClick={() => removeUserAccess(u.id, u.nome)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Add user */}
              <div className="space-y-2 pb-60">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Adicionar usuário</p>
                <SearchableSelect
                  value=""
                  onChange={v => { if (v) addUserAccess(v); }}
                  placeholder="Selecione um usuário..."
                  options={allUsers
                    .filter(u => !accessUsers.some(a => a.usuario_id === u.id))
                    .map(u => ({ value: u.id, label: u.nome, sub: u.email }))
                  }
                />
              </div>
            </div>
          </TabsContent>

          {/* ── Tab: Webhook ──────────────────────────────── */}
          <TabsContent value="webhook" className="flex-1 overflow-y-auto px-5 py-4 mt-0">
            <div className="space-y-5">
              <div className="border border-border rounded-xl p-4 bg-background space-y-3">
                <p className="text-sm font-semibold">Configuração do Webhook</p>
                <p className="text-xs text-muted-foreground">
                  Configure estas informações no painel do Meta for Developers para receber mensagens em tempo real.
                </p>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium block mb-1">URL do Webhook</label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs bg-muted rounded-md px-3 py-2 font-mono truncate">
                        {`${import.meta.env.VITE_SUPABASE_URL || 'https://lwusznsduxcqjjmbbobt.supabase.co'}/functions/v1/meta-webhook`}
                      </code>
                      <Button variant="outline" size="sm" className="text-xs h-8 gap-1.5" onClick={() => {
                        const url = `${import.meta.env.VITE_SUPABASE_URL || 'https://lwusznsduxcqjjmbbobt.supabase.co'}/functions/v1/meta-webhook`;
                        navigator.clipboard.writeText(url);
                        toast({ title: 'URL copiada!' });
                      }}>
                        <Copy className="w-3 h-3" /> Copiar
                      </Button>
                    </div>
                  </div>

                  {selectedAccount?.webhook_verify_token && (
                    <div>
                      <label className="text-xs font-medium block mb-1">Token de Verificação</label>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-xs bg-muted rounded-md px-3 py-2 font-mono truncate">
                          {selectedAccount.webhook_verify_token}
                        </code>
                        <Button variant="outline" size="sm" className="text-xs h-8 gap-1.5" onClick={copyToken}>
                          {copied ? <CheckCheck className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                          {copied ? 'Copiado!' : 'Copiar'}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-muted/50 rounded-lg p-3 space-y-1.5">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Campos a assinar no webhook:</p>
                  {['messages', 'message_deliveries', 'message_reads', 'message_echoes'].map(field => (
                    <div key={field} className="flex items-center gap-1.5">
                      <Check className="w-3 h-3 text-green-500 flex-shrink-0" />
                      <code className="text-[11px]">{field}</code>
                    </div>
                  ))}
                </div>

                <a
                  href="https://developers.facebook.com/docs/whatsapp/cloud-api/guides/set-up-webhooks"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                >
                  <ExternalLink className="w-3 h-3" />
                  Documentação: Como configurar webhooks na Meta
                </a>
              </div>
            </div>
          </TabsContent>
          {/* ── Tab: Macros ──────────────────────────────── */}
          <TabsContent value="macros" className="flex-1 overflow-y-auto px-5 pb-5 mt-0 pt-4">
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Macros são atalhos rápidos acionados por <code className="bg-muted px-1 rounded">/nome</code> no campo de mensagem.
                  Macros só aparecem dentro da janela de 24h. Selecione em quais caixas de entrada cada macro estará disponível.
                </p>

                {/* Macro form */}
                <div className="border border-border rounded-lg p-3 space-y-3 bg-muted/30">
                  <p className="text-xs font-semibold">{editingMacro ? 'Editar macro' : 'Nova macro'}</p>
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Caixas de entrada</label>
                    <AccountCheckboxes selected={macroForm.account_ids} onChange={ids => setMacroForm(f => ({ ...f, account_ids: ids }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Nome (atalho)</label>
                      <Input value={macroForm.nome} onChange={e => setMacroForm(f => ({ ...f, nome: e.target.value }))}
                        placeholder="boas_vindas" className="h-8 text-xs" />
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Tipo</label>
                      <select value={macroForm.tipo} onChange={e => setMacroForm(f => ({ ...f, tipo: e.target.value }))}
                        className="w-full h-8 text-xs bg-background border border-border rounded-md px-2">
                        <option value="text">Texto</option>
                        <option value="image">Imagem</option>
                        <option value="audio">Áudio</option>
                        <option value="document">Documento</option>
                      </select>
                    </div>
                  </div>
                  {macroForm.tipo === 'text' ? (
                    <Textarea value={macroForm.conteudo} onChange={e => setMacroForm(f => ({ ...f, conteudo: e.target.value }))}
                      placeholder="Texto da mensagem..." className="min-h-[60px] text-xs resize-y" />
                  ) : (
                    <div className="space-y-2">
                      <Input value={macroForm.media_url} onChange={e => setMacroForm(f => ({ ...f, media_url: e.target.value }))}
                        placeholder="URL da mídia (link público)" className="h-8 text-xs" />
                      <p className="text-[10px] text-muted-foreground">
                        {macroForm.tipo === 'image' && 'Formatos: JPG, PNG, WEBP (máx 5MB). Aparece como imagem no WhatsApp.'}
                        {macroForm.tipo === 'audio' && 'Formato: OGG Opus (máx 16MB). Aparece como mensagem de voz com play.'}
                        {macroForm.tipo === 'document' && 'Formatos: PDF, DOC, XLS, etc (máx 100MB). Aparece como documento para download.'}
                      </p>
                      {macroForm.tipo !== 'audio' && (
                        <Input value={macroForm.conteudo} onChange={e => setMacroForm(f => ({ ...f, conteudo: e.target.value }))}
                          placeholder="Legenda (opcional)" className="h-8 text-xs" />
                      )}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" className="text-xs h-7 gap-1" onClick={saveMacro} disabled={savingMacro || !macroForm.nome.trim() || macroForm.account_ids.length === 0}>
                      {savingMacro ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                      {editingMacro ? 'Atualizar' : 'Salvar'}
                    </Button>
                    {editingMacro && (
                      <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => {
                        setEditingMacro(null);
                        setMacroForm({ nome: '', tipo: 'text', conteudo: '', media_url: '', media_nome: '', account_ids: [] });
                      }}>Cancelar</Button>
                    )}
                  </div>
                </div>

                {/* Macros list */}
                {macros.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Nenhuma macro cadastrada.</p>
                ) : (
                  <div className="space-y-2">
                    {macros.map(m => {
                      const typeIcon = m.tipo === 'image' ? ImageIcon : m.tipo === 'audio' ? Mic : m.tipo === 'document' ? FileText : MessageSquare;
                      const Icon = typeIcon;
                      return (
                        <div key={m.id} className="flex items-center gap-3 border border-border rounded-lg px-3 py-2 bg-background">
                          <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold">/{m.nome}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{m.conteudo || m.media_url || '(sem conteúdo)'}</p>
                            <p className="text-[9px] text-muted-foreground/50 truncate">
                              {(m.account_ids || []).map(aid => accounts.find(a => a.id === aid)?.nome).filter(Boolean).join(', ') || '(sem caixa)'}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-[9px] h-4 px-1">{m.tipo}</Badge>
                          <button onClick={() => {
                            setEditingMacro(m.id);
                            setMacroForm({ nome: m.nome, tipo: m.tipo, conteudo: m.conteudo || '', media_url: m.media_url || '', media_nome: m.media_nome || '', account_ids: m.account_ids || [] });
                          }} className="text-muted-foreground hover:text-foreground"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => deleteMacro(m.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
          </TabsContent>

          {/* ── Tab: Tags ────────────────────────────────── */}
          <TabsContent value="tags" className="flex-1 overflow-y-auto px-5 pb-5 mt-0 pt-4">
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Tags para categorizar conversas. Uma conversa pode ter múltiplas tags. Selecione em quais caixas de entrada cada tag estará disponível.
                </p>

                {/* Tag form */}
                <div className="border border-border rounded-lg p-3 space-y-3 bg-muted/30">
                  <p className="text-xs font-semibold">Nova tag</p>
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Caixas de entrada</label>
                    <AccountCheckboxes selected={tagForm.account_ids} onChange={ids => setTagForm(f => ({ ...f, account_ids: ids }))} />
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Nome</label>
                      <Input value={tagForm.nome} onChange={e => setTagForm(f => ({ ...f, nome: e.target.value }))}
                        placeholder="Ex: b2c_acordo" className="h-8 text-xs" />
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Cor</label>
                      <div className="flex gap-1">
                        {TAG_COLORS.map(c => (
                          <button key={c} onClick={() => setTagForm(f => ({ ...f, cor: c }))}
                            className={cn('w-5 h-5 rounded-full border-2 transition-transform', tagForm.cor === c ? 'border-foreground scale-125' : 'border-transparent')}
                            style={{ background: c }} />
                        ))}
                      </div>
                    </div>
                    <Button size="sm" className="text-xs h-8 gap-1" onClick={saveTag} disabled={savingTag || !tagForm.nome.trim() || tagForm.account_ids.length === 0}>
                      {savingTag ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                      Criar
                    </Button>
                  </div>
                </div>

                {/* Tags list */}
                {tags.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Nenhuma tag cadastrada.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {tags.map(t => (
                      <div key={t.id} className="flex items-center gap-1.5 border border-border rounded-full px-3 py-1.5 bg-background">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: t.cor }} />
                        <span className="text-xs font-medium">{t.nome}</span>
                        <span className="text-[9px] text-muted-foreground/50">
                          {(t.account_ids || []).map(aid => accounts.find(a => a.id === aid)?.nome?.slice(0, 8)).filter(Boolean).join(', ')}
                        </span>
                        <button onClick={() => deleteTag(t.id)} className="text-muted-foreground hover:text-destructive ml-1"><X className="w-3 h-3" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
          </TabsContent>
        </Tabs>

        <div className="px-5 py-3 border-t border-border flex justify-end flex-shrink-0">
          <Button variant="outline" size="sm" className="text-xs h-8 border-border" onClick={onClose}>
            <X className="w-3.5 h-3.5 mr-1.5" /> Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
