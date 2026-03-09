-- Schema principal SaaS para Appmax
-- Objetivo: estrutura relacional em portugues para operar usuarios, times,
-- reunioes, whatsapp, integracoes, automacoes e governanca.

create extension if not exists pgcrypto;
create extension if not exists citext;

create schema if not exists saas;

-- =========================
-- ENUMS
-- =========================
create type saas.tipo_plano as enum ('starter', 'pro', 'enterprise');
create type saas.papel_usuario as enum ('admin', 'ceo', 'diretor', 'gerente', 'coordenador', 'supervisor', 'vendedor');
create type saas.status_usuario as enum ('ativo', 'inativo');
create type saas.status_solicitacao_acesso as enum ('pendente', 'aprovada', 'rejeitada');
create type saas.status_reuniao as enum ('agendada', 'concluida', 'cancelada', 'no_show');
create type saas.status_instancia_whatsapp as enum ('conectada', 'desconectada', 'conectando');
create type saas.tipo_integracao as enum ('google_calendar', 'google_meet', 'hubspot', 'openai', 'evolution_api', 'n8n');
create type saas.status_integracao as enum ('conectada', 'desconectada', 'erro');
create type saas.escopo_permissao as enum ('todos', 'area', 'time', 'proprio');
create type saas.status_notificacao as enum ('nao_lida', 'lida', 'arquivada');
create type saas.tipo_notificacao as enum ('reuniao', 'whatsapp', 'sistema', 'performance');

-- =========================
-- FUNCOES E TRIGGERS BASE
-- =========================
create or replace function saas.definir_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

-- =========================
-- EMPRESA E ORGANIZACAO
-- =========================
create table if not exists saas.empresas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  dominio citext unique,
  logo_url text,
  plano saas.tipo_plano not null default 'enterprise',
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists saas.areas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references saas.empresas(id) on delete cascade,
  nome text not null,
  gerente_id uuid,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (empresa_id, nome)
);

create table if not exists saas.times (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references saas.empresas(id) on delete cascade,
  area_id uuid references saas.areas(id) on delete set null,
  nome text not null,
  supervisor_id uuid,
  meta numeric(12,2),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (empresa_id, nome)
);

create table if not exists saas.usuarios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references saas.empresas(id) on delete cascade,
  area_id uuid references saas.areas(id) on delete set null,
  time_id uuid references saas.times(id) on delete set null,
  nome text not null,
  email citext not null unique,
  avatar_url text,
  papel saas.papel_usuario not null default 'vendedor',
  status saas.status_usuario not null default 'ativo',
  senha_hash text,
  google_sub text unique,
  ultimo_login_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table saas.areas
  add constraint fk_areas_gerente
  foreign key (gerente_id) references saas.usuarios(id) on delete set null;

alter table saas.times
  add constraint fk_times_supervisor
  foreign key (supervisor_id) references saas.usuarios(id) on delete set null;

-- =========================
-- ACESSO E GOVERNANCA
-- =========================
create table if not exists saas.solicitacoes_acesso (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references saas.empresas(id) on delete cascade,
  email citext not null,
  nome text not null,
  foto_url text,
  status saas.status_solicitacao_acesso not null default 'pendente',
  papel_sugerido saas.papel_usuario,
  solicitado_em timestamptz not null default now(),
  decidido_em timestamptz,
  decidido_por_usuario_id uuid references saas.usuarios(id) on delete set null,
  observacoes text,
  unique (empresa_id, email, status)
);

create table if not exists saas.permissoes_papeis (
  id bigserial primary key,
  papel saas.papel_usuario not null,
  recurso text not null,
  escopo saas.escopo_permissao not null default 'proprio',
  permitido boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (papel, recurso)
);

create table if not exists saas.modulos_sistema (
  codigo text primary key,
  nome text not null,
  descricao text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists saas.configuracoes_modulos_empresa (
  id bigserial primary key,
  empresa_id uuid not null references saas.empresas(id) on delete cascade,
  modulo_codigo text not null references saas.modulos_sistema(codigo) on delete cascade,
  habilitado boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (empresa_id, modulo_codigo)
);

create table if not exists saas.configuracoes_modulos_usuario (
  id bigserial primary key,
  usuario_id uuid not null references saas.usuarios(id) on delete cascade,
  modulo_codigo text not null references saas.modulos_sistema(codigo) on delete cascade,
  habilitado boolean not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (usuario_id, modulo_codigo)
);

create table if not exists saas.tokens_ia_modulo (
  id bigserial primary key,
  empresa_id uuid not null references saas.empresas(id) on delete cascade,
  modulo_codigo text not null references saas.modulos_sistema(codigo) on delete cascade,
  provedor text not null default 'openai',
  modelo text,
  token_criptografado text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (empresa_id, modulo_codigo, provedor)
);

create table if not exists saas.integracoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references saas.empresas(id) on delete cascade,
  usuario_id uuid references saas.usuarios(id) on delete set null,
  tipo saas.tipo_integracao not null,
  nome text not null,
  status saas.status_integracao not null default 'desconectada',
  configuracao jsonb not null default '{}'::jsonb,
  conectado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (empresa_id, tipo, nome)
);

