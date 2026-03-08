import { useState } from 'react';
import { MOCK_WHATSAPP_INSTANCES, MOCK_CONVERSATIONS, MOCK_MESSAGES } from '@/data/mockData';
import type { Conversation } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  MessageSquare, Plus, Search, Wifi, WifiOff, QrCode, Brain,
  Send, Smile, Paperclip, MoreHorizontal, Phone, Zap, X, Tag,
  CheckCheck, Check, RefreshCcw
} from 'lucide-react';
import { cn } from '@/lib/utils';

const TAG_COLORS: Record<string, string> = {
  'quente': 'bg-destructive/10 text-destructive border-destructive/20',
  'morno': 'bg-warning/10 text-warning border-warning/20',
  'frio': 'bg-info/10 text-info border-info/20',
  'fechado': 'bg-success/10 text-success border-success/20',
  'demo': 'bg-primary/10 text-primary border-primary/20',
  'fechamento': 'bg-accent/10 text-accent border-accent/20',
  'objeção-preço': 'bg-destructive/10 text-destructive border-destructive/20',
};

function InstanceCard({ instance, active, onClick }: any) {
  return (
    <div
      className={cn('flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all', active ? 'border-primary/30 bg-primary/5' : 'border-border bg-card hover:bg-muted/50')}
      onClick={onClick}
    >
      <div className={cn('w-8 h-8 rounded-full flex items-center justify-center', instance.status === 'connected' ? 'bg-green-500/15' : 'bg-muted')}>
        {instance.status === 'connected' ? <Wifi className="w-4 h-4 text-green-400" /> : <WifiOff className="w-4 h-4 text-muted-foreground" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold truncate">{instance.name}</p>
        <p className="text-[10px] text-muted-foreground truncate">{instance.phone || 'Não conectado'}</p>
      </div>
      <span className={cn('status-dot', instance.status === 'connected' ? 'online' : instance.status === 'connecting' ? 'busy' : 'offline')} />
    </div>
  );
}

export default function WhatsAppPage() {
  const [activeInstance, setActiveInstance] = useState(MOCK_WHATSAPP_INSTANCES[0].id);
  const [activeConv, setActiveConv] = useState<Conversation | null>(MOCK_CONVERSATIONS[0]);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [showNewInstance, setShowNewInstance] = useState(false);

  const instanceConvs = MOCK_CONVERSATIONS.filter(c =>
    c.instanceId === activeInstance &&
    (c.contactName.toLowerCase().includes(search.toLowerCase()) || c.lastMessage.toLowerCase().includes(search.toLowerCase()))
  );
  const msgs = activeConv ? (MOCK_MESSAGES[activeConv.id] || []) : [];
  const instance = MOCK_WHATSAPP_INSTANCES.find(i => i.id === activeInstance);

  const handleSend = () => {
    if (!message.trim()) return;
    setMessage('');
  };

  return (
    <div className="page-container animate-fade-in h-[calc(100vh-56px)] flex flex-col">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-display font-bold">WhatsApp</h1>
          <p className="text-sm text-muted-foreground">Instâncias e conversas comerciais</p>
        </div>
        <Button size="sm" className="bg-gradient-primary text-xs h-8" onClick={() => setShowNewInstance(true)}>
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Nova Instância
        </Button>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Instances Panel */}
        <div className="w-52 flex-shrink-0 flex flex-col gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Instâncias</p>
          <div className="space-y-1.5">
            {MOCK_WHATSAPP_INSTANCES.map(inst => (
              <InstanceCard
                key={inst.id}
                instance={inst}
                active={activeInstance === inst.id}
                onClick={() => setActiveInstance(inst.id)}
              />
            ))}
          </div>
          {showNewInstance && (
            <div className="glass-card p-4 mt-2 text-center">
              <QrCode className="w-12 h-12 mx-auto mb-2 text-muted-foreground" />
              <p className="text-xs font-medium mb-1">Conectar WhatsApp</p>
              <p className="text-[10px] text-muted-foreground mb-3">Escaneie o QR Code no seu WhatsApp</p>
              <div className="w-24 h-24 bg-muted mx-auto rounded-lg flex items-center justify-center mb-3">
                <QrCode className="w-16 h-16 text-muted-foreground/50" />
              </div>
              <Button size="sm" variant="outline" className="w-full text-xs h-7" onClick={() => setShowNewInstance(false)}>
                <RefreshCcw className="w-3 h-3 mr-1" /> Gerar QR Code
              </Button>
            </div>
          )}
        </div>

        {/* Conversations List */}
        <div className="w-72 flex-shrink-0 glass-card flex flex-col">
          <div className="p-3 border-b border-border flex-shrink-0">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex items-center gap-1.5">
                <span className={cn('status-dot', instance?.status === 'connected' ? 'online' : 'offline')} />
                <span className="text-xs font-semibold">{instance?.name}</span>
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar conversas..." className="pl-7 h-7 text-xs bg-secondary border-border" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {instanceConvs.length === 0 && (
              <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                <MessageSquare className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-xs">Nenhuma conversa</p>
              </div>
            )}
            {instanceConvs.map(conv => (
              <div
                key={conv.id}
                className={cn('flex items-start gap-3 p-3 border-b border-border/50 cursor-pointer hover:bg-muted/30 transition-colors', activeConv?.id === conv.id && 'bg-primary/5 border-l-2 border-l-primary')}
                onClick={() => setActiveConv(conv)}
              >
                <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-sm font-bold flex-shrink-0 border border-border">
                  {conv.contactName[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-xs font-semibold truncate">{conv.contactName}</p>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0 ml-1">
                      {new Date(conv.lastMessageAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">{conv.lastMessage}</p>
                  <div className="flex items-center gap-1 mt-1">
                    {conv.tags.slice(0, 2).map(tag => (
                      <span key={tag} className={cn('text-[10px] px-1.5 py-0.5 rounded border', TAG_COLORS[tag] || 'bg-muted text-muted-foreground border-border')}>
                        {tag}
                      </span>
                    ))}
                    {conv.unreadCount > 0 && (
                      <span className="ml-auto w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chat Window */}
        <div className="flex-1 min-w-0 glass-card flex flex-col">
          {activeConv ? (
            <>
              {/* Chat Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-sm font-bold border border-border">
                    {activeConv.contactName[0]}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{activeConv.contactName}</p>
                    <p className="text-xs text-muted-foreground">{activeConv.contactPhone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {activeConv.score && (
                    <span className={activeConv.score >= 80 ? 'score-excellent' : activeConv.score >= 60 ? 'score-good' : 'score-average'}>
                      Score: {activeConv.score}
                    </span>
                  )}
                  <Button size="sm" variant="outline" className="text-xs h-7 border-border gap-1">
                    <Brain className="w-3 h-3 text-accent" />
                    Analisar IA
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs h-7 border-border gap-1">
                    <Zap className="w-3 h-3 text-primary" />
                    Automação
                  </Button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {msgs.map(msg => (
                  <div key={msg.id} className={cn('flex', msg.direction === 'outbound' ? 'justify-end' : 'justify-start')}>
                    <div className={cn('max-w-[70%] px-3 py-2 rounded-2xl text-xs', msg.direction === 'outbound' ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-secondary text-foreground rounded-tl-sm')}>
                      <p className="leading-relaxed">{msg.body}</p>
                      <p className={cn('text-[10px] mt-1 text-right', msg.direction === 'outbound' ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                        {new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        {msg.direction === 'outbound' && <CheckCheck className="w-3 h-3 inline ml-1" />}
                      </p>
                    </div>
                  </div>
                ))}
                {msgs.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <MessageSquare className="w-12 h-12 mb-3 opacity-20" />
                    <p className="text-sm">Nenhuma mensagem carregada</p>
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="p-3 border-t border-border flex-shrink-0">
                <div className="flex items-center gap-2">
                  <button className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                    <Paperclip className="w-4 h-4" />
                  </button>
                  <Input
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                    placeholder="Digite uma mensagem..."
                    className="flex-1 h-9 text-xs bg-secondary border-border"
                  />
                  <button className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                    <Smile className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleSend}
                    className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center hover:opacity-90 transition-opacity"
                  >
                    <Send className="w-3.5 h-3.5 text-primary-foreground" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <MessageSquare className="w-16 h-16 mb-4 opacity-10" />
              <p className="text-sm">Selecione uma conversa</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
