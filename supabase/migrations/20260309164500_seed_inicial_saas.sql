-- Seed inicial para deixar o SaaS funcional desde o primeiro login

-- Empresa base
insert into saas.empresas (nome, dominio, plano)
values ('Appmax', 'appmax.com.br', 'enterprise')
on conflict (dominio) do update
set nome = excluded.nome,
    plano = excluded.plano,
    atualizado_em = now();

-- Modulos padrao do sistema
insert into saas.modulos_sistema (codigo, nome, descricao)
values
  ('dashboard',    'Dashboard',    'Visao geral de performance'),
  ('meetings',     'Reunioes',     'Gestao e analise de reunioes comerciais'),
  ('whatsapp',     'WhatsApp',     'Instancias e conversas'),
  ('performance',  'Desempenho',   'KPIs por usuario, time e area'),
  ('training',     'Treinamentos', 'Simulacoes e evolucao comercial'),
  ('teams',        'Times',        'Gestao de equipes'),
  ('areas',        'Areas',        'Gestao de areas da empresa'),
  ('users',        'Usuarios',     'Gestao de acessos e perfis'),
  ('reports',      'Relatorios',   'Relatorios e exportacoes'),
  ('integrations', 'Integracoes',  'Conexao com ferramentas externas'),
  ('automations',  'Automacoes',   'Webhooks e fluxos com n8n'),
  ('ai-config',    'Config. IA',   'Modelos e tokens por modulo'),
  ('admin',        'Admin',        'Configuracoes globais da plataforma')
on conflict (codigo) do update
set nome = excluded.nome,
    descricao = excluded.descricao,
    atualizado_em = now();

-- Habilita todos os modulos para a empresa base
insert into saas.configuracoes_modulos_empresa (empresa_id, modulo_codigo, habilitado)
select e.id, m.codigo, true
from saas.empresas e
join saas.modulos_sistema m on true
where e.dominio = 'appmax.com.br'
on conflict (empresa_id, modulo_codigo) do update
set habilitado = excluded.habilitado,
    atualizado_em = now();

-- Usuarios administradores iniciais
insert into saas.usuarios (empresa_id, nome, email, papel, status)
select e.id, 'Yuri Santos', 'yuri.santos@appmax.com.br', 'admin', 'ativo'
from saas.empresas e
where e.dominio = 'appmax.com.br'
on conflict (email) do update
set nome = excluded.nome,
    papel = excluded.papel,
    status = excluded.status,
    atualizado_em = now();

insert into saas.usuarios (empresa_id, nome, email, papel, status)
select e.id, 'Marcos Schuldz', 'marcos.schuldz@appmax.com.br', 'admin', 'ativo'
from saas.empresas e
where e.dominio = 'appmax.com.br'
on conflict (email) do update
set nome = excluded.nome,
    papel = excluded.papel,
    status = excluded.status,
    atualizado_em = now();

-- Permissoes de recurso por papel (alinhado com frontend atual)
insert into saas.permissoes_papeis (papel, recurso, escopo, permitido)
values
  -- admin
  ('admin','dashboard','todos',true),
  ('admin','meetings','todos',true),
  ('admin','whatsapp','todos',true),
  ('admin','performance','todos',true),
  ('admin','training','todos',true),
  ('admin','teams','todos',true),
  ('admin','areas','todos',true),
  ('admin','users','todos',true),
  ('admin','reports','todos',true),
  ('admin','integrations','todos',true),
  ('admin','automations','todos',true),
  ('admin','ai-config','todos',true),
  ('admin','admin','todos',true),

  -- ceo
  ('ceo','dashboard','todos',true),
  ('ceo','meetings','todos',true),
  ('ceo','whatsapp','todos',true),
  ('ceo','performance','todos',true),
  ('ceo','training','todos',true),
  ('ceo','teams','todos',true),
  ('ceo','areas','todos',true),
  ('ceo','users','todos',true),
  ('ceo','reports','todos',true),
  ('ceo','integrations','todos',true),
  ('ceo','automations','todos',true),
  ('ceo','ai-config','todos',true),

  -- diretor
  ('diretor','dashboard','todos',true),
  ('diretor','meetings','todos',true),
  ('diretor','whatsapp','todos',true),
  ('diretor','performance','todos',true),
  ('diretor','training','todos',true),
  ('diretor','teams','todos',true),
  ('diretor','areas','todos',true),
  ('diretor','users','todos',true),
  ('diretor','reports','todos',true),

  -- gerente
  ('gerente','dashboard','area',true),
  ('gerente','meetings','area',true),
  ('gerente','whatsapp','area',true),
  ('gerente','performance','area',true),
  ('gerente','training','area',true),
  ('gerente','teams','area',true),
  ('gerente','areas','area',true),
  ('gerente','users','area',true),
  ('gerente','reports','area',true),

  -- coordenador
  ('coordenador','dashboard','time',true),
  ('coordenador','meetings','time',true),
  ('coordenador','whatsapp','time',true),
  ('coordenador','performance','time',true),
  ('coordenador','training','time',true),
  ('coordenador','teams','time',true),
  ('coordenador','reports','time',true),

  -- supervisor
  ('supervisor','dashboard','time',true),
  ('supervisor','meetings','time',true),
  ('supervisor','whatsapp','time',true),
  ('supervisor','performance','time',true),
  ('supervisor','training','time',true),
  ('supervisor','teams','time',true),
  ('supervisor','reports','time',true),

  -- vendedor (member no frontend)
  ('vendedor','dashboard','proprio',true),
  ('vendedor','meetings','proprio',true),
  ('vendedor','whatsapp','proprio',true),
  ('vendedor','performance','proprio',true),
  ('vendedor','training','proprio',true)
on conflict (papel, recurso) do update
set escopo = excluded.escopo,
    permitido = excluded.permitido,
    atualizado_em = now();
