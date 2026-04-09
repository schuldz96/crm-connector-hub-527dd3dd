import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, getDefaultRoute } from '@/contexts/AuthContext';

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
          navigate('/login', { replace: true });
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
        <img src="/appmax-favicon.png" alt="LTX" className="w-12 h-12 rounded-xl animate-pulse" />
        <p className="text-sm text-muted-foreground">{status}</p>
      </div>
    </div>
  );
}
