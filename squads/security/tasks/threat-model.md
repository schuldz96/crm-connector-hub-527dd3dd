# Threat Model — STRIDE + PASTA

```yaml
task:
  name: threat-model
  title: "Threat Modeling Completo"
  agent: security-architect
  collaborators: [appsec-engineer, red-team]
  elicit: true
  description: "Executar threat modeling usando STRIDE e PASTA para identificar ameaças ao sistema"

inputs:
  - scope: "Componente ou feature a modelar (ex: autenticação, API WhatsApp, multi-tenant)"
  - context: "Documentação relevante ou código-fonte"

outputs:
  - threat_model: "Documento com ameaças identificadas, classificadas e priorizadas"
  - mitigations: "Lista de mitigações recomendadas"

steps:
  1_define_scope:
    description: "Definir escopo e limites do modelo"
    elicit: true
    prompt: |
      Qual componente/feature deseja modelar?
      1. Sistema completo (visão geral)
      2. Autenticação e sessões
      3. APIs e integrações (Meta, Evolution, OpenAI)
      4. Multi-tenant isolation (empresa_id)
      5. Fluxo de dados pessoais
      6. Outro (especificar)

  2_stride_analysis:
    description: "Análise STRIDE por componente"
    actions:
      - "Para cada componente no escopo, avaliar:"
      - "S — Spoofing: Alguém pode se passar por outro usuário/sistema?"
      - "T — Tampering: Dados podem ser alterados indevidamente?"
      - "R — Repudiation: Ações podem ser negadas sem rastreio?"
      - "I — Information Disclosure: Dados sensíveis podem vazar?"
      - "D — Denial of Service: O serviço pode ser derrubado?"
      - "E — Elevation of Privilege: Alguém pode escalar permissões?"

  3_pasta_risk_analysis:
    description: "Análise PASTA (7 estágios)"
    actions:
      - "1. Definir objetivos de negócio"
      - "2. Definir escopo técnico"
      - "3. Decompor aplicação (data flow diagrams)"
      - "4. Análise de ameaças"
      - "5. Análise de vulnerabilidades"
      - "6. Modelagem de ataques"
      - "7. Análise de risco e impacto"

  4_prioritize:
    description: "Priorizar com DREAD scoring"
    actions:
      - "Classificar cada ameaça por DREAD (1-10):"
      - "Damage, Reproducibility, Exploitability, Affected Users, Discoverability"
      - "Score total = média dos 5 fatores"

  5_mitigations:
    description: "Propor mitigações"
    actions:
      - "Para cada ameaça High/Critical, propor mitigação"
      - "Classificar: Quick Win / Short-term / Long-term"
      - "Atribuir agente responsável da squad"
```
