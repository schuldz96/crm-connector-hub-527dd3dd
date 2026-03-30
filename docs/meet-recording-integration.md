# Integração de Gravação Automática (Google Meet)

## Objetivo
Além da transcrição automática, o collector agora também busca a **gravação** da reunião, salva metadados no banco e expõe via API para consumo no SaaS.

## Fluxo
1. O cron do `meet-collector` continua descobrindo novas reuniões via Google Reports.
2. Para cada `conference_key`, o endpoint `POST /meet/run-conference`:
   - resolve transcrição (fluxo existente), e
   - resolve gravação (`video/mp4`) buscando no Drive dos owners internos.
3. Quando encontra gravação:
   - grava `recording_source_file_id` em `saas.meet_conferences`.
   - tenta copiar para pasta central (`DESTINATION_FOLDER_ID`) e, se der certo, grava `recording_copied_file_id`.
   - persiste nome, mime type, tamanho e links web.
4. Trigger sincroniza os dados de gravação para `saas.reunioes`.

## Colunas adicionadas
### `saas.meet_conferences`
- `recording_source_file_id`
- `recording_copied_file_id`
- `recording_name`
- `recording_mime_type`
- `recording_size_bytes`
- `recording_web_view_link`
- `recording_web_content_link`

### `saas.reunioes`
- `gravacao_file_id`
- `gravacao_nome`
- `gravacao_link`

## API / RPC
A RPC `saas.buscar_transcript_file(p_conference_key)` agora retorna também os campos de gravação:
- `recording_source_file_id`
- `recording_copied_file_id`
- `recording_name`
- `recording_mime_type`
- `recording_size_bytes`
- `recording_web_view_link`
- `recording_web_content_link`

## Arquivos alterados
- `services/meet-collector/server.js`
- `services/meet-collector/scripts/db-migrate.js`
- `services/meet-collector/migrations/008_add_recording_columns.sql`
- `supabase/migrations/20260330160000_meet_gravacoes.sql`
- `src/lib/meetingsService.ts`
- `src/pages/MeetingsPage.tsx`

## Deploy
- Aplicar migration SQL no banco (já aplicada localmente nesta execução).
- Publicar as alterações do `meet-collector` na VM e reiniciar serviço.
- Publicar frontend (Lovable/GitHub) para mostrar disponibilidade de gravação na tela de reunião.
