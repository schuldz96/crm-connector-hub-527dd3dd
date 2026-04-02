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
export type HsEngagementType = 'notes' | 'meetings' | 'calls' | 'tasks' | 'emails' | 'communications' | 'postal_mail' | 'feedback_submissions';
export type HsAnyObjectType = HsObjectType | HsEngagementType;

export interface HsObject {
  id: string;
  properties: Record<string, string | null>;
  associations?: Record<string, { results: { id: string; type: string }[] }>;
}

const DEFAULT_PROPS: Record<HsAnyObjectType, string> = {
  contacts: 'firstname,lastname,email,phone,jobtitle,lifecyclestage,company,hs_lead_status,hubspot_owner_id,createdate',
  companies: 'name,domain,phone,website,industry,numberofemployees,city,state,country,hubspot_owner_id,createdate',
  deals: 'dealname,amount,dealstage,pipeline,closedate,hs_deal_stage_probability,hubspot_owner_id,createdate',
  tickets: 'subject,content,hs_ticket_priority,hs_pipeline,hs_pipeline_stage,hubspot_owner_id,createdate',
  notes: 'hs_note_body,hubspot_owner_id,hs_timestamp,hs_createdate',
  meetings: 'hs_meeting_title,hs_meeting_start_time,hs_meeting_end_time,hs_meeting_outcome,hs_meeting_location,hubspot_owner_id,hs_timestamp,hs_createdate',
  calls: 'hs_call_title,hs_call_body,hs_call_duration,hs_call_direction,hs_call_disposition,hs_call_status,hubspot_owner_id,hs_timestamp,hs_createdate',
  tasks: 'hs_task_subject,hs_task_body,hs_task_status,hs_task_priority,hs_task_type,hubspot_owner_id,hs_timestamp,hs_createdate',
  emails: 'hs_email_subject,hs_email_text,hs_email_direction,hs_email_status,hs_email_sender_email,hubspot_owner_id,hs_timestamp,hs_createdate',
  communications: 'hs_communication_channel_type,hs_communication_body,hs_communication_logged_from,hubspot_owner_id,hs_timestamp,hs_createdate',
  postal_mail: 'hs_postal_mail_body,hubspot_owner_id,hs_timestamp,hs_createdate',
  feedback_submissions: 'hs_content,hs_submission_name,hs_response_group,hubspot_owner_id,hs_timestamp,hs_createdate',
};

// All engagement types we fetch as associations
const ENGAGEMENT_TYPES: HsEngagementType[] = ['notes', 'meetings', 'calls', 'tasks', 'emails', 'communications', 'postal_mail', 'feedback_submissions'];

// Associations to request per CRM object type (includes engagements)
const ALL_ENGAGEMENTS = ENGAGEMENT_TYPES.join(',');
const ASSOCIATIONS: Record<HsObjectType, string> = {
  contacts: `companies,deals,tickets,${ALL_ENGAGEMENTS}`,
  companies: `contacts,deals,tickets,${ALL_ENGAGEMENTS}`,
  deals: `contacts,companies,tickets,${ALL_ENGAGEMENTS}`,
  tickets: `contacts,companies,deals,${ALL_ENGAGEMENTS}`,
};

export async function getObject(token: string, objectType: HsObjectType, objectId: string): Promise<HsObject> {
  const props = DEFAULT_PROPS[objectType];
  const associations = ASSOCIATIONS[objectType];
  const path = `/crm/v3/objects/${objectType}/${objectId}?properties=${props}&associations=${associations}`;
  return await hsCall(token, path);
}

// ─── Get Multiple Associated Objects ────────────────────────────────────────
export async function getObjectsBatch(token: string, objectType: HsAnyObjectType, ids: string[]): Promise<HsObject[]> {
  if (ids.length === 0) return [];
  const props = DEFAULT_PROPS[objectType];
  const results: HsObject[] = [];
  for (const id of ids.slice(0, 20)) {
    try {
      const obj = await hsCall(token, `/crm/v3/objects/${objectType}/${id}?properties=${props}`);
      results.push(obj);
    } catch { /* skip failed objects */ }
  }
  return results;
}

