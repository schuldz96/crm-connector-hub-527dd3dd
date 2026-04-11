# Phase 1: Admin Panel Fixes — PLAN

**Goal:** Completar funcionalidades CRUD do Super Admin para gestao de empresas, planos, assinaturas e feature flags.
**Branch:** otavio
**Estimated effort:** ~6-8 horas de implementacao

---

## Pre-conditions
- [x] Dev server rodando (localhost:8080)
- [x] Branch otavio ativa
- [x] superAdminService.ts lido e entendido
- [x] Todas as SA pages lidas e analisadas

## Tasks

### Task 1: Criar Organizacao (HIGH priority)
**Files:** `src/lib/superAdminService.ts`, `src/pages/super-admin/SAOrganizationsPage.tsx`
**Goal:** Permitir criar nova empresa pelo Super Admin

**1.1 Service — adicionar `createOrganization()`**
```typescript
// Em superAdminService.ts
export async function createOrganization(org: {
  nome: string;
  dominio?: string;
  ativo?: boolean;
}): Promise<Organization> {
  const orgKey = Array.from({ length: 6 }, () =>
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]
  ).join('');

  // plano tem DEFAULT 'enterprise' no DB, nao precisa passar
  // org key gerada aqui (6 chars uppercase)
  const { data, error } = await core()
    .from('empresas')
    .insert({ ...org, org: orgKey })
    .select()
    .single();

  if (error) throw new Error(`Erro ao criar organizacao: ${error.message}`);
  return data as Organization;
}
```

**1.2 UI — adicionar botao + dialog no SAOrganizationsPage**
- Botao "Nova Organizacao" no header (seguir padrao SAPlansPage)
- Dialog com campos: Nome (obrigatorio), Dominio (opcional), Ativo (switch, default true)
- Ao salvar: chamar createOrganization(), toast sucesso, reload lista
- Importar: Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Input, Label, Switch, Plus icon

**Acceptance criteria:**
- [ ] Botao "Nova Organizacao" visivel no header da pagina
- [ ] Dialog abre com campos nome + dominio + ativo
- [ ] Org key gerada automaticamente (6 chars uppercase)
- [ ] Empresa aparece na lista apos criacao
- [ ] Toast de sucesso/erro exibido
- [ ] Validacao: nome obrigatorio

**Scope note:** Update/delete de organizacoes foi deixado de fora intencionalmente — SAOrgDetailPage ja permite visualizar detalhes. Editar org pode ser adicionado em fase futura.

**Commit:** `feat: adicionar criacao de organizacoes no Super Admin`

---

### Task 2: Completar SASubscriptionsPage (HIGH priority)
**Files:** `src/lib/superAdminService.ts`, `src/pages/super-admin/SASubscriptionsPage.tsx`
**Goal:** Transformar pagina read-only em CRUD completo

**2.1 Service — adicionar `createSubscription()`**
```typescript
export async function createSubscription(sub: {
  org: string;
  plano_id: string;
  ciclo?: string;
  status?: string;
  trial_ate?: string;
}): Promise<Subscription> {
  const { data, error } = await admin()
    .from('assinaturas')
    .insert({
      ...sub,
      ciclo: sub.ciclo ?? 'mensal',
      status: sub.status ?? 'ativa',
      inicio_em: new Date().toISOString(),
    })
    .select('*,planos(nome)')
    .single();

  if (error) throw new Error(`Erro ao criar assinatura: ${error.message}`);
  return {
    id: data.id,
    org: data.org,
    plano_id: data.plano_id,
    status: data.status,
    ciclo: data.ciclo,
    trial_ate: data.trial_ate ?? undefined,
    inicio_em: data.inicio_em,
    plano_nome: (data as any).planos?.nome ?? undefined,
  };
}
```

**Nota:** `admin.assinaturas` usa `org TEXT NOT NULL` (nao empresa_id UUID). O plano esta correto — passa `org` direto.

**2.2 UI — estender SASubscriptionsPage com CRUD (manter codigo existente)**
Seguir padrao SAPlansPage, mantendo o filtro de status e tabela existentes:
- "Nova Assinatura" botao + Dialog com:
  - Org selector (dropdown populado por getAllOrganizations)
  - Plano selector (dropdown populado por getAllPlans)
  - Ciclo (mensal/anual)
  - Status (ativa/trial/suspensa)
  - Trial ate (date picker, condicional quando status=trial)
- Acoes por linha:
  - "Editar" — dialog pre-populado, permite trocar plano/ciclo/status
  - "Cancelar" — confirmacao + updateSubscription(id, { status: 'cancelada', cancelado_em: now })
