# Compliance Audit — LGPD

```yaml
task:
  name: compliance-audit
  title: "Auditoria de Conformidade LGPD"
  agent: compliance-lgpd
  collaborators: [iam-specialist, security-architect]
  elicit: true
  description: "Auditoria completa de conformidade com LGPD para o sistema Smart Deal Coach"

inputs:
  - scope: "Módulo ou sistema completo"

outputs:
  - compliance_report: "Relatório de conformidade LGPD"
  - gap_analysis: "Análise de gaps e plano de ação"
  - data_map: "Mapeamento de dados pessoais"

steps:
  1_data_inventory:
    description: "Inventário de dados pessoais"
    actions:
      - "Mapear todas as tabelas que armazenam PII"
      - "Classificar dados: pessoal, sensível, anonimizado"
      - "Identificar fluxo: coleta → processamento → armazenamento → descarte"

  2_legal_basis:
    description: "Verificar base legal (Art. 7)"
    checks:
      - "Cada coleta de dado pessoal tem base legal definida?"
      - "Consentimento é registrado e revogável?"
      - "Legítimo interesse tem LIA (Legitimate Interest Assessment)?"

  3_rights_check:
    description: "Direitos do titular (Arts. 17-22)"
    checks:
      - "Acesso: titular pode ver seus dados?"
      - "Correção: titular pode corrigir dados incorretos?"
      - "Exclusão: titular pode solicitar remoção?"
      - "Portabilidade: dados podem ser exportados?"
      - "Informação: política de privacidade clara e acessível?"

  4_security_measures:
    description: "Medidas de segurança (Art. 46)"
    checks:
      - "Criptografia em trânsito (HTTPS/TLS)"
      - "Criptografia em repouso (tokens, senhas)"
      - "Controle de acesso (RBAC por cargo)"
      - "Logs de auditoria (quem acessou o quê)"
      - "Backup e recuperação"

  5_incident_readiness:
    description: "Prontidão para incidentes (Art. 48)"
    checks:
      - "Plano de resposta a incidentes documentado?"
      - "Processo de notificação à ANPD definido?"
      - "Prazo de notificação (<72h recomendado)?"
      - "DPO/Encarregado definido?"

  6_report:
    description: "Gerar relatório de conformidade"
    format: |
      ## Score de Conformidade LGPD
      **Geral:** X/100
      **Dados pessoais mapeados:** X tabelas
      **Base legal documentada:** X%
      **Direitos implementados:** X/5
      **Gaps críticos:** ...
      **Plano de ação:** ...
```
