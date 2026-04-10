import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Video, Search, Brain, Clock, Calendar,
  User, Building2, ExternalLink, Sparkles, X,
  TrendingUp, TrendingDown, Lightbulb, AlertTriangle,
  CheckCircle2, Target, MessageSquare, RefreshCw, Loader2, Users, Key, Heart, Trash2,
  Plus, Upload, FileText, ClipboardCheck, Pencil, ChevronDown,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { getOrg } from '@/lib/saas';
import { CONFIG } from '@/lib/config';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useAppConfig } from '@/contexts/AppConfigContext';
import { useToast } from '@/hooks/use-toast';
import {
  loadMeetingsFromDb, clearAllMeetings, ensureInternalParticipantsRegistered, fetchTranscriptInfo, resolveMeetingTranscript,
  type DbMeeting, type TranscriptInfo
} from '@/lib/meetingsService';
import { loadAllEvaluationsForEntity, parseTranscriptParticipation, type StoredEvaluation } from '@/lib/evaluationService';
import { evaluateMeetingMultiAgent } from '@/lib/multiAgentEvaluation';
import { supabase } from '@/integrations/supabase/client';

const STATUS_CONFIG: Record<string, { label: string; class: string }> = {
  concluida: { label: 'Concluída', class: 'score-good' },
  agendada: { label: 'Agendada', class: 'score-excellent' },
  cancelada: { label: 'Cancelada', class: 'score-poor' },
  no_show: { label: 'No-show', class: 'score-average' },
};

const SCORE_CRITERIA = [
  { key: 'rapport', label: 'Rapport', icon: '🤝', tip: 'Conexão emocional e abertura do cliente' },
  { key: 'discovery', label: 'Descoberta', icon: '🔍', tip: 'Qualidade das perguntas de qualificação' },
  { key: 'presentation', label: 'Apresentação', icon: '💡', tip: 'Clareza e impacto da proposta de valor' },
  { key: 'objections', label: 'Objeções', icon: '🛡️', tip: 'Tratamento de resistências do cliente' },
  { key: 'nextSteps', label: 'Próximos Passos', icon: '📅', tip: 'Clareza e comprometimento do fechamento' },
];

const TRANSCRIPT_PLACEHOLDER_RE = /^\[Transcrição no Drive:\s*(?:ID-)?([A-Za-z0-9_-]+)\]$/i;

function isTranscriptPlaceholder(text: string | null | undefined): boolean {
  return TRANSCRIPT_PLACEHOLDER_RE.test(String(text || '').trim());
}


function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTranscriptParticipantNames(transcricao: string | null | undefined): string[] {
  if (!transcricao) return [];

  const match = transcricao.match(/(?:^|\n)\s*Participantes\s*\n([^\n]+)/i);
  if (!match?.[1]) return [];

  const names = match[1]
    .split(/[;,]/)
    .map((name) => name.trim())
    .filter(Boolean);

  return Array.from(new Set(names));
}

function findEmailByParticipantName(
  participantName: string,
  participants: { email: string; name?: string }[],
): string | null {
  const target = normalizeName(participantName);
  if (!target) return null;

  const targetTokens = target.split(' ').filter((t) => t.length >= 3);

  for (const participant of participants) {
    const candidateName = normalizeName(participant.name || participant.email.split('@')[0].replace(/[._-]/g, ' '));
    const candidateTokens = candidateName.split(' ').filter((t) => t.length >= 3);

    const tokenMatch = targetTokens.some((token) => candidateTokens.includes(token));
    if (candidateName === target || tokenMatch) {
      return participant.email;
    }
  }

  return null;
}


