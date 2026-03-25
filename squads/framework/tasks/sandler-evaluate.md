---
task: Evaluate with Sandler Selling System
responsavel: "@sandler"
responsavel_type: agent
atomic_layer: task
Entrada: |
  - transcript: Transcrição ou conteúdo da interação
  - input_type: meet_transcript | whatsapp_messages | call_transcript
Saida: |
  - score: 0-100
  - classification: Master | Proficient | Developing | Beginner | Non-Sandler
  - compartment_scores: Score por compartimento do Submarine
  - red_flags: Lista de red flags encontradas
  - green_flags: Lista de green flags encontradas
  - feedback: Feedback detalhado por compartimento
---

# Sandler Evaluate

## Processo de Avaliação

1. **Ler transcrição completa** antes de avaliar
2. **Identificar cada compartimento** do Submarine presente na interação
3. **Avaliar técnicas** (Reversing, Negative Reverse, Pain Funnel, etc.)
4. **Pontuar cada dimensão** (escala 1-5)
5. **Aplicar red flags** (-10 pts cada) e **green flags** (+5 pts cada, max +15)
6. **Calcular score final** com pesos

## Dimensões de Avaliação

| # | Dimensão | Peso | Critérios |
|---|----------|------|-----------|
| 1 | Bonding & Rapport Quality | 10% | Conexão genuína, escuta ativa, igualdade |
| 2 | Upfront Contract Completeness | 10% | 4 componentes presentes, prospect concordou |
| 3 | Pain Discovery Depth | 25% | 3 níveis, Pain Funnel, quantificação |
| 4 | Budget Qualification | 10% | Antes da apresentação, técnica indireta |
| 5 | Decision Process Mapping | 10% | Stakeholders, processo, timeline |
| 6 | Fulfillment Precision | 10% | Dor→feature, sem dump, validação |
| 7 | Post-Sell Robustness | 5% | Objeções futuras, próximos passos |
| 8 | Technique Execution | 10% | Reversing, Negative Reverse, TA |
| 9 | Process Discipline | 5% | Sequência respeitada, retorno quando necessário |
| 10 | Equal Business Stature | 5% | Postura de igual, sem chasing |

## Red Flags (-10 pts cada)
- Apresentação antes do Pain Discovery completo
- Nenhum Upfront Contract
- Budget não discutido antes da proposta
- Pergunta técnica respondida sem Reversing
- "Vou pensar" aceito sem questionar
- Feature dump sem conexão com dores

## Green Flags (+5 pts cada, max +15)
- Pain Funnel completo até nível pessoal
- Prospect verbaliza dor espontaneamente
- Negative Reverse usado com sucesso
- Prospect cria urgência por conta própria
- Upfront Contract para próxima reunião
