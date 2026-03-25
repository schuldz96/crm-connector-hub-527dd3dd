/**
 * Presets de metodologias de vendas para avaliação de interações comerciais.
 * Cada preset define critérios + prompt do sistema prontos para uso.
 * Baseado no squad "framework" de especialistas em sales methodology.
 */
import type { EvalCriteria } from '@/pages/AIConfigPage';

export interface MethodologyPreset {
  id: string;
  name: string;
  icon: string;
  creator: string;
  tier: 'core' | 'complementary' | 'optional';
  description: string;
  bestFor: string[];
  inputTypes: ('meetings' | 'whatsapp' | 'calls')[];
  systemPrompt: string;
  criteria: EvalCriteria[];
}

// ─── Sandler Selling System ──────────────────────────────────────────────────
const sandler: MethodologyPreset = {
  id: 'sandler',
  name: 'Sandler Selling System',
  icon: '🔱',
  creator: 'David Sandler',
  tier: 'core',
  description: 'Metodologia dos 7 compartimentos do Submarine. Foca em Pain Discovery profundo, Upfront Contracts e Equal Business Stature.',
  bestFor: ['Vendas consultivas B2B', 'Ciclos médios a longos', 'Discovery profundo'],
  inputTypes: ['meetings', 'whatsapp', 'calls'],
  systemPrompt: `Você é um avaliador especialista certificado no Sandler Selling System. Analise a interação de vendas usando os 7 compartimentos do Sandler Submarine como framework:

1. Bonding & Rapport — conexão genuína, Equal Business Stature
2. Upfront Contract — acordo mútuo (propósito, tempo, agenda, resultado)
3. Pain Discovery — 3 níveis de dor (Surface → Business Impact → Personal), Pain Funnel
4. Budget — qualificação financeira ANTES da apresentação
5. Decision — mapeamento do processo e stakeholders de decisão
6. Fulfillment — apresentação cirúrgica conectada às dores
7. Post-Sell — prevenção de buyer's remorse, próximos passos

Avalie também o uso de técnicas Sandler: Reversing, Negative Reverse Selling, Transactional Analysis.

PENALIDADES (Red Flags): -10pts cada para apresentação antes do Pain Discovery, ausência de Upfront Contract, Budget não discutido antes da proposta, "vou pensar" aceito sem questionar.
BÔNUS (Green Flags): +5pts cada (max +15) para Pain Funnel completo até nível pessoal, Negative Reverse bem executado, prospect criando urgência espontaneamente.

Seja específico, construtivo e referencie técnicas Sandler nos feedbacks.`,
  criteria: [
    {
      id: 'sandler_rapport', label: 'Bonding & Rapport', weight: 10,
      description: 'Conexão genuína, escuta ativa e postura de Equal Business Stature (igual para igual)',
      examples: ['Espelhamento de tom', 'Validação do prospect', 'Ausência de subserviência'],
      positiveSignals: ['Prospect compartilha informações voluntariamente', 'Tom descontraído e de igualdade', 'Vendedor não é subserviente'],
      negativeSignals: ['Vendedor agressivo ou subserviente', 'Adaptive Child behavior (ceder a tudo)', 'Small talk superficial sem conexão'],
    },
    {
      id: 'sandler_upfront_contract', label: 'Upfront Contract', weight: 10,
      description: 'Acordo mútuo no início com propósito, tempo, agenda e resultado esperado (incluindo opção de "não")',
      examples: ['Definir propósito da reunião', 'Acordar tempo disponível', 'Estabelecer que "não" é resposta válida'],
      positiveSignals: ['4 componentes presentes', 'Prospect concordou explicitamente', 'Opção de "não" oferecida'],
      negativeSignals: ['Reunião sem agenda clara', 'Sem acordo sobre resultado', 'Prospect não concordou com o contrato'],
    },
    {
      id: 'sandler_pain', label: 'Pain Discovery', weight: 25,
      description: 'Identificação de dor em 3 níveis: Surface Pain → Business Impact → Personal Pain. Uso do Pain Funnel para aprofundar.',
      examples: ['Pain Funnel completo', 'Quantificação da dor em R$', 'Alcançar dor pessoal/emocional'],
      positiveSignals: ['3 níveis de dor explorados', 'Dor quantificada financeiramente', 'Prospect verbaliza dor espontaneamente', 'Múltiplas dores identificadas'],
      negativeSignals: ['Apenas dor superficial/técnica', 'Sem quantificação de impacto', 'Vendedor assume dor sem confirmar', 'Pula para solução sem aprofundar'],
    },
    {
      id: 'sandler_budget', label: 'Budget Qualification', weight: 10,
      description: 'Qualificação financeira usando técnicas indiretas ANTES de apresentar solução. Thermometer Technique.',
      examples: ['Perguntar se recursos foram reservados', 'Contextualizar investimento vs custo da dor', 'Thermometer Technique'],
      positiveSignals: ['Budget discutido antes da apresentação', 'Investimento contextualizado contra dor', 'Técnica indireta usada'],
      negativeSignals: ['Budget nunca mencionado', 'Pergunta direta "qual seu orçamento?"', 'Preço revelado sem qualificação'],
    },
    {
      id: 'sandler_decision', label: 'Decision Process', weight: 10,
      description: 'Mapeamento completo do processo de decisão: stakeholders, processo, timeline, blockers.',
      examples: ['Identificar todos os decisores', 'Mapear processo de aprovação', 'Definir timeline'],
      positiveSignals: ['Decision-makers identificados', 'Processo mapeado com etapas', 'Timeline definida com datas'],
      negativeSignals: ['Não sabe quem decide', 'Processo de decisão desconhecido', 'Sem timeline'],
    },
    {
      id: 'sandler_fulfillment', label: 'Fulfillment (Apresentação)', weight: 10,
      description: 'Apresentação cirúrgica conectando cada feature a uma dor específica já levantada. Sem feature dump.',
      examples: ['Conectar feature a dor', 'Validar durante apresentação', 'Apresentar apenas o relevante'],
      positiveSignals: ['Cada feature ligada a uma dor', 'Validação contínua', 'Prospect confirma que resolve'],
      negativeSignals: ['Feature dump', 'Demo genérica desconectada das dores', 'Sem validação do prospect'],
    },
    {
      id: 'sandler_techniques', label: 'Técnicas Sandler', weight: 15,
      description: 'Uso de Reversing, Negative Reverse Selling, Pain Funnel e Transactional Analysis adequada.',
      examples: ['Responder pergunta com pergunta (Reversing)', 'Negative Reverse Selling', 'Operar no estado Adult (TA)'],
      positiveSignals: ['Reversing bem executado', 'Negative Reverse provocou reação positiva', 'Postura Adult consistente'],
      negativeSignals: ['Responde perguntas técnicas sem Reversing', 'Cede a toda pressão (Adaptive Child)', 'Perseguição excessiva (chasing)'],
    },
    {
      id: 'sandler_postsell', label: 'Post-Sell & Processo', weight: 10,
      description: 'Prevenção de buyer\'s remorse, próximos passos concretos e disciplina de sequência do Submarine.',
      examples: ['Antecipar objeções futuras', 'Estabelecer próximos passos com datas', 'Respeitar sequência dos compartimentos'],
      positiveSignals: ['Objeções futuras antecipadas', 'Próximos passos concretos com datas', 'Sequência do Submarine respeitada'],
      negativeSignals: ['Sem próximos passos', '"Vou pensar" aceito sem questionar', 'Compartimentos pulados'],
    },
  ],
};

