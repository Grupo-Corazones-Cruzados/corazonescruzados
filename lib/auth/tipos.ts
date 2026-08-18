/**
 * LOS TRES TIPOS DE CUENTA, y por qué cada uno entra por su propia puerta.
 *
 * ── EL PROBLEMA ────────────────────────────────────────────────────────────────
 * Había **una sola** pantalla de acceso para todos. Funcionaba, pero no distinguía nada:
 * un candidato entraba por la misma puerta que un cliente y que un miembro del proyecto.
 * Eso tiene dos costes. Uno para quien entra —no sabe si esa pantalla es la suya, y si se
 * equivoca de cuenta el error llega tarde y sin explicación—. Y otro para nosotros: no se
 * puede decir «este enlace es el de tus clientes» si el enlace es el mismo para todo el
 * mundo.
 *
 * ── LA DISTINCIÓN, QUE NO ES EL ROL A SECAS ───────────────────────────────────
 * ⚠️ **Cliente y candidato comparten `role = 'client'`.** Lo que los separa es
 * `clients.account_type`. Mirar solo el rol —como hacía la comprobación anterior— deja
 * pasar a un candidato por la puerta de clientes. Es la misma regla que ya usa
 * `accessRoleOf` en `lib/dashboard/access.ts` para decidir qué módulos ve cada uno; aquí
 * se aplica en la entrada.
 */

export type TipoCuenta = 'cliente' | 'miembro' | 'candidato';

export interface PerfilAcceso {
  tipo: TipoCuenta;
  /** Lo que se lee en la pantalla. */
  titulo: string;
  subtitulo: string;
  /** La frase bajo «Inicia sesión»: dice por qué puerta se está entrando. */
  subtituloAcceso: string;
  /** Qué se ofrece a quien llega y no tiene cuenta. */
  altaTexto?: string;
  altaHref?: string;
  /** El mensaje cuando la cuenta existe pero es de otro tipo. Dice a dónde ir. */
  mensajeTipoIncorrecto: string;
}

export const PERFILES: Record<TipoCuenta, PerfilAcceso> = {
  cliente: {
    tipo: 'cliente',
    titulo: 'Acceso de clientes',
    subtitulo: 'Entra a tu panel para ver tus automatizaciones, tu bandeja y tus servicios.',
    subtituloAcceso: 'Ya tienes una cuenta de cliente. Ingresa para continuar.',
    altaTexto: '¿Tu empresa aún no tiene cuenta? Solicítala',
    // `/negocio#contacto` → `/clientes`: la sección se renombró el 2026-08-17 y el ancla
    // `#contacto` no existe desde que se vació la página el 2026-08-04.
    altaHref: '/clientes',
    mensajeTipoIncorrecto:
      'Esta cuenta no es de cliente. Si eres miembro del proyecto entra por /auth/miembro; si estás postulando, por /auth/candidato.',
  },
  miembro: {
    tipo: 'miembro',
    titulo: 'Acceso de miembros',
    subtitulo: 'Entra al espacio de trabajo del Grupo Corazones Cruzados.',
    subtituloAcceso: 'Ya tienes una cuenta de miembro. Ingresa para continuar.',
    mensajeTipoIncorrecto:
      'Esta cuenta no es de miembro. Si eres cliente entra por /auth/cliente; si estás postulando, por /auth/candidato.',
  },
  candidato: {
    tipo: 'candidato',
    titulo: 'Acceso de candidatos',
    subtitulo: 'Entra para seguir tu postulación al proyecto.',
    subtituloAcceso: 'Ya tienes una cuenta de candidato. Ingresa para continuar.',
    altaTexto: '¿Todavía no te postulas? Empieza aquí',
    altaHref: '/',
    mensajeTipoIncorrecto:
      'Esta cuenta no es de candidato. Si eres cliente entra por /auth/cliente; si eres miembro, por /auth/miembro.',
  },
};

export function esTipoValido(v: string | undefined): v is TipoCuenta {
  return v === 'cliente' || v === 'miembro' || v === 'candidato';
}

/**
 * ¿Esta cuenta puede entrar por esta puerta?
 *
 * `accountType` sale de `clients.account_type` y puede venir nulo: una cuenta de rol
 * `client` sin ficha de cliente se trata como **cliente**, no como candidato — es el mismo
 * criterio que `accessRoleOf`, y equivocarlo aquí sería dejar fuera a alguien que sí debe
 * entrar.
 *
 * Los **administradores entran por cualquier puerta** a propósito: operan la plataforma y
 * necesitan poder mirar lo que ve cada tipo sin tener tres cuentas.
 */
export function cuentaEncaja(
  tipo: TipoCuenta,
  { role, accountType }: { role: string; accountType?: string | null },
): boolean {
  if (role === 'admin') return true;
  if (tipo === 'miembro') return role === 'member';
  if (role !== 'client') return false;
  const esCandidato = accountType === 'candidate';
  return tipo === 'candidato' ? esCandidato : !esCandidato;
}
