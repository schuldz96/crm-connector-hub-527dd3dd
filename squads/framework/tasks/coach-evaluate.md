---
task: Evaluate Sales Interaction (Multi-Methodology)
responsavel: "@coach"
responsavel_type: agent
atomic_layer: task
elicit: true
Entrada: |
  - transcript: Transcrição ou conteúdo da interação (obrigatório)
  - input_type: meet_transcript | whatsapp_messages | call_transcript (obrigatório)
  - seller_name: Nome do vendedor (opcional)
  - methodologies: Lista de metodologias a aplicar (opcional, default: auto-select)
Saida: |
  - consolidated_report: Relatório com scores por metodologia
  - overall_score: Score geral 0-100
  - best_fit: Metodologia mais adequada ao contexto
  - action_items: Lista de ações para o vendedor
---

# *evaluate — Avaliação Multi-Metodologia

Recebe uma transcrição de interação comercial e orquestra a avaliação por múltiplas
metodologias de vendas, gerando um relatório consolidado.

## Uso

```
@coach *evaluate
# → Modo interativo: pede transcrição e tipo

@coach *evaluate-all
# → Avalia com TODAS as 11 metodologias
```

## Flow

```
1. Receber transcrição
   ├── Classificar tipo: meet | whatsapp | call
   └── Identificar seller_name (se possível)

2. Selecionar metodologias (auto ou manual)
   ├── meet_transcript → sandler, spin, challenger, meddic, gap, command
   ├── whatsapp_messages → sandler, gap, neat, bant, snap
   └── call_transcript → sandler, spin, challenger, bant, neat

3. Executar avaliação por cada metodologia
   ├── Aplicar scoring de cada agente
   ├── Identificar red flags e green flags
   └── Calcular score por metodologia

4. Consolidar relatório
   ├── Score geral (média ponderada)
   ├── Score por metodologia
   ├── Ranking de metodologias
   ├── Strengths (pontos fortes comuns)
   ├── Improvements (áreas de melhoria comuns)
   ├── Red flags consolidados
   ├── Green flags consolidados
   └── Action items priorizados

5. Recomendar metodologia ideal
   └── Baseado no tipo de venda, estágio e perfil do vendedor
```

## Output Format

```markdown
# 📊 Sales Interaction Evaluation Report

**Vendedor:** {seller_name}
**Tipo:** {input_type}
**Data:** {date}

---

## Score Geral: {overall_score}/100 — {classification}

### Scores por Metodologia

| Metodologia | Score | Classificação | Fit |
|-------------|-------|---------------|-----|
| Sandler     | 72    | Developing    | ⭐⭐⭐ |
| SPIN        | 68    | Developing    | ⭐⭐⭐ |
| Challenger  | 45    | Beginner      | ⭐⭐  |
| ...         | ...   | ...           | ... |

### ✅ Pontos Fortes
- {strength_1}
- {strength_2}

### ⚠️ Áreas de Melhoria
- {improvement_1}: {suggestion}
- {improvement_2}: {suggestion}

### 🚨 Red Flags
- {red_flag_1} (-10 pts)

### 🌟 Green Flags
- {green_flag_1} (+5 pts)

### 📋 Action Items (priorizado)
1. {action_1} — Impacto: ALTO
2. {action_2} — Impacto: ALTO
3. {action_3} — Impacto: MÉDIO

### 💡 Recomendação de Metodologia
A metodologia mais adequada para este tipo de interação é **{methodology}** porque {reason}.

---
Coach — Elevando a performance do seu time 🎯
```