function ScoreBar({ value, label, icon, tip }: { value: number; label: string; icon: string; tip: string }) {
  const color = value >= 85
    ? 'hsl(168 80% 42%)'
    : value >= 70
    ? 'hsl(210 100% 56%)'
    : value >= 60
    ? 'hsl(38 92% 50%)'
    : 'hsl(0 72% 51%)';

  const delta = value - 75;
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

// ─── Manual Meeting Upload Modal ────────────────────────────────────────────
function ManualMeetingModal({
  open, onClose, onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [emails, setEmails] = useState('');
  const [titulo, setTitulo] = useState('');
  const [dataReuniao, setDataReuniao] = useState(new Date().toISOString().split('T')[0]);
  const [descricao, setDescricao] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
    e.target.value = '';
  };

  const handleSave = async () => {
    if (!emails.trim()) return toast({ variant: 'destructive', title: 'Informe ao menos um e-mail.' });
    if (!titulo.trim()) return toast({ variant: 'destructive', title: 'Informe o título/descritivo.' });
    if (!file && !descricao.trim()) return toast({ variant: 'destructive', title: 'Envie um arquivo ou escreva a transcrição.' });

    setSaving(true);
    try {
      const org = await getOrg();

      // Extract text from file
      let transcricao = descricao.trim();
      let arquivoOriginal: string | null = null;

      if (file) {
        arquivoOriginal = file.name;
        if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
          transcricao = await file.text();
        } else {
          // PDF, DOCX etc — não são texto puro, usar campo de transcrição
          if (!descricao.trim()) {
            toast({ variant: 'destructive', title: 'Arquivo não suportado para extração automática', description: 'Cole o conteúdo da transcrição no campo de texto.' });
            setSaving(false);
            return;
          }
          transcricao = descricao.trim();
        }
      }

      // Sanitize: remove problematic Unicode characters
      transcricao = transcricao.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

      // Parse emails
      const emailList = emails.split(/[,;\n]/).map(e => e.trim().toLowerCase()).filter(Boolean);
      const participantes = emailList.map(e => ({ email: e, name: e.split('@')[0] }));

      // Resolve vendedor from first email
      let vendedorId: string | null = null;
      if (emailList.length > 0) {
        const { data: vendedor } = await (supabase as any)
          .schema('core')
          .from('usuarios')
          .select('id')
          .eq('org', org)
          .eq('email', emailList[0])
          .maybeSingle();
        vendedorId = vendedor?.id || null;
      }

      // Extract duration from transcription
      let duracao = 0;
      const dMatch = transcricao.match(/terminou depois de (\d{1,2}):(\d{2}):(\d{2})/i);
      if (dMatch) {
        duracao = Math.round(parseInt(dMatch[1]) * 60 + parseInt(dMatch[2]) + parseInt(dMatch[3]) / 60);
      }

      // Insert meeting
      const { data: reuniao, error: insertErr } = await (supabase as any)
        .schema('channels')
        .from('reunioes')
        .insert({
          empresa_id: org,
          titulo: titulo.trim(),
          data_reuniao: new Date(dataReuniao + 'T12:00:00').toISOString(),
          duracao_minutos: duracao,
          status: 'concluida',
          transcricao: transcricao || null,
          participantes,
          vendedor_id: vendedorId,
          auditoria_manual: true,
          arquivo_original: arquivoOriginal,
        })
        .select('id')
        .single();

      if (insertErr) throw insertErr;

      toast({ title: 'Reunião criada!', description: 'A avaliação automática será processada em breve.' });

      // Enqueue for automatic evaluation (trigger should handle it, but force it)
      if (transcricao && transcricao.length > 50) {
        await (supabase as any)
          .schema('ai')
          .from('fila_avaliacoes')
          .insert({ empresa_id: org, reuniao_id: reuniao.id, status: 'pendente' })
          .then(() => {})
          .catch(() => {});
      }

      setEmails(''); setTitulo(''); setDataReuniao(new Date().toISOString().split('T')[0]); setDescricao(''); setFile(null);
      onCreated();
      onClose();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao criar reunião', description: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg bg-card border-border max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-sm flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-primary" /> Nova Reunião Manual
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-warning/10 text-warning border border-warning/20 font-medium ml-auto">
              Auditoria
            </span>
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-4 pt-2">
          {/* Emails */}
          <div>
            <label className="text-xs font-medium block mb-1">E-mails dos participantes *</label>
            <Textarea value={emails} onChange={e => setEmails(e.target.value)}
              placeholder="vendedor@empresa.com, cliente@empresa.com (separados por vírgula)"
              className="text-xs bg-secondary border-border min-h-[60px] resize-none" />
            <p className="text-[10px] text-muted-foreground mt-0.5">O primeiro e-mail será o vendedor responsável</p>
          </div>

          {/* Title + Date */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-medium block mb-1">Título / Descritivo *</label>
              <Input value={titulo} onChange={e => setTitulo(e.target.value)}
                placeholder="Ex: Apresentação de proposta — Cliente XPTO"
                className="h-9 text-sm bg-secondary border-border" />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Data *</label>
              <Input type="date" value={dataReuniao} onChange={e => setDataReuniao(e.target.value)}
                className="h-9 text-sm bg-secondary border-border" />
            </div>
          </div>

          {/* File upload */}
          <div>
            <label className="text-xs font-medium block mb-1.5">
              <Upload className="w-3 h-3 inline mr-1" /> Arquivo de transcrição
            </label>
            <label className={cn(
              'flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed cursor-pointer transition-colors',
              file ? 'border-primary/50 bg-primary/5' : 'border-border hover:border-primary/30 hover:bg-primary/5'
            )}>
              {file ? (
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  <span className="text-xs font-medium">{file.name}</span>
                  <span className="text-[10px] text-muted-foreground">({(file.size / 1024).toFixed(0)}KB)</span>
                  <button onClick={(e) => { e.preventDefault(); setFile(null); }} className="ml-2">
                    <X className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Clique para enviar .txt ou .pdf</span>
                </>
              )}
              <input type="file" className="hidden" accept=".txt,.pdf,.doc,.docx" onChange={handleFileChange} />
            </label>
          </div>

          {/* Transcription field — always if no file, or if file is not .txt */}
          {(!file || (file && !file.name.endsWith('.txt'))) && (
            <div>
              <label className="text-xs font-medium block mb-1">
                {file ? 'Cole a transcrição do documento *' : 'Transcrição *'}
              </label>
              {file && !file.name.endsWith('.txt') && (
                <p className="text-[10px] text-warning mb-1">Arquivos .docx/.pdf precisam ter o texto colado manualmente.</p>
              )}
              <Textarea value={descricao} onChange={e => setDescricao(e.target.value)}
                placeholder="Cole a transcrição da reunião aqui..."
                className="text-xs bg-secondary border-border min-h-[120px] resize-y" />
            </div>
          )}

          {/* Save */}
          <Button className="w-full h-10" onClick={handleSave} disabled={saving}>
            {saving
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...</>
              : <><ClipboardCheck className="w-4 h-4 mr-2" /> Criar reunião e avaliar</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function MeetingsPage() {
  const { user, hasMinRole } = useAuth();
  const { tokens } = useAppConfig();
  const { toast } = useToast();

  const [meetings, setMeetings] = useState<DbMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [evalProgress, setEvalProgress] = useState({ current: 0, total: 0 });
  const [evalCancelled, setEvalCancelled] = useState(false);
  const [search, setSearch] = useState('');
  const [transcFilter, setTranscFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [scoreFilter, setScoreFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [emailSearch, setEmailSearch] = useState('');
  const [showManualMeeting, setShowManualMeeting] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<DbMeeting | null>(null);
  const [detailTab, setDetailTab] = useState<'info' | 'transcript' | 'participants' | 'comments'>('info');
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentsLoaded, setCommentsLoaded] = useState<string | null>(null);

  const channels = () => (supabase as any).schema('channels');

  const loadComments = async (meetingId: string) => {
    setLoadingComments(true);
    try {
      const org = await getOrg();
      const { data } = await channels().from('comentarios_reuniao').select('*').eq('reuniao_id', meetingId).eq('empresa_id', org).order('criado_em', { ascending: false });
      setComments(data || []);
      setCommentsLoaded(meetingId);
    } catch { setComments([]); }
    finally { setLoadingComments(false); }
  };

  const addComment = async () => {
    if (!newComment.trim() || !selectedMeeting) return;
    try {
      const org = await getOrg();
      await channels().from('comentarios_reuniao').insert({
        empresa_id: org, reuniao_id: selectedMeeting.id,
        autor_nome: user?.name || 'Anônimo', conteudo: newComment.trim(),
      });
      setNewComment('');
      loadComments(selectedMeeting.id);
    } catch { /* ignore */ }
  };

  const deleteComment = async (id: string) => {
    const org = await getOrg();
    await channels().from('comentarios_reuniao').delete().eq('id', id).eq('empresa_id', org);
    if (selectedMeeting) loadComments(selectedMeeting.id);
  };

  const saveEditComment = async (id: string) => {
    if (!editCommentText.trim()) return;
    const org = await getOrg();
    await channels().from('comentarios_reuniao').update({ conteudo: editCommentText.trim(), atualizado_em: new Date().toISOString() }).eq('id', id).eq('empresa_id', org);
    setEditingCommentId(null);
    if (selectedMeeting) loadComments(selectedMeeting.id);
  };
  const [allEvals, setAllEvals] = useState<(StoredEvaluation & { payload?: any })[]>([]);
  const [selectedEvalIdx, setSelectedEvalIdx] = useState(0);
  const meetingEval = allEvals[selectedEvalIdx] || null;
  const [reEvaluating, setReEvaluating] = useState(false);
  const [transcriptInfo, setTranscriptInfo] = useState<TranscriptInfo | null>(null);
  const [hydratingTranscript, setHydratingTranscript] = useState(false);

  const loadMeetings = useCallback(async () => {
    try {
      const data = await loadMeetingsFromDb();
      setMeetings(data);
      // Auto-create missing internal users in background
      ensureInternalParticipantsRegistered(data).then(created => {
        if (created.length > 0) {
          console.log(`[meetings] Auto-created ${created.length} internal users:`, created);
        }
      }).catch(e => console.warn('[meetings] Auto-create check failed:', e));
    } catch (err) {
      console.error('Failed to load meetings:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadMeetings(); }, [loadMeetings]);

  useEffect(() => {
    const timer = setInterval(() => {
      loadMeetings().catch((err) => console.warn('[meetings] auto refresh failed:', err));
    }, 60_000);

    return () => clearInterval(timer);
  }, [loadMeetings]);

  // Load all evaluations when meeting is selected (multi-agent support)
  useEffect(() => {
    if (selectedMeeting?.analisada_por_ia) {
      loadAllEvaluationsForEntity(selectedMeeting.id).then(evals => {
        setAllEvals(evals);
        // Default to first eval (primary/Sandler)
        const sandlerIdx = evals.findIndex(e =>
          (e as any).tipo_reuniao_detectado?.toLowerCase().includes('sandler')
        );
        setSelectedEvalIdx(sandlerIdx >= 0 ? sandlerIdx : 0);
      }).catch(() => {
        setAllEvals([]);
        setSelectedEvalIdx(0);
      });
    } else {
      setAllEvals([]);
      setSelectedEvalIdx(0);
    }
  }, [selectedMeeting?.id, selectedMeeting?.analisada_por_ia]);

  // Load transcript info from meet_conferences when meeting is selected
  useEffect(() => {
    if (selectedMeeting?.google_event_id) {
      setTranscriptInfo(null);
      fetchTranscriptInfo(selectedMeeting.google_event_id)
        .then(setTranscriptInfo)
        .catch(() => setTranscriptInfo(null));
    } else {
      setTranscriptInfo(null);
    }
  }, [selectedMeeting?.id, selectedMeeting?.google_event_id]);

  useEffect(() => {
    if (!selectedMeeting?.id || !selectedMeeting.google_event_id) return;
    if (!isTranscriptPlaceholder(selectedMeeting.transcricao)) return;

    let cancelled = false;
    setHydratingTranscript(true);

    resolveMeetingTranscript(selectedMeeting.id, selectedMeeting.google_event_id)
      .then((resolved) => {
        if (cancelled || !resolved) return;

        setMeetings(prev => prev.map(m =>
          m.id === selectedMeeting.id
            ? { ...m, transcricao: resolved.transcricao, transcript_file_id: resolved.transcript_file_id }
            : m
        ));

        setSelectedMeeting(prev =>
          prev && prev.id === selectedMeeting.id
            ? { ...prev, transcricao: resolved.transcricao, transcript_file_id: resolved.transcript_file_id }
            : prev
        );
      })
      .catch((err) => {
        console.warn('[meetings] Failed to resolve placeholder transcript:', err);
      })
      .finally(() => {
        if (!cancelled) setHydratingTranscript(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedMeeting?.id, selectedMeeting?.google_event_id, selectedMeeting?.transcricao]);


  const handleClearAll = async () => {
    if (!confirm('Tem certeza que deseja apagar TODAS as reuniões e análises IA? Essa ação não pode ser desfeita.')) return;
    setSyncing(true);
    try {
      await clearAllMeetings();
      setMeetings([]);
      setSelectedMeeting(null);
      toast({ title: 'Reuniões removidas', description: 'Todas as reuniões e análises foram apagadas.' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro ao limpar', description: err.message });
    } finally {
      setSyncing(false);
    }
  };

  const cancelEvalRef = { current: false };

  const runBatchEvaluation = async (targetMeetings: DbMeeting[], label: string) => {
    const token = tokens.meetings;
    if (!token?.startsWith('sk-')) {
      toast({ variant: 'destructive', title: 'Token não configurado', description: 'Configure o token de Reuniões em Admin → Tokens OpenAI.' });
      return;
    }
    if (targetMeetings.length === 0) {
      toast({ title: 'Nada para avaliar', description: `Nenhuma reunião encontrada para ${label}.` });
      return;
    }
    setEvaluating(true);
    setEvalCancelled(false);
    cancelEvalRef.current = false;
    setEvalProgress({ current: 0, total: targetMeetings.length });
    let ok = 0, fail = 0;
    for (const m of targetMeetings) {
      if (cancelEvalRef.current) break;
      setEvalProgress({ current: ok + fail + 1, total: targetMeetings.length });
      try {
        const emails = m.participantes?.map(p => p.email) || [];
        const multiResult = await evaluateMeetingMultiAgent(token, m.id, m.titulo, m.transcricao!, m.vendedor_id || null, emails);
        if (!multiResult) throw new Error('Avaliação retornou null');
        ok++;
      } catch (err) {
        console.warn(`[eval] Failed ${m.id}:`, err);
        fail++;
      }
    }
    await loadMeetings();
    setEvaluating(false);
    setEvalProgress({ current: 0, total: 0 });
    if (cancelEvalRef.current) {
      toast({ title: 'Avaliação cancelada', description: `${ok} avaliadas antes do cancelamento.` });
    } else {
      toast({ title: `${label} concluída`, description: `${ok} avaliadas, ${fail} falharam de ${targetMeetings.length} total.` });
    }
  };

  const handleEvaluateAll = () => {
    // Include: not analyzed OR analyzed with score 0 (likely failed evaluation)
    const concluded = visibleMeetings.filter(m => m.status === 'concluida' && (!m.analisada_por_ia || m.score === 0 || m.score === null));
    const withTranscript = concluded.filter(m => m.transcricao);
    const withoutTranscript = concluded.length - withTranscript.length;

    if (concluded.length > 0 && withTranscript.length === 0) {
      toast({ title: 'Sem transcrição', description: `${withoutTranscript} reunião(ões) concluída(s) sem transcrição. A transcrição é necessária para avaliar.` });
      return;
    }
    if (withoutTranscript > 0) {
      toast({ title: `${withoutTranscript} reunião(ões) sem transcrição serão ignoradas` });
    }
    runBatchEvaluation(withTranscript, 'Avaliação');
  };

  const handleCancelEval = () => {
    cancelEvalRef.current = true;
    setEvalCancelled(true);
  };

  const handleReEvaluate = async (meeting: DbMeeting) => {
    const token = tokens.meetings;
    if (!token?.startsWith('sk-') || !meeting.transcricao) return;
    setReEvaluating(true);
    try {
      const emails = meeting.participantes?.map(p => p.email) || [];
      const multiResult = await evaluateMeetingMultiAgent(token, meeting.id, meeting.titulo, meeting.transcricao, meeting.vendedor_id || null, emails);
      const score = multiResult ? Math.round(multiResult.primaryResult.totalScore) : null;
      await loadMeetings();
      // Reload all evaluations for multi-agent selector
      const evals = await loadAllEvaluationsForEntity(meeting.id);
      setAllEvals(evals);
      const sandlerIdx = evals.findIndex(e =>
        (e as any).tipo_reuniao_detectado?.toLowerCase().includes('sandler')
      );
      setSelectedEvalIdx(sandlerIdx >= 0 ? sandlerIdx : 0);
      setSelectedMeeting(prev => prev ? { ...prev, analisada_por_ia: true, score: score ?? prev.score } : null);
      toast({ title: 'Avaliação concluída', description: `Score: ${score ?? '—'}/100` });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro na avaliação', description: err.message });
    } finally {
      setReEvaluating(false);
    }
  };

  // ── Role-based visibility ─────────────────────────────────────────────────
  const visibleMeetings = useMemo(() => {
    // admin, ceo, director → see all
    if (hasMinRole('director')) return meetings;

    const userEmail = user?.email?.toLowerCase() || '';
    const role = user?.role;

    // manager, coordinator → see meetings from their area
    if (role === 'manager' || role === 'coordinator') {
      if (!user?.areaId) return meetings.filter(m => m.vendedor_email?.toLowerCase() === userEmail);
      return meetings.filter(m => m.area_id === user.areaId || m.vendedor_email?.toLowerCase() === userEmail);
    }

    // supervisor → see meetings from their team + own
    if (role === 'supervisor') {
      if (!user?.teamId) return meetings.filter(m => m.vendedor_email?.toLowerCase() === userEmail);
      return meetings.filter(m => m.time_id === user.teamId || m.vendedor_email?.toLowerCase() === userEmail);
    }

    // member (vendedor) → see only own meetings
    return meetings.filter(m => m.vendedor_email?.toLowerCase() === userEmail);
  }, [meetings, user?.email, user?.role, user?.areaId, user?.teamId, hasMinRole]);

  const filtered = visibleMeetings.filter(m => {
    const s = search.toLowerCase();
    const participantMatch = (m.participantes || []).some((p: any) =>
      (p.email || '').toLowerCase().includes(s) ||
      (p.name || '').toLowerCase().includes(s)
    );
    const matchSearch =
      m.titulo.toLowerCase().includes(s) ||
      (m.cliente_nome || '').toLowerCase().includes(s) ||
      (m.vendedor_nome || '').toLowerCase().includes(s) ||
      participantMatch;
    const matchTransc = transcFilter === 'all'
      || (transcFilter === 'com' && !!m.transcricao)
      || (transcFilter === 'sem' && !m.transcricao);
    const matchStatus = statusFilter === 'all'
      || (statusFilter === 'sem' && (!m.status || m.status === 'agendada'))
      || m.status === statusFilter;
    const matchOwner = ownerFilter === 'all' || m.vendedor_id === ownerFilter;
    const matchScore = scoreFilter === 'all'
      || (scoreFilter === 'high' && (m.score || 0) >= 70)
      || (scoreFilter === 'mid' && (m.score || 0) >= 50 && (m.score || 0) < 70)
      || (scoreFilter === 'low' && (m.score || 0) > 0 && (m.score || 0) < 50)
      || (scoreFilter === 'none' && (!m.score || m.score === 0));
    const mDate = m.data_reuniao?.split('T')[0] || '';
    const matchDate = (!dateFrom || mDate >= dateFrom) && (!dateTo || mDate <= dateTo);
    return matchSearch && matchTransc && matchStatus && matchOwner && matchScore && matchDate;
  });

  // Pagination
  const PAGE_SIZE = 20;
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginatedMeetings = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [search, transcFilter, statusFilter]);

  return (
    <div className="page-container animate-fade-in">
      <div className="flex gap-6">
        {/* Main list */}
        <div className={cn('flex-1 min-w-0', selectedMeeting && 'lg:w-1/2')}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-display font-bold">Reuniões</h1>
              <p className="text-sm text-muted-foreground">
                {loading ? 'Carregando...' : `${filtered.length} reuniões encontradas`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn(
                'flex items-center gap-1.5 text-xs border rounded-lg px-3 py-1.5',
                tokens.meetings?.startsWith('sk-')
                  ? 'border-success/30 text-success bg-success/5'
                  : 'border-warning/30 text-warning bg-warning/5'
              )}>
                <Key className="w-3 h-3" />
                {tokens.meetings?.startsWith('sk-') ? 'Token Reuniões ✓' : 'Sem token — Admin → Tokens OpenAI'}
              </span>
              {evaluating ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                  <div className="flex flex-col">
                    <span className="text-[10px] font-medium text-primary">
                      Avaliando {evalProgress.current}/{evalProgress.total}
                    </span>
                    <div className="w-20 h-1 bg-muted rounded-full overflow-hidden mt-0.5">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${evalProgress.total ? (evalProgress.current / evalProgress.total) * 100 : 0}%` }} />
                    </div>
                  </div>
                  <button onClick={handleCancelEval} className="w-5 h-5 rounded hover:bg-destructive/10 flex items-center justify-center" title="Cancelar">
                    <X className="w-3 h-3 text-destructive" />
                  </button>
                </div>
              ) : (
                <>
                  <Button
                    size="sm"
                    onClick={handleEvaluateAll}
                    disabled={syncing || loading}
                    className="text-xs h-8"
                    variant="outline"
                  >
                    <Brain className="w-3.5 h-3.5 mr-1.5" /> Avaliar Todas
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs h-8"
                    onClick={() => setShowManualMeeting(true)}>
                    <Plus className="w-3.5 h-3.5 mr-1.5" /> Nova Reunião
                  </Button>
                </>
              )}
              
              <Button
                  size="sm"
                  variant="outline"
                  onClick={handleClearAll}
                  disabled={syncing || loading || meetings.length === 0}
                  className="text-xs h-8 border-destructive/50 text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  Limpar tudo
                </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar por título, cliente, owner..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-8 text-xs bg-secondary border-border"
              />
            </div>
            {/* Uniform dropdown filters */}
            {[
              { id: 'transc', label: 'Transcrição', value: transcFilter, options: [{ key: 'all', label: 'Todas' }, { key: 'com', label: 'Com transcrição' }, { key: 'sem', label: 'Sem transcrição' }], set: setTranscFilter, activeLabel: transcFilter === 'all' ? null : transcFilter === 'com' ? 'Com transcrição' : 'Sem transcrição' },
              { id: 'status', label: 'Status', value: statusFilter, options: [{ key: 'all', label: 'Todos' }, { key: 'sem', label: 'Sem status' }, { key: 'concluida', label: 'Concluída' }, { key: 'no_show', label: 'No-show' }], set: setStatusFilter, activeLabel: statusFilter === 'all' ? null : statusFilter === 'sem' ? 'Sem status' : statusFilter === 'concluida' ? 'Concluída' : 'No-show' },
              { id: 'score', label: 'Score', value: scoreFilter, options: [{ key: 'all', label: 'Todos' }, { key: 'high', label: '70+ (Bom)' }, { key: 'mid', label: '50-69 (Regular)' }, { key: 'low', label: '1-49 (Crítico)' }, { key: 'none', label: 'Sem score' }], set: setScoreFilter, activeLabel: scoreFilter === 'all' ? null : scoreFilter === 'high' ? '70+' : scoreFilter === 'mid' ? '50-69' : scoreFilter === 'low' ? '<50' : 'Sem score' },
            ].map(f => (
              <div key={f.id} className="relative">
                <button onClick={() => setOpenFilter(openFilter === f.id ? null : f.id)}
                  className={cn('h-8 px-3 text-xs rounded-lg border transition-all flex items-center gap-1.5',
                    f.activeLabel ? 'bg-primary/15 border-primary/30 text-primary font-medium' : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted')}>
                  {f.activeLabel ? `${f.label}: ${f.activeLabel}` : f.label}
                  <ChevronDown className="w-3 h-3" />
                </button>
                {openFilter === f.id && (
                  <div className="absolute top-full left-0 mt-1 z-30 bg-card border border-border rounded-lg shadow-lg min-w-[160px] py-1">
                    {f.options.map(o => (
                      <button key={o.key} onClick={() => { f.set(o.key); setOpenFilter(null); }}
                        className={cn('w-full text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors', f.value === o.key && 'bg-muted font-medium')}>
                        {o.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Owner dropdown with search */}
            <div className="relative">
              <button onClick={() => setOpenFilter(openFilter === 'owner' ? null : 'owner')}
                className={cn('h-8 px-3 text-xs rounded-lg border transition-all flex items-center gap-1.5',
                  ownerFilter !== 'all' ? 'bg-primary/15 border-primary/30 text-primary font-medium' : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted')}>
                {ownerFilter !== 'all' ? `Owner: ${visibleMeetings.find(m => m.vendedor_id === ownerFilter)?.vendedor_nome || '...'}` : 'Owner'}
                <ChevronDown className="w-3 h-3" />
              </button>
              {openFilter === 'owner' && (
                <div className="absolute top-full left-0 mt-1 z-30 bg-card border border-border rounded-lg shadow-lg min-w-[200px] max-h-60 overflow-y-auto">
                  <div className="p-1.5 border-b border-border">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                      <input placeholder="Pesquisar..." className="w-full pl-7 h-7 text-xs border border-border rounded bg-background px-2"
                        onChange={e => { const el = e.target; el.dataset.search = e.target.value; el.parentElement?.parentElement?.parentElement?.querySelectorAll('[data-owner]').forEach((b: any) => { b.style.display = b.dataset.owner?.toLowerCase().includes(el.dataset.search?.toLowerCase() || '') ? '' : 'none'; }); }} />
                    </div>
                  </div>
                  <button onClick={() => { setOwnerFilter('all'); setOpenFilter(null); }}
                    className={cn('w-full text-left px-3 py-1.5 text-xs hover:bg-muted', ownerFilter === 'all' && 'bg-muted font-medium')}>Todos</button>
                  {[...new Map(visibleMeetings.map(m => [m.vendedor_id, m.vendedor_nome])).entries()]
                    .filter(([id]) => id)
                    .sort(([,a],[,b]) => (a || '').localeCompare(b || ''))
                    .map(([id, name]) => (
                      <button key={id} data-owner={name} onClick={() => { setOwnerFilter(id!); setOpenFilter(null); }}
                        className={cn('w-full text-left px-3 py-1.5 text-xs hover:bg-muted', ownerFilter === id && 'bg-muted font-medium')}>{name || 'Sem nome'}</button>
                    ))}
                </div>
              )}
            </div>

            {/* Date dropdown */}
            <div className="relative">
              <button onClick={() => setOpenFilter(openFilter === 'date' ? null : 'date')}
                className={cn('h-8 px-3 text-xs rounded-lg border transition-all flex items-center gap-1.5',
                  (dateFrom || dateTo) ? 'bg-primary/15 border-primary/30 text-primary font-medium' : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted')}>
                {(dateFrom || dateTo) ? `${dateFrom || '...'} a ${dateTo || '...'}` : 'Data'}
                <Calendar className="w-3 h-3" />
              </button>
              {openFilter === 'date' && (
                <div className="absolute top-full right-0 mt-1 z-30 bg-card border border-border rounded-lg shadow-lg p-3 space-y-2 min-w-[240px]">
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-1">De</label>
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                      className="w-full h-8 px-2 text-xs border border-border rounded bg-background" />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-1">Até</label>
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                      className="w-full h-8 px-2 text-xs border border-border rounded bg-background" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setDateFrom(''); setDateTo(''); setOpenFilter(null); }} className="flex-1 text-xs py-1 rounded border border-border hover:bg-muted">Limpar</button>
                    <button onClick={() => setOpenFilter(null)} className="flex-1 text-xs py-1 rounded bg-primary text-primary-foreground">Aplicar</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {loading ? (
            <div className="glass-card p-10 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Carregando reuniões...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="glass-card p-10 text-center">
              <Video className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-1">Nenhuma reunião encontrada.</p>
              <p className="text-xs text-muted-foreground">
                As reuniões são sincronizadas automaticamente.
              </p>
            </div>
          ) : (
            <div className="glass-card overflow-hidden">
              <table className="w-full data-table">
                <thead>
                  <tr>
                    <th className="text-left">Reunião</th>
                    <th className="text-left hidden md:table-cell">Owner</th>
                    <th className="text-left hidden lg:table-cell">Data</th>
                    <th className="text-center">Score</th>
                    <th className="text-center">Status</th>
                    <th className="text-center hidden lg:table-cell">Transcrição</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedMeetings.map(m => {
                    const statusCfg = STATUS_CONFIG[m.status] || { label: m.status, class: '' };
                    return (
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
                              <p className="text-sm font-medium flex items-center gap-1.5">
                                {m.titulo}
                                {m.auditoria_manual && (
                                  <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-warning/10 text-warning border border-warning/20 font-semibold">Auditoria</span>
                                )}
                              </p>
                              <p className="text-xs text-muted-foreground">{m.cliente_nome || '—'}</p>
                              {(m.meeting_code || m.google_event_id) && (
                                <p className="text-[10px] text-muted-foreground/60 font-mono">{m.meeting_code || m.google_event_id}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="hidden md:table-cell">
                          <div className="flex items-center gap-2">
                            <img
                              src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${m.vendedor_nome || 'user'}`}
                              alt={m.vendedor_nome || ''}
                              className="w-6 h-6 rounded-full border border-border"
                            />
                            <span className="text-sm">{m.vendedor_nome || '—'}</span>
                          </div>
                        </td>
                        <td className="hidden lg:table-cell">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            {new Date(m.data_reuniao).toLocaleDateString('pt-BR')}
                            <span className="ml-1 flex items-center gap-1">
                              <Clock className="w-3 h-3" />{`${m.duracao_minutos || 0}min`}
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
                          <select
                            value={m.status || ''}
                            onClick={e => e.stopPropagation()}
                            onChange={async (e) => {
                              const newStatus = e.target.value;
                              await (supabase as any).schema('channels').from('reunioes').update({ status: newStatus || null }).eq('id', m.id);
                              await loadMeetings();
                            }}
                            className={cn('text-[11px] px-2 py-0.5 rounded-full border font-medium bg-transparent cursor-pointer appearance-none text-center',
                              m.status ? (STATUS_CONFIG[m.status]?.class || '') : 'text-muted-foreground border-border'
                            )}
                          >
                            <option value="">—</option>
                            <option value="concluida">Concluída</option>
                            <option value="no_show">No-show</option>
                          </select>
                        </td>
                        <td className="text-center hidden lg:table-cell">
                          {m.transcricao ? (
                            <MessageSquare className="w-4 h-4 text-accent mx-auto" />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-muted-foreground">
                {filtered.length} reuniões · Página {currentPage} de {totalPages}
              </p>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="outline" className="h-7 text-xs px-2"
                  disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>
                  Anterior
                </Button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  let page: number;
                  if (totalPages <= 7) {
                    page = i + 1;
                  } else if (currentPage <= 4) {
                    page = i + 1;
                  } else if (currentPage >= totalPages - 3) {
                    page = totalPages - 6 + i;
                  } else {
                    page = currentPage - 3 + i;
                  }
                  return (
                    <button key={page} onClick={() => setCurrentPage(page)}
                      className={cn('w-7 h-7 rounded text-xs font-medium transition-colors',
                        currentPage === page ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}>
                      {page}
                    </button>
                  );
                })}
                <Button size="sm" variant="outline" className="h-7 text-xs px-2"
                  disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selectedMeeting && (
          <div className="w-full lg:w-[400px] xl:w-[440px] flex-shrink-0 animate-slide-in">
            <div className="glass-card sticky top-6 overflow-hidden">
              {/* Panel header */}
              <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border">
                <div className="flex-1 min-w-0">
                  <h3 className="font-display font-semibold text-sm truncate">{selectedMeeting.titulo}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={(STATUS_CONFIG[selectedMeeting.status] || {}).class || ''}>
                      {(STATUS_CONFIG[selectedMeeting.status] || {}).label || selectedMeeting.status}
                    </span>
                    {selectedMeeting.analisada_por_ia && (
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
                    {(selectedMeeting as any).sentimento && (
                      <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1',
                        (selectedMeeting as any).sentimento === 'Positivo' ? 'bg-emerald-500/10 text-emerald-400' :
                        (selectedMeeting as any).sentimento === 'Negativo' ? 'bg-red-500/10 text-red-400' :
                        (selectedMeeting as any).sentimento === 'Preocupado' ? 'bg-amber-500/10 text-amber-400' :
                        (selectedMeeting as any).sentimento === 'Frustrado' ? 'bg-orange-500/10 text-orange-400' :
                        'bg-slate-500/10 text-slate-400'
                      )}>
                        <Heart className="w-2.5 h-2.5" /> {(selectedMeeting as any).sentimento}
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
                    <span className="font-medium text-foreground">{selectedMeeting.vendedor_nome || '—'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Building2 className="w-3 h-3" />
                    <span className="font-medium text-foreground">{selectedMeeting.cliente_nome || '—'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    {new Date(selectedMeeting.data_reuniao).toLocaleDateString('pt-BR')}
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {`${selectedMeeting.duracao_minutos || 0} min`}
                  </div>
                </div>
                {selectedMeeting.link_meet && (
                  <a
                    href={selectedMeeting.link_meet}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-primary hover:underline mt-2"
                  >
                    <ExternalLink className="w-3 h-3" /> Abrir no Google Meet
                  </a>
                )}
              </div>

              {/* Tabs */}
              <div className="flex border-b border-border">
                {[
                  { key: 'info', label: 'Detalhes', icon: Target },
                  { key: 'transcript', label: 'Transcrição', icon: MessageSquare },
                  { key: 'participants', label: 'Participantes', icon: Users },
                  { key: 'comments', label: 'Comentários', icon: MessageSquare },
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
                {/* ─ Info tab ─ */}
                {detailTab === 'info' && (
                  <div className="space-y-3">
                    {selectedMeeting.cliente_email && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">Email cliente:</span>
                        <span className="font-medium">{selectedMeeting.cliente_email}</span>
                      </div>
                    )}
                    {selectedMeeting.vendedor_email && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">Owner:</span>
                        <span className="font-medium">{selectedMeeting.vendedor_email}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">Participantes externos:</span>
                      <span className="font-medium">
                        {selectedMeeting.participantes.filter(p => !p.email.endsWith(`@${CONFIG.GOOGLE_ALLOWED_DOMAIN}`)).length}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">Transcrição:</span>
                      <span className={cn('font-medium', selectedMeeting.transcricao ? 'text-success' : 'text-muted-foreground')}>
                        {hydratingTranscript ? 'Carregando transcrição...' : (selectedMeeting.transcricao ? 'Disponível' : 'Não disponível')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">Gravação:</span>
                      <span className={cn('font-medium', (selectedMeeting.gravacao_link || transcriptInfo?.recording_web_view_link) ? 'text-success' : 'text-muted-foreground')}>
                        {(selectedMeeting.gravacao_link || transcriptInfo?.recording_web_view_link) ? 'Disponível' : 'Não disponível'}
                      </span>
                    </div>
                    {(selectedMeeting.gravacao_link || transcriptInfo?.recording_web_view_link || transcriptInfo?.recording_web_content_link) && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">Link gravação:</span>
                        <a
                          href={selectedMeeting.gravacao_link || transcriptInfo?.recording_web_view_link || transcriptInfo?.recording_web_content_link || '#'}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary underline underline-offset-2"
                        >
                          Abrir gravação
                        </a>
                      </div>
                    )}
                    {transcriptInfo?.transcript_copied_file_id && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">File ID:</span>
                        <span className="font-mono text-[10px] text-muted-foreground">{transcriptInfo.transcript_copied_file_id}</span>
                      </div>
                    )}
                    {(transcriptInfo?.recording_copied_file_id || transcriptInfo?.recording_source_file_id) && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">Recording ID:</span>
                        <span className="font-mono text-[10px] text-muted-foreground">{transcriptInfo.recording_copied_file_id || transcriptInfo.recording_source_file_id}</span>
                      </div>
                    )}
                    {transcriptInfo?.status && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">Status:</span>
                        <span className={cn('font-medium text-[10px] px-2 py-0.5 rounded-full',
                          transcriptInfo.status.toLowerCase() === 'new' ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'
                        )}>
                          {transcriptInfo.status}
                        </span>
                      </div>
                    )}
                    {(transcriptInfo?.meeting_code || selectedMeeting.meeting_code) && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">Meeting code:</span>
                        <span className="font-mono text-[10px]">{transcriptInfo?.meeting_code || selectedMeeting.meeting_code}</span>
                      </div>
                    )}
                    {selectedMeeting.google_event_id && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">Conference key:</span>
                        <span className="font-mono text-[10px] text-muted-foreground">{selectedMeeting.google_event_id}</span>
                      </div>
                    )}

                    {/* AI Evaluation results */}
                    {selectedMeeting.analisada_por_ia && meetingEval && (
                      <div className="pt-3 border-t border-border space-y-3">
                        {/* Meeting type + Agent chain */}
                        {(meetingEval as any).tipo_reuniao_detectado && (
                          <div className="p-3 rounded-lg bg-primary/5 border border-primary/15">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-[10px] font-semibold text-primary uppercase tracking-wide flex items-center gap-1">
                                <Target className="w-3 h-3" /> Tipo da Reunião
                              </p>
                              <span className="text-xs font-bold text-primary px-2 py-0.5 rounded-full bg-primary/10">
                                {(meetingEval as any).tipo_reuniao_detectado}
                              </span>
                            </div>
                            {(meetingEval as any).chain_log?.length > 0 && (
                              <div className="space-y-1 mt-2">
                                <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide">Pipeline de agentes</p>
                                <div className="flex items-center gap-1 flex-wrap">
                                  {((meetingEval as any).chain_log as any[]).map((step: any, i: number) => (
                                    <div key={i} className="flex items-center gap-1">
                                      {i > 0 && <span className="text-muted-foreground text-[10px]">→</span>}
                                      <span className={cn(
                                        'text-[10px] px-2 py-0.5 rounded-full border font-medium',
                                        step.tipo === 'classificador' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                                        step.tipo === 'avaliador' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                        step.tipo === 'fallback' ? 'bg-warning/10 text-warning border-warning/20' :
                                        'bg-muted text-muted-foreground border-border'
                                      )}>
                                        {step.agente}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                                <div className="mt-1.5 space-y-0.5">
                                  {((meetingEval as any).chain_log as any[]).map((step: any, i: number) => (
                                    <p key={i} className="text-[9px] text-muted-foreground">
                                      <strong>{step.agente}:</strong> {step.output_resumo}
                                      {step.duracao_ms > 0 && <span className="ml-1 opacity-50">({(step.duracao_ms / 1000).toFixed(1)}s)</span>}
                                    </p>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Nível de Relacionamento (Sentiment) */}
                        {meetingEval.payload?.sentimento && (() => {
                          const sentConfig: Record<string, { color: string; bg: string; border: string }> = {
                            'Positivo': { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
                            'Neutro': { color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/20' },
                            'Negativo': { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
                            'Preocupado': { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
                            'Frustrado': { color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
                          };
                          const s = meetingEval.payload.sentimento as string;
                          const cfg = sentConfig[s] || sentConfig['Neutro'];
                          return (
                            <div className={cn('p-3 rounded-lg border', cfg.bg, cfg.border)}>
                              <div className="flex items-center justify-between mb-1.5">
                                <p className={cn('text-[10px] font-semibold uppercase tracking-wide flex items-center gap-1', cfg.color)}>
                                  <Heart className="w-3 h-3" /> Nível de Relacionamento
                                </p>
                                <span className={cn('text-xs font-bold px-2.5 py-0.5 rounded-full', cfg.bg, cfg.color, cfg.border, 'border')}>
                                  {s}
                                </span>
                              </div>
                              {meetingEval.payload.sentimentoResumo && (
                                <p className="text-xs text-muted-foreground leading-relaxed">{meetingEval.payload.sentimentoResumo}</p>
                              )}
                              {meetingEval.payload.sentimentoConfianca && (
                                <div className="mt-2 flex items-center gap-2">
                                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                    <div className={cn('h-full rounded-full', cfg.bg.replace('/10', '/60'))} style={{ width: `${meetingEval.payload.sentimentoConfianca}%` }} />
                                  </div>
                                  <span className="text-[9px] text-muted-foreground font-mono">{meetingEval.payload.sentimentoConfianca}%</span>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* Summary */}
                        {meetingEval.resumo && (
                          <div className="p-3 rounded-lg bg-muted/50 border border-border">
                            <p className="text-[10px] font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Resumo</p>
                            <p className="text-xs leading-relaxed">{meetingEval.resumo}</p>
                          </div>
                        )}

                        {/* Insights */}
                        {meetingEval.payload?.insights && (
                          <div className="p-3 rounded-lg bg-accent/5 border border-accent/15">
                            <p className="text-[10px] font-semibold text-accent mb-1 uppercase tracking-wide flex items-center gap-1">
                              <Sparkles className="w-3 h-3" /> Insights
                            </p>
                            <p className="text-xs leading-relaxed">{meetingEval.payload.insights}</p>
                          </div>
                        )}

                        {/* Critical Alerts */}
                        {meetingEval.payload?.criticalAlerts?.length > 0 && (
                          <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/15">
                            <p className="text-[10px] font-semibold text-destructive mb-1 uppercase tracking-wide flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> Alertas Críticos
                            </p>
                            <ul className="space-y-1">
                              {meetingEval.payload.criticalAlerts.map((a: string, i: number) => (
                                <li key={i} className="text-xs flex items-start gap-1.5">
                                  <span className="text-destructive mt-0.5">›</span> {a}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Methodology selector — above criteria */}
                        {allEvals.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide text-center">Metodologia</p>
                            <div className="flex gap-1.5 flex-wrap justify-center">
                              {allEvals.map((ev, i) => (
                                <button key={ev.id} onClick={() => setSelectedEvalIdx(i)}
                                  className={cn('text-[11px] px-2.5 py-1 rounded-lg border transition-all font-medium',
                                    selectedEvalIdx === i
                                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                      : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30')}>
                                  {(ev as any).tipo_reuniao_detectado || `Avaliação ${i + 1}`}
                                  <span className={cn('ml-1.5 text-[10px] font-bold',
                                    (ev.score ?? 0) >= 80 ? 'text-success' : (ev.score ?? 0) >= 60 ? '' : 'text-warning'
                                  )}>{ev.score ?? '—'}</span>
                                </button>
                              ))}
                              {allEvals.length <= 1 && (
                                <span className="text-[10px] text-muted-foreground/50 self-center ml-1">
                                  Clique "Reavaliar" para ver mais metodologias
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Criteria breakdown */}
                        {meetingEval.criterios?.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Critérios</p>
                            {meetingEval.criterios.map((c: any) => (
                              <div key={c.id || c.label} className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-medium">{c.label}</span>
                                  <span className={cn(
                                    'text-xs font-bold',
                                    c.score >= 80 ? 'text-success' : c.score >= 60 ? 'text-primary' : 'text-warning'
                                  )}>{c.score}</span>
                                </div>
                                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full transition-all duration-500"
                                    style={{
                                      width: `${c.score}%`,
                                      background: c.score >= 80 ? 'hsl(168 80% 42%)' : c.score >= 60 ? 'hsl(210 100% 56%)' : 'hsl(38 92% 50%)',
                                    }}
                                  />
                                </div>
                                {c.feedback && (
                                  <p className="text-[10px] text-muted-foreground leading-snug">{c.feedback}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Re-evaluate button for already evaluated meetings */}
                    {selectedMeeting.analisada_por_ia && selectedMeeting.transcricao && (
                      <div className="pt-3 border-t border-border">
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full text-xs h-8 gap-1.5"
                          disabled={reEvaluating}
                          onClick={() => handleReEvaluate(selectedMeeting)}
                        >
                          {reEvaluating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                          {reEvaluating ? 'Reavaliando...' : 'Reavaliar com IA'}
                        </Button>
                      </div>
                    )}

                    {/* Not yet evaluated */}
                    {!selectedMeeting.analisada_por_ia && selectedMeeting.status === 'concluida' && (
                      <div className="pt-3 border-t border-border flex flex-col items-center gap-3 text-muted-foreground">
                        <Brain className="w-10 h-10 opacity-20" />
                        <p className="text-xs text-center">Esta reunião ainda não foi avaliada pela IA.</p>
                        {selectedMeeting.transcricao && (
                          <Button
                            size="sm"
                            className="text-xs h-8 bg-gradient-primary gap-1.5"
                            disabled={reEvaluating}
                            onClick={() => handleReEvaluate(selectedMeeting)}
                          >
                            {reEvaluating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
                            {reEvaluating ? 'Avaliando...' : 'Avaliar com IA'}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* ─ Transcript tab ─ */}
                {detailTab === 'transcript' && (
                  <div className="space-y-3">
                    {selectedMeeting.transcricao ? (
                      <div className="p-3 rounded-lg bg-muted/50 border border-border">
                        <pre className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed max-h-[60vh] overflow-y-auto">
                          {selectedMeeting.transcricao}
                        </pre>
                      </div>
                    ) : (
                      <div className="p-3 rounded-lg bg-muted/50 border border-border text-center">
                        <MessageSquare className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground">
                          Transcrição não disponível para esta reunião.
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Verifique se a transcrição automática está habilitada no Google Workspace e sincronize novamente.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* ─ Participants tab ─ */}
                {detailTab === 'participants' && (() => {
                  // Calculate participation directly from transcript (always sums to 100%)
                  const participantEmails = (selectedMeeting.participantes || []).map((p: any) => p.email).filter(Boolean);
                  const transcriptParticipation = selectedMeeting.transcricao
                    ? parseTranscriptParticipation(selectedMeeting.transcricao, participantEmails)
                    : [];

                  // Collect all unique emails from meeting
                  const allEmails = [...new Set((selectedMeeting.participantes || []).map((p: any) => p.email).filter(Boolean))] as string[];

                  const totalPct = transcriptParticipation.reduce((sum, p) => sum + p.percent, 0);

                  return (
                    <div className="space-y-3">
                      {/* Section 1: Speakers from transcript */}
                      {transcriptParticipation.length > 0 && (
                        <>
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1">
                            <span className="font-semibold uppercase tracking-wider">Participação na call</span>
                            <span className={cn('font-bold', totalPct === 100 ? 'text-success' : 'text-warning')}>Total: {totalPct}%</span>
                          </div>
                          <div className="space-y-1.5">
                            {transcriptParticipation.sort((a, b) => b.percent - a.percent).map((p, i) => (
                              <div key={i} className="flex items-center gap-2.5 p-2 rounded-lg bg-secondary border border-border">
                                <div className="w-7 h-7 rounded-full bg-muted border border-border flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                                  {(p.name || '?')[0].toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="text-xs font-medium truncate">{p.name}</p>
                                    <span className={cn('text-[10px] font-bold',
                                      p.percent >= 30 ? 'text-success' : p.percent >= 10 ? 'text-primary' : 'text-muted-foreground'
                                    )}>{p.percent}%</span>
                                  </div>
                                  <div className="h-1 bg-muted rounded-full overflow-hidden mt-1">
                                    <div className="h-full rounded-full transition-all"
                                      style={{ width: `${Math.min(p.percent, 100)}%`, background: p.percent >= 30 ? 'hsl(168 80% 42%)' : p.percent >= 10 ? 'hsl(210 100% 56%)' : 'hsl(var(--muted-foreground))' }} />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}

                      {transcriptParticipation.length === 0 && (
                        <div className="p-3 rounded-lg bg-muted/50 border border-border text-center">
                          <Users className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                          <p className="text-xs text-muted-foreground">Sem transcrição para calcular participação.</p>
                        </div>
                      )}
                      {transcriptParticipation.length === 0 && selectedMeeting.transcricao && (
                        <p className="text-[10px] text-muted-foreground text-center pt-2">
                          Não foi possível extrair participação da transcrição. Verifique o formato.
                        </p>
                      )}

                      {/* Section 2: All emails as cards, internal first */}
                      {allEmails.length > 0 && (
                        <div className="border-t border-border pt-3 mt-3">
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">E-mails da reunião ({allEmails.length})</p>
                          <div className="space-y-1.5">
                            {allEmails
                              .sort((a, b) => {
                                const aExt = !a.endsWith(`@${CONFIG.GOOGLE_ALLOWED_DOMAIN}`) ? 1 : 0;
                                const bExt = !b.endsWith(`@${CONFIG.GOOGLE_ALLOWED_DOMAIN}`) ? 1 : 0;
                                return aExt - bExt || a.localeCompare(b);
                              })
                              .map(email => {
                                const isExternal = !email.endsWith(`@${CONFIG.GOOGLE_ALLOWED_DOMAIN}`);
                                return (
                                  <div key={email} className={cn('flex items-center gap-2.5 p-2 rounded-lg border', isExternal ? 'bg-accent/5 border-accent/15' : 'bg-secondary border-border')}>
                                    <div className="w-6 h-6 rounded-full bg-muted border border-border flex items-center justify-center text-[9px] font-bold flex-shrink-0">
                                      {email[0].toUpperCase()}
                                    </div>
                                    <p className="text-[10px] text-muted-foreground truncate flex-1">{email}</p>
                                    {isExternal && <span className="text-[9px] font-medium text-accent bg-accent/10 px-1.5 py-0.5 rounded flex-shrink-0">Externo</span>}
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Comments tab */}
                {detailTab === 'comments' && (() => {
                  // Load comments when tab opens (only once per meeting)
                  if (commentsLoaded !== selectedMeeting?.id && !loadingComments && selectedMeeting) {
                    loadComments(selectedMeeting.id);
                  }
                  return (
                    <div className="space-y-3">
                      {/* Add comment */}
                      <div className="flex gap-2">
                        <input
                          value={newComment}
                          onChange={e => setNewComment(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && addComment()}
                          placeholder="Adicionar comentário..."
                          className="flex-1 h-9 px-3 text-xs border border-border rounded-lg bg-background focus:outline-none focus:border-primary/50"
                        />
                        <button onClick={addComment} disabled={!newComment.trim()} className="px-3 h-9 text-xs font-medium bg-primary text-primary-foreground rounded-lg disabled:opacity-50">
                          Enviar
                        </button>
                      </div>

                      {loadingComments ? (
                        <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
                      ) : comments.length === 0 ? (
                        <div className="text-center py-6 text-muted-foreground">
                          <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-20" />
                          <p className="text-xs">Nenhum comentário</p>
                        </div>
                      ) : (
                        comments.map(c => (
                          <div key={c.id} className="p-3 rounded-lg border border-border bg-muted/20 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                                  {(c.autor_nome || '?')[0].toUpperCase()}
                                </div>
                                <span className="text-xs font-medium">{c.autor_nome}</span>
                                <span className="text-[10px] text-muted-foreground">
                                  {new Date(c.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                  {c.atualizado_em !== c.criado_em && ' (editado)'}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <button onClick={() => { setEditingCommentId(c.id); setEditCommentText(c.conteudo); }} className="text-muted-foreground hover:text-foreground">
                                  <Pencil className="w-3 h-3" />
                                </button>
                                <button onClick={() => deleteComment(c.id)} className="text-muted-foreground hover:text-destructive">
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                            {editingCommentId === c.id ? (
                              <div className="flex gap-2">
                                <input value={editCommentText} onChange={e => setEditCommentText(e.target.value)}
                                  onKeyDown={e => e.key === 'Enter' && saveEditComment(c.id)}
                                  className="flex-1 h-8 px-2 text-xs border border-border rounded bg-background" autoFocus />
                                <button onClick={() => saveEditComment(c.id)} className="text-xs text-primary hover:underline">Salvar</button>
                                <button onClick={() => setEditingCommentId(null)} className="text-xs text-muted-foreground">Cancelar</button>
                              </div>
                            ) : (
                              <p className="text-xs text-foreground whitespace-pre-wrap">{c.conteudo}</p>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Manual meeting modal */}
      <ManualMeetingModal
        open={showManualMeeting}
        onClose={() => setShowManualMeeting(false)}
        onCreated={loadMeetings}
      />
    </div>
  );
}
