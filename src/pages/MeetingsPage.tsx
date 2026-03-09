import { useState } from 'react';
import { MOCK_MEETINGS, MOCK_EVALUATIONS } from '@/data/mockData';
import type { Meeting } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Video, Search, Plus, Brain, Clock, Calendar,
  User, Building2, ExternalLink, Sparkles, X,
  TrendingUp, TrendingDown, Lightbulb, AlertTriangle,
  CheckCircle2, Target, MessageSquare, ChevronUp, ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_CONFIG: Record<string, { label: string; class: string }> = {
  completed: { label: 'Concluída', class: 'score-good' },
  scheduled: { label: 'Agendada', class: 'score-excellent' },
  cancelled: { label: 'Cancelada', class: 'score-poor' },
  no_show: { label: 'No-show', class: 'score-average' },
};

const SCORE_CRITERIA = [
  { key: 'rapport', label: 'Rapport', icon: '🤝', tip: 'Conexão emocional e abertura do cliente' },
  { key: 'discovery', label: 'Descoberta', icon: '🔍', tip: 'Qualidade das perguntas de qualificação' },
  { key: 'presentation', label: 'Apresentação', icon: '💡', tip: 'Clareza e impacto da proposta de valor' },
  { key: 'objections', label: 'Objeções', icon: '🛡️', tip: 'Tratamento de resistências do cliente' },
  { key: 'nextSteps', label: 'Próximos Passos', icon: '📅', tip: 'Clareza e comprometimento do fechamento' },
];

// Extended mock suggestions per meeting
const AI_SUGGESTIONS: Record<string, { strengths: string[]; improvements: string[]; actions: string[] }> = {
  mtg_001: {
    strengths: [
      'Excelente uso de perguntas abertas na fase de descoberta',
      'Rapport natural e autêntico estabelecido nos primeiros 2 minutos',
      'Proposta de valor alinhada diretamente às dores identificadas',
    ],
    improvements: [
      'Objeções de preço respondidas de forma defensiva — use ancoragem de valor',
      'Próximos passos poderiam ter data e hora definidas na própria reunião',
    ],
    actions: [
      'Enviar proposta comercial até 24h após a reunião',
      'Agendar follow-up em 3 dias úteis para validar a proposta',
      'Compartilhar case de sucesso do setor do cliente',
    ],
  },
  mtg_002: {
    strengths: [
      'Boa organização da agenda logo no início',
      'Demonstração do produto dentro do tempo previsto',
    ],
    improvements: [
      'Fase de descoberta muito curta — aprofunde com SPIN ou MEDDIC',
      'Perguntas fechadas limitaram o diagnóstico das dores reais',
      'Cliente mencionou budget mas não foi explorado',
    ],
    actions: [
      'Retomar a descoberta no próximo contato com perguntas de impacto',
      'Solicitar acesso ao decisor real (budget authority)',
      'Enviar comparativo competitivo personalizado',
    ],
  },
  mtg_003: {
    strengths: [
      'Performance excepcional — reunião referência para o time',
      'Técnica consultiva aplicada em todos os pilares',
      'Fechamento de próximos passos com data, hora e responsáveis',
    ],
    improvements: [
      'Apresentação poderia explorar mais o ROI em números do cliente',
    ],
    actions: [
      'Usar esta gravação como benchmark de treinamento',
      'Avançar para proposta executiva com C-Level',
    ],
  },
};