-- =========================
-- REUNIOES E AVALIACOES
-- =========================
create table if not exists saas.reunioes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references saas.empresas(id) on delete cascade,
  area_id uuid references saas.areas(id) on delete set null,
  time_id uuid references saas.times(id) on delete set null,
  vendedor_id uuid references saas.usuarios(id) on delete set null,
  titulo text not null,
  data_reuniao timestamptz not null,
  duracao_minutos integer not null check (duracao_minutos >= 0),
  cliente_nome text,
  cliente_email citext,
  link_meet text,
  status saas.status_reuniao not null default 'agendada',
  score smallint check (score between 0 and 100),
  analisada_por_ia boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists saas.avaliacoes_reunioes (
  id uuid primary key default gen_random_uuid(),
  reuniao_id uuid not null references saas.reunioes(id) on delete cascade,
  avaliador_id uuid references saas.usuarios(id) on delete set null,
  rapport smallint not null check (rapport between 0 and 100),
  discovery smallint not null check (discovery between 0 and 100),
  presentation smallint not null check (presentation between 0 and 100),
  objections smallint not null check (objections between 0 and 100),
  next_steps smallint not null check (next_steps between 0 and 100),
  score_total smallint not null check (score_total between 0 and 100),
  notas text,
  resumo_ia text,
  insights_ia text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (reuniao_id)
);

-- =========================
-- WHATSAPP E IA
-- =========================
create table if not exists saas.instancias_whatsapp (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references saas.empresas(id) on delete cascade,
  usuario_id uuid references saas.usuarios(id) on delete set null,
  time_id uuid references saas.times(id) on delete set null,
  nome text not null,
  telefone text,
  status saas.status_instancia_whatsapp not null default 'desconectada',
  qr_code text,
  owner_jid text,
  ultimo_evento_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (empresa_id, nome)
);

create table if not exists saas.conversas_whatsapp (
  id uuid primary key default gen_random_uuid(),
  instancia_id uuid not null references saas.instancias_whatsapp(id) on delete cascade,
  contato_nome text,
  contato_telefone text not null,
  contato_avatar_url text,
  ultima_mensagem text,
  ultima_mensagem_em timestamptz,
  nao_lidas integer not null default 0,
  responsavel_usuario_id uuid references saas.usuarios(id) on delete set null,
  score smallint check (score between 0 and 100),
  analisada_por_ia boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (instancia_id, contato_telefone)
);

create table if not exists saas.mensagens_whatsapp (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references saas.conversas_whatsapp(id) on delete cascade,
  instancia_id uuid not null references saas.instancias_whatsapp(id) on delete cascade,
  de_jid text,
  para_jid text,
  corpo text,
  tipo text not null default 'texto',
  direcao text not null check (direcao in ('entrada', 'saida')),
  external_message_id text,
  enviada_em timestamptz not null,
  criado_em timestamptz not null default now(),
  unique (instancia_id, external_message_id)
);

create table if not exists saas.analises_ia (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references saas.empresas(id) on delete cascade,
  tipo_contexto text not null check (tipo_contexto in ('reuniao', 'whatsapp', 'treinamento', 'relatorio')),
  entidade_id uuid,
  score smallint check (score between 0 and 100),
  criterios jsonb,
  resumo text,
  payload jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- =========================
-- AUTOMACOES / WEBHOOKS
-- =========================
create table if not exists saas.automacoes_webhooks (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references saas.empresas(id) on delete cascade,
  evento text not null,
  categoria text not null,
  url_webhook text,
  ativo boolean not null default true,
  timeout_ms integer not null default 10000,
  tentativas_max integer not null default 3,
  headers jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (empresa_id, evento)
);

create table if not exists saas.eventos_webhooks (
  id uuid primary key default gen_random_uuid(),
  automacao_id uuid references saas.automacoes_webhooks(id) on delete set null,
  empresa_id uuid not null references saas.empresas(id) on delete cascade,
  evento text not null,
  payload jsonb not null,
  status text not null check (status in ('pendente', 'sucesso', 'erro')),
  tentativas integer not null default 0,
  ultimo_erro text,
  processado_em timestamptz,
  criado_em timestamptz not null default now()
);

-- =========================
-- LOGS E NOTIFICACOES
-- =========================
create table if not exists saas.logs_auditoria (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references saas.empresas(id) on delete cascade,
  usuario_id uuid references saas.usuarios(id) on delete set null,
  tipo_evento text not null,
  pagina text,
  pagina_label text,
  ip_origem inet,
  user_agent text,
  metadados jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);

create table if not exists saas.notificacoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references saas.empresas(id) on delete cascade,
  usuario_id uuid not null references saas.usuarios(id) on delete cascade,
  tipo saas.tipo_notificacao not null,
  titulo text not null,
  descricao text,
  link text,
  status saas.status_notificacao not null default 'nao_lida',
  criado_em timestamptz not null default now(),
  lida_em timestamptz
);

