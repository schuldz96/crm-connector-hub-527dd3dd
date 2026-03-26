import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Inbox, Search, MessageSquare, Settings, Send, CheckCheck, Plus,
  Loader2, RefreshCw, ChevronRight, Phone, Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getSaasEmpresaId } from '@/lib/saas';
import InboxSettingsModal from '@/components/inbox/InboxSettingsModal';

/* ── Types ─────────────────────────────────────────────── */
export interface MetaInboxAccount {
  id: string;
  empresa_id: string;
  nome: string;
  phone_number_id: string;
  waba_id: string | null;
  access_token: string;
  token_type: string;
  phone_display: string | null;
  status: string;
  webhook_verify_token: string | null;
  created_at: string;
  updated_at: string;
}

interface MetaConversation {
  id: string;
  contact_name: string;
  contact_phone: string;
  last_message: string;
  last_message_ts: number;
  unread: number;
  account_id: string;
}

interface MetaMessage {
  id: string;
  from_me: boolean;
  body: string;
  timestamp: number;
  type: string;
  status?: string;
}

/* ── Avatar ────────────────────────────────────────────── */
const AvatarInitials = ({ name }: { name: string }) => (
  <div className="w-10 h-10 rounded-full bg-primary/15 text-primary font-bold flex items-center justify-center flex-shrink-0 text-sm">
    {(name || '?')[0].toUpperCase()}
  </div>
);

