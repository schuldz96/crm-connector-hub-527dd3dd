require('dotenv').config();

const { google } = require('googleapis');
const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const PORT = Number(process.env.PORT || 3333);
const KEYFILE = process.env.KEYFILE || path.join(__dirname, 'service-account.json');

const ORG_UNIT_PATH = process.env.ORG_UNIT_PATH || '/Comercial';
const ORG_UNIT_PATHS = process.env.ORG_UNIT_PATHS || '';
const DEFAULT_SINCE_ISO = process.env.DEFAULT_SINCE_ISO || '2026-02-26T00:00:00Z';
const DESTINATION_FOLDER_ID = process.env.DESTINATION_FOLDER_ID || '';
const ADMIN_SUBJECT = process.env.ADMIN_SUBJECT || '';
const WEBHOOK_TOKEN = process.env.WEBHOOK_TOKEN || 'api-meet-comercial';
const CORS_ALLOWED_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const CORS_ALLOWED_ORIGIN_SUFFIX = (process.env.CORS_ALLOWED_ORIGIN_SUFFIX || '.lovable.app').trim().toLowerCase();

function isOriginAllowed(origin) {
  if (!origin) return false;

  const normalized = origin.toLowerCase();
  if (CORS_ALLOWED_ORIGINS.includes('*')) return true;
  if (CORS_ALLOWED_ORIGINS.some((allowed) => allowed.toLowerCase() === normalized)) return true;
  if (CORS_ALLOWED_ORIGIN_SUFFIX && normalized.endsWith(CORS_ALLOWED_ORIGIN_SUFFIX)) return true;

  return false;
}

const DATABASE_URL = process.env.DATABASE_URL || '';
const DB_SSL_DISABLED = String(process.env.DB_SSL_DISABLED || 'false').toLowerCase() === 'true';

const CRON_ENABLED = String(process.env.CRON_ENABLED || 'true').toLowerCase() !== 'false';
const CRON_INTERVAL_MINUTES = Number(process.env.CRON_INTERVAL_MINUTES || 30);
const CRON_LOOKBACK_MINUTES = Number(process.env.CRON_LOOKBACK_MINUTES || 60);
const CRON_TRANSCRIPT_DELAY_MINUTES = Number(process.env.CRON_TRANSCRIPT_DELAY_MINUTES || 30);
const CRON_TRANSCRIPT_BATCH_SIZE = Number(process.env.CRON_TRANSCRIPT_BATCH_SIZE || 20);
const REPORTS_CUSTOMER_ID = process.env.REPORTS_CUSTOMER_ID || 'my_customer';
const INTERNAL_EMAIL_DOMAIN = (
  process.env.INTERNAL_EMAIL_DOMAIN ||
  (ADMIN_SUBJECT.includes('@') ? ADMIN_SUBJECT.split('@')[1] : '')
).toLowerCase();

const ADMIN_SCOPES = ['https://www.googleapis.com/auth/admin.directory.user.readonly'];
const REPORTS_SCOPES = ['https://www.googleapis.com/auth/admin.reports.audit.readonly'];
const DRIVE_SCOPES = ['https://www.googleapis.com/auth/drive'];

function buildDatabaseConfig(connectionString) {
  const normalized = new URL(connectionString);
  normalized.searchParams.delete('sslmode');
  normalized.searchParams.delete('sslcert');
  normalized.searchParams.delete('sslkey');
  normalized.searchParams.delete('sslrootcert');
  return {
    connectionString: normalized.toString(),
    ssl: DB_SSL_DISABLED ? false : { rejectUnauthorized: false },
  };
}

const pool = DATABASE_URL ? new Pool(buildDatabaseConfig(DATABASE_URL)) : null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry(label, fn, options = {}) {
  const retries = options.retries ?? 2;
  const baseDelayMs = options.baseDelayMs ?? 500;

  for (let attempt = 0; ; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= retries) {
        throw error;
      }
      const delayMs = baseDelayMs * 2 ** attempt;
      console.log(`[retry] ${label} falhou na tentativa ${attempt + 1}: ${error.message}. Nova tentativa em ${delayMs}ms`);
      await sleep(delayMs);
    }
  }
}

function requireEnvValue(name, value) {
  if (!value) {
    throw new Error(`Variável obrigatória não definida: ${name}`);
  }
}

function requireDatabase() {
  if (!pool) {
    throw new Error('DATABASE_URL não configurada');
  }
}

async function initializeDatabaseConnection() {
  if (!pool) {
    console.log('[db] DATABASE_URL ausente; integração com Postgres desabilitada');
    return false;
  }

  try {
    await withRetry(
      'db.connectivity',
      () => pool.query('SELECT 1'),
      { retries: 4, baseDelayMs: 1000 }
    );
    console.log('[db] Conexão com Supabase/Postgres estabelecida');
    return true;
  } catch (error) {
    console.log(`[db] Falha ao conectar no Supabase/Postgres: ${error.message}`);
    return false;
  }
}

function authAsUser(userEmail, scopes) {
  requireEnvValue('KEYFILE', KEYFILE);
  return new google.auth.GoogleAuth({
    keyFile: KEYFILE,
    scopes,
    clientOptions: { subject: userEmail },
  });
}

function authAsServiceAccount(scopes) {
  requireEnvValue('KEYFILE', KEYFILE);
  return new google.auth.GoogleAuth({
    keyFile: KEYFILE,
    scopes,
  });
}

function normalizeEmail(email) {
  if (!email || typeof email !== 'string') {
    return null;
  }
  const trimmed = email.trim().toLowerCase();
  return trimmed || null;
}

function escapeDriveQueryValue(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function getConfiguredOrgUnits() {
  const raw = ORG_UNIT_PATHS || ORG_UNIT_PATH || '/Comercial';
  const orgUnits = raw
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return Array.from(new Set(orgUnits));
}

function isInternalEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return false;
  }
  if (!INTERNAL_EMAIL_DOMAIN) {
    return true;
  }
  return normalized.endsWith(`@${INTERNAL_EMAIL_DOMAIN}`);
}

function computeCallInterna({ participants, organizerEmail }) {
  const emails = new Set();
  const normalizedOrganizer = normalizeEmail(organizerEmail);
  if (normalizedOrganizer) {
    emails.add(normalizedOrganizer);
  }

  for (const participant of participants || []) {
    const normalized = normalizeEmail(participant);
    if (normalized) {
      emails.add(normalized);
    }
  }

  if (emails.size === 0) {
    return true;
  }

  for (const email of emails) {
    if (!isInternalEmail(email)) {
      return false;
    }
  }

  return true;
}

function buildTranscriptOwnerCandidates(conference) {
  const candidates = [];
  const seen = new Set();

  const pushCandidate = (email) => {
    const normalized = normalizeEmail(email);
    if (!normalized || seen.has(normalized)) {
      return;
    }
    if (!isInternalEmail(normalized)) {
      return;
    }
    seen.add(normalized);
    candidates.push(normalized);
  };

  pushCandidate(conference?.organizer_email);

  for (const participant of conference?.participants || []) {
    pushCandidate(participant);
  }

  return candidates;
}


function asIsoMinute(dateInput) {
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  date.setSeconds(0, 0);
  return date.toISOString();
}

