---
task: Evaluate with SPICED Framework
responsavel: "@spiced"
responsavel_type: agent
atomic_layer: task
Entrada: |
  - transcript: Transcrição ou conteúdo da interação
  - input_type: meet_transcript | whatsapp_messages | call_transcript
Saida: |
  - score: 0-100
  - classification: Master | Proficient | Developing | Beginner | Non-SPICED
  - dimension_scores: Score por dimensão do SPICED
  - red_flags: Lista de red flags encontradas
  - green_flags: Lista de green flags encontradas
  - feedback: Feedback detalhado por dimensão
---

# SPICED Evaluate

## Processo de Avaliação

1. **Ler transcrição completa** antes de avaliar
2. **Identificar cada dimensão** do SPICED presente na interação
3. **Avaliar técnicas** (SPICED Flow, Impact Quantification, Recurring Revenue Mindset)
4. **Pontuar cada dimensão** (escala 1-5)
5. **Aplicar red flags** (-10 pts cada) e **green flags** (+5 pts cada, max +15)
6. **Calcular score final** com pesos

## Dimensões de Avaliação

| # | Dimensão | Peso | Critérios |
|---|----------|------|-----------|
| 1 | Situation Understanding | 10% | Estado atual, ferramentas, time, KPIs |
| 2 | Pain Identification Depth | 25% | Dores específicas, múltiplas, priorizadas |
| 3 | Impact Quantification | 25% | Financeiro, tempo, métricas SaaS, números do prospect |
| 4 | Critical Event Urgency | 20% | Evento identificado, deadline, consequência, validado |
| 5 | Decision Process Mapping | 10% | Stakeholders, critérios, timeline, blockers |
| 6 | SPICED Flow & Techniques | 10% | Progressão S→P→I→C→D, recurring revenue mindset, impact metrics |

## Red Flags (-10 pts cada)
- Nenhum Pain identificado na interação
- Zero quantificação de Impact
- Nenhum Critical Event identificado
- Apresentação feita antes do SPICED completo

## Green Flags (+5 pts cada, max +15)
- Impact quantificado com números do próprio prospect
- Critical Event com deadline hard confirmada
- Processo de Decision completamente mapeado