// ─── SPIN Selling ────────────────────────────────────────────────────────────
const spin: MethodologyPreset = {
  id: 'spin',
  name: 'SPIN Selling',
  icon: '🌀',
  creator: 'Neil Rackham',
  tier: 'core',
  description: 'Baseado em 35.000+ chamadas de vendas. Classifica perguntas em Situation, Problem, Implication e Need-Payoff.',
  bestFor: ['Vendas consultivas enterprise', 'Discovery estruturado', 'Treinamento de perguntas'],
  inputTypes: ['meetings', 'calls'],
  systemPrompt: `Você é um avaliador especialista em SPIN Selling (Neil Rackham). Classifique CADA pergunta do vendedor nas 4 categorias:

S (Situation) — contexto atual (ideal: 10-15% das perguntas)
P (Problem) — dificuldades e insatisfações (ideal: 20-25%)
I (Implication) — consequências dos problemas (ideal: 30-35%, MAIS IMPORTANTE)
N (Need-Payoff) — prospect verbaliza benefícios da solução (ideal: 25-30%)

REGRA CHAVE: Excesso de perguntas Situation indica falta de preparação. Perguntas de Implication são as mais importantes e as mais negligenciadas.

PENALIDADES: -10pts para >40% Situation, zero Implication, vendedor apresentando benefícios sem Need-Payoff.
BÔNUS: +5pts para cadeia de implicações (A causa B causa C), prospect verbalizando valor espontaneamente, I+N > 55%.

No feedback, cite as perguntas específicas classificadas como exemplo.`,
  criteria: [
    {
      id: 'spin_situation', label: 'Situation Questions', weight: 10,
      description: 'Perguntas de contexto — devem ser parcimoniosas (máx 15%). Excesso indica falta de preparação.',
      examples: ['Quantos vendedores tem?', 'Qual CRM usam?', 'Como funciona o processo?'],
      positiveSignals: ['Poucas perguntas de Situation', 'Informações públicas pesquisadas antes', 'Rápida transição para Problem'],
      negativeSignals: ['Mais de 40% das perguntas são Situation', 'Pergunta info disponível no site/LinkedIn', 'Excesso de perguntas básicas'],
    },
    {
      id: 'spin_problem', label: 'Problem Questions', weight: 20,
      description: 'Perguntas que identificam dificuldades e insatisfações concretas do prospect.',
      examples: ['Qual maior dificuldade?', 'O que te frustra no processo?', 'Onde vê mais ineficiência?'],
      positiveSignals: ['Problemas concretos identificados', 'Múltiplos problemas explorados', 'Perguntas específicas ao contexto'],
      negativeSignals: ['Perguntas genéricas', 'Apenas 1 problema superficial', 'Saltar de Situation para apresentação'],
    },
    {
      id: 'spin_implication', label: 'Implication Questions', weight: 30,
      description: 'Exploram consequências dos problemas — CATEGORIA MAIS IMPORTANTE. Criam urgência e quantificam impacto.',
      examples: ['Qual impacto no resultado mensal?', 'Como afeta produtividade do time?', 'Se continuar, o que acontece?'],
      positiveSignals: ['Consequências exploradas em cadeia', 'Impacto financeiro quantificado', 'Efeito cascata mapeado', 'Prospect demonstra preocupação'],
      negativeSignals: ['Zero perguntas de Implication', 'Consequências óbvias apenas', 'Sem quantificação de impacto'],
    },
    {
      id: 'spin_needpayoff', label: 'Need-Payoff Questions', weight: 25,
      description: 'Prospect verbaliza os benefícios da solução (não o vendedor). Fecha o ciclo SPIN.',
      examples: ['Se resolvesse isso, qual impacto?', 'Quanto economizaria por semana?', 'Como seria o cenário ideal?'],
      positiveSignals: ['Prospect verbaliza benefícios', 'Benefícios conectados aos problemas', 'Entusiasmo com cenário futuro'],
      negativeSignals: ['Vendedor apresenta benefícios em vez de perguntar', 'Sem Need-Payoff', 'Benefícios genéricos'],
    },
    {
      id: 'spin_flow', label: 'Fluxo e Equilíbrio S-P-I-N', weight: 15,
      description: 'Progressão natural de S→P→I→N e proporção adequada entre as categorias.',
      examples: ['Transição suave entre categorias', 'Proporção I+N > 55%', 'Não forçar sequência'],
      positiveSignals: ['Progressão natural S→P→I→N', 'Proporção I+N > 55%', 'Retorno a categoria anterior quando necessário'],
      negativeSignals: ['Sequência aleatória', 'Apenas S+P sem I+N', 'Forçar perguntas sem contexto'],
    },
  ],
};

