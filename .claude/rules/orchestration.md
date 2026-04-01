# Orion Orchestration Protocol

## Princípio

Quando o usuário faz um pedido ao `@aiox-master` (Orion), ele **NÃO deve executar tudo sozinho**. Deve identificar a natureza da demanda e **delegar para os agentes especializados**, coordenando o fluxo completo até o deploy.

## Fluxo de Orquestração

### 1. Receber demanda
Orion recebe o pedido do usuário e classifica:

| Tipo | Exemplo | Fluxo |
|------|---------|-------|
| **Feature nova** | "Adicionar página X" | Análise → Arquitetura → Implementação → QA → Deploy |
| **Bug fix** | "Corrigir erro Y" | Diagnóstico → Implementação → Teste → Deploy |
| **Refactor** | "Melhorar componente Z" | Análise → Arquitetura → Implementação → QA → Deploy |
| **Database** | "Criar tabela W" | Data Engineer → Migration → Aplicar → Testar |
| **Pesquisa** | "Investigar como funciona X" | Analyst → Relatório |
| **Deploy** | "Enviar para produção" | DevOps → Push |

### 2. Delegar para agentes (ordem)

```
┌─────────────────────────────────────────────────────────┐
│                    ORION (Master)                        │
│              Recebe demanda, classifica                  │
└──────────────────────┬──────────────────────────────────┘
                       │
         ┌─────────────┼─────────────────┐
         ▼             ▼                 ▼
   ┌──────────┐  ┌──────────┐     ┌──────────┐
   │ @analyst │  │@architect│     │   @pm    │
   │  Pesquisa│  │  Design  │     │Requisitos│
   └────┬─────┘  └────┬─────┘     └────┬─────┘
        │              │                │
        └──────────────┼────────────────┘
                       ▼
                 ┌──────────┐
                 │   @dev   │
                 │Implementa│
                 └────┬─────┘
                      ▼
                 ┌──────────┐
                 │   @qa    │
                 │  Testa   │
                 └────┬─────┘
                      ▼
                 ┌──────────┐
                 │ @devops  │
                 │  Deploy  │
                 └──────────┘
```

### 3. Regras de delegação

**Orion DEVE usar Agent tool (subagentes) para:**
- Pesquisa de código → `subagent_type: Explore`
- Implementação complexa → `subagent_type: general-purpose` com instruções detalhadas
- Tarefas paralelas → múltiplos Agents simultâneos

**Orion DEVE executar diretamente quando:**
- Tarefa simples (< 3 passos)
- Correção pontual (1 arquivo, < 20 linhas)
- Consulta ao banco de dados
- Git status/log

### 4. Protocolo por tipo de demanda

#### Feature Nova
```
1. @analyst → Analisa impacto, dependências existentes
2. @architect → Define abordagem técnica, arquivos a criar/modificar
3. @data-engineer → Cria migrations se necessário (aplica no banco)
4. @dev → Implementa código (pode usar múltiplos subagentes em paralelo)
5. @qa → Roda build (npx tsc + npx vite build), verifica erros
6. @devops → git add + commit + push
```

#### Bug Fix
```
1. Orion → Diagnóstica (lê logs, banco, código)
2. @dev → Implementa correção
3. @qa → Testa (build + verifica)
4. @devops → Commit + push
```

#### Database Change
```
1. @data-engineer → Cria migration SQL
2. Orion → Aplica migration via psql
3. @dev → Atualiza código frontend/backend
4. @qa → Build
5. @devops → Commit + push
```

### 5. Validação obrigatória antes de commit

Orion DEVE garantir antes de qualquer commit:
```bash
npx tsc --noEmit --skipLibCheck  # Zero erros
npx vite build                    # Build OK
```

Se falhar, volta para @dev corrigir.

### 6. Formato do commit

```
tipo: descrição concisa em português

Detalhes do que foi feito.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
```

Tipos: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`

### 7. Testes reais

Quando o usuário pedir para testar algo (ex: "testa o envio de áudio"):
1. Orion DEVE executar a ação real (não apenas ler código)
2. Verificar resultado no banco de dados
3. Verificar logs de erro
4. Reportar resultado ao usuário
5. Se falhou, diagnosticar e corrigir antes de reportar sucesso

**NUNCA dizer "deve funcionar" sem ter testado.**

---

## Squads Disponíveis

### Squad: Framework de Metodologias de Vendas
**Path:** `squads/framework/`
**Descrição:** 12 agentes especialistas em metodologias de vendas para avaliação de reuniões, WhatsApp e ligações.

| Agente | Metodologia | Tier |
|--------|------------|------|
| coach.md | Orquestrador | — |
| sandler.md | Sandler Selling System | Core |
| spin.md | SPIN Selling | Core |
| meddic.md | MEDDIC/MEDDPICC | Core |
| challenger.md | The Challenger Sale | Core |
| gap.md | Gap Selling | Core |
| spiced.md | SPICED (Winning by Design) | Core |
| value-selling.md | Value Selling Framework | Complementar |
| command.md | Command of the Message | Complementar |
| miller-heiman.md | Miller Heiman Strategic Selling | Complementar |
| bant.md | BANT | Opcional |
| neat.md | NEAT Selling | Opcional |
| snap.md | SNAP Selling | Opcional |

**Uso:** Presets disponíveis no AI Config (Reuniões e WhatsApp) para preencher critérios e prompts dos agentes avaliadores.

---

## Contexto do Projeto: Smart Deal Coach

### Stack
- Frontend: React 18 + TypeScript + Vite + Tailwind + shadcn/ui
- Backend: Supabase (PostgreSQL, Edge Functions, Storage)
- WhatsApp: Evolution API (Baileys) + Meta WABA (Cloud API)
- IA: OpenAI (gpt-4o-mini) via proxy RPC
- Deploy: Lovable (push to main = auto-deploy)

### Banco de Dados
- Schema `saas.*` — multi-tenant por `empresa_id`
- Schema `public.*` — Meta inbox (conversations, messages, templates)

### Credenciais do banco (para migrations)
Usar variáveis de ambiente do `.env` local. Nunca hardcodar credenciais em arquivos commitados.

### Edge Functions
- `evaluate-cron` — avaliação automática de conversas/reuniões
- `meet-gateway` — gateway do Google Meet
- `openai-proxy` — proxy para chamadas OpenAI
- `fetch-transcripts` — busca transcrições do Drive
- `meta-webhook` — webhook da Meta WhatsApp Business API
- `meta-upload-media` — proxy de upload de mídia para Meta

### Hierarquia de cargos (visibilidade)
| Cargo | Escopo |
|-------|--------|
| admin/ceo/director | Tudo |
| manager/coordinator | Área |
| supervisor | Time |
| member (Analista) | Próprio |
