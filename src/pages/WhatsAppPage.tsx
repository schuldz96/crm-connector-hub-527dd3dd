import { useState } from 'react';
import { MOCK_WHATSAPP_INSTANCES, MOCK_CONVERSATIONS, MOCK_MESSAGES, MOCK_USERS } from '@/data/mockData';
import type { WhatsAppInstance, Conversation } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  MessageSquare, Plus, Search, Wifi, WifiOff, QrCode, Brain,
  Send, Smile, Paperclip, MoreHorizontal, Zap, RefreshCcw,
  CheckCheck, Shield, Users, AlertCircle, X, Loader2, Phone,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const TAG_COLORS: Record<string, string> = {
  'quente': 'bg-destructive/10 text-destructive border-destructive/20',
  'morno': 'bg-warning/10 text-warning border-warning/20',
  'frio': 'bg-info/10 text-info border-info/20',
  'fechado': 'bg-success/10 text-success border-success/20',
  'demo': 'bg-primary/10 text-primary border-primary/20',
  'fechamento': 'bg-accent/10 text-accent border-accent/20',
  'objeção-preço': 'bg-destructive/10 text-destructive border-destructive/20',
};

// ─── QR Code Modal ────────────────────────────────────────────────────────────
function QRCodeModal({
  instance,
  onClose,
}: {
  instance: WhatsAppInstance | null;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);

  const handleGenerate = () => {
    setLoading(true);
    setGenerated(false);
    setTimeout(() => {
      setLoading(false);
      setGenerated(true);
    }, 1500);
  };

  if (!instance) return null;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            <QrCode className="w-4 h-4 text-primary" />
            Conectar — {instance.name}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          {/* Status badge */}
          <div className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border',
            instance.status === 'connected'
              ? 'bg-success/10 text-success border-success/20'
              : instance.status === 'connecting'
              ? 'bg-warning/10 text-warning border-warning/20'
              : 'bg-muted text-muted-foreground border-border',
          )}>
            <span className={cn(
              'w-1.5 h-1.5 rounded-full',
              instance.status === 'connected' ? 'bg-success' : instance.status === 'connecting' ? 'bg-warning animate-pulse' : 'bg-muted-foreground',
            )} />
            {instance.status === 'connected' ? 'Conectado' : instance.status === 'connecting' ? 'Conectando...' : 'Desconectado'}
          </div>

          {instance.status === 'connected' ? (
            <div className="text-center space-y-1">
              <p className="text-sm font-semibold text-foreground">{instance.phone}</p>
              <p className="text-xs text-muted-foreground">Este número já está conectado.</p>
              <p className="text-xs text-muted-foreground">Para reconectar, gere um novo QR Code abaixo.</p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center">
              Abra o WhatsApp → Dispositivos conectados → Conectar um dispositivo
            </p>
          )}

          {/* QR Code area */}
          <div className="w-44 h-44 bg-secondary rounded-2xl border border-border flex items-center justify-center relative overflow-hidden">
            {loading ? (
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            ) : generated ? (
              <>
                {/* Fake QR pattern */}
                <div className="w-36 h-36 grid grid-cols-7 gap-0.5 p-2">
                  {Array.from({ length: 49 }).map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        'rounded-sm',
                        Math.random() > 0.5 || [0,1,2,3,6,7,13,14,21,22,23,27,28,29,35,42,43,45,46,47,48].includes(i)
                          ? 'bg-foreground'
                          : 'bg-transparent',
                      )}
                    />
                  ))}
                </div>
                <p className="absolute bottom-1.5 text-[9px] text-muted-foreground">Válido por 60 segundos</p>
              </>
            ) : (
              <div className="text-center">
                <QrCode className="w-12 h-12 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-[10px] text-muted-foreground">Clique em gerar</p>
              </div>
            )}
          </div>

          <Button
            size="sm"
            className="w-full bg-gradient-primary h-9 text-xs"
            onClick={handleGenerate}
            disabled={loading}
          >
            {loading ? (
              <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> Gerando...</>
            ) : (
              <><RefreshCcw className="w-3 h-3 mr-1.5" /> {generated ? 'Regenerar QR Code' : 'Gerar QR Code'}</>
            )}
          </Button>

          <p className="text-[10px] text-muted-foreground text-center">
            Após conectar, esta tela fechará automaticamente.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Admin: All Instances Overview ───────────────────────────────────────────
