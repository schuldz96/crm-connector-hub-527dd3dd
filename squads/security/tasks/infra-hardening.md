# Infrastructure Hardening — CIS Benchmarks

```yaml
task:
  name: infra-hardening
  title: "Hardening de Infraestrutura"
  agent: devsecops
  collaborators: [security-architect]
  elicit: false
  description: "Auditar e endurecer configuração de infraestrutura usando CIS Benchmarks"

inputs:
  - scope: "Supabase, CI/CD, dependências, edge functions"

outputs:
  - audit_report: "Relatório de conformidade CIS"
  - remediation_plan: "Plano de remediação priorizado"

steps:
  1_secrets_audit:
    description: "Auditar gestão de segredos"
    checks:
      - "Nenhum segredo em código-fonte (.env.example sem valores)"
      - "Tokens criptografados no banco (token_criptografado)"
      - "Variáveis de ambiente no Supabase/Lovable configuradas"
      - "Rotação de tokens implementada ou planejada"
      - ".gitignore inclui .env e arquivos sensíveis"

  2_supabase_hardening:
    description: "Hardening do Supabase"
    checks:
      - "RLS habilitado em todas as tabelas saas.*"
      - "Service role key não exposta no frontend"
      - "Anon key com permissões mínimas"
      - "Storage buckets com policies adequadas"
      - "Edge functions com validação de input"

  3_cicd_security:
    description: "Segurança do pipeline CI/CD"
    checks:
      - "GitHub Actions com permissões mínimas"
      - "Secrets do GitHub (não hardcoded)"
      - "Deploy automático apenas na main"
      - "Branch protection rules configuradas"

  4_dependency_audit:
    description: "Auditoria de dependências"
    actions:
      - "npm audit — verificar vulnerabilidades conhecidas"
      - "Verificar dependências desatualizadas (npm outdated)"
      - "Checar licenças incompatíveis"
      - "Verificar integridade do lock file"

  5_headers_and_config:
    description: "Headers de segurança e configuração"
    checks:
      - "HTTPS forçado"
      - "CORS configurado corretamente"
      - "Content-Security-Policy definido"
      - "X-Frame-Options, X-Content-Type-Options"
      - "Strict-Transport-Security (HSTS)"
```
