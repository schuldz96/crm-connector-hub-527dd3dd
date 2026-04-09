import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSuperAdminAuth } from '@/contexts/SuperAdminAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, Mail, Lock, Eye, EyeOff } from 'lucide-react';

export default function SuperAdminLoginPage() {
  const navigate = useNavigate();
  const { login } = useSuperAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Preencha todos os campos');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/super-admin/dashboard');
    } catch (err: any) {
      setError(err?.message ?? 'Credenciais invalidas. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-background flex items-center justify-center p-4"
      style={{
        background:
          'radial-gradient(800px 400px at 50% 30%, hsl(0 70% 20% / 0.15), transparent 60%), hsl(var(--background))',
      }}
    >
      <div className="w-full max-w-md">
        <div className="glass-card p-8 border border-border rounded-lg bg-card">
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-xl bg-red-500/10 flex items-center justify-center mb-4">
              <Shield className="w-7 h-7 text-red-500" />
            </div>
            <h1 className="text-2xl font-display font-bold">LTX Super Admin</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Acesso restrito ao painel administrativo
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="sa-email" className="text-sm font-medium mb-1.5 block">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="sa-email"
                  type="email"
                  placeholder="admin@ltx.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-11 bg-input border-border"
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="sa-password" className="text-sm font-medium mb-1.5 block">
                Senha
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="sa-password"
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

            {error && (
              <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="w-full h-11 bg-red-600 hover:bg-red-700 text-white font-semibold"
              disabled={loading}
            >
              {loading ? 'Autenticando...' : 'Entrar como Super Admin'}
            </Button>
          </form>

          <div className="mt-6 p-3 rounded-lg bg-red-500/5 border border-red-500/20">
            <p className="text-[11px] text-muted-foreground text-center">
              Este painel e restrito a administradores da plataforma LTX. Tentativas de acesso nao
              autorizado serao registradas.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
