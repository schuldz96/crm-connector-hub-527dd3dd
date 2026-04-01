#!/bin/bash
# Coleta métricas reais do projeto e gera src/lib/projectMetrics.json
# Roda automaticamente antes de cada build (vite) e dev (vite dev)

cd "$(dirname "$0")/.." || exit 1

PAGES=$(ls -1 src/pages/*.tsx src/pages/crm/*.tsx 2>/dev/null | wc -l | tr -d ' ')
EDGE_FN=$(ls -d supabase/functions/*/ 2>/dev/null | grep -v _shared | wc -l | tr -d ' ')
MIGRATIONS=$(ls supabase/migrations/*.sql 2>/dev/null | wc -l | tr -d ' ')
AGENTS=$(ls squads/*/agents/*.md .aiox-core/development/agents/*.md 2>/dev/null | wc -l | tr -d ' ')
LOC=$(find src -name '*.ts' -o -name '*.tsx' | xargs cat 2>/dev/null | wc -l | tr -d ' ')
COMMITS=$(git rev-list --count HEAD 2>/dev/null || echo "0")
FIRST_COMMIT=$(git log --reverse --format="%ai" 2>/dev/null | grep -v "2025-01-01" | head -1 | cut -d' ' -f1)
COMPONENTS=$(find src/components -name '*.tsx' 2>/dev/null | wc -l | tr -d ' ')
HOOKS=$(find src/hooks -name '*.ts' 2>/dev/null | wc -l | tr -d ' ')
CONTEXTS=$(find src/contexts -name '*.tsx' 2>/dev/null | wc -l | tr -d ' ')
SERVICES=$(find src/lib -name '*.ts' 2>/dev/null | wc -l | tr -d ' ')
SQUADS=$(ls -d squads/*/ 2>/dev/null | wc -l | tr -d ' ')

# Count integrations by unique external APIs
INTEGRATIONS=4  # Evolution API, Meta WABA, Google Meet, OpenAI

cat > src/lib/projectMetrics.json << EOF
{
  "startDate": "${FIRST_COMMIT:-2026-03-08}",
  "commits": ${COMMITS},
  "loc": ${LOC},
  "pages": ${PAGES},
  "components": ${COMPONENTS},
  "hooks": ${HOOKS},
  "contexts": ${CONTEXTS},
  "services": ${SERVICES},
  "edgeFunctions": ${EDGE_FN},
  "migrations": ${MIGRATIONS},
  "agents": ${AGENTS},
  "squads": ${SQUADS},
  "integrations": ${INTEGRATIONS},
  "teamSize": 2,
  "collectedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

echo "[metrics] Collected: ${LOC} LOC, ${PAGES} pages, ${COMMITS} commits, ${AGENTS} agents, ${MIGRATIONS} migrations"
