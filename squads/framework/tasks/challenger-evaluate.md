---
task: Evaluate with Challenger Sale
responsavel: "@challenger"
responsavel_type: agent
atomic_layer: task
Entrada: |
  - transcript: Transcrição ou conteúdo da interação
  - input_type: meet_transcript | whatsapp_messages | call_transcript
Saida: |
  - score: 0-100
  - pillar_scores: Score por pilar (Teach/Tailor/Take Control)
  - seller_profile: Challenger | Relationship Builder | Hard Worker | etc.
  - insights_shared: Lista de insights trazidos pelo vendedor
  - feedback: Análise dos 3 pilares
---

# Challenger Evaluate

## Processo de Avaliação

1. **Identificar insights** que o vendedor trouxe (dados, pesquisas, reframes)
2. **Avaliar tailoring** — mensagem adaptada ao stakeholder?
3. **Avaliar controle** — quem conduziu a conversa?
4. **Classificar perfil** do vendedor nos 5 arquétipos
5. **Avaliar o Challenger Arc:** Warmer → Reframe → Rational Drowning → Emotional Impact → New Way → Solution

## Dimensões

| Dimensão | Peso |
|----------|------|
| Commercial Teaching Quality | 35% |
| Message Tailoring | 30% |
| Taking Control | 25% |
| Challenger Arc Flow | 10% |
