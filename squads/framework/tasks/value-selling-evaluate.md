---
task: Evaluate with Value Selling Framework
responsavel: "@value-selling"
responsavel_type: agent
atomic_layer: task
Entrada: |
  - transcript: Transcrição ou conteúdo da interação
  - input_type: meet_transcript | whatsapp_messages | call_transcript
Saida: |
  - score: 0-100
  - value_prompter: Campos preenchidos do Value Prompter
  - roi_analysis: ROI/TCO se mencionados
  - feedback: Análise por campo
---

# Value Selling Evaluate

## Processo de Avaliação

1. **Extrair cada campo** do Value Prompter da transcrição
2. **Avaliar quantificação** de valor (ROI, TCO, payback)
3. **Verificar acesso ao Power** (decisor econômico)
4. **Avaliar diferenciação**
5. **Calcular score**

## Value Prompter Fields

| Campo | Peso |
|-------|------|
| Business Issue | 15% |
| Problems | 15% |
| Solution-Problem Fit | 15% |
| Value (ROI/TCO) | 20% |
| Power Access | 10% |
| Plan | 10% |
| Differentiation | 15% |