// ─── MEDDIC / MEDDPICC ──────────────────────────────────────────────────────
const meddic: MethodologyPreset = {
  id: 'meddic',
  name: 'MEDDIC / MEDDPICC',
  icon: '📊',
  creator: 'Jack Napoli & Dick Dunkel (PTC)',
  tier: 'core',
  description: 'Framework de qualificação rigorosa. Cada letra = critério binário. Reduz forecast error e disciplina pipeline.',
  bestFor: ['Enterprise sales (ACV >$50K)', 'Pipeline management', 'Forecast accuracy'],
  inputTypes: ['meetings', 'calls'],
  systemPrompt: `Você é um avaliador especialista em MEDDIC/MEDDPICC. Para CADA letra do acrônimo, determine se foi coberta na interação:

M — Metrics: métricas de sucesso quantificáveis definidas pelo prospect
E — Economic Buyer: identificado por nome, com acesso confirmado
D — Decision Criteria: critérios de avaliação mapeados
D — Decision Process: processo formal de aprovação com timeline
I — Identify Pain: dor confirmada pelo prospect com impacto claro
C — Champion: aliado interno testado (deu info privilegiada ou agendou reunião)
P — Paper Process: processo burocrático/legal mapeado (MEDDPICC)
C — Competition: concorrentes no deal identificados com diferenciadores (MEDDPICC)

Status por letra: ✅ Mapped (confirmado) | ⚠️ Partial (mencionado) | ❌ Unknown (não coberto)

Qualificação: 7-8 letras = Fully Qualified, 5-6 = Partially, 3-4 = Under-Qualified, 0-2 = Unqualified.

PENALIDADES: -10pts para Economic Buyer não identificado em deal avançado, zero Champion, Métricas vagas.
BÔNUS: +5pts para Champion testado com ação, Economic Buyer engajado diretamente, Métricas com números do prospect.`,
  criteria: [
    {
      id: 'meddic_metrics', label: 'Metrics (M)', weight: 15,
      description: 'Métricas de sucesso quantificáveis definidas pelo prospect — não apenas "melhorar" mas números específicos.',
      examples: ['Reduzir churn de 5% para 2%', 'Aumentar pipeline velocity em 30%', 'Economizar 20h/semana'],
      positiveSignals: ['Prospect definiu métricas específicas', 'ROI quantificado', 'Números concretos mencionados'],
      negativeSignals: ['Métricas vagas ("melhorar", "otimizar")', 'Vendedor inventou números', 'Sem métricas discutidas'],
    },
    {
      id: 'meddic_economic_buyer', label: 'Economic Buyer (E)', weight: 15,
      description: 'Quem assina o cheque — identificado por nome/cargo, com acesso direto ou via Champion.',
      examples: ['Identificar CFO/VP como aprovador', 'Confirmar acesso ao decisor', 'Mapear critérios do EB'],
      positiveSignals: ['EB identificado por nome', 'Vendedor tem acesso direto', 'Critérios do EB conhecidos'],
      negativeSignals: ['Não sabe quem aprova', 'EB identificado mas sem acesso', 'Confundir influenciador com EB'],
    },
    {
      id: 'meddic_decision', label: 'Decision Criteria & Process (DD)', weight: 15,
      description: 'Critérios de avaliação mapeados + processo formal de aprovação com timeline e stakeholders.',
      examples: ['Critérios técnicos vs negócio', 'Etapas de aprovação', 'Timeline com datas'],
      positiveSignals: ['Critérios mapeados e favoráveis', 'Processo com etapas claras', 'Timeline definida'],
      negativeSignals: ['Critérios desconhecidos', 'Processo vago', 'Sem timeline'],
    },
    {
      id: 'meddic_pain', label: 'Identify Pain (I)', weight: 15,
      description: 'Dor articulada pelo PROSPECT (não assumida) com impacto no negócio quantificável.',
      examples: ['Prospect descreve dor com detalhes', 'Impacto financeiro confirmado', 'Urgência associada'],
      positiveSignals: ['Dor confirmada pelo prospect', 'Impacto quantificado', 'Urgência clara'],
      negativeSignals: ['Vendedor assume dor', 'Dor genérica sem impacto', 'Prospect não confirma necessidade'],
    },
    {
      id: 'meddic_champion', label: 'Champion (C)', weight: 15,
      description: 'Aliado interno com influência que vende por você. Deve ser testado (agendou reunião, deu info privilegiada).',
      examples: ['Champion agendou reunião com EB', 'Compartilhou organograma', 'Defende solução internamente'],
      positiveSignals: ['Champion testado com ação concreta', 'Tem acesso ao EB', 'Interesse pessoal no sucesso'],
      negativeSignals: ['Nenhum Champion identificado', 'Champion sem influência', '"Amigável" mas sem ação'],
    },
    {
      id: 'meddic_paper_competition', label: 'Paper Process & Competition (PC)', weight: 10,
      description: 'Processo burocrático/legal mapeado + concorrentes identificados com diferenciadores claros.',
      examples: ['Procurement mapeado', 'Concorrentes nomeados', 'Diferenciadores articulados'],
      positiveSignals: ['Processo legal com timeline', 'Concorrentes e diferenciadores mapeados', 'Estratégia competitiva definida'],
      negativeSignals: ['Processo burocrático ignorado', 'Não sabe se há concorrentes', 'Sem diferenciação'],
    },
    {
      id: 'meddic_overall', label: 'Cobertura Geral MEDDPICC', weight: 15,
      description: 'Quantas letras foram cobertas no total e qualidade geral da qualificação.',
      examples: ['7-8 letras = Fully Qualified', '5-6 = Partially', '3-4 = Under-Qualified'],
      positiveSignals: ['6+ letras cobertas', 'Gaps identificados com plano', 'Qualificação disciplinada'],
      negativeSignals: ['Menos de 4 letras cobertas', 'Avança sem qualificar', 'Gaps críticos ignorados'],
    },
  ],
};

// ─── Challenger Sale ─────────────────────────────────────────────────────────
const challenger: MethodologyPreset = {
  id: 'challenger',
  name: 'The Challenger Sale',
  icon: '⚡',
  creator: 'Matthew Dixon & Brent Adamson',
  tier: 'core',
  description: 'Baseado em 6.000+ vendedores. Os melhores ensinam, adaptam e tomam controle. Provoque com insights.',
  bestFor: ['Vendas complexas B2B', 'Prospects sofisticados', 'Diferenciação por insight'],
  inputTypes: ['meetings', 'calls'],
  systemPrompt: `Você é um avaliador especialista em The Challenger Sale (Dixon & Adamson). Avalie os 3 pilares:

1. TEACH (Commercial Teaching) — 35%: O vendedor trouxe insights/dados que o prospect NÃO tinha? Desafiou alguma suposição? Reframou o problema?

2. TAILOR (Customize the Message) — 30%: A mensagem foi adaptada ao cargo/setor do prospect? Linguagem reflete os KPIs específicos? Exemplos relevantes ao contexto?

3. TAKE CONTROL — 25%: Quem conduziu a conversa? Houve pushback profissional? Próximos passos definidos pelo vendedor?

Identifique o PERFIL do vendedor: Challenger (ensina+adapta+controla), Relationship Builder (evita confronto), Hard Worker (volume sem estratégia), Lone Wolf (instintivo), Problem Solver (muito técnico).

Avalie também o Challenger Arc: Warmer → Reframe → Rational Drowning → Emotional Impact → New Way → Solution.

PENALIDADES: -10pts para zero insights, ceder preço sem pushback, mensagem genérica, passividade total.
BÔNUS: +5pts para "nunca pensei nisso", mudança de perspectiva visível, pushback educado e respeitado.`,
  criteria: [
    {
      id: 'challenger_teach', label: 'Commercial Teaching', weight: 35,
      description: 'Vendedor trouxe insight/dado que o prospect não tinha. Desafiou suposições. Reframou o problema.',
      examples: ['Pesquisa do setor que contradiz crença', 'Custo oculto revelado', 'Benchmark compartilhado'],
      positiveSignals: ['Insight genuíno compartilhado', 'Prospect disse "nunca pensei nisso"', 'Dados/pesquisas para sustentar', 'Reframe do problema'],
      negativeSignals: ['Zero insights novos', 'Informação genérica de site', 'Sem dados para sustentar', 'Repetiu o que prospect já sabe'],
    },
    {
      id: 'challenger_tailor', label: 'Message Tailoring', weight: 30,
      description: 'Mensagem adaptada ao cargo, setor e KPIs do stakeholder. Diferentes stakeholders = diferentes mensagens.',
      examples: ['CFO: ROI e payback', 'VP Sales: produtividade', 'CTO: integração e escala'],
      positiveSignals: ['Linguagem do setor do prospect', 'KPIs específicos do cargo', 'Exemplos do mesmo segmento', 'Conhecimento prévio demonstrado'],
      negativeSignals: ['Mensagem genérica', 'Pitch igual para todos', 'Sem pesquisa sobre o prospect', 'Exemplos irrelevantes'],
    },
    {
      id: 'challenger_control', label: 'Taking Control', weight: 25,
      description: 'Vendedor conduz a conversa com assertividade construtiva. Pushback profissional quando necessário.',
      examples: ['Manter agenda e ritmo', 'Pushback educado em preço', 'Próximos passos definidos'],
      positiveSignals: ['Vendedor conduziu a conversa', 'Pushback profissional aceito', 'Negociação com firmeza', 'Próximos passos pelo vendedor'],
      negativeSignals: ['Prospect controlou toda conversa', 'Desconto imediato sem resistência', 'Vendedor passivo', 'Agenda ignorada'],
    },
    {
      id: 'challenger_arc', label: 'Challenger Arc & Perfil', weight: 10,
      description: 'Fluxo Warmer → Reframe → Rational Drowning → Emotional Impact → New Way → Solution.',
      examples: ['Arc completo com transições naturais', 'Perfil Challenger identificado', 'Provocação intelectual'],
      positiveSignals: ['Arc com transições naturais', 'Perfil Challenger claro', 'Prospect reconsiderou abordagem'],
      negativeSignals: ['Perfil Relationship Builder', 'Sem provocação', 'Arc inexistente'],
    },
  ],
};

