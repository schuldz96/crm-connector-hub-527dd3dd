# Access Control Audit — RBAC e RLS

```yaml
task:
  name: access-control-audit
  title: "Auditoria de Controle de Acesso"
  agent: iam-specialist
  collaborators: [red-team, appsec-engineer]
  elicit: false
  description: "Auditar controles de acesso, hierarquia de cargos, RLS e isolamento multi-tenant"

inputs:
  - scope: "Sistema completo ou módulo específico"

outputs:
  - audit_report: "Relatório de controle de acesso"
  - permission_matrix: "Matriz de permissões atual vs esperada"

steps:
  1_hierarchy_audit:
    description: "Auditar hierarquia de cargos"
    checks:
      - "admin/ceo/director → scope: all (tudo da empresa)"
      - "manager/coordinator → scope: area (dados da área)"
      - "supervisor → scope: team (dados do time)"
      - "member → scope: self (apenas seus dados)"
    actions:
      - "Verificar tabela saas.usuarios — campo 'papel'"
      - "Verificar relação com saas.areas e saas.times"
      - "Validar que escopo é aplicado em todas as queries"

  2_rls_audit:
    description: "Auditar RLS do Supabase"
    actions:
      - "Listar todas as tabelas do schema saas.*"
      - "Verificar RLS habilitado em cada tabela"
      - "Verificar policies para SELECT, INSERT, UPDATE, DELETE"
      - "Validar filtro por empresa_id via JWT"
      - "Testar se service role bypassa RLS adequadamente"

  3_cross_tenant_test:
    description: "Testar isolamento multi-tenant"
    actions:
      - "Verificar que usuário da empresa A não acessa dados da empresa B"
      - "Verificar em: reuniões, conversas WhatsApp, análises IA, configurações"
      - "Testar via API direta (sem frontend)"

  4_privilege_escalation:
    description: "Testar escalação de privilégio"
    actions:
      - "member tentando acessar dados de outro member (IDOR)"
      - "supervisor tentando acessar dados fora do time"
      - "manager tentando acessar dados fora da área"
      - "Manipulação de JWT/session para alterar papel"

  5_report:
    description: "Gerar relatório e matriz de permissões"
    format: |
      ## Auditoria de Controle de Acesso
      **Tabelas com RLS:** X/Y
      **Policies verificadas:** X
      **Isolamento multi-tenant:** OK/FALHA
      **Escalação detectada:** Sim/Não
      **Achados:** ...
      **Recomendações:** ...
```
