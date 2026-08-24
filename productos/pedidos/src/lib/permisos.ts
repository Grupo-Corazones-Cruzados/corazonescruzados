import type { RolUsuario } from '@/generated/prisma/enums';

/**
 * ⚠️ AQUÍ LOS ROLES NO SON UNA ESCALERA.
 *
 * En el producto de reservas los permisos se ordenaban (ADMIN > GERENTE > CONSULTA)
 * y bastaba con pedir «al menos GERENTE». Aquí no vale: un **cocinero** no es un
 * mesero con menos permisos ni con más — es **otro oficio**. El cocinero marca
 * platos que salen y no cobra; el mesero cobra y no entra a la cocina.
 *
 * Así que el permiso se pide por CAPACIDAD, no por rango.
 */
export type Capacidad =
  | 'ver'
  | 'operar-mesas'
  | 'tomar-pedidos'
  | 'cocinar'
  | 'cobrar'
  | 'reservar-mesas'
  | 'administrar';

const PERMISOS: Record<RolUsuario, Capacidad[]> = {
  ADMIN: ['ver', 'operar-mesas', 'tomar-pedidos', 'cocinar', 'cobrar', 'reservar-mesas', 'administrar'],
  MESERO: ['ver', 'operar-mesas', 'tomar-pedidos', 'cobrar', 'reservar-mesas'],
  // El cocinero ve la cocina y marca lo que sale. Nada más: no cobra, no toca el
  // catálogo y no da de alta cuentas.
  COCINERO: ['ver', 'cocinar'],
};

export const puede = (rol: RolUsuario, capacidad: Capacidad) => PERMISOS[rol].includes(capacidad);

export const ETIQUETA_ROL: Record<RolUsuario, string> = {
  ADMIN: 'Administrador',
  MESERO: 'Mesero',
  COCINERO: 'Cocinero',
};

export const QUE_HACE_ROL: Record<RolUsuario, string> = {
  ADMIN: 'Todo: catálogo, mesas, pedidos, cobro, cuentas y marca del negocio.',
  MESERO: 'Atiende mesas, toma pedidos, sirve, cobra y gestiona reservas.',
  COCINERO: 'Ve los pedidos por mesa y marca lo que va saliendo. No cobra.',
};

/** La pantalla a la que se manda a cada rol al entrar: su puesto de trabajo. */
export const INICIO_DE_ROL: Record<RolUsuario, string> = {
  ADMIN: 'panel',
  MESERO: 'panel',
  COCINERO: 'cocina',
};