// ─── Gap Selling ─────────────────────────────────────────────────────────────
const gap: MethodologyPreset = {
  id: 'gap',
  name: 'Gap Selling',
  icon: '🔍',
  creator: 'Keenan (Jim Keenan)',
  tier: 'core',
  description: 'Toda venda é sobre o GAP entre estado atual e futuro desejado. Quanto maior o gap, maior a urgência.',
  bestFor: ['Vendas consultivas', 'Combate ao status quo', 'Quantificação de impacto'],
  inputTypes: ['meetings', 'whatsapp', 'calls'],
  systemPrompt: `Você é um avaliador especialista em Gap Selling (Keenan). Avalie os 3 componentes fundamentais:

1. CURRENT STATE (35%) — O vendedor mapeou: problemas atuais, causas raízes (não apenas sintomas), impacto técnico, financeiro E pessoal/emocional? Entende o problema melhor que o próprio prospect?

2. FUTURE STATE (25%) — O cenário desejado foi definido PELO PROSPECT com métricas específicas? Está conectado aos problemas do current state?

3. THE GAP (30%) — A distância entre os dois estados foi quantificada? O custo da inação foi calculado? O prospect percebe o gap como significativo?

Avalie também ROOT CAUSE ANALYSIS (10%): O vendedor diferenciou sintomas de causas raízes? Fez perguntas "por que" em múltiplas camadas?

PENALIDADES: -10pts para apresentar solução sem mapear current state, apenas sintomas sem root cause, future state vago ("melhorar"), gap não quantificado.
BÔNUS: +5pts para "não sabia que era tão grave", gap quantificado com números do prospect, custo da inação aceito.`,
  criteria: [
    {
      id: 'gap_current', label: 'Current State', weight: 35,
      description: 'Mapeamento de problemas, causas raízes e impactos (técnico, financeiro, pessoal/emocional).',
      examples: ['Problemas com detalhes', 'Root cause vs sintoma', 'Impacto em 3 dimensões'],
      positiveSignals: ['Causas raízes identificadas', 'Impacto financeiro quantificado', 'Impacto pessoal explorado', 'Vendedor entende melhor que prospect'],
      negativeSignals: ['Apenas sintomas superficiais', 'Sem quantificação', 'Uma dimensão apenas', 'Vendedor assume sem confirmar'],
    },
    {
      id: 'gap_future', label: 'Future State', weight: 25,
      description: 'Cenário futuro desejado pelo prospect com resultados específicos e mensuráveis.',
      examples: ['Métricas de sucesso definidas', 'Cenário ideal articulado', 'Conectado aos problemas atuais'],
      positiveSignals: ['Prospect definiu cenário ideal', 'Resultados específicos e mensuráveis', 'Desejo genuíno pela mudança'],
      negativeSignals: ['Future state vago ("melhorar")', 'Definido pelo vendedor, não prospect', 'Desconectado do current state'],
    },
    {
      id: 'gap_the_gap', label: 'O Gap', weight: 30,
      description: 'Distância quantificada entre estados. Custo da inação calculado. Prospect percebe como significativo.',
      examples: ['Gap em R$/mês', 'Custo de não fazer nada', 'Urgência baseada no gap'],
      positiveSignals: ['Gap quantificado financeiramente', 'Custo da inação aceito', 'Prospect sente urgência', 'Números do próprio prospect'],
      negativeSignals: ['Gap não articulado', 'Sem quantificação', 'Prospect não sente urgência', 'Números inventados'],
    },
    {
      id: 'gap_rootcause', label: 'Root Cause Analysis', weight: 10,
      description: 'Vendedor diferenciou sintomas de causas raízes. Perguntas "por que" em múltiplas camadas.',
      examples: ['Por que isso acontece?', 'O que causa esse problema?', 'Múltiplas camadas exploradas'],
      positiveSignals: ['Causa raiz encontrada', 'Insight novo para o prospect', 'Múltiplas camadas'],
      negativeSignals: ['Apenas sintomas', 'Não perguntou "por que"', 'Aceitou primeira resposta'],
    },
  ],
};

