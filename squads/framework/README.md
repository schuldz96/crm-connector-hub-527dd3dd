# Squad Framework — Sales Methodology Experts

Squad de especialistas em metodologias de vendas para avaliação de reuniões (Google Meet), mensagens (WhatsApp) e ligações do time comercial.

## Visão Geral

O squad **framework** contém 12 agentes especializados, cada um expert em uma metodologia de vendas específica. Juntos, avaliam interações comerciais sob múltiplas perspectivas e geram feedback acionável para o time de vendas.

## Agentes

### Orquestrador
| Agente | Icon | Metodologia | Função |
|--------|------|-------------|--------|
| `@coach` | 🎯 | Multi-methodology | Orquestra avaliação, consolida relatório |

### Tier 1 — Core
| Agente | Icon | Metodologia | Foco Principal |
|--------|------|-------------|----------------|
| `@sandler` | 🔱 | Sandler Selling System | Pain Discovery, Upfront Contracts, 7 compartimentos |
| `@spin` | 🌀 | SPIN Selling | Qualidade de perguntas S-P-I-N |
| `@meddic` | 📊 | MEDDIC/MEDDPICC | Qualificação rigorosa de deals |
| `@challenger` | ⚡ | Challenger Sale | Teaching, Tailoring, Taking Control |
| `@gap` | 🔍 | Gap Selling | Current State → Future State → Gap |

### Tier 2 — Complementares
| Agente | Icon | Metodologia | Foco Principal |
|--------|------|-------------|----------------|
| `@value-selling` | 💎 | Value Selling Framework | ROI, business case, Value Prompter |
| `@command` | 🎤 | Command of the Message | Before/After, Proof Points |
| `@miller-heiman` | 🗺️ | Miller Heiman Strategic Selling | Stakeholder mapping, 4 Buying Influences |

### Tier 3 — Cobertura Completa
| Agente | Icon | Metodologia | Foco Principal |
|--------|------|-------------|----------------|
| `@bant` | ✅ | BANT | Qualificação rápida B-A-N-T |
| `@neat` | 🎯 | NEAT Selling | Evolução moderna do BANT |
| `@snap` | ⚡ | SNAP Selling | Buyer psychology, simplicidade |

## Uso Rápido

```bash
# Avaliação automática (seleciona metodologias por tipo de input)
@coach *evaluate

# Avaliação com TODAS as 11 metodologias
@coach *evaluate-all

# Avaliação com metodologia específica
@sandler *evaluate
@spin *evaluate
@meddic *evaluate
```

## Tipos de Input Suportados

| Tipo | Descrição | Metodologias Recomendadas |
|------|-----------|--------------------------|
| `meet_transcript` | Transcrição Google Meet | Sandler, SPIN, Challenger, MEDDIC, Gap, Command |
| `whatsapp_messages` | Conversas WhatsApp | Sandler, Gap, NEAT, BANT, SNAP |
| `call_transcript` | Transcrição de ligação | Sandler, SPIN, Challenger, BANT, NEAT |

## Scoring

- **Escala:** 0-100 por metodologia
- **Red Flags:** -10 pontos (penalidades por erros críticos)
- **Green Flags:** +5 pontos (bônus por boas práticas, max +15)
- **Score Geral:** Média ponderada das metodologias aplicadas

## Classificações

| Faixa | Nível |
|-------|-------|
| 90-100 | Master |
| 75-89 | Proficient |
| 60-74 | Developing |
| 40-59 | Beginner |
| 0-39 | Non-adherent |
