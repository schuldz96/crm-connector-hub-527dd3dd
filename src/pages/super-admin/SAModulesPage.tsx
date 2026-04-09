import { useState, useEffect, useCallback } from 'react';
import {
  getSystemModules,
  updateSystemModule,
  createSystemModule,
  getAllPlans,
  getPlanFeatures,
  getAllPlanFeatures,
  updatePlanFeature,
  getAllOrganizations,
  getOrgSubscription,
  getOrgModuleOverrides,
  setOrgModuleOverride,
  removeOrgModuleOverride,
} from '@/lib/superAdminService';
import type {
  SystemModule,
  Plan,
  PlanFeature,
  Organization,
  OrgModuleOverride,
} from '@/lib/superAdminService';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Loader2,
  AlertCircle,
  Plus,
  Puzzle,
  Check,
  X,
  RotateCcw,
  Building2,
} from 'lucide-react';

// ─── Tab 1: System Modules ──────────────────────────────────────────────────────

function SystemModulesTab() {
  const { toast } = useToast();
  const [modules, setModules] = useState<SystemModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newModule, setNewModule] = useState({ codigo: '', nome: '', descricao: '' });

  const loadModules = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getSystemModules();
      setModules(data);
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao carregar módulos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadModules();
  }, [loadModules]);

  async function handleToggle(mod: SystemModule) {
    try {
      await updateSystemModule(mod.codigo, { ativo: !mod.ativo });
      toast({
        title: `Módulo "${mod.nome}" ${!mod.ativo ? 'ativado' : 'desativado'}`,
      });
      await loadModules();
    } catch (err: any) {
      toast({
        title: 'Erro',
        description: err?.message,
        variant: 'destructive',
      });
    }
  }

  async function handleCreate() {
    if (!newModule.codigo || !newModule.nome) {
      toast({
        title: 'Erro',
        description: 'Código e nome são obrigatórios',
        variant: 'destructive',
      });
      return;
    }
    setSaving(true);
    try {
      await createSystemModule(newModule);
      toast({ title: 'Módulo criado com sucesso' });
      setDialogOpen(false);
      setNewModule({ codigo: '', nome: '', descricao: '' });
      await loadModules();
    } catch (err: any) {
      toast({
        title: 'Erro',
        description: err?.message ?? 'Erro ao criar módulo',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {modules.length} módulos cadastrados
        </p>
        <Button
          onClick={() => setDialogOpen(true)}
          className="bg-red-600 hover:bg-red-700 text-white"
        >
          <Plus className="w-4 h-4 mr-2" /> Novo Módulo
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="glass-card border border-border rounded-lg bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="text-center w-28">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {modules.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center text-muted-foreground py-8"
                >
                  Nenhum módulo cadastrado.
                </TableCell>
              </TableRow>
            ) : (
              modules.map((mod) => (
                <TableRow key={mod.codigo}>
                  <TableCell className="font-mono text-xs">
                    {mod.codigo}
                  </TableCell>
                  <TableCell className="font-medium">{mod.nome}</TableCell>
                  <TableCell className="text-muted-foreground text-sm max-w-[300px] truncate">
                    {mod.descricao || '\u2014'}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Switch
                        checked={mod.ativo}
                        onCheckedChange={() => handleToggle(mod)}
                      />
                      <Badge
                        variant={mod.ativo ? 'default' : 'secondary'}
                        className={
                          mod.ativo
                            ? 'bg-green-500/10 text-green-500 border-green-500/20'
                            : 'bg-muted text-muted-foreground'
                        }
                      >
                        {mod.ativo ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create Module Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Módulo do Sistema</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm mb-1.5 block">Código</Label>
              <Input
                value={newModule.codigo}
                onChange={(e) =>
                  setNewModule((prev) => ({ ...prev, codigo: e.target.value }))
                }
                className="bg-input border-border"
                placeholder="ex: crm_avancado"
              />
            </div>
            <div>
              <Label className="text-sm mb-1.5 block">Nome</Label>
              <Input
                value={newModule.nome}
                onChange={(e) =>
                  setNewModule((prev) => ({ ...prev, nome: e.target.value }))
                }
                className="bg-input border-border"
                placeholder="ex: CRM Avançado"
              />
            </div>
            <div>
              <Label className="text-sm mb-1.5 block">Descrição</Label>
              <Input
                value={newModule.descricao}
                onChange={(e) =>
                  setNewModule((prev) => ({
                    ...prev,
                    descricao: e.target.value,
                  }))
                }
                className="bg-input border-border"
                placeholder="Descrição do módulo..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={saving}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {saving ? 'Criando...' : 'Criar Módulo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Tab 2: Modules per Plan (Matrix) ───────────────────────────────────────────

function PlanModulesMatrixTab() {
  const { toast } = useToast();
  const [modules, setModules] = useState<SystemModule[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [features, setFeatures] = useState<PlanFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [modulesData, plansData, featuresData] = await Promise.all([
        getSystemModules(),
        getAllPlans(),
        getAllPlanFeatures(),
      ]);
      setModules(modulesData);
      setPlans(plansData);
      setFeatures(featuresData);
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Build a lookup: feature_codigo + plano_id -> PlanFeature
  function getFeature(
    featureCodigo: string,
    planoId: string,
  ): PlanFeature | undefined {
    return features.find(
      (f) => f.feature_codigo === featureCodigo && f.plano_id === planoId,
    );
  }

  async function handleToggleFeature(feature: PlanFeature) {
    setTogglingId(feature.id);
    try {
      await updatePlanFeature(feature.id, !feature.habilitado, feature.limite ?? undefined);
      // Update local state immediately for responsiveness
      setFeatures((prev) =>
        prev.map((f) =>
          f.id === feature.id ? { ...f, habilitado: !f.habilitado } : f,
        ),
      );
      toast({
        title: `Feature "${feature.feature_nome}" ${!feature.habilitado ? 'habilitada' : 'desabilitada'}`,
      });
    } catch (err: any) {
      toast({
        title: 'Erro',
        description: err?.message,
        variant: 'destructive',
      });
    } finally {
      setTogglingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
        {error}
      </div>
    );
  }

  // Deduplicate module codes from features (some may not exist in modules table)
  const featureCodigosSet = new Set(features.map((f) => f.feature_codigo));
  const moduleCodigosSet = new Set(modules.map((m) => m.codigo));
  const allCodigos = Array.from(
    new Set([...moduleCodigosSet, ...featureCodigosSet]),
  ).sort();

  // Build a name lookup from modules + features
  const nameMap = new Map<string, string>();
  modules.forEach((m) => nameMap.set(m.codigo, m.nome));
  features.forEach((f) => {
    if (!nameMap.has(f.feature_codigo)) {
      nameMap.set(f.feature_codigo, f.feature_nome);
    }
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Configuração de features por plano. Cada célula controla se a feature
        está incluída no plano.
      </p>

      <div className="glass-card border border-border rounded-lg bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 bg-card z-10 min-w-[200px]">
                Feature
              </TableHead>
              {plans.map((plan) => (
                <TableHead
                  key={plan.id}
                  className="text-center min-w-[120px]"
                >
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="font-semibold">{plan.nome}</span>
                    <span className="text-[10px] text-muted-foreground font-normal">
                      R$ {plan.preco_mensal}/mês
                    </span>
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {allCodigos.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={plans.length + 1}
                  className="text-center text-muted-foreground py-8"
                >
                  Nenhuma feature configurada.
                </TableCell>
              </TableRow>
            ) : (
              allCodigos.map((codigo) => (
                <TableRow key={codigo}>
                  <TableCell className="sticky left-0 bg-card z-10 font-medium">
                    <div className="flex flex-col">
                      <span className="text-sm">
                        {nameMap.get(codigo) ?? codigo}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {codigo}
                      </span>
                    </div>
                  </TableCell>
                  {plans.map((plan) => {
                    const feature = getFeature(codigo, plan.id);
                    if (!feature) {
                      return (
                        <TableCell
                          key={plan.id}
                          className="text-center"
                        >
                          <span className="text-muted-foreground/40 text-xs">
                            \u2014
                          </span>
                        </TableCell>
                      );
                    }
                    const isToggling = togglingId === feature.id;
                    return (
                      <TableCell
                        key={plan.id}
                        className="text-center"
                      >
                        <button
                          onClick={() => handleToggleFeature(feature)}
                          disabled={isToggling}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:bg-muted disabled:opacity-50"
                          title={
                            feature.habilitado
                              ? 'Clique para desabilitar'
                              : 'Clique para habilitar'
                          }
                        >
                          {isToggling ? (
                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                          ) : feature.habilitado ? (
                            <Check className="w-5 h-5 text-green-500" />
                          ) : (
                            <X className="w-5 h-5 text-muted-foreground/40" />
                          )}
                        </button>
                        {feature.limite != null && (
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            Limite: {feature.limite}
                          </div>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── Tab 3: Org Overrides ───────────────────────────────────────────────────────

function OrgOverridesTab() {
  const { toast } = useToast();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<string>('');
  const [modules, setModules] = useState<SystemModule[]>([]);
  const [planFeatures, setPlanFeatures] = useState<PlanFeature[]>([]);
  const [overrides, setOverrides] = useState<OrgModuleOverride[]>([]);
  const [orgPlanName, setOrgPlanName] = useState<string>('');
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState('');
  const [togglingModule, setTogglingModule] = useState<string | null>(null);

  useEffect(() => {
    loadOrgs();
  }, []);

  async function loadOrgs() {
    setLoadingOrgs(true);
    try {
      const [orgsData, modulesData] = await Promise.all([
        getAllOrganizations(),
        getSystemModules(),
      ]);
      setOrgs(orgsData);
      setModules(modulesData);
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao carregar organizações');
    } finally {
      setLoadingOrgs(false);
    }
  }

  async function loadOrgDetails(org: string) {
    setLoadingDetails(true);
    setError('');
    setPlanFeatures([]);
    setOverrides([]);
    setOrgPlanName('');
    try {
      // Get the org's subscription to find its plan
      const subscription = await getOrgSubscription(org);
      let features: PlanFeature[] = [];
      if (subscription) {
        setOrgPlanName(subscription.plano_nome ?? '');
        features = await getPlanFeatures(subscription.plano_id);
      } else {
        setOrgPlanName('(sem assinatura)');
      }
      setPlanFeatures(features);

      const orgOverrides = await getOrgModuleOverrides(org);
      setOverrides(orgOverrides);
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao carregar detalhes da organização');
    } finally {
      setLoadingDetails(false);
    }
  }

  function handleSelectOrg(org: string) {
    setSelectedOrg(org);
    loadOrgDetails(org);
  }

  // For each module, determine plan-level setting and override
  function getModuleStatus(moduloCodigo: string) {
    const planFeature = planFeatures.find(
      (f) => f.feature_codigo === moduloCodigo,
    );
    const override = overrides.find((o) => o.modulo_codigo === moduloCodigo);

    const planEnabled = planFeature?.habilitado ?? false;
    const hasOverride = override !== undefined;
    const effectiveEnabled = hasOverride ? override.habilitado : planEnabled;

    return { planEnabled, hasOverride, overrideEnabled: override?.habilitado, effectiveEnabled };
  }

  async function handleToggleOverride(moduloCodigo: string) {
    if (!selectedOrg) return;
    setTogglingModule(moduloCodigo);
    try {
      const { hasOverride, effectiveEnabled } = getModuleStatus(moduloCodigo);

      if (!hasOverride) {
        // Create override with the opposite of the plan setting
        await setOrgModuleOverride(selectedOrg, moduloCodigo, !effectiveEnabled);
        toast({ title: `Override criado para "${moduloCodigo}"` });
      } else {
        // Toggle the existing override
        await setOrgModuleOverride(selectedOrg, moduloCodigo, !effectiveEnabled);
        toast({ title: `Override atualizado para "${moduloCodigo}"` });
      }

      // Reload overrides
      const updatedOverrides = await getOrgModuleOverrides(selectedOrg);
      setOverrides(updatedOverrides);
    } catch (err: any) {
      toast({
        title: 'Erro',
        description: err?.message,
        variant: 'destructive',
      });
    } finally {
      setTogglingModule(null);
    }
  }

  async function handleRemoveOverride(moduloCodigo: string) {
    if (!selectedOrg) return;
    setTogglingModule(moduloCodigo);
    try {
      await removeOrgModuleOverride(selectedOrg, moduloCodigo);
      toast({ title: `Override removido para "${moduloCodigo}"` });
      const updatedOverrides = await getOrgModuleOverrides(selectedOrg);
      setOverrides(updatedOverrides);
    } catch (err: any) {
      toast({
        title: 'Erro',
        description: err?.message,
        variant: 'destructive',
      });
    } finally {
      setTogglingModule(null);
    }
  }

  if (loadingOrgs) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-muted-foreground" />
          <Label className="text-sm font-medium">Organização:</Label>
        </div>
        <Select value={selectedOrg} onValueChange={handleSelectOrg}>
          <SelectTrigger className="w-full sm:w-[320px] bg-input border-border">
            <SelectValue placeholder="Selecione uma organização..." />
          </SelectTrigger>
          <SelectContent>
            {orgs.map((org) => (
              <SelectItem key={org.org} value={org.org}>
                {org.nome} ({org.org})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {orgPlanName && (
          <Badge
            variant="outline"
            className="border-red-500/30 text-red-400 text-xs"
          >
            Plano: {orgPlanName}
          </Badge>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {!selectedOrg ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          Selecione uma organização para ver e gerenciar overrides de módulos.
        </div>
      ) : loadingDetails ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="glass-card border border-border rounded-lg bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Módulo</TableHead>
                <TableHead className="text-center w-32">
                  Plano
                </TableHead>
                <TableHead className="text-center w-32">
                  Override
                </TableHead>
                <TableHead className="text-center w-32">
                  Resultado
                </TableHead>
                <TableHead className="text-center w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {modules.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-muted-foreground py-8"
                  >
                    Nenhum módulo cadastrado.
                  </TableCell>
                </TableRow>
              ) : (
                modules.map((mod) => {
                  const {
                    planEnabled,
                    hasOverride,
                    effectiveEnabled,
                  } = getModuleStatus(mod.codigo);
                  const isToggling = togglingModule === mod.codigo;

                  return (
                    <TableRow key={mod.codigo}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">
                            {mod.nome}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {mod.codigo}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {planEnabled ? (
                          <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                            Incluído
                          </Badge>
                        ) : (
                          <Badge
                            variant="secondary"
                            className="bg-muted text-muted-foreground"
                          >
                            Não incluído
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {hasOverride ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <Switch
                              checked={effectiveEnabled}
                              onCheckedChange={() =>
                                handleToggleOverride(mod.codigo)
                              }
                              disabled={isToggling}
                            />
                          </div>
                        ) : (
                          <button
                            onClick={() => handleToggleOverride(mod.codigo)}
                            disabled={isToggling}
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline"
                          >
                            {isToggling ? (
                              <Loader2 className="w-3 h-3 animate-spin inline" />
                            ) : (
                              'Herda do plano'
                            )}
                          </button>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {effectiveEnabled ? (
                          <Check className="w-5 h-5 text-green-500 mx-auto" />
                        ) : (
                          <X className="w-5 h-5 text-red-400 mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {hasOverride && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              handleRemoveOverride(mod.codigo)
                            }
                            disabled={isToggling}
                            title="Remover override (voltar para herança do plano)"
                            className="h-7 w-7 p-0"
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-muted-foreground" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────────

export default function SAModulesPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <Puzzle className="w-6 h-6 text-red-500" />
          Módulos & Features
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gerencie módulos do sistema, configuração por plano e overrides por
          organização.
        </p>
      </div>

      <Tabs defaultValue="modules" className="w-full">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="modules">Módulos do Sistema</TabsTrigger>
          <TabsTrigger value="plan-matrix">Módulos por Plano</TabsTrigger>
          <TabsTrigger value="overrides">Overrides por Org</TabsTrigger>
        </TabsList>

        <TabsContent value="modules">
          <SystemModulesTab />
        </TabsContent>

        <TabsContent value="plan-matrix">
          <PlanModulesMatrixTab />
        </TabsContent>

        <TabsContent value="overrides">
          <OrgOverridesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
