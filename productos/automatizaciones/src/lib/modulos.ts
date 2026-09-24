import type { Rol } from '@/generated/prisma/enums';

/**
 * ⚠️ LA ESCALA DE ROLES VIVE AQUÍ, no en `lib/inquilino.ts`, y es por el navegador.
 *
 * `lib/inquilino.ts` arrastra Prisma y las cookies: importarlo desde `Navegacion` —que es
 * un componente de cliente— metería media base de datos en el paquete que descarga el
 * usuario. Este archivo es datos puros, así que lo pueden leer los dos lados. Allí se
 * reexporta `alMenos` para no cambiar a quien ya la usaba.
 *
 * En este producto los roles SÍ son una escalera: quien puede lo de arriba puede lo de
 * abajo.
 */
const ESCALA: Record<Rol, number> = { CONSULTA: 0, OPERADOR: 1, ADMIN: 2 };

export function alMenos(rol: Rol, minimo: Rol) {
  return ESCALA[rol] >= ESCALA[minimo];
}

/**
 * QUÉ ROL PIDE CADA MÓDULO — EN UN SOLO SITIO.
 *
 * ── POR QUÉ EXISTE (Fernando, 2026-09-24) ────────────────────────────────────────
 * «Estoy tratando de ingresar al módulo de estudio y luego me retorna automático al
 * módulo de dashboard».
 *
 * No era un fallo del Estudio: su página exige ADMIN y la cuenta de Fernando en Peter
 * Tours es OPERADOR, así que la puerta lo devolvía al panel. Lo que estaba mal es que
 * **el menú se lo seguía ofreciendo**: filtraba por tipo de automatización pero no por
 * rol, así que enseñaba un destino que iba a rebotar.
 *
 * Y el rebote era MUDO. Un enlace que te deja donde estabas, sin decir nada, es
 * indistinguible de una aplicación rota — por eso llegó como «revísalo, por favor» y no
 * como «no tengo permiso».
 *
 * ── LA REGLA ────────────────────────────────────────────────────────────────────
 * El requisito vive AQUÍ y lo leen los dos: la página, al llamar a `exigirContexto`, y el
 * menú, al decidir qué pintar. Mientras estuvieron en sitios distintos —uno en cada
 * `page.tsx`, el otro implícito en `Navegacion`— era cuestión de tiempo que dejaran de
 * coincidir. Con esto, un módulo nuevo se declara una vez y las dos mitades lo obedecen.
 *
 * Es la misma norma de siempre en el grupo: el cliente no ve lo que no puede hacer.
 */
export const EXIGE_ROL = {
  panel: 'CONSULTA',
  conversaciones: 'CONSULTA',
  estudio: 'ADMIN',
  envios: 'CONSULTA',
  usuarios: 'ADMIN',
  configuracion: 'ADMIN',
} as const satisfies Record<string, Rol>;

export type RutaDeModulo = keyof typeof EXIGE_ROL;

/** Cómo se llama el módulo cuando hay que nombrarlo en un aviso. */
export const NOMBRE_DEL_MODULO: Record<RutaDeModulo, string> = {
  panel: 'el panel',
  conversaciones: 'las conversaciones',
  estudio: 'el estudio del agente',
  envios: 'los envíos',
  usuarios: 'las cuentas',
  configuracion: 'la configuración',
};

export const esRutaDeModulo = (r: string): r is RutaDeModulo => r in EXIGE_ROL;
