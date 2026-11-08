import { BarChart3, LayoutDashboard, Settings, Users, type LucideIcon } from 'lucide-react';

/**
 * LOS MÓDULOS DE CADA PRODUCTO, para su menú dentro de GCC World (segunda capa de Accesos; Fernando,
 * 2026-11-08). Copia del menú de cada producto (`productos/<p>/src/componentes/Navegacion.tsx`): si
 * cambia allí, se cambia aquí. El producto sigue decidiendo qué deja ver a cada rol; aquí `soloAdmin`
 * solo evita ofrecer lo que un usuario normal no podría abrir.
 *
 * Solo los productos de `PRODUCTOS_EMBEBIDOS` saben entrar con la sesión de GCC World
 * (`/<slug>/entrar`); los demás se siguen abriendo como antes, hasta que lo tengan.
 */
export type ModuloProducto = { ruta: string; etiqueta: string; Icono: LucideIcon; soloAdmin?: boolean };

export const MODULOS_PRODUCTO: Record<string, ModuloProducto[]> = {
  reservas: [
    { ruta: 'panel', etiqueta: 'Panel', Icono: LayoutDashboard },
    { ruta: 'reportes', etiqueta: 'Reportes', Icono: BarChart3 },
    { ruta: 'usuarios', etiqueta: 'Usuarios', Icono: Users, soloAdmin: true },
    { ruta: 'configuracion', etiqueta: 'Configuración', Icono: Settings, soloAdmin: true },
  ],
};

export const PRODUCTOS_EMBEBIDOS = new Set(Object.keys(MODULOS_PRODUCTO));

export const rutaDelProducto = (producto: string, slug: string) => `/dashboard/producto/${producto}/${encodeURIComponent(slug)}`;
