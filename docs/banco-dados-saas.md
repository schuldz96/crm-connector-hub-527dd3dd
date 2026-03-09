# Banco de Dados SaaS (Schema `saas`)

Este projeto agora possui um schema relacional completo para operar em banco real (PostgreSQL/Supabase), com tabelas em portugues e pronto para producao inicial.

## Arquivos criados

- `supabase/migrations/20260309164000_schema_saas.sql`: estrutura completa (schema, enums, tabelas, FKs, indices, triggers).
- `supabase/migrations/20260309164500_seed_inicial_saas.sql`: dados iniciais (empresa base, modulos, permissoes e 2 admins).

## Como aplicar no Supabase

### Opcao 1: SQL Editor (recomendado)

1. Abra o projeto no Supabase Dashboard.
2. Entre em **SQL Editor**.
3. Execute primeiro o arquivo `20260309164000_schema_saas.sql`.
4. Execute depois o arquivo `20260309164500_seed_inicial_saas.sql`.

### Opcao 2: `psql` via pooler

Use a string (substituindo a senha real):

```bash
postgresql://postgres.lwusznsduxcqjjmbbobt:[SUA-SENHA]@aws-1-us-east-1.pooler.supabase.com:5432/postgres
```

Comandos:

```bash
export PGPASSWORD='SUA-SENHA'

psql \
  -h aws-1-us-east-1.pooler.supabase.com \
  -p 5432 \
  -d postgres \
  -U postgres.lwusznsduxcqjjmbbobt \
  -f supabase/migrations/20260309164000_schema_saas.sql

psql \
  -h aws-1-us-east-1.pooler.supabase.com \
  -p 5432 \
  -d postgres \
  -U postgres.lwusznsduxcqjjmbbobt \
  -f supabase/migrations/20260309164500_seed_inicial_saas.sql
```

## Mapa de tabelas

### Organizacao

- `saas.empresas`: tenant/empresa.
- `saas.areas`: agrupador de times.
- `saas.times`: equipes comerciais.
- `saas.usuarios`: usuarios da plataforma (papel, status, relacao com area/time).

### Acesso e administracao

- `saas.solicitacoes_acesso`: fila de triagem para login de usuarios do dominio.
- `saas.permissoes_papeis`: matriz de permissao por papel + recurso + escopo.
- `saas.modulos_sistema`: catalogo de modulos habilitaveis.
- `saas.configuracoes_modulos_empresa`: liga/desliga modulo por empresa.
- `saas.configuracoes_modulos_usuario`: override por usuario.
- `saas.tokens_ia_modulo`: token/modelo por modulo (armazenamento sensivel).
- `saas.integracoes`: conectores externos (Google, OpenAI, Evolution, n8n etc).

### Operacao comercial

- `saas.reunioes`: reunioes comerciais.
- `saas.avaliacoes_reunioes`: score detalhado por reuniao.

### WhatsApp e IA

- `saas.instancias_whatsapp`: instancias conectadas.
- `saas.conversas_whatsapp`: conversas por contato/instancia.
- `saas.mensagens_whatsapp`: mensagens normalizadas.
- `saas.analises_ia`: resultados de analise de IA por contexto.

### Automacoes, logs e notificacoes

- `saas.automacoes_webhooks`: configuracoes de webhook por evento.
- `saas.eventos_webhooks`: historico de disparo e status de entrega.
- `saas.logs_auditoria`: trilha de auditoria.
- `saas.notificacoes`: notificacoes por usuario.

## Relacao com o frontend atual

- O frontend ainda usa majoritariamente `localStorage`/mocks para leitura/escrita.
- Este schema prepara o ambiente para migrar os contextos para leitura/escrita real via Supabase.
- Recomendacao imediata: iniciar migração por:
  1. `usuarios` + `solicitacoes_acesso`
  2. `times`/`areas`
  3. `reunioes`/`avaliacoes_reunioes`
  4. `instancias_whatsapp`/`conversas_whatsapp`/`mensagens_whatsapp`

## Seguranca (proximo passo)

- Ativar RLS nas tabelas sensiveis.
- Expor somente views/funcoes necessarias ao frontend.
- Mover todos os segredos para backend/edge functions (`SUPABASE_SERVICE_ROLE_KEY` nunca no frontend).
- Salvar `token_criptografado` com criptografia de aplicacao (KMS/secret manager).
