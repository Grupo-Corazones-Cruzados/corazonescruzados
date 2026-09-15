import type { RolUsuario } from '@/generated/prisma/enums';

/**
 * ⚠️ AQUÍ LOS ROLES NO SON UNA ESCALERA (Fernando, 2026-09-15).
 *
 * Quien está en la cocina arma menús e imprime etiquetas; quien despacha arma las
 * rutas y cuida a los motorizados. Ninguno es «un administrador con menos
 * permisos»: son otros trabajos. Así que el permiso se pide por CAPACIDAD, no
 * por rango, y el menú se arma con ellas: cada quien ve su puesto.
 */
export type Capacidad =
  | 'ver'
  | 'clientes'
  | 'servicios'
  | 'cocina'
  | 'despacho'
  | 'reportes'
  | 'administrar';

const PERMISOS: Record<RolUsuario, Capacidad[]> = {
  ADMIN: ['ver', 'clientes', 'servicios', 'cocina', 'despacho', 'reportes', 'administrar'],
  // Cocina: alimentos, menús, etiquetas y restricciones. Nada de clientes ni cuentas.
  COCINA: ['ver', 'cocina'],
  // Despacho: rutas y motorizados.
  DESPACHO: ['ver', 'despacho'],
};

export const puede = (rol: RolUsuario, capacidad: Capacidad) => PERMISOS[rol].includes(capacidad);

export const ETIQUETA_ROL: Record<RolUsuario, string> = {
  ADMIN: 'Administrador',
  COCINA: 'Cocina',
  DESPACHO: 'Despacho',
};

export const QUE_HACE_ROL: Record<RolUsuario, string> = {
  ADMIN: 'Todo: clientes, servicios, cocina, despacho, reportes, cuentas y marca.',
  COCINA: 'Alimentos, menú del día, etiquetas y restricciones. No ve clientes ni cuentas.',
  DESPACHO: 'Hojas de ruta y motorizados. No ve la cocina ni los clientes.',
};

/** La pantalla a la que se manda a cada oficio al entrar: su puesto de trabajo. */
export const INICIO_DE_ROL: Record<RolUsuario, string> = {
  ADMIN: 'panel',
  COCINA: 'menus',
  DESPACHO: 'rutas',
};
