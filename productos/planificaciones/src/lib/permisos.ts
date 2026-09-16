import type { RolUsuario } from '@/generated/prisma/enums';

/**
 * Dos oficios: el ADMINISTRADOR es el cliente (la institución) y los PROFESORES
 * planifican. El permiso se pide por CAPACIDAD, como en pedidos y catering, para
 * que el menú se arme con ellas y que quien abra una pantalla ajena vuelva a la
 * suya y no a un error. El administrador también planifica: es lo normal que el
 * coordinador que compró el producto quiera probarlo.
 */
export type Capacidad = 'ver' | 'planificar' | 'administrar';

const PERMISOS: Record<RolUsuario, Capacidad[]> = {
  ADMIN: ['ver', 'planificar', 'administrar'],
  PROFESOR: ['ver', 'planificar'],
};

export const puede = (rol: RolUsuario, capacidad: Capacidad) => PERMISOS[rol].includes(capacidad);

export const ETIQUETA_ROL: Record<RolUsuario, string> = {
  ADMIN: 'Administrador',
  PROFESOR: 'Profesor',
};

export const QUE_HACE_ROL: Record<RolUsuario, string> = {
  ADMIN: 'Todo: planifica, crea las cuentas de los profesores y configura la marca.',
  PROFESOR: 'Crea planificaciones y las descarga en PDF. Ve las de los demás, no las cambia.',
};

/** La pantalla a la que se manda a cada oficio al entrar. */
export const INICIO_DE_ROL: Record<RolUsuario, string> = {
  ADMIN: 'panel',
  PROFESOR: 'panel',
};