// ─── SPICED (Winning by Design) ─────────────────────────────────────────────
const spiced: MethodologyPreset = {
  id: 'spiced',
  name: 'SPICED',
  icon: '🌶️',
  creator: 'Winning by Design',
  tier: 'core',
  description: 'Framework de discovery e qualificação para SaaS B2B. SPICED = Situation, Pain, Impact, Critical Event, Decision. Foco em métricas de receita recorrente.',
  bestFor: ['SaaS B2B', 'Receita recorrente', 'PLG + sales assist', 'Discovery estruturado'],
  inputTypes: ['meetings', 'whatsapp', 'calls'],
  systemPrompt: `Você é um avaliador especialista no framework SPICED (Winning by Design). Avalie a interação de vendas classificando cada elemento do acrônimo:

S (Situation) — contexto atual: ferramentas, equipe, KPIs, processos existentes
P (Pain) — problemas específicos, ineficiências, frustrações reais
I (Impact) — impacto quantificado no negócio (receita, custo, tempo, churn)
C (Critical Event) — evento gatilho que cria urgência (fim de contrato, ciclo orçamentário, mandato do board, expansão)
D (Decision) — processo de decisão mapeado: critérios, timeline, stakeholders, procurement

REGRA CHAVE: Impact é o multiplicador de urgência. Sem Impact quantificado, o deal fica em "nice to have". Critical Event transforma o deal de "vamos ver" em "precisamos agir agora".

PENALIDADES: -10pts cada para Pain não identificado, zero Impact quantificado, sem Critical Event, apresentação antes do SPICED completo.
BÔNUS: +5pts (max +15) para Impact com números do prospect, Critical Event com deadline hard, Decision process completo com procurement.

Foque em métricas de receita recorrente (ARR, NRR, churn, LTV, CAC). Seja específico e construtivo.`,
  criteria: [
    {
      id: 'spiced_situation', label: 'Situation (S)', weight: 10,
      description: 'Contexto atual mapeado: ferramentas, equipe, KPIs, processos. Deve ser breve — pré-pesquisa esperada.',
      examples: ['Qual CRM usam?', 'Quantos SDRs no time?', 'Qual ARR atual?'],
      positiveSignals: ['Informações públicas já pesquisadas', 'Perguntas específicas ao contexto', 'Rápida transição para Pain'],
      negativeSignals: ['Excesso de perguntas básicas', 'Informações disponíveis no LinkedIn não pesquisadas', 'Mais de 30% do tempo em Situation'],
    },
    {
      id: 'spiced_pain', label: 'Pain (P)', weight: 25,
      description: 'Problemas específicos identificados: ineficiências, frustrações, gaps no processo atual.',
      examples: ['Taxa de conversão caiu 15%', 'SDRs perdem 2h/dia em tarefas manuais', 'Churn de 8% ao mês'],
      positiveSignals: ['Múltiplos pains identificados', 'Pain específico e mensurável', 'Prospect confirma e detalha a dor'],
      negativeSignals: ['Pain genérico "queremos melhorar"', 'Apenas 1 pain superficial', 'Vendedor assume pain sem confirmar'],
    },
    {
      id: 'spiced_impact', label: 'Impact (I)', weight: 25,
      description: 'Impacto quantificado no negócio — ELEMENTO MAIS IMPORTANTE. Transforma pain em urgência financeira.',
      examples: ['Churn custa R$500K/ano em ARR', 'Produtividade +40% = 2 FTEs economizados', 'Pipeline velocity +30% = R$200K/quarter'],
      positiveSignals: ['Impact com números do prospect', 'Métricas de receita recorrente usadas', 'Prospect verbaliza impacto espontaneamente', 'Múltiplos impacts conectados'],
      negativeSignals: ['Zero quantificação', 'Impact genérico sem números', 'Vendedor assume impact sem validar'],
    },
    {
      id: 'spiced_critical_event', label: 'Critical Event (C)', weight: 20,
      description: 'Evento gatilho que cria deadline e urgência real. Diferencia deals de "vou pensar" de "preciso resolver até X".',
      examples: ['Contrato atual vence em março', 'Board exige redução de churn Q2', 'Expansão para novo mercado em junho'],
      positiveSignals: ['Critical Event com data específica', 'Urgência confirmada pelo prospect', 'Evento externo não negociável'],
      negativeSignals: ['Sem Critical Event identificado', 'Urgência artificial criada pelo vendedor', '"Não temos pressa" aceito sem explorar'],
    },
    {
      id: 'spiced_decision', label: 'Decision (D)', weight: 10,
      description: 'Processo de decisão mapeado: quem decide, critérios, timeline, procurement, blockers.',
      examples: ['CEO decide com input do VP Sales', 'Critérios: ROI, integração, suporte', 'Procurement precisa de 30 dias'],
      positiveSignals: ['Decisores identificados por nome', 'Critérios de decisão listados', 'Timeline com datas', 'Procurement mapeado'],
      negativeSignals: ['Não sabe quem decide', 'Sem critérios de decisão', 'Sem timeline'],
    },
    {
      id: 'spiced_flow', label: 'SPICED Flow & Recurring Revenue', weight: 10,
      description: 'Progressão natural S→P→I→C→D e mindset de receita recorrente (ARR, NRR, churn, LTV).',
      examples: ['Transição suave entre elementos', 'Métricas SaaS usadas naturalmente', 'Impact conectado a Critical Event'],
      positiveSignals: ['Progressão natural S→P→I→C→D', 'Métricas de receita recorrente', 'Impact e Critical Event conectados'],
      negativeSignals: ['Sequência aleatória', 'Sem menção a métricas recorrentes', 'Elements desconectados entre si'],
    },
  ],
};

// ─── Value Selling Framework ─────────────────────────────────────────────────
const valueSelling: MethodologyPreset = {
  id: 'value-selling',
  name: 'Value Selling Framework',
  icon: '💎',
  creator: 'Julie Thomas (ValueSelling Associates)',
  tier: 'complementary',
  description: 'Foco obsessivo em quantificação de valor. O Value Prompter conecta capabilities a resultados financeiros.',
  bestFor: ['Enterprise B2B', 'Justificativa financeira', 'Business case building'],
  inputTypes: ['meetings', 'calls'],
  systemPrompt: `Você é um avaliador especialista no Value Selling Framework (Julie Thomas). Avalie usando o Value Prompter — cada campo deve ser preenchido pela conversa:

1. Business Issue — Problema de negócio (nível estratégico, não operacional)
2. Problems — Problemas operacionais causados pela business issue
3. Solution — Capabilities conectadas aos problemas (não feature dump)
4. Value — ROI, TCO, payback quantificados com números do prospect
5. Power — Acesso ao decisor econômico confirmado
6. Plan — Próximos passos com datas concretas
7. Differentiation — Por que esta solução vs alternativas

Qualified Prospect Formula: VisionMatch + ValueMatch + PowerMatch + PlanMatch.

PENALIDADES: -10pts para zero ROI, features sem conexão, EB desconhecido, valor genérico.
BÔNUS: +5pts para ROI com dados do prospect, business case validado, payback concreto.`,
  criteria: [
    {
      id: 'vs_business_issue', label: 'Business Issue & Problems', weight: 20,
      description: 'Problema de negócio estratégico identificado + problemas operacionais decorrentes.',
      examples: ['Issue no nível do C-level', 'Problemas concretos listados', 'Conexão issue→problemas clara'],
      positiveSignals: ['Issue estratégica identificada', 'Problemas operacionais mapeados', 'Conexão clara'],
      negativeSignals: ['Issue apenas operacional', 'Sem problemas concretos', 'Desconexão entre issue e problemas'],
    },
    {
      id: 'vs_value', label: 'Value Quantification (ROI/TCO)', weight: 30,
      description: 'ROI calculado, TCO abordado, payback definido — com números do prospect, não genéricos.',
      examples: ['ROI de 3x em 12 meses', 'TCO incluindo custo de treinamento', 'Payback em 4 meses'],
      positiveSignals: ['ROI com dados do prospect', 'TCO completo', 'Payback concreto', 'Business case convincente'],
      negativeSignals: ['Nenhum número calculado', 'ROI genérico', 'Sem TCO', 'Valor não quantificado'],
    },
    {
      id: 'vs_solution_fit', label: 'Solution-Problem Fit', weight: 20,
      description: 'Capabilities conectadas a problemas específicos. Diferenciadores relevantes articulados.',
      examples: ['Feature X resolve problema Y', 'Diferenciador único', 'Sem feature dump'],
      positiveSignals: ['Cada capability ligada a um problema', 'Diferenciador ressoou', 'Apresentação cirúrgica'],
      negativeSignals: ['Feature dump', 'Sem conexão com problemas', 'Diferenciadores genéricos'],
    },
    {
      id: 'vs_power_plan', label: 'Power Access & Plan', weight: 30,
      description: 'Acesso ao decisor econômico + próximos passos concretos com datas e responsáveis.',
      examples: ['EB identificado com acesso', 'Reunião de follow-up agendada', 'Responsabilidades definidas'],
      positiveSignals: ['Acesso ao EB confirmado', 'Próximos passos com datas', 'Responsabilidades claras'],
      negativeSignals: ['EB desconhecido', 'Sem próximos passos', 'Datas vagas ("semana que vem")'],
    },
  ],
};