function ScoreBar({ value, label, icon, tip }: { value: number; label: string; icon: string; tip: string }) {
  const color = value >= 85
    ? 'hsl(168 80% 42%)'
    : value >= 70
    ? 'hsl(210 100% 56%)'
    : value >= 60
    ? 'hsl(38 92% 50%)'
    : 'hsl(0 72% 51%)';

  const delta = value - 75; // vs hypothetical average
  return (
    <div className="group">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs">{icon}</span>
        <span className="text-xs text-muted-foreground flex-1">{label}</span>
        <span className="text-[10px] text-muted-foreground/60 hidden group-hover:block transition-all">{tip}</span>
        <div className="flex items-center gap-1">
          {delta > 0
            ? <TrendingUp className="w-3 h-3 text-success" />
            : <TrendingDown className="w-3 h-3 text-destructive" />}
          <span className="text-xs font-bold" style={{ color }}>{value}</span>
        </div>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${value}%`, background: color }}
        />
      </div>
    </div>
  );
}

export default function MeetingsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [detailTab, setDetailTab] = useState<'scorecard' | 'suggestions' | 'transcript'>('scorecard');

  const filtered = MOCK_MEETINGS.filter(m => {
    const matchSearch =
      m.title.toLowerCase().includes(search.toLowerCase()) ||
      m.clientName.toLowerCase().includes(search.toLowerCase()) ||
      m.sellerName.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || m.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const evaluation = selectedMeeting
    ? MOCK_EVALUATIONS.find(e => e.meetingId === selectedMeeting.id)
    : null;

  const suggestions = selectedMeeting ? AI_SUGGESTIONS[selectedMeeting.id] : null;

  return (
    <div className="page-container animate-fade-in">
      <div className="flex gap-6">
        {/* Main list */}
        <div className={cn('flex-1 min-w-0', selectedMeeting && 'lg:w-1/2')}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-display font-bold">Reuniões</h1>
              <p className="text-sm text-muted-foreground">{filtered.length} reuniões encontradas</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar por título, cliente, vendedor..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-8 text-xs bg-secondary border-border"
              />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {['all', 'completed', 'scheduled', 'no_show'].map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    'text-xs px-3 py-1.5 rounded-lg border transition-all',
                    statusFilter === s
                      ? 'bg-primary/15 border-primary/30 text-primary font-medium'
                      : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  {{ all: 'Todas', completed: 'Concluídas', scheduled: 'Agendadas', no_show: 'No-show' }[s]}
                </button>
              ))}
            </div>
          </div>

          <div className="glass-card overflow-hidden">
            <table className="w-full data-table">
              <thead>
                <tr>
                  <th className="text-left">Reunião</th>
                  <th className="text-left hidden md:table-cell">Vendedor</th>
                  <th className="text-left hidden lg:table-cell">Data</th>
                  <th className="text-center">Score</th>
                  <th className="text-center">Status</th>
                  <th className="text-center hidden lg:table-cell">IA</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(m => (
                  <tr
                    key={m.id}
                    className={cn('cursor-pointer', selectedMeeting?.id === m.id && 'bg-primary/5')}
                    onClick={() => setSelectedMeeting(selectedMeeting?.id === m.id ? null : m)}
                  >
                    <td>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Video className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{m.title}</p>
                          <p className="text-xs text-muted-foreground">{m.clientName}</p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden md:table-cell">
                      <div className="flex items-center gap-2">
                        <img
                          src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${m.sellerName}`}
                          alt={m.sellerName}
                          className="w-6 h-6 rounded-full border border-border"
                        />
                        <span className="text-sm">{m.sellerName}</span>
                      </div>
                    </td>
                    <td className="hidden lg:table-cell">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        {new Date(m.date).toLocaleDateString('pt-BR')}
                        <span className="ml-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" />{m.duration}min
                        </span>
                      </div>
                    </td>
                    <td className="text-center">
                      {m.score ? (
                        <span className={m.score >= 85 ? 'score-excellent' : m.score >= 70 ? 'score-good' : 'score-average'}>
                          {m.score}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="text-center">
                      <span className={STATUS_CONFIG[m.status].class}>{STATUS_CONFIG[m.status].label}</span>
                    </td>
                    <td className="text-center hidden lg:table-cell">
                      {m.aiAnalyzed ? (
                        <Brain className="w-4 h-4 text-accent mx-auto" />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detail Panel */}
        {selectedMeeting && (
          <div className="w-full lg:w-[400px] xl:w-[440px] flex-shrink-0 animate-slide-in">
            <div className="glass-card sticky top-6 overflow-hidden">
              {/* Panel header */}
              <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border">
                <div className="flex-1 min-w-0">
                  <h3 className="font-display font-semibold text-sm truncate">{selectedMeeting.title}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={STATUS_CONFIG[selectedMeeting.status].class}>
                      {STATUS_CONFIG[selectedMeeting.status].label}
                    </span>
                    {selectedMeeting.aiAnalyzed && (
                      <span className="flex items-center gap-1 text-xs text-accent font-medium">
                        <Brain className="w-3 h-3" /> IA
                      </span>
                    )}
                    {selectedMeeting.score && (
                      <span className={cn(
                        'text-xs font-bold px-2 py-0.5 rounded-full',
                        selectedMeeting.score >= 85 ? 'bg-success/10 text-success' : selectedMeeting.score >= 70 ? 'bg-primary/10 text-primary' : 'bg-warning/10 text-warning'
                      )}>
                        {selectedMeeting.score} pts
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={() => setSelectedMeeting(null)} className="w-6 h-6 rounded-md hover:bg-muted flex items-center justify-center ml-2">
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>

              {/* Meta info */}
              <div className="px-5 py-3 border-b border-border/50">
                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <User className="w-3 h-3" />
                    <span className="font-medium text-foreground">{selectedMeeting.sellerName}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Building2 className="w-3 h-3" />
                    <span className="font-medium text-foreground">{selectedMeeting.clientName}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    {new Date(selectedMeeting.date).toLocaleDateString('pt-BR')}
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {selectedMeeting.duration} min
                  </div>
                </div>
                {selectedMeeting.meetLink && (
                  <a
                    href={selectedMeeting.meetLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-primary hover:underline mt-2"
                  >
                    <ExternalLink className="w-3 h-3" /> Abrir no Google Meet
                  </a>
                )}
              </div>

              {/* Tabs */}
              {evaluation && (
                <>
                  <div className="flex border-b border-border">
                    {[
                      { key: 'scorecard', label: 'Scorecard', icon: Target },
                      { key: 'suggestions', label: 'Sugestões IA', icon: Sparkles },
                      { key: 'transcript', label: 'Transcrição', icon: MessageSquare },
                    ].map(tab => (
                      <button
                        key={tab.key}
                        onClick={() => setDetailTab(tab.key as any)}
                        className={cn(
                          'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors border-b-2',
                          detailTab === tab.key
                            ? 'border-primary text-primary'
                            : 'border-transparent text-muted-foreground hover:text-foreground'
                        )}
                      >
                        <tab.icon className="w-3 h-3" />
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <div className="p-5 overflow-y-auto max-h-[calc(100vh-340px)] space-y-4">
                    {/* ─ Scorecard tab ─ */}
                    {detailTab === 'scorecard' && (
                      <>
                        <div className="flex items-center justify-between mb-1">
                          <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Critérios</h5>
                          <span className={cn(
                            'text-sm font-bold px-3 py-1 rounded-lg',
                            evaluation.totalScore >= 85 ? 'bg-success/10 text-success' : evaluation.totalScore >= 70 ? 'bg-primary/10 text-primary' : 'bg-warning/10 text-warning'
                          )}>
                            {evaluation.totalScore} / 100
                          </span>
                        </div>
                        <div className="space-y-3">
                          {SCORE_CRITERIA.map(c => (
                            <ScoreBar
                              key={c.key}
                              label={c.label}
                              icon={c.icon}
                              tip={c.tip}
                              value={evaluation[c.key as keyof typeof evaluation] as number}
                            />
                          ))}
                        </div>

                        {evaluation.aiSummary && (
                          <div className="pt-3 border-t border-border">
                            <div className="flex items-center gap-1.5 mb-2">
                              <Brain className="w-3.5 h-3.5 text-accent" />
                              <h5 className="text-xs font-semibold">Resumo da IA</h5>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">{evaluation.aiSummary}</p>
                          </div>
                        )}
                      </>
                    )}

                    {/* ─ Suggestions tab ─ */}
                    {detailTab === 'suggestions' && (
                      <div className="space-y-4">
                        {suggestions ? (
                          <>
                            {/* Strengths */}
                            <div>
                              <div className="flex items-center gap-1.5 mb-2.5">
                                <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                                <h5 className="text-xs font-semibold text-success">Pontos Fortes</h5>
                              </div>
                              <div className="space-y-2">
                                {suggestions.strengths.map((s, i) => (
                                  <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-success/5 border border-success/15">
                                    <span className="text-success text-[10px] font-bold mt-0.5 flex-shrink-0">✓</span>
                                    <p className="text-xs text-muted-foreground leading-relaxed">{s}</p>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Improvements */}
                            <div>
                              <div className="flex items-center gap-1.5 mb-2.5">
                                <AlertTriangle className="w-3.5 h-3.5 text-warning" />
                                <h5 className="text-xs font-semibold text-warning">Pontos de Melhoria</h5>
                              </div>
                              <div className="space-y-2">
                                {suggestions.improvements.map((s, i) => (
                                  <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-warning/5 border border-warning/15">
                                    <span className="text-warning text-[10px] font-bold mt-0.5 flex-shrink-0">!</span>
                                    <p className="text-xs text-muted-foreground leading-relaxed">{s}</p>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Next actions */}
                            <div>
                              <div className="flex items-center gap-1.5 mb-2.5">
                                <Lightbulb className="w-3.5 h-3.5 text-accent" />
                                <h5 className="text-xs font-semibold text-accent">Ações Recomendadas</h5>
                              </div>
                              <div className="space-y-2">
                                {suggestions.actions.map((a, i) => (
                                  <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-accent/5 border border-accent/15">
                                    <span className="text-accent text-[10px] font-bold mt-0.5 flex-shrink-0">{i + 1}.</span>
                                    <p className="text-xs text-muted-foreground leading-relaxed">{a}</p>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {evaluation.aiInsights && (
                              <div className="p-3 rounded-lg bg-primary/8 border border-primary/20">
                                <div className="flex items-center gap-1.5 mb-1">
                                  <Sparkles className="w-3 h-3 text-primary" />
                                  <span className="text-[10px] font-semibold text-primary uppercase tracking-wide">Insight</span>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed">{evaluation.aiInsights}</p>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                            <Brain className="w-10 h-10 mb-3 opacity-20" />
                            <p className="text-xs text-center">Nenhuma sugestão gerada ainda.<br />Execute a análise com IA para ver os insights.</p>
                            <Button size="sm" className="mt-4 bg-gradient-primary text-xs h-8">
                              <Brain className="w-3.5 h-3.5 mr-1.5" /> Analisar com IA
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ─ Transcript tab ─ */}
                    {detailTab === 'transcript' && (
                      <div className="space-y-3">
                        <div className="p-3 rounded-lg bg-muted/50 border border-border text-center">
                          <MessageSquare className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                          <p className="text-xs text-muted-foreground">
                            A transcrição será sincronizada automaticamente após análise do Google Meet / gravação.
                          </p>
                        </div>
                        {/* Mock transcript excerpt */}
                        {selectedMeeting.aiAnalyzed && (
                          <div className="space-y-2.5">
                            {[
                              { speaker: selectedMeeting.sellerName, time: '00:00', text: 'Olá! Obrigado pelo seu tempo hoje. Vou começar fazendo algumas perguntas sobre o seu cenário atual...' },
                              { speaker: selectedMeeting.clientName, time: '00:42', text: 'Claro! Atualmente usamos planilhas para gestão de vendas, mas está ficando inviável com o crescimento do time.' },
                              { speaker: selectedMeeting.sellerName, time: '01:10', text: 'Entendo. E qual é o principal gargalo que você sente hoje nesse processo?' },
                              { speaker: selectedMeeting.clientName, time: '01:25', text: 'Falta de visibilidade. Meu gestor não sabe quem está fazendo o quê sem pedir relatório manual.' },
                            ].map((line, i) => (
                              <div key={i} className={cn('flex gap-2.5', line.speaker === selectedMeeting.sellerName ? 'flex-row' : 'flex-row-reverse')}>
                                <div className="w-6 h-6 rounded-full bg-secondary border border-border flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                                  {line.speaker[0]}
                                </div>
                                <div className={cn(
                                  'flex-1 max-w-[85%] p-2.5 rounded-xl text-xs',
                                  line.speaker === selectedMeeting.sellerName
                                    ? 'bg-primary/8 border border-primary/15 rounded-tl-sm'
                                    : 'bg-secondary border border-border rounded-tr-sm'
                                )}>
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <span className="font-semibold text-[10px]">{line.speaker}</span>
                                    <span className="text-[10px] text-muted-foreground">{line.time}</span>
                                  </div>
                                  <p className="text-muted-foreground leading-relaxed">{line.text}</p>
                                </div>
                              </div>
                            ))}
                            <p className="text-center text-[10px] text-muted-foreground pt-2">... transcrição completa disponível após integração com backend</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}

              {!evaluation && selectedMeeting.status === 'completed' && (
                <div className="p-5 flex flex-col items-center gap-3 text-muted-foreground">
                  <Brain className="w-10 h-10 opacity-20" />
                  <p className="text-sm text-center">Esta reunião ainda não foi avaliada.</p>
                  <Button size="sm" className="w-full text-xs bg-gradient-primary">
                    <Brain className="w-3.5 h-3.5 mr-1.5" />
                    Analisar com IA
                  </Button>
                </div>
              )}

              {selectedMeeting.status === 'scheduled' && (
                <div className="p-5 flex flex-col items-center gap-3 text-muted-foreground">
                  <Calendar className="w-10 h-10 opacity-20" />
                  <p className="text-sm text-center">Reunião agendada para {new Date(selectedMeeting.date).toLocaleDateString('pt-BR')}.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
