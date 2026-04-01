import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Search, ChevronRight, Home } from 'lucide-react';
import NotificationBell from '@/components/NotificationBell';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/dashboard':    { title: 'Dashboard',       subtitle: 'Visão geral de performance' },
  '/meetings':     { title: 'Reuniões',         subtitle: 'Gerencie e analise suas reuniões comerciais' },
  '/whatsapp':     { title: 'WhatsApp',         subtitle: 'Instâncias e conversas' },
  '/teams':        { title: 'Times',            subtitle: 'Gerencie equipes e performance' },
  '/users':        { title: 'Usuários',         subtitle: 'Gestão de acesso e permissões' },
  '/reports':      { title: 'Relatórios',       subtitle: 'Análises e exportações' },
  '/integrations': { title: 'Integrações',      subtitle: 'Conecte ferramentas externas' },
  '/automations':  { title: 'Alertas & Webhooks', subtitle: 'Configure alertas internos e integrações' },
  '/admin':        { title: 'Painel Admin',     subtitle: 'Configurações globais da plataforma' },
  '/performance':  { title: 'Desempenho',       subtitle: 'Acompanhe métricas de performance' },
  '/training':     { title: 'Treinamentos',     subtitle: 'Simulações e aprendizado' },
  '/ai-config':    { title: 'Config. IA',       subtitle: 'Modelos e tokens de inteligência artificial' },
  '/me':           { title: 'Meu Perfil',       subtitle: 'Informações da sua conta e atalhos' },
};

export default function AppTopBar() {
  const { user, logout, canAccess } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useState('');
  const page = PAGE_TITLES[location.pathname] || { title: 'Appmax', subtitle: '' };
  const routes = useMemo(
    () =>
      Object.entries(PAGE_TITLES).map(([path, meta]) => ({
        path,
        title: meta.title,
        subtitle: meta.subtitle,
      })),
    []
  );
  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return routes.filter(
      (r) => r.title.toLowerCase().includes(q) || r.subtitle.toLowerCase().includes(q) || r.path.includes(q)
    );
  }, [search, routes]);

  return (
    <header className="h-14 border-b border-border flex items-center justify-between px-6 gap-4 flex-shrink-0 bg-background/80 backdrop-blur-sm">
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Home className="w-3 h-3" />
          <ChevronRight className="w-3 h-3" />
          <span className="text-foreground font-medium">{page.title}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative hidden md:flex items-center">
          <Search className="absolute left-3 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar páginas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && searchResults[0]) {
                navigate(searchResults[0].path);
                setSearch('');
              }
            }}
            className="pl-9 h-8 w-56 text-xs bg-secondary border-border focus:w-72 transition-all duration-200"
          />
          {searchResults.length > 0 && (
            <div className="absolute top-10 right-0 w-72 rounded-lg border border-border bg-card shadow-lg z-20 p-1">
              {searchResults.slice(0, 6).map((r) => (
                <button
                  key={r.path}
                  onClick={() => {
                    navigate(r.path);
                    setSearch('');
                  }}
                  className="w-full text-left px-2 py-1.5 rounded-md hover:bg-muted text-xs"
                >
                  <p className="font-medium text-foreground">{r.title}</p>
                  <p className="text-muted-foreground">{r.path}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        <NotificationBell />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="rounded-full border border-border overflow-hidden">
              <img
                src={user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.name}`}
                alt={user?.name}
                className="w-8 h-8 rounded-full"
              />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={() => navigate('/users')}>Meu perfil</DropdownMenuItem>
            {canAccess('admin') && (
              <DropdownMenuItem onClick={() => navigate('/admin')}>Administrador</DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
              Sair da conta
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