function toIsoStringOrNull(dateInput) {
  if (!dateInput) {
    return null;
  }
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

function isLikelyEmail(value) {
  return /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(value || '');
}

function parseEventParameters(parameters) {
  const map = new Map();
  for (const param of parameters || []) {
    if (!param || !param.name) {
      continue;
    }

    const key = String(param.name).toLowerCase();
    const values = [];

    if (typeof param.value === 'string' && param.value.length > 0) {
      values.push(param.value);
    }
    if (typeof param.intValue === 'string' && param.intValue.length > 0) {
      values.push(param.intValue);
    }
    if (typeof param.boolValue === 'boolean') {
      values.push(String(param.boolValue));
    }
    if (Array.isArray(param.multiValue)) {
      for (const value of param.multiValue) {
        if (typeof value === 'string' && value.length > 0) {
          values.push(value);
        }
      }
    }
    if (Array.isArray(param.multiIntValue)) {
      for (const value of param.multiIntValue) {
        if (typeof value === 'string' && value.length > 0) {
          values.push(value);
        }
      }
    }

    map.set(key, values);
  }

  return map;
}

function pickFirstParamValue(paramMap, matchers) {
  for (const [key, values] of paramMap.entries()) {
    const matched = matchers.some((matcher) =>
      typeof matcher === 'string' ? key === matcher.toLowerCase() : matcher.test(key)
    );

    if (!matched) {
      continue;
    }

    const value = (values || []).find((entry) => String(entry || '').trim().length > 0);
    if (value) {
      return String(value).trim();
    }
  }
  return null;
}

function extractEmailsFromParamMap(paramMap) {
  const emails = new Set();

  const identifierTypeValues = paramMap.get('identifier_type') || [];
  const identifierValues = paramMap.get('identifier') || [];
  const hasEmailIdentifier = identifierTypeValues.some(
    (value) => String(value || '').toLowerCase() === 'email_address'
  );

  if (hasEmailIdentifier) {
    for (const value of identifierValues) {
      const normalized = normalizeEmail(value);
      if (normalized && isLikelyEmail(normalized)) {
        emails.add(normalized);
      }
    }
  }

  for (const [key, values] of paramMap.entries()) {
    const relevant =
      /participant|attendee|member|user|host|organizer|email|owner|actor|identifier/.test(key);
    if (!relevant) {
      continue;
    }

    for (const value of values || []) {
      const text = String(value || '');
      const found = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
      for (const email of found) {
        emails.add(email.toLowerCase());
      }
    }
  }

  return emails;
}

function isStartEvent(eventName) {
  return /(start|started|create|created|join|joined|begin|opened)/i.test(eventName || '');
}

function isEndEvent(eventName) {
  return /(end|ended|leave|left|hangup|close|closed|finish|finished)/i.test(eventName || '');
}

function buildConferenceKey({ stableId, meetingCode, organizerEmail, eventTimestamp }) {
  if (stableId) {
    return `meet:${stableId}`;
  }

  const normalizedMeetingCode = (meetingCode || 'unknown-code').toLowerCase();
  const minuteBucket = asIsoMinute(eventTimestamp) || 'unknown-minute';
  const organizer = (organizerEmail || 'unknown-organizer').toLowerCase();

  return `fallback:${normalizedMeetingCode}:${minuteBucket}:${organizer}`;
}

async function getUsersFromSingleOu(orgUnitPath) {
  requireEnvValue('ADMIN_SUBJECT', ADMIN_SUBJECT);

  const auth = authAsUser(ADMIN_SUBJECT, ADMIN_SCOPES);
  const admin = google.admin({ version: 'directory_v1', auth });

  const res = await admin.users.list({
    customer: 'my_customer',
    query: `orgUnitPath='${orgUnitPath}'`,
    maxResults: 500,
    orderBy: 'email',
  });

  return res.data.users || [];
}

async function getUsersFromOU() {
  const orgUnits = getConfiguredOrgUnits();
  const byEmail = new Map();

  for (const orgUnitPath of orgUnits) {
    const users = await getUsersFromSingleOu(orgUnitPath);
    for (const user of users) {
      const email = normalizeEmail(user?.primaryEmail);
      if (!email || byEmail.has(email)) {
        continue;
      }
      byEmail.set(email, user);
    }
  }

  return Array.from(byEmail.values());
}

async function getOuEmailContext() {
  const orgUnits = getConfiguredOrgUnits();
  const emails = new Set();
  const emailToOrgUnit = new Map();
  const usersByOrgUnit = {};

  for (const orgUnitPath of orgUnits) {
    const users = await getUsersFromSingleOu(orgUnitPath);
    usersByOrgUnit[orgUnitPath] = 0;

    for (const user of users) {
      const email = normalizeEmail(user?.primaryEmail);
      if (!email) {
        continue;
      }

      emails.add(email);
      usersByOrgUnit[orgUnitPath] += 1;

      if (!emailToOrgUnit.has(email)) {
        emailToOrgUnit.set(email, orgUnitPath);
      }
    }
  }

  return {
    orgUnits,
    usersByOrgUnit,
    emailSet: emails,
    emailToOrgUnit,
  };
}

async function listTranscriptsForUser(userEmail, sinceIso, options = {}) {
  const auth = authAsUser(userEmail, DRIVE_SCOPES);
  const drive = google.drive({ version: 'v3', auth });

  const q = [
    "mimeType='application/vnd.google-apps.document'",
    "name contains 'Transcri'",
    `createdTime >= '${sinceIso}'`,
    'trashed = false',
  ];

  if (options.meetingCode) {
    q.push(`name contains '${escapeDriveQueryValue(options.meetingCode)}'`);
  }

  const res = await drive.files.list({
    q: q.join(' and '),
    fields: 'files(id, name, createdTime)',
    pageSize: 200,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  return res.data.files || [];
}

async function listRecordingsForUser(userEmail, sinceIso, options = {}) {
  const auth = authAsUser(userEmail, DRIVE_SCOPES);
  const drive = google.drive({ version: 'v3', auth });

  const q = [
    "mimeType='video/mp4'",
    `createdTime >= '${sinceIso}'`,
    'trashed = false',
  ];

  if (options.meetingCode) {
    q.push(`name contains '${escapeDriveQueryValue(options.meetingCode)}'`);
  }

  const res = await drive.files.list({
    q: q.join(' and '),
    fields: 'files(id, name, mimeType, createdTime, size, webViewLink, webContentLink)',
    pageSize: 200,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  return res.data.files || [];
}

async function exportDocAsText(userEmail, fileId) {
  const auth = authAsUser(userEmail, DRIVE_SCOPES);
  const drive = google.drive({ version: 'v3', auth });

  const res = await drive.files.export(
    { fileId, mimeType: 'text/plain' },
    { responseType: 'text' }
  );

  return res.data || '';
}

async function exportCopiedDocAsText(fileId) {
  const auth = authAsServiceAccount(DRIVE_SCOPES);
  const drive = google.drive({ version: 'v3', auth });

  const res = await drive.files.export(
    { fileId, mimeType: 'text/plain' },
    { responseType: 'text' }
  );

  return res.data || '';
}

async function getDriveFileMetadataAsUser(userEmail, fileId) {
  const auth = authAsUser(userEmail, DRIVE_SCOPES);
  const drive = google.drive({ version: 'v3', auth });

  const res = await drive.files.get({
    fileId,
    fields: 'id,name,mimeType,size,webViewLink,webContentLink,createdTime',
    supportsAllDrives: true,
  });

  return res.data || null;
}

async function findCopiedDocBySourceId(sourceId) {
  requireEnvValue('DESTINATION_FOLDER_ID', DESTINATION_FOLDER_ID);

  const auth = authAsServiceAccount(DRIVE_SCOPES);
  const drive = google.drive({ version: 'v3', auth });

  const q = [
    `'${DESTINATION_FOLDER_ID}' in parents`,
    "mimeType='application/vnd.google-apps.document'",
    'trashed = false',
    `appProperties has { key='sourceId' and value='${escapeDriveQueryValue(sourceId)}' }`,
  ].join(' and ');

  const res = await drive.files.list({
    q,
    fields: 'files(id, name)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    pageSize: 1,
  });

  return (res.data.files || [])[0] || null;
}

async function findCopiedFileBySourceId(sourceId, sourceType) {
  requireEnvValue('DESTINATION_FOLDER_ID', DESTINATION_FOLDER_ID);

  const auth = authAsServiceAccount(DRIVE_SCOPES);
  const drive = google.drive({ version: 'v3', auth });

  const q = [
    `'${DESTINATION_FOLDER_ID}' in parents`,
    'trashed = false',
    `appProperties has { key='sourceId' and value='${escapeDriveQueryValue(sourceId)}' }`,
    `appProperties has { key='sourceType' and value='${escapeDriveQueryValue(sourceType)}' }`,
  ].join(' and ');

  const res = await drive.files.list({
    q,
    fields: 'files(id, name, mimeType, size, webViewLink, webContentLink)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    pageSize: 1,
  });

  return (res.data.files || [])[0] || null;
}

async function createDocWithContent({ title, text, sourceId, owner }) {
  requireEnvValue('DESTINATION_FOLDER_ID', DESTINATION_FOLDER_ID);

  const auth = authAsServiceAccount(DRIVE_SCOPES);
  const drive = google.drive({ version: 'v3', auth });

  const fileMetadata = {
    name: title,
    mimeType: 'application/vnd.google-apps.document',
    parents: [DESTINATION_FOLDER_ID],
    appProperties: {
      sourceId,
      sourceOwner: owner,
    },
  };

  const media = {
    mimeType: 'text/plain',
    body: text || '',
  };

  const created = await drive.files.create({
    requestBody: fileMetadata,
    media,
    supportsAllDrives: true,
    fields: 'id',
  });

  return created.data.id;
}

async function copyFileToDestinationFromOwner({ userEmail, sourceFileId, title, sourceType }) {
  requireEnvValue('DESTINATION_FOLDER_ID', DESTINATION_FOLDER_ID);

  const auth = authAsUser(userEmail, DRIVE_SCOPES);
  const drive = google.drive({ version: 'v3', auth });

  const copied = await drive.files.copy({
    fileId: sourceFileId,
    requestBody: {
      name: title,
      parents: [DESTINATION_FOLDER_ID],
      appProperties: {
        sourceId: sourceFileId,
        sourceType,
        sourceOwner: userEmail,
      },
    },
    supportsAllDrives: true,
    fields: 'id,name,mimeType,size,webViewLink,webContentLink',
  });

  return copied.data || null;
}

async function runCollector({ sinceIso, email }) {
  const since = sinceIso || DEFAULT_SINCE_ISO;

  let users;
  if (email) {
    users = [{ primaryEmail: email }];
  } else {
    users = await getUsersFromOU();
  }

  const summary = {
    since,
    email: email || null,
    usersChecked: 0,
    transcriptsFound: 0,
    created: 0,
    skippedDuplicates: 0,
    errors: [],
  };

  for (const user of users) {
    const userEmail = user.primaryEmail;
    if (!userEmail) {
      continue;
    }

    summary.usersChecked += 1;
    console.log(`🔎 Verificando usuário: ${userEmail}`);

    let files;
    try {
      files = await withRetry(`listTranscriptsForUser(${userEmail})`, () =>
        listTranscriptsForUser(userEmail, since)
      );
      console.log(`📄 Encontradas ${files.length} transcrições para ${userEmail}`);
    } catch (error) {
      console.log(`❌ Erro ao listar arquivos de ${userEmail}: ${error.message}`);
      summary.errors.push({ user: userEmail, step: 'list', error: error.message });
      continue;
    }

    summary.transcriptsFound += files.length;

    for (const file of files) {
      try {
        console.log(`📂 Arquivo: ${file.name} (${file.createdTime || ''})`);

        const copied = await withRetry(`findCopiedDocBySourceId(${file.id})`, () =>
          findCopiedDocBySourceId(file.id)
        );
        if (copied) {
          summary.skippedDuplicates += 1;
          console.log(`⏭️ Duplicado ignorado: ${file.name}`);
          continue;
        }

        const text = await withRetry(`exportDocAsText(${file.id})`, () =>
          exportDocAsText(userEmail, file.id)
        );

        await withRetry(`createDocWithContent(${file.id})`, () =>
          createDocWithContent({
            title: file.name,
            text,
            sourceId: file.id,
            owner: userEmail,
          })
        );

        summary.created += 1;
        console.log(`✅ Criado: ${file.name}`);
      } catch (error) {
        console.log(`❌ Erro no arquivo ${file.name}: ${error.message}`);
        summary.errors.push({
          user: userEmail,
          file: file.name,
          error: error.message,
        });
      }
    }
  }

  return summary;
}

async function listMeetActivities(startIso, endIso) {
  requireEnvValue('ADMIN_SUBJECT', ADMIN_SUBJECT);

  const auth = authAsUser(ADMIN_SUBJECT, REPORTS_SCOPES);
  const reports = google.admin({ version: 'reports_v1', auth });

  const activities = [];
  let pageToken;

  do {
    const res = await reports.activities.list({
      userKey: 'all',
      applicationName: 'meet',
      customerId: REPORTS_CUSTOMER_ID,
      startTime: startIso,
      endTime: endIso,
      maxResults: 1000,
      pageToken,
    });

    activities.push(...(res.data.items || []));
    pageToken = res.data.nextPageToken;
  } while (pageToken);

  return activities;
}

function resolveConferenceSourceOrgUnit(conference, emailToOrgUnit) {
  if (!conference || !emailToOrgUnit || emailToOrgUnit.size === 0) {
    return null;
  }
  const organizer = normalizeEmail(conference.organizer_email);
  if (organizer && emailToOrgUnit.has(organizer)) {
    return emailToOrgUnit.get(organizer);
  }

  for (const participant of conference.participants || []) {
    const email = normalizeEmail(participant);
    if (email && emailToOrgUnit.has(email)) {
      return emailToOrgUnit.get(email);
    }
  }

  return null;
}

function consolidateActivitiesToConferences(activities, emailToOrgUnit = null) {
  const grouped = new Map();

  for (const activity of activities || []) {
    const actorEmail = normalizeEmail(activity?.actor?.email);
    const activityTime = toIsoStringOrNull(activity?.id?.time) || new Date().toISOString();
    const events = Array.isArray(activity?.events) && activity.events.length > 0 ? activity.events : [{ name: 'activity' }];

    for (const event of events) {
      const eventName = String(event?.name || 'activity').toLowerCase();
      const paramMap = parseEventParameters(event?.parameters || []);

      const stableId = pickFirstParamValue(paramMap, [
        /^conference_record_id$/,
        /^conferencerecordid$/,
        /^meeting_id$/,
        /^meetingid$/,
        /^conference_id$/,
        /^conferenceid$/,
        /^space_id$/,
        /^spaceid$/,
        /^call_id$/,
        /^callid$/,
      ]);

      const meetingCode = pickFirstParamValue(paramMap, [
        /^meeting_code$/,
        /^meetingcode$/,
        /^conference_code$/,
        /^meeting_url_code$/,
      ]);

      const organizerFromParams = normalizeEmail(
        pickFirstParamValue(paramMap, [
          /^organizer_email$/,
          /^host_email$/,
          /^owner_email$/,
          /^creator_email$/,
        ])
      );

      const organizerEmail = organizerFromParams || actorEmail;

      const title = pickFirstParamValue(paramMap, [
        /^title$/,
        /^meeting_title$/,
        /^event_title$/,
        /^subject$/,
      ]);

      const eventTime =
        toIsoStringOrNull(
          pickFirstParamValue(paramMap, [
            /^time$/,
            /^event_time$/,
            /^start_time$/,
            /^end_time$/,
            /^timestamp$/,
          ])
        ) || activityTime;

      const conferenceKey = buildConferenceKey({
        stableId,
        meetingCode,
        organizerEmail,
        eventTimestamp: eventTime,
      });

      let group = grouped.get(conferenceKey);
      if (!group) {
        group = {
          conference_key: conferenceKey,
          source: 'reports_meet',
          meeting_code: null,
          organizer_email: null,
          participants: new Set(),
          sourceOrgUnits: new Set(),
          title: null,
          startedAt: null,
          lastEventAt: null,
          endedAtSignal: null,
        };
        grouped.set(conferenceKey, group);
      }

      if (!group.meeting_code && meetingCode) {
        group.meeting_code = meetingCode;
      }
      if (!group.organizer_email && organizerEmail) {
        group.organizer_email = organizerEmail;
      }
      if (!group.title && title) {
        group.title = title;
      }

      if (actorEmail) {
        group.participants.add(actorEmail);
        if (emailToOrgUnit && emailToOrgUnit.has(actorEmail)) {
          group.sourceOrgUnits.add(emailToOrgUnit.get(actorEmail));
        }
      }
      const eventEmails = extractEmailsFromParamMap(paramMap);
      for (const email of eventEmails) {
        group.participants.add(email);
        if (emailToOrgUnit && emailToOrgUnit.has(email)) {
          group.sourceOrgUnits.add(emailToOrgUnit.get(email));
        }
      }

      const eventMs = Date.parse(eventTime);
      if (!Number.isNaN(eventMs)) {
        if (!group.startedAt || eventMs < Date.parse(group.startedAt)) {
          group.startedAt = new Date(eventMs).toISOString();
        }
        if (!group.lastEventAt || eventMs > Date.parse(group.lastEventAt)) {
          group.lastEventAt = new Date(eventMs).toISOString();
        }
        if (isEndEvent(eventName)) {
          if (!group.endedAtSignal || eventMs > Date.parse(group.endedAtSignal)) {
            group.endedAtSignal = new Date(eventMs).toISOString();
          }
        }
      }

      if (!group.startedAt && isStartEvent(eventName)) {
        group.startedAt = eventTime;
      }
    }
  }

  const conferences = [];
  for (const group of grouped.values()) {
    let endedAt = group.endedAtSignal;
    if (!endedAt && group.lastEventAt && group.startedAt && group.lastEventAt !== group.startedAt) {
      endedAt = group.lastEventAt;
    }

    const sourceOrgFromOrganizer = emailToOrgUnit
      ? emailToOrgUnit.get(normalizeEmail(group.organizer_email) || '')
      : null;
    const sourceOrgFromEventMatch =
      group.sourceOrgUnits.size > 0 ? Array.from(group.sourceOrgUnits).sort()[0] : null;

    conferences.push({
      source: group.source,
      conference_key: group.conference_key,
      meeting_code: group.meeting_code,
      organizer_email: group.organizer_email,
      participants: group.participants.size > 0 ? Array.from(group.participants).sort() : null,
      source_org_unit: sourceOrgFromOrganizer || sourceOrgFromEventMatch || null,
      call_interna: computeCallInterna({
        participants: group.participants.size > 0 ? Array.from(group.participants) : [],
        organizerEmail: group.organizer_email,
      }),
      title: group.title,
      started_at: group.startedAt,
      ended_at: endedAt,
    });
  }

  return conferences;
}

async function upsertConference(conference) {
  requireDatabase();

  const query = `
    INSERT INTO saas.meet_conferences AS mc (
      source,
      conference_key,
      meeting_code,
      organizer_email,
      participants,
      source_org_unit,
      call_interna,
      title,
      started_at,
      ended_at,
      empresa_id
    )
    VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9::timestamptz, $10::timestamptz,
      (SELECT e.id FROM saas.empresas e WHERE lower(e.dominio::text) = lower(split_part(coalesce($4,''), '@', 2)) LIMIT 1)
    )
    ON CONFLICT (conference_key)
    DO UPDATE SET
      source = EXCLUDED.source,
      meeting_code = COALESCE(EXCLUDED.meeting_code, mc.meeting_code),
      organizer_email = COALESCE(EXCLUDED.organizer_email, mc.organizer_email),
      participants = (
        SELECT COALESCE(jsonb_agg(DISTINCT p.value), '[]'::jsonb)
        FROM (
          SELECT jsonb_array_elements_text(COALESCE(mc.participants, '[]'::jsonb)) AS value
          UNION ALL
          SELECT jsonb_array_elements_text(COALESCE(EXCLUDED.participants, '[]'::jsonb)) AS value
        ) AS p
      ),
      source_org_unit = COALESCE(EXCLUDED.source_org_unit, mc.source_org_unit),
      call_interna = (
        NOT EXISTS (
          SELECT 1
          FROM (
            SELECT jsonb_array_elements_text(COALESCE(mc.participants, '[]'::jsonb)) AS email
            UNION ALL
            SELECT jsonb_array_elements_text(COALESCE(EXCLUDED.participants, '[]'::jsonb)) AS email
            UNION ALL
            SELECT COALESCE(mc.organizer_email, '')
            UNION ALL
            SELECT COALESCE(EXCLUDED.organizer_email, '')
          ) AS participant_emails
          WHERE participant_emails.email <> ''
            AND lower(split_part(participant_emails.email, '@', 2)) <> $11
        )
      ),
      title = COALESCE(EXCLUDED.title, mc.title),
      started_at = CASE
        WHEN mc.started_at IS NULL THEN EXCLUDED.started_at
        WHEN EXCLUDED.started_at IS NULL THEN mc.started_at
        ELSE LEAST(mc.started_at, EXCLUDED.started_at)
      END,
      ended_at = CASE
        WHEN mc.ended_at IS NULL THEN EXCLUDED.ended_at
        WHEN EXCLUDED.ended_at IS NULL THEN mc.ended_at
        ELSE GREATEST(mc.ended_at, EXCLUDED.ended_at)
      END,
      empresa_id = COALESCE(mc.empresa_id, EXCLUDED.empresa_id),
      updated_at = now()
    RETURNING id, (xmax = 0) AS inserted
  `;

  const values = [
    conference.source || 'reports_meet',
    conference.conference_key,
    conference.meeting_code,
    conference.organizer_email,
    conference.participants ? JSON.stringify(conference.participants) : null,
    conference.source_org_unit,
    conference.call_interna,
    conference.title,
    conference.started_at,
    conference.ended_at,
    INTERNAL_EMAIL_DOMAIN,
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
}

async function getConferenceByKey(conferenceKey) {
  requireDatabase();

  const result = await pool.query(
    `
      SELECT
        id,
        conference_key,
        meeting_code,
        organizer_email,
        participants,
        source_org_unit,
        title,
        started_at,
        ended_at,
        status,
        transcript_source_file_id,
        transcript_copied_file_id,
        transcript_text,
        recording_source_file_id,
        recording_copied_file_id,
        recording_name,
        recording_mime_type,
        recording_size_bytes,
        recording_web_view_link,
        recording_web_content_link,
        attempts,
        error
      FROM saas.meet_conferences
      WHERE conference_key = $1
      LIMIT 1
    `,
    [conferenceKey]
  );

  return result.rows[0] || null;
}

async function markConferenceRecordingData({
  conferenceKey,
  sourceFileId,
  copiedFileId,
  recordingName,
  recordingMimeType,
  recordingSizeBytes,
  recordingWebViewLink,
  recordingWebContentLink,
}) {
  requireDatabase();

  const result = await pool.query(
    `
      UPDATE saas.meet_conferences
      SET
        recording_source_file_id = COALESCE($2, recording_source_file_id),
        recording_copied_file_id = COALESCE($3, recording_copied_file_id),
        recording_name = COALESCE($4, recording_name),
        recording_mime_type = COALESCE($5, recording_mime_type),
        recording_size_bytes = COALESCE($6, recording_size_bytes),
        recording_web_view_link = COALESCE($7, recording_web_view_link),
        recording_web_content_link = COALESCE($8, recording_web_content_link),
        updated_at = now()
      WHERE conference_key = $1
      RETURNING conference_key, recording_source_file_id, recording_copied_file_id, recording_name
    `,
    [
      conferenceKey,
      sourceFileId || null,
      copiedFileId || null,
      recordingName || null,
      recordingMimeType || null,
      recordingSizeBytes || null,
      recordingWebViewLink || null,
      recordingWebContentLink || null,
    ]
  );

  return result.rows[0] || null;
}

async function markConferenceTranscriptDone({ conferenceKey, sourceFileId, copiedFileId, transcriptText }) {
  requireDatabase();

  const result = await pool.query(
    `
      UPDATE saas.meet_conferences
      SET
        status = 'TRANSCRIPT_DONE',
        transcript_source_file_id = $2,
        transcript_copied_file_id = $3,
        transcript_text = COALESCE(NULLIF($4, ''), transcript_text),
        error = NULL,
        updated_at = now()
      WHERE conference_key = $1
      RETURNING conference_key, status, transcript_source_file_id, transcript_copied_file_id, transcript_text,
        recording_source_file_id, recording_copied_file_id, recording_name, recording_mime_type,
        recording_size_bytes, recording_web_view_link, recording_web_content_link
    `,
    [conferenceKey, sourceFileId, copiedFileId, transcriptText || null]
  );

  return result.rows[0] || null;
}

async function markConferenceError(conferenceKey, message) {
  requireDatabase();

  const result = await pool.query(
    `
      UPDATE saas.meet_conferences
      SET
        status = 'ERROR',
        attempts = attempts + 1,
        error = $2,
        updated_at = now()
      WHERE conference_key = $1
      RETURNING conference_key, status, attempts, error
    `,
    [conferenceKey, message]
  );

  return result.rows[0] || null;
}

async function findConferenceByTranscriptSourceFileId(sourceFileId, excludeConferenceKey) {
  requireDatabase();

  const result = await pool.query(
    `
      SELECT conference_key, status, transcript_source_file_id, transcript_copied_file_id, started_at
      FROM saas.meet_conferences
      WHERE transcript_source_file_id = $1
        AND conference_key <> $2
      ORDER BY updated_at DESC
      LIMIT 1
    `,
    [sourceFileId, excludeConferenceKey]
  );

  return result.rows[0] || null;
}

async function findConferenceByRecordingSourceFileId(sourceFileId, excludeConferenceKey) {
  requireDatabase();

  const result = await pool.query(
    `
      SELECT conference_key, status, recording_source_file_id, recording_copied_file_id, started_at
      FROM saas.meet_conferences
      WHERE recording_source_file_id = $1
        AND conference_key <> $2
      ORDER BY updated_at DESC
      LIMIT 1
    `,
    [sourceFileId, excludeConferenceKey]
  );

  return result.rows[0] || null;
}

async function resolveConferenceRecording({ conference, ownerCandidates, bufferedSince }) {
  if (conference.recording_copied_file_id || conference.recording_source_file_id) {
    return { updated: false, reused: true };
  }

  let files = [];
  let selectedOwner = ownerCandidates[0];

  for (const ownerEmail of ownerCandidates) {
    selectedOwner = ownerEmail;
    if (conference.meeting_code) {
      files = await withRetry(`listRecordingsForUser(code:${conference.meeting_code} owner:${ownerEmail})`, () =>
        listRecordingsForUser(ownerEmail, bufferedSince, { meetingCode: conference.meeting_code })
      );
      if (files.length === 0) {
        files = await withRetry(`listRecordingsForUser(fallback-without-code owner:${ownerEmail})`, () =>
          listRecordingsForUser(ownerEmail, bufferedSince)
        );
      }
    } else {
      files = await withRetry(`listRecordingsForUser(no-meeting-code owner:${ownerEmail})`, () =>
        listRecordingsForUser(ownerEmail, bufferedSince)
      );
    }

    if (files.length > 0) break;
  }

  const sorted = files
    .filter((file) => file && file.id)
    .sort((a, b) => Date.parse(b.createdTime || 0) - Date.parse(a.createdTime || 0));

  if (sorted.length === 0) {
    return { updated: false, reused: false };
  }

  let selected = null;
  for (const candidate of sorted) {
    const conflict = await findConferenceByRecordingSourceFileId(candidate.id, conference.conference_key);
    if (!conflict) {
      selected = candidate;
      break;
    }
  }

  if (!selected) {
    return { updated: false, reused: false };
  }

  return withSourceIdLock(selected.id, async () => {
    const duplicate = await withRetry(`findCopiedFileBySourceId(recording:${selected.id})`, () =>
      findCopiedFileBySourceId(selected.id, 'recording')
    );

    if (duplicate) {
      await markConferenceRecordingData({
        conferenceKey: conference.conference_key,
        sourceFileId: selected.id,
        copiedFileId: duplicate.id,
        recordingName: duplicate.name || selected.name,
        recordingMimeType: duplicate.mimeType || selected.mimeType,
        recordingSizeBytes: duplicate.size ? Number(duplicate.size) : (selected.size ? Number(selected.size) : null),
        recordingWebViewLink: duplicate.webViewLink || selected.webViewLink || null,
        recordingWebContentLink: duplicate.webContentLink || selected.webContentLink || null,
      });
      return { updated: true, reused: true, copied: true };
    }

    let metadata = await withRetry(`getDriveFileMetadataAsUser(recording:${selected.id})`, () =>
      getDriveFileMetadataAsUser(selectedOwner, selected.id)
    );

    let copiedFile = null;
    try {
      copiedFile = await withRetry(`copyFileToDestinationFromOwner(recording:${selected.id})`, () =>
        copyFileToDestinationFromOwner({
          userEmail: selectedOwner,
          sourceFileId: selected.id,
          title: selected.name || `Gravacao ${conference.meeting_code || conference.conference_key}`,
          sourceType: 'recording',
        })
      );
      if (copiedFile) {
        metadata = copiedFile;
      }
    } catch (copyError) {
      console.log(`[run-conference] não foi possível copiar gravação para pasta destino (source=${selected.id}): ${copyError.message}`);
    }

    await markConferenceRecordingData({
      conferenceKey: conference.conference_key,
      sourceFileId: selected.id,
      copiedFileId: copiedFile?.id || null,
      recordingName: metadata?.name || selected.name || null,
      recordingMimeType: metadata?.mimeType || selected.mimeType || null,
      recordingSizeBytes: metadata?.size ? Number(metadata.size) : (selected.size ? Number(selected.size) : null),
      recordingWebViewLink: metadata?.webViewLink || selected.webViewLink || null,
      recordingWebContentLink: metadata?.webContentLink || selected.webContentLink || null,
    });

    return { updated: true, reused: false, copied: Boolean(copiedFile?.id) };
  });
}

async function withSourceIdLock(sourceId, fn) {
  requireDatabase();

  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock(hashtext($1))', [sourceId]);
    return await fn();
  } finally {
    try {
      await client.query('SELECT pg_advisory_unlock(hashtext($1))', [sourceId]);
    } catch (unlockError) {
      console.log(`[run-conference] falha ao liberar lock sourceId=${sourceId}: ${unlockError.message}`);
    }
    client.release();
  }
}

function getRequestIp(req) {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }
  return req.ip || null;
}

async function saveRunConferenceApiLog({
  conferenceKey,
  statusCode,
  ok,
  duplicated,
  error,
  requestIp,
  userAgent,
  requestQuery,
  requestBody,
  responsePayload,
  durationMs,
}) {
  if (!pool) {
    return;
  }

  try {
    await pool.query(
      `
        INSERT INTO saas.run_conference_api_logs (
          conference_key,
          status_code,
          ok,
          duplicated,
          error,
          request_ip,
          user_agent,
          request_query,
          request_body,
          response_payload,
          duration_ms
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb, $11)
      `,
      [
        conferenceKey || null,
        statusCode,
        Boolean(ok),
        duplicated ?? null,
        error || null,
        requestIp || null,
        userAgent || null,
        requestQuery ? JSON.stringify(requestQuery) : null,
        requestBody ? JSON.stringify(requestBody) : null,
        responsePayload ? JSON.stringify(responsePayload) : null,
        durationMs ?? null,
      ]
    );
  } catch (logError) {
    console.log(`[run-conference] falha ao gravar log da API: ${logError.message}`);
  }
}

async function processConferenceByKey(conferenceKey) {
  let conference = await getConferenceByKey(conferenceKey);
  if (!conference) {
    return {
      ok: false,
      statusCode: 404,
      error: 'conference_key não encontrado',
    };
  }

  const ownerCandidates = buildTranscriptOwnerCandidates(conference);
  if (ownerCandidates.length === 0) {
    const message = 'conference sem usuário interno elegível para busca de transcrição';
    await markConferenceError(conferenceKey, message);
    return { ok: false, statusCode: 400, error: message };
  }

  const startedAt = conference.started_at ? new Date(conference.started_at) : null;
  const bufferedSince = startedAt && !Number.isNaN(startedAt.getTime())
    ? new Date(startedAt.getTime() - 60 * 60 * 1000).toISOString()
    : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  console.log(`[run-conference] conference_key=${conferenceKey}`);
  console.log(`[run-conference] owners=${ownerCandidates.join(',')} since=${bufferedSince} meeting_code=${conference.meeting_code || 'N/A'}`);

  try {
    const recordingResult = await resolveConferenceRecording({
      conference,
      ownerCandidates,
      bufferedSince,
    });
    if (recordingResult.updated) {
      console.log(`[run-conference] gravação vinculada conference_key=${conferenceKey} copied=${recordingResult.copied ? 'yes' : 'no'}`);
      conference = (await getConferenceByKey(conferenceKey)) || conference;
    }
  } catch (recordingError) {
    console.log(`[run-conference] falha ao resolver gravação conference_key=${conferenceKey}: ${recordingError.message}`);
  }

  // Idempotency: if transcript already processed, return current state.
  if (conference.status === 'TRANSCRIPT_DONE') {
    console.log(`[run-conference] já processada conference_key=${conferenceKey} source=${conference.transcript_source_file_id || 'N/A'} copied=${conference.transcript_copied_file_id || 'N/A'}`);
    return {
      ok: true,
      statusCode: 200,
      duplicated: true,
      alreadyProcessed: true,
      result: {
        conference_key: conference.conference_key,
        status: conference.status,
        transcript_source_file_id: conference.transcript_source_file_id,
        transcript_copied_file_id: conference.transcript_copied_file_id,
        recording_source_file_id: conference.recording_source_file_id,
        recording_copied_file_id: conference.recording_copied_file_id,
        recording_name: conference.recording_name,
        recording_mime_type: conference.recording_mime_type,
        recording_size_bytes: conference.recording_size_bytes,
        recording_web_view_link: conference.recording_web_view_link,
        recording_web_content_link: conference.recording_web_content_link,
      },
    };
  }

  let files = [];
  let transcriptOwnerEmail = ownerCandidates[0];

  for (const ownerEmail of ownerCandidates) {
    transcriptOwnerEmail = ownerEmail;

    if (conference.meeting_code) {
      files = await withRetry(`listTranscriptsForUser(code:${conference.meeting_code} owner:${ownerEmail})`, () =>
        listTranscriptsForUser(ownerEmail, bufferedSince, { meetingCode: conference.meeting_code })
      );

      if (files.length === 0) {
        console.log(`[run-conference] fallback sem meeting_code conference_key=${conferenceKey} owner=${ownerEmail}`);
        files = await withRetry(`listTranscriptsForUser(fallback-without-code owner:${ownerEmail})`, () =>
          listTranscriptsForUser(ownerEmail, bufferedSince)
        );
      }
    } else {
      files = await withRetry(`listTranscriptsForUser(no-meeting-code owner:${ownerEmail})`, () =>
        listTranscriptsForUser(ownerEmail, bufferedSince)
      );
    }

    if (files.length > 0) {
      break;
    }
  }

  if (files.length === 0) {
    const message = conference.meeting_code
      ? 'transcrição não encontrada para a conferência com meeting_code'
      : 'transcrição não encontrada para a conferência';
    const state = await markConferenceError(conferenceKey, message);
    console.log(`[run-conference] não encontrou transcript conference_key=${conferenceKey} attempts=${state?.attempts ?? 'N/A'}`);
    return {
      ok: false,
      statusCode: 404,
      error: message,
      conference: state,
    };
  }

  const sorted = files
    .filter((file) => file && file.id)
    .sort((a, b) => Date.parse(b.createdTime || 0) - Date.parse(a.createdTime || 0));

  let selected = null;
  let conflict = null;

  for (const candidate of sorted) {
    conflict = await findConferenceByTranscriptSourceFileId(candidate.id, conferenceKey);
    if (!conflict) {
      selected = candidate;
      break;
    }
  }

  if (!selected) {
    const message = conflict
      ? `transcrição já vinculada a outra conferência (${conflict.conference_key})`
      : 'nenhum arquivo de transcrição válido';
    const state = await markConferenceError(conferenceKey, message);
    return { ok: false, statusCode: 404, error: message, conference: state };
  }

  return await withSourceIdLock(selected.id, async () => {
    const duplicate = await withRetry(`findCopiedDocBySourceId(${selected.id})`, () =>
      findCopiedDocBySourceId(selected.id)
    );

    if (duplicate) {
      const duplicateText = await withRetry(
        `exportCopiedDocAsText()`,
        () => exportCopiedDocAsText(duplicate.id)
      );

      const row = await markConferenceTranscriptDone({
        conferenceKey,
        sourceFileId: selected.id,
        copiedFileId: duplicate.id,
        transcriptText: duplicateText,
      });

      console.log(`[run-conference] duplicado detectado conference_key=${conferenceKey} source=${selected.id} copied=${duplicate.id}`);
      return {
        ok: true,
        statusCode: 200,
        duplicated: true,
        result: row,
      };
    }

    const text = await withRetry(`exportDocAsText(${selected.id})`, () =>
      exportDocAsText(transcriptOwnerEmail, selected.id)
    );

    const copiedFileId = await withRetry(`createDocWithContent(${selected.id})`, () =>
      createDocWithContent({
        title: selected.name,
        text,
        sourceId: selected.id,
        owner: transcriptOwnerEmail,
      })
    );

    const row = await markConferenceTranscriptDone({
      conferenceKey,
      sourceFileId: selected.id,
      copiedFileId,
      transcriptText: text,
    });

    console.log(`[run-conference] transcript copiado conference_key=${conferenceKey} source=${selected.id} copied=${copiedFileId}`);

    return {
      ok: true,
      statusCode: 200,
      duplicated: false,
      result: row,
    };
  });
}

async function fetchConferenceTranscriptByKey(conferenceKey) {
  let conference = await getConferenceByKey(conferenceKey);
  if (!conference) {
    return { ok: false, statusCode: 404, error: 'conference_key não encontrado' };
  }

  if (!conference.transcript_copied_file_id) {
    const processed = await processConferenceByKey(conferenceKey);
    if (!processed?.ok) {
      return {
        ok: false,
        statusCode: processed?.statusCode || 500,
        error: processed?.error || 'falha ao processar conference_key',
      };
    }

    conference = await getConferenceByKey(conferenceKey);
    if (!conference) {
      return { ok: false, statusCode: 404, error: 'conference_key não encontrado após processamento' };
    }
  }

  if (!conference.transcript_copied_file_id) {
    return { ok: false, statusCode: 404, error: 'arquivo de transcrição não encontrado' };
  }

  const transcriptText = (conference.transcript_text && String(conference.transcript_text).trim())
    ? String(conference.transcript_text)
    : await withRetry(`exportCopiedDocAsText()`, () =>
        exportCopiedDocAsText(conference.transcript_copied_file_id)
      );

  if (!transcriptText || !String(transcriptText).trim()) {
    return { ok: false, statusCode: 404, error: 'arquivo de transcrição vazio' };
  }

  return {
    ok: true,
    statusCode: 200,
      result: {
        conference_key: conference.conference_key,
        status: conference.status,
        transcript_copied_file_id: conference.transcript_copied_file_id,
        transcript_text: transcriptText,
        recording_source_file_id: conference.recording_source_file_id,
        recording_copied_file_id: conference.recording_copied_file_id,
        recording_name: conference.recording_name,
        recording_mime_type: conference.recording_mime_type,
        recording_size_bytes: conference.recording_size_bytes,
        recording_web_view_link: conference.recording_web_view_link,
        recording_web_content_link: conference.recording_web_content_link,
      },
    };
}

async function discoverMeetConferences({ startIso, endIso }) {
  requireDatabase();

  const ouContext = await withRetry('getOuEmailContext', () => getOuEmailContext());
  const activities = await withRetry('reports.activities.list(meet)', () =>
    listMeetActivities(startIso, endIso)
  );

  const allConferences = consolidateActivitiesToConferences(activities, ouContext.emailToOrgUnit);
  const conferences = allConferences
    .map((conference) => {
      if (conference.source_org_unit) {
        return conference;
      }
      const fallbackOu = resolveConferenceSourceOrgUnit(conference, ouContext.emailToOrgUnit);
      return {
        ...conference,
        source_org_unit: fallbackOu || null,
      };
    })
    .filter((conference) => Boolean(conference.source_org_unit));

  let inserted = 0;
  let updated = 0;
  let errors = 0;

  for (const conference of conferences) {
    try {
      const row = await withRetry(`upsertConference(${conference.conference_key})`, () =>
        upsertConference(conference)
      );
      if (row.inserted) {
        inserted += 1;
      } else {
        updated += 1;
      }
    } catch (error) {
      errors += 1;
      console.log(`[cron] erro ao salvar conference_key=${conference.conference_key}: ${error.message}`);
    }
  }

  return {
    startIso,
    endIso,
    orgUnits: ouContext.orgUnits,
    usersByOrgUnit: ouContext.usersByOrgUnit,
    ouUsers: ouContext.emailSet.size,
    activities: activities.length,
    consolidatedConferences: allConferences.length,
    filteredConferences: conferences.length,
    conferences: conferences.length,
    inserted,
    updated,
    errors,
  };
}

async function processPendingTranscriptionsCronTick() {
  requireDatabase();

  const result = await pool.query(
    `
      SELECT conference_key
      FROM saas.meet_conferences
      WHERE status = 'NEW'
        AND coalesce(call_interna, false) = false
        AND ended_at IS NOT NULL
        AND started_at <= now() - make_interval(mins => $1::int)
      ORDER BY started_at ASC
      LIMIT $2
    `,
    [Math.max(0, CRON_TRANSCRIPT_DELAY_MINUTES), Math.max(1, CRON_TRANSCRIPT_BATCH_SIZE)]
  );

  const keys = result.rows.map((row) => row.conference_key).filter(Boolean);
  if (keys.length === 0) {
    return { selected: 0, ok: 0, fail: 0 };
  }

  let ok = 0;
  let fail = 0;

  for (const conferenceKey of keys) {
    try {
      const processed = await processConferenceByKey(conferenceKey);
      if (processed?.ok) {
        ok += 1;
      } else {
        fail += 1;
      }
    } catch (error) {
      fail += 1;
      console.log(`[cron] erro ao processar transcrição conference_key=${conferenceKey}: ${error.message}`);
    }
  }

  return { selected: keys.length, ok, fail };
}

let cronRunning = false;

async function runDiscoveryCronTick() {
  if (!CRON_ENABLED) {
    return;
  }

  if (!pool) {
    console.log('[cron] DATABASE_URL ausente; cron de discovery não iniciado');
    return;
  }

  if (cronRunning) {
    console.log('[cron] execução anterior ainda em andamento; pulando este ciclo');
    return;
  }

  cronRunning = true;
  const tickStartedAt = Date.now();

  try {
    const end = new Date();
    const start = new Date(end.getTime() - CRON_LOOKBACK_MINUTES * 60 * 1000);

    const startIso = start.toISOString();
    const endIso = end.toISOString();

    console.log(`[cron] iniciando discovery em ${new Date().toISOString()} janela ${startIso} -> ${endIso}`);

    const summary = await discoverMeetConferences({ startIso, endIso });
    const transcriptSummary = await processPendingTranscriptionsCronTick();
    const durationSec = ((Date.now() - tickStartedAt) / 1000).toFixed(2);

  console.log(`[cron] finalizado em ${durationSec}s orgUnits=${summary.orgUnits.join('|')} ouUsers=${summary.ouUsers} activities=${summary.activities} consolidated=${summary.consolidatedConferences} filtered=${summary.filteredConferences} conferences=${summary.conferences} inserted=${summary.inserted} updated=${summary.updated} errors=${summary.errors} transcriptions_selected=${transcriptSummary.selected} transcriptions_ok=${transcriptSummary.ok} transcriptions_fail=${transcriptSummary.fail}`);
  } catch (error) {
    console.log(`[cron] falha: ${error.message}`);
  } finally {
    cronRunning = false;
  }
}

function startDiscoveryCron() {
  if (!CRON_ENABLED) {
    console.log('[cron] desabilitado por CRON_ENABLED=false');
    return;
  }

  if (!pool) {
    console.log('[cron] DATABASE_URL ausente; cron não será iniciado');
    return;
  }

  const intervalMs = Math.max(1, CRON_INTERVAL_MINUTES) * 60 * 1000;
  console.log(`[cron] habilitado intervalo=${CRON_INTERVAL_MINUTES}min lookback=${CRON_LOOKBACK_MINUTES}min`);

  setTimeout(() => {
    runDiscoveryCronTick().catch((error) => {
      console.log(`[cron] erro inesperado no primeiro ciclo: ${error.message}`);
    });
  }, 5000);

  setInterval(() => {
    runDiscoveryCronTick().catch((error) => {
      console.log(`[cron] erro inesperado no ciclo: ${error.message}`);
    });
  }, intervalMs);
}

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (isOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-webhook-token');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  next();
});

function authMiddleware(req, res, next) {
  const token = req.headers['x-webhook-token'];
  if (token !== WEBHOOK_TOKEN) {
    console.log('🚫 Requisição rejeitada: token inválido');
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  next();
}

app.get('/health', async (_, res) => {
  if (!pool) {
    return res.json({ ok: true, db: false });
  }

  try {
    await pool.query('SELECT 1');
    return res.json({ ok: true, db: true });
  } catch (error) {
    return res.status(500).json({ ok: false, db: false, error: error.message });
  }
});

app.post('/run', authMiddleware, async (req, res) => {
  const startTime = Date.now();
  const since = req.query.since;
  const email = req.query.email;

  console.log('-------------------------------------------');
  console.log('📥 Nova requisição recebida em /run');
  console.log('🕒 Horário:', new Date().toISOString());
  console.log('📅 since:', since || DEFAULT_SINCE_ISO);
  console.log('👤 email:', email || 'TODOS DA OU');
  console.log('-------------------------------------------');

  if (since && Number.isNaN(Date.parse(since))) {
    return res.status(400).json({ ok: false, error: 'since inválido (use ISO 8601)' });
  }

  try {
    const result = await runCollector({ sinceIso: since, email });
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('-------------------------------------------');
    console.log('✅ Execução /run finalizada');
    console.log('⏱ Tempo:', duration, 'segundos');
    console.log('👥 Usuários verificados:', result.usersChecked);
    console.log('📄 Transcrições encontradas:', result.transcriptsFound);
    console.log('🆕 Criadas:', result.created);
    console.log('⏭️ Duplicadas ignoradas:', result.skippedDuplicates);
    console.log('❌ Erros:', result.errors.length);
    console.log('-------------------------------------------\n');

    return res.json({ ok: true, result });
  } catch (error) {
    console.log('🔥 Erro fatal no /run:', error.message);
    return res.status(500).json({ ok: false, error: error.message });
  }
});

async function handleRunConference(req, res) {
  const startedAt = Date.now();
  const conferenceKey = String(req.query.conference_key || req.body?.conference_key || '').trim();
  const requestIp = getRequestIp(req);
  const userAgent = req.headers['user-agent'] || null;

  if (!conferenceKey) {
    const payload = { ok: false, error: 'conference_key é obrigatório' };
    await saveRunConferenceApiLog({
      conferenceKey: null,
      statusCode: 400,
      ok: false,
      duplicated: null,
      error: payload.error,
      requestIp,
      userAgent,
      requestQuery: req.query || null,
      requestBody: req.body || null,
      responsePayload: payload,
      durationMs: Date.now() - startedAt,
    });
    return res.status(400).json(payload);
  }

  try {
    const result = await processConferenceByKey(conferenceKey);
    await saveRunConferenceApiLog({
      conferenceKey,
      statusCode: result.statusCode,
      ok: result.ok,
      duplicated: result.duplicated ?? null,
      error: result.error || null,
      requestIp,
      userAgent,
      requestQuery: req.query || null,
      requestBody: req.body || null,
      responsePayload: result,
      durationMs: Date.now() - startedAt,
    });
    return res.status(result.statusCode).json(result);
  } catch (error) {
    console.log(`[run-conference] erro fatal conference_key=${conferenceKey}: ${error.message}`);
    const payload = { ok: false, error: error.message };
    await saveRunConferenceApiLog({
      conferenceKey,
      statusCode: 500,
      ok: false,
      duplicated: null,
      error: error.message,
      requestIp,
      userAgent,
      requestQuery: req.query || null,
      requestBody: req.body || null,
      responsePayload: payload,
      durationMs: Date.now() - startedAt,
    });
    return res.status(500).json(payload);
  }
}

async function handleGetTranscript(req, res) {
  const conferenceKey = String(req.query.conference_key || req.body?.conference_key || '').trim();

  if (!conferenceKey) {
    return res.status(400).json({ ok: false, error: 'conference_key é obrigatório' });
  }

  try {
    const result = await fetchConferenceTranscriptByKey(conferenceKey);
    return res.status(result.statusCode).json(result);
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
}

app.post('/run-conference', authMiddleware, handleRunConference);
app.post('/transcript', authMiddleware, handleGetTranscript);

app.post('/run-one', authMiddleware, async (req, res) => {
  req.query.conference_key = req.query.conference_key || req.body?.conference_key;
  return handleRunConference(req, res);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Webhook rodando na porta ${PORT}`);
  console.log('POST /run?since=...&email=...');
  console.log('POST /run-conference?conference_key=...');
  console.log('POST /transcript?conference_key=...');
  console.log('POST /run-one?conference_key=...');
  initializeDatabaseConnection()
    .catch((error) => {
      console.log(`[db] erro inesperado na inicialização: ${error.message}`);
    })
    .finally(() => {
      startDiscoveryCron();
    });
});
