# Incident Response — Playbook de Resposta

```yaml
task:
  name: incident-response
  title: "Resposta a Incidente de Segurança"
  agent: incident-responder
  collaborators: [security-architect, devsecops, compliance-lgpd]
  elicit: true
  description: "Playbook de resposta a incidentes seguindo NIST IR framework"

inputs:
  - incident_type: "Tipo de incidente (vazamento, acesso indevido, anomalia)"
  - severity: "Severidade inicial (critical, high, medium, low)"

outputs:
  - incident_report: "Relatório do incidente com timeline"
  - postmortem: "Análise postmortem com lessons learned"

steps:
  1_triage:
    description: "Triagem e classificação"
    elicit: true
    prompt: |
      Descreva o incidente:
      1. O que foi detectado?
      2. Quando foi detectado?
      3. Quem reportou?
      4. Qual o impacto estimado?

  2_containment:
    description: "Contenção imediata"
    actions:
      - "Isolar componente afetado"
      - "Revogar tokens/sessões comprometidos"
      - "Bloquear acesso do vetor de ataque"
      - "Preservar logs e evidências"

  3_investigation:
    description: "Investigação"
    actions:
      - "Construir timeline do incidente"
      - "Identificar root cause"
      - "Mapear blast radius (dados/usuários afetados)"
      - "Correlacionar com MITRE ATT&CK TTPs"

  4_eradication:
    description: "Erradicação"
    actions:
      - "Remover acesso do atacante"
      - "Corrigir vulnerabilidade explorada"
      - "Verificar se há backdoors"
      - "Atualizar componentes comprometidos"

  5_recovery:
    description: "Recuperação"
    actions:
      - "Restaurar serviços afetados"
      - "Validar integridade dos dados"
      - "Monitorar por recorrência"
      - "Comunicar stakeholders"

  6_lessons_learned:
    description: "Postmortem e aprendizado"
    format: |
      ## Postmortem — [Título do Incidente]
      **Severidade:** ...
      **Duração:** ...
      **Impacto:** ...
      **Timeline:** ...
      **Root Cause:** ...
      **O que funcionou:** ...
      **O que falhou:** ...
      **Action items:** ...
```
