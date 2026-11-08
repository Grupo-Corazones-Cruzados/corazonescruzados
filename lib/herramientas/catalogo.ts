import {
  Repeat2, Captions, Printer, QrCode, Link2, MonitorDown, PackageOpen, type LucideIcon,
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
};

export const HERRAMIENTAS: Herramienta[] = [
  { id: 'convert', name: 'Convertir Archivos', Icon: Repeat2, category: 'edicion', description: 'Convierte archivos de audio entre formatos (M4A, MP4, WAV, OGG → MP3, etc.).' },
  { id: 'transcribe', name: 'Transcribir Audio', Icon: Captions, category: 'edicion', description: 'Transcribe archivos de audio a texto usando inteligencia artificial (Whisper).' },
  { id: 'formatos-excel', name: 'Formatos de impresión para Excel', Icon: Printer, category: 'edicion', compartible: true, description: 'Corrige la impresión de un libro de Excel (papel, márgenes, títulos y número de página) y lo descarga en Excel o PDF.' },
  { id: 'qr', name: 'Enlace a código QR', Icon: QrCode, category: 'edicion', description: 'Convierte un enlace en un código QR para descargar en PNG o SVG.' },
  { id: 'enlace-unico', name: 'Enlace de un solo uso', Icon: Link2, category: 'gestion', soloEquipo: true, description: 'Pide un texto y hasta 10 archivos con un enlace que se cierra al recibir la respuesta.' },
  { id: 'descargador-video', name: 'Descargador de video', Icon: MonitorDown, category: 'app', soloMiembrosApp: true, description: 'App para Android que guarda en el teléfono videos o audio a partir de un enlace.' },
  { id: 'gcc-centralizado', name: 'GCC Miembros', Icon: MonitorDown, category: 'app', soloEquipo: true, soloMiembrosApp: true, description: 'App para Android de los miembros, con Centralizado y Control Psicosocial.' },
  { id: 'entrega-unica', name: 'Entrega de un solo uso', Icon: PackageOpen, category: 'gestion', soloEquipo: true, description: 'Envía un mensaje y hasta 10 archivos con un enlace que se cierra cuando lo descargan.' },
];

/** Las que ve esta cuenta en este sitio. `app` = `appDeTelefono()` (null en el navegador). */
export function herramientasPara(esEquipo: boolean, app: AppDeTelefono | null): Herramienta[] {
  return HERRAMIENTAS.filter((h) => (!h.soloEquipo || esEquipo) && !(h.soloMiembrosApp && app === 'progreso'));
}
