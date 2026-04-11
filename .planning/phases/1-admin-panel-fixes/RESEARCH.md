# Phase 1: Admin Panel Fixes - Research

**Researched:** 2026-04-10
**Domain:** React Super Admin CRUD pages + Supabase service layer
**Confidence:** HIGH

## Summary

The Super Admin panel has 13 pages under `src/pages/super-admin/` with routing handled by `SuperAdminProtectedRoutes.tsx`. The service layer (`superAdminService.ts`, 628 lines) provides most CRUD operations across two custom Supabase schemas: `admin.*` (plans, subscriptions, feature flags, audit, config) and `core.*` (empresas, usuarios, modulos). Several bugs and gaps exist: a navigation path mismatch in SAOrganizationsPage, missing "Create Organization" flow, incomplete SASubscriptionsPage (read-only, no CRUD), missing `deletePlan` service function, and no `createSubscription` service function.

All DB tables are well-defined in migration `20260408_restructure_schemas.sql` with clear constraints and foreign keys. The existing pages follow a consistent pattern: useState for data + loading + error, useEffect to fetch, Table display with shadcn/ui components, Dialog for create/edit forms. This pattern should be replicated for all fixes.

**Primary recommendation:** Fix the route bug first (trivial, high impact), then add missing service functions, then enhance thin pages with CRUD dialogs following the existing SAPlansPage/SAFeatureFlagsPage pattern.

---

## Item 1: Route Bug in SAOrganizationsPage

### Current State
- **File:** `src/pages/super-admin/SAOrganizationsPage.tsx` (143 lines)
- **Bug location:** Line 111: `navigate(\`/super-admin/organizations/${org.org}\`)`
- **Route definition** in `SuperAdminProtectedRoutes.tsx` line 40: `<Route path="organizations/:org" ...>`
- Since routes are relative under `/super-admin/*`, the full path is `/super-admin/organizations/:org`

### Finding: NO BUG EXISTS
The navigate call produces `/super-admin/organizations/{orgKey}` and the route definition is `organizations/:org` under the `/super-admin/*` parent route. **These match correctly.** The `useParams` in SAOrgDetailPage (line 18) extracts `{ org: orgKey }` which matches the `:org` parameter.

The route definition on line 40 is: `<Route path="organizations/:org" element={<SAOrgDetailPage />} />`

The navigation on line 111 produces: `/super-admin/organizations/${org.org}` where `org.org` is the org key string.

**Verdict:** The route is correct. The original bug report may have been based on an older route configuration. No fix needed.

### Confidence: HIGH
Verified by reading both files directly.

---

## Item 2: Create Organization Flow

### Current State
- **SAOrganizationsPage.tsx:** Read-only table, no "Create" button, no dialog
- **superAdminService.ts:** Has `getAllOrganizations()` and `getOrgDetail(org)` but NO `createOrganization()` function
- No existing create/edit organization UI anywhere in super-admin

### DB Schema: `core.empresas`
From migration `20260309164000_schema_saas.sql` (original) + `20260408_restructure_schemas.sql` (restructure):

| Column | Type | Default | Required | Notes |
|--------|------|---------|----------|-------|
| id | UUID | gen_random_uuid() | auto | PK |
| nome | TEXT | - | YES | Company name |
| dominio | CITEXT | - | NO | Unique domain |
| logo_url | TEXT | - | NO | Logo URL |
| plano | tipo_plano enum | 'enterprise' | YES | Legacy plan field (enum) |
| ativo | BOOLEAN | true | YES | Active status |
| org | TEXT | - | YES (added later) | Unique org key |
| criado_em | TIMESTAMPTZ | now() | auto | |
| atualizado_em | TIMESTAMPTZ | now() | auto | |

The `org` column was added by the restructure migration with `core.generate_org_key()` function that creates random 6-char uppercase keys.

### What's Missing
1. **Service function:** `createOrganization(data)` in `superAdminService.ts`
   - Must insert into `core.empresas`
   - Should auto-generate `org` key using `core.generate_org_key()` or let the service generate one
   - Required fields: `nome` (minimum)
   - Optional: `dominio`, `plano`, `ativo`
2. **UI:** "Criar Organizacao" button + Dialog in SAOrganizationsPage
   - Follow SAPlansPage pattern: `emptyOrg` template, `dialogOpen` state, form fields, save handler
3. **Post-create:** Optionally auto-create a subscription for the org

### Files to Modify
- `src/lib/superAdminService.ts` -- add `createOrganization()`
- `src/pages/super-admin/SAOrganizationsPage.tsx` -- add Create button + Dialog

