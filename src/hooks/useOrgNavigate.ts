import { useCallback } from 'react';
import { useNavigate, useLocation, type NavigateOptions } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Wraps useNavigate to automatically prepend /{org} to absolute paths.
 *
 * navigate('/dashboard')  -> /{org}/dashboard
 * navigate(-1)            -> normal back
 * navigate('/login')      -> /login (excluded — public route)
 */

const PUBLIC_PREFIXES = ['/login', '/auth/', '/f/', '/lp/', '/super-admin'];

export function useOrgNavigate() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const org = user?.org;

  return useCallback(
    (to: string | number, options?: NavigateOptions) => {
      if (typeof to === 'number') return navigate(to);

      if (to.startsWith('/') && org) {
        const isPublic = PUBLIC_PREFIXES.some((p) => to.startsWith(p));
        const alreadyPrefixed = to.startsWith(`/${org}/`) || to === `/${org}`;
        if (!isPublic && !alreadyPrefixed) {
          return navigate(`/${org}${to}`, options);
        }
      }

      return navigate(to, options);
    },
    [navigate, org],
  );
}

/**
 * Returns location.pathname with the /{org} prefix stripped,
 * so downstream code can compare against canonical paths like '/dashboard'.
 */
export function usePathWithoutOrg(): string {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const org = user?.org;
  if (org && pathname.startsWith(`/${org}`)) {
    return pathname.slice(`/${org}`.length) || '/';
  }
  return pathname;
}
