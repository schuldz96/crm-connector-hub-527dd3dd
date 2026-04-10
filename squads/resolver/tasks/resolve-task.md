# Task: Resolve Backlog Task

**ID:** resolve-task
**Squad:** resolver
**Trigger:** `*resolve {task_id}` ou `*resolve-backlog {task_id}`
**Elicit:** false (automático)

## Pré-condições

- Task existe no banco admin.backlog_tasks
- Task NÃO está em status 'done'

## Variáveis de Ambiente

```
SUPABASE_URL = https://ugdojctvzifycofqzelf.supabase.co
ANON_KEY = (de .env ou src/lib/config.ts)
SERVICE_KEY = (de .env — apenas para operações admin)
```

## Pipeline de Execução

### FASE 0 — Carregar Task
**Agente:** Orchestrator

```
1. Buscar task no banco:
   GET /rest/v1/backlog_tasks?id=eq.{task_id}
   Headers: Accept-Profile: admin

2. Validar:
   - task.status !== 'done'
   - task tem titulo e descricao

3. Apresentar ao usuário:
   "🔄 Iniciando resolução: {titulo} ({tipo})"

4. PATCH status → 'analyzing'
   Adicionar agente_historico entry
```

### FASE 1 — Análise
**Agente:** Analyzer (@analyst)
**Status no banco:** analyzing

```
1. Classificar a demanda pelo titulo + descricao
2. Se tipo = 'bug':
   - Buscar no código por keywords da descrição
   - Ler arquivos relacionados
   - Identificar causa raiz
3. Se tipo = 'feature' ou 'improvement':
   - Identificar onde implementar
   - Verificar padrões existentes
   - Listar arquivos a criar/modificar
4. Produzir analysis_report
5. PATCH agente_historico com nota do que encontrou
```

### FASE 2 — Desenvolvimento
**Agente:** Developer (@dev)
**Status no banco:** developing

```
1. Consumir analysis_report
2. Para cada arquivo:
   a. Read arquivo completo
   b. Entender contexto
   c. Aplicar mudança com Edit
3. Verificação rápida:
   npx tsc --noEmit --skipLibCheck
4. Se erros: corrigir imediatamente
5. PATCH agente_historico com resumo das mudanças

⚠️ Se dúvida:
   → Documentar dúvida
   → Voltar para FASE 1 com contexto
   → Analyzer investiga e retorna
```

### FASE 3 — Testes
**Agente:** Tester (@qa)
**Status no banco:** testing
**Max loops:** 3

```
1. Build check:
   npx tsc --noEmit --skipLibCheck
   npx vite build
   → Se FAIL: volta para FASE 2 com issues

2. Banco de dados:
   - Verificar tabelas existem (REST API query)
   - Verificar RLS/grants
   → Se FAIL: volta para FASE 2

3. Conexões:
   - Imports corretos
   - Hooks React em ordem
   - QueryKeys corretos

4. UI/Componentes:
   - Botões com onClick
   - Forms com onSubmit
   - Sem temporal dead zone
   - Sem keys faltando em .map()

5. Integridade:
   - Sem console.log debug
   - Sem credenciais expostas
   - Padrões seguidos

6. Veredito:
   PASS → Avança para FASE 4
   FAIL → Envia issues para dev → Volta FASE 2
          (incrementa loop counter)
   FAIL (3x) → Escala para usuário

7. PATCH agente_historico com veredito
```

### FASE 4 — Deploy
**Agente:** Deployer (@devops)
**Status no banco:** deploying

```
1. git status → verificar mudanças
2. git add {arquivos específicos}
3. git commit -m "{tipo}: {descrição}"
4. git push origin main
5. Verificar: git log origin/main --oneline -1
6. PATCH agente_historico com hash do commit
```

### FASE 5 — Concluir
**Agente:** Orchestrator
**Status no banco:** done

```
1. PATCH backlog_tasks SET status='done'
2. Apresentar relatório final ao usuário:

   ✅ Task "{titulo}" concluída!

   📊 Resumo:
   - Tipo: {tipo}
   - Arquivos: {lista}
   - Ciclos QA: {count}
   - Commit: {hash}
   - Deploy: Lovable auto-deploy ativo
```

## Tratamento de Erros

| Erro | Ação |
|------|------|
| Task não encontrada | Informar usuário, abortar |
| Build falha 3x | Escalar para usuário com log |
| Push falha | Diagnosticar e retry 1x |
| DB inacessível | Continuar com localStorage fallback |
| Dúvida do dev | Loop analyze↔develop (max 2x) |

## Atualização do Banco

A cada transição de fase, PATCH a task:

```json
{
  "status": "{novo_status}",
  "agente_atual": "{agente_id}",
  "agente_historico": [
    ...existing,
    {
      "agente": "{agente_id}",
      "status": "{novo_status}",
      "timestamp": "{ISO_8601}",
      "nota": "{o que o agente fez}"
    }
  ],
  "atualizado_em": "{ISO_8601}"
}
```