-- =========================
-- INDICES
-- =========================
create index if not exists idx_usuarios_empresa on saas.usuarios (empresa_id);
create index if not exists idx_usuarios_papel on saas.usuarios (papel);
create index if not exists idx_usuarios_status on saas.usuarios (status);

create index if not exists idx_times_empresa on saas.times (empresa_id);
create index if not exists idx_times_area on saas.times (area_id);

create index if not exists idx_reunioes_empresa on saas.reunioes (empresa_id);
create index if not exists idx_reunioes_data on saas.reunioes (data_reuniao desc);
create index if not exists idx_reunioes_vendedor on saas.reunioes (vendedor_id);

create index if not exists idx_instancias_empresa on saas.instancias_whatsapp (empresa_id);
create index if not exists idx_conversas_instancia on saas.conversas_whatsapp (instancia_id);
create index if not exists idx_mensagens_conversa_data on saas.mensagens_whatsapp (conversa_id, enviada_em desc);

create index if not exists idx_analises_contexto on saas.analises_ia (tipo_contexto, entidade_id);
create index if not exists idx_logs_auditoria_empresa_data on saas.logs_auditoria (empresa_id, criado_em desc);
create index if not exists idx_notificacoes_usuario_status on saas.notificacoes (usuario_id, status, criado_em desc);
create index if not exists idx_solicitacoes_empresa_status on saas.solicitacoes_acesso (empresa_id, status, solicitado_em desc);

-- =========================
-- TRIGGERS atualizado_em
-- =========================
create trigger trg_empresas_atualizado_em before update on saas.empresas for each row execute function saas.definir_atualizado_em();
create trigger trg_areas_atualizado_em before update on saas.areas for each row execute function saas.definir_atualizado_em();
create trigger trg_times_atualizado_em before update on saas.times for each row execute function saas.definir_atualizado_em();
create trigger trg_usuarios_atualizado_em before update on saas.usuarios for each row execute function saas.definir_atualizado_em();
create trigger trg_permissoes_papeis_atualizado_em before update on saas.permissoes_papeis for each row execute function saas.definir_atualizado_em();
create trigger trg_modulos_sistema_atualizado_em before update on saas.modulos_sistema for each row execute function saas.definir_atualizado_em();
create trigger trg_cfg_modulos_empresa_atualizado_em before update on saas.configuracoes_modulos_empresa for each row execute function saas.definir_atualizado_em();
create trigger trg_cfg_modulos_usuario_atualizado_em before update on saas.configuracoes_modulos_usuario for each row execute function saas.definir_atualizado_em();
create trigger trg_tokens_ia_modulo_atualizado_em before update on saas.tokens_ia_modulo for each row execute function saas.definir_atualizado_em();
create trigger trg_integracoes_atualizado_em before update on saas.integracoes for each row execute function saas.definir_atualizado_em();
create trigger trg_reunioes_atualizado_em before update on saas.reunioes for each row execute function saas.definir_atualizado_em();
create trigger trg_avaliacoes_reunioes_atualizado_em before update on saas.avaliacoes_reunioes for each row execute function saas.definir_atualizado_em();
create trigger trg_instancias_whatsapp_atualizado_em before update on saas.instancias_whatsapp for each row execute function saas.definir_atualizado_em();
create trigger trg_conversas_whatsapp_atualizado_em before update on saas.conversas_whatsapp for each row execute function saas.definir_atualizado_em();
create trigger trg_analises_ia_atualizado_em before update on saas.analises_ia for each row execute function saas.definir_atualizado_em();
create trigger trg_automacoes_webhooks_atualizado_em before update on saas.automacoes_webhooks for each row execute function saas.definir_atualizado_em();

-- =========================
-- COMENTARIOS DE APOIO
-- =========================
comment on schema saas is 'Schema principal do Appmax SaaS';
comment on table saas.tokens_ia_modulo is 'Guarda tokens e modelos por modulo. O token deve ser salvo criptografado.';
comment on table saas.solicitacoes_acesso is 'Fila de triagem para usuarios do dominio sem aprovacao previa.';
