require('dotenv').config();

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;
const DB_SSL_DISABLED = String(process.env.DB_SSL_DISABLED || 'false').toLowerCase() === 'true';
const INTERNAL_EMAIL_DOMAIN = (
  process.env.INTERNAL_EMAIL_DOMAIN ||
  (process.env.ADMIN_SUBJECT && process.env.ADMIN_SUBJECT.includes('@')
    ? process.env.ADMIN_SUBJECT.split('@')[1]
    : '')
).toLowerCase();

if (!DATABASE_URL) {
  console.error('DATABASE_URL nao configurada');
  process.exit(1);
}

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

const pool = new Pool(buildDatabaseConfig(DATABASE_URL));

const MIGRATION_NAME = 'bootstrap_saas_meet_collector_v1';

const SQL_BOOTSTRAP = `
  create schema if not exists saas;

  create table if not exists saas.schema_migrations (
    filename text primary key,
    applied_at timestamptz not null default now()
  );

  create table if not exists saas.meet_conferences (
    id uuid primary key default gen_random_uuid(),
    empresa_id uuid references saas.empresas(id) on delete set null,
    source text not null default 'reports_meet',
    conference_key text not null unique,
    meeting_code text,
    organizer_email text,
    participants jsonb,
    source_org_unit text,
    call_interna boolean,
    title text,
    started_at timestamptz,
    ended_at timestamptz,
    status text not null default 'NEW',
    transcript_source_file_id text,
    transcript_copied_file_id text,
    transcript_text text,
    recording_source_file_id text,
    recording_copied_file_id text,
    recording_name text,
    recording_mime_type text,
    recording_size_bytes bigint,
    recording_web_view_link text,
    recording_web_content_link text,
    attempts integer not null default 0,
    error text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  create index if not exists idx_saas_meet_conferences_status on saas.meet_conferences(status);
  create index if not exists idx_saas_meet_conferences_started_at on saas.meet_conferences(started_at desc);
  create index if not exists idx_saas_meet_conferences_organizer on saas.meet_conferences(organizer_email);
  create index if not exists idx_saas_meet_conferences_recording_source on saas.meet_conferences(recording_source_file_id);

  create table if not exists saas.run_conference_api_logs (
    id uuid primary key default gen_random_uuid(),
    conference_key text,
    status_code integer not null,
    ok boolean not null default false,
    duplicated boolean,
    error text,
    request_ip text,
    user_agent text,
    request_query jsonb,
    request_body jsonb,
    response_payload jsonb,
    duration_ms integer,
    created_at timestamptz not null default now()
  );

  create index if not exists idx_saas_run_conf_logs_created on saas.run_conference_api_logs(created_at desc);
  create index if not exists idx_saas_run_conf_logs_key on saas.run_conference_api_logs(conference_key, created_at desc);
`;

async function main() {
  const client = await pool.connect();
  try {
    await client.query('begin');

    await client.query('create schema if not exists saas');
    await client.query(`
      create table if not exists saas.schema_migrations (
        filename text primary key,
        applied_at timestamptz not null default now()
      )
    `);

    const applied = await client.query(
      `select 1 from saas.schema_migrations where filename = $1 limit 1`,
      [MIGRATION_NAME]
    );

    if (applied.rowCount === 0) {
      await client.query(SQL_BOOTSTRAP);
      await client.query(
        `insert into saas.schema_migrations (filename) values ($1)`,
        [MIGRATION_NAME]
      );
      console.log(`Migration aplicada: ${MIGRATION_NAME}`);
    } else {
      console.log(`Migration ja aplicada: ${MIGRATION_NAME}`);
    }

    await client.query(`
      alter table saas.meet_conferences
        add column if not exists recording_source_file_id text,
        add column if not exists recording_copied_file_id text,
        add column if not exists recording_name text,
        add column if not exists recording_mime_type text,
        add column if not exists recording_size_bytes bigint,
        add column if not exists recording_web_view_link text,
        add column if not exists recording_web_content_link text;

      create index if not exists idx_saas_meet_conferences_recording_source
        on saas.meet_conferences(recording_source_file_id);
    `);

    if (INTERNAL_EMAIL_DOMAIN) {
      await client.query(
        `
          update saas.meet_conferences
          set
            call_interna = (
              not exists (
                select 1
                from (
                  select jsonb_array_elements_text(coalesce(saas.meet_conferences.participants, '[]'::jsonb)) as email
                  union all
                  select coalesce(saas.meet_conferences.organizer_email, '')
                ) as participant_emails
                where participant_emails.email <> ''
                  and lower(split_part(participant_emails.email, '@', 2)) <> $1
              )
            ),
            updated_at = now()
        `,
        [INTERNAL_EMAIL_DOMAIN]
      );
      console.log(`Backfill call_interna executado com dominio: ${INTERNAL_EMAIL_DOMAIN}`);
    } else {
      console.log('Backfill call_interna ignorado: INTERNAL_EMAIL_DOMAIN/ADMIN_SUBJECT nao definido');
    }

    await client.query('commit');
    console.log('db:migrate concluido com sucesso.');
  } catch (error) {
    await client.query('rollback');
    console.error('Falha ao aplicar migration:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(async (error) => {
  console.error('Erro inesperado na migration:', error.message);
  await pool.end();
  process.exit(1);
});
