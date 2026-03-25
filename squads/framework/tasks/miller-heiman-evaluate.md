---
task: Evaluate with Miller Heiman Strategic Selling
responsavel: "@miller-heiman"
responsavel_type: agent
atomic_layer: task
Entrada: |
  - transcript: Transcrição ou conteúdo da interação
  - input_type: meet_transcript | whatsapp_messages | call_transcript
Saida: |
  - score: 0-100
  - stakeholder_map: 4 Buying Influences mapeadas
  - threading: Single-threaded vs multi-threaded assessment
  - feedback: Análise por buying influence
---

# Miller Heiman Evaluate

## Processo de Avaliação

1. **Identificar Buying Influences** mencionadas na interação
2. **Avaliar cobertura** (quantas foram engajadas?)
3. **Verificar Coach** identificado e validado
4. **Avaliar multi-threading** do deal
5. **Calcular score**

## Dimensões

| Dimensão | Peso |
|----------|------|
| Economic Buyer Mapping | 30% |
| User Buyer Engagement | 25% |
| Technical Buyer Coverage | 20% |
| Coach Identification | 25% |