- Filtros existentes: manter o filtro de status que ja existe
- Melhorar tabela: adicionar colunas ciclo, inicio, proximo pagamento

**Acceptance criteria:**
- [ ] Botao "Nova Assinatura" funcional
- [ ] Dialog de criacao com selectors de org + plano + ciclo
- [ ] Acoes de editar e cancelar por linha
- [ ] Tabela com todas as colunas relevantes
- [ ] Toast de sucesso/erro em todas as acoes
- [ ] Filtro de status mantido

**Commit:** `feat: completar CRUD de assinaturas no Super Admin`

---

### Task 3: Desativar/Reativar Planos (MEDIUM priority)
**Files:** `src/pages/super-admin/SAPlansPage.tsx`
**Goal:** Permitir soft-delete de planos (ativo=false/true)

**3.1 UI — adicionar toggle de ativacao**
- Na coluna "Ativo" da tabela, trocar Badge estático por Switch clicável
- Ao clicar: `updatePlan(plan.id, { ativo: !plan.ativo })`
- Toast de confirmacao
- Opcionalmente: confirmacao "Tem certeza?" se desativando plano com assinaturas ativas

**Acceptance criteria:**
- [ ] Switch de ativar/desativar na tabela de planos
- [ ] updatePlan chamado corretamente
- [ ] Toast de sucesso
- [ ] Lista atualiza apos toggle

**Scope note:** Soft-delete (ativo=false) e a abordagem correta. Hard-delete quebraria FK em admin.assinaturas e CASCADE deletaria plano_features. Nao adicionar deletePlan().

**Commit:** `feat: permitir desativar/reativar planos no Super Admin`

---

### Task 4: Delete Feature Flags (MEDIUM priority)
**Files:** `src/lib/superAdminService.ts`, `src/pages/super-admin/SAFeatureFlagsPage.tsx`
**Goal:** Permitir excluir feature flags

**4.1 Service — adicionar `deleteFeatureFlag()`**
```typescript
export async function deleteFeatureFlag(id: string): Promise<void> {
  const { error } = await admin()
    .from('feature_flags')
    .delete()
    .eq('id', id);
  if (error) throw new Error(`Erro ao excluir feature flag: ${error.message}`);
}
```

**4.2 UI — adicionar botao delete**
- Botao trash icon na coluna de acoes (ao lado do edit)
- Dialog de confirmacao antes de deletar
- Toast de sucesso, reload lista

**Acceptance criteria:**
- [ ] Botao de excluir visivel por flag
- [ ] Dialog de confirmacao
- [ ] Flag removida da lista apos exclusao
- [ ] Toast de sucesso/erro

**Commit:** `feat: adicionar exclusao de feature flags no Super Admin`

---

### Task 5 (OPCIONAL): Melhorar org selector nos Feature Flags
**Files:** `src/pages/super-admin/SAFeatureFlagsPage.tsx`
**Goal:** Trocar textarea de org keys por selector com autocomplete

- Atualmente: textarea livre onde digita org keys uma por linha
- Melhoria: multi-select dropdown populado por getAllOrganizations()
- Mostrar nome da org ao lado do key

**Aceitar como bonus se houver tempo.**

---

## Execution Order

```
Task 1 (Criar Org) ──────> commit
         |
Task 2 (Subscriptions) ──> commit
         |
Task 3 (Toggle Planos) ──> commit
         |
Task 4 (Delete Flags) ───> commit
         |
Task 5 (Org selector) ───> commit (opcional)
```

Tarefas sao sequenciais porque Task 2 depende de poder selecionar orgs (criadas na Task 1), e o padrao estabelecido em Task 1 e replicado nas demais.

## Verification

Apos cada task:
1. `npx tsc --noEmit --skipLibCheck` — zero erros
2. `npx vite build` — build OK
3. Testar no browser (http://localhost:8080/super-admin/*)

Apos todas as tasks:
- [ ] Criar org → criar assinatura → associar plano → verificar modulos habilitados
- [ ] Desativar plano → verificar assinaturas nao quebram
- [ ] Deletar flag → verificar lista atualiza

## Files Changed Summary

| File | Changes |
|------|---------|
| src/lib/superAdminService.ts | +createOrganization, +createSubscription, +deleteFeatureFlag |
| src/pages/super-admin/SAOrganizationsPage.tsx | +Create button, +Dialog, imports |
| src/pages/super-admin/SASubscriptionsPage.tsx | Full rewrite: +Create/Edit/Cancel, +selectors |
| src/pages/super-admin/SAPlansPage.tsx | +Switch ativar/desativar na tabela |
| src/pages/super-admin/SAFeatureFlagsPage.tsx | +Delete button, +confirm dialog |