// ─── Command of the Message ──────────────────────────────────────────────────
const command: MethodologyPreset = {
  id: 'command',
  name: 'Command of the Message',
  icon: '🎤',
  creator: 'Force Management (John Kaplan)',
  tier: 'complementary',
  description: 'Articular valor consistentemente com Before/After scenarios, Proof Points e diferenciadores.',
  bestFor: ['Enterprise SaaS', 'Equipes grandes', 'Consistência de mensagem'],
  inputTypes: ['meetings', 'calls'],
  systemPrompt: `Você é um avaliador especialista em Command of the Message (Force Management). Avalie o Value Framework:

1. Before Scenarios (20%) — Cenário atual pintado com detalhes, prospect se identifica
2. Negative Consequences (20%) — Impacto de NÃO mudar articulado, urgência construída
3. Required Capabilities (15%) — Ponte: dor → capability → resultado
4. Positive Business Outcomes (20%) — Resultados mensuráveis, específicos ao prospect
5. Differentiators (10%) — Únicos, relevantes, sem depreciar concorrente
6. Proof Points (15%) — Cases, números de clientes similares, mesmo setor

PENALIDADES: -10pts para zero proof points, capabilities genéricas, nenhum before/after, mensagem não adaptada.
BÔNUS: +5pts para before/after completo e personalizado, proof point do mesmo setor, prospect pede mais detalhes.`,
  criteria: [
    {
      id: 'cotm_before_after', label: 'Before/After Scenarios', weight: 25,
      description: 'Before: dor atual pintada com detalhes. After: resultados mensuráveis. Prospect se identifica.',
      examples: ['Before com detalhes do contexto', 'After com métricas', 'Prospect se vê no cenário'],
      positiveSignals: ['Before detalhado e personalizado', 'After com números', 'Prospect reagiu emocionalmente'],
      negativeSignals: ['Sem before/after', 'Cenários genéricos', 'Prospect não se identificou'],
    },
    {
      id: 'cotm_consequences', label: 'Negative Consequences', weight: 20,
      description: 'Impacto financeiro da inação articulado. Urgência construída pelas consequências.',
      examples: ['Custo mensal de não agir', 'Risco de perder mercado', 'Impacto na equipe'],
      positiveSignals: ['Consequências quantificadas', 'Urgência construída', 'Prospect reconhece impacto'],
      negativeSignals: ['Sem consequências articuladas', 'Urgência não construída', 'Prospect relaxado com status quo'],
    },
    {
      id: 'cotm_capabilities', label: 'Required Capabilities & Differentiators', weight: 25,
      description: 'Ponte dor→capability→resultado. Diferenciadores únicos e relevantes ao prospect.',
      examples: ['Capability X resolve dor Y gerando Z', 'Único no mercado em...', 'vs concorrente: nós fazemos X'],
      positiveSignals: ['Ponte completa dor→capability→resultado', 'Diferenciador ressoou', 'Sem depreciar concorrente'],
      negativeSignals: ['Capabilities sem contexto', 'Diferenciadores genéricos', 'Sem ponte para dor'],
    },
    {
      id: 'cotm_proof', label: 'Proof Points & Outcomes', weight: 30,
      description: 'Cases, métricas de clientes similares, evidências do mesmo setor/tamanho.',
      examples: ['Case do mesmo setor', 'Números verificáveis', 'Referência de cliente similar'],
      positiveSignals: ['Proof point do mesmo setor', 'Métricas verificáveis', 'Prospect pediu mais detalhes'],
      negativeSignals: ['Zero proof points', 'Cases irrelevantes', 'Números vagos'],
    },
  ],
};