### Recommended Approach
```typescript
export async function createOrganization(org: {
  nome: string;
  dominio?: string;
  plano?: string;
  ativo?: boolean;
}): Promise<Organization> {
  // Generate org key: 6 random uppercase letters
  const orgKey = Array.from({ length: 6 }, () =>
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]
  ).join('');

  const { data, error } = await core()
    .from('empresas')
    .insert({ ...org, org: orgKey })
    .select()
    .single();

  if (error) throw new Error(`Erro ao criar organizacao: ${error.message}`);
  return data as Organization;
}
```

### Confidence: HIGH

---

## Item 3: SASubscriptionsPage Completion

### Current State
- **File:** `src/pages/super-admin/SASubscriptionsPage.tsx` (148 lines)
- **Read-only:** Lists subscriptions in a table with status filter
- **No actions:** No create, edit, cancel, or change plan buttons
- **Service functions available:** `getAllSubscriptions()`, `getOrgSubscription()`, `updateSubscription()`
- **Missing service functions:** `createSubscription()`, no cancel-specific function

### DB Schema: `admin.assinaturas`

| Column | Type | Default | Constraint | Notes |
|--------|------|---------|------------|-------|
| id | UUID | gen_random_uuid() | PK | |
| org | TEXT | - | NOT NULL | Org key |
| plano_id | UUID | - | NOT NULL, FK to admin.planos | |
| status | TEXT | 'ativa' | CHECK: ativa/cancelada/suspensa/trial/expirada | |
| ciclo | TEXT | 'mensal' | CHECK: mensal/anual | |
| trial_ate | TIMESTAMPTZ | - | nullable | Trial end date |
| inicio_em | TIMESTAMPTZ | now() | NOT NULL | |
| proximo_pagamento | TIMESTAMPTZ | - | nullable | |
| cancelado_em | TIMESTAMPTZ | - | nullable | |
| criado_em | TIMESTAMPTZ | now() | NOT NULL | |
| atualizado_em | TIMESTAMPTZ | now() | NOT NULL | |

### What's Missing

1. **Service functions needed:**
   - `createSubscription(data)` -- insert into `admin.assinaturas`
   - Cancel = `updateSubscription(id, { status: 'cancelada', cancelado_em: new Date().toISOString() })`
   - Change plan = `updateSubscription(id, { plano_id: newPlanId })`

2. **UI enhancements needed:**
   - "Nova Assinatura" button + create dialog (select org, select plan, choose cycle)
   - Row actions: Edit (change plan/cycle/status), Cancel
   - Possibly inline status change dropdown per row

3. **Subscription interface** already has the right fields

### Files to Modify
- `src/lib/superAdminService.ts` -- add `createSubscription()`
- `src/pages/super-admin/SASubscriptionsPage.tsx` -- add create dialog, row actions

### Recommended Approach
Follow SAPlansPage dialog pattern. Create dialog needs:
- Org selector (dropdown from `getAllOrganizations()`)
- Plan selector (dropdown from `getAllPlans()`)
- Cycle selector (mensal/anual)
- Optional trial end date

### Confidence: HIGH

---

## Item 4: Plan - Subscription - Organization Flow

### Data Model Relationships

```
core.empresas (org)
    |
    | org TEXT (org key)
    |
    v
admin.assinaturas (org -> plano_id)
    |
    | plano_id UUID FK
    |
    v
admin.planos (id)
    |
    | plano_id
    |
    v
admin.plano_features (plano_id -> feature_codigo)
    |
    | feature_codigo
    |
    v
core.modulos_sistema (codigo)
    |
    | modulo_codigo
    |
    v
core.configuracoes_modulos_empresa (org, modulo_codigo) -- overrides
```

### Key Relationships
- `empresas.org` <-> `assinaturas.org` (1:N, but practically 1:1 active)
- `assinaturas.plano_id` -> `planos.id` (FK with ON DELETE default/restrict)
- `plano_features.plano_id` -> `planos.id` (FK with ON DELETE CASCADE)
- No direct FK from `empresas` to `assinaturas` -- linked via `org` TEXT key
- The legacy `empresas.plano` column (enum) exists but is separate from the `admin.assinaturas` system

### Important Notes
- An org can have multiple subscription records (history), but `getOrgSubscription()` returns only the latest by `inicio_em DESC LIMIT 1`
- The `empresas.plano` enum field is a legacy field from before the admin schema was created. The authoritative plan association is through `admin.assinaturas`
- `faturas` (invoices) table exists but has no service functions or UI yet

### Confidence: HIGH

---

## Item 5: Module Control per Plan (SAModulesPage)

