import {
  Apple, BarChart3, Bike, BookOpen, BookOpenText, Building2, CalendarClock, CalendarOff, ChefHat, GraduationCap, LayoutDashboard,
  MessagesSquare, Package, Route, Send, Settings, ShieldAlert, SlidersHorizontal, Tag, UserCog, UserRound, Users, type LucideIcon,
} from 'lucide-react';

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
  pedidos: [
    { ruta: 'panel', etiqueta: 'Mesas', Icono: LayoutDashboard },
    { ruta: 'cocina', etiqueta: 'Cocina', Icono: ChefHat },
    { ruta: 'reservas', etiqueta: 'Reservas', Icono: CalendarClock },
    { ruta: 'reportes', etiqueta: 'Reportes', Icono: BarChart3 },
    { ruta: 'catalogo', etiqueta: 'Carta', Icono: BookOpen, soloAdmin: true },
    { ruta: 'usuarios', etiqueta: 'Usuarios', Icono: Users, soloAdmin: true },
    { ruta: 'configuracion', etiqueta: 'Configuración', Icono: Settings, soloAdmin: true },
  ],
  catering: [
    { ruta: 'panel', etiqueta: 'Panel', Icono: LayoutDashboard },
    { ruta: 'clientes', etiqueta: 'Clientes', Icono: Users, soloAdmin: true },
    { ruta: 'servicios', etiqueta: 'Servicios', Icono: Package, soloAdmin: true },
    { ruta: 'menus', etiqueta: 'Menús', Icono: ChefHat },
    { ruta: 'etiquetas', etiqueta: 'Etiquetas', Icono: Tag },
    { ruta: 'restricciones', etiqueta: 'Restricciones', Icono: ShieldAlert },
    { ruta: 'alimentos', etiqueta: 'Alimentos', Icono: Apple },
    { ruta: 'rutas', etiqueta: 'Rutas', Icono: Route },
    { ruta: 'motorizados', etiqueta: 'Motorizados', Icono: Bike },
    { ruta: 'reportes', etiqueta: 'Reportes', Icono: BarChart3, soloAdmin: true },
    { ruta: 'feriados', etiqueta: 'Feriados', Icono: CalendarOff, soloAdmin: true },
    { ruta: 'usuarios', etiqueta: 'Usuarios', Icono: UserCog, soloAdmin: true },
    { ruta: 'configuracion', etiqueta: 'Configuración', Icono: Settings, soloAdmin: true },
  ],
  planificaciones: [
    { ruta: 'panel', etiqueta: 'Inicio', Icono: LayoutDashboard },
    { ruta: 'planificaciones', etiqueta: 'Planificaciones', Icono: BookOpenText },
    { ruta: 'estudiantes', etiqueta: 'Estudiantes', Icono: Users },
    { ruta: 'perfil', etiqueta: 'Mi perfil', Icono: UserRound },
    { ruta: 'unidades', etiqueta: 'Unidades', Icono: GraduationCap, soloAdmin: true },
    { ruta: 'negocio', etiqueta: 'Negocio', Icono: Building2, soloAdmin: true },
    { ruta: 'usuarios', etiqueta: 'Usuarios', Icono: UserCog, soloAdmin: true },
    { ruta: 'configuracion', etiqueta: 'Configuración', Icono: Settings, soloAdmin: true },
  ],
  // Conversaciones y Estudio solo existen si el negocio tiene un agente de IA; si no, la página del
  // producto devuelve al panel.
  automatizaciones: [
    { ruta: 'panel', etiqueta: 'Panel', Icono: LayoutDashboard },
    { ruta: 'conversaciones', etiqueta: 'Conversaciones', Icono: MessagesSquare },
    { ruta: 'estudio', etiqueta: 'Estudio', Icono: SlidersHorizontal, soloAdmin: true },
    { ruta: 'envios', etiqueta: 'Envíos', Icono: Send },
    { ruta: 'configuracion', etiqueta: 'Configuración', Icono: Settings, soloAdmin: true },
  ],
};

export const PRODUCTOS_EMBEBIDOS = new Set(Object.keys(MODULOS_PRODUCTO));

export const rutaDelProducto = (producto: string, slug: string) => `/dashboard/producto/${producto}/${encodeURIComponent(slug)}`;
