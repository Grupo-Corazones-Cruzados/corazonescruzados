'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { accessRoleOf, canAccess, defaultDashboardPath } from '@/lib/dashboard/access';

/**
 * Refuerza los accesos estáticos por rol al navegar dentro del dashboard: si el rol
 * efectivo del usuario no puede acceder a la ruta actual, lo redirige a su página de
 * aterrizaje válida. Va DENTRO de AuthGuard (el usuario ya está cargado). No sustituye
 * la autorización del backend en los endpoints sensibles; es el control de navegación.
 */
export default function DashboardAccessGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const role = accessRoleOf(user);
  const allowed = canAccess(role, pathname);

  useEffect(() => {
    if (user && !allowed) router.replace(defaultDashboardPath(role));
  }, [user, allowed, role, router]);

  // Evita destellar contenido no permitido mientras se redirige.
  if (user && !allowed) return null;

  return <>{children}</>;
}
