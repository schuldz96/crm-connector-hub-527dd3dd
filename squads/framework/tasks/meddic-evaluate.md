---
task: Evaluate with MEDDIC/MEDDPICC
responsavel: "@meddic"
responsavel_type: agent
atomic_layer: task
Entrada: |
  - transcript: Transcrição ou conteúdo da interação
  - input_type: meet_transcript | whatsapp_messages | call_transcript
Saida: |
  - score: 0-100
  - scorecard: Status de cada letra (mapped/partial/unknown)
  - qualification_level: Fully | Partially | Under | Unqualified
  - gaps: Letras não cobertas
  - feedback: Análise por letra
---

# MEDDIC Evaluate

## Processo de Avaliação

1. **Para cada letra** do MEDDPICC, verificar se foi coberta na interação
2. **Status por letra:** Mapped (confirmado) | Partial (mencionado) | Unknown (não coberto)
3. **Contar letras cobertas** e determinar nível de qualificação
4. **Aplicar flags** e calcular score

## Scorecard Visual

```
M ██████████ Metrics         → Mapped ✅ (ROI de 3x confirmado)
E ██████░░░░ Economic Buyer  → Partial ⚠️ (identificado mas sem acesso)
D ██████████ Decision Crit.  → Mapped ✅
D ████░░░░░░ Decision Proc.  → Partial ⚠️ (timeline vaga)
I ██████████ Identify Pain   → Mapped ✅
C ░░░░░░░░░░ Champion        → Unknown ❌
P ░░░░░░░░░░ Paper Process   → Unknown ❌
C ██████░░░░ Competition     → Partial ⚠️

Qualification: Partially Qualified (4/8)
Action: Preencher Champion e Paper Process
```
