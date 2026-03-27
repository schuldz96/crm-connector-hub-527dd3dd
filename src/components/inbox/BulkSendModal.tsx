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
import { sendTemplateMessage } from '@/lib/metaInboxService';
import { supabase } from '@/integrations/supabase/client';
import { getSaasEmpresaId } from '@/lib/saas';
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
  const processingRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  // Persist state
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

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
      setState(s => ({ ...s, fallbackTemplateId: tmpl.id, fallbackTemplateName: tmpl.name, fallbackTemplateLanguage: tmpl.language }));
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
      const phone = (row[state.phoneColumn] || '').replace(/\D/g, '');
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
    const empresaId = await getSaasEmpresaId();
    let convId: string;
    const { data: existing } = await (supabase as any)
      .from('meta_inbox_conversations')
      .select('id')
      .eq('account_id', account.id)
      .eq('contact_phone', row.phone)
      .maybeSingle();

    if (existing) {
      convId = existing.id;
    } else {
      const { data: created } = await (supabase as any)
        .from('meta_inbox_conversations')
        .insert({ account_id: account.id, empresa_id: empresaId, contact_phone: row.phone, contact_name: row.phone, status: 'open' })
        .select('id').single();
      convId = created?.id;
    }

    // Build components
    const components: any[] = [];
    if (row.params.length > 0) {
      components.push({
        type: 'body',
        parameters: row.params.map(v => ({ type: 'text', text: v })),
      });
    }

    // Render body
    let renderedBody = currentState.templateBody;
    row.params.forEach((v, i) => { renderedBody = renderedBody.replace(`{{${i + 1}}}`, v); });

    // Send
    const result = await sendTemplateMessage(
      account, convId || '', row.phone,
      currentState.templateName, currentState.templateLanguage,
      components, renderedBody,
    );

    setState(prev => {
      const rows = [...prev.processedRows];
      rows[idx] = {
        ...rows[idx],
        status: result.success ? 'sent' : 'failed',
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

      const empresaId = await getSaasEmpresaId();
      const { data: conv } = await (supabase as any)
        .from('meta_inbox_conversations').select('id')
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

  const resetAll = () => {
    processingRef.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);
    setState(EMPTY_STATE);
    localStorage.removeItem(STORAGE_KEY);
  };

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

          {/* ═══ STEP 1: Upload CSV ═══ */}
          {state.step === 'upload' && (
            <div className="space-y-4">
              <label className="flex flex-col items-center gap-3 p-8 rounded-xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-primary/5 cursor-pointer transition-all">
                <Upload className="w-8 h-8 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Clique para enviar um arquivo CSV</span>
                <span className="text-[10px] text-muted-foreground/60">Separadores aceitos: vírgula, ponto-e-vírgula, tab</span>
                <input type="file" accept=".csv,.txt" className="hidden" onChange={handleFileUpload} />
              </label>

              {state.processedRows.length > 0 && (
                <Button variant="outline" className="w-full" onClick={() => setState(s => ({ ...s, step: 'process' }))}>
                  Voltar ao processamento anterior ({stats.sent} enviados, {stats.failed} erros)
                </Button>
              )}
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
                  <label className="text-xs font-medium block mb-1.5">Template alternativo (para erros)</label>
                  <select
                    value={state.fallbackTemplateId}
                    onChange={e => { const t = templates.find(t => t.id === e.target.value); if (t) selectTemplate(t, true); }}
                    className="w-full h-9 text-sm bg-secondary border border-border rounded-md px-3"
                  >
                    <option value="">Nenhum (opcional)</option>
                    {templates.filter(t => t.id !== state.templateId).map(t => <option key={t.id} value={t.id}>{t.name} ({t.language})</option>)}
                  </select>
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
                    → {(state.csvRows[0][state.phoneColumn] || '').replace(/\D/g, '')}
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
              <div className="flex gap-2">
                {state.isProcessing ? (
                  <Button size="sm" variant="outline" className="text-xs" onClick={pauseProcessing}>
                    <Pause className="w-3 h-3 mr-1" /> Pausar
                  </Button>
                ) : state.step !== 'done' ? (
                  <Button size="sm" className="text-xs" onClick={resumeProcessing}>
                    <Play className="w-3 h-3 mr-1" /> Continuar
                  </Button>
                ) : null}

                {state.step === 'done' && stats.failed > 0 && state.fallbackTemplateName && (
                  <Button size="sm" variant="outline" className="text-xs" onClick={processFallback}>
                    <RotateCcw className="w-3 h-3 mr-1" /> Reprocessar erros com {state.fallbackTemplateName}
                  </Button>
                )}
              </div>

              {/* Rows table */}
              <div className="max-h-[40vh] overflow-y-auto rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead className="bg-secondary sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 w-8">#</th>
                      <th className="text-left px-3 py-2">Telefone</th>
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
