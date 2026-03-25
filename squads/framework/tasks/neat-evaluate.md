---
task: Evaluate with NEAT Selling
responsavel: "@neat"
responsavel_type: agent
atomic_layer: task
Entrada: |
  - transcript: Transcrição ou conteúdo da interação
  - input_type: meet_transcript | whatsapp_messages | call_transcript
Saida: |
  - score: 0-100
  - criteria_status: Status N-E-A-T
  - economic_impact_value: Valor do impacto econômico se identificado
  - feedback: Análise por critério
---

# NEAT Evaluate

## Processo de Avaliação

1. **Avaliar Need** — dor real ou superficial?
2. **Avaliar Economic Impact** — quantificado ou vago?
3. **Avaliar Access to Authority** — path claro para decisor?
4. **Avaliar Timeline** — compelling event externo?
5. **Calcular score**

## Dimensões

| Dimensão | Peso |
|----------|------|
| Core Need Depth | 30% |
| Economic Impact Quantification | 30% |
| Access to Authority | 20% |
| Compelling Event / Timeline | 20% |