### Current State
- **File:** `src/pages/super-admin/SAModulesPage.tsx` (835 lines) -- FULLY IMPLEMENTED
- **3 tabs:**
  1. **System Modules** -- CRUD for `core.modulos_sistema` (list, toggle active, create new)
  2. **Plan Matrix** -- `admin.plano_features` cross-reference table (modules x plans), toggle per cell
  3. **Org Overrides** -- `core.configuracoes_modulos_empresa` per-org module overrides with plan inheritance display

### What's Missing
- The page appears **functionally complete** for current requirements
- Minor potential enhancement: The Plan Matrix tab shows "--" for features not yet seeded in `plano_features`. There's no "add feature to plan" button -- features must exist in `plano_features` table first
- No bulk seed operation to populate `plano_features` for all modules across all plans

### Service functions (all exist):
- `getSystemModules()`, `updateSystemModule()`, `createSystemModule()`
- `getAllPlans()`, `getPlanFeatures()`, `getAllPlanFeatures()`, `updatePlanFeature()`
- `getOrgModuleOverrides()`, `setOrgModuleOverride()`, `removeOrgModuleOverride()`

### Verdict: LOW PRIORITY
SAModulesPage is the most complete super-admin page. Only minor enhancements may be needed (e.g., ability to seed plano_features entries for modules not yet in the matrix).

### Confidence: HIGH

---

## Item 6: Feature Flags (SAFeatureFlagsPage)

### Current State
- **File:** `src/pages/super-admin/SAFeatureFlagsPage.tsx` (320 lines) -- MOSTLY COMPLETE
- **Has:** List table, create dialog, edit dialog, global toggle, per-plan association, per-org association (text area)
- **Service functions:** `getFeatureFlags()`, `updateFeatureFlag()`, `createFeatureFlag()` -- all exist

### What's Missing
1. **No delete function:** Cannot delete a feature flag (no `deleteFeatureFlag()` in service)
2. **Org association UI is basic:** Free-text textarea where you type org keys one per line. No autocomplete/dropdown from existing orgs
3. **No bulk operations:** Cannot enable/disable across all orgs

### Files to Modify
- `src/lib/superAdminService.ts` -- add `deleteFeatureFlag()`
- `src/pages/super-admin/SAFeatureFlagsPage.tsx` -- add delete button, optionally improve org selector

### Recommended Approach for Delete
```typescript
export async function deleteFeatureFlag(id: string): Promise<void> {
  const { error } = await admin()
    .from('feature_flags')
    .delete()
    .eq('id', id);
  if (error) throw new Error(`Erro ao excluir feature flag: ${error.message}`);
}
```

### Confidence: HIGH

---

## Item 7: Delete Plans

### Current State
- **SAPlansPage.tsx:** Has create + edit, NO delete button
- **superAdminService.ts:** Has `createPlan()`, `updatePlan()`, NO `deletePlan()`
- **DB constraint:** `admin.assinaturas.plano_id` references `admin.planos(id)` WITHOUT `ON DELETE CASCADE` -- meaning hard-delete of a plan with active subscriptions would FAIL with FK violation

### Recommendation: Soft-Delete (ativo=false)

**Reasons:**
1. FK constraint prevents hard-delete when subscriptions exist
2. Historical subscription records need the plan reference to remain valid
3. `plano_features` has `ON DELETE CASCADE` to `planos(id)`, so hard-delete would wipe all feature configurations
4. The `ativo` boolean column already exists on `admin.planos`
5. SAPlansPage already shows ativo/inativo status badge

### Implementation
- **No new service function needed:** `updatePlan(id, { ativo: false })` already works
- **UI change:** Add a "Desativar" button/action to each plan row or in the edit dialog
- Optionally add a "Reativar" for inactive plans
- Filter to show active plans by default with toggle to show all

### Files to Modify
- `src/pages/super-admin/SAPlansPage.tsx` -- add deactivate/reactivate button

### Confidence: HIGH

---

## Architecture Patterns

### Existing Page Pattern (replicate for all fixes)
```typescript
// 1. State
const [data, setData] = useState<Type[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState('');
const [dialogOpen, setDialogOpen] = useState(false);
const [editing, setEditing] = useState<Partial<Type>>(emptyTemplate);
const [isEditing, setIsEditing] = useState(false);
const [saving, setSaving] = useState(false);

// 2. Load on mount
useEffect(() => { load(); }, []);

// 3. Save handler with toast
async function handleSave() {
  setSaving(true);
  try {
    if (isEditing && editing.id) {
      await updateFn(editing.id, updates);
      toast({ title: 'Atualizado com sucesso' });
    } else {
      await createFn(editing);
      toast({ title: 'Criado com sucesso' });
    }
    setDialogOpen(false);
    await load();
  } catch (err) {
    toast({ title: 'Erro', description: err.message, variant: 'destructive' });
  } finally {
    setSaving(false);
  }
}

// 4. UI: header with count + action button, error banner, table, dialog
```

