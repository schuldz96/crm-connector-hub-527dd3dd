---
task: Evaluate with BANT
responsavel: "@bant"
responsavel_type: agent
atomic_layer: task
Entrada: |
  - transcript: Transcrição ou conteúdo da interação
  - input_type: meet_transcript | whatsapp_messages | call_transcript
Saida: |
  - score: 0-100
  - scorecard: Status B-A-N-T (confirmed/exploring/unknown)
  - criteria_met: 0-4
  - qualification: Fully | Mostly | Partially | Unqualified
  - feedback: Análise por critério
---

# BANT Evaluate

## Processo de Avaliação

1. **Verificar Budget** — confirmado, explorando ou desconhecido?
2. **Verificar Authority** — decisor, influenciador ou gatekeeper?
3. **Verificar Need** — crítica, importante ou nice-to-have?
4. **Verificar Timeline** — urgente, definida ou flexível?
5. **Contar critérios** confirmados e classificar

## Scorecard

| Letra | Status | Peso |
|-------|--------|------|
| B — Budget | 25% | confirmed/exploring/unknown/no_budget |
| A — Authority | 25% | decision_maker/influencer/gatekeeper/unknown |
| N — Need | 30% | critical/important/nice_to_have/no_need |
| T — Timeline | 20% | urgent/defined/flexible/no_timeline |