/* ── Format time ───────────────────────────────────────── */
function formatTime(ts: number) {
  const d = new Date(ts * 1000);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

/* ── Mock conversations while real integration is built ── */
const MOCK_CONVERSATIONS: MetaConversation[] = [
  { id: '1', contact_name: 'João Silva', contact_phone: '+5511999990001', last_message: 'Olá, preciso de informações sobre o produto', last_message_ts: Date.now() / 1000 - 300, unread: 2, account_id: '' },
  { id: '2', contact_name: 'Maria Oliveira', contact_phone: '+5511999990002', last_message: 'Quando posso agendar uma demonstração?', last_message_ts: Date.now() / 1000 - 3600, unread: 0, account_id: '' },
  { id: '3', contact_name: 'Carlos Mendes', contact_phone: '+5511999990003', last_message: 'Já recebi o template de confirmação!', last_message_ts: Date.now() / 1000 - 7200, unread: 1, account_id: '' },
];

const MOCK_MESSAGES: Record<string, MetaMessage[]> = {
  '1': [
    { id: 'm1', from_me: false, body: 'Olá, tudo bem?', timestamp: Date.now() / 1000 - 600, type: 'text' },
    { id: 'm2', from_me: true, body: 'Olá! Tudo ótimo, como posso ajudar?', timestamp: Date.now() / 1000 - 500, type: 'text', status: 'read' },
    { id: 'm3', from_me: false, body: 'Preciso de informações sobre o produto', timestamp: Date.now() / 1000 - 300, type: 'text' },
  ],
  '2': [
    { id: 'm4', from_me: false, body: 'Quando posso agendar uma demonstração?', timestamp: Date.now() / 1000 - 3600, type: 'text' },
  ],
  '3': [
    { id: 'm5', from_me: true, body: 'Olá Carlos, enviando o template de confirmação!', timestamp: Date.now() / 1000 - 7800, type: 'text', status: 'delivered' },
    { id: 'm6', from_me: false, body: 'Já recebi o template de confirmação!', timestamp: Date.now() / 1000 - 7200, type: 'text' },
  ],
};

/* ─────────────────────────────────────────────────────── */
export default function InboxPage() {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<MetaInboxAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [selectedAccount, setSelectedAccount] = useState<MetaInboxAccount | null>(null);
  const [conversations] = useState<MetaConversation[]>(MOCK_CONVERSATIONS);
  const [selectedConv, setSelectedConv] = useState<MetaConversation | null>(null);
  const [messages, setMessages] = useState<MetaMessage[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [msgInput, setMsgInput] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);

  const loadAccounts = useCallback(async () => {
    setLoadingAccounts(true);
    try {
      const empresaId = await getSaasEmpresaId();
      const { data, error } = await (supabase as any)
        .from('meta_inbox_accounts')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setAccounts(data || []);
      if (data && data.length > 0 && !selectedAccount) {
        setSelectedAccount(data[0]);
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao carregar contas', description: e.message });
    } finally {
      setLoadingAccounts(false);
    }
  }, []);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);

  useEffect(() => {
    if (selectedConv) {
      setMessages(MOCK_MESSAGES[selectedConv.id] || []);
    }
  }, [selectedConv]);

  const filteredConvs = conversations.filter(c =>
    !searchQuery ||
    c.contact_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.contact_phone.includes(searchQuery)
  );

  const sendMessage = () => {
    if (!msgInput.trim() || !selectedConv) return;
    const newMsg: MetaMessage = {
      id: `m${Date.now()}`,
      from_me: true,
      body: msgInput.trim(),
      timestamp: Date.now() / 1000,
      type: 'text',
      status: 'sent',
    };
    setMessages(prev => [...prev, newMsg]);
    setMsgInput('');
    toast({ title: 'Mensagem enviada', description: 'Para enviar mensagens reais conecte uma conta Meta WABA.' });
  };

  /* ── No accounts state ──────────────────────────────── */
  if (!loadingAccounts && accounts.length === 0) {
    return (
      <>
        <div className="flex h-full items-center justify-center flex-col gap-5 p-8">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Inbox className="w-8 h-8 text-primary" />
          </div>
          <div className="text-center max-w-sm">
            <h2 className="text-lg font-semibold mb-1">Nenhuma caixa de entrada configurada</h2>
            <p className="text-sm text-muted-foreground mb-5">
              Conecte uma conta da API Oficial do WhatsApp (Meta) para começar a receber e enviar mensagens diretamente pelo Synkra.
            </p>
            <Button onClick={() => setSettingsOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" /> Conectar conta Meta WABA
            </Button>
          </div>
        </div>
        {settingsOpen && (
          <InboxSettingsModal
            onClose={() => setSettingsOpen(false)}
            onSaved={loadAccounts}
          />
        )}
      </>
    );
  }

  /* ── Main 3-column layout ───────────────────────────── */
  return (
    <div className="flex h-full overflow-hidden">
      {/* Col 1 — Accounts */}
      <div className="w-[200px] flex-shrink-0 border-r border-border flex flex-col bg-sidebar">
        <div className="h-14 flex items-center justify-between px-3 border-b border-border flex-shrink-0">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contas</span>
          <Button
            variant="ghost"
            size="icon"
            className="w-6 h-6"
            onClick={() => setSettingsOpen(true)}
            title="Configurações"
          >
            <Settings className="w-3.5 h-3.5" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto py-1.5 px-1.5 space-y-0.5">
          {loadingAccounts ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            accounts.map(acc => (
              <button
                key={acc.id}
                onClick={() => setSelectedAccount(acc)}
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left transition-colors',
                  selectedAccount?.id === acc.id
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-muted/60 text-foreground'
                )}
              >
                <div className="w-7 h-7 rounded-full bg-green-500/15 flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="w-3.5 h-3.5 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{acc.nome}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{acc.phone_display || acc.phone_number_id}</p>
                </div>
                <span className={cn(
                  'w-2 h-2 rounded-full flex-shrink-0',
                  acc.status === 'active' ? 'bg-green-500' : 'bg-muted-foreground/40'
                )} />
              </button>
            ))
          )}
        </div>
        <div className="p-2 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs h-8 gap-1.5"
            onClick={() => setSettingsOpen(true)}
          >
            <Plus className="w-3 h-3" /> Adicionar conta
          </Button>
        </div>
      </div>

      {/* Col 2 — Conversations */}
      <div className="w-[300px] flex-shrink-0 border-r border-border flex flex-col bg-background">
        <div className="h-14 flex items-center gap-2 px-3 border-b border-border flex-shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar conversa..."
              className="h-8 text-xs pl-8 bg-muted/40 border-border"
            />
          </div>
          <Button variant="ghost" size="icon" className="w-8 h-8 flex-shrink-0">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>

        {selectedAccount && (
          <div className="px-3 py-1.5 bg-green-500/5 border-b border-border flex items-center gap-2">
            <MessageSquare className="w-3 h-3 text-green-600 flex-shrink-0" />
            <p className="text-[10px] text-muted-foreground truncate flex-1">{selectedAccount.nome}</p>
            <Badge variant="outline" className="text-[9px] h-4 px-1">
              {selectedAccount.status === 'active' ? 'Ativo' : 'Pendente'}
            </Badge>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {filteredConvs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
              <MessageSquare className="w-8 h-8 opacity-30" />
              <p className="text-xs">Nenhuma conversa</p>
            </div>
          ) : (
            filteredConvs.map(conv => (
              <div
                key={conv.id}
                onClick={() => setSelectedConv(conv)}
                className={cn(
                  'flex items-start gap-2.5 px-3 py-3 cursor-pointer border-b border-border/50 transition-colors',
                  selectedConv?.id === conv.id ? 'bg-primary/5' : 'hover:bg-muted/40'
                )}
              >
                <AvatarInitials name={conv.contact_name} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-xs font-semibold truncate">{conv.contact_name}</p>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0 ml-1">
                      {formatTime(conv.last_message_ts)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-[11px] text-muted-foreground truncate">{conv.last_message}</p>
                    {conv.unread > 0 && (
                      <Badge className="h-4 min-w-[16px] px-1 text-[9px] flex-shrink-0" style={{ background: 'hsl(var(--primary))' }}>
                        {conv.unread}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Col 3 — Messages */}
      <div className="flex-1 flex flex-col overflow-hidden bg-background">
        {!selectedConv ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <MessageSquare className="w-12 h-12 opacity-20" />
            <p className="text-sm">Selecione uma conversa</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="h-14 border-b border-border flex items-center gap-3 px-4 flex-shrink-0 bg-card">
              <AvatarInitials name={selectedConv.contact_name} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{selectedConv.contact_name}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Phone className="w-3 h-3" /> {selectedConv.contact_phone}
                </p>
              </div>
              <Button variant="ghost" size="icon" className="w-8 h-8">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2" style={{ background: 'hsl(var(--muted)/0.2)' }}>
              {messages.map(msg => (
                <div key={msg.id} className={cn('flex', msg.from_me ? 'justify-end' : 'justify-start')}>
                  <div className={cn(
                    'max-w-[70%] rounded-2xl px-3.5 py-2 text-sm shadow-sm',
                    msg.from_me
                      ? 'bg-primary text-primary-foreground rounded-br-sm'
                      : 'bg-card text-foreground border border-border rounded-bl-sm'
                  )}>
                    <p className="leading-relaxed">{msg.body}</p>
                    <div className={cn('flex items-center gap-1 mt-1', msg.from_me ? 'justify-end' : 'justify-start')}>
                      <Clock className="w-2.5 h-2.5 opacity-60" />
                      <span className="text-[10px] opacity-70">{formatTime(msg.timestamp)}</span>
                      {msg.from_me && msg.status === 'read' && <CheckCheck className="w-3 h-3 text-blue-300" />}
                      {msg.from_me && msg.status === 'delivered' && <CheckCheck className="w-3 h-3 opacity-60" />}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Input */}
            <div className="border-t border-border p-3 flex items-center gap-2 bg-card flex-shrink-0">
              <Input
                value={msgInput}
                onChange={e => setMsgInput(e.target.value)}
                placeholder="Escreva uma mensagem..."
                className="flex-1 h-9 text-sm bg-muted/40 border-border"
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              />
              <Button
                size="icon"
                className="w-9 h-9 flex-shrink-0"
                onClick={sendMessage}
                disabled={!msgInput.trim()}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </>
        )}
      </div>

      {settingsOpen && (
        <InboxSettingsModal
          onClose={() => setSettingsOpen(false)}
          onSaved={loadAccounts}
          accounts={accounts}
          onAccountsChange={setAccounts}
        />
      )}
    </div>
  );
}
