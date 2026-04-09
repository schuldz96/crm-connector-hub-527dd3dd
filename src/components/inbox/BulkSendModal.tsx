/**
 * BulkSendModal — Envio em lote de templates WhatsApp via CSV
 *
 * Fluxo:
 * 1. Upload CSV → preview das colunas
 * 2. Selecionar template → mapear colunas aos parâmetros
 * 3. Selecionar template alternativo (fallback para erros)
 * 4. Processar 1 msg/2s com relatório em tempo real
 * 5. Estado persistido no localStorage (não perde ao fechar)
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Upload, FileText, Send, Loader2, CheckCircle2, XCircle, Clock,
  AlertTriangle, LayoutTemplate, Play, Pause, RotateCcw, X, Eye,
  CheckCheck, ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { sendTemplateMessage, normalizePhone } from '@/lib/metaInboxService';
import { supabase } from '@/integrations/supabase/client';
import { getOrg } from '@/lib/saas';
import type { MetaInboxAccount } from '@/pages/InboxPage';

const STORAGE_KEY = 'bulk_send_state';
const INTERVAL_MS = 2000; // 2 seconds between messages

// ─── Types ───────────────────────────────────────────────
interface CsvRow { [key: string]: string }

type RowStatus = 'pending' | 'sending' | 'sent' | 'delivered' | 'read' | 'failed' | 'fallback_sent' | 'fallback_failed';

interface ProcessedRow {
  index: number;
  phone: string;
  params: string[];
  status: RowStatus;
  templateUsed?: string; // which template was actually sent
  wamid?: string;
  error?: string;
  sentAt?: string;
}

interface BulkSendState {
  step: 'upload' | 'map' | 'process' | 'done';
  csvHeaders: string[];
  csvRows: CsvRow[];
  templateId: string;
  templateName: string;
  templateLanguage: string;
  templateBody: string;
  templateParamCount: number;
  phoneColumn: string;
  paramMapping: Record<number, string>; // param index → column name
  fallbackTemplateId: string;
  fallbackTemplateName: string;
  fallbackTemplateLanguage: string;
  fallbackTemplateBody: string;
  sendMode: 'single' | 'random'; // single = only main, random = alternate between main + fallback
  processedRows: ProcessedRow[];
  isProcessing: boolean;
  currentIndex: number;
}

const EMPTY_STATE: BulkSendState = {
  step: 'upload',
  csvHeaders: [],
  csvRows: [],
  templateId: '',
  templateName: '',
  templateLanguage: '',
  templateBody: '',
  templateParamCount: 0,
  phoneColumn: '',
  paramMapping: {},
  fallbackTemplateId: '',
  fallbackTemplateName: '',
  fallbackTemplateLanguage: '',
  fallbackTemplateBody: '',
  sendMode: 'single',
  processedRows: [],
  isProcessing: false,
  currentIndex: 0,
};

// ─── Parse CSV ───────────────────────────────────────────
function parseCsv(text: string): { headers: string[]; rows: CsvRow[] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  // Detect separator (comma, semicolon, tab)
  const firstLine = lines[0];
  const sep = firstLine.includes(';') ? ';' : firstLine.includes('\t') ? '\t' : ',';

  const headers = lines[0].split(sep).map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = lines.slice(1).map(line => {
    const vals = line.split(sep).map(v => v.trim().replace(/^"|"$/g, ''));
    const row: CsvRow = {};
    headers.forEach((h, i) => { row[h] = vals[i] || ''; });
    return row;
  }).filter(r => Object.values(r).some(v => v)); // remove empty rows

  return { headers, rows };
}

// ─── Status Badge ────────────────────────────────────────
function StatusBadge({ status }: { status: RowStatus }) {
  const cfg: Record<RowStatus, { label: string; icon: any; cls: string }> = {
    pending: { label: 'Pendente', icon: Clock, cls: 'text-muted-foreground border-border' },
    sending: { label: 'Enviando', icon: Loader2, cls: 'text-primary border-primary/30 animate-pulse' },
    sent: { label: 'Enviado', icon: CheckCircle2, cls: 'text-blue-500 border-blue-500/30' },
    delivered: { label: 'Entregue', icon: CheckCheck, cls: 'text-green-500 border-green-500/30' },
    read: { label: 'Lido', icon: Eye, cls: 'text-green-600 border-green-600/30' },
    failed: { label: 'Erro', icon: XCircle, cls: 'text-destructive border-destructive/30' },
    fallback_sent: { label: 'Fallback', icon: RotateCcw, cls: 'text-warning border-warning/30' },
    fallback_failed: { label: 'Fallback erro', icon: XCircle, cls: 'text-destructive border-destructive/30' },
  };
  const c = cfg[status] || cfg.pending;
  const Icon = c.icon;
  return (
    <Badge variant="outline" className={cn('text-[10px] h-5 px-1.5 gap-1', c.cls)}>
      <Icon className={cn('w-3 h-3', status === 'sending' && 'animate-spin')} /> {c.label}
    </Badge>
  );
}

// ─── Main Component ──────────────────────────────────────
export default function BulkSendModal({
  open, onClose, account,
}: {
  open: boolean;
  onClose: () => void;
  account: MetaInboxAccount | null;
}) {
  const { toast } = useToast();
  const [state, setState] = useState<BulkSendState>(() => {
    try { const s = localStorage.getItem(STORAGE_KEY); return s ? JSON.parse(s) : EMPTY_STATE; }
    catch { return EMPTY_STATE; }
  });
  const [templates, setTemplates] = useState<any[]>([]);
  const [loadingTpl, setLoadingTpl] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const [refreshingLog, setRefreshingLog] = useState(false);
  const processingRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  // Persist state
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  // Load logs
  const loadLogs = useCallback(async () => {
    if (!account) return;
    const org = await getOrg();
    const { data } = await (supabase as any)
      .from('meta_bulk_send_logs')
      .select('*')
      .eq('org', org)
      .order('created_at', { ascending: false })
      .limit(20);
    setLogs(data || []);
  }, [account?.id]);

  // Load logs whenever modal opens (any step)
  useEffect(() => {
    if (open) loadLogs();
  }, [open, loadLogs]);

  // Auto-refresh logs every 10s while modal is open
  useEffect(() => {
    if (!open) return;
    const t = setInterval(loadLogs, 10_000);
    return () => clearInterval(t);
  }, [open, loadLogs]);

  // Refresh status of a saved log by querying wamids from meta_inbox_messages
  const refreshLogStatus = useCallback(async (log: any) => {
    if (!log?.rows_detail || !Array.isArray(log.rows_detail)) return log;
    const wamids = log.rows_detail.filter((r: any) => r.wamid).map((r: any) => r.wamid);
    if (wamids.length === 0) return log;

    setRefreshingLog(true);
    try {
      const { data } = await (supabase as any)
        .schema('channels').from('meta_messages')
        .select('wamid, status')
        .in('wamid', wamids);
      if (!data || data.length === 0) { setRefreshingLog(false); return log; }

      const statusMap = new Map<string, string>();
      for (const m of data) if (m.wamid && m.status) statusMap.set(m.wamid, m.status);

      let changed = false;
      const updatedRows = log.rows_detail.map((r: any) => {
        if (!r.wamid) return r;
        const dbStatus = statusMap.get(r.wamid);
        if (!dbStatus) return r;
        const newStatus = dbStatus === 'read' ? 'read' : dbStatus === 'delivered' ? 'delivered' : dbStatus === 'failed' ? 'failed' : r.status;
        if (newStatus !== r.status) { changed = true; return { ...r, status: newStatus }; }
        return r;
      });

      if (changed) {
        const sent = updatedRows.filter((r: any) => ['sent', 'delivered', 'read', 'fallback_sent'].includes(r.status)).length;
        const delivered = updatedRows.filter((r: any) => r.status === 'delivered' || r.status === 'read').length;
        const readCount = updatedRows.filter((r: any) => r.status === 'read').length;
        const failed = updatedRows.filter((r: any) => ['failed', 'fallback_failed'].includes(r.status)).length;

        // Persist updated counts back to DB
        await (supabase as any).from('meta_bulk_send_logs').update({
          rows_detail: updatedRows,
          sent_count: sent,
          delivered_count: delivered,
          read_count: readCount,
          failed_count: failed,
        }).eq('id', log.id);

        const updatedLog = {
          ...log,
          rows_detail: updatedRows,
          sent_count: sent,
          delivered_count: delivered,
          read_count: readCount,
          failed_count: failed,
        };
        setSelectedLog(updatedLog);
        // Also refresh the logs list
        setLogs(prev => prev.map(l => l.id === log.id ? updatedLog : l));
        setRefreshingLog(false);
        return updatedLog;
      }
    } catch (e) {
      console.error('[BulkSend] Failed to refresh log status:', e);
    }
    setRefreshingLog(false);
    return log;
  }, []);

  // Auto-refresh when opening a log detail
  useEffect(() => {
    if (selectedLog) refreshLogStatus(selectedLog);
  }, [selectedLog?.id]);

  // Load templates
  useEffect(() => {
    if (!open || !account?.waba_id) return;
    setLoadingTpl(true);
    fetch(`https://graph.facebook.com/v19.0/${account.waba_id}/message_templates?access_token=${account.access_token}&fields=id,name,status,category,language,components&limit=100`)
      .then(r => r.json())
      .then(d => setTemplates((d.data || []).filter((t: any) => t.status === 'APPROVED')))
      .catch(() => {})
      .finally(() => setLoadingTpl(false));
  }, [open, account?.waba_id]);

  // ── Step 1: Upload CSV ──────────────────────────────────
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const reader = new FileReader();
    reader.onload = () => {
      const { headers, rows } = parseCsv(reader.result as string);
      if (headers.length === 0) {
        toast({ variant: 'destructive', title: 'CSV inválido', description: 'Nenhuma coluna encontrada.' });
        return;
      }
      setState(s => ({ ...s, step: 'map', csvHeaders: headers, csvRows: rows, processedRows: [], currentIndex: 0 }));
    };
    reader.readAsText(file);
  };

  // ── Step 2: Select template + map columns ───────────────
  const selectTemplate = (tmpl: any, isFallback = false) => {
    const bodyComp = tmpl.components?.find((c: any) => c.type === 'BODY');
    const bodyText = bodyComp?.text || '';
    const paramCount = (bodyText.match(/\{\{\d+\}\}/g) || []).length;

    if (isFallback) {
      const fbBody = tmpl.components?.find((c: any) => c.type === 'BODY')?.text || '';
      setState(s => ({ ...s, fallbackTemplateId: tmpl.id, fallbackTemplateName: tmpl.name, fallbackTemplateLanguage: tmpl.language, fallbackTemplateBody: fbBody }));
    } else {
      setState(s => ({
        ...s,
        templateId: tmpl.id, templateName: tmpl.name, templateLanguage: tmpl.language,
        templateBody: bodyText, templateParamCount: paramCount,
        paramMapping: {},
      }));
    }
  };

  const canStartProcessing = state.phoneColumn && state.templateName &&
    Array.from({ length: state.templateParamCount }, (_, i) => state.paramMapping[i]).every(Boolean);

  const startProcessing = () => {
    // Build processed rows
    const rows: ProcessedRow[] = state.csvRows.map((row, i) => {
      const phone = normalizePhone(row[state.phoneColumn] || '');
      const params = Array.from({ length: state.templateParamCount }, (_, pi) => row[state.paramMapping[pi]] || '');
      return { index: i, phone, params, status: 'pending' as RowStatus };
    }).filter(r => r.phone && r.params.every(p => p)); // Remove rows with empty phone or params

    setState(s => ({ ...s, step: 'process', processedRows: rows, currentIndex: 0, isProcessing: true }));
  };

  // ── Step 3: Process queue ───────────────────────────────
  const processNext = useCallback(async () => {
    if (!processingRef.current || !account) return;

    setState(prev => {
      const idx = prev.currentIndex;
      if (idx >= prev.processedRows.length) {
        processingRef.current = false;
        return { ...prev, isProcessing: false, step: 'done' };
      }

      // Mark current as sending
      const rows = [...prev.processedRows];
      rows[idx] = { ...rows[idx], status: 'sending' };
      return { ...prev, processedRows: rows };
    });

    // Get current row from state
    const currentState = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as BulkSendState;
    const idx = currentState.currentIndex;
    const row = currentState.processedRows[idx];
    if (!row || !processingRef.current) return;

    // Create or find conversation
    const org = await getOrg();
    let convId: string;
    const { data: existing } = await (supabase as any)
      .schema('channels').from('meta_conversations')
      .select('id')
      .eq('account_id', account.id)
      .eq('contact_phone', row.phone)
      .maybeSingle();

    if (existing) {
      convId = existing.id;
    } else {
      const { data: created } = await (supabase as any)
        .schema('channels').from('meta_conversations')
        .insert({ account_id: account.id, empresa_id: org, contact_phone: row.phone, contact_name: row.phone, status: 'open' })
        .select('id').single();
      convId = created?.id;
    }

    // Determine which template to use
    const templates2 = [
      { name: currentState.templateName, language: currentState.templateLanguage, body: currentState.templateBody },
    ];
    if (currentState.fallbackTemplateName) {
      templates2.push({ name: currentState.fallbackTemplateName, language: currentState.fallbackTemplateLanguage, body: currentState.fallbackTemplateBody });
    }

    // Pick template: random mode alternates, single mode always uses first
    const tplIndex = currentState.sendMode === 'random' && templates2.length > 1
      ? idx % templates2.length
      : 0;
    let chosenTpl = templates2[tplIndex];

    // Build components
    const components: any[] = [];
    if (row.params.length > 0) {
      components.push({
        type: 'body',
        parameters: row.params.map(v => ({ type: 'text', text: v })),
      });
    }

    let renderedBody = chosenTpl.body;
    row.params.forEach((v, i) => { renderedBody = renderedBody.replace(`{{${i + 1}}}`, v); });

    // Send with chosen template
    let result = await sendTemplateMessage(
      account, convId || '', row.phone,
      chosenTpl.name, chosenTpl.language,
      components, renderedBody,
    );

    let templateUsed = chosenTpl.name;
    let finalStatus: RowStatus = result.success ? 'sent' : 'failed';

    // If failed and there's another template, auto-retry with the other one
    if (!result.success && templates2.length > 1) {
      const otherTpl = templates2[tplIndex === 0 ? 1 : 0];
      let otherBody = otherTpl.body;
      row.params.forEach((v, i) => { otherBody = otherBody.replace(`{{${i + 1}}}`, v); });

      const retryResult = await sendTemplateMessage(
        account, convId || '', row.phone,
        otherTpl.name, otherTpl.language,
        components, otherBody,
      );

      if (retryResult.success) {
        result = retryResult;
        templateUsed = otherTpl.name;
        finalStatus = 'fallback_sent';
      } else {
        finalStatus = 'fallback_failed';
      }
    }

    setState(prev => {
      const rows = [...prev.processedRows];
      rows[idx] = {
        ...rows[idx],
        status: finalStatus,
        templateUsed,
        wamid: result.wamid,
        error: result.error,
        sentAt: new Date().toISOString(),
      };
      return { ...prev, processedRows: rows, currentIndex: idx + 1 };
    });

    // Schedule next
    if (processingRef.current) {
      timerRef.current = window.setTimeout(processNext, INTERVAL_MS);
    }
  }, [account]);

  // Start/resume processing
  useEffect(() => {
    if (state.isProcessing && !processingRef.current) {
      processingRef.current = true;
      processNext();
    }
  }, [state.isProcessing, processNext]);

  const pauseProcessing = () => {
    processingRef.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);
    setState(s => ({ ...s, isProcessing: false }));
  };

  const resumeProcessing = () => {
    setState(s => ({ ...s, isProcessing: true }));
  };

  // ── Process fallback for failed rows ────────────────────
  const processFallback = async () => {
    if (!account || !state.fallbackTemplateName) return;
    const failedRows = state.processedRows.filter(r => r.status === 'failed');
    if (failedRows.length === 0) { toast({ title: 'Nenhum erro para reprocessar' }); return; }

    processingRef.current = true;
    for (const row of failedRows) {
      if (!processingRef.current) break;

      setState(prev => {
        const rows = [...prev.processedRows];
        const idx = rows.findIndex(r => r.index === row.index);
        if (idx >= 0) rows[idx] = { ...rows[idx], status: 'sending' };
        return { ...prev, processedRows: rows };
      });

      const org = await getOrg();
      const { data: conv } = await (supabase as any)
        .schema('channels').from('meta_conversations').select('id')
        .eq('account_id', account.id).eq('contact_phone', row.phone).maybeSingle();

      const components: any[] = [];
      if (row.params.length > 0) {
        components.push({ type: 'body', parameters: row.params.map(v => ({ type: 'text', text: v })) });
      }

      const result = await sendTemplateMessage(
        account, conv?.id || '', row.phone,
        state.fallbackTemplateName, state.fallbackTemplateLanguage,
        components,
      );

      setState(prev => {
        const rows = [...prev.processedRows];
        const idx = rows.findIndex(r => r.index === row.index);
        if (idx >= 0) {
          rows[idx] = { ...rows[idx], status: result.success ? 'fallback_sent' : 'fallback_failed', error: result.error };
        }
        return { ...prev, processedRows: rows };
      });

      await new Promise(r => setTimeout(r, INTERVAL_MS));
    }
    processingRef.current = false;
  };

  const resetAll = async () => {
    processingRef.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);

    // Log already auto-saved when step transitions to 'done'
    logSavedRef.current = false; // Reset for next send
    setState(EMPTY_STATE);
    localStorage.removeItem(STORAGE_KEY);
  };

  // ── Poll status updates (delivered/read/failed) from webhook — runs during AND after processing ──
  useEffect(() => {
    const rowsWithWamid = state.processedRows.filter(r => r.wamid && !['delivered', 'read', 'failed', 'fallback_failed'].includes(r.status));
    if (rowsWithWamid.length === 0 || state.step === 'upload' || state.step === 'map') return;

    const poll = async () => {
      try {
        const wamids = state.processedRows.filter(r => r.wamid).map(r => r.wamid!);
        if (wamids.length === 0) return;
        const { data } = await (supabase as any)
          .schema('channels').from('meta_messages')
          .select('wamid, status')
          .in('wamid', wamids);
        if (!data || data.length === 0) return;

        const statusMap = new Map<string, string>();
        for (const m of data) if (m.wamid && m.status) statusMap.set(m.wamid, m.status);

        setState(prev => {
          let changed = false;
          const rows = prev.processedRows.map(r => {
            if (!r.wamid) return r;
            const dbStatus = statusMap.get(r.wamid);
            if (!dbStatus) return r;
            const newStatus: RowStatus =
              dbStatus === 'read' ? 'read' :
              dbStatus === 'delivered' ? 'delivered' :
              dbStatus === 'failed' ? 'failed' :
              r.status;
            if (newStatus !== r.status) { changed = true; return { ...r, status: newStatus }; }
            return r;
          });
          return changed ? { ...prev, processedRows: rows } : prev;
        });
      } catch { /* silent */ }
    };

    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [
    state.processedRows.filter(r => r.wamid && !['delivered', 'read', 'failed', 'fallback_failed'].includes(r.status)).length,
    state.step,
  ]);

  // ── Post-send review: wait for late callbacks, then check for failures ──
  const [reviewPhase, setReviewPhase] = useState<'idle' | 'waiting' | 'checking' | 'retrying' | 'done'>('idle');
  const [reviewCountdown, setReviewCountdown] = useState(0);
  const reviewRanRef = useRef(false);

  // Auto-save log when processing finishes (don't wait for user to click reset)
  const logSavedRef = useRef(false);
  useEffect(() => {
    if (state.step !== 'done' || logSavedRef.current || state.processedRows.length === 0 || !account) return;
    logSavedRef.current = true;
    (async () => {
      try {
        const org = await getOrg();
        const sent = state.processedRows.filter(r => ['sent', 'delivered', 'read'].includes(r.status)).length;
        const failed = state.processedRows.filter(r => ['failed', 'fallback_failed'].includes(r.status)).length;
        const delivered = state.processedRows.filter(r => r.status === 'delivered').length;
        const readCount = state.processedRows.filter(r => r.status === 'read').length;
        const fallbackSent = state.processedRows.filter(r => r.status === 'fallback_sent').length;
        await (supabase as any).from('meta_bulk_send_logs').insert({
          account_id: account.id, empresa_id: org,
          template_name: state.templateName, template_language: state.templateLanguage,
          template_body: state.templateBody || null, fallback_template: state.fallbackTemplateName || null,
          total_rows: state.processedRows.length, sent_count: sent, delivered_count: delivered,
          read_count: readCount, failed_count: failed, fallback_sent_count: fallbackSent,
          rows_detail: state.processedRows.map(r => ({ phone: r.phone, status: r.status, error: r.error, wamid: r.wamid, params: r.params, templateUsed: r.templateUsed })),
          finished_at: new Date().toISOString(),
        });
        loadLogs();
      } catch (e) { console.error('[BulkSend] Auto-save log failed:', e); }
    })();
  }, [state.step]);

  useEffect(() => {
    // Trigger review once when processing finishes (step transitions to 'done')
    if (state.step !== 'done' || reviewRanRef.current || state.processedRows.length === 0) return;
    const hasWamids = state.processedRows.some(r => r.wamid);
    if (!hasWamids) return;

    reviewRanRef.current = true;
    setReviewPhase('waiting');
    setReviewCountdown(15);

    // Countdown 15s to allow Meta late callbacks
    const countdownInterval = setInterval(() => {
      setReviewCountdown(prev => {
        if (prev <= 1) { clearInterval(countdownInterval); return 0; }
        return prev - 1;
      });
    }, 1000);

    // After 15s, do final status check
    const timer = setTimeout(async () => {
      setReviewPhase('checking');
      try {
        const wamids = state.processedRows.filter(r => r.wamid).map(r => r.wamid!);
        const { data } = await (supabase as any)
          .schema('channels').from('meta_messages')
          .select('wamid, status, error_code, error_message')
          .in('wamid', wamids);

        if (data && data.length > 0) {
          const statusMap = new Map<string, { status: string; error_code?: string; error_message?: string }>();
          for (const m of data) if (m.wamid) statusMap.set(m.wamid, m);

          setState(prev => {
            const rows = prev.processedRows.map(r => {
              if (!r.wamid) return r;
              const db = statusMap.get(r.wamid);
              if (!db) return r;
              const newStatus: RowStatus =
                db.status === 'read' ? 'read' :
                db.status === 'delivered' ? 'delivered' :
                db.status === 'failed' ? 'failed' :
                r.status;
              if (newStatus !== r.status) {
                return { ...r, status: newStatus, error: db.error_message || r.error };
              }
              return r;
            });
            return { ...prev, processedRows: rows };
          });
        }
      } catch { /* silent */ }

      // Check if there are late failures that need fallback retry
      const currentState = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as BulkSendState;
      const lateFailed = currentState.processedRows.filter(
        (r: ProcessedRow) => r.status === 'failed' && r.wamid,
      );

      if (lateFailed.length > 0 && currentState.fallbackTemplateName && account) {
        setReviewPhase('retrying');
        toast({
          title: `${lateFailed.length} erro(s) detectado(s) na revisão`,
          description: `Reenviando com template reserva: ${currentState.fallbackTemplateName}`,
        });

        // Retry each failed row with fallback template
        for (const row of lateFailed) {
          try {
            const components: any[] = [];
            if (row.params.length > 0) {
              components.push({ type: 'body', parameters: row.params.map((v: string) => ({ type: 'text', text: v })) });
            }

            const retryResult = await sendTemplateMessage(
              account, '', row.phone,
              currentState.fallbackTemplateName, currentState.fallbackTemplateLanguage,
              components,
            );

            setState(prev => {
              const rows = prev.processedRows.map(r =>
                r.phone === row.phone && r.status === 'failed'
                  ? { ...r, status: (retryResult.success ? 'fallback_sent' : 'fallback_failed') as RowStatus, wamid: retryResult.wamid || r.wamid, error: retryResult.error || r.error, templateUsed: currentState.fallbackTemplateName }
                  : r
              );
              return { ...prev, processedRows: rows };
            });

            await new Promise(r => setTimeout(r, INTERVAL_MS));
          } catch { /* continue with next */ }
        }
      }

      setReviewPhase('done');
    }, 15000);

    return () => { clearTimeout(timer); clearInterval(countdownInterval); };
  }, [state.step]);

  // Reset review state when starting new processing
  useEffect(() => {
    if (state.step === 'process') { reviewRanRef.current = false; setReviewPhase('idle'); }
  }, [state.step]);

  // ── Stats ──────────────────────────────────────────────
  const stats = {
    total: state.processedRows.length,
    sent: state.processedRows.filter(r => ['sent', 'delivered', 'read', 'fallback_sent'].includes(r.status)).length,
    failed: state.processedRows.filter(r => ['failed', 'fallback_failed'].includes(r.status)).length,
    pending: state.processedRows.filter(r => r.status === 'pending').length,
    delivered: state.processedRows.filter(r => r.status === 'delivered').length,
    read: state.processedRows.filter(r => r.status === 'read').length,
  };

  return (
    <Dialog open={open} onOpenChange={() => { if (!state.isProcessing) onClose(); }}>
      <DialogContent className="max-w-3xl bg-card border-border max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-sm flex items-center gap-2">
            <Send className="w-4 h-4 text-primary" /> Envio em Lote
            {state.step !== 'upload' && (
              <Button variant="ghost" size="sm" className="ml-auto text-[10px] h-6" onClick={resetAll}>
                <RotateCcw className="w-3 h-3 mr-1" /> Reiniciar
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pt-2">

          {/* ═══ STEP 1: Upload CSV + History ═══ */}
          {state.step === 'upload' && !selectedLog && (
            <div className="space-y-4">
              <label className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-primary/5 cursor-pointer transition-all">
                <Upload className="w-7 h-7 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Clique para enviar um arquivo CSV</span>
                <span className="text-[10px] text-muted-foreground/60">Separadores aceitos: vírgula, ponto-e-vírgula, tab</span>
                <input type="file" accept=".csv,.txt" className="hidden" onChange={handleFileUpload} />
              </label>

              {state.processedRows.length > 0 && (
                <Button variant="outline" className="w-full text-xs" onClick={() => setState(s => ({ ...s, step: 'process' }))}>
                  Voltar ao processamento anterior ({stats.sent} enviados, {stats.failed} erros)
                </Button>
              )}

              {/* History */}
              {logs.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Histórico de disparos</p>
                  <div className="space-y-1.5">
                    {logs.map(log => {
                      const isDone = log.finished_at || (log.sent_count + log.failed_count) >= log.total_rows;
                      const status = isDone ? (log.failed_count > 0 ? 'Com erros' : 'Concluído') : 'Em andamento';
                      const statusCls = status === 'Concluído' ? 'text-green-500' : status === 'Com erros' ? 'text-warning' : 'text-primary';
                      return (
                        <button key={log.id} onClick={() => setSelectedLog(log)}
                          className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors text-left">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{log.template_name}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {new Date(log.created_at).toLocaleDateString('pt-BR')} · {new Date(log.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          <span className={cn('text-[10px] font-medium', statusCls)}>{status}</span>
                          <span className="text-xs font-mono text-muted-foreground">{log.sent_count}/{log.total_rows}</span>
                          <ChevronDown className="w-3 h-3 text-muted-foreground -rotate-90" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══ Log detail view ═══ */}
          {state.step === 'upload' && selectedLog && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setSelectedLog(null)}>
                  ← Voltar
                </Button>
                <Button
                  variant="outline" size="sm" className="text-xs h-7 gap-1"
                  onClick={() => refreshLogStatus(selectedLog)}
                  disabled={refreshingLog}
                >
                  {refreshingLog ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                  Atualizar status
                </Button>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-semibold">{selectedLog.template_name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(selectedLog.created_at).toLocaleString('pt-BR')}
                  </p>
                </div>

                {/* Template body */}
                {selectedLog.template_body && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                    <p className="text-[9px] font-semibold text-primary uppercase tracking-wide mb-1">
                      <LayoutTemplate className="w-3 h-3 inline mr-1" /> Template principal: {selectedLog.template_name}
                    </p>
                    <p className="text-xs whitespace-pre-wrap text-foreground/80">{selectedLog.template_body}</p>
                  </div>
                )}

                {/* Fallback template */}
                {selectedLog.fallback_template && (
                  <div className="rounded-lg border border-warning/20 bg-warning/5 p-3">
                    <p className="text-[9px] font-semibold text-warning uppercase tracking-wide mb-1">
                      <RotateCcw className="w-3 h-3 inline mr-1" /> Template fallback: {selectedLog.fallback_template}
                    </p>
                    {selectedLog.fallback_body && (
                      <p className="text-xs whitespace-pre-wrap text-foreground/80">{selectedLog.fallback_body}</p>
                    )}
                  </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { label: 'Total', value: selectedLog.total_rows, cls: 'text-foreground' },
                    { label: 'Enviados', value: selectedLog.sent_count, cls: 'text-blue-500' },
                    { label: 'Entregues', value: selectedLog.delivered_count, cls: 'text-green-500' },
                    { label: 'Lidos', value: selectedLog.read_count, cls: 'text-green-600' },
                    { label: 'Erros', value: selectedLog.failed_count, cls: 'text-destructive' },
                  ].map(s => (
                    <div key={s.label} className="text-center p-2 rounded-lg bg-secondary border border-border">
                      <p className={cn('text-lg font-bold', s.cls)}>{s.value}</p>
                      <p className="text-[9px] text-muted-foreground">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Rows detail */}
                {Array.isArray(selectedLog.rows_detail) && selectedLog.rows_detail.length > 0 && (
                  <div className="max-h-[40vh] overflow-y-auto rounded-lg border border-border">
                    <table className="w-full text-xs">
                      <thead className="bg-secondary sticky top-0">
                        <tr>
                          <th className="text-left px-3 py-2">#</th>
                          <th className="text-left px-3 py-2">Telefone</th>
                          <th className="text-left px-3 py-2">Template</th>
                          <th className="text-left px-3 py-2">Parâmetros</th>
                          <th className="text-center px-3 py-2">Status</th>
                          <th className="text-left px-3 py-2">Erro</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedLog.rows_detail.map((row: any, i: number) => {
                          const tplDisplay = row.templateUsed
                            || (['sent', 'delivered', 'read'].includes(row.status) ? selectedLog.template_name : null)
                            || (row.status === 'fallback_sent' ? selectedLog.fallback_template : null)
                            || selectedLog.template_name
                            || '—';
                          return (
                          <tr key={i} className="border-t border-border/50">
                            <td className="px-3 py-1.5 text-muted-foreground">{i + 1}</td>
                            <td className="px-3 py-1.5 font-mono">{row.phone}</td>
                            <td className="px-3 py-1.5 text-[10px] font-mono text-muted-foreground">{tplDisplay}</td>
                            <td className="px-3 py-1.5 text-muted-foreground truncate max-w-[200px]">{(row.params || []).join(', ')}</td>
                            <td className="px-3 py-1.5 text-center"><StatusBadge status={row.status} /></td>
                            <td className="px-3 py-1.5 text-destructive truncate max-w-[150px]">{row.error || ''}</td>
                          </tr>
                          ); })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══ STEP 2: Map columns ═══ */}
          {state.step === 'map' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <FileText className="w-4 h-4" />
                <span>{state.csvRows.length} linhas · {state.csvHeaders.length} colunas</span>
              </div>

              {/* Template selector */}
              <div>
                <label className="text-xs font-medium block mb-1.5">Template principal *</label>
                {loadingTpl ? (
                  <div className="flex items-center gap-2 py-3"><Loader2 className="w-4 h-4 animate-spin" /> <span className="text-xs">Carregando...</span></div>
                ) : (
                  <select
                    value={state.templateId}
                    onChange={e => { const t = templates.find(t => t.id === e.target.value); if (t) selectTemplate(t); }}
                    className="w-full h-9 text-sm bg-secondary border border-border rounded-md px-3"
                  >
                    <option value="">Selecione um template...</option>
                    {templates.map(t => <option key={t.id} value={t.id}>{t.name} ({t.language})</option>)}
                  </select>
                )}
              </div>

              {/* Phone column */}
              {state.templateName && (
                <div>
                  <label className="text-xs font-medium block mb-1.5">Coluna do telefone *</label>
                  <select value={state.phoneColumn} onChange={e => setState(s => ({ ...s, phoneColumn: e.target.value }))}
                    className="w-full h-9 text-sm bg-secondary border border-border rounded-md px-3">
                    <option value="">Selecione...</option>
                    {state.csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              )}

              {/* Param mapping */}
              {state.templateParamCount > 0 && state.templateName && (
                <div className="space-y-2">
                  <label className="text-xs font-medium block">Mapeamento de parâmetros</label>
                  <div className="bg-secondary/50 rounded-lg p-3 text-xs whitespace-pre-wrap mb-2">
                    {state.templateBody}
                  </div>
                  {Array.from({ length: state.templateParamCount }, (_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs font-mono text-primary w-12 text-right">{`{{${i + 1}}}`}</span>
                      <span className="text-xs text-muted-foreground">→</span>
                      <select
                        value={state.paramMapping[i] || ''}
                        onChange={e => setState(s => ({ ...s, paramMapping: { ...s.paramMapping, [i]: e.target.value } }))}
                        className="flex-1 h-8 text-xs bg-secondary border border-border rounded-md px-2"
                      >
                        <option value="">Selecione coluna...</option>
                        {state.csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              )}

              {/* Fallback template */}
              {state.templateName && (
                <div>
                  <label className="text-xs font-medium block mb-1.5">Template alternativo</label>
                  <select
                    value={state.fallbackTemplateId}
                    onChange={e => { const t = templates.find(t => t.id === e.target.value); if (t) selectTemplate(t, true); else setState(s => ({ ...s, fallbackTemplateId: '', fallbackTemplateName: '', fallbackTemplateLanguage: '', fallbackTemplateBody: '', sendMode: 'single' })); }}
                    className="w-full h-9 text-sm bg-secondary border border-border rounded-md px-3"
                  >
                    <option value="">Nenhum (opcional)</option>
                    {templates.filter(t => t.id !== state.templateId).map(t => <option key={t.id} value={t.id}>{t.name} ({t.language})</option>)}
                  </select>
                </div>
              )}

              {/* Send mode selector */}
              {state.fallbackTemplateName && (
                <div>
                  <label className="text-xs font-medium block mb-1.5">Modo de envio</label>
                  <div className="flex gap-2">
                    {([
                      { key: 'single', label: 'Principal + fallback se erro', desc: 'Envia o principal. Se falhar, tenta o alternativo.' },
                      { key: 'random', label: 'Aleatório (1 de cada)', desc: 'Alterna entre os dois templates. Se falhar, tenta o outro.' },
                    ] as const).map(m => (
                      <button key={m.key} onClick={() => setState(s => ({ ...s, sendMode: m.key }))}
                        className={cn('flex-1 p-3 rounded-lg border text-left transition-all',
                          state.sendMode === m.key ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30')}>
                        <p className="text-xs font-medium">{m.label}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{m.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview */}
              {canStartProcessing && (
                <div className="bg-primary/5 rounded-lg p-3 border border-primary/20">
                  <p className="text-[10px] font-semibold text-primary uppercase mb-1">Preview (primeira linha)</p>
                  <p className="text-xs whitespace-pre-wrap">
                    {(() => {
                      let body = state.templateBody;
                      const row = state.csvRows[0];
                      Array.from({ length: state.templateParamCount }, (_, i) => {
                        body = body.replace(`{{${i + 1}}}`, row[state.paramMapping[i]] || `{{${i + 1}}}`);
                      });
                      return body;
                    })()}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    → {normalizePhone(state.csvRows[0][state.phoneColumn] || '')}
                  </p>
                </div>
              )}

              <Button className="w-full h-10" disabled={!canStartProcessing} onClick={startProcessing}>
                <Send className="w-4 h-4 mr-2" /> Iniciar envio ({state.csvRows.length} mensagens)
              </Button>
            </div>
          )}

          {/* ═══ STEP 3/4: Processing + Done ═══ */}
          {(state.step === 'process' || state.step === 'done') && (
            <div className="space-y-4">
              {/* Stats bar */}
              <div className="grid grid-cols-5 gap-2">
                {[
                  { label: 'Total', value: stats.total, cls: 'text-foreground' },
                  { label: 'Enviados', value: stats.sent, cls: 'text-blue-500' },
                  { label: 'Entregues', value: stats.delivered, cls: 'text-green-500' },
                  { label: 'Lidos', value: stats.read, cls: 'text-green-600' },
                  { label: 'Erros', value: stats.failed, cls: 'text-destructive' },
                ].map(s => (
                  <div key={s.label} className="text-center p-2 rounded-lg bg-secondary border border-border">
                    <p className={cn('text-lg font-bold', s.cls)}>{s.value}</p>
                    <p className="text-[9px] text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Progress bar */}
              <div>
                <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                  <span>{state.currentIndex} / {stats.total}</span>
                  <span>{stats.total > 0 ? Math.round((state.currentIndex / stats.total) * 100) : 0}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${stats.total > 0 ? (state.currentIndex / stats.total) * 100 : 0}%` }} />
                </div>
              </div>

              {/* Controls */}
              <div className="flex gap-2 flex-wrap">
                {state.isProcessing ? (
                  <>
                    <Button size="sm" variant="outline" className="text-xs" onClick={pauseProcessing}>
                      <Pause className="w-3 h-3 mr-1" /> Pausar
                    </Button>
                    <Button size="sm" variant="outline" className="text-xs border-destructive/30 text-destructive" onClick={() => { pauseProcessing(); setState(s => ({ ...s, step: 'done' })); }}>
                      <X className="w-3 h-3 mr-1" /> Parar
                    </Button>
                  </>
                ) : state.step === 'process' ? (
                  <>
                    <Button size="sm" className="text-xs" onClick={resumeProcessing}>
                      <Play className="w-3 h-3 mr-1" /> Continuar de onde parou
                    </Button>
                    <Button size="sm" variant="outline" className="text-xs" onClick={() => {
                      setState(s => ({
                        ...s,
                        processedRows: s.processedRows.map(r => ({ ...r, status: 'pending' as RowStatus, wamid: undefined, error: undefined })),
                        currentIndex: 0,
                        isProcessing: true,
                      }));
                    }}>
                      <RotateCcw className="w-3 h-3 mr-1" /> Reiniciar do zero
                    </Button>
                    <Button size="sm" variant="outline" className="text-xs border-destructive/30 text-destructive" onClick={() => setState(s => ({ ...s, step: 'done' }))}>
                      <X className="w-3 h-3 mr-1" /> Parar definitivamente
                    </Button>
                  </>
                ) : null}

                {state.step === 'done' && reviewPhase !== 'idle' && reviewPhase !== 'done' && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                    <span className="text-xs text-primary font-medium">
                      {reviewPhase === 'waiting' && `Aguardando callbacks da Meta... ${reviewCountdown}s`}
                      {reviewPhase === 'checking' && 'Revisando status final de todas as mensagens...'}
                      {reviewPhase === 'retrying' && 'Reenviando erros com template reserva...'}
                    </span>
                  </div>
                )}
                {state.step === 'done' && (reviewPhase === 'done' || reviewPhase === 'idle') && (
                  <>
                    {stats.pending > 0 && (
                      <Button size="sm" className="text-xs" onClick={() => setState(s => ({ ...s, step: 'process', isProcessing: true }))}>
                        <Play className="w-3 h-3 mr-1" /> Retomar de onde parou ({stats.pending} restantes)
                      </Button>
                    )}
                    {stats.failed > 0 && state.fallbackTemplateName && (
                      <Button size="sm" variant="outline" className="text-xs" onClick={processFallback}>
                        <RotateCcw className="w-3 h-3 mr-1" /> Reprocessar erros com {state.fallbackTemplateName}
                      </Button>
                    )}
                    {stats.failed > 0 && !state.fallbackTemplateName && (
                      <Button size="sm" variant="outline" className="text-xs" onClick={() => {
                        setState(s => ({
                          ...s,
                          step: 'process',
                          processedRows: s.processedRows.map(r => r.status === 'failed' ? { ...r, status: 'pending' as RowStatus, error: undefined } : r),
                          currentIndex: s.processedRows.findIndex(r => r.status === 'failed'),
                          isProcessing: true,
                        }));
                      }}>
                        <RotateCcw className="w-3 h-3 mr-1" /> Retentar {stats.failed} com erro
                      </Button>
                    )}
                  </>
                )}
              </div>

              {/* Rows table */}
              <div className="max-h-[40vh] overflow-y-auto rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead className="bg-secondary sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 w-8">#</th>
                      <th className="text-left px-3 py-2">Telefone</th>
                      <th className="text-left px-3 py-2">Template</th>
                      <th className="text-left px-3 py-2">Parâmetros</th>
                      <th className="text-center px-3 py-2">Status</th>
                      <th className="text-left px-3 py-2">Erro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.processedRows.map((row, i) => (
                      <tr key={i} className={cn('border-t border-border/50', row.status === 'sending' && 'bg-primary/5')}>
                        <td className="px-3 py-1.5 text-muted-foreground">{i + 1}</td>
                        <td className="px-3 py-1.5 font-mono">{row.phone}</td>
                        <td className="px-3 py-1.5 text-[10px] font-mono text-muted-foreground">{row.templateUsed || '—'}</td>
                        <td className="px-3 py-1.5 text-muted-foreground truncate max-w-[200px]">{row.params.join(', ')}</td>
                        <td className="px-3 py-1.5 text-center"><StatusBadge status={row.status} /></td>
                        <td className="px-3 py-1.5 text-destructive truncate max-w-[150px]">{row.error || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
}
