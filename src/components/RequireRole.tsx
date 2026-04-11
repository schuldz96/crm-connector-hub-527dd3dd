/**
 * RequireRole — Guard de segurança para rotas protegidas por cargo.
 *
 * Uso no router:
 *   <Route path="/admin" element={<RequireRole minRole="admin"><AdminPage /></RequireRole>} />
 *   <Route path="/teams" element={<RequireRole resource="teams"><TeamsPage /></RequireRole>} />
 *
 * Dupla verificação:
 *   1. minRole — exige cargo mínimo na hierarquia (admin > ceo > director > ...)
 *   2. resource — verifica se o cargo tem acesso ao recurso (usa permissoes_papeis)
 *   Basta satisfazer UMA das condições se ambas forem fornecidas.
 */
import { Navigate } from 'react-router-dom';
import { useAuth, getDefaultRoute } from '@/contexts/AuthContext';
import type { UserRole } from '@/types';

interface RequireRoleProps {
  children: React.ReactNode;
  /** Cargo mínimo necessário (usa ROLE_HIERARCHY) */
  minRole?: UserRole;
  /** Recurso que o cargo deve ter acesso (usa canAccess) */
  resource?: string;
}

export default function RequireRole({ children, minRole, resource }: RequireRoleProps) {
  const { user, isAuthenticated, hasMinRole, canAccess } = useAuth();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // Verificar permissão
  let allowed = false;

  if (minRole && hasMinRole(minRole)) {
    allowed = true;
  }

  if (resource && canAccess(resource)) {
    allowed = true;
  }

  // Se nenhuma restrição foi definida, permitir (fallback para ProtectedRoutes)
  if (!minRole && !resource) {
    allowed = true;
  }

  if (!allowed) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <svg className="w-8 h-8 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v.01M12 9v2m0 8a9 9 0 110-18 9 9 0 010 18z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold">Acesso negado</h2>
        <p className="text-sm text-muted-foreground text-center max-w-md">
          Você não tem permissão para acessar esta página.
          Entre em contato com o administrador se acredita que isso é um erro.
        </p>
        <a
          href={`/${user.org}${getDefaultRoute(user.role)}`}
          className="text-sm text-primary hover:underline mt-2"
        >
          Voltar para a página inicial
        </a>
      </div>
    );
  }

  return <>{children}</>;
}