// ─── Miller Heiman Strategic Selling ─────────────────────────────────────────
const millerHeiman: MethodologyPreset = {
  id: 'miller-heiman',
  name: 'Miller Heiman Strategic Selling',
  icon: '🗺️',
  creator: 'Robert Miller & Stephen Heiman',
  tier: 'complementary',
  description: 'Mapeamento de stakeholders com 4 Buying Influences. Blue Sheet para planejamento estratégico.',
  bestFor: ['Enterprise com múltiplos decisores', 'Deals complexos', 'Multi-threading'],
  inputTypes: ['meetings', 'calls'],
  systemPrompt: `Você é um avaliador especialista em Miller Heiman Strategic Selling. Avalie o mapeamento dos 4 Buying Influences:

1. Economic Buyer (30%) — Quem dá aprovação final. Único por deal. Identificado por nome, com acesso.
2. User Buyer (25%) — Quem usa no dia a dia. Podem ser vários. Impacto pessoal mapeado.
3. Technical Buyer (20%) — TI, procurement, legal. Podem vetar. Requisitos técnicos levantados.
4. Coach (25%) — Aliado interno que guia. Validado com ação concreta (não só "amigável").

Avalie MULTI-THREADING: quantos stakeholders foram engajados? Deal single-threaded = alto risco.

PENALIDADES: -10pts para deal single-threaded, EB desconhecido, zero Coach, Technical Buyer ignorado.
BÔNUS: +5pts para 3+ buying influences engajadas, Coach validado, estratégia diferenciada por stakeholder.`,
  criteria: [
    {
      id: 'mh_economic', label: 'Economic Buyer', weight: 30,
      description: 'Decisor final identificado por nome/cargo. Acesso direto ou via Coach. Critérios conhecidos.',
      examples: ['CFO identificado', 'Reunião com EB agendada', 'Critérios do EB mapeados'],
      positiveSignals: ['EB identificado com acesso', 'Critérios conhecidos', 'Preocupações endereçadas'],
      negativeSignals: ['EB desconhecido', 'Sem acesso', 'Confundir influenciador com EB'],
    },
    {
      id: 'mh_user', label: 'User Buyer', weight: 20,
      description: 'Usuários finais identificados. Impacto no dia a dia mapeado. Favoráveis à mudança.',
      examples: ['Time de vendas como user buyers', 'Preocupações práticas abordadas', 'Usuários favoráveis'],
      positiveSignals: ['User buyers engajados', 'Impacto pessoal positivo', 'Entusiasmo com mudança'],
      negativeSignals: ['Usuários ignorados', 'Risco de sabotagem', 'Impacto negativo não endereçado'],
    },
    {
      id: 'mh_technical', label: 'Technical Buyer', weight: 20,
      description: 'Gatekeepers técnicos, procurement, legal. Podem vetar. Requisitos e compliance abordados.',
      examples: ['TI validou integração', 'Legal revisou contrato', 'Compliance checado'],
      positiveSignals: ['Technical buyers engajados', 'Requisitos atendidos', 'Objeções técnicas antecipadas'],
      negativeSignals: ['TI não envolvida', 'Requisitos desconhecidos', 'Risco de veto surpresa'],
    },
    {
      id: 'mh_coach', label: 'Coach & Multi-Threading', weight: 30,
      description: 'Aliado interno validado + múltiplos stakeholders engajados (não single-threaded).',
      examples: ['Coach agendou reunião com EB', 'Compartilhou info privilegiada', '3+ stakeholders engajados'],
      positiveSignals: ['Coach validado com ação', '3+ buying influences engajadas', 'Estratégia por stakeholder'],
      negativeSignals: ['Nenhum Coach', 'Single-threaded (1 contato)', 'Coach não testado'],
    },
  ],
};

// ─── BANT ────────────────────────────────────────────────────────────────────
const bant: MethodologyPreset = {
  id: 'bant',
  name: 'BANT',
  icon: '✅',
  creator: 'IBM',
  tier: 'optional',
  description: 'Qualificação rápida com 4 critérios: Budget, Authority, Need, Timeline. Simples e direto.',
  bestFor: ['Inbound leads', 'Inside sales', 'Qualificação rápida', 'High volume'],
  inputTypes: ['meetings', 'whatsapp', 'calls'],
  systemPrompt: `Você é um avaliador especialista em BANT (IBM). Avalie os 4 critérios de qualificação:

B — Budget: prospect tem orçamento disponível ou pode criar? Valor discutido?
A — Authority: está falando com o decisor? Se não, quem decide?
N — Need: necessidade real confirmada? Urgente ou nice-to-have?
T — Timeline: prazo definido? Evento gatilho existente?

Status por critério: ✅ Confirmed | ⚠️ Exploring | ❌ Unknown | 🚫 Negative

Qualificação: 4/4 = Fully Qualified (avançar), 3/4 = Mostly (preencher gap), 2/4 = Partially (nurture), 0-1/4 = Unqualified (desqualificar).

PENALIDADES: -10pts para avançar sem Budget, Authority desconhecida, Need vaga, zero Timeline.
BÔNUS: +5pts para 4/4 confirmados, Budget com valor específico, Timeline com evento externo.`,
  criteria: [
    {
      id: 'bant_budget', label: 'Budget', weight: 25,
      description: 'Prospect tem orçamento disponível ou pode criar. Faixa de investimento discutida.',
      examples: ['Budget confirmado', 'Faixa discutida', 'Budget pode ser criado'],
      positiveSignals: ['Budget confirmado com valor', 'Prospect discutiu investimento', 'Budget alinhado com solução'],
      negativeSignals: ['Budget não mencionado', 'Sem recursos', 'Avançou sem discutir'],
    },
    {
      id: 'bant_authority', label: 'Authority', weight: 25,
      description: 'Interlocutor é decisor ou tem influência direta. Processo de aprovação mapeado.',
      examples: ['Decisor direto', 'Influenciador com acesso', 'Processo de aprovação claro'],
      positiveSignals: ['Falando com decisor', 'Processo de aprovação mapeado', 'Acesso ao decisor confirmado'],
      negativeSignals: ['Não sabe quem decide', 'Gatekeeper sem influência', 'Decisor inacessível'],
    },
    {
      id: 'bant_need', label: 'Need', weight: 30,
      description: 'Necessidade real confirmada pelo prospect. Urgente vs nice-to-have identificado.',
      examples: ['Necessidade crítica confirmada', 'Problema de negócio real', 'Urgência identificada'],
      positiveSignals: ['Necessidade crítica', 'Prospect confirma problema real', 'Conectada a objetivo de negócio'],
      negativeSignals: ['Need vaga ("queremos melhorar")', 'Nice-to-have sem urgência', 'Vendedor assume necessidade'],
    },
    {
      id: 'bant_timeline', label: 'Timeline', weight: 20,
      description: 'Prazo definido ou evento gatilho identificado. Urgência real vs artificial.',
      examples: ['Precisa resolver até Q2', 'Regulação nova em janeiro', 'Deadline de projeto'],
      positiveSignals: ['Timeline com data', 'Evento gatilho externo', 'Urgência real'],
      negativeSignals: ['Sem timeline', 'Urgência artificial', '"Sem pressa"'],
    },
  ],
};

