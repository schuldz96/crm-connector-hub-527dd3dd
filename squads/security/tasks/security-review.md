# Security Review — Code Review com OWASP ASVS

```yaml
task:
  name: security-review
  title: "Security Code Review"
  agent: appsec-engineer
  collaborators: [iam-specialist]
  elicit: true
  description: "Code review focado em segurança usando OWASP ASVS como checklist"

inputs:
  - target: "Arquivo(s) ou diretório a revisar"
  - level: "ASVS Level (L1=mínimo, L2=padrão, L3=avançado)"

outputs:
  - findings: "Lista de achados com severidade e recomendação"
  - score: "Score de conformidade ASVS"

steps:
  1_select_target:
    elicit: true
    prompt: |
      O que deseja revisar?
      1. Arquivo(s) específico(s)
      2. Módulo/feature completo
      3. Toda a aplicação (L1 superficial)

  2_asvs_check:
    description: "Verificar contra OWASP ASVS"
    categories:
      V1: "Architecture & Design"
      V2: "Authentication"
      V3: "Session Management"
      V4: "Access Control"
      V5: "Input Validation"
      V6: "Cryptography"
      V7: "Error Handling & Logging"
      V8: "Data Protection"
      V9: "Communication Security"
      V10: "Malicious Code"
      V11: "Business Logic"
      V12: "Files & Resources"
      V13: "API & Web Services"
      V14: "Configuration"

  3_classify_findings:
    description: "Classificar achados"
    severities:
      critical: "Exploração imediata possível, dados sensíveis expostos"
      high: "Vulnerabilidade explorável com esforço moderado"
      medium: "Vulnerabilidade que requer condições específicas"
      low: "Melhoria de segurança, risco mínimo"
      info: "Observação, boa prática não seguida"

  4_report:
    description: "Gerar relatório com achados e recomendações"
```