// ─── Deep fetch: get engagements from associated CRM objects ────────────────
export async function getDeepEngagements(
  token: string,
  mainObj: HsObject,
  mainType: HsObjectType,
): Promise<{ crmObjects: { type: HsObjectType; obj: HsObject }[]; engagements: { type: HsEngagementType; obj: HsObject }[] }> {
  const seen = new Set<string>(); // dedup key: "type-id"
  const crmObjects: { type: HsObjectType; obj: HsObject }[] = [];
  const engagements: { type: HsEngagementType; obj: HsObject }[] = [];

  const addEngagement = (type: HsEngagementType, obj: HsObject) => {
    const key = `${type}-${obj.id}`;
    if (!seen.has(key)) { seen.add(key); engagements.push({ type, obj }); }
  };

  const addCrmObject = (type: HsObjectType, obj: HsObject) => {
    const key = `${type}-${obj.id}`;
    if (!seen.has(key)) { seen.add(key); crmObjects.push({ type, obj }); }
  };

  // Mark main object as seen
  seen.add(`${mainType}-${mainObj.id}`);

  if (!mainObj.associations) return { crmObjects, engagements };

  // Phase 1: collect IDs by type from main object associations
  const assocIdsByType: Record<string, string[]> = {};
  for (const [assocType, assocData] of Object.entries(mainObj.associations)) {
    const ids = assocData.results?.map((r: any) => r.id) || [];
    if (ids.length > 0) assocIdsByType[assocType] = ids;
  }

  // Phase 2: fetch all associations in parallel (CRM objects + direct engagements)
  const fetchPromises: Promise<void>[] = [];

  for (const [assocType, ids] of Object.entries(assocIdsByType)) {
    const isEng = (ENGAGEMENT_TYPES as string[]).includes(assocType);
    fetchPromises.push(
      getObjectsBatch(token, assocType as HsAnyObjectType, ids).then(objects => {
        for (const obj of objects) {
          if (isEng) {
            addEngagement(assocType as HsEngagementType, obj);
          } else {
            addCrmObject(assocType as HsObjectType, obj);
          }
        }
      })
    );
  }

  await Promise.all(fetchPromises);

  // Phase 3: fetch engagements from associated CRM objects (deep)
  const deepPromises: Promise<void>[] = [];
  const CRM_TYPES: HsObjectType[] = ['contacts', 'companies', 'deals', 'tickets'];

  for (const { type: crmType, obj: crmObj } of [...crmObjects]) {
    // Fetch this CRM object WITH its engagements
    deepPromises.push(
      getObject(token, crmType, crmObj.id).then(fullObj => {
        if (!fullObj.associations) return;
        const engPromises: Promise<void>[] = [];
        for (const engType of ENGAGEMENT_TYPES) {
          const engIds = fullObj.associations[engType]?.results?.map((r: any) => r.id) || [];
          // Filter out already-seen IDs
          const newIds = engIds.filter(id => !seen.has(`${engType}-${id}`));
          if (newIds.length > 0) {
            engPromises.push(
              getObjectsBatch(token, engType, newIds).then(objs => {
                for (const o of objs) addEngagement(engType, o);
              })
            );
          }
        }
        return Promise.all(engPromises) as Promise<any>;
      }).catch(() => {}) // skip failed deep fetches
    );
  }

  await Promise.all(deepPromises);

  return { crmObjects, engagements };
}

export { ENGAGEMENT_TYPES };

// ─── Owners ────────────────────────────────────────────────────────────────
export interface HsOwner {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export async function getOwners(token: string): Promise<HsOwner[]> {
  const data = await hsCall(token, '/crm/v3/owners?limit=500');
  return (data.results || []).map((o: any) => ({
    id: String(o.id),
    firstName: o.firstName || '',
    lastName: o.lastName || '',
    email: o.email || '',
  }));
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
