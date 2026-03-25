---
task: Evaluate with SPIN Selling
responsavel: "@spin"
responsavel_type: agent
atomic_layer: task
Entrada: |
  - transcript: Transcrição ou conteúdo da interação
  - input_type: meet_transcript | whatsapp_messages | call_transcript
Saida: |
  - score: 0-100
  - question_map: Mapeamento de cada pergunta em S-P-I-N
  - distribution: Proporção percentual S/P/I/N
  - feedback: Análise da qualidade de perguntas
---

# SPIN Evaluate

## Processo de Avaliação

1. **Identificar TODAS as perguntas** feitas pelo vendedor
2. **Classificar cada pergunta** em S, P, I ou N
3. **Calcular distribuição** percentual
4. **Avaliar qualidade** de cada categoria (não apenas quantidade)
5. **Comparar com ideal:** S=10-15%, P=20-25%, I=30-35%, N=25-30%
6. **Aplicar flags** e calcular score

## Dimensões

| Dimensão | Peso | Ideal |
|----------|------|-------|
| Question Distribution (balance S-P-I-N) | 25% | S<20%, I+N>55% |
| Implication Depth | 25% | Consequências em cadeia |
| Need-Payoff Execution | 20% | Prospect verbaliza benefícios |
| Problem Identification | 15% | Problemas específicos |
| Situation Efficiency | 5% | Menos = melhor |
| Overall Flow | 10% | Progressão natural S→P→I→N |

## Output: Question Map

```
[S] "Quantos vendedores tem no time?" — Situation
[P] "Qual a maior dificuldade no onboarding?" — Problem
[I] "Quanto isso custa por mês em ramp-up?" — Implication ✅
[N] "Se resolvesse isso, qual seria o impacto?" — Need-Payoff ✅
```