function AdminInstancesPanel({
  instances,
  onQRCode,
}: {
  instances: WhatsAppInstance[];
  onQRCode: (inst: WhatsAppInstance) => void;
}) {
  const connected = instances.filter(i => i.status === 'connected').length;
  const disconnected = instances.filter(i => i.status !== 'connected').length;

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-2">
        <div className="glass-card p-3 rounded-xl border border-success/20 bg-success/5">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Conectados</p>
          <p className="text-2xl font-bold text-success">{connected}</p>
        </div>
        <div className="glass-card p-3 rounded-xl border border-destructive/20 bg-destructive/5">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Desconectados</p>
          <p className="text-2xl font-bold text-destructive">{disconnected}</p>
        </div>
      </div>

      {/* Instance list */}
      <div className="space-y-1.5">
        {instances.map(inst => {
          const owner = MOCK_USERS.find(u => u.id === inst.userId);
          return (
            <div
              key={inst.id}
              className="glass-card p-3 rounded-xl border border-border flex items-center gap-3"
            >
              <div className={cn(
                'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0',
                inst.status === 'connected' ? 'bg-success/15' : 'bg-muted',
              )}>
                {inst.status === 'connected'
                  ? <Wifi className="w-4 h-4 text-success" />
                  : <WifiOff className="w-4 h-4 text-muted-foreground" />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <p className="text-xs font-semibold truncate">{inst.name}</p>
                  <span className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                    inst.status === 'connected'
                      ? 'bg-success/10 text-success'
                      : inst.status === 'connecting'
                      ? 'bg-warning/10 text-warning'
                      : 'bg-muted text-muted-foreground',
                  )}>
                    {inst.status === 'connected' ? 'Online' : inst.status === 'connecting' ? 'Conectando' : 'Offline'}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground truncate">
                  {inst.phone || 'Sem número'} · {owner?.name || 'Sem responsável'}
                </p>
                {inst.lastSeen && (
                  <p className="text-[10px] text-muted-foreground/60">
                    Visto: {new Date(inst.lastSeen).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </div>

              <button
                onClick={() => onQRCode(inst)}
                className="flex-shrink-0 w-8 h-8 rounded-lg border border-border bg-secondary flex items-center justify-center hover:bg-muted/80 transition-colors"
                title="Gerar QR Code"
              >
                <QrCode className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── User: My Instance Card ───────────────────────────────────────────────────
function MyInstanceCard({
  instance,
  onQRCode,
}: {
  instance: WhatsAppInstance | undefined;
  onQRCode: () => void;
}) {
  if (!instance) {
    return (
      <div className="glass-card p-4 rounded-xl border border-dashed border-border flex flex-col items-center gap-3 text-center">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
          <Phone className="w-5 h-5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-xs font-semibold mb-0.5">Nenhuma instância</p>
          <p className="text-[10px] text-muted-foreground">Você ainda não tem um WhatsApp conectado.</p>
        </div>
        <Button size="sm" className="bg-gradient-primary text-xs h-8 w-full" onClick={onQRCode}>
          <QrCode className="w-3.5 h-3.5 mr-1.5" /> Conectar WhatsApp
        </Button>
      </div>
    );
  }

  return (
    <div className={cn(
      'glass-card p-4 rounded-xl border',
      instance.status === 'connected' ? 'border-success/25 bg-success/3' : 'border-border',
    )}>
      <div className="flex items-center gap-3 mb-3">
        <div className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center',
          instance.status === 'connected' ? 'bg-success/15' : 'bg-muted',
        )}>
          {instance.status === 'connected'
            ? <Wifi className="w-5 h-5 text-success" />
            : <WifiOff className="w-5 h-5 text-muted-foreground" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{instance.name}</p>
          <p className="text-xs text-muted-foreground">{instance.phone || 'Sem número'}</p>
        </div>
        <span className={cn(
          'text-[10px] px-2 py-1 rounded-full font-medium border',
          instance.status === 'connected'
            ? 'bg-success/10 text-success border-success/20'
            : instance.status === 'connecting'
            ? 'bg-warning/10 text-warning border-warning/20'
            : 'bg-muted text-muted-foreground border-border',
        )}>
          {instance.status === 'connected' ? '● Online' : instance.status === 'connecting' ? '◉ Conectando' : '○ Offline'}
        </span>
      </div>

      {instance.lastSeen && (
        <p className="text-[10px] text-muted-foreground mb-3">
          Último acesso: {new Date(instance.lastSeen).toLocaleString('pt-BR')}
        </p>
      )}

      <Button
        size="sm"
        variant="outline"
        className="w-full text-xs h-8 border-border"
        onClick={onQRCode}
      >
        <QrCode className="w-3.5 h-3.5 mr-1.5" />
        {instance.status === 'connected' ? 'Reconectar / QR Code' : 'Gerar QR Code'}
      </Button>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function WhatsAppPage() {
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole(['admin']);

  // Filter instances: admin sees all, others see only their own
  const visibleInstances = isAdmin
    ? MOCK_WHATSAPP_INSTANCES
    : MOCK_WHATSAPP_INSTANCES.filter(i => i.userId === user?.id);

  const myInstance = MOCK_WHATSAPP_INSTANCES.find(i => i.userId === user?.id);

  const [activeInstance, setActiveInstance] = useState<string>(
    visibleInstances[0]?.id || '',
  );
  const [activeConv, setActiveConv] = useState<Conversation | null>(
    MOCK_CONVERSATIONS.find(c => c.instanceId === visibleInstances[0]?.id) || null,
  );
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [qrInstance, setQrInstance] = useState<WhatsAppInstance | null>(null);
  const [adminView, setAdminView] = useState<'instances' | 'chat'>(isAdmin ? 'instances' : 'chat');

  const currentInstance = MOCK_WHATSAPP_INSTANCES.find(i => i.id === activeInstance);
  const instanceConvs = MOCK_CONVERSATIONS.filter(c =>
    c.instanceId === activeInstance &&
    (c.contactName.toLowerCase().includes(search.toLowerCase()) ||
      c.lastMessage.toLowerCase().includes(search.toLowerCase())),
  );
  const msgs = activeConv ? (MOCK_MESSAGES[activeConv.id] || []) : [];

  const handleSend = () => {
    if (!message.trim()) return;
    setMessage('');
  };

  const handleSelectInstance = (id: string) => {
    setActiveInstance(id);
    const firstConv = MOCK_CONVERSATIONS.find(c => c.instanceId === id);
    setActiveConv(firstConv || null);
    setAdminView('chat');
  };

  return (
    <div className="page-container animate-fade-in h-[calc(100vh-56px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-display font-bold">WhatsApp</h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin ? `Gerenciando ${visibleInstances.length} instâncias da empresa` : 'Seu WhatsApp comercial'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <div className="flex items-center gap-1 p-1 bg-secondary rounded-lg border border-border">
              <button
                onClick={() => setAdminView('instances')}
                className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors', adminView === 'instances' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
              >
                <Users className="w-3.5 h-3.5" /> Instâncias
              </button>
              <button
                onClick={() => setAdminView('chat')}
                className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors', adminView === 'chat' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
              >
                <MessageSquare className="w-3.5 h-3.5" /> Conversas
              </button>
            </div>
          )}
          {!isAdmin && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-8 border-border"
              onClick={() => setQrInstance(myInstance || null)}
            >
              <QrCode className="w-3.5 h-3.5 mr-1.5" /> QR Code
            </Button>
          )}
        </div>
      </div>

      {/* ── Admin: Instances overview ── */}
      {isAdmin && adminView === 'instances' && (
        <div className="flex gap-4 flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Visão Admin — Todas as Instâncias</span>
            </div>
            <AdminInstancesPanel
              instances={MOCK_WHATSAPP_INSTANCES}
              onQRCode={inst => setQrInstance(inst)}
            />
          </div>
        </div>
      )}

      {/* ── Chat view (admin + users) ── */}
      {(adminView === 'chat' || !isAdmin) && (
        <div className="flex gap-4 flex-1 min-h-0">

          {/* Left: My instance (non-admin) OR instance selector (admin) */}
          <div className="w-52 flex-shrink-0 flex flex-col gap-3">
            {!isAdmin ? (
              <>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Minha Instância</p>
                <MyInstanceCard
                  instance={myInstance}
                  onQRCode={() => setQrInstance(myInstance || { id: 'new', name: 'Nova Instância', status: 'disconnected', userId: user?.id || '', createdAt: '' })}
                />
              </>
            ) : (
              <>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Instâncias</p>
                <div className="space-y-1.5 overflow-y-auto flex-1">
                  {visibleInstances.map(inst => {
                    const owner = MOCK_USERS.find(u => u.id === inst.userId);
                    return (
                      <button
                        key={inst.id}
                        onClick={() => handleSelectInstance(inst.id)}
                        className={cn(
                          'w-full flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all text-left',
                          activeInstance === inst.id ? 'border-primary/30 bg-primary/5' : 'border-border bg-card hover:bg-muted/50',
                        )}
                      >
                        <div className={cn('w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0', inst.status === 'connected' ? 'bg-success/15' : 'bg-muted')}>
                          {inst.status === 'connected'
                            ? <Wifi className="w-4 h-4 text-success" />
                            : <WifiOff className="w-4 h-4 text-muted-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate">{inst.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{owner?.name || inst.phone || 'Sem responsável'}</p>
                        </div>
                        <span className={cn('w-2 h-2 rounded-full flex-shrink-0', inst.status === 'connected' ? 'bg-success' : inst.status === 'connecting' ? 'bg-warning animate-pulse' : 'bg-muted-foreground/40')} />
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Conversations List */}
          <div className="w-72 flex-shrink-0 glass-card flex flex-col">
            <div className="p-3 border-b border-border flex-shrink-0">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className={cn('w-2 h-2 rounded-full', currentInstance?.status === 'connected' ? 'bg-success' : 'bg-muted-foreground/40')} />
                  <span className="text-xs font-semibold truncate max-w-[140px]">{currentInstance?.name || '—'}</span>
                </div>
                {currentInstance?.status !== 'connected' && (
                  <button
                    onClick={() => setQrInstance(currentInstance || null)}
                    className="flex items-center gap-1 text-[10px] text-warning hover:text-warning/80 transition-colors"
                  >
                    <AlertCircle className="w-3 h-3" /> Reconectar
                  </button>
                )}
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar conversas..."
                  className="pl-7 h-7 text-xs bg-secondary border-border"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {instanceConvs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                  <MessageSquare className="w-8 h-8 mb-2 opacity-30" />
                  <p className="text-xs">Nenhuma conversa</p>
                </div>
              ) : (
                instanceConvs.map(conv => (
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
                ))
              )}
            </div>
          </div>

          {/* Chat Window */}
          <div className="flex-1 min-w-0 glass-card flex flex-col">
            {activeConv ? (
              <>
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
      )}

      {/* QR Code Modal */}
      {qrInstance !== null && (
        <QRCodeModal
          instance={qrInstance}
          onClose={() => setQrInstance(null)}
        />
      )}
    </div>
  );
}
