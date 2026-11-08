'use client';

import { Eye } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { accessRoleOf, type AccessRole } from '@/lib/dashboard/access';

const mf = { fontFamily: 'var(--font-body)' } as const;

/** Etiqueta del rol efectivo (candidato/cliente/miembro/admin) para mostrar al usuario. */
export const ROLE_LABEL_ES: Record<AccessRole, string> = {
  candidate: 'Candidato',
  client: 'Cliente',
  member: 'Miembro',
  admin: 'Admin',
};

/**
 * LA FICHA DE LA CUENTA al pie de los menús laterales: foto (o inicial), nombre y rol. La comparten
 * el menú de Progreso (`DashboardSidebar`) y el de Accesos (`MenuAccesos`; Fernando, 2026-11-08:
 * «que siempre se vea la cuenta de usuario»). Con `alPulsar` es un botón (el administrador abre
 * «ver como otro usuario»); sin él, texto: nada de un botón muerto.
 */
export default function FichaUsuario({ estrecho, alPulsar }: { estrecho: boolean; alPulsar?: () => void }) {
  const { user } = useAuth();
  if (!user) return null;
  const rol = accessRoleOf(user);
  const contenido = (
    <>
      {user.avatar_url ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={user.avatar_url} alt="" className="w-8 h-8 rounded-full border border-digi-border object-cover shrink-0" />
      ) : (
        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-accent-light border border-accent/20 text-accent text-[12px] font-semibold shrink-0" style={mf}>
          {(user.first_name?.[0] || user.email[0]).toUpperCase()}
        </div>
      )}
      {!estrecho && (
        <div className="min-w-0 text-left">
          <p className="text-[12px] font-medium text-digi-text truncate" style={mf}>{user.first_name || user.email.split('@')[0]}</p>
          <p className="text-[10px] text-digi-muted" style={mf}>{ROLE_LABEL_ES[rol]}</p>
        </div>
      )}
      {alPulsar && !estrecho && <Eye className="w-3.5 h-3.5 text-digi-muted ml-auto shrink-0" />}
    </>
  );
  const clases = `flex items-center gap-2.5 mb-2 w-full ${estrecho ? 'justify-center' : ''}`;
  return alPulsar ? (
    <button type="button" onClick={alPulsar} title="Ver la plataforma como otro usuario"
      className={`${clases} rounded-md p-1 -m-1 transition-[filter] duration-150 hover:brightness-125`}>
      {contenido}
    </button>
  ) : (
    <div className={clases}>{contenido}</div>
  );
}
