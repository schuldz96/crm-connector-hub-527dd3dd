import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useGoogleLogin } from '@react-oauth/google';
import { GOOGLE_CLIENT_ID } from '@/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Eye, EyeOff, Mail, Lock, TrendingUp, BarChart3, MessageSquare, Brain, ShieldCheck } from 'lucide-react';
import heroBg from '@/assets/hero-bg.jpg';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Read error from URL (e.g. after Google callback failure)
  const urlError = new URLSearchParams(window.location.search).get('error');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError('Preencha todos os campos'); return; }
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err?.message ?? 'Credenciais inválidas. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Use redirect mode to avoid iframe popup blocking
  const googleLogin = useGoogleLogin({
    ux_mode: 'redirect',
    redirect_uri: `${window.location.origin}/auth/google/callback`,
    scope: 'openid email profile',
    hosted_domain: 'appmax.com.br',
    // onSuccess / onError are not called in redirect mode
    onError: () => {
      setError('Erro ao iniciar autenticação com Google.');
      setLoading(false);
    },
  });

  const handleGoogle = () => {
    if (!GOOGLE_CLIENT_ID) {
      setError('Google OAuth não configurado. Fale com o administrador.');
      return;
    }
    setError('');
    setLoading(true);
    googleLogin();
  };

  const features = [
    { icon: BarChart3, label: 'Análise de Performance', desc: 'Dashboards em tempo real' },
    { icon: Brain, label: 'IA para Vendas', desc: 'Análise automática de reuniões' },
    { icon: MessageSquare, label: 'WhatsApp Analytics', desc: 'Monitore conversas' },
    { icon: TrendingUp, label: 'Revenue Intelligence', desc: 'Insights que convertem' },
  ];

  const displayError = error || (urlError === 'google_failed' ? 'Falha na autenticação com Google. Tente novamente.' : urlError === 'not_authorized' ? 'Conta Google não autorizada para esta plataforma.' : '');

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div
        className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12"
        style={{ backgroundImage: `url(${heroBg})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
      >
        <div className="absolute inset-0 bg-background/70" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-display font-bold">Appmax</span>
          </div>
          <div className="mb-10">
            <h1 className="text-4xl font-display font-bold mb-4 leading-tight">
              Revenue Intelligence<br />
              <span className="gradient-text">para equipes de elite.</span>
            </h1>
            <p className="text-muted-foreground text-lg">
              Analise reuniões, conversas e performance comercial com IA.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {features.map((f) => (
              <div key={f.label} className="glass-card p-4">
                <f.icon className="w-5 h-5 mb-2" style={{ color: 'hsl(var(--primary))' }} />
                <p className="text-sm font-semibold">{f.label}</p>
                <p className="text-xs text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="relative z-10 flex items-center gap-6 text-xs text-muted-foreground">
          <span>© 2026 Appmax</span>
          <span>·</span>
          <span>Privacidade</span>
          <span>·</span>
          <span>Termos</span>
        </div>
      </div>

      {/* Right panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md animate-fade-in">
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-display font-bold">Appmax</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-display font-bold mb-1">Bem-vindo de volta</h2>
            <p className="text-muted-foreground text-sm">Acesse sua conta para continuar</p>
          </div>

          {/* Google OAuth — redirect mode */}
          <Button
            variant="outline"
            className="w-full mb-6 h-11 font-medium border-border hover:bg-secondary"
            onClick={handleGoogle}
            disabled={loading}
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {loading ? 'Redirecionando...' : 'Continuar com Google'}
          </Button>

          <div className="flex items-center gap-4 mb-6">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">ou use seu email</span>
            <Separator className="flex-1" />
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label htmlFor="email" className="text-sm font-medium mb-1.5 block">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@appmax.com.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-11 bg-input border-border"
                  disabled={loading}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label htmlFor="password" className="text-sm font-medium">Senha</Label>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 h-11 bg-input border-border"
                  disabled={loading}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPass(!showPass)}
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {displayError && (
              <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                {displayError}
              </p>
            )}
            <Button
              type="submit"
              className="w-full h-11 bg-gradient-primary font-semibold"
              disabled={loading}
            >
              {loading ? 'Entrando...' : 'Entrar na plataforma'}
            </Button>
          </form>

          <div className="mt-8 p-4 rounded-lg bg-primary/5 border border-primary/20">
            <p className="text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-primary" /> Acesso restrito
            </p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Esta plataforma é exclusiva para colaboradores com e-mail <strong>@appmax.com.br</strong>. Contas de outros domínios serão bloqueadas automaticamente.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