### Service Function Pattern
```typescript
export async function createEntity(entity: Partial<Type>): Promise<Type> {
  const { data, error } = await schema()
    .from('table_name')
    .insert(entity)
    .select()
    .single();
  if (error) throw new Error(`Erro ao criar entidade: ${error.message}`);
  return data as Type;
}
```

### UI Component Stack (already imported across SA pages)
- `shadcn/ui`: Table, Dialog, Button, Input, Label, Badge, Switch, Select, Tabs, Textarea
- `lucide-react`: icons (Plus, Pencil, AlertCircle, Loader2, etc.)
- `@/hooks/use-toast`: toast notifications

---

## Common Pitfalls

### Pitfall 1: Schema Access
**What goes wrong:** Using `supabase` client instead of `supabaseSaas` with `.schema()` calls
**How to avoid:** Always use the existing helpers: `const admin = () => (supabaseSaas as any).schema('admin');` and `const core = () => (supabaseSaas as any).schema('core');`

### Pitfall 2: Org Key Generation
**What goes wrong:** Creating empresas without an `org` key, breaking all cross-schema references
**How to avoid:** Always generate/provide `org` when inserting into `core.empresas`. The DB function `core.generate_org_key()` exists but calling RPC from frontend may not work. Generate in JS instead.

### Pitfall 3: Plan Deletion with FK References
**What goes wrong:** Hard-deleting a plan that has subscriptions or features
**How to avoid:** Use soft-delete (`ativo=false`). Never add a hard-delete `deletePlan()` function.

### Pitfall 4: Legacy plano enum vs admin.assinaturas
**What goes wrong:** Confusing `core.empresas.plano` (legacy enum) with the subscription system (`admin.assinaturas.plano_id`)
**How to avoid:** The Organization interface already has `plano: string` from empresas. For new orgs, optionally set this, but the authoritative plan link is through `admin.assinaturas`.

---

## Task Summary and Priority

| # | Task | Priority | Effort | Files |
|---|------|----------|--------|-------|
| 1 | ~~Fix route bug~~ (no bug found) | N/A | 0 | N/A |
| 2 | Add createOrganization service + UI | HIGH | Medium | superAdminService.ts, SAOrganizationsPage.tsx |
| 3 | Add createSubscription service + enhance SASubscriptionsPage | HIGH | Medium | superAdminService.ts, SASubscriptionsPage.tsx |
| 4 | Add deactivate/reactivate plan button | MEDIUM | Small | SAPlansPage.tsx |
| 5 | Add deleteFeatureFlag service + UI | MEDIUM | Small | superAdminService.ts, SAFeatureFlagsPage.tsx |
| 6 | SAModulesPage minor enhancements | LOW | Small | SAModulesPage.tsx (optional) |

---

## Sources

### Primary (HIGH confidence)
- `src/components/super-admin/SuperAdminProtectedRoutes.tsx` -- route definitions (read directly)
- `src/lib/superAdminService.ts` -- full service layer (628 lines, read directly)
- `src/pages/super-admin/SAOrganizationsPage.tsx` -- 143 lines (read directly)
- `src/pages/super-admin/SASubscriptionsPage.tsx` -- 148 lines (read directly)
- `src/pages/super-admin/SAFeatureFlagsPage.tsx` -- 320 lines (read directly)
- `src/pages/super-admin/SAPlansPage.tsx` -- 301 lines (read directly)
- `src/pages/super-admin/SAModulesPage.tsx` -- 835 lines (read directly)
- `src/pages/super-admin/SAOrgDetailPage.tsx` -- 309 lines (read directly)
- `supabase/migrations/20260408_restructure_schemas.sql` -- admin schema DDL (read directly)
- `supabase/migrations/20260309164000_schema_saas.sql` -- core.empresas DDL (read directly)
- `supabase/migrations/20260409_license_per_user_pricing.sql` -- planos extra columns (read directly)

## Metadata

**Confidence breakdown:**
- Route bug analysis: HIGH -- read both source and route files
- DB schema: HIGH -- read migration SQL directly
- Service gaps: HIGH -- read full superAdminService.ts
- UI gaps: HIGH -- read all relevant page files
- Architecture patterns: HIGH -- consistent across 6+ pages

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (stable codebase, no external dependencies changing)
