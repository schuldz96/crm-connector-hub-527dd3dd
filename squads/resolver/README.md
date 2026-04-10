# Squad: Resolver

Pipeline automatizado de resolução de tasks do Backlog Board.

## Como Usar

```
@aiox-master *resolve {task_id}
```

Ou ative o squad:
```
@resolver *resolve {task_id}
```

## Pipeline

```
📋 Backlog
   │
   ▼
🔍 Análise (@analyst)
   │  Identifica causa raiz, arquivos, abordagem
   │
   ▼
💻 Desenvolvimento (@dev) ◄──┐
   │  Implementa solução      │ (se QA falhar,
   │                           │  max 3 loops)
   ▼                           │
✅ Testes (@qa) ───────────────┘
   │  Build, DB, UI, integridade
   │
   ▼
🚀 Deploy (@devops)
   │  Commit + push → Lovable
   │
   ▼
✨ Concluído
```

## Agentes

| Agente | AIOX Agent | Função |
|--------|-----------|--------|
| orchestrator | @aiox-master | Controla pipeline, atualiza banco |
| analyzer | @analyst | Investiga demanda, mapeia escopo |
| developer | @dev | Implementa solução |
| tester | @qa | Valida build, DB, UI, conexões |
| deployer | @devops | Commit, push, deploy |

## Checks do Tester

1. **Build:** tsc + vite build (zero erros)
2. **Banco:** tabelas existem, RLS ativo, queries OK
3. **Conexões:** imports, hooks, services conectados
4. **UI:** botões, forms, handlers, props, keys
5. **Integridade:** sem debug logs, sem credenciais, padrões OK

## Configuração

- Max loops QA↔Dev: **3**
- Auto-deploy: **sim** (push to main)
- Atualiza backlog: **sim** (Supabase admin.backlog_tasks)
