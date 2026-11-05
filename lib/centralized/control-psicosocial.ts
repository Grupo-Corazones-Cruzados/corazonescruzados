/**
 * CONTROL PSICOSOCIAL — lo que comparten el servidor, la pantalla y el teléfono.
 * Sistema de Centralizado (colaborador · implementación). Primera sección: Rastreo.
 */

export const SLUG_CONTROL_PSICOSOCIAL = 'control-psicosocial';
export const RUTA_CONTROL_PSICOSOCIAL = `/dashboard/centralized/colaborador/implementacion/${SLUG_CONTROL_PSICOSOCIAL}`;

/** La frase que dispara el auxilio. El teléfono la recibe al activarse: cambiarla es cambiar esto. */
export const FRASE_AUXILIO = 'yo te entrego todo';
/** Margen para cancelar una detección de voz equivocada antes de avisar a todos. */
export const SEGUNDOS_PARA_CANCELAR = 10;

/** Cada cuánto manda el teléfono su posición: normal y durante un auxilio. */
export const INTERVALO_NORMAL_S = 60;
export const INTERVALO_AUXILIO_S = 15;
/** Más viejo que esto, ya no se considera señal activa: da margen a cortes de red y al ahorro del teléfono. */
export const MINUTOS_SENAL_ACTIVA = 15;
export const DIAS_HISTORIAL = 7;

export type FuncionCp = 'ubicacion' | 'voz';

/** Si cambia lo que se acepta, se sube la versión: queda escrito qué texto aceptó cada quien. */
export const VERSION_CONSENTIMIENTO = 3;

export const CONSENTIMIENTO: Record<FuncionCp, { titulo: string; puntos: string[]; aceptar: string }> = {
  ubicacion: {
    titulo: 'Compartir mi ubicación',
    aceptar: 'Acepto y activar',
    puntos: [
      'Este teléfono enviará tu ubicación a GCC World cada minuto, también con la app cerrada, y cada 15 segundos durante un auxilio. Esto gasta más batería.',
      `Todos los miembros, incluido el administrador, pueden ver en el mapa dónde estás y tu recorrido de los últimos ${DIAS_HISTORIAL} días.`,
      'Al llegar a un punto de reunión marcado por un administrador, los demás miembros reciben un aviso y tu llegada queda registrada.',
      'Cada vez que otro miembro abre el mapa queda registrado, y tú puedes ver quién fue.',
      'El mapa se dibuja con OpenStreetMap: al abrirlo, ese servicio recibe la zona que se está mirando.',
      `El recorrido y las llegadas se borran a los ${DIAS_HISTORIAL} días. Lo registrado durante un auxilio se conserva con ese auxilio.`,
      'El teléfono mostrará siempre que está activo. Puedes apagarlo cuando quieras desde aquí: se deja de enviar y se borran tu recorrido y tus llegadas.',
      'Es voluntario. Negarte no te impide usar el resto de la plataforma.',
    ],
  },
  voz: {
    titulo: 'Detección de la frase de auxilio',
    aceptar: 'Acepto y activar',
    puntos: [
      `Este teléfono escuchará de forma continua para detectar la frase «${FRASE_AUXILIO}».`,
      'El audio se procesa solo dentro del teléfono: no se graba, no se guarda y no se envía a ningún sitio.',
      `Al detectarla, el teléfono vibra y tienes ${SEGUNDOS_PARA_CANCELAR} segundos para cancelar. Después, todos los miembros reciben tu alerta con tu ubicación.`,
      'El teléfono mostrará siempre que el micrófono está en uso. Gasta más batería. Puedes apagarlo cuando quieras desde aquí.',
      'Es voluntario. Negarte no te impide usar el resto de la plataforma.',
    ],
  },
};

export type FilaRastreo = {
  user_id: string;
  nombre: string;
  ubicacion_activa: boolean;
  voz_activa: boolean;
  lat: number | null;
  lng: number | null;
  precision_m: number | null;
  bateria: number | null;
  registrada_en: string | null;
  alerta_id: number | null;
  /** El punto de reunión donde está ahora, si está en alguno. */
  lugar_actual: string | null;
};

export type Lugar = { id: number; nombre: string; lat: number; lng: number; radio_m: number };

export type RecorridoMiembro = {
  user_id: string;
  nombre: string;
  puntos: { lat: number; lng: number; en: string }[];
  visitas: { lugar: string; llegada_en: string; salida_en: string | null }[];
};

export type EstadoSenal = 'auxilio' | 'activa' | 'sin_senal' | 'no_comparte';

export function estadoSenal(f: FilaRastreo, ahora = Date.now()): EstadoSenal {
  if (f.alerta_id) return 'auxilio';
  if (!f.ubicacion_activa) return 'no_comparte';
  if (!f.registrada_en) return 'sin_senal';
  return ahora - new Date(f.registrada_en).getTime() <= MINUTOS_SENAL_ACTIVA * 60_000 ? 'activa' : 'sin_senal';
}

/** Distancia en metros entre dos puntos (fórmula del semiverseno). */
export function distanciaM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = (g: number) => (g * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2
    + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(a));
}

export const ZONA_HORARIA = 'America/Guayaquil';

/** Un día como `AAAA-MM-DD` en hora de Ecuador: el servidor corre en UTC. */
export function diaEcuador(fecha: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_HORARIA }).format(fecha);
}

/** Los días que el historial conserva, de hoy hacia atrás. */
export function diasConHistorial(ahora = new Date()): string[] {
  return Array.from({ length: DIAS_HISTORIAL }, (_, i) => diaEcuador(new Date(ahora.getTime() - i * 86_400_000)));
}
