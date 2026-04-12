import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllPlans, createOrganization, createSubscription, inviteUserToOrg } from '@/lib/superAdminService';
import type { Plan } from '@/lib/superAdminService';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Check, Zap, Crown, Building2, Gift, ArrowRight, ArrowLeft } from 'lucide-react';

type Step = 'plans' | 'form' | 'success';

export default function SignupPage() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>('plans');

  // Selection
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [ciclo, setCiclo] = useState<'mensal' | 'anual'>('mensal');

  // Form
  const [empresa, setEmpresa] = useState('');
  const [dominio, setDominio] = useState('');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [createdOrg, setCreatedOrg] = useState('');

  useEffect(() => {
    getAllPlans().then(data => {
      // Sem Free: apenas planos pagos (todos comecam em trial)
      setPlans(
        data
          .filter(p => p.ativo && p.codigo !== 'free')
          .sort((a, b) => (a.preco_mensal ?? 0) - (b.preco_mensal ?? 0))
      );
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const planIcons = [Gift, Zap, Crown, Building2];

  const isEnterprise = (plan: Plan | null) => plan?.codigo === 'enterprise';

  async function handleSubmit() {
    if (!empresa.trim()) { setError('Nome da empresa e obrigatorio'); return; }
    if (!nome.trim()) { setError('Seu nome e obrigatorio'); return; }
    if (!email.trim()) { setError('Email e obrigatorio'); return; }
    const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRx.test(email.trim())) { setError('Email invalido'); return; }
    if (!selectedPlan) return;
    setError('');
    setSaving(true);
    try {
      const org = await createOrganization({
        nome: empresa.trim(),
        dominio: dominio.trim() || undefined,
        ativo: true,
      });

      // Starter/Pro: trial de 7 dias. Enterprise: sem trial (ativa direta).
      const hasTrialOffer = !isEnterprise(selectedPlan);
      const trialAte = hasTrialOffer
        ? (() => {
            const d = new Date();
            d.setDate(d.getDate() + 7);
            return d.toISOString().slice(0, 10);
          })()
        : undefined;

      await createSubscription({
        org: org.org,
        plano_id: selectedPlan.id,
        ciclo,
        status: hasTrialOffer ? 'trial' : 'ativa',
        trial_ate: trialAte,
      });

      // Envia magic link pro admin recem-criado
      await inviteUserToOrg({
        email: email.trim().toLowerCase(),
        nome: nome.trim(),
        papel: 'admin',
        empresa_id: org.id,
        org: org.org,
      });

      setCreatedOrg(org.org);
      setStep('success');
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao criar conta');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <div className="w-12 h-12 rounded-xl bg-red-500 flex items-center justify-center">
          <Zap className="w-6 h-6 text-white" />
        </div>
        <Loader2 className="w-6 h-6 animate-spin text-red-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/60 backdrop-blur-sm bg-background/80 sticky top-0 z-10 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/20">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-display font-bold text-lg tracking-tight">LTX</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>
            Ja tem conta? Entrar
          </Button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center py-12 px-6">
        <div className="max-w-6xl w-full mx-auto">

          {/* Step 1: Choose Plan */}
          {step === 'plans' && (
            <div className="space-y-10">
              <div className="text-center max-w-2xl mx-auto">
                <h1 className="text-4xl sm:text-5xl font-display font-bold tracking-tight">Escolha seu plano</h1>
                <p className="text-muted-foreground mt-4 text-base leading-relaxed">
                  7 dias grátis nos planos Starter e Pro · 2 meses grátis no anual
                  <br className="hidden sm:inline" />
                  <span className="sm:hidden"> · </span>
                  Cancele quando quiser · Sem cartão de crédito
                </p>
              </div>

              {/* Ciclo toggle */}
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setCiclo('mensal')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${ciclo === 'mensal' ? 'bg-red-500 text-white' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
                >
                  Mensal
                </button>
                <button
                  onClick={() => setCiclo('anual')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${ciclo === 'anual' ? 'bg-red-500 text-white' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
                >
                  Anual <Badge className="ml-1 bg-green-500/10 text-green-400 border-green-500/20 text-[10px]">2 meses gratis</Badge>
                </button>
              </div>

              {/* Plan cards */}
              <div className={`grid gap-5 justify-items-stretch ${
                plans.length === 3
                  ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto'
                  : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
              }`}>
                {plans.map((plan, idx) => {
                  const Icon = planIcons[idx % planIcons.length];
                  const isSelected = selectedPlan?.id === plan.id;
                  const planIsEnterprise = plan.codigo === 'enterprise';
                  const hasTrial = !planIsEnterprise;
                  // Pro mais popular
                  const isPopular = plan.codigo === 'pro';

                  return (
                    <div
                      key={plan.id}
                      onClick={() => setSelectedPlan(plan)}
                      className={`relative p-6 rounded-2xl border-2 cursor-pointer transition-all duration-200 flex flex-col hover:shadow-xl hover:-translate-y-1 ${
                        isSelected
                          ? 'border-red-500 bg-red-500/[0.04] shadow-xl shadow-red-500/10 ring-2 ring-red-500/20'
                          : 'border-border bg-card hover:border-muted-foreground/40'
                      }`}
                    >
                      {isPopular && (
                        <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-red-500 text-white border-0 text-xs">
                          Mais popular
                        </Badge>
                      )}
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isSelected ? 'bg-red-500/10' : 'bg-muted'}`}>
                          <Icon className={`w-5 h-5 ${isSelected ? 'text-red-500' : 'text-muted-foreground'}`} />
                        </div>
                        <div>
                          <h3 className="font-display font-bold">{plan.nome}</h3>
                          {plan.descricao && <p className="text-xs text-muted-foreground">{plan.descricao}</p>}
                        </div>
                      </div>

                      <div className="mb-4 min-h-[92px]">
                        {ciclo === 'anual' ? (
                          (() => {
                            const anualEquivalente = (plan.preco_anual ?? 0) / 12;
                            const economia = (plan.preco_mensal ?? 0) * 12 - (plan.preco_anual ?? 0);
                            return (
                              <>
                                {/* Preço mensal riscado */}
                                <p className="text-xs text-muted-foreground line-through mb-0.5">
                                  De R$ {plan.preco_mensal?.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}/mes
                                </p>
                                {/* Equivalente mensal em destaque */}
                                <div className="flex items-baseline gap-1">
                                  <span className="text-3xl font-display font-bold">
                                    R$ {anualEquivalente.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                  </span>
                                  <span className="text-muted-foreground text-sm">/mes</span>
                                </div>
                                {/* Preço anual total */}
                                <p className="text-[11px] text-muted-foreground mt-1">
                                  Cobrado R$ {plan.preco_anual?.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}/ano
                                </p>
                                {/* Badge de economia */}
                                <p className="text-[11px] text-green-400 font-medium mt-0.5">
                                  Economize R$ {economia.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}/ano
                                </p>
                              </>
                            );
                          })()
                        ) : (
                          <>
                            <div className="flex items-baseline gap-1">
                              <span className="text-3xl font-display font-bold">
                                R$ {plan.preco_mensal?.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                              </span>
                              <span className="text-muted-foreground text-sm">/mes</span>
                            </div>
                            {plan.preco_por_usuario > 0 && (
                              <p className="text-xs text-muted-foreground mt-1">
                                + R$ {plan.preco_por_usuario?.toLocaleString('pt-BR')}/usuario adicional
                              </p>
                            )}
                          </>
                        )}
                      </div>

                      <ul className="space-y-2.5 text-sm flex-1">
                        <li className="flex items-center gap-2">
                          <Check className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                          <span>Até {plan.max_usuarios} usuários</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                          <span>{plan.max_avaliacoes_ia_mes} avaliações IA/mês</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                          <span>{plan.storage_mb >= 1000 ? `${(plan.storage_mb / 1000).toFixed(0)} GB` : `${plan.storage_mb} MB`} storage</span>
                        </li>
                      </ul>

                      <div className="mt-5 pt-4 border-t border-border/60">
                        {hasTrial ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-[11px] font-medium">
                            <Gift className="w-3 h-3" />
                            Experimente 7 dias grátis
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[11px] font-medium">
                            <Building2 className="w-3 h-3" />
                            Fale com nosso time
                          </div>
                        )}

                        {isSelected && (
                          <div className="mt-3 flex items-center text-red-500 text-sm font-medium">
                            <Check className="w-4 h-4 mr-1" /> Plano selecionado
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {selectedPlan && !isEnterprise(selectedPlan) && (
                <div className="text-center text-sm text-muted-foreground">
                  <Gift className="w-4 h-4 inline mr-1.5 text-yellow-400" />
                  Comece com <span className="text-yellow-400 font-medium">7 dias de trial gratis</span>. Sem cartao de credito.
                </div>
              )}
              {selectedPlan && isEnterprise(selectedPlan) && (
                <div className="text-center text-sm text-muted-foreground">
                  <Building2 className="w-4 h-4 inline mr-1.5 text-blue-400" />
                  Plano Enterprise e personalizado — nosso time entrara em contato apos o cadastro.
                </div>
              )}

              <div className="flex justify-center">
                <Button
                  onClick={() => setStep('form')}
                  disabled={!selectedPlan}
                  className="bg-red-600 hover:bg-red-700 text-white px-8"
                >
                  Proximo <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Company Form */}
          {step === 'form' && (
            <div className="max-w-md mx-auto space-y-6">
              <Button variant="ghost" size="sm" onClick={() => setStep('plans')} className="-ml-2">
                <ArrowLeft className="w-4 h-4 mr-2" /> Voltar aos planos
              </Button>

              <div className="text-center sm:text-left">
                <h2 className="text-3xl font-display font-bold tracking-tight">Dados da sua empresa</h2>
                <p className="text-muted-foreground text-sm mt-2">
                  Plano: <span className="font-medium text-foreground">{selectedPlan?.nome}</span>
                  {' · '}
                  {isEnterprise(selectedPlan)
                    ? 'Nosso time entrará em contato após o cadastro'
                    : `Trial 7 dias — depois R$ ${(ciclo === 'anual' ? selectedPlan?.preco_anual : selectedPlan?.preco_mensal)?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/${ciclo === 'anual' ? 'ano' : 'mês'}`}
                </p>
              </div>

              {error && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <Label className="text-sm mb-1.5 block">Nome da empresa *</Label>
                  <Input value={empresa} onChange={(e) => setEmpresa(e.target.value)} placeholder="Minha Empresa Ltda" className="bg-input border-border" />
                </div>
                <div>
                  <Label className="text-sm mb-1.5 block">Dominio</Label>
                  <Input value={dominio} onChange={(e) => setDominio(e.target.value)} placeholder="minhaempresa.com.br" className="bg-input border-border" />
                </div>
                <div>
                  <Label className="text-sm mb-1.5 block">Seu nome *</Label>
                  <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Joao Silva" className="bg-input border-border" />
                </div>
                <div>
                  <Label className="text-sm mb-1.5 block">Email corporativo *</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="joao@minhaempresa.com.br" className="bg-input border-border" />
                </div>
              </div>

              <Button onClick={handleSubmit} disabled={saving} className="w-full bg-red-600 hover:bg-red-700 text-white">
                {saving ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Criando conta...</>
                ) : isEnterprise(selectedPlan) ? (
                  'Criar conta e falar com vendas'
                ) : (
                  'Iniciar Trial Gratis (7 dias)'
                )}
              </Button>
            </div>
          )}

          {/* Step 3: Success */}
          {step === 'success' && (
            <div className="max-w-md mx-auto text-center space-y-6">
              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
                <Check className="w-8 h-8 text-green-400" />
              </div>
              <div>
                <h2 className="text-2xl font-display font-bold">Conta criada!</h2>
                <p className="text-muted-foreground mt-2">
                  Organizacao criada com o plano <span className="font-medium text-foreground">{selectedPlan?.nome}</span>
                  {isEnterprise(selectedPlan)
                    ? '. Nosso time comercial entrara em contato em breve.'
                    : '. Voce tem 7 dias de trial gratis.'}
                </p>
                <p className="text-sm text-muted-foreground mt-3">
                  Enviamos um email de acesso para <span className="font-medium text-foreground">{email}</span>. Abra o link para definir sua senha e entrar.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted/30 border border-border">
                <p className="text-xs text-muted-foreground">Sua Org Key</p>
                <p className="font-mono font-bold text-lg">{createdOrg}</p>
                <p className="text-[11px] text-muted-foreground mt-1">Guarde — voce precisara dela pra acessar</p>
              </div>
              <Button onClick={() => navigate('/login')} variant="outline">
                Ir para o Login
              </Button>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/60 px-6 py-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} LTX · Plataforma de CRM + IA</p>
          <div className="flex items-center gap-4">
            <button className="hover:text-foreground transition-colors">Termos</button>
            <button className="hover:text-foreground transition-colors">Privacidade</button>
            <button className="hover:text-foreground transition-colors">Suporte</button>
          </div>
        </div>
      </footer>
    </div>
  );
}