// ─── NEAT Selling ────────────────────────────────────────────────────────────
const neat: MethodologyPreset = {
  id: 'neat',
  name: 'NEAT Selling',
  icon: '🎯',
  creator: 'Richard Harris',
  tier: 'optional',
  description: 'Evolução moderna do BANT. Budget pode ser criado quando a necessidade é forte. Foca em economic impact.',
  bestFor: ['SaaS mid-market', 'Inside sales moderno', 'Quando BANT é rígido demais'],
  inputTypes: ['meetings', 'whatsapp', 'calls'],
  systemPrompt: `Você é um avaliador especialista em NEAT Selling (Richard Harris). Avalie os 4 critérios modernizados:

N — Need (Core Need): necessidade REAL, não superficial. Vendedor escavou além do pedido inicial?
E — Economic Impact: impacto financeiro de resolver E de NÃO resolver quantificado
A — Access to Authority: caminho para o decisor (direto ou via champion)
T — Timeline (Compelling Event): evento gatilho EXTERNO que cria urgência real

DIFERENÇA DO BANT: Budget não é critério direto — se o Economic Impact for forte, budget é criado. Access não precisa ser direto ao decisor.

PENALIDADES: -10pts para Need superficial, zero impacto econômico, sem path para decisor, timeline artificial.
BÔNUS: +5pts para economic impact com dados do prospect, compelling event confirmado, prospect criou budget após entender impacto.`,
  criteria: [
    {
      id: 'neat_need', label: 'Core Need', weight: 30,
      description: 'Necessidade real escavada além do superficial. Conectada a objetivo de negócio.',
      examples: ['Dor real vs "seria legal ter"', 'Escavou além do pedido', 'Conectada a business goal'],
      positiveSignals: ['Need profunda identificada', 'Escavou além do superficial', 'Conectada a objetivo de negócio'],
      negativeSignals: ['Need superficial', 'Aceitou primeiro pedido', 'Nice-to-have sem peso'],
    },
    {
      id: 'neat_economic', label: 'Economic Impact', weight: 30,
      description: 'Impacto financeiro de resolver E de não resolver. Budget justificável pelo impacto.',
      examples: ['Custo da inação: R$50K/mês', 'ROI projetado de 4x', 'Prospect criou budget'],
      positiveSignals: ['Impacto quantificado com dados do prospect', 'Custo de não agir calculado', 'Budget justificado pelo impacto'],
      negativeSignals: ['Zero quantificação', 'Impacto vago', 'Não calculou custo da inação'],
    },
    {
      id: 'neat_access', label: 'Access to Authority', weight: 20,
      description: 'Caminho para o decisor — direto ou via champion/influenciador.',
      examples: ['Acesso direto ao VP', 'Champion vai agendar com EB', 'Influenciador forte'],
      positiveSignals: ['Path claro para decisor', 'Champion com acesso', 'Estratégia de acesso definida'],
      negativeSignals: ['Sem path para decisor', 'Gatekeeper sem influência', 'Sem estratégia'],
    },
    {
      id: 'neat_timeline', label: 'Compelling Event', weight: 20,
      description: 'Evento gatilho externo que cria urgência real (não artificial).',
      examples: ['Nova regulação em março', 'Meta do trimestre', 'Contrato atual vence'],
      positiveSignals: ['Evento externo confirmado', 'Urgência real', 'Timeline conectada ao impacto'],
      negativeSignals: ['Sem compelling event', 'Urgência artificial', '"Quando der"'],
    },
  ],
};

// ─── SNAP Selling ────────────────────────────────────────────────────────────
const snap: MethodologyPreset = {
  id: 'snap',
  name: 'SNAP Selling',
  icon: '⚡',
  creator: 'Jill Konrath',
  tier: 'optional',
  description: 'Foca na psicologia do comprador sobrecarregado. Simple, iNvaluable, Aligned, Priority.',
  bestFor: ['SaaS mid-market', 'Buyers sobrecarregados', 'Vendas com competição por atenção'],
  inputTypes: ['meetings', 'whatsapp', 'calls'],
  systemPrompt: `Você é um avaliador especialista em SNAP Selling (Jill Konrath). Avalie os 4 princípios:

S — Simple: mensagem clara, sem jargão, processo simplificado. Comprável em 1-2 frases.
N — iNvaluable: cada interação agregou valor real? Vendedor = consultor, não vendedor?
A — Aligned: mensagem alinhada com prioridades, objetivos e problemas do prospect?
P — Priority: vendedor tornou a decisão urgente entre as prioridades do prospect?

CONTEXTO: Compradores modernos são sobrecarregados. Eles tomam 3 decisões:
1. Permitir acesso (responder msg/aceitar call)
2. Iniciar mudança (sair do status quo)
3. Selecionar solução

PENALIDADES: -10pts para mensagem longa/confusa, follow-up sem valor, desalinhamento, zero urgência.
BÔNUS: +5pts para resposta rápida do prospect (mensagem ressoou), prospect inclui mais pessoas, benchmark impressionante.`,
  criteria: [
    {
      id: 'snap_simple', label: 'Simple', weight: 25,
      description: 'Mensagem clara, direta, sem jargão. Proposta compreensível em 1-2 frases. Processo simplificado.',
      examples: ['Pitch em 2 frases', 'Sem jargão técnico', 'Processo simples de avançar'],
      positiveSignals: ['Mensagem clara e concisa', 'Proposta fácil de entender', 'Processo simplificado'],
      negativeSignals: ['Mensagem longa e confusa', 'Excesso de jargão', 'Processo complicado'],
    },
    {
      id: 'snap_invaluable', label: 'iNvaluable', weight: 30,
      description: 'Cada interação agrega valor real. Vendedor posicionado como consultor, não vendedor.',
      examples: ['Insight valioso compartilhado', 'Benchmark do setor', 'Aprendizado em cada touchpoint'],
      positiveSignals: ['Prospect aprendeu algo novo', 'Valor real em cada interação', 'Postura consultiva'],
      negativeSignals: ['Follow-up vazio ("verificando")', 'Sem valor agregado', 'Apenas vendendo, não consultando'],
    },
    {
      id: 'snap_aligned', label: 'Aligned', weight: 25,
      description: 'Mensagem alinhada com prioridades, objetivos e problemas do prospect. Sem empurrar.',
      examples: ['Conectado às prioridades do prospect', 'Linguagem do prospect', 'Sem forçar'],
      positiveSignals: ['Alinhado com prioridades do prospect', 'Demonstrou conhecer contexto', 'Prospect se sentiu entendido'],
      negativeSignals: ['Desalinhado com prioridades', 'Tentou empurrar algo irrelevante', 'Não pesquisou sobre o prospect'],
    },
    {
      id: 'snap_priority', label: 'Priority', weight: 20,
      description: 'Vendedor tornou a decisão urgente. Custo da inação articulado. Prospect priorizou.',
      examples: ['Agir agora vs depois', 'Custo de esperar', 'Prospect moveu para topo das prioridades'],
      positiveSignals: ['Urgência baseada em dados', 'Custo da inação articulado', 'Prospect priorizou'],
      negativeSignals: ['Sem urgência construída', 'Prospect adiou sem preocupação', 'Sem custo da inação'],
    },
  ],
};

// ─── Export ──────────────────────────────────────────────────────────────────
export const METHODOLOGY_PRESETS: MethodologyPreset[] = [
  sandler,
  spin,
  meddic,
  challenger,
  gap,
  spiced,
  valueSelling,
  command,
  millerHeiman,
  bant,
  neat,
  snap,
];

export function getPresetById(id: string): MethodologyPreset | undefined {
  return METHODOLOGY_PRESETS.find(p => p.id === id);
}

export function getPresetsForInputType(type: 'meetings' | 'whatsapp' | 'calls'): MethodologyPreset[] {
  return METHODOLOGY_PRESETS.filter(p => p.inputTypes.includes(type));
}

export function getPresetsByTier(tier: 'core' | 'complementary' | 'optional'): MethodologyPreset[] {
  return METHODOLOGY_PRESETS.filter(p => p.tier === tier);
}
