---
task: Evaluate with SNAP Selling
responsavel: "@snap"
responsavel_type: agent
atomic_layer: task
Entrada: |
  - transcript: Transcrição ou conteúdo da interação
  - input_type: meet_transcript | whatsapp_messages | call_transcript
Saida: |
  - score: 0-100
  - principle_scores: Score por princípio S-N-A-P
  - decision_stage: access | initiate_change | select_solution
  - feedback: Análise por princípio
---

# SNAP Evaluate

## Processo de Avaliação

1. **Avaliar Simplicity** — mensagem clara e direta?
2. **Avaliar iNvaluable** — valor agregado em cada interação?
3. **Avaliar Alignment** — alinhado com prioridades do prospect?
4. **Avaliar Priority** — urgência construída?
5. **Identificar Decision Stage** — qual das 3 decisões o prospect está tomando?
6. **Calcular score**

## Dimensões

| Dimensão | Peso |
|----------|------|
| Simplicity of Message | 25% |
| Value Added (iNvaluable) | 30% |
| Alignment with Prospect | 25% |
| Priority Creation | 20% |
