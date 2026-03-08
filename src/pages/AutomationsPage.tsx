import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Zap, Plus, Play, Clock, CheckCircle2, XCircle, Settings2, Brain, MessageSquare, TrendingUp, Workflow, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

const AUTOMATIONS = [
  { id: 'auto_001', name: 'Análise pós-reunião via IA', trigger: 'Reunião concluída', action: 'OpenAI → Scorecard automático', status: 'active', lastRun: '2024-11-24T16:00:00', runs: 42 },
  { id: 'auto_002', name: 'Notificação no-show', trigger: 'Reunião marcada como no-show', action: 'WhatsApp → Follow-up automático', status: 'active', lastRun: '2024-11-23T10:00:00', runs: 8 },
  { id: 'auto_003', name: 'Qualificação WhatsApp → HubSpot', trigger: 'Conversa com score > 80', action: 'Criar deal no HubSpot', status: 'paused', lastRun: '2024-11-20T14:00:00', runs: 15 },
  { id: 'auto_004', name: 'Relatório semanal por email', trigger: 'Toda segunda-feira 08:00', action: 'Gerar PDF → Enviar por email', status: 'active', lastRun: '2024-11-18T08:00:00', runs: 6 },
];

const WEBHOOK_EVENTS = [
  { event: 'meeting.completed', desc: 'Reunião marcada como concluída', example: '{ "meetingId": "...", "score": 87 }' },
  { event: 'whatsapp.message.received', desc: 'Nova mensagem recebida no WhatsApp', example: '{ "from": "+55...", "body": "..." }' },
  { event: 'conversation.analyzed', desc: 'IA analisou uma conversa', example: '{ "conversationId": "...", "score": 75 }' },
  { event: 'user.performance.updated', desc: 'Score do vendedor atualizado', example: '{ "userId": "...", "score": 91 }' },
];

export default function AutomationsPage() {
  const [webhookUrl, setWebhookUrl] = useState('https://n8n.meudominio.com/webhook/deal-intel');

  return (
    <div className="page-container animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold">Automações N8N</h1>
          <p className="text-sm text-muted-foreground">Fluxos automáticos e webhooks</p>
        </div>
        <Button size="sm" className="bg-gradient-primary text-xs h-8">
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Nova Automação
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Automations */}
        <div>
          <h2 className="section-title mb-4">Automações Ativas</h2>
          <div className="space-y-3">
            {AUTOMATIONS.map(a => (
              <div key={a.id} className="glass-card p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={cn('w-2 h-2 rounded-full flex-shrink-0 mt-1.5', a.status === 'active' ? 'bg-success animate-pulse' : 'bg-muted-foreground')} />
                    <div>
                      <p className="text-sm font-semibold">{a.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        <span className="text-foreground/70">Gatilho:</span> {a.trigger}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <span className="text-foreground/70">Ação:</span> {a.action}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className={cn('text-[10px] px-2 py-0.5 rounded-full border', a.status === 'active' ? 'bg-success/10 text-success border-success/20' : 'bg-muted text-muted-foreground border-border')}>
                      {a.status === 'active' ? 'Ativo' : 'Pausado'}
                    </span>
                    <button className="w-6 h-6 rounded hover:bg-muted flex items-center justify-center">
                      <Settings2 className="w-3 h-3 text-muted-foreground" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/50 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Play className="w-3 h-3" /> {a.runs} execuções
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Última: {new Date(a.lastRun).toLocaleDateString('pt-BR')}
                  </span>
                  <Button size="sm" variant="ghost" className="ml-auto h-6 text-[10px] text-primary px-2">
                    <Zap className="w-3 h-3 mr-1" /> Executar agora
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Webhook Events */}
        <div>
          <h2 className="section-title mb-4">Eventos para N8N</h2>
          <div className="glass-card p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Globe className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">URL do Webhook N8N</span>
            </div>
            <div className="flex gap-2">
              <input
                value={webhookUrl}
                onChange={e => setWebhookUrl(e.target.value)}
                className="flex-1 text-xs bg-secondary border border-border rounded-lg px-3 h-8 text-foreground outline-none focus:border-primary/50"
              />
              <Button size="sm" className="text-xs h-8 bg-gradient-primary">Salvar</Button>
            </div>
          </div>

          <div className="space-y-2">
            {WEBHOOK_EVENTS.map(evt => (
              <div key={evt.event} className="glass-card p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0 mr-3">
                    <p className="text-xs font-mono font-medium text-primary">{evt.event}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{evt.desc}</p>
                    <code className="text-[10px] text-muted-foreground/80 block mt-1 truncate">{evt.example}</code>
                  </div>
                  <Button size="sm" variant="outline" className="text-[10px] h-6 border-border px-2 flex-shrink-0">
                    Testar
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="glass-card p-4 mt-4" style={{ background: 'linear-gradient(135deg, hsl(var(--primary)/0.05), hsl(var(--accent)/0.05))' }}>
            <div className="flex items-center gap-2 mb-2">
              <Brain className="w-4 h-4 text-accent" />
              <span className="text-sm font-semibold">Botões de Disparo Rápido</span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">Envie eventos manualmente para o N8N</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="text-xs h-7 border-primary/30 text-primary">
                <Zap className="w-3 h-3 mr-1" /> Iniciar Fluxo WhatsApp
              </Button>
              <Button size="sm" variant="outline" className="text-xs h-7 border-accent/30 text-accent">
                <Brain className="w-3 h-3 mr-1" /> Analisar Conversa
              </Button>
              <Button size="sm" variant="outline" className="text-xs h-7 border-border">
                <TrendingUp className="w-3 h-3 mr-1" /> Fluxo de Vendas
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
