/**
 * HubSpot API service — all calls proxied through Supabase Edge Function.
 * Avoids CORS issues by using hubspot-proxy edge function.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://lwusznsduxcqjjmbbobt.supabase.co';
const PROXY_URL = `${SUPABASE_URL}/functions/v1/hubspot-proxy`;

async function hsCall(token: string, path: string): Promise<any> {
  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-hubspot-token': token },
    body: JSON.stringify({ path, method: 'GET' }),
  });
  const data = await res.json();
  if (data.error || data.status === 'error') throw new Error(data.message || data.error || 'HubSpot API error');
  return data;
}

// ─── Account Info ───────────────────────────────────────────────────────────
export async function getAccountInfo(token: string) {
  const data = await hsCall(token, '/account-info/v3/details');
  return { portalId: data.portalId, companyName: data.companyCurrency, timeZone: data.timeZone, uiDomain: data.uiDomain };
}

// ─── Verify Connection ──────────────────────────────────────────────────────
export async function verifyConnection(token: string): Promise<{ ok: boolean; portalId?: number; error?: string }> {
  try {
    const info = await hsCall(token, '/account-info/v3/details');
    return { ok: true, portalId: info.portalId };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

// ─── Pipelines ──────────────────────────────────────────────────────────────
export interface HsPipeline {
  id: string;
  label: string;
  stages: { id: string; label: string; displayOrder: number; metadata?: Record<string, string> }[];
}

export async function getPipelines(token: string, objectType: 'deals' | 'tickets'): Promise<HsPipeline[]> {
  const data = await hsCall(token, `/crm/v3/pipelines/${objectType}`);
  return (data.results || []).map((p: any) => ({
    id: p.id,
    label: p.label,
    stages: (p.stages || []).map((s: any) => ({
      id: s.id,
      label: s.label,
      displayOrder: s.displayOrder,
      metadata: s.metadata,
    })).sort((a: any, b: any) => a.displayOrder - b.displayOrder),
  }));
}

// ─── Get Single Object ──────────────────────────────────────────────────────
export type HsObjectType = 'contacts' | 'companies' | 'deals' | 'tickets';

export interface HsObject {
  id: string;
  properties: Record<string, string | null>;
  associations?: Record<string, { results: { id: string; type: string }[] }>;
}

const DEFAULT_PROPS: Record<HsObjectType, string> = {
  contacts: 'firstname,lastname,email,phone,jobtitle,lifecyclestage,company,hs_lead_status,createdate',
  companies: 'name,domain,phone,website,industry,numberofemployees,city,state,country,createdate',
  deals: 'dealname,amount,dealstage,pipeline,closedate,hs_deal_stage_probability,createdate',
  tickets: 'subject,content,hs_ticket_priority,hs_pipeline,hs_pipeline_stage,createdate',
};

export async function getObject(token: string, objectType: HsObjectType, objectId: string): Promise<HsObject> {
  const props = DEFAULT_PROPS[objectType];
  const associations = objectType === 'contacts' ? 'companies,deals,tickets'
    : objectType === 'companies' ? 'contacts,deals,tickets'
    : objectType === 'deals' ? 'contacts,companies,tickets'
    : 'contacts,companies,deals';

  const path = `/crm/v3/objects/${objectType}/${objectId}?properties=${props}&associations=${associations}`;
  return await hsCall(token, path);
}

// ─── Get Multiple Associated Objects ────────────────────────────────────────
export async function getObjectsBatch(token: string, objectType: HsObjectType, ids: string[]): Promise<HsObject[]> {
  if (ids.length === 0) return [];
  const props = DEFAULT_PROPS[objectType];
  const results: HsObject[] = [];
  // Fetch one by one to keep it simple (batch API needs POST which is more complex)
  for (const id of ids.slice(0, 20)) { // Limit to 20 to avoid overloading
    try {
      const obj = await hsCall(token, `/crm/v3/objects/${objectType}/${id}?properties=${props}`);
      results.push(obj);
    } catch { /* skip failed objects */ }
  }
  return results;
}

// ─── Map HubSpot → Our CRM ─────────────────────────────────────────────────
export function mapContact(hs: HsObject) {
  const p = hs.properties;
  const nome = [p.firstname, p.lastname].filter(Boolean).join(' ') || 'Sem nome';
  return {
    nome,
    email: p.email || null,
    telefone: p.phone || null,
    cargo: p.jobtitle || null,
    status: mapLifecycleStage(p.lifecyclestage),
    fonte: 'importacao' as const,
    dados_custom: { hubspot_id: hs.id, hubspot_company: p.company, hubspot_lead_status: p.hs_lead_status },
  };
}

export function mapCompany(hs: HsObject) {
  const p = hs.properties;
  return {
    nome: p.name || 'Sem nome',
    dominio: p.domain || null,
    telefone: p.phone || null,
    website: p.website || null,
    setor: p.industry || null,
    cidade: p.city || null,
    estado: p.state || null,
    pais: p.country || 'Brazil',
    dados_custom: { hubspot_id: hs.id, hubspot_employees: p.numberofemployees },
  };
}

export function mapDeal(hs: HsObject) {
  const p = hs.properties;
  return {
    nome: p.dealname || 'Sem nome',
    valor: p.amount ? parseFloat(p.amount) : null,
    status: 'aberto' as const,
    data_fechamento_prevista: p.closedate ? p.closedate.slice(0, 10) : null,
    dados_custom: { hubspot_id: hs.id, hubspot_stage: p.dealstage, hubspot_pipeline: p.pipeline },
  };
}

export function mapTicket(hs: HsObject) {
  const p = hs.properties;
  return {
    titulo: p.subject || 'Sem título',
    descricao: p.content || null,
    prioridade: mapPriority(p.hs_ticket_priority),
    status: 'aberto' as const,
    dados_custom: { hubspot_id: hs.id, hubspot_pipeline: p.hs_pipeline, hubspot_stage: p.hs_pipeline_stage },
  };
}

function mapLifecycleStage(stage: string | null): 'lead' | 'qualified' | 'customer' | 'churned' {
  if (!stage) return 'lead';
  if (['customer', 'evangelist'].includes(stage)) return 'customer';
  if (['salesqualifiedlead', 'marketingqualifiedlead', 'opportunity'].includes(stage)) return 'qualified';
  return 'lead';
}

function mapPriority(p: string | null): 'low' | 'medium' | 'high' | 'urgent' {
  if (!p) return 'medium';
  if (p === 'HIGH') return 'high';
  if (p === 'LOW') return 'low';
  return 'medium';
}
