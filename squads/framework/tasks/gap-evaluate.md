---
task: Evaluate with Gap Selling
responsavel: "@gap"
responsavel_type: agent
atomic_layer: task
Entrada: |
  - transcript: Transcrição ou conteúdo da interação
  - input_type: meet_transcript | whatsapp_messages | call_transcript
Saida: |
  - score: 0-100
  - gap_map: Current State → Future State → Gap
  - root_causes: Causas raízes identificadas
  - gap_size: small | medium | large | massive
  - feedback: Análise dos 3 componentes
---

# Gap Evaluate

## Processo de Avaliação

1. **Mapear Current State:** problemas, causas raízes, impactos (técnico, financeiro, pessoal)
2. **Mapear Future State:** cenário desejado, métricas de sucesso
3. **Quantificar o Gap:** distância entre os dois estados
4. **Avaliar Root Cause Analysis:** vendedor foi além dos sintomas?
5. **Calcular score**

## Dimensões

| Dimensão | Peso |
|----------|------|
| Current State Depth | 35% |
| Future State Clarity | 25% |
| Gap Quantification | 30% |
| Root Cause Analysis | 10% |

## Gap Map Visual

```
CURRENT STATE                    FUTURE STATE
─────────────                    ────────────
❌ CRM manual, dados dispersos   ✅ Pipeline automatizado
❌ 40% leads sem follow-up       ✅ 100% leads contactados em 24h
❌ Forecast impreciso (±40%)     ✅ Forecast com ±10% precisão

         ← GAP: R$200K/mês em receita perdida →
```
