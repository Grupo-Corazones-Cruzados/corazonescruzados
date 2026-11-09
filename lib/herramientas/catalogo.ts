import {
  Repeat2, Captions, Printer, QrCode, Link2, MonitorDown, PackageOpen, SquareTerminal, AudioLines, Scissors, type LucideIcon,
} from 'lucide-react';
import type { AppDeTelefono } from '@/lib/sitio/appDeTelefono';

/**
 * EL CATÁLOGO DE HERRAMIENTAS — una sola lista para el módulo Herramientas y para la pantalla
 * de accesos de las apps (`/dashboard/accesos`). Antes vivía dentro de la página.
 *
 * `soloEquipo`: miembros y admin. Las de «un solo uso» atan clientes de GCC y guardan en el Drive
 * de la empresa; sus APIs exigen `esEquipo`.
 * `compartible`: el equipo puede compartirla por enlace con token (`lib/herramientas/accesos`).
 * `soloMiembrosApp`: piden permisos o hacen cosas que las tiendas no aceptan (instalar un APK,
 * descargar de YouTube, ubicación y micrófono en segundo plano). En la app de la tienda, GCC World,
 * no se ofrecen; en GCC Miembros y en el navegador, sí (Fernando, 2026-11-08).
 * `soloAdmin` + `abre`: el Espacio de trabajo y Gumdramon, que eran pestañas del módulo Admin. No
 * tienen pantalla aquí: llevan a su ruta (`useRutasEspacio`), y donde no existe no se ofrecen.
 * El Cortador de sprites también va por `abre`: escribe en la carpeta del juego de la Mac, así que se usa
 * en la instancia local o, en las apps, en un marco servido por la Mac (Tailscale).
 * GCC Miembros NO está: se instala en persona en el onboarding, nunca la descarga el usuario.
 */
export type Herramienta = {
  id: string;
  name: string;
  Icon: LucideIcon;
  description: string;
  category: 'edicion' | 'gestion' | 'app';
  soloEquipo?: boolean;
  compartible?: boolean;
  soloMiembrosApp?: boolean;
  soloAdmin?: boolean;
  abre?: 'espacio' | 'gumdramon' | 'sprites';
};

export const HERRAMIENTAS: Herramienta[] = [
  { id: 'convert', name: 'Convertir Archivos', Icon: Repeat2, category: 'edicion', compartible: true, description: 'Convierte archivos de audio entre formatos (M4A, MP4, WAV, OGG → MP3, etc.).' },
  { id: 'transcribe', name: 'Transcribir Audio', Icon: Captions, category: 'edicion', compartible: true, description: 'Transcribe archivos de audio a texto usando inteligencia artificial (Whisper).' },
  { id: 'formatos-excel', name: 'Formatos de impresión para Excel', Icon: Printer, category: 'edicion', compartible: true, description: 'Corrige la impresión de un libro de Excel (papel, márgenes, títulos y número de página) y lo descarga en Excel o PDF.' },
  { id: 'qr', name: 'Enlace a código QR', Icon: QrCode, category: 'edicion', compartible: true, description: 'Convierte un enlace en un código QR para descargar en PNG o SVG.' },
  { id: 'enlace-unico', name: 'Enlace de un solo uso', Icon: Link2, category: 'gestion', soloEquipo: true, description: 'Pide un texto y hasta 10 archivos con un enlace que se cierra al recibir la respuesta.' },
  { id: 'descargador-video', name: 'Descargador de video', Icon: MonitorDown, category: 'app', soloMiembrosApp: true, description: 'App para Android que guarda en el teléfono videos o audio a partir de un enlace.' },
  { id: 'entrega-unica', name: 'Entrega de un solo uso', Icon: PackageOpen, category: 'gestion', soloEquipo: true, description: 'Envía un mensaje y hasta 10 archivos con un enlace que se cierra cuando lo descargan.' },
  { id: 'entorno', name: 'Espacio de trabajo', Icon: SquareTerminal, category: 'gestion', soloEquipo: true, soloAdmin: true, soloMiembrosApp: true, abre: 'espacio', description: 'Las sesiones de Claude Code y de desarrollo del servidor local.' },
  { id: 'sprites', name: 'Cortador de sprites', Icon: Scissors, category: 'edicion', soloEquipo: true, soloAdmin: true, soloMiembrosApp: true, abre: 'sprites', description: 'Corta las poses de un personaje en fotogramas, agrúpalos en animaciones, míralas en movimiento y guárdalas en la carpeta del videojuego.' },
  { id: 'gumdramon', name: 'Gumdramon', Icon: AudioLines, category: 'gestion', soloEquipo: true, soloAdmin: true, soloMiembrosApp: true, abre: 'gumdramon', description: 'Copiloto de reuniones: escucha la conversación y te sugiere qué responder.' },
];

/** Las que ve esta cuenta en este sitio. `app` = `appDeTelefono()` (null en el navegador). */
export function herramientasPara(
  { esEquipo, esAdmin, app, conEspacio }: { esEquipo: boolean; esAdmin: boolean; app: AppDeTelefono | null; conEspacio: boolean },
): Herramienta[] {
  return HERRAMIENTAS.filter((h) => (!h.soloEquipo || esEquipo) && (!h.soloAdmin || esAdmin)
    && !(h.soloMiembrosApp && app === 'progreso') && (!h.abre || conEspacio));
}

/** Rutas que en las apps son una herramienta (sección aparte de Progreso, tema de Accesos). */
export const RUTAS_HERRAMIENTA = ['/dashboard/tools', '/dashboard/tools/sprites', '/dashboard/admin/espacio', '/dashboard/admin/espacio-app', '/dashboard/admin/gumdramon-app', '/dashboard/admin/sprites-app'];
