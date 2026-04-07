/**
 * Edge Function: crm-ai-trigger
 * Disparada quando um negócio/ticket é criado ou movido para uma etapa com IA configurada.
 * Busca a config do estágio, resolve o contato principal, e envia a mensagem de boas-vindas.
 * Mantém memória da conversa em crm_ai_conversations.
 *
 * POST body: {
 *   entidade_tipo: 'deal' | 'ticket',
 *   entidade_id: string (UUID),
 *   estagio_id: string (UUID),
 *   empresa_id: string (UUID),
 *   evento: 'create' | 'move'
 * }
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { decryptToken } from '../_shared/tokenCrypto.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { db: { schema: 'saas' } });

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const logs: string[] = [];
  const log = (msg: string) => { logs.push(`[${new Date().toISOString()}] ${msg}`); console.log(msg); };

  try {
    const body = await req.json();
    const { entidade_tipo, entidade_id, estagio_id, empresa_id, evento } = body;

    if (!entidade_tipo || !entidade_id || !estagio_id || !empresa_id) {
      return jsonRes({ error: 'Missing required fields', logs }, 400);
    }

    log(`=== CRM AI Trigger: ${evento} ${entidade_tipo} ${entidade_id} → estágio ${estagio_id} ===`);

    // 1. Buscar config de IA do estágio
    const { data: config, error: configErr } = await sb.from('crm_estagio_ia_config')
      .select('*')
      .eq('estagio_id', estagio_id)
      .eq('empresa_id', empresa_id)
      .maybeSingle();

    if (configErr) log(`Erro ao buscar config: ${configErr.message} (code: ${configErr.code})`);
    log(`Config result: ${config ? `ativo=${config.ativo}, provider=${config.provider}` : 'NULL'}`);

    if (!config || !config.ativo) {
      log('IA não configurada ou inativa para este estágio. Ignorando.');
      return jsonRes({ success: true, skipped: true, reason: 'ia_inactive', logs });
    }

    // 2. Verificar startMode
    const startMode = config.modo_inicio || 'immediate';
    if (evento === 'create' && startMode === 'on_move') {
      log('startMode=on_move mas evento=create. Ignorando.');
      return jsonRes({ success: true, skipped: true, reason: 'wrong_event', logs });
    }
    if (evento === 'move' && startMode === 'immediate') {
      log('startMode=immediate mas evento=move. Ignorando.');
      return jsonRes({ success: true, skipped: true, reason: 'wrong_event', logs });
    }
    // create_or_move aceita ambos, wait_first não envia welcome
    if (startMode === 'wait_first') {
      log('startMode=wait_first. Não envia welcome, apenas registra conversa.');
      // Registra conversa vazia para o contato (IA fica em standby)
      await ensureConversation(empresa_id, entidade_tipo, entidade_id, estagio_id, config, null, log);
      return jsonRes({ success: true, skipped: true, reason: 'wait_first', logs });
    }

    log(`Config: provider=${config.provider}, instance=${config.instancia_id}, startMode=${startMode}`);

    // 3. Buscar contato principal
    const table = entidade_tipo === 'deal' ? 'crm_negocios' : 'crm_tickets';
    const { data: entity } = await sb.from(table)
      .select('id, contato_principal_id, empresa_id')
      .eq('id', entidade_id)
      .maybeSingle();

    if (!entity?.contato_principal_id) {
      log('Nenhum contato principal definido. Não é possível enviar mensagem.');
      return jsonRes({ success: true, skipped: true, reason: 'no_primary_contact', logs });
    }

    const { data: contato } = await sb.from('crm_contatos')
      .select('id, nome, email, telefone')
      .eq('id', entity.contato_principal_id)
      .maybeSingle();

    if (!contato?.telefone) {
      log(`Contato ${contato?.nome || entity.contato_principal_id} não tem telefone. Não é possível enviar.`);
      return jsonRes({ success: true, skipped: true, reason: 'no_phone', logs });
    }

    log(`Contato principal: ${contato.nome} — ${contato.telefone}`);

    // 3b. Verificar conflito: mesmo telefone com conversa IA ativa no mesmo pipeline
    const { data: pipeline } = await sb.from(entidade_tipo === 'deal' ? 'crm_negocios' : 'crm_tickets')
      .select('pipeline_id')
      .eq('id', entidade_id)
      .maybeSingle();

    if (pipeline?.pipeline_id) {
      // Buscar outras entidades no mesmo pipeline com o mesmo contato
      const otherTable = entidade_tipo === 'deal' ? 'crm_negocios' : 'crm_tickets';
      const statusField = entidade_tipo === 'deal' ? 'status' : 'status';
      const lostStatuses = entidade_tipo === 'deal' ? ['perdido'] : ['fechado', 'resolvido'];

      const { data: samePhoneEntities } = await sb.from(otherTable)
        .select('id, contato_principal_id, status')
        .eq('pipeline_id', pipeline.pipeline_id)
        .eq('contato_principal_id', contato.id)
        .neq('id', entidade_id)
        .is('deletado_em', null);

      // Filter to only active (not lost/closed) entities
      const activeConflicts = (samePhoneEntities || []).filter(
        (e: any) => !lostStatuses.includes(e.status)
      );

      if (activeConflicts.length > 0) {
        // Check if any of them has an active AI conversation
        const conflictIds = activeConflicts.map((e: any) => e.id);
        const { data: activeConvs } = await sb.from('crm_ai_conversations')
          .select('id, entidade_id')
          .eq('entidade_tipo', entidade_tipo)
          .in('entidade_id', conflictIds)
          .eq('status', 'active');

        if (activeConvs && activeConvs.length > 0) {
          log(`CONFLITO: ${activeConvs.length} conversa(s) IA ativa(s) no mesmo pipeline para o mesmo contato. IDs: ${activeConvs.map((c: any) => c.entidade_id).join(', ')}. IA bloqueada para evitar cruzamento.`);
          return jsonRes({ success: true, skipped: true, reason: 'conflict_same_pipeline', conflicting_entities: activeConvs.map((c: any) => c.entidade_id), logs });
        }
      }
    }

    // 4. Resolver welcome message com variáveis
    const welcomeConfig = config.mensagem_boas_vindas || {};
    if (!welcomeConfig.enabled) {
      log('Mensagem de boas-vindas desabilitada. Registra conversa em standby.');
      await ensureConversation(empresa_id, entidade_tipo, entidade_id, estagio_id, config, contato, log);
      return jsonRes({ success: true, skipped: true, reason: 'welcome_disabled', logs });
    }

    // Resolve variables
    let welcomeText = welcomeConfig.text || '';
    const firstName = (contato.nome || '').split(' ')[0];
    welcomeText = welcomeText
      .replace(/\{\{name\}\}/g, contato.nome || '')
      .replace(/\{\{first_name\}\}/g, firstName)
      .replace(/\{\{phone\}\}/g, contato.telefone || '')
      .replace(/\{\{email\}\}/g, contato.email || '');

    // Resolve entity-specific variables
    if (entidade_tipo === 'deal') {
      const { data: deal } = await sb.from('crm_negocios').select('nome, valor, status').eq('id', entidade_id).maybeSingle();
      if (deal) {
        welcomeText = welcomeText
          .replace(/\{\{deal_name\}\}/g, deal.nome || '')
          .replace(/\{\{deal_value\}\}/g, deal.valor ? `R$ ${deal.valor}` : '');
      }
    } else if (entidade_tipo === 'ticket') {
      const { data: ticket } = await sb.from('crm_tickets').select('titulo, status, prioridade, categoria').eq('id', entidade_id).maybeSingle();
      if (ticket) {
        welcomeText = welcomeText
          .replace(/\{\{ticket_title\}\}/g, ticket.titulo || '')
          .replace(/\{\{ticket_status\}\}/g, ticket.status || '')
          .replace(/\{\{ticket_priority\}\}/g, ticket.prioridade || '')
          .replace(/\{\{ticket_category\}\}/g, ticket.categoria || '');
      }
    }

    if (!welcomeText.trim()) {
      log('Welcome text vazio após resolver variáveis. Não envia.');
      await ensureConversation(empresa_id, entidade_tipo, entidade_id, estagio_id, config, contato, log);
      return jsonRes({ success: true, skipped: true, reason: 'empty_welcome', logs });
    }

    log(`Welcome text: "${welcomeText.slice(0, 100)}..."`);

    // 5. Enviar mensagem via provider
    let sent = false;
    if (config.provider === 'evolution') {
      sent = await sendViaEvolution(empresa_id, config.instancia_id, contato.telefone, welcomeText, log);
    } else if (config.provider === 'meta') {
      sent = await sendViaMeta(empresa_id, config.instancia_id, contato.telefone, welcomeText, welcomeConfig, log);
    } else {
      log(`Provider desconhecido: ${config.provider}`);
    }

    // 6. Registrar conversa com a mensagem enviada (reset se já existia)
    const conv = await ensureConversation(empresa_id, entidade_tipo, entidade_id, estagio_id, config, contato, log);
    if (conv) {
      const welcomeMsg = { role: 'assistant', content: welcomeText, timestamp: new Date().toISOString() };
      // Reset: start fresh conversation with just the welcome message
      await sb.from('crm_ai_conversations')
        .update({
          mensagens: sent ? [welcomeMsg] : [],
          total_mensagens: sent ? 1 : 0,
          ultima_mensagem_em: sent ? new Date().toISOString() : null,
          status: 'active',
          contato_id: contato.id,
          contato_telefone: contato.telefone,
        })
        .eq('id', conv.id);
      log(sent ? 'Conversa resetada com welcome message.' : 'Conversa resetada (envio falhou).');
    }

    // 7. Executar transições automáticas
    if (sent) {
      const transicoes = (config.transicoes || []) as any[];
      for (const t of transicoes) {
        if (t.trigger === 'welcome_sent' && t.stageId) {
          log(`Transição welcome_sent → movendo ${entidade_tipo} ${entidade_id} para estágio ${t.stageId}`);
          const moveTable = entidade_tipo === 'deal' ? 'crm_negocios' : 'crm_tickets';
          const { error: moveErr } = await sb.from(moveTable)
            .update({ estagio_id: t.stageId })
            .eq('id', entidade_id);

          if (moveErr) {
            log(`Erro ao mover: ${moveErr.message}`);
          } else {
            log(`✓ ${entidade_tipo} movido para estágio ${t.stageId}`);

            // Atualizar a conversa IA para apontar para o novo estágio
            if (conv) {
              await sb.from('crm_ai_conversations')
                .update({ estagio_id: t.stageId })
                .eq('id', conv.id);
            }

            // Trigger IA do novo estágio (se configurado)
            // Não re-trigger para evitar loop — o novo estágio decidirá ao receber evento 'move'
          }
          break; // Só executa a primeira transição welcome_sent
        }
      }
    }

    log(`=== Concluído: sent=${sent} ===`);
    return jsonRes({ success: true, sent, logs });

  } catch (e: any) {
    log(`ERRO: ${e.message}`);
    return jsonRes({ error: e.message, logs }, 500);
  }
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function jsonRes(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function ensureConversation(
  empresaId: string, entidadeTipo: string, entidadeId: string, estagioId: string,
  config: any, contato: any, log: (msg: string) => void,
) {
  const { data: existing } = await sb.from('crm_ai_conversations')
    .select('*')
    .eq('entidade_tipo', entidadeTipo)
    .eq('entidade_id', entidadeId)
    .eq('estagio_id', estagioId)
    .maybeSingle();

  if (existing) return existing;

  const { data: created, error } = await sb.from('crm_ai_conversations').insert({
    empresa_id: empresaId,
    entidade_tipo: entidadeTipo,
    entidade_id: entidadeId,
    estagio_id: estagioId,
    contato_id: contato?.id || null,
    contato_telefone: contato?.telefone || null,
    provider: config.provider || 'evolution',
    instancia: config.instancia_id || null,
    status: 'active',
    mensagens: [],
    total_mensagens: 0,
  }).select().single();

  if (error) {
    log(`Erro ao criar conversa IA: ${error.message}`);
    return null;
  }
  log(`Conversa IA criada: ${created.id}`);
  return created;
}

async function sendViaEvolution(
  empresaId: string, instanceName: string, phone: string, text: string, log: (msg: string) => void,
): Promise<boolean> {
  try {
    // Load Evolution config from DB (get the one with token)
    const { data: integRows } = await sb.from('integracoes')
      .select('configuracao')
      .eq('empresa_id', empresaId)
      .eq('tipo', 'evolution_api')
      .eq('status', 'conectada');
    const integ = (integRows || []).find((r: any) => r.configuracao?.token_encrypted) || (integRows || [])[0];

    let evoUrl = Deno.env.get('EVOLUTION_API_URL') || '';
    let evoToken = Deno.env.get('EVOLUTION_API_TOKEN') || '';

    if (integ?.configuracao?.url && integ?.configuracao?.token_encrypted) {
      evoUrl = integ.configuracao.url;
      evoToken = await decryptToken(integ.configuracao.token_encrypted);
    }

    if (!evoUrl || !evoToken) {
      log(`Evolution API não configurada. url=${evoUrl ? 'set' : 'empty'}, token=${evoToken ? 'set' : 'empty'}`);
      return false;
    }

    // Normalize phone (ensure country code)
    let normalizedPhone = phone.replace(/\D/g, '');
    if (normalizedPhone.length === 11 && normalizedPhone.startsWith('0')) {
      normalizedPhone = '55' + normalizedPhone.slice(1);
    } else if (normalizedPhone.length <= 11 && !normalizedPhone.startsWith('55')) {
      normalizedPhone = '55' + normalizedPhone;
    }

    log(`Enviando via Evolution: ${evoUrl}/message/sendText/${instanceName} → ${normalizedPhone}`);

    const res = await fetch(`${evoUrl}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: { apikey: evoToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ number: normalizedPhone, text }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      log(`Evolution API error: HTTP ${res.status} — ${err.slice(0, 200)}`);
      return false;
    }

    log('Mensagem enviada via Evolution com sucesso.');
    return true;
  } catch (e: any) {
    log(`Evolution send error: ${e.message}`);
    return false;
  }
}

async function sendViaMeta(
  empresaId: string, accountId: string, phone: string, text: string, welcomeConfig: any, log: (msg: string) => void,
): Promise<boolean> {
  try {
    // Load Meta account
    const sbPublic = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: account } = await sbPublic.from('meta_inbox_accounts')
      .select('phone_number_id, access_token')
      .eq('id', accountId)
      .maybeSingle();

    if (!account) {
      log(`Meta account ${accountId} não encontrada.`);
      return false;
    }

    const accessToken = await decryptToken(account.access_token);
    let normalizedPhone = phone.replace(/\D/g, '');
    if (normalizedPhone.length <= 11 && !normalizedPhone.startsWith('55')) {
      normalizedPhone = '55' + normalizedPhone;
    }

    // Check if welcome text starts with "template:" (template-based)
    if (text.startsWith('template:')) {
      const templateName = text.replace('template:', '').trim();
      log(`Enviando template Meta: ${templateName} → ${normalizedPhone}`);

      const res = await fetch(`https://graph.facebook.com/v19.0/${account.phone_number_id}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: normalizedPhone,
          type: 'template',
          template: { name: templateName, language: { code: 'pt_BR' } },
        }),
      });

      if (!res.ok) {
        const err = await res.text().catch(() => '');
        log(`Meta API error: HTTP ${res.status} — ${err.slice(0, 200)}`);
        return false;
      }
    } else {
      // Free text (only works within 24h window)
      log(`Enviando texto Meta → ${normalizedPhone}`);
      const res = await fetch(`https://graph.facebook.com/v19.0/${account.phone_number_id}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: normalizedPhone,
          type: 'text',
          text: { body: text },
        }),
      });

      if (!res.ok) {
        const err = await res.text().catch(() => '');
        log(`Meta API error: HTTP ${res.status} — ${err.slice(0, 200)}`);
        return false;
      }
    }

    log('Mensagem enviada via Meta com sucesso.');
    return true;
  } catch (e: any) {
    log(`Meta send error: ${e.message}`);
    return false;
  }
}
