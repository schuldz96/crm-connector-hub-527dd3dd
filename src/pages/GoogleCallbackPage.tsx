import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { TrendingUp } from 'lucide-react';

export default function GoogleCallbackPage() {
  const navigate = useNavigate();
  const { loginWithGoogle } = useAuth();
  const [status, setStatus] = useState('Autenticando com Google...');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Implicit flow: access_token comes in the URL fragment (#access_token=...)
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');

        // Auth-code flow: code comes in query params (?code=...)
        const searchParams = new URLSearchParams(window.location.search);
        const code = searchParams.get('code');
        const error = searchParams.get('error');

        if (error) {
          setStatus('Autenticação cancelada.');
          setTimeout(() => navigate('/login', { replace: true }), 2000);
          return;
        }

        if (accessToken) {
          const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (!res.ok) throw new Error('Falha ao buscar dados do Google.');
          const info = await res.json();
          await loginWithGoogle({ email: info.email, name: info.name, picture: info.picture });
          navigate('/dashboard', { replace: true });
          return;
        }

        if (code) {
          // For auth-code flow we'd need to exchange on backend; redirect to login with error
          setStatus('Fluxo de autenticação não suportado neste modo.');
          setTimeout(() => navigate('/login', { replace: true }), 3000);
          return;
        }

        // No token found — likely direct navigation to this URL
        navigate('/login', { replace: true });
      } catch (err: any) {
        setStatus(err?.message ?? 'Erro ao autenticar. Tente novamente.');
        setTimeout(() => navigate('/login', { replace: true }), 3000);
      }
    };

    handleCallback();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center animate-pulse">
          <TrendingUp className="w-6 h-6 text-primary-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">{status}</p>
      </div>
    </div>
  );
}
